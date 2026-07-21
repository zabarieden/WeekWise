# Deploying Smart Food Photo Recognition

Same pattern as `scan-recipe-image` and `parse-schedule-request`. Reuses the same
`ANTHROPIC_API_KEY` secret - no new account or key needed if you've already set one up.

## 1. Database changes

```sql
alter table user_ai_usage add column if not exists premium_image_scans_month_key text;
alter table user_ai_usage add column if not exists premium_image_scans_month_used integer default 0;
```

Reads `user_premium.is_premium` (already exists) and writes through the existing
`saveNutrition()` -> `calorie_tracker` path the app already uses. Also shares the same
monthly image-scan quota as `scan-recipe-image` (50/month by default) - see that
function's DEPLOY.md for the full reasoning on why premium isn't fully unlimited.

## 2. Deploy the function

```bash
supabase functions deploy scan-meal-photo
```

## 3. Secrets

Nothing new if `ANTHROPIC_API_KEY` is already set for this project. Otherwise:

```bash
supabase secrets set ANTHROPIC_API_KEY=<your-api-key-here>
```

## Known limitations

- **Premium-only, no free tier** - same reasoning as the schedule planner: reliable food
  identification needs real vision understanding.
- **Estimates, not measurements**: calorie counts are AI estimates from visual portion
  size - they will be off for some foods, especially mixed dishes or unusual angles.
  Users can always edit the auto-filled rows before saving (saveNutrition() runs
  immediately after filling them, but the values live in the same editable inputs as
  manual entry, so a quick edit + a fresh "Save" corrects anything).
- **Row capacity**: only 5 meal rows exist per day. If the photo has more distinct items
  than empty rows, the extras are silently dropped - there's no overflow handling yet.
