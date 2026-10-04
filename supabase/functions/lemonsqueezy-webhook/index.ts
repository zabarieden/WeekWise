// Supabase Edge Function: lemonsqueezy-webhook
//
// Receives subscription lifecycle events from Lemon Squeezy and updates
// user_premium accordingly. This is THE function that turns a real payment
// into is_premium=true - no other part of the app does this. Deployed with
// --no-verify-jwt since Lemon Squeezy never sends a Supabase auth JWT (see
// DEPLOY.md).
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LEMONSQUEEZY_WEBHOOK_SECRET = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET")!;
const LEMONSQUEEZY_VARIANT_ID_MONTHLY = Deno.env.get("LEMONSQUEEZY_VARIANT_ID_MONTHLY")!;
const LEMONSQUEEZY_VARIANT_ID_SEMIANNUAL = Deno.env.get("LEMONSQUEEZY_VARIANT_ID_SEMIANNUAL")!;
const LEMONSQUEEZY_VARIANT_ID_NEW_ME = Deno.env.get("LEMONSQUEEZY_VARIANT_ID_NEW_ME") || "";
// New Me has two plans: lifetime (one-time order, LEMONSQUEEZY_VARIANT_ID_NEW_ME) and
// monthly (a subscription, this variant). Neither ever touches is_premium/tier.
const LEMONSQUEEZY_VARIANT_ID_NEW_ME_MONTHLY = Deno.env.get("LEMONSQUEEZY_VARIANT_ID_NEW_ME_MONTHLY") || "";
const LEMONSQUEEZY_API_KEY = Deno.env.get("LEMONSQUEEZY_API_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Same rule as Premium below: "cancelled" keeps access until the paid period ends
// ("expired"), past_due gets the retry grace period
const ACCESS_STATUSES = ["active", "on_trial", "past_due", "cancelled"];

function isNewMeMonthly(variantId: string, productName: string): boolean {
    if (LEMONSQUEEZY_VARIANT_ID_NEW_ME_MONTHLY && variantId === LEMONSQUEEZY_VARIANT_ID_NEW_ME_MONTHLY) return true;
    // fallback for the first minutes after a new product is created, before the secret is set
    return !LEMONSQUEEZY_VARIANT_ID_NEW_ME_MONTHLY && /new\s*me/i.test(productName || "");
}

async function newMeRow(userId: string) {
    const { data } = await supabase.from("user_premium")
        .select("new_me_plan, new_me_subscription_id, new_me_subscription_status")
        .eq("user_id", userId).maybeSingle();
    return data || {};
}

// Buying lifetime while a monthly New Me subscription runs: cancel the monthly so it isn't
// charged again (Lemon Squeezy keeps it until the end of the paid period, then "expired")
async function cancelNewMeMonthly(subscriptionId: string) {
    if (!LEMONSQUEEZY_API_KEY || !subscriptionId) return;
    try {
        await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, {
            method: "DELETE",
            headers: { "Accept": "application/vnd.api+json", "Authorization": `Bearer ${LEMONSQUEEZY_API_KEY}` },
        });
    } catch { /* best effort - the user can still cancel from the portal */ }
}

// Lemon Squeezy signs the raw request body with the webhook signing secret
// (HMAC-SHA256, hex digest) and sends it in X-Signature. Must hash the RAW
// body (before JSON.parse), and compare in constant time to avoid a timing
// side-channel on the comparison itself.
async function verifySignature(rawBody: string, signature: string): Promise<boolean> {
    if (!signature) return false;
    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(LEMONSQUEEZY_WEBHOOK_SECRET),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hex = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (hex.length !== signature.length) return false;
    let diff = 0;
    for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
}

function tierFromVariantId(variantId: string): string | null {
    if (variantId === LEMONSQUEEZY_VARIANT_ID_MONTHLY) return "monthly";
    if (variantId === LEMONSQUEEZY_VARIANT_ID_SEMIANNUAL) return "semiannual";
    return null;
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return new Response("method_not_allowed", { status: 405 });

    const rawBody = await req.text();
    const signature = req.headers.get("X-Signature") || "";
    if (!(await verifySignature(rawBody, signature))) {
        return new Response(JSON.stringify({ error: "invalid_signature" }), { status: 401 });
    }

    let payload: any;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return new Response(JSON.stringify({ error: "invalid_json" }), { status: 400 });
    }

    // דה-דופליקציה: Lemon Squeezy יכולה לשלוח את אותו אירוע יותר מפעם אחת
    // (retry אחרי timeout, resend ידני מהדשבורד). אין X-Event-Id רשמי בתיעוד,
    // אז בונים מזהה יציב מ-event_name+id של האובייקט - אותו אירוע תמיד ייתן
    // אותו מזהה, גם אם נשלח שוב. אם ה-insert נכשל (מפתח כבר קיים) - כבר טופל
    const eventId = `${payload?.meta?.event_name || "unknown"}:${payload?.data?.id || "unknown"}:${payload?.meta?.custom_data?.supabase_user_id || ""}:${payload?.data?.attributes?.updated_at || payload?.data?.attributes?.status || ""}`;
    const { error: dedupError } = await supabase.from("lemonsqueezy_webhook_events").insert({ event_id: eventId });
    if (dedupError) {
        return new Response(JSON.stringify({ received: true, deduped: true }), { status: 200 });
    }

    const eventName: string = payload?.meta?.event_name || "";

    // New Me lifetime = a ONE-TIME purchase (an order). Only ever touches the new_me_*
    // columns - never is_premium/tier. The first payment of the monthly plan also arrives
    // as an order - ignored here, the subscription events below handle it
    if (eventName === "order_created" || eventName === "order_refunded") {
        const orderAttrs = payload?.data?.attributes || {};
        const orderUserId = payload?.meta?.custom_data?.supabase_user_id;
        const variantId = String(orderAttrs?.first_order_item?.variant_id ?? "");
        if (!orderUserId || !LEMONSQUEEZY_VARIANT_ID_NEW_ME || variantId !== LEMONSQUEEZY_VARIANT_ID_NEW_ME) {
            return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 });
        }
        const row: any = await newMeRow(orderUserId);
        const monthlyRunning = ACCESS_STATUSES.includes(row.new_me_subscription_status || "");
        if (eventName === "order_created" && orderAttrs.status === "paid") {
            await supabase.from("user_premium").upsert(
                { user_id: orderUserId, new_me_purchased: true, new_me_order_id: String(payload.data.id), new_me_plan: "lifetime" },
                { onConflict: "user_id" },
            );
            if (monthlyRunning && row.new_me_subscription_status !== "cancelled") await cancelNewMeMonthly(row.new_me_subscription_id);
            return new Response(JSON.stringify({ received: true, new_me: true }), { status: 200 });
        }
        // refund (or an unpaid order): back to the monthly plan if one still runs, otherwise no access
        await supabase.from("user_premium").upsert(
            { user_id: orderUserId, new_me_purchased: monthlyRunning, new_me_order_id: String(payload.data.id), new_me_plan: monthlyRunning ? "monthly" : null },
            { onConflict: "user_id" },
        );
        return new Response(JSON.stringify({ received: true, new_me: monthlyRunning }), { status: 200 });
    }

    // subscription_payment_* events carry an invoice (data.type "subscription-invoices"),
    // not the subscription - its status is "paid"/"void", which must never be read as a
    // subscription status. subscription_updated is sent on every renewal anyway
    if (!eventName.startsWith("subscription_") || payload?.data?.type !== "subscriptions") {
        return new Response(JSON.stringify({ received: true, ignored: true }), { status: 200 });
    }

    const attrs = payload?.data?.attributes || {};
    const userId = payload?.meta?.custom_data?.supabase_user_id;
    if (!userId) {
        // לא אמור לקרות (custom_data נשלח בכל checkout - ר' create-checkout-session),
        // אבל אם כן - אין למי לעדכן, מדווחים "התקבל" בלי שגיאה כדי ש-LS לא ינסה שוב לשווא
        return new Response(JSON.stringify({ received: true, no_user_id: true }), { status: 200 });
    }

    // "cancelled" לא אומר "פג מיד" - זה אומר שהחיוב העתידי בוטל, אבל התקופה
    // ששולמה כבר ממשיכה עד "expired" בפועל (אותה התנהגות בדיוק כמו
    // cancel_at_period_end ב-Stripe). past_due מקבל תקופת חסד (ניסיונות חיוב
    // חוזרים) ולא נחסם מיד - רק unpaid (כל הניסיונות נכשלו) חוסם
    const status: string = attrs.status;
    const variantId = String(attrs.variant_id ?? "");

    // New Me monthly - its own columns; a lifetime purchase always keeps access
    if (isNewMeMonthly(variantId, attrs.product_name)) {
        const row: any = await newMeRow(userId);
        const lifetime = row.new_me_plan === "lifetime";
        const access = ACCESS_STATUSES.includes(status);
        await supabase.from("user_premium").upsert(
            {
                user_id: userId,
                new_me_purchased: lifetime || access,
                new_me_plan: lifetime ? "lifetime" : (access ? "monthly" : null),
                new_me_subscription_id: String(payload.data.id),
                new_me_subscription_status: status,
                new_me_renews_at: attrs.renews_at || null,
                new_me_ends_at: attrs.ends_at || null,
            },
            { onConflict: "user_id" },
        );
        return new Response(JSON.stringify({ received: true, new_me_monthly: access }), { status: 200 });
    }

    // Premium - only its own variants. Anything else (a product this webhook doesn't know)
    // must never switch Premium on or off
    const tier = tierFromVariantId(variantId);
    if (!tier) return new Response(JSON.stringify({ received: true, ignored: true, unknown_variant: variantId }), { status: 200 });
    const isPremium = ACCESS_STATUSES.includes(status);

    await supabase.from("user_premium").upsert(
        {
            user_id: userId,
            is_premium: isPremium,
            tier,
            stripe_customer_id: String(attrs.customer_id),
            stripe_subscription_id: String(payload.data.id),
            subscription_status: status,
        },
        { onConflict: "user_id" },
    );

    return new Response(JSON.stringify({ received: true }), { status: 200 });
});
