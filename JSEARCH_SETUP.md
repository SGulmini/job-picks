# JSearch API Setup Guide

## Overview

JSearch API è stata integrata come secondo provider di job postings (oltre ad Adzuna). JSearch fornisce link diretti alle posizioni, evitando i redirect di Adzuna.

## Configurazione

### 1. Ottieni la API Key

1. Vai su [RapidAPI JSearch](https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch)
2. Clicca su "Subscribe to Test" (gratuito - 500 richieste/mese)
3. Copia la tua API Key (X-RapidAPI-Key)

### 2. Aggiungi la variabile d'ambiente

Aggiungi questa riga al tuo file `.env.local`:

```bash
JSEARCH_API_KEY=your_rapidapi_key_here
```

### 3. Test locale

1. Riavvia il server di sviluppo:
   ```bash
   npm run dev
   ```

2. Vai su `http://localhost:3000/home` e cerca dei job
3. Controlla i log del server - dovresti vedere:
   ```
   [Multi-Provider] Added X jobs from Adzuna
   [Multi-Provider] Added Y jobs from JSearch
   ```

## Come funziona

- **Se JSEARCH_API_KEY è configurata**: Il sistema usa sia Adzuna che JSearch, combinando i risultati
- **Se JSEARCH_API_KEY NON è configurata**: Il sistema usa solo Adzuna (comportamento originale)

## Vantaggi di JSearch

1. **Link diretti**: JSearch fornisce `job_apply_link` che va direttamente al sito del datore di lavoro, senza passare per redirect
2. **Più risultati**: Combinando Adzuna + JSearch ottieni più job postings
3. **Diversificazione**: Se un provider fallisce, l'altro può ancora fornire risultati

## Limitazioni

- **Free tier**: 500 richieste/mese (sufficiente per test)
- **Rate limiting**: Non fare troppe richieste in poco tempo
- **Copertura geografica**: JSearch ha una buona copertura ma potrebbe variare per paese

## Note per il deploy

Quando fai il deploy su Vercel:

1. Vai su Vercel Dashboard → Settings → Environment Variables
2. Aggiungi `JSEARCH_API_KEY` con il valore della tua RapidAPI key
3. Fai un nuovo deploy

## Debugging

Se non vedi job da JSearch:

1. Controlla che `JSEARCH_API_KEY` sia configurata correttamente
2. Controlla i log del server per errori
3. Verifica che la tua RapidAPI subscription sia attiva
4. Controlla i rate limits su RapidAPI dashboard
