-- Badges outside NOT10 Nourish+ (Premium). First one: 'premium_week' = a ✓ on 6 of the last 7 days (her ask 2026-11-15:
-- "אחרי שבוע של שימוש - מין תג התמדה... רק אם עושים וי... נגיד 6 מתוך 7"). One row per badge per user; the app reads and
-- writes its own rows only.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-15_user_badges.sql

create table if not exists public.user_badges (
    user_id uuid not null references auth.users (id) on delete cascade,
    badge text not null,
    earned_at timestamptz not null default now(),
    primary key (user_id, badge)
);
alter table public.user_badges enable row level security;
drop policy if exists user_badges_owner on public.user_badges;
create policy user_badges_owner on public.user_badges for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on table public.user_badges from anon;
grant select, insert, delete on table public.user_badges to authenticated;
grant select, insert, delete on table public.user_badges to service_role;
