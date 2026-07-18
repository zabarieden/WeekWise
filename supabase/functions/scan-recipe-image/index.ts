// Supabase Edge Function: scan-recipe-image
//
// Accepts a base64-encoded photo OR PDF of a recipe (handwritten note, screenshot,
// cookbook page, scanned document - anything) from the logged-in app, sends it to a
// real vision-capable AI model, and returns a structured {title, category, calories,
// ingredients, instructions} object for the frontend to drop straight into the (still
// fully editable) Add Recipe form.
//
// Enforces a single shared 10-free-scan/upload limit per user (server-side, since a
// client-only check can be bypassed) using the same user_ai_usage.image_scans_used
// counter regardless of whether the file is an image or a PDF - "10 uploads, 10 scans,
// or a mix of both" all count against the same total - and skips the limit entirely for
// users with user_premium.is_premium = true.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// כדאי לבדוק שהמודל הזה עדיין נתמך/מומלץ לפני הפריסה:
// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-4-5-20250929";

const IMAGE_SCAN_FREE_LIMIT = 10;

const RECIPE_CATEGORIES = [
    "appetizers", "breakfast", "meat_mains", "dairy_mains",
    "sides", "snacks", "salads", "soups", "desserts",
];

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// עוקף בדיקת פרימיום למפתחת בלבד - חייב להיות זהה לרשימה בצד הלקוח (app.js) וגם
// בכל שאר ה-Edge Functions, כי בדיקת לקוח בלבד ניתנת לעקיפה
const DEV_SUPERUSER_EMAILS = ["zabarieden111@gmail.com"];

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
        // מזהים את המשתמש מה-JWT שנשלח מהאפליקציה - לא סומכים על user_id שנשלח מהלקוח
        const authHeader = req.headers.get("Authorization") || "";
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userId = userData.user.id;
        const userEmail = (userData.user.email || "").toLowerCase();

        const { data: premiumRow } = await supabase
            .from("user_premium")
            .select("is_premium")
            .eq("user_id", userId)
            .maybeSingle();
        const isPremium = DEV_SUPERUSER_EMAILS.includes(userEmail) || !!premiumRow?.is_premium;

        const { data: usageRow } = await supabase
            .from("user_ai_usage")
            .select("image_scans_used")
            .eq("user_id", userId)
            .maybeSingle();
        const used = usageRow?.image_scans_used || 0;

        if (!isPremium && used >= IMAGE_SCAN_FREE_LIMIT) {
            return jsonResponse({ error: "limit_reached", used, limit: IMAGE_SCAN_FREE_LIMIT }, 402);
        }

        const body = await req.json();
        const { imageBase64, mediaType } = body;
        if (!imageBase64 || !mediaType) return jsonResponse({ error: "missing_image" }, 400);

        const isPdf = mediaType === "application/pdf";
        const isImage = mediaType.startsWith("image/");
        if (!isPdf && !isImage) return jsonResponse({ error: "unsupported_file_type" }, 400);

        // Anthropic מבחין בין בלוק "image" (לתמונות) לבלוק "document" (ל-PDF) -
        // שני הסוגים נתמכים באותה קריאת API אחת, רק סוג התוכן שונה
        const fileContentBlock = isPdf
            ? { type: "document", source: { type: "base64", media_type: mediaType, data: imageBase64 } }
            : { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } };

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
                            fileContentBlock,
                            {
                                type: "text",
                                text:
                                    "This file contains a recipe - it might be a handwritten note, a screenshot, a photo " +
                                    "of a cookbook page, or a scanned/exported PDF document. Transcribe it faithfully and " +
                                    "extract it with the extract_recipe tool. Keep ingredients and instructions exactly " +
                                    "as written in the file - do not invent, embellish, or add anything that isn't " +
                                    "actually there. If a word is illegible, skip it rather than guessing.",
                            },
                        ],
                    },
                ],
                tools: [
                    {
                        name: "extract_recipe",
                        description: "Extract a structured recipe from the transcribed image text.",
                        input_schema: {
                            type: "object",
                            properties: {
                                title: { type: "string" },
                                category: { type: "string", enum: RECIPE_CATEGORIES },
                                calories: { type: ["integer", "null"] },
                                ingredients: { type: "string", description: "One ingredient per line, newline-separated" },
                                instructions: { type: "string", description: "One step per line, newline-separated" },
                            },
                            required: ["title", "category", "ingredients", "instructions"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "extract_recipe" },
            }),
        });

        if (!anthropicRes.ok) {
            const errText = await anthropicRes.text();
            return jsonResponse({ error: "ai_provider_error", detail: errText }, 502);
        }

        const anthropicJson = await anthropicRes.json();
        const toolUseBlock = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!toolUseBlock) return jsonResponse({ error: "no_extraction" }, 502);

        const recipe = toolUseBlock.input;

        if (usageRow) {
            await supabase.from("user_ai_usage").update({ image_scans_used: used + 1 }).eq("user_id", userId);
        } else {
            await supabase.from("user_ai_usage").insert({ user_id: userId, image_scans_used: 1 });
        }

        return jsonResponse({ ok: true, recipe, scansUsed: used + 1 });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
