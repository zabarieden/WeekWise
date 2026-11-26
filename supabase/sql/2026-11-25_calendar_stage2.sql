-- 📅 יומן שלב 2 (פרטי האירוע + חזרות, 13–25 מהרשימה שבחרה; אישרה: "כן מאשרת את יומן שלב 2", 2026-11-25)
-- 1. יומנים נפרדים עם צבע (אישי / עבודה / משפחה...), הצגה והסתרה של כל אחד - user_calendars
-- 2. עמודות חדשות לאירוע: כל היום, עד תאריך (כמה ימים), יומן, סמל, פנוי/עסוק, קבצים מצורפים
-- 3. תיקייה פרטית לקבצים של אירועים (calendar-files): כל אחד רק בתיקייה של עצמו, עד 10MB, תמונות ו-PDF
-- החזרות החדשות (שנתית, "השלישי השני בחודש", כמה ימים בשבוע, X פעמים, "הזה והבאים") לא צריכות עמודות -
-- הסדרה נשמרת כמו היום: שורה לכל מופע עם recurrence_group_id.

-- 1 ---------------------------------------------------------------------------
create table if not exists public.user_calendars (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
    name text not null,
    color text not null default '#a78bfa',
    is_visible boolean not null default true,
    sort_order integer not null default 0,
    created_at timestamptz not null default now(),
    constraint user_calendars_name_len check (char_length(btrim(name)) between 1 and 60),
    constraint user_calendars_color_hex check (color ~ '^#[0-9a-fA-F]{6}$')
);
create index if not exists user_calendars_user_idx on public.user_calendars (user_id, sort_order);
alter table public.user_calendars enable row level security;
drop policy if exists "user_calendars_select_own" on public.user_calendars;
drop policy if exists "user_calendars_insert_own" on public.user_calendars;
drop policy if exists "user_calendars_update_own" on public.user_calendars;
drop policy if exists "user_calendars_delete_own" on public.user_calendars;
create policy "user_calendars_select_own" on public.user_calendars for select to authenticated using (user_id = (select auth.uid()));
create policy "user_calendars_insert_own" on public.user_calendars for insert to authenticated with check (user_id = (select auth.uid()));
create policy "user_calendars_update_own" on public.user_calendars for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "user_calendars_delete_own" on public.user_calendars for delete to authenticated using (user_id = (select auth.uid()));
revoke all on public.user_calendars from anon;
grant select, insert, update, delete on public.user_calendars to authenticated;

-- 2 ---------------------------------------------------------------------------
alter table public.calendar_events add column if not exists all_day boolean not null default false;
alter table public.calendar_events add column if not exists end_date date;
alter table public.calendar_events add column if not exists calendar_id uuid references public.user_calendars(id) on delete set null;
alter table public.calendar_events add column if not exists icon text;
alter table public.calendar_events add column if not exists is_free boolean not null default false;
alter table public.calendar_events add column if not exists attachments jsonb;
do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'calendar_events_stage2_check') then
        alter table public.calendar_events add constraint calendar_events_stage2_check check (
            (end_date is null or end_date >= event_date)
            and (icon is null or char_length(icon) <= 16)
            and (attachments is null or (jsonb_typeof(attachments) = 'array' and jsonb_array_length(attachments) <= 10 and pg_column_size(attachments) < 8000))
        );
    end if;
end $$;
-- אירועים של כמה ימים: "מה נוגע בטווח" מחפש גם לפי תאריך הסיום
create index if not exists calendar_events_user_end_date_idx on public.calendar_events (user_id, end_date) where end_date is not null;
create index if not exists calendar_events_calendar_idx on public.calendar_events (calendar_id) where calendar_id is not null;

-- 3 ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('calendar-files', 'calendar-files', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
drop policy if exists "Users read own calendar files" on storage.objects;
drop policy if exists "Users upload own calendar files" on storage.objects;
drop policy if exists "Users update own calendar files" on storage.objects;
drop policy if exists "Users delete own calendar files" on storage.objects;
create policy "Users read own calendar files" on storage.objects for select to authenticated
    using (bucket_id = 'calendar-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users upload own calendar files" on storage.objects for insert to authenticated
    with check (bucket_id = 'calendar-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users update own calendar files" on storage.objects for update to authenticated
    using (bucket_id = 'calendar-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "Users delete own calendar files" on storage.objects for delete to authenticated
    using (bucket_id = 'calendar-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
