import calendar, collections, datetime as dt, json, os, re, sys
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.worksheet.page import PageMargins
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

rows_path, anno, mese, outdir = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4]
MESI = ['', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto',
        'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
GIORNI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
C_BAND, C_TITLE, C_HDR = 'F4F6F8', '660000', '000000'
C_DAY, C_LAV, C_VIA, C_ORD, C_PREP = 'C9DAF8', 'EAD1DC', 'D9D2E9', 'FCE5CD', 'D9EAD3'

def num(v):
    if not v:
        return ''
    s = f'{v:.2f}'.rstrip('0').rstrip('.')
    return s.replace('.', ',')

data = json.load(open(rows_path))
per = collections.defaultdict(lambda: collections.defaultdict(lambda: {'lav': 0.0, 'via': 0.0, 'imp': [], 'prep': False}))
for r in data:
    if not r['name']:
        continue
    d = dt.date.fromisoformat(r['date'])
    if (d.year, d.month) != (anno, mese):
        continue
    g = per[r['name']][d]
    g['lav'] += r['tot']; g['via'] += r['viaggio']; g['prep'] |= r['prep']
    if r['imp'] and r['imp'].lower() not in [i.lower() for i in g['imp']]:
        g['imp'].append(r['imp'])

# Squadra dinamica: tutti i tecnici trovati nei rapportini, esclusi quelli con 0 ore.
nomi = sorted((n for n in per if sum(g['lav'] + g['via'] for g in per[n].values()) > 0),
              key=lambda n: n.upper().replace(' ', ''))
giorni = [dt.date(anno, mese, i) for i in range(1, calendar.monthrange(anno, mese)[1] + 1)]

def scheda(nome):
    righe = []
    for d in giorni:
        g = per[nome].get(d)
        righe.append(dict(data=d.strftime('%d/%m/%Y'), giorno=GIORNI[d.weekday()], weekend=d.weekday() >= 5,
                          lav=g['lav'] if g else 0, via=g['via'] if g else 0,
                          imp=' / '.join(g['imp']) if g else ''))
    tot_lav = sum(r['lav'] for r in righe)
    tot_via = sum(r['via'] for r in righe)
    prep = sum(1 for g in per[nome].values() if g['prep'] and g['lav'] > 0)
    return righe, tot_lav, tot_via, prep

os.makedirs(outdir, exist_ok=True)
base = os.path.join(outdir, f'Ore Tecnici {MESI[mese]}')
HEAD = ['DATA', 'GIORNO SETT.', 'ORE LAVORATE', 'ORE VIAGGIO', 'ORE VIAGGIO IN ORD', 'IMPIANTO']

# PDF
pdfmetrics.registerFont(TTFont('CalB', '/usr/share/fonts/truetype/crosextra/Carlito-Bold.ttf'))
W, H = A4
X = [50.4, 110.1, 195.7, 275.6, 366.9, 458.3, 544.7]
TOP, BAND_H, HDR_H, ROW_H = H - 53.2, 46.0, 12.2, 12.33
def hexcol(c):
    return tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
c = canvas.Canvas(base + '.pdf', pagesize=A4)
c.setTitle(f'Ore Tecnici {MESI[mese]} {anno}')
for nome in nomi:
    righe, tot_lav, tot_via, prep = scheda(nome)
    y = TOP - BAND_H
    c.setFillColorRGB(*hexcol(C_BAND)); c.setStrokeColorRGB(0.85, 0.85, 0.85); c.setLineWidth(0.4)
    c.rect(X[0], y, X[-1] - X[0], BAND_H, fill=1, stroke=1)
    c.setFillColorRGB(*hexcol(C_TITLE)); c.setFont('CalB', 16.5)
    c.drawCentredString((X[0] + X[-1]) / 2, y + BAND_H / 2 - 7, nome.upper())
    y -= HDR_H
    c.setFillColorRGB(0, 0, 0); c.rect(X[0], y, X[-1] - X[0], HDR_H, fill=1, stroke=0)
    c.setFillColorRGB(1, 1, 1); c.setFont('CalB', 7.2)
    for i, h in enumerate(HEAD):
        c.drawCentredString((X[i] + X[i + 1]) / 2, y + 3.6, h)
    c.setLineWidth(0.5); c.setStrokeColorRGB(0, 0, 0)
    for r in righe:
        y -= ROW_H
        fills = [None] * 6 if r['weekend'] else [None, C_DAY, C_LAV, C_VIA, C_ORD, None]
        for i in range(6):
            if fills[i]:
                c.setFillColorRGB(*hexcol(fills[i])); c.rect(X[i], y, X[i + 1] - X[i], ROW_H, fill=1, stroke=0)
        for i in range(7):
            c.line(X[i], y, X[i], y + ROW_H)
        c.line(X[0], y, X[-1], y); c.line(X[0], y + ROW_H, X[-1], y + ROW_H)
        vals = [r['data'], r['giorno'], num(r['lav']), num(r['via']), '', r['imp']]  # ORE VIAGGIO IN ORD sempre vuota
        c.setFillColorRGB(0, 0, 0)
        for i, v in enumerate(vals):
            size = 7.2 if i < 2 else (6.4 if i < 5 else 5.8)
            c.setFont('CalB', size)
            while i == 5 and c.stringWidth(v, 'CalB', size) > X[6] - X[5] - 3 and size > 4:
                size -= 0.2; c.setFont('CalB', size)
            c.drawCentredString((X[i] + X[i + 1]) / 2, y + 3.6, v)
    c.setStrokeColorRGB(0.85, 0.85, 0.85); c.setLineWidth(0.4)
    y_end = y
    for hgt in (6.5, 18.5):
        y -= hgt
        c.line(X[0], y, X[-1], y)
    c.setFillColorRGB(0, 0, 0); c.setFont('CalB', 6.4)
    c.drawCentredString((X[1] + X[2]) / 2, y + 7, 'TOT')
    c.drawCentredString((X[2] + X[3]) / 2, y + 7, num(tot_lav) or '0')
    c.drawCentredString((X[3] + X[4]) / 2, y + 7, num(tot_via) or '0')
    if prep:
        y -= 11.5
        c.setFillColorRGB(*hexcol(C_PREP)); c.rect(X[1], y, X[3] - X[1], 11.5, fill=1, stroke=0)
        c.setStrokeColorRGB(0, 0, 0); c.setLineWidth(0.5); c.rect(X[1], y, X[3] - X[1], 11.5, fill=0, stroke=1)
        c.line(X[2], y, X[2], y + 11.5)
        c.setStrokeColorRGB(0.85, 0.85, 0.85); c.setLineWidth(0.4)
        c.setFillColorRGB(0, 0, 0); c.setFont('CalB', 5.6)
        c.drawCentredString((X[1] + X[2]) / 2, y + 3.6, 'GIORNI PREPOSTO:')
        c.setFont('CalB', 6.4); c.drawCentredString((X[2] + X[3]) / 2, y + 3.6, str(prep))
        c.line(X[0], y, X[1], y); c.line(X[3], y, X[-1], y)
    for i in range(7):
        if not (prep and 1 <= i <= 3):
            c.line(X[i], y, X[i], y_end)
    c.showPage()
c.save()

# EXCEL
wb = Workbook(); wb.remove(wb.active)
thin, hair = Side(style='thin', color='000000'), Side(style='thin', color='D9D9D9')
B = Border(left=thin, right=thin, top=thin, bottom=thin)
BL = Border(left=hair, right=hair, top=hair, bottom=hair)
F = lambda c: PatternFill('solid', fgColor=c)
CENTER = Alignment(horizontal='center', vertical='center')
for nome in nomi:
    righe, tot_lav, tot_via, prep = scheda(nome)
    ws = wb.create_sheet(re.sub(r'[\\/:*?\[\]]', '', nome)[:31] or 'Senza nome')
    for col, w in zip('ABCDEF', [11.9, 17, 15.9, 18.2, 18.2, 17.2]):
        ws.column_dimensions[col].width = w
    ws.merge_cells('A1:F1'); ws.row_dimensions[1].height = 46
    t = ws['A1']; t.value = nome.upper(); t.font = Font(name='Calibri', bold=True, size=18, color=C_TITLE)
    t.alignment = CENTER
    for col in 'ABCDEF':
        ws[f'{col}1'].fill = F(C_BAND); ws[f'{col}1'].border = BL
    for i, h in enumerate(HEAD):
        cell = ws.cell(2, i + 1, h); cell.fill = F(C_HDR); cell.alignment = CENTER
        cell.font = Font(name='Calibri', bold=True, size=10, color='FFFFFF')
    for k, r in enumerate(righe):
        rr = 3 + k
        ws.row_dimensions[rr].height = 15
        d = dt.datetime.strptime(r['data'], '%d/%m/%Y')
        vals = [d, r['giorno'], r['lav'] or None, r['via'] or None, None, r['imp'] or None]
        fills = [None] * 6 if r['weekend'] else [None, C_DAY, C_LAV, C_VIA, C_ORD, None]
        for i, v in enumerate(vals):
            cell = ws.cell(rr, i + 1, v)
            cell.font = Font(name='Calibri', bold=True, size=10 if i < 2 else (9 if i < 5 else 8))
            cell.alignment = CENTER; cell.border = B
            if fills[i]:
                cell.fill = F(fills[i])
        ws.cell(rr, 1).number_format = 'DD/MM/YYYY'
    last = 2 + len(righe)
    tr = last + 2
    ws.row_dimensions[last + 1].height = 8; ws.row_dimensions[tr].height = 22
    ws.cell(tr, 2, 'TOT'); ws.cell(tr, 3, f'=SUM(C3:C{last})'); ws.cell(tr, 4, f'=SUM(D3:D{last})')
    for rr in (last + 1, tr, tr + 1):
        for i in range(1, 7):
            cell = ws.cell(rr, i); cell.border = BL; cell.alignment = CENTER
            cell.font = Font(name='Calibri', bold=True, size=8)
    if prep:
        pr = tr + 1
        a, b = ws.cell(pr, 2, 'GIORNI PREPOSTO:'), ws.cell(pr, 3, prep)
        for cell in (a, b):
            cell.fill = F(C_PREP); cell.border = B; cell.font = Font(name='Calibri', bold=True, size=8)
    ws.print_area = f'A1:F{tr + 1}'
    ws.page_setup.paperSize = ws.PAPERSIZE_A4; ws.page_setup.orientation = 'portrait'
    ws.page_setup.fitToWidth = 1; ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True
    ws.page_margins = PageMargins(left=0.6, right=0.6, top=0.7, bottom=0.7)
    ws.print_options.horizontalCentered = True
    ws.sheet_view.showGridLines = False
wb.save(base + '.xlsx')

# SPLIT PDF: una pagina per tecnico, file chiamato con il nome del tecnico
from pypdf import PdfReader, PdfWriter
split_dir = os.path.join(outdir, f'Ore Tecnici {MESI[mese]} {anno}')
os.makedirs(split_dir, exist_ok=True)
pagine = PdfReader(base + '.pdf').pages
assert len(pagine) == len(nomi), f'pagine PDF {len(pagine)} != tecnici {len(nomi)}'
usati = set()
for nome, pagina in zip(nomi, pagine):
    fn = ' '.join(re.sub(r'[\\/:*?"<>|]', '', nome).split()) or 'Senza nome'
    k, cand = 1, fn
    while cand.lower() in usati:
        k += 1; cand = f'{fn} ({k})'
    usati.add(cand.lower())
    w = PdfWriter(); w.add_page(pagina)
    w.add_metadata({'/Title': f'Ore {nome} {MESI[mese]} {anno}'})
    with open(os.path.join(split_dir, cand + '.pdf'), 'wb') as f:
        w.write(f)
# Sottocartella con i due file completi (PDF ed Excel)
import shutil
compl_dir = os.path.join(split_dir, 'Riepilogo completo')
os.makedirs(compl_dir, exist_ok=True)
for ext in ('.pdf', '.xlsx'):
    shutil.copy2(base + ext, compl_dir)
print('SPLIT', split_dir, len(nomi), 'file')
print('COMPLETI', compl_dir, sorted(os.listdir(compl_dir)))

for nome in nomi:
    _, l, v, p = scheda(nome)
    print(f'{nome:25s} lavorate {num(l) or 0:>6}  viaggio {num(v) or 0:>6}  preposto {p}')
print(base + '.pdf', base + '.xlsx')
