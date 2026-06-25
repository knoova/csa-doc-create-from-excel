# Piano d'azione — CSA · Compilazione Modulo di Adesione dal flusso Excel

**Progetto:** `csa-doc-create-from-excel`
**Cliente finale:** CSA Consulenze & Soluzioni Aziendali S.r.l. (Polizza AXA Partners n° 191025)
**Realizzazione:** ThinkPink Studio
**Data:** 25/06/2026 · Bozza v1

---

## 1. Obiettivo

Oggi, all'attivazione delle coperture, viene generato automaticamente un **flusso Excel** nel tracciato richiesto da AXA Partners; il **Modulo di Adesione** (`.docx`) viene poi compilato a mano. Vogliamo automatizzare quest'ultimo passo: leggere i dati dal flusso, mostrarli in una **maschera con validazione**, e produrre per ogni aderente **due output**:

1. **Modulo di Adesione `.docx` compilato**, graficamente identico all'originale — modificate *solo* le compilazioni.
2. **File `.xlsx` con una sola riga** nello **stesso tracciato AXA** del flusso (intestazione + 1 riga dati), pronto da inviare alla compagnia.

L'app è un'applicazione **desktop Electron** che riusa l'impianto, la grafica e i colori del progetto di riferimento `pdf-data-extractor`, inclusa la pagina **Contatti**.

## 2. Decisioni confermate

| Tema | Scelta |
|------|--------|
| Secondo output XLS | **Tracciato AXA identico** (34 colonne, intestazione + 1 riga dati) |
| Login magic link | **Protocollo custom / deep-link** (`csadoc://auth?token=…`) |
| Compilazione modulo | **Template con segnaposto** (`{{campo}}`), generato una volta, identico all'originale |
| Premio | **Calcolato dal CODICE CONFIGURAZIONE** con tabella prezzi configurabile |

## 3. Architettura e stack

Si riusa quasi integralmente l'impianto di `pdf-data-extractor`:

- **Electron + electron-vite + React 18 + i18next** (IT/EN), `electron-builder`.
- **Design system identico**: `global.css` con i token colore (accent `#e91e8c`, gradient logo, tema scuro/chiaro), titlebar custom, sidebar, card, form, toggle, badge di validazione — già presenti e riutilizzabili.
- **Pagina Contatti**: riusata così com'è (ThinkPink Studio — Via Tito Speri 6, Rosignano Solvay (LI), `info@thinkpinkstudio.it`, P.IVA 02871460347).
- **Pattern già pronti da adattare**: configurazione campi e mapping su celle (`settingsService` / pagina *Polizza*), scrittura Excel da template (`exceljs`), logging persistente (`electron-log` / `diagLogger`), aggiornamenti e versioning, IPC `preload` con `contextBridge`.

**Nuove dipendenze:**

- `docxtemplater` + `pizzip` → compilazione del modulo da template con segnaposto.
- `nodemailer` → invio del magic link via SMTP.
- `exceljs` → già presente, usato per il tracciato in uscita.
- token magic link firmati con HMAC (modulo `crypto` nativo) — nessuna dipendenza extra.

## 4. Flusso utente end-to-end

1. **Login (magic link)** — schermata d'ingresso: l'utente inserisce la mail. Se il dominio è tra quelli ammessi, riceve il link; al click la sessione si attiva per **24 ore**. Finché non autenticato, il resto dell'app è bloccato.
2. **Carica flusso** — selezione del file `191025_aaaammgg.xlsx`. L'app legge le 34 colonne e mostra l'elenco delle righe (aderenti / movimenti) con i dati chiave (Cognome/Nome, targa, configurazione, tipo movimento).
3. **Seleziona riga → Maschera** — la maschera si precompila con i dati della riga. Validazione in tempo reale, campi a tendina dove previsto, evidenziazione errori. L'operatore completa i campi mancanti (es. email/telefono, non presenti nel flusso) e corregge se serve.
4. **Genera output** — con un clic vengono prodotti il `.docx` compilato e l'`.xlsx` a una riga, salvati nella cartella scelta. L'azione viene **loggata**.
5. (Opzionale, fase 2) **Generazione massiva**: produrre i due output per tutte le righe valide del flusso in un colpo solo.

## 5. Login con magic link (deep-link)

**Configurazione** (già in `.env.local`): variabili SMTP e `ACCEPTED_DOMAINS` (`omeganodes.ai`, `csabroker.it`).

**Flusso tecnico:**

1. L'utente inserisce l'email → il **main process** verifica che il dominio sia in `ACCEPTED_DOMAINS` (controllo lato applicazione, non aggirabile dalla UI). Domini non ammessi: messaggio neutro, nessun invio.
2. Si genera un **token firmato HMAC** con: email, timestamp, scadenza (24h) e un *nonce* monouso. Il nonce viene salvato lato app per impedire il riutilizzo del link.
3. **Invio email** via `nodemailer` con le credenziali SMTP di `.env.local`, contenente il link `csadoc://auth?token=…`.
4. Registrazione del **protocollo custom** `csadoc://` (`app.setAsDefaultProtocolClient`, `single-instance lock`, handler `open-url` su macOS e `second-instance` su Windows). Al click del link l'app torna in primo piano e riceve il token.
5. Verifica firma + scadenza + nonce → creazione di una **sessione di 24h** persistita in modo cifrato in `userData`. Allo scadere, ritorno alla schermata di login.
6. **Logout** manuale e indicatore della sessione attiva (email + scadenza).

> Nota: il deep-link è l'opzione più pulita su desktop. In fase di sviluppo, su ambienti dove la registrazione del protocollo non è disponibile, si prevede un *fallback* con inserimento manuale del token/codice dalla mail.

## 6. Maschera dati con validazione

La maschera contiene **tutti i campi del tracciato** (servono per l'XLS in uscita) anche se il modulo ne stampa solo una parte. Regole derivate dalla *Legenda* AXA:

| Campo (tracciato) | Tipo / Controllo | Note |
|---|---|---|
| NUMERO POLIZZA | fisso `191025` | sola lettura |
| LOB | fisso `A` (Motor) | sola lettura |
| TIPOLOGIA POLIZZA | fisso `C` (Collettiva) | sola lettura |
| CODICE CONFIGURAZIONE | **dropdown** `00001` / `00002` / `00003` | guida premio e pacchetto |
| IDENTIFICATIVO UNIVOCO APPLICAZIONE | testo, obbligatorio, max 30 | chiave univoca |
| TIPO OGGETTO ASSICURATO | fisso `2` (Veicolo) | sola lettura |
| CODICE FISCALE / P.IVA | testo, obbligatorio, max 20 | validazione formato CF/P.IVA |
| COGNOME / RAGIONE SOCIALE | testo, obbligatorio, max 20 | |
| NOME | testo, obbligatorio, max 20 | |
| INDIRIZZO RESIDENZA | testo, obbligatorio, max 30 | |
| CAP RESIDENZA | testo, obbligatorio, max 10 | numerico |
| CITTÀ RESIDENZA | testo, obbligatorio, max 30 | |
| PROVINCIA RESIDENZA | testo, obbligatorio, max 5 | sigla |
| TARGA VEICOLO | testo, obbligatorio, max 20 | |
| TELAIO VEICOLO | testo, **facoltativo**, max 20 | |
| MARCA / MODELLO VEICOLO | testo, obbligatorio, max 20 | |
| TIPOLOGIA VEICOLO | **dropdown** `1` auto / `2` moto / `3` truck | |
| PESO VEICOLO | numerico, obbligatorio | in kg (es. `1500,00`) |
| DATA IMMATRICOLAZIONE | data `GG/MM/AAAA`, obbligatoria | |
| DATA INIZIO / FINE VALIDITÀ | data `GG/MM/AAAA`, obbligatoria | vedi §16 (semantica ore 24:00) |
| DATA RENDICONTAZIONE | data `GG/MM/AAAA`, obbligatoria | |
| Questionario IDD ×5 | **dropdown per domanda** | solo per TIPO MOVIMENTO = `A` |
| TIPO MOVIMENTO | **dropdown** `A` / `M` / `E` | A=attivazione, M=modifica, E=cessazione |
| **email** *(solo modulo)* | email, validazione formato | **assente nel flusso** → inserimento manuale |
| **telefono** *(solo modulo)* | telefono | **assente nel flusso** → inserimento manuale |

**Dropdown questionario IDD:** INTERESSE_COPERTURA `S/N` · INTERESSE_SPECIFICO `MO/AF35/VF35/TR/BI` · INTERESSE_SP_LEG `S/N` · MASSIMALI_COERENTI `S/N` · INFO_TECNICHE `S/N`.

La generazione è bloccata finché tutti i campi obbligatori non sono validi (badge verde/rosso come nel progetto di riferimento).

## 7. Mapping flusso → modulo → XLS

Mapping del **modulo** (segnaposto del template):

| Segnaposto modulo | Origine dal flusso |
|---|---|
| `{{cognome_nome}}` | COGNOME/RAGIONE SOCIALE + NOME |
| `{{targa}}` | TARGA VEICOLO |
| `{{residenza}}` | INDIRIZZO RESIDENZA |
| `{{citta}}` | CITTÀ RESIDENZA |
| `{{cap}}` | CAP RESIDENZA |
| `{{provincia}}` | PROVINCIA RESIDENZA |
| `{{codice_fiscale}}` | CODICE FISCALE / P.IVA |
| `{{email}}` | inserito in maschera (non nel flusso) |
| `{{tel}}` | inserito in maschera (non nel flusso) |
| `{{data_inizio}}` | DATA INIZIO VALIDITÀ COPERTURA |
| `{{data_fine}}` | DATA FINE VALIDITÀ COPERTURA |
| `{{premio}}` | calcolato (§8) |

L'**XLS in uscita** riproduce **tutte le 34 colonne** del tracciato con la riga selezionata/validata.

## 8. Premio

Determinato dal **CODICE CONFIGURAZIONE** tramite una **tabella prezzi configurabile** (valori dalle tabelle del modulo):

| Codice | Pacchetto | Premio lordo |
|---|---|---|
| `00001` | A — Assistenza Stradale | `22,50 €` |
| `00002` | B — Tutela Legale | `20,00 €` |
| `00003` | C — Assistenza + Tutela Legale | `39,00 €` |

Il valore popola `{{premio}}`. I prezzi sono editabili nelle Configurazioni (se i premi unitari cambieranno, si aggiornano senza toccare il codice). In opzione si può evidenziare nel modulo il pacchetto applicato.

## 9. Template del modulo con segnaposto

L'originale usa **trattini letterali** come spazi da compilare e ha date/premio **spezzati su più run** di testo: la sostituzione diretta sarebbe fragile. Si procede così:

1. **Una tantum**, si genera un template `modulo_template.docx` a partire dall'originale, sostituendo i blocchi di trattini e i valori d'esempio (date, `00,00`) con singoli segnaposto `{{…}}`, **mantenendo identiche font, dimensioni e posizioni** (si riusano le proprietà dei run esistenti). Il template è versionato nel repo.
2. **A runtime**, `docxtemplater` riempie i segnaposto con i valori validati e produce il `.docx` finale. Nessun'altra parte del documento viene toccata → output identico all'originale, solo compilato.
3. Se in futuro il modulo cambia, basta rigenerare il template (procedura documentata).

## 10. Output XLS — tracciato AXA a una riga

- Scrittura con `exceljs`: **riga 1 = intestazioni** identiche al tracciato, **riga 2 = dati** dell'aderente.
- Date in formato `GG/MM/AAAA`; numerici (peso) come da legenda.
- Le 5 coppie *CODICE DOMANDA/RISPOSTA* valorizzate solo per TIPO MOVIMENTO `A`.
- **Nomenclatura file** secondo legenda: `191025_aaaammgg.xlsx`.
- Entrambi gli output salvati nella stessa cartella, con nomi coerenti per l'aderente.

## 11. Sezione Configurazioni

Tutti i campi sono **configurabili, eliminabili o aggiungibili**, sul modello della pagina *Settings* del riferimento. Per ogni campo: etichetta, colonna sorgente nel flusso, segnaposto nel modulo, colonna nel tracciato in uscita, tipo, obbligatorietà, lunghezza max, valori del dropdown. Inoltre configurabili:

- **Tabella prezzi/pacchetti** (premio per codice configurazione).
- **Valori fissi** (numero polizza, LOB, tipologia polizza, tipo oggetto).
- **Domande/risposte IDD** (testi e codici).
- **Domini ammessi** e parametri sessione (durata) — con valori di default da `.env.local`.
- Aspetto (tema, lingua, colore accento) come nel riferimento.

## 12. Logging / audit

Requisito: **ogni azione di salvataggio o esportazione va loggata.** Si introduce un **audit log append-only** (JSONL in `userData/logs`, oltre a `electron-log`), con per ciascun evento:

- timestamp, **utente** (email di sessione), **azione** (genera DOCX / genera XLS / esporta),
- **identificativo record** (IDENTIFICATIVO UNIVOCO, CF, targa),
- file prodotti e percorso, esito (ok/errore).

Pagina **"Registro attività"** per consultare/esportare il log (utile anche come prova di conformità).

## 13. CI/CD — GitHub Actions (build solo Windows)

Si riusa il workflow del riferimento (`.github/workflows/release.yml`), già conforme alla richiesta:

- **Trigger:** `push` su `main`.
- **bump:** incremento automatico della *patch* in `package.json`, commit `chore: bump version` e push (con guardia anti-loop).
- **build:** matrice **solo `windows-latest`**, `npm ci` → `electron-vite build` → `electron-builder --win` (installer **NSIS x64**), upload artifact.
- **release:** creazione automatica della GitHub Release con tag versione e allegato `.exe`.

Adattamenti: `appId`/`productName` del nuovo progetto, icona, nome release.

## 14. Struttura del progetto

```
src/
  main/
    index.js                  # finestra, protocollo csadoc://, single-instance, gate auth
    ipc/handlers.js
    services/
      authService.js          # token HMAC, nonce, sessione 24h
      mailService.js          # nodemailer (SMTP da .env.local)
      flussoService.js        # parsing xlsx tracciato (exceljs)
      docxService.js          # docxtemplater: template -> docx compilato
      xlsxFlussoWriter.js      # scrittura tracciato 1 riga (exceljs)
      premioService.js        # tabella prezzi -> premio
      auditLogger.js          # log append-only azioni save/export
      settingsService.js      # configurazioni campi/prezzi/domini
  preload/index.js            # contextBridge: auth, flusso, genera, settings, log
  renderer/src/
    pages/  Login · Adesioni(flusso+maschera) · Configurazioni · Registro · Contatti
    components/ Sidebar · TitleBar · campi maschera + validazione
    styles/global.css         # riuso design system
templates/ modulo_template.docx
.github/workflows/release.yml
```

## 15. Sicurezza & GDPR

- **Dati personali** (CF, targa, indirizzi): trattati e salvati **in locale**; nessun invio a terzi oltre l'SMTP per il solo magic link.
- **`.env.local` con credenziali SMTP**: va inserito in `.gitignore` e **non committato**. ⚠️ Le credenziali attualmente presenti nel repo andrebbero **ruotate** (nuova *app password*) e gestite come segreto, dato che il file è già nella cartella di lavoro.
- **Token magic link** firmati e **monouso**, con scadenza; segreto di firma in `userData`, non nel codice.
- **Allowlist dei domini** applicata lato main process.
- Audit log conservato localmente; definire una *retention* (come il `sessionRetentionDays` del riferimento).

## 16. Fasi di sviluppo

1. **Scaffold**: clonare l'impianto del riferimento, rinominare app/icone, riusare design system e pagina Contatti.
2. **Login magic link**: SMTP, token, protocollo `csadoc://`, sessione 24h, gate UI.
3. **Lettura flusso**: parsing 34 colonne, elenco righe.
4. **Maschera + validazione**: campi, dropdown, regole, badge.
5. **Configurazioni**: campi/prezzi/domini editabili.
6. **Template modulo**: generazione del template con segnaposto + compilazione `docxtemplater`.
7. **Output XLS**: tracciato a una riga, nomenclatura file.
8. **Premio** da codice configurazione.
9. **Audit log** + pagina Registro.
10. **CI/CD** Windows.
11. **Verifica/test** (vedi sotto).

**Verifica e collaudo:**

- Test automatici sul parsing del flusso e sulla scrittura del tracciato (round-trip: flusso → record → XLS).
- **Confronto diff** tra il `.docx` compilato e l'originale per garantire che cambino *solo* le compilazioni.
- Validazione campi con casi limite (lunghezze, date, CF, movimenti `M`/`E` senza questionario).
- Prova end-to-end del magic link (dominio ammesso/non ammesso, link scaduto, riuso bloccato).
- Verifica che ogni generazione/esportazione produca una voce di audit.

## 17. Punti aperti da confermare

1. **Semantica date** — la legenda dice che la copertura parte dalle **ore 24:00** della data indicata (per attivare il 01/11 si scrive 31/10). Nel **modulo** mostriamo la data del flusso *così com'è*, oppure la **data reale di decorrenza** (+1 giorno)? (Default proposto: come nel flusso.)
2. **Movimenti `M` (modifica) ed `E` (cessazione)** — generiamo un modulo anche per questi, o **solo per le attivazioni `A`**? (Il questionario IDD vale solo per `A`.)
3. **Generazione massiva** — serve produrre i due output per **tutte** le righe del flusso in blocco, oltre alla modalità singola? (Proposto come fase 2.)
4. **Cartella di output** e regola di **denominazione del `.docx`** (es. `Adesione_COGNOME_targa.docx`): preferenze?
5. **Telaio/email/telefono** — confermare che email e telefono restano inserimento manuale (non presenti nel flusso) e che il telaio resta facoltativo.
6. **Mittente email** del magic link: usiamo `info@thinkpinkstudio.it` (attuale in `.env.local`) o una casella CSA dedicata?

---

*Documento di pianificazione. Alla conferma dei punti del §17 si procede con lo scaffold (fase 1).*
