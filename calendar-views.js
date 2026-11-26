// 📅 calendar-views.js - "הגדרות מיומנים רגילים", שלב 1 (לפי בחירה מפורשת מתוך רשימת 45, 2026-11-24:
// 1-12 ו-39-44): תצוגות יום / 3 ימים / שבוע על רשת שעות, שנה ורשימה; הגדרות יומן (היום הראשון
// בשבוע, 24/12 שעות, מספרי שבועות, ימים שמוצגים, אזור זמן נוסף, משך ותזכורת ברירת מחדל); גרירת
// אירוע ליום ולשעה אחרים, שכפול מהיר, ביטול אחרי מחיקה, חיפוש ביומן, אזהרת חפיפה ומציאת זמן פנוי.
// נטען אחרי app.js. המבט החודשי הקיים (loadMonthlyCalendarGrid) נשאר במקומו ומשתמש בהגדרות מכאן.
'use strict';

// ---------- הגדרות ----------
const CAL_PREFS_KEY = 'weekwise_cal_prefs_v1';
const CAL_VIEWS = ['month', 'week', '3day', 'day', 'year', 'list'];
const CAL_DEFAULTS = { view: 'month', firstDay: 0, clock: '24', weekNums: false, days: [0, 1, 2, 3, 4, 5, 6], tz2: '', dur: 60, rem: 0 };
const CAL_HOUR_PX = 48;
const CAL_INTERNAL_SOURCES = '(today_celebrated,daily_focus,daily_focus_dismissed)';
let calPrefs = calLoadPrefs();
let calAnchor = null;          // התאריך שהתצוגה (יום / 3 ימים / שבוע / שנה) בנויה סביבו
let calServerPrefsOk = null;   // null = עוד לא נבדק; false = אין עמודה בשרת (נשמר רק במכשיר)

function calLoadPrefs() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(CAL_PREFS_KEY) || '{}') || {}; } catch { saved = {}; }
    return calCleanPrefs({ ...CAL_DEFAULTS, ...saved });
}
function calCleanPrefs(p) {
    const out = { ...CAL_DEFAULTS, ...p };
    if (!CAL_VIEWS.includes(out.view)) out.view = 'month';
    out.firstDay = [0, 1, 6].includes(Number(out.firstDay)) ? Number(out.firstDay) : 0;
    out.clock = out.clock === '12' ? '12' : '24';
    out.weekNums = !!out.weekNums;
    out.days = Array.isArray(out.days) ? [...new Set(out.days.map(Number).filter(d => d >= 0 && d <= 6))] : [...CAL_DEFAULTS.days];
    if (!out.days.length) out.days = [...CAL_DEFAULTS.days];
    out.tz2 = typeof out.tz2 === 'string' && calTzValid(out.tz2) ? out.tz2 : '';
    out.dur = Math.min(Math.max(parseInt(out.dur) || 60, 5), 720);
    out.rem = Math.min(Math.max(parseInt(out.rem) || 0, 0), 40320);
    return out;
}
function calSavePrefs(patch) {
    calPrefs = calCleanPrefs({ ...calPrefs, ...patch });
    try { localStorage.setItem(CAL_PREFS_KEY, JSON.stringify(calPrefs)); } catch {}
    if (calServerPrefsOk && supabaseClient && currentUserId) {
        supabaseClient.from('user_premium').update({ calendar_prefs: calPrefs }).eq('user_id', currentUserId).then(() => {}, () => {});
    }
}
// ההגדרות נשמרות גם בשרת (user_premium.calendar_prefs) כשהעמודה קיימת - כך הן זהות בכל המכשירים
async function calLoadServerPrefs() {
    if (calServerPrefsOk !== null || !supabaseClient || !currentUserId) return;
    calServerPrefsOk = false;
    try {
        const { data, error } = await supabaseClient.from('user_premium').select('calendar_prefs').eq('user_id', currentUserId).maybeSingle();
        if (error) return;
        calServerPrefsOk = true;
        if (data && data.calendar_prefs && typeof data.calendar_prefs === 'object') {
            calPrefs = calCleanPrefs({ ...calPrefs, ...data.calendar_prefs, view: calPrefs.view });
            try { localStorage.setItem(CAL_PREFS_KEY, JSON.stringify(calPrefs)); } catch {}
        }
    } catch {}
}
function calTzValid(tz) {
    if (!tz) return false;
    try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

// זכוכית מגדלת מצוירת בצבע הערכה - בשדות החיפוש של היומן (חיפוש ביומן, אזור זמן נוסף)
const CAL_SEARCH_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';

// ---------- עזרי תאריך ושעה ----------
function calDate(dateStr) { const [y, m, d] = dateStr.split('-').map(Number); return new Date(y, m - 1, d); }
function calWeekday(dateStr) { return calDate(dateStr).getDay(); }
// תחילת השבוע לפי ההגדרה (ראשון / שני / שבת) - רק בתצוגות היומן; שאר האפליקציה (דוחות וכו') נשארת כמו קודם
function calWeekStart(dateStr) {
    const d = calDate(dateStr);
    const back = (d.getDay() - calPrefs.firstDay + 7) % 7;
    return getLocalDateString(new Date(d.getFullYear(), d.getMonth(), d.getDate() - back));
}
function calCurrentWeekStart() { return calWeekStart(getLocalDateString()); }
// ימי השבוע לפי הסדר שמתחיל ביום הראשון שנבחר, רק אלה שמוצגים
function calShownWeekdays() {
    const order = [0, 1, 2, 3, 4, 5, 6].map(i => (calPrefs.firstDay + i) % 7);
    return order.filter(d => calPrefs.days.includes(d));
}
function calIsShown(dateStr) { return calPrefs.days.includes(calWeekday(dateStr)); }
// מספר שבוע ISO: נקבע לפי יום חמישי של השורה
function calIsoWeek(dateObj) {
    const thu = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate() + (4 - (dateObj.getDay() || 7)));
    const jan1 = new Date(thu.getFullYear(), 0, 1);
    return Math.floor((Math.round((thu - jan1) / 86400000)) / 7) + 1;
}
function calToMin(timeStr) {
    const m = String(timeStr || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    const v = parseInt(m[1]) * 60 + parseInt(m[2]);
    return v >= 0 && v < 1440 ? v : null;
}
function calFromMin(min) { const v = Math.max(0, Math.min(1439, Math.round(min))); return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`; }
// "17:00" או "5:00 PM" (לפי הגדרת השעון, בשפת הממשק)
function calFmtTime(hhmm) {
    const min = calToMin(hhmm);
    if (min === null) return String(hhmm || '');
    if (calPrefs.clock !== '12') return calFromMin(min);
    return new Date(2000, 0, 1, Math.floor(min / 60), min % 60).toLocaleTimeString(currentLang, { hour: 'numeric', minute: '2-digit', hour12: true });
}
function calFmtHour(h) {
    if (calPrefs.clock !== '12') return `${String(h).padStart(2, '0')}:00`;
    return new Date(2000, 0, 1, h, 0).toLocaleTimeString(currentLang, { hour: 'numeric', hour12: true });
}
function calRange(startHHMM, endHHMM) {
    const iso = s => String.fromCharCode(0x2066) + s + String.fromCharCode(0x2069);
    return iso(calFmtTime(startHHMM) + (endHHMM ? `–${calFmtTime(endHHMM)}` : ''));
}
// השעה באזור הזמן הנוסף, לתאריך+שעה מקומיים
function calTz2Time(dateStr, min) {
    if (!calPrefs.tz2) return '';
    const d = calDate(dateStr);
    d.setHours(Math.floor(min / 60), min % 60, 0, 0);
    try {
        return d.toLocaleTimeString(currentLang, { timeZone: calPrefs.tz2, hour: 'numeric', minute: '2-digit', hour12: calPrefs.clock === '12' });
    } catch { return ''; }
}
function calTzLabel(tz) {
    const city = String(tz).split('/').pop().replace(/_/g, ' ');
    let name = '';
    try {
        const part = new Intl.DateTimeFormat(currentLang, { timeZone: tz, timeZoneName: 'longGeneric' }).formatToParts(new Date()).find(p => p.type === 'timeZoneName');
        name = part ? part.value : '';
    } catch {}
    return name && name !== city ? `${city} · ${name}` : city;
}
function calDeviceTz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return ''; } }
function calEsc(s) { return escapeHtmlForReport(String(s == null ? '' : s)); }
function calFmtDate(dateStr, opts) { return calDate(dateStr).toLocaleDateString(currentLang, opts); }
function calFmtUnit(n, unit) {
    try { return new Intl.NumberFormat(currentLang, { style: 'unit', unit, unitDisplay: 'short' }).format(n); } catch { return `${n} ${unit === 'hour' ? 'h' : unit === 'day' ? 'd' : 'min'}`; }
}
function calFmtMinutes(min) {
    if (min >= 1440 && min % 1440 === 0) return calFmtUnit(min / 1440, 'day');
    if (min >= 60 && min % 60 === 0) return calFmtUnit(min / 60, 'hour');
    return calFmtUnit(min, 'minute');
}

// ---------- נתונים ----------
async function calFetchRange(start, end) {
    if (!supabaseClient || !currentUserId) return { events: [], fixed: [] };
    // 📅 יומן שלב 2 (calendar-details.js): גם אירוע של כמה ימים שנכנס לטווח, ובלי יומנים שהוסתרו
    const hasCalx = typeof calxRange === 'function';
    let q = supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId);
    q = hasCalx ? calxRange(q, start, end) : q.gte('event_date', start).lte('event_date', end);
    const [{ data: events }, { data: fixed }] = await Promise.all([
        q.not('source', 'in', CAL_INTERNAL_SOURCES),
        supabaseClient.from('weekly_schedule').select('*').eq('user_id', currentUserId),
        hasCalx ? calxLoadCalendars() : null,
    ]);
    return { events: (events || []).filter(e => !hasCalx || calxVisible(e)), fixed: (fixed || []).filter(r => String(r.task_title || '').trim()) };
}
// כל מה שיש בתאריך: אירועים ומשימות מהיומן + המשימות הקבועות של אותו יום בשבוע
function calItemsForDate(dateStr, data, withFixed = true) {
    const wd = calWeekday(dateStr);
    const out = [];
    const hasCalx = typeof calxCovers === 'function';
    data.events.filter(e => (hasCalx ? calxCovers(e, dateStr) : e.event_date === dateStr)).forEach(e => {
        // כל היום / כמה ימים - בפס של "כל היום" למעלה, בלי שעה
        const allDay = hasCalx && (e.all_day || calxIsMulti(e));
        const timeRaw = allDay ? '' : (e.event_time || (String(e.event_title || '').match(/^(\d{1,2}:\d{2})\s/) || [])[1] || '');
        const start = calToMin(timeRaw);
        let end = calToMin(e.end_time);
        if (start === null || end === null || end <= start) end = null;
        out.push({ type: 'event', id: e.id, date: dateStr, start, end, title: stripLeadingTimeFromTitle(e.event_title), icon: calendarKindIcon(e), kind: calendarKindOf(e), done: !!e.is_completed, row: e, color: hasCalx ? calxColorOf(e) : null, free: !!e.is_free, multi: hasCalx ? calxDayLabel(e, dateStr) : '' });
    });
    if (withFixed) {
        data.fixed.filter(r => r.day_of_week === dbDaysMap[wd]).forEach(r => {
            out.push({ type: 'fixed', id: r.id, date: dateStr, start: calToMin(r.time_of_day), end: null, title: r.task_title, icon: '🔁', kind: 'fixed', done: false, row: r });
        });
    }
    return out.sort((a, b) => (a.start ?? -1) - (b.start ?? -1));
}
function calItemEnd(it) { return it.end !== null && it.end !== undefined ? it.end : Math.min(1440, it.start + calPrefs.dur); }
function calOpenItem(it) {
    if (!it) return;
    if (it.type === 'event') openEditCalendarEvent(it.row);
    else openGlanceTaskEditor(it.row.id, it.row.task_title, it.row.time_of_day, it.row.day_of_week, it.row.reminder_minutes, it.row.reminder_text);
}
function calRefreshAll() {
    if (typeof loadCalendarEvents === 'function') loadCalendarEvents();
    if (typeof loadMonthlyCalendarGrid === 'function') loadMonthlyCalendarGrid();
    if (typeof loadTodayTasks === 'function') loadTodayTasks();
    if (typeof loadWeeklySchedule === 'function') loadWeeklySchedule();
}

// ---------- בחירת תצוגה ----------
function calActiveView() { return calPrefs.view; }
function calSetView(view, dateStr) {
    if (!CAL_VIEWS.includes(view)) return;
    if (dateStr) calAnchor = dateStr;
    if (view === 'month' && dateStr) {
        viewedCalendarMonthKey = dateStr.slice(0, 7);
        selectedCalendarDay = dateStr;
    }
    calSavePrefs({ view });
    calSyncViewChrome();
    loadMonthlyCalendarGrid();
}
function calSyncViewChrome() {
    const view = calPrefs.view;
    document.querySelectorAll('#cal-view-chips .cal-view-chip').forEach(chip => {
        const on = chip.dataset.view === view;
        chip.classList.toggle('on', on);
        chip.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    const month = document.getElementById('cal-month-view');
    const alt = document.getElementById('cal-alt-view');
    if (month) month.classList.toggle('hidden', view !== 'month');
    if (alt) alt.classList.toggle('hidden', view === 'month');
    const title = document.getElementById('monthly-calendar-title');
    if (title) title.textContent = t(view === 'month' ? 'monthly_calendar_title' : `calv_title_${view === '3day' ? 'three' : view}`);
}
function calGoToday() {
    calAnchor = getLocalDateString();
    if (calPrefs.view === 'month') {
        viewedCalendarMonthKey = currentMonthKey();
        selectedCalendarDay = calAnchor;
    }
    if (calPrefs.view === 'list') calListFrom = null;
    loadMonthlyCalendarGrid();
}
function calNavigate(delta) {
    const a = calAnchor || getLocalDateString();
    const view = calPrefs.view;
    if (view === 'week') calAnchor = addDaysToDateStr(a, delta * 7);
    else if (view === 'year') { const y = Number(a.slice(0, 4)) + delta; calAnchor = `${y}${a.slice(4, 7)}-01`; }
    else {
        const steps = view === '3day' ? 3 : 1;
        let d = a, moved = 0, guard = 0;
        while (moved < steps && guard++ < 30) { d = addDaysToDateStr(d, delta); if (calIsShown(d)) moved++; }
        calAnchor = d;
    }
    calRenderAlt();
}
// נקרא מ-loadMonthlyCalendarGrid כשהתצוגה איננה "חודש"
async function calRenderAlt() {
    calSyncViewChrome();
    const view = calPrefs.view;
    if (!calAnchor) calAnchor = getLocalDateString();
    if (view === 'week' || view === '3day' || view === 'day') return calRenderTimeGrid(view);
    if (view === 'year') return calRenderYear();
    if (view === 'list') return calRenderList();
}
function calAltNavHtml(label, withArrows = true) {
    return `<div class="monthly-goal-nav cal-alt-nav">
        ${withArrows ? `<button type="button" class="monthly-goal-nav-btn" data-cal-nav="-1" aria-label="${calEsc(t('calv_prev'))}" title="${calEsc(t('calv_prev'))}">‹</button>` : ''}
        <span class="monthly-goal-month-label cal-alt-label">${label}</span>
        ${withArrows ? `<button type="button" class="monthly-goal-nav-btn" data-cal-nav="1" aria-label="${calEsc(t('calv_next'))}" title="${calEsc(t('calv_next'))}">›</button>` : ''}
    </div>`;
}
function calBindNav(root) {
    root.querySelectorAll('[data-cal-nav]').forEach(b => b.addEventListener('click', () => calNavigate(Number(b.dataset.calNav))));
}

// ---------- חודש: כותרות הימים והרשת (משמש את loadMonthlyCalendarGrid) ----------
function calMonthHeaderHtml() {
    const days = calShownWeekdays();
    return (calPrefs.weekNums ? '<span class="cal-weeknum-head" aria-hidden="true"></span>' : '') + days.map(d => `<span>${calEsc(t(weekdayShortKeys[d]))}</span>`).join('');
}
function calMonthColumns() { return (calPrefs.weekNums ? 'minmax(18px, auto) ' : '') + `repeat(${calShownWeekdays().length}, 1fr)`; }
// cellFn(dateObj, dateStr) => html של תא אמיתי; ימים מחוץ לחודש הם תאים ריקים
function calMonthGridHtml(y, m, cellFn) {
    const first = new Date(y, m - 1, 1), last = new Date(y, m, 0);
    const shown = calShownWeekdays();
    let cur = calDate(calWeekStart(getLocalDateString(first)));
    let html = '';
    while (cur <= last) {
        if (calPrefs.weekNums) html += `<span class="cal-weeknum" title="${calEsc(t('calv_week_n').replace('{n}', calIsoWeek(cur)))}">${calIsoWeek(cur)}</span>`;
        for (let i = 0; i < 7; i++) {
            const d = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + i);
            if (!shown.includes(d.getDay())) continue;
            html += d.getMonth() === m - 1 ? cellFn(d, getLocalDateString(d)) : '<div class="monthly-calendar-cell empty"></div>';
        }
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 7);
    }
    return html;
}
function calApplyMonthHeader() {
    const head = document.getElementById('monthly-calendar-weekdays');
    const grid = document.getElementById('monthly-calendar-grid');
    if (head) { head.innerHTML = calMonthHeaderHtml(); head.style.gridTemplateColumns = calMonthColumns(); }
    if (grid) grid.style.gridTemplateColumns = calMonthColumns();
}

// ---------- יום / 3 ימים / שבוע: רשת שעות ----------
function calTimeGridDates(view) {
    const a = calAnchor || getLocalDateString();
    if (view === 'day') return [a];
    if (view === 'week') {
        const start = calWeekStart(a);
        return [0, 1, 2, 3, 4, 5, 6].map(i => addDaysToDateStr(start, i)).filter(calIsShown);
    }
    const out = [];
    let d = calIsShown(a) ? a : addDaysToDateStr(a, 1), guard = 0;
    while (out.length < 3 && guard++ < 30) { if (calIsShown(d)) out.push(d); d = addDaysToDateStr(d, 1); }
    return out;
}
// עמודות "מסלולים" לפריטים חופפים באותו יום
function calLayoutLanes(items) {
    const sorted = [...items].sort((a, b) => a.start - b.start || calItemEnd(b) - calItemEnd(a));
    const clusters = [];
    let cluster = null, clusterEnd = -1;
    sorted.forEach(it => {
        if (!cluster || it.start >= clusterEnd) { cluster = { items: [], lanes: [] }; clusters.push(cluster); clusterEnd = -1; }
        let lane = cluster.lanes.findIndex(endMin => endMin <= it.start);
        if (lane < 0) { lane = cluster.lanes.length; cluster.lanes.push(0); }
        cluster.lanes[lane] = Math.max(calItemEnd(it), it.start + 20);
        it._lane = lane;
        cluster.items.push(it);
        clusterEnd = Math.max(clusterEnd, cluster.lanes[lane]);
    });
    clusters.forEach(c => c.items.forEach(it => { it._lanes = c.lanes.length; }));
    return sorted;
}
let calTgItems = {};
let calTgData = null;
async function calRenderTimeGrid(view) {
    const alt = document.getElementById('cal-alt-view');
    if (!alt) return;
    const dates = calTimeGridDates(view);
    if (!dates.length) return;
    const first = dates[0], last = dates[dates.length - 1];
    let label;
    if (view === 'day') label = calEsc(calFmtDate(first, { weekday: 'long', day: 'numeric', month: 'long' }));
    else label = calEsc(`${calFmtDate(first, { day: 'numeric', month: 'short' })} – ${calFmtDate(last, { day: 'numeric', month: 'short' })}`);
    if (calPrefs.weekNums && view !== 'day') label += ` <small class="cal-alt-weeknum">· ${calEsc(t('calv_week_n').replace('{n}', calIsoWeek(calDate(first))))}</small>`;
    const data = await calFetchRange(first, last);
    calTgData = data;
    // עמודה צרה (שבוע בטלפון): פריטים חופפים מדורגים זה על זה (כמו ביומנים רגילים) במקום רצועות צרות מדי לקריאה
    const colPx = ((alt.clientWidth || 340) - (calPrefs.clock === '12' ? 54 : 42)) / dates.length;
    calTgItems = {};
    const today = getLocalDateString();
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const gutter = calPrefs.clock === '12' ? 54 : 42;
    const cols = `${gutter}px repeat(${dates.length}, minmax(0, 1fr))`;
    let head = `<span class="cal-tg-corner"></span>`;
    let allday = `<span class="cal-tg-corner"></span>`;
    let body = `<div class="cal-tg-gutter">${Array.from({ length: 24 }, (_, h) => `<span class="cal-tg-hour" style="top:${h * CAL_HOUR_PX}px"><bdi dir="ltr">${calEsc(calFmtHour(h))}</bdi>${calPrefs.tz2 ? `<small dir="ltr">${calEsc(calTz2Time(first, h * 60))}</small>` : ''}</span>`).join('')}</div>`;
    dates.forEach(dateStr => {
        const wd = calWeekday(dateStr);
        const isToday = dateStr === today;
        head += `<button type="button" class="cal-tg-dayhead${isToday ? ' today' : ''}" data-cal-day="${dateStr}" aria-label="${calEsc(calFmtDate(dateStr, { weekday: 'long', day: 'numeric', month: 'long' }))}"><small>${calEsc(t(weekdayShortKeys[wd]))}</small><b>${calDate(dateStr).getDate()}</b></button>`;
        const items = calItemsForDate(dateStr, data);
        const untimed = items.filter(it => it.start === null);
        const timed = calLayoutLanes(items.filter(it => it.start !== null));
        allday += `<div class="cal-tg-allday-col" data-date="${dateStr}">${untimed.map(it => {
            const key = `${it.type}:${it.id}:${dateStr}`; calTgItems[key] = it;
            return `<button type="button" class="cal-tg-chip kind-${it.kind}${it.done ? ' is-done' : ''}${it.color ? ' calx-colored' : ''}${it.free ? ' is-free' : ''}" data-cal-item="${key}"${it.color ? ` style="--calx-c:${it.color}"` : ''}>${it.icon ? `<span aria-hidden="true">${it.icon}</span> ` : ''}${calEsc(it.title)}</button>`;
        }).join('')}</div>`;
        let col = '';
        timed.forEach(it => {
            const key = `${it.type}:${it.id}:${dateStr}`; calTgItems[key] = it;
            const end = calItemEnd(it);
            const top = it.start / 60 * CAL_HOUR_PX;
            const height = Math.max(20, (end - it.start) / 60 * CAL_HOUR_PX - 2);
            const cascade = it._lanes > 1 && colPx / it._lanes < 64;
            const w = 100 / it._lanes;
            const pos = cascade
                ? `inset-inline-start:calc(${it._lane * 16}% + 1px);width:calc(${100 - it._lane * 16}% - 2px);z-index:${1 + it._lane}`
                : `inset-inline-start:calc(${it._lane * w}% + 1px);width:calc(${w}% - 2px)`;
            const timeTxt = calRange(calFromMin(it.start), it.end !== null ? calFromMin(it.end) : '');
            col += `<button type="button" class="cal-ev kind-${it.kind}${it.done ? ' is-done' : ''}${height < 34 ? ' is-short' : ''}${cascade && it._lane ? ' is-stacked' : ''}${it.color ? ' calx-colored' : ''}${it.free ? ' is-free' : ''}" data-cal-item="${key}" style="top:${top}px;height:${height}px;${pos}${it.color ? `;--calx-c:${it.color}` : ''}">
                <small class="cal-ev-time">${calEsc(timeTxt)}</small><span class="cal-ev-title">${it.icon && it.kind !== 'task' ? `<span aria-hidden="true">${it.icon}</span> ` : ''}${calEsc(it.title)}</span></button>`;
        });
        if (isToday) col += `<span class="cal-tg-now" style="top:${nowMin / 60 * CAL_HOUR_PX}px" aria-hidden="true"></span>`;
        body += `<div class="cal-tg-col${isToday ? ' today' : ''}" data-date="${dateStr}">${col}</div>`;
    });
    alt.innerHTML = `${calAltNavHtml(label)}
        <div class="cal-tg cal-tg-${view}" style="--cal-cols:${cols};--cal-hour:${CAL_HOUR_PX}px">
            <div class="cal-tg-head">${head}</div>
            <div class="cal-tg-allday" aria-label="${calEsc(t('calv_allday'))}">${allday}</div>
            <div class="cal-tg-scroll"><div class="cal-tg-body" style="height:${24 * CAL_HOUR_PX}px">${body}</div></div>
        </div>`;
    calBindNav(alt);
    alt.querySelectorAll('[data-cal-day]').forEach(b => b.addEventListener('click', () => calSetView('day', b.dataset.calDay)));
    alt.querySelectorAll('.cal-tg-chip[data-cal-item]').forEach(b => b.addEventListener('click', () => calOpenItem(calTgItems[b.dataset.calItem])));
    alt.querySelectorAll('.cal-tg-col').forEach(col => calBindColumn(col));
    const scroller = alt.querySelector('.cal-tg-scroll');
    if (scroller) {
        const focusMin = dates.includes(today) ? Math.max(0, nowMin - 90) : 7 * 60;
        const timedMins = dates.flatMap(d => calItemsForDate(d, data).filter(it => it.start !== null).map(it => it.start));
        const firstItem = timedMins.length ? Math.min(...timedMins) : null;
        const target = dates.includes(today) ? focusMin : (firstItem !== null ? Math.min(firstItem - 30, 7 * 60) : 7 * 60);
        scroller.scrollTop = Math.max(0, target / 60 * CAL_HOUR_PX);
    }
}
// נגיעה בשטח ריק = הוספה בשעה הזו; נגיעה בפריט = עריכה; לחיצה ארוכה על אירוע = גרירה ליום/שעה אחרים
function calBindColumn(col) {
    col.addEventListener('click', e => {
        if (calDrag.justDropped) return;
        const item = e.target.closest('[data-cal-item]');
        if (item) { calOpenItem(calTgItems[item.dataset.calItem]); return; }
        const rect = col.getBoundingClientRect();
        const min = Math.floor(((e.clientY - rect.top) / CAL_HOUR_PX * 60) / 30) * 30;
        calOpenAddAt(col.dataset.date, calFromMin(min));
    });
    col.querySelectorAll('.cal-ev[data-cal-item]').forEach(ev => {
        const it = calTgItems[ev.dataset.calItem];
        if (it && it.type === 'event') ev.addEventListener('pointerdown', e => calDragStart(e, ev, it));
    });
}
function calOpenAddAt(dateStr, hhmm) {
    openAddEventForDate(dateStr);
    if (hhmm) {
        document.getElementById('calendar-event-time-input').value = hhmm;
        const endInput = document.getElementById('calendar-event-end-time-input');
        if (endInput) endInput.value = calFromMin(Math.min(1439, calToMin(hhmm) + calPrefs.dur));
    }
}

// --- גרירה (39) ---
const calDrag = { timer: null, active: false, it: null, el: null, ghost: null, startX: 0, startY: 0, offsetY: 0, justDropped: false };
function calDragStart(e, el, it) {
    if (e.button && e.button !== 0) return;
    calDragCancel();
    calDrag.it = it; calDrag.el = el; calDrag.startX = e.clientX; calDrag.startY = e.clientY;
    calDrag.offsetY = e.clientY - el.getBoundingClientRect().top;
    calDrag.timer = setTimeout(() => calDragActivate(e), 380);
    window.addEventListener('pointermove', calDragMove, { passive: false });
    window.addEventListener('pointerup', calDragEnd);
    window.addEventListener('pointercancel', calDragCancel);
    window.addEventListener('touchmove', calDragTouchBlock, { passive: false });
}
function calDragTouchBlock(e) { if (calDrag.active) e.preventDefault(); }
function calDragActivate(e) {
    calDrag.timer = null;
    if (!calDrag.el) return;
    calDrag.active = true;
    const r = calDrag.el.getBoundingClientRect();
    const ghost = calDrag.el.cloneNode(true);
    ghost.classList.add('cal-ev-ghost');
    ghost.style.cssText = `position:fixed;left:${r.left}px;top:${r.top}px;width:${r.width}px;height:${r.height}px;z-index:5000;pointer-events:none;`;
    document.body.appendChild(ghost);
    calDrag.ghost = ghost;
    calDrag.el.classList.add('is-dragging');
    if (navigator.vibrate) try { navigator.vibrate(12); } catch {}
}
function calDragMove(e) {
    if (!calDrag.el) return;
    if (!calDrag.active) {
        if (Math.abs(e.clientX - calDrag.startX) > 8 || Math.abs(e.clientY - calDrag.startY) > 8) calDragCancel();
        return;
    }
    e.preventDefault();
    const g = calDrag.ghost;
    if (g) { g.style.left = `${e.clientX - g.offsetWidth / 2}px`; g.style.top = `${e.clientY - calDrag.offsetY}px`; }
    document.querySelectorAll('.cal-tg-col.is-drop').forEach(c => c.classList.remove('is-drop'));
    const col = calColumnAt(e.clientX, e.clientY);
    if (col) col.classList.add('is-drop');
}
function calColumnAt(x, y) {
    const els = document.elementsFromPoint(x, y);
    for (const el of els) { const col = el.closest && el.closest('.cal-tg-col'); if (col) return col; }
    return null;
}
async function calDragEnd(e) {
    if (!calDrag.active) { calDragCancel(); return; }
    const it = calDrag.it;
    const col = calColumnAt(e.clientX, e.clientY);
    let target = null;
    if (col) {
        const rect = col.getBoundingClientRect();
        const min = Math.round(((e.clientY - calDrag.offsetY - rect.top) / CAL_HOUR_PX * 60) / 15) * 15;
        target = { date: col.dataset.date, min: Math.max(0, Math.min(1425, min)) };
    }
    calDragCancel();
    calDrag.justDropped = true;
    setTimeout(() => { calDrag.justDropped = false; }, 350);
    if (!target || !it || it.type !== 'event') return;
    if (target.date === it.date && target.min === it.start) return;
    const patch = { event_date: target.date, event_time: calFromMin(target.min) };
    if (it.end !== null && it.row.end_time) patch.end_time = calFromMin(Math.min(1439, target.min + (it.end - it.start)));
    const { error } = await supabaseClient.from('calendar_events').update(patch).eq('id', it.id);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    showAppToast(t('calv_moved').replace('{time}', `${calFmtDate(target.date, { weekday: 'short', day: 'numeric', month: 'short' })} ${calFmtTime(patch.event_time)}`));
    calRefreshAll();
}
function calDragCancel() {
    if (calDrag.timer) clearTimeout(calDrag.timer);
    calDrag.timer = null;
    if (calDrag.ghost) calDrag.ghost.remove();
    if (calDrag.el) calDrag.el.classList.remove('is-dragging');
    document.querySelectorAll('.cal-tg-col.is-drop').forEach(c => c.classList.remove('is-drop'));
    calDrag.active = false; calDrag.ghost = null; calDrag.el = null; calDrag.it = null;
    window.removeEventListener('pointermove', calDragMove);
    window.removeEventListener('pointerup', calDragEnd);
    window.removeEventListener('pointercancel', calDragCancel);
    window.removeEventListener('touchmove', calDragTouchBlock);
}

// ---------- שנה ----------
async function calRenderYear() {
    const alt = document.getElementById('cal-alt-view');
    if (!alt) return;
    const y = Number((calAnchor || getLocalDateString()).slice(0, 4));
    let marked = new Set();
    if (supabaseClient && currentUserId) {
        const data = await calFetchRange(`${y}-01-01`, `${y}-12-31`);
        // אירוע של כמה ימים - כל הימים שלו מסומנים
        data.events.forEach(r => {
            const end = typeof calxEnd === 'function' ? calxEnd(r) : r.event_date;
            for (let ds = r.event_date, g = 0; ds <= end && g < 400; ds = addDaysToDateStr(ds, 1), g++) marked.add(ds);
        });
    }
    const today = getLocalDateString();
    const shown = calShownWeekdays();
    const narrow = d => { try { return new Date(2023, 0, 1 + d).toLocaleDateString(currentLang, { weekday: 'narrow' }); } catch { return ''; } };
    const cols = `repeat(${shown.length}, 1fr)`;
    let html = '';
    for (let m = 1; m <= 12; m++) {
        const monthName = new Date(y, m - 1, 1).toLocaleDateString(currentLang, { month: 'long' });
        const cells = calMonthGridHtml(y, m, (d, ds) => `<button type="button" class="cal-y-day${ds === today ? ' today' : ''}${marked.has(ds) ? ' has' : ''}" data-cal-yday="${ds}" aria-label="${calEsc(calFmtDate(ds, { weekday: 'long', day: 'numeric', month: 'long' }))}">${d.getDate()}</button>`)
            .replace(/<span class="cal-weeknum"[^>]*>\d+<\/span>/g, '').replace(/<div class="monthly-calendar-cell empty"><\/div>/g, '<span class="cal-y-empty"></span>');
        html += `<div class="cal-y-month">
            <button type="button" class="cal-y-title" data-cal-ymonth="${y}-${String(m).padStart(2, '0')}">${calEsc(monthName)}</button>
            <div class="cal-y-grid" style="grid-template-columns:${cols}">${shown.map(d => `<span class="cal-y-wd" aria-hidden="true">${calEsc(narrow(d))}</span>`).join('')}${cells}</div>
        </div>`;
    }
    alt.innerHTML = `${calAltNavHtml(calEsc(String(y)))}<div class="cal-year">${html}</div>`;
    calBindNav(alt);
    alt.querySelectorAll('[data-cal-yday]').forEach(b => b.addEventListener('click', () => calSetView('day', b.dataset.calYday)));
    alt.querySelectorAll('[data-cal-ymonth]').forEach(b => b.addEventListener('click', () => calSetView('month', `${b.dataset.calYmonth}-01`)));
}

// ---------- רשימה (סדר יום) ----------
let calListFrom = null, calListTo = null;
async function calRenderList(extend) {
    const alt = document.getElementById('cal-alt-view');
    if (!alt) return;
    const today = getLocalDateString();
    if (!calListFrom || !extend) { calListFrom = today; calListTo = addDaysToDateStr(today, 29); }
    if (extend === 'more') calListTo = addDaysToDateStr(calListTo, 30);
    if (extend === 'earlier') calListFrom = addDaysToDateStr(calListFrom, -30);
    const data = await calFetchRange(calListFrom, calListTo);
    const byDate = new Map();
    data.events.forEach(e => {
        // אירוע של כמה ימים - בכל יום שלו בטווח
        const end = typeof calxEnd === 'function' ? calxEnd(e) : e.event_date;
        for (let ds = e.event_date < calListFrom ? calListFrom : e.event_date, g = 0; ds <= end && ds <= calListTo && g < 400; ds = addDaysToDateStr(ds, 1), g++) byDate.set(ds, true);
    });
    const dates = [...byDate.keys()].sort();
    calTgItems = {};
    const tomorrow = addDaysToDateStr(today, 1);
    let html = `<button type="button" class="cal-list-more is-earlier" data-cal-list="earlier">‹ ${calEsc(t('calv_earlier'))}</button>`;
    if (!dates.length) html += `<p class="today-tasks-empty cal-list-empty">${calEsc(t('calv_list_empty'))}</p>`;
    dates.forEach(dateStr => {
        const items = calItemsForDate(dateStr, data, false);
        const rel = dateStr === today ? t('calv_rel_today') : dateStr === tomorrow ? t('calv_rel_tomorrow') : '';
        html += `<div class="cal-list-day${dateStr === today ? ' today' : ''}${dateStr < today ? ' is-past' : ''}">
            <button type="button" class="cal-list-date" data-cal-day="${dateStr}"><b>${calEsc(calFmtDate(dateStr, { weekday: 'long', day: 'numeric', month: 'long' }))}</b>${rel ? `<small>${calEsc(rel)}</small>` : ''}</button>
            ${items.map(it => {
                const key = `${it.type}:${it.id}:${dateStr}`; calTgItems[key] = it;
                const sub = [it.multi, it.row && it.row.meeting_with, it.row && it.row.location].filter(Boolean).join(' · ');
                return `<button type="button" class="cal-list-item kind-${it.kind}${it.done ? ' is-done' : ''}${it.color ? ' calx-colored' : ''}" data-cal-item="${key}"${it.color ? ` style="--calx-c:${it.color}"` : ''}>
                    <span class="cal-list-time">${it.start !== null ? calEsc(calRange(calFromMin(it.start), it.end !== null ? calFromMin(it.end) : '')) : calEsc(t('calv_allday'))}</span>
                    <span class="cal-list-text"><span>${it.icon ? `<span aria-hidden="true">${it.icon}</span> ` : ''}${calEsc(it.title)}</span>${sub ? `<small>${calEsc(sub)}</small>` : ''}</span>
                </button>`;
            }).join('')}
        </div>`;
    });
    html += `<button type="button" class="cal-list-more" data-cal-list="more">${calEsc(t('calv_more'))} ›</button>`;
    alt.innerHTML = `${calAltNavHtml(calEsc(`${calFmtDate(calListFrom, { day: 'numeric', month: 'short' })} – ${calFmtDate(calListTo, { day: 'numeric', month: 'short', year: 'numeric' })}`), false)}<div class="cal-list">${html}</div>`;
    alt.querySelectorAll('[data-cal-list]').forEach(b => b.addEventListener('click', () => calRenderList(b.dataset.calList)));
    alt.querySelectorAll('[data-cal-day]').forEach(b => b.addEventListener('click', () => calSetView('day', b.dataset.calDay)));
    alt.querySelectorAll('[data-cal-item]').forEach(b => b.addEventListener('click', () => calOpenItem(calTgItems[b.dataset.calItem])));
}

// ---------- חיפוש ביומן (42) ----------
let calSearchTimer = null, calSearchSeq = 0;
function calToggleSearch(force) {
    const panel = document.getElementById('cal-search-panel');
    if (!panel) return;
    const open = force !== undefined ? force : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !open);
    document.getElementById('cal-tool-search')?.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { const input = document.getElementById('cal-search-input'); if (input) { input.focus(); calRunSearch(); } }
}
function calOnSearchInput() { clearTimeout(calSearchTimer); calSearchTimer = setTimeout(calRunSearch, 280); }
async function calRunSearch() {
    const input = document.getElementById('cal-search-input');
    const out = document.getElementById('cal-search-results');
    if (!input || !out) return;
    const q = input.value.trim().replace(/[%_,()"\\*:]/g, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 2) { out.innerHTML = ''; return; }
    const seq = ++calSearchSeq;
    const like = `%${q}%`;
    const [{ data: events }, { data: fixed }] = await Promise.all([
        supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).not('source', 'in', CAL_INTERNAL_SOURCES)
            .or(`event_title.ilike.${like},notes.ilike.${like},location.ilike.${like},meeting_with.ilike.${like}`).order('event_date', { ascending: true }).limit(80),
        supabaseClient.from('weekly_schedule').select('*').eq('user_id', currentUserId).ilike('task_title', like).limit(20),
    ]);
    if (seq !== calSearchSeq) return;
    const today = getLocalDateString();
    const evs = events || [];
    const upcoming = evs.filter(e => e.event_date >= today);
    const past = evs.filter(e => e.event_date < today).reverse();
    calTgItems = {};
    const row = e => {
        const it = calItemsForDate(e.event_date, { events: [e], fixed: [] }, false)[0];
        const key = `event:${e.id}:${e.event_date}`; calTgItems[key] = it;
        return `<button type="button" class="cal-list-item kind-${it.kind}${it.done ? ' is-done' : ''}" data-cal-item="${key}">
            <span class="cal-list-time">${calEsc(calFmtDate(e.event_date, { day: 'numeric', month: 'short', year: e.event_date.slice(0, 4) !== today.slice(0, 4) ? 'numeric' : undefined }))}</span>
            <span class="cal-list-text"><span>${it.icon ? `<span aria-hidden="true">${it.icon}</span> ` : ''}${calEsc(it.title)}</span>${it.start !== null ? `<small>${calEsc(calRange(calFromMin(it.start), it.end !== null ? calFromMin(it.end) : ''))}</small>` : ''}</span>
        </button>`;
    };
    const fixedRows = (fixed || []).filter(r => String(r.task_title || '').trim()).map(r => {
        const key = `fixed:${r.id}:x`;
        calTgItems[key] = { type: 'fixed', id: r.id, row: r };
        const wd = dbDaysMap.indexOf(r.day_of_week);
        return `<button type="button" class="cal-list-item kind-fixed" data-cal-item="${key}"><span class="cal-list-time">🔁 ${calEsc(wd >= 0 ? t(dayNameKeys[wd]) : '')}</span><span class="cal-list-text"><span>${calEsc(r.task_title)}</span>${r.time_of_day ? `<small>${calEsc(calFmtTime(r.time_of_day))}</small>` : ''}</span></button>`;
    });
    let html = '';
    if (upcoming.length) html += `<div class="cal-search-group">${calEsc(t('calv_search_upcoming'))}</div>${upcoming.map(row).join('')}`;
    if (fixedRows.length) html += `<div class="cal-search-group">${calEsc(t('calv_search_fixed'))}</div>${fixedRows.join('')}`;
    if (past.length) html += `<div class="cal-search-group">${calEsc(t('calv_search_past'))}</div>${past.map(row).join('')}`;
    out.innerHTML = html || `<p class="today-tasks-empty">${calEsc(t('calv_search_none'))}</p>`;
    out.querySelectorAll('[data-cal-item]').forEach(b => b.addEventListener('click', () => {
        const it = calTgItems[b.dataset.calItem];
        if (it && it.type === 'event') { calAnchor = it.date; if (calPrefs.view === 'month') { viewedCalendarMonthKey = it.date.slice(0, 7); selectedCalendarDay = it.date; } loadMonthlyCalendarGrid(); }
        calOpenItem(it);
    }));
}

// ---------- אזהרת חפיפה (43) ----------
// מחזיר את מה שכבר יש באותו זמן (אירועים עם שעה + משימות קבועות עם שעה); excludeId - האירוע שנערך עכשיו
async function calFindOverlaps(dateStr, startHHMM, endHHMM, excludeId) {
    const start = calToMin(startHHMM);
    if (start === null || !supabaseClient || !currentUserId) return [];
    const end = calToMin(endHHMM) !== null && calToMin(endHHMM) > start ? calToMin(endHHMM) : Math.min(1440, start + calPrefs.dur);
    const data = await calFetchRange(dateStr, dateStr);
    // "פנוי" (יומן שלב 2) לא מתנגש בכלום
    return calItemsForDate(dateStr, data).filter(it => it.start !== null && !it.free && !(it.type === 'event' && it.id === excludeId) && it.start < end && calItemEnd(it) > start);
}
let calOverlapResolve = null;
function calConfirmOverlap(items) {
    return new Promise(resolve => {
        calOverlapResolve = resolve;
        const list = document.getElementById('cal-overlap-list');
        if (list) list.innerHTML = items.slice(0, 4).map(it => `<div class="cal-overlap-row"><bdi dir="ltr">${calEsc(calRange(calFromMin(it.start), it.end !== null ? calFromMin(it.end) : ''))}</bdi><span>${it.icon ? `${it.icon} ` : ''}${calEsc(it.title)}</span></div>`).join('');
        document.getElementById('modal-cal-overlap').classList.add('open');
    });
}
function calOverlapAnswer(ok) {
    document.getElementById('modal-cal-overlap').classList.remove('open');
    const r = calOverlapResolve; calOverlapResolve = null;
    if (r) r(!!ok);
}

// ---------- ביטול אחרי מחיקה (41) ----------
let calUndoTimer = null, calUndoFn = null;
const CAL_STRIP_ON_RESTORE = ['id', 'created_at', 'updated_at', 'google_event_id', 'google_etag', 'google_updated', 'google_synced_at', 'google_calendar_id', 'last_notified_date'];
function calShowUndo(message, fn) {
    const toast = document.getElementById('cal-undo-toast');
    if (!toast) return;
    calUndoFn = fn;
    document.getElementById('cal-undo-text').textContent = message;
    toast.classList.add('show');
    clearTimeout(calUndoTimer);
    calUndoTimer = setTimeout(calHideUndo, 7000);
}
function calHideUndo() { document.getElementById('cal-undo-toast')?.classList.remove('show'); calUndoFn = null; }
async function calUndoNow() {
    const fn = calUndoFn;
    calHideUndo();
    if (fn) { await fn(); calRefreshAll(); showAppToast(t('calv_restored')); }
}
// שורות שנמחקו מ-calendar_events חוזרות כשורות חדשות (בלי מזהי Google - הסנכרון יוצר אותן מחדש)
function calRestoreEventsFn(rows) {
    const clean = (rows || []).map(r => { const c = { ...r }; CAL_STRIP_ON_RESTORE.forEach(k => delete c[k]); return c; });
    return async () => { if (clean.length) await supabaseClient.from('calendar_events').insert(clean); };
}
function calRestoreFixedFn(row) {
    if (!row) return null;
    const c = { ...row }; ['id', 'created_at', 'updated_at', 'last_notified_date'].forEach(k => delete c[k]);
    return async () => { await supabaseClient.from('weekly_schedule').insert(c); };
}

// ---------- מציאת זמן פנוי (44) ----------
let calFreeLen = 60, calFreeFrom = '08:00', calFreeTo = '20:00';
function calOpenFreeTime() {
    calRenderFreeTime();
    openModal('modal-cal-free');
}
async function calRenderFreeTime() {
    const box = document.getElementById('cal-free-body');
    if (!box) return;
    const lens = [30, 60, 90, 120];
    const custom = !lens.includes(calFreeLen);
    const today = getLocalDateString();
    const end = addDaysToDateStr(today, 6);
    const from = calToMin(calFreeFrom) ?? 480, to = calToMin(calFreeTo) ?? 1200;
    const data = await calFetchRange(today, end);
    const now = new Date(); const nowMin = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 15) * 15;
    const days = [];
    for (let i = 0; i < 7; i++) {
        const dateStr = addDaysToDateStr(today, i);
        if (!calIsShown(dateStr)) continue;
        const busy = calItemsForDate(dateStr, data).filter(it => it.start !== null && !it.free).map(it => [it.start, calItemEnd(it)]).sort((a, b) => a[0] - b[0]);
        let cursor = i === 0 ? Math.max(from, nowMin) : from;
        const windows = [];
        busy.forEach(([s, e]) => {
            if (s - cursor >= calFreeLen && cursor < to) windows.push([cursor, Math.min(s, to)]);
            cursor = Math.max(cursor, e);
        });
        if (to - cursor >= calFreeLen) windows.push([cursor, to]);
        const fit = windows.filter(([s, e]) => e - s >= calFreeLen);
        if (fit.length) days.push({ dateStr, windows: fit });
    }
    box.innerHTML = `
        <div class="cal-set-label">${calEsc(t('calv_free_len'))}</div>
        <div class="cal-chip-row">${lens.map(l => `<button type="button" class="cal-chip${calFreeLen === l ? ' on' : ''}" data-free-len="${l}">${calEsc(calFmtMinutes(l))}</button>`).join('')}<button type="button" class="cal-chip${custom ? ' on' : ''}" data-free-len="other">${calEsc(t('calv_other'))}</button></div>
        <input type="number" min="5" max="720" class="cal-num-input${custom ? '' : ' hidden'}" id="cal-free-len-custom" value="${custom ? calFreeLen : ''}" placeholder="${calEsc(t('calv_minutes_ph'))}">
        <div class="cal-set-label">${calEsc(t('calv_free_hours'))}</div>
        <div class="cal-free-hours"><input type="text" id="cal-free-from" value="${calEsc(calFreeFrom)}" inputmode="numeric" aria-label="${calEsc(t('calv_free_from'))}"><span aria-hidden="true">–</span><input type="text" id="cal-free-to" value="${calEsc(calFreeTo)}" inputmode="numeric" aria-label="${calEsc(t('calv_free_to'))}"></div>
        <div class="cal-free-list">${days.length ? days.map(d => `<div class="cal-free-day"><div class="cal-free-date">${calEsc(calFmtDate(d.dateStr, { weekday: 'long', day: 'numeric', month: 'short' }))}</div>
            <div class="cal-chip-row">${d.windows.map(([s, e]) => `<button type="button" class="cal-chip cal-free-slot" data-free-date="${d.dateStr}" data-free-start="${calFromMin(s)}" aria-label="${calEsc(t('calv_free_add'))} ${calEsc(calRange(calFromMin(s), calFromMin(e)))}">${calEsc(calRange(calFromMin(s), calFromMin(e)))}</button>`).join('')}</div></div>`).join('')
            : `<p class="today-tasks-empty">${calEsc(t('calv_free_none'))}</p>`}</div>`;
    box.querySelectorAll('[data-free-len]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.freeLen === 'other') { document.getElementById('cal-free-len-custom').classList.remove('hidden'); document.getElementById('cal-free-len-custom').focus(); box.querySelectorAll('[data-free-len]').forEach(x => x.classList.toggle('on', x === b)); return; }
        calFreeLen = Number(b.dataset.freeLen); calRenderFreeTime();
    }));
    const lenInput = document.getElementById('cal-free-len-custom');
    lenInput.addEventListener('change', () => { const v = parseInt(lenInput.value); if (v >= 5 && v <= 720) { calFreeLen = v; calRenderFreeTime(); } });
    ['cal-free-from', 'cal-free-to'].forEach(id => document.getElementById(id).addEventListener('change', e => {
        const n = normalizeScheduleTimeInput(e.target.value);
        if (n.time) { if (id === 'cal-free-from') calFreeFrom = n.time; else calFreeTo = n.time; }
        calRenderFreeTime();
    }));
    box.querySelectorAll('.cal-free-slot').forEach(b => b.addEventListener('click', () => {
        closeModal('modal-cal-free');
        calOpenAddAt(b.dataset.freeDate, b.dataset.freeStart);
    }));
}

// ---------- שכפול מהיר (40) ----------
// ⧉ ליד כל אירוע ברשימת היום: פותח את אותו אירוע לעריכה, ישר על בחירת תאריך חדש - "שכפול" שומר עותק בתאריך שנבחר
async function calQuickDuplicate(item) {
    await openEditCalendarEvent(item);
    const modal = document.getElementById('modal-add-calendar-event');
    modal.classList.add('is-duplicating');
    modal.querySelector('h3').textContent = t('calv_dup_title');
    const dup = document.getElementById('btn-duplicate-calendar-event');
    dup.classList.remove('btn-secondary');
    dup.classList.add('btn-primary');
    setTimeout(() => openDateFieldPicker('calendar-event-date-input'), 150);
}

// ---------- הגדרות יומן (6-12) ----------
function calOpenSettings() {
    calRenderSettings();
    const settingsOpen = document.getElementById('modal-settings-drawer')?.classList.contains('open');
    if (settingsOpen) document.getElementById('modal-cal-settings').classList.add('open');
    else openModal('modal-cal-settings');
}
function calCloseSettings() {
    document.getElementById('modal-cal-settings').classList.remove('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper && !document.querySelector('.apple-modal.open')) wrapper.classList.remove('modal-open');
    if (document.getElementById('schedule-section')?.classList.contains('active-tab')) loadMonthlyCalendarGrid();
}
function calRenderSettings() {
    const box = document.getElementById('cal-settings-body');
    if (!box) return;
    const p = calPrefs;
    const durs = [15, 30, 45, 60, 90, 120];
    const rems = [0, 10, 30, 60, 1440];
    const chip = (attr, val, on, label) => `<button type="button" class="cal-chip${on ? ' on' : ''}" ${attr}="${val}" aria-pressed="${on ? 'true' : 'false'}">${label}</button>`;
    const deviceTz = calDeviceTz();
    box.innerHTML = `
        ${typeof calxOpenCalendars === 'function' ? `<button type="button" class="calx-cals-open" id="calx-cals-open-btn"><span class="calx-dots" aria-hidden="true">${['#a78bfa', '#f472b6', '#60a5fa'].map(c => `<span class="monthly-calendar-dot" style="background:${c}"></span>`).join('')}</span><span>${calEsc(t('calx_cals_title'))}</span><span aria-hidden="true">›</span></button>` : ''}
        <div class="cal-set-label">${calEsc(t('calv_set_first'))}</div>
        <div class="cal-chip-row">${[0, 1, 6].map(d => chip('data-first', d, p.firstDay === d, calEsc(t(dayNameKeys[d])))).join('')}</div>
        <div class="cal-set-label">${calEsc(t('calv_set_days'))}</div>
        <div class="cal-chip-row cal-days-row">${[0, 1, 2, 3, 4, 5, 6].map(i => (p.firstDay + i) % 7).map(d => chip('data-day', d, p.days.includes(d), calEsc(t(weekdayShortKeys[d])))).join('')}</div>
        <div class="cal-set-label">${calEsc(t('calv_set_clock'))}</div>
        <div class="cal-chip-row">${chip('data-clock', '24', p.clock === '24', `<bdi dir="ltr">17:00</bdi>`)}${chip('data-clock', '12', p.clock === '12', `<bdi dir="ltr">${calEsc(new Date(2000, 0, 1, 17, 0).toLocaleTimeString(currentLang, { hour: 'numeric', minute: '2-digit', hour12: true }))}</bdi>`)}</div>
        <div class="settings-toggle-row cal-set-toggle">
            <label class="settings-label" for="cal-weeknums-toggle">${calEsc(t('calv_set_weeknums'))}</label>
            <label class="switch"><input type="checkbox" id="cal-weeknums-toggle" ${p.weekNums ? 'checked' : ''}><span class="switch-slider"></span></label>
        </div>
        <div class="cal-set-label">${calEsc(t('calv_set_dur'))}</div>
        <div class="cal-chip-row">${durs.map(d => chip('data-dur', d, p.dur === d, calEsc(calFmtMinutes(d)))).join('')}${chip('data-dur', 'other', !durs.includes(p.dur), calEsc(t('calv_other')))}</div>
        <input type="number" min="5" max="720" id="cal-dur-custom" class="cal-num-input${durs.includes(p.dur) ? ' hidden' : ''}" value="${durs.includes(p.dur) ? '' : p.dur}" placeholder="${calEsc(t('calv_minutes_ph'))}">
        <div class="cal-set-label">${calEsc(t('calv_set_rem'))}</div>
        <div class="cal-chip-row">${rems.map(r => chip('data-rem', r, p.rem === r, calEsc(r ? calFmtMinutes(r) : t('calv_rem_none')))).join('')}${chip('data-rem', 'other', !rems.includes(p.rem), calEsc(t('calv_other')))}</div>
        <input type="number" min="1" max="40320" id="cal-rem-custom" class="cal-num-input${rems.includes(p.rem) ? ' hidden' : ''}" value="${rems.includes(p.rem) ? '' : p.rem}" placeholder="${calEsc(t('calv_minutes_ph'))}">
        <div class="cal-set-label">${calEsc(t('calv_set_tz'))}</div>
        <div class="cal-tz-device"><bdi>${calEsc(deviceTz ? calTzLabel(deviceTz) : '—')}</bdi></div>
        <div class="cal-set-label">${calEsc(t('calv_set_tz2'))}</div>
        <div class="cal-chip-row">${chip('data-tz2', '', !p.tz2, calEsc(t('calv_tz2_none')))}${p.tz2 ? chip('data-tz2', p.tz2, true, `<bdi>${calEsc(calTzLabel(p.tz2))}</bdi>`) : ''}</div>
        <label class="cal-search-field">${CAL_SEARCH_ICON}<input type="search" id="cal-tz2-search" placeholder="${calEsc(t('calv_tz2_search'))}" aria-label="${calEsc(t('calv_tz2_search'))}" autocomplete="off" enterkeyhint="search"></label>
        <div id="cal-tz2-results" class="cal-tz-results"></div>`;
    box.querySelector('#calx-cals-open-btn')?.addEventListener('click', () => calxOpenCalendars(false));
    box.querySelectorAll('[data-first]').forEach(b => b.addEventListener('click', () => { calSavePrefs({ firstDay: Number(b.dataset.first) }); calRenderSettings(); }));
    box.querySelectorAll('[data-day]').forEach(b => b.addEventListener('click', () => {
        const d = Number(b.dataset.day);
        const days = calPrefs.days.includes(d) ? calPrefs.days.filter(x => x !== d) : [...calPrefs.days, d];
        if (!days.length) return;
        calSavePrefs({ days }); calRenderSettings();
    }));
    box.querySelectorAll('[data-clock]').forEach(b => b.addEventListener('click', () => { calSavePrefs({ clock: b.dataset.clock }); calRenderSettings(); }));
    document.getElementById('cal-weeknums-toggle').addEventListener('change', e => calSavePrefs({ weekNums: e.target.checked }));
    const bindOther = (attr, inputId, key, max) => {
        box.querySelectorAll(`[${attr}]`).forEach(b => b.addEventListener('click', () => {
            const v = b.getAttribute(attr);
            if (v === 'other') {
                const input = document.getElementById(inputId);
                input.classList.remove('hidden'); input.focus();
                box.querySelectorAll(`[${attr}]`).forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
                return;
            }
            calSavePrefs({ [key]: Number(v) }); calRenderSettings();
        }));
        const input = document.getElementById(inputId);
        input.addEventListener('change', () => { const v = parseInt(input.value); if (v >= 1 && v <= max) calSavePrefs({ [key]: v }); });
    };
    bindOther('data-dur', 'cal-dur-custom', 'dur', 720);
    bindOther('data-rem', 'cal-rem-custom', 'rem', 40320);
    box.querySelectorAll('[data-tz2]').forEach(b => b.addEventListener('click', () => { calSavePrefs({ tz2: b.dataset.tz2 }); calRenderSettings(); }));
    const search = document.getElementById('cal-tz2-search');
    search.addEventListener('input', () => calRenderTzResults(search.value));
}
let calTzList = null;
function calRenderTzResults(q) {
    const out = document.getElementById('cal-tz2-results');
    if (!out) return;
    const query = String(q || '').trim().toLowerCase();
    if (query.length < 2) { out.innerHTML = ''; return; }
    if (!calTzList) {
        let ids = [];
        try { ids = Intl.supportedValuesOf('timeZone'); } catch { ids = ['UTC', 'Europe/London', 'Europe/Paris', 'America/New_York', 'America/Los_Angeles', 'Asia/Jerusalem', 'Asia/Tokyo', 'Australia/Sydney']; }
        calTzList = ids.map(id => ({ id, label: calTzLabel(id) }));
    }
    const hits = calTzList.filter(z => z.id.toLowerCase().replace(/_/g, ' ').includes(query) || z.label.toLowerCase().includes(query)).slice(0, 12);
    out.innerHTML = hits.map(z => `<button type="button" class="cal-tz-row" data-tz="${calEsc(z.id)}"><bdi>${calEsc(z.label)}</bdi><small dir="ltr">${calEsc(new Date().toLocaleTimeString(currentLang, { timeZone: z.id, hour: 'numeric', minute: '2-digit', hour12: calPrefs.clock === '12' }))}</small></button>`).join('')
        || `<p class="today-tasks-empty">${calEsc(t('calv_search_none'))}</p>`;
    out.querySelectorAll('[data-tz]').forEach(b => b.addEventListener('click', () => { calSavePrefs({ tz2: b.dataset.tz }); calRenderSettings(); }));
}

// ---------- אזור זמן נוסף בחלון האירוע ----------
// מתחת לשדה השעה: "= 10:00 בניו יורק" כשבחרו אזור זמן נוסף
function calUpdateEventTz2Hint() {
    const el = document.getElementById('calendar-event-tz2');
    if (!el) return;
    const time = normalizeScheduleTimeInput(document.getElementById('calendar-event-time-input')?.value || '').time;
    const date = document.getElementById('calendar-event-date-input')?.value || getLocalDateString();
    if (!calPrefs.tz2 || !time) { el.textContent = ''; el.classList.add('hidden'); return; }
    el.textContent = t('calv_tz2_at').replace('{time}', calTz2Time(date, calToMin(time))).replace('{place}', calTzLabel(calPrefs.tz2).split(' · ')[0]);
    el.classList.remove('hidden');
}

// ---------- אתחול ----------
document.addEventListener('DOMContentLoaded', () => {
    // מעבר בין תצוגות שומר על המקום: מהחודש - היום שנבחר (או תחילת החודש שמוצג), משאר התצוגות - התאריך שלהן
    document.querySelectorAll('#cal-view-chips .cal-view-chip').forEach(chip => chip.addEventListener('click', () => {
        if (chip.dataset.view === calPrefs.view) return;
        const today = getLocalDateString();
        const anchor = calPrefs.view === 'month'
            ? (selectedCalendarDay || (viewedCalendarMonthKey && viewedCalendarMonthKey !== currentMonthKey() ? `${viewedCalendarMonthKey}-01` : today))
            : (calAnchor || today);
        calSetView(chip.dataset.view, anchor);
    }));
    ['calendar-event-time-input', 'calendar-event-date-input'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.addEventListener('input', calUpdateEventTz2Hint); el.addEventListener('change', calUpdateEventTz2Hint); }
    });
    calSyncViewChrome();
});
