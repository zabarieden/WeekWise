# Deploying "Smart Split" (split-task-ai)

Same shape as the other Edge Functions in this project (`parse-schedule-request`,
`scan-recipe-image`, etc.) - reuses `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`ANTHROPIC_API_KEY`, which every other AI function here already has set. No new
secrets needed.

## 1. Add the two new quota columns

This function tracks its own monthly usage in `user_ai_usage`, separate from every
other AI feature's quota. Run this once in the Supabase SQL editor (or via `psql`)
before deploying:

```sql
alter table user_ai_usage
    add column if not exists premium_smart_split_month_key text,
    add column if not exists premium_smart_split_month_used integer default 0,
    add column if not exists smart_split_lifetime_used integer default 0;
```

## 2. Deploy the function

```bash
supabase functions deploy split-task-ai
```

## What it does

1. Checks `user_premium.is_premium`. Non-premium users get 5 free lifetime uses
   (`smart_split_lifetime_used`, never resets) before a `free_lifetime` 402 - same
   policy as every other AI feature in this project.
2. Checks the monthly quota (`PREMIUM_SMART_SPLIT_MONTHLY_LIMIT` = 5/month, tunable at
   the top of `index.ts`), separate from the image-scan and schedule-planner pools.
3. Computes the candidate dates deterministically in code (tomorrow through the day
   before the due date - the due date itself is never used) rather than trusting the
   model with date math.
4. Sends the task text, due date, candidate dates, and the user's free-text answer
   about which days they're more free to Claude, and gets back a list of
   `{event_date, task_title}` chunks via tool use.
5. Filters out any chunk whose `event_date` isn't actually one of the candidate dates
   (a safety net against the model inventing a date), then returns the chunks.

The frontend (`submitSmartSplitClarify` in `app.js`) inserts the returned chunks into
`calendar_events` the same way any other one-time AI-parsed schedule event is
inserted (`applyOneTimeScheduleEvents`) - they show up in "מבט ליומן"/"הצצה
להיום"/the monthly calendar and are editable/deletable through the normal ✏️/❌
buttons, with no special-casing needed anywhere else in the app.

## If you ever want a different monthly limit

Change `PREMIUM_SMART_SPLIT_MONTHLY_LIMIT` at the top of `index.ts` and redeploy - no
migration needed, since the limit isn't stored in the database.
