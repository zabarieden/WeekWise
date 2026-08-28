// Milestone 2+3: pushes calendar_events changes made in NOT10.ai back to Google
// Calendar - one-time events (Milestone 2) and recurring series (Milestone 3).
// Drains calendar_sync_outbox, populated by a DB trigger on calendar_events (see
// the migration in this function's DEPLOY.md).
//
// Runs on a cron tick (every 1-2 min), not per-request - so it always fetches
// current row state itself rather than trusting any snapshot in the outbox row.
// That also gives free de-duplication: several queued rows for the same event
// (or the same recurring series) collapse into a single Google API call using
// the latest state.

import { serviceClient, getValidAccessToken, GoogleConnection } from "../_shared/google-calendar.ts";

const MAX_ATTEMPTS = 10;

function pad(n: number): string { return String(n).padStart(2, "0"); }

function addDays(dateStr: string, days: number): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + days);
    return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// שעה אחת ברירת מחדל (הטבלה לא שומרת משך/שעת-סיום בכלל) - חישוב "ידני" על
// המספרים הגולמיים (לא new Date בפועל עם timeZone), כי אנחנו רק זזים קדימה
// על שעון-קיר נקי בלי שום המרת אזור-זמן אמיתית
function addHour(dateStr: string, timeStr: string): { date: string; time: string } {
    const [y, m, d] = dateStr.split("-").map(Number);
    const [hh, mm] = timeStr.split(":").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, hh, mm));
    dt.setUTCHours(dt.getUTCHours() + 1);
    return {
        date: `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`,
        time: `${pad(dt.getUTCHours())}:${pad(dt.getUTCMinutes())}`,
    };
}

function reminderBody(reminderMinutes: number | null | undefined) {
    // null/undefined -> useDefault (Google's own default reminders); אחרת
    // override מדויק כדי שהתראת-גוגל תתריע באותו קיזוז בדיוק כמו שהוגדר
    // ב-NOT10.ai - זה בפועל "מתקן" למשתמשת מחוברת את בעיית ההתראות הפנימיות
    // השבורות, כי התראת-גוגל אמינה ועובדת גם כשהפנימית לא
    if (reminderMinutes === null || reminderMinutes === undefined) return { useDefault: true };
    return { useDefault: false, overrides: [{ method: "popup", minutes: reminderMinutes }] };
}

function buildOneTimeEventBody(row: any, timeZone: string) {
    const body: any = { summary: row.event_title || "(No title)" };
    if (row.event_time) {
        const end = addHour(row.event_date, row.event_time);
        body.start = { dateTime: `${row.event_date}T${row.event_time}:00`, timeZone };
        body.end = { dateTime: `${end.date}T${end.time}:00`, timeZone };
    } else {
        body.start = { date: row.event_date };
        body.end = { date: addDays(row.event_date, 1) };
    }
    body.reminders = reminderBody(row.reminder_minutes);
    return body;
}

// מנסה להסיק כלל-חזרה (RRULE) מתוך רשימת התאריכים הממוינת בפועל של הסדרה -
// generateRecurringDates ב-app.js לא שומר את פרמטרי היצירה (unit/interval)
// בשום מקום בטבלה עצמה, רק את התאריכים המחושבים-מראש, אז זו הדרך היחידה
// לשחזר את הכלל בלי לשנות סכמה. FREQ=DAILY/WEEKLY נבדק לפי פער-ימים אחיד;
// FREQ=MONTHLY נבדק לפי יום-קבוע-בחודש + מרווח-חודשים אחיד. תבנית לא-סדירה
// (למשל אחרי שמישהי ערכה תאריך בודד בסדרה ידנית) מחזירה null - הקוראת
// אחראית ליפול-אחורה לדחיפת כל מופע כאירוע נפרד, לא לשבור את כל הסדרה
function inferRRule(sortedDates: string[]): string | null {
    const count = sortedDates.length;
    if (count < 2) return null;
    const parsed = sortedDates.map((s) => { const [y, m, d] = s.split("-").map(Number); return { y, m, d }; });
    const toDayNum = (p: { y: number; m: number; d: number }) => Math.floor(Date.UTC(p.y, p.m - 1, p.d) / 86400000);
    const dayNums = parsed.map(toDayNum);
    const dayDiffs = dayNums.slice(1).map((v, i) => v - dayNums[i]);
    if (dayDiffs.every((d) => d === dayDiffs[0] && d > 0)) {
        const step = dayDiffs[0];
        if (step % 7 === 0) return `FREQ=WEEKLY;INTERVAL=${step / 7};COUNT=${count}`;
        return `FREQ=DAILY;INTERVAL=${step};COUNT=${count}`;
    }
    const sameDom = parsed.every((p) => p.d === parsed[0].d);
    const monthNums = parsed.map((p) => p.y * 12 + p.m);
    const monthDiffs = monthNums.slice(1).map((v, i) => v - monthNums[i]);
    if (sameDom && monthDiffs.every((d) => d === monthDiffs[0] && d > 0)) {
        return `FREQ=MONTHLY;INTERVAL=${monthDiffs[0]};COUNT=${count}`;
    }
    return null;
}

// כל המופעים בפועל של סדרה חוזרת מסוימת בגוגל (לא רק ה"אב") - כל אחד עם
// originalStartTime משלו (העוגן שמזהה אותו בתוך הסדרה) ו-id ייחודי משלו
// (masterId_YYYYMMDDTHHMMSSZ) - זה מה שמאפשר PATCH על מופע ספציפי בלי לגעת
// בשאר הסדרה. עימוד (pageToken) כדי לכסות גם סדרות ארוכות
async function fetchAllInstances(eventsBase: string, masterId: string, accessToken: string): Promise<any[]> {
    const all: any[] = [];
    let pageToken: string | undefined;
    do {
        const params = new URLSearchParams({ maxResults: "2500" });
        if (pageToken) params.set("pageToken", pageToken);
        const res = await fetch(`${eventsBase}/${encodeURIComponent(masterId)}/instances?${params}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) throw new Error(`instances fetch failed: ${res.status} ${await res.text()}`);
        const data = await res.json();
        all.push(...(data.items || []));
        pageToken = data.nextPageToken;
    } while (pageToken);
    return all;
}

async function getCalendarTimeZone(accessToken: string, calendarId: string): Promise<string> {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return "UTC";
    const data = await res.json();
    return data.timeZone || "UTC";
}

Deno.serve(async () => {
    const supabase = serviceClient();

    const { data: pending, error: pendingErr } = await supabase
        .from("calendar_sync_outbox")
        .select("id, calendar_event_id, user_id, action, google_event_id, google_calendar_id, recurrence_group_id, attempts, created_at, is_series_title_edit")
        .is("processed_at", null)
        .order("created_at", { ascending: true })
        .limit(200);
    if (pendingErr) return new Response(JSON.stringify({ error: pendingErr.message }), { status: 500 });
    if (!pending || pending.length === 0) return new Response(JSON.stringify({ processed: 0 }), { status: 200 });

    // בלם-חירום: מספר חריג-בעליל של מחיקות ביחד לאותה משתמשת (הרבה מעבר למה
    // שפעולה תקינה אחת אי פעם תייצר - מחיקת סדרה שלמה כוללת בדרך כלל עד
    // כמה עשרות) מעכב את המחיקות עד שהן "בשלות" (5 דקות מרגע שנכנסו לתור) -
    // לא נדחף לגוגל מיד. זו רשת-ביטחון אחרונה בדיוק נגד התרחיש שקרה בפועל
    // (ר' התקרית ב-DEPLOY.md): ניקוי/באג שיוצר גל מחיקות בבת אחת מקבל חלון
    // קצר להיתפס (ידנית, או בסבב-דחיפה הבא) לפני שהוא הופך לבלתי-הפיך בגוגל -
    // בלי לעכב בכלל מחיקה בודדת/סדרה רגילה, שאף פעם לא מתקרבות לסף הזה
    const DELETE_BURST_THRESHOLD = 20;
    const DELETE_HOLD_MS = 5 * 60 * 1000;
    const byUser = new Map<string, typeof pending>();
    for (const row of pending) {
        if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
        byUser.get(row.user_id)!.push(row);
    }
    for (const [, userRows] of byUser) {
        const deleteRows = userRows.filter((r) => r.action === "delete");
        if (deleteRows.length <= DELETE_BURST_THRESHOLD) continue;
        const cutoff = Date.now() - DELETE_HOLD_MS;
        const tooFresh = new Set(deleteRows.filter((r) => new Date(r.created_at).getTime() > cutoff).map((r) => r.id));
        if (tooFresh.size === 0) continue;
        const filtered = userRows.filter((r) => !tooFresh.has(r.id));
        userRows.length = 0;
        userRows.push(...filtered);
    }

    let processedCount = 0;
    const nowIso = () => new Date().toISOString();

    for (const [userId, rows] of byUser) {
        const { data: conn } = await supabase.from("google_calendar_connections")
            .select("*").eq("user_id", userId).eq("is_connected", true).maybeSingle();

        if (!conn) {
            // אין חיבור פעיל - לא נשאיר את זה תקוע לנצח בתור, מסמנים כמעובד עם
            // שגיאה מוסברת. אם המשתמשת תתחבר מחדש בעתיד, עריכות חדשות יתווספו
            // לתור מחדש ויידחפו נורמלית - אין צורך "לחכות" לחיבור ישן
            const ids = rows.map((r) => r.id);
            await supabase.from("calendar_sync_outbox")
                .update({ processed_at: nowIso(), last_error: "no active google connection" })
                .in("id", ids);
            continue;
        }

        let accessToken: string;
        try {
            accessToken = await getValidAccessToken(supabase, conn as GoogleConnection);
        } catch (e) {
            const ids = rows.map((r) => r.id);
            await supabase.from("calendar_sync_outbox")
                .update({ attempts: 999, last_error: `token refresh failed: ${e}` })
                .in("id", ids);
            continue;
        }

        // מולטי-יומן: כל אירוע יכול להיות שייך ליומן-גוגל שונה (לא כולם primary
        // - ר' google_calendar_id על calendar_events/calendar_sync_outbox).
        // אירוע/סדרה חדשים שעדיין לא נדחפו תמיד הולכים ל-primary של החיבור
        // (יעד-ברירת-המחדל להוספה מ-NOT10.ai); עדכון/מחיקה של אירוע שכבר קיים
        // הולכים ליומן שבו הוא כבר חי, לא בהכרח primary
        const eventsBaseFor = (calId: string) => `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events`;
        const tzCache = new Map<string, string>();
        const getTZ = async (calId: string): Promise<string> => {
            if (!tzCache.has(calId)) tzCache.set(calId, await getCalendarTimeZone(accessToken, calId));
            return tzCache.get(calId)!;
        };
        const primaryCalId = conn.google_calendar_id;

        // מחיקות - כל שורה בנפרד. הטריגר כבר דואג שסדרה חוזרת רק תגיע לכאן
        // כשהמופע האחרון שלה נמחק (ר' הערת הטריגר), אז google_event_id כאן
        // תמיד באמת אמור להימחק לגמרי, לא רק מופע בודד מתוך סדרה חיה
        const deletes = rows.filter((r) => r.action === "delete");
        for (const delRow of deletes) {
            try {
                if (delRow.google_event_id) {
                    const eventsBase = eventsBaseFor(delRow.google_calendar_id || primaryCalId);
                    const res = await fetch(`${eventsBase}/${encodeURIComponent(delRow.google_event_id)}`, {
                        method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` },
                    });
                    if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`delete failed: ${res.status} ${await res.text()}`);
                }
                await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).eq("id", delRow.id);
                processedCount++;
            } catch (e) {
                const attempts = (delRow.attempts || 0) + 1;
                await supabase.from("calendar_sync_outbox").update({
                    attempts, last_error: String(e), processed_at: attempts >= MAX_ATTEMPTS ? nowIso() : null,
                }).eq("id", delRow.id);
            }
        }

        const upserts = rows.filter((r) => r.action !== "delete");
        const oneTimeUpserts = upserts.filter((r) => !r.recurrence_group_id);
        const recurringUpserts = upserts.filter((r) => r.recurrence_group_id);

        // אירועים חד-פעמיים - פר calendar_event_id ייחודי (לא פר שורת-תור), כדי
        // שכמה עריכות שהצטברו על אותו אירוע יתמזגו לקריאת-גוגל אחת עם המצב
        // העדכני ביותר בפועל, במקום לשלוח את אותו אירוע כמה פעמים ברצף
        const oneTimeEventIds = [...new Set(oneTimeUpserts.map((r) => r.calendar_event_id))];
        for (const eventId of oneTimeEventIds) {
            const rowsForEvent = oneTimeUpserts.filter((r) => r.calendar_event_id === eventId);
            const rowIds = rowsForEvent.map((r) => r.id);
            try {
                const { data: current } = await supabase.from("calendar_events")
                    .select("id, event_title, event_date, event_time, reminder_minutes, google_event_id, google_calendar_id, source, recurrence_group_id")
                    .eq("id", eventId).maybeSingle();

                if (!current || current.source !== "calendar" || current.recurrence_group_id) {
                    await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).in("id", rowIds);
                    processedCount += rowIds.length;
                    continue;
                }

                const targetCalId = current.google_event_id ? (current.google_calendar_id || primaryCalId) : primaryCalId;
                const eventsBase = eventsBaseFor(targetCalId);
                const timeZone = await getTZ(targetCalId);
                const body = buildOneTimeEventBody(current, timeZone);
                const res = current.google_event_id
                    ? await fetch(`${eventsBase}/${encodeURIComponent(current.google_event_id)}`, {
                        method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
                    })
                    : await fetch(eventsBase, {
                        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
                    });
                if (!res.ok) throw new Error(`upsert failed: ${res.status} ${await res.text()}`);
                const ev = await res.json();

                // כתיבה זו נוגעת ב-google_synced_at באותו statement - הטריגר
                // בודק בדיוק את זה כדי לא להכניס את השורה הזו שוב לתור
                await supabase.from("calendar_events").update({
                    google_event_id: ev.id, google_calendar_id: targetCalId, google_etag: ev.etag || null, google_updated: ev.updated || null,
                    google_synced_at: nowIso(),
                }).eq("id", eventId);

                await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).in("id", rowIds);
                processedCount += rowIds.length;
            } catch (e) {
                const attempts = Math.max(...rowsForEvent.map((r) => r.attempts || 0)) + 1;
                await supabase.from("calendar_sync_outbox").update({
                    attempts, last_error: String(e), processed_at: attempts >= MAX_ATTEMPTS ? nowIso() : null,
                }).in("id", rowIds);
            }
        }

        // סדרות חוזרות - פר recurrence_group_id, לא פר שורה/מופע - כל אחיות-
        // הסדרה שנכנסו לתור מטופלות ביחד בקריאת-גוגל אחת (יצירה) או בעדכון-
        // כותרת אחד (סדרה שכבר קיימת בגוגל)
        const groupIds = [...new Set(recurringUpserts.map((r) => r.recurrence_group_id))];
        for (const groupId of groupIds) {
            const rowsForGroup = recurringUpserts.filter((r) => r.recurrence_group_id === groupId);
            const rowIds = rowsForGroup.map((r) => r.id);
            try {
                const { data: siblings } = await supabase.from("calendar_events")
                    .select("id, event_title, event_date, event_time, reminder_minutes, google_event_id, google_calendar_id, source, recurrence_original_date, recurrence_original_time")
                    .eq("recurrence_group_id", groupId).eq("source", "calendar").order("event_date", { ascending: true });

                if (!siblings || siblings.length === 0) {
                    // כל הסדרה נמחקה מאז שנכנסה לתור - שום דבר לעשות
                    await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).in("id", rowIds);
                    processedCount += rowIds.length;
                    continue;
                }

                const alreadySynced = siblings.filter((s) => s.google_event_id);

                if (alreadySynced.length > 0) {
                    const masterId = alreadySynced[0].google_event_id;
                    const seriesCalId = alreadySynced[0].google_calendar_id || primaryCalId;
                    const eventsBase = eventsBaseFor(seriesCalId);
                    const timeZone = await getTZ(seriesCalId);
                    const touchedIds = new Set(rowsForGroup.map((r) => r.calendar_event_id));
                    const touchedSiblings = siblings.filter((s) => touchedIds.has(s.id));
                    // מזהים עריכת-כותרת-לכל-הסדרה לפי הדגל is_series_title_edit
                    // שהטריגר מתייג (ר' update_calendar_event_series_title ב-DB
                    // וההערה ב-app.js), לא לפי כמות השורות שנכנסו לתור - ניחוש
                    // לפי-כמות (touchedSiblings.length >= siblings.length) היה
                    // שגוי בטעות בסדרה קצרה (2 מופעים) אם שתי עריכות-מופע-בודד
                    // נפרדות נכנסו לתור בסמיכות זמן, ומטפל בהן (בטעות) כעריכת-
                    // כותרת-לכל-הסדרה - מה שהיה מפיל בשקט את שינויי התאריך/שעה
                    // בפועל של שתי העריכות. PATCH ולא PUT בכוונה - כדי לא לדרוס/
                    // למחוק בטעות את שדה ה-recurrence הקיים על אירוע-האב בגוגל,
                    // שולחים רק את מה שבאמת השתנה
                    if (rowsForGroup.some((r) => r.is_series_title_edit)) {
                        const title = siblings[0].event_title || "(No title)";
                        const res = await fetch(`${eventsBase}/${encodeURIComponent(masterId)}`, {
                            method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
                            body: JSON.stringify({ summary: title }),
                        });
                        if (!res.ok && res.status !== 404) throw new Error(`series title update failed: ${res.status} ${await res.text()}`);
                        if (res.ok) {
                            const ev = await res.json();
                            await supabase.from("calendar_events").update({
                                google_etag: ev.etag || null, google_updated: ev.updated || null, google_synced_at: nowIso(),
                            }).eq("recurrence_group_id", groupId);
                        }
                        await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).in("id", rowIds);
                        processedCount += rowIds.length;
                        continue;
                    }

                    // עריכת מופע/מופעים בודדים, לא כותרת-כל-הסדרה (openEditCalendarEvent
                    // דרך כפתור-העריכה בתוך הרשימה המורחבת של הסדרה, ר' app.js) -
                    // גם אם במקרה כל האחיות נגעו (למשל שתיהן נערכו בנפרד בסמיכות
                    // זמן בסדרה של 2 מופעים), הדגל is_series_title_edit=false מכל
                    // שורה אומר בוודאות שזו לא הייתה עריכת-כותרת-משותפת.
                    // מאתרים את המופע הנכון בגוגל דרך Events.instances, לפי
                    // recurrence_original_date/time - העוגן שלעולם לא זז אחרי
                    // שהמופע נוצר, גם אם event_date/event_time עצמם השתנו כאן -
                    // בלי העוגן הזה אין דרך לדעת איזה מופע-גוגל תואם לשורה אחרי
                    // שהתאריך שלה כבר השתנה מקומית
                    const instances = await fetchAllInstances(eventsBase, masterId, accessToken);
                    for (const s of touchedSiblings) {
                        const anchorDate = s.recurrence_original_date || s.event_date;
                        const anchorTime = s.recurrence_original_time || s.event_time;
                        const match = instances.find((inst: any) => {
                            const ost = inst.originalStartTime;
                            if (!ost) return false;
                            if (ost.date) return ost.date === anchorDate;
                            if (ost.dateTime) return ost.dateTime.slice(0, 10) === anchorDate && (!anchorTime || ost.dateTime.slice(11, 16) === anchorTime);
                            return false;
                        });
                        if (!match) {
                            // המופע לא נמצא בגוגל (למשל נמחק שם ידנית) - לא ניתן
                            // לעדכן משהו שלא קיים, מדלגים על השורה הזו בלי לשבור
                            // את שאר האצווה
                            continue;
                        }
                        const body = buildOneTimeEventBody(s, timeZone);
                        const res = await fetch(`${eventsBase}/${encodeURIComponent(match.id)}`, {
                            method: "PATCH", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
                        });
                        if (!res.ok) throw new Error(`instance update failed: ${res.status} ${await res.text()}`);
                        // google_event_id של השורה נשאר מזהה-האב המשותף בכוונה
                        // (לא מזהה-המופע הספציפי) - כדי שעריכה עתידית לאותה שורה
                        // עדיין תדע לחפש דרך אותו אב, בעזרת העוגן שלא זז
                        const ev = await res.json();
                        await supabase.from("calendar_events").update({
                            google_etag: ev.etag || null, google_updated: ev.updated || null, google_synced_at: nowIso(),
                        }).eq("id", s.id);
                    }
                    await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).in("id", rowIds);
                    processedCount += rowIds.length;
                    continue;
                }

                // סדרה חדשה - עדיין לא נדחפה בכלל. תמיד ל-primary של החיבור -
                // אין עדיין יומן-מקור להחליט לפיו (בניגוד לעדכון סדרה קיימת)
                const eventsBase = eventsBaseFor(primaryCalId);
                const timeZone = await getTZ(primaryCalId);
                const dates = siblings.map((s) => s.event_date);
                const rule = inferRRule(dates);
                const first = siblings[0];

                if (rule) {
                    const body: any = buildOneTimeEventBody(first, timeZone);
                    body.recurrence = [`RRULE:${rule}`];
                    const res = await fetch(eventsBase, {
                        method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
                    });
                    if (!res.ok) throw new Error(`series create failed: ${res.status} ${await res.text()}`);
                    const ev = await res.json();
                    // אותו google_event_id (מזהה-אב) על כל האחיות - זה בדיוק
                    // המנגנון שמאפשר לעדכון-כותרת עתידי לדעת איזה event לפצ'ץ'
                    await supabase.from("calendar_events").update({
                        google_event_id: ev.id, google_calendar_id: primaryCalId, google_etag: ev.etag || null, google_updated: ev.updated || null,
                        google_synced_at: nowIso(),
                    }).eq("recurrence_group_id", groupId);
                } else {
                    // תבנית לא-סדירה - לא ניתן לבנות RRULE אמין (למשל אחרי עריכה
                    // ידנית של תאריך בודד). נופלים אחורה לדחיפת כל מופע כאירוע
                    // עצמאי נפרד, כל אחד עם google_event_id משלו - עדיף מלאבד
                    // סנכרון לגמרי על כל הסדרה
                    for (const s of siblings) {
                        const body = buildOneTimeEventBody(s, timeZone);
                        const res = s.google_event_id
                            ? await fetch(`${eventsBase}/${encodeURIComponent(s.google_event_id)}`, {
                                method: "PUT", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
                            })
                            : await fetch(eventsBase, {
                                method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
                            });
                        if (!res.ok) throw new Error(`flattened occurrence push failed: ${res.status} ${await res.text()}`);
                        const ev = await res.json();
                        await supabase.from("calendar_events").update({
                            google_event_id: ev.id, google_calendar_id: primaryCalId, google_etag: ev.etag || null, google_updated: ev.updated || null,
                            google_synced_at: nowIso(),
                        }).eq("id", s.id);
                    }
                }

                await supabase.from("calendar_sync_outbox").update({ processed_at: nowIso() }).in("id", rowIds);
                processedCount += rowIds.length;
            } catch (e) {
                const attempts = Math.max(...rowsForGroup.map((r) => r.attempts || 0)) + 1;
                await supabase.from("calendar_sync_outbox").update({
                    attempts, last_error: String(e), processed_at: attempts >= MAX_ATTEMPTS ? nowIso() : null,
                }).in("id", rowIds);
            }
        }
    }

    return new Response(JSON.stringify({ processed: processedCount }), { status: 200, headers: { "Content-Type": "application/json" } });
});
