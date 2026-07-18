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

webpush.setVapidDetails(VAPID_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

            let anySucceeded = false;
            for (const sub of userSubs) {
                try {
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify({ title, body }),
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
    }

    return jsonResponse({ ok: true, usersChecked: subsByUser.size, remindersChecked: checked, sent });
});

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
