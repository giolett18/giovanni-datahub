# Second brain: Todoist + bot Telegram

Un assistente personale che tiene in ordine lavoro, studio e vita privata. Scrivo un'attività su Telegram in linguaggio naturale, il bot la mette nel progetto giusto di Todoist con la priorità calcolata, e ogni mattina alle 8 mi manda il piano del giorno ordinato per urgenza.

**Strumenti:** JavaScript, Cloudflare Workers (cron + KV), API Todoist v1, API Bot Telegram, GitHub Actions.

## Cosa fa

- **Inserimento in linguaggio naturale.** `gts: report per Rossi entro giovedì, importante @capo` diventa un'attività nel progetto GTS, con scadenza giovedì e priorità P1.
- **Priorità automatica (P1–P4)** calcolata su tre fattori: quanto è vicina la scadenza, l'importanza dichiarata (urgente, importante) e chi la chiede (@capo, @cliente).
- **Piano del giorno alle 8:00** diviso per area: riempie 6 ore di lavoro e 2 di studio partendo da scadute e in scadenza oggi, poi aggiunge le più urgenti dei prossimi giorni finché c'è tempo. Avvisa se il carico supera le ore disponibili.
- **Avvisi di scadenza** 3 giorni e 1 giorno prima.
- **Resoconto settimanale** il lunedì: attività completate, scadute ancora aperte, scadenze della settimana, spese.
- **Entrate e uscite** con `/spesa 40 benzina` e `/entrata 1500 stipendio`, riepilogo per categoria con `/mese` e in automatico il 1° di ogni mese.
- **Attività ricorrenti** con `ogni lunedì`, `ogni mese il 10` e simili.

## Struttura in Todoist

Il comando `/setup` crea tutto in un colpo:

```
Lavoro            (sezione Imprevisti)
├── GTS
├── Enel X
└── Bando REN
Studio
├── Tesi e piano di studi
└── <un progetto per esame, con /esame>   (sezioni Lezioni, Esercitazioni, Esame)
Personale
├── Finanze       (Entrate, Uscite, Bollette ricorrenti)
├── Scadenze      (Documenti, Assicurazioni, Tasse)
└── Famiglia
Etichette: @capo @cliente @veloce
```

Per cambiare aree, ore o prefissi basta modificare [`src/config.js`](src/config.js).

## Come si scrive un'attività

| Messaggio | Risultato |
|---|---|
| `gts: inviare offerta domani alle 10 @capo` | GTS · domani 10:00 · P1 |
| `imprevisto: richiamare fornitore oggi` | Lavoro › Imprevisti · oggi · P1 |
| `enel: preparare slide per il cliente` | Enel X · senza data · P4 |
| `studio: ripassare capitolo 3 domani 1h` | Studio · domani · 60 min |
| `scadenze: rinnovo assicurazione 20/11` | Scadenze · 20 novembre |
| `bolletta: pagare luce ogni mese il 10` | Finanze › Bollette ricorrenti · ricorrente |
| `rispondere a Bianchi 10 min` | Inbox · @veloce |

Date riconosciute: oggi, stasera, domani, dopodomani, giorni della settimana, 25 novembre, 25/11, il 25, tra 3 giorni, fra due settimane, alle 15. Se il bot capisce male, `/annulla` elimina l'ultima attività.

## Comandi

`/oggi` · `/urgenti` · `/fatto 2` (o `/fatto report`) · `/annulla` · `/spesa` · `/entrata` · `/annullamovimento` · `/mese` · `/settimana` · `/esame Nome` · `/setup` · `/aiuto`

## Attivazione passo passo

Tutto gratuito. Serve circa mezz'ora e nessuna installazione sul computer. Le chiavi vanno solo nei segreti di GitHub, mai in chat.

**1. Todoist**
1. Crea un account su [todoist.com](https://todoist.com).
2. In *Impostazioni › Generali* imposta lingua **Italiano** e fuso orario **Roma**.
3. In *Impostazioni › Integrazioni › Sviluppatore* copia il **token API**. Tienilo pronto per il punto 4.

**2. Bot Telegram**
1. Su Telegram cerca **@BotFather** e scrivi `/newbot`.
2. Scegli un nome (es. *Second Brain*) e un username che finisce con `bot` (es. *giovanni_brain_bot*).
3. BotFather risponde con un **token**: copialo.

**3. Cloudflare** (qui gira il bot, sempre acceso)
1. Crea un account gratuito su [dash.cloudflare.com](https://dash.cloudflare.com/sign-up).
2. Apri *Workers & Pages* una volta: ti chiede di scegliere il tuo sottodominio `workers.dev`.
3. Copia l'**Account ID** (nella pagina *Workers & Pages*, colonna a destra).
4. Vai su *My Profile › API Tokens › Create Token*, scegli il modello **Edit Cloudflare Workers**, poi *Continue to summary › Create Token*, e copia il token.

**4. GitHub**
Nel repository apri *Settings › Secrets and variables › Actions › New repository secret* e crea questi quattro segreti:

| Nome | Valore |
|---|---|
| `TODOIST_TOKEN` | token API di Todoist |
| `TELEGRAM_TOKEN` | token di BotFather |
| `CLOUDFLARE_API_TOKEN` | token API di Cloudflare |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID di Cloudflare |

Poi vai su *Actions › Deploy second brain › Run workflow*. In un paio di minuti il bot è online (parte da solo anche a ogni modifica del codice su `main`).

**5. Primo avvio**
1. Apri il tuo bot su Telegram e scrivi `/start`. Il bot da quel momento risponde solo a te.
2. Scrivi `/setup` per creare la struttura in Todoist.
3. Per ogni esame del semestre: `/esame Nome dell'esame`.

Da domani alle 8:00 arriva il primo piano del giorno.

## Come funziona

- `src/index.js` riceve i messaggi da Telegram (webhook protetto da un segreto derivato dal token) e gestisce i promemoria. Il cron gira alle 6:00 e alle 7:00 UTC e agisce solo quando a Roma sono le 8, così l'orario resta giusto sia con l'ora legale sia con quella solare.
- `src/parse.js` interpreta il testo: progetto dal prefisso, date in italiano, durata, etichette, importanza e punteggio di urgenza.
- `src/reports.js` costruisce piano del giorno, urgenze, avvisi e resoconto settimanale.
- `src/finance.js` registra entrate e uscite in Cloudflare KV, una chiave per mese.
- I test (`npm test`) simulano Todoist e Telegram e provano l'intero flusso, dal `/setup` ai promemoria.
