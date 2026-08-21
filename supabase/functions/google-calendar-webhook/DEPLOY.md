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

## Known limitations (Milestone 1 scope)

- **Pull only** - Google→NOT10.ai. Events created/edited/deleted in NOT10.ai do not
  yet push back to Google (Milestone 2/3).
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
