// Supabase Edge Function: scan-meal-photo
//
// Premium-only feature: accepts a base64 photo of a meal and uses a real vision-capable
// AI model to identify the food items present and estimate calories for each, returning
// {items: [{food_name, calories}, ...]}. The frontend drops each item straight into the
// next empty meal-tracker row for the selected date and saves - no manual typing.
//
// Gated on user_premium.is_premium alone (like parse-schedule-request) - no free-tier
// fallback, since reliable food identification + calorie estimation needs real vision
// understanding a heuristic can't approximate.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// כדאי לבדוק שהמודל הזה עדיין נתמך/מומלץ לפני הפריסה:
// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5-20250929";

// עוקף בדיקת פרימיום למפתחת בלבד - חייב להיות זהה לרשימה בצד הלקוח (app.js) וגם
// בכל שאר ה-Edge Functions, כי בדיקת לקוח בלבד ניתנת לעקיפה
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
        const authHeader = req.headers.get("Authorization") || "";
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userEmail = (userData.user.email || "").toLowerCase();
        const userId = userData.user.id;

        const { data: premiumRow } = await supabase
            .from("user_premium")
            .select("is_premium")
            .eq("user_id", userId)
            .maybeSingle();
        const isPremium = DEV_SUPERUSER_EMAILS.includes(userEmail) || !!premiumRow?.is_premium;
        if (!isPremium) return jsonResponse({ error: "premium_required" }, 402);

        const body = await req.json();
        const { imageBase64, mediaType } = body;
        if (!imageBase64 || !mediaType || !mediaType.startsWith("image/")) {
            return jsonResponse({ error: "missing_image" }, 400);
        }

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 1000,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
                            {
                                type: "text",
                                text:
                                    "This photo shows a meal. Identify each distinct food item visible and estimate its " +
                                    "calorie count as best you can from portion size and appearance. Combine items that " +
                                    "are clearly part of one dish into a single entry rather than over-splitting. Extract " +
                                    "the results with the log_meal_items tool.",
                            },
                        ],
                    },
                ],
                tools: [
                    {
                        name: "log_meal_items",
                        description: "Extract identified food items and estimated calories from a meal photo.",
                        input_schema: {
                            type: "object",
                            properties: {
                                items: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            food_name: { type: "string" },
                                            calories: { type: "integer" },
                                        },
                                        required: ["food_name", "calories"],
                                    },
                                },
                            },
                            required: ["items"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "log_meal_items" },
            }),
        });

        if (!anthropicRes.ok) {
            const errText = await anthropicRes.text();
            return jsonResponse({ error: "ai_provider_error", detail: errText }, 502);
        }

        const anthropicJson = await anthropicRes.json();
        const toolUseBlock = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!toolUseBlock) return jsonResponse({ error: "no_extraction" }, 502);

        return jsonResponse({ ok: true, items: toolUseBlock.input.items || [] });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
