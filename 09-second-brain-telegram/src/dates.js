import { FUSO } from './config.js';

// Data e ora correnti nel fuso di Roma, come stringhe.
export function oraRoma(now = new Date()) {
  const parti = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: FUSO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
      weekday: 'short',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    data: `${parti.year}-${parti.month}-${parti.day}`,
    ora: Number(parti.hour),
    minuti: Number(parti.minute),
    giornoSettimana: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parti.weekday),
  };
}

function toUTC(data) {
  const [y, m, d] = data.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fromUTC(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

export function aggiungiGiorni(data, n) {
  return fromUTC(toUTC(data) + n * 86400000);
}

export function differenzaGiorni(da, a) {
  return Math.round((toUTC(a) - toUTC(da)) / 86400000);
}

export function giornoSettimana(data) {
  return new Date(toUTC(data)).getUTCDay();
}

// Converte un orario di Roma ("2026-11-20", "15:00") in ISO UTC.
export function romaToUTC(data, ora) {
  const [h, min] = ora.split(':').map(Number);
  const ipotesi = toUTC(data) + (h * 60 + min) * 60000;
  // Scostamento di Roma in quel momento (1h d'inverno, 2h d'estate)
  const locale = oraRoma(new Date(ipotesi));
  const minutiLocali = toUTC(locale.data) / 60000 + locale.ora * 60 + locale.minuti;
  const scostamento = minutiLocali - ipotesi / 60000;
  return new Date(ipotesi - scostamento * 60000).toISOString().replace('.000', '');
}

const GIORNI = ['domenica', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato'];
const MESI = [
  'gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre',
];

export function dataLeggibile(data, oggi) {
  if (oggi) {
    const diff = differenzaGiorni(oggi, data);
    if (diff === 0) return 'oggi';
    if (diff === 1) return 'domani';
    if (diff === -1) return 'ieri';
    if (diff > 1 && diff < 7) return GIORNI[giornoSettimana(data)];
  }
  const [, m, d] = data.split('-').map(Number);
  return `${GIORNI[giornoSettimana(data)].slice(0, 3)} ${d} ${MESI[m - 1]}`;
}

export function nomeMese(mese) {
  const [y, m] = mese.split('-').map(Number);
  return `${MESI[m - 1]} ${y}`;
}

export { GIORNI, MESI };
