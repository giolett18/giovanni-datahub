// Bot Telegram del second brain. Gira su Cloudflare Workers:
// - fetch: riceve i messaggi da Telegram (webhook)
// - scheduled: alle 8:00 di Roma invia piano del giorno, avvisi e resoconti

import { ETICHETTE, ORA_PROMEMORIA, SEZIONI_ESAME, STRUTTURA } from './config.js';
import { aggiungiGiorni, dataLeggibile, oraRoma, romaToUTC } from './dates.js';
import { analizzaMessaggio, versoApi } from './parse.js';
import { alberoProgetti, Todoist } from './todoist.js';
import { esc, messaggioMattino, messaggioSettimana, messaggioUrgenti, ordina } from './reports.js';
import { analizzaMovimento, annullaUltimo, euro, movimenti, registra, riepilogoMese, riepilogoSettimana } from './finance.js';

export async function segretoWebhook(token) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function invia(env, chatId, testo) {
  const pezzi = [];
  let resto = testo;
  while (resto.length > 4000) {
    const taglio = resto.lastIndexOf('\n', 4000);
    pezzi.push(resto.slice(0, taglio > 0 ? taglio : 4000));
    resto = resto.slice(taglio > 0 ? taglio + 1 : 4000);
  }
  pezzi.push(resto);
  for (const p of pezzi) {
    await (env.fetch ?? fetch)(`https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: p, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  }
}

async function proprietario(env) {
  return env.CHAT_ID || (await env.KV.get('proprietario'));
}

const AIUTO = `🧠 <b>Il tuo second brain</b>

<b>Aggiungere un'attività</b>: scrivila e basta.
<code>gts: report per Rossi entro giovedì, importante @capo</code>
<code>imprevisto: chiamare fornitore Enel X oggi alle 15</code>
<code>studio: ripassare capitolo 3 domani 1h</code>
<code>bolletta: pagare luce ogni mese il 10</code>

Prefissi: lavoro, gts, enel, ren, imprevisto, studio, tesi, personale, famiglia, scadenze, finanze, bolletta (o il nome di un esame).
Date: oggi, domani, giovedì, 25 novembre, 25/11, tra 3 giorni, alle 15, ogni lunedì.
Urgenza: urgente, importante, @capo, @cliente. Durata: 15 min, 2h (sotto i 15 min diventa @veloce).

<b>Comandi</b>
/oggi – piano di oggi
/urgenti – le più urgenti
/fatto 2 – completa l'attività n. 2 dell'ultima lista
/annulla – elimina l'ultima attività aggiunta
/spesa 40 benzina – registra un'uscita
/entrata 1500 stipendio – registra un'entrata
/mese – riepilogo del mese (/mese 2026-10 per un altro)
/settimana – resoconto della settimana
/esame Reti di calcolatori – crea il progetto di un esame
/setup – crea la struttura in Todoist`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET') return new Response('Second brain attivo ✅');
    if (request.method !== 'POST' || url.pathname !== '/telegram') return new Response('Non trovato', { status: 404 });

    const atteso = await segretoWebhook(env.TELEGRAM_TOKEN);
    if (request.headers.get('X-Telegram-Bot-Api-Secret-Token') !== atteso) return new Response('Non autorizzato', { status: 401 });

    const update = await request.json();
    const msg = update.message ?? update.edited_message;
    if (!msg?.text) return new Response('ok');
    const chatId = String(msg.chat.id);

    let owner = await proprietario(env);
    if (!owner && msg.text.startsWith('/start')) {
      await env.KV.put('proprietario', chatId);
      owner = chatId;
    }
    if (owner !== chatId) {
      if (!owner) await invia(env, chatId, 'Scrivi /start per collegare questo bot al tuo account.');
      return new Response('ok');
    }

    try {
      await gestisci(env, chatId, msg.text.trim());
    } catch (e) {
      console.error(e);
      await invia(env, chatId, `❌ Qualcosa è andato storto: ${esc(e.message).slice(0, 300)}`);
    }
    return new Response('ok');
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(promemoria(env));
  },
};

export async function gestisci(env, chatId, testo) {
  const td = new Todoist(env.TODOIST_TOKEN, env.fetch ?? fetch);
  const { data: oggi } = oraRoma(env.now ?? new Date());
  const [comandoGrezzo, ...argomenti] = testo.split(/\s+/);
  const comando = comandoGrezzo.startsWith('/') ? comandoGrezzo.split('@')[0].toLowerCase() : null;
  const arg = argomenti.join(' ').trim();

  switch (comando) {
    case '/start':
    case '/aiuto':
    case '/help':
      return invia(env, chatId, AIUTO + (comando === '/start' ? '\n\nPrimo passo: scrivi /setup per creare progetti ed etichette in Todoist.' : ''));

    case '/setup':
      return invia(env, chatId, await setup(td));

    case '/esame': {
      if (!arg) return invia(env, chatId, 'Scrivi il nome dell\'esame, ad esempio: /esame Reti di calcolatori');
      return invia(env, chatId, await creaEsame(td, arg));
    }

    case '/oggi': {
      const { tasks, albero } = await carica(td);
      const { testo: t, ids } = messaggioMattino(tasks, oggi, albero);
      await env.KV.put('ultima_lista', JSON.stringify(ids));
      return invia(env, chatId, t);
    }

    case '/urgenti': {
      const { tasks, albero } = await carica(td);
      const { testo: t, ids } = messaggioUrgenti(tasks, oggi, albero);
      await env.KV.put('ultima_lista', JSON.stringify(ids));
      return invia(env, chatId, t);
    }

    case '/settimana':
      return invia(env, chatId, await settimana(env, td, oggi));

    case '/fatto':
      return invia(env, chatId, await fatto(env, td, arg, oggi));

    case '/annulla': {
      const ultima = await env.KV.get('ultima_creata', 'json');
      if (!ultima) return invia(env, chatId, 'Non ho attività recenti da annullare.');
      await td.richiesta('DELETE', `/tasks/${ultima.id}`);
      await env.KV.delete('ultima_creata');
      return invia(env, chatId, `🗑 Eliminata: ${esc(ultima.contenuto)}`);
    }

    case '/spesa':
    case '/uscita':
    case '/entrata': {
      const tipo = comando === '/entrata' ? 'entrata' : 'uscita';
      const mov = analizzaMovimento(arg);
      if (!mov) return invia(env, chatId, `Scrivi importo e descrizione, ad esempio: ${comando} 40 benzina`);
      const tot = await registra(env.KV, tipo, mov, oggi);
      return invia(
        env,
        chatId,
        `${tipo === 'entrata' ? '💶' : '💸'} Registrata ${tipo} di <b>${euro(mov.importo)}</b> (${esc(mov.descrizione)}).\nQuesto mese: uscite ${euro(tot.uscite)}, entrate ${euro(tot.entrate)}, saldo ${euro(tot.saldo)}.\n/annullamovimento per toglierla.`,
      );
    }

    case '/annullamovimento': {
      const tolto = await annullaUltimo(env.KV, oggi.slice(0, 7));
      return invia(env, chatId, tolto ? `🗑 Tolto: ${tolto.tipo} di ${euro(tolto.importo)} (${esc(tolto.descrizione)})` : 'Nessun movimento da togliere questo mese.');
    }

    case '/mese': {
      const mese = /^\d{4}-\d{2}$/.test(arg) ? arg : oggi.slice(0, 7);
      return invia(env, chatId, riepilogoMese(await movimenti(env.KV, mese), mese));
    }

    case null:
      return invia(env, chatId, await aggiungi(env, td, testo, oggi));

    default:
      return invia(env, chatId, 'Comando non riconosciuto. Scrivi /aiuto per la lista.');
  }
}

async function carica(td) {
  const [tasks, progetti] = await Promise.all([td.attivita(), td.progetti()]);
  return { tasks, progetti, albero: alberoProgetti(progetti) };
}

async function aggiungi(env, td, testo, oggi) {
  const progetti = await td.progetti();
  const a = analizzaMessaggio(testo, oggi, progetti.map((p) => p.name));

  const progetto = a.progetto ? progetti.find((p) => p.name.toLowerCase() === a.progetto.toLowerCase()) : null;
  const dati = { content: a.contenuto, priority: versoApi(a.priorita) };
  if (progetto) dati.project_id = progetto.id;
  if (progetto && a.sezione) {
    const sezione = (await td.sezioni(progetto.id)).find((s) => s.name.toLowerCase() === a.sezione.toLowerCase());
    if (sezione) dati.section_id = sezione.id;
  }
  if (a.etichette.length) dati.labels = a.etichette;
  if (a.ricorrente) {
    dati.due_string = a.ricorrente;
    dati.due_lang = 'it';
  } else if (a.data && a.ora) dati.due_datetime = romaToUTC(a.data, a.ora);
  else if (a.data) dati.due_date = a.data;
  if (a.durata) {
    dati.duration = a.durata;
    dati.duration_unit = 'minute';
  }

  const task = await td.creaAttivita(dati);
  await env.KV.put('ultima_creata', JSON.stringify({ id: task.id, contenuto: a.contenuto }));

  const dettagli = [`P${a.priorita}`];
  if (a.ricorrente) dettagli.push(`🔁 ${a.ricorrente}`);
  else if (a.data) dettagli.push(`📅 ${dataLeggibile(a.data, oggi)}${a.ora ? ' ' + a.ora : ''}`);
  if (a.durata) dettagli.push(`⏱ ${a.durata} min`);
  if (a.etichette.length) dettagli.push(a.etichette.map((e) => '@' + e).join(' '));
  const dove = progetto ? `${progetto.name}${dati.section_id ? ' › ' + a.sezione : ''}` : 'Inbox';
  const avviso = a.progetto && !progetto ? `\n⚠️ Non trovo il progetto "${esc(a.progetto)}": l'ho messa in Inbox. Hai già fatto /setup?` : '';
  return `✅ <b>${esc(a.contenuto)}</b>\n${esc(dove)} · ${esc(dettagli.join(' · '))}${avviso}\n/annulla se ho capito male.`;
}

async function fatto(env, td, arg, oggi) {
  const ids = (await env.KV.get('ultima_lista', 'json')) ?? [];
  const numeri = arg.split(/[\s,]+/).filter((x) => /^\d+$/.test(x)).map(Number);

  if (!arg) return 'Scrivi il numero dall\'ultima lista (/oggi o /urgenti), ad esempio /fatto 2, oppure una parola dell\'attività.';

  if (numeri.length) {
    const chiuse = [];
    const tasks = await td.attivita();
    for (const n of numeri) {
      const id = ids[n - 1];
      if (!id) continue;
      const t = tasks.find((x) => x.id === id);
      await td.chiudiAttivita(id);
      chiuse.push(t ? t.content : `n. ${n}`);
    }
    if (!chiuse.length) return 'Non trovo quei numeri nell\'ultima lista. Scrivi /oggi per vederla di nuovo.';
    return `🎉 Completate:\n${chiuse.map((c) => '• ' + esc(c)).join('\n')}`;
  }

  const cerca = arg.toLowerCase();
  const tasks = (await td.attivita()).filter((t) => t.content.toLowerCase().includes(cerca));
  if (tasks.length === 1) {
    await td.chiudiAttivita(tasks[0].id);
    return `🎉 Completata: ${esc(tasks[0].content)}`;
  }
  if (!tasks.length) return 'Non trovo attività con queste parole.';
  const lista = ordina(tasks, oggi).slice(0, 10);
  await env.KV.put('ultima_lista', JSON.stringify(lista.map((t) => t.id)));
  return `Ne ho trovate ${tasks.length}. Quale? Scrivi /fatto e il numero:\n${lista.map((t, i) => `${i + 1}. ${esc(t.content)}`).join('\n')}`;
}

async function settimana(env, td, oggi, salvaLista = true) {
  const { tasks, albero } = await carica(td);
  let completate = null;
  try {
    completate = await td.completate(`${aggiungiGiorni(oggi, -7)}T00:00:00Z`, `${oggi}T00:00:00Z`);
  } catch (e) {
    console.error('completate', e);
  }
  const finanze = await riepilogoSettimana(env.KV, oggi);
  const { testo, ids } = messaggioSettimana({ tasks, completate, oggi, albero, finanze });
  if (salvaLista) await env.KV.put('ultima_lista', JSON.stringify(ids));
  return testo;
}

export async function setup(td) {
  const creati = [];
  let progetti = await td.progetti();
  const trova = (nome, parentId) => progetti.find((p) => p.name === nome && (p.parent_id ?? null) === (parentId ?? null));

  async function assicura(nodo, parentId) {
    let p = trova(nodo.nome, parentId);
    if (!p) {
      p = await td.creaProgetto(nodo.nome, parentId);
      progetti.push(p);
      creati.push(`progetto ${nodo.nome}`);
    }
    if (nodo.sezioni?.length) {
      const esistenti = (await td.sezioni(p.id)).map((s) => s.name);
      for (const s of nodo.sezioni) {
        if (!esistenti.includes(s)) {
          await td.creaSezione(s, p.id);
          creati.push(`sezione ${nodo.nome} › ${s}`);
        }
      }
    }
    for (const figlio of nodo.figli ?? []) await assicura(figlio, p.id);
  }

  for (const nodo of STRUTTURA) await assicura(nodo, null);

  const etichette = (await td.etichette()).map((l) => l.name);
  for (const e of ETICHETTE) {
    if (!etichette.includes(e)) {
      await td.creaEtichetta(e);
      creati.push(`etichetta @${e}`);
    }
  }

  if (!creati.length) return '✅ La struttura è già completa, non ho cambiato nulla.';
  return `✅ Struttura pronta. Ho creato:\n${creati.map((c) => '• ' + esc(c)).join('\n')}\n\nPer ogni esame del semestre scrivi /esame e il nome.`;
}

async function creaEsame(td, nome) {
  const progetti = await td.progetti();
  const studio = progetti.find((p) => p.name === 'Studio' && !p.parent_id);
  if (!studio) return 'Prima scrivi /setup per creare il progetto Studio.';
  if (progetti.some((p) => p.parent_id === studio.id && p.name.toLowerCase() === nome.toLowerCase())) return `L'esame "${esc(nome)}" esiste già.`;
  const p = await td.creaProgetto(nome, studio.id);
  for (const s of SEZIONI_ESAME) await td.creaSezione(s, p.id);
  return `📚 Creato l'esame <b>${esc(nome)}</b> con le sezioni ${SEZIONI_ESAME.join(', ')}.\nPer aggiungere attività: <code>${esc(nome.toLowerCase())}: ripassare capitolo 1 domani</code>`;
}

// Gira alle 6:00 e alle 7:00 UTC; agisce solo quando a Roma sono le 8 (vale con ora legale e solare).
export async function promemoria(env) {
  const r = oraRoma(env.now ?? new Date());
  if (r.ora !== ORA_PROMEMORIA) return;
  if (await env.KV.get(`inviato:${r.data}`)) return;
  const chatId = await proprietario(env);
  if (!chatId) return;
  await env.KV.put(`inviato:${r.data}`, '1', { expirationTtl: 3 * 86400 });

  const td = new Todoist(env.TODOIST_TOKEN, env.fetch ?? fetch);
  const { tasks, albero } = await carica(td);
  const { testo, ids } = messaggioMattino(tasks, r.data, albero);
  await env.KV.put('ultima_lista', JSON.stringify(ids));
  await invia(env, chatId, testo);

  if (r.giornoSettimana === 1) await invia(env, chatId, await settimana(env, td, r.data, false));

  if (r.data.endsWith('-01')) {
    const mesePrima = aggiungiGiorni(r.data, -1).slice(0, 7);
    await invia(env, chatId, riepilogoMese(await movimenti(env.KV, mesePrima), mesePrima));
  }
}
