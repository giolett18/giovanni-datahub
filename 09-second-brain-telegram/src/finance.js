// Registro di entrate e uscite, salvato in Cloudflare KV (una chiave per mese).

import { aggiungiGiorni, nomeMese } from './dates.js';
import { esc } from './reports.js';

const chiave = (mese) => `fin:${mese}`;

export function analizzaMovimento(testo) {
  // "40 benzina", "12,50 pranzo con cliente", "1500€ stipendio"
  const m = testo.trim().match(/^(\d+(?:[.,]\d{1,2})?)\s*(?:€|euro|eur)?\s*(.*)$/i);
  if (!m) return null;
  const importo = Number(m[1].replace(',', '.'));
  if (!(importo > 0)) return null;
  const descrizione = m[2].trim() || 'varie';
  const categoria = descrizione.split(/\s+/)[0].toLowerCase();
  return { importo, descrizione, categoria };
}

export async function registra(kv, tipo, movimento, data) {
  const mese = data.slice(0, 7);
  const lista = (await kv.get(chiave(mese), 'json')) ?? [];
  lista.push({ tipo, data, ...movimento });
  await kv.put(chiave(mese), JSON.stringify(lista));
  return totali(lista);
}

export async function movimenti(kv, mese) {
  return (await kv.get(chiave(mese), 'json')) ?? [];
}

export async function annullaUltimo(kv, mese) {
  const lista = await movimenti(kv, mese);
  const tolto = lista.pop();
  if (tolto) await kv.put(chiave(mese), JSON.stringify(lista));
  return tolto;
}

export function totali(lista) {
  const entrate = lista.filter((x) => x.tipo === 'entrata').reduce((s, x) => s + x.importo, 0);
  const uscite = lista.filter((x) => x.tipo === 'uscita').reduce((s, x) => s + x.importo, 0);
  return { entrate, uscite, saldo: entrate - uscite };
}

export function euro(n) {
  const [intero, decimali] = Math.abs(n).toFixed(2).split('.');
  return `${n < 0 ? '-' : ''}${intero.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimali} €`;
}

export function riepilogoMese(lista, mese) {
  const { entrate, uscite, saldo } = totali(lista);
  const righe = [`💰 <b>Riepilogo ${esc(nomeMese(mese))}</b>`];
  if (!lista.length) {
    righe.push('Nessun movimento registrato.');
    return righe.join('\n');
  }
  righe.push(`Entrate: <b>${euro(entrate)}</b>`, `Uscite: <b>${euro(uscite)}</b>`, `Saldo: <b>${euro(saldo)}</b>`);

  const perCategoria = {};
  for (const x of lista.filter((x) => x.tipo === 'uscita')) perCategoria[x.categoria] = (perCategoria[x.categoria] ?? 0) + x.importo;
  const top = Object.entries(perCategoria).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (top.length) {
    righe.push('', '<b>Uscite per categoria</b>');
    for (const [cat, tot] of top) {
      const quota = uscite ? Math.round((tot / uscite) * 100) : 0;
      righe.push(`• ${esc(cat)}: ${euro(tot)} (${quota}%)`);
    }
  }
  return righe.join('\n');
}

// Movimenti degli ultimi 7 giorni (possono stare a cavallo di due mesi).
export async function riepilogoSettimana(kv, oggi) {
  const inizio = aggiungiGiorni(oggi, -7);
  const mesi = [...new Set([inizio.slice(0, 7), oggi.slice(0, 7)])];
  const lista = (await Promise.all(mesi.map((m) => movimenti(kv, m)))).flat().filter((x) => x.data >= inizio && x.data < oggi);
  if (!lista.length) return null;
  const { entrate, uscite } = totali(lista);
  return `💰 Ultimi 7 giorni: uscite <b>${euro(uscite)}</b>${entrate ? `, entrate <b>${euro(entrate)}</b>` : ''}`;
}
