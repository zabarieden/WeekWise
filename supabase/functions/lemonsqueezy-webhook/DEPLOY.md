# Deploying the Lemon Squeezy billing webhook

This is the piece that actually turns a real payment into `is_premium = true`.
Nothing else in the app does this - `create-checkout-session` only sends the
customer to Lemon Squeezy's hosted checkout; this function is what comes back
afterward and updates the database once Lemon Squeezy confirms the charge.

## 1. Database changes

```sql
alter table user_premium add column if not exists tier text;
alter table user_premium add column if not exists stripe_customer_id text;
alter table user_premium add column if not exists stripe_subscription_id text;
alter table user_premium add column if not exists subscription_status text;

create table if not exists lemonsqueezy_webhook_events (
    event_id text primary key,
    received_at timestamptz not null default now()
);
alter table lemonsqueezy_webhook_events enable row level security;
```

The `stripe_customer_id`/`stripe_subscription_id` column names are historical
(added back when this app used Stripe) but now hold the Lemon Squeezy
customer/subscription IDs instead - kept as-is rather than doing a second
schema migration just to rename them.

No RLS policies on `lemonsqueezy_webhook_events` on purpose - only this
function's service-role key ever touches it (which bypasses RLS regardless),
same pattern as `feedback_messages`/`food_text_cache`.

## 2. Create the webhook in your Lemon Squeezy dashboard

Settings → Webhooks → **Add webhook**:

- **URL**: `https://fncssznyigwlltoqlfwh.supabase.co/functions/v1/lemonsqueezy-webhook`
- **Signing secret**: pick any random string yourself (Lemon Squeezy doesn't
  generate one for you) - this becomes `LEMONSQUEEZY_WEBHOOK_SECRET` below.
  Save it somewhere, you can't view it again after leaving the page.
- **Events**: subscribe to at least `subscription_created`,
  `subscription_updated`, `subscription_cancelled`. All subscription status
  changes (payment failures, cancellations, expiry, resuming) show up as
  `subscription_updated` with a different `status` field, so these three
  events cover the full lifecycle - no need to subscribe to every possible
  event name.

## 3. Deploy the function

**Must** use `--no-verify-jwt` - Lemon Squeezy never sends a Supabase auth
JWT (it sends its own `X-Signature` header instead, which this function
verifies itself):

```bash
supabase functions deploy lemonsqueezy-webhook --no-verify-jwt
```

## 4. Set the secret

```bash
supabase secrets set LEMONSQUEEZY_WEBHOOK_SECRET=<the signing secret you chose above>
```

`LEMONSQUEEZY_VARIANT_ID_MONTHLY`/`LEMONSQUEEZY_VARIANT_ID_SEMIANNUAL` are
shared with `create-checkout-session` - nothing new to set here if already
configured there.

## How `is_premium`/`tier` get decided

- `tier`: looked up from the subscription's `variant_id` against
  `LEMONSQUEEZY_VARIANT_ID_MONTHLY`/`_SEMIANNUAL` - same pattern the old
  Stripe webhook used (`tierFromPriceId`), just renamed.
- `is_premium`: `true` for `active`/`on_trial`/`past_due`/`cancelled`,
  `false` for `expired`/`unpaid`/`paused`. Important nuance: Lemon Squeezy's
  `cancelled` status does NOT mean access ends immediately - it means future
  billing was turned off, but the already-paid-for period continues until a
  separate `expired` event fires later (identical to Stripe's
  `cancel_at_period_end` behavior). `past_due` gets a grace period while
  Lemon Squeezy retries the failed payment - only `unpaid` (all retries
  exhausted) actually locks the user out.

## Known limitations

- **No signature = instant 401, no processing at all.** If webhook calls
  start failing, check the signing secret matches exactly what's configured
  in the Lemon Squeezy dashboard - a mismatch here silently means real
  payments never activate premium.
- **Deduplication is best-effort**, keyed on `event_name:subscription_id:user_id:status`
  (Lemon Squeezy doesn't document a stable per-delivery event ID) - a
  genuinely repeated status transition within the same webhook payload could
  theoretically be deduped even if it were a legitimate second event, but
  this is extremely unlikely in practice (the same subscription moving to
  the same status twice with an unchanged `updated_at` isn't a real scenario).
- **`custom_data` must survive the checkout round-trip** - if Lemon Squeezy
  ever stops echoing back `meta.custom_data` on subscription events (it's
  documented behavior, but if this ever silently breaks), this function has
  no way to know which user to update and will just log `no_user_id` and
  skip. Worth an occasional spot-check via Edge Function logs.
