import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // ─── Auth / magic link ────────────────────────────────────────────────────
  requestMagicLink: (email) => ipcRenderer.invoke('auth:requestLink', email),
  startSsoLogin: () => ipcRenderer.invoke('auth:startSso'),
  getSession: () => ipcRenderer.invoke('auth:getSession'),
  logout: () => ipcRenderer.invoke('auth:logout'),
  onAuthenticated: (callback) => {
    ipcRenderer.on('auth:authenticated', (_e, session) => callback(session))
  },
  removeAuthListeners: () => ipcRenderer.removeAllListeners('auth:authenticated'),

  // ─── Flusso ────────────────────────────────────────────────────────────────
  openFlussoDialog: () => ipcRenderer.invoke('flusso:openDialog'),
  loadFlusso: (filePath) => ipcRenderer.invoke('flusso:load', filePath),

  // ─── Cartella di output ──────────────────────────────────────────────────--
  chooseOutputDir: () => ipcRenderer.invoke('output:chooseDir'),
  openPath: (p) => ipcRenderer.invoke('shell:openPath', p),

  // ─── Record (store locale) ──────────────────────────────────────────────--
  saveRecord: (record, outputDir) => ipcRenderer.invoke('records:save', { record, outputDir }),
  listRecords: () => ipcRenderer.invoke('records:list'),
  updateRecord: (id, record) => ipcRenderer.invoke('records:update', { id, record }),
  deleteRecord: (id) => ipcRenderer.invoke('records:delete', id),
  exportRecords: (opts) => ipcRenderer.invoke('records:export', opts),
  renewRecords: (ids, years = 1) => ipcRenderer.invoke('records:renew', { ids, years }),

  // ─── FTP (staging / prod) ──────────────────────────────────────────────--
  ftpTest: (env) => ipcRenderer.invoke('ftp:test', env),
  ftpUpload: (env, filePath) => ipcRenderer.invoke('ftp:upload', { env, filePath }),
  onFtpProgress: (callback) => {
    ipcRenderer.on('ftp:progress', (_e, info) => callback(info))
  },
  removeFtpProgressListeners: () => ipcRenderer.removeAllListeners('ftp:progress'),

  // ─── Numerazione progressiva ─────────────────────────────────────────────--
  getNumbering: () => ipcRenderer.invoke('numbering:get'),
  setNumbering: (next) => ipcRenderer.invoke('numbering:set', next),

  // ─── Settings ────────────────────────────────────────────────────────────--
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  patchSettings: (partial) => ipcRenderer.invoke('settings:patch', partial),
  resetFieldDefaults: () => ipcRenderer.invoke('settings:resetFields'),

  // ─── Allegati (PDF accodati al modulo) ─────────────────────────────────────--
  addAttachment: () => ipcRenderer.invoke('attachments:add'),
  deleteAttachmentFile: (id) => ipcRenderer.invoke('attachments:deleteFile', id),

  // ─── Libreria template del modulo ──────────────────────────────────────────--
  listTemplates: () => ipcRenderer.invoke('templates:list'),
  importTemplate: () => ipcRenderer.invoke('templates:import'),
  deleteTemplate: (id) => ipcRenderer.invoke('templates:delete', id),
  onSettingsChanged: (callback) => {
    ipcRenderer.on('settings:changed', (_e, settings) => callback(settings))
  },
  removeSettingsChangedListeners: () => ipcRenderer.removeAllListeners('settings:changed'),

  // ─── Preset di configurazione ──────────────────────────────────────────--
  listPresets: () => ipcRenderer.invoke('presets:list'),
  savePreset: (name) => ipcRenderer.invoke('presets:save', name),
  applyPreset: (name) => ipcRenderer.invoke('presets:apply', name),
  deletePreset: (name) => ipcRenderer.invoke('presets:delete', name),
  exportPreset: (name) => ipcRenderer.invoke('presets:export', name),
  importPreset: () => ipcRenderer.invoke('presets:import'),

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
