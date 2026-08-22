// Supabase Edge Function: google-calendar-webhook
//
// Google POSTs here whenever something changes in a watched calendar. The body
// is always empty by design - Calendar push notifications carry no payload, you
// always have to go re-fetch via the delta-pull routine. The ONLY authenticity
// check available is the X-Goog-Channel-Token header matching the random secret
// we handed Google when opening the channel (google-calendar-oauth-callback /
// google-calendar-renew-channels) - without this check, anyone who guesses/finds
// the webhook URL could trigger a sync for an arbitrary connection.
//
// Multi-calendar: each calendar has its own channel (see google_calendar_watches),
// so the incoming channel_id/channel_token identify a specific WATCH, not just a
// connection - only that one calendar is pulled, not the user's whole account.
//
// No-ops on X-Goog-Resource-State: sync (Google's initial channel-confirmation
// ping sent right after Events.watch, before any real change has happened).
//
// Deploy with --no-verify-jwt (Google can't send a Supabase JWT) - see DEPLOY.md.

import { serviceClient, getValidAccessToken, pullDeltaForWatch } from "../_shared/google-calendar.ts";

const supabase = serviceClient();

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response(null, { status: 405 });

    try {
        const channelId = req.headers.get("X-Goog-Channel-ID");
        const channelToken = req.headers.get("X-Goog-Channel-Token");
        const resourceState = req.headers.get("X-Goog-Resource-State");
        if (!channelId || !channelToken) return new Response(null, { status: 400 });

        const { data: watch } = await supabase.from("google_calendar_watches")
            .select("*").eq("channel_id", channelId).maybeSingle();
        if (!watch || watch.channel_token !== channelToken) {
            // לא תואם - לא מגוגל האמיתית, או ערוץ ישן שכבר הוחלף. לא חושפים
            // איזה מהשניים כדי לא לתת מידע למי שמנסה לנחש
            return new Response(null, { status: 404 });
        }
        if (resourceState === "sync") return new Response(null, { status: 200 });

        const { data: conn } = await supabase.from("google_calendar_connections")
            .select("*").eq("id", watch.connection_id).eq("is_connected", true).maybeSingle();
        if (!conn) return new Response(null, { status: 200 });

        const accessToken = await getValidAccessToken(supabase, conn as any);
        await pullDeltaForWatch(supabase, conn as any, watch as any, accessToken);
        return new Response(null, { status: 200 });
    } catch (err) {
        console.error(`google-calendar-webhook error: ${err}`);
        // 200 גם בשגיאה - Google עלולה לכבות/להאט ערוץ ש"נכשל" חוזר, ו-
        // google-calendar-reconcile ממילא ירוץ בכל מקרה כרשת-ביטחון
        return new Response(null, { status: 200 });
    }
});
