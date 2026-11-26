// 🏋️ workout-log.js - "יומן המתאמנים" (הבחירה שלה 2026-11-26: 1-9, 11, 12, 14-17; ההחלטה על מסד הנתונים - אישרה).
// אימון עם תרגילים: לכל תרגיל סטים (משקל × חזרות / שניות), "בפעם הקודמת", סוג סט, שיא חדש, טיימר מנוחה, סופרסט,
// מחשבון צלחות (עם משקל המוט), כתיבה מהירה ("סקוואט 3×10 40"), "כמו בפעם הקודמת", תבניות לפי שם (מחפשים, מתחילים
// עותק, משנים, ובסוף "לעדכן גם את התבנית?"), גרף לכל תרגיל וסיכום בסוף. נשמר ב-sport_sessions.sets (jsonb), התבניות
// ב-workout_templates. מסך מלא, המסך לא נכבה באמצע. נטען אחרי workouts.js.
'use strict';

const WL_EX = [
    ['squat', 'legs'], ['lunge', 'legs', 'bw'], ['bulgarian_split_squat', 'legs'], ['deadlift', 'legs'], ['romanian_deadlift', 'legs'],
    ['leg_press', 'legs'], ['leg_extension', 'legs'], ['leg_curl', 'legs'], ['hip_thrust', 'legs'], ['bridge', 'legs', 'bw'],
    ['calf_raise', 'legs'], ['step_up', 'legs'],
    ['pullup', 'back', 'bw'], ['lat_pulldown', 'back'], ['seated_row', 'back'], ['barbell_row', 'back'], ['dumbbell_row', 'back'],
    ['back_extension', 'back', 'bw'], ['face_pull', 'back'],
    ['bench_press', 'chest'], ['incline_press', 'chest'], ['dumbbell_press', 'chest'], ['pushup', 'chest', 'bw'], ['chest_fly', 'chest'], ['dips', 'chest', 'bw'],
    ['overhead_press', 'shoulders'], ['lateral_raise', 'shoulders'], ['front_raise', 'shoulders'], ['rear_delt_fly', 'shoulders'], ['shrug', 'shoulders'],
    ['biceps_curl', 'arms'], ['hammer_curl', 'arms'], ['triceps_pushdown', 'arms'], ['triceps_extension', 'arms'], ['skull_crusher', 'arms'], ['close_grip_bench', 'arms'],
    ['plank', 'core', 'bw', 'timed'], ['side_plank', 'core', 'bw', 'timed'], ['crunch', 'core', 'bw'], ['leg_raise', 'core', 'bw'], ['russian_twist', 'core', 'bw'],
    ['mountain_climber', 'core', 'bw'], ['dead_bug', 'core', 'bw'], ['ab_wheel', 'core', 'bw'],
    ['burpee', 'full', 'bw'], ['kettlebell_swing', 'full'], ['jumping_jack', 'full', 'bw'], ['jump_rope', 'full', 'bw', 'timed'], ['box_jump', 'full', 'bw'],
    ['thruster', 'full'], ['battle_ropes', 'full', 'bw', 'timed'], ['rowing_machine', 'full', 'bw', 'timed'],
].map(([k, g, ...f]) => ({ k, g, bw: f.includes('bw'), timed: f.includes('timed') }));
const WL_GROUPS = ['legs', 'back', 'chest', 'shoulders', 'arms', 'core', 'full'];
const WL_TYPES = ['n', 'w', 'f', 'd']; // רגיל / חימום / עד כשל / דרופ
const WL_LB = 0.45359237;
// אייקון סגול קטן לכל קבוצת שרירים (מצויר, לא אימוג'י)
const WL_GROUP_ICON = {
    legs: '<path d="M9 3v7l-2 11M15 3v7l2 11M9 10h6" />',
    back: '<path d="M12 3v18M7 6c2 2 3 3 5 3s3-1 5-3M7 13c2 1.5 3 2 5 2s3-.5 5-2" />',
    chest: '<path d="M4 8c3-3 5-3 8 0 3-3 5-3 8 0M5 9c1 4 3 6 7 6s6-2 7-6" />',
    shoulders: '<path d="M4 15c0-5 3-8 8-8s8 3 8 8M8 7V4M16 7V4" />',
    arms: '<path d="M5 18c2-6 4-9 7-9 2 0 3 1 3 3 0 2-2 3-4 3M15 12c2-1 4 0 4 3" />',
    core: '<rect x="7" y="4" width="10" height="16" rx="3"/><path d="M7 9h10M7 14h10M12 4v16" />',
    full: '<circle cx="12" cy="5" r="2.2"/><path d="M12 8v6m0 0-3.5 6M12 14l3.5 6M6 10.5h12" />',
};
function wlIcon(g) { return `<svg class="wl-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${WL_GROUP_ICON[g] || WL_GROUP_ICON.full}</svg>`; }
function wlEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function wlExInfo(key) { return WL_EX.find(e => e.k === key) || null; }
function wlExName(ex) { return ex.key ? t('workout_ex_' + ex.key) : (ex.name || ''); }
function wlNorm(s) { return String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim(); }
// אותו תרגיל בהיסטוריה: לפי המפתח, ובלי מפתח - לפי השם
function wlSameEx(a, b) { return a.key ? a.key === b.key : (!b.key && wlNorm(a.name) === wlNorm(b.name)); }

// ---------- העדפות (במכשיר): ק״ג / lb ומנוחה אחרי סט ----------
function wlPrefKey(k) { return `weekwise_wl_${k}_${typeof currentUserId !== 'undefined' ? currentUserId : ''}`; }
function wlUnit() { try { return localStorage.getItem(wlPrefKey('unit')) === 'lb' ? 'lb' : 'kg'; } catch { return 'kg'; } }
function wlRestDefault() { try { return Number(localStorage.getItem(wlPrefKey('rest'))) || 90; } catch { return 90; } }
function wlToShow(kg) { if (kg == null || kg === '') return ''; const v = wlUnit() === 'lb' ? kg / WL_LB : kg; return String(Math.round(v * 4) / 4).replace(/\.0+$/, ''); }
function wlToKg(v) { const n = parseFloat(String(v).replace(',', '.')); if (!Number.isFinite(n) || n < 0) return null; return wlUnit() === 'lb' ? Math.round(n * WL_LB * 100) / 100 : n; }
// יחידת המשקל בשפה של האפליקציה (ק״ג / kg / lb) - מ-Intl, בלי מחרוזת לכל שפה
function wlUnitLabel(u) {
    const unit = (u || wlUnit()) === 'lb' ? 'pound' : 'kilogram';
    try { const p = new Intl.NumberFormat(currentLang, { style: 'unit', unit, unitDisplay: 'short' }).formatToParts(1).find(x => x.type === 'unit'); if (p && p.value.trim()) return p.value.trim(); } catch {}
    return unit === 'pound' ? 'lb' : 'kg';
}
// התג הקצר של סוג הסט (חימום / עד כשל / דרופ) = האות הראשונה של השם המלא
function wlTypeTag(type) { const ch = [...String(t('wl_type_' + type) || type)][0] || type; try { return ch.toLocaleUpperCase(currentLang); } catch { return ch.toUpperCase(); } }
function wlFmtNum(n) { try { return Number(n).toLocaleString(currentLang, { maximumFractionDigits: 1 }); } catch { return String(n); } }

// ---------- המצב: האימון הפתוח (נשמר במכשיר כטיוטה - סגירה לא מאבדת כלום) ----------
let wl = null;          // { name, kind, templateId, startedAt, exercises: [{ key, name, ss, rest, sets: [{ t, w, r, s, done, pr }] }] }
let wlHist = null;      // [{ id, session_date, created_at, sets }] - האימונים הקודמים עם תרגילים
let wlTpls = null;      // התבניות
let wlRestT = null;     // { end, total, timer }
let wlWake = null;
function wlDraftKey() { return wlPrefKey('draft'); }
function wlSaveDraft() { try { if (wl) localStorage.setItem(wlDraftKey(), JSON.stringify(wl)); else localStorage.removeItem(wlDraftKey()); } catch {} }
function wlLoadDraft() { try { const d = JSON.parse(localStorage.getItem(wlDraftKey()) || 'null'); return d && Array.isArray(d.exercises) ? d : null; } catch { return null; } }

async function wlLoadHist(force) {
    if (wlHist && !force) return wlHist;
    if (!supabaseClient || !currentUserId) return [];
    const { data } = await supabaseClient.from('sport_sessions').select('id, session_date, created_at, sets, custom_type_name')
        .eq('user_id', currentUserId).not('sets', 'is', null).order('session_date', { ascending: false }).order('created_at', { ascending: false }).limit(200);
    wlHist = (data || []).filter(r => Array.isArray(r.sets) && r.sets.length);
    return wlHist;
}
async function wlLoadTpls(force) {
    if (wlTpls && !force) return wlTpls;
    if (!supabaseClient || !currentUserId) return [];
    const { data } = await supabaseClient.from('workout_templates').select('*').eq('user_id', currentUserId).order('last_used_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false });
    wlTpls = data || [];
    return wlTpls;
}
// "בפעם הקודמת": הסטים של התרגיל הזה באימון האחרון שבו הוא נעשה
function wlPrevSets(ex) {
    for (const s of wlHist || []) {
        const hit = s.sets.find(e => wlSameEx(ex, e));
        if (hit) return hit.sets || [];
    }
    return [];
}
// השיא עד היום (לפני האימון הזה): הכי כבד, ובתרגיל בלי משקל - הכי הרבה חזרות / שניות
function wlBest(ex) {
    let w = 0, r = 0;
    (wlHist || []).forEach(s => s.sets.filter(e => wlSameEx(ex, e)).forEach(e => (e.sets || []).forEach(st => {
        if (st.t === 'w' || !st.done) return;
        if ((st.w || 0) > w) w = st.w || 0;
        const rr = st.s || st.r || 0;
        if (!st.w && rr > r) r = rr;
    })));
    return { w, r };
}
function wlSetLabel(st, info) {
    if (!st) return '';
    if (info && info.timed) return `${st.s || 0}″`;
    return st.w ? `${wlToShow(st.w)}×${st.r || 0}` : `${st.r || 0}`;
}

// ---------- הכרטיס במסך הספורט ----------
function wlRenderCard() {
    const box = document.getElementById('workout-log-card-body');
    if (!box) return;
    const draft = wl || wlLoadDraft();
    box.innerHTML = `
        ${draft ? `<button type="button" class="btn-primary wl-big-btn" data-wl-card="resume">${wlEsc(t('wl_resume'))} · ${wlEsc(draft.name || t('wl_default_name'))}</button>` : `<button type="button" class="btn-primary wl-big-btn" data-wl-card="start">${wlEsc(t('wl_start'))}</button>`}
        <div class="wl-card-row">
            <button type="button" class="wk-more-btn" data-wl-card="last">${wlEsc(t('wl_start_last'))}</button>
            <button type="button" class="wk-more-btn" data-wl-card="tpl">${wlEsc(t('wl_tpl_title'))}</button>
        </div>`;
    box.onclick = e => {
        const b = e.target.closest('[data-wl-card]');
        if (!b) return;
        const a = b.dataset.wlCard;
        if (a === 'resume') { wl = wl || wlLoadDraft(); wlOpen(); }
        else if (a === 'start') wlStart(null);
        else if (a === 'last') wlStartLast();
        else if (a === 'tpl') wlOpenTemplates();
    };
}

// ---------- להתחיל ----------
function wlNewSession(name, exercises, templateId, kind) {
    wl = { name: name || t('wl_default_name'), kind: kind || 'strength', templateId: templateId || null, startedAt: Date.now(), exercises: exercises || [] };
    wlSaveDraft();
}
function wlCopyExercises(list) {
    return (list || []).map(e => ({ key: e.key || null, name: e.key ? '' : (e.name || ''), ss: e.ss || null, rest: e.rest || null,
        sets: (e.sets && e.sets.length ? e.sets : [{ t: 'n' }]).map(st => ({ t: st.t || 'n', w: st.w ?? null, r: st.r ?? null, s: st.s ?? null, done: false })) }));
}
async function wlStart(template) {
    if (wl || wlLoadDraft()) { wl = wl || wlLoadDraft(); wlOpen(); return; }
    await wlLoadHist();
    if (template) {
        wlNewSession(template.name, wlCopyExercises(template.exercises), template.id, template.kind);
        supabaseClient.from('workout_templates').update({ last_used_at: new Date().toISOString() }).eq('id', template.id).then(() => {}, () => {});
    } else wlNewSession(null, []);
    wlOpen();
}
// ↺ כמו בפעם הקודמת: אותם תרגילים, סטים ומשקלים כמו באימון האחרון - רק לסמן ✓ או לשנות
async function wlStartLast() {
    const hist = await wlLoadHist(true);
    if (!hist.length) { showAppToast(t('wl_last_none')); return; }
    const last = hist[0];
    if (wl || wlLoadDraft()) { wl = wl || wlLoadDraft(); wlOpen(); return; }
    wlNewSession(last.custom_type_name || null, wlCopyExercises(last.sets));
    wlOpen();
}
async function wlAgain(sessionId) {
    const hist = await wlLoadHist(true);
    const row = hist.find(r => r.id === sessionId);
    if (!row) return;
    if (wl || wlLoadDraft()) { wl = wl || wlLoadDraft(); wlOpen(); return; }
    wlNewSession(row.custom_type_name || null, wlCopyExercises(row.sets));
    wlOpen();
}

// 🏋️ מהאימון של היום בטבלה (כוח / פונקציונלי / שחייה עם תרגילים): נפתח ביומן עם התרגילים והסטים שלו, ו"בפעם
// הקודמת" ממלא משקלים. השמירה מסמנת ✓ באימון בטבלה (source_workout_id)
async function wlFromPlan(id) {
    const w = (typeof workoutPlan !== 'undefined' ? workoutPlan : []).find(x => x.id === id);
    if (!w) return;
    if (wl || wlLoadDraft()) { wl = wl || wlLoadDraft(); wlOpen(); return; }
    await wlLoadHist();
    const exs = (w.exercises || []).filter(e => e && e.name).map(e => {
        const n = wlNorm(e.name);
        const hit = WL_EX.find(x => wlNorm(t('workout_ex_' + x.k)) === n);
        const ex = { key: hit ? hit.k : null, name: hit ? '' : e.name, ss: null, rest: null };
        const prev = wlPrevSets(ex);
        const reps = parseInt(String(e.reps || ''), 10);
        const count = Math.max(1, Math.min(20, parseInt(e.sets, 10) || prev.length || 3));
        const timed = !!(hit && hit.timed);
        ex.sets = Array.from({ length: count }, (_, i) => {
            const p = prev[i] || {};
            const plan = Number.isFinite(reps) ? reps : null;
            return { t: 'n', w: timed ? null : (p.w ?? null), r: timed ? null : (p.r ?? plan), s: timed ? (p.s ?? plan) : null, done: false };
        });
        return ex;
    });
    wlNewSession(typeof wkName === 'function' ? wkName(w) : null, exs, null, w.kind);
    wl.planId = w.id;
    wlSaveDraft();
    wlOpen();
}
document.addEventListener('click', e => {
    const b = e.target.closest && e.target.closest('[data-wl-from-plan]');
    if (b) { e.preventDefault(); wlFromPlan(b.dataset.wlFromPlan); }
});

// ---------- המסך המלא ----------
function wlOpen() {
    if (!wl) return;
    document.querySelectorAll('.wl-ov').forEach(x => x.remove());
    const ov = document.createElement('div');
    ov.className = 'wl-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', t('wl_card_title'));
    ov.innerHTML = `<div class="wl-sheet">
        <div class="wl-head">
            <button type="button" class="wl-x" data-wl="close" aria-label="${wlEsc(t('close_btn'))}">✕</button>
            <input type="text" class="wl-name" id="wl-name" maxlength="60" value="${wlEsc(wl.name)}" aria-label="${wlEsc(t('wl_name_ph'))}" placeholder="${wlEsc(t('wl_name_ph'))}">
            <span class="wl-clock" id="wl-clock" aria-live="off"></span>
            <button type="button" class="wl-menu-btn" data-wl="settings" aria-label="${wlEsc(t('settings_title'))}">⋯</button>
            <button type="button" class="btn-primary wl-finish" data-wl="finish">${wlEsc(t('wl_finish'))}</button>
        </div>
        <div class="wl-body" id="wl-body"></div>
        <div class="wl-rest hidden" id="wl-rest" role="status"></div>
    </div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
    ov.querySelector('#wl-name').addEventListener('input', e => { wl.name = e.target.value; wlSaveDraft(); });
    ov.addEventListener('click', wlOnClick);
    ov.addEventListener('change', wlOnChange);
    ov.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'wl-quick') { e.preventDefault(); wlQuickAdd(); } });
    wlLoadHist().then(() => wlRender());
    wlRender();
    wlTick();
    wlKeepAwake(true);
}
function wlClose() {
    document.querySelectorAll('.wl-ov, .wl-pop').forEach(x => x.remove());
    wlKeepAwake(false);
    wlStopRest();
    wlRenderCard();
}
// ⏱️ כמה זמן עבר מתחילת האימון
let wlClockTimer = null;
function wlTick() {
    clearInterval(wlClockTimer);
    const draw = () => {
        const el = document.getElementById('wl-clock');
        if (!el || !wl) { clearInterval(wlClockTimer); return; }
        const sec = Math.max(0, Math.floor((Date.now() - wl.startedAt) / 1000));
        el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
    };
    draw();
    wlClockTimer = setInterval(draw, 1000);
}
// המסך לא נכבה באמצע האימון (כשהדפדפן מאפשר)
async function wlKeepAwake(on) {
    try {
        if (!on) { if (wlWake) await wlWake.release(); wlWake = null; return; }
        if ('wakeLock' in navigator) wlWake = await navigator.wakeLock.request('screen');
    } catch { wlWake = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && document.querySelector('.wl-ov')) wlKeepAwake(true); });

function wlRender() {
    const body = document.getElementById('wl-body');
    if (!body || !wl) return;
    const unit = wlUnitLabel();
    const cards = wl.exercises.map((ex, i) => {
        const info = wlExInfo(ex.key);
        const timed = !!(info && info.timed);
        const prev = wlPrevSets(ex);
        const ssWithPrev = i > 0 && ex.ss && wl.exercises[i - 1].ss === ex.ss;
        const hasPr = ex.sets.some(st => st.pr);
        const rows = ex.sets.map((st, j) => {
            const p = prev[j];
            const num = ex.sets.slice(0, j + 1).filter(x => x.t !== 'w').length;
            const tag = st.t === 'n' ? String(num) : wlTypeTag(st.t);
            return `<div class="wl-row${st.done ? ' is-done' : ''}${st.pr ? ' is-pr' : ''}" data-j="${j}">
                <button type="button" class="wl-tag wl-tag-${st.t}" data-wl="tag" data-i="${i}" data-j="${j}" aria-label="${wlEsc(t('wl_type_' + st.t))}">${wlEsc(tag)}</button>
                <button type="button" class="wl-prev" data-wl="prev" data-i="${i}" data-j="${j}"${p ? '' : ' disabled'}><bdi>${wlEsc(p ? wlSetLabel(p, info) : '–')}</bdi></button>
                ${timed ? '<span class="wl-cell-empty"></span>' : `<input type="text" inputmode="decimal" class="wl-in" data-f="w" data-i="${i}" data-j="${j}" value="${wlEsc(wlToShow(st.w))}" placeholder="${info && info.bw ? '–' : '0'}" aria-label="${wlEsc(unit)}">`}
                <input type="text" inputmode="numeric" class="wl-in" data-f="${timed ? 's' : 'r'}" data-i="${i}" data-j="${j}" value="${wlEsc(timed ? (st.s ?? '') : (st.r ?? ''))}" placeholder="0" aria-label="${wlEsc(t(timed ? 'wl_col_sec' : 'workout_ex_reps_ph'))}">
                <button type="button" class="wl-ok" data-wl="ok" data-i="${i}" data-j="${j}" aria-pressed="${!!st.done}" aria-label="✓">✓</button>
            </div>`;
        }).join('');
        return `<section class="wl-ex${ex.ss ? ' is-ss' : ''}${ssWithPrev ? ' is-ss-next' : ''}" data-i="${i}">
            ${ex.ss && !ssWithPrev ? `<span class="wl-ss-tag">${wlEsc(t('wl_superset'))}</span>` : ''}
            <div class="wl-ex-head">
                <span class="wl-ex-ic">${wlIcon(info ? info.g : 'full')}</span>
                <button type="button" class="wl-ex-name" data-wl="graph" data-i="${i}">${wlEsc(wlExName(ex))}</button>
                ${hasPr ? `<span class="wl-pr">⭐ ${wlEsc(t('wl_pr'))}</span>` : ''}
                <button type="button" class="wl-ex-more" data-wl="exmenu" data-i="${i}" aria-label="${wlEsc(t('workout_more_aria'))}">⋯</button>
            </div>
            <div class="wl-grid wl-grid-head" aria-hidden="true"><span>${wlEsc(t('wl_col_set'))}</span><span>${wlEsc(t('wl_col_prev'))}</span><span>${timed ? '' : wlEsc(unit)}</span><span>${wlEsc(t(timed ? 'wl_col_sec' : 'workout_ex_reps_ph'))}</span><span>✓</span></div>
            ${rows}
            <button type="button" class="wl-add-set" data-wl="addset" data-i="${i}">${wlEsc(t('wl_add_set'))}</button>
        </section>`;
    }).join('');
    body.innerHTML = `
        <div class="wl-quick"><input type="text" id="wl-quick" class="wl-quick-in" placeholder="${wlEsc(t('wl_quick_ph'))}" aria-label="${wlEsc(t('wl_quick_ph'))}"><button type="button" class="wl-quick-btn" data-wl="quick">${wlEsc(t('sport_new_type_save_btn'))}</button></div>
        ${wl.exercises.length ? cards : `<p class="wl-empty">${wlEsc(t('wl_no_ex'))}</p>`}
        <button type="button" class="btn-secondary wl-add-ex" data-wl="addex">${wlEsc(t('wl_add_ex'))}</button>
        ${typeof WK_PRO_NOTE === 'function' ? WK_PRO_NOTE() : ''}`;
}

// ---------- נגיעות ----------
function wlOnChange(e) {
    const el = e.target;
    if (!el.classList || !el.classList.contains('wl-in')) return;
    const st = wl.exercises[+el.dataset.i]?.sets[+el.dataset.j];
    if (!st) return;
    const f = el.dataset.f;
    if (f === 'w') st.w = wlToKg(el.value);
    else { const n = parseInt(el.value, 10); st[f] = Number.isFinite(n) && n >= 0 ? n : null; }
    wlSaveDraft();
}
function wlOnClick(e) {
    const b = e.target.closest('[data-wl]');
    if (!b) return;
    const a = b.dataset.wl, i = +b.dataset.i, j = +b.dataset.j;
    const ex = wl && wl.exercises[i];
    if (a === 'close') { wlSaveDraft(); wlClose(); return; }
    if (a === 'finish') { wlFinish(); return; }
    if (a === 'settings') { wlOpenSettings(); return; }
    if (a === 'addex') { wlOpenPicker(); return; }
    if (a === 'quick') { wlQuickAdd(); return; }
    if (a === 'addset' && ex) {
        const last = ex.sets[ex.sets.length - 1];
        ex.sets.push({ t: 'n', w: last ? last.w : null, r: last ? last.r : null, s: last ? last.s : null, done: false });
        wlSaveDraft(); wlRender(); return;
    }
    if (a === 'tag' && ex) { const st = ex.sets[j]; st.t = WL_TYPES[(WL_TYPES.indexOf(st.t) + 1) % WL_TYPES.length]; wlSaveDraft(); wlRender(); return; }
    if (a === 'prev' && ex) {
        const p = wlPrevSets(ex)[j];
        if (!p) return;
        Object.assign(ex.sets[j], { w: p.w ?? null, r: p.r ?? null, s: p.s ?? null });
        wlSaveDraft(); wlRender(); return;
    }
    if (a === 'ok' && ex) { wlToggleSet(i, j); return; }
    if (a === 'graph' && ex) { wlOpenGraph(ex); return; }
    if (a === 'exmenu' && ex) { wlOpenExMenu(i); return; }
}
// ✓ על סט: שיא חדש? ואז טיימר מנוחה
function wlToggleSet(i, j) {
    // מה שהוקלד ולא "יצא" מהשדה - נקלט קודם
    document.querySelectorAll('#wl-body .wl-in').forEach(el => { if (+el.dataset.i === i && +el.dataset.j === j) wlOnChange({ target: el }); });
    const ex = wl.exercises[i];
    const st = ex.sets[j];
    st.done = !st.done;
    st.pr = false;
    // ✓ על סט ריק: לוקחים את המספרים מ"בפעם הקודמת", ואם אין - מהסט שלפניו
    if (st.done && st.w == null && st.r == null && st.s == null) {
        const src = wlPrevSets(ex)[j] || ex.sets.slice(0, j).reverse().find(x => x.w != null || x.r != null || x.s != null);
        if (src) Object.assign(st, { w: src.w ?? null, r: src.r ?? null, s: src.s ?? null });
    }
    if (st.done && st.t !== 'w') {
        const best = wlBest(ex);
        const others = ex.sets.filter((x, k) => k !== j && x.done && x.t !== 'w');
        const todayW = Math.max(0, ...others.map(x => x.w || 0));
        const todayR = Math.max(0, ...others.filter(x => !x.w).map(x => x.s || x.r || 0));
        if ((st.w || 0) > 0 && st.w > best.w && st.w > todayW && (best.w > 0 || (wlHist || []).length)) st.pr = true;
        else if (!st.w && (st.s || st.r || 0) > best.r && (st.s || st.r || 0) > todayR && best.r > 0) st.pr = true;
    }
    wlSaveDraft();
    wlRender();
    if (st.pr) {
        const row = document.querySelector(`#wl-body .wl-ex[data-i="${i}"] .wl-row[data-j="${j}"]`);
        if (row && typeof spawnGentleConfettiBurst === 'function') {
            const burst = document.createElement('div');
            burst.className = 'wl-burst';
            row.appendChild(burst);
            spawnGentleConfettiBurst(burst, 12, burst.clientWidth / 2, 10);
            setTimeout(() => burst.remove(), 1600);
        }
    }
    // סופרסט: מנוחה רק אחרי התרגיל האחרון בקבוצה
    const next = wl.exercises[i + 1];
    if (st.done && !(ex.ss && next && next.ss === ex.ss)) wlStartRest(ex.rest || wlRestDefault());
}

// ---------- ⏱️ טיימר מנוחה ----------
function wlStartRest(sec) {
    wlStopRest();
    wlRestT = { end: Date.now() + sec * 1000, total: sec };
    const box = document.getElementById('wl-rest');
    if (!box) return;
    box.classList.remove('hidden');
    const draw = () => {
        const left = Math.max(0, Math.round((wlRestT.end - Date.now()) / 1000));
        box.innerHTML = `<span class="wl-rest-label">${wlEsc(t('wl_rest'))}</span><b><bdi>${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}</bdi></b>
            <i class="wl-rest-bar" style="width:${(100 * left / wlRestT.total).toFixed(1)}%"></i>
            <button type="button" class="wl-rest-btn" data-rest="15">${wlEsc('+15″')}</button><button type="button" class="wl-rest-btn" data-rest="skip">${wlEsc(t('wl_rest_skip'))}</button>`;
        if (left <= 0) {
            try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch {}
            wlStopRest();
        }
    };
    box.onclick = e => {
        const b = e.target.closest('[data-rest]');
        if (!b || !wlRestT) return;
        if (b.dataset.rest === 'skip') wlStopRest(); else { wlRestT.end += 15000; wlRestT.total += 15; draw(); }
    };
    draw();
    wlRestT.timer = setInterval(draw, 500);
}
function wlStopRest() {
    if (wlRestT && wlRestT.timer) clearInterval(wlRestT.timer);
    wlRestT = null;
    const box = document.getElementById('wl-rest');
    if (box) { box.classList.add('hidden'); box.innerHTML = ''; }
}

// ---------- ✍️ כתיבה מהירה: "סקוואט 3×10 40", "פלאנק 3×30", "שכיבות סמיכה 20" (גם מהכתבה). בלי AI ----------
function wlParseLine(line) {
    const s = String(line || '').trim();
    if (!s) return null;
    const firstNum = s.search(/\d/);
    const namePart = (firstNum < 0 ? s : s.slice(0, firstNum)).replace(/[-–:·,]+$/, '').trim();
    if (!namePart) return null;
    const rest = firstNum < 0 ? '' : s.slice(firstNum);
    let sets = 1, reps = null, w = null;
    const m = rest.match(/(\d+)\s*[x×*]\s*(\d+)(?:\s*[x×*]\s*(\d+(?:[.,]\d+)?))?/i);
    let left = rest;
    if (m) { sets = Math.min(20, +m[1]); reps = +m[2]; if (m[3]) w = parseFloat(m[3].replace(',', '.')); left = rest.replace(m[0], ' '); }
    if (w == null) {
        const wm = left.match(/(\d+(?:[.,]\d+)?)\s*(kg|ק"ג|ק״ג|קג|lb|lbs)?/i);
        if (wm) { const v = parseFloat(wm[1].replace(',', '.')); if (reps == null && !wm[2]) reps = Math.round(v); else w = v; }
    }
    const norm = wlNorm(namePart);
    const hit = WL_EX.find(e => { const n = wlNorm(t('workout_ex_' + e.k)); return n && (n === norm || norm.includes(n) || n.includes(norm)); });
    const ex = { key: hit ? hit.k : null, name: hit ? '' : namePart.slice(0, 40), ss: null, rest: null, sets: [] };
    const timed = !!(hit && hit.timed);
    const kg = w != null ? (wlUnit() === 'lb' ? Math.round(w * WL_LB * 100) / 100 : w) : null;
    for (let k = 0; k < sets; k++) ex.sets.push({ t: 'n', w: timed ? null : kg, r: timed ? null : reps, s: timed ? reps : null, done: false });
    return ex;
}
function wlQuickAdd() {
    const inp = document.getElementById('wl-quick');
    if (!inp || !wl) return;
    const lines = inp.value.split(/[\n;]+/).map(wlParseLine).filter(Boolean);
    if (!lines.length) { showAppToast(t('wl_quick_none')); return; }
    lines.forEach(ex => {
        const same = wl.exercises.find(x => wlSameEx(x, ex));
        if (same) same.sets.push(...ex.sets); else wl.exercises.push(ex);
    });
    inp.value = '';
    wlSaveDraft();
    wlRender();
}

// ---------- חלונות קטנים (נפתחים מעל המסך) ----------
function wlPop(html, cls) {
    document.querySelectorAll('.wl-pop').forEach(x => x.remove());
    const pop = document.createElement('div');
    pop.className = 'wl-pop' + (cls ? ' ' + cls : '');
    pop.innerHTML = `<div class="wl-pop-card" role="dialog" aria-modal="true">${html}</div>`;
    pop.addEventListener('click', e => { if (e.target === pop || e.target.closest('[data-pop-close]')) pop.remove(); });
    (document.querySelector('.phone-wrapper') || document.body).appendChild(pop);
    return pop;
}
// ➕ ספריית התרגילים: חיפוש, קבוצות שרירים, ו"אחר" עם השם שנכתב
function wlOpenPicker() {
    let group = '';
    const pop = wlPop(`<h3>${wlEsc(t('wl_pick_title'))}</h3>
        <input type="search" class="wl-pick-search" id="wl-pick-search" placeholder="${wlEsc(t('wl_pick_search'))}" aria-label="${wlEsc(t('wl_pick_search'))}">
        <div class="wl-pick-groups">${['', ...WL_GROUPS].map(g => `<button type="button" class="wl-chip${g === '' ? ' is-on' : ''}" data-g="${g}">${wlEsc(t(g ? 'wl_g_' + g : 'wl_pick_all'))}</button>`).join('')}</div>
        <div class="wl-pick-list" id="wl-pick-list"></div>
        <button type="button" class="btn-clear-specific" data-pop-close>${wlEsc(t('close_btn'))}</button>`, 'is-picker');
    const list = pop.querySelector('#wl-pick-list');
    const search = pop.querySelector('#wl-pick-search');
    const draw = () => {
        const q = wlNorm(search.value);
        const hits = WL_EX.filter(e => (!group || e.g === group) && (!q || wlNorm(t('workout_ex_' + e.k)).includes(q)))
            .sort((a, b) => t('workout_ex_' + a.k).localeCompare(t('workout_ex_' + b.k), currentLang));
        list.innerHTML = hits.map(e => `<button type="button" class="wl-pick-item" data-k="${e.k}">${wlIcon(e.g)}<span>${wlEsc(t('workout_ex_' + e.k))}</span></button>`).join('')
            + (search.value.trim() ? `<button type="button" class="wl-pick-item is-other" data-other="1">${wlIcon('full')}<span>${wlEsc(t('wl_pick_other').replace('{name}', search.value.trim()))}</span></button>` : '');
    };
    pop.addEventListener('click', e => {
        const g = e.target.closest('[data-g]');
        if (g) { group = g.dataset.g; pop.querySelectorAll('[data-g]').forEach(x => x.classList.toggle('is-on', x === g)); draw(); return; }
        const it = e.target.closest('.wl-pick-item');
        if (!it) return;
        const ex = it.dataset.other ? { key: null, name: search.value.trim().slice(0, 40) } : { key: it.dataset.k, name: '' };
        const info = wlExInfo(ex.key);
        // "בפעם הקודמת" - מתחילים מאותם מספרים, אחרת 3 סטים ריקים
        const prev = wlPrevSets(ex);
        ex.sets = (prev.length ? prev : [{ t: 'n' }, { t: 'n' }, { t: 'n' }]).map(p => ({ t: p.t || 'n', w: info && info.timed ? null : (p.w ?? null), r: p.r ?? null, s: p.s ?? null, done: false }));
        ex.ss = null; ex.rest = null;
        wl.exercises.push(ex);
        wlSaveDraft();
        pop.remove();
        wlRender();
        setTimeout(() => document.querySelector(`#wl-body .wl-ex[data-i="${wl.exercises.length - 1}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60);
    });
    search.addEventListener('input', draw);
    draw();
    setTimeout(() => search.focus(), 80);
}
// ⋯ של תרגיל: גרף, סופרסט, מחשבון צלחות, מנוחה, מחיקת סט / תרגיל
function wlOpenExMenu(i) {
    const ex = wl.exercises[i];
    const info = wlExInfo(ex.key);
    const hasNext = i < wl.exercises.length - 1;
    const linked = ex.ss && wl.exercises[i + 1] && wl.exercises[i + 1].ss === ex.ss;
    const rest = ex.rest || wlRestDefault();
    const pop = wlPop(`<h3>${wlEsc(wlExName(ex))}</h3>
        <div class="wl-menu">
            <button type="button" data-m="graph">${wlEsc(t('wl_menu_graph'))}</button>
            ${hasNext || linked ? `<button type="button" data-m="ss">${wlEsc(t(linked ? 'wl_menu_ss_off' : 'wl_menu_ss_on'))}</button>` : ''}
            ${info && info.timed ? '' : `<button type="button" data-m="plates">${wlEsc(t('wl_menu_plates'))}</button>`}
            <button type="button" data-m="rest">${wlEsc(t('wl_menu_rest').replace('{n}', rest))}</button>
            ${ex.sets.length > 1 ? `<button type="button" data-m="delset">${wlEsc(t('wl_menu_del_set'))}</button>` : ''}
            <button type="button" data-m="remove">${wlEsc(t('wl_menu_remove'))}</button>
        </div>
        <button type="button" class="btn-clear-specific" data-pop-close>${wlEsc(t('close_btn'))}</button>`);
    pop.addEventListener('click', e => {
        const b = e.target.closest('[data-m]');
        if (!b) return;
        const m = b.dataset.m;
        pop.remove();
        if (m === 'graph') { wlOpenGraph(ex); return; }
        if (m === 'plates') { const last = [...ex.sets].reverse().find(s => s.w); wlOpenPlates(last ? last.w : null); return; }
        if (m === 'ss') {
            if (linked) { const id = ex.ss; wl.exercises.forEach(x => { if (x.ss === id) x.ss = null; }); }
            else { const id = ex.ss || ('s' + Date.now()); ex.ss = id; wl.exercises[i + 1].ss = id; }
        }
        if (m === 'rest') { const opts = [60, 90, 120, 180]; ex.rest = opts[(opts.indexOf(rest) + 1) % opts.length]; }
        if (m === 'delset') ex.sets.pop();
        if (m === 'remove') wl.exercises.splice(i, 1);
        wlSaveDraft();
        wlRender();
    });
}
// ⋯ של האימון: ק״ג / lb, מנוחה אחרי סט, מחיקת האימון
function wlOpenSettings() {
    const unit = wlUnit(), rest = wlRestDefault();
    const pop = wlPop(`<h3>${wlEsc(t('settings_title'))}</h3>
        <span class="wl-label">${wlEsc(t('wl_settings_unit'))}</span>
        <div class="wl-seg">${['kg', 'lb'].map(u => `<button type="button" class="wl-chip${u === unit ? ' is-on' : ''}" data-unit="${u}">${wlEsc(wlUnitLabel(u))}</button>`).join('')}</div>
        <span class="wl-label">${wlEsc(t('wl_settings_rest'))}</span>
        <div class="wl-seg">${[60, 90, 120, 180].map(s => `<button type="button" class="wl-chip${s === rest ? ' is-on' : ''}" data-rest="${s}"><bdi>${s}″</bdi></button>`).join('')}</div>
        <button type="button" class="btn-clear-specific wl-discard" data-discard="1">${wlEsc(t('wl_discard'))}</button>
        <button type="button" class="btn-secondary" data-pop-close>${wlEsc(t('close_btn'))}</button>`);
    pop.addEventListener('click', e => {
        const u = e.target.closest('[data-unit]');
        if (u) { try { localStorage.setItem(wlPrefKey('unit'), u.dataset.unit); } catch {} pop.remove(); wlRender(); return; }
        const r = e.target.closest('[data-rest]');
        if (r) { try { localStorage.setItem(wlPrefKey('rest'), r.dataset.rest); } catch {} pop.remove(); return; }
        if (e.target.closest('[data-discard]')) {
            pop.remove();
            showDangerConfirm(t('wl_discard'), t('wl_discard_q'), () => { wl = null; wlSaveDraft(); wlClose(); }, t('wl_discard'));
        }
    });
}
// 🧮 מחשבון צלחות - עם משקל המוט בנפרד (20 / 15 / 10 / משלך / בלי מוט): מה לשים בכל צד
function wlOpenPlates(kg) {
    const lb = wlUnit() === 'lb';
    const plates = lb ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
    const bars = lb ? [45, 35, 0] : [20, 15, 10, 0];
    let bar = bars[0];
    const unit = wlUnitLabel();
    const pop = wlPop(`<h3>${wlEsc(t('wl_plates_title'))}</h3>
        <label class="wl-label" for="wl-pl-total">${wlEsc(t('wl_plates_total').replace('{unit}', unit))}</label>
        <input type="text" inputmode="decimal" id="wl-pl-total" class="wl-pl-input" value="${wlEsc(kg ? wlToShow(kg) : '')}">
        <span class="wl-label">${wlEsc(t('wl_plates_bar'))}</span>
        <div class="wl-seg">${bars.map(b => `<button type="button" class="wl-chip${b === bar ? ' is-on' : ''}" data-bar="${b}">${b ? `<bdi>${b}</bdi>` : wlEsc(t('wl_bar_none'))}</button>`).join('')}<button type="button" class="wl-chip" data-bar="own">${wlEsc(t('wl_bar_own'))}</button></div>
        <input type="text" inputmode="decimal" id="wl-pl-own" class="wl-pl-input hidden" placeholder="${wlEsc(t('wl_plates_bar'))} (${wlEsc(unit)})">
        <div class="wl-pl-out" id="wl-pl-out" aria-live="polite"></div>
        <button type="button" class="btn-secondary" data-pop-close>${wlEsc(t('close_btn'))}</button>`);
    const out = pop.querySelector('#wl-pl-out'), total = pop.querySelector('#wl-pl-total'), own = pop.querySelector('#wl-pl-own');
    const draw = () => {
        const tot = parseFloat(String(total.value).replace(',', '.')) || 0;
        const b = bar === 'own' ? (parseFloat(String(own.value).replace(',', '.')) || 0) : bar;
        let side = (tot - b) / 2;
        if (tot <= 0 || side < 0) { out.innerHTML = ''; return; }
        const used = [];
        plates.forEach(p => { while (side >= p - 1e-9) { used.push(p); side = Math.round((side - p) * 1000) / 1000; } });
        out.innerHTML = `<span class="wl-label">${wlEsc(t('wl_plates_side'))}</span>
            <div class="wl-plates">${used.map(p => `<span class="wl-plate" style="--h:${Math.round(26 + (p / plates[0]) * 44)}px"><bdi>${wlFmtNum(p)}</bdi></span>`).join('') || '–'}</div>
            ${side > 0.001 ? `<p class="wl-pl-rest">${wlEsc(t('wl_plates_rest').replace('{n}', wlFmtNum(side * 2)).replace('{unit}', unit))}</p>` : ''}`;
    };
    pop.addEventListener('click', e => {
        const b = e.target.closest('[data-bar]');
        if (!b) return;
        bar = b.dataset.bar === 'own' ? 'own' : Number(b.dataset.bar);
        pop.querySelectorAll('[data-bar]').forEach(x => x.classList.toggle('is-on', x === b));
        own.classList.toggle('hidden', bar !== 'own');
        draw();
    });
    total.addEventListener('input', draw);
    own.addEventListener('input', draw);
    draw();
}
// 📈 גרף לכל תרגיל: הכי כבד בכל אימון (או הכי הרבה חזרות / שניות בלי משקל), והפעמים האחרונות
function wlOpenGraph(ex) {
    const info = wlExInfo(ex.key);
    const pts = [];
    (wlHist || []).slice().reverse().forEach(s => {
        const e = s.sets.find(x => wlSameEx(ex, x));
        if (!e) return;
        const done = (e.sets || []).filter(st => st.done && st.t !== 'w');
        if (!done.length) return;
        const top = done.reduce((a, st) => ((st.w || 0) > (a.w || 0) || (!a.w && !st.w && (st.s || st.r || 0) > (a.s || a.r || 0)) ? st : a), done[0]);
        pts.push({ d: s.session_date, v: top.w || top.s || top.r || 0, st: top });
    });
    const last = pts.slice(-20);
    let svg = '';
    if (last.length) {
        const W = 300, H = 120, P = 14;
        const max = Math.max(...last.map(p => p.v)), min = Math.min(...last.map(p => p.v));
        const x = k => (last.length === 1 ? W / 2 : P + (k * (W - 2 * P)) / (last.length - 1));
        const y = v => (max === min ? H / 2 : H - P - ((v - min) * (H - 2 * P)) / (max - min));
        svg = `<svg class="wl-graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="${wlEsc(wlExName(ex))}"><polyline points="${last.map((p, k) => `${x(k).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>${last.map((p, k) => `<circle cx="${x(k).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${k === last.length - 1 ? 5 : 3.5}" fill="currentColor"/>`).join('')}</svg>`;
    }
    const best = pts.reduce((a, p) => (!a || p.v > a.v ? p : a), null);
    const fmtD = d => { try { const [yy, mm, dd] = d.split('-').map(Number); return new Date(yy, mm - 1, dd).toLocaleDateString(currentLang, { day: 'numeric', month: 'short' }); } catch { return d; } };
    wlPop(`<h3>${wlIcon(info ? info.g : 'full')} ${wlEsc(wlExName(ex))}</h3>
        ${pts.length ? `${svg}<p class="wl-graph-best">${wlEsc(t('wl_graph_best').replace('{v}', wlSetLabel(best.st, info)))}</p>
        <ul class="wl-graph-list">${pts.slice(-5).reverse().map(p => `<li><span>${wlEsc(fmtD(p.d))}</span><bdi>${wlEsc(wlSetLabel(p.st, info))}</bdi></li>`).join('')}</ul>` : `<p class="wl-empty">${wlEsc(t('wl_graph_empty'))}</p>`}
        <button type="button" class="btn-secondary" data-pop-close>${wlEsc(t('close_btn'))}</button>`);
}
// 📋 התבניות: חיפוש לפי שם, להתחיל עותק, להוסיף לתוכנית האימונים, למחוק
async function wlOpenTemplates() {
    const tpls = await wlLoadTpls(true);
    const pop = wlPop(`<h3>${wlEsc(t('wl_tpl_title'))}</h3>
        <input type="search" class="wl-pick-search" id="wl-tpl-search" placeholder="${wlEsc(t('wl_tpl_search'))}" aria-label="${wlEsc(t('wl_tpl_search'))}">
        <div class="wl-pick-list" id="wl-tpl-list"></div>
        <button type="button" class="btn-clear-specific" data-pop-close>${wlEsc(t('close_btn'))}</button>`, 'is-picker');
    const list = pop.querySelector('#wl-tpl-list'), search = pop.querySelector('#wl-tpl-search');
    const draw = () => {
        const q = wlNorm(search.value);
        const hits = tpls.filter(tp => !q || wlNorm(tp.name).includes(q));
        list.innerHTML = hits.length ? hits.map(tp => `<div class="wl-tpl-row">
            <button type="button" class="wl-pick-item" data-tpl="${tp.id}">${wlIcon('full')}<span><b>${wlEsc(tp.name)}</b><small>${wlEsc(t('workout_ex_count').replace('{n}', (tp.exercises || []).length))}</small></span></button>
            <button type="button" class="wl-tpl-act" data-plan="${tp.id}" aria-label="${wlEsc(t('wl_tpl_to_plan'))}" title="${wlEsc(t('wl_tpl_to_plan'))}">📅</button>
            <button type="button" class="wl-tpl-act" data-del="${tp.id}" aria-label="${wlEsc(t('workout_delete_btn'))}" title="${wlEsc(t('workout_delete_btn'))}">✕</button></div>`).join('')
            : `<p class="wl-empty">${wlEsc(t('wl_tpl_empty'))}</p>`;
    };
    pop.addEventListener('click', async e => {
        const s = e.target.closest('[data-tpl]');
        if (s) { const tp = tpls.find(x => x.id === s.dataset.tpl); pop.remove(); if (tp) wlStart(tp); return; }
        const p = e.target.closest('[data-plan]');
        if (p) { const tp = tpls.find(x => x.id === p.dataset.plan); pop.remove(); if (tp) wlTemplateToPlan(tp); return; }
        const d = e.target.closest('[data-del]');
        if (d) {
            const tp = tpls.find(x => x.id === d.dataset.del);
            if (!tp) return;
            showDangerConfirm(t('workout_delete_btn'), tp.name, async () => {
                await supabaseClient.from('workout_templates').delete().eq('id', tp.id);
                tpls.splice(tpls.indexOf(tp), 1);
                wlTpls = tpls;
                draw();
            }, t('workout_delete_btn'));
        }
    });
    search.addEventListener('input', draw);
    draw();
}
// 📅 תבנית → אימון קבוע בתוכנית האימונים (עם ימים, ומשם לשגרה ולתזכורות): נפתח "אימון חדש" עם התרגילים
function wlTemplateToPlan(tp) {
    if (typeof openWorkoutEditor !== 'function') return;
    openWorkoutEditor(null);
    if (typeof workoutDraft === 'undefined' || !workoutDraft) return;
    workoutDraft.kind = tp.kind && tp.kind !== 'custom' ? tp.kind : 'strength';
    workoutDraft.exercises = (tp.exercises || []).map(e => {
        const work = (e.sets || []).filter(s => s.t !== 'w');
        return { name: e.key ? t('workout_ex_' + e.key) : (e.name || ''), sets: work.length || '', reps: work[0] ? String(work[0].s ? work[0].s + '″' : (work[0].r || '')) : '' };
    });
    if (typeof renderWorkoutEditor === 'function') renderWorkoutEditor();
}

// ---------- ✓ סיום: סיכום, שמירה, ותבנית ----------
function wlSummary() {
    const done = [];
    let vol = 0, sets = 0;
    const prs = [];
    wl.exercises.forEach(ex => {
        const d = ex.sets.filter(s => s.done);
        if (!d.length) return;
        done.push({ ex, d });
        d.forEach(s => { if (s.t !== 'w') { sets++; vol += (s.w || 0) * (s.r || 0); } if (s.pr) prs.push({ ex, s }); });
    });
    return { done, vol: Math.round(vol), sets, prs, minutes: Math.max(1, Math.round((Date.now() - wl.startedAt) / 60000)) };
}
function wlFinish() {
    document.querySelectorAll('#wl-body .wl-in').forEach(el => wlOnChange({ target: el }));
    const sum = wlSummary();
    if (!sum.done.length) { showAppToast(t('wl_finish_empty'), 'error'); return; }
    const unit = wlUnitLabel();
    const volShow = wlUnit() === 'lb' ? Math.round(sum.vol / WL_LB) : sum.vol;
    const pop = wlPop(`<h3>${wlEsc(t('wl_sum_title'))}</h3>
        <div class="wl-sum">
            <div><b><bdi>${sum.minutes}</bdi></b><span>${wlEsc(t('sport_minutes_unit'))}</span></div>
            <div><b><bdi>${sum.sets}</bdi></b><span>${wlEsc(t('workout_ex_sets_ph'))}</span></div>
            <div><b><bdi>${wlFmtNum(volShow)}</bdi></b><span>${wlEsc(unit)}</span></div>
        </div>
        ${sum.prs.length ? `<p class="wl-sum-prs">⭐ ${wlEsc(t('wl_sum_prs'))}: ${sum.prs.map(p => `${wlEsc(wlExName(p.ex))} <bdi>${wlEsc(wlSetLabel(p.s, wlExInfo(p.ex.key)))}</bdi>`).join(' · ')}</p>` : ''}
        <ul class="wl-sum-list">${sum.done.map(({ ex, d }) => `<li><span>${wlEsc(wlExName(ex))}</span><bdi>${wlEsc(d.filter(s => s.t !== 'w').map(s => wlSetLabel(s, wlExInfo(ex.key))).join(' · '))}</bdi></li>`).join('')}</ul>
        <div class="action-buttons-wrap is-stacked">
            <button type="button" class="btn-primary" data-sum="save">${wlEsc(t('sport_add_btn'))}</button>
            <button type="button" class="btn-secondary" data-pop-close>${wlEsc(t('wl_keep_going'))}</button>
        </div>`);
    pop.addEventListener('click', async e => {
        const b = e.target.closest('[data-sum="save"]');
        if (!b) return;
        b.disabled = true;
        const ok = await wlSave(sum);
        if (!ok) { b.disabled = false; return; }
        pop.remove();
        wlAfterSave(sum);
    });
}
async function wlSave(sum) {
    if (!supabaseClient || !currentUserId) return false;
    if (typeof burnWeightKg !== 'undefined' && burnWeightKg == null && typeof refreshBurnWeight === 'function') await refreshBurnWeight();
    const kgBody = (typeof burnWeightKg !== 'undefined' && burnWeightKg) || 70;
    const sets = wl.exercises.map(ex => ({ key: ex.key || null, name: ex.key ? null : ex.name, ss: ex.ss || null, rest: ex.rest || null,
        sets: ex.sets.map(s => ({ t: s.t, w: s.w ?? null, r: s.r ?? null, s: s.s ?? null, done: !!s.done, pr: !!s.pr })) })).filter(ex => ex.sets.some(s => s.done));
    const row = {
        user_id: currentUserId, username: currentUsername, sport_type: 'custom', custom_type_name: (wl.name || t('wl_default_name')).slice(0, 60),
        duration_minutes: sum.minutes, distance_km: null, motivation: null, session_date: getLocalDateString(), notes: null, photo_url: null,
        calories_burned: Math.round(5 * kgBody * (sum.minutes / 60)), sets,
    };
    // נפתח מהאימון של היום בטבלה - נרשם כ-✓ שלו
    if (wl.planId) row.source_workout_id = wl.planId;
    const { error } = await supabaseClient.from('sport_sessions').insert(row);
    if (error) { showAppToast(t('sport_add_failed'), 'error'); return false; }
    wlHist = null;
    if (typeof afterSportChanged === 'function') afterSportChanged();
    if (typeof workoutsAfterSportChanged === 'function') workoutsAfterSportChanged();
    if (typeof renderSportHistory === 'function') renderSportHistory();
    if (typeof renderSportSummary === 'function') renderSportSummary();
    return true;
}
// אחרי השמירה: לשתף, ולשמור כתבנית / לעדכן את התבנית שממנה התחילו
function wlAfterSave(sum) {
    const name = wl.name || t('wl_default_name');
    const tplId = wl.templateId;
    const exercises = wl.exercises.map(ex => ({ key: ex.key || null, name: ex.key ? null : ex.name, ss: ex.ss || null, rest: ex.rest || null,
        sets: ex.sets.map(s => ({ t: s.t, w: s.w ?? null, r: s.r ?? null, s: s.s ?? null })) }));
    const kind = wl.kind || 'strength';
    const shareText = wlShareText(sum);
    wl = null;
    wlSaveDraft();
    wlClose();
    if (typeof waterOfferAfterWorkout === 'function') setTimeout(waterOfferAfterWorkout, 1500);
    const pop = wlPop(`<h3>✓ ${wlEsc(t('sport_add_success'))}</h3>
        <p class="wl-tpl-q">${wlEsc(t(tplId ? 'wl_tpl_update_q' : 'wl_tpl_save_q').replace('{name}', name))}</p>
        <div class="action-buttons-wrap is-stacked">
            <button type="button" class="btn-primary" data-after="tpl">${wlEsc(t(tplId ? 'wl_yes_update' : 'wl_yes_save'))}</button>
            <button type="button" class="btn-secondary" data-after="share">${wlEsc(t('workout_share_btn'))}</button>
            <button type="button" class="btn-clear-specific" data-pop-close>${wlEsc(t('close_btn'))}</button>
        </div>`);
    pop.addEventListener('click', async e => {
        const b = e.target.closest('[data-after]');
        if (!b) return;
        if (b.dataset.after === 'share') { if (typeof openSharePicker === 'function') openSharePicker(shareText, { subject: name }); return; }
        b.disabled = true;
        const payload = { name: name.slice(0, 60), kind, exercises, updated_at: new Date().toISOString(), last_used_at: new Date().toISOString() };
        const { error } = tplId
            ? await supabaseClient.from('workout_templates').update(payload).eq('id', tplId)
            : await supabaseClient.from('workout_templates').insert({ ...payload, user_id: currentUserId });
        if (error) { b.disabled = false; showAppToast(t('nm_save_error'), 'error'); return; }
        wlTpls = null;
        b.textContent = `✓ ${t('wl_tpl_saved')}`;
    });
}
function wlShareText(sum) {
    const unit = wlUnitLabel();
    const volShow = wlUnit() === 'lb' ? Math.round(sum.vol / WL_LB) : sum.vol;
    const lines = [`🏋️ ${typeof shareBold === 'function' ? shareBold(wl.name || t('wl_default_name')) : (wl.name || '')}`,
        `⏱️ ${sum.minutes} ${t('sport_minutes_unit')} · ${sum.sets} ${t('workout_ex_sets_ph')}${volShow ? ` · ${wlFmtNum(volShow)} ${unit}` : ''}`];
    if (sum.prs.length) lines.push(`⭐ ${t('wl_sum_prs')}: ${sum.prs.map(p => `${wlExName(p.ex)} ${wlSetLabel(p.s, wlExInfo(p.ex.key))}`).join(', ')}`);
    lines.push('', ...sum.done.map(({ ex, d }) => `• ${wlExName(ex)}: ${d.filter(s => s.t !== 'w').map(s => wlSetLabel(s, wlExInfo(ex.key))).join(' · ')}`));
    lines.push('', '💪');
    return lines.join('\n');
}

// ---------- בהיסטוריה של הספורט: מה נעשה, ו"לעשות שוב" ----------
function wlHistoryLine(row) {
    if (!row || !Array.isArray(row.sets) || !row.sets.length) return '';
    let vol = 0;
    row.sets.forEach(e => (e.sets || []).forEach(s => { if (s.done && s.t !== 'w') vol += (s.w || 0) * (s.r || 0); }));
    const unit = wlUnitLabel();
    const volShow = wlUnit() === 'lb' ? Math.round(vol / WL_LB) : Math.round(vol);
    return `<span class="finance-history-note wl-hist-line">${wlEsc(t('workout_ex_count').replace('{n}', row.sets.length))}${volShow ? ` · <bdi>${wlFmtNum(volShow)} ${wlEsc(unit)}</bdi>` : ''}</span>
        <button type="button" class="wl-again-btn" onclick="wlAgain('${row.id}')">↺ ${wlEsc(t('wl_again'))}</button>`;
}

document.addEventListener('DOMContentLoaded', wlRenderCard);
if (document.readyState !== 'loading') wlRenderCard();
