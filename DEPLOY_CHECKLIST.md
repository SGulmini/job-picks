# Checklist per Deploy su Vercel

## Prima del Deploy

### 1. Verifica che tutte le modifiche siano committate

```bash
git status
git add .
git commit -m "Add cover letter templates, creative option, and custom instructions features"
git push origin main
```

### 2. Verifica le Variabili d'Ambiente in Vercel

Vai su https://vercel.com/dashboard → Il tuo progetto → Settings → Environment Variables

Assicurati che ci siano tutte queste variabili per **Production**:

#### Supabase
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (se usata)

#### OpenAI
- `OPENAI_API_KEY`
- `OPENAI_MODEL` (opzionale, default: gpt-4o-mini)

#### Job APIs
- `ADZUNA_APP_ID`
- `ADZUNA_APP_KEY`
- `JSEARCH_API_KEY`

#### Stripe (se usato)
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

### 3. Esegui le Migrazioni SQL in Supabase

#### A. Tabella candidate_profiles (se non esiste già)
1. Vai su https://app.supabase.com → Il tuo progetto → SQL Editor
2. Esegui il contenuto di `supabase_migration.sql`
3. Se la tabella esiste già, esegui `supabase_migration_add_phrases.sql` per aggiungere il campo `cv_custom_phrases`

#### B. Tabella cover_letter_templates (NUOVA)
1. Vai su https://app.supabase.com → Il tuo progetto → SQL Editor
2. Esegui il contenuto di `supabase_migration_templates.sql`

### 4. Verifica il Build Locale

```bash
npm run build
```

Se il build fallisce, risolvi gli errori prima di fare il deploy.

## Deploy su Vercel

### Opzione 1: Deploy Automatico (se connesso a GitHub)

Se il progetto è già connesso a GitHub, Vercel farà il deploy automaticamente quando fai push su `main`:

```bash
git push origin main
```

Poi vai su https://vercel.com/dashboard e verifica che il deploy sia partito.

### Opzione 2: Deploy Manuale via Vercel CLI

Se non hai ancora configurato Vercel CLI:

```bash
npm install -g vercel
vercel login
vercel --prod
```

### Opzione 3: Deploy via Dashboard Vercel

1. Vai su https://vercel.com/dashboard
2. Seleziona il progetto `job-picks`
3. Vai su **"Deployments"**
4. Clicca su **"Deploy"** → **"Create Deployment"**
5. Seleziona il branch `main` e clicca **"Deploy"**

## Dopo il Deploy

### 1. Verifica che il Deploy sia Completato

Vai su https://vercel.com/dashboard → Il tuo progetto → Deployments
Verifica che l'ultimo deploy sia "Ready" (verde) e non "Error" (rosso).

### 2. Testa le Nuove Funzionalità

Vai su https://job-picks.vercel.app/ e verifica:

- ✅ **Cover Letter Templates**: Vai su `/cover-letters` e verifica che funzioni
- ✅ **Creative Option**: Genera una cover letter e verifica che ci sia il pulsante "Creative"
- ✅ **Custom Instructions**: Genera una cover letter, aggiungi istruzioni personalizzate e rigenera
- ✅ **External Job Link**: Prova a generare una cover letter da un link esterno (con e senza link)
- ✅ **CV Custom Phrases**: Vai su `/cover-letter/setup` e verifica che la sezione "CV Personalization Phrases" funzioni

### 3. Verifica i Log in Caso di Errori

Se qualcosa non funziona:
1. Vai su https://vercel.com/dashboard → Il tuo progetto → Deployments
2. Clicca sull'ultimo deploy
3. Vai su **"Functions"** → seleziona una funzione → **"Logs"**
4. Cerca errori

### 4. Pulisci la Cache del Browser

Dopo il deploy, pulisci la cache:
- Chrome/Edge: `Ctrl+Shift+Delete` → "Cached images and files" → "Clear data"
- Firefox: `Ctrl+Shift+Delete` → "Cache" → "Clear Now"

Oppure usa una finestra in incognito.

## Troubleshooting

### Problema: "Table does not exist"
**Soluzione**: Esegui le migrazioni SQL in Supabase (vedi punto 3)

### Problema: "OPENAI_API_KEY is not configured"
**Soluzione**: Aggiungi la variabile d'ambiente in Vercel Settings → Environment Variables

### Problema: Le modifiche non appaiono
**Soluzione**: 
- Forza un redeploy
- Pulisci la cache del browser
- Verifica che il commit sia stato pushato

### Problema: Build fallisce su Vercel
**Soluzione**: 
- Verifica i log del build in Vercel
- Controlla che tutte le dipendenze siano in `package.json`
- Verifica che `next.config.ts` sia corretto
