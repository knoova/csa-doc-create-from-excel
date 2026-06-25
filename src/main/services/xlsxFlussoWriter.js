/**
 * Scrittura del tracciato AXA a una riga (exceljs): riga 1 = intestazioni,
 * riga 2 = dati del singolo aderente. Le date sono testo GG/MM/AAAA per
 * preservare il formato richiesto dalla compagnia.
 */
import ExcelJS from 'exceljs'
import { TRACCIATO_HEADERS } from './tracciato.js'
import { getSettings } from './settingsService.js'
import { buildTrackRow } from './recordMapper.js'

/**
 * @param {object} record
 * @param {string} outPath
 * @param {string[]} [headers]  intestazioni (default: canoniche). Se si carica un
 *                              flusso reale si passano le sue per match perfetto.
 */
export async function writeOneRow(record, outPath, headers = TRACCIATO_HEADERS) {
  const settings = getSettings()
  const row = buildTrackRow(record, settings.fields, settings.idd, headers)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'CSA Adesioni — ThinkPink Studio'
  wb.created = new Date()
  const ws = wb.addWorksheet('flusso')
  ws.addRow(headers)
  ws.addRow(row)
  // Le celle sono già stringhe; forziamo il formato testo per le colonne data.
  ws.getRow(2).eachCell((cell) => { cell.numFmt = '@' })
  await wb.xlsx.writeFile(outPath)
  return outPath
}
