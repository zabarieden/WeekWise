// Shared helpers for the Google Calendar sync feature.
//
// Imported by google-calendar-oauth-callback, google-calendar-webhook,
// google-calendar-reconcile, google-calendar-renew-channels, and
// google-calendar-outbox-drain - deliberately factored out (this repo's other
// edge functions are normally self-contained) because duplicating OAuth
// token-refresh logic across several files is a real bug-surface risk here: a
// refresh bug means silent, hard-to-notice sync death for the user.
//
// Multi-calendar: a user's Google account can have several calendars (their
// own primary one, plus any shared/subscribed ones like a booking app's
// calendar) - discovered live because there's no way to know in advance which
// ones a given user has. google_calendar_connections stores ONE row per user
// (the OAuth tokens, which are account-level, not per-calendar).
// google_calendar_watches stores ONE row per (connection, calendar) - each
// calendar needs its own sync_token (Events.list delta cursor) and its own
// push channel (Events.watch is per-calendar, not account-wide).
//
// See supabase/functions/google-calendar-*/DEPLOY.md for setup/deploy steps.

import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2";

export const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
export const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/google-calendar-webhook`;

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
    is_connected: boolean;
}

export interface GoogleCalendarWatch {
    id: string;
    connection_id: string;
    google_calendar_id: string;
    calendar_summary: string | null;
    sync_token: string | null;
    channel_id: string | null;
    channel_resource_id: string | null;
    channel_token: string | null;
    channel_expiration: string | null;
    last_full_sync_at: string | null;
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

// מוצאת את כל היומנים שיש למשתמשת בחשבון גוגל שלה (לא רק primary - כל יומן
// משותף/מנוי כמו יומן של אפליקציית שיעורים) ומוודאת ששורת google_calendar_watches
// קיימת לכל אחד מהם. לא נוגעת ביומנים שכבר יש להם שורה (לא מאפסת sync_token
// קיים) - רק מוסיפה חדשים שנמצאו. נקראת גם ב-oauth-callback (חיבור ראשוני)
// וגם ב-reconcile (כדי לתפוס יומן שנוסף לחשבון גוגל אחרי החיבור הראשוני,
// בלי שהמשתמשת תצטרך להתנתק ולהתחבר מחדש)
export async function discoverCalendarWatches(supabase: SupabaseClient, conn: GoogleConnection, accessToken: string): Promise<GoogleCalendarWatch[]> {
    const res = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`calendarList fetch failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    // הפריט עם primary:true הוא אותו יומן ראשי בדיוק שכבר מכוסה ע"י שורת ה-
    // watch הקבועה עם google_calendar_id="primary" (נוצרת ב-oauth-callback,
    // לא כאן) - ה-id "האמיתי" שלו בפועל הוא כתובת המייל של המשתמשת, לא
    // המילה "primary" - בלי הסינון הזה הוא היה מתגלה שוב כיומן "חדש" ונמשך
    // פעמיים במקביל (עם שני google_calendar_id שונים לאותם אירועים בפועל),
    // שיוצר כפילויות אמיתיות בטבלה
    const calendars: any[] = (data.items || []).filter((c: any) => !c.primary);

    const { data: existingWatches } = await supabase.from("google_calendar_watches")
        .select("*").eq("connection_id", conn.id);
    const existingIds = new Set((existingWatches || []).map((w: any) => w.google_calendar_id));

    const newOnes = calendars.filter((c) => !existingIds.has(c.id));
    if (newOnes.length > 0) {
        await supabase.from("google_calendar_watches").insert(
            newOnes.map((c) => ({
                connection_id: conn.id,
                google_calendar_id: c.id,
                calendar_summary: c.summary || null,
            })),
        );
    }

    const { data: allWatches } = await supabase.from("google_calendar_watches")
        .select("*").eq("connection_id", conn.id);
    return (allWatches || []) as GoogleCalendarWatch[];
}

// פותחת ערוץ Push (Events.watch) ליומן ספציפי אחד - כל יומן צריך ערוץ נפרד,
// אין "ערוץ אחד לכל היומנים". channel_token אקראי הוא מנגנון-האימות היחיד
// של google-calendar-webhook (גוף ה-Push עצמו תמיד ריק) - חייב סוד לפני
// שמזמינים ערוץ, לא אחרי
export async function openWatchChannel(supabase: SupabaseClient, watch: GoogleCalendarWatch, accessToken: string): Promise<void> {
    const channelId = crypto.randomUUID();
    const channelToken = crypto.randomUUID();
    const res = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(watch.google_calendar_id)}/events/watch`,
        {
            method: "POST",
            headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
            body: JSON.stringify({ id: channelId, type: "web_hook", address: WEBHOOK_URL, token: channelToken }),
        },
    );
    if (!res.ok) throw new Error(`Events.watch failed: ${res.status} ${await res.text()}`);
    const watchData = await res.json();
    await supabase.from("google_calendar_watches").update({
        channel_id: channelId,
        channel_resource_id: watchData.resourceId,
        channel_token: channelToken,
        channel_expiration: watchData.expiration ? new Date(Number(watchData.expiration)).toISOString() : null,
        updated_at: new Date().toISOString(),
    }).eq("id", watch.id);
}

function mapGoogleEventToRow(userId: string, username: string | null, calendarId: string, ev: any) {
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
        google_calendar_id: calendarId,
        google_etag: ev.etag || null,
        google_updated: ev.updated || null,
        google_synced_at: new Date().toISOString(),
    };
}

// מבצעת משיכת-דלתא אחת (delta pull) עבור יומן ספציפי אחד (לא כל היומנים
// ביחד): Events.list עם ה-sync_token השמור על אותו watch (או, אם אין/פג -
// חלון-זמן חסום ל-90 יום אחורה כזריעה מחדש), מתאימה כל אירוע-שהוחזר לפי
// google_event_id (בשילוב עם google_calendar_id, כי אותו google_event_id
// יכול תיאורטית להתקיים בשני יומנים שונים), מכניסה/מעדכנת/מוחקת בהתאם.
// "מנצח-לפי-כתיבה-אחרונה": Google מנצח רק אם updated שלו מאוחר מ-updated_at
// המקומי - אחרת רק שדות-המעקב (google_*) מתעדכנים, לא תוכן האירוע
export async function pullDeltaForWatch(supabase: SupabaseClient, conn: GoogleConnection, watch: GoogleCalendarWatch, accessToken: string): Promise<{ checked: number; applied: number }> {
    let checked = 0, applied = 0;
    let pageToken: string | undefined;
    let syncToken = watch.sync_token || undefined;
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
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(watch.google_calendar_id)}/events?${params}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

        if (res.status === 410) {
            // sync_token פג/לא תקף יותר - זריעה מחדש עם חלון-זמן חסום
            needsReseed = true;
            syncToken = undefined;
            pageToken = undefined;
            continue;
        }
        if (!res.ok) throw new Error(`Events.list failed for calendar ${watch.google_calendar_id}: ${res.status} ${await res.text()}`);
        const data = await res.json();

        for (const ev of data.items || []) {
            checked++;
            if (ev.status === "cancelled") {
                await supabase.from("calendar_events").delete().eq("user_id", conn.user_id).eq("google_event_id", ev.id).eq("google_calendar_id", watch.google_calendar_id);
                applied++;
                continue;
            }
            const { data: existing } = await supabase.from("calendar_events")
                .select("id, updated_at")
                .eq("user_id", conn.user_id).eq("google_event_id", ev.id).eq("google_calendar_id", watch.google_calendar_id).maybeSingle();

            const row = mapGoogleEventToRow(conn.user_id, conn.username, watch.google_calendar_id, ev);
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
                    // חזרה לגוגל דרך תור-היציאה, ר' google-calendar-outbox-drain)
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

    await supabase.from("google_calendar_watches").update({
        sync_token: newSyncToken || null,
        last_full_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
    }).eq("id", watch.id);

    if (needsReseed && !newSyncToken) {
        console.error(`No nextSyncToken returned after reseed for watch ${watch.id} (calendar ${watch.google_calendar_id})`);
    }

    return { checked, applied };
}

// עוברת על כל היומנים של החיבור (מגלה חדשים קודם, כדי שיומן שנוסף בגוגל
// אחרי החיבור הראשוני ייתפס גם הוא) ומושכת דלתא לכל אחד בנפרד - כשל ביומן
// אחד לא עוצר את השאר
export async function pullDeltaForConnection(supabase: SupabaseClient, conn: GoogleConnection): Promise<{ checked: number; applied: number; calendars: number }> {
    const accessToken = await getValidAccessToken(supabase, conn);
    const watches = await discoverCalendarWatches(supabase, conn, accessToken);

    let checked = 0, applied = 0;
    for (const watch of watches) {
        try {
            const result = await pullDeltaForWatch(supabase, conn, watch, accessToken);
            checked += result.checked;
            applied += result.applied;
        } catch (err) {
            console.error(`Pull failed for watch ${watch.id} (calendar ${watch.google_calendar_id}, connection ${conn.id}): ${err}`);
        }
    }
    return { checked, applied, calendars: watches.length };
}
