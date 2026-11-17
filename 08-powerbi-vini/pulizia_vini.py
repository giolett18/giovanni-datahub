import os, sys, re
import pandas as pd

src, out_dir = sys.argv[1], sys.argv[2]
df = pd.read_csv(src, encoding="utf-8", index_col=0)
log = {"righe_iniziali": len(df)}

df = df.drop_duplicates(subset=["title", "description"])
log["dopo_duplicati"] = len(df)
df = df.dropna(subset=["price", "country", "variety"])
log["dopo_mancanti"] = len(df)

df["Annata"] = df["title"].str.extract(r"\b(19[5-9]\d|20[0-2]\d)\b")[0].astype("Int64")

bins = [0, 15, 30, 50, 100, float("inf")]
labels = ["1. Fino a 15$", "2. 15-30$", "3. 30-50$", "4. 50-100$", "5. Oltre 100$"]
df["Fascia prezzo"] = pd.cut(df["price"], bins=bins, labels=labels, right=True).astype(str)

def giudizio(p):
    if p >= 95: return "4. Straordinario (95-100)"
    if p >= 90: return "3. Eccellente (90-94)"
    if p >= 85: return "2. Molto buono (85-89)"
    return "1. Buono (80-84)"
df["Giudizio"] = df["points"].apply(giudizio)

out = df.rename(columns={
    "country": "Paese", "province": "Provincia", "region_1": "Regione", "variety": "Varieta",
    "winery": "Cantina", "title": "Vino", "points": "Punteggio", "price": "Prezzo",
    "taster_name": "Degustatore"})[
    ["Vino", "Cantina", "Paese", "Provincia", "Regione", "Varieta", "Annata",
     "Punteggio", "Prezzo", "Fascia prezzo", "Giudizio", "Degustatore"]]
out["Prezzo"] = out["Prezzo"].round(0).astype(int)
out.insert(0, "ID", range(1, len(out) + 1))

out.to_csv(os.path.join(out_dir, "vini_puliti.csv"), index=False, encoding="utf-8-sig")
log["righe_finali"] = len(out)
print(log)

# ---- analisi per le conclusioni ----
pd.set_option("display.width", 200)
print("\nPer fascia di prezzo:")
print(out.groupby("Fascia prezzo").agg(n=("ID", "count"), punti=("Punteggio", "mean"), prezzo=("Prezzo", "mean")).round(1))

out["qp"] = out["Punteggio"] / out["Prezzo"]
paesi = out.groupby("Paese").agg(n=("ID", "count"), punti=("Punteggio", "mean"),
                                prezzo=("Prezzo", "median"), qp=("qp", "mean"))
paesi = paesi[paesi.n >= 500].sort_values("qp", ascending=False)
print("\nPaesi (>=500 vini), ordinati per indice Q/P medio:")
print(paesi.round(2))

var = out.groupby("Varieta").agg(n=("ID", "count"), punti=("Punteggio", "mean"),
                               prezzo=("Prezzo", "median"), qp=("qp", "mean"))
var = var[var.n >= 1000].sort_values("qp", ascending=False)
print("\nVarieta (>=1000 vini):")
print(var.round(2))

aff = out[(out.Punteggio >= 90) & (out.Prezzo <= 20)]
print(f"\nAffari (>=90 punti, <=20$): {len(aff)} vini ({len(aff)/len(out):.1%})")
print(aff.groupby("Paese").size().sort_values(ascending=False).head(8))
print(aff.groupby("Varieta").size().sort_values(ascending=False).head(8))
print("\nCorrelazione prezzo/punteggio:", round(out["Prezzo"].corr(out["Punteggio"]), 3))
it = out[out.Paese == "Italy"]
print("\nItalia per provincia:")
print(it.groupby("Provincia").agg(n=("ID", "count"), punti=("Punteggio", "mean"), prezzo=("Prezzo", "median"), qp=("qp", "mean")).sort_values("n", ascending=False).head(8).round(2))
