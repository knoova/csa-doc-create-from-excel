import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

export default function Record({ visible }) {
  const { t } = useTranslation()
  const [records, setRecords] = useState([])
  const [filter, setFilter] = useState('pending')
  const [selected, setSelected] = useState({})
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)

  const load = useCallback(() => {
    window.electronAPI.listRecords()
      .then((res) => setRecords(res?.records || []))
      .catch(() => setRecords([]))
  }, [])

  useEffect(() => { if (visible) load() }, [visible, load])

  const pendingCount = useMemo(() => records.filter((r) => r.status === 'pending').length, [records])

  const filtered = useMemo(() => {
    if (filter === 'all') return records
    return records.filter((r) => r.status === filter)
  }, [records, filter])

  const selectedArchivedIds = useMemo(
    () => records.filter((r) => r.status === 'archived' && selected[r.id]).map((r) => r.id),
    [records, selected]
  )

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString('it-IT') } catch { return iso }
  }

  const toggleSel = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }))

  const exportPending = async () => {
    if (pendingCount === 0) { setBanner({ type: 'error', msg: t('record.emptyExport') }); return }
    setBusy(true); setBanner(null)
    try {
      const res = await window.electronAPI.exportRecords({ archive: true })
      if (res?.ok) {
        setBanner({ type: 'success', msg: t('record.exportedBody', { count: res.count }) })
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

  const reexport = async () => {
    if (selectedArchivedIds.length === 0) { setBanner({ type: 'error', msg: t('record.selectToReexport') }); return }
    setBusy(true); setBanner(null)
    try {
      const res = await window.electronAPI.exportRecords({ ids: selectedArchivedIds, archive: false })
      if (res?.ok) {
        setBanner({ type: 'success', msg: t('record.reexportedBody', { count: res.count }) })
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

  const statusBadge = (s) => s === 'archived'
    ? <span className="badge">{t('record.statusArchived')}</span>
    : <span className="badge badge-success">{t('record.statusPending')}</span>

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{t('record.title')}</h1>
        <p className="page-subtitle">{t('record.subtitle')}</p>
      </div>

      <div className="page-body">
        <div className="flex gap-2 items-center" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={load}>{t('record.refresh')}</button>
          <button className="btn btn-primary" onClick={exportPending} disabled={busy || pendingCount === 0}>
            {busy ? <span className="spinner spinner-sm" /> : null} {t('record.exportPending')} ({pendingCount})
          </button>
          <button className="btn btn-secondary" onClick={reexport} disabled={busy || selectedArchivedIds.length === 0}>
            {t('record.reexport')}
          </button>
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

        {banner && <div className={`alert alert-${banner.type}`} style={{ marginBottom: 12 }}>{banner.msg}</div>}

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
                  <th>{t('record.colMovimento')}</th>
                  <th>{t('record.colStatus')}</th>
                  <th>{t('record.colSaved')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const d = r.data || {}
                  return (
                    <tr key={r.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selected[r.id]}
                          disabled={r.status !== 'archived'}
                          onChange={() => toggleSel(r.id)}
                        />
                      </td>
                      <td className="mono-sm">{d.identificativo || '—'}</td>
                      <td>{[d.cognome, d.nome].filter(Boolean).join(' ') || '—'}</td>
                      <td className="mono-sm">{d.targa || '—'}</td>
                      <td>{d.tipo_movimento || '—'}</td>
                      <td>{statusBadge(r.status)}</td>
                      <td className="mono-sm">{fmt(r.savedAt)}</td>
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
