/**
 * Generazione del PDF del Modulo di Adesione a partire dal template HTML
 * esportato da Pages (`templates/modulo_html/`), e unione con l'allegato fisso
 * "CSA Convenzione Assistenza Tutela - DIP.pdf" in un unico documento.
 *
 * Perché HTML e non conversione dal .docx: il layout va compilato con dati di
 * lunghezza variabile senza sforare. Un motore che RIFLUISCE (HTML/CSS in
 * Chromium) è l'unico modo per gestire valori lunghi (vanno a capo, il blocco
 * si allunga) senza rimpicciolire né tagliare. Il render usa `printToPDF` di
 * Electron (stesso motore Chromium) — nessun processo esterno, nessuna
 * dipendenza da Word/LibreOffice.
 *
 * Se il render fallisce, invece di bloccare il salvataggio si produce uno ZIP
 * con il .docx e il PDF allegato, così l'operatore ha comunque tutto.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'fs'
import { join, basename } from 'path'
import { tmpdir } from 'os'
import { app, BrowserWindow } from 'electron'
import PizZip from 'pizzip'
import { PDFDocument } from 'pdf-lib'
import { buildDocxData } from './recordMapper.js'
import { getSettings } from './settingsService.js'
import { fillAndReflowScript } from './moduloFill.js'

const ATTACHMENT_NAME = 'CSA Convenzione Assistenza Tutela - DIP.pdf'

function firstExisting(paths) {
  for (const p of paths) {
    try { if (p && existsSync(p)) return p } catch (_) {}
  }
  return null
}

export function attachmentPath() {
  const p = firstExisting([
    join(process.resourcesPath || '', 'templates', ATTACHMENT_NAME),
    join(app.getAppPath(), 'templates', ATTACHMENT_NAME),
    join(app.getAppPath(), '..', 'templates', ATTACHMENT_NAME),
    join(process.cwd(), 'templates', ATTACHMENT_NAME)
  ])
  if (!p) throw new Error(`Allegato PDF non trovato (templates/${ATTACHMENT_NAME})`)
  return p
}

/** Cartella del template HTML del modulo (contiene page-1/2.xhtml, css, fonts, images). */
export function moduloHtmlDir() {
  const p = firstExisting([
    join(process.resourcesPath || '', 'templates', 'modulo_html'),
    join(app.getAppPath(), 'templates', 'modulo_html'),
    join(app.getAppPath(), '..', 'templates', 'modulo_html'),
    join(process.cwd(), 'templates', 'modulo_html')
  ])
  if (!p) throw new Error('Template HTML del modulo non trovato (templates/modulo_html)')
  return p
}

// CSS che mappa il sistema di coordinate del template (595×842 "px", che sono
// punti a 72dpi = A4) su una pagina A4 reale: Chromium stampa 1px=1/96", quindi
// zoom 96/72 porta il contenuto a riempire l'A4 (595×842 pt).
const A4_STYLE = "@page{size:A4;margin:0} html{zoom:1.3333333}"

async function renderPageToPdf(win, pagePath, data) {
  await win.loadFile(pagePath)
  await win.webContents.executeJavaScript('document.fonts ? document.fonts.ready.then(()=>true) : true')
  // 1) riempimento segnaposto + riflusso (misurato a zoom 1)
  await win.webContents.executeJavaScript(fillAndReflowScript(data))
  // 2) solo dopo, si applica la scala per riempire l'A4
  await win.webContents.executeJavaScript(
    `(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(A4_STYLE)};document.head.appendChild(s);})();true`
  )
  return win.webContents.printToPDF({
    printBackground: true,
    pageSize: 'A4',
    margins: { marginType: 'none' },
    preferCSSPageSize: true
  })
}

/** Renderizza il modulo compilato (pagine 1+2) in un unico buffer PDF A4. */
export async function renderModuloPdf(record, settings) {
  const s = settings || getSettings()
  const data = buildDocxData(record, s.fields, s.prezzi, s.dateOffsetDays)
  const dir = moduloHtmlDir()

  const win = new BrowserWindow({
    show: false,
    webPreferences: { offscreen: true, sandbox: false, javascript: true, images: true }
  })
  try {
    const pageFiles = ['page-1.xhtml', 'page-2.xhtml'].filter((f) => existsSync(join(dir, f)))
    const buffers = []
    for (const f of pageFiles) {
      buffers.push(await renderPageToPdf(win, join(dir, f), data))
    }
    return mergePdfBuffers(buffers)
  } finally {
    win.destroy()
  }
}

/** Unisce più PDF (buffer o path) in un unico documento. */
export async function mergePdfBuffers(inputs) {
  const out = await PDFDocument.create()
  for (const input of inputs) {
    const bytes = Buffer.isBuffer(input) || input instanceof Uint8Array ? input : readFileSync(input)
    const src = await PDFDocument.load(bytes)
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const page of pages) out.addPage(page)
  }
  return Buffer.from(await out.save())
}

/** Crea uno ZIP con il docx e il PDF allegato (rete di sicurezza se il render PDF fallisce). */
export function buildFallbackZip(docxPath, attachmentPdfPath, outPath) {
  const zip = new PizZip()
  zip.file(basename(docxPath), readFileSync(docxPath))
  zip.file(basename(attachmentPdfPath), readFileSync(attachmentPdfPath))
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  writeFileSync(outPath, buf)
  return outPath
}

/**
 * Genera il PDF finale (modulo compilato + allegato) per un record.
 * Non lancia mai: se il render/unione fallisce, produce uno ZIP di ripiego con
 * il .docx e l'allegato, e riporta l'esito nel campo `ok`.
 */
export async function buildFinalPdf(record, settings, docxPath, outDir, baseName) {
  const attachment = attachmentPath()
  try {
    const moduloPdf = await renderModuloPdf(record, settings)
    const finalBytes = await mergePdfBuffers([moduloPdf, attachment])
    const finalPdf = join(outDir, `${baseName}.pdf`)
    writeFileSync(finalPdf, finalBytes)
    return { ok: true, pdfPath: finalPdf }
  } catch (err) {
    try {
      const zipPath = join(outDir, `${baseName}.zip`)
      buildFallbackZip(docxPath, attachment, zipPath)
      return { ok: false, zipPath, error: String(err && err.message || err) }
    } catch (zipErr) {
      return { ok: false, error: `${String(err && err.message || err)} (fallback ZIP fallito: ${zipErr.message})` }
    }
  }
}
