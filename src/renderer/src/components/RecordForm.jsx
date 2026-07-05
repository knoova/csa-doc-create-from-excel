import { useTranslation } from 'react-i18next'

const GROUP_ORDER = ['polizza', 'contraente', 'veicolo', 'copertura', 'contatti']

/** Raggruppa i campi per sezione preservando l'ordine canonico. */
export function groupFields(fields) {
  const map = {}
  for (const f of fields) {
    const g = GROUP_ORDER.includes(f.group) ? f.group : (f.group || 'altro')
    ;(map[g] = map[g] || []).push(f)
  }
  const ordered = []
  for (const g of GROUP_ORDER) if (map[g]) ordered.push([g, map[g]])
  for (const g of Object.keys(map)) if (!GROUP_ORDER.includes(g)) ordered.push([g, map[g]])
  return ordered
}

/**
 * Maschera di un record (campi raggruppati + questionario IDD), riusabile in
 * sola lettura o in modifica. Le regole di validazione restano al chiamante
 * (prop errors), come in Adesioni.
 */
export default function RecordForm({ form, fields, idd, errors = {}, editable, onField, onIdd }) {
  const { t } = useTranslation()
  if (!form) return null

  const renderField = (f) => {
    const val = form?.[f.id] ?? (f.type === 'fixed' ? f.fixed : '')
    const err = errors[f.id]
    const span = (f.type === 'text' && (f.maxLength || 0) >= 30) ? ' span-2' : ''
    const disabled = !editable || f.type === 'fixed'
    return (
      <div className={`form-group${span}`} key={f.id}>
        <label className="form-label">{f.label}{f.required ? ' *' : ''}</label>
        {f.type === 'select' && !disabled ? (
          <select className={`form-select${err ? ' invalid' : ''}`} value={val} onChange={(e) => onField?.(f.id, e.target.value)}>
            <option value="">—</option>
            {(f.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            className={`form-input${err ? ' invalid' : ''}`}
            value={val ?? ''}
            disabled={disabled}
            placeholder={f.type === 'date' ? 'GG/MM/AAAA' : ''}
            onChange={(e) => onField?.(f.id, e.target.value)}
          />
        )}
        {err && <span className="field-error-text">{err === 'required' ? t('common.required') : err}</span>}
      </div>
    )
  }

  return (
    <>
      {groupFields(fields).map(([g, gfields]) => (
        <div className="card card-section" key={g} style={{ marginBottom: 0 }}>
          <div className="section-title">{t(`adesioni.group.${g}`, g)}</div>
          <div className="maschera-grid">{gfields.map(renderField)}</div>
        </div>
      ))}

      <div className="card card-section" style={{ marginBottom: 0 }}>
        <div className="section-title">{t('adesioni.group.questionario')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(idd || []).map((q) => (
            <div className="form-group" key={q.domanda}>
              <label className="form-label" style={{ textTransform: 'none', letterSpacing: 0 }}>{q.label}</label>
              <select
                className="form-select"
                value={form.idd?.[q.domanda] || ''}
                disabled={!editable}
                onChange={(e) => onIdd?.(q.domanda, e.target.value)}
              >
                <option value="">—</option>
                {q.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
