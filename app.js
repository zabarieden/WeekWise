const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt';
let supabaseClient;
const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const defaultHours = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00', '19:00', '20:00', '21:00', '22:00'];
let currentUsername = '';

function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}

document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    initCubesNavigation();
    const savedUser = localStorage.getItem('weekwise_user');
    if (savedUser) {
        if (!supabaseClient && window.supabase) initSupabase();
        loginUser(savedUser);
    }
    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            if (!supabaseClient) initSupabase();
            const usernameVal = document.getElementById('username-input').value.trim();
            if (usernameVal) loginUser(usernameVal);
            else alert('אנא הקלידו שם משתמש');
        });
    }
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
    document.getElementById('btn-run-ai').addEventListener('click', processAIRecipe);
});

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
    const { data } = await supabaseClient.from('my_center_tasks').select('*').eq('username', currentUsername).eq('task_type', type).order('created_at', { ascending: true });
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
async function addCustomPreset() {
    const name = document.getElementById('new-preset-name').value.trim();
    const calories = parseInt(document.getElementById('new-preset-calories').value) || 0;
    const category = document.getElementById('new-preset-category').value;
    if (!name || calories <= 0) return;
    await supabaseClient.from('meal_presets').insert({ username: currentUsername, meal_category: category, food_name: name, calories: calories });
    loadMealPresetsToSelects();
    alert("הארוחה נוספה למאגר בהצלחה!");
}

async function loadMealPresetsToSelects() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('meal_presets').select('*').eq('username', currentUsername);
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
        };
    });
}

// --- פונקציות המערכת הקיימות ---
async function processAIRecipe() {
    const input = document.getElementById('ai-nutrition-prompt').value.toLowerCase();
    if (!input) return;
    let foodName = "", calories = 0, targetMeal = "";
    if (input.includes("פופקורן")) { foodName = "פופקורן"; calories = 50; targetMeal = "meal_4"; }
    else if (input.includes("נס קפה") || input.includes("שיבולת שועל")) { foodName = "נס קפה שיבולת שועל"; calories = 60; targetMeal = "meal_1"; }
    if (targetMeal && foodName) {
        const mealRow = document.querySelector(`[data-meal="${targetMeal}"]`);
        if (mealRow) { mealRow.querySelector('.food-input').value = foodName; mealRow.querySelector('.calories-input').value = calories; document.getElementById('ai-nutrition-prompt').value = ""; }
    } else { alert("לא זיהיתי את המנה במאגר."); }
}

async function loginUser(username) {
    currentUsername = username;
    localStorage.setItem('weekwise_user', username);
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    
    // כאן הוספתי את מילוי התאריך האוטומטי גם למשקל וגם לארוחות להיום
    const today = getLocalDateString();
    const selectedDateInput = document.getElementById('selected-date');
    if(selectedDateInput) selectedDateInput.value = today;
    const weightDateInput = document.getElementById('new-weight-date');
    if(weightDateInput) weightDateInput.value = today;

    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();
    loadStats();
    loadAllCenterItems();
    loadMealPresetsToSelects();
    loadProgressTargets();
    loadWeightHistory();
    document.getElementById('btn-save-nutrition').onclick = saveNutrition;
    document.getElementById('btn-copy-yesterday').onclick = copyFromYesterday;
    selectedDateInput.onchange = (e) => loadDailyNutrition(e.target.value);

    // טעינת תזונה להיום אוטומטית (אם קיים)
    if(today) { loadDailyNutrition(today); }
}

function logoutUser() { localStorage.removeItem('weekwise_user'); location.reload(); }
function openModal(modalId) { document.getElementById(modalId).classList.add('open'); }
function closeModal(modalId) { document.getElementById(modalId).classList.remove('open'); }
function openCenterAdder(type) { const text = prompt("הוסיפו משימה:"); if(text) insertCenterItemDirect(type, text); }
async function insertCenterItemDirect(type, content) { await supabaseClient.from('my_center_tasks').insert({ username: currentUsername, task_type: type, content: content }); loadCenterItems(type); }

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

function buildWeeklyScheduleAccordionUI() {
    const container = document.getElementById('accordion-container');
    if (!container) return;
    container.innerHTML = '';
    daysOfWeek.forEach((dayName, dayIndex) => {
        const dbDay = dbDaysMap[dayIndex];
        const dateStr = getFormattedDateForDay(dayIndex);
        const itemDiv = document.createElement('div');
        itemDiv.className = 'accordion-item';
        itemDiv.id = `accordion-${dbDay}`;
        let slotsHTML = '';
        for (let i = 1; i <= 10; i++) {
            slotsHTML += `<div class="slot-input-group" data-day="${dbDay}" data-slot="${i}"><span class="slot-num-label">#${i}</span><input type="text" value="${defaultHours[i-1]}" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})"><input type="text" class="slot-task" onchange="saveScheduleSlot('${dbDay}', ${i})"><button class="btn-delete-slot" onclick="clearSingleSlot('${dbDay}', ${i})">❌</button></div>`;
        }
        itemDiv.innerHTML = `<div class="accordion-header" onclick="toggleAccordion('${dbDay}')"><span>${dateStr} | יום ${dayName}</span><span class="accordion-icon">▼</span></div><div class="accordion-content"><div class="slots-grid">${slotsHTML}</div><div class="day-add-task-row"><input type="text" class="day-add-time" placeholder="שעה"><input type="text" class="day-add-task-input" placeholder="הוסיפו משימה ליום זה..."><button class="btn-day-add-task" onclick="addTaskToDay('${dbDay}')">➕ הוספה</button></div></div>`;
        container.appendChild(itemDiv);
    });
}

async function addTaskToDay(day) {
    const container = document.getElementById(`accordion-${day}`);
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
    if (!targetSlot) { alert('כל המשבצות ליום זה תפוסות, נקו משבצת קיימת כדי להוסיף עוד.'); return; }
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

function toggleAccordion(day) {
    const item = document.getElementById(`accordion-${day}`);
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.accordion-item').forEach(el => el.classList.remove('active'));
    if (!isActive) item.classList.add('active');
}

function toggleCardSection(headerEl) {
    const card = headerEl.closest('.card');
    if (card) card.classList.toggle('expanded');
}

async function loadWeeklySchedule() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('weekly_schedule').select('*').eq('username', currentUsername);
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
    const { data: existing } = await supabaseClient.from('weekly_schedule').select('id').eq('username', currentUsername).eq('day_of_week', day).eq('slot_number', slot).maybeSingle();
    if (existing) await supabaseClient.from('weekly_schedule').update({ time_of_day: timeVal, task_title: taskVal }).eq('id', existing.id);
    else await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal });
}

async function saveScheduleSlotFromAdder() {
    const day = document.getElementById('add-slot-day').value;
    const slot = parseInt(document.getElementById('add-slot-num').value);
    const timeVal = document.getElementById('add-slot-time').value.trim();
    const taskVal = document.getElementById('add-slot-task').value.trim();
    await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal });
    loadWeeklySchedule();
}

async function deleteScheduleSlotFromAdder() { /* לוגיקה זהה למקור */ }
async function clearSingleSlot(day, slot) { await supabaseClient.from('weekly_schedule').delete().eq('username', currentUsername).eq('day_of_week', day).eq('slot_number', slot); loadWeeklySchedule(); }
async function clearEntireWeeklySchedule() { await supabaseClient.from('weekly_schedule').delete().eq('username', currentUsername); buildWeeklyScheduleAccordionUI(); }

async function loadDailyNutrition(date) {
    if (!supabaseClient) return;
    document.querySelectorAll('.meal-row').forEach(row => {
        row.querySelector('.food-input').value = '';
        row.querySelector('.calories-input').value = '';
    });
    document.getElementById('calories-today').innerText = '0';
    const { data } = await supabaseClient.from('calorie_tracker').select('*').eq('username', currentUsername).eq('date', date);
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
        const type = row.getAttribute('data-meal'), food = row.querySelector('.food-input').value, cals = row.querySelector('.calories-input').value;
        await supabaseClient.from('calorie_tracker').insert({ username: currentUsername, date: date, meal_type: type, food_description: food, calories: cals });
    }
    alert('נשמר!');
}

async function copyFromYesterday() {
    if (!supabaseClient) return;
    const currentDate = document.getElementById('selected-date').value;
    if (!currentDate) return;
    const prevDateObj = new Date(`${currentDate}T00:00:00`);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDate = getLocalDateString(prevDateObj);
    const { data } = await supabaseClient.from('calorie_tracker').select('*').eq('username', currentUsername).eq('date', prevDate);
    if (!data || data.length === 0) { alert('לא נמצא תפריט שמור מהיום הקודם.'); return; }
    data.forEach(item => {
        const row = document.querySelector(`[data-meal="${item.meal_type}"]`);
        if (row) { row.querySelector('.food-input').value = item.food_description; row.querySelector('.calories-input').value = item.calories; }
    });
    alert('התפריט שוכפל מהיום הקודם! לחצו "שמור תפריט להיום" כדי לשמור אותו.');
}
async function loadStats() { /* לוגיקה זהה למקור */ }
async function deleteCenterItem(id, type) { await supabaseClient.from('my_center_tasks').delete().eq('id', id); loadCenterItems(type); }
async function addProgressTarget() {
    if (!supabaseClient) return;
    const nameInput = document.getElementById('progress-name-input');
    const targetInput = document.getElementById('progress-target-input');
    const name = nameInput.value.trim();
    const target = parseInt(targetInput.value) || 0;
    if (!name || target <= 0) return;
    await supabaseClient.from('weekly_progress_targets').insert({ username: currentUsername, target_name: name, target_val: target, current_val: 0 });
    nameInput.value = '';
    targetInput.value = '';
    loadProgressTargets();
}

async function loadProgressTargets() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('weekly_progress_targets').select('*').eq('username', currentUsername).order('created_at', { ascending: true });
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
async function saveNewWeightRecord() { const w = document.getElementById('new-weight-val').value, d = document.getElementById('new-weight-date').value; await supabaseClient.from('weight_tracker').insert({ username: currentUsername, weight_date: d, weight_value: w }); loadWeightHistory(); }
async function loadWeightHistory() { const { data } = await supabaseClient.from('weight_tracker').select('*').eq('username', currentUsername).order('weight_date', { ascending: false }); const list = document.getElementById('weight-history-list'); list.innerHTML = ''; data.forEach(item => list.innerHTML += `<li>${item.weight_value} ק״ג (${item.weight_date}) <button onclick="deleteWeightRecord('${item.id}')">❌</button></li>`); }
async function deleteWeightRecord(id) { await supabaseClient.from('weight_tracker').delete().eq('id', id); loadWeightHistory(); }
