// Struttura del second brain in Todoist.
// /setup crea tutto ciò che manca; non cancella né rinomina nulla.

// Il piano gratuito di Todoist permette 5 progetti: per questo le aree
// sono sezioni dentro tre progetti principali.
export const STRUTTURA = [
  { nome: 'Lavoro', sezioni: ['Imprevisti', 'GTS', 'Enel X', 'Bando REN'] },
  { nome: 'Studio', sezioni: ['Tesi e piano di studi'] },
  { nome: 'Personale', sezioni: ['Finanze', 'Bollette ricorrenti', 'Scadenze', 'Famiglia'] },
];

export const ETICHETTE = ['capo', 'cliente', 'veloce'];

// Ore disponibili al giorno per area (in minuti)
export const BUDGET_MINUTI = { Lavoro: 6 * 60, Studio: 2 * 60 };

// Durata stimata di un'attività senza durata esplicita
export const DURATA_STANDARD = 30;
export const DURATA_VELOCE = 15;

// Prefissi rapidi: "gts: ..." finisce in Lavoro › GTS.
// Funziona come prefisso anche il nome di qualsiasi progetto o sezione (es. un esame).
export const ALIAS = {
  lavoro: { progetto: 'Lavoro' },
  imprevisto: { progetto: 'Lavoro', sezione: 'Imprevisti', urgente: true },
  imprevisti: { progetto: 'Lavoro', sezione: 'Imprevisti', urgente: true },
  gts: { progetto: 'Lavoro', sezione: 'GTS' },
  enel: { progetto: 'Lavoro', sezione: 'Enel X' },
  'enel x': { progetto: 'Lavoro', sezione: 'Enel X' },
  enelx: { progetto: 'Lavoro', sezione: 'Enel X' },
  ren: { progetto: 'Lavoro', sezione: 'Bando REN' },
  bando: { progetto: 'Lavoro', sezione: 'Bando REN' },
  'bando ren': { progetto: 'Lavoro', sezione: 'Bando REN' },
  studio: { progetto: 'Studio' },
  tesi: { progetto: 'Studio', sezione: 'Tesi e piano di studi' },
  personale: { progetto: 'Personale' },
  famiglia: { progetto: 'Personale', sezione: 'Famiglia' },
  scadenza: { progetto: 'Personale', sezione: 'Scadenze' },
  scadenze: { progetto: 'Personale', sezione: 'Scadenze' },
  finanze: { progetto: 'Personale', sezione: 'Finanze' },
  bolletta: { progetto: 'Personale', sezione: 'Bollette ricorrenti' },
  bollette: { progetto: 'Personale', sezione: 'Bollette ricorrenti' },
};

export const FUSO = 'Europe/Rome';
export const ORA_PROMEMORIA = 8;
