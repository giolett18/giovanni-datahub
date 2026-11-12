"""Genera rapportini giornalieri FITTIZI nello stesso formato di quelli reali.

Servono solo per provare la pipeline: tecnici, impianti e ore sono inventati.
Uso: python3 genera_dati_esempio.py CARTELLA_OUTPUT ANNO MESE
"""
import calendar, datetime as dt, os, random, sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side

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
    stile(ws, r - 1)

LARGHEZZE = {'A': 12, 'B': 16, 'C': 11, 'D': 2, 'E': 2, 'F': 2, 'G': 2,
             'H': 16, 'I': 12, 'J': 13, 'K': 20}
BORDO = Border(*(Side(style='thin', color='A6A6A6'),) * 4)


def stile(ws, ultima):
    """Solo aspetto grafico: larghezze, intestazione e formati. I valori non cambiano."""
    for col, w in LARGHEZZE.items():
        ws.column_dimensions[col].width = w
    ws['A1'].font = Font(bold=True, size=14, color='1F4E79')
    for col in 'ABCHIJK':
        c = ws[f'{col}3']
        c.font = Font(bold=True, color='FFFFFF')
        c.fill = PatternFill('solid', fgColor='1F4E79')
        c.alignment = Alignment(horizontal='center', vertical='center')
        c.border = BORDO
        for r in range(4, ultima + 1):
            cella = ws[f'{col}{r}']
            cella.border = BORDO
            if col != 'B' and col != 'K':
                cella.alignment = Alignment(horizontal='center')
    for r in range(4, ultima + 1):
        ws[f'A{r}'].number_format = 'DD/MM/YYYY'
        for col in 'HIJ':
            if col != 'I' or isinstance(ws[f'{col}{r}'].value, dt.time):
                ws[f'{col}{r}'].number_format = 'hh:mm'
    ws[f'A{ultima + 2}'].font = Font(bold=True)
    ws.page_setup.orientation = 'landscape'
    ws.page_setup.fitToWidth = 1
    ws.sheet_properties.pageSetUpPr.fitToPage = True


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
