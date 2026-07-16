const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt'; 

let supabaseClient;

const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const defaultHours = [
    '07:00', '09:00', '11:00', '13:00', '15:00', 
    '17:00', '19:00', '20:00', '21:00', '22:00'
];

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
});

async function loginUser(username) {
    currentUsername = username;
    localStorage.setItem('weekwise_user', username);

    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';

    const dateInput = document.getElementById('selected-date');
    const today = new Date().toISOString().split('T')[0];
    
    if (dateInput) {
        dateInput.value = today;
        loadDailyNutrition(today);
        dateInput.onchange = (e) => loadDailyNutrition(e.target.value);
    }

    const weightDateInput = document.getElementById('new-weight-date');
    if (weightDateInput) weightDateInput.value = today;

    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();
    loadStats();
    loadAllCenterItems();
    loadMealPresetsToSelects();
    loadProgressTargets();
    loadWeightHistory();

    document.getElementById('btn-save-nutrition').onclick = saveNutrition;
    document.getElementById('btn-copy-yesterday').onclick = copyFromYesterday;
}

function logoutUser() {
    localStorage.removeItem('weekwise_user');
    location.reload();
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
}

function openCenterAdder(type) {
    const titleMap = { important: 'דבר חשוב מאוד', weekly: 'משימה לשבוע', general: 'סידור / קנייה' };
    const text = prompt(`הקלידו ${titleMap[type]} חדש:`);
    if (!text || !text.trim()) return;
    insertCenterItemDirect(type, text.trim());
}

async function insertCenterItemDirect(type, content) {
    if (!supabaseClient) return;
    await supabaseClient.from('my_center_tasks').insert({
        username: currentUsername, task_type: type, content: content
    });
    loadCenterItems(type);
}

function initCubesNavigation() {
    const cubes = document.querySelectorAll('.nav-cube');
    const tabContents = document.querySelectorAll('.tab-content');

    cubes.forEach(cube => {
        cube.addEventListener('click', () => {
            const targetId = cube.getAttribute('data-target');
            cubes.forEach(c => c.classList.remove('active'));
            cube.classList.add('active');
            tabContents.forEach(content => {
                content.classList.remove('active-tab');
                if (content.id === targetId) content.classList.add('active-tab');
            });
        });
    });
}

function getFormattedDateForDay(dayIndex) {
    const current = new Date();
    const currentDayOfWeek = current.getDay();
    const distanceToSunday = currentDayOfWeek; 
    const sundayDate = new Date(current);
    sundayDate.setDate(current.getDate() - distanceToSunday);
    const targetDate = new Date(sundayDate);
    targetDate.setDate(sundayDate.getDate() + dayIndex);
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
            const defaultHour = defaultHours[i - 1];
            slotsHTML += `
                <div class="slot-input-group" data-day="${dbDay}" data-slot="${i}">
                    <span class="slot-num-label">#${i}</span>
                    <input type="text" value="${defaultHour}" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})">
                    <input type="text" placeholder="" class="slot-task" onchange="saveScheduleSlot('${dbDay}', ${i})">
                    <button class="btn-delete-slot" onclick="clearSingleSlot('${dbDay}', ${i})">❌</button>
                </div>
            `;
        }

        itemDiv.innerHTML = `
            <div class="accordion-header" onclick="toggleAccordion('${dbDay}')">
                <span style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.85rem; color: var(--accent-purple-light); font-weight: normal; min-width: 35px;">${dateStr}</span>
                    <span style="color: rgba(255,255,255,0.15);">|</span>
                    <span>יום ${dayName}</span>
                </span>
                <span class="accordion-icon">▼</span>
            </div>
            <div class="accordion-content"><div class="slots-grid">${slotsHTML}</div></div>
        `;
        container.appendChild(itemDiv);
    });
}

function toggleAccordion(day) {
    const item = document.getElementById(`accordion-${day}`);
    if (!item) return;
    const isActive = item.classList.contains('active');
    document.querySelectorAll('.accordion-item').forEach(el => {
        if (el.id !== 'accordion-weight-card') el.classList.remove('active');
    });
    if (!isActive) item.classList.add('active');
}

async function loadWeeklySchedule() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('weekly_schedule').select('*').eq('username', currentUsername);
    if (!data) return;

    data.forEach(item => {
        const slotEl = document.querySelector(`[data-day="${item.day_of_week}"][data-slot="${item.slot_number}"]`);
        if (slotEl) {
            if (item.time_of_day) slotEl.querySelector('.slot-time').value = item.time_of_day;
            slotEl.querySelector('.slot-task').value = item.task_title || '';
            const colorClass = item.task_color === 'purple' ? 'task-purple' : 'task-pink';
            slotEl.classList.remove('task-pink', 'task-purple');
            slotEl.classList.add(colorClass);

            const taskInput = slotEl.querySelector('.slot-task');
            if (item.task_title) {
                const emoji = item.task_color === 'purple' ? '📚' : '🔋';
                if (!taskInput.value.startsWith('🔋') && !taskInput.value.startsWith('📚')) {
                    taskInput.value = `${emoji} ${item.task_title}`;
                }
            }
        }
    });
}

async function saveScheduleSlot(day, slot) {
    if (!supabaseClient) return;
    const slotEl = document.querySelector(`[data-day="${day}"][data-slot="${slot}"]`);
    if (!slotEl) return;
    const timeVal = slotEl.querySelector('.slot-time').value;
    let taskVal = slotEl.querySelector('.slot-task').value.trim();
    taskVal = taskVal.replace(/^(🔋|📚)\s*/, '');

    const { data: existing } = await supabaseClient.from('weekly_schedule').select('id, task_color').eq('username', currentUsername).eq('day_of_week', day).eq('slot_number', slot).maybeSingle();
    const color = existing ? (existing.task_color || 'pink') : 'pink';

    if (existing) {
        await supabaseClient.from('weekly_schedule').update({ time_of_day: timeVal, task_title: taskVal }).eq('id', existing.id);
    } else {
        await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal, task_color: color });
    }
    loadWeeklySchedule();
}

async function saveScheduleSlotFromAdder() {
    if (!supabaseClient) return;
    const day = document.getElementById('add-slot-day').value;
    const slot = parseInt(document.getElementById('add-slot-num').value);
    const timeVal = document.getElementById('add-slot-time').value.trim();
    const taskVal = document.getElementById('add-slot-task').value.trim();
    const colorVal = document.querySelector('input[name="slot-color"]:checked').value;

    if (!timeVal || !taskVal) return;

    const { data: existing } = await supabaseClient.from('weekly_schedule').select('id').eq('username', currentUsername).eq('day_of_week', day).eq('slot_number', slot).maybeSingle();

    if (existing) {
        await supabaseClient.from('weekly_schedule').update({ time_of_day: timeVal, task_title: taskVal, task_color: colorVal }).eq('id', existing.id);
    } else {
        await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal, task_color: colorVal });
    }
    document.getElementById('add-slot-time').value = '';
    document.getElementById('add-slot-task').value = '';
    toggleAccordion(day);
    loadWeeklySchedule();
}

async function deleteScheduleSlotFromAdder() {
    if (!supabaseClient) return;
    const day = document.getElementById('add-slot-day').value;
    const slot = parseInt(document.getElementById('add-slot-num').value);
    await clearSingleSlot(day, slot);
    toggleAccordion(day);
}

async function clearSingleSlot(day, slot) {
    if (!supabaseClient) return;
    await supabaseClient.from('weekly_schedule').delete().eq('username', currentUsername).eq('day_of_week', day).eq('slot_number', slot);
    const slotEl = document.querySelector(`[data-day="${day}"][data-slot="${slot}"]`);
    if (slotEl) {
        slotEl.querySelector('.slot-task').value = '';
        slotEl.classList.remove('task-pink', 'task-purple');
        slotEl.querySelector('.slot-time').value = defaultHours[slot - 1];
    }
}

async function clearEntireWeeklySchedule() {
    if (!supabaseClient) return;
    if (!confirm('לנקות את כל הלו״ז השבועי?')) return;
    await supabaseClient.from('weekly_schedule').delete().eq('username', currentUsername);
    buildWeeklyScheduleAccordionUI();
    loadWeeklySchedule();
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

async function addCustomPreset() {
    if (!supabaseClient) return;
    const name = document.getElementById('new-preset-name').value.trim();
    const calories = parseInt(document.getElementById('new-preset-calories').value) || 0;
    const category = document.getElementById('new-preset-category').value;

    if (!name || calories <= 0) return;

    await supabaseClient.from('meal_presets').insert({ username: currentUsername, meal_category: category, food_name: name, calories: calories });
    document.getElementById('new-preset-name').value = '';
    document.getElementById('new-preset-calories').value = '';
    loadMealPresetsToSelects();
}

async function loadDailyNutrition(date) {
    if (!supabaseClient) return;
    document.querySelectorAll('.meal-row').forEach(row => { row.querySelector('.food-input').value = ''; row.querySelector('.calories-input').value = ''; });

    const { data } = await supabaseClient.from('calorie_tracker').select('*').eq('username', currentUsername).eq('date', date);
    if (!data) return;

    let totalToday = 0;
    data.forEach(item => {
        const row = document.querySelector(`[data-meal="${item.meal_type}"]`);
        if (row) {
            row.querySelector('.food-input').value = item.food_description || '';
            row.querySelector('.calories-input').value = item.calories || '';
            totalToday += item.calories || 0;
        }
    });
    document.getElementById('calories-today').innerText = totalToday;
}

async function saveNutrition() {
    if (!supabaseClient) return;
    const date = document.getElementById('selected-date').value;
    const mealRows = document.querySelectorAll('.meal-row');

    for (let row of mealRows) {
        const mealType = row.getAttribute('data-meal');
        const food = row.querySelector('.food-input').value;
        const cals = parseInt(row.querySelector('.calories-input').value) || 0;

        const { data: existing } = await supabaseClient.from('calorie_tracker').select('id').eq('username', currentUsername).eq('date', date).eq('meal_type', mealType).maybeSingle();

        if (existing) {
            await supabaseClient.from('calorie_tracker').update({ food_description: food, calories: cals }).eq('id', existing.id);
        } else {
            await supabaseClient.from('calorie_tracker').insert({ username: currentUsername, date: date, meal_type: mealType, food_description: food, calories: cals });
        }
    }
    alert('התזונה נשמרה!');
    loadDailyNutrition(date);
    loadStats();
}

async function copyFromYesterday() {
    if (!supabaseClient) return;
    const currentDate = document.getElementById('selected-date').value;
    const yesterdayObj = new Date(currentDate);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayDateStr = yesterdayObj.toISOString().split('T')[0];

    const { data } = await supabaseClient.from('calorie_tracker').select('*').eq('username', currentUsername).eq('date', yesterdayDateStr);
    if (!data || data.length === 0) return alert('אין תפריט מאתמול.');

    data.forEach(item => {
        const row = document.querySelector(`[data-meal="${item.meal_type}"]`);
        if (row) {
            row.querySelector('.food-input').value = item.food_description || '';
            row.querySelector('.calories-input').value = item.calories || 0;
        }
    });
}

async function loadStats() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('calorie_tracker').select('date, calories').eq('username', currentUsername);
    if (!data) return;

    const dailyTotals = {};
    data.forEach(item => dailyTotals[item.date] = (dailyTotals[item.date] || 0) + item.calories);
    const values = Object.values(dailyTotals);
    if (values.length === 0) return;

    let sum = 0;
    const average = Math.round(values.reduce((s, v) => sum = s + v, 0) / values.length);
    document.getElementById('calories-weekly').innerText = average; 
    document.getElementById('calories-monthly').innerText = average;
}

async function loadCenterItems(type) {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('my_center_tasks').select('*').eq('username', currentUsername).eq('task_type', type).order('created_at', { ascending: true });
    if (!data) return;

    const listUl = document.getElementById(`${type}-list`);
    if (!listUl) return;
    listUl.innerHTML = '';

    data.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<span>${item.content}</span><button class="btn-delete-item" onclick="deleteCenterItem('${item.id}', '${type}')">❌</button>`;
        listUl.appendChild(li);
    });
}

function loadAllCenterItems() { loadCenterItems('important'); loadCenterItems('weekly'); loadCenterItems('general'); }

async function deleteCenterItem(id, type) {
    if (!supabaseClient) return;
    await supabaseClient.from('my_center_tasks').delete().eq('id', id);
    loadCenterItems(type);
}

async function addProgressTarget() {
    if (!supabaseClient) return;
    const name = document.getElementById('progress-name-input').value.trim();
    const targetVal = parseInt(document.getElementById('progress-target-input').value) || 0;

    if (!name || targetVal <= 0) return;

    await supabaseClient.from('weekly_progress_targets').insert({ username: currentUsername, target_name: name, current_val: 0, target_val: targetVal });
    document.getElementById('progress-name-input').value = '';
    document.getElementById('progress-target-input').value = '';
    loadProgressTargets();
}

async function loadProgressTargets() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('weekly_progress_targets').select('*').eq('username', currentUsername).order('created_at', { ascending: true });
    const container = document.getElementById('progress-container');
    if (!container) return;
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-secondary); text-align: center;">אין יעדים פעילים.</p>`;
        return;
    }

    data.forEach(item => {
        const percentage = Math.min(Math.round((item.current_val / item.target_val) * 100), 100);
        const isCompleted = item.current_val >= item.target_val;

        const row = document.createElement('div');
        row.className = 'progress-row';
        row.innerHTML = `
            <div class="progress-info">
                <span>${item.target_name}</span>
                <div class="progress-counter">
                    <button class="btn-counter" onclick="changeProgressVal('${item.id}', -1)">-</button>
                    <span style="font-weight: 600; min-width: 35px; text-align: center;">${item.current_val}/${item.target_val}</span>
                    <button class="btn-counter" onclick="changeProgressVal('${item.id}', 1)">+</button>
                    <button class="btn-delete-item" onclick="deleteProgressTarget('${item.id}')">❌</button>
                </div>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill ${isCompleted ? 'completed' : ''}" style="width: ${percentage}%;"></div></div>
        `;
        container.appendChild(row);
    });
}

async function changeProgressVal(id, change) {
    if (!supabaseClient) return;
    const { data: item } = await supabaseClient.from('weekly_progress_targets').select('*').eq('id', id).single();
    if (!item) return;
    let newVal = Math.max(0, item.current_val + change);
    await supabaseClient.from('weekly_progress_targets').update({ current_val: newVal }).eq('id', id);
    loadProgressTargets();
}

async function deleteProgressTarget(id) {
    if (!supabaseClient) return;
    await supabaseClient.from('weekly_progress_targets').delete().eq('id', id);
    loadProgressTargets();
}

function toggleWeightAccordion() {
    const content = document.getElementById('weight-accordion-content');
    const icon = document.getElementById('weight-icon');
    if (content.style.maxHeight === '0px' || content.style.maxHeight === '') { content.style.maxHeight = '400px'; icon.style.transform = 'rotate(180deg)'; }
    else { content.style.maxHeight = '0px'; icon.style.transform = 'rotate(0deg)'; }
}

async function saveNewWeightRecord() {
    if (!supabaseClient) return;
    const weight = parseFloat(document.getElementById('new-weight-val').value);
    const dateVal = document.getElementById('new-weight-date').value;

    if (!weight || !dateVal) return;

    await supabaseClient.from('weight_tracker').insert({ username: currentUsername, weight_date: dateVal, weight_value: weight });
    document.getElementById('new-weight-val').value = '';
    loadWeightHistory();
}

async function loadWeightHistory() {
    if (!supabaseClient) return;
    const { data } = await supabaseClient.from('weight_tracker').select('*').eq('username', currentUsername).order('weight_date', { ascending: false });
    const listUl = document.getElementById('weight-history-list');
    if (!listUl) return;
    listUl.innerHTML = '';

    if (!data || data.length === 0) {
        listUl.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-secondary); text-align: center;">אין שקילות.</p>`;
        return;
    }

    data.forEach(item => {
        const parts = item.weight_date.split('-');
        listUl.innerHTML += `<li><span>${item.weight_value} ק״ג <small style="color:var(--text-secondary);">(${parts[2]}.${parts[1]})</small></span><button class="btn-delete-item" onclick="deleteWeightRecord('${item.id}')">❌</button></li>`;
    });
}

async function deleteWeightRecord(id) {
    if (!supabaseClient) return;
    await supabaseClient.from('weight_tracker').delete().eq('id', id);
    loadWeightHistory();
}
