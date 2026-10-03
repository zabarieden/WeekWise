// Supabase Edge Function: send-due-reminders
//
// Runs on a schedule (see the pg_cron SQL in DEPLOY.md) and sends a real Web Push
// notification for every weekly_schedule reminder that is due right now, for every
// user's timezone, so reminders fire even when the app/browser tab is fully closed.
// Also sends the New Me meal reminders (new_me_reminders - one time per meal).
//
// This mirrors the client-side checkReminders()/fireReminder() logic in app.js:
// same "no upper bound" philosophy (if a reminder was missed - e.g. this function's
// schedule had downtime - it still fires once, late, rather than being silently
// skipped), deduplicated per calendar day via weekly_schedule.last_notified_date.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_CONTACT_EMAIL = Deno.env.get("VAPID_CONTACT_EMAIL") || "mailto:admin@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// כל ההתחלה עטופה ב-try/catch מפורש: כשל כאן (למשל מפתח VAPID לא תקין) היה
// מפיל את כל המודול עם "WORKER_ERROR: Function exited due to an error" חסר-
// פרטים לגמרי, בלי שום דרך לדעת למה מבחוץ (אין גישה ל-logs דרך ה-CLI כאן) -
// לפי בקשה מפורשת לאבחן למה תזכורות בכלל לא הגיעו. עכשיו כשל בשלב הזה עדיין
// גורם לכל קריאה להיכשל, אבל עם הודעת שגיאה אמיתית וקריאה ב-net._http_response
let initError: string | null = null;
try {
    webpush.setVapidDetails(VAPID_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err: any) {
    initError = `VAPID init failed: ${err?.message || err}`;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const DB_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// תזכורת שהתפספסה (למשל כשהפונקציה לא רצה) נשלחת באיחור - עד שעה אחרי תחילת המשימה
const LATE_LIMIT_MINUTES = 60;

// מחזיר את התאריך/שעה המקומיים של המשתמש (לפי אזור הזמן השמור), בלי לבנות Date חדש -
// כי בניית Date "מקומי" מתוך IANA timezone דורשת חישוב offset, וזה המסלול הפשוט והבטוח.
function getLocalWallClock(now: Date, timeZone: string) {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "long",
    });
    const parts = dtf.formatToParts(now);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    return {
        dateStr: `${map.year}-${map.month}-${map.day}`,
        dbDay: map.weekday, // "Sunday".."Saturday" - matches dbDaysMap in app.js exactly
        hour: parseInt(map.hour, 10),
        minute: parseInt(map.minute, 10),
    };
}

Deno.serve(async (_req) => {
    if (initError) return jsonResponse({ ok: false, error: initError }, 500);
    try {
        return await handleRequest();
    } catch (err: any) {
        return jsonResponse({ ok: false, error: err?.message || String(err), stack: err?.stack }, 500);
    }
});

async function handleRequest(): Promise<Response> {
    const now = new Date();

    // כל המנויים הפעילים, מקובצים לפי user_id - כדי לדעת אילו משתמשים בכלל צריך לבדוק
    const { data: subs, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("*");
    if (subsError) return jsonResponse({ ok: false, error: subsError.message }, 500);
    if (!subs || !subs.length) return jsonResponse({ ok: true, checked: 0, sent: 0 });

    const subsByUser = new Map<string, typeof subs>();
    for (const s of subs) {
        if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
        subsByUser.get(s.user_id)!.push(s);
    }

    let sent = 0;
    let checked = 0;

    // נודניקים ישנים (למשל של משתמש/ת בלי מנוי Push, שלא יכול להישלח לו) לא נשארים לנצח
    await supabase.from("reminder_snoozes").delete().lt("next_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());

    for (const [userId, userSubs] of subsByUser) {
        const timeZone = userSubs[0]?.timezone || "UTC";
        const wallClock = getLocalWallClock(now, timeZone);
        const nowMinutes = wallClock.hour * 60 + wallClock.minute;

        const { data: dueRows } = await supabase
            .from("weekly_schedule")
            .select("id, task_title, reminder_text, reminder_minutes, time_of_day, last_notified_date")
            .eq("user_id", userId)
            .eq("day_of_week", wallClock.dbDay)
            .gt("reminder_minutes", 0);

        for (const row of dueRows ?? []) {
            checked++;
            if (!row.time_of_day) continue;
            if (row.last_notified_date === wallClock.dateStr) continue; // כבר נשלח היום

            const [h, m] = row.time_of_day.split(":").map((n: string) => parseInt(n, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) continue;
            const taskMinutes = h * 60 + m;
            const triggerMinutes = taskMinutes - row.reminder_minutes;

            // אם הפונקציה לא רצה בזמן, עדיף לשלוח באיחור פעם אחת מאשר לפספס - אבל לא על משימה
            // שהתחילה לפני יותר משעה: התראה בשלוש לפנות בוקר על משהו מחצות היא רק רעש
            if (nowMinutes < triggerMinutes) continue;
            if (nowMinutes > taskMinutes + LATE_LIMIT_MINUTES) continue;

            const title = `⏰ ${row.task_title || "MyWeek"}`;
            const body = row.reminder_text || "";
            // tag דטרמיניסטי (לא קבוע-גנרי) - חייב, משתי סיבות: (1) בלי tag ייחודי
            // פר-תזכורת, שתי תזכורות שונות שהגיעו לזמנן באותו סבב-דחיפה היו
            // "דורסות" זו את זו בתצוגה (רק האחרונה הייתה נראית - התנהגות דפדפן
            // מובנית ל-tag משותף); (2) אותו נוסחה בדיוק כמו reminderNotificationTag
            // ב-app.js, כדי שהתראת-Push הזו תתמזג עם showBrowserNotification הישירה
            // מהלקוח אם שתיהן ירוצו על אותה תזכורת - מונע כפילות שדווחה בפועל
            const tag = `weekwise-reminder-schedule-${row.id}-${wallClock.dateStr}`;
            // actions/data: כפתורי "בוצע"/"עוד לא" ישירות על התראת-המערכת עצמה,
            // לא רק בפופאפ הפנימי - sw.js קורא את זה ב-notificationclick ומפעיל
            // mark-reminder-done. userId חייב בתוך data כי אין session בתוך ה-
            // Service Worker לדעת מי המשתמשת - ר' ההערה ב-mark-reminder-done
            const actions = [
                { action: "done", title: "✅" },
                { action: "not_done", title: "⏰" },
            ];
            const data = { sourceType: "schedule", sourceId: row.id, sourceDate: wallClock.dateStr, userId };

            let anySucceeded = false;
            for (const sub of userSubs) {
                try {
                    // urgency: 'high' - בלי זה FCM/הדפדפן מרשים לעצמם לדחות מסרים "רגילים"
                    // כשהמכשיר ב-Doze/חיסכון סוללה, מה שדווח בפועל כתזכורת שהגיעה
                    // באיחור ניכר. TTL קצר יחסית (10 דק') - תזכורת שלא הגיעה תוך זמן
                    // סביר כבר לא רלוונטית, עדיף שהיא תיפול מאשר תגיע מאוחר מדי
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify({ title, body, tag, actions, data }),
                        { urgency: "high", TTL: 600 },
                    );
                    anySucceeded = true;
                    sent++;
                } catch (err: any) {
                    // מנוי מת (הדפדפן בוטל/הותקן מחדש) - מסירים אותו כדי לא לנסות שוב לשווא
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                    }
                }
            }

            if (anySucceeded) {
                await supabase.from("weekly_schedule").update({ last_notified_date: wallClock.dateStr }).eq("id", row.id);
            }
        }

        // אותו דבר בדיוק, בשביל אירועים חד-פעמיים ב"מבט ליומן" (calendar_events) -
        // מסוננים לפי event_date מדויק (לא day_of_week חוזר כמו למעלה), עם דדופ
        // נפרד משלהם (calendar_events.last_notified_date, לא זו של weekly_schedule)
        const { data: dueEvents } = await supabase
            .from("calendar_events")
            .select("id, event_title, reminder_text, reminder_minutes, event_time, last_notified_date, google_event_id")
            .eq("user_id", userId)
            .eq("event_date", wallClock.dateStr)
            .gt("reminder_minutes", 0);

        for (const row of dueEvents ?? []) {
            checked++;
            if (!row.event_time) continue;
            if (row.last_notified_date === wallClock.dateStr) continue;
            // גם אירוע שמסונכרן עם גוגל מקבל התראה מכאן: האפליקציה היא היחידה שמתריעה על
            // אירוע עם תזכורת שהוגדרה בה (בגוגל הוא נשמר בלי תזכורות - ר' reminderBody ב-
            // google-calendar-outbox-drain). קודם גוגל התריעה ואנחנו דילגנו, ולכן כשהאפליקציה
            // הייתה סגורה לא הגיעה ממנה שום התראה, וכשהייתה פתוחה הגיעו שתיים

            const [h, m] = row.event_time.split(":").map((n: string) => parseInt(n, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) continue;
            const taskMinutes = h * 60 + m;
            const triggerMinutes = taskMinutes - row.reminder_minutes;
            if (nowMinutes < triggerMinutes) continue;
            if (nowMinutes > taskMinutes + LATE_LIMIT_MINUTES) continue;

            const title = `⏰ ${row.event_title || "NOT10.ai"}`;
            const body = row.reminder_text || "";
            const tag = `weekwise-reminder-event-${row.id}-${wallClock.dateStr}`;
            const actions = [
                { action: "done", title: "✅" },
                { action: "not_done", title: "⏰" },
            ];
            const data = { sourceType: "event", sourceId: row.id, sourceDate: wallClock.dateStr, userId };

            let anySucceeded = false;
            for (const sub of userSubs) {
                try {
                    // urgency: 'high' - בלי זה FCM/הדפדפן מרשים לעצמם לדחות מסרים "רגילים"
                    // כשהמכשיר ב-Doze/חיסכון סוללה, מה שדווח בפועל כתזכורת שהגיעה
                    // באיחור ניכר. TTL קצר יחסית (10 דק') - תזכורת שלא הגיעה תוך זמן
                    // סביר כבר לא רלוונטית, עדיף שהיא תיפול מאשר תגיע מאוחר מדי
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify({ title, body, tag, actions, data }),
                        { urgency: "high", TTL: 600 },
                    );
                    anySucceeded = true;
                    sent++;
                } catch (err: any) {
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                    }
                }
            }

            if (anySucceeded) {
                await supabase.from("calendar_events").update({ last_notified_date: wallClock.dateStr }).eq("id", row.id);
            }
        }

        // נודניק: "⏰ עוד לא" (בהתראה או בפופאפ) נכנס ל-reminder_snoozes - התראה חוזרת כל 5 דקות
        // עד "בוצע" / "הבנתי" (או סגירת ההתראה), עד 6 פעמים אם מתעלמים. אם המשימה כבר סומנה
        // כבוצעה בינתיים - מפסיקים בשקט
        const { data: snoozes } = await supabase
            .from("reminder_snoozes")
            .select("*")
            .eq("user_id", userId)
            .lte("next_at", now.toISOString())
            .gt("remaining", 0);
        for (const sn of snoozes ?? []) {
            checked++;
            const key = { user_id: userId, source_type: sn.source_type, source_id: sn.source_id, source_date: sn.source_date };
            const removeSnooze = () => supabase.from("reminder_snoozes").delete().match(key);
            let done = false;
            if (sn.source_type === "event") {
                const { data: ev } = await supabase.from("calendar_events").select("is_completed").eq("id", sn.source_id).maybeSingle();
                done = !ev || !!ev.is_completed;
            } else {
                const [{ data: comp }, { data: sched }] = await Promise.all([
                    supabase.from("schedule_completions").select("schedule_id").eq("schedule_id", sn.source_id).eq("completion_date", sn.source_date).maybeSingle(),
                    supabase.from("weekly_schedule").select("id").eq("id", sn.source_id).maybeSingle(),
                ]);
                done = !!comp || !sched;
            }
            if (done) { await removeSnooze(); continue; }

            const title = `⏰ ${sn.title || "NOT10.ai"}`;
            const body = sn.body || "";
            // אותו tag כמו ההתראה המקורית - מחליף אותה במקום להצטבר, ו-renotify כדי שתצלצל שוב
            const tag = `weekwise-reminder-${sn.source_type}-${sn.source_id}-${sn.source_date}`;
            const actions = [
                { action: "done", title: "✅" },
                { action: "not_done", title: "⏰" },
            ];
            const data = { sourceType: sn.source_type, sourceId: sn.source_id, sourceDate: sn.source_date, userId, snooze: true, taskTitle: sn.title || "", text: sn.body || "" };
            for (const sub of userSubs) {
                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify({ title, body, tag, actions, data, renotify: true }),
                        { urgency: "high", TTL: 300 },
                    );
                    sent++;
                } catch (err: any) {
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                    }
                }
            }
            const remaining = (sn.remaining || 1) - 1;
            if (remaining <= 0) await removeSnooze();
            else await supabase.from("reminder_snoozes").update({ remaining, next_at: new Date(now.getTime() + 5 * 60 * 1000).toISOString() }).match(key);
        }

        // תזכורות ארוחה של New Me: שעה אחת לכל ארוחה (new_me_reminders, הטקסט נכתב מהאפליקציה
        // בשפת המשתמש/ת). לא שולחים אם הארוחה כבר סומנה ✓ היום, ולא שולחים באיחור של יותר
        // משעה וחצי - תזכורת לארוחת בוקר בצהריים היא רק רעש
        const { data: mealRems } = await supabase
            .from("new_me_reminders")
            .select("position, slot, time, title, body, today_body, today_date, last_sent_date")
            .eq("user_id", userId)
            .eq("enabled", true);
        const dueMeals = (mealRems ?? []).filter((r) => {
            if (r.last_sent_date === wallClock.dateStr) return false;
            const [h, m] = String(r.time || "").split(":").map((n: string) => parseInt(n, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) return false;
            const due = h * 60 + m;
            return nowMinutes >= due && nowMinutes - due <= 90;
        });
        if (dueMeals.length) {
            const [{ data: prof }, { data: checked }] = await Promise.all([
                supabase.from("new_me_profile").select("reminders_on").eq("user_id", userId).maybeSingle(),
                supabase.from("new_me_checkins").select("slot").eq("user_id", userId).eq("checkin_date", wallClock.dateStr),
            ]);
            const eaten = new Set((checked ?? []).map((c) => c.slot));
            for (const r of prof?.reminders_on ? dueMeals : []) {
                if (eaten.has(r.slot)) {
                    await supabase.from("new_me_reminders").update({ last_sent_date: wallClock.dateStr }).eq("user_id", userId).eq("position", r.position);
                    continue;
                }
                const body = r.today_date === wallClock.dateStr && r.today_body ? r.today_body : (r.body || "");
                const tag = `weekwise-newme-meal-${r.position}-${wallClock.dateStr}`;
                const data = { open: "newme" };
                let anySucceeded = false;
                for (const sub of userSubs) {
                    try {
                        await webpush.sendNotification(
                            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                            JSON.stringify({ title: r.title || "🍽️ New Me", body, tag, data }),
                            { urgency: "high", TTL: 1800 },
                        );
                        anySucceeded = true;
                        sent++;
                    } catch (err: any) {
                        if (err?.statusCode === 404 || err?.statusCode === 410) {
                            await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                        }
                    }
                }
                if (anySucceeded) {
                    await supabase.from("new_me_reminders").update({ last_sent_date: wallClock.dateStr }).eq("user_id", userId).eq("position", r.position);
                }
            }
        }
    }

    return jsonResponse({ ok: true, usersChecked: subsByUser.size, remindersChecked: checked, sent });
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
