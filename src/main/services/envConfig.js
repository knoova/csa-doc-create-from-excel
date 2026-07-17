/**
 * Configurazione SMTP + domini autorizzati.
 *
 * Due sorgenti, con precedenza:
 *   1. `.env.local` nella cartella del progetto → usato in SVILUPPO.
 *   2. valori "baked" a build-time (__APP_ENV__) → usati nella versione COMPILATA,
 *      dove .env.local non esiste. In CI arrivano dai GitHub Secrets (vedi
 *      electron.vite.config.mjs + .github/workflows/release.yml).
 *
 * In produzione restano comunque modificabili da Configurazioni → Accesso e SMTP.
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

/* global __APP_ENV__ */

function candidatePaths() {
  const list = []
  try { list.push(join(process.cwd(), '.env.local')) } catch (_) {}
  try { list.push(join(app.getAppPath(), '.env.local')) } catch (_) {}
  try { list.push(join(app.getAppPath(), '..', '.env.local')) } catch (_) {}
  try { list.push(join(dirname(app.getPath('exe')), '.env.local')) } catch (_) {}
  return [...new Set(list)]
}

function parseEnv(text) {
  const out = {}
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    const key = t.slice(0, eq).trim()
    let val = t.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

function readFileEnv() {
  for (const p of candidatePaths()) {
    try { if (existsSync(p)) return parseEnv(readFileSync(p, 'utf-8')) } catch (_) {}
  }
  return {}
}

function bakedEnv() {
  try { return (typeof __APP_ENV__ !== 'undefined' && __APP_ENV__) ? __APP_ENV__ : {} } catch (_) { return {} }
}

// Normalizza il materiale della chiave privata SSH proveniente da env. Poiché
// `.env.local` è parsato riga-per-riga (niente multilinea), la chiave in env va
// fornita in Base64; se invece arriva già in chiaro (PEM/PPK, es. da GitHub
// Secrets multilinea) la si usa così com'è, ripristinando eventuali "\n".
function decodeKeyMaterial(val) {
  const s = String(val || '')
  if (!s.trim()) return ''
  if (/-----BEGIN|PuTTY-User-Key-File/.test(s)) return s.replace(/\\n/g, '\n')
  try {
    const dec = Buffer.from(s, 'base64').toString('utf-8')
    return /-----BEGIN|PuTTY-User-Key-File/.test(dec) ? dec : s
  } catch (_) {
    return s
  }
}

// Protocollo del profilo: 'ftp' | 'ftps' | 'sftp'. Retrocompat: se non indicato
// si deduce da *_SECURE (true → ftps).
function protocolFromEnv(env, prefix) {
  const p = String(env[`${prefix}_PROTOCOL`] || '').trim().toLowerCase()
  if (['ftp', 'ftps', 'sftp'].includes(p)) return p
  return String(env[`${prefix}_SECURE`] || 'false').toLowerCase() === 'true' ? 'ftps' : 'ftp'
}

// Costruisce un profilo FTP/SFTP dai valori d'ambiente per il prefisso indicato
// (es. FTP_STAGING_* / FTP_PROD_*). Valori vuoti → profilo "vuoto" ma
// comunque sovrascrivibile da Configurazioni.
function ftpProfileFromEnv(env, prefix) {
  const protocol = protocolFromEnv(env, prefix)
  return {
    protocol,
    host: env[`${prefix}_HOST`] || '',
    port: env[`${prefix}_PORT`] ? parseInt(env[`${prefix}_PORT`], 10) : (protocol === 'sftp' ? 22 : 21),
    user: env[`${prefix}_USER`] || '',
    pass: env[`${prefix}_PASS`] || '',
    secure: protocol === 'ftps',
    dir: env[`${prefix}_DIR`] || '',
    // Autenticazione a chiave per SFTP (opzionale: si può usare anche user/pass).
    privateKey: decodeKeyMaterial(env[`${prefix}_KEY`]),
    passphrase: env[`${prefix}_PASSPHRASE`] || ''
  }
}

let cached = null

export function getEnvConfig() {
  if (cached) return cached
  // .env.local (dev) ha precedenza sui valori baked (produzione)
  const env = { ...bakedEnv(), ...readFileEnv() }
  cached = {
    smtp: {
      host: env.SMTP_HOST || '',
      port: env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587,
      secure: String(env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.SMTP_FROM || env.SMTP_USER || ''
    },
    // Profili FTP precaricati a build-time (staging/prod), sovrascrivibili in app.
    ftp: {
      staging: ftpProfileFromEnv(env, 'FTP_STAGING'),
      prod: ftpProfileFromEnv(env, 'FTP_PROD')
    },
    // Mailbox condivisa opzionale per i riepiloghi di esportazione (override).
    exportNotify: {
      sharedEmail: (env.EXPORT_NOTIFY_SHARED || '').trim(),
      mode: (env.EXPORT_NOTIFY_MODE || '').trim().toLowerCase()
    },
    acceptedDomains: (env.ACCEPTED_DOMAINS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean),
    // Base URL del release-distributor, che fa da identity provider (SSO)
    // per il login con account condiviso. In sviluppo punta al server locale.
    ssoBaseUrl: (env.SSO_BASE_URL || 'http://localhost:3000').replace(/\/$/, '')
  }
  return cached
}
