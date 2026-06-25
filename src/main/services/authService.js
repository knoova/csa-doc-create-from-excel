/**
 * Autenticazione "magic link" per app desktop.
 *
 * - Token firmato HMAC-SHA256, monouso (nonce) e con scadenza.
 * - Sessione di N ore persistita in userData/session.json.
 * - Il dominio email viene validato contro la allowlist nel main process.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import crypto from 'crypto'
import { getSettings } from './settingsService.js'

function userFile(name) {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, name)
}

function getSecret() {
  const p = userFile('auth_secret')
  try {
    if (existsSync(p)) return readFileSync(p, 'utf-8').trim()
  } catch (_) {}
  const secret = crypto.randomBytes(32).toString('hex')
  try { writeFileSync(p, secret, { mode: 0o600 }) } catch (_) {}
  return secret
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return Buffer.from(s, 'base64').toString('utf-8')
}

function sign(data) {
  return b64url(crypto.createHmac('sha256', getSecret()).update(data).digest())
}

// ─── Nonce store (monouso) ───────────────────────────────────────────────────
function loadNonces() {
  try { return JSON.parse(readFileSync(userFile('pending_nonces.json'), 'utf-8')) } catch { return {} }
}
function saveNonces(obj) {
  try { writeFileSync(userFile('pending_nonces.json'), JSON.stringify(obj), { mode: 0o600 }) } catch (_) {}
}
function pruneNonces(obj) {
  const now = Date.now()
  let changed = false
  for (const [k, exp] of Object.entries(obj)) {
    if (typeof exp !== 'number' || exp < now) { delete obj[k]; changed = true }
  }
  if (changed) saveNonces(obj)
  return obj
}

export function domainAllowed(email) {
  const s = getSettings()
  const domains = (s.acceptedDomains || []).map(d => String(d).toLowerCase())
  const at = String(email || '').toLowerCase().split('@')
  if (at.length !== 2 || !at[1]) return false
  return domains.includes(at[1])
}

/** Crea un magic-link token per l'email (deve già aver passato domainAllowed). */
export function createToken(email, ttlMs = 15 * 60 * 1000) {
  const nonce = crypto.randomBytes(12).toString('hex')
  const payload = { email: String(email).toLowerCase(), iat: Date.now(), exp: Date.now() + ttlMs, nonce }
  const body = b64url(JSON.stringify(payload))
  const token = `${body}.${sign(body)}`
  const store = pruneNonces(loadNonces())
  store[nonce] = payload.exp
  saveNonces(store)
  return token
}

/** Verifica un token. Ritorna { email } o null. Consuma il nonce (monouso). */
export function verifyToken(token) {
  try {
    const [body, sig] = String(token).split('.')
    if (!body || !sig) return null
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body)))) return null
    const payload = JSON.parse(b64urlDecode(body))
    if (!payload.exp || payload.exp < Date.now()) return null
    const store = pruneNonces(loadNonces())
    if (!(payload.nonce in store)) return null
    delete store[payload.nonce]
    saveNonces(store)
    if (!domainAllowed(payload.email)) return null
    return { email: payload.email }
  } catch {
    return null
  }
}

// ─── Sessione ────────────────────────────────────────────────────────────────
export function createSession(email) {
  const hours = getSettings().sessionHours || 24
  const session = { email: String(email).toLowerCase(), exp: Date.now() + hours * 3600 * 1000 }
  try { writeFileSync(userFile('session.json'), JSON.stringify(session), { mode: 0o600 }) } catch (_) {}
  return session
}

export function getSession() {
  try {
    const s = JSON.parse(readFileSync(userFile('session.json'), 'utf-8'))
    if (s && s.exp && s.exp > Date.now() && s.email) return s
  } catch (_) {}
  return null
}

export function clearSession() {
  try { writeFileSync(userFile('session.json'), JSON.stringify({})) } catch (_) {}
}
