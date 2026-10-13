// Supabase Edge Function: google-calendar-workouts
//
// The workout plan in Google Calendar (her pick ת14 - "of course!"): every timed workout in
// workout_plan becomes ONE weekly recurring event (RRULE BYDAY = its days) in the user's own
// connected calendar, created / updated / removed from the app.
// - The app is the only one that reminds (reminders.useDefault = false, no overrides), the same
//   rule as every other app event ("once, in one place").
// - Every event carries extendedProperties.private.not10Workout = <workout id>, and its id is kept
//   in workout_plan.google_event_id - the pull from Google (pullDeltaForWatch in _shared) skips
//   these, so a workout never comes back into the app as a calendar event.
// - Only events this function created are ever touched or deleted (by the stored id).
// The titles and descriptions come from the app, already in the user's language (the server has
// no translations); the server checks that every workout belongs to the signed-in user.
//
// Called from the app with the user's JWT (verify_jwt stays on):
//   { action: "sync", timeZone, events: [{ id, summary, description }] }  - create / update / remove
//   { action: "off" }                                                     - remove all workout events

import { serviceClient, getValidAccessToken, GoogleConnection } from "../_shared/google-calendar.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = serviceClient();
const BYDAY = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

// היום (תאריך ויום בשבוע) באזור הזמן של המשתמש/ת
function localToday(timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(new Date());
    const m: Record<string, string> = {};
    for (const p of parts) m[p.type] = p.value;
    return { date: `${m.year}-${m.month}-${m.day}`, dow: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(m.weekday) };
}
function addDays(dateStr: string, n: number) {
    const [y, mo, d] = dateStr.split("-").map(Number);
    const x = new Date(Date.UTC(y, mo - 1, d + n));
    return x.toISOString().slice(0, 10);
}
// "2026-10-13" + "07:30" + 40 דקות → זמן הסיום (גם אם עובר את חצות)
function endOf(dateStr: string, time: string, minutes: number) {
    const [h, mi] = time.split(":").map(Number);
    const total = h * 60 + mi + minutes;
    const dayShift = Math.floor(total / 1440);
    const rest = ((total % 1440) + 1440) % 1440;
    const hh = String(Math.floor(rest / 60)).padStart(2, "0"), mm = String(rest % 60).padStart(2, "0");
    return { date: addDays(dateStr, dayShift), time: `${hh}:${mm}` };
}

type Workout = { id: string; kind: string; days: number[] | null; time: string | null; duration_minutes: number | null; google_event_id: string | null; google_calendar_id: string | null };

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    try {
        const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userId = userData.user.id;

        const body = await req.json().catch(() => ({}));
        const action = body.action === "off" ? "off" : "sync";
        const timeZone = typeof body.timeZone === "string" && body.timeZone ? body.timeZone : "UTC";
        const texts = new Map<string, { summary: string; description: string }>();
        for (const e of Array.isArray(body.events) ? body.events : []) {
            if (e && typeof e.id === "string") texts.set(e.id, { summary: String(e.summary || "").slice(0, 200), description: String(e.description || "").slice(0, 1000) });
        }

        const { data: conn } = await supabase.from("google_calendar_connections").select("*").eq("user_id", userId).eq("is_connected", true).maybeSingle();
        if (!conn) return jsonResponse({ ok: false, error: "not_connected" });
        const accessToken = await getValidAccessToken(supabase, conn as GoogleConnection);
        const defaultCalendar = (conn as GoogleConnection).google_calendar_id || "primary";

        const { data: rows } = await supabase.from("workout_plan").select("id, kind, days, time, duration_minutes, google_event_id, google_calendar_id").eq("user_id", userId);
        const workouts = (rows ?? []) as Workout[];
        const api = (calendarId: string, path = "") => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events${path}`;
        const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

        const removeEvent = async (w: Workout) => {
            if (!w.google_event_id) return;
            const res = await fetch(api(w.google_calendar_id || defaultCalendar, `/${encodeURIComponent(w.google_event_id)}`), { method: "DELETE", headers });
            // 404 / 410 - כבר נמחק בגוגל; גם אז מנקים את הקישור
            if (res.ok || res.status === 404 || res.status === 410) {
                await supabase.from("workout_plan").update({ google_event_id: null, google_calendar_id: null }).eq("id", w.id).eq("user_id", userId);
            }
        };

        let synced = 0, removed = 0;
        const { date: today, dow } = localToday(timeZone);
        for (const w of workouts) {
            const days = (w.days || []).map(Number).filter((d) => d >= 0 && d <= 6);
            const time = String(w.time || "").slice(0, 5);
            const text = texts.get(w.id);
            const eligible = action === "sync" && w.kind !== "rest" && /^\d{2}:\d{2}$/.test(time) && days.length > 0 && !!text;
            if (!eligible) {
                if (w.google_event_id) { await removeEvent(w); removed++; }
                continue;
            }
            // המופע הראשון: היום הקרוב (כולל היום) שהוא אחד מימי האימון
            const firstShift = Math.min(...days.map((d) => (d - dow + 7) % 7));
            const startDate = addDays(today, firstShift);
            const end = endOf(startDate, time, Math.max(5, Number(w.duration_minutes) || 30));
            const event = {
                summary: text!.summary,
                description: text!.description,
                start: { dateTime: `${startDate}T${time}:00`, timeZone },
                end: { dateTime: `${end.date}T${end.time}:00`, timeZone },
                recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${[...new Set(days)].sort().map((d) => BYDAY[d]).join(",")}`],
                reminders: { useDefault: false, overrides: [] },
                extendedProperties: { private: { not10Workout: w.id } },
            };
            let res: Response | null = null;
            if (w.google_event_id) {
                res = await fetch(api(w.google_calendar_id || defaultCalendar, `/${encodeURIComponent(w.google_event_id)}`), { method: "PUT", headers, body: JSON.stringify(event) });
                // נמחק בגוגל בינתיים - יוצרים מחדש
                if (res.status === 404 || res.status === 410) res = null;
            }
            let calendarId = w.google_calendar_id || defaultCalendar;
            if (!res) {
                calendarId = defaultCalendar;
                res = await fetch(api(calendarId), { method: "POST", headers, body: JSON.stringify(event) });
            }
            if (!res.ok) { console.error(`workout ${w.id}: Google ${res.status} ${await res.text()}`); continue; }
            const saved = await res.json();
            if (saved.id !== w.google_event_id || calendarId !== w.google_calendar_id) {
                await supabase.from("workout_plan").update({ google_event_id: saved.id, google_calendar_id: calendarId }).eq("id", w.id).eq("user_id", userId);
            }
            synced++;
        }
        return jsonResponse({ ok: true, synced, removed });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
