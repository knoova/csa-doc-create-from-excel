import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ExcelJS from 'exceljs'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'

import { toModuloDate, toTrackDate } from '../src/main/services/coverageDates.js'
import { premioFor } from '../src/main/services/premioService.js'
import { buildTrackRow, buildDocxData, flussoRowToRecord, validateRecord } from '../src/main/services/recordMapper.js'
import { TRACCIATO_HEADERS, DEFAULT_FIELDS, DEFAULT_IDD, DEFAULT_PREZZI, normHeader } from '../src/main/services/tracciato.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const FIXTURE = join(__dirname, 'fixtures', '191025_20251021.xlsx')
const TEMPLATE = join(ROOT, 'templates', 'modulo_template.docx')

// ─── Date di copertura ───────────────────────────────────────────────────────
test('toModuloDate aggiunge l\'offset (24:00 → giorno reale)', () => {
  assert.equal(toModuloDate('31/10/2025', 1), '01/11/2025')
  assert.equal(toModuloDate('04/02/2025', 1), '05/02/2025')
  assert.equal(toModuloDate('31/12/2025', 1), '01/01/2026')
})

test('toTrackDate normalizza a GG/MM/AAAA e preserva il valore', () => {
  assert.equal(toTrackDate(new Date(Date.UTC(2025, 1, 4))), '04/02/2025')
  assert.equal(toTrackDate('4/2/2025'), '04/02/2025')
})

// ─── Premio ────────────────────────────────────────────────────────────────--
test('premioFor mappa codice configurazione → pacchetto/premio', () => {
  assert.deepEqual(premioFor('00001', DEFAULT_PREZZI), { pacchetto: 'A', premio: '22,50' })
  assert.deepEqual(premioFor('00002', DEFAULT_PREZZI), { pacchetto: 'B', premio: '20,00' })
  assert.deepEqual(premioFor('00003', DEFAULT_PREZZI), { pacchetto: 'C', premio: '39,00' })
  assert.deepEqual(premioFor('99999', DEFAULT_PREZZI), { pacchetto: '', premio: '' })
})

// ─── Tracciato ───────────────────────────────────────────────────────────────
test('buildTrackRow produce 34 colonne con i campi fissi corretti', () => {
  const record = { codice_configurazione: '00001', cognome: 'ROSSI', nome: 'MARIO', targa: 'AR578RT', tipo_movimento: 'A', idd: { INTERESSE_COPERTURA: 'S' } }
  const row = buildTrackRow(record, DEFAULT_FIELDS, DEFAULT_IDD, TRACCIATO_HEADERS)
  assert.equal(row.length, 34)
  const at = (h) => row[TRACCIATO_HEADERS.findIndex(x => normHeader(x) === normHeader(h))]
  assert.equal(at('NUMERO POLIZZA'), '191025')
  assert.equal(at('LOB'), 'A')
  assert.equal(at('TIPOLOGIA POLIZZA'), 'C')
  assert.equal(at('TIPO OGGETTO ASSICURATO'), '2')
  assert.equal(at('COGNOME / RAGIONE SOCIALE ASSICURATO'), 'ROSSI')
  assert.equal(at('CODICE DOMANDA 1'), 'INTERESSE_COPERTURA')
  assert.equal(at('CODICE RISPOSTA 1'), 'S')
})

test('le risposte IDD sono vuote per movimenti non-A, i codici domanda restano', () => {
  const record = { tipo_movimento: 'E', idd: { INTERESSE_COPERTURA: 'S' } }
  const row = buildTrackRow(record, DEFAULT_FIELDS, DEFAULT_IDD, TRACCIATO_HEADERS)
  const i = TRACCIATO_HEADERS.indexOf('CODICE DOMANDA 1')
  assert.equal(row[i], 'INTERESSE_COPERTURA')
  assert.equal(row[i + 1], '') // CODICE RISPOSTA 1 vuota per "E"
})

// ─── Validazione ─────────────────────────────────────────────────────────────
test('validateRecord segnala obbligatori mancanti e formati errati', () => {
  const bad = { codice_configurazione: '00001', data_inizio: '2025-13-40' }
  const { valid, errors } = validateRecord(bad, DEFAULT_FIELDS)
  assert.equal(valid, false)
  assert.ok(errors.cognome === 'required')
  assert.ok(errors.data_inizio) // data non valida
})

// ─── Integrazione: parsing flusso reale ──────────────────────────────────────
test('parsing del flusso di esempio → record corretti', async () => {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(FIXTURE)
  const ws = wb.worksheets[0]
  const headers = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (c, col) => { headers[col - 1] = String(c.value || '').trim() })
  const r2 = ws.getRow(2)
  const rowObj = {}
  headers.forEach((h, i) => { if (h) rowObj[h] = r2.getCell(i + 1).value })
  const rec = flussoRowToRecord(rowObj, DEFAULT_FIELDS, DEFAULT_IDD)
  assert.equal(rec.cognome, 'ROSSI')
  assert.equal(rec.nome, 'MARIO')
  assert.equal(rec.targa, 'AR578RT')
  assert.equal(rec.codice_configurazione, '00001')
  assert.equal(rec.tipo_movimento, 'A')
  assert.equal(rec.data_inizio, '04/02/2025')
  assert.equal(rec.idd.INTERESSE_COPERTURA, 'S')
})

// ─── Integrazione: round-trip tracciato (write → read) ───────────────────────
test('writeOneRow round-trip: intestazioni e valori coincidono', async () => {
  const record = { codice_configurazione: '00003', cognome: 'VERDI', nome: 'GIULIO', targa: 'BW997LP', data_inizio: '31/01/2025', tipo_movimento: 'A', idd: { INTERESSE_COPERTURA: 'S', INTERESSE_SPECIFICO: 'VF35' } }
  const row = buildTrackRow(record, DEFAULT_FIELDS, DEFAULT_IDD, TRACCIATO_HEADERS)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('flusso')
  ws.addRow(TRACCIATO_HEADERS)
  ws.addRow(row)
  const buf = await wb.xlsx.writeBuffer()

  const wb2 = new ExcelJS.Workbook()
  await wb2.xlsx.load(buf)
  const ws2 = wb2.worksheets[0]
  const h = []
  ws2.getRow(1).eachCell({ includeEmpty: true }, (c, col) => { h[col - 1] = String(c.value || '') })
  assert.equal(h.length, 34)
  assert.equal(h[0], 'NUMERO POLIZZA')
  assert.equal(h[11], 'CITTA’ RESIDENZA ASSICURATO')
  const data = ws2.getRow(2)
  assert.equal(String(data.getCell(8).value), 'VERDI') // COGNOME
  assert.equal(String(data.getCell(34).value), 'A')    // TIPO MOVIMENTO
})

// ─── Integrazione: compilazione modulo (solo fills, nessun residuo) ──────────
test('fillModulo sostituisce i segnaposto senza lasciare {{ }} e mantiene la struttura', () => {
  const record = {
    codice_configurazione: '00001', cognome: 'ROSSI', nome: 'MARIO', codice_fiscale: 'MNAVNH87A70A701A',
    indirizzo: 'VIA ROMA 10', cap: '20090', citta: 'Cesano Boscone', provincia: 'MI', targa: 'AR578RT',
    email: 'mario.rossi@example.it', tel: '3331234567', data_inizio: '04/02/2025', data_fine: '04/02/2026'
  }
  const data = buildDocxData(record, DEFAULT_FIELDS, DEFAULT_PREZZI, 1)
  // segnaposto attesi
  assert.equal(data.cognome_nome, 'ROSSI MARIO')
  assert.equal(data.premio, '22,50')
  assert.equal(data.data_inizio, '05/02/2025') // +1 giorno (data reale)
  assert.equal(data.data_fine, '05/02/2026')

  const templateXml = new PizZip(readFileSync(TEMPLATE)).file('word/document.xml').asText()
  const zip = new PizZip(readFileSync(TEMPLATE))
  const doc = new Docxtemplater(zip, { delimiters: { start: '{{', end: '}}' }, paragraphLoop: true, linebreaks: true, nullGetter: () => '' })
  doc.render(data)
  const out = doc.getZip().generate({ type: 'nodebuffer' })
  const filledXml = new PizZip(out).file('word/document.xml').asText()

  assert.ok(!filledXml.includes('{{'), 'nessun segnaposto residuo')
  assert.ok(filledXml.includes('ROSSI MARIO'))
  assert.ok(filledXml.includes('AR578RT'))
  assert.ok(filledXml.includes('05/02/2025'))
  assert.ok(filledXml.includes('mario.rossi@example.it'))
  // struttura preservata: stesso numero di paragrafi
  const count = (s) => (s.match(/<w:p[ >]/g) || []).length
  assert.equal(count(filledXml), count(templateXml))
})
