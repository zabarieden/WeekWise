// Supabase Edge Function: stripe-webhook
//
// Called by Stripe itself (not by a logged-in client) whenever a subscription
// event happens - this is the ONLY place that writes is_premium/tier/
// subscription_status to user_premium, since the client no longer has write
// access to those columns (a client-only "is_premium=true" write would let
// anyone grant themselves premium for free).
//
// Unlike every other function in this repo, auth here is a Stripe signature
// check, not a Supabase JWT - Stripe is the caller, there's no logged-in user
// on this request at all.
//
// Deploy this via the Supabase CLI with --no-verify-jwt (see DEPLOY.md) -
// Supabase's platform-level JWT check would otherwise reject every call from
// Stripe before this code even runs, since Stripe never sends a Supabase JWT.

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SIGNING_SECRET = Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")!;
const STRIPE_PRICE_ID_MONTHLY = Deno.env.get("STRIPE_PRICE_ID_MONTHLY")!;
const STRIPE_PRICE_ID_SEMIANNUAL = Deno.env.get("STRIPE_PRICE_ID_SEMIANNUAL")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const stripe = new Stripe(STRIPE_SECRET_KEY, { httpClient: Stripe.createFetchHttpClient() });

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function tierFromPriceId(priceId: string | undefined): "monthly" | "semiannual" | null {
    if (priceId === STRIPE_PRICE_ID_MONTHLY) return "monthly";
    if (priceId === STRIPE_PRICE_ID_SEMIANNUAL) return "semiannual";
    return null;
}

// כותב את מצב המנוי לשורת user_premium המתאימה, לפי subscription_id אם כבר
// ידוע, אחרת לפי supabase_user_id ב-metadata - מכסה גם checkout.session.completed
// (עוד לפני שנשמר stripe_subscription_id) וגם עדכונים מאוחרים יותר
async function upsertSubscriptionState(subscription: Stripe.Subscription, fallbackUserId?: string) {
    const priceId = subscription.items.data[0]?.price?.id;
    const tier = tierFromPriceId(priceId);
    const userId = (subscription.metadata?.supabase_user_id as string | undefined) || fallbackUserId;
    if (!userId) return;

    const isActive = subscription.status === "active" || subscription.status === "trialing";
    await supabase
        .from("user_premium")
        .update({
            tier,
            is_premium: isActive,
            stripe_customer_id: subscription.customer as string,
            stripe_subscription_id: subscription.id,
            subscription_status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
        })
        .eq("user_id", userId);
}

Deno.serve(async (req) => {
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    // אימות חתימה חייב לקרוא את הגוף כטקסט גולמי, לא JSON - זה בדיוק מה
    // שנחתם על ידי Stripe, כל שינוי (אפילו פרסור-ואז-סטרינגיפיי מחדש) פוסל
    // את החתימה
    const rawBody = await req.text();
    const signature = req.headers.get("stripe-signature") || "";

    let event: Stripe.Event;
    try {
        // הגרסה ה-async + SubtleCryptoProvider מפורש - דרוש ב-Deno (בניגוד ל-
        // Node, שם ה-crypto הסינכרוני של Stripe SDK עובד כברירת מחדל)
        event = await stripe.webhooks.constructEventAsync(
            rawBody,
            signature,
            STRIPE_WEBHOOK_SIGNING_SECRET,
            undefined,
            Stripe.createSubtleCryptoProvider(),
        );
    } catch (err) {
        return jsonResponse({ error: "invalid_signature", detail: String(err) }, 400);
    }

    try {
        // אידמפוטנטיות - Stripe שולח שוב אירועים שלא קיבלו 2xx (או timeout),
        // אז אירוע יכול להגיע יותר מפעם אחת. מנסים להכניס את ה-event.id קודם;
        // אם זה מתנגש (כבר טופל), פשוט מאשרים 200 בלי לעבד שוב
        const { error: dedupeError } = await supabase.from("stripe_webhook_events").insert({ event_id: event.id });
        if (dedupeError) return jsonResponse({ received: true, deduped: true });

        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.mode !== "subscription" || !session.subscription) break;
                const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                await upsertSubscriptionState(subscription, session.metadata?.supabase_user_id);
                break;
            }
            case "customer.subscription.updated": {
                const subscription = event.data.object as Stripe.Subscription;
                await upsertSubscriptionState(subscription);
                break;
            }
            case "customer.subscription.deleted": {
                const subscription = event.data.object as Stripe.Subscription;
                await supabase
                    .from("user_premium")
                    .update({ is_premium: false, subscription_status: "canceled" })
                    .eq("stripe_subscription_id", subscription.id);
                break;
            }
            case "invoice.payment_failed": {
                // אין כתיבה כאן בכוונה - customer.subscription.updated כבר יורה
                // עם status:'past_due' באותה כשלון תשלום עצמה. שמור לשימוש עתידי
                // (למשל התראה ייעודית) בלי לגעת עכשיו
                break;
            }
            default:
                break;
        }

        return jsonResponse({ received: true });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
