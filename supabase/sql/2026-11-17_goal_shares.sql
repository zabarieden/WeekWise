-- My Goals: an accountability friend (her pick, idea 14 from Coach.me, approved 2026-11-17) - a read-only link to one goal's path.
-- The friend needs no account: the public page app.not10.ai/goal.html?t=TOKEN asks the goal-share Edge Function, which reads
-- only that goal (title, icon, stations, the last 12 weeks of step days) with the service role. Turning the share off deletes the row.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-17_goal_shares.sql
create table if not exists public.goal_shares (
    token text primary key check (char_length(token) between 16 and 64),
    user_id uuid not null references auth.users (id) on delete cascade,
    goal_id uuid not null references public.vision_goals (id) on delete cascade,
    created_at timestamptz not null default now()
);
create unique index if not exists idx_goal_shares_goal on public.goal_shares (goal_id);
alter table public.goal_shares enable row level security;
drop policy if exists goal_shares_owner on public.goal_shares;
create policy goal_shares_owner on public.goal_shares for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on table public.goal_shares from anon;
grant select, insert, delete on table public.goal_shares to authenticated;
grant select, insert, delete on table public.goal_shares to service_role;
