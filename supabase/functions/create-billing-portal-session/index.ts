// Supabase Edge Function: create-billing-portal-session
//
// Creates a Stripe Customer Portal session for the logged-in user and returns
// its hosted URL. Backs both "Change Plan" and "Cancel Subscription" in
// Settings - the Portal itself handles plan switching, cancellation timing,
// payment-method updates, and invoice history, so this app doesn't need to
// build any of that itself.
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SITE_URL = Deno.env.get("SITE_URL")!;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

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

        const { data: premiumRow } = await supabase
            .from("user_premium")
            .select("stripe_customer_id")
            .eq("user_id", userId)
            .maybeSingle();

        const customerId = premiumRow?.stripe_customer_id as string | undefined;
        if (!customerId) return jsonResponse({ error: "no_subscription" }, 404);

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${SITE_URL}/index.html`,
        });

        return jsonResponse({ url: session.url });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
