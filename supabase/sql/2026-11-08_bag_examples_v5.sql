-- Bag examples version 5 (2026-11-08): 93 gift ideas and 5 new gift categories. A bag that already got version 4
-- receives the new ideas once (bag.js bagGiftsUpgrade); this flag marks that it happened, like bag_examples_v2..v4.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-08_bag_examples_v5.sql
alter table public.user_premium add column if not exists bag_examples_v5 boolean not null default false;
