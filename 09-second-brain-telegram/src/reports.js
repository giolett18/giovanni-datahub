// Lista del giorno, urgenze, avvisi di scadenza e resoconto settimanale.

import { BUDGET_MINUTI, DURATA_STANDARD, DURATA_VELOCE } from './config.js';
import { aggiungiGiorni, dataLeggibile, differenzaGiorni, oraRoma } from './dates.js';
import { daApi, punteggio } from './parse.js';

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function scadenza(task) {
  return task.due?.date ? task.due.date.slice(0, 10) : null;
}

export function orario(task) {
  const dt = task.due?.datetime ?? (task.due?.date?.length > 10 ? task.due.date : null);
  if (!dt) return null;
  if (dt.endsWith('Z')) {
    const r = oraRoma(new Date(dt));
    return `${String(r.ora).padStart(2, '0')}:${String(r.minuti).padStart(2, '0')}`;
  }
  return dt.slice(11, 16);
}

export function durataMinuti(task) {
  const d = task.duration;
  if (d?.amount) return d.unit === 'day' ? d.amount * 8 * 60 : d.amount;
  return (task.labels ?? []).includes('veloce') ? DURATA_VELOCE : DURATA_STANDARD;
}

// Urgenza calcolata oggi: priorità impostata + vicinanza della scadenza + chi la chiede.
export function urgenza(task, oggi) {
  const data = scadenza(task);
  const giorni = data ? differenzaGiorni(oggi, data) : null;
  const base = { 1: 6, 2: 4, 3: 2, 4: 0 }[daApi(task.priority ?? 1)];
  return base + punteggio({ giorniAllaScadenza: giorni, etichette: task.labels ?? [] });
}

export function ordina(tasks, oggi) {
  return [...tasks].sort((a, b) => {
    const d = urgenza(b, oggi) - urgenza(a, oggi);
    if (d) return d;
    const sa = scadenza(a) ?? '9999';
    const sb = scadenza(b) ?? '9999';
    if (sa !== sb) return sa < sb ? -1 : 1;
    return (orario(a) ?? '99') < (orario(b) ?? '99') ? -1 : 1;
  });
}

function etichettaP(task) {
  return ['', '🔴', '🟠', '🔵', '⚪'][daApi(task.priority ?? 1)];
}

export function riga(task, n, oggi, albero) {
  const parti = [`${n}. ${etichettaP(task)} ${esc(task.content)}`];
  const dettagli = [];
  const data = scadenza(task);
  if (data) {
    const diff = differenzaGiorni(oggi, data);
    let quando = diff < 0 ? `scaduta ${dataLeggibile(data)}` : dataLeggibile(data, oggi);
    const h = orario(task);
    if (h) quando += ` ${h}`;
    dettagli.push(quando);
  }
  const prog = albero?.get(task.project_id);
  if (prog && !prog.inbox && prog.nome !== prog.radice) dettagli.push(prog.nome);
  if (task.duration?.amount) dettagli.push(`${durataMinuti(task)} min`);
  const etichette = (task.labels ?? []).map((l) => '@' + l);
  if (etichette.length) dettagli.push(etichette.join(' '));
  if (dettagli.length) parti.push(`  <i>${esc(dettagli.join(' · '))}</i>`);
  return parti.join('');
}

function formatoOre(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? (m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m} min`;
}

// Riempie il budget di ogni area: prima scadute e di oggi, poi le prossime più urgenti.
export function pianoDelGiorno(tasks, oggi, albero) {
  const entro7 = aggiungiGiorni(oggi, 7);
  const aree = { Lavoro: [], Studio: [], Personale: [], Altro: [] };
  for (const t of tasks) {
    const radice = albero.get(t.project_id)?.radice;
    const area = aree[radice] ? radice : 'Altro';
    aree[area].push(t);
  }

  const risultato = [];
  for (const [area, lista] of Object.entries(aree)) {
    const ordinata = ordina(lista, oggi);
    const obbligatorie = ordinata.filter((t) => scadenza(t) && scadenza(t) <= oggi);
    const budget = BUDGET_MINUTI[area];
    let usato = obbligatorie.reduce((s, t) => s + durataMinuti(t), 0);
    const extra = [];
    if (budget) {
      const candidate = ordinata.filter(
        (t) => !obbligatorie.includes(t) && !t.due?.is_recurring && (!scadenza(t) || scadenza(t) <= entro7) && daApi(t.priority ?? 1) <= 3,
      );
      for (const t of candidate) {
        const d = durataMinuti(t);
        if (usato + d > budget) continue;
        extra.push(t);
        usato += d;
      }
    }
    if (obbligatorie.length || extra.length) risultato.push({ area, obbligatorie, extra, usato, budget });
  }
  return risultato;
}

const ICONE = { Lavoro: '💼', Studio: '📚', Personale: '🏠', Altro: '📥' };

export function messaggioMattino(tasks, oggi, albero) {
  const piano = pianoDelGiorno(tasks, oggi, albero);
  const numerate = [];
  const righe = [`☀️ <b>Buongiorno! Piano di ${esc(dataLeggibile(oggi))}</b>`];

  if (!piano.length) righe.push('', 'Nessuna attività in programma oggi. Scrivimi cosa devi fare e la aggiungo.');

  for (const { area, obbligatorie, extra, usato, budget } of piano) {
    const intestazione = budget ? `${ICONE[area]} <b>${area}</b> (${formatoOre(usato)} su ${formatoOre(budget)})` : `${ICONE[area]} <b>${area}</b>`;
    righe.push('', intestazione);
    for (const t of obbligatorie) {
      numerate.push(t.id);
      righe.push(riga(t, numerate.length, oggi, albero));
    }
    if (extra.length) {
      righe.push(obbligatorie.length ? '<i>Se resta tempo:</i>' : '<i>Da portare avanti:</i>');
      for (const t of extra) {
        numerate.push(t.id);
        righe.push(riga(t, numerate.length, oggi, albero));
      }
    }
    if (budget && usato > budget) righe.push(`⚠️ Sei oltre di ${formatoOre(usato - budget)}: valuta cosa spostare.`);
  }

  const avvisi = avvisiScadenze(tasks, oggi, albero, numerate);
  if (avvisi.length) righe.push('', '⏰ <b>Scadenze in arrivo</b>', ...avvisi);

  if (numerate.length) righe.push('', 'Quando finisci scrivi /fatto e il numero.');
  return { testo: righe.join('\n'), ids: numerate };
}

// Avvisi a 3 giorni e a 1 giorno dalla scadenza.
export function avvisiScadenze(tasks, oggi, albero, numerate = []) {
  const righe = [];
  for (const giorni of [1, 3]) {
    const data = aggiungiGiorni(oggi, giorni);
    const lista = ordina(tasks.filter((t) => scadenza(t) === data && !t.due?.is_recurring), oggi);
    for (const t of lista) {
      numerate.push(t.id);
      righe.push(riga(t, numerate.length, oggi, albero) + (giorni === 1 ? ' ← <b>domani</b>' : ' ← tra 3 giorni'));
    }
  }
  return righe;
}

export function messaggioUrgenti(tasks, oggi, albero) {
  const urgenti = ordina(
    tasks.filter((t) => {
      const data = scadenza(t);
      return daApi(t.priority ?? 1) <= 2 || (data && data <= aggiungiGiorni(oggi, 1));
    }),
    oggi,
  ).slice(0, 15);
  if (!urgenti.length) return { testo: '✅ Niente di urgente in questo momento.', ids: [] };
  const righe = ['🔥 <b>Le più urgenti</b>'];
  urgenti.forEach((t, i) => righe.push(riga(t, i + 1, oggi, albero)));
  return { testo: righe.join('\n'), ids: urgenti.map((t) => t.id) };
}

export function messaggioSettimana({ tasks, completate, oggi, albero, finanze }) {
  const righe = [`📊 <b>Resoconto della settimana</b>`];

  if (completate) {
    const perArea = {};
    for (const t of completate) {
      const area = albero.get(t.project_id)?.radice ?? 'Altro';
      perArea[area] = (perArea[area] ?? 0) + 1;
    }
    const dettaglio = Object.entries(perArea).map(([a, n]) => `${a} ${n}`).join(', ');
    righe.push('', `✅ Completate negli ultimi 7 giorni: <b>${completate.length}</b>${dettaglio ? ` (${esc(dettaglio)})` : ''}`);
  }

  const scadute = tasks.filter((t) => scadenza(t) && scadenza(t) < oggi);
  if (scadute.length) righe.push(`⚠️ Attività scadute ancora aperte: <b>${scadute.length}</b>`);

  const fine = aggiungiGiorni(oggi, 7);
  const prossime = ordina(tasks.filter((t) => scadenza(t) && scadenza(t) >= oggi && scadenza(t) < fine && !t.due?.is_recurring), oggi);
  const ids = [];
  if (prossime.length) {
    righe.push('', '📅 <b>Scadenze dei prossimi 7 giorni</b>');
    prossime.slice(0, 20).forEach((t) => {
      ids.push(t.id);
      righe.push(riga(t, ids.length, oggi, albero));
    });
  } else righe.push('', '📅 Nessuna scadenza nei prossimi 7 giorni.');

  if (finanze) righe.push('', finanze);
  return { testo: righe.join('\n'), ids };
}
