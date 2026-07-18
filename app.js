const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt';
let supabaseClient;
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayNameKeys = ['day_sunday', 'day_monday', 'day_tuesday', 'day_wednesday', 'day_thursday', 'day_friday', 'day_saturday'];
let defaultHours = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '20:00', '21:00', '22:00'];
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
    document.getElementById('btn-save-new-slot').addEventListener('click', () => {
        saveScheduleSlotFromAdder();
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
    document.querySelectorAll('.btn-upgrade').forEach(btn => {
        btn.addEventListener('click', () => openPremiumUpgradeModal());
    });
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

async function addCustomPreset() {
    const nameInput = document.getElementById('new-preset-name');
    const caloriesInput = document.getElementById('new-preset-calories');
    const name = nameInput.value.trim();
    const calories = parseInt(caloriesInput.value) || 0;
    const category = document.getElementById('new-preset-category').value;
    if (!name || calories <= 0) return;

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
        loadPremiumStatus()
    ]);
    loadAllCenterItems();
    hideAppLoadingOverlay();
    applyPwaShortcutDeepLink();
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

function initCubesNavigation() {
    const cubes = document.querySelectorAll('.nav-cube');
    const tabContents = document.querySelectorAll('.tab-content');
    cubes.forEach(cube => cube.addEventListener('click', () => {
        cubes.forEach(c => c.classList.remove('active')); cube.classList.add('active');
        tabContents.forEach(content => { content.classList.remove('active-tab'); if (content.id === cube.getAttribute('data-target')) content.classList.add('active-tab'); });
    }));
}

function switchToTab(targetId) {
    const cube = document.querySelector(`.nav-cube[data-target="${targetId}"]`);
    if (cube) cube.click();
}

// --- קיצורי דרך של ה-PWA (manifest.json shortcuts): קפיצה ישירה ללשונית מבוקשת ---
function applyPwaShortcutDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const validTargets = ['schedule-section', 'my-center-section', 'nutrition-section', 'recipes-section'];
    if (view && validTargets.includes(view)) switchToTab(view);
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
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
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
    await supabaseClient.from('weekly_schedule').delete().eq('user_id', currentUserId).eq('day_of_week', day).eq('slot_number', slot);
    buildWeeklyScheduleAccordionUI();
    loadWeeklySchedule();
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

function loadCustomDefaultHours() {
    const raw = localStorage.getItem(defaultHoursKey());
    if (!raw) return;
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length === 10) defaultHours = parsed;
    } catch {}
}

function openHoursSettingsModal() {
    for (let i = 1; i <= 10; i++) {
        document.getElementById(`settings-hour-${i}`).value = defaultHours[i - 1] || '';
    }
    openModal('modal-settings-hours');
}

function saveDefaultHours() {
    const newHours = [];
    for (let i = 1; i <= 10; i++) {
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
        const slotNumbers = daySlotsConfig[dbDay] && daySlotsConfig[dbDay].length ? daySlotsConfig[dbDay] : defaultDaySlotNumbers();
        slotNumbers.forEach(i => {
            slotsHTML += `<div class="slot-input-group" data-day="${dbDay}" data-slot="${i}"><span class="slot-num-label">${i}</span><input type="text" value="${defaultHours[i-1] || ''}" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})"><input type="text" class="slot-task" onchange="saveScheduleSlot('${dbDay}', ${i})"><button class="btn-delete-slot" onclick="removeDaySlot('${dbDay}', ${i})" title="${t('schedule_remove_row_title')}">❌</button></div>`;
        });
        pageDiv.innerHTML = `<div class="day-page-header">${dateStr} | ${dayName}</div><div class="slots-grid">${slotsHTML}</div><button type="button" class="btn-add-day-slot" onclick="addDaySlot('${dbDay}')">➕ ${t('schedule_add_row_btn')}</button>`;
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
            }
        });
    }, { root: container, threshold: [0.5] });
    document.querySelectorAll('.day-page').forEach(page => dayScrollObserver.observe(page));
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
}

async function saveScheduleSlot(day, slot) {
    if (!supabaseClient) return;
    const slotEl = document.querySelector(`[data-day="${day}"][data-slot="${slot}"]`);
    const timeVal = slotEl.querySelector('.slot-time').value;
    const taskVal = slotEl.querySelector('.slot-task').value.trim();
    const { data: existing } = await supabaseClient.from('weekly_schedule').select('id').eq('user_id', currentUserId).eq('day_of_week', day).eq('slot_number', slot).maybeSingle();
    if (existing) await supabaseClient.from('weekly_schedule').update({ time_of_day: timeVal, task_title: taskVal }).eq('id', existing.id);
    else await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, user_id: currentUserId, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal });
}

// --- מבט ליומן: אירועים ארוכי-טווח בעלי תאריך אמיתי, נפרד מהתבנית השבועית החוזרת ---
function formatEventDateBadge(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return `${day}.${month}`;
}

async function loadCalendarEvents() {
    if (!supabaseClient) return;
    const container = document.getElementById('calendar-glance-list');
    if (!container) return;
    const today = getLocalDateString();
    const { data, error } = await supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).gte('event_date', today).order('event_date', { ascending: true });
    container.innerHTML = '';
    if (error || !data || !data.length) {
        const empty = document.createElement('div');
        empty.className = 'calendar-glance-empty';
        empty.textContent = t('calendar_glance_empty');
        container.appendChild(empty);
        return;
    }
    data.forEach(item => {
        const row = document.createElement('div');
        row.className = 'calendar-event-item';
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
        row.appendChild(dateBadge);
        row.appendChild(titleSpan);
        row.appendChild(deleteBtn);
        container.appendChild(row);
    });
}

async function addCalendarEvent() {
    const titleInput = document.getElementById('calendar-event-title-input');
    const dateInput = document.getElementById('calendar-event-date-input');
    const title = titleInput.value.trim();
    const date = dateInput.value;
    if (!title || !date) { showAppToast(t('calendar_event_missing_fields'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const { error } = await supabaseClient.from('calendar_events').insert({ username: currentUsername, user_id: currentUserId, event_title: title, event_date: date });
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    titleInput.value = '';
    dateInput.value = '';
    closeModal('modal-add-calendar-event');
    showAppToast(t('item_added_success'));
    loadCalendarEvents();
}

async function deleteCalendarEvent(id) {
    await supabaseClient.from('calendar_events').delete().eq('id', id);
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

async function loadPremiumStatus() {
    if (!supabaseClient || !currentUserId) return;
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

// --- מונה שימוש חינמי בניתוח מתכונים (10 ניתוחים חינם), נשמר ב-Supabase per-user ---
// חסימה זו מדולגת לחלוטין עבור משתמשי פרימיום (isPremiumUser)
const RECIPE_AI_FREE_LIMIT = 10;
let cachedAiUsage = 0;

async function loadAiUsage() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('user_ai_usage').select('recipe_ai_parses_used').eq('user_id', currentUserId).maybeSingle();
    cachedAiUsage = data ? data.recipe_ai_parses_used : 0;
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
    if (existing) await supabaseClient.from('weekly_schedule').update(payload).eq('id', existing.id);
    else await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, user_id: currentUserId, day_of_week: day, slot_number: slot, ...payload });
    loadWeeklySchedule();
}

async function deleteScheduleSlotFromAdder() {
    const day = document.getElementById('add-slot-day').value;
    const slot = parseInt(document.getElementById('add-slot-num').value);
    await clearSingleSlot(day, slot);
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

async function checkReminders() {
    if (!supabaseClient || !currentUserId) return;
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
            fireReminder({ taskTitle: item.task_title, text: item.reminder_text });
            localStorage.setItem(reminderFiredKey(item.id), todayStr);
        }
    });
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
        tag: `weekwise-reminder-${taskTitle}`
    });
    notification.onclick = () => { window.focus(); notification.close(); };
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
