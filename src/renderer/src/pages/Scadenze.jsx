import { useEffect, useMemo, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { groupByExpiry } from '../../../main/services/scadenze.js'

const BUCKETS = [
  { key: 'past', tone: 'error' },
  { key: 'current', tone: 'warning' },
  { key: 'next', tone: 'info' }
]

export default function Scadenze({ visible }) {
  const { t } = useTranslation()
  const [records, setRecords] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState({})
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState(null)

  const load = useCallback(() => {
    window.electronAPI.listRecords()
      .then((res) => setRecords(res?.records || []))
      .catch(() => setRecords([]))
  }, [])

  useEffect(() => { if (visible) { load(); setBanner(null) } }, [visible, load])

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? records.filter((r) => {
          const d = r.data || {}
          return [d.identificativo, d.cognome, d.nome, d.codice_fiscale, d.targa]
            .some((v) => String(v || '').toLowerCase().includes(q))
        })
      : records
    return groupByExpiry(list, new Date())
  }, [records, search])

  const total = groups.past.length + groups.current.length + groups.next.length
  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected])

  const toggleSel = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }))
  const toggleAll = (bucket) => {
    const ids = groups[bucket].map((r) => r.id)
    const allOn = ids.every((id) => selected[id])
    setSelected((s) => {
      const next = { ...s }
      for (const id of ids) next[id] = !allOn
      return next
    })
  }

  const renew = async (ids) => {
    if (!ids.length) return
    if (!window.confirm(t('record.confirmRenew', { count: ids.length }))) return
    setBusy(true); setBanner(null)
    try {
      const res = await window.electronAPI.renewRecords(ids, 1)
      if (res?.ok) {
        setBanner({ type: 'success', msg: t('record.renewedBody', { count: res.count }) })
        setSelected({})
        load()
      } else {
        setBanner({ type: 'error', msg: res?.error || t('common.error') })
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
        <h1 className="page-title">{t('scadenze.title')}</h1>
        <p className="page-subtitle">{t('scadenze.subtitle')}</p>
      </div>

      <div className="page-body">
        <div className="flex gap-2 items-center" style={{ marginBottom: 14, flexWrap: 'wrap' }}>
          <button className="btn btn-secondary" onClick={load}>{t('record.refresh')}</button>
          <button className="btn btn-primary" onClick={() => renew(selectedIds)} disabled={busy || selectedIds.length === 0}>
            {busy ? <span className="spinner spinner-sm" /> : null} {t('record.renewSelected')} ({selectedIds.length})
          </button>
          <input
            className="form-input"
            style={{ maxWidth: 340, marginLeft: 'auto' }}
            placeholder={t('record.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {banner && <div className={`alert alert-${banner.type}`} style={{ marginBottom: 12 }}>{banner.msg}</div>}

        {total === 0 ? (
          <div className="empty-state"><p>{t('scadenze.empty')}</p></div>
        ) : (
          BUCKETS.map(({ key, tone }) => (
            <div className={`card card-section scadenze-group scadenze-${tone}`} key={key}>
              <div className="flex items-center justify-between" style={{ marginBottom: groups[key].length ? 10 : 0 }}>
                <div className="flex gap-2 items-center">
                  <span className={`badge badge-${tone}`}>{groups[key].length}</span>
                  <span className="section-title" style={{ margin: 0 }}>{t(`scadenze.${key}`)}</span>
                </div>
                {groups[key].length > 0 && (
                  <button className="btn btn-ghost" onClick={() => toggleAll(key)}>{t('scadenze.selectAll')}</button>
                )}
              </div>
              {groups[key].length === 0 ? (
                <p className="section-desc" style={{ margin: 0 }}>{t('scadenze.none')}</p>
              ) : (
                <div className="log-table-wrap">
                  <table className="log-table">
                    <thead>
                      <tr>
                        <th />
                        <th>{t('record.colId')}</th>
                        <th>{t('record.colName')}</th>
                        <th>{t('record.colTarga')}</th>
                        <th>{t('scadenze.colFine')}</th>
                        <th>{t('record.colStatus')}</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {groups[key].map((r) => {
                        const d = r.data || {}
                        return (
                          <tr key={r.id}>
                            <td>
                              <input type="checkbox" checked={!!selected[r.id]} onChange={() => toggleSel(r.id)} />
                            </td>
                            <td className="mono-sm">{d.identificativo || '—'}</td>
                            <td>{[d.cognome, d.nome].filter(Boolean).join(' ') || '—'}</td>
                            <td className="mono-sm">{d.targa || '—'}</td>
                            <td className="mono-sm"><strong>{d.data_fine || '—'}</strong></td>
                            <td>{statusBadge(r.status)}</td>
                            <td>
                              <button className="btn btn-ghost" onClick={() => renew([r.id])} disabled={busy}>
                                {t('record.renewOne')}
                              </button>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </>
  )
}
