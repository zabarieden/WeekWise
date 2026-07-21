// Supabase Edge Function: delete-account
//
// Permanently deletes the logged-in user's data across every table the app writes
// to, then deletes the Supabase Auth account itself. Runs server-side (service role)
// because deleting another user's auth record (even your own, via the admin API)
// requires the service role key - it can never be done from the client.
//
// Deploy this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// כל טבלה שהאפליקציה כותבת אליה (app.js, לפי המחרוזות שמועברות ל-.from(...)) -
// כולן עם עמודת user_id. אם תוסיפי טבלה חדשה שקושרת מידע למשתמש בעתיד,
// תוסיפי אותה גם כאן, אחרת השורות שלה יישארו "יתומות" אחרי מחיקת החשבון
const USER_SCOPED_TABLES = [
    "budget_tracker",
    "calendar_events",
    "calorie_tracker",
    "meal_presets",
    "monthly_goals",
    "my_center_tasks",
    "push_subscriptions",
    "recipes",
    "step_tracker",
    "user_ai_usage",
    "user_premium",
    "weekly_progress_targets",
    "weekly_schedule",
    "weight_tracker",
];

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
        // מזהים את המשתמשת מה-JWT שלה עצמה - כל שורה שנמחקת היא רק שלה, לא
        // ניתן להעביר user_id אחר מהלקוח כי אין לו שום השפעה כאן
        const authHeader = req.headers.get("Authorization") || "";
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userId = userData.user.id;

        for (const table of USER_SCOPED_TABLES) {
            const { error } = await supabase.from(table).delete().eq("user_id", userId);
            if (error) {
                return jsonResponse({ error: "delete_failed", table, detail: error.message }, 500);
            }
        }

        const { error: deleteUserError } = await supabase.auth.admin.deleteUser(userId);
        if (deleteUserError) {
            return jsonResponse({ error: "auth_delete_failed", detail: deleteUserError.message }, 500);
        }

        return jsonResponse({ ok: true });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
