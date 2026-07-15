// הגדרות החיבור ל-Supabase שלך
const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt'; 

let supabaseClient;

const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// 10 שעות ברירת מחדל קבועות מראש לחריצים
const defaultHours = [
    '07:00', '09:00', '11:00', '13:00', '15:00', 
    '17:00', '19:00', '20:00', '21:00', '22:00'
];

// ארוחות ברירת מחדל ל-Eden (יוטענו אוטומטית רק עבורה ל-Supabase בכניסה הראשונה)
const edenDefaultPresets = [
    // בוקר וקלות
    { meal_category: 'morning', food_name: 'שיבולת שועל ויוגורט (יוגורט + 3 כפות ש"ש + דבש + נס קפה)', calories: 255 },
    { meal_category: 'morning', food_name: "טוסט קוטג' ונס קפה (פרוסת לחם מלא + 2 כפות קוטג' + נס קפה)", calories: 226 },
    { meal_category: 'morning', food_name: 'ארוחת בוקר ישראלית קלה (2 פרוסות לחם ילדים + צהובה 15% + זיתים + קטשופ + יוגורט)', calories: 290 },
    // צהריים / ערב
    { meal_category: 'noon', food_name: 'ארוחת קופסה קלילה (200ג תפוד + 2 ביצים קשות + מאפינס קוטג + שרי)', calories: 415 },
    { meal_category: 'noon', food_name: 'ארוחת קופסה משביעה (150ג חזה עוף + 100ג אורז לבן + ירקות)', calories: 350 },
    { meal_category: 'noon', food_name: 'ארוחת אורז וביצים (100ג אורז + 2 ביצים קשות + מאפינס קוטג + רבע מאפינס טונה + חמוצים)', calories: 390 },
    { meal_category: 'noon', food_name: 'ארוחת עוף ותפוח אדמה מזינה (150ג חזה עוף + 200ג תפוד + כףחומוס + סלט עגבניות + ירקות)', calories: 520 },
    { meal_category: 'evening', food_name: 'ארוחת קופסה קלילה (200ג תפוד + 2 ביצים קשות + מאפינס קוטג + שרי)', calories: 415 },
    { meal_category: 'evening', food_name: 'ארוחת קופסה משביעה (150ג חזה עוף + 100ג אורז לבן + ירקות)', calories: 350 },
    { meal_category: 'evening', food_name: 'ארוחת אורז וביצים (100ג אורז + 2 ביצים קשות + מאפינס קוטג + רבע מאפינס טונה + חמוצים)', calories: 390 },
    { meal_category: 'evening', food_name: 'ארוחת עוף ותפוח אדמה מזינה (150ג חזה עוף + 200ג תפוד + כף חומוס + סלט עגבניות + ירקות)', calories: 520 },
    // נשנושים
    { meal_category: 'snack', food_name: 'פופקורן ביתי (50 גרם גרגרים ללא שמן)', calories: 190 },
    { meal_category: 'snack', food_name: 'יוגורט פרו (תות / וניל עוגיות) שלם', calories: 120 },
    { meal_category: 'snack', food_name: 'במבה שקית קטנה (15 גרם)', calories: 134 },
    { meal_category: 'snack', food_name: 'פרוסת עוגה', calories: 65 },
    { meal_category: 'snack', food_name: 'בננה בינונית', calories: 90 },
    { meal_category: 'snack', food_name: 'רסק תפוחים קטן (יחידה אחת)', calories: 20 },
    { meal_category: 'snack', food_name: '3 מלפפונים חמוצים', calories: 15 },
    { meal_category: 'snack', food_name: 'כף חומוס', calories: 28 },
    { meal_category: 'snack', food_name: 'נס קפה עם חלב שיבולת שועל', calories: 60 }
];

let currentUsername = '';

// פונקציה לאתחול החיבור לשרת
function initSupabase() {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    } else {
        console.error('Supabase library is not loaded yet!');
        return false;
    }
}

// הפעלה ראשונית
document.addEventListener('DOMContentLoaded', () => {
    initSupabase();
    initTabs();

    const savedUser = localStorage.getItem('weekwise_user');
    if (savedUser) {
        if (!supabaseClient && window.supabase) {
            initSupabase();
        }
        loginUser(savedUser);
    }

    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) {
        btnLogin.addEventListener('click', () => {
            if (!supabaseClient) {
                const initialized = initSupabase();
                if (!initialized) {
                    alert('המערכת עדיין בטעינה, אנא נסי שוב בעוד שנייה.');
                    return;
                }
            }
            const usernameVal = document.getElementById('username-input').value.trim();
            if (usernameVal) {
                loginUser(usernameVal);
            } else {
                alert('אנא הקלידי שם משתמש');
            }
        });
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', logoutUser);
    }

    const btnAddPreset = document.getElementById('btn-add-preset');
    if (btnAddPreset) {
        btnAddPreset.addEventListener('click', addCustomPreset);
    }

    const btnSaveNewSlot = document.getElementById('btn-save-new-slot');
    if (btnSaveNewSlot) {
        btnSaveNewSlot.addEventListener('click', saveScheduleSlotFromAdder);
    }

    const btnDeleteSlotSpecific = document.getElementById('btn-delete-slot-specific');
    if (btnDeleteSlotSpecific) {
        btnDeleteSlotSpecific.addEventListener('click', deleteScheduleSlotFromAdder);
    }

    const btnClearWeek = document.getElementById('btn-clear-entire-week');
    if (btnClearWeek) {
        btnClearWeek.addEventListener('click', clearEntireWeeklySchedule);
    }

    const btnSaveWeight = document.getElementById('btn-save-weight');
    if (btnSaveWeight) {
        btnSaveWeight.addEventListener('click', saveNewWeightRecord);
    }
});

// פונקציית כניסה למערכת
async function loginUser(username) {
    currentUsername = username;
    localStorage.setItem('weekwise_user', username);

    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('display-user').innerText = username;

    const dateInput = document.getElementById('selected-date');
    const today = new Date().toISOString().split('T')[0];
    
    if (dateInput) {
        dateInput.value = today;
        loadDailyNutrition(today);
        
        dateInput.onchange = (e) => {
            loadDailyNutrition(e.target.value);
        };
    }

    const weightDateInput = document.getElementById('new-weight-date');
    if (weightDateInput) {
        weightDateInput.value = today;
    }

    if (username.toLowerCase() === 'eden') {
        await checkAndSetupEdenPresets();
    }

    // טעינת נתונים
    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();
    loadStats();
    loadAllCenterItems();
    loadMealPresetsToSelects();
    loadProgressTargets();
    loadWeightHistory();

    const btnSave = document.getElementById('btn-save-nutrition');
    if (btnSave) {
        btnSave.onclick = saveNutrition;
    }

    const btnCopy = document.getElementById('btn-copy-yesterday');
    if (btnCopy) {
        btnCopy.onclick = copyFromYesterday;
    }
}

// פונקציית התנתקות
function logoutUser() {
    localStorage.removeItem('weekwise_user');
    location.reload();
}

// טעינה אוטומטית של הארוחות של עדן לראשונה
async function checkAndSetupEdenPresets() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('meal_presets')
        .select('id')
        .eq('username', currentUsername)
        .limit(1);

    if (error) return;

    if (!data || data.length === 0) {
        for (let preset of edenDefaultPresets) {
            await supabaseClient.from('meal_presets').insert({
                username: currentUsername,
                meal_category: preset.meal_category,
                food_name: preset.food_name,
                calories: preset.calories
            });
        }
    }
}

// מנגנון ניווט טאבים
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTabId = button.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active-tab');
                if (content.id === targetTabId) {
                    content.classList.add('active-tab');
                }
            });
        });
    });
}

// פונקציה שמחשבת את התאריך המדויק לכל יום בשבוע הנוכחי
function getFormattedDateForDay(dayIndex) {
    const current = new Date();
    const currentDayOfWeek = current.getDay();
    
    const distanceToSunday = currentDayOfWeek; 
    const sundayDate = new Date(current);
    sundayDate.setDate(current.getDate() - distanceToSunday);
    
    const targetDate = new Date(sundayDate);
    targetDate.setDate(sundayDate.getDate() + dayIndex);
    
    const day = targetDate.getDate();
    const month = targetDate.getMonth() + 1;
    
    return `${day}.${month}`;
}

// בניית האקורדיון עם תאריך מצד ימין עדין וללא אימוג'י
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
                    <button class="btn-delete-slot" onclick="clearSingleSlot('${dbDay}', ${i})" title="מחק משימה">❌</button>
                </div>
            `;
        }

        itemDiv.innerHTML = `
            <div class="accordion-header" onclick="toggleAccordion('${dbDay}')">
                <span style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-size: 0.85rem; color: var(--accent-purple-light); font-weight: normal; min-width: 35px; display: inline-block;">${dateStr}</span>
                    <span style="color: #3c4261; font-weight: normal;">|</span>
                    <span>יום ${dayName}</span>
                </span>
                <span class="accordion-icon">▼</span>
            </div>
            <div class="accordion-content">
                <div class="slots-grid">${slotsHTML}</div>
            </div>
        `;
        container.appendChild(itemDiv);
    });
}

// פתיחה וסגירה של יום בלו"ז בלחיצה
function toggleAccordion(day) {
    const item = document.getElementById(`accordion-${day}`);
    if (!item) return;

    const isActive = item.classList.contains('active');
    document.querySelectorAll('.accordion-item').forEach(el => {
        if (el.id !== 'accordion-weight-card') {
            el.classList.remove('active');
        }
    });

    if (!isActive) {
        item.classList.add('active');
    }
}

// טעינת הלו"ז השבועי
async function loadWeeklySchedule() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('weekly_schedule')
        .select('*')
        .eq('username', currentUsername);

    if (error) {
        console.error('Error loading schedule:', error);
        return;
    }

    data.forEach(item => {
        const slotEl = document.querySelector(`[data-day="${item.day_of_week}"][data-slot="${item.slot_number}"]`);
        if (slotEl) {
            if (item.time_of_day !== undefined && item.time_of_day !== null && item.time_of_day !== '') {
                slotEl.querySelector('.slot-time').value = item.time_of_day;
            }
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

// שמירת חריץ לו"ז בודד ברגע שמקלידים ישירות בתוכו
async function saveScheduleSlot(day, slot) {
    if (!supabaseClient) return;
    const slotEl = document.querySelector(`[data-day="${day}"][data-slot="${slot}"]`);
    if (!slotEl) return;
    const timeVal = slotEl.querySelector('.slot-time').value;
    let taskVal = slotEl.querySelector('.slot-task').value.trim();

    taskVal = taskVal.replace(/^(🔋|📚)\s*/, '');

    const { data: existing } = await supabaseClient
        .from('weekly_schedule')
        .select('id, task_color')
        .eq('username', currentUsername)
        .eq('day_of_week', day)
        .eq('slot_number', slot)
        .maybeSingle();

    const color = existing ? (existing.task_color || 'pink') : 'pink';

    if (existing) {
        await supabaseClient
            .from('weekly_schedule')
            .update({ time_of_day: timeVal, task_title: taskVal })
            .eq('id', existing.id);
    } else {
        await supabaseClient
            .from('weekly_schedule')
            .insert({ username: currentUsername, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal, task_color: color });
    }

    loadWeeklySchedule();
}

// הוספת/עדכון משימה דרך החלונית למטה
async function saveScheduleSlotFromAdder() {
    if (!supabaseClient) return;
    
    const day = document.getElementById('add-slot-day').value;
    const slot = parseInt(document.getElementById('add-slot-num').value);
    const timeVal = document.getElementById('add-slot-time').value.trim();
    const taskVal = document.getElementById('add-slot-task').value.trim();
    const colorVal = document.querySelector('input[name="slot-color"]:checked').value;

    if (!timeVal || !taskVal) {
        alert('אנא הזיני שעה ושם משימה לשמירה.');
        return;
    }

    const { data: existing } = await supabaseClient
        .from('weekly_schedule')
        .select('id')
        .eq('username', currentUsername)
        .eq('day_of_week', day)
        .eq('slot_number', slot)
        .maybeSingle();

    if (existing) {
        await supabaseClient
            .from('weekly_schedule')
            .update({ time_of_day: timeVal, task_title: taskVal, task_color: colorVal })
            .eq('id', existing.id);
    } else {
        await supabaseClient
            .from('weekly_schedule')
            .insert({ username: currentUsername, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal, task_color: colorVal });
    }

    alert('המשימה נשמרה בלו"ז בהצלחה!');
    
    document.getElementById('add-slot-time').value = '';
    document.getElementById('add-slot-task').value = '';

    toggleAccordion(day);
    loadWeeklySchedule();
}

// כפתור מחיקת/ניקוי משימה ספציפית דרך חלונית הניהול
async function deleteScheduleSlotFromAdder() {
    if (!supabaseClient) return;

    const day = document.getElementById('add-slot-day').value;
    const slot = parseInt(document.getElementById('add-slot-num').value);

    const confirmClear = confirm(`האם למחוק את משימה #${slot} ביום שבחרת?`);
    if (!confirmClear) return;

    await clearSingleSlot(day, slot);
    alert('המשימה נמחקה בהצלחה!');
    
    toggleAccordion(day);
}

// מחיקת משימה בודדת מחריץ לו"ז
async function clearSingleSlot(day, slot) {
    if (!supabaseClient) return;

    await supabaseClient
        .from('weekly_schedule')
        .delete()
        .eq('username', currentUsername)
        .eq('day_of_week', day)
        .eq('slot_number', slot);

    const slotEl = document.querySelector(`[data-day="${day}"][data-slot="${slot}"]`);
    if (slotEl) {
        slotEl.querySelector('.slot-task').value = '';
        slotEl.classList.remove('task-pink', 'task-purple');
        slotEl.querySelector('.slot-time').value = defaultHours[slot - 1];
    }
}

// מחיקת ואיפוס כל הלו"ז השבועי
async function clearEntireWeeklySchedule() {
    if (!supabaseClient) return;

    const confirmClear = confirm('האם את בטוחה שברצונך למחוק ולנקות את כל הלו"ז השבועי של כל הימים? פועלה זו אינה ניתנת לביטול.');
    if (!confirmClear) return;

    const { error } = await supabaseClient
        .from('weekly_schedule')
        .delete()
        .eq('username', currentUsername);

    if (error) {
        alert('שגיאה באיפוס הלו"ז.');
        return;
    }

    alert('הלו"ז השבועי אופס ונוקה בהצלחה!');
    
    buildWeeklyScheduleAccordionUI();
    loadWeeklySchedule();
}

// טעינת ארוחות מוכנות
async function loadMealPresetsToSelects() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('meal_presets')
        .select('*')
        .eq('username', currentUsername);

    if (error) {
        console.error('Error loading presets:', error);
        return;
    }

    const selectElements = document.querySelectorAll('.preset-select');
    selectElements.forEach(select => {
        const category = select.getAttribute('data-category');
        select.innerHTML = '<option value="">📋 בחרי ארוחה קבועה...</option>';

        const filtered = data.filter(item => {
            if (category === 'morning') return item.meal_category === 'morning';
            if (category === 'snack') return item.meal_category === 'snack';
            if (category === 'noon' || category === 'evening') {
                return item.meal_category === 'noon' || item.meal_category === 'evening';
            }
            return false;
        });

        filtered.forEach(preset => {
            const option = document.createElement('option');
            option.value = preset.calories;
            option.textContent = `${preset.food_name} (${preset.calories} קל')`;
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

// הוספת ארוחה מוכנה
async function addCustomPreset() {
    if (!supabaseClient) return;
    const name = document.getElementById('new-preset-name').value.trim();
    const calories = parseInt(document.getElementById('new-preset-calories').value) || 0;
    const category = document.getElementById('new-preset-category').value;

    if (!name || calories <= 0) {
        alert('אנא הזיני שם ארוחה וכמות קלוריות תקינה.');
        return;
    }

    const { error } = await supabaseClient.from('meal_presets').insert({
        username: currentUsername,
        meal_category: category,
        food_name: name,
        calories: calories
    });

    if (error) {
        alert('שגיאה בשמירת הארוחה המוכנה.');
        return;
    }

    alert('הארוחה נוספה למאגר בהצלחה!');
    document.getElementById('new-preset-name').value = '';
    document.getElementById('new-preset-calories').value = '';
    
    loadMealPresetsToSelects();
}

// טעינת התזונה לתאריך נבחר
async function loadDailyNutrition(date) {
    if (!supabaseClient) return;
    document.querySelectorAll('.meal-row').forEach(row => {
        row.querySelector('.food-input').value = '';
        row.querySelector('.calories-input').value = '';
        row.querySelector('.preset-select').value = '';
    });

    const { data, error } = await supabaseClient
        .from('calorie_tracker')
        .select('*')
        .eq('username', currentUsername)
        .eq('date', date);

    if (error) {
        console.error('Error loading nutrition:', error);
        return;
    }

    let totalToday = 0;
    data.forEach(item => {
        const row = document.querySelector(`[data-meal="${item.meal_type}"]`);
        if (row) {
            row.querySelector('.food-input').value = item.food_description || '';
            row.querySelector('.calories-input').value = item.calories || '';
            totalToday += item.calories || 0;
        }
    });

    const todayElement = document.getElementById('calories-today');
    if (todayElement) todayElement.innerText = totalToday;
}

// שמירת התפריט של היום
async function saveNutrition() {
    if (!supabaseClient) return;
    const dateInput = document.getElementById('selected-date');
    if (!dateInput) return;
    const date = dateInput.value;
    const mealRows = document.querySelectorAll('.meal-row');

    for (let row of mealRows) {
        const mealType = row.getAttribute('data-meal');
        const food = row.querySelector('.food-input').value;
        const cals = parseInt(row.querySelector('.calories-input').value) || 0;

        const { data: existing } = await supabaseClient
            .from('calorie_tracker')
            .select('id')
            .eq('username', currentUsername)
            .eq('date', date)
            .eq('meal_type', mealType)
            .maybeSingle();

        if (existing) {
            await supabaseClient
                .from('calorie_tracker')
                .update({ food_description: food, calories: cals })
                .eq('id', existing.id);
        } else {
            await supabaseClient
                .from('calorie_tracker')
                .insert({ username: currentUsername, date: date, meal_type: mealType, food_description: food, calories: cals });
        }
    }

    alert('התזונה נשמרה בהצלחה!');
    loadDailyNutrition(date);
    loadStats();
}

// שכפול תפריט מיום קודם
async function copyFromYesterday() {
    if (!supabaseClient) return;
    const dateInput = document.getElementById('selected-date');
    if (!dateInput) return;
    const currentDate = dateInput.value;
    
    const yesterdayObj = new Date(currentDate);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayDateStr = yesterdayObj.toISOString().split('T')[0];

    const { data: yesterdayData, error = null } = await supabaseClient
        .from('calorie_tracker')
        .select('*')
        .eq('username', currentUsername)
        .eq('date', yesterdayDateStr);

    if (error || !yesterdayData || yesterdayData.length === 0) {
        alert('לא נמצא תפריט שמור מאתמול לשכפול.');
        return;
    }

    yesterdayData.forEach(item => {
        const row = document.querySelector(`[data-meal="${item.meal_type}"]`);
        if (row) {
            row.querySelector('.food-input').value = item.food_description || '';
            row.querySelector('.calories-input').value = item.calories || 0;
        }
    });

    alert('התפריט מאתמול הועתק! אל תשכחי ללחוץ על "שמור תפריט להיום" לאחר העדכונים.');
}

// טעינת ממוצעים וסטטיסטיקות
async function loadStats() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('calorie_tracker')
        .select('date, calories')
        .eq('username', currentUsername);
        
    if (error || !data) return;

    const dailyTotals = {};
    data.forEach(item => {
        dailyTotals[item.date] = (dailyTotals[item.date] || 0) + item.calories;
    });

    const values = Object.values(dailyTotals);
    if (values.length === 0) return;

    const totalSum = values.reduce((sum, val) => sum + val, 0);
    const average = Math.round(totalSum / values.length);

    const weeklyEl = document.getElementById('calories-weekly');
    if (weeklyEl) weeklyEl.innerText = average; 

    const monthlyEl = document.getElementById('calories-monthly');
    if (monthlyEl) monthlyEl.innerText = average;
}

// ======================== Focus ⚡ ========================

async function addCenterItem(type) {
    if (!supabaseClient) return;
    const inputEl = document.getElementById(`add-${type}-input`);
    if (!inputEl) return;
    const content = inputEl.value.trim();

    if (!content) return;

    const { error } = await supabaseClient.from('my_center_tasks').insert({
        username: currentUsername,
        task_type: type,
        content: content
    });

    if (error) {
        console.error('Error adding list item:', error);
        return;
    }

    inputEl.value = '';
    loadCenterItems(type);
}

async function loadCenterItems(type) {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('my_center_tasks')
        .select('*')
        .eq('username', currentUsername)
        .eq('task_type', type)
        .order('created_at', { ascending: true });

    if (error) {
        console.error(`Error loading ${type}:`, error);
        return;
    }

    const listUl = document.getElementById(`${type}-list`);
    if (!listUl) return;
    listUl.innerHTML = '';

    data.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${item.content}</span>
            <button class="btn-delete-item" onclick="deleteCenterItem('${item.id}', '${type}')">❌</button>
        `;
        listUl.appendChild(li);
    });
}

function loadAllCenterItems() {
    loadCenterItems('important');
    loadCenterItems('weekly');
    loadCenterItems('general');
}

async function deleteCenterItem(id, type) {
    if (!supabaseClient) return;
    const { error } = await supabaseClient
        .from('my_center_tasks')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting item:', error);
        return;
    }

    loadCenterItems(type);
}

// ======================== מדים שבועיים ========================

async function addProgressTarget() {
    if (!supabaseClient) return;
    const nameInput = document.getElementById('progress-name-input');
    const targetInput = document.getElementById('progress-target-input');

    const name = nameInput.value.trim();
    const targetVal = parseInt(targetInput.value) || 0;

    if (!name || targetVal <= 0) {
        alert('אנא הזיני שם מטרה ויעד תקין (גדול מ-0)');
        return;
    }

    const { error } = await supabaseClient.from('weekly_progress_targets').insert({
        username: currentUsername,
        target_name: name,
        current_val: 0,
        target_val: targetVal
    });

    if (error) {
        console.error('Error saving progress target:', error);
        return;
    }

    nameInput.value = '';
    targetInput.value = '';
    loadProgressTargets();
}

async function loadProgressTargets() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient
        .from('weekly_progress_targets')
        .select('*')
        .eq('username', currentUsername)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error loading progress targets:', error);
        return;
    }

    const container = document.getElementById('progress-container');
    if (!container) return;
    container.innerHTML = '';

    if (data.length === 0) {
        container.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center;">אין יעדים שבועיים פעילים. הוסיפי אחד למעלה! 📈</p>`;
        return;
    }

    data.forEach(item => {
        const percentage = Math.min(Math.round((item.current_val / item.target_val) * 100), 100);
        const isCompleted = item.current_val >= item.target_val;

        const row = document.createElement('div');
        row.className = 'progress-row';
        row.innerHTML = `
            <div class="progress-info">
                <span class="progress-title">${item.target_name}</span>
                <div class="progress-counter">
                    <button class="btn-counter" onclick="changeProgressVal('${item.id}', -1)">-</button>
                    <span style="font-weight: bold; min-width: 40px; text-align: center;">${item.current_val} / ${item.target_val}</span>
                    <button class="btn-counter" onclick="changeProgressVal('${item.id}', 1)">+</button>
                    <button class="btn-delete-item" onclick="deleteProgressTarget('${item.id}')" style="margin-right: 5px;">❌</button>
                </div>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill ${isCompleted ? 'completed' : ''}" style="width: ${percentage}%;"></div>
            </div>
        `;
        container.appendChild(row);
    });
}

async function changeProgressVal(id, change) {
    if (!supabaseClient) return;

    const { data: item } = await supabaseClient
        .from('weekly_progress_targets')
        .select('*')
        .eq('id', id)
        .single();

    if (!item) return;

    let newVal = item.current_val + change;
    if (newVal < 0) newVal = 0;

    const { error } = await supabaseClient
        .from('weekly_progress_targets')
        .update({ current_val: newVal })
        .eq('id', id);

    if (error) {
        console.error('Error updating progress:', error);
        return;
    }

    loadProgressTargets();
}

async function deleteProgressTarget(id) {
    if (!supabaseClient) return;

    const { error } = await supabaseClient
        .from('weekly_progress_targets')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting target:', error);
        return;
    }

    loadProgressTargets();
}

// ======================== ⚖️ מעקב משקל תקופתי ========================

function toggleWeightAccordion() {
    const content = document.getElementById('weight-accordion-content');
    const icon = document.getElementById('weight-icon');
    const card = document.getElementById('accordion-weight-card');
    
    if (!content || !icon) return;

    if (content.style.maxHeight === '0px' || content.style.maxHeight === '') {
        content.style.maxHeight = '500px';
        icon.style.transform = 'rotate(180deg)';
        card.style.borderColor = 'var(--accent-purple)';
    } else {
        content.style.maxHeight = '0px';
        icon.style.transform = 'rotate(0deg)';
        card.style.borderColor = 'var(--border-color)';
    }
}

async function saveNewWeightRecord() {
    if (!supabaseClient) return;

    const weightInput = document.getElementById('new-weight-val');
    const dateInput = document.getElementById('new-weight-date');

    const weight = parseFloat(weightInput.value);
    const dateVal = dateInput.value;

    if (!weight || weight <= 0 || !dateVal) {
        alert('אנא הזיני משקל תקין ותאריך.');
        return;
    }

    const { error } = await supabaseClient.from('weight_tracker').insert({
        username: currentUsername,
        weight_date: dateVal,
        weight_value: weight
    });

    if (error) {
        console.error('Error saving weight record:', error);
        alert('שגיאה בשמירת המשקל בדאטהבייס.');
        return;
    }

    weightInput.value = '';
    loadWeightHistory();
}

async function loadWeightHistory() {
    if (!supabaseClient) return;

    const { data, error } = await supabaseClient
        .from('weight_tracker')
        .select('*')
        .eq('username', currentUsername)
        .order('weight_date', { ascending: false });

    if (error) {
        console.error('Error loading weight history:', error);
        return;
    }

    const listUl = document.getElementById('weight-history-list');
    if (!listUl) return;
    listUl.innerHTML = '';

    if (data.length === 0) {
        listUl.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-secondary); text-align: center; margin: 5px 0 0 0;">אין משקלים שמורים עדיין. הוסיפי את השקילה הראשונה שלך! ⚖️</p>`;
        return;
    }

    data.forEach(item => {
        const dateParts = item.weight_date.split('-');
        const formattedDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;

        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-weight: 800; color: var(--accent-pink); font-size: 1.05rem;">${item.weight_value} ק"ג</span>
                <span style="font-size: 0.8rem; color: var(--text-secondary);">ב- ${formattedDate}</span>
            </div>
            <button class="btn-delete-item" onclick="deleteWeightRecord('${item.id}')" title="מחק שקילה">❌</button>
        `;
        listUl.appendChild(li);
    });
}

async function deleteWeightRecord(id) {
    if (!supabaseClient) return;

    const confirmDelete = confirm('האם למחוק שקילה זו מההיסטוריה?');
    if (!confirmDelete) return;

    const { error } = await supabaseClient
        .from('weight_tracker')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting weight record:', error);
        return;
    }

    loadWeightHistory();
}
