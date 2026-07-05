import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Sidebar from './components/Sidebar.jsx'
import TitleBar from './components/TitleBar.jsx'
import Login from './pages/Login.jsx'
import Adesioni from './pages/Adesioni.jsx'
import Record from './pages/Record.jsx'
import Scadenze from './pages/Scadenze.jsx'
import Configurazioni from './pages/Configurazioni.jsx'
import Registro from './pages/Registro.jsx'
import Contacts from './pages/Contacts.jsx'

const DEFAULT_ACCENT = '#e91e8c'

function darkenHex(hex, amount = 0.1) {
  try {
    const h = hex.replace('#', '')
    const r = parseInt(h.slice(0, 2), 16)
    const g = parseInt(h.slice(2, 4), 16)
    const b = parseInt(h.slice(4, 6), 16)
    const dr = Math.max(0, Math.round(r * (1 - amount)))
    const dg = Math.max(0, Math.round(g * (1 - amount)))
    const db = Math.max(0, Math.round(b * (1 - amount)))
    return `#${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`
  } catch {
    return hex
  }
}

function applyAccentColor(color) {
  const accent = color || DEFAULT_ACCENT
  document.documentElement.style.setProperty('--c-accent', accent)
  document.documentElement.style.setProperty('--c-accent-hover', darkenHex(accent, 0.1))
}

export default function App() {
  const { i18n } = useTranslation()
  const [page, setPage] = useState('adesioni')
  const [theme, setTheme] = useState('dark')
  const [session, setSession] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  // Carica preferenze e verifica la sessione esistente all'avvio.
  useEffect(() => {
    const load = async () => {
      try {
        const s = await window.electronAPI.getSettings()
        if (s.theme) setTheme(s.theme)
        if (s.language) i18n.changeLanguage(s.language)
        applyAccentColor(s.accentColor)
      } catch (_) {}
      try {
        const sess = await window.electronAPI.getSession()
        if (sess?.email) setSession(sess)
      } catch (_) {}
      setAuthChecked(true)
    }
    load()
  }, [])

  // Notifica dal main quando il magic link viene verificato (deep-link csadoc://).
  useEffect(() => {
    window.electronAPI?.onAuthenticated?.((sess) => {
      if (sess?.email) setSession(sess)
    })
    return () => window.electronAPI?.removeAuthListeners?.()
  }, [])

  // Ponte unico per l'aggiornamento in tempo reale delle configurazioni: il
  // main emette settings:changed a ogni salvataggio; qui lo si rilancia come
  // evento window così ogni pagina può ascoltarlo senza contendersi l'IPC.
  useEffect(() => {
    window.electronAPI?.onSettingsChanged?.((settings) => {
      window.dispatchEvent(new CustomEvent('settings-changed', { detail: settings }))
      if (settings?.theme) setTheme(settings.theme)
      if (settings?.language) i18n.changeLanguage(settings.language)
      applyAccentColor(settings?.accentColor)
    })
    return () => window.electronAPI?.removeSettingsChangedListeners?.()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  const handleThemeChange = (t) => setTheme(t)
  const handleLangChange = (l) => i18n.changeLanguage(l)
  const handleAccentChange = useCallback((color) => applyAccentColor(color), [])

  const handleLogout = useCallback(async () => {
    try { await window.electronAPI.logout() } catch (_) {}
    setSession(null)
    setPage('adesioni')
  }, [])

  if (!authChecked) {
    return (
      <>
        <TitleBar />
        <div className="app-shell" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      </>
    )
  }

  if (!session?.email) {
    return (
      <>
        <TitleBar />
        <Login onAuthenticated={setSession} />
      </>
    )
  }

  return (
    <>
      <a href="#main-content" className="skip-nav">Skip to main content</a>
      <TitleBar />
      <div className="app-shell">
        <Sidebar
          page={page}
          onNavigate={setPage}
          theme={theme}
          onThemeChange={handleThemeChange}
          lang={i18n.language}
          onLangChange={handleLangChange}
          session={session}
          onLogout={handleLogout}
        />
        <main id="main-content" className="main-content" role="main" aria-label={page} tabIndex={-1}>
          <div style={{ display: page === 'adesioni' ? 'contents' : 'none' }}>
            <Adesioni session={session} visible={page === 'adesioni'} />
          </div>
          <div style={{ display: page === 'record' ? 'contents' : 'none' }}>
            <Record visible={page === 'record'} />
          </div>
          <div style={{ display: page === 'scadenze' ? 'contents' : 'none' }}>
            <Scadenze visible={page === 'scadenze'} />
          </div>
          <div style={{ display: page === 'configurazioni' ? 'contents' : 'none' }}>
            <Configurazioni
              visible={page === 'configurazioni'}
              onThemeChange={handleThemeChange}
              onLangChange={handleLangChange}
              onAccentChange={handleAccentChange}
              currentTheme={theme}
              currentLang={i18n.language}
            />
          </div>
          <div style={{ display: page === 'registro' ? 'contents' : 'none' }}>
            <Registro visible={page === 'registro'} />
          </div>
          <div style={{ display: page === 'contacts' ? 'contents' : 'none' }}>
            <Contacts />
          </div>
        </main>
      </div>
    </>
  )
}
