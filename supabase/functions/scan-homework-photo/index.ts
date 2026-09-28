// Supabase Edge Function: scan-homework-photo
//
// Accepts a base64 photo of a school board / homework sheet / notebook page and uses a
// real vision-capable AI model to extract each distinct homework assignment as a short
// line of text, returning {items: [{title}, ...]}. The frontend inserts each item
// straight into the user's Study list (study_tasks) - no manual typing.
//
// Usage limits: premium users share the SAME monthly image-scan pool as
// scan-recipe-image / scan-meal-photo (premium_image_scans_month_used/_key in
// user_ai_usage). Non-premium users get a small lifetime allowance
// (homework_photo_lifetime_used in user_ai_usage) before being asked to upgrade.
//
// Deploy via the Supabase CLI: supabase functions deploy scan-homework-photo

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const PREMIUM_IMAGE_SCAN_MONTHLY_LIMIT = 50;
const HOMEWORK_PHOTO_FREE_LIFETIME_LIMIT = 5;
const MAX_ITEMS = 20;

// עוקף בדיקת פרימיום למפתחת בלבד - חייב להיות זהה לרשימה בצד הלקוח (app.js) וגם
// בכל שאר ה-Edge Functions
const DEV_SUPERUSER_EMAILS = ["zabarieden111@gmail.com"];

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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

        const { data: usageRow } = await supabase
            .from("user_ai_usage")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
        const lifetimeUsed = usageRow?.homework_photo_lifetime_used || 0;
        if (!isPremium && lifetimeUsed >= HOMEWORK_PHOTO_FREE_LIFETIME_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "free_lifetime", used: lifetimeUsed, limit: HOMEWORK_PHOTO_FREE_LIFETIME_LIMIT }, 402);
        }
        const monthKey = currentMonthKey();
        const premiumMonthUsed = usageRow?.premium_image_scans_month_key === monthKey
            ? (usageRow?.premium_image_scans_month_used || 0)
            : 0;
        if (isPremium && premiumMonthUsed >= PREMIUM_IMAGE_SCAN_MONTHLY_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "premium_monthly", used: premiumMonthUsed, limit: PREMIUM_IMAGE_SCAN_MONTHLY_LIMIT }, 402);
        }

        const body = await req.json();
        const { imageBase64, mediaType } = body;
        if (!imageBase64 || !mediaType || !String(mediaType).startsWith("image/")) {
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
                max_tokens: 1500,
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
                            {
                                type: "text",
                                text:
                                    "This photo shows a school board, a homework sheet, or a notebook page with " +
                                    "homework written on it (it may be handwritten, at an angle, or partly blurry). " +
                                    "Extract every distinct homework assignment the student has to do, one entry per " +
                                    "assignment, each as a short actionable line that keeps the specifics that are " +
                                    "written (subject, page numbers, exercise numbers, due date if given). " +
                                    "Write each title in the SAME language as the text in the photo - never translate. " +
                                    "Ignore anything that is not an assignment (the date heading, names, doodles, " +
                                    "classroom notices). Never invent assignments that are not visible. If you cannot " +
                                    "find any homework in the photo, return an empty list. Return the result with the " +
                                    "add_homework_items tool.",
                            },
                        ],
                    },
                ],
                tools: [
                    {
                        name: "add_homework_items",
                        description: "Homework assignments found in the photo.",
                        input_schema: {
                            type: "object",
                            properties: {
                                items: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            title: { type: "string", description: "Short homework line in the language of the photo" },
                                        },
                                        required: ["title"],
                                    },
                                },
                            },
                            required: ["items"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "add_homework_items" },
            }),
        });

        if (!anthropicRes.ok) {
            const errText = await anthropicRes.text();
            return jsonResponse({ error: "ai_provider_error", detail: errText }, 502);
        }

        const anthropicJson = await anthropicRes.json();
        const toolUseBlock = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!toolUseBlock) return jsonResponse({ error: "no_extraction" }, 502);

        const rawItems: any[] = toolUseBlock.input?.items || [];
        const items = rawItems
            .map((i) => ({ title: String(i?.title || "").trim().slice(0, 200) }))
            .filter((i) => i.title)
            .slice(0, MAX_ITEMS);

        if (isPremium) {
            await supabase.from("user_ai_usage").upsert(
                { user_id: userId, username: userData.user.email, premium_image_scans_month_key: monthKey, premium_image_scans_month_used: premiumMonthUsed + 1 },
                { onConflict: "user_id" },
            );
        } else {
            await supabase.from("user_ai_usage").upsert(
                { user_id: userId, username: userData.user.email, homework_photo_lifetime_used: lifetimeUsed + 1 },
                { onConflict: "user_id" },
            );
        }

        return jsonResponse({ ok: true, items });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
