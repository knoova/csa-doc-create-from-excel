import { test } from 'node:test'
import assert from 'node:assert/strict'
import ExcelJS from 'exceljs'

import { nextIdentificativo, advanceIfAccepted } from '../src/main/services/numbering.js'
import { buildTrackRow } from '../src/main/services/recordMapper.js'
import { TRACCIATO_HEADERS, DEFAULT_FIELDS, DEFAULT_IDD } from '../src/main/services/tracciato.js'

// ─── Incremento identificativo ──────────────────────────────────────────────
test('nextIdentificativo preserva prefisso e zero-padding', () => {
  assert.equal(nextIdentificativo('W0000001'), 'W0000002')
  assert.equal(nextIdentificativo('S013'), 'S014')
  assert.equal(nextIdentificativo('S099'), 'S100')   // allarga solo se trabocca
  assert.equal(nextIdentificativo('999'), '1000')
  assert.equal(nextIdentificativo('AB12C'), 'AB13C') // suffisso preservato
})

test('nextIdentificativo lascia invariato un valore senza cifre', () => {
  assert.equal(nextIdentificativo('ABC'), 'ABC')
  assert.equal(nextIdentificativo(''), '')
})

// ─── Regola di avanzamento (override non conteggiato) ───────────────────────
test('advanceIfAccepted avanza solo se il suggerimento è accettato', () => {
  // proposta accettata → avanza
  assert.equal(advanceIfAccepted('S013', 'S013'), 'S014')
  // override (numero "vecchio") → NON conta, ripropone S013
  assert.equal(advanceIfAccepted('S013', 'S009'), 'S013')
  // override verso un numero superiore → comunque non conta
  assert.equal(advanceIfAccepted('S013', 'S020'), 'S013')
  // nessuna serie attiva → resta vuoto
  assert.equal(advanceIfAccepted('', 'W0000001'), '')
})

test('sequenza tipica: accettazioni consecutive e un override in mezzo', () => {
  let next = 'W0000001'
  next = advanceIfAccepted(next, 'W0000001') // accetta → W0000002
  assert.equal(next, 'W0000002')
  next = advanceIfAccepted(next, 'W0000002') // accetta → W0000003
  assert.equal(next, 'W0000003')
  next = advanceIfAccepted(next, 'S009')     // override → resta W0000003
  assert.equal(next, 'W0000003')
  next = advanceIfAccepted(next, 'W0000003') // accetta → W0000004
  assert.equal(next, 'W0000004')
})

// ─── Tracciato multi-riga ────────────────────────────────────────────────────
test('più record producono una riga ciascuno nel tracciato (header + N righe)', async () => {
  const mk = (over) => {
    const r = { idd: {} }
    for (const f of DEFAULT_FIELDS) r[f.id] = f.type === 'fixed' ? f.fixed : ''
    return { ...r, ...over }
  }
  const records = [
    mk({ identificativo: 'W0000001', cognome: 'Rossi', nome: 'Mario', targa: 'AB123CD', tipo_movimento: 'M' }),
    mk({ identificativo: 'W0000002', cognome: 'Verdi', nome: 'Lucia', targa: 'EF456GH', tipo_movimento: 'M' })
  ]

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('flusso')
  ws.addRow(TRACCIATO_HEADERS)
  for (const rec of records) ws.addRow(buildTrackRow(rec, DEFAULT_FIELDS, DEFAULT_IDD, TRACCIATO_HEADERS))

  assert.equal(ws.rowCount, 3) // 1 intestazione + 2 righe dati

  const idCol = TRACCIATO_HEADERS.indexOf('IDENTIFICATIVO UNIVOCO APPLICAZIONE') + 1
  assert.equal(ws.getRow(2).getCell(idCol).value, 'W0000001')
  assert.equal(ws.getRow(3).getCell(idCol).value, 'W0000002')

  const cognomeCol = TRACCIATO_HEADERS.indexOf('COGNOME / RAGIONE SOCIALE ASSICURATO') + 1
  assert.equal(ws.getRow(2).getCell(cognomeCol).value, 'Rossi')
  assert.equal(ws.getRow(3).getCell(cognomeCol).value, 'Verdi')
})
