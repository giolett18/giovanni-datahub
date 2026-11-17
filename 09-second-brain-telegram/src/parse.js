// Trasforma un messaggio in linguaggio naturale in un'attività Todoist.
// Esempio: "gts: report per Rossi entro giovedì alle 15, importante @capo"

import { ALIAS } from './config.js';
import { aggiungiGiorni, differenzaGiorni, giornoSettimana, GIORNI, MESI } from './dates.js';

const GIORNO_RE = '(luned[iì]|marted[iì]|mercoled[iì]|gioved[iì]|venerd[iì]|sabato|domenica)';
const MESE_RE = `(${MESI.join('|')})`;
const ORA_RE = '(?:\\s+(?:alle|ore|h)\\s*(\\d{1,2})(?:[:.](\\d{2}))?)?';
const PREP_RE = '(?:\\b(?:entro|per|il|di|da fare|scade|scadenza)\\s+)?';

function normalizzaGiorno(g) {
  return g.toLowerCase().replace(/i$/, 'ì').replace('domenicì', 'domenica').replace('sabatì', 'sabato');
}

function ora(h, m) {
  if (h === undefined) return null;
  const hh = Number(h);
  if (hh > 23) return null;
  return `${String(hh).padStart(2, '0')}:${m ?? '00'}`;
}

// Cerca un'espressione di data. Restituisce { data, ora, ricorrente, testo } oppure null.
export function estraiData(testo, oggi) {
  const t = testo;
  let m;

  // Ricorrenze: "ogni lunedì", "ogni giorno", "ogni mese il 5", "ogni 2 settimane"
  m = t.match(new RegExp(`${PREP_RE}\\bogni\\s+(?:giorno|settimana|mese|anno|giorno lavorativo|\\d+\\s+\\w+|${GIORNO_RE}|primo\\s+\\w+|ultimo\\s+\\w+)(?![\\p{L}\\d])(?:\\s+(?:il\\s+)?\\d{1,2})?${ORA_RE}`, 'iu'));
  if (m) {
    const ricorrenza = m[0].replace(new RegExp(`^${PREP_RE}`, 'i'), '').trim();
    return { ricorrente: ricorrenza, data: null, ora: null, testo: m[0] };
  }

  // oggi / stasera / domani / dopodomani
  m = t.match(new RegExp(`${PREP_RE}\\b(oggi|stasera|domani|dopodomani)\\b${ORA_RE}`, 'i'));
  if (m) {
    const parola = m[1].toLowerCase();
    const offset = { oggi: 0, stasera: 0, domani: 1, dopodomani: 2 }[parola];
    const h = ora(m[2], m[3]) ?? (parola === 'stasera' ? '20:00' : null);
    return { data: aggiungiGiorni(oggi, offset), ora: h, testo: m[0] };
  }

  // tra/fra N giorni|settimane|mesi
  m = t.match(new RegExp(`${PREP_RE}\\b(?:tra|fra)\\s+(\\d+|un|una|due|tre)\\s+(giorn[oi]|settiman[ae]|mes[ei])\\b${ORA_RE}`, 'i'));
  if (m) {
    const n = { un: 1, una: 1, due: 2, tre: 3 }[m[1].toLowerCase()] ?? Number(m[1]);
    const unita = m[2].toLowerCase();
    let data;
    if (unita.startsWith('giorn')) data = aggiungiGiorni(oggi, n);
    else if (unita.startsWith('settiman')) data = aggiungiGiorni(oggi, n * 7);
    else data = aggiungiMesi(oggi, n);
    return { data, ora: ora(m[3], m[4]), testo: m[0] };
  }

  // 25 novembre (2026)
  m = t.match(new RegExp(`${PREP_RE}\\b(\\d{1,2})\\s+${MESE_RE}(?:\\s+(\\d{4}))?${ORA_RE}`, 'i'));
  if (m) {
    const mese = MESI.indexOf(m[2].toLowerCase()) + 1;
    const data = dataFutura(oggi, Number(m[1]), mese, m[3] && Number(m[3]));
    if (data) return { data, ora: ora(m[4], m[5]), testo: m[0] };
  }

  // 25/11 o 25/11/2026
  m = t.match(new RegExp(`${PREP_RE}\\b(\\d{1,2})[/.-](\\d{1,2})(?:[/.-](\\d{2,4}))?\\b${ORA_RE}`, 'i'));
  if (m) {
    let anno = m[3] && Number(m[3]);
    if (anno && anno < 100) anno += 2000;
    const data = dataFutura(oggi, Number(m[1]), Number(m[2]), anno);
    if (data) return { data, ora: ora(m[4], m[5]), testo: m[0] };
  }

  // giovedì (prossimo)
  m = t.match(new RegExp(`${PREP_RE}\\b${GIORNO_RE}(?:\\s+prossimo)?(?![\\p{L}\\d])${ORA_RE}`, 'iu'));
  if (m) {
    const target = GIORNI.indexOf(normalizzaGiorno(m[1]));
    const diff = (target - giornoSettimana(oggi) + 7) % 7;
    return { data: aggiungiGiorni(oggi, diff), ora: ora(m[2], m[3]), testo: m[0] };
  }

  // "il 25" (prossimo giorno 25)
  m = t.match(new RegExp(`\\b(?:entro|per)?\\s*il\\s+(\\d{1,2})\\b(?!\\s*(?:min|h|ore|€|euro))${ORA_RE}`, 'i'));
  if (m) {
    const giorno = Number(m[1]);
    const [y, mm] = oggi.split('-').map(Number);
    let data = dataFutura(oggi, giorno, mm, y);
    if (!data || differenzaGiorni(oggi, data) < 0) data = dataFutura(oggi, giorno, mm === 12 ? 1 : mm + 1, mm === 12 ? y + 1 : y);
    if (data) return { data, ora: ora(m[2], m[3]), testo: m[0] };
  }

  // solo orario: "alle 15" significa oggi
  m = t.match(/\b(?:alle|ore)\s+(\d{1,2})(?:[:.](\d{2}))?\b/i);
  if (m && ora(m[1], m[2])) return { data: oggi, ora: ora(m[1], m[2]), testo: m[0] };

  return null;
}

function aggiungiMesi(data, n) {
  const [y, m, d] = data.split('-').map(Number);
  const totale = m - 1 + n;
  const anno = y + Math.floor(totale / 12);
  const mese = (totale % 12) + 1;
  const ultimo = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  return `${anno}-${String(mese).padStart(2, '0')}-${String(Math.min(d, ultimo)).padStart(2, '0')}`;
}

function valida(y, m, d) {
  if (m < 1 || m > 12 || d < 1) return null;
  const ultimo = new Date(Date.UTC(y, m, 0)).getUTCDate();
  if (d > ultimo) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Data con anno esplicito, oppure la prossima occorrenza di giorno/mese.
function dataFutura(oggi, giorno, mese, anno) {
  const annoCorrente = Number(oggi.slice(0, 4));
  if (anno) return valida(anno, mese, giorno);
  const questAnno = valida(annoCorrente, mese, giorno);
  if (questAnno && differenzaGiorni(oggi, questAnno) >= 0) return questAnno;
  return valida(annoCorrente + 1, mese, giorno);
}

// "30 min", "1h", "2 ore", "1,5 ore"
export function estraiDurata(testo) {
  let m = testo.match(/\b(\d+)\s*(?:min|minuti|m)\b/i);
  if (m) return { minuti: Number(m[1]), testo: m[0] };
  m = testo.match(/\b(\d+(?:[.,]\d+)?)\s*(?:h|ore|ora)\b/i);
  if (m) return { minuti: Math.round(Number(m[1].replace(',', '.')) * 60), testo: m[0] };
  return null;
}

// Importanza dichiarata nel testo
export function estraiImportanza(testo) {
  const m = testo.match(/[,;\-–]?\s*\b(urgentissim[oa]|urgente|subito|asap|importantissim[oa]|importante|non urgente|bassa priorit[aà]|quando posso)\b/i);
  if (!m) return { livello: 0, testo: null };
  const parola = m[1].toLowerCase();
  if (/^(urgent|subito|asap)/.test(parola)) return { livello: 4, testo: m[0] };
  if (/^important/.test(parola)) return { livello: 2, testo: m[0] };
  return { livello: -1, testo: m[0] };
}

// Prefisso "progetto: testo". Accetta gli alias e i nomi di progetti e sezioni esistenti.
// destinazioni: [{ nome, progetto, sezione }]
export function estraiProgetto(testo, destinazioni = []) {
  const vuoto = { progetto: null, sezione: null, resto: testo, urgente: false };
  const m = testo.match(/^\s*([^:\n]{2,40}?)\s*:\s*(.+)$/s);
  if (!m) return vuoto;
  const chiave = m[1].toLowerCase().trim();
  let regola = ALIAS[chiave];
  if (!regola) {
    const n = (d) => d.nome.toLowerCase();
    const dest = destinazioni.find((d) => n(d) === chiave)
      ?? destinazioni.find((d) => chiave.endsWith(n(d)))
      ?? (chiave.length >= 3 ? destinazioni.find((d) => n(d).includes(chiave)) : null);
    if (dest) regola = { progetto: dest.progetto, sezione: dest.sezione };
    else {
      // "lavoro gts" → usa l'ultima parola se è un alias
      const parole = chiave.split(/\s+/);
      regola = ALIAS[parole[parole.length - 1]];
    }
  }
  if (!regola) return vuoto;
  return { progetto: regola.progetto, sezione: regola.sezione ?? null, resto: m[2], urgente: !!regola.urgente };
}

// Punteggio di urgenza: scadenza + importanza + chi la chiede.
export function punteggio({ giorniAllaScadenza = null, importanza = 0, etichette = [], urgente = false }) {
  let p = 0;
  if (giorniAllaScadenza !== null) {
    if (giorniAllaScadenza <= 0) p += 3;
    else if (giorniAllaScadenza === 1) p += 2;
    else if (giorniAllaScadenza <= 3) p += 1;
  }
  p += Math.max(importanza, 0);
  if (importanza < 0) p -= 1;
  if (etichette.includes('capo')) p += 2;
  if (etichette.includes('cliente')) p += 2;
  if (urgente) p += 2;
  return p;
}

// Punteggio → priorità Todoist visibile (1 = P1, la più urgente)
export function priorita(p) {
  if (p >= 4) return 1;
  if (p >= 3) return 2;
  if (p >= 1) return 3;
  return 4;
}

// L'API Todoist usa la scala inversa: 4 = P1, 1 = P4.
export const versoApi = (p) => 5 - p;
export const daApi = (p) => 5 - p;

export function analizzaMessaggio(testo, oggi, destinazioni = []) {
  const prog = estraiProgetto(testo, destinazioni);
  let resto = prog.resto;

  const etichette = [...resto.matchAll(/(?:^|\s)@([\p{L}\d_-]+)/gu)].map((m) => m[1].toLowerCase());
  resto = resto.replace(/(?:^|\s)@[\p{L}\d_-]+/gu, ' ');

  const imp = estraiImportanza(resto);
  if (imp.testo) resto = resto.replace(imp.testo, ' ');

  const durata = estraiDurata(resto);
  if (durata) resto = resto.replace(durata.testo, ' ');
  if (durata && durata.minuti <= 15 && !etichette.includes('veloce')) etichette.push('veloce');

  const data = estraiData(resto, oggi);
  if (data) resto = resto.replace(data.testo, ' ');

  const contenuto = resto
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;])/g, '$1')
    .replace(/^[\s,;.\-–]+|[\s,;\-–]+$/g, '')
    .trim();

  const giorni = data?.data ? differenzaGiorni(oggi, data.data) : null;
  const p = punteggio({ giorniAllaScadenza: giorni, importanza: imp.livello, etichette, urgente: prog.urgente });

  return {
    contenuto: contenuto ? contenuto[0].toUpperCase() + contenuto.slice(1) : testo.trim(),
    progetto: prog.progetto,
    sezione: prog.sezione,
    etichette,
    data: data?.data ?? null,
    ora: data?.ora ?? null,
    ricorrente: data?.ricorrente ?? null,
    durata: durata?.minuti ?? null,
    importanza: imp.livello,
    urgente: prog.urgente,
    priorita: priorita(p),
  };
}
