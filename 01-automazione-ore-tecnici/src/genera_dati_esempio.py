"""Genera rapportini giornalieri FITTIZI nello stesso formato di quelli reali.

Servono solo per provare la pipeline: tecnici, impianti e ore sono inventati.
Uso: python3 genera_dati_esempio.py CARTELLA_OUTPUT ANNO MESE
"""
import calendar, datetime as dt, os, random, sys
from openpyxl import Workbook

out, anno, mese = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
random.seed(42)
os.makedirs(out, exist_ok=True)

SQUADRE = {
    'Squadra Nord': ['Tecnico A', 'Tecnico B', 'Tecnico C'],
    'Squadra Sud': ['Tecnico D', 'Tecnico E', 'Tecnico F'],
}
IMPIANTI = ['Impianto FV Alfa', 'Impianto FV Beta', 'Cabina Gamma', 'Impianto FV Delta', 'Cabina Epsilon']

def ora(h):
    """Ore come orario Excel (es. 1,5 -> 01:30), come nei rapportini reali."""
    return dt.time(int(h), int(round((h % 1) * 60))) if h else None


def foglio(ws, giorno, squadra, impianto):
    ws['A1'] = 'RAPPORTINO GIORNALIERO'
    ws['A3'] = 'DATA'; ws['B3'] = 'NOME TECNICO'; ws['C3'] = 'PREPOSTO'
    ws['H3'] = 'STRAORDINARIO'; ws['I3'] = 'ORE TOTALI'; ws['J3'] = 'ORE VIAGGIO'; ws['K3'] = 'IMPIANTO'
    r = 4
    for i, nome in enumerate(squadra):
        if random.random() < 0.1:          # assenza
            continue
        viaggio = random.choice([0, 0.5, 1, 1.5, 2])
        solo_viaggio = random.random() < 0.05
        ore = 0 if solo_viaggio else random.choice([4, 6, 8, 8, 8, 9, 10])
        ws.cell(r, 1, dt.datetime.combine(giorno, dt.time()))
        ws.cell(r, 2, nome)
        ws.cell(r, 3, 'X' if i == 0 else None)              # il primo della squadra fa da preposto
        ws.cell(r, 8, ora(max(0, ore - 8)))
        ws.cell(r, 9, dt.time(ore) if ore and random.random() < 0.3 else ore)  # formati misti, come nei file reali
        ws.cell(r, 10, ora(viaggio))
        ws.cell(r, 11, impianto)
        r += 1
    ws.cell(r + 1, 1, "ATTIVITA' SVOLTE:")
    ws.cell(r + 2, 1, 'Manutenzione ordinaria e verifiche.')

for nome_squadra, tecnici in SQUADRE.items():
    wb = Workbook(); wb.remove(wb.active)
    wb.create_sheet('recap')['A1'] = 'Riepilogo manuale (ignorato dalla pipeline)'
    for g in range(1, calendar.monthrange(anno, mese)[1] + 1):
        d = dt.date(anno, mese, g)
        if d.weekday() >= 5:
            continue
        foglio(wb.create_sheet(str(g)), d, tecnici, random.choice(IMPIANTI))
        if random.random() < 0.15:          # secondo impianto nello stesso giorno: foglio "Nb"
            foglio(wb.create_sheet(f'{g}b'), d, tecnici[:2], random.choice(IMPIANTI))
    wb.save(os.path.join(out, f'{nome_squadra}.xlsx'))
print('Rapportini creati in', out)
