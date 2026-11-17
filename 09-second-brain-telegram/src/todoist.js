// Client minimo per l'API Todoist v1 (https://developer.todoist.com/api/v1/)

const BASE = 'https://api.todoist.com/api/v1';

export class Todoist {
  constructor(token, fetchFn = fetch) {
    this.token = token;
    this.fetch = fetchFn;
  }

  async richiesta(metodo, percorso, corpo, query) {
    const url = new URL(BASE + percorso);
    if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null) url.searchParams.set(k, v);
    const res = await this.fetch(url.toString(), {
      method: metodo,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    if (!res.ok) {
      const testo = await res.text().catch(() => '');
      throw new Error(`Todoist ${metodo} ${percorso}: ${res.status} ${testo.slice(0, 200)}`);
    }
    if (res.status === 204) return null;
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  // Le liste sono paginate: { results: [...], next_cursor }
  async tutti(percorso, query = {}) {
    const elementi = [];
    let cursor;
    for (let i = 0; i < 50; i++) {
      const r = await this.richiesta('GET', percorso, null, { ...query, limit: 200, cursor });
      if (Array.isArray(r)) return r;
      elementi.push(...(r.results ?? r.items ?? []));
      cursor = r.next_cursor;
      if (!cursor) break;
    }
    return elementi;
  }

  progetti() { return this.tutti('/projects'); }
  sezioni(projectId) { return this.tutti('/sections', { project_id: projectId }); }
  etichette() { return this.tutti('/labels'); }
  attivita() { return this.tutti('/tasks'); }

  creaProgetto(nome, parentId) {
    return this.richiesta('POST', '/projects', { name: nome, ...(parentId ? { parent_id: parentId } : {}) });
  }
  creaSezione(nome, projectId) {
    return this.richiesta('POST', '/sections', { name: nome, project_id: projectId });
  }
  creaEtichetta(nome) {
    return this.richiesta('POST', '/labels', { name: nome });
  }
  creaAttivita(dati) {
    return this.richiesta('POST', '/tasks', dati);
  }
  aggiornaAttivita(id, dati) {
    return this.richiesta('POST', `/tasks/${id}`, dati);
  }
  chiudiAttivita(id) {
    return this.richiesta('POST', `/tasks/${id}/close`);
  }
  completate(since, until) {
    return this.tutti('/tasks/completed/by_completion_date', { since, until });
  }
}

// Mappa id progetto → { nome, radice } dove radice è Lavoro / Studio / Personale
export function alberoProgetti(progetti, sezioni = []) {
  const perId = new Map(progetti.map((p) => [p.id, p]));
  const radice = (p) => {
    let cur = p;
    for (let i = 0; i < 10 && cur?.parent_id && perId.has(cur.parent_id); i++) cur = perId.get(cur.parent_id);
    return cur;
  };
  const mappa = new Map();
  for (const p of progetti) {
    mappa.set(p.id, { nome: p.name, radice: radice(p).name, inbox: !!(p.inbox_project || p.is_inbox_project) });
  }
  mappa.sezioni = new Map(sezioni.map((s) => [s.id, s.name]));
  return mappa;
}
