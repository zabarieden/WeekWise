-- Security hardening (2026-11-07 audit). RLS was already on for all 76 tables and every user policy is tied to auth.uid().
-- Run with: supabase db query --linked -f supabase/sql/2026-11-07_3_security.sql

-- 1. Defense in depth: the app reads and writes data only after login, so the anonymous role needs no table access.
--    RLS already blocked it (auth.uid() is null for anon); this removes the base privilege too, also for future tables.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

-- 2. completed_tasks is left over from the first version (no code uses it) and was matched by username/e-mail
--    instead of auth.uid(). Close it for signed-in users as well; the rows stay untouched.
revoke all on table public.completed_tasks from authenticated;

-- 3. UPDATE policies without WITH CHECK: Postgres already reuses USING for the new row, this only makes it explicit,
--    so a row can never be moved to another user even if a USING clause changes one day.
alter policy "custom_table_columns_update_own" on public.custom_table_columns with check ((auth.uid() = user_id));
alter policy "custom_table_rows_update_own" on public.custom_table_rows with check ((auth.uid() = user_id));
alter policy "custom_tables_update_own" on public.custom_tables with check ((auth.uid() = user_id));
alter policy "notebook_items_update_own" on public.notebook_items with check ((auth.uid() = user_id));
alter policy "notebook_pages_update_own" on public.notebook_pages with check ((auth.uid() = user_id));
alter policy "project_notebooks_update_own" on public.project_notebooks with check ((auth.uid() = user_id));
alter policy "projects_update_own" on public.projects with check ((auth.uid() = user_id));
alter policy "recurring_expenses_update_own" on public.recurring_expenses with check ((auth.uid() = user_id));
alter policy "study_tasks_update_own" on public.study_tasks with check ((auth.uid() = user_id));
alter policy "vision_goal_milestones_update_own" on public.vision_goal_milestones with check ((auth.uid() = user_id));
alter policy "vision_goals_update_own" on public.vision_goals with check ((auth.uid() = user_id));
