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
  ACCEPTED_DOMAINS: process.env.ACCEPTED_DOMAINS || ''
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
