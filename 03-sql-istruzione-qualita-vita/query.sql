CREATE TABLE dati_mondiali_2023 (
    Paese VARCHAR(255),
    Densità_PKm2 DECIMAL(10,2),
    Abbreviazione CHAR(3),
    Percentuale_Terreno_Agricolo DECIMAL(10,2),
    Superficie_Territoriale_Km2 DECIMAL(15,2),
    Dimensione_Forze_Armata DECIMAL(15,2),
    Tasso_Natalità DECIMAL(10,2),
    Prefisso_Telefonico VARCHAR(10),
    Capitale_Grande_Città VARCHAR(255),
    Emissioni_Co2 DECIMAL(15,2),
    Indice_CPI DECIMAL(10,2),
    Variazione_Percentuale_CPI DECIMAL(10,2),
    Codice_Valuta CHAR(3),
    Tasso_Fertilità DECIMAL(10,2),
    Percentuale_Area_Forestata DECIMAL(10,2),
    Prezzo_Benzina DECIMAL(10,2),
    PIL BIGINT,
    Percentuale_Iscrizioni_Istruzione_Primaria_Lorda DECIMAL(10,2),
    Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda DECIMAL(10,2),
    Mortalità_Infantile DECIMAL(10,2),
    Città_Più_Grande VARCHAR(255),
    Aspettativa_Vita DECIMAL(10,2),
    Rapporto_Mortalità_Materna DECIMAL(10,2),
    Salario_Minimo DECIMAL(15,2),
    Lingua_Ufficiale VARCHAR(255),
    Percentuale_Spese_Sanitarie_Personali DECIMAL(10,2),
    Medici_Per_Mille DECIMAL(10,2),
    Popolazione BIGINT,
    Percentuale_Partecipazione_Forza_Lavoro DECIMAL(10,2),
    Percentuale_Entrate_Fiscali DECIMAL(10,2),
    Percentuale_Totale_Tasse DECIMAL(10,2),
    Percentuale_Tasso_Disoccupazione DECIMAL(10,2),
    Popolazione_Urbana BIGINT,
    Latitudine DECIMAL(10,6),
    Longitudine DECIMAL(10,6)
);


CREATE TABLE dati_energia_sostenibile (
    Entità VARCHAR(255), 
    Anno INT, 
    Accesso_all_elettricità_percentuale_popolazione DECIMAL(10, 2), 
    Accesso_ai_combustibili_puliti_per_cucinare DECIMAL(10, 2),
    Capacità_di_generazione_elettricità_rinnovabile_per_capita DECIMAL(10, 2), 
    Flussi_finanziari_verso_paesi_in_via_di_sviluppo DECIMAL(20, 2), 
    Percentuale_energia_rinnovabile_consumata DECIMAL(10, 2),
    Elettricità_da_combustibili_fossili_TWh DECIMAL(10, 2), 
    Elettricità_da_nucleare_TWh DECIMAL(10, 2), 
    Elettricità_da_rinnovabili_TWh DECIMAL(10, 2), 
    Percentuale_elettricità_low_carbon DECIMAL(10, 2), 
    Consumo_energia_primaria_per_persona_kWh DECIMAL(10, 2), 
    Livello_intensità_energetica_MJ_per_PIL_PPP_2017 DECIMAL(10, 2), 
    Emissioni_di_CO2_kt_per_paese DECIMAL(15, 2),
    Percentuale_energia_primaria_da_rinnovabili DECIMAL(10, 2), 
    Crescita_PIL DECIMAL(10, 2), 
    PIL_pro_capite DECIMAL(15, 2),
    Densità_P_Km2 DECIMAL(10, 2),
    Area_geografica_Km2 DECIMAL(15, 2), 
    Latitudine DECIMAL(10, 6), 
    Longitudine DECIMAL(10, 6)
);



-- 1. Confronto tra Paesi con Alta e Bassa Istruzione ed effetti sulla Disoccupazione e il Salario Minimo

-- prima 'cte' per unire in un'unica tabella esclusivamente le colonne di cui ho bisogno per condurre l'analisi.
WITH Istruzione AS (
    SELECT 
        dm.Paese,
        dm.Percentuale_Iscrizioni_Istruzione_Primaria_Lorda,
        dm.Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda,
        dm.Percentuale_Tasso_Disoccupazione,
        dm.Salario_Minimo
    FROM 
        dati_mondiali_2023 dm
),
-- seconda 'cte' con 'case' per attribuire ad ogni paese un tipo di istruzione. 
-- Se accesso istruzione primaria maggiore di 80 e terziara maggiore di 50 allora siamo in una nazione con 'alta istruzione' altrimenti 'bassa istruzione'
Gruppi AS (
    SELECT 
        Paese,
        CASE
            WHEN Percentuale_Iscrizioni_Istruzione_Primaria_Lorda > 80 AND Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda > 50 
            THEN 'Alta Istruzione'
            ELSE 'Bassa Istruzione'
            END AS Tipo_Istruzione,
            Percentuale_Tasso_Disoccupazione,
            Salario_Minimo
     FROM 
        Istruzione
)
-- Comando select per avere come output la media di disoccupazione e salario minimo correlate al tipo di istruizione.
SELECT 
    Tipo_Istruzione,
    AVG(Percentuale_Tasso_Disoccupazione) AS Media_Disoccupazione,
    AVG(Salario_Minimo) AS Media_Salario_Minimo
FROM 
    Gruppi
GROUP BY 
    Tipo_Istruzione
ORDER BY 
    Tipo_Istruzione DESC;
    
    
    
    
    
-- 2. Confronto tra Paesi con Alta e Bassa Istruzione ed effetti sulla Salute (Aspettativa di Vita e Mortalità Infantile)

-- prima 'cte' per unire in un'unica tabella esclusivamente le colonne di cui ho bisogno per condurre l'analisi.
WITH Istruzione_Salute AS (
    SELECT 
        dm.Paese,
        dm.Percentuale_Iscrizioni_Istruzione_Primaria_Lorda,
        dm.Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda,
        dm.Aspettativa_Vita,
        dm.Mortalità_Infantile
    FROM 
        dati_mondiali_2023 dm
),
-- seconda 'cte' con 'case' per attribuire ad ogni paese un tipo di istruzione. 
-- Se accesso istruzione primaria maggiore di 80 e terziara maggiore di 50 allora siamo in una nazione con 'alta istruzione' altrimenti 'bassa istruzione'
Gruppi_Salute AS (
    SELECT 
        Paese,
        CASE
            WHEN Percentuale_Iscrizioni_Istruzione_Primaria_Lorda > 80 AND Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda > 50 
                THEN 'Alta Istruzione'
            ELSE 'Bassa Istruzione'
        END AS Tipo_Istruzione,
        Aspettativa_Vita,
        Mortalità_Infantile
    FROM 
        Istruzione_Salute
)
-- Comando select per avere come output la media di aspettativa di vita e mortalità infantile correlate al tipo di istruizione.
SELECT 
    Tipo_Istruzione,
    AVG(Aspettativa_Vita) AS Media_Aspettativa_Vita,
    AVG(Mortalità_Infantile) AS Media_Mortalità_Infantile
FROM 
    Gruppi_Salute
GROUP BY 
    Tipo_Istruzione
ORDER BY 
    Tipo_Istruzione DESC;






-- 3. Confronto tra Paesi con Alta e Bassa Istruzione ed effetti sulla Ricchezza del paese (PIL)

-- prima 'cte' per unire in un'unica tabella esclusivamente le colonne di cui ho bisogno per condurre l'analisi.
WITH Istruzione_Ricchezza AS (
    SELECT 
        dm.Paese,
        dm.Percentuale_Iscrizioni_Istruzione_Primaria_Lorda,
        dm.Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda,
        de.PIL_pro_capite
    FROM 
        dati_mondiali_2023 dm
    JOIN 
        dati_energia_sostenibile de ON dm.Paese = de.Paese
),
-- seconda 'cte' con 'case' per attribuire ad ogni paese un tipo di istruzione. 
-- Se accesso istruzione primaria maggiore di 80 e terziara maggiore di 50 allora siamo in una nazione con 'alta istruzione' altrimenti 'bassa istruzione'
Gruppi_Ricchezza AS (
    SELECT 
        Paese,
        CASE
            WHEN Percentuale_Iscrizioni_Istruzione_Primaria_Lorda > 80 AND Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda > 50 
                THEN 'Alta Istruzione'
            ELSE 'Bassa Istruzione'
        END AS Tipo_Istruzione,
        PIL_pro_capite
    FROM 
        Istruzione_Ricchezza
)
-- Comando select per avere come output la media del PIL pro capite correlato al tipo di istruizione.
SELECT 
    Tipo_Istruzione,
    AVG(PIL_pro_capite) AS Media_PIL_Pro_Capite
FROM 
    Gruppi_Ricchezza
GROUP BY 
    Tipo_Istruzione
ORDER BY 
    Tipo_Istruzione DESC;







-- 4. Confronto tra Paesi con Alta e Bassa Istruzione ed effetti sulla Sostenibilità (Emissioni di CO2 e Uso di Energie Rinnovabili)

-- prima 'cte' per unire in un'unica tabella esclusivamente le colonne di cui ho bisogno per condurre l'analisi.
WITH Istruzione_Sostenibilita AS (
    SELECT 
        dm.Paese,
        dm.Percentuale_Iscrizioni_Istruzione_Primaria_Lorda,
        dm.Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda,
        dm.Emissioni_CO2,
        de.Percentuale_energia_rinnovabile_consumata
    FROM 
        dati_mondiali_2023 dm
    JOIN 
        dati_energia_sostenibile de ON dm.Paese = de.Paese
),
-- seconda 'cte' con 'case' per attribuire ad ogni paese un tipo di istruzione. 
-- Se accesso istruzione primaria maggiore di 80 e terziara maggiore di 50 allora siamo in una nazione con 'alta istruzione' altrimenti 'bassa istruzione'
Gruppi_Sostenibilita AS (
    SELECT 
        Paese,
        CASE
            WHEN Percentuale_Iscrizioni_Istruzione_Primaria_Lorda > 80 AND Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda > 50 
                THEN 'Alta Istruzione'
            ELSE 'Bassa Istruzione'
        END AS Tipo_Istruzione,
        Emissioni_CO2,
        Percentuale_energia_rinnovabile_consumata
    FROM 
        Istruzione_Sostenibilita
)
-- Comando select per avere come output la media di emissioni di co2 e di energia rinnovabile consumata correlate al tipo di istruizione.
SELECT 
    Tipo_Istruzione,
    AVG(Emissioni_CO2) AS Media_Emissioni_CO2,
    AVG(Percentuale_energia_rinnovabile_consumata) AS Media_Energia_Rinnovabile_Consumata
FROM 
    Gruppi_Sostenibilita
GROUP BY 
    Tipo_Istruzione
ORDER BY 
    Tipo_Istruzione DESC;








-- 5. migliori 5 paesi per punteggio complessivo sui seguenti parametri: ricchezza, salute, sostenibilità e istruzione.

-- creo la prima cte per il calcolo della media globale di ogni parametro che prenderemo in considerazione.
WITH Media_Globale AS (
    SELECT
        AVG(DM.Salario_Minimo) AS Media_Salario,
        AVG(DM.Percentuale_Tasso_Disoccupazione) AS Media_Disoccupazione,
        AVG(DE.PIL_pro_capite) AS Media_PIL_Pro_Capite,
        AVG(DM.Aspettativa_Vita) AS Media_Aspettativa_Vita,
        AVG(DM.Mortalità_Infantile) AS Media_Mortalità_Infantile,
        AVG(DE.Percentuale_energia_primaria_da_rinnovabili) AS Media_Energia_Rinnovabile,
        AVG(DM.Emissioni_Co2) AS Media_Emissioni_Co2,
        AVG(DM.Percentuale_Iscrizioni_Istruzione_Primaria_Lorda) AS Media_Istruzione_Primaria,
        AVG(DM.Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda) AS Media_Istruzione_Terziaria
    FROM
        dati_mondiali_2023 DM
    JOIN 
        dati_energia_sostenibile DE
    ON 
       DM.Paese = DE.Paese
),
-- creo la seconda 'cte' con delle 'case' interne per assegnare i punteggi ai differenti paesi che superano la media globale in ogni parametro. 
-- Se il parametro per paese > della media globale, allora assegno 1 punto altrimenti 0. 
Migliori_Paesi AS (
    SELECT
        DM.Paese,
        DM.Salario_Minimo,
        DM.Percentuale_Tasso_Disoccupazione,
        DE.PIL_pro_capite,
        DM.Aspettativa_Vita,
        DM.Mortalità_Infantile,
        DE.Percentuale_energia_primaria_da_rinnovabili,
        DM.Emissioni_Co2,
        DM.Percentuale_Iscrizioni_Istruzione_Primaria_Lorda,
        DM.Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda,
       
        CASE 
            WHEN DM.Salario_Minimo > (SELECT Media_Salario FROM Media_Globale) THEN 1 
            ELSE 0 
        END AS Punteggio_Salario,
        
        CASE 
            WHEN DM.Percentuale_Tasso_Disoccupazione < (SELECT Media_Disoccupazione FROM Media_Globale) THEN 1 
            ELSE 0 
        END AS Punteggio_Disoccupazione,
        
        CASE 
            WHEN DE.PIL_pro_capite > (SELECT Media_PIL_Pro_Capite FROM Media_Globale) THEN 1 
            ELSE 0 
        END AS Punteggio_PIL_Pro_Capite,
        
        CASE 
            WHEN DM.Aspettativa_Vita > (SELECT Media_Aspettativa_Vita FROM Media_Globale) THEN 1 
            ELSE 0 
        END AS Punteggio_Aspettativa_Vita,
        
        CASE 
            WHEN DM.Mortalità_Infantile < (SELECT Media_Mortalità_Infantile FROM Media_Globale) THEN 1 
            ELSE 0 
        END AS Punteggio_Mortalità_Infantile,
        
        CASE 
            WHEN DE.Percentuale_energia_primaria_da_rinnovabili > (SELECT Media_Energia_Rinnovabile FROM Media_Globale) THEN 1 
            ELSE 0 
        END AS Punteggio_Energia_Rinnovabile,
        
        CASE 
            WHEN DM.Emissioni_Co2 < (SELECT Media_Emissioni_Co2 FROM Media_Globale) THEN 1 
            ELSE 0 
        END AS Punteggio_Emissioni_Co2,
        
        CASE 
            WHEN DM.Percentuale_Iscrizioni_Istruzione_Primaria_Lorda > (SELECT Media_Istruzione_Primaria FROM Media_Globale) THEN 1 
            ELSE 0 
        END AS Punteggio_Istruzione_Primaria,
        
        CASE 
            WHEN DM.Percentuale_Iscrizioni_Istruzione_Terziaria_Lorda > (SELECT Media_Istruzione_Terziaria FROM Media_Globale) THEN 1 
            ELSE 0 
        END AS Punteggio_Istruzione_Terziaria
    FROM
        dati_mondiali_2023 DM
    JOIN 
        dati_energia_sostenibile DE
    ON 
        DM.Paese = DE.Paese
)
-- per finire inserisco un comando Select per ricevere come output il nome del paese e il punteggio complessivo ottenuto (somma di tutti i parametri), 
-- ordino per punteggio complessivo DESC con LIMIT di 5 per sapere le migliori 5 nazioni.
SELECT
    Paese,
    (Punteggio_Salario + Punteggio_Disoccupazione + Punteggio_PIL_Pro_Capite + Punteggio_Aspettativa_Vita + 
    Punteggio_Mortalità_Infantile + Punteggio_Energia_Rinnovabile + Punteggio_Emissioni_Co2 + 
    Punteggio_Istruzione_Primaria + Punteggio_Istruzione_Terziaria) AS Punteggio_Complessivo
FROM 
    Migliori_Paesi
GROUP BY
    Paese
ORDER BY 
    Punteggio_Complessivo DESC
LIMIT 5;


