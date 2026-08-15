// Supabase Edge Function: create-checkout-session
//
// Creates a Stripe Checkout Session (subscription mode) for the logged-in user
// and returns its hosted URL, which the client redirects to directly. Runs
// server-side (service role) because it needs to read/write user_premium's
// Stripe columns, which the client no longer has write access to.
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_PRICE_ID_MONTHLY = Deno.env.get("STRIPE_PRICE_ID_MONTHLY")!;
const STRIPE_PRICE_ID_SEMIANNUAL = Deno.env.get("STRIPE_PRICE_ID_SEMIANNUAL")!;
const SITE_URL = Deno.env.get("SITE_URL")!;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
// httpClient מפורש - Stripe SDK ברירת המחדל מסתמך על מודול http של Node,
// שלא קיים בזמן-ריצה של Deno Edge Functions
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
        const userEmail = userData.user.email ?? undefined;

        const body = await req.json().catch(() => ({}));
        const tier = body?.tier;
        if (tier !== "monthly" && tier !== "semiannual") {
            return jsonResponse({ error: "invalid_tier" }, 400);
        }
        const priceId = tier === "monthly" ? STRIPE_PRICE_ID_MONTHLY : STRIPE_PRICE_ID_SEMIANNUAL;

        // משתמשים בלקוח Stripe קיים אם כבר יש (נשמר בפעם הקודמת), אחרת יוצרים
        // אחד חדש ושומרים אותו מיד - כך גם אם המשתמשת נוטשת את ה-Checkout
        // באמצע, ה-customer_id כבר קיים לפעם הבאה
        const { data: premiumRow } = await supabase
            .from("user_premium")
            .select("stripe_customer_id")
            .eq("user_id", userId)
            .maybeSingle();

        let customerId = premiumRow?.stripe_customer_id as string | undefined;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: userEmail,
                metadata: { supabase_user_id: userId },
            });
            customerId = customer.id;
            await supabase
                .from("user_premium")
                .upsert({ user_id: userId, username: userEmail, stripe_customer_id: customerId }, { onConflict: "user_id" });
        }

        const session = await stripe.checkout.sessions.create({
            mode: "subscription",
            customer: customerId,
            line_items: [{ price: priceId, quantity: 1 }],
            success_url: `${SITE_URL}/index.html?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${SITE_URL}/index.html?checkout=cancelled`,
            metadata: { supabase_user_id: userId },
            subscription_data: { metadata: { supabase_user_id: userId } },
        });

        return jsonResponse({ url: session.url });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
