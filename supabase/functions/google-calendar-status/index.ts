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
            .select("id, is_connected, created_at")
            .eq("user_id", userData.user.id).maybeSingle();

        if (!data || !data.is_connected) return jsonResponse({ connected: false });

        // last_full_sync_at זז מ-google_calendar_connections ל-per-watch (כל
        // יומן מתעדכן בנפרד, ר' google_calendar_watches) - מדווחים כאן את
        // הכי-עדכני מביניהם, וגם כמה יומנים בסך הכול מסונכרנים
        const { data: watches } = await supabase.from("google_calendar_watches")
            .select("calendar_summary, last_full_sync_at").eq("connection_id", data.id);
        const lastFullSyncAt = (watches || [])
            .map((w) => w.last_full_sync_at)
            .filter(Boolean)
            .sort()
            .pop() || null;

        return jsonResponse({
            connected: true,
            calendarCount: (watches || []).length,
            connectedAt: data.created_at,
            lastFullSyncAt,
        });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
