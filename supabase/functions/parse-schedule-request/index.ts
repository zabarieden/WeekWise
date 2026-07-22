// Supabase Edge Function: parse-schedule-request
//
// Premium-only feature: accepts a free-text description of someone's recurring weekly
// plans (e.g. "I train at the gym on Mondays and Wednesdays at 8:00, and go to hip-hop
// class on Tuesdays at 19:00") and uses a real AI model to extract every distinct
// recurring event as {day_of_week, time, task_title}. The frontend then finds an open
// slot (or adds a new row) for each one in the existing weekly_schedule accordion.
//
// Unlike the recipe scanner/text parser, this is gated on user_premium.is_premium alone -
// there's no free-tier fallback count, since the whole feature is a premium perk.
//
// Usage limit: a monthly quota of PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT requests
// (premium_schedule_ai_month_used/_key in user_ai_usage), separate from the image-scan
// pool since a text-only request costs roughly 10x less than a vision request. Same
// reasoning as the other AI Edge Functions - see DEPLOY.md.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// כדאי לבדוק שהמודל הזה עדיין נתמך/מומלץ לפני הפריסה:
// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT = 200;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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
        if (!isPremium) return jsonResponse({ error: "premium_required" }, 402);

        const { data: usageRow } = await supabase
            .from("user_ai_usage")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
        const monthKey = currentMonthKey();
        const scheduleMonthUsed = usageRow?.premium_schedule_ai_month_key === monthKey
            ? (usageRow?.premium_schedule_ai_month_used || 0)
            : 0;
        if (scheduleMonthUsed >= PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "premium_monthly", used: scheduleMonthUsed, limit: PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT }, 402);
        }

        const body = await req.json();
        const text: string = body?.text;
        const today: string | undefined = body?.today;
        if (!text || !text.trim()) return jsonResponse({ error: "missing_text" }, 400);

        // הקשר של "היום" נדרש כדי שה-AI יוכל לחשב תאריך מדויק לאירועים חד-
        // פעמיים ("שבוע הבא ביום שני" הוא תאריך אחר לגמרי תלוי מתי זה נשלח) -
        // בלעדיו אין דרך אמינה לחשב "שבוע הבא" בלי לנחש
        const todayContext = today ? `Today's date is ${today}.` : "";

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
                        content:
                            "The user described upcoming plans below, in any language. Extract every distinct event " +
                            "(one entry per day+activity combination - if an activity happens on multiple days, " +
                            "create a separate entry for each day). Use 24-hour HH:MM time format. Day names must be " +
                            "in English exactly as Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, or Saturday. " +
                            "Keep task titles short and in the same language the user wrote in. Do not invent events " +
                            "that weren't mentioned.\n\n" +
                            "For EACH event, decide whether it is RECURRING (an ongoing weekly commitment - e.g. " +
                            "\"on Mondays\", \"every Tuesday\", \"I go to the gym on Sundays\", no specific single " +
                            "date implied) or a ONE-TIME occurrence (a specific single date is implied - e.g. \"next " +
                            "week\", \"next Monday\", \"tomorrow\", \"this Friday\", an explicit date). Set " +
                            "`recurring` accordingly. " + todayContext + " For ONE-TIME events only, compute the " +
                            "exact calendar date it falls on and set `event_date` in YYYY-MM-DD format (use the day " +
                            "name + today's date to work out the correct date - e.g. \"next week Monday\" means the " +
                            "Monday of the week AFTER the current week, not this week even if today is before " +
                            "Monday). For RECURRING events, event_date must be null.\n\nText: " + text,
                    },
                ],
                tools: [
                    {
                        name: "extract_schedule_events",
                        description: "Extract schedule events (recurring or one-time) from natural language.",
                        input_schema: {
                            type: "object",
                            properties: {
                                events: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            day_of_week: { type: "string", enum: DAY_NAMES },
                                            time: { type: "string", description: "24-hour HH:MM format" },
                                            task_title: { type: "string" },
                                            recurring: { type: "boolean", description: "true = repeats every week, false = a specific one-time occurrence" },
                                            event_date: { type: ["string", "null"], description: "YYYY-MM-DD - required when recurring is false, null when recurring is true" },
                                        },
                                        required: ["day_of_week", "time", "task_title", "recurring", "event_date"],
                                    },
                                },
                            },
                            required: ["events"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "extract_schedule_events" },
            }),
        });

        if (!anthropicRes.ok) {
            const errText = await anthropicRes.text();
            return jsonResponse({ error: "ai_provider_error", detail: errText }, 502);
        }

        const anthropicJson = await anthropicRes.json();
        const toolUseBlock = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!toolUseBlock) return jsonResponse({ error: "no_extraction" }, 502);

        await supabase.from("user_ai_usage").upsert(
            { user_id: userId, username: userData.user.email, premium_schedule_ai_month_key: monthKey, premium_schedule_ai_month_used: scheduleMonthUsed + 1 },
            { onConflict: "user_id" },
        );

        return jsonResponse({ ok: true, events: toolUseBlock.input.events || [] });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
