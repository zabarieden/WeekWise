// Supabase Edge Function: google-calendar-auth-start
//
// First step of the Google Calendar connect flow. Validates the logged-in user,
// writes a short-lived nonce (google_oauth_state) so the callback (which Google
// redirects to with no Supabase JWT at all) can tell which user this is for, and
// returns Google's consent-screen URL for the client to redirect to.
//
// access_type=offline + prompt=consent are both required to reliably get a
// refresh_token back - without prompt=consent, Google silently omits it on any
// consent after the very first one (the exact failure mode a "reconnect" would hit).
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { serviceClient, GOOGLE_CLIENT_ID } from "../_shared/google-calendar.ts";

const SITE_URL = Deno.env.get("SITE_URL")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = serviceClient();

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
}

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/google-calendar-oauth-callback`;

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);

        const state = crypto.randomUUID();
        await supabase.from("google_oauth_state").insert({ state, user_id: userData.user.id });
        // ניקוי נונסים ישנים (מעל 10 דק') תוך כדי - בלי job נפרד רק בשביל זה
        await supabase.from("google_oauth_state").delete().lt("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString());

        const params = new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: "code",
            scope: "https://www.googleapis.com/auth/calendar",
            access_type: "offline",
            prompt: "consent",
            state,
        });
        return jsonResponse({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
