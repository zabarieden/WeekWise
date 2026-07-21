# Deploying the account deletion function

Same shape as the other Edge Functions in this project (`scan-recipe-image`, etc.) -
one deploy step, no new secrets needed since it reuses `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY`, which every other function here already has set.

## 1. Deploy the function

```bash
supabase functions deploy delete-account
```

That's it - no new secrets, no new tables, no cron step. It's called directly by the
app when someone taps "Delete Account" in Settings.

## What it does

1. Verifies the caller's identity from their own auth token (not from anything the
   client sends - a user can only ever delete their own data/account).
2. Deletes every row belonging to that user across all 13 tables the app writes to
   (`calendar_events`, `calorie_tracker`, `meal_presets`, `monthly_goals`,
   `my_center_tasks`, `push_subscriptions`, `recipes`, `step_tracker`,
   `user_ai_usage`, `user_premium`, `weekly_progress_targets`, `weekly_schedule`,
   `weight_tracker`).
3. Deletes the Supabase Auth account itself via the admin API (`auth.admin.deleteUser`) -
   this is the part that *requires* a server-side function, since the admin API needs
   the service role key, which must never be shipped to the client.

## If you add a new user-scoped table later

Add its name to the `USER_SCOPED_TABLES` array at the top of `index.ts`. Otherwise its
rows will be silently orphaned (not deleted) when someone deletes their account -
harmless for the deleted user (they can't log back in to see it), but it'll leave
stale data behind under their old `user_id`.

## Known limitations

- **Irreversible**: there is no "restore" or grace period. The client shows two
  confirmation prompts before calling this, but once it runs, the data and the auth
  account are both gone for good.
- **Not atomic**: if a later table's delete fails partway through, earlier tables have
  already been wiped. This is intentionally acceptable here (deleting less-critical
  data before the harder-to-reverse `auth.admin.deleteUser` call), but if you add more
  tables and want stronger guarantees, consider wrapping this in a single Postgres
  function/transaction instead of sequential per-table deletes.
