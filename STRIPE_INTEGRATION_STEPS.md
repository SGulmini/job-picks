# 🚀 Guida Passo-Passo: Integrazione Stripe

## Step 1: Crea Account Stripe (5 minuti)

1. Vai su https://stripe.com
2. Clicca su **"Start now"** o **"Sign in"**
3. Completa la registrazione (puoi usare modalità TEST inizialmente)
4. Verifica la tua email

---

## Step 2: Ottieni le API Keys (2 minuti)

1. Nel Dashboard Stripe, clicca su **"Developers"** (icona ingranaggio in alto a destra)
2. Clicca su **"API keys"** nel menu laterale
3. Troverai due chiavi:
   - **Publishable key** (inizia con `pk_test_...`) - questa è visibile
   - **Secret key** (inizia con `sk_test_...`) - clicca su **"Reveal test key"** per vederla
4. **COPIA ENTRAMBE** - ti serviranno dopo

---

## Step 3: Configura il Webhook (5 minuti)

### 3.1 Crea l'Endpoint Webhook

1. Nel Dashboard Stripe, vai su **"Developers"** → **"Webhooks"**
2. Clicca su **"Add endpoint"**
3. **Endpoint URL**: 
   - Per sviluppo locale: usa Stripe CLI (vedi sotto) oppure lascia vuoto per ora
   - Per produzione: `https://tuodominio.com/api/webhook/stripe`
4. **Description**: "Job Picks Payment Webhook"
5. Clicca su **"Select events"** e seleziona:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_failed`
6. Clicca su **"Add endpoint"**
7. **COPIA il Signing secret** (inizia con `whsec_...`) - ti servirà dopo

### 3.2 (Opzionale) Test Locale con Stripe CLI

Se vuoi testare i webhook in locale:

1. Installa Stripe CLI: https://stripe.com/docs/stripe-cli
2. Apri un terminale e esegui:
   ```bash
   stripe login
   ```
3. In un altro terminale, esegui:
   ```bash
   stripe listen --forward-to localhost:3000/api/webhook/stripe
   ```
4. Stripe CLI ti darà un webhook secret temporaneo (inizia con `whsec_...`)
5. **USA QUESTO** nel `.env.local` per i test locali

---

## Step 4: Ottieni Supabase Service Role Key (2 minuti)

1. Vai al Dashboard Supabase: https://app.supabase.com
2. Seleziona il tuo progetto
3. Vai su **"Settings"** (icona ingranaggio) → **"API"**
4. Trova la sezione **"Project API keys"**
5. **COPIA la "service_role" key** (⚠️ NON la anon key!)
   - La service_role key inizia con `eyJ...` ed è molto lunga
   - ⚠️ **IMPORTANTE**: Questa chiave ha privilegi amministrativi. Non esporla mai nel codice client-side!

---

## Step 5: Aggiungi Variabili al `.env.local` (2 minuti)

Apri il file `.env.local` nella root del progetto e aggiungi queste righe:

```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_... (incolla la tua secret key da Stripe)
STRIPE_WEBHOOK_SECRET=whsec_... (incolla il webhook secret da Stripe)
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase Service Role Key (aggiungi questa!)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (incolla la service role key da Supabase)
```

### Esempio completo `.env.local`:

```env
# Supabase (già configurato)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Supabase Service Role Key (NUOVA!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (chiave lunga service role)

# Stripe (NUOVO!)
STRIPE_SECRET_KEY=sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdefghijklmnopqrstuvwxyz
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Adzuna (già configurato)
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
```

---

## Step 6: Riavvia il Server (1 minuto)

1. Ferma il server se è in esecuzione (Ctrl+C)
2. Riavvia:
   ```bash
   npm run dev
   ```

---

## Step 7: Testa l'Integrazione (5 minuti)

1. Vai su http://localhost:3000
2. Accedi/Registrati
3. Completa il profilo se necessario
4. Vai su http://localhost:3000/upgrade
5. Clicca su **"Upgrade to Premium - €1/month"**
6. Dovresti essere reindirizzato a Stripe Checkout
7. Usa una **carta di test Stripe**:
   - **Numero**: `4242 4242 4242 4242`
   - **Data scadenza**: Qualsiasi data futura (es. 12/25)
   - **CVC**: Qualsiasi 3 cifre (es. 123)
   - **ZIP**: Qualsiasi (es. 12345)
8. Completa il pagamento
9. Dovresti essere reindirizzato a `/upgrade/success`
10. Torna alla home - dovresti vedere **3 posizioni** invece di 1!

---

## ✅ Checklist

Prima di considerare l'integrazione completa, verifica:

- [ ] Stripe installato (`npm install stripe` - già fatto)
- [ ] Account Stripe creato
- [ ] API keys copiate (Secret key e Publishable key)
- [ ] Webhook configurato con i 3 eventi
- [ ] Webhook secret copiato
- [ ] Supabase Service Role Key copiata
- [ ] Tutte le variabili aggiunte al `.env.local`
- [ ] Server riavviato
- [ ] Test di pagamento completato con successo
- [ ] Utente diventa premium dopo il pagamento
- [ ] Home page mostra 3 posizioni per utenti premium

---

## 🐛 Troubleshooting

### Errore: "Stripe is not configured"
**Soluzione**: Verifica che `STRIPE_SECRET_KEY` sia nel `.env.local` e che il server sia riavviato.

### Errore: "Webhook signature verification failed"
**Soluzione**: 
- Verifica che `STRIPE_WEBHOOK_SECRET` sia corretto
- Per test locale, usa il secret da Stripe CLI (`stripe listen`)
- Per produzione, usa il secret dal Dashboard Stripe

### Pagamento completato ma utente non diventa premium
**Soluzione**:
- Controlla i log del webhook in Stripe Dashboard → Webhooks → Logs
- Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia corretta
- Controlla la console del server per errori

### Errore: "Cannot update user metadata"
**Soluzione**: 
- Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia la service role key (non anon key)
- Verifica che la chiave sia corretta e non scaduta

---

## 🌐 Per Produzione

Quando sei pronto per andare in produzione:

1. Nel Dashboard Stripe, passa da **"Test mode"** a **"Live mode"** (toggle in alto a destra)
2. Ottieni le chiavi LIVE (iniziano con `pk_live_` e `sk_live_`)
3. Crea un nuovo webhook endpoint per produzione
4. Aggiorna le variabili d'ambiente sul tuo hosting (Vercel, Netlify, ecc.)
5. Aggiorna `NEXT_PUBLIC_BASE_URL` con il tuo dominio reale

---

## 📚 Risorse Utili

- **Stripe Dashboard**: https://dashboard.stripe.com
- **Stripe Docs**: https://stripe.com/docs
- **Stripe Test Cards**: https://stripe.com/docs/testing
- **Supabase Dashboard**: https://app.supabase.com

Buona fortuna! 🚀
