-- 2026-11-18 (her OK): two small additions, no existing data changes
-- 1) shopping list: "cart" = bought, crossed off, but stays on the list ("לעשות קו כאילו את זה קניתי כבר אבל כן רוצים להשאיר ברשימה")
alter table public.my_center_tasks drop constraint if exists my_center_tasks_shop_state_check;
alter table public.my_center_tasks add constraint my_center_tasks_shop_state_check
    check (shop_state is null or shop_state = any (array['again'::text, 'transit'::text, 'cart'::text]));

-- 2) "מה מפריע לי": the plan of a goal made from something that bothers you (if-then, plan B, ladder level, weekly check-ins)
alter table public.vision_goals add column if not exists change_plan jsonb;
do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'vision_goals_change_plan_size') then
        alter table public.vision_goals add constraint vision_goals_change_plan_size check (change_plan is null or (jsonb_typeof(change_plan) = 'object' and pg_column_size(change_plan) <= 8000));
    end if;
end $$;
