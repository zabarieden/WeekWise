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

## Milestone 3 - NOT10.ai→Google push for recurring series (done, partial)

No new tables - reuses `calendar_sync_outbox.recurrence_group_id` (added above)
and the same `google-calendar-outbox-drain` function, redeployed with recurring-
aware logic. Nothing new to run; the trigger function was updated in place
(`calendar_events_enqueue_outbox()`, same migration file pattern as Milestone 2).

- **`generateRecurringDates()` in app.js doesn't persist its own parameters**
  (unit/interval/duration) anywhere on the row - only the resulting `event_date`
  values survive. So the drain function reconstructs the RRULE by inferring the
  pattern from the sibling rows' actual dates (`inferRRule()`): a constant day-gap
  → `FREQ=DAILY` or `FREQ=WEEKLY`; a constant day-of-month with a constant
  month-gap → `FREQ=MONTHLY`. If the pattern isn't regular (e.g. a occurrence's
  date was hand-edited since creation), falls back to pushing every occurrence as
  an independent one-off Google event instead of losing sync entirely.
- **Series creation**: one `Events.insert` call for the whole group, with
  `recurrence: ["RRULE:..."]`; the resulting series-master `google_event_id` is
  written onto *all* sibling rows (shared, not unique per row - matches the
  original schema note).
- **Whole-series edits**: `openEditCalendarEventSeries()` in app.js is the only
  UI path that edits a recurring group, and it only ever changes the shared
  title across every sibling row at once - so any subsequent outbox activity on
  an already-synced group is treated as a title-only `PATCH` on the series
  master (deliberately not `PUT`, so the existing `recurrence` field on the
  Google side is never overwritten/cleared).
- **Deleting a single occurrence while the series still has other rows is a
  no-op on the Google side** (verified) - the trigger only enqueues a delete
  once the *last* row sharing that `recurrence_group_id` is gone, since every
  sibling shares one Google event and deleting it would wipe the whole series.
  Concretely this means removing one occurrence locally does not yet remove
  just that occurrence from Google (it stays there) - full instance-level
  editing/deletion via `Events.instances()` is not implemented.
- **Editing a single occurrence's own date/time/title within an already-pushed
  series is now supported** (previously listed here as not implemented - added
  after the UI gained an edit button per-occurrence inside the expanded series
  view, `openEditCalendarEvent(occurrence)`). Two new immutable anchor columns,
  `recurrence_original_date`/`recurrence_original_time`, are stamped once at
  series-creation time (never touched by later edits) and used to look up the
  matching Google instance via `Events.instances()` - matching on
  `originalStartTime` rather than the (now possibly-changed) current
  `event_date`/`event_time`. The drain function distinguishes a whole-series
  edit from a single-occurrence edit by comparing which `calendar_event_id`s
  actually appear in the pending outbox batch for that group: all siblings at
  once → series-title `PATCH`; a subset (normally one) → per-instance `PATCH`
  via the matched instance id. Rows created before this column existed fall
  back to matching on their current `event_date`/`event_time` instead.

## Known limitations

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
