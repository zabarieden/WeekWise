// Supabase Edge Function: split-task-ai
//
// Premium-only feature ("Smart Split" / "פריסה חכמה"): accepts a free-text task
// description, a due date, and the user's answer to "which days are you more free
// until then?", and uses a real AI model to break the task into daily chunks spread
// across the days between today and the due date (the due date itself is excluded -
// the last chunk always lands on the day before it's due). The frontend inserts the
// returned chunks straight into calendar_events as ordinary one-time events, editable/
// deletable through the same UI as any other calendar entry.
//
// Unlike parse-schedule-request, this only ever makes ONE AI call per split (the
// client collects the task text AND the free-days answer from the user BEFORE calling
// this function at all - there's no server-side clarification round-trip).
//
// Usage limit: a monthly quota of PREMIUM_SMART_SPLIT_MONTHLY_LIMIT requests
// (premium_smart_split_month_used/_key in user_ai_usage), kept separate from every
// other AI quota in this table since this is a distinct, newer feature and we want to
// be able to tune its limit independently. See DEPLOY.md in this folder for the
// required migration.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// כדאי לבדוק שהמודל הזה עדיין נתמך/מומלץ לפני הפריסה:
// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const PREMIUM_SMART_SPLIT_MONTHLY_LIMIT = 5;

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

// הימים הפנויים לפיצול: מתחילים ממחר (לא מהיום עצמו - היום משמש להגדרת
// המשימה, לא לביצוע שלה) ומסתיימים יום *לפני* תאריך היעד (תאריך היעד עצמו
// אף פעם לא מקבל חלק - המשימה אמורה להיות גמורה עד אליו). אם הטווח הזה ריק
// (תאריך היעד הוא כבר מחר), נופלים חזרה למחר כיום היחיד הזמין - אין ברירה
// אחרת שעדיין לפני מועד היעד
function computeCandidateDates(todayStr: string, dueDateStr: string): string[] {
    const dates: string[] = [];
    const cursor = new Date(`${todayStr}T00:00:00`);
    cursor.setDate(cursor.getDate() + 1);
    const due = new Date(`${dueDateStr}T00:00:00`);
    while (cursor < due) {
        dates.push(cursor.toISOString().slice(0, 10));
        cursor.setDate(cursor.getDate() + 1);
    }
    if (!dates.length) {
        const tomorrow = new Date(`${todayStr}T00:00:00`);
        tomorrow.setDate(tomorrow.getDate() + 1);
        dates.push(tomorrow.toISOString().slice(0, 10));
    }
    return dates;
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
        const splitMonthUsed = usageRow?.premium_smart_split_month_key === monthKey
            ? (usageRow?.premium_smart_split_month_used || 0)
            : 0;
        if (splitMonthUsed >= PREMIUM_SMART_SPLIT_MONTHLY_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "premium_monthly", used: splitMonthUsed, limit: PREMIUM_SMART_SPLIT_MONTHLY_LIMIT }, 402);
        }

        const body = await req.json();
        const text: string = body?.text;
        const dueDate: string = body?.dueDate;
        const today: string = body?.today;
        const freeDaysAnswer: string = body?.freeDaysAnswer || "";
        if (!text || !text.trim()) return jsonResponse({ error: "missing_text" }, 400);
        if (!dueDate || !today) return jsonResponse({ error: "missing_dates" }, 400);

        const candidateDates = computeCandidateDates(today, dueDate);

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
                            "The user needs to finish the following task by " + dueDate + " (that date itself is NOT " +
                            "available for work - the task must be complete by the day before it):\n\n" +
                            "\"" + text + "\"\n\n" +
                            "Today is " + today + ". The candidate dates available to work on it are exactly: " +
                            candidateDates.join(", ") + ".\n\n" +
                            "The user was asked which of these days they're more free on, and answered: \"" +
                            (freeDaysAnswer || "(no answer given)") + "\". Use this to decide which of the candidate " +
                            "dates should actually be used - skip/reduce days the user says they're busy or " +
                            "unavailable on, and favor the ones they say are free. If the answer gives no useful " +
                            "signal (empty, or something like \"all of them\"/\"כל הימים\"), just spread evenly " +
                            "across all candidate dates.\n\n" +
                            "Split the task's content into logical daily chunks, one per chosen date, in a sensible " +
                            "order (if the task lists distinct sub-items, keep their original order; if it's a single " +
                            "unit of work like reading pages or practicing, divide it proportionally). Never invent " +
                            "content that wasn't implied by the task description. Each chunk's task_title must be " +
                            "short and written in the SAME language as the task description - just the plain content " +
                            "for that day (e.g. the sub-item name, or 'pages 10-20'), with NO part counter, numbering, " +
                            "or bracket prefix of any kind. Every event_date you return MUST be one of the exact " +
                            "candidate dates listed above - never invent a different date. Use at least one chunk; " +
                            "it's fine to use only some of the candidate dates (skip busy ones) but never fewer than " +
                            "what's needed to cover the whole task.",
                    },
                ],
                tools: [
                    {
                        name: "split_task_into_days",
                        description: "Split a task into daily chunks distributed across the given candidate dates.",
                        input_schema: {
                            type: "object",
                            properties: {
                                chunks: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            event_date: { type: "string", description: "YYYY-MM-DD, must be one of the provided candidate dates" },
                                            task_title: { type: "string", description: "Short plain label for this day's portion, in the same language as the task - no part counter, numbering, or bracket prefix" },
                                        },
                                        required: ["event_date", "task_title"],
                                    },
                                },
                            },
                            required: ["chunks"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "split_task_into_days" },
            }),
        });

        if (!anthropicRes.ok) {
            const errText = await anthropicRes.text();
            return jsonResponse({ error: "ai_provider_error", detail: errText }, 502);
        }

        const anthropicJson = await anthropicRes.json();
        const toolUseBlock = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!toolUseBlock) return jsonResponse({ error: "no_extraction" }, 502);

        // רשת ביטחון: כל event_date חייב להיות אחד מהתאריכים המועמדים שסופקו -
        // מסננים כל חלק עם תאריך שה-AI המציא בטעות במקום להשתמש ברשימה שניתנה לו
        const candidateSet = new Set(candidateDates);
        const rawChunks: any[] = toolUseBlock.input.chunks || [];
        const chunks = rawChunks.filter((c) => candidateSet.has(c.event_date));
        if (!chunks.length) return jsonResponse({ error: "no_extraction" }, 502);

        await supabase.from("user_ai_usage").upsert(
            { user_id: userId, username: userData.user.email, premium_smart_split_month_key: monthKey, premium_smart_split_month_used: splitMonthUsed + 1 },
            { onConflict: "user_id" },
        );

        return jsonResponse({ ok: true, chunks });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
