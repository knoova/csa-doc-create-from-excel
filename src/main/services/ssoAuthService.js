/**
 * Login con "account condiviso" (SSO) tramite il release-distributor come
 * identity provider, in stile OAuth per app desktop:
 *
 *  1. startSsoLogin() apre il browser di sistema sulla pagina di login del
 *     release-distributor, passando client_id, redirect_uri (csadoc://sso) e
 *     uno `state` casuale anti-CSRF.
 *  2. L'utente accede (password, oppure primo accesso via link + password).
 *  3. Il release-distributor reindirizza a csadoc://sso?code=...&state=...
 *  4. handleSsoCallback() valida lo `state`, scambia il `code` server-to-server
 *     su /identity/token e ottiene l'email verificata; la password non transita
 *     mai da questa app.
 *
 * Il magic-link locale (authService.js) resta invariato: questo è un percorso
 * aggiuntivo, non sostitutivo.
 */
import crypto from 'crypto'
import { shell } from 'electron'
import { getEnvConfig } from './envConfig.js'
import { domainAllowed, createSession } from './authService.js'

const CLIENT_ID = 'csa-doc-create-from-excel'
const REDIRECT_URI = 'csadoc://sso'
const STATE_TTL_MS = 10 * 60 * 1000

// `state` in sospeso (in memoria): valore → scadenza. Uno alla volta è
// sufficiente, ma teniamo una mappa per tollerare tentativi ravvicinati.
const pendingStates = new Map()

function prunePending() {
  const now = Date.now()
  for (const [state, exp] of pendingStates) {
    if (exp < now) pendingStates.delete(state)
  }
}

/** Avvia il login SSO aprendo il browser di sistema. Ritorna { ok } o { ok:false }. */
export async function startSsoLogin() {
  prunePending()
  const state = crypto.randomBytes(16).toString('hex')
  pendingStates.set(state, Date.now() + STATE_TTL_MS)

  const base = getEnvConfig().ssoBaseUrl
  const url =
    `${base}/identity/authorize` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&state=${encodeURIComponent(state)}`

  try {
    await shell.openExternal(url)
    return { ok: true }
  } catch (err) {
    pendingStates.delete(state)
    return { ok: false, error: String((err && err.message) || err) }
  }
}

/** True se l'URL è il callback SSO (csadoc://sso?...). */
export function isSsoCallback(url) {
  try {
    return new URL(url).host === 'sso'
  } catch {
    return false
  }
}

/**
 * Gestisce il redirect csadoc://sso?code=...&state=... : valida lo state,
 * scambia il code e crea la sessione. Ritorna la sessione o null.
 */
export async function handleSsoCallback(url) {
  let code, state
  try {
    const u = new URL(url)
    code = u.searchParams.get('code')
    state = u.searchParams.get('state')
  } catch {
    return null
  }
  if (!code || !state) return null

  // Valida e consuma lo state (anti-CSRF, monouso).
  prunePending()
  if (!pendingStates.has(state)) return null
  pendingStates.delete(state)

  const base = getEnvConfig().ssoBaseUrl
  const tokenUrl =
    `${base}/identity/token` +
    `?client_id=${encodeURIComponent(CLIENT_ID)}` +
    `&code=${encodeURIComponent(code)}`

  try {
    const res = await fetch(tokenUrl)
    if (!res.ok) return null
    const data = await res.json()
    const email = data && typeof data.email === 'string' ? data.email.toLowerCase() : null
    if (!email) return null
    // L'autorizzazione resta locale: l'IdP autentica, ma questa app decide se
    // il dominio è ammesso (stessa regola del magic-link).
    if (!domainAllowed(email)) return null
    return createSession(email)
  } catch {
    return null
  }
}
