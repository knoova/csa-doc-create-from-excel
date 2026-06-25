import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

const FIELD_TYPES = ['text', 'number', 'date', 'email', 'phone', 'select', 'fixed']

function optionsToText(opts) {
  return (opts || []).map(o => `${o.value}=${o.label}`).join('\n')
}
function textToOptions(text) {
  return String(text).split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const i = l.indexOf('=')
    if (i < 0) return { value: l, label: l }
    return { value: l.slice(0, i).trim(), label: l.slice(i + 1).trim() }
  })
}

export default function Configurazioni({ onThemeChange, onLangChange, onAccentChange, currentTheme, currentLang }) {
  const { t } = useTranslation()
  const [s, setS] = useState(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => { window.electronAPI.getSettings().then(setS) }, [])
  if (!s) return <div className="page-body"><div className="spinner" /></div>

  const patch = (p) => { setS(prev => ({ ...prev, ...p })); setSaved(false) }
  const patchField = (idx, p) => {
    const fields = s.fields.slice()
    fields[idx] = { ...fields[idx], ...p }
    patch({ fields })
  }
  const deleteField = (idx) => patch({ fields: s.fields.filter((_, i) => i !== idx) })
  const addField = () => patch({
    fields: [...s.fields, {
      id: `campo_${Date.now()}`, label: 'Nuovo campo', group: 'altro', type: 'text',
      required: false, maxLength: null, flussoCol: '', trackCol: '', docx: null, enabled: true
    }]
  })

  const save = async () => {
    await window.electronAPI.saveSettings(s)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const resetFields = async () => {
    if (!window.confirm(t('config.confirmReset'))) return
    const next = await window.electronAPI.resetFieldDefaults()
    setS(next)
  }

  const setTheme = (theme) => { onThemeChange?.(theme); patch({ theme }) }
  const setLang = (language) => { onLangChange?.(language); patch({ language }) }
  const setAccent = (accentColor) => { onAccentChange?.(accentColor); patch({ accentColor }) }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{t('config.title')}</h1>
        <p className="page-subtitle">{t('config.subtitle')}</p>
      </div>

      <div className="page-body">
        {/* ─── Campi ─── */}
        <div className="card card-section">
          <div className="flex items-center justify-between">
            <div>
              <div className="section-title">{t('config.sectionFields')}</div>
              <div className="section-desc">{t('config.sectionFieldsDesc')}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-ghost" onClick={resetFields}>{t('config.resetDefaults')}</button>
              <button className="btn btn-secondary" onClick={addField}>{t('config.addField')}</button>
            </div>
          </div>

          <div className="field-list" style={{ marginTop: 12 }}>
            {s.fields.map((f, idx) => (
              <div className="field-item" key={f.id} style={{ gridTemplateColumns: '1fr' }}>
                <div className="field-inputs">
                  <div className="field-row">
                    <span className="field-label-sm">{t('config.fieldId')}</span>
                    <input className="field-input-sm" value={f.id} onChange={(e) => patchField(idx, { id: e.target.value })} />
                  </div>
                  <div className="field-row">
                    <span className="field-label-sm">{t('config.fieldLabel')}</span>
                    <input className="field-input-sm" value={f.label} onChange={(e) => patchField(idx, { label: e.target.value })} />
                  </div>
                  <div className="field-row">
                    <span className="field-label-sm">{t('config.fieldGroup')}</span>
                    <input className="field-input-sm" value={f.group || ''} onChange={(e) => patchField(idx, { group: e.target.value })} />
                  </div>
                  <div className="field-row">
                    <span className="field-label-sm">{t('config.fieldType')}</span>
                    <select className="field-input-sm" value={f.type} onChange={(e) => patchField(idx, { type: e.target.value })}>
                      {FIELD_TYPES.map(ty => <option key={ty} value={ty}>{t(`config.type${ty.charAt(0).toUpperCase() + ty.slice(1)}`, ty)}</option>)}
                    </select>
                  </div>
                  <div className="field-row">
                    <span className="field-label-sm">{t('config.fieldFlusso')}</span>
                    <input className="field-input-sm" value={f.flussoCol || ''} onChange={(e) => patchField(idx, { flussoCol: e.target.value })} />
                  </div>
                  <div className="field-row">
                    <span className="field-label-sm">{t('config.fieldTrack')}</span>
                    <input className="field-input-sm" value={f.trackCol || ''} onChange={(e) => patchField(idx, { trackCol: e.target.value })} />
                  </div>
                  <div className="field-row">
                    <span className="field-label-sm">{t('config.fieldDocx')}</span>
                    <input className="field-input-sm" value={f.docx || ''} onChange={(e) => patchField(idx, { docx: e.target.value || null })} />
                  </div>
                  <div className="field-row">
                    <span className="field-label-sm">{t('config.fieldMax')}</span>
                    <input className="field-input-sm" type="number" value={f.maxLength ?? ''} onChange={(e) => patchField(idx, { maxLength: e.target.value ? parseInt(e.target.value, 10) : null })} />
                  </div>
                  {f.type === 'fixed' && (
                    <div className="field-row">
                      <span className="field-label-sm">{t('config.fieldFixed')}</span>
                      <input className="field-input-sm" value={f.fixed || ''} onChange={(e) => patchField(idx, { fixed: e.target.value })} />
                    </div>
                  )}
                  {f.type === 'select' && (
                    <div className="field-row" style={{ alignItems: 'start' }}>
                      <span className="field-label-sm">{t('config.fieldOptions')}</span>
                      <textarea className="field-input-sm" rows={3} value={optionsToText(f.options)} onChange={(e) => patchField(idx, { options: textToOptions(e.target.value) })} />
                    </div>
                  )}
                  <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
                    <label className="toggle">
                      <input type="checkbox" checked={f.required || false} onChange={(e) => patchField(idx, { required: e.target.checked })} />
                      <span className="toggle-track"><span className="toggle-thumb" /></span>
                      <span className="toggle-label">{t('config.fieldRequired')}</span>
                    </label>
                    <div className="flex gap-2 items-center">
                      <label className="toggle">
                        <input type="checkbox" checked={f.enabled !== false} onChange={(e) => patchField(idx, { enabled: e.target.checked })} />
                        <span className="toggle-track"><span className="toggle-thumb" /></span>
                        <span className="toggle-label">{t('config.enableField')}</span>
                      </label>
                      <button className="btn-danger" onClick={() => deleteField(idx)}>{t('config.deleteField')}</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Prezzi ─── */}
        <div className="card card-section">
          <div className="section-title">{t('config.sectionPrezzi')}</div>
          <div className="section-desc">{t('config.sectionPrezziDesc')}</div>
          <div className="field-list">
            {Object.entries(s.prezzi).map(([code, row]) => (
              <div className="field-item" key={code} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                <div className="field-row"><span className="field-label-sm">{t('config.prezzoCodice')}</span><input className="field-input-sm" value={code} disabled /></div>
                <div className="field-row"><span className="field-label-sm">{t('config.prezzoPacchetto')}</span>
                  <input className="field-input-sm" value={row.pacchetto} onChange={(e) => patch({ prezzi: { ...s.prezzi, [code]: { ...row, pacchetto: e.target.value } } })} /></div>
                <div className="field-row"><span className="field-label-sm">{t('config.prezzoPremio')}</span>
                  <input className="field-input-sm" value={row.premio} onChange={(e) => patch({ prezzi: { ...s.prezzi, [code]: { ...row, premio: e.target.value } } })} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Date ─── */}
        <div className="card card-section">
          <div className="section-title">{t('config.sectionDate')}</div>
          <div className="section-desc">{t('config.sectionDateDesc')}</div>
          <div className="form-group" style={{ maxWidth: 220 }}>
            <label className="form-label">{t('config.dateOffset')}</label>
            <input className="form-input" type="number" value={s.dateOffsetDays ?? 1} onChange={(e) => patch({ dateOffsetDays: parseInt(e.target.value || '0', 10) })} />
          </div>
        </div>

        {/* ─── Accesso / SMTP ─── */}
        <div className="card card-section">
          <div className="section-title">{t('config.sectionAccess')}</div>
          <div className="section-desc">{t('config.sectionAccessDesc')}</div>
          <div className="maschera-grid">
            <div className="form-group span-2">
              <label className="form-label">{t('config.acceptedDomains')}</label>
              <textarea className="form-textarea" value={(s.acceptedDomains || []).join('\n')} onChange={(e) => patch({ acceptedDomains: e.target.value.split('\n').map(x => x.trim().toLowerCase()).filter(Boolean) })} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.sessionHours')}</label>
              <input className="form-input" type="number" value={s.sessionHours ?? 24} onChange={(e) => patch({ sessionHours: parseInt(e.target.value || '24', 10) })} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.smtpHost')}</label>
              <input className="form-input" value={s.smtp?.host || ''} onChange={(e) => patch({ smtp: { ...s.smtp, host: e.target.value } })} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.smtpPort')}</label>
              <input className="form-input" type="number" value={s.smtp?.port || 587} onChange={(e) => patch({ smtp: { ...s.smtp, port: parseInt(e.target.value || '587', 10) } })} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.smtpUser')}</label>
              <input className="form-input" value={s.smtp?.user || ''} onChange={(e) => patch({ smtp: { ...s.smtp, user: e.target.value } })} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.smtpPass')}</label>
              <input className="form-input" type="password" value={s.smtp?.pass || ''} onChange={(e) => patch({ smtp: { ...s.smtp, pass: e.target.value } })} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.smtpFrom')}</label>
              <input className="form-input" value={s.smtp?.from || ''} onChange={(e) => patch({ smtp: { ...s.smtp, from: e.target.value } })} />
            </div>
            <div className="form-group">
              <label className="toggle" style={{ marginTop: 24 }}>
                <input type="checkbox" checked={s.smtp?.secure || false} onChange={(e) => patch({ smtp: { ...s.smtp, secure: e.target.checked } })} />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                <span className="toggle-label">{t('config.smtpSecure')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* ─── Aspetto ─── */}
        <div className="card card-section">
          <div className="section-title">{t('config.sectionAppearance')}</div>
          <div className="maschera-grid">
            <div className="form-group">
              <label className="form-label">{t('config.theme')}</label>
              <div className="tabs" style={{ maxWidth: 240 }}>
                <button className={`tab-btn${(s.theme || currentTheme) === 'dark' ? ' active' : ''}`} onClick={() => setTheme('dark')}>{t('config.themeDark')}</button>
                <button className={`tab-btn${(s.theme || currentTheme) === 'light' ? ' active' : ''}`} onClick={() => setTheme('light')}>{t('config.themeLight')}</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.language')}</label>
              <div className="tabs" style={{ maxWidth: 240 }}>
                <button className={`tab-btn${(s.language || currentLang) === 'it' ? ' active' : ''}`} onClick={() => setLang('it')}>IT</button>
                <button className={`tab-btn${(s.language || currentLang) === 'en' ? ' active' : ''}`} onClick={() => setLang('en')}>EN</button>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.accentColor')}</label>
              <div className="flex gap-2 items-center">
                <input type="color" value={s.accentColor || '#e91e8c'} onChange={(e) => setAccent(e.target.value)} style={{ width: 44, height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }} />
                <button className="btn btn-ghost" onClick={() => setAccent('')}>{t('config.accentColorReset')}</button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 items-center" style={{ marginBottom: 24 }}>
          <button className="btn btn-primary" onClick={save}>{t('config.save')}</button>
          {saved && <span className="alert alert-success" style={{ padding: '6px 12px' }}>{t('config.saved')}</span>}
        </div>
      </div>
    </>
  )
}
