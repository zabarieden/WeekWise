// הגדרות החיבור ל-Supabase שלך
const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt'; 

let supabaseClient;

const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// שעות ברירת מחדל לקוביות הלו"ז
const defaultHours = ['07:00', '09:00', '11:00', '13:00', '15:00', '17:00'];

// משימות מוכנות לבחירה בלו"ז השבועי
const defaultTasksList = [
    'פילאטיס', 'אימון כח', 'לשבת לסחור', 'נסיעה לבויילר', 
    'היפ הופ', 'ריצה', 'הליכה', 'עבודה בקפה', 
    'שיעור גיטרה', 'שיעור פיתוח קול', 'שיעור פסנתר', 'זמן למידה'
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
    { meal_category: 'noon', food_name: 'ארוחת עוף ותפוח אדמה מזינה (150ג חזה עוף + 200ג תפוד + כף חומוס + סלט עגבניות + ירקות)', calories: 520 },
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

// פונקציה אמינה לאתחול החיבור לשרת
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
    // ננסה לאתחל את החיבור
    const isReady = initSupabase();

    // אתחול מנגנון הטאבים
    initTabs();

    // בדיקת כניסה קודמת בזיכרון המקומי של הדפדפן
    const savedUser = localStorage.getItem('weekwise_user');
    if (savedUser) {
        if (!supabaseClient && window.supabase) {
            initSupabase();
        }
        loginUser(savedUser);
    }

    // כפתור כניסה
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

    // כפתור התנתקות
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', logoutUser);
    }

    // כפתור הוספת ארוחה מוכנה למאגר
    const btnAddPreset = document.getElementById('btn-add-preset');
    if (btnAddPreset) {
        btnAddPreset.addEventListener('click', addCustomPreset);
    }
});

// פונקציית כניסה למערכת
async function loginUser(username) {
    currentUsername = username;
    // שמירה בזיכרון של הדפדפן כדי שלא תצטרכי להיכנס כל פעם מחדש!
    localStorage.setItem('weekwise_user', username);

    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'block';
    document.getElementById('display-user').innerText = username;

    // הגדרת תאריך ברירת מחדל
    const dateInput = document.getElementById('selected-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.value = today;
        loadDailyNutrition(today);
        
        // מניעת כפל מאזינים
        dateInput.onchange = (e) => {
            loadDailyNutrition(e.target.value);
        };
    }

    // אם המשתמש הוא Eden, נבדוק ונטען עבורה את ארוחות ברירת המחדל
    if (username.toLowerCase() === 'eden') {
        await checkAndSetupEdenPresets();
    }

    // טעינת נתונים
    buildWeeklyScheduleUI();
    loadWeeklySchedule();
    loadStats();
    loadAllCenterItems();
    loadMealPresetsToSelects();

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

// בניית תיבות הלו"ז
function buildWeeklyScheduleUI() {
    const container = document.querySelector('.schedule-container');
    if (!container) return;
    container.innerHTML = '';

    let optionsHTML = defaultTasksList.map(task => `<option value="${task}">`).join('');
    const datalistId = 'default-tasks-datalist';
    let datalistEl = document.getElementById(datalistId);
    if (!datalistEl) {
        datalistEl = document.createElement('datalist');
        datalistEl.id = datalistId;
        datalistEl.innerHTML = optionsHTML;
        document.body.appendChild(datalistEl);
    }

    daysOfWeek.forEach((dayName, dayIndex) => {
        const dbDay = dbDaysMap[dayIndex];
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-card';
        
        let slotsHTML = '';
        for (let i = 1; i <= 6; i++) {
            const defaultHour = defaultHours[i - 1];
            slotsHTML += `
                <div class="slot-input-group" data-day="${dbDay}" data-slot="${i}">
                    <input type="text" value="${defaultHour}" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})">
                    <input type="text" placeholder="משימה ${i}" class="slot-task" list="${datalistId}" onchange="saveScheduleSlot('${dbDay}', ${i})">
                </div>
            `;
        }

        dayDiv.innerHTML = `
            <div class="day-name">${dayName}</div>
            <div class="slots-grid">${slotsHTML}</div>
        `;
        container.appendChild(dayDiv);
    });
}

// טעינת הלו"ז של המשתמש הנוכחי
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
        }
    });
}

// שמירת חריץ לו"ז בודד ברגע שמקלידים
async function saveScheduleSlot(day, slot) {
    if (!supabaseClient) return;
    const slotEl = document.querySelector(`[data-day="${day}"][data-slot="${slot}"]`);
    if (!slotEl) return;
    const timeVal = slotEl.querySelector('.slot-time').value;
    const taskVal = slotEl.querySelector('.slot-task').value;

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
            .update({ time_of_day: timeVal, task_title: taskVal })
            .eq('id', existing.id);
    } else {
        await supabaseClient
            .from('weekly_schedule')
            .insert({ username: currentUsername, day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal });
    }
}

// טעינת הארוחות המוכנות של המשתמש והשמתן בתיבות הבחירה
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

// הוספת ארוחה מוכנה חדשה דרך המסך
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

// פונקציית הקסם: שכפול תפריט מיום קודם
async function copyFromYesterday() {
    if (!supabaseClient) return;
    const dateInput = document.getElementById('selected-date');
    if (!dateInput) return;
    const currentDate = dateInput.value;
    
    const yesterdayObj = new Date(currentDate);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayDateStr = yesterdayObj.toISOString().split('T')[0];

    const { data: yesterdayData, error } = await supabaseClient
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

// ======================== המרכז שלי ========================

// הוספת פריט חדש למרכז שלי
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

// טעינת קטגוריה בודדת במרכז שלי
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

// טעינת כל הקטגוריות במרכז שלי במכה
function loadAllCenterItems() {
    loadCenterItems('important');
    loadCenterItems('weekly');
    loadCenterItems('general');
    loadCenterItems('shopping');
}

// מחיקת פריט מהמרכז שלי
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
