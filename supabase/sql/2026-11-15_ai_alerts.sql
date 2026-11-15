-- AI outage alerts (used by supabase/functions/_shared/ai-alert.ts and the ai-health-check function).
-- When Anthropic answers "invalid key", "credit balance too low" or "usage/spend limit", every AI feature in the app is
-- down for everyone - so the support inbox gets an email. One row per alert kind per day: the primary key is the
-- "already sent today" check, so a dead key gives one email a day, not one per user per tap.
-- Only the server (service role) can touch it - RLS on, no policies.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-15_ai_alerts.sql

create table if not exists public.ai_provider_alerts (
    kind text not null,
    day date not null default current_date,
    fn text,
    detail text,
    created_at timestamptz not null default now(),
    primary key (kind, day)
);
alter table public.ai_provider_alerts enable row level security;
revoke all on table public.ai_provider_alerts from anon, authenticated;
grant select, insert, delete on table public.ai_provider_alerts to service_role;

-- Daily check at 07:00 UTC (09:00/10:00 in Israel): one tiny AI call, so a dead key or an empty credit shows up even on
-- days nobody uses AI (in November 2026 the key stopped working and nobody noticed for two weeks).
-- The Bearer token is copied from the existing daily Google job (service role), so no key is written in this file.
select cron.unschedule('ai-health-check-daily') where exists (select 1 from cron.job where jobname = 'ai-health-check-daily');
select cron.schedule(
    'ai-health-check-daily',
    '0 7 * * *',
    format(
        $cmd$select net.http_post(url := 'https://fncssznyigwlltoqlfwh.supabase.co/functions/v1/ai-health-check', headers := jsonb_build_object('Authorization', 'Bearer %s', 'Content-Type', 'application/json'));$cmd$,
        (select substring(command from 'Bearer ([A-Za-z0-9._-]+)') from cron.job where jobname = 'google-calendar-renew-channels-daily')
    )
);
