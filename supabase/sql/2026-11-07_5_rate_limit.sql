-- Per-user rate limit for the AI Edge Functions (used by supabase/functions/_shared/rate-limit.ts).
-- One row per AI call; ai_rate_hit() counts the calls of one function in the last window and records a new one
-- only if the user is under the limit. A transaction-level advisory lock per (user, function) makes the count exact
-- even when two requests arrive together. Only the server (service role) can touch either - RLS on, no policies.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-07_5_rate_limit.sql

create table if not exists public.ai_rate_events (
    id bigint generated always as identity primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    fn text not null,
    at timestamptz not null default now()
);
create index if not exists idx_ai_rate_events_user_fn_at on public.ai_rate_events (user_id, fn, at desc);
alter table public.ai_rate_events enable row level security;
revoke all on table public.ai_rate_events from anon, authenticated;

create or replace function public.ai_rate_hit(p_user uuid, p_fn text, p_max integer, p_window_seconds integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
    recent integer;
begin
    perform pg_advisory_xact_lock(hashtext(p_user::text || ':' || p_fn));
    -- keep the table small: this user's rows older than a day are no longer needed
    delete from public.ai_rate_events where user_id = p_user and at < now() - interval '1 day';
    select count(*) into recent
      from public.ai_rate_events
     where user_id = p_user and fn = p_fn and at > now() - make_interval(secs => p_window_seconds);
    if recent >= p_max then
        return false;
    end if;
    insert into public.ai_rate_events (user_id, fn) values (p_user, p_fn);
    return true;
end;
$$;

revoke all on function public.ai_rate_hit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.ai_rate_hit(uuid, text, integer, integer) to service_role;
