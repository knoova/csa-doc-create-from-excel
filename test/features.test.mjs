import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ExcelJS from 'exceljs'

import { addYearsIT, toModuloDate } from '../src/main/services/coverageDates.js'
import { expiryBucket, groupByExpiry } from '../src/main/services/scadenze.js'
import { appendRowsToFile, readSheetHeaders } from '../src/main/services/xlsxAppend.js'
import { DEFAULT_FIELDS, DEFAULT_IDD, TRACCIATO_HEADERS, normHeader } from '../src/main/services/tracciato.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, 'fixtures', '191025_20251021.xlsx')

// ─── Fix date modulo ─────────────────────────────────────────────────────────
test('toModuloDate senza offset (default) mostra la data così com\'è', () => {
  assert.equal(toModuloDate('31/10/2025'), '31/10/2025')
  assert.equal(toModuloDate('04/02/2025', 0), '04/02/2025')
})

// ─── Rinnovo +1 anno ─────────────────────────────────────────────────────────
test('addYearsIT sposta la data di un anno', () => {
  assert.equal(addYearsIT('04/02/2025'), '04/02/2026')
  assert.equal(addYearsIT('31/12/2025', 1), '31/12/2026')
  assert.equal(addYearsIT('15/06/2024', 2), '15/06/2026')
})

test('addYearsIT gestisce il 29 febbraio e i valori non validi', () => {
  assert.equal(addYearsIT('29/02/2024'), '28/02/2025')
  assert.equal(addYearsIT(''), '')
  assert.equal(addYearsIT('non-una-data'), 'non-una-data')
})

// ─── Scadenze ────────────────────────────────────────────────────────────────
test('expiryBucket classifica mese passato/corrente/successivo', () => {
  const now = new Date(Date.UTC(2026, 6, 5)) // 05/07/2026
  assert.equal(expiryBucket('15/06/2026', now), 'past')
  assert.equal(expiryBucket('01/07/2026', now), 'current')
  assert.equal(expiryBucket('31/07/2026', now), 'current')
  assert.equal(expiryBucket('10/08/2026', now), 'next')
  assert.equal(expiryBucket('01/09/2026', now), null)
  assert.equal(expiryBucket('31/05/2026', now), null)
  assert.equal(expiryBucket('', now), null)
})

test('expiryBucket attraversa il cambio anno (gennaio)', () => {
  const now = new Date(Date.UTC(2026, 0, 10)) // 10/01/2026
  assert.equal(expiryBucket('20/12/2025', now), 'past')
  assert.equal(expiryBucket('15/01/2026', now), 'current')
  assert.equal(expiryBucket('05/02/2026', now), 'next')
})

test('groupByExpiry raggruppa le voci dello store e ordina per data', () => {
  const now = new Date(Date.UTC(2026, 6, 5))
  const entries = [
    { id: 'a', data: { data_fine: '20/07/2026' } },
    { id: 'b', data: { data_fine: '02/07/2026' } },
    { id: 'c', data: { data_fine: '10/06/2026' } },
    { id: 'd', data: { data_fine: '01/08/2026' } },
    { id: 'e', data: { data_fine: '01/01/2030' } }
  ]
  const g = groupByExpiry(entries, now)
  assert.deepEqual(g.past.map(x => x.id), ['c'])
  assert.deepEqual(g.current.map(x => x.id), ['b', 'a'])
  assert.deepEqual(g.next.map(x => x.id), ['d'])
})

// ─── Append a XLS esistente ──────────────────────────────────────────────────
test('appendRowsToFile accoda i record in fondo mantenendo le intestazioni', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'csa-append-'))
  const target = join(dir, 'esistente.xlsx')
  copyFileSync(FIXTURE, target)

  const before = new ExcelJS.Workbook()
  await before.xlsx.readFile(target)
  const rowsBefore = before.worksheets[0].actualRowCount - 1
  const headersBefore = readSheetHeaders(before.worksheets[0])

  const records = [
    { codice_configurazione: '00002', cognome: 'BIANCHI', nome: 'LUCA', targa: 'ZZ111ZZ', tipo_movimento: 'A', idd: { INTERESSE_COPERTURA: 'S' } },
    { data: { codice_configurazione: '00003', cognome: 'VERDI', nome: 'ANNA', targa: 'YY222YY', tipo_movimento: 'E', idd: {} } }
  ]
  const res = await appendRowsToFile(records, target, DEFAULT_FIELDS, DEFAULT_IDD)
  assert.equal(res.appended, 2)

  const after = new ExcelJS.Workbook()
  await after.xlsx.readFile(target)
  const ws = after.worksheets[0]
  assert.deepEqual(readSheetHeaders(ws), headersBefore) // intestazioni intatte
  assert.equal(ws.actualRowCount - 1, rowsBefore + 2)

  const col = (h) => headersBefore.findIndex(x => normHeader(x) === normHeader(h)) + 1
  const last = ws.getRow(ws.actualRowCount)
  assert.equal(String(last.getCell(col('COGNOME / RAGIONE SOCIALE ASSICURATO')).value), 'VERDI')
  assert.equal(String(last.getCell(col('TARGA VEICOLO')).value), 'YY222YY')
  const prev = ws.getRow(ws.actualRowCount - 1)
  assert.equal(String(prev.getCell(col('COGNOME / RAGIONE SOCIALE ASSICURATO')).value), 'BIANCHI')
  // fissi del tracciato valorizzati anche in append
  assert.equal(String(last.getCell(col('NUMERO POLIZZA')).value), '191025')
})

test('appendRowsToFile senza intestazioni proprie usa quelle canoniche', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'csa-append-'))
  const target = join(dir, 'vuoto.xlsx')
  const wb = new ExcelJS.Workbook()
  wb.addWorksheet('flusso').addRow(TRACCIATO_HEADERS)
  await wb.xlsx.writeFile(target)

  await appendRowsToFile([{ cognome: 'ROSSI', nome: 'MARIO', tipo_movimento: 'A', idd: {} }], target, DEFAULT_FIELDS, DEFAULT_IDD)
  const check = new ExcelJS.Workbook()
  await check.xlsx.readFile(target)
  const ws = check.worksheets[0]
  assert.equal(ws.actualRowCount, 2)
  assert.equal(String(ws.getRow(2).getCell(8).value), 'ROSSI')
})
