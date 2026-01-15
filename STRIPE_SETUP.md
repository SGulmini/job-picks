# Stripe Setup Instructions

Per abilitare il sistema di pagamento, devi configurare Stripe.

## 1. Crea un account Stripe

Vai su https://stripe.com e crea un account (o accedi se ne hai già uno).

## 2. Ottieni le API Keys

1. Vai al Dashboard Stripe: https://dashboard.stripe.com
2. Vai su **Developers** → **API keys**
3. Copia:
   - **Publishable key** (inizia con `pk_`)
   - **Secret key** (inizia con `sk_`) - clicca su "Reveal test key" per vederla

## 3. Configura le variabili d'ambiente

Aggiungi al file `.env.local`:

```env
STRIPE_SECRET_KEY=sk_test_... (la tua secret key)
STRIPE_PUBLISHABLE_KEY=pk_test_... (la tua publishable key)
NEXT_PUBLIC_BASE_URL=http://localhost:3000 (per sviluppo) o https://tuodominio.com (per produzione)
```

## 4. Configura il Webhook

1. Vai su **Developers** → **Webhooks** nel dashboard Stripe
2. Clicca su **Add endpoint**
3. Endpoint URL: `https://tuodominio.com/api/webhook/stripe` (o `http://localhost:3000/api/webhook/stripe` per test con Stripe CLI)
4. Seleziona questi eventi:
   - `checkout.session.completed`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
5. Copia il **Signing secret** (inizia con `whsec_`)
6. Aggiungi al `.env.local`:
   ```env
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```

## 5. Configura Supabase Service Role Key

Per permettere al webhook di aggiornare i metadati utente, aggiungi al `.env.local`:

```env
SUPABASE_SERVICE_ROLE_KEY=eyJ... (la tua service role key da Supabase)
```

**Attenzione**: La service role key ha privilegi amministrativi. Non esporla mai nel client-side!

Per trovarla:
1. Vai su Supabase Dashboard
2. Vai su **Settings** → **API**
3. Copia la **service_role key** (non la anon key!)

## 6. Test in locale (opzionale)

Per testare i webhook in locale, usa Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/api/webhook/stripe
```

Questo ti darà un webhook secret da usare temporaneamente.

## 7. Installa Stripe SDK

Se non è già installato:

```bash
npm install stripe
```

## Note

- In modalità test, usa le chiavi che iniziano con `sk_test_` e `pk_test_`
- Per produzione, usa le chiavi che iniziano con `sk_live_` e `pk_live_`
- Il prezzo è impostato a €1.00/mese (100 centesimi)
- Puoi modificare il prezzo in `app/api/create-checkout-session/route.ts`
