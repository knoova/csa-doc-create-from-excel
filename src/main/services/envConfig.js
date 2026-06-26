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
    acceptedDomains: (env.ACCEPTED_DOMAINS || '')
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean)
  }
  return cached
}
