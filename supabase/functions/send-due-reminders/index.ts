// Supabase Edge Function: send-due-reminders
//
// Runs on a schedule (see the pg_cron SQL in DEPLOY.md) and sends a real Web Push
// notification for every weekly_schedule reminder that is due right now, for every
// user's timezone, so reminders fire even when the app/browser tab is fully closed.
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

            // בכוונה בלי חסם עליון (תואם את checkReminders() בצד הלקוח): אם הפונקציה
            // הזו לא רצה בזמן, עדיף לשלוח באיחור פעם אחת מאשר לפספס לגמרי.
            if (nowMinutes < triggerMinutes) continue;

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
            // אירוע מסונכרן עם גוגל כבר מקבל תזכורת-גוגל מקורית תואמת באותו קיזוז
            // בדיוק (ר' reminderBody ב-google-calendar-outbox-drain) - שליחת Push
            // פנימי גם כאן הייתה יוצרת 2 התראות לאותו אירוע בדיוק, אחת מכל מקור.
            // עדיפות לגוגל: אמינה יותר, ועובדת גם בלי מנוי-Push בכלל
            if (row.google_event_id) continue;

            const [h, m] = row.event_time.split(":").map((n: string) => parseInt(n, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) continue;
            const taskMinutes = h * 60 + m;
            const triggerMinutes = taskMinutes - row.reminder_minutes;
            if (nowMinutes < triggerMinutes) continue;

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
    }

    return jsonResponse({ ok: true, usersChecked: subsByUser.size, remindersChecked: checked, sent });
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
