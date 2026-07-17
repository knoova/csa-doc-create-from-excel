import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const __dirname = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const { version } = require('./package.json')

// Config iniettata nella build (per la versione compilata, dove .env.local NON
// esiste). In CI questi valori arrivano dai GitHub Secrets mappati sullo step di
// build; in locale restano vuoti e l'app usa .env.local. Vedi src/main/services/envConfig.js.
const buildEnv = {
  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: process.env.SMTP_PORT || '',
  SMTP_SECURE: process.env.SMTP_SECURE || '',
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',
  ACCEPTED_DOMAINS: process.env.ACCEPTED_DOMAINS || '',
  // FTP/SFTP staging/prod precaricati nella build (sovrascrivibili in Configurazioni).
  FTP_STAGING_PROTOCOL: process.env.FTP_STAGING_PROTOCOL || '',
  FTP_STAGING_HOST: process.env.FTP_STAGING_HOST || '',
  FTP_STAGING_PORT: process.env.FTP_STAGING_PORT || '',
  FTP_STAGING_USER: process.env.FTP_STAGING_USER || '',
  FTP_STAGING_PASS: process.env.FTP_STAGING_PASS || '',
  FTP_STAGING_SECURE: process.env.FTP_STAGING_SECURE || '',
  FTP_STAGING_DIR: process.env.FTP_STAGING_DIR || '',
  FTP_STAGING_KEY: process.env.FTP_STAGING_KEY || '',
  FTP_STAGING_PASSPHRASE: process.env.FTP_STAGING_PASSPHRASE || '',
  FTP_PROD_PROTOCOL: process.env.FTP_PROD_PROTOCOL || '',
  FTP_PROD_HOST: process.env.FTP_PROD_HOST || '',
  FTP_PROD_PORT: process.env.FTP_PROD_PORT || '',
  FTP_PROD_USER: process.env.FTP_PROD_USER || '',
  FTP_PROD_PASS: process.env.FTP_PROD_PASS || '',
  FTP_PROD_SECURE: process.env.FTP_PROD_SECURE || '',
  FTP_PROD_DIR: process.env.FTP_PROD_DIR || '',
  FTP_PROD_KEY: process.env.FTP_PROD_KEY || '',
  FTP_PROD_PASSPHRASE: process.env.FTP_PROD_PASSPHRASE || '',
  // Mailbox condivisa opzionale per i riepiloghi (override lato deployment).
  EXPORT_NOTIFY_SHARED: process.env.EXPORT_NOTIFY_SHARED || '',
  EXPORT_NOTIFY_MODE: process.env.EXPORT_NOTIFY_MODE || ''
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      __APP_ENV__: JSON.stringify(buildEnv)
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [react()],
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __UPDATE_URL__: JSON.stringify(process.env.UPDATE_DOWNLOAD_URL || 'https://downloads.thinkpinkstudio.it/p/csa-adesioni')
    },
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    }
  }
})
