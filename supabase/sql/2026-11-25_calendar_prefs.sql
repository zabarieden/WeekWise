-- 📅 הגדרות יומן (calendar-views.js): היום הראשון בשבוע, 24/12 שעות, מספרי שבועות, ימים שמוצגים, אזור זמן נוסף,
-- משך ותזכורת ברירת מחדל, והתצוגה האחרונה - נשמרים בחשבון כדי שיהיו זהים בכל המכשירים (2026-11-25).
-- user_premium כבר עם RLS (כל אחד רק את השורה שלו) ועם הרשאות ל-authenticated - רק עמודה חדשה וגבול גודל.
alter table public.user_premium add column if not exists calendar_prefs jsonb;
do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'user_premium_calendar_prefs_size') then
        alter table public.user_premium add constraint user_premium_calendar_prefs_size
            check (calendar_prefs is null or (jsonb_typeof(calendar_prefs) = 'object' and pg_column_size(calendar_prefs) < 4000));
    end if;
end $$;
