import { app, shell, BrowserWindow, ipcMain, nativeImage, dialog } from 'electron'
import { join } from 'path'
import { registerHandlers } from './ipc/handlers.js'
import { initAudit } from './services/auditLogger.js'
import { verifyToken, createSession } from './services/authService.js'
import { isSsoCallback, handleSsoCallback } from './services/ssoAuthService.js'

let mainWindow = null
const getMainWindow = () => mainWindow

const PROTOCOL = 'csadoc'

function getIconPath() {
  if (app.isPackaged) return join(process.resourcesPath, 'icon.png')
  return join(__dirname, '../../assets/icon.png')
}

function registerProtocol() {
  if (process.defaultApp && process.argv.length >= 2) {
    // Sviluppo (electron <main> ...): registra eseguibile + script
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [join(process.argv[1])])
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL)
  }
}

// Notifica il renderer dell'avvenuta autenticazione e porta la finestra in primo
// piano. Condiviso dal magic-link locale e dal login SSO.
function notifyAuthenticated(session) {
  if (!session || !mainWindow) return
  mainWindow.webContents.send('auth:authenticated', session)
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
}

// Instrada un deep link csadoc:// verso il flusso giusto:
//  - csadoc://auth?token=... → magic link locale (invariato)
//  - csadoc://sso?code=...&state=... → login SSO con l'identity provider
async function handleDeepLink(url) {
  if (!url || typeof url !== 'string') return
  try {
    if (isSsoCallback(url)) {
      const session = await handleSsoCallback(url)
      notifyAuthenticated(session)
      return
    }
    const u = new URL(url)
    const isAuth = u.host === 'auth' || (u.pathname || '').includes('auth')
    if (!isAuth) return
    const token = u.searchParams.get('token')
    const res = verifyToken(token)
    if (res?.email) {
      notifyAuthenticated(createSession(res.email))
    }
  } catch (_) {}
}

function deepLinkFromArgv(argv) {
  return (argv || []).find(a => typeof a === 'string' && a.startsWith(`${PROTOCOL}://`)) || null
}

function createWindow() {
  const icon = nativeImage.createFromPath(getIconPath())
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 920,
    minHeight: 640,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    trafficLightPosition: { x: 18, y: 12 },
    backgroundColor: '#13141f',
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('maximize', () => mainWindow.webContents.send('window:maximizeChange', true))
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window:maximizeChange', false))
  mainWindow.on('closed', () => { mainWindow = null })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
  return mainWindow
}

process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err)
  try { dialog.showErrorBox('Errore imprevisto', `Si è verificato un errore:\n${err.message}`) } catch (_) {}
})
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason)
})

// ─── Single instance + deep link routing ────────────────────────────────────
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    const url = deepLinkFromArgv(argv)
    if (url) handleDeepLink(url)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.on('open-url', (event, url) => {
    event.preventDefault()
    handleDeepLink(url)
  })

  app.whenReady().then(() => {
    initAudit()
    registerProtocol()
    createWindow()
    registerHandlers(ipcMain, getMainWindow)

    // Avvio tramite protocollo su Windows: il link è negli argv di processo.
    const startupUrl = deepLinkFromArgv(process.argv)
    if (startupUrl) {
      mainWindow.webContents.once('did-finish-load', () => handleDeepLink(startupUrl))
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
