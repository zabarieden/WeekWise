// Supabase Edge Function: send-due-reminders
//
// Runs on a schedule (see the pg_cron SQL in DEPLOY.md) and sends a real Web Push
// notification for every weekly_schedule / calendar_events reminder that is due right
// now, for every user's timezone, so reminders fire even when the app is fully closed.
// Also sends the New Me meal reminders (new_me_reminders - one time per meal).
//
// Every reminder is delivered ONCE, in ONE place (explicit request - before, the same
// reminder popped on the phone, the computer and the iPad, and again after "Done"):
// - reminder_deliveries holds one row per reminder per day. Whoever inserts it first
//   (an open app in front of the user, or this function) is the only one that delivers it.
// - reminder_presence tells us a device has the app open in front of the user right now -
//   then the app shows the reminder itself, and we wait up to PRESENCE_WAIT_MINUTES for it.
// - Otherwise we push to the phone only (push_subscriptions.device_kind = 'mobile'), or to
//   every device if the user turned on user_premium.reminder_all_devices. No phone at all
//   (or the phone can't be reached) - the other devices get it, so nothing is lost.
// - Snooze rounds are taken the same way: a conditional update on next_at, so each round
//   is shown by exactly one place.
// Same late cap as the app (LATE_LIMIT_MINUTES), and weekly_schedule / calendar_events
// last_notified_date are still kept as a second guard.
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

// תזכורת שהתפספסה (למשל כשהפונקציה לא רצה) נשלחת באיחור - עד שעה אחרי תחילת המשימה
const LATE_LIMIT_MINUTES = 60;
// אפליקציה פתוחה מול העיניים מציגה את התזכורת בעצמה - מחכים לה עד 2 דקות, ואז שולחים בכל זאת
const PRESENCE_WAIT_MINUTES = 2;
const SNOOZE_MINUTES = 5;
const DELIVERY_KEY = "user_id,source_type,source_id,source_date";

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
        hour: parseInt(map.hour, 10) % 24,
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

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; timezone: string; device_kind: string | null };

// לאן שולחים: כברירת מחדל רק לטלפון; "גם במחשב ובטאבלט" - לכולם. בלי טלפון בכלל - לכל מה שיש
function reminderTargets(userSubs: Sub[], allDevices: boolean) {
    const phones = userSubs.filter((s) => s.device_kind === "mobile");
    if (allDevices || !phones.length) return { primary: userSubs, fallback: [] as Sub[] };
    return { primary: phones, fallback: userSubs.filter((s) => s.device_kind !== "mobile") };
}

async function handleRequest(): Promise<Response> {
    const now = new Date();

    // כל המנויים הפעילים, מקובצים לפי user_id - כדי לדעת אילו משתמשים בכלל צריך לבדוק
    const { data: subs, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth, timezone, device_kind");
    if (subsError) return jsonResponse({ ok: false, error: subsError.message }, 500);
    if (!subs || !subs.length) return jsonResponse({ ok: true, checked: 0, sent: 0 });

    const subsByUser = new Map<string, Sub[]>();
    for (const s of subs as Sub[]) {
        if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
        subsByUser.get(s.user_id)!.push(s);
    }
    const userIds = [...subsByUser.keys()];

    let sent = 0;
    let checked = 0;

    // שולח ליעדים הראשיים; אם אף אחד מהם לא הגיע (למשל המנוי של הטלפון מת) - לשאר המכשירים
    const pushToUser = async (targets: { primary: Sub[]; fallback: Sub[] }, payload: unknown, options: Record<string, unknown>) => {
        const sendTo = async (list: Sub[]) => {
            let ok = false;
            for (const sub of list) {
                try {
                    // urgency: 'high' - בלי זה FCM/הדפדפן מרשים לעצמם לדחות מסרים "רגילים"
                    // כשהמכשיר ב-Doze/חיסכון סוללה (דווח בפועל כתזכורת שהגיעה באיחור ניכר)
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify(payload),
                        options,
                    );
                    ok = true;
                    sent++;
                } catch (err: any) {
                    // מנוי מת (הדפדפן בוטל/הותקן מחדש) - מסירים אותו כדי לא לנסות שוב לשווא
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                    }
                }
            }
            return ok;
        };
        return (await sendTo(targets.primary)) || (targets.fallback.length ? await sendTo(targets.fallback) : false);
    };

    // ניקיון: נודניקים ישנים (למשל של משתמש/ת בלי מנוי Push), מסירות ישנות ונוכחות שפגה
    await Promise.all([
        supabase.from("reminder_snoozes").delete().lt("next_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("reminder_deliveries").delete().lt("delivered_at", new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("reminder_presence").delete().lt("visible_until", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const [{ data: prefs }, { data: presence }] = await Promise.all([
        supabase.from("user_premium").select("user_id, reminder_all_devices").in("user_id", userIds),
        supabase.from("reminder_presence").select("user_id").in("user_id", userIds).gt("visible_until", now.toISOString()),
    ]);
    const allDevicesUsers = new Set((prefs ?? []).filter((p) => p.reminder_all_devices).map((p) => p.user_id));
    const appOpenUsers = new Set((presence ?? []).map((p) => p.user_id));

    // "תופסים" את התזכורת: רק מי שמכניס ראשון את השורה מוסר אותה (האפליקציה עושה בדיוק אותו דבר).
    // שגיאה (לא "כבר קיים") - שולחים בכל זאת: עדיף מאשר לאבד תזכורת, ו-last_notified_date עדיין שומר מכפילות
    const claimDelivery = async (userId: string, sourceType: string, sourceId: string, sourceDate: string, deviceKind: string) => {
        const { data, error } = await supabase.from("reminder_deliveries").upsert(
            { user_id: userId, source_type: sourceType, source_id: sourceId, source_date: sourceDate, channel: "push", device_kind: deviceKind },
            { onConflict: DELIVERY_KEY, ignoreDuplicates: true },
        ).select("source_id");
        if (error) return true;
        return (data ?? []).length > 0;
    };

    for (const [userId, userSubs] of subsByUser) {
        const timeZone = userSubs[0]?.timezone || "UTC";
        const wallClock = getLocalWallClock(now, timeZone);
        const nowMinutes = wallClock.hour * 60 + wallClock.minute;
        const allDevices = allDevicesUsers.has(userId);
        const targets = reminderTargets(userSubs, allDevices);
        const targetKind = allDevices ? "all" : (targets.primary.some((s) => s.device_kind === "mobile") ? "mobile" : "all");
        const appOpen = appOpenUsers.has(userId);
        const actions = [
            { action: "done", title: "✅" },
            { action: "not_done", title: "⏰" },
        ];

        const { data: dueRows } = await supabase
            .from("weekly_schedule")
            .select("id, task_title, reminder_text, reminder_minutes, time_of_day, last_notified_date")
            .eq("user_id", userId)
            .eq("day_of_week", wallClock.dbDay)
            .gt("reminder_minutes", 0);
        // גם אירועים חד-פעמיים ב"מבט ליומן" (calendar_events), לפי event_date מדויק. גם אירוע שמסונכרן
        // עם גוגל מקבל התראה מכאן: בגוגל הוא נשמר בלי תזכורות (ר' google-calendar-outbox-drain)
        const { data: dueEvents } = await supabase
            .from("calendar_events")
            .select("id, event_title, reminder_text, reminder_minutes, event_time, last_notified_date")
            .eq("user_id", userId)
            .eq("event_date", wallClock.dateStr)
            .gt("reminder_minutes", 0);

        const candidates = [
            ...(dueRows ?? []).map((r) => ({ type: "schedule", table: "weekly_schedule", id: r.id, title: r.task_title, body: r.reminder_text, minutes: r.reminder_minutes, time: r.time_of_day, last: r.last_notified_date })),
            ...(dueEvents ?? []).map((r) => ({ type: "event", table: "calendar_events", id: r.id, title: r.event_title, body: r.reminder_text, minutes: r.reminder_minutes, time: r.event_time, last: r.last_notified_date })),
        ];
        const due = candidates.filter((row) => {
            checked++;
            if (!row.time) return false;
            if (row.last === wallClock.dateStr) return false; // כבר נשלח היום
            const [h, m] = String(row.time).split(":").map((n: string) => parseInt(n, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) return false;
            const taskMinutes = h * 60 + m;
            const triggerMinutes = taskMinutes - row.minutes;
            // אם הפונקציה לא רצה בזמן, עדיף לשלוח באיחור פעם אחת מאשר לפספס - אבל לא על משימה
            // שהתחילה לפני יותר משעה: התראה בשלוש לפנות בוקר על משהו מחצות היא רק רעש
            if (nowMinutes < triggerMinutes || nowMinutes > taskMinutes + LATE_LIMIT_MINUTES) return false;
            // האפליקציה פתוחה מול העיניים - היא תציג את התזכורת בעצמה
            return !(appOpen && nowMinutes - triggerMinutes < PRESENCE_WAIT_MINUTES);
        });
        // מה שכבר נמסר היום (באפליקציה או כאן) או שכבר ענו עליו - לא נוגעים
        let deliveredToday = new Set<string>();
        if (due.length) {
            const { data: todays } = await supabase.from("reminder_deliveries").select("source_type, source_id").eq("user_id", userId).eq("source_date", wallClock.dateStr);
            deliveredToday = new Set((todays ?? []).map((d) => `${d.source_type}:${d.source_id}`));
        }

        for (const row of due) {
            if (deliveredToday.has(`${row.type}:${row.id}`)) continue;
            if (!(await claimDelivery(userId, row.type, row.id, wallClock.dateStr, targetKind))) continue;

            // tag דטרמיניסטי - אותה נוסחה בדיוק כמו reminderNotificationTag ב-app.js (כדי שהאפליקציה
            // תוכל לסגור את ההתראה כשעונים במקום אחר); actions = "בוצע" / "עוד לא" על ההתראה עצמה,
            // ו-userId בתוך data כי אין session בתוך ה-Service Worker (ר' mark-reminder-done)
            const tag = `weekwise-reminder-${row.type}-${row.id}-${wallClock.dateStr}`;
            const data = { sourceType: row.type, sourceId: row.id, sourceDate: wallClock.dateStr, userId };
            const title = `⏰ ${row.title || "NOT10.ai"}`;
            // TTL קצר יחסית (10 דק') - תזכורת שלא הגיעה תוך זמן סביר כבר לא רלוונטית
            const delivered = await pushToUser(targets, { title, body: row.body || "", tag, actions, data }, { urgency: "high", TTL: 600 });
            if (delivered) {
                await supabase.from(row.table).update({ last_notified_date: wallClock.dateStr }).eq("id", row.id);
            }
        }

        // נודניק: "עוד לא" (בהתראה או בפופאפ) נכנס ל-reminder_snoozes - התראה חוזרת כל 5 דקות עד
        // "בוצע" / "הבנתי", עד 6 פעמים אם מתעלמים. אם המשימה כבר סומנה כבוצעה - מפסיקים בשקט
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
            const overdueMs = now.getTime() - new Date(sn.next_at).getTime();
            if (overdueMs > LATE_LIMIT_MINUTES * 60 * 1000) { await removeSnooze(); continue; }
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
            // האפליקציה פתוחה מול העיניים - היא תיקח את הסבב בעצמה
            if (appOpen && overdueMs < PRESENCE_WAIT_MINUTES * 60 * 1000) continue;

            // לוקחים את הסבב: רק אם next_at עדיין הישן (אחרת מכשיר אחר כבר לקח אותו)
            const remaining = (sn.remaining || 1) - 1;
            const { data: won } = await supabase.from("reminder_snoozes")
                .update({ remaining, next_at: new Date(now.getTime() + SNOOZE_MINUTES * 60 * 1000).toISOString() })
                .match(key).eq("next_at", sn.next_at).select("source_id");
            if (!won || !won.length) continue;
            if (remaining <= 0) await removeSnooze();

            const title = `⏰ ${sn.title || "NOT10.ai"}`;
            // אותו tag כמו ההתראה המקורית - מחליף אותה במקום להצטבר, ו-renotify כדי שתצלצל שוב
            const tag = `weekwise-reminder-${sn.source_type}-${sn.source_id}-${sn.source_date}`;
            const data = { sourceType: sn.source_type, sourceId: sn.source_id, sourceDate: sn.source_date, userId, snooze: true, taskTitle: sn.title || "", text: sn.body || "" };
            await pushToUser(targets, { title, body: sn.body || "", tag, actions, data, renotify: true }, { urgency: "high", TTL: 300 });
        }

        // תזכורות ארוחה של New Me: שעה אחת לכל ארוחה (new_me_reminders, הטקסט נכתב מהאפליקציה
        // בשפת המשתמש/ת). לא שולחים אם הארוחה כבר סומנה ✓ היום, ולא שולחים באיחור של יותר
        // משעה וחצי - תזכורת לארוחת בוקר בצהריים היא רק רעש. גם הן - רק לטלפון כברירת מחדל
        const { data: mealRems } = await supabase
            .from("new_me_reminders")
            .select("position, slot, time, title, body, today_body, today_date, last_sent_date")
            .eq("user_id", userId)
            .eq("enabled", true);
        const dueMeals = (mealRems ?? []).filter((r) => {
            if (r.last_sent_date === wallClock.dateStr) return false;
            const [h, m] = String(r.time || "").split(":").map((n: string) => parseInt(n, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) return false;
            const dueAt = h * 60 + m;
            return nowMinutes >= dueAt && nowMinutes - dueAt <= 90;
        });
        if (dueMeals.length) {
            const [{ data: prof }, { data: eatenRows }] = await Promise.all([
                supabase.from("new_me_profile").select("reminders_on").eq("user_id", userId).maybeSingle(),
                supabase.from("new_me_checkins").select("slot").eq("user_id", userId).eq("checkin_date", wallClock.dateStr),
            ]);
            const eaten = new Set((eatenRows ?? []).map((c) => c.slot));
            for (const r of prof?.reminders_on ? dueMeals : []) {
                if (eaten.has(r.slot)) {
                    await supabase.from("new_me_reminders").update({ last_sent_date: wallClock.dateStr }).eq("user_id", userId).eq("position", r.position);
                    continue;
                }
                const body = r.today_date === wallClock.dateStr && r.today_body ? r.today_body : (r.body || "");
                const tag = `weekwise-newme-meal-${r.position}-${wallClock.dateStr}`;
                const delivered = await pushToUser(targets, { title: r.title || "🍽️ New Me", body, tag, data: { open: "newme" } }, { urgency: "high", TTL: 1800 });
                if (delivered) {
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
