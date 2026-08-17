// Supabase Edge Function: create-checkout-session
//
// Creates a Lemon Squeezy Checkout for the logged-in user and returns its
// hosted URL, which the client redirects to directly. Runs server-side
// (service role) because it needs to read/write user_premium's billing
// columns, which the client no longer has write access to.
//
// Uses Lemon Squeezy (not Stripe) - Stripe does not support direct merchant
// accounts for businesses based in Israel, so this app uses Lemon Squeezy
// (a "Merchant of Record" that handles global tax/VAT compliance) instead.
// The DB columns are still named stripe_customer_id/stripe_subscription_id
// (added before this switch) - they now hold the Lemon Squeezy equivalents;
// renamed only in comments here, not in the schema, to avoid a second
// migration round-trip.
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LEMONSQUEEZY_API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY")!;
const LEMONSQUEEZY_STORE_ID = Deno.env.get("LEMONSQUEEZY_STORE_ID")!;
const LEMONSQUEEZY_VARIANT_ID_MONTHLY = Deno.env.get("LEMONSQUEEZY_VARIANT_ID_MONTHLY")!;
const LEMONSQUEEZY_VARIANT_ID_SEMIANNUAL = Deno.env.get("LEMONSQUEEZY_VARIANT_ID_SEMIANNUAL")!;
const SITE_URL = Deno.env.get("SITE_URL")!;

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
        const userEmail = userData.user.email ?? undefined;

        const body = await req.json().catch(() => ({}));
        const tier = body?.tier;
        if (tier !== "monthly" && tier !== "semiannual") {
            return jsonResponse({ error: "invalid_tier" }, 400);
        }
        const variantId = tier === "monthly" ? LEMONSQUEEZY_VARIANT_ID_MONTHLY : LEMONSQUEEZY_VARIANT_ID_SEMIANNUAL;

        // Lemon Squeezy Checkouts API - JSON:API shape. custom_data.supabase_user_id
        // is how the webhook resolves which user_premium row to update later
        // (see meta.custom_data in lemonsqueezy-webhook/index.ts)
        const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
            method: "POST",
            headers: {
                "Accept": "application/vnd.api+json",
                "Content-Type": "application/vnd.api+json",
                "Authorization": `Bearer ${LEMONSQUEEZY_API_KEY}`,
            },
            body: JSON.stringify({
                data: {
                    type: "checkouts",
                    attributes: {
                        checkout_data: {
                            email: userEmail,
                            custom: { supabase_user_id: userId },
                        },
                        product_options: {
                            redirect_url: `${SITE_URL}/index.html?checkout=success`,
                        },
                    },
                    relationships: {
                        store: { data: { type: "stores", id: LEMONSQUEEZY_STORE_ID } },
                        variant: { data: { type: "variants", id: variantId } },
                    },
                },
            }),
        });

        if (!response.ok) {
            const detail = await response.text();
            return jsonResponse({ error: "lemonsqueezy_error", detail }, 502);
        }
        const result = await response.json();
        const checkoutUrl = result?.data?.attributes?.url;
        if (!checkoutUrl) return jsonResponse({ error: "no_checkout_url" }, 502);

        return jsonResponse({ url: checkoutUrl });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
