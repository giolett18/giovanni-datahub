import os
import csv
import shutil
import argparse
import sys

# Costanti di default
CARTELLA_FILE = 'path/alla/cartella'
FILE_RIEPILOGO = os.path.join(CARTELLA_FILE, 'recap.csv')

# Mappatura delle estensioni alle categorie di file
CATEGORIE = {
    'audio': {'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'},
    'immagini': {'jpg', 'jpeg', 'png', 'gif', 'bmp', 'tiff', 'svg'},
    'documenti': {'pdf', 'doc', 'docx', 'odt', 'txt', 'csv', 'xls', 'xlsx', 'ppt', 'pptx'},
}


def parse_args():
    """
    Argomenti CLI:
      - filename: nome del file (scelto tra quelli presenti in CARTELLA_FILE)
      - --root: cartella di lavoro (default CARTELLA_FILE)
    """
    files = [f for f in os.listdir(CARTELLA_FILE)
             if os.path.isfile(os.path.join(CARTELLA_FILE, f))
             and os.path.abspath(os.path.join(CARTELLA_FILE, f)) != os.path.abspath(FILE_RIEPILOGO)]
    parser = argparse.ArgumentParser(
        description='Sposta un file dalla cartella base nella categoria corretta e aggiorna il recap.'
    )
    parser.add_argument(
        'filename',
        choices=sorted(files, key=str.lower),
        help='Scegli un file da spostare dalla cartella base'
    )
    parser.add_argument(
        '--root', '-r',
        default=CARTELLA_FILE,
        help='Cartella di lavoro (default: %(default)s)'
    )
    return parser.parse_args()


def main():
    args = parse_args()
    root = args.root
    nome = args.filename
    percorso_old = os.path.join(root, nome)

    # Determina estensione e categoria
    est = os.path.splitext(nome)[1].lstrip('.').lower()
    if est in CATEGORIE['audio']:
        categoria = 'audio'
    elif est in CATEGORIE['immagini']:
        categoria = 'immagini'
    elif est in CATEGORIE['documenti']:
        categoria = 'documenti'
    else:
        categoria = 'altro'

    dest_dir = os.path.join(root, categoria)
    os.makedirs(dest_dir, exist_ok=True)
    percorso_new = os.path.join(dest_dir, nome)

    try:
        shutil.move(percorso_old, percorso_new)
    except Exception as e:
        print(f"Errore nello spostamento: {e}", file=sys.stderr)
        sys.exit(1)

    # Aggiorna il CSV di recap
    header = ['nome_file', 'percorso_vecchio', 'percorso_nuovo']
    if not os.path.exists(FILE_RIEPILOGO):
        with open(FILE_RIEPILOGO, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(header)
    with open(FILE_RIEPILOGO, 'a', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([nome, percorso_old, percorso_new])

    print(f"File '{nome}' spostato in '{dest_dir}' e recap aggiornato.")


if __name__ == '__main__':
    main()
