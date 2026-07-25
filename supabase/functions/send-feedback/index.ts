// Supabase Edge Function: send-feedback
//
// Lets any logged-in user send a bug report / feature suggestion / help question /
// general message straight from inside the app, no mail client required. Every
// submission is (a) stored in feedback_messages (service-role only - see
// feedback_schema.sql, there is no client-side RLS policy on that table at all) and
// (b) emailed in real time to the support inbox via Resend, so it actually gets seen.
//
// The app has 33 languages, so the submitted message can be in anything - the email
// TO SUPPORT (only - the submitting user never sees this) also includes a Hebrew
// translation via the Anthropic API, so it's readable at a glance regardless of the
// original language. Reuses the same ANTHROPIC_API_KEY secret already set up for
// parse-schedule-request/scan-recipe-image - no new account needed. If the message is
// already Hebrew, or the translation call fails for any reason, the email still goes
// out with just the original text (never blocks on this).
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPPORT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "obeko.support@gmail.com";
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const HEBREW_CHAR_RE = new RegExp("[\\u0590-\\u05FF]");

// מתרגמת לעברית רק לצורך התצוגה במייל של התמיכה - הטקסט המקורי הוא זה
// שנשמר ב-feedback_messages ושמשמש כל תקשורת עתידית עם הכותבת/הכותב
async function translateToHebrewForSupportEmail(text: string): Promise<string | null> {
    if (!ANTHROPIC_API_KEY) return null;
    if (HEBREW_CHAR_RE.test(text)) return null; // כבר בעברית - אין צורך בתרגום
    try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 500,
                messages: [
                    {
                        role: "user",
                        content:
                            "Translate the following user-submitted app feedback message into Hebrew. " +
                            "Reply with ONLY the Hebrew translation, nothing else - no quotes, no explanation.\n\n" +
                            text,
                    },
                ],
            }),
        });
        if (!res.ok) return null;
        const data = await res.json();
        const translated = data?.content?.[0]?.text?.trim();
        return translated || null;
    } catch {
        return null;
    }
}

const VALID_CATEGORIES = ["bug", "feature", "help", "other"];
const CATEGORY_LABELS: Record<string, string> = {
    bug: "🐛 Bug Report",
    feature: "💡 Feature Suggestion",
    help: "❓ Help Using the App",
    other: "💬 Other",
};

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

function escapeHtml(s: string) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
        const userEmail = userData.user.email || "";

        const body = await req.json();
        const category: string = body?.category;
        const message: string = (body?.message || "").trim();
        if (!VALID_CATEGORIES.includes(category)) return jsonResponse({ error: "invalid_category" }, 400);
        if (!message) return jsonResponse({ error: "missing_message" }, 400);

        const { error: insertError } = await supabase.from("feedback_messages").insert({
            user_id: userId,
            username: userEmail,
            category,
            message,
        });
        if (insertError) return jsonResponse({ error: insertError.message }, 500);

        const categoryLabel = CATEGORY_LABELS[category] || category;
        try {
            const hebrewTranslation = await translateToHebrewForSupportEmail(message);
            const translationBlock = hebrewTranslation
                ? `<p dir="rtl"><b>תרגום לעברית:</b></p><p dir="rtl">${escapeHtml(hebrewTranslation).replace(/\n/g, "<br>")}</p><hr>`
                : "";
            await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: "Obeko Feedback <onboarding@resend.dev>",
                    to: [SUPPORT_EMAIL],
                    reply_to: userEmail || undefined,
                    subject: `[Obeko] ${categoryLabel}`,
                    html:
                        `<p><b>From:</b> ${escapeHtml(userEmail || "unknown")}</p>` +
                        `<p><b>Category:</b> ${escapeHtml(categoryLabel)}</p>` +
                        translationBlock +
                        `<p><b>Message:</b></p><p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>`,
                }),
            });
        } catch (_emailErr) {
            // ההודעה כבר נשמרה ב-DB בהצלחה - כשל בשליחת המייל לא אמור להיכשל את כל הבקשה
            // מבחינת המשתמש, רק להישאר בלוג הפונקציה
        }

        return jsonResponse({ ok: true });
    } catch (err: any) {
        return jsonResponse({ error: err?.message || "unknown_error" }, 500);
    }
});
