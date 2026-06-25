/**
 * Lettura del flusso Excel AXA (exceljs). Restituisce intestazioni, righe grezze
 * (header→valore) e i record mappati per id campo.
 */
import ExcelJS from 'exceljs'
import { getSettings } from './settingsService.js'
import { flussoRowToRecord } from './recordMapper.js'

function cellValue(cell) {
  const v = cell ? cell.value : null
  if (v == null) return ''
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('text' in v) return v.text
    if ('result' in v) return v.result
    if ('richText' in v && Array.isArray(v.richText)) return v.richText.map(r => r.text).join('')
    if ('hyperlink' in v) return v.text || v.hyperlink
    return ''
  }
  return v
}

export async function loadFlusso(filePath) {
  const settings = getSettings()
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(filePath)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('Foglio non trovato nel file')

  const headerRow = ws.getRow(1)
  const headers = []
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col - 1] = String(cellValue(cell) || '').trim()
  })
  while (headers.length && !headers[headers.length - 1]) headers.pop()

  const rows = []
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    const obj = {}
    let any = false
    headers.forEach((h, i) => {
      if (!h) return
      const v = cellValue(row.getCell(i + 1))
      obj[h] = v
      if (v !== null && v !== '') any = true
    })
    if (any) rows.push(obj)
  })

  const records = rows.map(r => flussoRowToRecord(r, settings.fields, settings.idd))
  return { headers, rows, records, count: rows.length }
}
