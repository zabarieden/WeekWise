-- A tiny function the keep-alive job (.github/workflows/keepalive.yml) calls every 10 minutes, so the
-- database sees activity and the project is never paused. It reads no table and returns 1.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-07_2_keepalive.sql
create or replace function public.keepalive()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$ select 1 $$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;
