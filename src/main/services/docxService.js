/**
 * Compilazione del Modulo di Adesione a partire dal template con segnaposto
 * (docxtemplater + pizzip). Vengono modificati SOLO i segnaposto: il resto del
 * documento resta identico all'originale.
 */
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import PizZip from 'pizzip'
import Docxtemplater from 'docxtemplater'
import { getSettings } from './settingsService.js'
import { buildDocxData } from './recordMapper.js'

export function templatePath() {
  const candidates = [
    join(process.resourcesPath || '', 'templates', 'modulo_template.docx'),
    join(app.getAppPath(), 'templates', 'modulo_template.docx'),
    join(app.getAppPath(), '..', 'templates', 'modulo_template.docx'),
    join(process.cwd(), 'templates', 'modulo_template.docx')
  ]
  for (const p of candidates) {
    try { if (p && existsSync(p)) return p } catch (_) {}
  }
  throw new Error('Template del modulo non trovato (templates/modulo_template.docx)')
}

const PLACEHOLDERS = ['cognome_nome', 'targa', 'residenza', 'citta', 'cap', 'provincia', 'codice_fiscale', 'email', 'tel', 'data_inizio', 'data_fine', 'premio', 'pacchetto']

/** Compila il modulo per un record e lo salva in outPath. */
export function fillModulo(record, outPath) {
  const settings = getSettings()
  const data = buildDocxData(record, settings.fields, settings.prezzi, settings.dateOffsetDays)
  // Garantisce che tutti i segnaposto noti esistano (evita errori per tag mancanti)
  for (const k of PLACEHOLDERS) if (!(k in data)) data[k] = ''

  const content = readFileSync(templatePath())
  const zip = new PizZip(content)
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{{', end: '}}' },
    nullGetter: () => ''
  })
  doc.render(data)
  const buf = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  writeFileSync(outPath, buf)
  return outPath
}
