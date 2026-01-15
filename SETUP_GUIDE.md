# Guida Completa Setup Job Picks con Pagamenti

Questa guida ti accompagna passo-passo nella configurazione completa del sistema, inclusi i pagamenti Stripe.

## 📋 Prerequisiti

- Account Supabase (già configurato)
- Account Stripe (da creare)
- Node.js installato
- Progetto già clonato/configurato

---

## 🔧 Step 1: Installare Dipendenze

Apri il terminale nella cartella del progetto e esegui:

```bash
npm install stripe
```

---

## 💳 Step 2: Configurare Stripe

### 2.1 Crea Account Stripe

1. Vai su https://stripe.com
2. Clicca su **"Start now"** o **"Sign in"** se hai già un account
3. Completa la registrazione (puoi usare modalità test inizialmente)

### 2.2 Ottieni le API Keys

1. Vai al Dashboard Stripe: https://dashboard.stripe.com/test/dashboard
2. Clicca su **"Developers"** (icona a forma di ingranaggio in alto a destra)
3. Clicca su **"API keys"** nel menu laterale
4. Troverai due chiavi:
   - **Publishable key** (inizia con `pk_test_...`) - questa è visibile
   - **Secret key** (inizia con `sk_test_...`) - clicca su **"Reveal test key"** per vederla

### 2.3 Configura il Webhook

1. Nel Dashboard Stripe, vai su **"Developers"** → **"Webhooks"**
2. Clicca su **"Add endpoint"**
3. Per sviluppo locale, usa Stripe CLI (vedi sotto) oppure per produzione:
   - **Endpoint URL**: `https://tuodominio.com/api/webhook/stripe`
   - **Description**: "Job Picks Payment Webhook"
4. Clicca su **"Select events"** e seleziona:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_failed`
5. Clicca su **"Add endpoint"**
6. Copia il **Signing secret** (inizia con `whsec_...`) - ti servirà dopo

### 2.4 (Opzionale) Test Locale con Stripe CLI

Per testare i webhook in locale durante lo sviluppo:

1. Installa Stripe CLI: https://stripe.com/docs/stripe-cli
2. Esegui: `stripe login`
3. In un terminale separato, esegui:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook/stripe
   ```
4. Stripe CLI ti darà un webhook secret temporaneo (inizia con `whsec_...`) - usalo nel `.env.local` per i test

---

## 🔐 Step 3: Configurare Supabase Service Role Key

Il webhook ha bisogno di aggiornare i metadati utente, quindi serve la Service Role Key:

1. Vai al Dashboard Supabase: https://app.supabase.com
2. Seleziona il tuo progetto
3. Vai su **"Settings"** (icona ingranaggio) → **"API"**
4. Trova la sezione **"Project API keys"**
5. Copia la **"service_role" key** (⚠️ NON la anon key!)
   - La service_role key inizia con `eyJ...` ed è molto lunga
   - ⚠️ **IMPORTANTE**: Questa chiave ha privilegi amministrativi. Non esporla mai nel codice client-side!

---

## 📝 Step 4: Configurare le Variabili d'Ambiente

Apri il file `.env.local` nella root del progetto e aggiungi/modifica queste variabili:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... (la tua secret key da Stripe)
STRIPE_WEBHOOK_SECRET=whsec_... (il webhook secret da Stripe)
NEXT_PUBLIC_BASE_URL=http://localhost:3000 (per sviluppo) 
# Per produzione, cambia con: https://tuodominio.com

# Supabase (già configurato, ma verifica)
NEXT_PUBLIC_SUPABASE_URL=https://tuoprogetto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ... (la tua anon key)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (la service role key - NUOVA!)

# Adzuna (già configurato)
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
```

### Esempio completo `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (lunga chiave service role)

# Stripe
STRIPE_SECRET_KEY=sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Adzuna
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
```

---

## 🚀 Step 5: Testare il Sistema

### 5.1 Avvia il Server di Sviluppo

```bash
npm run dev
```

### 5.2 Testa il Flusso Completo

1. **Registra/Accedi**: Vai su http://localhost:3000/login
2. **Crea Profilo**: Completa il profilo su http://localhost:3000/profile
3. **Vai alla Home**: Dovresti vedere 1 posizione (piano gratuito)
4. **Testa Upgrade**:
   - Clicca su "Upgrade to Premium" o vai su http://localhost:3000/upgrade
   - Clicca su "Upgrade to Premium - €1/month"
   - Verrai reindirizzato a Stripe Checkout
   - Usa una carta di test Stripe:
     - **Numero**: `4242 4242 4242 4242`
     - **Data scadenza**: Qualsiasi data futura (es. 12/25)
     - **CVC**: Qualsiasi 3 cifre (es. 123)
     - **ZIP**: Qualsiasi (es. 12345)
   - Completa il pagamento
   - Dovresti essere reindirizzato a `/upgrade/success`
   - Torna alla home - dovresti vedere 3 posizioni!

### 5.3 Verifica i Log

Controlla i log del server per eventuali errori:
- Nel terminale dove gira `npm run dev`
- Nel Dashboard Stripe → **"Developers"** → **"Webhooks"** → clicca sul tuo endpoint → **"Logs"**

---

## 🌐 Step 6: Deploy in Produzione

### 6.1 Configura Stripe per Produzione

1. Nel Dashboard Stripe, passa da **"Test mode"** a **"Live mode"** (toggle in alto a destra)
2. Ottieni le chiavi LIVE (iniziano con `pk_live_` e `sk_live_`)
3. Aggiorna `.env.local` con le chiavi LIVE (o meglio, usa variabili d'ambiente del tuo hosting)

### 6.2 Configura Webhook in Produzione

1. Nel Dashboard Stripe (modalità LIVE), vai su **"Developers"** → **"Webhooks"**
2. Crea un nuovo endpoint con URL: `https://tuodominio.com/api/webhook/stripe`
3. Seleziona gli stessi eventi
4. Copia il nuovo webhook secret LIVE

### 6.3 Configura Variabili d'Ambiente sul Tuo Hosting

A seconda del tuo hosting (Vercel, Netlify, ecc.), aggiungi tutte le variabili d'ambiente:

- `STRIPE_SECRET_KEY` (LIVE)
- `STRIPE_WEBHOOK_SECRET` (LIVE)
- `NEXT_PUBLIC_BASE_URL` (https://tuodominio.com)
- `SUPABASE_SERVICE_ROLE_KEY`
- E tutte le altre già configurate

### 6.4 Testa in Produzione

1. Fai un test con una carta reale (puoi rimborsare subito dopo)
2. Verifica che i webhook funzionino
3. Controlla i log di Stripe per eventuali errori

---

## 🐛 Troubleshooting

### Problema: "Stripe is not defined"
**Soluzione**: Esegui `npm install stripe`

### Problema: Webhook non funziona
**Soluzione**: 
- Verifica che `STRIPE_WEBHOOK_SECRET` sia corretto
- Controlla i log in Stripe Dashboard → Webhooks → Logs
- Per test locale, usa Stripe CLI

### Problema: "Cannot update user metadata"
**Soluzione**: 
- Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia la service role key (non anon key)
- Verifica che la chiave sia corretta e non scaduta

### Problema: Pagamento completato ma utente non diventa premium
**Soluzione**:
- Controlla i log del webhook in Stripe
- Verifica che il webhook sia configurato correttamente
- Controlla che `SUPABASE_SERVICE_ROLE_KEY` sia configurata

### Problema: Redirect dopo pagamento non funziona
**Soluzione**: 
- Verifica che `NEXT_PUBLIC_BASE_URL` sia corretto
- Per produzione, deve essere `https://tuodominio.com` (non `http://`)

---

## 📊 Monitoraggio

### Dashboard Stripe
- **Payments**: Vedi tutti i pagamenti
- **Customers**: Vedi tutti i clienti
- **Webhooks**: Vedi i log degli eventi webhook

### Dashboard Supabase
- **Authentication** → **Users**: Vedi gli utenti e i loro metadati
- Cerca `subscriptionTier: "premium"` nei metadati utente

---

## ✅ Checklist Finale

Prima di andare in produzione, verifica:

- [ ] Stripe installato (`npm install stripe`)
- [ ] Tutte le variabili d'ambiente configurate
- [ ] Webhook configurato e testato
- [ ] Test di pagamento completato con successo
- [ ] Utente diventa premium dopo il pagamento
- [ ] Home page mostra 3 posizioni per utenti premium
- [ ] Home page mostra 1 posizione per utenti free
- [ ] Log di Stripe non mostrano errori

---

## 💡 Note Importanti

1. **Test Mode vs Live Mode**: 
   - In test mode, usa carte di test (4242 4242 4242 4242)
   - In live mode, usa carte reali

2. **Sicurezza**:
   - ⚠️ MAI committare `.env.local` nel repository
   - ⚠️ MAI esporre `STRIPE_SECRET_KEY` o `SUPABASE_SERVICE_ROLE_KEY` nel client-side

3. **Prezzo**:
   - Il prezzo è impostato a €1.00/mese (100 centesimi)
   - Puoi modificarlo in `app/api/create-checkout-session/route.ts` (cerca `unit_amount: 100`)

4. **Rimborsi**:
   - Puoi gestire rimborsi dal Dashboard Stripe
   - I rimborsi non downgrade automaticamente l'utente (dovresti aggiungere questa logica se necessario)

---

## 🆘 Supporto

Se hai problemi:
1. Controlla i log del server (`npm run dev`)
2. Controlla i log di Stripe (Dashboard → Webhooks → Logs)
3. Controlla la console del browser (F12)
4. Verifica che tutte le variabili d'ambiente siano corrette

Buona fortuna! 🚀
