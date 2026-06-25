import { dialog, shell, app } from 'electron'
import { join } from 'path'
import { getSettings, saveSettings, resetFieldDefaults } from '../services/settingsService.js'
import { domainAllowed, createToken, getSession, clearSession } from '../services/authService.js'
import { sendMagicLink } from '../services/mailService.js'
import { loadFlusso } from '../services/flussoService.js'
import { fillModulo } from '../services/docxService.js'
import { writeOneRow } from '../services/xlsxFlussoWriter.js'
import { logAction, listAudit, exportAuditCsv } from '../services/auditLogger.js'
import { checkForUpdate } from '../services/updateService.js'
import { validateRecord } from '../services/recordMapper.js'

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

  ipcMain.handle('output:generate', async (_e, { record, outputDir, sourceHeaders }) => {
    const session = getSession()
    const user = session?.email || 'sconosciuto'
    const settings = getSettings()
    const recInfo = {
      identificativo: record?.identificativo || '',
      cf: record?.codice_fiscale || '',
      targa: record?.targa || '',
      movimento: record?.tipo_movimento || ''
    }

    const { valid, errors } = validateRecord(record || {}, settings.fields)
    if (!valid) return { ok: false, reason: 'validation', errors }
    if (!outputDir) return { ok: false, reason: 'nodir' }

    const base = sanitize(`${record.cognome || ''}_${record.targa || ''}`)
    const docxPath = join(outputDir, `Adesione_${base}.docx`)
    const xlsxPath = join(outputDir, `191025_${aaaammgg(record.data_rendicontazione)}_${base}.xlsx`)

    try {
      fillModulo(record, docxPath)
      await writeOneRow(record, xlsxPath, Array.isArray(sourceHeaders) && sourceHeaders.length ? sourceHeaders : undefined)
      logAction({ user, action: 'both', record: recInfo, files: [docxPath, xlsxPath], result: 'ok' })
      return { ok: true, files: { docx: docxPath, xlsx: xlsxPath }, dir: outputDir }
    } catch (err) {
      const msg = String(err && err.message || err)
      logAction({ user, action: 'both', record: recInfo, files: [], result: 'error', error: msg })
      return { ok: false, reason: 'generate', error: msg }
    }
  })

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
