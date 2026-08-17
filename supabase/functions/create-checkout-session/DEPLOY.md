# Deploying the checkout-session function

Creates a Lemon Squeezy Checkout for one of the two subscription tiers and hands the
client back a URL to redirect to. Needs a real Lemon Squeezy store with one product
and two variants already created before it will actually work end-to-end - see step 0.

Uses Lemon Squeezy, not Stripe - Stripe doesn't support direct merchant accounts for
businesses based in Israel. Lemon Squeezy is a Merchant of Record (handles global
tax/VAT compliance for you) instead of a raw payment processor.

## 0. Lemon Squeezy dashboard setup (one-time, before deploying)

1. Products → New Product → "NOT10.ai Premium" - a single subscription product with
   **two variants**:
   - Monthly: $8.99 USD, billing every 1 month.
   - Semi-Annual: $39.99 USD, billing every 6 months.
   Copy each variant's ID (visible in the variant's own settings/URL).
2. Settings → API → create an API key.
3. Settings → Stores → copy your Store ID.

## 1. Deploy the function

```bash
supabase functions deploy create-checkout-session
```

## 2. Set secrets

```bash
supabase secrets set LEMONSQUEEZY_API_KEY=<your-api-key>
supabase secrets set LEMONSQUEEZY_STORE_ID=<your-store-id>
supabase secrets set LEMONSQUEEZY_VARIANT_ID_MONTHLY=<monthly-variant-id>
supabase secrets set LEMONSQUEEZY_VARIANT_ID_SEMIANNUAL=<semiannual-variant-id>
supabase secrets set SITE_URL=https://app.not10.ai
```

(`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` are already available to every Edge
Function automatically. `LEMONSQUEEZY_API_KEY`/`LEMONSQUEEZY_STORE_ID` are shared
with `create-billing-portal-session`; the two variant IDs are shared with
`lemonsqueezy-webhook` - only need to be set once per project, not per-function.)

## What it does

1. Verifies the caller's identity from their own auth token.
2. Creates a Lemon Squeezy Checkout for the requested tier's variant, passing
   `custom_data: { supabase_user_id }` at checkout time - this is how
   `lemonsqueezy-webhook` later knows which user_premium row to update once
   the payment actually completes (Lemon Squeezy echoes `custom_data` back
   on every subscription webhook event).
3. `product_options.redirect_url` points back at the app with `?checkout=success`,
   which the client watches for on load (see `app.js`).
4. Returns `{ url }` - the client does a plain `window.location.href = url` redirect
   to Lemon Squeezy's hosted checkout page, no client-side SDK needed.

## Known limitations

- This function alone does NOT grant premium access - it only creates the checkout
  link. `is_premium` only ever gets set to `true` by `lemonsqueezy-webhook` once
  Lemon Squeezy confirms the payment actually went through.
- If the same user opens the upgrade modal twice and creates two checkouts without
  completing either, both stay valid until they expire on Lemon Squeezy's side -
  harmless, just an abandoned checkout link sitting around briefly.
- Doesn't validate that the user isn't already subscribed before creating a new
  checkout - not currently a problem since the "Upgrade Now" button is only shown
  when `isRealPremiumUser` is false, but if that check is ever removed, a
  double-subscribe is possible.
