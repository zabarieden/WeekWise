// Supabase Edge Function: new-me-meal-kcal
//
// Estimates calories and protein for ONE meal the user typed in New Me's swap sheet
// ("✨ Write what you'd like": "omelette with 2 eggs, salad and a slice of bread"),
// so the meal can replace a planned one - today only or permanently. Returns
// {kcal, protein_g, name, description}; the app shows it for confirmation first.
//
// Access: New Me buyers (user_premium.new_me_purchased) or the dev superuser -
// New Me is sold separately from Premium, so this does NOT require is_premium.
// Daily cap per user (new_me_meal_day_key/_used in user_ai_usage) against abuse.
//
// Deploy: supabase functions deploy new-me-meal-kcal

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";
const DAILY_LIMIT = 40;
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
        const { data: usageRow } = await supabase.from("user_ai_usage").select("new_me_meal_day_key, new_me_meal_day_used").eq("user_id", userId).maybeSingle();
        const usedToday = usageRow?.new_me_meal_day_key === dayKey ? (usageRow?.new_me_meal_day_used || 0) : 0;
        if (usedToday >= DAILY_LIMIT) return jsonResponse({ error: "limit_reached", limit: DAILY_LIMIT }, 402);

        const body = await req.json().catch(() => ({}));
        const meal = String(body?.meal || "").trim().slice(0, 300);
        const language = String(body?.language || "en").slice(0, 5);
        const budget = Math.max(0, Math.min(3000, Math.round(Number(body?.budget) || 0)));
        if (meal.length < 2) return jsonResponse({ error: "missing_meal" }, 400);

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 400,
                messages: [{
                    role: "user",
                    content:
                        `A user of a diet app wants to eat this meal instead of a planned one: "${meal}" (UI language: ${language}). ` +
                        "Estimate the calories and protein of exactly what is described. Use the amounts written; where no amount is given, " +
                        "assume one typical home portion for a person on a weight-loss plan (not a restaurant portion). " +
                        (budget > 0 ? `For context only, the meal it replaces is about ${budget} kcal - do NOT change your estimate to match it. ` : "") +
                        "Also return a short clean display name for the meal in the SAME language the user wrote in (fix typos, max ~6 words), " +
                        "and a one-line list of its components with the portions you assumed, in the same language. " +
                        "Answer with the estimate_meal tool only.",
                }],
                tools: [{
                    name: "estimate_meal",
                    description: "Calories and protein for the described meal.",
                    input_schema: {
                        type: "object",
                        properties: {
                            kcal: { type: "integer", description: "Calories for the whole described meal" },
                            protein_g: { type: "number", description: "Protein grams for the whole described meal" },
                            name: { type: "string", description: "Short display name in the user's language" },
                            description: { type: "string", description: "One line: components with the assumed portions, in the user's language" },
                        },
                        required: ["kcal", "protein_g", "name", "description"],
                    },
                }],
                tool_choice: { type: "tool", name: "estimate_meal" },
            }),
        });
        if (!anthropicRes.ok) return jsonResponse({ error: "ai_provider_error", detail: await anthropicRes.text() }, 502);
        const anthropicJson = await anthropicRes.json();
        const tool = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!tool) return jsonResponse({ error: "no_estimate" }, 502);

        const kcal = Math.max(0, Math.min(3000, Math.round(Number(tool.input?.kcal) || 0)));
        const protein = Math.max(0, Math.min(300, Math.round((Number(tool.input?.protein_g) || 0) * 10) / 10));
        const name = String(tool.input?.name || meal).trim().slice(0, 80) || meal.slice(0, 80);
        const description = String(tool.input?.description || "").trim().slice(0, 400);

        await supabase.from("user_ai_usage").upsert(
            { user_id: userId, username: userData.user.email, new_me_meal_day_key: dayKey, new_me_meal_day_used: usedToday + 1 },
            { onConflict: "user_id" },
        );
        return jsonResponse({ ok: true, kcal, protein_g: protein, name, description });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
