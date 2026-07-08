import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Banner from '../components/Banner.jsx'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GROUP_ORDER = ['polizza', 'contraente', 'veicolo', 'copertura', 'contatti']

// Record vuoto per l'inserimento manuale: i campi fissi sono già valorizzati.
function emptyRecord(fields) {
  const rec = { idd: {} }
  for (const f of fields) rec[f.id] = f.type === 'fixed' ? (f.fixed ?? '') : ''
  return rec
}

function validate(form, fields) {
  const errors = {}
  for (const f of fields) {
    if (f.enabled === false || f.type === 'fixed') continue
    const v = form[f.id]
    const empty = v == null || String(v).trim() === ''
    if (f.required && empty) { errors[f.id] = 'required'; continue }
    if (empty) continue
    const s = String(v)
    if (f.maxLength && s.length > f.maxLength) { errors[f.id] = `max ${f.maxLength}`; continue }
    if (f.type === 'date' && !/^\d{2}\/\d{2}\/\d{4}$/.test(s)) { errors[f.id] = 'GG/MM/AAAA'; continue }
    if (f.type === 'number' && !/^-?\d+([.,]\d+)?$/.test(s.trim())) { errors[f.id] = 'numero'; continue }
    if (f.type === 'email' && !EMAIL_RE.test(s)) { errors[f.id] = 'email'; continue }
    if (f.type === 'select' && Array.isArray(f.options) && !f.options.some(o => o.value === s)) { errors[f.id] = 'valore'; continue }
  }
  return errors
}

export default function Adesioni({ visible = true }) {
  const { t } = useTranslation()
  const [settings, setSettings] = useState(null)
  const [flusso, setFlusso] = useState(null)
  const [selectedIdx, setSelectedIdx] = useState(-1)
  const [form, setForm] = useState(null)
  const [manual, setManual] = useState(false)
  const [search, setSearch] = useState('')
  const [outputDir, setOutputDir] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [banner, setBanner] = useState(null)
  const [numbering, setNumbering] = useState({ next: '' })
  const [seedInput, setSeedInput] = useState('')

  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setSettings(s)
      if (s.lastOutputDir) setOutputDir(s.lastOutputDir)
    })
    window.electronAPI.getNumbering().then((n) => { if (n) setNumbering(n) }).catch(() => {})
  }, [])

  // Configurazioni aggiornate in tempo reale (campi/prezzi/IDD) senza toccare
  // il form in compilazione; al ritorno sulla pagina si ricarica la numerazione.
  useEffect(() => {
    const onChanged = (e) => { if (e.detail) setSettings(e.detail) }
    window.addEventListener('settings-changed', onChanged)
    return () => window.removeEventListener('settings-changed', onChanged)
  }, [])

  useEffect(() => {
    if (!visible) return
    window.electronAPI.getSettings().then(setSettings).catch(() => {})
    window.electronAPI.getNumbering().then((n) => { if (n) setNumbering(n) }).catch(() => {})
  }, [visible])

  const fields = settings?.fields || []
  const idd = settings?.idd || []
  const prezzi = settings?.prezzi || {}

  const errors = useMemo(() => (form ? validate(form, fields) : {}), [form, fields])
  const hasErrors = Object.keys(errors).length > 0

  const premio = useMemo(() => {
    if (!form) return null
    const row = prezzi[String(form.codice_configurazione || '').trim()]
    return row || null
  }, [form, prezzi])

  const filteredRecords = useMemo(() => {
    if (!flusso) return []
    const q = search.trim().toLowerCase()
    return flusso.records
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => {
        if (!q) return true
        return [r.cognome, r.nome, r.targa, r.codice_fiscale].some(v => String(v || '').toLowerCase().includes(q))
      })
  }, [flusso, search])

  const loadFlusso = async () => {
    setBanner(null)
    const path = await window.electronAPI.openFlussoDialog()
    if (!path) return
    const res = await window.electronAPI.loadFlusso(path)
    if (!res?.ok) { setBanner({ type: 'error', msg: res?.error || t('common.error') }); return }
    setFlusso(res)
    setSelectedIdx(-1)
    setForm(null)
    setResult(null)
  }

  const selectRow = (i) => {
    setSelectedIdx(i)
    setManual(false)
    setResult(null)
    const rec = JSON.parse(JSON.stringify(flusso.records[i]))
    if (!rec.idd) rec.idd = {}
    setForm(rec)
  }

  // Crea un record vuoto precompilando l'identificativo con il numero suggerito.
  const newRecord = () => {
    const rec = emptyRecord(fields)
    if (numbering?.next && !rec.identificativo) rec.identificativo = numbering.next
    return rec
  }

  const startManual = () => {
    setManual(true)
    setSelectedIdx(-1)
    setResult(null)
    setBanner(null)
    setForm(newRecord())
  }

  const clearForm = () => { setResult(null); setForm(newRecord()) }

  const applySeed = async () => {
    const val = seedInput.trim()
    const n = await window.electronAPI.setNumbering(val)
    setNumbering(n || { next: val })
    setSeedInput('')
    // Se siamo su un nuovo record manuale con identificativo vuoto, precompila.
    setForm((f) => (f && manual && !f.identificativo ? { ...f, identificativo: (n?.next ?? val) } : f))
  }

  const updateField = (id, value) => setForm((f) => ({ ...f, [id]: value }))
  const updateIdd = (domanda, value) => setForm((f) => ({ ...f, idd: { ...(f.idd || {}), [domanda]: value } }))

  const chooseDir = async () => {
    const dir = await window.electronAPI.chooseOutputDir()
    if (dir) setOutputDir(dir)
  }

  const saveRecord = async () => {
    if (!form) return
    if (hasErrors) { setBanner({ type: 'error', msg: t('adesioni.validationErrors') }); return }
    if (!outputDir) { setBanner({ type: 'error', msg: t('adesioni.missingFolder') }); return }
    setGenerating(true); setBanner(null); setResult(null)
    try {
      const res = await window.electronAPI.saveRecord(form, outputDir)
      if (res?.ok) {
        if (res.numbering) setNumbering(res.numbering)
        setResult(res)
        // Pronto per il prossimo inserimento: nuovo record col numero suggerito.
        if (manual) {
          const rec = emptyRecord(fields)
          if (res.numbering?.next) rec.identificativo = res.numbering.next
          setForm(rec)
        }
      } else {
        setBanner({ type: 'error', msg: res?.error || t('adesioni.validationErrors') })
      }
    } catch (e) {
      setBanner({ type: 'error', msg: String(e?.message || e) })
    } finally {
      setGenerating(false)
    }
  }

  // Raggruppa i campi per sezione, preservando l'ordine.
  const groups = useMemo(() => {
    const map = {}
    for (const f of fields) {
      if (f.group === 'contatti' || GROUP_ORDER.includes(f.group)) {
        (map[f.group] = map[f.group] || []).push(f)
      } else {
        (map[f.group || 'altro'] = map[f.group || 'altro'] || []).push(f)
      }
    }
    const ordered = []
    for (const g of GROUP_ORDER) if (map[g]) ordered.push([g, map[g]])
    for (const g of Object.keys(map)) if (!GROUP_ORDER.includes(g)) ordered.push([g, map[g]])
    return ordered
  }, [fields])

  const renderField = (f) => {
    const val = form?.[f.id] ?? (f.type === 'fixed' ? f.fixed : '')
    const err = errors[f.id]
    const span = (f.type === 'text' && (f.maxLength || 0) >= 30) ? ' span-2' : ''
    return (
      <div className={`form-group${span}`} key={f.id}>
        <label className="form-label">{f.label}{f.required ? ' *' : ''}</label>
        {f.type === 'fixed' ? (
          <input className="form-input" value={f.fixed} disabled />
        ) : f.type === 'select' ? (
          <select className={`form-select${err ? ' invalid' : ''}`} value={val} onChange={(e) => updateField(f.id, e.target.value)}>
            <option value="">—</option>
            {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            className={`form-input${err ? ' invalid' : ''}`}
            value={val}
            placeholder={f.type === 'date' ? 'GG/MM/AAAA' : ''}
            onChange={(e) => updateField(f.id, e.target.value)}
          />
        )}
        {err && <span className="field-error-text">{err === 'required' ? t('common.required') : err}</span>}
      </div>
    )
  }

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">{t('adesioni.title')}</h1>
        <p className="page-subtitle">{t('adesioni.subtitle')}</p>
      </div>

      <div className="page-body">
        <div className="adesioni-layout">
          {/* ─── Pannello flusso ─── */}
          <div className="flusso-panel">
            {/* Numerazione progressiva dell'identificativo */}
            <div className="card card-section" style={{ marginBottom: 0 }}>
              <div className="section-title">{t('adesioni.numbering')}</div>
              <p className="section-desc" style={{ margin: '0 0 8px' }}>
                {numbering?.next
                  ? <>{t('adesioni.numberingNext')}: <strong className="mono-sm">{numbering.next}</strong></>
                  : t('adesioni.numberingNone')}
              </p>
              <div className="flex gap-2 items-center">
                <input
                  className="form-input"
                  placeholder={t('adesioni.numberingSeedPlaceholder')}
                  value={seedInput}
                  onChange={(e) => setSeedInput(e.target.value)}
                />
                <button className="btn btn-secondary" onClick={applySeed} disabled={!seedInput.trim()}>
                  {t('adesioni.numberingSet')}
                </button>
              </div>
            </div>
            <div className="sep" style={{ margin: '6px 0' }} />
            <button className={`btn btn-primary${manual ? '' : ''}`} onClick={startManual}>{t('adesioni.newManual')}</button>
            <p className="section-desc" style={{ margin: '-4px 0 0' }}>{t('adesioni.newManualHint')}</p>
            {manual && <div className="status-row"><span className="status-dot connected" /> {t('adesioni.manualTitle')}</div>}
            <div className="sep" style={{ margin: '6px 0' }} />
            <div className="section-title">{t('adesioni.orLoadFlusso')}</div>
            <button className="btn btn-secondary" onClick={loadFlusso}>{t('adesioni.loadFlusso')}</button>
            {flusso ? (
              <>
                <div className="status-row">
                  <span className="status-dot connected" />
                  {t('adesioni.flussoLoaded')} · {t('adesioni.rowsCount', { count: flusso.count })}
                </div>
                <input
                  className="form-input"
                  placeholder={t('adesioni.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="section-title">{t('adesioni.rowListTitle')}</div>
                <div className="row-list">
                  {filteredRecords.map(({ r, i }) => {
                    const pacc = prezzi[String(r.codice_configurazione || '').trim()]?.pacchetto
                    return (
                      <button key={i} className={`row-item${selectedIdx === i ? ' active' : ''}`} onClick={() => selectRow(i)}>
                        <div className="row-item-name">{[r.cognome, r.nome].filter(Boolean).join(' ') || '—'}</div>
                        <div className="row-item-meta">
                          <span>{r.targa || '—'}</span>
                          {pacc && <span>· {t('adesioni.pacchetto')} {pacc}</span>}
                          <span>· {t('adesioni.movimento')} {r.tipo_movimento || '—'}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>{t('adesioni.noFlusso')}</p>
                <p className="text-muted">{t('adesioni.noFlussoHint')}</p>
              </div>
            )}
          </div>

          {/* ─── Maschera ─── */}
          <div className="maschera-panel">
            {!form ? (
              <div className="card empty-state"><p>{t('adesioni.selectRow')}</p></div>
            ) : (
              <>
                {banner && <Banner type={banner.type}>{banner.msg}</Banner>}
                {result && (
                  <Banner type="success" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                    <strong>{t('adesioni.savedTitle')}</strong>
                    <span>{result.files?.pdf ? t('adesioni.savedBodyPdf') : t('adesioni.savedBody')}</span>
                    <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={() => window.electronAPI.openPath(result.dir)}>
                      {t('adesioni.openFolder')}
                    </button>
                  </Banner>
                )}
                {result?.pdfError && (
                  <Banner type="error">
                    {t('adesioni.pdfFallbackZip', { error: result.pdfError })}
                  </Banner>
                )}

                {groups.map(([g, gfields]) => (
                  <div className="card card-section" key={g} style={{ marginBottom: 0 }}>
                    <div className="section-title">{t(`adesioni.group.${g}`, g)}</div>
                    <div className="maschera-grid">{gfields.map(renderField)}</div>
                  </div>
                ))}

                {/* Questionario IDD */}
                <div className="card card-section" style={{ marginBottom: 0 }}>
                  <div className="section-title">{t('adesioni.group.questionario')}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {idd.map((q) => (
                      <div className="form-group" key={q.domanda}>
                        <label className="form-label" style={{ textTransform: 'none', letterSpacing: 0 }}>{q.label}</label>
                        <select
                          className="form-select"
                          value={form.idd?.[q.domanda] || ''}
                          onChange={(e) => updateIdd(q.domanda, e.target.value)}
                        >
                          <option value="">—</option>
                          {q.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Azioni */}
                <div className="card" style={{ marginBottom: 24 }}>
                  <div className="maschera-actions">
                    {premio && (
                      <span className="premio-pill">{t('adesioni.premioCalc')}: € {premio.premio} {premio.pacchetto ? `(${premio.pacchetto})` : ''}</span>
                    )}
                    <div className="folder-row">
                      <button className="btn btn-secondary" onClick={chooseDir}>{t('adesioni.chooseFolder')}</button>
                      {outputDir && <span className="folder-path" title={outputDir}>{outputDir}</span>}
                    </div>
                    {manual && <button className="btn btn-ghost" onClick={clearForm}>{t('adesioni.clear')}</button>}
                    <button className="btn btn-primary" onClick={saveRecord} disabled={generating || hasErrors}>
                      {generating ? (<><span className="spinner spinner-sm" /> {t('adesioni.saving')}</>) : t('adesioni.save')}
                    </button>
                  </div>
                  {hasErrors && <p className="field-error-text" style={{ marginTop: 8 }}>{t('adesioni.validationErrors')}</p>}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
