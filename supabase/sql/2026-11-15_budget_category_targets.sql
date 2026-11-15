-- A monthly amount per expense category (her pick 2026-11-15, "כסף בלי מעטפות" 2 + 4 + 8: a glass tube per category,
-- a coloured dot - green / gold / purple when over, never red - and "can spend today"). The same amount every month until
-- it is changed. category = the budget_tracker category value ('food', 'custom_<id>' ...).
-- Run with: supabase db query --linked -f supabase/sql/2026-11-15_budget_category_targets.sql

create table if not exists public.budget_category_targets (
    user_id uuid not null references auth.users (id) on delete cascade,
    category text not null,
    amount numeric(12, 2) not null check (amount >= 0),
    updated_at timestamptz not null default now(),
    primary key (user_id, category)
);
alter table public.budget_category_targets enable row level security;
drop policy if exists budget_category_targets_owner on public.budget_category_targets;
create policy budget_category_targets_owner on public.budget_category_targets for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on table public.budget_category_targets from anon;
grant select, insert, update, delete on table public.budget_category_targets to authenticated;
grant select, insert, update, delete on table public.budget_category_targets to service_role;
