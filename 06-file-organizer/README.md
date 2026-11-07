# File Organizer

Script Python che riordina una cartella disordinata:
1. sposta ogni file in una sottocartella per tipo (audio, immagini, documenti) in base all'estensione;
2. scrive un riepilogo CSV con il percorso vecchio e quello nuovo di ogni file ([esempio](recap_esempio.csv));
3. analizza ricorsivamente le immagini.

Utilizzabile come notebook ([`file_organizer.ipynb`](file_organizer.ipynb)) o da riga di comando ([`move_file.py`](move_file.py)).

**Strumenti:** Python (os, shutil, csv, argparse), NumPy.
