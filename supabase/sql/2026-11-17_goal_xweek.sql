-- My Goals: a small step "N times a week" (her pick, idea 11 from Google Fit, 2026-11-15) - shows every day until it was done
-- N times this week. reminder_times = N (2-6), only with reminder_freq = 'xweek'.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-17_goal_xweek.sql
alter table public.vision_goals drop constraint if exists vision_goals_reminder_freq_check;
alter table public.vision_goals add constraint vision_goals_reminder_freq_check check (reminder_freq is null or reminder_freq = any (array['daily'::text, 'weekly'::text, 'xweek'::text]));
alter table public.vision_goals add column if not exists reminder_times smallint;
alter table public.vision_goals drop constraint if exists vision_goals_reminder_times_check;
alter table public.vision_goals add constraint vision_goals_reminder_times_check check (reminder_times is null or (reminder_times >= 2 and reminder_times <= 6));
