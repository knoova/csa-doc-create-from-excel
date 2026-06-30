import { dialog, shell, app } from 'electron'
import { join } from 'path'
import { getSettings, saveSettings, resetFieldDefaults } from '../services/settingsService.js'
import { domainAllowed, createToken, getSession, clearSession } from '../services/authService.js'
import { sendMagicLink } from '../services/mailService.js'
import { loadFlusso } from '../services/flussoService.js'
import { fillModulo } from '../services/docxService.js'
import { writeRows } from '../services/xlsxFlussoWriter.js'
import { logAction, listAudit, exportAuditCsv } from '../services/auditLogger.js'
import { checkForUpdate } from '../services/updateService.js'
import { validateRecord } from '../services/recordMapper.js'
import {
  listRecords, addRecord, updateRecord, deleteRecord, archiveRecords,
  getNumbering, setNumbering, advanceNumbering
} from '../services/recordsStore.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function sanitize(name) {
  return String(name || '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'aderente'
}

function aaaammgg(dateStr) {
  const m = String(dateStr || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}${m[2]}${m[1]}`
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function recInfoOf(record) {
  return {
    identificativo: record?.identificativo || '',
    cf: record?.codice_fiscale || '',
    targa: record?.targa || '',
    movimento: record?.tipo_movimento || ''
  }
}

export function registerHandlers(ipcMain, getMainWindow) {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  ipcMain.handle('auth:requestLink', async (_e, emailRaw) => {
    const email = String(emailRaw || '').trim().toLowerCase()
    if (!EMAIL_RE.test(email)) return { ok: false, reason: 'invalid' }
    if (!domainAllowed(email)) return { ok: false, reason: 'domain' }
    try {
      const token = createToken(email)
      const link = `csadoc://auth?token=${encodeURIComponent(token)}`
      await sendMagicLink(email, link)
      return { ok: true }
    } catch (err) {
      return { ok: false, reason: 'send', error: String(err && err.message || err) }
    }
  })

  ipcMain.handle('auth:getSession', () => getSession())
  ipcMain.handle('auth:logout', () => { clearSession(); return true })

  // ─── Flusso ──────────────────────────────────────────────────────────────--
  ipcMain.handle('flusso:openDialog', async () => {
    const win = getMainWindow()
    const res = await dialog.showOpenDialog(win, {
      title: 'Seleziona il flusso Excel',
      filters: [{ name: 'Excel', extensions: ['xlsx', 'xls'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return null
    return res.filePaths[0]
  })

  ipcMain.handle('flusso:load', async (_e, filePath) => {
    try {
      const data = await loadFlusso(filePath)
      return { ok: true, ...data }
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) }
    }
  })

  // ─── Output dir + generazione ──────────────────────────────────────────────
  ipcMain.handle('output:chooseDir', async () => {
    const win = getMainWindow()
    const res = await dialog.showOpenDialog(win, {
      title: 'Cartella di destinazione',
      properties: ['openDirectory', 'createDirectory']
    })
    if (res.canceled || !res.filePaths[0]) return null
    const dir = res.filePaths[0]
    try { const s = getSettings(); s.lastOutputDir = dir; saveSettings(s) } catch (_) {}
    return dir
  })

  // ─── Record: salvataggio locale + generazione modulo .docx ─────────────────--
  ipcMain.handle('records:save', async (_e, { record, outputDir }) => {
    const session = getSession()
    const user = session?.email || 'sconosciuto'
    const settings = getSettings()
    const recInfo = recInfoOf(record)

    const { valid, errors } = validateRecord(record || {}, settings.fields)
    if (!valid) return { ok: false, reason: 'validation', errors }
    if (!outputDir) return { ok: false, reason: 'nodir' }

    const base = sanitize(`${record.cognome || ''}_${record.targa || ''}`)
    const docxPath = join(outputDir, `Adesione_${base}.docx`)

    try {
      fillModulo(record, docxPath)
      const saved = addRecord(record, user)
      // Avanza la numerazione solo se l'identificativo coincide col suggerito.
      const numbering = advanceNumbering(record?.identificativo || '')
      logAction({ user, action: 'save', record: recInfo, files: [docxPath], result: 'ok' })
      return { ok: true, record: saved, files: { docx: docxPath }, dir: outputDir, numbering }
    } catch (err) {
      const msg = String(err && err.message || err)
      logAction({ user, action: 'save', record: recInfo, files: [], result: 'error', error: msg })
      return { ok: false, reason: 'generate', error: msg }
    }
  })

  ipcMain.handle('records:list', () => listRecords())

  ipcMain.handle('records:update', (_e, { id, record }) => {
    const settings = getSettings()
    const { valid, errors } = validateRecord(record || {}, settings.fields)
    if (!valid) return { ok: false, reason: 'validation', errors }
    const rec = updateRecord(id, record)
    return rec ? { ok: true, record: rec } : { ok: false, reason: 'notfound' }
  })

  ipcMain.handle('records:delete', (_e, id) => {
    return { ok: deleteRecord(id) }
  })

  // Esporta un unico XLS dei record indicati (default: tutti i 'pending'); poi
  // li archivia. Se archive=false, esporta senza cambiare stato (ri-esportazione).
  ipcMain.handle('records:export', async (_e, opts = {}) => {
    const { ids = null, archive = true } = opts
    const session = getSession()
    const user = session?.email || 'sconosciuto'
    const { records } = listRecords()

    let selected
    if (Array.isArray(ids) && ids.length) {
      const set = new Set(ids)
      selected = records.filter((r) => set.has(r.id))
    } else {
      selected = records.filter((r) => r.status === 'pending')
    }
    if (!selected.length) return { ok: false, reason: 'empty' }

    const win = getMainWindow()
    const res = await dialog.showSaveDialog(win, {
      title: 'Esporta tracciato XLS',
      defaultPath: `191025_${aaaammgg()}.xlsx`,
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, reason: 'canceled' }

    try {
      await writeRows(selected, res.filePath)
      const batchId = `exp_${Date.now()}`
      if (archive) archiveRecords(selected.map((r) => r.id), batchId)
      logAction({
        user, action: 'export',
        record: { count: selected.length, batch: batchId },
        files: [res.filePath], result: 'ok'
      })
      return { ok: true, file: res.filePath, count: selected.length, archived: !!archive }
    } catch (err) {
      const msg = String(err && err.message || err)
      logAction({ user, action: 'export', record: null, files: [], result: 'error', error: msg })
      return { ok: false, reason: 'export', error: msg }
    }
  })

  // ─── Numerazione progressiva ───────────────────────────────────────────────
  ipcMain.handle('numbering:get', () => getNumbering())
  ipcMain.handle('numbering:set', (_e, next) => setNumbering(next))

  ipcMain.handle('shell:openPath', async (_e, p) => { try { await shell.openPath(p); return true } catch { return false } })

  // ─── Settings ────────────────────────────────────────────────────────────--
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, settings) => saveSettings(settings))
  ipcMain.handle('settings:resetFields', () => resetFieldDefaults())

  // ─── Registro ──────────────────────────────────────────────────────────────
  ipcMain.handle('audit:list', () => listAudit())
  ipcMain.handle('audit:export', async () => {
    const win = getMainWindow()
    const res = await dialog.showSaveDialog(win, {
      title: 'Esporta registro attività',
      defaultPath: `registro_attivita_${Date.now()}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (res.canceled || !res.filePath) return null
    exportAuditCsv(res.filePath)
    return res.filePath
  })

  // ─── App ───────────────────────────────────────────────────────────────────
  ipcMain.handle('app:version', () => app.getVersion())
  ipcMain.handle('app:checkUpdate', () => checkForUpdate())

  // ─── Window controls ───────────────────────────────────────────────────────
  ipcMain.handle('window:minimize', () => { getMainWindow()?.minimize() })
  ipcMain.handle('window:maximize', () => {
    const w = getMainWindow()
    if (!w) return
    if (w.isMaximized()) w.unmaximize(); else w.maximize()
  })
  ipcMain.handle('window:close', () => { getMainWindow()?.close() })
  ipcMain.handle('window:isMaximized', () => !!getMainWindow()?.isMaximized())
}
