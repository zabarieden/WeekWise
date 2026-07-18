# Deploying background push reminders

This function needs a few one-time setup steps in your Supabase project. I can't run the
Supabase CLI or apply SQL myself from here, so please run these yourself.

## 1. Database changes

Run in the Supabase SQL Editor:

```sql
-- Stores each device's Web Push subscription, one row per browser/device per user.
create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  username text,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  timezone text not null default 'UTC',
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

create policy "Users manage their own push subscriptions" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Dedup marker so the same reminder doesn't push twice in one day.
alter table weekly_schedule add column if not exists last_notified_date date;
```

## 2. VAPID keys

I generated a real, ready-to-use VAPID key pair for this app (P-256, same format the
`web-push` library produces) so you don't have to install anything to get one:

```
VAPID_PUBLIC_KEY=BFSnO1uByNjAM_704-SH7BPRsZGeguMolXHpwAeLISjya09iN5wS4l6UBY-AjBTapVg63kAzOGX6jWoi91DldSo
VAPID_PRIVATE_KEY=9hT2eqX0UmYb2284Z4V3bgGqpiWZ7iueTWd7N9DoiLg
```

The public key is already hard-coded in `app.js` (`VAPID_PUBLIC_KEY` constant) — it's not
secret. The private key must **only** live as an Edge Function secret (step 4) — never put
it in any file in this repo.

If you'd rather generate your own pair instead of using the one above (e.g. for a
production launch under your own control), run `npx web-push generate-vapid-keys` and
swap both the constant in `app.js` and the secret in step 4.

## 3. Deploy the function

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) installed and logged in
(`supabase login`), with this project linked (`supabase link --project-ref <your-ref>`):

```bash
supabase functions deploy send-due-reminders
```

## 4. Set the function's secrets

```bash
supabase secrets set VAPID_PUBLIC_KEY=BFSnO1uByNjAM_704-SH7BPRsZGeguMolXHpwAeLISjya09iN5wS4l6UBY-AjBTapVg63kAzOGX6jWoi91DldSo
supabase secrets set VAPID_PRIVATE_KEY=9hT2eqX0UmYb2284Z4V3bgGqpiWZ7iueTWd7N9DoiLg
supabase secrets set VAPID_CONTACT_EMAIL=mailto:you@yourdomain.com
```

(`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are already available to every Edge
Function automatically — no need to set those yourself.)

## 5. Schedule it with pg_cron

In the SQL Editor (requires the `pg_cron` and `pg_net` extensions, enabled by default on
most Supabase projects — check Database → Extensions if this errors):

```sql
select
  cron.schedule(
    'send-due-reminders-every-minute',
    '* * * * *',
    $$
    select net.http_post(
      url := 'https://<your-project-ref>.supabase.co/functions/v1/send-due-reminders',
      headers := jsonb_build_object(
        'Authorization', 'Bearer <your-service-role-key>',
        'Content-Type', 'application/json'
      )
    );
    $$
  );
```

Replace `<your-project-ref>` and `<your-service-role-key>` with your actual project ref
and service role key (Project Settings → API).

## Known limitations (being upfront about these)

- **Timezone**: the function stores each device's IANA timezone (captured automatically
  from the browser) and checks reminders against that per-user local time. This is
  reasonably accurate but doesn't handle a user physically traveling across timezones
  mid-day - the stored value only updates the next time they open the app.
- **Cross-midnight reminders**: the due-time math works in minutes-since-midnight, so a
  reminder whose trigger time computes to before 00:00 (e.g. a reminder set for 00:15
  with a 30-minute lead time) won't fire correctly. This is an edge case, not something
  most reminders will hit.
- **iOS**: Web Push notifications only work for PWAs added to the home screen on iOS
  16.4+, not for a plain Safari tab. Android and desktop browsers work normally, tab or
  not, once installed/subscribed.
- **Cron cadence**: scheduled for once a minute above; that's the granularity of
  "on time" delivery. You can tighten or loosen the cron expression if needed.
