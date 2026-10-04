// ===== New Me: אתגרים · מכתב מהעבר · המתנה בסוף =====
// לפי בקשה מפורשת: "משבצת חדשה בתוך ה-NEW ME" עם 20 אתגרים - 10 גדולים ו-10 מיני ("דברים
// קטנים שהופכים לשגרה"). כל אתגר שנבחר - שואלים מתי להתחיל; יום חופשי אחד על כל שבוע "כדי
// לא להישבר באתגר"; האתגר הפעיל מופיע בראש התפריט של היום ובהצצה להיום. במקביל רצים לכל היותר
// גדול אחד + מיני אחד (לפי בחירה מפורשת). מי שמסיים/ת את כל 20 - נפתחת מתנה: המכתב מהעבר
// (נכתב בתחילת הדרך ונחתם), תעודת הוקרה ומצב מתקדם.
//
// הכללים: ימים חופשיים = floor(ימים / 7). יום שלא סומן עד שלשום נחשב יום חופשי (אפשר לסמן את
// היום וגם את אתמול). האתגר הושלם כשמספר הימים שבוצעו ≥ ימים − חופשיים; הסתיים (בלי אשמה -
// "זה קורה") כשנוצלו יותר ימים חופשיים מהמותר. השלמה נספרת פעם אחת לכל אתגר (20 שונים).

const NEW_ME_CHALLENGES = [
    { key: 'no_sugar_5', kind: 'big', days: 5, icon: '🍬' },
    { key: 'no_carbs_7', kind: 'big', days: 7, icon: '🥖' },
    { key: 'deficit_14', kind: 'big', days: 14, icon: '📉', budget: true },
    { key: 'sport_14', kind: 'big', days: 14, icon: '🏃', auto: 'sport' },
    { key: 'no_fried_14', kind: 'big', days: 14, icon: '🍟' },
    { key: 'home_food_14', kind: 'big', days: 14, icon: '🏠' },
    { key: 'no_snacking_14', kind: 'big', days: 14, icon: '🙅' },
    { key: 'no_sugar_21', kind: 'big', days: 21, icon: '🍭' },
    { key: 'menu_21', kind: 'big', days: 21, icon: '🍽️', auto: 'menu' },
    // "לרדת 5 קילו בחודש" = גירעון + ספורט + בלי סוכר (וכל אחד מהם גם כאתגר נפרד, למעלה)
    { key: 'lose5_month', kind: 'big', days: 30, icon: '🎯', budget: true, weight: true },
    { key: 'cinnamon_coffee', kind: 'mini', days: 7, icon: '☕' },
    { key: 'water_first', kind: 'mini', days: 7, icon: '💧' },
    { key: 'veg_each_meal', kind: 'mini', days: 7, icon: '🥗' },
    { key: 'walk_after_meal', kind: 'mini', days: 7, icon: '🚶' },
    { key: 'screen_free_meal', kind: 'mini', days: 7, icon: '📵' },
    { key: 'fruit_dessert', kind: 'mini', days: 7, icon: '🍓' },
    { key: 'no_soda', kind: 'mini', days: 7, icon: '🥤' },
    { key: 'kitchen_closed', kind: 'mini', days: 7, icon: '🌙' },
    { key: 'slow_meal', kind: 'mini', days: 7, icon: '🐢' },
    { key: 'morning_stretch', kind: 'mini', days: 7, icon: '🧘' }
];
const NEW_ME_CH_SPORT_MIN = 20;      // "שבועיים של תנועה": אימון של 20 דקות לפחות מסמן את היום לבד
const NEW_ME_CH_START_AHEAD = 14;    // אפשר לתזמן התחלה עד שבועיים קדימה
// משימה יומית משותפת (ובמיני-אתגרים השם עצמו הוא המשימה)
const NEW_ME_CH_TASK_KEYS = { no_sugar_21: 'no_sugar_5' };
const NEW_ME_LETTER_MIN = 10;

let nmChallenges = [];          // new_me_challenges - כל ההיסטוריה
let nmChallengeDays = [];       // new_me_challenge_days של האתגרים הפעילים
let nmChallengesLoaded = false;

function nmChDef(key) { return NEW_ME_CHALLENGES.find(c => c.key === key) || null; }
function nmChTitle(key) { return t('nm_ch_' + key + '_title'); }
function nmChTask(key) {
    const k = 'nm_ch_' + (NEW_ME_CH_TASK_KEYS[key] || key) + '_task';
    const v = t(k);
    return v && v !== k ? v : nmChTitle(key);
}
function nmChFreeDays(days) { return Math.floor(days / 7); }
function nmChEnd(c) { return nmAddDays(c.start_date, c.days - 1); }
function nmChKindLabel(kind) { return t(kind === 'big' ? 'nm_ch_big_one' : 'nm_ch_mini_one'); }
function nmChActive() { return nmChallenges.filter(c => c.status === 'active' && nmChDef(c.challenge_key)).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'big' ? -1 : 1)); }
function nmChActiveOfKind(kind) { return nmChActive().find(c => c.kind === kind) || null; }
function nmChActiveOfKey(key) { return nmChActive().find(c => c.challenge_key === key) || null; }
function nmChDoneKeys() { return new Set(nmChallenges.filter(c => c.status === 'done' && nmChDef(c.challenge_key)).map(c => c.challenge_key)); }
function nmChDoneCount() { return nmChDoneKeys().size; }
function nmChAllDone() { return nmChDoneCount() >= NEW_ME_CHALLENGES.length; }
function nmChLastDone(key) {
    return nmChallenges.filter(c => c.challenge_key === key && c.status === 'done').sort((a, b) => String(b.completed_at || '').localeCompare(String(a.completed_at || '')))[0] || null;
}
function nmChFreeLine(free) {
    if (!free) return t('nm_ch_free_none');
    return free === 1 ? t('nm_ch_free_one') : t('nm_ch_free_many').replace('{n}', nmFmt(free));
}

// מצב אתגר ליום הנוכחי: כמה בוצעו, כמה ימים חופשיים נשארו, האם הושלם / כבר לא אפשרי
function nmChState(c) {
    const today = getLocalDateString();
    const yesterday = nmAddDays(today, -1);
    const end = nmChEnd(c);
    const marks = {};
    nmChallengeDays.filter(d => d.challenge_id === c.id).forEach(d => { marks[d.day] = d.state; });
    const vals = Object.values(marks);
    const done = vals.filter(s => s === 'done').length;
    const freeMarked = vals.filter(s => s === 'free').length;
    // ימים שכבר אי אפשר לסמן (עד שלשום) ולא סומנו - נחשבים ימים חופשיים
    const lastFinal = nmAddDays(today, -2);
    let missed = 0;
    for (let d = c.start_date; d <= end && d <= lastFinal; d = nmAddDays(d, 1)) if (!marks[d]) missed++;
    const needed = c.days - c.free_days;
    const freeLeft = c.free_days - freeMarked - missed;
    const scheduled = today < c.start_date;
    const inWindow = d => d >= c.start_date && d <= end;
    return {
        today, yesterday, end, marks, done, freeMarked, missed, needed, freeLeft, scheduled,
        dayN: scheduled ? 0 : Math.min(c.days, nmDaysBetween(c.start_date, today) + 1),
        complete: done >= needed,
        broken: done < needed && freeLeft < 0,
        canToday: !scheduled && inWindow(today),
        canYesterday: inWindow(yesterday),
    };
}

// ---------- נתונים ----------
async function nmLoadChallenges() {
    if (!supabaseClient || !currentUserId) return;
    const { data, error } = await supabaseClient.from('new_me_challenges').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true });
    if (error) return;
    nmChallenges = data || [];
    const ids = nmChallenges.filter(c => c.status === 'active').map(c => c.id);
    let days = [];
    if (ids.length) {
        const res = await supabaseClient.from('new_me_challenge_days').select('*').in('challenge_id', ids);
        days = res.data || [];
    }
    nmChallengeDays = days;
    nmChallengesLoaded = true;
    await nmSettleChallenges();
}

// אתגר שכבר לא אפשרי להשלים (נוצלו יותר ימים חופשיים מהמותר) - מסומן "הסתיים"
async function nmSettleChallenges() {
    for (const c of nmChActive()) {
        const st = nmChState(c);
        if (st.complete) await nmSetChallengeStatus(c, 'done');
        else if (st.broken) await nmSetChallengeStatus(c, 'ended');
    }
}

async function nmSetChallengeStatus(c, status) {
    const fields = { status, completed_at: status === 'done' ? new Date().toISOString() : null };
    const { error } = await supabaseClient.from('new_me_challenges').update(fields).eq('id', c.id);
    if (error) return false;
    Object.assign(c, fields);
    return true;
}

// אחרי כל שינוי: המסך של New Me (אם פתוח), גיליון אתגר פתוח, וההצצה להיום
let nmChSheetRefresh = null;
function nmAfterChallengeChange() {
    const sec = document.getElementById('new-me-section');
    if (sec && sec.classList.contains('active-tab') && nmProfile && !nmQuiz && (nmView === 'home' || nmView === 'challenges')) nmRenderView(nmRoot());
    if (nmChSheetRefresh) nmChSheetRefresh();
    if (typeof loadTodayTasks === 'function') loadTodayTasks();
}

// ✓ / 🍕 ליום (היום או אתמול). לחיצה נוספת על אותו מצב מבטלת אותו
async function nmMarkChallengeDay(id, day, state) {
    const c = nmChallenges.find(x => x.id === id);
    if (!c || c.status !== 'active') return;
    const st = nmChState(c);
    if (!((day === st.today && st.canToday) || (day === st.yesterday && st.canYesterday))) return;
    const prev = st.marks[day] || null;
    if (state === prev) state = null;
    if (state === 'free' && st.freeLeft <= 0) { showAppToast(t('nm_ch_no_free_left'), 'error'); return; }
    if (state) {
        const { data, error } = await supabaseClient.from('new_me_challenge_days').upsert({ challenge_id: id, user_id: currentUserId, day, state }, { onConflict: 'challenge_id,day' }).select().maybeSingle();
        if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
        nmChallengeDays = nmChallengeDays.filter(d => !(d.challenge_id === id && d.day === day)).concat(data || { challenge_id: id, day, state });
    } else {
        const { error } = await supabaseClient.from('new_me_challenge_days').delete().eq('challenge_id', id).eq('day', day);
        if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
        nmChallengeDays = nmChallengeDays.filter(d => !(d.challenge_id === id && d.day === day));
    }
    const done = nmChState(c).complete && await nmSetChallengeStatus(c, 'done');
    nmAfterChallengeChange();
    if (done) nmCelebrateChallenge(c);
}

function nmAskChallengeYesterday(id) {
    const c = nmChallenges.find(x => x.id === id);
    if (!c) return;
    const st = nmChState(c);
    const ov = nmOpenSheet(`
        <h4>${nmChDef(c.challenge_key).icon} ${nmEsc(nmChTitle(c.challenge_key))}</h4>
        <p class="nm-fine">${nmEsc(t('nm_ch_yesterday_q'))} · ${nmEsc(nmLongDate(st.yesterday))}</p>
        <button type="button" class="nm-btn-primary" data-y="done">${nmEsc(t('nm_ch_yesterday_done'))}</button>
        ${c.free_days ? `<button type="button" class="nm-btn-ghost" data-y="free" ${st.freeLeft > 0 ? '' : 'disabled'}>${nmEsc(t('nm_ch_yesterday_free'))}</button>` : ''}
        <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_back'))}</button>`, 'nm-ch-yesterday-sheet');
    ov.querySelectorAll('[data-y]').forEach(b => b.addEventListener('click', async () => { ov.remove(); await nmMarkChallengeDay(id, st.yesterday, b.dataset.y); }));
}

async function nmStartChallenge(key, startDate) {
    const def = nmChDef(key);
    if (!def || !supabaseClient || !currentUserId) return false;
    const today = getLocalDateString();
    if (!(startDate >= today && startDate <= nmAddDays(today, NEW_ME_CH_START_AHEAD))) { showAppToast(t('nm_ch_date_invalid'), 'error'); return false; }
    // גדול אחד + מיני אחד במקביל: אתגר חדש מאותו סוג מחליף את הקודם (האזהרה מוצגת לפני הלחיצה)
    const current = nmChActiveOfKind(def.kind);
    if (current && !(await nmSetChallengeStatus(current, 'cancelled'))) { showAppToast(t('nm_save_error'), 'error'); return false; }
    const row = { user_id: currentUserId, challenge_key: key, kind: def.kind, start_date: startDate, days: def.days, free_days: nmChFreeDays(def.days), status: 'active' };
    const { data, error } = await supabaseClient.from('new_me_challenges').insert(row).select().single();
    if (error || !data) { showAppToast(t('nm_save_error'), 'error'); return false; }
    nmChallenges.push(data);
    showAppToast(startDate === today ? t('nm_ch_started_toast') : t('nm_ch_scheduled_toast').replace('{date}', nmLongDate(startDate)));
    nmAfterChallengeChange();
    // אימון שכבר נרשם היום / ארוחות שכבר סומנו - נספרים מיד
    if (startDate === today && def.auto) nmChallengeAutoCheck(def.auto);
    return true;
}

async function nmCancelChallenge(id) {
    const c = nmChallenges.find(x => x.id === id);
    if (!c) return;
    if (!(await nmSetChallengeStatus(c, 'cancelled'))) { showAppToast(t('nm_save_error'), 'error'); return; }
    showAppToast(t('nm_ch_cancelled_toast'));
    nmAfterChallengeChange();
}

// ✓ לבד: אימון של 20 דקות לפחות היום ("שבועיים של תנועה"), או 3 ארוחות מהתפריט ("21 ימים
// לפי התפריט"). רק מסמנים - לא מורידים סימון (ביטול ✓ בארוחה לא מוחק את היום באתגר)
async function nmChallengeAutoCheck(trigger) {
    if (!nmChallengesLoaded || !supabaseClient || !currentUserId) return;
    const today = getLocalDateString();
    for (const c of nmChActive()) {
        const def = nmChDef(c.challenge_key);
        if (!def.auto || (trigger && def.auto !== trigger)) continue;
        const st = nmChState(c);
        if (!st.canToday || st.marks[today]) continue;
        let ok = false;
        if (def.auto === 'menu') ok = !!nmProfile && nmActiveOrder().filter(s => nmTodayCheckins[s]).length >= nmGoodDayChecks();
        else if (def.auto === 'sport') {
            const { data } = await supabaseClient.from('sport_sessions').select('duration_minutes').eq('user_id', currentUserId).eq('session_date', today);
            ok = (data || []).reduce((a, r) => a + (Number(r.duration_minutes) || 0), 0) >= NEW_ME_CH_SPORT_MIN;
        }
        if (!ok) continue;
        await nmMarkChallengeDay(c.id, today, 'done');
        if (c.status === 'active') showAppToast(t('nm_ch_auto_toast').replace('{title}', nmChTitle(c.challenge_key)));
    }
}

function nmCelebrateChallenge(c) {
    const def = nmChDef(c.challenge_key);
    const n = nmChDoneCount(), total = NEW_ME_CHALLENGES.length;
    const all = n >= total;
    const ov = nmOpenSheet(`
        <div class="nm-celebrate-eyebrow">🏆 ${nmEsc(nmChKindLabel(c.kind))}</div>
        <div class="nm-medal big" aria-hidden="true"><span>${def.icon}</span></div>
        <h3 class="nm-celebrate-title">${nmEsc(t('nm_ch_complete_title'))}</h3>
        <p class="nm-celebrate-desc"><b>${nmEsc(nmChTitle(c.challenge_key))}</b></p>
        <p class="nm-celebrate-desc">${all ? nmEsc(t('nm_ch_all_done_desc')) : nmTpl('nm_ch_complete_desc', { n: nmFmt(n), total: nmFmt(total) })}</p>
        <div class="nm-celebrate-actions">
            <button type="button" class="nm-btn-ghost" data-share>${nmEsc(t('nm_share'))}</button>
            <button type="button" class="nm-btn-primary" data-ok>${nmEsc(all ? t('nm_gift_open') : t('nm_celebrate_ok'))}</button>
        </div>`, 'nm-celebrate');
    const sheet = ov.querySelector('.nm-sheet');
    ov.querySelector('[data-share]').addEventListener('click', () => {
        ov.remove();
        openSharePicker(`${shareBold(t('nm_ch_share_text'))}\n\n${def.icon} ${nmChTitle(c.challenge_key)}\n✨ ${t('nm_ch_complete_desc').replace('{n}', n).replace('{total}', total)}`);
    });
    ov.querySelector('[data-ok]').addEventListener('click', () => { ov.remove(); if (all) nmGo('gift'); });
    if (typeof spawnGentleConfettiBurst === 'function') {
        setTimeout(() => spawnGentleConfettiBurst(sheet, all ? 60 : 40), 150);
        setTimeout(() => spawnGentleConfettiBurst(sheet, all ? 40 : 24), 550);
    }
}

// ---------- הצצה להיום / לוח השנה ----------
// כל פריט: { icon, text, tag, done, toggle(checked) } - אותה שורה כמו משימות היעדים (buildPeekGoalTaskRow)
function getPeekChallengeItems() {
    if (!hasNewMe || !nmChallengesLoaded) return [];
    return nmChActive().map(c => {
        const st = nmChState(c);
        if (!st.canToday) return null;
        const mark = st.marks[st.today];
        return {
            icon: nmChDef(c.challenge_key).icon,
            text: nmChTask(c.challenge_key) + (mark === 'free' ? ` · 🍕 ${t('nm_ch_free_btn')}` : ''),
            tag: nmChTitle(c.challenge_key),
            done: !!mark,
            toggle: checked => nmMarkChallengeDay(c.id, st.today, checked ? 'done' : null),
        };
    }).filter(Boolean);
}
// יום אחר בלוח השנה - לקריאה בלבד: מה סומן (עבר) / מה מתוכנן (עתיד) באתגרים הפעילים
function nmChallengeCalendarItems(dateStr) {
    if (!hasNewMe || !nmChallengesLoaded) return [];
    const today = getLocalDateString();
    return nmChActive().filter(c => dateStr >= c.start_date && dateStr <= nmChEnd(c)).map(c => {
        const mark = (nmChallengeDays.find(d => d.challenge_id === c.id && d.day === dateStr) || {}).state;
        if (dateStr < today && !mark) return null;
        return { icon: nmChDef(c.challenge_key).icon, text: nmChTask(c.challenge_key) + (mark === 'free' ? ` · 🍕 ${t('nm_ch_free_btn')}` : ''), tag: nmChTitle(c.challenge_key), done: !!mark };
    }).filter(Boolean);
}

// ---------- המסך הראשי: האתגרים הפעילים בראש התפריט של היום ----------
function nmChallengeStripHtml() {
    if (!nmChallengesLoaded) return '';
    const cards = nmChActive().map(c => nmChallengeCardHtml(c, 'home')).concat(nmChEndedNotices().map(nmChallengeEndedHtml));
    if (!cards.length) return nmChallengeInviteHtml();
    return `
        <div class="nm-ch-strip">
            <div class="nm-ch-strip-head">
                <span>🏆 ${nmEsc(t('nm_ch_active_title'))}</span>
                <button type="button" class="nm-link-btn" onclick="nmGo('challenges')">${nmEsc(t('nm_ch_all'))}</button>
            </div>
            ${cards.join('')}
        </div>`;
}

// mode: 'home' (קומפקטי, בראש התפריט) | 'view' (מסך האתגרים, עם לוח הימים) | 'sheet' (בתוך גיליון האתגר)
function nmChallengeCardHtml(c, mode) {
    const def = nmChDef(c.challenge_key);
    const st = nmChState(c);
    const title = nmChTitle(c.challenge_key);
    const task = nmChTask(c.challenge_key);
    const full = mode !== 'home';
    // בתוך הגיליון השם והאייקון כבר בכותרת שלו - בכרטיס רק היום והמשימה
    const head = sub => mode === 'sheet' ? `
        <div class="nm-ch-head">
            <div class="nm-ch-head-text">
                <span class="nm-ch-kind">${sub}</span>
                <b class="nm-ch-title">${nmEsc(task)}</b>
            </div>` : `
        <div class="nm-ch-head">
            <span class="nm-ch-icon" aria-hidden="true">${def.icon}</span>
            <button type="button" class="nm-ch-head-text" onclick="nmOpenChallenge('${c.challenge_key}')">
                <span class="nm-ch-kind">${sub}</span>
                <b class="nm-ch-title">${nmEsc(title)}</b>
            </button>`;
    if (st.scheduled) {
        const starts = nmDaysBetween(st.today, c.start_date) === 1 ? nmEsc(t('nm_ch_starts_tomorrow')) : nmEsc(t('nm_ch_starts_on').replace('{date}', nmLongDate(c.start_date)));
        return `
            <div class="nm-ch-card kind-${c.kind} is-scheduled" data-ch="${c.id}">
                ${head(`${nmEsc(nmChKindLabel(c.kind))} · ⏳ ${starts}`)}
                </div>
                <p class="nm-fine">${task !== title ? `${nmEsc(task)} · ` : ''}${nmEsc(t('nm_ch_days_n').replace('{n}', nmFmt(c.days)))}${c.free_days ? ` · 🍕 ${nmFmt(c.free_days)}` : ''}</p>
            </div>`;
    }
    const mark = st.marks[st.today];
    const pct = Math.min(100, Math.round((st.done / Math.max(1, st.needed)) * 100));
    const extra = [];
    if (def.budget && nmProfile && !full) {
        const left = nmProfile.plan + (nmBurnedToday || 0) - nmEatenToday().kcal;
        extra.push(`<div class="nm-ch-extra">${nmTpl(left >= 0 ? 'nm_ch_budget_left' : 'nm_ch_budget_over', { n: nmFmt(Math.abs(Math.round(left))) })}</div>`);
    }
    if (def.weight) {
        const w = nmChWeightChange(c);
        if (w) extra.push(`<div class="nm-ch-extra">⚖️ ${nmTpl('nm_ch_weight_line', { n: (w > 0 ? '+' : '−') + nmFmtNum(Math.abs(w), 1) })}</div>`);
    }
    if (def.auto && full) extra.push(`<div class="nm-ch-extra">🤖 ${nmEsc(t(def.auto === 'menu' ? 'nm_ch_auto_menu_note' : 'nm_ch_auto_sport_note'))}</div>`);
    const yesterdayOpen = st.canYesterday && !st.marks[st.yesterday];
    return `
        <div class="nm-ch-card kind-${c.kind}" data-ch="${c.id}">
            ${head(`${nmEsc(nmChKindLabel(c.kind))} · ${nmTpl('nm_ch_day_of', { n: nmFmt(st.dayN), total: nmFmt(c.days) })}`)}
                <button type="button" class="nm-check${mark === 'done' ? ' on' : ''}" onclick="nmMarkChallengeDay('${c.id}', '${st.today}', 'done')" aria-pressed="${mark === 'done'}" aria-label="${nmEsc(t('nm_ch_mark_today'))}" title="${nmEsc(t('nm_ch_mark_today'))}">${NM_CHECK_SVG}</button>
            </div>
            ${task !== title && mode !== 'sheet' ? `<div class="nm-ch-task">${nmEsc(task)}</div>` : ''}
            <div class="nm-ch-progress">
                <span class="nm-progress"><span style="width:${Math.max(3, pct)}%"></span></span>
                <span class="nm-ch-count" title="${nmEsc(t('nm_ch_progress_line').replace('{done}', st.done).replace('{needed}', st.needed))}"><bdi dir="ltr">${nmFmt(st.done)}/${nmFmt(st.needed)}</bdi></span>
            </div>
            ${full ? nmChGridHtml(c, st) : ''}
            ${extra.join('')}
            <div class="nm-ch-actions">
                ${c.free_days ? `<button type="button" class="nm-chip${mark === 'free' ? ' on' : ''}" onclick="nmMarkChallengeDay('${c.id}', '${st.today}', 'free')" ${st.freeLeft > 0 || mark === 'free' ? '' : 'disabled'} title="${nmEsc(t('nm_ch_free_left').replace('{n}', Math.max(0, st.freeLeft)))}">🍕 ${nmEsc(t('nm_ch_free_btn'))} · <bdi dir="ltr">${nmFmt(Math.max(0, st.freeLeft))}</bdi></button>` : ''}
                ${yesterdayOpen ? `<button type="button" class="nm-link-btn" onclick="nmAskChallengeYesterday('${c.id}')">${nmEsc(t('nm_ch_yesterday_q'))}</button>` : ''}
                ${full ? '' : `<button type="button" class="nm-link-btn nm-ch-more" onclick="nmOpenChallenge('${c.challenge_key}')">${nmEsc(t('nm_ch_details'))}</button>`}
            </div>
        </div>`;
}

// משקל: השקילה האחרונה עד תחילת האתגר מול השקילה האחרונה היום (מטבלת המשקל המשותפת)
function nmChWeightChange(c) {
    const list = (typeof nmWeights !== 'undefined' ? nmWeights : []).filter(w => Number(w.weight_value) > 0);
    if (!list.length) return 0;
    const before = list.filter(w => w.weight_date <= c.start_date).pop() || (nmProfile && nmProfile.start_weight ? { weight_value: nmProfile.start_weight } : null);
    const latest = list[list.length - 1];
    if (!before || latest.weight_date <= c.start_date) return 0;
    return Math.round((Number(latest.weight_value) - Number(before.weight_value)) * 10) / 10;
}

function nmChGridHtml(c, st) {
    const lastFinal = nmAddDays(st.today, -2);
    const cells = Array.from({ length: c.days }, (_, i) => {
        const d = nmAddDays(c.start_date, i);
        const s = st.marks[d];
        const cls = s === 'done' ? 'done' : s === 'free' ? 'free' : d > st.today ? 'future' : d <= lastFinal ? 'missed' : 'open';
        return `<span class="nm-ch-cell ${cls}${d === st.today ? ' today' : ''}" title="${nmEsc(nmShortDate(d))}">${s === 'done' ? '✓' : s === 'free' ? '🍕' : nmFmt(i + 1)}</span>`;
    });
    return `<div class="nm-ch-grid" aria-hidden="true">${cells.join('')}</div><p class="nm-fine nm-ch-legend">${nmEsc(t('nm_ch_legend'))}</p>`;
}

// אתגר שהסתיים בלי השלמה - הודעה עדינה פעם אחת (עד שסוגרים), עם התחלה מחדש
function nmChSeenEnded() { try { return JSON.parse(localStorage.getItem('weekwise_nm_ch_seen_ended') || '[]'); } catch { return []; } }
function nmChEndedNotices() {
    const seen = nmChSeenEnded();
    const recent = nmAddDays(getLocalDateString(), -14);
    return nmChallenges.filter(c => c.status === 'ended' && nmChDef(c.challenge_key) && !seen.includes(c.id) && nmChEnd(c) >= recent && !nmChActiveOfKey(c.challenge_key));
}
function nmDismissEndedChallenge(id) {
    const seen = nmChSeenEnded().concat(id).slice(-40);
    try { localStorage.setItem('weekwise_nm_ch_seen_ended', JSON.stringify(seen)); } catch {}
    nmAfterChallengeChange();
}
function nmChallengeEndedHtml(c) {
    const def = nmChDef(c.challenge_key);
    return `
        <div class="nm-ch-card kind-${c.kind} is-ended" data-ch="${c.id}">
            <div class="nm-ch-head">
                <span class="nm-ch-icon" aria-hidden="true">${def.icon}</span>
                <div class="nm-ch-head-text"><span class="nm-ch-kind">${nmEsc(t('nm_ch_ended_title'))}</span><b class="nm-ch-title">${nmEsc(nmChTitle(c.challenge_key))}</b></div>
                <button type="button" class="nm-ch-x" onclick="nmDismissEndedChallenge('${c.id}')" aria-label="${nmEsc(t('close_btn'))}">✕</button>
            </div>
            <p class="nm-fine">${nmEsc(t('nm_ch_ended_desc'))}</p>
            <div class="nm-ch-actions"><button type="button" class="nm-chip" onclick="nmOpenChallenge('${c.challenge_key}')">${nmEsc(t('nm_ch_restart'))}</button></div>
        </div>`;
}

// אין אתגר פעיל: הזמנה כללית לבחור אתגר - בלי להחליט במקום המשתמש/ת איזה (לפי בקשה מפורשת:
// "שהמשתמש יבחר איזה אתגר ומתי להתחיל"). פותחת את רשימת כל האתגרים; אפשר להסתיר עד השבוע הבא
function nmChallengeInviteHtml() {
    let hidden = null;
    try { hidden = localStorage.getItem('weekwise_nm_ch_suggest_hidden'); } catch {}
    if (hidden === nmWeekStart()) return '';
    return `
        <div class="nm-ch-suggest nm-ch-invite">
            <span class="nm-ch-icon" aria-hidden="true">🏆</span>
            <button type="button" class="nm-ch-suggest-text" onclick="nmGo('challenges')">
                <b>${nmEsc(t('nm_tile_challenges'))}</b>
                <span class="nm-fine">${nmEsc(t('nm_ch_choose_sub').replace('{n}', nmFmt(NEW_ME_CHALLENGES.length)))}</span>
                <span class="nm-ch-invite-btn">${nmEsc(t('nm_ch_choose_btn'))}</span>
            </button>
            <button type="button" class="nm-ch-x" onclick="nmHideChallengeSuggest()" aria-label="${nmEsc(t('nm_ch_not_now'))}" title="${nmEsc(t('nm_ch_not_now'))}">✕</button>
        </div>`;
}
function nmHideChallengeSuggest() {
    try { localStorage.setItem('weekwise_nm_ch_suggest_hidden', nmWeekStart()); } catch {}
    nmRenderView(nmRoot());
}

// ---------- מסך האתגרים ----------
function nmRenderChallenges(body) {
    const n = nmChDoneCount(), total = NEW_ME_CHALLENGES.length;
    const done = nmChDoneKeys();
    const active = nmChActive();
    const shelf = kind => NEW_ME_CHALLENGES.filter(c => c.kind === kind).map(c => `<span class="nm-ch-medal${done.has(c.key) ? ' on' : ''}" title="${nmEsc(nmChTitle(c.key))}">${c.icon}</span>`).join('');
    body.innerHTML = `
        <div class="nm-ch-hero${nmChAllDone() ? ' is-open' : ''}">
            <div class="nm-ch-hero-top">
                <span class="nm-ch-trophy" aria-hidden="true">🏆</span>
                <div class="nm-ch-hero-num"><b class="nm-num"><bdi dir="ltr">${nmFmt(n)}/${nmFmt(total)}</bdi></b><span>${nmEsc(t('nm_ch_completed_label'))}</span></div>
            </div>
            <div class="nm-ch-shelf" aria-hidden="true"><div>${shelf('big')}</div><div>${shelf('mini')}</div></div>
            <span class="nm-progress"><span style="width:${Math.max(3, Math.round((n / total) * 100))}%"></span></span>
            ${nmChAllDone()
                ? `<button type="button" class="nm-btn-primary nm-gift-btn" onclick="nmGo('gift')">🎁 ${nmEsc(t('nm_gift_open'))}</button>`
                : `<div class="nm-ch-gift-line"><span aria-hidden="true">🎁</span><span>${nmEsc(t('nm_ch_gift_locked'))} · <b>${nmEsc(t('nm_ch_gift_left').replace('{n}', nmFmt(total - n)))}</b></span></div>`}
        </div>
        ${active.length || nmChEndedNotices().length ? `
        <section class="nm-ch-section">
            <div class="nm-section-head"><h3>${nmEsc(t('nm_ch_active_title'))}</h3></div>
            ${active.map(c => nmChallengeCardHtml(c, 'home')).join('')}
            ${nmChEndedNotices().map(nmChallengeEndedHtml).join('')}
        </section>` : ''}
        <p class="nm-ch-list-hint">👆 ${nmEsc(t('nm_ch_list_hint'))}</p>
        ${['big', 'mini'].map(kind => `
        <section class="nm-ch-section">
            <div class="nm-section-head"><h3>${nmEsc(t(kind === 'big' ? 'nm_ch_kind_big' : 'nm_ch_kind_mini'))}</h3></div>
            <p class="nm-fine nm-ch-section-sub">${nmEsc(t(kind === 'big' ? 'nm_ch_kind_big_sub' : 'nm_ch_kind_mini_sub'))}</p>
            <div class="nm-ch-list">${NEW_ME_CHALLENGES.filter(c => c.kind === kind).map(nmChRowHtml).join('')}</div>
        </section>`).join('')}
        <p class="nm-fine nm-rule">${nmEsc(t('nm_ch_rule'))}</p>
        ${nmLetterCardHtml()}`;
}

function nmChRowHtml(def) {
    const act = nmChActiveOfKey(def.key);
    const isDone = !!nmChLastDone(def.key);
    const status = act ? (nmChState(act).scheduled ? t('nm_ch_status_soon') : t('nm_ch_status_active')) : isDone ? t('nm_ch_status_done') : '';
    return `
        <button type="button" class="nm-ch-row${isDone ? ' done' : ''}${act ? ' active' : ''}" onclick="nmOpenChallenge('${def.key}')">
            <span class="nm-ch-icon" aria-hidden="true">${def.icon}</span>
            <span class="nm-ch-row-text"><b>${nmEsc(nmChTitle(def.key))}</b><span>${nmEsc(t('nm_ch_days_n').replace('{n}', nmFmt(def.days)))}${def.days >= 7 ? ` · 🍕 ${nmFmt(nmChFreeDays(def.days))}` : ''}</span></span>
            ${status ? `<span class="nm-ch-status">${nmEsc(status)}</span>` : ''}
        </button>`;
}

// גיליון אתגר: פרטים, ולפי המצב - התחלה (מתי מתחילים?) או התקדמות + הפסקה
function nmOpenChallenge(key) {
    const def = nmChDef(key);
    if (!def) return;
    const today = getLocalDateString();
    const tomorrow = nmAddDays(today, 1);
    const nextWeek = nmAddDays(nmWeekStart(), 7);
    // בלי יום התחלה שנבחר מראש - המשתמש/ת בוחר/ת מתי מתחילים (הכפתור נפתח רק אחרי הבחירה)
    let sel = null, other = false, otherDate = nmAddDays(today, 2), confirmCancel = false;
    const ov = nmOpenSheet('', 'nm-ch-sheet');
    const sheet = ov.querySelector('.nm-sheet');
    const render = () => {
        const act = nmChActiveOfKey(key);
        const last = nmChLastDone(key);
        const sameKind = act ? null : nmChActiveOfKind(def.kind);
        const free = nmChFreeDays(def.days);
        const facts = `
            <div class="nm-ch-facts">
                <span>📅 ${nmEsc(t('nm_ch_days_n').replace('{n}', nmFmt(def.days)))}</span>
                <span>🍕 ${nmEsc(nmChFreeLine(free))}</span>
                ${def.auto ? `<span>🤖 ${nmEsc(t(def.auto === 'menu' ? 'nm_ch_auto_menu_note' : 'nm_ch_auto_sport_note'))}</span>` : ''}
            </div>`;
        let main;
        if (act) {
            main = `
                ${nmChallengeCardHtml(act, 'sheet')}
                ${confirmCancel
                    ? `<p class="nm-soft-warn">${nmEsc(t('nm_ch_cancel_confirm'))}</p>
                       <button type="button" class="nm-row-btn nm-danger" data-cancel-yes>${nmEsc(t('nm_ch_cancel'))}</button>`
                    : `<button type="button" class="nm-row-btn nm-danger" data-cancel>${nmEsc(t('nm_ch_cancel'))}</button>`}`;
        } else {
            const opts = [['today', today, t('nm_ch_start_today')], ['tomorrow', tomorrow, t('nm_ch_start_tomorrow')]];
            if (nextWeek > tomorrow) opts.push(['week', nextWeek, `${t('nm_ch_start_next_week')} · ${nmShortDate(nextWeek)}`]);
            main = `
                ${last ? `<p class="nm-fine nm-ch-done-before">✓ ${nmEsc(t('nm_ch_done_on').replace('{date}', nmLongDate(String(last.completed_at || '').slice(0, 10) || today)))}</p>` : ''}
                <div class="nm-sheet-label">${nmEsc(t('nm_ch_start_title'))}</div>
                <div class="nm-chip-row">
                    ${opts.map(([k, d, label]) => `<button type="button" class="nm-pick${!other && sel === d ? ' on' : ''}" data-start-day="${d}">${nmEsc(label)}</button>`).join('')}
                    <button type="button" class="nm-pick${other ? ' on' : ''}" data-start-other>${nmEsc(t('nm_ch_start_other'))}</button>
                </div>
                ${other ? `<input type="date" class="nm-date" data-start-date value="${otherDate}" min="${today}" max="${nmAddDays(today, NEW_ME_CH_START_AHEAD)}" aria-label="${nmEsc(t('nm_ch_start_other'))}">` : ''}
                ${sameKind ? `<p class="nm-soft-warn">${nmEsc(t(def.kind === 'big' ? 'nm_ch_replace_big' : 'nm_ch_replace_mini').replace('{title}', nmChTitle(sameKind.challenge_key)))}</p>` : ''}
                <button type="button" class="nm-btn-primary" data-start ${other || sel ? '' : 'disabled'}>${nmEsc(t('nm_ch_start_btn'))}</button>`;
        }
        sheet.innerHTML = `
            <span class="nm-sheet-grip" aria-hidden="true"></span>
            <div class="nm-ch-sheet-head">
                <span class="nm-ch-icon big" aria-hidden="true">${def.icon}</span>
                <div><span class="nm-ch-kind">${nmEsc(nmChKindLabel(def.kind))}</span><h4>${nmEsc(nmChTitle(key))}</h4></div>
            </div>
            <p class="nm-ch-desc">${nmEsc(t('nm_ch_' + key + '_desc'))}</p>
            ${key === 'lose5_month' ? `<p class="nm-soft-warn">💛 ${nmEsc(t('nm_ch_lose5_note'))}</p>` : ''}
            ${act ? '' : facts}
            ${main}
            <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_back'))}</button>`;
        sheet.querySelectorAll('[data-start-day]').forEach(b => b.addEventListener('click', () => { sel = b.dataset.startDay; other = false; render(); }));
        const ob = sheet.querySelector('[data-start-other]');
        if (ob) ob.addEventListener('click', () => { other = true; render(); });
        const di = sheet.querySelector('[data-start-date]');
        if (di) di.addEventListener('change', () => { otherDate = di.value; });
        const sb = sheet.querySelector('[data-start]');
        if (sb) sb.addEventListener('click', async () => {
            sb.disabled = true;
            const ok = await nmStartChallenge(key, other ? otherDate : sel);
            if (ok) ov.remove(); else sb.disabled = false;
        });
        const cb = sheet.querySelector('[data-cancel]');
        if (cb) cb.addEventListener('click', () => { confirmCancel = true; render(); });
        const cy = sheet.querySelector('[data-cancel-yes]');
        if (cy) cy.addEventListener('click', async () => { ov.remove(); await nmCancelChallenge(nmChActiveOfKey(key).id); });
    };
    // סימון מתוך הגיליון (✓ / 🍕 / אתמול) - הגיליון נשאר פתוח ומתרענן; אתגר שהושלם - נסגר (חגיגה)
    const wasActive = !!nmChActiveOfKey(key);
    nmChSheetRefresh = () => {
        if (!ov.isConnected) { nmChSheetRefresh = null; return; }
        if (wasActive && !nmChActiveOfKey(key)) { ov.remove(); nmChSheetRefresh = null; return; }
        if (sheet.contains(document.activeElement) && document.activeElement.matches('input')) return;
        render();
    };
    render();
}

// ---------- מכתב מהעבר ----------
// נכתב בשאלון (או אחר כך ממסך האתגרים), נחתם - ואי אפשר לקרוא או לערוך אותו עד שכל 20 האתגרים
// הושלמו. אז הוא נפתח כחלק מהמתנה
// מעטפה: חתומה (חותם שעווה) או פתוחה עם דף שמציץ ממנה
function nmEnvelopeSvg(sealed) {
    if (sealed) return `<svg viewBox="0 0 64 48" aria-hidden="true"><rect x="2" y="4" width="60" height="40" rx="6" class="env-body"/><path d="M3.5 7.5L32 28 60.5 7.5" class="env-flap"/><circle cx="32" cy="28" r="7.5" class="env-seal"/><path d="M32 23.6l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5z" class="env-star"/></svg>`;
    return `<svg viewBox="0 0 64 56" aria-hidden="true"><rect x="2" y="22" width="60" height="32" rx="3" class="env-back"/><rect x="11" y="3" width="42" height="34" rx="3" class="env-paper"/><path d="M17 11h30M17 17h24M17 23h28" class="env-lines"/><path d="M2 22L32 42 62 22V51a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z" class="env-body"/><path d="M2 22L32 42 62 22" class="env-flap"/></svg>`;
}

function nmLetterCardHtml() {
    const total = NEW_ME_CHALLENGES.length;
    if (nmProfile && nmProfile.letter_written_at) {
        const open = nmChAllDone();
        return `
            <${open ? `button type="button" onclick="nmGo('gift')"` : 'div'} class="nm-letter-card sealed${open ? ' ready' : ''}">
                <span class="nm-envelope">${nmEnvelopeSvg(true)}</span>
                <span class="nm-letter-text">
                    <b>✉️ ${nmEsc(t('nm_letter_title'))}</b>
                    <span class="nm-fine">${nmEsc(t('nm_letter_sealed_line').replace('{date}', nmLongDate(String(nmProfile.letter_written_at).slice(0, 10))).replace('{n}', nmFmt(total)))}</span>
                </span>
            </${open ? 'button' : 'div'}>`;
    }
    return `
        <div class="nm-letter-card">
            <span class="nm-envelope">${nmEnvelopeSvg(false)}</span>
            <span class="nm-letter-text">
                <b>✉️ ${nmEsc(t('nm_letter_title'))}</b>
                <span class="nm-fine">${nmEsc(t('nm_letter_intro').replace('{n}', nmFmt(total)))}</span>
                <button type="button" class="nm-chip" onclick="nmOpenLetterSheet()">${nmEsc(t('nm_letter_write'))}</button>
            </span>
        </div>`;
}

function nmOpenLetterSheet() {
    const ov = nmOpenSheet(`
        <h4>✉️ ${nmEsc(t('nm_letter_title'))}</h4>
        <p class="nm-fine">${nmEsc(t('nm_letter_intro').replace('{n}', nmFmt(NEW_ME_CHALLENGES.length)))}</p>
        <textarea class="nm-letter-input" rows="8" maxlength="4000" placeholder="${nmEsc(t('nm_letter_ph'))}" aria-label="${nmEsc(t('nm_letter_title'))}"></textarea>
        <p class="nm-fine">🔒 ${nmEsc(t('nm_letter_seal_note'))}</p>
        <button type="button" class="nm-btn-primary" data-seal>${nmEsc(t('nm_letter_seal'))}</button>
        <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('nm_back'))}</button>`, 'nm-letter-sheet');
    const ta = ov.querySelector('.nm-letter-input');
    ov.querySelector('[data-seal]').addEventListener('click', async e => {
        const btn = e.currentTarget;
        btn.disabled = true;
        const ok = await nmSealLetter(ta.value);
        if (ok) ov.remove(); else btn.disabled = false;
    });
    setTimeout(() => ta.focus(), 120);
}

async function nmSealLetter(text) {
    const letter = String(text || '').trim().slice(0, 4000);
    if (letter.length < NEW_ME_LETTER_MIN) { showAppToast(t('nm_letter_too_short'), 'error'); return false; }
    const fields = { letter_text: letter, letter_written_at: new Date().toISOString(), letter_opened_at: null, updated_at: new Date().toISOString() };
    const { error } = await supabaseClient.from('new_me_profile').update(fields).eq('user_id', currentUserId);
    if (error) { showAppToast(t('nm_save_error'), 'error'); return false; }
    Object.assign(nmProfile, fields);
    showAppToast(t('nm_letter_sealed_toast'));
    if (nmView === 'challenges') nmRenderView(nmRoot());
    return true;
}

// ---------- המתנה (אחרי כל 20 האתגרים): המכתב, תעודת הוקרה, מצב מתקדם ----------
// God Mode (מצב מתקדם) - נפתח רק אחרי כל האתגרים, ואפשר לכבות/להדליק. כשפעיל: מראה זהב בכל
// New Me, החלפות בלי מגבלת קלוריות (בניית תפריט חופשית) ומסך סטטיסטיקות מתקדמות
function nmGodModeActive() { return !!(nmProfile && nmProfile.god_mode && nmChAllDone()); }

// התאריך שבו הושלם האתגר ה-20 (השלמה ראשונה של כל אחד מהם)
function nmChAllDoneDate() {
    const first = {};
    nmChallenges.filter(c => c.status === 'done' && c.completed_at && nmChDef(c.challenge_key)).forEach(c => {
        if (!first[c.challenge_key] || c.completed_at < first[c.challenge_key]) first[c.challenge_key] = c.completed_at;
    });
    const vals = Object.values(first).sort();
    return vals.length ? String(vals[vals.length - 1]).slice(0, 10) : getLocalDateString();
}

// סיכום הדרך על התעודה (לפי בקשה מפורשת: "כל סיכום הדרך וההישגים בתזונה ובאורח חיים בריא"):
// ימים במסע, אתגרים, ק"ג (או הרצף הארוך), ימים טובים, הישגים, ואימונים (או ארוחות מהתפריט עם ✓)
let nmGiftWorkouts = null;
async function nmLoadGiftExtras() {
    if (nmGiftWorkouts != null) return;
    const { data } = await supabaseClient.from('sport_sessions').select('id').eq('user_id', currentUserId).gte('session_date', nmStartDay());
    nmGiftWorkouts = (data || []).length;
}
function nmGiftStats() {
    const st = nmStreaks();
    const kg = nmKgLost();
    const badges = NEW_ME_BADGES.filter(b => nmBadges[b.key]).length;
    const meals = nmStats.reduce((a, r) => a + (Number(r.checks) || 0), 0);
    return [
        { n: nmFmt(nmJourneyDay()), label: t('nm_cert_stat_days') },
        { n: `${nmFmt(nmChDoneCount())}/${nmFmt(NEW_ME_CHALLENGES.length)}`, label: t('nm_cert_stat_challenges') },
        kg > 0 ? { n: '−' + nmFmtNum(kg, 1), label: t('nm_cert_stat_kg') } : { n: nmFmt(st.best), label: t('nm_cert_stat_streak') },
        { n: nmFmt(st.good), label: t('nm_cert_stat_good') },
        { n: nmFmt(badges), label: t('nm_cert_stat_badges') },
        nmGiftWorkouts > 0 ? { n: nmFmt(nmGiftWorkouts), label: t('nm_cert_stat_workouts') } : { n: nmFmt(meals), label: t('nm_cert_stat_meals') },
    ];
}

let nmCertNameDefault = null;   // השם מחשבון Google (אם יש) - ברירת מחדל לשם על התעודה
async function nmCertDefaultName() {
    if (nmCertNameDefault != null) return nmCertNameDefault;
    nmCertNameDefault = '';
    try {
        const { data } = await supabaseClient.auth.getSession();
        const meta = data && data.session && data.session.user ? data.session.user.user_metadata || {} : {};
        nmCertNameDefault = String(meta.full_name || meta.name || '').trim().slice(0, 40);
    } catch {}
    return nmCertNameDefault;
}
function nmCertName() { return String((nmProfile && nmProfile.cert_name) || nmCertNameDefault || '').trim(); }

function nmRenderGift(body) {
    const total = NEW_ME_CHALLENGES.length;
    if (!nmChAllDone()) {
        body.innerHTML = `
            <div class="nm-gift-locked">
                <div class="nm-medal big locked" aria-hidden="true"><span>🎁</span></div>
                <p class="nm-celebrate-desc">${nmTpl('nm_gift_locked_view', { n: nmFmt(total), left: nmFmt(total - nmChDoneCount()) })}</p>
                <button type="button" class="nm-btn-ghost" onclick="nmGo('challenges')">🏆 ${nmEsc(t('nm_tile_challenges'))}</button>
            </div>`;
        return;
    }
    const p = nmProfile;
    const letterOpen = !!p.letter_opened_at;
    let letterHtml;
    if (!p.letter_written_at) letterHtml = `<p class="nm-fine">${nmEsc(t('nm_letter_none'))}</p>`;
    else if (!letterOpen) letterHtml = `
        <div class="nm-gift-envelope" id="nm-gift-envelope">${nmEnvelopeSvg(true)}</div>
        <button type="button" class="nm-btn-primary nm-gold-btn" onclick="nmOpenLetter(this)">${nmEsc(t('nm_letter_open_btn'))}</button>`;
    else letterHtml = `
        <div class="nm-letter-paper">
            <p class="nm-letter-body">${nmEsc(p.letter_text || '').replace(/\n/g, '<br>')}</p>
            <p class="nm-letter-date">${nmEsc(t('nm_letter_written_on').replace('{date}', nmLongDate(String(p.letter_written_at).slice(0, 10))))}</p>
        </div>`;
    body.innerHTML = `
        <div class="nm-gift-hero">
            <div class="nm-gift-burst" aria-hidden="true">🎁</div>
            <h3>${nmEsc(t('nm_gift_title'))}</h3>
            <p class="nm-fine">${nmTpl('nm_gift_intro', { n: nmFmt(total) })}</p>
        </div>
        <section class="nm-gift-card">
            <h4>✉️ ${nmEsc(t('nm_letter_gift_title'))}</h4>
            ${letterHtml}
        </section>
        <section class="nm-gift-card">
            <h4>🏅 ${nmEsc(t('nm_cert_title'))}</h4>
            <label class="nm-field"><span>${nmEsc(t('nm_cert_name_label'))}</span>
                <input type="text" id="nm-cert-name" maxlength="40" autocomplete="name" value="${nmEsc(nmCertName())}" placeholder="${nmEsc(t('nm_cert_name_ph'))}"></label>
            <div class="nm-cert-frame"><img class="nm-cert-preview" id="nm-cert-preview" alt="${nmEsc(t('nm_cert_title'))}"><div class="nm-loading-inline" id="nm-cert-loading"></div></div>
            <div class="nm-gift-actions">
                <button type="button" class="nm-btn-primary nm-gold-btn" onclick="nmDownloadCertificate(this)">${nmEsc(t('nm_cert_download'))}</button>
                <button type="button" class="nm-btn-ghost" onclick="nmShareCertificate(this)">${nmEsc(t('nm_cert_share'))}</button>
            </div>
        </section>
        <section class="nm-gift-card nm-gift-god">
            <h4>👑 ${nmEsc(t('nm_god_title'))}</h4>
            <p class="nm-fine">${nmEsc(t('nm_god_desc'))}</p>
            <ul class="nm-god-list"><li>${nmEsc(t('nm_god_f1'))}</li><li>${nmEsc(t('nm_god_f2'))}</li><li>${nmEsc(t('nm_god_f3'))}</li></ul>
            <label class="nm-god-switch">
                <span>${nmEsc(t('nm_god_toggle'))}</span>
                <input type="checkbox" role="switch" ${p.god_mode ? 'checked' : ''} onchange="nmSetGodMode(this.checked)">
                <span class="nm-god-switch-track" aria-hidden="true"></span>
            </label>
        </section>`;
    const input = document.getElementById('nm-cert-name');
    let timer = null;
    input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(async () => { await nmSaveCertName(input.value); nmRefreshCertPreview(); }, 500);
    });
    nmCertDefaultName().then(def => { if (!input.value && def && !(p.cert_name)) input.value = def; nmRefreshCertPreview(); });
}

async function nmSaveCertName(value) {
    const name = String(value || '').trim().slice(0, 40) || null;
    if ((nmProfile.cert_name || null) === name) return;
    const { error } = await supabaseClient.from('new_me_profile').update({ cert_name: name, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (!error) nmProfile.cert_name = name;
}

let nmCertSeq = 0;
async function nmRefreshCertPreview() {
    const img = document.getElementById('nm-cert-preview');
    if (!img) return;
    const seq = ++nmCertSeq;
    const input = document.getElementById('nm-cert-name');
    const canvas = await nmDrawCertificate(input ? input.value.trim() : nmCertName());
    if (seq !== nmCertSeq || !img.isConnected) return;
    // תצוגה מקדימה ב-JPEG (מהיר וקל); ההורדה והשיתוף - PNG באיכות מלאה
    img.src = canvas.toDataURL('image/jpeg', 0.9);
    img.classList.add('ready');
    const ld = document.getElementById('nm-cert-loading');
    if (ld) ld.remove();
}

// פתיחת המכתב: המעטפה נפתחת (אנימציה קצרה), ואז הדף עם הטקסט. נרשם מתי נפתח לראשונה
async function nmOpenLetter(btn) {
    if (btn) btn.disabled = true;
    const env = document.getElementById('nm-gift-envelope');
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (env && !reduce) { env.classList.add('opening'); await new Promise(r => setTimeout(r, 900)); }
    const now = new Date().toISOString();
    const { error } = await supabaseClient.from('new_me_profile').update({ letter_opened_at: now }).eq('user_id', currentUserId);
    if (!error) nmProfile.letter_opened_at = now; else nmProfile.letter_opened_at = nmProfile.letter_opened_at || now;
    nmRenderView(nmRoot());
    const paper = document.querySelector('.nm-letter-paper');
    if (paper) {
        paper.classList.add('just-opened');
        if (typeof spawnGentleConfettiBurst === 'function') setTimeout(() => spawnGentleConfettiBurst(paper, 30), 200);
    }
}

async function nmSetGodMode(on) {
    const { error } = await supabaseClient.from('new_me_profile').update({ god_mode: !!on, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    if (error) { showAppToast(t('nm_save_error'), 'error'); nmRenderView(nmRoot()); return; }
    nmProfile.god_mode = !!on;
    showAppToast(t(on ? 'nm_god_on_toast' : 'nm_god_off_toast'));
    nmRenderView(nmRoot());
}

// ---------- תעודת ההוקרה: קנבס 1080×1350 (מתאים לפיד/סטורי), זכוכית וזהב ----------
let nmCertFontReady = null;
function nmLoadCertFont() {
    if (nmCertFontReady) return nmCertFontReady;
    nmCertFontReady = new Promise(resolve => {
        const done = () => Promise.all(['700 80px "Frank Ruhl Libre"', '500 40px "Frank Ruhl Libre"'].map(f => document.fonts.load(f).catch(() => null))).then(() => resolve(), () => resolve());
        let link = document.getElementById('nm-cert-font');
        if (!link) {
            link = document.createElement('link');
            link.id = 'nm-cert-font';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&display=block';
            link.onload = done;
            link.onerror = () => resolve();
            document.head.appendChild(link);
        } else done();
        setTimeout(resolve, 3000);
    });
    return nmCertFontReady;
}

async function nmDrawCertificate(name) {
    await Promise.all([nmLoadCertFont(), nmLoadGiftExtras().catch(() => {})]);
    const W = 1080, H = 1350, cx = W / 2;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const rtl = (document.documentElement.dir || getComputedStyle(document.body).direction) === 'rtl';
    const serif = '"Frank Ruhl Libre", "Noto Serif", Georgia, "Times New Roman", serif';
    const sans = 'Poppins, "Playpen Sans Hebrew", "Segoe UI", Roboto, sans-serif';
    const gold = (x0, y0, x1, y1) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, '#fff3c8'); g.addColorStop(0.28, '#f3c75e'); g.addColorStop(0.52, '#b8842a'); g.addColorStop(0.76, '#f7dc8e'); g.addColorStop(1, '#c8952e');
        return g;
    };
    const rr = (x, y, w, h, r) => { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); };
    // רקע: לילה סגול עמוק עם הילות צבע רכות וניצוצות
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#1d0f36'); bg.addColorStop(0.55, '#130a26'); bg.addColorStop(1, '#0a0615');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = (x, y, r, color) => { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); };
    glow(170, 210, 540, 'rgba(139, 92, 246, 0.48)');
    glow(960, 430, 500, 'rgba(236, 72, 153, 0.34)');
    glow(540, 1290, 600, 'rgba(245, 199, 107, 0.32)');
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 70; i++) {
        const x = rnd() * W, y = rnd() * H, r = 0.6 + rnd() * 1.8;
        ctx.fillStyle = `rgba(255, 240, 200, ${0.15 + rnd() * 0.5})`;
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // לוח זכוכית: מילוי שקוף, ברק עליון ומסגרת זהב כפולה
    rr(60, 60, W - 120, H - 120, 48);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)'; ctx.fill();
    const sheen = ctx.createLinearGradient(0, 60, 0, 760);
    sheen.addColorStop(0, 'rgba(255, 255, 255, 0.17)'); sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = sheen; ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = gold(60, 60, W - 60, H - 60); ctx.stroke();
    rr(80, 80, W - 160, H - 160, 34);
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255, 233, 180, 0.38)'; ctx.stroke();
    // קישוטי פינות: יהלום זהב וקווים דקים
    [[104, 104, 1, 1], [W - 104, 104, -1, 1], [104, H - 104, 1, -1], [W - 104, H - 104, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.fillStyle = gold(x - 12, y - 12, x + 12, y + 12);
        ctx.beginPath(); ctx.moveTo(x, y - 11); ctx.lineTo(x + 11, y); ctx.lineTo(x, y + 11); ctx.lineTo(x - 11, y); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(243, 199, 94, 0.7)'; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(x + sx * 20, y); ctx.lineTo(x + sx * 90, y); ctx.moveTo(x, y + sy * 20); ctx.lineTo(x, y + sy * 90); ctx.stroke();
    });
    // טקסטים
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const fit = (text, weight, size, maxW, family) => {
        let s = size;
        do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 18);
    };
    ctx.direction = 'ltr';
    ctx.font = `600 28px ${sans}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '10px';
    ctx.fillStyle = '#f2d48a';
    ctx.fillText('✦  NEW ME  ✦', cx, 178);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.direction = rtl ? 'rtl' : 'ltr';
    const title = t('nm_cert_title');
    fit(title, 700, 88, 860, serif);
    ctx.shadowColor = 'rgba(243, 199, 94, 0.35)'; ctx.shadowBlur = 24;
    ctx.fillStyle = gold(cx - 420, 230, cx + 420, 310);
    ctx.fillText(title, cx, 300);
    ctx.shadowBlur = 0;
    ctx.font = `500 34px ${serif}`;
    ctx.fillStyle = 'rgba(246, 230, 196, 0.85)';
    ctx.fillText(t('nm_cert_awarded'), cx, 385);
    const who = (name || '').trim();
    if (who) {
        fit(who, 700, 100, 840, serif);
        ctx.shadowColor = 'rgba(243, 199, 94, 0.55)'; ctx.shadowBlur = 30;
        ctx.fillStyle = '#fffaf0';
        ctx.fillText(who, cx, 498);
        ctx.shadowBlur = 0;
    }
    const line = ctx.createLinearGradient(cx - 300, 0, cx + 300, 0);
    line.addColorStop(0, 'rgba(243, 199, 94, 0)'); line.addColorStop(0.5, 'rgba(243, 199, 94, 0.95)'); line.addColorStop(1, 'rgba(243, 199, 94, 0)');
    ctx.fillStyle = line; ctx.fillRect(cx - 300, 532, 600, 2.5);
    // הסיבה - שבירת שורות לפי מילים, ומילה ארוכה מדי (יפנית, סינית, תאית - בלי רווחים) לפי תווים.
    // עד 2 שורות: אם לא נכנס - הגופן קטן
    // "New Me" לא נשבר בין שורות (רווח בלתי שביר; השבירה רק ברווח רגיל)
    const reason = t('nm_cert_reason').replace('{n}', nmFmt(NEW_ME_CHALLENGES.length)).replace(/New Me/g, 'New Me');
    const wrap = (text, maxW) => {
        const out = [];
        let cur = '';
        const push = () => { if (cur.trim()) out.push(cur.trim()); cur = ''; };
        text.split(/( +)/).forEach(tok => {
            if (!tok) return;
            if (ctx.measureText(cur + tok).width <= maxW) { cur += tok; return; }
            if (/^ +$/.test(tok)) { push(); return; }
            if (ctx.measureText(tok).width <= maxW) { push(); cur = tok; return; }
            Array.from(tok).forEach(ch => { if (cur && ctx.measureText(cur + ch).width > maxW) push(); cur += ch; });
        });
        push();
        return out;
    };
    let rs = 38, lines;
    do { ctx.font = `500 ${rs}px ${serif}`; lines = wrap(reason, 820); rs -= 2; } while (lines.length > 2 && rs > 24);
    ctx.fillStyle = 'rgba(246, 230, 196, 0.92)';
    const lh = rs + 10;
    lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, cx, (lines.length > 1 ? 590 : 602) + i * lh));
    // סיכום המסע: 6 שבבי זכוכית (3 × 2)
    const stats = nmGiftStats();
    const cols = 3, chipW = 262, chipH = 122, gapX = 17, gapY = 18, top = 676;
    const gridW = cols * chipW + (cols - 1) * gapX;
    stats.forEach((s, i) => {
        const c = i % cols, col = rtl ? cols - 1 - c : c, row = Math.floor(i / cols);
        const x = cx - gridW / 2 + col * (chipW + gapX), y = top + row * (chipH + gapY);
        rr(x, y, chipW, chipH, 24);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(243, 199, 94, 0.55)'; ctx.stroke();
        ctx.direction = 'ltr';
        fit(s.n, 700, 50, chipW - 30, serif);
        ctx.fillStyle = gold(x, y + 20, x + chipW, y + 80);
        ctx.fillText(s.n, x + chipW / 2, y + 62);
        ctx.direction = rtl ? 'rtl' : 'ltr';
        fit(s.label, 500, 25, chipW - 24, serif);
        ctx.fillStyle = 'rgba(246, 230, 196, 0.85)';
        ctx.fillText(s.label, x + chipW / 2, y + 100);
    });
    // חותם זהב בתוך זר דפנה: שני ענפים מלמטה כלפי מעלה, עלים מחודדים לסירוגין
    const sy = 1072, sr = 74, wr = sr + 30;
    const leaf = (x, y, ang, len, wid) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = gold(0, -wid, len, wid);
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(len * 0.45, -wid, len, 0);
        ctx.quadraticCurveTo(len * 0.45, wid, 0, 0);
        ctx.fill(); ctx.restore();
    };
    for (const side of [1, -1]) {
        const a0 = side > 0 ? 1.38 : Math.PI - 1.38, a1 = side > 0 ? -0.98 : Math.PI + 0.98;
        ctx.beginPath(); ctx.arc(cx, sy, wr, a0, a1, side > 0);
        ctx.lineWidth = 3; ctx.strokeStyle = gold(cx - wr, sy - wr, cx + wr, sy + wr); ctx.stroke();
        const steps = 9;
        for (let i = 0; i <= steps; i++) {
            const th = a0 + (a1 - a0) * (i / steps);
            const px = cx + Math.cos(th) * wr, py = sy + Math.sin(th) * wr;
            // כיוון ההתקדמות לאורך הענף (לכיוון הקצה העליון)
            const dir = side > 0 ? Math.atan2(-Math.cos(th), Math.sin(th)) : Math.atan2(Math.cos(th), -Math.sin(th));
            const size = 1 - i * 0.035;
            if (i === steps) { leaf(px, py, dir, 30 * size, 10 * size); continue; }
            leaf(px, py, dir - 0.55, 30 * size, 10.5 * size);
            leaf(px, py, dir + 0.55, 30 * size, 10.5 * size);
        }
    }
    ctx.beginPath();
    for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2, r = i % 2 ? sr - 6 : sr + 4;
        const px = cx + Math.cos(a) * r, py = sy + Math.sin(a) * r;
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
    const sealG = ctx.createRadialGradient(cx - 22, sy - 26, 8, cx, sy, sr + 6);
    sealG.addColorStop(0, '#fff4cc'); sealG.addColorStop(0.45, '#eebd52'); sealG.addColorStop(1, '#8f6214');
    ctx.fillStyle = sealG;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.fill();
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.beginPath(); ctx.arc(cx, sy, sr - 18, 0, Math.PI * 2);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(120, 80, 10, 0.55)'; ctx.stroke();
    ctx.direction = 'ltr';
    ctx.font = `64px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText('🏆', cx, sy + 4);
    ctx.textBaseline = 'alphabetic';
    // תאריך וכתובת
    ctx.direction = rtl ? 'rtl' : 'ltr';
    ctx.font = `500 30px ${serif}`;
    ctx.fillStyle = 'rgba(246, 230, 196, 0.9)';
    const dateFull = new Intl.DateTimeFormat(currentLang, { day: 'numeric', month: 'long', year: 'numeric' }).format(nmDate(nmChAllDoneDate()));
    ctx.fillText(`${dateFull} · New Me`, cx, 1226);
    ctx.direction = 'ltr';
    ctx.font = `500 24px ${sans}`;
    ctx.fillStyle = 'rgba(243, 212, 138, 0.75)';
    ctx.fillText('app.not10.ai', cx, 1262);
    return cv;
}

function nmCertBlob(canvas) { return new Promise(r => canvas.toBlob(r, 'image/png')); }

async function nmDownloadCertificate(btn) {
    if (btn) btn.disabled = true;
    try {
        const input = document.getElementById('nm-cert-name');
        const blob = await nmCertBlob(await nmDrawCertificate(input ? input.value.trim() : nmCertName()));
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'new-me-certificate.png';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        showAppToast(t('nm_cert_downloaded'));
    } finally { if (btn) btn.disabled = false; }
}

// שיתוף התמונה: בטלפון - תפריט השיתוף של המערכת (רק כך אפשר לשלוח קובץ תמונה לרשתות/לוואטסאפ
// מתוך דפדפן); בלי תמיכה בקבצים - התמונה יורדת והטקסט נשלח דרך תפריט השיתוף של האפליקציה
async function nmShareCertificate(btn) {
    if (btn) btn.disabled = true;
    try {
        const input = document.getElementById('nm-cert-name');
        const blob = await nmCertBlob(await nmDrawCertificate(input ? input.value.trim() : nmCertName()));
        const file = new File([blob], 'new-me-certificate.png', { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
            try { await navigator.share({ files: [file], text: `${t('nm_cert_share_text')}\nhttps://${typeof SHARE_APP_HOST !== 'undefined' ? SHARE_APP_HOST : 'app.not10.ai'}` }); } catch {}
            return;
        }
        await nmDownloadCertificate(null);
        openSharePicker(`${shareBold(t('nm_cert_share_text'))}\n\n🏆 ${t('nm_cert_reason').replace('{n}', NEW_ME_CHALLENGES.length)}`);
    } finally { if (btn) btn.disabled = false; }
}

// ---------- סטטיסטיקות מתקדמות (מצב מתקדם) ----------
function nmRenderStats(body) {
    if (!nmGodMode()) {
        body.innerHTML = `<p class="nm-empty">${nmEsc(t('nm_god_desc'))}</p>`;
        return;
    }
    const plan = nmProfile.plan;
    const today = getLocalDateString();
    const rows = nmStats.filter(r => r.day <= today);
    const last30 = rows.slice(-30);
    const logged = last30.filter(r => Number(r.kcal) > 0);
    const avg = logged.length ? Math.round(logged.reduce((a, r) => a + Number(r.kcal), 0) / logged.length) : 0;
    // קלוריות 30 יום מול התוכנית
    const maxK = Math.max(plan * 1.3, ...last30.map(r => Number(r.kcal) || 0));
    const BW = 300, BH = 120;
    const bw = BW / Math.max(1, last30.length);
    const bars = last30.map((r, i) => {
        const k = Number(r.kcal) || 0;
        const h = (k / maxK) * (BH - 8);
        const cls = !k ? 'empty' : k > plan * 1.1 ? 'over' : 'ok';
        return `<rect x="${(i * bw + bw * 0.15).toFixed(1)}" y="${(BH - h).toFixed(1)}" width="${(bw * 0.7).toFixed(1)}" height="${Math.max(1.5, h).toFixed(1)}" rx="1.5" class="nm-stat-bar ${cls}"/>`;
    }).join('');
    const planY = (BH - (plan / maxK) * (BH - 8)).toFixed(1);
    // ימים טובים לפי יום בשבוע
    const wd = Array.from({ length: 7 }, () => ({ good: 0, all: 0 }));
    rows.forEach(r => { const d = nmDate(r.day).getDay(); if (Number(r.checks) > 0 || Number(r.kcal) > 0) { wd[d].all++; if (nmIsGoodDay(r)) wd[d].good++; } });
    const wdNames = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(currentLang, { weekday: 'short' }).format(new Date(2026, 0, 4 + i)));
    const wdHtml = wd.map((w, i) => {
        const pct = w.all ? Math.round((w.good / w.all) * 100) : 0;
        return `<div class="nm-wd-col"><span class="nm-wd-bar"><span style="height:${Math.max(4, pct)}%"></span></span><b><bdi dir="ltr">${w.all ? pct + '%' : '–'}</bdi></b><small>${nmEsc(wdNames[i])}</small></div>`;
    }).join('');
    // מגמת משקל: קצב ב-4 השבועות האחרונים + הערכה מתי מגיעים ליעד
    const ws = nmWeights.filter(w => Number(w.weight_value) > 0);
    let weightHtml = `<p class="nm-fine">${nmEsc(t('nm_stats_weight_none'))}</p>`;
    if (ws.length >= 2) {
        const from = nmAddDays(today, -28);
        const recent = ws.filter(w => w.weight_date >= from);
        const pts = recent.length >= 2 ? recent : ws.slice(-2);
        const a = pts[0], b = pts[pts.length - 1];
        const days = Math.max(1, nmDaysBetween(a.weight_date, b.weight_date));
        const perWeek = ((Number(b.weight_value) - Number(a.weight_value)) / days) * 7;
        const goal = Number(nmProfile.goal_weight) || 0;
        let eta = '';
        if (goal && perWeek < -0.05 && Number(b.weight_value) > goal) {
            const weeks = (Number(b.weight_value) - goal) / -perWeek;
            if (weeks < 156) eta = `<p class="nm-fine">🎯 ${nmTpl('nm_stats_weight_eta', { date: nmLongDate(nmAddDays(b.weight_date, Math.round(weeks * 7))) })}</p>`;
        }
        weightHtml = `${nmWeightChart([{ weight_date: nmStartDay(), weight_value: nmProfile.start_weight }].filter(w => Number(w.weight_value) > 0).concat(ws.filter(w => w.weight_date >= nmStartDay())))}
            <p class="nm-stat-line">${nmTpl('nm_stats_weight_rate', { n: (perWeek > 0 ? '+' : perWeek < 0 ? '−' : '') + nmFmtNum(Math.abs(perWeek), 2) })}</p>${eta}`;
    }
    // צ'ק-אין ערב
    const ci = rows.filter(r => r.hunger != null || r.energy != null || r.mood != null);
    const avgOf = k => { const v = ci.map(r => r[k]).filter(x => x != null); return v.length ? v.reduce((s, x) => s + Number(x), 0) / v.length : null; };
    const ciHtml = ci.length ? `<div class="nm-ci-avgs">${['hunger', 'energy', 'mood'].map(k => { const v = avgOf(k); return `<div><span>${NEW_ME_CHECKIN_SCALES[k][Math.max(0, Math.min(4, Math.round((v || 1) - 1)))]}</span><b><bdi dir="ltr">${v == null ? '–' : nmFmtNum(v, 1)}/5</bdi></b><small>${nmEsc(t('nm_checkin_' + k))}</small></div>`; }).join('')}</div>` : `<p class="nm-fine">${nmEsc(t('nm_stats_checkin_none'))}</p>`;
    // אתגרים: כמה הושלמו מתוך כמה שהתחילו (כולל חזרות)
    const tries = nmChallenges.filter(c => c.start_date <= today).length;
    const doneN = nmChallenges.filter(c => c.status === 'done').length;
    const timeline = nmChallenges.filter(c => c.status === 'done' && nmChDef(c.challenge_key)).sort((x, y) => String(x.completed_at).localeCompare(String(y.completed_at)))
        .map(c => `<li><span aria-hidden="true">${nmChDef(c.challenge_key).icon}</span><span>${nmEsc(nmChTitle(c.challenge_key))}</span><small>${nmEsc(nmShortDate(String(c.completed_at).slice(0, 10)))}</small></li>`).join('');
    body.innerHTML = `
        <section class="nm-stat-card">
            <h4>🔥 ${nmEsc(t('nm_stats_kcal_title'))}</h4>
            ${logged.length ? `
            <svg class="nm-stat-chart" viewBox="0 0 ${BW} ${BH}" preserveAspectRatio="none" aria-hidden="true">${bars}<line x1="0" x2="${BW}" y1="${planY}" y2="${planY}" class="nm-chart-goal"/></svg>
            <p class="nm-stat-line">${nmTpl('nm_stats_kcal_avg', { n: nmFmt(avg), plan: nmFmt(plan) })}</p>` : `<p class="nm-fine">${nmEsc(t('nm_stats_empty'))}</p>`}
        </section>
        <section class="nm-stat-card">
            <h4>📅 ${nmEsc(t('nm_stats_weekday_title'))}</h4>
            <div class="nm-wd-chart">${wdHtml}</div>
            <p class="nm-fine">${nmEsc(t('nm_stats_weekday_hint'))}</p>
        </section>
        <section class="nm-stat-card">
            <h4>⚖️ ${nmEsc(t('nm_stats_weight_title'))}</h4>
            ${weightHtml}
        </section>
        <section class="nm-stat-card">
            <h4>🌙 ${nmEsc(t('nm_stats_checkin_title'))}</h4>
            ${ciHtml}
        </section>
        <section class="nm-stat-card">
            <h4>🏆 ${nmEsc(t('nm_stats_challenges_title'))}</h4>
            <p class="nm-stat-line">${nmTpl('nm_stats_challenges_line', { done: nmFmt(doneN), tries: nmFmt(tries) })}</p>
            ${timeline ? `<ul class="nm-ch-timeline">${timeline}</ul>` : ''}
        </section>`;
}
