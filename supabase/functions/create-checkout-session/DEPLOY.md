# Deploying the checkout-session function

Creates a Stripe Checkout Session for one of the two subscription tiers and hands the
client back a URL to redirect to. Needs a real Stripe account with two recurring
Prices already created before it will actually work end-to-end - see step 0.

## 0. Stripe Dashboard setup (one-time, before deploying)

1. Products → Add product → "Premium Monthly" → recurring price, $5.99 USD, billing
   period "Monthly". Copy the Price ID (`price_...`).
2. Products → Add product → "Premium Semiannual" → recurring price, $24.99 USD,
   billing period "Every 6 months" (Stripe supports this directly, no custom logic
   needed). Copy the Price ID.
3. Developers → API keys → copy the **Secret key** (`sk_test_...` while testing,
   `sk_live_...` once real payments are turned on).

## 1. Deploy the function

```bash
supabase functions deploy create-checkout-session
```

## 2. Set secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_PRICE_ID_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_ID_SEMIANNUAL=price_...
supabase secrets set SITE_URL=https://app.not10.ai
```

(`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are already available to every Edge
Function automatically - no need to set those yourself. `STRIPE_SECRET_KEY` and the
two Price IDs are shared with `stripe-webhook` and `create-billing-portal-session` -
only need to be set once per project, not per-function.)

## What it does

1. Verifies the caller's identity from their own auth token.
2. Reuses their existing Stripe Customer if `user_premium.stripe_customer_id` is
   already set (e.g. from a previous abandoned checkout attempt), otherwise creates
   one and saves it immediately.
3. Creates a Checkout Session in subscription mode for the requested tier's Price,
   with `success_url`/`cancel_url` pointing back at the app with a `?checkout=...`
   query param the client watches for on load.
4. Returns `{ url }` - the client does a plain `window.location.href = url` redirect,
   no Stripe.js needed since the session is fully created server-side.

## Known limitations

- If the same user opens the upgrade modal twice and creates two Checkout Sessions
  without completing either, both stay valid until they expire (Stripe's default is
  24 hours) - harmless, just means an abandoned session sits around briefly.
- Doesn't validate that the user isn't already subscribed before creating a new
  session - not currently a problem since the "Upgrade Now" button is only shown when
  `isRealPremiumUser` is false, but if that check is ever removed, a double-subscribe
  is possible.
