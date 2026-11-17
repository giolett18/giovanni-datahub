// Struttura del second brain in Todoist.
// /setup crea tutto ciò che manca; non cancella né rinomina nulla.

export const STRUTTURA = [
  {
    nome: 'Lavoro',
    sezioni: ['Imprevisti'],
    figli: [{ nome: 'GTS' }, { nome: 'Enel X' }, { nome: 'Bando REN' }],
  },
  {
    nome: 'Studio',
    figli: [{ nome: 'Tesi e piano di studi' }],
  },
  {
    nome: 'Personale',
    figli: [
      { nome: 'Finanze', sezioni: ['Entrate', 'Uscite', 'Bollette ricorrenti'] },
      { nome: 'Scadenze', sezioni: ['Documenti', 'Assicurazioni', 'Tasse'] },
      { nome: 'Famiglia' },
    ],
  },
];

// Sezioni create per ogni esame con /esame
export const SEZIONI_ESAME = ['Lezioni', 'Esercitazioni', 'Esame'];

export const ETICHETTE = ['capo', 'cliente', 'veloce'];

// Ore disponibili al giorno per area (in minuti)
export const BUDGET_MINUTI = { Lavoro: 6 * 60, Studio: 2 * 60 };

// Durata stimata di un'attività senza durata esplicita
export const DURATA_STANDARD = 30;
export const DURATA_VELOCE = 15;

// Prefissi rapidi: "gts: ..." finisce nel progetto GTS.
// Qualsiasi altro nome di progetto funziona comunque come prefisso.
export const ALIAS = {
  lavoro: { progetto: 'Lavoro' },
  imprevisto: { progetto: 'Lavoro', sezione: 'Imprevisti', urgente: true },
  imprevisti: { progetto: 'Lavoro', sezione: 'Imprevisti', urgente: true },
  gts: { progetto: 'GTS' },
  enel: { progetto: 'Enel X' },
  'enel x': { progetto: 'Enel X' },
  enelx: { progetto: 'Enel X' },
  ren: { progetto: 'Bando REN' },
  bando: { progetto: 'Bando REN' },
  'bando ren': { progetto: 'Bando REN' },
  studio: { progetto: 'Studio' },
  tesi: { progetto: 'Tesi e piano di studi' },
  personale: { progetto: 'Personale' },
  famiglia: { progetto: 'Famiglia' },
  scadenza: { progetto: 'Scadenze' },
  scadenze: { progetto: 'Scadenze' },
  finanze: { progetto: 'Finanze' },
  bolletta: { progetto: 'Finanze', sezione: 'Bollette ricorrenti' },
  bollette: { progetto: 'Finanze', sezione: 'Bollette ricorrenti' },
};

export const FUSO = 'Europe/Rome';
export const ORA_PROMEMORIA = 8;
