// Supabase Edge Function: google-calendar-status
//
// Lets the settings UI show connection state without ever exposing tokens to the
// client - google_calendar_connections has no client-facing RLS policies at all
// (default-deny), so this service-role read is the only way the browser learns
// whether the user is connected.
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { serviceClient } from "../_shared/google-calendar.ts";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = serviceClient();

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);

        const { data } = await supabase.from("google_calendar_connections")
            .select("is_connected, google_calendar_id, created_at, last_full_sync_at")
            .eq("user_id", userData.user.id).maybeSingle();

        if (!data || !data.is_connected) return jsonResponse({ connected: false });
        return jsonResponse({
            connected: true,
            googleCalendarId: data.google_calendar_id,
            connectedAt: data.created_at,
            lastFullSyncAt: data.last_full_sync_at,
        });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
