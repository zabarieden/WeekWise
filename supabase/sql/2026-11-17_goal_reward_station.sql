-- My Goals: the reward opens at a station she chooses (her pick, idea 4 from Habitica, 2026-11-15). Null = when the goal is reached.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-17_goal_reward_station.sql
alter table public.vision_goals add column if not exists reward_milestone_id uuid references public.vision_goal_milestones (id) on delete set null;
