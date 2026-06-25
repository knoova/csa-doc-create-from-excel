/**
 * Registro attività append-only: OGNI salvataggio/esportazione viene tracciato.
 * Due livelli: electron-log (forense, ruota per dimensione) + audit.jsonl
 * (strutturato, mostrato nella pagina "Registro attività").
 */
import log from 'electron-log/main'
import { readFileSync, appendFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { app } from 'electron'

let initialized = false

export function initAudit() {
  if (initialized) return
  try {
    log.initialize()
    log.transports.file.maxSize = 5 * 1024 * 1024
    log.transports.file.level = 'info'
    initialized = true
  } catch (_) {}
}

function auditPath() {
  const dir = join(app.getPath('userData'), 'logs')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'audit.jsonl')
}

/**
 * Registra un'azione.
 * @param {{user:string, action:string, record?:object, files?:string[], result?:string, error?:string}} entry
 */
export function logAction(entry) {
  const rec = {
    ts: new Date().toISOString(),
    user: entry.user || 'sconosciuto',
    action: entry.action || '',
    record: entry.record || null,
    files: entry.files || [],
    result: entry.result || 'ok',
    error: entry.error || null
  }
  try { appendFileSync(auditPath(), JSON.stringify(rec) + '\n', 'utf-8') } catch (_) {}
  try { log.info('[audit]', JSON.stringify(rec)) } catch (_) {}
  return rec
}

export function listAudit(limit = 500) {
  try {
    const raw = readFileSync(auditPath(), 'utf-8')
    const lines = raw.split('\n').filter(Boolean)
    const parsed = []
    for (const l of lines) { try { parsed.push(JSON.parse(l)) } catch (_) {} }
    return parsed.reverse().slice(0, limit)
  } catch {
    return []
  }
}

export function exportAuditCsv(targetPath) {
  const rows = listAudit(100000).reverse()
  const esc = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`
  const head = ['ts', 'user', 'action', 'record', 'files', 'result', 'error']
  const lines = [head.join(',')]
  for (const r of rows) {
    lines.push([
      esc(r.ts), esc(r.user), esc(r.action),
      esc(r.record ? JSON.stringify(r.record) : ''),
      esc((r.files || []).join(' | ')),
      esc(r.result), esc(r.error)
    ].join(','))
  }
  writeFileSync(targetPath, '﻿' + lines.join('\n'), 'utf-8')
  return targetPath
}

export function getLogDir() {
  try { return dirname(log.transports.file.getFile().path) } catch { return null }
}
