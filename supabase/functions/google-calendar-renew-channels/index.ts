// Supabase Edge Function: google-calendar-renew-channels
//
// Runs daily (see the pg_cron SQL in DEPLOY.md). Google Calendar push channels
// expire after at most ~7 days (Events.watch's `expiration` is entirely up to
// Google - sometimes much shorter) - without renewal, push notifications
// silently stop and the app falls back to relying solely on the 30-min
// reconcile poll. Renews anything expiring within the next 24h, and opens a
// fresh channel for any connected user who somehow has none yet (e.g. the
// initial watch call failed during oauth-callback).
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { serviceClient, getValidAccessToken } from "../_shared/google-calendar.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/google-calendar-webhook`;

const supabase = serviceClient();

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function renewOne(conn: any): Promise<boolean> {
    const accessToken = await getValidAccessToken(supabase, conn);
    // עוצרים קודם את הערוץ הישן (אם קיים) - Google לא עושה את זה אוטומטית,
    // וערוצים ישנים שלא נעצרו ממשיכים "לתפוס מקום" בלי תועלת
    if (conn.channel_id && conn.channel_resource_id) {
        try {
            await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ id: conn.channel_id, resourceId: conn.channel_resource_id }),
            });
        } catch { /* לא קריטי - ממשיכים לפתוח ערוץ חדש בכל מקרה */ }
    }

    const channelId = crypto.randomUUID();
    const channelToken = crypto.randomUUID();
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.google_calendar_id)}/events/watch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: channelId, type: "web_hook", address: WEBHOOK_URL, token: channelToken }),
    });
    if (!res.ok) {
        console.error(`Channel renewal failed for connection ${conn.id}: ${await res.text()}`);
        return false;
    }
    const data = await res.json();
    await supabase.from("google_calendar_connections").update({
        channel_id: channelId,
        channel_resource_id: data.resourceId,
        channel_token: channelToken,
        channel_expiration: data.expiration ? new Date(Number(data.expiration)).toISOString() : null,
        updated_at: new Date().toISOString(),
    }).eq("id", conn.id);
    return true;
}

Deno.serve(async (_req) => {
    const soonThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: connections, error } = await supabase.from("google_calendar_connections")
        .select("*").eq("is_connected", true)
        .or(`channel_expiration.is.null,channel_expiration.lt.${soonThreshold}`);
    if (error) return jsonResponse({ ok: false, error: error.message }, 500);
    if (!connections || !connections.length) return jsonResponse({ ok: true, renewed: 0 });

    let renewed = 0, failed = 0;
    for (const conn of connections) {
        try {
            if (await renewOne(conn)) renewed++; else failed++;
        } catch (err) {
            failed++;
            console.error(`Renewal error for connection ${conn.id}: ${err}`);
        }
    }
    return jsonResponse({ ok: true, checked: connections.length, renewed, failed });
});
