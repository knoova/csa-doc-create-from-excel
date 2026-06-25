import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ─── Auth / magic link ────────────────────────────────────────────────────
  requestMagicLink: (email) => ipcRenderer.invoke('auth:requestLink', email),
  getSession: () => ipcRenderer.invoke('auth:getSession'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  onAuthenticated: (callback) => {
    ipcRenderer.on('auth:authenticated', (_e, session) => callback(session))
  },
  removeAuthListeners: () => ipcRenderer.removeAllListeners('auth:authenticated'),

  // ─── Flusso ────────────────────────────────────────────────────────────────
  openFlussoDialog: () => ipcRenderer.invoke('flusso:openDialog'),
  loadFlusso: (filePath) => ipcRenderer.invoke('flusso:load', filePath),

  // ─── Generazione output ──────────────────────────────────────────────────--
  chooseOutputDir: () => ipcRenderer.invoke('output:chooseDir'),
  generateOutputs: (record, outputDir, sourceHeaders) =>
    ipcRenderer.invoke('output:generate', { record, outputDir, sourceHeaders }),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),

  // ─── Settings ────────────────────────────────────────────────────────────--
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  resetFieldDefaults: () => ipcRenderer.invoke('settings:resetFields'),

  // ─── Registro attività ──────────────────────────────────────────────────--
  listAudit: () => ipcRenderer.invoke('audit:list'),
  exportAudit: () => ipcRenderer.invoke('audit:export'),

  // ─── App ───────────────────────────────────────────────────────────────────
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdate: () => ipcRenderer.invoke('app:checkUpdate'),
  platform: process.platform,

  // ─── Window controls ───────────────────────────────────────────────────────
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  onWindowMaximizeChange: (callback) => {
    ipcRenderer.on('window:maximizeChange', (_event, val) => callback(val))
  },
  removeWindowMaximizeListeners: () => {
    ipcRenderer.removeAllListeners('window:maximizeChange')
  }
})
