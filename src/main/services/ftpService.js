/**
 * Pubblicazione dei file esportati verso i profili configurati in settings.ftp
 * (staging e prod). Ogni profilo supporta tre protocolli:
 *   - 'ftp'  → FTP semplice (basic-ftp)
 *   - 'ftps' → FTP su TLS (basic-ftp, secure)
 *   - 'sftp' → SFTP su SSH (ssh2-sftp-client), autenticazione a chiave o password
 *
 * Forma profilo: { protocol, host, port, user, pass, secure, dir,
 *                  privateKey, passphrase }.
 */
import { basename } from 'path'
import * as ftp from 'basic-ftp'
import SftpClient from 'ssh2-sftp-client'

function assertProfile(profile) {
  if (!profile || !String(profile.host || '').trim()) {
    throw new Error('Profilo di pubblicazione non configurato: imposta host e credenziali nelle Configurazioni')
  }
}

/** Protocollo effettivo del profilo (retrocompat: secure → ftps). */
function protocolOf(profile) {
  const p = String(profile?.protocol || '').trim().toLowerCase()
  if (['ftp', 'ftps', 'sftp'].includes(p)) return p
  return profile?.secure ? 'ftps' : 'ftp'
}

function portOf(profile, protocol) {
  return Number(profile?.port) || (protocol === 'sftp' ? 22 : 21)
}

// ─── FTP / FTPS (basic-ftp) ─────────────────────────────────────────────────
async function withFtpClient(profile, protocol, fn) {
  const client = new ftp.Client(20000)
  try {
    await client.access({
      host: String(profile.host).trim(),
      port: portOf(profile, protocol),
      user: profile.user || undefined,
      password: profile.pass || undefined,
      secure: protocol === 'ftps'
    })
    return await fn(client)
  } finally {
    client.close()
  }
}

async function ftpTest(profile, protocol) {
  return withFtpClient(profile, protocol, async (client) => {
    const dir = String(profile.dir || '').trim()
    if (dir) await client.cd(dir)
    const pwd = await client.pwd()
    return { ok: true, dir: pwd }
  })
}

async function ftpUpload(profile, protocol, localPath, onProgress) {
  return withFtpClient(profile, protocol, async (client) => {
    const dir = String(profile.dir || '').trim()
    if (dir) await client.ensureDir(dir)
    const name = basename(localPath)
    if (onProgress) client.trackProgress((info) => onProgress(info.bytes))
    try {
      await client.uploadFrom(localPath, name)
    } finally {
      if (onProgress) client.trackProgress()
    }
    const pwd = await client.pwd()
    return { ok: true, remotePath: `${pwd.replace(/\/$/, '')}/${name}` }
  })
}

// ─── SFTP (ssh2-sftp-client) ────────────────────────────────────────────────
// La chiave privata può essere in formato OpenSSH (PEM) o PuTTY (.ppk): ssh2
// riconosce entrambi. Se cifrata, serve la passphrase.
function sftpConnectOptions(profile, protocol) {
  const key = String(profile.privateKey || '').trim()
  return {
    host: String(profile.host).trim(),
    port: portOf(profile, protocol),
    username: profile.user || undefined,
    password: profile.pass || undefined,
    privateKey: key || undefined,
    passphrase: profile.passphrase || undefined,
    readyTimeout: 20000
  }
}

async function withSftpClient(profile, protocol, fn) {
  const sftp = new SftpClient()
  try {
    await sftp.connect(sftpConnectOptions(profile, protocol))
    return await fn(sftp)
  } finally {
    try { await sftp.end() } catch (_) {}
  }
}

async function sftpTest(profile, protocol) {
  return withSftpClient(profile, protocol, async (sftp) => {
    const dir = String(profile.dir || '').trim() || '.'
    // list() valida l'accesso alla cartella remota.
    await sftp.list(dir)
    return { ok: true, dir }
  })
}

async function sftpUpload(profile, protocol, localPath, onProgress) {
  return withSftpClient(profile, protocol, async (sftp) => {
    const dir = String(profile.dir || '').trim().replace(/\/$/, '')
    if (dir && !(await sftp.exists(dir))) await sftp.mkdir(dir, true)
    const name = basename(localPath)
    const remotePath = dir ? `${dir}/${name}` : name
    await sftp.fastPut(localPath, remotePath, {
      step: onProgress ? (transferred) => onProgress(transferred) : undefined
    })
    return { ok: true, remotePath }
  })
}

// ─── API pubblica (agnostica sul protocollo) ────────────────────────────────
/** Verifica la connessione (login + accesso alla cartella remota). Ritorna { ok, dir }. */
export async function testConnection(profile) {
  assertProfile(profile)
  const protocol = protocolOf(profile)
  return protocol === 'sftp' ? sftpTest(profile, protocol) : ftpTest(profile, protocol)
}

/** Carica un file locale nella cartella remota del profilo, con avanzamento opzionale. Ritorna { ok, remotePath }. */
export async function uploadFile(profile, localPath, onProgress) {
  assertProfile(profile)
  const protocol = protocolOf(profile)
  return protocol === 'sftp'
    ? sftpUpload(profile, protocol, localPath, onProgress)
    : ftpUpload(profile, protocol, localPath, onProgress)
}
