# Deploying AI-powered quick food-add (Premium)

Same pattern as `scan-meal-photo`/`scan-recipe-image`/`parse-schedule-request`.
Reuses the same `ANTHROPIC_API_KEY` secret - no new account or key needed if
you've already set one up.

## 1. Database changes

```sql
alter table user_ai_usage add column if not exists premium_food_text_month_key text;
alter table user_ai_usage add column if not exists premium_food_text_month_used integer default 0;
```

Own dedicated quota, not shared with the image-scan pool (text-only calls are
much cheaper than vision calls, so they get their own 100/month pool instead
of eating into the image quota - matches how `parse-schedule-request` also
has its own pool).

## 2. Deploy the function

```bash
supabase functions deploy estimate-food-text
```

## 3. Secrets

Nothing new if `ANTHROPIC_API_KEY` is already set for this project. Otherwise:

```bash
supabase secrets set ANTHROPIC_API_KEY=<your-api-key-here>
```

## Known limitations

- **Premium-only, no free tier** - free users keep the existing instant local
  heuristic (`estimateFreeTextCalories` in app.js) unchanged; this function is
  never called for them.
- **At most one clarifying question per entry** - enforced by swapping to a
  tool schema that has no "clarify" option at all on the follow-up call, not
  just by prompt wording, so there's no risk of an endless back-and-forth.
- **100/month cap**: once reached, the app silently falls back to the local
  heuristic (with a toast noting it's less precise) rather than blocking
  logging entirely - a paying user should never be unable to log a meal.
- **Estimates, not measurements**: like every AI calorie estimate in this
  app, this is a best-effort guess, not a lab measurement.
