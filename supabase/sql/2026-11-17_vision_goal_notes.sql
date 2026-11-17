-- My Goals: short notes per goal (her picks 16 / 19 / 6, 2026-11-15) - the 1-minute weekly review (what worked / what was hard /
-- the next step), the question after finishing a station ("what helped?"), and the next week's letter is built from them.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-17_vision_goal_notes.sql
create table if not exists public.vision_goal_notes (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    goal_id uuid not null references public.vision_goals (id) on delete cascade,
    milestone_id uuid references public.vision_goal_milestones (id) on delete set null,
    kind text not null check (kind in ('review', 'station')),
    worked text check (worked is null or char_length(worked) <= 400),
    hard text check (hard is null or char_length(hard) <= 400),
    next_step text check (next_step is null or char_length(next_step) <= 400),
    created_at timestamptz not null default now()
);
create index if not exists idx_vision_goal_notes_goal on public.vision_goal_notes (goal_id, created_at desc);
alter table public.vision_goal_notes enable row level security;
drop policy if exists vision_goal_notes_owner on public.vision_goal_notes;
create policy vision_goal_notes_owner on public.vision_goal_notes for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on table public.vision_goal_notes from anon;
grant select, insert, update, delete on table public.vision_goal_notes to authenticated;
grant select, insert, update, delete on table public.vision_goal_notes to service_role;
