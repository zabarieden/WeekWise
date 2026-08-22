// Supabase Edge Function: google-calendar-renew-channels
//
// Runs daily (see the pg_cron SQL in DEPLOY.md). Google Calendar push channels
// expire after at most ~7 days (Events.watch's `expiration` is entirely up to
// Google - sometimes much shorter) - without renewal, push notifications
// silently stop and the app falls back to relying solely on the 30-min
// reconcile poll. Renews anything expiring within the next 24h, and opens a
// fresh channel for any watch that somehow has none yet (e.g. the initial
// watch call failed during oauth-callback).
//
// Multi-calendar: renewal happens per google_calendar_watches row, not per
// connection - each calendar has its own independent channel.
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { serviceClient, getValidAccessToken, openWatchChannel } from "../_shared/google-calendar.ts";

const supabase = serviceClient();

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function renewOne(watch: any, accessToken: string): Promise<void> {
    // עוצרים קודם את הערוץ הישן (אם קיים) - Google לא עושה את זה אוטומטית,
    // וערוצים ישנים שלא נעצרו ממשיכים "לתפוס מקום" בלי תועלת
    if (watch.channel_id && watch.channel_resource_id) {
        try {
            await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
                method: "POST",
                headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({ id: watch.channel_id, resourceId: watch.channel_resource_id }),
            });
        } catch { /* לא קריטי - ממשיכים לפתוח ערוץ חדש בכל מקרה */ }
    }
    await openWatchChannel(supabase, watch, accessToken);
}

Deno.serve(async (_req) => {
    const soonThreshold = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { data: watches, error } = await supabase.from("google_calendar_watches")
        .select("*, google_calendar_connections!inner(*)")
        .eq("google_calendar_connections.is_connected", true)
        .or(`channel_expiration.is.null,channel_expiration.lt.${soonThreshold}`);
    if (error) return jsonResponse({ ok: false, error: error.message }, 500);
    if (!watches || !watches.length) return jsonResponse({ ok: true, renewed: 0 });

    let renewed = 0, failed = 0;
    // groups per connection so getValidAccessToken only refreshes the token
    // once per connection even if it has several watches due for renewal
    const tokenCache = new Map<string, string>();
    for (const row of watches) {
        try {
            const conn = (row as any).google_calendar_connections;
            let accessToken = tokenCache.get(conn.id);
            if (!accessToken) {
                accessToken = await getValidAccessToken(supabase, conn);
                tokenCache.set(conn.id, accessToken);
            }
            await renewOne(row, accessToken);
            renewed++;
        } catch (err) {
            failed++;
            console.error(`Renewal error for watch ${row.id} (calendar ${row.google_calendar_id}): ${err}`);
        }
    }
    return jsonResponse({ ok: true, checked: watches.length, renewed, failed });
});
