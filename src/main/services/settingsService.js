/**
 * Persistenza delle configurazioni in userData/settings.json, con merge sui
 * default. I default dei campi/questionario/prezzi vengono da tracciato.js;
 * SMTP e domini autorizzati sono inizializzati da .env.local al primo avvio.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { DEFAULT_FIELDS, DEFAULT_IDD, DEFAULT_PREZZI } from './tracciato.js'
import { getEnvConfig } from './envConfig.js'

function buildDefaults() {
  const env = getEnvConfig()
  return {
    theme: 'dark',
    language: 'it',
    accentColor: '',
    // Maschera
    fields: JSON.parse(JSON.stringify(DEFAULT_FIELDS)),
    idd: JSON.parse(JSON.stringify(DEFAULT_IDD)),
    prezzi: JSON.parse(JSON.stringify(DEFAULT_PREZZI)),
    // Date: scostamento per le date "reali" nel modulo (copertura dalle 24:00)
    dateOffsetDays: 1,
    // Accesso
    acceptedDomains: env.acceptedDomains,
    sessionHours: 24,
    smtp: { ...env.smtp },
    // Ultima cartella di output usata
    lastOutputDir: ''
  }
}

function getSettingsPath() {
  const userDataPath = app.getPath('userData')
  mkdirSync(userDataPath, { recursive: true })
  return join(userDataPath, 'settings.json')
}

export function getSettings() {
  const defaults = buildDefaults()
  try {
    const saved = JSON.parse(readFileSync(getSettingsPath(), 'utf-8'))
    const merged = { ...defaults, ...saved }
    // Se mancanti/azzerati, ripopola le strutture chiave
    if (!Array.isArray(merged.fields) || merged.fields.length === 0) merged.fields = defaults.fields
    if (!Array.isArray(merged.idd) || merged.idd.length === 0) merged.idd = defaults.idd
    if (!merged.prezzi || Object.keys(merged.prezzi).length === 0) merged.prezzi = defaults.prezzi
    merged.smtp = { ...defaults.smtp, ...(saved.smtp || {}) }
    if (!Array.isArray(merged.acceptedDomains) || merged.acceptedDomains.length === 0) {
      merged.acceptedDomains = defaults.acceptedDomains
    }
    return merged
  } catch {
    return defaults
  }
}

export function saveSettings(settings) {
  writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8')
  return settings
}

export function resetFieldDefaults() {
  const s = getSettings()
  const d = buildDefaults()
  s.fields = d.fields
  s.idd = d.idd
  s.prezzi = d.prezzi
  return saveSettings(s)
}
