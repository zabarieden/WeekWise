-- Indexes (2026-11-07 audit). Every RLS policy filters by user_id, and ~30 tables had no index starting with
-- user_id, so each screen load would scan the whole table once there are many users. The second column matches
-- the date / kind the app's queries filter or sort by (checked in app.js, home.js, new-me.js, workouts.js...).
-- Foreign keys without an index slow down deletes of the parent row (e.g. deleting a goal or a book) - indexed too.
-- The tables are still small, so a plain CREATE INDEX takes milliseconds. On a big table later, run each one alone
-- as CREATE INDEX CONCURRENTLY so writes are not blocked while it builds.
-- Run with: supabase db query --linked -f supabase/sql/2026-11-07_4_indexes.sql

-- per user + the date the app reads by
create index if not exists idx_calorie_tracker_user_date on public.calorie_tracker (user_id, date);
create index if not exists idx_water_logs_user_date on public.water_logs (user_id, log_date);
create index if not exists idx_weight_tracker_user_date on public.weight_tracker (user_id, weight_date);
create index if not exists idx_step_tracker_user_date on public.step_tracker (user_id, step_date);
create index if not exists idx_budget_tracker_user_date on public.budget_tracker (user_id, entry_date);
create index if not exists idx_sport_sessions_user_date on public.sport_sessions (user_id, session_date);
create index if not exists idx_receipts_user_date on public.receipts (user_id, receipt_date);
create index if not exists idx_progress_checkins_user_date on public.progress_checkins (user_id, check_date);
create index if not exists idx_weekly_schedule_user_day on public.weekly_schedule (user_id, day_of_week);
create index if not exists idx_routine_items_user_kind on public.routine_items (user_id, kind);
create index if not exists idx_recipes_user_created on public.recipes (user_id, created_at);

-- per user
create index if not exists idx_habits_user on public.habits (user_id);
create index if not exists idx_habit_checkins_user on public.habit_checkins (user_id);
create index if not exists idx_meal_presets_user on public.meal_presets (user_id);
create index if not exists idx_routine_tabs_user on public.routine_tabs (user_id);
create index if not exists idx_routine_item_checkins_user on public.routine_item_checkins (user_id);
create index if not exists idx_vision_goals_user on public.vision_goals (user_id);
create index if not exists idx_vision_goal_milestones_user on public.vision_goal_milestones (user_id);
create index if not exists idx_vision_goal_checkins_user on public.vision_goal_checkins (user_id);
create index if not exists idx_weekly_progress_targets_user on public.weekly_progress_targets (user_id);
create index if not exists idx_custom_tables_user on public.custom_tables (user_id);
create index if not exists idx_custom_table_columns_user on public.custom_table_columns (user_id);
create index if not exists idx_custom_table_rows_user on public.custom_table_rows (user_id);
create index if not exists idx_projects_user on public.projects (user_id);
create index if not exists idx_project_notebooks_user on public.project_notebooks (user_id);
create index if not exists idx_notebook_pages_user on public.notebook_pages (user_id);
create index if not exists idx_notebook_items_user on public.notebook_items (user_id);
create index if not exists idx_new_me_saved_drinks_user on public.new_me_saved_drinks (user_id);
create index if not exists idx_push_subscriptions_user on public.push_subscriptions (user_id);
create index if not exists idx_feedback_messages_user on public.feedback_messages (user_id);
create index if not exists idx_google_oauth_state_user on public.google_oauth_state (user_id);

-- foreign keys
create index if not exists idx_routine_items_tab on public.routine_items (tab_id);
create index if not exists idx_routine_items_goal on public.routine_items (vision_goal_id);
create index if not exists idx_routine_items_milestone on public.routine_items (vision_milestone_id);
create index if not exists idx_vision_goal_milestones_goal on public.vision_goal_milestones (goal_id);
create index if not exists idx_vision_goal_checkins_milestone on public.vision_goal_checkins (milestone_id);
create index if not exists idx_book_reading_log_book on public.book_reading_log (book_id);
create index if not exists idx_room_quotes_book on public.room_quotes (book_id);
create index if not exists idx_room_wishes_goal on public.room_wishes (goal_id);
create index if not exists idx_project_notebooks_bookmark on public.project_notebooks (bookmark_page_id);
create index if not exists idx_sport_sessions_habit on public.sport_sessions (source_habit_id);
create index if not exists idx_sport_sessions_routine_item on public.sport_sessions (source_routine_item_id);
create index if not exists idx_study_tasks_milestone on public.study_tasks (linked_milestone_id);
create index if not exists idx_user_premium_books_goal on public.user_premium (books_goal_id);
create index if not exists idx_workout_plan_routine_item on public.workout_plan (routine_item_id);

-- let the planner know the new indexes exist
analyze;
