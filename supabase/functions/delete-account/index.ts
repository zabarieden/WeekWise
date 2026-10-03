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

// טבלאות שלא נמחקות לבד עם החשבון - כאלה שהקשר שלהן למשתמש/ת הוא בלי ON DELETE CASCADE
// (שורה אחת בהן חוסמת את מחיקת החשבון: למשל מי שרשם/ה ספורט, מים או קבלות) או בלי קשר
// בכלל (נשארות שורות יתומות). כל השאר נמחקות לבד (cascade). טבלה חדשה בלי cascade - להוסיף כאן
const USER_SCOPED_TABLES = [
    "budget_monthly_targets",
    "budget_tracker",
    "calendar_events",
    "calendar_sync_outbox",     // אחרי calendar_events: המחיקה שלהם מוסיפה לכאן "מחיקה ביומן גוגל"
    "calorie_tracker",
    "custom_sport_types",
    "feedback_messages",
    "meal_presets",
    "monthly_goals",
    "my_center_tasks",
    "progress_checkins",
    "push_subscriptions",
    "receipts",
    "recipes",
    "schedule_completions",
    "sport_sessions",
    "step_tracker",
    "user_ai_usage",
    "user_premium",
    "water_logs",
    "weekly_progress_targets",
    "weekly_schedule",
    "weight_tracker",
];

// תמונות שהמשתמש/ת העלה/תה - כולן בתיקייה ששמה מזהה המשתמש/ת
const USER_PHOTO_BUCKETS = ["new-me-photos", "sport-photos", "receipt-photos", "recipe-photos", "goal-vision-photos"];

// ניתוק יומן גוגל לפני מחיקת הנתונים: מבטלים את ההרשאה אצל גוגל, עוצרים את ערוצי העדכונים
// ומוחקים את החיבור. חייב לקרות לפני מחיקת האירועים - אחרת מחיקת האירועים מהאפליקציה
// הייתה נשלחת לגוגל ומוחקת אותם גם מיומן הגוגל של המשתמש/ת
async function disconnectGoogleCalendar(userId: string) {
    const { data: conns } = await supabase.from("google_calendar_connections").select("id, access_token, refresh_token").eq("user_id", userId);
    for (const conn of conns || []) {
        try {
            await fetch("https://oauth2.googleapis.com/revoke", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({ token: conn.refresh_token }),
            });
        } catch (err) {
            console.error(`Token revoke failed (continuing): ${err}`);
        }
        const { data: watches } = await supabase.from("google_calendar_watches").select("channel_id, channel_resource_id").eq("connection_id", conn.id);
        for (const watch of watches || []) {
            if (!watch.channel_id || !watch.channel_resource_id) continue;
            try {
                await fetch("https://www.googleapis.com/calendar/v3/channels/stop", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${conn.access_token}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ id: watch.channel_id, resourceId: watch.channel_resource_id }),
                });
            } catch (err) {
                console.error(`Channel stop failed (continuing): ${err}`);
            }
        }
    }
    // מחיקת החיבור מוחקת גם את ה-watches שלו (on delete cascade)
    const { error } = await supabase.from("google_calendar_connections").delete().eq("user_id", userId);
    if (error) throw new Error(`google_calendar_connections: ${error.message}`);
    await supabase.from("google_oauth_state").delete().eq("user_id", userId);
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
        // מזהים את המשתמשת מה-JWT שלה עצמה - כל שורה שנמחקת היא רק שלה, לא
        // ניתן להעביר user_id אחר מהלקוח כי אין לו שום השפעה כאן
        const authHeader = req.headers.get("Authorization") || "";
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userId = userData.user.id;

        try {
            await disconnectGoogleCalendar(userId);
        } catch (err) {
            return jsonResponse({ error: "delete_failed", table: "google_calendar_connections", detail: String(err) }, 500);
        }

        for (const table of USER_SCOPED_TABLES) {
            const { error } = await supabase.from(table).delete().eq("user_id", userId);
            if (error) {
                return jsonResponse({ error: "delete_failed", table, detail: error.message }, 500);
            }
        }

        // הקבצים עצמם לא נמחקים עם השורות - תמונות (כולל תמונות גוף פרטיות של New Me) חייבות
        // להימחק יחד עם החשבון
        for (const bucket of USER_PHOTO_BUCKETS) {
            for (let round = 0; round < 20; round++) {
                const { data: files } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
                if (!files || !files.length) break;
                await supabase.storage.from(bucket).remove(files.map((f) => `${userId}/${f.name}`));
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
