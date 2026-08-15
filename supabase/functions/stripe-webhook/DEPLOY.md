# Deploying the Stripe webhook function

This is the **only** place that writes `is_premium`/`tier`/`subscription_status` to
`user_premium` - Stripe calls this function directly whenever a subscription is
created, renewed, changed, cancelled, or fails to pay. Unlike every other function in
this project, the caller is Stripe itself, not a logged-in app user, so this one
deploys differently (see step 1) and authenticates differently (Stripe signature,
not a Supabase JWT).

## 1. Deploy the function WITHOUT JWT verification

```bash
supabase functions deploy stripe-webhook --no-verify-jwt
```

The `--no-verify-jwt` flag is required - without it, Supabase's platform-level auth
check rejects every call before this function's own code even runs, since Stripe
never sends a Supabase JWT (there's no logged-in user on these requests at all).

## 2. Register the webhook endpoint in Stripe

Developers → Webhooks → Add endpoint:

- **URL**: the function's URL, shown after deploying (looks like
  `https://<project-ref>.functions.supabase.co/stripe-webhook`).
- **Events to send**: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.payment_failed`.

After creating it, open the endpoint and copy its **Signing secret** (`whsec_...`).

## 3. Set secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...
supabase secrets set STRIPE_PRICE_ID_MONTHLY=price_...
supabase secrets set STRIPE_PRICE_ID_SEMIANNUAL=price_...
```

## What it does

1. Verifies the request actually came from Stripe using the raw request body + the
   `Stripe-Signature` header + the webhook signing secret (`stripe.webhooks.constructEventAsync`
   with Deno's `SubtleCryptoProvider` - the async/Web-Crypto variant, since Stripe's
   default signature check assumes Node's synchronous `crypto` module, which doesn't
   exist in the Deno Edge Function runtime).
2. Deduplicates via a `stripe_webhook_events` table (keyed on Stripe's own
   `event.id`) - Stripe retries deliveries that don't get a 2xx response in time, so
   the same event can legitimately arrive more than once.
3. `checkout.session.completed` - a subscription checkout just finished. Retrieves
   the full subscription object and writes tier/status/period-end/customer id/
   subscription id to the matching `user_premium` row (resolved via
   `session.metadata.supabase_user_id`, set when the session was created).
4. `customer.subscription.updated` - covers renewals, portal-driven plan switches,
   and payment-failure transitions to `past_due`. Re-derives `tier` from the current
   Price (in case of a plan switch) and updates the same columns.
5. `customer.subscription.deleted` - the subscription is actually gone (user
   cancelled and the period ended, or Stripe's payment retries were exhausted). Sets
   `is_premium = false`, `subscription_status = 'canceled'`. Leaves `tier` as a
   historical record rather than clearing it.
6. `invoice.payment_failed` - acknowledged but currently a no-op, since
   `customer.subscription.updated` already fires with `status: 'past_due'` in the
   same failure. Kept as a separate case for future use (e.g. a dedicated
   "your payment failed" notice) without needing to restructure anything.

## Known limitations

- `past_due` subscriptions are treated as **not** premium by the client
  (`loadPremiumStatus` only counts `active`/`trialing`) - a user's first missed
  payment locks them out immediately rather than granting a grace period. This was a
  deliberate choice (Stripe already emails the customer and keeps retrying per your
  dashboard's retry schedule), not an oversight - revisit if that feels too strict in
  practice.
- If Stripe's failed-payment retry schedule is configured to end in `unpaid` rather
  than `canceled` (Settings → Billing → Manage failed payments), this function has no
  branch for that status - it'll just sit as `subscription_status: 'unpaid'` and
  `is_premium: false` (since `unpaid` isn't in the active-statuses list either), which
  is actually the right end state, just flagging that it was never explicitly tested
  against that specific status string.
