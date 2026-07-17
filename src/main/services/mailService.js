/**
 * Invio del magic link via SMTP (nodemailer). Configurazione da Settings/SMTP
 * (a sua volta inizializzata da .env.local).
 */
import { basename } from 'path'
import nodemailer from 'nodemailer'
import { getSettings } from './settingsService.js'

function transporter() {
  const { smtp } = getSettings()
  if (!smtp || !smtp.host) throw new Error('SMTP non configurato')
  return nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port || 587,
    secure: !!smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined
  })
}

function fromHeader() {
  const { smtp } = getSettings()
  const from = smtp.from || smtp.user
  return /</.test(from) ? from : `"CSA Adesioni" <${smtp.user}>`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const isEmail = (v) => EMAIL_RE.test(String(v || '').trim())

/**
 * Calcola i destinatari del riepilogo in base alla configurazione
 * `exportNotify` e all'email dell'utente collegato (username).
 *   - mode 'user'   → solo utente
 *   - mode 'shared' → solo mailbox condivisa (fallback: utente)
 *   - mode 'both'   → utente + mailbox condivisa (in cc)
 * Ritorna { to, cc } oppure null se le notifiche sono disattivate/senza email.
 */
export function resolveNotifyRecipients(userEmail) {
  const { exportNotify = {} } = getSettings()
  if (exportNotify.enabled === false) return null
  const user = isEmail(userEmail) ? String(userEmail).trim() : ''
  const shared = isEmail(exportNotify.sharedEmail) ? String(exportNotify.sharedEmail).trim() : ''
  const mode = exportNotify.mode || 'user'

  if (mode === 'shared' && shared) return { to: shared, cc: user && user !== shared ? user : undefined }
  if (mode === 'both' && shared) return { to: user || shared, cc: user && shared !== user ? shared : undefined }
  // 'user' (o shared/both senza mailbox condivisa valida)
  return user ? { to: user } : (shared ? { to: shared } : null)
}

/**
 * Invia il riepilogo di un'esportazione o di un upload FTP, allegando il file
 * XLS creato/caricato. Best-effort: l'esito non deve bloccare l'operazione.
 * `kind`: 'export' | 'export-append' | 'ftp-upload'.
 */
export async function sendExportSummary({ to, cc, filePath, kind, count, env, remotePath, user }) {
  const name = filePath ? basename(filePath) : ''
  const when = new Date().toLocaleString('it-IT')
  const isFtp = kind === 'ftp-upload'
  const title = isFtp ? 'Caricamento FTP completato' : 'Esportazione completata'
  const subject = isFtp
    ? `CSA Adesioni — File caricato su FTP ${env || ''}`.trim()
    : 'CSA Adesioni — Riepilogo esportazione'

  const rows = [
    ['Operazione', isFtp ? `Upload FTP (${env || '—'})` : (kind === 'export-append' ? 'Esportazione (append)' : 'Esportazione')],
    typeof count === 'number' ? ['Record', String(count)] : null,
    ['File', name || '—'],
    isFtp && remotePath ? ['Percorso remoto', remotePath] : null,
    ['Eseguita da', user || '—'],
    ['Data e ora', when]
  ].filter(Boolean)

  const rowsHtml = rows
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6a6a8a">${k}</td><td style="padding:4px 0"><strong>${v}</strong></td></tr>`)
    .join('')
  const rowsText = rows.map(([k, v]) => `${k}: ${v}`).join('\n')

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:auto;color:#1a1b2e">
      <h2 style="color:#e91e8c;margin:0 0 8px">CSA Adesioni</h2>
      <p><strong>${title}.</strong> Trovi in allegato il foglio XLS.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:12px 0">${rowsHtml}</table>
      <p style="font-size:12px;color:#6a6a8a">Email automatica di riepilogo dell'operazione.</p>
    </div>`

  await transporter().sendMail({
    from: fromHeader(),
    to,
    cc: cc || undefined,
    subject,
    text: `${title}.\n\n${rowsText}\n\nIn allegato il foglio XLS.`,
    html,
    attachments: filePath ? [{ path: filePath, filename: name }] : []
  })
  return { to, cc: cc || null }
}

export async function sendMagicLink(email, link) {
  const { smtp } = getSettings()
  const from = smtp.from || smtp.user
  const fromHeader = /</.test(from) ? from : `"CSA Adesioni" <${smtp.user}>`

  const html = `
    <div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:480px;margin:auto;color:#1a1b2e">
      <h2 style="color:#e91e8c;margin:0 0 8px">CSA Adesioni</h2>
      <p>Hai richiesto l'accesso all'applicazione <strong>CSA Adesioni</strong>.</p>
      <p>Clicca sul pulsante qui sotto per accedere. Il link è valido 15 minuti e utilizzabile una sola volta.</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${link}" style="background:#e91e8c;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-weight:600;display:inline-block">Accedi all'applicazione</a>
      </p>
      <p style="font-size:12px;color:#6a6a8a">Se il pulsante non funziona, copia questo link nel browser:<br>${link}</p>
      <p style="font-size:12px;color:#6a6a8a">Se non hai richiesto l'accesso, ignora questa email.</p>
    </div>`

  await transporter().sendMail({
    from: fromHeader,
    to: email,
    subject: 'CSA Adesioni — Link di accesso',
    text: `Accedi a CSA Adesioni aprendo questo link (valido 15 minuti, monouso):\n\n${link}\n\nSe non hai richiesto l'accesso, ignora questa email.`,
    html
  })
}

export async function verifySmtp() {
  await transporter().verify()
  return true
}
