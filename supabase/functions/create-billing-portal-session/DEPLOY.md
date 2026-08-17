# Deploying the billing-portal function

Returns the logged-in user's Lemon Squeezy customer-portal URL, so "Change
Plan" and "Cancel Subscription" in Settings both redirect to one
Lemon-Squeezy-hosted page that handles plan switching, cancellation timing,
and payment-method updates for you - no custom UI needed on our side.

Unlike Stripe, there's no dashboard setup step here - the portal is built
into every Lemon Squeezy store automatically, and the URL is just a field
returned on the subscription object itself.

## 1. Deploy the function

```bash
supabase functions deploy create-billing-portal-session
```

## 2. Set secrets

```bash
supabase secrets set LEMONSQUEEZY_API_KEY=<your-lemon-squeezy-api-key>
supabase secrets set SITE_URL=https://app.not10.ai
```

(Shared with `create-checkout-session`/`lemonsqueezy-webhook` - only needs
setting once per project.)

## What it does

1. Verifies the caller's identity from their own auth token.
2. Looks up their subscription ID (`user_premium.stripe_subscription_id` -
   historical column name, holds the Lemon Squeezy subscription ID since the
   Stripe→Lemon Squeezy migration) - returns `{ error: "no_subscription" }`
   (404) if they've never checked out.
3. Fetches that subscription from Lemon Squeezy's API and returns its
   `urls.customer_portal` field as `{ url }`.

## Known limitations

- If a user was never a paying customer (no successful checkout ever
  completed), this correctly refuses rather than fabricating a URL -
  "Manage Billing"/"Change Plan"/"Cancel" should only ever be shown/clickable
  when `isRealPremiumUser` is true, which implies a subscription ID already
  exists (set by `lemonsqueezy-webhook` on the first successful payment).
- The returned portal URL is pre-signed and expires after 24 hours - this
  function must be called fresh every time the user clicks one of these
  buttons, never cached client-side across sessions.
