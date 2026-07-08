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
import { defaultAttachments } from './attachmentsStore.js'

// Versione dello schema settings: usata per le migrazioni dei file già salvati.
const SETTINGS_VERSION = 2

function emptyFtpProfile() {
  return { host: '', port: 21, user: '', pass: '', secure: false, dir: '' }
}

function buildDefaults() {
  const env = getEnvConfig()
  return {
    settingsVersion: SETTINGS_VERSION,
    theme: 'dark',
    language: 'it',
    accentColor: '',
    // Maschera
    fields: JSON.parse(JSON.stringify(DEFAULT_FIELDS)),
    idd: JSON.parse(JSON.stringify(DEFAULT_IDD)),
    prezzi: JSON.parse(JSON.stringify(DEFAULT_PREZZI)),
    // Allegati PDF accodati al modulo (ordinati). Default: solo il DIP incluso.
    attachments: defaultAttachments(),
    // Date: le date del modulo riportano la data del flusso così com'è.
    // Impostare 1 solo se si vuole stampare la decorrenza reale (24:00 → +1).
    dateOffsetDays: 0,
    // Accesso
    acceptedDomains: env.acceptedDomains,
    sessionHours: 24,
    smtp: { ...env.smtp },
    // FTP di pubblicazione (staging e produzione)
    ftp: { staging: emptyFtpProfile(), prod: emptyFtpProfile() },
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
    // Installazioni precedenti senza la chiave `attachments` ricevono il default
    // (il DIP incluso). Un array vuoto salvato di proposito resta vuoto.
    if (!Array.isArray(merged.attachments)) merged.attachments = defaults.attachments
    merged.smtp = { ...defaults.smtp, ...(saved.smtp || {}) }
    merged.ftp = {
      staging: { ...emptyFtpProfile(), ...((saved.ftp || {}).staging || {}) },
      prod: { ...emptyFtpProfile(), ...((saved.ftp || {}).prod || {}) }
    }
    if (!Array.isArray(merged.acceptedDomains) || merged.acceptedDomains.length === 0) {
      merged.acceptedDomains = defaults.acceptedDomains
    }
    // Migrazione v1 → v2: il vecchio default stampava nel modulo la data +1
    // (semantica "24:00"); ora le date vanno mostrate così come sono.
    if (!saved.settingsVersion || saved.settingsVersion < 2) {
      merged.dateOffsetDays = 0
      merged.settingsVersion = SETTINGS_VERSION
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

/**
 * Applica una patch superficiale ai settings correnti (rilette fresche da
 * disco) e salva. Usata dai controlli "rapidi" (tema/lingua nel Sidebar) per
 * evitare di sovrascrivere modifiche non salvate presenti altrove (es. la
 * maschera Configurazioni aperta con edit in corso).
 */
export function patchSettings(partial) {
  const current = getSettings()
  const next = { ...current, ...partial }
  return saveSettings(next)
}

export function resetFieldDefaults() {
  const s = getSettings()
  const d = buildDefaults()
  s.fields = d.fields
  s.idd = d.idd
  s.prezzi = d.prezzi
  return saveSettings(s)
}
