// הגדרות החיבור ל-Supabase שלך
const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co'; 
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt'; 

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const daysOfWeek = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// הפעלה ראשונית
document.addEventListener('DOMContentLoaded', () => {
    // קביעת תאריך ברירת מחדל להיום
    const dateInput = document.getElementById('selected-date');
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;

    // בניית ממשק הלו"ז השבועי
    buildWeeklyScheduleUI();
    
    // טעינת נתונים
    loadWeeklySchedule();
    loadDailyNutrition(today);
    loadStats();

    // מאזיני אירועים
    dateInput.addEventListener('change', (e) => {
        loadDailyNutrition(e.target.value);
    });

    document.getElementById('btn-save-nutrition').addEventListener('click', saveNutrition);
    document.getElementById('btn-copy-yesterday').addEventListener('click', copyFromYesterday);
});

// בניית תיבות הלו"ז הריקות (6 משימות לכל יום)
function buildWeeklyScheduleUI() {
    const container = document.querySelector('.schedule-container');
    container.innerHTML = '';

    daysOfWeek.forEach((dayName, dayIndex) => {
        const dbDay = dbDaysMap[dayIndex];
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-column';
        
        let slotsHTML = '';
        for (let i = 1; i <= 6; i++) {
            slotsHTML += `
                <div class="slot-input-group" data-day="${dbDay}" data-slot="${i}">
                    <input type="text" placeholder="שעה (למשל: 18:00)" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})">
                    <input type="text" placeholder="משימה ${i}" class="slot-task" onchange="saveScheduleSlot('${dbDay}', ${i})">
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

// טעינת הלו"ז השבועי מהדאטהבייס
async function loadWeeklySchedule() {
    const { data, error } = await supabaseClient.from('weekly_schedule').select('*');
    if (error) {
        console.error('Error loading schedule:', error);
        return;
    }

    data.forEach(item => {
        const slotEl = document.querySelector(`[data-day="${item.day_of_week}"][data-slot="${item.slot_number}"]`);
        if (slotEl) {
            slotEl.querySelector('.slot-time').value = item.time_of_day || '';
            slotEl.querySelector('.slot-task').value = item.task_title || '';
        }
    });
}

// שמירת חריץ לו"ז בודד ברגע שמקלידים
async function saveScheduleSlot(day, slot) {
    const slotEl = document.querySelector(`[data-day="${day}"][data-slot="${slot}"]`);
    const timeVal = slotEl.querySelector('.slot-time').value;
    const taskVal = slotEl.querySelector('.slot-task').value;

    // נבדוק קודם אם השורה הזו כבר קיימת בדאטהבייס
    const { data: existing } = await supabaseClient
        .from('weekly_schedule')
        .select('id')
        .eq('day_of_week', day)
        .eq('slot_number', slot)
        .maybeSingle();

    if (existing) {
        // עדכון
        await supabaseClient
            .from('weekly_schedule')
            .update({ time_of_day: timeVal, task_title: taskVal })
            .eq('id', existing.id);
    } else {
        // יצירה מחדש
        await supabaseClient
            .from('weekly_schedule')
            .insert({ day_of_week: day, slot_number: slot, time_of_day: timeVal, task_title: taskVal });
    }
}

// טעינת התזונה לתאריך נבחר
async function loadDailyNutrition(date) {
    // איפוס שדות
    document.querySelectorAll('.meal-row').forEach(row => {
        row.querySelector('.food-input').value = '';
        row.querySelector('.calories-input').value = '';
    });

    const { data, error } = await supabaseClient
        .from('calorie_tracker')
        .select('*')
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

    document.getElementById('calories-today').innerText = totalToday;
}

// שמירת התפריט של היום
async function saveNutrition() {
    const date = document.getElementById('selected-date').value;
    const mealRows = document.querySelectorAll('.meal-row');

    for (let row of mealRows) {
        const mealType = row.getAttribute('data-meal');
        const food = row.querySelector('.food-input').value;
        const cals = parseInt(row.querySelector('.calories-input').value) || 0;

        // בדיקה אם קיים
        const { data: existing } = await supabaseClient
            .from('calorie_tracker')
            .select('id')
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
                .insert({ date: date, meal_type: mealType, food_description: food, calories: cals });
        }
    }

    alert('התזונה נשמרה בהצלחה!');
    loadDailyNutrition(date);
    loadStats();
}

// פונקציית הקסם: שכפול תפריט מיום קודם
async function copyFromYesterday() {
    const currentDate = document.getElementById('selected-date').value;
    
    // מציאת התאריך של אתמול
    const yesterdayObj = new Date(currentDate);
    yesterdayObj.setDate(yesterdayObj.getDate() - 1);
    const yesterdayDateStr = yesterdayObj.toISOString().split('T')[0];

    // שליפת הנתונים של אתמול
    const { data: yesterdayData, error } = await supabaseClient
        .from('calorie_tracker')
        .select('*')
        .eq('date', yesterdayDateStr);

    if (error || !yesterdayData || yesterdayData.length === 0) {
        alert('לא נמצא תפריט שמור מאתמול לשכפול.');
        return;
    }

    // הדבקת הנתונים לתוך התיבות בדפדפן (המשתמשת צריכה ללחוץ על "שמור" כדי שזה יישמר רשמית להיום)
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
    const { data, error } = await supabaseClient.from('calorie_tracker').select('date, calories');
    if (error || !data) return;

    // נחשב סכומים לפי תאריכים
    const dailyTotals = {};
    data.forEach(item => {
        dailyTotals[item.date] = (dailyTotals[item.date] || 0) + item.calories;
    });

    const values = Object.values(dailyTotals);
    if (values.length === 0) return;

    // חישוב ממוצעים פשוטים לתצוגה
    const totalSum = values.reduce((sum, val) => sum + val, 0);
    const average = Math.round(totalSum / values.length);

    document.getElementById('calories-weekly').innerText = average; 
    document.getElementById('calories-monthly').innerText = average;
}
