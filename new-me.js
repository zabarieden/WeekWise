// ===== New Me: תוכנית תפריט 1,300 / 1,500 קלוריות (רכישה חד-פעמית, נפרדת מפרימיום) =====
// הכול נבנה דינמית בתוך #new-me-root (index.html) לפי מצב:
//   לא נרכש → כרטיס מכירה | נרכש בלי פרופיל → שאלון (הצהרה רפואית חובה) | אחרת → לוח + אריחים.
// ✓ על ארוחה נרשם ב-new_me_checkins וגם משוכפל ל-calorie_tracker (source='new_me'), כך
// שמעקב הארוחות היומי, ההצצה להיום והסטטיסטיקות מתעדכנים לבד. אם במשבצת כבר היה
// רישום חופשי - מצרפים אליו (בלי לדרוס), וביטול ה-✓ מסיר רק את החלק של New Me.
// נתוני התפריט והטקסטים לפי שפה - new-me-data.js.

const NEW_ME_DISCLAIMER_VERSION = '2026-09-29';
// קובצי ה-PDF נוצרים מהטקסט המתוקן שבאפליקציה (לא מהקבצים המקוריים, שבהם היו טעויות
// תרגום) - שפה בלי קובץ מקבלת אנגלית (ר' new-me-pdf-url)
function nmPdfEnabled() { return true; }
// משבצת New Me → meal_type הקיים במעקב הארוחות (meal_4 = נשנוש 1, שם היסטורי)
const NEW_ME_TRACKER_SLOT = { meal1: 'meal_1', snack1: 'meal_4', meal2: 'meal_2', snack2: 'snack' };
const NEW_ME_PRESET_CATEGORY = { meal1: 'morning', snack1: 'snack', meal2: 'noon', snack2: 'snack' };
const NEW_ME_TILE_ICONS = { menu: '🍽️', table: '📋', month: '📅', pdf: '📄', tips: '💡', settings: '⚙️', bonus: '📰' };

let nmProfile = null;          // שורת new_me_profile (או null)
let nmProfileLoaded = false;
let nmView = 'home';           // home | menu | table | month | tips | settings
let nmQuiz = null;             // מצב השאלון בזמן מילוי
let nmTodayCheckins = {};      // slot → row, להיום
let nmTrackerToday = [];       // כל רישומי calorie_tracker של היום (מקור האמת לסכום - כמו ההצצה להיום)
let nmDrinkDraftRows = 0;      // שורות-הזנה ריקות נוספות לשתייה (מעבר למינימום)
let nmTableDate = null;
let nmMonthKey = null;         // 'YYYY-MM'

function nmEsc(s) { return escapeHtmlForReport(s == null ? '' : s); }
function nmFmt(n) { try { return Number(n).toLocaleString(currentLang); } catch { return String(n); } }
function nmPlan() { return NEW_ME_PLANS[nmProfile ? nmProfile.plan : 1300]; }
function nmChoice(slot) { return (nmProfile && nmProfile['choice_' + slot]) || 'A'; }
function nmOptText(plan, slot, opt, short) { return newMeText(`p${plan}_${slot}_${opt}${short ? '_t' : ''}`); }
function nmRoot() { return document.getElementById('new-me-root'); }
// <bdi> כדי ש-~430 לא יקפוץ לסוף השורה בעברית/ערבית (bidi)
function nmMeta(o) { return `<bdi dir="ltr">~${o.kcal}</bdi> ${nmEsc(t('calories_unit'))} · ${nmEsc(t('nm_protein_short').replace('{n}', o.protein))}`; }

async function renderNewMe() {
    const root = nmRoot();
    if (!root) return;
    if (!hasNewMe) { nmRenderSales(root); return; }
    if (!nmProfileLoaded) {
        root.innerHTML = '<div class="nm-loading"></div>';
        const { data } = await supabaseClient.from('new_me_profile').select('*').eq('user_id', currentUserId).maybeSingle();
        nmProfile = data || null;
        nmProfileLoaded = true;
    }
    if (!nmProfile || nmQuiz) { if (!nmQuiz) nmStartQuiz(); nmRenderQuiz(root); return; }
    await nmLoadToday();
    nmRenderView(root);
}

// ---------- מכירה ----------
function nmRenderSales(root) {
    const plan = NEW_ME_PLANS[1300];
    const preview = NEW_ME_SLOTS.map(slot => `
        <div class="nm-preview-row"><span>${nmEsc(t('nm_slot_' + slot))}</span><span>${nmEsc(nmOptText(1300, slot, 'A', true))}</span><span class="nm-num"><bdi dir="ltr">~${plan[slot].options.A.kcal}</bdi></span></div>`).join('');
    root.innerHTML = `
        <div class="nm-hero">
            <div class="nm-hero-eyebrow">✨ New Me</div>
            <h2 class="nm-hero-title">${nmEsc(t('nm_sales_subtitle'))}</h2>
            <div class="nm-price">${nmEsc(t('nm_sales_price'))}</div>
            <div class="nm-price-note">${nmEsc(t('nm_sales_note'))}</div>
        </div>
        <ul class="nm-features">
            ${(nmPdfEnabled() ? [1, 2, 3, 4] : [1, 2, 3]).map(i => `<li>${nmEsc(t('nm_sales_f' + i))}</li>`).join('')}
        </ul>
        <div class="nm-preview" aria-hidden="true">${preview}</div>
        <button type="button" class="nm-btn-primary" onclick="submitNewMePurchase(this)">${nmEsc(t('nm_buy_btn'))}</button>`;
}

async function submitNewMePurchase(btn) {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const original = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = t('food_ai_estimating'); }
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) { showAppToast(t('error_not_connected'), 'error'); return; }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ tier: 'new_me' }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.url) { showAppToast(t('settings_billing_error_toast'), 'error'); return; }
        window.location.href = result.url;
    } catch {
        showAppToast(t('settings_billing_error_toast'), 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = original; }
    }
}

// חזרה מה-checkout: ה-webhook יכול להגיע כמה שניות אחרי - בודקים עד ~10 שניות
async function handleNewMeCheckoutReturn() {
    openNewMe();
    if (!hasNewMe) {
        showAppToast(t('nm_unlocking'));
        for (let i = 0; i < 5 && !hasNewMe; i++) {
            await new Promise(r => setTimeout(r, 2000));
            const { data } = await supabaseClient.from('user_premium').select('new_me_purchased').eq('user_id', currentUserId).maybeSingle();
            hasNewMe = !!(data && data.new_me_purchased);
        }
    }
    if (hasNewMe) { updateNewMeShortcut(); showAppToast(t('nm_unlocked_toast')); renderNewMe(); }
    else showAppToast(t('nm_unlock_pending'), 'error');
}

// ---------- שאלון ----------
function nmStartQuiz(fromSettings) {
    nmQuiz = {
        step: 0,
        agreed: false,
        weight: '',
        goal: nmProfile && nmProfile.goal_weight != null ? String(nmProfile.goal_weight) : '',
        plan: nmProfile ? nmProfile.plan : 1300,
        choices: Object.fromEntries(NEW_ME_SLOTS.map(s => [s, nmProfile ? nmChoice(s) : 'A'])),
        fromSettings: !!fromSettings,
    };
}

function nmDisclaimerHtml() {
    const suffix = currentLang === 'he' ? '' : (currentLang === 'es' ? '-es' : '-en');
    return `
        <h3 class="nm-step-title">${nmEsc(t('nm_disclaimer_title'))}</h3>
        <div class="nm-legal">
            ${[1, 2, 3, 4].map(i => `<p>${nmEsc(t('nm_disclaimer_p' + i))}</p>`).join('')}
            <a class="nm-link" href="terms${suffix}.html#new-me-disclaimer" target="_blank" rel="noopener">${nmEsc(t('nm_disclaimer_terms_link'))}</a>
        </div>`;
}

function nmRenderQuiz(root) {
    const q = nmQuiz;
    const total = 4;
    let body = '';
    let canContinue = true;
    if (q.step === 0) {
        body = `${nmDisclaimerHtml()}
            <label class="nm-agree">
                <input type="checkbox" ${q.agreed ? 'checked' : ''} onchange="nmQuiz.agreed = this.checked; nmRenderQuiz(nmRoot())">
                <span>${nmEsc(t('nm_disclaimer_agree'))}</span>
            </label>`;
        canContinue = q.agreed;
    } else if (q.step === 1) {
        body = `
            <h3 class="nm-step-title">${nmEsc(t('nm_q_weight_title'))}</h3>
            <label class="nm-field"><span>${nmEsc(t('nm_q_current_weight'))}</span>
                <input type="number" inputmode="decimal" step="0.1" min="20" max="400" value="${nmEsc(q.weight)}" oninput="nmQuiz.weight = this.value"></label>
            <label class="nm-field"><span>${nmEsc(t('nm_q_goal_weight'))}</span>
                <input type="number" inputmode="decimal" step="0.1" min="20" max="400" value="${nmEsc(q.goal)}" oninput="nmQuiz.goal = this.value"></label>`;
    } else if (q.step === 2) {
        body = `
            <h3 class="nm-step-title">${nmEsc(t('nm_q_plan_title'))}</h3>
            <div class="nm-plan-cards">
                ${[1300, 1500].map(p => `
                    <button type="button" class="nm-plan-card${q.plan === p ? ' selected' : ''}" onclick="nmQuiz.plan = ${p}; nmRenderQuiz(nmRoot())">
                        <span class="nm-plan-num">${nmFmt(p)}</span>
                        <span class="nm-plan-unit">${nmEsc(t('calories_unit'))}</span>
                        <span class="nm-plan-desc">${nmEsc(t('nm_plan_' + p + '_desc'))}</span>
                    </button>`).join('')}
            </div>
            <p class="nm-fine">${nmEsc(t('nm_q_plan_note'))}</p>`;
    } else {
        body = `
            <h3 class="nm-step-title">${nmEsc(t('nm_q_menu_title'))}</h3>
            <p class="nm-fine">${nmEsc(t('nm_q_menu_hint'))}</p>
            ${NEW_ME_SLOTS.map(slot => `
                <div class="nm-quiz-slot">
                    <div class="nm-slot-name">${nmEsc(t('nm_slot_' + slot))}</div>
                    ${NEW_ME_OPTIONS.map(opt => {
                        const o = NEW_ME_PLANS[q.plan][slot].options[opt];
                        return `<button type="button" class="nm-option${q.choices[slot] === opt ? ' selected' : ''}" onclick="nmQuiz.choices['${slot}'] = '${opt}'; nmRenderQuiz(nmRoot())">
                            <span class="nm-option-name">${nmEsc(nmOptText(q.plan, slot, opt, true))}</span>
                            <span class="nm-option-text">${nmEsc(nmOptText(q.plan, slot, opt))}</span>
                            <span class="nm-option-meta">${nmMeta(o)}</span>
                        </button>`;
                    }).join('')}
                </div>`).join('')}
            <p class="nm-ai-note">${nmEsc(t('nm_ai_note'))}</p>`;
    }
    const isLast = q.step === total - 1;
    root.innerHTML = `
        <div class="nm-quiz">
            <div class="nm-steps" aria-label="${nmEsc(t('nm_step_of').replace('{n}', q.step + 1).replace('{total}', total))}">
                ${Array.from({ length: total }, (_, i) => `<span class="nm-step-dot${i <= q.step ? ' on' : ''}"></span>`).join('')}
            </div>
            ${body}
            <div class="nm-quiz-actions">
                ${q.step > 0 || q.fromSettings ? `<button type="button" class="nm-btn-ghost" onclick="nmQuizBack()">${nmEsc(t('nm_back'))}</button>` : ''}
                <button type="button" class="nm-btn-primary" ${canContinue ? '' : 'disabled'} onclick="nmQuizNext()">${nmEsc(t(isLast ? 'nm_finish' : 'nm_continue'))}</button>
            </div>
        </div>`;
}

function nmQuizBack() {
    if (nmQuiz.step === 0) { nmQuiz = null; nmView = 'settings'; renderNewMe(); return; }
    nmQuiz.step--;
    nmRenderQuiz(nmRoot());
}

async function nmQuizNext() {
    const q = nmQuiz;
    if (q.step === 0 && !q.agreed) return;
    if (q.step === 1) {
        const w = parseFloat(q.weight);
        if (!(w >= 20 && w <= 400)) { showAppToast(t('nm_q_weight_missing'), 'error'); return; }
    }
    if (q.step < 3) { q.step++; nmRenderQuiz(nmRoot()); nmRoot().scrollIntoView({ block: 'start' }); return; }
    const today = getLocalDateString();
    const goal = parseFloat(q.goal);
    const row = {
        user_id: currentUserId,
        plan: q.plan,
        start_weight: parseFloat(q.weight),
        goal_weight: goal > 0 ? goal : null,
        disclaimer_accepted_at: new Date().toISOString(),
        disclaimer_version: NEW_ME_DISCLAIMER_VERSION,
        choice_meal1: q.choices.meal1, choice_snack1: q.choices.snack1,
        choice_meal2: q.choices.meal2, choice_snack2: q.choices.snack2,
        updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabaseClient.from('new_me_profile').upsert(row, { onConflict: 'user_id' }).select().maybeSingle();
    if (error) { showAppToast(t('nm_save_error'), 'error'); return; }
    nmProfile = data || row;
    // המשקל ההתחלתי נכנס גם למעקב המשקל הקיים (אותה טבלה בדיוק)
    await insertWeightRecord(row.start_weight, today, 'New Me');
    if (typeof loadWeightHistory === 'function') loadWeightHistory();
    await nmSyncCalorieGoal();
    nmQuiz = null;
    nmView = 'home';
    renderNewMe();
}

// יעד הקלוריות היומי של האפליקציה = התוכנית, כדי שהצצה להיום/מדדי קלוריות יתאימו
async function nmSyncCalorieGoal() {
    if (!nmProfile) return;
    cachedCalorieGoal = nmProfile.plan;
    localStorage.setItem(calorieDailyGoalKey(), String(nmProfile.plan));
    const input = document.getElementById('calorie-daily-goal-input');
    if (input) input.value = nmProfile.plan;
    updateNutritionGoalProgress();
    await supabaseClient.from('nutrition_goals').upsert({ user_id: currentUserId, username: currentUsername, calorie_goal: nmProfile.plan, protein_goal: getProteinDailyGoal() }, { onConflict: 'user_id' });
}

// ---------- נתוני יום ----------
async function nmLoadToday() {
    const today = getLocalDateString();
    const [{ data }, { data: tracker }] = await Promise.all([
        supabaseClient.from('new_me_checkins').select('*').eq('user_id', currentUserId).eq('checkin_date', today),
        supabaseClient.from('calorie_tracker').select('id, meal_type, food_description, calories, protein_grams, source').eq('user_id', currentUserId).eq('date', today),
    ]);
    nmTodayCheckins = {};
    (data || []).forEach(r => { nmTodayCheckins[r.slot] = r; });
    nmTrackerToday = tracker || [];
}

function nmIsDrinkRow(r) { return String(r.meal_type || '').startsWith('nm_drink'); }

// סנכרון מלא: הסכום נלקח מ-calorie_tracker (אותו מקור כמו ההצצה להיום ומעקב הארוחות),
// כך שגם קפה מההוספה המהירה נספר בטבעת. מפוצל לתוכנית / שתייה / תוספות רק לתצוגה
function nmEatenToday() {
    const total = nmTrackerToday.reduce((a, r) => ({ kcal: a.kcal + (Number(r.calories) || 0), protein: a.protein + (Number(r.protein_grams) || 0) }), { kcal: 0, protein: 0 });
    const plan = Object.values(nmTodayCheckins).reduce((a, r) => a + (r.kcal || 0), 0);
    const drinks = nmTrackerToday.filter(nmIsDrinkRow).reduce((a, r) => a + (Number(r.calories) || 0), 0);
    return { kcal: total.kcal, protein: total.protein, plan, drinks, extra: Math.max(0, total.kcal - plan - drinks) };
}

// אחרי כל שינוי - מרעננים את מעקב הארוחות/ההצצה להיום (אותו סכום בכל מקום)
function nmAfterTrackerChange() {
    refreshTodayNutritionViewIfOpen();
    if (typeof loadStats === 'function') loadStats();
}

// ---------- תצוגות ----------
function nmRenderView(root) {
    if (nmView === 'home') return nmRenderHome(root);
    const titles = { menu: 'nm_tile_menu', table: 'nm_tile_table', month: 'nm_tile_month', tips: 'nm_tile_tips', settings: 'nm_tile_settings' };
    root.innerHTML = `
        <div class="nm-subhead">
            <button type="button" class="nm-back" onclick="nmGo('home')" aria-label="${nmEsc(t('nm_back'))}">‹</button>
            <h3>${NEW_ME_TILE_ICONS[nmView] || ''} ${nmEsc(t(titles[nmView]))}</h3>
        </div>
        <div id="nm-view-body"></div>`;
    const body = document.getElementById('nm-view-body');
    if (nmView === 'menu') nmRenderMenu(body);
    else if (nmView === 'table') nmRenderTable(body);
    else if (nmView === 'month') nmRenderMonth(body);
    else if (nmView === 'tips') nmRenderTips(body);
    else if (nmView === 'settings') nmRenderSettings(body);
}

function nmGo(view) {
    nmView = view;
    nmRenderView(nmRoot());
    const root = nmRoot();
    if (root) root.scrollIntoView({ block: 'start' });
}

function nmRingHtml(eaten, goal) {
    const r = 52, c = 2 * Math.PI * r;
    const pct = goal > 0 ? Math.min(1, eaten / goal) : 0;
    const left = goal - eaten;
    const leftLabel = left >= 0 ? t('nm_left') : t('nm_over');
    return `
        <div class="nm-ring">
            <svg viewBox="0 0 120 120" aria-hidden="true">
                <defs><linearGradient id="nm-ring-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--accent-purple)"/><stop offset="1" stop-color="var(--accent-pink)"/></linearGradient></defs>
                <circle cx="60" cy="60" r="${r}" class="nm-ring-track"/>
                <circle cx="60" cy="60" r="${r}" class="nm-ring-fill" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - pct)).toFixed(1)}"/>
            </svg>
            <div class="nm-ring-center">
                <span class="nm-ring-num">${nmFmt(Math.abs(left))}</span>
                <span class="nm-ring-label">${nmEsc(leftLabel)}</span>
            </div>
        </div>`;
}

function nmRenderHome(root) {
    const plan = nmProfile.plan;
    const eaten = nmEatenToday();
    const done = Object.keys(nmTodayCheckins).length;
    const tiles = ['menu', 'table', 'month', ...(nmPdfEnabled() ? ['pdf'] : []), 'tips'];
    root.innerHTML = `
        <div class="nm-dash">
            <div class="nm-dash-top">
                ${nmRingHtml(eaten.kcal, plan)}
                <div class="nm-dash-stats">
                    <div class="nm-eyebrow">✨ New Me · ${nmFmt(plan)} ${nmEsc(t('calories_unit'))}</div>
                    <div class="nm-stat"><span class="nm-num">${nmFmt(eaten.kcal)}</span> ${nmEsc(t('nm_eaten'))}</div>
                    <div class="nm-stat"><span class="nm-num">${nmFmt(Math.round(eaten.protein))}</span> ${nmEsc(t('nm_protein_unit'))}</div>
                    <div class="nm-split">${nmEsc(t('nm_split_line').replace('{plan}', nmFmt(eaten.plan)).replace('{drinks}', nmFmt(eaten.drinks)).replace('{extra}', nmFmt(eaten.extra)))}</div>
                    <div class="nm-dots" aria-label="${done}/4">${NEW_ME_SLOTS.map(s => `<span class="${nmTodayCheckins[s] ? 'on' : ''}"></span>`).join('')}</div>
                </div>
            </div>
            <div class="nm-tiles">
                ${tiles.map(k => `<button type="button" class="nm-tile${k === 'menu' ? ' nm-tile-wide' : ''}" onclick="${k === 'pdf' ? 'nmOpenPdf(this)' : `nmGo('${k}')`}">
                    <span class="nm-tile-icon">${NEW_ME_TILE_ICONS[k]}</span><span class="nm-tile-label">${nmEsc(t('nm_tile_' + k))}</span></button>`).join('')}
            </div>
            <button type="button" class="nm-bonus" onclick="openModal('modal-nutrition-daily')">
                <span class="nm-bonus-icon">${NEW_ME_TILE_ICONS.bonus}</span>
                <span class="nm-bonus-text">
                    <span class="nm-bonus-badge">🎁 ${nmEsc(t('nm_bonus_label'))}</span>
                    <span class="nm-bonus-title">${nmEsc(t('nutrition_daily_tile_title'))}</span>
                    <span class="nm-bonus-sub">${nmEsc(t('nm_bonus_sub'))}</span>
                </span>
            </button>
            <p class="nm-medical">${nmEsc(t('nm_medical_note'))}</p>
            <p class="nm-ai-note">${nmEsc(t('nm_ai_note'))}</p>
            <button type="button" class="nm-gear" onclick="nmGo('settings')" title="${nmEsc(t('nm_tile_settings'))}" aria-label="${nmEsc(t('nm_tile_settings'))}">⚙️</button>
        </div>`;
}

function nmRenderMenu(body) {
    const plan = nmProfile.plan;
    body.innerHTML = NEW_ME_SLOTS.map(slot => {
        const opt = nmChoice(slot);
        const o = NEW_ME_PLANS[plan][slot].options[opt];
        const done = !!nmTodayCheckins[slot];
        return `
            <div class="nm-meal${done ? ' done' : ''}">
                <div class="nm-meal-head">
                    <span class="nm-slot-name">${nmEsc(t('nm_slot_' + slot))}</span>
                    <button type="button" class="nm-check${done ? ' on' : ''}" onclick="nmToggleCheck('${slot}', this)" aria-pressed="${done}" aria-label="${nmEsc(t('nm_mark_eaten'))}">✓</button>
                </div>
                <div class="nm-option-name">${nmEsc(nmOptText(plan, slot, opt, true))}</div>
                <div class="nm-option-text">${nmEsc(nmOptText(plan, slot, opt))}</div>
                <div class="nm-meal-foot">
                    <span class="nm-option-meta">${nmMeta(o)}</span>
                    <span class="nm-meal-actions">
                        <button type="button" class="nm-chip" onclick="nmOpenSwap('${slot}')">🔄 ${nmEsc(t('nm_swap'))}</button>
                        <button type="button" class="nm-chip" onclick="nmSaveAsPreset('${slot}')">⭐ ${nmEsc(t('nm_save_preset'))}</button>
                    </span>
                </div>
            </div>`;
    }).join('') + nmDrinksHtml() + nmExtrasHtml() + `<p class="nm-medical">${nmEsc(t('nm_medical_note'))}</p><p class="nm-ai-note">${nmEsc(t('nm_ai_note'))}</p>`;
}

// ---------- שתייה (הוספה ידנית, לפחות 3 ביום, כולן יחד עד ~150 קל') ----------
// כל משקה = שורה משלו ב-calorie_tracker עם meal_type=nm_drink_N (source='new_me'), כך
// שנספר בהצצה להיום ובמעקב הארוחות כמו כל דבר אחר
function nmDrinksHtml() {
    const drinks = nmTrackerToday.filter(nmIsDrinkRow);
    const total = drinks.reduce((a, r) => a + (Number(r.calories) || 0), 0);
    const emptyRows = Math.max(NEW_ME_DRINK_ROWS_MIN - drinks.length, 1) + nmDrinkDraftRows;
    const over = total > NEW_ME_DRINKS_KCAL;
    return `
        <div class="nm-meal nm-drinks">
            <div class="nm-meal-head">
                <span class="nm-slot-name">🥤 ${nmEsc(t('nm_slot_drinks'))}</span>
                <span class="nm-drinks-total${over ? ' over' : ''}"><bdi dir="ltr">${nmFmt(total)} / ~${NEW_ME_DRINKS_KCAL}</bdi> ${nmEsc(t('calories_unit'))}</span>
            </div>
            <div class="nm-fine">${nmEsc(t('nm_drinks_hint').replace('{kcal}', NEW_ME_DRINKS_KCAL))}</div>
            ${drinks.map(r => `
                <div class="nm-drink-row logged">
                    <span class="nm-drink-name">${nmEsc(String(r.food_description || '').replace(/^🥤\s*/, ''))}</span>
                    <span class="nm-option-meta"><bdi dir="ltr">${Number(r.calories) || 0}</bdi> ${nmEsc(t('calories_unit'))}</span>
                    <button type="button" class="nm-x" onclick="nmRemoveDrink('${r.id}', this)" aria-label="${nmEsc(t('nm_remove'))}">✕</button>
                </div>`).join('')}
            ${Array.from({ length: emptyRows }, () => `
                <div class="nm-drink-row">
                    <input type="text" class="nm-drink-input" maxlength="60" placeholder="${nmEsc(t('nm_drink_name_ph'))}">
                    <input type="number" class="nm-drink-kcal" inputmode="numeric" min="0" max="1000" placeholder="${nmEsc(t('calories_unit'))}">
                    <button type="button" class="nm-chip" onclick="nmAddDrink(this)">${nmEsc(t('nm_drink_add'))}</button>
                </div>`).join('')}
            <button type="button" class="nm-link-btn" onclick="nmDrinkDraftRows++; nmRenderView(nmRoot())">${nmEsc(t('nm_drink_more'))}</button>
        </div>`;
}

async function nmAddDrink(btn) {
    const row = btn.closest('.nm-drink-row');
    const name = row.querySelector('.nm-drink-input').value.trim();
    const kcal = parseInt(row.querySelector('.nm-drink-kcal').value, 10);
    if (!name || !(kcal >= 0)) { showAppToast(t('nm_drink_missing'), 'error'); return; }
    btn.disabled = true;
    const used = new Set(nmTrackerToday.filter(nmIsDrinkRow).map(r => r.meal_type));
    let n = 1;
    while (used.has('nm_drink_' + n)) n++;
    await supabaseClient.from('calorie_tracker').insert({
        username: currentUsername, user_id: currentUserId, date: getLocalDateString(), meal_type: 'nm_drink_' + n,
        food_description: '🥤 ' + name, calories: kcal, protein_grams: 0, source: 'new_me',
    });
    if (nmDrinkDraftRows > 0) nmDrinkDraftRows--;
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
}

async function nmRemoveDrink(id, btn) {
    if (btn) btn.disabled = true;
    await supabaseClient.from('calorie_tracker').delete().eq('id', id).eq('user_id', currentUserId);
    await nmLoadToday();
    nmRenderView(nmRoot());
    nmAfterTrackerChange();
}

// מה שנוסף היום מחוץ לתוכנית (מעקב הארוחות / הוספה מהירה) - כבר נספר בטבעת
function nmExtrasHtml() {
    const planTypes = {};
    Object.values(nmTodayCheckins).forEach(r => { planTypes[NEW_ME_TRACKER_SLOT[r.slot]] = r; });
    const rows = nmTrackerToday.filter(r => !nmIsDrinkRow(r) && r.source !== 'new_me').map(r => {
        const merged = planTypes[r.meal_type];
        const kcal = (Number(r.calories) || 0) - (merged && merged.mirror_mode === 'merged' ? (merged.kcal || 0) : 0);
        const desc = merged && merged.mirror_text ? String(r.food_description || '').split(` + ${merged.mirror_text}`).join('') : r.food_description;
        return { desc, kcal };
    }).filter(x => x.kcal > 0 || (x.desc && x.desc.trim()));
    if (!rows.length) return '';
    return `
        <div class="nm-extras">
            <div class="nm-slot-name">➕ ${nmEsc(t('nm_extras_title'))}</div>
            ${rows.map(x => `<div class="nm-extra-row"><span>${nmEsc(x.desc || '')}</span><span class="nm-option-meta"><bdi dir="ltr">${x.kcal}</bdi> ${nmEsc(t('calories_unit'))}</span></div>`).join('')}
            <div class="nm-fine">${nmEsc(t('nm_extras_hint'))}</div>
        </div>`;
}

// ---------- קיצור הדרך ✨ במסך הבית ----------
function updateNewMeShortcut() {
    const btn = document.getElementById('btn-newme-shortcut');
    if (btn) btn.classList.toggle('hidden', !hasNewMe);
}

function openNewMeMenuToday() {
    openNewMe('menu');
}

// החלפה - רק מתוך 2 האפשרויות האחרות של אותה ארוחה ב-PDF
function nmOpenSwap(slot) {
    const plan = nmProfile.plan;
    const current = nmChoice(slot);
    const sheet = document.createElement('div');
    sheet.className = 'nm-sheet-overlay';
    sheet.innerHTML = `
        <div class="nm-sheet" role="dialog" aria-modal="true">
            <h4>${nmEsc(t('nm_swap_title').replace('{slot}', t('nm_slot_' + slot)))}</h4>
            ${NEW_ME_OPTIONS.filter(o => o !== current).map(opt => {
                const o = NEW_ME_PLANS[plan][slot].options[opt];
                return `<button type="button" class="nm-option" data-opt="${opt}">
                    <span class="nm-option-name">${nmEsc(nmOptText(plan, slot, opt, true))}</span>
                    <span class="nm-option-text">${nmEsc(nmOptText(plan, slot, opt))}</span>
                    <span class="nm-option-meta">${nmMeta(o)}</span>
                </button>`;
            }).join('')}
            <button type="button" class="nm-btn-ghost nm-sheet-cancel">${nmEsc(t('nm_back'))}</button>
        </div>`;
    const close = () => sheet.remove();
    sheet.addEventListener('click', e => { if (e.target === sheet || e.target.classList.contains('nm-sheet-cancel')) close(); });
    sheet.querySelectorAll('[data-opt]').forEach(b => b.addEventListener('click', async () => {
        close();
        await nmSetChoice(slot, b.dataset.opt);
    }));
    (document.querySelector('.phone-wrapper') || document.body).appendChild(sheet);
}

async function nmSetChoice(slot, opt) {
    nmProfile['choice_' + slot] = opt;
    await supabaseClient.from('new_me_profile').update({ ['choice_' + slot]: opt, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    // אם כבר סומן היום - מעדכנים את הרישום לאפשרות החדשה
    if (nmTodayCheckins[slot]) {
        await nmUncheck(slot);
        await nmCheck(slot);
        await nmLoadToday();
        nmAfterTrackerChange();
    }
    nmRenderView(nmRoot());
}

async function nmToggleCheck(slot, btn) {
    if (btn) btn.disabled = true;
    try {
        if (nmTodayCheckins[slot]) await nmUncheck(slot);
        else await nmCheck(slot);
    } finally {
        await nmLoadToday();
        nmRenderView(nmRoot());
        nmAfterTrackerChange();
    }
}

async function nmCheck(slot) {
    const today = getLocalDateString();
    const plan = nmProfile.plan;
    const opt = nmChoice(slot);
    const o = NEW_ME_PLANS[plan][slot].options[opt];
    const text = `✨ ${nmOptText(plan, slot, opt, true)}`;
    const mealType = NEW_ME_TRACKER_SLOT[slot];
    const { data: existing } = await supabaseClient.from('calorie_tracker').select('id, food_description, calories, protein_grams').eq('user_id', currentUserId).eq('date', today).eq('meal_type', mealType).maybeSingle();
    let mode = 'own';
    if (existing) {
        mode = 'merged';
        await supabaseClient.from('calorie_tracker').update({
            food_description: `${existing.food_description} + ${text}`,
            calories: (existing.calories || 0) + o.kcal,
            protein_grams: (Number(existing.protein_grams) || 0) + o.protein,
        }).eq('id', existing.id);
    } else {
        await supabaseClient.from('calorie_tracker').insert({
            username: currentUsername, user_id: currentUserId, date: today, meal_type: mealType,
            food_description: text, calories: o.kcal, protein_grams: o.protein, source: 'new_me',
        });
    }
    const { data } = await supabaseClient.from('new_me_checkins').upsert({
        user_id: currentUserId, checkin_date: today, slot, option_id: opt, plan,
        kcal: o.kcal, protein_g: o.protein, mirror_mode: mode, mirror_text: text,
    }, { onConflict: 'user_id,checkin_date,slot' }).select().maybeSingle();
    nmTodayCheckins[slot] = data || { slot, kcal: o.kcal, protein_g: o.protein };
}

async function nmUncheck(slot) {
    const row = nmTodayCheckins[slot];
    if (!row) return;
    const today = getLocalDateString();
    const mealType = NEW_ME_TRACKER_SLOT[slot];
    const { data: existing } = await supabaseClient.from('calorie_tracker').select('id, food_description, calories, protein_grams, source').eq('user_id', currentUserId).eq('date', today).eq('meal_type', mealType).maybeSingle();
    if (existing) {
        const text = row.mirror_text || '';
        if (row.mirror_mode === 'own' && existing.source === 'new_me' && existing.food_description === text) {
            await supabaseClient.from('calorie_tracker').delete().eq('id', existing.id);
        } else {
            // הוסר רק החלק של New Me מתוך רישום משותף
            const desc = String(existing.food_description || '').split(` + ${text}`).join('').replace(text, '').replace(/^\s*\+\s*/, '').trim();
            const kcal = Math.max(0, (existing.calories || 0) - (row.kcal || 0));
            const protein = Math.max(0, (Number(existing.protein_grams) || 0) - (Number(row.protein_g) || 0));
            if (!desc && kcal === 0) await supabaseClient.from('calorie_tracker').delete().eq('id', existing.id);
            else await supabaseClient.from('calorie_tracker').update({ food_description: desc, calories: kcal, protein_grams: protein }).eq('id', existing.id);
        }
    }
    await supabaseClient.from('new_me_checkins').delete().eq('user_id', currentUserId).eq('checkin_date', today).eq('slot', slot);
    delete nmTodayCheckins[slot];
}

// שמירה כארוחה שמורה - אותו זרם כמו saveMealRowAsPreset (בורר קטגוריה פתוח לאישור)
async function nmSaveAsPreset(slot) {
    const plan = nmProfile.plan;
    const opt = nmChoice(slot);
    const o = NEW_ME_PLANS[plan][slot].options[opt];
    const { data } = await supabaseClient.from('meal_presets').select('*').eq('user_id', currentUserId);
    cachedPresets = data || [];
    if (!isPremiumUser && cachedPresets.length >= MEAL_PRESET_FREE_LIMIT) {
        showAppToast(t('preset_limit_desc'), 'error');
        openPremiumUpgradeModal();
        return;
    }
    cancelPresetEdit();
    document.getElementById('new-preset-name').value = nmOptText(plan, slot, opt, true);
    document.getElementById('new-preset-calories').value = o.kcal;
    document.getElementById('new-preset-protein').value = o.protein;
    document.getElementById('new-preset-category').value = NEW_ME_PRESET_CATEGORY[slot];
    updateCustomSelectDisplay('new-preset-category');
    openModal('modal-add-preset');
    loadPresetManageList();
}

// ---------- טבלה יומית ----------
async function nmRenderTable(body) {
    if (!nmTableDate) nmTableDate = getLocalDateString();
    const [{ data }, { data: drinkRows }] = await Promise.all([
        supabaseClient.from('new_me_checkins').select('*').eq('user_id', currentUserId).eq('checkin_date', nmTableDate),
        supabaseClient.from('calorie_tracker').select('meal_type, food_description, calories').eq('user_id', currentUserId).eq('date', nmTableDate).like('meal_type', 'nm_drink%'),
    ]);
    const rows = NEW_ME_SLOTS.map(s => (data || []).find(r => r.slot === s)).filter(Boolean);
    const drinks = drinkRows || [];
    const total = rows.reduce((a, r) => ({ kcal: a.kcal + r.kcal, protein: a.protein + Number(r.protein_g) }), { kcal: drinks.reduce((a, d) => a + (Number(d.calories) || 0), 0), protein: 0 });
    body.innerHTML = `
        <div class="nm-date-row">
            <button type="button" class="nm-chip" onclick="nmShiftTableDate(-1)" aria-label="-1">‹</button>
            <input type="date" class="nm-date" value="${nmTableDate}" max="${getLocalDateString()}" onchange="nmTableDate = this.value || getLocalDateString(); nmRenderTable(document.getElementById('nm-view-body'))">
            <button type="button" class="nm-chip" onclick="nmShiftTableDate(1)" aria-label="+1">›</button>
        </div>
        ${rows.length || drinks.length ? `
        <div class="nm-table-wrap"><table class="nm-table">
            <thead><tr><th>${nmEsc(t('nm_table_food'))}</th><th>${nmEsc(t('calories_unit'))}</th><th>${nmEsc(t('nm_table_protein'))}</th></tr></thead>
            <tbody>${rows.map(r => `<tr><td><span class="nm-td-slot">${nmEsc(t('nm_slot_' + r.slot))}</span>${nmEsc(nmOptText(r.plan, r.slot, r.option_id, true))}</td><td class="nm-num"><bdi dir="ltr">~${r.kcal}</bdi></td><td class="nm-num"><bdi dir="ltr">~${Math.round(r.protein_g)}</bdi></td></tr>`).join('')}${drinks.map(d => `<tr><td><span class="nm-td-slot">${nmEsc(t('nm_slot_drinks'))}</span>${nmEsc(String(d.food_description || '').replace(/^🥤\s*/, ''))}</td><td class="nm-num">${Number(d.calories) || 0}</td><td class="nm-num">0</td></tr>`).join('')}</tbody>
            <tfoot><tr><td>${nmEsc(t('nm_table_total'))}</td><td class="nm-num">${nmFmt(total.kcal)}</td><td class="nm-num">${nmFmt(Math.round(total.protein))}</td></tr></tfoot>
        </table></div>` : `<p class="nm-empty">${nmEsc(t('nm_table_empty'))}</p>`}
        <p class="nm-ai-note">${nmEsc(t('nm_ai_note'))}</p>`;
}

function nmShiftTableDate(delta) {
    const d = new Date(nmTableDate + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    const next = getLocalDateString(d);
    if (next > getLocalDateString()) return;
    nmTableDate = next;
    nmRenderTable(document.getElementById('nm-view-body'));
}

// ---------- חודשי + משקל ----------
async function nmRenderMonth(body) {
    const now = new Date();
    if (!nmMonthKey) nmMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [y, m] = nmMonthKey.split('-').map(Number);
    const first = `${nmMonthKey}-01`;
    const daysInMonth = new Date(y, m, 0).getDate();
    const last = `${nmMonthKey}-${String(daysInMonth).padStart(2, '0')}`;
    const [{ data: checks }, { data: weights }] = await Promise.all([
        supabaseClient.from('new_me_checkins').select('checkin_date, slot').eq('user_id', currentUserId).gte('checkin_date', first).lte('checkin_date', last),
        supabaseClient.from('weight_tracker').select('weight_date, weight_value').eq('user_id', currentUserId).order('weight_date', { ascending: true }),
    ]);
    const perDay = {};
    (checks || []).forEach(r => { perDay[r.checkin_date] = (perDay[r.checkin_date] || 0) + 1; });
    const weightByDay = {};
    (weights || []).forEach(w => { weightByDay[w.weight_date] = w.weight_value; });
    const monthLabel = new Intl.DateTimeFormat(currentLang, { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
    // כותרות ימים לפי שפת האפליקציה, שבוע מתחיל ביום ראשון (כמו שאר לוחות השנה באפליקציה)
    const dayNames = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(currentLang, { weekday: 'narrow' }).format(new Date(2024, 0, 7 + i)));
    const lead = new Date(y, m - 1, 1).getDay();
    const today = getLocalDateString();
    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<span class="nm-cal-cell empty"></span>';
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${nmMonthKey}-${String(d).padStart(2, '0')}`;
        const n = perDay[ds] || 0;
        const w = weightByDay[ds];
        cells += `<span class="nm-cal-cell lvl-${n}${ds === today ? ' today' : ''}" title="${n}/4${w ? ' · ' + w : ''}"><span class="nm-cal-day">${d}</span>${w ? `<span class="nm-cal-w">${nmEsc(w)}</span>` : ''}</span>`;
    }
    const wList = (weights || []).slice(-60);
    body.innerHTML = `
        <div class="nm-month-nav">
            <button type="button" class="nm-chip" onclick="nmShiftMonth(-1)">‹</button>
            <span class="nm-month-label">${nmEsc(monthLabel)}</span>
            <button type="button" class="nm-chip" onclick="nmShiftMonth(1)">›</button>
        </div>
        <div class="nm-cal">
            ${dayNames.map(n => `<span class="nm-cal-head">${nmEsc(n)}</span>`).join('')}
            ${cells}
        </div>
        <div class="nm-legend">${[0, 1, 2, 3, 4].map(n => `<span class="nm-cal-cell lvl-${n}"></span>`).join('')}<span>${nmEsc(t('nm_month_legend'))}</span></div>
        <div class="nm-weight">
            <div class="nm-weight-head">
                <h4>⚖️ ${nmEsc(t('nm_weight_title'))}</h4>
                ${nmProfile.goal_weight ? `<span class="nm-fine">${nmEsc(t('nm_goal_weight_line').replace('{w}', nmProfile.goal_weight))}</span>` : ''}
            </div>
            ${nmWeightChart(wList)}
            <div class="nm-weight-add">
                <input type="number" id="nm-weight-input" inputmode="decimal" step="0.1" min="20" max="400" placeholder="${nmEsc(t('nm_weight_placeholder'))}">
                <button type="button" class="nm-btn-primary nm-btn-small" onclick="nmAddWeight(this)">${nmEsc(t('nm_add_weight'))}</button>
            </div>
            ${wList.length ? `<ul class="nm-weight-list">${wList.slice(-7).reverse().map(w => `<li><span>${nmEsc(new Intl.DateTimeFormat(currentLang, { day: 'numeric', month: 'short' }).format(new Date(w.weight_date + 'T12:00:00')))}</span><span class="nm-num">${nmEsc(w.weight_value)}</span></li>`).join('')}</ul>` : `<p class="nm-empty">${nmEsc(t('nm_weight_empty'))}</p>`}
        </div>`;
}

function nmWeightChart(list) {
    const pts = list.map(w => Number(w.weight_value)).filter(v => v > 0);
    if (pts.length < 2) return '';
    const W = 300, H = 90, pad = 8;
    const goal = nmProfile && nmProfile.goal_weight ? Number(nmProfile.goal_weight) : null;
    const all = goal ? pts.concat(goal) : pts;
    const min = Math.min(...all) - 0.5, max = Math.max(...all) + 0.5;
    const x = i => pad + (i * (W - 2 * pad)) / (pts.length - 1);
    const yv = v => H - pad - ((v - min) / (max - min)) * (H - 2 * pad);
    const line = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${yv(v).toFixed(1)}`).join(' ');
    const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - pad} L${x(0).toFixed(1)},${H - pad} Z`;
    return `<svg class="nm-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
        ${goal ? `<line x1="${pad}" x2="${W - pad}" y1="${yv(goal).toFixed(1)}" y2="${yv(goal).toFixed(1)}" class="nm-chart-goal"/>` : ''}
        <path d="${area}" class="nm-chart-area"/>
        <path d="${line}" class="nm-chart-line"/>
        <circle cx="${x(pts.length - 1).toFixed(1)}" cy="${yv(pts[pts.length - 1]).toFixed(1)}" r="3.5" class="nm-chart-dot"/>
    </svg>`;
}

function nmShiftMonth(delta) {
    const [y, m] = nmMonthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    nmMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    nmRenderMonth(document.getElementById('nm-view-body'));
}

async function nmAddWeight(btn) {
    const input = document.getElementById('nm-weight-input');
    const w = parseFloat(input && input.value);
    if (!(w >= 20 && w <= 400)) { showAppToast(t('nm_q_weight_missing'), 'error'); return; }
    btn.disabled = true;
    await insertWeightRecord(w, getLocalDateString(), null);
    if (typeof loadWeightHistory === 'function') loadWeightHistory();
    showAppToast(t('nm_weight_saved'));
    nmRenderMonth(document.getElementById('nm-view-body'));
}

// ---------- טיפים / PDF / הגדרות ----------
function nmRenderTips(body) {
    body.innerHTML = `<ul class="nm-tips">${['tip_water', 'tip_veggies', 'tip_personal'].map(k => {
        const txt = newMeText(k);
        const idx = txt.search(/[:：]/);
        return `<li>${idx > 0 ? `<strong>${nmEsc(txt.slice(0, idx + 1))}</strong>${nmEsc(txt.slice(idx + 1))}` : nmEsc(txt)}</li>`;
    }).join('')}</ul>`;
}

async function nmOpenPdf(btn) {
    // חלון נפתח מיד (בתוך אירוע הלחיצה) כדי שדפדפנים לא יחסמו אותו כחלון קופץ
    const win = window.open('', '_blank');
    showAppToast(t('nm_pdf_opening'));
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/new-me-pdf-url`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ lang: currentLang }),
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || !result.url) throw new Error('no url');
        if (win) win.location.href = result.url; else window.location.href = result.url;
    } catch {
        if (win) win.close();
        showAppToast(t('nm_pdf_error'), 'error');
    }
}

function nmRenderSettings(body) {
    body.innerHTML = `
        <div class="nm-settings-block">
            <div class="nm-slot-name">${nmEsc(t('nm_settings_plan'))}</div>
            <div class="nm-plan-cards">
                ${[1300, 1500].map(p => `
                    <button type="button" class="nm-plan-card${nmProfile.plan === p ? ' selected' : ''}" onclick="nmChangePlan(${p})">
                        <span class="nm-plan-num">${nmFmt(p)}</span>
                        <span class="nm-plan-unit">${nmEsc(t('calories_unit'))}</span>
                    </button>`).join('')}
            </div>
            <p class="nm-fine">${nmEsc(t('nm_q_plan_note'))}</p>
        </div>
        <button type="button" class="nm-row-btn" onclick="nmStartQuiz(true); renderNewMe()">📝 ${nmEsc(t('nm_settings_retake'))}</button>
        <details class="nm-row-details">
            <summary>⚕️ ${nmEsc(t('nm_settings_disclaimer'))}</summary>
            ${nmDisclaimerHtml()}
        </details>`;
}

async function nmChangePlan(p) {
    if (nmProfile.plan === p) return;
    nmProfile.plan = p;
    await supabaseClient.from('new_me_profile').update({ plan: p, updated_at: new Date().toISOString() }).eq('user_id', currentUserId);
    await nmSyncCalorieGoal();
    showAppToast(t('nm_plan_changed_toast'));
    nmRenderView(nmRoot());
}
