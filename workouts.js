// --- 🏋️ טבלת האימונים (לפי בקשה מפורשת, 2026-10-13: "בספורט שתהיה אפשרות לעשות טבלה של אימונים איזה אימון מתי ובאיזה
// שעות ובאלו ימים... ולשלב בהיום שלי"). הבחירות שלה מתוך 20 עיצובים: ברירת המחדל היא ציר זמן של השבוע (4) יחד עם
// האימון של היום בגדול (16) - "תנסה לשלב נראה איך יצא"; בהיום שלי - צ'יפ קטן ליד המים (ה2). התוספות שבחרה: ✓ נרשם
// בהיסטוריית הספורט (ת1), ימי מנוחה 🌿 (ת3), עצימות שנשמרת גם בהיסטוריה (ת4), מקום + "אחר" (ת5), מטרה שבועית (ת6),
// רצף שבועות (ת7), תוכניות מוכנות (ת8), תרגילים בתוך אימון - רק לכוח / פונקציונלי / שחייה (ת10), טיימר שמופיע גם
// במסך הבית (ת12), והאתגר "שבועיים של תנועה" ב-New Me נספר לבד (ת13). "להעביר אימון שלא נעשה" (ת11) - לא, בכוונה:
// "אנחנו רוצים שאנשים יעמדו במטרות שלהם". כל שורה ב-workout_plan היא אימון קבוע בימים מסוימים (או יום מנוחה) ---

const WORKOUT_KINDS = [
    { k: 'running', icon: '🏃', tone: 'cardio', sport: 'running' },
    { k: 'walking', icon: '🚶', tone: 'walk', met: 3.5 },
    { k: 'cycling', icon: '🚴', tone: 'cardio', sport: 'cycling' },
    { k: 'swimming', icon: '🏊', tone: 'water', sport: 'swimming', exercises: true },
    { k: 'strength', icon: '🏋️', tone: 'strength', exercises: true, met: 5 },
    { k: 'functional', icon: '🤸', tone: 'strength', exercises: true, met: 6 },
    { k: 'hiit', icon: '⚡', tone: 'cardio', met: 8 },
    { k: 'yoga', icon: '🧘', tone: 'flex', met: 2.5 },
    { k: 'pilates', icon: '🧎', tone: 'flex', met: 3 },
    { k: 'dance', icon: '🪩', tone: 'cardio', met: 5.5 },
];
const WORKOUT_PLACES = [['home', '🏠'], ['gym', '🏋️'], ['park', '🌳'], ['pool', '🏊']];
const WORKOUT_INTENSITIES = ['easy', 'medium', 'hard'];
// עצימות משנה מעט את הערכת השריפה (תמיד "~")
const WORKOUT_INTENSITY_FACTOR = { easy: 0.85, medium: 1, hard: 1.2 };

// 📋 תוכניות מוכנות (ת8). שמות התרגילים נכתבים בשפת האפליקציה ברגע שבוחרים תוכנית
const WORKOUT_READY_PLANS = [
    { key: 'beginner', icon: '🌱', items: [
        { kind: 'walking', days: [0], duration: 30, intensity: 'easy' },
        { kind: 'strength', days: [2], duration: 25, intensity: 'easy', exercises: [['squat', 3, '10'], ['pushup', 3, '8'], ['plank', 3, '20″']] },
        { kind: 'walking', days: [4], duration: 30, intensity: 'easy' },
        { kind: 'rest', days: [6] },
    ] },
    { key: 'strength_cardio', icon: '💪', items: [
        { kind: 'strength', days: [0], duration: 40, intensity: 'medium', exercises: [['squat', 3, '12'], ['lunge', 3, '10'], ['pushup', 3, '10'], ['plank', 3, '30″']] },
        { kind: 'running', days: [1], duration: 30, intensity: 'medium' },
        { kind: 'strength', days: [3], duration: 40, intensity: 'medium', exercises: [['bridge', 3, '12'], ['squat', 3, '12'], ['pushup', 3, '10'], ['plank', 3, '30″']] },
        { kind: 'cycling', days: [4], duration: 40, intensity: 'medium' },
        { kind: 'hiit', days: [6], duration: 20, intensity: 'hard' },
        { kind: 'rest', days: [5] },
    ] },
    { key: 'yoga', icon: '🧘', items: [
        { kind: 'yoga', days: [0, 2, 4], duration: 30, intensity: 'easy' },
        { kind: 'walking', days: [5], duration: 30, intensity: 'easy' },
        { kind: 'rest', days: [6] },
    ] },
    { key: 'run5k', icon: '🏃', items: [
        { kind: 'running', days: [0], duration: 25, intensity: 'easy' },
        { kind: 'running', days: [2], duration: 25, intensity: 'medium' },
        { kind: 'running', days: [4], duration: 30, intensity: 'medium' },
        { kind: 'running', days: [6], duration: 35, intensity: 'easy' },
        { kind: 'rest', days: [5] },
    ] },
];

let workoutPlan = [];
let workoutPlanLoaded = false;
let workoutWeekSessions = [];
let workoutWeekDone = new Map();       // `${planId}|${date}` → השורה ב-sport_sessions
let workoutWeekLoadedFor = null;
let workoutGoal = { kind: 'count', value: null };
let workoutStreak = 0;
let workoutPanel = null;               // 'goal' | 'ready' | null - השורה שנפתחת מ-⋯
let workoutExpanded = new Set();       // אימונים שרשימת התרגילים שלהם פתוחה בכרטיס של היום

function wkEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function wkDays(row) { return Array.isArray(row && row.days) ? row.days.map(Number) : []; }
function wkKindInfo(row) { return WORKOUT_KINDS.find(k => k.k === (row && row.kind)) || null; }
function wkIsRest(row) { return !!row && row.kind === 'rest'; }
function wkIcon(row) { return wkIsRest(row) ? '🌿' : (wkKindInfo(row) || { icon: '✨' }).icon; }
function wkTone(row) { return wkIsRest(row) ? 'rest' : (wkKindInfo(row) || { tone: 'custom' }).tone; }
function wkName(row) {
    if (wkIsRest(row)) return t('workout_kind_rest');
    if (row.kind === 'custom') return row.custom_name || t('workout_kind_custom');
    return t('workout_kind_' + row.kind);
}
function wkHasExercises(row) { const info = wkKindInfo(row); return !!(info && info.exercises); }
function wkPlaceLabel(p) {
    if (!p) return '';
    const known = WORKOUT_PLACES.find(([k]) => k === p);
    return known ? t('workout_place_' + p) : p;
}
function wkMinutes(time) { const m = String(time || '').match(/^(\d{1,2}):(\d{2})/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function wkSortByTime(a, b) {
    const ma = wkMinutes(a.time), mb = wkMinutes(b.time);
    if (ma === null && mb === null) return (a.sort_order || 0) - (b.sort_order || 0);
    if (ma === null) return 1;
    if (mb === null) return -1;
    return ma - mb;
}
function wkOnDay(dayIdx) { return workoutPlan.filter(w => wkDays(w).includes(dayIdx)).sort(wkSortByTime); }
function wkWeekDates() { const start = currentWeekStart(); return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(start, i)); }
function wkDayIdxOf(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
function wkIsDone(planId, dateStr) { return workoutWeekDone.has(`${planId}|${dateStr}`); }

// 🔥 הערכת שריפה לאימון מהטבלה: MET לפי סוג האימון (ריצה / אופניים / "אחר" - כמו ברישום הרגיל) × עצימות
function workoutKcal(row, minutes, intensity) {
    const info = wkKindInfo(row);
    let met;
    if (info && info.met) met = info.met;
    else if (info && info.sport) met = sportMet({ sport_type: info.sport, duration_minutes: minutes, distance_km: null });
    else met = sportMet({ sport_type: 'custom', custom_type_name: wkName(row) });
    const factor = WORKOUT_INTENSITY_FACTOR[intensity] || 1;
    return Math.round(met * factor * (burnWeightKg || 70) * ((Number(minutes) || 0) / 60));
}

// ---------- טעינה ----------
async function loadWorkoutPlan() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('workout_plan').select('*').eq('user_id', currentUserId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    workoutPlan = data || [];
    workoutPlanLoaded = true;
}
async function loadWorkoutWeek() {
    if (!supabaseClient || !currentUserId) return;
    const dates = wkWeekDates();
    const { data } = await supabaseClient.from('sport_sessions').select('id, session_date, duration_minutes, source_workout_id, intensity')
        .eq('user_id', currentUserId).gte('session_date', dates[0]).lte('session_date', dates[6]);
    workoutWeekSessions = data || [];
    workoutWeekDone = new Map();
    workoutWeekSessions.forEach(s => { if (s.source_workout_id) workoutWeekDone.set(`${s.source_workout_id}|${s.session_date}`, s); });
    workoutWeekLoadedFor = dates[0];
}
async function loadWorkoutGoal() {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem('weekwise_workout_goal') || 'null'); } catch {}
    if (cached && cached.kind) workoutGoal = cached;
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('user_premium').select('workout_goal_kind, workout_goal_value').eq('user_id', currentUserId).maybeSingle();
    if (data && data.workout_goal_kind) {
        workoutGoal = { kind: data.workout_goal_kind === 'minutes' ? 'minutes' : 'count', value: Number(data.workout_goal_value) || null };
        try { localStorage.setItem('weekwise_workout_goal', JSON.stringify(workoutGoal)); } catch {}
    }
}
// המטרה: מה שנבחר, ואם לא נבחר - כמות האימונים שבטבלה (או 3)
function workoutGoalValue() {
    if (workoutGoal.value) return workoutGoal.value;
    if (workoutGoal.kind === 'minutes') return 150;
    const planned = workoutPlan.filter(w => !wkIsRest(w)).reduce((n, w) => n + wkDays(w).length, 0);
    return planned || 3;
}
function workoutWeekProgress() {
    return workoutGoal.kind === 'minutes'
        ? workoutWeekSessions.reduce((n, s) => n + (Number(s.duration_minutes) || 0), 0)
        : workoutWeekSessions.length;
}
// 🔥 רצף: כמה שבועות ברצף הגיעו למטרה (כל אימון נספר - גם מהטבלה וגם רישום רגיל). השבוע נכנס רק כשכבר הגיעו
async function loadWorkoutStreak() {
    if (!supabaseClient || !currentUserId) return;
    const thisWeek = currentWeekStart();
    const { data } = await supabaseClient.from('sport_sessions').select('session_date, duration_minutes')
        .eq('user_id', currentUserId).gte('session_date', addDaysToDateStr(thisWeek, -7 * 52)).lte('session_date', addDaysToDateStr(thisWeek, 6));
    const per = new Map();
    (data || []).forEach(r => {
        const w = getWeekStart(r.session_date);
        const e = per.get(w) || { count: 0, minutes: 0 };
        e.count++;
        e.minutes += Number(r.duration_minutes) || 0;
        per.set(w, e);
    });
    const goal = workoutGoalValue();
    const met = w => { const e = per.get(w); return !!e && (workoutGoal.kind === 'minutes' ? e.minutes : e.count) >= goal; };
    let n = met(thisWeek) ? 1 : 0;
    let w = addDaysToDateStr(thisWeek, -7);
    while (met(w)) { n++; w = addDaysToDateStr(w, -7); }
    workoutStreak = n;
}
async function loadWorkoutsAll() {
    await Promise.all([loadWorkoutPlan(), loadWorkoutGoal(), loadWorkoutWeek()]);
    await loadWorkoutStreak();
}

// נקרא ממסך הספורט (loadSportData)
async function loadWorkoutSection() {
    await loadWorkoutsAll();
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
}
// אחרי כל שינוי באימונים (גם רישום רגיל / מחיקה מההיסטוריה): ה-✓, המטרה, הרצף והצ'יפ מתעדכנים
async function workoutsAfterSportChanged() {
    if (!supabaseClient || !currentUserId) return;
    await loadWorkoutWeek();
    await loadWorkoutStreak();
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
}

// ---------- הכרטיס במסך הספורט: האימון של היום בגדול + ציר הזמן של השבוע ----------
function renderWorkoutPlan() {
    const body = document.getElementById('workout-plan-body');
    if (!body) return;
    const moreBtn = document.getElementById('btn-workout-more');
    if (moreBtn) moreBtn.classList.toggle('hidden', !workoutPlan.length);
    if (!workoutPlan.length) {
        body.innerHTML = `
            <div class="wk-empty">
                <span class="wk-empty-icon" aria-hidden="true">🗓️</span>
                <b class="wk-empty-title">${wkEsc(t('workout_empty_title'))}</b>
                <div class="wk-ready-list">${wkReadyChipsHtml()}</div>
                <button type="button" class="btn-secondary wk-add-btn" data-wk-add>${wkEsc(t('workout_add_btn'))}</button>
            </div>`;
        wkBindCard(body);
        return;
    }
    body.innerHTML = `
        ${wkHeadHtml()}
        ${workoutPanel ? wkPanelHtml() : ''}
        ${wkTodayHtml()}
        ${wkTimelineHtml()}
        <button type="button" class="btn-secondary wk-add-btn" data-wk-add>${wkEsc(t('workout_add_btn'))}</button>`;
    wkBindCard(body);
    wkTickTimer();
}

function wkRingSvg(done, goal) {
    const r = 15, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, goal ? done / goal : 0));
    return `<svg class="wk-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="${r}" class="wk-ring-bg"/><circle cx="18" cy="18" r="${r}" class="wk-ring-fg" stroke-dasharray="${(p * c).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 18 18)"/></svg>`;
}
function wkHeadHtml() {
    const goal = workoutGoalValue();
    const done = workoutWeekProgress();
    const label = t(workoutGoal.kind === 'minutes' ? 'workout_week_minutes' : 'workout_week_count');
    const reached = done >= goal;
    return `
        <div class="wk-head${reached ? ' is-reached' : ''}">
            <button type="button" class="wk-goal" data-wk-panel="goal" aria-label="${wkEsc(t('workout_goal_title'))}: ${done}/${goal} ${wkEsc(label)}">
                ${wkRingSvg(done, goal)}
                <span class="wk-goal-num"><b><bdi dir="ltr">${done}/${goal}</bdi></b><small>${wkEsc(label)}</small></span>
            </button>
            ${workoutStreak > 0 ? `<span class="wk-streak" title="${wkEsc(t('workout_streak_title'))}" aria-label="${wkEsc(t('workout_streak_title'))}: ${workoutStreak}">🔥 <bdi dir="ltr">${workoutStreak}</bdi></span>` : ''}
        </div>`;
}

// ⋯ - מטרה שבועית / תוכניות מוכנות (שורה שנפתחת בתוך הכרטיס)
function wkPanelHtml() {
    if (workoutPanel === 'goal') {
        const kind = workoutGoal.kind;
        const value = workoutGoalValue();
        return `
            <div class="wk-panel" role="group" aria-label="${wkEsc(t('workout_goal_title'))}">
                <b class="wk-panel-title">🎯 ${wkEsc(t('workout_goal_title'))}</b>
                <div class="wk-seg" role="radiogroup">
                    <button type="button" class="wk-seg-btn${kind === 'count' ? ' on' : ''}" role="radio" aria-checked="${kind === 'count'}" data-wk-goal-kind="count">${wkEsc(t('workout_goal_kind_count'))}</button>
                    <button type="button" class="wk-seg-btn${kind === 'minutes' ? ' on' : ''}" role="radio" aria-checked="${kind === 'minutes'}" data-wk-goal-kind="minutes">${wkEsc(t('workout_goal_kind_minutes'))}</button>
                </div>
                <div class="wk-stepper">
                    <button type="button" class="wk-step" data-wk-goal-step="-1" aria-label="−">−</button>
                    <b class="wk-step-value"><bdi dir="ltr">${value}</bdi></b>
                    <button type="button" class="wk-step" data-wk-goal-step="1" aria-label="+">+</button>
                </div>
            </div>`;
    }
    if (workoutPanel === 'ready') {
        return `<div class="wk-panel" role="group" aria-label="${wkEsc(t('workout_ready_title'))}"><b class="wk-panel-title">📋 ${wkEsc(t('workout_ready_title'))}</b><div class="wk-ready-list">${wkReadyChipsHtml()}</div></div>`;
    }
    return '';
}
function wkReadyChipsHtml() {
    return WORKOUT_READY_PLANS.map(p => {
        const days = p.items.filter(it => it.kind !== 'rest').reduce((n, it) => n + it.days.length, 0);
        return `<button type="button" class="wk-ready" data-wk-ready="${p.key}"><span class="wk-ready-icon" aria-hidden="true">${p.icon}</span><b>${wkEsc(t('workout_ready_' + p.key))}</b><small>${wkEsc(t('workout_ready_days').replace('{n}', days))}</small></button>`;
    }).join('');
}

function wkMetaLine(w, minutesOverride) {
    const parts = [];
    if (w.time) parts.push(`<bdi dir="ltr">${wkEsc(w.time)}</bdi>`);
    const min = minutesOverride || w.duration_minutes;
    if (min) parts.push(`${min} ${wkEsc(t('sport_minutes_unit'))}`);
    if (w.place) parts.push(wkEsc(wkPlaceLabel(w.place)));
    return parts.join(' · ');
}
function wkIntensityChip(intensity) {
    return intensity ? `<span class="wk-int wk-int-${intensity}">${wkEsc(t('workout_int_' + intensity))}</span>` : '';
}

function wkTodayHtml() {
    const today = getLocalDateString();
    const todayIdx = new Date().getDay();
    const todays = wkOnDay(todayIdx);
    const workouts = todays.filter(w => !wkIsRest(w));
    const live = wkLiveTimer();
    const tm = live ? live.tm : null;
    const timed = live ? live.row : null;
    const main = timed || workouts.find(w => !wkIsDone(w.id, today)) || workouts[workouts.length - 1];
    const whenLabel = `${t('workout_today')} · ${t(weekdayShortKeys[todayIdx])}`;
    if (!main) {
        if (todays.some(wkIsRest)) {
            return `<div class="wk-today wk-tone-rest is-rest"><span class="wk-today-when">${wkEsc(whenLabel)}</span><span class="wk-today-icon" aria-hidden="true">🌿</span><b class="wk-today-name">${wkEsc(t('workout_rest_today'))}</b></div>`;
        }
        const next = wkNextWorkout();
        return `<div class="wk-today wk-tone-none is-none"><span class="wk-today-when">${wkEsc(whenLabel)}</span><b class="wk-today-name">${wkEsc(t('workout_none_today'))}</b>${next ? `<span class="wk-today-next">${wkEsc(t('workout_next'))} ${wkEsc(t(weekdayShortKeys[next.dayIdx]))}${next.w.time ? ` · <bdi dir="ltr">${wkEsc(next.w.time)}</bdi>` : ''} · ${wkIcon(next.w)} ${wkEsc(wkName(next.w))}</span>` : ''}</div>`;
    }
    const done = wkIsDone(main.id, today);
    const ex = Array.isArray(main.exercises) && wkHasExercises(main) ? main.exercises.filter(e => e && e.name) : [];
    const open = workoutExpanded.has(main.id);
    const exTicks = wkExerciseTicks(main.id, today);
    let actions;
    if (timed) {
        const paused = !!tm.pausedAt;
        actions = `
            <div class="wk-timer${paused ? ' is-paused' : ''}" role="timer" aria-live="off">
                <span class="wk-timer-time" data-wk-timer><bdi dir="ltr">${wkFormatElapsed(workoutTimerElapsed(tm))}</bdi></span>
                <button type="button" class="wk-timer-btn" data-wk-timer-toggle aria-label="${wkEsc(t(paused ? 'workout_timer_resume' : 'workout_timer_pause'))}">${paused ? '▶' : '⏸'}</button>
                <button type="button" class="wk-go" data-wk-timer-finish>${wkEsc(t('workout_timer_finish'))}</button>
                <button type="button" class="wk-timer-cancel" data-wk-timer-cancel aria-label="${wkEsc(t('workout_timer_cancel'))}" title="${wkEsc(t('workout_timer_cancel'))}">✕</button>
            </div>`;
    } else if (done) {
        actions = `<button type="button" class="wk-done-state" data-wk-check="${main.id}" data-wk-date="${today}" aria-pressed="true" aria-label="${wkEsc(t('workout_check_aria'))}">✓ ${wkEsc(t('workout_done_state'))}</button>`;
    } else {
        actions = `
            <button type="button" class="wk-go" data-wk-start="${main.id}">▶ ${wkEsc(t('workout_start'))}</button>
            <button type="button" class="wk-check-big" data-wk-check="${main.id}" data-wk-date="${today}" aria-pressed="false" aria-label="${wkEsc(t('workout_check_aria'))}" title="${wkEsc(t('workout_done_btn'))}">✓</button>`;
    }
    return `
        <div class="wk-today wk-tone-${wkTone(main)}${done ? ' is-done' : ''}">
            <span class="wk-today-when">${wkEsc(whenLabel)}</span>
            <span class="wk-today-icon" aria-hidden="true">${wkIcon(main)}</span>
            <b class="wk-today-name">${wkEsc(wkName(main))}</b>
            <span class="wk-today-meta">${wkMetaLine(main)}${main.intensity ? ' ' + wkIntensityChip(main.intensity) : ''}</span>
            ${ex.length ? `
                <button type="button" class="wk-ex-toggle" data-wk-ex-toggle="${main.id}" aria-expanded="${open}">${wkEsc(t('workout_ex_count').replace('{n}', ex.length))} <span aria-hidden="true">${open ? '▴' : '▾'}</span></button>
                ${open ? `<ul class="wk-ex-list">${ex.map((e, i) => `<li><label><input type="checkbox" data-wk-ex-tick="${main.id}" data-i="${i}"${exTicks.includes(i) ? ' checked' : ''}><span>${wkEsc(e.name)}</span>${e.sets || e.reps ? `<bdi dir="ltr" class="wk-ex-sr">${wkEsc([e.sets, e.reps].filter(Boolean).join('×'))}</bdi>` : ''}</label></li>`).join('')}</ul>` : ''}` : ''}
            <div class="wk-today-actions">${actions}</div>
        </div>`;
}
// האימון הבא בשבעת הימים הקרובים (כשאין אימון היום)
function wkNextWorkout() {
    const todayIdx = new Date().getDay();
    for (let i = 1; i <= 7; i++) {
        const dayIdx = (todayIdx + i) % 7;
        const w = wkOnDay(dayIdx).find(x => !wkIsRest(x));
        if (w) return { w, dayIdx };
    }
    return null;
}

function wkTimelineHtml() {
    const today = getLocalDateString();
    const rows = wkWeekDates().map(date => {
        const dayIdx = wkDayIdxOf(date);
        const items = wkOnDay(dayIdx);
        const isToday = date === today;
        const isPast = date < today;
        const dayLabel = wkEsc(t(weekdayShortKeys[dayIdx]));
        if (!items.length) {
            return `<li class="wk-row is-empty${isToday ? ' is-today' : ''}" data-day="${dayIdx}"><b class="wk-day">${dayLabel}</b><span class="wk-dot" aria-hidden="true"></span><span class="wk-time"></span><button type="button" class="wk-row-main wk-row-add" data-wk-add-day="${dayIdx}" aria-label="${wkEsc(t('workout_day_add_aria'))} – ${wkEsc(t(dayNameKeys[dayIdx]))}">+</button><span></span></li>`;
        }
        return items.map((w, i) => {
            const rest = wkIsRest(w);
            const done = !rest && wkIsDone(w.id, date);
            const canCheck = !rest && (isToday || isPast);
            const check = canCheck
                ? `<button type="button" class="wk-row-check" data-wk-check="${w.id}" data-wk-date="${date}" aria-pressed="${done}" aria-label="${wkEsc(t('workout_check_aria'))} – ${wkEsc(wkName(w))}, ${wkEsc(t(dayNameKeys[dayIdx]))}">${done ? '✓' : ''}</button>`
                : '<span></span>';
            return `
                <li class="wk-row wk-tone-${wkTone(w)}${isToday ? ' is-today' : ''}${done ? ' is-done' : ''}${rest ? ' is-rest' : ''}${isPast ? ' is-past' : ''}" data-day="${dayIdx}">
                    <b class="wk-day">${i === 0 ? dayLabel : ''}</b>
                    <span class="wk-dot" aria-hidden="true"></span>
                    <span class="wk-time">${w.time && !rest ? `<bdi dir="ltr">${wkEsc(w.time)}</bdi>` : ''}</span>
                    <button type="button" class="wk-row-main" data-wk-edit="${w.id}">
                        <span class="wk-row-name">${wkIcon(w)} ${wkEsc(wkName(w))}${!rest && w.duration_minutes ? ` · <bdi dir="ltr">${w.duration_minutes}′</bdi>` : ''}</span>
                        ${!rest && w.intensity ? `<span class="wk-int-dot wk-int-${w.intensity}" title="${wkEsc(t('workout_int_' + w.intensity))}"></span>` : ''}
                    </button>
                    ${check}
                </li>`;
        }).join('');
    }).join('');
    return `<ol class="wk-line" aria-label="${wkEsc(t('workout_plan_title'))}">${rows}</ol>`;
}

function wkBindCard(body) {
    body.querySelectorAll('[data-wk-add]').forEach(b => b.addEventListener('click', () => openWorkoutEditor(null)));
    body.querySelectorAll('[data-wk-add-day]').forEach(b => b.addEventListener('click', () => openWorkoutEditor(null, Number(b.dataset.wkAddDay))));
    body.querySelectorAll('[data-wk-edit]').forEach(b => b.addEventListener('click', () => openWorkoutEditor(b.dataset.wkEdit)));
    body.querySelectorAll('[data-wk-check]').forEach(b => b.addEventListener('click', () => { b.disabled = true; toggleWorkoutDone(b.dataset.wkCheck, b.dataset.wkDate); }));
    body.querySelectorAll('[data-wk-start]').forEach(b => b.addEventListener('click', () => startWorkoutTimer(b.dataset.wkStart)));
    body.querySelectorAll('[data-wk-timer-toggle]').forEach(b => b.addEventListener('click', toggleWorkoutTimerPause));
    body.querySelectorAll('[data-wk-timer-finish]').forEach(b => b.addEventListener('click', finishWorkoutTimer));
    body.querySelectorAll('[data-wk-timer-cancel]').forEach(b => b.addEventListener('click', cancelWorkoutTimer));
    body.querySelectorAll('[data-wk-panel]').forEach(b => b.addEventListener('click', () => toggleWorkoutPanel(b.dataset.wkPanel)));
    body.querySelectorAll('[data-wk-ready]').forEach(b => b.addEventListener('click', () => chooseWorkoutReadyPlan(b.dataset.wkReady)));
    body.querySelectorAll('[data-wk-goal-kind]').forEach(b => b.addEventListener('click', () => setWorkoutGoal(b.dataset.wkGoalKind, null)));
    body.querySelectorAll('[data-wk-goal-step]').forEach(b => b.addEventListener('click', () => {
        const step = Number(b.dataset.wkGoalStep) * (workoutGoal.kind === 'minutes' ? 15 : 1);
        const max = workoutGoal.kind === 'minutes' ? 1500 : 21;
        const min = workoutGoal.kind === 'minutes' ? 15 : 1;
        setWorkoutGoal(workoutGoal.kind, Math.min(max, Math.max(min, workoutGoalValue() + step)));
    }));
    body.querySelectorAll('[data-wk-ex-toggle]').forEach(b => b.addEventListener('click', () => {
        const id = b.dataset.wkExToggle;
        if (workoutExpanded.has(id)) workoutExpanded.delete(id); else workoutExpanded.add(id);
        renderWorkoutPlan();
    }));
    body.querySelectorAll('[data-wk-ex-tick]').forEach(cb => cb.addEventListener('change', () => wkSetExerciseTick(cb.dataset.wkExTick, getLocalDateString(), Number(cb.dataset.i), cb.checked)));
}

function toggleWorkoutPanel(name) {
    workoutPanel = workoutPanel === name ? null : name;
    const more = document.getElementById('workout-more-row');
    if (more) more.classList.add('hidden');
    renderWorkoutPlan();
}
function toggleWorkoutMoreRow(e) {
    if (e) e.stopPropagation();
    const row = document.getElementById('workout-more-row');
    const btn = document.getElementById('btn-workout-more');
    if (!row) return;
    const open = row.classList.toggle('hidden') === false;
    if (btn) btn.setAttribute('aria-expanded', String(open));
}

async function setWorkoutGoal(kind, value) {
    const k = kind === 'minutes' ? 'minutes' : 'count';
    workoutGoal = { kind: k, value: k === workoutGoal.kind ? value : null };
    if (!workoutGoal.value) workoutGoal.value = workoutGoalValue();
    try { localStorage.setItem('weekwise_workout_goal', JSON.stringify(workoutGoal)); } catch {}
    renderWorkoutPlan();
    if (supabaseClient && currentUserId) {
        await supabaseClient.from('user_premium').upsert({ user_id: currentUserId, username: currentUsername, workout_goal_kind: workoutGoal.kind, workout_goal_value: workoutGoal.value }, { onConflict: 'user_id' });
    }
    await loadWorkoutStreak();
    renderWorkoutPlan();
}

// ✓ תרגילים בתוך האימון של היום - רק סימון קטן במכשיר (לא נשמר בחשבון)
function wkExerciseTicks(planId, date) {
    try { const v = JSON.parse(localStorage.getItem('weekwise_workout_ex_ticks') || '{}'); return v.date === date && Array.isArray(v[planId]) ? v[planId] : []; } catch { return []; }
}
function wkSetExerciseTick(planId, date, i, on) {
    let v = {};
    try { v = JSON.parse(localStorage.getItem('weekwise_workout_ex_ticks') || '{}'); } catch {}
    if (v.date !== date) v = { date };
    const set = new Set(Array.isArray(v[planId]) ? v[planId] : []);
    if (on) set.add(i); else set.delete(i);
    v[planId] = [...set];
    try { localStorage.setItem('weekwise_workout_ex_ticks', JSON.stringify(v)); } catch {}
}

// ---------- ✓ = נרשם בהיסטוריית הספורט (ת1), עם הקושי והמקום (ת4, ת5) ----------
async function toggleWorkoutDone(planId, dateStr, opts = {}) {
    if (!supabaseClient || !currentUserId) return;
    const w = workoutPlan.find(x => x.id === planId);
    if (!w || wkIsRest(w)) return;
    const key = `${planId}|${dateStr}`;
    const existing = workoutWeekDone.get(key);
    if (existing && !opts.minutes) {
        const { error } = await supabaseClient.from('sport_sessions').delete().eq('id', existing.id);
        if (error) { showAppToast(t('sport_add_failed'), 'error'); renderWorkoutPlan(); return; }
        workoutWeekDone.delete(key);
        workoutWeekSessions = workoutWeekSessions.filter(s => s.id !== existing.id);
    } else if (!existing) {
        if (burnWeightKg == null) await refreshBurnWeight();
        const minutes = Math.max(1, Math.round(opts.minutes || w.duration_minutes || 30));
        const info = wkKindInfo(w);
        const intensity = w.intensity || null;
        const row = {
            user_id: currentUserId, username: currentUsername,
            sport_type: info && info.sport ? info.sport : 'custom', custom_type_name: info && info.sport ? null : wkName(w),
            duration_minutes: minutes, distance_km: null, motivation: null, session_date: dateStr,
            notes: w.notes || null, photo_url: null, calories_burned: workoutKcal(w, minutes, intensity),
            source_workout_id: w.id, intensity, place: w.place || null,
        };
        const { data, error } = await supabaseClient.from('sport_sessions').insert(row).select().single();
        if (error || !data) { showAppToast(t('sport_add_failed'), 'error'); renderWorkoutPlan(); return; }
        workoutWeekDone.set(key, data);
        workoutWeekSessions.push(data);
        showAppToast(t('workout_logged_toast'));
    }
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
    const sheet = document.getElementById('modal-workout-today');
    if (sheet && sheet.classList.contains('open')) renderWorkoutTodaySheet();
    // מעקב הארוחות (שריפה), New Me (האתגר "שבועיים של תנועה" נספר לבד), המטרה והרצף
    afterSportChanged();
    if (document.getElementById('sport-summary-next-btn')) { renderSportSummary(); renderSportHistory(); }
}

// ---------- ⏱ טיימר (ת12): ▶ מתחיל, ובסיום האימון נרשם עם הזמן האמיתי. מופיע גם בצ'יפ במסך הבית ----------
const WORKOUT_TIMER_KEY = 'weekwise_workout_timer';
let workoutTimerInterval = null;
function workoutTimer() { try { const v = JSON.parse(localStorage.getItem(WORKOUT_TIMER_KEY) || 'null'); return v && v.id && v.startedAt ? v : null; } catch { return null; } }
function saveWorkoutTimer(tm) { try { if (tm) localStorage.setItem(WORKOUT_TIMER_KEY, JSON.stringify(tm)); else localStorage.removeItem(WORKOUT_TIMER_KEY); } catch {} }
function workoutTimerElapsed(tm) { const now = tm.pausedAt || Date.now(); return Math.max(0, now - tm.startedAt - (tm.pausedTotal || 0)); }
// הטיימר שרץ עכשיו ולאיזה אימון - גם אם התחיל אתמול (נרשם ליום שבו התחיל). טיימר של אימון שכבר לא בטבלה נמחק
function wkLiveTimer() {
    const tm = workoutTimer();
    if (!tm) return null;
    const row = workoutPlan.find(w => w.id === tm.id && !wkIsRest(w));
    if (!row) { if (workoutPlanLoaded) saveWorkoutTimer(null); return null; }
    return { tm, row };
}
function wkFormatElapsed(ms) {
    const s = Math.floor(ms / 1000);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const pad = n => String(n).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function startWorkoutTimer(planId) {
    saveWorkoutTimer({ id: planId, date: getLocalDateString(), startedAt: Date.now(), pausedAt: null, pausedTotal: 0 });
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
    const sheet = document.getElementById('modal-workout-today');
    if (sheet && sheet.classList.contains('open')) renderWorkoutTodaySheet();
}
function toggleWorkoutTimerPause() {
    const tm = workoutTimer();
    if (!tm) return;
    if (tm.pausedAt) { tm.pausedTotal = (tm.pausedTotal || 0) + (Date.now() - tm.pausedAt); tm.pausedAt = null; }
    else tm.pausedAt = Date.now();
    saveWorkoutTimer(tm);
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
    const sheet = document.getElementById('modal-workout-today');
    if (sheet && sheet.classList.contains('open')) renderWorkoutTodaySheet();
}
async function finishWorkoutTimer() {
    const tm = workoutTimer();
    if (!tm) return;
    const minutes = Math.max(1, Math.round(workoutTimerElapsed(tm) / 60000));
    saveWorkoutTimer(null);
    if (wkIsDone(tm.id, tm.date)) {
        // כבר סומן ✓ בזמן שהטיימר רץ - מעדכנים את המשך לזמן האמיתי
        const s = workoutWeekDone.get(`${tm.id}|${tm.date}`);
        const w = workoutPlan.find(x => x.id === tm.id);
        if (s && w) {
            await supabaseClient.from('sport_sessions').update({ duration_minutes: minutes, calories_burned: workoutKcal(w, minutes, s.intensity || w.intensity) }).eq('id', s.id);
            s.duration_minutes = minutes;
        }
        renderWorkoutPlan();
        renderMyDayWorkoutChip();
        afterSportChanged();
        return;
    }
    await toggleWorkoutDone(tm.id, tm.date, { minutes });
}
function cancelWorkoutTimer() {
    saveWorkoutTimer(null);
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
    const sheet = document.getElementById('modal-workout-today');
    if (sheet && sheet.classList.contains('open')) renderWorkoutTodaySheet();
}
// מעדכן כל שנייה את השעון בכרטיס, בצ'יפ ובחלון (רק כשיש טיימר שרץ)
function wkTickTimer() {
    const tm = workoutTimer();
    if (!tm || tm.pausedAt) { if (workoutTimerInterval) { clearInterval(workoutTimerInterval); workoutTimerInterval = null; } wkPaintTimer(); return; }
    wkPaintTimer();
    if (!workoutTimerInterval) workoutTimerInterval = setInterval(() => { if (!workoutTimer()) { clearInterval(workoutTimerInterval); workoutTimerInterval = null; } wkPaintTimer(); }, 1000);
}
function wkPaintTimer() {
    const tm = workoutTimer();
    if (!tm) return;
    const txt = wkFormatElapsed(workoutTimerElapsed(tm));
    document.querySelectorAll('[data-wk-timer] bdi').forEach(el => { el.textContent = txt; });
}

// ---------- 📋 תוכניות מוכנות ----------
function chooseWorkoutReadyPlan(key) {
    const plan = WORKOUT_READY_PLANS.find(p => p.key === key);
    if (!plan) return;
    if (workoutPlan.length) showDangerConfirm(t('workout_ready_replace_title'), t('workout_ready_replace_confirm'), () => applyWorkoutReadyPlan(plan));
    else applyWorkoutReadyPlan(plan);
}
async function applyWorkoutReadyPlan(plan) {
    if (!supabaseClient || !currentUserId) return;
    if (workoutPlan.length) await supabaseClient.from('workout_plan').delete().eq('user_id', currentUserId);
    const rows = plan.items.map((it, i) => ({
        user_id: currentUserId, kind: it.kind, custom_name: null, days: it.days, time: null,
        duration_minutes: it.duration || null, intensity: it.intensity || null, place: null,
        exercises: it.exercises ? it.exercises.map(([n, sets, reps]) => ({ name: t('workout_ex_' + n), sets, reps })) : null,
        notes: null, sort_order: i,
    }));
    const { error } = await supabaseClient.from('workout_plan').insert(rows);
    if (error) { showAppToast(t('sport_add_failed'), 'error'); return; }
    workoutPanel = null;
    showAppToast(t('workout_ready_applied'));
    await loadWorkoutPlan();
    await loadWorkoutStreak();
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
}

// ---------- הוספה / עריכה ----------
let workoutDraft = null;
function openWorkoutEditor(id, dayIdx) {
    const row = id ? workoutPlan.find(w => w.id === id) : null;
    workoutDraft = row ? {
        id: row.id, kind: row.kind, custom_name: row.custom_name || '', days: new Set(wkDays(row)), time: row.time || null,
        duration: row.duration_minutes || '', intensity: row.intensity || null, place: row.place || null,
        exercises: Array.isArray(row.exercises) ? row.exercises.map(e => ({ name: e.name || '', sets: e.sets || '', reps: e.reps || '' })) : [],
        notes: row.notes || '',
    } : {
        id: null, kind: 'running', custom_name: '', days: new Set(dayIdx != null ? [dayIdx] : [new Date().getDay()]), time: null,
        duration: 30, intensity: null, place: null, exercises: [], notes: '',
    };
    // שם מותאם שהוא אחד מסוגי הספורט השמורים - הבועה שלו נבחרת
    renderWorkoutEditor();
    openModal('modal-workout-plan');
}
function wkCustomPlace(p) { return !!p && !WORKOUT_PLACES.some(([k]) => k === p); }
function renderWorkoutEditor() {
    const box = document.getElementById('workout-editor-body');
    const title = document.getElementById('workout-editor-title');
    if (!box || !workoutDraft) return;
    const d = workoutDraft;
    if (title) title.textContent = t(d.id ? 'workout_edit_title' : 'workout_new_title');
    const rest = d.kind === 'rest';
    const savedTypes = typeof cachedCustomSportTypes !== 'undefined' ? cachedCustomSportTypes : [];
    const isSavedType = name => savedTypes.some(s => s.name === name);
    const customOn = d.kind === 'custom' && !isSavedType(d.custom_name);
    const kindChips = [
        ...WORKOUT_KINDS.map(k => `<button type="button" class="ai-brain-tab${d.kind === k.k ? ' active' : ''}" data-wk-kind="${k.k}" aria-pressed="${d.kind === k.k}">${k.icon} ${wkEsc(t('workout_kind_' + k.k))}</button>`),
        ...savedTypes.map(s => `<button type="button" class="ai-brain-tab${d.kind === 'custom' && d.custom_name === s.name ? ' active' : ''}" data-wk-saved="${wkEsc(s.name)}" aria-pressed="${d.kind === 'custom' && d.custom_name === s.name}">${wkEsc(s.name)}</button>`),
        `<button type="button" class="ai-brain-tab${customOn ? ' active' : ''}" data-wk-kind="custom" aria-pressed="${customOn}">✨ ${wkEsc(t('workout_kind_custom'))}</button>`,
        `<button type="button" class="ai-brain-tab wk-kind-rest${rest ? ' active' : ''}" data-wk-kind="rest" aria-pressed="${rest}">🌿 ${wkEsc(t('workout_kind_rest'))}</button>`,
    ].join('');
    const days = [0, 1, 2, 3, 4, 5, 6].map(i => `<button type="button" class="board-hour-chip${d.days.has(i) ? ' active' : ''}" data-wk-day="${i}" aria-pressed="${d.days.has(i)}" aria-label="${wkEsc(t(dayNameKeys[i]))}">${wkEsc(t(weekdayShortKeys[i]))}</button>`).join('');
    const placeOther = wkCustomPlace(d.place);
    const places = [
        ...WORKOUT_PLACES.map(([k, icon]) => `<button type="button" class="color-filter-option${d.place === k ? ' active' : ''}" data-wk-place="${k}" aria-pressed="${d.place === k}">${icon} ${wkEsc(t('workout_place_' + k))}</button>`),
        `<button type="button" class="color-filter-option${placeOther || d.place === '' ? ' active' : ''}" data-wk-place="__other" aria-pressed="${placeOther}">✏️ ${wkEsc(t('workout_place_other'))}</button>`,
    ].join('');
    const intensities = WORKOUT_INTENSITIES.map(k => `<button type="button" class="color-filter-option wk-int-pick wk-int-${k}${d.intensity === k ? ' active' : ''}" data-wk-int="${k}" aria-pressed="${d.intensity === k}">${wkEsc(t('workout_int_' + k))}</button>`).join('');
    const showEx = !rest && wkHasExercises({ kind: d.kind });
    box.innerHTML = `
        <div class="ai-brain-tabs wk-kinds">${kindChips}</div>
        <input type="text" class="wk-custom-name${customOn ? '' : ' hidden'}" id="wk-custom-name" maxlength="40" autocomplete="off" value="${wkEsc(customOn ? d.custom_name : '')}" placeholder="${wkEsc(t('workout_custom_ph'))}">
        <span class="wk-label">📅 ${wkEsc(t('workout_days_label'))}</span>
        <div class="daily-board-hours-chips wk-days">${days}</div>
        ${rest ? '' : `
        <div class="wk-two nm-rem-row">
            <div class="wk-field"><span class="wk-label">⏰ ${wkEsc(t('workout_time_label'))}</span>
                <span class="wk-time-row"><button type="button" class="nm-time-btn" id="wk-time-btn" data-time-id="workout" aria-expanded="false" aria-label="${wkEsc(t('workout_time_label'))}" onclick="nmToggleTimePicker(this)"><bdi dir="ltr">${wkEsc(d.time || '--:--')}</bdi></button>${d.time ? `<button type="button" class="wk-time-clear" data-wk-time-clear aria-label="${wkEsc(t('workout_time_clear'))}">✕</button>` : ''}</span>
            </div>
            <div class="wk-field"><span class="wk-label" id="wk-duration-label">⏱️ ${wkEsc(t('workout_duration_label'))}</span>
                <input type="number" inputmode="numeric" min="1" max="600" id="wk-duration" aria-labelledby="wk-duration-label" value="${wkEsc(d.duration)}">
            </div>
        </div>
        <span class="wk-label">💪 ${wkEsc(t('workout_intensity_label'))}</span>
        <div class="color-filter-picker wk-ints">${intensities}</div>
        <span class="wk-label">📍 ${wkEsc(t('workout_place_label'))}</span>
        <div class="color-filter-picker wk-places">${places}</div>
        <input type="text" class="wk-place-other${placeOther || d.place === '' ? '' : ' hidden'}" id="wk-place-other" maxlength="40" autocomplete="off" value="${wkEsc(placeOther ? d.place : '')}" placeholder="${wkEsc(t('workout_place_ph'))}">
        ${showEx ? `
        <span class="wk-label">📝 ${wkEsc(t('workout_exercises_label'))}</span>
        <div class="wk-ex-edit">${d.exercises.map((e, i) => `
            <div class="wk-ex-row" data-i="${i}">
                <input type="text" class="wk-ex-name" maxlength="40" value="${wkEsc(e.name)}" placeholder="${wkEsc(t('workout_ex_name_ph'))}" aria-label="${wkEsc(t('workout_ex_name_ph'))}">
                <input type="number" inputmode="numeric" min="1" max="99" class="wk-ex-sets" value="${wkEsc(e.sets)}" placeholder="${wkEsc(t('workout_ex_sets_ph'))}" aria-label="${wkEsc(t('workout_ex_sets_ph'))}">
                <input type="text" class="wk-ex-reps" maxlength="12" value="${wkEsc(e.reps)}" placeholder="${wkEsc(t('workout_ex_reps_ph'))}" aria-label="${wkEsc(t('workout_ex_reps_ph'))}">
                <button type="button" class="wk-ex-del" data-wk-ex-del="${i}" aria-label="${wkEsc(t('workout_ex_delete'))}">✕</button>
            </div>`).join('')}
            <button type="button" class="wk-ex-add" data-wk-ex-add>${wkEsc(t('workout_ex_add'))}</button>
        </div>` : ''}
        <textarea id="wk-notes" rows="2" maxlength="300" placeholder="${wkEsc(t('workout_notes_ph'))}">${wkEsc(d.notes)}</textarea>`}
        <div class="action-buttons-wrap wk-editor-actions">
            <button type="button" class="btn-primary" data-wk-save>${wkEsc(t('save_generic'))}</button>
            ${d.id ? `<button type="button" class="btn-clear-specific wk-delete" data-wk-delete>✕ ${wkEsc(t('workout_delete_btn'))}</button>` : ''}
            <button type="button" class="btn-clear-specific" onclick="closeModal('modal-workout-plan')">${wkEsc(t('close_btn'))}</button>
        </div>`;
    if (typeof nmTimePickHandlers !== 'undefined') nmTimePickHandlers.workout = v => {
        workoutDraft.time = v;
        const row = box.querySelector('.wk-time-row');
        if (row && !row.querySelector('[data-wk-time-clear]')) {
            const x = document.createElement('button');
            x.type = 'button';
            x.className = 'wk-time-clear';
            x.dataset.wkTimeClear = '';
            x.setAttribute('aria-label', t('workout_time_clear'));
            x.textContent = '✕';
            x.addEventListener('click', () => { wkCaptureDraft(); workoutDraft.time = null; renderWorkoutEditor(); });
            row.appendChild(x);
        }
    };
    box.querySelectorAll('[data-wk-kind]').forEach(b => b.addEventListener('click', () => {
        wkCaptureDraft();
        d.kind = b.dataset.wkKind;
        if (d.kind === 'custom' && isSavedType(d.custom_name)) d.custom_name = '';
        renderWorkoutEditor();
        if (d.kind === 'custom') { const inp = document.getElementById('wk-custom-name'); if (inp) inp.focus(); }
    }));
    box.querySelectorAll('[data-wk-saved]').forEach(b => b.addEventListener('click', () => { wkCaptureDraft(); d.kind = 'custom'; d.custom_name = b.dataset.wkSaved; renderWorkoutEditor(); }));
    box.querySelectorAll('[data-wk-day]').forEach(b => b.addEventListener('click', () => {
        wkCaptureDraft();
        const i = Number(b.dataset.wkDay);
        if (d.days.has(i)) d.days.delete(i); else d.days.add(i);
        renderWorkoutEditor();
    }));
    box.querySelectorAll('[data-wk-int]').forEach(b => b.addEventListener('click', () => { wkCaptureDraft(); d.intensity = d.intensity === b.dataset.wkInt ? null : b.dataset.wkInt; renderWorkoutEditor(); }));
    box.querySelectorAll('[data-wk-place]').forEach(b => b.addEventListener('click', () => {
        wkCaptureDraft();
        const p = b.dataset.wkPlace;
        if (p === '__other') d.place = wkCustomPlace(d.place) ? d.place : '';
        else d.place = d.place === p ? null : p;
        renderWorkoutEditor();
        if (p === '__other') { const inp = document.getElementById('wk-place-other'); if (inp) inp.focus(); }
    }));
    const clear = box.querySelector('[data-wk-time-clear]');
    if (clear) clear.addEventListener('click', () => { wkCaptureDraft(); d.time = null; renderWorkoutEditor(); });
    box.querySelectorAll('[data-wk-ex-del]').forEach(b => b.addEventListener('click', () => { wkCaptureDraft(); d.exercises.splice(Number(b.dataset.wkExDel), 1); renderWorkoutEditor(); }));
    const exAdd = box.querySelector('[data-wk-ex-add]');
    if (exAdd) exAdd.addEventListener('click', () => {
        wkCaptureDraft();
        d.exercises.push({ name: '', sets: '', reps: '' });
        renderWorkoutEditor();
        const names = document.querySelectorAll('#workout-editor-body .wk-ex-name');
        if (names.length) names[names.length - 1].focus();
    });
    box.querySelector('[data-wk-save]').addEventListener('click', saveWorkoutDraft);
    const del = box.querySelector('[data-wk-delete]');
    if (del) del.addEventListener('click', () => {
        closeModal('modal-workout-plan');
        showDangerConfirm(t('workout_delete_title'), t('workout_delete_confirm'), () => deleteWorkout(d.id));
    });
}
// מה שהוקלד נשמר בטיוטה לפני כל ציור מחדש של החלון
function wkCaptureDraft() {
    const d = workoutDraft;
    if (!d) return;
    const val = id => { const el = document.getElementById(id); return el ? el.value : null; };
    const custom = val('wk-custom-name');
    if (custom !== null && d.kind === 'custom' && !document.getElementById('wk-custom-name').classList.contains('hidden')) d.custom_name = custom.trim();
    const dur = val('wk-duration');
    if (dur !== null) d.duration = dur;
    const po = document.getElementById('wk-place-other');
    if (po && !po.classList.contains('hidden')) d.place = po.value.trim();
    const notes = val('wk-notes');
    if (notes !== null) d.notes = notes;
    const rows = document.querySelectorAll('#workout-editor-body .wk-ex-row');
    if (rows.length) d.exercises = [...rows].map(r => ({ name: r.querySelector('.wk-ex-name').value.trim(), sets: r.querySelector('.wk-ex-sets').value, reps: r.querySelector('.wk-ex-reps').value.trim() }));
}
async function saveWorkoutDraft() {
    wkCaptureDraft();
    const d = workoutDraft;
    if (!d || !supabaseClient || !currentUserId) return;
    if (!d.days.size) { showAppToast(t('workout_missing_days'), 'error'); return; }
    if (d.kind === 'custom' && !d.custom_name) { showAppToast(t('workout_missing_name'), 'error'); const inp = document.getElementById('wk-custom-name'); if (inp) inp.focus(); return; }
    const rest = d.kind === 'rest';
    const duration = parseInt(d.duration, 10);
    if (!rest && !(duration > 0)) { showAppToast(t('workout_missing_duration'), 'error'); const inp = document.getElementById('wk-duration'); if (inp) inp.focus(); return; }
    const exercises = !rest && wkHasExercises({ kind: d.kind })
        ? d.exercises.filter(e => e.name).map(e => ({ name: e.name, sets: parseInt(e.sets, 10) || null, reps: e.reps || null }))
        : [];
    const row = {
        user_id: currentUserId, kind: d.kind, custom_name: d.kind === 'custom' ? d.custom_name : null,
        days: [...d.days].sort((a, b) => a - b), time: rest ? null : (d.time || null),
        duration_minutes: rest ? null : duration, intensity: rest ? null : (d.intensity || null),
        place: rest ? null : (d.place || null), exercises: exercises.length ? exercises : null,
        notes: rest ? null : (d.notes.trim() || null), updated_at: new Date().toISOString(),
    };
    let error;
    if (d.id) ({ error } = await supabaseClient.from('workout_plan').update(row).eq('id', d.id).eq('user_id', currentUserId));
    else ({ error } = await supabaseClient.from('workout_plan').insert({ ...row, sort_order: workoutPlan.length }));
    if (error) { showAppToast(t('sport_add_failed'), 'error'); return; }
    closeModal('modal-workout-plan');
    workoutDraft = null;
    await loadWorkoutPlan();
    await loadWorkoutStreak();
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
}
async function deleteWorkout(id) {
    if (!supabaseClient || !currentUserId) return;
    await supabaseClient.from('workout_plan').delete().eq('id', id).eq('user_id', currentUserId);
    const tm = workoutTimer();
    if (tm && tm.id === id) saveWorkoutTimer(null);
    await loadWorkoutPlan();
    await loadWorkoutStreak();
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
}

// ---------- "היום שלי": צ'יפ קטן ליד המים עם האימון של היום (ה2). נגיעה - פרטים, ▶ ו-✓ ----------
let workoutHomeLoadedAt = 0;
async function refreshMyDayWorkoutChip() {
    if (!supabaseClient || !currentUserId) return;
    const weekStart = currentWeekStart();
    // פעם אחת לכמה דקות מספיק - כל שינוי באימונים מרענן בעצמו
    if (!workoutPlanLoaded || workoutWeekLoadedFor !== weekStart || Date.now() - workoutHomeLoadedAt > 5 * 60 * 1000) {
        workoutHomeLoadedAt = Date.now();
        await Promise.all([loadWorkoutPlan(), loadWorkoutWeek()]);
    }
    renderMyDayWorkoutChip();
}
function wkTodayMain() {
    const today = getLocalDateString();
    const workouts = wkOnDay(new Date().getDay()).filter(w => !wkIsRest(w));
    const live = wkLiveTimer();
    const tm = live ? live.tm : null;
    const timed = live ? live.row : null;
    return { workouts, main: timed || workouts.find(w => !wkIsDone(w.id, today)) || workouts[workouts.length - 1] || null, timed, today };
}
function renderMyDayWorkoutChip() {
    const chip = document.getElementById('myday-workout-chip');
    if (!chip) return;
    const { workouts, main, timed, today } = wkTodayMain();
    if (!main) { chip.classList.add('hidden'); chip.innerHTML = ''; return; }
    const allDone = workouts.every(w => wkIsDone(w.id, today));
    chip.classList.remove('hidden');
    chip.classList.toggle('is-done', allDone && !timed);
    chip.classList.toggle('is-timing', !!timed);
    if (timed) {
        const tm = workoutTimer();
        chip.innerHTML = `<span aria-hidden="true">⏱</span><span class="myday-workout-time" data-wk-timer><bdi dir="ltr">${wkFormatElapsed(workoutTimerElapsed(tm))}</bdi></span>`;
        wkTickTimer();
    } else {
        chip.innerHTML = `<span aria-hidden="true">${wkIcon(main)}</span>${allDone ? '<span class="myday-workout-time">✓</span>' : (main.time ? `<span class="myday-workout-time"><bdi dir="ltr">${wkEsc(main.time)}</bdi></span>` : '')}`;
    }
    chip.setAttribute('aria-label', `${t('myday_workout_aria')}: ${wkName(main)}${main.time ? ' ' + main.time : ''}${allDone ? ' ✓' : ''}`);
}
function openWorkoutTodaySheet() {
    renderWorkoutTodaySheet();
    openModal('modal-workout-today');
}
function renderWorkoutTodaySheet() {
    const box = document.getElementById('workout-today-body');
    if (!box) return;
    box.innerHTML = `${wkTodayHtml()}
        <button type="button" class="btn-secondary wk-open-table" data-wk-open-table>${wkEsc(t('workout_open_table'))}</button>`;
    wkBindCard(box);
    box.querySelector('[data-wk-open-table]').addEventListener('click', () => {
        closeModal('modal-workout-today');
        if (typeof navigateFromMenu === 'function') navigateFromMenu('sport-section');
    });
    wkTickTimer();
}
