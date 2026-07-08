/**
 * Logica lato-documento per compilare il modulo HTML (esportato da Pages) e
 * gestire il riflusso dei valori lunghi. Vive come STRINGA iniettata nel
 * contesto della pagina: la usano sia il render reale in Electron
 * (`webContents.executeJavaScript`) sia i test con Chromium/Playwright, così il
 * comportamento provato è esattamente quello che gira in produzione.
 *
 * Due passi:
 *  1. Sostituisce ogni `{{campo}}` nei nodi di testo con il valore reale (il
 *     valore entra come textContent, quindi è intrinsecamente HTML-escaped).
 *  2. Riflusso anti-overflow: il blocco dati dell'aderente (posizionato in modo
 *     assoluto da Pages, `white-space:pre`, che sfora con i valori lunghi) viene
 *     convertito in un flusso centrato che va a capo; tutto ciò che sta sotto la
 *     tabella pacchetti viene spinto giù della quantità necessaria, così non si
 *     sovrappone e non si taglia mai nulla.
 */

/** Ritorna lo script (stringa) da iniettare nella pagina caricata, con i dati già serializzati. */
export function fillAndReflowScript(data) {
  return `(${fillAndReflowFn.toString()})(${JSON.stringify(data || {})});`
}

// Funzione eseguita NEL contesto della pagina (niente riferimenti esterni).
function fillAndReflowFn(DATA) {
  // ── 1. Sostituzione segnaposto nei nodi di testo ──
  var walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)
  var textNodes = []
  while (walker.nextNode()) textNodes.push(walker.currentNode)
  textNodes.forEach(function (n) {
    if (n.nodeValue.indexOf('{{') < 0) return
    n.nodeValue = n.nodeValue.replace(/\{\{(\w+)\}\}/g, function (m, k) {
      return Object.prototype.hasOwnProperty.call(DATA, k) ? String(DATA[k]) : m
    })
  })
  // Fix href degli anchor rimasti col mailto di esempio del template
  Array.prototype.forEach.call(document.querySelectorAll('a[href^="mailto:"]'), function (a) {
    a.setAttribute('href', 'mailto:' + (a.textContent || '').trim())
  })

  // ── 2. Riflusso del blocco dati aderente ──
  var root = document.querySelector('.body > div')
  if (!root) return
  var CONTENT_W = 566.6           // larghezza utile del contenitore Pages
  var TABLE_TOP = 224.25          // top originale della tabella pacchetti
  var kids = Array.prototype.slice.call(root.children)
  function topOf(el) { var t = parseFloat(el.style.top || '0'); return isNaN(t) ? 0 : t }

  // Blocco dati = elementi con top in [110,215] (da "ADERENTE" a "PREMIO")
  var block = kids.filter(function (el) { var t = topOf(el); return t >= 110 && t <= 215 })
  if (!block.length) return
  var blockTop = Math.min.apply(null, block.map(topOf))

  block.forEach(function (el) {
    el.style.position = 'relative'
    el.style.left = '0'
    el.style.top = '0'
    el.style.width = CONTENT_W + 'px'
    el.style.textAlign = 'center'
    el.style.whiteSpace = 'normal'
    el.style.lineHeight = '1.15'
  })
  var wrap = document.createElement('div')
  wrap.style.position = 'absolute'
  wrap.style.left = '0'
  wrap.style.top = blockTop + 'px'
  wrap.style.width = CONTENT_W + 'px'
  root.insertBefore(wrap, block[0])
  block.forEach(function (el) { wrap.appendChild(el) })

  var h = wrap.getBoundingClientRect().height
  var delta = Math.max(0, (blockTop + h) - TABLE_TOP + 4)
  if (delta > 0) {
    kids.forEach(function (el) {
      if (el === wrap) return
      var t = topOf(el)
      if (t >= 220) el.style.top = (t + delta) + 'px'
    })
    var hh = parseFloat(root.style.height || '791.8')
    root.style.height = (hh + delta) + 'px'
  }
}
