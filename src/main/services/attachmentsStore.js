/**
 * Gestione degli allegati PDF da accodare al modulo. La LISTA ordinata degli
 * allegati vive nei settings (quindi è per-configurazione e viene salvata nei
 * preset); i file veri e propri sono copiati in userData/attachments/<id>.pdf.
 *
 * L'allegato predefinito (`builtin: true`) punta al PDF incluso nell'app
 * (templates/CSA…DIP.pdf) e resta sempre disponibile come default.
 */
import { app } from 'electron'
import { join, basename } from 'path'
import { mkdirSync, existsSync, copyFileSync, rmSync } from 'fs'

export const BUILTIN_ATTACHMENT_NAME = 'CSA Convenzione Assistenza Tutela - DIP.pdf'
export const BUILTIN_ATTACHMENT = { id: 'default-dip', name: BUILTIN_ATTACHMENT_NAME, builtin: true }

/** Lista di allegati di default per una nuova configurazione (solo il PDF incluso). */
export function defaultAttachments() {
  return [{ ...BUILTIN_ATTACHMENT }]
}

function firstExisting(paths) {
  for (const p of paths) {
    try { if (p && existsSync(p)) return p } catch (_) {}
  }
  return null
}

/** Percorso del PDF allegato incluso nell'app (il DIP predefinito). */
export function builtinAttachmentPath() {
  return firstExisting([
    join(process.resourcesPath || '', 'templates', BUILTIN_ATTACHMENT_NAME),
    join(app.getAppPath(), 'templates', BUILTIN_ATTACHMENT_NAME),
    join(app.getAppPath(), '..', 'templates', BUILTIN_ATTACHMENT_NAME),
    join(process.cwd(), 'templates', BUILTIN_ATTACHMENT_NAME)
  ])
}

/** Cartella (creata al volo) dove sono copiati gli allegati caricati dall'utente. */
export function attachmentsDir() {
  const dir = join(app.getPath('userData'), 'attachments')
  mkdirSync(dir, { recursive: true })
  return dir
}

/** Percorso su disco di una voce allegato, o null se il file non esiste (più). */
export function resolveAttachmentPath(entry) {
  if (!entry) return null
  if (entry.builtin) return builtinAttachmentPath()
  if (!entry.id) return null
  const p = join(attachmentsDir(), `${entry.id}.pdf`)
  return existsSync(p) ? p : null
}

/** Percorsi ordinati ed esistenti per la lista allegati (le voci mancanti sono saltate). */
export function resolveAttachmentPaths(list) {
  return (Array.isArray(list) ? list : [])
    .map(resolveAttachmentPath)
    .filter(Boolean)
}

/** Copia un PDF nella cartella allegati e ritorna la voce { id, name }. */
export function importAttachmentFile(srcPath) {
  const id = `att_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
  copyFileSync(srcPath, join(attachmentsDir(), `${id}.pdf`))
  return { id, name: basename(srcPath), builtin: false }
}

/** Elimina il file di un allegato caricato dall'utente (i builtin non si toccano). */
export function deleteAttachmentFile(id) {
  if (!id) return
  try {
    const p = join(attachmentsDir(), `${id}.pdf`)
    if (existsSync(p)) rmSync(p)
  } catch (_) {}
}
