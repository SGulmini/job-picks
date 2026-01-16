# Production Deployment Guide

## Problema: Production non aggiornata

Se la versione production (https://job-picks.vercel.app/) non ha le ultime modifiche mentre la preview funziona, segui questi passi:

## 1. Verifica che le modifiche siano su GitHub

```bash
git log --oneline -5
git status
```

Assicurati che tutti i commit siano stati pushati su `origin/main`.

## 2. Forza il Redeploy su Vercel

### Opzione A: Via Dashboard Vercel (Consigliato)

1. Vai su https://vercel.com/dashboard
2. Seleziona il progetto `job-picks`
3. Vai alla tab **"Deployments"**
4. Trova l'ultimo deployment (dovrebbe essere quello con il commit più recente)
5. Se non c'è un nuovo deployment, clicca su **"Redeploy"** → **"Redeploy"** (o **"Deploy"** → **"Create Deployment"**)
6. Seleziona il branch `main` e clicca **"Deploy"**

### Opzione B: Via Git (Automatico)

Se Vercel è configurato per auto-deploy da GitHub:
1. Fai un commit vuoto per triggerare un nuovo deploy:
   ```bash
   git commit --allow-empty -m "Trigger production redeploy"
   git push origin main
   ```

### Opzione C: Via Vercel CLI

```bash
vercel --prod
```

## 3. Verifica che la Tabella Supabase Esista

Il problema del CV che non si salva potrebbe essere dovuto alla tabella Supabase mancante.

### Controlla se la tabella esiste:

1. Vai su https://app.supabase.com
2. Seleziona il tuo progetto
3. Vai su **"Table Editor"** nel menu laterale
4. Cerca la tabella `candidate_profiles`
5. Se **NON esiste**, esegui lo script SQL:

### Esegui lo Script SQL:

1. Vai su **"SQL Editor"** nel menu laterale
2. Clicca su **"New query"**
3. Copia e incolla il contenuto del file `supabase_migration.sql`
4. Clicca su **"Run"** o premi `Ctrl+Enter`
5. Verifica che la tabella sia stata creata in **"Table Editor"**

## 4. Verifica le Variabili d'Ambiente in Production

Assicurati che tutte le variabili d'ambiente siano configurate in Vercel Production:

1. Vai su https://vercel.com/dashboard
2. Seleziona il progetto `job-picks`
3. Vai su **"Settings"** → **"Environment Variables"**
4. Verifica che ci siano tutte queste variabili:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (se usata)
   - `STRIPE_SECRET_KEY` (se usata)
   - `STRIPE_WEBHOOK_SECRET` (se usata)
   - `ADZUNA_APP_ID`
   - `ADZUNA_APP_KEY`
   - E tutte le altre necessarie

5. Assicurati che siano configurate per **"Production"** (non solo Preview)

## 5. Pulisci la Cache del Browser

Dopo il redeploy, pulisci la cache del browser:

1. Apri gli strumenti per sviluppatori (F12)
2. Clicca con il tasto destro sul pulsante di refresh
3. Seleziona **"Empty Cache and Hard Reload"** (o **"Svuota cache e ricarica forzatamente"**)

Oppure:
- Chrome/Edge: `Ctrl+Shift+Delete` → Seleziona "Cached images and files" → "Clear data"
- Firefox: `Ctrl+Shift+Delete` → Seleziona "Cache" → "Clear Now"

## 6. Verifica il Deploy

Dopo il redeploy:

1. Vai su https://job-picks.vercel.app/
2. Apri la console del browser (F12 → Console)
3. Cerca eventuali errori
4. Prova a fare logout e verifica che non si rilogga automaticamente
5. Prova a salvare il CV e verifica che venga salvato

## 7. Debug: Controlla i Log

Se ci sono ancora problemi:

1. Vai su https://vercel.com/dashboard
2. Seleziona il progetto `job-picks`
3. Vai su **"Deployments"** → clicca sull'ultimo deployment
4. Vai su **"Functions"** → seleziona una funzione → **"Logs"**
5. Cerca errori relativi a:
   - Supabase (tabella mancante, errori RLS)
   - Logout (sessioni non cancellate)
   - CV (errori di salvataggio)

## Troubleshooting Comune

### Problema: "Table does not exist"
**Soluzione**: Esegui lo script SQL in `supabase_migration.sql` (vedi punto 3)

### Problema: Logout non funziona
**Soluzione**: 
- Verifica che il deploy sia completato
- Pulisci la cache del browser
- Controlla la console per errori

### Problema: CV non si salva
**Soluzione**:
- Verifica che la tabella `candidate_profiles` esista in Supabase
- Controlla i log in Vercel per errori
- Verifica che le variabili d'ambiente Supabase siano configurate correttamente

### Problema: Le modifiche non appaiono
**Soluzione**:
- Forza un redeploy (vedi punto 2)
- Pulisci la cache del browser
- Verifica che il commit sia stato pushato su GitHub
