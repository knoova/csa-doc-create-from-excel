import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import iconUrl from '../assets/icon.png'

/* global __APP_VERSION__ __UPDATE_URL__ */

const IconDoc = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>
)

const IconSettings = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const IconActivity = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)

const IconArchive = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="21 8 21 21 3 21 3 8" />
    <rect x="1" y="3" width="22" height="5" />
    <line x1="10" y1="12" x2="14" y2="12" />
  </svg>
)

const IconUser = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
    <circle cx="12" cy="7" r="4"/>
  </svg>
)

const IconSun = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const IconMoon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const IconLogout = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
    <polyline points="16 17 21 12 16 7"/>
    <line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

const IconCalendar = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
    <line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
  </svg>
)

const navItems = [
  { id: 'adesioni',       icon: <IconDoc />,      labelKey: 'nav.adesioni' },
  { id: 'record',         icon: <IconArchive />,  labelKey: 'nav.record' },
  { id: 'scadenze',       icon: <IconCalendar />, labelKey: 'nav.scadenze' },
  { id: 'configurazioni', icon: <IconSettings />, labelKey: 'nav.configurazioni' },
  { id: 'registro',       icon: <IconActivity />, labelKey: 'nav.registro' },
  { id: 'contacts',       icon: <IconUser />,     labelKey: 'nav.contacts' }
]

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : ''

export default function Sidebar({ page, onNavigate, theme, onThemeChange, lang, onLangChange, session, onLogout }) {
  const { t } = useTranslation()
  const [updateInfo, setUpdateInfo] = useState(null)

  useEffect(() => {
    window.electronAPI?.checkForUpdate?.()
      .then(info => { if (info?.hasUpdate) setUpdateInfo(info) })
      .catch(() => {})
  }, [])

  // Patch mirata (non l'intero oggetto settings): evita di sovrascrivere
  // modifiche non salvate aperte altrove (es. Configurazioni in edit).
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    onThemeChange(next)
    window.electronAPI.patchSettings({ theme: next })
  }

  const setLang = (l) => {
    onLangChange(l)
    window.electronAPI.patchSettings({ language: l })
  }

  return (
    <aside className="sidebar" role="navigation" aria-label={t('nav.adesioni')}>
      <div className="sidebar-header">
        <div className="logo-row" role="banner">
          <img src={iconUrl} alt="" aria-hidden="true" className="logo-img" />
          <div className="logo-text">
            <span className="logo-name">{t('brand.name')}</span>
            <span className="logo-sub">{t('brand.subtitle')}</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item${page === item.id ? ' active' : ''}`}
            onClick={() => onNavigate(item.id)}
            aria-current={page === item.id ? 'page' : undefined}
          >
            {item.icon}
            <span>{t(item.labelKey)}</span>
          </button>
        ))}
      </nav>

      {session?.email && (
        <div className="session-box">
          <div className="session-email" title={session.email}>
            <IconUser />
            <span>{session.email}</span>
          </div>
          <button className="btn-icon" onClick={onLogout} title={t('session.logout')} aria-label={t('session.logout')}>
            <IconLogout />
          </button>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="footer-brand-block">
          <span className="footer-brand" aria-label={t('brand.company')}>{t('brand.company')}</span>
          <div className="footer-version-row">
            {appVersion && <span className="footer-version">v{appVersion}</span>}
            {updateInfo && (
              <button
                className="footer-update-badge"
                onClick={() => window.open((typeof __UPDATE_URL__ !== 'undefined' && __UPDATE_URL__) || updateInfo.releaseUrl)}
                title={t('update.tooltip', { version: updateInfo.latestVersion })}
                aria-label={t('update.tooltip', { version: updateInfo.latestVersion })}
              >
                {t('update.badge', { version: updateInfo.latestVersion })}
              </button>
            )}
          </div>
        </div>
        <div className="footer-actions">
          <button className={`lang-btn${lang === 'it' ? ' active' : ''}`} onClick={() => setLang('it')} aria-label="Italiano" aria-pressed={lang === 'it'}>IT</button>
          <button className={`lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => setLang('en')} aria-label="English" aria-pressed={lang === 'en'}>EN</button>
          <button className="theme-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? t('config.themeLight') : t('config.themeDark')} title={theme === 'dark' ? t('config.themeLight') : t('config.themeDark')}>
            {theme === 'dark' ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </div>
    </aside>
  )
}
