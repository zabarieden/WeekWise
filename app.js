const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt';
let supabaseClient;
const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
let defaultHours = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '20:00', '21:00', '22:00'];
let currentUsername = '';
let currentUserId = null;
let reminderIntervalStarted = false;
let authMode = 'login';

function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}

document.addEventListener('DOMContentLoaded', async () => {
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
});

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
    ['important', 'weekly', 'general'].forEach(type => loadCenterItems(type));
}

async function loadCenterItems(type) {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('my_center_tasks').select('*').eq('user_id', currentUserId).eq('task_type', type).order('created_at', { ascending: true });
    if (error) { showAppToast('שגיאה בטעינת הרשימה: ' + error.message, 'error'); return; }
    if (!data) return;
    const listUl = document.getElementById(`${type}-list`);
    listUl.innerHTML = '';
    data.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <button class="btn-complete-item" onclick="toggleTaskStatus('${item.id}', ${item.is_completed}, '${type}')">
                ${item.is_completed ? '✓' : ''}
            </button>
            <span style="text-decoration: ${item.is_completed ? 'line-through' : 'none'}; color: ${item.is_completed ? '#666' : '#fff'}; flex: 1; text-align: right; margin-right: 10px; font-weight: 500;">
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
        showAppToast('הארוחה עודכנה בהצלחה!');
        cancelPresetEdit();
    } else {
        await supabaseClient.from('meal_presets').insert({ username: currentUsername, user_id: currentUserId, meal_category: category, food_name: name, calories: calories });
        showAppToast('הארוחה נוספה למאגר בהצלחה!');
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
    document.getElementById('btn-add-preset').textContent = '💾 עדכון ארוחה';
}

function cancelPresetEdit() {
    editingPresetId = null;
    document.getElementById('new-preset-name').value = '';
    document.getElementById('new-preset-calories').value = '';
    document.getElementById('btn-add-preset').textContent = 'הוסף למאגר';
}

async function deletePreset(id) {
    await supabaseClient.from('meal_presets').delete().eq('id', id);
    if (editingPresetId === id) cancelPresetEdit();
    loadMealPresetsToSelects();
    loadPresetManageList();
    showAppToast('הארוחה נמחקה מהמאגר.');
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
    if (!data) return;
    document.querySelectorAll('.preset-select').forEach(select => {
        const category = select.getAttribute('data-category');
        select.innerHTML = '<option value="">📋 ארוחה קבועה...</option>';
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

function updateAuthUI() {
    const subtitle = document.getElementById('auth-mode-subtitle');
    const submitBtn = document.getElementById('btn-auth-submit');
    const toggleText = document.getElementById('auth-toggle-text');
    const toggleLink = document.getElementById('auth-toggle-link');
    const messageEl = document.getElementById('auth-message');
    if (authMode === 'login') {
        subtitle.textContent = 'התחברו לחשבון שלכם:';
        submitBtn.textContent = 'התחברו';
        toggleText.textContent = 'אין לכם חשבון?';
        toggleLink.textContent = 'הרשמה';
    } else {
        subtitle.textContent = 'צרו חשבון חדש:';
        submitBtn.textContent = 'הרשמה';
        toggleText.textContent = 'כבר יש לכם חשבון?';
        toggleLink.textContent = 'התחברות';
    }
    messageEl.textContent = '';
}

async function submitAuthForm() {
    const email = document.getElementById('auth-email-input').value.trim();
    const password = document.getElementById('auth-password-input').value;
    const messageEl = document.getElementById('auth-message');
    messageEl.textContent = '';
    if (!email || !password) { messageEl.textContent = 'נא למלא אימייל וסיסמה'; return; }
    if (!supabaseClient) initSupabase();
    if (!supabaseClient) { messageEl.textContent = 'שגיאת התחברות לשרת, נסו לרענן את הדף.'; return; }

    if (authMode === 'signup') {
        const { data, error } = await supabaseClient.auth.signUp({ email, password });
        if (error) { messageEl.textContent = error.message; return; }
        if (data.session) {
            initAppAfterAuth(data.user);
        } else {
            messageEl.style.color = 'var(--accent-green)';
            messageEl.textContent = 'נרשמתם בהצלחה! בדקו את המייל שלכם לאישור החשבון, ואז התחברו.';
            authMode = 'login';
            updateAuthUI();
        }
    } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) { messageEl.textContent = 'אימייל או סיסמה שגויים.'; return; }
        initAppAfterAuth(data.user);
    }
}

async function initAppAfterAuth(user) {
    currentUserId = user.id;
    currentUsername = user.email;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';

    // כאן הוספתי את מילוי התאריך האוטומטי גם למשקל וגם לארוחות להיום
    const today = getLocalDateString();
    const selectedDateInput = document.getElementById('selected-date');
    if(selectedDateInput) selectedDateInput.value = today;
    const weightDateInput = document.getElementById('new-weight-date');
    if(weightDateInput) weightDateInput.value = today;

    loadCustomDefaultHours();
    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();
    loadStats();
    loadAllCenterItems();
    loadMealPresetsToSelects();
    loadProgressTargets();
    loadWeightHistory();
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
    if (!supabaseClient || !currentUserId) { showAppToast('לא מחוברים - נסו לרענן את הדף ולהתחבר מחדש.', 'error'); return; }
    const { error } = await supabaseClient.from('my_center_tasks').insert({ username: currentUsername, user_id: currentUserId, task_type: type, content: content });
    if (error) { showAppToast('שגיאה בהוספת הפריט: ' + error.message, 'error'); return; }
    await loadCenterItems(type);
    expandCardForList(`${type}-list`);
    showAppToast('הפריט נוסף בהצלחה!');
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
    container.innerHTML = '';
    if (tabsStrip) tabsStrip.innerHTML = '';
    daysOfWeek.forEach((dayName, dayIndex) => {
        const dbDay = dbDaysMap[dayIndex];
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
        for (let i = 1; i <= 10; i++) {
            slotsHTML += `<div class="slot-input-group" data-day="${dbDay}" data-slot="${i}"><span class="slot-num-label">#${i}</span><input type="text" value="${defaultHours[i-1]}" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})"><input type="text" class="slot-task" onchange="saveScheduleSlot('${dbDay}', ${i})"><button class="btn-delete-slot" onclick="clearSingleSlot('${dbDay}', ${i})">❌</button></div>`;
        }
        pageDiv.innerHTML = `<div class="day-page-header">${dateStr} | יום ${dayName}</div><div class="slots-grid">${slotsHTML}</div><div class="day-add-task-row"><input type="text" class="day-add-time" placeholder="שעה"><input type="text" class="day-add-task-input" placeholder="הוסיפו משימה ליום זה..."><button class="btn-day-add-task" onclick="addTaskToDay('${dbDay}')">➕ הוספה</button></div>`;
        container.appendChild(pageDiv);
    });
    setupDayScrollObserver();
}

function scrollToDay(dbDay) {
    const page = document.getElementById(`daypage-${dbDay}`);
    if (page) page.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });
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

async function addTaskToDay(day) {
    const container = document.getElementById(`daypage-${day}`);
    if (!container) return;
    const timeInput = container.querySelector('.day-add-time');
    const taskInput = container.querySelector('.day-add-task-input');
    const timeVal = timeInput.value.trim();
    const taskVal = taskInput.value.trim();
    if (!taskVal) return;
    const slots = container.querySelectorAll('.slot-input-group');
    let targetSlot = null;
    for (const slotEl of slots) {
        if (!slotEl.querySelector('.slot-task').value.trim()) { targetSlot = slotEl; break; }
    }
    if (!targetSlot) { showAppToast('כל המשבצות ליום זה תפוסות, נקו משבצת קיימת כדי להוסיף עוד.', 'error'); return; }
    const slotNum = targetSlot.getAttribute('data-slot');
    targetSlot.querySelector('.slot-task').value = taskVal;
    if (timeVal) targetSlot.querySelector('.slot-time').value = timeVal;
    targetSlot.scrollIntoView({ behavior: 'smooth', block: 'center' });
    targetSlot.classList.add('just-added');
    setTimeout(() => targetSlot.classList.remove('just-added'), 1200);
    await saveScheduleSlot(day, slotNum);
    timeInput.value = '';
    taskInput.value = '';
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
    if (!data) return;
    data.forEach(item => {
        const slotEl = document.querySelector(`[data-day="${item.day_of_week}"][data-slot="${item.slot_number}"]`);
        if (slotEl) { slotEl.querySelector('.slot-time').value = item.time_of_day; slotEl.querySelector('.slot-task').value = item.task_title || ''; }
    });
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
    showAppToast('🔊 מנגן צליל בדיקה...');
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
        Notification.requestPermission();
    }
}

function showBrowserNotification(taskTitle, text) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const notification = new Notification(`⏰ תזכורת: ${taskTitle || 'משימה'}`, {
        body: text || 'הגיע הזמן למשימה שלך!',
        icon: 'icon.png',
        tag: `weekwise-reminder-${taskTitle}`
    });
    notification.onclick = () => { window.focus(); notification.close(); };
}

let reminderToastTimeout = null;
function showReminderToast(taskTitle, text) {
    const toast = document.getElementById('reminder-toast');
    if (!toast) return;
    toast.querySelector('.reminder-toast-title').textContent = `⏰ תזכורת: ${taskTitle || 'משימה'}`;
    toast.querySelector('.reminder-toast-text').textContent = text || 'הגיע הזמן למשימה שלך!';
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
    showAppToast('נשמר בהצלחה!');
}

async function copyFromYesterday() {
    if (!supabaseClient) return;
    const currentDate = document.getElementById('selected-date').value;
    if (!currentDate) return;
    const prevDateObj = new Date(`${currentDate}T00:00:00`);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDate = getLocalDateString(prevDateObj);
    const { data } = await supabaseClient.from('calorie_tracker').select('*').eq('user_id', currentUserId).eq('date', prevDate);
    if (!data || data.length === 0) { showAppToast('לא נמצא תפריט שמור מהיום הקודם.', 'error'); return; }
    data.forEach(item => {
        const row = document.querySelector(`[data-meal="${item.meal_type}"]`);
        if (row) { row.querySelector('.food-input').value = item.food_description; row.querySelector('.calories-input').value = item.calories; }
    });
    updateLiveCaloriesToday();
    showAppToast('התפריט שוכפל מהיום הקודם! לחצו "שמור תפריט להיום" כדי לשמור.');
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
    if (error) { showAppToast('שגיאה בטעינת מד הצעדים: ' + error.message, 'error'); return; }
    if (data) {
        document.getElementById('steps-today').innerText = data.step_count;
    }
    loadStepStats();
}

function connectHealthData() {
    showAppToast('חיבור אוטומטי למד בריאות יתאפשר בגרסת האפליקציה הנייטיבית (Capacitor) - כרגע אין דרך לחבר Google Fit / Apple Health מאתר רגיל.', 'error');
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
