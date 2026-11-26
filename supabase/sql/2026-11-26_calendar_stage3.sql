-- יומן שלב 3 (לפי בחירה מפורשת, 2026-11-24: 26-29): כמה תזכורות לאירוע, "זמן לצאת", סיכום בוקר ו"מה מחר" בערב.
-- extra_reminders = עוד תזכורות (דקות לפני האירוע, עד 5, עד 4 שבועות). travel_minutes = כמה זמן הדרך -
-- send-due-reminders שולח "הגיע הזמן לצאת" באותו זמן לפני. סיכום בוקר / ערב נשמרים ב-user_premium.calendar_prefs (morning / evening).
-- reminder_deliveries: סוגים חדשים - event_r<דקות> / event_leave (לכל אירוע ותאריך) ו-cal_morning / cal_evening (לכל יום)

alter table public.calendar_events
    add column if not exists extra_reminders integer[],
    add column if not exists travel_minutes smallint;

alter table public.calendar_events drop constraint if exists calendar_events_stage3_check;
alter table public.calendar_events add constraint calendar_events_stage3_check check (
    (extra_reminders is null or (cardinality(extra_reminders) <= 5 and 0 <= all (extra_reminders) and 40320 >= all (extra_reminders)))
    and (travel_minutes is null or travel_minutes between 1 and 600)
);

create index if not exists calendar_events_stage3_rem_idx on public.calendar_events (user_id, event_date)
    where extra_reminders is not null or travel_minutes is not null;

alter table public.reminder_deliveries drop constraint if exists reminder_deliveries_source_type_check;
alter table public.reminder_deliveries add constraint reminder_deliveries_source_type_check
    check (source_type ~ '^(schedule|event|workout|event_leave|event_r[0-9]{1,5}|cal_morning|cal_evening)$');
