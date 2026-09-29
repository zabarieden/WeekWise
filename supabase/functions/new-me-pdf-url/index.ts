// Supabase Edge Function: new-me-pdf-url
//
// Returns a short-lived signed URL for the New Me meal-plan PDF in the
// user's language. The PDFs are the paid content itself, so they live in a
// PRIVATE storage bucket ("new-me-pdfs", files named <lang>.pdf) and are only
// handed out to users with user_premium.new_me_purchased = true (or the dev
// superuser - same bypass list as every other Edge Function).
//
// Deploy: supabase functions deploy new-me-pdf-url

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEV_SUPERUSER_EMAILS = ["zabarieden111@gmail.com"];
const BUCKET = "new-me-pdfs";
const URL_TTL_SECONDS = 600;

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
        const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userId = userData.user.id;
        const userEmail = userData.user.email || "";

        const { data: row } = await supabase
            .from("user_premium")
            .select("new_me_purchased")
            .eq("user_id", userId)
            .maybeSingle();
        const allowed = DEV_SUPERUSER_EMAILS.includes(userEmail) || !!row?.new_me_purchased;
        if (!allowed) return jsonResponse({ error: "not_purchased" }, 403);

        const body = await req.json().catch(() => ({}));
        // All menu PDFs are generated from the app's corrected menu text (the
        // original per-language files had quantity translation errors)
        const READY_LANGS = ["en", "he", "es", "fr", "ar", "ru", "de", "pt", "ja", "zh", "hi", "ko", "tr", "id", "it", "vi", "pl", "th", "ur", "bn", "sw", "uk", "el", "nl", "ca", "ro", "yo", "sv", "nb", "da", "cs", "hu", "fi"];
        const lang = READY_LANGS.includes(String(body?.lang || "")) ? String(body.lang) : "en";

        let { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(`${lang}.pdf`, URL_TTL_SECONDS);
        if (error || !data?.signedUrl) {
            // No PDF for this language yet - fall back to English
            ({ data, error } = await supabase.storage.from(BUCKET).createSignedUrl("en.pdf", URL_TTL_SECONDS));
        }
        if (error || !data?.signedUrl) return jsonResponse({ error: "not_found" }, 404);

        return jsonResponse({ url: data.signedUrl });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
