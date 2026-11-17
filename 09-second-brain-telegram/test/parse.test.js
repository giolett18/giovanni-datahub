import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analizzaMessaggio, estraiData } from '../src/parse.js';
import { romaToUTC, oraRoma } from '../src/dates.js';
import { analizzaMovimento } from '../src/finance.js';

// Martedì 17 novembre 2026
const OGGI = '2026-11-17';
const D = (nome, progetto, sezione = null) => ({ nome, progetto, sezione });
const PROGETTI = [
  D('Lavoro', 'Lavoro'), D('Studio', 'Studio'), D('Personale', 'Personale'),
  D('GTS', 'Lavoro', 'GTS'), D('Enel X', 'Lavoro', 'Enel X'), D('Reti di calcolatori', 'Studio', 'Reti di calcolatori'),
];

test('esempio del progetto: report per Rossi entro giovedì, importante', () => {
  const a = analizzaMessaggio('lavoro: report per Rossi entro giovedì, importante', OGGI, PROGETTI);
  assert.equal(a.contenuto, 'Report per Rossi');
  assert.equal(a.progetto, 'Lavoro');
  assert.equal(a.data, '2026-11-19');
  assert.equal(a.priorita, 2);
});

test('capo + scadenza domani = P1', () => {
  const a = analizzaMessaggio('gts: inviare offerta domani alle 10 @capo', OGGI, PROGETTI);
  assert.equal(a.progetto, 'Lavoro');
  assert.equal(a.sezione, 'GTS');
  assert.equal(a.contenuto, 'Inviare offerta');
  assert.equal(a.data, '2026-11-18');
  assert.equal(a.ora, '10:00');
  assert.deepEqual(a.etichette, ['capo']);
  assert.equal(a.priorita, 1);
});

test('imprevisto va in sezione Imprevisti ed è urgente', () => {
  const a = analizzaMessaggio('imprevisto: chiamare fornitore oggi', OGGI, PROGETTI);
  assert.equal(a.progetto, 'Lavoro');
  assert.equal(a.sezione, 'Imprevisti');
  assert.equal(a.priorita, 1);
});

test('"per" non legato a una data resta nel testo', () => {
  const a = analizzaMessaggio('enel: preparare slide per il cliente', OGGI, PROGETTI);
  assert.equal(a.sezione, 'Enel X');
  assert.equal(a.contenuto, 'Preparare slide per il cliente');
  assert.equal(a.data, null);
  assert.equal(a.priorita, 4);
});

test('durata breve aggiunge @veloce', () => {
  const a = analizzaMessaggio('rispondere a mail di Bianchi 10 min', OGGI, PROGETTI);
  assert.equal(a.progetto, null);
  assert.equal(a.durata, 10);
  assert.ok(a.etichette.includes('veloce'));
  assert.equal(a.contenuto, 'Rispondere a mail di Bianchi');
});

test('nome esame come prefisso e durata in ore', () => {
  const a = analizzaMessaggio('reti di calcolatori: ripassare capitolo 3 domani 1,5 ore', OGGI, PROGETTI);
  assert.equal(a.progetto, 'Studio');
  assert.equal(a.sezione, 'Reti di calcolatori');
  assert.equal(a.durata, 90);
  assert.equal(a.data, '2026-11-18');
});

test('ricorrenze passate a Todoist in italiano', () => {
  const a = analizzaMessaggio('bolletta: pagare luce ogni mese il 10', OGGI, PROGETTI);
  assert.equal(a.progetto, 'Personale');
  assert.equal(a.sezione, 'Bollette ricorrenti');
  assert.equal(a.ricorrente, 'ogni mese il 10');
  assert.equal(a.contenuto, 'Pagare luce');
});

test('formati di data', () => {
  assert.equal(estraiData('entro il 25 novembre', OGGI).data, '2026-11-25');
  assert.equal(estraiData('scade 3 gennaio', OGGI).data, '2027-01-03');
  assert.equal(estraiData('consegna 25/11', OGGI).data, '2026-11-25');
  assert.equal(estraiData('tra 3 giorni', OGGI).data, '2026-11-20');
  assert.equal(estraiData('fra due settimane', OGGI).data, '2026-12-01');
  assert.equal(estraiData('entro il 5', OGGI).data, '2026-12-05');
  assert.equal(estraiData('martedì', OGGI).data, '2026-11-17');
  assert.equal(estraiData('venerdi', OGGI).data, '2026-11-20');
  assert.equal(estraiData('stasera', OGGI).ora, '20:00');
  assert.equal(estraiData('alle 15:30', OGGI).ora, '15:30');
});

test('ora di Roma → UTC con ora solare e legale', () => {
  assert.equal(romaToUTC('2026-11-20', '15:00'), '2026-11-20T14:00:00Z');
  assert.equal(romaToUTC('2026-07-20', '15:00'), '2026-07-20T13:00:00Z');
  assert.equal(oraRoma(new Date('2026-11-17T07:00:00Z')).ora, 8);
  assert.equal(oraRoma(new Date('2026-07-17T06:00:00Z')).ora, 8);
});

test('movimenti', () => {
  assert.deepEqual(analizzaMovimento('40 benzina'), { importo: 40, descrizione: 'benzina', categoria: 'benzina' });
  assert.equal(analizzaMovimento('12,50€ pranzo con cliente').importo, 12.5);
  assert.equal(analizzaMovimento('benzina'), null);
});
