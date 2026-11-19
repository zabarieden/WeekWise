// --- 🔄 "מה מפריע לי" (לפי בקשה מפורשת, 2026-11-18: "לעשות קטגוריה ביעדים של מה מפריע לך ומה תרצה לשנות? בוא נעשה
// צעדים ושיהיה באמת ממש חכם ועוזר"; ההחלטות שלה: AI - שניהם, כפתור משלו ב"היעדים שלי", השם "מה מפריע לי"; נוספו
// נראות, בדידות וחברים ועוד נושאים מוכרים מאפליקציות אחרות).
// הזרימה: מה מפריע → מתי זה קורה (והשעה) → מה במקום ולמה זה חשוב → התוכנית: "כש… אז…", "ואם בכל זאת…", סולם של 3
// שלבים. נוצר יעד רגיל (vision_goals, track 'steps') עם הצעד הקטן היומי, ✓ ב"השגרה שלי" בשעה של הרגע, ו-change_plan
// (הרגע, השעה, ה"במקום", תוכנית ב׳, השלב בסולם, הבדיקות השבועיות). כל שבוע: "איך הלך השבוע?" - בדיוק → שלב הבא,
// קל מדי → מדלגים שלב, קשה → נשארים. שיטות ידועות: כוונות יישום "אם–אז" (Gollwitzer) ו-WOOP (Oettingen) - קרדיט בדף הפרטיות ---
const CHG_TOPICS = [
    { id: 'phone_bed', icon: '📱', category: 'personal', time: '22:30', moments: ['bedtime', 'evening', 'bored'], insteads: ['phone_out', 'read10', 'calm_music', 'journal'] },
    { id: 'procrastination', icon: '⏳', category: 'career', time: '09:00', moments: ['morning', 'work', 'bored', 'tired'], insteads: ['two_min', 'one_task', 'pomodoro', 'list_evening'] },
    { id: 'snacking', icon: '🍪', category: 'health', time: '21:00', moments: ['evening', 'bored', 'tired', 'stressed'], insteads: ['tea', 'fruit', 'kitchen_closed', 'walk5'] },
    { id: 'late_sleep', icon: '🌙', category: 'health', time: '22:30', moments: ['bedtime', 'evening'], insteads: ['screens_off', 'alarm_bed', 'same_time', 'wind_down'] },
    { id: 'looks', icon: '🪞', category: 'personal', time: '08:00', moments: ['mirror', 'social', 'morning'], insteads: ['kind_line', 'three_good', 'comfy_clothes', 'care10'] },
    { id: 'lonely', icon: '🤝', category: 'relationships', time: '19:00', moments: ['evening', 'weekend', 'alone'], insteads: ['message_one', 'class_group', 'call', 'say_yes'] },
    { id: 'overthinking', icon: '🌀', category: 'personal', time: '21:30', moments: ['bedtime', 'stressed', 'alone'], insteads: ['write_down', 'worry_time', 'breaths', 'walk_out'] },
    { id: 'comparison', icon: '📲', category: 'personal', time: '08:00', moments: ['social', 'morning', 'bedtime'], insteads: ['app_limit', 'unfollow', 'no_phone_morning', 'gratitude'] },
    { id: 'self_critic', icon: '🗣️', category: 'personal', time: '21:00', moments: ['work', 'mirror', 'evening'], insteads: ['friend_voice', 'small_win', 'not_ten', 'kind_note'] },
    { id: 'anger', icon: '😤', category: 'relationships', time: '18:00', moments: ['stressed', 'tired', 'work'], insteads: ['breaths5', 'count10', 'step_out', 'say_feel'] },
    { id: 'spending', icon: '💸', category: 'finance', time: '20:00', moments: ['shopping', 'social', 'bored', 'stressed'], insteads: ['wait24', 'list_only', 'week_sum', 'unsubscribe'] },
    { id: 'not_moving', icon: '🚶', category: 'health', time: '18:00', moments: ['morning', 'after_work', 'work'], insteads: ['walk10', 'stairs', 'stretch5', 'dance'] },
    { id: 'sweets', icon: '🍫', category: 'health', time: '16:00', moments: ['meals', 'evening', 'stressed', 'tired'], insteads: ['fruit2', 'one_square', 'not_home', 'protein'] },
    { id: 'low_energy', icon: '🔋', category: 'health', time: '08:00', moments: ['morning', 'after_work', 'tired'], insteads: ['water_morning', 'sun10', 'same_sleep', 'short_walk'] },
    { id: 'messy_home', icon: '🧺', category: 'personal', time: '20:00', moments: ['evening', 'morning', 'weekend'], insteads: ['tidy5', 'dishes', 'one_place', 'one_drawer'] },
    { id: 'no_me_time', icon: '🌿', category: 'personal', time: '21:00', moments: ['evening', 'weekend', 'morning'], insteads: ['me15', 'hobby_week', 'walk_alone', 'say_no'] },
    { id: 'late', icon: '⏰', category: 'career', time: '07:30', moments: ['morning', 'work'], insteads: ['leave10', 'prep_evening', 'alarm_early', 'buffer'] },
    { id: 'smoking', icon: '🚭', category: 'health', time: '10:00', moments: ['stressed', 'meals', 'morning', 'social'], insteads: ['walk_instead', 'water_gum', 'one_less', 'delay10'] },
];
let chg = null;
function chgEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function chgTopic() { return chg && chg.topicId ? CHG_TOPICS.find(x => x.id === chg.topicId) || null : null; }
function chgAddMinutes(time, mins) {
    const [h, m] = String(time || '00:00').split(':').map(Number);
    const total = ((((h || 0) * 60 + (m || 0) + mins) % 1440) + 1440) % 1440;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function openChangeFlow() {
    chg = { step: 'topic', topicId: null, bother: '', moment: '', time: '21:00', instead: '', why: '', planB: '', routine: true, own: false };
    let layer = document.getElementById('chg-layer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'chg-layer';
        layer.className = 'chg-layer';
        layer.setAttribute('role', 'dialog');
        layer.setAttribute('aria-modal', 'true');
        layer.addEventListener('keydown', e => { if (e.key === 'Escape') closeChangeFlow(); });
        (document.querySelector('.phone-wrapper') || document.body).appendChild(layer);
    }
    layer.setAttribute('aria-label', t('chg_title'));
    layer.classList.remove('hidden');
    chgRender();
}
function closeChangeFlow() {
    if (typeof nmCloseTimePickers === 'function') nmCloseTimePickers();
    const layer = document.getElementById('chg-layer');
    if (layer) layer.classList.add('hidden');
    chg = null;
}
const CHG_STEPS = ['topic', 'moment', 'instead', 'plan'];
function chgGo(step) { if (typeof nmCloseTimePickers === 'function') nmCloseTimePickers(); chg.step = step; chgRender(); }
function chgBack() { const i = CHG_STEPS.indexOf(chg.step); if (i <= 0) closeChangeFlow(); else chgGo(CHG_STEPS[i - 1]); }

// צ'יפים לבחירה אחת, עם "אחר" שפותח שדה (כמו כל בחירה קבועה באפליקציה)
function chgChips(name, options, current, otherOn) {
    return `<div class="chg-chips" role="radiogroup">${options.map(o => `<button type="button" class="chg-chip${!otherOn && current === o ? ' on' : ''}" role="radio" aria-checked="${!otherOn && current === o}" data-${name}="${chgEsc(o)}">${chgEsc(o)}</button>`).join('')}<button type="button" class="chg-chip${otherOn ? ' on' : ''}" role="radio" aria-checked="${!!otherOn}" data-${name}-other="1">${chgEsc(t('nm_other'))}</button></div>`;
}
function chgRender() {
    const layer = document.getElementById('chg-layer');
    if (!layer || !chg) return;
    const tp = chgTopic();
    const idx = CHG_STEPS.indexOf(chg.step);
    const dots = CHG_STEPS.map((s, i) => `<i class="${i <= idx ? 'on' : ''}"></i>`).join('');
    const head = `<div class="chg-top"><button type="button" class="chg-icon-btn" data-act="back" aria-label="${chgEsc(t('gv_back'))}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button><span class="chg-dots" aria-hidden="true">${dots}</span><button type="button" class="chg-icon-btn" data-act="close" aria-label="${chgEsc(t('close_btn'))}">✕</button></div>`;
    let body = '';
    if (chg.step === 'topic') {
        body = `<h2 class="chg-q">${chgEsc(t('chg_q_topic'))}</h2>
            <div class="chg-topics">${CHG_TOPICS.map(x => `<button type="button" class="chg-topic${chg.topicId === x.id ? ' on' : ''}" data-topic="${x.id}"><span class="chg-topic-icon" aria-hidden="true">${x.icon}</span><span>${chgEsc(t('chg_t_' + x.id))}</span></button>`).join('')}
            <button type="button" class="chg-topic${chg.own ? ' on' : ''}" data-topic="own"><span class="chg-topic-icon" aria-hidden="true">✍️</span><span>${chgEsc(t('nm_other'))}</span></button></div>
            ${chg.own ? `<textarea class="chg-input chg-grow" id="chg-own" rows="1" maxlength="80" placeholder="${chgEsc(t('chg_own_ph'))}" aria-label="${chgEsc(t('chg_own_ph'))}">${chgEsc(chg.bother)}</textarea>` : ''}
            <button type="button" class="chg-ai-btn" data-act="ai">${typeof SPARK_ICON !== 'undefined' ? SPARK_ICON : ''} ${chgEsc(t('chg_ai_btn'))}${isPremiumUser ? '' : ' 🔒'}</button>`;
    } else if (chg.step === 'moment') {
        const opts = (tp ? tp.moments : ['morning', 'evening', 'bedtime', 'bored', 'stressed', 'tired']).map(k => t('chg_m_' + k));
        const other = chg.momentOther || (chg.moment && !opts.includes(chg.moment));
        body = `<h2 class="chg-q">${chgEsc(t('chg_q_moment'))}</h2>${chgChips('moment', opts, chg.moment, other)}
            ${other ? `<textarea class="chg-input chg-grow" id="chg-moment-own" rows="1" maxlength="60" placeholder="${chgEsc(t('chg_moment_ph'))}" aria-label="${chgEsc(t('chg_moment_ph'))}">${chgEsc(opts.includes(chg.moment) ? '' : chg.moment)}</textarea>` : ''}
            <div class="chg-time-row"><span>${chgEsc(t('chg_time_label'))}</span>${typeof nmTimeBtnHtml === 'function' ? nmTimeBtnHtml('chg-time', chg.time, t('chg_time_label'), v => { chg.time = v; }) : `<input type="time" id="chg-time-native" value="${chgEsc(chg.time)}">`}</div>`;
    } else if (chg.step === 'instead') {
        const opts = tp ? tp.insteads.map(k => t('chg_i_' + k)) : [];
        const other = chg.insteadOther || !opts.length || (chg.instead && !opts.includes(chg.instead));
        body = `<h2 class="chg-q">${chgEsc(t('chg_q_instead'))}</h2>${opts.length ? chgChips('instead', opts, chg.instead, other) : ''}
            ${other ? `<textarea class="chg-input chg-grow" id="chg-instead-own" rows="1" maxlength="80" placeholder="${chgEsc(t('chg_instead_ph'))}" aria-label="${chgEsc(t('chg_instead_ph'))}">${chgEsc(opts.includes(chg.instead) ? '' : chg.instead)}</textarea>` : ''}
            <label class="chg-label">${chgEsc(t('chg_why_label'))}<textarea class="chg-input chg-grow" id="chg-why" rows="1" maxlength="120" placeholder="${chgEsc(t('chg_why_ph'))}">${chgEsc(chg.why)}</textarea></label>`;
    } else {
        if (!chg.planB && tp) chg.planB = t('chg_b_' + tp.id);
        const rungs = [t('chg_rung').replace('{week}', 1).replace('{n}', 3), t('chg_rung').replace('{week}', 2).replace('{n}', 5), t('chg_rung_daily').replace('{week}', 3)];
        body = `<h2 class="chg-q">${chgEsc(t('chg_plan_title'))}</h2>
            <div class="chg-card-in chg-ifthen"><span>${chgEsc(t('chg_if'))}</span><b>${chgEsc(chg.moment)} · <bdi dir="ltr">${chgEsc(chg.time)}</bdi></b><span>${chgEsc(t('chg_then'))}</span><b>${chgEsc(chg.instead)}</b></div>
            <label class="chg-label">${chgEsc(t('chg_planb_label'))}<textarea class="chg-input chg-grow" id="chg-planb" rows="1" maxlength="120">${chgEsc(chg.planB)}</textarea></label>
            <div class="chg-card-in"><b>${chgEsc(t('chg_ladder_title'))}</b><ol class="chg-ladder">${rungs.map((r, i) => `<li class="${i === 0 ? 'now' : ''}">${chgEsc(r)}</li>`).join('')}</ol></div>
            <label class="chg-switch"><input type="checkbox" id="chg-routine" ${chg.routine ? 'checked' : ''}><span>${chgEsc(t('chg_routine_label').replace('{time}', chg.time))}</span></label>`;
    }
    const nextLabel = chg.step === 'plan' ? t('chg_create_btn') : t('chg_next');
    layer.innerHTML = `<div class="chg-sheet">${head}<div class="chg-body">${body}</div><button type="button" class="chg-next" data-act="next">${chgEsc(nextLabel)}</button></div>`;
    chgWire(layer);
}
function chgReadFields() {
    const v = id => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
    if (chg.step === 'topic' && chg.own) chg.bother = v('chg-own') || '';
    if (chg.step === 'moment') { const own = v('chg-moment-own'); if (own !== null) chg.moment = own; const nat = v('chg-time-native'); if (nat) chg.time = nat; }
    if (chg.step === 'instead') { const own = v('chg-instead-own'); if (own !== null) chg.instead = own; chg.why = v('chg-why') || ''; }
    if (chg.step === 'plan') { chg.planB = v('chg-planb') || ''; const sw = document.getElementById('chg-routine'); if (sw) chg.routine = sw.checked; }
}
function chgWire(layer) {
    layer.querySelectorAll('[data-topic]').forEach(b => b.onclick = () => {
        chgReadFields();
        const id = b.dataset.topic;
        if (id === 'own') { chg.own = true; chg.topicId = null; chgRender(); document.getElementById('chg-own')?.focus(); return; }
        if (chg.topicId !== id) { chg.moment = ''; chg.instead = ''; chg.planB = ''; chg.time = CHG_TOPICS.find(x => x.id === id).time; }
        chg.own = false; chg.topicId = id; chg.bother = t('chg_t_' + id);
        chgGo('moment');
    });
    const pick = (name, field, otherFlag) => {
        layer.querySelectorAll(`[data-${name}]`).forEach(b => b.onclick = () => { chgReadFields(); chg[field] = b.dataset[name]; chg[otherFlag] = false; chgRender(); });
        layer.querySelectorAll(`[data-${name}-other]`).forEach(b => b.onclick = () => { chgReadFields(); chg[otherFlag] = true; chgRender(); document.getElementById(`chg-${name}-own`)?.focus(); });
    };
    pick('moment', 'moment', 'momentOther');
    pick('instead', 'instead', 'insteadOther');
    layer.querySelectorAll('.chg-grow').forEach(el => {
        const fit = () => { el.style.height = 'auto'; el.style.height = (el.scrollHeight + 2) + 'px'; };
        fit(); el.addEventListener('input', fit);
        el.addEventListener('keydown', e => { if (e.key === 'Enter') e.preventDefault(); });
    });
    layer.querySelector('[data-act="back"]').onclick = () => { chgReadFields(); chgBack(); };
    layer.querySelector('[data-act="close"]').onclick = closeChangeFlow;
    const ai = layer.querySelector('[data-act="ai"]');
    if (ai) ai.onclick = () => chgOpenAi();
    layer.querySelector('[data-act="next"]').onclick = e => chgNext(e.currentTarget);
    const first = layer.querySelector('.chg-input:not([type=checkbox])') || layer.querySelector('.chg-chip.on, .chg-topic.on');
    if (first && chg.step !== 'topic') setTimeout(() => first.focus({ preventScroll: true }), 30);
}
function chgNext(btn) {
    chgReadFields();
    if (chg.step === 'topic') {
        if (!chg.own || !chg.bother) { showAppToast(t('chg_need_topic'), 'error'); return; }
        chgGo('moment');
    } else if (chg.step === 'moment') {
        if (!chg.moment) { showAppToast(t('chg_need_moment'), 'error'); return; }
        chgGo('instead');
    } else if (chg.step === 'instead') {
        if (!chg.instead) { showAppToast(t('chg_need_instead'), 'error'); return; }
        chgGo('plan');
    } else chgCreate(btn);
}

// "ליצור את היעד": יעד עם 3 שלבים (השבוע הראשון 3 פעמים, השני 5, השלישי כל יום), הצעד הקטן היומי, ✓ בשגרה
// בשעה של הרגע (בכל טאב שהוא שגרה של כל יום), ו-change_plan
async function chgCreate(btn) {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    if (btn) btn.disabled = true;
    const tp = chgTopic();
    const today = getLocalDateString();
    const end = new Date(); end.setDate(end.getDate() + 21);
    const plan = { v: 1, topic: tp ? tp.id : 'own', bother: chg.bother, moment: chg.moment, time: chg.time, instead: chg.instead, plan_b: chg.planB, level: 1, week_start: today, checkins: [] };
    const payload = {
        user_id: currentUserId, title: chg.instead, icon: tp ? tp.icon : '🔄', category: tp ? tp.category : 'personal', track_type: 'steps',
        reminder_freq: 'daily', reminder_text: chg.instead, template_key: `change:${plan.topic}`, target_date: getLocalDateString(end),
        why: chg.why || null, change_plan: plan,
    };
    const { data: goal, error } = await supabaseClient.from('vision_goals').insert(payload).select().single();
    if (error || !goal) { if (btn) btn.disabled = false; showAppToast(t('error_adding_item') + (error ? error.message : ''), 'error'); return; }
    const rungs = [t('chg_rung').replace('{week}', 1).replace('{n}', 3), t('chg_rung').replace('{week}', 2).replace('{n}', 5), t('chg_rung_daily').replace('{week}', 3)];
    await supabaseClient.from('vision_goal_milestones').insert(rungs.map((title, i) => ({ goal_id: goal.id, user_id: currentUserId, title, is_done: false, sort_order: (i + 1) * 10 })));
    let routineAdded = false;
    if (chg.routine && typeof glibRoutineTabs === 'function') {
        const tabs = glibTargetTabs(await glibRoutineTabs());
        if (tabs.length) {
            const { error: rErr } = await supabaseClient.from('routine_items').insert(tabs.map(tb => ({ tab_id: tb.id, user_id: currentUserId, title: `🎯 ${chg.instead}`, time: chg.time, kind: 'scheduled', vision_goal_id: goal.id })));
            routineAdded = !rErr;
        }
    }
    closeChangeFlow();
    visionSelectedGoalId = goal.id;
    visionAnimatePath = true;
    try { localStorage.setItem(VISION_SELECTED_KEY, goal.id); } catch {}
    if (!isGoalsViewOpen()) openGoalsVisionDrawer(goal.id);
    else await loadVisionGoals();
    if (typeof loadTodayTasks === 'function') loadTodayTasks();
    showAppToast(t(routineAdded ? 'chg_created_routine' : 'chg_created'));
}

// 🔄 בכרטיס של היעד: התוכנית, ופעם בשבוע "איך הלך השבוע?"
function chgDaysSince(dateStr) {
    if (!dateStr) return 0;
    const a = new Date(`${dateStr}T00:00:00`), b = new Date(`${getLocalDateString()}T00:00:00`);
    return Math.round((b - a) / 86400000);
}
function chgPlanCard(goal, milestones) {
    const p = goal.change_plan;
    if (!p || typeof p !== 'object') return null;
    const card = document.createElement('section');
    card.className = 'chg-card';
    const due = !goal.is_achieved && chgDaysSince(p.week_start) >= 7;
    card.innerHTML = `<h4>🔄 ${chgEsc(t('chg_plan_title'))}</h4>
        <div class="chg-ifthen"><span>${chgEsc(t('chg_if'))}</span><b>${chgEsc(p.moment)}${p.time ? ` · <bdi dir="ltr">${chgEsc(p.time)}</bdi>` : ''}</b><span>${chgEsc(t('chg_then'))}</span><b>${chgEsc(p.instead || goal.title)}</b></div>
        ${p.plan_b ? `<p class="chg-planb"><b>${chgEsc(t('chg_planb_label'))}</b> ${chgEsc(p.plan_b)}</p>` : ''}
        ${due ? `<div class="chg-check"><b>${chgEsc(t('chg_check_q'))}</b><div class="chg-chips">${['easy', 'just', 'hard'].map(a => `<button type="button" class="chg-chip" data-check="${a}">${chgEsc(t('chg_check_' + a))}</button>`).join('')}</div></div>` : ''}`;
    card.querySelectorAll('[data-check]').forEach(b => b.onclick = () => { card.querySelectorAll('[data-check]').forEach(x => { x.disabled = true; }); chgWeekly(goal, milestones, b.dataset.check); });
    return card;
}
async function chgWeekly(goal, milestones, ans) {
    const p = { ...goal.change_plan };
    const today = getLocalDateString();
    p.checkins = (Array.isArray(p.checkins) ? p.checkins : []).concat([{ d: today, a: ans }]).slice(-30);
    p.week_start = today;
    const open = (milestones || []).filter(m => !m.is_done).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    const ids = (ans === 'easy' ? open.slice(0, 2) : ans === 'just' ? open.slice(0, 1) : []).map(m => m.id);
    p.level = Math.min(4, (Number(p.level) || 1) + ids.length);
    const { error } = await supabaseClient.from('vision_goals').update({ change_plan: p }).eq('id', goal.id).eq('user_id', currentUserId);
    if (error) { showAppToast(t('error_not_connected'), 'error'); return; }
    if (ids.length) await supabaseClient.from('vision_goal_milestones').update({ is_done: true }).in('id', ids).eq('user_id', currentUserId);
    showAppToast(t('chg_check_toast_' + ans));
    await loadVisionGoals();
}

// ✍️ "לכתוב במילים שלי" עם AI (פרימיום): כותבים מה מפריע, והעוזר מציע רגע, שעה, מה במקום ותוכנית ב׳ - ואז ממשיכים
// באותה זרימה, עם הכל ממולא וניתן לשינוי
function chgOpenAi() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    const layer = document.getElementById('chg-layer');
    if (!layer) return;
    layer.innerHTML = `<div class="chg-sheet"><div class="chg-top"><button type="button" class="chg-icon-btn" data-act="back" aria-label="${chgEsc(t('gv_back'))}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button><span></span><button type="button" class="chg-icon-btn" data-act="close" aria-label="${chgEsc(t('close_btn'))}">✕</button></div>
        <div class="chg-body"><h2 class="chg-q">${chgEsc(t('chg_ai_q'))}</h2><textarea class="chg-input chg-ai-text" id="chg-ai-text" rows="5" maxlength="600" placeholder="${chgEsc(t('chg_ai_ph'))}" aria-label="${chgEsc(t('chg_ai_q'))}"></textarea></div>
        <button type="button" class="chg-next" data-act="go">${chgEsc(t('chg_ai_go'))}</button></div>`;
    layer.querySelector('[data-act="back"]').onclick = () => chgRender();
    layer.querySelector('[data-act="close"]').onclick = closeChangeFlow;
    layer.querySelector('[data-act="go"]').onclick = e => chgAiBuild(e.currentTarget);
    setTimeout(() => document.getElementById('chg-ai-text')?.focus(), 40);
}
async function chgAiBuild(btn) {
    const text = (document.getElementById('chg-ai-text')?.value || '').trim();
    if (!text) { showAppToast(t('chg_need_topic'), 'error'); return; }
    btn.disabled = true;
    const label = btn.textContent;
    btn.textContent = t('chg_ai_working');
    try {
        const { data: s } = await supabaseClient.auth.getSession();
        const token = s && s.session ? s.session.access_token : null;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/change-plan-ai`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ text, lang: currentLang }) });
        const r = await res.json().catch(() => ({}));
        if (r.error === 'limit_reached') { showAppToast(t('routine_ai_limit'), 'error'); return; }
        if (!res.ok || !r.plan) { showAppToast(t('chg_ai_failed'), 'error'); return; }
        const p = r.plan;
        const topic = CHG_TOPICS.find(x => x.id === p.topic) || null;
        chg = { ...chg, topicId: topic ? topic.id : null, own: !topic, bother: String(p.bother || text).slice(0, 80), moment: String(p.moment || '').slice(0, 60), momentOther: true,
            time: /^\d{2}:\d{2}$/.test(p.time || '') ? p.time : (topic ? topic.time : chg.time), instead: String(p.instead || '').slice(0, 80), insteadOther: true,
            why: String(p.why || '').slice(0, 120), planB: String(p.plan_b || '').slice(0, 120) };
        chgGo('moment');
    } catch {
        showAppToast(t('chg_ai_failed'), 'error');
    } finally {
        if (btn.isConnected) { btn.disabled = false; btn.textContent = label; }
    }
}
