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
        const items = (rows || []).filter(it => (it.title || '').trim() && hours.has(Number(String(it.time || '').slice(0, 2))));
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
            kind: 'calendar', group: 'calendar', minutes: scheduleTimeToMinutes(row.time_of_day), done, checkable: true,
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
                tag: kind === 'task' ? '' : `${t('myday_filter_calendar')}${range ? ` · ${range}` : ''}`,
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
    if (focusItems && focusItems.length) {
        const chipsRow = document.createElement('div');
        chipsRow.className = 'daily-focus-chips-row';
        focusItems.forEach(item => {
            const chip = document.createElement('span');
            chip.className = 'daily-focus-chip';
            chip.textContent = localizeDailyFocusTitle(item.event_title);
            chipsRow.appendChild(chip);
        });
        container.appendChild(chipsRow);
    }
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
    renderMyDayTimeline(container, items, focusItems);
    renderMyDayBar(items);
    if (document.body.classList.contains('home-focus-on')) renderHomeFocus();
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
let quickNoteLongPressFired = false;
function initQuickNoteLongPress() {
    const el = document.getElementById('btn-ai-fab');
    if (!el || el.dataset.longPress) return;
    el.dataset.longPress = '1';
    let timer = 0;
    const start = () => {
        quickNoteLongPressFired = false;
        clearTimeout(timer);
        timer = setTimeout(() => { quickNoteLongPressFired = true; openQuickNoteMenu(); }, 520);
    };
    const cancel = () => clearTimeout(timer);
    el.addEventListener('pointerdown', start);
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => el.addEventListener(ev, cancel));
    el.addEventListener('contextmenu', e => e.preventDefault());
    // הקליק שאחרי לחיצה ארוכה לא פותח את הפתק הרגיל (התפריט כבר פתוח)
    el.addEventListener('click', e => {
        if (quickNoteLongPressFired) { e.stopImmediatePropagation(); e.preventDefault(); quickNoteLongPressFired = false; }
    }, true);
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
let quickNoteRecognition = null;
function startQuickNoteDictation() {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const input = document.getElementById('ai-quick-add-input');
    if (!Rec || !input) { showAppToast(t('quick_note_voice_failed'), 'error'); return; }
    try { if (quickNoteRecognition) quickNoteRecognition.abort(); } catch {}
    const rec = new Rec();
    quickNoteRecognition = rec;
    rec.lang = HOME_SPEECH_LANGS[currentLang] || currentLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    const placeholder = input.placeholder;
    input.placeholder = t('quick_note_listening');
    input.classList.add('is-listening');
    const finish = () => { input.placeholder = placeholder; input.classList.remove('is-listening'); quickNoteRecognition = null; };
    rec.onresult = e => {
        const said = Array.from(e.results).map(r => r[0].transcript).join(' ').trim();
        if (said) input.value = (input.value.trim() ? input.value.trim() + ' ' : '') + said;
        input.dispatchEvent(new Event('input', { bubbles: true }));
    };
    rec.onerror = () => { finish(); showAppToast(t('quick_note_voice_failed'), 'error'); };
    rec.onend = finish;
    try { rec.start(); } catch { finish(); showAppToast(t('quick_note_voice_failed'), 'error'); }
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
    document.addEventListener('click', e => {
        const pop = document.getElementById('home-done-popover');
        if (pop && !pop.classList.contains('hidden') && !e.target.closest('#home-done-popover, #btn-home-planter')) pop.classList.add('hidden');
        const menu = document.getElementById('quick-note-menu');
        if (menu && !menu.classList.contains('hidden') && !e.target.closest('#quick-note-menu, #btn-ai-fab')) menu.classList.add('hidden');
        syncHomePopoverClass();
    });
    try { if (sessionStorage.getItem('weekwise_home_focus') === '1') toggleHomeFocus(true); } catch {}
}
