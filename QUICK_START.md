# 🚀 Quick Start - Setup Pagamenti

## ⚡ Setup Rapido (5 minuti)

### 1. Installa Stripe
```bash
npm install stripe
```

### 2. Crea Account Stripe
- Vai su https://stripe.com e registrati
- Ottieni le API keys da Dashboard → Developers → API keys

### 3. Configura Webhook
- Dashboard Stripe → Developers → Webhooks → Add endpoint
- URL: `http://localhost:3000/api/webhook/stripe` (per test)
- Eventi da selezionare:
  - ✅ `checkout.session.completed`
  - ✅ `customer.subscription.deleted`
  - ✅ `invoice.payment_failed`
- Copia il Signing secret

### 4. Ottieni Supabase Service Role Key
- Dashboard Supabase → Settings → API
- Copia la **service_role** key (non la anon key!)

### 5. Aggiungi al `.env.local`
```env
# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_BASE_URL=http://localhost:3000

# Supabase (aggiungi questa!)
SUPABASE_SERVICE_ROLE_KEY=eyJ... (la service role key)
```

### 6. Testa!
```bash
npm run dev
```

Vai su http://localhost:3000/upgrade e testa con carta: `4242 4242 4242 4242`

---

## 📖 Per dettagli completi, vedi `SETUP_GUIDE.md`
