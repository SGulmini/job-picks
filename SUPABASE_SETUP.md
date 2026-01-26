# Setup Supabase per la sincronizzazione cross-device

Per far funzionare la sincronizzazione dei dati del candidato tra dispositivi, devi creare la tabella in Supabase.

## Passi da seguire:

1. **Apri il dashboard Supabase**
   - Vai su https://supabase.com/dashboard
   - Seleziona il tuo progetto

2. **Apri SQL Editor**
   - Nel menu laterale, clicca su "SQL Editor"
   - Clicca su "New query"

3. **Esegui lo script SQL**
   - Copia e incolla il contenuto del file `supabase_migration.sql`
   - Clicca su "Run" o premi Ctrl+Enter

4. **Verifica che la tabella sia stata creata**
   - Vai su "Table Editor" nel menu laterale
   - Dovresti vedere la tabella `candidate_profiles`

## Cosa fa lo script:

- Crea la tabella `candidate_profiles` con tutti i campi necessari (incluso `cv_custom_phrases` per le frasi personalizzabili)
- Configura Row Level Security (RLS) per la sicurezza
- Crea le policy per permettere agli utenti di leggere/scrivere solo i propri dati
- Crea un indice per migliorare le performance

## Se hai già creato la tabella:

Se hai già eseguito lo script `supabase_migration.sql` in precedenza, esegui anche `supabase_migration_add_phrases.sql` per aggiungere il campo `cv_custom_phrases`.

## Troubleshooting:

Se dopo aver eseguito lo script non vedi ancora i dati su mobile:

1. **Verifica che la tabella esista:**
   - Vai su "Table Editor" in Supabase
   - Controlla che `candidate_profiles` sia presente

2. **Verifica le policy RLS:**
   - Vai su "Authentication" > "Policies"
   - Controlla che ci siano 3 policy per `candidate_profiles`:
     - "Users can view their own candidate profile"
     - "Users can insert their own candidate profile"
     - "Users can update their own candidate profile"

3. **Controlla la console del browser:**
   - Apri gli strumenti per sviluppatori (F12)
   - Vai alla tab "Console"
   - Cerca eventuali errori relativi a Supabase

4. **Test manuale:**
   - Salva i dati su desktop
   - Controlla in Supabase Table Editor che i dati siano stati salvati
   - Accedi da mobile e verifica che i dati vengano caricati
