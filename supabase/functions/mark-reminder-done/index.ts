// Supabase Edge Function: mark-reminder-done
//
// Called from sw.js's notificationclick handler when the user taps the "Done"
// action button directly on a push/system notification (not the in-app popup -
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
        const { sourceType, sourceId, sourceDate, userId } = await req.json();
        if (!sourceType || !sourceId) return jsonResponse({ error: "missing_fields" }, 400);

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
        } else {
            return jsonResponse({ error: "unknown_source_type" }, 400);
        }

        return jsonResponse({ ok: true });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
