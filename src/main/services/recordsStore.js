/**
 * Store locale dei record creati, persistito in userData/records.json (stesso
 * pattern di settingsService.js). Ogni record salvato resta in locale: dopo
 * l'esportazione viene ARCHIVIATO (status 'archived'), non eliminato.
 *
 * Forma del file:
 *   {
 *     seq: <number>,                 // contatore interno per gli id
 *     numbering: { next: '' },       // identificativo progressivo suggerito
 *     records: [
 *       { id, status: 'pending'|'archived', data, savedAt, savedBy,
 *         exportedAt, exportBatch }
 *     ]
 *   }
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { advanceIfAccepted } from './numbering.js'

function emptyStore() {
  return { seq: 0, numbering: { next: '' }, records: [] }
}

function storePath() {
  const dir = app.getPath('userData')
  mkdirSync(dir, { recursive: true })
  return join(dir, 'records.json')
}

function readStore() {
  try {
    const raw = JSON.parse(readFileSync(storePath(), 'utf-8'))
    const store = { ...emptyStore(), ...raw }
    store.numbering = { next: '', ...(raw.numbering || {}) }
    if (!Array.isArray(store.records)) store.records = []
    if (typeof store.seq !== 'number') store.seq = store.records.length
    return store
  } catch {
    return emptyStore()
  }
}

function writeStore(store) {
  writeFileSync(storePath(), JSON.stringify(store, null, 2), 'utf-8')
  return store
}

/** Ritorna { records, numbering }. */
export function listRecords() {
  const s = readStore()
  return { records: s.records, numbering: s.numbering }
}

/** Aggiunge un nuovo record (status 'pending'). Ritorna il record creato. */
export function addRecord(data, user) {
  const s = readStore()
  const id = `r${++s.seq}`
  const rec = {
    id,
    status: 'pending',
    data,
    savedAt: new Date().toISOString(),
    savedBy: user || 'sconosciuto',
    exportedAt: null,
    exportBatch: null
  }
  s.records.push(rec)
  writeStore(s)
  return rec
}

/** Aggiorna i dati di un record 'pending'. Ritorna il record o null. */
export function updateRecord(id, data) {
  const s = readStore()
  const rec = s.records.find((r) => r.id === id)
  if (!rec || rec.status !== 'pending') return null
  rec.data = data
  writeStore(s)
  return rec
}

/** Elimina un record 'pending'. Ritorna true se rimosso. */
export function deleteRecord(id) {
  const s = readStore()
  const before = s.records.length
  s.records = s.records.filter((r) => !(r.id === id && r.status === 'pending'))
  if (s.records.length === before) return false
  writeStore(s)
  return true
}

/** Archivia i record indicati, segnando lotto e data export. */
export function archiveRecords(ids, batchId) {
  const s = readStore()
  const set = new Set(ids)
  const now = new Date().toISOString()
  for (const r of s.records) {
    if (set.has(r.id) && r.status === 'pending') {
      r.status = 'archived'
      r.exportedAt = now
      r.exportBatch = batchId
    }
  }
  writeStore(s)
  return s.records
}

export function getNumbering() {
  return readStore().numbering
}

/** Imposta il numero iniziale/suggerito della serie (seme manuale). */
export function setNumbering(next) {
  const s = readStore()
  s.numbering = { next: String(next == null ? '' : next) }
  writeStore(s)
  return s.numbering
}

/**
 * Avanza la numerazione SOLO se il valore accettato coincide con quello
 * attualmente suggerito (proposta accettata). Se l'operatore ha cambiato il
 * numero (override), la numerazione resta invariata. Ritorna la numerazione.
 */
export function advanceNumbering(acceptedValue) {
  const s = readStore()
  const current = s.numbering?.next || ''
  const next = advanceIfAccepted(current, acceptedValue)
  if (next !== current) {
    s.numbering = { next }
    writeStore(s)
  }
  return s.numbering
}
