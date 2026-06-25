import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import iconUrl from '../assets/icon.png'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle') // idle | sending | sent
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) { setError(t('login.invalidEmail')); return }
    setStatus('sending')
    try {
      const res = await window.electronAPI.requestMagicLink(value)
      if (res?.ok) {
        setStatus('sent')
      } else if (res?.reason === 'domain') {
        setStatus('idle'); setError(t('login.domainError'))
      } else if (res?.reason === 'invalid') {
        setStatus('idle'); setError(t('login.invalidEmail'))
      } else {
        setStatus('idle'); setError(t('login.genericError'))
      }
    } catch (_) {
      setStatus('idle'); setError(t('login.genericError'))
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img src={iconUrl} alt="" className="login-logo" />
        <h1 className="login-title">{t('login.title')}</h1>
        <p className="login-subtitle">{t('login.subtitle')}</p>

        {status === 'sent' ? (
          <div className="alert alert-success" style={{ textAlign: 'left' }}>
            <span>{t('login.sent')}</span>
          </div>
        ) : (
          <form className="login-form" onSubmit={submit}>
            <div className="form-group">
              <label className="form-label" htmlFor="login-email">{t('login.emailLabel')}</label>
              <input
                id="login-email"
                type="email"
                className={`form-input${error ? ' invalid' : ''}`}
                placeholder={t('login.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                disabled={status === 'sending'}
              />
              {error && <span className="field-error-text">{error}</span>}
            </div>
            <button type="submit" className="btn btn-primary" disabled={status === 'sending'}>
              {status === 'sending'
                ? (<><span className="spinner spinner-sm" /> {t('login.sending')}</>)
                : t('login.sendButton')}
            </button>
          </form>
        )}

        {status === 'sent' && (
          <p className="login-note" style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <span className="spinner spinner-sm" /> {t('login.waitingAuth')}
          </p>
        )}

        <p className="login-note">{t('login.footerNote')}</p>
      </div>
    </div>
  )
}
