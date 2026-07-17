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

Crea un file `.env.local` (non committato) con SMTP, domini autorizzati e (opzionale) i profili FTP:

```
SMTP_HOST=...
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=...
ACCEPTED_DOMAINS=dominio1.it,dominio2.it

# FTP/SFTP precaricato a build-time (sovrascrivibile in app)
# PROTOCOL: ftp | ftps | sftp  (se omesso, SECURE=true → ftps, altrimenti ftp)
FTP_STAGING_PROTOCOL=ftp
FTP_STAGING_HOST=...
FTP_STAGING_PORT=21
FTP_STAGING_USER=...
FTP_STAGING_PASS=...
FTP_STAGING_SECURE=false
FTP_STAGING_DIR=/public_html/export
FTP_PROD_PROTOCOL=sftp
FTP_PROD_HOST=...
FTP_PROD_PORT=22
FTP_PROD_USER=...
FTP_PROD_PASS=...
FTP_PROD_DIR=/upload
# SFTP con chiave: chiave privata (OpenSSH PEM o PuTTY .ppk) in Base64 + passphrase.
# In .env.local usa Base64 (una riga): base64 -w0 chiave.ppk
FTP_PROD_KEY=<chiave-in-base64>
FTP_PROD_PASSPHRASE=...

# Riepiloghi esportazione (opzionale): mailbox condivisa di override
EXPORT_NOTIFY_SHARED=esportazioni@azienda.it
EXPORT_NOTIFY_MODE=user   # user | shared | both
```

In produzione gli stessi parametri sono modificabili da **Configurazioni → Accesso e SMTP** e **Configurazioni → FTP**. I valori `.env.local`/build fanno solo da **default precaricati**: qualsiasi modifica salvata in app li sovrascrive.

## Build (Windows)

```bash
npm run build                       # bundle electron-vite
npx electron-builder --win          # installer NSIS x64 in dist/
```

La **CI** (`.github/workflows/release.yml`) ad ogni push su `main`: incrementa la
patch in `package.json`, builda su `windows-latest` e pubblica la GitHub Release
con l'`.exe`.

### Configurazione build via GitHub (Settings → Secrets and variables → Actions)

I valori vengono "bakati" nella build dai **Repository variables/secrets**. Campi
non sensibili come **Variables**, credenziali come **Secrets**:

| Variables (non sensibili) | Secrets (sensibili) |
| --- | --- |
| `FTP_STAGING_PROTOCOL` `FTP_STAGING_HOST` `FTP_STAGING_PORT` `FTP_STAGING_USER` `FTP_STAGING_SECURE` `FTP_STAGING_DIR` | `FTP_STAGING_PASS` `FTP_STAGING_KEY` `FTP_STAGING_PASSPHRASE` |
| `FTP_PROD_PROTOCOL` `FTP_PROD_HOST` `FTP_PROD_PORT` `FTP_PROD_USER` `FTP_PROD_SECURE` `FTP_PROD_DIR` | `FTP_PROD_PASS` `FTP_PROD_KEY` `FTP_PROD_PASSPHRASE` |
| `EXPORT_NOTIFY_MODE` (`user`/`shared`/`both`) | `EXPORT_NOTIFY_SHARED` |

`FTP_*_PROTOCOL` = `ftp` | `ftps` | `sftp`. Per **SFTP** imposta `PROTOCOL=sftp`,
`PORT=22` e incolla il **contenuto della chiave** (`.ppk` o PEM) nel Secret
`FTP_*_KEY` **così com'è, multiriga — nessun Base64 in CI** — più la passphrase in
`FTP_*_PASSPHRASE`. Sono tutti facoltativi e comunque **sovrascrivibili** da
*Configurazioni → FTP* nell'app.

## Record, scadenze e rinnovi

I record salvati vivono nel **database locale** (pagina *Record*): ricerca per
nome/CF/targa/identificativo, click su una riga per aprire la **maschera di
dettaglio** (modifica con bottone), **rinnovo +1 anno** (sposta le date di
copertura e riporta il record «da esportare»), anche in multiselezione.
L'export XLS può creare un file nuovo oppure fare **append in fondo a un XLS
esistente**. La pagina *Scadenze* evidenzia le coperture in scadenza nel **mese
scorso / corrente / prossimo**.

## FTP staging / produzione

In *Configurazioni → FTP* si salvano i dati di connessione per **staging** e
**produzione**, con test di connessione. Ogni profilo supporta tre protocolli:
**FTP**, **FTPS** (FTP su TLS) e **SFTP** (SSH). Per SFTP l'autenticazione può
avvenire con **chiave privata** (formato OpenSSH PEM o PuTTY **`.ppk`**, anche
cifrata con passphrase) oppure con password. I profili possono essere
**precaricati a build-time** dalle env var `FTP_STAGING_*` / `FTP_PROD_*`
(GitHub Secrets in CI) e restano comunque **sovrascrivibili** dall'app. Dopo
un'esportazione, dalla pagina *Record* si può caricare il file sul server con un
click (upload tracciato nel Registro).

## Esportazione del singolo record e notifiche email

Ogni record può essere esportato **singolarmente** dalla **colonna Azioni** in
fondo alla tabella *Record* o dal pulsante **Esporta** nella maschera di
dettaglio — anche se **già archiviato** (ri-esportazione senza cambio di stato).

A ogni **esportazione** o **upload FTP** viene inviata una **email di riepilogo**
con il foglio XLS in allegato, indirizzata di default all'**utente collegato**
(il suo username è la sua email). In *Configurazioni → Accesso e SMTP* si può
disattivare la notifica o impostare una **mailbox condivisa** come override
(destinatario *utente*, *condivisa* o *entrambi*).

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
