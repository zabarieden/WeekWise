-- יומן שלב 2: מחיקת מופע אחד מסדרה חוזרת (או "זה וכל הבאים") מגיעה גם ליומן גוגל.
-- עד עכשיו הטריגר שלח לגוגל מחיקה רק כשנמחק המופע האחרון של הסדרה, ומופע בודד שנמחק
-- באפליקציה נשאר בגוגל. עכשיו: שורה 'delete_instance' עם תאריך+שעה המקוריים של המופע
-- (העוגן שמזהה אותו בתוך הסדרה בגוגל); google-calendar-outbox-drain מוחק בדיוק את המופע הזה.
-- להריץ לפני פריסת google-calendar-outbox-drain החדשה (היא קוראת את העמודות החדשות).

alter table public.calendar_sync_outbox
    add column if not exists instance_date date,
    add column if not exists instance_time text;

alter table public.calendar_sync_outbox drop constraint if exists calendar_sync_outbox_action_check;
alter table public.calendar_sync_outbox add constraint calendar_sync_outbox_action_check
    check (action = any (array['insert'::text, 'update'::text, 'delete'::text, 'delete_instance'::text]));

create or replace function public.calendar_events_enqueue_outbox()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if TG_OP = 'DELETE' then
    if current_setting('app.skip_outbox_trigger', true) = 'true' then
      return OLD;
    end if;
    if OLD.source in ('calendar', 'note_task') and OLD.google_event_id is not null then
      if OLD.recurrence_group_id is null or not exists (
        select 1 from calendar_events where recurrence_group_id = OLD.recurrence_group_id
      ) then
        insert into calendar_sync_outbox (calendar_event_id, user_id, action, google_event_id, recurrence_group_id, google_calendar_id)
        values (OLD.id, OLD.user_id, 'delete', OLD.google_event_id, OLD.recurrence_group_id, OLD.google_calendar_id);
      else
        -- מופע אחד מתוך סדרה שעוד חיה - מוחקים בגוגל רק אותו
        insert into calendar_sync_outbox (calendar_event_id, user_id, action, google_event_id, recurrence_group_id, google_calendar_id, instance_date, instance_time)
        values (OLD.id, OLD.user_id, 'delete_instance', OLD.google_event_id, OLD.recurrence_group_id, OLD.google_calendar_id,
          coalesce(OLD.recurrence_original_date, OLD.event_date), coalesce(OLD.recurrence_original_time, OLD.event_time));
      end if;
    end if;
    return OLD;
  elsif TG_OP = 'INSERT' then
    if current_setting('app.skip_outbox_trigger', true) = 'true' then
      return NEW;
    end if;
    if NEW.source in ('calendar', 'note_task') and NEW.google_synced_at is null then
      insert into calendar_sync_outbox (calendar_event_id, user_id, action, recurrence_group_id)
      values (NEW.id, NEW.user_id, 'insert', NEW.recurrence_group_id);
    end if;
    return NEW;
  elsif TG_OP = 'UPDATE' then
    if current_setting('app.skip_outbox_trigger', true) = 'true' then
      return NEW;
    end if;
    if NEW.source in ('calendar', 'note_task') and NEW.google_synced_at is not distinct from OLD.google_synced_at then
      insert into calendar_sync_outbox (calendar_event_id, user_id, action, google_event_id, recurrence_group_id, google_calendar_id, is_series_title_edit)
      values (NEW.id, NEW.user_id, 'update', NEW.google_event_id, NEW.recurrence_group_id, NEW.google_calendar_id,
        coalesce(current_setting('app.series_title_edit', true), 'false') = 'true');
    end if;
    return NEW;
  end if;
  return null;
end;
$function$;
