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
import { DEFAULT_TEMPLATE_ID } from './templatesStore.js'

// Versione dello schema settings: usata per le migrazioni dei file già salvati.
const SETTINGS_VERSION = 2

function emptyFtpProfile() {
  return {
    protocol: 'ftp', host: '', port: 21, user: '', pass: '', secure: false, dir: '',
    // Autenticazione a chiave per SFTP (usata solo con protocol 'sftp').
    privateKey: '', passphrase: ''
  }
}

// Profilo FTP di default: parte dal profilo vuoto e vi sovrappone i valori
// precaricati a build-time (env). Restano comunque modificabili in app.
function defaultFtpProfile(env, key) {
  return { ...emptyFtpProfile(), ...((env.ftp || {})[key] || {}) }
}

// Default delle notifiche di esportazione: il riepilogo va sempre all'utente
// collegato; una mailbox condivisa (env o Configurazioni) può fare da override.
function defaultExportNotify(env) {
  const en = env.exportNotify || {}
  const mode = ['user', 'shared', 'both'].includes(en.mode) ? en.mode : 'user'
  return { enabled: true, sharedEmail: en.sharedEmail || '', mode }
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
    // Template HTML del modulo scelto per questa configurazione (predefinito incluso).
    templateId: DEFAULT_TEMPLATE_ID,
    // Allegati PDF accodati al modulo (ordinati). Default: solo il DIP incluso.
    attachments: defaultAttachments(),
    // Date: le date del modulo riportano la data del flusso così com'è.
    // Impostare 1 solo se si vuole stampare la decorrenza reale (24:00 → +1).
    dateOffsetDays: 0,
    // Accesso
    acceptedDomains: env.acceptedDomains,
    sessionHours: 24,
    smtp: { ...env.smtp },
    // FTP di pubblicazione (staging e produzione), precaricati da env.
    ftp: { staging: defaultFtpProfile(env, 'staging'), prod: defaultFtpProfile(env, 'prod') },
    // Notifiche email di riepilogo su esportazione/upload FTP.
    exportNotify: defaultExportNotify(env),
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
    if (!merged.templateId) merged.templateId = defaults.templateId
    merged.smtp = { ...defaults.smtp, ...(saved.smtp || {}) }
    // I valori salvati sovrascrivono i default precaricati da env (override).
    merged.ftp = {
      staging: { ...defaults.ftp.staging, ...((saved.ftp || {}).staging || {}) },
      prod: { ...defaults.ftp.prod, ...((saved.ftp || {}).prod || {}) }
    }
    merged.exportNotify = { ...defaults.exportNotify, ...(saved.exportNotify || {}) }
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
