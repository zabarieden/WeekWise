// Shared helpers for the Google Calendar sync feature (Milestone 1: pull only).
//
// Imported by google-calendar-webhook, google-calendar-reconcile, and
// google-calendar-renew-channels - deliberately factored out (this repo's other
// edge functions are normally self-contained) because duplicating OAuth
// token-refresh logic across several files is a real bug-surface risk here: a
// refresh bug means silent, hard-to-notice sync death for the user.
//
// See supabase/functions/google-calendar-*/DEPLOY.md for setup/deploy steps.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
export const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

export function serviceClient(): SupabaseClient {
    return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

export interface GoogleConnection {
    id: string;
    user_id: string;
    username: string | null;
    google_calendar_id: string;
    access_token: string;
    refresh_token: string;
    token_expiry: string;
    sync_token: string | null;
    channel_id: string | null;
    channel_resource_id: string | null;
    channel_token: string | null;
    channel_expiration: string | null;
    is_connected: boolean;
}

// מרעננת access_token רק אם הוא כבר פג/עומד לפוג ב-2 הדקות הקרובות - בלי
// לקרוא ל-Google בכל קריאה מיותרת. מעדכנת את השורה ב-DB עם הטוקן/תפוגה
// החדשים ומחזירה טוקן תקף לשימוש מיידי
export async function getValidAccessToken(supabase: SupabaseClient, conn: GoogleConnection): Promise<string> {
    const expiry = new Date(conn.token_expiry).getTime();
    if (expiry - Date.now() > 2 * 60 * 1000) return conn.access_token;

    const res = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: GOOGLE_CLIENT_ID,
            client_secret: GOOGLE_CLIENT_SECRET,
            refresh_token: conn.refresh_token,
            grant_type: "refresh_token",
        }),
    });
    if (!res.ok) throw new Error(`token refresh failed: ${await res.text()}`);
    const data = await res.json();
    const newExpiry = new Date(Date.now() + data.expires_in * 1000).toISOString();
    await supabase.from("google_calendar_connections").update({
        access_token: data.access_token,
        token_expiry: newExpiry,
        updated_at: new Date().toISOString(),
    }).eq("id", conn.id);
    conn.access_token = data.access_token;
    conn.token_expiry = newExpiry;
    return data.access_token;
}

function mapGoogleEventToRow(userId: string, username: string | null, ev: any) {
    // אירוע יום-שלם (all-day) מגיע עם date בלבד (לא dateTime) - אין שעה
    const startDate = ev.start?.date || (ev.start?.dateTime ? ev.start.dateTime.slice(0, 10) : null);
    const startTime = ev.start?.dateTime ? ev.start.dateTime.slice(11, 16) : null;
    return {
        user_id: userId,
        username,
        event_title: ev.summary || "(No title)",
        event_date: startDate,
        event_time: startTime,
        source: "calendar",
        recurrence_group_id: null,
        google_event_id: ev.id,
        google_etag: ev.etag || null,
        google_updated: ev.updated || null,
        google_synced_at: new Date().toISOString(),
    };
}

// מבצעת משיכת-דלתא אחת (delta pull) עבור חיבור נתון: Events.list עם ה-
// sync_token השמור (או, אם אין/פג - חלון-זמן חסום ל-90 יום אחורה כזריעה
// מחדש), מתאימה כל אירוע-שהוחזר לפי google_event_id, מכניסה/מעדכנת/מוחקת
// בהתאם. "מנצח-לפי-כתיבה-אחרונה": Google מנצח רק אם updated שלו מאוחר
// מ-updated_at המקומי - אחרת רק שדות-המעקב (google_*) מתעדכנים, לא תוכן
// האירוע (השורה כבר תידחף בחזרה לגוגל דרך תור-היציאה במיילסטון 2)
export async function pullDeltaForConnection(supabase: SupabaseClient, conn: GoogleConnection): Promise<{ checked: number; applied: number }> {
    const accessToken = await getValidAccessToken(supabase, conn);
    let checked = 0, applied = 0;
    let pageToken: string | undefined;
    let syncToken = conn.sync_token || undefined;
    let newSyncToken: string | undefined;
    let needsReseed = false;

    do {
        const params = new URLSearchParams({ singleEvents: "true", maxResults: "250" });
        if (pageToken) params.set("pageToken", pageToken);
        if (syncToken) params.set("syncToken", syncToken);
        else {
            const timeMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
            params.set("timeMin", timeMin);
        }
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.google_calendar_id)}/events?${params}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

        if (res.status === 410) {
            // sync_token פג/לא תקף יותר - זריעה מחדש עם חלון-זמן חסום
            needsReseed = true;
            syncToken = undefined;
            pageToken = undefined;
            continue;
        }
        if (!res.ok) throw new Error(`Events.list failed: ${res.status} ${await res.text()}`);
        const data = await res.json();

        for (const ev of data.items || []) {
            checked++;
            if (ev.status === "cancelled") {
                await supabase.from("calendar_events").delete().eq("user_id", conn.user_id).eq("google_event_id", ev.id);
                applied++;
                continue;
            }
            const { data: existing } = await supabase.from("calendar_events")
                .select("id, updated_at")
                .eq("user_id", conn.user_id).eq("google_event_id", ev.id).maybeSingle();

            const row = mapGoogleEventToRow(conn.user_id, conn.username, ev);
            if (!existing) {
                await supabase.from("calendar_events").insert(row);
                applied++;
            } else {
                const googleUpdated = ev.updated ? new Date(ev.updated).getTime() : 0;
                const localUpdated = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
                if (googleUpdated > localUpdated) {
                    await supabase.from("calendar_events").update(row).eq("id", existing.id);
                } else {
                    // המקומי מנצח - רק שדות-מעקב, לא תוכן (הגרסה המקומית תידחף
                    // חזרה לגוגל דרך תור-היציאה במיילסטון 2, כשהוא ייבנה)
                    await supabase.from("calendar_events").update({
                        google_etag: row.google_etag, google_updated: row.google_updated, google_synced_at: row.google_synced_at,
                    }).eq("id", existing.id);
                }
                applied++;
            }
        }
        pageToken = data.nextPageToken;
        if (data.nextSyncToken) newSyncToken = data.nextSyncToken;
    } while (pageToken);

    await supabase.from("google_calendar_connections").update({
        sync_token: newSyncToken || null,
        last_full_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq("id", conn.id);

    if (needsReseed && !newSyncToken) {
        // ריצה חוזרת אחת עם חלון-זמן חסום כבר קרתה למעלה בלולאה (syncToken
        // אופס ל-undefined) - אם עדיין אין newSyncToken בסוף, זה כשל אמיתי,
        // לא רק "אין שינויים" (Google תמיד מחזיר nextSyncToken בדף האחרון)
        console.error(`No nextSyncToken returned after reseed for connection ${conn.id}`);
    }

    return { checked, applied };
}
