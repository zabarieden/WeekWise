# Deploying the billing-portal function

Creates a Stripe Customer Portal session so "Change Plan" and "Cancel Subscription"
in Settings both redirect to one Stripe-hosted page that handles proration,
cancellation timing, payment methods, and invoice history for you.

## 0. Stripe Dashboard setup (one-time, before deploying)

Settings → Billing → Customer portal:

1. Enable the portal.
2. Under "Products", add both the Monthly and Semiannual Prices as switchable
   options, so a customer can move between them from the portal.
3. Under "Cancellation", choose **"Cancel at end of billing period"** (not
   immediately) - this is what makes `cancel_at_period_end` meaningful in the app's
   Settings screen ("Access ends {date}" vs "Renews {date}").
4. Allow payment-method updates.

## 1. Deploy the function

```bash
supabase functions deploy create-billing-portal-session
```

## 2. Set secrets

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_...
supabase secrets set SITE_URL=https://app.not10.ai
```

(Same `STRIPE_SECRET_KEY`/`SITE_URL` as `create-checkout-session` - only needs
setting once per project.)

## What it does

1. Verifies the caller's identity from their own auth token.
2. Looks up their `stripe_customer_id` from `user_premium` - returns
   `{ error: "no_subscription" }` (404) if they've never checked out.
3. Creates a Billing Portal session for that customer and returns `{ url }`.

## Known limitations

- If a user was never a Stripe customer (no successful checkout ever started), this
  correctly refuses rather than creating a customer on the fly - "Manage Billing"
  should only ever be shown/clickable when `isRealPremiumUser` is true, which implies
  a `stripe_customer_id` already exists.
