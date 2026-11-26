-- מעקב מים (בחירותיה 2026-11-26: 1-13): הגדרות המים בחשבון (היעד, הכוסות שלי, מ״ל/אונקיות, תזכורת לפי הקצב),
-- וסוג המשקה + הקלוריות שלו בכל רישום. כל המשקאות נספרים ליעד; משקה עם קלוריות נרשם גם במעקב הארוחות
alter table public.user_premium add column if not exists water_prefs jsonb;
alter table public.user_premium drop constraint if exists user_premium_water_prefs_check;
alter table public.user_premium add constraint user_premium_water_prefs_check check (water_prefs is null or (jsonb_typeof(water_prefs) = 'object' and pg_column_size(water_prefs) < 4000));

alter table public.water_logs
    add column if not exists drink text,
    add column if not exists kcal integer;
alter table public.water_logs drop constraint if exists water_logs_drink_kcal_check;
alter table public.water_logs add constraint water_logs_drink_kcal_check check ((drink is null or char_length(drink) <= 24) and (kcal is null or kcal between 0 and 5000));

-- תזכורת שתייה לפי הקצב (send-due-reminders): נמסרת פעם אחת בכל חלון של שעתיים - water_s<מספר החלון>
alter table public.reminder_deliveries drop constraint if exists reminder_deliveries_source_type_check;
alter table public.reminder_deliveries add constraint reminder_deliveries_source_type_check
    check (source_type ~ '^(schedule|event|workout|event_leave|event_r[0-9]{1,5}|cal_morning|cal_evening|water_s[0-9]{1,2})$');
