/**
 * Scrittura del tracciato AXA (exceljs): riga 1 = intestazioni, poi una riga per
 * ciascun record. Le date sono testo GG/MM/AAAA per preservare il formato
 * richiesto dalla compagnia.
 */
import ExcelJS from 'exceljs'
import { TRACCIATO_HEADERS } from './tracciato.js'
import { getSettings } from './settingsService.js'
import { buildTrackRow } from './recordMapper.js'

/**
 * Scrive un file XLS con tutte le righe passate.
 * @param {object[]} records  lista di record (oggetto dati) o voci dello store
 *                            ({ data }). In entrambi i casi si usa il record dati.
 * @param {string} outPath
 * @param {string[]} [headers]  intestazioni (default: canoniche). Se si carica un
 *                              flusso reale si passano le sue per match perfetto.
 */
export async function writeRows(records, outPath, headers = TRACCIATO_HEADERS) {
  const settings = getSettings()
  const list = Array.isArray(records) ? records : []

  const wb = new ExcelJS.Workbook()
  wb.creator = 'CSA Adesioni — ThinkPink Studio'
  wb.created = new Date()
  const ws = wb.addWorksheet('flusso')
  ws.addRow(headers)
  for (const entry of list) {
    const data = entry && entry.data ? entry.data : entry
    const row = buildTrackRow(data, settings.fields, settings.idd, headers)
    const added = ws.addRow(row)
    // Le celle sono già stringhe; forziamo il formato testo per le colonne data.
    added.eachCell((cell) => { cell.numFmt = '@' })
  }
  await wb.xlsx.writeFile(outPath)
  return outPath
}

/**
 * Scrive il tracciato a una sola riga (retro-compatibile).
 * @param {object} record
 * @param {string} outPath
 * @param {string[]} [headers]
 */
export async function writeOneRow(record, outPath, headers = TRACCIATO_HEADERS) {
  return writeRows([record], outPath, headers)
}
