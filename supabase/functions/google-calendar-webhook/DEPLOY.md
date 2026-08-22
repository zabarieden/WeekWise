# Deploying Google Calendar two-way sync (Milestone 1: connect + Google→NOT10.ai pull)

Covers `google-calendar-auth-start`, `google-calendar-oauth-callback`,
`google-calendar-status`, `google-calendar-disconnect`, `google-calendar-webhook`,
`google-calendar-reconcile`, `google-calendar-renew-channels`, and the shared
`_shared/google-calendar.ts` module.

## 1. Database changes

Already applied directly against the linked project (`google_calendar_connections`,
`google_oauth_state` tables, and the `google_event_id`/`google_etag`/`google_updated`/
`google_synced_at`/`updated_at` columns + auto-touch trigger on `calendar_events`) -
nothing to run here.

## 2. Google Cloud Console setup (only you can do this - see the checklist you were
given separately for the full walkthrough)

Once you have a **Client ID** and **Client Secret** from Google Cloud Console
(OAuth 2.0 Client ID, Web application type, redirect URI
`https://fncssznyigwlltoqlfwh.supabase.co/functions/v1/google-calendar-oauth-callback`),
hand them back so the secrets in step 4 can be set. Nothing below this point works
without them.

## 3. Deploy the functions

```bash
supabase functions deploy google-calendar-auth-start
supabase functions deploy google-calendar-oauth-callback --no-verify-jwt
supabase functions deploy google-calendar-status
supabase functions deploy google-calendar-disconnect
supabase functions deploy google-calendar-webhook --no-verify-jwt
supabase functions deploy google-calendar-reconcile
supabase functions deploy google-calendar-renew-channels
```

`oauth-callback` and `webhook` need `--no-verify-jwt` because Google calls them
directly (redirect / push notification) with no Supabase JWT attached.

## 4. Set the secrets

```bash
supabase secrets set GOOGLE_CLIENT_ID=<your client id>
supabase secrets set GOOGLE_CLIENT_SECRET=<your client secret>
```

(`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SITE_URL` are already available -
no need to set those.)

## 5. Schedule the two cron jobs

```sql
select cron.schedule(
  'google-calendar-reconcile-every-30-min',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := 'https://fncssznyigwlltoqlfwh.supabase.co/functions/v1/google-calendar-reconcile',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>', 'Content-Type', 'application/json')
  );
  $$
);

select cron.schedule(
  'google-calendar-renew-channels-daily',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://fncssznyigwlltoqlfwh.supabase.co/functions/v1/google-calendar-renew-channels',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>', 'Content-Type', 'application/json')
  );
  $$
);
```

(Same `net.http_post` + service-role-bearer pattern as `send-due-reminders`.)

## Milestone 2 - NOT10.ai→Google push for one-time events (done)

Covers `google-calendar-outbox-drain` and two DB objects applied directly against
the linked project (nothing to run here):

- `calendar_sync_outbox` table (service-role only, RLS enabled with no client
  policies): `id`, `calendar_event_id`, `user_id`, `action` (insert/update/delete),
  `google_event_id` (snapshot, used for deletes since the local row is already
  gone by drain time), `attempts`, `last_error`, `created_at`, `processed_at`.
- `calendar_events_enqueue_outbox()` trigger function + `calendar_events_outbox_trigger`
  (`AFTER INSERT OR UPDATE OR DELETE`). Scoped to `source = 'calendar'` rows with
  `recurrence_group_id IS NULL` (one-time events only - recurring push is
  Milestone 3). Loop prevention: on UPDATE, only enqueues when `google_synced_at`
  did **not** change in that same statement - every pull-direction write (webhook/
  reconcile) and every outbox-drain confirmation write touches that column, so
  those are correctly skipped; genuine local edits from `app.js` never touch it.

Deploy:
```bash
supabase functions deploy google-calendar-outbox-drain
```

Cron (every minute, same `net.http_post` + service-role-bearer pattern):
```sql
select cron.schedule(
  'google-calendar-outbox-drain-every-min',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://fncssznyigwlltoqlfwh.supabase.co/functions/v1/google-calendar-outbox-drain',
    headers := jsonb_build_object('Authorization', 'Bearer <service-role-key>', 'Content-Type', 'application/json')
  );
  $$
);
```

The drain function re-reads each event's current state from `calendar_events` at
drain time rather than trusting the outbox row's snapshot - several queued rows
for the same event collapse into one Google API call using the latest state.
Reminders: `reminder_minutes` is translated into a Google `popup` reminder
override on push, so a connected user gets Google's (reliable) native
notification even while NOT10.ai's own in-app reminder delivery is unreliable.
No stored duration field, so timed events default to a 1-hour block on the
Google side; all-day events use `date`/`date+1`.

## Known limitations

- **Recurring events still don't push** - `recurrence_group_id IS NOT NULL` rows
  are excluded from the outbox trigger entirely (Milestone 3).
- **Refresh tokens expire every 7 days while the OAuth consent screen is in
  "Testing" status** - a reconnect is needed weekly until Google approves the
  verification submission and it moves to "In production."
- **Push channels expire ~7 days** - `google-calendar-renew-channels` (daily cron)
  renews them before that; if renewal is ever missed, `google-calendar-reconcile`
  (every 30 min) still keeps things in sync, just without near-instant delivery.
- **Conflict resolution** is last-write-wins by comparing timestamps, silently -
  an edit to the same field on both sides within the sync window can lose one
  side's edit with no warning. Acceptable for personal use, not enterprise-grade.
- **`weekly_schedule` (the day-of-week grid) is out of scope** - only dated
  `calendar_events` sync.
- **Outbox retries cap at 10 attempts** per row, then gives up (marks processed
  with `last_error` retained) rather than retrying forever.
