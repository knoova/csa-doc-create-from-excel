/**
 * Lettura di .env.local (SMTP + domini autorizzati). Serve in sviluppo: in
 * produzione i valori vengono dalle Configurazioni (vedi settingsService, che
 * usa questi come default al primo avvio). Nessuna dipendenza esterna.
 */
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

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

let cached = null

export function getEnvConfig() {
  if (cached) return cached
  let env = {}
  for (const p of candidatePaths()) {
    try {
      if (existsSync(p)) { env = parseEnv(readFileSync(p, 'utf-8')); break }
    } catch (_) {}
  }
  cached = {
    smtp: {
      host: env.SMTP_HOST || '',
      port: env.SMTP_PORT ? parseInt(env.SMTP_PORT, 10) : 587,
      secure: String(env.SMTP_SECURE || 'false').toLowerCase() === 'true',
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      from: env.SMTP_FROM || env.SMTP_USER || ''
    },
    acceptedDomains: (env.ACCEPTED_DOMAINS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  }
  return cached
}
