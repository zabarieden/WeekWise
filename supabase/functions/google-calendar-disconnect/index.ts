// Supabase Edge Function: google-calendar-disconnect
//
// Revokes the stored Google token, stops the push channel, and deletes the
// connection row. Does NOT delete previously-imported calendar_events rows -
// disconnecting stops future sync, it isn't a data-wipe.
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

        const { data: conn } = await supabase.from("google_calendar_connections").select("*").eq("user_id", userData.user.id).maybeSingle();
        if (!conn) return jsonResponse({ ok: true, wasConnected: false });

        try {
            await fetch("https://oauth2.googleapis.com/revoke", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ token: conn.refresh_token }),
            });
        } catch (err) {
            console.error(`Token revoke failed (continuing with local cleanup): ${err}`);
        }

        // עוצרים את כל ערוצי ה-Push של כל היומנים (לא רק אחד - כל יומן יש לו
        // ערוץ נפרד, ר' google_calendar_watches)
        const { data: watches } = await supabase.from("google_calendar_watches").select("channel_id, channel_resource_id").eq("connection_id", conn.id);
        for (const watch of watches || []) {
            if (!watch.channel_id || !watch.channel_resource_id) continue;
            try {
                await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${conn.access_token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ id: watch.channel_id, resourceId: watch.channel_resource_id }),
                });
            } catch (err) {
                console.error(`Channel stop failed (continuing with local cleanup): ${err}`);
            }
        }

        // מחיקת החיבור מוחקת גם את כל שורות ה-watches שלו (on delete cascade)
        await supabase.from("google_calendar_connections").delete().eq("id", conn.id);
        return jsonResponse({ ok: true, wasConnected: true });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
