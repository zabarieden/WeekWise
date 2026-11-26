// Supabase Edge Function: send-due-reminders
//
// Runs on a schedule (see the pg_cron SQL in DEPLOY.md) and sends a real Web Push
// notification for every weekly_schedule / calendar_events / workout_plan reminder that is
// due right now, for every user's timezone, so reminders fire even when the app is fully closed.
// Also sends the New Me meal reminders (new_me_reminders - one time per meal).
//
// Every reminder is delivered ONCE, in ONE place (explicit request - before, the same
// reminder popped on the phone, the computer and the iPad, and again after "Done"):
// - reminder_deliveries holds one row per reminder per day. Whoever inserts it first
//   (an open app in front of the user, or this function) is the only one that delivers it.
// - reminder_presence tells us a device has the app open in front of the user right now -
//   then the app shows the reminder itself, and we wait up to PRESENCE_WAIT_MINUTES for it.
// - Otherwise we push to the phone only (push_subscriptions.device_kind = 'mobile'), or to
//   every device if the user turned on user_premium.reminder_all_devices. No phone at all
//   (or the phone can't be reached) - the other devices get it, so nothing is lost.
// - Snooze rounds are taken the same way: a conditional update on next_at, so each round
//   is shown by exactly one place.
// Same late cap as the app (LATE_LIMIT_MINUTES), and weekly_schedule / calendar_events
// last_notified_date are still kept as a second guard.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_CONTACT_EMAIL = Deno.env.get("VAPID_CONTACT_EMAIL") || "mailto:admin@example.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// כל ההתחלה עטופה ב-try/catch מפורש: כשל כאן (למשל מפתח VAPID לא תקין) היה
// מפיל את כל המודול עם "WORKER_ERROR: Function exited due to an error" חסר-
// פרטים לגמרי, בלי שום דרך לדעת למה מבחוץ (אין גישה ל-logs דרך ה-CLI כאן) -
// לפי בקשה מפורשת לאבחן למה תזכורות בכלל לא הגיעו. עכשיו כשל בשלב הזה עדיין
// גורם לכל קריאה להיכשל, אבל עם הודעת שגיאה אמיתית וקריאה ב-net._http_response
let initError: string | null = null;
try {
    webpush.setVapidDetails(VAPID_CONTACT_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err: any) {
    initError = `VAPID init failed: ${err?.message || err}`;
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// תזכורת שהתפספסה (למשל כשהפונקציה לא רצה) נשלחת באיחור - עד שעה אחרי תחילת המשימה
const LATE_LIMIT_MINUTES = 60;
// אפליקציה פתוחה מול העיניים מציגה את התזכורת בעצמה - מחכים לה עד 2 דקות, ואז שולחים בכל זאת
const PRESENCE_WAIT_MINUTES = 2;
const SNOOZE_MINUTES = 10;
// כפתורי ההתראה במילים ("✓ בוצע" / "עוד 10 דק׳") בכל 33 השפות - לפי user_premium.language
const ACTION_WORDS: Record<string, [string, string]> = {
    he: ["✓ בוצע", "עוד 10 דק׳"], en: ["✓ Done", "10 more min"], es: ["✓ Hecho", "10 min más"], fr: ["✓ Fait", "Encore 10 min"],
    ar: ["✓ تم", "بعد 10 دقائق"], ru: ["✓ Сделано", "Через 10 мин"], de: ["✓ Erledigt", "In 10 Min."], pt: ["✓ Feito", "Mais 10 min"],
    ja: ["✓ 完了", "10分後"], zh: ["✓ 完成", "10分钟后"], hi: ["✓ हो गया", "10 मिनट बाद"], ko: ["✓ 완료", "10분 뒤"],
    tr: ["✓ Yapıldı", "10 dk sonra"], id: ["✓ Selesai", "10 menit lagi"], it: ["✓ Fatto", "Tra 10 min"], vi: ["✓ Xong", "10 phút nữa"],
    pl: ["✓ Zrobione", "Za 10 min"], th: ["✓ เสร็จแล้ว", "อีก 10 นาที"], ur: ["✓ ہو گیا", "10 منٹ بعد"], bn: ["✓ হয়ে গেছে", "১০ মিনিট পরে"],
    sw: ["✓ Imefanyika", "Dakika 10 zaidi"], uk: ["✓ Зроблено", "За 10 хв"], el: ["✓ Έγινε", "Σε 10 λεπτά"], nl: ["✓ Klaar", "Over 10 min"],
    ca: ["✓ Fet", "D'aquí a 10 min"], ro: ["✓ Gata", "Peste 10 min"], yo: ["✓ Ó ti parí", "Ìṣẹ́jú 10 sí i"], sv: ["✓ Klart", "Om 10 min"],
    nb: ["✓ Ferdig", "Om 10 min"], da: ["✓ Færdig", "Om 10 min"], cs: ["✓ Hotovo", "Za 10 min"], hu: ["✓ Kész", "10 perc múlva"],
    fi: ["✓ Tehty", "10 min päästä"],
};
const DELIVERY_KEY = "user_id,source_type,source_id,source_date";
// 📅 יומן שלב 3 (לפי בחירה מפורשת, 2026-11-24, 26-29): "הגיע הזמן לצאת", סיכום בוקר ו"מה מחר" בערב - בלי אימוג׳י בהתראה
const CAL_WORDS: Record<string, { leave: string; today: string; tomorrow: string }> = {
    he: { leave: "הגיע הזמן לצאת", today: "היום ביומן", tomorrow: "מחר ביומן" },
    en: { leave: "Time to leave", today: "Today in your calendar", tomorrow: "Tomorrow in your calendar" },
    es: { leave: "Hora de salir", today: "Hoy en tu calendario", tomorrow: "Mañana en tu calendario" },
    fr: { leave: "Il est temps de partir", today: "Aujourd'hui dans votre calendrier", tomorrow: "Demain dans votre calendrier" },
    ar: { leave: "حان وقت الخروج", today: "اليوم في التقويم", tomorrow: "غدًا في التقويم" },
    ru: { leave: "Пора выходить", today: "Сегодня в календаре", tomorrow: "Завтра в календаре" },
    de: { leave: "Zeit zum Losgehen", today: "Heute im Kalender", tomorrow: "Morgen im Kalender" },
    pt: { leave: "Hora de sair", today: "Hoje no calendário", tomorrow: "Amanhã no calendário" },
    ja: { leave: "出発の時間です", today: "今日の予定", tomorrow: "明日の予定" },
    zh: { leave: "该出发了", today: "今天的日程", tomorrow: "明天的日程" },
    hi: { leave: "निकलने का समय", today: "आज कैलेंडर में", tomorrow: "कल कैलेंडर में" },
    ko: { leave: "출발할 시간이에요", today: "오늘 일정", tomorrow: "내일 일정" },
    tr: { leave: "Çıkma zamanı", today: "Bugün takviminde", tomorrow: "Yarın takviminde" },
    id: { leave: "Saatnya berangkat", today: "Hari ini di kalender", tomorrow: "Besok di kalender" },
    it: { leave: "È ora di uscire", today: "Oggi nel calendario", tomorrow: "Domani nel calendario" },
    vi: { leave: "Đến lúc khởi hành", today: "Hôm nay trong lịch", tomorrow: "Ngày mai trong lịch" },
    pl: { leave: "Czas wychodzić", today: "Dziś w kalendarzu", tomorrow: "Jutro w kalendarzu" },
    th: { leave: "ได้เวลาออกเดินทาง", today: "วันนี้ในปฏิทิน", tomorrow: "พรุ่งนี้ในปฏิทิน" },
    ur: { leave: "نکلنے کا وقت", today: "آج کیلنڈر میں", tomorrow: "کل کیلنڈر میں" },
    bn: { leave: "বেরোনোর সময়", today: "আজ ক্যালেন্ডারে", tomorrow: "আগামীকাল ক্যালেন্ডারে" },
    sw: { leave: "Ni wakati wa kuondoka", today: "Leo kwenye kalenda", tomorrow: "Kesho kwenye kalenda" },
    uk: { leave: "Час виходити", today: "Сьогодні в календарі", tomorrow: "Завтра в календарі" },
    el: { leave: "Ώρα για αναχώρηση", today: "Σήμερα στο ημερολόγιο", tomorrow: "Αύριο στο ημερολόγιο" },
    nl: { leave: "Tijd om te vertrekken", today: "Vandaag in je agenda", tomorrow: "Morgen in je agenda" },
    ca: { leave: "Hora de sortir", today: "Avui al calendari", tomorrow: "Demà al calendari" },
    ro: { leave: "E timpul de plecare", today: "Azi în calendar", tomorrow: "Mâine în calendar" },
    yo: { leave: "Àkókò láti jáde", today: "Lónìí nínú kàlẹ́ńdà", tomorrow: "Lọ́la nínú kàlẹ́ńdà" },
    sv: { leave: "Dags att gå", today: "I dag i kalendern", tomorrow: "I morgon i kalendern" },
    nb: { leave: "På tide å dra", today: "I dag i kalenderen", tomorrow: "I morgen i kalenderen" },
    da: { leave: "Tid til at tage af sted", today: "I dag i kalenderen", tomorrow: "I morgen i kalenderen" },
    cs: { leave: "Čas vyrazit", today: "Dnes v kalendáři", tomorrow: "Zítra v kalendáři" },
    hu: { leave: "Ideje indulni", today: "Ma a naptárban", tomorrow: "Holnap a naptárban" },
    fi: { leave: "Aika lähteä", today: "Tänään kalenterissa", tomorrow: "Huomenna kalenterissa" },
};
// 💧 מים (לפי בחירה מפורשת, 2026-11-26): כותרת תזכורת השתייה לפי הקצב, ושורת המים בסיכום הבוקר ("אתמול") ובסיכום הערב ("היום").
// בלי אימוג׳י בהתראה. הכמויות עצמן - Intl (ליטר / מ״ל / fl oz) לפי user_premium.water_prefs.unit
const WATER_WORDS: Record<string, { t: string; y: string; d: string }> = {
    he: { t: "הגיע הזמן לכוס מים", y: "מים אתמול", d: "מים היום" },
    en: { t: "Time for a glass of water", y: "Water yesterday", d: "Water today" },
    es: { t: "Hora de un vaso de agua", y: "Agua ayer", d: "Agua hoy" },
    fr: { t: "C'est l'heure d'un verre d'eau", y: "Eau hier", d: "Eau aujourd'hui" },
    ar: { t: "حان وقت كوب ماء", y: "الماء أمس", d: "الماء اليوم" },
    ru: { t: "Время для стакана воды", y: "Вода вчера", d: "Вода сегодня" },
    de: { t: "Zeit für ein Glas Wasser", y: "Wasser gestern", d: "Wasser heute" },
    pt: { t: "Hora de um copo de água", y: "Água ontem", d: "Água hoje" },
    ja: { t: "お水を1杯どうぞ", y: "昨日の水", d: "今日の水" },
    zh: { t: "该喝杯水了", y: "昨天喝水", d: "今天喝水" },
    hi: { t: "एक गिलास पानी का समय", y: "कल पानी", d: "आज पानी" },
    ko: { t: "물 한 잔 마실 시간이에요", y: "어제 마신 물", d: "오늘 마신 물" },
    tr: { t: "Bir bardak su zamanı", y: "Dün su", d: "Bugün su" },
    id: { t: "Waktunya segelas air", y: "Air kemarin", d: "Air hari ini" },
    it: { t: "È ora di un bicchiere d'acqua", y: "Acqua ieri", d: "Acqua oggi" },
    vi: { t: "Đến lúc uống một cốc nước", y: "Nước hôm qua", d: "Nước hôm nay" },
    pl: { t: "Czas na szklankę wody", y: "Woda wczoraj", d: "Woda dziś" },
    th: { t: "ได้เวลาดื่มน้ำสักแก้ว", y: "น้ำเมื่อวาน", d: "น้ำวันนี้" },
    ur: { t: "ایک گلاس پانی کا وقت", y: "کل کا پانی", d: "آج کا پانی" },
    bn: { t: "এক গ্লাস পানির সময়", y: "গতকালের পানি", d: "আজকের পানি" },
    sw: { t: "Ni wakati wa glasi ya maji", y: "Maji jana", d: "Maji leo" },
    uk: { t: "Час для склянки води", y: "Вода вчора", d: "Вода сьогодні" },
    el: { t: "Ώρα για ένα ποτήρι νερό", y: "Νερό χθες", d: "Νερό σήμερα" },
    nl: { t: "Tijd voor een glas water", y: "Water gisteren", d: "Water vandaag" },
    ca: { t: "Hora d'un got d'aigua", y: "Aigua ahir", d: "Aigua avui" },
    ro: { t: "E timpul pentru un pahar cu apă", y: "Apă ieri", d: "Apă azi" },
    yo: { t: "Àkókò fún ife omi kan", y: "Omi àná", d: "Omi òní" },
    sv: { t: "Dags för ett glas vatten", y: "Vatten i går", d: "Vatten i dag" },
    nb: { t: "Tid for et glass vann", y: "Vann i går", d: "Vann i dag" },
    da: { t: "Tid til et glas vand", y: "Vand i går", d: "Vand i dag" },
    cs: { t: "Čas na sklenici vody", y: "Voda včera", d: "Voda dnes" },
    hu: { t: "Ideje egy pohár víznek", y: "Víz tegnap", d: "Víz ma" },
    fi: { t: "Aika lasilliselle vettä", y: "Vesi eilen", d: "Vesi tänään" },
};
const ML_PER_FL_OZ = 29.5735;
// 1,800 מ״ל → "1.8 ל׳", 600 → "600 מ״ל"; באונקיות → "60.9 fl oz"
function waterAmount(ml: number, unit: string, lang: string) {
    const f = (v: number, u: string, digits: number) => {
        try { return new Intl.NumberFormat(lang, { style: "unit", unit: u, unitDisplay: "short", maximumFractionDigits: digits }).format(v); } catch { return `${v} ${u}`; }
    };
    if (unit === "oz") return f(Math.round(ml / ML_PER_FL_OZ * 10) / 10, "fluid-ounce", 1);
    return ml >= 1000 ? f(Math.round(ml / 100) / 10, "liter", 1) : f(Math.round(ml), "milliliter", 0);
}
// לא מזכירים אם שתו ב-45 הדקות האחרונות
const WATER_QUIET_AFTER_LOG_MS = 45 * 60 * 1000;
// תזכורת נוספת / זמן לצאת שהתפספסו נשלחות עד חצי שעה באיחור, לא יותר
const EXTRA_LATE_MINUTES = 30;
// אירוע בלי שעה (כל היום): התזכורות הנוספות נספרות מ-09:00 של היום שלו
const ALL_DAY_ANCHOR_MINUTES = 9 * 60;
const CAL_INTERNAL_SOURCES = "(today_celebrated,daily_focus,daily_focus_dismissed)";
const SUMMARY_MAX_LINES = 6;
const dayNumOf = (dateStr: string) => { const [y, m, d] = dateStr.split("-").map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86400000); };
const dateOfNum = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
const toMin = (time: string | null) => { if (!time) return null; const [h, m] = String(time).split(":").map((x) => parseInt(x, 10)); return Number.isNaN(h) || Number.isNaN(m) ? null : h * 60 + m; };
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// "מחר" / "בעוד 3 ימים" בשפה של המשתמש/ת - Intl מתרגם לבד
function relativeDay(lang: string, days: number) {
    try { return new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(days, "day"); } catch { return ""; }
}

// מחזיר את התאריך/שעה המקומיים של המשתמש (לפי אזור הזמן השמור), בלי לבנות Date חדש -
// כי בניית Date "מקומי" מתוך IANA timezone דורשת חישוב offset, וזה המסלול הפשוט והבטוח.
function getLocalWallClock(now: Date, timeZone: string) {
    const dtf = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        weekday: "long",
    });
    const parts = dtf.formatToParts(now);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    return {
        dateStr: `${map.year}-${map.month}-${map.day}`,
        dbDay: map.weekday, // "Sunday".."Saturday" - matches dbDaysMap in app.js exactly
        hour: parseInt(map.hour, 10) % 24,
        minute: parseInt(map.minute, 10),
    };
}

Deno.serve(async (_req) => {
    if (initError) return jsonResponse({ ok: false, error: initError }, 500);
    try {
        return await handleRequest();
    } catch (err: any) {
        return jsonResponse({ ok: false, error: err?.message || String(err), stack: err?.stack }, 500);
    }
});

type Sub = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; timezone: string; device_kind: string | null };

// לאן שולחים: כברירת מחדל רק לטלפון; "גם במחשב ובטאבלט" - לכולם. בלי טלפון בכלל - לכל מה שיש
function reminderTargets(userSubs: Sub[], allDevices: boolean) {
    const phones = userSubs.filter((s) => s.device_kind === "mobile");
    if (allDevices || !phones.length) return { primary: userSubs, fallback: [] as Sub[] };
    return { primary: phones, fallback: userSubs.filter((s) => s.device_kind !== "mobile") };
}

async function handleRequest(): Promise<Response> {
    const now = new Date();

    // כל המנויים הפעילים, מקובצים לפי user_id - כדי לדעת אילו משתמשים בכלל צריך לבדוק
    const { data: subs, error: subsError } = await supabase
        .from("push_subscriptions")
        .select("id, user_id, endpoint, p256dh, auth, timezone, device_kind");
    if (subsError) return jsonResponse({ ok: false, error: subsError.message }, 500);
    if (!subs || !subs.length) return jsonResponse({ ok: true, checked: 0, sent: 0 });

    const subsByUser = new Map<string, Sub[]>();
    for (const s of subs as Sub[]) {
        if (!subsByUser.has(s.user_id)) subsByUser.set(s.user_id, []);
        subsByUser.get(s.user_id)!.push(s);
    }
    const userIds = [...subsByUser.keys()];

    let sent = 0;
    let checked = 0;

    // שולח ליעדים הראשיים; אם אף אחד מהם לא הגיע (למשל המנוי של הטלפון מת) - לשאר המכשירים
    const pushToUser = async (targets: { primary: Sub[]; fallback: Sub[] }, payload: unknown, options: Record<string, unknown>) => {
        const sendTo = async (list: Sub[]) => {
            let ok = false;
            for (const sub of list) {
                try {
                    // urgency: 'high' - בלי זה FCM/הדפדפן מרשים לעצמם לדחות מסרים "רגילים"
                    // כשהמכשיר ב-Doze/חיסכון סוללה (דווח בפועל כתזכורת שהגיעה באיחור ניכר)
                    await webpush.sendNotification(
                        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                        JSON.stringify(payload),
                        options,
                    );
                    ok = true;
                    sent++;
                } catch (err: any) {
                    // מנוי מת (הדפדפן בוטל/הותקן מחדש) - מסירים אותו כדי לא לנסות שוב לשווא
                    if (err?.statusCode === 404 || err?.statusCode === 410) {
                        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
                    }
                }
            }
            return ok;
        };
        return (await sendTo(targets.primary)) || (targets.fallback.length ? await sendTo(targets.fallback) : false);
    };

    // ניקיון: נודניקים ישנים (למשל של משתמש/ת בלי מנוי Push), מסירות ישנות ונוכחות שפגה
    await Promise.all([
        supabase.from("reminder_snoozes").delete().lt("next_at", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("reminder_deliveries").delete().lt("delivered_at", new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("reminder_presence").delete().lt("visible_until", new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()),
    ]);

    const [{ data: prefs }, { data: presence }] = await Promise.all([
        supabase.from("user_premium").select("user_id, reminder_all_devices, language, calendar_prefs, water_prefs").in("user_id", userIds),
        supabase.from("reminder_presence").select("user_id").in("user_id", userIds).gt("visible_until", now.toISOString()),
    ]);
    const allDevicesUsers = new Set((prefs ?? []).filter((p) => p.reminder_all_devices).map((p) => p.user_id));
    const userLang = new Map((prefs ?? []).map((p) => [p.user_id, String(p.language || "he")]));
    const userCalPrefs = new Map((prefs ?? []).map((p) => [p.user_id, (p.calendar_prefs && typeof p.calendar_prefs === "object" ? p.calendar_prefs : {}) as Record<string, unknown>]));
    const userWaterPrefs = new Map((prefs ?? []).map((p) => [p.user_id, (p.water_prefs && typeof p.water_prefs === "object" ? p.water_prefs : {}) as Record<string, any>]));
    // סך המים של יום (log_date נשמר באפליקציה לפי התאריך המקומי) - לשורת המים ולתזכורת לפי הקצב
    const waterDay = async (userId: string, date: string) => {
        const { data, error } = await supabase.from("water_logs").select("amount_ml, created_at").eq("user_id", userId).eq("log_date", date);
        if (error) return null;
        const rows = data ?? [];
        return { total: rows.reduce((s, r) => s + (Number(r.amount_ml) || 0), 0), lastAt: rows.reduce((m, r) => Math.max(m, new Date(r.created_at).getTime() || 0), 0) };
    };
    // תזכורות היומן החדשות (שלב 3) נתפסות כמו כל תזכורת - אבל שגיאה כאן = לא שולחים (לא מסתכנים בהתראה כל דקה)
    const claimCalDelivery = async (userId: string, sourceType: string, sourceId: string, sourceDate: string, deviceKind: string) => {
        const { data, error } = await supabase.from("reminder_deliveries").upsert(
            { user_id: userId, source_type: sourceType, source_id: sourceId, source_date: sourceDate, channel: "push", device_kind: deviceKind },
            { onConflict: DELIVERY_KEY, ignoreDuplicates: true },
        ).select("source_id");
        if (error) return false;
        return (data ?? []).length > 0;
    };
    const appOpenUsers = new Set((presence ?? []).map((p) => p.user_id));

    // "תופסים" את התזכורת: רק מי שמכניס ראשון את השורה מוסר אותה (האפליקציה עושה בדיוק אותו דבר).
    // שגיאה (לא "כבר קיים") - שולחים בכל זאת: עדיף מאשר לאבד תזכורת, ו-last_notified_date עדיין שומר מכפילות
    const claimDelivery = async (userId: string, sourceType: string, sourceId: string, sourceDate: string, deviceKind: string) => {
        const { data, error } = await supabase.from("reminder_deliveries").upsert(
            { user_id: userId, source_type: sourceType, source_id: sourceId, source_date: sourceDate, channel: "push", device_kind: deviceKind },
            { onConflict: DELIVERY_KEY, ignoreDuplicates: true },
        ).select("source_id");
        if (error) return true;
        return (data ?? []).length > 0;
    };

    for (const [userId, userSubs] of subsByUser) {
        const timeZone = userSubs[0]?.timezone || "UTC";
        const wallClock = getLocalWallClock(now, timeZone);
        const nowMinutes = wallClock.hour * 60 + wallClock.minute;
        const allDevices = allDevicesUsers.has(userId);
        const targets = reminderTargets(userSubs, allDevices);
        const targetKind = allDevices ? "all" : (targets.primary.some((s) => s.device_kind === "mobile") ? "mobile" : "all");
        const appOpen = appOpenUsers.has(userId);
        // הכפתורים במילים, בשפה של המשתמש/ת (לפי בקשה מפורשת, 2026-11-25: בלי ⏰ ובלי אימוג׳י בהתראה)
        const words = ACTION_WORDS[userLang.get(userId) || "he"] || ACTION_WORDS.en;
        const actions = [
            { action: "done", title: words[0] },
            { action: "not_done", title: words[1] },
        ];

        const { data: dueRows } = await supabase
            .from("weekly_schedule")
            .select("id, task_title, reminder_text, reminder_minutes, time_of_day, last_notified_date")
            .eq("user_id", userId)
            .eq("day_of_week", wallClock.dbDay)
            .gt("reminder_minutes", 0);
        // גם אירועים חד-פעמיים ב"מבט ליומן" (calendar_events), לפי event_date מדויק. גם אירוע שמסונכרן
        // עם גוגל מקבל התראה מכאן: בגוגל הוא נשמר בלי תזכורות (ר' google-calendar-outbox-drain)
        const { data: dueEvents } = await supabase
            .from("calendar_events")
            .select("id, event_title, reminder_text, reminder_minutes, event_time, last_notified_date")
            .eq("user_id", userId)
            .eq("event_date", wallClock.dateStr)
            .gt("reminder_minutes", 0);

        // גם אימונים מטבלת האימונים (workout_plan) עם תזכורת - בימים שלהם (0 = ראשון). הכותרת והטקסט נשמרו
        // באפליקציה בשפת המשתמש/ת. שגיאה כאן לא עוצרת את שאר התזכורות
        const dayIdx = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].indexOf(wallClock.dbDay);
        const { data: workoutRows } = await supabase
            .from("workout_plan")
            .select("id, reminder_title, reminder_text, reminder_minutes, time, days, last_notified_date")
            .eq("user_id", userId)
            .gt("reminder_minutes", 0);
        const dueWorkouts = (workoutRows ?? []).filter((w) => Array.isArray(w.days) && w.days.map(Number).includes(dayIdx));

        const candidates = [
            ...(dueRows ?? []).map((r) => ({ type: "schedule", table: "weekly_schedule", id: r.id, title: r.task_title, body: r.reminder_text, minutes: r.reminder_minutes, time: r.time_of_day, last: r.last_notified_date })),
            ...(dueEvents ?? []).map((r) => ({ type: "event", table: "calendar_events", id: r.id, title: r.event_title, body: r.reminder_text, minutes: r.reminder_minutes, time: r.event_time, last: r.last_notified_date })),
            ...dueWorkouts.map((r) => ({ type: "workout", table: "workout_plan", id: r.id, title: r.reminder_title, body: r.reminder_text, minutes: r.reminder_minutes, time: r.time, last: r.last_notified_date })),
        ];
        const due = candidates.filter((row) => {
            checked++;
            if (!row.time) return false;
            if (row.last === wallClock.dateStr) return false; // כבר נשלח היום
            const [h, m] = String(row.time).split(":").map((n: string) => parseInt(n, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) return false;
            const taskMinutes = h * 60 + m;
            const triggerMinutes = taskMinutes - row.minutes;
            // אם הפונקציה לא רצה בזמן, עדיף לשלוח באיחור פעם אחת מאשר לפספס - אבל לא על משימה
            // שהתחילה לפני יותר משעה: התראה בשלוש לפנות בוקר על משהו מחצות היא רק רעש
            if (nowMinutes < triggerMinutes || nowMinutes > taskMinutes + LATE_LIMIT_MINUTES) return false;
            // האפליקציה פתוחה מול העיניים - היא תציג את התזכורת בעצמה
            return !(appOpen && nowMinutes - triggerMinutes < PRESENCE_WAIT_MINUTES);
        });
        // מה שכבר נמסר היום (באפליקציה או כאן) או שכבר ענו עליו - לא נוגעים
        let deliveredToday = new Set<string>();
        if (due.length) {
            const { data: todays } = await supabase.from("reminder_deliveries").select("source_type, source_id").eq("user_id", userId).eq("source_date", wallClock.dateStr);
            deliveredToday = new Set((todays ?? []).map((d) => `${d.source_type}:${d.source_id}`));
        }

        for (const row of due) {
            if (deliveredToday.has(`${row.type}:${row.id}`)) continue;
            if (!(await claimDelivery(userId, row.type, row.id, wallClock.dateStr, targetKind))) continue;

            // tag דטרמיניסטי - אותה נוסחה בדיוק כמו reminderNotificationTag ב-app.js (כדי שהאפליקציה
            // תוכל לסגור את ההתראה כשעונים במקום אחר); actions = "בוצע" / "עוד לא" על ההתראה עצמה,
            // ו-userId בתוך data כי אין session בתוך ה-Service Worker (ר' mark-reminder-done)
            const tag = `weekwise-reminder-${row.type}-${row.id}-${wallClock.dateStr}`;
            const data = { sourceType: row.type, sourceId: row.id, sourceDate: wallClock.dateStr, userId, taskTitle: row.title || "", text: row.body || "" };
            const title = row.title || "NOT10.ai";
            // TTL קצר יחסית (10 דק') - תזכורת שלא הגיעה תוך זמן סביר כבר לא רלוונטית
            // בגוף: הטקסט של התזכורת, ואם אין - השעה של המשימה (בלי מילים, אז בלי תרגום)
            const body = row.body || String(row.time || "").slice(0, 5);
            const delivered = await pushToUser(targets, { title, body, tag, actions, data }, { urgency: "high", TTL: 600 });
            if (delivered) {
                await supabase.from(row.table).update({ last_notified_date: wallClock.dateStr }).eq("id", row.id);
            }
        }

        // ⏰ יומן שלב 3: עוד תזכורות לפני אירוע (extra_reminders, דקות לפני) ו"הגיע הזמן לצאת" (travel_minutes).
        // התראת מידע: בלי "בוצע" / "עוד 10 דק׳" - לחיצה פותחת את היומן על היום של האירוע. כל אחת נמסרת פעם אחת
        // (reminder_deliveries: event_r<דקות> / event_leave לכל אירוע ותאריך). מחפשים עד 29 יום קדימה (התזכורת הכי רחוקה = 4 שבועות)
        const lang = userLang.get(userId) || "he";
        const calWords = CAL_WORDS[lang] || CAL_WORDS.en;
        const todayNum = dayNumOf(wallClock.dateStr);
        const nowAbs = todayNum * 1440 + nowMinutes;
        const { data: extraEvents } = await supabase
            .from("calendar_events")
            .select("id, event_title, event_date, event_time, extra_reminders, travel_minutes, location, is_completed")
            .eq("user_id", userId)
            .gte("event_date", wallClock.dateStr)
            .lte("event_date", dateOfNum(todayNum + 29))
            .or("extra_reminders.not.is.null,travel_minutes.gt.0");
        for (const ev of extraEvents ?? []) {
            if (ev.is_completed) continue;
            const evMin = toMin(ev.event_time);
            const evAbs = dayNumOf(ev.event_date) * 1440 + (evMin ?? ALL_DAY_ANCHOR_MINUTES);
            const list: { kind: string; m: number; leave: boolean }[] = (Array.isArray(ev.extra_reminders) ? ev.extra_reminders : [])
                .map((m: number) => Number(m)).filter((m: number) => m >= 0 && m <= 40320)
                .map((m: number) => ({ kind: `event_r${m}`, m, leave: false }));
            if (Number(ev.travel_minutes) > 0 && evMin !== null) list.push({ kind: "event_leave", m: Number(ev.travel_minutes), leave: true });
            for (const r of list) {
                checked++;
                const fire = evAbs - r.m;
                if (nowAbs < fire || nowAbs - fire > EXTRA_LATE_MINUTES) continue;
                if (!(await claimCalDelivery(userId, r.kind, ev.id, ev.event_date, targetKind))) continue;
                const daysAway = dayNumOf(ev.event_date) - todayNum;
                const when = [daysAway ? relativeDay(lang, daysAway) : "", ev.event_time ? String(ev.event_time).slice(0, 5) : (daysAway ? "" : relativeDay(lang, 0))].filter(Boolean).join(" · ");
                const title = r.leave ? `${calWords.leave} · ${ev.event_title || ""}` : (ev.event_title || "NOT10.ai");
                const body = [when, ev.location || ""].filter(Boolean).join(" · ");
                const tag = `weekwise-cal-${r.kind}-${ev.id}-${ev.event_date}`;
                await pushToUser(targets, { title, body, tag, data: { open: "calendar", date: ev.event_date } }, { urgency: "high", TTL: 1800 });
            }
        }

        // ☀️ סיכום בוקר (היום) ו-🌙 "מה מחר" (בערב) - השעה נבחרת בהגדרות היומן (user_premium.calendar_prefs.morning / evening).
        // עד חצי שעה באיחור, פעם אחת ביום (reminder_deliveries: cal_morning / cal_evening). יום ריק - לא שולחים כלום
        const calPrefs = userCalPrefs.get(userId) || {};
        for (const [kind, time, offset] of [["cal_morning", calPrefs.morning, 0], ["cal_evening", calPrefs.evening, 1]] as [string, unknown, number][]) {
            const at = typeof time === "string" && /^\d{2}:\d{2}$/.test(time) ? toMin(time) : null;
            if (at === null || nowMinutes < at || nowMinutes - at > EXTRA_LATE_MINUTES) continue;
            checked++;
            const date = dateOfNum(todayNum + offset);
            if (!(await claimCalDelivery(userId, kind, userId, date, targetKind))) continue;
            const [{ data: dayEvents }, { data: hiddenCals }, { data: fixed }] = await Promise.all([
                supabase.from("calendar_events").select("event_title, event_time, calendar_id, is_completed")
                    .eq("user_id", userId).lte("event_date", date).or(`event_date.eq.${date},end_date.gte.${date}`)
                    .not("source", "in", CAL_INTERNAL_SOURCES),
                supabase.from("user_calendars").select("id").eq("user_id", userId).eq("is_visible", false),
                supabase.from("weekly_schedule").select("task_title, time_of_day").eq("user_id", userId).eq("day_of_week", WEEKDAY_NAMES[new Date(dayNumOf(date) * 86400000).getUTCDay()]),
            ]);
            const hidden = new Set((hiddenCals ?? []).map((c) => c.id));
            const items = [
                ...(dayEvents ?? []).filter((e) => !e.is_completed && !(e.calendar_id && hidden.has(e.calendar_id))).map((e) => ({ time: e.event_time ? String(e.event_time).slice(0, 5) : "", title: e.event_title || "" })),
                ...(fixed ?? []).map((f) => ({ time: f.time_of_day ? String(f.time_of_day).slice(0, 5) : "", title: f.task_title || "" })),
            ].filter((i) => i.title).sort((a, b) => (a.time || "").localeCompare(b.time || ""));
            if (!items.length) continue;
            const lines = items.slice(0, SUMMARY_MAX_LINES).map((i) => `${i.time || "•"} ${i.title}`);
            if (items.length > SUMMARY_MAX_LINES) lines.push(`+${items.length - SUMMARY_MAX_LINES}`);
            // 💧 שורת מים: בבוקר - כמה שתו אתמול; בערב - כמה היום מתוך היעד. רק כשיש מה לספר (לא "0")
            const wp = userWaterPrefs.get(userId) || {};
            const wUnit = wp.unit === "oz" ? "oz" : "ml";
            const ww = WATER_WORDS[lang] || WATER_WORDS.en;
            const wDay = await waterDay(userId, offset ? wallClock.dateStr : dateOfNum(todayNum - 1));
            if (wDay && wDay.total > 0) {
                const goal = Number(wp.goal) > 0 ? Number(wp.goal) : 0;
                lines.push(offset
                    ? `${ww.d}: ${waterAmount(wDay.total, wUnit, lang)}${goal ? ` / ${waterAmount(goal, wUnit, lang)}` : ""}`
                    : `${ww.y}: ${waterAmount(wDay.total, wUnit, lang)}`);
            }
            const title = offset ? calWords.tomorrow : calWords.today;
            await pushToUser(targets, { title, body: lines.join("\n"), tag: `weekwise-${kind}-${date}`, data: { open: "calendar", date } }, { urgency: "normal", TTL: 3600 });
        }

        // 💧 תזכורת שתייה לפי הקצב (water_prefs.remind = { on, from, to }): רק כשמפגרים אחרי הקצב של היום בכוס בערך,
        // בין השעות שנבחרו, לכל היותר פעם בחלון של שעתיים (reminder_deliveries: water_s<חלון>), לא אחרי שתייה
        // ב-45 הדקות האחרונות, ושקט לגמרי כשהיעד הושג. לחיצה פותחת את מעקב המים
        const wPrefs = userWaterPrefs.get(userId) || {};
        const wRemind = wPrefs.remind && typeof wPrefs.remind === "object" ? wPrefs.remind : null;
        if (wRemind && wRemind.on === true && !appOpen) {
            const from = toMin(typeof wRemind.from === "string" ? wRemind.from : "08:00");
            const to = toMin(typeof wRemind.to === "string" ? wRemind.to : "22:00");
            const goal = Number(wPrefs.goal) > 0 ? Number(wPrefs.goal) : 2000;
            if (from !== null && to !== null && to > from && nowMinutes >= from + 60 && nowMinutes < to) {
                checked++;
                const wDay = await waterDay(userId, wallClock.dateStr);
                const cupSizes = (Array.isArray(wPrefs.cups) ? wPrefs.cups : []).map((c: any) => Number(c?.ml) || 0).filter((x: number) => x > 0);
                const cup = Math.max(150, Math.min(250, ...cupSizes));
                const expected = goal * (nowMinutes - from) / (to - from);
                if (wDay && wDay.total < goal && expected - wDay.total >= cup && now.getTime() - wDay.lastAt > WATER_QUIET_AFTER_LOG_MS) {
                    const slot = Math.floor((nowMinutes - from) / 120);
                    if (await claimCalDelivery(userId, `water_s${slot}`, userId, wallClock.dateStr, targetKind)) {
                        const wUnit = wPrefs.unit === "oz" ? "oz" : "ml";
                        const ww = WATER_WORDS[lang] || WATER_WORDS.en;
                        const body = `${waterAmount(wDay.total, wUnit, lang)} / ${waterAmount(goal, wUnit, lang)}`;
                        await pushToUser(targets, { title: ww.t, body, tag: `weekwise-water-${wallClock.dateStr}`, data: { open: "water" } }, { urgency: "normal", TTL: 1800 });
                    }
                }
            }
        }

        // נודניק: "עוד לא" (בהתראה או בפופאפ) נכנס ל-reminder_snoozes - התראה חוזרת כל 5 דקות עד
        // "בוצע" / "הבנתי", עד 6 פעמים אם מתעלמים. אם המשימה כבר סומנה כבוצעה - מפסיקים בשקט
        const { data: snoozes } = await supabase
            .from("reminder_snoozes")
            .select("*")
            .eq("user_id", userId)
            .lte("next_at", now.toISOString())
            .gt("remaining", 0);
        for (const sn of snoozes ?? []) {
            checked++;
            const key = { user_id: userId, source_type: sn.source_type, source_id: sn.source_id, source_date: sn.source_date };
            const removeSnooze = () => supabase.from("reminder_snoozes").delete().match(key);
            const overdueMs = now.getTime() - new Date(sn.next_at).getTime();
            if (overdueMs > LATE_LIMIT_MINUTES * 60 * 1000) { await removeSnooze(); continue; }
            let done = false;
            if (sn.source_type === "event") {
                const { data: ev } = await supabase.from("calendar_events").select("is_completed").eq("id", sn.source_id).maybeSingle();
                done = !ev || !!ev.is_completed;
            } else if (sn.source_type === "workout") {
                // אימון - "נעשה" כשנרשם בהיסטוריית הספורט באותו יום (או כשנמחק מהטבלה)
                const [{ data: logged }, { data: w }] = await Promise.all([
                    supabase.from("sport_sessions").select("id").eq("source_workout_id", sn.source_id).eq("session_date", sn.source_date).limit(1),
                    supabase.from("workout_plan").select("id").eq("id", sn.source_id).maybeSingle(),
                ]);
                done = (logged ?? []).length > 0 || !w;
            } else {
                const [{ data: comp }, { data: sched }] = await Promise.all([
                    supabase.from("schedule_completions").select("schedule_id").eq("schedule_id", sn.source_id).eq("completion_date", sn.source_date).maybeSingle(),
                    supabase.from("weekly_schedule").select("id").eq("id", sn.source_id).maybeSingle(),
                ]);
                done = !!comp || !sched;
            }
            if (done) { await removeSnooze(); continue; }
            // האפליקציה פתוחה מול העיניים - היא תיקח את הסבב בעצמה
            if (appOpen && overdueMs < PRESENCE_WAIT_MINUTES * 60 * 1000) continue;

            // לוקחים את הסבב: רק אם next_at עדיין הישן (אחרת מכשיר אחר כבר לקח אותו)
            const remaining = (sn.remaining || 1) - 1;
            const { data: won } = await supabase.from("reminder_snoozes")
                .update({ remaining, next_at: new Date(now.getTime() + SNOOZE_MINUTES * 60 * 1000).toISOString() })
                .match(key).eq("next_at", sn.next_at).select("source_id");
            if (!won || !won.length) continue;
            if (remaining <= 0) await removeSnooze();

            const title = sn.title || "NOT10.ai";
            // אותו tag כמו ההתראה המקורית - מחליף אותה במקום להצטבר, ו-renotify כדי שתצלצל שוב
            const tag = `weekwise-reminder-${sn.source_type}-${sn.source_id}-${sn.source_date}`;
            const data = { sourceType: sn.source_type, sourceId: sn.source_id, sourceDate: sn.source_date, userId, snooze: true, taskTitle: sn.title || "", text: sn.body || "" };
            await pushToUser(targets, { title, body: sn.body || "", tag, actions, data, renotify: true }, { urgency: "high", TTL: 300 });
        }

        // תזכורות ארוחה של New Me: שעה אחת לכל ארוחה (new_me_reminders, הטקסט נכתב מהאפליקציה
        // בשפת המשתמש/ת). לא שולחים אם הארוחה כבר סומנה ✓ היום, ולא שולחים באיחור של יותר
        // משעה וחצי - תזכורת לארוחת בוקר בצהריים היא רק רעש. גם הן - רק לטלפון כברירת מחדל
        const { data: mealRems } = await supabase
            .from("new_me_reminders")
            .select("position, slot, time, title, body, today_body, today_date, last_sent_date")
            .eq("user_id", userId)
            .eq("enabled", true);
        const dueMeals = (mealRems ?? []).filter((r) => {
            if (r.last_sent_date === wallClock.dateStr) return false;
            const [h, m] = String(r.time || "").split(":").map((n: string) => parseInt(n, 10));
            if (Number.isNaN(h) || Number.isNaN(m)) return false;
            const dueAt = h * 60 + m;
            return nowMinutes >= dueAt && nowMinutes - dueAt <= 90;
        });
        if (dueMeals.length) {
            const [{ data: prof }, { data: eatenRows }] = await Promise.all([
                supabase.from("new_me_profile").select("reminders_on").eq("user_id", userId).maybeSingle(),
                supabase.from("new_me_checkins").select("slot").eq("user_id", userId).eq("checkin_date", wallClock.dateStr),
            ]);
            const eaten = new Set((eatenRows ?? []).map((c) => c.slot));
            for (const r of prof?.reminders_on ? dueMeals : []) {
                if (eaten.has(r.slot)) {
                    await supabase.from("new_me_reminders").update({ last_sent_date: wallClock.dateStr }).eq("user_id", userId).eq("position", r.position);
                    continue;
                }
                const body = r.today_date === wallClock.dateStr && r.today_body ? r.today_body : (r.body || "");
                const tag = `weekwise-newme-meal-${r.position}-${wallClock.dateStr}`;
                const delivered = await pushToUser(targets, { title: r.title || "🍽️ NOT10 Nourish+", body, tag, data: { open: "newme" } }, { urgency: "high", TTL: 1800 });
                if (delivered) {
                    await supabase.from("new_me_reminders").update({ last_sent_date: wallClock.dateStr }).eq("user_id", userId).eq("position", r.position);
                }
            }
        }
    }

    return jsonResponse({ ok: true, usersChecked: subsByUser.size, remindersChecked: checked, sent });
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}
