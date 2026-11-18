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
        // כל הטאבים של היום ביחד (לפי בקשה מפורשת, 2026-11-15: "אם זה היום שלו הוא צריך להתווסף ולרשום בקטן איזה טאב
        // זה"): טאב עם ימים - בימים שלו, טאב בלי ימים - כל יום (וכל פריט לפי הימים שלו). ביום חופש - רק טאב ימי החופש
        const dayOff = tabs.find(tb => tb.day_off && routineTabWeekdays(tb).includes(todayIdx));
        const todayTabs = dayOff ? [dayOff] : tabs.filter(tb => !tb.day_off && (!routineTabWeekdays(tb).length || routineTabWeekdays(tb).includes(todayIdx)));
        // ביום חופש הכל חופש - חוץ ממה שנקבע במפורש ליום הזה (📅 ימים לפריט שכוללים את היום, בכל טאב אחר).
        // לפי בקשה מפורשת, 2026-11-15: "שיהיה הכל חופש חוץ מהדבר היחיד הזה שכן קבעתי שיהיה באותו היום"
        const pinnedTabs = dayOff ? tabs.filter(tb => !tb.day_off) : [];
        const pinnedToday = it => {
            if (String(it.days_of_week || '').trim() === '' || typeof routineItemDays !== 'function') return false;
            const d = routineItemDays(it);
            return d.length < 7 && d.includes(todayIdx);
        };
        const queryTabs = todayTabs.concat(pinnedTabs);
        if (!queryTabs.length) return empty;
        const { data: rawRows } = await supabaseClient.from('routine_items').select('*').in('tab_id', queryTabs.map(tb => tb.id)).eq('user_id', currentUserId).eq('kind', 'scheduled');
        const rows = dayOff ? (rawRows || []).filter(it => it.tab_id === dayOff.id || pinnedToday(it)) : rawRows;
        // אימון מטבלת האימונים שנמצא גם בשגרה - כבר בצ'יפ ליד המים, לא פעמיים
        if (typeof workoutPlanLoaded !== 'undefined' && !workoutPlanLoaded && typeof loadWorkoutPlan === 'function') await loadWorkoutPlan();
        // כל פריט עם כותרת - גם בשעה מדויקת (16:10), בדיוק כמו בלוח של "השגרה שלי" (שם פריט לא נעלם לעולם).
        // ארוחות שהוסתרו כי הן כבר בתפריט של New Me - לא מופיעות פעמיים
        // ופריט עם ימים משלו (📅 ימים לפריט) - רק בימים שלו
        const tabOrder = new Map(tabs.map((tb, i) => [tb.id, i]));
        const seen = new Set();
        const items = (rows || []).filter(it => (it.title || '').trim() && !(typeof routineItemInNewMe === 'function' && routineItemInNewMe(it)) && !(typeof routineItemIsWorkout === 'function' && routineItemIsWorkout(it)) && (typeof routineItemOnDay !== 'function' || routineItemOnDay(it, todayIdx)))
            // אותו פריט בשני טאבים (טאב לכל יום "כהעתק") - פעם אחת, מהטאב הראשון
            .sort((a, b) => (tabOrder.get(a.tab_id) ?? 99) - (tabOrder.get(b.tab_id) ?? 99))
            .filter(it => { const k = `${String(it.time || '').slice(0, 5)}|${it.title.trim().toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true; });
        const checksOn = isRoutineGoalsOn();
        let doneIds = new Set();
        if (checksOn && items.length) {
            const { data: checks } = await supabaseClient.from('routine_item_checkins').select('item_id').in('item_id', items.map(it => it.id)).eq('checkin_date', todayStr);
            doneIds = new Set((checks || []).map(c => c.item_id));
        }
        // הערה ו"לא היום" ליד כל וי (2026-11-18)
        const notes = items.length ? await loadRoutineDayNotes(items.map(it => it.id), todayStr) : new Map();
        // שם הטאב בקטן - לכל טאב חוץ מהראשי (הראשון), כשיותר מטאב אחד מופיע היום
        const mainId = tabs[0] ? tabs[0].id : null;
        const names = new Map(queryTabs.map(tb => [tb.id, tb.name]));
        // ביום חופש - הדבר שנקבע ליום הזה מטאב אחר מראה את שם הטאב שלו
        const tabOf = it => (dayOff ? (it.tab_id !== dayOff.id ? names.get(it.tab_id) || null : null)
            : (todayTabs.length > 1 && it.tab_id !== mainId ? names.get(it.tab_id) || null : null));
        return { items, doneIds, checksOn, tab: todayTabs[0], tabOf, notes };
    } catch (e) {
        console.error('my day routine failed', e);
        return empty;
    }
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
    // ✓ על פריט שסומן "לא היום" - כן נעשה, אז "לא היום" יורד (ההערה נשארת)
    if (checked) await routineClearSkip(item.id, todayStr);
    if (item.vision_milestone_id) await syncGoalFromRoutineCheck(item.vision_milestone_id, todayStr, checked);
    if (item.vision_goal_id) await syncGoalSmallStepFromRoutine(item.vision_goal_id, todayStr, checked);
    if (checked && typeof routineNudge !== 'undefined' && routineNudge && routineNudge.itemIds.includes(item.id)) { routineNudge = null; renderRoutineNudge(); }
    const board = document.getElementById('modal-daily-board');
    if (board && board.classList.contains('open')) renderDailyBoard();
    loadTodayTasks();
}

// --- 🔗 בלוקים בשגרה, והערה ו"לא היום" ליד כל וי (לפי בקשה מפורשת, 2026-11-18: "שכל 7 עד 7:30 יהיה ביחד... ואז זה
// יהיה וי אחד", "הערות בצד של כל וי בפוקוס ובשגרה"; נבחרה אפשרות 2 - בלוק שנפתח). בלוק = פריטים באותו טאב עם אותו
// routine_items.block_name. ההערה של היום ו"לא היום" - routine_item_day_notes (שורה רק כשיש משהו). "לא היום" לא
// נספר כנעשה וגם לא כנשאר; ✓ מוריד אותו ---
const routineDayNotesCache = new Map(); // `${item_id}|${date}` → { skipped, note }
async function loadRoutineDayNotes(ids, dateStr) {
    const map = new Map();
    if (!ids.length || !supabaseClient) return map;
    try {
        const { data, error } = await supabaseClient.from('routine_item_day_notes').select('item_id, skipped, note').in('item_id', ids).eq('note_date', dateStr);
        if (error) return map;
        ids.forEach(id => routineDayNotesCache.delete(`${id}|${dateStr}`));
        (data || []).forEach(r => {
            const v = { skipped: !!r.skipped, note: r.note || '' };
            map.set(r.item_id, v);
            routineDayNotesCache.set(`${r.item_id}|${dateStr}`, v);
        });
    } catch { /* בלי הערות - הכל עובד כרגיל */ }
    return map;
}
async function saveRoutineDayNote(itemId, dateStr, skipped, note) {
    const text = String(note || '').trim().slice(0, 200);
    const key = `${itemId}|${dateStr}`;
    let res;
    if (!skipped && !text) {
        res = await supabaseClient.from('routine_item_day_notes').delete().eq('item_id', itemId).eq('note_date', dateStr).eq('user_id', currentUserId);
        if (!res.error) routineDayNotesCache.delete(key);
    } else {
        res = await supabaseClient.from('routine_item_day_notes').upsert({ item_id: itemId, user_id: currentUserId, note_date: dateStr, skipped: !!skipped, note: text || null, updated_at: new Date().toISOString() }, { onConflict: 'item_id,note_date' });
        if (!res.error) routineDayNotesCache.set(key, { skipped: !!skipped, note: text });
    }
    return res;
}
async function routineClearSkip(itemId, dateStr) {
    const cur = routineDayNotesCache.get(`${itemId}|${dateStr}`);
    if (cur && cur.skipped) await saveRoutineDayNote(itemId, dateStr, false, cur.note);
}
// ✓ לכל מה שנשאר בבלוק בבת אחת: שמירה אחת ורענון אחד (לא 5 רענונים)
async function myDayToggleRoutineMany(routineItems) {
    if (!routineItems.length) return;
    const todayStr = getLocalDateString();
    const ids = routineItems.map(it => it.id);
    const { data: existing } = await supabaseClient.from('routine_item_checkins').select('item_id').in('item_id', ids).eq('checkin_date', todayStr);
    const have = new Set((existing || []).map(r => r.item_id));
    const rows = routineItems.filter(it => !have.has(it.id)).map(it => ({ item_id: it.id, user_id: currentUserId, checkin_date: todayStr }));
    if (rows.length) {
        const { error } = await supabaseClient.from('routine_item_checkins').insert(rows);
        if (error) { console.error('routine block checkin failed', error); showAppToast(t('error_not_connected'), 'error'); loadTodayTasks(); return; }
    }
    for (const it of routineItems) {
        if (it.vision_milestone_id) await syncGoalFromRoutineCheck(it.vision_milestone_id, todayStr, true);
        if (it.vision_goal_id) await syncGoalSmallStepFromRoutine(it.vision_goal_id, todayStr, true);
    }
    if (typeof routineNudge !== 'undefined' && routineNudge && routineItems.some(it => routineNudge.itemIds.includes(it.id))) { routineNudge = null; renderRoutineNudge(); }
    const board = document.getElementById('modal-daily-board');
    if (board && board.classList.contains('open')) renderDailyBoard();
    loadTodayTasks();
}
// שמות מוכנים לבלוק (ותמיד גם "אחר" - שם חופשי)
// חלקי היום קודם (לפי בקשה מפורשת, 2026-11-18: "בוקר לבוקר וצהריים לצהריים"), ואחריהם לפני / אחרי העבודה
function routineBlockPresetNames() { return ['routine_block_morning', 'routine_block_noon', 'routine_block_afternoon', 'routine_block_evening', 'routine_block_before_work', 'routine_block_after_work'].map(k => t(k)); }
function routineBlockSuggestName(minutes) { return t(minutes < 12 * 60 ? 'routine_block_morning' : minutes < 15 * 60 ? 'routine_block_noon' : minutes < 18 * 60 ? 'routine_block_afternoon' : 'routine_block_evening'); }

// דף קטן מלמטה (בתוך מסגרת האפליקציה, מעל הפוקוס ו"השגרה שלי")
function routineSheet(html, label) {
    document.querySelectorAll('.rdn-layer').forEach(x => x.remove());
    const host = document.querySelector('.phone-wrapper') || document.body;
    const layer = document.createElement('div');
    layer.className = 'rdn-layer';
    layer.innerHTML = `<div class="rdn-card" role="dialog" aria-modal="true" aria-label="${myDayEsc(label)}">${html}</div>`;
    layer.addEventListener('click', e => { if (e.target === layer) layer.remove(); });
    layer.addEventListener('keydown', e => { if (e.key === 'Escape') layer.remove(); });
    host.appendChild(layer);
    return layer;
}
// ✏️ הערה להיום ליד וי: "לא היום" (מצב), בחירות מהירות לטקסט ("חלקית", "מאוחר יותר", "אחר" = כותבים לבד)
function openRoutineDayNote({ itemId, title, done, uncheck }) {
    const dateStr = getLocalDateString();
    const cur = routineDayNotesCache.get(`${itemId}|${dateStr}`) || { skipped: false, note: '' };
    let skipped = cur.skipped;
    const quick = ['routine_note_partly', 'routine_note_later'].map(k => t(k));
    const layer = routineSheet(`
        <h3 class="rdn-title">${myDayEsc(t('routine_note_title'))}<small>${myDayEsc(title)}</small></h3>
        <div class="rdn-chips">
            <button type="button" class="rdn-chip rdn-skip${skipped ? ' on' : ''}" aria-pressed="${skipped}">${myDayEsc(t('routine_skip_today'))}</button>
            ${quick.map(q => `<button type="button" class="rdn-chip rdn-quick" data-q="${myDayEsc(q)}" aria-pressed="false">${myDayEsc(q)}</button>`).join('')}
            <button type="button" class="rdn-chip rdn-other" aria-pressed="false">${myDayEsc(t('nm_other'))}</button>
        </div>
        <input type="text" class="rdn-input" maxlength="200" value="${myDayEsc(cur.note)}" placeholder="${myDayEsc(t('routine_note_ph'))}" aria-label="${myDayEsc(t('routine_note_title'))}">
        <div class="rdn-actions"><button type="button" class="btn-primary rdn-save">${myDayEsc(t('save_generic'))}</button><button type="button" class="btn-secondary rdn-close">${myDayEsc(t('close_btn'))}</button></div>`, t('routine_note_title'));
    const input = layer.querySelector('.rdn-input');
    const skipBtn = layer.querySelector('.rdn-skip');
    const markQuick = () => layer.querySelectorAll('.rdn-quick').forEach(b => { const on = input.value.trim() === b.dataset.q; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    skipBtn.onclick = () => { skipped = !skipped; skipBtn.classList.toggle('on', skipped); skipBtn.setAttribute('aria-pressed', String(skipped)); };
    layer.querySelectorAll('.rdn-quick').forEach(b => { b.onclick = () => { input.value = b.dataset.q; markQuick(); }; });
    layer.querySelector('.rdn-other').onclick = () => { input.value = ''; markQuick(); input.focus(); };
    input.addEventListener('input', markQuick);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); layer.querySelector('.rdn-save').click(); } });
    markQuick();
    layer.querySelector('.rdn-close').onclick = () => layer.remove();
    layer.querySelector('.rdn-save').onclick = async e => {
        e.currentTarget.disabled = true;
        const { error } = await saveRoutineDayNote(itemId, dateStr, skipped, input.value);
        if (error) { console.error('routine note failed', error); showAppToast(t('error_not_connected'), 'error'); e.currentTarget.disabled = false; return; }
        layer.remove();
        // "לא היום" על משהו שסומן ✓ - הוי יורד (אחד או השני)
        if (skipped && done && uncheck) { await uncheck(); return; }
        const board = document.getElementById('modal-daily-board');
        if (board && board.classList.contains('open')) renderDailyBoard();
        loadTodayTasks();
    };
    setTimeout(() => (skipped || cur.note ? input : skipBtn).focus(), 60);
}
// 🔗 שם לבלוק: השמות המוכנים, "אחר" (שם חופשי), ולבלוק קיים גם "לפרק" (הפריטים חוזרים להיות נפרדים, שום דבר לא נמחק)
function openRoutineBlockSheet({ current, suggested, onSave, onSplit }) {
    const names = [...new Set(routineBlockPresetNames().concat(current ? [current] : []))];
    let picked = current || suggested || names[0];
    const isPreset = n => names.includes(n);
    const layer = routineSheet(`
        <h3 class="rdn-title">${myDayEsc(t(current ? 'routine_block_edit_title' : 'routine_block_name_title'))}</h3>
        <div class="rdn-chips">${names.map(n => `<button type="button" class="rdn-chip rdn-name" data-n="${myDayEsc(n)}">${myDayEsc(n)}</button>`).join('')}<button type="button" class="rdn-chip rdn-other">${myDayEsc(t('nm_other'))}</button></div>
        <input type="text" class="rdn-input hidden" maxlength="40" placeholder="${myDayEsc(t('routine_block_name_ph'))}" aria-label="${myDayEsc(t('routine_block_name_ph'))}">
        <div class="rdn-actions"><button type="button" class="btn-primary rdn-save">${myDayEsc(t(current ? 'save_generic' : 'routine_block_join'))}</button>${onSplit ? `<button type="button" class="btn-secondary rdn-split">${myDayEsc(t('routine_block_split'))}</button>` : `<button type="button" class="btn-secondary rdn-close">${myDayEsc(t('close_btn'))}</button>`}</div>`, t('routine_block_name_title'));
    const input = layer.querySelector('.rdn-input');
    const sync = () => layer.querySelectorAll('.rdn-name').forEach(b => { const on = input.classList.contains('hidden') && b.dataset.n === picked; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    layer.querySelectorAll('.rdn-name').forEach(b => { b.onclick = () => { picked = b.dataset.n; input.classList.add('hidden'); layer.querySelector('.rdn-other').classList.remove('on'); sync(); }; });
    layer.querySelector('.rdn-other').onclick = e => { input.classList.remove('hidden'); e.currentTarget.classList.add('on'); sync(); input.focus(); };
    if (picked && !isPreset(picked)) { input.value = picked; input.classList.remove('hidden'); layer.querySelector('.rdn-other').classList.add('on'); }
    sync();
    const closeBtn = layer.querySelector('.rdn-close');
    if (closeBtn) closeBtn.onclick = () => layer.remove();
    const splitBtn = layer.querySelector('.rdn-split');
    if (splitBtn) splitBtn.onclick = async () => { splitBtn.disabled = true; await onSplit(); layer.remove(); };
    layer.querySelector('.rdn-save').onclick = async e => {
        const name = (input.classList.contains('hidden') ? picked : input.value).trim().slice(0, 40);
        if (!name) { input.focus(); return; }
        e.currentTarget.disabled = true;
        await onSave(name);
        layer.remove();
    };
    setTimeout(() => (layer.querySelector('.rdn-name.on') || layer.querySelector('button')).focus(), 60);
}
// שמירת שם הבלוק לכמה פריטים (null = לפרק)
async function setRoutineItemsBlock(ids, name) {
    if (!ids.length) return true;
    const { error } = await supabaseClient.from('routine_items').update({ block_name: name || null }).in('id', ids).eq('user_id', currentUserId);
    if (error) { console.error('routine block failed', error); showAppToast(t('error_not_connected'), 'error'); return false; }
    if (typeof dailyBoardItemsCache !== 'undefined') dailyBoardItemsCache.forEach(it => { if (ids.includes(it.id)) it.block_name = name || null; });
    const board = document.getElementById('modal-daily-board');
    if (board && board.classList.contains('open')) renderDailyBoard();
    loadTodayTasks();
    return true;
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
    // צעד של יעד שמקושר גם לשגרה (routine_items.vision_goal_id / vision_milestone_id) מופיע פעם אחת בלבד: שורת היעד, בשעה
    // שלו בשגרה (לפי בקשה מפורשת, 2026-10-21: "תשים אותו רק במקום אחד"). ✓ עליה מסמן גם בשגרה (הסנכרון של היעדים)
    const goalLinkKey = (goalId, milestoneId) => (milestoneId ? `m:${milestoneId}` : `g:${goalId}`);
    const goalKeys = new Set(goalItems.filter(gi => gi.goalId).map(gi => goalLinkKey(gi.goalId, gi.milestoneId)));
    // כמה שורות בשגרה לאותו צעד (שכפול לשונית / פריט): השעה המוקדמת ביותר
    const routineLinked = new Map();
    const routineTimeOf = it => String(it.time || '99:99');
    (routine.items || []).forEach(it => {
        const k = it.vision_milestone_id ? `m:${it.vision_milestone_id}` : it.vision_goal_id ? `g:${it.vision_goal_id}` : null;
        const cur = k && routineLinked.get(k);
        if (k && goalKeys.has(k) && (!cur || routineTimeOf(it) < routineTimeOf(cur))) routineLinked.set(k, it);
    });
    const routineLinkedIds = new Set((routine.items || []).filter(it => {
        const k = it.vision_milestone_id ? `m:${it.vision_milestone_id}` : it.vision_goal_id ? `g:${it.vision_goal_id}` : null;
        return k && routineLinked.has(k);
    }).map(it => it.id));
    goalItems.forEach(gi => {
        const linked = gi.goalId ? routineLinked.get(goalLinkKey(gi.goalId, gi.milestoneId)) : null;
        const linkedTime = linked ? String(linked.time || '').slice(0, 5) : '';
        items.push({
            // גם בסינון "שגרה" - הוא חלק מהשגרה (בלי זה הפריט נעלם שם לגמרי)
            kind: 'task', group: 'tasks', alsoGroup: linked ? 'routine' : null, minutes: linkedTime ? scheduleTimeToMinutes(linkedTime) : (gi.time ? scheduleTimeToMinutes(gi.time) : null), done: !!gi.done, checkable: true, title: gi.text, toggle: checked => gi.toggle(checked),
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
                time.textContent = linkedTime;
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
        if (routineLinkedIds.has(it.id)) return;
        const done = routine.doneIds.has(it.id);
        const time = String(it.time || '').slice(0, 5);
        // 🔗 הבלוק שלו, ו"לא היום" / הערה של היום (2026-11-18)
        const dn = (routine.notes && routine.notes.get(it.id)) || null;
        const skipped = !!(routine.checksOn && dn && dn.skipped && !done);
        const baseTag = routine.tabOf && routine.tabOf(it) ? `${t('myday_filter_routine')} · ${routine.tabOf(it)}` : t('myday_filter_routine');
        items.push({
            kind: 'routine', group: 'routine', minutes: scheduleTimeToMinutes(time), done: routine.checksOn ? done : false, checkable: routine.checksOn,
            title: it.title, toggle: checked => myDayToggleRoutine(it, checked),
            routineItem: it, tabId: it.tab_id, blockName: String(it.block_name || '').trim() || null, skipped, note: dn ? dn.note : '',
            build: () => {
                const row = myDayRow({
                    done: routine.checksOn && done, time, text: `${myDayIcon(it.title)}${it.title}`,
                    tag: skipped ? `${t('routine_skip_today')}${dn.note ? ` · ${dn.note}` : ''}` : dn && dn.note ? `${baseTag} · ${dn.note}` : baseTag,
                    kindClass: 'routine', onchange: routine.checksOn ? checked => myDayToggleRoutine(it, checked) : null,
                });
                if (skipped) row.classList.add('is-skipped');
                return row;
            },
        });
    });
    (newMeItems || []).forEach(nm => {
        items.push({
            kind: 'newme', group: null, minutes: scheduleTimeToMinutes(nm.time), done: !!nm.done, checkable: true, title: nm.text, toggle: checked => nm.toggle(checked),
            build: () => myDayRow({
                done: !!nm.done, time: nm.time, text: nm.text, tag: NM_NAME, kindClass: 'newme', onchange: checked => nm.toggle(checked), hint: nm.full,
                onopen: typeof nmOpenMealDetails === 'function' ? () => nmOpenMealDetails(nm.slot) : null,
            }),
        });
    });
    return items;
}

// שורה אחת בציר: [שעה] [נקודה] [טקסט + תגית] [✓]
function myDayRow({ done, time, text, withName, tag, kindClass, onchange, onopen, hint }) {
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
    // מעבר עכבר - כל הטקסט (למשל בדיוק מה אוכלים בארוחה של New Me)
    if (hint) main.title = hint;
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
    const open = items.filter(it => !it.done && it.checkable && !it.skipped);
    const timed = open.filter(it => it.minutes !== null).sort((a, b) => a.minutes - b.minutes);
    const current = timed.filter(it => it.minutes <= now && now - it.minutes <= 120).pop();
    if (current) return { item: current, label: 'now' };
    const next = timed.find(it => it.minutes > now);
    if (next) return { item: next, label: 'next' };
    const untimed = open.find(it => it.minutes === null);
    if (untimed) return { item: untimed, label: 'later' };
    // נשאר רק מה שעבר מזמן ולא סומן - מראים אותו ("קודם"), ולא "סיימת הכול" (לפי בקשה מפורשת: "לא סיימתי את כל המשימות")
    const missed = timed.filter(it => it.minutes <= now).pop();
    if (missed) return { item: missed, label: 'earlier' };
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
    const shown = items.filter(it => myDayFilter === 'all' || it.group === myDayFilter || it.alsoGroup === myDayFilter);
    if (!shown.length) {
        container.insertAdjacentHTML('beforeend', `<p class="today-tasks-empty">${myDayEsc(t('myday_filter_empty'))}</p>`);
        return;
    }
    const untimed = shown.filter(it => it.minutes === null);
    const timed = shown.filter(it => it.minutes !== null).sort((a, b) => a.minutes - b.minutes);
    if (untimed.length) {
        const box = document.createElement('div');
        box.className = 'myday-untimed';
        // בלי כותרת "בלי שעה" (לפי בקשה מפורשת: "לא צריך לרשום שם כלום") - רק הפריטים
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
    const groups = new Set(items.flatMap(it => [it.group, it.alsoGroup]).filter(Boolean));
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

// --- המגירה הסגורה בתחתית הבית: כמה בוצע ומה עכשיו (עם ✓); המים - צ'יפ קטן ליד הכותרת ---
function renderMyDayBar(items) {
    const countEl = document.getElementById('myday-bar-count');
    // "לא היום" לא נספר - לא כנעשה ולא כנשאר
    const total = items.filter(it => it.checkable && !it.skipped).length;
    const done = items.filter(it => it.checkable && it.done).length;
    // כמה בוצע - רק כשפותחים את "היום שלי" (לפי בקשה מפורשת, 2026-10-20: המספרים בפס הסגור התנגשו עם האימון)
    const sheetCount = document.getElementById('myday-sheet-count');
    if (sheetCount) sheetCount.textContent = total ? t('myday_count').replace('{done}', done).replace('{total}', total) : '';
    if (countEl) countEl.textContent = '';
    const nextEl = document.getElementById('myday-bar-next');
    if (!nextEl) return;
    const pick = myDayPickNow(items);
    if (!pick) {
        // רק ארוחות של New Me (בלי משימות) - שורה שקטה במקום "כל הכבוד, סיימת את כל המשימות" (ר' loadTodayTasks)
        const onlyMeals = total > 0 && items.every(it => !it.checkable || it.kind === 'newme');
        nextEl.innerHTML = `<span class="myday-bar-empty">${myDayEsc(!total ? t('myday_bar_empty') : onlyMeals ? t('myday_meals_all_done') : t('today_tasks_all_done_message'))}</span>`;
        return;
    }
    const label = t(pick.label === 'now' ? 'myday_now' : pick.label === 'next' ? 'myday_next' : pick.label === 'earlier' ? 'myday_earlier' : 'myday_later');
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
// מתג "הצגת המים ב'היום שלי'" בהגדרות > התאמה אישית ויומן (לפי בקשה מפורשת, 2026-10-14) - דלוק כברירת מחדל,
// נשמר ב-user_premium.myday_water_enabled כדי שיהיה אותו דבר בכל המכשירים
function isMyDayWaterOn() {
    try { return localStorage.getItem('weekwise_myday_water') !== 'false'; } catch (e) { return true; }
}
function applyMyDayWaterSetting() {
    const on = isMyDayWaterOn();
    const tile = document.getElementById('myday-water-tile');
    if (tile) tile.classList.toggle('hidden', !on);
    const toggle = document.getElementById('myday-water-toggle');
    if (toggle) toggle.checked = on;
}
async function loadMyDayWaterSetting() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('user_premium').select('myday_water_enabled').eq('user_id', currentUserId).maybeSingle();
    if (!data || data.myday_water_enabled === null || data.myday_water_enabled === undefined) return;
    try { localStorage.setItem('weekwise_myday_water', String(data.myday_water_enabled)); } catch (e) { /* בלי אחסון מקומי - רק מה-DB */ }
    applyMyDayWaterSetting();
}
async function toggleMyDayWater() {
    const enabled = document.getElementById('myday-water-toggle').checked;
    try { localStorage.setItem('weekwise_myday_water', String(enabled)); } catch (e) { /* כנ"ל */ }
    applyMyDayWaterSetting();
    if (supabaseClient && currentUserId) {
        await supabaseClient.from('user_premium').upsert({ user_id: currentUserId, username: currentUsername, myday_water_enabled: enabled }, { onConflict: 'user_id' });
    }
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
// המראה = 46 "מהצד בניאון" (בחירה 2026-11-02): כרטיס זכוכית עם קו ניאון, ומה שבא אחריו מציץ מהצד.
// הכרטיסים שמאחור הם חפיסה: נגיעה בהם, החלקה של הכרטיס הצידה או חץ במקלדת מביאים את הבא קדימה, ואחרי
// האחרון חוזרים לעכשיו (לפי שאלה מפורשת: "איך אני רואה את הכרטיסיה הבאה?")
let homeFocusShownKey = '';
let homeFocusPeekKey = '';   // הכרטיס שהובא קדימה בדפדוף ('' = הדבר של עכשיו)
let homeFocusDeck = [];
function homeFocusKey(item) { return `${item.title}|${item.minutes}`; }
function isHomeFocusOn() { return document.body.classList.contains('home-focus-on'); }
// [x, y, רדיוס, השהיה בשניות, זהב] - הכוכבים של מצב המנוחה בפוקוס
const HOME_FOCUS_STARS = [[40, 40, 2.2, 0], [200, 30, 2.2, 0.9], [180, 150, 2.2, 1.7], [60, 150, 2.2, 0.9], [120, 24, 2.2, 1.7], [90, 96, 3, 0, true], [150, 80, 2.6, 0.9, true], [132, 120, 2, 1.7]];
// persist=false: פתיחה/סגירה רגעית (הסיור, מעבר ליעד מתוך הפוקוס) שלא משנה את הבחירה. הבחירה נשמרת במכשיר (localStorage,
// לא sessionStorage) - כך שהפוקוס נשאר גם אחרי יציאה מהאפליקציה וכניסה חזרה, עד שלוחצים ✕ (לפי בקשה מפורשת, 2026-11-17)
const HOME_FOCUS_KEY = 'weekwise_home_focus';
function homeFocusSaved() { try { return localStorage.getItem(HOME_FOCUS_KEY) === '1'; } catch { return false; } }
function homeFocusRestore() { if (homeFocusSaved() && !isHomeFocusOn()) toggleHomeFocus(true, false); }
function toggleHomeFocus(force, persist = true) {
    const on = typeof force === 'boolean' ? force : !isHomeFocusOn();
    document.body.classList.toggle('home-focus-on', on);
    if (persist) { try { localStorage.setItem(HOME_FOCUS_KEY, on ? '1' : '0'); } catch {} }
    const layer = document.getElementById('home-focus-layer');
    if (layer) layer.classList.toggle('hidden', !on);
    if (on) { homeFocusShownKey = ''; homeFocusPeekKey = ''; renderHomeFocus(); }
}
// ◎ פוקוס = רשימה של היום (לפי בקשה מפורשת, 2026-11-17: "שיהיה כמו רשימה - מה שסיימתי ממש בקטן עם וי ומה שנשאר יראה
// כמובן", ולמעלה "מטרה קטנה לסוף השנה... עד 2 מטרות"). מה שסומן קטן ודהוי עם ✓, מה שנשאר בגודל מלא עם עיגול לסימון,
// והדבר של עכשיו מודגש. המטרות: מה שבחרו (עד 2, נשמר במכשיר), ואם לא בחרו - היעדים שהתאריך שלהם עד סוף השנה
const HOME_FOCUS_GOALS_MAX = 2;
function homeFocusGoalsKey() { return `weekwise_focus_goals_${currentUserId}`; }
function homeFocusChosenGoalIds() {
    try { const v = JSON.parse(localStorage.getItem(homeFocusGoalsKey()) || 'null'); return Array.isArray(v) ? v : null; } catch { return null; }
}
function homeFocusActiveGoals() { return (typeof visionGoalsCache !== 'undefined' ? visionGoalsCache : []).filter(g => !g.is_achieved); }
// הבחירה נשמרת כרשימה: מזהה של יעד מ"היעדים שלי", או { t: 'טקסט' } - מטרה שנכתבה ביד (לפי בקשה מפורשת, 2026-11-17:
// "2 מטרות שאפשר לרשום ידנית - עד 2 מטרות עיקריות"). בסך הכל עד 2
function homeFocusGoals() {
    const goals = homeFocusActiveGoals();
    const saved = homeFocusChosenGoalIds();
    if (saved) {
        return saved.map(x => (x && typeof x === 'object' && x.t ? { own: true, title: String(x.t) } : goals.find(g => g.id === x))).filter(Boolean).slice(0, HOME_FOCUS_GOALS_MAX);
    }
    if (typeof visionHorizon !== 'function' || typeof visionEffectiveDeadline !== 'function') return [];
    return goals.filter(g => visionHorizon(g) !== 'life')
        .sort((x, y) => String(visionEffectiveDeadline(x)).localeCompare(String(visionEffectiveDeadline(y))))
        .slice(0, HOME_FOCUS_GOALS_MAX);
}
function homeFocusDaysTo(dateStr) {
    const end = new Date(dateStr + 'T00:00:00'), now = new Date();
    now.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((end - now) / 86400000));
}
function homeFocusGoalsHtml() {
    const goals = homeFocusGoals();
    const yearEnd = `${new Date().getFullYear()}-12-31`;
    const head = `<div class="hf-goals-head"><span>🎯 ${myDayEsc(t('home_focus_goals_title'))} <small>· ${myDayEsc(t('home_focus_days_left').replace('{n}', homeFocusDaysTo(yearEnd)))}</small></span><button type="button" class="hf-goals-pick" onclick="openHomeFocusGoalPicker()">${myDayEsc(t(goals.length ? 'home_focus_goals_change' : 'home_focus_goals_choose'))}</button></div>`;
    if (!goals.length) return `<section class="hf-goals is-empty">${head}</section>`;
    const rows = goals.map(g => {
        // מטרה שנכתבה ביד: השם וכמה ימים עד סוף השנה; נגיעה פותחת את הבחירה
        // 🏮 "פנס" (בחירה 2026-11-18, רעיון 12: "תזכורת המטרה - פנס"): בלי יד ובלי קופסה - רק המילים עם הילה רכה
        // מאחוריהן, בצבע של הערכה (אף פעם לא צהוב קבוע ביעדים)
        if (g.own) return `<button type="button" class="hf-goal is-own is-lantern" onclick="openHomeFocusGoalPicker()"><span class="hf-goal-title">${myDayEsc(g.title)}</span></button>`;
        const p = typeof visionGoalProgress === 'function' ? visionGoalProgress(g) : { pct: 0, label: '' };
        const deadline = typeof visionEffectiveDeadline === 'function' ? visionEffectiveDeadline(g) : null;
        const meta = [p.label || '', deadline && deadline <= yearEnd ? t('home_focus_days_left').replace('{n}', homeFocusDaysTo(deadline)) : ''].filter(Boolean).join(' · ');
        const icon = typeof visionGoalIcon === 'function' ? visionGoalIcon(g) : '🎯';
        return `<button type="button" class="hf-goal" onclick="toggleHomeFocus(false, false); openGoalsVisionDrawer('${g.id}')">
            <span class="hf-goal-top"><span class="hf-goal-icon" aria-hidden="true">${myDayEsc(icon)}</span><span class="hf-goal-title">${myDayEsc(g.title)}</span><span class="hf-goal-pct">${p.pct}%</span></span>
            <span class="hf-goal-bar" aria-hidden="true"><i style="width:${p.pct}%"></i></span>
            ${meta ? `<span class="hf-goal-meta">${myDayEsc(meta)}</span>` : ''}
        </button>`;
    }).join('');
    return `<section class="hf-goals">${head}${rows}</section>`;
}
function openHomeFocusGoalPicker() {
    const layer = document.getElementById('home-focus-layer');
    if (!layer) return;
    layer.querySelectorAll('.hf-pick').forEach(x => x.remove());
    const goals = homeFocusActiveGoals();
    const current = homeFocusGoals();
    const chosen = new Set(current.filter(g => !g.own).map(g => g.id));
    const own = current.filter(g => g.own).map(g => g.title).concat(['', '']).slice(0, HOME_FOCUS_GOALS_MAX);
    const box = document.createElement('div');
    box.className = 'hf-pick';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', t('home_focus_goals_title'));
    box.innerHTML = `<div class="hf-pick-card"><h3>🎯 ${myDayEsc(t('home_focus_goals_pick_title'))}</h3>
        ${goals.length ? `<div class="hf-pick-list">${goals.map(g => `<button type="button" class="hf-pick-item${chosen.has(g.id) ? ' is-on' : ''}" data-id="${g.id}" aria-pressed="${chosen.has(g.id)}"><span class="hf-pick-box" aria-hidden="true"></span><span>${myDayEsc((typeof visionGoalIcon === 'function' ? visionGoalIcon(g) + ' ' : '') + g.title)}</span></button>`).join('')}</div>` : ''}
        <div class="hf-pick-own-head">✍️ ${myDayEsc(t(goals.length ? 'home_focus_goals_own' : 'home_focus_goals_own_only'))}</div>
        <div class="hf-pick-own">${own.map((v, i) => `<input type="text" class="hf-pick-input" data-i="${i}" maxlength="80" value="${myDayEsc(v)}" placeholder="${myDayEsc(t('home_focus_goal_own_ph'))}" aria-label="${myDayEsc(t('home_focus_goal_own_ph'))}">`).join('')}</div>
        <div class="hf-pick-actions"><button type="button" class="btn-primary hf-pick-save">${myDayEsc(t('home_focus_goals_save'))}</button><button type="button" class="btn-secondary hf-pick-close">${myDayEsc(t('close_btn'))}</button></div></div>`;
    const inputs = [...box.querySelectorAll('.hf-pick-input')];
    // בסך הכל עד 2: כשכבר יש 2 (יעדים מסומנים + מה שנכתב) - השאר ננעלים עד שמורידים אחד
    const sync = () => {
        const written = inputs.filter(x => x.value.trim()).length;
        const full = chosen.size + written >= HOME_FOCUS_GOALS_MAX;
        box.querySelectorAll('.hf-pick-item').forEach(b => {
            const on = chosen.has(b.dataset.id);
            b.classList.toggle('is-on', on);
            b.setAttribute('aria-pressed', String(on));
            b.disabled = full && !on;
        });
        inputs.forEach(x => { x.disabled = full && !x.value.trim(); });
    };
    box.querySelectorAll('.hf-pick-item').forEach(b => b.addEventListener('click', () => {
        if (chosen.has(b.dataset.id)) chosen.delete(b.dataset.id);
        else if (chosen.size + inputs.filter(x => x.value.trim()).length < HOME_FOCUS_GOALS_MAX) chosen.add(b.dataset.id);
        sync();
    }));
    inputs.forEach(x => x.addEventListener('input', sync));
    sync();
    box.querySelector('.hf-pick-close').onclick = () => box.remove();
    box.addEventListener('click', e => { if (e.target === box) box.remove(); });
    box.querySelector('.hf-pick-save').onclick = () => {
        const list = [...chosen].concat(inputs.map(x => x.value.trim()).filter(Boolean).map(text => ({ t: text }))).slice(0, HOME_FOCUS_GOALS_MAX);
        try { localStorage.setItem(homeFocusGoalsKey(), JSON.stringify(list)); } catch {}
        box.remove();
        renderHomeFocus();
    };
    layer.appendChild(box);
    (box.querySelector('.hf-pick-item:not(:disabled)') || inputs.find(x => !x.disabled) || box.querySelector('button')).focus();
}
// 🔗 בלוקים בפוקוס (בחירה 2026-11-18, אפשרות 2 "בלוק שנפתח"): פריטי שגרה מאותו טאב עם אותו שם בלוק (לפחות 2 היום) -
// כרטיס אחד במקום הראשון שלהם. סגור: עיגול אחד מסמן את כל מה שנשאר; נגיעה בשם פותחת - וי לכל דבר, ✏️ הערה ו"לא היום".
// כשהכל נעשה (או "לא היום") - שורה קטנה אחת "5 מתוך 5". הספירה למעלה סופרת כל דבר בנפרד
const homeFocusOpenBlocks = new Set();
const HF_CHECK = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const HF_DASH = '<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M6 12h12" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round"/></svg>';
const HF_PENCIL = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/></svg>';
const HF_CHEV = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
const HF_LINK = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/></svg>';
function homeFocusBlocks(items) {
    const map = new Map();
    items.forEach(it => {
        if (it.kind !== 'routine' || !it.blockName || !it.routineItem) return;
        const key = `${it.tabId}|${it.blockName}`;
        if (!map.has(key)) map.set(key, { key, name: it.blockName, items: [] });
        map.get(key).items.push(it);
    });
    const list = [...map.values()].filter(b => b.items.length >= 2);
    const byItem = new Map();
    list.forEach((b, idx) => { b.idx = idx; b.items.forEach(it => byItem.set(it, b)); });
    return { list, byItem };
}
// בסיור, בתוך הפוקוס: בלוק לדוגמה כשעוד אין בלוקים (לפי בקשה מפורשת, 2026-11-18: "שתהיה דוגמא וגם את הסיור")
function homeFocusDemoOn() { return typeof appTourActive !== 'undefined' && appTourActive && typeof appTourCtx !== 'undefined' && appTourCtx === 'focus'; }
function homeFocusRange(its) {
    const mins = its.map(x => x.minutes).filter(m => m !== null && m !== undefined);
    return mins.length ? `${myDayFormatMinutes(Math.min(...mins))}–${myDayFormatMinutes(Math.max(...mins))}` : '';
}
function homeFocusBlockHtml(b, items, pick, demo) {
    const its = b.items;
    const total = its.length, done = its.filter(x => x.done).length, skip = its.filter(x => x.skipped).length;
    const checkable = !!its[0].checkable;
    const rest = its.filter(x => x.checkable && !x.done && !x.skipped);
    const range = homeFocusRange(its);
    const rangeHtml = range ? `<bdi dir="ltr">${range}</bdi>` : '';
    const meta = [checkable ? t('hf_block_count').replace('{done}', done).replace('{total}', total) : t('hf_block_things').replace('{n}', total), skip ? t('hf_block_skipped').replace('{n}', skip) : ''].filter(Boolean).join(' · ');
    const open = demo || homeFocusOpenBlocks.has(b.key);
    const name = myDayEsc(b.name);
    const at = demo ? '' : ` data-b="${b.idx}"`;
    if (checkable && !rest.length && !open) {
        const dots = its.map(x => `<i${x.done ? '' : ' class="off"'}></i>`).join('');
        return `<li class="hf-row is-done hf-block-done"><button type="button" class="hf-undo" data-hf="toggle"${at} aria-expanded="false" aria-label="${myDayEsc(t('hf_block_open_aria').replace('{name}', b.name))}">${HF_CHECK}</button>${range ? `<span class="hf-time">${rangeHtml}</span>` : ''}<span class="hf-title">${name} · ${myDayEsc(meta)}</span><span class="hf-dots" aria-hidden="true">${dots}</span>${its.some(x => x.note) ? `<span class="hf-note-mark" aria-hidden="true">${HF_PENCIL}</span>` : ''}</li>`;
    }
    const isNow = !demo && pick && its.includes(pick.item) && (pick.label === 'now' || pick.label === 'next');
    const tag = demo ? `<span class="hf-tag">${myDayEsc(t('hf_block_demo'))}</span>` : isNow ? `<span class="hf-tag">${myDayEsc(t(pick.label === 'now' ? 'myday_now' : 'myday_next'))}</span>` : '';
    const ringPct = total ? (done + skip) / total : 0;
    const ring = `<svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><circle cx="16" cy="16" r="13" class="hf-ring-bg"/><circle cx="16" cy="16" r="13" class="hf-ring-fg" stroke-dasharray="${(ringPct * 81.7).toFixed(1)} 82" transform="rotate(-90 16 16)"/></svg>`;
    const inner = x => {
        const i = items.indexOf(x);
        const di = demo ? '' : ` data-i="${i}"`;
        const icon = x.done ? HF_CHECK : x.skipped ? HF_DASH : '';
        const label = x.done ? t('home_focus_undo_aria').replace('{item}', x.title) : x.skipped ? t('hf_unskip_aria').replace('{item}', x.title) : `${t('home_focus_done_aria')}: ${x.title}`;
        const mini = x.checkable ? `<button type="button" class="hf-mini${x.done ? ' on' : x.skipped ? ' skip' : ''}" data-hf="mini"${di} aria-label="${myDayEsc(label)}">${icon}</button>` : '<span class="hf-dot" aria-hidden="true"></span>';
        const noteBtn = x.checkable ? `<button type="button" class="hf-note-btn${x.note || x.skipped ? ' has' : ''}" data-hf="note"${di} aria-label="${myDayEsc(t('routine_note_title'))}: ${myDayEsc(x.title)}">${HF_PENCIL}</button>` : '';
        const noteLine = x.skipped || x.note ? `<li class="hf-in-note">${x.skipped ? `<span class="hf-skip-tag">${myDayEsc(t('routine_skip_today'))}</span>` : ''}${x.note ? `<span>${myDayEsc(x.note)}</span>` : ''}</li>` : '';
        return `<li class="hf-in${x.done ? ' is-done' : ''}${x.skipped ? ' is-skip' : ''}">${mini}<span class="hf-time">${myDayFormatMinutes(x.minutes)}</span><span class="hf-title">${myDayEsc(x.title)}</span>${noteBtn}</li>${noteLine}`;
    };
    return `<li class="hf-block${isNow ? ' is-now' : ''}${open ? ' is-open' : ''}${demo ? ' is-demo' : ''}"${demo ? ' inert' : ''}>
        <div class="hf-block-head">
            ${checkable ? `<button type="button" class="hf-ring${rest.length ? '' : ' is-full'}" data-hf="all"${at} ${rest.length ? '' : 'disabled '}aria-label="${myDayEsc(t('hf_block_mark_rest'))}: ${name}">${ring}</button>` : '<span class="hf-dot" aria-hidden="true"></span>'}
            <button type="button" class="hf-block-main" data-hf="toggle"${at} aria-expanded="${open}"><span class="hf-block-name">${name}</span><span class="hf-block-meta">${[rangeHtml].concat(meta.split(' · ').map(myDayEsc)).filter(Boolean).map(p => `<span class="hf-nw">${p}</span>`).join(' · ')}</span></button>
            ${tag}
            <button type="button" class="hf-block-chev" data-hf="toggle"${at} aria-expanded="${open}" aria-label="${myDayEsc(t(open ? 'hf_block_close_aria' : 'hf_block_open_aria').replace('{name}', b.name))}">${HF_CHEV}</button>
        </div>
        ${open ? `<ul class="hf-block-in">${its.map(inner).join('')}</ul>${checkable && rest.length ? `<button type="button" class="hf-block-all" data-hf="all"${at}>${myDayEsc(t('hf_block_mark_rest'))}</button>` : ''}` : `<p class="hf-block-items">${its.map(x => myDayEsc(x.title)).join(' · ')}</p>`}
    </li>`;
}
// הבלוק לדוגמה של הסיור: חמשת הדברים הראשונים של "יום עבודה + ספורט" בשפה של האפליקציה
function homeFocusDemoBlock() {
    const lines = typeof parseRoutineTemplateItems === 'function' ? parseRoutineTemplateItems(t('routine_tpl_work_sport_items')).slice(0, 5) : [];
    if (lines.length < 2) return null;
    const its = lines.map((l, k) => {
        const [h, m] = l.time.split(':').map(Number);
        return { kind: 'routine', checkable: true, minutes: h * 60 + m, title: l.title, done: k < 2, skipped: k === 2, note: k === 2 ? t('routine_note_later') : '' };
    });
    return { key: 'demo', name: t('routine_block_morning'), items: its };
}
// 🔗 הצעה בפוקוס: 3 דברים ומעלה ברצף מאותו טאב (עד 20 דקות בין אחד לשני) שעוד לא בבלוק - "לחבר לבלוק אחד?".
// פעם אחת לכל רצף: "לא" לא שואל שוב על אותם דברים. אף פעם לא מחבר לבד
function homeFocusSuggestKey() { return `weekwise_block_no_${currentUserId}`; }
function homeFocusSuggestRun(items) {
    let no = [];
    try { no = JSON.parse(localStorage.getItem(homeFocusSuggestKey()) || '[]'); } catch {}
    const byTab = new Map();
    items.filter(it => it.kind === 'routine' && it.routineItem && !it.blockName && it.minutes !== null)
        .forEach(it => { if (!byTab.has(it.tabId)) byTab.set(it.tabId, []); byTab.get(it.tabId).push(it); });
    for (const list of byTab.values()) {
        list.sort((a, b) => a.minutes - b.minutes);
        let run = [];
        for (let k = 0; k <= list.length; k++) {
            const cur = list[k];
            if (cur && run.length && cur.minutes - run[run.length - 1].minutes <= 20) { run.push(cur); continue; }
            if (run.length >= 3) {
                const id = run.map(x => x.routineItem.id).sort().join(',');
                if (!no.includes(id)) return { items: run, id };
            }
            run = cur ? [cur] : [];
        }
    }
    return null;
}
function renderHomeFocus() {
    const body = document.getElementById('home-focus-body');
    if (!body) return;
    homeFocusDeck = [];
    const goalsHtml = homeFocusGoalsHtml();
    // השגרה בפנים, מצומצמת (לפי בקשה מפורשת, 2026-11-17: "לשים גם את השגרה ביותר צמצום")
    const items = myDayItems.filter(it => it.checkable || it.kind === 'routine')
        .slice().sort((x, y) => (x.minutes === null ? 1e4 : x.minutes) - (y.minutes === null ? 1e4 : y.minutes));
    const demoBlock = homeFocusDemoOn() && !homeFocusBlocks(items).list.length ? homeFocusDemoBlock() : null;
    const demoHtml = demoBlock ? homeFocusBlockHtml(demoBlock, [], null, true) : '';
    if (!items.length) {
        // אין כלום היום: מנוחה - כוכבים שמנצנצים בשקט (בחירה 2026-11-08, אפשרות 8), והמטרות למעלה
        const stars = HOME_FOCUS_STARS.map(([x, y, r, d, gold]) => {
            const sz = r * 2.6;
            return `<path d="M${x} ${y - sz}Q${x} ${y} ${x + sz} ${y}Q${x} ${y} ${x} ${y + sz}Q${x} ${y} ${x - sz} ${y}Q${x} ${y} ${x} ${y - sz}Z" class="hf-star${gold ? ' is-gold' : ''}" style="animation-delay:${d}s"/>`;
        }).join('');
        body.innerHTML = demoHtml ? `${goalsHtml}<section class="hf-today"><ul class="hf-list">${demoHtml}</ul></section>`
            : `${goalsHtml}<div class="home-focus-rest" role="img" aria-label="${myDayEsc(t('home_focus_empty'))}"><svg viewBox="0 0 240 190" aria-hidden="true">${stars}</svg></div>`;
        return;
    }
    const pick = myDayPickNow(myDayItems);
    // "לא היום" לא נספר - לא כנעשה ולא כנשאר
    const countable = items.filter(it => it.checkable && !it.skipped);
    const done = countable.filter(it => it.done).length, left = countable.length - done;
    const pct = countable.length ? Math.round((done / countable.length) * 100) : 0;
    const { list: blocks, byItem } = homeFocusBlocks(items);
    const sugg = demoBlock || homeFocusDemoOn() ? null : homeFocusSuggestRun(items);
    const noteBtn = (it, i) => (it.kind === 'routine' && it.routineItem && it.checkable
        ? `<button type="button" class="hf-note-btn${it.note || it.skipped ? ' has' : ''}" data-hf="note" data-i="${i}" aria-label="${myDayEsc(t('routine_note_title'))}: ${myDayEsc(it.title)}">${HF_PENCIL}</button>` : '');
    const rowHtml = (it, i) => {
        const time = myDayFormatMinutes(it.minutes);
        const noteSmall = it.note ? `<span class="hf-row-note">${myDayEsc(it.note)}</span>` : '';
        if (it.skipped) {
            return `<li class="hf-row is-done is-routine is-skip"><button type="button" class="hf-undo is-skip" data-hf="mini" data-i="${i}" aria-label="${myDayEsc(t('hf_unskip_aria').replace('{item}', it.title))}">${HF_DASH}</button>${time ? `<span class="hf-time">${time}</span>` : ''}<span class="hf-title">${myDayEsc(it.title)}</span><span class="hf-skip-tag">${myDayEsc(t('routine_skip_today'))}</span>${noteSmall}${noteBtn(it, i)}</li>`;
        }
        if (it.done) {
            return `<li class="hf-row is-done${it.kind === 'routine' ? ' is-routine' : ''}"><button type="button" class="hf-undo" data-i="${i}" aria-label="${myDayEsc(t('home_focus_undo_aria').replace('{item}', it.title))}">${HF_CHECK}</button>${time ? `<span class="hf-time">${time}</span>` : ''}<span class="hf-title">${myDayEsc(it.title)}</span>${noteSmall}${noteBtn(it, i)}</li>`;
        }
        if (!it.checkable) return `<li class="hf-row is-routine is-plain"><span class="hf-dot" aria-hidden="true"></span>${time ? `<span class="hf-time">${time}</span>` : ''}<span class="hf-title">${myDayEsc(it.title)}</span></li>`;
        const isNow = pick && pick.item === it && (pick.label === 'now' || pick.label === 'next');
        const tag = isNow ? `<span class="hf-tag">${myDayEsc(t(pick.label === 'now' ? 'myday_now' : 'myday_next'))}</span>` : '';
        return `<li class="hf-row${it.kind === 'routine' ? ' is-routine' : ''}${isNow ? ' is-now' : ''}"><button type="button" class="hf-check" data-i="${i}" aria-label="${myDayEsc(t('home_focus_done_aria'))}: ${myDayEsc(it.title)}"></button>${time ? `<span class="hf-time">${time}</span>` : ''}<span class="hf-title">${myDayEsc(it.title)}${it.note ? `<small class="hf-row-note">${myDayEsc(it.note)}</small>` : ''}</span>${tag}${noteBtn(it, i)}</li>`;
    };
    const shown = new Set();
    let rows = demoHtml;
    items.forEach((it, i) => {
        if (sugg && sugg.items[0] === it) {
            const range = myDayEsc(t('hf_block_suggest')).replace('{range}', `<bdi dir="ltr">${homeFocusRange(sugg.items)}</bdi>`);
            rows += `<li class="hf-suggest"><p>${HF_LINK}<span>${range}</span></p><div class="hf-suggest-acts"><button type="button" class="btn-primary" data-hf="sug-yes">${myDayEsc(t('routine_block_join'))}</button><button type="button" class="btn-secondary" data-hf="sug-no">${myDayEsc(t('hf_block_suggest_no'))}</button></div></li>`;
        }
        const b = byItem.get(it);
        if (b) { if (!shown.has(b.key)) { shown.add(b.key); rows += homeFocusBlockHtml(b, items, pick, false); } return; }
        rows += rowHtml(it, i);
    });
    body.innerHTML = `${goalsHtml}
        <section class="hf-today">
            ${countable.length ? `<div class="hf-sum"><span><b>${myDayEsc(t('home_focus_done_n').replace('{n}', done))}</b> · ${myDayEsc(left ? t('home_focus_left_n').replace('{n}', left) : t('home_focus_all_done'))}</span><span class="hf-pct">${pct}%</span></div>
            <div class="hf-bar" role="img" aria-label="${pct}%"><i style="width:${pct}%"></i></div>` : ''}
            <ul class="hf-list">${rows}</ul>
        </section>`;
    body.querySelectorAll('.hf-check[data-i]').forEach(btn => { btn.onclick = () => { btn.disabled = true; btn.classList.add('is-ticking'); items[Number(btn.dataset.i)].toggle(true); }; });
    body.querySelectorAll('.hf-undo[data-i]:not([data-hf])').forEach(btn => { btn.onclick = () => { btn.disabled = true; items[Number(btn.dataset.i)].toggle(false); }; });
    // הבלוקים, ההערות וההצעה - לחיצה אחת שמטפלת בכולם (data-hf)
    body.onclick = async e => {
        const el = e.target.closest('[data-hf]');
        if (!el || !body.contains(el) || el.disabled) return;
        const act = el.dataset.hf;
        const b = el.dataset.b !== undefined ? blocks[Number(el.dataset.b)] : null;
        const it = el.dataset.i !== undefined ? items[Number(el.dataset.i)] : null;
        if (act === 'toggle' && b) {
            if (homeFocusOpenBlocks.has(b.key)) homeFocusOpenBlocks.delete(b.key); else homeFocusOpenBlocks.add(b.key);
            renderHomeFocus();
            const again = body.querySelector(`.hf-block-main[data-b="${b.idx}"], .hf-undo[data-b="${b.idx}"]`);
            if (again) again.focus({ preventScroll: true });
        } else if (act === 'all' && b) {
            const rest = b.items.filter(x => x.checkable && !x.done && !x.skipped);
            if (!rest.length) return;
            el.disabled = true;
            el.classList.add('is-ticking');
            homeFocusOpenBlocks.delete(b.key);
            await myDayToggleRoutineMany(rest.map(x => x.routineItem));
        } else if (act === 'mini' && it) {
            el.disabled = true;
            if (it.done) it.toggle(false);
            else if (it.skipped) { await routineClearSkip(it.routineItem.id, getLocalDateString()); loadTodayTasks(); }
            else { el.classList.add('on'); it.toggle(true); }
        } else if (act === 'note' && it) {
            openRoutineDayNote({ itemId: it.routineItem.id, title: it.title, done: it.done, uncheck: () => it.toggle(false) });
        } else if (act === 'sug-yes' && sugg) {
            openRoutineBlockSheet({ suggested: routineBlockSuggestName(sugg.items[0].minutes), onSave: name => setRoutineItemsBlock(sugg.items.map(x => x.routineItem.id), name) });
        } else if (act === 'sug-no' && sugg) {
            let no = [];
            try { no = JSON.parse(localStorage.getItem(homeFocusSuggestKey()) || '[]'); } catch {}
            no.push(sugg.id);
            try { localStorage.setItem(homeFocusSuggestKey(), JSON.stringify(no.slice(-50))); } catch {}
            renderHomeFocus();
        }
    };
    const nowRow = body.querySelector('.hf-row.is-now, .hf-block.is-now');
    if (nowRow) requestAnimationFrame(() => { try { nowRow.scrollIntoView({ block: 'nearest' }); } catch {} });
}
function homeFocusStep(dir) {
    const n = homeFocusDeck.length;
    if (n < 2) return;
    const at = Math.max(0, homeFocusDeck.findIndex(it => homeFocusKey(it) === homeFocusPeekKey));
    const to = (at + dir + n) % n;
    homeFocusPeekKey = to === 0 ? '' : homeFocusKey(homeFocusDeck[to]);
    renderHomeFocus();
}
// במחשב: החץ לכיוון שממנו הכרטיסים מציצים מביא את הבא (שמאלה בעברית, ימינה באנגלית), והחץ השני חוזר
document.addEventListener('keydown', e => {
    if (!isHomeFocusOn() || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"], .modal.open')) return;
    const rtl = document.documentElement.dir === 'rtl';
    homeFocusStep((e.key === 'ArrowLeft') === rtl ? 1 : -1);
});

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

// --- הכתבה: שפות הדיבור ---
const HOME_SPEECH_LANGS = { he: 'he-IL', en: 'en-US', es: 'es-ES', fr: 'fr-FR', ar: 'ar-SA', ru: 'ru-RU', de: 'de-DE', pt: 'pt-BR', ja: 'ja-JP', zh: 'zh-CN', hi: 'hi-IN', ko: 'ko-KR', tr: 'tr-TR', id: 'id-ID', it: 'it-IT', vi: 'vi-VN', pl: 'pl-PL', th: 'th-TH', ur: 'ur-PK', bn: 'bn-BD', sw: 'sw-KE', uk: 'uk-UA', el: 'el-GR', nl: 'nl-NL', ca: 'ca-ES', ro: 'ro-RO', yo: 'yo-NG', sv: 'sv-SE', nb: 'nb-NO', da: 'da-DK', cs: 'cs-CZ', hu: 'hu-HU', fi: 'fi-FI' };
function homeSpeechSupported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }
// הודעה לכל סוג תקלה של ההכתבה (Web Speech API)
const DICTATION_ERROR_KEYS = {
    'not-allowed': 'dictation_mic_denied',
    'service-not-allowed': 'dictation_service_off',
    'audio-capture': 'dictation_no_mic',
    'network': 'dictation_network',
    'no-speech': 'dictation_no_speech',
    'language-not-supported': 'dictation_lang',
};
// --- הכתבה: מדברים והמילים נכתבות תוך כדי (Chrome / אנדרואיד / ספארי באייפון) ---
// לפי בקשה מפורשת ("שיהיה ממש אפשר לדבר וזה יכתוב במילים"): כפתור מיקרופון בשורת הכתיבה במסך הבית, בפתק המהיר
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
    let lastInterim = '';   // מה שכבר מופיע בשדה ועוד לא "סופי" - נשאר גם כשעוצרים באמצע (למשל לוחצים "שלח")
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
        if (heard) { render(lastInterim); input.dispatchEvent(new Event('change', { bubbles: true })); }
    };
    dictationSession = session;
    rec.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex || 0; i < e.results.length; i++) {
            const r = e.results[i];
            if (r.isFinal) finalText = [finalText, r[0].transcript].map(s => s.trim()).filter(Boolean).join(' ');
            else interim += r[0].transcript;
        }
        lastInterim = interim;
        render(interim);
    };
    rec.onerror = ev => {
        const code = ev && ev.error;
        session.finish();
        // aborted = עצירה שלנו (סגירת חלון / מעבר דף). לכל תקלה אחרת - הודעה שאומרת בדיוק מה קרה ומה לעשות (לפי דיווח מפורש,
        // 2026-10-13: "ההקלטה... לא עובד מהמחשב - כי הוא כן עובד מהנייד"): במחשב זה בדרך כלל מיקרופון שאין / שחסום, או דפדפן
        // שההכתבה בו לא עובדת
        if (code === 'aborted') return;
        showAppToast(t(DICTATION_ERROR_KEYS[code] || 'quick_note_voice_failed'), 'error');
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

// סגירת החלוניות הקטנות בלחיצה בחוץ
function initHomeV2() {
    initMyDaySwipes();
    initDictationButtons();
    document.addEventListener('click', e => {
        if (!e.target.closest('#home-note-line')) homeNoteHideSuggest();
        const tip = document.getElementById('myday-water-tip');
        if (tip && !tip.classList.contains('hidden') && !e.target.closest('.myday-water-info, #myday-water-tip')) toggleMyDayWaterInfo();
    });
    try { if (localStorage.getItem(HOME_FOCUS_KEY) === '1' || sessionStorage.getItem('weekwise_home_focus') === '1') toggleHomeFocus(true); } catch {}
}

// ===================== שלב 2: נגיעות אישיות =====================
// לפי הרעיונות שנבחרו במפורש: 3 רצף ימים, 12 ספירה לאחור,
// 5 "3 דברים טובים" בערב, 14 השבועות הקודמים של הפתק השבועי, 9 מזג אוויר בשמיים

const HOME_FLAME_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.2-4.8.2 1.6 1 2.6 2 3 0-2.6-.6-5.4.8-8.2z"/></svg>';
const HOME_HOURGLASS_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9s8 4 8 9"/></svg>';
const HOME_MOON_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

function homeDaysBetween(a, b) {
    return Math.round((Date.parse(`${b}T12:00:00`) - Date.parse(`${a}T12:00:00`)) / 86400000);
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
    const prev = goodThingsToday, hadSaved = goodThingsSaved();
    // the window closes at once and the chip shows the result; the server catches up behind (her report 2026-11-15:
    // "נתקע ל-2 שניות על המסך אחרי שכבר... סגרתי" - it used to wait for the save before closing). On an error it goes back
    goodThingsToday = items.length ? items : null;
    goodThingsLoadedFor = day;
    closeModal('modal-good-things');
    if (items.length) showAppToast(t('good_things_saved_toast'));
    renderHomeChips();
    let error = null;
    try {
        if (items.length) {
            ({ error } = await supabaseClient.from('good_things').upsert({ user_id: currentUserId, day, items, updated_at: new Date().toISOString() }, { onConflict: 'user_id,day' }));
        } else if (hadSaved) {
            ({ error } = await supabaseClient.from('good_things').delete().eq('user_id', currentUserId).eq('day', day));
        }
    } catch (e) { error = e; }
    if (error) {
        goodThingsToday = prev;
        renderHomeChips();
        showAppToast(t('error_adding_item') + (error.message || ''), 'error');
    }
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

// 🧑‍🍳 קיצור דרך למתכונים - רק למי שמדליק/ה אותו בהגדרות (כבוי כברירת מחדל, נשמר במכשיר)
const HOME_RECIPES_KEY = 'weekwise_home_recipes';
function isHomeRecipesShortcutOn() { try { return localStorage.getItem(HOME_RECIPES_KEY) === 'true'; } catch { return false; } }
function toggleHomeRecipesShortcut() {
    const toggle = document.getElementById('home-recipes-toggle');
    const on = toggle ? toggle.checked : !isHomeRecipesShortcutOn();
    try { localStorage.setItem(HOME_RECIPES_KEY, String(on)); } catch {}
    renderHomeChips();
}

// --- הצ'יפים הקטנים מתחת לברכה: רצף, ספירה לאחור, ובערב "3 דברים טובים" ---
function renderHomeChips() {
    const box = document.getElementById('home-chips');
    if (!box) return;
    const chips = [];
    const recipesToggle = document.getElementById('home-recipes-toggle');
    if (recipesToggle) recipesToggle.checked = isHomeRecipesShortcutOn();
    if (isHomeRecipesShortcutOn()) {
        chips.push(`<button type="button" class="home-chip home-chip-recipes" onclick="navigateFromMenu('nutrition-section', 'recipes')"><span aria-hidden="true">🧑‍🍳</span><span>${myDayEsc(t('nav_recipes'))}</span></button>`);
    }
    // הרצף (🔥 X ימים ברצף) כבר לא במסך הראשי - לפי בקשה מפורשת: "לא נראה טוב ולא קשור"
    if (homeCountdown) {
        chips.push(`<button type="button" class="home-chip home-chip-countdown" onclick="openHomeCountdown()">${HOME_HOURGLASS_SVG}<span>${myDayEsc(homeCountdownText(homeCountdown))}</span></button>`);
    }
    if (typeof bookHomeChipHtml === 'function') { const bc = bookHomeChipHtml(); if (bc) chips.push(bc); }
    if (goodThingsChipVisible()) {
        // באותו מקום, אבל קודם שאלה (לפי בקשה מפורשת, 2026-11-02): "כן" פותח את החלון, "לא" סוגר עד מחר
        if (goodThingsSaved()) {
            chips.push(`<button type="button" class="home-chip home-chip-good is-saved" onclick="openGoodThings()">${HOME_MOON_SVG}<span>${myDayEsc(t('good_things_chip_done'))}</span></button>`);
        } else {
            chips.push(`<div class="home-chip home-chip-good home-chip-ask" role="group" aria-label="${myDayEsc(t('good_things_ask'))}">${HOME_MOON_SVG}<span>${myDayEsc(t('good_things_ask'))}</span><button type="button" class="home-chip-ask-btn is-yes" onclick="openGoodThings()">${myDayEsc(t('good_things_yes'))}</button><button type="button" class="home-chip-ask-btn" onclick="skipGoodThingsTonight()">${myDayEsc(t('good_things_no'))}</button></div>`);
        }
    }
    box.innerHTML = chips.join('');
    box.classList.toggle('hidden', !chips.length);
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
// מה מצויר בשמיים בכל מצב - לפי מזג האוויר האמיתי במיקום (לפי בקשה מפורשת: "לפי מזג האוויר ומיקום של מי שנמצא בו",
// ושיעבוד בכל הערכות): שמש (ובלילה ירח וכוכבים), עננים אמיתיים (כהים בגשם ובסערה), טיפות, פתיתים, ברק, ערפל
const HOME_WEATHER_EMOJI = { clear: '☀️', night: '🌙', partly: '⛅', clouds: '☁️', rain: '🌧️', snow: '❄️', storm: '⛈️', fog: '🌫️' };
function homeWeatherParts(sky, night) {
    const light = night ? '<i class="wx-moon"></i><i class="wx-stars"></i>' : '<i class="wx-sun"></i>';
    const clouds = (n, dark) => [1, 2, 3].slice(0, n).map(i => `<i class="wx-cloud wx-c${i}${dark ? ' wx-dark' : ''}"></i>`).join('');
    if (sky === 'clear') return light;
    if (sky === 'partly') return light + clouds(2);
    if (sky === 'clouds') return clouds(3);
    if (sky === 'rain') return clouds(3, true) + '<i class="wx-drops"></i>';
    if (sky === 'storm') return clouds(3, true) + '<i class="wx-drops"></i><i class="wx-bolt"></i>';
    if (sky === 'snow') return clouds(2) + '<i class="wx-flakes"></i>';
    if (sky === 'fog') return '<i class="wx-mist"></i><i class="wx-mist wx-mist2"></i>';
    return '';
}
function applyHomeWeather(state) {
    const sky = state && (state.preview || isHomeWeatherOn()) ? state.sky : null;
    const night = !!(sky && state.day === false);
    const layer = document.getElementById('home-weather');
    if (layer) {
        // מציירים מחדש רק כשמשהו השתנה - שהעננים לא יקפצו להתחלה בכל רענון
        const key = sky ? `${sky}-${night ? 'night' : 'day'}` : '';
        if (layer.dataset.wx !== key) {
            layer.dataset.wx = key;
            layer.className = 'home-weather' + (sky ? ` wx-${sky}${night ? ' wx-night' : ''}` : '');
            layer.innerHTML = sky ? homeWeatherParts(sky, night) : '';
        }
    }
    // בהגדרות, מתחת למתג: מה יש עכשיו בחוץ - כדי שיהיה ברור למה בשמיים יש, למשל, גם שמש וגם עננים (מעונן חלקית)
    const nowEl = document.getElementById('home-weather-now');
    if (nowEl) {
        const real = sky && !(state && state.preview);
        nowEl.classList.toggle('hidden', !real);
        if (real) nowEl.textContent = t('weather_now').replace('{sky}', `${HOME_WEATHER_EMOJI[sky === 'clear' && night ? 'night' : sky] || ''} ${t('weather_sky_' + sky)}`.trim());
    }
    // כשמזג האוויר פעיל הוא מצייר את השמיים בעצמו - השמש / הכוכבים הכלליים של הערכה מוסתרים (theme.css)
    const scene = document.querySelector('.home-sky-scene');
    if (scene) scene.classList.toggle('wx-on', !!sky);
    const toggle = document.getElementById('home-weather-toggle');
    if (toggle) toggle.checked = isHomeWeatherOn();
    const dev = document.getElementById('weather-dev-preview');
    if (dev) dev.classList.toggle('hidden', !(typeof isDevSuperuserAccount !== 'undefined' && isDevSuperuserAccount));
    renderHomeDevWx();
}

// --- 🛠️ למנהלת המוצר בלבד: פס קטן במסך הבית - כל מזג אוויר, יום / לילה, ובכל ערכת עיצוב, בלי להיכנס להגדרות
// (לפי בקשה מפורשת, 2026-10-12: "תעשה לי רק לי אפשרות לשנות את הנראות שאני אראה איך זה נראה בכל מקום וכל מזג
// אוויר"). הכול רק לתצוגה - לא נשמר; ✕ מחזיר את מזג האוויר האמיתי, את הערכה השמורה ואת מצב היום / הלילה השמור
const HOME_DEV_SKIES = [['clear', '☀️'], ['partly', '⛅'], ['clouds', '☁️'], ['rain', '🌧️'], ['storm', '⛈️'], ['snow', '❄️'], ['fog', '🌫️']];
let homeDevWxOpen = false;
let homeDevWxDay = true;
function homeDevThemes() { return [...new Set([...document.querySelectorAll('.theme-swatch[data-theme]')].map(el => el.dataset.theme))]; }
function homeDevCurrentTheme() { return document.documentElement.getAttribute('data-color-theme') || 'default'; }
function renderHomeDevWx() {
    const isDev = typeof isDevSuperuserAccount !== 'undefined' && isDevSuperuserAccount;
    // לפי בקשה מפורשת (2026-10-14: "והPM תמחק לי מהמסך הראשי תשים איפה שהכפתורים של הNEW ME והפרימיום"): בהגדרות,
    // בלוח ה-PM שליד המתגים של New Me והפרימיום - לא על מסך הבית
    const host = document.getElementById('settings-dev-panel');
    let bar = document.getElementById('home-dev-wx');
    if (!isDev || !host) { if (bar) bar.remove(); return; }
    if (!bar) { bar = document.createElement('div'); bar.id = 'home-dev-wx'; bar.className = 'home-dev-wx'; host.appendChild(bar); }
    const cur = homeWeatherPreview;
    const theme = homeDevCurrentTheme();
    const sw = document.querySelector(`.theme-swatch[data-theme="${theme}"]`);
    const night = !document.documentElement.classList.contains('light-mode');
    bar.classList.toggle('open', homeDevWxOpen);
    bar.innerHTML = `
        <button type="button" class="hdw-toggle" aria-expanded="${homeDevWxOpen}">🌦️<b>PM</b></button>
        <div class="hdw-panel">
            <div class="hdw-row">${HOME_DEV_SKIES.map(([sky, icon]) => `<button type="button" data-sky="${sky}" class="${cur && cur.sky === sky ? 'on' : ''}" aria-label="${sky}">${icon}</button>`).join('')}
                <button type="button" data-daynight aria-label="day / night">${homeDevWxDay ? '🌞' : '🌜'}</button></div>
            <div class="hdw-row"><button type="button" data-theme-step="-1" aria-label="previous theme">‹</button><span class="hdw-theme">${escapeHtmlForReport((sw && sw.getAttribute('title')) || theme)}</span><button type="button" data-theme-step="1" aria-label="next theme">›</button>
                <button type="button" data-mode aria-label="light / dark">${night ? '🌙' : '☀️'}</button><button type="button" data-reset aria-label="reset">✕</button></div>
        </div>`;
    bar.querySelector('.hdw-toggle').addEventListener('click', () => { homeDevWxOpen = !homeDevWxOpen; renderHomeDevWx(); });
    bar.querySelectorAll('[data-sky]').forEach(b => b.addEventListener('click', () => previewHomeWeather(b.dataset.sky, homeDevWxDay)));
    bar.querySelector('[data-daynight]').addEventListener('click', () => {
        homeDevWxDay = !homeDevWxDay;
        if (homeWeatherPreview) previewHomeWeather(homeWeatherPreview.sky, homeDevWxDay); else renderHomeDevWx();
    });
    bar.querySelectorAll('[data-theme-step]').forEach(b => b.addEventListener('click', () => {
        const list = homeDevThemes();
        if (!list.length) return;
        const i = list.indexOf(homeDevCurrentTheme());
        applyColorTheme(list[(i + Number(b.dataset.themeStep) + list.length) % list.length]);
        renderHomeDevWx();
    }));
    bar.querySelector('[data-mode]').addEventListener('click', () => { applyLightMode(document.documentElement.classList.contains('light-mode') ? false : true); renderHomeDevWx(); });
    bar.querySelector('[data-reset]').addEventListener('click', () => {
        try { applyColorTheme(localStorage.getItem(colorThemeKey()) || 'blue_teal'); applyLightMode(localStorage.getItem('weekwise_light_mode') === 'true'); } catch {}
        homeDevWxDay = true;
        previewHomeWeather(null);
        renderHomeDevWx();
    });
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
    loadHomeCountdown();
    loadGoodThingsSetting();
    loadGoodThingsToday();
    refreshHomeWeather(false);
    if (homePhase2Timer) return;
    homePhase2Timer = setInterval(() => {
        renderHomeGreeting();
        const today = getLocalDateString();
        if (today !== homePhase2Day) {
            homePhase2Day = today;
            loadHomeCountdown();
        }
        if (goodThingsLoadedFor !== goodThingsDay()) loadGoodThingsToday();
        else renderHomeChips();
        refreshHomeWeather(false);
    }, 10 * 60000);
}

// --- ✏️ שורת הכתיבה במסך הבית (עיצוב 2, לפי בחירה מפורשת, 2026-10-11) - במקום כפתור "פתק מהיר":
// כותבים ושולחים (➤ / Enter) ישר לפתקים. 📝 בתחילת השורה מחליף ל-🛒 רשימת הקניות ובחזרה ---
// 🍎 (ארוחה קבועה) - שלישי בסבב, אלא אם הוסתר בהגדרות ("הצגת ה-🍎"): מקלידים ומה שמתאים עולה כמו חיפוש
let homeNoteDest = 'weekly';
let homeNoteSaving = false;
let homeNotePresets = null;
function homeNoteModes() { return ['weekly', 'general'].concat(typeof isQuickNoteAppleOn !== 'function' || isQuickNoteAppleOn() ? ['meal'] : []); }
function setHomeNoteDest(dest = homeNoteDest) {
    homeNoteDest = homeNoteModes().includes(dest) ? dest : 'weekly';
    const shopping = homeNoteDest === 'general', meal = homeNoteDest === 'meal';
    const btn = document.getElementById('home-note-dest');
    if (btn) {
        const label = t(shopping ? 'quick_note_dest_shopping' : meal ? 'preset_fab_title' : 'quick_note_dest_notes');
        btn.classList.toggle('is-shopping', shopping);
        btn.classList.toggle('is-meal', meal);
        btn.title = label;
        btn.setAttribute('aria-label', label);
    }
    const input = document.getElementById('home-note-input');
    if (input && !input.classList.contains('is-listening')) input.placeholder = t(shopping ? 'notes_ai_placeholder_shopping' : meal ? 'home_note_meal_ph' : 'notes_ai_placeholder');
    if (meal) homeNoteLoadPresets().then(homeNoteSuggest);
    else homeNoteHideSuggest();
}
function toggleHomeNoteDest() { const modes = homeNoteModes(); setHomeNoteDest(modes[(modes.indexOf(homeNoteDest) + 1) % modes.length]); }
async function homeNoteLoadPresets() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('meal_presets').select('*').eq('user_id', currentUserId);
    homeNotePresets = data || [];
}
function homeNoteMatches() {
    const input = document.getElementById('home-note-input');
    const q = ((input && input.value) || '').trim().toLowerCase();
    return (homeNotePresets || []).filter(p => String(p.food_name || '').toLowerCase().includes(q)).slice(0, 6);
}
function homeNoteHideSuggest() { const box = document.getElementById('home-note-suggest'); if (box) box.classList.add('hidden'); }
// הרשימה עולה רק אחרי שמתחילים לכתוב (לפי בקשה מפורשת: "אל תפתח ישר את הארוחות הקבועות שמשתמש יכתוב ואז זה יקפוץ לפי התאמה").
// ובלי התאמה - שורה קצרה ורגילה ("אין ארוחה קבועה כזו") וכפתור לחשב עם AI (לפי בקשה מפורשת: "שלא תהיה הודעת השגיאה הזו")
function homeNoteSuggest() {
    const box = document.getElementById('home-note-suggest');
    if (!box || homeNoteDest !== 'meal' || !homeNotePresets) { homeNoteHideSuggest(); return; }
    const input = document.getElementById('home-note-input');
    const typed = ((input && input.value) || '').trim();
    if (!typed) { homeNoteHideSuggest(); return; }
    const list = homeNoteMatches();
    box.innerHTML = list.length
        ? list.map(p => `<button type="button" class="home-note-sugg" role="option" data-id="${myDayEsc(p.id)}"><span>${myDayEsc(p.food_name)}</span><b><bdi dir="ltr">${Number(p.calories) || 0}</bdi> ${myDayEsc(t('calories_unit'))}</b></button>`).join('')
        : `<p class="home-note-sugg-empty">${myDayEsc(t('home_note_meal_none'))}</p><button type="button" class="home-note-sugg home-note-sugg-ai" data-ai>${myDayEsc(t('home_note_meal_ai'))}</button>`;
    box.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', () => homeNoteLogPreset(b.dataset.id)));
    const ai = box.querySelector('[data-ai]');
    if (ai) ai.addEventListener('click', () => homeNoteAskAi(typed));
    box.classList.remove('hidden');
}
function homeNoteInput() { if (homeNoteDest === 'meal') homeNoteSuggest(); }
// אין ארוחה קבועה כזו: העוזר מחשב את מה שנכתב (לשונית "מזון" בצ'אט) ורושם אותו להיום
function homeNoteAskAi(text) {
    if (typeof stopDictation === 'function') stopDictation();
    const input = document.getElementById('home-note-input');
    if (input) { input.value = ''; input.blur(); }
    homeNoteHideSuggest();
    if (typeof openAiChat !== 'function') return;
    openAiChat('food');
    setTimeout(() => {
        const field = document.querySelector('#ai-chat .ai-chat-input input');
        if (!field || !text) return;
        field.value = text;
        if (typeof aiChatSend === 'function') aiChatSend();
    }, 150);
}
async function homeNoteLogPreset(id) {
    if (homeNoteSaving) return;
    homeNoteSaving = true;
    try {
        cachedPresets = homeNotePresets || [];
        await logPresetQuickAdd(id);
        const input = document.getElementById('home-note-input');
        if (input) { input.value = ''; input.blur(); }
        homeNoteHideSuggest();
    } finally { homeNoteSaving = false; }
}
async function saveHomeNoteLine() {
    const input = document.getElementById('home-note-input');
    if (!input || homeNoteSaving) return;
    if (typeof stopDictation === 'function') stopDictation();
    if (homeNoteDest === 'meal') { const typed = input.value.trim(); const first = typed && homeNoteMatches()[0]; if (first) homeNoteLogPreset(first.id); else if (typed) homeNoteAskAi(typed); else input.focus(); return; }
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    homeNoteSaving = true;
    const send = document.getElementById('home-note-send');
    if (send) send.disabled = true;
    try {
        const ok = await insertCenterItemDirect(homeNoteDest, text, null, null, null, true);
        if (!ok) return;
        showAppToast(t(homeNoteDest === 'general' ? 'notes_ai_added_shopping' : 'notes_ai_added'));
        input.value = '';
        input.blur();
    } finally {
        homeNoteSaving = false;
        if (send) send.disabled = false;
    }
}

// 📝🛒 הכפתור הקטן ליד הפוקוס: תפריט קטן - פתקים / רשימת קניות (לפי בקשה מפורשת, 2026-10-20)
function toggleHomeListsMenu(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('home-lists-menu');
    const btn = document.getElementById('btn-home-lists');
    if (!menu || !btn) return;
    const open = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { const first = menu.querySelector('button'); if (first) first.focus({ preventScroll: true }); }
}
function closeHomeListsMenu() {
    const menu = document.getElementById('home-lists-menu');
    if (menu && !menu.classList.contains('hidden')) { menu.classList.add('hidden'); document.getElementById('btn-home-lists')?.setAttribute('aria-expanded', 'false'); }
}
function openHomeList(which) {
    closeHomeListsMenu();
    navigateFromMenu('my-center-section', which === 'shopping' ? 'shopping' : 'notes');
}
document.addEventListener('click', e => { if (!e.target.closest || !e.target.closest('#home-lists-menu, #btn-home-lists')) closeHomeListsMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeHomeListsMenu(); });
