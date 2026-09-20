## Incident (2026-09-20): "also remind me" turned into a phantom event

A request like "Work on the 26th, and also create a reminder and task for the day
before" produced three events: the real "Work" event, plus two garbage one-time
events literally titled "Reminder" and "Task" on the day before - because the
reminder-mechanism words became the only content extracted for that clause, with
no real activity attached to them. Two separate causes, both fixed:

1. The reminder toggle on the AI schedule tab (`ai-schedule-reminder`/
   `ai-schedule-reminder-text` in index.html) only ever got applied to
   `weekly_schedule` rows in `applyParsedScheduleEvents` - a one-time or bounded-
   recurring `calendar_events` row from the same AI call silently got no reminder
   at all, even when the toggle was set. This gave the user no way to express "a
   reminder is what I actually want" other than describing it in the free text
   itself, which is what led to the phantom events in the first place. Now applied
   in `applyOneTimeScheduleEvents`/`applyBoundedRecurringScheduleEvents` too.
2. The prompt now explicitly tells the model that a clause describing wanting to
   be reminded/notified about something already mentioned earlier in the same
   message is not a request for a new activity, and to leave it out rather than
   inventing an event whose title is just a bare mechanism word ("reminder"/
   "task"/"notification"/"alert" or the Hebrew equivalents).

# Deploying the AI Schedule Planner

Same pattern as `scan-recipe-image`. If you already set up `ANTHROPIC_API_KEY` for the
recipe scanner, you don't need a new key or a new account - just deploy this function
and it'll reuse the same secret.

## 1. Database changes

```sql
alter table user_ai_usage add column if not exists premium_schedule_ai_month_key text;
alter table user_ai_usage add column if not exists premium_schedule_ai_month_used integer default 0;
alter table user_ai_usage add column if not exists schedule_ai_lifetime_used integer default 0;
```

Otherwise reads `user_premium.is_premium` (already exists) and writes to
`weekly_schedule` (already exists) through the normal `saveScheduleSlot()` path the app
already uses. Premium users get a monthly quota (60/month by default, separate from
the image-scan pool since text requests cost far less per call) - see
`scan-recipe-image`'s DEPLOY.md for why premium isn't fully unlimited.

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

- **5 free lifetime uses for non-premium users** (`schedule_ai_lifetime_used`, never
  resets) - after that, non-premium users fall back to the local rule-based parser
  (`parseScheduleTextLocally` in app.js), same as when this call fails for any reason.
- **Slot collisions**: if the AI parses two events onto the same day and there aren't
  enough empty slots, the frontend adds new rows automatically (same mechanism as the
  "+ Add row" button) rather than overwriting anything.
- **Cost**: every parse is a real, billed Anthropic API call, same caveat as the recipe
  scanner - keep an eye on usage if this gets heavy use.
