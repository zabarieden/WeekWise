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
    const board = workoutView() === 'board';
    body.innerHTML = `
        ${wkHeadHtml()}
        ${workoutPanel ? wkPanelHtml() : ''}
        ${wkTodayHtml()}
        ${board ? wkBoardHtml() : wkTimelineHtml()}
        <button type="button" class="btn-secondary wk-add-btn" data-wk-add>${wkEsc(t('workout_add_btn'))}</button>`;
    wkBindCard(body);
    if (board) wkBindBoard(body.querySelector('.wk-board'));
    wkTickTimer();
}

// 🗂️ שתי תצוגות לשבוע: ציר זמן (ברירת המחדל) או לוח שבועי שגוררים בו (13) - נבחר מ-⋯, נשמר במכשיר
function workoutView() { try { return localStorage.getItem('weekwise_workout_view') === 'board' ? 'board' : 'timeline'; } catch { return 'timeline'; } }
function setWorkoutView(v) {
    try { localStorage.setItem('weekwise_workout_view', v === 'board' ? 'board' : 'timeline'); } catch {}
    const more = document.getElementById('workout-more-row');
    if (more) more.classList.add('hidden');
    renderWorkoutPlan();
}
function toggleWorkoutView() { setWorkoutView(workoutView() === 'board' ? 'timeline' : 'board'); }
function renderWorkoutViewBtn() {
    const btn = document.getElementById('btn-workout-view');
    if (!btn) return;
    const board = workoutView() === 'board';
    btn.innerHTML = `<span aria-hidden="true">${board ? '📋' : '🗂️'}</span> ${wkEsc(t(board ? 'workout_view_timeline' : 'workout_view_board'))}`;
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
    renderWorkoutViewBtn();
    const open = row.classList.toggle('hidden') === false;
    if (btn) btn.setAttribute('aria-expanded', String(open));
}

// ---------- 🗂️ לוח שבועי (13): כל יום עמודה, וגוררים אימון ליום אחר כשמשהו משתנה. נגיעה בלי גרירה - עריכה ----------
function wkBoardHtml() {
    const today = getLocalDateString();
    const cols = wkWeekDates().map(date => {
        const dayIdx = wkDayIdxOf(date);
        const cards = wkOnDay(dayIdx).map(w => {
            const rest = wkIsRest(w);
            const done = !rest && wkIsDone(w.id, date);
            const canCheck = !rest && date <= today;
            return `
                <div class="wk-card wk-tone-${wkTone(w)}${done ? ' is-done' : ''}${rest ? ' is-rest' : ''}" role="button" tabindex="0" data-wk-card="${w.id}" data-day="${dayIdx}" aria-label="${wkEsc(wkName(w))}${w.time && !rest ? ' ' + wkEsc(w.time) : ''}, ${wkEsc(t(dayNameKeys[dayIdx]))}">
                    <span class="wk-card-name">${wkIcon(w)} ${wkEsc(wkName(w))}</span>
                    ${rest ? '' : `<span class="wk-card-meta">${[w.time ? `<bdi dir="ltr">${wkEsc(w.time)}</bdi>` : '', w.duration_minutes ? `<bdi dir="ltr">${w.duration_minutes}′</bdi>` : ''].filter(Boolean).join(' · ')}</span>`}
                    ${canCheck ? `<button type="button" class="wk-card-check" data-wk-check="${w.id}" data-wk-date="${date}" aria-pressed="${done}" aria-label="${wkEsc(t('workout_check_aria'))} – ${wkEsc(wkName(w))}, ${wkEsc(t(dayNameKeys[dayIdx]))}">${done ? '✓' : ''}</button>` : ''}
                    ${w.routine_item_id ? '<span class="wk-card-routine" aria-hidden="true">📅</span>' : ''}
                </div>`;
        }).join('');
        return `
            <div class="wk-col${date === today ? ' is-today' : ''}" data-day="${dayIdx}">
                <b class="wk-col-day">${wkEsc(t(weekdayShortKeys[dayIdx]))}</b>
                <div class="wk-col-cards">${cards}</div>
                <button type="button" class="wk-col-add" data-wk-add-day="${dayIdx}" aria-label="${wkEsc(t('workout_day_add_aria'))} – ${wkEsc(t(dayNameKeys[dayIdx]))}">+</button>
            </div>`;
    }).join('');
    return `<div class="wk-board" aria-label="${wkEsc(t('workout_view_board'))}">${cols}</div>`;
}
let wkDrag = null;
function wkBindBoard(board) {
    if (!board) return;
    board.querySelectorAll('.wk-card').forEach(card => card.addEventListener('pointerdown', e => wkDragArm(e, card)));
    // ✓ / עריכה מהמקלדת: Enter על כרטיס פותח אותו (הגרירה היא רק לעכבר ולמגע)
    board.querySelectorAll('.wk-card').forEach(card => card.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target === card) { e.preventDefault(); openWorkoutEditor(card.dataset.wkCard); } }));
    const todayCol = board.querySelector('.wk-col.is-today');
    if (todayCol) board.scrollLeft = todayCol.offsetLeft - (board.clientWidth - todayCol.offsetWidth) / 2;
}
// בעכבר הגרירה מתחילה אחרי תזוזה קטנה; במגע - אחרי לחיצה ארוכה, כדי שהחלקה רגילה עדיין תגלול את הלוח
function wkDragArm(e, card) {
    if (e.button > 0 || e.target.closest('.wk-card-check')) return;
    wkDragCleanup();
    wkDrag = { card, id: card.dataset.wkCard, fromDay: Number(card.dataset.day), x: e.clientX, y: e.clientY, touch: e.pointerType === 'touch', started: false, timer: null, ghost: null, over: null };
    if (wkDrag.touch) wkDrag.timer = setTimeout(() => { if (wkDrag && !wkDrag.started) wkDragBegin(wkDrag.x, wkDrag.y); }, 320);
    window.addEventListener('pointermove', wkDragMove, { passive: false });
    window.addEventListener('pointerup', wkDragEnd);
    window.addEventListener('pointercancel', wkDragCleanup);
    document.addEventListener('touchmove', wkDragTouchMove, { passive: false });
}
function wkDragTouchMove(e) { if (wkDrag && wkDrag.started) e.preventDefault(); }
function wkDragBegin(x, y) {
    const d = wkDrag;
    if (!d) return;
    d.started = true;
    const r = d.card.getBoundingClientRect();
    d.dx = x - r.left;
    d.dy = y - r.top;
    const ghost = d.card.cloneNode(true);
    ghost.classList.add('wk-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${r.width}px`;
    ghost.style.left = `${x - d.dx}px`;
    ghost.style.top = `${y - d.dy}px`;
    document.body.appendChild(ghost);
    d.ghost = ghost;
    d.card.classList.add('is-dragging');
    document.body.classList.add('wk-dragging');
    try { if (navigator.vibrate) navigator.vibrate(12); } catch {}
}
function wkColAt(x, y) {
    const el = document.elementFromPoint(x, y);
    return el ? el.closest('.wk-col') : null;
}
function wkDragMove(e) {
    const d = wkDrag;
    if (!d) return;
    if (!d.started) {
        const dist = Math.hypot(e.clientX - d.x, e.clientY - d.y);
        if (d.touch) { if (dist > 10) wkDragCleanup(); return; }
        if (dist < 6) return;
        wkDragBegin(e.clientX, e.clientY);
    }
    e.preventDefault();
    d.ghost.style.left = `${e.clientX - d.dx}px`;
    d.ghost.style.top = `${e.clientY - d.dy}px`;
    const col = wkColAt(e.clientX, e.clientY);
    if (d.over !== col) {
        if (d.over) d.over.classList.remove('is-drop');
        d.over = col;
        if (col && Number(col.dataset.day) !== d.fromDay) col.classList.add('is-drop');
    }
}
function wkDragEnd(e) {
    const d = wkDrag;
    if (!d) return;
    const col = d.started ? wkColAt(e.clientX, e.clientY) : null;
    const tap = !d.started;
    wkDragCleanup();
    if (tap) { openWorkoutEditor(d.id); return; }
    if (col && Number(col.dataset.day) !== d.fromDay) moveWorkoutDay(d.id, d.fromDay, Number(col.dataset.day));
}
function wkDragCleanup() {
    const d = wkDrag;
    wkDrag = null;
    window.removeEventListener('pointermove', wkDragMove);
    window.removeEventListener('pointerup', wkDragEnd);
    window.removeEventListener('pointercancel', wkDragCleanup);
    document.removeEventListener('touchmove', wkDragTouchMove);
    document.body.classList.remove('wk-dragging');
    if (!d) return;
    clearTimeout(d.timer);
    if (d.ghost) d.ghost.remove();
    if (d.over) d.over.classList.remove('is-drop');
    d.card.classList.remove('is-dragging');
}
// גרירה מיום ליום: היום הזה יוצא מהאימון והיום החדש נכנס (גם בשגרה, אם הוא שם)
async function moveWorkoutDay(id, fromDay, toDay) {
    const w = workoutPlan.find(x => x.id === id);
    if (!w || !supabaseClient || !currentUserId) return;
    const days = new Set(wkDays(w));
    days.delete(fromDay);
    days.add(toDay);
    const next = [...days].sort((a, b) => a - b);
    w.days = next;
    renderWorkoutPlan();
    const { error } = await supabaseClient.from('workout_plan').update({ days: next, updated_at: new Date().toISOString() }).eq('id', id).eq('user_id', currentUserId);
    if (error) { showAppToast(t('sport_add_failed'), 'error'); await loadWorkoutPlan(); renderWorkoutPlan(); return; }
    if (w.routine_item_id) await syncWorkoutToRoutine(w, true);
    showAppToast(t('workout_moved').replace('{day}', t(dayNameKeys[toDay])));
    renderMyDayWorkoutChip();
}

// ---------- 📅 סנכרון עם "השגרה שלי" בשני הכיוונים ("ומשם אפשר גם להוסיף לשגרה ולהפך") ----------
// אימון בשגרה = פריט שגרה בשעה ובימים שלו (routine_item_id). שינוי באימון משנה את הפריט, שינוי בפריט (שעה / ימים)
// משנה את האימון, ✓ באחד מהם נרשם בשניהם. ב"היום שלי" הפריט לא מופיע פעמיים - האימון כבר בצ'יפ
function wkRoutineTitle(w) { return `${wkIcon(w)} ${wkName(w)}`; }
function workoutForRoutineItem(itemId) { return workoutPlan.find(w => w.routine_item_id === itemId) || null; }
function routineItemIsWorkout(item) { return !!(item && workoutForRoutineItem(item.id)); }
async function wkRoutineTabs() {
    let tabs = typeof dailyBoardTabs !== 'undefined' && dailyBoardTabs.length ? dailyBoardTabs : null;
    if (!tabs) {
        const { data } = await supabaseClient.from('routine_tabs').select('*').eq('user_id', currentUserId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
        tabs = data || [];
    }
    if (!tabs.length) {
        // כמו בפתיחה הראשונה של השגרה שלי: שגרה יומית + לימודים
        const { data: inserted } = await supabaseClient.from('routine_tabs').insert([
            { user_id: currentUserId, username: currentUsername, name: t('daily_board_default_tab_daily'), sort_order: 0 },
            { user_id: currentUserId, username: currentUsername, name: t('daily_board_default_tab_study'), sort_order: 1 },
        ]).select('*');
        tabs = inserted || [];
        if (typeof dailyBoardTabs !== 'undefined') dailyBoardTabs = tabs;
    }
    return tabs;
}
// הטאב שמכסה את כל ימי האימון; אחרת טאב של כל הימים; אחרת הראשון
async function wkRoutineTabFor(w) {
    const tabs = await wkRoutineTabs();
    const days = wkDays(w);
    return tabs.find(tb => { const td = routineTabWeekdays(tb); return td.length && days.every(d => td.includes(d)); })
        || tabs.find(tb => !routineTabWeekdays(tb).length) || tabs[0] || null;
}
async function syncWorkoutToRoutine(w, on) {
    if (!supabaseClient || !currentUserId || !w) return;
    if (on && w.time && !wkIsRest(w)) {
        const payload = { title: wkRoutineTitle(w), time: w.time, days_of_week: wkDays(w).join(',') };
        if (w.routine_item_id) {
            const { data } = await supabaseClient.from('routine_items').update(payload).eq('id', w.routine_item_id).eq('user_id', currentUserId).select('id');
            if (data && data.length) { wkAfterRoutineChange(); return; }
        }
        const tab = await wkRoutineTabFor(w);
        if (!tab) return;
        const { data: ins } = await supabaseClient.from('routine_items').insert({ ...payload, kind: 'scheduled', tab_id: tab.id, user_id: currentUserId }).select().single();
        if (ins) {
            await supabaseClient.from('workout_plan').update({ routine_item_id: ins.id }).eq('id', w.id).eq('user_id', currentUserId);
            w.routine_item_id = ins.id;
        }
    } else if (w.routine_item_id) {
        await supabaseClient.from('routine_items').delete().eq('id', w.routine_item_id).eq('user_id', currentUserId);
        await supabaseClient.from('workout_plan').update({ routine_item_id: null }).eq('id', w.id).eq('user_id', currentUserId);
        w.routine_item_id = null;
    }
    wkAfterRoutineChange();
}
function wkAfterRoutineChange() {
    const board = document.getElementById('modal-daily-board');
    if (board && board.classList.contains('open') && typeof renderDailyBoard === 'function') renderDailyBoard();
    if (typeof loadTodayTasks === 'function') loadTodayTasks();
}
// מהשגרה: שינוי שעה / ימים בפריט שהוא אימון - גם באימון (רק בימי הטאב שלו)
async function syncRoutineEditToWorkout(itemId, payload) {
    const w = workoutForRoutineItem(itemId);
    if (!w || !supabaseClient || !currentUserId) return;
    const item = typeof dailyBoardItemsCache !== 'undefined' ? dailyBoardItemsCache.find(it => it.id === itemId) : null;
    const tab = item && typeof dailyBoardTabs !== 'undefined' ? dailyBoardTabs.find(tb => tb.id === item.tab_id) : null;
    const tabDays = routineTabWeekdays(tab);
    let days = routineItemDays({ days_of_week: payload.days_of_week });
    if (tabDays.length) days = days.filter(d => tabDays.includes(d));
    const updates = { time: String(payload.time || '').slice(0, 5) || w.time, days: days.length ? days : wkDays(w), updated_at: new Date().toISOString() };
    await supabaseClient.from('workout_plan').update(updates).eq('id', w.id).eq('user_id', currentUserId);
    Object.assign(w, updates);
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
}
// ✓ בשגרה על פריט שהוא אימון = ✓ באימון (נרשם בהיסטוריה), ולהפך
async function syncWorkoutFromRoutineCheck(itemId, dateStr, checked) {
    const w = workoutForRoutineItem(itemId);
    if (!w) return;
    if (!workoutWeekLoadedFor) await loadWorkoutWeek();
    if (checked !== wkIsDone(w.id, dateStr)) await toggleWorkoutDone(w.id, dateStr, { fromRoutine: true });
}
async function wkSyncRoutineCheck(w, dateStr, checked) {
    if (!w.routine_item_id || !supabaseClient) return;
    if (checked) {
        const { data } = await supabaseClient.from('routine_item_checkins').select('item_id').eq('item_id', w.routine_item_id).eq('checkin_date', dateStr).limit(1);
        if (!data || !data.length) await supabaseClient.from('routine_item_checkins').insert({ item_id: w.routine_item_id, user_id: currentUserId, checkin_date: dateStr });
    } else {
        await supabaseClient.from('routine_item_checkins').delete().eq('item_id', w.routine_item_id).eq('checkin_date', dateStr);
    }
    const board = document.getElementById('modal-daily-board');
    if (board && board.classList.contains('open') && typeof renderDailyBoard === 'function') renderDailyBoard();
}
// ולהפך: מתוך פריט בשגרה - "🏋️ להוסיף לטבלת האימונים" (או לפתוח אותו שם, אם כבר נוסף)
const WORKOUT_KIND_WORDS = [
    ['running', /run|jog|ריצ|רץ|corr|cours|lauf|jogg|бег|جري|corrida|koş|lari|chạy|bieg|วิ่ง/i],
    ['walking', /walk|הליכ|camin|marche|spazier|gehen|ходьб|прогулк|مشي|passeggi|yürü|jalan|đi bộ|spacer|เดิน/i],
    ['cycling', /bike|cycl|אופני|bici|vélo|velo|rad|велос|دراج|bisiklet|sepeda|đạp xe|rower|จักรยาน/i],
    ['swimming', /swim|שחי|nata|nage|schwimm|плав|سباح|yüz|renang|bơi|pływ|ว่ายน้ำ/i],
    ['hiit', /hiit|crossfit|קרוספיט|אינטרוו|interval|tabata|טבטה/i],
    ['functional', /functional|פונקציונ|funcional|fonction|funktion|функцион/i],
    ['strength', /gym|weight|strength|כוח|משקולות|חדר כושר|fuerza|pesas|muscu|kraft|силов|тренаж|أثقال|pesi|forza|ağırlık|kuvvet|beban|tạ|siłow|เวท/i],
    ['pilates', /pilates|פילאטיס|пилатес|بيلاتس/i],
    ['yoga', /yoga|יוגה|йога|يوغا|ioga|joga/i],
    ['dance', /danc|ריקוד|זומבה|zumba|baile|danse|tanz|танц|رقص|dança|danza|dans|tari|nhảy|taniec|เต้น/i],
];
function wkGuessKind(title) { const hit = WORKOUT_KIND_WORDS.find(([, re]) => re.test(String(title || ''))); return hit ? hit[0] : null; }
async function routineItemToWorkout() {
    if (!supabaseClient || !currentUserId || typeof editingRoutineItemId === 'undefined' || !editingRoutineItemId) return;
    if (!workoutPlanLoaded) await loadWorkoutPlan();
    const item = (typeof dailyBoardItemsCache !== 'undefined' ? dailyBoardItemsCache : []).find(it => it.id === editingRoutineItemId);
    if (!item) return;
    const linked = workoutForRoutineItem(item.id);
    if (linked) {
        closeModal('modal-add-routine-item');
        closeModal('modal-daily-board');
        if (typeof navigateFromMenu === 'function') navigateFromMenu('sport-section');
        setTimeout(() => openWorkoutEditor(linked.id), 250);
        return;
    }
    const [, name] = splitLeadingEmoji(item.title || '', '');
    const kind = wkGuessKind(item.title);
    const tab = typeof dailyBoardTabs !== 'undefined' ? dailyBoardTabs.find(tb => tb.id === item.tab_id) : null;
    const tabDays = routineTabWeekdays(tab);
    let days = routineItemDays(item);
    if (tabDays.length) days = days.filter(d => tabDays.includes(d));
    if (!days.length) days = tabDays.length ? tabDays : ROUTINE_ALL_DAYS.slice();
    const row = {
        user_id: currentUserId, kind: kind || 'custom', custom_name: kind ? null : (name.trim() || item.title).slice(0, 40), days,
        time: String(item.time || '').slice(0, 5) || null, duration_minutes: 30, intensity: null, place: null, exercises: null, notes: null,
        routine_item_id: item.id, sort_order: workoutPlan.length,
    };
    const { error } = await supabaseClient.from('workout_plan').insert(row);
    if (error) { showAppToast(t('sport_add_failed'), 'error'); return; }
    await loadWorkoutPlan();
    showAppToast(t('routine_to_workout_done'));
    renderRoutineItemWorkoutBtn();
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
    if (typeof loadTodayTasks === 'function') loadTodayTasks();
}
// הכפתור בחלון של פריט שגרה: רק בעריכה של פריט קיים; "להוסיף" או "לפתוח" לפי אם הוא כבר אימון
function renderRoutineItemWorkoutBtn() {
    const btn = document.getElementById('routine-item-to-workout');
    if (!btn) return;
    const id = typeof editingRoutineItemId !== 'undefined' ? editingRoutineItemId : null;
    btn.classList.toggle('hidden', !id);
    if (!id) return;
    const linked = workoutForRoutineItem(id);
    btn.innerHTML = `<span aria-hidden="true">🏋️</span> ${wkEsc(t(linked ? 'routine_in_workouts_btn' : 'routine_to_workout_btn'))}`;
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
    // אימון שנמצא גם בשגרה - ✓ גם שם (חוץ מכשה-✓ הגיע מהשגרה עצמה)
    if (w.routine_item_id && !opts.fromRoutine) wkSyncRoutineCheck(w, dateStr, workoutWeekDone.has(key));
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
    if (workoutPlan.length) {
        const routineIds = workoutPlan.map(w => w.routine_item_id).filter(Boolean);
        if (routineIds.length) await supabaseClient.from('routine_items').delete().in('id', routineIds).eq('user_id', currentUserId);
        await supabaseClient.from('workout_plan').delete().eq('user_id', currentUserId);
        if (routineIds.length) wkAfterRoutineChange();
    }
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
        notes: row.notes || '', inRoutine: !!row.routine_item_id,
    } : {
        id: null, kind: 'running', custom_name: '', days: new Set(dayIdx != null ? [dayIdx] : [new Date().getDay()]), time: null,
        duration: 30, intensity: null, place: null, exercises: [], notes: '', inRoutine: false,
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
        <textarea id="wk-notes" rows="2" maxlength="300" placeholder="${wkEsc(t('workout_notes_ph'))}">${wkEsc(d.notes)}</textarea>
        <label class="settings-toggle-row wk-routine-row"><span>📅 ${wkEsc(t('workout_routine_toggle'))}</span><span class="switch"><input type="checkbox" id="wk-in-routine"${d.inRoutine ? ' checked' : ''}><span class="slider"></span></span></label>`}
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
        showDangerConfirm(t('workout_delete_title'), t((workoutPlan.find(w => w.id === d.id) || {}).routine_item_id ? 'workout_delete_confirm_routine' : 'workout_delete_confirm'), () => deleteWorkout(d.id));
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
    const inRoutine = document.getElementById('wk-in-routine');
    if (inRoutine) d.inRoutine = inRoutine.checked;
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
    if (!rest && d.inRoutine && !d.time) { showAppToast(t('workout_routine_need_time'), 'error'); const tb = document.getElementById('wk-time-btn'); if (tb) tb.focus(); return; }
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
    let savedId = d.id;
    if (d.id) ({ error } = await supabaseClient.from('workout_plan').update(row).eq('id', d.id).eq('user_id', currentUserId));
    else {
        const res = await supabaseClient.from('workout_plan').insert({ ...row, sort_order: workoutPlan.length }).select().single();
        error = res.error;
        if (res.data) savedId = res.data.id;
    }
    if (error) { showAppToast(t('sport_add_failed'), 'error'); return; }
    closeModal('modal-workout-plan');
    // 📅 גם בשגרה שלי - הפריט נוצר / מתעדכן / נמחק לפי המתג
    const wantRoutine = !rest && d.inRoutine;
    const prevRoutineId = d.id ? (workoutPlan.find(w => w.id === d.id) || {}).routine_item_id || null : null;
    if (wantRoutine || prevRoutineId) await syncWorkoutToRoutine({ ...row, id: savedId, routine_item_id: prevRoutineId }, wantRoutine);
    workoutDraft = null;
    await loadWorkoutPlan();
    await loadWorkoutStreak();
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
}
async function deleteWorkout(id) {
    if (!supabaseClient || !currentUserId) return;
    const w = workoutPlan.find(x => x.id === id);
    if (w && w.routine_item_id) await supabaseClient.from('routine_items').delete().eq('id', w.routine_item_id).eq('user_id', currentUserId);
    await supabaseClient.from('workout_plan').delete().eq('id', id).eq('user_id', currentUserId);
    const tm = workoutTimer();
    if (tm && tm.id === id) saveWorkoutTimer(null);
    await loadWorkoutPlan();
    await loadWorkoutStreak();
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
    if (w && w.routine_item_id) wkAfterRoutineChange();
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
// פריט שגרה שהיה אימון נמחק מהשגרה: האימון נשאר בטבלה, רק בלי הקישור (גם ה-FK במסד מאפס אותו)
async function wkRoutineItemDeleted(itemId) {
    const w = workoutForRoutineItem(itemId);
    if (!w || !supabaseClient || !currentUserId) return;
    w.routine_item_id = null;
    await supabaseClient.from('workout_plan').update({ routine_item_id: null }).eq('id', w.id).eq('user_id', currentUserId);
    renderWorkoutPlan();
    renderMyDayWorkoutChip();
}
