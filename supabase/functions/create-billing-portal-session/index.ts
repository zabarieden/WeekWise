// Supabase Edge Function: create-billing-portal-session
//
// Returns the logged-in user's Lemon Squeezy customer-portal URL. Backs both
// "Change Plan" and "Cancel Subscription" in Settings - the portal itself
// handles plan switching, cancellation, and payment-method updates, so this
// app doesn't need to build any of that itself.
//
// Unlike Stripe, Lemon Squeezy has no separate "create a portal session" API
// call - the portal URL is just a field (urls.customer_portal) on the
// subscription object itself, pre-signed and valid for 24h from the moment
// it's fetched. So this function is a straightforward GET + field extraction.
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LEMONSQUEEZY_API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY")!;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userId = userData.user.id;

        // stripe_subscription_id הוא שם עמודה היסטורי - מחזיק היום את מזהה
        // המנוי של Lemon Squeezy (ר' lemonsqueezy-webhook)
        const { data: premiumRow } = await supabase
            .from("user_premium")
            .select("stripe_subscription_id")
            .eq("user_id", userId)
            .maybeSingle();

        const subscriptionId = premiumRow?.stripe_subscription_id as string | undefined;
        if (!subscriptionId) return jsonResponse({ error: "no_subscription" }, 404);

        const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
            headers: {
                "Accept": "application/vnd.api+json",
                "Authorization": `Bearer ${LEMONSQUEEZY_API_KEY}`,
            },
        });
        if (!response.ok) {
            const detail = await response.text();
            return jsonResponse({ error: "lemonsqueezy_error", detail }, 502);
        }
        const result = await response.json();
        const portalUrl = result?.data?.attributes?.urls?.customer_portal;
        if (!portalUrl) return jsonResponse({ error: "no_portal_url" }, 502);

        return jsonResponse({ url: portalUrl });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
