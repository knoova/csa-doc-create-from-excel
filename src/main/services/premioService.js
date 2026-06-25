/**
 * Calcolo del premio dal CODICE CONFIGURAZIONE tramite la tabella prezzi
 * configurabile. Modulo PURO (testabile in Node).
 */
import { DEFAULT_PREZZI } from './tracciato.js'

/**
 * @param {string} codiceConfig  es. '00001' | '00002' | '00003'
 * @param {object} prezzi        mappa { codice: { pacchetto, premio } }
 * @returns {{ pacchetto: string, premio: string }}
 */
export function premioFor(codiceConfig, prezzi = DEFAULT_PREZZI) {
  const key = String(codiceConfig == null ? '' : codiceConfig).trim()
  const row = (prezzi && prezzi[key]) || null
  if (!row) return { pacchetto: '', premio: '' }
  return { pacchetto: row.pacchetto || '', premio: row.premio || '' }
}
