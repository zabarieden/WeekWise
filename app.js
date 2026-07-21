const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt';
let supabaseClient;
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayNameKeys = ['day_sunday', 'day_monday', 'day_tuesday', 'day_wednesday', 'day_thursday', 'day_friday', 'day_saturday'];
// עמודת שעות ברירת המחדל: זהה לכל יום מלכתחילה (לא אקראי/שונה מיום ליום),
// וניתנת להתאמה אישית מלאה - כולל הוספה/הסרה של שעות שלמות, לא רק עריכת
// ערך - דרך "הגדרת שעות ברירת מחדל" (openHoursSettingsModal/saveDefaultHours).
// אורך המערך הזה *הוא* גודל "רשת הבסיס" בפועל (ר' defaultDaySlotNumbers) -
// אין קבוע נפרד שיכול להתפצל ממנו
let defaultHours = ['09:00', '12:00', '15:00', '18:00', '21:00'];
let currentUsername = '';
let currentUserId = null;
let reminderIntervalStarted = false;
let authMode = 'login';

function getDayName(dayIndex) { return t(dayNameKeys[dayIndex]); }

function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
    loadSavedLanguage();
    populateLanguageDropdown();
    applyLightMode(isLightModeOn());
    initSupabase();
    initCubesNavigation();
    renderHomeGreeting();
    document.addEventListener('click', unlockReminderAudio);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkReminders();
    });

    if (supabaseClient) {
        const { data: { session } } = await supabaseClient.auth.getSession();
        if (session) initAppAfterAuth(session.user);
    }

    updateAuthUI();
    document.getElementById('auth-toggle-link').addEventListener('click', (e) => {
        e.preventDefault();
        authMode = authMode === 'login' ? 'signup' : 'login';
        updateAuthUI();
    });
    document.getElementById('btn-auth-submit').addEventListener('click', submitAuthForm);
    document.getElementById('btn-logout').addEventListener('click', logoutUser);
    document.getElementById('btn-add-preset').addEventListener('click', () => {
        addCustomPreset();
        closeModal('modal-add-preset');
    });
    document.getElementById('btn-save-new-slot').addEventListener('click', async () => {
        await saveScheduleSlotFromAdder();
        closeModal('modal-add-task');
    });
    document.getElementById('btn-delete-slot-specific').addEventListener('click', () => {
        deleteScheduleSlotFromAdder();
        closeModal('modal-add-task');
    });
    document.getElementById('btn-clear-entire-week').addEventListener('click', clearEntireWeeklySchedule);
    document.getElementById('btn-save-weight').addEventListener('click', saveNewWeightRecord);
    document.getElementById('btn-save-hours').addEventListener('click', saveDefaultHours);
    document.querySelectorAll('.calories-input').forEach(input => {
        input.addEventListener('input', updateLiveCaloriesToday);
    });
    document.getElementById('btn-save-center-item').addEventListener('click', submitCenterItem);
    document.getElementById('center-item-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') submitCenterItem();
    });
    document.getElementById('btn-connect-health').addEventListener('click', connectHealthData);
    document.getElementById('btn-ai-quick-add').addEventListener('click', handleAIQuickAdd);
});

// --- שפה: אכלוס בורר השפה, ורענון תוכן דינמי כשמחליפים שפה ---
function populateLanguageDropdown() {
    const select = document.getElementById('language-select');
    if (!select) return;
    select.innerHTML = '';
    SUPPORTED_LANGUAGES.forEach(lang => {
        const option = document.createElement('option');
        option.value = lang;
        option.textContent = LANGUAGE_NAMES[lang];
        select.appendChild(option);
    });
    select.value = currentLang;
    select.onchange = (e) => setLanguage(e.target.value);
}

function onLanguageChanged() {
    const select = document.getElementById('language-select');
    if (select) select.value = currentLang;
    renderHomeGreeting();
    if (!currentUserId) return;
    loadCustomDefaultHours();
    buildWeeklyScheduleAccordionUI();
    loadWeeklySchedule();
    loadMealPresetsToSelects();
}

// --- הודעת מערכת כללית ויפה, במקום alert() הדפדפן ---
let appToastTimeout = null;
function showAppToast(message, type = 'success') {
    const toast = document.getElementById('app-toast');
    if (!toast) return;
    const icon = document.getElementById('app-toast-icon');
    toast.classList.remove('error');
    if (type === 'error') { toast.classList.add('error'); icon.textContent = '⚠️'; }
    else { icon.textContent = '✅'; }
    document.getElementById('app-toast-text').textContent = message;
    toast.classList.add('show');
    clearTimeout(appToastTimeout);
    appToastTimeout = setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateLiveCaloriesToday() {
    let total = 0;
    document.querySelectorAll('.calories-input').forEach(input => {
        total += parseInt(input.value) || 0;
    });
    document.getElementById('calories-today').innerText = total;
}

// --- הלוגיקה לסימון V מצד ימין ---
async function toggleTaskStatus(id, currentStatus, type) {
    if (!supabaseClient) return;
    await supabaseClient.from('my_center_tasks').update({ is_completed: !currentStatus }).eq('id', id);
    loadCenterItems(type);
}

function loadAllCenterItems() {
    ['weekly', 'general'].forEach(type => loadCenterItems(type));
}

async function loadCenterItems(type) {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('my_center_tasks').select('*').eq('user_id', currentUserId).eq('task_type', type).order('created_at', { ascending: true });
    if (error) { showAppToast(t('error_loading_list') + error.message, 'error'); return; }
    if (!data) return;
    const listUl = document.getElementById(`${type}-list`);
    listUl.innerHTML = '';
    data.forEach(item => {
        const li = document.createElement('li');
        li.setAttribute('data-item-id', item.id);
        li.innerHTML = `
            <button class="btn-complete-item${item.is_completed ? ' checked' : ''}" onclick="toggleTaskStatus('${item.id}', ${item.is_completed}, '${type}')">
                ${item.is_completed ? '✓' : ''}
            </button>
            <span class="center-list-item-text${item.is_completed ? ' completed' : ''}">
                ${item.content}
            </span>
            <button class="btn-edit-item" onclick="openCenterItemEditor(this, '${type}')" title="${t('edit_btn')}">✏️</button>
            <button class="btn-delete-item" onclick="deleteCenterItem('${item.id}', '${type}')">❌</button>
        `;
        listUl.appendChild(li);
    });
}

// --- ניהול ארוחות (מוטמע מחדש במלואו) ---
let editingPresetId = null;
let cachedPresets = [];
const MEAL_PRESET_FREE_LIMIT = 10;

async function addCustomPreset() {
    const nameInput = document.getElementById('new-preset-name');
    const caloriesInput = document.getElementById('new-preset-calories');
    const name = nameInput.value.trim();
    const calories = parseInt(caloriesInput.value) || 0;
    const category = document.getElementById('new-preset-category').value;
    if (!name || calories <= 0) return;

    // מגבלת חינם: עד 10 ארוחות שמורות סה"כ (לא ניתן להוספה, כן ניתן לעריכה) -
    // מבוססת על הכמות הנוכחית במאגר, כך שמחיקת ארוחה משחררת מקום להוספה חדשה
    if (!editingPresetId && !isPremiumUser && cachedPresets.length >= MEAL_PRESET_FREE_LIMIT) {
        showAppToast(t('preset_limit_desc'), 'error');
        openPremiumUpgradeModal();
        return;
    }

    if (editingPresetId) {
        await supabaseClient.from('meal_presets').update({ meal_category: category, food_name: name, calories: calories }).eq('id', editingPresetId);
        showAppToast(t('preset_updated_success'));
        cancelPresetEdit();
    } else {
        await supabaseClient.from('meal_presets').insert({ username: currentUsername, user_id: currentUserId, meal_category: category, food_name: name, calories: calories });
        showAppToast(t('preset_added_success'));
    }
    nameInput.value = '';
    caloriesInput.value = '';
    loadMealPresetsToSelects();
    loadPresetManageList();
}

function editPreset(id) {
    const preset = cachedPresets.find(p => p.id === id);
    if (!preset) return;
    editingPresetId = id;
    document.getElementById('new-preset-name').value = preset.food_name;
    document.getElementById('new-preset-calories').value = preset.calories;
    document.getElementById('new-preset-category').value = preset.meal_category;
    document.getElementById('btn-add-preset').textContent = t('preset_update_btn');
}

function cancelPresetEdit() {
    editingPresetId = null;
    document.getElementById('new-preset-name').value = '';
    document.getElementById('new-preset-calories').value = '';
    document.getElementById('btn-add-preset').textContent = t('preset_add_btn');
}

async function deletePreset(id) {
    await supabaseClient.from('meal_presets').delete().eq('id', id);
    if (editingPresetId === id) cancelPresetEdit();
    loadMealPresetsToSelects();
    loadPresetManageList();
    showAppToast(t('preset_deleted_success'));
}

// סדר קבוע של הקטגוריות (תואם לאפשרויות ב-#new-preset-category) - כך שהרשימה
// המקובצת תמיד מוצגת באותו סדר לוגי (בוקר -> צהריים -> ערב -> נשנושים), ולא
// לפי סדר יצירה כרונולוגי שהופך לבלגן ככל שנוספות עוד ארוחות
const PRESET_CATEGORY_ORDER = ['morning', 'noon', 'evening', 'snack'];

async function loadPresetManageList() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('meal_presets').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true });
    cachedPresets = data || [];
    const list = document.getElementById('preset-manage-list');
    if (!list) return;
    list.innerHTML = '';

    if (!cachedPresets.length) {
        const empty = document.createElement('li');
        empty.className = 'preset-manage-empty';
        empty.textContent = t('preset_manage_empty');
        list.appendChild(empty);
        updatePresetLimitHint();
        return;
    }

    PRESET_CATEGORY_ORDER.forEach(catKey => {
        const items = cachedPresets.filter(p => p.meal_category === catKey);
        if (!items.length) return;

        const group = document.createElement('li');
        group.className = 'preset-category-group expanded';
        group.innerHTML = `
            <div class="preset-category-header" onclick="togglePresetCategory(this)">
                <span class="preset-category-label">${t('preset_cat_' + catKey)}</span>
                <span class="preset-category-count">${items.length}</span>
                <span class="preset-category-chevron">▼</span>
            </div>
            <ul class="preset-category-items"></ul>
        `;
        const itemsList = group.querySelector('.preset-category-items');
        items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'preset-manage-item';
            li.innerHTML = `
                <span class="preset-manage-name">${item.food_name} (${item.calories})</span>
                <div class="preset-manage-actions">
                    <button class="btn-edit-item" onclick="editPreset('${item.id}')">✏️</button>
                    <button class="btn-delete-item" onclick="deletePreset('${item.id}')">🗑️</button>
                </div>
            `;
            itemsList.appendChild(li);
        });
        list.appendChild(group);
    });
    updatePresetLimitHint();
}

function togglePresetCategory(headerEl) {
    const group = headerEl.closest('.preset-category-group');
    if (group) group.classList.toggle('expanded');
}

function updatePresetLimitHint() {
    const hint = document.getElementById('preset-limit-hint');
    if (!hint) return;
    if (isPremiumUser) { hint.textContent = ''; return; }
    // מוצג רק כשנשארו 1-2 מקומות פנויים (כלומר 8 או 9 ארוחות שמורות) - שקט
    // ולא פולשני עד שהמגבלה ממש קרובה, לא באופן קבוע
    const remaining = MEAL_PRESET_FREE_LIMIT - cachedPresets.length;
    hint.textContent = (remaining > 0 && remaining <= 2) ? t('preset_limit_near_hint').replace('{count}', remaining) : '';
}

async function loadMealPresetsToSelects() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('meal_presets').select('*').eq('user_id', currentUserId);
    cachedPresets = data || cachedPresets;
    if (!data) return;
    document.querySelectorAll('.preset-select').forEach(select => {
        const category = select.getAttribute('data-category');
        select.innerHTML = `<option value="">${t('preset_select_placeholder')}</option>`;
        const filtered = data.filter(item => {
            if (category === 'morning') return item.meal_category === 'morning';
            if (category === 'snack') return item.meal_category === 'snack';
            return item.meal_category === 'noon' || item.meal_category === 'evening';
        });
        filtered.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.calories;
            option.textContent = `${preset.food_name} (${preset.calories})`;
            option.dataset.foodName = preset.food_name;
            select.appendChild(option);
        });
        select.onchange = (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (!selectedOption.value) return;
            const mealRow = e.target.closest('.meal-row');
            mealRow.querySelector('.food-input').value = selectedOption.dataset.foodName;
            mealRow.querySelector('.calories-input').value = selectedOption.value;
            updateLiveCaloriesToday();
        };
    });
}

function togglePasswordVisibility() {
    const input = document.getElementById('auth-password-input');
    const btn = document.getElementById('btn-toggle-password');
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    btn.textContent = showing ? '👁️' : '🙈';
}

function updateAuthUI() {
    const subtitle = document.getElementById('auth-mode-subtitle');
    const submitBtn = document.getElementById('btn-auth-submit');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    const messageEl = document.getElementById('auth-message');
    if (authMode === 'login') {
        subtitle.textContent = t('auth_login_subtitle');
        submitBtn.textContent = t('auth_login_btn');
        toggleText.textContent = t('auth_no_account');
        toggleLink.textContent = t('auth_toggle_signup');
    } else {
        subtitle.textContent = t('auth_signup_subtitle');
        submitBtn.textContent = t('auth_signup_btn');
        toggleText.textContent = t('auth_have_account');
        toggleLink.textContent = t('auth_toggle_login');
    }
    messageEl.textContent = '';
}

async function submitAuthForm() {
    const email = document.getElementById('auth-email-input').value.trim();
    const password = document.getElementById('auth-password-input').value;
    const messageEl = document.getElementById('auth-message');
    messageEl.textContent = '';
    if (!email || !password) { messageEl.textContent = t('auth_fill_both'); return; }
    if (!supabaseClient) initSupabase();
    if (!supabaseClient) { messageEl.textContent = t('auth_server_error'); return; }

    if (authMode === 'signup') {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) { messageEl.textContent = error.message; return; }
        if (data.session) {
            initAppAfterAuth(data.user);
        } else {
            messageEl.style.color = 'var(--accent-green)';
            messageEl.textContent = t('auth_signup_success');
            authMode = 'login';
            updateAuthUI();
        }
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { messageEl.textContent = t('auth_wrong_credentials'); return; }
        initAppAfterAuth(data.user);
    }
}

async function initAppAfterAuth(user) {
    currentUserId = user.id;
    currentUsername = user.email;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    showAppLoadingOverlay();

    // כאן הוספתי את מילוי התאריך האוטומטי גם למשקל וגם לארוחות להיום
    const today = getLocalDateString();
    const selectedDateInput = document.getElementById('selected-date');
    if(selectedDateInput) selectedDateInput.value = today;
    const weightDateInput = document.getElementById('new-weight-date');
    if(weightDateInput) weightDateInput.value = today;

    loadCustomDefaultHours();
    buildWeeklyScheduleAccordionUI();
    await Promise.all([
        loadWeeklySchedule(),
        loadStats(),
        loadMealPresetsToSelects(),
        loadPresetManageList(),
        loadProgressTargets(),
        loadWeightHistory(),
        loadCalendarEvents(),
        loadTodayTasks(),
        loadMonthlyCalendarGrid(),
        loadRecipes(),
        loadAiUsage(),
        loadPremiumStatus(),
        loadColorTheme(),
        loadMonthlyGoal()
    ]);
    // ניקוי שורות "יתומות" (שנשארו מברירת מחדל ישנה עם יותר שורות) רץ פעם
    // אחת בלבד כאן, בטעינת האפליקציה - לא בכל loadWeeklySchedule (ר' ההערה שם)
    await pruneEmptyExcessSlots();
    loadAllCenterItems();
    hideAppLoadingOverlay();
    applyPwaShortcutDeepLink();
    initFixedAiFab();
    initFixedAiBrainFab();
    document.getElementById('btn-save-nutrition').onclick = saveNutrition;
    document.getElementById('btn-copy-yesterday').onclick = copyFromYesterday;
    selectedDateInput.onchange = (e) => { loadDailyNutrition(e.target.value); loadDailySteps(e.target.value); };

    // טעינת תזונה וצעדים להיום אוטומטית (אם קיים)
    if(today) { loadDailyNutrition(today); loadDailySteps(today); }

    requestNotificationPermission();
    checkReminders();
    if (!reminderIntervalStarted) {
        reminderIntervalStarted = true;
        setInterval(checkReminders, 20000);
    }
}

function showAppLoadingOverlay() {
    const overlay = document.getElementById('app-loading-overlay');
    if (overlay) overlay.classList.add('open');
}

function hideAppLoadingOverlay() {
    const overlay = document.getElementById('app-loading-overlay');
    if (overlay) overlay.classList.remove('open');
}

async function logoutUser() {
    if (supabaseClient) await supabaseClient.auth.signOut();
    location.reload();
}
function openModal(modalId) { document.getElementById(modalId).classList.add('open'); }
function closeModal(modalId) { document.getElementById(modalId).classList.remove('open'); }
let pendingCenterItemType = null;
// editingCenterItemId!=null אומר שהמודל פתוח במצב עריכה (לא הוספה) - אותו
// מודל/שדה משמשים את שני הזרמים, submitCenterItem מנתב לפי מה שמוגדר כאן
let editingCenterItemId = null;
function openCenterAdder(type) {
    editingCenterItemId = null;
    pendingCenterItemType = type;
    document.getElementById('center-item-modal-title').textContent = t('add_item_title');
    const input = document.getElementById('center-item-input');
    input.value = '';
    openModal('modal-add-center-item');
    setTimeout(() => input.focus(), 150);
}

// נקרא מכפתור העריכה (✏️) בכל שורת פתק/משימה - קורא את הטקסט הנוכחי ואת
// מזהה הפריט ישירות מה-DOM (לא מוטבע ב-onclick) כדי לא להסתבך עם escaping
// של תווים מיוחדים שהמשתמש הקליד בתוכן עצמו
function openCenterItemEditor(btn, type) {
    const li = btn.closest('li');
    if (!li) return;
    editingCenterItemId = li.getAttribute('data-item-id');
    pendingCenterItemType = type;
    const currentText = li.querySelector('.center-list-item-text').textContent.trim();
    document.getElementById('center-item-modal-title').textContent = t('edit_item_title');
    const input = document.getElementById('center-item-input');
    input.value = currentText;
    openModal('modal-add-center-item');
    setTimeout(() => input.focus(), 150);
}

function submitCenterItem() {
    const input = document.getElementById('center-item-input');
    const text = input.value.trim();
    const type = pendingCenterItemType;
    const editId = editingCenterItemId;
    closeModal('modal-add-center-item');
    editingCenterItemId = null;
    pendingCenterItemType = null;
    if (!text || !type) return;
    if (editId) updateCenterItemDirect(editId, type, text);
    else insertCenterItemDirect(type, text);
}

async function updateCenterItemDirect(id, type, content) {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const { error } = await supabaseClient.from('my_center_tasks').update({ content }).eq('id', id);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    await loadCenterItems(type);
    showAppToast(t('item_added_success'));
}

async function insertCenterItemDirect(type, content) {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const { error } = await supabaseClient.from('my_center_tasks').insert({ username: currentUsername, user_id: currentUserId, task_type: type, content: content });
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    await loadCenterItems(type);
    expandCardForList(`${type}-list`);
    showAppToast(t('item_added_success'));
}

function expandCardForList(listId) {
    const list = document.getElementById(listId);
    const card = list && list.closest('.card');
    if (card) card.classList.add('expanded');
}

function renderHomeGreeting() {
    const textEl = document.getElementById('home-greeting-text');
    const dateEl = document.getElementById('home-greeting-date');
    if (!textEl || !dateEl) return;
    const hour = new Date().getHours();
    let key = 'home_greeting_morning';
    if (hour >= 12 && hour < 18) key = 'home_greeting_afternoon';
    else if (hour >= 18 || hour < 5) key = 'home_greeting_evening';
    textEl.textContent = t(key);
    dateEl.textContent = new Date().toLocaleDateString(currentLang, { weekday: 'long', day: 'numeric', month: 'long' });
}

function initCubesNavigation() {
    const cubes = document.querySelectorAll('.nav-cube');
    const tabContents = document.querySelectorAll('.tab-content');
    cubes.forEach(cube => cube.addEventListener('click', () => {
        cubes.forEach(c => c.classList.remove('active')); cube.classList.add('active');
        tabContents.forEach(content => { content.classList.remove('active-tab'); if (content.id === cube.getAttribute('data-target')) content.classList.add('active-tab'); });
        // בכל מעבר בין המסכים הראשיים, כל מסך חוזר להתחיל מרשת התת-קוביות שלו
        // (ולא נשאר "תקוע" בתוך תצוגה ממוקדת שהמשתמש פתח בביקור קודם)
        tabContents.forEach(content => closeSubView(content.id));
        // מסך הבית (רשת הקוביות הראשית) נעלם לגמרי בזמן שנמצאים בתוך מסך פנימי -
        // זו מעבר "מסך מלא" אמיתי, לא סרגל ניווט קבוע שנשאר צמוד למעלה
        const homePanel = document.querySelector('.home-hero-panel');
        if (homePanel) homePanel.classList.add('hidden');
        // לוח הימים כבר לא פעיל כברירת מחדל מרגע הטעינה (המסך הראשי הוא כעת מסך
        // הבית) - הגובה שחושב בזמן ש-schedule-section היה display:none הוא 0,
        // אז מחשבים מחדש בכל פעם שנכנסים אליו בפועל
        if (cube.getAttribute('data-target') === 'schedule-section') updateActiveDayPageHeight();
    }));
}

// חוזרים למסך הבית הטהור: כל המסכים הפנימיים נסגרים, קובייה אף אחת לא מסומנת
// כפעילה, ומסך הבית (רשת הקוביות) חוזר להיות היחיד המוצג
function goHome() {
    const cubes = document.querySelectorAll('.nav-cube');
    const tabContents = document.querySelectorAll('.tab-content');
    cubes.forEach(c => c.classList.remove('active'));
    tabContents.forEach(content => { content.classList.remove('active-tab'); closeSubView(content.id); });
    const homePanel = document.querySelector('.home-hero-panel');
    if (homePanel) homePanel.classList.remove('hidden');
}

function switchToTab(targetId) {
    const cube = document.querySelector(`.nav-cube[data-target="${targetId}"]`);
    if (cube) cube.click();
}

// --- רמה 2 של הניווט: תוך כדי מסך ראשי, "תת-קוביה" פותחת תצוגה ממוקדת של
// פיצ'ר בודד (subview-panel) ומסתירה את רשת התת-קוביות ואת שאר התצוגות -
// אותו דפוס show/hide בדיוק כמו openRecipeCategory/closeRecipeCategory הקיימים ---
function openSubTile(sectionId, subviewId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    const grid = section.querySelector('.sub-tile-grid');
    if (grid) grid.classList.add('hidden');
    section.querySelectorAll('.subview-panel').forEach(p => p.classList.toggle('open', p.getAttribute('data-subview') === subviewId));
}

function closeSubView(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.querySelectorAll('.subview-panel').forEach(p => p.classList.remove('open'));
    const grid = section.querySelector('.sub-tile-grid');
    if (grid) grid.classList.remove('hidden');
}

// --- קיצורי דרך של ה-PWA (manifest.json shortcuts): קפיצה ישירה ללשונית מבוקשת ---
function applyPwaShortcutDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const validTargets = ['schedule-section', 'my-center-section', 'nutrition-section'];
    if (view && validTargets.includes(view)) switchToTab(view);
}

// שני כפתורי ה-FAB (📝 "פתק מהיר" בפינה הימנית-תחתונה, 🤖 עוזר ה-AI בפינה
// השמאלית-עליונה - במקום אימוג'י הברכה שהוסר) ננעלים שניהם קבוע במקומם לפי
// בקשה מפורשת, בלי שום גרירה. המיקום עצמו נקבע לגמרי ב-CSS (.ai-fab /
// .ai-brain-fab, position:absolute יחסית ל-.phone-wrapper), כאן רק מחברים
// את הקליק - בלי left/top/localStorage/pointer-events בכלל
function initFixedAiFab() {
    const el = document.getElementById('btn-ai-fab');
    if (!el) return;
    el.onclick = () => openModal('modal-ai-quick-add');
}

function initFixedAiBrainFab() {
    const el = document.getElementById('btn-ai-brain-fab');
    if (!el) return;
    el.onclick = () => openAiBrainModal('schedule');
}

function getLocalDateString(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getFormattedDateForDay(dayIndex) {
    const current = new Date();
    const sundayDate = new Date(current); sundayDate.setDate(current.getDate() - current.getDay());
    const targetDate = new Date(sundayDate); targetDate.setDate(sundayDate.getDate() + dayIndex);
    return `${targetDate.getDate()}.${targetDate.getMonth() + 1}`;
}

// --- שעות ברירת מחדל מותאמות אישית (נשמר מקומית per-device, זו העדפת תצוגה בלבד) ---
function defaultHoursKey() {
    return `weekwise_default_hours_${currentUserId}`;
}

// --- מספרי המשבצות הפעילות ליום (ניתנות להוספה/הסרה), נשמר מקומית per-device ---
// ה-10 המקוריות הן רק פריסת ברירת מחדל ראשונית, לא מבנה קבוע
let daySlotsConfig = {};

function daySlotsKey() {
    return `weekwise_day_slots_${currentUserId}`;
}

function defaultDaySlotNumbers() {
    return Array.from({ length: defaultHours.length }, (_, i) => i + 1);
}

function loadDaySlotsConfig() {
    const raw = localStorage.getItem(daySlotsKey());
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                daySlotsConfig = parsed;
                return;
            }
        } catch {}
    }
    daySlotsConfig = {};
    dbDaysMap.forEach(day => { daySlotsConfig[day] = defaultDaySlotNumbers(); });
}

function saveDaySlotsConfig() {
    localStorage.setItem(daySlotsKey(), JSON.stringify(daySlotsConfig));
}

// נקודת הגישה היחידה למספרי המשבצות של יום - "מטפטפת" תמיד את משבצות הבסיס
// (1 עד defaultHours.length) לתוך daySlotsConfig[day], גם אם מה ששמור שם
// חסר חלק מהן (מחיקה ידנית בעבר, נתונים ישנים משלב עם אורך ברירת מחדל אחר
// וכו') - כך שהרשת הבסיסית לעולם לא "נעלמת" מיום ספציפי. שורות נוספות
// (הוספה ידנית/AI) תמיד נשמרות, רק מתמזגות עם הבסיס ולא מוחלפות בו
function getDaySlotNumbers(day) {
    const baseline = defaultDaySlotNumbers();
    const stored = daySlotsConfig[day];
    const merged = stored === undefined
        ? baseline
        : Array.from(new Set([...baseline, ...stored])).sort((a, b) => a - b);
    daySlotsConfig[day] = merged;
    return merged;
}

async function removeDaySlot(day, slot) {
    getDaySlotNumbers(day);
    daySlotsConfig[day] = daySlotsConfig[day].filter(n => n !== slot);
    saveDaySlotsConfig();

    // הסרה ממוקדת של השורה הספציפית בלבד עם קריסה חלקה, במקום פירוק ובנייה
    // מחדש של כל לוח השבוע - זה גם מהיר יותר וגם לא גורם להבהוב של שורות אחרות.
    const slotEl = document.querySelector(`.slot-input-group[data-day="${day}"][data-slot="${slot}"]`);
    if (slotEl) {
        // מכריחים reflow לפני הוספת המחלקה, כדי שהדפדפן יתפוס את זה כ-transition
        // אמיתי ולא "יקפוץ" ישר למצב הסופי בלי שום אנימציה (ואז transitionend לא נורה כלל)
        void slotEl.offsetHeight;
        slotEl.classList.add('slot-removing');
        const removeNow = () => {
            if (slotEl.isConnected) slotEl.remove();
            updateEmptyDayState(day);
        };
        slotEl.addEventListener('transitionend', removeNow, { once: true });
        setTimeout(removeNow, 350); // רשת ביטחון מוחלטת: השורה תוסר גם אם שום transition לא נורה
    }

    await supabaseClient.from('weekly_schedule').delete().eq('user_id', currentUserId).eq('day_of_week', day).eq('slot_number', slot);
}

// אחרי שנשלפה שורה אחרונה ביום מסוים, מחביאים את .slots-grid הריק (במקום
// שיישאר תיבה כהה ריקה שנתקעת על המסך) ומציגים רמז ידידותי במקומו.
function updateEmptyDayState(day) {
    const pageDiv = document.getElementById(`daypage-${day}`);
    if (!pageDiv) return;
    const grid = pageDiv.querySelector('.slots-grid');
    const emptyHint = pageDiv.querySelector('.day-page-empty');
    if (!grid || !emptyHint) return;
    const isEmpty = grid.children.length === 0;
    grid.classList.toggle('hidden', isEmpty);
    emptyHint.classList.toggle('hidden', !isEmpty);
    // אם זה היום המוצג כרגע, המכל צריך לקרוס/לגדול מיד, לא רק בהחלפת יום
    const activeTab = document.querySelector('.day-tab.active');
    if (activeTab && activeTab.id === `daytab-${day}`) updateActiveDayPageHeight(pageDiv);
}

async function addDaySlot(day) {
    const nums = getDaySlotNumbers(day);
    const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
    daySlotsConfig[day] = [...nums, nextNum];
    saveDaySlotsConfig();
    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();
    // בלי שעה עדיין, אז המיון הכרונולוגי מוריד אותה לסוף הרשימה - בלי איתות
    // חזותי ברור זה בקלות "נעלם" מתחת לגלילה והלחיצה נראית כאילו לא עשתה כלום
    highlightNewDaySlot(day, nextNum);
}

function highlightNewDaySlot(day, slotNum) {
    const slotEl = document.querySelector(`.slot-input-group[data-day="${day}"][data-slot="${slotNum}"]`);
    if (!slotEl) return;
    slotEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    slotEl.classList.add('just-added');
    setTimeout(() => slotEl.classList.remove('just-added'), 1500);
    const taskInput = slotEl.querySelector('.slot-task');
    if (taskInput) taskInput.focus();
}

// --- מוקד ה-AI ("המוח"): מודל אחד עם שני טאבים - תכנון לו"ז מטקסט חופשי
// (פרימיום בלבד), וסריקת תמונה למתכון/ארוחה קבועה (יש לה מכסה חינמית משלה,
// אז אין שער פרימיום גורף על פתיחת המודל - כל פעולה שוערת בנפרד בזמן האמת) ---
function openAiBrainModal(tab = 'schedule') {
    document.getElementById('ai-schedule-input').value = '';
    switchAiBrainTab(tab);
    openModal('modal-ai-brain');
}

function switchAiBrainTab(tab) {
    document.querySelectorAll('.ai-brain-tab').forEach(btn => btn.classList.toggle('active', btn.getAttribute('data-tab') === tab));
    document.querySelectorAll('.ai-brain-panel').forEach(panel => panel.classList.toggle('hidden', panel.getAttribute('data-ai-brain-panel') !== tab));
}

function showScheduleAiLoading() {
    const el = document.getElementById('schedule-ai-loading');
    if (el) el.classList.remove('hidden');
}

function hideScheduleAiLoading() {
    const el = document.getElementById('schedule-ai-loading');
    if (el) el.classList.add('hidden');
}

// --- מנתח חוקי-דטרמיניסטי ללו"ז מטקסט חופשי (בלי LLM, אותו רעיון בדיוק כמו
// parseRecipeText הקיים למתכונים) - נפילה רכה כשקריאת ה-AI האמיתי בענן
// (Edge Function) נכשלת/לא זמינה. שולף רק ימים/שעות שכתובים בפועל בטקסט -
// לא מנחש ולא ממציא תוכן. הפלט באותה צורה בדיוק כמו אירועי ה-AI האמיתי
// ({day_of_week, time, task_title}), כדי לעבור דרך אותו applyParsedScheduleEvents ---
const HEBREW_DAY_TOKENS = [
    { index: 0, words: ['ראשון'] },
    { index: 1, words: ['שני'] },
    { index: 2, words: ['שלישי'] },
    { index: 3, words: ['רביעי'] },
    { index: 4, words: ['חמישי'] },
    { index: 5, words: ['שישי'] },
    { index: 6, words: ['שבת'] },
];
const ENGLISH_DAY_TOKENS = [
    { index: 0, re: /\bsun(day)?s?\b/i },
    { index: 1, re: /\bmon(day)?s?\b/i },
    { index: 2, re: /\btue(s|sday)?s?\b/i },
    { index: 3, re: /\bwed(nesday)?s?\b/i },
    { index: 4, re: /\bthu(rs|rsday)?s?\b/i },
    { index: 5, re: /\bfri(day)?s?\b/i },
    { index: 6, re: /\bsat(urday)?s?\b/i },
];
const SCHEDULE_NOISE_WORDS = [
    'בימי', 'בימים', 'ביום', 'יום', 'ימי', 'בשעה', 'בשעות', 'שעה', 'בבוקר', 'בערב',
    'בצהריים', 'בלילה', 'אחר הצהריים', 'אחה"צ', 'כל', 'תמיד', 'קבוע', 'עד',
    'and', 'at', 'on', 'in', 'every', 'until'
];
// ביטויי פתיחה נפוצים שאנשים מקלידים כשהם מתארים לו"ז בחופשיות, אבל הם לא
// חלק משם הפעילות עצמה - מוסרים כביטוי שלם, מהארוך לקצר (כדי לא להשאיר
// שאריות כמו "ת ל" אם רק "הולכת" הוסר בלי ה-"ל" שאחריה)
const SCHEDULE_FILLER_PHRASES = [
    'אני הולך ל', 'אני הולכת ל', 'אני נוסע ל', 'אני נוסעת ל',
    'הולך ל', 'הולכת ל', 'נוסע ל', 'נוסעת ל',
    'יש לי', 'אני',
];
// נרמול קל מפועל לשם-עצם לאותה פעילות בדיוק ("מתאמנת" ו"אימון" הם אותו דבר,
// רק צורת דיבור שונה) - לא ממציא מידע חדש, רק מחליף מילה קיימת במקבילה שלה
const SCHEDULE_VERB_TO_NOUN = [
    [/מתאמנ(ת|ים|ות)?/g, 'אימון'],
];

function findScheduleDaysInText(text) {
    const found = [];
    HEBREW_DAY_TOKENS.forEach(({ index, words }) => {
        words.forEach(w => { if (text.includes(w) && !found.includes(index)) found.push(index); });
    });
    ENGLISH_DAY_TOKENS.forEach(({ index, re }) => { if (re.test(text) && !found.includes(index)) found.push(index); });
    return found;
}

// כל תבניות השעה האפשריות, מהספציפית לכללית (ה"ב" המחברת בעברית לפני מספר
// היא תמיד אופציונלית בכל תבנית - "20 בערב" ו"ב20 בערב" הן אותה כוונה) -
// אותה רשימה משמשת גם לזיהוי השעה (findAllScheduleTimeMatches, globalRegExp)
// וגם למחיקתה מהכותרת (cleanScheduleTaskTitle), כדי ששתי הפעולות לעולם לא
// יתפצלו זו מזו כמו שקרה בעבר. סדר הרשימה הוא סדר עדיפות: תבנית ספציפית
// יותר (כמו "20 בערב") "תופסת" קודם תבנית כללית יותר שחופפת לה ("ב20")
// "עד" (עד/until) בלי שעת התחלה נלווית היא דו-משמעית - במקום לנחש שעת
// התחלה, מתויגת בקידומת מיוחדת כדי ש-parseScheduleTextLocally ינתב אותה
// לתור השאלות-הבהרה (ר' runScheduleClarificationFlow) במקום ליצור אירוע ישר.
// חייבת לבוא ראשונה ברשימה (עדיפות עליונה) כדי לתפוס את כל "עד 14:00" כיחידה
// אחת, לפני שהתבנית הכללית של שעה סתמית תספיק לתפוס רק את ה-14:00 בפני עצמו
const SCHEDULE_NEEDS_CLARIFY_PREFIX = 'NEEDS_CLARIFY:';
// שעה "עמומה": מספר בודד 1-11 בלי הקשר בוקר/ערב ובלי פורמט HH:MM מפורש -
// יכולה להיות גם וגם, אז לא מנחשים (ר' resolveAmbiguousHour). שעה שנכתבה
// במפורש כ-HH:MM (עם נקודתיים) או ערך מעל 12 היא חד-משמעית מעצם הכתיבה שלה
// ולעולם לא עוברת דרך התבנית הזאת, אז אף פעם לא נשאלת
const SCHEDULE_NEEDS_AMPM_PREFIX = 'NEEDS_AMPM:';
function resolveAmbiguousHour(h) {
    return (h >= 1 && h <= 11) ? `${SCHEDULE_NEEDS_AMPM_PREFIX}${h}` : `${String(h).padStart(2, '0')}:00`;
}
const SCHEDULE_TIME_PATTERNS = [
    { re: /(?:עד|until)\s*(\d{1,2}):?(\d{2})?/gi, resolve: (m) => `${SCHEDULE_NEEDS_CLARIFY_PREFIX}${m[1].padStart(2, '0')}:${m[2] || '00'}` },
    { re: /(\d{1,2}):(\d{2})/g, resolve: (m) => `${m[1].padStart(2, '0')}:${m[2]}` },
    // AM/PM מפורש ("10am", "10 PM", "10:30pm") - חד-משמעי מעצם הכתיבה שלו,
    // בדיוק כמו HH:MM, אז אף פעם לא עובר דרך שאלת ההבהרה. חייב לבוא *לפני*
    // התבנית העמומה "at N" למטה, כדי ש"at 10pm" ייתפס כאן במלואו ולא רק כ-"at 10"
    { re: /\b(\d{1,2})(?::(\d{2}))?\s*([ap])\.?m\.?\b/gi, resolve: (m) => { let h = parseInt(m[1]) % 12; if (m[3].toLowerCase() === 'p') h += 12; return `${String(h).padStart(2, '0')}:${m[2] || '00'}`; } },
    { re: /ב?-?\s*(\d{1,2})\s*(בערב|בלילה)/g, resolve: (m) => { let h = parseInt(m[1]); if (h <= 11) h += 12; return `${String(h).padStart(2, '0')}:00`; } },
    { re: /ב?-?\s*(\d{1,2})\s*(אחר הצהריים|אחה"צ|בצהריים)/g, resolve: (m) => { let h = parseInt(m[1]); if (h > 0 && h <= 6) h += 12; return `${String(h).padStart(2, '0')}:00`; } },
    { re: /ב?-?\s*(\d{1,2})\s*בבוקר/g, resolve: (m) => `${m[1].padStart(2, '0')}:00` },
    { re: /ב(?:שעה)?-?\s*(\d{1,2})\b/g, resolve: (m) => resolveAmbiguousHour(parseInt(m[1])) },
    { re: /\bat\s+(\d{1,2})\b/gi, resolve: (m) => resolveAmbiguousHour(parseInt(m[1])) },
    // מספר בודד לגמרי חשוף, בלי שום מילת הקשר (לא "ב"/"at"/":"/"am"/"pm") -
    // עדיפות הכי נמוכה (אחרונה ברשימה), כדי שכל תבנית ספציפית יותר "תזכה"
    // תמיד קודם. עדיין עובר דרך resolveAmbiguousHour - "22" חד-משמעי (מעל 11)
    // ומתפרש ישירות, ואילו "10" עמום ומפעיל את שאלת ההבהרה
    { re: /\b(\d{1,2})\b/g, resolve: (m) => resolveAmbiguousHour(parseInt(m[1])) },
];

// מוצאת את כל אזכורי השעה בטקסט (לא רק הראשון), כדי לתמוך במשפט שמתאר כמה
// אירועים ברצף עם שעות שונות ("היפ הופ ב20 בערב ובבוקר עבודה ב9"). עוברת
// על התבניות לפי סדר העדיפות שלהן ומסמנת טווחי תווים שכבר "נתפסו" - תבנית
// כללית יותר שמנסה לתפוס טווח שכבר שייך לתבנית ספציפית יותר פשוט מדלגת עליו
function findAllScheduleTimeMatches(text) {
    const claimed = [];
    const found = [];
    SCHEDULE_TIME_PATTERNS.forEach(({ re, resolve }) => {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text))) {
            const start = m.index, end = start + m[0].length;
            if (!claimed.some(([cs, ce]) => start < ce && end > cs)) {
                claimed.push([start, end]);
                found.push({ start, end, time: resolve(m) });
            }
            if (m[0].length === 0) re.lastIndex++; // מונע לולאה אינסופית בהתאמה ריקה
        }
    });
    found.sort((a, b) => a.start - b.start);
    return found;
}

function stripScheduleTimePatterns(text) {
    let cleaned = text;
    SCHEDULE_TIME_PATTERNS.forEach(({ re }) => {
        re.lastIndex = 0;
        cleaned = cleaned.replace(re, ' ');
    });
    return cleaned;
}

// מילות יחס/חיבור בודדות שיכולות "להיוותר" כטוקן שלם בפני עצמו בכל מקום
// במשפט (לא רק בסוף) אחרי שהמילה שהן התחברו אליה (יום/שעה) הוסרה - למשל
// "ובחמישי" -> אחרי הסרת "חמישי" נשאר "וב" מחובר, ואחרי הסרת קידומת ה-"ו"
// (למעלה) נשארת "ב" בודדת; או "לשיעור" -> "ל" נשארת אחרי שהוסרנו "שיעור"
// דרך תבנית אחרת. שם פעילות אמיתי לעולם לא מורכב מטוקן של אות-יחס בודדת,
// אז בטוח להסיר את כולן בכל מקום שהן מופיעות כטוקן שלם (לא בתוך מילה אחרת)
const SCHEDULE_STANDALONE_PREPOSITIONS = new Set(['ו', 'ב', 'ל', 'מ', 'עם']);

// שעת ברירת מחדל למשפט/קטע שיש בו יום מזוהה אבל אין בו שום אזכור שעה - לא
// "ממציאים" שעה שהמשתמש התכוון אליה, פשוט נותנים לאירוע ערך ניתן-למיון
// ולעריכה במקום להשאיר אותו תקוע בלי שעה בכלל (המשתמש תמיד יכול לשנות אותה)
const SCHEDULE_DEFAULT_TIME = '09:00';

function cleanScheduleTaskTitle(text, dayWords, timeStr) {
    let cleaned = text;
    // "ו" (וגם) מתחברת ישירות למילה שאחריה בעברית בלי רווח - "ומתאמנת",
    // "וב18" - כשהיא יושבת ממש בתחילת הקטע (תמיד שריד חיבור מהקטע/הפסוקית
    // הקודמים, למשל אחרי פיצול על פסיק: "X, ומתאמנת Y"), מסירים אותה כאן
    // כקידומת - לפני שהיא מתערבבת לתוך "אימון"/"ב18" ונשארת תקועה שם
    cleaned = cleaned.replace(/^\s*ו(?=[א-ת])/, ' ');
    dayWords.forEach(w => { cleaned = cleaned.split(w).join(' '); });
    if (timeStr) cleaned = stripScheduleTimePatterns(cleaned);
    SCHEDULE_FILLER_PHRASES.forEach(w => { cleaned = cleaned.split(w).join(' '); });
    SCHEDULE_NOISE_WORDS.forEach(w => { cleaned = cleaned.split(w).join(' '); });
    SCHEDULE_VERB_TO_NOUN.forEach(([re, rep]) => { cleaned = cleaned.replace(re, rep); });
    // מסירים פסיקים/נקודות, ואת מילות היחס/חיבור הבודדות (ו/ב/ל/מ/עם) רק
    // כשהן נשארו כטוקן שלם בפני עצמו (למשל אחרי שהוסר יום/שעה שהיו מחוברים
    // אליהן, כמו "ורביעי" -> "ו" בודדת, או "ובחמישי" -> "ב" בודדת) - חשוב:
    // לא כ-regex גורף שמוחק את האותיות האלה בתוך מילים אחרות, כי זה בדיוק
    // מה ששיבש "בויילר"/"הולכת"/"הופ" לאותיות מפוזרות בעבר
    let tokens = cleaned.replace(/[,.]+/g, ' ')
        .split(/\s+/)
        .filter(tok => tok && !SCHEDULE_STANDALONE_PREPOSITIONS.has(tok));
    cleaned = tokens.join(' ').trim();
    // חשוב: לא נופלים חזרה ל-text.trim() כשהניקוי מרוקן הכול - קטע שכולו
    // שעה בלי שום מילת פעילות ("ב12", " וב14") צריך להחזיר מחרוזת ריקה כדי
    // שהקוראת (parseScheduleTextLocally) תדע לרשת את הכותרת מהקטע הקודם
    // באותו משפט, במקום להציג את הטקסט הגולמי הלא-מנוקה כאילו הוא הכותרת
    return cleaned;
}

function pushScheduleEvents(events, dayIndexes, fallbackText, title, time) {
    if (dayIndexes.length) {
        dayIndexes.forEach(idx => events.push({ day_of_week: dbDaysMap[idx], time, task_title: title }));
    } else {
        // אין יום מזוהה בבירור - לא מוותרים ולא מציגים שגיאה: מוסיפים כמשימה
        // להיום עם הטקסט המקורי, בדיוק כפי שנכתב
        events.push({ day_of_week: dbDaysMap[new Date().getDay()], time, task_title: fallbackText });
    }
}

// אירוע עם שאלת-הבהרה ממתינה (בין אם "X עד Y" בלי שעת התחלה, ובין אם שעה
// עמומה 1-11 בלי בוקר/ערב) - לא מנחשים, מסמנים needsClarification ומחכים
// לשאול את המשתמש בפועל (runScheduleClarificationFlow). detail הוא
// {kind:'until', endTime} או {kind:'ampm', hour}.
// day_of_week הוא תמיד *מערך* (גם כשיש רק יום אחד) - חשוב: אזכור עמום יחיד
// שחל על כמה ימים ("שני ורביעי ב3") הוא עדיין שאלת-הבהרה *אחת* בעיני
// המשתמש, לא אחת לכל יום - אחרת השאלה הייתה נשאלת פעמיים על אותה כוונה
// בדיוק (בדיוק הבאג "השאלה נשאלת פעמיים" שדווח)
function pushClarificationEvents(events, dayIndexes, fallbackText, title, detail) {
    const base = { needsClarification: true, task_title: title, ...detail };
    if (dayIndexes.length) {
        events.push({ ...base, day_of_week: dayIndexes.map(idx => dbDaysMap[idx]) });
    } else {
        events.push({ ...base, day_of_week: [dbDaysMap[new Date().getDay()]], task_title: fallbackText });
    }
}

function parseScheduleTextLocally(text) {
    const clauses = text.split(/[\n,.]/).map(s => s.trim()).filter(Boolean);
    const events = [];
    (clauses.length ? clauses : [text]).forEach(clause => {
        const dayIndexes = findScheduleDaysInText(clause);
        const dayWordsFound = [];
        HEBREW_DAY_TOKENS.forEach(({ index, words }) => { if (dayIndexes.includes(index)) dayWordsFound.push(...words); });
        // מסירים את מילות היום מהמשפט לפני שמחפשים שעות/מפצלים לתת-אירועים,
        // כדי שהן לא "יתפסו" בטעות כחלק מכותרת של אחד מהם
        let body = clause;
        dayWordsFound.forEach(w => { body = body.split(w).join(' '); });

        const timeMatches = findAllScheduleTimeMatches(body);

        if (!timeMatches.length) {
            const title = cleanScheduleTaskTitle(body, [], '') || t('schedule_ai_fallback_task_label');
            pushScheduleEvents(events, dayIndexes, clause, title, SCHEDULE_DEFAULT_TIME);
            return;
        }

        // מפצלים לתת-קטע אחד לכל שעה שנמצאה - כל תת-קטע הוא הטקסט מסוף השעה
        // הקודמת (או מתחילת הקטע, לראשונה) ועד סוף השעה הנוכחית, כך שהפעילות
        // נשארת צמודה לשעה הקרובה אליה במשפט המקורי ("היפ הופ ב20 בערב
        // ובבוקר עבודה ב9" -> שני אירועים נפרדים, לא אחד מעורבב). כשכמה שעות
        // מתארות את אותה פעילות בלי שהיא חוזרת בכתב לפני כל שעה ("עבודה ב9
        // ב12 וב14") - הקטעים שבין שעה לשעה מתנקים לגמרי (אין בהם עוד מילות
        // פעילות), אז יורשים את הכותרת מהקטע הקודם במקום נופלים לתווית סתמית -
        // כך שהתוצאה היא שלוש שורות "עבודה" נפרדות, לא טווח אחד מאוחד
        let cursor = 0;
        let lastTitle = '';
        timeMatches.forEach(tm => {
            const segment = body.slice(cursor, tm.end);
            let title = cleanScheduleTaskTitle(segment, [], tm.time);
            if (title) lastTitle = title;
            else title = lastTitle || t('schedule_ai_fallback_task_label');

            if (tm.time.startsWith(SCHEDULE_NEEDS_CLARIFY_PREFIX)) {
                pushClarificationEvents(events, dayIndexes, clause, title, { kind: 'until', endTime: tm.time.slice(SCHEDULE_NEEDS_CLARIFY_PREFIX.length) });
            } else if (tm.time.startsWith(SCHEDULE_NEEDS_AMPM_PREFIX)) {
                pushClarificationEvents(events, dayIndexes, clause, title, { kind: 'ampm', hour: tm.time.slice(SCHEDULE_NEEDS_AMPM_PREFIX.length) });
            } else {
                pushScheduleEvents(events, dayIndexes, clause, title, tm.time);
            }
            cursor = tm.end;
        });
    });
    return events;
}

// מקבצת את האירועים (מה-AI האמיתי או מהמנתח המקומי - אותה צורה בדיוק) לפי
// יום, כדי להקצות משבצת פנויה (או שורה חדשה) לכל אחד בלי שיתנגשו על אותה משבצת
async function applyParsedScheduleEvents(events) {
    const byDay = {};
    events.forEach(ev => {
        if (!dbDaysMap.includes(ev.day_of_week)) return;
        if (!byDay[ev.day_of_week]) byDay[ev.day_of_week] = [];
        byDay[ev.day_of_week].push(ev);
    });

    Object.keys(byDay).forEach(day => {
        getDaySlotNumbers(day);
        const daySlotEls = Array.from(document.querySelectorAll(`.slot-input-group[data-day="${day}"]`));
        const usedSlotNums = new Set();
        byDay[day].forEach(ev => {
            const isFreeSlot = (el) => !usedSlotNums.has(parseInt(el.getAttribute('data-slot'))) && !el.querySelector('.slot-task').value.trim();
            // עדיפות ראשונה: שורת ברירת מחדל ריקה שכבר יש לה בדיוק את השעה
            // המבוקשת - כדי לא ליצור שורה כפולה לאותה שעה כשכבר יש שורה ריקה
            // איתה (למשל שורת ברירת מחדל #2 שכבר מוצגת כ-09:00)
            let target = daySlotEls.find(el => isFreeSlot(el) && el.querySelector('.slot-time').value.trim() === ev.time);
            if (!target) target = daySlotEls.find(isFreeSlot);
            if (target) {
                ev._slotNum = parseInt(target.getAttribute('data-slot'));
                usedSlotNums.add(ev._slotNum);
            } else {
                const nums = daySlotsConfig[day];
                const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
                daySlotsConfig[day] = [...nums, nextNum];
                ev._slotNum = nextNum;
                usedSlotNums.add(nextNum);
            }
        });
    });
    saveDaySlotsConfig();
    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();

    for (const day of Object.keys(byDay)) {
        for (const ev of byDay[day]) {
            const slotEl = document.querySelector(`.slot-input-group[data-day="${day}"][data-slot="${ev._slotNum}"]`);
            if (!slotEl) continue;
            slotEl.querySelector('.slot-time').value = ev.time || '';
            const taskInput = slotEl.querySelector('.slot-task');
            taskInput.value = ev.task_title;
            updateSlotTaskIcon(taskInput);
            await saveScheduleSlot(day, ev._slotNum);
        }
    }
}

async function parseScheduleWithAI() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    const input = document.getElementById('ai-schedule-input');
    const text = input.value.trim();
    if (!text) { showAppToast(t('schedule_ai_empty'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }

    const loadingTimer = setTimeout(showScheduleAiLoading, 5000);
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;

        let events = null;
        if (token) {
            try {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-schedule-request`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ text })
                });
                const result = await res.json();
                if (res.status === 402 || result.error === 'premium_required') { openPremiumUpgradeModal(); return; }
                if (res.ok && !result.error && result.events && result.events.length) events = result.events;
            } catch (err) {
                // הענן לא זמין (רשת/שרת) - ממשיכים בשקט למנתח המקומי למטה, לא מציגים שגיאה
            }
        }

        // אם ה-AI האמיתי בענן לא זמין/לא החזיר כלום, נופלים בעדינות למנתח
        // המקומי - המשתמש תמיד מקבל תוצאה, אף פעם לא מסך שגיאה
        if (!events || !events.length) events = parseScheduleTextLocally(text);

        // "X עד Y" בלי שעת התחלה: לא מנחשים - שואלים את המשתמש בפועל (אחד
        // אחרי השני אם יש כמה), ורק אז שומרים הכול יחד עם שאר האירועים הברורים
        const clearEvents = events.filter(ev => !ev.needsClarification);
        const ambiguousEvents = events.filter(ev => ev.needsClarification);

        input.value = '';
        closeModal('modal-ai-brain');

        if (ambiguousEvents.length) {
            runScheduleClarificationFlow(ambiguousEvents, clearEvents);
        } else {
            await applyParsedScheduleEvents(clearEvents);
            showAppToast(t('schedule_ai_success'));
        }
    } finally {
        clearTimeout(loadingTimer);
        hideScheduleAiLoading();
    }
}

// --- שאלת הבהרה כשיש שעת סיום בלי שעת התחלה ("עבודה עד 14:00") - שואלים
// במקום לנחש, שאלה אחת בכל פעם אם יש כמה, ורק אחרי שכולן נענו (או דולגו)
// מוחלים כל האירועים (הברורים + אלה שהוברהרו) יחד בפעם אחת ---
let scheduleClarificationQueue = [];
let scheduleClarificationResolved = [];
let scheduleClarificationClearEvents = [];

function runScheduleClarificationFlow(ambiguousEvents, clearEvents) {
    // מנקה callback ידני ממתין (ר' openManualAmpmClarify) שאולי ננטש בלי
    // תשובה - תור ה-AI תמיד גובר על שאלה ידנית-חד-פעמית ישנה שנשכחה
    pendingManualAmpmResolve = null;
    scheduleClarificationQueue = ambiguousEvents;
    scheduleClarificationResolved = [];
    scheduleClarificationClearEvents = clearEvents;
    showNextScheduleClarification();
}

// מציגה את שאלת ההבהרה הבאה בתור - אחת משני סוגים: "kind:'until'" (שעת
// התחלה חסרה, קלט טקסט חופשי) או "kind:'ampm'" (שעה עמומה 1-11, שתי כפתורי
// בחירה בוקר/ערב) - כל תור מציג רק את הפקדים הרלוונטיים לסוג שלו
function showNextScheduleClarification() {
    if (!scheduleClarificationQueue.length) { finishScheduleClarificationFlow(); return; }
    const ev = scheduleClarificationQueue[0];
    const inputEl = document.getElementById('schedule-clarify-input');
    const untilActions = document.getElementById('schedule-clarify-until-actions');
    const ampmActions = document.getElementById('schedule-clarify-ampm-actions');
    if (ev.kind === 'ampm') {
        document.getElementById('schedule-clarify-question').textContent =
            t('schedule_clarify_ampm_question_template').replace('{title}', ev.task_title).replace('{hour}', ev.hour);
        inputEl.classList.add('hidden');
        untilActions.classList.add('hidden');
        ampmActions.classList.remove('hidden');
    } else {
        document.getElementById('schedule-clarify-question').textContent =
            t('schedule_clarify_question_template').replace('{title}', ev.task_title).replace('{end}', ev.endTime);
        inputEl.value = '';
        inputEl.classList.remove('hidden');
        untilActions.classList.remove('hidden');
        ampmActions.classList.add('hidden');
    }
    openModal('modal-schedule-clarify');
}

// מפענחת תשובה חופשית כמו "מ-8", "8:00", או סתם "9" לשעת התחלה - לא בררנית
// לגבי הקידומת (מ/מ-/בשעה...), כי כל המספר שהמשתמש הקליד כאן נועד להיות שעה
function parseStartTimeAnswer(text) {
    let m = text.match(/(\d{1,2}):(\d{2})/);
    if (m) return `${m[1].padStart(2, '0')}:${m[2]}`;
    m = text.match(/(\d{1,2})/);
    if (m) return `${m[1].padStart(2, '0')}:00`;
    return null;
}

// "X עד Y" עם תשובה: לא בונים טווח מקווקו ("09:00-14:00") - במקום זאת שתי
// שורות נפרדות, שעת ההתחלה ושעת הסיום, כל אחת עם אותה כותרת בדיוק (בהתאם
// לבקשה המפורשת "no time ranges... כל שעה כרשומה נפרדת")
function confirmScheduleClarification() {
    const ev = scheduleClarificationQueue.shift();
    if (!ev) return;
    const answer = document.getElementById('schedule-clarify-input').value.trim();
    const startTime = parseStartTimeAnswer(answer);
    // ev.day_of_week הוא תמיד מערך - שאלה אחת נענית פעם אחת ומוחלת על כל
    // הימים שהאזכור העמום חל עליהם ("שני ורביעי ב3" -> תשובה אחת, שתי שורות)
    ev.day_of_week.forEach(day => {
        if (startTime) scheduleClarificationResolved.push({ day_of_week: day, time: startTime, task_title: ev.task_title });
        scheduleClarificationResolved.push({ day_of_week: day, time: ev.endTime, task_title: ev.task_title });
    });
    closeModal('modal-schedule-clarify');
    showNextScheduleClarification();
}

function skipScheduleClarification() {
    const ev = scheduleClarificationQueue.shift();
    if (!ev) return;
    // המשתמש דילג - לא ממציאים שעת התחלה, פשוט משתמשים בשעת הסיום שכן צוינה
    ev.day_of_week.forEach(day => {
        scheduleClarificationResolved.push({ day_of_week: day, time: ev.endTime, task_title: ev.task_title });
    });
    closeModal('modal-schedule-clarify');
    showNextScheduleClarification();
}

// שעה עמומה (1-11) עם תשובת בוקר/ערב - h<=11 מקבל +12 רק אם המשתמש בחר
// "ערב" (בוקר משאיר את השעה כפי שהיא, למשל 5 -> 05:00)
function resolveAmpmClarification(period) {
    // עריכה ידנית חד-פעמית (ר' openManualAmpmClarify) גוברת על תור ה-AI -
    // אותו חלון/כפתורים משמשים את שני הזרמים, אז בודקים קודם אם יש callback
    // ידני ממתין לפני שנוגעים בתור
    if (pendingManualAmpmResolve) {
        const resolve = pendingManualAmpmResolve;
        pendingManualAmpmResolve = null;
        closeModal('modal-schedule-clarify');
        resolve(period);
        return;
    }
    const ev = scheduleClarificationQueue.shift();
    if (!ev) return;
    let h = parseInt(ev.hour);
    if (period === 'evening' && h <= 11) h += 12;
    const time = `${String(h).padStart(2, '0')}:00`;
    ev.day_of_week.forEach(day => {
        scheduleClarificationResolved.push({ day_of_week: day, time, task_title: ev.task_title });
    });
    closeModal('modal-schedule-clarify');
    showNextScheduleClarification();
}

async function finishScheduleClarificationFlow() {
    const allEvents = [...scheduleClarificationClearEvents, ...scheduleClarificationResolved];
    scheduleClarificationClearEvents = [];
    scheduleClarificationResolved = [];
    if (!allEvents.length) return;
    await applyParsedScheduleEvents(allEvents);
    showAppToast(t('schedule_ai_success'));
}

function loadCustomDefaultHours() {
    const raw = localStorage.getItem(defaultHoursKey());
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) defaultHours = parsed;
    } catch {}
}

// --- מודל שעות ברירת המחדל הפך לגמרי דינמי: לא עוד 5 שדות קבועים, אלא
// טיוטת עבודה (hoursSettingsDraft) שמשתנה בלייב בעריכת ערך/הוספת שורה/מחיקת
// שורה בתוך המודל, ורק "שמירת ברירת המחדל" מיישמת אותה בפועל ---
let hoursSettingsDraft = [];

function openHoursSettingsModal() {
    hoursSettingsDraft = [...defaultHours];
    renderHoursSettingsRows();
    openModal('modal-settings-hours');
}

function renderHoursSettingsRows() {
    const grid = document.getElementById('hours-settings-grid');
    if (!grid) return;
    grid.innerHTML = '';
    hoursSettingsDraft.forEach((val, idx) => {
        const row = document.createElement('div');
        row.className = 'hours-settings-row';
        row.innerHTML = `
            <input type="text" class="hours-input" data-index="${idx}" value="${val || ''}" placeholder="#${idx + 1}">
            <button type="button" class="btn-delete-slot" onclick="removeHoursSettingsRow(${idx})" title="${t('schedule_remove_row_title')}">❌</button>
        `;
        grid.appendChild(row);
    });
}

// לפני כל שינוי מבני (הוספה/הסרה) שגורם ל-renderHoursSettingsRows לבנות
// מחדש את כל שדות הקלט מהטיוטה - קודם קולטים בחזרה מה שהמשתמש כבר הקליד
// בפועל, אחרת עריכה בשדה אחד + מחיקת שורה אחרת הייתה מוחקת את מה שהוקלד
function syncHoursSettingsDraftFromDom() {
    const inputs = document.querySelectorAll('#hours-settings-grid .hours-input');
    hoursSettingsDraft = Array.from(inputs).map(inp => inp.value);
}

function addHoursSettingsRow() {
    syncHoursSettingsDraftFromDom();
    hoursSettingsDraft.push('');
    renderHoursSettingsRows();
}

function removeHoursSettingsRow(idx) {
    syncHoursSettingsDraftFromDom();
    hoursSettingsDraft.splice(idx, 1);
    renderHoursSettingsRows();
}

async function saveDefaultHours() {
    const inputs = document.querySelectorAll('#hours-settings-grid .hours-input');
    const newHours = Array.from(inputs).map(inp => inp.value.trim()).filter(Boolean);
    if (!newHours.length) { showAppToast(t('hours_empty_error'), 'error'); return; }
    defaultHours = newHours;
    localStorage.setItem(defaultHoursKey(), JSON.stringify(newHours));
    closeModal('modal-settings-hours');
    // מסנכרנים את כל הימים לרשת הבסיס החדשה: משבצת ריקה שנשארה ממספר ברירת
    // מחדל ישן וגדול יותר (ולא חלק מהבסיס החדש) מוסרת, כדי שלא תישאר "שורת
    // רפאים" - לפני buildWeeklyScheduleAccordionUI, כי הפונקציה הזאת בודקת
    // את תוכן ה-DOM הקיים (.slot-task value) כדי להחליט מה עדיין ריק
    await pruneDaySlotsAboveThreshold(defaultHours.length);
    // אורך רשת הבסיס (defaultDaySlotNumbers) נגזר עכשיו ישירות מ-defaultHours.length,
    // אז בנייה מחדש כאן ממלאת מיד לכל יום את משבצות הבסיס החדשות (getDaySlotNumbers)
    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();
    showAppToast(t('item_added_success'));
}

function buildWeeklyScheduleAccordionUI() {
    const container = document.getElementById('accordion-container');
    const tabsStrip = document.getElementById('day-tabs-strip');
    if (!container) return;
    // שומרים איזה יום היה פעיל *לפני* הפירוק-והבנייה-מחדש, כדי לשחזר אותו
    // בסוף - אחרת כל קריאה לפונקציה הזאת (כמו לחיצה על "+ הוספת שורה" באמצע
    // הצפייה ביום חמישי) הייתה "מקפיצה" את המשתמש בחזרה ליום ראשון בטעות,
    // מה שנראה כאילו הכפתור לא עשה כלום (השורה כן נוספה, פשוט למסך שהמשתמש
    // כבר לא רואה)
    const previousActiveTab = document.querySelector('.day-tab.active');
    // כשאין יום פעיל קודם (טעינה ראשונה של המסך, לא בנייה-מחדש תוך כדי צפייה) -
    // ברירת המחדל היא היום *הנוכחי* לפי לוח השנה, לא תמיד יום ראשון
    const activeDay = previousActiveTab ? previousActiveTab.id.replace('daytab-', '') : dbDaysMap[new Date().getDay()];

    loadDaySlotsConfig();
    container.innerHTML = '';
    if (tabsStrip) tabsStrip.innerHTML = '';
    dbDaysMap.forEach((dbDay, dayIndex) => {
        const dayName = getDayName(dayIndex);
        const dateStr = getFormattedDateForDay(dayIndex);

        if (tabsStrip) {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'day-tab' + (dbDay === activeDay ? ' active' : '');
            tab.id = `daytab-${dbDay}`;
            tab.innerHTML = `<span class="day-tab-name">${dayName}</span><span class="day-tab-date">${dateStr}</span>`;
            tab.onclick = () => scrollToDay(dbDay);
            tabsStrip.appendChild(tab);
        }

        const pageDiv = document.createElement('div');
        pageDiv.className = 'day-page';
        pageDiv.id = `daypage-${dbDay}`;
        pageDiv.setAttribute('data-day', dbDay);
        let slotsHTML = '';
        // getDaySlotNumbers תמיד מטפטפת את משבצות הבסיס פנימה, גם אם הן חסרות
        // ב-daySlotsConfig השמור (מחיקה ידנית בעבר, אורך ברירת מחדל ישן וכו') -
        // הרשת הבסיסית לעולם לא "נעלמת" מיום, לפי הבקשה המפורשת
        const slotNumbers = getDaySlotNumbers(dbDay);
        slotNumbers.forEach(i => {
            slotsHTML += `<div class="slot-input-group" data-day="${dbDay}" data-slot="${i}"><div class="slot-time-wrap"><span class="slot-drag-handle" title="${t('schedule_drag_handle_title')}">⠿</span><input type="text" value="${defaultHours[i-1] || ''}" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})"></div><div class="slot-task-wrap"><span class="slot-task-icon"></span><input type="text" class="slot-task" onchange="saveScheduleSlot('${dbDay}', ${i})" oninput="updateSlotTaskIcon(this)"></div><button class="btn-delete-slot" onclick="removeDaySlot('${dbDay}', ${i})" title="${t('schedule_remove_row_title')}">❌</button></div>`;
        });
        const gridHiddenClass = slotNumbers.length ? '' : ' hidden';
        pageDiv.innerHTML = `<div class="day-page-header">${dateStr} | ${dayName}</div><div class="slots-grid${gridHiddenClass}">${slotsHTML}</div><div class="day-page-empty${slotNumbers.length ? ' hidden' : ''}">${t('schedule_day_empty_hint')}</div><button type="button" class="btn-add-day-slot" onclick="addDaySlot('${dbDay}')">➕ ${t('schedule_add_row_btn')}</button>`;
        container.appendChild(pageDiv);
    });
    setupDayScrollObserver();
    dbDaysMap.forEach(dbDay => initScheduleRowDragReorder(dbDay));

    // משחזרים מיידית (בלי אנימציה - זו לא ניווט ביוזמת המשתמש, רק שחזור
    // המצב אחרי בנייה מחדש) את מיקום הגלילה ליום שהיה פעיל
    const activePage = document.getElementById(`daypage-${activeDay}`);
    if (activePage) {
        const containerRect = container.getBoundingClientRect();
        const pageRect = activePage.getBoundingClientRect();
        container.scrollLeft += pageRect.left - containerRect.left;
    }
}

function scrollToDay(dbDay) {
    // בכוונה לא scrollIntoView: זה "מטפס" בכל שרשרת ה-ancestors וגולל כל מכל
    // גלילה שהוא מוצא בדרך, לא רק את מכל הימים. כאן גוללים ידנית ורק את
    // מכל הימים עצמו, כדי שהקלקה על יום לעולם לא תזיז שום דבר אחר בעמוד.
    const container = document.getElementById('accordion-container');
    const page = document.getElementById(`daypage-${dbDay}`);
    if (!container || !page) return;
    const containerRect = container.getBoundingClientRect();
    const pageRect = page.getBoundingClientRect();
    const delta = pageRect.left - containerRect.left;
    // קפיצה מיידית ולא הדרגתית: כל אנימציה שמזיזה scrollLeft בהדרגה על פני
    // המכל הזה (בין אם smooth מובנה של הדפדפן ובין אם אנימציה ידנית) "עוברת"
    // חזותית דרך כל הימים שביניים בדרך אל היעד - בדיוק התחושה של "מדלג יום
    // אחרי יום" שהמשתמש תיאר. קפיצה ישירה ל-scrollLeft הסופי מציגה את היום
    // שנבחר מיד, בלי לעבור דרך הימים שבדרך.
    container.scrollLeft += delta;
}

let dayScrollObserver = null;
function setupDayScrollObserver() {
    const container = document.getElementById('accordion-container');
    if (!container) return;
    if (dayScrollObserver) dayScrollObserver.disconnect();
    dayScrollObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
                const day = entry.target.getAttribute('data-day');
                document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
                const tab = document.getElementById(`daytab-${day}`);
                if (tab) tab.classList.add('active');
                updateActiveDayPageHeight(entry.target);
            }
        });
    }, { root: container, threshold: [0.5] });
    document.querySelectorAll('.day-page').forEach(page => dayScrollObserver.observe(page));
    // גם היום שמוצג ראשון עם הבנייה (לפני שהמשתמש גולל בכלל) צריך גובה נכון מיד
    updateActiveDayPageHeight();
}

// הבעיה השורשית: כל 7 עמודי הימים קיימים בו-זמנית ב-DOM בתור אחים בפריסת flex
// (כדי לאפשר גלילה אופקית ביניהם), כך שגובה המכל תמיד נקבע לפי היום *הגבוה
// ביותר* מביניהם - זה מובנה בפריסת flex/block הרגילה ולא ניתן לתקן רק ב-CSS.
// לכן קובעים כאן גובה מפורש ב-JS שעוקב אחרי היום הפעיל בפועל בלבד, ומתעדכן
// בכל מעבר בין ימים ובכל הוספה/הסרה של שורה באותו יום.
function updateActiveDayPageHeight(activePageEl) {
    const container = document.getElementById('accordion-container');
    if (!container) return;
    let pageDiv = activePageEl;
    if (!pageDiv) {
        const activeTab = document.querySelector('.day-tab.active');
        const dbDay = activeTab ? activeTab.id.replace('daytab-', '') : dbDaysMap[new Date().getDay()];
        pageDiv = document.getElementById(`daypage-${dbDay}`);
    }
    if (!pageDiv) return;
    container.style.height = `${pageDiv.scrollHeight}px`;
}

function toggleCardSection(headerEl) {
    const card = headerEl.closest('.card');
    if (card) card.classList.toggle('expanded');
}

async function loadWeeklySchedule() {
    if (!supabaseClient) return;
    document.querySelectorAll('.slot-input-group').forEach(slotEl => {
        const slotNum = parseInt(slotEl.getAttribute('data-slot'));
        slotEl.querySelector('.slot-time').value = defaultHours[slotNum - 1] || '';
        slotEl.querySelector('.slot-task').value = '';
    });
    const { data } = await supabaseClient.from('weekly_schedule').select('*').eq('user_id', currentUserId);
    if (data) {
        data.forEach(item => {
            const slotEl = document.querySelector(`[data-day="${item.day_of_week}"][data-slot="${item.slot_number}"]`);
            if (slotEl) { slotEl.querySelector('.slot-time').value = item.time_of_day; slotEl.querySelector('.slot-task').value = item.task_title || ''; }
        });
    }
    // הערה: pruneEmptyExcessSlots בכוונה *לא* נקראת כאן יותר - היא רצה פעם
    // אחת בלבד בטעינת האפליקציה (ר' initAppAfterAuth), לא בכל loadWeeklySchedule.
    // הבעיה: loadWeeklySchedule נקראת גם מ-addDaySlot מיד אחרי הוספת שורה
    // ריקה חדשה ביוזמת המשתמש - אם הפינוי היה רץ כאן, הוא היה מוחק את השורה
    // הריקה החדשה הזאת מיד (מספרה מעל ברירת המחדל + אין בה עדיין טקסט),
    // מה שגרם ל"+ הוספת שורה" להיראות כאילו הוא לא עושה כלום
    sortAllDaySlotsChronologically();
    updateAllSlotTaskIcons();
}

// --- אייקון אוטומטי לפי מילות מפתח בכותרת המשימה - קישוט חזותי בלבד, לעולם
// לא נשמר כחלק מ-task_title עצמו (ה-DB/הערך של .slot-task נשארים טקסט נקי) ---
function getScheduleTaskIcon(taskText) {
    const text = (taskText || '').trim();
    if (!text) return '';
    const lower = text.toLowerCase();
    if (/עבודה|work/.test(lower)) return '💼';
    if (/אימון|מכון כושר|כושר|gym|workout|training/.test(lower)) return '🏋️‍♀️';
    if (/היפ הופ|ריקוד|dance|hip.?hop/.test(lower)) return '💃';
    if (/בויילר|בוילר|מסיבה|party|boiler/.test(lower)) return '🎶';
    return '⚡';
}

// מעדכנת את האייקון + מחלקת ה-"פיל" הניאונית של שורה בודדת - נקראת גם
// בלייב תוך כדי הקלדה (oninput על .slot-task) וגם אחרי מילוי פרוגרמטי של
// ערכים (טעינה מה-DB/AI), כי שינוי .value ב-JS לא מפעיל oninput מעצמו
function updateSlotTaskIcon(taskInput) {
    const wrap = taskInput.closest('.slot-task-wrap');
    const iconEl = wrap && wrap.querySelector('.slot-task-icon');
    if (iconEl) iconEl.textContent = getScheduleTaskIcon(taskInput.value);
    const group = taskInput.closest('.slot-input-group');
    if (group) group.classList.toggle('has-task', !!taskInput.value.trim());
}

function updateAllSlotTaskIcons() {
    document.querySelectorAll('.slot-task').forEach(updateSlotTaskIcon);
}

// --- נירמול קלט שעה גולמי (הקלדה ידנית בשדה .slot-time/add-slot-time) ---
// לעולם לא שולחים ערך גולמי-לא-מפורמט ("8" בודד) ל-Supabase - זה בדיוק מה
// שגרם ל"8" להישמר כמו שהוא בטבלת weekly_schedule ולשגיאת RLS/פורמט בהוספה.
// מחזירה { time, needsAmpm, hour }: time הוא מחרוזת HH:MM תקינה, '' (השדה
// ריק בכוונה) או null (קלט לא-תקין לגמרי, לא נשמר). needsAmpm=true אומר
// שהמספר עמום (1-11) בהקשר אנגלית/12 שעות ויש לשאול בוקר/ערב לפני שמירה -
// בעברית/ערבית (הקשר 24 שעות) 1-11 תמיד מתפרש ישירות כבוקר, בלי לשאול
function normalizeScheduleTimeInput(raw) {
    const text = (raw || '').trim();
    if (!text) return { time: '', needsAmpm: false };
    let m = text.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
        const hh = parseInt(m[1]), mm = parseInt(m[2]);
        if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return { time: `${String(hh).padStart(2, '0')}:${m[2]}`, needsAmpm: false };
        return { time: null, needsAmpm: false };
    }
    m = text.match(/^(\d{1,2})\s*([ap])\.?m\.?$/i);
    if (m) {
        let h = parseInt(m[1]);
        if (h < 1 || h > 12) return { time: null, needsAmpm: false };
        h = h % 12;
        if (m[2].toLowerCase() === 'p') h += 12;
        return { time: `${String(h).padStart(2, '0')}:00`, needsAmpm: false };
    }
    m = text.match(/^(\d{1,2})$/);
    if (m) {
        const h = parseInt(m[1]);
        if (h < 0 || h > 23) return { time: null, needsAmpm: false };
        if (isRTL(currentLang)) return { time: `${String(h).padStart(2, '0')}:00`, needsAmpm: false };
        if (h >= 1 && h <= 11) return { time: '', needsAmpm: true, hour: h };
        return { time: `${String(h).padStart(2, '0')}:00`, needsAmpm: false };
    }
    return { time: null, needsAmpm: false };
}

// פותחת את אותו חלון-הבהרה בוקר/ערב (modal-schedule-clarify) שה-AI Brain
// כבר משתמש בו, אבל עבור עריכה ידנית חד-פעמית של שדה שעה בודד - לא דרך
// תור ה-AI (scheduleClarificationQueue). onResolve נקרא עם 'morning'/'evening'
// שהמשתמש בחר; resolveAmpmClarification (למטה) מנתב לכאן במקום לתור כשיש
// callback ממתין
let pendingManualAmpmResolve = null;
function openManualAmpmClarify(hour, title, onResolve) {
    pendingManualAmpmResolve = onResolve;
    document.getElementById('schedule-clarify-question').textContent =
        t('schedule_clarify_ampm_question_template').replace('{title}', title || t('schedule_ai_fallback_task_label')).replace('{hour}', hour);
    document.getElementById('schedule-clarify-input').classList.add('hidden');
    document.getElementById('schedule-clarify-until-actions').classList.add('hidden');
    document.getElementById('schedule-clarify-ampm-actions').classList.remove('hidden');
    openModal('modal-schedule-clarify');
}

// --- מיון כרונולוגי של שורות הלו"ז: מספר השורה (data-slot) הוא רק מזהה יציב
// לשמירה/מחיקה מול השרת, לא סדר תצוגה - שורה #1 יכולה להכיל 19:00 ושורה #2
// 09:00 (למשל אחרי שה-AI מוסיף אירועים למשבצות פנויות לפי הסדר שבו הן נמצאו,
// לא לפי השעה). ממיינים מחדש את סדר ה-DOM בפועל לפי השעה בכל טעינה/שמירה,
// בלי לגעת ב-data-slot עצמו - כך שכל הקריאה/שמירה/מחיקה הקיימת ממשיכה לעבוד ---
function scheduleTimeToMinutes(timeStr) {
    const m = (timeStr || '').trim().match(/^(\d{1,2}):(\d{2})/);
    if (!m) return null;
    return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function sortDaySlotsChronologically(day) {
    const page = document.getElementById(`daypage-${day}`);
    const grid = page && page.querySelector('.slots-grid');
    if (!grid) return;
    const slotEls = Array.from(grid.querySelectorAll('.slot-input-group'));
    slotEls.sort((a, b) => {
        const minA = scheduleTimeToMinutes(a.querySelector('.slot-time').value);
        const minB = scheduleTimeToMinutes(b.querySelector('.slot-time').value);
        if (minA === null && minB === null) return 0;
        if (minA === null) return 1; // שורות בלי שעה יורדות לסוף
        if (minB === null) return -1;
        return minA - minB;
    });
    // appendChild על אלמנט שכבר ב-DOM מזיז אותו למקום החדש בלי לשכפל/ליצור
    // מחדש - השדות עצמם (עם ה-focus/הערכים שלהם) נשארים אותם אלמנטים בדיוק
    slotEls.forEach(el => grid.appendChild(el));
}

function sortAllDaySlotsChronologically() {
    dbDaysMap.forEach(day => sortDaySlotsChronologically(day));
}

// --- גרירה להעברת שורה שלמה (שעה+משימה יחד) בין משבצות קבועות באותו יום ---
// משתמשים ב-SortableJS (ר' תג ה-script ב-index.html) במקום מאזיני מגע
// ידניים - הספרייה בנויה וזה שנים בשימוש נרחב בדיוק בשביל הבעיה שדווחה
// (גרירה שמתנגשת עם גלילת דף טבעית במובייל).
//
// חשוב: לא נותנים ל-SortableJS "לנצח" ולקבוע את סדר ה-DOM בפועל, כי כל שורה
// כאן היא משבצת-DB קבועה (data-slot, עם onchange/onclick שכבר מוטבעים עם
// מספר המשבצת שלהם ב-HTML). ב-onEnd קוראים את הסדר *החדש* שהמשתמש גרר אליו
// (זמן+משימה כיחידה אחת - בדיוק כמו גרירת פריט שלם ברשימה רגילה), משחזרים
// מיד את סדר ה-DOM לפי data-slot (כדי שה-onchange/onclick המוטבעים ימשיכו
// להצביע נכון), ומחלקים את התוכן-בסדר-החדש בחזרה על פני המשבצות הקבועות.
// saveScheduleSlot נקרא כאן עם skipSort=true בכוונה: הסדר החדש הוא *בדיוק*
// מה שהמשתמש רצה בגרירה ידנית, ולא רוצים שהמיון הכרונולוגי האוטומטי (שרץ
// אחרי שמירות רגילות) "יתקן" אותו בחזרה מיד - זה בדיוק מה שגרם לתחושת
// "השורה קופצת בחזרה למקום המקורי" שדווחה.
function initScheduleRowDragReorder(dbDay) {
    const page = document.getElementById(`daypage-${dbDay}`);
    const grid = page && page.querySelector('.slots-grid');
    if (!grid || typeof Sortable === 'undefined') return;

    new Sortable(grid, {
        handle: '.slot-drag-handle',
        animation: 150,
        // forceFallback: עוקף לגמרי את ה-HTML5 Drag and Drop הטבעי של הדפדפן
        // (וה"רוח" השקופה שהוא מצייר בעצמו ברמת המערכת) ומחליף אותו בסימולציה
        // מבוססת מגע/עכבר שנשלטת כולה על ידי SortableJS - כך שאפשר להשתיק
        // לגמרי את השכפול הצף (.sortable-fallback) ב-CSS, כפי שהתבקש
        forceFallback: true,
        fallbackOnBody: false,
        dragoverBubble: false,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: function (evt) {
            if (evt.oldIndex === evt.newIndex) return;
            const rowsInNewOrder = Array.from(grid.children).filter(el => el.classList.contains('slot-input-group'));
            const contentInNewOrder = rowsInNewOrder.map(r => ({
                time: r.querySelector('.slot-time').value,
                task: r.querySelector('.slot-task').value
            }));

            // משחזרים את סדר ה-DOM המקורי לפי מספר המשבצת הקבוע - *לפני* שכותבים
            // ערכים חדשים, כדי שלא יהיה רגע-ביניים שבו סדר ה-DOM וה-onchange
            // המוטבע לא תואמים
            const rowsBySlot = rowsInNewOrder.slice().sort((a, b) => Number(a.getAttribute('data-slot')) - Number(b.getAttribute('data-slot')));
            rowsBySlot.forEach(r => grid.appendChild(r));

            // ומחלקים את הסדר-החדש (מה שהמשתמש גרר, שעה+משימה יחד) בחזרה על
            // פני המשבצות הקבועות - נשמר מיידית לכל משבצת, בלי לחכות לכלום
            rowsBySlot.forEach((row, i) => {
                const timeInput = row.querySelector('.slot-time');
                const taskInput = row.querySelector('.slot-task');
                timeInput.value = contentInNewOrder[i].time;
                taskInput.value = contentInNewOrder[i].task;
                updateSlotTaskIcon(taskInput);
                row.classList.toggle('has-task', !!taskInput.value.trim());
                saveScheduleSlot(dbDay, row.getAttribute('data-slot'), true);
            });
        }
    });
}

// מסירה מכל הימים כל משבצת שמספרה גדול מ-thresholdCount (כלומר לא חלק
// מרשת הבסיס הנוכחית) ושאין בה שום טקסט משימה - מה-DOM, מה-config המקומי
// וגם מהשרת. משבצת עודפת שהמשתמש כן מילא בה תוכן אמיתי לעולם לא נמחקת.
// נקראת רק משתי נקודות מכוונות ומפורשות (לא בכל טעינה רגילה, כדי לא "לתפוס"
// שורה ריקה שהמשתמש הרגע הוסיף ביודעין): טעינת האפליקציה (ניקוי שאריות
// ישנות מול הבסיס הנוכחי) ושמירת ברירת מחדל חדשה בהגדרות (סנכרון כל הימים
// לרשת הבסיס החדשה - "phantom rows" משעות ברירת מחדל שהוסרו נעלמות)
async function pruneDaySlotsAboveThreshold(thresholdCount) {
    if (!supabaseClient || !currentUserId) return;
    let anyPruned = false;
    for (const day of dbDaysMap) {
        const nums = getDaySlotNumbers(day);
        const staleNums = [];
        const keepNums = nums.filter(n => {
            if (n <= thresholdCount) return true;
            const slotEl = document.querySelector(`.slot-input-group[data-day="${day}"][data-slot="${n}"]`);
            const hasTask = slotEl && slotEl.querySelector('.slot-task').value.trim();
            if (hasTask) return true;
            staleNums.push(n);
            return false;
        });
        if (!staleNums.length) continue;
        anyPruned = true;
        daySlotsConfig[day] = keepNums;
        staleNums.forEach(n => {
            const slotEl = document.querySelector(`.slot-input-group[data-day="${day}"][data-slot="${n}"]`);
            if (slotEl) slotEl.remove();
        });
        updateEmptyDayState(day);
        for (const n of staleNums) {
            await supabaseClient.from('weekly_schedule').delete().eq('user_id', currentUserId).eq('day_of_week', day).eq('slot_number', n);
        }
    }
    if (anyPruned) saveDaySlotsConfig();
}

async function pruneEmptyExcessSlots() {
    await pruneDaySlotsAboveThreshold(defaultDaySlotNumbers().length);
}

// skipSort: המיון הכרונולוגי האוטומטי (בסוף) קיים כדי לסדר שורות אחרי עריכה
// רגילה של שדה שעה/משימה - אבל אחרי גרירה ידנית (ר' initScheduleRowDragReorder)
// הסדר החדש הוא בדיוק הכוונה של המשתמש, ולא רוצים שהמיון "יתקן" אותו בחזרה
// מיד, מה שהיה נראה כאילו הגרירה בכלל לא עבדה
async function saveScheduleSlot(day, slot, skipSort) {
    if (!supabaseClient) return;
    const slotEl = document.querySelector(`[data-day="${day}"][data-slot="${slot}"]`);
    const timeInput = slotEl.querySelector('.slot-time');
    const taskInput = slotEl.querySelector('.slot-task');
    // לעולם לא שולחים את ה-.value הגולמי כמו שהוא ל-Supabase - מנרמלים
    // קודם לפורמט HH:MM תקין (ר' normalizeScheduleTimeInput). אם השעה עמומה
    // (1-11 בהקשר אנגלית/12 שעות) שואלים בוקר/ערב *לפני* כל כתיבה לשרת,
    // במקום לשמור ערך גולמי לא-תקין כמו "8" בודד
    const norm = normalizeScheduleTimeInput(timeInput.value);
    if (norm.needsAmpm) {
        openManualAmpmClarify(norm.hour, taskInput.value.trim(), (period) => {
            let h = norm.hour;
            if (period === 'evening' && h <= 11) h += 12;
            timeInput.value = `${String(h).padStart(2, '0')}:00`;
            saveScheduleSlot(day, slot, skipSort);
        });
        return;
    }
    if (norm.time === null) { showAppToast(t('schedule_invalid_time_error'), 'error'); return; }
    timeInput.value = norm.time;
    const timeVal = norm.time;
    const taskVal = taskInput.value.trim();
    const { data: existing } = await supabaseClient.from('weekly_schedule').select('id').eq('user_id', currentUserId).eq('day_of_week', day).eq('slot_number', slot).maybeSingle();
    let error;
    if (existing) ({ error } = await supabaseClient.from('weekly_schedule').update({ time_of_day: timeVal, task_title: taskVal }).eq('id', existing.id));
    else ({ error } = await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, user_id: currentUserId, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal }));
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    // ה-onchange שקרא לפונקציה הזו כבר ירה רק כש-focus עזב את השדה (blur), אז
    // מיון מחדש של סדר השורות כאן לא יפריע להקלדה פעילה של המשתמש
    if (!skipSort) sortDaySlotsChronologically(day);
    if (day === dbDaysMap[new Date().getDay()]) loadTodayTasks();
}

// --- מבט ליומן: אירועים ארוכי-טווח בעלי תאריך אמיתי, נפרד מהתבנית השבועית החוזרת ---
function formatEventDateBadge(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${day}.${month}`;
}

function toggleRecurringOptionsVisibility() {
    const checkbox = document.getElementById('calendar-event-recurring-checkbox');
    const optionsWrap = document.getElementById('calendar-event-recurring-options');
    optionsWrap.classList.toggle('hidden', !checkbox.checked);
}

function toggleCustomRecurrenceVisibility() {
    const typeSelect = document.getElementById('calendar-event-recurrence-type');
    const customWrap = document.getElementById('calendar-event-custom-recurrence');
    customWrap.classList.toggle('hidden', typeSelect.value !== 'custom');
}

// --- משימות להיום: תמצית מהירה של השורות המאוכלסות בלו"ז השבועי (התבנית
// החוזרת) עבור יום-השבוע הנוכחי בלבד - כדי לראות מה מתוכנן היום בלי לצאת
// ממבט הבית וללחוץ על לשונית "השבוע שלי". שאילתה עצמאית (לא תלויה ב-DOM
// של loadWeeklySchedule), כי שתי הפונקציות רצות במקביל ב-Promise.all בטעינה
async function loadTodayTasks() {
    if (!supabaseClient || !currentUserId) return;
    const container = document.getElementById('today-tasks-list');
    if (!container) return;
    const todayDbDay = dbDaysMap[new Date().getDay()];
    const { data, error } = await supabaseClient.from('weekly_schedule').select('*').eq('user_id', currentUserId).eq('day_of_week', todayDbDay);
    if (error || !data) return;
    const populated = data
        .filter(item => (item.task_title || '').trim())
        .sort((a, b) => {
            const ma = scheduleTimeToMinutes(a.time_of_day), mb = scheduleTimeToMinutes(b.time_of_day);
            if (ma === null && mb === null) return 0;
            if (ma === null) return 1;
            if (mb === null) return -1;
            return ma - mb;
        });
    container.innerHTML = '';
    if (!populated.length) {
        container.innerHTML = `<p class="today-tasks-empty">${t('today_tasks_empty_hint')}</p>`;
        return;
    }
    populated.forEach(item => {
        const row = document.createElement('div');
        row.className = 'today-tasks-row';
        row.innerHTML = `<span class="today-tasks-time">${item.time_of_day || ''}</span><span class="today-tasks-text">${getScheduleTaskIcon(item.task_title)} ${item.task_title}</span>`;
        container.appendChild(row);
    });
}

// --- לוח חודשי: אותו מקור נתונים בדיוק כמו "מבט ליומן" (calendar_events),
// רק בתצוגת רשת-חודש עם נקודה על כל יום שיש בו משהו, במקום רשימה ליניארית -
// לא נתונים חדשים, רק ויזואליזציה נוספת. שימוש חוזר ב-shiftMonthKey/
// formatMonthLabel/currentMonthKey שכבר קיימים עבור יעד חודשי ---
let viewedCalendarMonthKey = null;
let selectedCalendarDay = null;

async function loadMonthlyCalendarGrid() {
    if (!supabaseClient || !currentUserId) return;
    const grid = document.getElementById('monthly-calendar-grid');
    const label = document.getElementById('monthly-calendar-label');
    if (!grid || !label) return;
    if (!viewedCalendarMonthKey) viewedCalendarMonthKey = currentMonthKey();
    label.textContent = formatMonthLabel(viewedCalendarMonthKey);

    const [y, m] = viewedCalendarMonthKey.split('-').map(Number);
    const firstDate = new Date(y, m - 1, 1);
    const lastDate = new Date(y, m, 0);
    const firstStr = getLocalDateString(firstDate);
    const lastStr = getLocalDateString(lastDate);
    const { data } = await supabaseClient.from('calendar_events').select('event_date').eq('user_id', currentUserId).gte('event_date', firstStr).lte('event_date', lastStr);
    const markedDates = new Set((data || []).map(r => r.event_date));

    const todayStr = getLocalDateString();
    const startWeekday = firstDate.getDay();
    const daysInMonth = lastDate.getDate();

    let html = '';
    for (let i = 0; i < startWeekday; i++) html += `<div class="monthly-calendar-cell empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedCalendarDay;
        const hasEvents = markedDates.has(dateStr);
        html += `<button type="button" class="monthly-calendar-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" data-date="${dateStr}" onclick="selectCalendarDay('${dateStr}')">
            <span class="monthly-calendar-day-num">${day}</span>
            ${hasEvents ? '<span class="monthly-calendar-dot"></span>' : ''}
        </button>`;
    }
    grid.innerHTML = html;

    if (selectedCalendarDay && (selectedCalendarDay < firstStr || selectedCalendarDay > lastStr)) {
        selectedCalendarDay = null;
        document.getElementById('monthly-calendar-day-detail').innerHTML = '';
    } else if (selectedCalendarDay) {
        await renderSelectedCalendarDay();
    }
}

async function navigateMonthlyCalendar(delta) {
    const base = viewedCalendarMonthKey || currentMonthKey();
    viewedCalendarMonthKey = shiftMonthKey(base, delta);
    selectedCalendarDay = null;
    const detail = document.getElementById('monthly-calendar-day-detail');
    if (detail) detail.innerHTML = '';
    await loadMonthlyCalendarGrid();
}

async function selectCalendarDay(dateStr) {
    selectedCalendarDay = dateStr;
    document.querySelectorAll('.monthly-calendar-cell').forEach(cell => cell.classList.remove('selected'));
    const cell = document.querySelector(`.monthly-calendar-cell[data-date="${dateStr}"]`);
    if (cell) cell.classList.add('selected');
    await renderSelectedCalendarDay();
}

async function renderSelectedCalendarDay() {
    const detail = document.getElementById('monthly-calendar-day-detail');
    if (!detail || !selectedCalendarDay) return;
    const { data } = await supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).eq('event_date', selectedCalendarDay).order('sort_order', { ascending: true });
    const [y, m, d] = selectedCalendarDay.split('-').map(Number);
    const dayLabel = new Date(y, m - 1, d).toLocaleDateString(currentLang, { weekday: 'long', day: 'numeric', month: 'long' });
    if (!data || !data.length) {
        detail.innerHTML = `<div class="monthly-calendar-day-title">${dayLabel}</div><p class="today-tasks-empty">${t('today_tasks_empty_hint')}</p>`;
        return;
    }
    const rows = data.map(item => `<div class="today-tasks-row"><span class="today-tasks-text">${item.event_title}</span></div>`).join('');
    detail.innerHTML = `<div class="monthly-calendar-day-title">${dayLabel}</div>${rows}`;
}

async function loadCalendarEvents() {
    if (!supabaseClient) return;
    const container = document.getElementById('calendar-glance-list');
    if (!container) return;
    const today = getLocalDateString();
    const { data, error } = await supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).gte('event_date', today);
    container.innerHTML = '';
    if (error || !data || !data.length) {
        const empty = document.createElement('div');
        empty.className = 'calendar-glance-empty';
        empty.textContent = t('calendar_glance_empty');
        container.appendChild(empty);
        return;
    }

    // מקבצים אירועים חוזרים לפי recurrence_group_id, כדי להציג פריט אחד לכל סדרה
    // (עם חץ להרחבה) במקום שורה נפרדת לכל תאריך שנוצר
    const seriesMap = new Map();
    const singleEvents = [];
    data.forEach(item => {
        if (item.recurrence_group_id) {
            if (!seriesMap.has(item.recurrence_group_id)) seriesMap.set(item.recurrence_group_id, []);
            seriesMap.get(item.recurrence_group_id).push(item);
        } else {
            singleEvents.push(item);
        }
    });

    // סדר תצוגה: sort_order ידני (שנקבע ע"י גרירה) קודם, ורק לפריטים שעדיין
    // אין להם אחד (Infinity) נופלים חזרה למיון לפי תאריך - כך אפשר לשים משימות
    // חשובות למעלה בלי קשר לתאריך/שעה שלהן.
    const displayEntries = [];
    singleEvents.forEach(item => displayEntries.push({
        sortOrder: typeof item.sort_order === 'number' ? item.sort_order : Infinity,
        sortDate: item.event_date,
        render: () => buildSingleEventRow(item)
    }));
    seriesMap.forEach((items, groupId) => {
        items.sort((a, b) => a.event_date.localeCompare(b.event_date));
        displayEntries.push({
            sortOrder: typeof items[0].sort_order === 'number' ? items[0].sort_order : Infinity,
            sortDate: items[0].event_date,
            render: () => buildRecurringEventRow(items, groupId)
        });
    });
    displayEntries.sort((a, b) => (a.sortOrder !== b.sortOrder ? a.sortOrder - b.sortOrder : a.sortDate.localeCompare(b.sortDate)));
    displayEntries.forEach(entry => container.appendChild(entry.render()));
    initCalendarDragReorder();
}

function buildSingleEventRow(item) {
    const row = document.createElement('div');
    row.className = 'calendar-event-item';
    row.setAttribute('data-reorder-id', item.id);
    row.setAttribute('data-reorder-type', 'single');
    const handle = document.createElement('span');
    handle.className = 'calendar-event-drag-handle';
    handle.textContent = '⠿';
    handle.title = t('calendar_event_drag_handle_title');
    const dateBadge = document.createElement('span');
    dateBadge.className = 'calendar-event-date-badge';
    dateBadge.textContent = formatEventDateBadge(item.event_date);
    const titleSpan = document.createElement('span');
    titleSpan.className = 'calendar-event-title-text';
    titleSpan.textContent = item.event_title;
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-item';
    deleteBtn.textContent = '❌';
    deleteBtn.onclick = () => deleteCalendarEvent(item.id);
    row.appendChild(handle);
    row.appendChild(dateBadge);
    row.appendChild(titleSpan);
    row.appendChild(deleteBtn);
    return row;
}

function buildRecurringEventRow(items, groupId) {
    const wrap = document.createElement('div');
    wrap.className = 'calendar-event-series';
    wrap.setAttribute('data-reorder-id', groupId);
    wrap.setAttribute('data-reorder-type', 'series');

    const header = document.createElement('div');
    header.className = 'calendar-event-item calendar-event-series-header';

    const handle = document.createElement('span');
    handle.className = 'calendar-event-drag-handle';
    handle.textContent = '⠿';
    handle.title = t('calendar_event_drag_handle_title');

    const dateBadge = document.createElement('span');
    dateBadge.className = 'calendar-event-date-badge';
    dateBadge.textContent = formatEventDateBadge(items[0].event_date);

    const titleSpan = document.createElement('span');
    titleSpan.className = 'calendar-event-title-text';
    const lastDate = formatEventDateBadge(items[items.length - 1].event_date);
    titleSpan.textContent = `${items[0].event_title} · ${t('calendar_event_recurring_until')} ${lastDate}`;

    // מונה התקדמות: כמה מהמופעים שנוצרו כבר סומנו כהושלמו מתוך הסך הכול -
    // התכלית ("Target Count") היא פשוט מספר התאריכים שנוצרו לסדרה הזו
    const completedCount = items.filter(i => i.is_completed).length;
    const progressBadge = document.createElement('span');
    progressBadge.className = 'calendar-event-progress-badge';
    progressBadge.textContent = `${completedCount}/${items.length}`;
    progressBadge.title = t('calendar_event_progress_title');

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'calendar-event-series-toggle';
    toggleBtn.textContent = '▼';
    toggleBtn.title = t('calendar_event_show_dates_title');

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-item';
    deleteBtn.textContent = '❌';
    deleteBtn.onclick = () => deleteRecurringSeries(groupId);

    header.appendChild(handle);
    header.appendChild(dateBadge);
    header.appendChild(titleSpan);
    header.appendChild(progressBadge);
    header.appendChild(toggleBtn);
    header.appendChild(deleteBtn);

    const datesList = document.createElement('div');
    datesList.className = 'calendar-event-series-dates hidden';
    items.forEach(occurrence => {
        const line = document.createElement('label');
        line.className = 'calendar-event-series-date-line' + (occurrence.is_completed ? ' completed' : '');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = !!occurrence.is_completed;
        checkbox.onchange = () => toggleEventOccurrenceCompletion(occurrence.id, checkbox.checked);
        const dateLabel = document.createElement('span');
        dateLabel.textContent = formatEventDateBadge(occurrence.event_date);
        line.appendChild(checkbox);
        line.appendChild(dateLabel);
        datesList.appendChild(line);
    });

    toggleBtn.onclick = () => {
        const willShow = datesList.classList.contains('hidden');
        datesList.classList.toggle('hidden', !willShow);
        toggleBtn.textContent = willShow ? '▲' : '▼';
    };

    wrap.appendChild(header);
    wrap.appendChild(datesList);
    return wrap;
}

async function toggleEventOccurrenceCompletion(id, isCompleted) {
    await supabaseClient.from('calendar_events').update({ is_completed: isCompleted }).eq('id', id);
    loadCalendarEvents();
}

// --- גרירה לסידור ידני-עצמאי (עדיפות) של פריטי מבט ליומן, בלי קשר לתאריך ---
// גורר לפי ⠿: מזיז את הפריט חזותית עם המצביע, ומחליף מקום בפועל ב-DOM ברגע
// שמרכז הפריט הנגרר חוצה את מרכזו של שכן - כך "מי שלמעלה" הוא סדר העדיפות.
function initCalendarDragReorder() {
    const container = document.getElementById('calendar-glance-list');
    if (!container) return;

    let draggedEl = null;
    let startY = 0;

    function onMove(e) {
        if (!draggedEl) return;
        const dy = e.clientY - startY;
        draggedEl.style.transform = `translateY(${dy}px)`;

        const draggedRect = draggedEl.getBoundingClientRect();
        const draggedMid = draggedRect.top + draggedRect.height / 2;
        const siblings = Array.from(container.children).filter(el => el !== draggedEl && el.hasAttribute('data-reorder-id'));

        for (const sibling of siblings) {
            const rect = sibling.getBoundingClientRect();
            const siblingMid = rect.top + rect.height / 2;
            const draggedIsBeforeSibling = !!(draggedEl.compareDocumentPosition(sibling) & Node.DOCUMENT_POSITION_FOLLOWING);
            if (draggedIsBeforeSibling && draggedMid > siblingMid) {
                container.insertBefore(draggedEl, sibling.nextSibling);
                draggedEl.style.transform = 'translateY(0px)';
                startY = e.clientY;
                break;
            } else if (!draggedIsBeforeSibling && draggedMid < siblingMid) {
                container.insertBefore(draggedEl, sibling);
                draggedEl.style.transform = 'translateY(0px)';
                startY = e.clientY;
                break;
            }
        }
    }

    function endDrag() {
        if (!draggedEl) return;
        draggedEl.classList.remove('reordering');
        draggedEl.style.transform = '';
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', endDrag);
        document.removeEventListener('pointercancel', endDrag);
        persistCalendarOrder();
        draggedEl = null;
    }

    container.querySelectorAll('.calendar-event-drag-handle').forEach(handle => {
        handle.onpointerdown = (e) => {
            const el = handle.closest('[data-reorder-id]');
            if (!el) return;
            e.preventDefault();
            draggedEl = el;
            startY = e.clientY;
            draggedEl.classList.add('reordering');
            document.addEventListener('pointermove', onMove);
            document.addEventListener('pointerup', endDrag);
            document.addEventListener('pointercancel', endDrag);
        };
    });
}

async function persistCalendarOrder() {
    const container = document.getElementById('calendar-glance-list');
    if (!container) return;
    const children = Array.from(container.children).filter(el => el.hasAttribute('data-reorder-id'));
    const updates = children.map((el, index) => {
        const order = (index + 1) * 10;
        const type = el.getAttribute('data-reorder-type');
        const id = el.getAttribute('data-reorder-id');
        if (type === 'series') return supabaseClient.from('calendar_events').update({ sort_order: order }).eq('recurrence_group_id', id);
        return supabaseClient.from('calendar_events').update({ sort_order: order }).eq('id', id);
    });
    await Promise.all(updates);
}

// יוצר את כל תאריכי החזרה מתחילת הטווח ועד סוף מספר החודשים שנבחר, לפי סוג
// החזרה (שבועי/חודשי/כל 3 חודשים/מותאם אישית - כל X שבועות או חודשים) - זהו
// הבסיס למחוללי "משימות חוזרות" כמו שיעור גיטרה שבועי
function generateRecurringDates(startDateStr, recurrenceType, customInterval, customUnit, durationMonths) {
    const dates = [];
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);

    let stepDays = null;
    let stepMonths = null;
    if (recurrenceType === 'weekly') stepDays = 7;
    else if (recurrenceType === 'monthly') stepMonths = 1;
    else if (recurrenceType === 'quarterly') stepMonths = 3;
    else if (recurrenceType === 'custom') {
        if (customUnit === 'months') stepMonths = Math.max(1, customInterval);
        else stepDays = 7 * Math.max(1, customInterval);
    } else {
        stepDays = 7;
    }

    const current = new Date(start);
    while (current <= end) {
        dates.push(getLocalDateString(current));
        if (stepMonths) current.setMonth(current.getMonth() + stepMonths);
        else current.setDate(current.getDate() + stepDays);
    }
    return dates;
}

async function addCalendarEvent() {
    const titleInput = document.getElementById('calendar-event-title-input');
    const dateInput = document.getElementById('calendar-event-date-input');
    const recurringCheckbox = document.getElementById('calendar-event-recurring-checkbox');
    const recurrenceTypeSelect = document.getElementById('calendar-event-recurrence-type');
    const customIntervalInput = document.getElementById('calendar-event-custom-interval');
    const customUnitSelect = document.getElementById('calendar-event-custom-unit');
    const durationSelect = document.getElementById('calendar-event-duration-input');
    const title = titleInput.value.trim();
    const date = dateInput.value;
    if (!title || !date) { showAppToast(t('calendar_event_missing_fields'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }

    let rows;
    if (recurringCheckbox.checked) {
        const months = parseInt(durationSelect.value) || 3;
        const recurrenceType = recurrenceTypeSelect.value;
        const customInterval = parseInt(customIntervalInput.value) || 1;
        const customUnit = customUnitSelect.value;
        const groupId = crypto.randomUUID();
        rows = generateRecurringDates(date, recurrenceType, customInterval, customUnit, months).map(eventDate => ({
            username: currentUsername, user_id: currentUserId,
            event_title: title, event_date: eventDate, recurrence_group_id: groupId
        }));
    } else {
        rows = [{ username: currentUsername, user_id: currentUserId, event_title: title, event_date: date, recurrence_group_id: null }];
    }

    const { error } = await supabaseClient.from('calendar_events').insert(rows);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    titleInput.value = '';
    dateInput.value = '';
    recurringCheckbox.checked = false;
    toggleRecurringOptionsVisibility();
    closeModal('modal-add-calendar-event');
    showAppToast(t('item_added_success'));
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
}

async function deleteCalendarEvent(id) {
    await supabaseClient.from('calendar_events').delete().eq('id', id);
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
}

async function deleteRecurringSeries(groupId) {
    await supabaseClient.from('calendar_events').delete().eq('recurrence_group_id', groupId);
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
}

// --- המתכונים שלי: רשת קטגוריות קבועה -> רשימת מתכונים מסוננת -> תצוגת פרטים במסך מלא ---
const RECIPE_CATEGORIES = [
    { key: 'appetizers', icon: '🥟' },
    { key: 'breakfast', icon: '🍳' },
    { key: 'meat_mains', icon: '🍖' },
    { key: 'dairy_mains', icon: '🧀' },
    { key: 'sides', icon: '🥔' },
    { key: 'snacks', icon: '🍿' },
    { key: 'salads', icon: '🥗' },
    { key: 'soups', icon: '🍲' },
    { key: 'desserts', icon: '🍰' }
];

let cachedRecipes = [];
let currentRecipeCategory = null;
let currentDetailRecipeId = null;
let editingRecipeId = null;

function renderRecipeCategoriesGrid() {
    const grid = document.getElementById('recipes-categories-grid');
    if (!grid) return;
    grid.innerHTML = '';
    RECIPE_CATEGORIES.forEach(cat => {
        const count = cachedRecipes.filter(r => r.category === cat.key).length;
        const card = document.createElement('div');
        card.className = 'recipe-category-card';
        card.onclick = () => openRecipeCategory(cat.key);
        const icon = document.createElement('div');
        icon.className = 'recipe-category-icon';
        icon.textContent = cat.icon;
        const label = document.createElement('div');
        label.className = 'recipe-category-label';
        label.textContent = t(`recipe_category_${cat.key}`);
        const countEl = document.createElement('div');
        countEl.className = 'recipe-category-count';
        countEl.textContent = count;
        card.appendChild(icon);
        card.appendChild(label);
        card.appendChild(countEl);
        grid.appendChild(card);
    });
}

function renderRecipeCards(list) {
    const grid = document.getElementById('recipes-grid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!list.length) {
        const empty = document.createElement('div');
        empty.className = 'recipes-empty';
        empty.textContent = t('recipes_empty');
        grid.appendChild(empty);
        return;
    }
    list.forEach(recipe => {
        const card = document.createElement('div');
        card.className = 'recipe-card';
        card.onclick = () => openRecipeDetail(recipe.id);
        if (recipe.image_url) {
            const img = document.createElement('img');
            img.className = 'recipe-card-photo';
            img.src = recipe.image_url;
            img.alt = '';
            card.appendChild(img);
        }
        const title = document.createElement('div');
        title.className = 'recipe-card-title';
        title.textContent = recipe.title;
        const calories = document.createElement('div');
        calories.className = 'recipe-card-calories';
        calories.textContent = recipe.calories ? `${recipe.calories} ${t('calories_unit')}` : '';
        card.appendChild(title);
        card.appendChild(calories);
        grid.appendChild(card);
    });
}

function openRecipeCategory(categoryKey) {
    currentRecipeCategory = categoryKey;
    document.getElementById('recipes-list-category-title').textContent = t(`recipe_category_${categoryKey}`);
    renderRecipeCards(cachedRecipes.filter(r => r.category === categoryKey));
    document.getElementById('recipes-categories-grid').classList.add('hidden');
    document.getElementById('recipes-list-view').classList.add('open');
}

function closeRecipeCategory() {
    currentRecipeCategory = null;
    document.getElementById('recipes-list-view').classList.remove('open');
    document.getElementById('recipes-categories-grid').classList.remove('hidden');
}

async function loadRecipes() {
    if (!supabaseClient || !currentUserId) return;
    showRecipesLoading();
    const { data } = await supabaseClient.from('recipes').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
    cachedRecipes = data || [];
    renderRecipeCategoriesGrid();
    if (currentRecipeCategory) renderRecipeCards(cachedRecipes.filter(r => r.category === currentRecipeCategory));
}

function showRecipesLoading() {
    const grid = document.getElementById('recipes-categories-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const skeleton = document.createElement('div');
        skeleton.className = 'skeleton-card';
        grid.appendChild(skeleton);
    }
}

function openAddRecipeForm() {
    editingRecipeId = null;
    document.getElementById('modal-add-recipe-title').textContent = t('recipe_modal_title');
    document.getElementById('recipe-ai-raw-input').value = '';
    document.getElementById('recipe-title-input').value = '';
    document.getElementById('recipe-category-input').value = currentRecipeCategory || '';
    document.getElementById('recipe-calories-input').value = '';
    document.getElementById('recipe-ingredients-input').value = '';
    document.getElementById('recipe-instructions-input').value = '';
    setRecipeImagePreview('');
    setRecipeCaloriesEstimateHint(false);
    openModal('modal-add-recipe');
}

function openEditRecipeForm() {
    const recipe = cachedRecipes.find(r => r.id === currentDetailRecipeId);
    if (!recipe) return;
    editingRecipeId = recipe.id;
    document.getElementById('modal-add-recipe-title').textContent = t('recipe_edit_modal_title');
    document.getElementById('recipe-ai-raw-input').value = '';
    document.getElementById('recipe-title-input').value = recipe.title || '';
    document.getElementById('recipe-category-input').value = recipe.category || '';
    document.getElementById('recipe-calories-input').value = recipe.calories || '';
    document.getElementById('recipe-ingredients-input').value = recipe.ingredients || '';
    document.getElementById('recipe-instructions-input').value = recipe.instructions || '';
    setRecipeImagePreview(recipe.image_url || '');
    setRecipeCaloriesEstimateHint(false);
    openModal('modal-add-recipe');
}

// מציגה/מסתירה את אזהרת "קלוריות מוערכות" ליד שדה הקלוריות - רק כשהערך
// שם הגיע מאומדן מקומי מבוסס-מצרכים (parseRecipeText), לא ממספר מפורש
// שהופיע בטקסט המקור ולא מה-AI האמיתי בענן (שניהם עובדה, לא הערכה)
function setRecipeCaloriesEstimateHint(show) {
    const hint = document.getElementById('recipe-calories-estimate-hint');
    if (hint) hint.classList.toggle('hidden', !show);
}

async function saveRecipe() {
    const title = document.getElementById('recipe-title-input').value.trim();
    const category = document.getElementById('recipe-category-input').value;
    const calories = parseInt(document.getElementById('recipe-calories-input').value) || 0;
    const ingredients = document.getElementById('recipe-ingredients-input').value.trim();
    const instructions = document.getElementById('recipe-instructions-input').value.trim();
    const imageUrl = document.getElementById('recipe-image-url-input').value.trim();
    if (!title) { showAppToast(t('recipe_title_required'), 'error'); return; }
    if (!category) { showAppToast(t('recipe_category_required'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }

    const payload = { title, category, calories, ingredients, instructions };
    const payloadWithImage = imageUrl ? { ...payload, image_url: imageUrl } : payload;
    let error;
    if (editingRecipeId) {
        ({ error } = await supabaseClient.from('recipes').update(payloadWithImage).eq('id', editingRecipeId));
    } else {
        ({ error } = await supabaseClient.from('recipes').insert({ username: currentUsername, user_id: currentUserId, ...payloadWithImage }));
    }
    // image_url הוא עמודה חדשה ואופציונלית שדורשת הוספה חד-פעמית ב-DB - אם היא
    // עדיין לא קיימת בטבלה, שומרים את המתכון בלי התמונה במקום לחסום את כל
    // השמירה (הכי גרוע שיכול לקרות זה שהתמונה לא נשמרת, לא שהמתכון אבד)
    if (error && imageUrl) {
        if (editingRecipeId) {
            ({ error } = await supabaseClient.from('recipes').update(payload).eq('id', editingRecipeId));
        } else {
            ({ error } = await supabaseClient.from('recipes').insert({ username: currentUsername, user_id: currentUserId, ...payload }));
        }
    }
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }

    const wasEditing = !!editingRecipeId;
    const editedId = editingRecipeId;
    editingRecipeId = null;
    closeModal('modal-add-recipe');
    showAppToast(t(wasEditing ? 'recipe_updated_success' : 'item_added_success'));
    await loadRecipes();
    if (wasEditing && editedId) openRecipeDetail(editedId);
}

function openRecipeDetail(id) {
    const recipe = cachedRecipes.find(r => r.id === id);
    if (!recipe) return;
    currentDetailRecipeId = id;
    const detailPhoto = document.getElementById('recipe-detail-photo');
    if (recipe.image_url) { detailPhoto.src = recipe.image_url; detailPhoto.classList.remove('hidden'); }
    else { detailPhoto.src = ''; detailPhoto.classList.add('hidden'); }
    document.getElementById('recipe-detail-title').textContent = recipe.title;
    document.getElementById('recipe-detail-category').textContent = t(`recipe_category_${recipe.category}`);
    document.getElementById('recipe-detail-calories').textContent = recipe.calories ? `${recipe.calories} ${t('calories_unit')}` : '';

    const ingredientsList = document.getElementById('recipe-detail-ingredients');
    ingredientsList.innerHTML = '';
    const ingredientLines = (recipe.ingredients || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (ingredientLines.length) {
        ingredientLines.forEach(line => {
            const li = document.createElement('li');
            li.textContent = line;
            ingredientsList.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.className = 'recipe-detail-empty-line';
        li.textContent = t('recipe_no_ingredients');
        ingredientsList.appendChild(li);
    }

    const instructionsEl = document.getElementById('recipe-detail-instructions');
    instructionsEl.innerHTML = '';
    const instructionLines = (recipe.instructions || '').split('\n').map(s => s.trim()).filter(Boolean);
    if (instructionLines.length) {
        instructionLines.forEach(line => {
            const p = document.createElement('p');
            p.textContent = line;
            instructionsEl.appendChild(p);
        });
    } else {
        const p = document.createElement('p');
        p.className = 'recipe-detail-empty-line';
        p.textContent = t('recipe_no_instructions');
        instructionsEl.appendChild(p);
    }

    document.getElementById('recipe-detail-view').classList.add('open');
}

function closeRecipeDetail() {
    currentDetailRecipeId = null;
    document.getElementById('recipe-detail-view').classList.remove('open');
}

async function deleteRecipe() {
    if (!currentDetailRecipeId) return;
    const idToDelete = currentDetailRecipeId;
    await supabaseClient.from('recipes').delete().eq('id', idToDelete);
    closeRecipeDetail();
    showAppToast(t('recipe_deleted_success'));
    await loadRecipes();
    if (currentRecipeCategory) openRecipeCategory(currentRecipeCategory);
}

// --- פרימיום מאוחד: is_premium גלובלי חוסם/משחרר כל הגבלה בכל האפליקציה ---
// אין עדיין מעבד תשלום אמיתי מחובר (Stripe וכו') - הכפתור מציג הודעת "בקרוב"
// בלבד, בדיוק כמו כרטיסי הפרימיום הקיימים בהגדרות. הלוגיקה כאן היא ה"מנעול"
// המוכן: ברגע שיחובר תשלום אמיתי, מספיק לעדכן is_premium=true בטבלה ותכף
// הכל נפתח אוטומטית בלי לשנות עוד קוד.
let isPremiumUser = false;
let selectedPremiumTier = 'semiannual';

// עוקף בדיקת פרימיום למפתחת בלבד, כדי לאפשר בדיקה מלאה של כל התכונות - חסום
// זהה מיושם גם בצד השרת (Edge Functions), כי בדיקת לקוח בלבד ניתנת לעקיפה
const DEV_SUPERUSER_EMAILS = ['zabarieden111@gmail.com'];

async function loadPremiumStatus() {
    if (!supabaseClient || !currentUserId) return;
    if (DEV_SUPERUSER_EMAILS.includes((currentUsername || '').toLowerCase())) {
        isPremiumUser = true;
        return;
    }
    const { data } = await supabaseClient.from('user_premium').select('is_premium').eq('user_id', currentUserId).maybeSingle();
    isPremiumUser = !!(data && data.is_premium);
}

function openPremiumUpgradeModal() {
    document.querySelectorAll('.premium-tier-option').forEach(el => el.classList.remove('selected'));
    const defaultOption = document.querySelector(`.premium-tier-option[data-tier="${selectedPremiumTier}"]`);
    if (defaultOption) defaultOption.classList.add('selected');
    openModal('modal-premium-upgrade');
}

function selectPremiumTier(el) {
    selectedPremiumTier = el.getAttribute('data-tier');
    document.querySelectorAll('.premium-tier-option').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected');
}

function submitPremiumUpgrade() {
    closeModal('modal-premium-upgrade');
    showAppToast(t('settings_upgrade_toast'));
}

// --- מצב בהיר (Light Mode, חינמי): קלף .light-mode על ה-html מחליף רק את
// משתני הרקע/הטקסט (ר' theme.css) - שמור מקומית, לא תלוי במשתמש/פרימיום ---
function isLightModeOn() {
    return localStorage.getItem('weekwise_light_mode') === 'true';
}

function applyLightMode(enabled) {
    document.documentElement.classList.toggle('light-mode', enabled);
    const toggle = document.getElementById('light-mode-toggle');
    if (toggle) toggle.checked = enabled;
}

function toggleLightMode() {
    const enabled = document.getElementById('light-mode-toggle').checked;
    localStorage.setItem('weekwise_light_mode', enabled ? 'true' : 'false');
    applyLightMode(enabled);
}

// --- ערכות נושא צבע פרימיום: כל שאר ה-CSS כבר משתמש ב-var(--accent-*), אז
// זה רק עניין של להחליף את attribute ה-data-color-theme על ה-html ---
function colorThemeKey() {
    return `weekwise_color_theme_${currentUserId}`;
}

function applyColorTheme(themeName) {
    if (!themeName || themeName === 'default') document.documentElement.removeAttribute('data-color-theme');
    else document.documentElement.setAttribute('data-color-theme', themeName);
    document.querySelectorAll('.theme-swatch').forEach(el => {
        el.classList.toggle('selected', el.getAttribute('data-theme') === (themeName || 'default'));
    });
}

async function selectColorTheme(themeName) {
    if (themeName !== 'default' && !isPremiumUser) { openPremiumUpgradeModal(); return; }
    applyColorTheme(themeName);
    localStorage.setItem(colorThemeKey(), themeName);
    if (supabaseClient && currentUserId) {
        const { data: existing } = await supabaseClient.from('user_premium').select('user_id').eq('user_id', currentUserId).maybeSingle();
        if (existing) await supabaseClient.from('user_premium').update({ theme: themeName }).eq('user_id', currentUserId);
        else await supabaseClient.from('user_premium').insert({ user_id: currentUserId, username: currentUsername, theme: themeName });
    }
}

async function loadColorTheme() {
    let themeName = 'default';
    if (supabaseClient && currentUserId) {
        const { data } = await supabaseClient.from('user_premium').select('theme').eq('user_id', currentUserId).maybeSingle();
        if (data && data.theme) themeName = data.theme;
    }
    if (themeName === 'default') {
        const local = localStorage.getItem(colorThemeKey());
        if (local) themeName = local;
    }
    applyColorTheme(themeName);
}

// --- יעדים חודשיים + מערכת פרס עצמי (פרימיום): מתחבר לנתונים קיימים
// (משקל/משימות שהושלמו) כדי לחשב התקדמות בפועל, ולא רק דגל ידני ---
function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

let cachedMonthlyGoal = null;
let viewedMonthKey = null;
let editingMonthlyGoal = false;

async function loadMonthlyGoal() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('monthly_goals').select('*').eq('user_id', currentUserId).eq('month_key', currentMonthKey()).maybeSingle();
    cachedMonthlyGoal = data || null;
    await renderMonthlyGoal();
}

function shiftMonthKey(monthKey, delta) {
    const [y, m] = monthKey.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function formatMonthLabel(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(currentLang, { month: 'long', year: 'numeric' });
}

async function navigateMonthlyGoal(delta) {
    const base = viewedMonthKey || currentMonthKey();
    const target = shiftMonthKey(base, delta);
    if (target > currentMonthKey()) return;
    viewedMonthKey = target;
    await renderMonthlyGoal();
}

function formatGoalProgressText(goal, currentValue) {
    const cur = currentValue !== null && currentValue !== undefined ? currentValue : '—';
    if (goal.goal_type === 'weight') {
        return `${t('monthly_goal_current_label')}: ${cur} ${t('monthly_goal_kg_unit')}  •  ${t('monthly_goal_target_label')}: ${goal.target_value} ${t('monthly_goal_kg_unit')}`;
    }
    if (goal.goal_type === 'tasks') {
        return `${cur} / ${goal.target_value} ${t('monthly_goal_tasks_unit')}`;
    }
    // ידני (מספרי): פורמט נקי בלבד, בלי לחזור על שם היעד (הוא כבר מוצג מעל בכותרת)
    return `${cur} / ${goal.target_value}`;
}

function isGoalRewardClaimed(goalId) {
    try { return JSON.parse(localStorage.getItem('weekwise_claimed_goal_rewards') || '[]').includes(goalId); }
    catch { return false; }
}

async function claimGoalReward(goalId) {
    try {
        const claimed = JSON.parse(localStorage.getItem('weekwise_claimed_goal_rewards') || '[]');
        if (!claimed.includes(goalId)) {
            claimed.push(goalId);
            localStorage.setItem('weekwise_claimed_goal_rewards', JSON.stringify(claimed));
        }
    } catch { /* localStorage unavailable, skip persistence */ }
    if (cachedMonthlyGoal && cachedMonthlyGoal.id === goalId) celebrateGoalAchieved(cachedMonthlyGoal);
    await renderMonthlyGoal();
}

async function computeGoalCurrentValue(goal) {
    if (goal.goal_type === 'weight') {
        const { data } = await supabaseClient.from('weight_tracker').select('weight_value').eq('user_id', currentUserId).order('weight_date', { ascending: false }).limit(1).maybeSingle();
        return data ? data.weight_value : null;
    }
    if (goal.goal_type === 'tasks') {
        const { data } = await supabaseClient.from('my_center_tasks').select('id').eq('user_id', currentUserId).eq('is_completed', true);
        return data ? data.length : 0;
    }
    return goal.current_value || 0; // custom: מתעדכן ידנית ע"י המשתמש בלבד
}

function isGoalAchieved(goal, currentValue) {
    if (currentValue === null || currentValue === undefined) return false;
    if (goal.goal_type === 'weight') {
        // כיוון היעד נקבע לפי starting_value מול target_value בזמן היצירה, לא
        // תמיד ירידה: אם היעד היה *מעל* המשקל ההתחלתי (יעד עלייה במשקל), "הושג"
        // צריך להיות כשהמשקל *עלה* עד/מעל היעד - לא כשהוא עדיין נמוך ממנו,
        // אחרת יעד עלייה היה מסומן "הושג" כבר ביום הראשון (כל משקל התחלתי
        // נמוך הוא תמיד <= יעד גבוה יותר)
        const start = typeof goal.starting_value === 'number' ? goal.starting_value : currentValue;
        return start <= goal.target_value ? currentValue >= goal.target_value : currentValue <= goal.target_value;
    }
    return currentValue >= goal.target_value;
}

function goalProgressPercent(goal, currentValue) {
    if (currentValue === null || currentValue === undefined) return 0;
    if (goal.goal_type === 'weight') {
        const start = typeof goal.starting_value === 'number' ? goal.starting_value : currentValue;
        if (start === goal.target_value) return currentValue <= goal.target_value ? 100 : 0;
        const pct = ((start - currentValue) / (start - goal.target_value)) * 100;
        return Math.min(100, Math.max(0, Math.round(pct)));
    }
    if (!goal.target_value) return 0;
    return Math.min(100, Math.max(0, Math.round((currentValue / goal.target_value) * 100)));
}

async function renderMonthlyGoal() {
    const container = document.getElementById('monthly-goal-content');
    if (!container) return;

    if (!isPremiumUser) {
        container.innerHTML = `<p class="monthly-goal-empty">${t('monthly_goal_premium_hint')}</p><button class="btn-secondary" onclick="openPremiumUpgradeModal()">${t('settings_upgrade_btn')}</button>`;
        return;
    }

    if (!viewedMonthKey) viewedMonthKey = currentMonthKey();
    const isCurrentMonth = viewedMonthKey === currentMonthKey();

    let goal = isCurrentMonth ? cachedMonthlyGoal : null;
    if (!isCurrentMonth) {
        const { data } = await supabaseClient.from('monthly_goals').select('*').eq('user_id', currentUserId).eq('month_key', viewedMonthKey).maybeSingle();
        goal = data || null;
    }

    const navHtml = `
        <div class="monthly-goal-nav">
            <button class="monthly-goal-nav-btn" onclick="navigateMonthlyGoal(-1)" title="${t('monthly_goal_prev_month')}">‹</button>
            <span class="monthly-goal-month-label">${formatMonthLabel(viewedMonthKey)}</span>
            <button class="monthly-goal-nav-btn" onclick="navigateMonthlyGoal(1)" title="${t('monthly_goal_next_month')}" ${isCurrentMonth ? 'disabled' : ''}>›</button>
        </div>
    `;

    if (!goal) {
        container.innerHTML = navHtml + (isCurrentMonth
            ? `<p class="monthly-goal-empty">${t('monthly_goal_empty_hint')}</p><button class="btn-secondary" onclick="openSetMonthlyGoalModal()">${t('monthly_goal_set_btn')}</button>`
            : `<p class="monthly-goal-empty">${t('monthly_goal_empty_hint')}</p>`);
        return;
    }

    let currentValue = goal.current_value;
    let achieved = goal.achieved;
    let pct = goalProgressPercent(goal, currentValue);

    if (isCurrentMonth) {
        currentValue = await computeGoalCurrentValue(goal);
        achieved = isGoalAchieved(goal, currentValue);
        pct = goalProgressPercent(goal, currentValue);

        if (achieved && !goal.achieved) {
            await supabaseClient.from('monthly_goals').update({ achieved: true, current_value: currentValue }).eq('id', goal.id);
            cachedMonthlyGoal.achieved = true;
            goal.achieved = true;
            celebrateGoalAchieved(goal);
        } else if (currentValue !== null && currentValue !== goal.current_value) {
            await supabaseClient.from('monthly_goals').update({ current_value: currentValue }).eq('id', goal.id);
            cachedMonthlyGoal.current_value = currentValue;
        }
    }

    const progressText = formatGoalProgressText(goal, currentValue);
    const actionsHtml = isCurrentMonth
        ? `<div class="monthly-goal-actions">
                <button class="btn-edit-item" onclick="openSetMonthlyGoalModal(true)" title="${t('monthly_goal_edit_title')}">✏️</button>
                <button class="btn-delete-item" onclick="deleteMonthlyGoal()">❌</button>
           </div>`
        : `<span class="monthly-goal-readonly-badge">${t('monthly_goal_viewing_past')}</span>`;

    let trophyHtml = '';
    if (achieved) {
        const claimed = isGoalRewardClaimed(goal.id);
        trophyHtml = `
            <div class="monthly-goal-trophy-banner">
                <span class="monthly-goal-trophy-icon">🏆</span>
                <div class="monthly-goal-trophy-text">
                    <strong>${t('monthly_goal_trophy_unlocked')}</strong>
                    <span>${goal.goal_name} — ${progressText}</span>
                </div>
                ${isCurrentMonth ? `<button class="btn-secondary monthly-goal-claim-btn" onclick="claimGoalReward('${goal.id}')" ${claimed ? 'disabled' : ''}>${claimed ? t('monthly_goal_reward_claimed_btn') : t('monthly_goal_claim_reward_btn')}</button>` : ''}
            </div>`;
    }

    container.innerHTML = `
        ${navHtml}
        <div class="monthly-goal-header-row">
            <span class="monthly-goal-name">${goal.goal_name}${achieved ? ' 🏆' : ''}</span>
            ${actionsHtml}
        </div>
        <div class="progress-bar-bg"><div class="progress-bar-fill${achieved ? ' completed' : ''}" style="width: ${pct}%;"></div></div>
        <div class="monthly-goal-values-row">
            <span class="monthly-goal-values">${progressText}</span>
            ${isCurrentMonth && goal.goal_type === 'custom' ? `
                <div class="monthly-goal-quick-controls">
                    <button class="btn-goal-step" onclick="adjustCustomGoal(-1)" ${(currentValue || 0) <= 0 ? 'disabled' : ''} title="${t('monthly_goal_decrement_btn')}">−</button>
                    <button class="btn-goal-step" onclick="adjustCustomGoal(1)" title="${t('monthly_goal_increment_btn')}">+</button>
                </div>` : ''}
        </div>
        ${trophyHtml}
    `;
}

function openSetMonthlyGoalModal(isEdit = false) {
    editingMonthlyGoal = !!isEdit && !!cachedMonthlyGoal;
    const titleKey = editingMonthlyGoal ? 'monthly_goal_edit_modal_title' : 'monthly_goal_modal_title';
    const saveKey = editingMonthlyGoal ? 'monthly_goal_update_btn' : 'monthly_goal_save_btn';
    const titleEl = document.getElementById('monthly-goal-modal-title');
    const saveBtn = document.getElementById('monthly-goal-save-btn');
    titleEl.setAttribute('data-i18n', titleKey);
    titleEl.textContent = t(titleKey);
    saveBtn.setAttribute('data-i18n', saveKey);
    saveBtn.textContent = t(saveKey);
    document.getElementById('monthly-goal-name-input').value = editingMonthlyGoal ? cachedMonthlyGoal.goal_name : '';
    // ברירת המחדל היא 'custom' ולא 'tasks': 'tasks' ו-'weight' לא רק תוויות - הן
    // מחברות את היעד למקור נתונים אחר לגמרי (משימות שהושלמו ב"מרכז שלי"/מעקב
    // משקל בפועל), אז יעד חופשי כמו "ירידה במשקל" שנשמר כברירת מחדל כ-'tasks'
    // עוקב בטעות אחרי משימות שהושלמו שאין להן שום קשר לשם שהמשתמש הקליד
    document.getElementById('monthly-goal-type-input').value = editingMonthlyGoal ? cachedMonthlyGoal.goal_type : 'custom';
    document.getElementById('monthly-goal-target-input').value = editingMonthlyGoal ? cachedMonthlyGoal.target_value : '';
    document.getElementById('monthly-goal-current-input').value = editingMonthlyGoal ? (cachedMonthlyGoal.current_value || 0) : 0;
    handleMonthlyGoalTypeChange();
    openModal('modal-set-monthly-goal');
}

// שדה "התקדמות נוכחית" רלוונטי רק ליעד ידני/מספרי - יעדי משימות/משקל תמיד
// מחושבים אוטומטית ממקור הנתונים שלהם (ר' computeGoalCurrentValue), ולכן
// אין טעם (ואף מטעה) לתת למשתמש לערוך אותם ידנית כאן
function handleMonthlyGoalTypeChange() {
    const type = document.getElementById('monthly-goal-type-input').value;
    const wrap = document.getElementById('monthly-goal-current-wrap');
    if (wrap) wrap.classList.toggle('hidden', type !== 'custom');
}

async function saveMonthlyGoal() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    const name = document.getElementById('monthly-goal-name-input').value.trim();
    const type = document.getElementById('monthly-goal-type-input').value;
    const target = parseFloat(document.getElementById('monthly-goal-target-input').value);
    if (!name || isNaN(target)) { showAppToast(t('calendar_event_missing_fields'), 'error'); return; }
    // התקדמות נוכחית ניתנת לעריכה ידנית רק ביעד מסוג 'custom' - ליעדי משימות/
    // משקל היא תמיד מחושבת מחדש אוטומטית (ר' computeGoalCurrentValue)
    const manualCurrent = type === 'custom' ? (parseFloat(document.getElementById('monthly-goal-current-input').value) || 0) : 0;

    if (editingMonthlyGoal && cachedMonthlyGoal) {
        const updatePayload = { goal_name: name, goal_type: type, target_value: target };
        if (type === 'custom') updatePayload.current_value = manualCurrent;
        const { error } = await supabaseClient.from('monthly_goals').update(updatePayload).eq('id', cachedMonthlyGoal.id);
        if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
        editingMonthlyGoal = false;
        closeModal('modal-set-monthly-goal');
        showAppToast(t('item_added_success'));
        await loadMonthlyGoal();
        return;
    }

    let startingValue = null;
    if (type === 'weight') {
        const { data } = await supabaseClient.from('weight_tracker').select('weight_value').eq('user_id', currentUserId).order('weight_date', { ascending: false }).limit(1).maybeSingle();
        startingValue = data ? data.weight_value : target;
    }

    const { error } = await supabaseClient.from('monthly_goals').insert({
        username: currentUsername, user_id: currentUserId, goal_name: name, goal_type: type,
        target_value: target, starting_value: startingValue, current_value: manualCurrent,
        month_key: currentMonthKey(), achieved: false
    });
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    closeModal('modal-set-monthly-goal');
    showAppToast(t('item_added_success'));
    await loadMonthlyGoal();
}

async function deleteMonthlyGoal() {
    if (!cachedMonthlyGoal) return;
    await supabaseClient.from('monthly_goals').delete().eq('id', cachedMonthlyGoal.id);
    cachedMonthlyGoal = null;
    await renderMonthlyGoal();
}

async function adjustCustomGoal(delta) {
    if (!cachedMonthlyGoal) return;
    const newValue = Math.max(0, (cachedMonthlyGoal.current_value || 0) + delta);
    await supabaseClient.from('monthly_goals').update({ current_value: newValue }).eq('id', cachedMonthlyGoal.id);
    cachedMonthlyGoal.current_value = newValue;
    await renderMonthlyGoal();
}

function celebrateGoalAchieved(goal) {
    const rewardKeys = ['monthly_goal_reward_1', 'monthly_goal_reward_2', 'monthly_goal_reward_3'];
    const msg = t(rewardKeys[Math.floor(Math.random() * rewardKeys.length)]);
    document.getElementById('goal-celebration-text').textContent = msg;
    const summaryEl = document.getElementById('goal-celebration-summary');
    if (summaryEl) {
        const progressText = formatGoalProgressText(goal, goal.current_value);
        summaryEl.textContent = `${goal.goal_name} — ${progressText}`;
    }
    openModal('modal-goal-celebration');
}

async function toggleMonthlyGoalLookback() {
    const list = document.getElementById('monthly-goal-lookback-list');
    if (!list) return;
    const willShow = list.classList.contains('hidden');
    if (willShow) await loadPastMonthlyGoals();
    list.classList.toggle('hidden', !willShow);
}

async function loadPastMonthlyGoals() {
    const list = document.getElementById('monthly-goal-lookback-list');
    if (!list || !supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('monthly_goals').select('*').eq('user_id', currentUserId).lt('month_key', currentMonthKey()).order('month_key', { ascending: false });
    list.innerHTML = '';
    if (!data || !data.length) {
        const empty = document.createElement('div');
        empty.className = 'calendar-glance-empty';
        empty.textContent = t('monthly_goal_lookback_empty');
        list.appendChild(empty);
        return;
    }
    data.forEach(g => {
        const row = document.createElement('div');
        row.className = 'monthly-goal-lookback-item' + (g.achieved ? ' achieved' : '');
        row.innerHTML = `<span class="monthly-goal-lookback-month">${g.month_key}</span><span class="monthly-goal-lookback-name">${g.goal_name}</span><span class="monthly-goal-lookback-values">${g.current_value}/${g.target_value}</span><span>${g.achieved ? '🏆' : '—'}</span>`;
        list.appendChild(row);
    });
}

// --- מונה שימוש חינמי בניתוח מתכונים (10 ניתוחים חינם), נשמר ב-Supabase per-user ---
// חסימה זו מדולגת לחלוטין עבור משתמשי פרימיום (isPremiumUser)
const RECIPE_AI_FREE_LIMIT = 10;
const IMAGE_SCAN_FREE_LIMIT = 10;
let cachedAiUsage = 0;
let cachedImageScansUsed = 0;

async function loadAiUsage() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('user_ai_usage').select('recipe_ai_parses_used, image_scans_used').eq('user_id', currentUserId).maybeSingle();
    cachedAiUsage = data ? data.recipe_ai_parses_used : 0;
    cachedImageScansUsed = data ? (data.image_scans_used || 0) : 0;
}

async function incrementAiUsage() {
    cachedAiUsage += 1;
    const { data: existing } = await supabaseClient.from('user_ai_usage').select('user_id').eq('user_id', currentUserId).maybeSingle();
    if (existing) await supabaseClient.from('user_ai_usage').update({ recipe_ai_parses_used: cachedAiUsage }).eq('user_id', currentUserId);
    else await supabaseClient.from('user_ai_usage').insert({ user_id: currentUserId, username: currentUsername, recipe_ai_parses_used: cachedAiUsage });
}

async function parseRecipeWithAI() {
    if (!isPremiumUser && cachedAiUsage >= RECIPE_AI_FREE_LIMIT) {
        showAppToast(t('recipe_ai_limit_desc'), 'error');
        openPremiumUpgradeModal();
        return;
    }
    const raw = document.getElementById('recipe-ai-raw-input').value.trim();
    if (!raw) { showAppToast(t('recipe_ai_empty'), 'error'); return; }

    const parsed = parseRecipeText(raw);
    document.getElementById('recipe-title-input').value = parsed.title;
    if (parsed.category) document.getElementById('recipe-category-input').value = parsed.category;
    document.getElementById('recipe-calories-input').value = parsed.calories || '';
    document.getElementById('recipe-ingredients-input').value = parsed.ingredients;
    document.getElementById('recipe-instructions-input').value = parsed.instructions;
    setRecipeCaloriesEstimateHint(parsed.caloriesEstimated);
    // מנקים את תיבת ההדבקה הגולמית אחרי פירוק מוצלח - כדי שהטקסט המקורי
    // הלא-מנותח לא יישאר גלוי בטופס לצד השדות המפורקים שכבר מולאו
    document.getElementById('recipe-ai-raw-input').value = '';

    await incrementAiUsage();
    showAppToast(t('recipe_ai_parsed_success'));
}

// --- סריקת מתכון מתמונה: AI אמיתי בעל יכולת ראייה, דרך פרוקסי Edge Function בצד שרת ---
// המפתח האמיתי (Anthropic) חי אך ורק כ-secret בפונקציית ה-Edge, לעולם לא בקוד לקוח.
// המגבלה של 10 סריקות חינם נאכפת בשרת (לא ניתן לעקוף אותה מהלקוח).
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result;
            const match = dataUrl.match(/^data:(.*?);base64,(.*)$/);
            if (!match) { reject(new Error('invalid_data_url')); return; }
            resolve({ mediaType: match[1], base64: match[2] });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

async function handleRecipeImageSelected(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = ''; // מאפשר לבחור את אותו קובץ שוב בפעם הבאה
    if (!file) return;
    await runRecipeImageScan(file);
}

// מעלה את קובץ התמונה עצמו לאחסון (Supabase Storage, bucket "recipe-photos"),
// בנפרד לגמרי מניתוח הטקסט - כך שהתמונה תמיד מצורפת ומוצגת כתצוגה מקדימה
// מיד עם הבחירה, גם אם ניתוח ה-AI/OCR נכשל. נכשל בשקט (מחזירה null) אם
// ה-bucket עדיין לא קיים בפרויקט Supabase - זו תוספת אופציונלית, לא חוסמת כלום
async function uploadRecipeImage(file) {
    if (!supabaseClient || !currentUserId || !file.type.startsWith('image/')) return null;
    try {
        const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'jpg';
        const path = `${currentUserId}/${Date.now()}.${ext}`;
        const { error } = await supabaseClient.storage.from('recipe-photos').upload(path, file, { upsert: false, contentType: file.type });
        if (error) return null;
        const { data } = supabaseClient.storage.from('recipe-photos').getPublicUrl(path);
        return data ? data.publicUrl : null;
    } catch {
        return null;
    }
}

function setRecipeImagePreview(url) {
    const input = document.getElementById('recipe-image-url-input');
    const preview = document.getElementById('recipe-image-preview');
    if (input) input.value = url || '';
    if (preview) {
        if (url) { preview.src = url; preview.classList.remove('hidden'); }
        else { preview.src = ''; preview.classList.add('hidden'); }
    }
}

// נפילה רכה כש-scan-recipe-image (ה-AI האמיתי בענן) נכשל/לא זמין: OCR אמיתי
// בצד הלקוח (Tesseract.js, לא PDF) על התמונה עצמה, ואז אותו מנתח חוקי-
// דטרמיניסטי שכבר משמש להדבקת טקסט (parseRecipeText) על התוצר. אם ה-OCR
// עצמו לא הצליח לחלץ כלום שימושי, מחזירה false בלי להמציא תוכן - הטופס
// נשאר פתוח וריק לעריכה ידנית, זה תמיד עדיף על "לנחש" מה בתמונה
async function runLocalRecipeOcrFallback(file) {
    if (!file.type.startsWith('image/') || typeof Tesseract === 'undefined') return false;
    try {
        showRecipeScanLoading();
        const { data } = await Tesseract.recognize(file, 'heb+eng');
        const rawText = ((data && data.text) || '').trim();
        if (!rawText) return false;
        const parsed = parseRecipeText(rawText);
        if (!parsed || !parsed.title) return false;
        document.getElementById('recipe-title-input').value = parsed.title;
        if (parsed.category) document.getElementById('recipe-category-input').value = parsed.category;
        document.getElementById('recipe-calories-input').value = parsed.calories || '';
        document.getElementById('recipe-ingredients-input').value = parsed.ingredients;
        document.getElementById('recipe-instructions-input').value = parsed.instructions;
        setRecipeCaloriesEstimateHint(parsed.caloriesEstimated);
        document.getElementById('recipe-ai-raw-input').value = '';
        showAppToast(t('recipe_scan_ocr_success'));
        return true;
    } catch {
        return false;
    } finally {
        hideRecipeScanLoading();
    }
}

// מנותקת מ-handleRecipeImageSelected כדי שגם ה-AI Brain (שמזין קובץ שנבחר
// דרך קלט קובץ אחר לגמרי) יוכל להריץ בדיוק את אותה לוגיקת סריקה, בלי כפילות
async function runRecipeImageScan(file) {
    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
        showAppToast(t('recipe_scan_unsupported_type'), 'error');
        return;
    }

    if (!isPremiumUser && cachedImageScansUsed >= IMAGE_SCAN_FREE_LIMIT) {
        showAppToast(t('recipe_scan_limit_desc'), 'error');
        openPremiumUpgradeModal();
        return;
    }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }

    // התמונה מועלית ומצורפת בנפרד ובמקביל לניתוח, כדי שתמיד תיקלט גם אם
    // ניתוח הטקסט למטה נכשל
    uploadRecipeImage(file).then(url => { if (url) setRecipeImagePreview(url); });

    showAppToast(t('recipe_scan_in_progress'));
    // אנימציית טעינה ייעודית מוצגת רק אם הסריקה לוקחת יותר מ-5 שניות, כדי לשמור
    // על ממשק נקי בסריקות מהירות - ה-timeout מבוטל אם הסריקה מסתיימת קודם לכן.
    const loadingTimer = setTimeout(showRecipeScanLoading, 5000);
    try {
        const { mediaType, base64 } = await fileToBase64(file);
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;

        let recipe = null;
        if (token) {
            try {
                const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-recipe-image`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                    body: JSON.stringify({ imageBase64: base64, mediaType })
                });
                const result = await res.json();

                if (res.status === 402 || result.error === 'limit_reached') {
                    showAppToast(t('recipe_scan_limit_desc'), 'error');
                    openPremiumUpgradeModal();
                    return;
                }
                if (res.ok && !result.error && result.recipe) {
                    recipe = result.recipe;
                    if (typeof result.scansUsed === 'number') cachedImageScansUsed = result.scansUsed;
                }
            } catch {
                // הענן לא זמין (רשת/שרת) - ממשיכים בשקט ל-OCR המקומי למטה
            }
        }

        if (recipe) {
            document.getElementById('recipe-title-input').value = recipe.title || '';
            if (recipe.category) document.getElementById('recipe-category-input').value = recipe.category;
            document.getElementById('recipe-calories-input').value = recipe.calories || '';
            document.getElementById('recipe-ingredients-input').value = recipe.ingredients || '';
            document.getElementById('recipe-instructions-input').value = recipe.instructions || '';
            setRecipeCaloriesEstimateHint(false);
            document.getElementById('recipe-ai-raw-input').value = '';
            showAppToast(t('recipe_scan_success'));
            return;
        }

        // ה-AI האמיתי בענן לא זמין/לא הצליח - נופלים בעדינות ל-OCR מקומי
        // (Tesseract.js) על אותה תמונה. אם גם הוא לא מצא כלום שימושי, לא
        // מציגים שגיאה - פשוט משאירים את הטופס (עם התמונה שכבר צורפה) פתוח
        // למילוי ידני, שזה בכל מקרה תמיד עובד
        const ocrSucceeded = await runLocalRecipeOcrFallback(file);
        if (!ocrSucceeded) showAppToast(t('recipe_scan_manual_hint'));
    } finally {
        clearTimeout(loadingTimer);
        hideRecipeScanLoading();
    }
}

// --- טאב "תמונה" ב-AI Brain: אותו מנוע ראייה ממש כמו סריקת מתכון/ארוחה
// יומית (Edge Functions קיימים), רק שהתוצאה מנותבת ליעד שהמשתמש בחר -
// מתכון מלא (scan-recipe-image) או ארוחה קבועה מהירה (scan-meal-photo,
// אותה פונקציה בדיוק שמזינה את מעקב הארוחות היומי - כאן לוקחים רק פריט אחד) ---
async function handleAiBrainImageSelected(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const targetInput = document.querySelector('input[name="ai-brain-photo-target"]:checked');
    const target = targetInput ? targetInput.value : 'recipe';
    closeModal('modal-ai-brain');
    if (target === 'preset') {
        openModal('modal-add-preset');
        loadPresetManageList();
        await runPresetImageScan(file);
    } else {
        openAddRecipeForm();
        await runRecipeImageScan(file);
    }
}

async function runPresetImageScan(file) {
    if (!file.type.startsWith('image/')) { showAppToast(t('meal_photo_unsupported_type'), 'error'); return; }
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }

    const loadingTimer = setTimeout(showPresetScanLoading, 5000);
    try {
        const { mediaType, base64 } = await fileToBase64(file);
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) { showAppToast(t('error_not_connected'), 'error'); return; }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-meal-photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ imageBase64: base64, mediaType })
        });
        const result = await res.json();

        if (res.status === 402 || result.error === 'premium_required') { openPremiumUpgradeModal(); return; }
        if (!res.ok || result.error || !result.items || !result.items.length) {
            showAppToast(t('meal_photo_failed'), 'error');
            return;
        }

        // ארוחה קבועה היא פריט בודד - אם התמונה מכילה כמה פריטים, לוקחים רק
        // את הראשון (המשתמש תמיד יכול לערוך את השם/קלוריות לפני השמירה)
        const first = result.items[0];
        document.getElementById('new-preset-name').value = first.food_name || '';
        document.getElementById('new-preset-calories').value = first.calories || '';
        showAppToast(t('preset_scan_success'));
    } catch (err) {
        showAppToast(t('meal_photo_failed'), 'error');
    } finally {
        clearTimeout(loadingTimer);
        hidePresetScanLoading();
    }
}

function showPresetScanLoading() {
    const el = document.getElementById('preset-scan-loading');
    if (el) el.classList.remove('hidden');
}

function hidePresetScanLoading() {
    const el = document.getElementById('preset-scan-loading');
    if (el) el.classList.add('hidden');
}

function showRecipeScanLoading() {
    const el = document.getElementById('recipe-scan-loading');
    if (el) el.classList.remove('hidden');
}

function hideRecipeScanLoading() {
    const el = document.getElementById('recipe-scan-loading');
    if (el) el.classList.add('hidden');
}

// --- ניקוי רעש מ-OCR/הדבקה מתוך צילומי מסך של אפליקציות צ'אט (שעון, כפתור
// "Reply", שם השולח, תאריך, סטטוס-בר) - רץ *לפני* parseRecipeText, כדי
// ששורות רעש כאלה לא "יתפסו" בטעות ככותרת/מצרך ולא יתמזגו עם שורות תוכן
// אמיתיות (זה בדיוק מה שגרם לכותרת שגויה כמו "SNES II -13:42" ולרשימות
// מעורבבות מצילום מסך של שיחה) ---
const OCR_NOISE_LINE_PATTERNS = [
    /^\d{1,2}:\d{2}$/,                                  // שעון עצמאי, למשל "13:42"
    /^(reply|השב|השיבו)\b/i,                             // כפתור "Reply"/"השב" בצ'אטים
    /^you$/i,                                            // שם שולח "You" בצ'אטים
    /^[a-z]{3,10}\s+\d{1,2}(,\s*\d{4})?$/i,               // תאריך כמו "July 16" / "July 16, 2026"
    /^[a-z0-9]+(\s+(ii|iii|iv|pro|max|plus))?\s*[-–—]?\s*\d{1,2}:\d{2}$/i, // "SNES II -13:42" וכדומה (שם מכשיר+שעון, כל סוגי המקף)
    /^\d{1,3}\s*%$/,                                     // אחוז סוללה עצמאי
    /^\d{1,2}g$/i,                                       // "4G"/"5G" סטטוס רשת (לא להתבלבל עם "גרם" שתמיד עם רווח/מספר לפניו)
    /^[\d\s]{1,4}$/,                                     // שורה שהיא רק מספר/ים בודדים קצרים (מונה תגובות/לייקים וכו')
];
function isOcrNoiseLine(line) {
    if (OCR_NOISE_LINE_PATTERNS.some(re => re.test(line))) return true;
    // רשת ביטחון כללית: שורה קצרה (עד 5 "מילים") שמכילה שעון בתוכה איפשהו
    // ולא מכילה אף מילת-מפתח טיפוסית של מתכון (כמות/יחידה/פועל בישול) -
    // כמעט תמיד שריד סטטוס-בר/שעון מכשיר שלא נתפס באחת התבניות המדויקות
    // למעלה (למשל בגלל תו מקף לא-סטנדרטי או שם מכשיר לא-צפוי)
    if (/\d{1,2}:\d{2}/.test(line) && line.split(/\s+/).length <= 5 &&
        !RECIPE_INGREDIENT_WORD_RE.test(line) && !RECIPE_INSTRUCTION_WORD_RE.test(line)) return true;
    return false;
}
// תווים שכיחים ש-OCR מבלבל איתם בולט חלול ("○" נקרא בטעות כ-"©"/"&" וכו') -
// מוסרים אותם כתחילית שורה, לא ממירים לתו בולט אחר (המצרך/ההוראה כבר בשורה
// נפרדת משלו, אין צורך בעיטור נוסף)
const OCR_BULLET_CONFUSION_RE = /^[©®&§*°•○◦▪✦❖\-–—]\s*/;
// חלק מהרעש לא יושב כשורה נפרדת משלו - כשצילום מסך מערבב עברית (RTL)
// ואנגלית (LTR, שעון/תאריך) ב-OCR, המנוע לפעמים "ממזג" את שורת הסטטוס עם
// תחילת השורה האמיתית הבאה אחריה לשורה טקסט אחת (בדיוק מה שגרם ל"SNES II
// -13:42" להישאר כתחילית כותרת גם אחרי הניקוי, כי היא לא הייתה שורה שלמה
// בפני עצמה). התבניות האלה מוסרות רק כתחילית שורה, גם כשיש תוכן אמיתי
// אחריהן - להבדיל מ-OCR_NOISE_LINE_PATTERNS שדורש שהשורה *כולה* תהיה רעש
const OCR_NOISE_PREFIX_PATTERNS = [
    /^[a-z0-9]+(\s+(ii|iii|iv|pro|max|plus))?\s*[-–—]\s*\d{1,2}:\d{2}\s*/i, // "SNES II -13:42 " כתחילית
    /^\d{1,2}:\d{2}\s+/,                                                    // "13:42 " כתחילית
    /^(reply|השב|השיבו)\s*[:\-–—]?\s*/i,                                    // "Reply: " כתחילית
];
function stripOcrNoisePrefix(line) {
    let out = line;
    for (let i = 0; i < 3; i++) { // כמה שכבות רעש עלולות להצטבר על אותה שורה
        let changedThisPass = false;
        for (const re of OCR_NOISE_PREFIX_PATTERNS) {
            const stripped = out.replace(re, '');
            if (stripped !== out) { out = stripped.trim(); changedThisPass = true; }
        }
        if (!changedThisPass) break;
    }
    return out;
}
function sanitizeOcrText(raw) {
    return raw
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !isOcrNoiseLine(l))
        .map(l => stripOcrNoisePrefix(l))
        .map(l => l.replace(OCR_BULLET_CONFUSION_RE, '').trim())
        .filter(Boolean)
        .join('\n');
}

// --- אומדן קלוריות גס לפי המצרכים המזוהים, כשלא צוין מספר קלוריות מפורש
// בטקסט המקור - טבלת חיפוש קטנה של רכיבי אפייה/בישול נפוצים (קלוריות ל-100
// גרם, או ליחידה בודדת עבור ביצים). לא מנחשת כמות שלא צוינה בטקסט (שורה בלי
// גרם/מ"ל/מספר יחידות מפורש פשוט לא נכנסת לאומדן) - תמיד המלצה בלבד, לא
// עובדה, ולכן תמיד מוצגת עם אזהרה מפורשת בממשק (ר' recipe_calories_estimated_hint) ---
const RECIPE_CALORIE_DB = [
    { re: /קקאו|cocoa/i, kcal100g: 228 },
    { re: /שוקולד|chocolate/i, kcal100g: 546 },
    { re: /קמח|flour/i, kcal100g: 364 },
    { re: /סוכר חום|brown sugar/i, kcal100g: 380 },
    { re: /סוכר|sugar/i, kcal100g: 387 },
    { re: /חמאה|butter/i, kcal100g: 717 },
    { re: /שמן|\boil\b/i, kcal100g: 884 },
    { re: /שמנת|cream/i, kcal100g: 340 },
    { re: /חלב|\bmilk\b/i, kcal100g: 42 },
    { re: /דבש|honey/i, kcal100g: 304 },
    { re: /גבינה|cheese/i, kcal100g: 350 },
    { re: /אבקת אפייה|baking powder|סודה לשתייה|baking soda/i, kcal100g: 53 },
    { re: /שמרים|yeast/i, kcal100g: 105 },
    { re: /אגוז|walnut|almond|שקד|בוטן|peanut/i, kcal100g: 600 },
    { re: /תפוח(?!\s*הצהריים)|apple/i, kcal100g: 52 },
    { re: /בננה|banana/i, kcal100g: 89 },
    { re: /אורז|\brice\b/i, kcal100g: 130 },
    { re: /חלבון (ה?ביצה)?|egg white/i, kcalPerUnit: 17 },
    { re: /חלמון|egg yolk/i, kcalPerUnit: 55 },
    { re: /ביצ/i, kcalPerUnit: 70 },
    { re: /מים|\bwater\b/i, kcal100g: 0 },
    { re: /מלח|\bsalt\b/i, kcal100g: 0 },
];
function estimateIngredientLineCalories(line) {
    const gramsMatch = line.match(/(\d+(?:\.\d+)?)\s*(גרם|ג['׳]|g\b|gram|grams|מ"ל|ml)/i);
    const grams = gramsMatch ? parseFloat(gramsMatch[1]) : null;
    const countMatch = line.match(/^(\d+(?:\.\d+)?)/);
    const count = countMatch ? parseFloat(countMatch[1]) : null;
    for (const item of RECIPE_CALORIE_DB) {
        if (!item.re.test(line)) continue;
        if (item.kcalPerUnit != null) return (count || 1) * item.kcalPerUnit;
        if (grams != null) return (grams / 100) * item.kcal100g;
        return 0; // רכיב זוהה אבל בלי כמות מפורשת בגרם/מ"ל - לא מנחשים, מדלגים
    }
    return 0;
}
function estimateRecipeCalories(ingredientsText) {
    if (!ingredientsText) return null;
    let total = 0, matchedAny = false;
    ingredientsText.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
        const kcal = estimateIngredientLineCalories(line);
        if (kcal > 0) { total += kcal; matchedAny = true; }
    });
    return matchedAny ? Math.round(total) : null;
}

// --- מנתח חוקי-דטרמיניסטי (אין LLM אמיתי): חילוץ מילולי-קפדני, ללא הוספת טקסט/הקשר משלו ---
// מזהה כותרות "מצרכים/הוראות" גם באמצע שורה (עם נקודתיים), מסנן שורות "רעש" טיפוסיות
// מאתרי מתכונים (זמן הכנה, דירוג, שיתוף וכו'), ובהיעדר כותרות - ממיין כל שורה לפי
// דפוסי כמות/יחידות מול פעלי בישול, בלי לנחש או להמציא תוכן שלא הופיע בטקסט המקורי.
const RECIPE_JUNK_LINE_RE = /^(print|share|save|rate this recipe|jump to recipe|prep\s*time|cook\s*time|total\s*time|servings?|yield|nutrition|difficulty|course|cuisine|advertisement|★|https?:\/\/|שתפו|הדפיסו|שמרו|דרגו|זמן הכנה|זמן בישול|מספר מנות|קושי)/i;
const RECIPE_INGREDIENT_WORD_RE = /^([\d½¼¾⅓⅔]|cup|cups|tbsp|tablespoon|tsp|teaspoon|gram|grams|\bg\b|kg|ml|\bl\b|oz|ounce|clove|cloves|pinch|slice|slices|כוס|כפית|כף|גרם|ק"ג|ג'|מ"ל|קורט|שן|פרוסות|יחידות)/i;
const RECIPE_INSTRUCTION_WORD_RE = /^(step\s*\d|\d+[.)]\s|mix|stir|bake|heat|add|pour|chop|preheat|whisk|combine|serve|cook|boil|fry|ערבבו|אפו|בשלו|הוסיפו|חממו|קצצו|טגנו|ערבבי|הכינו|קרמלו|בחשו)/i;

function parseRecipeText(raw) {
    const cleanedRaw = sanitizeOcrText(raw);
    const rawLines = cleanedRaw.split('\n').map(l => l.trim()).filter(Boolean);
    const lines = rawLines.filter(l => !RECIPE_JUNK_LINE_RE.test(l));

    const ingredientHeaderRe = /^(ingredients?|מצרכים|מרכיבים|רכיבים|ingr[ée]dients?|المكونات)\s*:?\s*(.*)$/i;
    const instructionHeaderRe = /^(instructions?|directions?|method|preparation|הוראות(?:\s*(?:ה)?הכנה)?|אופן\s*(?:ה)?הכנה|طريقة\s*التحضير|pr[ée]paration)\s*:?\s*(.*)$/i;

    // כותרת: לא סתם השורה הראשונה (lines[0]) - שיירי רעש קצרים (2-3 תווים)
    // שנשארו אחרי הניקוי היו עלולים עדיין להיתפס בטעות ככותרת. מחפשים את
    // אינדקס השורה המשמעותית הראשונה (לפחות 3 תווי אותיות אמיתיים) ומסירים
    // אימוג'י מוביל (כמו 🎂) לכותרת נקייה יותר - שומרים גם את האינדקס עצמו,
    // כדי ש"שאר הטקסט" (bodyLines למטה) יתחיל אחרי הכותרת האמיתית ולא סתם
    // אחרי lines[0], שעלולה להיות שריד רעש ולא הכותרת בפועל
    const titleIndex = lines.findIndex(l => (l.match(/[\p{L}]/gu) || []).length >= 3);
    const titleLine = titleIndex !== -1 ? lines[titleIndex] : (lines[0] || '');
    // מסירים אימוג'י מוביל (כמו 🎂) וגם הערה בסוגריים בסוף השורה (כמו "(מתאימה
    // לתבנית אינגליש קייק)") - כותרת נקייה עם שם המתכון בלבד
    const title = titleLine
        .replace(/^[\p{Extended_Pictographic}‍️\s]+/gu, '')
        .replace(/\s*\([^)]*\)\s*$/, '')
        .trim() || titleLine;

    const caloriesMatch = cleanedRaw.match(/(\d{2,5})\s*(kcal|cal|calories|קלוריות|سعرة)/i);
    const explicitCalories = caloriesMatch ? parseInt(caloriesMatch[1]) : null;

    const ingredientStart = lines.findIndex(l => ingredientHeaderRe.test(l));
    const instructionStart = lines.findIndex(l => instructionHeaderRe.test(l));

    let ingredients = '';
    let instructions = '';

    if (ingredientStart !== -1 || instructionStart !== -1) {
        // ממיינים את הכותרות שנמצאו לפי המיקום *בפועל* בטקסט, בלי להניח
        // שמצרכים תמיד באים לפני הוראות - הנחה כזאת קרסה כשרעש OCR גרם
        // לכותרת "הוראות" להתגלות (שגוי) *לפני* כותרת "מצרכים" האמיתית,
        // מה שגרם לאותן שורות תוכן להישלח פעמיים לשני השדות (מצרכים "בלעו"
        // הכול עד סוף הטקסט + הוראות גם גררו את אותו טווח בעצמן)
        const headers = [];
        if (ingredientStart !== -1) headers.push({ type: 'ingredients', index: ingredientStart, re: ingredientHeaderRe });
        if (instructionStart !== -1) headers.push({ type: 'instructions', index: instructionStart, re: instructionHeaderRe });
        headers.sort((a, b) => a.index - b.index);
        headers.forEach((h, i) => {
            const headerMatch = lines[h.index].match(h.re);
            const inlineFirst = headerMatch && headerMatch[2] ? [headerMatch[2]] : [];
            const end = i + 1 < headers.length ? headers[i + 1].index : lines.length;
            const content = [...inlineFirst, ...lines.slice(h.index + 1, end)].join('\n');
            if (h.type === 'ingredients') ingredients = content;
            else instructions = content;
        });
    } else {
        const bodyLines = lines.slice(titleIndex !== -1 ? titleIndex + 1 : 1);
        const ingredientLines = [];
        const instructionLines = [];
        bodyLines.forEach(line => {
            if (RECIPE_INGREDIENT_WORD_RE.test(line) && !RECIPE_INSTRUCTION_WORD_RE.test(line)) ingredientLines.push(line);
            else if (RECIPE_INSTRUCTION_WORD_RE.test(line)) instructionLines.push(line);
            else if (line.split(' ').length <= 6) ingredientLines.push(line);
            else instructionLines.push(line);
        });
        ingredients = ingredientLines.join('\n');
        instructions = instructionLines.join('\n');
    }

    // רשת ביטחון אחרונה: לעולם לא משאירים בהוראות שורה שכבר מופיעה במצרכים,
    // גם אם משהו למעלה בכל זאת חפף (למשל בגלל טקסט מקור לא-תקין) - כך
    // שהמצרכים לעולם לא "מופיעים כפול" בתיבת ההוראות
    if (ingredients && instructions) {
        const ingredientLineSet = new Set(ingredients.split('\n').map(l => l.trim()).filter(Boolean));
        instructions = instructions.split('\n').map(l => l.trim()).filter(l => l && !ingredientLineSet.has(l)).join('\n');
    }

    const lower = cleanedRaw.toLowerCase();
    let category = '';
    if (/breakfast|ארוחת בוקר|petit.d[ée]jeuner|desayuno|فطور/i.test(lower)) category = 'breakfast';
    else if (/appetizer|starter|ראשונ|entrada|entr[ée]e|مقبلات/i.test(lower)) category = 'appetizers';
    else if (/salad|סלט|ensalada|salade|سلطة/i.test(lower)) category = 'salads';
    else if (/soup|מרק|sopa|soupe|شوربة/i.test(lower)) category = 'soups';
    else if (/dessert|קינוח|postre|حلوى/i.test(lower)) category = 'desserts';
    else if (/snack|נשנוש|ביניים|collation|aperitivo|وجبة خفيفة/i.test(lower)) category = 'snacks';
    else if (/side dish|תוספת|accompagnement|guarnici[oó]n|جانبي/i.test(lower)) category = 'sides';
    else if (/dairy|חלבי|גבינה|fromage|queso|لبن|جبن/i.test(lower)) category = 'dairy_mains';
    else if (/meat|chicken|beef|בשר|עוף|בשרי|viande|poulet|carne|لحم|دجاج/i.test(lower)) category = 'meat_mains';

    // קלוריות: מספר מפורש שכתוב בטקסט המקור תמיד מנצח. רק כשאין כזה, מציעים
    // אומדן מבוסס-מצרכים כברירת מחדל לעריכה - עם caloriesEstimated=true כדי
    // שהממשק יציג אזהרה מפורשת שזו הערכה, לא עובדה מדויקת
    let calories = explicitCalories;
    let caloriesEstimated = false;
    if (calories == null) {
        const estimate = estimateRecipeCalories(ingredients);
        if (estimate != null) { calories = estimate; caloriesEstimated = true; }
    }

    return { title, category, calories, caloriesEstimated, ingredients, instructions };
}

async function saveScheduleSlotFromAdder() {
    if (!supabaseClient || !currentUserId) return;
    const day = document.getElementById('add-slot-day').value;
    const slot = parseInt(document.getElementById('add-slot-num').value);
    const timeInput = document.getElementById('add-slot-time');
    const taskVal = document.getElementById('add-slot-task').value.trim();
    const norm = normalizeScheduleTimeInput(timeInput.value);
    if (norm.needsAmpm) {
        openManualAmpmClarify(norm.hour, taskVal, (period) => {
            let h = norm.hour;
            if (period === 'evening' && h <= 11) h += 12;
            timeInput.value = `${String(h).padStart(2, '0')}:00`;
            saveScheduleSlotFromAdder();
        });
        return;
    }
    if (norm.time === null) { showAppToast(t('schedule_invalid_time_error'), 'error'); return; }
    timeInput.value = norm.time;
    const timeVal = norm.time;
    const reminderMinutes = parseInt(document.getElementById('add-slot-reminder').value) || 0;
    const reminderText = document.getElementById('add-slot-reminder-text').value.trim();
    const payload = {
        time_of_day: timeVal,
        task_title: taskVal,
        reminder_minutes: reminderMinutes > 0 ? reminderMinutes : null,
        reminder_text: reminderText || null
    };
    const { data: existing } = await supabaseClient.from('weekly_schedule').select('id').eq('user_id', currentUserId).eq('day_of_week', day).eq('slot_number', slot).maybeSingle();
    let error;
    if (existing) ({ error } = await supabaseClient.from('weekly_schedule').update(payload).eq('id', existing.id));
    else ({ error } = await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, user_id: currentUserId, day_of_week: day, slot_number: slot, ...payload }));
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    await loadWeeklySchedule();
    showAppToast(t('item_added_success'));
}

async function deleteScheduleSlotFromAdder() {
    const day = document.getElementById('add-slot-day').value;
    const slot = parseInt(document.getElementById('add-slot-num').value);
    await clearSingleSlot(day, slot);
}

// נפתח תמיד עם ברירת מחדל נקייה (היום הפעיל כרגע + השורה הריקה הראשונה שלו),
// כדי שלא יישארו ערכים ישנים משימוש קודם שעלולים לדרוס בטעות שורה לא קשורה
function openAddTaskModal() {
    const activeTab = document.querySelector('.day-tab.active');
    const day = activeTab ? activeTab.id.replace('daytab-', '') : dbDaysMap[new Date().getDay()];
    const daySlotEls = Array.from(document.querySelectorAll(`.slot-input-group[data-day="${day}"]`));
    const emptySlotEl = daySlotEls.find(el => !el.querySelector('.slot-task').value.trim());
    const slot = emptySlotEl ? parseInt(emptySlotEl.getAttribute('data-slot')) : 1;

    document.getElementById('add-slot-day').value = day;
    document.getElementById('add-slot-num').value = String(slot);
    document.getElementById('add-slot-time').value = '';
    document.getElementById('add-slot-task').value = '';
    document.getElementById('add-slot-reminder').value = '0';
    document.getElementById('add-slot-reminder-text').value = '';
    openModal('modal-add-task');
}

// --- מערכת תזכורות (מסונכרנת דרך Supabase) עם צליל Web Audio API ---
// הגדרות התזכורת (דקות לפני + טקסט) נשמרות בעמודות reminder_minutes/reminder_text
// בטבלת weekly_schedule, כך שהן מסונכרנות בין כל המכשירים של המשתמש.
// "כבר הופעל היום" נשאר מקומי per-device (localStorage לפי מזהה השורה), כי זה
// רק מונע כפילות הצגה על אותו מכשיר ולא צריך להיות משותף בין מכשירים.

let reminderAudioCtx = null;

function unlockReminderAudio() {
    if (!reminderAudioCtx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) reminderAudioCtx = new AudioCtx();
    }
    if (reminderAudioCtx && reminderAudioCtx.state === 'suspended') reminderAudioCtx.resume();
}

async function playReminderChime() {
    unlockReminderAudio();
    if (!reminderAudioCtx) return;
    if (reminderAudioCtx.state === 'suspended') {
        try { await reminderAudioCtx.resume(); } catch (e) { /* still locked without a fresh gesture, nothing more we can do here */ }
    }
    if (reminderAudioCtx.state !== 'running') return;
    const now = reminderAudioCtx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // דו-מי-סול: אקורד עולה נעים
    notes.forEach((freq, i) => {
        const osc = reminderAudioCtx.createOscillator();
        const gain = reminderAudioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.16;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.22, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.65);
        osc.connect(gain).connect(reminderAudioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.7);
    });
}

function testReminderChime() {
    playReminderChime();
    showAppToast(t('toast_test_chime'));
}

function reminderFiredKey(rowId) {
    return `weekwise_reminder_fired_${rowId}`;
}

// שומר על כך שלא יתקיימו שתי קריאות חופפות בו-זמנית: אם checkReminders() נקרא
// שוב (למשל ה-interval של 20 שניות מתנגש עם visibilitychange) לפני שהקריאה
// הקודמת סיימה לסמן reminderFiredKey, שתי הקריאות עלולות לראות "עדיין לא הופעל"
// ולהציג את אותה תזכורת פעמיים - זה בדיוק מה שגרם לתזכורת "לחזור מיד" אחרי סגירה.
let checkRemindersInProgress = false;

async function checkReminders() {
    if (checkRemindersInProgress) return;
    if (!supabaseClient || !currentUserId) return;
    checkRemindersInProgress = true;
    try {
        const now = new Date();
        const todayDbDay = dbDaysMap[now.getDay()];
        const todayStr = getLocalDateString(now);
        const { data } = await supabaseClient.from('weekly_schedule')
            .select('id, time_of_day, task_title, reminder_minutes, reminder_text')
            .eq('user_id', currentUserId)
            .eq('day_of_week', todayDbDay)
            .gt('reminder_minutes', 0);
        if (!data) return;
        data.forEach(item => {
            if (!item.time_of_day) return;
            if (localStorage.getItem(reminderFiredKey(item.id)) === todayStr) return;
            const [h, m] = item.time_of_day.split(':').map(Number);
            if (isNaN(h) || isNaN(m)) return;
            const taskDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0);
            const triggerDate = new Date(taskDate.getTime() - item.reminder_minutes * 60000);
            // בכוונה בלי חסם עליון: אם האפליקציה הייתה סגורה/ברקע כשהגיע הזמן, עדיף
            // להציג את התזכורת באיחור (פעם אחת בלבד, בזכות reminderFiredKey) מאשר לפספס אותה.
            if (now >= triggerDate) {
                localStorage.setItem(reminderFiredKey(item.id), todayStr);
                fireReminder({ taskTitle: item.task_title, text: item.reminder_text });
            }
        });
    } finally {
        checkRemindersInProgress = false;
    }
}

function fireReminder(rem) {
    playReminderChime();
    showReminderToast(rem.taskTitle, rem.text);
    showBrowserNotification(rem.taskTitle, rem.text);
}

function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
        Notification.requestPermission().then((permission) => {
            if (permission === 'granted') registerPushNotifications();
        });
    } else if (Notification.permission === 'granted') {
        registerPushNotifications();
    }
}

// --- Push ברקע: מנוי Web Push אמיתי, כדי שתזכורות יתריעו גם כשהאפליקציה סגורה ---
// מפתח VAPID ציבורי בלבד - המפתח הפרטי חי אך ורק כ-secret בפונקציית ה-Edge
// בצד שרת (ראו supabase/functions/send-due-reminders), לעולם לא בקוד לקוח.
const VAPID_PUBLIC_KEY = 'BFSnO1uByNjAM_704-SH7BPRsZGeguMolXHpwAeLISjya09iN5wS4l6UBY-AjBTapVg63kAzOGX6jWoi91DldSo';

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
}

async function registerPushNotifications() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission !== 'granted') return;
    try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
        }
        await savePushSubscription(subscription);
    } catch (err) {
        console.error('Push subscription failed:', err);
    }
}

async function savePushSubscription(subscription) {
    if (!supabaseClient || !currentUserId) return;
    const json = subscription.toJSON();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    const { data: existing } = await supabaseClient.from('push_subscriptions').select('id').eq('endpoint', json.endpoint).maybeSingle();
    const payload = {
        user_id: currentUserId,
        username: currentUsername,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth,
        timezone: timezone
    };
    if (existing) await supabaseClient.from('push_subscriptions').update(payload).eq('id', existing.id);
    else await supabaseClient.from('push_subscriptions').insert(payload);
}

function showBrowserNotification(taskTitle, text) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const notification = new Notification(`${t('reminder_prefix')}${taskTitle || t('reminder_default_task')}`, {
        body: text || t('reminder_default_text'),
        icon: 'icon.png',
        tag: `weekwise-reminder-${taskTitle}-${Date.now()}`
    });
    notification.onclick = () => { window.focus(); notification.close(); };
    notification.onclose = () => {}; // סגירה מפורשת ומטופלת - לא אמורה לגרום להצגה חוזרת
}

let reminderToastTimeout = null;
function showReminderToast(taskTitle, text) {
    const toast = document.getElementById('reminder-toast');
    if (!toast) return;
    toast.querySelector('.reminder-toast-title').textContent = `${t('reminder_prefix')}${taskTitle || t('reminder_default_task')}`;
    toast.querySelector('.reminder-toast-text').textContent = text || t('reminder_default_text');
    toast.classList.add('show');
    clearTimeout(reminderToastTimeout);
    reminderToastTimeout = setTimeout(dismissReminderToast, 8000);
}

function dismissReminderToast() {
    const toast = document.getElementById('reminder-toast');
    if (toast) toast.classList.remove('show');
}
async function clearSingleSlot(day, slot) { await supabaseClient.from('weekly_schedule').delete().eq('user_id', currentUserId).eq('day_of_week', day).eq('slot_number', slot); loadWeeklySchedule(); }
// איפוס מבני מלא, לא רק ניקוי תוכן: קודם רק מחקנו את שורות ה-DB (התוכן),
// בלי לגעת ב-daySlotsConfig עצמו - כך שאם ליום מסוים כבר חסרה משבצת בסיס
// (מחיקה ידנית ישנה, נתונים משלב עם אורך ברירת מחדל אחר), "ניקוי" לא היה
// מתקן את זה, רק את התוכן. עכשיו כל יום חוזר בפירוש בדיוק לרשת הבסיס הנוכחית
// (defaultDaySlotNumbers) - גם שורות מותאמות אישית שנוספו נעלמות, וגם משבצת
// בסיס שהייתה חסרה חוזרת - "איפוס מלא לתבנית הפריסטינה", כמו שהתבקש
async function clearEntireWeeklySchedule() {
    await supabaseClient.from('weekly_schedule').delete().eq('user_id', currentUserId);
    dbDaysMap.forEach(day => { daySlotsConfig[day] = defaultDaySlotNumbers(); });
    saveDaySlotsConfig();
    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();
}

async function loadDailyNutrition(date) {
    if (!supabaseClient) return;
    document.querySelectorAll('.meal-row').forEach(row => {
        row.querySelector('.food-input').value = '';
        row.querySelector('.calories-input').value = '';
    });
    document.getElementById('calories-today').innerText = '0';
    const { data } = await supabaseClient.from('calorie_tracker').select('*').eq('user_id', currentUserId).eq('date', date);
    if (!data) return;
    let total = 0;
    data.forEach(item => {
        const row = document.querySelector(`[data-meal="${item.meal_type}"]`);
        if (row) { row.querySelector('.food-input').value = item.food_description; row.querySelector('.calories-input').value = item.calories; total += item.calories; }
    });
    document.getElementById('calories-today').innerText = total;
}

// --- זיהוי ארוחה מתמונה (פרימיום בלבד): AI אמיתי בעל יכולת ראייה, דרך אותו
// דפוס פרוקסי בצד שרת כמו סריקת מתכונים - מזהה פריטי מזון וקלוריות ומכניס
// אותם ישירות לשורות הריקות הבאות במעקב הארוחות היומי, בלי הקלדה ידנית ---
function openMealPhotoScan() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    document.getElementById('meal-photo-input').click();
}

function showMealPhotoLoading() {
    const el = document.getElementById('meal-photo-loading');
    if (el) el.classList.remove('hidden');
}

function hideMealPhotoLoading() {
    const el = document.getElementById('meal-photo-loading');
    if (el) el.classList.add('hidden');
}

async function handleMealPhotoSelected(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    if (!file.type.startsWith('image/')) { showAppToast(t('meal_photo_unsupported_type'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }

    const loadingTimer = setTimeout(showMealPhotoLoading, 5000);
    try {
        const { mediaType, base64 } = await fileToBase64(file);
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) { showAppToast(t('error_not_connected'), 'error'); return; }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-meal-photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ imageBase64: base64, mediaType })
        });
        const result = await res.json();

        if (res.status === 402 || result.error === 'premium_required') { openPremiumUpgradeModal(); return; }
        if (!res.ok || result.error || !result.items || !result.items.length) {
            showAppToast(t('meal_photo_failed'), 'error');
            return;
        }

        const emptyRows = Array.from(document.querySelectorAll('.meal-row')).filter(row => !row.querySelector('.food-input').value.trim());
        result.items.slice(0, emptyRows.length).forEach((item, index) => {
            emptyRows[index].querySelector('.food-input').value = item.food_name || '';
            emptyRows[index].querySelector('.calories-input').value = item.calories || 0;
        });

        await saveNutrition();
        showAppToast(t('meal_photo_success'));
    } catch (err) {
        showAppToast(t('meal_photo_failed'), 'error');
    } finally {
        clearTimeout(loadingTimer);
        hideMealPhotoLoading();
    }
}

async function saveNutrition() {
    const date = document.getElementById('selected-date').value;
    const mealRows = document.querySelectorAll('.meal-row');
    for (let row of mealRows) {
        const type = row.getAttribute('data-meal');
        const food = row.querySelector('.food-input').value;
        const cals = parseInt(row.querySelector('.calories-input').value) || 0;
        const { data: existing } = await supabaseClient.from('calorie_tracker').select('id').eq('user_id', currentUserId).eq('date', date).eq('meal_type', type).maybeSingle();
        if (existing) {
            await supabaseClient.from('calorie_tracker').update({ food_description: food, calories: cals }).eq('id', existing.id);
        } else {
            await supabaseClient.from('calorie_tracker').insert({ username: currentUsername, user_id: currentUserId, date: date, meal_type: type, food_description: food, calories: cals });
        }
    }
    await loadDailyNutrition(date);
    loadStats();
    showAppToast(t('nutrition_save_success'));
}

async function copyFromYesterday() {
    if (!supabaseClient) return;
    const currentDate = document.getElementById('selected-date').value;
    if (!currentDate) return;
    const prevDateObj = new Date(`${currentDate}T00:00:00`);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDate = getLocalDateString(prevDateObj);
    const { data } = await supabaseClient.from('calorie_tracker').select('*').eq('user_id', currentUserId).eq('date', prevDate);
    if (!data || data.length === 0) { showAppToast(t('nutrition_copy_not_found'), 'error'); return; }
    data.forEach(item => {
        const row = document.querySelector(`[data-meal="${item.meal_type}"]`);
        if (row) { row.querySelector('.food-input').value = item.food_description; row.querySelector('.calories-input').value = item.calories; }
    });
    updateLiveCaloriesToday();
    showAppToast(t('nutrition_copy_success'));
}
async function loadStats() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('calorie_tracker').select('date, calories').eq('user_id', currentUserId);
    if (!data) return;

    const now = new Date();
    const todayStr = getLocalDateString(now);
    const sunday = new Date(now); sunday.setDate(now.getDate() - now.getDay());
    const weekStartStr = getLocalDateString(sunday);
    const saturday = new Date(sunday); saturday.setDate(sunday.getDate() + 6);
    const weekEndStr = getLocalDateString(saturday);
    const monthPrefix = todayStr.slice(0, 7);

    let weekly = 0, monthly = 0;
    data.forEach(item => {
        const cals = Number(item.calories) || 0;
        if (item.date >= weekStartStr && item.date <= weekEndStr) weekly += cals;
        if (item.date && item.date.startsWith(monthPrefix)) monthly += cals;
    });
    document.getElementById('calories-weekly').innerText = weekly;
    document.getElementById('calories-monthly').innerText = monthly;
}
async function deleteCenterItem(id, type) { await supabaseClient.from('my_center_tasks').delete().eq('id', id); loadCenterItems(type); }
async function addProgressTarget() {
    if (!supabaseClient) return;
    const nameInput = document.getElementById('progress-name-input');
    const targetInput = document.getElementById('progress-target-input');
    const name = nameInput.value.trim();
    const target = parseInt(targetInput.value) || 0;
    if (!name || target <= 0) return;
    await supabaseClient.from('weekly_progress_targets').insert({ username: currentUsername, user_id: currentUserId, target_name: name, target_val: target, current_val: 0 });
    nameInput.value = '';
    targetInput.value = '';
    loadProgressTargets();
}

async function loadProgressTargets() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('weekly_progress_targets').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true });
    if (!data) return;
    const container = document.getElementById('progress-container');
    container.innerHTML = '';
    data.forEach(item => {
        const pct = item.target_val > 0 ? Math.min(100, Math.round((item.current_val / item.target_val) * 100)) : 0;
        const row = document.createElement('div');
        row.className = 'progress-row';
        row.innerHTML = `
            <div class="progress-info">
                <span>${item.target_name}</span>
                <div class="progress-counter">
                    <button class="btn-counter" onclick="changeProgressVal('${item.id}', -1)">-</button>
                    <span>${item.current_val} / ${item.target_val}</span>
                    <button class="btn-counter" onclick="changeProgressVal('${item.id}', 1)">+</button>
                    <button class="btn-delete-item" onclick="deleteProgressTarget('${item.id}')">❌</button>
                </div>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill ${pct >= 100 ? 'completed' : ''}" style="width: ${pct}%;"></div></div>
        `;
        container.appendChild(row);
    });
}

async function changeProgressVal(id, change) {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('weekly_progress_targets').select('current_val, target_val').eq('id', id).maybeSingle();
    if (!data) return;
    let newVal = data.current_val + change;
    if (newVal < 0) newVal = 0;
    if (newVal > data.target_val) newVal = data.target_val;
    await supabaseClient.from('weekly_progress_targets').update({ current_val: newVal }).eq('id', id);
    loadProgressTargets();
}
async function deleteProgressTarget(id) { await supabaseClient.from('weekly_progress_targets').delete().eq('id', id); loadProgressTargets(); }
async function saveNewWeightRecord() { const w = document.getElementById('new-weight-val').value, d = document.getElementById('new-weight-date').value; await supabaseClient.from('weight_tracker').insert({ username: currentUsername, user_id: currentUserId, weight_date: d, weight_value: w }); loadWeightHistory(); }
async function loadWeightHistory() { const { data } = await supabaseClient.from('weight_tracker').select('*').eq('user_id', currentUserId).order('weight_date', { ascending: false }); const list = document.getElementById('weight-history-list'); if (!data) return; list.innerHTML = ''; data.forEach(item => list.innerHTML += `<li>${item.weight_value} ק״ג (${item.weight_date}) <button onclick="deleteWeightRecord('${item.id}')">❌</button></li>`); }
async function deleteWeightRecord(id) { await supabaseClient.from('weight_tracker').delete().eq('id', id); loadWeightHistory(); }

// --- מד צעדים יומי: תצוגה בלבד, מקור הנתונים יהיה סנכרון אוטומטי עתידי ---
// (Google Fit / Apple Health) דרך אפליקציה נייטיבית - אין קלט ידני יותר.
async function loadDailySteps(date) {
    if (!supabaseClient || !currentUserId) return;
    document.getElementById('steps-today').innerText = '0';
    const { data, error } = await supabaseClient.from('step_tracker').select('*').eq('user_id', currentUserId).eq('step_date', date).maybeSingle();
    if (error) { showAppToast(t('error_loading_steps') + error.message, 'error'); return; }
    if (data) {
        document.getElementById('steps-today').innerText = data.step_count;
    }
    loadStepStats();
}

function connectHealthData() {
    showAppToast(t('steps_connect_toast'), 'error');
}

async function loadStepStats() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('step_tracker').select('step_date, step_count').eq('user_id', currentUserId);
    if (!data) return;
    const now = new Date();
    const sunday = new Date(now); sunday.setDate(now.getDate() - now.getDay());
    const weekStartStr = getLocalDateString(sunday);
    const saturday = new Date(sunday); saturday.setDate(sunday.getDate() + 6);
    const weekEndStr = getLocalDateString(saturday);
    let weekly = 0;
    data.forEach(item => {
        if (item.step_date >= weekStartStr && item.step_date <= weekEndStr) weekly += Number(item.step_count) || 0;
    });
    document.getElementById('steps-weekly').innerText = weekly;
}

// --- "AI" חוקי-דטרמיניסטי: מוסיף טקסט חופשי כפתק חדש בלשונית הפתקים בלבד ---
// אין מפתח API/LLM אמיתי - הטקסט מתווסף ישירות לרשימת הפתקים, ללא נגיעה
// בלוח הזמנים השבועי. מוחלף בעתיד ב-AI אמיתי מאחורי פרוקסי בצד שרת.
async function handleAIQuickAdd() {
    const input = document.getElementById('ai-quick-add-input');
    const text = input.value.trim();
    if (!text) { showAppToast(t('notes_ai_empty'), 'error'); return; }

    await insertCenterItemDirect('weekly', text);
    showAppToast(t('notes_ai_added'));
    input.value = '';
    closeModal('modal-ai-quick-add');
}
