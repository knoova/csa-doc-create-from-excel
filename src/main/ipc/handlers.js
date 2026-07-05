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
  renewRecords, getNumbering, setNumbering, advanceNumbering
} from '../services/recordsStore.js'
import { appendRowsToFile } from '../services/xlsxAppend.js'
import { testConnection, uploadFile } from '../services/ftpService.js'
import {
  listPresets, saveCurrentAsPreset, applyPreset, deletePreset, getPreset, importPreset
} from '../services/configPresets.js'
import { readFileSync, writeFileSync } from 'fs'

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
  // Con append=true i record vengono aggiunti in fondo a un XLS esistente.
  ipcMain.handle('records:export', async (_e, opts = {}) => {
    const { ids = null, archive = true, append = false } = opts
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
    let filePath
    if (append) {
      const res = await dialog.showOpenDialog(win, {
        title: 'Scegli l’XLS esistente a cui aggiungere i record',
        filters: [{ name: 'Excel', extensions: ['xlsx'] }],
        properties: ['openFile']
      })
      if (res.canceled || !res.filePaths[0]) return { ok: false, reason: 'canceled' }
      filePath = res.filePaths[0]
    } else {
      const res = await dialog.showSaveDialog(win, {
        title: 'Esporta tracciato XLS',
        defaultPath: `191025_${aaaammgg()}.xlsx`,
        filters: [{ name: 'Excel', extensions: ['xlsx'] }]
      })
      if (res.canceled || !res.filePath) return { ok: false, reason: 'canceled' }
      filePath = res.filePath
    }

    try {
      if (append) {
        const settings = getSettings()
        await appendRowsToFile(selected, filePath, settings.fields, settings.idd)
      } else {
        await writeRows(selected, filePath)
      }
      const batchId = `exp_${Date.now()}`
      if (archive) archiveRecords(selected.map((r) => r.id), batchId)
      logAction({
        user, action: append ? 'export-append' : 'export',
        record: { count: selected.length, batch: batchId },
        files: [filePath], result: 'ok'
      })
      return { ok: true, file: filePath, count: selected.length, archived: !!archive, appended: !!append }
    } catch (err) {
      const msg = String(err && err.message || err)
      logAction({ user, action: append ? 'export-append' : 'export', record: null, files: [], result: 'error', error: msg })
      return { ok: false, reason: 'export', error: msg }
    }
  })

  // Rinnovo: sposta le date di copertura di N anni e riporta i record a 'pending'.
  ipcMain.handle('records:renew', (_e, opts = {}) => {
    const { ids = [], years = 1 } = opts
    if (!Array.isArray(ids) || !ids.length) return { ok: false, reason: 'empty' }
    const session = getSession()
    const user = session?.email || 'sconosciuto'
    try {
      const renewed = renewRecords(ids, years)
      logAction({
        user, action: 'renew',
        record: { count: renewed.length, years, ids: renewed.map((r) => r.id) },
        files: [], result: 'ok'
      })
      return { ok: true, count: renewed.length, records: renewed }
    } catch (err) {
      const msg = String(err && err.message || err)
      logAction({ user, action: 'renew', record: null, files: [], result: 'error', error: msg })
      return { ok: false, reason: 'renew', error: msg }
    }
  })

  // ─── FTP (staging / prod) ────────────────────────────────────────────────--
  const ftpProfile = (env) => {
    const s = getSettings()
    return (s.ftp || {})[env === 'prod' ? 'prod' : 'staging']
  }

  ipcMain.handle('ftp:test', async (_e, env) => {
    try {
      const res = await testConnection(ftpProfile(env))
      return { ok: true, dir: res.dir }
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) }
    }
  })

  ipcMain.handle('ftp:upload', async (_e, { env, filePath }) => {
    const session = getSession()
    const user = session?.email || 'sconosciuto'
    try {
      const res = await uploadFile(ftpProfile(env), filePath)
      logAction({
        user, action: 'ftp-upload',
        record: { env, remote: res.remotePath },
        files: [filePath], result: 'ok'
      })
      return { ok: true, remotePath: res.remotePath }
    } catch (err) {
      const msg = String(err && err.message || err)
      logAction({ user, action: 'ftp-upload', record: { env }, files: [filePath], result: 'error', error: msg })
      return { ok: false, error: msg }
    }
  })

  // ─── Numerazione progressiva ───────────────────────────────────────────────
  ipcMain.handle('numbering:get', () => getNumbering())
  ipcMain.handle('numbering:set', (_e, next) => setNumbering(next))

  ipcMain.handle('shell:openPath', async (_e, p) => { try { await shell.openPath(p); return true } catch { return false } })

  // ─── Settings ────────────────────────────────────────────────────────────--
  // Ogni modifica ai settings viene notificata al renderer (settings:changed)
  // così le maschere aperte si aggiornano in tempo reale.
  const broadcastSettings = (settings) => {
    try { getMainWindow()?.webContents.send('settings:changed', settings) } catch (_) {}
    return settings
  }

  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_e, settings) => broadcastSettings(saveSettings(settings)))
  ipcMain.handle('settings:resetFields', () => broadcastSettings(resetFieldDefaults()))

  // ─── Preset di configurazione con nome ──────────────────────────────────--
  ipcMain.handle('presets:list', () => listPresets())

  ipcMain.handle('presets:save', (_e, name) => {
    try { return { ok: true, ...saveCurrentAsPreset(name) } }
    catch (err) { return { ok: false, error: String(err && err.message || err) } }
  })

  ipcMain.handle('presets:apply', (_e, name) => {
    try {
      const settings = applyPreset(name)
      broadcastSettings(settings)
      return { ok: true, settings, ...listPresets() }
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) }
    }
  })

  ipcMain.handle('presets:delete', (_e, name) => {
    try { return { ok: true, ...deletePreset(name) } }
    catch (err) { return { ok: false, error: String(err && err.message || err) } }
  })

  ipcMain.handle('presets:export', async (_e, name) => {
    const preset = getPreset(name)
    if (!preset) return { ok: false, error: 'Preset non trovato' }
    const win = getMainWindow()
    const res = await dialog.showSaveDialog(win, {
      title: 'Esporta configurazione JSON',
      defaultPath: `config_${sanitize(name)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (res.canceled || !res.filePath) return { ok: false, reason: 'canceled' }
    try {
      writeFileSync(res.filePath, JSON.stringify(preset, null, 2), 'utf-8')
      return { ok: true, file: res.filePath }
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) }
    }
  })

  ipcMain.handle('presets:import', async () => {
    const win = getMainWindow()
    const res = await dialog.showOpenDialog(win, {
      title: 'Importa configurazione JSON',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (res.canceled || !res.filePaths[0]) return { ok: false, reason: 'canceled' }
    try {
      const raw = readFileSync(res.filePaths[0], 'utf-8')
      const fallbackName = res.filePaths[0].replace(/^.*[/\\]/, '').replace(/\.json$/i, '')
      return { ok: true, ...importPreset(raw, fallbackName) }
    } catch (err) {
      return { ok: false, error: String(err && err.message || err) }
    }
  })

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
