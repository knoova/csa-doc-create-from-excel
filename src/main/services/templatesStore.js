/**
 * Libreria dei template HTML del modulo. I template importati sono COPIATI in
 * userData/template-lib/<id>/ (bundle esportato da Pages: page-*.xhtml, css,
 * fonts, images); il registro userData/templates.json ne tiene id, nome e
 * inventario dei segnaposto.
 *
 * Il template incluso nell'app (templates/modulo_html) resta sempre disponibile
 * come predefinito (id 'default') e non è cancellabile.
 *
 * La SCELTA del template è per-configurazione: vive in settings.templateId e
 * viene quindi salvata/esportata con i preset. I file dei template, invece,
 * sono globali (condivisi tra le configurazioni).
 */
import { app } from 'electron'
import { join, basename } from 'path'
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, cpSync, rmSync } from 'fs'
import { mergePlaceholders } from './templateScan.js'

export const DEFAULT_TEMPLATE_ID = 'default'
const PAGE_RE = /\.x?html?$/i

function firstExisting(paths) {
  for (const p of paths) {
    try { if (p && existsSync(p)) return p } catch (_) {}
  }
  return null
}

/** Cartella del template incluso nell'app (predefinito). */
export function bundledTemplateDir() {
  const p = firstExisting([
    join(process.resourcesPath || '', 'templates', 'modulo_html'),
    join(app.getAppPath(), 'templates', 'modulo_html'),
    join(app.getAppPath(), '..', 'templates', 'modulo_html'),
    join(process.cwd(), 'templates', 'modulo_html')
  ])
  if (!p) throw new Error('Template HTML del modulo non trovato (templates/modulo_html)')
  return p
}

/** Cartella (creata al volo) della libreria template importati. */
export function templateLibDir() {
  const dir = join(app.getPath('userData'), 'template-lib')
  mkdirSync(dir, { recursive: true })
  return dir
}

function registryPath() {
  return join(app.getPath('userData'), 'templates.json')
}

function readRegistry() {
  try {
    const raw = JSON.parse(readFileSync(registryPath(), 'utf-8'))
    return { templates: Array.isArray(raw.templates) ? raw.templates : [] }
  } catch {
    return { templates: [] }
  }
}

function writeRegistry(reg) {
  writeFileSync(registryPath(), JSON.stringify(reg, null, 2), 'utf-8')
  return reg
}

/** File pagina (.xhtml/.html) di un bundle template, ordinati per nome. */
export function templatePageFiles(dir) {
  try {
    return readdirSync(dir).filter((f) => PAGE_RE.test(f)).sort()
  } catch {
    return []
  }
}

/** Inventario dei segnaposto di un bundle template (unione di tutte le pagine). */
export function scanTemplateDir(dir) {
  const texts = templatePageFiles(dir).map((f) => {
    try { return readFileSync(join(dir, f), 'utf-8') } catch { return '' }
  })
  return mergePlaceholders(texts)
}

/** Cartella su disco del template scelto (fallback al predefinito se assente). */
export function templateDir(id) {
  if (!id || id === DEFAULT_TEMPLATE_ID) return bundledTemplateDir()
  const dir = join(templateLibDir(), id)
  return existsSync(dir) ? dir : bundledTemplateDir()
}

/** Voce del template predefinito, con inventario segnaposto scansionato al volo. */
function defaultEntry() {
  let placeholders = []
  try { placeholders = scanTemplateDir(bundledTemplateDir()) } catch (_) {}
  return { id: DEFAULT_TEMPLATE_ID, name: 'Modulo CSA (predefinito)', builtin: true, placeholders }
}

/** Elenco template: predefinito + importati (ognuno con il proprio inventario). */
export function listTemplates() {
  const reg = readRegistry()
  return { templates: [defaultEntry(), ...reg.templates.map((t) => ({ ...t, builtin: false }))] }
}

/** Inventario segnaposto del template attualmente scelto in `settings`. */
export function placeholdersForSettings(settings) {
  const id = settings?.templateId || DEFAULT_TEMPLATE_ID
  const found = listTemplates().templates.find((t) => t.id === id)
  return found ? (found.placeholders || []) : []
}

function newId() {
  return `tpl_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
}

/**
 * Importa un bundle template da una cartella. La cartella deve contenere almeno
 * un file pagina (.xhtml/.html). Copia tutto in userData/template-lib/<id>/,
 * scansiona i segnaposto e registra il template.
 */
export function importTemplateDir(srcDir, name) {
  if (!srcDir || !existsSync(srcDir) || !statSync(srcDir).isDirectory()) {
    throw new Error('Cartella template non valida')
  }
  if (templatePageFiles(srcDir).length === 0) {
    throw new Error('La cartella non contiene pagine del modulo (.xhtml/.html)')
  }
  const id = newId()
  const dest = join(templateLibDir(), id)
  cpSync(srcDir, dest, { recursive: true })
  const placeholders = scanTemplateDir(dest)
  const entry = { id, name: String(name || basename(srcDir) || 'Template').trim(), importedAt: new Date().toISOString(), placeholders }
  const reg = readRegistry()
  reg.templates.push(entry)
  writeRegistry(reg)
  return { entry, ...listTemplates() }
}

/** Elimina un template importato (il predefinito non è cancellabile). */
export function deleteTemplate(id) {
  if (!id || id === DEFAULT_TEMPLATE_ID) throw new Error('Il template predefinito non può essere eliminato')
  const reg = readRegistry()
  reg.templates = reg.templates.filter((t) => t.id !== id)
  writeRegistry(reg)
  try { const dir = join(templateLibDir(), id); if (existsSync(dir)) rmSync(dir, { recursive: true, force: true }) } catch (_) {}
  return listTemplates()
}
