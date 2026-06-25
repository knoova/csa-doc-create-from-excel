/**
 * Invio del magic link via SMTP (nodemailer). Configurazione da Settings/SMTP
 * (a sua volta inizializzata da .env.local).
 */
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
