// Milestone 2: pushes one-time (non-recurring) calendar_events changes made in
// NOT10.ai back to Google Calendar. Drains calendar_sync_outbox, populated by a
// DB trigger on calendar_events (see the migration in this function's DEPLOY.md).
//
// Runs on a cron tick (every 1-2 min), not per-request - so it always fetches
// current row state itself rather than trusting any snapshot in the outbox row.
// That also gives free de-duplication: several queued 'update' rows for the same
// event collapse into a single Events.update call using the latest state.

import { serviceClient, getValidAccessToken, GoogleConnection } from "../_shared/google-calendar.ts";

const MAX_ATTEMPTS = 10;

function pad(n: number): string { return String(n).padStart(2, "0"); }

function addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// שעה אחת ברירת מחדל (הטבלה לא שומרת משך/שעת-סיום בכלל) - חישוב "ידני" על
// המספרים הגולמיים (לא new Date בפועל עם timeZone), כי אנחנו רק זזים קדימה
// על שעון-קיר נקי בלי שום המרת אזור-זמן אמיתית
function addHour(dateStr: string, timeStr: string): { date: string; time: string } {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = timeStr.split(":").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
    dt.setUTCHours(dt.getUTCHours() + 1);
    return {
        date: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
        time: `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`,
    };
}

function buildEventBody(row: any, timeZone: string) {
    const body: any = { summary: row.event_title || "(No title)" };
    if (row.event_time) {
        const end = addHour(row.event_date, row.event_time);
        body.start = { dateTime: `${row.event_date}T${row.event_time}:00`, timeZone };
        body.end = { dateTime: `${end.date}T${end.time}:00`, timeZone };
    } else {
        body.start = { date: row.event_date };
        body.end = { date: addDays(row.event_date, 1) };
    }
    // reminder_minutes null/undefined -> useDefault (Google's own default reminders);
    // אחרת override מדויק כדי שהתראת-גוגל תתריע באותו קיזוז בדיוק כמו שהוגדר
    // ב-NOT10.ai - זה בפועל "מתקן" למשתמשת מחוברת את בעיית ההתראות הפנימיות
    // השבורות, כי התראת-גוגל אמינה ועובדת גם כשהפנימית לא
    if (row.reminder_minutes === null || row.reminder_minutes === undefined) {
        body.reminders = { useDefault: true };
    } else {
        body.reminders = { useDefault: false, overrides: [{ method: "popup", minutes: row.reminder_minutes }] };
    }
    return body;
}

async function getCalendarTimeZone(accessToken: string, calendarId: string): Promise<string> {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "UTC";
    const data = await res.json();
    return data.timeZone || "UTC";
}

Deno.serve(async () => {
    const supabase = serviceClient();

    const { data: pending, error: pendingErr } = await supabase
        .from("calendar_sync_outbox")
        .select("id, calendar_event_id, user_id, action, google_event_id, attempts")
        .is("processed_at", null)
        .order("created_at", { ascending: true })
        .limit(200);
    if (pendingErr) return new Response(JSON.stringify({ error: pendingErr.message }), { status: 500 });
    if (!pending || pending.length === 0) return new Response(JSON.stringify({ processed: 0 }), { status: 200 });

    const byUser = new Map<string, typeof pending>();
    for (const row of pending) {
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
        byUser.get(row.user_id)!.push(row);
    }

    let processedCount = 0;
    const nowIso = () => new Date().toISOString();

    for (const [userId, rows] of byUser) {
        const { data: conn } = await supabase.from("google_calendar_connections")
            .select("*").eq("user_id", userId).eq("is_connected", true).maybeSingle();

        if (!conn) {
            // אין חיבור פעיל - לא נשאיר את זה תקוע לנצח בתור, מסמנים כמעובד עם
            // שגיאה מוסברת. אם המשתמשת תתחבר מחדש בעתיד, עריכות חדשות יתווספו
            // לתור מחדש ויידחפו נורמלית - אין צורך "לחכות" לחיבור ישן
            const ids = rows.map((r) => r.id);
            await supabase.from("calendar_sync_outbox")
                .update({ processed_at: nowIso(), last_error: "no active google connection" })
                .in("id", ids);
            continue;
        }

        let accessToken: string;
        try {
            accessToken = await getValidAccessToken(supabase, conn as GoogleConnection);
        } catch (e) {
            const ids = rows.map((r) => r.id);
            await supabase.from("calendar_sync_outbox")
                .update({ attempts: 999, last_error: `token refresh failed: ${e}` })
                .in("id", ids);
            continue;
        }

        const timeZone = await getCalendarTimeZone(accessToken, conn.google_calendar_id);

        const deletes = rows.filter((r) => r.action === "delete");
        const upserts = rows.filter((r) => r.action !== "delete");
        const upsertEventIds = [...new Set(upserts.map((r) => r.calendar_event_id))];

        // מחיקות - כל שורה בנפרד, ה-google_event_id כבר נשמר בתור (השורה
        // המקומית עצמה כבר נמחקה, אין ממה עוד לקרוא)
        for (const delRow of deletes) {
            try {
                if (delRow.google_event_id) {
                    const res = await fetch(
                        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.google_calendar_id)}/events/${encodeURIComponent(delRow.google_event_id)}`,
                        { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } },
                    );
                    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`delete failed: ${res.status} ${await res.text()}`);
                }
                await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).eq("id", delRow.id);
                processedCount++;
            } catch (e) {
                const attempts = (delRow.attempts || 0) + 1;
                await supabase.from("calendar_sync_outbox").update({
                    attempts,
                    last_error: String(e),
                    processed_at: attempts >= MAX_ATTEMPTS ? nowIso() : null,
                }).eq("id", delRow.id);
            }
        }

        // הוספות/עדכונים - פר calendar_event_id ייחודי (לא פר שורת-תור), כדי
        // שכמה עריכות שהצטברו על אותו אירוע יתמזגו לקריאת-גוגל אחת עם המצב
        // העדכני ביותר בפועל, במקום לשלוח את אותו אירוע כמה פעמים ברצף
        for (const eventId of upsertEventIds) {
            const rowsForEvent = upserts.filter((r) => r.calendar_event_id === eventId);
            const rowIds = rowsForEvent.map((r) => r.id);
            try {
                const { data: current } = await supabase.from("calendar_events")
                    .select("id, event_title, event_date, event_time, reminder_minutes, google_event_id, source, recurrence_group_id")
                    .eq("id", eventId).maybeSingle();

                if (!current || current.source !== "calendar" || current.recurrence_group_id) {
                    // האירוע נמחק/השתנה מאז שנכנס לתור, או שהוא כבר לא בתחום
                    // מיילסטון 2 (חוזר) - שום דבר לעשות, פשוט מסמנים כמעובד
                    await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).in("id", rowIds);
                    processedCount += rowIds.length;
                    continue;
                }

                const body = buildEventBody(current, timeZone);
                let res: Response;
                if (current.google_event_id) {
                    res = await fetch(
                        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.google_calendar_id)}/events/${encodeURIComponent(current.google_event_id)}`,
                        { method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
                    );
                } else {
                    res = await fetch(
                        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.google_calendar_id)}/events`,
                        { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) },
                    );
                }
                if (!res.ok) throw new Error(`upsert failed: ${res.status} ${await res.text()}`);
                const ev = await res.json();

                // כתיבה זו נוגעת ב-google_synced_at באותו statement - הטריגר על
                // calendar_events בודק בדיוק את זה כדי לא להכניס את השורה הזו
                // שוב לתור (מניעת-לולאה, ר' הערת הטריגר במיגרציה)
                await supabase.from("calendar_events").update({
                    google_event_id: ev.id, google_etag: ev.etag || null, google_updated: ev.updated || null,
                    google_synced_at: nowIso(),
                }).eq("id", eventId);

                await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).in("id", rowIds);
                processedCount += rowIds.length;
            } catch (e) {
                const attempts = Math.max(...rowsForEvent.map((r) => r.attempts || 0)) + 1;
                await supabase.from("calendar_sync_outbox").update({
                    attempts,
                    last_error: String(e),
                    processed_at: attempts >= MAX_ATTEMPTS ? nowIso() : null,
                }).in("id", rowIds);
            }
        }
    }

    return new Response(JSON.stringify({ processed: processedCount }), { status: 200, headers: { "Content-Type": "application/json" } });
});
