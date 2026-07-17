import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Banner from '../components/Banner.jsx'
import { isValidExpr } from '../../../main/services/expr.js'
import { classifyFieldDocx, unmappedPlaceholders } from '../../../main/services/templateScan.js'

const FIELD_TYPES = ['text', 'number', 'date', 'email', 'phone', 'select', 'fixed']

/** Valida la sintassi di una formula premio (le variabili sconosciute valgono 1 in fase di controllo). */
function prezzoFormulaOk(row) {
  const f = String(row?.formula || '').trim()
  if (!f) return true
  const vars = {}
  ;(f.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).forEach((id) => { vars[id] = 1 })
  return isValidExpr(f, vars)
}

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

const Chevron = ({ open }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s ease', flexShrink: 0 }}>
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

/** Pannello di una sotto-tab: sempre visibile (è l'unica tab attiva), niente accordion. */
function Panel({ title, desc, actions, children }) {
  return (
    <div className="card card-section">
      <div className="section-title" style={{ margin: 0 }}>{title}</div>
      {desc && <div className="section-desc" style={{ margin: '2px 0 16px' }}>{desc}</div>}
      {actions && <div className="flex gap-2" style={{ margin: desc ? 0 : '12px 0 16px', flexWrap: 'wrap' }}>{actions}</div>}
      <div style={{ marginTop: 12 }}>{children}</div>
    </div>
  )
}

const CONFIG_TABS = [
  { key: 'preset', labelKey: 'config.sectionPresets' },
  { key: 'template', labelKey: 'config.sectionTemplate' },
  { key: 'fields', labelKey: 'config.sectionFields' },
  { key: 'prezzi', labelKey: 'config.sectionPrezzi' },
  { key: 'allegati', labelKey: 'config.sectionAllegati' },
  { key: 'date', labelKey: 'config.sectionDate' },
  { key: 'ftp', labelKey: 'config.sectionFtp' },
  { key: 'access', labelKey: 'config.sectionAccess' },
  { key: 'appearance', labelKey: 'config.sectionAppearance' }
]

/** Riga campo compatta: riassunto sempre visibile, dettagli espandibili. */
function FieldItem({ f, t, onPatch, onDelete, placeholders }) {
  const [open, setOpen] = useState(false)
  const docxStatus = classifyFieldDocx(f.docx, placeholders)
  const hasInventory = Array.isArray(placeholders) && placeholders.length > 0
  return (
    <div className="field-item" style={{ gridTemplateColumns: '1fr' }}>
      <button type="button" className="collapse-header field-summary" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <Chevron open={open} />
        <strong>{f.label || f.id}</strong>
        <span className="mono-sm text-muted">{f.id}</span>
        <span className="badge badge-neutral">{t(`config.type${f.type.charAt(0).toUpperCase() + f.type.slice(1)}`, f.type)}</span>
        {f.required && <span className="badge badge-info">{t('config.fieldRequired')}</span>}
        {f.enabled === false && <span className="badge badge-error">{t('config.fieldDisabled')}</span>}
        {docxStatus === 'mismatch' && <span className="badge badge-error">{t('config.docxMismatch')}</span>}
      </button>
      {open && (
        <div className="field-inputs" style={{ marginTop: 8 }}>
          <div className="field-row">
            <span className="field-label-sm">{t('config.fieldId')}</span>
            <input className="field-input-sm" value={f.id} onChange={(e) => onPatch({ id: e.target.value })} />
          </div>
          <div className="field-row">
            <span className="field-label-sm">{t('config.fieldLabel')}</span>
            <input className="field-input-sm" value={f.label} onChange={(e) => onPatch({ label: e.target.value })} />
          </div>
          <div className="field-row">
            <span className="field-label-sm">{t('config.fieldGroup')}</span>
            <input className="field-input-sm" value={f.group || ''} onChange={(e) => onPatch({ group: e.target.value })} />
          </div>
          <div className="field-row">
            <span className="field-label-sm">{t('config.fieldType')}</span>
            <select className="field-input-sm" value={f.type} onChange={(e) => onPatch({ type: e.target.value })}>
              {FIELD_TYPES.map(ty => <option key={ty} value={ty}>{t(`config.type${ty.charAt(0).toUpperCase() + ty.slice(1)}`, ty)}</option>)}
            </select>
          </div>
          <div className="field-row">
            <span className="field-label-sm">{t('config.fieldFlusso')}</span>
            <input className="field-input-sm" value={f.flussoCol || ''} onChange={(e) => onPatch({ flussoCol: e.target.value })} />
          </div>
          <div className="field-row">
            <span className="field-label-sm">{t('config.fieldTrack')}</span>
            <input className="field-input-sm" value={f.trackCol || ''} onChange={(e) => onPatch({ trackCol: e.target.value })} />
          </div>
          <div className="field-row" style={{ alignItems: 'start' }}>
            <span className="field-label-sm">{t('config.fieldDocx')}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
              <input
                className="field-input-sm"
                list={hasInventory ? `ph_${f.id}` : undefined}
                value={f.docx || ''}
                onChange={(e) => onPatch({ docx: e.target.value || null })}
                style={docxStatus === 'mismatch' ? { borderColor: 'var(--c-error)' } : undefined}
              />
              {hasInventory && (
                <datalist id={`ph_${f.id}`}>
                  {placeholders.map((p) => <option key={p} value={p} />)}
                </datalist>
              )}
              {docxStatus === 'mismatch' && (
                <span className="mono-sm" style={{ color: 'var(--c-error)' }}>{t('config.docxMismatchHint')}</span>
              )}
            </div>
          </div>
          <div className="field-row">
            <span className="field-label-sm">{t('config.fieldMax')}</span>
            <input className="field-input-sm" type="number" value={f.maxLength ?? ''} onChange={(e) => onPatch({ maxLength: e.target.value ? parseInt(e.target.value, 10) : null })} />
          </div>
          {f.type === 'fixed' && (
            <div className="field-row">
              <span className="field-label-sm">{t('config.fieldFixed')}</span>
              <input className="field-input-sm" value={f.fixed || ''} onChange={(e) => onPatch({ fixed: e.target.value })} />
            </div>
          )}
          {f.type === 'select' && (
            <div className="field-row" style={{ alignItems: 'start' }}>
              <span className="field-label-sm">{t('config.fieldOptions')}</span>
              <textarea className="field-input-sm" rows={3} value={optionsToText(f.options)} onChange={(e) => onPatch({ options: textToOptions(e.target.value) })} />
            </div>
          )}
          <div className="flex items-center justify-between" style={{ marginTop: 4 }}>
            <label className="toggle">
              <input type="checkbox" checked={f.required || false} onChange={(e) => onPatch({ required: e.target.checked })} />
              <span className="toggle-track"><span className="toggle-thumb" /></span>
              <span className="toggle-label">{t('config.fieldRequired')}</span>
            </label>
            <div className="flex gap-2 items-center">
              <label className="toggle">
                <input type="checkbox" checked={f.enabled !== false} onChange={(e) => onPatch({ enabled: e.target.checked })} />
                <span className="toggle-track"><span className="toggle-thumb" /></span>
                <span className="toggle-label">{t('config.enableField')}</span>
              </label>
              <button className="btn-danger" onClick={onDelete}>{t('config.deleteField')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** Maschera di un profilo FTP (staging o prod) con test connessione. */
function FtpProfile({ env, profile, t, onPatch }) {
  const [testing, setTesting] = useState(false)
  const [result, setResult] = useState(null)

  const test = async () => {
    setTesting(true); setResult(null)
    try {
      const res = await window.electronAPI.ftpTest(env)
      setResult(res?.ok ? { type: 'success', msg: t('config.ftpTestOk', { dir: res.dir }) } : { type: 'error', msg: res?.error || t('common.error') })
    } catch (e) {
      setResult({ type: 'error', msg: String(e?.message || e) })
    } finally {
      setTesting(false)
    }
  }

  // Protocollo effettivo (retrocompat: secure → ftps).
  const protocol = ['ftp', 'ftps', 'sftp'].includes(profile?.protocol)
    ? profile.protocol
    : (profile?.secure ? 'ftps' : 'ftp')
  const isSftp = protocol === 'sftp'

  // Al cambio protocollo allinea `secure` e la porta di default se lasciata al
  // valore standard dell'altro protocollo.
  const changeProtocol = (next) => {
    const patch = { protocol: next, secure: next === 'ftps' }
    const curPort = Number(profile?.port)
    if (next === 'sftp' && (!curPort || curPort === 21)) patch.port = 22
    if (next !== 'sftp' && curPort === 22) patch.port = 21
    onPatch(patch)
  }

  return (
    <div className="ftp-profile">
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <span className="badge badge-info">{t(`config.ftpEnv_${env}`)}</span>
        <button className="btn btn-secondary" onClick={test} disabled={testing || !profile?.host}>
          {testing ? <span className="spinner spinner-sm" /> : null} {t('config.ftpTest')}
        </button>
      </div>
      {result && <Banner type={result.type} style={{ marginBottom: 8 }}>{result.msg}</Banner>}
      <div className="maschera-grid">
        <div className="form-group">
          <label className="form-label">{t('config.ftpProtocol')}</label>
          <select className="form-input" value={protocol} onChange={(e) => changeProtocol(e.target.value)}>
            <option value="ftp">{t('config.ftpProtocol_ftp')}</option>
            <option value="ftps">{t('config.ftpProtocol_ftps')}</option>
            <option value="sftp">{t('config.ftpProtocol_sftp')}</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('config.ftpPort')}</label>
          <input className="form-input" type="number" value={profile?.port ?? (isSftp ? 22 : 21)} onChange={(e) => onPatch({ port: parseInt(e.target.value || (isSftp ? '22' : '21'), 10) })} />
        </div>
        <div className="form-group span-2">
          <label className="form-label">{t('config.ftpHost')}</label>
          <input className="form-input" value={profile?.host || ''} onChange={(e) => onPatch({ host: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">{t('config.ftpUser')}</label>
          <input className="form-input" value={profile?.user || ''} onChange={(e) => onPatch({ user: e.target.value })} />
        </div>
        <div className="form-group">
          <label className="form-label">{isSftp ? t('config.ftpPassSftp') : t('config.ftpPass')}</label>
          <input className="form-input" type="password" value={profile?.pass || ''} onChange={(e) => onPatch({ pass: e.target.value })} />
        </div>
        <div className="form-group span-2">
          <label className="form-label">{t('config.ftpDir')}</label>
          <input className="form-input" value={profile?.dir || ''} placeholder="/public_html/export" onChange={(e) => onPatch({ dir: e.target.value })} />
        </div>
        {isSftp && (
          <>
            <div className="form-group span-2">
              <label className="form-label">{t('config.ftpPrivateKey')}</label>
              <textarea
                className="form-textarea"
                rows={4}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}
                placeholder={t('config.ftpPrivateKeyPlaceholder')}
                value={profile?.privateKey || ''}
                onChange={(e) => onPatch({ privateKey: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.ftpPassphrase')}</label>
              <input className="form-input" type="password" value={profile?.passphrase || ''} onChange={(e) => onPatch({ passphrase: e.target.value })} />
            </div>
            <div className="form-group span-2">
              <span className="section-desc" style={{ margin: 0 }}>{t('config.ftpKeyHint')}</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Configurazioni({ visible = true, onThemeChange, onLangChange, onAccentChange, currentTheme, currentLang }) {
  const { t } = useTranslation()
  const [s, setS] = useState(null)
  const [saved, setSaved] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [presets, setPresets] = useState({ active: '', presets: [] })
  const [presetName, setPresetName] = useState('')
  const [banner, setBanner] = useState(null)
  const [tab, setTab] = useState('preset')
  const [templates, setTemplates] = useState([])
  const dirtyRef = useRef(false)
  dirtyRef.current = dirty

  const loadPresets = () => {
    window.electronAPI.listPresets?.().then((p) => { if (p) setPresets(p) }).catch(() => {})
  }
  const loadTemplates = () => {
    window.electronAPI.listTemplates?.().then((r) => { if (r?.templates) setTemplates(r.templates) }).catch(() => {})
  }

  useEffect(() => { window.electronAPI.getSettings().then(setS); loadPresets(); loadTemplates() }, [])

  // Al ritorno sulla pagina (e quando i settings cambiano altrove) si ricarica,
  // ma senza sovrascrivere modifiche non ancora salvate.
  useEffect(() => {
    if (visible && !dirtyRef.current) {
      window.electronAPI.getSettings().then(setS).catch(() => {})
      loadPresets()
      loadTemplates()
    }
  }, [visible])

  // Se ci sono modifiche non salvate, un cambio esterno di tema/lingua/accento
  // (es. dal Sidebar) va comunque recepito subito: altrimenti il successivo
  // "Salva" riscriverebbe l'intero oggetto stale e lo cancellerebbe in
  // silenzio. Gli altri campi (campi/prezzi/ftp/...) restano quelli in
  // modifica finché l'utente non salva o annulla.
  useEffect(() => {
    const onChanged = (e) => {
      if (!e.detail) return
      if (!dirtyRef.current) { setS(e.detail); return }
      const { theme, language, accentColor } = e.detail
      setS((prev) => ({ ...prev, theme, language, accentColor }))
    }
    window.addEventListener('settings-changed', onChanged)
    return () => window.removeEventListener('settings-changed', onChanged)
  }, [])

  if (!s) return <div className="page-body"><div className="spinner" /></div>

  const patch = (p) => { setS(prev => ({ ...prev, ...p })); setSaved(false); setDirty(true) }
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
  const patchFtp = (env, p) => patch({ ftp: { ...s.ftp, [env]: { ...(s.ftp?.[env] || {}), ...p } } })

  // ─── Prezzi (tabella premi / pacchetti) ────────────────────────────────────
  // `prezzi` è un oggetto { codice: { pacchetto, premio } }. Per consentire di
  // rinominare il codice (che è la chiave) e mantenere l'ordine delle righe,
  // lavoriamo su una lista di coppie [codice, riga] indicizzata per posizione.
  const setPrezziEntries = (entries) => patch({ prezzi: Object.fromEntries(entries) })
  const patchPrezzoRow = (idx, p) => {
    const entries = Object.entries(s.prezzi)
    entries[idx] = [entries[idx][0], { ...entries[idx][1], ...p }]
    setPrezziEntries(entries)
  }
  const patchPrezzoCode = (idx, code) => {
    const entries = Object.entries(s.prezzi)
    entries[idx] = [code, entries[idx][1]]
    setPrezziEntries(entries)
  }
  const deletePrezzo = (idx) => setPrezziEntries(Object.entries(s.prezzi).filter((_, i) => i !== idx))
  const addPrezzo = () => {
    const entries = Object.entries(s.prezzi)
    const existing = new Set(entries.map(([c]) => c))
    let n = entries.length + 1
    let code = String(n).padStart(5, '0')
    while (existing.has(code)) { n += 1; code = String(n).padStart(5, '0') }
    entries.push([code, { pacchetto: '', premio: '' }])
    setPrezziEntries(entries)
  }

  // ─── Allegati (PDF accodati al modulo, ordinati) ───────────────────────────--
  const attachments = Array.isArray(s.attachments) ? s.attachments : []
  const addAttachment = async () => {
    const res = await window.electronAPI.addAttachment()
    if (res?.ok && res.entry) patch({ attachments: [...attachments, res.entry] })
    else if (res && res.reason !== 'canceled') setBanner({ type: 'error', msg: res.error || t('common.error') })
  }
  const removeAttachment = (idx) => {
    const entry = attachments[idx]
    if (entry && !entry.builtin && entry.id) window.electronAPI.deleteAttachmentFile?.(entry.id)
    patch({ attachments: attachments.filter((_, i) => i !== idx) })
  }
  const moveAttachment = (idx, dir) => {
    const j = idx + dir
    if (j < 0 || j >= attachments.length) return
    const next = attachments.slice()
    ;[next[idx], next[j]] = [next[j], next[idx]]
    patch({ attachments: next })
  }

  // ─── Template del modulo ───────────────────────────────────────────────────--
  const activeTemplate = templates.find((tp) => tp.id === (s.templateId || 'default')) || null
  const placeholders = activeTemplate?.placeholders || []
  const selectTemplate = (id) => patch({ templateId: id })
  const importTemplate = async () => {
    setBanner(null)
    const res = await window.electronAPI.importTemplate()
    if (res?.ok) {
      if (res.templates) setTemplates(res.templates)
      if (res.entry?.id) patch({ templateId: res.entry.id })
      setBanner({ type: 'success', msg: t('config.templateImported', { name: res.entry?.name || '' }) })
    } else if (res && res.reason !== 'canceled') {
      setBanner({ type: 'error', msg: res.error || t('common.error') })
    }
  }
  const removeTemplate = async (id) => {
    if (!window.confirm(t('config.templateConfirmDelete'))) return
    const res = await window.electronAPI.deleteTemplate(id)
    if (res?.ok) {
      if (res.templates) setTemplates(res.templates)
      if ((s.templateId || 'default') === id) patch({ templateId: 'default' })
    } else if (res?.error) {
      setBanner({ type: 'error', msg: res.error })
    }
  }

  const save = async () => {
    await window.electronAPI.saveSettings(s)
    setSaved(true)
    setDirty(false)
    setTimeout(() => setSaved(false), 2500)
  }

  const resetFields = async () => {
    if (!window.confirm(t('config.confirmReset'))) return
    const next = await window.electronAPI.resetFieldDefaults()
    setS(next)
    setDirty(false)
  }

  const setTheme = (theme) => { onThemeChange?.(theme); patch({ theme }) }
  const setLang = (language) => { onLangChange?.(language); patch({ language }) }
  const setAccent = (accentColor) => { onAccentChange?.(accentColor); patch({ accentColor }) }

  // ─── Preset ───────────────────────────────────────────────────────────────
  const savePreset = async () => {
    const name = presetName.trim()
    if (!name) return
    setBanner(null)
    if (dirty) await save() // lo snapshot deve includere le modifiche correnti
    const res = await window.electronAPI.savePreset(name)
    if (res?.ok) {
      setPresets(res)
      setPresetName('')
      setBanner({ type: 'success', msg: t('config.presetSaved', { name }) })
    } else {
      setBanner({ type: 'error', msg: res?.error || t('common.error') })
    }
  }

  const applyPreset = async (name) => {
    if (dirty && !window.confirm(t('config.presetApplyDirty'))) return
    setBanner(null)
    const res = await window.electronAPI.applyPreset(name)
    if (res?.ok) {
      setS(res.settings)
      setDirty(false)
      setPresets({ active: res.active, presets: res.presets })
      if (res.settings?.theme) onThemeChange?.(res.settings.theme)
      if (res.settings?.language) onLangChange?.(res.settings.language)
      onAccentChange?.(res.settings?.accentColor || '')
      setBanner({ type: 'success', msg: t('config.presetApplied', { name }) })
    } else {
      setBanner({ type: 'error', msg: res?.error || t('common.error') })
    }
  }

  const deletePreset = async (name) => {
    if (!window.confirm(t('config.presetConfirmDelete', { name }))) return
    const res = await window.electronAPI.deletePreset(name)
    if (res?.ok) setPresets({ active: res.active, presets: res.presets })
  }

  const exportPreset = async (name) => {
    setBanner(null)
    const res = await window.electronAPI.exportPreset(name)
    if (res?.ok) setBanner({ type: 'success', msg: t('config.presetExported', { file: res.file }) })
    else if (res?.reason !== 'canceled') setBanner({ type: 'error', msg: res?.error || t('common.error') })
  }

  const importPreset = async () => {
    setBanner(null)
    const res = await window.electronAPI.importPreset()
    if (res?.ok) {
      setPresets({ active: res.active, presets: res.presets })
      setBanner({ type: 'success', msg: t('config.presetImported') })
    } else if (res?.reason !== 'canceled') {
      setBanner({ type: 'error', msg: res?.error || t('common.error') })
    }
  }

  const fmtDate = (iso) => { try { return new Date(iso).toLocaleString('it-IT') } catch { return iso } }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{t('config.title')}</h1>
        <p className="page-subtitle">{t('config.subtitle')}</p>
      </div>

      <div className="page-body">
        {banner && <Banner type={banner.type} style={{ marginBottom: 12 }}>{banner.msg}</Banner>}

        <div className="config-tabs" role="tablist" aria-label={t('config.title')}>
          {CONFIG_TABS.map((tb) => (
            <button
              key={tb.key}
              type="button"
              role="tab"
              aria-selected={tab === tb.key}
              className={`config-tab-btn${tab === tb.key ? ' active' : ''}`}
              onClick={() => setTab(tb.key)}
            >
              {t(tb.labelKey)}
            </button>
          ))}
        </div>

        {/* ─── Preset con nome ─── */}
        {tab === 'preset' && (
        <Panel title={t('config.sectionPresets')} desc={t('config.sectionPresetsDesc')}>
          {presets.presets.length === 0 ? (
            <p className="section-desc" style={{ marginTop: 0 }}>{t('config.presetNone')}</p>
          ) : (
            <div className="preset-list">
              {presets.presets.map((p) => (
                <div className="preset-row" key={p.name}>
                  <div className="preset-name">
                    <strong>{p.name}</strong>
                    {presets.active === p.name && <span className="badge badge-success">{t('config.presetActive')}</span>}
                    <span className="mono-sm text-muted">{fmtDate(p.savedAt)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" onClick={() => applyPreset(p.name)} disabled={presets.active === p.name && !dirty}>
                      {t('config.presetApply')}
                    </button>
                    <button className="btn btn-secondary" onClick={() => exportPreset(p.name)}>{t('config.presetExport')}</button>
                    <button className="btn-danger" onClick={() => deletePreset(p.name)}>{t('common.delete')}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 items-center" style={{ marginTop: 12, flexWrap: 'wrap' }}>
            <input
              className="form-input"
              style={{ maxWidth: 280 }}
              placeholder={t('config.presetNamePlaceholder')}
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
            />
            <button className="btn btn-primary" onClick={savePreset} disabled={!presetName.trim()}>{t('config.presetSave')}</button>
            <button className="btn btn-ghost" onClick={importPreset}>{t('config.presetImport')}</button>
          </div>
          <p className="section-desc" style={{ marginTop: 10, marginBottom: 0 }}>{t('config.presetImportHint')}</p>
        </Panel>
        )}

        {/* ─── Template del modulo ─── */}
        {tab === 'template' && (
        <Panel
          title={t('config.sectionTemplate')}
          desc={t('config.sectionTemplateDesc')}
          actions={<button className="btn btn-secondary" onClick={importTemplate}>{t('config.templateImport')}</button>}
        >
          <div className="field-list">
            {templates.map((tp) => {
              const active = (s.templateId || 'default') === tp.id
              return (
                <div className="field-item" key={tp.id} style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                  <input type="radio" name="tplsel" checked={active} onChange={() => selectTemplate(tp.id)} style={{ marginTop: 4 }} />
                  <div className="flex items-center gap-2" style={{ minWidth: 0, flexWrap: 'wrap' }}>
                    <strong>{tp.name}</strong>
                    {tp.builtin && <span className="badge badge-info">{t('config.allegatoBuiltin')}</span>}
                    {active && <span className="badge badge-success">{t('config.templateActive')}</span>}
                    <span className="mono-sm text-muted">{t('config.templatePlaceholderCount', { count: (tp.placeholders || []).length })}</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    {!tp.builtin && <button className="btn-danger" onClick={() => removeTemplate(tp.id)}>{t('common.delete')}</button>}
                  </div>
                </div>
              )
            })}
          </div>

          {activeTemplate && (
            <div style={{ marginTop: 16 }}>
              <div className="section-desc" style={{ marginBottom: 6 }}>{t('config.templateInventory')}</div>
              {placeholders.length === 0 ? (
                <p className="section-desc" style={{ marginTop: 0 }}>{t('config.templateNoPlaceholders')}</p>
              ) : (
                <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
                  {placeholders.map((p) => {
                    const unmapped = unmappedPlaceholders(placeholders, s.fields).includes(p)
                    return <span key={p} className={`badge ${unmapped ? 'badge-neutral' : 'badge-success'} mono-sm`} title={unmapped ? t('config.templatePlaceholderUnmapped') : t('config.templatePlaceholderMapped')}>{`{{${p}}}`}</span>
                  })}
                </div>
              )}
              <p className="section-desc" style={{ marginTop: 8, marginBottom: 0 }}>{t('config.templateInventoryHint')}</p>
            </div>
          )}
        </Panel>
        )}

        {/* ─── Campi ─── */}
        {tab === 'fields' && (
        <Panel
          title={t('config.sectionFields')}
          desc={t('config.sectionFieldsDesc')}
          actions={(
            <>
              <button className="btn btn-ghost" onClick={resetFields}>{t('config.resetDefaults')}</button>
              <button className="btn btn-secondary" onClick={addField}>{t('config.addField')}</button>
            </>
          )}
        >
          <div className="field-list">
            {s.fields.map((f, idx) => (
              <FieldItem key={`${f.id}_${idx}`} f={f} t={t} placeholders={placeholders} onPatch={(p) => patchField(idx, p)} onDelete={() => deleteField(idx)} />
            ))}
          </div>
        </Panel>
        )}

        {/* ─── Prezzi ─── */}
        {tab === 'prezzi' && (
        <Panel
          title={t('config.sectionPrezzi')}
          desc={t('config.sectionPrezziDesc')}
          actions={<button className="btn btn-secondary" onClick={addPrezzo}>{t('config.addPrezzo')}</button>}
        >
          {Object.keys(s.prezzi).length === 0 ? (
            <p className="section-desc" style={{ marginTop: 0 }}>{t('config.prezziEmpty')}</p>
          ) : (
          <div className="field-list">
            {Object.entries(s.prezzi).map(([code, row], idx) => (
              <div className="field-item" key={idx} style={{ gridTemplateColumns: '1fr 1fr 1fr auto' }}>
                <div className="field-row"><span className="field-label-sm">{t('config.prezzoCodice')}</span>
                  <input className="field-input-sm" value={code} onChange={(e) => patchPrezzoCode(idx, e.target.value)} /></div>
                <div className="field-row"><span className="field-label-sm">{t('config.prezzoPacchetto')}</span>
                  <input className="field-input-sm" value={row.pacchetto} onChange={(e) => patchPrezzoRow(idx, { pacchetto: e.target.value })} /></div>
                <div className="field-row"><span className="field-label-sm">{t('config.prezzoPremio')}</span>
                  <input className="field-input-sm" value={row.premio} onChange={(e) => patchPrezzoRow(idx, { premio: e.target.value })} /></div>
                <div className="field-row" style={{ alignItems: 'end', justifyContent: 'end' }}>
                  <button className="btn-danger" onClick={() => deletePrezzo(idx)}>{t('config.deletePrezzo')}</button></div>
                <div className="field-row" style={{ gridColumn: '1 / -1', alignItems: 'start' }}>
                  <span className="field-label-sm">{t('config.prezzoFormula')}</span>
                  <input className="field-input-sm" value={row.formula || ''} placeholder={t('config.prezzoFormulaPlaceholder')}
                    onChange={(e) => patchPrezzoRow(idx, { formula: e.target.value })} /></div>
                {(row.formula || '').trim() && (
                  <div className="field-row" style={{ gridColumn: '1 / -1' }}>
                    <span className="field-label-sm" />
                    <span className="mono-sm" style={{ color: prezzoFormulaOk(row) ? 'var(--c-text-muted)' : 'var(--c-error)' }}>
                      {prezzoFormulaOk(row) ? t('config.prezzoFormulaHint') : t('config.prezzoFormulaInvalid')}
                    </span></div>
                )}
              </div>
            ))}
          </div>
          )}
        </Panel>
        )}

        {/* ─── Allegati ─── */}
        {tab === 'allegati' && (
        <Panel
          title={t('config.sectionAllegati')}
          desc={t('config.sectionAllegatiDesc')}
          actions={<button className="btn btn-secondary" onClick={addAttachment}>{t('config.addAttachment')}</button>}
        >
          {attachments.length === 0 ? (
            <p className="section-desc" style={{ marginTop: 0 }}>{t('config.allegatiEmpty')}</p>
          ) : (
          <div className="field-list">
            {attachments.map((a, idx) => (
              <div className="field-item" key={a.id || idx} style={{ gridTemplateColumns: 'auto 1fr auto' }}>
                <span className="badge badge-neutral mono-sm">{idx + 1}</span>
                <div className="flex items-center gap-2" style={{ minWidth: 0 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.name}</span>
                  {a.builtin && <span className="badge badge-info">{t('config.allegatoBuiltin')}</span>}
                </div>
                <div className="flex gap-2 items-center">
                  <button className="btn btn-ghost" onClick={() => moveAttachment(idx, -1)} disabled={idx === 0} title={t('config.allegatoUp')}>↑</button>
                  <button className="btn btn-ghost" onClick={() => moveAttachment(idx, 1)} disabled={idx === attachments.length - 1} title={t('config.allegatoDown')}>↓</button>
                  <button className="btn-danger" onClick={() => removeAttachment(idx)}>{t('config.deletePrezzo')}</button>
                </div>
              </div>
            ))}
          </div>
          )}
        </Panel>
        )}

        {/* ─── Date ─── */}
        {tab === 'date' && (
        <Panel title={t('config.sectionDate')} desc={t('config.sectionDateDesc')}>
          <div className="form-group" style={{ maxWidth: 220 }}>
            <label className="form-label">{t('config.dateOffset')}</label>
            <input className="form-input" type="number" value={s.dateOffsetDays ?? 0} onChange={(e) => patch({ dateOffsetDays: parseInt(e.target.value || '0', 10) })} />
          </div>
        </Panel>
        )}

        {/* ─── FTP staging / prod ─── */}
        {tab === 'ftp' && (
        <Panel title={t('config.sectionFtp')} desc={t('config.sectionFtpDesc')}>
          <div className="ftp-grid">
            <FtpProfile env="staging" profile={s.ftp?.staging} t={t} onPatch={(p) => patchFtp('staging', p)} />
            <FtpProfile env="prod" profile={s.ftp?.prod} t={t} onPatch={(p) => patchFtp('prod', p)} />
          </div>
        </Panel>
        )}

        {/* ─── Accesso / SMTP ─── */}
        {tab === 'access' && (
        <Panel title={t('config.sectionAccess')} desc={t('config.sectionAccessDesc')}>
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

          <div className="section-title" style={{ margin: '20px 0 4px', fontSize: 15 }}>{t('config.notifyHeading')}</div>
          <div className="section-desc" style={{ margin: '0 0 12px' }}>{t('config.notifyHint')}</div>
          <label className="toggle" style={{ marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={s.exportNotify?.enabled !== false}
              onChange={(e) => patch({ exportNotify: { ...s.exportNotify, enabled: e.target.checked } })}
            />
            <span className="toggle-track"><span className="toggle-thumb" /></span>
            <span className="toggle-label">{t('config.notifyEnabled')}</span>
          </label>
          <div className="maschera-grid">
            <div className="form-group">
              <label className="form-label">{t('config.notifyRecipient')}</label>
              <select
                className="form-input"
                value={s.exportNotify?.mode || 'user'}
                disabled={s.exportNotify?.enabled === false}
                onChange={(e) => patch({ exportNotify: { ...s.exportNotify, mode: e.target.value } })}
              >
                <option value="user">{t('config.notifyModeUser')}</option>
                <option value="shared">{t('config.notifyModeShared')}</option>
                <option value="both">{t('config.notifyModeBoth')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('config.notifyShared')}</label>
              <input
                className="form-input"
                type="email"
                placeholder={t('config.notifySharedPlaceholder')}
                value={s.exportNotify?.sharedEmail || ''}
                disabled={s.exportNotify?.enabled === false || (s.exportNotify?.mode || 'user') === 'user'}
                onChange={(e) => patch({ exportNotify: { ...s.exportNotify, sharedEmail: e.target.value.trim() } })}
              />
            </div>
          </div>
        </Panel>
        )}

        {/* ─── Aspetto ─── */}
        {tab === 'appearance' && (
        <Panel title={t('config.sectionAppearance')}>
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
        </Panel>
        )}

        <div className="config-savebar">
          <button className="btn btn-primary" onClick={save}>{t('config.save')}</button>
          {dirty && !saved && <span className="badge badge-info" role="status" aria-live="polite">{t('config.unsaved')}</span>}
          {saved && <span className="alert alert-success" role="status" aria-live="polite" style={{ padding: '6px 12px' }}>{t('config.saved')}</span>}
        </div>
      </div>
    </>
  )
}
