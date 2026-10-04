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
const NEW_ME_TILE_ICONS = { challenges: '🏆', gift: '🎁', stats: '📊', journey: '📈', shop: '🛒', badges: '🏅', measure: '📏', photos: '📸', month: '📅', table: '📋', reminders: '⏰', pdf: '📄', settings: '⚙️', bonus: '📰' };
// אתגרים, מכתב מהעבר והמתנה בסוף (תעודה, מצב מתקדם וסטטיסטיקות) - new-me-challenges.js
const NEW_ME_TILES = ['challenges', 'journey', 'shop', 'badges', 'measure', 'photos', 'month', 'table', 'reminders', 'pdf'];
const NEW_ME_VIEW_TITLES = { challenges: 'nm_tile_challenges', gift: 'nm_gift_title', stats: 'nm_stats_title', journey: 'nm_tile_journey', shop: 'nm_tile_shop', badges: 'nm_tile_badges', measure: 'nm_tile_measure', photos: 'nm_tile_photos', month: 'nm_tile_calendar', table: 'nm_tile_table', reminders: 'nm_tile_reminders', pdf: 'nm_tile_pdf', settings: 'nm_tile_settings' };
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
let nmPendingDeepLink = false; // לחיצה על תזכורת ארוחה - פותחים את New Me כשמצב הרכישה ידוע
let nmCustomMeals = [];        // new_me_custom_meals: ארוחות שנבחרו מהארוחות הקבועות או נכתבו ל-AI (מפתח c_<id>)
let nmBurnedToday = 0;         // קלוריות שנשרפו באימונים היום - מגדילות את התקציב (לפי בחירה מפורשת)

function nmEsc(s) { return escapeHtmlForReport(s == null ? '' : s); }
function nmFmt(n) { try { return Number(n).toLocaleString(currentLang); } catch { return String(n); } }
function nmFmtNum(n, digits = 1) { try { return new Intl.NumberFormat(currentLang, { maximumFractionDigits: digits }).format(n); } catch { return String(n); } }
function nmOptText(plan, slot, opt, short) { return newMeText(`p${plan}_${slot}_${opt}${short ? '_t' : ''}`); }
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
function nmParseItem(key) {
    const m = /^p(1300|1500)_(meal1|snack1|meal2|snack2)_([ABC])$/.exec(key || '');
    return m ? { key, plan: Number(m[1]), slot: m[2], opt: m[3] } : null;
}
// ארוחה אישית (מהארוחות הקבועות או מכתיבה ל-AI) - מפתח c_<uuid> מטבלת new_me_custom_meals
function nmIsCustomKey(key) { return /^c_[0-9a-f-]{36}$/i.test(key || ''); }
function nmCustomMeal(key) { return nmIsCustomKey(key) ? nmCustomMeals.find(m => 'c_' + m.id === key) || null : null; }
function nmValidKey(key) { return !!(nmParseItem(key) || nmCustomMeal(key)); }
function nmItemInfo(key) {
    const cm = nmCustomMeal(key);
    if (cm) return { key, custom: true, source: cm.source, plan: nmProfile ? nmProfile.plan : 1300, slot: null, opt: null, kcal: Number(cm.kcal) || 0, protein: Math.round((Number(cm.protein) || 0) * 10) / 10, name: cm.name, text: cm.description || '' };
    const p = nmParseItem(key);
    if (!p) return null;
    const o = NEW_ME_PLANS[p.plan][p.slot].options[p.opt];
    return { ...p, kcal: o.kcal, protein: o.protein };
}
function nmItemShort(it) { return it.custom ? it.name : nmOptText(it.plan, it.slot, it.opt, true); }
function nmItemFull(it) { return it.custom ? (it.text || t(it.source === 'ai' ? 'nm_custom_from_ai' : 'nm_custom_from_saved')) : nmOptText(it.plan, it.slot, it.opt); }
// הבחירה הקבועה של משבצת (choice_meal1...): אות בודדת = אפשרות של אותה ארוחה בתוכנית
// הנוכחית (כך שמעבר 1,300↔1,500 מתאים את המנה); מפתח מלא = פריט מכל התפריט או ארוחה אישית
function nmPermanentKey(slot) {
    const v = (nmProfile && nmProfile['choice_' + slot]) || 'A';
    if (/^[ABC]$/.test(v)) return nmItemKey(nmProfile.plan, slot, v);
    return nmValidKey(v) ? v : nmItemKey(nmProfile.plan, slot, 'A');
}
function nmIsOverride(slot) { return !!(nmToday && nmToday.overrides && nmValidKey(nmToday.overrides[slot])); }
function nmTodayKey(slot) { return nmIsOverride(slot) ? nmToday.overrides[slot] : nmPermanentKey(slot); }
function nmIsFree(slot) { return !!(nmToday && nmToday.free_slot === slot); }
function nmFreeKcal() { return (nmToday && Number(nmToday.free_kcal)) || NEW_ME_FREE_MEAL_KCAL; }
// לשאלון: האות שנבחרה לכל משבצת (פריט מכל התפריט → A)
function nmChoice(slot) { const v = nmProfile && nmProfile['choice_' + slot]; return /^[ABC]$/.test(v || '') ? v : 'A'; }

// ---------- סדר ושמות לפי שעת היום ----------
// הסדר נשמר כקבוע (new_me_profile.meal_order); השם נקבע לפי המיקום - בוקר / נשנוש / צהריים /
// נשנוש ערב - כך שגרירת ארוחה למקום אחר משנה גם את השם וגם את שעת התזכורת שלה
function nmOrder() {
    const raw = String((nmProfile && nmProfile.meal_order) || '').split(',').filter(s => NEW_ME_SLOTS.includes(s));
    return raw.length === 4 && new Set(raw).size === 4 ? raw : NEW_ME_SLOTS.slice();
}
function nmPosName(i) { return t('nm_pos_' + (i + 1)); }
function nmSlotName(slot) { return nmPosName(Math.max(0, nmOrder().indexOf(slot))); }
// ארוחות שהוסרו מהתפריט (למשל 3 ארוחות במקום 4) - לפי בקשה מפורשת. ארוחה שהוסרה שומרת על
// המיקום שלה ביום (השם לפי שעת היום לא זז), והקלוריות שלה פנויות למילוי עד סך התוכנית
const NEW_ME_MIN_MEALS = 2;
function nmHiddenSlots() { return String((nmProfile && nmProfile.hidden_slots) || '').split(',').filter(s => NEW_ME_SLOTS.includes(s)); }
function nmActiveOrder() { const hidden = nmHiddenSlots(); return nmOrder().filter(s => !hidden.includes(s)); }
// סדר חדש של הארוחות הפעילות → סדר מלא: הארוחות שהוסרו נשארות במקומן
function nmComposeOrder(active) { const hidden = nmHiddenSlots(); const queue = active.slice(); return nmOrder().map(s => (hidden.includes(s) ? s : queue.shift())); }
// כמה ארוחות צריך לסמן כדי שהיום ייחשב "טוב" - 3, או כולן כשיש פחות
function nmGoodDayChecks() { return Math.min(3, nmActiveOrder().length); }
// God Mode - נפתח למי שסיים/ה את כל האתגרים (ר' "אתגרים" למטה); עד אז false
function nmGodMode() { return typeof nmGodModeActive === 'function' ? nmGodModeActive() : false; }

async function renderNewMe() {
    const root = nmRoot();
    if (!root) return;
    if (!hasNewMe) { nmRenderSales(root); return; }
    if (!nmProfileLoaded) {
        root.innerHTML = '<div class="nm-loading"></div>';
        const { data } = await supabaseClient.from('new_me_profile').select('*').eq('user_id', currentUserId).maybeSingle();
        nmProfile = data || null;
        nmProfileLoaded = true;
    }
    if (!nmProfile || nmQuiz) { if (!nmQuiz) nmStartQuiz(); nmRenderQuiz(root); return; }
    if (nmView === 'menu' || nmView === 'tips') nmView = 'home';
    await Promise.all([nmLoadToday(), nmLoadJourney(), nmLoadChallenges()]);
    nmRenderView(root);
    nmAwardBadges();
    if (nmProfile.reminders_on) nmSyncReminders();
    nmMaybeAutoTour();
}

// ---------- מכירה ----------
// לפי בקשה מפורשת: "תמציתי, שהכל יהיה שם ויהיה רשום הכל, שידעו למה הם משלמים... שיראה מקצועי".
// כותרת, שני מסלולים (לכל החיים / חודשי) וכפתור, "מה מקבלים" בשלוש קבוצות, איך זה עובד (3 שלבים),
// הצצה ליום, שאלות קצרות וכפתור שוב. המחירים עצמם נקבעים ב-Lemon Squeezy - כאן רק התוויות שמוצגות
const NEW_ME_PRICES = { life: '$29.99', monthly: '$4.99' };
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
    ['nm_sales_g_journey', ['nm_sales_f12', 'nm_sales_f7', 'nm_sales_f13']],
];
function nmRenderSales(root) {
    const plan = NEW_ME_PLANS[1300];
    const preview = NEW_ME_SLOTS.map((slot, i) => `
        <div class="nm-preview-row"><span>${nmEsc(nmPosName(i))}</span><span>${nmEsc(nmOptText(1300, slot, 'A', true))}</span><span class="nm-num"><bdi dir="ltr">~${plan[slot].options.A.kcal}</bdi></span></div>`).join('');
    const buy = `<button type="button" class="nm-btn-primary nm-buy-btn" onclick="submitNewMePurchase(this)">${nmEsc(nmBuyLabel(nmSalesPlan))}</button>`;
    // חשבון הפיתוח בתצוגת "מי שעוד לא רכש/ה" - פס קטן לחזרה למצב פתוח (רק המפתחת רואה אותו)
    const devBar = typeof isDevSuperuserAccount !== 'undefined' && isDevSuperuserAccount
        ? `<div class="nm-dev-bar"><span>🔧 ${nmEsc(t('nm_dev_preview_on'))}</span><button type="button" onclick="setNmDevLockedPreview(false)">🔓 ${nmEsc(t('nm_dev_preview_exit'))}</button></div>` : '';
    root.innerHTML = `
        <div class="nm-sales">
            ${devBar}
            <div class="nm-hero">
                <div class="nm-hero-eyebrow">✨ New Me</div>
                <h2 class="nm-hero-title">${nmEsc(t('nm_sales_title'))}</h2>
                <p class="nm-hero-sub">${nmEsc(t('nm_sales_subtitle'))}</p>
            </div>
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
            <div class="nm-sales-preview">
                <div class="nm-sheet-label">${nmEsc(t('nm_sales_preview_label'))}</div>
                <div class="nm-preview" aria-hidden="true">${preview}</div>
            </div>
            <section class="nm-sales-card nm-sales-faq">
                ${[1, 2, 3].map(i => `<details><summary>${nmEsc(t('nm_sales_q' + i))}</summary><p>${nmEsc(t('nm_sales_a' + i).replace('{monthly}', NEW_ME_PRICES.monthly).replace('{life}', NEW_ME_PRICES.life))}</p></details>`).join('')}
            </section>
            ${buy}
        </div>`;
}

// plan: 'life' (תשלום אחד) או 'monthly' (מנוי) - ברירת מחדל: מה שנבחר בעמוד הרכישה
async function submitNewMePurchase(btn, plan = nmSalesPlan) {
    // תצוגת הפיתוח "כמו מי שעוד לא רכש/ה" - רק להסתכל, בלי לפתוח תשלום אמיתי
    if (typeof isDevSuperuserAccount !== 'undefined' && isDevSuperuserAccount && !hasNewMe) { showAppToast(t('nm_dev_preview_buy')); return; }
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
    if (hasNewMe) { updateNewMeShortcut(); showAppToast(t('nm_unlocked_toast')); renderNewMe(); }
    else showAppToast(t('nm_unlock_pending'), 'error');
}

// ---------- שאלון ----------
function nmStartQuiz(fromSettings) {
    nmQuiz = {
        step: 0,
        agreed: false,
        weight: '',
        goal: nmProfile && nmProfile.goal_weight != null ? String(nmProfile.goal_weight) : '',
        plan: nmProfile ? nmProfile.plan : 1300,
        choices: Object.fromEntries(NEW_ME_SLOTS.map(s => [s, nmProfile ? nmChoice(s) : 'A'])),
        fromSettings: !!fromSettings,
        // מכתב מהעבר (לא חובה) - שלב אחרון, רק כשעוד לא נכתב
        withLetter: !(nmProfile && nmProfile.letter_written_at),
        letter: '',
        name: (nmProfile && nmProfile.cert_name) || '',
    };
    // שם מלא: אם עוד לא נשמר - ממלאים מראש מחשבון Google (אפשר לשנות)
    if (!nmQuiz.name && typeof nmCertDefaultName === 'function') nmCertDefaultName().then(def => {
        if (!nmQuiz || nmQuiz.name || !def) return;
        nmQuiz.name = def;
        const input = document.getElementById('nm-q-name');
        if (input && !input.value) input.value = def;
    });
}
function nmQuizTotal() { return nmQuiz && nmQuiz.withLetter ? 5 : 4; }

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
    if (q.step === 0) {
        body = `${nmDisclaimerHtml()}
            <label class="nm-agree">
                <input type="checkbox" ${q.agreed ? 'checked' : ''} onchange="nmQuiz.agreed = this.checked; nmRenderQuiz(nmRoot())">
                <span>${nmEsc(t('nm_disclaimer_agree'))}</span>
            </label>`;
        canContinue = q.agreed;
    } else if (q.step === 1) {
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
    } else if (q.step === 2) {
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
    } else if (q.step === 4) {
        body = `
            <h3 class="nm-step-title">✉️ ${nmEsc(t('nm_letter_title'))}</h3>
            <p class="nm-fine">${nmEsc(t('nm_letter_intro').replace('{n}', nmFmt(NEW_ME_CHALLENGES.length)))}</p>
            <textarea class="nm-letter-input" rows="8" maxlength="4000" placeholder="${nmEsc(t('nm_letter_ph'))}" aria-label="${nmEsc(t('nm_letter_title'))}" oninput="nmQuiz.letter = this.value">${nmEsc(q.letter)}</textarea>
            <p class="nm-fine">🔒 ${nmEsc(t('nm_letter_seal_note'))}</p>
            <p class="nm-fine">${nmEsc(t('nm_letter_quiz_note'))}</p>`;
    } else {
        const order = nmProfile ? nmOrder() : NEW_ME_SLOTS;
        body = `
            <h3 class="nm-step-title">${nmEsc(t('nm_q_menu_title'))}</h3>
            <p class="nm-fine">${nmEsc(t('nm_q_menu_hint'))}</p>
            ${order.map((slot, i) => `
                <div class="nm-quiz-slot">
                    <div class="nm-slot-name">${nmEsc(nmPosName(i))}</div>
                    ${NEW_ME_OPTIONS.map(opt => {
                        const o = NEW_ME_PLANS[q.plan][slot].options[opt];
                        return `<button type="button" class="nm-option${q.choices[slot] === opt ? ' selected' : ''}" onclick="nmQuiz.choices['${slot}'] = '${opt}'; nmRenderQuiz(nmRoot())">
                            <span class="nm-option-name">${nmEsc(nmOptText(q.plan, slot, opt, true))}</span>
                            <span class="nm-option-text">${nmEsc(nmOptText(q.plan, slot, opt))}</span>
                            <span class="nm-option-meta">${nmMeta(o)}</span>
                        </button>`;
                    }).join('')}
                </div>`).join('')}
            <p class="nm-ai-note">${nmEsc(t('nm_ai_note'))}</p>`;
    }
    const isLast = q.step === total - 1;
    root.innerHTML = `
        <div class="nm-quiz">
            <div class="nm-steps" aria-label="${nmEsc(t('nm_step_of').replace('{n}', q.step + 1).replace('{total}', total))}">
                ${Array.from({ length: total }, (_, i) => `<span class="nm-step-dot${i <= q.step ? ' on' : ''}"></span>`).join('')}
            </div>
            ${body}
            <div class="nm-quiz-actions">
                ${q.step > 0 || q.fromSettings ? `<button type="button" class="nm-btn-ghost" onclick="nmQuizBack()">${nmEsc(t('nm_back'))}</button>` : ''}
                <button type="button" class="nm-btn-primary" ${canContinue ? '' : 'disabled'} onclick="nmQuizNext()">${nmEsc(t(isLast ? 'nm_finish' : 'nm_continue'))}</button>
            </div>
        </div>`;
}

function nmQuizBack() {
    if (nmQuiz.step === 0) { nmQuiz = null; nmView = 'settings'; renderNewMe(); return; }
    nmQuiz.step--;
    nmRenderQuiz(nmRoot());
}

async function nmQuizNext() {
    const q = nmQuiz;
    if (q.step === 0 && !q.agreed) return;
    if (q.step === 1) {
        if (String(q.name || '').trim().length < 2) { showAppToast(t('nm_q_full_name_missing'), 'error'); return; }
        const w = parseFloat(q.weight);
        if (!(w >= 20 && w <= 400)) { showAppToast(t('nm_q_weight_missing'), 'error'); return; }
    }
    if (q.step < nmQuizTotal() - 1) { q.step++; nmRenderQuiz(nmRoot()); nmScrollTop(); return; }
    const letter = q.withLetter ? String(q.letter || '').trim().slice(0, 4000) : '';
    if (letter && letter.length < NEW_ME_LETTER_MIN) { showAppToast(t('nm_letter_too_short'), 'error'); return; }
    const today = getLocalDateString();
    const goal = parseFloat(q.goal);
    const row = {
        user_id: currentUserId,
        plan: q.plan,
        start_weight: parseFloat(q.weight),
        goal_weight: goal > 0 ? goal : null,
        disclaimer_accepted_at: new Date().toISOString(),
        disclaimer_version: NEW_ME_DISCLAIMER_VERSION,
        choice_meal1: q.choices.meal1, choice_snack1: q.choices.snack1,
        choice_meal2: q.choices.meal2, choice_snack2: q.choices.snack2,
        cert_name: String(q.name || '').trim().slice(0, 60),
        updated_at: new Date().toISOString(),
    };
    // מסע חדש מתחיל ביום הראשון של התוכנית; מילוי השאלון מחדש לא מאפס את "יום X"
    if (!nmProfile) row.started_on = today;
    if (letter) { row.letter_text = letter; row.letter_written_at = new Date().toISOString(); }
    const { data, error } = await supabaseClient.from('new_me_profile').upsert(row, { onConflict: 'user_id' }).select().maybeSingle();
    if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
    nmProfile = data || { ...nmProfile, ...row };
    // המשקל ההתחלתי נכנס גם למעקב המשקל הקיים (אותה טבלה בדיוק)
    await insertWeightRecord(row.start_weight, today, 'New Me');
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
    const plan = Object.values(nmTodayCheckins).reduce((a, r) => a + (r.kcal || 0), 0);
    const drinks = nmTrackerToday.filter(nmIsDrinkRow).reduce((a, r) => a + (Number(r.calories) || 0), 0);
    return { kcal: total.kcal, protein: total.protein, plan, drinks, extra: Math.max(0, total.kcal - plan - drinks) };
}

// סה"כ התפריט של היום (כולל החלפות וארוחה חופשית) + תקציב השתייה - מול יעד התוכנית
function nmMenuTotal() {
    return nmActiveOrder().reduce((a, slot) => a + (nmIsFree(slot) ? nmFreeKcal() : nmItemInfo(nmTodayKey(slot)).kcal), 0) + NEW_ME_DRINKS_KCAL;
}
// כמה קלוריות פנויות בתפריט של היום עד סך התוכנית (אחרי שהוסרה ארוחה או נבחרה ארוחה קטנה יותר)
function nmMenuRoom() { return Math.max(0, nmProfile.plan - nmMenuTotal()); }

// אחרי כל שינוי - מרעננים את מעקב הארוחות/ההצצה להיום (אותו סכום בכל מקום)
function nmAfterTrackerChange() {
    refreshTodayNutritionViewIfOpen();
    if (typeof loadStats === 'function') loadStats();
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
function nmKgLost() {
    const s = Number(nmProfile && nmProfile.start_weight), l = nmLatestWeight();
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
    const start = Number(nmProfile.start_weight), goal = Number(nmProfile.goal_weight);
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

// גיליון תחתון כללי - נסגר בלחיצה על הרקע או על כל אלמנט עם data-close
function nmOpenSheet(html, cls) {
    const ov = document.createElement('div');
    ov.className = 'nm-sheet-overlay';
    ov.innerHTML = `<div class="nm-sheet${cls ? ' ' + cls : ''}" role="dialog" aria-modal="true"><span class="nm-sheet-grip" aria-hidden="true"></span>${html}</div>`;
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) ov.remove(); });
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
    return ov;
}

// ---------- תצוגות ----------
function nmRenderView(root) {
    nmCaptureDrinkDrafts();
    // מצב מתקדם: מראה זהב בכל New Me (כולל הגיליונות)
    document.documentElement.toggleAttribute('data-nm-god', nmGodMode());
    if (!NEW_ME_VIEW_TITLES[nmView] || nmView === 'pdf') nmView = 'home';
    if (nmView === 'home') { nmRenderHome(root); nmRestoreDrinkDrafts(); return; }
    root.innerHTML = `
        <div class="nm-subhead">
            <button type="button" class="nm-back" onclick="nmGo('home')" aria-label="${nmEsc(t('nm_back'))}">‹</button>
            <h3>${NEW_ME_TILE_ICONS[nmView] || ''} ${nmEsc(t(NEW_ME_VIEW_TITLES[nmView]))}</h3>
        </div>
        <div id="nm-view-body" class="nm-view-body"></div>`;
    const body = document.getElementById('nm-view-body');
    const renderers = { challenges: nmRenderChallenges, gift: nmRenderGift, stats: nmRenderStats, journey: nmRenderJourney, shop: nmRenderShop, badges: nmRenderBadges, measure: nmRenderMeasure, photos: nmRenderPhotos, month: nmRenderMonth, table: nmRenderTable, reminders: nmRenderReminders, settings: nmRenderSettings };
    renderers[nmView](body);
}

function nmGo(view) {
    nmView = view;
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

function nmRenderHome(root) {
    const plan = nmProfile.plan;
    const eaten = nmEatenToday();
    const order = nmOrder();
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
                        <div class="nm-eyebrow">✨ New Me · ${nmFmt(plan)} ${nmEsc(t('calories_unit'))}</div>
                        <button type="button" class="nm-day-chip" onclick="nmGo('journey')">${nmDayHtml(day)}${st.current > 0 ? `<span class="nm-day-streak">🔥 ${nmFmt(st.current)}</span>` : ''}</button>
                        <div class="nm-stat"><span class="nm-num">${nmFmt(eaten.kcal)}</span> ${nmEsc(t('nm_eaten'))} · <span class="nm-num">${nmFmt(Math.round(eaten.protein))}</span> ${nmEsc(t('nm_protein_unit'))}</div>
                        <div class="nm-split">${nmEsc(t('nm_split_line').replace('{plan}', nmFmt(eaten.plan)).replace('{drinks}', nmFmt(eaten.drinks)).replace('{extra}', nmFmt(eaten.extra)))}</div>
                        ${nmBurnedToday > 0 ? `<div class="nm-burn-line">🏃 ${nmTpl('nm_burned_line', { n: nmFmt(nmBurnedToday) })}</div>` : ''}
                        <div class="nm-dots" aria-label="${done}/${active.length}">${active.map(s => `<span class="${nmTodayCheckins[s] ? 'on' : ''}"></span>`).join('')}</div>
                    </div>
                </div>
                <button type="button" class="nm-journey-strip" onclick="nmGo('journey')">
                    <span class="nm-journey-strip-text">${NEW_ME_MILESTONE_ICONS[next] || '🏁'} ${nmEsc(t(next - day === 1 ? 'nm_next_milestone_one' : 'nm_next_milestone').replace('{n}', nmFmt(next - day)).replace('{name}', nmMilestoneName(next)))}</span>
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
                <div class="nm-menu-list" id="nm-menu-list">${active.map(s => nmMealCardHtml(s, order.indexOf(s))).join('')}</div>
                ${nmMenuRoomHtml()}
                <p class="nm-drag-hint">${nmEsc(t('nm_drag_hint'))}</p>
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

// כרטיס ארוחה: ידית גרירה, שם לפי שעת היום, שעת תזכורת, ✓, ומה אוכלים (או ארוחה חופשית)
function nmMealCardHtml(slot, idx) {
    const done = !!nmTodayCheckins[slot];
    const remTime = nmProfile.reminders_on && nmReminderEnabled(idx) ? nmReminderTime(idx) : null;
    const head = `
        <div class="nm-meal-head">
            <button type="button" class="nm-drag" data-slot="${slot}" aria-label="${nmEsc(t('nm_drag_label'))}" title="${nmEsc(t('nm_drag_label'))}">${NM_GRIP_SVG}</button>
            <span class="nm-slot-name">${nmEsc(nmPosName(idx))}</span>
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
            <div class="nm-option-name">${it.custom ? `<span class="nm-custom-tag" title="${nmEsc(t(it.source === 'ai' ? 'nm_custom_from_ai' : 'nm_custom_from_saved'))}">${it.source === 'ai' ? '✨' : '⭐'}</span> ` : ''}${nmEsc(nmItemShort(it))}</div>
            <div class="nm-option-text">${nmEsc(nmItemFull(it))}</div>
            <div class="nm-meal-foot">
                <span class="nm-option-meta">${nmMeta(it)}${crossed && Math.abs(diff) >= 5 ? ' ' + nmDiffChip(diff) : ''}</span>
                <span class="nm-meal-actions">
                    <button type="button" class="nm-chip" onclick="nmOpenSwap('${slot}')">🔄 ${nmEsc(t('nm_swap'))}</button>
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
    const order = nmOrder();
    const hidden = nmHiddenSlots();
    const room = nmMenuRoom();
    const active = nmActiveOrder();
    const parts = [];
    if (room >= 40) {
        parts.push(`
            <div class="nm-room-card">
                <div class="nm-room-title">🍽️ ${nmTpl('nm_room_title', { n: nmFmt(room) })}</div>
                <p class="nm-fine">${nmEsc(t('nm_room_hint'))}</p>
                <div class="nm-chip-row">${active.filter(s => !nmIsFree(s)).map(s => `<button type="button" class="nm-chip" onclick="nmOpenSwap('${s}')">🔄 ${nmEsc(nmPosName(order.indexOf(s)))}</button>`).join('')}</div>
            </div>`);
    }
    if (hidden.length) {
        parts.push(`<div class="nm-restore-row">${hidden.map(s => `<button type="button" class="nm-link-btn" onclick="nmRestoreMeal('${s}')">➕ ${nmEsc(t('nm_restore_meal').replace('{slot}', nmPosName(order.indexOf(s))))}</button>`).join('')}</div>`);
    }
    return parts.join('');
}

function nmAskRemoveMeal(slot) {
    if (nmActiveOrder().length <= NEW_ME_MIN_MEALS) { showAppToast(t('nm_remove_min').replace('{n}', NEW_ME_MIN_MEALS), 'error'); return; }
    const idx = nmOrder().indexOf(slot);
    const it = nmIsFree(slot) ? { kcal: nmFreeKcal() } : nmItemInfo(nmTodayKey(slot));
    const ov = nmOpenSheet(`
        <h4>➖ ${nmEsc(t('nm_remove_title').replace('{slot}', nmPosName(idx)))}</h4>
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
    [1300, 1500].forEach(plan => NEW_ME_SLOTS.forEach(s => NEW_ME_OPTIONS.forEach(opt => {
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
function nmOpenSwap(slot, startTab) {
    const idx = nmOrder().indexOf(slot);
    const cur = nmItemInfo(nmTodayKey(slot));
    const { near, far } = nmSwapCandidates(slot);
    const freeAvailable = !nmWeekFreeRow();
    const room = nmMenuRoom();
    const budget = cur.kcal + room;
    const god = nmGodMode();
    const fitsBudget = kcal => god || kcal <= budget * 1.1;
    let tab = startTab || 'menu';
    let aiText = '', aiResult = null, aiBusy = false;
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
        <h4>${nmEsc(t('nm_swap_title').replace('{slot}', nmPosName(idx)))}</h4>
        <div class="nm-swap-current"><span>${nmEsc(t('nm_swap_now'))}</span> <b>${nmEsc(nmItemShort(cur))}</b> · <bdi dir="ltr">~${cur.kcal}</bdi> ${nmEsc(t('calories_unit'))}</div>
        <div class="nm-swap-tabs" role="tablist">${TABS.map(([k, icon, label]) => `<button type="button" role="tab" class="nm-swap-tab${tab === k ? ' on' : ''}" aria-selected="${tab === k}" data-tab="${k}">${icon} ${nmEsc(t(label))}</button>`).join('')}</div>
        ${room >= 40 && !god ? `<div class="nm-swap-budget">${nmTpl('nm_swap_budget', { n: nmFmt(budget) })}</div>` : ''}`;
    const bindTabs = () => sheet.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { tab = b.dataset.tab; render(); }));
    const backBtn = `<button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_back'))}</button>`;
    const render = () => { if (tab === 'saved') renderSaved(); else if (tab === 'ai') renderAi(); else renderList(); sheet.scrollTop = 0; };
    const renderList = () => {
        sheet.innerHTML = `${headHtml()}
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
        const newTotal = nmMenuTotal() + d;
        const big = !god && (Math.abs(d) >= 60 || newTotal > nmProfile.plan * 1.08) && newTotal > nmProfile.plan;
        sheet.innerHTML = `
            <span class="nm-sheet-grip" aria-hidden="true"></span>
            <h4>${nmEsc(t('nm_swap_title').replace('{slot}', nmPosName(idx)))}</h4>
            <div class="nm-swap-pick">
                <span class="nm-option-name">${it.custom ? (it.source === 'ai' ? '✨ ' : '⭐ ') : ''}${nmEsc(nmItemShort(it))}</span>
                <span class="nm-option-text">${nmEsc(nmItemFull(it))}</span>
                <span class="nm-option-meta">${nmMeta(it)}</span>
            </div>
            <div class="nm-swap-balance">
                <span class="nm-swap-balance-diff ${d > 0 ? 'up' : d < 0 ? 'down' : 'eq'}">${d === 0 ? nmEsc(t('nm_swap_same_kcal')) : nmTpl(d > 0 ? 'nm_swap_more_kcal' : 'nm_swap_less_kcal', { n: nmFmt(Math.abs(d)) })}</span>
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
    if (!wasChecked && nmView === 'home') {
        // כל הארוחות שבתפריט של היום סומנו - חגיגה קטנה
        if (nmActiveOrder().every(s => nmTodayCheckins[s])) {
            const list = document.getElementById('nm-menu-list');
            if (list && typeof spawnGentleConfettiBurst === 'function') spawnGentleConfettiBurst(list, 30);
            showAppToast(t('nm_all_done_toast'));
        }
    }
    nmAwardBadges(!wasChecked && wasFree ? ['free_meal'] : []);
    // "21 ימים לפי התפריט": 3 ארוחות מסומנות = היום באתגר מסומן לבד
    if (!wasChecked) nmChallengeAutoCheck('menu');
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
        kcal = it.kcal;
        protein = it.protein;
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
    nmTodayCheckins[slot] = data || { slot, kcal, protein_g: protein, mirror_mode: mode, mirror_text: text };
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
        const meal = nmPosName(Math.max(0, nmOrder().indexOf(row.free_slot)));
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
            <div class="nm-chip-row">${order.map((s, i) => {
                const blocked = selDay === today && nmTodayCheckins[s];
                return `<button type="button" class="nm-pick${s === selSlot ? ' on' : ''}" data-slot="${s}" ${blocked ? 'disabled' : ''}>${nmEsc(nmPosName(i))}</button>`;
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
    const rows = nmTrackerToday.filter(r => !nmIsDrinkRow(r) && r.source !== 'new_me').map(r => {
        const merged = planTypes[r.meal_type];
        const kcal = (Number(r.calories) || 0) - (merged && merged.mirror_mode === 'merged' ? (merged.kcal || 0) : 0);
        const desc = merged && merged.mirror_text ? String(r.food_description || '').split(` + ${merged.mirror_text}`).join('') : r.food_description;
        return { desc, kcal };
    }).filter(x => x.kcal > 0 || (x.desc && x.desc.trim()));
    if (!rows.length) return '';
    return `
        <div class="nm-extras">
            <div class="nm-slot-name">➕ ${nmEsc(t('nm_extras_title'))}</div>
            ${rows.map(x => `<div class="nm-extra-row"><span>${nmEsc(x.desc || '')}</span><span class="nm-option-meta"><bdi dir="ltr">${x.kcal}</bdi> ${nmEsc(t('calories_unit'))}</span></div>`).join('')}
            <div class="nm-fine">${nmEsc(t('nm_extras_hint'))}</div>
        </div>`;
}

// ---------- קיצור הדרך ✨ במסך הבית ----------
function updateNewMeShortcut() {
    const btn = document.getElementById('btn-newme-shortcut');
    if (btn) btn.classList.toggle('hidden', !hasNewMe);
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
            <div class="nm-stat-box"><span aria-hidden="true">💯</span><b class="nm-num">${nmFmt(st.perfect)}</b><span>${nmEsc(t('nm_stat_perfect'))}</span></div>
        </div>
        <p class="nm-fine nm-rule">${nmEsc(t('nm_good_day_rule'))}</p>
        ${nmWeightCardHtml()}`;
}

function nmWeightCardHtml() {
    const start = Number(nmProfile.start_weight) || null;
    const goal = Number(nmProfile.goal_weight) || null;
    const latest = nmLatestWeight();
    const lost = nmKgLost();
    const since = nmStartDay();
    const series = (start ? [{ weight_date: since, weight_value: start }] : []).concat(nmWeights.filter(w => w.weight_date >= since));
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
        supabaseClient.from('calorie_tracker').select('meal_type, food_description, calories').eq('user_id', currentUserId).eq('date', nmTableDate).like('meal_type', 'nm_drink%'),
    ]);
    const rows = nmOrder().map(s => (data || []).find(r => r.slot === s)).filter(Boolean);
    const drinks = drinkRows || [];
    const total = rows.reduce((a, r) => ({ kcal: a.kcal + r.kcal, protein: a.protein + Number(r.protein_g) }), { kcal: drinks.reduce((a, d) => a + (Number(d.calories) || 0), 0), protein: 0 });
    body.innerHTML = `
        <div class="nm-date-row">
            <button type="button" class="nm-chip" onclick="nmShiftTableDate(-1)" aria-label="-1">‹</button>
            <input type="date" class="nm-date" value="${nmTableDate}" max="${getLocalDateString()}" onchange="nmTableDate = this.value || getLocalDateString(); nmRenderTable(document.getElementById('nm-view-body'))">
            <button type="button" class="nm-chip" onclick="nmShiftTableDate(1)" aria-label="+1">›</button>
        </div>
        ${rows.length || drinks.length ? `
        <div class="nm-table-wrap"><table class="nm-table">
            <thead><tr><th>${nmEsc(t('nm_table_food'))}</th><th>${nmEsc(t('calories_unit'))}</th><th>${nmEsc(t('nm_table_protein'))}</th></tr></thead>
            <tbody>${rows.map(r => `<tr><td><span class="nm-td-slot">${nmEsc(nmSlotName(r.slot))}</span>${nmEsc(nmCheckinLabel(r))}</td><td class="nm-num"><bdi dir="ltr">~${r.kcal}</bdi></td><td class="nm-num"><bdi dir="ltr">~${Math.round(r.protein_g)}</bdi></td></tr>`).join('')}${drinks.map(d => `<tr><td><span class="nm-td-slot">${nmEsc(t('nm_slot_drinks'))}</span>${nmEsc(String(d.food_description || '').replace(/^🥤\s*/, ''))}</td><td class="nm-num">${Number(d.calories) || 0}</td><td class="nm-num">0</td></tr>`).join('')}</tbody>
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
        cells += `<span class="nm-cal-cell lvl-${n}${ds === today ? ' today' : ''}" title="${n}/4${w ? ' · ' + nmEsc(w) : ''}"><span class="nm-cal-day">${d}</span>${mood || (r && r.free) ? `<span class="nm-cal-mark">${r && r.free ? '🍕' : ''}${mood}</span>` : w ? `<span class="nm-cal-w">${nmEsc(w)}</span>` : ''}</span>`;
    }
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
        ${nmCheckinInsightHtml(Object.values(byDay))}
        <button type="button" class="nm-row-btn" onclick="nmGo('journey')">⚖️ ${nmEsc(t('nm_month_weight_link'))}</button>`;
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
// שעה אחת לכל ארוחה (לפי המיקום ביום), ברירת מחדל 10:00 / 13:00 / 16:00 / 19:00. נשלחות
// כהתראת Push מהשרת (send-due-reminders) גם כשהאפליקציה סגורה, ולא נשלחות אם הארוחה כבר סומנה
function nmReminderRow(i) { return nmReminders.find(r => r.position === i + 1) || null; }
function nmReminderTime(i) { const r = nmReminderRow(i); return r ? r.time : NEW_ME_REMINDER_DEFAULTS[i]; }
function nmReminderEnabled(i) { const r = nmReminderRow(i); return !r || r.enabled !== false; }
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
        const prev = nmReminderRow(i) || {};
        let time = prev.time || NEW_ME_REMINDER_DEFAULTS[i];
        let enabled = prev.enabled !== false;
        if (change && change.pos === i) {
            if (change.time) time = change.time;
            if (change.enabled != null) enabled = change.enabled;
        }
        // ארוחה שהוסרה מהתפריט - בלי תזכורת
        if (hidden.includes(slot)) enabled = false;
        const [h, m] = time.split(':').map(Number);
        // שעה שכבר עברה היום לא נשלחת מיד (למשל כשמדליקים תזכורות בצהריים)
        const passed = h * 60 + m <= nowMin;
        return {
            user_id: currentUserId, position: i + 1, slot, time, enabled,
            title: `🍽️ ${nmPosName(i)}`.slice(0, 160),
            body: nmReminderBody(slot, false).slice(0, 300),
            today_body: nmReminderBody(slot, true).slice(0, 300),
            today_date: today,
            last_sent_date: passed ? today : (prev.last_sent_date || null),
        };
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
                    <div class="nm-rem-text"><b>${nmEsc(nmPosName(i))}</b><span>${nmEsc(nmItemShort(nmItemInfo(nmPermanentKey(slot))))}</span></div>
                    <input type="time" class="nm-rem-time" value="${nmReminderTime(i)}" onchange="nmSetReminderTime(${i}, this.value)" ${on ? '' : 'disabled'} aria-label="${nmEsc(nmPosName(i))}">
                    <input type="checkbox" class="nm-switch" ${nmReminderEnabled(i) ? 'checked' : ''} onchange="nmSetReminderEnabled(${i}, this.checked)" ${on ? '' : 'disabled'} aria-label="${nmEsc(nmPosName(i))}">
                </div>`).join('')}
        </div>
        <p class="nm-fine">${nmEsc(t('nm_rem_note'))}</p>`;
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
    const customOrder = nmOrder().join(',') !== NEW_ME_SLOTS.join(',');
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
        ${typeof isDevSuperuserAccount !== 'undefined' && isDevSuperuserAccount ? `<button type="button" class="nm-row-btn nm-dev-btn" onclick="setNmDevLockedPreview(true)">🔒 ${nmEsc(t('nm_dev_preview_btn'))}</button>` : ''}
        <button type="button" class="nm-row-btn" onclick="nmGo('reminders')">⏰ ${nmEsc(t('nm_tile_reminders'))}</button>
        ${customOrder ? `<button type="button" class="nm-row-btn" onclick="nmSaveOrder(NEW_ME_SLOTS.slice()); nmGo('settings')">↺ ${nmEsc(t('nm_order_reset'))}</button>` : ''}
        <button type="button" class="nm-row-btn" onclick="nmStartQuiz(true); renderNewMe()">📝 ${nmEsc(t('nm_settings_retake'))}</button>
        <details class="nm-row-details">
            <summary>⚕️ ${nmEsc(t('nm_settings_disclaimer'))}</summary>
            ${nmDisclaimerHtml()}
        </details>`;
}

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
    { id: 'nm_welcome', ch: 'newme', ctx: 'newme', icon: '✨', titleKey: 'nm_tour_welcome_title', text: 'nm_tour_welcome_text' },
    { id: 'nm_ring', ch: 'newme', ctx: 'newme', icon: '🔥', target: '#new-me-root .nm-ring', titleKey: 'nm_tour_ring_title', text: 'nm_tour_ring_text', optional: true },
    { id: 'nm_menu', ch: 'newme', ctx: 'newme', icon: '🍽️', target: '#nm-menu-list .nm-meal', titleKey: 'nm_tile_menu', text: 'nm_tour_menu_text', optional: true },
    { id: 'nm_swap', ch: 'newme', ctx: 'newme', icon: '🔄', target: '#nm-menu-list .nm-meal-actions', titleKey: 'nm_swap', text: 'nm_tour_swap_text', optional: true },
    { id: 'nm_drinks', ch: 'newme', ctx: 'newme', icon: '🥤', target: '#new-me-root .nm-drinks', titleKey: 'nm_slot_drinks', text: 'nm_tour_drinks_text', optional: true },
    { id: 'nm_challenges', ch: 'newme', ctx: 'newme', icon: '🏆', target: () => appTourVisible('#new-me-root .nm-ch-invite') || appTourVisible('#new-me-root .nm-ch-strip') || appTourVisible('#new-me-root .nm-tile[data-tile="challenges"]'), titleKey: 'nm_tile_challenges', text: 'nm_tour_challenges_text', optional: true },
    { id: 'nm_tiles', ch: 'newme', ctx: 'newme', icon: '🧩', target: '#new-me-root .nm-tiles', titleKey: 'nm_tour_tiles_title', text: 'nm_tour_tiles_text', optional: true },
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
const NEW_ME_STORIES = ['cover', 'tip_water', 'tip_veggies', 'tip_personal', 'raw', 'pot', 'after', 'weekly', 'out', 'estimate', 'control', 'outro'];
const NEW_ME_STORY_ART = {
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
