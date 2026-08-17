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

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

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
    if (!eventName.startsWith("subscription_")) {
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
    const isPremium = ["active", "on_trial", "past_due", "cancelled"].includes(status);
    const tier = tierFromVariantId(String(attrs.variant_id));

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
