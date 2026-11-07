-- New Me yearly plan ($49.99 a year, from 2026-11-07): user_premium.new_me_plan may also be 'yearly'.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-07_1_new_me_yearly.sql
alter table public.user_premium drop constraint if exists user_premium_new_me_plan_check;
alter table public.user_premium add constraint user_premium_new_me_plan_check
    check (new_me_plan = any (array['lifetime'::text, 'monthly'::text, 'yearly'::text]));
