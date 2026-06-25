import { useEffect, useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

function actionLabel(t, a) {
  if (a === 'both') return t('registro.actionBoth')
  if (a === 'docx') return t('registro.actionDocx')
  if (a === 'xlsx') return t('registro.actionXlsx')
  return a
}

export default function Registro({ visible }) {
  const { t } = useTranslation()
  const [entries, setEntries] = useState([])

  const load = useCallback(() => {
    window.electronAPI.listAudit().then(setEntries).catch(() => setEntries([]))
  }, [])

  useEffect(() => { if (visible) load() }, [visible, load])

  const exportLog = async () => {
    const p = await window.electronAPI.exportAudit()
    if (p) window.electronAPI.openPath(p.replace(/[^/\\]+$/, ''))
  }

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleString('it-IT') } catch { return iso }
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{t('registro.title')}</h1>
        <p className="page-subtitle">{t('registro.subtitle')}</p>
      </div>

      <div className="page-body">
        <div className="flex gap-2 items-center" style={{ marginBottom: 14 }}>
          <button className="btn btn-secondary" onClick={load}>{t('registro.refresh')}</button>
          <button className="btn btn-primary" onClick={exportLog} disabled={entries.length === 0}>{t('registro.export')}</button>
        </div>

        {entries.length === 0 ? (
          <div className="empty-state"><p>{t('registro.noEntries')}</p></div>
        ) : (
          <div className="log-table-wrap">
            <table className="log-table">
              <thead>
                <tr>
                  <th>{t('registro.colDate')}</th>
                  <th>{t('registro.colUser')}</th>
                  <th>{t('registro.colAction')}</th>
                  <th>{t('registro.colRecord')}</th>
                  <th>{t('registro.colFiles')}</th>
                  <th>{t('registro.colResult')}</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr key={i}>
                    <td className="mono-sm">{fmt(e.ts)}</td>
                    <td>{e.user}</td>
                    <td>{actionLabel(t, e.action)}</td>
                    <td className="mono-sm">
                      {e.record ? [e.record.identificativo, e.record.cf, e.record.targa, e.record.movimento].filter(Boolean).join(' · ') : '—'}
                    </td>
                    <td className="mono-sm">{(e.files || []).map(f => f.replace(/^.*[/\\]/, '')).join(', ') || '—'}</td>
                    <td>
                      {e.result === 'ok'
                        ? <span className="badge badge-success">{t('registro.resultOk')}</span>
                        : <span className="badge badge-error" title={e.error || ''}>{t('registro.resultError')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )
}
