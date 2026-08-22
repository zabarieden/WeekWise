// Supabase Edge Function: google-calendar-reconcile
//
// Runs on a schedule (see the pg_cron SQL in DEPLOY.md) and pulls deltas for every
// connected user, regardless of whether a webhook already fired - Google's own
// guidance is not to rely on push notifications alone (they're "at least once but
// not guaranteed"), so this is the safety net. Same shape as
// send-due-reminders (loop every connection, best-effort per-connection, never let
// one failure stop the rest).
//
// pullDeltaForConnection() re-discovers the user's calendar list on every call
// (see discoverCalendarWatches in _shared) - so this is also how a calendar
// added to someone's Google account *after* they first connected gets picked
// up automatically, without needing to disconnect/reconnect.
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { serviceClient, pullDeltaForConnection } from "../_shared/google-calendar.ts";

const supabase = serviceClient();

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

Deno.serve(async (_req) => {
    const { data: connections, error } = await supabase.from("google_calendar_connections").select("*").eq("is_connected", true);
    if (error) return jsonResponse({ ok: false, error: error.message }, 500);
    if (!connections || !connections.length) return jsonResponse({ ok: true, connections: 0 });

    let succeeded = 0, failed = 0, totalApplied = 0, totalCalendars = 0;
    for (const conn of connections) {
        try {
            const { applied, calendars } = await pullDeltaForConnection(supabase, conn as any);
            succeeded++;
            totalApplied += applied;
            totalCalendars += calendars;
        } catch (err) {
            failed++;
            console.error(`Reconcile failed for connection ${conn.id} (user ${conn.user_id}): ${err}`);
        }
    }
    return jsonResponse({ ok: true, connections: connections.length, succeeded, failed, totalApplied, totalCalendars });
});
