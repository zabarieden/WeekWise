-- 🏋️ יומן המתאמנים (הבחירה שלה 2026-11-26: 1-9, 11, 12, 14-17)
-- 1) sport_sessions.sets: מה נעשה באימון - תרגילים וסטים (משקל × חזרות / שניות, סוג סט, סופרסט). jsonb קטן לכל אימון
-- 2) workout_templates: אימונים שמורים לפי שם ("רגליים A") - מחפשים, מתחילים עותק, ובסוף אפשר לעדכן את התבנית
-- לא מוחק ולא משנה שום נתון קיים.

alter table public.sport_sessions add column if not exists sets jsonb;
do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'sport_sessions_sets_shape') then
        alter table public.sport_sessions add constraint sport_sessions_sets_shape
            check (sets is null or (jsonb_typeof(sets) = 'array' and pg_column_size(sets) < 60000));
    end if;
end $$;

create table if not exists public.workout_templates (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 60),
    kind text,
    exercises jsonb not null default '[]'::jsonb check (jsonb_typeof(exercises) = 'array' and pg_column_size(exercises) < 60000),
    last_used_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);
create index if not exists workout_templates_user_idx on public.workout_templates (user_id, last_used_at desc);
alter table public.workout_templates enable row level security;
drop policy if exists workout_templates_own on public.workout_templates;
create policy workout_templates_own on public.workout_templates
    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update, delete on public.workout_templates to authenticated;
