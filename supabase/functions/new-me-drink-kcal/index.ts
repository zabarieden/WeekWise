// Supabase Edge Function: new-me-drink-kcal
//
// Estimates the calories of ONE drink the user typed in New Me's Drinks section
// ("coffee with milk", "cola zero", "fresh orange juice"...), so users never have
// to work calories out themselves - the app pre-fills the number and the user can
// still edit it. Returns {kcal, protein_g, name}.
//
// Access: New Me buyers (user_premium.new_me_purchased) or the dev superuser -
// New Me is sold separately from Premium, so this does NOT require is_premium.
// Daily cap per user (new_me_drink_day_key/_used in user_ai_usage) against abuse.
//
// Deploy: supabase functions deploy new-me-drink-kcal

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";
const DAILY_LIMIT = 60;
const DEV_SUPERUSER_EMAILS = ["zabarieden111@gmail.com"];

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
        const userEmail = (userData.user.email || "").toLowerCase();

        const { data: premiumRow } = await supabase.from("user_premium").select("new_me_purchased").eq("user_id", userId).maybeSingle();
        if (!DEV_SUPERUSER_EMAILS.includes(userEmail) && !premiumRow?.new_me_purchased) {
            return jsonResponse({ error: "not_purchased" }, 403);
        }

        const dayKey = new Date().toISOString().slice(0, 10);
        const { data: usageRow } = await supabase.from("user_ai_usage").select("new_me_drink_day_key, new_me_drink_day_used").eq("user_id", userId).maybeSingle();
        const usedToday = usageRow?.new_me_drink_day_key === dayKey ? (usageRow?.new_me_drink_day_used || 0) : 0;
        if (usedToday >= DAILY_LIMIT) return jsonResponse({ error: "limit_reached", limit: DAILY_LIMIT }, 402);

        const body = await req.json().catch(() => ({}));
        const drink = String(body?.drink || "").trim().slice(0, 120);
        const language = String(body?.language || "en").slice(0, 5);
        if (drink.length < 2) return jsonResponse({ error: "missing_drink" }, 400);

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 300,
                messages: [{
                    role: "user",
                    content:
                        `A user of a diet app logged ONE drink: "${drink}" (UI language: ${language}). ` +
                        "Estimate the calories and protein for ONE typical serving of exactly that drink as it is usually prepared " +
                        "(a regular cup/mug/glass ~240 ml unless the text says a size; a can = 330 ml; an espresso shot = 30 ml). " +
                        "Account for anything mentioned (milk type, sugar, syrup, zero/diet). Plain water, black coffee, plain tea = 0-5 kcal. " +
                        "Text in parentheses like \"(milk: X)\" (in any language) is milk ADDED to the drink; if X is a bare number it means millilitres of milk (e.g. \"(milk: 100)\" = 100 ml of regular milk), and words like \"a little\" mean about 30 ml. " +
                        "Also return a short clean display name for the drink in the SAME language the user wrote it in (fix typos, keep it short). " +
                        "Answer with the estimate_drink tool only.",
                }],
                tools: [{
                    name: "estimate_drink",
                    description: "Calories and protein for one serving of the drink.",
                    input_schema: {
                        type: "object",
                        properties: {
                            kcal: { type: "integer", description: "Calories for one serving" },
                            protein_g: { type: "number", description: "Protein grams for one serving" },
                            name: { type: "string", description: "Short display name in the user's language" },
                        },
                        required: ["kcal", "protein_g", "name"],
                    },
                }],
                tool_choice: { type: "tool", name: "estimate_drink" },
            }),
        });
        if (!anthropicRes.ok) return jsonResponse({ error: "ai_provider_error", detail: await anthropicRes.text() }, 502);
        const anthropicJson = await anthropicRes.json();
        const tool = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!tool) return jsonResponse({ error: "no_estimate" }, 502);

        const kcal = Math.max(0, Math.min(1500, Math.round(Number(tool.input?.kcal) || 0)));
        const protein = Math.max(0, Math.min(100, Math.round((Number(tool.input?.protein_g) || 0) * 10) / 10));
        const name = String(tool.input?.name || drink).trim().slice(0, 60) || drink;

        await supabase.from("user_ai_usage").upsert(
            { user_id: userId, username: userData.user.email, new_me_drink_day_key: dayKey, new_me_drink_day_used: usedToday + 1 },
            { onConflict: "user_id" },
        );
        return jsonResponse({ ok: true, kcal, protein_g: protein, name });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
