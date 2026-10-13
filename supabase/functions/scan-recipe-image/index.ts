// Supabase Edge Function: scan-recipe-image
//
// Accepts a base64-encoded photo OR PDF of a recipe (handwritten note, screenshot,
// cookbook page, scanned document - anything) from the logged-in app, sends it to a
// real vision-capable AI model, and returns a structured {title, category, calories,
// ingredients, instructions} object for the frontend to drop straight into the (still
// fully editable) Add Recipe form.
//
// Usage limits (server-side, since a client-only check can be bypassed):
// - Free (non-premium) users: RECIPE_SCAN_FREE_LIFETIME_LIMIT scans EVER (not monthly -
//   tracked in user_ai_usage.recipe_image_scan_lifetime_used, never resets), matching
//   the same "5 free lifetime uses" policy shared by every other AI feature. The older
//   free_image_scans_month_key/_used columns are retired/no longer read.
// - Premium users (any billing period - monthly/semiannual/lifetime alike): a shared
//   monthly quota of PREMIUM_IMAGE_SCAN_MONTHLY_LIMIT image scans, shared with
//   scan-meal-photo (both count against the same premium_image_scans_month_used
//   counter, since both cost roughly the same per call). This exists specifically so
//   a one-time lifetime purchase can never generate unbounded ongoing AI cost with no
//   further revenue - see the DEPLOY.md in this folder for the full reasoning.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// כדאי לבדוק שהמודל הזה עדיין נתמך/מומלץ לפני הפריסה:
// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const PREMIUM_IMAGE_SCAN_MONTHLY_LIMIT = 50;
// כמה קבצים למתכון אחד (המצרכים לחוד, אופן ההכנה לחוד, או כמה דפים) - בקשה אחת, סריקה אחת במונה
const MAX_SCAN_FILES = 6;

const RECIPE_CATEGORIES = [
    "appetizers", "breakfast", "meat_mains", "dairy_mains",
    "sides", "snacks", "salads", "soups", "desserts", "vegan",
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
        // מזהים את המשתמש מה-JWT שנשלח מהאפליקציה - לא סומכים על user_id שנשלח מהלקוח
        const authHeader = req.headers.get("Authorization") || "";
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userId = userData.user.id;
        const userEmail = (userData.user.email || "").toLowerCase();

        const { data: premiumRow } = await supabase
            .from("user_premium")
            .select("is_premium, new_me_purchased")
            .eq("user_id", userId)
            .maybeSingle();
        // New Me includes Premium (her decision 2026-10-13: "buying New Me unlocks Premium")
        const isPremium = DEV_SUPERUSER_EMAILS.includes(userEmail) || !!premiumRow?.is_premium || !!premiumRow?.new_me_purchased;

        const { data: usageRow } = await supabase
            .from("user_ai_usage")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

        const monthKey = currentMonthKey();
        // אם ה-month_key השמור לא תואם לחודש הנוכחי, הספירה מתאפסת (0) - זה
        // בפועל *הוא* מנגנון האיפוס החודשי, בלי צורך בשום cron job נפרד -
        // אותו דפוס בדיוק לשני המונים (פרימיום/חינמי), רק עמודות נפרדות
        const premiumMonthUsed = usageRow?.premium_image_scans_month_key === monthKey
            ? (usageRow?.premium_image_scans_month_used || 0)
            : 0;
        // הוחלף: היה מונה חודשי-מתאפס (free_image_scans_month_key/_used) -
        // עכשיו 5 שימושים חינמיים *לכל החיים*, כמו שאר תכונות ה-AI (מדיניות
        // אחידה). העמודות הישנות נשארות בטבלה (לא נקראות יותר), בדיוק כמו
        // image_scans_used הישן למעלה
        const RECIPE_SCAN_FREE_LIFETIME_LIMIT = 5;
        const recipeScanLifetimeUsed = usageRow?.recipe_image_scan_lifetime_used || 0;

        if (isPremium && premiumMonthUsed >= PREMIUM_IMAGE_SCAN_MONTHLY_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "premium_monthly", used: premiumMonthUsed, limit: PREMIUM_IMAGE_SCAN_MONTHLY_LIMIT }, 402);
        }
        if (!isPremium && recipeScanLifetimeUsed >= RECIPE_SCAN_FREE_LIFETIME_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "free_lifetime", used: recipeScanLifetimeUsed, limit: RECIPE_SCAN_FREE_LIFETIME_LIMIT }, 402);
        }

        const body = await req.json();
        // images: כמה קבצים למתכון אחד, לכל אחד part = all / ingredients / steps. imageBase64 + mediaType: קובץ אחד, כמו פעם
        const rawItems: Array<{ base64?: string; mediaType?: string; part?: string }> = Array.isArray(body.images) && body.images.length
            ? body.images
            : (body.imageBase64 && body.mediaType ? [{ base64: body.imageBase64, mediaType: body.mediaType, part: "all" }] : []);
        if (!rawItems.length) return jsonResponse({ error: "missing_image" }, 400);
        if (rawItems.length > MAX_SCAN_FILES) return jsonResponse({ error: "too_many_files", limit: MAX_SCAN_FILES }, 400);
        const many = rawItems.length > 1;
        // Anthropic מבחין בין בלוק "image" (לתמונות) לבלוק "document" (ל-PDF) -
        // שני הסוגים נתמכים באותה קריאת API אחת, רק סוג התוכן שונה. כשיש כמה קבצים, לפני כל אחד שורה שאומרת מה יש בו
        const fileBlocks: unknown[] = [];
        for (let i = 0; i < rawItems.length; i++) {
            const item = rawItems[i];
            const mt = String(item.mediaType || "");
            const isPdf = mt === "application/pdf";
            if (!item.base64 || (!isPdf && !mt.startsWith("image/"))) return jsonResponse({ error: "unsupported_file_type" }, 400);
            if (many) {
                const what = item.part === "ingredients" ? "shows the INGREDIENTS of the recipe"
                    : item.part === "steps" ? "shows the PREPARATION STEPS (instructions) of the recipe"
                    : "shows the recipe, or one page/part of it";
                fileBlocks.push({ type: "text", text: `File ${i + 1} of ${rawItems.length} - ${what}:` });
            }
            fileBlocks.push(isPdf
                ? { type: "document", source: { type: "base64", media_type: mt, data: item.base64 } }
                : { type: "image", source: { type: "base64", media_type: mt, data: item.base64 } });
        }
        const multiNote = many
            ? `These ${rawItems.length} files are all parts of ONE single recipe (for example the ingredients photographed separately from the instructions, or several pages of the same recipe). Combine them into one recipe: keep the order of the pages, put every ingredient in "ingredients" and every step in "instructions", and never repeat a line that appears in two of the files.\n\n`
            : "";

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: many ? 3000 : 1500,
                messages: [
                    {
                        role: "user",
                        content: [
                            ...fileBlocks,
                            {
                                type: "text",
                                text:
                                    multiNote +
                                    (many ? "These files contain" : "This file contains") + " a recipe - it might be a handwritten note, a screenshot, a photo " +
                                    "of a cookbook page, or a scanned/exported PDF document. It may also be a screenshot " +
                                    "of a chat app (e.g. WhatsApp, Gemini, Messages) showing a recipe someone sent - in " +
                                    "that case, IGNORE everything that is phone/app chrome and not part of the recipe " +
                                    "itself: status bar clock and date, battery/signal/carrier icons, device or app name, " +
                                    "sender name, message timestamps, 'Reply'/reaction buttons, and any other UI element. " +
                                    "Only transcribe the actual recipe content (title, ingredients, instructions).\n\n" +
                                    "Transcribe the recipe faithfully and extract it with the extract_recipe tool. Keep " +
                                    "ingredients and instructions exactly as written - do not invent, " +
                                    "embellish, or add anything that isn't actually there. If a word is illegible, skip " +
                                    "it rather than guessing.\n\n" +
                                    "For estimated_total_calories: if the source explicitly states a calorie count, use " +
                                    "that. Otherwise calculate your own best estimate of the TOTAL calories for the " +
                                    "entire recipe/dish as written (not per serving, not per single ingredient) by " +
                                    "summing standard nutritional values for every listed ingredient at its stated " +
                                    "quantity. Return your best numeric estimate rather than null whenever the " +
                                    "ingredient list is legible enough to estimate from.",
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
                                title: { type: "string", description: "The recipe's own title/name only - never a device name, clock, date, or other UI text" },
                                category: { type: "string", enum: RECIPE_CATEGORIES },
                                estimated_total_calories: { type: ["integer", "null"], description: "Best-effort estimated total calories for the WHOLE recipe as written, summed across all ingredients at their stated quantities - not per serving" },
                                ingredients: { type: "string", description: "One ingredient per line, newline-separated. Ingredients only - never include instruction/method text here" },
                                instructions: { type: "string", description: "One step per line, newline-separated. Preparation steps only - never repeat the ingredient list here" },
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

        // הכלי מחזיר estimated_total_calories (שם מפורש יותר עבור המודל, ר'
        // ההנחיה למעלה) - ממפים בחזרה ל-calories כאן כדי שהחוזה מול הלקוח
        // (app.js, ששולף recipe.calories) יישאר בלי שינוי
        const toolInput = toolUseBlock.input;
        const recipe = { ...toolInput, calories: toolInput.estimated_total_calories ?? toolInput.calories ?? null };

        // עדכון המונה המתאים בלבד - שניהם כותבים month_key מעודכן, גם אם
        // התאפס הרגע (upsert בשני המקרים, כי גם מונה חינמי צריך month_key)
        if (isPremium) {
            await supabase.from("user_ai_usage").upsert(
                { user_id: userId, username: userData.user.email, premium_image_scans_month_key: monthKey, premium_image_scans_month_used: premiumMonthUsed + 1 },
                { onConflict: "user_id" },
            );
        } else {
            await supabase.from("user_ai_usage").upsert(
                { user_id: userId, username: userData.user.email, recipe_image_scan_lifetime_used: recipeScanLifetimeUsed + 1 },
                { onConflict: "user_id" },
            );
        }

        return jsonResponse({ ok: true, recipe, scansUsed: isPremium ? premiumMonthUsed + 1 : recipeScanLifetimeUsed + 1 });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
