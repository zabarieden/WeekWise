# Deploying the AI Schedule Planner

Same pattern as `scan-recipe-image`. If you already set up `ANTHROPIC_API_KEY` for the
recipe scanner, you don't need a new key or a new account - just deploy this function
and it'll reuse the same secret.

## 1. No new database changes

This feature doesn't need any new tables/columns - it only reads `user_premium.is_premium`
(already exists) and writes to `weekly_schedule` (already exists) through the normal
`saveScheduleSlot()` path the app already uses.

## 2. Deploy the function

```bash
supabase functions deploy parse-schedule-request
```

## 3. Secrets

If `ANTHROPIC_API_KEY` is already set as a secret in this project (from deploying
`scan-recipe-image`), there's nothing more to do - secrets are shared across all
functions in the same project. If not:

```bash
supabase secrets set ANTHROPIC_API_KEY=<your-api-key-here>
```

## That's it

No cron, no extra tables. This is purely called on-demand when a premium user taps the
🧠 button in the MyWeek header.

## Known limitations

- **Premium-only, no free tier**: unlike the recipe scanner, this returns `402` for any
  non-premium user - there's no rule-based fallback, since the whole point is genuine
  multi-event natural-language understanding that a heuristic parser can't do reliably.
- **Slot collisions**: if the AI parses two events onto the same day and there aren't
  enough empty slots, the frontend adds new rows automatically (same mechanism as the
  "+ Add row" button) rather than overwriting anything.
- **Cost**: every parse is a real, billed Anthropic API call, same caveat as the recipe
  scanner - keep an eye on usage if this gets heavy use.
