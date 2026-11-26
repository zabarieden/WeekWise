// 🏆 progress.js - "ההתקדמות שלי" (הישגים גרסה 3, הבחירה שלה 2026-11-26: שמות ב · תגים 1–4 + שבוע של התמדה · מקום B).
// לשונית "הישגים" בתוך "היעדים שלי" (במקום חלון "ההישגים שלי" ופריט התפריט שלו):
// - יום התקדמות = יום עם ✓ אחד לפחות (שגרה, משימה, צעד של יעד, הרגל, אימון, יעד המים, ארוחה של Nourish+). הספירה לא יורדת.
// - 9 דרגות לפי סך ימי ההתקדמות (1 · 3 · 7 · 14 · 30 · 60 · 100 · 200 · 365), דרך עם 9 תחנות, רצף עם יום מנוחה אחד בשבוע,
//   ולוח חודשי.
// - 5 תגים שבועיים שחוזרים כל שבוע: יום מלא 3, ימים ליעדים 3, ימי מים 5, ימי תנועה 3 (או לפי תוכנית האימונים),
//   שבוע של התמדה 6 מתוך 7. כל שבוע שמגיעים - ×1 נוסף (נשמר ב-user_badges כ-wb_<תג>_<תחילת השבוע>), ולא יורד לעולם.
// נטען אחרי app.js, home.js, water.js ו-workouts.js - ומחליף את הרמות לפי נקודות (ACH_LEVELS) ואת "ההישגים שלי".
'use strict';

const PROG_DAYS = [1, 3, 7, 14, 30, 60, 100, 200, 365];
const PROG_F = { routine: 1, goal: 2, habit: 4, task: 8, move: 16, water: 32, meal: 64, full: 128 };
const PROG_ANY = 1 | 2 | 4 | 8 | 16 | 32 | 64;
const PROG_BADGES = [
    { k: 'week', flag: PROG_ANY, target: () => 6 },
    { k: 'full', flag: PROG_F.full, target: () => 3 },
    { k: 'goals', flag: PROG_F.goal, target: () => 3 },
    { k: 'water', flag: PROG_F.water, target: () => 5 },
    { k: 'move', flag: PROG_F.move, target: progMoveTarget },
];
let progDays = null;          // Map: 'YYYY-MM-DD' → דגלים
let progLoading = null;
let progLoadedAt = 0;
let progEarned = new Map();   // תג → Set של תחילות שבוע שהושגו
let progMonth = null;         // 'YYYY-MM' שמוצג בלוח
let progInfoOpen = '';

function progEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function progCacheKey() { return `weekwise_prog_v1_${currentUserId}`; }
function progFirstDay() { return typeof calPrefs !== 'undefined' && calPrefs ? Number(calPrefs.firstDay) || 0 : 0; }
function progDow(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
function progWeekStart(dateStr) { const back = (progDow(dateStr) - progFirstDay() + 7) % 7; return addDaysToDateStr(dateStr, -back); }
// ימי תנועה בשבוע: כמה ימים יש בתוכנית האימונים (בלי ימי מנוחה), ואם אין תוכנית - 3
function progMoveTarget() {
    const plan = typeof workoutPlan !== 'undefined' && Array.isArray(workoutPlan) ? workoutPlan : [];
    const days = new Set();
    plan.filter(w => w && w.kind !== 'rest').forEach(w => (Array.isArray(w.days) ? w.days : []).forEach(d => days.add(Number(d))));
    return days.size ? Math.min(7, Math.max(1, days.size)) : 3;
}

// ---------- איסוף הימים מכל המקומות (עד 1000 שורות בכל בקשה - בדפים) ----------
async function progFetch(table, cols, dateCol, since) {
    const out = [];
    for (let from = 0; from < 60000; from += 1000) {
        const { data, error } = await supabaseClient.from(table).select(cols).eq('user_id', currentUserId).gte(dateCol, since).order(dateCol, { ascending: true }).range(from, from + 999);
        if (error) return out;
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
    }
    return out;
}
// הפריטים של השגרה ביום מסוים - אותו היגיון כמו "היום שלי" (loadMyDayRoutine): טאב עם ימים - בימים שלו, בלי ימים - כל יום,
// ביום חופש רק הטאב שלו + מה שנקבע במפורש ליום הזה. פריט שנוסף אחרי התאריך לא נחשב לו
function progRoutineItemsFor(tabs, items, dateStr) {
    const d = progDow(dateStr);
    const wd = tb => (typeof routineTabWeekdays === 'function' ? routineTabWeekdays(tb) : []);
    const dayOff = tabs.find(tb => tb.day_off && wd(tb).includes(d));
    const ids = new Set((dayOff ? [dayOff] : tabs.filter(tb => !tb.day_off && (!wd(tb).length || wd(tb).includes(d)))).map(tb => tb.id));
    const pinned = it => { if (String(it.days_of_week || '').trim() === '') return false; const dd = routineItemDays(it); return dd.length < 7 && dd.includes(d); };
    const seen = new Set();
    return items.filter(it => (ids.has(it.tab_id) || (dayOff && it.tab_id !== dayOff.id && pinned(it)))
        && String(it.title || '').trim() && !it.hidden_by_new_me && routineItemOnDay(it, d) && String(it.created_at || '').slice(0, 10) <= dateStr)
        .filter(it => { const k = `${String(it.time || '').slice(0, 5)}|${it.title.trim().toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
}
async function progComputeSince(since) {
    const safe = p => p.then(r => (r && r.data) || r || []).catch(() => []);
    const [tabs, items, checks, notes, goalCk, habitCk, tasks, sport, water, meals] = await Promise.all([
        safe(supabaseClient.from('routine_tabs').select('id, name, weekdays, day_off').eq('user_id', currentUserId)),
        safe(supabaseClient.from('routine_items').select('id, tab_id, title, time, days_of_week, created_at, vision_milestone_id, vision_goal_id, hidden_by_new_me').eq('user_id', currentUserId).eq('kind', 'scheduled')),
        progFetch('routine_item_checkins', 'item_id, checkin_date', 'checkin_date', since),
        progFetch('routine_item_day_notes', 'item_id, note_date, skipped', 'note_date', since),
        progFetch('vision_goal_checkins', 'checkin_date', 'checkin_date', since),
        progFetch('habit_checkins', 'checkin_date', 'checkin_date', since),
        progFetch('schedule_completions', 'completion_date', 'completion_date', since),
        progFetch('sport_sessions', 'session_date', 'session_date', since),
        progFetch('water_logs', 'log_date, amount_ml', 'log_date', since),
        progFetch('new_me_checkins', 'checkin_date', 'checkin_date', since),
    ]);
    const days = new Map();
    const add = (date, f) => { if (!date) return; const k = String(date).slice(0, 10); days.set(k, (days.get(k) || 0) | f); };
    const goalItems = new Set(items.filter(it => it.vision_milestone_id || it.vision_goal_id).map(it => it.id));
    const doneBy = new Map();
    checks.forEach(c => {
        const k = String(c.checkin_date).slice(0, 10);
        add(k, PROG_F.routine);
        if (goalItems.has(c.item_id)) add(k, PROG_F.goal);
        if (!doneBy.has(k)) doneBy.set(k, new Set());
        doneBy.get(k).add(c.item_id);
    });
    goalCk.forEach(r => add(r.checkin_date, PROG_F.goal));
    habitCk.forEach(r => add(r.checkin_date, PROG_F.habit));
    tasks.forEach(r => add(r.completion_date, PROG_F.task));
    sport.forEach(r => add(r.session_date, PROG_F.move));
    meals.forEach(r => add(r.checkin_date, PROG_F.meal));
    if (typeof waterLoadPrefs === 'function') { try { await waterLoadPrefs(); } catch {} }
    const goal = typeof getWaterDailyGoal === 'function' ? Number(getWaterDailyGoal()) || 2000 : 2000;
    const ml = new Map();
    water.forEach(r => { const k = String(r.log_date).slice(0, 10); ml.set(k, (ml.get(k) || 0) + (Number(r.amount_ml) || 0)); });
    ml.forEach((v, k) => { if (v >= goal) add(k, PROG_F.water); });
    // ⭐ יום מלא: כל השגרה של היום - או כולה חוץ מפריט אחד (כשיש 3 פריטים ומעלה). "לא היום" לא נחשב
    const skipped = new Set(notes.filter(n => n.skipped).map(n => `${n.item_id}|${String(n.note_date).slice(0, 10)}`));
    doneBy.forEach((done, k) => {
        const need = progRoutineItemsFor(tabs, items, k).filter(it => !skipped.has(`${it.id}|${k}`));
        if (!need.length) return;
        const missing = need.filter(it => !done.has(it.id)).length;
        if (need.length >= 3 ? missing <= 1 : missing === 0) add(k, PROG_F.full);
    });
    return days;
}
// פעם ראשונה - כל ההיסטוריה; אחר כך רק 10 הימים האחרונים מחושבים מחדש (✓ יכול להתבטל), והשאר מהמכשיר
async function progLoad(force) {
    if (!supabaseClient || !currentUserId) return null;
    if (progDays && !force && Date.now() - progLoadedAt < 60000) return progDays;
    if (progLoading) return progLoading;
    progLoading = (async () => {
        let cache = null;
        try { cache = JSON.parse(localStorage.getItem(progCacheKey()) || 'null'); } catch {}
        const today = getLocalDateString();
        const since = cache && cache.through ? addDaysToDateStr(cache.through, -10) : '2000-01-01';
        const fresh = await progComputeSince(since);
        const days = new Map();
        if (cache && cache.days) Object.entries(cache.days).forEach(([k, v]) => { if (k < since) days.set(k, v); });
        fresh.forEach((v, k) => days.set(k, v));
        try { localStorage.setItem(progCacheKey(), JSON.stringify({ through: today, days: Object.fromEntries(days) })); } catch {}
        progDays = days;
        progLoadedAt = Date.now();
        return days;
    })().finally(() => { progLoading = null; });
    return progLoading;
}

// ---------- חישובים ----------
function progTotal(days) { let n = 0; days.forEach(v => { if (v & PROG_ANY) n++; }); return n; }
function progLevelIndex(total) { let i = -1; PROG_DAYS.forEach((d, j) => { if (total >= d) i = j; }); return i; }
function progLevelName(i) { return t(`prog_lvl_${i + 1}`); }
// 🔥 רצף עם יום מנוחה: יום אחד בלי ✓ בכל שבוע לא שובר אותו (נשמר לבד). היום עצמו עוד לא נגמר - לא נחשב כמנוחה
function progRun(days) {
    const today = getLocalDateString();
    const has = d => !!((days.get(d) || 0) & PROG_ANY);
    let first = null;
    days.forEach((v, k) => { if ((v & PROG_ANY) && (!first || k < first)) first = k; });
    const rest = new Map(); // תחילת שבוע → היום שנוח בו
    let n = 0;
    if (first) {
        let d = has(today) ? today : addDaysToDateStr(today, -1);
        for (let i = 0; i < 4000 && d >= first; i++) {
            if (has(d)) n++;
            else { const ws = progWeekStart(d); if (rest.has(ws)) break; rest.set(ws, d); }
            d = addDaysToDateStr(d, -1);
        }
    }
    return { n, rest, restUsed: rest.has(progWeekStart(today)) };
}
// כמה ימים בכל שבוע לכל תג → אילו שבועות הגיעו ליעד
function progWeekCounts(days) {
    const weeks = new Map();
    days.forEach((v, k) => {
        const ws = progWeekStart(k);
        if (!weeks.has(ws)) weeks.set(ws, {});
        const w = weeks.get(ws);
        PROG_BADGES.forEach(b => { if (v & b.flag) w[b.k] = (w[b.k] || 0) + 1; });
    });
    return weeks;
}
// שבועות שהגיעו ליעד נשמרים בחשבון (wb_<תג>_<תחילת שבוע>) - כך ה-×N לא יורד גם אם משהו נמחק בהמשך. מחזיר את מה שנוסף עכשיו
async function progSyncBadges(days, celebrate) {
    const weeks = progWeekCounts(days);
    const { data } = await supabaseClient.from('user_badges').select('badge').eq('user_id', currentUserId).like('badge', 'wb_%');
    progEarned = new Map(PROG_BADGES.map(b => [b.k, new Set()]));
    (data || []).forEach(r => { const m = String(r.badge).match(/^wb_([a-z]+)_(\d{4}-\d{2}-\d{2})$/); if (m && progEarned.has(m[1])) progEarned.get(m[1]).add(m[2]); });
    const fresh = [];
    weeks.forEach((w, ws) => PROG_BADGES.forEach(b => {
        if ((w[b.k] || 0) >= b.target() && !progEarned.get(b.k).has(ws)) { progEarned.get(b.k).add(ws); fresh.push({ b, ws }); }
    }));
    if (!fresh.length) return [];
    const { error } = await supabaseClient.from('user_badges').upsert(fresh.map(f => ({ user_id: currentUserId, badge: `wb_${f.b.k}_${f.ws}` })), { onConflict: 'user_id,badge', ignoreDuplicates: true });
    if (error) return [];
    // חגיגה רק על השבוע הזה, ורק אחרי הפעם הראשונה (מה שהיה לפני כן נכנס בשקט)
    const thisWeek = progWeekStart(getLocalDateString());
    let init = false;
    try { init = localStorage.getItem(`weekwise_prog_init_${currentUserId}`) === '1'; localStorage.setItem(`weekwise_prog_init_${currentUserId}`, '1'); } catch {}
    return celebrate && init ? fresh.filter(f => f.ws === thisWeek) : [];
}
// 🏆 דרגה חדשה (dlvl_N ב-user_badges): בפעם הראשונה נקבעת בשקט
async function progSyncLevel(total, celebrate) {
    const lvl = progLevelIndex(total) + 1;
    if (lvl < 1) return 0;
    const key = `weekwise_dlevel_${currentUserId}`;
    let known = 0;
    try { known = Number(localStorage.getItem(key)) || 0; } catch {}
    if (!known) {
        const { data } = await supabaseClient.from('user_badges').select('badge').eq('user_id', currentUserId).like('badge', 'dlvl_%');
        known = Math.max(0, ...(data || []).map(r => Number(String(r.badge).slice(5)) || 0));
        if (!known) { await supabaseClient.from('user_badges').upsert({ user_id: currentUserId, badge: `dlvl_${lvl}` }, { onConflict: 'user_id,badge', ignoreDuplicates: true }); known = lvl; celebrate = false; }
        try { localStorage.setItem(key, String(known)); } catch {}
    }
    if (lvl <= known) return 0;
    await supabaseClient.from('user_badges').upsert({ user_id: currentUserId, badge: `dlvl_${lvl}` }, { onConflict: 'user_id,badge', ignoreDuplicates: true });
    try { localStorage.setItem(key, String(lvl)); } catch {}
    return celebrate ? lvl : 0;
}
function progBadgeName(k) { return t(`prog_b_${k}`); }
function progCelebrateBadge(b) {
    const n = (progEarned.get(b.k) || new Set()).size;
    openGlassAchievement({
        eyebrow: t('nm_badge_new'), icon: '🏆', title: `${progBadgeName(b.k)} ×${n}`,
        desc: t('prog_badge_new_desc').replace('{name}', progBadgeName(b.k)).replace('{n}', n),
        shareText: `🏅 ${progBadgeName(b.k)} ×${n}`, file: 'not10-badge.png', shareLabel: t('nm_share'), okLabel: t('nm_celebrate_ok'),
    });
}
function progCelebrateLevel(lvl, total) {
    const name = progLevelName(lvl - 1);
    openGlassAchievement({
        eyebrow: t('ach_level_up'), icon: '🏆', title: name, desc: t('prog_level_desc').replace('{n}', total),
        shareText: `🏅 ${t('prog_level_share').replace('{name}', name).replace('{n}', total)}`, file: 'not10-level.png', shareLabel: t('nm_share'), okLabel: t('nm_celebrate_ok'),
    });
}
// בדיקה ברקע (מ"היום שלי" ומהיעדים): תג השבוע שהושג עכשיו או דרגה חדשה - כרטיס הזכוכית עם הנצנצים
let progCheckedAt = 0;
async function progBackgroundCheck(force) {
    if (!supabaseClient || !currentUserId) return;
    if (!force && Date.now() - progCheckedAt < 90000) { renderAchChip(); return; }
    progCheckedAt = Date.now();
    try {
        const days = await progLoad(true);
        if (!days) return;
        const total = progTotal(days);
        const [freshBadges, lvl] = await Promise.all([progSyncBadges(days, true), progSyncLevel(total, true)]);
        renderAchChip();
        if (lvl) progCelebrateLevel(lvl, total);
        else if (freshBadges.length) progCelebrateBadge(freshBadges[0].b);
        if (document.getElementById('goals-view-scroll')?.classList.contains('is-progress')) progRender();
    } catch (e) { console.warn('progress check', e); }
}

// ---------- מה שמחליפים ב-app.js ----------
// השבב בראש "היעדים שלי": הדרגה וכמה ימים - נגיעה פותחת את הלשונית
renderAchChip = function () {
    const chip = document.getElementById('gv-level-chip');
    if (!chip || !progDays) return;
    const total = progTotal(progDays);
    const i = progLevelIndex(total);
    if (i < 0) { chip.classList.add('hidden'); return; }
    chip.innerHTML = `${achTrophyHtml('is-chip')}<span>${progEsc(progLevelName(i))} · <bdi>${total}</bdi></span>`;
    chip.setAttribute('aria-label', `${progLevelName(i)} · ${t('prog_level_desc').replace('{n}', total)}`);
    chip.classList.remove('hidden');
};
checkLevelUp = function (force) { return progBackgroundCheck(force); };
// "שבוע של התמדה" החד-פעמי הישן - עכשיו תג שבועי שחוזר (week)
checkPremiumWeekBadge = function () {};
// "ההישגים שלי" = הלשונית בתוך "היעדים שלי"
openAchievements = function () {
    if (typeof openGoalsVisionDrawer === 'function') openGoalsVisionDrawer();
    progShowTab('progress');
};

// ---------- הלשונית ----------
function progShowTab(tab) {
    const scroll = document.getElementById('goals-view-scroll');
    if (!scroll) return;
    const on = tab === 'progress';
    scroll.classList.toggle('is-progress', on);
    document.querySelectorAll('#gv-tabs [data-gv-tab]').forEach(b => {
        const sel = b.dataset.gvTab === tab;
        b.classList.toggle('is-on', sel);
        b.setAttribute('aria-selected', String(sel));
    });
    document.getElementById('gv-progress')?.classList.toggle('hidden', !on);
    scroll.scrollTop = 0;
    if (on) progRender();
}
function progBindTabs() {
    const bar = document.getElementById('gv-tabs');
    if (!bar || bar.dataset.bound) return;
    bar.dataset.bound = '1';
    bar.addEventListener('click', e => { const b = e.target.closest('[data-gv-tab]'); if (b) progShowTab(b.dataset.gvTab); });
}
document.addEventListener('DOMContentLoaded', progBindTabs);
if (document.readyState !== 'loading') progBindTabs();
// כל פתיחה רגילה של "היעדים שלי" - על היעדים (openAchievements עובר ללשונית אחרי זה)
if (typeof openGoalsVisionDrawer === 'function') {
    const progOrigOpenGoals = openGoalsVisionDrawer;
    openGoalsVisionDrawer = function (...args) { const r = progOrigOpenGoals.apply(this, args); progShowTab('goals'); return r; };
}

function progMonthNames() {
    const fd = progFirstDay();
    return Array.from({ length: 7 }, (_, i) => { try { return new Date(2026, 10, 22 + ((fd + i) % 7)).toLocaleDateString(currentLang, { weekday: 'narrow' }); } catch { return ''; } });
}
function progCalHtml(days, run) {
    const today = getLocalDateString();
    const key = progMonth || today.slice(0, 7);
    const [y, m] = key.split('-').map(Number);
    const first = `${key}-01`;
    const nDays = new Date(y, m, 0).getDate();
    const lead = (progDow(first) - progFirstDay() + 7) % 7;
    const restDays = new Set(run.rest.values());
    const cells = [];
    for (let i = 0; i < lead; i++) cells.push('<span class="pg-cal-pad" aria-hidden="true"></span>');
    for (let d = 1; d <= nDays; d++) {
        const ds = `${key}-${String(d).padStart(2, '0')}`;
        const p = (days.get(ds) || 0) & PROG_ANY;
        const cls = p ? 'is-p' : restDays.has(ds) ? 'is-rest' : '';
        cells.push(`<span class="${cls}${ds === today ? ' is-today' : ''}">${d}</span>`);
    }
    let label = key;
    try { label = new Date(y, m - 1, 1).toLocaleDateString(currentLang, { month: 'long', year: 'numeric' }); } catch {}
    const canNext = key < today.slice(0, 7);
    return `<div class="pg-cal">
        <div class="pg-cal-head"><button type="button" class="pg-cal-nav" data-pg-month="-1" aria-label="${progEsc(t('monthly_goal_prev_month'))}">‹</button><b>${progEsc(label)}</b><button type="button" class="pg-cal-nav" data-pg-month="1" aria-label="${progEsc(t('monthly_goal_next_month'))}"${canNext ? '' : ' disabled'}>›</button></div>
        <div class="pg-cal-grid pg-cal-wd" aria-hidden="true">${progMonthNames().map(n => `<span>${progEsc(n)}</span>`).join('')}</div>
        <div class="pg-cal-grid">${cells.join('')}</div>
    </div>`;
}
function progInfoBtn(id, label) { return `<button type="button" class="pg-info" data-pg-info="${id}" aria-expanded="${progInfoOpen === id}" aria-label="${progEsc(label)}">i</button>`; }
function progInfoBox(id, key) { return progInfoOpen === id ? `<p class="pg-bubble" role="note">${progEsc(t(key))}</p>` : ''; }
function progWeekDots(days, b) {
    const ws = progWeekStart(getLocalDateString());
    const today = getLocalDateString();
    return `<span class="pg-dots" aria-hidden="true">${Array.from({ length: 7 }, (_, i) => {
        const ds = addDaysToDateStr(ws, i);
        const on = ((days.get(ds) || 0) & b.flag) && ds <= today;
        return `<i class="${on ? 'on' : ''}${ds > today ? ' later' : ''}">${progEsc(progMonthNames()[i])}</i>`;
    }).join('')}</span>`;
}
async function progRender() {
    const box = document.getElementById('gv-progress');
    if (!box) return;
    if (!progDays) box.innerHTML = '<div class="pg-loading" aria-hidden="true"></div>';
    const days = await progLoad(false);
    if (!days) return;
    if (!progEarned.size) { try { await progSyncBadges(days, false); } catch {} }
    const total = progTotal(days);
    const i = progLevelIndex(total);
    const next = i + 1 < PROG_DAYS.length ? i + 1 : -1;
    const run = progRun(days);
    // הדרך: 9 תחנות, הקו מתמלא עד היום
    const pct = i < 0 ? 0 : next < 0 ? 100 : ((i + (total - PROG_DAYS[i]) / (PROG_DAYS[next] - PROG_DAYS[i])) / (PROG_DAYS.length - 1)) * 100;
    const road = `<div class="pg-road" role="img" aria-label="${progEsc(i >= 0 ? progLevelName(i) : t('prog_start'))}"><div class="pg-lane"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="pg-signs">${PROG_DAYS.map((d, j) => `<button type="button" class="pg-sign${j < i ? ' is-done' : ''}${j === i ? ' is-now' : ''}${j > i ? ' is-fog' : ''}" data-pg-lvl="${j}" aria-label="${progEsc(progLevelName(j))} · ${d}"><span class="pg-dot"></span><small>${d}</small></button>`).join('')}</div></div>`;
    const ws = progWeekStart(getLocalDateString());
    const weekNow = progWeekCounts(new Map([...days].filter(([k]) => k >= ws))).get(ws) || {};
    let restart = '';
    try { restart = t('prog_badges_restart').replace('{day}', new Date(2026, 10, 22 + progFirstDay()).toLocaleDateString(currentLang, { weekday: 'long' })); } catch {}
    const tile = (b, wide) => {
        const done = weekNow[b.k] || 0, target = b.target();
        const times = (progEarned.get(b.k) || new Set()).size;
        const got = done >= target;
        return `<button type="button" class="pg-tile${wide ? ' is-wide' : ''}${got ? ' is-got' : ''}${times ? '' : ' is-new'}" data-pg-badge="${b.k}">
            <span class="pg-times"><bdi>×${times}</bdi></span>${achTrophyHtml('is-tile')}
            <b>${progEsc(progBadgeName(b.k))}</b>
            <span class="pg-tile-st">${progEsc(t(got ? 'prog_b_got' : 'prog_b_status').replace('{done}', Math.min(done, 7)).replace('{target}', target))}</span>
            ${progWeekDots(days, b)}</button>`;
    };
    const reached = (typeof visionGoalsCache !== 'undefined' ? visionGoalsCache : []).filter(g => g.is_achieved);
    box.innerHTML = `
        <section class="pg-hero">${achTrophyHtml('is-hero')}
            <div class="pg-hero-text"><div class="pg-big"><bdi>${total}</bdi></div>
                <span class="pg-label">${progEsc(t('prog_days_label'))} ${progInfoBtn('day', t('prog_days_label'))}</span>
                <b class="pg-level">${progEsc(i >= 0 ? progLevelName(i) : t('prog_start'))}</b>
                <span class="pg-next">${progEsc(i < 0 ? '' : next < 0 ? t('prog_max') : t('prog_next').replace('{n}', PROG_DAYS[next] - total).replace('{name}', progLevelName(next)))}</span>
            </div>
        </section>
        ${progInfoBox('day', 'prog_day_info')}
        ${road}
        <div class="pg-run"><span>${progEsc(t('prog_run').replace('{n}', run.n))} ${progInfoBtn('run', t('prog_run').replace('{n}', run.n))}</span><span>${progEsc(t(run.restUsed ? 'prog_rest_used' : 'prog_rest_free'))}</span></div>
        ${progInfoBox('run', 'prog_run_info')}
        ${progCalHtml(days, run)}
        <h3 class="pg-sub"><span>${progEsc(t('prog_badges_title'))} ${progInfoBtn('badges', t('prog_badges_title'))}</span><small>${progEsc(restart)}</small></h3>
        ${progInfoBox('badges', 'prog_badges_info')}
        <div class="pg-tiles">${tile(PROG_BADGES[0], true)}${PROG_BADGES.slice(1).map(b => tile(b)).join('')}</div>
        ${reached.length ? `<h3 class="pg-sub"><span>${progEsc(t('ach_goals'))}</span></h3><div class="pg-tiles">${reached.map(g => {
            let date = '';
            try { date = g.achieved_at ? new Date(g.achieved_at).toLocaleDateString(currentLang, { day: 'numeric', month: 'short', year: 'numeric' }) : ''; } catch {}
            return `<button type="button" class="pg-tile is-goal is-got" data-pg-goal="${progEsc(g.id)}">${achTrophyHtml('is-tile')}<b>${progEsc(g.title)}</b><span class="pg-tile-st">${progEsc(date)}</span></button>`;
        }).join('')}</div>` : ''}`;
    renderAchChip();
}
// נגיעות בלשונית (פעם אחת - האלמנט נשאר, התוכן מתחלף)
document.addEventListener('click', e => {
    const box = e.target.closest && e.target.closest('#gv-progress');
    if (!box) return;
    const info = e.target.closest('[data-pg-info]');
    if (info) { progInfoOpen = progInfoOpen === info.dataset.pgInfo ? '' : info.dataset.pgInfo; progRender(); return; }
    const nav = e.target.closest('[data-pg-month]');
    if (nav && !nav.disabled) {
        const today = getLocalDateString().slice(0, 7);
        const [y, m] = (progMonth || today).split('-').map(Number);
        const d = new Date(y, m - 1 + Number(nav.dataset.pgMonth), 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        progMonth = key > today ? today : key;
        progRender();
        return;
    }
    const lvl = e.target.closest('[data-pg-lvl]');
    if (lvl) {
        const j = Number(lvl.dataset.pgLvl);
        openGlassAchievement({ icon: '🏆', title: progLevelName(j), desc: t('prog_level_desc').replace('{n}', PROG_DAYS[j]), shareText: `🏅 ${progLevelName(j)}`, file: 'not10-level.png', shareLabel: t('nm_share'), okLabel: t('close_btn') });
        return;
    }
    const badge = e.target.closest('[data-pg-badge]');
    if (badge) {
        const b = PROG_BADGES.find(x => x.k === badge.dataset.pgBadge);
        if (!b) return;
        const n = (progEarned.get(b.k) || new Set()).size;
        openGlassAchievement({ icon: '🏆', title: `${progBadgeName(b.k)} ×${n}`, desc: `${t(`prog_bd_${b.k}`)} · ${t('prog_b_card').replace('{target}', b.target()).replace('{n}', n)}`, shareText: `🏅 ${progBadgeName(b.k)} ×${n}`, file: 'not10-badge.png', shareLabel: t('nm_share'), okLabel: t('close_btn') });
        return;
    }
    const goal = e.target.closest('[data-pg-goal]');
    if (goal) {
        progShowTab('goals');
        if (typeof visionSelectedGoalId !== 'undefined') visionSelectedGoalId = goal.dataset.pgGoal;
        if (typeof renderVisionGoalsList === 'function') renderVisionGoalsList();
    }
});
