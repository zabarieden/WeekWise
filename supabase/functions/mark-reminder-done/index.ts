// Supabase Edge Function: mark-reminder-done
//
// Called from sw.js when the user acts on a push/system notification:
//   action "done" (✅ button)  - marks the task done and stops any snooze;
//   action "snooze" (⏰ button) - another notification in 5 minutes (reminder_snoozes,
//                                 sent by send-due-reminders, repeats up to 6 times);
//   action "dismiss"           - notification tapped or swiped away: stop snoozing.
// Every answer is also written to reminder_deliveries, so the reminder closes on every
// other device too (an open app checks it - ר' syncRemindersAnsweredElsewhere ב-app.js).
// (Not the in-app popup -
// that one already calls toggleScheduleCompletion/toggleEventOccurrenceCompletion
// client-side via a live session). A Service Worker has no Supabase session/JWT
// available (push can fire with the browser fully closed), so this is called
// with no auth header at all - --no-verify-jwt, trust comes from sourceId being
// an unguessable UUID embedded in a push payload that only this app's own
// VAPID-signed server could have sent to that specific subscriber in the first
// place (same trust model as the rest of this push pipeline). The owner and the date
// are taken from the row itself, not from the request.
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

// השורה עצמה: למי היא שייכת, הטקסט, ותאריך האירוע (במשימה קבועה התאריך מגיע מההתראה)
async function loadSource(sourceType: string, sourceId: string) {
    if (sourceType === "event") {
        const { data } = await supabase.from("calendar_events").select("user_id, event_title, reminder_text, event_date").eq("id", sourceId).maybeSingle();
        return data ? { owner: data.user_id as string, title: data.event_title || "", body: data.reminder_text || "", date: data.event_date as string | null } : null;
    }
    const { data } = await supabase.from("weekly_schedule").select("user_id, task_title, reminder_text").eq("id", sourceId).maybeSingle();
    return data ? { owner: data.user_id as string, title: data.task_title || "", body: data.reminder_text || "", date: null as string | null } : null;
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    try {
        const { sourceType, sourceId, sourceDate, userId, action = "done" } = await req.json();
        if (!sourceType || !sourceId) return jsonResponse({ error: "missing_fields" }, 400);
        if (sourceType !== "event" && sourceType !== "schedule") return jsonResponse({ error: "unknown_source_type" }, 400);

        const src = await loadSource(sourceType, sourceId);
        const date: string | null = (src && src.date) || sourceDate || null;

        // התשובה נרשמת בשורת המסירה - כל מכשיר אחר סוגר את התזכורת לפי זה ולא מציג אותה שוב
        const recordAnswer = async (kind: "done" | "dismiss" | "snooze") => {
            if (!src || !date) return;
            await supabase.from("reminder_deliveries").upsert({
                user_id: src.owner, source_type: sourceType, source_id: sourceId, source_date: date,
                ack_kind: kind, acked_at: kind === "snooze" ? null : new Date().toISOString(),
            }, { onConflict: "user_id,source_type,source_id,source_date" });
        };

        // נודניק: "⏰ עוד לא" על ההתראה = עוד התראה בעוד 5 דקות (send-due-reminders שולח, וחוזר
        // עד 6 פעמים או עד "בוצע" / "הבנתי"). הטקסט נלקח מהשורה עצמה, לא מהבקשה, ובודקים
        // שהשורה באמת שייכת ל-userId
        if (action === "snooze") {
            if (!userId) return jsonResponse({ error: "missing_fields" }, 400);
            if (!src || src.owner !== userId || !date) return jsonResponse({ error: "not_found" }, 404);
            const { error } = await supabase.from("reminder_snoozes").upsert({
                user_id: userId, source_type: sourceType, source_id: sourceId, source_date: date,
                title: src.title.slice(0, 200), body: src.body.slice(0, 500),
                next_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(), remaining: 6,
            }, { onConflict: "user_id,source_type,source_id,source_date" });
            if (error) return jsonResponse({ error: error.message }, 500);
            await recordAnswer("snooze");
            return jsonResponse({ ok: true, snoozed: true });
        }

        // "הבנתי" / סגירת ההתראה / לחיצה עליה = לא להזכיר שוב, בשום מכשיר
        const clearSnoozes = async () => {
            let q = supabase.from("reminder_snoozes").delete().eq("source_type", sourceType).eq("source_id", sourceId);
            if (sourceDate) q = q.eq("source_date", sourceDate);
            await q;
        };
        if (action === "dismiss") {
            await Promise.all([clearSnoozes(), recordAnswer("dismiss")]);
            return jsonResponse({ ok: true, dismissed: true });
        }

        await Promise.all([clearSnoozes(), recordAnswer("done")]);
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
