-- NOT10 Nourish+ weekly meal check-in (her ask, item 6 of 2026-11-02, confirmed 2026-11-15): once a week on the meals
-- screen - only if meals were ✓ on at least 5 of the last 7 days - "how were the meals? too much / just right / too little".
-- meal_adjust = { slot: kcal } moved into (or out of) that meal; the day total stays exactly the plan (the other meals give
-- or take the difference). meal_review_at = when it was last asked / answered.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-15_new_me_meal_review.sql

alter table public.new_me_profile add column if not exists meal_adjust jsonb;
alter table public.new_me_profile add column if not exists meal_review_at timestamptz;
