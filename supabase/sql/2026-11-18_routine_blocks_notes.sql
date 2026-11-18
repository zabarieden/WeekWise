-- 🔗 Routine blocks + a note / "Not today" next to each ✓ (2026-11-18, her pick: option 2 "a block that opens")
-- 1) routine_items.block_name: items in the same tab with the same block name are one block (one ✓ in focus)
alter table public.routine_items add column if not exists block_name text;
do $$ begin
    if not exists (select 1 from pg_constraint where conname = 'routine_items_block_name_len') then
        alter table public.routine_items add constraint routine_items_block_name_len check (block_name is null or char_length(block_name) between 1 and 40);
    end if;
end $$;

-- 2) routine_item_day_notes: today's note and "Not today" for one routine item (a row only when there's something)
create table if not exists public.routine_item_day_notes (
    id uuid primary key default gen_random_uuid(),
    item_id uuid not null references public.routine_items(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    note_date date not null,
    skipped boolean not null default false,
    note text check (note is null or char_length(note) <= 200),
    updated_at timestamptz not null default now(),
    unique (item_id, note_date)
);
create index if not exists routine_item_day_notes_user_date on public.routine_item_day_notes (user_id, note_date);
alter table public.routine_item_day_notes enable row level security;
drop policy if exists routine_item_day_notes_owner on public.routine_item_day_notes;
create policy routine_item_day_notes_owner on public.routine_item_day_notes
    for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- since 10-30 every new public table needs an explicit grant (and nothing for anon)
revoke all on public.routine_item_day_notes from anon;
grant select, insert, update, delete on public.routine_item_day_notes to authenticated;
