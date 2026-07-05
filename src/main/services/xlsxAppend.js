/**
 * Append di record in coda a un file XLS esistente nel tracciato AXA.
 * Modulo PURO rispetto a Electron (fields/idd passati dal chiamante) →
 * testabile in Node. Le intestazioni si leggono dalla riga 1 del file di
 * destinazione, così le righe aggiunte rispettano l'ordine colonne esistente.
 */
import ExcelJS from 'exceljs'
import { TRACCIATO_HEADERS } from './tracciato.js'
import { buildTrackRow } from './recordMapper.js'

/** Legge le intestazioni della riga 1 di un worksheet (celle vuote in coda escluse). */
export function readSheetHeaders(ws) {
  const headers = []
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    const v = cell && cell.value
    headers[col - 1] = String(v == null ? '' : (typeof v === 'object' && 'text' in v ? v.text : v)).trim()
  })
  while (headers.length && !headers[headers.length - 1]) headers.pop()
  return headers
}

/**
 * Aggiunge i record in fondo al file esistente e lo riscrive in place.
 * @param {object[]} records  record dati o voci dello store ({ data })
 * @param {string} filePath   file .xlsx esistente
 * @param {object[]} fields   definizione campi (settings.fields)
 * @param {object[]} idd      questionario (settings.idd)
 * @returns {{ file: string, appended: number, total: number }}
 */
export async function appendRowsToFile(records, filePath, fields, idd) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('Nessun foglio trovato nel file selezionato')

  const own = readSheetHeaders(ws)
  const headers = own.length ? own : TRACCIATO_HEADERS

  const list = Array.isArray(records) ? records : []
  for (const entry of list) {
    const data = entry && entry.data ? entry.data : entry
    const row = buildTrackRow(data, fields, idd, headers)
    const added = ws.addRow(row)
    added.eachCell((cell) => { cell.numFmt = '@' })
  }
  await wb.xlsx.writeFile(filePath)
  return { file: filePath, appended: list.length, total: ws.actualRowCount - 1 }
}
