import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import RecordForm from '../components/RecordForm.jsx'
import Banner from '../components/Banner.jsx'
import { validateRecord } from '../../../main/services/recordMapper.js'

const ERROR_LABELS = { maxlen: 'lunghezza max', date: 'GG/MM/AAAA', number: 'numero', email: 'email', select: 'valore' }

export default function Record({ visible }) {
  const { t } = useTranslation()
  const [records, setRecords] = useState([])
  const [settings, setSettings] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState({})
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)
  const [lastExport, setLastExport] = useState(null)
  const [ftpBusy, setFtpBusy] = useState('')
  const [ftpPct, setFtpPct] = useState(null)
  // Vista dettaglio: { id, editing, form } — null = elenco
  const [detail, setDetail] = useState(null)

  const load = useCallback(() => {
    window.electronAPI.listRecords()
      .then((res) => setRecords(res?.records || []))
      .catch(() => setRecords([]))
  }, [])

  const loadSettings = useCallback(() => {
    window.electronAPI.getSettings().then(setSettings).catch(() => {})
  }, [])

  useEffect(() => { if (visible) { load(); loadSettings() } }, [visible, load, loadSettings])

  // Aggiornamento in tempo reale quando le configurazioni cambiano.
  useEffect(() => {
    const onChanged = (e) => setSettings(e.detail || null)
    window.addEventListener('settings-changed', onChanged)
    return () => window.removeEventListener('settings-changed', onChanged)
  }, [])

  // Avanzamento dell'upload FTP in corso (percentuale sul file caricato).
  useEffect(() => {
    window.electronAPI?.onFtpProgress?.((info) => setFtpPct(info?.pct ?? null))
    return () => window.electronAPI?.removeFtpProgressListeners?.()
  }, [])

  const fields = settings?.fields || []
  const idd = settings?.idd || []
  const ftpEnvs = useMemo(() => {
    const out = []
    if (settings?.ftp?.staging?.host) out.push('staging')
    if (settings?.ftp?.prod?.host) out.push('prod')
    return out
  }, [settings])

  const pendingCount = useMemo(() => records.filter((r) => r.status === 'pending').length, [records])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return records.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (!q) return true
      const d = r.data || {}
      return [d.identificativo, d.cognome, d.nome, d.codice_fiscale, d.targa, d.marca, d.modello]
        .some((v) => String(v || '').toLowerCase().includes(q))
    })
  }, [records, filter, search])

  const selectedIds = useMemo(
    () => records.filter((r) => selected[r.id]).map((r) => r.id),
    [records, selected]
  )

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString('it-IT') } catch { return iso }
  }

  const toggleSel = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }))

  // Nota da appendere al banner sull'esito della mail di riepilogo.
  const notifyNote = (n) => {
    if (!n || n.sent === undefined) return ''
    if (n.sent) return ` ${t('record.mailSent', { to: n.to })}`
    if (n.reason === 'disabled') return ''
    return ` ${t('record.mailFailed')}`
  }

  const runExport = async (opts, okMsgKey) => {
    setBusy(true); setBanner(null)
    try {
      const res = await window.electronAPI.exportRecords(opts)
      if (res?.ok) {
        setBanner({ type: 'success', msg: t(okMsgKey, { count: res.count }) + notifyNote(res.notify) })
        setLastExport(res.file)
        setSelected({})
        load()
        window.electronAPI.openPath(res.file.replace(/[^/\\]+$/, ''))
      } else if (res?.reason && res.reason !== 'canceled') {
        setBanner({ type: 'error', msg: res.error || t('common.error') })
      }
    } catch (e) {
      setBanner({ type: 'error', msg: String(e?.message || e) })
    } finally {
      setBusy(false)
    }
  }

  const exportPending = () => {
    if (pendingCount === 0) { setBanner({ type: 'error', msg: t('record.emptyExport') }); return }
    runExport({ archive: true }, 'record.exportedBody')
  }

  const exportAppend = () => {
    if (pendingCount === 0) { setBanner({ type: 'error', msg: t('record.emptyExport') }); return }
    runExport({ archive: true, append: true }, 'record.appendedBody')
  }

  const reexport = () => {
    if (selectedIds.length === 0) { setBanner({ type: 'error', msg: t('record.selectToReexport') }); return }
    runExport({ ids: selectedIds, archive: false }, 'record.reexportedBody')
  }

  // Esporta un singolo record (da dettaglio o dalla colonna azioni). Funziona
  // anche sui record già archiviati (ri-esportazione, nessun cambio di stato);
  // se è ancora «da esportare» viene archiviato come nell'export normale.
  const exportOne = (r) => {
    if (!r) return
    runExport({ ids: [r.id], archive: r.status === 'pending' }, 'record.exportedOneBody')
  }

  const renew = async (ids) => {
    if (!ids.length) { setBanner({ type: 'error', msg: t('record.selectToRenew') }); return }
    if (!window.confirm(t('record.confirmRenew', { count: ids.length }))) return
    setBusy(true); setBanner(null)
    try {
      const res = await window.electronAPI.renewRecords(ids, 1)
      if (res?.ok) {
        setBanner({ type: 'success', msg: t('record.renewedBody', { count: res.count }) })
        setSelected({})
        load()
        if (detail) {
          const updated = (res.records || []).find((r) => r.id === detail.id)
          if (updated) setDetail((d) => ({ ...d, form: JSON.parse(JSON.stringify(updated.data)) }))
        }
      } else {
        setBanner({ type: 'error', msg: res?.error || t('common.error') })
      }
    } catch (e) {
      setBanner({ type: 'error', msg: String(e?.message || e) })
    } finally {
      setBusy(false)
    }
  }

  const ftpUpload = async (env) => {
    if (!lastExport) return
    setFtpBusy(env); setFtpPct(0); setBanner(null)
    try {
      const res = await window.electronAPI.ftpUpload(env, lastExport)
      if (res?.ok) setBanner({ type: 'success', msg: t('record.ftpUploaded', { env, path: res.remotePath }) + notifyNote(res.notify) })
      else setBanner({ type: 'error', msg: res?.error || t('common.error') })
    } catch (e) {
      setBanner({ type: 'error', msg: String(e?.message || e) })
    } finally {
      setFtpBusy(''); setFtpPct(null)
    }
  }

  // ─── Dettaglio ──────────────────────────────────────────────────────────--
  const openDetail = (r) => {
    setBanner(null)
    const form = JSON.parse(JSON.stringify(r.data || {}))
    if (!form.idd) form.idd = {}
    setDetail({ id: r.id, editing: false, form })
  }

  const detailRecord = useMemo(
    () => (detail ? records.find((r) => r.id === detail.id) : null),
    [detail, records]
  )

  const detailErrors = useMemo(() => {
    if (!detail?.editing || !fields.length) return {}
    const { errors } = validateRecord(detail.form, fields)
    const out = {}
    for (const [k, code] of Object.entries(errors)) out[k] = ERROR_LABELS[code] || code
    return out
  }, [detail, fields])

  const saveDetail = async () => {
    if (!detail || Object.keys(detailErrors).length) return
    setBusy(true); setBanner(null)
    try {
      const res = await window.electronAPI.updateRecord(detail.id, detail.form)
      if (res?.ok) {
        setBanner({ type: 'success', msg: t('record.updatedBody') })
        setDetail((d) => ({ ...d, editing: false }))
        load()
      } else {
        setBanner({ type: 'error', msg: res?.error || t('adesioni.validationErrors') })
      }
    } catch (e) {
      setBanner({ type: 'error', msg: String(e?.message || e) })
    } finally {
      setBusy(false)
    }
  }

  const cancelEdit = () => {
    if (!detailRecord) { setDetail(null); return }
    const form = JSON.parse(JSON.stringify(detailRecord.data || {}))
    if (!form.idd) form.idd = {}
    setDetail((d) => ({ ...d, editing: false, form }))
  }

  const deleteDetail = async () => {
    if (!detail || !window.confirm(t('record.confirmDelete'))) return
    const res = await window.electronAPI.deleteRecord(detail.id)
    if (res?.ok) {
      setBanner({ type: 'success', msg: t('record.deletedBody') })
      setDetail(null)
      load()
    } else {
      setBanner({ type: 'error', msg: t('common.error') })
    }
  }

  const statusBadge = (s) => s === 'archived'
    ? <span className="badge">{t('record.statusArchived')}</span>
    : <span className="badge badge-success">{t('record.statusPending')}</span>

  // ─── Render: dettaglio ───────────────────────────────────────────────────--
  if (detail) {
    return (
      <>
        <div className="page-header">
          <h1 className="page-title">{t('record.detailTitle')}</h1>
          <p className="page-subtitle">
            {detail.form?.identificativo || '—'} · {[detail.form?.cognome, detail.form?.nome].filter(Boolean).join(' ') || '—'}
          </p>
        </div>
        <div className="page-body">
          <div className="flex gap-2 items-center" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" onClick={() => setDetail(null)}>← {t('record.backToList')}</button>
            {detailRecord && statusBadge(detailRecord.status)}
            <div className="flex gap-2 items-center" style={{ marginLeft: 'auto' }}>
              {!detail.editing ? (
                <button className="btn btn-primary" onClick={() => setDetail((d) => ({ ...d, editing: true }))}>
                  {t('common.edit')}
                </button>
              ) : (
                <>
                  <button className="btn btn-ghost" onClick={cancelEdit}>{t('common.cancel')}</button>
                  <button className="btn btn-primary" onClick={saveDetail} disabled={busy || Object.keys(detailErrors).length > 0}>
                    {busy ? <span className="spinner spinner-sm" /> : null} {t('common.save')}
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={() => exportOne(detailRecord)} disabled={busy || !detailRecord}>
                {t('record.exportOne')}
              </button>
              <button className="btn btn-secondary" onClick={() => renew([detail.id])} disabled={busy}>
                {t('record.renewOne')}
              </button>
              {detailRecord?.status === 'pending' && (
                <button className="btn-danger" onClick={deleteDetail}>{t('common.delete')}</button>
              )}
            </div>
          </div>

          {banner && <Banner type={banner.type} style={{ marginBottom: 12 }}>{banner.msg}</Banner>}

          {detailRecord && (
            <div className="record-meta">
              <span>{t('record.colSaved')}: <strong>{fmt(detailRecord.savedAt)}</strong> · {detailRecord.savedBy}</span>
              {detailRecord.exportedAt && <span>{t('record.exportedAt')}: <strong>{fmt(detailRecord.exportedAt)}</strong></span>}
              {detailRecord.renewedAt && <span>{t('record.renewedAt')}: <strong>{fmt(detailRecord.renewedAt)}</strong></span>}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <RecordForm
              form={detail.form}
              fields={fields}
              idd={idd}
              errors={detailErrors}
              editable={detail.editing}
              onField={(id, value) => setDetail((d) => ({ ...d, form: { ...d.form, [id]: value } }))}
              onIdd={(domanda, value) => setDetail((d) => ({ ...d, form: { ...d.form, idd: { ...(d.form.idd || {}), [domanda]: value } } }))}
            />
          </div>
        </div>
      </>
    )
  }

  // ─── Render: elenco ─────────────────────────────────────────────────────--
  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{t('record.title')}</h1>
        <p className="page-subtitle">{t('record.subtitle')}</p>
      </div>

      <div className="page-body">
        <div className="flex gap-2 items-center" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={load}>{t('record.refresh')}</button>
          <button className="btn btn-primary" onClick={exportPending} disabled={busy || pendingCount === 0}>
            {busy ? <span className="spinner spinner-sm" /> : null} {t('record.exportPending')} ({pendingCount})
          </button>
          <button className="btn btn-secondary" onClick={exportAppend} disabled={busy || pendingCount === 0} title={t('record.exportAppendHint')}>
            {t('record.exportAppend')}
          </button>
          <button className="btn btn-secondary" onClick={reexport} disabled={busy || selectedIds.length === 0}>
            {t('record.reexport')} ({selectedIds.length})
          </button>
          <button className="btn btn-secondary" onClick={() => renew(selectedIds)} disabled={busy || selectedIds.length === 0}>
            {t('record.renewSelected')} ({selectedIds.length})
          </button>
        </div>

        <div className="flex gap-2 items-center" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ maxWidth: 340 }}
            placeholder={t('record.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="flex gap-2 items-center" style={{ marginLeft: 'auto' }}>
            {['pending', 'archived', 'all'].map((f) => (
              <button
                key={f}
                className={`btn btn-ghost${filter === f ? ' active' : ''}`}
                onClick={() => setFilter(f)}
              >
                {t(`record.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
              </button>
            ))}
          </div>
        </div>

        {banner && <Banner type={banner.type} style={{ marginBottom: 12 }}>{banner.msg}</Banner>}

        {lastExport && ftpEnvs.length > 0 && (
          <Banner type="info" style={{ marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
            <span>{t('record.ftpPrompt', { file: lastExport.replace(/^.*[/\\]/, '') })}</span>
            {ftpEnvs.map((env) => (
              <button key={env} className="btn btn-secondary" onClick={() => ftpUpload(env)} disabled={!!ftpBusy}>
                {ftpBusy === env ? <span className="spinner spinner-sm" /> : null}
                {' '}{t(`record.ftpUpload_${env}`)}
                {ftpBusy === env && ftpPct != null && ` (${ftpPct}%)`}
              </button>
            ))}
          </Banner>
        )}

        {filtered.length === 0 ? (
          <div className="empty-state"><p>{t('record.noRecords')}</p></div>
        ) : (
          <div className="log-table-wrap">
            <table className="log-table">
              <thead>
                <tr>
                  <th />
                  <th>{t('record.colId')}</th>
                  <th>{t('record.colName')}</th>
                  <th>{t('record.colTarga')}</th>
                  <th>{t('record.colScadenza')}</th>
                  <th>{t('record.colMovimento')}</th>
                  <th>{t('record.colStatus')}</th>
                  <th>{t('record.colSaved')}</th>
                  <th style={{ textAlign: 'right' }}>{t('record.colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const d = r.data || {}
                  return (
                    <tr key={r.id} className="row-clickable" onClick={() => openDetail(r)}>
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={!!selected[r.id]}
                          onChange={() => toggleSel(r.id)}
                          aria-label={t('record.selectRow', {
                            name: [d.identificativo, d.cognome, d.nome].filter(Boolean).join(' ') || r.id
                          })}
                        />
                      </td>
                      <td className="mono-sm">{d.identificativo || '—'}</td>
                      <td>{[d.cognome, d.nome].filter(Boolean).join(' ') || '—'}</td>
                      <td className="mono-sm">{d.targa || '—'}</td>
                      <td className="mono-sm">{d.data_fine || '—'}</td>
                      <td>{d.tipo_movimento || '—'}</td>
                      <td>{statusBadge(r.status)}</td>
                      <td className="mono-sm">{fmt(r.savedAt)}</td>
                      <td className="col-actions" onClick={(e) => e.stopPropagation()}>
                        <div className="table-actions">
                          <button className="btn btn-ghost btn-xs" onClick={() => exportOne(r)} disabled={busy}>
                            {t('record.exportOne')}
                          </button>
                          <button className="btn btn-ghost btn-xs" onClick={() => renew([r.id])} disabled={busy}>
                            {t('record.renewOne')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
