/**
 * Conversione del modulo .docx compilato in PDF e unione con l'allegato fisso
 * "CSA Convenzione Assistenza Tutela - DIP.pdf" in un unico documento.
 *
 * Motore primario: `mammoth` (docx → HTML, JS puro) renderizzato in una
 * BrowserWindow nascosta e stampato in PDF con `webContents.printToPDF`, API
 * nativa di Electron/Chromium — nessun processo esterno né automazione di
 * altre applicazioni. Se fallisce (docx non interpretabile da mammoth), si
 * ripiega su LibreOffice headless, se presente. Se anche questo fallisce,
 * invece di bloccare il salvataggio si produce uno ZIP con il .docx e il PDF
 * allegato, così l'operatore ha comunque tutto il necessario da inviare a mano.
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'fs'
import { join, basename, dirname } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'
import { app, BrowserWindow } from 'electron'
import mammoth from 'mammoth'
import PizZip from 'pizzip'
import { PDFDocument } from 'pdf-lib'

export function attachmentPath() {
  const candidates = [
    join(process.resourcesPath || '', 'templates', 'CSA Convenzione Assistenza Tutela - DIP.pdf'),
    join(app.getAppPath(), 'templates', 'CSA Convenzione Assistenza Tutela - DIP.pdf'),
    join(app.getAppPath(), '..', 'templates', 'CSA Convenzione Assistenza Tutela - DIP.pdf'),
    join(process.cwd(), 'templates', 'CSA Convenzione Assistenza Tutela - DIP.pdf')
  ]
  for (const p of candidates) {
    try { if (p && existsSync(p)) return p } catch (_) {}
  }
  throw new Error('Allegato PDF non trovato (templates/CSA Convenzione Assistenza Tutela - DIP.pdf)')
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: 60000, ...opts }, (err, stdout, stderr) => {
      if (err) reject(new Error(`${err.message}${stderr ? `\n${stderr}` : ''}`))
      else resolve(stdout)
    })
  })
}

const PRINT_HTML_STYLE = `
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; font-size: 12pt; color: #111; padding: 32px; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #333; padding: 4px 8px; }
  p { margin: 0 0 8px; }
`

/** Converte il docx in PDF con mammoth (docx → HTML) + printToPDF di Electron (nessun processo esterno). */
async function convertWithMammothPrint(docxPath, pdfOutPath) {
  const { value: bodyHtml } = await mammoth.convertToHtml({ path: docxPath })
  const fullHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${PRINT_HTML_STYLE}</style></head><body>${bodyHtml}</body></html>`

  const tmpDir = mkdtempSync(join(tmpdir(), 'csa-mammoth-'))
  const htmlPath = join(tmpDir, 'modulo.html')
  writeFileSync(htmlPath, fullHtml, 'utf-8')

  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false } })
  try {
    await win.loadFile(htmlPath)
    const pdfBuffer = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4' })
    writeFileSync(pdfOutPath, pdfBuffer)
  } finally {
    win.destroy()
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch (_) {}
  }
  if (!existsSync(pdfOutPath)) throw new Error('printToPDF non ha prodotto il PDF atteso')
}

function resolveSofficeBin() {
  const candidates = [
    'soffice',
    'libreoffice',
    'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
    'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
    '/usr/bin/soffice',
    '/opt/libreoffice/program/soffice'
  ]
  return candidates
}

/** Converte il docx in PDF con LibreOffice headless (fallback multipiattaforma). */
async function convertWithLibreOffice(docxPath, pdfOutPath) {
  const outDir = dirname(pdfOutPath)
  let lastErr = null
  for (const bin of resolveSofficeBin()) {
    try {
      await run(bin, ['--headless', '--convert-to', 'pdf', '--outdir', outDir, docxPath])
      const produced = join(outDir, basename(docxPath).replace(/\.docx$/i, '.pdf'))
      if (existsSync(produced)) {
        if (produced !== pdfOutPath) {
          writeFileSync(pdfOutPath, readFileSync(produced))
          try { rmSync(produced) } catch (_) {}
        }
        return
      }
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr || new Error('LibreOffice non trovato')
}

/** Converte il docx compilato in PDF: mammoth+printToPDF (nessuna dipendenza esterna), con fallback a LibreOffice headless se presente. */
export async function convertDocxToPdf(docxPath, pdfOutPath) {
  const errors = []
  try {
    await convertWithMammothPrint(docxPath, pdfOutPath)
    return
  } catch (err) {
    errors.push(`Mammoth: ${err.message}`)
  }
  try {
    await convertWithLibreOffice(docxPath, pdfOutPath)
    return
  } catch (err) {
    errors.push(`LibreOffice: ${err.message}`)
  }
  throw new Error(`Impossibile generare il PDF. Dettagli: ${errors.join(' · ')}`)
}

/** Unisce due PDF (base + allegato in coda) in un unico file. */
export async function mergePdfs(basePdfPath, attachmentPdfPath, outPath) {
  const out = await PDFDocument.create()
  for (const p of [basePdfPath, attachmentPdfPath]) {
    const src = await PDFDocument.load(readFileSync(p))
    const pages = await out.copyPages(src, src.getPageIndices())
    for (const page of pages) out.addPage(page)
  }
  const bytes = await out.save()
  writeFileSync(outPath, bytes)
  return outPath
}

/** Crea uno ZIP con il docx e il PDF allegato, da usare quando la conversione/unione in PDF non è riuscita. */
export function buildFallbackZip(docxPath, attachmentPdfPath, outPath) {
  const zip = new PizZip()
  zip.file(basename(docxPath), readFileSync(docxPath))
  zip.file(basename(attachmentPdfPath), readFileSync(attachmentPdfPath))
  const buf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  writeFileSync(outPath, buf)
  return outPath
}

/**
 * Genera il PDF finale (modulo compilato + allegato) a partire dal docx appena
 * creato. Non lancia mai: se la conversione/unione fallisce, produce uno ZIP
 * di ripiego con il .docx e l'allegato, e ritorna l'esito nel campo `ok`.
 */
export async function buildFinalPdf(docxPath, outDir, baseName) {
  const attachment = attachmentPath()
  const tmpDir = mkdtempSync(join(tmpdir(), 'csa-pdf-'))
  const tmpPdf = join(tmpDir, `${baseName}.pdf`)
  try {
    await convertDocxToPdf(docxPath, tmpPdf)
    const finalPdf = join(outDir, `${baseName}.pdf`)
    await mergePdfs(tmpPdf, attachment, finalPdf)
    return { ok: true, pdfPath: finalPdf }
  } catch (err) {
    try {
      const zipPath = join(outDir, `${baseName}.zip`)
      buildFallbackZip(docxPath, attachment, zipPath)
      return { ok: false, zipPath, error: err.message }
    } catch (zipErr) {
      return { ok: false, error: `${err.message} (fallback ZIP fallito: ${zipErr.message})` }
    }
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }) } catch (_) {}
  }
}
