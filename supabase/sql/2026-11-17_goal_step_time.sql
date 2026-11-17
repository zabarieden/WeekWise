-- My Goals: a time of day for the small step (her pick, idea 20 from Productive, 2026-11-15) - morning / noon / evening or an
-- exact time, so the step sits at that hour in My Day. Null = no time (at the top of My Day, as before).
-- Run with: supabase db query --linked -f supabase/sql/2026-11-17_goal_step_time.sql
alter table public.vision_goals add column if not exists reminder_time text;
alter table public.vision_goals drop constraint if exists vision_goals_reminder_time_check;
alter table public.vision_goals add constraint vision_goals_reminder_time_check check (reminder_time is null or reminder_time ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
