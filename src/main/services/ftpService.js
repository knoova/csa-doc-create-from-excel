/**
 * Upload su FTP/FTPS (basic-ftp) verso i profili configurati in settings.ftp
 * (staging e prod). Ogni profilo: { host, port, user, pass, secure, dir }.
 */
import { basename } from 'path'
import * as ftp from 'basic-ftp'

function assertProfile(profile) {
  if (!profile || !String(profile.host || '').trim()) {
    throw new Error('Profilo FTP non configurato: imposta host e credenziali nelle Configurazioni')
  }
}

async function withClient(profile, fn) {
  assertProfile(profile)
  const client = new ftp.Client(20000)
  try {
    await client.access({
      host: String(profile.host).trim(),
      port: Number(profile.port) || 21,
      user: profile.user || undefined,
      password: profile.pass || undefined,
      secure: !!profile.secure
    })
    return await fn(client)
  } finally {
    client.close()
  }
}

/** Verifica la connessione (login + accesso alla cartella remota). Ritorna { ok, dir }. */
export async function testConnection(profile) {
  return withClient(profile, async (client) => {
    const dir = String(profile.dir || '').trim()
    if (dir) await client.cd(dir)
    const pwd = await client.pwd()
    return { ok: true, dir: pwd }
  })
}

/** Carica un file locale nella cartella remota del profilo, con avanzamento opzionale. Ritorna { ok, remotePath }. */
export async function uploadFile(profile, localPath, onProgress) {
  return withClient(profile, async (client) => {
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
