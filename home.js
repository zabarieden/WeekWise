// --- מסך הבית החדש (לפי בחירה מפורשת מבין 6 כיוונים: "ה – שקט, הכול למטה") ---
// מסך בית שקט: ברכה גדולה באמצע, פתק מהיר, העוזר והפינה שגדלה – וכל היום במגירה אחת למטה,
// "היום שלי" (#myday-bar), שנפתחת לציר זמן אחד (#today-peek-content-panel) – הצצה להיום והשגרה
// שלי ביחד ("ב – ציר זמן אחד", לפי בחירה מפורשת). בנוסף הרעיונות הקטנים שנבחרו: חיפוש בכל
// האפליקציה, מצב פוקוס, כוס מים בלחיצה, New Me במגירה (נעול למי שלא רכש/ה), לחיצה על העציץ
// ("מה כבר עשיתי היום"), לחיצה ארוכה על "פתק מהיר" (הקלטה / רשימת קניות), כוכב הפרימיום פעם
// בשבוע ופתק שבועי ריק שמתקפל לסיכה. לא נבחרו (לא לבנות): "מה עכשיו?", יעד החודש בבית, הספר
// שבקריאה, "+" אחד לכל דבר, החלקה למעלה מכל מקום במסך, ו"איך הבוקר?"

let myDayFilter = 'all';            // all | tasks | routine | calendar
let myDayItems = [];                // כל הפריטים של הרינדור האחרון (למגירה, לפוקוס ולעציץ)
let myDayFocusItems = null;        // בועות "מה חשוב לך היום" של הרינדור האחרון (נשארות גם כשמחליפים סינון)
let myDayWaterState = { glasses: 0, goal: 8 };

function myDayEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function myDayNowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }

// --- השגרה של היום: הטאב שמשויך ליום הזה (ימים לטאב), ואם אין – הטאב הראשון שלא משויך לימים
// מסוימים (שגרה של כל יום). רק השעות שמוצגות בטאב (פריט בשעה שהוסרה מהטאב לא מוצג גם שם) ---
async function loadMyDayRoutine(todayStr) {
    const empty = { items: [], doneIds: new Set(), checksOn: false, tab: null };
    if (!supabaseClient || !currentUserId) return empty;
    try {
        let tabs = typeof dailyBoardTabs !== 'undefined' && dailyBoardTabs.length ? dailyBoardTabs : null;
        if (!tabs) {
            const { data } = await supabaseClient.from('routine_tabs').select('*').eq('user_id', currentUserId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
            tabs = data || [];
        }
        const todayIdx = new Date().getDay();
        const tab = tabs.find(tb => routineTabWeekdays(tb).includes(todayIdx)) || tabs.find(tb => !routineTabWeekdays(tb).length) || null;
        if (!tab) return empty;
        const { data: rows } = await supabaseClient.from('routine_items').select('*').eq('tab_id', tab.id).eq('user_id', currentUserId).eq('kind', 'scheduled');
        const hours = new Set(Object.values(myDayTabHours(tab)).flat());
        // ארוחות שהוסתרו כי הן כבר בתפריט של New Me - לא מופיעות פעמיים
        const items = (rows || []).filter(it => (it.title || '').trim() && hours.has(Number(String(it.time || '').slice(0, 2))) && !(typeof routineItemInNewMe === 'function' && routineItemInNewMe(it)));
        const checksOn = isRoutineGoalsOn();
        let doneIds = new Set();
        if (checksOn && items.length) {
            const { data: checks } = await supabaseClient.from('routine_item_checkins').select('item_id').in('item_id', items.map(it => it.id)).eq('checkin_date', todayStr);
            doneIds = new Set((checks || []).map(c => c.item_id));
        }
        return { items, doneIds, checksOn, tab };
    } catch (e) {
        console.error('my day routine failed', e);
        return empty;
    }
}
// אותו חישוב כמו getDailyBoardCustomHours, על אובייקט הטאב עצמו (הטאבים לא תמיד טעונים כאן)
function myDayTabHours(tab) {
    const saved = tab && tab.custom_hours && typeof tab.custom_hours === 'object' ? tab.custom_hours : null;
    const out = {};
    Object.keys(DAILY_BOARD_DEFAULT_HOURS).forEach(key => {
        out[key] = saved && Array.isArray(saved[key]) ? saved[key] : [...DAILY_BOARD_DEFAULT_HOURS[key]];
    });
    return out;
}

// ✓ על פריט שגרה מתוך "היום שלי" – אותו סימון בדיוק כמו ב"השגרה שלי" (routine_item_checkins), כולל
// הסנכרון ליעד המקושר (צעד / הצעד הקטן היומי)
async function myDayToggleRoutine(item, checked) {
    const todayStr = getLocalDateString();
    let error = null;
    if (checked) {
        const { data: existing } = await supabaseClient.from('routine_item_checkins').select('item_id').eq('item_id', item.id).eq('checkin_date', todayStr).limit(1);
        if (!existing || !existing.length) ({ error } = await supabaseClient.from('routine_item_checkins').insert({ item_id: item.id, user_id: currentUserId, checkin_date: todayStr }));
    } else {
        ({ error } = await supabaseClient.from('routine_item_checkins').delete().eq('item_id', item.id).eq('checkin_date', todayStr));
    }
    if (error) { console.error('routine checkin failed', error); showAppToast(t('error_not_connected'), 'error'); loadTodayTasks(); return; }
    if (item.vision_milestone_id) await syncGoalFromRoutineCheck(item.vision_milestone_id, todayStr, checked);
    if (item.vision_goal_id) await syncGoalSmallStepFromRoutine(item.vision_goal_id, todayStr, checked);
    if (checked && typeof routineNudge !== 'undefined' && routineNudge && routineNudge.itemIds.includes(item.id)) { routineNudge = null; renderRoutineNudge(); }
    const board = document.getElementById('modal-daily-board');
    if (board && board.classList.contains('open')) renderDailyBoard();
    loadTodayTasks();
}

// --- ציר הזמן ---
// כל פריט: { kind: 'task'|'calendar'|'routine'|'newme', group: 'tasks'|'routine'|'calendar'|null,
// minutes (או null = בלי שעה), done, checkable, title, toggle(checked), build() → שורה }.
// השורות נשארות .today-tasks-row עם צ'קבוקס אמיתי (ו-.today-tasks-time / .today-tasks-text /
// .today-goal-task-row כמו קודם) – רק המראה הוא ציר זמן
// אייקון רק כשהוא אומר משהו (עבודה 💼, אימון 🏋️‍♀️...) - בלי ה-⚡ הכללי, שהציר יישאר שקט
function myDayIcon(title) {
    const icon = getScheduleTaskIcon(title);
    return icon && icon !== '⚡' ? `${icon} ` : '';
}
function buildMyDayItems({ todayStr, schedule, completedScheduleIds, events, goalItems, routine, newMeItems }) {
    const items = [];
    schedule.forEach(row => {
        const done = completedScheduleIds.has(row.id);
        items.push({
            // הלו"ז הקבוע של השבוע נחשב "משימות" (לא "פגישות ואירועים") - כך הוא נקרא ונתפס
            kind: 'task', group: 'tasks', minutes: scheduleTimeToMinutes(row.time_of_day), done, checkable: true,
            title: row.task_title, toggle: checked => toggleScheduleCompletion(row.id, todayStr, checked),
            build: () => myDayRow({
                done, time: row.time_of_day || '', text: `${myDayIcon(row.task_title)}${row.task_title}`,
                tag: t('myday_tag_fixed'), onchange: checked => toggleScheduleCompletion(row.id, todayStr, checked),
            }),
        });
    });
    events.forEach(ev => {
        const kind = calendarKindOf(ev);
        const isMeeting = kind === 'meeting';
        // בעמודת השעה - שעת ההתחלה; טווח הפגישה (10:00–11:00) בשורה הקטנה מתחת לשם
        const range = isMeeting && ev.end_time && ev.end_time > ev.event_time ? meetingTimeRange(ev) : '';
        items.push({
            kind: kind === 'task' ? 'task' : 'calendar', group: kind === 'task' ? 'tasks' : 'calendar',
            minutes: scheduleTimeToMinutes(ev.event_time), done: !!ev.is_completed, checkable: true,
            title: ev.event_title, toggle: checked => toggleEventOccurrenceCompletion(ev.id, checked),
            build: () => myDayRow({
                done: !!ev.is_completed, time: String(ev.event_time || '').slice(0, 5),
                text: `${calendarKindIcon(ev) ? calendarKindIcon(ev) + ' ' : ''}${ev.event_title}`,
                withName: isMeeting && ev.meeting_with ? ev.meeting_with : '',
                tag: range,
                onchange: checked => toggleEventOccurrenceCompletion(ev.id, checked),
                onopen: () => openEditCalendarEvent(ev),
            }),
        });
    });
    goalItems.forEach(gi => {
        items.push({
            kind: 'task', group: 'tasks', minutes: null, done: !!gi.done, checkable: true, title: gi.text, toggle: checked => gi.toggle(checked),
            build: () => {
                // אותה שורה של הצצה להיום (✓ / תגית היעד / ⓘ), מסודרת מחדש לעמודות של הציר:
                // [שעה] [נקודה] [טקסט + תגית] [ⓘ] [✓]
                const row = buildPeekGoalTaskRow(gi);
                row.classList.add('myday-row', 'myday-kind-task');
                if (gi.done) row.classList.add('is-done');
                const cb = row.querySelector('input.day-detail-checkbox');
                const info = row.querySelector('.today-goal-task-info');
                const main = document.createElement('span');
                main.className = 'myday-main';
                row.querySelectorAll('.today-tasks-text, .today-goal-task-tag').forEach(el => main.appendChild(el));
                const time = document.createElement('span');
                time.className = 'myday-time';
                const dot = document.createElement('span');
                dot.className = 'myday-dot';
                dot.setAttribute('aria-hidden', 'true');
                row.replaceChildren(time, dot, main, ...(info ? [info] : []), cb);
                if (info) row.classList.add('has-info');
                return row;
            },
        });
    });
    (routine.items || []).forEach(it => {
        const done = routine.doneIds.has(it.id);
        const time = String(it.time || '').slice(0, 5);
        items.push({
            kind: 'routine', group: 'routine', minutes: scheduleTimeToMinutes(time), done: routine.checksOn ? done : false, checkable: routine.checksOn,
            title: it.title, toggle: checked => myDayToggleRoutine(it, checked),
            build: () => myDayRow({
                done: routine.checksOn && done, time, text: `${myDayIcon(it.title)}${it.title}`, tag: t('myday_filter_routine'),
                kindClass: 'routine', onchange: routine.checksOn ? checked => myDayToggleRoutine(it, checked) : null,
            }),
        });
    });
    (newMeItems || []).forEach(nm => {
        items.push({
            kind: 'newme', group: null, minutes: scheduleTimeToMinutes(nm.time), done: !!nm.done, checkable: true, title: nm.text, toggle: checked => nm.toggle(checked),
            build: () => myDayRow({ done: !!nm.done, time: nm.time, text: nm.text, tag: 'New Me', kindClass: 'newme', onchange: checked => nm.toggle(checked) }),
        });
    });
    return items;
}

// שורה אחת בציר: [שעה] [נקודה] [טקסט + תגית] [✓]
function myDayRow({ done, time, text, withName, tag, kindClass, onchange, onopen }) {
    const row = document.createElement('div');
    row.className = `today-tasks-row myday-row myday-kind-${kindClass || 'task'}${done ? ' is-done' : ''}`;
    const timeEl = document.createElement('span');
    timeEl.className = 'today-tasks-time myday-time';
    timeEl.textContent = time || '';
    const dot = document.createElement('span');
    dot.className = 'myday-dot';
    dot.setAttribute('aria-hidden', 'true');
    const main = document.createElement(onopen ? 'button' : 'span');
    main.className = 'myday-main';
    if (onopen) { main.type = 'button'; main.onclick = onopen; }
    const textEl = document.createElement('span');
    textEl.className = 'today-tasks-text' + (done ? ' completed' : '');
    textEl.textContent = text;
    if (withName) {
        const w = document.createElement('span');
        w.className = 'today-tasks-with';
        w.textContent = `👤 ${withName}`;
        textEl.appendChild(w);
    }
    main.appendChild(textEl);
    if (tag) {
        const tagEl = document.createElement('span');
        tagEl.className = 'myday-tag';
        tagEl.textContent = tag;
        main.appendChild(tagEl);
    }
    row.appendChild(timeEl);
    row.appendChild(dot);
    row.appendChild(main);
    if (onchange) {
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'day-detail-checkbox myday-check';
        cb.checked = !!done;
        cb.setAttribute('aria-label', t('myday_check_aria'));
        cb.onchange = () => onchange(cb.checked);
        row.appendChild(cb);
    }
    return row;
}

// מה "עכשיו": הפריט עם שעה שעוד לא בוצע ושהשעה שלו כבר הגיעה (עד שעתיים אחורה), אחרת הבא בתור,
// אחרת משימה פתוחה בלי שעה
function myDayPickNow(items) {
    const now = myDayNowMinutes();
    const open = items.filter(it => !it.done && it.checkable);
    const timed = open.filter(it => it.minutes !== null).sort((a, b) => a.minutes - b.minutes);
    const current = timed.filter(it => it.minutes <= now && now - it.minutes <= 120).pop();
    if (current) return { item: current, label: 'now' };
    const next = timed.find(it => it.minutes > now);
    if (next) return { item: next, label: 'next' };
    const untimed = open.find(it => it.minutes === null);
    if (untimed) return { item: untimed, label: 'later' };
    return null;
}

function myDayFormatMinutes(m) {
    if (m === null || m === undefined) return '';
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// מצייר את ציר הזמן ל-#today-tasks-list (המגירה הפתוחה) לפי הסינון שנבחר
function renderMyDayTimeline(container, items, focusItems) {
    container.innerHTML = '';
    if (focusItems && focusItems.length) container.appendChild(buildDailyFocusBanner(focusItems));
    if (!items.length) {
        container.insertAdjacentHTML('beforeend', `<p class="today-tasks-empty">${myDayEsc(t('today_tasks_empty_hint'))}</p>`);
        return;
    }
    const shown = items.filter(it => myDayFilter === 'all' || it.group === myDayFilter);
    if (!shown.length) {
        container.insertAdjacentHTML('beforeend', `<p class="today-tasks-empty">${myDayEsc(t('myday_filter_empty'))}</p>`);
        return;
    }
    const untimed = shown.filter(it => it.minutes === null);
    const timed = shown.filter(it => it.minutes !== null).sort((a, b) => a.minutes - b.minutes);
    if (untimed.length) {
        const box = document.createElement('div');
        box.className = 'myday-untimed';
        const head = document.createElement('span');
        head.className = 'myday-untimed-head';
        head.textContent = t('myday_no_time');
        box.appendChild(head);
        untimed.forEach(it => box.appendChild(it.build()));
        container.appendChild(box);
    }
    if (timed.length) {
        const line = document.createElement('div');
        line.className = 'myday-line';
        const now = myDayNowMinutes();
        let nowPlaced = false;
        timed.forEach(it => {
            if (!nowPlaced && it.minutes > now) {
                line.appendChild(myDayNowMarker(now));
                nowPlaced = true;
            }
            const row = it.build();
            if (it.minutes <= now && it.done) row.classList.add('is-past');
            line.appendChild(row);
        });
        if (!nowPlaced) line.appendChild(myDayNowMarker(now));
        container.appendChild(line);
    }
}
function myDayNowMarker(now) {
    const el = document.createElement('div');
    el.className = 'myday-now';
    el.innerHTML = `<span class="myday-now-time">${myDayEsc(myDayFormatMinutes(now))}</span><span class="myday-now-dot" aria-hidden="true"></span><span class="myday-now-rule" aria-hidden="true"></span><span class="myday-now-label">${myDayEsc(t('myday_now'))}</span>`;
    return el;
}

// סינון שאין בו כלום היום לא מוצג (במקום מסך "אין כאן כלום"); אם הוא היה הבחירה - חוזרים ל"הכול".
// כשיש רק סוג אחד של דברים היום, כל שורת הסינון מוסתרת
function syncMyDayFilterChips(items) {
    const groups = new Set(items.map(it => it.group).filter(Boolean));
    let current = myDayFilter;
    document.querySelectorAll('#myday-filters .myday-filter').forEach(btn => {
        const f = btn.dataset.filter;
        const empty = f !== 'all' && !groups.has(f);
        btn.classList.toggle('hidden', empty);
        if (empty && f === current) current = 'all';
    });
    if (current !== myDayFilter) {
        myDayFilter = current;
        document.querySelectorAll('#myday-filters .myday-filter').forEach(btn => btn.setAttribute('aria-pressed', btn.dataset.filter === myDayFilter ? 'true' : 'false'));
    }
    const row = document.getElementById('myday-filters');
    if (row) row.classList.toggle('hidden', groups.size < 2);
}

function setMyDayFilter(filter) {
    myDayFilter = ['all', 'tasks', 'routine', 'calendar'].includes(filter) ? filter : 'all';
    document.querySelectorAll('#myday-filters .myday-filter').forEach(btn => btn.setAttribute('aria-pressed', btn.dataset.filter === myDayFilter ? 'true' : 'false'));
    const container = document.getElementById('today-tasks-list');
    if (container) renderMyDayTimeline(container, myDayItems, myDayFocusItems);
}

// --- המגירה הסגורה בתחתית הבית: כמה בוצע, מה עכשיו (עם ✓), מים ו-New Me ---
function renderMyDayBar(items) {
    const countEl = document.getElementById('myday-bar-count');
    const total = items.filter(it => it.checkable).length;
    const done = items.filter(it => it.checkable && it.done).length;
    if (countEl) countEl.textContent = total ? t('myday_count').replace('{done}', done).replace('{total}', total) : '';
    const nextEl = document.getElementById('myday-bar-next');
    if (!nextEl) return;
    const pick = myDayPickNow(items);
    if (!pick) {
        nextEl.innerHTML = `<span class="myday-bar-empty">${myDayEsc(total ? t('today_tasks_all_done_message') : t('myday_bar_empty'))}</span>`;
        return;
    }
    const label = t(pick.label === 'now' ? 'myday_now' : pick.label === 'next' ? 'myday_next' : 'myday_later');
    nextEl.innerHTML = `
        <span class="myday-bar-when"><span class="myday-bar-when-label">${myDayEsc(label)}</span><span class="myday-bar-when-time">${myDayEsc(myDayFormatMinutes(pick.item.minutes))}</span></span>
        <span class="myday-bar-what">${myDayEsc(pick.item.title)}</span>
        <button type="button" class="myday-bar-check" aria-label="${myDayEsc(t('myday_check_aria'))}"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>`;
    nextEl.querySelector('.myday-bar-check').onclick = e => {
        e.stopPropagation();
        e.currentTarget.disabled = true;
        pick.item.toggle(true);
    };
}

// נקרא מ-loadTodayTasks בכל רענון: מצייר את הציר, המגירה, והפוקוס (אם פתוח)
function renderMyDay(container, items, focusItems) {
    myDayItems = items;
    myDayFocusItems = focusItems;
    syncMyDayFilterChips(items);
    renderMyDayTimeline(container, items, focusItems);
    renderMyDayBar(items);
    if (document.body.classList.contains('home-focus-on')) renderHomeFocus();
    // הרצף כולל את היום ברגע שיש ✓ ראשון
    if (typeof renderHomeChips === 'function') renderHomeChips();
}

function openMyDayAddTask() {
    resetCalendarEventModal();
    setCalendarEventKind('task');
    document.getElementById('calendar-event-date-input').value = getLocalDateString();
    updateDateFieldDisplay('calendar-event-date-input');
    openModal('modal-add-calendar-event');
}
function openMyDayRoutineEditor() {
    closeTodayPeekPanel();
    openDailyBoardModal();
}

// החלקה למטה על הידית/הכותרת של המגירה הפתוחה סוגרת אותה, ולמעלה על המגירה הסגורה פותחת
// (רק על המגירה עצמה – לא "החלקה למעלה מכל מקום במסך", שלא נבחרה)
function initMyDaySwipes() {
    const bar = document.getElementById('myday-bar');
    const sheetHead = document.querySelector('#today-peek-content-panel .today-peek-content-header');
    const watch = (el, onSwipe) => {
        if (!el) return;
        let startY = null;
        el.addEventListener('touchstart', e => { startY = e.touches[0].clientY; }, { passive: true });
        el.addEventListener('touchend', e => {
            if (startY === null) return;
            const dy = e.changedTouches[0].clientY - startY;
            startY = null;
            onSwipe(dy);
        });
    };
    watch(bar, dy => { if (dy < -40) openTodayPeekPanel(); });
    watch(sheetHead, dy => { if (dy > 50) closeTodayPeekPanel(); });
}

// --- 💧 כוס מים בלחיצה (250 מ"ל), מתוך היעד היומי של מעקב המים ---
const MY_DAY_GLASS_ML = 250;
async function loadMyDayWater() {
    const tile = document.getElementById('myday-water-tile');
    if (!tile || !supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('water_logs').select('amount_ml').eq('user_id', currentUserId).eq('log_date', getLocalDateString());
    const totalMl = (data || []).reduce((sum, r) => sum + (Number(r.amount_ml) || 0), 0);
    myDayWaterState = { glasses: Math.round(totalMl / MY_DAY_GLASS_ML), goal: Math.max(1, Math.round(getWaterDailyGoal() / MY_DAY_GLASS_ML)) };
    const value = document.getElementById('myday-water-value');
    if (value) value.textContent = `${myDayWaterState.glasses}/${myDayWaterState.goal}`;
}
// ⓘ קטן ליד "מים": כמה זה 8 כוסות (לפי בקשה מפורשת - "משהו שפותחים")
function toggleMyDayWaterInfo(e) {
    if (e) e.stopPropagation();
    const tip = document.getElementById('myday-water-tip');
    if (!tip) return;
    const show = tip.classList.contains('hidden');
    tip.classList.toggle('hidden', !show);
    const btn = document.querySelector('.myday-water-info');
    if (btn) btn.setAttribute('aria-expanded', String(show));
}
async function addMyDayWaterGlass(btn) {
    if (btn) btn.disabled = true;
    try { await addWaterLog(MY_DAY_GLASS_ML); } finally { if (btn) btn.disabled = false; }
    await loadMyDayWater();
}

// --- ◎ מצב פוקוס: מסתיר הכול חוץ מהדבר האחד של עכשיו (ופתק מהיר) ---
function isHomeFocusOn() { return document.body.classList.contains('home-focus-on'); }
function toggleHomeFocus(force) {
    const on = typeof force === 'boolean' ? force : !isHomeFocusOn();
    document.body.classList.toggle('home-focus-on', on);
    try { sessionStorage.setItem('weekwise_home_focus', on ? '1' : '0'); } catch {}
    const layer = document.getElementById('home-focus-layer');
    if (layer) layer.classList.toggle('hidden', !on);
    if (on) renderHomeFocus();
}
function renderHomeFocus() {
    const body = document.getElementById('home-focus-body');
    if (!body) return;
    const pick = myDayPickNow(myDayItems);
    if (!pick) {
        body.innerHTML = `<p class="home-focus-empty">${myDayEsc(t('home_focus_empty'))}</p>`;
        return;
    }
    const label = t(pick.label === 'now' ? 'myday_now' : pick.label === 'next' ? 'myday_next' : 'myday_later');
    const time = myDayFormatMinutes(pick.item.minutes);
    const rest = myDayItems.filter(it => it !== pick.item && !it.done && it.checkable && it.minutes !== null && (pick.item.minutes === null || it.minutes > pick.item.minutes)).sort((a, b) => a.minutes - b.minutes)[0];
    body.innerHTML = `
        <span class="home-focus-when">${myDayEsc(label)}${time ? ` · ${myDayEsc(time)}` : ''}</span>
        <span class="home-focus-title">${myDayEsc(pick.item.title)}</span>
        <button type="button" class="home-focus-done" aria-label="${myDayEsc(t('home_focus_done_aria'))}"><svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        ${rest ? `<span class="home-focus-then">${myDayEsc(t('home_focus_then').replace('{item}', `${myDayFormatMinutes(rest.minutes)} ${rest.title}`))}</span>` : ''}`;
    body.querySelector('.home-focus-done').onclick = e => {
        e.currentTarget.disabled = true;
        pick.item.toggle(true);
    };
}

// --- 🔍 חיפוש בכל האפליקציה: פתקים, רשימת קניות, יומן, מתכונים, מחברות, יעדים, טבלאות וספרים ---
let homeSearchTimer = 0;
let homeSearchSeq = 0;
function openHomeSearch() {
    const layer = document.getElementById('home-search-layer');
    if (!layer) return;
    layer.classList.remove('hidden');
    const input = document.getElementById('home-search-input');
    if (input) { input.value = ''; setTimeout(() => input.focus(), 30); }
    renderHomeSearchResults(null, '');
}
function closeHomeSearch() {
    const layer = document.getElementById('home-search-layer');
    if (layer) layer.classList.add('hidden');
}
function onHomeSearchInput(value) {
    clearTimeout(homeSearchTimer);
    homeSearchTimer = setTimeout(() => runHomeSearch(value), 250);
}
// ilike בטוח: בלי % ו-_ שהמשתמש/ת הקלידו (שלא יהפכו לתווים כלליים)
function homeSearchPattern(q) { return `%${q.replace(/[%_\\]/g, ' ')}%`; }
async function runHomeSearch(raw) {
    const q = String(raw || '').trim();
    const seq = ++homeSearchSeq;
    if (q.length < 2 || !supabaseClient || !currentUserId) { renderHomeSearchResults(null, q); return; }
    const pat = homeSearchPattern(q);
    const safe = p => p.then(r => r.data || []).catch(() => []);
    const uid = currentUserId;
    const [notes, events, recipes, notebooks, pages, goals, tables, books] = await Promise.all([
        safe(supabaseClient.from('my_center_tasks').select('id, content, task_type').eq('user_id', uid).eq('is_deleted', false).ilike('content', pat).limit(8)),
        safe(supabaseClient.from('calendar_events').select('id, event_title, event_date, source').eq('user_id', uid).ilike('event_title', pat).order('event_date', { ascending: false }).limit(8)),
        safe(supabaseClient.from('recipes').select('id, title').eq('user_id', uid).ilike('title', pat).limit(6)),
        safe(supabaseClient.from('project_notebooks').select('id, title').eq('user_id', uid).ilike('title', pat).limit(6)),
        safe(supabaseClient.from('notebook_pages').select('id, notebook_id, title, text_content').eq('user_id', uid).ilike('text_content', pat).limit(6)),
        safe(supabaseClient.from('vision_goals').select('id, title').eq('user_id', uid).ilike('title', pat).limit(6)),
        safe(supabaseClient.from('custom_tables').select('id, name').eq('user_id', uid).ilike('name', pat).limit(6)),
        safe(supabaseClient.from('books').select('id, title').eq('user_id', uid).ilike('title', pat).limit(6)),
    ]);
    if (seq !== homeSearchSeq) return;
    const hiddenSources = new Set(['today_celebrated', 'daily_focus_dismissed', 'daily_focus']);
    const groups = [
        { key: 'notes', items: notes.filter(n => n.task_type !== 'general').map(n => ({ text: n.content, open: () => navigateFromMenu('my-center-section', 'notes') })) },
        { key: 'shopping', items: notes.filter(n => n.task_type === 'general').map(n => ({ text: n.content, open: () => navigateFromMenu('my-center-section', 'shopping') })) },
        { key: 'calendar', items: events.filter(e => !hiddenSources.has(e.source)).map(e => ({ text: e.event_title, sub: formatEventDateBadge(e.event_date), open: () => { switchToTab('schedule-section'); selectCalendarDay(e.event_date); } })) },
        { key: 'recipes', items: recipes.map(r => ({ text: r.title, open: () => navigateFromMenu('nutrition-section', 'recipes') })) },
        { key: 'notebooks', items: notebooks.map(n => ({ text: n.title, open: () => homeSearchOpenNotebook(n.id) })).concat(pages.map(p => ({ text: homeSearchSnippet(p.text_content, q) || p.title, open: () => homeSearchOpenNotebook(p.notebook_id) }))) },
        { key: 'goals', items: goals.map(g => ({ text: g.title, open: () => openGoalsVisionDrawer(g.id) })) },
        { key: 'tables', items: tables.map(tb => ({ text: tb.name, open: () => { openNotebooksSection(); openTableView(tb.id); } })) },
        { key: 'books', items: books.map(b => ({ text: b.title, open: () => openBooksSection() })) },
    ].filter(g => g.items.length);
    renderHomeSearchResults(groups, q);
}
function homeSearchSnippet(text, q) {
    const s = String(text || '').replace(/\s+/g, ' ').trim();
    const i = s.toLowerCase().indexOf(q.toLowerCase());
    if (i < 0) return s.slice(0, 60);
    const start = Math.max(0, i - 20);
    return (start ? '…' : '') + s.slice(start, i + q.length + 30) + (i + q.length + 30 < s.length ? '…' : '');
}
function homeSearchOpenNotebook(id) {
    openNotebooksSection();
    if (typeof allNotebooksCache !== 'undefined' && allNotebooksCache.some(n => n.id === id)) openNotebookView(id);
}
function renderHomeSearchResults(groups, q) {
    const box = document.getElementById('home-search-results');
    if (!box) return;
    box.innerHTML = '';
    if (groups === null) {
        box.innerHTML = `<p class="home-search-hint">${myDayEsc(t('home_search_hint'))}</p>`;
        return;
    }
    if (!groups.length) {
        box.innerHTML = `<p class="home-search-hint">${myDayEsc(t('home_search_empty').replace('{q}', q))}</p>`;
        return;
    }
    groups.forEach(g => {
        const head = document.createElement('span');
        head.className = 'home-search-group';
        head.textContent = t('home_search_g_' + g.key);
        box.appendChild(head);
        g.items.forEach(it => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'home-search-item';
            btn.innerHTML = `<span class="home-search-item-text">${myDayEsc(it.text)}</span>${it.sub ? `<span class="home-search-item-sub">${myDayEsc(it.sub)}</span>` : ''}`;
            btn.onclick = () => { closeHomeSearch(); it.open(); };
            box.appendChild(btn);
        });
    });
}

// --- 🌼 לחיצה על העציץ: "מה כבר עשיתי היום" ---
function toggleHomeDonePopover(force) {
    const pop = document.getElementById('home-done-popover');
    if (!pop) return;
    const show = typeof force === 'boolean' ? force : pop.classList.contains('hidden');
    pop.classList.toggle('hidden', !show);
    syncHomePopoverClass();
    if (!show) return;
    const done = myDayItems.filter(it => it.checkable && it.done);
    const flowers = homeGrowShown ? homeGrowShown.flowers : 0;
    pop.innerHTML = `
        <span class="home-done-title">${myDayEsc(t('home_done_title'))}</span>
        ${done.length ? `<ul class="home-done-list">${done.map(it => `<li>${myDayEsc(it.title)}</li>`).join('')}</ul>` : `<p class="home-done-empty">${myDayEsc(t('home_done_empty'))}</p>`}
        <span class="home-done-foot">${myDayEsc(t('home_done_water').replace('{n}', myDayWaterState.glasses).replace('{goal}', myDayWaterState.goal))} · ${myDayEsc(t('home_done_flowers').replace('{n}', flowers))}</span>`;
}

// --- לחיצה ארוכה על "פתק מהיר": הקלטה (הכתבה לפתק) / ישר לרשימת הקניות / פתק רגיל ---
const HOME_SPEECH_LANGS = { he: 'he-IL', en: 'en-US', es: 'es-ES', fr: 'fr-FR', ar: 'ar-SA', ru: 'ru-RU', de: 'de-DE', pt: 'pt-BR', ja: 'ja-JP', zh: 'zh-CN', hi: 'hi-IN', ko: 'ko-KR', tr: 'tr-TR', id: 'id-ID', it: 'it-IT', vi: 'vi-VN', pl: 'pl-PL', th: 'th-TH', ur: 'ur-PK', bn: 'bn-BD', sw: 'sw-KE', uk: 'uk-UA', el: 'el-GR', nl: 'nl-NL', ca: 'ca-ES', ro: 'ro-RO', yo: 'yo-NG', sv: 'sv-SE', nb: 'nb-NO', da: 'da-DK', cs: 'cs-CZ', hu: 'hu-HU', fi: 'fi-FI' };
function homeSpeechSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
// לחיצה ארוכה (חצי שנייה) על כפתור. הקליק שבא אחריה לא מפעיל את הלחיצה הרגילה (מה שנפתח
// בלחיצה הארוכה כבר פתוח) - משמש לפתק המהיר ולפתק השבועי
function homeAttachLongPress(el, onLong) {
    if (!el || el.dataset.longPress) return;
    el.dataset.longPress = '1';
    let timer = 0;
    let fired = false;
    el.addEventListener('pointerdown', () => {
        fired = false;
        clearTimeout(timer);
        timer = setTimeout(() => { fired = true; onLong(); }, 520);
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, () => clearTimeout(timer)));
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('click', e => {
        if (fired) { e.stopImmediatePropagation(); e.preventDefault(); fired = false; }
    }, true);
}
function initQuickNoteLongPress() {
    homeAttachLongPress(document.getElementById('btn-ai-fab'), openQuickNoteMenu);
}
function openQuickNoteMenu() {
    const menu = document.getElementById('quick-note-menu');
    if (!menu) return;
    const voice = menu.querySelector('[data-action="voice"]');
    if (voice) voice.classList.toggle('hidden', !homeSpeechSupported());
    menu.classList.remove('hidden');
    syncHomePopoverClass();
    if (navigator.vibrate) { try { navigator.vibrate(12); } catch {} }
}
function closeQuickNoteMenu() {
    const menu = document.getElementById('quick-note-menu');
    if (menu) menu.classList.add('hidden');
    syncHomePopoverClass();
}
function quickNoteMenuAction(action) {
    closeQuickNoteMenu();
    setQuickNoteDestination(action === 'shopping' ? 'general' : 'weekly');
    openModal('modal-ai-quick-add');
    if (action === 'voice') setTimeout(startQuickNoteDictation, 120);
}
function startQuickNoteDictation() {
    const input = document.getElementById('ai-quick-add-input');
    startDictation(input, document.querySelector('.dictate-btn[data-dictate="ai-quick-add-input"]'));
}

// --- הכתבה: מדברים והמילים נכתבות תוך כדי (Chrome / אנדרואיד / ספארי באייפון) ---
// לפי בקשה מפורשת ("שיהיה ממש אפשר לדבר וזה יכתוב במילים"): כפתור מיקרופון גלוי בפינת הפתק המהיר,
// בעמוד כתיבה במחברת ובפתק השבועי. לחיצה מתחילה, לחיצה נוספת עוצרת; הטקסט נכנס במקום הסמן,
// בשפת האפליקציה. באנדרואיד - משפט אחד בכל לחיצה (ההקשבה הרציפה שם משכפלת מילים)
let dictationSession = null;
function initDictationButtons() {
    document.querySelectorAll('.dictate-btn').forEach(b => b.classList.toggle('hidden', !homeSpeechSupported()));
}
// עוצרים הקשבה פתוחה (סגירת חלון, מעבר עמוד במחברת) - שלא תמשיך לכתוב לשדה שכבר לא מול העיניים
function stopDictation() {
    const s = dictationSession;
    if (!s) return;
    try { s.rec.abort(); } catch {}
    s.finish();
}
function toggleDictation(targetId, btn) {
    if (dictationSession && dictationSession.input.id === targetId) { try { dictationSession.rec.stop(); } catch {} return; }
    startDictation(document.getElementById(targetId), btn);
}
function startDictation(input, btn) {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec || !input) { showAppToast(t('quick_note_voice_failed'), 'error'); return; }
    stopDictation();
    const rec = new Rec();
    rec.lang = HOME_SPEECH_LANGS[currentLang] || currentLang;
    rec.interimResults = true;
    rec.continuous = !/Android/i.test(navigator.userAgent);
    rec.maxAlternatives = 1;
    const max = input.maxLength > 0 ? input.maxLength : Infinity;
    const start = typeof input.selectionStart === 'number' ? input.selectionStart : input.value.length;
    const end = typeof input.selectionEnd === 'number' ? input.selectionEnd : start;
    const before = input.value.slice(0, start), after = input.value.slice(end);
    const sep = before && !/\s$/.test(before) ? ' ' : '';
    let finalText = '';
    let heard = false;
    const render = interim => {
        const spoken = [finalText, interim].map(s => s.trim()).filter(Boolean).join(' ');
        if (!spoken) return;
        heard = true;
        const head = (before + sep + spoken).slice(0, max);
        input.value = (head + (after && !/^\s/.test(after) ? ' ' : '') + after).slice(0, max);
        try { input.setSelectionRange(head.length, head.length); } catch {}
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    const placeholder = input.placeholder;
    input.placeholder = t('quick_note_listening');
    input.classList.add('is-listening');
    if (btn) { btn.classList.add('listening'); btn.setAttribute('aria-pressed', 'true'); }
    const session = { rec, input, btn, finish: () => {} };
    session.finish = () => {
        if (dictationSession !== session) return;
        dictationSession = null;
        input.placeholder = placeholder;
        input.classList.remove('is-listening');
        if (btn) { btn.classList.remove('listening'); btn.setAttribute('aria-pressed', 'false'); }
        if (heard) { render(''); input.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    dictationSession = session;
    rec.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex || 0; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText = [finalText, r[0].transcript].map(s => s.trim()).filter(Boolean).join(' ');
            else interim += r[0].transcript;
        }
        render(interim);
    };
    rec.onerror = ev => {
        const code = ev && ev.error;
        session.finish();
        // aborted = עצירה שלנו (סגירת חלון / מעבר דף); "לא נשמע כלום" כן מקבל הודעה, כדי שיהיה ברור מה קרה
        if (code === 'aborted') return;
        showAppToast(t(code === 'not-allowed' || code === 'service-not-allowed' ? 'dictation_mic_denied' : 'quick_note_voice_failed'), 'error');
    };
    rec.onend = () => session.finish();
    try { rec.start(); } catch { session.finish(); showAppToast(t('quick_note_voice_failed'), 'error'); }
}

// --- ⭐ כוכב הפרימיום בבית – רק ביום אחד בשבוע (היום הראשון שבו נפתחת האפליקציה בכל שבוע) ---
function homePremiumBadgeDay() {
    const today = getLocalDateString();
    const week = currentWeekStart();
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('weekwise_premium_badge_day') || 'null'); } catch {}
    if (!saved || saved.week !== week) {
        saved = { week, day: today };
        try { localStorage.setItem('weekwise_premium_badge_day', JSON.stringify(saved)); } catch {}
    }
    return saved.day === today;
}

// חלונית העציץ או התפריט של הפתק המהיר פתוחים - בועת העוזר מוסתרת בינתיים (שלא תעלה עליהם)
function syncHomePopoverClass() {
    const open = ['home-done-popover', 'quick-note-menu'].some(id => { const el = document.getElementById(id); return !!el && !el.classList.contains('hidden'); });
    document.body.classList.toggle('home-popover-open', open);
}

// סגירת החלוניות הקטנות בלחיצה בחוץ
function initHomeV2() {
    initMyDaySwipes();
    initQuickNoteLongPress();
    initDictationButtons();
    document.addEventListener('click', e => {
        const pop = document.getElementById('home-done-popover');
        if (pop && !pop.classList.contains('hidden') && !e.target.closest('#home-done-popover, #btn-home-planter')) pop.classList.add('hidden');
        const menu = document.getElementById('quick-note-menu');
        if (menu && !menu.classList.contains('hidden') && !e.target.closest('#quick-note-menu, #btn-ai-fab')) menu.classList.add('hidden');
        const tip = document.getElementById('myday-water-tip');
        if (tip && !tip.classList.contains('hidden') && !e.target.closest('.myday-water-info, #myday-water-tip')) toggleMyDayWaterInfo();
        syncHomePopoverClass();
    });
    try { if (sessionStorage.getItem('weekwise_home_focus') === '1') toggleHomeFocus(true); } catch {}
}

// ===================== שלב 2: נגיעות אישיות =====================
// לפי הרעיונות שנבחרו במפורש: 3 רצף ימים, 8 משפט קטן ליום, 12 ספירה לאחור,
// 5 "3 דברים טובים" בערב, 14 השבועות הקודמים של הפתק השבועי, 9 מזג אוויר בשמיים

const HOME_FLAME_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.2 1.6 1 2.6 2 3 0-2.6-.6-5.4.8-8.2z"/></svg>';
const HOME_HOURGLASS_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/></svg>';
const HOME_MOON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

function homeDaysBetween(a, b) {
    return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
}

// --- ✨ משפט קטן ליום, ברוח "בדרך ל-10" - מתחלף כל בוקר (21 משפטים, אחד ליום) ---
const HOME_DAILY_LINE_COUNT = 21;
function homeDailyLineIndex(date) {
    const d = date || new Date();
    return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000) % HOME_DAILY_LINE_COUNT + 1;
}
function renderHomeDailyLine() {
    const el = document.getElementById('home-daily-line');
    if (el) el.textContent = t(`daily_line_${homeDailyLineIndex()}`);
}

// --- 🔥 רצף ימים: כמה ימים ברצף היה לפחות ✓ אחד (יומן, לו"ז, שגרה, יעדים, New Me). הימים
// הקודמים נטענים פעם ביום; היום נספר חי מ"היום שלי". עוד אין ✓ היום? הרצף עדיין לא נשבר -
// סופרים עד אתמול. מוצג רק מ-2 ימים, ורצף שנגמר פשוט נעלם בשקט (בלי שום הודעה) ---
let homeStreakPast = null;
let homeStreakLoadedDay = null;
async function loadHomeStreak() {
    if (!supabaseClient || !currentUserId) return;
    const today = getLocalDateString();
    const from = addDaysToDateStr(today, -120);
    const uid = currentUserId;
    const safe = p => p.then(r => r.data || []).catch(() => []);
    const [sc, ev, rc, vc, nc] = await Promise.all([
        safe(supabaseClient.from('schedule_completions').select('completion_date').eq('user_id', uid).gte('completion_date', from)),
        safe(supabaseClient.from('calendar_events').select('event_date').eq('user_id', uid).eq('is_completed', true).gte('event_date', from).lte('event_date', today)),
        safe(supabaseClient.from('routine_item_checkins').select('checkin_date').eq('user_id', uid).gte('checkin_date', from)),
        safe(supabaseClient.from('vision_goal_checkins').select('checkin_date').eq('user_id', uid).gte('checkin_date', from)),
        safe(supabaseClient.from('new_me_checkins').select('checkin_date').eq('user_id', uid).gte('checkin_date', from)),
    ]);
    const days = new Set([...sc.map(r => r.completion_date), ...ev.map(r => r.event_date), ...rc.map(r => r.checkin_date), ...vc.map(r => r.checkin_date), ...nc.map(r => r.checkin_date)].filter(Boolean));
    days.delete(today);
    homeStreakPast = days;
    homeStreakLoadedDay = today;
    renderHomeChips();
}
function homeStreakCount() {
    if (!homeStreakPast) return 0;
    const today = getLocalDateString();
    let n = myDayItems.some(it => it.checkable && it.done) ? 1 : 0;
    let d = addDaysToDateStr(today, -1);
    while (homeStreakPast.has(d)) { n++; d = addDaysToDateStr(d, -1); }
    return n;
}

// --- ⏳ ספירה לאחור לאירוע הקרוב שסומן ⭐ ביומן (עד 100 יום קדימה) ---
let homeCountdown = null;
async function loadHomeCountdown() {
    if (!supabaseClient || !currentUserId) return;
    const today = getLocalDateString();
    const { data } = await supabaseClient.from('calendar_events').select('id, event_title, event_date, is_completed').eq('user_id', currentUserId).eq('is_starred', true).gte('event_date', today).order('event_date', { ascending: true }).limit(10);
    const next = (data || []).find(ev => !ev.is_completed && (ev.event_title || '').trim());
    const days = next ? homeDaysBetween(today, next.event_date) : null;
    homeCountdown = next && days <= 100 ? { date: next.event_date, title: next.event_title.trim(), days } : null;
    renderHomeChips();
}
function homeCountdownText(cd) {
    if (cd.days <= 0) return t('home_countdown_today').replace('{title}', cd.title);
    if (cd.days === 1) return t('home_countdown_tomorrow').replace('{title}', cd.title);
    return t('home_countdown_days').replace('{n}', cd.days).replace('{title}', cd.title);
}
function openHomeCountdown() {
    if (!homeCountdown) return;
    switchToTab('schedule-section');
    selectCalendarDay(homeCountdown.date);
}

// --- 🌙 "3 דברים טובים מהיום" - בערב (18:00 עד 04:00; אחרי חצות זה עדיין היום שעבר) ---
const GOOD_THINGS_KEY = 'weekwise_good_things_enabled';
function isGoodThingsOn() { try { return localStorage.getItem(GOOD_THINGS_KEY) !== 'false'; } catch { return true; } }
function isHomeEvening() { const h = new Date().getHours(); return h >= 18 || h < 4; }
function goodThingsDay() {
    const d = new Date();
    if (d.getHours() < 4) d.setDate(d.getDate() - 1);
    return getLocalDateString(d);
}
let goodThingsToday = null;
let goodThingsLoadedFor = null;
async function loadGoodThingsToday() {
    if (!supabaseClient || !currentUserId) return;
    const day = goodThingsDay();
    const { data } = await supabaseClient.from('good_things').select('items').eq('user_id', currentUserId).eq('day', day).maybeSingle();
    goodThingsToday = data && Array.isArray(data.items) ? data.items : null;
    goodThingsLoadedFor = day;
    renderHomeChips();
}
function goodThingsSaved() { return !!(goodThingsToday && goodThingsToday.some(x => String(x || '').trim())); }
function goodThingsChipVisible() {
    if (!isGoodThingsOn() || !isHomeEvening()) return false;
    let skipped = null;
    try { skipped = localStorage.getItem(`weekwise_good_things_skip_${currentUserId}`); } catch {}
    return goodThingsSaved() || skipped !== goodThingsDay();
}
function openGoodThings() {
    const items = goodThingsToday || [];
    document.querySelectorAll('#good-things-inputs input').forEach((input, i) => { input.value = items[i] || ''; });
    const past = document.getElementById('good-things-past');
    if (past) past.open = false;
    openModal('modal-good-things');
}
async function saveGoodThings() {
    if (!supabaseClient || !currentUserId) return;
    const items = [...document.querySelectorAll('#good-things-inputs input')].map(input => input.value.trim()).filter(Boolean);
    const day = goodThingsDay();
    let error = null;
    if (items.length) {
        ({ error } = await supabaseClient.from('good_things').upsert({ user_id: currentUserId, day, items, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' }));
    } else if (goodThingsSaved()) {
        ({ error } = await supabaseClient.from('good_things').delete().eq('user_id', currentUserId).eq('day', day));
    }
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    goodThingsToday = items.length ? items : null;
    goodThingsLoadedFor = day;
    closeModal('modal-good-things');
    if (items.length) showAppToast(t('good_things_saved_toast'));
    renderHomeChips();
}
function skipGoodThingsTonight() {
    try { localStorage.setItem(`weekwise_good_things_skip_${currentUserId}`, goodThingsDay()); } catch {}
    closeModal('modal-good-things');
    renderHomeChips();
}
async function renderGoodThingsPast() {
    const box = document.getElementById('good-things-past-list');
    if (!box || !supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('good_things').select('day, items').eq('user_id', currentUserId).lt('day', goodThingsDay()).order('day', { ascending: false }).limit(14);
    const rows = (data || []).filter(r => Array.isArray(r.items) && r.items.some(Boolean));
    if (!rows.length) { box.innerHTML = `<p class="good-things-past-empty">${myDayEsc(t('good_things_past_empty'))}</p>`; return; }
    box.innerHTML = rows.map(r => {
        const [y, m, d] = r.day.split('-').map(Number);
        const label = new Date(y, m - 1, d).toLocaleDateString(currentLang, { weekday: 'short', day: 'numeric', month: 'short' });
        return `<div class="good-things-past-day"><span class="good-things-past-date">${myDayEsc(label)}</span><ul>${r.items.filter(Boolean).map(x => `<li>${myDayEsc(x)}</li>`).join('')}</ul></div>`;
    }).join('');
}
function applyGoodThingsSetting() {
    const toggle = document.getElementById('good-things-toggle');
    if (toggle) toggle.checked = isGoodThingsOn();
    renderHomeChips();
}
async function loadGoodThingsSetting() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('user_premium').select('good_things_enabled').eq('user_id', currentUserId).maybeSingle();
    if (data && data.good_things_enabled !== null && data.good_things_enabled !== undefined) {
        try { localStorage.setItem(GOOD_THINGS_KEY, String(data.good_things_enabled)); } catch {}
    }
    applyGoodThingsSetting();
}
async function toggleGoodThingsSetting() {
    const enabled = document.getElementById('good-things-toggle').checked;
    try { localStorage.setItem(GOOD_THINGS_KEY, String(enabled)); } catch {}
    applyGoodThingsSetting();
    if (supabaseClient && currentUserId) {
        await supabaseClient.from('user_premium').upsert({ user_id: currentUserId, username: currentUsername, good_things_enabled: enabled }, { onConflict: 'user_id' });
    }
}

// --- הצ'יפים הקטנים מתחת לברכה: רצף, ספירה לאחור, ובערב "3 דברים טובים" ---
function renderHomeChips() {
    const box = document.getElementById('home-chips');
    if (!box) return;
    const chips = [];
    const streak = homeStreakCount();
    if (streak >= 2) {
        chips.push(`<span class="home-chip home-chip-streak" title="${myDayEsc(t('home_streak_title'))}">${HOME_FLAME_SVG}<span>${myDayEsc(t('home_streak_days').replace('{n}', streak))}</span></span>`);
    }
    if (homeCountdown) {
        chips.push(`<button type="button" class="home-chip home-chip-countdown" onclick="openHomeCountdown()">${HOME_HOURGLASS_SVG}<span>${myDayEsc(homeCountdownText(homeCountdown))}</span></button>`);
    }
    if (goodThingsChipVisible()) {
        const saved = goodThingsSaved();
        chips.push(`<button type="button" class="home-chip home-chip-good${saved ? ' is-saved' : ''}" onclick="openGoodThings()">${HOME_MOON_SVG}<span>${myDayEsc(t(saved ? 'good_things_chip_done' : 'good_things_chip'))}</span></button>`);
    }
    box.innerHTML = chips.join('');
    box.classList.toggle('hidden', !chips.length);
}

// --- 🗂️ השבועות הקודמים של הפתק השבועי: בכל שמירה נשמר עותק לשבוע הנוכחי (פתק שלא השתנה
// מקבל עותק בפתיחה הראשונה בשבוע). פתק שנמחק לא מוחק את מה שנשמר לשבוע. לחיצה ארוכה על
// הפתק (או על הסיכה) פותחת את השבועות שעברו ---
async function snapshotWeeklyNote(onlyIfMissing) {
    if (!supabaseClient || !currentUserId) return;
    const text = String(currentWeeklyNoteText || '').trim();
    const items = (currentWeeklyNoteItems || []).slice(0, currentWeeklyNoteItemCount).filter(it => String(it.text || '').trim());
    if (!text && !items.length) return;
    const week = currentWeekStart();
    if (onlyIfMissing) {
        try { if (localStorage.getItem(`weekwise_weekly_note_snap_week_${currentUserId}`) === week) return; } catch {}
        const { data } = await supabaseClient.from('weekly_note_history').select('id').eq('user_id', currentUserId).eq('week_start', week).limit(1);
        if (data && data.length) { try { localStorage.setItem(`weekwise_weekly_note_snap_week_${currentUserId}`, week); } catch {} return; }
    }
    const { error } = await supabaseClient.from('weekly_note_history').upsert(
        { user_id: currentUserId, week_start: week, note_text: text, note_items: items, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,week_start' },
    );
    if (!error) { try { localStorage.setItem(`weekwise_weekly_note_snap_week_${currentUserId}`, week); } catch {} }
}
async function openWeeklyNoteHistory() {
    const box = document.getElementById('weekly-history-list');
    if (!box) return;
    box.innerHTML = '';
    openModal('modal-weekly-history');
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('weekly_note_history').select('week_start, note_text, note_items').eq('user_id', currentUserId).lt('week_start', currentWeekStart()).order('week_start', { ascending: false }).limit(26);
    const rows = data || [];
    if (!rows.length) { box.innerHTML = `<p class="weekly-history-empty">${myDayEsc(t('weekly_note_history_empty'))}</p>`; return; }
    box.innerHTML = rows.map(r => {
        const [y, m, d] = r.week_start.split('-').map(Number);
        const label = t('weekly_note_history_week').replace('{date}', new Date(y, m - 1, d).toLocaleDateString(currentLang, { day: 'numeric', month: 'short' }));
        const items = Array.isArray(r.note_items) ? r.note_items.filter(it => it && String(it.text || '').trim()) : [];
        return `<div class="weekly-history-card">
            <span class="weekly-history-week">${myDayEsc(label)}</span>
            ${items.length ? `<ul class="weekly-history-items">${items.map(it => `<li class="${it.done ? 'done' : ''}"><span class="weekly-history-box" aria-hidden="true">${it.done ? '✓' : ''}</span>${myDayEsc(it.text)}</li>`).join('')}</ul>` : ''}
            ${r.note_text ? `<p class="weekly-history-text">${myDayEsc(r.note_text)}</p>` : ''}
        </div>`;
    }).join('');
}

// --- 🌦️ מזג אוויר בשמיים: כבוי כברירת מחדל (צריך אישור מיקום). המיקום המשוער (מעוגל לכקילומטר)
// נשמר רק במכשיר; הבדיקה עצמה דרך פונקציית השרת weather (MET Norway). מתעדכן כל 40 דקות לכל היותר ---
const HOME_WEATHER_KEY = 'weekwise_weather_on';
const HOME_WEATHER_COORDS_KEY = 'weekwise_weather_coords';
const HOME_WEATHER_CACHE_KEY = 'weekwise_weather_cache';
function isHomeWeatherOn() { try { return localStorage.getItem(HOME_WEATHER_KEY) === 'true'; } catch { return false; } }
function homeWeatherLocate() {
    return new Promise(resolve => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: Math.round(pos.coords.latitude * 100) / 100, lon: Math.round(pos.coords.longitude * 100) / 100 }),
            () => resolve(null),
            { enableHighAccuracy: false, timeout: 12000, maximumAge: 6 * 3600 * 1000 },
        );
    });
}
async function toggleHomeWeather() {
    const toggle = document.getElementById('home-weather-toggle');
    const on = toggle ? toggle.checked : !isHomeWeatherOn();
    if (!on) {
        try { localStorage.setItem(HOME_WEATHER_KEY, 'false'); localStorage.removeItem(HOME_WEATHER_COORDS_KEY); localStorage.removeItem(HOME_WEATHER_CACHE_KEY); } catch {}
        applyHomeWeather(null);
        return;
    }
    const coords = await homeWeatherLocate();
    if (!coords) {
        if (toggle) toggle.checked = false;
        showAppToast(t('weather_location_denied'), 'error');
        return;
    }
    try { localStorage.setItem(HOME_WEATHER_KEY, 'true'); localStorage.setItem(HOME_WEATHER_COORDS_KEY, JSON.stringify(coords)); } catch {}
    await refreshHomeWeather(true);
}
async function refreshHomeWeather(force) {
    if (homeWeatherPreview) { applyHomeWeather(homeWeatherPreview); return; }
    if (!isHomeWeatherOn()) { applyHomeWeather(null); return; }
    let cache = null;
    try { cache = JSON.parse(localStorage.getItem(HOME_WEATHER_CACHE_KEY) || 'null'); } catch {}
    if (!force && cache && Date.now() - cache.at < 40 * 60000) { applyHomeWeather(cache); return; }
    let coords = null;
    try { coords = JSON.parse(localStorage.getItem(HOME_WEATHER_COORDS_KEY) || 'null'); } catch {}
    if (!coords || !supabaseClient) { applyHomeWeather(cache); return; }
    try {
        const { data: s } = await supabaseClient.auth.getSession();
        const token = s && s.session && s.session.access_token;
        if (!token) { applyHomeWeather(cache); return; }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/weather`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(coords),
        });
        const out = await res.json();
        if (!res.ok || !out.sky) throw new Error(out.error || 'weather');
        const next = { sky: out.sky, day: !!out.day, at: Date.now() };
        try { localStorage.setItem(HOME_WEATHER_CACHE_KEY, JSON.stringify(next)); } catch {}
        applyHomeWeather(next);
    } catch (e) {
        applyHomeWeather(cache);
        if (force) showAppToast(t('weather_failed'), 'error');
    }
}
const HOME_WEATHER_COVERED = ['clouds', 'rain', 'snow', 'storm', 'fog'];
function applyHomeWeather(state) {
    const sky = state && (state.preview || isHomeWeatherOn()) ? state.sky : null;
    const layer = document.getElementById('home-weather');
    if (layer) {
        let cls = 'home-weather';
        if (sky === 'clear') {
            // יום בהיר: שמש עדינה (בלילה ירח וכוכבים) - רק כשהערכה לא מציירת שמיים משלה
            const strip = document.querySelector('.home-sky-scene .home-sky-topstrip');
            const themeSky = strip && getComputedStyle(strip).backgroundImage !== 'none';
            if (!themeSky) cls += state.day === false ? ' wx-clear-night' : ' wx-clear-day';
        } else if (sky) cls += ` wx-${sky}`;
        layer.className = cls;
    }
    const scene = document.querySelector('.home-sky-scene');
    if (scene) scene.classList.toggle('wx-covered', HOME_WEATHER_COVERED.includes(sky));
    const toggle = document.getElementById('home-weather-toggle');
    if (toggle) toggle.checked = isHomeWeatherOn();
    const dev = document.getElementById('weather-dev-preview');
    if (dev) dev.classList.toggle('hidden', !(typeof isDevSuperuserAccount !== 'undefined' && isDevSuperuserAccount));
}

// --- 🛠️ למנהלת המוצר בלבד (חשבון הפיתוח): תצוגה מקדימה של כל סוגי מזג האוויר בשמיים, בלי מיקום.
// נשארת עד שבוחרים ✕ (או רענון של הדף) ---
let homeWeatherPreview = null;
function previewHomeWeather(sky, day) {
    if (typeof isDevSuperuserAccount === 'undefined' || !isDevSuperuserAccount) return;
    homeWeatherPreview = sky ? { sky, day: day !== false, preview: true } : null;
    if (homeWeatherPreview) applyHomeWeather(homeWeatherPreview);
    else refreshHomeWeather(false);
    closeModal('modal-settings-drawer');
    if (typeof goHome === 'function') goHome();
}

// --- הפעלה אחרי הכניסה, ורענון קטן כל 10 דקות (ברכה לפי השעה, ערב, יום חדש, מזג אוויר) ---
let homePhase2Timer = 0;
let homePhase2Day = null;
function initHomePhase2() {
    homePhase2Day = getLocalDateString();
    renderHomeDailyLine();
    loadHomeStreak();
    loadHomeCountdown();
    loadGoodThingsSetting();
    loadGoodThingsToday();
    snapshotWeeklyNote(true);
    refreshHomeWeather(false);
    homeAttachLongPress(document.getElementById('weekly-note-widget'), openWeeklyNoteHistory);
    homeAttachLongPress(document.getElementById('weekly-note-pin'), openWeeklyNoteHistory);
    if (homePhase2Timer) return;
    homePhase2Timer = setInterval(() => {
        renderHomeGreeting();
        const today = getLocalDateString();
        if (today !== homePhase2Day) {
            homePhase2Day = today;
            loadHomeStreak();
            loadHomeCountdown();
            snapshotWeeklyNote(true);
        }
        if (goodThingsLoadedFor !== goodThingsDay()) loadGoodThingsToday();
        else renderHomeChips();
        refreshHomeWeather(false);
    }, 10 * 60000);
}
