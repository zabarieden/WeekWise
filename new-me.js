// ===== New Me: תוכנית תפריט 1,300 / 1,500 קלוריות (רכישה חד-פעמית, נפרדת מפרימיום) =====
// הכול נבנה דינמית בתוך #new-me-root (index.html) לפי מצב:
//   לא נרכש → כרטיס מכירה | נרכש בלי פרופיל → שאלון (הצהרה רפואית חובה) | אחרת → המסך הראשי.
// המסך הראשי = "היום": טבעת קלוריות + יום X במסע, התפריט של היום ישירות (בלי לחיצה נוספת),
// שתייה, צ'ק-אין ערב (מ-19:30) ואריחים לכל השאר (מסע, קניות, הישגים, מדידות, תמונות...).
// ✓ על ארוחה נרשם ב-new_me_checkins וגם משוכפל ל-calorie_tracker (source='new_me'), כך
// שמעקב הארוחות היומי, ההצצה להיום והסטטיסטיקות מתעדכנים לבד. אם במשבצת כבר היה
// רישום חופשי - מצרפים אליו (בלי לדרוס), וביטול ה-✓ מסיר רק את החלק של New Me.
// פריט בתפריט מזוהה במפתח הטקסט שלו (p1300_meal2_B = תוכנית_ארוחה_אפשרות) - כך החלפה יכולה
// להביא כל אפשרות מכל התפריט. נתוני התפריט, המרכיבים והטקסטים לפי שפה - new-me-data.js.

const NEW_ME_DISCLAIMER_VERSION = '2026-09-29';
// קובצי ה-PDF נוצרים מהטקסט המתוקן שבאפליקציה (לא מהקבצים המקוריים, שבהם היו טעויות
// תרגום) - שפה בלי קובץ מקבלת אנגלית (ר' new-me-pdf-url)
function nmPdfEnabled() { return true; }
// משבצת New Me → meal_type הקיים במעקב הארוחות (meal_4 = נשנוש 1, שם היסטורי)
const NEW_ME_TRACKER_SLOT = { meal1: 'meal_1', snack1: 'meal_4', meal2: 'meal_2', snack2: 'snack' };
// קטגוריית "ארוחה שמורה" לפי שעת היום של המיקום (בוקר / נשנוש / צהריים / נשנוש ערב)
const NEW_ME_PRESET_CATEGORY_BY_POS = ['morning', 'snack', 'noon', 'snack'];
const NEW_ME_TILE_ICONS = { day: '📋', challenges: '🏆', gift: '🎁', stats: '📊', journey: '📈', shop: '🛒', badges: '🏅', measure: '📏', photos: '📸', month: '📅', table: '📋', reminders: '⏰', pdf: '📄', settings: '⚙️', bonus: '📰' };
// אתגרים, מכתב מהעבר והמתנה בסוף (תעודה, מצב מתקדם וסטטיסטיקות) - new-me-challenges.js
const NEW_ME_TILES = ['challenges', 'journey', 'shop', 'badges', 'measure', 'photos', 'month', 'table', 'reminders', 'pdf'];
const NEW_ME_VIEW_TITLES = { day: 'nm_hall_day', challenges: 'nm_tile_challenges', gift: 'nm_gift_title', stats: 'nm_stats_title', journey: 'nm_tile_journey', shop: 'nm_tile_shop', badges: 'nm_tile_badges', measure: 'nm_tile_measure', photos: 'nm_tile_photos', month: 'nm_tile_calendar', table: 'nm_tile_table', reminders: 'nm_tile_reminders', pdf: 'nm_tile_pdf', settings: 'nm_tile_settings' };
// אחרי כל האתגרים: אריח למתנה, ובמצב מתקדם - גם לסטטיסטיקות
function nmTiles() {
    const extra = [];
    if (typeof nmChAllDone === 'function' && nmChAllDone()) extra.push('gift');
    if (nmGodMode()) extra.push('stats');
    return NEW_ME_TILES.slice(0, 1).concat(extra, NEW_ME_TILES.slice(1));
}
// הישגים: אייקון + סוג (תנאי). הטקסטים ב-i18n (nm_badge_*); streak/day/kg משתמשים בטקסט אחד עם {n}
const NEW_ME_BADGES = [
    { key: 'first_meal', icon: '🌱' },
    { key: 'perfect_day', icon: '⭐' },
    { key: 'streak_3', icon: '🔥', kind: 'streak', n: 3 },
    { key: 'streak_7', icon: '🔥', kind: 'streak', n: 7 },
    { key: 'streak_14', icon: '💎', kind: 'streak', n: 14 },
    { key: 'streak_30', icon: '👑', kind: 'streak', n: 30 },
    { key: 'day_7', icon: '🌿', kind: 'day', n: 7 },
    { key: 'day_30', icon: '🌳', kind: 'day', n: 30 },
    { key: 'day_60', icon: '🏔️', kind: 'day', n: 60 },
    { key: 'day_90', icon: '🏆', kind: 'day', n: 90 },
    { key: 'kg_1', icon: '⚖️', kind: 'kg', n: 1 },
    { key: 'kg_3', icon: '🎈', kind: 'kg', n: 3 },
    { key: 'kg_5', icon: '🚀', kind: 'kg', n: 5 },
    { key: 'kg_10', icon: '🌠', kind: 'kg', n: 10 },
    { key: 'goal_reached', icon: '🎯' },
    { key: 'checkins_7', icon: '🌙' },
    { key: 'first_measure', icon: '📏' },
    { key: 'first_photo', icon: '📸' },
    { key: 'free_meal', icon: '🍕' },
    { key: 'shopping', icon: '🛒' },
    { key: 'first_swap', icon: '🔄' }
];
// אבני דרך במסע - 7/30/60/90 לפי הבקשה, ואחריהן ממשיכים בלי סוף
const NEW_ME_MILESTONE_PATH = [7, 30, 60, 90, 120, 180, 270, 365, 545, 730, 1095, 1460, 1825];
const NEW_ME_MILESTONE_ICONS = { 7: '🌱', 30: '🌿', 60: '🌳', 90: '🏆', 120: '⭐', 180: '🌟', 270: '💫', 365: '👑' };
const NEW_ME_MEASURE_FIELDS = ['waist', 'hips', 'arm', 'thigh'];
// צ'ק-אין ערב: סולם 1-5 לכל שאלה (1 = נמוך, 5 = גבוה)
const NEW_ME_CHECKIN_KEYS = ['hunger', 'energy', 'mood'];
const NEW_ME_CHECKIN_SCALES = {
    hunger: ['😌', '🙂', '😐', '😕', '😩'],
    energy: ['🪫', '😴', '😐', '🙂', '⚡'],
    mood: ['😞', '😕', '😐', '🙂', '😄']
};
const NEW_ME_CHECKIN_FROM_MIN = 19 * 60 + 30;   // הכרטיס מופיע מ-19:30 (לפי בקשה מפורשת)
const NM_GRIP_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="currentColor"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></g></svg>';
const NM_CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

let nmProfile = null;          // שורת new_me_profile (או null)
let nmProfileLoaded = false;
let nmView = 'home';           // home | journey | shop | badges | measure | photos | month | table | reminders | settings
let nmQuiz = null;             // מצב השאלון בזמן מילוי
let nmTodayCheckins = {};      // slot → row, להיום
let nmTrackerToday = [];       // כל רישומי calorie_tracker של היום (מקור האמת לסכום - כמו ההצצה להיום)
let nmDrinkDraftRows = 0;      // שורות-הזנה ריקות נוספות לשתייה (מעבר למינימום)
let nmDrinkDraftsCache = [];    // מה שהוקלד בשורות השתייה ועוד לא נוסף - נשמר בין רינדורים
let nmSavedDrinks = [];        // משקאות קבועים (new_me_saved_drinks) - לחיצה אחת מוסיפה
let nmWeekDays = [];           // שורות new_me_days של השבוע הנוכחי והבא (ראשון-שבת) - ארוחה חופשית מתוכננת עד שבוע קדימה
let nmToday = null;            // שורת new_me_days של היום: החלפות להיום, ארוחה חופשית, צ'ק-אין
let nmReminders = [];          // new_me_reminders (שעה לכל מיקום ארוחה)
let nmReminderSig = '';        // חתימת התזכורות שנשמרו לאחרונה - לא כותבים שוב אם לא השתנה כלום
let nmStats = [];              // new_me_day_stats מתחילת המסע ועד היום
let nmBadges = {};             // badge → earned_at
let nmWeights = [];            // weight_tracker (עולה לפי תאריך)
let nmLastPhotoDay = null;     // התאריך של תמונת ההתקדמות האחרונה
let nmHasMeasure = false;
let nmJourneyLoaded = false;
let nmCheckinDraft = null;     // { hunger, energy, mood } בזמן מילוי הצ'ק-אין
let nmCheckinEditing = false;
let nmTableDate = null;
let nmMonthKey = null;         // 'YYYY-MM'
let nmMeasures = [];
let nmPhotos = [];
let nmPhotoUrls = {};          // path → signed URL (שעה)
let nmCompare = { before: null, after: null };
let nmShopDays = 7;
let nmShopOff = new Set();     // מרכיבים שהורדו מהרשימה ("יש בבית")
let nmLateEditing = false;     // התזכורות: הבחירה של 21:00 פתוחה לשינוי (אחרי בחירה היא נסגרת לשורה אחת)
let nmPendingDeepLink = false; // לחיצה על תזכורת ארוחה - פותחים את New Me כשמצב הרכישה ידוע
let nmCustomMeals = [];        // new_me_custom_meals: ארוחות שנבחרו מהארוחות הקבועות או נכתבו ל-AI (מפתח c_<id>)
let nmBurnedToday = 0;         // קלוריות שנשרפו באימונים היום - מגדילות את התקציב (לפי בחירה מפורשת)

function nmEsc(s) { return escapeHtmlForReport(s == null ? '' : s); }
function nmFmt(n) { try { return Number(n).toLocaleString(currentLang); } catch { return String(n); } }
function nmFmtNum(n, digits = 1) { try { return new Intl.NumberFormat(currentLang, { maximumFractionDigits: digits }).format(n); } catch { return String(n); } }
// {spread} / {cereal} / {milk} / {light} בטקסט = מה שנבחר בתוך האפשרות ("זה או זה או זה" - ר' nmPicks)
function nmFillPicks(s) { return String(s).replace(/\{(spread|cereal|milk|light)\}/g, (m, g) => nmPicksText(g)); }
function nmOptText(plan, slot, opt, short) { return nmFillPicks(newMeText(`p${plan}_${slot}_${opt}${short ? '_t' : ''}`)); }
function nmRoot() { return document.getElementById('new-me-root'); }
function nmDate(ds) { return new Date(ds + 'T12:00:00'); }
function nmShortDate(ds) { return new Intl.DateTimeFormat(currentLang, { day: 'numeric', month: 'short' }).format(nmDate(ds)); }
function nmLongDate(ds) { return new Intl.DateTimeFormat(currentLang, { day: 'numeric', month: 'long' }).format(nmDate(ds)); }
function nmWeekdayName(ds) { return new Intl.DateTimeFormat(currentLang, { weekday: 'long' }).format(nmDate(ds)); }
function nmDaysBetween(a, b) { return Math.round((nmDate(b) - nmDate(a)) / 86400000); }
function nmAddDays(ds, n) { const d = nmDate(ds); d.setDate(d.getDate() + n); return getLocalDateString(d); }
// שבוע = ראשון עד שבת, כמו שאר לוחות השנה באפליקציה
function nmWeekStart() { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return getLocalDateString(d); }
function nmWeekEnd() { return nmAddDays(nmWeekStart(), 6); }
function nmMinutesNow() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
// גלילה בתוך אזור התוכן שגולל (לא scrollIntoView, שמזיז גם את המסגרת החיצונית של
// האפליקציה ומשאיר את ☰/▦ חתוכים אחרי היציאה)
function nmScroller() {
    let el = nmRoot();
    while (el && el !== document.body) {
        const oy = getComputedStyle(el).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
        el = el.parentElement;
    }
    return null;
}
function nmScrollTop() { const s = nmScroller(); if (s) s.scrollTop = 0; }
// <bdi> כדי ש-~430 לא יקפוץ לסוף השורה בעברית/ערבית (bidi)
function nmMeta(o) { return `<bdi dir="ltr">~${o.kcal}</bdi> ${nmEsc(t('calories_unit'))} · ${nmEsc(t('nm_protein_short').replace('{n}', o.protein))}`; }
// טקסט מתורגם עם מספרים: כל {x} (כולל סימן צמוד לפניו ~ + − ± ו-% אחריו) נעטף ב-<bdi dir="ltr">,
// אחרת בעברית/ערבית "−25" מוצג "25−" ו-"~700" מוצג "700~"
function nmTpl(key, vals) {
    return nmEsc(t(key)).replace(/([~+−±]?)\{(\w+)\}(%?)/g, (m, sign, k, pct) => (k in vals ? `<bdi dir="ltr">${sign}${nmEsc(vals[k])}${pct}</bdi>` : m));
}
function nmDiffChip(d) {
    const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'eq';
    return `<span class="nm-diff ${cls}"><bdi dir="ltr">${d > 0 ? '+' : d < 0 ? '−' : '±'}${Math.abs(d)}</bdi></span>`;
}
// "יום {n}" עם המספר מודגש - מפצלים סביב {n} כדי שגם שפות שבהן המספר בא קודם יעבדו
function nmDayHtml(n, cls = '') {
    const [a, b] = t('nm_day_n').split('{n}');
    return `<span class="nm-day-text ${cls}">${a ? `<span>${nmEsc(a.trim())}</span>` : ''}<b class="nm-num">${nmFmt(n)}</b>${b ? `<span>${nmEsc(b.trim())}</span>` : ''}</span>`;
}

// ---------- פריטים בתפריט ----------
function nmItemKey(plan, slot, opt) { return `p${plan}_${slot}_${opt}`; }
// האפשרויות של ארוחה בתוכנית (A–C מה-PDF, ו-D/E החדשות - לא בכל ארוחה)
function nmSlotOpts(plan, slot) { const s = NEW_ME_PLANS[plan] && NEW_ME_PLANS[plan][slot]; return s ? Object.keys(s.options) : []; }
function nmHasOpt(plan, slot, opt) { return nmSlotOpts(plan, slot).includes(opt); }
function nmParseItem(key) {
    const m = /^p(1300|1500)_(meal1|snack1|meal2|snack2)_([A-F])$/.exec(key || '');
    return m && nmHasOpt(Number(m[1]), m[2], m[3]) ? { key, plan: Number(m[1]), slot: m[2], opt: m[3] } : null;
}
// ארוחה אישית (מהארוחות הקבועות או מכתיבה ל-AI) - מפתח c_<uuid> מטבלת new_me_custom_meals
function nmIsCustomKey(key) { return /^c_[0-9a-f-]{36}$/i.test(key || ''); }
// ✨ התפריט האישי (מה-AI) של ארוחה - מהסבב האחרון שנשמר בפרופיל
function nmPersonalMenuKeys(slot) {
    const batch = nmProfile && nmProfile.ai_menu_batch;
    return batch ? nmCustomMeals.filter(m => m.source === 'ai_menu' && m.slot === slot && m.batch === batch).map(m => 'c_' + m.id) : [];
}
function nmCustomMeal(key) { return nmIsCustomKey(key) ? nmCustomMeals.find(m => 'c_' + m.id === key) || null : null; }
function nmValidKey(key) { return !!(nmParseItem(key) || nmCustomMeal(key)); }
function nmItemInfo(key) {
    const cm = nmCustomMeal(key);
    if (cm) return { key, custom: true, source: cm.source, plan: nmProfile ? nmProfile.plan : 1300, slot: null, opt: null, kcal: Number(cm.kcal) || 0, protein: Math.round((Number(cm.protein) || 0) * 10) / 10, name: cm.name, text: cm.description || '' };
    const p = nmParseItem(key);
    if (!p) return null;
    const o = NEW_ME_PLANS[p.plan][p.slot].options[p.opt];
    const n = nmOptNutrition(p.plan, p.slot, p.opt);
    return { ...p, kcal: n.kcal, protein: n.protein, small: !!o.small };
}
// 🧈 הבחירות שבתוך אפשרות (NEW_ME_PICKS, לפי בקשה מפורשת, 2026-10-14): בשאלון - מה שנבחר בו, אחרת מה שנשמר בפרופיל,
// ועד שבוחרים - ברירת המחדל. בטקסט: "זה או זה או זה"
function nmPicks(group) {
    const g = NEW_ME_PICKS[group];
    if (!g) return [];
    const src = nmQuiz && nmQuiz.picks ? nmQuiz.picks : nmProfile && nmProfile.picks;
    const list = src && Array.isArray(src[group]) ? src[group].filter(id => g.items[id]).slice(0, NEW_ME_PICKS_MAX) : [];
    return list.length ? list : g.def.slice();
}
function nmPicksText(group) { return nmPicks(group).map(id => nmPickInText(group, id)).join(` ${t('nm_or')} `); }
// הדברים הקלים כתובים כפריטים בפני עצמם ("A banana") - באמצע משפט האות הראשונה קטנה (לא בגרמנית, ששם שמות עצם באות גדולה)
function nmPickInText(group, id) {
    const s = t(nmPickTextKey(group, id));
    return group === 'light' && currentLang !== 'de' && /^\p{Lu}(?!\p{Lu})/u.test(s) ? s.charAt(0).toLocaleLowerCase(currentLang) + s.slice(1) : s;
}
function nmOptPicks(plan, slot, opt) { const s = NEW_ME_PLANS[plan] && NEW_ME_PLANS[plan][slot]; const o = s && s.options[opt]; return (o && o.picks) || []; }
// הקלוריות והחלבון של אפשרות: מה שכתוב בנתונים (עם ברירת המחדל של הבחירות) + ההפרש בין הממוצע של מה שנבחר לממוצע של ברירת המחדל
function nmOptNutrition(plan, slot, opt) { return nmPicksNutrition(NEW_ME_PLANS[plan][slot].options[opt]); }
// o = { kcal, protein, picks } - אפשרות בתפריט או הארוחה הקטנה הנוספת
function nmPicksNutrition(o) {
    let kcal = o.kcal, protein = o.protein;
    (o.picks || []).forEach(group => {
        const g = NEW_ME_PICKS[group];
        const avg = (ids, f) => ids.reduce((a, id) => a + (g.items[id][f] || 0), 0) / ids.length;
        const picked = nmPicks(group);
        kcal += avg(picked, 'kcal') - avg(g.def, 'kcal');
        protein += avg(picked, 'protein') - avg(g.def, 'protein');
    });
    return { kcal: Math.round(kcal / 5) * 5, protein: Math.round(protein) };
}
// "בוחרים עד 3 שאוהבים" - מתקפל. בשאלון פתוח כשבוחרים את האפשרות; בתפריט היום סגור עד שנוגעים בו.
// נגיעה ברביעי מוציאה את הראשון שנבחר, ולפחות אחד תמיד נשאר
let nmPicksOpenSlot = null;
function nmPicksPanelHtml(groups, where, id) {
    const open = where === 'quiz' ? !(nmQuiz && nmQuiz.picksClosed && nmQuiz.picksClosed[id]) : nmPicksOpenSlot === id;
    const toggle = where === 'quiz' ? `nmQuizPicksToggle('${id}', this.open)` : `nmPicksOpenSlot = this.open ? '${id}' : (nmPicksOpenSlot === '${id}' ? null : nmPicksOpenSlot)`;
    return `<details class="nm-picks"${open ? ' open' : ''} ontoggle="${toggle}">
        <summary>${nmEsc(t('nm_picks_label'))}</summary>
        ${groups.map(group => {
            const chosen = nmPicks(group);
            return `<div class="nm-pick-group" data-group="${group}">${Object.keys(NEW_ME_PICKS[group].items).map(item => {
                const on = chosen.includes(item);
                return `<button type="button" class="nm-chip nm-pick-chip${on ? ' selected' : ''}" aria-pressed="${on}" data-pick="${group}:${item}" onclick="nmTogglePick('${group}', '${item}', '${where}')">${nmEsc(t(nmPickTextKey(group, item)))}</button>`;
            }).join('')}</div>`;
        }).join('')}
    </details>`;
}
async function nmTogglePick(group, item, where) {
    if (!NEW_ME_PICKS[group] || !NEW_ME_PICKS[group].items[item]) return;
    const cur = nmPicks(group);
    let next = cur.includes(item) ? cur.filter(x => x !== item) : [...cur, item];
    if (!next.length) return;
    if (next.length > NEW_ME_PICKS_MAX) next = next.slice(-NEW_ME_PICKS_MAX);
    if (where === 'quiz') {
        if (!nmQuiz) return;
        nmQuiz.picks = { ...(nmQuiz.picks || {}), [group]: next };
        nmRenderQuiz(nmRoot());
        return;
    }
    if (!nmProfile) return;
    const prev = nmProfile.picks;
    nmProfile.picks = { ...(nmProfile.picks || {}), [group]: next };
    const { error } = await supabaseClient.from('new_me_profile').update({ picks: nmProfile.picks, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (error) { nmProfile.picks = prev; showAppToast(t('nm_save_error'), 'error'); return; }
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
    // מה שנבחר לערב נכנס גם לטקסט של התזכורת
    if (group === 'late' || group === 'latedrink') nmSyncReminders({});
}
function nmItemShort(it) { return it.custom ? it.name : nmOptText(it.plan, it.slot, it.opt, true); }
function nmItemFull(it) { return it.custom ? (it.text || t(it.source === 'ai' || it.source === 'ai_menu' ? 'nm_custom_from_ai' : 'nm_custom_from_saved')) : nmOptText(it.plan, it.slot, it.opt); }
// הבחירה הקבועה של משבצת (choice_meal1...): אות בודדת = אפשרות של אותה ארוחה בתוכנית
// הנוכחית (כך שמעבר 1,300↔1,500 מתאים את המנה); מפתח מלא = פריט מכל התפריט או ארוחה אישית
function nmPermanentKey(slot) {
    const v = (nmProfile && nmProfile['choice_' + slot]) || 'A';
    if (/^[A-F]$/.test(v) && nmHasOpt(nmProfile.plan, slot, v)) return nmItemKey(nmProfile.plan, slot, v);
    return nmValidKey(v) ? v : nmItemKey(nmProfile.plan, slot, 'A');
}
function nmIsOverride(slot) { return !!(nmToday && nmToday.overrides && nmValidKey(nmToday.overrides[slot])); }
function nmTodayKey(slot) { return nmIsOverride(slot) ? nmToday.overrides[slot] : nmPermanentKey(slot); }
function nmIsFree(slot) { return !!(nmToday && nmToday.free_slot === slot); }
function nmFreeKcal() { return (nmToday && Number(nmToday.free_kcal)) || NEW_ME_FREE_MEAL_KCAL; }
// לשאלון: האות שנבחרה לכל משבצת (פריט מכל התפריט → A)
function nmChoice(slot) { const v = nmProfile && nmProfile['choice_' + slot]; return /^[A-F]$/.test(v || '') && nmHasOpt(nmProfile.plan, slot, v) ? v : 'A'; }
// שתי אהובות לכל ארוחה (לפי בקשה מפורשת: "מתוך 6 אפשרויות או 4 הם יבחרו ב2 שהן הכי אוהבים וזה יהיה רשום בתפריט או זה
// או זה"): choice_<slot> = הראשונה (מה שמוצג), choice2_<slot> = השנייה - בכל יום נגיעה בה מחליפה אליה להיום
function nmChoice2(slot) { const v = nmProfile && nmProfile['choice2_' + slot]; return /^[A-Z]$/.test(v || '') ? v : null; }
function nmSecondKey(slot) {
    if (!nmProfile) return null;
    const v = nmProfile['choice2_' + slot];
    const k = /^[A-Z]$/.test(v || '') ? nmItemKey(nmProfile.plan, slot, v) : (nmValidKey(v) ? v : null);
    return k && nmValidKey(k) && k !== nmPermanentKey(slot) ? k : null;
}
// "או": מה שאפשר לאכול במקום היום - השנייה, ואם כבר עברו אליה היום - הראשונה
function nmAltKey(slot) {
    const second = nmSecondKey(slot);
    if (!second || nmIsFree(slot)) return null;
    return nmTodayKey(slot) === second ? nmPermanentKey(slot) : second;
}
async function nmPickAlt(slot) {
    const alt = nmAltKey(slot);
    if (!alt) return;
    if (alt === nmPermanentKey(slot)) await nmRevertToday(slot); else await nmApplySwap(slot, alt, 'today');
}
function nmAltRowHtml(slot) {
    const alt = nmAltKey(slot);
    if (!alt) return '';
    const it = nmItemInfo(alt);
    return `<button type="button" class="nm-or-row" data-or onclick="nmPickAlt('${slot}')"><span class="nm-or-word">${nmEsc(t('nm_or'))}</span><span class="nm-or-name">${nmEsc(nmItemShort(it))}</span><span class="nm-option-meta"><bdi dir="ltr">~${it.kcal}</bdi></span></button>`;
}
// ⏰ "לא הספקת?" (לפי בקשה מפורשת: "הארוחת בוקר... אם לא הספקתי לאכול כנשנוש מאוחר יותר"): הארוחה הראשונה של היום, שעתיים
// אחרי השעה שלה ובלי ✓ - אפשר לדחות אותה לאחרי הצהריים, רק להיום (new_me_days.later_slots). הקלוריות נשארות, ו"הבאה" במסדרון
// ובתרמיל מדלגת עליה עד שהארוחות שלפניה נאכלו
function nmLaterSlots() { return String((nmToday && nmToday.later_slots) || '').split(',').filter(s => NEW_ME_SLOTS.includes(s)); }
function nmIsLater(slot) { return nmLaterSlots().includes(slot); }
function nmCanLater(slot) {
    if (!nmProfile || nmTodayCheckins[slot] || nmIsFree(slot) || nmIsLater(slot)) return false;
    const active = nmActiveOrder();
    if (active[0] !== slot || active.length < 2) return false;
    const [h, m] = String(nmSlotReminderTime(slot) || '10:00').split(':').map(Number);
    return nmMinutesNow() >= h * 60 + (m || 0) + 120;
}
async function nmSetLater(slot) {
    const later = [...new Set([...nmLaterSlots(), slot])].join(',');
    if (!(await nmUpsertDay(getLocalDateString(), { later_slots: later }))) return;
    await nmLoadToday();
    nmRenderView(nmRoot());
    showAppToast(t('nm_later_done'));
}
// הארוחה הבאה: הראשונה שלא סומנה ולא נדחתה; כשנשארו רק דחויות - הן
function nmNextSlot(active) {
    const later = nmLaterSlots();
    return active.find(s => !nmTodayCheckins[s] && !later.includes(s)) || active.find(s => !nmTodayCheckins[s]) || null;
}
function nmLaterRowHtml(slot) {
    if (nmIsLater(slot) && !nmTodayCheckins[slot]) return `<div class="nm-later-tag">⏰ ${nmEsc(t('nm_later_tag'))}</div>`;
    if (!nmCanLater(slot)) return '';
    return `<div class="nm-later-row"><span>${nmEsc(t('nm_later_q'))}</span><button type="button" class="nm-chip" data-later onclick="nmSetLater('${slot}')">⏰ ${nmEsc(t('nm_later_btn'))}</button></div>`;
}

// ---------- סדר ושמות ----------
// הסדר נשמר כקבוע (new_me_profile.meal_order). לפי בקשה מפורשת, השם והשעה שייכים לארוחה עצמה
// ("ארוחת ערב קלה תישאר ארוחת ערב קלה"): גרירה משנה רק את הסדר שרואים, לא את השם ולא את השעה
function nmOrder() {
    const saved = String((nmProfile && nmProfile.meal_order) || '');
    // הסדר הקודם שנשמר כברירת מחדל (בוקר, נשנוש, צהריים ב-16:00, ערב) = ברירת המחדל החדשה
    if (saved === 'meal1,snack1,meal2,snack2') return NEW_ME_DEFAULT_ORDER.slice();
    const raw = saved.split(',').filter(s => NEW_ME_SLOTS.includes(s));
    return raw.length === 4 && new Set(raw).size === 4 ? raw : NEW_ME_DEFAULT_ORDER.slice();
}
function nmPosName(i) { return t(NEW_ME_POS_KEYS[i] || ('nm_pos_' + (i + 1))); }
// 21:00: 'eat' / 'drink' / 'none', או null כשעוד לא נשאל
function nmLateChoice() { const c = nmProfile && nmProfile.late_choice; return ['eat', 'drink', 'none'].includes(c) ? c : null; }
// הערב = הממוצע של מה שנבחר לאכול (late) או לשתות (latedrink), מתוך התוכנית - יורד מהארוחות (ר' nmBalance)
function nmLateGroup(late) { return late === 'eat' ? 'late' : late === 'drink' ? 'latedrink' : null; }
function nmLateKcal(late) { const g = nmLateGroup(late === undefined ? nmLateChoice() : late); return g ? nmPicksKcal(g) : 0; }
function nmPicksKcal(group) {
    const items = NEW_ME_PICKS[group].items, ids = nmPicks(group);
    return Math.round(ids.reduce((a, id) => a + items[id].kcal, 0) / ids.length / 5) * 5;
}
function nmLateLabel(c) { return t(c === 'eat' ? 'nm_late_eat' : c === 'drink' ? 'nm_late_drink' : 'nm_late_none'); }
async function nmSetLateChoice(choice) {
    if (!nmProfile || !['eat', 'drink', 'none'].includes(choice)) return;
    const prev = nmProfile.late_choice;
    nmProfile.late_choice = choice;
    const { error } = await supabaseClient.from('new_me_profile').update({ late_choice: choice, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (error) { nmProfile.late_choice = prev; showAppToast(t('nm_save_error'), 'error'); return; }
    // בחירה ב"לאכול" / "לשתות" מדליקה את התזכורת של 21:00; "בלי" מכבה
    await nmSyncReminders(choice === 'none' ? {} : { pos: 4, enabled: true });
    // לפי בקשה מפורשת: שיהיה ברור שזה נשמר - הבחירה נסגרת לשורה אחת (עם "שינוי") ומופיעה הודעה
    nmLateEditing = false;
    showAppToast(t('item_updated_success'));
    nmRenderView(nmRoot());
}
function nmEditLateChoice() {
    nmLateEditing = true;
    nmRenderReminders(document.getElementById('nm-view-body'));
}
// שלוש הבחירות של 21:00 (בשאלון, בתזכורות, ובשאלה החד-פעמית ביום)
function nmLateChoicesHtml(current, onPick) {
    return `<div class="nm-late-choices" role="radiogroup" aria-label="${nmEsc(t('nm_late_title'))}">${['eat', 'drink', 'none'].map(c => `
        <button type="button" role="radio" aria-checked="${current === c}" class="nm-late-choice${current === c ? ' selected' : ''}" onclick="${onPick}('${c}')">${nmEsc(nmLateLabel(c))}</button>`).join('')}</div>`;
}
// 🍽️ / ☕ / 🌙 הקלוריות של היום (לפי בקשה מפורשת, 2026-10-12: "שאני לוחצת על הכפתורים האלה זה לא נותן לי... כמה קלוריות נשאר
// לי או בשתיה" + "מה לגבי השתיה לכל היום איפה זה נכנס כקלוריות?" + "שהכל יסתכם ב1300 \ 1500"): הארוחות + ~150 לשתייה (גם
// המשקה של 21:00 מהן) + ~100 ל"משהו קטן" ב-21:00 (יורדות מהארוחות - ר' nmBalance) = בדיוק התוכנית. בשאלון ובכרטיס של 21:00.
// menu (בשאלון): { chosen: סך האפשרויות שנבחרו, adj: סך התיקונים } - שורה קטנה מתחת לארוחות
function nmBudgetBoxHtml(plan, late, menu) {
    const p = NEW_ME_PLANS[plan] ? Number(plan) : 1300;
    const lateKcal = nmLateKcal(late || null);
    // השעה של הערב - מה שנבחר (בשאלון או בתזכורות), לא תמיד 21:00
    const lateTime = nmQuiz ? (nmQuiz.lateTime || NEW_ME_LATE_TIME) : nmLateTime();
    const meals = menu ? menu.chosen + menu.adj : p - NEW_ME_DRINKS_KCAL - lateKcal;
    const row = (label, n) => `<div class="nm-budget-row"><span>${label}</span><b><bdi dir="ltr">~${nmFmt(n)}</bdi></b></div>`;
    return `
        <div class="nm-budget" aria-live="polite">
            ${row(`🍽️ ${nmEsc(t('nm_budget_meals'))}`, meals)}
            ${menu && menu.adj ? `<div class="nm-budget-sub">${nmTpl('nm_budget_chosen', { n: nmFmt(menu.chosen), adj: nmSigned(menu.adj) })}</div>` : ''}
            ${row(`☕ ${nmEsc(t('nm_budget_drinks'))}`, NEW_ME_DRINKS_KCAL)}
            ${nmLateGroup(late) ? row(`🌙 ${nmEsc(t(late === 'drink' ? 'nm_budget_late_drink' : 'nm_budget_late').replace('{time}', lateTime))}`, lateKcal) : ''}
            <div class="nm-budget-row total"><span>${nmEsc(t('nm_budget_total'))}</span><b><bdi dir="ltr">${nmFmt(meals + NEW_ME_DRINKS_KCAL + lateKcal)}</bdi> ${nmEsc(t('calories_unit'))}</b></div>
        </div>`;
}
// +20 / −45 (מינוס אמיתי) לתיקונים - כטקסט (ל-nmTpl, שעוטף ב-bdi בעצמו) או בתוך bdi
function nmSigned(n) { return `${n > 0 ? '+' : '−'}${nmFmt(Math.abs(n))}`; }
function nmSignedHtml(n) { return `<bdi dir="ltr">${nmSigned(n)}</bdi>`; }
// השורה של 21:00 בתפריט היום - או השאלה, כל עוד לא נבחר
// 🍽️ / ☕ בסוף התפריט: כמה קלוריות כל הארוחות היום, וכמה נשאר לקפה ולשתייה - עם קפה בלחיצה אחת (לפי בקשה מפורשת:
// "ובסוף תרשום כמה קלוריות לכל הארוחה וכמה קפה נשאר ליום ואיזה... תן כמה אפשרויות")
function nmDaySummaryHtml() {
    const meals = Math.max(0, nmMenuTotal() - NEW_ME_DRINKS_KCAL - nmLateKcal());
    const left = Math.max(0, NEW_ME_DRINKS_KCAL - nmEatenToday().drinks);
    // הקפה והשתייה שנבחרו (עד 3) - כל אחד בלחיצה אחת, ואפשר להחליף אותם במקום
    const items = NEW_ME_PICKS.drink.items;
    const chips = nmPicks('drink').map(id => `<button type="button" class="nm-coffee-chip${items[id].kcal > left ? ' over' : ''}" data-coffee="${id}" onclick="nmLogCoffee('${id}', this)">${nmEsc(t(nmPickTextKey('drink', id)))} <bdi dir="ltr">~${nmFmt(items[id].kcal)}</bdi></button>`).join('');
    return `
        <div class="nm-day-sum">
            <div class="nm-day-sum-line">🍽️ ${nmTpl('nm_day_meals_total', { n: nmFmt(meals) })}</div>
            <div class="nm-day-sum-line">☕ ${left > 0 ? nmTpl('nm_drinks_left', { n: nmFmt(left) }) : nmEsc(t('nm_drinks_left_none'))}</div>
            <div class="nm-coffee-chips" role="group" aria-label="${nmEsc(t('nm_coffee_title'))}">${chips}</div>
            ${nmPicksPanelHtml(['drink'], 'day', 'drink')}
        </div>`;
}
async function nmLogCoffee(id, btn) {
    const o = NEW_ME_PICKS.drink.items[id];
    if (!o) return;
    if (btn) btn.disabled = true;
    await nmInsertDrink(`☕ ${t(nmPickTextKey('drink', id))}`, o.kcal, o.protein);
}
// "אם בא לך דברים אחרים לאכול באותו יום..." - שורה קטנה בסוף התפריט (לפי בקשה מפורשת, 2026-10-14)
function nmOtherFoodNoteHtml() { return `<p class="nm-fine nm-other-food">${nmEsc(t('nm_other_food_note'))}</p>`; }
// מה שנבחר לערב: "זה או זה או זה" והקלוריות - וגם לבחור אחרת (בשאלון, בתפריט היום ובתזכורות)
function nmLatePicksText(late) { const g = nmLateGroup(late); return g ? nmPicks(g).map(id => nmPickInText(g, id)).join(` ${t('nm_or')} `) : ''; }
function nmLatePicksHtml(late, where) {
    const g = nmLateGroup(late);
    return g ? `<div class="nm-late-picks"><span class="nm-late-picks-text">${nmEsc(nmLatePicksText(late))} <bdi dir="ltr">~${nmFmt(nmLateKcal(late))}</bdi></span>${nmPicksPanelHtml([g], where, 'late')}</div>` : '';
}
function nmLateRowHtml() {
    const c = nmLateChoice();
    if (!c) return `
        <div class="nm-late nm-late-ask">
            <div class="nm-slot-name">🌙 ${nmEsc(t('nm_late_ask').replace('{time}', nmLateTime()))}</div>
            ${nmLateChoicesHtml(null, 'nmSetLateChoice')}
        </div>`;
    if (c === 'none') return '';
    return `
        <div class="nm-late">
            <span class="nm-late-time"><bdi dir="ltr">${nmEsc(nmLateTime())}</bdi></span>
            <div class="nm-late-text">${nmEsc(t(c === 'eat' ? 'nm_late_eat' : 'nm_late_drink'))}${nmLatePicksHtml(c, 'day')}</div>
            <button type="button" class="nm-chip" onclick="nmGo('reminders')">${nmEsc(t('nm_late_change'))}</button>
        </div>`;
}
// ---------- 🕐 ארוחה קטנה נוספת (לפי בקשה מפורשת, 2026-10-14) ----------
// ארוחת הבוקר הקטנה (150) לבד קטנה מדי: כשהיא בתפריט מופיעה איתה ארוחה קטנה בשעה אחרת (NEW_ME_SIDE_OPTIONS). בשאלון -
// מתחת לארוחה; בתפריט היום - כרטיס משלה אחרי הארוחה, עם שעה ו-✓ (שורה ב-calorie_tracker). היא נספרת ביום (nmBalance)
function nmSideFor(it) { return !!(it && !it.custom && it.slot === 'meal1' && it.small); }
// overrides: { slot: key } - "מה אם" (ר' nmBalanceSlots)
function nmSideOn(overrides) {
    if (!nmProfile || nmHiddenSlots().includes('meal1') || nmIsFree('meal1')) return false;
    return nmSideFor(nmItemInfo((overrides && overrides.meal1) || nmTodayKey('meal1')));
}
function nmSideId() { const v = nmQuiz ? nmQuiz.side : nmProfile && nmProfile.side_choice; return NEW_ME_SIDE_OPTIONS[v] ? v : NEW_ME_SIDE_DEFAULT; }
function nmSideInfo(id = nmSideId()) {
    const n = nmPicksNutrition(NEW_ME_SIDE_OPTIONS[id]);
    return { id, kcal: n.kcal, protein: n.protein, name: nmFillPicks(t(`nm_side_${id}_t`)), text: nmFillPicks(t('nm_side_' + id)) };
}
// השעה: מה שנבחר, אחרת שעה וחצי אחרי הארוחה (בחצאי שעות) ולפחות חצי שעה לפני הארוחה הבאה - למשל 11:30 → 13:00
function nmSideDefaultTime(mealTime, nextTime) {
    const min = s => { const [h, m] = String(s || '').split(':').map(Number); return h * 60 + m; };
    const base = min(mealTime);
    if (!(base >= 0)) return '13:00';
    let v = Math.round((base + 90) / 30) * 30;
    const next = min(nextTime);
    if (next > base) v = Math.min(v, next - 30);
    v = Math.min(Math.max(v, base + 30), 23 * 60 + 30);
    return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}
function nmSideTime() {
    const v = nmQuiz ? nmQuiz.sideTime : nmProfile && nmProfile.side_time;
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(v || '')) return v;
    const timeOf = s => String((nmQuiz ? nmQuizTime(s) : nmSlotReminderTime(s)) || '');
    const slots = nmQuiz ? nmQuizActive() : nmActiveOrder();
    const first = timeOf('meal1');
    return nmSideDefaultTime(first, slots.map(timeOf).filter(x => x > first).sort()[0]);
}
function nmSideRow() { return (nmTrackerToday || []).find(r => r.meal_type === NEW_ME_SIDE_MEAL_TYPE) || null; }
function nmSideKcal() { const row = nmSideRow(); return row ? Number(row.calories) || 0 : nmSideInfo().kcal; }
function nmSideOptName(id) { return nmFillPicks(t(`nm_side_${id}_t`)); }
function nmSideCardHtml() {
    const it = nmSideInfo();
    const row = nmSideRow();
    const done = !!row;
    const picks = NEW_ME_SIDE_OPTIONS[it.id].picks || [];
    return `
        <div class="nm-meal nm-side${done ? ' done' : ''}" data-side="${it.id}">
            <div class="nm-meal-head">
                <span class="nm-slot-name">🕐 ${nmEsc(t('nm_side_title'))}</span>
                ${nmTimeBtnHtml('side-time', nmSideTime(), t('nm_side_title'), v => nmSetSide({ side_time: v }), done)}
                <span class="nm-head-space"></span>
                <button type="button" class="nm-check${done ? ' on' : ''}" onclick="nmToggleSide(this)" aria-pressed="${done}" aria-label="${nmEsc(t('nm_mark_eaten'))}">${NM_CHECK_SVG}</button>
            </div>
            <div class="nm-option-name">${nmEsc(done ? String(row.food_description || '').replace(/^✨\s*/, '') : it.name)}</div>
            ${done ? '' : `<div class="nm-option-text">${nmEsc(it.text)}</div>
            ${picks.length ? nmPicksPanelHtml(picks, 'day', 'side') : ''}
            <div class="nm-chip-row nm-side-opts" role="radiogroup" aria-label="${nmEsc(t('nm_side_title'))}">${Object.keys(NEW_ME_SIDE_OPTIONS).map(id => `<button type="button" role="radio" class="nm-chip${id === it.id ? ' selected' : ''}" aria-checked="${id === it.id}" data-side-opt="${id}" onclick="nmSetSide({ side_choice: '${id}' })">${nmEsc(nmSideOptName(id))}</button>`).join('')}</div>`}
            <div class="nm-meal-foot"><span class="nm-option-meta">${nmMeta(done ? { kcal: Number(row.calories) || 0, protein: Math.round(Number(row.protein_grams) || 0) } : it)}</span></div>
        </div>`;
}
async function nmSetSide(fields) {
    if (!nmProfile) return;
    const prev = { side_choice: nmProfile.side_choice, side_time: nmProfile.side_time };
    Object.assign(nmProfile, fields);
    const { error } = await supabaseClient.from('new_me_profile').update({ ...fields, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (error) { Object.assign(nmProfile, prev); showAppToast(t('nm_save_error'), 'error'); return; }
    // השעה כבר על הכפתור; ארוחה אחרת - הכרטיס והיום מתאזנים מחדש
    if (fields.side_choice) nmRenderView(nmRoot());
    nmAfterTrackerChange();
}
async function nmToggleSide(btn) {
    if (btn) btn.disabled = true;
    const row = nmSideRow();
    try {
        if (row) await supabaseClient.from('calorie_tracker').delete().eq('id', row.id).eq('user_id', currentUserId);
        else {
            const it = nmSideInfo();
            await supabaseClient.from('calorie_tracker').insert({
                username: currentUsername, user_id: currentUserId, date: getLocalDateString(), meal_type: NEW_ME_SIDE_MEAL_TYPE,
                food_description: `✨ ${it.name}`, calories: it.kcal, protein_grams: it.protein, source: 'new_me',
            });
        }
    } finally {
        await nmLoadToday();
        nmRenderView(nmRoot());
        nmAfterTrackerChange();
    }
}
// בשאלון: מתחת לארוחה - השעה וכל האפשרויות (נגיעה בוחרת אחת)
function nmQuizSideHtml() {
    const cur = nmSideId();
    return `
        <div class="nm-quiz-side">
            <div class="nm-quiz-slot-head"><div class="nm-slot-name">🕐 ${nmEsc(t('nm_side_title'))}</div>${nmTimeBtnHtml('quiz-side', nmSideTime(), t('nm_side_title'), v => { if (nmQuiz) nmQuiz.sideTime = v; })}</div>
            ${Object.keys(NEW_ME_SIDE_OPTIONS).map(id => {
                const it = nmSideInfo(id), on = id === cur;
                const btn = `<button type="button" class="nm-option${on ? ' selected' : ''}" aria-pressed="${on}" data-side-opt="${id}" onclick="nmQuizSide('${id}')">
                    <span class="nm-option-name">${nmEsc(it.name)}</span>
                    <span class="nm-option-text">${nmEsc(it.text)}</span>
                    <span class="nm-option-meta">${nmMeta(it)}</span>
                </button>`;
                const groups = on ? NEW_ME_SIDE_OPTIONS[id].picks || [] : [];
                return groups.length ? `<div class="nm-option-wrap">${btn}${nmPicksPanelHtml(groups, 'quiz', 'side_' + id)}</div>` : btn;
            }).join('')}
        </div>`;
}
function nmQuizSide(id) { if (!nmQuiz || !NEW_ME_SIDE_OPTIONS[id]) return; nmQuiz.side = id; nmRenderQuiz(nmRoot()); }
// מה שנשמר מהשאלון: רק מה שנבחר בו (שעה שלא נבחרה נשארת "שעה וחצי אחרי")
function nmQuizSideRow(q) {
    const row = {};
    if (NEW_ME_SIDE_OPTIONS[q.side]) row.side_choice = q.side;
    if (/^([01]\d|2[0-3]):[0-5]\d$/.test(q.sideTime || '')) row.side_time = q.sideTime;
    return row;
}

// ---------- ארוחות גם בשגרה (לפי בקשה מפורשת) ----------
// אחרי שקובעים את הארוחות ב-New Me: אם ב"השגרה שלי" יש ארוחות (ארוחת צהריים וכו'), שואלים פעם אחת אם
// להסתיר אותן משם - כדי שהארוחות לא יופיעו פעמיים. כלום לא נמחק: מוסתרות (routine_items.hidden_by_new_me),
// ואפשר להחזיר כל אחת מ"השגרה שלי" (💎) או מההגדרות של New Me. כש-New Me לא פעיל - הן חוזרות לבד
function nmMealWordsRe() {
    const words = new Set(['ארוחה', 'ארוחת', 'נשנוש', 'breakfast', 'lunch', 'dinner', 'supper', 'brunch', 'meal', 'snack']);
    ['nm_pos_1', 'nm_pos_2', 'nm_pos_3', 'nm_pos_4', 'nm_pos_dinner'].forEach(k => Object.keys(translations).forEach(l => {
        const v = translations[l] && translations[l][k];
        if (v) words.add(String(v).toLowerCase());
    }));
    return new RegExp([...words].filter(w => w.length >= 2).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
}
async function nmCheckRoutineMeals(fromSettings, ask) {
    if (!nmProfile || !supabaseClient || !currentUserId) return;
    if (!fromSettings && !ask && nmProfile.routine_meals_checked) return;
    const [{ data: items }, { data: tabs }] = await Promise.all([
        supabaseClient.from('routine_items').select('id, tab_id, title, time, hidden_by_new_me').eq('user_id', currentUserId).eq('kind', 'scheduled'),
        supabaseClient.from('routine_tabs').select('id, name').eq('user_id', currentUserId),
    ]);
    const re = nmMealWordsRe();
    const all = (items || []).filter(it => re.test(it.title || ''));
    const meals = (fromSettings ? all : all.filter(it => !it.hidden_by_new_me)).sort((a, b) => String(a.time || '').localeCompare(String(b.time || '')));
    if (!meals.length) {
        if (fromSettings) showAppToast(t('nm_routine_none'));
        else nmMarkRoutineChecked();
        return;
    }
    const tabName = new Map((tabs || []).map(tb => [tb.id, tb.name]));
    const ov = nmOpenSheet(`
        <h4>🍽️ ${nmEsc(t('nm_routine_title'))}</h4>
        <p class="nm-fine">${nmEsc(t('nm_routine_text'))}</p>
        <div class="nm-routine-list">${meals.map(it => `
            <label class="nm-routine-row">
                <input type="checkbox" value="${nmEsc(it.id)}" ${!fromSettings || it.hidden_by_new_me ? 'checked' : ''}>
                <span><b>${nmEsc(it.title)}</b><small><bdi dir="ltr">${nmEsc(String(it.time || '').slice(0, 5))}</bdi>${tabName.get(it.tab_id) ? ' · ' + nmEsc(tabName.get(it.tab_id)) : ''}</small></span>
            </label>`).join('')}</div>
        <button type="button" class="nm-btn-primary" data-hide>${nmEsc(t(fromSettings ? 'nm_routine_save' : 'nm_routine_hide'))}</button>
        <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_routine_keep'))}</button>
        <p class="nm-fine">${nmEsc(t('nm_routine_note'))}</p>`, 'nm-routine-sheet', () => { if (!fromSettings) nmMarkRoutineChecked(); });
    ov.querySelector('[data-hide]').addEventListener('click', async () => {
        const boxes = [...ov.querySelectorAll('.nm-routine-row input')];
        const hide = boxes.filter(b => b.checked).map(b => b.value);
        const show = boxes.filter(b => !b.checked).map(b => b.value);
        const ops = [];
        if (hide.length) ops.push(supabaseClient.from('routine_items').update({ hidden_by_new_me: true }).eq('user_id', currentUserId).in('id', hide));
        if (show.length) ops.push(supabaseClient.from('routine_items').update({ hidden_by_new_me: false }).eq('user_id', currentUserId).in('id', show));
        const res = await Promise.all(ops);
        if (res.some(r => r && r.error)) { showAppToast(t('nm_save_error'), 'error'); return; }
        ov.remove();
        nmMarkRoutineChecked();
        showAppToast(t(hide.length ? 'nm_routine_hidden_toast' : 'nm_routine_kept_toast'));
        if (typeof loadTodayTasks === 'function') loadTodayTasks();
    });
}
async function nmMarkRoutineChecked() {
    if (!nmProfile || nmProfile.routine_meals_checked) return;
    nmProfile.routine_meals_checked = true;
    await supabaseClient.from('new_me_profile').update({ routine_meals_checked: true, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
}
// 🔗 "סנכרון עם New Me" - מתג בהגדרות של "השגרה שלי" (לפי בקשה מפורשת, 2026-10-14). דלוק (ברירת המחדל): הארוחות של
// New Me ב"היום שלי", וארוחות השגרה שסומנו נשארות מוסתרות. כבוי: הארוחות של New Me יוצאות מ"היום שלי" וארוחות השגרה
// חוזרות. כלום לא נמחק - הדלקה מחדש מחזירה הכול, ושואלת אילו ארוחות בשגרה להסתיר
function nmRoutineSyncOn() { return !(nmProfile && nmProfile.routine_sync === false); }
async function nmSetRoutineSync(on) {
    if (!hasNewMe || !(await nmEnsureHomeData()) || !nmProfile) return false;
    const prev = nmProfile.routine_sync;
    nmProfile.routine_sync = !!on;
    const { error } = await supabaseClient.from('new_me_profile').update({ routine_sync: !!on, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (error) { nmProfile.routine_sync = prev; showAppToast(t('nm_save_error'), 'error'); return false; }
    showAppToast(t(on ? 'routine_newme_sync_on_toast' : 'routine_newme_sync_off_toast'));
    if (typeof loadTodayTasks === 'function') loadTodayTasks();
    if (typeof renderDailyBoard === 'function') renderDailyBoard();
    if (on) nmCheckRoutineMeals(false, true);
    return true;
}

// ---------- בורר שעה מעוצב ----------
// לפי בקשה מפורשת ("יש חלון בלי עיצוב בכלל של השעות"): במקום בורר השעה של הדפדפן - כפתור עם השעה, ונגיעה פותחת
// מתחת לשורה את השעות (00–23) ואת הדקות (כל 5 דקות, ו"אחר" לדקה מדויקת). כל בחירה נכנסת מיד; דקות - וזה נסגר
const nmTimePickHandlers = {};
function nmTimeBtnHtml(id, value, label, onPick, disabled) {
    nmTimePickHandlers[id] = onPick;
    return `<button type="button" class="nm-time-btn" data-time-id="${nmEsc(id)}" aria-expanded="false" aria-label="${nmEsc(label)}" ${disabled ? 'disabled' : ''} onclick="nmToggleTimePicker(this)"><bdi dir="ltr">${nmEsc(value)}</bdi></button>`;
}
function nmCloseTimePickers() {
    document.querySelectorAll('.nm-time-picker').forEach(p => p.remove());
    document.querySelectorAll('.nm-time-btn.is-open').forEach(b => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
}
function nmToggleTimePicker(btn) {
    const wasOpen = btn.classList.contains('is-open');
    nmCloseTimePickers();
    if (wasOpen || btn.disabled) return;
    const pad = n => String(n).padStart(2, '0');
    let [h, m] = (btn.textContent.trim().match(/^\d{2}:\d{2}$/) ? btn.textContent.trim() : '12:00').split(':');
    const picker = document.createElement('div');
    picker.className = 'nm-time-picker';
    picker.innerHTML = `
        <span class="nm-time-label">${nmEsc(t('nm_time_hour'))}</span>
        <div class="nm-time-grid" role="group" aria-label="${nmEsc(t('nm_time_hour'))}">${Array.from({ length: 24 }, (_, i) => pad(i)).map(v => `<button type="button" class="nm-time-chip" data-h="${v}"><bdi dir="ltr">${v}</bdi></button>`).join('')}</div>
        <span class="nm-time-label">${nmEsc(t('nm_time_minutes'))}</span>
        <div class="nm-time-grid" role="group" aria-label="${nmEsc(t('nm_time_minutes'))}">${Array.from({ length: 12 }, (_, i) => pad(i * 5)).map(v => `<button type="button" class="nm-time-chip" data-m="${v}"><bdi dir="ltr">:${v}</bdi></button>`).join('')}<button type="button" class="nm-time-chip nm-time-other" data-other>${nmEsc(t('nm_other'))}</button></div>
        <div class="nm-time-exact hidden"><input type="text" inputmode="numeric" maxlength="2" class="nm-time-exact-input" aria-label="${nmEsc(t('nm_time_minutes'))}"><button type="button" class="nm-time-chip on" data-exact>✓</button></div>`;
    (btn.closest('.nm-rem-row') || btn.parentElement).after(picker);
    btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    const mark = () => {
        picker.querySelectorAll('[data-h]').forEach(x => { const on = x.dataset.h === h; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        picker.querySelectorAll('[data-m]').forEach(x => { const on = x.dataset.m === m; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        picker.querySelector('[data-other]').classList.toggle('on', Number(m) % 5 !== 0);
    };
    const apply = close => {
        const v = `${h}:${m}`;
        btn.querySelector('bdi').textContent = v;
        const fn = nmTimePickHandlers[btn.dataset.timeId];
        if (fn) fn(v);
        mark();
        if (close) { nmCloseTimePickers(); btn.focus({ preventScroll: true }); }
    };
    mark();
    picker.querySelectorAll('[data-h]').forEach(x => x.addEventListener('click', () => { h = x.dataset.h; apply(false); }));
    picker.querySelectorAll('[data-m]').forEach(x => x.addEventListener('click', () => { m = x.dataset.m; apply(true); }));
    const exactBox = picker.querySelector('.nm-time-exact'), exactIn = picker.querySelector('.nm-time-exact-input');
    picker.querySelector('[data-other]').addEventListener('click', () => { exactBox.classList.remove('hidden'); exactIn.value = m; exactIn.focus(); exactIn.select(); });
    const exactOk = () => { const v = parseInt(exactIn.value, 10); if (!(v >= 0 && v <= 59)) { exactIn.focus(); return; } m = pad(v); apply(true); };
    picker.querySelector('[data-exact]').addEventListener('click', exactOk);
    exactIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); exactOk(); } });
    const on = picker.querySelector('[data-h].on');
    if (on) on.focus({ preventScroll: true });
}
// בתזכורות כל שעה נשמרת לבד - שעה ואז דקות = שמירה אחת (לא שתיים)
const nmRemTimeTimers = {};
function nmQueueReminderTime(i, value) {
    clearTimeout(nmRemTimeTimers[i]);
    nmRemTimeTimers[i] = setTimeout(() => nmSetReminderTime(i, value), 650);
}

// ---------- שעות האוכל (לפי בקשה מפורשת, 2026-10-10) ----------
// "להטמיע ב-New Me את השעות של האוכל שיהיה מסונכרן גם מהשגרה - לשאול אם יש בשגרה שעות שבהן אוכלים, ואז לסנכרן;
// ואם אין - לשאול מתי רוצים לאכול וכמה ארוחות". השעות האלה הן השעות של הארוחות בכל מקום: המסדרון, "היום שלי"
// והתזכורות (new_me_reminders). ארוחה בשגרה מזוהה לפי השם (בוקר / צהריים / ערב / נשנוש, גם בשפות אחרות);
// "ארוחה" בלי סוג הולכת לארוחה הפנויה הבאה. בשאלון זה שלב משלו; למי שכבר באמצע - שואלים פעם אחת, ואפשר תמיד
// לחזור לזה מההגדרות של New Me. כמה ארוחות: 4 (הכול), 3 (בלי הנשנוש), 2 (שתי הארוחות הגדולות)
const NM_TIME_TYPES = [
    ['meal1', ['nm_pos_1'], ['בוקר', 'breakfast', 'brunch', 'desayuno', 'petit-déjeuner', 'frühstück', 'завтрак', 'فطور', 'colazione', 'café da manhã']],
    ['meal2', ['nm_pos_3'], ['צהריים', 'צהרים', 'lunch', 'almuerzo', 'déjeuner', 'mittagessen', 'обед', 'غداء', 'pranzo', 'almoço']],
    ['snack2', ['nm_pos_dinner'], ['ערב', 'dinner', 'supper', 'cena', 'dîner', 'abendessen', 'ужин', 'عشاء', 'jantar']],
    ['snack1', ['nm_pos_2', 'nm_pos_4'], ['נשנוש', 'snack', 'merienda', 'goûter', 'collation', 'перекус', 'lanche', 'spuntino']],
];
// מבנה הארוחות (לפי בקשה מפורשת, 2026-10-13: "אפשרות של 3 ארוחות - 2 גדולות ואחת נשנוש"; זה מחליף את "3 או 4"
// מ-2026-10-11): שתי הארוחות הגדולות תמיד, ומה שבא איתן. hidden = הארוחות שיורדות מהתפריט - הקלוריות שלהן
// מתחלקות בין האחרות (nmSlotExtra), כך שסך היום נשאר
const NM_STRUCTURES = [
    { id: 'snack', hidden: ['snack2'] },
    { id: 'dinner', hidden: ['snack1'] },
    { id: 'both', hidden: [] },
];
function nmStructureId(hidden) {
    const key = (hidden || []).slice().sort().join(',');
    const st = NM_STRUCTURES.find(s => s.hidden.slice().sort().join(',') === key);
    return st ? st.id : null;
}
let nmTimes = null;   // { mode: null | 'routine' | 'manual', hidden: [], times: { slot: 'HH:MM' }, found: [], hide, firstTime, inQuiz }
function nmWordsRe(keys, extra) {
    const words = new Set(extra);
    keys.forEach(k => Object.keys(translations).forEach(l => { const v = translations[l] && translations[l][k]; if (v) words.add(String(v).toLowerCase()); }));
    return new RegExp([...words].filter(w => w.length >= 2).map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i');
}
// הארוחות שבשגרה - בטאב של היום (ואם אין בו ארוחות, בטאב הראשון שיש בו) → { times: { slot: 'HH:MM' }, items }
async function nmRoutineMealTimes() {
    if (!supabaseClient || !currentUserId) return { times: {}, items: [] };
    const [{ data: tabs }, { data: items }] = await Promise.all([
        supabaseClient.from('routine_tabs').select('id, weekdays, sort_order').eq('user_id', currentUserId),
        supabaseClient.from('routine_items').select('id, tab_id, title, time, hidden_by_new_me').eq('user_id', currentUserId).eq('kind', 'scheduled'),
    ]);
    const re = nmMealWordsRe();
    const meals = (items || []).filter(it => /^\d{2}:\d{2}/.test(String(it.time || '')) && re.test(it.title || ''));
    if (!meals.length) return { times: {}, items: [] };
    const today = new Date().getDay();
    const days = tb => (Array.isArray(tb.weekdays) ? tb.weekdays.map(Number) : []);
    const sorted = (tabs || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const tab = [sorted.find(tb => days(tb).includes(today)), sorted.find(tb => !days(tb).length), ...sorted].filter(Boolean).find(tb => meals.some(it => it.tab_id === tb.id));
    const list = meals.filter(it => !tab || it.tab_id === tab.id).sort((a, b) => String(a.time).localeCompare(String(b.time)));
    const types = NM_TIME_TYPES.map(([slot, keys, extra]) => [slot, nmWordsRe(keys, extra)]);
    const times = {}, used = [];
    list.forEach(it => { const ty = types.find(([slot, r]) => !times[slot] && r.test(it.title || '')); if (ty) { times[ty[0]] = String(it.time).slice(0, 5); used.push(it); } });
    list.filter(it => !used.includes(it)).forEach(it => { const slot = NEW_ME_DEFAULT_ORDER.find(s => !times[s]); if (slot) { times[slot] = String(it.time).slice(0, 5); used.push(it); } });
    return { times, items: used };
}
function nmTimesStart(opts = {}) {
    // fresh: כמו בפעם הראשונה (תצוגת השאלון של מנהלת המוצר) - בלי מה שכבר נשמר
    nmTimes = {
        mode: null,
        hidden: opts.fresh ? [] : nmHiddenSlots(),
        times: Object.fromEntries(NEW_ME_DEFAULT_ORDER.map((s, i) => [s, opts.fresh ? NEW_ME_REMINDER_DEFAULTS[i] : nmSlotReminderTime(s)])),
        found: [], hide: true, firstTime: !!opts.firstTime, inQuiz: !!opts.inQuiz,
    };
}
function nmTimesActive() { return NEW_ME_DEFAULT_ORDER.filter(s => !nmTimes.hidden.includes(s)); }
function nmTimesBodyHtml() {
    const s = nmTimes;
    const pick = (m, key) => `<button type="button" class="nm-times-pick${s.mode === m ? ' selected' : ''}" aria-pressed="${s.mode === m}" onclick="nmTimesPick('${m}')">${nmEsc(t(key))}</button>`;
    let html = `<p class="nm-times-q">${nmEsc(t('nm_times_q'))}</p><div class="nm-times-picks">${pick('routine', 'nm_times_from_routine')}${pick('manual', 'nm_times_manual')}</div>`;
    if (!s.mode) return html;
    if (s.mode === 'routine' && !s.found.length) html += `<p class="nm-soft-warn">${nmEsc(t('nm_times_none_found'))}</p>`;
    const struct = nmStructureId(s.hidden);
    html += `
        <div class="nm-slot-name">${nmEsc(t('nm_struct_q'))}</div>
        <div class="nm-struct-picks" role="radiogroup" aria-label="${nmEsc(t('nm_struct_q'))}">${NM_STRUCTURES.map(st => `<button type="button" role="radio" class="nm-struct-pick${struct === st.id ? ' selected' : ''}" aria-checked="${struct === st.id}" data-struct="${st.id}" onclick="nmTimesStructure('${st.id}')">${nmEsc(t('nm_struct_' + st.id))}</button>`).join('')}</div>
        <p class="nm-times-tip nm-times-same">${nmEsc(t('nm_times_same_kcal'))}</p>
        <div class="nm-card nm-times-list">${nmTimesActive().map(slot => `
            <div class="nm-rem-row">
                <span class="nm-rem-text"><b>${nmEsc(nmSlotName(slot))}</b></span>
                ${nmTimeBtnHtml('times-' + slot, s.times[slot], nmSlotName(slot), v => nmTimesSet(slot, v))}
            </div>`).join('')}</div>`;
    // טיפ קטן (לפי בקשה מפורשת): אפשר לשים את השעה הכי מאוחרת שבה אוכלים כל ארוחה
    html += `<p class="nm-times-tip">${nmEsc(t('nm_times_hint'))}</p>`;
    if (s.mode === 'routine' && s.found.length) html += `<label class="nm-agree nm-times-hide"><input type="checkbox" ${s.hide ? 'checked' : ''} onchange="nmTimes.hide = this.checked"><span>${nmEsc(t('nm_times_hide'))}</span></label>`;
    // בשאלון: גם משהו קטן בערב ובאיזו שעה (לפי בקשה מפורשת: "ואם יש נשנוש גם בערב ובאיזה שעה בערך") - לפני התפריט
    if (s.inQuiz && nmQuiz) html += nmQuizLateHtml();
    return html;
}
function nmQuizLateHtml() {
    const q = nmQuiz;
    const withTime = q.late === 'eat' || q.late === 'drink';
    return `
        <div class="nm-slot-name nm-late-q">🌙 ${nmEsc(t('nm_late_title'))}</div>
        ${nmLateChoicesHtml(q.late, 'nmQuizLate')}
        ${withTime ? `<div class="nm-card nm-times-list"><div class="nm-rem-row">
            <span class="nm-rem-text"><b>${nmEsc(t('nm_late_time_label'))}</b></span>
            ${nmTimeBtnHtml('times-late', q.lateTime || NEW_ME_LATE_TIME, t('nm_late_time_label'), v => { if (nmQuiz && /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '')) nmQuiz.lateTime = v; })}
        </div></div>${nmLatePicksHtml(q.late, 'quiz')}` : ''}`;
}
function nmTimesRerender() {
    const box = document.getElementById('nm-times-box');
    if (box) box.innerHTML = nmTimesBodyHtml();
    const save = document.querySelector('.nm-times-sheet [data-save]');
    if (save) save.disabled = !nmTimes.mode;
    // בשאלון: "המשך" נפתח רק אחרי שבוחרים
    if (nmQuiz && nmQuizStepId() === 'times') nmRenderQuiz(nmRoot());
}
async function nmTimesPick(mode) {
    if (!nmTimes) return;
    if (mode === 'routine') {
        const { times, items } = await nmRoutineMealTimes();
        nmTimes.found = items;
        nmTimes.routineTimes = times;
        Object.assign(nmTimes.times, times);
        if (nmTwoMeals(nmTimes.hidden)) nmTimesApplyDefaults(true);
    } else { nmTimes.found = []; nmTimes.routineTimes = null; }
    nmTimes.mode = mode;
    nmTimesRerender();
}
function nmTimesStructure(id) {
    const st = NM_STRUCTURES.find(s => s.id === id);
    if (!nmTimes || !st) return;
    const wasTwo = nmTwoMeals(nmTimes.hidden);
    nmTimes.hidden = st.hidden.slice();
    if (wasTwo !== nmTwoMeals(nmTimes.hidden)) nmTimesApplyDefaults(!wasTwo);
    nmTimesRerender();
}
// מעבר אל "2 ארוחות + נשנוש" וממנו: השעות שלא שונו ביד עוברות לשעות של המבנה - מהשגרה לפי סוג הארוחה (צהריים / ערב /
// נשנוש), ובלי שגרה 11:30 / 16:00 / 19:00 (או בחזרה לשעות הרגילות)
function nmTimesApplyDefaults(two) {
    const s = nmTimes, rt = s.routineTimes || {};
    ['meal1', 'meal2', 'snack1'].forEach(slot => {
        if (s.edited && s.edited[slot]) return;
        const fromRoutine = two ? { meal1: rt.meal2 || rt.meal1, meal2: rt.snack2, snack1: rt.snack1 }[slot] : rt[slot];
        s.times[slot] = fromRoutine || (two ? NEW_ME_TWO_MEAL_TIMES[slot] : NEW_ME_REMINDER_DEFAULTS[NEW_ME_DEFAULT_ORDER.indexOf(slot)]);
    });
}
function nmTimesSet(slot, value) {
    if (!nmTimes || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return;
    nmTimes.times[slot] = value;
    nmTimes.edited = { ...(nmTimes.edited || {}), [slot]: true };
}
// מה שנשמר בפרופיל: הארוחות שהוסרו, הסדר לפי השעות, ושנשאל
function nmTimesProfileRow() {
    const s = nmTimes;
    const order = NEW_ME_DEFAULT_ORDER.slice().sort((a, b) => s.times[a].localeCompare(s.times[b]) || NEW_ME_DEFAULT_ORDER.indexOf(a) - NEW_ME_DEFAULT_ORDER.indexOf(b));
    const row = { hidden_slots: s.hidden.join(',') || null, meal_order: order.join(','), meal_times_set_at: new Date().toISOString() };
    if (s.mode === 'routine' && s.found.length && s.hide) row.routine_meals_checked = true;
    return row;
}
// אחרי שהפרופיל נשמר: השעות לכל הארוחות, והסתרת הארוחות מהשגרה (אם נבחר) - כדי שלא יופיעו פעמיים
async function nmTimesApplyAfterSave(s) {
    await nmSyncReminders({ times: s.times });
    if (s.mode === 'routine' && s.found.length && s.hide) {
        await supabaseClient.from('routine_items').update({ hidden_by_new_me: true }).eq('user_id', currentUserId).in('id', s.found.map(it => it.id));
    }
}
function nmOpenMealTimes(opts = {}) {
    if (!nmProfile) return;
    nmTimesStart(opts);
    const firstTime = !!opts.firstTime;
    const ov = nmOpenSheet(`
        <h4>🕐 ${nmEsc(t('nm_times_title'))}</h4>
        <div id="nm-times-box">${nmTimesBodyHtml()}</div>
        <button type="button" class="nm-btn-primary" data-save disabled>${nmEsc(t('save_generic'))}</button>
        <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t(firstTime ? 'nm_times_later' : 'close_btn'))}</button>`, 'nm-times-sheet', () => { nmTimes = null; if (firstTime) nmTimesMarkAsked(); });
    ov.querySelector('[data-save]').addEventListener('click', async e => {
        const s = nmTimes;
        if (!s || !s.mode) return;
        const btn = e.currentTarget;
        btn.disabled = true;
        // ארוחה שיוצאת מהתפריט וכבר סומנה ✓ היום - הסימון יורד איתה (כמו בהסרת ארוחה)
        const prevHidden = nmHiddenSlots();
        for (const slot of s.hidden) if (!prevHidden.includes(slot) && nmTodayCheckins[slot]) await nmUncheck(slot);
        const row = nmTimesProfileRow();
        const { error } = await supabaseClient.from('new_me_profile').update({ ...row, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
        if (error) { btn.disabled = false; showAppToast(t('nm_save_error'), 'error'); return; }
        Object.assign(nmProfile, row);
        await nmTimesApplyAfterSave(s);
        ov.remove();
        nmTimes = null;
        showAppToast(t('nm_times_saved'));
        await nmLoadToday();
        nmRenderView(nmRoot());
        nmRenderHomeTile();
        if (typeof loadTodayTasks === 'function') loadTodayTasks();
    });
}
// פעם אחת, למי שכבר באמצע New Me: כשבשגרה יש ארוחות - יש מה לסנכרן, אז שואלים. בלי ארוחות בשגרה השעות נשארות
// כמו שהן (בשאלון זה שלב קבוע, ותמיד אפשר מההגדרות של New Me)
async function nmMaybeAskMealTimes() {
    const { items } = await nmRoutineMealTimes();
    if (!items.length || document.querySelector('.nm-sheet-overlay, .sr-reveal')) { if (!items.length && !nmProfile.routine_meals_checked) nmCheckRoutineMeals(); return; }
    nmOpenMealTimes({ firstTime: true });
}
// ✨ העולם הקסום (לפי בקשה מפורשת, 2026-10-13: "בתוך המשחק שיהיה פחות מעצבן ואז יצבע את הכל כמו שצובעים עם מברשת"): 5 ערכות
// הנושא הקסומות של New Me. נגיעה בערכה - מברשת של נצנצים צובעת את כל החלון בה (magicPaintTheme ב-app.js)
function nmOpenMagicPicker(invite) {
    if (typeof MAGIC_COLOR_THEMES === 'undefined') return null;
    const cur = currentColorThemeName();
    const tiles = MAGIC_COLOR_THEMES.map(k => `<button type="button" class="nm-magic-tile${cur === k ? ' selected' : ''}" data-theme="${k}" data-color-theme="${k}" aria-pressed="${cur === k}"><span class="home-theme-pattern" aria-hidden="true"></span><span class="nm-magic-name">${nmEsc(t(k + '_name'))}</span></button>`).join('');
    // 🎨 מההגדרות של New Me (לפי בקשה מפורשת, 2026-10-14: "שיהיה אפשר לשנות את הצבעים בהגדרות של המשחק בתוך הNEW ME"):
    // מתחת לעולמות הקסומים - כל שאר הצבעים של האפליקציה (New Me כולל את הפרימיום), אותן דוגמיות כמו בהגדרות
    const seen = new Set(MAGIC_COLOR_THEMES);
    const swatches = invite ? '' : [...document.querySelectorAll('.theme-swatch[data-theme]')].filter(s => !seen.has(s.dataset.theme) && seen.add(s.dataset.theme)).map(s => {
        const k = s.dataset.theme;
        const name = s.getAttribute('title') || k;
        return `<button type="button" class="${nmEsc(String(s.className).replace(/\bselected\b/g, '').trim())}${cur === k ? ' selected' : ''}" data-theme="${nmEsc(k)}" title="${nmEsc(name)}" aria-label="${nmEsc(name)}" aria-pressed="${cur === k}"></button>`;
    }).join('');
    const ov = nmOpenSheet(`
        <h4 class="nm-magic-title">✨ ${nmEsc(t('magic_picker_title'))}</h4>
        <div class="nm-magic-grid">${tiles}</div>
        ${swatches ? `<div class="nm-colors-grid" role="group" aria-label="${nmEsc(t('nm_settings_colors'))}">${swatches}</div>` : ''}
        ${invite ? `<button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('magic_not_now'))}</button>` : ''}`, 'nm-magic-sheet', invite ? () => nmMarkMagicOffered() : null);
    ov.querySelectorAll('.nm-magic-tile, .nm-colors-grid .theme-swatch').forEach(b => b.addEventListener('click', () => {
        ov.remove();
        nmMarkMagicOffered();
        selectColorTheme(b.dataset.theme);
    }));
    return ov;
}
function nmMagicOfferKey() { return `weekwise_magic_offered_${currentUserId}`; }
function nmMarkMagicOffered() { try { localStorage.setItem(nmMagicOfferKey(), '1'); } catch {} }
// פעם אחת (גם מיד אחרי הקנייה, כשנכנסים ל-New Me): הזמנה לבחור עולם קסום - במקום החלפה אוטומטית
function nmMaybeOfferMagic() {
    if (!hasNewMe || typeof MAGIC_COLOR_THEMES === 'undefined' || isMagicColorTheme(currentColorThemeName())) return false;
    let seen = false;
    try { seen = localStorage.getItem(nmMagicOfferKey()) === '1'; } catch {}
    if (seen || nmQuiz || document.querySelector('.nm-sheet-overlay, .sr-reveal, .app-tour-layer, .magic-paint')) return false;
    nmOpenMagicPicker(true);
    return true;
}
async function nmTimesMarkAsked() {
    if (!nmProfile || nmProfile.meal_times_set_at) return;
    nmProfile.meal_times_set_at = new Date().toISOString();
    await supabaseClient.from('new_me_profile').update({ meal_times_set_at: nmProfile.meal_times_set_at, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
}

function nmLateRow() { return nmReminders.find(r => r.position === 5) || null; }
function nmLateTime() { const r = nmLateRow(); return (r && r.time) || NEW_ME_LATE_TIME; }
// השם של הארוחה לפי המקום שלה בסדר המקורי (בוקר / צהריים / נשנוש / ערב קלה) - לא זז כשגוררים
function nmSlotName(slot) {
    // "2 ארוחות + נשנוש" (לפי בקשה מפורשת, 2026-10-14): שתי הארוחות הן ארוחת צהריים וארוחת ערב
    if (nmTwoMeals()) { if (slot === 'meal1') return t('nm_pos_3'); if (slot === 'meal2') return t('nm_pos_evening'); }
    return nmPosName(Math.max(0, NEW_ME_DEFAULT_ORDER.indexOf(slot)));
}
// המבנה "2 ארוחות + נשנוש" (רק הארוחה של הערב הקל ירדה) - בשאלון / בחלון השעות לפי מה שנבחר שם
function nmTwoMeals(hidden) { const h = hidden || (nmTimes ? nmTimes.hidden : nmHiddenSlots()); return h.length === 1 && h[0] === 'snack2'; }
// ארוחות שהוסרו מהתפריט (למשל 3 ארוחות במקום 4) - לפי בקשה מפורשת. ארוחה שהוסרה שומרת על
// המיקום שלה ביום (השם לפי שעת היום לא זז), והקלוריות שלה פנויות למילוי עד סך התוכנית
// לפחות 3 ארוחות ביום (לפי בקשה מפורשת: "תוריד את ה2 ארוחות")
const NEW_ME_MIN_MEALS = 3;
function nmHiddenSlots() { return String((nmProfile && nmProfile.hidden_slots) || '').split(',').filter(s => NEW_ME_SLOTS.includes(s)); }
function nmActiveOrder() { const hidden = nmHiddenSlots(); return nmOrder().filter(s => !hidden.includes(s)); }
// סדר חדש של הארוחות הפעילות → סדר מלא: הארוחות שהוסרו נשארות במקומן
function nmComposeOrder(active) { const hidden = nmHiddenSlots(); const queue = active.slice(); return nmOrder().map(s => (hidden.includes(s) ? s : queue.shift())); }
// כמה ארוחות צריך לסמן כדי שהיום ייחשב "טוב" - 3, או כולן כשיש פחות
function nmGoodDayChecks() { return Math.min(3, nmActiveOrder().length); }
// God Mode - נפתח למי שסיים/ה את כל האתגרים (ר' "אתגרים" למטה); עד אז false
function nmGodMode() { return typeof nmGodModeActive === 'function' ? nmGodModeActive() : false; }

// מה ש-New Me זוכר במכשיר (סיור שנראה, הזמנות חד-פעמיות, היומן בתפריט) - נמחק כשאין עדיין פרופיל, כך שמי שמתחיל/ה
// מחדש רואה הכול כמו בפעם הראשונה (המפתחות, המחשב וההעדפות של החדר - ר' roomLoad)
function nmClearLocalFlags() {
    const keys = ['weekwise_nm_tour_seen', 'weekwise_nm_ch_seen_ended', 'weekwise_nm_ch_suggest_hidden', 'weekwise_nm_photo_nudge_week'];
    if (currentUserId) keys.push(nmMagicOfferKey(), nmDiaryMenuKey());
    try { keys.forEach(k => localStorage.removeItem(k)); } catch {}
    if (typeof updateDiaryMenuItem === 'function') updateDiaryMenuItem();
}
async function renderNewMe() {
    const root = nmRoot();
    if (!root) return;
    // 🔧 הכפתור הקטן של המפתחת בתחתית (נעילה / "קנייה") - רק בחשבון הפיתוח
    if (typeof devRenderNewMePill === 'function') devRenderNewMePill();
    if (!hasNewMe) {
        const sec = document.getElementById('new-me-section');
        if (sec) sec.classList.remove('nm-hall-mode');
        nmRenderSales(root);
        if (typeof roomRenderDevKeys === 'function') roomRenderDevKeys();
        return;
    }
    if (!nmProfileLoaded) {
        root.innerHTML = '<div class="nm-loading"></div>';
        const { data } = await supabaseClient.from('new_me_profile').select('*').eq('user_id', currentUserId).maybeSingle();
        nmProfile = data || null;
        nmProfileLoaded = true;
        // אין עדיין פרופיל = מתחילים מההתחלה, גם במכשיר (לפי בקשה מפורשת, 2026-10-14: "תעשה כאילו אני משתמשת חדשה")
        if (!nmProfile) nmClearLocalFlags();
    }
    if (!nmProfile || nmQuiz) { if (!nmQuiz) nmStartQuiz(); nmRenderQuiz(root); return; }
    if (nmView === 'menu' || nmView === 'tips') nmView = 'home';
    await Promise.all([nmLoadToday(), nmLoadJourney(), nmLoadChallenges(), typeof roomLoad === 'function' ? roomLoad() : null]);
    nmRenderView(root);
    nmAwardBadges();
    if (nmProfile.reminders_on) nmSyncReminders();
    nmMaybeAutoTour();
    // החדר הסודי: מפתח חדש שעוד לא נחשף (למשל היום השלישי עם New Me) + כפתור המפתח של מנהלת המוצר
    if (typeof roomCheckNewKeys === 'function') { roomCheckNewKeys(); roomRenderDevKeys(); }
    // ✨ העולם הקסום - הזמנה חד-פעמית לבחור ערכה קסומה (במקום החלפה אוטומטית אחרי הקנייה)
    if (nmMaybeOfferMagic()) return;
    // שעות האוכל - שואלים פעם אחת (מהשגרה, או כמה ארוחות ומתי); ואחר כך, אם צריך, אם להסתיר ארוחות מהשגרה
    if (!nmProfile.meal_times_set_at) nmMaybeAskMealTimes();
    else if (!nmProfile.routine_meals_checked) nmCheckRoutineMeals();
}

// ---------- מכירה ----------
// לפי בקשה מפורשת: "תמציתי, שהכל יהיה שם ויהיה רשום הכל, שידעו למה הם משלמים... שיראה מקצועי".
// כותרת, שני מסלולים (לכל החיים / חודשי) וכפתור, "מה מקבלים" בשלוש קבוצות, איך זה עובד (3 שלבים),
// שאלות קצרות וכפתור שוב (ההצצה ליום ירדה - לפי בקשה מפורשת: "ההצצה הזו גרועה תמחוק אותה"). המחירים עצמם נקבעים ב-Lemon Squeezy - כאן רק התוויות שמוצגות
// מאז 2026-10-13 New Me כולל את כל הפרימיום ("פרימיום + משחק התקדמות"), ולכן מעל מחיר הפרימיום (8.99 לחודש) -
// לפי אישור מפורש: 11.99 לחודש / 99.99 לכל החיים (ב-Lemon Squeezy: אותם מוצרים, אותם מזהים)
const NEW_ME_PRICES = { life: '$99.99', monthly: '$11.99' };
let nmSalesPlan = 'life';
function nmBuyLabel(plan) {
    return plan === 'monthly'
        ? t('nm_buy_btn_monthly').replace('{price}', NEW_ME_PRICES.monthly)
        : t('nm_buy_btn_price').replace('{price}', NEW_ME_PRICES.life);
}
function nmPlanOptionsHtml() {
    const opt = (plan, name, price, per, sub, badge) => `
        <button type="button" role="radio" aria-checked="${nmSalesPlan === plan}" class="nm-plan-opt${nmSalesPlan === plan ? ' selected' : ''}" data-plan="${plan}" onclick="nmPickSalesPlan('${plan}')">
            ${badge ? `<span class="nm-plan-badge">${nmEsc(badge)}</span>` : ''}
            <span class="nm-plan-name">${nmEsc(name)}</span>
            <span class="nm-plan-price"><bdi dir="ltr">${price}</bdi>${per ? `<small>${nmEsc(per)}</small>` : ''}</span>
            <span class="nm-plan-sub">${nmEsc(sub)}</span>
        </button>`;
    return `<div class="nm-plans" role="radiogroup" aria-label="${nmEsc(t('nm_bill_title'))}">
        ${opt('life', t('nm_plan_life'), NEW_ME_PRICES.life, '', t('nm_plan_life_sub'), t('nm_plan_best'))}
        ${opt('monthly', t('nm_plan_monthly'), NEW_ME_PRICES.monthly, t('nm_plan_per_month'), t('nm_plan_monthly_sub'), '')}
    </div>`;
}
// בחירת מסלול: מעדכנים במקום (בלי לצייר מחדש - שהגלילה והשאלות הפתוחות יישארו)
function nmPickSalesPlan(plan) {
    nmSalesPlan = plan === 'monthly' ? 'monthly' : 'life';
    document.querySelectorAll('#new-me-root .nm-plan-opt').forEach(b => {
        const on = b.dataset.plan === nmSalesPlan;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-checked', String(on));
    });
    document.querySelectorAll('#new-me-root .nm-buy-btn').forEach(b => { if (!b.disabled) b.textContent = nmBuyLabel(nmSalesPlan); });
}
const NEW_ME_SALES_GROUPS = [
    ['nm_sales_g_menu', ['nm_sales_f1', 'nm_sales_f5', 'nm_sales_f8', 'nm_sales_f6', 'nm_sales_f4']],
    ['nm_sales_g_track', ['nm_sales_f2', 'nm_sales_f9', 'nm_sales_f10', 'nm_sales_f11', 'nm_sales_f3']],
    ['nm_sales_g_journey', ['nm_sales_f12', 'nm_sales_f7', 'nm_sales_f13', 'nm_sales_f14']],
];
function nmRenderSales(root) {
    const buy = `<button type="button" class="nm-btn-primary nm-buy-btn" onclick="submitNewMePurchase(this)">${nmEsc(nmBuyLabel(nmSalesPlan))}</button>`;
    root.innerHTML = `
        <div class="nm-sales">
            <div class="nm-hero">
                <div class="nm-hero-eyebrow">${NM_ICON_SVG} New Me</div>
                <h2 class="nm-hero-title">${nmEsc(t('nm_sales_title'))}</h2>
                <p class="nm-hero-sub">${nmEsc(t('nm_sales_subtitle'))}</p>
                <span class="nm-sales-premium">${nmEsc(t('nm_sales_premium'))}</span>
            </div>
            ${nmTrailerHtml()}
            ${nmPlanOptionsHtml()}
            ${buy}
            <p class="nm-sales-trust">${nmEsc(t('nm_sales_trust'))}</p>
            <section class="nm-sales-card">
                <h3>${nmEsc(t('nm_sales_inc_title'))}</h3>
                ${NEW_ME_SALES_GROUPS.map(([g, items]) => `
                    <div class="nm-sales-group">
                        <div class="nm-sales-group-title">${nmEsc(t(g))}</div>
                        <ul class="nm-features">${items.map(k => `<li>${nmEsc(t(k))}</li>`).join('')}</ul>
                    </div>`).join('')}
            </section>
            <section class="nm-sales-card">
                <h3>${nmEsc(t('nm_sales_how_title'))}</h3>
                <ol class="nm-sales-steps">${[1, 2, 3].map(i => `<li><span class="nm-step-num" aria-hidden="true">${nmFmt(i)}</span><span>${nmEsc(t('nm_sales_how' + i))}</span></li>`).join('')}</ol>
            </section>
            <section class="nm-sales-card nm-sales-faq">
                ${[1, 2, 3].map(i => `<details><summary>${nmEsc(t('nm_sales_q' + i))}</summary><p>${nmEsc(t('nm_sales_a' + i).replace('{monthly}', NEW_ME_PRICES.monthly).replace('{life}', NEW_ME_PRICES.life))}</p></details>`).join('')}
            </section>
            ${buy}
        </div>`;
    nmTrailerInit(root.querySelector('.nmt'));
}

// ---------- 🎬 סרטון קצר בעמוד הקנייה ----------
// לפי בקשה מפורשת (2026-10-11): "סרטון קצר של מה שקורה ב-NEW ME לפני שקונים". לא קובץ וידאו: אותו ציור של
// המסדרון (nmhSceneSvg) עם "מצלמה" שזזה, אצבע שנוגעת וכתוביות בשפה של המשתמש - כך הוא תמיד נראה בדיוק כמו
// New Me, בכל 33 השפות. מתנגן לבד פעם אחת כשרואים אותו (לא כשמבקשים פחות תנועה), נגיעה עוצרת וממשיכה, ובסוף
// "לצפות שוב". מה שמאחורי הדלתות לא מוצג - זה נשאר הפתעה
const NMT_SCENES = [4800, 5200, 4800, 4600, 4000, 3000];
const NMT_TOTAL = NMT_SCENES.reduce((a, b) => a + b, 0);
const NMT_FRAME_H = 540;   // גובה החלון ביחידות של הציור (הרוחב 390)
const NMT_PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
const NMT_REPLAY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v4h4"/></svg>';
let nmt = null;
function nmtKcal(i) { return NEW_ME_PLANS[1300][NEW_ME_DEFAULT_ORDER[i]].options.A.kcal; }
// השלבים: [מתי (מ"ש), מה משתנה]. כל שלב קובע עד הסוף את החלקים שהוא נוגע בהם, כך שאפשר גם לקפוץ לכל רגע
function nmtSteps() {
    const k1 = nmtKcal(0), k2 = nmtKcal(1);
    return [
        [0, { cap: 1, cam: 'top', lit: 0, fresh: -1, keys: 0, door: false, quiz: 'plans', bag: false, ch: null, fly: null, spark: false, end: false, kcal: null, finger: null }],
        [900, { finger: { el: '[data-nmt-plan="1300"]' } }],
        [1500, { finger: { el: '[data-nmt-plan="1300"]', tap: true }, quiz: 'picked' }],
        [2300, { quiz: 'menu', finger: null }],
        [4400, { quiz: null }],
        [4800, { cap: 2, finger: { lamp: 0 } }],
        [5500, { finger: { lamp: 0, tap: true }, lit: 1, fresh: 0, kcal: k1 }],
        [6900, { finger: { lamp: 1 } }],
        [7500, { finger: { lamp: 1, tap: true }, lit: 2, fresh: 1, kcal: k1 + k2 }],
        [9000, { finger: null }],
        [10000, { cap: 3, cam: 'bag', kcal: null, fresh: -1 }],
        [11100, { finger: { scene: [300, 772] } }],
        [11700, { finger: { scene: [300, 772], tap: true }, bag: true }],
        [12300, { finger: null }],
        [14300, { bag: false }],
        [14800, { cap: 4, ch: 0 }],
        ...[1, 2, 3, 4, 5, 6, 7].map(n => [15000 + n * 200, { ch: n }]),
        [16700, { ch: 'done' }],
        [17200, { fly: 'go' }],
        [18100, { fly: null, keys: 1 }],
        [19000, { ch: null }],
        [19400, { cap: 5, cam: 'door' }],
        [20800, { door: true, spark: true }],
        [23400, { cap: 0, end: true, spark: false }],
    ];
}
// "המצלמה": איזה חלק של המסדרון רואים (ox/oy ביחידות הציור) ובאיזה זום
function nmtCam(name) {
    if (name === 'bag') return { ox: 0, oy: NMH_H - NMT_FRAME_H, z: 1 };
    if (name === 'door') {
        const z = 1.7, w = NMH_W / z, h = NMT_FRAME_H / z;
        return { ox: Math.min(Math.max(nmhMx(361) - w / 2, 0), NMH_W - w), oy: Math.min(Math.max(392 - h / 2, 0), NMH_H - h), z };
    }
    return { ox: 0, oy: 150, z: 1 };
}
// נקודה בציור → מיקום באחוזים בחלון, לפי המצלמה
function nmtPt(cam, x, y) { return { x: (x - cam.ox) * cam.z / NMH_W * 100, y: (y - cam.oy) * cam.z / NMT_FRAME_H * 100 }; }
function nmtArt(st, instant) {
    const lampsSvg = NMH_LAMPS.map((_, i) => nmhLampSvg(i, i < st.lit ? 'lit' : i === st.lit ? 'next' : 'off', !instant && i === st.fresh ? 'nmt-fresh' : '')).join('');
    return nmhSceneSvg({ lampsSvg, doorOpen: n => n === 1 && st.door, doorCls: n => (n === 1 && st.door && !instant ? 'nmt-fresh' : ''), roofOpen: false }) + nmhBagFrontSvg(st.keys);
}
function nmtQuizHtml(mode) {
    if (mode === 'menu') {
        return `<div class="nmt-menu">${NEW_ME_DEFAULT_ORDER.map((slot, i) => `<div class="nmt-menu-row" style="--i:${i}"><bdi dir="ltr" class="nmt-menu-time">${nmEsc(NEW_ME_REMINDER_DEFAULTS[i] || '')}</bdi><span class="nmt-menu-name"><b>${nmEsc(nmPosName(i))}</b><small>${nmEsc(nmOptText(1300, slot, 'A', true))}</small></span><bdi dir="ltr" class="nmt-menu-kcal">~${nmFmt(nmtKcal(i))}</bdi></div>`).join('')}</div>`;
    }
    return `<div class="nmt-plans">${[1300, 1500].map(p => `<span class="nmt-plan${mode === 'picked' && p === 1300 ? ' is-on' : ''}" data-nmt-plan="${p}"><b>${nmFmt(p)}</b><small>${nmEsc(t('calories_unit'))}</small></span>`).join('')}</div>`;
}
function nmTrailerHtml() {
    const dots = [1, 2, 3, 4, 5, 6, 7].map(() => '<i></i>').join('');
    const rows = NEW_ME_DEFAULT_ORDER.map((_, i) => `<div class="nmt-bag-row${i < 2 ? ' is-done' : ''}"><span class="nmt-bag-lamp" aria-hidden="true"></span><span class="nmt-bag-name">${nmEsc(nmPosName(i))}</span><span class="nmt-bag-check">${i < 2 ? '✓' : ''}</span></div>`).join('');
    return `
        <section class="nmt">
            <div class="nmt-frame" role="button" tabindex="0" aria-label="${nmEsc(t('nm_trailer_play'))}">
                <div class="nmt-stage"><div class="nmt-art"></div></div>
                <div class="nmt-kcal" aria-hidden="true"></div>
                <div class="nmt-card nmt-quiz" aria-hidden="true"></div>
                <div class="nmt-card nmt-bagsheet" aria-hidden="true">${rows}<div class="nmt-bag-extra"><span>💧 ${nmEsc(t('myday_water'))} <bdi dir="ltr">6/8</bdi></span><span>🛒 ${nmEsc(t('nm_tile_shop'))}</span></div></div>
                <div class="nmt-card nmt-challenge" aria-hidden="true"><span class="nmt-ch-title">🔥 ${nmEsc(t('nm_tile_challenges'))}</span><span class="nmt-ch-dots">${dots}</span><span class="nmt-ch-done">✓</span></div>
                <span class="nmt-keyfly" aria-hidden="true">${nmhKeySvg('#ffd27a')}</span>
                <div class="nmt-spark" aria-hidden="true">${[0, 1, 2, 3, 4, 5].map(i => `<i style="--d:${(i * 0.27).toFixed(2)}"></i>`).join('')}</div>
                <div class="nmt-end" aria-hidden="true"><span class="nmt-end-mark">${NM_ICON_SVG}</span><b>New Me</b><span class="nmt-end-line">${nmEsc(t('nm_trailer_end'))}</span></div>
                <span class="nmt-finger" aria-hidden="true"></span>
                <div class="nmt-bars" aria-hidden="true">${NMT_SCENES.map(() => '<span><i></i></span>').join('')}</div>
                <p class="nmt-cap" aria-live="polite"></p>
                <span class="nmt-play" aria-hidden="true"></span>
            </div>
        </section>`;
}
function nmTrailerInit(el) {
    if (!el) return;
    if (nmt && nmt.raf) cancelAnimationFrame(nmt.raf);
    nmt = { el, st: {}, t: 0, idx: 0, steps: nmtSteps(), playing: false, started: false, played: false, last: 0, raf: null };
    // הניצוצות ליד הדלת (המצלמה של הדלת קבועה)
    const cam = nmtCam('door');
    el.querySelectorAll('.nmt-spark i').forEach((s, i) => {
        const [dx, dy] = [[-16, -64], [14, -34], [-12, 6], [18, 34], [-20, 64], [6, -92]][i];
        const p = nmtPt(cam, nmhMx(361) + dx, 392 + dy);
        s.style.left = `${p.x.toFixed(2)}%`;
        s.style.top = `${p.y.toFixed(2)}%`;
    });
    // התמונה לפני שמתחיל: שתי מנורות דולקות, מפתח בצרור ודלת מוארת
    nmtApply({ cap: -1, cam: 'top', lit: 2, fresh: -1, keys: 1, door: true, quiz: null, bag: false, ch: null, fly: null, spark: false, end: false, kcal: null, finger: null }, true);
    nmtButton('play');
    const frame = el.querySelector('.nmt-frame');
    frame.addEventListener('click', nmtToggle);
    frame.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nmtToggle(); } });
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver(entries => {
            if (!nmt || nmt.el !== el || !el.isConnected) { io.disconnect(); return; }
            if (entries.some(en => en.isIntersecting) && !nmt.played) { io.disconnect(); nmtPlay(); }
        }, { threshold: 0.6 });
        io.observe(frame);
    }
}
function nmtApply(patch, instant) {
    const prev = nmt.st;
    const st = nmt.st = { ...prev, ...patch };
    const q = s => nmt.el.querySelector(s);
    if (st.cam !== prev.cam) {
        const c = nmtCam(st.cam);
        q('.nmt-stage').style.transform = `scale(${c.z}) translate(${(-c.ox / NMH_W * 100).toFixed(3)}%, ${(-c.oy / NMH_H * 100).toFixed(3)}%)`;
    }
    if (st.lit !== prev.lit || st.keys !== prev.keys || st.door !== prev.door || st.fresh !== prev.fresh) q('.nmt-art').innerHTML = nmtArt(st, instant);
    if ('quiz' in patch) {
        const card = q('.nmt-quiz');
        if (st.quiz) card.innerHTML = nmtQuizHtml(st.quiz);
        card.classList.toggle('is-on', !!st.quiz);
    }
    if ('kcal' in patch) {
        const k = q('.nmt-kcal');
        if (st.kcal != null) k.innerHTML = `<bdi dir="ltr">${nmFmt(st.kcal)} / ${nmFmt(1300)}</bdi> ${nmEsc(t('calories_unit'))}`;
        k.classList.toggle('is-on', st.kcal != null);
    }
    if ('bag' in patch) q('.nmt-bagsheet').classList.toggle('is-on', !!st.bag);
    if ('ch' in patch) {
        const card = q('.nmt-challenge');
        card.classList.toggle('is-on', st.ch != null);
        card.classList.toggle('is-done', st.ch === 'done');
        card.querySelectorAll('.nmt-ch-dots i').forEach((d, i) => d.classList.toggle('on', st.ch === 'done' || (typeof st.ch === 'number' && i < st.ch)));
    }
    if ('fly' in patch) nmtFly(!!st.fly && !instant);
    if ('spark' in patch) q('.nmt-spark').classList.toggle('is-on', !!st.spark);
    if ('end' in patch) q('.nmt-end').classList.toggle('is-on', !!st.end);
    if ('cap' in patch) {
        const cap = q('.nmt-cap');
        cap.textContent = st.cap === -1 ? t('nm_trailer_label') : st.cap > 0 ? t(`nm_trailer_c${st.cap}`) : '';
        if (!instant && cap.textContent) { cap.classList.remove('is-new'); void cap.offsetWidth; cap.classList.add('is-new'); }
    }
    if ('finger' in patch) nmtFinger(st.finger, instant);
}
// האצבע: על כפתור בכרטיס (el), על מנורה (lamp), או על נקודה בציור (scene); tap - נגיעה
function nmtFinger(f, instant) {
    const fg = nmt.el.querySelector('.nmt-finger');
    if (!f) { fg.classList.remove('is-on', 'is-tap'); return; }
    const cam = nmtCam(nmt.st.cam);
    let p = { x: 50, y: 50 };
    if (f.lamp != null) p = nmtPt(cam, nmhMx(NMH_LAMPS[f.lamp].x), NMH_LAMPS[f.lamp].y + 4);
    else if (f.scene) p = nmtPt(cam, f.scene[0], f.scene[1]);
    else if (f.el) {
        const target = nmt.el.querySelector(f.el);
        const fr = nmt.el.querySelector('.nmt-frame').getBoundingClientRect();
        if (target && fr.width && fr.height) {
            const r = target.getBoundingClientRect();
            p = { x: (r.left + r.width / 2 - fr.left) / fr.width * 100, y: (r.top + r.height / 2 - fr.top) / fr.height * 100 };
        }
    }
    fg.style.left = `${p.x.toFixed(2)}%`;
    fg.style.top = `${p.y.toFixed(2)}%`;
    fg.classList.add('is-on');
    if (f.tap && !instant) { fg.classList.remove('is-tap'); void fg.offsetWidth; fg.classList.add('is-tap'); }
}
// המפתח עף מהאתגר שנגמר אל הצרור שעל התרמיל
function nmtFly(go) {
    const k = nmt.el.querySelector('.nmt-keyfly');
    if (!go) { k.classList.remove('is-on'); return; }
    const card = nmt.el.querySelector('.nmt-challenge').getBoundingClientRect();
    const fr = nmt.el.querySelector('.nmt-frame').getBoundingClientRect();
    const sx = fr.width ? (card.left + card.width / 2 - fr.left) / fr.width * 100 : 50;
    const sy = fr.height ? (card.top + card.height / 2 - fr.top) / fr.height * 100 : 26;
    const end = nmtPt(nmtCam('bag'), 242, 806);
    k.style.transition = 'none';
    k.style.left = `${sx.toFixed(2)}%`;
    k.style.top = `${sy.toFixed(2)}%`;
    k.style.transform = 'scale(1.3)';
    k.classList.add('is-on');
    void k.offsetWidth;
    k.style.transition = '';
    k.style.left = `${end.x.toFixed(2)}%`;
    k.style.top = `${end.y.toFixed(2)}%`;
    k.style.transform = 'scale(0.55) rotate(-25deg)';
}
function nmtBars() {
    let start = 0;
    nmt.el.querySelectorAll('.nmt-bars i').forEach((bar, i) => {
        const d = NMT_SCENES[i];
        bar.style.width = `${(Math.max(0, Math.min(1, (nmt.t - start) / d)) * 100).toFixed(1)}%`;
        start += d;
    });
}
// הכפתור שבאמצע והתווית של החלון: ▶ (להתחיל / להמשיך), ↻ (לצפות שוב); בזמן הניגון - "להשהות"
function nmtButton(kind) {
    nmt.el.querySelector('.nmt-play').innerHTML = kind === 'replay' ? NMT_REPLAY_SVG : NMT_PLAY_SVG;
    nmt.el.querySelector('.nmt-frame').setAttribute('aria-label', t(kind === 'replay' ? 'nm_trailer_replay' : kind === 'pause' ? 'nm_trailer_pause' : 'nm_trailer_play'));
}
function nmtRun(instant) {
    while (nmt.idx < nmt.steps.length && nmt.steps[nmt.idx][0] <= nmt.t) {
        nmtApply(nmt.steps[nmt.idx][1], instant);
        nmt.idx++;
    }
}
function nmtTick(now) {
    if (!nmt || !nmt.playing) return;
    if (!nmt.el.isConnected) { nmt.playing = false; return; }
    nmt.t += Math.min(100, Math.max(0, now - nmt.last));
    nmt.last = now;
    nmtRun(false);
    nmtBars();
    if (nmt.t >= NMT_TOTAL) { nmtStop(true); return; }
    nmt.raf = requestAnimationFrame(nmtTick);
}
function nmtPlay() {
    if (!nmt || nmt.playing) return;
    if (!nmt.started || nmt.t >= NMT_TOTAL) { nmt.t = 0; nmt.idx = 0; nmt.started = true; nmtRun(false); nmtBars(); }
    nmt.playing = true;
    nmt.played = true;
    nmt.el.classList.add('is-playing');
    nmtButton('pause');
    nmt.last = performance.now();
    nmt.raf = requestAnimationFrame(nmtTick);
}
function nmtStop(ended) {
    if (!nmt) return;
    nmt.playing = false;
    if (nmt.raf) cancelAnimationFrame(nmt.raf);
    nmt.raf = null;
    nmt.el.classList.remove('is-playing');
    nmtButton(ended ? 'replay' : 'play');
}
function nmtToggle() {
    if (!nmt) return;
    if (nmt.playing) nmtStop(false);
    else nmtPlay();
}
// קפיצה לרגע מסוים בלי אנימציה (לבדיקות ולצילומי מסך)
function nmTrailerSeek(ms) {
    if (!nmt) return;
    nmtStop(false);
    nmt.el.classList.add('is-instant');
    nmt.idx = 0;
    nmt.started = true;
    nmt.t = Math.max(0, Math.min(ms, NMT_TOTAL));
    nmtRun(true);
    nmtBars();
    void nmt.el.offsetWidth;
    nmt.el.classList.remove('is-instant');
}

// plan: 'life' (תשלום אחד) או 'monthly' (מנוי) - ברירת מחדל: מה שנבחר בעמוד הרכישה
async function submitNewMePurchase(btn, plan = nmSalesPlan) {
    // חשבון הפיתוח בתצוגה הנעולה: "קנייה" בלי תשלום - New Me נפתח בדיוק כמו אחרי קנייה אמיתית (devSimBuyNewMe)
    if (typeof isDevSuperuserAccount !== 'undefined' && isDevSuperuserAccount && !hasNewMe) { devSimBuyNewMe(); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const original = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = t('food_ai_estimating'); }
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) { showAppToast(t('error_not_connected'), 'error'); return; }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tier: plan === 'monthly' ? 'new_me_monthly' : 'new_me' }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.url) { showAppToast(t('settings_billing_error_toast'), 'error'); return; }
        window.location.href = result.url;
    } catch {
        showAppToast(t('settings_billing_error_toast'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = original; }
    }
}

// חזרה מה-checkout: ה-webhook יכול להגיע כמה שניות אחרי - בודקים עד ~10 שניות
async function handleNewMeCheckoutReturn() {
    openNewMe();
    if (!hasNewMe) {
        showAppToast(t('nm_unlocking'));
        for (let i = 0; i < 5 && !hasNewMe; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const { data } = await supabaseClient.from('user_premium').select('new_me_purchased').eq('user_id', currentUserId).maybeSingle();
            hasNewMe = !!(data && data.new_me_purchased);
        }
    }
    if (hasNewMe) {
        // New Me כולל את הפרימיום - טוענים מחדש את כל הסטטוס, כדי שגם הפרימיום ייפתח מיד
        if (typeof loadPremiumStatus === 'function') await loadPremiumStatus();
        updateNewMeShortcut();
        renderNewMe();
        if (typeof celebrateNewMeUnlock === 'function') celebrateNewMeUnlock(); else showAppToast(t('nm_unlocked_toast'));
    }
    else showAppToast(t('nm_unlock_pending'), 'error');
}

// ---------- שאלון ----------
function nmStartQuiz(fromSettings, fresh) {
    // כמו קונה חדש (מנהלת המוצר, ר' nmStartQuizFresh): השאלון מתחיל ריק, בלי מה שכבר שמור
    const p = fresh ? null : nmProfile;
    nmQuiz = {
        step: 0,
        agreed: false,
        weight: '',
        goal: p && p.goal_weight != null ? String(p.goal_weight) : '',
        plan: p ? p.plan : 1300,
        choices: Object.fromEntries(NEW_ME_SLOTS.map(s => [s, p ? nmChoice(s) : 'A'])),
        choices2: Object.fromEntries(NEW_ME_SLOTS.map(s => [s, p ? nmChoice2(s) : null])),
        fromSettings: !!fromSettings,
        fresh: !!fresh,
        // מכתב מהעבר (לא חובה) - שלב אחרון, רק כשעוד לא נכתב (גם בשאלון "כמו קונה חדש" - מכתב חתום לא נכתב מחדש)
        withLetter: !(nmProfile && nmProfile.letter_written_at),
        letter: '',
        name: (p && p.cert_name) || '',
        late: p ? nmLateChoice() : null,
        lateTime: p ? nmLateTime() : NEW_ME_LATE_TIME,
        // 🧈 הבחירות שבתוך אפשרויות (ממרחים, דגני בוקר, חלב, דברים קלים) - ר' NEW_ME_PICKS
        picks: p && p.picks && typeof p.picks === 'object' ? JSON.parse(JSON.stringify(p.picks)) : {},
        picksClosed: {},
        // 🕐 הארוחה הקטנה הנוספת של ארוחת הבוקר הקטנה (ר' NEW_ME_SIDE_OPTIONS)
        side: p ? p.side_choice : null,
        sideTime: p ? p.side_time : null,
    };
    // שם מלא: אם עוד לא נשמר - ממלאים מראש מחשבון Google (אפשר לשנות)
    if (!nmQuiz.name && typeof nmCertDefaultName === 'function') nmCertDefaultName().then(def => {
        if (!nmQuiz || nmQuiz.name || !def) return;
        nmQuiz.name = def;
        const input = document.getElementById('nm-q-name');
        if (input && !input.value) input.value = def;
    });
}
// השלבים לפי הסדר (לפי בקשה מפורשת, 2026-10-14: "תמחוק את הAI בNEW ME... ופשוט תשאל כמה ארוחות לפני התפריט ולפי זה
// תביא את כל האפשרויות"): קודם הארוחות והשעות (וגם משהו קטן בערב ובאיזו שעה), ואז כל האפשרויות של הארוחות האלה.
// menuOnly = "בניית התפריט" מההגדרות של התוכנית, למי שכבר מילא את השאלון: רק שני השלבים האלה
function nmQuizSteps() {
    if (nmQuiz && nmQuiz.menuOnly) return ['times', 'menu'];
    return ['agree', 'about', 'plan', 'times', 'menu'].concat(nmQuiz && nmQuiz.withLetter ? ['letter'] : []);
}
function nmQuizTotal() { return nmQuizSteps().length; }
function nmQuizStepId() { return nmQuiz ? nmQuizSteps()[nmQuiz.step] : null; }
function nmStartMenuQuiz(from) {
    if (!nmProfile) return;
    nmStartQuiz(true);
    nmQuiz.menuOnly = true;
    nmQuiz.returnTo = from || 'settings';
    nmTimes = null;
    renderNewMe();
    nmScrollTop();
}
// מנהלת המוצר: "קנייה" מדומה פותחת את השאלון מההצהרה, בדיוק כמו שקונה חדש רואה (לפי בקשה מפורשת: "קניתי מחדש את
// הNEW בלי להצהיר... שים לב") - ובסוף הוא נשמר כמו אצל כל קונה (לפי בקשה מפורשת: "אני רוצה שזה ישמר שאעשה את הדיאטה שלי")
function nmStartQuizFresh() {
    nmStartQuiz(false, true);
    nmTimes = null;
}

function nmDisclaimerHtml() {
    const suffix = currentLang === 'he' ? '' : (currentLang === 'es' ? '-es' : '-en');
    return `
        <h3 class="nm-step-title">${nmEsc(t('nm_disclaimer_title'))}</h3>
        <div class="nm-legal">
            ${[1, 2, 3, 4].map(i => `<p>${nmEsc(t('nm_disclaimer_p' + i))}</p>`).join('')}
            <a class="nm-link" href="terms${suffix}.html#new-me-disclaimer" target="_blank" rel="noopener">${nmEsc(t('nm_disclaimer_terms_link'))}</a>
        </div>`;
}

function nmRenderQuiz(root) {
    const q = nmQuiz;
    const total = nmQuizTotal();
    let body = '';
    let canContinue = true;
    const id = nmQuizStepId();
    if (id === 'agree') {
        body = `${nmDisclaimerHtml()}
            <label class="nm-agree">
                <input type="checkbox" ${q.agreed ? 'checked' : ''} onchange="nmQuiz.agreed = this.checked; nmRenderQuiz(nmRoot())">
                <span>${nmEsc(t('nm_disclaimer_agree'))}</span>
            </label>`;
        canContinue = q.agreed;
    } else if (id === 'about') {
        // שם מלא (חובה - לפי בקשה מפורשת: "כל אחד שנרשם ירשום גם מה השם המלא שלו"). משמש לתעודה
        // שבמתנה - אבל לא כותבים את זה כאן: מה שיש במתנה הוא הפתעה (לפי בקשה מפורשת)
        body = `
            <h3 class="nm-step-title">${nmEsc(t('nm_q_about_title'))}</h3>
            <label class="nm-field"><span>${nmEsc(t('nm_q_full_name'))}</span>
                <input type="text" id="nm-q-name" maxlength="60" autocomplete="name" value="${nmEsc(q.name)}" oninput="nmQuiz.name = this.value"></label>
            <label class="nm-field"><span>${nmEsc(t('nm_q_current_weight'))}</span>
                <input type="number" inputmode="decimal" step="0.1" min="20" max="400" value="${nmEsc(q.weight)}" oninput="nmQuiz.weight = this.value"></label>
            <label class="nm-field"><span>${nmEsc(t('nm_q_goal_weight'))}</span>
                <input type="number" inputmode="decimal" step="0.1" min="20" max="400" value="${nmEsc(q.goal)}" oninput="nmQuiz.goal = this.value"></label>`;
    } else if (id === 'plan') {
        body = `
            <h3 class="nm-step-title">${nmEsc(t('nm_q_plan_title'))}</h3>
            <div class="nm-plan-cards">
                ${[1300, 1500].map(p => `
                    <button type="button" class="nm-plan-card${q.plan === p ? ' selected' : ''}" onclick="nmQuiz.plan = ${p}; nmRenderQuiz(nmRoot())">
                        <span class="nm-plan-num">${nmFmt(p)}</span>
                        <span class="nm-plan-unit">${nmEsc(t('calories_unit'))}</span>
                        <span class="nm-plan-desc">${nmEsc(t('nm_plan_' + p + '_desc'))}</span>
                    </button>`).join('')}
            </div>
            <p class="nm-fine">${nmEsc(t('nm_q_plan_note'))}</p>`;
    } else if (id === 'times') {
        // שעות האוכל: מהשגרה, או כמה ארוחות ומתי (ר' nmTimesBodyHtml)
        if (!nmTimes) nmTimesStart({ fresh: q.fresh, inQuiz: true });
        body = `
            <h3 class="nm-step-title">🕐 ${nmEsc(t('nm_times_title'))}</h3>
            <div id="nm-times-box">${nmTimesBodyHtml()}</div>`;
        canContinue = !!nmTimes.mode;
    } else if (id === 'letter') {
        body = `
            <h3 class="nm-step-title">✉️ ${nmEsc(t('nm_letter_title'))}</h3>
            <p class="nm-fine">${nmEsc(t('nm_letter_intro').replace('{n}', nmFmt(NEW_ME_CHALLENGES.length)))}</p>
            <textarea class="nm-letter-input" rows="8" maxlength="4000" placeholder="${nmEsc(t('nm_letter_ph'))}" aria-label="${nmEsc(t('nm_letter_title'))}" oninput="nmQuiz.letter = this.value">${nmEsc(q.letter)}</textarea>
            <p class="nm-fine">🔒 ${nmEsc(t('nm_letter_seal_note'))}</p>
            <p class="nm-fine">${nmEsc(t('nm_letter_quiz_note'))}</p>`;
    } else {
        const menu = nmQuizMenuHtml(q);
        body = menu.body;
        canContinue = menu.canContinue;
    }
    const isLast = q.step === total - 1;
    root.innerHTML = `
        <div class="nm-quiz">
            <div class="nm-steps" aria-label="${nmEsc(t('nm_step_of').replace('{n}', q.step + 1).replace('{total}', total))}">
                ${Array.from({ length: total }, (_, i) => `<span class="nm-step-dot${i <= q.step ? ' on' : ''}"></span>`).join('')}
            </div>
            ${body}
            <div class="nm-quiz-actions">
                ${q.step > 0 || q.fromSettings || (q.fresh && nmProfile) ? `<button type="button" class="nm-btn-ghost" onclick="nmQuizBack()">${nmEsc(t('nm_back'))}</button>` : ''}
                <button type="button" class="nm-btn-primary" ${canContinue ? '' : 'disabled'} onclick="nmQuizNext()">${nmEsc(t(isLast ? 'nm_finish' : 'nm_continue'))}</button>
            </div>
        </div>`;
}

function nmQuizLate(c) { nmQuiz.late = c; nmRenderQuiz(nmRoot()); }

// 🍽️ התפריט בשאלון (לפי בקשה מפורשת, 2026-10-14 - בלי AI): כל האפשרויות של כל ארוחה שבתפריט, לפי מה שנבחר בשלב הקודם
// (כמה ארוחות ומתי). בוחרים עד 2 אהובות לכל ארוחה ("זה או זה"), ובאפשרויות עם בחירות (פיתה וממרח, קורנפלקס וחלב, משהו
// קל) - עד 3 דברים שאוהבים. כל בחירה מאוזנת מיד (nmBalance), והסה"כ בקופסה שלמטה
function nmQuizTime(slot) { return nmTimes ? nmTimes.times[slot] : nmSlotReminderTime(slot); }
function nmQuizActive() {
    const active = nmTimes ? nmTimesActive() : (nmProfile && !nmQuiz.fresh ? nmActiveOrder() : NEW_ME_DEFAULT_ORDER.slice());
    return active.slice().sort((a, b) => String(nmQuizTime(a)).localeCompare(String(nmQuizTime(b))) || NEW_ME_DEFAULT_ORDER.indexOf(a) - NEW_ME_DEFAULT_ORDER.indexOf(b));
}
// מה שנבחר לארוחה בשאלון: אות של אפשרות או ארוחה אישית (c_<id>) שכבר נבחרה קודם
function nmQuizItem(q, slot) {
    const choice = q.choices[slot];
    if (nmIsCustomKey(choice) && nmCustomMeal(choice)) return nmItemInfo(choice);
    const P = NEW_ME_PLANS[q.plan][slot];
    const opt = P.options[choice] ? choice : 'A';
    const n = nmOptNutrition(q.plan, slot, opt);
    return { key: opt, kcal: n.kcal, protein: n.protein, small: !!P.options[opt].small };
}
function nmQuizOptionHtml(q, slot, key, info) {
    const picked = q.choices[slot] === key || (q.choices2 && q.choices2[slot] === key);
    const btn = `<button type="button" class="nm-option${picked ? ' selected' : ''}" aria-pressed="${picked}" data-opt="${nmEsc(key)}" onclick="nmQuizPick('${slot}', '${nmEsc(key)}')">
        <span class="nm-option-name">${nmEsc(info.name)}</span>
        ${info.text ? `<span class="nm-option-text">${nmEsc(info.text)}</span>` : ''}
        <span class="nm-option-meta">${nmMeta({ kcal: info.kcal, protein: Math.round(Number(info.protein) || 0) })}</span>
    </button>`;
    const groups = picked && !nmIsCustomKey(key) ? nmOptPicks(q.plan, slot, key) : [];
    return groups.length ? `<div class="nm-option-wrap">${btn}${nmPicksPanelHtml(groups, 'quiz', slot + '_' + key)}</div>` : btn;
}
function nmQuizPicksToggle(id, open) { if (nmQuiz) nmQuiz.picksClosed[id] = !open; }
function nmQuizMenuHtml(q) {
    const active = nmQuizActive();
    const P = NEW_ME_PLANS[q.plan];
    const qSlots = active.map(slot => { const it = nmQuizItem(q, slot); return { slot, kcal: it.kcal, small: !!it.small }; });
    const sideQuiz = active.includes('meal1') && nmQuizItem(q, 'meal1').small;
    const sideShown = active.includes('meal1') && [q.choices.meal1, q.choices2 && q.choices2.meal1].some(k => k && NEW_ME_PLANS[q.plan].meal1.options[k] && NEW_ME_PLANS[q.plan].meal1.options[k].small);
    if (sideQuiz) qSlots.push({ slot: 'side', kcal: nmSideInfo().kcal, small: true, fixed: true });
    const qBal = nmBalance(q.plan, qSlots, q.late);
    const qMenu = { chosen: qSlots.reduce((a, s) => a + s.kcal, 0), adj: qSlots.reduce((a, s) => a + (qBal[s.slot] || 0), 0) };
    // ארוחה אישית שכבר נבחרה (מהארוחות הקבועות, או מתפריט אישי ישן) נשארת ראשונה ברשימה
    const custom = slot => [q.choices[slot], q.choices2 && q.choices2[slot]].filter(k => nmIsCustomKey(k) && nmCustomMeal(k));
    return {
        canContinue: true,
        body: `<h3 class="nm-step-title">🍽️ ${nmEsc(t('nm_q_menu_title'))}</h3>
            <p class="nm-fine">${nmEsc(t('nm_q_menu_hint'))}</p>
            ${active.map(slot => `
                <div class="nm-quiz-slot" data-slot="${slot}">
                    <div class="nm-quiz-slot-head"><div class="nm-slot-name">${nmEsc(nmSlotName(slot))} <bdi dir="ltr" class="nm-slot-time">${nmEsc(nmQuizTime(slot) || '')}</bdi></div>${qBal[slot] ? `<span class="nm-adj-chip ${qBal[slot] > 0 ? 'up' : 'down'}" data-adj="${qBal[slot]}">${nmSignedHtml(qBal[slot])}</span>` : ''}</div>
                    ${custom(slot).map(k => { const it = nmItemInfo(k); return nmQuizOptionHtml(q, slot, k, { name: it.name, text: it.text, kcal: it.kcal, protein: it.protein }); }).join('')}
                    ${nmSlotOpts(q.plan, slot).map(opt => { const n = nmOptNutrition(q.plan, slot, opt); return nmQuizOptionHtml(q, slot, opt, { name: nmOptText(q.plan, slot, opt, true), text: nmOptText(q.plan, slot, opt), kcal: n.kcal, protein: n.protein }); }).join('')}
                    ${slot === 'meal1' && sideShown ? nmQuizSideHtml() : ''}
                </div>`).join('')}
            <div class="nm-quiz-slot">${nmBudgetBoxHtml(q.plan, q.late, qMenu)}</div>
            <div class="nm-quiz-slot nm-quiz-drinks"><div class="nm-slot-name">☕ ${nmEsc(t('nm_budget_drinks'))}</div>${nmPicksPanelHtml(['drink'], 'quiz', 'drink')}</div>
            ${nmOtherFoodNoteHtml()}
            <p class="nm-ai-note">${nmEsc(t('nm_ai_note'))}</p>`,
    };
}
// אחרי השמירה: התזכורת של משהו קטן בערב - בשעה שנבחרה
async function nmQuizAfterSave(q) {
    if (q.late === 'eat' || q.late === 'drink') await nmSyncReminders({ pos: 4, time: q.lateTime || NEW_ME_LATE_TIME, enabled: true });
}
// הבחירות שבתוך אפשרויות - רק הקבוצות שנבחרו בהן (השאר נשארות על ברירת המחדל)
function nmQuizPicksRow(q) {
    const picks = {};
    Object.keys(q.picks || {}).forEach(g => { if (NEW_ME_PICKS[g] && Array.isArray(q.picks[g]) && q.picks[g].length) picks[g] = q.picks[g].slice(0, NEW_ME_PICKS_MAX); });
    return Object.keys(picks).length ? picks : null;
}
// "בניית התפריט" בלי השאלון המלא: שומרים רק את מה שנשאל (ארוחות ושעות, ערב, הבחירות)
async function nmQuizFinishMenuOnly(q) {
    const timesState = nmTimes && nmTimes.mode ? nmTimes : null;
    if (timesState) {
        const prevHidden = nmHiddenSlots();
        for (const slot of timesState.hidden) if (!prevHidden.includes(slot) && nmTodayCheckins[slot]) await nmUncheck(slot);
    }
    const row = { picks: nmQuizPicksRow(q), ...nmQuizSideRow(q), updated_at: new Date().toISOString() };
    NEW_ME_SLOTS.forEach(slot => { row['choice_' + slot] = q.choices[slot]; row['choice2_' + slot] = (q.choices2 && q.choices2[slot]) || null; });
    if (q.late) row.late_choice = q.late;
    if (timesState) Object.assign(row, nmTimesProfileRow());
    const { data, error } = await supabaseClient.from('new_me_profile').update(row).eq('user_id', currentUserId).select().maybeSingle();
    if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
    nmProfile = data || { ...nmProfile, ...row };
    if (timesState) await nmTimesApplyAfterSave(timesState);
    await nmQuizAfterSave(q);
    nmTimes = null;
    nmQuiz = null;
    nmView = 'home';
    await renderNewMe();
    showAppToast(t('item_updated_success'));
}

function nmQuizBack() {
    if (nmQuiz.step === 0) { const back = nmQuiz.menuOnly ? (nmQuiz.returnTo || 'settings') : nmQuiz.fresh ? 'home' : 'settings'; nmQuiz = null; nmTimes = null; nmView = back; renderNewMe(); return; }
    nmQuiz.step--;
    nmRenderQuiz(nmRoot());
}

// עד 2 אהובות לכל ארוחה: הראשונה היא מה שמוצג, השנייה "או". נגיעה בשנייה מורידה אותה; בראשונה - השנייה עולה במקומה
function nmQuizPick(slot, opt) {
    const q = nmQuiz;
    if (!q) return;
    q.choices2 = q.choices2 || {};
    const first = q.choices[slot], second = q.choices2[slot];
    if (opt === first) { if (second) { q.choices[slot] = second; q.choices2[slot] = null; } }
    else if (opt === second) q.choices2[slot] = null;
    else q.choices2[slot] = opt;
    nmRenderQuiz(nmRoot());
}
async function nmQuizNext() {
    const q = nmQuiz;
    const id = nmQuizStepId();
    if (id === 'agree' && !q.agreed) return;
    if (id === 'about') {
        if (String(q.name || '').trim().length < 2) { showAppToast(t('nm_q_full_name_missing'), 'error'); return; }
        // המשקל הנוכחי לא חובה (לפי בקשה מפורשת: "משקל נוכחי גם שלא יהיה חובה") - רק אם נכתב, שיהיה הגיוני
        const w = parseFloat(q.weight);
        if (String(q.weight || '').trim() && !(w >= 20 && w <= 400)) { showAppToast(t('nm_q_weight_missing'), 'error'); return; }
    }
    if (id === 'times' && !(nmTimes && nmTimes.mode)) return;
    if (q.step < nmQuizTotal() - 1) { q.step++; nmRenderQuiz(nmRoot()); nmScrollTop(); return; }
    if (q.menuOnly) { await nmQuizFinishMenuOnly(q); return; }
    const letter = q.withLetter ? String(q.letter || '').trim().slice(0, 4000) : '';
    if (letter && letter.length < NEW_ME_LETTER_MIN) { showAppToast(t('nm_letter_too_short'), 'error'); return; }
    const today = getLocalDateString();
    const goal = parseFloat(q.goal);
    const startW = parseFloat(q.weight);
    const startWeight = startW >= 20 && startW <= 400 ? startW : null;
    const row = {
        user_id: currentUserId,
        plan: q.plan,
        start_weight: startWeight,
        goal_weight: goal > 0 ? goal : null,
        disclaimer_accepted_at: new Date().toISOString(),
        disclaimer_version: NEW_ME_DISCLAIMER_VERSION,
        choice_meal1: q.choices.meal1, choice_snack1: q.choices.snack1,
        choice_meal2: q.choices.meal2, choice_snack2: q.choices.snack2,
        choice2_meal1: (q.choices2 && q.choices2.meal1) || null, choice2_snack1: (q.choices2 && q.choices2.snack1) || null,
        choice2_meal2: (q.choices2 && q.choices2.meal2) || null, choice2_snack2: (q.choices2 && q.choices2.snack2) || null,
        cert_name: String(q.name || '').trim().slice(0, 60),
        updated_at: new Date().toISOString(),
    };
    if (q.late) row.late_choice = q.late;
    // הבחירות שבתוך אפשרויות (ממרחים, דגני בוקר, חלב, דברים קלים)
    row.picks = nmQuizPicksRow(q);
    Object.assign(row, nmQuizSideRow(q));
    // שאלון חוזר בלי משקל - המשקל ההתחלתי שכבר נשמר נשאר
    if (startWeight == null && nmProfile) delete row.start_weight;
    // שעות האוכל מהשלב שלהן: הארוחות שהוסרו, הסדר לפי השעות, ושנשאל
    const timesState = nmTimes && nmTimes.mode ? nmTimes : null;
    if (timesState) Object.assign(row, nmTimesProfileRow());
    // מסע חדש מתחיל ביום הראשון של התוכנית; מילוי השאלון מחדש לא מאפס את "יום X"
    if (!nmProfile) row.started_on = today;
    if (letter) { row.letter_text = letter; row.letter_written_at = new Date().toISOString(); }
    const { data, error } = await supabaseClient.from('new_me_profile').upsert(row, { onConflict: 'user_id' }).select().maybeSingle();
    if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
    nmProfile = data || { ...nmProfile, ...row };
    if (timesState) await nmTimesApplyAfterSave(timesState);
    await nmQuizAfterSave(q);
    nmTimes = null;
    // המשקל ההתחלתי נכנס גם למעקב המשקל הקיים (אותה טבלה בדיוק)
    if (startWeight) await insertWeightRecord(startWeight, today, 'New Me');
    if (typeof loadWeightHistory === 'function') loadWeightHistory();
    await nmSyncCalorieGoal();
    nmQuiz = null;
    nmView = 'home';
    renderNewMe();
    if (letter) showAppToast(t('nm_letter_sealed_toast'));
}

// יעד הקלוריות היומי של האפליקציה = התוכנית, כדי שהצצה להיום/מדדי קלוריות יתאימו
async function nmSyncCalorieGoal() {
    if (!nmProfile) return;
    cachedCalorieGoal = nmProfile.plan;
    localStorage.setItem(calorieDailyGoalKey(), String(nmProfile.plan));
    const input = document.getElementById('calorie-daily-goal-input');
    if (input) input.value = nmProfile.plan;
    updateNutritionGoalProgress();
    await supabaseClient.from('nutrition_goals').upsert({ user_id: currentUserId, username: currentUsername, calorie_goal: nmProfile.plan, protein_goal: getProteinDailyGoal() }, { onConflict: 'user_id' });
}

// ---------- נתוני יום ----------
async function nmLoadToday() {
    const today = getLocalDateString();
    const [{ data }, { data: tracker }, { data: saved }, { data: days }, { data: rems }, { data: custom }, burned] = await Promise.all([
        supabaseClient.from('new_me_checkins').select('*').eq('user_id', currentUserId).eq('checkin_date', today),
        supabaseClient.from('calorie_tracker').select('id, meal_type, food_description, calories, protein_grams, source').eq('user_id', currentUserId).eq('date', today),
        supabaseClient.from('new_me_saved_drinks').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true }),
        supabaseClient.from('new_me_days').select('*').eq('user_id', currentUserId).gte('day', nmWeekStart()).lte('day', nmAddDays(nmWeekEnd(), 7)),
        supabaseClient.from('new_me_reminders').select('*').eq('user_id', currentUserId).order('position', { ascending: true }),
        supabaseClient.from('new_me_custom_meals').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true }),
        typeof loadBurnedKcalForDate === 'function' ? loadBurnedKcalForDate(today) : Promise.resolve(0),
    ]);
    nmTodayCheckins = {};
    (data || []).forEach(r => { nmTodayCheckins[r.slot] = r; });
    nmTrackerToday = tracker || [];
    nmSavedDrinks = saved || [];
    nmWeekDays = days || [];
    nmToday = nmWeekDays.find(d => d.day === today) || null;
    nmReminders = rems || [];
    nmCustomMeals = custom || [];
    nmBurnedToday = Number(burned) || 0;
}

// נתוני המסע: סיכום לכל יום (בדיקות / קלוריות / ארוחה חופשית / צ'ק-אין), הישגים, משקל
async function nmLoadJourney() {
    const [{ data: stats }, { data: badges }, { data: weights }, { data: photo }, { data: meas }] = await Promise.all([
        supabaseClient.rpc('new_me_day_stats', { p_from: nmStartDay(), p_to: getLocalDateString() }),
        supabaseClient.from('new_me_achievements').select('badge, earned_at').eq('user_id', currentUserId),
        supabaseClient.from('weight_tracker').select('weight_date, weight_value').eq('user_id', currentUserId).order('weight_date', { ascending: true }),
        supabaseClient.from('new_me_photos').select('taken_on').eq('user_id', currentUserId).order('taken_on', { ascending: false }).limit(1),
        supabaseClient.from('new_me_measurements').select('id').eq('user_id', currentUserId).limit(1),
    ]);
    nmStats = stats || [];
    nmBadges = {};
    (badges || []).forEach(b => { nmBadges[b.badge] = b.earned_at; });
    nmWeights = weights || [];
    nmLastPhotoDay = photo && photo[0] ? photo[0].taken_on : null;
    nmHasMeasure = !!(meas && meas.length);
    nmJourneyLoaded = true;
}

// שורת new_me_days - upsert חלקי (רק העמודות שנשלחו מתעדכנות) + עדכון המטמון
async function nmUpsertDay(day, fields) {
    const row = { user_id: currentUserId, day, ...fields, updated_at: new Date().toISOString() };
    const { data, error } = await supabaseClient.from('new_me_days').upsert(row, { onConflict: 'user_id,day' }).select().maybeSingle();
    if (error) { showAppToast(t('nm_save_error'), 'error'); return null; }
    const saved = data || row;
    nmWeekDays = nmWeekDays.filter(d => d.day !== day).concat(saved);
    if (day === getLocalDateString()) nmToday = saved;
    return saved;
}

function nmIsDrinkRow(r) { return String(r.meal_type || '').startsWith('nm_drink'); }

// סנכרון מלא: הסכום נלקח מ-calorie_tracker (אותו מקור כמו ההצצה להיום ומעקב הארוחות),
// כך שגם קפה מההוספה המהירה נספר בטבעת. מפוצל לתוכנית / שתייה / תוספות רק לתצוגה
function nmEatenToday() {
    const total = nmTrackerToday.reduce((a, r) => ({ kcal: a.kcal + (Number(r.calories) || 0), protein: a.protein + (Number(r.protein_grams) || 0) }), { kcal: 0, protein: 0 });
    const plan = Object.values(nmTodayCheckins).reduce((a, r) => a + (r.kcal || 0), 0) + nmTrackerToday.filter(r => r.meal_type === NEW_ME_SIDE_MEAL_TYPE).reduce((a, r) => a + (Number(r.calories) || 0), 0);
    const drinks = nmTrackerToday.filter(nmIsDrinkRow).reduce((a, r) => a + (Number(r.calories) || 0), 0);
    return { kcal: total.kcal, protein: total.protein, plan, drinks, extra: Math.max(0, total.kcal - plan - drinks) };
}

// ארוחה שירדה מהתפריט (פחות ארוחות ביום): הקלוריות שלה מתחלקות בין שאר הארוחות, לכל אחת לפי הגודל שלה, מעוגל ל-5 -
// כך שסך היום נשאר כמו בתוכנית (לפי בקשה מפורשת: "לא משנה מה תבחרו הקלוריות ישארו כי נוסיף/נוריד לכל ארוחה מה שצריך")
// ארוחה קטנה בכוונה (ארוחת הבוקר הקטנה, small): כמה היא משאירה מהיעד שלה - זה מתחלק בין שאר הארוחות, כמו ארוחה שירדה
// (לפי בקשה מפורשת: "לא משנה מה תבחרו הקלוריות ישארו")
function nmSmallGap(slot) {
    if (!nmProfile || nmIsFree(slot)) return 0;
    const it = nmItemInfo(nmTodayKey(slot));
    const plan = NEW_ME_PLANS[nmProfile.plan] || NEW_ME_PLANS[1300];
    return it && it.small && plan[slot] ? Math.max(0, plan[slot].target - it.kcal - (slot === 'meal1' && nmSideOn() ? nmSideKcal() : 0)) : 0;
}
// ⚖️ איזון היום (לפי בקשה מפורשת, 2026-10-12: "שהכל יסתכם ב1300 \ 1500 מצידי תוריד דברים מארוחות... כל תיקון חשוב כל
// בחירה"): הארוחות + ~150 לשתייה + ~100 ב-21:00 (רק כשנבחר "משהו קטן") = בדיוק התוכנית. מה שחסר או עודף - ארוחה שירדה,
// ארוחת בוקר קטנה, אפשרות קטנה או גדולה מהיעד, ה-100 של 21:00 - נוסף לארוחות או יורד מהן, לכל אחת לפי הגודל שלה, בקפיצות
// של 5 ובסכום מדויק. חלק של פחות מ-10 לא נרשם לארוחה קטנה (בלי "+5") - הוא עובר לגדולות. לא משתנות: ארוחה קטנה בכוונה,
// ארוחה חופשית (היעד שלה שמור לה, ומה שמעבר - מותר באותו יום) וארוחה שכבר סומנה (נספר מה שנרשם). אף ארוחה לא יורדת
// ביותר מ-40% - מה שלא נכנס נשאר מעל התוכנית, והאזהרה הרגילה מופיעה.
// slots: [{ slot, kcal, small, free, fixed }] - הארוחות שבתפריט (בלי אלה שירדו). מחזיר { slot: ±קלוריות }
function nmBalance(plan, slots, late) {
    const P = NEW_ME_PLANS[plan] || NEW_ME_PLANS[1300];
    const kc = s => Number(s.kcal) || 0;
    const out = {};
    slots.forEach(s => { out[s.slot] = 0; });
    let diff = (Number(plan) || 1300) - NEW_ME_DRINKS_KCAL - nmLateKcal(late || null)
        - slots.reduce((a, s) => a + (s.free ? (P[s.slot] ? P[s.slot].target : 0) : kc(s)), 0);
    let pool = slots.filter(s => !s.free && !s.small && !s.fixed && kc(s) >= 50);
    const shares = () => { const w = pool.reduce((a, s) => a + kc(s), 0); return pool.map(s => diff * kc(s) / w); };
    if (!diff || !pool.length) return out;
    while (pool.length > 1 && shares().some(x => Math.abs(x) < 10)) {
        const min = pool.reduce((m, s) => (kc(s) < kc(m) ? s : m));
        pool = pool.filter(s => s !== min);
    }
    const cap = s => Math.floor(kc(s) * 0.4 / 5) * 5;
    while (diff < 0 && pool.length) {
        const sh = shares();
        const over = pool.filter((s, i) => -sh[i] > cap(s));
        if (!over.length) break;
        over.forEach(s => { out[s.slot] = -cap(s); diff += cap(s); });
        pool = pool.filter(s => !over.includes(s));
    }
    if (!diff || !pool.length) return out;
    const sh = shares();
    const sign = diff < 0 ? -1 : 1;
    const units = sh.map(x => Math.abs(x) / 5);
    const base = units.map(Math.floor);
    let left = Math.round(Math.abs(diff) / 5) - base.reduce((a, b) => a + b, 0);
    units.map((u, i) => i).sort((a, b) => (units[b] - base[b]) - (units[a] - base[a]) || kc(pool[b]) - kc(pool[a])).forEach(i => { if (left > 0) { base[i]++; left--; } });
    pool.forEach((s, i) => { out[s.slot] = sign * base[i] * 5; });
    // מה שלא מתחלק ל-5 (ארוחה אישית עם מספר "עקום") - לגדולה
    const rest = diff - pool.reduce((a, s) => a + out[s.slot], 0);
    if (rest) { const big = pool.reduce((m, s) => (kc(s) > kc(m) ? s : m)); out[big.slot] += rest; }
    return out;
}
// הארוחות של היום לאיזון. overrides: { slot: key } - "מה אם" (למשל לפני החלפה)
function nmBalanceSlots(overrides) {
    const slots = nmActiveOrder().map(slot => {
        const free = nmIsFree(slot);
        const ov = overrides && overrides[slot];
        const it = free ? null : nmItemInfo(ov || nmTodayKey(slot));
        const ck = !ov && nmTodayCheckins[slot];
        return { slot, free, small: !!(it && it.small), fixed: !!ck, kcal: ck ? Number(ck.kcal) || 0 : free ? nmFreeKcal() : (it ? it.kcal : 0) };
    });
    // 🕐 הארוחה הקטנה הנוספת נספרת ביום כמו שהיא (בלי תיקון)
    if (nmSideOn(overrides)) slots.push({ slot: 'side', small: true, fixed: true, kcal: nmSideKcal() });
    return slots;
}
function nmTodayBalance(overrides) { return nmProfile ? nmBalance(nmProfile.plan, nmBalanceSlots(overrides), nmLateChoice()) : {}; }
// התיקון של ארוחה היום (+ נוסף לה / − יורד ממנה). ארוחה שכבר סומנה - מה שנרשם בה לעומת הארוחה עצמה
function nmSlotExtra(slot) {
    if (!nmProfile || nmIsFree(slot) || nmHiddenSlots().includes(slot)) return 0;
    const ck = nmTodayCheckins[slot];
    if (ck) { const it = nmItemInfo(nmTodayKey(slot)); return it && ck.option_id === it.key ? (Number(ck.kcal) || 0) - it.kcal : 0; }
    return nmTodayBalance()[slot] || 0;
}
// השורה הקטנה מתחת לארוחה: כמה נוסף לה ומה אפשר להוסיף, או כמה יורד ממנה וממה
function nmExtraLineHtml(slot) {
    const n = nmSlotExtra(slot);
    if (!n) return '';
    let key, ideas;
    if (n > 0) {
        ideas = t(n < 80 ? 'nm_extra_ideas_s' : n < 160 ? 'nm_extra_ideas_m' : 'nm_extra_ideas_l');
        // מאיפה הקלוריות: מהארוחה שירדה, מארוחת הבוקר הקטנה, או השלמה לתוכנית (אפשרות קטנה מהיעד)
        key = nmHiddenSlots().length ? 'nm_extra_line' : nmActiveOrder().some(s => nmSmallGap(s) > 0) ? 'nm_extra_line_small' : 'nm_extra_line_fill';
    } else {
        ideas = t(n > -80 ? 'nm_less_ideas_s' : n > -160 ? 'nm_less_ideas_m' : 'nm_less_ideas_l');
        key = nmLateKcal() ? 'nm_less_line_late' : 'nm_less_line';
    }
    // תיקון קטן (פחות מ-40) - רק כמה, בלי רעיונות (פרי שלם על 15 קלוריות לא מתאים): החלק שלפני המקף
    let tpl = nmEsc(t(key));
    if (Math.abs(n) < 40 && tpl.includes('–')) tpl = tpl.split('–')[0].trim();
    return `<div class="nm-extra-line${n < 0 ? ' less' : ''}" data-extra="${n}">${tpl.replace('{n}', nmSignedHtml(n)).replace('{plan}', nmFmt(nmProfile.plan)).replace('{time}', nmEsc(nmLateTime())).replace('{ideas}', nmEsc(ideas))}</div>`;
}
// סה"כ התפריט של היום (כולל החלפות, ארוחה חופשית והתיקונים) + תקציב השתייה + 21:00 - מול יעד התוכנית
function nmMenuTotal(overrides) {
    if (!nmProfile) return 0;
    const slots = nmBalanceSlots(overrides);
    const bal = nmBalance(nmProfile.plan, slots, nmLateChoice());
    // ארוחה שכבר סומנה נספרת כמו שנרשמה (גם כשהיא לא בדיוק אותה ארוחה)
    return slots.reduce((a, s) => a + s.kcal + (bal[s.slot] || 0), 0) + NEW_ME_DRINKS_KCAL + nmLateKcal();
}
// כמה קלוריות פנויות בתפריט של היום עד סך התוכנית (אחרי שהוסרה ארוחה או נבחרה ארוחה קטנה יותר)
function nmMenuRoom() { return Math.max(0, nmProfile.plan - nmMenuTotal()); }

// אחרי כל שינוי - מרעננים את מעקב הארוחות/ההצצה להיום (אותו סכום בכל מקום)
function nmAfterTrackerChange() {
    refreshTodayNutritionViewIfOpen();
    if (typeof loadStats === 'function') loadStats();
    // ✓ / החלפה ב-New Me מתעדכנים גם במסך הבית (האריח וציר הזמן של "היום שלי")
    if (nmHomeDataDay === getLocalDateString()) { nmRenderHomeTile(); if (typeof loadTodayTasks === 'function') loadTodayTasks(); }
}

// ---------- מסע: יום X, רצף, אבני דרך ----------
function nmStartDay() { return (nmProfile && (nmProfile.started_on || String(nmProfile.created_at || '').slice(0, 10))) || getLocalDateString(); }
function nmJourneyDay() { return Math.max(1, nmDaysBetween(nmStartDay(), getLocalDateString()) + 1); }
// יום טוב: ✓ על 3 ארוחות לפחות ובלי לעבור את יעד הקלוריות ביותר מ-10%. ביום של ארוחה
// חופשית מתוכננת היום נספר גם אם עבר את היעד (לפי בקשה מפורשת)
// עם פחות ארוחות בתפריט (למשל 2 + נשנוש) - מספיק לסמן את כולן; שריפה באימונים מגדילה את התקרה
function nmIsGoodDay(r) { return r.checks >= nmGoodDayChecks() && (r.free || r.kcal <= (nmProfile.plan + (Number(r.burned) || 0)) * 1.1); }
function nmStreaks() {
    const today = getLocalDateString();
    const rows = nmStats.filter(r => r.day >= nmStartDay() && r.day <= today);
    let best = 0, run = 0;
    rows.forEach(r => { run = nmIsGoodDay(r) ? run + 1 : 0; best = Math.max(best, run); });
    // היום נספר ברצף רק כשהוא כבר "טוב"; עד אז סופרים עד אתמול (היום עוד פתוח)
    let current = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
        if (nmIsGoodDay(rows[i])) current++;
        else if (rows[i].day === today) continue;
        else break;
    }
    return { current, best, good: rows.filter(nmIsGoodDay).length, perfect: rows.filter(r => r.checks >= nmActiveOrder().length).length };
}
function nmMilestoneName(n) { return [7, 30, 60, 90].includes(n) ? t('nm_milestone_' + n) : t('nm_milestone_day').replace('{n}', nmFmt(n)); }
function nmNextMilestone(day) { return NEW_ME_MILESTONE_PATH.find(n => n > day) || (Math.floor(day / 365) + 1) * 365; }
function nmPrevMilestone(day) { const l = NEW_ME_MILESTONE_PATH.filter(n => n <= day); return l.length ? l[l.length - 1] : 0; }
function nmMilestoneWindow(day) {
    let i = NEW_ME_MILESTONE_PATH.findIndex(n => n > day);
    if (i === -1) i = NEW_ME_MILESTONE_PATH.length - 1;
    const s = Math.max(0, Math.min(i - 2, NEW_ME_MILESTONE_PATH.length - 4));
    return NEW_ME_MILESTONE_PATH.slice(s, s + 4);
}
function nmLatestWeight() {
    const w = nmWeights.filter(x => Number(x.weight_value) > 0);
    return w.length ? Number(w[w.length - 1].weight_value) : null;
}
// המשקל בתחילת הדרך: מה שנכתב בשאלון, ואם לא נכתב (לא חובה) - השקילה הראשונה מאז שהתחילו
function nmStartWeight() {
    const s = Number(nmProfile && nmProfile.start_weight);
    if (s > 0) return s;
    const since = nmStartDay();
    const first = (typeof nmWeights !== 'undefined' ? nmWeights : []).find(w => Number(w.weight_value) > 0 && w.weight_date >= since);
    return first ? Number(first.weight_value) : null;
}
function nmKgLost() {
    const s = nmStartWeight(), l = nmLatestWeight();
    return s > 0 && l ? Math.round((s - l) * 10) / 10 : 0;
}

// ---------- הישגים ----------
function nmBadgeTitle(b) {
    if (b.kind === 'streak') return t('nm_badge_streak_title').replace('{n}', b.n);
    if (b.kind === 'day') return nmMilestoneName(b.n);
    if (b.kind === 'kg') return t('nm_badge_kg_title').replace('{n}', b.n);
    return t('nm_badge_' + b.key + '_title');
}
function nmBadgeDesc(b) {
    if (b.kind === 'streak') return t('nm_badge_streak_desc').replace('{n}', b.n);
    if (b.kind === 'day') return t('nm_badge_day_desc').replace('{n}', b.n);
    if (b.kind === 'kg') return t('nm_badge_kg_desc').replace('{n}', b.n);
    return t('nm_badge_' + b.key + '_desc');
}
// מה כבר הושג לפי הנתונים (קניות / החלפה / ארוחה חופשית מוענקים ברגע הפעולה עצמה)
function nmComputeEarned() {
    const out = new Set();
    const s = nmStreaks();
    const day = nmJourneyDay();
    const lost = nmKgLost();
    const latest = nmLatestWeight();
    const start = nmStartWeight() || 0, goal = Number(nmProfile.goal_weight);
    if (nmStats.some(r => r.checks > 0)) out.add('first_meal');
    if (s.perfect > 0) out.add('perfect_day');
    NEW_ME_BADGES.forEach(b => {
        if (b.kind === 'streak' && s.best >= b.n) out.add(b.key);
        if (b.kind === 'day' && day >= b.n) out.add(b.key);
        if (b.kind === 'kg' && lost >= b.n) out.add(b.key);
    });
    if (goal > 0 && start > goal && latest && latest <= goal) out.add('goal_reached');
    if (nmStats.filter(r => r.mood != null).length >= 7) out.add('checkins_7');
    if (nmHasMeasure) out.add('first_measure');
    if (nmLastPhotoDay) out.add('first_photo');
    return out;
}
async function nmAwardBadges(extra = []) {
    if (!nmJourneyLoaded || !nmProfile) return;
    const earned = nmComputeEarned();
    extra.forEach(k => earned.add(k));
    const fresh = NEW_ME_BADGES.map(b => b.key).filter(k => earned.has(k) && !nmBadges[k]);
    if (!fresh.length) return;
    const now = new Date().toISOString();
    fresh.forEach(k => { nmBadges[k] = now; });
    const { error } = await supabaseClient.from('new_me_achievements').upsert(fresh.map(badge => ({ user_id: currentUserId, badge, earned_at: now })), { onConflict: 'user_id,badge', ignoreDuplicates: true });
    if (error) { fresh.forEach(k => { delete nmBadges[k]; }); return; }
    nmCelebrate(fresh);
    if (nmView === 'home' || nmView === 'badges') nmRefreshTileSubs();
}
function nmRefreshTileSubs() {
    const el = document.querySelector('#new-me-root .nm-tile[data-tile="badges"] .nm-tile-sub');
    if (el) el.innerHTML = nmTileSub('badges');
}

// חגיגה: מדליה גדולה + קונפטי. כמה הישגים בבת אחת - הראשון גדול והשאר ברשימה מתחתיו
function nmCelebrate(keys) {
    const list = keys.map(k => NEW_ME_BADGES.find(b => b.key === k)).filter(Boolean);
    if (!list.length) return;
    const first = list[0];
    const ov = nmOpenSheet(`
        <div class="nm-celebrate-eyebrow">${nmEsc(list.length > 1 ? t('nm_badges_new_many').replace('{n}', list.length) : t('nm_badge_new'))}</div>
        <div class="nm-medal big" aria-hidden="true"><span>${first.icon}</span></div>
        <h3 class="nm-celebrate-title">${nmEsc(nmBadgeTitle(first))}</h3>
        <p class="nm-celebrate-desc">${nmEsc(nmBadgeDesc(first))}</p>
        ${list.length > 1 ? `<ul class="nm-celebrate-more">${list.slice(1).map(b => `<li><span aria-hidden="true">${b.icon}</span>${nmEsc(nmBadgeTitle(b))}</li>`).join('')}</ul>` : ''}
        <div class="nm-celebrate-actions">
            <button type="button" class="nm-btn-ghost" data-share>${nmEsc(t('nm_share'))}</button>
            <button type="button" class="nm-btn-primary" data-close>${nmEsc(t('nm_celebrate_ok'))}</button>
        </div>`, 'nm-celebrate');
    const sheet = ov.querySelector('.nm-sheet');
    ov.querySelector('[data-share]').addEventListener('click', () => {
        ov.remove();
        const lines = list.map(b => `${b.icon} ${nmBadgeTitle(b)}`).join('\n');
        if (typeof openSharePicker === 'function') openSharePicker(`🏅 ${t('nm_share_badge_text')}\n\n${lines}`);
    });
    if (typeof spawnGentleConfettiBurst === 'function') {
        setTimeout(() => spawnGentleConfettiBurst(sheet, 40), 150);
        setTimeout(() => spawnGentleConfettiBurst(sheet, 24), 550);
    }
}

// גיליון תחתון כללי - נסגר בלחיצה על הרקע או על כל אלמנט עם data-close (ואז onClose, אם יש)
function nmOpenSheet(html, cls, onClose) {
    const ov = document.createElement('div');
    ov.className = 'nm-sheet-overlay';
    ov.innerHTML = `<div class="nm-sheet${cls ? ' ' + cls : ''}" role="dialog" aria-modal="true"><span class="nm-sheet-grip" aria-hidden="true"></span>${html}</div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) { ov.remove(); if (onClose) onClose(); } });
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
    return ov;
}

// ---------- תצוגות ----------
function nmRenderView(root) {
    nmCaptureDrinkDrafts();
    // מצב מתקדם: מראה זהב בכל New Me (כולל הגיליונות)
    document.documentElement.toggleAttribute('data-nm-god', nmGodMode());
    if (!NEW_ME_VIEW_TITLES[nmView] || nmView === 'pdf') nmView = 'home';
    // במסדרון בלי "חזרה למסך הבית" ובלי איור המטבח בתחתית - המסדרון הוא כל המסך
    const section = document.getElementById('new-me-section');
    if (section) section.classList.toggle('nm-hall-mode', nmView === 'home');
    // כפתור ה-PM של חשבון הפיתוח: במסדרון בתוך הציור, בשאר המסכים בצד
    const devKeys = () => { if (typeof roomRenderDevKeys === 'function') roomRenderDevKeys(); };
    if (nmView === 'home') { nmRenderHome(root); devKeys(); return; }
    root.innerHTML = `
        <div class="nm-subhead">
            <button type="button" class="nm-back" onclick="nmGo('home')" aria-label="${nmEsc(t('nm_back'))}">‹</button>
            <h3>${NEW_ME_TILE_ICONS[nmView] || ''} ${nmEsc(t(NEW_ME_VIEW_TITLES[nmView]))}</h3>
        </div>
        <div id="nm-view-body" class="nm-view-body"></div>`;
    const body = document.getElementById('nm-view-body');
    const renderers = { day: nmRenderDay, challenges: nmRenderChallenges, gift: nmRenderGift, stats: nmRenderStats, journey: nmRenderJourney, shop: nmRenderShop, badges: nmRenderBadges, measure: nmRenderMeasure, photos: nmRenderPhotos, month: nmRenderMonth, table: nmRenderTable, reminders: nmRenderReminders, settings: nmRenderSettings };
    renderers[nmView](body);
    if (nmView === 'day') nmRestoreDrinkDrafts();
    devKeys();
}

function nmGo(view) {
    nmView = view;
    nmLateEditing = false;
    nmRenderView(nmRoot());
    nmScrollTop();
}

function nmRingHtml(eaten, goal) {
    const r = 52, c = 2 * Math.PI * r;
    const pct = goal > 0 ? Math.min(1, eaten / goal) : 0;
    const left = goal - eaten;
    const leftLabel = left >= 0 ? t('nm_left') : t('nm_over');
    return `
        <div class="nm-ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
                <defs><linearGradient id="nm-ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent-purple)"/><stop offset="1" stop-color="var(--accent-pink)"/></linearGradient></defs>
                <circle cx="60" cy="60" r="${r}" class="nm-ring-track"/>
                <circle cx="60" cy="60" r="${r}" class="nm-ring-fill" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/>
            </svg>
            <div class="nm-ring-center">
                <span class="nm-ring-num">${nmFmt(Math.abs(left))}</span>
                <span class="nm-ring-label">${nmEsc(leftLabel)}</span>
            </div>
        </div>`;
}

// ---------- המסדרון: המסך הראשי של New Me (לפי בחירה מפורשת, 2026-10-08: "כן הראשון – א") ----------
// מסדרון רחב (לא צר ומלחיץ) עם דלתות לאורך הקירות: כל דלת היא חדר (בלי מספרים על הדלתות - לפי בקשה מפורשת), ובסוף
// דלת 5 - החוצה (חלון עגול שרואים בו ירוק). 4 מנורות על הקירות = 4 הארוחות של היום (זהב = אכלתי, ורודה =
// הבאה, כבויה = אחר כך). בתקרה פתח לעליית הגג: כשהגג נפתח, נגיעה מורידה סולם לאט ונגיעה נוספת עולה לגג.
// למטה מציץ התרמיל: הפתק של "הבא" תחוב בו (עם ✓), צרור המפתחות תלוי עליו (נגיעה = הסבר קטן), ונגיעה
// בתרמיל עצמו פותחת את כל New Me. בלי שלטים ובלי כיתובים - רק הציור.
// הציור במידות 390×844; מה שמעליו ממוקם באחוזים מאותן מידות, כך שהכול גדל וקטן יחד
const NMH_W = 390, NMH_H = 844;
function nmhX(v) { return `${(v / NMH_W * 100).toFixed(3)}%`; }
function nmhY(v) { return `${(v / NMH_H * 100).toFixed(3)}%`; }
function nmhKeySvg(fill) { return `<svg viewBox="0 0 24 24" fill="${fill}" aria-hidden="true"><circle cx="8" cy="12" r="4.5"/><rect x="11" y="10.8" width="10" height="2.4" rx="1.2"/><rect x="17" y="12" width="2.2" height="4" rx="1"/><circle cx="8" cy="12" r="1.6" fill="#0b0714"/></svg>`; }
// 🎨 2026-10-14 (לפי בקשה מפורשת: "יש את הציורים אתה יכול לשים אותם"): המסדרון הוא שער היער - world/forest-gate.jpg.
// כל מקום הוא כניסה בציור: דלת עגולה בעץ הענק = החדר הסודי (הבית בעץ), מנהרת הגזע = המרפסת, בית הפטרייה = פינת המוזיקה,
// קשת הערבה הקטנה = חוף הנשימה, קשת הערבה הגדולה = השביל ביער, וקשת הפרחים עם הסולם = הגג. הפנסים התלויים = הארוחות.
// ציור לא מתהפך, ולכן גם ב-LTR הכול באותו מקום (nmhMx נשאר בשביל הקוד שקורא לו)
function nmhMx(x) { return x; }
function nmhPts(arr) { return arr.map(([x, y]) => `${nmhMx(x)},${y}`).join(' '); }
// המנורות לפי סדר הארוחות - ארבעה פנסים שתלויים על הענפים בציור
const NMH_LAMPS = [{ x: 50, y: 306, s: 0.8 }, { x: 84, y: 300, s: 0.8 }, { x: 260, y: 321, s: 0.8 }, { x: 294, y: 337, s: 0.8 }];
// הכניסות: hit = אזור הלחיצה (x, y, w, h), glow = האור כשהכניסה פתוחה (x, y, r), lock = המנעול כשהיא נעולה (x, y, גודל)
const NMH_DOORS = [
    { n: 1, hit: [164, 408, 64, 70], glow: [195, 448, 36], lock: [195, 452, 1.4] },
    { n: 2, hit: [240, 424, 120, 94], glow: [282, 470, 46], lock: [282, 472, 1.3] },
    { n: 3, hit: [0, 396, 66, 116], glow: [28, 470, 30], lock: [28, 468, 1.2] },
    { n: 4, hit: [82, 412, 72, 96], glow: [118, 462, 34], lock: [118, 462, 1.2] },
    { n: 5, hit: [14, 504, 118, 150], glow: [73, 588, 54], lock: [73, 584, 1.5] },
];
const NMH_ROOF = { hit: [274, 504, 116, 150], glow: [332, 588, 54], lock: [332, 584, 1.5] };
// דלת 1 נכנסת לחדר הסודי; 2–5 - המקומות שבחרה (secret-places.js), כל אחד נפתח במפתח משלו
function nmhDoorPlace(n) { return typeof SRP_DOOR_PLACE !== 'undefined' ? SRP_DOOR_PLACE[n] || null : null; }
function nmhDoorOpen(n, keys) {
    if (n === 1) return keys >= 1;
    const id = nmhDoorPlace(n);
    return !!id && typeof roomUnlockAt === 'function' && keys >= roomUnlockAt(id);
}
function nmhLockSvg(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#e8c98a" stroke-width="1.3"><circle r="9" fill="#2a1a3a" fill-opacity="0.72" stroke="#e8c98a" stroke-opacity="0.55"/><rect x="-4" y="-1" width="8" height="7" rx="1.5" fill="#5a4026"/><path d="M-2.4 -1 v-2 a2.4 2.4 0 0 1 4.8 0 v2"/></g>`;
}
// כניסה פתוחה - אור חם בפתח; נעולה - צעיף כהה ורך ומנעול
function nmhDoorSvg(d, open, cls) {
    const [gx, gy, gr] = d.glow;
    if (open) return `<g class="nmh-door-art${cls ? ` ${cls}` : ''}"><circle class="nmh-glow" cx="${gx}" cy="${gy}" r="${gr}" fill="url(#nmh-lamp)" opacity="0.5"/></g>`;
    const [lx, ly, ls] = d.lock;
    return `<g class="nmh-door-art is-locked${cls ? ` ${cls}` : ''}"><ellipse cx="${gx}" cy="${gy}" rx="${gr}" ry="${gr * 0.95}" fill="#0c0618" opacity="0.5" filter="url(#nmh-soft)"/>${nmhLockSvg(lx, ly, ls)}</g>`;
}
// מנורה אחת במסדרון: 'lit' (נאכל) - הילה זהובה על הפנס, 'next' (הבאה) - ורודה, 'off' (אחר כך) - רק הפנס המצויר
function nmhLampSvg(i, state, cls) {
    const L = NMH_LAMPS[i];
    if (state === 'off') return '';
    const x = nmhMx(L.x), y = L.y, s = L.s;
    return `<circle class="nmh-glow${cls ? ` ${cls}` : ''}" cx="${x}" cy="${y}" r="${(30 * s).toFixed(1)}" fill="url(#nmh-${state === 'lit' ? 'lamp' : 'pink'})"/><circle cx="${x}" cy="${y}" r="${(5 * s).toFixed(1)}" fill="${state === 'lit' ? '#fff1c9' : '#ffd1ea'}" opacity="0.9"/>`;
}
// הציור של המסדרון בלי הכפתורים - משותף למסדרון עצמו ולסרטון בעמוד הקנייה, כך שהסרטון תמיד נראה בדיוק
// כמו New Me. lampsSvg - המנורות; doorOpen(n) - האם דלת n פתוחה; doorCls(n) - קלאס לדלת (הסרטון); roofOpen - הגג
function nmhSceneSvg({ lampsSvg, doorOpen, doorCls, roofOpen, bag = true }) {
    const doorsSvg = NMH_DOORS.map(d => nmhDoorSvg(d, doorOpen(d.n), doorCls ? doorCls(d.n) : '')).join('');
    return `
            <svg class="nmh-scene" viewBox="0 0 ${NMH_W} ${NMH_H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <defs>
                    <radialGradient id="nmh-lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.85"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
                    <radialGradient id="nmh-pink" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ff7ac0" stop-opacity="0.9"/><stop offset="1" stop-color="#ff4fa3" stop-opacity="0"/></radialGradient>
                    <linearGradient id="nmh-bag" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b98149"/><stop offset="1" stop-color="#8a5a30"/></linearGradient>
                    <filter id="nmh-soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8"/></filter>
                </defs>
                <image href="world/forest-gate.jpg" x="-40.55" y="0" width="471.1" height="844" preserveAspectRatio="none"/>
                ${doorsSvg}
                ${roofOpen ? nmhDoorSvg(NMH_ROOF, true, 'nmh-roof-art') : nmhDoorSvg(NMH_ROOF, false, 'nmh-roof-art')}
                ${lampsSvg}
                ${bag ? `<ellipse cx="300" cy="846" rx="80" ry="14" fill="#000" opacity="0.45"/>
                <path d="M236 764 Q236 714 300 710 Q364 714 364 764 L364 880 L236 880 Z" fill="url(#nmh-bag)"/>` : ''}
            </svg>`;
}
// חזית התרמיל (מעל הפתק) וצרור המפתחות עליו: עד 3 מפתחות (ומספר כשיש יותר - ר' nmh-keys)
function nmhBagFrontSvg(keys) {
    const ring = [0, 1, 2].filter(i => i < keys).map(i => {
        const [x, y, a] = [[236, 800, 18], [242, 802, -6], [248, 799, -28]][i];
        return `<g transform="rotate(${a} ${x} ${y})"><circle cx="${x}" cy="${y}" r="3"/><rect x="${x - 1}" y="${y + 2}" width="2" height="11" rx="1"/><rect x="${x + 1}" y="${y + 9}" width="3" height="1.6"/></g>`;
    }).join('');
    return `
            <svg class="nmh-scene nmh-bag-front" viewBox="0 0 ${NMH_W} ${NMH_H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <path d="M238 756 Q240 708 300 706 Q360 708 362 756 Q362 776 352 780 Q300 794 248 780 Q238 776 238 756 Z" fill="#7a4a26"/>
                <path d="M247 756 Q249 716 300 714 Q351 716 353 756" fill="none" stroke="#e8c48a" stroke-opacity="0.55" stroke-width="1.2" stroke-dasharray="3 3"/>
                <path d="M284 710 Q300 686 316 710" fill="none" stroke="#5a3418" stroke-width="6" stroke-linecap="round"/>
                <rect x="266" y="766" width="11" height="44" rx="3" fill="#5a3418"/><rect x="323" y="766" width="11" height="44" rx="3" fill="#5a3418"/>
                <rect x="264" y="795" width="15" height="11" rx="2" fill="none" stroke="#ffd27a" stroke-width="2.2"/><rect x="321" y="795" width="15" height="11" rx="2" fill="none" stroke="#ffd27a" stroke-width="2.2"/>
                <rect x="256" y="812" width="88" height="70" rx="16" fill="#9a6638"/>
                <path d="M256 830 Q300 842 344 830" fill="none" stroke="#7a4a26" stroke-width="2"/>
                <path d="M291 846 h18 l6 7 -15 16 -15 -16 z" fill="#c084fc"/>
                <circle cx="241" cy="790" r="6" fill="none" stroke="#ffd27a" stroke-width="1.8"/>
                <g fill="#ffd27a">${ring}</g>
            </svg>`;
}

function nmRenderHome(root) {
    const active = nmActiveOrder().slice(0, NMH_LAMPS.length);
    const nextSlot = nmNextSlot(active);
    const keys = typeof roomKeys === 'function' ? roomKeys() : 0;
    const roofAt = typeof roomUnlockAt === 'function' ? roomUnlockAt('roof') : 5;
    const roofOpen = keys >= roofAt;
    // בלי מנורות (לפי בקשה מפורשת, 2026-10-14: "לא צריך את המנורות שיראה מה אכלתי אפשר לשים את זה בתוך התיק"): מה
    // שנאכל - בתיק הקסום (הציור שלה, world/bag.png), והציור של השער נשאר בדיוק כמו שהיא שלחה
    // הכניסות שבציור (1 = העץ, 2–5 = המקומות) - הציור ב-nmhSceneSvg, כאן אזורי הלחיצה
    const doorBtns = NMH_DOORS.map(d => {
        const [x, y, w, h] = d.hit;
        const lx = nmhMx(x);
        return `<button type="button" class="nmh-door" data-door="${d.n}" style="left:${nmhX(lx)};top:${nmhY(y)};width:${nmhX(w)};height:${nmhY(h)}" onclick="nmhDoorTap(${d.n})" aria-label="${nmEsc(t('nm_door_label').replace('{n}', nmFmt(d.n)))}"></button>`;
    }).join('');
    // הפתק של "הבא" (או "כל המנורות דולקות") - תחוב בתרמיל
    const nextName = !nextSlot ? '' : nmIsFree(nextSlot) ? `🍕 ${t('nm_free_meal')}` : nmItemShort(nmItemInfo(nmTodayKey(nextSlot)));
    const note = nextSlot ? `
        <div class="nmh-note" style="left:${nmhX(234)};top:${nmhY(652)};width:${nmhX(132)};height:${nmhY(100)}">
            <button type="button" class="nmh-note-body" onclick="nmOpenHallMeal('${nextSlot}')">
                <span class="nmh-note-eyebrow">${nmEsc(t('nm_hall_next').replace('{slot}', nmSlotName(nextSlot)))}</span>
                <span class="nmh-note-name">${nmEsc(nextName)}</span>
            </button>
            <button type="button" class="nmh-note-check" onclick="nmToggleCheck('${nextSlot}', this)" aria-label="${nmEsc(`${t('nm_mark_eaten')} – ${nextName}`)}">${NM_CHECK_SVG}</button>
        </div>`
        : `<div class="nmh-note is-done" style="left:${nmhX(234)};top:${nmhY(652)};width:${nmhX(132)};height:${nmhY(100)}"><button type="button" class="nmh-note-body" onclick="nmOpenBackpack()"><span class="nmh-note-name">${nmEsc(t('nm_hall_all_done'))}</span></button></div>`;
    root.innerHTML = `
        <div class="nmh${roofOpen ? ' is-roof' : ''}" role="group" aria-label="New Me">
            ${nmhSceneSvg({ lampsSvg: '', doorOpen: n => nmhDoorOpen(n, keys), roofOpen, bag: false })}
            <div class="nmh-hud"><span class="nmh-title">${NM_ICON_SVG}<span>New Me</span></span></div>
            ${doorBtns}
            <button type="button" class="nmh-hatch-btn" style="left:${nmhX(NMH_ROOF.hit[0])};top:${nmhY(NMH_ROOF.hit[1])};width:${nmhX(NMH_ROOF.hit[2])};height:${nmhY(NMH_ROOF.hit[3])}" onclick="nmhHatchTap()" aria-label="${nmEsc(t('nm_hatch_label'))}"></button>
            ${note}
            <button type="button" class="nmh-bag nmh-bag-art" style="left:${nmhX(222)};top:${nmhY(690)};width:${nmhX(160)};height:${nmhY(154)}" onclick="nmOpenBackpack()" aria-label="${nmEsc(t('nm_backpack'))}"><img src="world/bag.png" alt=""></button>
            <button type="button" class="nmh-keys nmh-keys-chip" data-keys="${keys}" style="left:${nmhX(194)};top:${nmhY(802)};width:${nmhX(48)};height:${nmhY(30)}" onclick="nmhKeysTip()" aria-label="${nmEsc(`🔑 ${nmFmt(keys)}`)}">${nmhKeySvg('currentColor')}<bdi dir="ltr">${nmFmt(keys)}</bdi></button>
            <div class="nmh-tip" role="status" aria-live="polite"></div>
        </div>`;
    // משהו נפתח ועוד לא הגיעו אליו - החץ מראה לאן ללכת (ר' roomGuideHallway)
    if (typeof roomGuideHallway === 'function') setTimeout(roomGuideHallway, 0);
}

// נגיעה בשם הזוהר או במנורה: הארוחה עצמה - מה אוכלים, ✓ אכלתי (או ביטול), 🔄 החלפה, והתפריט המלא
function nmOpenHallMeal(slot) {
    const done = !!nmTodayCheckins[slot];
    const free = nmIsFree(slot);
    const it = free ? null : nmItemInfo(nmTodayKey(slot));
    const remTime = nmProfile.reminders_on && nmSlotReminderEnabled(slot) ? nmSlotReminderTime(slot) : null;
    const ov = nmOpenSheet(`
        <span class="nmh-meal-eyebrow">${nmEsc(nmSlotName(slot))}${remTime ? ` · <bdi dir="ltr">${nmEsc(remTime)}</bdi>` : ''}</span>
        <h4 class="nmh-meal-name">${free ? `🍕 ${nmEsc(t('nm_free_meal'))}` : nmEsc(nmItemShort(it))}</h4>
        ${free ? '' : `<p class="nmh-meal-text">${nmEsc(nmItemFull(it))}</p>`}
        <span class="nmh-meal-meta">${free ? `<bdi dir="ltr">~${nmFmt(nmFreeKcal())}</bdi> ${nmEsc(t('calories_unit'))}` : nmMeta(it)}</span>
        ${free ? '' : nmAltRowHtml(slot)}
        ${free ? '' : nmExtraLineHtml(slot)}
        ${free ? '' : nmLaterRowHtml(slot)}
        <button type="button" class="nm-btn-primary nmh-meal-ate${done ? ' is-done' : ''}" data-ate aria-pressed="${done}">${done ? `✓ ${nmEsc(t('nm_hall_eaten'))}` : nmEsc(t('nm_hall_ate'))}</button>
        <div class="nmh-meal-row">
            ${free ? '' : `<button type="button" class="nm-chip" data-swap>🔄 ${nmEsc(t('nm_swap'))}</button><button type="button" class="nm-chip" data-edit>✏️ ${nmEsc(t('nm_edit_meal'))}</button>`}
            <button type="button" class="nm-chip" data-day>📋 ${nmEsc(t('nm_hall_day'))}</button>
        </div>`, 'nmh-meal-sheet');
    ov.querySelector('[data-ate]').addEventListener('click', async e => { ov.remove(); await nmToggleCheck(slot, e.currentTarget); });
    const swap = ov.querySelector('[data-swap]');
    if (swap) swap.addEventListener('click', () => { ov.remove(); nmOpenSwap(slot); });
    const edit = ov.querySelector('[data-edit]');
    if (edit) edit.addEventListener('click', () => { ov.remove(); nmOpenSwap(slot, 'ai', { edit: true }); });
    // "או" / "אחר כך" פועלים מה-onclick שלהם; כאן רק סוגרים את החלון
    ov.querySelectorAll('[data-or], [data-later]').forEach(b => b.addEventListener('click', () => ov.remove()));
    ov.querySelector('[data-day]').addEventListener('click', () => { ov.remove(); nmGo('day'); });
}

// הדלת בסוף המסדרון: יש מפתח - נכנסים לחדר; עוד אין - איך מקבלים את המפתח הראשון
function nmOpenHallDoor() {
    if (typeof roomKeys !== 'function') return;
    if (roomKeys() >= 1) openSecretRoom({ wall: 0 });
    else roomOpenHowItWorks();
}
// "כל היום": התפריט המלא, שתייה, תוספות, צ'ק-אין וכל מה שהיה במסך הקודם; מהקנקן - ישר לשתייה
function nmOpenHallDay(focus) {
    nmGo('day');
    if (focus === 'drinks') {
        const el = document.querySelector('#new-me-root .nm-drinks');
        const sc = nmScroller();
        if (el && sc) sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - 80;
    }
}
// הסבר קטן בתוך המסדרון, שנעלם לבד: המפתחות / דלת שעוד נבנית / הגג
function nmhTip(text) {
    const tip = document.querySelector('#new-me-root .nmh-tip');
    if (!tip) return;
    tip.textContent = text;
    tip.classList.add('on');
    clearTimeout(nmhTip.timer);
    nmhTip.timer = setTimeout(() => tip.classList.remove('on'), 4500);
}
// צרור המפתחות (לפי בחירה מפורשת, נוסח א): כמה מפתחות יש, ושכל אתגר שמסתיים פותח דלת
function nmhKeysTip() {
    const keys = typeof roomKeys === 'function' ? roomKeys() : 0;
    nmhTip(`🔑 ${nmFmt(keys)} · ${t('nm_keys_tip')}`);
}
// דלת 1 = החדר הסודי (או איך מקבלים את המפתח הראשון); 2–5 - המקומות: פתוחה - נכנסים, נעולה - כמה מפתחות נשארו
function nmhDoorTap(n) {
    if (n === 1) { nmOpenHallDoor(); return; }
    const id = nmhDoorPlace(n);
    if (!id || typeof roomKeys !== 'function') return;
    const keys = roomKeys(), at = roomUnlockAt(id);
    if (keys < at) { nmhTip(`🔒 ${roomItemName(id)} · ${roomKeysLeftText(at - keys)}`); return; }
    roomOpenPlace(id, { fromHall: true });
}
// הדרך לגג (מאז 2026-10-14: קשת הפרחים עם הסולם שבציור של שער היער): נעולה עד שהגג נפתח, ואחר כך נגיעה מעלה ישר
// לצמרת העץ. nmhLadderTap נשאר בשביל מי שקורא לו (הסיור, הבדיקות) - אותו דבר
function nmhHatchTap() {
    const hall = document.querySelector('#new-me-root .nmh');
    if (!hall || typeof roomKeys !== 'function') return;
    const keys = roomKeys();
    const at = roomUnlockAt('roof');
    if (keys < at) { nmhTip(`🔒 ${roomItemName('roof')} · ${roomKeysLeftText(at - keys)}`); return; }
    openSecretRoom({ wall: 3 });
    setTimeout(() => { if (typeof roomOpenRoof === 'function' && srIsOpen()) roomOpenRoof({ fromHall: true }); }, 80);
}
function nmhLadderTap() { nmhHatchTap(); }

// התרמיל: כל New Me בפנים - הארוחה הבאה (✓ / 🔄), שאר הארוחות של היום, וה"כיסים" (כל האריחים וההגדרות)
function nmOpenBackpack() {
    const plan = nmProfile.plan;
    const eaten = nmEatenToday();
    const left = Math.round(plan + nmBurnedToday - eaten.kcal);
    const st = nmStreaks();
    const keys = typeof roomKeys === 'function' ? roomKeys() : 0;
    const active = nmActiveOrder();
    const nextSlot = nmNextSlot(active);
    const info = slot => (nmIsFree(slot) ? null : nmItemInfo(nmTodayKey(slot)));
    const name = slot => { const it = info(slot); return it ? nmItemShort(it) : `🍕 ${t('nm_free_meal')}`; };
    const next = nextSlot ? `
        <div class="nmb-next">
            <span class="nmb-eyebrow">${nmEsc(t('nm_hall_next').replace('{slot}', nmSlotName(nextSlot)))}</span>
            <span class="nmb-next-name">${nmEsc(name(nextSlot))}</span>
            <span class="nmb-meta">${info(nextSlot) ? nmMeta(info(nextSlot)) : `<bdi dir="ltr">~${nmFmt(nmFreeKcal())}</bdi> ${nmEsc(t('calories_unit'))}`}</span>
            <div class="nmb-next-actions">
                <button type="button" class="nm-btn-primary" data-ate>${nmEsc(t('nm_hall_ate'))}</button>
                ${info(nextSlot) ? `<button type="button" class="nmb-swap" data-swap aria-label="${nmEsc(t('nm_swap'))}" title="${nmEsc(t('nm_swap'))}">🔄</button>` : ''}
            </div>
        </div>` : `<div class="nmb-next is-done">${nmEsc(t('nm_hall_all_lit'))}</div>`;
    const rows = active.filter(s => s !== nextSlot).map(slot => {
        const done = !!nmTodayCheckins[slot];
        return `<button type="button" class="nmb-meal${done ? ' is-done' : ''}" data-slot="${slot}"><span class="nmb-check" aria-hidden="true">${done ? '✓' : ''}</span><span class="nmb-pos">${nmEsc(nmSlotName(slot))}</span><span class="nmb-name">${nmEsc(name(slot))}</span></button>`;
    }).join('');
    const ov = nmOpenSheet(`
        <div class="nmb-band">
            <span class="nmb-title">${NM_ICON_SVG}<span>New Me</span></span>
            <span class="nmb-chip${left < 0 ? ' is-over' : ''}" title="${nmEsc(t(left < 0 ? 'nm_over' : 'nm_left'))}">⚡ <bdi dir="ltr">${left < 0 ? '+' : ''}${nmFmt(Math.abs(left))}</bdi></span>
            ${st.current > 0 ? `<span class="nmb-chip is-streak">🔥 <bdi dir="ltr">${nmFmt(st.current)}</bdi></span>` : ''}
            <span class="nmb-chip is-keys">${nmhKeySvg('#ffd27a')}<bdi dir="ltr">${nmFmt(keys)}</bdi></span>
        </div>
        ${next}
        ${rows ? `<div class="nmb-meals">${rows}</div>` : ''}
        <div class="nmb-pockets">${['day', ...nmTiles(), 'settings'].map(nmTileHtml).join('')}</div>`, 'nm-backpack-sheet');
    const ate = ov.querySelector('[data-ate]');
    if (ate) ate.addEventListener('click', async e => { ov.remove(); await nmToggleCheck(nextSlot, e.currentTarget); });
    const swap = ov.querySelector('[data-swap]');
    if (swap) swap.addEventListener('click', () => { ov.remove(); nmOpenSwap(nextSlot); });
    ov.querySelectorAll('.nmb-meal').forEach(b => b.addEventListener('click', () => { ov.remove(); nmOpenHallMeal(b.dataset.slot); }));
    ov.querySelectorAll('.nm-tile').forEach(b => b.addEventListener('click', () => ov.remove()));
}
// ⋯ של המסדרון הקודם = התרמיל
function nmOpenHallMore() { nmOpenBackpack(); }

// "כל היום" - מה שהיה המסך הראשי עד המסדרון (בלי שינוי): טבעת, אתגרים, התפריט, שתייה, תוספות ואריחים
function nmRenderDay(root) {
    const plan = nmProfile.plan;
    const eaten = nmEatenToday();
    const active = nmActiveOrder();
    const done = active.filter(s => nmTodayCheckins[s]).length;
    const day = nmJourneyDay();
    const st = nmStreaks();
    const next = nmNextMilestone(day), prev = nmPrevMilestone(day);
    const pct = Math.max(4, Math.round(((day - prev) / (next - prev)) * 100));
    const menuTotal = nmMenuTotal();
    const over = menuTotal - plan;
    const hasFreeToday = active.some(nmIsFree);
    const warn = !hasFreeToday && over > plan * 0.08;
    root.innerHTML = `
        <div class="nm-dash">
            <div class="nm-hero-card">
                <div class="nm-dash-top">
                    ${nmRingHtml(eaten.kcal, plan + nmBurnedToday)}
                    <div class="nm-dash-stats">
                        <div class="nm-eyebrow">${NM_ICON_SVG} New Me · ${nmFmt(plan)} ${nmEsc(t('calories_unit'))}</div>
                        <button type="button" class="nm-day-chip" onclick="nmGo('journey')">${nmDayHtml(day)}${st.current > 0 ? `<span class="nm-day-streak">🔥 ${nmFmt(st.current)}</span>` : ''}</button>
                        <div class="nm-stat"><span class="nm-num">${nmFmt(eaten.kcal)}</span> ${nmEsc(t('nm_eaten'))} · <span class="nm-num">${nmFmt(Math.round(eaten.protein))}</span> ${nmEsc(t('nm_protein_unit'))}</div>
                        <div class="nm-split">${nmEsc(t('nm_split_line').replace('{plan}', nmFmt(eaten.plan)).replace('{drinks}', nmFmt(eaten.drinks)).replace('{extra}', nmFmt(eaten.extra)))}</div>
                        ${nmBurnedToday > 0 ? `<div class="nm-burn-line">🏃 ${nmTpl('nm_burned_line', { n: nmFmt(nmBurnedToday) })}</div>` : ''}
                        <div class="nm-dots" aria-label="${done}/${active.length}">${active.map(s => `<span class="${nmTodayCheckins[s] ? 'on' : ''}"></span>`).join('')}</div>
                    </div>
                </div>
                <button type="button" class="nm-journey-strip" onclick="nmGo('journey')">
                    <span class="nm-journey-strip-text">${NEW_ME_MILESTONE_ICONS[next] || '🏆'} ${nmEsc(t(next - day === 1 ? 'nm_next_milestone_one' : 'nm_next_milestone').replace('{n}', nmFmt(next - day)).replace('{name}', nmMilestoneName(next)))}</span>
                    <span class="nm-progress" aria-hidden="true"><span style="width:${pct}%"></span></span>
                </button>
            </div>
            <section class="nm-today" id="nm-today">
                ${nmChallengeStripHtml()}
                <div class="nm-section-head">
                    <h3>${nmEsc(t('nm_tile_menu'))}</h3>
                    <span class="nm-total-chip${warn ? ' warn' : ''}" title="${nmEsc(t('nm_menu_total_title'))}"><bdi dir="ltr">~${nmFmt(menuTotal)} / ${nmFmt(plan)}</bdi></span>
                </div>
                ${warn ? `<p class="nm-soft-warn">${nmEsc(t('nm_menu_over_warn').replace('{n}', nmFmt(over)))}</p>` : ''}
                <div class="nm-menu-list" id="nm-menu-list">${active.map(s => nmMealCardHtml(s) + (s === 'meal1' && nmSideOn() ? nmSideCardHtml() : '')).join('')}</div>
                ${nmDaySummaryHtml()}
                ${nmOtherFoodNoteHtml()}
                ${nmMenuRoomHtml()}
                ${nmLateRowHtml()}
                ${nmFreeMealRowHtml()}
                ${nmDrinksHtml()}
                ${nmExtrasHtml()}
                ${nmGoalReminderHtml()}
            </section>
            ${nmCheckinHtml()}
            ${nmPhotoNudgeHtml()}
            <div class="nm-tiles">${nmTiles().map(nmTileHtml).join('')}</div>
            <button type="button" class="nm-bonus" onclick="nmOpenStories()">
                <span class="nm-bonus-icon">${NEW_ME_TILE_ICONS.bonus}</span>
                <span class="nm-bonus-text">
                    <span class="nm-bonus-badge">🎁 ${nmEsc(t('nm_bonus_label'))}</span>
                    <span class="nm-bonus-title">${nmEsc(t('nutrition_daily_tile_title'))}</span>
                    <span class="nm-bonus-sub">${nmEsc(t('nm_story_teaser'))}</span>
                </span>
            </button>
            <p class="nm-ai-note">${nmEsc(t('nm_ai_note'))}</p>
            <button type="button" class="nm-gear" onclick="nmGo('settings')" title="${nmEsc(t('nm_tile_settings'))}" aria-label="${nmEsc(t('nm_tile_settings'))}">⚙️</button>
        </div>`;
    nmInitDrag(document.getElementById('nm-menu-list'));
}

function nmTileSub(k) {
    // ה-PDF בנוי ל-4 ארוחות ביום (לפי בקשה מפורשת: "תרשום הPDF הזה מתאים לככה ארוחות")
    if (k === 'pdf') return nmEsc(t('nm_pdf_meals'));
    if (k === 'challenges') return `<bdi dir="ltr">${nmChDoneCount()}/${NEW_ME_CHALLENGES.length}</bdi>`;
    if (k === 'gift') return nmGodMode() ? '👑' : '';
    if (k === 'journey') return nmEsc(t('nm_day_n').replace('{n}', nmFmt(nmJourneyDay())));
    if (k === 'badges') return `<bdi dir="ltr">${NEW_ME_BADGES.filter(b => nmBadges[b.key]).length}/${NEW_ME_BADGES.length}</bdi>`;
    if (k === 'reminders') return nmEsc(t(nmProfile.reminders_on ? 'nm_on' : 'nm_off'));
    if (k === 'photos' && nmLastPhotoDay) return nmEsc(nmShortDate(nmLastPhotoDay));
    return '';
}
function nmTileHtml(k) {
    const sub = nmTileSub(k);
    const action = k === 'pdf' ? 'nmOpenPdf(this)' : `nmGo('${k}')`;
    return `<button type="button" class="nm-tile" data-tile="${k}" onclick="${action}">
        <span class="nm-tile-icon" aria-hidden="true">${NEW_ME_TILE_ICONS[k]}</span>
        <span class="nm-tile-label">${nmEsc(t(NEW_ME_VIEW_TITLES[k]))}</span>
        <span class="nm-tile-sub">${sub}</span>
    </button>`;
}

// כרטיס ארוחה: ידית גרירה, שם הארוחה, שעת תזכורת, ✓, ומה אוכלים (או ארוחה חופשית)
function nmMealCardHtml(slot) {
    const done = !!nmTodayCheckins[slot];
    const remTime = nmProfile.reminders_on && nmSlotReminderEnabled(slot) ? nmSlotReminderTime(slot) : null;
    const head = `
        <div class="nm-meal-head">
            <button type="button" class="nm-drag" data-slot="${slot}" aria-label="${nmEsc(t('nm_drag_label'))}" title="${nmEsc(t('nm_drag_label'))}">${NM_GRIP_SVG}</button>
            <span class="nm-slot-name">${nmEsc(nmSlotName(slot))}</span>
            ${remTime ? `<button type="button" class="nm-time-chip" onclick="nmGo('reminders')" aria-label="${nmEsc(t('nm_tile_reminders'))}">⏰ <bdi dir="ltr">${remTime}</bdi></button>` : ''}
            ${nmIsOverride(slot) ? `<span class="nm-today-tag">${nmEsc(t('nm_today_only_tag'))}</span>` : ''}
            <span class="nm-head-space"></span>
            <button type="button" class="nm-check${done ? ' on' : ''}" onclick="nmToggleCheck('${slot}', this)" aria-pressed="${done}" aria-label="${nmEsc(t('nm_mark_eaten'))}">${NM_CHECK_SVG}</button>
        </div>`;
    if (nmIsFree(slot)) {
        const kcal = nmToday.free_kcal;
        return `
            <div class="nm-meal nm-meal-free${done ? ' done' : ''}" data-slot="${slot}">
                ${head}
                <div class="nm-option-name">🍕 ${nmEsc(t('nm_free_meal'))}</div>
                <div class="nm-option-text">${nmEsc(t('nm_free_meal_hint').replace('{kcal}', nmFmt(NEW_ME_FREE_MEAL_KCAL)))}</div>
                <div class="nm-free-fields">
                    <input type="text" class="nm-free-text" maxlength="120" value="${nmEsc(nmToday.free_text || '')}" placeholder="${nmEsc(t('nm_free_text_ph'))}" aria-label="${nmEsc(t('nm_free_text_ph'))}" onchange="nmSaveFreeDetails('${slot}', this)" ${done ? 'disabled' : ''}>
                    <input type="number" class="nm-free-kcal" dir="ltr" inputmode="numeric" min="0" max="2500" value="${kcal != null ? nmEsc(kcal) : ''}" placeholder="~${NEW_ME_FREE_MEAL_KCAL}" aria-label="${nmEsc(t('calories_unit'))}" onchange="nmSaveFreeDetails('${slot}', this)" ${done ? 'disabled' : ''}>
                </div>
                ${Number(kcal) > NEW_ME_FREE_MEAL_KCAL ? `<p class="nm-soft-warn">${nmEsc(t('nm_free_over_note').replace('{kcal}', nmFmt(NEW_ME_FREE_MEAL_KCAL)))}</p>` : ''}
                <div class="nm-meal-foot">
                    <span class="nm-option-meta"><bdi dir="ltr">~${nmFmt(nmFreeKcal())}</bdi> ${nmEsc(t('calories_unit'))}</span>
                    <span class="nm-meal-actions"><button type="button" class="nm-chip" onclick="nmCancelFreeMeal()">${nmEsc(t('nm_free_cancel'))}</button></span>
                </div>
            </div>`;
    }
    const it = nmItemInfo(nmTodayKey(slot));
    // תג הפרש רק כשהפריט הגיע מהחלפה מחוץ לאפשרויות של אותה ארוחה (או להיום בלבד)
    const crossed = nmIsOverride(slot) || it.custom || it.slot !== slot || it.plan !== nmProfile.plan;
    const diff = it.kcal - NEW_ME_PLANS[nmProfile.plan][slot].target;
    const canRemove = nmActiveOrder().length > NEW_ME_MIN_MEALS;
    return `
        <div class="nm-meal${done ? ' done' : ''}" data-slot="${slot}">
            ${head}
            <div class="nm-option-name">${it.custom ? `<span class="nm-custom-tag" title="${nmEsc(t(it.source === 'ai' || it.source === 'ai_menu' ? 'nm_custom_from_ai' : 'nm_custom_from_saved'))}">${it.source === 'ai' || it.source === 'ai_menu' ? '✨' : '⭐'}</span> ` : ''}${nmEsc(nmItemShort(it))}</div>
            <div class="nm-option-text">${nmEsc(nmItemFull(it))}</div>
            ${!done && !it.custom && nmOptPicks(it.plan, it.slot, it.opt).length ? nmPicksPanelHtml(nmOptPicks(it.plan, it.slot, it.opt), 'day', slot) : ''}
            ${nmAltRowHtml(slot)}
            ${nmExtraLineHtml(slot)}
            ${nmLaterRowHtml(slot)}
            <div class="nm-meal-foot">
                <span class="nm-option-meta">${nmMeta(it)}${crossed && Math.abs(diff) >= 5 ? ' ' + nmDiffChip(diff) : ''}</span>
                <span class="nm-meal-actions">
                    <button type="button" class="nm-chip" onclick="nmOpenSwap('${slot}')">🔄 ${nmEsc(t('nm_swap'))}</button>
                    <button type="button" class="nm-chip" data-edit onclick="nmOpenSwap('${slot}', 'ai', { edit: true })">✏️ ${nmEsc(t('nm_edit_meal'))}</button>
                    ${nmIsOverride(slot) ? `<button type="button" class="nm-chip" onclick="nmRevertToday('${slot}')">↩ ${nmEsc(t('nm_swap_revert'))}</button>` : ''}
                    ${it.source === 'preset' ? '' : `<button type="button" class="nm-chip nm-chip-icon" onclick="nmSaveAsPreset('${slot}')" title="${nmEsc(t('nm_save_preset'))}" aria-label="${nmEsc(t('nm_save_preset'))}">⭐</button>`}
                    ${canRemove ? `<button type="button" class="nm-chip nm-chip-icon" onclick="nmAskRemoveMeal('${slot}')" title="${nmEsc(t('nm_remove_meal'))}" aria-label="${nmEsc(t('nm_remove_meal'))}">➖</button>` : ''}
                </span>
            </div>
        </div>`;
}

// ---------- הסרת ארוחה מהתפריט / החזרה, והקלוריות שהתפנו ----------
// לפי בקשה מפורשת: "במקום 4 ארוחות 3, או 2 ארוחות + נשנוש". הקלוריות של הארוחה שהוסרה
// פנויות למילוי - ארוחה גדולה יותר, ארוחה מהארוחות הקבועות או כתיבה ל-AI - עד סך התוכנית
function nmMenuRoomHtml() {
    const hidden = nmHiddenSlots();
    const room = nmMenuRoom();
    const active = nmActiveOrder();
    const parts = [];
    if (room >= 40) {
        parts.push(`
            <div class="nm-room-card">
                <div class="nm-room-title">🍽️ ${nmTpl('nm_room_title', { n: nmFmt(room) })}</div>
                <p class="nm-fine">${nmEsc(t('nm_room_hint'))}</p>
                <div class="nm-chip-row">${active.filter(s => !nmIsFree(s)).map(s => `<button type="button" class="nm-chip" onclick="nmOpenSwap('${s}')">🔄 ${nmEsc(nmSlotName(s))}</button>`).join('')}</div>
            </div>`);
    }
    if (hidden.length) {
        parts.push(`<div class="nm-restore-row">${hidden.map(s => `<button type="button" class="nm-link-btn" onclick="nmRestoreMeal('${s}')">➕ ${nmEsc(t('nm_restore_meal').replace('{slot}', nmSlotName(s)))}</button>`).join('')}</div>`);
    }
    return parts.join('');
}

function nmAskRemoveMeal(slot) {
    if (nmActiveOrder().length <= NEW_ME_MIN_MEALS) { showAppToast(t('nm_remove_min').replace('{n}', NEW_ME_MIN_MEALS), 'error'); return; }
    const it = nmIsFree(slot) ? { kcal: nmFreeKcal() } : nmItemInfo(nmTodayKey(slot));
    const ov = nmOpenSheet(`
        <h4>➖ ${nmEsc(t('nm_remove_title').replace('{slot}', nmSlotName(slot)))}</h4>
        <p class="nm-fine">${nmTpl('nm_remove_text', { n: nmFmt(it.kcal) })}</p>
        <button type="button" class="nm-btn-primary" data-remove>${nmEsc(t('nm_remove_confirm'))}</button>
        <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_back'))}</button>`, 'nm-remove-sheet');
    ov.querySelector('[data-remove]').addEventListener('click', async () => { ov.remove(); await nmSetMealHidden(slot, true); });
}

async function nmSetMealHidden(slot, hide) {
    const hidden = new Set(nmHiddenSlots());
    if (hide) {
        if (nmActiveOrder().length <= NEW_ME_MIN_MEALS) return;
        // ארוחה שכבר סומנה ✓ היום - הסימון (והרישום ביומן) יורד איתה
        if (nmTodayCheckins[slot]) await nmUncheck(slot);
        hidden.add(slot);
    } else hidden.delete(slot);
    const value = [...hidden].join(',') || null;
    const { error } = await supabaseClient.from('new_me_profile').update({ hidden_slots: value, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
    nmProfile.hidden_slots = value;
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
    showAppToast(t(hide ? 'nm_remove_done' : 'nm_restore_done'));
    if (nmProfile.reminders_on) nmSyncReminders();
}
function nmRestoreMeal(slot) { return nmSetMealHidden(slot, false); }

// תזכורת עדינה בסוף התפריט (לפי בקשה מפורשת: "תזכורת" עם לב עדין) - לב קטן בצבעי ערכת הנושא
function nmGoalReminderHtml() {
    return `
        <p class="nm-goal-reminder">
            <svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="nm-heart-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent-purple)"/><stop offset="1" stop-color="var(--accent-pink)"/></linearGradient></defs><path d="M12 20.6s-7.4-4.5-9.4-9.3C1.2 8.1 3.3 4.9 6.7 4.9c2.1 0 3.6 1.2 5.3 3.2 1.7-2 3.2-3.2 5.3-3.2 3.4 0 5.5 3.2 4.1 6.4-2 4.8-9.4 9.3-9.4 9.3z" fill="url(#nm-heart-grad)"/></svg>
            <span>${nmEsc(t('nm_goal_reminder'))}</span>
        </p>`;
}

// ---------- גרירה לשינוי סדר הארוחות ----------
// ידית ⋮⋮ בכל כרטיס; במקלדת - חיצים למעלה/למטה על הידית. הסדר נשמר כקבוע
function nmInitDrag(list) {
    if (!list) return;
    list.querySelectorAll('.nm-drag').forEach(handle => {
        handle.addEventListener('pointerdown', e => nmDragStart(e, handle, list));
        handle.addEventListener('keydown', e => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            // רק הארוחות שבתפריט זזות; ארוחה שהוסרה נשארת במקומה ביום
            const order = nmActiveOrder();
            const from = order.indexOf(handle.dataset.slot);
            const to = from + (e.key === 'ArrowUp' ? -1 : 1);
            if (to < 0 || to >= order.length) return;
            order.splice(to, 0, order.splice(from, 1)[0]);
            nmSaveOrder(nmComposeOrder(order), handle.dataset.slot);
        });
    });
}

function nmDragStart(e, handle, list) {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    const card = handle.closest('.nm-meal');
    const cards = Array.from(list.querySelectorAll('.nm-meal[data-slot]'));
    const rects = cards.map(c => c.getBoundingClientRect());
    const from = cards.indexOf(card);
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 10;
    const shift = rects[from].height + gap;
    const startY = e.clientY;
    const scroller = nmScroller();
    const startScroll = scroller ? scroller.scrollTop : 0;
    let to = from, lastY = e.clientY, raf = null;
    card.classList.add('dragging');
    list.classList.add('is-dragging');
    try { handle.setPointerCapture(e.pointerId); } catch { /* ok */ }
    const layout = () => {
        const scrolled = scroller ? scroller.scrollTop - startScroll : 0;
        const dy = lastY - startY + scrolled;
        card.style.transform = `translateY(${dy}px)`;
        const center = rects[from].top + rects[from].height / 2 + dy - scrolled;
        to = from;
        rects.forEach((r, i) => {
            const mid = r.top + r.height / 2 - scrolled;
            if (i < from && center < mid + scrolled) to = Math.min(to, i);
            if (i > from && center > mid + scrolled) to = Math.max(to, i);
        });
        cards.forEach((c, i) => {
            if (c === card) return;
            let y = 0;
            if (from < to && i > from && i <= to) y = -shift;
            if (from > to && i >= to && i < from) y = shift;
            c.style.transform = y ? `translateY(${y}px)` : '';
        });
    };
    // גלילה אוטומטית כשגוררים לקצה המסך
    const autoScroll = () => {
        if (!scroller) return;
        const r = scroller.getBoundingClientRect();
        if (lastY < r.top + 50) scroller.scrollTop -= 8;
        else if (lastY > r.bottom - 50) scroller.scrollTop += 8;
        layout();
        raf = requestAnimationFrame(autoScroll);
    };
    raf = requestAnimationFrame(autoScroll);
    const onMove = ev => { lastY = ev.clientY; layout(); };
    const onUp = () => {
        cancelAnimationFrame(raf);
        handle.removeEventListener('pointermove', onMove);
        handle.removeEventListener('pointerup', onUp);
        handle.removeEventListener('pointercancel', onUp);
        cards.forEach(c => { c.style.transform = ''; });
        card.classList.remove('dragging');
        list.classList.remove('is-dragging');
        if (to !== from) {
            const order = nmActiveOrder();
            order.splice(to, 0, order.splice(from, 1)[0]);
            nmSaveOrder(nmComposeOrder(order), card.dataset.slot);
        }
    };
    handle.addEventListener('pointermove', onMove);
    handle.addEventListener('pointerup', onUp);
    handle.addEventListener('pointercancel', onUp);
}

async function nmSaveOrder(order, focusSlot) {
    nmProfile.meal_order = order.join(',');
    nmRenderView(nmRoot());
    const h = focusSlot && document.querySelector(`#nm-menu-list .nm-drag[data-slot="${focusSlot}"]`);
    if (h) h.focus({ preventScroll: true });
    const { error } = await supabaseClient.from('new_me_profile').update({ meal_order: nmProfile.meal_order, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
    showAppToast(t('nm_order_saved'));
    if (nmProfile.reminders_on) nmSyncReminders();
}

// ---------- החלפה: כל התפריט, לפי קלוריות דומות ----------
// מוצגות קודם האפשרויות בטווח ±15% מיעד הארוחה (מכל התפריט, שתי התוכניות), ומתחת - כל
// השאר. אחרי הבחירה שואלים: רק להיום או מעכשיו קבוע (לפי בקשה מפורשת - לשאול בכל פעם)
function nmSwapCandidates(slot) {
    const target = NEW_ME_PLANS[nmProfile.plan][slot].target;
    const currentKey = nmTodayKey(slot);
    const all = [];
    [1300, 1500].forEach(plan => NEW_ME_SLOTS.forEach(s => nmSlotOpts(plan, s).forEach(opt => {
        const key = nmItemKey(plan, s, opt);
        if (key === currentKey) return;
        const it = nmItemInfo(key);
        // האפשרויות של אותה ארוחה בתוכנית הנוכחית קודם - הן החלופות "המקוריות"
        const own = plan === nmProfile.plan && s === slot ? 0 : 1;
        all.push({ ...it, dist: Math.abs(it.kcal - target) / target, own });
    })));
    const sort = (a, b) => a.own - b.own || a.dist - b.dist;
    // מצב מתקדם (בניית תפריט חופשית): כל האפשרויות ברשימה אחת, בלי חלוקה לפי קלוריות
    if (nmGodMode()) return { near: all.sort(sort), far: [] };
    return {
        near: all.filter(x => x.dist <= NEW_ME_SWAP_RANGE).sort(sort),
        far: all.filter(x => x.dist > NEW_ME_SWAP_RANGE).sort(sort),
    };
}

// החלפה בשלוש לשוניות (לפי בקשה מפורשת): 🍽️ מהתפריט, ⭐ מהארוחות הקבועות (מאגר הארוחות
// השמורות), ✨ כתיבה חופשית ל-AI. ארוחה מהמאגר או מה-AI נשמרת כארוחה אישית (c_<id>) וזורמת
// לאותו אישור "רק להיום / קבוע". מה שנכנס: עד סך התוכנית - הקלוריות של הארוחה הנוכחית +
// מה שפנוי בתפריט (למשל אחרי שהוסרה ארוחה). ב-God Mode אין מגבלה
// ✏️ לערוך ארוחה (לפי בקשה מפורשת: "אפשרות... לערוך את אחת הארוחות והחישוב גם יעשה עם הAI"): נפתח ב"כתיבה ל-AI"
// עם הטקסט של הארוחה, משנים מה שרוצים (בלי לחם, עוד ביצה...) וה-AI מחשב מחדש
function nmOpenSwap(slot, startTab, opts) {
    const cur = nmItemInfo(nmTodayKey(slot));
    const { near, far } = nmSwapCandidates(slot);
    const freeAvailable = !nmWeekFreeRow();
    const room = nmMenuRoom();
    // מה שמגיע לארוחה הזו היום - כולל התיקון שלה (ר' nmBalance)
    const budget = cur.kcal + nmSlotExtra(slot) + room;
    const god = nmGodMode();
    const fitsBudget = kcal => god || kcal <= budget * 1.1;
    let tab = startTab || 'menu';
    let aiText = opts && opts.edit ? nmItemFull(cur) : '', aiResult = null, aiBusy = false;
    const ov = nmOpenSheet('', 'nm-swap-sheet');
    const sheet = ov.querySelector('.nm-sheet');
    const optHtml = c => `
        <button type="button" class="nm-option" data-key="${c.key}">
            <span class="nm-option-top"><span class="nm-option-name">${nmEsc(nmItemShort(c))}</span>${nmDiffChip(c.kcal - cur.kcal)}</span>
            <span class="nm-option-text">${nmEsc(nmItemFull(c))}</span>
            <span class="nm-option-meta">${nmMeta(c)}</span>
        </button>`;
    const TABS = [['menu', '🍽️', 'nm_swap_tab_menu'], ['saved', '⭐', 'nm_swap_tab_saved'], ['ai', '✨', 'nm_swap_tab_ai']];
    const headHtml = () => `
        <span class="nm-sheet-grip" aria-hidden="true"></span>
        <h4>${nmEsc(t('nm_swap_title').replace('{slot}', nmSlotName(slot)))}</h4>
        <div class="nm-swap-current"><span>${nmEsc(t('nm_swap_now'))}</span> <b>${nmEsc(nmItemShort(cur))}</b> · <bdi dir="ltr">~${cur.kcal}</bdi> ${nmEsc(t('calories_unit'))}</div>
        <div class="nm-swap-tabs" role="tablist">${TABS.map(([k, icon, label]) => `<button type="button" role="tab" class="nm-swap-tab${tab === k ? ' on' : ''}" aria-selected="${tab === k}" data-tab="${k}">${icon} ${nmEsc(t(label))}</button>`).join('')}</div>
        ${room >= 40 && !god ? `<div class="nm-swap-budget">${nmTpl('nm_swap_budget', { n: nmFmt(budget) })}</div>` : ''}`;
    const bindTabs = () => sheet.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    const backBtn = `<button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_back'))}</button>`;
    const render = () => { if (tab === 'saved') renderSaved(); else if (tab === 'ai') renderAi(); else renderList(); sheet.scrollTop = 0; };
    // ✨ התפריט האישי של הארוחה הזו (מה-AI) - ראשון; אחריו האפשרויות המקוריות
    const personal = nmPersonalMenuKeys(slot).filter(k => k !== nmTodayKey(slot)).map(nmItemInfo).filter(Boolean);
    const renderList = () => {
        sheet.innerHTML = `${headHtml()}
            ${personal.length ? `<div class="nm-sheet-label">✨ ${nmEsc(t('nm_ai_menu_title'))}</div>${personal.map(optHtml).join('')}` : ''}
            ${god ? '' : `<div class="nm-sheet-label">${nmTpl('nm_swap_similar', { p: Math.round(NEW_ME_SWAP_RANGE * 100) })}</div>`}
            ${near.length ? near.map(optHtml).join('') : `<p class="nm-fine">${nmEsc(t('nm_swap_none_near'))}</p>`}
            ${far.length ? `<details class="nm-swap-more"><summary>${nmEsc(t('nm_swap_show_all').replace('{n}', far.length))}</summary><div class="nm-swap-more-list">${far.map(optHtml).join('')}</div></details>` : ''}
            ${freeAvailable ? `<button type="button" class="nm-option nm-option-free" data-free="1"><span class="nm-option-name">🍕 ${nmEsc(t('nm_swap_free_option'))}</span><span class="nm-option-text">${nmTpl('nm_free_plan_sub', { kcal: nmFmt(NEW_ME_FREE_MEAL_KCAL) })}</span></button>` : ''}
            ${backBtn}`;
        bindTabs();
        sheet.querySelectorAll('[data-key]').forEach(b => b.addEventListener('click', () => renderConfirm(b.dataset.key)));
        const fb = sheet.querySelector('[data-free]');
        if (fb) fb.addEventListener('click', () => { ov.remove(); nmPlanFreeMeal(getLocalDateString(), slot); });
    };
    const renderSaved = async () => {
        sheet.innerHTML = `${headHtml()}<div class="nm-loading-inline" aria-hidden="true"></div>${backBtn}`;
        bindTabs();
        let presets = typeof cachedPresets !== 'undefined' && cachedPresets.length ? cachedPresets : null;
        if (!presets) {
            const { data } = await supabaseClient.from('meal_presets').select('*').eq('user_id', currentUserId);
            presets = data || [];
            if (typeof cachedPresets !== 'undefined') cachedPresets = presets;
        }
        if (tab !== 'saved' || !ov.isConnected) return;
        const items = presets.filter(p => Number(p.calories) > 0).map(p => ({ p, kcal: Math.round(Number(p.calories)), fits: fitsBudget(Number(p.calories)) }));
        items.sort((a, b) => (b.fits - a.fits) || Math.abs(a.kcal - budget) - Math.abs(b.kcal - budget));
        const row = x => `
            <button type="button" class="nm-option${x.fits ? '' : ' too-big'}" data-preset="${x.p.id}" ${x.fits ? '' : 'disabled'}>
                <span class="nm-option-top"><span class="nm-option-name">${nmEsc(x.p.food_name)}</span>${nmDiffChip(x.kcal - cur.kcal)}</span>
                ${x.p.description ? `<span class="nm-option-text">${nmEsc(x.p.description)}</span>` : ''}
                <span class="nm-option-meta">${nmMeta({ kcal: x.kcal, protein: Math.round(Number(x.p.protein_grams) || 0) })}</span>
            </button>`;
        const fits = items.filter(x => x.fits), big = items.filter(x => !x.fits);
        sheet.innerHTML = `${headHtml()}
            ${items.length ? `${fits.length ? fits.map(row).join('') : `<p class="nm-fine">${nmEsc(t('nm_swap_saved_none_fit'))}</p>`}
                ${big.length ? `<div class="nm-sheet-label">${nmEsc(t('nm_swap_bigger_label'))}</div>${big.map(row).join('')}` : ''}`
                : `<p class="nm-fine">${nmEsc(t('nm_swap_saved_empty'))}</p>`}
            ${backBtn}`;
        bindTabs();
        sheet.querySelectorAll('[data-preset]').forEach(b => b.addEventListener('click', async () => {
            const p = presets.find(x => x.id === b.dataset.preset);
            if (!p) return;
            b.disabled = true;
            const key = await nmCreateCustomMeal({ name: p.food_name, description: p.description || null, kcal: Math.round(Number(p.calories)), protein: Number(p.protein_grams) || 0, source: 'preset', preset_id: p.id });
            if (key && ov.isConnected) renderConfirm(key);
        }));
    };
    const aiResultHtml = () => {
        const fits = fitsBudget(aiResult.kcal);
        return `
            <div class="nm-swap-pick nm-ai-result">
                <span class="nm-option-name">✨ ${nmEsc(aiResult.name)}</span>
                ${aiResult.description ? `<span class="nm-option-text">${nmEsc(aiResult.description)}</span>` : ''}
                <span class="nm-option-meta">${nmMeta({ kcal: aiResult.kcal, protein: Math.round(aiResult.protein) })}${aiResult.rough ? ` · ${nmEsc(t('nm_swap_ai_rough'))}` : ''}</span>
                ${fits ? `<button type="button" class="nm-btn-primary" data-use>${nmEsc(t('nm_swap_ai_use'))}</button>` : `<p class="nm-soft-warn">${nmTpl('nm_swap_ai_too_big', { n: nmFmt(budget) })}</p>`}
            </div>`;
    };
    const renderAi = () => {
        sheet.innerHTML = `${headHtml()}
            <p class="nm-fine">${nmEsc(t('nm_swap_ai_hint'))}</p>
            <textarea class="nm-ai-input" rows="3" maxlength="300" placeholder="${nmEsc(t('nm_swap_ai_ph'))}" aria-label="${nmEsc(t('nm_swap_tab_ai'))}">${nmEsc(aiText)}</textarea>
            <button type="button" class="nm-btn-primary" data-estimate ${aiBusy ? 'disabled' : ''}>${nmEsc(t(aiBusy ? 'nm_swap_ai_busy' : 'nm_swap_ai_go'))}</button>
            ${aiResult ? aiResultHtml() : ''}
            ${backBtn}`;
        bindTabs();
        const ta = sheet.querySelector('.nm-ai-input');
        ta.addEventListener('input', () => { aiText = ta.value; });
        sheet.querySelector('[data-estimate]').addEventListener('click', async () => {
            const text = aiText.trim();
            if (text.length < 2) { showAppToast(t('quick_add_missing_text'), 'error'); return; }
            aiBusy = true; aiResult = null; render();
            aiResult = await nmEstimateMeal(text, cur.kcal);
            aiBusy = false;
            if (ov.isConnected && tab === 'ai') render();
        });
        const use = sheet.querySelector('[data-use]');
        if (use) use.addEventListener('click', async () => {
            use.disabled = true;
            const key = await nmCreateCustomMeal({ name: aiResult.name, description: aiResult.description || null, kcal: aiResult.kcal, protein: aiResult.protein, source: 'ai' });
            if (key && ov.isConnected) renderConfirm(key);
        });
    };
    const renderConfirm = key => {
        const it = nmItemInfo(key);
        const d = it.kcal - cur.kcal;
        // אחרי ההחלפה היום מתאזן מחדש (nmBalance): ההפרש מתחלק בין הארוחות, והסה"כ נשאר התוכנית
        const newTotal = nmMenuTotal({ [slot]: key });
        const absorbed = d - (newTotal - nmMenuTotal());
        const big = !god && (Math.abs(d) >= 60 || newTotal > nmProfile.plan * 1.08) && newTotal > nmProfile.plan;
        sheet.innerHTML = `
            <span class="nm-sheet-grip" aria-hidden="true"></span>
            <h4>${nmEsc(t('nm_swap_title').replace('{slot}', nmSlotName(slot)))}</h4>
            <div class="nm-swap-pick">
                <span class="nm-option-name">${it.custom ? (it.source === 'ai' || it.source === 'ai_menu' ? '✨ ' : '⭐ ') : ''}${nmEsc(nmItemShort(it))}</span>
                <span class="nm-option-text">${nmEsc(nmItemFull(it))}</span>
                <span class="nm-option-meta">${nmMeta(it)}</span>
            </div>
            <div class="nm-swap-balance">
                <span class="nm-swap-balance-diff ${d > 0 ? 'up' : d < 0 ? 'down' : 'eq'}">${d === 0 ? nmEsc(t('nm_swap_same_kcal')) : nmTpl(d > 0 ? 'nm_swap_more_kcal' : 'nm_swap_less_kcal', { n: nmFmt(Math.abs(d)) })}</span>
                ${absorbed ? `<span class="nm-fine nm-swap-balanced">${nmTpl('nm_swap_balanced', { n: nmSigned(-absorbed), plan: nmFmt(nmProfile.plan) })}</span>` : ''}
                <span class="nm-fine">${nmTpl('nm_swap_day_total', { total: nmFmt(newTotal), plan: nmFmt(nmProfile.plan) })}</span>
            </div>
            ${big ? `<p class="nm-soft-warn">💛 ${nmEsc(t('nm_swap_big_warn'))}</p>` : ''}
            <div class="nm-sheet-label">${nmEsc(t('nm_swap_how_long'))}</div>
            <div class="nm-swap-modes">
                <button type="button" class="nm-mode-btn" data-mode="today"><b>${nmEsc(t('nm_swap_today'))}</b><span>${nmEsc(t('nm_swap_today_sub'))}</span></button>
                <button type="button" class="nm-mode-btn" data-mode="permanent"><b>${nmEsc(t('nm_swap_permanent'))}</b><span>${nmEsc(t('nm_swap_permanent_sub'))}</span></button>
            </div>
            <button type="button" class="nm-btn-ghost" data-back>${nmEsc(t('nm_back'))}</button>`;
        sheet.querySelector('[data-back]').addEventListener('click', render);
        sheet.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', async () => {
            ov.remove();
            await nmApplySwap(slot, key, b.dataset.mode);
        }));
        sheet.scrollTop = 0;
    };
    render();
}

// ארוחה אישית חדשה (או קיימת זהה - לא מכפילים): ממאגר הארוחות הקבועות או מה-AI
async function nmCreateCustomMeal(fields) {
    const name = String(fields.name || '').trim().slice(0, 120);
    if (!name) return null;
    const kcal = Math.max(0, Math.min(3000, Math.round(Number(fields.kcal) || 0)));
    const protein = Math.max(0, Math.min(300, Math.round((Number(fields.protein) || 0) * 10) / 10));
    const same = nmCustomMeals.find(m => m.source === fields.source && m.name === name && Number(m.kcal) === kcal && (fields.source !== 'preset' || m.preset_id === fields.preset_id));
    if (same) return 'c_' + same.id;
    const { data, error } = await supabaseClient.from('new_me_custom_meals').insert({
        user_id: currentUserId, name, description: fields.description ? String(fields.description).slice(0, 600) : null,
        kcal, protein, source: fields.source, preset_id: fields.preset_id || null,
    }).select().single();
    if (error || !data) { showAppToast(t('nm_save_error'), 'error'); return null; }
    nmCustomMeals.push(data);
    return 'c_' + data.id;
}

// הערכת ארוחה שנכתבה: AI (פונקציה ייעודית לרוכשי New Me), ואם לא הצליח - הערכה מקומית גסה
async function nmEstimateMeal(text, budget) {
    const fallback = () => {
        const local = typeof estimateFreeTextMacros === 'function' ? estimateFreeTextMacros(text) : { calories: 0, protein: 0 };
        return { name: text.slice(0, 80), description: '', kcal: Math.round(Number(local.calories) || 0), protein: Number(local.protein) || 0, rough: true };
    };
    try {
        const callOnce = async () => {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 25000);
            try {
                return await fetch(`${SUPABASE_URL}/functions/v1/new-me-meal-kcal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ meal: text, language: currentLang, budget }),
                    signal: controller.signal,
                });
            } finally { clearTimeout(timer); }
        };
        let res = await callOnce();
        if (res.status === 401) {
            await supabaseClient.auth.refreshSession().catch(() => {});
            res = await callOnce();
        }
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.ok || !(result.kcal > 0)) return fallback();
        return { name: result.name || text.slice(0, 80), description: result.description || '', kcal: result.kcal, protein: Number(result.protein_g) || 0, rough: false };
    } catch {
        return fallback();
    }
}

// ארוחה שכבר סומנה ✓ - הסימון עובר לפריט החדש (מסירים ומסמנים מחדש)
async function nmWithRecheck(slot, fn) {
    const was = !!nmTodayCheckins[slot];
    if (was) await nmUncheck(slot);
    const ok = await fn();
    if (was) await nmCheck(slot);
    return ok;
}

async function nmSetTodayOverride(slot, key) {
    const overrides = { ...((nmToday && nmToday.overrides) || {}) };
    if (key) overrides[slot] = key; else delete overrides[slot];
    return !!(await nmUpsertDay(getLocalDateString(), { overrides }));
}

async function nmApplySwap(slot, key, mode) {
    const ok = await nmWithRecheck(slot, async () => {
        if (mode === 'today') return nmSetTodayOverride(slot, key);
        // קבוע: פריט מאותה ארוחה ומאותה תוכנית נשמר כאות (כך שמעבר תוכנית מתאים את המנה);
        // ארוחה אישית (c_...) או פריט מארוחה אחרת - נשמרים כמפתח המלא
        const p = nmParseItem(key);
        const value = p && p.plan === nmProfile.plan && p.slot === slot ? p.opt : key;
        const { error } = await supabaseClient.from('new_me_profile').update({ ['choice_' + slot]: value, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
        if (error) { showAppToast(t('nm_save_error'), 'error'); return false; }
        nmProfile['choice_' + slot] = value;
        if (nmIsOverride(slot)) await nmSetTodayOverride(slot, null);
        return true;
    });
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
    if (!ok) return;
    showAppToast(t(mode === 'today' ? 'nm_swap_done_today' : 'nm_swap_done_permanent'));
    if (nmProfile.reminders_on) nmSyncReminders();
    nmAwardBadges(['first_swap']);
}

async function nmRevertToday(slot) {
    await nmWithRecheck(slot, () => nmSetTodayOverride(slot, null));
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
    if (nmProfile.reminders_on) nmSyncReminders();
}

// ---------- ✓ ----------
async function nmToggleCheck(slot, btn) {
    if (btn) btn.disabled = true;
    const wasChecked = !!nmTodayCheckins[slot];
    const wasFree = nmIsFree(slot);
    try {
        if (wasChecked) await nmUncheck(slot);
        else await nmCheck(slot);
    } finally {
        await Promise.all([nmLoadToday(), nmLoadJourney()]);
        nmRenderView(nmRoot());
        nmAfterTrackerChange();
    }
    if (!wasChecked && (nmView === 'home' || nmView === 'day')) {
        // כל הארוחות שבתפריט של היום סומנו (כל המנורות דולקות) - חגיגה קטנה
        if (nmActiveOrder().every(s => nmTodayCheckins[s])) {
            const list = document.getElementById('nm-menu-list') || document.querySelector('#new-me-root .nmh');
            if (list && typeof spawnGentleConfettiBurst === 'function') spawnGentleConfettiBurst(list, 30);
            showAppToast(t('nm_all_done_toast'));
        }
    }
    nmAwardBadges(!wasChecked && wasFree ? ['free_meal'] : []);
    // "21 ימים לפי התפריט": 3 ארוחות מסומנות = היום באתגר מסומן לבד
    if (!wasChecked) nmChallengeAutoCheck('menu');
    // ✓ ביום השלישי עם New Me = המפתח הראשון לחדר הסודי
    if (!wasChecked && typeof roomCheckNewKeys === 'function') roomCheckNewKeys();
}

async function nmCheck(slot) {
    const today = getLocalDateString();
    let kcal, protein, text, optionId, plan = nmProfile.plan;
    if (nmIsFree(slot)) {
        kcal = nmFreeKcal();
        protein = 0;
        text = `🍕 ${(nmToday.free_text || '').trim() || t('nm_free_meal')}`;
        optionId = 'free';
    } else {
        const it = nmItemInfo(nmTodayKey(slot));
        // כולל החלק מארוחה שירדה (החלבון גדל באותו יחס)
        const extra = nmSlotExtra(slot);
        kcal = it.kcal + extra;
        protein = Math.round((it.protein + (it.kcal ? it.protein * extra / it.kcal : 0)) * 10) / 10;
        plan = it.plan;
        text = `✨ ${nmItemShort(it)}`;
        optionId = it.key;
    }
    const mealType = NEW_ME_TRACKER_SLOT[slot];
    const { data: existing } = await supabaseClient.from('calorie_tracker').select('id, food_description, calories, protein_grams').eq('user_id', currentUserId).eq('date', today).eq('meal_type', mealType).maybeSingle();
    let mode = 'own';
    if (existing) {
        mode = 'merged';
        await supabaseClient.from('calorie_tracker').update({
            food_description: `${existing.food_description} + ${text}`,
            calories: (existing.calories || 0) + kcal,
            protein_grams: (Number(existing.protein_grams) || 0) + protein,
        }).eq('id', existing.id);
    } else {
        await supabaseClient.from('calorie_tracker').insert({
            username: currentUsername, user_id: currentUserId, date: today, meal_type: mealType,
            food_description: text, calories: kcal, protein_grams: protein, source: 'new_me',
        });
    }
    const { data } = await supabaseClient.from('new_me_checkins').upsert({
        user_id: currentUserId, checkin_date: today, slot, option_id: optionId, plan,
        kcal, protein_g: protein, mirror_mode: mode, mirror_text: text,
    }, { onConflict: 'user_id,checkin_date,slot' }).select().maybeSingle();
    nmTodayCheckins[slot] = data || { slot, option_id: optionId, kcal, protein_g: protein, mirror_mode: mode, mirror_text: text };
}

async function nmUncheck(slot) {
    const row = nmTodayCheckins[slot];
    if (!row) return;
    const today = getLocalDateString();
    const mealType = NEW_ME_TRACKER_SLOT[slot];
    const { data: existing } = await supabaseClient.from('calorie_tracker').select('id, food_description, calories, protein_grams, source').eq('user_id', currentUserId).eq('date', today).eq('meal_type', mealType).maybeSingle();
    if (existing) {
        const text = row.mirror_text || '';
        if (row.mirror_mode === 'own' && existing.source === 'new_me' && existing.food_description === text) {
            await supabaseClient.from('calorie_tracker').delete().eq('id', existing.id);
        } else {
            // הוסר רק החלק של New Me מתוך רישום משותף
            const desc = String(existing.food_description || '').split(` + ${text}`).join('').replace(text, '').replace(/^\s*\+\s*/, '').trim();
            const kcal = Math.max(0, (existing.calories || 0) - (row.kcal || 0));
            const protein = Math.max(0, (Number(existing.protein_grams) || 0) - (Number(row.protein_g) || 0));
            if (!desc && kcal === 0) await supabaseClient.from('calorie_tracker').delete().eq('id', existing.id);
            else await supabaseClient.from('calorie_tracker').update({ food_description: desc, calories: kcal, protein_grams: protein }).eq('id', existing.id);
        }
    }
    await supabaseClient.from('new_me_checkins').delete().eq('user_id', currentUserId).eq('checkin_date', today).eq('slot', slot);
    delete nmTodayCheckins[slot];
}

// שמירה כארוחה שמורה - אותו זרם כמו saveMealRowAsPreset (בורר קטגוריה פתוח לאישור)
async function nmSaveAsPreset(slot) {
    const it = nmItemInfo(nmTodayKey(slot));
    const { data } = await supabaseClient.from('meal_presets').select('*').eq('user_id', currentUserId);
    cachedPresets = data || [];
    if (!isPremiumUser && cachedPresets.length >= MEAL_PRESET_FREE_LIMIT) {
        showAppToast(t('preset_limit_desc'), 'error');
        openPremiumUpgradeModal();
        return;
    }
    cancelPresetEdit();
    document.getElementById('new-preset-name').value = nmItemShort(it);
    document.getElementById('new-preset-calories').value = it.kcal;
    document.getElementById('new-preset-protein').value = it.protein;
    document.getElementById('new-preset-category').value = NEW_ME_PRESET_CATEGORY_BY_POS[Math.max(0, nmOrder().indexOf(slot))];
    updateCustomSelectDisplay('new-preset-category');
    openModal('modal-add-preset');
    loadPresetManageList();
}

// ---------- ארוחה חופשית מתוכננת (פעם בשבוע, במקום ארוחה, עד ~700 קל') ----------
// אפשר לתכנן עד שבוע קדימה (היום + 6 ימים, גם אל תוך השבוע הבא - לפי בקשה מפורשת, כדי שבסוף
// שבוע לא יוצע רק "היום"). הכלל נשאר אחת לכל שבוע ראשון-שבת: בחירת יום אחר באותו שבוע מעבירה אליו
function nmWeekStartOf(ds) { const d = nmDate(ds); d.setDate(d.getDate() - d.getDay()); return getLocalDateString(d); }
function nmFreeRowInWeekOf(ds) {
    const start = nmWeekStartOf(ds), end = nmAddDays(start, 6);
    return nmWeekDays.find(d => d.free_slot && d.day >= start && d.day <= end) || null;
}
function nmWeekFreeRow() { return nmFreeRowInWeekOf(getLocalDateString()); }
function nmFreeHorizonDays() {
    const today = getLocalDateString();
    return Array.from({ length: 7 }, (_, i) => nmAddDays(today, i));
}

function nmFreeMealRowHtml() {
    const today = getLocalDateString();
    const days = nmFreeHorizonDays();
    const parts = [];
    const thisWeek = nmWeekFreeRow();
    if (thisWeek && thisWeek.day < today) parts.push(`<div class="nm-free-note muted">🍕 ${nmEsc(t('nm_free_used').replace('{day}', nmWeekdayName(thisWeek.day)))}</div>`);
    // ארוחות חופשיות שכבר תוכננו לימים הבאים (היום עצמו מוצג בכרטיס הארוחה)
    nmWeekDays.filter(d => d.free_slot && d.day > today && d.day <= days[days.length - 1]).sort((a, b) => a.day.localeCompare(b.day)).forEach(row => {
        const meal = nmSlotName(row.free_slot);
        parts.push(`<div class="nm-free-note">🍕 ${nmEsc(t('nm_free_planned_for').replace('{day}', nmWeekdayName(row.day)).replace('{meal}', meal))}
            <button type="button" class="nm-link-btn" onclick="nmCancelFreeMeal('${row.day}')">${nmEsc(t('nm_free_cancel'))}</button></div>`);
    });
    // הכפתור מוצג כל עוד יש בשבוע הקרוב יום ששבוע שלו עוד בלי ארוחה חופשית
    if (days.some(ds => !nmFreeRowInWeekOf(ds))) {
        parts.push(`<button type="button" class="nm-free-plan-btn" onclick="nmOpenFreeMealSheet()">
            <span class="nm-free-plan-icon" aria-hidden="true">🍕</span>
            <span class="nm-free-plan-text"><b>${nmEsc(t('nm_free_plan_btn'))}</b><span>${nmTpl('nm_free_plan_sub', { kcal: nmFmt(NEW_ME_FREE_MEAL_KCAL) })}</span></span>
        </button>`);
    }
    return parts.join('');
}

function nmOpenFreeMealSheet() {
    const today = getLocalDateString();
    const days = nmFreeHorizonDays();
    const order = nmOrder();
    let selDay = days.find(ds => !nmFreeRowInWeekOf(ds)) || today;
    let selSlot = order.find(s => !nmTodayCheckins[s]) || order[order.length - 1];
    const ov = nmOpenSheet('', 'nm-free-sheet');
    const sheet = ov.querySelector('.nm-sheet');
    const render = () => {
        sheet.innerHTML = `
            <span class="nm-sheet-grip" aria-hidden="true"></span>
            <h4>🍕 ${nmEsc(t('nm_free_plan_btn'))}</h4>
            <p class="nm-fine">${nmEsc(t('nm_free_sheet_hint').replace('{kcal}', nmFmt(NEW_ME_FREE_MEAL_KCAL)))}</p>
            <div class="nm-sheet-label">${nmEsc(t('nm_free_which_day'))}</div>
            <div class="nm-chip-row">${days.map(ds => {
                const isFree = !!nmWeekDays.find(d => d.day === ds && d.free_slot);
                return `<button type="button" class="nm-pick${ds === selDay ? ' on' : ''}" data-day="${ds}">${isFree ? '🍕 ' : ''}${nmEsc(ds === today ? t('nm_today') : nmWeekdayName(ds))}</button>`;
            }).join('')}</div>
            <div class="nm-sheet-label">${nmEsc(t('nm_free_which_meal'))}</div>
            <div class="nm-chip-row">${order.map(s => {
                const blocked = selDay === today && nmTodayCheckins[s];
                return `<button type="button" class="nm-pick${s === selSlot ? ' on' : ''}" data-slot="${s}" ${blocked ? 'disabled' : ''}>${nmEsc(nmSlotName(s))}</button>`;
            }).join('')}</div>
            <button type="button" class="nm-btn-primary" data-save>${nmEsc(t('nm_free_confirm'))}</button>
            <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_back'))}</button>`;
        sheet.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => {
            selDay = b.dataset.day;
            if (selDay === today && nmTodayCheckins[selSlot]) selSlot = order.find(s => !nmTodayCheckins[s]) || selSlot;
            render();
        }));
        sheet.querySelectorAll('[data-slot]').forEach(b => b.addEventListener('click', () => { selSlot = b.dataset.slot; render(); }));
        sheet.querySelector('[data-save]').addEventListener('click', async () => { ov.remove(); await nmPlanFreeMeal(selDay, selSlot); });
    };
    render();
}

async function nmPlanFreeMeal(day, slot) {
    const today = getLocalDateString();
    // אחת לשבוע: ארוחה חופשית שכבר תוכננה ליום אחר באותו שבוע עוברת ליום החדש
    const sameWeek = nmFreeRowInWeekOf(day);
    if (sameWeek && sameWeek.day !== day) {
        if (sameWeek.day === today && nmTodayCheckins[sameWeek.free_slot]) await nmUncheck(sameWeek.free_slot);
        await nmUpsertDay(sameWeek.day, { free_slot: null, free_text: null, free_kcal: null });
    }
    if (day === today && nmTodayCheckins[slot]) await nmUncheck(slot);
    const saved = await nmUpsertDay(day, { free_slot: slot, free_text: null, free_kcal: null });
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
    if (!saved) return;
    showAppToast(t(day === today ? 'nm_free_set_today' : 'nm_free_set_later').replace('{day}', nmWeekdayName(day)));
    if (nmProfile.reminders_on) nmSyncReminders();
}

async function nmCancelFreeMeal(day) {
    const row = day ? nmWeekDays.find(d => d.day === day && d.free_slot) : nmWeekFreeRow();
    if (!row) return;
    if (row.day === getLocalDateString() && nmTodayCheckins[row.free_slot]) await nmUncheck(row.free_slot);
    await nmUpsertDay(row.day, { free_slot: null, free_text: null, free_kcal: null });
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
    if (nmProfile.reminders_on) nmSyncReminders();
}

async function nmSaveFreeDetails(slot, input) {
    const card = input.closest('.nm-meal');
    const text = card.querySelector('.nm-free-text').value.trim().slice(0, 120);
    const kcalRaw = card.querySelector('.nm-free-kcal').value;
    const kcal = kcalRaw === '' ? null : Math.max(0, Math.min(2500, parseInt(kcalRaw, 10) || 0));
    await nmUpsertDay(getLocalDateString(), { free_text: text || null, free_kcal: kcal });
    nmRenderView(nmRoot());
}

// ---------- צ'ק-אין ערב (מ-19:30): רעב, אנרגיה, מצב רוח ----------
function nmCheckinOpen() { return nmMinutesNow() >= NEW_ME_CHECKIN_FROM_MIN; }
function nmCheckinHtml() {
    const done = !!(nmToday && nmToday.checkin_at);
    if (!done && !nmCheckinOpen()) return '';
    if (done && !nmCheckinEditing) {
        return `
            <div class="nm-checkin done" id="nm-checkin">
                <div class="nm-checkin-head"><span>🌙 ${nmEsc(t('nm_checkin_saved_title'))}</span><button type="button" class="nm-link-btn" onclick="nmEditCheckin()">${nmEsc(t('nm_edit'))}</button></div>
                <div class="nm-checkin-pills">${NEW_ME_CHECKIN_KEYS.map(k => `<span class="nm-checkin-pill"><span aria-hidden="true">${NEW_ME_CHECKIN_SCALES[k][(nmToday[k] || 3) - 1]}</span>${nmEsc(t('nm_checkin_' + k))}</span>`).join('')}</div>
                <button type="button" class="nm-link-btn nm-checkin-link" onclick="nmGo('month')">${nmEsc(t('nm_checkin_see_link'))} <span class="nm-chev" aria-hidden="true">›</span></button>
            </div>`;
    }
    if (!nmCheckinDraft) nmCheckinDraft = { hunger: (nmToday && nmToday.hunger) || 0, energy: (nmToday && nmToday.energy) || 0, mood: (nmToday && nmToday.mood) || 0 };
    const d = nmCheckinDraft;
    return `
        <div class="nm-checkin" id="nm-checkin">
            <div class="nm-checkin-head"><span>🌙 ${nmEsc(t('nm_checkin_title'))}</span></div>
            <p class="nm-fine">${nmEsc(t('nm_checkin_sub'))}</p>
            ${NEW_ME_CHECKIN_KEYS.map(k => `
                <div class="nm-checkin-q">
                    <div class="nm-checkin-label">${nmEsc(t('nm_checkin_' + k))}</div>
                    <div class="nm-scale" role="radiogroup" aria-label="${nmEsc(t('nm_checkin_' + k))}">
                        ${NEW_ME_CHECKIN_SCALES[k].map((e, i) => `<button type="button" role="radio" aria-checked="${d[k] === i + 1}" aria-label="${i + 1}" class="nm-scale-btn${d[k] === i + 1 ? ' on' : ''}" onclick="nmSetCheckinValue('${k}', ${i + 1})">${e}</button>`).join('')}
                    </div>
                    <div class="nm-scale-ends"><span>${nmEsc(t('nm_checkin_' + k + '_low'))}</span><span>${nmEsc(t('nm_checkin_' + k + '_high'))}</span></div>
                </div>`).join('')}
            <button type="button" class="nm-btn-primary" onclick="nmSaveCheckin(this)" ${d.hunger && d.energy && d.mood ? '' : 'disabled'}>${nmEsc(t('nm_checkin_save'))}</button>
        </div>`;
}
function nmReplaceCheckinCard() {
    const el = document.getElementById('nm-checkin');
    if (el) el.outerHTML = nmCheckinHtml() || '';
}
function nmSetCheckinValue(k, v) { nmCheckinDraft[k] = v; nmReplaceCheckinCard(); }
function nmEditCheckin() { nmCheckinEditing = true; nmCheckinDraft = null; nmReplaceCheckinCard(); }
async function nmSaveCheckin(btn) {
    const d = nmCheckinDraft;
    if (!d || !d.hunger || !d.energy || !d.mood) return;
    if (btn) btn.disabled = true;
    const saved = await nmUpsertDay(getLocalDateString(), { hunger: d.hunger, energy: d.energy, mood: d.mood, checkin_at: new Date().toISOString() });
    if (!saved) { if (btn) btn.disabled = false; return; }
    nmCheckinEditing = false;
    nmCheckinDraft = null;
    showAppToast(t('nm_checkin_saved_toast'));
    await nmLoadJourney();
    nmReplaceCheckinCard();
    nmAwardBadges();
}

// ---------- תמונה שבועית: תזכורת עדינה במסך הראשי ----------
function nmPhotoNudgeHtml() {
    if (nmLastPhotoDay && nmDaysBetween(nmLastPhotoDay, getLocalDateString()) < 7) return '';
    let dismissed = null;
    try { dismissed = localStorage.getItem('weekwise_nm_photo_nudge_week'); } catch { /* ok */ }
    if (dismissed === nmWeekStart()) return '';
    return `
        <div class="nm-nudge">
            <button type="button" class="nm-nudge-main" onclick="nmGo('photos')">
                <span class="nm-nudge-icon" aria-hidden="true">📸</span>
                <span class="nm-nudge-text"><b>${nmEsc(t(nmLastPhotoDay ? 'nm_photo_nudge_title' : 'nm_photo_nudge_first'))}</b><span>${nmEsc(t('nm_photo_nudge_sub'))}</span></span>
            </button>
            <button type="button" class="nm-nudge-x" onclick="nmDismissPhotoNudge(this)" aria-label="${nmEsc(t('nm_remove'))}">✕</button>
        </div>`;
}
function nmDismissPhotoNudge(btn) {
    try { localStorage.setItem('weekwise_nm_photo_nudge_week', nmWeekStart()); } catch { /* ok */ }
    const el = btn.closest('.nm-nudge');
    if (el) el.remove();
}

// ---------- שתייה (הוספה ידנית, לפחות 3 ביום, כולן יחד עד ~150 קל') ----------
// כל משקה = שורה משלו ב-calorie_tracker עם meal_type=nm_drink_N (source='new_me'), כך
// שנספר בהצצה להיום ובמעקב הארוחות כמו כל דבר אחר
// כל רינדור מחדש (הוספת משקה, ✓ על ארוחה...) בונה את הכרטיס מאפס - בלי זה
// כל מה שהוקלד בשורות אחרות ועוד לא נוסף היה נמחק (וגם הפוקוס והסמן)
let nmDraftFocus = null;
function nmCaptureDrinkDrafts() {
    const root = nmRoot();
    const rows = root ? root.querySelectorAll('.nm-drink-draft') : [];
    if (!rows.length) return;
    const active = document.activeElement;
    const activeRow = active && active.closest ? active.closest('.nm-drink-draft') : null;
    nmDraftFocus = activeRow && root.contains(activeRow)
        ? { id: activeRow.dataset.draftId, cls: active.classList[0], pos: typeof active.selectionStart === 'number' ? active.selectionStart : null }
        : null;
    nmDrinkDraftsCache = Array.from(rows).map(row => {
        const kcalEl = row.querySelector('.nm-drink-kcal');
        const milkEl = row.querySelector('.nm-drink-milk');
        return {
            id: row.dataset.draftId,
            kind: row.dataset.kind,
            name: row.querySelector('.nm-drink-input').value,
            milk: milkEl ? milkEl.value : '',
            kcal: kcalEl.value,
            manual: kcalEl.dataset.manual === '1',
            ai: kcalEl.dataset.ai === '1',
            protein: row.dataset.protein || '',
        };
    }).filter(d => d.name.trim() || d.milk.trim() || d.kcal !== '');
}
function nmRestoreDrinkDrafts() {
    const root = nmRoot();
    if (!root) return;
    const moreBtn = root.querySelector('.nm-drinks .nm-link-btn');
    const isEmpty = row => !row.querySelector('.nm-drink-input').value && !row.querySelector('.nm-drink-kcal').value && !(row.querySelector('.nm-drink-milk') || {}).value;
    const used = new Set();
    nmDrinkDraftsCache.forEach(d => {
        const rows = Array.from(root.querySelectorAll('.nm-drink-draft'));
        let row = rows.find(r => !used.has(r) && r.dataset.kind === d.kind && isEmpty(r));
        if (!row && moreBtn) {
            moreBtn.insertAdjacentHTML('beforebegin', nmDrinkDraftRowHtml(d.kind));
            row = Array.from(root.querySelectorAll('.nm-drink-draft')).pop();
        }
        if (!row) return;
        used.add(row);
        row.dataset.draftId = d.id;
        const kcalEl = row.querySelector('.nm-drink-kcal');
        const milkEl = row.querySelector('.nm-drink-milk');
        row.querySelector('.nm-drink-input').value = d.name;
        if (milkEl) milkEl.value = d.milk;
        kcalEl.value = d.kcal;
        if (d.manual) kcalEl.dataset.manual = '1';
        if (d.ai) kcalEl.dataset.ai = '1';
        if (d.protein) row.dataset.protein = d.protein;
    });
    if (nmDraftFocus) {
        const row = root.querySelector(`.nm-drink-draft[data-draft-id="${nmDraftFocus.id}"]`);
        const el = row && nmDraftFocus.cls ? row.querySelector('.' + nmDraftFocus.cls) : null;
        if (el) {
            el.focus({ preventScroll: true });
            if (nmDraftFocus.pos !== null && el.setSelectionRange) { try { el.setSelectionRange(nmDraftFocus.pos, nmDraftFocus.pos); } catch {} }
        }
        nmDraftFocus = null;
    }
}

// שורת הזנה: 'plain' = משקה רגיל, 'milk' = קפה/תה עם שדה חלב מתחת לשם
let nmDraftSeq = 0;
function nmDrinkDraftRowHtml(kind) {
    const milk = kind === 'milk';
    return `
                <div class="nm-drink-row nm-drink-draft${milk ? ' has-milk' : ''}" data-kind="${milk ? 'milk' : 'plain'}" data-draft-id="d${++nmDraftSeq}" onfocusout="nmDraftFocusOut(this)">
                    <input type="text" class="nm-drink-input" maxlength="60" placeholder="${nmEsc(t(milk ? 'nm_drink_hot_ph' : 'nm_drink_name_ph'))}" oninput="nmDrinkNameTyped(this)" onkeydown="if (event.key === 'Enter') nmAddDrink(this)">
                    <input type="number" class="nm-drink-kcal" inputmode="numeric" min="0" max="1500" placeholder="${nmEsc(t('calories_unit'))}" oninput="this.dataset.manual = '1'">
                    <button type="button" class="nm-star" onclick="nmSaveDraftAsRegular(this)" title="${nmEsc(t('nm_drink_save_fav'))}" aria-label="${nmEsc(t('nm_drink_save_fav'))}">${nmStarSvg(false)}</button>
                    <button type="button" class="nm-chip" onclick="nmAddDrink(this)">${nmEsc(t('nm_drink_add'))}</button>
                    ${milk ? `<input type="text" class="nm-drink-milk" maxlength="30" placeholder="${nmEsc(t('nm_drink_milk_ph'))}" oninput="nmDrinkNameTyped(this)" onkeydown="if (event.key === 'Enter') nmAddDrink(this)" aria-label="${nmEsc(t('nm_drink_milk_ph'))}">` : ''}
                </div>`;
}
// "+ עוד משקה" מוסיף שורה רגילה במקום, בלי לבנות את הכרטיס מחדש
function nmAddDrinkRow(btn) {
    nmDrinkDraftRows++;
    btn.insertAdjacentHTML('beforebegin', nmDrinkDraftRowHtml('plain'));
    const rows = btn.parentElement.querySelectorAll('.nm-drink-draft');
    rows[rows.length - 1].querySelector('.nm-drink-input').focus();
}

// שם המשקה כפי שנשלח ל-AI ונשמר: "קפה (חלב: קצת)" כשהוקלד חלב
function nmDrinkFullName(row) {
    const name = row.querySelector('.nm-drink-input').value.trim();
    const milkEl = row.querySelector('.nm-drink-milk');
    const milk = milkEl ? milkEl.value.trim() : '';
    return name && milk ? `${name} (${t('nm_drink_milk_word')}: ${milk})` : name;
}

// שמירה אוטומטית: משקה עם שם + קלוריות נוסף לבד כשעוזבים את השורה (או את
// הדף) - דווח שמשקה "נוסף" אבל לא נשמר כי לא לחצו על "הוספה"
function nmDraftFocusOut(row) {
    setTimeout(() => {
        if (!row.isConnected || row.contains(document.activeElement)) return;
        nmMaybeAutoCommit(row);
    }, 300);
}
function nmMaybeAutoCommit(row) {
    if (!row.isConnected || row.dataset.committing || row.classList.contains('estimating')) return;
    if (!row.querySelector('.nm-drink-input').value.trim() || row.querySelector('.nm-drink-kcal').value === '') return;
    nmAddDrink(row.querySelector('.nm-chip'));
}
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    const root = nmRoot();
    if (root) root.querySelectorAll('.nm-drink-draft').forEach(nmMaybeAutoCommit);
});

// ☆ בשורת הזנה - שומר כמשקה קבוע (כפתור בראש הכרטיס, לחיצה אחת מוסיפה) בלי לרשום להיום
async function nmSaveDraftAsRegular(btn) {
    const row = btn.closest('.nm-drink-draft');
    if (!row.querySelector('.nm-drink-input').value.trim()) { showAppToast(t('nm_drink_missing'), 'error'); return; }
    const kcalEl = row.querySelector('.nm-drink-kcal');
    row.dataset.committing = '1';
    btn.disabled = true;
    clearTimeout(row._nmTimer);
    if (kcalEl.value === '') await nmEstimateDrink(row);
    const kcal = parseInt(kcalEl.value, 10);
    if (!(kcal >= 0)) {
        delete row.dataset.committing;
        btn.disabled = false;
        showAppToast(t('nm_drink_est_failed'), 'error');
        return;
    }
    const name = nmDrinkFullName(row);
    if (!nmSavedDrinks.some(s => s.name.trim().toLowerCase() === name.toLowerCase())) {
        const { error } = await supabaseClient.from('new_me_saved_drinks').insert({ user_id: currentUserId, name, kcal });
        if (error) { delete row.dataset.committing; btn.disabled = false; showAppToast(t('nm_save_error'), 'error'); return; }
    }
    showAppToast(t('nm_drink_saved_toast'));
    row.querySelectorAll('input').forEach(input => { input.value = ''; });
    await nmLoadToday();
    nmRenderView(nmRoot());
}

// כוכב מצויר (לא תו ☆) - תו הכוכב יושב לא ממורכז בעיגול בחלק מהגופנים
function nmStarSvg(filled) {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83-5.38 2.83 1.03-6L3.3 9.6l6-.9z" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`;
}
function nmDrinkName(r) { return String(r.food_description || '').replace(/^🥤\s*/, ''); }

// כרטיס השתייה סגור כברירת מחדל (לפי בקשה מפורשת - "תופס מלא מקום"): בכותרת השם והסכום,
// ולחיצה פותחת. נשאר פתוח בזמן העבודה (גם אחרי רינדור מחדש), ובכניסה הבאה שוב סגור
let nmDrinksOpen = false;
function nmToggleDrinks(btn) {
    nmDrinksOpen = !nmDrinksOpen;
    const card = btn.closest('.nm-drinks');
    card.classList.toggle('open', nmDrinksOpen);
    btn.setAttribute('aria-expanded', String(nmDrinksOpen));
}
function nmDrinksHtml() {
    const drinks = nmTrackerToday.filter(nmIsDrinkRow);
    const total = drinks.reduce((a, r) => a + (Number(r.calories) || 0), 0);
    const over = total > NEW_ME_DRINKS_KCAL;
    const savedNames = new Set(nmSavedDrinks.map(s => s.name.trim().toLowerCase()));
    return `
        <div class="nm-meal nm-drinks${nmDrinksOpen ? ' open' : ''}">
            <button type="button" class="nm-meal-head nm-drinks-toggle" aria-expanded="${nmDrinksOpen}" onclick="nmToggleDrinks(this)">
                <span class="nm-slot-name">🥤 ${nmEsc(t('nm_slot_drinks'))}</span>
                <span class="nm-head-space"></span>
                <span class="nm-drinks-total${over ? ' over' : ''}"><bdi dir="ltr">${nmFmt(total)} / ~${NEW_ME_DRINKS_KCAL}</bdi> ${nmEsc(t('calories_unit'))}</span>
                <span class="nm-drinks-chev" aria-hidden="true"></span>
            </button>
            <div class="nm-drinks-body">
            <div class="nm-fine">${nmEsc(t('nm_drinks_hint').replace('{kcal}', NEW_ME_DRINKS_KCAL))}</div>
            ${nmSavedDrinks.length ? '' : `<div class="nm-fine nm-saved-empty">${nmEsc(t('nm_drink_saved_empty_hint'))}</div>`}
            ${nmSavedDrinks.length ? `
            <div class="nm-saved-drinks">
                <span class="nm-saved-drinks-title">⭐ ${nmEsc(t('nm_drink_saved_title'))}</span>
                <div class="nm-saved-drinks-chips">
                    ${nmSavedDrinks.map(s => `
                        <span class="nm-saved-chip">
                            <button type="button" class="nm-saved-chip-add" onclick="nmAddSavedDrink('${s.id}', this)">${nmEsc(s.name)} · <bdi dir="ltr">${Number(s.kcal) || 0}</bdi></button>
                            <button type="button" class="nm-saved-chip-x" onclick="nmDeleteSavedDrink('${s.id}')" aria-label="${nmEsc(t('nm_remove'))}">×</button>
                        </span>`).join('')}
                </div>
            </div>` : ''}
            ${drinks.map(r => {
                const name = nmDrinkName(r);
                const isSaved = savedNames.has(name.trim().toLowerCase());
                return `
                <div class="nm-drink-row logged" data-slot="${nmEsc(r.meal_type)}">
                    <span class="nm-drink-name">${nmEsc(name)}</span>
                    <input type="number" class="nm-drink-kcal nm-drink-kcal-logged" inputmode="numeric" min="0" max="1500" value="${Number(r.calories) || 0}" onchange="nmUpdateDrinkKcal('${r.id}', this.value)" aria-label="${nmEsc(t('calories_unit'))}">
                    <button type="button" class="nm-star${isSaved ? ' on' : ''}" onclick="nmToggleSaveDrink('${r.id}')" title="${nmEsc(t('nm_drink_save_fav'))}" aria-label="${nmEsc(t('nm_drink_save_fav'))}">${nmStarSvg(isSaved)}</button>
                    <button type="button" class="nm-x" onclick="nmRemoveDrink('${r.id}', this)" aria-label="${nmEsc(t('nm_remove'))}">✕</button>
                </div>`;
            }).join('')}
            ${['plain', 'plain', 'milk', 'milk'].concat(Array(nmDrinkDraftRows).fill('plain')).map(nmDrinkDraftRowHtml).join('')}
            <button type="button" class="nm-link-btn" onclick="nmAddDrinkRow(this)">${nmEsc(t('nm_drink_more'))}</button>
            </div>
        </div>`;
}

// חישוב קלוריות אוטומטי (AI) - המשתמש/ת רק מקליד/ה שם משקה; המספר מתמלא לבד שנייה אחרי
// שמפסיקים להקליד, ונשאר ניתן לעריכה. אם הוקלד מספר ידנית - לא דורסים אותו
async function nmEstimateDrink(row) {
    const kcalEl = row.querySelector('.nm-drink-kcal');
    const drink = nmDrinkFullName(row);
    if (drink.length < 2 || kcalEl.dataset.manual === '1') return null;
    const saved = nmSavedDrinks.find(s => s.name.trim().toLowerCase() === drink.toLowerCase());
    if (saved) { kcalEl.value = saved.kcal; kcalEl.dataset.ai = '1'; return { kcal: saved.kcal, protein_g: 0, name: saved.name }; }
    const requestId = String(Date.now());
    row.dataset.estimate = requestId;
    kcalEl.placeholder = t('nm_drink_estimating');
    row.classList.add('estimating');
    delete row.dataset.estErr;
    try {
        // עד 15 שניות לבקשה, וניסיון נוסף אחד אם פג תוקף ההתחברות (401) - כדי שחישוב
        // לא "ייתקע" בלי שום תגובה
        const callOnce = async () => {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 15000);
            try {
                return await fetch(`${SUPABASE_URL}/functions/v1/new-me-drink-kcal`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ drink, language: currentLang }),
                    signal: controller.signal,
                });
            } finally { clearTimeout(timer); }
        };
        let res = await callOnce();
        if (res.status === 401) {
            await supabaseClient.auth.refreshSession().catch(() => {});
            res = await callOnce();
        }
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.ok) { row.dataset.estErr = String(res.status) + (result.error ? ' ' + result.error : ''); throw new Error(result.error || res.status); }
        // תשובה ישנה (המשתמש/ת המשיך/ה להקליד) או מספר שהוקלד ידנית בינתיים - מתעלמים
        if (row.dataset.estimate !== requestId || kcalEl.dataset.manual === '1') return null;
        kcalEl.value = result.kcal;
        kcalEl.dataset.ai = '1';
        row.dataset.protein = result.protein_g || 0;
        return result;
    } catch (err) {
        if (!row.dataset.estErr) row.dataset.estErr = err && err.name === 'AbortError' ? 'timeout' : 'network';
        return null;
    } finally {
        row.classList.remove('estimating');
        kcalEl.placeholder = t('calories_unit');
        // החישוב הסתיים אחרי שכבר עזבו את השורה - נשמר אוטומטית
        if (!row.contains(document.activeElement)) setTimeout(() => nmMaybeAutoCommit(row), 0);
    }
}

// טיימר לכל שורה בנפרד - הקלדה בשורה אחת לא מבטלת חישוב של שורה אחרת
function nmDrinkNameTyped(input) {
    const row = input.closest('.nm-drink-row');
    const kcalEl = row.querySelector('.nm-drink-kcal');
    if (kcalEl.dataset.ai === '1') { kcalEl.value = ''; delete kcalEl.dataset.ai; }
    clearTimeout(row._nmTimer);
    row._nmTimer = setTimeout(() => nmEstimateDrink(row), 900);
}

function nmNextDrinkSlot() {
    const used = new Set(nmTrackerToday.filter(nmIsDrinkRow).map(r => r.meal_type));
    let n = 1;
    while (used.has('nm_drink_' + n)) n++;
    return 'nm_drink_' + n;
}

// הוספות רצות בתור אחת אחרי השנייה - כך ש-nm_drink_N לא יחושב פעמיים לאותו מספר
let nmDrinkInsertQueue = Promise.resolve();
function nmInsertDrink(name, kcal, protein) {
    const job = nmDrinkInsertQueue.then(async () => {
        const slot = nmNextDrinkSlot();
        const { error } = await supabaseClient.from('calorie_tracker').insert({
            username: currentUsername, user_id: currentUserId, date: getLocalDateString(), meal_type: slot,
            food_description: '🥤 ' + name, calories: kcal, protein_grams: protein || 0, source: 'new_me',
        });
        if (error) { showAppToast(t('nm_save_error'), 'error'); return false; }
        await nmLoadToday();
        nmRenderView(nmRoot());
        nmAfterTrackerChange();
        // אישור ברור + הדגשה של המשקה שנוסף (הוא עובר לרשימה למעלה והשורה מתרוקנת -
        // דווח שזה נראה כאילו לא נוסף, והוא נוסף פעמיים)
        showAppToast(t('nm_drink_added_toast').replace('{name}', name).replace('{kcal}', kcal));
        const added = document.querySelector(`#new-me-root .nm-drink-row.logged[data-slot="${slot}"]`);
        if (added) added.classList.add('just-added');
        return true;
    });
    nmDrinkInsertQueue = job.catch(() => false);
    return job;
}

async function nmAddDrink(el) {
    const row = el.closest('.nm-drink-row');
    if (row.dataset.committing) return;
    const btn = row.querySelector('.nm-chip');
    const kcalEl = row.querySelector('.nm-drink-kcal');
    if (!row.querySelector('.nm-drink-input').value.trim()) { showAppToast(t('nm_drink_missing'), 'error'); return; }
    row.dataset.committing = '1';
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }
    clearTimeout(row._nmTimer);
    // אם הקלוריות עוד לא חושבו - מחשבים עכשיו, לפני ההוספה
    if (kcalEl.value === '') await nmEstimateDrink(row);
    const kcal = parseInt(kcalEl.value, 10);
    if (!(kcal >= 0)) {
        delete row.dataset.committing;
        if (btn) { btn.disabled = false; btn.textContent = t('nm_drink_add'); }
        showAppToast(t('nm_drink_est_failed') + (row.dataset.estErr ? ` (${row.dataset.estErr})` : ''), 'error');
        kcalEl.focus();
        return;
    }
    const name = nmDrinkFullName(row);
    const protein = parseFloat(row.dataset.protein) || 0;
    const values = Array.from(row.querySelectorAll('input')).map(input => input.value);
    // מרוקנים את השורה לפני הרינדור הבא, כדי שלא תישמר כטיוטה
    row.querySelectorAll('input').forEach(input => { input.value = ''; });
    const ok = await nmInsertDrink(name, kcal, protein);
    if (!ok) {
        // השמירה נכשלה - מחזירים את מה שהוקלד
        if (row.isConnected) row.querySelectorAll('input').forEach((input, i) => { input.value = values[i]; });
        delete row.dataset.committing;
        if (btn) { btn.disabled = false; btn.textContent = t('nm_drink_add'); }
        return;
    }
    if (nmDrinkDraftRows > 0 && row.dataset.kind === 'plain') nmDrinkDraftRows--;
}

async function nmAddSavedDrink(id, btn) {
    const s = nmSavedDrinks.find(x => x.id === id);
    if (!s) return;
    if (btn) btn.disabled = true;
    await nmInsertDrink(s.name, Number(s.kcal) || 0, 0);
}

async function nmUpdateDrinkKcal(id, value) {
    const kcal = Math.max(0, Math.min(1500, parseInt(value, 10) || 0));
    await supabaseClient.from('calorie_tracker').update({ calories: kcal }).eq('id', id).eq('user_id', currentUserId);
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
}

// ☆/★ על משקה שנרשם - שמירה/הסרה מהמשקאות הקבועים (לפי השם)
async function nmToggleSaveDrink(trackerId) {
    const r = nmTrackerToday.find(x => x.id === trackerId);
    if (!r) return;
    const name = nmDrinkName(r).trim();
    const existing = nmSavedDrinks.find(s => s.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
        await supabaseClient.from('new_me_saved_drinks').delete().eq('id', existing.id).eq('user_id', currentUserId);
    } else {
        await supabaseClient.from('new_me_saved_drinks').insert({ user_id: currentUserId, name, kcal: Number(r.calories) || 0 });
        showAppToast(t('nm_drink_saved_toast'));
    }
    await nmLoadToday();
    nmRenderView(nmRoot());
}

async function nmDeleteSavedDrink(id) {
    await supabaseClient.from('new_me_saved_drinks').delete().eq('id', id).eq('user_id', currentUserId);
    await nmLoadToday();
    nmRenderView(nmRoot());
}

async function nmRemoveDrink(id, btn) {
    if (btn) btn.disabled = true;
    await supabaseClient.from('calorie_tracker').delete().eq('id', id).eq('user_id', currentUserId);
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
}
// מה שנוסף היום מחוץ לתוכנית (מעקב הארוחות / הוספה מהירה) - כבר נספר בטבעת
function nmExtrasHtml() {
    const planTypes = {};
    Object.values(nmTodayCheckins).forEach(r => { planTypes[NEW_ME_TRACKER_SLOT[r.slot]] = r; });
    const rows = nmTrackerToday.filter(r => !nmIsDrinkRow(r) && (r.source !== 'new_me' || nmIsExtraRow(r))).map(r => {
        if (nmIsExtraRow(r)) return { desc: r.food_description, kcal: Number(r.calories) || 0, id: r.id };
        const merged = planTypes[r.meal_type];
        const kcal = (Number(r.calories) || 0) - (merged && merged.mirror_mode === 'merged' ? (merged.kcal || 0) : 0);
        const desc = merged && merged.mirror_text ? String(r.food_description || '').split(` + ${merged.mirror_text}`).join('') : r.food_description;
        return { desc, kcal };
    }).filter(x => x.kcal > 0 || (x.desc && x.desc.trim()));
    const addBtn = `<button type="button" class="nm-add-food" onclick="nmOpenAddFood()">➕ ${nmEsc(t('nm_add_food'))}</button>`;
    if (!rows.length) return `<div class="nm-extras">${addBtn}</div>`;
    return `
        <div class="nm-extras">
            <div class="nm-slot-name">➕ ${nmEsc(t('nm_extras_title'))}</div>
            ${rows.map(x => `<div class="nm-extra-row"><span>${nmEsc(x.desc || '')}</span><span class="nm-option-meta"><bdi dir="ltr">${x.kcal}</bdi> ${nmEsc(t('calories_unit'))}${x.id ? `<button type="button" class="nm-extra-x" onclick="nmRemoveExtra('${nmEsc(x.id)}')" aria-label="${nmEsc(t('daily_board_delete_item_btn'))}" title="${nmEsc(t('daily_board_delete_item_btn'))}">✕</button>` : ''}</span></div>`).join('')}
            <div class="nm-fine">${nmEsc(t('nm_extras_hint'))}</div>
            ${addBtn}
        </div>`;
}
// ➕ אוכל שלא בתפריט (לפי בקשה מפורשת: "תעשה אפשרות שאנשים יוסיפו לבד מה הם רוצים לאכול... והחישוב גם יעשה עם הAI"):
// כותבים מה אכלו, ה-AI מחשב קלוריות וחלבון, ונכנס להיום - שורה משלו ב-calorie_tracker (meal_type=nm_extra_*), כמו המשקאות
function nmIsExtraRow(r) { return String(r.meal_type || '').startsWith('nm_extra'); }
function nmOpenAddFood() {
    let text = '', res = null, busy = false;
    const ov = nmOpenSheet('', 'nm-addfood-sheet');
    const sheet = ov.querySelector('.nm-sheet');
    const render = () => {
        sheet.innerHTML = `
            <span class="nm-sheet-grip" aria-hidden="true"></span>
            <h4>➕ ${nmEsc(t('nm_add_food'))}</h4>
            <textarea class="nm-ai-input" rows="3" maxlength="300" placeholder="${nmEsc(t('nm_add_food_ph'))}" aria-label="${nmEsc(t('nm_add_food'))}">${nmEsc(text)}</textarea>
            <button type="button" class="nm-btn-primary" data-estimate ${busy ? 'disabled' : ''}>${nmEsc(t(busy ? 'nm_swap_ai_busy' : 'nm_swap_ai_go'))}</button>
            ${res ? `<div class="nm-swap-pick nm-ai-result">
                <span class="nm-option-name">✨ ${nmEsc(res.name)}</span>
                <span class="nm-option-meta">${nmMeta({ kcal: res.kcal, protein: Math.round(res.protein) })}${res.rough ? ` · ${nmEsc(t('nm_swap_ai_rough'))}` : ''}</span>
                <button type="button" class="nm-btn-primary" data-add>${nmEsc(t('nm_add_food_add'))}</button>
            </div>` : ''}
            <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_back'))}</button>`;
        const ta = sheet.querySelector('.nm-ai-input');
        ta.addEventListener('input', () => { text = ta.value; });
        sheet.querySelector('[data-estimate]').addEventListener('click', async () => {
            if (text.trim().length < 2) { showAppToast(t('quick_add_missing_text'), 'error'); return; }
            busy = true; res = null; render();
            res = await nmEstimateMeal(text.trim(), 0);
            busy = false;
            if (ov.isConnected) render();
        });
        const add = sheet.querySelector('[data-add]');
        if (add) add.addEventListener('click', async () => {
            add.disabled = true;
            if (await nmAddExtraFood(res)) { ov.remove(); showAppToast(t('nm_add_food_done')); } else add.disabled = false;
        });
    };
    render();
}
async function nmAddExtraFood(r) {
    if (!r || !(r.kcal > 0) || !supabaseClient || !currentUserId) return false;
    const { error } = await supabaseClient.from('calorie_tracker').insert({
        username: currentUsername, user_id: currentUserId, date: getLocalDateString(), meal_type: `nm_extra_${Date.now()}`,
        food_description: `✨ ${String(r.name || '').slice(0, 120)}`, calories: Math.round(r.kcal), protein_grams: Math.round((Number(r.protein) || 0) * 10) / 10, source: 'new_me',
    });
    if (error) { showAppToast(t('nm_save_error'), 'error'); return false; }
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
    return true;
}
async function nmRemoveExtra(id) {
    if (!id || !supabaseClient) return;
    const { error } = await supabaseClient.from('calorie_tracker').delete().eq('id', id).eq('user_id', currentUserId).like('meal_type', 'nm_extra%');
    if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
}

// ---------- New Me (💎) במסך הבית: האריח במגירת "היום שלי" ----------
// למי שרכש/ה - הארוחה הבאה של היום; למי שלא - נעול, "גרסה חדשה של עצמי" (לפי בחירה מפורשת: New Me
// גם במסך הבית, נעול למי שלא קנה). הנתונים של היום נטענים פעם אחת ביום גם בלי לפתוח את New Me,
// כדי שהארוחות יופיעו בציר הזמן של "היום שלי"
let nmHomeDataDay = null;
async function nmEnsureHomeData() {
    if (!hasNewMe || !supabaseClient || !currentUserId) return false;
    const today = getLocalDateString();
    if (nmHomeDataDay === today && nmProfileLoaded) return true;
    nmHomeDataDay = today;
    if (!nmProfileLoaded) {
        const { data } = await supabaseClient.from('new_me_profile').select('*').eq('user_id', currentUserId).maybeSingle();
        nmProfile = data || null;
        nmProfileLoaded = true;
    }
    if (!nmProfile) return false;
    await nmLoadToday();
    return true;
}
// הארוחות של היום לציר הזמן: { time, text, done, toggle(checked) } - רק כשהנתונים כבר טעונים
function myDayNewMeItems(evenWithoutSync) {
    if (!hasNewMe || !nmProfile || nmHomeDataDay !== getLocalDateString() || (!evenWithoutSync && !nmRoutineSyncOn())) return [];
    const items = nmActiveOrder().map(slot => {
        const free = nmIsFree(slot);
        const text = free ? `🍕 ${t('nm_free_meal')}` : `${nmSlotName(slot)} · ${nmItemShort(nmItemInfo(nmTodayKey(slot)))}`;
        return {
            time: nmSlotReminderTime(slot), text, done: !!nmTodayCheckins[slot],
            toggle: async checked => { if (!!nmTodayCheckins[slot] !== checked) await nmToggleCheck(slot); nmRenderHomeTile(); if (typeof loadTodayTasks === 'function') loadTodayTasks(); },
        };
    });
    // 🕐 הארוחה הקטנה הנוספת - בשעה שלה
    if (nmSideOn()) items.push({
        time: nmSideTime(), text: `${t('nm_side_title')} · ${nmSideInfo().name}`, done: !!nmSideRow(),
        toggle: async checked => { if (!!nmSideRow() !== checked) await nmToggleSide(); nmRenderHomeTile(); if (typeof loadTodayTasks === 'function') loadTodayTasks(); },
    });
    return items;
}
// 💎 במסך הבית - כפתור קטן ליד הפוקוס, רק למי שרכש/ה (לפי בקשה מפורשת: "מי שלא קנה - שלא יהיה על המסך, רק
// בהמבורגר"; ו-2026-10-11: "שיהיה ליד מצב הפוקוס... אני רוצה נקי"). הארוחה הבאה - בתווית (ובציר של "היום שלי")
function nmRenderHomeTile() {
    const btn = document.getElementById('btn-newme-shortcut');
    if (!btn) return;
    btn.classList.toggle('hidden', !hasNewMe);
    if (!hasNewMe) return;
    const next = myDayNewMeItems(true).find(m => !m.done);
    const label = next ? `${t('nm_shortcut_title')} · ${next.time} ${next.text}` : t('nm_shortcut_title');
    btn.setAttribute('aria-label', label);
    btn.title = label;
}
function openNewMeFromHome() {
    if (hasNewMe) openNewMeMenuToday();
    else openNewMe();
}
// ---------- 📔 היומן בתפריט הראשי ----------
// לפי בקשה מפורשת: "שבNEW ME תהיה אפשרות להוסיף אך ורק את היומן לתפריט הראשי בבחירת המשתמש" - "ברגע שהוא נפתח כמובן":
// המתג מופיע רק כשהיומן כבר פתוח בחדר (ביומן עצמו ובהגדרות של New Me). נשמר בחשבון (new_me_room.diary_in_menu) ובמכשיר -
// שהפריט יופיע בתפריט מיד, עוד לפני שהחדר נטען
function nmDiaryMenuKey() { return `weekwise_diary_in_menu_${currentUserId}`; }
function nmDiaryInMenu() {
    if (typeof roomState !== 'undefined' && roomState && roomState.diary_in_menu != null) return !!roomState.diary_in_menu;
    try { return localStorage.getItem(nmDiaryMenuKey()) === '1'; } catch { return false; }
}
function updateDiaryMenuItem() {
    const item = document.getElementById('hamburger-diary-item');
    if (item) item.classList.toggle('hidden', !(hasNewMe && nmDiaryInMenu()));
}
async function nmSetDiaryInMenu(on) {
    try { if (on) localStorage.setItem(nmDiaryMenuKey(), '1'); else localStorage.removeItem(nmDiaryMenuKey()); } catch {}
    updateDiaryMenuItem();
    showAppToast(t(on ? 'nm_diary_menu_added' : 'nm_diary_menu_removed'));
    if (typeof roomSave === 'function') await roomSave({ diary_in_menu: !!on });
    updateDiaryMenuItem();
}
function nmDiaryMenuRowHtml() {
    if (typeof roomIsUnlocked !== 'function' || !roomIsUnlocked('music')) return '';
    return `<label class="nm-switch-row nm-diary-menu-row"><span>📔 ${nmEsc(t('nm_diary_in_menu'))}</span><input type="checkbox" class="nm-switch" ${nmDiaryInMenu() ? 'checked' : ''} onchange="nmSetDiaryInMenu(this.checked)"></label>`;
}
function openDiaryFromMenu() {
    if (!hasNewMe) { openNewMe(); return; }
    if (typeof srpOpenDiary === 'function') srpOpenDiary();
}
function updateNewMeShortcut() {
    nmRenderHomeTile();
    updateDiaryMenuItem();
    // הבחירה מהחשבון (גם ממכשיר אחר) - נטען פעם אחת ברקע
    if (hasNewMe && typeof roomLoad === 'function' && typeof roomLoaded !== 'undefined' && !roomLoaded) roomLoad().then(updateDiaryMenuItem);
    // פעם בשבוע: משאלה אקראית מצנצנת המשאלות, בעדינות (ר' roomWishPopupSoon ב-secret-places.js)
    if (hasNewMe && typeof roomWishPopupSoon === 'function') roomWishPopupSoon();
    if (hasNewMe) nmEnsureHomeData().then(ok => { if (ok) { nmRenderHomeTile(); if (typeof loadTodayTasks === 'function') loadTodayTasks(); } });
    // מי שעוד לא רכש/ה: מנעול קטן על New Me בתפריט (לחיצה פותחת את עמוד ההסבר והרכישה)
    document.querySelectorAll('.hamburger-newme-item').forEach(b => b.classList.toggle('locked', !hasNewMe));
    // לחיצה על תזכורת ארוחה (?open=newme) - נפתח ברגע שמצב הרכישה נטען
    if (nmPendingDeepLink && hasNewMe) { nmPendingDeepLink = false; openNewMe(); }
    // האתגרים הפעילים מופיעים בהצצה להיום גם בלי לפתוח את New Me
    if (hasNewMe && !nmChallengesLoaded) nmLoadChallenges().then(() => { if (nmChActive().length && typeof loadTodayTasks === 'function') loadTodayTasks(); });
}

// התפריט של היום נמצא עכשיו ישירות במסך הראשי של New Me
function openNewMeMenuToday() {
    openNewMe('home');
}

// ---------- המסע שלי ----------
function nmRenderJourney(body) {
    const day = nmJourneyDay();
    const st = nmStreaks();
    const ms = nmMilestoneWindow(day);
    const nodes = ms.map((n, i) => {
        const reached = day >= n;
        const prevN = i === 0 ? 0 : ms[i - 1];
        const seg = reached ? 100 : day <= prevN ? 0 : Math.round(((day - prevN) / (n - prevN)) * 100);
        return `
            <div class="nm-ms${reached ? ' reached' : ''}${!reached && (i === 0 || day >= ms[i - 1]) ? ' next' : ''}">
                ${i > 0 ? `<span class="nm-ms-line" aria-hidden="true"><span style="width:${seg}%"></span></span>` : ''}
                <span class="nm-ms-dot" aria-hidden="true">${NEW_ME_MILESTONE_ICONS[n] || '👑'}</span>
                <span class="nm-ms-name">${nmEsc(nmMilestoneName(n))}</span>
                <span class="nm-ms-sub">${reached ? '✓' : nmEsc(n - day === 1 ? t('nm_tomorrow') : t('nm_days_left').replace('{n}', nmFmt(n - day)))}</span>
            </div>`;
    }).join('');
    body.innerHTML = `
        <div class="nm-journey-hero">
            ${nmDayHtml(day, 'nm-journey-day')}
            <div class="nm-fine">${nmEsc(t('nm_journey_since').replace('{date}', nmLongDate(nmStartDay())))}</div>
        </div>
        <div class="nm-milestones">${nodes}</div>
        <div class="nm-stat-grid">
            <div class="nm-stat-box"><span aria-hidden="true">🔥</span><b class="nm-num">${nmFmt(st.current)}</b><span>${nmEsc(t('nm_stat_streak'))}</span></div>
            <div class="nm-stat-box"><span aria-hidden="true">⭐</span><b class="nm-num">${nmFmt(st.best)}</b><span>${nmEsc(t('nm_stat_best'))}</span></div>
            <div class="nm-stat-box"><span aria-hidden="true">✅</span><b class="nm-num">${nmFmt(st.good)}</b><span>${nmEsc(t('nm_stat_good'))}</span></div>
        </div>
        <p class="nm-fine nm-rule">${nmEsc(t('nm_good_day_rule'))}</p>
        ${nmWeightCardHtml()}`;
}

function nmWeightCardHtml() {
    const profileStart = Number(nmProfile.start_weight) || null;
    const start = nmStartWeight();
    const goal = Number(nmProfile.goal_weight) || null;
    const latest = nmLatestWeight();
    const lost = nmKgLost();
    const since = nmStartDay();
    const series = (profileStart ? [{ weight_date: since, weight_value: profileStart }] : []).concat(nmWeights.filter(w => w.weight_date >= since));
    const pct = start && goal && latest && start !== goal ? Math.max(0, Math.min(100, Math.round(((start - latest) / (start - goal)) * 100))) : null;
    const kg = v => v ? `<bdi dir="ltr">${nmFmtNum(v, 1)}</bdi>` : '—';
    const recent = nmWeights.slice(-7).reverse();
    return `
        <div class="nm-weight">
            <div class="nm-weight-head"><h4>⚖️ ${nmEsc(t('nm_weight_title'))}</h4>${goal ? `<span class="nm-fine">${nmEsc(t('nm_goal_weight_line').replace('{w}', nmFmtNum(goal, 1)))}</span>` : ''}</div>
            <div class="nm-weight-trio">
                <div><span>${nmEsc(t('nm_weight_start'))}</span><b>${kg(start)}</b></div>
                <div class="now"><span>${nmEsc(t('nm_weight_now'))}</span><b>${kg(latest)}</b></div>
                <div><span>${nmEsc(t('nm_weight_goal'))}</span><b>${kg(goal)}</b></div>
            </div>
            ${lost > 0 ? `<div class="nm-weight-lost">🎉 ${nmEsc(t('nm_kg_lost').replace('{n}', nmFmtNum(lost, 1)))}</div>` : ''}
            ${pct != null ? `<div class="nm-goal-progress"><span class="nm-progress"><span style="width:${Math.max(3, pct)}%"></span></span><span class="nm-fine">${nmEsc(t('nm_goal_pct').replace('{p}', pct))}</span></div>` : ''}
            ${nmWeightChart(series)}
            <div class="nm-weight-add">
                <input type="number" id="nm-weight-input" inputmode="decimal" step="0.1" min="20" max="400" placeholder="${nmEsc(t('nm_weight_placeholder'))}">
                <button type="button" class="nm-btn-primary nm-btn-small" onclick="nmAddWeight(this)">${nmEsc(t('nm_add_weight'))}</button>
            </div>
            ${recent.length ? `<ul class="nm-weight-list">${recent.map(w => `<li><span>${nmEsc(nmShortDate(w.weight_date))}</span><span class="nm-num"><bdi dir="ltr">${nmEsc(nmFmtNum(Number(w.weight_value), 1))}</bdi></span></li>`).join('')}</ul>` : `<p class="nm-empty">${nmEsc(t('nm_weight_empty'))}</p>`}
        </div>`;
}

function nmWeightChart(list) {
    const pts = list.map(w => Number(w.weight_value)).filter(v => v > 0);
    if (pts.length < 2) return '';
    const W = 300, H = 110, pad = 10;
    const goal = nmProfile && nmProfile.goal_weight ? Number(nmProfile.goal_weight) : null;
    const all = goal ? pts.concat(goal) : pts;
    const min = Math.min(...all) - 0.5, max = Math.max(...all) + 0.5;
    const x = i => pad + (i * (W - 2 * pad)) / (pts.length - 1);
    const yv = v => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
    const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yv(v).toFixed(1)}`).join(' ');
    const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
    return `<svg class="nm-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        ${[0.25, 0.5, 0.75].map(f => `<line x1="${pad}" x2="${W - pad}" y1="${(pad + f * (H - 2 * pad)).toFixed(1)}" y2="${(pad + f * (H - 2 * pad)).toFixed(1)}" class="nm-chart-grid"/>`).join('')}
        ${goal ? `<line x1="${pad}" x2="${W - pad}" y1="${yv(goal).toFixed(1)}" y2="${yv(goal).toFixed(1)}" class="nm-chart-goal"/>` : ''}
        <path d="${area}" class="nm-chart-area"/>
        <path d="${line}" class="nm-chart-line"/>
        <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${yv(pts[pts.length - 1]).toFixed(1)}" r="4" class="nm-chart-dot"/>
    </svg>`;
}

async function nmAddWeight(btn) {
    const input = document.getElementById('nm-weight-input');
    const w = parseFloat(input && input.value);
    if (!(w >= 20 && w <= 400)) { showAppToast(t('nm_q_weight_missing'), 'error'); return; }
    btn.disabled = true;
    await insertWeightRecord(w, getLocalDateString(), null);
    if (typeof loadWeightHistory === 'function') loadWeightHistory();
    showAppToast(t('nm_weight_saved'));
    await nmLoadJourney();
    nmRenderView(nmRoot());
    nmAwardBadges();
}

// ---------- הישגים ----------
function nmRenderBadges(body) {
    const earned = NEW_ME_BADGES.filter(b => nmBadges[b.key]).length;
    body.innerHTML = `
        <div class="nm-badges-head"><b class="nm-num"><bdi dir="ltr">${earned}/${NEW_ME_BADGES.length}</bdi></b> <span>${nmEsc(t('nm_badges_earned'))}</span></div>
        <div class="nm-badges-grid">${NEW_ME_BADGES.map(b => {
            const at = nmBadges[b.key];
            return `
            <button type="button" class="nm-badge${at ? ' earned' : ''}" onclick="nmShowBadge('${b.key}')">
                <span class="nm-medal" aria-hidden="true"><span>${b.icon}</span>${at ? '' : '<i class="nm-medal-lock">🔒</i>'}</span>
                <span class="nm-badge-title">${nmEsc(nmBadgeTitle(b))}</span>
                <span class="nm-badge-sub">${at ? nmEsc(nmShortDate(at.slice(0, 10))) : '&nbsp;'}</span>
            </button>`;
        }).join('')}</div>`;
}
function nmShowBadge(key) {
    const b = NEW_ME_BADGES.find(x => x.key === key);
    if (!b) return;
    const at = nmBadges[key];
    const ov = nmOpenSheet(`
        <div class="nm-medal big${at ? '' : ' locked'}" aria-hidden="true"><span>${b.icon}</span></div>
        <h3 class="nm-celebrate-title">${nmEsc(nmBadgeTitle(b))}</h3>
        <p class="nm-celebrate-desc">${nmEsc(nmBadgeDesc(b))}</p>
        <p class="nm-fine">${nmEsc(at ? t('nm_badge_earned_on').replace('{date}', nmLongDate(at.slice(0, 10))) : t('nm_badge_locked'))}</p>
        <div class="nm-celebrate-actions">
            ${at ? `<button type="button" class="nm-btn-ghost" data-share>${nmEsc(t('nm_share'))}</button>` : ''}
            <button type="button" class="nm-btn-primary" data-close>${nmEsc(t('nm_celebrate_ok'))}</button>
        </div>`, 'nm-celebrate');
    const sh = ov.querySelector('[data-share]');
    if (sh) sh.addEventListener('click', () => { ov.remove(); openSharePicker(`🏅 ${t('nm_share_badge_text')}\n\n${b.icon} ${nmBadgeTitle(b)}`); });
}

// ---------- רשימת קניות מהתפריט ----------
// בוחרים מספר ימים בכל פעם (3 / 5 / 7 / אחר); כמויות זהות מתחברות; מה שכבר יש בבית
// אפשר להוריד; הכול נכנס לרשימת הקניות של האפליקציה (my_center_tasks, task_type='general')
function nmShopItems(days) {
    const totals = {};
    const today = getLocalDateString();
    for (let i = 0; i < days; i++) {
        const ds = nmAddDays(today, i);
        const dayRow = nmWeekDays.find(r => r.day === ds);
        nmActiveOrder().forEach(slot => {
            if (dayRow && dayRow.free_slot === slot) return;
            if (i === 0 && nmTodayCheckins[slot]) return;   // מה שכבר נאכל היום לא צריך לקנות
            const ov = dayRow && dayRow.overrides && dayRow.overrides[slot];
            // ארוחה אישית (מהמאגר / AI) - אין פירוט מרכיבים, לא נכנסת לרשימה
            const key = nmValidKey(ov) ? ov : nmPermanentKey(slot);
            (NEW_ME_INGREDIENTS[key] || []).forEach(([ing, qty, unit]) => {
                const k = `${ing}|${unit}`;
                if (!totals[k]) totals[k] = { ing, unit, qty: 0 };
                totals[k].qty += qty;
            });
        });
    }
    const groupOf = ing => Object.keys(NEW_ME_SHOP_GROUPS).find(g => NEW_ME_SHOP_GROUPS[g].includes(ing)) || 'other';
    return Object.values(totals).map(x => ({ ...x, group: groupOf(x.ing) }));
}
// מספר עשרוני עד שתי ספרות (3.5) - לא תווי שבר (½), שמתהפכים בעברית/ערבית ("½3")
function nmFrac(x) { return nmFmtNum(Math.round(x * 4) / 4, 2); }
function nmFmtQty(qty, unit) {
    if (unit === 'g') return qty >= 1000 ? `${nmFmtNum(qty / 1000, 2)} ${t('nm_unit_kg')}` : `${nmFmt(Math.round(qty / 5) * 5)} ${t('nm_unit_g')}`;
    if (unit === 'ml') return qty >= 1000 ? `${nmFmtNum(qty / 1000, 2)} ${t('nm_unit_l')}` : `${nmFmt(Math.round(qty / 10) * 10)} ${t('nm_unit_ml')}`;
    if (unit === 'tsp') {
        const tbsp = Math.floor(qty / 3 + 1e-9);
        const tsp = Math.round((qty - tbsp * 3) * 4) / 4;
        const parts = [];
        if (tbsp) parts.push(`${nmFmt(tbsp)} ${t(tbsp === 1 ? 'nm_unit_tbsp_one' : 'nm_unit_tbsp')}`);
        if (tsp) parts.push(`${nmFrac(tsp)} ${t(tsp === 1 ? 'nm_unit_tsp_one' : 'nm_unit_tsp')}`);
        return parts.join(' + ');
    }
    return nmFrac(qty);
}
function nmShopLine(x) { return `${t('nm_ing_' + x.ing)} — ${nmFmtQty(x.qty, x.unit)}`; }

function nmRenderShop(body) {
    const presets = [3, 5, 7];
    const custom = !presets.includes(nmShopDays);
    const items = nmShopItems(nmShopDays);
    const groups = Object.keys(NEW_ME_SHOP_GROUPS);
    const endDay = nmAddDays(getLocalDateString(), nmShopDays - 1);
    const onCount = items.filter(x => !nmShopOff.has(`${x.ing}|${x.unit}`)).length;
    body.innerHTML = `
        <div class="nm-card">
            <div class="nm-sheet-label">${nmEsc(t('nm_shop_days_q'))}</div>
            <div class="nm-chip-row">
                ${presets.map(n => `<button type="button" class="nm-pick${nmShopDays === n ? ' on' : ''}" onclick="nmSetShopDays(${n})">${nmEsc(t('nm_shop_n_days').replace('{n}', n))}</button>`).join('')}
                <button type="button" class="nm-pick${custom ? ' on' : ''}" onclick="nmShopCustomDays()">${nmEsc(t('nm_other'))}</button>
                ${custom ? `<input type="number" class="nm-shop-custom" id="nm-shop-custom" inputmode="numeric" min="1" max="14" value="${nmShopDays}" onchange="nmSetShopDays(this.value)" aria-label="${nmEsc(t('nm_shop_days_q'))}">` : ''}
            </div>
            <p class="nm-fine">${nmEsc(t('nm_shop_range').replace('{from}', t('nm_today')).replace('{to}', nmShopDays === 1 ? t('nm_today') : nmWeekdayName(endDay) + ' ' + nmShortDate(endDay)))}</p>
        </div>
        ${items.length ? groups.map(g => {
            const list = items.filter(x => x.group === g);
            if (!list.length) return '';
            return `
            <div class="nm-shop-group">
                <div class="nm-sheet-label">${nmEsc(t('nm_shop_group_' + g))}</div>
                ${list.map(x => {
                    const k = `${x.ing}|${x.unit}`;
                    const on = !nmShopOff.has(k);
                    return `<label class="nm-shop-item${on ? '' : ' off'}"><input type="checkbox" ${on ? 'checked' : ''} onchange="nmToggleShopItem('${k}', this.checked)"><span class="nm-shop-name">${nmEsc(t('nm_ing_' + x.ing))}</span><span class="nm-shop-qty">${nmEsc(nmFmtQty(x.qty, x.unit))}</span></label>`;
                }).join('')}
            </div>`;
        }).join('') : `<p class="nm-empty">${nmEsc(t('nm_shop_empty'))}</p>`}
        <p class="nm-fine">${nmEsc(t('nm_shop_hint'))}</p>
        <button type="button" class="nm-btn-primary" onclick="nmAddShopToList(this)" ${onCount ? '' : 'disabled'}>${nmEsc(t('nm_shop_add_btn').replace('{n}', onCount))}</button>`;
}
function nmSetShopDays(n) {
    const v = Math.max(1, Math.min(14, parseInt(n, 10) || 7));
    nmShopDays = v;
    nmRenderShop(document.getElementById('nm-view-body'));
}
function nmShopCustomDays() {
    if ([3, 5, 7].includes(nmShopDays)) nmShopDays = 4;
    nmRenderShop(document.getElementById('nm-view-body'));
    const el = document.getElementById('nm-shop-custom');
    if (el) { el.focus(); el.select(); }
}
function nmToggleShopItem(k, on) {
    if (on) nmShopOff.delete(k); else nmShopOff.add(k);
    nmRenderShop(document.getElementById('nm-view-body'));
}
async function nmAddShopToList(btn) {
    const items = nmShopItems(nmShopDays).filter(x => !nmShopOff.has(`${x.ing}|${x.unit}`));
    if (!items.length) return;
    btn.disabled = true;
    // מה שכבר נמצא ברשימה בדיוק באותו נוסח - לא מוסיפים פעמיים
    const { data: existing } = await supabaseClient.from('my_center_tasks').select('content').eq('user_id', currentUserId).eq('task_type', 'general');
    const have = new Set((existing || []).map(r => String(r.content || '').trim()));
    const rows = items.map(nmShopLine).filter(line => !have.has(line)).map(content => ({ username: currentUsername, user_id: currentUserId, task_type: 'general', content }));
    if (rows.length) {
        const { error } = await supabaseClient.from('my_center_tasks').insert(rows);
        if (error) { btn.disabled = false; showAppToast(t('nm_save_error'), 'error'); return; }
    }
    if (typeof loadCenterItems === 'function') loadCenterItems('general');
    nmShopOff = new Set();
    const ov = nmOpenSheet(`
        <div class="nm-medal big" aria-hidden="true"><span>🛒</span></div>
        <h3 class="nm-celebrate-title">${nmEsc(t('nm_shop_added_title'))}</h3>
        <p class="nm-celebrate-desc">${nmEsc(t('nm_shop_added_desc').replace('{n}', rows.length))}</p>
        <div class="nm-celebrate-actions">
            <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_celebrate_ok'))}</button>
            <button type="button" class="nm-btn-primary" data-open>${nmEsc(t('nm_shop_open_list'))}</button>
        </div>`, 'nm-celebrate');
    ov.querySelector('[data-open]').addEventListener('click', () => { ov.remove(); navigateFromMenu('my-center-section', 'shopping'); });
    nmRenderShop(document.getElementById('nm-view-body'));
    nmAwardBadges(['shopping']);
}

// ---------- מדידות גוף ----------
async function nmLoadMeasures() {
    const { data } = await supabaseClient.from('new_me_measurements').select('*').eq('user_id', currentUserId).order('measured_on', { ascending: true });
    nmMeasures = data || [];
    nmHasMeasure = nmMeasures.length > 0;
}
function nmSparkline(vals) {
    if (vals.length < 2) return '';
    const W = 90, H = 28, min = Math.min(...vals), max = Math.max(...vals), span = (max - min) || 1;
    const pts = vals.map((v, i) => `${(2 + (i * (W - 4)) / (vals.length - 1)).toFixed(1)},${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`).join(' ');
    return `<svg class="nm-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}
async function nmRenderMeasure(body) {
    body.innerHTML = '<div class="nm-loading"></div>';
    await nmLoadMeasures();
    const today = getLocalDateString();
    const last = nmMeasures[nmMeasures.length - 1];
    const fieldCard = (label, vals) => {
        if (!vals.length) return '';
        const first = vals[0], lastV = vals[vals.length - 1];
        const d = Math.round((lastV - first) * 10) / 10;
        return `
            <div class="nm-measure-card">
                <span class="nm-measure-label">${nmEsc(label)}</span>
                <b><bdi dir="ltr">${nmFmtNum(lastV, 1)}</bdi> <small>${nmEsc(t('nm_cm'))}</small></b>
                ${vals.length > 1 ? `<span class="nm-diff ${d < 0 ? 'down good' : d > 0 ? 'up' : 'eq'}"><bdi dir="ltr">${d > 0 ? '+' : d < 0 ? '−' : '±'}${nmFmtNum(Math.abs(d), 1)}</bdi></span>` : ''}
                ${nmSparkline(vals)}
            </div>`;
    };
    const otherLabel = last && last.other_label;
    const otherVals = otherLabel ? nmMeasures.filter(m => m.other_label === otherLabel && m.other_value != null).map(m => Number(m.other_value)) : [];
    const cards = NEW_ME_MEASURE_FIELDS.map(f => fieldCard(t('nm_measure_' + f), nmMeasures.filter(m => m[f] != null).map(m => Number(m[f])))).join('') + (otherLabel ? fieldCard(otherLabel, otherVals) : '');
    body.innerHTML = `
        <div class="nm-card nm-measure-form">
            <label class="nm-field"><span>${nmEsc(t('nm_measure_date'))}</span><input type="date" id="nm-measure-date" class="nm-date" value="${today}" max="${today}"></label>
            <div class="nm-measure-grid">
                ${NEW_ME_MEASURE_FIELDS.map(f => `<label class="nm-field"><span>${nmEsc(t('nm_measure_' + f))}</span><input type="number" inputmode="decimal" step="0.1" min="1" max="300" id="nm-measure-${f}" placeholder="${nmEsc(t('nm_cm'))}"></label>`).join('')}
            </div>
            <div class="nm-measure-grid">
                <label class="nm-field"><span>${nmEsc(t('nm_measure_other'))}</span><input type="text" id="nm-measure-other-label" maxlength="40" placeholder="${nmEsc(t('nm_measure_other_ph'))}" value="${nmEsc(otherLabel || '')}"></label>
                <label class="nm-field"><span>${nmEsc(t('nm_cm'))}</span><input type="number" inputmode="decimal" step="0.1" min="1" max="400" id="nm-measure-other-value" placeholder="${nmEsc(t('nm_cm'))}"></label>
            </div>
            <button type="button" class="nm-btn-primary" onclick="nmSaveMeasure(this)">${nmEsc(t('nm_measure_save'))}</button>
            <p class="nm-fine">${nmEsc(t('nm_measure_tip'))}</p>
        </div>
        ${cards ? `<div class="nm-measure-cards">${cards}</div>` : `<p class="nm-empty">${nmEsc(t('nm_measure_empty'))}</p>`}
        ${nmMeasures.length ? `
        <div class="nm-card">
            <div class="nm-sheet-label">${nmEsc(t('nm_measure_history'))}</div>
            <ul class="nm-history">${nmMeasures.slice().reverse().map(m => `
                <li>
                    <span class="nm-history-date">${nmEsc(nmShortDate(m.measured_on))}</span>
                    <span class="nm-history-vals">${NEW_ME_MEASURE_FIELDS.filter(f => m[f] != null).map(f => `${nmEsc(t('nm_measure_' + f))} <bdi dir="ltr">${nmFmtNum(Number(m[f]), 1)}</bdi>`).concat(m.other_label && m.other_value != null ? [`${nmEsc(m.other_label)} <bdi dir="ltr">${nmFmtNum(Number(m.other_value), 1)}</bdi>`] : []).join(' · ')}</span>
                    <button type="button" class="nm-x" onclick="nmDeleteMeasure('${m.id}')" aria-label="${nmEsc(t('nm_remove'))}">✕</button>
                </li>`).join('')}</ul>
        </div>` : ''}`;
}
async function nmSaveMeasure(btn) {
    const val = id => { const v = parseFloat((document.getElementById(id) || {}).value); return v > 0 ? Math.round(v * 10) / 10 : null; };
    const row = { user_id: currentUserId, measured_on: document.getElementById('nm-measure-date').value || getLocalDateString() };
    NEW_ME_MEASURE_FIELDS.forEach(f => { row[f] = val('nm-measure-' + f); });
    const otherLabel = document.getElementById('nm-measure-other-label').value.trim().slice(0, 40);
    const otherValue = val('nm-measure-other-value');
    row.other_label = otherLabel && otherValue != null ? otherLabel : null;
    row.other_value = otherLabel && otherValue != null ? otherValue : null;
    if (NEW_ME_MEASURE_FIELDS.every(f => row[f] == null) && row.other_value == null) { showAppToast(t('nm_measure_missing'), 'error'); return; }
    btn.disabled = true;
    const { error } = await supabaseClient.from('new_me_measurements').upsert(row, { onConflict: 'user_id,measured_on' });
    if (error) { btn.disabled = false; showAppToast(t('nm_measure_invalid'), 'error'); return; }
    showAppToast(t('nm_measure_saved'));
    nmHasMeasure = true;
    await nmRenderMeasure(document.getElementById('nm-view-body'));
    nmAwardBadges(['first_measure']);
}
function nmDeleteMeasure(id) {
    showDangerConfirm(t('nm_delete_confirm_title'), t('nm_delete_confirm_msg'), async () => {
        await supabaseClient.from('new_me_measurements').delete().eq('id', id).eq('user_id', currentUserId);
        await nmRenderMeasure(document.getElementById('nm-view-body'));
    });
}

// ---------- תמונות התקדמות (פרטיות: bucket פרטי, כתובות חתומות לשעה) ----------
async function nmLoadPhotos() {
    const { data } = await supabaseClient.from('new_me_photos').select('*').eq('user_id', currentUserId).order('taken_on', { ascending: true }).order('created_at', { ascending: true });
    nmPhotos = data || [];
    nmLastPhotoDay = nmPhotos.length ? nmPhotos[nmPhotos.length - 1].taken_on : null;
    const missing = nmPhotos.filter(p => !nmPhotoUrls[p.path]).map(p => p.path);
    if (missing.length) {
        const { data: signed } = await supabaseClient.storage.from('new-me-photos').createSignedUrls(missing, 3600);
        (signed || []).forEach(s => { if (s.signedUrl && s.path) nmPhotoUrls[s.path] = s.signedUrl; });
    }
}
async function nmRenderPhotos(body) {
    body.innerHTML = '<div class="nm-loading"></div>';
    await nmLoadPhotos();
    const byId = id => nmPhotos.find(p => p.id === id);
    const before = byId(nmCompare.before) || nmPhotos[0];
    const after = byId(nmCompare.after) || nmPhotos[nmPhotos.length - 1];
    const canCompare = nmPhotos.length >= 2 && before && after && before.id !== after.id;
    // בעברית/ערבית הזמן זורם מימין לשמאל - "לפני" בצד ימין, "אחרי" בצד שמאל
    const rtl = getComputedStyle(document.body).direction === 'rtl';
    const leftP = rtl ? after : before, rightP = rtl ? before : after;
    const leftLabel = t(rtl ? 'nm_photo_after' : 'nm_photo_before'), rightLabel = t(rtl ? 'nm_photo_before' : 'nm_photo_after');
    body.innerHTML = `
        <div class="nm-privacy">🔒 ${nmEsc(t('nm_photo_privacy'))}</div>
        <label class="nm-btn-primary nm-upload">
            📸 ${nmEsc(t('nm_photo_add'))}
            <input type="file" accept="image/*" onchange="nmUploadPhoto(this)" hidden>
        </label>
        <p class="nm-fine">${nmEsc(t('nm_photo_tip'))}</p>
        ${canCompare ? `
        <div class="nm-compare" dir="ltr" style="--pos: 50%">
            <img class="nm-compare-img" src="${nmEsc(nmPhotoUrls[rightP.path] || '')}" alt="${nmEsc(rightLabel)}">
            <div class="nm-compare-before"><img class="nm-compare-img" src="${nmEsc(nmPhotoUrls[leftP.path] || '')}" alt="${nmEsc(leftLabel)}"></div>
            <span class="nm-compare-line" aria-hidden="true"><span class="nm-compare-knob">⇆</span></span>
            <span class="nm-compare-tag left">${nmEsc(leftLabel)} · ${nmEsc(nmShortDate(leftP.taken_on))}</span>
            <span class="nm-compare-tag right">${nmEsc(rightLabel)} · ${nmEsc(nmShortDate(rightP.taken_on))}</span>
            <input type="range" class="nm-compare-range" min="0" max="100" value="50" oninput="this.parentElement.style.setProperty('--pos', this.value + '%')" aria-label="${nmEsc(t('nm_photo_compare'))}">
        </div>
        <p class="nm-fine nm-center">${nmEsc(t('nm_photo_compare_hint'))}</p>` : nmPhotos.length === 1 ? `<p class="nm-fine nm-center">${nmEsc(t('nm_photo_one_more'))}</p>` : ''}
        ${nmPhotos.length ? `<div class="nm-photo-grid">${nmPhotos.slice().reverse().map(p => `
            <button type="button" class="nm-photo${p.id === (before && before.id) ? ' is-before' : ''}${p.id === (after && after.id) ? ' is-after' : ''}" onclick="nmPhotoActions('${p.id}')">
                <img src="${nmEsc(nmPhotoUrls[p.path] || '')}" alt="" loading="lazy">
                <span>${nmEsc(nmShortDate(p.taken_on))}</span>
            </button>`).join('')}</div>` : `<p class="nm-empty">${nmEsc(t('nm_photo_empty'))}</p>`}`;
    nmInitCompare(body.querySelector('.nm-compare'));
}
// גרירה על התמונה מזיזה את קו ה"לפני/אחרי" (הטווח הנסתר נשאר למקלדת)
function nmInitCompare(el) {
    if (!el) return;
    const range = el.querySelector('.nm-compare-range');
    const set = x => {
        const r = el.getBoundingClientRect();
        const p = Math.max(0, Math.min(100, ((x - r.left) / r.width) * 100));
        el.style.setProperty('--pos', p.toFixed(1) + '%');
        if (range) range.value = Math.round(p);
    };
    el.addEventListener('pointerdown', e => {
        if (e.button !== undefined && e.button !== 0) return;
        try { el.setPointerCapture(e.pointerId); } catch { /* ok */ }
        set(e.clientX);
    });
    el.addEventListener('pointermove', e => { if (el.hasPointerCapture && el.hasPointerCapture(e.pointerId)) set(e.clientX); });
}
function nmPhotoActions(id) {
    const ov = nmOpenSheet(`
        <h4>${nmEsc(t('nm_tile_photos'))}</h4>
        <button type="button" class="nm-row-btn" data-act="before">⬅️ ${nmEsc(t('nm_photo_set_before'))}</button>
        <button type="button" class="nm-row-btn" data-act="after">➡️ ${nmEsc(t('nm_photo_set_after'))}</button>
        <button type="button" class="nm-row-btn nm-danger" data-act="delete">🗑️ ${nmEsc(t('nm_photo_delete'))}</button>
        <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_back'))}</button>`);
    ov.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => {
        ov.remove();
        const act = b.dataset.act;
        if (act === 'before') { nmCompare.before = id; nmRenderPhotos(document.getElementById('nm-view-body')); }
        else if (act === 'after') { nmCompare.after = id; nmRenderPhotos(document.getElementById('nm-view-body')); }
        else showDangerConfirm(t('nm_delete_confirm_title'), t('nm_delete_confirm_msg'), () => nmDeletePhoto(id));
    }));
}
// הקטנה בצד הלקוח (עד 1280px, JPEG) - חוסך מקום ומעלה מהר גם מתמונת מצלמה של כמה מגה
async function nmCompressImage(file, maxSide = 1280, quality = 0.82) {
    const url = URL.createObjectURL(file);
    try {
        const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = url; });
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        return await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    } finally {
        URL.revokeObjectURL(url);
    }
}
async function nmUploadPhoto(input) {
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    showAppToast(t('nm_photo_uploading'));
    const blob = await nmCompressImage(file).catch(() => null);
    if (!blob) { showAppToast(t('nm_photo_error'), 'error'); return; }
    const day = getLocalDateString();
    const path = `${currentUserId}/${day}-${Date.now().toString(36)}.jpg`;
    const { error } = await supabaseClient.storage.from('new-me-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
    if (error) { showAppToast(t('nm_photo_error'), 'error'); return; }
    const { error: rowError } = await supabaseClient.from('new_me_photos').insert({ user_id: currentUserId, taken_on: day, path });
    if (rowError) { await supabaseClient.storage.from('new-me-photos').remove([path]); showAppToast(t('nm_photo_error'), 'error'); return; }
    showAppToast(t('nm_photo_saved'));
    nmCompare.after = null;
    nmLastPhotoDay = day;
    await nmRenderPhotos(document.getElementById('nm-view-body'));
    nmAwardBadges(['first_photo']);
}
async function nmDeletePhoto(id) {
    const p = nmPhotos.find(x => x.id === id);
    if (!p) return;
    await supabaseClient.storage.from('new-me-photos').remove([p.path]);
    await supabaseClient.from('new_me_photos').delete().eq('id', id).eq('user_id', currentUserId);
    delete nmPhotoUrls[p.path];
    if (nmCompare.before === id) nmCompare.before = null;
    if (nmCompare.after === id) nmCompare.after = null;
    await nmRenderPhotos(document.getElementById('nm-view-body'));
}

// ---------- טבלה יומית ----------
function nmCheckinLabel(r) {
    if (r.option_id === 'free') return String(r.mirror_text || ('🍕 ' + t('nm_free_meal')));
    if (nmIsCustomKey(r.option_id)) { const cm = nmCustomMeal(r.option_id); return cm ? cm.name : String(r.mirror_text || '').replace(/^✨\s*/, ''); }
    const p = nmParseItem(r.option_id);
    if (p) return nmOptText(p.plan, p.slot, p.opt, true);
    return nmOptText(r.plan, r.slot, r.option_id, true);
}
async function nmRenderTable(body) {
    if (!nmTableDate) nmTableDate = getLocalDateString();
    const [{ data }, { data: drinkRows }] = await Promise.all([
        supabaseClient.from('new_me_checkins').select('*').eq('user_id', currentUserId).eq('checkin_date', nmTableDate),
        supabaseClient.from('calorie_tracker').select('meal_type, food_description, calories, protein_grams').eq('user_id', currentUserId).eq('date', nmTableDate).like('meal_type', 'nm_%'),
    ]);
    const rows = nmOrder().map(s => (data || []).find(r => r.slot === s)).filter(Boolean);
    const drinks = (drinkRows || []).filter(nmIsDrinkRow);
    // 🕐 הארוחה הקטנה הנוספת (אם הייתה באותו יום)
    const sides = (drinkRows || []).filter(r => r.meal_type === NEW_ME_SIDE_MEAL_TYPE);
    const total = rows.reduce((a, r) => ({ kcal: a.kcal + r.kcal, protein: a.protein + Number(r.protein_g) }), {
        kcal: drinks.concat(sides).reduce((a, d) => a + (Number(d.calories) || 0), 0),
        protein: sides.reduce((a, d) => a + (Number(d.protein_grams) || 0), 0),
    });
    body.innerHTML = `
        <div class="nm-date-row">
            <button type="button" class="nm-chip" onclick="nmShiftTableDate(-1)" aria-label="-1">‹</button>
            <input type="date" class="nm-date" value="${nmTableDate}" max="${getLocalDateString()}" onchange="nmTableDate = this.value || getLocalDateString(); nmRenderTable(document.getElementById('nm-view-body'))">
            <button type="button" class="nm-chip" onclick="nmShiftTableDate(1)" aria-label="+1">›</button>
        </div>
        ${rows.length || drinks.length || sides.length ? `
        <div class="nm-table-wrap"><table class="nm-table">
            <thead><tr><th>${nmEsc(t('nm_table_food'))}</th><th>${nmEsc(t('calories_unit'))}</th><th>${nmEsc(t('nm_table_protein'))}</th></tr></thead>
            <tbody>${rows.map(r => `<tr><td><span class="nm-td-slot">${nmEsc(nmSlotName(r.slot))}</span>${nmEsc(nmCheckinLabel(r))}</td><td class="nm-num"><bdi dir="ltr">~${r.kcal}</bdi></td><td class="nm-num"><bdi dir="ltr">~${Math.round(r.protein_g)}</bdi></td></tr>`).join('')}${sides.map(d => `<tr><td><span class="nm-td-slot">${nmEsc(t('nm_side_title'))}</span>${nmEsc(String(d.food_description || '').replace(/^✨\s*/, ''))}</td><td class="nm-num"><bdi dir="ltr">~${Number(d.calories) || 0}</bdi></td><td class="nm-num"><bdi dir="ltr">~${Math.round(Number(d.protein_grams) || 0)}</bdi></td></tr>`).join('')}${drinks.map(d => `<tr><td><span class="nm-td-slot">${nmEsc(t('nm_slot_drinks'))}</span>${nmEsc(String(d.food_description || '').replace(/^🥤\s*/, ''))}</td><td class="nm-num">${Number(d.calories) || 0}</td><td class="nm-num">0</td></tr>`).join('')}</tbody>
            <tfoot><tr><td>${nmEsc(t('nm_table_total'))}</td><td class="nm-num">${nmFmt(total.kcal)}</td><td class="nm-num">${nmFmt(Math.round(total.protein))}</td></tr></tfoot>
        </table></div>` : `<p class="nm-empty">${nmEsc(t('nm_table_empty'))}</p>`}
        <p class="nm-ai-note">${nmEsc(t('nm_ai_note'))}</p>`;
}

function nmShiftTableDate(delta) {
    const next = nmAddDays(nmTableDate, delta);
    if (next > getLocalDateString()) return;
    nmTableDate = next;
    nmRenderTable(document.getElementById('nm-view-body'));
}

// ---------- לוח חודשי + הקשר בין הצ'ק-אין לתפריט ----------
async function nmRenderMonth(body) {
    const now = new Date();
    if (!nmMonthKey) nmMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [y, m] = nmMonthKey.split('-').map(Number);
    const first = `${nmMonthKey}-01`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const last = `${nmMonthKey}-${String(daysInMonth).padStart(2, '0')}`;
    const today = getLocalDateString();
    const [{ data: stats }, { data: weights }] = await Promise.all([
        supabaseClient.rpc('new_me_day_stats', { p_from: first, p_to: last < today ? last : today }),
        supabaseClient.from('weight_tracker').select('weight_date, weight_value').eq('user_id', currentUserId).gte('weight_date', first).lte('weight_date', last),
    ]);
    const byDay = {};
    (first <= today ? (stats || []) : []).forEach(r => { byDay[r.day] = r; });
    const weightByDay = {};
    (weights || []).forEach(w => { weightByDay[w.weight_date] = w.weight_value; });
    const monthLabel = new Intl.DateTimeFormat(currentLang, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
    // כותרות ימים לפי שפת האפליקציה, שבוע מתחיל ביום ראשון (כמו שאר לוחות השנה באפליקציה)
    const dayNames = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(currentLang, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + i)));
    const lead = new Date(y, m - 1, 1).getDay();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="nm-cal-cell empty"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${nmMonthKey}-${String(d).padStart(2, '0')}`;
        const r = byDay[ds];
        const n = r ? Math.min(4, r.checks) : 0;
        const w = weightByDay[ds] != null ? nmFmtNum(Number(weightByDay[ds]), 1) : '';
        const mood = r && r.mood ? NEW_ME_CHECKIN_SCALES.mood[r.mood - 1] : '';
        cells += `<button type="button" class="nm-cal-cell lvl-${n}${ds === today ? ' today' : ''}" data-day="${ds}" title="${n}/4${w ? ' · ' + nmEsc(w) : ''}"><span class="nm-cal-day">${d}</span>${mood || (r && r.free) ? `<span class="nm-cal-mark">${r && r.free ? '🍕' : ''}${mood}</span>` : w ? `<span class="nm-cal-w">${nmEsc(w)}</span>` : ''}</button>`;
    }
    // ממוצע הקלוריות בחודש (בימים שנרשם בהם משהו) - לפי שאלה מפורשת: "האם יש טבלה חודשית שאפשר לראות אחורה? + קלוריות ממוצעות"
    const logged = Object.values(byDay).filter(r => Number(r.kcal) > 0);
    const avgKcal = logged.length ? Math.round(logged.reduce((a, r) => a + Number(r.kcal), 0) / logged.length) : 0;
    const avgHtml = logged.length ? `<p class="nm-month-avg">${nmEsc(t('nm_month_avg').replace('{kcal}', nmFmt(avgKcal)).replace('{n}', nmFmt(logged.length)))}</p>` : '';
    body.innerHTML = `
        <div class="nm-month-nav">
            <button type="button" class="nm-chip" onclick="nmShiftMonth(-1)">‹</button>
            <span class="nm-month-label">${nmEsc(monthLabel)}</span>
            <button type="button" class="nm-chip" onclick="nmShiftMonth(1)">›</button>
        </div>
        <div class="nm-cal">
            ${dayNames.map(n => `<span class="nm-cal-head">${nmEsc(n)}</span>`).join('')}
            ${cells}
        </div>
        <div class="nm-legend">${[0, 1, 2, 3, 4].map(n => `<span class="nm-cal-cell lvl-${n}"></span>`).join('')}<span>${nmEsc(t('nm_month_legend'))}</span></div>
        ${avgHtml}
        <div class="nm-month-day" aria-live="polite"></div>
        ${nmCheckinInsightHtml(Object.values(byDay))}
        <button type="button" class="nm-row-btn" onclick="nmGo('journey')">⚖️ ${nmEsc(t('nm_month_weight_link'))}</button>`;
    // נגיעה ביום: כמה ארוחות סומנו וכמה קלוריות נאכלו (ומשקל, אם נשקלו)
    const detail = body.querySelector('.nm-month-day');
    body.querySelectorAll('.nm-cal-cell[data-day]').forEach(cell => cell.addEventListener('click', () => {
        const ds = cell.dataset.day;
        const wasOn = cell.classList.contains('on');
        body.querySelectorAll('.nm-cal-cell.on').forEach(x => x.classList.remove('on'));
        if (wasOn || !detail) { if (detail) detail.innerHTML = ''; return; }
        cell.classList.add('on');
        const r = byDay[ds];
        const w = weightByDay[ds];
        let label = ds;
        try { label = new Intl.DateTimeFormat(currentLang, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(`${ds}T12:00:00`)); } catch (e) {}
        const has = r && (Number(r.checks) > 0 || Number(r.kcal) > 0);
        const line = has ? t('nm_month_day_line').replace('{checks}', nmFmt(Number(r.checks) || 0)).replace('{kcal}', nmFmt(Number(r.kcal) || 0)) : t('nm_month_day_empty');
        detail.innerHTML = `<div class="nm-month-day-title">${nmEsc(label)}</div><div class="nm-month-day-line">${nmEsc(line)}${w != null ? ` · ⚖️ <bdi dir="ltr">${nmEsc(nmFmtNum(Number(w), 1))}</bdi>` : ''}</div>`;
    }));
}

// ממוצעי הצ'ק-אין בחודש: בימים שהתפריט נשמר (3+ ארוחות) מול שאר הימים
function nmCheckinInsightHtml(rows) {
    const withCheckin = rows.filter(r => r.mood != null && r.energy != null && r.hunger != null);
    if (!withCheckin.length) return `<div class="nm-card nm-insight"><div class="nm-sheet-label">🌙 ${nmEsc(t('nm_insight_title'))}</div><p class="nm-fine">${nmEsc(t('nm_insight_empty'))}</p></div>`;
    const avg = (list, k) => list.length ? list.reduce((a, r) => a + r[k], 0) / list.length : null;
    const onPlan = withCheckin.filter(r => r.checks >= 3);
    const offPlan = withCheckin.filter(r => r.checks < 3);
    const cell = v => v == null ? '—' : `<bdi dir="ltr">${nmFmtNum(v, 1)}</bdi>`;
    const row = (label, list) => `<tr><th scope="row">${nmEsc(label)}</th>${NEW_ME_CHECKIN_KEYS.map(k => `<td class="nm-num">${cell(avg(list, k))}</td>`).join('')}<td class="nm-num nm-insight-n">${list.length}</td></tr>`;
    let line = '';
    const eOn = avg(onPlan, 'energy'), eOff = avg(offPlan, 'energy');
    const mOn = avg(onPlan, 'mood'), mOff = avg(offPlan, 'mood');
    if (onPlan.length >= 2 && offPlan.length >= 2) {
        if (eOn - eOff >= 0.5 || mOn - mOff >= 0.5) line = t('nm_insight_better');
        else if (eOff - eOn >= 0.5 || mOff - mOn >= 0.5) line = t('nm_insight_worse');
        else line = t('nm_insight_same');
    } else line = t('nm_insight_more_data');
    return `
        <div class="nm-card nm-insight">
            <div class="nm-sheet-label">🌙 ${nmEsc(t('nm_insight_title'))}</div>
            <div class="nm-table-wrap"><table class="nm-table nm-insight-table">
                <thead><tr><th></th>${NEW_ME_CHECKIN_KEYS.map(k => `<th>${NEW_ME_CHECKIN_SCALES[k][3]} ${nmEsc(t('nm_checkin_' + k))}</th>`).join('')}<th>${nmEsc(t('nm_insight_days'))}</th></tr></thead>
                <tbody>${row(t('nm_insight_on_plan'), onPlan)}${row(t('nm_insight_off_plan'), offPlan)}</tbody>
            </table></div>
            <p class="nm-fine">${nmEsc(line)}</p>
        </div>`;
}

function nmShiftMonth(delta) {
    const [y, m] = nmMonthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    nmMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    nmRenderMonth(document.getElementById('nm-view-body'));
}

// ---------- תזכורות לארוחות ----------
// שעה אחת לכל ארוחה, ברירת מחדל 10:00 / 13:00 / 16:00 / 19:00. נשלחות כהתראת Push מהשרת
// (send-due-reminders) גם כשהאפליקציה סגורה, ולא נשלחות אם הארוחה כבר סומנה. השורות בטבלה לפי
// מקום (1–4, ו-5 ל-21:00), אבל השעה שייכת לארוחה (slot): כשגוררים, השעה עוברת איתה למקום החדש
function nmReminderRow(i) { return nmReminders.find(r => r.position === i + 1) || null; }
function nmSlotDefaultTime(slot) { return (nmTwoMeals() && NEW_ME_TWO_MEAL_TIMES[slot]) || NEW_ME_REMINDER_DEFAULTS[Math.max(0, NEW_ME_DEFAULT_ORDER.indexOf(slot))]; }
function nmSlotReminderRow(slot) { return nmReminders.find(r => r.slot === slot && r.position <= 4) || null; }
function nmSlotReminderTime(slot) { const r = nmSlotReminderRow(slot); return (r && r.time) || nmSlotDefaultTime(slot); }
function nmSlotReminderEnabled(slot) { const r = nmSlotReminderRow(slot); return !r || r.enabled !== false; }
function nmReminderBody(slot, forToday) {
    if (forToday && nmIsFree(slot)) return `🍕 ${t('nm_free_meal')}`;
    const it = nmItemInfo(forToday ? nmTodayKey(slot) : nmPermanentKey(slot));
    return `${nmItemShort(it)} · ~${it.kcal} ${t('calories_unit')}`;
}
async function nmSyncReminders(change) {
    if (!nmProfile) return;
    const today = getLocalDateString();
    const nowMin = nmMinutesNow();
    const hidden = nmHiddenSlots();
    const rows = nmOrder().map((slot, i) => {
        // השעה, ההפעלה ו"נשלח היום" באים מהשורה של אותה ארוחה, גם אם היא זזה למקום אחר
        const prev = nmSlotReminderRow(slot) || nmReminderRow(i) || {};
        let time = prev.time || nmSlotDefaultTime(slot);
        let enabled = prev.enabled !== false;
        if (change && change.pos === i) {
            if (change.time) time = change.time;
            if (change.enabled != null) enabled = change.enabled;
        }
        // שעות האוכל (מהשגרה או שנבחרו כאן) - לכל הארוחות בבת אחת
        if (change && change.times && /^([01]\d|2[0-3]):[0-5]\d$/.test(change.times[slot] || '')) time = change.times[slot];
        // ארוחה שהוסרה מהתפריט - בלי תזכורת
        if (hidden.includes(slot)) enabled = false;
        const [h, m] = time.split(':').map(Number);
        // שעה שכבר עברה היום לא נשלחת מיד (למשל כשמדליקים תזכורות בצהריים)
        const passed = h * 60 + m <= nowMin;
        return {
            user_id: currentUserId, position: i + 1, slot, time, enabled,
            title: `🍽️ ${nmSlotName(slot)}`.slice(0, 160),
            body: nmReminderBody(slot, false).slice(0, 300),
            today_body: nmReminderBody(slot, true).slice(0, 300),
            today_date: today,
            last_sent_date: passed ? today : (prev.last_sent_date || null),
        };
    });
    // 21:00 (לבחירה) = מקום 5: משהו קטן / משהו לשתות; "בלי" או עוד לא נבחר = כבוי
    const late = nmLateChoice();
    const prevLate = nmLateRow() || {};
    let lateTime = prevLate.time || NEW_ME_LATE_TIME;
    let lateOn = prevLate.enabled !== false;
    if (change && change.pos === 4) {
        if (change.time) lateTime = change.time;
        if (change.enabled != null) lateOn = change.enabled;
    }
    const [lh, lm] = lateTime.split(':').map(Number);
    const lateBody = t(late === 'drink' ? 'nm_late_rem_drink_body' : 'nm_late_rem_eat_body').replace('{kcal}', nmFmt(nmLateKcal(late))).slice(0, 300);
    rows.push({
        user_id: currentUserId, position: 5, slot: 'late', time: lateTime,
        enabled: (late === 'eat' || late === 'drink') && lateOn,
        title: t(late === 'drink' ? 'nm_late_rem_drink_title' : 'nm_late_rem_eat_title').slice(0, 160),
        body: lateBody, today_body: lateBody, today_date: today,
        last_sent_date: lh * 60 + lm <= nowMin ? today : (prevLate.last_sent_date || null),
    });
    const sig = JSON.stringify(rows);
    if (sig === nmReminderSig && !change) return;
    const { data, error } = await supabaseClient.from('new_me_reminders').upsert(rows.map(r => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: 'user_id,position' }).select();
    if (error) { if (change) showAppToast(t('nm_save_error'), 'error'); return; }
    nmReminders = data || rows;
    nmReminderSig = sig;
}
function nmNotifyState() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
    return Notification.permission;
}
function nmRenderReminders(body) {
    if (!body || nmView !== 'reminders') return;
    const on = !!nmProfile.reminders_on;
    const perm = nmNotifyState();
    const order = nmOrder();
    const hiddenSlots = nmHiddenSlots();
    const late = nmLateChoice();
    const lateRow = nmLateRow();
    body.innerHTML = `
        <div class="nm-card">
            <label class="nm-switch-row">
                <span><b>${nmEsc(t('nm_rem_toggle'))}</b><span class="nm-fine">${nmEsc(t('nm_rem_toggle_sub'))}</span></span>
                <input type="checkbox" class="nm-switch" ${on ? 'checked' : ''} onchange="nmToggleReminders(this.checked)">
            </label>
            ${on && perm !== 'granted' ? `
            <div class="nm-soft-warn nm-rem-perm">
                ${nmEsc(t(perm === 'denied' ? 'settings_notifications_status_denied' : perm === 'unsupported' ? 'settings_notifications_status_unsupported' : 'nm_rem_need_permission'))}
                ${perm === 'default' ? `<button type="button" class="nm-chip" onclick="nmEnableNotifications()">${nmEsc(t('settings_notifications_btn_enable'))}</button>` : ''}
            </div>` : ''}
        </div>
        <div class="nm-card nm-rem-list${on ? '' : ' is-off'}">
            ${order.map((slot, i) => hiddenSlots.includes(slot) ? '' : `
                <div class="nm-rem-row">
                    <div class="nm-rem-text"><b>${nmEsc(nmSlotName(slot))}</b><span>${nmEsc(nmItemShort(nmItemInfo(nmPermanentKey(slot))))}</span></div>
                    ${nmTimeBtnHtml('rem-' + i, nmSlotReminderTime(slot), nmSlotName(slot), v => nmQueueReminderTime(i, v), !on)}
                    <input type="checkbox" class="nm-switch" ${nmSlotReminderEnabled(slot) ? 'checked' : ''} onchange="nmSetReminderEnabled(${i}, this.checked)" ${on ? '' : 'disabled'} aria-label="${nmEsc(nmSlotName(slot))}">
                </div>`).join('')}
        </div>
        <div class="nm-card nm-late-card">
            ${late && !nmLateEditing ? `
            <div class="nm-late-head">
                <div class="nm-slot-name">🌙 ${nmEsc(t('nm_late_title'))}</div>
                <button type="button" class="nm-chip" onclick="nmEditLateChoice()">${nmEsc(t('nm_late_change'))}</button>
            </div>
            ${late === 'none' ? `<div class="nm-late-picked">${nmEsc(nmLateLabel('none'))}</div>` : ''}` : `
            <div class="nm-slot-name">🌙 ${nmEsc(t('nm_late_title'))}</div>
            ${nmLateChoicesHtml(late, 'nmSetLateChoice')}`}
            ${nmLatePicksHtml(late, 'day')}${nmBudgetBoxHtml(nmProfile.plan, late)}
            ${late === 'eat' || late === 'drink' ? `
            <div class="nm-rem-row${on ? '' : ' is-off'}">
                <div class="nm-rem-text"><b>${nmEsc(nmLateLabel(late))}</b><span>${nmEsc(t(late === 'eat' ? 'nm_late_row_eat' : 'nm_late_row_drink').replace('{kcal}', nmFmt(nmLateKcal(late))))}</span></div>
                ${nmTimeBtnHtml('rem-4', nmLateTime(), nmLateLabel(late), v => nmQueueReminderTime(4, v), !on)}
                <input type="checkbox" class="nm-switch" ${lateRow && lateRow.enabled === false ? '' : 'checked'} onchange="nmSetReminderEnabled(4, this.checked)" ${on ? '' : 'disabled'} aria-label="${nmEsc(nmLateLabel(late))}">
            </div>` : ''}
        </div>`;
}
async function nmToggleReminders(on) {
    nmProfile.reminders_on = on;
    const { error } = await supabaseClient.from('new_me_profile').update({ reminders_on: on, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (error) { nmProfile.reminders_on = !on; showAppToast(t('nm_save_error'), 'error'); nmRenderReminders(document.getElementById('nm-view-body')); return; }
    if (on) {
        await nmSyncReminders({});
        // הדלקה מפורשת של תזכורות = רוצים התראות; גם אם ההתראות הושתקו בהגדרות, מחזירים את המנוי
        try { localStorage.setItem('weekwise_notifications_enabled', 'true'); } catch { /* ok */ }
        if (nmNotifyState() === 'default') await nmEnableNotifications();
        else if (nmNotifyState() === 'granted' && typeof registerPushNotifications === 'function') registerPushNotifications();
    }
    showAppToast(t(on ? 'nm_rem_on_toast' : 'nm_rem_off_toast'));
    nmRenderReminders(document.getElementById('nm-view-body'));
}
async function nmEnableNotifications() {
    if (typeof requestNotificationPermissionFromSettings === 'function') await requestNotificationPermissionFromSettings();
    if (nmView === 'reminders') nmRenderReminders(document.getElementById('nm-view-body'));
}
async function nmSetReminderTime(i, value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return;
    await nmSyncReminders({ pos: i, time: value });
    showAppToast(t('nm_rem_saved'));
}
async function nmSetReminderEnabled(i, on) {
    await nmSyncReminders({ pos: i, enabled: on });
}

// ---------- PDF / הגדרות ----------
async function nmOpenPdf(btn) {
    // חלון נפתח מיד (בתוך אירוע הלחיצה) כדי שדפדפנים לא יחסמו אותו כחלון קופץ
    const win = window.open('', '_blank');
    showAppToast(t('nm_pdf_opening'));
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/new-me-pdf-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ lang: currentLang }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.url) throw new Error('no url');
        if (win) win.location.href = result.url; else window.location.href = result.url;
    } catch {
        if (win) win.close();
        showAppToast(t('nm_pdf_error'), 'error');
    }
}

// "המסלול שלך": לכל החיים, או חודשי - מתי מתחדש / עד מתי פתוח אחרי ביטול, ניהול המנוי
// (ה-Portal של Lemon Squeezy: ביטול, אמצעי תשלום) ומעבר ל"לכל החיים" (החודשי נעצר לבד - ר' webhook)
function nmBillingHtml() {
    if (typeof isDevSuperuserAccount !== 'undefined' && isDevSuperuserAccount) {
        return `<div class="nm-settings-block nm-bill"><div class="nm-slot-name">${nmEsc(t('nm_bill_title'))}</div><div class="nm-bill-status">${nmEsc(t('settings_sub_status_dev'))}</div></div>`;
    }
    const b = (typeof newMeBilling !== 'undefined' && newMeBilling) || {};
    const day = iso => (iso ? nmLongDate(getLocalDateString(new Date(iso))) : '');
    let status = `⭐ ${t('nm_bill_life')}`;
    let actions = '';
    if (b.plan === 'monthly') {
        if (b.status === 'cancelled') status = t('nm_bill_monthly_ends').replace('{date}', day(b.endsAt));
        else if (b.status === 'past_due' || b.status === 'unpaid') status = t('nm_bill_monthly_issue');
        else status = b.renewsAt ? t('nm_bill_monthly_renews').replace('{date}', day(b.renewsAt)) : t('nm_plan_monthly');
        actions = `
            <button type="button" class="nm-row-btn" onclick="openLemonSqueezyPortal('new_me')">💳 ${nmEsc(t('nm_bill_manage'))}</button>
            <button type="button" class="nm-row-btn nm-bill-upgrade" onclick="submitNewMePurchase(this, 'life')">⭐ ${nmEsc(t('nm_bill_upgrade').replace('{price}', NEW_ME_PRICES.life))}</button>
            <p class="nm-fine">${nmEsc(t('nm_bill_upgrade_note'))}</p>`;
    }
    return `
        <div class="nm-settings-block nm-bill">
            <div class="nm-slot-name">${nmEsc(t('nm_bill_title'))}</div>
            <div class="nm-bill-status">${nmEsc(status)}</div>
            ${actions}
        </div>`;
}

function nmRenderSettings(body) {
    const customOrder = nmOrder().join(',') !== NEW_ME_DEFAULT_ORDER.join(',');
    body.innerHTML = `
        ${nmBillingHtml()}
        <div class="nm-settings-block">
            <div class="nm-slot-name">${nmEsc(t('nm_settings_plan'))}</div>
            <div class="nm-plan-cards">
                ${[1300, 1500].map(p => `
                    <button type="button" class="nm-plan-card${nmProfile.plan === p ? ' selected' : ''}" onclick="nmChangePlan(${p})">
                        <span class="nm-plan-num">${nmFmt(p)}</span>
                        <span class="nm-plan-unit">${nmEsc(t('calories_unit'))}</span>
                    </button>`).join('')}
            </div>
            <p class="nm-fine">${nmEsc(t('nm_q_plan_note'))}</p>
        </div>
        <div class="nm-settings-block">
            <label class="nm-field"><span>${nmEsc(t('nm_q_full_name'))}</span>
                <input type="text" id="nm-settings-name" maxlength="60" autocomplete="name" value="${nmEsc(nmProfile.cert_name || '')}" placeholder="${nmEsc(t('nm_cert_name_ph'))}" onchange="nmSaveFullName(this)"></label>
        </div>
        <button type="button" class="nm-row-btn" onclick="nmStartTour()">🧭 ${nmEsc(t('nm_settings_tour'))}</button>
        <button type="button" class="nm-row-btn" onclick="nmStartMenuQuiz('settings')">🍽️ ${nmEsc(t('nm_q_menu_title'))}</button>
        <button type="button" class="nm-row-btn" onclick="nmOpenMagicPicker(false)">🎨 ${nmEsc(t('nm_settings_colors'))}</button>
        <button type="button" class="nm-row-btn" onclick="nmOpenMealTimes()">🕐 ${nmEsc(t('nm_times_title'))}</button>
        <button type="button" class="nm-row-btn" onclick="nmGo('reminders')">⏰ ${nmEsc(t('nm_tile_reminders'))}</button>
        <button type="button" class="nm-row-btn" onclick="nmCheckRoutineMeals(true)">🍽️ ${nmEsc(t('nm_settings_routine'))}</button>
        ${nmDiaryMenuRowHtml()}
        ${customOrder ? `<button type="button" class="nm-row-btn" onclick="nmSaveOrder(NEW_ME_DEFAULT_ORDER.slice()); nmGo('settings')">↺ ${nmEsc(t('nm_order_reset'))}</button>` : ''}
        <button type="button" class="nm-row-btn" onclick="nmStartQuiz(true); renderNewMe()">📝 ${nmEsc(t('nm_settings_retake'))}</button>
        <details class="nm-row-details">
            <summary>⚕️ ${nmEsc(t('nm_settings_disclaimer'))}</summary>
            ${nmDisclaimerHtml()}
        </details>
        ${nmDevKeysSlotHtml()}`;
    if (nmDevKeysSlotHtml() && typeof roomRenderDevKeys === 'function') {
        if (typeof roomLoaded !== 'undefined' && !roomLoaded && typeof roomLoad === 'function') roomLoad().then(roomRenderDevKeys);
        else roomRenderDevKeys();
    }
}
// 🔑 רק למפתחת (לפי בקשה מפורשת, 2026-10-14: "כפתור קטן בהגדרות של המשחק החדש רק לי כמפתחת לפתוח אתגרים המנעול שיש
// לי עכשיו רק שם"): + מפתח כמו אחרי אתגר, − סוגר אותו. רק כאן - לא במסדרון ולא בעולמות (ר' roomRenderDevKeys)
function nmDevKeysSlotHtml() { return typeof roomIsDev === 'function' && roomIsDev() ? '<div class="nm-settings-block nm-dev-keys-slot"></div>' : ''; }

async function nmSaveFullName(input) {
    const name = String(input.value || '').trim().slice(0, 60);
    if (name.length < 2) { showAppToast(t('nm_q_full_name_missing'), 'error'); input.value = nmProfile.cert_name || ''; return; }
    const { error } = await supabaseClient.from('new_me_profile').update({ cert_name: name, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
    nmProfile.cert_name = name;
    showAppToast(t('nm_name_saved'));
}

// ---------- סיור קטן ב-New Me (לפי בקשה מפורשת: "סיור קטן בפני עצמו אחרי שמשלמים") ----------
// אותו מנגנון של הסיור באפליקציה (הדגשה + כרטיס הסבר), על המסך של New Me. נפתח לבד פעם אחת -
// אחרי הרכישה והשאלון (או בכניסה הראשונה של מי שכבר רכש/ה), ומההגדרות של New Me בכל רגע
const NEW_ME_TOUR_STEPS = [
    { id: 'nm_welcome', ch: 'newme', ctx: 'newme', icon: NM_ICON_SVG, titleKey: 'nm_tour_welcome_title', text: 'nm_tour_welcome_text' },
    // המסדרון (המסך הראשי): המנורות = הארוחות, התרמיל = כל New Me, ודלת 1 לחדר
    { id: 'nm_bag', ch: 'newme', ctx: 'newme', icon: '🎒', target: '#new-me-root .nmh-bag', titleKey: 'nm_tour_bag_title', text: 'nm_tour_bag_text', optional: true },
    { id: 'nm_room', ch: 'newme', ctx: 'newme', icon: '🗝️', target: '#new-me-root .nmh-door[data-door="1"]', titleKey: 'room_title', text: 'room_tour_text', optional: true },
    { id: 'nm_done', ch: 'newme', ctx: 'newme', icon: '💪', titleKey: 'nm_tour_done_title', text: 'nm_tour_done_text' },
];
function nmTourSeen() { try { return localStorage.getItem('weekwise_nm_tour_seen') === '1'; } catch { return true; } }
function nmStartTour() {
    try { localStorage.setItem('weekwise_nm_tour_seen', '1'); } catch {}
    // השלבים נבחרים לפי מה שמוצג במסך הראשי של New Me - חוזרים אליו קודם (למשל כשנפתח מההגדרות)
    if (nmView !== 'home') nmGo('home');
    if (typeof openAppTour === 'function') openAppTour(true, null, { steps: NEW_ME_TOUR_STEPS, keepScreen: true });
}
function nmMaybeAutoTour() {
    if (nmTourSeen() || nmView !== 'home' || nmQuiz) return;
    try { localStorage.setItem('weekwise_nm_tour_seen', '1'); } catch {}
    // מחכים שחגיגת הישג (אם קופצת) תיסגר, ושהמסך של New Me עדיין פתוח
    let tries = 0;
    const attempt = () => {
        const sec = document.getElementById('new-me-section');
        if (!sec || !sec.classList.contains('active-tab') || nmView !== 'home' || (typeof appTourActive !== 'undefined' && appTourActive)) return;
        if (document.querySelector('.nm-sheet-overlay') && ++tries < 40) { setTimeout(attempt, 500); return; }
        nmStartTour();
    };
    setTimeout(attempt, 700);
}

async function nmChangePlan(p) {
    if (nmProfile.plan === p) return;
    const old = nmProfile.plan;
    // החלפה קבועה מהתוכנית הקודמת עוברת לאותה מנה בתוכנית החדשה (המנות מותאמות לתוכנית)
    const updates = { plan: p, updated_at: new Date().toISOString() };
    NEW_ME_SLOTS.forEach(slot => {
        const it = nmParseItem(nmProfile['choice_' + slot]);
        if (it && it.plan === old) updates['choice_' + slot] = it.slot === slot ? it.opt : nmItemKey(p, it.slot, it.opt);
    });
    const { error } = await supabaseClient.from('new_me_profile').update(updates).eq('user_id', currentUserId);
    if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
    Object.assign(nmProfile, updates);
    await nmSyncCalorieGoal();
    showAppToast(t('nm_plan_changed_toast'));
    nmRenderView(nmRoot());
    if (nmProfile.reminders_on) nmSyncReminders();
}

// ---------- "דגשי תזונה": כרטיסי סטורי (אחד לכל נושא, איור + נקודה מרכזית) ----------
// הקשה בצד הקריאה / החלקה / חיצים עוברים כרטיס. 3 הטיפים של התוכנית (מה-PDF) נכנסו לכאן
const NEW_ME_STORIES = ['cover', 'tip_water', 'tip_veggies', 'tip_personal', 'tip_spread', 'tip_pita', 'tip_salad', 'raw', 'pot', 'after', 'weekly', 'out', 'estimate', 'control', 'outro'];
const NEW_ME_STORY_ART = {
    tip_spread: '<circle cx="80" cy="82" r="56" class="sa-soft"/><rect x="52" y="62" width="56" height="58" rx="10" class="sa-fill"/><rect x="52" y="62" width="56" height="58" rx="10" class="sa-line"/><rect x="48" y="50" width="64" height="14" rx="5" class="sa-accent"/><path d="M62 92h36" class="sa-line sa-thin"/><path d="M104 36l-26 44" class="sa-line"/><ellipse cx="76" cy="84" rx="8" ry="5" class="sa-accent-soft"/>',
    tip_pita: '<circle cx="80" cy="82" r="56" class="sa-soft"/><path d="M34 98a46 46 0 0 1 92 0z" class="sa-fill"/><path d="M34 98a46 46 0 0 1 92 0z" class="sa-line"/><path d="M50 98a30 30 0 0 1 60 0" class="sa-line sa-thin"/><circle cx="64" cy="80" r="3" class="sa-accent"/><circle cx="86" cy="72" r="3" class="sa-accent"/><circle cx="100" cy="88" r="3" class="sa-accent"/>',
    tip_salad: '<circle cx="80" cy="82" r="56" class="sa-soft"/><path d="M36 86h88a44 32 0 0 1-88 0z" class="sa-fill"/><path d="M36 86h88a44 32 0 0 1-88 0z" class="sa-line"/><path d="M56 86c-4-14 4-24 14-26 2 12-4 20-14 26z" class="sa-accent-soft"/><path d="M78 86c0-16 10-24 20-24 0 12-8 20-20 24z" class="sa-accent-soft"/><circle cx="98" cy="82" r="6" class="sa-accent"/>',
    cover: '<circle cx="80" cy="80" r="56" class="sa-soft"/><rect x="46" y="44" width="68" height="78" rx="8" class="sa-fill"/><rect x="46" y="44" width="68" height="78" rx="8" class="sa-line"/><line x1="58" y1="62" x2="102" y2="62" class="sa-line"/><line x1="58" y1="76" x2="96" y2="76" class="sa-line sa-thin"/><line x1="58" y1="88" x2="100" y2="88" class="sa-line sa-thin"/><line x1="58" y1="100" x2="86" y2="100" class="sa-line sa-thin"/><path d="M118 34l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" class="sa-accent"/><path d="M36 108l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" class="sa-accent"/>',
    tip_water: '<circle cx="80" cy="82" r="56" class="sa-soft"/><path d="M54 40h52l-6 84a8 8 0 0 1-8 7H68a8 8 0 0 1-8-7z" class="sa-fill"/><path d="M57 74c8 5 16 5 23 0s15-5 23 0l-3 50a8 8 0 0 1-8 7H68a8 8 0 0 1-8-7z" class="sa-accent-soft"/><path d="M54 40h52l-6 84a8 8 0 0 1-8 7H68a8 8 0 0 1-8-7z" class="sa-line"/><path d="M118 52c0 0-8 10-8 15a8 8 0 0 0 16 0c0-5-8-15-8-15z" class="sa-accent"/><circle cx="72" cy="98" r="3" class="sa-dot"/><circle cx="86" cy="110" r="2.2" class="sa-dot"/>',
    tip_veggies: '<circle cx="80" cy="84" r="56" class="sa-soft"/><path d="M34 88h92a46 30 0 0 1-92 0z" class="sa-fill"/><path d="M34 88h92a46 30 0 0 1-92 0z" class="sa-line"/><path d="M58 88c-6-16 2-30 14-34 2 14-4 26-14 34z" class="sa-accent"/><path d="M80 88c0-18 10-30 22-32-1 14-9 26-22 32z" class="sa-accent-soft"/><circle cx="98" cy="80" r="8" class="sa-accent"/><circle cx="66" cy="80" r="6" class="sa-accent-soft"/><path d="M118 46c-6 0-10 4-10 10" class="sa-line sa-thin"/><circle cx="120" cy="44" r="4" class="sa-dot"/>',
    tip_personal: '<circle cx="80" cy="80" r="56" class="sa-soft"/><circle cx="80" cy="80" r="34" class="sa-fill"/><circle cx="80" cy="80" r="34" class="sa-line"/><circle cx="80" cy="80" r="20" class="sa-line sa-thin"/><path d="M40 52a48 48 0 0 1 60-20" class="sa-line"/><path d="M96 26l6 7-9 3" class="sa-line"/><path d="M120 108a48 48 0 0 1-60 20" class="sa-line"/><path d="M64 134l-6-7 9-3" class="sa-line"/>',
    raw: '<circle cx="80" cy="84" r="56" class="sa-soft"/><rect x="36" y="96" width="88" height="30" rx="10" class="sa-fill"/><rect x="36" y="96" width="88" height="30" rx="10" class="sa-line"/><rect x="62" y="104" width="36" height="14" rx="4" class="sa-accent-soft"/><path d="M46 96c4-22 20-34 34-34s30 12 34 34z" class="sa-fill"/><path d="M46 96c4-22 20-34 34-34s30 12 34 34" class="sa-line"/><path d="M66 70c4-8 10-12 18-12" class="sa-line sa-thin"/><circle cx="72" cy="80" r="6" class="sa-accent"/><circle cx="88" cy="78" r="5" class="sa-accent-soft"/>',
    pot: '<circle cx="80" cy="84" r="56" class="sa-soft"/><path d="M40 70h80v36a18 18 0 0 1-18 18H58a18 18 0 0 1-18-18z" class="sa-fill"/><path d="M40 70h80v36a18 18 0 0 1-18 18H58a18 18 0 0 1-18-18z" class="sa-line"/><line x1="32" y1="72" x2="128" y2="72" class="sa-line"/><line x1="80" y1="74" x2="80" y2="122" class="sa-line sa-dash"/><line x1="60" y1="74" x2="60" y2="120" class="sa-line sa-dash"/><line x1="100" y1="74" x2="100" y2="120" class="sa-line sa-dash"/><path d="M64 58c-4-6 4-10 0-16M80 58c-4-6 4-10 0-16M96 58c-4-6 4-10 0-16" class="sa-line sa-thin"/>',
    after: '<circle cx="80" cy="84" r="56" class="sa-soft"/><path d="M36 86h88a44 36 0 0 1-88 0z" class="sa-fill"/><path d="M36 86h88a44 36 0 0 1-88 0z" class="sa-line"/><path d="M44 86c6-12 18-18 36-18s30 6 36 18z" class="sa-accent-soft"/><circle cx="66" cy="78" r="2.4" class="sa-dot"/><circle cx="80" cy="74" r="2.4" class="sa-dot"/><circle cx="94" cy="78" r="2.4" class="sa-dot"/><circle cx="74" cy="82" r="2" class="sa-dot"/><circle cx="88" cy="82" r="2" class="sa-dot"/><path d="M66 56c-4-6 4-10 0-16M94 56c-4-6 4-10 0-16" class="sa-line sa-thin"/>',
    weekly: '<circle cx="80" cy="82" r="56" class="sa-soft"/><line x1="34" y1="122" x2="126" y2="122" class="sa-line"/><rect x="40" y="92" width="10" height="30" rx="3" class="sa-fill"/><rect x="54" y="78" width="10" height="44" rx="3" class="sa-fill"/><rect x="68" y="98" width="10" height="24" rx="3" class="sa-fill"/><rect x="82" y="60" width="10" height="62" rx="3" class="sa-accent-soft"/><rect x="96" y="88" width="10" height="34" rx="3" class="sa-fill"/><rect x="110" y="84" width="10" height="38" rx="3" class="sa-fill"/><path d="M38 90c20-6 42-6 84-4" class="sa-line sa-accent-line"/>',
    out: '<circle cx="80" cy="82" r="56" class="sa-soft"/><circle cx="80" cy="84" r="34" class="sa-fill"/><circle cx="80" cy="84" r="34" class="sa-line"/><circle cx="80" cy="84" r="22" class="sa-line sa-thin"/><path d="M70 76c4-6 16-6 20 0 2 6-4 14-10 14s-12-8-10-14z" class="sa-accent-soft"/><path d="M34 50v28M30 50v14a4 4 0 0 0 8 0V50M34 78v44" class="sa-line"/><path d="M126 50c-8 6-8 26 0 30v42" class="sa-line"/>',
    estimate: '<circle cx="80" cy="82" r="56" class="sa-soft"/><rect x="40" y="44" width="58" height="72" rx="8" class="sa-fill"/><rect x="40" y="44" width="58" height="72" rx="8" class="sa-line"/><line x1="52" y1="62" x2="86" y2="62" class="sa-line sa-thin"/><line x1="52" y1="76" x2="80" y2="76" class="sa-line sa-thin"/><line x1="52" y1="90" x2="84" y2="90" class="sa-line sa-thin"/><circle cx="100" cy="92" r="20" class="sa-accent-soft"/><circle cx="100" cy="92" r="20" class="sa-line"/><line x1="114" y1="106" x2="128" y2="120" class="sa-line sa-thick"/>',
    control: '<circle cx="80" cy="82" r="56" class="sa-soft"/><circle cx="80" cy="84" r="38" class="sa-fill"/><circle cx="80" cy="84" r="38" class="sa-line"/><circle cx="80" cy="84" r="24" class="sa-line"/><circle cx="80" cy="84" r="10" class="sa-accent"/><path d="M80 84l38-38" class="sa-line sa-thick"/><path d="M110 42l12-2-2 12-8 2z" class="sa-accent"/>',
    outro: '<circle cx="80" cy="82" r="56" class="sa-soft"/><path d="M80 124s-34-20-42-42c-6-16 4-32 20-32 10 0 16 6 22 14 6-8 12-14 22-14 16 0 26 16 20 32-8 22-42 42-42 42z" class="sa-accent-soft"/><path d="M80 124s-34-20-42-42c-6-16 4-32 20-32 10 0 16 6 22 14 6-8 12-14 22-14 16 0 26 16 20 32-8 22-42 42-42 42z" class="sa-line"/><path d="M122 34l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" class="sa-accent"/><path d="M34 40l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" class="sa-accent"/>'
};
function nmStoryContent(k) {
    if (k.startsWith('tip_')) {
        const txt = newMeText(k);
        const idx = txt.search(/[:：]/);
        return idx > 0 ? { title: txt.slice(0, idx).trim(), text: txt.slice(idx + 1).trim() } : { title: t('nutrition_daily_tile_title'), text: txt };
    }
    if (k === 'cover') return { title: t('nutrition_daily_tile_title'), text: t('nm_story_cover_sub') };
    return { title: t('nm_story_' + k + '_title'), text: t('nm_story_' + k + '_text') };
}
function nmOpenStories() {
    let i = 0;
    const rtl = document.documentElement.dir === 'rtl' || document.body.dir === 'rtl' || getComputedStyle(document.body).direction === 'rtl';
    const ov = document.createElement('div');
    ov.className = 'nm-story-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', t('nutrition_daily_tile_title'));
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
    const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); };
    const go = d => { const n = i + d; if (n < 0) return; if (n >= NEW_ME_STORIES.length) { close(); return; } i = n; render(); };
    const render = () => {
        const k = NEW_ME_STORIES[i];
        const c = nmStoryContent(k);
        const last = i === NEW_ME_STORIES.length - 1;
        ov.innerHTML = `
            <div class="nm-story" data-k="${k}">
                <div class="nm-story-bars" aria-hidden="true">${NEW_ME_STORIES.map((_, j) => `<span class="${j < i ? 'done' : j === i ? 'now' : ''}"></span>`).join('')}</div>
                <button type="button" class="nm-story-close" aria-label="${nmEsc(t('close_btn'))}">✕</button>
                <div class="nm-story-body">
                    <svg class="nm-story-art" viewBox="0 0 160 160" aria-hidden="true">${NEW_ME_STORY_ART[k] || NEW_ME_STORY_ART.cover}</svg>
                    ${k === 'cover' ? `<div class="nm-story-eyebrow">🎁 ${nmEsc(t('nm_bonus_label'))} · New Me</div>` : ''}
                    <h3 class="nm-story-title">${nmEsc(c.title)}</h3>
                    <p class="nm-story-text">${nmEsc(c.text)}</p>
                    ${k === 'cover' ? `<p class="nm-story-hint">${nmEsc(t('nm_story_hint'))}</p>` : ''}
                    ${last ? `<div class="nm-story-end"><button type="button" class="nm-btn-ghost" data-restart>↺ ${nmEsc(t('nm_story_restart'))}</button><button type="button" class="nm-btn-primary" data-done>${nmEsc(t('close_btn'))}</button></div>` : ''}
                </div>
                <div class="nm-story-foot"><span class="nm-num"><bdi dir="ltr">${i + 1} / ${NEW_ME_STORIES.length}</bdi></span></div>
                <button type="button" class="nm-story-tap prev" aria-label="${nmEsc(t('nm_story_prev'))}" ${i === 0 ? 'disabled' : ''}></button>
                <button type="button" class="nm-story-tap next" aria-label="${nmEsc(t('nm_story_next'))}"></button>
            </div>`;
        ov.querySelector('.nm-story-close').addEventListener('click', close);
        // החלקה מסתיימת גם ב"לחיצה" על אזור ההקשה - לא סופרים אותה פעמיים
        ov.querySelector('.nm-story-tap.prev').addEventListener('click', () => { if (Date.now() - lastSwipe > 350) go(-1); });
        ov.querySelector('.nm-story-tap.next').addEventListener('click', () => { if (Date.now() - lastSwipe > 350) go(1); });
        const done = ov.querySelector('[data-done]');
        if (done) done.addEventListener('click', close);
        const restart = ov.querySelector('[data-restart]');
        if (restart) restart.addEventListener('click', () => { i = 0; render(); });
    };
    // החלקה אופקית: לכיוון הקריאה = הבא
    let sx = null, sy = null, lastSwipe = 0;
    ov.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
    ov.addEventListener('pointerup', e => {
        if (sx == null) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        sx = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
        lastSwipe = Date.now();
        go((dx < 0) !== rtl ? 1 : -1);
    });
    const onKey = e => {
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') go(rtl ? 1 : -1);
        else if (e.key === 'ArrowRight') go(rtl ? -1 : 1);
    };
    document.addEventListener('keydown', onKey);
    render();
}
