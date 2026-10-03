// Supabase Edge Function: mark-reminder-done
//
// Called from sw.js when the user acts on a push/system notification:
//   action "done" (✅ button)  - marks the task done and stops any snooze;
//   action "snooze" (⏰ button) - another notification in 5 minutes (reminder_snoozes,
//                                 sent by send-due-reminders, repeats up to 6 times);
//   action "dismiss"           - notification tapped or swiped away: stop snoozing.
// (Not the in-app popup -
// that one already calls toggleScheduleCompletion/toggleEventOccurrenceCompletion
// client-side via a live session). A Service Worker has no Supabase session/JWT
// available (push can fire with the browser fully closed), so this is called
// with no auth header at all - --no-verify-jwt, trust comes from sourceId being
// an unguessable UUID embedded in a push payload that only this app's own
// VAPID-signed server could have sent to that specific subscriber in the first
// place (same trust model as the rest of this push pipeline).
//
// Deploy with --no-verify-jwt - see DEPLOY.md.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    try {
        const { sourceType, sourceId, sourceDate, userId, action = "done" } = await req.json();
        if (!sourceType || !sourceId) return jsonResponse({ error: "missing_fields" }, 400);
        if (sourceType !== "event" && sourceType !== "schedule") return jsonResponse({ error: "unknown_source_type" }, 400);

        // נודניק: "⏰ עוד לא" על ההתראה = עוד התראה בעוד 5 דקות (send-due-reminders שולח, וחוזר
        // עד 6 פעמים או עד "בוצע" / "הבנתי"). הטקסט נלקח מהשורה עצמה, לא מהבקשה, ובודקים
        // שהשורה באמת שייכת ל-userId
        if (action === "snooze") {
            if (!userId) return jsonResponse({ error: "missing_fields" }, 400);
            let title = "", body = "", date = sourceDate;
            if (sourceType === "event") {
                const { data: ev } = await supabase.from("calendar_events").select("user_id, event_title, reminder_text, event_date").eq("id", sourceId).maybeSingle();
                if (!ev || ev.user_id !== userId) return jsonResponse({ error: "not_found" }, 404);
                title = ev.event_title || ""; body = ev.reminder_text || ""; date = ev.event_date;
            } else {
                const { data: s } = await supabase.from("weekly_schedule").select("user_id, task_title, reminder_text").eq("id", sourceId).maybeSingle();
                if (!s || s.user_id !== userId || !date) return jsonResponse({ error: "not_found" }, 404);
                title = s.task_title || ""; body = s.reminder_text || "";
            }
            const { error } = await supabase.from("reminder_snoozes").upsert({
                user_id: userId, source_type: sourceType, source_id: sourceId, source_date: date,
                title: title.slice(0, 200), body: body.slice(0, 500),
                next_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), remaining: 6,
            }, { onConflict: "user_id,source_type,source_id,source_date" });
            if (error) return jsonResponse({ error: error.message }, 500);
            return jsonResponse({ ok: true, snoozed: true });
        }

        // "הבנתי" / סגירת ההתראה / לחיצה עליה = לא להזכיר שוב
        const clearSnoozes = async () => {
            let q = supabase.from("reminder_snoozes").delete().eq("source_type", sourceType).eq("source_id", sourceId);
            if (sourceDate) q = q.eq("source_date", sourceDate);
            await q;
        };
        if (action === "dismiss") {
            await clearSnoozes();
            return jsonResponse({ ok: true, dismissed: true });
        }

        await clearSnoozes();
        if (sourceType === "event") {
            const { error } = await supabase.from("calendar_events").update({ is_completed: true }).eq("id", sourceId);
            if (error) return jsonResponse({ error: error.message }, 500);
        } else if (sourceType === "schedule") {
            if (!sourceDate || !userId) return jsonResponse({ error: "missing_fields" }, 400);
            // אותו upsert בדיוק כמו toggleScheduleCompletion בצד הלקוח (מפתח על
            // schedule_id+completion_date) - user_id חייב כאן כי העמודה NOT NULL,
            // ואין session לקרוא אותו ממנו כמו שהלקוח החי עושה
            const { error } = await supabase.from("schedule_completions").upsert(
                { user_id: userId, schedule_id: sourceId, completion_date: sourceDate },
                { onConflict: "schedule_id,completion_date" },
            );
            if (error) return jsonResponse({ error: error.message }, 500);
        }

        return jsonResponse({ ok: true });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
