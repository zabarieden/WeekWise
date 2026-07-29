// Supabase Edge Function: estimate-food-text
//
// Premium-only feature: real AI estimate of calories from a free-text food
// description (the quick-add 🍎 FAB), instead of the always-free local regex
// heuristic (estimateFreeTextCalories in app.js, which every user still gets
// and which this function falls back to on quota/error - see logFoodQuickAdd).
//
// Free-text descriptions are sometimes genuinely ambiguous (e.g. "iced coffee
// based on oats, quarter cup of milk" - is the oats the coffee's milk
// substitute, or a separate food?) in a way no fixed rule set can resolve.
// This function lets the AI ask ONE clarifying question instead of guessing,
// but only ever one: the follow-up call (with clarificationAnswer set) uses a
// tool schema that structurally cannot return "clarify" again, so there's no
// risk of an endless back-and-forth.
//
// Usage limit: its own dedicated monthly quota (premium_food_text_month_used/_key
// in user_ai_usage) - NOT shared with the image-scan quota, mirroring how
// parse-schedule-request also gets its own pool (text-only calls are much
// cheaper than vision calls, so they don't need to share a pool with them).
// Quota is checked/incremented only on the initial call - the forced
// follow-up resolution call doesn't cost a second unit.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// כדאי לבדוק שהמודל הזה עדיין נתמך/מומלץ לפני הפריסה:
// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const FOOD_TEXT_MONTHLY_LIMIT = 100;

// עוקף בדיקת פרימיום למפתחת בלבד - חייב להיות זהה לרשימה בצד הלקוח (app.js) וגם
// בכל שאר ה-Edge Functions, כי בדיקת לקוח בלבד ניתנת לעקיפה. שימו לב: זה עוקף
// רק את שער הפרימיום - לא את בדיקת המכסה החודשית עצמה (ר' למטה), אותו דבר
// בדיוק כמו בשאר הפונקציות
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

const LANGUAGE_NAMES: Record<string, string> = { en: "English", he: "Hebrew", es: "Spanish", fr: "French", ar: "Arabic", ru: "Russian", de: "German", pt: "Portuguese", ja: "Japanese", zh: "Chinese", hi: "Hindi", ko: "Korean", tr: "Turkish", id: "Indonesian", it: "Italian", vi: "Vietnamese", pl: "Polish", th: "Thai", ur: "Urdu", bn: "Bengali", sw: "Swahili", uk: "Ukrainian", el: "Greek", nl: "Dutch", ca: "Catalan", ro: "Romanian", yo: "Yoruba" };
// המדינה שהמשתמשת בחרה בהגדרות (לא ניחוש לפי שפה) - כדי שאם ה-AI צריך להעריך
// מנת רשת בעצמו (לא נמצאה במאגר המקומי), הוא לפחות ידע על איזו גרסה-ארצית
// לחשוב (מתכון/מנה יכולים להיות שונים באמריקה מול ישראל)
const COUNTRY_NAMES: Record<string, string> = { il: "Israel", us: "the United States" };

const ESTIMATE_OR_CLARIFY_TOOL = {
    name: "estimate_or_clarify",
    description: "Either give a final calorie estimate, or ask one clarifying question if the description is genuinely ambiguous about what was eaten or how much.",
    input_schema: {
        type: "object",
        properties: {
            status: { type: "string", enum: ["estimate", "clarify"] },
            calories: { type: "integer", description: "Total estimated calories. Required when status is 'estimate'." },
            question: { type: "string", description: "A short clarifying question, in the user's language. Required when status is 'clarify'." },
        },
        required: ["status"],
    },
};

// זהה לכלי למעלה, אבל בלי "clarify" באפשרויות בכלל - נועד לשיחת ההמשך אחרי
// שהמשתמשת כבר ענתה על שאלת ההבהרה, כדי שלא יהיה סבב שני של שאלות. זו אכיפה
// מבנית (הכלי עצמו לא מאפשר את זה), לא רק הנחיה במילים שה-AI יכול "לשכוח"
const ESTIMATE_ONLY_TOOL = {
    name: "estimate_or_clarify",
    description: "Give a final calorie estimate using the original description plus the clarifying answer given.",
    input_schema: {
        type: "object",
        properties: {
            status: { type: "string", enum: ["estimate"] },
            calories: { type: "integer", description: "Total estimated calories." },
        },
        required: ["status", "calories"],
    },
};

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
        const { text, clarificationQuestion, clarificationAnswer, isLocalClarify, language, country } = body;
        if (!text || !String(text).trim()) return jsonResponse({ error: "missing_text" }, 400);
        const hasAnswer = !!(clarificationQuestion && clarificationAnswer);
        // שני סוגי "יש תשובה לשאלת הבהרה": מה-AI (שכבר שאל וכבר חויב על זה -
        // הקריאה הזו היא קריאת המשך חינמית), או שהשאלה זוהתה מקומית בקוד
        // הלקוח בלי לפנות ל-AI כלל (ר' detectAmbiguousPlantMilk באפליקציה) -
        // במקרה הזה זו עדיין הקריאה הראשונה שמחייבת מכסה, לא קריאת המשך.
        // בשני המקרים כופים על ה-AI לתת מספר סופי בלבד (בלי עוד שאלה)
        const hasAiFollowUp = hasAnswer && !isLocalClarify;
        const useEstimateOnlyTool = hasAnswer;
        const shouldIncrementQuota = !hasAiFollowUp;

        const { data: usageRow } = await supabase
            .from("user_ai_usage")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
        const monthKey = currentMonthKey();
        const foodTextMonthUsed = usageRow?.premium_food_text_month_key === monthKey
            ? (usageRow?.premium_food_text_month_used || 0)
            : 0;
        // המכסה נבדקת תמיד (גם בשיחת ההמשך) כדי לא לאפשר קריאה בלי שער בכלל,
        // אבל רק הקריאה הראשונה (לא שיחת ההמשך) *מגדילה* את המונה - ר' הערה
        // בראש הקובץ. אם המכסה כבר נגמרה, גם שיחת המשך לא תעבור (לא אמור
        // לקרות בפועל - הלקוח לא פותח שיחת המשך בלי שהקריאה הראשונה הצליחה)
        if (foodTextMonthUsed >= FOOD_TEXT_MONTHLY_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "premium_monthly", used: foodTextMonthUsed, limit: FOOD_TEXT_MONTHLY_LIMIT }, 402);
        }

        const languageName = LANGUAGE_NAMES[language] || "English";
        const countryName = COUNTRY_NAMES[country] || "Israel";
        const countryNote = `If this describes a dish from a specific chain restaurant or brand, use the version/recipe/portion size typical for that chain in ${countryName}, since the same chain's dish can differ meaningfully by country.`;
        // הנחיה חוזרת בשתי הקריאות: לפי בקשה מפורשת נוספת - גם כשהמשתמשת כבר
        // ציינה כמות (כמו "רבע כוס"), זה עדיין לא אומר שה-AI יודע אם זו כמות
        // של חלב/תחליף-חלב או של מזון מוצק נפרד - אז זו נשארת שאלת הבהרה
        // *חובה* (לא רק "אם זה נראה מעורפל"), כדי לא לנחש ולפספס כמו קודם
        // (120 קלוריות שיצאו במקום כ-70 לפי גוגל, בלי שהוא שאל בכלל)
        const realismNote = "If an ingredient like oats, almonds, soy, or milk is mentioned alongside a drink (coffee, smoothie, etc.) - even if a quantity like \"a quarter cup\" is already given - you STILL don't know if that quantity is milk/a milk-substitute mixed into the drink versus a separate solid-food serving. Do not silently guess one or the other, and do not treat this as merely optional extra precision - always ask that clarifying question directly (e.g. confirm \"a quarter cup of milk?\" in the user's language) before estimating. Use the correct native/established food terminology in that language (e.g. in Hebrew, oat-milk is \"חלב שיבולת שועל\") - do NOT phonetically transliterate the English term into the other language's alphabet. When a fraction or quantity word is given (quarter, half, a tablespoon, etc.), apply it precisely and literally to your calculation - do not round it up to a full/larger serving or ignore it. More generally, use realistic everyday serving sizes: something that's typically an ingredient inside another item should be treated as that smaller role, not a large standalone portion, unless clearly stated otherwise.";
        const promptText = hasAnswer
            ? `The user described a food/meal: "${text}". You previously asked: "${clarificationQuestion}". Their answer: "${clarificationAnswer}". ${realismNote} ${countryNote} Using all of this, give your best final total calorie estimate now - you must give a number, do not ask anything else. Respond in ${languageName} if the question needed a language, but the tool call itself just needs the number. Use the estimate_or_clarify tool.`
            : `Estimate the total calories for this food/meal description, written by the user in ${languageName}: "${text}". ${realismNote} ${countryNote} If the description is genuinely ambiguous about what was eaten or the quantity (not just imprecise - genuinely unclear), ask ONE short clarifying question in ${languageName} instead of guessing. Otherwise give your best total calorie estimate. Use the estimate_or_clarify tool.`;

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 500,
                // temperature=0: בלי זה, אותה שאלה בדיוק (ואותה תשובת הבהרה
                // בדיוק) יכלה לתת מספר שונה בכל קריאה (ראינו בפועל 120/140/180
                // לאותו קלט) - זה מקטין את השונות האקראית בין קריאות זהות,
                // חשוב במיוחד כשהתשובה היא מספר ולא טקסט יצירתי
                temperature: 0,
                messages: [{ role: "user", content: promptText }],
                tools: [useEstimateOnlyTool ? ESTIMATE_ONLY_TOOL : ESTIMATE_OR_CLARIFY_TOOL],
                tool_choice: { type: "tool", name: "estimate_or_clarify" },
            }),
        });

        if (!anthropicRes.ok) {
            const errText = await anthropicRes.text();
            return jsonResponse({ error: "ai_provider_error", detail: errText }, 502);
        }

        const anthropicJson = await anthropicRes.json();
        const toolUseBlock = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!toolUseBlock) return jsonResponse({ error: "no_extraction" }, 502);
        const result = toolUseBlock.input || {};

        // המכסה עולה רק בקריאה הראשונה בפועל (כולל שיחת-הבהרה מקומית שלא
        // עברה דרך ה-AI קודם) - ר' חישוב shouldIncrementQuota למעלה
        if (shouldIncrementQuota) {
            await supabase.from("user_ai_usage").upsert(
                { user_id: userId, username: userData.user.email, premium_food_text_month_key: monthKey, premium_food_text_month_used: foodTextMonthUsed + 1 },
                { onConflict: "user_id" },
            );
        }

        if (result.status === "clarify" && result.question) {
            return jsonResponse({ ok: true, status: "clarify", question: result.question });
        }
        if (typeof result.calories === "number") {
            return jsonResponse({ ok: true, status: "estimate", calories: Math.round(result.calories) });
        }
        return jsonResponse({ error: "no_extraction" }, 502);
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
