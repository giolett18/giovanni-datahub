"""Genera rapportini giornalieri FITTIZI usando lo stesso modello dei rapportini reali.

Il modello (modello_rapportino.xlsx) è il foglio Google Sheets usato dalle squadre,
svuotato di ogni dato reale. Tecnici, clienti, impianti e ore qui sono inventati.
Uso: python3 genera_dati_esempio.py CARTELLA_OUTPUT ANNO MESE
"""
import calendar, datetime as dt, os, random, sys
from openpyxl import Workbook, load_workbook

out, anno, mese = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
random.seed(42)
os.makedirs(out, exist_ok=True)
MODELLO = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'modello_rapportino.xlsx')

SQUADRE = {
    'Squadra Nord': ['Tecnico A', 'Tecnico B', 'Tecnico C'],
    'Squadra Sud': ['Tecnico D', 'Tecnico E', 'Tecnico F'],
}
IMPIANTI = [('Impianto FV Alfa', 'Cosenza'), ('Impianto FV Beta', 'Rende'), ('Cabina Gamma', 'Lamezia Terme'),
            ('Impianto FV Delta', 'Crotone'), ('Cabina Epsilon', 'Vibo Valentia')]
ATTIVITA = ['MONTAGGIO', 'MANUTENZIONE', 'COLLAUDO', 'SMONTAGGIO']
MESI = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto',
        'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
PRIMA_RIGA, ULTIMA_RIGA = 24, 30          # righe tecnici nel modello


def ora(h):
    """Ore come orario Excel (es. 1,5 -> 01:30), come nei rapportini reali."""
    return dt.time(int(h), int(round((h % 1) * 60)))


def orari(ore):
    """Entrata/uscita mattina e pomeriggio per un giorno da `ore` ore ordinarie (max 8)."""
    if ore == 0:
        return [None] * 4
    if ore <= 4:
        return [dt.time(8), ora(8 + ore), None, None]
    return [dt.time(8), dt.time(12), dt.time(13), ora(13 + ore - 4)]


def foglio(ws, giorno, squadra, impianto, luogo):
    ws['B2'] = 'Cliente Alfa'; ws['D2'] = impianto; ws['F2'] = luogo; ws['H2'] = squadra[0]
    ws['B4'] = 'Committente Uno'
    ws['B7'] = 'Interruttore AT modello X'; ws['B9'] = f'SN-{random.randint(10000, 99999)}'
    att = random.choice(ATTIVITA)
    for r in range(7, 12):                                   # spunta l'attività del giorno
        ws.cell(r, 6, 'X' if ws.cell(r, 7).value == att else None)
    ws['B14'] = MESI[giorno.month]; ws['D14'] = giorno.year
    ws['D33'] = 'Attività di esempio: verifiche e misure su apparecchiature AT.'
    r = PRIMA_RIGA
    for i, nome in enumerate(squadra):
        if random.random() < 0.1:          # assenza
            continue
        viaggio = random.choice([0, 0.5, 1, 1.5, 2])
        solo_viaggio = random.random() < 0.05
        ore = 0 if solo_viaggio else random.choice([4, 6, 8, 8, 8, 9, 10])
        strao = max(0, ore - 8)
        ws.cell(r, 1, dt.datetime.combine(giorno, dt.time()))
        ws.cell(r, 2, nome)
        ws.cell(r, 3, 'X' if i == 0 else None)               # il primo della squadra fa da preposto
        for c, v in zip(range(4, 8), orari(ore - strao)):
            ws.cell(r, c, v)
        ws.cell(r, 8, ora(strao) if strao else None)
        # Nel foglio reale ORE TOTALI e CP sono formule; qui scriviamo il risultato
        # così il file si legge anche senza ricalcolo.
        ws.cell(r, 9, ora(ore))
        ws.cell(r, 10, ora(viaggio) if viaggio else None)
        ws.cell(r, 11, impianto)
        ws.cell(r, 1).number_format = 'DD/MM/YYYY'
        for c in range(4, 11):
            ws.cell(r, c).number_format = 'hh:mm'
        r += 1


for nome_squadra, tecnici in SQUADRE.items():
    wb = load_workbook(MODELLO)
    modello = wb['MODELLO']
    for g in range(1, calendar.monthrange(anno, mese)[1] + 1):
        d = dt.date(anno, mese, g)
        if d.weekday() >= 5:
            continue
        for nome_foglio, squadra in [(str(g), tecnici)] + ([(f'{g}b', tecnici[:2])] if random.random() < 0.15 else []):
            ws = wb.copy_worksheet(modello)                 # copia formattazione, unioni e larghezze
            ws.title = nome_foglio
            ws.data_validations = modello.data_validations
            foglio(ws, d, squadra, *random.choice(IMPIANTI))
    wb.remove(modello)
    wb.create_sheet('recap')['A1'] = 'Riepilogo manuale (ignorato dalla pipeline)'
    wb.save(os.path.join(out, f'{nome_squadra}.xlsx'))
print('Rapportini creati in', out)
