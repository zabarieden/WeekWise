# Deploying the AI recipe image scanner

Same shape as `send-due-reminders` - a few one-time steps in your Supabase project.
I can't create an Anthropic account, generate an API key, or pay for API usage myself,
so those specific parts need you.

## 1. Database changes

Run in the Supabase SQL Editor (already applied directly via the Supabase CLI during
development - included here so the schema is documented and reproducible elsewhere):

```sql
-- Free-tier lifetime counter (never resets) for the 10-scan free limit.
alter table user_ai_usage add column if not exists image_scans_used integer default 0;
-- Premium monthly quota (shared with scan-meal-photo - see below) and reset-tracking key.
alter table user_ai_usage add column if not exists premium_image_scans_month_key text;
alter table user_ai_usage add column if not exists premium_image_scans_month_used integer default 0;
```

(No new table needed - this reuses `user_ai_usage` and `user_premium`, both of which
already exist and are already gated the same way the text-parse limit is.)

## Premium usage limit: why it exists and how it works

Premium users are **not** unlimited - they get a shared monthly quota of
`PREMIUM_IMAGE_SCAN_MONTHLY_LIMIT` (currently 50) image scans, shared with
`scan-meal-photo` since both cost roughly the same per call. This exists specifically
because of the **lifetime** billing tier: a one-time $59 payment with truly unlimited
AI usage forever has no natural cost ceiling - a heavy user could generate far more in
ongoing API cost than they ever paid. A generous monthly cap (well above normal usage -
see the cost math discussed with the user) keeps the worst case bounded and predictable
for every billing period, monthly/semiannual/lifetime alike, without changing pricing or
UI at all. If real-world usage data shows 50/month is too high or too low, it's a single
constant to adjust in each of the three AI Edge Functions
(`scan-recipe-image`, `scan-meal-photo`, `parse-schedule-request`).

## 2. Get an Anthropic API key

1. Create an account at https://console.anthropic.com if you don't have one.
2. Add a payment method (Settings → Billing) - this is a paid, usage-billed API. Image
   requests cost more tokens than text-only ones; check current pricing at
   https://www.anthropic.com/pricing before turning this on for real users.
3. Create an API key under Settings → API Keys.

## 3. Deploy the function

```bash
supabase functions deploy scan-recipe-image
```

## 4. Set the function's secret

```bash
supabase secrets set ANTHROPIC_API_KEY=<your-api-key-here>
```

Optional - only if you want to pin a different model than the default:
```bash
supabase secrets set ANTHROPIC_MODEL=claude-sonnet-4-5-20250929
```
Check https://docs.anthropic.com/en/docs/about-claude/models for the current
recommended vision-capable model name before deploying - model names/versions do
change over time.

## That's it - no cron/scheduling needed

Unlike `send-due-reminders`, this function is called directly by the app whenever a
user taps "Scan a photo" - no `pg_cron` step required.

## Known limitations (being upfront about these)

- **Cost**: every scan is a real, billed API call. The 10-free-scans limit is enforced
  server-side (can't be bypassed by editing client code), but there's currently no
  hard cap on total spend across all users - keep an eye on Anthropic's usage dashboard
  early on.
- **Accuracy**: this handles handwriting and messy photos far better than the free
  Tesseract.js route would, but it's still a best-effort transcription - the frontend
  form stays fully editable specifically because no vision model is perfect.
- **Image size**: very large photos will make for a slower, more expensive request.
  Consider client-side resizing before upload if this becomes a problem in practice -
  not implemented yet.
