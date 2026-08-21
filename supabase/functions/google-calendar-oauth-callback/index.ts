// Supabase Edge Function: google-calendar-oauth-callback
//
// Google redirects the user's browser here directly after they approve consent -
// there is no Supabase JWT on this request at all, so `state` (written by
// google-calendar-auth-start) is the only thing identifying which user this is
// for. Exchanges the code for tokens, stores the connection, and does the
// INITIAL watch+list synchronously so "Connected" in the UI actually means
// "already syncing," not "will start syncing on the next cron tick."
//
// Deploy with --no-verify-jwt (Google can't send a Supabase JWT) - see DEPLOY.md.

import { serviceClient, pullDeltaForConnection, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } from "../_shared/google-calendar.ts";

const SITE_URL = Deno.env.get("SITE_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-oauth-callback`;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/google-calendar-webhook`;

const supabase = serviceClient();

function redirectToApp(status: "connected" | "error", detail?: string) {
    const url = new URL(`${SITE_URL}/index.html`);
    url.searchParams.set("google_calendar", status);
    if (detail) url.searchParams.set("detail", detail);
    return new Response(null, { status: 302, headers: { Location: url.toString() } });
}

Deno.serve(async (req) => {
    try {
        const url = new URL(req.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const errorParam = url.searchParams.get("error");
        if (errorParam) return redirectToApp("error", errorParam);
        if (!code || !state) return redirectToApp("error", "missing_code_or_state");

        const { data: stateRow } = await supabase.from("google_oauth_state").select("user_id, created_at").eq("state", state).maybeSingle();
        await supabase.from("google_oauth_state").delete().eq("state", state);
        if (!stateRow) return redirectToApp("error", "invalid_or_expired_state");
        if (Date.now() - new Date(stateRow.created_at).getTime() > 10 * 60 * 1000) return redirectToApp("error", "expired_state");
        const userId = stateRow.user_id;

        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                code,
                grant_type: "authorization_code",
                redirect_uri: REDIRECT_URI,
            }),
        });
        if (!tokenRes.ok) return redirectToApp("error", `token_exchange_failed: ${await tokenRes.text()}`);
        const tokens = await tokenRes.json();
        if (!tokens.refresh_token) {
            // קורה אם prompt=consent לא הגיע בפועל (או שהמשתמשת כבר אישרה בעבר
            // בלי לבטל גישה קודם) - בלי refresh_token אין סנכרון-רקע אפשרי בכלל
            return redirectToApp("error", "no_refresh_token_reconnect_needed");
        }
        const tokenExpiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

        const { data: existing } = await supabase.from("google_calendar_connections").select("id").eq("user_id", userId).maybeSingle();
        const { data: userRow } = await supabase.auth.admin.getUserById(userId);
        const username = userRow?.user?.email || null;

        const connectionPayload = {
            user_id: userId,
            username,
            google_calendar_id: "primary",
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_expiry: tokenExpiry,
            granted_scope: tokens.scope || null,
            is_connected: true,
            updated_at: new Date().toISOString(),
        };
        let connId: string;
        if (existing) {
            await supabase.from("google_calendar_connections").update(connectionPayload).eq("id", existing.id);
            connId = existing.id;
        } else {
            const { data: inserted } = await supabase.from("google_calendar_connections").insert(connectionPayload).select("id").single();
            connId = inserted!.id;
        }

        // ערוץ Push ראשוני (Events.watch) - מקבל התראות כשמשהו משתנה בגוגל.
        // channel_token אקראי הוא מנגנון-האימות היחיד של google-calendar-webhook
        // (גוף ה-Push עצמו תמיד ריק, אין חתימה קריפטוגרפית ל-Push notifications
        // רגילים של Calendar) - חייב סוד לפני שמזמינים ערוץ, לא אחרי
        const channelId = crypto.randomUUID();
        const channelToken = crypto.randomUUID();
        const { data: conn } = await supabase.from("google_calendar_connections").select("*").eq("id", connId).single();

        const watchRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events/watch`,
            {
                method: "POST",
                headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ id: channelId, type: "web_hook", address: WEBHOOK_URL, token: channelToken }),
            },
        );
        if (watchRes.ok) {
            const watchData = await watchRes.json();
            await supabase.from("google_calendar_connections").update({
                channel_id: channelId,
                channel_resource_id: watchData.resourceId,
                channel_token: channelToken,
                channel_expiration: watchData.expiration ? new Date(Number(watchData.expiration)).toISOString() : null,
            }).eq("id", connId);
        } else {
            console.error(`Events.watch failed for user ${userId}: ${await watchRes.text()}`);
            // ממשיכים בכל זאת - google-calendar-reconcile (כל 30 דק) ו-
            // google-calendar-renew-channels יתפסו את זה גם בלי Push מיידי
        }

        // משיכה ראשונית סינכרונית - כדי ש"מחובר" יאמר "כבר מסתנכרן" בפועל
        try {
            const { data: freshConn } = await supabase.from("google_calendar_connections").select("*").eq("id", connId).single();
            await pullDeltaForConnection(supabase, freshConn as any);
        } catch (err) {
            console.error(`Initial pull failed for user ${userId}: ${err}`);
        }

        return redirectToApp("connected");
    } catch (err) {
        return redirectToApp("error", String(err));
    }
});
