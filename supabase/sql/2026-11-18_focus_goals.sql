-- 2026-11-18 (her OK): the year-end goals in focus sync across devices
-- ("הוספתי מטרה לסוף שנה בפוקוס ולא ראיתי אותה במובייל ובדפדפן כן")
-- a list of up to 2: a goal id from My Goals, or {"t": "text"} for one written by hand
alter table public.user_premium add column if not exists focus_goals jsonb;
do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'user_premium_focus_goals_shape') then
        alter table public.user_premium add constraint user_premium_focus_goals_shape check (focus_goals is null or (jsonb_typeof(focus_goals) = 'array' and jsonb_array_length(focus_goals) <= 2 and pg_column_size(focus_goals) <= 2000));
    end if;
end $$;
