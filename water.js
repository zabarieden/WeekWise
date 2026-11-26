// 💧 water.js - מעקב מים, סבב 2026-11-26 (בחירותיה: 1-13)
// 1 היעד נשמר בחשבון (user_premium.water_prefs) · 2 הכוסות שלי · 3 ביטול מהיר · 4 תזכורת לפי הקצב (send-due-reminders)
// 5 יעד מומלץ (משקל + יום אימון) · 6 סוגי משקאות - כולם נספרים ליעד, ומשקה עם קלוריות נרשם גם במעקב הארוחות
// 7 גרף שבוע · 8 האגם (בחירתה: 9 "אגם מלמעלה") במקום פס ההתקדמות · 9 טבלה לפי חודשים + פעם בחודש "המים של החודש"
// 10 מ״ל / אונקיות · 11 המים בסיכום הבוקר והערב (send-due-reminders) · 12 המפל בחדר הסודי (secret-places.js)
// 13 כוס מים אחרי אימון. נטען אחרי app.js ו-home.js ומחליף את פונקציות המים שלהם

// סוגי משקאות: קלוריות וחלבון ל-100 מ״ל (הערכה). 'other' - שם וקלוריות שכותבים לבד
const WATER_DRINKS = [
    { k: 'water', ic: '💧', kcal: 0 }, { k: 'sparkling', ic: '🫧', kcal: 0 }, { k: 'tea', ic: '🍵', kcal: 0 },
    { k: 'coffee', ic: '☕', kcal: 2 }, { k: 'coffee_milk', ic: '☕', kcal: 25, p: 1.2 }, { k: 'milk', ic: '🥛', kcal: 60, p: 3.3 },
    { k: 'plant_milk', ic: '🌾', kcal: 35, p: 1 }, { k: 'juice', ic: '🧃', kcal: 45 }, { k: 'soda', ic: '🥤', kcal: 42 },
    { k: 'diet_soda', ic: '🥤', kcal: 0 }, { k: 'iced_tea', ic: '🧊', kcal: 30 }, { k: 'smoothie', ic: '🫐', kcal: 60, p: 1 },
    { k: 'cocoa', ic: '🍫', kcal: 80, p: 3 }, { k: 'soup', ic: '🍲', kcal: 35, p: 1.5 }, { k: 'sports', ic: '⚡', kcal: 25 },
    { k: 'coconut', ic: '🥥', kcal: 20 }, { k: 'other', ic: '✏️', kcal: null },
];
const WATER_OZ = 29.5735;
const WATER_PREFS_KEY = () => `weekwise_water_prefs_${currentUserId || 'x'}`;
let waterPrefs = null;
let waterPrefsFromServer = false;
let waterDrink = 'water';
let waterOther = { name: '', kcal: '' };

function waterEsc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function waterDefaults() {
    let legacy = 0;
    try { legacy = parseInt(localStorage.getItem(`weekwise_water_goal_${currentUserId}`)) || 0; } catch {}
    return { goal: legacy || 2000, cups: [], unit: 'ml', remind: { on: false, from: '08:00', to: '22:00' } };
}
function waterClean(p) {
    const d = waterDefaults();
    const o = { ...d, ...(p && typeof p === 'object' ? p : {}) };
    o.goal = Math.min(10000, Math.max(250, parseInt(o.goal) || d.goal));
    o.cups = Array.isArray(o.cups) ? o.cups.filter(c => c && c.ml > 0).slice(0, 8).map(c => ({ n: String(c.n || '').slice(0, 30), ml: Math.min(3000, Math.round(c.ml)) })) : [];
    o.unit = o.unit === 'oz' ? 'oz' : 'ml';
    const r = o.remind && typeof o.remind === 'object' ? o.remind : {};
    const okT = v => /^([01]\d|2[0-3]):[0-5]\d$/.test(v || '');
    o.remind = { on: !!r.on, from: okT(r.from) ? r.from : '08:00', to: okT(r.to) ? r.to : '22:00' };
    return o;
}
function waterP() {
    if (!waterPrefs) { try { waterPrefs = waterClean(JSON.parse(localStorage.getItem(WATER_PREFS_KEY()) || 'null')); } catch { waterPrefs = waterClean(null); } }
    return waterPrefs;
}
async function waterLoadPrefs() {
    if (!supabaseClient || !currentUserId || waterPrefsFromServer) return waterP();
    try {
        const { data, error } = await supabaseClient.from('user_premium').select('water_prefs').eq('user_id', currentUserId).maybeSingle();
        if (error) return waterP();
        waterPrefsFromServer = true;
        if (data && data.water_prefs) {
            waterPrefs = waterClean(data.water_prefs);
            try { localStorage.setItem(WATER_PREFS_KEY(), JSON.stringify(waterPrefs)); } catch {}
        } else {
            // פעם ראשונה: היעד שנשמר עד היום רק במכשיר עובר לחשבון
            waterPrefs = waterClean(waterP());
            await waterSavePrefs({});
        }
    } catch {}
    return waterP();
}
async function waterSavePrefs(patch) {
    waterPrefs = waterClean({ ...waterP(), ...patch });
    try { localStorage.setItem(WATER_PREFS_KEY(), JSON.stringify(waterPrefs)); } catch {}
    if (supabaseClient && currentUserId) {
        await supabaseClient.from('user_premium').upsert({ user_id: currentUserId, username: currentUsername, water_prefs: waterPrefs }, { onConflict: 'user_id' }).then(() => {}, () => {});
    }
}

// ---------- 10. מ״ל / אונקיות ----------
function waterUnit() { return waterP().unit; }
function waterFmt(ml, opts = {}) {
    const oz = waterUnit() === 'oz';
    const v = oz ? ml / WATER_OZ : ml;
    try {
        return new Intl.NumberFormat(currentLang, { style: 'unit', unit: oz ? 'fluid-ounce' : 'milliliter', unitDisplay: 'short', maximumFractionDigits: oz ? 1 : 0 }).format(v);
    } catch { return `${oz ? Math.round(v * 10) / 10 : Math.round(v)} ${oz ? 'fl oz' : 'ml'}`; }
}
function waterNum(ml) {
    const oz = waterUnit() === 'oz';
    const v = oz ? ml / WATER_OZ : ml;
    try { return v.toLocaleString(currentLang, { maximumFractionDigits: oz ? 1 : 0 }); } catch { return String(Math.round(v)); }
}
function waterBig(ml) {
    // ליטרים (או אונקיות) - לסיכומים, לגרף ולטבלאות
    if (waterUnit() === 'oz') return waterFmt(ml);
    try { return new Intl.NumberFormat(currentLang, { style: 'unit', unit: 'liter', unitDisplay: 'short', maximumFractionDigits: 1 }).format(ml / 1000); } catch { return `${Math.round(ml / 100) / 10} L`; }
}
function waterUnitLabel() { return t(waterUnit() === 'oz' ? 'water_unit_oz_short' : 'water_ml_unit'); }
function waterToMl(v) { const n = parseFloat(v); if (!(n > 0)) return 0; return Math.round(waterUnit() === 'oz' ? n * WATER_OZ : n); }

// ---------- 1. היעד ----------
function getWaterDailyGoal() { return waterP().goal; }
function saveWaterDailyGoal() {
    const input = document.getElementById('water-daily-goal-input');
    const ml = waterToMl(input && input.value);
    if (!ml) return;
    waterSavePrefs({ goal: ml }).then(() => { loadWaterData(); if (typeof loadMyDayWater === 'function') loadMyDayWater(); });
}

// ---------- 6. מה שותים ----------
function waterDrinkInfo(k) { return WATER_DRINKS.find(d => d.k === k) || WATER_DRINKS[0]; }
function waterDrinkName(k) { return k === 'other' && waterOther.name ? waterOther.name : t('water_drink_' + k); }
// 6 הנפוצים גלויים, והשאר מאחורי "עוד" (נפתח לבד כשנבחר משקה מתוכם)
const WATER_DRINKS_SHORT = 6;
let waterDrinksOpen = false;
function waterDrinksHtml(scope) {
    const open = waterDrinksOpen || WATER_DRINKS.findIndex(d => d.k === waterDrink) >= WATER_DRINKS_SHORT;
    const list = open ? WATER_DRINKS : WATER_DRINKS.slice(0, WATER_DRINKS_SHORT);
    return list.map(d => `<button type="button" class="water-drink${waterDrink === d.k ? ' on' : ''}" data-water-drink="${d.k}" aria-pressed="${waterDrink === d.k}"><span aria-hidden="true">${d.ic}</span>${waterEsc(t('water_drink_' + d.k))}</button>`).join('')
        + (open ? '' : `<button type="button" class="water-drink water-drink-more" data-water-more>＋ ${waterEsc(t('water_drinks_more'))}</button>`)
        + `<div class="water-other${waterDrink === 'other' ? '' : ' hidden'}" data-scope="${scope}">
            <input type="text" maxlength="30" class="water-other-name" placeholder="${waterEsc(t('water_other_name_ph'))}" value="${waterEsc(waterOther.name)}">
            <input type="number" min="0" max="2000" inputmode="numeric" class="water-other-kcal" placeholder="${waterEsc(t('water_other_kcal_ph'))}" value="${waterEsc(waterOther.kcal)}">
        </div>`;
}
function waterBindDrinks(box) {
    if (!box) return;
    box.querySelectorAll('[data-water-drink]').forEach(b => b.addEventListener('click', () => { waterDrink = b.dataset.waterDrink; waterRenderControls(); }));
    box.querySelector('[data-water-more]')?.addEventListener('click', () => { waterDrinksOpen = true; waterRenderControls(); });
    box.querySelectorAll('.water-other-name').forEach(i => i.addEventListener('input', () => { waterOther.name = i.value.trim(); }));
    box.querySelectorAll('.water-other-kcal').forEach(i => i.addEventListener('input', () => { waterOther.kcal = i.value; }));
}

// ---------- 2. הכוסות שלי ----------
function waterCups() {
    const p = waterP();
    if (p.cups.length) return p.cups;
    const oz = p.unit === 'oz';
    return [{ n: t('water_cup_glass'), ml: oz ? Math.round(8 * WATER_OZ) : 200, def: true }, { n: t('water_cup_bottle'), ml: oz ? Math.round(16.9 * WATER_OZ) : 500, def: true }];
}
function waterCupsHtml(closeId) {
    return waterCups().map((c, i) => `<button type="button" class="ai-brain-tab water-cup-btn" data-water-cup="${i}"${closeId ? ` data-close-modal="${closeId}"` : ''}><span aria-hidden="true">${waterDrinkInfo(waterDrink).ic}</span> +${waterEsc(waterNum(c.ml))}<small>${waterEsc(c.n)}</small></button>`).join('')
        + `<button type="button" class="ai-brain-tab water-cup-edit" data-water-cups-edit>＋ ${waterEsc(t('water_cups_mine'))}</button>`;
}
function waterBindCups(box) {
    if (!box) return;
    box.querySelectorAll('[data-water-cup]').forEach(b => b.addEventListener('click', () => {
        const c = waterCups()[Number(b.dataset.waterCup)];
        if (!c) return;
        if (b.dataset.closeModal) closeModal(b.dataset.closeModal);
        addWaterLog(c.ml);
    }));
    box.querySelector('[data-water-cups-edit]')?.addEventListener('click', waterOpenCups);
}
function waterOpenCups() {
    document.querySelectorAll('.water-cups-ov').forEach(x => x.remove());
    const ov = document.createElement('div');
    ov.className = 'water-cups-ov';
    const render = () => {
        const cups = waterCups();
        ov.innerHTML = `<div class="water-cups-sheet" role="dialog" aria-modal="true" aria-label="${waterEsc(t('water_cups_mine'))}">
            <h3>${waterEsc(t('water_cups_mine'))}</h3>
            <div class="water-cups-list">${cups.map((c, i) => `<div class="water-cups-row"><span>${waterEsc(c.n)}</span><b><bdi>${waterEsc(waterFmt(c.ml))}</bdi></b><button type="button" class="btn-delete-slot" data-rm="${i}" aria-label="${waterEsc(t('delete_btn') || '✕')}">✕</button></div>`).join('')}</div>
            <div class="water-cups-add">
                <input type="text" maxlength="30" id="water-cup-name" placeholder="${waterEsc(t('water_cup_name_ph'))}">
                <input type="number" min="1" inputmode="decimal" id="water-cup-amount" placeholder="${waterEsc(t('water_cup_amount_ph').replace('{unit}', waterUnitLabel()))}">
                <button type="button" class="btn-primary" data-add>${waterEsc(t('water_add_custom_btn'))}</button>
            </div>
            <button type="button" class="btn-clear-specific" data-close>${waterEsc(t('close_btn'))}</button>
        </div>`;
        ov.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', async () => {
            const list = waterCups().filter((_, i) => i !== Number(b.dataset.rm)).map(({ n, ml }) => ({ n, ml }));
            await waterSavePrefs({ cups: list.length ? list : [{ n: t('water_cup_glass'), ml: 200 }] });
            render(); waterRenderControls();
        }));
        ov.querySelector('[data-add]').addEventListener('click', async () => {
            const name = ov.querySelector('#water-cup-name').value.trim();
            const ml = waterToMl(ov.querySelector('#water-cup-amount').value);
            if (!ml) { showAppToast(t('water_missing_amount'), 'error'); return; }
            const list = waterCups().map(({ n, ml: m }) => ({ n, ml: m })).concat({ n: name || waterFmt(ml), ml });
            await waterSavePrefs({ cups: list.slice(-8) });
            render(); waterRenderControls();
        });
    };
    render();
    ov.addEventListener('click', e => { if (e.target === ov || e.target.closest('[data-close]')) ov.remove(); });
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
}

// ---------- הוספה + 3. ביטול ----------
async function addWaterLog(amountMl, opts = {}) {
    if (!supabaseClient || !currentUserId || !(amountMl > 0)) return;
    const today = getLocalDateString();
    const drinkKey = opts.drink || waterDrink;
    const info = waterDrinkInfo(drinkKey);
    let kcal = info.kcal == null ? Math.max(0, parseInt(waterOther.kcal) || 0) : Math.round(info.kcal * amountMl / 100);
    const protein = info.p ? Math.round(info.p * amountMl / 100 * 10) / 10 : null;
    const { data: row, error } = await supabaseClient.from('water_logs').insert({ username: currentUsername, user_id: currentUserId, amount_ml: amountMl, log_date: today, drink: drinkKey === 'water' ? null : drinkKey, kcal: kcal || null }).select('id').single();
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    // 6. משקה עם קלוריות - גם במעקב הארוחות (כמו כל נשנוש)
    let food = null;
    if (kcal > 0 && typeof addQuickLogEntry === 'function') {
        await addQuickLogEntry(`${info.ic} ${waterDrinkName(drinkKey)} · ${waterFmt(amountMl)}`, kcal, 'snack', protein, null);
        food = typeof lastFoodQuickEntry !== 'undefined' && lastFoodQuickEntry ? { ...lastFoodQuickEntry, kcal, protein } : null;
    }
    const msg = kcal > 0 ? t('water_added_kcal').replace('{amount}', waterFmt(amountMl)).replace('{n}', kcal) : t('water_added').replace('{amount}', waterFmt(amountMl));
    if (typeof calShowUndo === 'function') calShowUndo(msg, () => waterUndo(row.id, food));
    else showAppToast(msg);
    loadWaterData();
    if (typeof loadMyDayWater === 'function') loadMyDayWater();
}
async function waterUndo(id, food) {
    await supabaseClient.from('water_logs').delete().eq('id', id).eq('user_id', currentUserId);
    if (food && food.id) {
        if (!food.merged) await supabaseClient.from('calorie_tracker').delete().eq('id', food.id).eq('user_id', currentUserId);
        else {
            const { data: r } = await supabaseClient.from('calorie_tracker').select('calories, protein_grams').eq('id', food.id).maybeSingle();
            if (r) await supabaseClient.from('calorie_tracker').update({ calories: Math.max(0, (r.calories || 0) - food.kcal), protein_grams: Math.max(0, (Number(r.protein_grams) || 0) - (food.protein || 0)) }).eq('id', food.id);
        }
    }
    loadWaterData();
    if (typeof loadMyDayWater === 'function') loadMyDayWater();
}
function addCustomWaterLog() {
    const input = document.getElementById('water-custom-amount-input');
    const ml = waterToMl(input && input.value);
    if (!ml) { showAppToast(t('water_missing_amount'), 'error'); return; }
    input.value = '';
    addWaterLog(ml);
}
function addCustomWaterLogFromFab() {
    const input = document.getElementById('water-quick-add-custom-input');
    const ml = waterToMl(input && input.value);
    if (!ml) { showAppToast(t('water_missing_amount'), 'error'); return; }
    input.value = '';
    closeModal('modal-water-quick-add');
    addWaterLog(ml);
}

// ---------- המסך ----------
function waterRenderControls() {
    ['water-cups', 'water-fab-cups'].forEach(id => { const box = document.getElementById(id); if (box) { box.innerHTML = waterCupsHtml(id === 'water-fab-cups' ? 'modal-water-quick-add' : ''); waterBindCups(box); } });
    ['water-drinks', 'water-fab-drinks'].forEach(id => { const box = document.getElementById(id); if (box) { box.innerHTML = waterDrinksHtml(id); waterBindDrinks(box); } });
    const ph = t('water_custom_ph_unit').replace('{unit}', waterUnitLabel());
    ['water-custom-amount-input', 'water-quick-add-custom-input'].forEach(id => { const i = document.getElementById(id); if (i) i.placeholder = ph; });
    const goalLabel = document.getElementById('water-goal-label');
    if (goalLabel) goalLabel.textContent = t('water_goal_label_unit').replace('{unit}', waterUnitLabel());
    waterRenderSettings();
}
function waterRenderSettings() {
    const box = document.getElementById('water-settings');
    if (!box) return;
    const p = waterP();
    box.innerHTML = `
        <div class="water-set-row" role="radiogroup" aria-label="${waterEsc(t('water_unit_title'))}"><span>${waterEsc(t('water_unit_title'))}</span>
            <span class="water-seg">${['ml', 'oz'].map(u => `<button type="button" role="radio" aria-checked="${p.unit === u}" class="${p.unit === u ? 'on' : ''}" data-water-unit="${u}">${waterEsc(t(u === 'oz' ? 'water_unit_oz' : 'water_ml_unit'))}</button>`).join('')}</span></div>
        <label class="water-set-row" for="water-remind-on"><span>${waterEsc(t('water_remind_label'))}</span><span class="switch"><input type="checkbox" id="water-remind-on" ${p.remind.on ? 'checked' : ''}><span class="switch-slider"></span></span></label>
        <div class="water-set-times${p.remind.on ? '' : ' hidden'}"><label>${waterEsc(t('water_remind_from'))} <input type="time" id="water-remind-from" value="${p.remind.from}"></label><label>${waterEsc(t('water_remind_to'))} <input type="time" id="water-remind-to" value="${p.remind.to}"></label></div>`;
    box.querySelectorAll('[data-water-unit]').forEach(b => b.addEventListener('click', async () => { await waterSavePrefs({ unit: b.dataset.waterUnit }); waterRenderControls(); loadWaterData(); }));
    const on = box.querySelector('#water-remind-on');
    on.addEventListener('change', async () => {
        await waterSavePrefs({ remind: { ...waterP().remind, on: on.checked } });
        waterRenderSettings();
        if (on.checked && typeof Notification !== 'undefined' && Notification.permission !== 'granted' && typeof requestNotificationPermissionFromSettings === 'function') requestNotificationPermissionFromSettings();
    });
    ['from', 'to'].forEach(k => box.querySelector(`#water-remind-${k}`)?.addEventListener('change', e => { if (/^\d{2}:\d{2}$/.test(e.target.value)) waterSavePrefs({ remind: { ...waterP().remind, [k]: e.target.value } }); }));
}

// 8. האגם (בחירתה 9): מבט מלמעלה, אדוות, והאגם גדל עם כל כוס עד היעד
function waterLakeHtml(total, goal) {
    const p = goal > 0 ? Math.min(1, total / goal) : 0;
    const r = (16 + 58 * p).toFixed(1);
    return `<svg class="water-lake-svg" viewBox="0 0 160 160" role="img" aria-label="${waterEsc(`${waterFmt(total)} / ${waterFmt(goal)}`)}">
        <defs><radialGradient id="waterLakeG"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#14b8a6"/></radialGradient></defs>
        <circle cx="80" cy="80" r="76" fill="none" stroke="currentColor" stroke-opacity=".28" stroke-dasharray="4 6"/>
        <circle class="water-lake-fill" cx="80" cy="80" r="${r}" fill="url(#waterLakeG)"/>
        <circle class="water-ripple" cx="80" cy="80" r="14" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.5"/>
        <circle class="water-ripple" cx="80" cy="80" r="14" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.5" style="animation-delay:1s"/>
        <circle class="water-ripple" cx="80" cy="80" r="14" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.5" style="animation-delay:2s"/>
    </svg>
    <div class="water-lake-text"><b><bdi>${waterEsc(waterNum(total))}</bdi></b><span><bdi>/ ${waterEsc(waterFmt(goal))}</bdi></span></div>`;
}

// ---------- 5. יעד מומלץ: לפי המשקל (כ-33 מ״ל לק״ג), ועוד 500 מ״ל ביום אימון ----------
let waterSuggestCache = null;
async function waterSuggest() {
    if (waterSuggestCache && Date.now() - waterSuggestCache.at < 10 * 60000) return waterSuggestCache;
    const out = { at: Date.now(), ml: 0, why: [] };
    try {
        const dayIdx = new Date().getDay();
        const [{ data: w }, { data: plans }] = await Promise.all([
            supabaseClient.from('weight_tracker').select('weight_value').eq('user_id', currentUserId).order('weight_date', { ascending: false }).limit(1).maybeSingle(),
            supabaseClient.from('workout_plan').select('days').eq('user_id', currentUserId),
        ]);
        const kg = w && Number(w.weight_value);
        if (!(kg > 25 && kg < 400)) { waterSuggestCache = out; return out; }
        out.ml = Math.round(kg * 33 / 50) * 50;
        out.why.push('weight');
        if ((plans || []).some(p => Array.isArray(p.days) && p.days.map(Number).includes(dayIdx))) { out.ml += 500; out.why.push('workout'); }
        // יום חם - כשמזג האוויר בבית יודע את הטמפרטורה (cache.temp)
        let cache = null;
        try { cache = JSON.parse(localStorage.getItem('weekwise_weather_cache') || 'null'); } catch {}
        if (cache && Number(cache.temp) >= 28 && Date.now() - (cache.at || 0) < 6 * 3600000) { out.ml += 500; out.why.push('hot'); }
        out.ml = Math.min(6000, Math.max(1500, out.ml));
    } catch {}
    waterSuggestCache = out;
    return out;
}
async function waterRenderSuggest(goal) {
    const box = document.getElementById('water-suggest');
    if (!box) return;
    const s = await waterSuggest();
    if (!s.ml || Math.abs(s.ml - goal) < 100) { box.innerHTML = ''; return; }
    box.innerHTML = `<span>${waterEsc(t('water_suggest').replace('{amount}', waterFmt(s.ml)))}</span><small>${s.why.map(k => waterEsc(t('water_suggest_' + k))).join(' · ')}</small><button type="button" class="water-suggest-use">${waterEsc(t('water_suggest_use'))}</button>`;
    box.querySelector('.water-suggest-use').addEventListener('click', async () => { await waterSavePrefs({ goal: s.ml }); loadWaterData(); if (typeof loadMyDayWater === 'function') loadMyDayWater(); });
}

// ---------- 7. גרף שבוע ----------
function waterWeekHtml(rows, goal) {
    const first = typeof calPrefs !== 'undefined' ? calPrefs.firstDay || 0 : 0;
    const now = new Date();
    const back = (now.getDay() - first + 7) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i); return { d, ds: getLocalDateString(d) }; });
    const today = getLocalDateString();
    const totals = days.map(x => rows.filter(r => r.log_date === x.ds).reduce((a, r) => a + (r.amount_ml || 0), 0));
    const max = Math.max(goal, ...totals, 1);
    const past = days.filter(x => x.ds <= today).length || 1;
    const avg = Math.round(totals.slice(0, past).reduce((a, v) => a + v, 0) / past);
    const bestI = totals.indexOf(Math.max(...totals));
    const keys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    return `<div class="water-week-head"><b>${waterEsc(t('water_week_title'))}</b><span>${waterEsc(t('water_week_avg').replace('{amount}', waterBig(avg)))}${totals[bestI] > 0 ? ` · ${waterEsc(t('water_week_best').replace('{day}', t('weekday_short_' + keys[days[bestI].d.getDay()])))}` : ''}</span></div>
        <div class="water-week-bars" style="--goal:${(goal / max * 100).toFixed(1)}%">${days.map((x, i) => `<div class="water-week-col${x.ds === today ? ' is-today' : ''}${totals[i] >= goal ? ' is-goal' : ''}" title="${waterEsc(waterBig(totals[i]))}"><span class="water-week-bar" style="height:${(totals[i] / max * 100).toFixed(1)}%"></span><small>${waterEsc(t('weekday_short_' + keys[x.d.getDay()]))}</small></div>`).join('')}</div>`;
}

// ---------- 9. לפי חודשים (טבלה) + פעם בחודש "המים של החודש" ----------
function waterMonthStats(rows, key, goal) {
    const [y, m] = key.split('-').map(Number);
    const daysIn = new Date(y, m, 0).getDate();
    const today = getLocalDateString();
    const curKey = today.slice(0, 7);
    const elapsed = key === curKey ? Number(today.slice(8, 10)) : daysIn;
    const byDay = {};
    rows.filter(r => String(r.log_date).startsWith(key)).forEach(r => { byDay[r.log_date] = (byDay[r.log_date] || 0) + (r.amount_ml || 0); });
    const total = Object.values(byDay).reduce((a, v) => a + v, 0);
    const goalDays = Object.values(byDay).filter(v => v >= goal).length;
    return { key, total, avg: elapsed ? Math.round(total / elapsed) : 0, pct: elapsed ? Math.round(goalDays / elapsed * 100) : 0, elapsed };
}
function waterMonthName(key) { const [y, m] = key.split('-').map(Number); try { return new Date(y, m - 1, 1).toLocaleDateString(currentLang, { month: 'long', year: 'numeric' }); } catch { return key; } }
async function waterRenderMonths(goal) {
    const box = document.getElementById('water-months');
    const talk = document.getElementById('water-talk');
    if (!box && !talk) return;
    const now = new Date();
    const keys = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
    const from = `${keys[keys.length - 1]}-01`;
    const { data } = await supabaseClient.from('water_logs').select('amount_ml, log_date').eq('user_id', currentUserId).gte('log_date', from);
    const rows = data || [];
    const stats = keys.map(k => waterMonthStats(rows, k, goal)).filter((s, i) => i === 0 || s.total > 0);
    if (box) {
        box.innerHTML = `<table class="water-months-table"><thead><tr><th>${waterEsc(t('water_months_col_month'))}</th><th>${waterEsc(t('water_months_col_total'))}</th><th>${waterEsc(t('water_months_col_avg'))}</th><th>${waterEsc(t('water_months_col_goal'))}</th></tr></thead>
            <tbody>${stats.map(s => `<tr><td>${waterEsc(waterMonthName(s.key))}</td><td><bdi>${waterEsc(waterBig(s.total))}</bdi></td><td><bdi>${waterEsc(waterBig(s.avg))}</bdi></td><td><bdi>${s.pct}%</bdi></td></tr>`).join('')}</tbody></table>`;
    }
    // פעם בחודש, בשבוע הראשון: החודש שעבר במשפט אחד (נסגר ב-✕ ולא חוזר עד החודש הבא)
    if (talk) {
        const prev = waterMonthStats(rows, keys[1], goal);
        const seenKey = `weekwise_water_talk_${currentUserId}_${keys[1]}`;
        let seen = false;
        try { seen = localStorage.getItem(seenKey) === '1'; } catch {}
        if (now.getDate() <= 7 && prev.total > 0 && !seen) {
            let line = t('water_month_talk').replace('{month}', waterMonthName(keys[1])).replace('{amount}', waterBig(prev.total)).replace('{pct}', prev.pct);
            try { line = line.charAt(0).toLocaleUpperCase(currentLang) + line.slice(1); } catch {}
            talk.innerHTML = `<span class="water-talk-ic" aria-hidden="true">💧</span><p>${waterEsc(line)}</p><button type="button" class="water-talk-x" aria-label="${waterEsc(t('close_btn'))}">✕</button>`;
            talk.classList.remove('hidden');
            talk.querySelector('.water-talk-x').addEventListener('click', () => { try { localStorage.setItem(seenKey, '1'); } catch {} talk.classList.add('hidden'); });
        } else talk.classList.add('hidden');
    }
}

// ---------- טעינת המסך (מחליף את loadWaterData של app.js) ----------
async function loadWaterData() {
    if (!supabaseClient || !currentUserId) return;
    await waterLoadPrefs();
    const goal = getWaterDailyGoal();
    const goalInput = document.getElementById('water-daily-goal-input');
    if (goalInput && document.activeElement !== goalInput) goalInput.value = waterUnit() === 'oz' ? Math.round(goal / WATER_OZ * 10) / 10 : goal;
    waterRenderControls();
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8);
    const today = getLocalDateString();
    const { data } = await supabaseClient.from('water_logs').select('*').eq('user_id', currentUserId).gte('log_date', getLocalDateString(from)).order('created_at', { ascending: false });
    const rows = data || [];
    const todayRows = rows.filter(r => r.log_date === today);
    const todayTotal = todayRows.reduce((s, r) => s + (r.amount_ml || 0), 0);
    const sunday = new Date(now); sunday.setDate(now.getDate() - now.getDay());
    const weekStart = getLocalDateString(sunday);
    const weeklyTotal = rows.filter(r => r.log_date >= weekStart).reduce((s, r) => s + (r.amount_ml || 0), 0);
    const todayEl = document.getElementById('water-today-total');
    if (todayEl) todayEl.textContent = waterNum(todayTotal);
    const weeklyEl = document.getElementById('water-weekly-total');
    if (weeklyEl) weeklyEl.textContent = waterBig(weeklyTotal);
    const lake = document.getElementById('water-lake');
    if (lake) lake.innerHTML = waterLakeHtml(todayTotal, goal);
    const week = document.getElementById('water-week');
    if (week) week.innerHTML = waterWeekHtml(rows, goal);
    const list = document.getElementById('water-history-list');
    if (list) {
        list.innerHTML = todayRows.length ? '' : `<li class="finance-history-empty">${waterEsc(t('water_history_empty'))}</li>`;
        todayRows.forEach(row => {
            const li = document.createElement('li');
            li.className = 'finance-history-row';
            const d = waterDrinkInfo(row.drink || 'water');
            const time = typeof waterLogTime === 'function' ? waterLogTime(row) : '';
            li.innerHTML = `<div class="finance-history-main"><span class="finance-history-category"><span aria-hidden="true">${d.ic}</span> <bdi>${waterEsc(waterFmt(row.amount_ml || 0))}</bdi>${row.drink ? ` · ${waterEsc(t('water_drink_' + row.drink) || row.drink)}` : ''}${row.kcal ? ` · <bdi>${row.kcal}</bdi> ${waterEsc(t('calories_unit'))}` : ''}</span>${time ? `<span class="water-log-time"><bdi dir="ltr">${time}</bdi></span>` : ''}</div><button type="button" class="btn-delete-slot" aria-label="${waterEsc(t('delete_btn') || '✕')}">✕</button>`;
            li.querySelector('.btn-delete-slot').addEventListener('click', () => deleteWaterLog(row.id));
            list.appendChild(li);
        });
    }
    if (typeof celebrateWaterGoalIfNeeded === 'function') celebrateWaterGoalIfNeeded(todayTotal, goal, today);
    waterRenderSuggest(goal);
    waterRenderMonths(goal);
    const monthBody = document.getElementById('water-month-body');
    if (monthBody && !monthBody.classList.contains('hidden') && typeof renderWaterMonth === 'function') renderWaterMonth();
}
function toggleWaterMonths() {
    const box = document.getElementById('water-months');
    const chev = document.getElementById('water-months-chevron');
    if (!box) return;
    const hidden = box.classList.toggle('hidden');
    if (chev) chev.textContent = hidden ? '▶' : '▼';
}

// ---------- 13. כוס מים אחרי אימון ----------
function waterOfferAfterWorkout() {
    document.querySelectorAll('.water-offer').forEach(x => x.remove());
    const cup = waterCups()[0];
    const el = document.createElement('div');
    el.className = 'water-offer';
    el.setAttribute('role', 'status');
    el.innerHTML = `<span>${waterEsc(t('water_after_workout'))}</span><button type="button">💧 +${waterEsc(waterNum(cup.ml))}</button><button type="button" class="water-offer-x" aria-label="${waterEsc(t('close_btn'))}">✕</button>`;
    el.querySelector('button').addEventListener('click', () => { el.remove(); addWaterLog(cup.ml, { drink: 'water' }); });
    el.querySelector('.water-offer-x').addEventListener('click', () => el.remove());
    (document.querySelector('.phone-wrapper') || document.body).appendChild(el);
    setTimeout(() => el.remove(), 9000);
}

// סך המים של היום (למפל בחדר הסודי ולמקומות אחרים)
async function waterTodayTotal() {
    if (!supabaseClient || !currentUserId) return 0;
    const { data } = await supabaseClient.from('water_logs').select('amount_ml').eq('user_id', currentUserId).eq('log_date', getLocalDateString());
    return (data || []).reduce((a, r) => a + (r.amount_ml || 0), 0);
}

document.addEventListener('DOMContentLoaded', () => { try { waterRenderControls(); } catch {} });
