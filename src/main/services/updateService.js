/**
 * Controllo aggiornamenti best-effort: confronta la versione locale con l'ultima
 * release GitHub. Non blocca mai l'app; in caso di errore o repo non impostato
 * restituisce { hasUpdate: false }.
 *
 * Imposta GITHUB_REPO ("owner/nome") quando il repository è noto per abilitarlo.
 */
import { app, net } from 'electron'

const GITHUB_REPO = '' // es. 'thinkpinkstudio/csa-doc-create-from-excel'

function cmpSemver(a, b) {
  const pa = String(a).replace(/^v/, '').split('.').map(Number)
  const pb = String(b).replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0, y = pb[i] || 0
    if (x !== y) return x - y
  }
  return 0
}

export async function checkForUpdate() {
  if (!GITHUB_REPO) return { hasUpdate: false }
  try {
    const json = await new Promise((resolve, reject) => {
      const req = net.request(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`)
      req.setHeader('User-Agent', 'CSA-Adesioni')
      let data = ''
      req.on('response', (res) => {
        res.on('data', (c) => { data += c })
        res.on('end', () => { try { resolve(JSON.parse(data)) } catch (e) { reject(e) } })
      })
      req.on('error', reject)
      req.end()
    })
    const latest = (json.tag_name || '').replace(/^v/, '').split('-')[0]
    if (latest && cmpSemver(latest, app.getVersion()) > 0) {
      return { hasUpdate: true, latestVersion: latest, releaseUrl: json.html_url }
    }
  } catch (_) {}
  return { hasUpdate: false }
}
