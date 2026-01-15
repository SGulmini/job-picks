# Come connettersi con Adzuna API

## Passo 1: Registrazione su Adzuna

1. Vai su [https://developer.adzuna.com/signup](https://developer.adzuna.com/signup)
2. Crea un account gratuito
3. Completa la registrazione

## Passo 2: Ottenere le chiavi API

1. Dopo il login, vai al tuo dashboard sviluppatore
2. Troverai due valori:
   - **APP_ID**: Il tuo Application ID
   - **APP_KEY**: La tua Application Key

## Passo 3: Configurare le variabili d'ambiente

1. Apri il file `.env.local` nella root del progetto
2. Sostituisci i valori placeholder con le tue chiavi reali:

```env
ADZUNA_APP_ID=il_tuo_app_id_qui
ADZUNA_APP_KEY=la_tua_app_key_qui
```

## Passo 4: Riavviare il server di sviluppo

Dopo aver aggiunto le variabili d'ambiente, riavvia il server:

```bash
npm run dev
```

## Verifica

Una volta configurato, quando selezioni un profilo e vai alla pagina home, dovresti vedere i lavori reali da Adzuna invece di messaggi di errore.

## Note importanti

- Le chiavi API sono sensibili: **NON** committare il file `.env.local` su Git
- Il file `.env.local` è già nel `.gitignore` per sicurezza
- Adzuna ha limiti di utilizzo per il piano gratuito (controlla i termini di servizio)
- L'attribuzione "Jobs by Adzuna" è già inclusa nell'interfaccia

## Problemi comuni

**Errore: "Adzuna API credentials not configured"**
- Verifica che il file `.env.local` esista nella root del progetto
- Controlla che le variabili siano scritte correttamente (senza spazi extra)
- Riavvia il server di sviluppo dopo aver modificato `.env.local`

**Errore: "Adzuna API error: 401"**
- Le tue chiavi API non sono valide o sono scadute
- Verifica di aver copiato correttamente APP_ID e APP_KEY dal dashboard Adzuna

**Errore: "Adzuna API error: 429"**
- Hai superato il limite di richieste del piano gratuito
- Aspetta qualche minuto prima di riprovare
