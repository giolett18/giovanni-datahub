// Prova completa del bot con Todoist e Telegram simulati.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker, { gestisci, promemoria, segretoWebhook } from '../src/index.js';

function finto() {
  const db = { projects: [{ id: 'inbox', name: 'Inbox', inbox_project: true }], sections: [], labels: [], tasks: [], closed: [] };
  const inviati = [];
  let n = 0;
  const id = () => `id${++n}`;
  const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json' } });

  const fetchFn = async (url, opt = {}) => {
    const u = new URL(url);
    const body = opt.body ? JSON.parse(opt.body) : null;
    if (u.hostname === 'api.telegram.org') {
      inviati.push(body.text);
      return json({ ok: true });
    }
    const p = u.pathname.replace('/api/v1', '');
    const m = opt.method ?? 'GET';
    if (m === 'GET' && p === '/projects') return json({ results: db.projects, next_cursor: null });
    if (m === 'POST' && p === '/projects') {
      const x = { id: id(), name: body.name, parent_id: body.parent_id ?? null };
      db.projects.push(x);
      return json(x);
    }
    if (m === 'GET' && p === '/sections') return json({ results: db.sections.filter((s) => s.project_id === u.searchParams.get('project_id')) });
    if (m === 'POST' && p === '/sections') {
      const x = { id: id(), ...body };
      db.sections.push(x);
      return json(x);
    }
    if (m === 'GET' && p === '/labels') return json({ results: db.labels });
    if (m === 'POST' && p === '/labels') {
      db.labels.push({ id: id(), name: body.name });
      return json(db.labels.at(-1));
    }
    if (m === 'GET' && p === '/tasks') return json({ results: db.tasks });
    if (m === 'POST' && p === '/tasks') {
      const x = {
        id: id(),
        content: body.content,
        project_id: body.project_id ?? 'inbox',
        section_id: body.section_id ?? null,
        labels: body.labels ?? [],
        priority: body.priority,
        due: body.due_date ? { date: body.due_date } : body.due_datetime ? { date: body.due_datetime, datetime: body.due_datetime } : body.due_string ? { date: '2026-12-10', is_recurring: true, string: body.due_string } : null,
        duration: body.duration ? { amount: body.duration, unit: body.duration_unit } : null,
      };
      db.tasks.push(x);
      return json(x);
    }
    const close = p.match(/^\/tasks\/(\w+)\/close$/);
    if (close) {
      db.closed.push(close[1]);
      db.tasks = db.tasks.filter((t) => t.id !== close[1]);
      return new Response(null, { status: 204 });
    }
    const del = p.match(/^\/tasks\/(\w+)$/);
    if (del && m === 'DELETE') {
      db.tasks = db.tasks.filter((t) => t.id !== del[1]);
      return new Response(null, { status: 204 });
    }
    if (p === '/tasks/completed/by_completion_date') return json({ items: db.closed.map((i) => ({ id: i, project_id: 'x' })) });
    return json({ error: 'not found ' + m + ' ' + p }, 404);
  };

  const kv = new Map();
  const KV = {
    get: async (k, t) => (kv.has(k) ? (t === 'json' ? JSON.parse(kv.get(k)) : kv.get(k)) : null),
    put: async (k, v) => void kv.set(k, v),
    delete: async (k) => void kv.delete(k),
  };
  const env = { TODOIST_TOKEN: 't', TELEGRAM_TOKEN: 'bot', KV, fetch: fetchFn, now: new Date('2026-11-17T10:00:00Z') };
  return { env, db, inviati };
}

test('setup crea la struttura una volta sola', async () => {
  const { env, db, inviati } = finto();
  await gestisci(env, '1', '/setup');
  assert.deepEqual(db.projects.map((p) => p.name), ['Inbox', 'Lavoro', 'Studio', 'Personale']);
  const sez = (prog) => db.sections.filter((s) => s.project_id === db.projects.find((p) => p.name === prog).id).map((s) => s.name);
  assert.deepEqual(sez('Lavoro'), ['Imprevisti', 'GTS', 'Enel X', 'Bando REN']);
  assert.deepEqual(sez('Personale'), ['Finanze', 'Bollette ricorrenti', 'Scadenze', 'Famiglia']);
  assert.deepEqual(db.labels.map((l) => l.name), ['capo', 'cliente', 'veloce']);
  assert.ok(db.sections.some((s) => s.name === 'Imprevisti'));
  const prima = db.projects.length + db.sections.length;
  await gestisci(env, '1', '/setup');
  assert.equal(db.projects.length + db.sections.length, prima);
  assert.match(inviati.at(-1), /già completa/);
});

test('flusso completo: aggiungi, oggi, fatto, spese, promemoria', async () => {
  const { env, db, inviati } = finto();
  await gestisci(env, '1', '/setup');
  await gestisci(env, '1', '/esame Reti di calcolatori');
  assert.ok(db.sections.some((s) => s.name === 'Reti di calcolatori' && s.project_id === db.projects.find((p) => p.name === 'Studio').id));

  await gestisci(env, '1', 'gts: inviare offerta oggi alle 10 @capo');
  let t = db.tasks.at(-1);
  assert.equal(t.project_id, db.projects.find((p) => p.name === 'Lavoro').id);
  assert.equal(t.section_id, db.sections.find((s) => s.name === 'GTS').id);
  assert.equal(t.priority, 4);
  assert.equal(t.due.datetime, '2026-11-17T09:00:00Z');
  assert.match(inviati.at(-1), /Lavoro › GTS · P1/);

  await gestisci(env, '1', 'imprevisto: richiamare Enel X oggi');
  t = db.tasks.at(-1);
  assert.equal(t.section_id, db.sections.find((s) => s.name === 'Imprevisti').id);

  await gestisci(env, '1', 'reti di calcolatori: esercizi capitolo 2 oggi 1h');
  await gestisci(env, '1', 'scadenze: rinnovo assicurazione auto 20/11');
  await gestisci(env, '1', 'comprare regalo mamma');

  await gestisci(env, '1', '/oggi');
  const piano = inviati.at(-1);
  assert.match(piano, /💼 <b>Lavoro<\/b>/);
  assert.match(piano, /📚 <b>Studio<\/b> \(1h su 2h\)/);
  assert.match(piano, /Scadenze in arrivo/);
  assert.match(piano, /Rinnovo assicurazione auto.*Scadenze.*tra 3 giorni/);
  assert.match(piano, /Inviare offerta.*GTS/);
  assert.ok(piano.indexOf('Inviare offerta') < piano.indexOf('Richiamare Enel X'), 'il capo viene prima');

  await gestisci(env, '1', '/fatto 1');
  assert.match(inviati.at(-1), /Completate:\n• Inviare offerta/);

  await gestisci(env, '1', '/annulla');
  assert.ok(!db.tasks.some((x) => x.content === 'Comprare regalo mamma'));

  await gestisci(env, '1', '/spesa 40 benzina');
  await gestisci(env, '1', '/spesa 12,50 pranzo');
  await gestisci(env, '1', '/entrata 1500 stipendio');
  await gestisci(env, '1', '/mese');
  assert.match(inviati.at(-1), /Saldo: <b>1\.447,50 €<\/b>/);
  assert.match(inviati.at(-1), /benzina: 40,00 € \(76%\)/);

  // Promemoria: alle 9 di Roma non parte, alle 8 sì e una volta sola
  await env.KV.put('proprietario', '1');
  const prima = inviati.length;
  await promemoria({ ...env, now: new Date('2026-11-17T08:00:00Z') });
  assert.equal(inviati.length, prima);
  await promemoria({ ...env, now: new Date('2026-11-17T07:00:00Z') });
  assert.equal(inviati.length, prima + 1);
  await promemoria({ ...env, now: new Date('2026-11-17T07:00:00Z') });
  assert.equal(inviati.length, prima + 1);

  // Lunedì 23 arriva anche il resoconto settimanale
  await promemoria({ ...env, now: new Date('2026-11-23T07:00:00Z') });
  assert.match(inviati.at(-1), /Resoconto della settimana/);
  assert.match(inviati.at(-1), /Ultimi 7 giorni: uscite <b>52,50 €<\/b>/);

  // Il 1° dicembre arriva il riepilogo di novembre
  await promemoria({ ...env, now: new Date('2026-12-01T07:00:00Z') });
  assert.match(inviati.at(-1), /Riepilogo novembre 2026/);
});

test('webhook: rifiuta senza segreto e accetta solo il proprietario', async () => {
  const { env, inviati } = finto();
  const segreto = await segretoWebhook(env.TELEGRAM_TOKEN);
  const req = (chat, text, s = segreto) =>
    new Request('https://x.workers.dev/telegram', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': s },
      body: JSON.stringify({ message: { chat: { id: chat }, text } }),
    });
  assert.equal((await worker.fetch(req(1, '/start', 'sbagliato'), env)).status, 401);
  await worker.fetch(req(1, '/start'), env);
  assert.equal(await env.KV.get('proprietario'), '1');
  const n = inviati.length;
  await worker.fetch(req(2, '/oggi'), env);
  assert.equal(inviati.length, n, 'uno sconosciuto non riceve nulla');
});
