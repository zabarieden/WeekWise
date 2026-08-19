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

const PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT = 60;

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

        const { data: usageRow } = await supabase
            .from("user_ai_usage")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
        // משתמשת שאינה פרימיום מקבלת 5 שימושים חינמיים לכל החיים לפני שהיא
        // נחסמת - מחליף את חסימת ה-402 הגורפת שהייתה כאן קודם
        const SCHEDULE_AI_FREE_LIFETIME_LIMIT = 5;
        const scheduleLifetimeUsed = usageRow?.schedule_ai_lifetime_used || 0;
        if (!isPremium && scheduleLifetimeUsed >= SCHEDULE_AI_FREE_LIFETIME_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "free_lifetime", used: scheduleLifetimeUsed, limit: SCHEDULE_AI_FREE_LIFETIME_LIMIT }, 402);
        }
        const monthKey = currentMonthKey();
        const scheduleMonthUsed = usageRow?.premium_schedule_ai_month_key === monthKey
            ? (usageRow?.premium_schedule_ai_month_used || 0)
            : 0;
        if (isPremium && scheduleMonthUsed >= PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "premium_monthly", used: scheduleMonthUsed, limit: PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT }, 402);
        }

        const body = await req.json();
        const text: string = body?.text;
        const today: string | undefined = body?.today;
        const existingItems: any[] = Array.isArray(body?.existingItems) ? body.existingItems : [];
        if (!text || !text.trim()) return jsonResponse({ error: "missing_text" }, 400);

        // רשימת הפריטים הקיימים (נטענת ונשלחת מהלקוח, ר' fetchExistingScheduleItems
        // ב-app.js) - כדי שה-AI יוכל לזהות "תשני את X"/"תמחקי את Y" כהתייחסות
        // לפריט קיים (ומחזיר intent:'update'/'delete' + target_id/target_table)
        // במקום ליצור עוד אחד בשקט, בדיוק הבאג שדווח בפועל (כפילות "20:17 זום"/
        // "20:20 הזום"). ריק כשאין פריטים קיימים - הפרומפט עדיין תקין, פשוט בלי
        // הקשר-עריכה בכלל
        const existingItemsContext = existingItems.length
            ? "\n\nThe user's EXISTING schedule items right now (for reference, so you can detect edit/delete intent):\n" +
              existingItems.map((it) => {
                  const when = it.table === "weekly_schedule" ? `every ${it.day_of_week}` : `on ${it.event_date}`;
                  const timeStr = it.time ? ` at ${it.time}` : "";
                  return `- id="${it.id}" table="${it.table}": "${it.title}" (${when}${timeStr})`;
              }).join("\n")
            : "";

        // הקשר של "היום" נדרש כדי שה-AI יוכל לחשב תאריך מדויק לאירועים חד-
        // פעמיים ("שבוע הבא ביום שני" הוא תאריך אחר לגמרי תלוי מתי זה נשלח) -
        // בלעדיו אין דרך אמינה לחשב "שבוע הבא" בלי לנחש. גם שם היום-בשבוע
        // מחושב כאן בקוד דטרמיניסטי (לא סומכים על ה-AI לחשב את זה בעצמו) -
        // כך ה-AI רק צריך "לספור קדימה" מיום ידוע, לא לגזור אותו בעצמו
        const todayContext = today
            ? `Today's date is ${today} (a ${DAY_NAMES[new Date(`${today}T00:00:00`).getDay()]}).`
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
                max_tokens: 1500,
                messages: [
                    {
                        role: "user",
                        content:
                            "The user described upcoming plans below, in any language. Extract every distinct event " +
                            "(one entry per day+activity combination - if an activity happens on multiple days, " +
                            "create a separate entry for each day). Use 24-hour HH:MM time format. Day names must be " +
                            "in English exactly as Sunday, Monday, Tuesday, Wednesday, Thursday, Friday, or Saturday. " +
                            "Do not invent events that weren't mentioned - if only one day/date is stated, output " +
                            "exactly one event for it, never an extra copy on a different day 'just in case'.\n\n" +
                            "A phrase like \"after homework\"/\"אחרי שיעורי הבית\", \"after work\", \"once I'm done " +
                            "with X\" describes WHEN LATER TODAY (or on whatever single day was stated) the task " +
                            "happens - it is NOT a reference to the next day/tomorrow. Never create a second event on " +
                            "the following day for phrasing like this unless the user separately and explicitly also " +
                            "named another day or date.\n\n" +
                            "For EACH event, decide whether it is RECURRING (an ongoing weekly commitment with no " +
                            "specific single date - e.g. \"on Mondays\", \"every Tuesday\", \"I go to the gym on " +
                            "Sundays\") or a ONE-TIME occurrence (any specific single date is implied, however " +
                            "phrased - e.g. \"next week\", \"next Monday\", \"tomorrow\", \"this Friday\", an " +
                            "explicit date). Any mention of a relative timeframe like \"next week\" ALWAYS means " +
                            "recurring=false - never mark something recurring just because a day name was said, if a " +
                            "timeframe word was also there.\n\n" +
                            "If a RECURRING event also has an explicit bounded duration (e.g. \"for 2 months\", " +
                            "\"for the next 3 months\", \"לחודשיים הקרובים\", \"לשלושה חודשים\") - meaning it should " +
                            "stop repeating after that period rather than continue forever - set " +
                            "recurring_duration_months to that number of months. Leave it null when recurring is an " +
                            "open-ended ongoing routine with no mentioned end point (the common case), and always " +
                            "null when recurring=false.\n\n" +
                            "\"Every day\"/\"every day of the week\" (Hebrew: \"כל יום\", \"כל יום בשבוע\") means " +
                            "create one recurring event per weekday (7 entries, one per day_of_week) with the same " +
                            "time/title/duration - never a single event with no day_of_week or a made-up day.\n\n" +
                            "task_title MUST be just the plain activity name and MUST NEVER contain timing/date " +
                            "words (\"next week\", \"tomorrow\", \"on Mondays\", etc.) - those belong only in the " +
                            "recurring/event_date fields, never in the title text itself. Only remove day/date/time " +
                            "words from the title - do NOT otherwise summarize, shorten, or reduce it to a single " +
                            "word. Keep every other word the user actually wrote about the activity itself, in the " +
                            "same language and phrasing they used (e.g. \"עוד דק על הקלידים\" -> task_title=\"עוד " +
                            "דק על הקלידים\", NOT just \"קלידים\").\n\n" +
                            "Example: today is Wednesday 2026-07-22. Input: \"next week on Monday add a guitar " +
                            "lesson\". Correct output: one event, day_of_week=Monday, recurring=false, " +
                            "event_date=2026-07-27 (Monday of the week AFTER the current week - not this week's " +
                            "Monday, which already passed), task_title=\"Guitar lesson\" (NOT \"next week guitar " +
                            "lesson\").\n\n" +
                            todayContext + " For ONE-TIME events only, compute the exact event_date in YYYY-MM-DD " +
                            "format. For RECURRING events, event_date must be null. If no time was mentioned for a " +
                            "ONE-TIME event, set time to null - never guess or default to 00:00. RECURRING events " +
                            "almost always have a time mentioned; only set time to null there too if truly none was " +
                            "given.\n\n" +
                            "Decide the INTENT of each event: \"create\" (the default - describing something new " +
                            "that doesn't already exist), \"update\" (the user wants to change an existing item - " +
                            "phrasing like \"change/move/reschedule/rename X\", \"X is now at...\", \"instead of X " +
                            "do Y\"), or \"delete\" (phrasing like \"cancel/remove/delete X\"). When intent is " +
                            "\"update\" or \"delete\", look at the EXISTING ITEMS list below (if any) and try to " +
                            "identify which single existing item the user means, by title/day/time similarity - set " +
                            "target_id to that item's exact id string (copy it exactly, never invent one) and " +
                            "target_table to its table. If confident about exactly one match, also fill in the " +
                            "OTHER fields (day_of_week/time/task_title/event_date) with the FULL FINAL desired " +
                            "state of that item after the change - not just the field that changed (e.g. if only " +
                            "the time is changing, still include that item's existing title and day/date " +
                            "unchanged, taken from the existing items list). If more than one existing item " +
                            "plausibly matches, or none match confidently enough, set needsMatchClarification to " +
                            "true and matchCandidateIds to the array of the 2-4 most likely candidate ids instead " +
                            "of guessing - never guess a target when unsure. If there are no existing items at all, " +
                            "or intent is \"create\", leave intent as \"create\", target_id/target_table null, and " +
                            "needsMatchClarification false." +
                            existingItemsContext +
                            "\n\nText: " + text,
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
                                            time: { type: ["string", "null"], description: "24-hour HH:MM format, or null if no time was mentioned - never guess" },
                                            task_title: { type: "string" },
                                            recurring: { type: "boolean", description: "true = repeats every week, false = a specific one-time occurrence" },
                                            event_date: { type: ["string", "null"], description: "YYYY-MM-DD - required when recurring is false, null when recurring is true" },
                                            recurring_duration_months: { type: ["number", "null"], description: "Only set when recurring=true AND an explicit end point/duration was mentioned (e.g. 'for 2 months'). Null for open-ended recurring routines and always null when recurring=false." },
                                            intent: { type: "string", enum: ["create", "update", "delete"], description: "'create' (default) for a brand-new item, 'update' to change an existing item, 'delete' to remove one - see existing items list in the prompt" },
                                            target_id: { type: ["string", "null"], description: "The exact id of the existing item being updated/deleted, copied from the existing items list - null for intent='create'" },
                                            target_table: { type: ["string", "null"], enum: ["weekly_schedule", "calendar_events", null], description: "Which table target_id belongs to - null for intent='create'" },
                                            needsMatchClarification: { type: "boolean", description: "true when intent is update/delete but you're not confident which single existing item is meant - never guess, ask instead" },
                                            matchCandidateIds: { type: "array", items: { type: "string" }, description: "2-4 most likely existing item ids, only when needsMatchClarification is true" },
                                        },
                                        required: ["day_of_week", "time", "task_title", "recurring", "event_date", "recurring_duration_months", "intent", "target_id", "target_table", "needsMatchClarification"],
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

        if (isPremium) {
            await supabase.from("user_ai_usage").upsert(
                { user_id: userId, username: userData.user.email, premium_schedule_ai_month_key: monthKey, premium_schedule_ai_month_used: scheduleMonthUsed + 1 },
                { onConflict: "user_id" },
            );
        } else {
            await supabase.from("user_ai_usage").upsert(
                { user_id: userId, username: userData.user.email, schedule_ai_lifetime_used: scheduleLifetimeUsed + 1 },
                { onConflict: "user_id" },
            );
        }

        // רשת ביטחון נגד כפילויות: המודל לפעמים מחזיר את אותו אירוע פעמיים
        // (למשל אם המשתמשת ניסחה אותו רעיון בשתי דרכים בטקסט אחד) - מסננים
        // כפילויות מדויקות (אותו יום+שעה+כותרת+recurring+תאריך) לפני ההחזרה
        const rawEvents: any[] = toolUseBlock.input.events || [];
        const seen = new Set<string>();
        const events = rawEvents.filter((ev) => {
            const key = `${ev.day_of_week}|${ev.time}|${ev.task_title}|${ev.recurring}|${ev.event_date}|${ev.recurring_duration_months}|${ev.intent}|${ev.target_id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return jsonResponse({ ok: true, events });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
