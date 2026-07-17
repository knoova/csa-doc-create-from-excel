/**
 * Preset di configurazione con nome, persistiti in userData/config-presets.json.
 * Un preset è uno snapshot completo dei settings, attivabile con un click
 * (applyPreset → saveSettings) ed esportabile/importabile come JSON.
 *
 * Forma del file:
 *   { active: '<nome>', presets: [{ name, savedAt, settings }] }
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { getSettings, saveSettings } from './settingsService.js'

function storePath() {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'config-presets.json')
}

function readStore() {
  try {
    const raw = JSON.parse(readFileSync(storePath(), 'utf-8'))
    return {
      active: typeof raw.active === 'string' ? raw.active : '',
      presets: Array.isArray(raw.presets) ? raw.presets : []
    }
  } catch {
    return { active: '', presets: [] }
  }
}

function writeStore(store) {
  writeFileSync(storePath(), JSON.stringify(store, null, 2), 'utf-8')
  return store
}

/** Azzera i segreti di un profilo FTP/SFTP (password, chiave privata, passphrase). */
function redactFtpProfile(p) {
  return { ...(p || {}), pass: '', privateKey: '', passphrase: '' }
}

/** Azzera i segreti (SMTP/FTP/SFTP) prima di esporre uno snapshot al di fuori dell'app (export JSON). */
function redactSecrets(settings) {
  const s = { ...settings }
  if (s.smtp) s.smtp = { ...s.smtp, pass: '' }
  if (s.ftp) {
    s.ftp = {
      staging: redactFtpProfile(s.ftp.staging),
      prod: redactFtpProfile(s.ftp.prod)
    }
  }
  return s
}

/** Mantiene un segreto FTP/SFTP corrente se la patch "ripulita" non ne porta uno. */
function keepFtpSecrets(inc, cur) {
  return {
    ...inc,
    pass: inc?.pass || cur?.pass || '',
    privateKey: inc?.privateKey || cur?.privateKey || '',
    passphrase: inc?.passphrase || cur?.passphrase || ''
  }
}

/** Se la patch in arrivo non porta i segreti (preset "ripulito"), mantiene quelli attualmente configurati. */
function keepExistingSecrets(incoming, current) {
  const s = { ...incoming }
  s.smtp = { ...incoming.smtp, pass: incoming.smtp?.pass || current.smtp?.pass || '' }
  s.ftp = {
    staging: keepFtpSecrets(incoming.ftp?.staging, current.ftp?.staging),
    prod: keepFtpSecrets(incoming.ftp?.prod, current.ftp?.prod)
  }
  return s
}

/** Elenco preset (senza i settings completi, per la UI) + preset attivo. */
export function listPresets() {
  const s = readStore()
  return {
    active: s.active,
    presets: s.presets.map((p) => ({ name: p.name, savedAt: p.savedAt }))
  }
}

/** Salva (o sovrascrive) un preset con lo snapshot dei settings correnti. */
export function saveCurrentAsPreset(name) {
  const trimmed = String(name || '').trim()
  if (!trimmed) throw new Error('Nome del preset mancante')
  const s = readStore()
  const preset = { name: trimmed, savedAt: new Date().toISOString(), settings: getSettings() }
  const idx = s.presets.findIndex((p) => p.name === trimmed)
  if (idx >= 0) s.presets[idx] = preset
  else s.presets.push(preset)
  s.active = trimmed
  writeStore(s)
  return listPresets()
}

/** Applica un preset: i suoi settings diventano quelli correnti. Ritorna i settings applicati. */
export function applyPreset(name) {
  const s = readStore()
  const preset = s.presets.find((p) => p.name === name)
  if (!preset) throw new Error(`Preset «${name}» non trovato`)
  const merged = keepExistingSecrets({ ...preset.settings }, getSettings())
  const applied = saveSettings(merged)
  s.active = name
  writeStore(s)
  return applied
}

export function deletePreset(name) {
  const s = readStore()
  const before = s.presets.length
  s.presets = s.presets.filter((p) => p.name !== name)
  if (s.active === name) s.active = ''
  writeStore(s)
  return { removed: s.presets.length < before, ...listPresets() }
}

/** Ritorna il preset completo (uso interno). */
export function getPreset(name) {
  const s = readStore()
  return s.presets.find((p) => p.name === name) || null
}

/** Ritorna il preset per l'export JSON, con le password SMTP/FTP azzerate. */
export function getPresetForExport(name) {
  const preset = getPreset(name)
  if (!preset) return null
  return { ...preset, settings: redactSecrets(preset.settings) }
}

/** Importa un preset da un oggetto JSON { name, settings } (o settings puri + nome). */
export function importPreset(json, fallbackName = '') {
  const obj = typeof json === 'string' ? JSON.parse(json) : json
  const name = String(obj?.name || fallbackName || '').trim()
  const settings = obj?.settings && typeof obj.settings === 'object' ? obj.settings : (obj?.fields ? obj : null)
  if (!name) throw new Error('Il JSON importato non contiene un nome di preset')
  if (!settings || typeof settings !== 'object') throw new Error('Il JSON importato non contiene una configurazione valida')
  const s = readStore()
  const preset = { name, savedAt: new Date().toISOString(), settings }
  const idx = s.presets.findIndex((p) => p.name === name)
  if (idx >= 0) s.presets[idx] = preset
  else s.presets.push(preset)
  writeStore(s)
  return listPresets()
}
