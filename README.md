# CSA Adesioni

Applicazione desktop (Electron) di **ThinkPink Studio** per CSA: compila il
**Modulo di Adesione** (`.docx`) tramite una **maschera con validazione e campi a
tendina**, sia a **inserimento manuale** (quando il flusso non esiste) sia
caricando il **flusso Excel AXA** (polizza 191025). Per ogni aderente produce
**due output**:

1. il **modulo `.docx` compilato** (identico all'originale, modificate solo le compilazioni);
2. un **`.xlsx` a una riga** nello stesso **tracciato AXA** del flusso.

L'accesso avviene tramite **magic link** (deep-link `csadoc://`) sui domini
autorizzati; ogni salvataggio/esportazione è **tracciato** nel Registro attività.

## Sviluppo

```bash
npm install
npm run dev
```

Crea un file `.env.local` (non committato) con SMTP e domini autorizzati:

```
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
ACCEPTED_DOMAINS=dominio1.it,dominio2.it
```

In produzione gli stessi parametri sono modificabili da **Configurazioni → Accesso e SMTP**.

## Build (Windows)

```bash
npm run build                       # bundle electron-vite
npx electron-builder --win          # installer NSIS x64 in dist/
```

La **CI** (`.github/workflows/release.yml`) ad ogni push su `main`: incrementa la
patch in `package.json`, builda su `windows-latest` e pubblica la GitHub Release
con l'`.exe`.

## Record, scadenze e rinnovi

I record salvati vivono nel **database locale** (pagina *Record*): ricerca per
nome/CF/targa/identificativo, click su una riga per aprire la **maschera di
dettaglio** (modifica con bottone), **rinnovo +1 anno** (sposta le date di
copertura e riporta il record «da esportare»), anche in multiselezione.
L'export XLS può creare un file nuovo oppure fare **append in fondo a un XLS
esistente**. La pagina *Scadenze* evidenzia le coperture in scadenza nel **mese
scorso / corrente / prossimo**.

## FTP staging / produzione

In *Configurazioni → FTP* si salvano i dati di connessione (host, porta,
utente, password, cartella remota, FTPS) per **staging** e **produzione**, con
test di connessione. Dopo un'esportazione, dalla pagina *Record* si può
caricare il file sul server con un click (upload tracciato nel Registro).

## Configurazioni

Tutti i campi della maschera sono **configurabili, eliminabili o aggiungibili**
(etichetta, tipo, obbligatorietà, lunghezza, dropdown, colonna del flusso,
segnaposto del modulo, colonna del tracciato). Sono configurabili anche la
**tabella premi** per codice configurazione, lo **scostamento date**, i **domini
autorizzati**, la **durata sessione**, l'**SMTP** e l'**FTP**. Le sezioni sono
**collassabili** (chiuse di default) e ogni salvataggio aggiorna **in tempo
reale** le maschere aperte nelle altre pagine.

L'intera configurazione può essere salvata come **preset con nome**
(*Configurazioni → Configurazioni salvate*): più preset attivabili con un solo
bottone, esportabili/importabili come file **JSON**.

### Date copertura

Il flusso indica la data con la convenzione AXA (la copertura parte dalle **ore
24:00** della data indicata). Nel **tracciato** in uscita la data resta invariata;
nel **modulo** le date di inizio/fine sono stampate **così come sono nel record**
(`dateOffsetDays` default **0**; impostare 1 per stampare la decorrenza reale +1).

## Template del modulo

`templates/modulo_template.docx` è il modulo originale con segnaposto `{{...}}`
(`cognome_nome`, `targa`, `residenza`, `citta`, `cap`, `provincia`,
`codice_fiscale`, `email`, `tel`, `data_inizio`, `data_fine`, `premio`).
Per rigenerarlo dall'originale (`templates/modulo_originale.docx`):

```bash
pip install python-docx
python3 scripts/regen_template.py
```

## Test

```bash
npm test            # node --test su test/*.test.mjs
```

## Struttura

```
src/main/        processo main, protocollo csadoc://, IPC, servizi
src/preload/     bridge contextIsolation
src/renderer/    UI React (Login, Adesioni, Record, Scadenze, Configurazioni, Registro, Contatti)
templates/       modulo originale + template con segnaposto
scripts/         rigenerazione template
```
