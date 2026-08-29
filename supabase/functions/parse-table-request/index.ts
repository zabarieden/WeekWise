// Supabase Edge Function: parse-table-request
//
// AI-assisted "Tables" builder: accepts a short free-text description (e.g.
// "מעקב אחרי שוק ההון שלי") and uses Claude to design a starter table -
// name, icon, and up to 12 columns (text/number/select/date/checkbox, with
// colored options for select). Deliberately does NOT generate example rows
// - reported in practice ("מילא לי הכל בסתם דברים... אני אמורה למלא"):
// users want the AI to build the structure, then fill in their own real
// data themselves, not review/discard a table full of invented rows. The
// frontend NEVER writes this straight to the DB - it stages the result into
// the exact same modal-add-table -> modal-manage-columns editable flow used
// for manual table creation (see openColumnManagerForAiReview in app.js),
// so a wrong AI guess is exactly as cheap to fix as a manual mistake.
//
// Gated like every other AI feature here: 5 free lifetime uses for non-
// premium (table_ai_lifetime_used), a monthly quota for premium
// (premium_table_ai_month_key/_used) - see DEPLOY.md. No local fallback on
// failure/limit (there's no sensible non-AI substitute for table design) -
// the client just toasts and leaves the typed text in place to retry.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// כדאי לבדוק שהמודל הזה עדיין נתמך/מומלץ לפני הפריסה:
// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const TABLE_AI_FREE_LIFETIME_LIMIT = 5;
const PREMIUM_TABLE_AI_MONTHLY_LIMIT = 40;

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
        const tableAiLifetimeUsed = usageRow?.table_ai_lifetime_used || 0;
        if (!isPremium && tableAiLifetimeUsed >= TABLE_AI_FREE_LIFETIME_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "free_lifetime", used: tableAiLifetimeUsed, limit: TABLE_AI_FREE_LIFETIME_LIMIT }, 402);
        }
        const monthKey = currentMonthKey();
        const tableAiMonthUsed = usageRow?.premium_table_ai_month_key === monthKey
            ? (usageRow?.premium_table_ai_month_used || 0)
            : 0;
        if (isPremium && tableAiMonthUsed >= PREMIUM_TABLE_AI_MONTHLY_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "premium_monthly", used: tableAiMonthUsed, limit: PREMIUM_TABLE_AI_MONTHLY_LIMIT }, 402);
        }

        const body = await req.json();
        const description: string = body?.description;
        if (!description || !description.trim()) return jsonResponse({ error: "missing_description" }, 400);

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 3000,
                messages: [
                    {
                        role: "user",
                        content:
                            "Design a starter table (like a Notion database) from the short description below, in any " +
                            "language. There are exactly 5 available column types: 'text' (free-form short text), " +
                            "'number' (quantities/prices/scores/ages/amounts), 'select' (use ONLY when the concept " +
                            "naturally has a small closed set of repeating states/categories - status, priority, a " +
                            "tag-like grouping - never for unbounded free text), 'date' (deadlines/purchase dates/" +
                            "birthdays/any calendar date), and 'checkbox' (a single yes/no flag - done, paid, active, " +
                            "favorite).\n\n" +
                            "Choose the smallest number of columns that meaningfully captures the domain - typically " +
                            "3-8, up to 12 only if the description clearly calls for more detail. If the user's " +
                            "description mentions specific columns or an order (e.g. \"date first\", \"with a price " +
                            "and a status\"), follow that exactly - respect explicit instructions about which columns " +
                            "to include and their order over your own default judgment. Otherwise use your own best " +
                            "real-world judgment for a common table of that general kind - no clarifying question is " +
                            "possible, never hedge with empty/generic output.\n\n" +
                            "Design ONLY the table's structure - do not invent any example/starter rows or sample " +
                            "data. The user will add their own real rows themselves after the table is created.\n\n" +
                            "CRITICAL: respond in the exact same language the user wrote their description in - the " +
                            "table name, every column name, and every select option label must all be in that " +
                            "language. Never translate to English unless the description itself was in English.\n\n" +
                            "Description: " + description,
                    },
                ],
                tools: [
                    {
                        name: "build_starter_table",
                        description: "Design a starter table's structure (name, icon, columns) from a short free-text description - no example rows.",
                        input_schema: {
                            type: "object",
                            properties: {
                                table_name: { type: "string", description: "Short table title, in the same language as the description." },
                                table_icon: { type: "string", description: "A single emoji that best represents the table's subject, nothing else." },
                                columns: {
                                    type: "array",
                                    minItems: 1,
                                    maxItems: 12,
                                    items: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string", description: "Column header, same language as the description." },
                                            type: { type: "string", enum: ["text", "number", "select", "date", "checkbox"] },
                                            select_options: {
                                                type: ["array", "null"],
                                                description: "Required, 2-6 short options, when type='select'. Must be null for every other type.",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        label: { type: "string" },
                                                        color: { type: "string", enum: ["red", "yellow", "green", "cyan", "blue", "purple", "pink"], description: "Pick a color matching the option's meaning (e.g. green for a positive/done/bought state, red for urgent/negative)." },
                                                    },
                                                    required: ["label", "color"],
                                                },
                                            },
                                        },
                                        required: ["name", "type", "select_options"],
                                    },
                                },
                            },
                            required: ["table_name", "table_icon", "columns"],
                        },
                    },
                ],
                tool_choice: { type: "tool", name: "build_starter_table" },
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
                { user_id: userId, username: userData.user.email, premium_table_ai_month_key: monthKey, premium_table_ai_month_used: tableAiMonthUsed + 1 },
                { onConflict: "user_id" },
            );
        } else {
            await supabase.from("user_ai_usage").upsert(
                { user_id: userId, username: userData.user.email, table_ai_lifetime_used: tableAiLifetimeUsed + 1 },
                { onConflict: "user_id" },
            );
        }

        return jsonResponse({ ok: true, table: toolUseBlock.input });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
