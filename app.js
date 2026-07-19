const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt';
let supabaseClient;
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayNameKeys = ['day_sunday', 'day_monday', 'day_tuesday', 'day_wednesday', 'day_thursday', 'day_friday', 'day_saturday'];
let defaultHours = ['06:00', '09:00', '12:00', '15:00', '18:00', '21:00'];
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
    document.getElementById('btn-save-hours').addEventListener('click', () => {
        saveDefaultHours();
        closeModal('modal-settings-hours');
    });
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
        li.innerHTML = `
            <button class="btn-complete-item" onclick="toggleTaskStatus('${item.id}', ${item.is_completed}, '${type}')">
                ${item.is_completed ? '✓' : ''}
            </button>
            <span style="text-decoration: ${item.is_completed ? 'line-through' : 'none'}; color: ${item.is_completed ? '#666' : '#fff'}; flex: 1; text-align: start; margin-inline-start: 10px; font-weight: 500;">
                ${item.content}
            </span>
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

async function loadPresetManageList() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('meal_presets').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true });
    cachedPresets = data || [];
    const list = document.getElementById('preset-manage-list');
    if (!list) return;
    list.innerHTML = '';
    cachedPresets.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="preset-manage-name">${item.food_name} (${item.calories})</span>
            <div class="preset-manage-actions">
                <button class="btn-edit-item" onclick="editPreset('${item.id}')">✏️</button>
                <button class="btn-delete-item" onclick="deletePreset('${item.id}')">🗑️</button>
            </div>
        `;
        list.appendChild(li);
    });
    updatePresetLimitHint();
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
        loadRecipes(),
        loadAiUsage(),
        loadPremiumStatus(),
        loadColorTheme(),
        loadMonthlyGoal()
    ]);
    loadAllCenterItems();
    hideAppLoadingOverlay();
    applyPwaShortcutDeepLink();
    initDraggableAiFab();
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
function openCenterAdder(type) {
    pendingCenterItemType = type;
    const input = document.getElementById('center-item-input');
    input.value = '';
    openModal('modal-add-center-item');
    setTimeout(() => input.focus(), 150);
}

function submitCenterItem() {
    const input = document.getElementById('center-item-input');
    const text = input.value.trim();
    closeModal('modal-add-center-item');
    if (!text || !pendingCenterItemType) return;
    insertCenterItemDirect(pendingCenterItemType, text);
    pendingCenterItemType = null;
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
    const emojiEl = document.getElementById('home-greeting-emoji');
    if (!textEl || !dateEl || !emojiEl) return;
    const hour = new Date().getHours();
    let key = 'home_greeting_morning', emoji = '☀️';
    if (hour >= 12 && hour < 18) { key = 'home_greeting_afternoon'; emoji = '🌤️'; }
    else if (hour >= 18 || hour < 5) { key = 'home_greeting_evening'; emoji = '🌙'; }
    textEl.textContent = t(key);
    emojiEl.textContent = emoji;
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
    }));
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
    // ה-IntersectionObserver של לוח הימים מחשב גובה לפי scrollHeight בזמן אמת -
    // כשהתצוגה הייתה display:none הגובה שחושב היה 0, אז מחשבים מחדש עכשיו שהיא גלויה
    if (sectionId === 'schedule-section' && subviewId === 'myweek') updateActiveDayPageHeight();
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
    const validTargets = ['schedule-section', 'my-center-section', 'nutrition-section', 'recipes-section'];
    if (view && validTargets.includes(view)) switchToTab(view);
}

// --- בועת ה-AI הצפה ניתנת לגרירה חופשית, כדי שהמשתמש יוכל למקם אותה איפה שלא
// תחסום תוכן. המיקום נשמר per-device (כמו defaultHours/daySlotsConfig) ונשחזר בכל טעינה. ---
function aiFabPositionKey() {
    return `weekwise_ai_fab_position_${currentUserId}`;
}

function initDraggableAiFab() {
    const el = document.getElementById('btn-ai-fab');
    const wrapper = document.querySelector('.phone-wrapper');
    if (!el || !wrapper) return;

    const DRAG_THRESHOLD = 6;
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    let dragged = false;
    let isDown = false;

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function applyPosition(left, top) {
        const wrapperRect = wrapper.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const maxLeft = Math.max(0, wrapperRect.width - elRect.width);
        const maxTop = Math.max(0, wrapperRect.height - elRect.height);
        const clampedLeft = clamp(left, 0, maxLeft);
        const clampedTop = clamp(top, 0, maxTop);
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        el.style.left = `${clampedLeft}px`;
        el.style.top = `${clampedTop}px`;
        return { left: clampedLeft, top: clampedTop };
    }

    function restoreSavedPosition() {
        const raw = localStorage.getItem(aiFabPositionKey());
        if (!raw) return;
        try {
            const pos = JSON.parse(raw);
            if (typeof pos.left === 'number' && typeof pos.top === 'number') applyPosition(pos.left, pos.top);
        } catch {}
    }

    // בכוונה לא תלוי ב-setPointerCapture: בחלק מגרסאות Safari לנייד היא זורקת
    // חריגה או מתנהגת בצורה לא אמינה, ואם זה קורה לפני שמוסיפים את מחלקת
    // ה-dragging, הגרירה כולה נעצרת בשקט. האזנה על document ל-move/up במקום
    // רק על האלמנט עצמו היא הגישה החסינה יותר - לא תלויה בזה שהמצביע "נתפס".
    el.addEventListener('pointerdown', (e) => {
        isDown = true;
        dragged = false;
        const wrapperRect = wrapper.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        startLeft = elRect.left - wrapperRect.left;
        startTop = elRect.top - wrapperRect.top;
        startX = e.clientX;
        startY = e.clientY;
        try { el.setPointerCapture(e.pointerId); } catch {}
        el.classList.add('dragging');
        e.preventDefault();
    });

    document.addEventListener('pointermove', (e) => {
        if (!isDown) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!dragged && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) dragged = true;
        if (dragged) applyPosition(startLeft + dx, startTop + dy);
    });

    function endDrag() {
        if (!isDown) return;
        isDown = false;
        el.classList.remove('dragging');
        if (dragged) {
            const wrapperRect = wrapper.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const finalPos = { left: elRect.left - wrapperRect.left, top: elRect.top - wrapperRect.top };
            localStorage.setItem(aiFabPositionKey(), JSON.stringify(finalPos));
        }
    }

    document.addEventListener('pointerup', endDrag);
    document.addEventListener('pointercancel', endDrag);

    el.addEventListener('click', () => {
        if (dragged) { dragged = false; return; }
        openModal('modal-ai-quick-add');
    });

    restoreSavedPosition();
    window.addEventListener('resize', restoreSavedPosition);
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
    return [1, 2, 3, 4, 5, 6];
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

async function removeDaySlot(day, slot) {
    if (!daySlotsConfig[day]) daySlotsConfig[day] = defaultDaySlotNumbers();
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

function addDaySlot(day) {
    if (!daySlotsConfig[day]) daySlotsConfig[day] = defaultDaySlotNumbers();
    const nums = daySlotsConfig[day];
    const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
    daySlotsConfig[day] = [...nums, nextNum];
    saveDaySlotsConfig();
    buildWeeklyScheduleAccordionUI();
    loadWeeklySchedule();
}

// --- מתכנן לו"ז חכם (פרימיום בלבד): AI אמיתי מפרש תיאור חופשי לכמה אירועים
// חוזרים בבת אחת, ומכניס כל אחד למשבצת פנויה (או שורה חדשה) ביום המתאים ---
function openAiSchedulePlannerModal() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    document.getElementById('ai-schedule-input').value = '';
    openModal('modal-ai-schedule-planner');
}

function showScheduleAiLoading() {
    const el = document.getElementById('schedule-ai-loading');
    if (el) el.classList.remove('hidden');
}

function hideScheduleAiLoading() {
    const el = document.getElementById('schedule-ai-loading');
    if (el) el.classList.add('hidden');
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
        if (!token) { showAppToast(t('error_not_connected'), 'error'); return; }

        const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-schedule-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text })
        });
        const result = await res.json();

        if (res.status === 402 || result.error === 'premium_required') { openPremiumUpgradeModal(); return; }
        if (!res.ok || result.error || !result.events || !result.events.length) {
            showAppToast(t('schedule_ai_failed'), 'error');
            return;
        }

        // מקבצים את האירועים שחולצו לפי יום, כדי להקצות משבצת פנויה (או שורה
        // חדשה) לכל אחד בלי שיתנגשו זה בזה על אותה משבצת
        const byDay = {};
        result.events.forEach(ev => {
            if (!dbDaysMap.includes(ev.day_of_week)) return;
            if (!byDay[ev.day_of_week]) byDay[ev.day_of_week] = [];
            byDay[ev.day_of_week].push(ev);
        });

        Object.keys(byDay).forEach(day => {
            if (!daySlotsConfig[day]) daySlotsConfig[day] = defaultDaySlotNumbers();
            const daySlotEls = Array.from(document.querySelectorAll(`.slot-input-group[data-day="${day}"]`));
            const emptySlotNums = daySlotEls.filter(el => !el.querySelector('.slot-task').value.trim()).map(el => parseInt(el.getAttribute('data-slot')));
            byDay[day].forEach((ev, index) => {
                if (index < emptySlotNums.length) {
                    ev._slotNum = emptySlotNums[index];
                } else {
                    const nums = daySlotsConfig[day];
                    const nextNum = nums.length ? Math.max(...nums) + 1 : 1;
                    daySlotsConfig[day] = [...nums, nextNum];
                    ev._slotNum = nextNum;
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
                slotEl.querySelector('.slot-time').value = ev.time;
                slotEl.querySelector('.slot-task').value = ev.task_title;
                await saveScheduleSlot(day, ev._slotNum);
            }
        }

        input.value = '';
        closeModal('modal-ai-schedule-planner');
        showAppToast(t('schedule_ai_success'));
    } catch (err) {
        showAppToast(t('schedule_ai_failed'), 'error');
    } finally {
        clearTimeout(loadingTimer);
        hideScheduleAiLoading();
    }
}

function loadCustomDefaultHours() {
    const raw = localStorage.getItem(defaultHoursKey());
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 6) defaultHours = parsed;
    } catch {}
}

function openHoursSettingsModal() {
    for (let i = 1; i <= 6; i++) {
        document.getElementById(`settings-hour-${i}`).value = defaultHours[i - 1] || '';
    }
    openModal('modal-settings-hours');
}

function saveDefaultHours() {
    const newHours = [];
    for (let i = 1; i <= 6; i++) {
        const val = document.getElementById(`settings-hour-${i}`).value.trim();
        newHours.push(val || defaultHours[i - 1] || '');
    }
    defaultHours = newHours;
    localStorage.setItem(defaultHoursKey(), JSON.stringify(newHours));
    buildWeeklyScheduleAccordionUI();
    loadWeeklySchedule();
}

function buildWeeklyScheduleAccordionUI() {
    const container = document.getElementById('accordion-container');
    const tabsStrip = document.getElementById('day-tabs-strip');
    if (!container) return;
    loadDaySlotsConfig();
    container.innerHTML = '';
    if (tabsStrip) tabsStrip.innerHTML = '';
    dbDaysMap.forEach((dbDay, dayIndex) => {
        const dayName = getDayName(dayIndex);
        const dateStr = getFormattedDateForDay(dayIndex);

        if (tabsStrip) {
            const tab = document.createElement('button');
            tab.type = 'button';
            tab.className = 'day-tab' + (dayIndex === 0 ? ' active' : '');
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
        // חשוב: משתמשים ב-!== undefined ולא ב-truthy/length, כי מערך ריק ([])
        // הוא falsy מבחינת .length - יום שהמשתמש מחק ממנו את כל השורות היה
        // "נופל" בטעות בחזרה ל-10 שורות ברירת המחדל בכל בנייה מחדש של הלוח.
        const slotNumbers = daySlotsConfig[dbDay] !== undefined ? daySlotsConfig[dbDay] : defaultDaySlotNumbers();
        slotNumbers.forEach(i => {
            slotsHTML += `<div class="slot-input-group" data-day="${dbDay}" data-slot="${i}"><span class="slot-num-label">${i}</span><input type="text" value="${defaultHours[i-1] || ''}" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})"><input type="text" class="slot-task" onchange="saveScheduleSlot('${dbDay}', ${i})"><button class="btn-delete-slot" onclick="removeDaySlot('${dbDay}', ${i})" title="${t('schedule_remove_row_title')}">❌</button></div>`;
        });
        const gridHiddenClass = slotNumbers.length ? '' : ' hidden';
        pageDiv.innerHTML = `<div class="day-page-header">${dateStr} | ${dayName}</div><div class="slots-grid${gridHiddenClass}">${slotsHTML}</div><div class="day-page-empty${slotNumbers.length ? ' hidden' : ''}">${t('schedule_day_empty_hint')}</div><button type="button" class="btn-add-day-slot" onclick="addDaySlot('${dbDay}')">➕ ${t('schedule_add_row_btn')}</button>`;
        container.appendChild(pageDiv);
    });
    setupDayScrollObserver();
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
    container.scrollBy({ left: delta, behavior: 'smooth' });
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
        const dbDay = activeTab ? activeTab.id.replace('daytab-', '') : dbDaysMap[0];
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
    await pruneEmptyExcessSlots();
}

// שורות "יתומות" מעבר למספר שורות ברירת המחדל הנוכחי (נשארו ב-daySlotsConfig
// המקומי מברירת מחדל ישנה עם יותר שורות, למשל 10) ושאין בהן שום טקסט משימה
// מוסרות אוטומטית מה-DOM, מה-config המקומי וגם מהשרת. שורה עודפת שהמשתמש כן
// מילא בה תוכן אמיתי (הוספה מכוונת דרך "+") לעולם לא נמחקת - רק כאלה שריקות לגמרי.
async function pruneEmptyExcessSlots() {
    if (!supabaseClient || !currentUserId) return;
    const defaultCount = defaultDaySlotNumbers().length;
    let anyPruned = false;
    for (const day of dbDaysMap) {
        const nums = daySlotsConfig[day] !== undefined ? daySlotsConfig[day] : defaultDaySlotNumbers();
        const staleNums = [];
        const keepNums = nums.filter(n => {
            if (n <= defaultCount) return true;
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

async function saveScheduleSlot(day, slot) {
    if (!supabaseClient) return;
    const slotEl = document.querySelector(`[data-day="${day}"][data-slot="${slot}"]`);
    const timeVal = slotEl.querySelector('.slot-time').value;
    const taskVal = slotEl.querySelector('.slot-task').value.trim();
    const { data: existing } = await supabaseClient.from('weekly_schedule').select('id').eq('user_id', currentUserId).eq('day_of_week', day).eq('slot_number', slot).maybeSingle();
    let error;
    if (existing) ({ error } = await supabaseClient.from('weekly_schedule').update({ time_of_day: timeVal, task_title: taskVal }).eq('id', existing.id));
    else ({ error } = await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, user_id: currentUserId, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal }));
    if (error) showAppToast(t('error_adding_item') + error.message, 'error');
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
}

async function deleteCalendarEvent(id) {
    await supabaseClient.from('calendar_events').delete().eq('id', id);
    loadCalendarEvents();
}

async function deleteRecurringSeries(groupId) {
    await supabaseClient.from('calendar_events').delete().eq('recurrence_group_id', groupId);
    loadCalendarEvents();
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
    openModal('modal-add-recipe');
}

async function saveRecipe() {
    const title = document.getElementById('recipe-title-input').value.trim();
    const category = document.getElementById('recipe-category-input').value;
    const calories = parseInt(document.getElementById('recipe-calories-input').value) || 0;
    const ingredients = document.getElementById('recipe-ingredients-input').value.trim();
    const instructions = document.getElementById('recipe-instructions-input').value.trim();
    if (!title) { showAppToast(t('recipe_title_required'), 'error'); return; }
    if (!category) { showAppToast(t('recipe_category_required'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }

    const payload = { title, category, calories, ingredients, instructions };
    let error;
    if (editingRecipeId) {
        ({ error } = await supabaseClient.from('recipes').update(payload).eq('id', editingRecipeId));
    } else {
        ({ error } = await supabaseClient.from('recipes').insert({ username: currentUsername, user_id: currentUserId, ...payload }));
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
    // מותאם אישית: אין המרה/עיצוב "חכם" של הטקסט - הוא חופשי לגמרי, רק מוצג
    // לצד ההתקדמות המספרית האמיתית (current_value/target_value, שתמיד נשארים מספרים)
    return `${goal.goal_name}: ${cur} / ${goal.target_value}`;
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
    if (goal.goal_type === 'weight') return currentValue <= goal.target_value;
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
                    <span>${goal.goal_type === 'custom' ? progressText : `${goal.goal_name} — ${progressText}`}</span>
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
        <div class="monthly-goal-values">${progressText}</div>
        ${trophyHtml}
        ${isCurrentMonth && goal.goal_type === 'custom' ? `<button class="btn-secondary" style="margin-top: 8px;" onclick="incrementCustomGoal()">${t('monthly_goal_increment_btn')}</button>` : ''}
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
    openModal('modal-set-monthly-goal');
}

async function saveMonthlyGoal() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    const name = document.getElementById('monthly-goal-name-input').value.trim();
    const type = document.getElementById('monthly-goal-type-input').value;
    const target = parseFloat(document.getElementById('monthly-goal-target-input').value);
    if (!name || isNaN(target)) { showAppToast(t('calendar_event_missing_fields'), 'error'); return; }

    if (editingMonthlyGoal && cachedMonthlyGoal) {
        const { error } = await supabaseClient.from('monthly_goals').update({ goal_name: name, goal_type: type, target_value: target }).eq('id', cachedMonthlyGoal.id);
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
        target_value: target, starting_value: startingValue, current_value: 0,
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

async function incrementCustomGoal() {
    if (!cachedMonthlyGoal) return;
    const newValue = (cachedMonthlyGoal.current_value || 0) + 1;
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
        summaryEl.textContent = goal.goal_type === 'custom' ? progressText : `${goal.goal_name} — ${progressText}`;
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

    showAppToast(t('recipe_scan_in_progress'));
    // אנימציית טעינה ייעודית מוצגת רק אם הסריקה לוקחת יותר מ-5 שניות, כדי לשמור
    // על ממשק נקי בסריקות מהירות - ה-timeout מבוטל אם הסריקה מסתיימת קודם לכן.
    const loadingTimer = setTimeout(showRecipeScanLoading, 5000);
    try {
        const { mediaType, base64 } = await fileToBase64(file);
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) { showAppToast(t('error_not_connected'), 'error'); return; }

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
        if (!res.ok || result.error || !result.recipe) {
            showAppToast(t('recipe_scan_failed'), 'error');
            return;
        }

        const recipe = result.recipe;
        document.getElementById('recipe-title-input').value = recipe.title || '';
        if (recipe.category) document.getElementById('recipe-category-input').value = recipe.category;
        document.getElementById('recipe-calories-input').value = recipe.calories || '';
        document.getElementById('recipe-ingredients-input').value = recipe.ingredients || '';
        document.getElementById('recipe-instructions-input').value = recipe.instructions || '';
        if (typeof result.scansUsed === 'number') cachedImageScansUsed = result.scansUsed;
        showAppToast(t('recipe_scan_success'));
    } catch (err) {
        showAppToast(t('recipe_scan_failed'), 'error');
    } finally {
        clearTimeout(loadingTimer);
        hideRecipeScanLoading();
    }
}

function showRecipeScanLoading() {
    const el = document.getElementById('recipe-scan-loading');
    if (el) el.classList.remove('hidden');
}

function hideRecipeScanLoading() {
    const el = document.getElementById('recipe-scan-loading');
    if (el) el.classList.add('hidden');
}

// --- מנתח חוקי-דטרמיניסטי (אין LLM אמיתי): חילוץ מילולי-קפדני, ללא הוספת טקסט/הקשר משלו ---
// מזהה כותרות "מצרכים/הוראות" גם באמצע שורה (עם נקודתיים), מסנן שורות "רעש" טיפוסיות
// מאתרי מתכונים (זמן הכנה, דירוג, שיתוף וכו'), ובהיעדר כותרות - ממיין כל שורה לפי
// דפוסי כמות/יחידות מול פעלי בישול, בלי לנחש או להמציא תוכן שלא הופיע בטקסט המקורי.
const RECIPE_JUNK_LINE_RE = /^(print|share|save|rate this recipe|jump to recipe|prep\s*time|cook\s*time|total\s*time|servings?|yield|nutrition|difficulty|course|cuisine|advertisement|★|https?:\/\/|שתפו|הדפיסו|שמרו|דרגו|זמן הכנה|זמן בישול|מספר מנות|קושי)/i;
const RECIPE_INGREDIENT_WORD_RE = /^([\d½¼¾⅓⅔]|cup|cups|tbsp|tablespoon|tsp|teaspoon|gram|grams|\bg\b|kg|ml|\bl\b|oz|ounce|clove|cloves|pinch|slice|slices|כוס|כפית|כף|גרם|ק"ג|ג'|מ"ל|קורט|שן|פרוסות|יחידות)/i;
const RECIPE_INSTRUCTION_WORD_RE = /^(step\s*\d|\d+[.)]\s|mix|stir|bake|heat|add|pour|chop|preheat|whisk|combine|serve|cook|boil|fry|ערבבו|אפו|בשלו|הוסיפו|חממו|קצצו|טגנו|ערבבי|הכינו|קרמלו|בחשו)/i;

function parseRecipeText(raw) {
    const rawLines = raw.split('\n').map(l => l.trim()).filter(Boolean);
    const lines = rawLines.filter(l => !RECIPE_JUNK_LINE_RE.test(l));

    const ingredientHeaderRe = /^(ingredients?|מצרכים|מרכיבים|רכיבים|ingr[ée]dients?|المكونات)\s*:?\s*(.*)$/i;
    const instructionHeaderRe = /^(instructions?|directions?|method|preparation|הוראות(?:\s*(?:ה)?הכנה)?|אופן\s*(?:ה)?הכנה|طريقة\s*التحضير|pr[ée]paration)\s*:?\s*(.*)$/i;

    const title = lines[0] || '';
    const caloriesMatch = raw.match(/(\d{2,5})\s*(kcal|cal|calories|קלוריות|سعرة)/i);
    const calories = caloriesMatch ? parseInt(caloriesMatch[1]) : null;

    const ingredientStart = lines.findIndex(l => ingredientHeaderRe.test(l));
    const instructionStart = lines.findIndex(l => instructionHeaderRe.test(l));

    let ingredients = '';
    let instructions = '';

    if (ingredientStart !== -1 || instructionStart !== -1) {
        if (ingredientStart !== -1) {
            const headerMatch = lines[ingredientStart].match(ingredientHeaderRe);
            const inlineFirstItem = headerMatch && headerMatch[2] ? [headerMatch[2]] : [];
            const end = instructionStart !== -1 && instructionStart > ingredientStart ? instructionStart : lines.length;
            ingredients = [...inlineFirstItem, ...lines.slice(ingredientStart + 1, end)].join('\n');
        }
        if (instructionStart !== -1) {
            const headerMatch = lines[instructionStart].match(instructionHeaderRe);
            const inlineFirstStep = headerMatch && headerMatch[2] ? [headerMatch[2]] : [];
            instructions = [...inlineFirstStep, ...lines.slice(instructionStart + 1)].join('\n');
        }
    } else {
        const bodyLines = lines.slice(1);
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

    const lower = raw.toLowerCase();
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

    return { title, category, calories, ingredients, instructions };
}

async function saveScheduleSlotFromAdder() {
    if (!supabaseClient || !currentUserId) return;
    const day = document.getElementById('add-slot-day').value;
    const slot = parseInt(document.getElementById('add-slot-num').value);
    const timeVal = document.getElementById('add-slot-time').value.trim();
    const taskVal = document.getElementById('add-slot-task').value.trim();
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
    const day = activeTab ? activeTab.id.replace('daytab-', '') : dbDaysMap[0];
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
async function clearEntireWeeklySchedule() { await supabaseClient.from('weekly_schedule').delete().eq('user_id', currentUserId); buildWeeklyScheduleAccordionUI(); }

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
