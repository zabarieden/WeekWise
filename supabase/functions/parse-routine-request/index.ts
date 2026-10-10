// Supabase Edge Function: parse-routine-request
//
// "השגרה שלי" → ✨ שגרה חדשה עם AI (לפי בקשה מפורשת, 2026-10-09: "בהגדרות לו"ז של AI, והוא מוסיף
// ערכה חדשה לפי בקשתך - שהמשתמש לא יצטרך להוסיף באופן ידני"). מקבל תיאור חופשי של שגרה, בכל שפה,
// ומחזיר טאב אחד או יותר: שם קצר, ימים (0 = ראשון) ופריטים בין 05:00 ל-23:59, בשעה המדויקת שנכתבה
// (לפי בקשה מפורשת, 2026-10-10: "אם רושמים שעה מסויימת שירשום את השעה ולא שעה עגולה" - 16:10 נשאר 16:10).
// כל פריט חוזר עם time ("HH:MM") וגם hour (השעה העגולה - לגרסאות ישנות של האפליקציה שעוד פתוחות).
// משמש גם את "ימי חופש → לספר ל-AI" (שם הימים כבר נבחרו).
//
// אותה מכסה כמו לו"ז ה-AI (parse-schedule-request, אותן עמודות ב-user_ai_usage): 5 שימושים חינם
// לכל החיים, ו-60 בחודש לפרימיום. פריסה: supabase functions deploy parse-routine-request

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// כמו בשאר ה-Edge Functions של האפליקציה
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT = 60;
const SCHEDULE_AI_FREE_LIFETIME_LIMIT = 5;
const MAX_TEXT = 2000;
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// עוקף בדיקת פרימיום למפתחת בלבד - זהה לרשימה בצד הלקוח ובשאר ה-Edge Functions
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

type Item = { time: string; hour: number; title: string };

// "16:10" / "8:05" / "16" → "16:10" / "08:05" / "16:00"; מחוץ ל-05:00–23:59 → null
function cleanTime(it: any): string | null {
    const m = String(it?.time ?? "").trim().match(/^(\d{1,2})(?::(\d{2}))?$/);
    let h: number, min: number;
    if (m) { h = Number(m[1]); min = Number(m[2] || 0); }
    else { h = Math.round(Number(it?.hour)); min = 0; }
    if (!Number.isInteger(h) || !Number.isInteger(min) || h < 5 || h > 23 || min < 0 || min > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

// מה שחוזר מהמודל עובר ניקוי: ימים 0–6 בלי כפילויות, פריט אחד לכל שעה מדויקת (05:00–23:59), כותרות קצרות
function cleanTabs(raw: any[], forcedDays: number[] | null) {
    const tabs: { name: string; weekdays: number[]; items: Item[] }[] = [];
    for (const tab of (Array.isArray(raw) ? raw : []).slice(0, 7)) {
        const name = String(tab?.name || "").trim().slice(0, 40);
        const weekdays = forcedDays ?? [...new Set((Array.isArray(tab?.weekdays) ? tab.weekdays : [])
            .map((d: unknown) => Number(d)).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b);
        const seen = new Set<string>();
        const items: Item[] = [];
        for (const it of Array.isArray(tab?.items) ? tab.items : []) {
            const time = cleanTime(it);
            const title = String(it?.title || "").trim().slice(0, 80);
            if (!title || !time || seen.has(time)) continue;
            seen.add(time);
            items.push({ time, hour: Number(time.slice(0, 2)) + (Number(time.slice(3)) >= 30 && Number(time.slice(0, 2)) < 23 ? 1 : 0), title });
        }
        items.sort((a, b) => a.time.localeCompare(b.time));
        if (items.length) tabs.push({ name, weekdays, items });
        if (forcedDays) break;
    }
    return tabs;
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

        const { data: premiumRow } = await supabase.from("user_premium").select("is_premium").eq("user_id", userId).maybeSingle();
        const isPremium = DEV_SUPERUSER_EMAILS.includes(userEmail) || !!premiumRow?.is_premium;

        const { data: usageRow } = await supabase.from("user_ai_usage").select("*").eq("user_id", userId).maybeSingle();
        const lifetimeUsed = usageRow?.schedule_ai_lifetime_used || 0;
        if (!isPremium && lifetimeUsed >= SCHEDULE_AI_FREE_LIFETIME_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "free_lifetime", used: lifetimeUsed, limit: SCHEDULE_AI_FREE_LIFETIME_LIMIT }, 402);
        }
        const monthKey = currentMonthKey();
        const monthUsed = usageRow?.premium_schedule_ai_month_key === monthKey ? (usageRow?.premium_schedule_ai_month_used || 0) : 0;
        if (isPremium && monthUsed >= PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "premium_monthly", used: monthUsed, limit: PREMIUM_SCHEDULE_AI_MONTHLY_LIMIT }, 402);
        }

        const body = await req.json();
        const text = String(body?.text || "").trim().slice(0, MAX_TEXT);
        if (!text) return jsonResponse({ error: "missing_text" }, 400);
        const lang = String(body?.lang || "").slice(0, 5);
        const forcedDays = Array.isArray(body?.weekdays) && body.weekdays.length
            ? [...new Set(body.weekdays.map((d: unknown) => Number(d)).filter((d: number) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a: number, b: number) => a - b)
            : null;

        const daysLine = forcedDays
            ? `The user already chose the days for this routine: ${forcedDays.map((d) => DAY_NAMES[d]).join(", ")}. Return exactly ONE tab, and use these days for it.`
            : "If the text says which days a routine is for, set weekdays to those days. In Hebrew or Arabic, work days are usually Sunday–Thursday and the weekend Friday–Saturday; otherwise Monday–Friday and Saturday–Sunday. If no days are mentioned at all, return an empty weekdays list. If the text clearly describes different routines for different days (e.g. work days and the weekend), return one tab per routine, each with its own days.";

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 2000,
                messages: [{
                    role: "user",
                    content:
                        "The user describes a routine (a typical day) in their own words, in any language. Turn it into routine tabs " +
                        "for a daily planner (05:00 to 23:59).\n\n" +
                        "- Give each tab a short name (2–4 words) in the user's language, with no emoji" +
                        (lang ? ` (the app language is "${lang}")` : "") + ".\n" +
                        "- " + daysLine + " Days are numbers: 0 = Sunday, 1 = Monday … 6 = Saturday.\n" +
                        "- items: one item per activity, with its time as \"HH:MM\" on a 24-hour clock. Keep the EXACT time the user " +
                        "wrote - never round it: \"16:10\" stays \"16:10\", \"17:30\" stays \"17:30\", \"wake up at 8\" is \"08:00\". " +
                        "Times like \"at 4\" or \"at 7\" without am/pm are read the way people mean them in a daily routine. " +
                        "If two activities have the same time, combine them into one short title (\"Shower + breakfast\") instead " +
                        "of dropping one. Leave out anything between midnight and 05:00.\n" +
                        "- An activity that spans a range (\"work 9–17\") goes at its start time; keep the end in the title only when " +
                        "it helps (\"Work until 17:00\").\n" +
                        "- Titles are short and keep the user's own language and wording. Never invent activities that weren't " +
                        "mentioned, and never add reminders or notes as separate items.\n\n" +
                        "Text: " + text,
                }],
                tools: [{
                    name: "create_routine",
                    description: "Create routine tabs (name, days, items at the exact times written) from the user's description.",
                    input_schema: {
                        type: "object",
                        properties: {
                            tabs: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string" },
                                        weekdays: { type: "array", items: { type: "integer", minimum: 0, maximum: 6 } },
                                        items: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    time: { type: "string", description: "HH:MM, 24-hour clock, exactly as the user wrote it" },
                                                    title: { type: "string" },
                                                },
                                                required: ["time", "title"],
                                            },
                                        },
                                    },
                                    required: ["name", "weekdays", "items"],
                                },
                            },
                        },
                        required: ["tabs"],
                    },
                }],
                tool_choice: { type: "tool", name: "create_routine" },
            }),
        });

        if (!anthropicRes.ok) return jsonResponse({ error: "ai_provider_error", detail: await anthropicRes.text() }, 502);
        const anthropicJson = await anthropicRes.json();
        const toolUse = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!toolUse) return jsonResponse({ error: "no_extraction" }, 502);

        await supabase.from("user_ai_usage").upsert(
            isPremium
                ? { user_id: userId, username: userData.user.email, premium_schedule_ai_month_key: monthKey, premium_schedule_ai_month_used: monthUsed + 1 }
                : { user_id: userId, username: userData.user.email, schedule_ai_lifetime_used: lifetimeUsed + 1 },
            { onConflict: "user_id" },
        );

        const tabs = cleanTabs(toolUse.input?.tabs, forcedDays);
        if (!tabs.length) return jsonResponse({ error: "no_items" }, 422);
        return jsonResponse({ ok: true, tabs });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
