// תיקון גובה-מסך לאנדרואיד: על חלק ממכשירי/דפדפני אנדרואיד (בעיקר WebView
// מותקן כ-PWA), 100vh/100dvh לא תמיד מחריגים נכון את סרגל הניווט התחתון של
// המערכת (שלוש הנקודות/עיגול/חץ) - מה שגורם לתחתית האפליקציה (סרגל
// הטאבים) להיחתך מתחתיו. window.innerHeight תמיד מדויק לגובה הנראה בפועל,
// אז שומרים אותו כמשתנה CSS ומשתמשים בו כברירת המחדל האמינה ביותר
// (var(--app-height, 100dvh) ב-.phone-wrapper) - עדיין מתעדכן live בסיבוב/שינוי גודל
function setAppHeightVar() {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
}
setAppHeightVar();
window.addEventListener('resize', setAppHeightVar);
window.addEventListener('orientationchange', setAppHeightVar);

const SUPABASE_URL = 'https://fncssznyigwlltoqlfwh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_llIogquCGjxu5uFLst-frg_RH0-vYnt';
let supabaseClient;
const dbDaysMap = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayNameKeys = ['day_sunday', 'day_monday', 'day_tuesday', 'day_wednesday', 'day_thursday', 'day_friday', 'day_saturday'];
const weekdayShortKeys = ['weekday_short_sun', 'weekday_short_mon', 'weekday_short_tue', 'weekday_short_wed', 'weekday_short_thu', 'weekday_short_fri', 'weekday_short_sat'];
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
    applyLightMode(isLightModeOn());
    applyHighContrast(isHighContrastOn());
    applyColorFilter(getSavedColorFilter());
    applyUiScale(getUiScale());
    applyWaterFabSetting(isWaterFabOn());
    applySportFabSetting(isSportFabOn());
    applyPresetFabSetting(isPresetFabOn());
    applyFoodFabSetting(isFoodFabOn());
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
        // "שכחתי סיסמה": הקישור שנשלח במייל (resetPasswordForEmail) מחזיר את
        // המשתמשת לכתובת האפליקציה עם session תקף מסוג recovery ב-URL -
        // ה-SDK של Supabase מזהה את זה אוטומטית ויורה את האירוע הזה. פותחים
        // אותה בדיוק כמו התחברות רגילה (יש כבר session אמיתי) ואז ישר את
        // חלון "שינוי סיסמה" הקיים - אין צורך במסך/לוגיקה נפרדים לגמרי
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event === 'PASSWORD_RECOVERY' && session) {
                initAppAfterAuth(session.user);
                openModal('modal-change-password');
            }
        });
    }

    updateAuthUI();
    document.getElementById('auth-toggle-link').addEventListener('click', (e) => {
        e.preventDefault();
        authMode = authMode === 'login' ? 'signup' : 'login';
        updateAuthUI();
    });
    document.getElementById('auth-forgot-link').addEventListener('click', (e) => {
        e.preventDefault();
        authMode = 'forgot';
        updateAuthUI();
    });
    document.getElementById('auth-back-to-login-link').addEventListener('click', (e) => {
        e.preventDefault();
        authMode = 'login';
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
    document.querySelectorAll('.calories-input, .protein-input').forEach(input => {
        input.addEventListener('input', updateLiveCaloriesToday);
    });
    document.getElementById('btn-save-center-item').addEventListener('click', submitCenterItem);
    // Enter רגיל = שורה חדשה (עכשיו שזו טקסטאריה, לא input חד-שורתי) - רק
    // Ctrl/Cmd+Enter שולח, כדי שאפשר יהיה לכתוב פתק עם כמה שורות/פסקאות
    document.getElementById('center-item-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submitCenterItem();
    });
    document.getElementById('btn-connect-health').addEventListener('click', connectHealthData);
    document.getElementById('btn-ai-quick-add').addEventListener('click', handleAIQuickAdd);
});

// --- שפה: בורר-שפה משותף עם חיפוש (נפתח גם ממסך הכניסה לפני התחברות, וגם
// מהגדרות) - נבנה כרשימה מסוננת במקום <select> רגיל כי היעד הוא להוסיף
// הרבה שפות בעתיד, ורשימת select ארוכה לא נוחה לחיפוש ---
function updateLanguagePickerTriggers() {
    const flag = LANGUAGE_FLAGS[currentLang] || '🌐';
    const name = LANGUAGE_NAMES[currentLang] || currentLang;
    ['login', 'settings'].forEach(scope => {
        const flagEl = document.getElementById(`language-picker-${scope}-flag`);
        const nameEl = document.getElementById(`language-picker-${scope}-name`);
        if (flagEl) flagEl.textContent = flag;
        if (nameEl) nameEl.textContent = name;
    });
}

function openLanguagePicker() {
    const search = document.getElementById('language-search-input');
    if (search) search.value = '';
    renderLanguagePickerList('');
    openModal('modal-language-picker');
    if (search) search.focus();
}

function renderLanguagePickerList(filter) {
    const list = document.getElementById('language-picker-list');
    if (!list) return;
    const query = (filter || '').trim().toLowerCase();
    const matches = SUPPORTED_LANGUAGES.filter(lang => LANGUAGE_NAMES[lang].toLowerCase().includes(query));
    if (!matches.length) {
        list.innerHTML = `<p class="language-no-results">${t('language_no_results')}</p>`;
        return;
    }
    list.innerHTML = matches.map(lang => `
        <button type="button" class="language-picker-item${lang === currentLang ? ' active' : ''}" onclick="selectLanguageFromPicker('${lang}')">
            <span class="language-picker-flag">${LANGUAGE_FLAGS[lang] || '🌐'}</span>
            <span class="language-picker-name">${LANGUAGE_NAMES[lang]}</span>
            ${lang === currentLang ? '<span class="language-picker-check">✓</span>' : ''}
        </button>
    `).join('');
}

function selectLanguageFromPicker(lang) {
    setLanguage(lang);
    closeModal('modal-language-picker');
}

function onLanguageChanged() {
    updateLanguagePickerTriggers();
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
    let proteinTotal = 0;
    document.querySelectorAll('.protein-input').forEach(input => {
        proteinTotal += parseFloat(input.value) || 0;
    });
    todayCaloriesTotal = total;
    todayProteinTotal = proteinTotal;
    updateNutritionGoalProgress();
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
    // is_someday קודם (false לפני true) כדי שקטע "להגיע לזה" תמיד ייפול בסוף
    // הרשימה; בתוך כל קבוצה - sort_order ידני (שנקבע ע"י גרירה בפתקים), ורק
    // פריטים בלי אחד עדיין (חדשים/מלפני התכונה) נופלים לסוף לפי created_at -
    // אותו דפוס כמו ב-calendar_events
    const { data, error } = await supabaseClient.from('my_center_tasks').select('*').eq('user_id', currentUserId).eq('task_type', type).eq('is_deleted', false).order('is_someday', { ascending: true }).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true });
    if (error) { showAppToast(t('error_loading_list') + error.message, 'error'); return; }
    if (!data) return;
    const listUl = document.getElementById(`${type}-list`);
    listUl.innerHTML = '';
    // קטע "להגיע לזה" (רק לפתקים, לא לרשימת קניות) - לא תיבת גרירה נפרדת
    // כמו "היום"/"מחר", אלא שורת מפריד בתוך אותה רשימה בדיוק; גוררים פתק
    // מעליה למטה כדי לסמן "לא דחוף", לפי בקשה מפורשת. מוצגת תמיד (גם בלי
    // אף פתק "להגיע לזה" עדיין) כדי שיהיה תמיד יעד גרירה ברור בתחתית
    let dividerInserted = false;
    data.forEach(item => {
        if (type === 'weekly' && item.is_someday && !dividerInserted) {
            listUl.appendChild(buildNoteSomedayDivider());
            dividerInserted = true;
        }
        const li = document.createElement('li');
        li.setAttribute('data-item-id', item.id);
        // ידית גרירה רק לפתקים (weekly) - רשימת הקניות אין לה יעדי גרירה משלה,
        // לפי בקשה מפורשת (רק פתקים נגררים - כולל אל "רשימת קניות" כיעד)
        const dragHandle = type === 'weekly' ? `<span class="note-drag-handle">⠿</span>` : '';
        li.innerHTML = `
            ${dragHandle}
            <button class="btn-complete-item${item.is_completed ? ' checked' : ''}" onclick="toggleTaskStatus('${item.id}', ${item.is_completed}, '${type}')">
                ${item.is_completed ? '✓' : ''}
            </button>
            <span class="center-list-item-text${item.is_completed ? ' completed' : ''}">
                ${escapeHtmlForReport(item.content)}
            </span>
            <button class="btn-edit-item" onclick="openCenterItemEditor(this, '${type}')" title="${t('edit_btn')}">✏️</button>
            <button class="btn-delete-item" onclick="deleteCenterItem('${item.id}', '${type}')">❌</button>
        `;
        listUl.appendChild(li);
    });
    if (type === 'weekly' && !dividerInserted) listUl.appendChild(buildNoteSomedayDivider());
    initNoteTriageDragDrop(type);
    refreshNotesArchiveCount(type);
}

function buildNoteSomedayDivider() {
    const li = document.createElement('li');
    li.className = 'center-list-divider';
    const label = document.createElement('span');
    label.textContent = t('note_someday_section_label');
    li.appendChild(label);
    return li;
}

// --- גרירת פתק אל "היום"/"מחר"/"רשימת קניות": ה-שניים הראשונים הופכים אותו
// למשימה מתוזמנת אמיתית (calendar_events), אותה טבלה בדיוק שכבר מזינה את
// "מבט ליומן", "משימות להיום" ולוח החודש - אז זה "נכנס ללו"ז החודשי" אוטומטית
// בלי שום קוד נוסף באותם מסכים. "רשימת קניות" רק מעביר את הפתק לרשימת
// הקניות (task_type). בכל המקרים הפתק המקורי נמחק/עובר (לא מועתק).
// רלוונטי רק לכרטיס הפתקים (type='weekly') - לרשימת קניות עצמה אין יעדי
// גרירה משלה, לפי בקשה מפורשת ---
const noteTriageInitialized = {};
function initNoteTriageDragDrop(type) {
    if (noteTriageInitialized[type] || typeof Sortable === 'undefined') return;
    const list = document.getElementById(`${type}-list`);
    const todayZone = document.getElementById(`note-triage-today-${type}`);
    const tomorrowZone = document.getElementById(`note-triage-tomorrow-${type}`);
    const shoppingZone = document.getElementById(`note-triage-shopping-${type}`);
    if (!list || !todayZone || !tomorrowZone) return;
    noteTriageInitialized[type] = true;

    new Sortable(list, {
        group: { name: `note-triage-${type}`, pull: 'clone', put: false },
        handle: '.note-drag-handle',
        // מפריד "להגיע לזה" הוא לא פתק - אי אפשר "לתפוס" אותו ולגרור אותו
        // בעצמו, רק פתקים נגררים מעליו/מתחתיו
        filter: '.center-list-divider',
        animation: 150,
        forceFallback: true,
        fallbackOnBody: true,
        // sort:true - אפשר גם לסדר-מחדש בתוך הרשימה עצמה (לא רק לגרור החוצה
        // אל אחד מאזורי הטריאז'), לפי בקשה מפורשת
        sort: true,
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        // dragClass: מזהה ייחודי לשכפול הצף הזה בלבד - כי הכלל הגלובלי
        // .sortable-fallback{display:none} (עבור גרירת-סידור-מחדש של שעות/
        // אירועים, ששם השורה החיה ברשימה היא המשוב) לא מתאים כאן: זו גרירה
        // אל יעד אחר לגמרי (עם pull:'clone'), אז חייבים שכפול גלוי שעוקב
        // אחרי האצבע - אחרת נראה כאילו הפריט "נעלם" עד שמשחררים
        dragClass: 'note-triage-drag-clone',
        // onEnd (לא onSort/onUpdate) כדי לתפוס גם גרירה שמסתיימת מחוץ לרשימה
        // (evt.from !== evt.to אז) בלי לשמור סדר מיותר - רק סידור-מחדש אמיתי
        // בתוך אותה רשימה (evt.from === evt.to) שומר sort_order חדש. עובר על
        // כל הילדים כולל המפריד עצמו כדי לדעת אילו פתקים נמצאים אחריו (=
        // "להגיע לזה", is_someday=true) ואילו לפניו - נקבע מחדש בכל גרירה,
        // לא רק כשהמפריד עצמו "זז" (הוא לא זז - הפתקים זזים סביבו)
        onEnd: function (evt) {
            if (evt.from !== evt.to) return;
            let isSomeday = false;
            let sortIndex = 0;
            const updates = [];
            Array.from(evt.from.children).forEach(child => {
                if (child.classList.contains('center-list-divider')) { isSomeday = true; return; }
                const id = child.getAttribute('data-item-id');
                if (!id) return;
                sortIndex += 1;
                const payload = { sort_order: sortIndex * 10 };
                if (type === 'weekly') payload.is_someday = isSomeday;
                updates.push(supabaseClient.from('my_center_tasks').update(payload).eq('id', id));
            });
            Promise.all(updates);
        },
    });
    const zones = [todayZone, tomorrowZone];
    if (shoppingZone) zones.push(shoppingZone);
    zones.forEach(zone => {
        new Sortable(zone, {
            group: { name: `note-triage-${type}`, pull: false, put: true },
            animation: 150,
            forceFallback: true,
            onAdd: function (evt) {
                const itemId = evt.item.getAttribute('data-item-id');
                const textEl = evt.item.querySelector('.center-list-item-text');
                const content = textEl ? textEl.textContent.trim() : '';
                evt.item.remove();
                handleNoteTriageDrop(itemId, zone.getAttribute('data-triage'), content, type);
            },
        });
    });
}

async function handleNoteTriageDrop(itemId, triageType, content, type) {
    if (!supabaseClient || !currentUserId || !content) return;

    // "לרשימת קניות" הוא לא המרה לאירוע-לוח שנה כמו היום/מחר - זו רק העברה
    // של אותה שורה בין task_type-ים ('weekly' -> 'general'), בלי מחיקה/יצירה
    if (triageType === 'shopping') {
        await supabaseClient.from('my_center_tasks').update({ task_type: 'general' }).eq('id', itemId);
        loadCenterItems('weekly');
        loadCenterItems('general');
        showAppToast(t('note_triage_success_shopping'));
        return;
    }

    const targetDate = triageType === 'tomorrow' ? getLocalDateString(new Date(Date.now() + 86400000)) : getLocalDateString();
    // source: 'note_task' - לא 'calendar' (ברירת המחדל) - כדי שזה יופיע בלוח
    // החודשי וב"משימות להיום" (שם לא מסננים לפי source) אבל לא ב"מבט ליומן"
    await supabaseClient.from('calendar_events').insert({ username: currentUsername, user_id: currentUserId, event_title: content, event_date: targetDate, source: 'note_task' });
    await supabaseClient.from('my_center_tasks').delete().eq('id', itemId);
    loadCenterItems(type);
    loadTodayTasks();
    loadMonthlyCalendarGrid();
    loadCalendarEvents();
    showAppToast(t(triageType === 'tomorrow' ? 'note_triage_success_tomorrow' : 'note_triage_success_today'));
}

// --- ניהול ארוחות (מוטמע מחדש במלואו) ---
let editingPresetId = null;
let cachedPresets = [];
const MEAL_PRESET_FREE_LIMIT = 10;

async function addCustomPreset() {
    const nameInput = document.getElementById('new-preset-name');
    const caloriesInput = document.getElementById('new-preset-calories');
    const descriptionInput = document.getElementById('new-preset-description');
    const name = nameInput.value.trim();
    const calories = parseInt(caloriesInput.value) || 0;
    const description = descriptionInput.value.trim();
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
        await supabaseClient.from('meal_presets').update({ meal_category: category, food_name: name, calories: calories, description: description || null }).eq('id', editingPresetId);
        showAppToast(t('preset_updated_success'));
        cancelPresetEdit();
    } else {
        await supabaseClient.from('meal_presets').insert({ username: currentUsername, user_id: currentUserId, meal_category: category, food_name: name, calories: calories, description: description || null });
        showAppToast(t('preset_added_success'));
    }
    nameInput.value = '';
    caloriesInput.value = '';
    descriptionInput.value = '';
    loadMealPresetsToSelects();
    loadPresetManageList();
}

function editPreset(id) {
    const preset = cachedPresets.find(p => p.id === id);
    if (!preset) return;
    editingPresetId = id;
    document.getElementById('new-preset-name').value = preset.food_name;
    document.getElementById('new-preset-calories').value = preset.calories;
    document.getElementById('new-preset-description').value = preset.description || '';
    document.getElementById('new-preset-category').value = preset.meal_category;
    document.getElementById('btn-add-preset').textContent = t('preset_update_btn');
}

function cancelPresetEdit() {
    editingPresetId = null;
    document.getElementById('new-preset-name').value = '';
    document.getElementById('new-preset-calories').value = '';
    document.getElementById('new-preset-description').value = '';
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
            const descriptionHtml = item.description ? `<span class="preset-picker-description">${escapeHtmlForReport(item.description)}</span>` : '';
            li.innerHTML = `
                <span class="preset-manage-name-wrap">
                    <span class="preset-manage-name">${escapeHtmlForReport(item.food_name)} (${item.calories})</span>
                    ${descriptionHtml}
                </span>
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
}

// --- בורר ארוחות קבועות: תפריט מותאם (לא <select> טבעי) שנפתח מהכפתור בראש
// כל שורת ארוחה - מציג שם+קלוריות בשורה ראשית ואת המרכיבים כטקסט קטן מתחתיו,
// משהו ש-<option> של select טבעי פשוט לא יכול להציג ---
let presetPickerTargetRow = null;
let presetPickerCategory = null;

function presetMatchesCategory(item, category) {
    if (category === 'morning') return item.meal_category === 'morning';
    if (category === 'snack') return item.meal_category === 'snack';
    return item.meal_category === 'noon' || item.meal_category === 'evening';
}

function openPresetPicker(button) {
    presetPickerTargetRow = button.closest('.meal-row');
    presetPickerCategory = button.getAttribute('data-category');
    const search = document.getElementById('preset-picker-search-input');
    if (search) search.value = '';
    renderPresetPickerList('');
    openModal('modal-preset-picker');
    if (search) search.focus();
}

function renderPresetPickerList(filter) {
    const list = document.getElementById('preset-picker-list');
    if (!list) return;
    const query = (filter || '').trim().toLowerCase();
    const matches = cachedPresets.filter(item => presetMatchesCategory(item, presetPickerCategory) && item.food_name.toLowerCase().includes(query));
    if (!matches.length) {
        list.innerHTML = `<p class="language-no-results">${t('language_no_results')}</p>`;
        return;
    }
    list.innerHTML = matches.map(item => `
        <button type="button" class="language-picker-item" onclick="selectPresetPickerItem('${item.id}')">
            <span class="language-picker-name">${escapeHtmlForReport(item.food_name)} (${item.calories})${item.description ? `<span class="preset-picker-description">${escapeHtmlForReport(item.description)}</span>` : ''}</span>
        </button>
    `).join('');
}

function selectPresetPickerItem(id) {
    const preset = cachedPresets.find(p => p.id === id);
    if (!preset || !presetPickerTargetRow) return;
    presetPickerTargetRow.querySelector('.food-input').value = preset.food_name;
    presetPickerTargetRow.querySelector('.calories-input').value = preset.calories;
    updateLiveCaloriesToday();
    closeModal('modal-preset-picker');
}

// --- הוספה מהירה (מהכפתורים הצפים): ארוחה קבועה שמורה, או מזון בטקסט חופשי -
// שתיהן נכנסות ישירות למשבצת הפנויה הבאה של calorie_tracker להיום, בלי לעבור
// דרך מסך התזונה בכלל. סדר קבוע (לא כרונולוגי) כדי שהתוצאה תמיד עקבית ---
const MEAL_TYPE_ORDER = ['meal_1', 'meal_2', 'meal_3', 'meal_4', 'snack'];

async function getTodayEmptyMealSlot() {
    const today = getLocalDateString();
    const { data } = await supabaseClient.from('calorie_tracker').select('meal_type').eq('user_id', currentUserId).eq('date', today);
    const used = new Set((data || []).map(r => r.meal_type));
    return MEAL_TYPE_ORDER.find(mt => !used.has(mt)) || null;
}

// אחרי הוספה מהירה - אם מסך התזונה היומי כבר פתוח על תאריך היום, מרעננים
// אותו מיד כדי שהשורה החדשה תיראה שם בלי צורך לצאת ולהיכנס מחדש
function refreshTodayNutritionViewIfOpen() {
    const dateInput = document.getElementById('selected-date');
    if (dateInput && dateInput.value === getLocalDateString()) loadDailyNutrition(dateInput.value);
}

async function openPresetQuickAddModal() {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const { data } = await supabaseClient.from('meal_presets').select('*').eq('user_id', currentUserId);
    cachedPresets = data || [];
    const search = document.getElementById('preset-quick-add-search');
    if (search) search.value = '';
    renderPresetQuickAddList('');
    openModal('modal-preset-quick-add');
}

// מקובצת לפי קטגוריה (בוקר/צהריים/ערב/נשנוש), אקורדיון מתקפל - אותו דפוס
// בדיוק כמו preset-category-group במסך "ניהול ארוחות קבועות" (ר' loadPresetManageList
// למעלה), כדי שרשימה ארוכה של ארוחות שמורות לא תיראה כמו בלגן שטוח אחד
// כשפותחים את הבועה הצפה. בברירת מחדל מכווצות (בניגוד למסך הניהול, ששם
// ה-ברירת מחדל מורחבת) - כאן המטרה מהירות, לא עריכה; כשמחפשים, קטגוריה
// עם תוצאה נפתחת אוטומטית כדי שהתוצאה תיראה מיד בלי צורך ללחוץ
function renderPresetQuickAddList(filter) {
    const list = document.getElementById('preset-quick-add-list');
    const emptyHint = document.getElementById('preset-quick-add-empty');
    if (!list) return;
    const query = (filter || '').trim().toLowerCase();
    if (emptyHint) emptyHint.classList.toggle('hidden', cachedPresets.length > 0);
    list.innerHTML = PRESET_CATEGORY_ORDER.map(catKey => {
        const items = cachedPresets.filter(item => item.meal_category === catKey && item.food_name.toLowerCase().includes(query));
        if (!items.length) return '';
        return `
            <div class="preset-category-group${query ? ' expanded' : ''}">
                <div class="preset-category-header" onclick="togglePresetCategory(this)">
                    <span class="preset-category-label">${t('preset_cat_' + catKey)}</span>
                    <span class="preset-category-count">${items.length}</span>
                    <span class="preset-category-chevron">▼</span>
                </div>
                <div class="preset-category-items">
                    ${items.map(item => `
                        <button type="button" class="preset-quick-add-item" onclick="logPresetQuickAdd('${item.id}')">
                            <span>${escapeHtmlForReport(item.food_name)}</span>
                            <span class="preset-quick-add-item-cal">${item.calories} ${t('calories_unit')}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// כל 5 המשבצות (meal_1..meal_4, snack) הן "משבצת אחת = שורה אחת" בכל שאר האפליקציה
// (ר' loadMealForm - כשעורכים משבצת קיימת דרך מסך התזונה, זה מעדכן את השורה
// הקיימת, לא מוסיף שורה נוספת). כשכולן תפוסות, אין אפשרות ליצור משבצת שישית -
// אז במקום לחסום עם שגיאה (שהייתה כאן קודם), מצרפים את התוספת למשבצת ה"נשנוש"
// הקיימת (מחברים קלוריות + מוסיפים לתיאור) כדי שתמיד תהיה אפשרות להוסיף עוד
async function addQuickLogEntry(foodDescription, calories) {
    const today = getLocalDateString();
    const slot = await getTodayEmptyMealSlot();
    if (slot) {
        await supabaseClient.from('calorie_tracker').insert({
            username: currentUsername, user_id: currentUserId, date: today, meal_type: slot,
            food_description: foodDescription, calories: calories, protein_grams: null,
        });
        return;
    }
    const { data: existing } = await supabaseClient.from('calorie_tracker').select('id, food_description, calories').eq('user_id', currentUserId).eq('date', today).eq('meal_type', 'snack').maybeSingle();
    if (existing) {
        await supabaseClient.from('calorie_tracker').update({
            food_description: `${existing.food_description} + ${foodDescription}`,
            calories: (existing.calories || 0) + calories,
        }).eq('id', existing.id);
    } else {
        await supabaseClient.from('calorie_tracker').insert({
            username: currentUsername, user_id: currentUserId, date: today, meal_type: 'snack',
            food_description: foodDescription, calories: calories, protein_grams: null,
        });
    }
}

async function logPresetQuickAdd(id) {
    const preset = cachedPresets.find(p => p.id === id);
    if (!preset) return;
    await addQuickLogEntry(preset.food_name, preset.calories);
    closeModal('modal-preset-quick-add');
    showAppToast(`${t('quick_add_logged_toast')} ${preset.food_name} (${preset.calories} ${t('calories_unit')})`);
    refreshTodayNutritionViewIfOpen();
}

function openFoodQuickAddModal() {
    const input = document.getElementById('food-quick-add-input');
    if (input) input.value = '';
    openModal('modal-food-quick-add');
}

async function logFoodQuickAdd() {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const input = document.getElementById('food-quick-add-input');
    const text = input ? input.value.trim() : '';
    if (!text) { showAppToast(t('quick_add_missing_text'), 'error'); return; }
    const estimate = estimateFreeTextCalories(text);
    if (!estimate || estimate <= 0) { showAppToast(t('quick_add_cant_estimate'), 'error'); return; }
    const calories = Math.round(estimate);
    await addQuickLogEntry(text, calories);
    closeModal('modal-food-quick-add');
    showAppToast(`${t('quick_add_logged_toast')} ${text} (${calories} ${t('calories_unit')})`);
    refreshTodayNutritionViewIfOpen();
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
    const passwordWrap = document.getElementById('auth-password-wrap');
    const forgotLine = document.getElementById('auth-forgot-line');
    const toggleLine = document.getElementById('auth-toggle-line');
    const backToLoginLine = document.getElementById('auth-back-to-login-line');
    if (authMode === 'forgot') {
        // מצב "שכחתי סיסמה" - אין שדה סיסמה בכלל כאן (רק אימייל), אין החלפת
        // login/signup, רק קישור חזרה. אותו submitBtn משותף, רק הפעולה
        // שקוראים לה ב-submitAuthForm משתנה לפי authMode
        subtitle.textContent = t('auth_forgot_subtitle');
        submitBtn.textContent = t('auth_forgot_submit_btn');
        passwordWrap.classList.add('hidden');
        forgotLine.classList.add('hidden');
        toggleLine.classList.add('hidden');
        backToLoginLine.classList.remove('hidden');
    } else if (authMode === 'login') {
        subtitle.textContent = t('auth_login_subtitle');
        submitBtn.textContent = t('auth_login_btn');
        toggleText.textContent = t('auth_no_account');
        toggleLink.textContent = t('auth_toggle_signup');
        passwordWrap.classList.remove('hidden');
        forgotLine.classList.remove('hidden');
        toggleLine.classList.remove('hidden');
        backToLoginLine.classList.add('hidden');
    } else {
        subtitle.textContent = t('auth_signup_subtitle');
        submitBtn.textContent = t('auth_signup_btn');
        toggleText.textContent = t('auth_have_account');
        toggleLink.textContent = t('auth_toggle_login');
        passwordWrap.classList.remove('hidden');
        forgotLine.classList.add('hidden');
        toggleLine.classList.remove('hidden');
        backToLoginLine.classList.add('hidden');
    }
    messageEl.textContent = '';
}

async function submitAuthForm() {
    const email = document.getElementById('auth-email-input').value.trim();
    const password = document.getElementById('auth-password-input').value;
    const messageEl = document.getElementById('auth-message');
    messageEl.textContent = '';
    messageEl.style.color = '';
    if (!supabaseClient) initSupabase();
    if (!supabaseClient) { messageEl.textContent = t('auth_server_error'); return; }

    if (authMode === 'forgot') {
        if (!email) { messageEl.textContent = t('auth_fill_email'); return; }
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: window.location.href.split('#')[0] });
        if (error) { messageEl.textContent = error.message; return; }
        messageEl.style.color = 'var(--accent-green)';
        messageEl.textContent = t('auth_forgot_success');
        return;
    }
    if (!email || !password) { messageEl.textContent = t('auth_fill_both'); return; }

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
        renderHomeGlance(),
        loadRecipes(),
        loadAiUsage(),
        loadPremiumStatus(),
        loadColorTheme(),
        loadMonthlyGoal(),
        loadFinanceData(),
        loadSportData(),
        loadWaterData(),
        loadHabits()
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
// כל ה-.apple-modal חולקים בדיוק אותו z-index (2000) - אם שניים פתוחים בו-
// זמנית (כמו לחיצה על "שתפי" מתוך חלון החגיגה), סדר המקור ב-DOM קובע איזה
// מהם למעלה, ולא תמיד זה החדש. סוגרים כל מודל אחר שפתוח לפני פתיחת החדש -
// כך תמיד יש לכל היותר .apple-modal אחד פתוח, בלי תלות בסדר יצירה
function openModal(modalId) {
    document.querySelectorAll('.apple-modal.open').forEach(m => { if (m.id !== modalId) m.classList.remove('open'); });
    document.getElementById(modalId).classList.add('open');
}
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

// --- לוח שבועי מצומצם במסך הבית: ימים כעמודות, שעות (רק אלה שבפועל בשימוש
// בלו"ז) כשורות, בועה צבעונית לכל משימה - שילוב של weekly_schedule (התבנית
// החוזרת, זהה בכל שבוע) עם calendar_events (אירועים חד-פעמיים בעלי תאריך
// אמיתי, לכן היחידים שבאמת משתנים בין שבוע לשבוע כשמדפדפים עם החצים) ---
let homeGlanceWeekStart = null; // Date - תחילת השבוע המוצג כרגע, מחושב עצלנית

function weekStartsMondayKey() {
    return `weekwise_week_starts_monday_${currentUserId}`;
}

function isWeekStartsMonday() {
    return localStorage.getItem(weekStartsMondayKey()) === 'true';
}

function toggleWeekStartsMonday() {
    const enabled = document.getElementById('week-start-monday-toggle').checked;
    localStorage.setItem(weekStartsMondayKey(), enabled ? 'true' : 'false');
    homeGlanceWeekStart = null; // מאפסים לשבוע הנוכחי במקום לנסות "לשמר" יישור ישן שכבר לא רלוונטי
    renderHomeGlance();
}

// מחזיר תאריך חדש = היום הראשון (ראשון או שני, לפי ההגדרה) של השבוע שמכיל
// את date - לא נוגע ב-dbDaysMap עצמו, רק קובע איך מציגים/מסדרים את העמודות
function getHomeGlanceWeekStartAnchor(date) {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dow = d.getDay();
    const offset = isWeekStartsMonday() ? (dow === 0 ? 6 : dow - 1) : dow;
    d.setDate(d.getDate() - offset);
    return d;
}

function getHomeGlanceWeekDates() {
    if (!homeGlanceWeekStart) homeGlanceWeekStart = getHomeGlanceWeekStartAnchor(new Date());
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(homeGlanceWeekStart);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    return dates;
}

function navigateHomeGlanceWeek(delta) {
    getHomeGlanceWeekDates(); // מוודא ש-homeGlanceWeekStart מאותחל
    homeGlanceWeekStart.setDate(homeGlanceWeekStart.getDate() + delta * 7);
    renderHomeGlance();
}

function resetHomeGlanceToToday() {
    homeGlanceWeekStart = null; // getHomeGlanceWeekDates יחשב מחדש את השבוע של היום
    renderHomeGlance();
}

function openHomeGlanceDatePicker() {
    const input = document.getElementById('home-glance-date-input');
    if (!input) return;
    if (input.showPicker) { try { input.showPicker(); return; } catch { /* נופל ל-click למטה */ } }
    input.click();
}

function jumpHomeGlanceToDate(dateStr) {
    if (!dateStr) return;
    const [y, m, d] = dateStr.split('-').map(Number);
    homeGlanceWeekStart = getHomeGlanceWeekStartAnchor(new Date(y, m - 1, d));
    renderHomeGlance();
}

// צבע קבוע לכל משימה חוזרת (לפי hash של שם המשימה) - כך שאותה משימה תמיד
// נראית באותו צבע, גם בין שבועות שונים, בלי שום עמודת "צבע" חדשה בטבלה.
// גרדיאנטים עדינים ושקופים (לא צבע שטוח חזק) מבין משתני ה-CSS של ערכת
// הנושא הנבחרת - אותם זוגות גרדיאנט בדיוק שכבר משמשים בכפתורים/כפתורי-FAB
// באפליקציה (למשל .btn-primary: pink->purple), רק בשקיפות נמוכה יותר לעדינות
const HOME_GLANCE_PALETTE = [
    'linear-gradient(135deg, color-mix(in srgb, var(--accent-pink) 32%, transparent), color-mix(in srgb, var(--accent-purple) 32%, transparent))',
    'linear-gradient(135deg, color-mix(in srgb, var(--accent-purple) 30%, transparent), color-mix(in srgb, var(--accent-cyan) 30%, transparent))',
    'linear-gradient(135deg, color-mix(in srgb, var(--accent-gold) 30%, transparent), color-mix(in srgb, var(--accent-pink) 30%, transparent))',
    'linear-gradient(135deg, color-mix(in srgb, var(--accent-green) 28%, transparent), color-mix(in srgb, var(--accent-cyan) 28%, transparent))',
    'linear-gradient(135deg, color-mix(in srgb, var(--accent-purple-light) 30%, transparent), color-mix(in srgb, var(--accent-purple) 30%, transparent))',
    'linear-gradient(135deg, color-mix(in srgb, var(--accent-cyan) 28%, transparent), color-mix(in srgb, var(--accent-purple-light) 28%, transparent))',
];
function colorForTaskTitle(title) {
    const str = (title || '').trim();
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
    return HOME_GLANCE_PALETTE[Math.abs(hash) % HOME_GLANCE_PALETTE.length];
}

async function renderHomeGlance() {
    const grid = document.getElementById('home-glance-grid');
    if (!grid || !supabaseClient || !currentUserId) return;
    const toggle = document.getElementById('week-start-monday-toggle');
    if (toggle) toggle.checked = isWeekStartsMonday();

    const dates = getHomeGlanceWeekDates();
    const weekStartStr = getLocalDateString(dates[0]);
    const weekEndStr = getLocalDateString(dates[6]);
    const dateLabel = document.getElementById('home-glance-date-label');
    if (dateLabel) {
        const fmt = d => d.toLocaleDateString(currentLang, { day: 'numeric', month: 'short' });
        dateLabel.textContent = `${fmt(dates[0])} - ${fmt(dates[6])}`;
    }

    const [{ data: scheduleRows }, { data: eventRows }] = await Promise.all([
        supabaseClient.from('weekly_schedule').select('id, day_of_week, time_of_day, task_title').eq('user_id', currentUserId),
        supabaseClient.from('calendar_events').select('id, event_date, event_title, event_time').eq('user_id', currentUserId).gte('event_date', weekStartStr).lte('event_date', weekEndStr),
    ]);
    const populatedRows = (scheduleRows || []).filter(r => (r.task_title || '').trim());
    const allEvents = eventRows || [];
    // אירועים עם שעה (רשות, שדה חדש) נכנסים לרשת השעות עצמה כמו משימות
    // הלו"ז; אירועים בלי שעה (רוב האירועים - למשל יום הולדת) נשארים כבועה
    // קטנה מתחת לכותרת היום, כי אין להם לאן "להיכנס" בציר השעות
    const timedEvents = allEvents.filter(ev => ev.event_time);
    const untimedEvents = allEvents.filter(ev => !ev.event_time);

    // ציר השורות: איחוד השעות הייחודיות שבפועל מופיעות אי-שם בלו"ז + באירועי
    // היומן המתוזמנים של השבוע הזה (לא כל 24 השעות, ולא defaultHours - כדי
    // שהרשת תישאר קומפקטית כמו שביקשה)
    const timeSet = new Set();
    populatedRows.forEach(r => { if (r.time_of_day) timeSet.add(r.time_of_day); });
    timedEvents.forEach(ev => timeSet.add(ev.event_time));
    const times = Array.from(timeSet).sort((a, b) => (scheduleTimeToMinutes(a) ?? 0) - (scheduleTimeToMinutes(b) ?? 0));

    grid.innerHTML = '';
    if (!times.length && !untimedEvents.length) {
        grid.innerHTML = `<p class="home-glance-empty-hint">${t('home_weekly_glance_empty')}</p>`;
        return;
    }
    const todayStr = getLocalDateString();

    grid.appendChild(document.createElement('div')).className = 'home-glance-corner';
    dates.forEach(d => {
        const header = document.createElement('div');
        header.className = 'home-glance-day-header' + (getLocalDateString(d) === todayStr ? ' today' : '');
        header.innerHTML = `<span>${t(weekdayShortKeys[d.getDay()])}</span><span class="home-glance-day-date">${d.getDate()}</span>`;
        grid.appendChild(header);
    });

    // שורת אירועים חד-פעמיים ללא שעה (calendar_events) - מוצגים כבועות קטנות
    // מתחת לכותרת היום ולא בתוך רשת השעות עצמה
    const untimedEventsByDate = {};
    untimedEvents.forEach(ev => { (untimedEventsByDate[ev.event_date] = untimedEventsByDate[ev.event_date] || []).push(ev); });
    grid.appendChild(document.createElement('div'));
    dates.forEach(d => {
        const cell = document.createElement('div');
        cell.className = 'home-glance-cell home-glance-events-cell';
        (untimedEventsByDate[getLocalDateString(d)] || []).forEach(ev => {
            const badge = document.createElement('span');
            badge.className = 'home-glance-event-badge';
            badge.textContent = ev.event_title;
            badge.onclick = () => openEditCalendarEvent(ev);
            cell.appendChild(badge);
        });
        grid.appendChild(cell);
    });

    times.forEach(time => {
        const label = document.createElement('div');
        label.className = 'home-glance-hour-label';
        label.textContent = time;
        grid.appendChild(label);
        dates.forEach(d => {
            const dbDay = dbDaysMap[d.getDay()];
            const dStr = getLocalDateString(d);
            const cell = document.createElement('div');
            cell.className = 'home-glance-cell';
            const match = populatedRows.find(r => r.day_of_week === dbDay && r.time_of_day === time);
            if (match) {
                const pill = document.createElement('span');
                pill.className = 'home-glance-task-pill';
                pill.style.background = colorForTaskTitle(match.task_title);
                pill.innerHTML = `<span class="home-glance-pill-text">${getScheduleTaskIcon(match.task_title)} ${match.task_title}</span><span class="home-glance-pill-edit-icon">✏️</span>`;
                pill.onclick = () => openGlanceTaskEditor(match.id, match.task_title, match.time_of_day);
                cell.appendChild(pill);
            }
            // אירוע מתוזמן מ"מבט ליומן" לתאריך+שעה האלה - בועה נוספת (לא
            // תחליף למשימת הלו"ז אם יש) עם גבול מקווקו כדי שיהיה ברור
            // שזה אירוע ליומן ולא משימה חוזרת, בסגנון הבועות הלא-מתוזמנות
            const eventMatch = timedEvents.find(ev => ev.event_date === dStr && ev.event_time === time);
            if (eventMatch) {
                const eventPill = document.createElement('span');
                eventPill.className = 'home-glance-task-pill is-event';
                eventPill.style.background = colorForTaskTitle(eventMatch.event_title);
                eventPill.innerHTML = `<span class="home-glance-pill-text">${getScheduleTaskIcon(eventMatch.event_title)} ${eventMatch.event_title}</span>`;
                eventPill.onclick = () => openEditCalendarEvent(eventMatch);
                cell.appendChild(eventPill);
            }
            grid.appendChild(cell);
        });
    });
}

// עריכה מהירה של משימה ישירות מהלוח השבועי המצומצם - בלי לעבור למסך "השבוע
// שלי" המלא, רק כותרת+שעה (יום/מספר-שורה כבר ידועים מהעריכה עצמה, לא רלוונטיים כאן)
let editingGlanceTaskId = null;

function openGlanceTaskEditor(id, title, time) {
    editingGlanceTaskId = id;
    document.getElementById('glance-edit-task-title-input').value = title || '';
    document.getElementById('glance-edit-task-time-input').value = time || '';
    openModal('modal-edit-glance-task');
}

async function saveGlanceTaskEdit() {
    if (!editingGlanceTaskId || !supabaseClient) return;
    const title = document.getElementById('glance-edit-task-title-input').value.trim();
    if (!title) { showAppToast(t('glance_edit_task_missing_title'), 'error'); return; }
    const timeInput = document.getElementById('glance-edit-task-time-input');
    const norm = normalizeScheduleTimeInput(timeInput.value);
    if (norm.time === null || norm.needsAmpm) { showAppToast(t('schedule_invalid_time_error'), 'error'); return; }
    const { error } = await supabaseClient.from('weekly_schedule').update({ task_title: title, time_of_day: norm.time }).eq('id', editingGlanceTaskId);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    closeModal('modal-edit-glance-task');
    showAppToast(t('glance_edit_task_saved'));
    await Promise.all([renderHomeGlance(), loadWeeklySchedule(), loadTodayTasks(), loadMonthlyCalendarGrid()]);
}

async function deleteGlanceTaskEdit() {
    if (!editingGlanceTaskId || !supabaseClient) return;
    await supabaseClient.from('weekly_schedule').delete().eq('id', editingGlanceTaskId);
    closeModal('modal-edit-glance-task');
    await Promise.all([renderHomeGlance(), loadWeeklySchedule(), loadTodayTasks(), loadMonthlyCalendarGrid()]);
}

// showTabSection: הלוגיקה המשותפת של מעבר בין מסכים ראשיים - חולצה מתוך
// מאזין-הקליק של הקוביות התחתונות (initCubesNavigation) כדי ש-switchToTab
// תוכל לשמש גם למסכים שאין להם כפתור קבוע בסרגל התחתון (כמו ספורט, שנגיש
// רק מהתפריט הצדדי, לפי בקשה מפורשת) - בלי "ללחוץ" על כפתור שלא קיים בכלל
function showTabSection(targetId) {
    const cubes = document.querySelectorAll('.bottom-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    cubes.forEach(c => c.classList.toggle('active', c.getAttribute('data-target') === targetId));
    tabContents.forEach(content => content.classList.toggle('active-tab', content.id === targetId));
    // בכל מעבר בין המסכים הראשיים, כל מסך חוזר להתחיל מרשת התת-קוביות שלו
    // (ולא נשאר "תקוע" בתוך תצוגה ממוקדת שהמשתמש פתח בביקור קודם)
    tabContents.forEach(content => closeSubView(content.id));
    // מסך הבית (רשת הקוביות הראשית) נעלם לגמרי בזמן שנמצאים בתוך מסך פנימי -
    // זו מעבר "מסך מלא" אמיתי, לא סרגל ניווט קבוע שנשאר צמוד למעלה
    const homePanel = document.querySelector('.home-hero-panel');
    if (homePanel) homePanel.classList.add('hidden');
    // לוח הימים כבר לא פעיל כברירת מחדל מרגע הטעינה (המסך הראשי הוא כעת מסך
    // הבית) - הגובה שחושב בזמן ש-schedule-section היה display:none הוא 0,
    // אז מחשבים מחדש בכל פעם שנכנסים אליו בפועל. גם קופצים בכל כניסה
    // מחדש ל"השבוע שלי" ליום *הנוכחי* בפועל - לא משאירים את היום שנצפה
    // לאחרונה (אם דפדפו קדימה ליום אחר בביקור קודם ויצאו מהמסך), כי
    // הציפייה היא שהמסך תמיד "יפתח על היום" מחדש בכל כניסה אליו
    if (targetId === 'schedule-section') {
        scrollToDay(dbDaysMap[new Date().getDay()]);
        updateActiveDayPageHeight();
    }
}

function initCubesNavigation() {
    document.querySelectorAll('.bottom-tab').forEach(cube => {
        cube.addEventListener('click', () => showTabSection(cube.getAttribute('data-target')));
    });
}

// חוזרים למסך הבית הטהור: כל המסכים הפנימיים נסגרים, קובייה אף אחת לא מסומנת
// כפעילה, ומסך הבית (רשת הקוביות) חוזר להיות היחיד המוצג
function goHome() {
    const cubes = document.querySelectorAll('.bottom-tab');
    const tabContents = document.querySelectorAll('.tab-content');
    cubes.forEach(c => c.classList.remove('active'));
    tabContents.forEach(content => { content.classList.remove('active-tab'); closeSubView(content.id); });
    const homePanel = document.querySelector('.home-hero-panel');
    if (homePanel) homePanel.classList.remove('hidden');
}

function switchToTab(targetId) {
    showTabSection(targetId);
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

// --- תפריט המבורגר: לא ניתוב חדש - קיצור-דרך מסודר-בקטגוריות שקורא בדיוק
// לאותן switchToTab/openSubTile שרשת הריבועים של מסך הבית כבר משתמשת בהן.
// נוסף לצד רשת הריבועים, לא מחליף אותה ---
function openHamburgerMenu() {
    const overlay = document.getElementById('hamburger-drawer-overlay');
    if (overlay) overlay.classList.add('open');
    // .menu-open מסתיר בכוח את כל כפתורי ה-FAB (theme.css) - נדרש כי ל-.ai-fab
    // יש z-index:99999 !important, גבוה בהרבה מהמגירה, אז הסתמכות על שכבות
    // בלבד לא מספיקה כדי שהמגירה לא תיחסם על ידו במובייל
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.add('menu-open');
}

function closeHamburgerMenu() {
    const overlay = document.getElementById('hamburger-drawer-overlay');
    if (overlay) overlay.classList.remove('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.remove('menu-open');
}

// switchToTab מפעיל קליק אמיתי על כפתור ה-bottom-tab, שמריץ סינכרונית את כל
// טיפול ה-click הרגיל (כולל closeSubView על כל המסכים) - אז openSubTile מיד אחריו
// כבר פועל על המצב הנקי והנכון, בלי תלות בשום דבר אסינכרוני
function navigateFromMenu(sectionId, subviewId) {
    closeHamburgerMenu();
    switchToTab(sectionId);
    if (subviewId) openSubTile(sectionId, subviewId);
}

// --- קיצורי דרך של ה-PWA (manifest.json shortcuts): קפיצה ישירה ללשונית מבוקשת ---
function applyPwaShortcutDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const validTargets = ['schedule-section', 'my-center-section', 'nutrition-section', 'finance-section', 'sport-section'];
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
    // בלי זה, "לוז יומי" במסך הבית ממשיך להציג את המשימה שנמחקה עד שיוצאים
    // ונכנסים לאפליקציה מחדש - היא נטענת פעם אחת בהתחלה ולא מקשיבה לשינויים
    // בלוח השבועי עצמו
    if (day === dbDaysMap[new Date().getDay()]) loadTodayTasks();
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

// --- העברת משימה מיום אחד ליום אחר בלו"ז השבועי - אין דרך לגרור-ולזרוק בין
// שתי לשוניות ימים נפרדות (הן עמודים שונים לגמרי בגלילה האופקית), אז זו
// בחירת יום קטנה במקום: מוחקים מהיום המקורי, ומוצאים/יוצרים שורה פנויה
// ביום היעד עם אותה שעה+כותרת בדיוק - אותה לוגיקת "חיפוש שורה פנויה" כמו
// applyParsedScheduleEvents, כדי לא ליצור כפילות מיותרת אם כבר יש שורה
// ריקה עם אותה שעה ביום היעד ---
let movingSlotContext = null;

function openMoveSlotToDay(day, slot) {
    const slotEl = document.querySelector(`.slot-input-group[data-day="${day}"][data-slot="${slot}"]`);
    if (!slotEl) return;
    const title = slotEl.querySelector('.slot-task').value.trim();
    if (!title) { showAppToast(t('schedule_move_slot_empty'), 'error'); return; }
    movingSlotContext = { day, slot };
    const select = document.getElementById('move-slot-day-select');
    select.innerHTML = dbDaysMap
        .filter(d => d !== day)
        .map(d => `<option value="${d}">${getDayName(dbDaysMap.indexOf(d))}</option>`)
        .join('');
    openModal('modal-move-slot-day');
}

async function confirmMoveSlotToDay() {
    if (!movingSlotContext) return;
    const { day, slot } = movingSlotContext;
    const toDay = document.getElementById('move-slot-day-select').value;
    const slotEl = document.querySelector(`.slot-input-group[data-day="${day}"][data-slot="${slot}"]`);
    if (!slotEl) { closeModal('modal-move-slot-day'); movingSlotContext = null; return; }
    const title = slotEl.querySelector('.slot-task').value.trim();
    const time = slotEl.querySelector('.slot-time').value.trim();

    getDaySlotNumbers(toDay);
    const targetSlotEls = Array.from(document.querySelectorAll(`.slot-input-group[data-day="${toDay}"]`));
    let target = targetSlotEls.find(el => !el.querySelector('.slot-task').value.trim() && el.querySelector('.slot-time').value.trim() === time);
    if (!target) target = targetSlotEls.find(el => !el.querySelector('.slot-task').value.trim());
    let targetSlotNum;
    if (target) {
        targetSlotNum = parseInt(target.getAttribute('data-slot'));
    } else {
        const nums = daySlotsConfig[toDay];
        targetSlotNum = nums.length ? Math.max(...nums) + 1 : 1;
        daySlotsConfig[toDay] = [...nums, targetSlotNum];
    }

    await removeDaySlot(day, slot);
    saveDaySlotsConfig();
    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();

    const newSlotEl = document.querySelector(`.slot-input-group[data-day="${toDay}"][data-slot="${targetSlotNum}"]`);
    if (newSlotEl) {
        newSlotEl.querySelector('.slot-time').value = time;
        const taskInput = newSlotEl.querySelector('.slot-task');
        taskInput.value = title;
        updateSlotTaskIcon(taskInput);
        await saveScheduleSlot(toDay, targetSlotNum);
    }
    movingSlotContext = null;
    closeModal('modal-move-slot-day');
    scrollToDay(toDay);
    showAppToast(t('schedule_move_slot_success'));
}

// שכפול משימה ליום *הבא* (לא בחירת יום - הכיוון תמיד ידוע וקבוע, בניגוד
// ל"העברה" למעלה) - המקור נשאר במקומו, רק נוסף עותק זהה (כותרת+שעה) ביום
// שאחריו. אותה לוגיקת "חיפוש שורה פנויה" בדיוק כמו confirmMoveSlotToDay,
// רק בלי removeDaySlot בסוף כי זה שכפול ולא העברה
async function duplicateSlotToNextDay(day, slot) {
    const slotEl = document.querySelector(`.slot-input-group[data-day="${day}"][data-slot="${slot}"]`);
    if (!slotEl) return;
    const title = slotEl.querySelector('.slot-task').value.trim();
    if (!title) { showAppToast(t('schedule_move_slot_empty'), 'error'); return; }
    const time = slotEl.querySelector('.slot-time').value.trim();
    const toDay = dbDaysMap[(dbDaysMap.indexOf(day) + 1) % 7];

    getDaySlotNumbers(toDay);
    const targetSlotEls = Array.from(document.querySelectorAll(`.slot-input-group[data-day="${toDay}"]`));
    let target = targetSlotEls.find(el => !el.querySelector('.slot-task').value.trim() && el.querySelector('.slot-time').value.trim() === time);
    if (!target) target = targetSlotEls.find(el => !el.querySelector('.slot-task').value.trim());
    let targetSlotNum;
    if (target) {
        targetSlotNum = parseInt(target.getAttribute('data-slot'));
    } else {
        const nums = daySlotsConfig[toDay];
        targetSlotNum = nums.length ? Math.max(...nums) + 1 : 1;
        daySlotsConfig[toDay] = [...nums, targetSlotNum];
    }

    saveDaySlotsConfig();
    buildWeeklyScheduleAccordionUI();
    await loadWeeklySchedule();

    const newSlotEl = document.querySelector(`.slot-input-group[data-day="${toDay}"][data-slot="${targetSlotNum}"]`);
    if (newSlotEl) {
        newSlotEl.querySelector('.slot-time').value = time;
        const taskInput = newSlotEl.querySelector('.slot-task');
        taskInput.value = title;
        updateSlotTaskIcon(taskInput);
        await saveScheduleSlot(toDay, targetSlotNum);
    }
    showAppToast(t('schedule_duplicate_slot_success'));
}

// --- מוקד ה-AI ("המוח"): מודל אחד עם שני טאבים - תכנון לו"ז מטקסט חופשי
// (פרימיום בלבד), וסריקת תמונה למתכון/ארוחה קבועה (יש לה מכסה חינמית משלה,
// אז אין שער פרימיום גורף על פתיחת המודל - כל פעולה שוערת בנפרד בזמן האמת) ---
function openAiBrainModal(tab = 'schedule') {
    document.getElementById('ai-schedule-input').value = '';
    document.getElementById('ai-finance-input').value = '';
    setScheduleAiMode('recurring');
    switchAiBrainTab(tab);
    openModal('modal-ai-brain');
}

// בררה מפורשת חד-פעמי/חוזר מעל תיבת הטקסט של תכנון הלו"ז - דורסת את מה
// שה-AI/המנתח המקומי מחליטים על סמך הניסוח (ר' applyExplicitScheduleMode
// למטה, שקוראת לפונקציה הזו בפועל). ברירת המחדל "חוזר" כי זו הבקשה השכיחה
let scheduleAiMode = 'recurring';
function setScheduleAiMode(mode) {
    scheduleAiMode = mode;
    document.querySelectorAll('.ai-schedule-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    const durationInput = document.getElementById('ai-schedule-duration-months');
    if (durationInput) {
        durationInput.classList.toggle('hidden', mode !== 'recurring');
        if (mode !== 'recurring') durationInput.value = '';
    }
}

// כופה את מצב חד-פעמי/חוזר שנבחר מפורשות על כל אירוע שחזר מה-AI/המנתח
// המקומי - בלי זה, ניסוחים מעורפלים ("אחרי שיעורי הבית") יכולים להטעות את
// הפרשנות האוטומטית (ר' התיקון בפרומפט של parse-schedule-request), אבל
// כשהמשתמשת בחרה מפורשות אין שום צורך לנחש בכלל. אירועים שממתינים
// להבהרה (needsClarification) נשארים כמו שהם - השאלה עצמה (עד/עמום-שעה)
// לא קשורה לחד-פעמי/חוזר
function applyExplicitScheduleMode(ev, mode, durationMonths) {
    if (ev.needsClarification) return ev;
    if (mode === 'recurring') {
        return { ...ev, recurring: true, event_date: null, recurring_duration_months: durationMonths || null };
    }
    let eventDate = ev.event_date;
    if (!eventDate) {
        const dayRef = Array.isArray(ev.day_of_week) ? ev.day_of_week[0] : ev.day_of_week;
        eventDate = dayRef ? nextDateForDayOfWeek(dayRef) : getLocalDateString();
    }
    return { ...ev, recurring: false, event_date: eventDate, recurring_duration_months: null };
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
    // מילות משך-זמן ("לחודשיים הקרובים") - נבדקות/מוסרות במפורש (ר'
    // findScheduleDurationMonths) לפני שהתזמון עצמו נבנה, אז לא אמורות
    // להישאר כשאריות בכותרת הפעילות עצמה. 'חודשיים'/'חודשים' חייבות לבוא
    // *לפני* 'חודש' ברשימה - אחרת 'חודש' (תת-מחרוזת שלהן) היה נתפס קודם
    // ומשאיר שארית מיותמת ("יים"/"ים")
    'חודשיים', 'חודשים', 'חודש', 'הקרובים', 'הקרוב', 'נגיד',
    'and', 'at', 'on', 'in', 'every', 'until', 'months', 'month', 'next', 'for'
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

// "כל יום"/"every day" - בלי הבדיקה הזו, קטע כזה לא מזהה אף יום ספציפי
// ונופל ל-pushScheduleEvents שממציא ברירת מחדל של "היום" בלבד (יום אחד,
// לא כל 7) - בדיוק הבאג שדווח (בקשה ל"כל יום בשבוע" נחתה רק בשבת, כי זה
// היה היום שבו זה נשלח)
const EVERY_DAY_PATTERNS = [/כל\s*(ה)?ימ(ים|ות)/, /כל\s*יום/, /\bevery\s*day\b/i, /\bdaily\b/i, /\beach\s*day\b/i];
function findScheduleDaysInText(text) {
    if (EVERY_DAY_PATTERNS.some(re => re.test(text))) return [0, 1, 2, 3, 4, 5, 6];
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
    // מרכאות/גרשיים (רגילות, בודדות, וגרשיים עבריים ״/׳) שהמשתמש הקליד סביב
    // שם הפעילות ("תרגיל נשימות") הן עיצוב, לא חלק מהשם עצמו
    let tokens = cleaned.replace(/[,."'׳״]+/g, ' ')
        .split(/\s+/)
        .filter(tok => tok && !SCHEDULE_STANDALONE_PREPOSITIONS.has(tok));
    cleaned = tokens.join(' ').trim();
    // חשוב: לא נופלים חזרה ל-text.trim() כשהניקוי מרוקן הכול - קטע שכולו
    // שעה בלי שום מילת פעילות ("ב12", " וב14") צריך להחזיר מחרוזת ריקה כדי
    // שהקוראת (parseScheduleTextLocally) תדע לרשת את הכותרת מהקטע הקודם
    // באותו משפט, במקום להציג את הטקסט הגולמי הלא-מנוקה כאילו הוא הכותרת
    return cleaned;
}

// זיהוי משך זמן מוגבל לרוטינה חוזרת ("לחודשיים הקרובים", "לשלושה חודשים",
// "for 2 months", "for the next 3 months") - כשיש כזה, האירוע לא הופך
// לרוטינה קבועה-לתמיד ב-weekly_schedule (שאין לה בכלל מושג של "משך זמן"),
// אלא לסדרה חוזרת מוגבלת ב-calendar_events (ר' applyBoundedRecurringScheduleEvents/
// generateRecurringDates - אותה טכניקה בדיוק כמו ההוספה הידנית עם "חזרה").
// "חודשיים" נבדק *לפני* "חודש" בכוונה - "חודש" הוא תת-מחרוזת של "חודשיים",
// אז הסדר הפוך היה תמיד "תופס" 1 גם כשנכתב 2
function findScheduleDurationMonths(text) {
    if (/חודשיים/.test(text)) return 2;
    // (?![א-תA-Za-z0-9_]) במקום \b בסוף - \b לא עובד אחרי מילה עברית ב-JS,
    // אז "...חודשים\b" לא היה תופס בפועל מספרים חופשיים כמו "ל-8 חודשים"
    // (רק "months" האנגלי היה עובד) - נפל תמיד לבדיקות המילוליות הקבועות למטה
    const numMatch = text.match(/(?:ל-?|for\s+(?:the\s+next\s+)?)\s*(\d+)\s*(?:חודשים|months?)(?![א-תA-Za-z0-9_])/i);
    if (numMatch) return parseInt(numMatch[1], 10);
    if (/שלושה חודשים|שלושת החודשים/.test(text)) return 3;
    if (/ארבעה חודשים/.test(text)) return 4;
    if (/חמישה חודשים/.test(text)) return 5;
    if (/שישה חודשים|חצי שנה/.test(text)) return 6;
    // אותה בעיה בדיוק - \bחודש\b עם מילה עברית לא היה תופס לעולם, אז "לחודש
    // הקרוב" (משך של חודש אחד) תמיד החזיר null במקום 1
    if (/(^|[^א-ת])חודש(?:$|[^א-ת])/.test(text)) return 1;
    return null;
}

function pushScheduleEvents(events, dayIndexes, fallbackText, title, time, durationMonths) {
    if (dayIndexes.length) {
        dayIndexes.forEach(idx => events.push({ day_of_week: dbDaysMap[idx], time, task_title: title, recurring_duration_months: durationMonths || null }));
    } else {
        // אין יום מזוהה בבירור - לא מוותרים ולא מציגים שגיאה: מוסיפים כמשימה
        // להיום עם הטקסט המקורי, בדיוק כפי שנכתב
        events.push({ day_of_week: dbDaysMap[new Date().getDay()], time, task_title: fallbackText, recurring_duration_months: durationMonths || null });
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
function pushClarificationEvents(events, dayIndexes, fallbackText, title, detail, durationMonths) {
    const base = { needsClarification: true, task_title: title, recurring_duration_months: durationMonths || null, ...detail };
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
        // "כל יום" (ולא שם יום מפורש) הופך את הקטע ל-7 ימים (ר' findScheduleDaysInText).
        // חשוב לדעת אם זו הסיבה שדווקא הקטע *הזה* קיבל ימים, כדי לזהות למטה
        // מתי קטע כזה הוא בעצם רק הקדמה/הקשר לקטע הבא ("להוסיף לכל יום...
        // נגיד" ואז בקטע הבא בפועל "פעם ב7... תרגיל נשימות") ולא בקשה בפני
        // עצמה - לא הופכים אותו למשימה גנרית ריקה
        const matchedEveryDay = EVERY_DAY_PATTERNS.some(re => re.test(clause));
        const dayIndexes = findScheduleDaysInText(clause);
        const durationMonths = findScheduleDurationMonths(clause);
        const dayWordsFound = [];
        HEBREW_DAY_TOKENS.forEach(({ index, words }) => { if (dayIndexes.includes(index)) dayWordsFound.push(...words); });
        // מסירים את מילות היום מהמשפט לפני שמחפשים שעות/מפצלים לתת-אירועים,
        // כדי שהן לא "יתפסו" בטעות כחלק מכותרת של אחד מהם
        let body = clause;
        dayWordsFound.forEach(w => { body = body.split(w).join(' '); });

        const timeMatches = findAllScheduleTimeMatches(body);

        if (!timeMatches.length) {
            const cleanedTitle = cleanScheduleTaskTitle(body, [], '');
            if (matchedEveryDay && !cleanedTitle) return;
            const title = cleanedTitle || t('schedule_ai_fallback_task_label');
            pushScheduleEvents(events, dayIndexes, clause, title, SCHEDULE_DEFAULT_TIME, durationMonths);
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
        // "פעם ב7 בבוקר ופעם ב22 בלילה, תרגיל נשימות" - כל השעות מופיעות
        // ברצף בתחילת הקטע, ושם הפעילות מגיע פעם אחת בסוף, אחרי כולן (לא
        // צמוד לאף שעה בודדת). אם יש טקסט משמעותי אחרי *כל* השעות בקטע, זו
        // כותרת משותפת לכולן - עדיפות עליונה על פני הכותרת הנגזרת מכל תת-קטע
        // (שנועדה למקרה ההפוך: "היפ הופ ב20 ועבודה ב9", שם כל שעה כן צמודה
        // לפעילות שלה, ואין בכלל טקסט אחרי השעה האחרונה)
        const sharedTrailingTitle = cleanScheduleTaskTitle(body.slice(timeMatches[timeMatches.length - 1].end), [], '');
        let cursor = 0;
        let lastTitle = '';
        timeMatches.forEach(tm => {
            const segment = body.slice(cursor, tm.end);
            let title = sharedTrailingTitle || cleanScheduleTaskTitle(segment, [], tm.time);
            if (title) lastTitle = title;
            else title = lastTitle || t('schedule_ai_fallback_task_label');

            if (tm.time.startsWith(SCHEDULE_NEEDS_CLARIFY_PREFIX)) {
                pushClarificationEvents(events, dayIndexes, clause, title, { kind: 'until', endTime: tm.time.slice(SCHEDULE_NEEDS_CLARIFY_PREFIX.length) }, durationMonths);
            } else if (tm.time.startsWith(SCHEDULE_NEEDS_AMPM_PREFIX)) {
                pushClarificationEvents(events, dayIndexes, clause, title, { kind: 'ampm', hour: tm.time.slice(SCHEDULE_NEEDS_AMPM_PREFIX.length) }, durationMonths);
            } else {
                pushScheduleEvents(events, dayIndexes, clause, title, tm.time, durationMonths);
            }
            cursor = tm.end;
        });
    });
    return events;
}

// אירועים חד-פעמיים (recurring===false, עם event_date מחושב) לא שייכים בכלל
// ללוח השבועי החוזר - הם משהו שקורה פעם אחת בתאריך ספציפי, אז נכנסים
// ל-calendar_events (אותה טבלה בדיוק כמו "מבט ליומן") ולא ל-weekly_schedule.
// זה בדיוק ההבדל בין "שיעור גיטרה בימי שני" (חוזר) ל"שבוע הבא ביום שני
// שיעור גיטרה" (פעם אחת, תאריך ספציפי) - שתי הבקשות נשמעות דומות אבל
// אמורות לנחות במקומות שונים לגמרי באפליקציה
async function applyOneTimeScheduleEvents(events) {
    if (!supabaseClient || !currentUserId) return [];
    const rows = events.filter(ev => ev.event_date).map(ev => ({
        username: currentUsername, user_id: currentUserId,
        event_title: ev.time ? `${ev.time} ${ev.task_title}` : ev.task_title,
        event_date: ev.event_date,
        source: 'calendar',
    }));
    if (!rows.length) return [];
    await supabaseClient.from('calendar_events').insert(rows);
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
    loadTodayTasks();
    return rows.map(r => r.event_date);
}

// התאריך הקרוב ביותר (כולל היום עצמו) שחל בו יום-השבוע הנתון - נקודת
// ההתחלה הדרושה ל-generateRecurringDates, שעובדת עם תאריך התחלה קונקרטי
// ולא עם שם יום (בניגוד ל-weekly_schedule)
function nextDateForDayOfWeek(dayName) {
    const targetIdx = dbDaysMap.indexOf(dayName);
    if (targetIdx < 0) return getLocalDateString();
    const today = new Date();
    const diff = (targetIdx - today.getDay() + 7) % 7;
    const result = new Date(today);
    result.setDate(result.getDate() + diff);
    return getLocalDateString(result);
}

// רוטינה חוזרת *מוגבלת בזמן* ("כל יום, לחודשיים, תרגיל נשימות") - בניגוד
// לרוטינה קבועה-לתמיד (weekly_schedule, שאין לה מושג של "עד מתי"), זו
// נכנסת ל-calendar_events בדיוק כמו סדרה חוזרת שנוצרה ידנית דרך "חזרה" -
// אותה generateRecurringDates בדיוק, רק שנקודת ההתחלה מחושבת מ-day_of_week
// במקום להיבחר בטופס. מקובצת לפי כותרת+שעה+משך (לא לפי יום) כדי שבקשה
// אחת כמו "כל יום תרגיל נשימות" (7 אירועים, יום לכל אחד) תשתף recurrence_group_id
// אחד ותימחק/תיערך כיחידה אחת, לא כ-7 סדרות נפרדות
async function applyBoundedRecurringScheduleEvents(events) {
    if (!supabaseClient || !currentUserId) return [];
    const groups = new Map();
    events.forEach(ev => {
        const key = `${ev.task_title}|${ev.time || ''}|${ev.recurring_duration_months}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(ev);
    });
    const rows = [];
    groups.forEach(groupEvents => {
        const groupId = crypto.randomUUID();
        groupEvents.forEach(ev => {
            const startDate = nextDateForDayOfWeek(ev.day_of_week);
            generateRecurringDates(startDate, 'weekly', 1, 'weeks', ev.recurring_duration_months).forEach(eventDate => {
                rows.push({
                    username: currentUsername, user_id: currentUserId,
                    event_title: ev.task_title, event_date: eventDate, event_time: ev.time || null,
                    recurrence_group_id: groupId, source: 'calendar',
                });
            });
        });
    });
    if (!rows.length) return [];
    await supabaseClient.from('calendar_events').insert(rows);
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
    loadTodayTasks();
    return rows.map(r => r.event_date);
}

// מקבצת את האירועים (מה-AI האמיתי או מהמנתח המקומי - אותה צורה בדיוק) לפי
// יום, כדי להקצות משבצת פנויה (או שורה חדשה) לכל אחד בלי שיתנגשו על אותה משבצת.
// recurring==false מנותב ל-applyOneTimeScheduleEvents במקום ללוח השבועי -
// המנתח המקומי (parseScheduleTextLocally) לא מציב בכלל recurring, ולכן
// ברירת המחדל (!== false) שומרת על ההתנהגות הישנה שם ללא שינוי. אירוע חוזר
// עם recurring_duration_months מנותב ל-applyBoundedRecurringScheduleEvents
// (מוגבל בזמן, ל-calendar_events) במקום ל-weekly_schedule (קבוע לתמיד)
async function applyParsedScheduleEvents(allEvents) {
    const oneTimeEvents = allEvents.filter(ev => ev.recurring === false);
    const oneTimeDates = oneTimeEvents.length ? await applyOneTimeScheduleEvents(oneTimeEvents) : [];
    const boundedRecurringEvents = allEvents.filter(ev => ev.recurring !== false && ev.recurring_duration_months);
    const boundedDates = boundedRecurringEvents.length ? await applyBoundedRecurringScheduleEvents(boundedRecurringEvents) : [];
    const allOneTimeDates = [...oneTimeDates, ...boundedDates];
    const events = allEvents.filter(ev => ev.recurring !== false && !ev.recurring_duration_months);
    if (!events.length) return { recurringCount: 0, oneTimeDates: allOneTimeDates };

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
    return { recurringCount: events.length, oneTimeDates: allOneTimeDates };
}

// מציגה את הודעת ההצלחה הנכונה לפי לאן בפועל נחתו הפריטים (רוטינה שבועית
// חוזרת מול תאריך ספציפי ביומן) - כדי שהמשתמש יידע מיד איפה למצוא את מה
// שהוא הרגע הוסיף, במקום הודעת "עודכן" גנרית שלא אומרת כלום על זה
function showScheduleAiSuccessToast(summary) {
    const recurringCount = (summary && summary.recurringCount) || 0;
    const oneTimeDates = (summary && summary.oneTimeDates) || [];
    if (recurringCount > 0 && oneTimeDates.length > 0) {
        showAppToast(t('schedule_ai_success_mixed'));
    } else if (oneTimeDates.length > 0) {
        const uniqueDates = [...new Set(oneTimeDates)];
        if (uniqueDates.length === 1) {
            const [y, m, d] = uniqueDates[0].split('-').map(Number);
            const dateLabel = new Date(y, m - 1, d).toLocaleDateString(currentLang, { day: 'numeric', month: 'long' });
            showAppToast(t('schedule_ai_success_onetime_date').replace('{date}', dateLabel));
        } else {
            showAppToast(t('schedule_ai_success_onetime_generic'));
        }
    } else if (recurringCount > 0) {
        showAppToast(t('schedule_ai_success_recurring'));
    } else {
        showAppToast(t('schedule_ai_success'));
    }
}

// שולחת ניסיון בודד ל-parse-schedule-request ומדווחת מה קרה - מנותקת כדי
// שאפשר יהיה לנסות שוב אוטומטית לפני נפילה למנתח המקומי (שאין לו בכלל מושג
// של "חד-פעמי מול חוזר" - ר' applyParsedScheduleEvents). תקלת רשת חד-פעמית
// היא הגורם השכיח ביותר לנפילה למנתח המקומי הנחות, בדיוק כמו ב-
// attemptRecipeCloudScan/attemptMealPhotoScan
async function attemptScheduleParse(token, text, today) {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/parse-schedule-request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text, today })
        });
        const result = await res.json();
        if (res.status === 402 || result.error === 'premium_required') return { status: 'premium_required' };
        if (result.error === 'limit_reached') return { status: 'limit' };
        if (res.ok && !result.error && result.events && result.events.length) return { status: 'ok', events: result.events };
        return { status: 'retry' };
    } catch {
        return { status: 'retry' };
    }
}

// בועת ה-AI יודעת רק "להוסיף" - אין לה שום מושג של מחיקה/הסרה, לא בענן ולא
// במנתח המקומי. בלי הבדיקה הזו, בקשת מחיקה בטקסט חופשי ("תמחקי את הריצה
// בשבת") הייתה נופלת דרך אותו נתיב ADD כמו כל בקשה אחרת, ומחלצת מהטקסט עוד
// אירוע במקום למחוק כלום - כפילות שקטה במקום מחיקה, בדיוק מה שגילינו בפועל
// (שתי כפילויות "ריצת 10 קילומטר" שנוצרו מניסיונות מחיקה). עדיף להודיע
// במפורש שזה עדיין לא נתמך מאשר ליצור נתונים שגויים בשקט
const SCHEDULE_DELETE_INTENT_WORDS = [
    'delete', 'remove', 'cancel', 'מחק', 'תמחק', 'מחיקה', 'למחוק', 'הסר', 'תסיר', 'בטל', 'תבטל',
    'eliminar', 'borrar', 'quitar', 'cancelar', 'supprimer', 'effacer', 'annuler', 'retirer',
    'احذف', 'حذف', 'ألغ', 'إلغاء', 'امسح', 'удали', 'убрать', 'отмени',
    'löschen', 'entfernen', 'streichen', 'excluir', 'apagar', 'remover',
    '削除', 'キャンセル', '删除', '取消', 'हटाओ', 'हटाना', 'मिटाओ', 'रद्द',
    '삭제', '취소', '제거', 'sil', 'iptal', 'kaldır', 'hapus', 'batalkan',
    'elimina', 'cancella', 'rimuovi', 'annulla', 'xóa', 'hủy', 'usuń', 'skasuj', 'anuluj',
    'ลบ', 'ยกเลิก', 'مٹا', 'منسوخ', 'মুছে', 'বাতিল', 'futa', 'ondoa', 'ghairi',
    'видали', 'скасувати', 'διαγραφή', 'διέγραψε', 'ακύρωσε', 'verwijder', 'annuleer',
    'esborra', 'cancel·la', 'șterge', 'anulează', 'parẹ́', 'fagilé',
    'ta bort', 'radera', 'avboka', 'slett', 'fjern', 'avbryt', 'slet', 'annuller',
    'smaž', 'odstraň', 'zruš', 'töröl', 'mégse', 'poista', 'peruuta',
];
function looksLikeScheduleDeleteRequest(text) {
    const lower = text.toLowerCase();
    return SCHEDULE_DELETE_INTENT_WORDS.some(word => lower.includes(word.toLowerCase()));
}

async function parseScheduleWithAI() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    const input = document.getElementById('ai-schedule-input');
    const text = input.value.trim();
    if (!text) { showAppToast(t('schedule_ai_empty'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    if (looksLikeScheduleDeleteRequest(text)) {
        showAppToast(t('schedule_ai_delete_not_supported'), 'error');
        return;
    }

    // מגן מפני שליחה כפולה: אין שום חיווי חזותי מיידי (showScheduleAiLoading
    // מתעכב בכוונה 5 שניות, ר' למטה), אז טאפ כפול מהיר לפני שרואים משהו
    // קורה בפועל היה יוצר שתי בקשות AI עצמאיות - כל אחת מוסיפה את האירועים
    // בנפרד, כפילות אמיתית בנתונים (בדיוק מה שדווח: אותה בקשה נחתה פעמיים)
    const submitBtn = document.getElementById('btn-schedule-ai-parse');
    if (submitBtn && submitBtn.disabled) return;
    if (submitBtn) submitBtn.disabled = true;

    const loadingTimer = setTimeout(showScheduleAiLoading, 5000);
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;

        let events = null;
        if (token) {
            const today = getLocalDateString();
            let attempt = await attemptScheduleParse(token, text, today);
            if (attempt.status === 'retry') attempt = await attemptScheduleParse(token, text, today);

            if (attempt.status === 'premium_required') { openPremiumUpgradeModal(); return; }
            // מכסת ה-AI החודשית נגמרה - לא עוצרים, פשוט ממשיכים בשקט למנתח
            // המקומי למטה (בדיוק כמו שקורה כשהענן לא זמין בכלל), רק עם
            // הודעה מפורשת שזו הסיבה לאיכות הנמוכה יותר של התוצאה הפעם
            if (attempt.status === 'limit') showAppToast(t('ai_monthly_limit_reached'), 'error');
            else if (attempt.status === 'ok') events = attempt.events;
        }

        // אם ה-AI האמיתי בענן לא זמין/לא החזיר כלום גם אחרי ניסיון חוזר, נופלים
        // בעדינות למנתח המקומי - המשתמש תמיד מקבל תוצאה, אף פעם לא מסך שגיאה
        if (!events || !events.length) events = parseScheduleTextLocally(text);

        // כפיית הבחירה המפורשת (חד-פעמי/חוזר) שנבחרה בכפתורים מעל תיבת הטקסט -
        // דורסת כל ניחוש אוטומטי, ר' applyExplicitScheduleMode
        const durationMonthsInput = document.getElementById('ai-schedule-duration-months');
        const explicitDurationMonths = durationMonthsInput ? parseInt(durationMonthsInput.value) || null : null;
        events = events.map(ev => applyExplicitScheduleMode(ev, scheduleAiMode, explicitDurationMonths));

        // "X עד Y" בלי שעת התחלה: לא מנחשים - שואלים את המשתמש בפועל (אחד
        // אחרי השני אם יש כמה), ורק אז שומרים הכול יחד עם שאר האירועים הברורים
        const clearEvents = events.filter(ev => !ev.needsClarification);
        const ambiguousEvents = events.filter(ev => ev.needsClarification);

        input.value = '';
        closeModal('modal-ai-brain');

        if (ambiguousEvents.length) {
            runScheduleClarificationFlow(ambiguousEvents, clearEvents);
        } else {
            const summary = await applyParsedScheduleEvents(clearEvents);
            showScheduleAiSuccessToast(summary);
        }
    } finally {
        clearTimeout(loadingTimer);
        hideScheduleAiLoading();
        if (submitBtn) submitBtn.disabled = false;
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
        if (startTime) scheduleClarificationResolved.push({ day_of_week: day, time: startTime, task_title: ev.task_title, recurring_duration_months: ev.recurring_duration_months });
        scheduleClarificationResolved.push({ day_of_week: day, time: ev.endTime, task_title: ev.task_title, recurring_duration_months: ev.recurring_duration_months });
    });
    closeModal('modal-schedule-clarify');
    showNextScheduleClarification();
}

function skipScheduleClarification() {
    const ev = scheduleClarificationQueue.shift();
    if (!ev) return;
    // המשתמש דילג - לא ממציאים שעת התחלה, פשוט משתמשים בשעת הסיום שכן צוינה
    ev.day_of_week.forEach(day => {
        scheduleClarificationResolved.push({ day_of_week: day, time: ev.endTime, task_title: ev.task_title, recurring_duration_months: ev.recurring_duration_months });
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
        scheduleClarificationResolved.push({ day_of_week: day, time, task_title: ev.task_title, recurring_duration_months: ev.recurring_duration_months });
    });
    closeModal('modal-schedule-clarify');
    showNextScheduleClarification();
}

async function finishScheduleClarificationFlow() {
    const allEvents = [...scheduleClarificationClearEvents, ...scheduleClarificationResolved];
    scheduleClarificationClearEvents = [];
    scheduleClarificationResolved = [];
    if (!allEvents.length) return;
    const summary = await applyParsedScheduleEvents(allEvents);
    showScheduleAiSuccessToast(summary);
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
            slotsHTML += `<div class="slot-input-group" data-day="${dbDay}" data-slot="${i}"><div class="slot-time-wrap"><span class="slot-drag-handle" title="${t('schedule_drag_handle_title')}">⠿</span><input type="text" value="${defaultHours[i-1] || ''}" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})"></div><div class="slot-task-wrap"><span class="slot-task-icon"></span><input type="text" class="slot-task" onchange="saveScheduleSlot('${dbDay}', ${i})" oninput="updateSlotTaskIcon(this)"></div><div class="slot-actions-wrap"><button class="btn-move-slot" onclick="openMoveSlotToDay('${dbDay}', ${i})" title="${t('schedule_move_slot_title')}">📅</button><button class="btn-duplicate-slot" onclick="duplicateSlotToNextDay('${dbDay}', ${i})" title="${t('schedule_duplicate_slot_title')}">⧉</button><button class="btn-delete-slot" onclick="removeDaySlot('${dbDay}', ${i})" title="${t('schedule_remove_row_title')}">❌</button></div></div>`;
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
// החוזרת) עבור יום-השבוע הנוכחי, בתוספת אירועי calendar_events שתאריכם היום
// (בעיקר משימות שנגררו מפתקים - source='note_task', אבל בלי סינון, כדי
// שגם אירועי calendar_events "כן ליום ספציפי" של היום יופיעו כאן) - כדי
// לראות מה מתוכנן היום בלי לצאת ממבט הבית וללחוץ על לשונית "השבוע שלי".
// שאילתה עצמאית (לא תלויה ב-DOM של loadWeeklySchedule), כי שתי הפונקציות
// רצות במקביל ב-Promise.all בטעינה
async function loadTodayTasks() {
    if (!supabaseClient || !currentUserId) return;
    const container = document.getElementById('today-tasks-list');
    if (!container) return;
    const todayDbDay = dbDaysMap[new Date().getDay()];
    const todayStr = getLocalDateString();
    const [{ data, error }, { data: eventRows }] = await Promise.all([
        supabaseClient.from('weekly_schedule').select('*').eq('user_id', currentUserId).eq('day_of_week', todayDbDay),
        supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).eq('event_date', todayStr),
    ]);
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
    const events = eventRows || [];
    container.innerHTML = '';
    if (!populated.length && !events.length) {
        container.innerHTML = `<p class="today-tasks-empty">${t('today_tasks_empty_hint')}</p>`;
        return;
    }
    populated.forEach(item => {
        const row = document.createElement('div');
        row.className = 'today-tasks-row';
        row.innerHTML = `<span class="today-tasks-time">${item.time_of_day || ''}</span><span class="today-tasks-text">${getScheduleTaskIcon(item.task_title)} ${escapeHtmlForReport(item.task_title)}</span>`;
        container.appendChild(row);
    });
    // משימות ללא שעה (בעיקר מפתקים גרורים) - מוצגות אחרי שורות השעות, עם
    // צ'קבוקס-השלמה וכפתור מחיקה, כמו בפירוט היום בלוח החודשי
    events.forEach(item => {
        const row = document.createElement('div');
        row.className = 'today-tasks-row';
        row.innerHTML = `
            <input type="checkbox" class="day-detail-checkbox"${item.is_completed ? ' checked' : ''} onchange="toggleEventOccurrenceCompletion('${item.id}', this.checked)">
            <span class="today-tasks-text${item.is_completed ? ' completed' : ''}">${escapeHtmlForReport(item.event_title)}</span>
        `;
        // כפתורי עריכה/מחיקה מחוברים דרך closure (לא onclick עם JSON מוטמע
        // בתוך מחרוזת HTML) - כך שגרש בודד בכותרת האירוע (למשל "It's") לא
        // שובר את התבנית או "בורח" מתוך המאפיין
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-edit-item';
        editBtn.title = t('calendar_event_edit_title');
        editBtn.textContent = '✏️';
        editBtn.onclick = () => openEditCalendarEvent(item);
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-delete-item';
        deleteBtn.textContent = '❌';
        deleteBtn.onclick = () => deleteCalendarEvent(item.id);
        row.appendChild(editBtn);
        row.appendChild(deleteBtn);
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
    // "יש דברים שאני מוסיפה בלוז והם לא במבט ליומן החודשי" - הלוח הזה הביט
    // במקור רק ב-calendar_events; עכשיו מוסיפים גם את הימים שיש בהם משימה
    // קבועה מהלו"ז השבועי (weekly_schedule), כדי שנקודה תופיע גם על יום כזה,
    // בדיוק כמו שכבר קורה בווידג'ט השבועי החדש במסך הבית
    const [{ data }, { data: recurringData }] = await Promise.all([
        supabaseClient.from('calendar_events').select('event_date').eq('user_id', currentUserId).gte('event_date', firstStr).lte('event_date', lastStr),
        supabaseClient.from('weekly_schedule').select('day_of_week, task_title').eq('user_id', currentUserId),
    ]);
    const markedDates = new Set((data || []).map(r => r.event_date));
    // כל יום מקבל מראש כמה "משבצות בסיס" ריקות (task_title:"") כדי שהרשת
    // הבסיסית בלו"ז השבועי תמיד תוצג - בלי הסינון הזה, הנקודה במבט החודשי
    // הייתה מופיעה על כל יום שכבר "בוקר" ב-MyWeek (יש לו משבצות ריקות
    // בשרת) גם אם אף פעם לא הוזנה בו משימה אמיתית, לא לפי מה שיש בפועל
    const recurringDays = new Set((recurringData || []).filter(r => (r.task_title || '').trim()).map(r => r.day_of_week));

    const todayStr = getLocalDateString();
    const startWeekday = firstDate.getDay();
    const daysInMonth = lastDate.getDate();

    let html = '';
    for (let i = 0; i < startWeekday; i++) html += `<div class="monthly-calendar-cell empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedCalendarDay;
        const hasEvents = markedDates.has(dateStr) || recurringDays.has(dbDaysMap[new Date(y, m - 1, day).getDay()]);
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
    const [y, m, d] = selectedCalendarDay.split('-').map(Number);
    const dayOfWeek = dbDaysMap[new Date(y, m - 1, d).getDay()];
    const [{ data }, { data: recurringDataRaw }] = await Promise.all([
        supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).eq('event_date', selectedCalendarDay).order('sort_order', { ascending: true }),
        supabaseClient.from('weekly_schedule').select('*').eq('user_id', currentUserId).eq('day_of_week', dayOfWeek),
    ]);
    // אותו סינון בדיוק כמו renderHomeGlance - משבצות בסיס ריקות (task_title
    // "") הן פנימיות בלבד, לא משימות אמיתיות, ולא אמורות להופיע כאן כשורות ריקות
    const recurringData = (recurringDataRaw || []).filter(r => (r.task_title || '').trim());
    const dayLabel = new Date(y, m - 1, d).toLocaleDateString(currentLang, { weekday: 'long', day: 'numeric', month: 'long' });
    if ((!data || !data.length) && (!recurringData || !recurringData.length)) {
        detail.innerHTML = `<div class="monthly-calendar-day-title">${dayLabel}</div><p class="today-tasks-empty">${t('today_tasks_empty_hint')}</p>`;
        return;
    }
    const rows = (data || []).map(item => `
        <div class="today-tasks-row">
            <input type="checkbox" class="day-detail-checkbox"${item.is_completed ? ' checked' : ''} onchange="toggleEventOccurrenceCompletion('${item.id}', this.checked)">
            <span class="today-tasks-text${item.is_completed ? ' completed' : ''}">${escapeHtmlForReport(item.event_title)}</span>
            <button type="button" class="btn-delete-item" onclick="deleteCalendarEvent('${item.id}')">❌</button>
        </div>
    `).join('');
    detail.innerHTML = `<div class="monthly-calendar-day-title">${dayLabel}</div>${rows}`;

    // המשימות הקבועות מהלו"ז השבועי מוצגות כאן בלי צ'קבוקס השלמה (הטבלה שלהן
    // לא עוקבת אחרי השלמה של מופע ספציפי, בניגוד ל-calendar_events) - רק
    // עריכה/מחיקה, דרך אותו מודל עריכה בדיוק כמו בווידג'ט השבועי במסך הבית.
    // בנוי עם closures (לא onclick עם מחרוזת מוטמעת) מאותה סיבה בדיוק כמו
    // ב-loadTodayTasks - כותרת משימה עם גרש בודד לא תשבור כלום כך
    (recurringData || []).forEach(item => {
        const row = document.createElement('div');
        row.className = 'today-tasks-row';
        row.innerHTML = `
            <span class="today-tasks-recurring-icon" title="${escapeHtmlForReport(t('home_weekly_glance_title'))}">🔁</span>
            <span class="today-tasks-text">${escapeHtmlForReport(item.task_title)}</span>
        `;
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-edit-item';
        editBtn.textContent = '✏️';
        editBtn.onclick = () => openGlanceTaskEditor(item.id, item.task_title, item.time_of_day);
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-delete-item';
        deleteBtn.textContent = '❌';
        deleteBtn.onclick = () => deleteRecurringScheduleItem(item.id);
        row.appendChild(editBtn);
        row.appendChild(deleteBtn);
        detail.appendChild(row);
    });
}

async function deleteRecurringScheduleItem(id) {
    if (!supabaseClient) return;
    await supabaseClient.from('weekly_schedule').delete().eq('id', id);
    await Promise.all([loadMonthlyCalendarGrid(), renderHomeGlance(), loadWeeklySchedule(), loadTodayTasks()]);
}

async function loadCalendarEvents() {
    if (!supabaseClient) return;
    const container = document.getElementById('calendar-glance-list');
    if (!container) return;
    const today = getLocalDateString();
    // source='calendar' בלבד - לא משימות שהומרו מפתקים גרורים (source=
    // 'note_task'). אלה מוצגות ב"משימות להיום" (loadTodayTasks) במקום כאן -
    // לפי בקשה מפורשת. שולפים גם תאריכים שכבר עברו (בלי gte כאן) - הסינון
    // "רק עתידי" נעשה למטה, אבל *ברמת הסדרה* לא ברמת התאריך הבודד: אם סדרה
    // חוזרת עדיין פעילה (יש לה לפחות מופע עתידי אחד), רוצים את *כל* התאריכים
    // שלה כולל עבר, כדי שאפשר יהיה לסמן וי גם על מופעים ישנים שהושלמו בפועל -
    // לא רק על הבא בתור. בלי זה, מופע שכבר עבר "נעלם" ואי אפשר לסמן אותו
    const { data, error } = await supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).eq('source', 'calendar');
    container.innerHTML = '';
    if (error || !data || !data.length) {
        const empty = document.createElement('div');
        empty.className = 'calendar-glance-empty';
        empty.textContent = t('calendar_glance_empty');
        container.appendChild(empty);
        return;
    }

    // מקבצים אירועים חוזרים לפי recurrence_group_id, כדי להציג פריט אחד לכל סדרה
    // (עם חץ להרחבה) במקום שורה נפרדת לכל תאריך שנוצר. אירוע חד-פעמי (בלי
    // recurrence_group_id) עדיין מסונן ל"עתידי בלבד" - הוא לא תומך בכלל
    // בסימון וי, אז אין טעם להציג אותו אחרי שהתאריך שלו עבר
    const seriesMap = new Map();
    const singleEvents = [];
    data.forEach(item => {
        if (item.recurrence_group_id) {
            if (!seriesMap.has(item.recurrence_group_id)) seriesMap.set(item.recurrence_group_id, []);
            seriesMap.get(item.recurrence_group_id).push(item);
        } else if (item.event_date >= today) {
            singleEvents.push(item);
        }
    });
    // סדרה שכל המופעים שלה כבר עברו - לא מציגים אותה בכלל (הסתיימה), רק
    // סדרות עם לפחות מופע עתידי אחד ממשיכות להופיע (עם כל התאריכים, כולל עבר)
    Array.from(seriesMap.keys()).forEach(groupId => {
        const items = seriesMap.get(groupId);
        if (!items.some(i => i.event_date >= today)) seriesMap.delete(groupId);
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
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-item';
    editBtn.textContent = '✏️';
    editBtn.title = t('calendar_event_edit_title');
    editBtn.onclick = () => openEditCalendarEvent(item);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-item';
    deleteBtn.textContent = '❌';
    deleteBtn.onclick = () => deleteCalendarEvent(item.id);
    row.appendChild(handle);
    row.appendChild(dateBadge);
    row.appendChild(titleSpan);
    row.appendChild(editBtn);
    row.appendChild(deleteBtn);
    return row;
}

function buildRecurringEventRow(items, groupId) {
    const wrap = document.createElement('div');
    wrap.className = 'calendar-event-series';
    wrap.setAttribute('data-reorder-id', groupId);
    wrap.setAttribute('data-reorder-type', 'series');

    // התאריך המוצג הוא תמיד המופע הקרוב ביותר *מהיום והלאה* - לא המופע
    // הראשון של הסדרה, שכבר יכול היה לעבור מזמן. items תמיד ממוין עולה לפי
    // תאריך (ר' loadCalendarEvents), אז items[0] הוא הראשון עם תאריך>=היום -
    // הסדרה מוצגת כאן רק אם יש לה לפחות מופע עתידי אחד (ר' סינון seriesMap)
    const todayStr = getLocalDateString();
    const nearestOccurrence = items.find(i => i.event_date >= todayStr) || items[items.length - 1];

    const header = document.createElement('div');
    header.className = 'calendar-event-item calendar-event-series-header';

    const handle = document.createElement('span');
    handle.className = 'calendar-event-drag-handle';
    handle.textContent = '⠿';
    handle.title = t('calendar_event_drag_handle_title');

    const dateBadge = document.createElement('span');
    dateBadge.className = 'calendar-event-date-badge';
    dateBadge.textContent = formatEventDateBadge(nearestOccurrence.event_date);

    // וי ישיר על המופע הקרוב ביותר, בלי צורך לפתוח את הרשימה המורחבת -
    // בדיוק בשביל זה יש כבר וי לכל מופע בנפרד ברשימה הפתוחה, רק שהיה קשה
    // למצוא/לא נגיש מספיק בלי להרחיב קודם
    const nearestCheckbox = document.createElement('input');
    nearestCheckbox.type = 'checkbox';
    nearestCheckbox.className = 'calendar-event-series-nearest-checkbox';
    nearestCheckbox.title = t('calendar_event_check_nearest_title');
    nearestCheckbox.checked = !!nearestOccurrence.is_completed;
    nearestCheckbox.onclick = (e) => e.stopPropagation();
    nearestCheckbox.onchange = () => toggleEventOccurrenceCompletion(nearestOccurrence.id, nearestCheckbox.checked);

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

    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-item';
    editBtn.textContent = '✏️';
    editBtn.title = t('calendar_event_edit_title');
    editBtn.onclick = () => openEditCalendarEventSeries(groupId, items[0].event_title);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-item';
    deleteBtn.textContent = '❌';
    deleteBtn.onclick = () => deleteRecurringSeries(groupId);

    header.appendChild(handle);
    header.appendChild(dateBadge);
    header.appendChild(nearestCheckbox);
    header.appendChild(titleSpan);
    header.appendChild(progressBadge);
    header.appendChild(toggleBtn);
    header.appendChild(editBtn);
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
        // מחיקת מופע בודד זה בלבד - להבדיל מ-❌ של כל הסדרה למעלה, שמפסיקה
        // את כל המופעים העתידיים (ר' deleteRecurringSeries). כאן נשארים כל
        // שאר המופעים העתידיים במקום, נמחק רק התאריך הספציפי הזה
        const deleteSingleBtn = document.createElement('button');
        deleteSingleBtn.type = 'button';
        deleteSingleBtn.className = 'calendar-event-series-date-delete';
        deleteSingleBtn.textContent = '❌';
        deleteSingleBtn.title = t('calendar_event_delete_occurrence_title');
        deleteSingleBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); deleteSingleSeriesOccurrence(occurrence.id); };
        line.appendChild(checkbox);
        line.appendChild(dateLabel);
        line.appendChild(deleteSingleBtn);
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
    loadTodayTasks();
    if (selectedCalendarDay) renderSelectedCalendarDay();
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

// עריכה: מזהה יחיד = עריכת אירוע בודד (שם+תאריך); מזהה קבוצה = עריכת שם
// בלבד לכל הסדרה החוזרת (שינוי תאריכים/תבנית-חזרה של סדרה קיימת הוא הרבה
// יותר מסובך ולא התבקש - רק תיקון שם משותף לכל המופעים כבר שנוצרו)
let editingCalendarEventId = null;
let editingCalendarEventGroupId = null;

function openEditCalendarEvent(item) {
    editingCalendarEventId = item.id;
    editingCalendarEventGroupId = null;
    document.getElementById('calendar-event-title-input').value = item.event_title;
    document.getElementById('calendar-event-date-input').value = item.event_date;
    document.getElementById('calendar-event-time-input').value = item.event_time || '';
    document.getElementById('modal-add-calendar-event').querySelector('h3').textContent = t('calendar_event_edit_modal_title');
    document.getElementById('btn-add-calendar-event').textContent = t('calendar_event_update_btn');
    document.querySelector('.calendar-event-recurring-toggle').classList.add('hidden');
    document.getElementById('calendar-event-recurring-options').classList.add('hidden');
    // עריכת אירוע בודד (למשל לחיצה על בועת אירוע ברשת השבועית במסך הבית) -
    // הייתה נקודת קצה שבה אין שום דרך למחוק בכלל, כי הכפתור הזה לא היה קיים
    // עד עכשיו. במצב עריכת סדרה (openEditCalendarEventSeries) הוא נשאר מוסתר
    // בכוונה - מחיקת סדרה שלמה היא פעולה נפרדת עם הכפתור הייעודי שלה ברשימה
    document.getElementById('btn-delete-calendar-event').classList.remove('hidden');
    openModal('modal-add-calendar-event');
}

function openEditCalendarEventSeries(groupId, currentTitle) {
    editingCalendarEventId = null;
    editingCalendarEventGroupId = groupId;
    document.getElementById('calendar-event-title-input').value = currentTitle;
    document.getElementById('calendar-event-date-input').value = '';
    document.getElementById('calendar-event-date-input').classList.add('hidden');
    document.getElementById('calendar-event-time-input').value = '';
    document.getElementById('calendar-event-time-input').classList.add('hidden');
    document.getElementById('modal-add-calendar-event').querySelector('h3').textContent = t('calendar_event_edit_modal_title');
    document.getElementById('btn-add-calendar-event').textContent = t('calendar_event_update_btn');
    document.querySelector('.calendar-event-recurring-toggle').classList.add('hidden');
    document.getElementById('calendar-event-recurring-options').classList.add('hidden');
    document.getElementById('btn-delete-calendar-event').classList.add('hidden');
    openModal('modal-add-calendar-event');
}

function resetCalendarEventModal() {
    editingCalendarEventId = null;
    editingCalendarEventGroupId = null;
    document.getElementById('calendar-event-title-input').value = '';
    document.getElementById('calendar-event-date-input').value = '';
    document.getElementById('calendar-event-date-input').classList.remove('hidden');
    document.getElementById('calendar-event-time-input').value = '';
    document.getElementById('calendar-event-time-input').classList.remove('hidden');
    document.getElementById('calendar-event-recurring-checkbox').checked = false;
    toggleRecurringOptionsVisibility();
    document.querySelector('.calendar-event-recurring-toggle').classList.remove('hidden');
    document.getElementById('modal-add-calendar-event').querySelector('h3').textContent = t('calendar_event_modal_title');
    document.getElementById('btn-add-calendar-event').textContent = t('calendar_event_add_btn');
    document.getElementById('btn-delete-calendar-event').classList.add('hidden');
}

async function addCalendarEvent() {
    const titleInput = document.getElementById('calendar-event-title-input');
    const dateInput = document.getElementById('calendar-event-date-input');
    const recurringCheckbox = document.getElementById('calendar-event-recurring-checkbox');
    const recurrenceTypeSelect = document.getElementById('calendar-event-recurrence-type');
    const customIntervalInput = document.getElementById('calendar-event-custom-interval');
    const customUnitSelect = document.getElementById('calendar-event-custom-unit');
    const durationSelect = document.getElementById('calendar-event-duration-input');
    const timeInput = document.getElementById('calendar-event-time-input');
    const title = titleInput.value.trim();
    const date = dateInput.value;
    // הזמן רשות לגמרי - לא כל אירוע ביומן הוא "בשעה מסוימת" (למשל יום הולדת)
    const timeNorm = normalizeScheduleTimeInput(timeInput.value);
    if (timeInput.value.trim() && (timeNorm.time === null || timeNorm.needsAmpm)) { showAppToast(t('schedule_invalid_time_error'), 'error'); return; }
    const eventTime = timeNorm.time || null;
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }

    if (editingCalendarEventGroupId) {
        if (!title) { showAppToast(t('calendar_event_missing_fields'), 'error'); return; }
        const { error } = await supabaseClient.from('calendar_events').update({ event_title: title }).eq('recurrence_group_id', editingCalendarEventGroupId);
        if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
        resetCalendarEventModal();
        closeModal('modal-add-calendar-event');
        showAppToast(t('calendar_event_updated_success'));
        loadCalendarEvents();
        loadMonthlyCalendarGrid();
        loadTodayTasks();
        return;
    }
    if (editingCalendarEventId) {
        if (!title || !date) { showAppToast(t('calendar_event_missing_fields'), 'error'); return; }
        const { error } = await supabaseClient.from('calendar_events').update({ event_title: title, event_date: date, event_time: eventTime }).eq('id', editingCalendarEventId);
        if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
        resetCalendarEventModal();
        closeModal('modal-add-calendar-event');
        showAppToast(t('calendar_event_updated_success'));
        loadCalendarEvents();
        loadMonthlyCalendarGrid();
        loadTodayTasks();
        return;
    }

    if (!title || !date) { showAppToast(t('calendar_event_missing_fields'), 'error'); return; }

    let rows;
    if (recurringCheckbox.checked) {
        const months = parseInt(durationSelect.value) || 3;
        const recurrenceType = recurrenceTypeSelect.value;
        const customInterval = parseInt(customIntervalInput.value) || 1;
        const customUnit = customUnitSelect.value;
        const groupId = crypto.randomUUID();
        rows = generateRecurringDates(date, recurrenceType, customInterval, customUnit, months).map(eventDate => ({
            username: currentUsername, user_id: currentUserId,
            event_title: title, event_date: eventDate, event_time: eventTime, recurrence_group_id: groupId
        }));
    } else {
        rows = [{ username: currentUsername, user_id: currentUserId, event_title: title, event_date: date, event_time: eventTime, recurrence_group_id: null }];
    }

    const { error } = await supabaseClient.from('calendar_events').insert(rows);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    titleInput.value = '';
    dateInput.value = '';
    timeInput.value = '';
    recurringCheckbox.checked = false;
    toggleRecurringOptionsVisibility();
    closeModal('modal-add-calendar-event');
    showAppToast(t('item_added_success'));
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
    loadTodayTasks();
}

async function deleteCalendarEvent(id) {
    await supabaseClient.from('calendar_events').delete().eq('id', id);
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
    loadTodayTasks();
    if (selectedCalendarDay) renderSelectedCalendarDay();
}

// מוחקים רק מהיום והלאה - לא את כל הסדרה, כדי שהיסטוריית העבר (כולל מה
// שכבר סומן כהושלם) תישאר נגישה בלוח החודשי גם אחרי שמפסיקים סדרה חוזרת,
// לפי בקשה מפורשת ("שאוכל לראות שעשיתי את זה בעבר" גם אחרי מחיקה)
async function deleteRecurringSeries(groupId) {
    const todayStr = getLocalDateString();
    await supabaseClient.from('calendar_events').delete().eq('recurrence_group_id', groupId).gte('event_date', todayStr);
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
    loadTodayTasks();
}

// מוחקת מופע ספציפי אחד בלבד מתוך סדרה חוזרת - כל שאר המופעים (כולל עתידיים)
// נשארים במקום, בניגוד ל-deleteRecurringSeries שמפסיקה את כולם מהיום והלאה
async function deleteSingleSeriesOccurrence(id) {
    await supabaseClient.from('calendar_events').delete().eq('id', id);
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
    loadTodayTasks();
    if (selectedCalendarDay) renderSelectedCalendarDay();
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
    document.getElementById('recipe-servings-input').value = '';
    document.getElementById('recipe-ingredients-input').value = '';
    document.getElementById('recipe-instructions-input').value = '';
    setRecipeImagePreview('');
    setRecipeCaloriesEstimateHint(false);
    updateRecipeCaloriesPerServingHint();
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
    document.getElementById('recipe-servings-input').value = recipe.servings || '';
    document.getElementById('recipe-ingredients-input').value = recipe.ingredients || '';
    document.getElementById('recipe-instructions-input').value = recipe.instructions || '';
    setRecipeImagePreview(recipe.image_url || '');
    setRecipeCaloriesEstimateHint(false);
    updateRecipeCaloriesPerServingHint();
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
    const servings = parseInt(document.getElementById('recipe-servings-input').value) || null;
    const ingredients = document.getElementById('recipe-ingredients-input').value.trim();
    const instructions = document.getElementById('recipe-instructions-input').value.trim();
    const imageUrl = document.getElementById('recipe-image-url-input').value.trim();
    if (!title) { showAppToast(t('recipe_title_required'), 'error'); return; }
    if (!category) { showAppToast(t('recipe_category_required'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }

    const payload = { title, category, calories, servings, ingredients, instructions };
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

    // שורת סיכום קלוריות-למנה בסוף ההוראות (רק כשיש גם סך-קלוריות וגם מספר
    // מנות) - מחושבת חיה מהשדות ולא "אפויה" לתוך טקסט ההוראות עצמו, כדי
    // שאם המשתמשת תערוך את הכמות/הקלוריות בעתיד השורה תתעדכן לבד ולא
    // תישאר כפולה/מיושנת בטקסט הגולמי
    if (recipe.calories && recipe.servings) {
        const perServing = Math.round(recipe.calories / recipe.servings);
        const p = document.createElement('p');
        p.className = 'recipe-detail-calories-summary';
        p.textContent = `${t('recipe_total_calories_label')} ${recipe.calories} ${t('calories_unit')} · ${perServing} ${t('recipe_calories_per_serving_unit')}`;
        instructionsEl.appendChild(p);
    }

    document.getElementById('recipe-detail-view').classList.add('open');
}

// מחשבת ומציגה חיה "X קלוריות למנה" מתחת לשדה מספר-המנות, בזמן מילוי/עריכת
// הטופס - לפני השמירה, כדי שהמשתמשת תראה מיד את החלוקה בלי לשמור קודם
function updateRecipeCaloriesPerServingHint() {
    const hint = document.getElementById('recipe-calories-per-serving-hint');
    if (!hint) return;
    const calories = parseInt(document.getElementById('recipe-calories-input').value) || 0;
    const servings = parseInt(document.getElementById('recipe-servings-input').value) || 0;
    if (calories > 0 && servings > 0) {
        hint.textContent = `≈${Math.round(calories / servings)} ${t('recipe_calories_per_serving_unit')}`;
        hint.classList.remove('hidden');
    } else {
        hint.textContent = '';
        hint.classList.add('hidden');
    }
}

function closeRecipeDetail() {
    currentDetailRecipeId = null;
    document.getElementById('recipe-detail-view').classList.remove('open');
}

// שיתוף מתכון - טקסט פשוט (שם, קלוריות, מצרכים, הוראות), דרך אותו תפריט
// שיתוף קטן (וואטסאפ/מייל/העתקת קישור) שכבר משמש לשיתוף הישג יעד חודשי
function shareRecipe() {
    const recipe = cachedRecipes.find(r => r.id === currentDetailRecipeId);
    if (!recipe) return;
    let text = `🍽️ ${recipe.title}`;
    if (recipe.calories) text += ` (${recipe.calories} ${t('calories_unit')})`;
    if (recipe.ingredients) text += `\n\n${t('recipe_ingredients_label')}:\n${recipe.ingredients}`;
    if (recipe.instructions) text += `\n\n${t('recipe_instructions_label')}:\n${recipe.instructions}`;
    openSharePicker(text, '');
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
// tier שנקרא בפועל מ-user_premium.tier (אם העמודה קיימת) - null כשאין את
// העמודה עדיין או שאין לה ערך. isDevSuperuserAccount מבדיל בין פרימיום אמיתי
// (רשומה ב-DB, ניתן לביטול) לבין עקיפת-פיתוח קבועה (אין מה לבטל)
let premiumTierFromDb = null;
let isDevSuperuserAccount = false;

// עוקף בדיקת פרימיום למפתחת בלבד, כדי לאפשר בדיקה מלאה של כל התכונות - חסום
// זהה מיושם גם בצד השרת (Edge Functions), כי בדיקת לקוח בלבד ניתנת לעקיפה
const DEV_SUPERUSER_EMAILS = ['zabarieden111@gmail.com'];

async function loadPremiumStatus() {
    if (!supabaseClient || !currentUserId) return;
    if (DEV_SUPERUSER_EMAILS.includes((currentUsername || '').toLowerCase())) {
        isPremiumUser = true;
        isDevSuperuserAccount = true;
        premiumTierFromDb = null;
        updateHomePremiumBadgeVisibility();
        updateThemeSwatchLocks();
        renderSettingsSubscriptionSection();
        renderRecipeScanUsageHint();
        return;
    }
    // select('*') ולא select('is_premium') בכוונה: כך שאם עמודת tier עוד לא
    // קיימת ב-user_premium, השאילתה לא נכשלת (data.tier פשוט יהיה undefined)
    const { data } = await supabaseClient.from('user_premium').select('*').eq('user_id', currentUserId).maybeSingle();
    isPremiumUser = !!(data && data.is_premium);
    isDevSuperuserAccount = false;
    premiumTierFromDb = (data && data.tier) || null;
    updateHomePremiumBadgeVisibility();
    updateThemeSwatchLocks();
    renderSettingsSubscriptionSection();
    renderRecipeScanUsageHint();
}

// הגדרות > "ניהול המנוי": מוצג רק כשבאמת פרימיום. חשבון-פיתוח (עקיפה קבועה
// בקוד, לא רשומה אמיתית ב-DB) מציג הודעה בלבד בלי כפתורים - אין שום דבר
// אמיתי לבטל/לשנות שם. מנוי "לכל החיים" (tier==='lifetime') גם מציג הודעה
// בלבד, בלי כפתור ביטול, בדיוק לפי הבקשה - אין ממה "לבטל" תשלום חד-פעמי.
// כל שאר המקרים (מנוי חודשי/חצי-שנתי, או tier לא ידוע) מקבלים אפשרות אמיתית
// לבטל - ביטול עצמי הוא פעולה בטוחה (בניגוד להפעלה עצמית), אז זה מיושם באמת
function renderSettingsSubscriptionSection() {
    const section = document.getElementById('settings-subscription-section');
    const statusEl = document.getElementById('settings-subscription-status');
    const changeBtn = document.getElementById('btn-change-plan');
    const cancelBtn = document.getElementById('btn-cancel-subscription');
    const goPremiumSection = document.getElementById('settings-go-premium-section');
    const activeBadge = document.getElementById('settings-premium-active-badge');
    // ברגע שכבר יש פרימיום, אין טעם להמשיך להציג את כפתור "שדרוג לפרימיום" -
    // מוחלף בתג עדין "פרימיום פעיל" במקומו
    if (goPremiumSection) goPremiumSection.classList.toggle('hidden', isPremiumUser);
    if (activeBadge) activeBadge.classList.toggle('hidden', !isPremiumUser);
    if (!section || !statusEl || !changeBtn || !cancelBtn) return;
    if (!isPremiumUser) { section.classList.add('hidden'); return; }
    section.classList.remove('hidden');
    if (isDevSuperuserAccount) {
        statusEl.textContent = t('settings_sub_status_dev');
        changeBtn.classList.add('hidden');
        cancelBtn.classList.add('hidden');
    } else if (premiumTierFromDb === 'lifetime') {
        statusEl.textContent = t('settings_sub_status_lifetime');
        changeBtn.classList.add('hidden');
        cancelBtn.classList.add('hidden');
    } else {
        statusEl.textContent = t('settings_sub_status_active');
        changeBtn.classList.remove('hidden');
        cancelBtn.classList.remove('hidden');
    }
}

async function cancelPremiumSubscription() {
    if (!supabaseClient || !currentUserId) return;
    if (!confirm(t('settings_cancel_sub_confirm'))) return;
    await supabaseClient.from('user_premium').update({ is_premium: false }).eq('user_id', currentUserId);
    isPremiumUser = false;
    premiumTierFromDb = null;
    // מאפסים לערכת ברירת המחדל - לא הגיוני להשאיר ערכה נעולה "דלוקה" אחרי
    // שהמנוי בוטל; selectColorTheme('default') תמיד מותר גם בלי פרימיום
    await selectColorTheme('default');
    updateHomePremiumBadgeVisibility();
    updateThemeSwatchLocks();
    renderSettingsSubscriptionSection();
    showAppToast(t('settings_cancel_sub_toast'));
}

// מחיקת חשבון היא בלתי הפיכה לחלוטין - מוחקת את כל השורות של המשתמשת בכל
// טבלה ב-DB ואז את חשבון ה-Auth עצמו (דורש service role, אז מתבצע ב-Edge
// Function ייעודי - ר' supabase/functions/delete-account/DEPLOY.md לגבי
// הפריסה הידנית הנדרשת). אישור כפול (confirm) בגלל חומרת הפעולה
// אישור מחיקת חשבון: לא confirm() דפדפן גנרי (אפור, בלתי-עיצובי) - מודל
// עצמו בעיצוב "רציני/עגום" תואם-אפליקציה (גוני אדום כהים, לא הצבעים
// השמחים הרגילים), עם הקלדת מילת אישור לפני שכפתור המחיקה בכלל מופעל -
// חסם מכוון נגד לחיצה מקרית/פזיזה על פעולה בלתי הפיכה
function deleteUserAccount() {
    const input = document.getElementById('delete-account-confirm-input');
    if (input) input.value = '';
    updateDeleteAccountConfirmButton();
    openModal('modal-delete-account-confirm');
}

function updateDeleteAccountConfirmButton() {
    const input = document.getElementById('delete-account-confirm-input');
    const btn = document.getElementById('btn-confirm-delete-account');
    if (!input || !btn) return;
    const expected = t('delete_account_confirm_word').trim().toLowerCase();
    btn.disabled = input.value.trim().toLowerCase() !== expected;
}

async function confirmDeleteAccountFinal() {
    if (!supabaseClient || !currentUserId) return;
    closeModal('modal-delete-account-confirm');
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) { showAppToast(t('error_not_connected'), 'error'); return; }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok || result.error) {
            showAppToast(t('settings_delete_account_failed'), 'error');
            return;
        }
        await supabaseClient.auth.signOut();
        location.reload();
    } catch (err) {
        showAppToast(t('settings_delete_account_failed'), 'error');
    }
}

// שינוי סיסמה: auth.updateUser (Supabase) - אין צורך בכלום צד-שרת, המשתמשת
// כבר מחוברת עם session תקף, וזו בדיוק הפעולה ש-updateUser נועדה לה
async function submitChangePassword() {
    if (!supabaseClient) return;
    const pwInput = document.getElementById('new-password-input');
    const confirmInput = document.getElementById('confirm-password-input');
    const pw = pwInput.value;
    const confirmPw = confirmInput.value;
    if (!pw || pw.length < 6) { showAppToast(t('change_password_too_short'), 'error'); return; }
    if (pw !== confirmPw) { showAppToast(t('change_password_mismatch'), 'error'); return; }
    const { error } = await supabaseClient.auth.updateUser({ password: pw });
    if (error) { showAppToast(t('change_password_failed'), 'error'); return; }
    pwInput.value = '';
    confirmInput.value = '';
    closeModal('modal-change-password');
    showAppToast(t('change_password_success'));
}

// ייצוא נתונים אישיים: קורא ישירות מכל טבלת תוכן (לא טבלאות מצב-אפליקציה
function escapeHtmlForReport(str) {
    return String(str).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// דוח נתונים אישי כ-PDF: בכוונה לא דמפ גולמי של כל טבלה ב-DB (זה בדיוק מה
// שהמשתמשת ביקשה להסיר - שמות עמודות טכניים כמו slot_number/recurrence_group_id
// לא אומרים לה כלום) - רק שתי קטגוריות בעלות משמעות אמיתית: היסטוריית משקל
// ויעדים חודשיים שהושגו בפועל, כל אחת מוצגת בניסוח קריא, לא key:value גולמי.
// לא jsPDF (הפונטים המובנים שלו לא תומכים בעברית - היו יוצאים ריבועים ריקים) -
// במקום זה נבנה עמוד HTML נקי בחלון חדש ומפעילים את דיאלוג ההדפסה הטבעי של
// הדפדפן, שבו "שמירה כ-PDF" היא אחת מהיעדים הרגילים
// ממלא את בוררי החודש/שנה בפתיחת החלון - 12 חודשים בשם המקומי (לפי שפת
// האפליקציה), ו-6 שנים אחורה מהשנה הנוכחית (כולל) - טווח סביר לדוח אישי,
// בלי לתת רשימה אינסופית. ברירת המחדל היא "כל הזמן" (הצ'קבוקס מסומן), כדי
// לשמר את ההתנהגות המקורית למי שרק רוצה דוח מלא כרגיל
function populateReportMonthYearSelects() {
    const monthSelect = document.getElementById('report-month-select');
    const yearSelect = document.getElementById('report-year-select');
    if (!monthSelect || !yearSelect) return;
    const now = new Date();
    monthSelect.innerHTML = '';
    for (let m = 0; m < 12; m++) {
        const label = new Date(now.getFullYear(), m, 1).toLocaleDateString(currentLang, { month: 'long' });
        const opt = document.createElement('option');
        opt.value = String(m + 1);
        opt.textContent = label;
        if (m === now.getMonth()) opt.selected = true;
        monthSelect.appendChild(opt);
    }
    yearSelect.innerHTML = '';
    const currentYear = now.getFullYear();
    for (let y = currentYear; y >= currentYear - 5; y--) {
        const opt = document.createElement('option');
        opt.value = String(y);
        opt.textContent = String(y);
        yearSelect.appendChild(opt);
    }
}

function toggleReportMonthPickerVisibility() {
    const allTime = document.getElementById('report-all-time').checked;
    document.getElementById('report-month-year-picker').classList.toggle('hidden', allTime);
}

function openReportSectionPicker() {
    populateReportMonthYearSelects();
    document.getElementById('report-all-time').checked = true;
    toggleReportMonthPickerVisibility();
    openModal('modal-report-section-picker');
}

async function exportUserDataReport() {
    if (!supabaseClient || !currentUserId) return;
    const includeWeight = document.getElementById('report-section-weight').checked;
    const includeGoals = document.getElementById('report-section-goals').checked;
    const includeFinance = document.getElementById('report-section-finance').checked;
    const includeSport = document.getElementById('report-section-sport').checked;
    const includeWater = document.getElementById('report-section-water').checked;
    if (!includeWeight && !includeGoals && !includeFinance && !includeSport && !includeWater) { showAppToast(t('report_picker_none_selected'), 'error'); return; }

    const isAllTime = document.getElementById('report-all-time').checked;
    let selectedMonthKey = null, rangeStart = null, rangeEndExclusive = null;
    if (!isAllTime) {
        const month = parseInt(document.getElementById('report-month-select').value, 10);
        const year = parseInt(document.getElementById('report-year-select').value, 10);
        selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
        rangeStart = `${selectedMonthKey}-01`;
        const nextMonth = new Date(year, month, 1); // month כאן 1-12, אז זה כבר "החודש הבא" ב-Date (0-based)
        rangeEndExclusive = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
    }
    closeModal('modal-report-section-picker');
    showAppToast(t('settings_export_data_preparing'));

    let weightQuery = includeWeight ? supabaseClient.from('weight_tracker').select('*').eq('user_id', currentUserId).order('weight_date', { ascending: true }) : null;
    let goalsQuery = includeGoals ? supabaseClient.from('monthly_goals').select('*').eq('user_id', currentUserId).eq('achieved', true).order('month_key', { ascending: true }) : null;
    let financeQuery = includeFinance ? supabaseClient.from('budget_tracker').select('*').eq('user_id', currentUserId).order('entry_date', { ascending: false }) : null;
    let sportQuery = includeSport ? supabaseClient.from('sport_sessions').select('*').eq('user_id', currentUserId).order('session_date', { ascending: false }) : null;
    let waterQuery = includeWater ? supabaseClient.from('water_logs').select('*').eq('user_id', currentUserId).order('log_date', { ascending: false }) : null;
    if (!isAllTime) {
        if (weightQuery) weightQuery = weightQuery.gte('weight_date', rangeStart).lt('weight_date', rangeEndExclusive);
        if (goalsQuery) goalsQuery = goalsQuery.eq('month_key', selectedMonthKey);
        if (financeQuery) financeQuery = financeQuery.gte('entry_date', rangeStart).lt('entry_date', rangeEndExclusive);
        if (sportQuery) sportQuery = sportQuery.gte('session_date', rangeStart).lt('session_date', rangeEndExclusive);
        if (waterQuery) waterQuery = waterQuery.gte('log_date', rangeStart).lt('log_date', rangeEndExclusive);
    }

    const [{ data: weightRows }, { data: goalRows }, { data: financeRows }, { data: sportRows }, { data: waterRows }] = await Promise.all([
        weightQuery || Promise.resolve({ data: null }),
        goalsQuery || Promise.resolve({ data: null }),
        financeQuery || Promise.resolve({ data: null }),
        sportQuery || Promise.resolve({ data: null }),
        waterQuery || Promise.resolve({ data: null }),
    ]);

    let sectionsHtml = '';
    if (includeWeight) {
        const weightHtml = (weightRows && weightRows.length)
            ? weightRows.map(row => `<div class="entry"><span class="entry-main">${new Date(row.weight_date).toLocaleDateString()}</span><span class="entry-value">${escapeHtmlForReport(row.weight_value)} ${escapeHtmlForReport(t('monthly_goal_kg_unit'))}</span></div>`).join('')
            : `<p class="empty">${escapeHtmlForReport(t('data_report_empty_section'))}</p>`;
        sectionsHtml += `<h2>${escapeHtmlForReport(t('data_report_label_weight'))}</h2>${weightHtml}`;
    }
    if (includeGoals) {
        const goalsHtml = (goalRows && goalRows.length)
            ? goalRows.map(row => `<div class="entry"><span class="entry-main">${escapeHtmlForReport(row.goal_name)}</span><span class="entry-sub">${escapeHtmlForReport(formatMonthLabel(row.month_key))}</span></div>`).join('')
            : `<p class="empty">${escapeHtmlForReport(t('data_report_empty_section'))}</p>`;
        sectionsHtml += `<h2>${escapeHtmlForReport(t('data_report_achieved_goals'))}</h2>${goalsHtml}`;
    }
    if (includeFinance) {
        const financeHtml = (financeRows && financeRows.length)
            ? financeRows.map(row => {
                const categoryKey = (FINANCE_CATEGORIES[row.entry_type] || []).find(([value]) => value === row.category);
                const categoryLabel = categoryKey ? t(categoryKey[1]) : (row.category || '');
                const sign = row.entry_type === 'income' ? '+' : '−';
                const color = row.entry_type === 'income' ? '#16a34a' : '#a855f7';
                return `<div class="entry"><span class="entry-main">${new Date(row.entry_date).toLocaleDateString()} · ${escapeHtmlForReport(categoryLabel)}</span><span class="entry-value" style="color: ${color};">${sign}${Number(row.amount).toLocaleString()}</span></div>`;
            }).join('')
            : `<p class="empty">${escapeHtmlForReport(t('data_report_empty_section'))}</p>`;
        sectionsHtml += `<h2>${escapeHtmlForReport(t('nav_finance'))}</h2>${financeHtml}`;
    }
    if (includeSport) {
        const sportHtml = (sportRows && sportRows.length)
            ? sportRows.map(row => {
                const typeLabel = row.sport_type === 'custom' ? (row.custom_type_name || t('sport_type_custom')) : t(`sport_type_${row.sport_type}`);
                const distancePart = row.distance_km ? ` · ${Number(row.distance_km).toLocaleString()} ${t('sport_km_unit')}` : '';
                return `<div class="entry"><span class="entry-main">${formatSportDayLabel(row.session_date)} · ${escapeHtmlForReport(typeLabel)}</span><span class="entry-value">${row.duration_minutes || 0} ${escapeHtmlForReport(t('sport_minutes_unit'))}${distancePart}</span></div>`;
            }).join('')
            : `<p class="empty">${escapeHtmlForReport(t('data_report_empty_section'))}</p>`;
        sectionsHtml += `<h2>${escapeHtmlForReport(t('nav_sport'))}</h2>${sportHtml}`;
    }
    if (includeWater) {
        // מקבצים לפי תאריך (סה"כ מ"ל ליום) - הדוח מיועד לסקירה יומית, לא לוג
        // גולמי של כל כוס בנפרד לאורך היום
        const byDate = {};
        (waterRows || []).forEach(row => { byDate[row.log_date] = (byDate[row.log_date] || 0) + (row.amount_ml || 0); });
        const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
        const waterHtml = dates.length
            ? dates.map(date => `<div class="entry"><span class="entry-main">${new Date(date).toLocaleDateString()}</span><span class="entry-value">${byDate[date].toLocaleString()} ${escapeHtmlForReport(t('water_ml_unit'))}</span></div>`).join('')
            : `<p class="empty">${escapeHtmlForReport(t('data_report_empty_section'))}</p>`;
        sectionsHtml += `<h2>${escapeHtmlForReport(t('water_title'))}</h2>${waterHtml}`;
    }

    const isRtl = document.documentElement.getAttribute('dir') === 'rtl' || document.documentElement.dir === 'rtl';
    const rangeLabel = isAllTime ? '' : `<p class="sub">${escapeHtmlForReport(t('data_report_period_label'))} ${escapeHtmlForReport(formatMonthLabel(selectedMonthKey))}</p>`;
    const bodyHtml = `
        <div class="header-banner"><h1>Obeko</h1><p class="sub">${escapeHtmlForReport(t('data_report_generated_on'))} ${new Date().toLocaleDateString()}</p>${rangeLabel}</div>
        ${sectionsHtml}
    `;
    const printWindow = window.open('', '_blank');
    if (!printWindow) { showAppToast(t('settings_export_data_failed'), 'error'); return; }
    printWindow.document.write(`<!DOCTYPE html><html dir="${isRtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>Obeko - ${escapeHtmlForReport(t('data_report_title'))}</title>
<style>
    body { font-family: 'Segoe UI', Arial, Tahoma, sans-serif; padding: 32px; color: #2b2438; background: #fff; }
    .header-banner { text-align: center; margin-bottom: 30px; }
    h1 { color: #a855f7; margin: 0; font-size: 2rem; letter-spacing: 1px; }
    .sub { color: #918da3; font-size: 0.85rem; margin-top: 4px; }
    h2 { color: #ff007f; font-size: 1.15rem; margin-top: 32px; margin-bottom: 12px; border-bottom: 2px solid #ffe0f0; padding-bottom: 6px; }
    /* direction:ltr קבוע (לא יורש מ-html dir למעלה) - כדי שהערך המספרי (למשל
       "80 ק"ג") תמיד ייפול בצד ימין של השורה, לא יתהפך בטעות לשמאל כשה-html
       כולו rtl (מיקום קופסת flex בשורה תלוי בכיוון, גם אם הטקסט הפנימי עצמו
       תמיד יוצג נכון בעברית/ערבית ללא קשר לזה) */
    .entry { display: flex; direction: ltr; justify-content: space-between; align-items: center; gap: 10px; background: linear-gradient(135deg, #fdf3ff, #fff0f7); border: 1px solid #f3d9f7; border-radius: 12px; padding: 10px 16px; margin-bottom: 8px; font-size: 0.92rem; }
    .entry-main { font-weight: 700; color: #3a2e4d; }
    .entry-value { font-weight: 700; color: #a855f7; }
    .entry-sub { color: #918da3; font-size: 0.82rem; }
    .empty { color: #b3aec0; font-style: italic; }
    @media print { body { padding: 10px; } }
</style>
</head><body>${bodyHtml}</body></html>`);
    printWindow.document.close();
    setTimeout(() => { try { printWindow.focus(); printWindow.print(); } catch (err) {} }, 400);
    showAppToast(t('settings_export_data_done'));
}

// שיתוף - תפריט קטן משלנו (WhatsApp/מייל/העתקת קישור), לא navigator.share():
// ה-Web Share API של הדפדפן מוסר לדיאלוג השיתוף הטבעי של מערכת ההפעלה, וזה
// מציג את כל האפליקציות המותקנות במחשב/בטלפון (Zoom, Teams, Discord, Outlook
// וכו') בלי שום דרך לסנן/להסיר אפליקציות ספציפיות מתוך קוד האתר - וגם איטי
// (המערכת סורקת את כל האפליקציות המותקנות בכל פעם). תפריט משלנו נותן שליטה
// מלאה בדיוק על מה שמוצע, ופותח את WhatsApp/המייל ישירות (wa.me / mailto),
// בלי לעבור דרך הבורר הכבד של המערכת בכלל
let pendingShareText = '';
let pendingShareUrl = '';

function openSharePicker(text, url) {
    pendingShareText = text || '';
    pendingShareUrl = url || '';
    openModal('modal-share-picker');
}

function shareViaWhatsapp() {
    const message = pendingShareUrl ? `${pendingShareText} ${pendingShareUrl}` : pendingShareText;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    closeModal('modal-share-picker');
}

function shareViaEmail() {
    const body = pendingShareUrl ? `${pendingShareText}\n\n${pendingShareUrl}` : pendingShareText;
    window.location.href = `mailto:?subject=${encodeURIComponent('Obeko')}&body=${encodeURIComponent(body)}`;
    closeModal('modal-share-picker');
}

async function shareViaCopyLink() {
    const text = pendingShareUrl ? `${pendingShareText} ${pendingShareUrl}` : pendingShareText;
    try {
        await navigator.clipboard.writeText(text);
        showAppToast(t('settings_share_app_copied'));
    } catch (err) {
        showAppToast(text);
    }
    closeModal('modal-share-picker');
}

function shareApp() {
    openSharePicker(t('settings_share_app_text'), location.origin + location.pathname);
}

// נקודת גילוי נוספת לשדרוג ישירות ממסך הבית (לצד ההגדרות) - מוצג רק כשבאמת
// לא פרימיום, לפי הסטטוס האמיתי מהשרת (לא נגזר מהטקס החגיגי בלבד)
function updateHomePremiumBadgeVisibility() {
    const badge = document.getElementById('home-premium-badge');
    if (badge) badge.classList.toggle('hidden', isPremiumUser);
}

// מסירים את אייקון המנעול 🔒 מכל ערכות הנושא ברגע שהמשתמשת פרימיום אמיתית -
// הכפתורים עצמם כבר פועלים בלי חסימה (selectColorTheme בודק isPremiumUser),
// אבל בלי זה המנעול הוויזואלי היה נשאר מוצג גם כשאין יותר שום חסימה בפועל
function updateThemeSwatchLocks() {
    document.querySelectorAll('.theme-swatch-lock').forEach(el => {
        el.classList.toggle('hidden', isPremiumUser);
    });
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

// הערה: זהו עדיין זרם הדגמה בלבד (בלי סליקה אמיתית מאחורה) - בכוונה לא
// הופך כאן את isPremiumUser ל-true/כותב ל-user_premium, כי זה יאפשר לכל
// אחד "לשדרג" חינם בלי שום אימות תשלום אמיתי. הטקס החגיגי הוא שיפור חזותי
// לאותו זרם הדגמה קיים, לא הפעלה אמיתית של פרימיום - זה יידרש חיבור אמיתי
// לספק סליקה (Stripe/IAP) בצד שרת לפני שזה יכול להיות אמיתי
function submitPremiumUpgrade() {
    closeModal('modal-premium-upgrade');
    celebratePremiumUnlock();
}

function celebratePremiumUnlock() {
    const overlay = document.getElementById('premium-unlock-ceremony');
    if (overlay) overlay.classList.add('open');
}

function closePremiumUnlockCeremony() {
    const overlay = document.getElementById('premium-unlock-ceremony');
    if (overlay) overlay.classList.remove('open');
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

// --- נגישות: ניגודיות גבוהה + מסנן צבע (גווני-אפור) - חינמי לכולם, לא
// תלוי פרימיום/משתמש, אותו דפוס בדיוק כמו מצב בהיר למעלה ---
function isHighContrastOn() {
    return localStorage.getItem('weekwise_high_contrast') === 'true';
}

function applyHighContrast(enabled) {
    document.documentElement.classList.toggle('high-contrast', enabled);
    const toggle = document.getElementById('high-contrast-toggle');
    if (toggle) toggle.checked = enabled;
}

function toggleHighContrast() {
    const enabled = document.getElementById('high-contrast-toggle').checked;
    localStorage.setItem('weekwise_high_contrast', enabled ? 'true' : 'false');
    applyHighContrast(enabled);
}

function getSavedColorFilter() {
    return localStorage.getItem('weekwise_color_filter') || 'none';
}

function applyColorFilter(filterName) {
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.toggle('grayscale-mode', filterName === 'grayscale');
    const toggle = document.getElementById('color-filter-toggle');
    if (toggle) toggle.checked = filterName === 'grayscale';
}

function toggleColorFilter() {
    const enabled = document.getElementById('color-filter-toggle').checked;
    const filterName = enabled ? 'grayscale' : 'none';
    localStorage.setItem('weekwise_color_filter', filterName);
    applyColorFilter(filterName);
}

// --- גודל האפליקציה: 3 רמות (קטן/ברירת המחדל, בינוני, גדול) - קובעות את
// font-size של html, וכל האפליקציה (בנויה כמעט כולה ב-rem) גדלה/קטנה
// באופן יחסי בעקבות זה, בלי לגעת בכל רכיב בנפרד. אותו דפוס בדיוק כמו
// high-contrast/color-filter למעלה - חינמי, לא תלוי משתמש/פרימיום ---
function getUiScale() {
    // ברירת המחדל היא "בינוני" (16px, בלי CSS override) - זו התנהגות ההגדרה
    // המקורית שכולם שלא נגעו בזה מעולם כבר רגילים אליה. "קטן" הפך עכשיו
    // לבחירה קטנה יותר בפועל (ר' theme.css), אז הוא כבר לא יכול להיות ברירת
    // המחדל - אחרת כולם היו רואים טקסט קטן יותר מבלי לבחור בזה בכלל
    return localStorage.getItem('weekwise_ui_scale') || 'medium';
}

// כפתורים רגילים במקום select נייטיבי - חוץ מזה שזה יפה יותר, זה גם עוקף
// לגמרי את הבאג שהיה עם ה-picker הנייטיבי בנייד (שינוי font-size הגלובלי
// באמצע הסגירה שלו גרם לו להיעלם חזותית) - אין יותר שום picker מערכת מעורב
function applyUiScale(scale) {
    document.documentElement.setAttribute('data-ui-scale', scale);
    document.querySelectorAll('.ui-scale-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-scale') === scale);
    });
}

function setUiScale(scale) {
    localStorage.setItem('weekwise_ui_scale', scale);
    applyUiScale(scale);
}

// --- צור קשר: טופס בתוך האפליקציה שנשלח ל-send-feedback (Edge Function) -
// נשמר ב-feedback_messages (service-role בלבד, ר' feedback_schema.sql) וגם
// נשלח כמייל אמיתי בזמן אמת לתיבת התמיכה, בלי להסתמך על אפליקציית מייל
// מותקנת במכשיר של המשתמשת (mailto: לא עובד באמינות בכל מכשיר/דפדפן) ---
function openContactUsModal() {
    const textarea = document.getElementById('contact-us-message');
    const select = document.getElementById('contact-us-category');
    if (textarea) textarea.value = '';
    if (select) select.value = 'bug';
    openModal('modal-contact-us');
}

async function submitContactUs() {
    const select = document.getElementById('contact-us-category');
    const textarea = document.getElementById('contact-us-message');
    const category = select ? select.value : 'bug';
    const message = textarea ? textarea.value.trim() : '';
    if (!message) {
        showAppToast(t('contact_us_missing_message'));
        return;
    }
    const btn = document.getElementById('btn-contact-us-submit');
    if (btn) btn.disabled = true;
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-feedback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ category, message })
        });
        const result = await res.json();
        if (res.ok && !result.error) {
            closeModal('modal-contact-us');
            showAppToast(t('contact_us_sent'));
        } else {
            showAppToast(t('contact_us_error'));
        }
    } catch {
        showAppToast(t('contact_us_error'));
    } finally {
        if (btn) btn.disabled = false;
    }
}

// --- עזרה ושאלות נפוצות: רשימה סטטית מקובצת לפי קטגוריה, מהקל למורכב
// (לפי בקשה מפורשת). כל שאלה/תשובה היא מפתח i18n משלה (faq_q_<id>/
// faq_a_<id>) - לא טקסט קבוע - כדי שיתורגם כמו כל שאר האפליקציה. בכל
// פיצ'ר/תיקון חדש שנוסף לאפליקציה, אמור להתווסף גם ערך מתאים כאן ---
const HELP_FAQ_ENTRIES = [
    { id: 'welcome', category: 'general' },
    { id: 'change_language', category: 'general' },
    { id: 'switch_daily_weekly_monthly', category: 'general' },
    { id: 'multi_device_login', category: 'general' },
    { id: 'app_stuck_loading', category: 'general' },
    { id: 'refresh_data', category: 'general' },
    { id: 'drag_note_to_schedule', category: 'notes' },
    { id: 'restore_deleted_note', category: 'notes' },
    { id: 'add_myweek_task', category: 'myweek' },
    { id: 'myweek_reminder', category: 'myweek' },
    { id: 'move_task_between_days', category: 'myweek' },
    { id: 'task_not_done_by_eod', category: 'myweek' },
    { id: 'what_is_glance', category: 'glance' },
    { id: 'add_onetime_event', category: 'glance' },
    { id: 'delete_series_history', category: 'glance' },
    { id: 'which_ai_button', category: 'ai' },
    { id: 'ai_phrasing_tips', category: 'ai' },
    { id: 'ai_mixed_request', category: 'ai' },
    { id: 'ai_bounded_duration', category: 'ai' },
    { id: 'ai_local_fallback', category: 'ai' },
    { id: 'custom_sport_type', category: 'sport_water' },
    { id: 'sport_photo', category: 'sport_water' },
    { id: 'save_meal_preset', category: 'nutrition' },
    { id: 'quick_add_preset_fab', category: 'nutrition' },
    { id: 'quick_add_food_fab', category: 'nutrition' },
    { id: 'photo_scan_recipe', category: 'nutrition' },
    { id: 'edit_delete_nutrition_entry', category: 'nutrition' },
    { id: 'daily_nutrition_goals', category: 'nutrition' },
    { id: 'habits_streaks', category: 'habits' },
    { id: 'finance_ai_add', category: 'finance' },
    { id: 'monthly_goal_explain', category: 'goals' },
    { id: 'notifications_not_arriving', category: 'settings_a11y' },
    { id: 'toggle_fabs', category: 'settings_a11y' },
    { id: 'week_start_day', category: 'settings_a11y' },
    { id: 'premium_benefits', category: 'premium' },
    { id: 'cancel_subscription', category: 'premium' },
    { id: 'forgot_password', category: 'account' },
    { id: 'report_bug_feature', category: 'account' },
    { id: 'contact_support', category: 'account' },
    { id: 'delete_account', category: 'account' },
];

function renderHelpFaqList() {
    const list = document.getElementById('help-faq-list');
    if (!list) return;
    list.innerHTML = '';
    let currentCategory = null;
    HELP_FAQ_ENTRIES.forEach(entry => {
        if (entry.category !== currentCategory) {
            currentCategory = entry.category;
            const header = document.createElement('div');
            header.className = 'help-faq-category-header';
            header.textContent = t(`faq_cat_${currentCategory}`);
            list.appendChild(header);
        }
        const item = document.createElement('div');
        item.className = 'help-faq-item';
        item.setAttribute('data-faq-id', entry.id);
        const qBtn = document.createElement('button');
        qBtn.type = 'button';
        qBtn.className = 'help-faq-question';
        const qText = document.createElement('span');
        qText.textContent = t(`faq_q_${entry.id}`);
        const arrow = document.createElement('span');
        arrow.className = 'help-faq-arrow';
        arrow.textContent = '▾';
        qBtn.appendChild(qText);
        qBtn.appendChild(arrow);
        qBtn.onclick = () => item.classList.toggle('open');
        const answer = document.createElement('div');
        answer.className = 'help-faq-answer';
        answer.textContent = t(`faq_a_${entry.id}`);
        item.appendChild(qBtn);
        item.appendChild(answer);
        list.appendChild(item);
    });
}

function openHelpFaqModal() {
    renderHelpFaqList();
    const search = document.getElementById('help-faq-search');
    if (search) search.value = '';
    filterHelpFaq();
    openModal('modal-help-faq');
}

// חיפוש חופשי בטקסט השאלה *וגם* התשובה (לא רק הכותרת) - כדי שמישהו
// שמחפש מילה שמופיעה רק בתוך התשובה עדיין ימצא אותה. תוצאה תואמת נפתחת
// אוטומטית (בלי צורך ללחוץ שוב), וקטגוריה שאין בה אף תוצאה תואמת מוסתרת כולה
function filterHelpFaq() {
    const searchInput = document.getElementById('help-faq-search');
    const term = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const list = document.getElementById('help-faq-list');
    if (!list) return;
    let anyVisible = false;
    list.querySelectorAll('.help-faq-item').forEach(item => {
        const id = item.getAttribute('data-faq-id');
        const q = t(`faq_q_${id}`).toLowerCase();
        const a = t(`faq_a_${id}`).toLowerCase();
        const match = !term || q.includes(term) || a.includes(term);
        item.classList.toggle('hidden', !match);
        item.classList.toggle('open', !!term && match);
        if (!term) item.classList.remove('open');
        if (match) anyVisible = true;
    });
    let currentHeader = null;
    let currentHeaderHasVisible = false;
    Array.from(list.children).forEach(child => {
        if (child.classList.contains('help-faq-category-header')) {
            if (currentHeader) currentHeader.classList.toggle('hidden', !currentHeaderHasVisible);
            currentHeader = child;
            currentHeaderHasVisible = false;
        } else if (!child.classList.contains('hidden')) {
            currentHeaderHasVisible = true;
        }
    });
    if (currentHeader) currentHeader.classList.toggle('hidden', !currentHeaderHasVisible);
    const emptyHint = document.getElementById('help-faq-empty');
    if (emptyHint) emptyHint.classList.toggle('hidden', anyVisible);
}

// כפתור צף להוספה מהירה של מים - כבוי כברירת מחדל (לא כולם רוצים עוד כפתור
// קבוע על המסך), מוצג רק אחרי הפעלה מפורשת בהגדרות. אותו דפוס בדיוק כמו
// high-contrast/color-filter למעלה - localStorage, לא תלוי פרימיום
function isWaterFabOn() {
    return localStorage.getItem('weekwise_water_fab') === 'true';
}

function applyWaterFabSetting(enabled) {
    const fab = document.getElementById('btn-water-fab');
    if (fab) fab.classList.toggle('hidden', !enabled);
    const toggle = document.getElementById('water-fab-toggle');
    if (toggle) toggle.checked = enabled;
    // כפתור מקביל בתוך מסך מעקב המים עצמו (לא רק בהגדרות) - נוח יותר לגלות
    // ולהפעיל/לכבות בלי לצאת מהמסך, לפי בקשה מפורשת. שני הכפתורים תמיד
    // מסונכרנים - שינוי באחד מעדכן את השני (דרך applyWaterFabSetting המשותפת)
    const shortcutBtn = document.getElementById('btn-water-fab-shortcut');
    if (shortcutBtn) shortcutBtn.textContent = enabled ? t('water_fab_shortcut_remove_btn') : t('water_fab_shortcut_add_btn');
    restackFabs();
}

// מסדר מחדש את הבועות הצפות (מים/ספורט/ארוחה קבועה/מזון חופשי) כך שכפתורים
// כבויים לא משאירים "חור" ריק בערימה - כל בועה דלוקה מקבלת את המקום הבא בתור
// במקום מיקום קבוע לפי שם. נקרא מחדש מכל applyXFabSetting אחרי כל שינוי הפעלה/כיבוי
function restackFabs() {
    const stackOrder = ['btn-water-fab', 'btn-sport-fab', 'btn-preset-fab', 'btn-food-fab'];
    let stackIndex = 1; // 0 שמור ל-ai-fab (הפתק המהיר), שתמיד דלוק ולא ניתן לכיבוי
    stackOrder.forEach(id => {
        const el = document.getElementById(id);
        if (!el || el.classList.contains('hidden')) return;
        el.style.setProperty('--fab-stack-index', stackIndex);
        stackIndex++;
    });
}

function toggleWaterFab() {
    const enabled = document.getElementById('water-fab-toggle').checked;
    localStorage.setItem('weekwise_water_fab', enabled ? 'true' : 'false');
    applyWaterFabSetting(enabled);
}

function toggleWaterFabFromCard() {
    const enabled = !isWaterFabOn();
    localStorage.setItem('weekwise_water_fab', enabled ? 'true' : 'false');
    applyWaterFabSetting(enabled);
    showAppToast(t(enabled ? 'water_fab_shortcut_added_toast' : 'water_fab_shortcut_removed_toast'));
}

// כפתור צף להוספה מהירה של ספורט - אותו דפוס בדיוק כמו כפתור המים למעלה
function isSportFabOn() {
    return localStorage.getItem('weekwise_sport_fab') === 'true';
}

function applySportFabSetting(enabled) {
    const fab = document.getElementById('btn-sport-fab');
    if (fab) fab.classList.toggle('hidden', !enabled);
    const toggle = document.getElementById('sport-fab-toggle');
    if (toggle) toggle.checked = enabled;
    const shortcutBtn = document.getElementById('btn-sport-fab-shortcut');
    if (shortcutBtn) shortcutBtn.textContent = enabled ? t('sport_fab_shortcut_remove_btn') : t('sport_fab_shortcut_add_btn');
    restackFabs();
}

function toggleSportFab() {
    const enabled = document.getElementById('sport-fab-toggle').checked;
    localStorage.setItem('weekwise_sport_fab', enabled ? 'true' : 'false');
    applySportFabSetting(enabled);
}

function toggleSportFabFromCard() {
    const enabled = !isSportFabOn();
    localStorage.setItem('weekwise_sport_fab', enabled ? 'true' : 'false');
    applySportFabSetting(enabled);
    showAppToast(t(enabled ? 'sport_fab_shortcut_added_toast' : 'sport_fab_shortcut_removed_toast'));
}

// כפתור צף להוספה מהירה של ארוחה קבועה שמורה - אותו דפוס בדיוק כמו כפתורי המים/ספורט
function isPresetFabOn() {
    return localStorage.getItem('weekwise_preset_fab') === 'true';
}

function applyPresetFabSetting(enabled) {
    const fab = document.getElementById('btn-preset-fab');
    if (fab) fab.classList.toggle('hidden', !enabled);
    const toggle = document.getElementById('preset-fab-toggle');
    if (toggle) toggle.checked = enabled;
    restackFabs();
}

function togglePresetFab() {
    const enabled = document.getElementById('preset-fab-toggle').checked;
    localStorage.setItem('weekwise_preset_fab', enabled ? 'true' : 'false');
    applyPresetFabSetting(enabled);
}

// כפתור צף להוספת מזון מהיר בטקסט חופשי - בניגוד לשאר כפתורי ה-FAB (כבויים
// כברירת מחדל, opt-in), זה דלוק כברירת מחדל לפי בקשה מפורשת - "!== 'false'"
// במקום "=== 'true'" הופך את זה ל-opt-out: כל מי שלא נגע בהגדרה בכלל (משתמשת
// חדשה או ותיקה) רואה את הכפתור מיד; רק מי שכיבתה אותו במפורש לא תראה אותו
function isFoodFabOn() {
    return localStorage.getItem('weekwise_food_fab') !== 'false';
}

function applyFoodFabSetting(enabled) {
    const fab = document.getElementById('btn-food-fab');
    if (fab) fab.classList.toggle('hidden', !enabled);
    const toggle = document.getElementById('food-fab-toggle');
    if (toggle) toggle.checked = enabled;
    restackFabs();
}

function toggleFoodFab() {
    const enabled = document.getElementById('food-fab-toggle').checked;
    localStorage.setItem('weekwise_food_fab', enabled ? 'true' : 'false');
    applyFoodFabSetting(enabled);
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

// ויזואליזציית "הליכה למטרה": דמות שמתקדמת לאורך מסלול לפי אחוז ההתקדמות,
// עם דגל בקצה (במקום פס התקדמות רגיל) - הרעיון שעלה בשיחת ה-brainstorm
// הראשונית על גיימיפיקציה, כאן ממומש רק ליעד החודשי (לפי בקשה מפורשת - לא
// בכל מקום). GOAL_PATH_STEP_COUNT צעדים בדידים (כמו נקודות ציון שבועיות
// גסות) - inset-inline-start/margin-inline-start (לא left/transform) כדי
// שהמסלול יתהפך נכון אוטומטית בעברית (RTL) לעומת אנגלית (LTR)
const GOAL_PATH_STEP_COUNT = 4;
// draggable=true רק ליעד ידני (custom) בחודש הנוכחי - בדיוק אותו תנאי כמו
// כפתורי ה+/- הקיימים (adjustCustomGoal), כי weight/tasks מחושבים אוטומטית
// ממקור נתונים אחר (computeGoalCurrentValue) - גרירה שם הייתה נדרסת מיד
// ברענון הבא ולא הייתה משנה שום דבר בפועל, רק מבלבלת
function buildGoalPathHtml(pct, achieved, draggable, targetValue) {
    const clampedPct = Math.max(0, Math.min(100, pct || 0));
    const steps = Array.from({ length: GOAL_PATH_STEP_COUNT + 1 }, (_, i) => {
        const stepPct = (i / GOAL_PATH_STEP_COUNT) * 100;
        const reached = clampedPct >= stepPct - 1;
        return `<span class="goal-path-step${reached ? ' reached' : ''}" style="inset-inline-start: ${stepPct}%;"></span>`;
    }).join('');
    const avatarEmoji = achieved ? '🎉' : '🚶';
    const draggableAttrs = draggable ? ` data-draggable="true" data-target-value="${targetValue}"` : '';
    return `
        <div class="goal-path-perspective">
            <div class="goal-path-track"${draggableAttrs}>
                <div class="goal-path-line"></div>
                ${steps}
                <div class="goal-path-avatar${draggable ? ' draggable' : ''}" style="inset-inline-start: ${clampedPct}%;">${avatarEmoji}</div>
                <div class="goal-path-flag">🎯</div>
            </div>
        </div>
    `;
}

// גרירת הדמות לאורך המסלול כדי לקבוע התקדמות ישירות (אלטרנטיבה מהירה
// ל-adjustCustomGoal שדורש הרבה לחיצות עבור יעד גדול) - inset-inline-start
// יחסי לרוחב-הטראק, עם תמיכת RTL/LTR (getComputedStyle direction, לא
// document.dir הגלובלי - כדי שזה יעבוד נכון גם אם מוטמע במקום עם כיוון שונה)
function initGoalPathDrag() {
    const track = document.querySelector('.goal-path-track[data-draggable="true"]');
    if (!track) return;
    const targetValue = parseFloat(track.getAttribute('data-target-value')) || 0;
    const avatar = track.querySelector('.goal-path-avatar');
    const isRtl = getComputedStyle(track).direction === 'rtl';

    const pctFromEvent = (e) => {
        const rect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const raw = isRtl ? ((rect.right - clientX) / rect.width) * 100 : ((clientX - rect.left) / rect.width) * 100;
        return Math.max(0, Math.min(100, raw));
    };

    let dragging = false;
    const onMove = (e) => {
        if (!dragging) return;
        e.preventDefault();
        const pct = pctFromEvent(e);
        if (avatar) avatar.style.insetInlineStart = `${pct}%`;
    };
    const onEnd = async (e) => {
        if (!dragging) return;
        dragging = false;
        if (avatar) avatar.classList.remove('dragging');
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onEnd);
        const pct = pctFromEvent(e);
        const newValue = Math.round((pct / 100) * targetValue);
        await setCustomGoalProgress(newValue);
    };
    track.onpointerdown = (e) => {
        dragging = true;
        e.preventDefault();
        if (avatar) avatar.classList.add('dragging');
        const pct = pctFromEvent(e);
        if (avatar) avatar.style.insetInlineStart = `${pct}%`;
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onEnd);
    };
}

async function setCustomGoalProgress(newValue) {
    if (!cachedMonthlyGoal) return;
    const clamped = Math.max(0, newValue);
    await supabaseClient.from('monthly_goals').update({ current_value: clamped }).eq('id', cachedMonthlyGoal.id);
    cachedMonthlyGoal.current_value = clamped;
    await renderMonthlyGoal();
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
        ${buildGoalPathHtml(pct, achieved, isCurrentMonth && goal.goal_type === 'custom', goal.target_value)}
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
    initGoalPathDrag();
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
    document.getElementById('monthly-goal-reward-input').value = editingMonthlyGoal ? (cachedMonthlyGoal.personal_reward || '') : '';
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
    const personalReward = document.getElementById('monthly-goal-reward-input').value.trim() || null;

    if (editingMonthlyGoal && cachedMonthlyGoal) {
        const updatePayload = { goal_name: name, goal_type: type, target_value: target, personal_reward: personalReward };
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
        month_key: currentMonthKey(), achieved: false, personal_reward: personalReward
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
    await setCustomGoalProgress((cachedMonthlyGoal.current_value || 0) + delta);
}

// נשמר לשימוש כפתור השיתוף האופציונלי (shareGoalAchievement) - לא הצגה בלבד
let lastCelebratedGoalSummary = '';

function celebrateGoalAchieved(goal) {
    // אם המשתמשת כתבה פינוק אישי משלה בזמן הגדרת היעד - הוא מוצג במקום
    // ההודעות הגנריות שהיו קודם (עדיין שם כברירת מחדל אם לא נכתב פינוק)
    let msg;
    if (goal.personal_reward) {
        msg = `${t('monthly_goal_personal_reward_prefix')} ${goal.personal_reward}`;
    } else {
        const rewardKeys = ['monthly_goal_reward_1', 'monthly_goal_reward_2', 'monthly_goal_reward_3'];
        msg = t(rewardKeys[Math.floor(Math.random() * rewardKeys.length)]);
    }
    document.getElementById('goal-celebration-text').textContent = msg;
    const summaryEl = document.getElementById('goal-celebration-summary');
    const progressText = formatGoalProgressText(goal, goal.current_value);
    lastCelebratedGoalSummary = `${goal.goal_name} — ${progressText}`;
    if (summaryEl) summaryEl.textContent = lastCelebratedGoalSummary;
    openModal('modal-goal-celebration');
}

// שיתוף הישג - כפתור משני, לגמרי אופציונלי (ר' הדיון: מישהי בלי "מישהו
// ספציפי" לשתף איתו לא אמורה להרגיש שמוכרחים - זו סיבה בדיוק ל-navigator.share
// הכללי, לא ניסוח שמניח קיום חבר/ה ספציפיים, והיא תמיד ניתנת להתעלמות)
function shareGoalAchievement() {
    const shareText = t('goal_share_text_template').replace('{goal}', lastCelebratedGoalSummary);
    openSharePicker(shareText, '');
}

// --- הוצאות והכנסות (Finance): קטגוריה עצמאית במסך הבית (לא תת-קטגוריה של
// תזונה) - טבלה חדשה budget_tracker (user_id/entry_type/amount/category/
// note/entry_date), אותו דפוס בדיוק כמו weight_tracker/step_tracker הקיימים.
// אין תת-קוביות (כמו MyWeek) - הוספה מהירה + סיכום חודשי + היסטוריה, שלושתם
// גלויים ביחד במסך אחד ---
const FINANCE_CATEGORIES = {
    expense: [
        ['food', 'finance_cat_food'], ['transport', 'finance_cat_transport'],
        ['housing', 'finance_cat_housing'], ['bills', 'finance_cat_bills'],
        ['shopping', 'finance_cat_shopping'], ['health', 'finance_cat_health'],
        ['entertainment', 'finance_cat_entertainment'], ['other', 'finance_cat_other'],
    ],
    income: [
        ['salary', 'finance_cat_salary'], ['gift', 'finance_cat_gift'],
        ['freelance', 'finance_cat_freelance'], ['refund', 'finance_cat_refund'],
        ['other', 'finance_cat_other'],
    ],
};
let currentFinanceEntryType = 'expense';
let financeSummaryMonthKey = null;
let cachedFinanceTargetBudget = 0;

// נראות כרטיסי "סיכום חודשי": העדפת תצוגה בלבד (לא נתון אמיתי), אז נשמרת רק
// ב-localStorage לפי משתמשת, לא ב-DB - בדיוק כמו מצב בהיר/ערכת נושא מקומית
const FINANCE_CARD_KEYS = ['income', 'expense', 'budget', 'remaining'];
let financeCardVisibility = { income: true, expense: true, budget: true, remaining: true };

function financeCardVisibilityKey() {
    return `weekwise_finance_cards_${currentUserId}`;
}

function loadFinanceCardVisibility() {
    try {
        const raw = localStorage.getItem(financeCardVisibilityKey());
        if (raw) financeCardVisibility = { ...financeCardVisibility, ...JSON.parse(raw) };
    } catch (err) { /* localStorage פגום/חסום - ממשיכים עם ברירת המחדל (הכל מוצג) */ }
    applyFinanceCardVisibility();
}

function applyFinanceCardVisibility() {
    FINANCE_CARD_KEYS.forEach(key => {
        const card = document.getElementById(`finance-card-${key}`);
        if (card) card.classList.toggle('hidden', !financeCardVisibility[key]);
        const checkbox = document.getElementById(`finance-card-toggle-${key}`);
        if (checkbox) checkbox.checked = !!financeCardVisibility[key];
    });
}

function openFinanceCardSettings() {
    applyFinanceCardVisibility();
    openModal('modal-finance-card-settings');
}

function toggleFinanceCardVisibility(key) {
    const checkbox = document.getElementById(`finance-card-toggle-${key}`);
    if (!checkbox) return;
    financeCardVisibility[key] = checkbox.checked;
    localStorage.setItem(financeCardVisibilityKey(), JSON.stringify(financeCardVisibility));
    applyFinanceCardVisibility();
}

function populateFinanceCategoryOptions(type) {
    const select = document.getElementById('finance-category-select');
    if (!select) return;
    select.innerHTML = FINANCE_CATEGORIES[type].map(([value, key]) => `<option value="${value}">${t(key)}</option>`).join('');
}

function selectFinanceEntryType(type) {
    currentFinanceEntryType = type;
    document.querySelectorAll('#finance-section [data-finance-type]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-finance-type') === type);
    });
    populateFinanceCategoryOptions(type);
}

async function loadFinanceData() {
    if (!supabaseClient || !currentUserId) return;
    financeSummaryMonthKey = currentMonthKey();
    populateFinanceCategoryOptions(currentFinanceEntryType);
    loadFinanceCardVisibility();
    const dateInput = document.getElementById('finance-date-input');
    if (dateInput) dateInput.value = getLocalDateString();
    await Promise.all([renderFinanceSummary(), renderFinanceHistory()]);
}

async function submitFinanceEntry() {
    if (!supabaseClient || !currentUserId) return;
    const amountInput = document.getElementById('finance-amount-input');
    const noteInput = document.getElementById('finance-note-input');
    const dateInput = document.getElementById('finance-date-input');
    const categorySelect = document.getElementById('finance-category-select');
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) { showAppToast(t('finance_invalid_amount'), 'error'); return; }
    const { error } = await supabaseClient.from('budget_tracker').insert({
        user_id: currentUserId, username: currentUsername, entry_type: currentFinanceEntryType,
        amount: amount, category: categorySelect.value, note: noteInput.value.trim() || null,
        entry_date: dateInput.value || getLocalDateString(),
    });
    if (error) { showAppToast(t('finance_add_failed'), 'error'); return; }
    amountInput.value = '';
    noteInput.value = '';
    showAppToast(t('finance_add_success'));
    await Promise.all([renderFinanceSummary(), renderFinanceHistory()]);
}

async function navigateFinanceMonth(delta) {
    const base = financeSummaryMonthKey || currentMonthKey();
    const target = shiftMonthKey(base, delta);
    if (target > currentMonthKey()) return;
    financeSummaryMonthKey = target;
    await Promise.all([renderFinanceSummary(), renderFinanceHistory()]);
}

async function renderFinanceSummary() {
    const labelEl = document.getElementById('finance-summary-month-label');
    const incomeEl = document.getElementById('finance-total-income');
    const expenseEl = document.getElementById('finance-total-expense');
    const budgetInput = document.getElementById('finance-target-budget-input');
    const remainingEl = document.getElementById('finance-remaining');
    const overspendLabel = document.getElementById('finance-overspend-label');
    if (!labelEl || !supabaseClient || !currentUserId) return;
    const monthKey = financeSummaryMonthKey || currentMonthKey();
    labelEl.textContent = formatMonthLabel(monthKey);
    const [y, m] = monthKey.split('-').map(Number);
    const firstStr = `${monthKey}-01`;
    const lastStr = new Date(y, m, 0).toISOString().slice(0, 10);
    const [{ data: entries }, { data: targetRow }] = await Promise.all([
        supabaseClient.from('budget_tracker').select('entry_type, amount')
            .eq('user_id', currentUserId).gte('entry_date', firstStr).lte('entry_date', lastStr),
        supabaseClient.from('budget_monthly_targets').select('target_amount').eq('user_id', currentUserId).eq('month_key', monthKey).maybeSingle(),
    ]);
    let income = 0, expense = 0;
    (entries || []).forEach(row => { if (row.entry_type === 'income') income += Number(row.amount); else expense += Number(row.amount); });
    incomeEl.textContent = income.toLocaleString();
    expenseEl.textContent = expense.toLocaleString();

    cachedFinanceTargetBudget = (targetRow && targetRow.target_amount) || 0;
    budgetInput.value = cachedFinanceTargetBudget || '';

    // "כמה נשאר להוציא" = תקציב מתוכנן פחות הוצאות בפועל - אם ההוצאות עברו את
    // התקציב, מציגים את סכום החריגה עם תווית אזהרה רכה (ענבר/אדום), לא סתם
    // מספר שלילי סתמי
    const remaining = cachedFinanceTargetBudget - expense;
    remainingEl.textContent = Math.abs(remaining).toLocaleString();
    if (remaining < 0) {
        remainingEl.style.color = 'var(--accent-red)';
        overspendLabel.classList.remove('hidden');
    } else {
        remainingEl.style.color = 'var(--accent-green)';
        overspendLabel.classList.add('hidden');
    }
}

async function saveFinanceTargetBudget() {
    if (!supabaseClient || !currentUserId) return;
    const budgetInput = document.getElementById('finance-target-budget-input');
    const target = parseFloat(budgetInput.value) || 0;
    const monthKey = financeSummaryMonthKey || currentMonthKey();
    await supabaseClient.from('budget_monthly_targets')
        .upsert({ user_id: currentUserId, username: currentUsername, month_key: monthKey, target_amount: target }, { onConflict: 'user_id,month_key' });
    cachedFinanceTargetBudget = target;
    await renderFinanceSummary();
}

// ההיסטוריה מסוננת לפי אותו חודש שנבחר בסיכום החודשי (financeSummaryMonthKey,
// עם אותם חצי ניווט <>) - כך שיש דרך אמיתית "לראות אחורה לפי בחירה", לא רק
// רשימת "50 האחרונות" קבועה בלי שום שליטה על התאריך
async function renderFinanceHistory() {
    const list = document.getElementById('finance-history-list');
    if (!list || !supabaseClient || !currentUserId) return;
    const monthKey = financeSummaryMonthKey || currentMonthKey();
    const [y, m] = monthKey.split('-').map(Number);
    const firstStr = `${monthKey}-01`;
    const lastStr = new Date(y, m, 0).toISOString().slice(0, 10);
    const { data } = await supabaseClient.from('budget_tracker').select('*')
        .eq('user_id', currentUserId).gte('entry_date', firstStr).lte('entry_date', lastStr)
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false });
    list.innerHTML = '';
    if (!data || !data.length) { list.innerHTML = `<li class="finance-history-empty">${t('finance_history_empty')}</li>`; return; }
    data.forEach(row => {
        const li = document.createElement('li');
        li.className = 'finance-history-row';
        const sign = row.entry_type === 'income' ? '+' : '−';
        const colorVar = row.entry_type === 'income' ? 'var(--accent-green)' : 'var(--accent-red)';
        const categoryKey = (FINANCE_CATEGORIES[row.entry_type] || []).find(([value]) => value === row.category);
        const categoryLabel = categoryKey ? t(categoryKey[1]) : (row.category || '');
        const formattedDate = new Date(row.entry_date).toLocaleDateString(currentLang, { day: 'numeric', month: 'short' });
        li.innerHTML = `
            <div class="finance-history-main">
                <span class="finance-history-category">${categoryLabel}</span>
                ${row.note ? `<span class="finance-history-note">${escapeHtmlForReport(row.note)}</span>` : ''}
                <span class="finance-history-date">${formattedDate}</span>
            </div>
            <span class="finance-history-amount" style="color: ${colorVar};">${sign}${Number(row.amount).toLocaleString()}</span>
            <button type="button" class="btn-delete-slot" onclick="deleteFinanceEntry('${row.id}')">❌</button>
        `;
        list.appendChild(li);
    });
}

async function deleteFinanceEntry(id) {
    await supabaseClient.from('budget_tracker').delete().eq('id', id);
    await Promise.all([renderFinanceSummary(), renderFinanceHistory()]);
}

// --- קטגוריית ספורט: אימונים (ריצה/אופניים/שחייה/אחר חופשי) עם משך, מרחק,
// ומוטיבציה אופציונלית - סיכום חודשי + היסטוריה + ייצוא לטבלה (CSV), נגישה
// רק מהתפריט הצדדי (ר' showTabSection). אותו דפוס בדיוק כמו כספים למעלה ---
let currentSportType = 'running';
let currentSportMotivation = null;
let sportSummaryMonthKey = null;
let cachedCustomSportTypes = []; // [{id, name}] הבועות השמורות של המשתמש הזה

function sportLastTypeKey() {
    return `weekwise_sport_last_type_${currentUserId}`;
}

function selectSportType(type) {
    currentSportType = type;
    document.querySelectorAll('#sport-type-picker [data-sport-type]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sport-type') === type);
    });
    const customInput = document.getElementById('sport-custom-type-input');
    if (customInput) customInput.classList.toggle('hidden', type !== 'custom');
    if (currentUserId) localStorage.setItem(sportLastTypeKey(), type);
}

// שם התצוגה עבור בחירה מותאמת-אישית: טקסט חופשי ("אחר") או בועה שמורה
// (custom_<id>) - null אם הבחירה הנוכחית אינה מותאמת-אישית כלל
function currentSportCustomName() {
    if (currentSportType === 'custom') {
        const input = document.getElementById('sport-custom-type-input');
        return input ? input.value.trim() : '';
    }
    if (currentSportType.startsWith('custom_')) {
        const id = currentSportType.slice('custom_'.length);
        const preset = cachedCustomSportTypes.find(p => p.id === id);
        return preset ? preset.name : '';
    }
    return null;
}

async function loadCustomSportTypes() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('custom_sport_types').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true });
    cachedCustomSportTypes = data || [];
    renderCustomSportTypeBubbles();
}

function renderCustomSportTypeBubbles() {
    const picker = document.getElementById('sport-type-picker');
    if (!picker) return;
    picker.querySelectorAll('.sport-type-custom-bubble, .btn-add-sport-type').forEach(el => el.remove());
    cachedCustomSportTypes.forEach(item => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ai-brain-tab sport-type-custom-bubble';
        btn.setAttribute('data-sport-type', `custom_${item.id}`);
        btn.innerHTML = `<span class="sport-type-bubble-label">${escapeHtmlForReport(item.name)}</span><span class="sport-type-bubble-delete" onclick="event.stopPropagation(); deleteCustomSportType('${item.id}')">×</span>`;
        btn.addEventListener('click', (e) => { if (!e.target.closest('.sport-type-bubble-delete')) selectSportType(`custom_${item.id}`); });
        picker.appendChild(btn);
    });
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'ai-brain-tab btn-add-sport-type';
    addBtn.textContent = '+';
    addBtn.onclick = showAddSportTypeRow;
    picker.appendChild(addBtn);
}

function showAddSportTypeRow() {
    const row = document.getElementById('sport-add-type-row');
    if (row) { row.hidden = false; document.getElementById('new-sport-type-name').focus(); }
}

function hideAddSportTypeRow() {
    const row = document.getElementById('sport-add-type-row');
    if (row) row.hidden = true;
    const input = document.getElementById('new-sport-type-name');
    if (input) input.value = '';
}

async function addCustomSportType() {
    const input = document.getElementById('new-sport-type-name');
    const name = input.value.trim();
    if (!name) return;
    if (!supabaseClient || !currentUserId) return;
    const { error } = await supabaseClient.from('custom_sport_types').insert({ user_id: currentUserId, username: currentUsername, name });
    if (error) { showAppToast(t('sport_new_type_add_failed'), 'error'); return; }
    hideAddSportTypeRow();
    showAppToast(t('sport_new_type_add_success'));
    await loadCustomSportTypes();
}

async function deleteCustomSportType(id) {
    await supabaseClient.from('custom_sport_types').delete().eq('id', id);
    // אם הבועה שנמחקה הייתה הנבחרת כרגע, נופלים חזרה ל"ריצה" - לא משאירים
    // את הממשק תקוע על בחירה שכבר לא קיימת
    if (currentSportType === `custom_${id}`) selectSportType('running');
    await loadCustomSportTypes();
}

function selectSportMotivation(button, motivation) {
    // בחירה יחידה (לא מרובה) - לחיצה חוזרת על אותה בחירה מבטלת אותה, כי
    // המוטיבציה היא רשות מלכתחילה ולא כל אימון חייב "סיבה" מתויגת
    const alreadyActive = currentSportMotivation === motivation;
    document.querySelectorAll('#sport-motivation-picker [data-motivation]').forEach(btn => btn.classList.remove('active'));
    currentSportMotivation = alreadyActive ? null : motivation;
    if (!alreadyActive) button.classList.add('active');
}

async function loadSportData() {
    if (!supabaseClient || !currentUserId) return;
    sportSummaryMonthKey = currentMonthKey();
    await loadCustomSportTypes();
    // ברירת המחדל היא הבחירה האחרונה של המשתמש (אם עדיין קיימת), לא תמיד "ריצה"
    const saved = localStorage.getItem(sportLastTypeKey());
    const builtIns = ['running', 'cycling', 'swimming', 'custom'];
    const savedIsValid = saved && (builtIns.includes(saved) || cachedCustomSportTypes.some(p => `custom_${p.id}` === saved));
    selectSportType(savedIsValid ? saved : 'running');
    currentSportMotivation = null;
    document.querySelectorAll('#sport-motivation-picker [data-motivation]').forEach(btn => btn.classList.remove('active'));
    const dateInput = document.getElementById('sport-date-input');
    if (dateInput) dateInput.value = getLocalDateString();
    await Promise.all([renderSportSummary(), renderSportHistory()]);
}

async function submitSportSession() {
    if (!supabaseClient || !currentUserId) return;
    const durationInput = document.getElementById('sport-duration-input');
    const distanceInput = document.getElementById('sport-distance-input');
    const dateInput = document.getElementById('sport-date-input');
    const notesInput = document.getElementById('sport-notes-input');
    const photoUrlInput = document.getElementById('sport-photo-url-input');
    const isCustom = currentSportType === 'custom' || currentSportType.startsWith('custom_');
    const customName = isCustom ? currentSportCustomName() : null;
    if (isCustom && !customName) { showAppToast(t('sport_missing_custom_name'), 'error'); return; }
    const duration = parseInt(durationInput.value) || null;
    const distance = distanceInput.value ? parseFloat(distanceInput.value) : null;
    if (!duration) { showAppToast(t('sport_missing_duration'), 'error'); return; }
    const { error } = await supabaseClient.from('sport_sessions').insert({
        user_id: currentUserId, username: currentUsername, sport_type: isCustom ? 'custom' : currentSportType,
        custom_type_name: customName, duration_minutes: duration, distance_km: distance,
        motivation: currentSportMotivation, session_date: dateInput.value || getLocalDateString(),
        notes: notesInput.value.trim() || null, photo_url: photoUrlInput.value || null,
    });
    if (error) { showAppToast(t('sport_add_failed'), 'error'); return; }
    durationInput.value = '';
    distanceInput.value = '';
    document.getElementById('sport-custom-type-input').value = '';
    notesInput.value = '';
    photoUrlInput.value = '';
    setSportPhotoPreview(null);
    showAppToast(t('sport_add_success'));
    await Promise.all([renderSportSummary(), renderSportHistory()]);
}

async function handleSportPhotoSelected(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    // תצוגה מקדימה מיידית מקומית, לפני שהעלאה לענן מסתיימת
    setSportPhotoPreview(URL.createObjectURL(file));
    const url = await uploadSportPhoto(file);
    if (url) {
        document.getElementById('sport-photo-url-input').value = url;
        setSportPhotoPreview(url);
    } else {
        showAppToast(t('sport_photo_upload_failed'), 'error');
        setSportPhotoPreview(null);
    }
}

async function uploadSportPhoto(file) {
    if (!supabaseClient || !currentUserId) return null;
    try {
        const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'jpg';
        const path = `${currentUserId}/${Date.now()}.${ext}`;
        const { error } = await supabaseClient.storage.from('sport-photos').upload(path, file, { upsert: false, contentType: file.type });
        if (error) return null;
        const { data } = supabaseClient.storage.from('sport-photos').getPublicUrl(path);
        return data ? data.publicUrl : null;
    } catch {
        return null;
    }
}

function setSportPhotoPreview(url) {
    const preview = document.getElementById('sport-photo-preview');
    if (!preview) return;
    if (url) { preview.src = url; preview.classList.remove('hidden'); }
    else { preview.src = ''; preview.classList.add('hidden'); }
}

async function navigateSportMonth(delta) {
    const base = sportSummaryMonthKey || currentMonthKey();
    const target = shiftMonthKey(base, delta);
    if (target > currentMonthKey()) return;
    sportSummaryMonthKey = target;
    await Promise.all([renderSportSummary(), renderSportHistory()]);
}

function sportMonthRange(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const firstStr = `${monthKey}-01`;
    const lastStr = new Date(y, m, 0).toISOString().slice(0, 10);
    return { firstStr, lastStr };
}

function sportTypeLabel(row) {
    if (row.sport_type === 'custom') return row.custom_type_name || t('sport_type_custom');
    return t(`sport_type_${row.sport_type}`);
}

function formatSportDayLabel(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(currentLang, { day: 'numeric', month: 'short' });
}

async function renderSportSummary() {
    const labelEl = document.getElementById('sport-summary-month-label');
    if (!labelEl || !supabaseClient || !currentUserId) return;
    const monthKey = sportSummaryMonthKey || currentMonthKey();
    labelEl.textContent = formatMonthLabel(monthKey);
    const nextBtn = document.getElementById('sport-summary-next-btn');
    if (nextBtn) nextBtn.disabled = monthKey === currentMonthKey();
    const { firstStr, lastStr } = sportMonthRange(monthKey);
    const { data } = await supabaseClient.from('sport_sessions').select('session_date, sport_type, duration_minutes, distance_km')
        .eq('user_id', currentUserId).gte('session_date', firstStr).lte('session_date', lastStr);
    const rows = data || [];
    let totalMinutes = 0, totalKm = 0;
    rows.forEach(row => { totalMinutes += row.duration_minutes || 0; totalKm += Number(row.distance_km) || 0; });
    document.getElementById('sport-total-sessions').textContent = rows.length;
    document.getElementById('sport-total-minutes').textContent = totalMinutes.toLocaleString();
    document.getElementById('sport-total-km').textContent = totalKm.toLocaleString(undefined, { maximumFractionDigits: 1 });

    // "ימים חזקים": לא רשימת תאריכים שטוחה - ימי-השבוע (ראשון/שני/...) שבהם
    // יש הכי הרבה אימונים החודש, כתבנית הרגל חוזרת (יכול להיות יותר מיום
    // אחד אם כמה ימים מתחלקים ברמת השיא)
    const trainingDaysEl = document.getElementById('sport-training-days-label');
    if (trainingDaysEl) {
        if (rows.length) {
            const countByWeekday = [0, 0, 0, 0, 0, 0, 0];
            rows.forEach(row => {
                const [y, m, d] = row.session_date.split('-').map(Number);
                countByWeekday[new Date(y, m - 1, d).getDay()]++;
            });
            const maxCount = Math.max(...countByWeekday);
            const strongDays = countByWeekday
                .map((count, idx) => ({ count, idx }))
                .filter(({ count }) => count === maxCount && maxCount > 0)
                .map(({ idx }) => t(dayNameKeys[idx]));
            trainingDaysEl.textContent = strongDays.length ? `${t('sport_training_days_label')} ${strongDays.join(', ')}` : '';
        } else {
            trainingDaysEl.textContent = '';
        }
    }

    // "הכי הרבה רצתי": יום הריצה עם המרחק הגדול ביותר (נופל חזרה למשך זמן אם
    // אין מרחק רשום לאף ריצה החודש) - רק בין sport_type==='running', לא ספורט אחר
    const bestRunEl = document.getElementById('sport-best-run-label');
    if (bestRunEl) {
        const runs = rows.filter(row => row.sport_type === 'running');
        let best = null;
        runs.forEach(row => {
            const hasDistance = row.distance_km != null;
            const score = hasDistance ? Number(row.distance_km) : (row.duration_minutes || 0);
            if (!best || score > best.score) best = { row, score, hasDistance };
        });
        if (best) {
            const detail = best.hasDistance
                ? `${Number(best.row.distance_km).toLocaleString()} ${t('sport_km_unit')}`
                : `${best.row.duration_minutes} ${t('sport_minutes_unit')}`;
            bestRunEl.textContent = `${t('sport_best_run_label')} ${formatSportDayLabel(best.row.session_date)} (${detail})`;
        } else {
            bestRunEl.textContent = '';
        }
    }
}

async function renderSportHistory() {
    const list = document.getElementById('sport-history-list');
    if (!list || !supabaseClient || !currentUserId) return;
    const monthKey = sportSummaryMonthKey || currentMonthKey();
    const { firstStr, lastStr } = sportMonthRange(monthKey);
    const { data } = await supabaseClient.from('sport_sessions').select('*')
        .eq('user_id', currentUserId).gte('session_date', firstStr).lte('session_date', lastStr)
        .order('session_date', { ascending: false }).order('created_at', { ascending: false });
    list.innerHTML = '';
    if (!data || !data.length) { list.innerHTML = `<li class="finance-history-empty">${t('sport_history_empty')}</li>`; return; }
    data.forEach(row => {
        const li = document.createElement('li');
        li.className = 'finance-history-row';
        // formatSportDayLabel (לא new Date(row.session_date) ישירות) כי
        // "YYYY-MM-DD" מפורש כ-UTC חצות ע"י JS - יכול להזיז את היום המוצג
        // באזורי זמן עם offset שלילי מ-UTC
        const formattedDate = formatSportDayLabel(row.session_date);
        const distancePart = row.distance_km ? ` · ${Number(row.distance_km).toLocaleString()} ${t('sport_km_unit')}` : '';
        const motivationPart = row.motivation ? `<span class="finance-history-note">${t('sport_history_motivation_prefix')} ${t(`sport_motivation_${row.motivation}`)}</span>` : '';
        const notesPart = row.notes ? `<span class="finance-history-note">${escapeHtmlForReport(row.notes)}</span>` : '';
        const photoPart = row.photo_url ? `<img src="${row.photo_url}" class="sport-history-thumb" alt="">` : '';
        li.innerHTML = `
            ${photoPart}
            <div class="finance-history-main">
                <span class="finance-history-category">${sportTypeLabel(row)}</span>
                <span class="finance-history-note">${row.duration_minutes} ${t('sport_minutes_unit')}${distancePart}</span>
                ${motivationPart}
                ${notesPart}
                <span class="finance-history-date">${formattedDate}</span>
            </div>
            <button type="button" class="btn-delete-slot" onclick="shareSportSession('${row.id}')">📤</button>
            <button type="button" class="btn-delete-slot" onclick="deleteSportSession('${row.id}')">❌</button>
        `;
        list.appendChild(li);
    });
}

async function deleteSportSession(id) {
    await supabaseClient.from('sport_sessions').delete().eq('id', id);
    await Promise.all([renderSportSummary(), renderSportHistory()]);
}

async function shareSportSession(id) {
    const { data: row } = await supabaseClient.from('sport_sessions').select('*').eq('id', id).maybeSingle();
    if (!row) return;
    let text = `${sportTypeLabel(row)} · ${row.duration_minutes} ${t('sport_minutes_unit')}`;
    if (row.distance_km) text += ` · ${Number(row.distance_km).toLocaleString()} ${t('sport_km_unit')}`;
    text += ` (${formatSportDayLabel(row.session_date)})`;
    if (row.notes) text += `\n\n${row.notes}`;
    openSharePicker(text, row.photo_url || '');
}

// ייצוא לטבלה (CSV): קובץ נפרד לכל חודש שנצפה כרגע - נפתח ישירות בכל אפליקציית
// גיליון (Excel/Google Sheets/Numbers), בלי צורך בשום ספרייה חיצונית
async function exportSportSessionsCsv() {
    if (!supabaseClient || !currentUserId) return;
    const monthKey = sportSummaryMonthKey || currentMonthKey();
    const { firstStr, lastStr } = sportMonthRange(monthKey);
    const { data } = await supabaseClient.from('sport_sessions').select('*')
        .eq('user_id', currentUserId).gte('session_date', firstStr).lte('session_date', lastStr)
        .order('session_date', { ascending: true });
    if (!data || !data.length) { showAppToast(t('sport_history_empty'), 'error'); return; }
    const header = [t('sport_csv_date'), t('sport_csv_type'), t('sport_csv_duration'), t('sport_csv_distance'), t('sport_csv_motivation'), t('sport_csv_notes')];
    const csvRows = data.map(row => [
        row.session_date,
        sportTypeLabel(row),
        row.duration_minutes || '',
        row.distance_km || '',
        row.motivation ? t(`sport_motivation_${row.motivation}`) : '',
        row.notes || '',
    ]);
    const csvContent = [header, ...csvRows]
        .map(cols => cols.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    // ﻿ (BOM) בתחילת הקובץ - כדי ש-Excel יזהה UTF-8 נכון ולא יהפוך את
    // הטקסט העברי לג'יבריש כשפותחים את הקובץ (בעיה מוכרת של Excel עם CSV)
    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `sport-${monthKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// --- AI Assistant > כספים (פרימיום): "כמה הוצאתי ועל מה, כמה נכנס ומאיפה"
// בטקסט חופשי - מנתח חוקי-דטרמיניסטי מקומי (בלי LLM), אותו רעיון בדיוק כמו
// parseScheduleTextLocally הקיים ללו"ז. לא נוסה קריאת ענן כאן (בניגוד ללו"ז) -
// אין עדיין Edge Function/מפתח Anthropic מוגדרים לפיצ'ר הזה, אז קריאה כזו
// תמיד הייתה נכשלת בלי תועלת; המנתח המקומי הוא המנוע האמיתי כרגע ---
const FINANCE_AI_TYPE_KEYWORDS = {
    income: ['קיבלתי', 'נכנס', 'משכורת', 'הכנסה', 'זכיתי', 'income', 'salary', 'received', 'got paid', 'earned'],
    expense: ['הוצאתי', 'שילמתי', 'קניתי', 'עלה לי', 'הוצאה', 'spent', 'paid', 'bought', 'cost'],
};
const FINANCE_AI_CATEGORY_KEYWORDS = {
    expense: {
        food: ['אוכל', 'מזון', 'סופר', 'מסעדה', 'קפה', 'food', 'grocery', 'groceries', 'restaurant'],
        transport: ['דלק', 'אוטובוס', 'מונית', 'רכבת', 'תחבורה', 'gas', 'fuel', 'taxi', 'bus', 'train'],
        housing: ['שכירות', 'דירה', 'משכנתא', 'rent', 'mortgage'],
        bills: ['חשמל', 'מים', 'ארנונה', 'גז', 'אינטרנט', 'סלולר', 'bill', 'electricity', 'water', 'internet'],
        shopping: ['בגדים', 'קניות', 'shopping', 'clothes'],
        health: ['רופא', 'תרופות', 'בריאות', 'doctor', 'medicine', 'health'],
        entertainment: ['סרט', 'בילוי', 'entertainment', 'movie'],
    },
    income: {
        salary: ['משכורת', 'שכר', 'salary'],
        gift: ['מתנה', 'gift'],
        freelance: ['פרילנס', 'עצמאי', 'freelance'],
        refund: ['החזר', 'refund'],
    },
};

function parseFinanceTextLocally(text) {
    const amountMatch = text.match(/(\d+(?:[.,]\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(',', '.')) : null;

    let type = 'expense';
    if (FINANCE_AI_TYPE_KEYWORDS.income.some(w => text.includes(w))) type = 'income';
    else if (FINANCE_AI_TYPE_KEYWORDS.expense.some(w => text.includes(w))) type = 'expense';

    let category = 'other';
    const dict = FINANCE_AI_CATEGORY_KEYWORDS[type] || {};
    for (const [cat, words] of Object.entries(dict)) {
        if (words.some(w => text.includes(w))) { category = cat; break; }
    }
    return { type, amount, category, note: text.trim() };
}

async function parseFinanceWithAI() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    const input = document.getElementById('ai-finance-input');
    const text = input.value.trim();
    if (!text) { showAppToast(t('finance_ai_empty'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const parsed = parseFinanceTextLocally(text);
    if (!parsed.amount) { showAppToast(t('finance_ai_no_amount'), 'error'); return; }
    const { error } = await supabaseClient.from('budget_tracker').insert({
        user_id: currentUserId, username: currentUsername, entry_type: parsed.type,
        amount: parsed.amount, category: parsed.category, note: parsed.note, entry_date: getLocalDateString(),
    });
    if (error) { showAppToast(t('finance_add_failed'), 'error'); return; }
    input.value = '';
    closeModal('modal-ai-brain');
    await Promise.all([renderFinanceSummary(), renderFinanceHistory()]);
    showAppToast(t('finance_ai_success'));
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

// --- מונה שימוש חינמי בניתוח מתכונים (10 ניתוחים חינם, לכל החיים - זו לא סריקת
// תמונה, רק ניתוח טקסט מודבק, ולכן לא הוגבל מחדש לחודשי) ---
// חסימה זו מדולגת לחלוטין עבור משתמשי פרימיום (isPremiumUser)
const RECIPE_AI_FREE_LIMIT = 10;
// סריקות תמונה (מתכונים) - 5 בחודש בחינם, מתאפס אוטומטית כל חודש (אותו דפוס
// month_key בדיוק כמו המכסה החודשית של פרימיום - ר' scan-recipe-image)
const IMAGE_SCAN_FREE_LIMIT = 5;
let cachedAiUsage = 0;
let cachedImageScansUsed = 0;

async function loadAiUsage() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('user_ai_usage').select('recipe_ai_parses_used, free_image_scans_month_key, free_image_scans_month_used').eq('user_id', currentUserId).maybeSingle();
    cachedAiUsage = data ? data.recipe_ai_parses_used : 0;
    cachedImageScansUsed = (data && data.free_image_scans_month_key === currentMonthKey()) ? (data.free_image_scans_month_used || 0) : 0;
    renderRecipeScanUsageHint();
}

// מציג "X/5 סריקות חינם החודש" למי שלא פרימיום, ליד כפתור סריקת המתכון -
// כדי שהמכסה תהיה שקופה ולא תרגיש כמו "פתוח בלי הגבלה" (זו הייתה תלונה אמיתית)
function renderRecipeScanUsageHint() {
    const hint = document.getElementById('recipe-scan-free-hint');
    if (!hint) return;
    if (isPremiumUser) { hint.textContent = t('recipe_scan_file_hint_premium'); return; }
    const remaining = Math.max(0, IMAGE_SCAN_FREE_LIMIT - cachedImageScansUsed);
    hint.textContent = t('recipe_scan_file_hint').replace('{remaining}', remaining).replace('{limit}', IMAGE_SCAN_FREE_LIMIT);
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
// שם מתכון לא אמור להכיל שם-חודש באנגלית או אשכול אות+ספרות מעורבב (כמו
// "E107") - אלה כמעט תמיד שרידי תאריך/שעון מעוותים מ-OCR, לא מילה אמיתית
// בשום שפה. עדיף להשאיר את שדה הכותרת ריק ולבקש מהמשתמשת למלא בעצמה, במקום
// למלא בביטחון שם שגוי - בדיוק לפי הבקשה: "אם יש שאלות תשאל אותי"
function looksLikeGarbledOcrTitle(title) {
    if (OCR_MONTH_NAME_RE.test(title)) return true;
    if (/[a-z][0-9]{2,}|[0-9]{2,}[a-z]/i.test(title)) return true;
    return false;
}

// אותו רעיון כמו looksLikeGarbledOcrTitle, אבל לגוף (מצרכים/הוראות): Tesseract
// על עברית מתוך צילום מסך צפוף (למשל שיחת AI כמו Gemini) נוטה "לבלוע" רווחים
// בין מילים ולתעתק אייקוני ממשק (חץ נפתח, עיפרון עריכה, שתי שורות של תפריט)
// כאותיות לטיניות מפוזרות בודדות ("NER", "am 0 4", "I O") ולפעמים אפילו הופך
// סדר סוגריים. תווים כמו ©/®/== לעולם לא אמורים להופיע בתמלול מתכון אמיתי -
// ומקבץ גדול של "מילים" בנות תו בודד מסגיר פירוק/רווחים שגויים. כשזה קורה
// עדיף לא למלא כלום (רשת נגד "לך תזרוק" חצי-מתכון) - זהה בעיקרון להתנהגות
// הקיימת ל-titleUnclear, רק שכאן כל הגוף נפסל ולא רק הכותרת
const OCR_IMPOSSIBLE_BODY_CHARS_RE = /[©®™§¶]|==/;
function looksLikeGarbledOcrBody(text) {
    if (!text) return false;
    if (OCR_IMPOSSIBLE_BODY_CHARS_RE.test(text)) return true;
    const tokens = text.split(/\s+/).filter(Boolean);
    if (tokens.length < 4) return false;
    const singleCharTokens = tokens.filter(tok => tok.length === 1 && !/[\d%א-ת]/.test(tok));
    return (singleCharTokens.length / tokens.length) > 0.12;
}

async function runLocalRecipeOcrFallback(file) {
    if (!file.type.startsWith('image/') || typeof Tesseract === 'undefined') return false;
    try {
        showRecipeScanLoading();
        const { data } = await Tesseract.recognize(file, 'heb+eng');
        const rawText = ((data && data.text) || '').trim();
        if (!rawText) return false;
        const parsed = parseRecipeText(rawText);
        if (!parsed || !parsed.title) return false;
        if (looksLikeGarbledOcrBody(parsed.ingredients) || looksLikeGarbledOcrBody(parsed.instructions)) return false;
        const titleUnclear = looksLikeGarbledOcrTitle(parsed.title);
        document.getElementById('recipe-title-input').value = titleUnclear ? '' : parsed.title;
        if (parsed.category) document.getElementById('recipe-category-input').value = parsed.category;
        document.getElementById('recipe-calories-input').value = parsed.calories || '';
        document.getElementById('recipe-ingredients-input').value = parsed.ingredients;
        document.getElementById('recipe-instructions-input').value = parsed.instructions;
        setRecipeCaloriesEstimateHint(parsed.caloriesEstimated);
        document.getElementById('recipe-ai-raw-input').value = '';
        showAppToast(t(titleUnclear ? 'recipe_scan_title_unclear' : 'recipe_scan_ocr_success'), titleUnclear ? 'error' : 'success');
        return true;
    } catch {
        return false;
    } finally {
        hideRecipeScanLoading();
    }
}

// שולח את התמונה ל-AI האמיתי בענן פעם אחת ומדווחת מה קרה - מנותקת כדי
// שאפשר יהיה לנסות שוב אוטומטית (ר' הקריאה הכפולה ב-runRecipeImageScan
// למטה) בלי לשכפל את כל לוגיקת הפענוח של התשובה
async function attemptRecipeCloudScan(token, base64, mediaType) {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-recipe-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ imageBase64: base64, mediaType })
        });
        const result = await res.json();
        // limit_reached עם scope='premium_monthly' זה מישהי שכבר פרימיום שהגיעה
        // למכסה החודשית הנדיבה - אין טעם להציע לה לשדרג (היא כבר שילמה),
        // ואין טעם לנסות שוב (המכסה לא תשתנה) - רק להודיע ולעבור ל-OCR המקומי
        if (result.error === 'limit_reached' && result.scope === 'premium_monthly') return { status: 'premium_limit' };
        if (res.status === 402 || result.error === 'limit_reached') return { status: 'limit' };
        if (res.ok && !result.error && result.recipe) return { status: 'ok', recipe: result.recipe, scansUsed: result.scansUsed };
        return { status: 'retry' };
    } catch {
        return { status: 'retry' };
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
            // ניסיון שני מיידי לפני ויתור: תקלת רשת חד-פעמית (מעבר בין WiFi
            // לסלולרי, חבילת בקשה שאבדה) היא הגורם השכיח ביותר לכישלון -
            // וה-AI האמיתי תמיד מדויק הרבה יותר מה-OCR המקומי (בעיקר לעברית),
            // אז שווה לתת לו הזדמנות שנייה לפני שנופלים לפתרון הפחות טוב
            let attempt = await attemptRecipeCloudScan(token, base64, mediaType);
            if (attempt.status === 'retry') attempt = await attemptRecipeCloudScan(token, base64, mediaType);

            if (attempt.status === 'premium_limit') {
                showAppToast(t('ai_monthly_limit_reached'), 'error');
            } else if (attempt.status === 'limit') {
                showAppToast(t('recipe_scan_limit_desc'), 'error');
                openPremiumUpgradeModal();
                return;
            } else if (attempt.status === 'ok') {
                recipe = attempt.recipe;
                if (typeof attempt.scansUsed === 'number') cachedImageScansUsed = attempt.scansUsed;
                renderRecipeScanUsageHint();
            }
        }

        if (recipe) {
            // סינון-רעש הגנתי גם על תוצאת ה-AI (לא רק על ה-OCR המקומי): גם
            // כשה-AI מתבקש במפורש להתעלם מכרום הצ'אט (שעון/תאריך/שם שולח),
            // הוא לפעמים עדיין מדליף שאריות כאלה לתוך אחד השדות - אותו ניקוי
            // בדיוק כמו ב-parseRecipeText מתמודד עם זה כרשת ביטחון נוספת
            const cleanTitle = sanitizeOcrText(recipe.title || '');
            document.getElementById('recipe-title-input').value = cleanTitle;
            if (recipe.category) document.getElementById('recipe-category-input').value = recipe.category;
            document.getElementById('recipe-calories-input').value = recipe.calories || '';
            document.getElementById('recipe-ingredients-input').value = sanitizeOcrText(recipe.ingredients || '');
            document.getElementById('recipe-instructions-input').value = sanitizeOcrText(recipe.instructions || '');
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

// שולחת ניסיון בודד ל-scan-meal-photo ומדווחת מה קרה - מנותקת כדי שאפשר
// יהיה לנסות שוב אוטומטית (ר' הקריאה הכפולה למטה) בלי לשכפל את כל לוגיקת
// הפענוח. תקלת רשת חד-פעמית היא הגורם השכיח ביותר לכישלון סתמי, ורוב
// הפעמים ניסיון חוזר מיד מצליח - בדיוק אותו דפוס כמו attemptRecipeCloudScan
async function attemptMealPhotoScan(token, base64, mediaType) {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/scan-meal-photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ imageBase64: base64, mediaType, language: currentLang })
        });
        const result = await res.json();
        if (result.error === 'limit_reached') return { status: 'limit' };
        if (res.status === 402 || result.error === 'premium_required') return { status: 'premium_required' };
        if (res.ok && !result.error && result.items && result.items.length) return { status: 'ok', items: result.items };
        return { status: 'retry' };
    } catch {
        return { status: 'retry' };
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

        let attempt = await attemptMealPhotoScan(token, base64, mediaType);
        if (attempt.status === 'retry') attempt = await attemptMealPhotoScan(token, base64, mediaType);

        if (attempt.status === 'limit') { showAppToast(t('ai_monthly_limit_reached'), 'error'); return; }
        if (attempt.status === 'premium_required') { openPremiumUpgradeModal(); return; }
        if (attempt.status !== 'ok') { showAppToast(t('meal_photo_failed'), 'error'); return; }

        // ארוחה קבועה יכולה להכיל כמה פריטים (למשל ארוחה שלמה עם אורז+ביצים+...) -
        // מאחדים את כולם לפריט שמור אחד: השם הוא רשימת כל המרכיבים (מקוצר,
        // "הכל"), הקלוריות הן הסכום הכולל, וה"מרכיבים" (description) הוא
        // פירוט קלורי לכל פריט בנפרד - כדי שגם אחרי האיחוד עדיין אפשר יהיה
        // לראות מה בדיוק מרכיב את הארוחה, לא רק את המספר הכולל
        const items = attempt.items;
        const totalCalories = items.reduce((sum, it) => sum + (it.calories || 0), 0);
        const combinedName = items.map(it => it.food_name).filter(Boolean).join(', ');
        const combinedDescription = items.map(it => `${it.food_name} (${it.calories})`).join(', ');
        document.getElementById('new-preset-name').value = combinedName;
        document.getElementById('new-preset-calories').value = totalCalories || '';
        document.getElementById('new-preset-description').value = items.length > 1 ? combinedDescription : '';
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
// חודש באנגלית (מלא או מקוצר) כמעט אף פעם לא באמת חלק ממתכון בעברית - כמעט
// תמיד שריד תאריך של הודעת צ'אט (כמו "July 16, 11:07") שה-OCR לפעמים מעוות
// עד כדי אי-זיהוי (למשל "11:07" הופך ל"E107 5") ולכן לא נתפס באף תבנית שעון
// מדויקת למעלה - זיהוי שם החודש עצמו הרבה יותר יציב מנחישת הספרות שאחריו
const OCR_MONTH_NAME_RE = /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;
function isOcrNoiseLine(line) {
    if (OCR_NOISE_LINE_PATTERNS.some(re => re.test(line))) return true;
    // רשת ביטחון כללית: שורה קצרה (עד 6 "מילים") שמכילה שעון או שם-חודש
    // באנגלית איפשהו בתוכה ולא מכילה אף מילת-מפתח טיפוסית של מתכון (כמות/
    // יחידה/פועל בישול) - כמעט תמיד שריד סטטוס-בר/שעון/תאריך שלא נתפס
    // באחת התבניות המדויקות למעלה (למשל בגלל תו מקף לא-סטנדרטי או עיוות OCR)
    if ((/\d{1,2}:\d{2}/.test(line) || OCR_MONTH_NAME_RE.test(line)) && line.split(/\s+/).length <= 6 &&
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
    // ">"/"<" בודדים הם כמעט תמיד שרידי אייקון חץ/הרחבה מצילום מסך צ'אט
    // (כפתור "השב"/הרחב) - אף פעם לא תוכן מתכון אמיתי, גם כשמופיעים כתחילית
    // צמודה לטקסט אמיתי (בדיוק כמו "SNES II -13:42" שתועד למעלה)
    /^[<>]+\s*/,
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
        // ">"/"<" בודדים בסוף שורה - אותו שריד אייקון חץ/הרחבה, בכיוון ההפוך
        .map(l => l.replace(/\s*[<>]+$/, '').trim())
        .filter(Boolean)
        .join('\n');
}

// --- מסד קלוריות משותף: משמש גם לאומדן קלוריות למתכון (מצרכי מתכון) וגם
// למילוי אוטומטי של שדה "מה אכלת" ביומן התזונה היומי (ר' autoFillMealCalories
// למטה) - אותה טבלת חיפוש בדיוק, שני שימושים. קלוריות ל-100 גרם, או ליחידה
// בודדת עבור ביצים. לא מנחשת כמות שלא צוינה בטקסט - תמיד המלצה בלבד, לא
// עובדה, ולכן תמיד מוצגת עם אזהרה מפורשת בממשק (ר' recipe_calories_estimated_hint) ---
// name: שם תצוגה נקי (בלי תחביר regex) - משמש את בורר-המאכלים הניתן-לחיפוש
// (openFoodPicker), בנפרד לגמרי מ-re שממשיך לשמש למילוי אוטומטי מטקסט חופשי
const FOOD_CALORIE_DB = [
    // מרקים - לפי בקשה מפורשת. חייבים לבוא *ראשונים* בכל הרשימה (לפני קקאו
    // וכל השאר), לא רק לפני "מרק" הכללי בסוף האשכול: שמות מרקים ספציפיים
    // מכילים מרכיב קיים (למשל "מרק עוף" מכיל "עוף", "מרק בצל" מכיל "בצל",
    // "מרק עגבניות" מכיל "עגבני") שמוגדר בהמשך הרשימה למטה - בלי סדר הפוך,
    // "מרק עוף" היה תמיד נתפס כחזה עוף רגיל (165 קל') במקום מרק (40 קל')
    { name: "מרק עוף", re: /מרק עוף|chicken soup/i, kcal100g: 40, unitGrams: 250 },
    { name: "מרק ירקות", re: /מרק ירקות|vegetable soup/i, kcal100g: 35, unitGrams: 250 },
    { name: "מרק עדשים", re: /מרק עדשים|lentil soup/i, kcal100g: 80, unitGrams: 250 },
    { name: "מרק פטריות", re: /מרק פטריות|mushroom soup/i, kcal100g: 60, unitGrams: 250 },
    { name: "מרק עגבניות", re: /מרק עגבניות|tomato soup/i, kcal100g: 35, unitGrams: 250 },
    { name: "מרק דלעת", re: /מרק דלעת|pumpkin soup|squash soup/i, kcal100g: 45, unitGrams: 250 },
    { name: "מרק בצל", re: /מרק בצל|onion soup/i, kcal100g: 50, unitGrams: 250 },
    { name: "מרק מיסו", re: /מרק מיסו|miso soup/i, kcal100g: 40, unitGrams: 200 },
    // מרק כללי (סוג לא מזוהה) - חייב לבוא *אחרי* כל הסוגים הספציפיים למעלה
    { name: "מרק", re: /מרק|\bsoup\b/i, kcal100g: 45, unitGrams: 250 },
    // קינוחים נוספים - לפי בקשה מפורשת. "מוס" גם כאן למעלה (לא ליד עוגה/עוגיות
    // בהמשך הרשימה) מאותה סיבה בדיוק כמו המרקים: "מוס שוקולד" מכיל "שוקולד",
    // שמוגדר בהמשך הרשימה - בלי סדר הפוך היה תמיד נתפס כשוקולד רגיל (546 קל')
    { name: "פודינג", re: /פודינג|pudding/i, kcal100g: 140, unitGrams: 120 },
    { name: "מוס", re: /מוס(?!ד)|mousse/i, kcal100g: 250, unitGrams: 100 },
    { name: "וופל", re: /וופל|waffle/i, kcal100g: 291, unitGrams: 75 },
    { name: "חלבה", re: /חלבה|halva/i, kcal100g: 520, unitGrams: 30 },
    { name: "קרם קרמל/פלאן", re: /קרם קרמל|פלאן|crème caramel|creme caramel|\bflan\b/i, kcal100g: 120, unitGrams: 100 },
    { name: "בראוני", re: /בראוני|brownie/i, kcal100g: 466, unitGrams: 40 },
    { name: "טירמיסו", re: /טירמיסו|tiramisu/i, kcal100g: 283, unitGrams: 120 },
    // מיצים ספציפיים + לחמים ספציפיים + רוטב עגבניות - גם כאן למעלה מאותה
    // סיבה בדיוק: "מיץ תפוחים"/"מיץ ענבים"/"רוטב עגבניות" מכילים "תפוח"/
    // "ענבים"/"עגבני" בהתאמה, ו"לחם X" מכיל גם "לחם" (הערך הכללי בהמשך
    // הרשימה) וגם, במקרה של "לחם לבן" ספציפית, את "לבן" (מוצר חלב מוגן-גבול
    // בהמשך) - כל אלה חייבים לבוא ראשונים כדי לא להיתפס כמרכיב הבודד שבתוכם
    { name: "מיץ תפוחים", re: /מיץ תפוחים|apple juice/i, kcal100g: 46, unitGrams: 200 },
    { name: "מיץ ענבים", re: /מיץ ענבים|grape juice/i, kcal100g: 60, unitGrams: 200 },
    { name: "רוטב עגבניות", re: /רוטב עגבניות|tomato sauce|marinara/i, kcal100g: 35, unitGrams: 60 },
    { name: "לחם לבן", re: /לחם לבן|white bread/i, kcal100g: 265, unitGrams: 30 },
    { name: "לחם דגנים", re: /לחם דגנים|לחם מלא|לחם מחיטה מלאה|whole\s*(grain|wheat)\s*bread/i, kcal100g: 247, unitGrams: 30 },
    { name: "לחם שיפון", re: /לחם שיפון|rye bread/i, kcal100g: 259, unitGrams: 32 },
    { name: "לחם קל", re: /לחם קל|לחם דיאט|diet bread|light bread/i, kcal100g: 210, unitGrams: 20 },
    // עוד ממרחים - לפי בקשה מפורשת ("כל סוגי הממרחים"). כולם למעלה כי כמעט
    // כולם מכילים מרכיב-בסיס קיים כתת-מחרוזת (חצילים/טונה/ביצה/זיתים/חלב/
    // שמנת), ובלי הסדר הזה כל אחד מהם היה תמיד נתפס כמרכיב הבסיס הפשוט שלו
    // ולא כממרח המורכב (בד"כ עם מיונז/שמן/עוד רכיבים, ולכן קלורי יותר)
    { name: "מרגרינה", re: /מרגרינה|margarine/i, kcal100g: 717, unitGrams: 10 },
    { name: "שמנת חמוצה", re: /שמנת חמוצה|sour cream/i, kcal100g: 198, unitGrams: 20 },
    { name: "מטבוחה", re: /מטבוחה|matbucha/i, kcal100g: 90, unitGrams: 50 },
    { name: "סלט חצילים", re: /סלט חצילים|חצילים בטחינה|eggplant salad|eggplant dip/i, kcal100g: 150, unitGrams: 50 },
    { name: "גואקמולי", re: /גואקמולי|guacamole/i, kcal100g: 150, unitGrams: 50 },
    { name: "לבנה/לאבנה", re: /לבנה|לאבנה|labn[ae]h/i, kcal100g: 280, unitGrams: 30 },
    { name: "ריבת חלב", re: /ריבת חלב|dulce de leche/i, kcal100g: 315, unitGrams: 20 },
    { name: "סלט טונה", re: /סלט טונה|tuna salad/i, kcal100g: 200, unitGrams: 60 },
    { name: "סלט ביצים", re: /סלט ביצים|egg salad/i, kcal100g: 215, unitGrams: 60 },
    { name: "ממרח זיתים", re: /ממרח זיתים|olive tapenade/i, kcal100g: 230, unitGrams: 20 },
    { name: "קקאו", re: /קקאו|cocoa/i, kcal100g: 228 },
    { name: "שוקולד", re: /שוקולד|chocolate/i, kcal100g: 546 },
    { name: "קמח", re: /קמח|flour/i, kcal100g: 364 },
    { name: "סוכר חום", re: /סוכר חום|brown sugar/i, kcal100g: 380 },
    { name: "סוכר", re: /סוכר|sugar/i, kcal100g: 387 },
    { name: "חמאה", re: /חמאה|butter/i, kcal100g: 717 },
    // גבינת שמנת חייבת לבוא *לפני* שמנת - "גבינת שמנת" מכילה "שמנת" כמילה
    // נפרדת (בניגוד ל"חמאת בוטנים" למעלה, שהצורה הנסמכת "חמאת" מסתיימת ב-ת
    // ולא ב-ה כמו "חמאה" ולכן לא מתנגשת - כאן "שמנת" עצמה כתובה מלא, לא נסמך)
    // - בלי סדר הפוך זה תמיד היה נתפס כשמנת נוזלית (340) במקום גבינת שמנת (342)
    { name: "גבינת שמנת", re: /גבינת שמנת|cream cheese/i, kcal100g: 342, unitGrams: 30 },
    // שמנת חייבת לבוא *לפני* שמן - "שמנת" מתחילה באותן 3 אותיות בדיוק כמו
    // "שמן" (ש-מ-ן), אז בלי סדר הפוך, "שמנת" הייתה תמיד נתפסת כשמן (884 קל'
    // ל-100 גרם) במקום שמנת (340) - אותה בעיה בדיוק כמו יוגורט פרו/סוכר חום למעלה
    { name: "שמנת", re: /שמנת|cream/i, kcal100g: 340 },
    { name: "שמן", re: /שמן|\boil\b/i, kcal100g: 884 },
    // (^|[^א-ת])...(?:$|[^א-ת]) כדי ש"חלבון" (חלבון ביצה/אבקת חלבון) לא ייתפס
    // כ"חלב" (חלב מתחיל באותן 3 אותיות בדיוק) - בלי זה, כל הזכרה של "חלבון"
    // הייתה תמיד נתפסת כחלב רגיל ולעולם לא מגיעה לערך המדויק יותר של ביצה/חלבון
    // חלב סויה/שקדים/שיבולת שועל (תחליפי חלב צמחיים) חייבים לבוא *לפני* חלב -
    // "חלב סויה" מכיל "חלב" כתת-מחרוזת עם רווח אחריה, שעונה גם על ההגנה
    // (^|[^א-ת])...(?:$|[^א-ת]) של חלב - בלי סדר הפוך זה תמיד היה נתפס כחלב
    // פרה רגיל (42 קל') במקום הערך הצמחי המדויק יותר - לפי בקשה מפורשת ("צמחוניים")
    // sweetenedKcal100g: גרסה ממותקת ("עם סוכר"/"ממותק") שונה משמעותית מהגרסה
    // הלא-ממותקת (kcal100g הרגיל, שהוא גם ברירת המחדל) - ר' findSweetenedCalories
    { name: "חלב סויה", re: /חלב סויה|soy milk/i, kcal100g: 33, sweetenedKcal100g: 54, unitGrams: 200 },
    { name: "חלב שקדים", re: /חלב שקדים|almond milk/i, kcal100g: 17, sweetenedKcal100g: 30, unitGrams: 200 },
    { name: "חלב שיבולת שועל", re: /חלב שיבולת שועל|oat milk/i, kcal100g: 47, sweetenedKcal100g: 58, unitGrams: 200 },
    // אבקת חלב חייבת לבוא *לפני* חלב - "אבקת חלב" מכילה "חלב" עם רווח לפני
    // וסוף-מחרוזת אחרי, שעונה על הגנת הגבול של חלב - בלי סדר הפוך זה תמיד
    // היה נתפס כחלב נוזלי רגיל (42) במקום אבקה מרוכזת בהרבה (496)
    { name: "אבקת חלב", re: /אבקת חלב|milk powder/i, kcal100g: 496, unitGrams: 30 },
    { name: "חלב", re: /(^|[^א-ת])חלב(?:$|[^א-ת])|\bmilk\b/i, kcal100g: 42, unitGrams: 200 },
    { name: "דבש", re: /דבש|honey/i, kcal100g: 304, unitGrams: 20 },
    { name: "נוטלה", re: /נוטלה|nutella/i, kcal100g: 539, unitGrams: 20 },
    { name: "ריבה", re: /ריבה|\bjam\b|preserves/i, kcal100g: 250, unitGrams: 20 },
    // percentTable: אחוזי שומן נפוצים על אריזות ישראליות - אם המשתמש כתב אחוז
    // מפורש (למשל "קוטג' 9%"), findFatPercentCalories משתמש בערך הקרוב ביותר
    // בטבלה במקום ב-kcal100g הכללי; קוטג'/גבינה לבנה/גבינה חייבים גם לבוא
    // *לפני* גבינה (ראו ההערה הקיימת למטה)
    { name: "קוטג'", re: /קוטג['׳]?|cottage cheese/i, kcal100g: 98, unitGrams: 250, percentTable: { 0: 72, 5: 98, 9: 135 } },
    // גבינה לבנה/מוצרלה/פטה/פרמזן/גבינת עיזים חייבות לבוא *לפני* גבינה -
    // "גבינה לבנה" מכילה את "גבינה" כתת-מחרוזת, ומדובר במוצר שונה לגמרי בערכים
    // (רך/משוח, לא גבינה קשה) - בלי סדר הפוך זה תמיד היה נתפס כגבינה קשה
    // רגילה (350 קל') במקום 95 (5%, הכי נפוץ)
    { name: "גבינה לבנה", re: /גבינה לבנה|white cheese/i, kcal100g: 95, unitGrams: 100, percentTable: { 3: 80, 5: 95, 9: 135, 20: 220 } },
    { name: "מוצרלה", re: /מוצרלה|mozzarella/i, kcal100g: 280, unitGrams: 100 },
    { name: "פטה", re: /פטה|\bfeta\b/i, kcal100g: 264, unitGrams: 50 },
    { name: "פרמזן", re: /פרמזן|parmesan/i, kcal100g: 431, unitGrams: 10 },
    { name: "גבינת עיזים", re: /גבינת עיזים|goat cheese/i, kcal100g: 364, unitGrams: 30 },
    { name: "גבינה", re: /גבינה|cheese/i, kcal100g: 300, unitGrams: 25, percentTable: { 9: 220, 28: 300, 45: 400 } },
    { name: "אבקת אפייה", re: /אבקת אפייה|baking powder|סודה לשתייה|baking soda/i, kcal100g: 53 },
    { name: "שמרים", re: /שמרים|yeast/i, kcal100g: 105 },
    // פירוט אגוזים/זרעים/פיצוחים לפי סוג - ר' האשכול המפורט בהמשך הרשימה, אחרי
    // חמאת בוטנים (חייב לבוא *אחריה*, כי "בוטנים" תת-מחרוזת של "חמאת בוטנים")
    // עוד חלבון צמחוני/טבעוני - לפי בקשה מפורשת
    { name: "סייטן", re: /סייטן|seitan/i, kcal100g: 370, unitGrams: 100 },
    { name: "טמפה", re: /טמפה|tempeh/i, kcal100g: 193, unitGrams: 100 },
    { name: "שניצל צמחוני", re: /שניצל (צמחוני|טבעוני|סויה)|vegan schnitzel|veggie schnitzel/i, kcal100g: 250, unitGrams: 100 },
    // שניצל (עוף) רגיל - חייב לבוא *אחרי* שניצל צמחוני למעלה, כדי שהמילים
    // הספציפיות (צמחוני/טבעוני/סויה) עדיין ייתפסו נכון קודם
    // unitGrams תוקן מ-150 ל-120 - 150 גרם זו יותר מנה גדולה של מסעדה; שניצל
    // ביתי בגודל בינוני שוקל בערך 100-120 גרם מבושל
    { name: "שניצל", re: /שניצל|schnitzel/i, kcal100g: 250, unitGrams: 120 },
    { name: "קציצות בשר", re: /קציצ(ה|ות)( בשר)?|meatballs?/i, kcal100g: 215, unitGrams: 100 },
    // גם (?!אדמה) חוץ מ-(?!הצהריים) - בלי זה, "תפוח אדמה" (תפוח-אדמה, ערך
    // נפרד ומדויק יותר בהמשך הרשימה) היה תמיד נתפס כתפוח עץ רגיל (52 קל')
    { name: "תפוח", re: /תפוח(?!\s*(הצהריים|אדמה))|apple/i, kcal100g: 52, unitGrams: 182 },
    { name: "בננה", re: /בננה|banana/i, kcal100g: 89, unitGrams: 118 },
    // אורז מטוגן חייב לבוא *לפני* אורז - מכיל "אורז" כתת-מחרוזת, וטיגון בשמן
    // משנה משמעותית את הקלוריות (200 מול 130 ל-100 גרם)
    { name: "אורז מטוגן", re: /אורז מטוגן|fried rice/i, kcal100g: 200, unitGrams: 200 },
    { name: "אורז", re: /אורז|\brice\b/i, kcal100g: 130, unitGrams: 150 },
    { name: "פסטה", re: /פסטה|pasta/i, kcal100g: 131, unitGrams: 200 },
    { name: "לחם", re: /לחם|bread/i, kcal100g: 265, unitGrams: 30 },
    { name: "חלה", re: /חלה|challah/i, kcal100g: 332, unitGrams: 40 },
    { name: "בגט", re: /בגט|baguette/i, kcal100g: 270, unitGrams: 25 },
    { name: "לחמניה", re: /לחמני(ה|ות)|\bbun\b|dinner roll/i, kcal100g: 280, unitGrams: 50 },
    { name: "פוקצ'ה", re: /פוקצ['׳]?ה|focaccia/i, kcal100g: 249, unitGrams: 50 },
    // שוקי/כנפי עוף חייבים לבוא *לפני* עוף (חזה) - שניהם מכילים "עוף" כתת-
    // מחרוזת, וזה בשר כהה/שומני יותר מחזה עוף - בלי סדר הפוך היה תמיד נתפס
    // כחזה עוף רגיל (165 קל')
    { name: "שוקי עוף", re: /שוקי עוף|chicken thigh/i, kcal100g: 209, unitGrams: 150 },
    { name: "כנפי עוף", re: /כנפי עוף|chicken wings?/i, kcal100g: 203, unitGrams: 100 },
    { name: "עוף", re: /חזה עוף|עוף|chicken/i, kcal100g: 165, unitGrams: 150 },
    { name: "טונה", re: /טונה|tuna/i, kcal100g: 116, unitGrams: 100 },
    // עוד דגים נפוצים - לפי בקשה מפורשת ("דגים"), אותו מסד חינמי-לוקאלי
    { name: "בקלה", re: /בקלה|\bcod\b/i, kcal100g: 105, unitGrams: 150 },
    { name: "מושט/טילפיה", re: /מושט|טילפיה|tilapia/i, kcal100g: 128, unitGrams: 150 },
    { name: "דניס/לברק", re: /דניס|לברק|sea bream|branzino/i, kcal100g: 120, unitGrams: 150 },
    { name: "פורל", re: /פורל|trout/i, kcal100g: 168, unitGrams: 150 },
    { name: "הרינג", re: /הרינג|herring/i, kcal100g: 158, unitGrams: 80 },
    { name: "סרדינים", re: /סרדינ(ים)?|sardines?/i, kcal100g: 208, unitGrams: 50 },
    { name: "שרימפס/חסילון", re: /שרימפס|חסילונ(ים)?|shrimp|prawns?/i, kcal100g: 99, unitGrams: 100 },
    { name: "קלמארי/דיונון", re: /קלמארי|דיונון|calamari|squid/i, kcal100g: 92, unitGrams: 100 },
    // מותגי יוגורט ספציפיים - חייבים לבוא *לפני* הערך הכללי "יוגורט" למטה,
    // כי הלולאה עוצרת בהתאמה הראשונה: אם הכללי היה קודם, "יוגורט פרו" היה
    // תמיד נתפס כיוגורט רגיל ואף פעם לא מגיע לערך הספציפי והמדויק יותר
    { name: "יוגורט פרו", re: /יוגורט פרו|yo\s*pro/i, kcal100g: 90, unitGrams: 200 },
    { name: "יוגורט גו", re: /יוגורט גו|yogurt go/i, kcal100g: 75, unitGrams: 200 },
    { name: "יוגורט יווני", re: /יוגורט יווני|greek yogurt/i, kcal100g: 97, unitGrams: 170 },
    { name: "יוגורט", re: /יוגורט|yogurt|yoghurt/i, kcal100g: 66, unitGrams: 150, percentTable: { 0: 45, 3: 66, 10: 110 } },
    { name: "מלפפון", re: /מלפפון|cucumber/i, kcal100g: 15, unitGrams: 301 },
    { name: "חמוצים", re: /חמוצ(ים)?|pickles?/i, kcal100g: 11, unitGrams: 30 },
    { name: "עגבנייה", re: /עגבני|tomato/i, kcal100g: 18, unitGrams: 123 },
    { name: "חומוס", re: /חומוס|hummus/i, kcal100g: 166, unitGrams: 50 },
    // אבקת חלבון חייבת לבוא *לפני* חלבון ביצה - ל"חלבון ביצה" יש קבוצה
    // אופציונלית (ה?ביצה)? שמזהה גם "חלבון" סתם (כללי, לא דווקא ביצה), אז
    // בלי סדר הפוך "אבקת חלבון" (אבקת חלבון כושר, לא ביצה) הייתה תמיד נתפסת
    // כחלבון-ביצה-בודד (17 קל' ליחידה) במקום אבקה (380 ל-100 גרם)
    { name: "אבקת חלבון", re: /אבקת חלבון|protein powder/i, kcal100g: 380, unitGrams: 30 },
    // חטיף חלבון גם כאן, מאותה סיבה בדיוק - מכיל "חלבון"
    { name: "חטיף חלבון", re: /חטיף חלבון|protein bar/i, kcal100g: 380, unitGrams: 50 },
    { name: "חלבון ביצה", re: /חלבון (ה?ביצה)?|egg white/i, kcalPerUnit: 17 },
    { name: "חלמון ביצה", re: /חלמון|egg yolk/i, kcalPerUnit: 55 },
    // ביצה מטוגנת/חביתה חייבות לבוא *לפני* ביצה - "ביצה מטוגנת" מכילה "ביצ"
    // (הרגקס הרחב של ביצה סתם), וטיגון בשמן משנה משמעותית את הקלוריות ליחידה
    { name: "ביצה מטוגנת", re: /ביצה מטוגנת|fried egg/i, kcalPerUnit: 90 },
    { name: "חביתה", re: /חביתה|omelet|omelette/i, kcal100g: 150, unitGrams: 120 },
    { name: "ביצה", re: /ביצ/i, kcalPerUnit: 70 },
    { name: "מים מוגזים", re: /מים מוגזים|sparkling water|soda water/i, kcal100g: 0 },
    { name: "מים", re: /מים|\bwater\b/i, kcal100g: 0 },
    { name: "מלח", re: /מלח|\bsalt\b/i, kcal100g: 0 },
    // הרחבה: עוד ירקות/פירות/חלבונים/דגנים/מוצרים נפוצים - לפי בקשה מפורשת
    // ("רוב המאכלים"), עדיין אותו מסד חינמי-לוקאלי, בלי שום קריאת API
    { name: "בטטה", re: /בטטה|sweet potato/i, kcal100g: 86, unitGrams: 130 },
    { name: "תפוח אדמה", re: /תפוח אדמה|תפו"א|potato/i, kcal100g: 77, unitGrams: 173 },
    { name: "גזר", re: /גזר|carrot/i, kcal100g: 41, unitGrams: 61 },
    { name: "ברוקולי", re: /ברוקולי|broccoli/i, kcal100g: 34, unitGrams: 80 },
    { name: "כרובית", re: /כרובית|cauliflower/i, kcal100g: 25, unitGrams: 80 },
    { name: "חסה", re: /חסה|lettuce/i, kcal100g: 15, unitGrams: 30 },
    { name: "פלפל", re: /פלפל|pepper/i, kcal100g: 31, unitGrams: 119 },
    { name: "בצל", re: /בצל|onion/i, kcal100g: 40, unitGrams: 110 },
    { name: "כרישה", re: /כרישה|\bleek\b/i, kcal100g: 61, unitGrams: 100 },
    { name: "במיה", re: /במיה|okra/i, kcal100g: 33, unitGrams: 100 },
    { name: "לפת", re: /לפת|turnip/i, kcal100g: 28, unitGrams: 122 },
    // (^|[^א-ת])...(?:$|[^א-ת]) במקום lookbehind/lookahead: אותה תוצאה (גבול
    // מילה עברי אמיתי, כי \b לא עובד על עברית ב-JS), אבל בתחביר regex בסיסי
    // שנתמך בכל דפדפן - lookbehind (?<!...) לא נתמך ב-Safari ישן (לפני 16.4),
    // ועלול לגרום ל-SyntaxError בזמן טעינת כל הקובץ, לא רק בביטוי הזה
    { name: "שום", re: /(^|[^א-ת])שום(?:$|[^א-ת])|garlic/i, kcal100g: 149 },
    { name: "קישוא", re: /קישוא|zucchini/i, kcal100g: 17, unitGrams: 100 },
    { name: "חציל", re: /חציל|eggplant/i, kcal100g: 25, unitGrams: 200 },
    // תירס קלוי (חטיף פיצוחים, לא ירק) חייב לבוא *לפני* תירס - מכיל "תירס"
    // כתת-מחרוזת, וקלורי בהרבה מתירס טרי/מבושל (טיגון/קלייה) - לפי בקשה מפורשת
    { name: "תירס קלוי", re: /תירס קלוי|corn nuts?|roasted corn/i, kcal100g: 418, unitGrams: 30 },
    { name: "תירס", re: /תירס|corn/i, kcal100g: 86, unitGrams: 80 },
    { name: "אבוקדו", re: /אבוקדו|avocado/i, kcal100g: 160, unitGrams: 201 },
    { name: "לימון", re: /לימון|lemon/i, kcal100g: 29, unitGrams: 58 },
    // מיץ תפוזים חייב לבוא *לפני* תפוז - "מיץ תפוזים" מכיל את "תפוז" כתת-מחרוזת
    // (ריבוי "תפוזים" מתחיל באותן אותיות), אז בלי סדר הפוך זה תמיד היה נתפס
    // כתפוז בודד (עם unitGrams, לא הגיוני לכוס מיץ) במקום ערך המיץ המדויק
    { name: "מיץ תפוזים", re: /מיץ תפוזים|orange juice/i, kcal100g: 45, unitGrams: 200 },
    { name: "תפוז", re: /תפוז|orange/i, kcal100g: 47, unitGrams: 131 },
    { name: "ענבים", re: /ענבים|grapes/i, kcal100g: 69, unitGrams: 80 },
    { name: "אבטיח", re: /אבטיח|watermelon/i, kcal100g: 30, unitGrams: 150 },
    { name: "מלון", re: /(^|[^א-ת])מלון(?:$|[^א-ת])|\bmelon\b/i, kcal100g: 34, unitGrams: 150 },
    { name: "תות", re: /תות|strawberry/i, kcal100g: 32, unitGrams: 12 },
    { name: "אננס", re: /אננס|pineapple/i, kcal100g: 50, unitGrams: 80 },
    { name: "מנגו", re: /מנגו|mango/i, kcal100g: 60, unitGrams: 207 },
    { name: "אגס", re: /אגס|pear/i, kcal100g: 57, unitGrams: 178 },
    // עוד פירות - לפי בקשה מפורשת
    { name: "תמר", re: /תמר(ים)?|\bdate\b|dates/i, kcal100g: 277, unitGrams: 20 },
    { name: "שזיף", re: /שזיף|plum/i, kcal100g: 46, unitGrams: 66 },
    { name: "אפרסק", re: /אפרסק|peach/i, kcal100g: 39, unitGrams: 150 },
    { name: "משמש", re: /משמש|apricot/i, kcal100g: 48, unitGrams: 35 },
    { name: "קיווי", re: /קיווי|kiwi/i, kcal100g: 61, unitGrams: 76 },
    { name: "רימון", re: /רימון|pomegranate/i, kcal100g: 83, unitGrams: 100 },
    { name: "תאנה", re: /תאנה|\bfig\b/i, kcal100g: 74, unitGrams: 50 },
    { name: "בשר טחון", re: /בשר טחון|ground beef|minced meat/i, kcal100g: 254, unitGrams: 150 },
    { name: "בשר בקר", re: /בשר בקר|beef/i, kcal100g: 250, unitGrams: 150 },
    // עוד סוגי בשר - לפי בקשה מפורשת
    { name: "כבש/טלה", re: /כבש|טלה|lamb/i, kcal100g: 294, unitGrams: 150 },
    { name: "חזיר", re: /חזיר|\bpork\b/i, kcal100g: 242, unitGrams: 150 },
    { name: "כבד", re: /כבד|liver/i, kcal100g: 170, unitGrams: 100 },
    // פסטרמה חייבת לבוא *לפני* פסטה - "פסטרמה" מתחילה כמעט באותן אותיות
    // (פ-ס-ט), אבל האות ה-4 שונה (ר מול ה) אז זה כן בטוח בלי סדר מיוחד -
    // ההערה כאן רק להסביר למה זה לא נראה כמו התנגשות שנשכחה
    { name: "פסטרמה", re: /פסטרמה|pastrami/i, kcal100g: 147, unitGrams: 30 },
    { name: "הודו", re: /הודו|turkey/i, kcal100g: 135, unitGrams: 150 },
    { name: "סלמון", re: /סלמון|salmon/i, kcal100g: 208, unitGrams: 150 },
    // (?!י) כדי ש"נקניק" (סלמי/נקניק מעושן) לא יתפוס את "נקניקייה" (נקניקיית
    // פרנקפורטר) - "נקניק" הוא תת-מחרוזת/קידומת מדויקת של "נקניקייה"
    { name: "נקניק", re: /נקניק(?!י)|salami|cured sausage/i, kcal100g: 336, unitGrams: 30 },
    // נקניקיי?ה - כתיב מלא (עם יו"ד כפולה, "נקניקייה") וגם כתיב חסר (יו"ד
    // אחת, "נקניקיה") - השורש היה בעייתי (רק כתיב חסר) ומעולם לא היה תואם
    // בפועל את הכתיב המלא, הנפוץ/הרשמי יותר היום
    { name: "נקניקייה", re: /נקניקיי?ה|sausage/i, kcal100g: 300, unitGrams: 50 },
    { name: "עדשים", re: /עדשים|lentils/i, kcal100g: 116, unitGrams: 150 },
    { name: "שעועית", re: /שעועית|beans/i, kcal100g: 127, unitGrams: 150 },
    { name: "אפונה", re: /אפונה|peas/i, kcal100g: 81, unitGrams: 80 },
    { name: "פול", re: /(^|[^א-ת])פול(?:$|[^א-ת])|fava/i, kcal100g: 110, unitGrams: 100 },
    // קטניות כללי (סוג לא מזוהה) - חייב לבוא *אחרי* כל הסוגים הספציפיים למעלה
    { name: "קטניות", re: /קטניות|legumes/i, kcal100g: 120, unitGrams: 150 },
    { name: "קינואה", re: /קינואה|quinoa/i, kcal100g: 120, unitGrams: 150 },
    { name: "שיבולת שועל", re: /שיבולת שועל|קוואקר|oats|oatmeal/i, kcal100g: 389, unitGrams: 40 },
    { name: "גרנולה", re: /גרנולה|granola/i, kcal100g: 471, unitGrams: 40 },
    { name: "מוזלי", re: /מוזלי|muesli/i, kcal100g: 360, unitGrams: 40 },
    { name: "קורנפלקס", re: /קורנפלקס|cornflakes/i, kcal100g: 357, unitGrams: 30 },
    { name: "קרקר/ביסקוויט", re: /קרקר|ביסקוויט|crackers?|biscuits?/i, kcal100g: 440, unitGrams: 20 },
    { name: "פיתה", re: /פיתה|pita/i, kcal100g: 275, unitGrams: 60 },
    { name: "טורטיה", re: /טורטיה|tortilla/i, kcal100g: 300, unitGrams: 50 },
    { name: "טופו", re: /טופו|tofu/i, kcal100g: 76, unitGrams: 100 },
    { name: "זיתים", re: /זית(ים)?|olives/i, kcal100g: 115, unitGrams: 15 },
    { name: "טחינה", re: /טחינה|tahini/i, kcal100g: 595, unitGrams: 20 },
    { name: "מיונז", re: /מיונז|mayonnaise|mayo/i, kcal100g: 680, unitGrams: 15 },
    { name: "קטשופ", re: /קטשופ|ketchup/i, kcal100g: 112, unitGrams: 15 },
    { name: "חמאת בוטנים", re: /חמאת בוטנים|peanut butter/i, kcal100g: 588, unitGrams: 20 },
    // כל סוגי הפיצוחים (אגוזים/זרעים) בנפרד, כל אחד עם ערך משלו - לפי בקשה
    // מפורשת. חייבים לבוא *אחרי* חמאת בוטנים למעלה - "בוטנים" תת-מחרוזת של
    // "חמאת בוטנים", ובלי הסדר הזה חמאת בוטנים הייתה תמיד נתפסת כבוטנים רגילים
    // (567 קל') במקום הממרח (588). "אגוזי לוז"/בונדוק חייב לבוא *לפני* אגוזי
    // מלך - "אגוזי" משותף לשניהם, ואגוזי מלך הוא ברירת המחדל הכללית של "אגוז" סתם
    { name: "בונדוק/אגוזי לוז", re: /בונדוק|אגוזי לוז|hazelnuts?/i, kcal100g: 628, unitGrams: 30 },
    { name: "אגוזי מלך", re: /אגוזי מלך|אגוז(ים)?|walnuts?/i, kcal100g: 654, unitGrams: 30 },
    { name: "שקדים", re: /שקד(ים)?|almonds?/i, kcal100g: 579, unitGrams: 30 },
    { name: "בוטנים", re: /בוטנ(ים)?|peanuts?/i, kcal100g: 567, unitGrams: 30 },
    { name: "קשיו", re: /קשיו|cashews?/i, kcal100g: 553, unitGrams: 30 },
    { name: "פיסטוקים", re: /פיסטוק(ים)?|pistachios?/i, kcal100g: 560, unitGrams: 30 },
    { name: "שומשום", re: /שומשום|sesame/i, kcal100g: 573, unitGrams: 15 },
    { name: "גרעיני חמנייה", re: /גרעיני חמניה|גרעיני חמנייה|sunflower seeds?/i, kcal100g: 584, unitGrams: 30 },
    { name: "גרעיני דלעת", re: /גרעיני דלעת|pumpkin seeds?/i, kcal100g: 559, unitGrams: 30 },
    // גרעינים כללי (סוג לא מזוהה) - חייב לבוא *אחרי* הסוגים הספציפיים למעלה
    { name: "גרעינים", re: /גרעינ(ים)?|seeds/i, kcal100g: 580, unitGrams: 30 },
    // עוד רטבים - לפי בקשה מפורשת (רוטב עגבניות כבר למעלה, ליד שאר המרכיבים
    // המכילים מרכיב קיים - ר' ההערה שם)
    { name: "חרדל", re: /חרדל|mustard/i, kcal100g: 66, unitGrams: 10 },
    { name: "רוטב סויה", re: /רוטב סויה|soy sauce/i, kcal100g: 53, unitGrams: 15 },
    { name: "רוטב טרטר", re: /רוטב טרטר|tartar sauce/i, kcal100g: 300, unitGrams: 20 },
    { name: "ויניגרט", re: /ויניגרט|vinaigrette/i, kcal100g: 200, unitGrams: 15 },
    { name: "רוטב פסטו", re: /רוטב פסטו|\bpesto\b/i, kcal100g: 303, unitGrams: 20 },
    { name: "רוטב ברביקיו", re: /רוטב ברביקיו|barbecue sauce|bbq sauce/i, kcal100g: 172, unitGrams: 20 },
    { name: "לבן", re: /(^|[^א-ת])לבן(?:$|[^א-ת])|labaneh|leben/i, kcal100g: 62, unitGrams: 200 },
    { name: "קולה", re: /קולה|\bcola\b/i, kcal100g: 42, unitGrams: 330 },
    { name: "בירה", re: /בירה|\bbeer\b/i, kcal100g: 43, unitGrams: 330 },
    { name: "יין", re: /(^|[^א-ת])יין(?:$|[^א-ת])|\bwine\b/i, kcal100g: 83, unitGrams: 150 },
    { name: "פרוסקו/שמפניה", re: /פרוסקו|שמפניה|prosecco|champagne/i, kcal100g: 80, unitGrams: 150 },
    // עוד משקאות - לפי בקשה מפורשת (חמים וקרים)
    // קפה הפוך/קר חייבים לבוא *לפני* קפה הכללי - שניהם מכילים "קפה" כתת-
    // מחרוזת, וההרכב (חלב/קצף, או משקה קר מתוק מבוסס-קפה) שונה משמעותית
    // בקלוריות מקפה שחור פשוט (2 קל' בלבד) - בלי סדר הפוך היו תמיד נתפסים ככה
    { name: "קפה הפוך", re: /קפה הפוך|cappuccino|latte/i, kcal100g: 60, unitGrams: 200 },
    // "קפה קר" בישראל הוא לרוב משקה מבוסס גלידה/חלב וסוכר, לא סתם קפה עם קרח -
    // קלורי משמעותית יותר מקפה שחור קר
    { name: "קפה קר", re: /קפה קר|iced coffee/i, kcal100g: 90, unitGrams: 250 },
    { name: "קפה", re: /קפה|\bcoffee\b/i, kcal100g: 2, unitGrams: 200 },
    // תה קר חייב לבוא *לפני* תה הכללי - "תה קר" (ממותק, כמו נסטי) שונה
    // משמעותית מתה חם רגיל (כמעט 0 קלוריות) - מכיל "תה" עם רווח אחריו, שעונה
    // גם על הגנת הגבול (^|[^א-ת])...(?:$|[^א-ת]) של תה הכללי
    { name: "תה קר", re: /תה קר|iced tea/i, kcal100g: 35, unitGrams: 200 },
    // (^|[^א-ת])...(?:$|[^א-ת]) כמו לבן/יין למעלה - בלי זה "אתה"/"שתה" (מילים
    // עבריות נפוצות ביותר) היו נתפסים כ"תה" בגלל ש-\b לא עובד על עברית
    { name: "תה", re: /(^|[^א-ת])תה(?:$|[^א-ת])|\btea\b/i, kcal100g: 1, unitGrams: 200 },
    // אבקת שוקו חייבת לבוא *לפני* שוקו - "אבקת שוקו" (אבקה מתוקה להוספה לחלב,
    // כמו אבקת שוקו למיניה) מכילה "שוקו" כמילה שלמה, וריכוזה (אבקה יבשה) שונה
    // לגמרי מהמשקה המוכן (שוקו נוזלי) - בלי סדר הפוך היה תמיד נתפס כמשקה מוכן
    { name: "אבקת שוקו", re: /אבקת שוקו|chocolate (drink )?powder|hot chocolate powder/i, kcal100g: 380, unitGrams: 20 },
    // (?!לד) כדי ש"שוקו" לא יתפוס את "שוקולד" (שמתחיל באותן 4 אותיות בדיוק)
    { name: "שוקו", re: /שוקו(?!לד)|chocolate milk/i, kcal100g: 75, unitGrams: 200 },
    { name: "לימונדה", re: /לימונדה|lemonade/i, kcal100g: 40, unitGrams: 200 },
    { name: "משקה אנרגיה", re: /משקה אנרגיה|energy drink/i, kcal100g: 45, unitGrams: 250 },
    { name: "אלכוהול חזק", re: /וודקה|וויסקי|ג'ין|רום|vodka|whisk[e]?y|\bgin\b|\brum\b/i, kcal100g: 231, unitGrams: 40 },
    { name: "ערק", re: /(^|[^א-ת])ערק(?:$|[^א-ת])|\barak\b/i, kcal100g: 231, unitGrams: 40 },
    { name: "ליקר", re: /ליקר|liqueur/i, kcal100g: 300, unitGrams: 30 },
    // מיץ כללי (סוג לא מזוהה) - חייב לבוא *אחרי* כל סוגי המיץ הספציפיים למעלה
    { name: "מיץ", re: /מיץ|\bjuice\b/i, kcal100g: 45, unitGrams: 200 },
    // unitGrams תוקנו לפי חיפוש - פרוסת פיצה ביתית רגילה 70-100 גרם (לא 120),
    // והמבורגר שלם (עם הלחמנייה, לא רק הקציצה) קרוב יותר ל-200 גרם
    { name: "פיצה", re: /פיצה|pizza/i, kcal100g: 266, unitGrams: 100 },
    { name: "המבורגר", re: /המבורגר|hamburger|burger/i, kcal100g: 295, unitGrams: 200 },
    { name: "שווארמה", re: /שווארמה|shawarma/i, kcal100g: 250, unitGrams: 250 },
    { name: "פלאפל", re: /פלאפל|falafel/i, kcal100g: 333, unitGrams: 150 },
    { name: "בורקס", re: /בורקס|bourekas?/i, kcal100g: 330, unitGrams: 80 },
    // עוד מנות - ישראלי (חמין/מלאווח/ג'חנון) ועולמי (סושי)
    // unitGrams תוקן ל-160 (רול ממוצע של 8 חתיכות, לפי חיפוש) במקום 200
    { name: "סושי", re: /סושי|sushi/i, kcal100g: 150, unitGrams: 160 },
    { name: "חמין/צ'ולנט", re: /חמין|צ['׳]?ולנט|cholent/i, kcal100g: 200, unitGrams: 300 },
    { name: "מלאווח", re: /מלאווח|malawach/i, kcal100g: 380, unitGrams: 100 },
    { name: "ג'חנון", re: /ג['׳]?חנון|jachnun/i, kcal100g: 350, unitGrams: 150 },
    // מטבח עולמי - לפי בקשה מפורשת ("לא רק ישראלי, עולמי")
    { name: "שקשוקה", re: /שקשוקה|shakshuka/i, kcal100g: 150, unitGrams: 250 },
    { name: "לזניה", re: /לזניה|lasagn[ae]/i, kcal100g: 135, unitGrams: 250 },
    { name: "ריזוטו", re: /ריזוטו|risotto/i, kcal100g: 166, unitGrams: 200 },
    { name: "טאקו", re: /טאקו|\btaco\b/i, kcal100g: 150, unitGrams: 70 },
    { name: "בוריטו", re: /בוריטו|burrito/i, kcal100g: 220, unitGrams: 250 },
    { name: "נאצ'וס", re: /נאצ['׳]?וס|nachos/i, kcal100g: 330, unitGrams: 150 },
    { name: "קארי", re: /קארי|\bcurry\b/i, kcal100g: 150, unitGrams: 250 },
    { name: "נודלס/רמן", re: /נודלס|ראמן|רמן|noodles?|ramen/i, kcal100g: 190, unitGrams: 300 },
    { name: "נאן", re: /(^|[^א-ת])נאן(?:$|[^א-ת])|\bnaan\b/i, kcal100g: 310, unitGrams: 90 },
    { name: "סמוסה", re: /סמוסה|samosa/i, kcal100g: 260, unitGrams: 50 },
    { name: "ספרינג רולס", re: /ספרינג רולס|spring rolls?/i, kcal100g: 180, unitGrams: 80 },
    { name: "דים סאם", re: /דים סאם|dim sum/i, kcal100g: 200, unitGrams: 100 },
    { name: "סלט יווני", re: /סלט יווני|greek salad/i, kcal100g: 85, unitGrams: 200 },
    { name: "סלט ירקות", re: /סלט ירקות|vegetable salad|chopped salad/i, kcal100g: 50, unitGrams: 150 },
    { name: "פנקייק", re: /פנקייק|pancakes?/i, kcal100g: 227, unitGrams: 40 },
    { name: "קרפ", re: /קרפ|\bcr[eê]pe\b/i, kcal100g: 230, unitGrams: 60 },
    // (?!וא) כדי ש"קיש" לא יתפוס את "קישוא" (קישוא מתחיל באותן 3 אותיות בדיוק)
    { name: "קיש", re: /קיש(?!וא)|\bquiche\b/i, kcal100g: 280, unitGrams: 120 },
    // עוד חטיפים - לפי בקשה מפורשת
    { name: "במבה", re: /במבה|bamba/i, kcal100g: 536, unitGrams: 25 },
    { name: "ביסלי", re: /ביסלי|bissli/i, kcal100g: 490, unitGrams: 25 },
    { name: "פופקורן", re: /פופקורן|popcorn/i, kcal100g: 400, unitGrams: 30 },
    { name: "בייגלה", re: /בייגלה|bagele/i, kcal100g: 450, unitGrams: 30 },
    { name: "ארטיק/קרטיב", re: /ארטיק|קרטיב|popsicle|ice pop/i, kcal100g: 70, unitGrams: 60 },
    { name: "גלידה", re: /גלידה|ice cream/i, kcal100g: 207, unitGrams: 60 },
    { name: "עוגיות", re: /עוגי(ות|ה)|cookies?/i, kcal100g: 480, unitGrams: 15 },
    { name: "עוגה", re: /עוגה|\bcake\b/i, kcal100g: 350, unitGrams: 80 },
    { name: "קרואסון", re: /קרואסון|croissant/i, kcal100g: 406, unitGrams: 60 },
    // עוד ירקות ותוספות - לפי בקשה מפורשת
    { name: "כרוב", re: /כרוב(?!ית)|cabbage/i, kcal100g: 25, unitGrams: 80 },
    { name: "תרד", re: /תרד|spinach/i, kcal100g: 23, unitGrams: 50 },
    { name: "סלק", re: /סלק|beet(root)?/i, kcal100g: 43, unitGrams: 80 },
    { name: "צנונית", re: /צנונית|radish/i, kcal100g: 16, unitGrams: 50 },
    { name: "פטריות", re: /פטריות|mushrooms?/i, kcal100g: 22, unitGrams: 70 },
    // "שומר" (הירק) הוא גם מילה נפוצה במשמעות "שומר/מאבטח" - אותו טריק גבול-
    // מילה עברי כמו שום/יין/לבן/מלון למעלה, לא lookbehind (תאימות Safari)
    { name: "שומר", re: /(^|[^א-ת])שומר(?:$|[^א-ת])|fennel/i, kcal100g: 31, unitGrams: 100 },
    { name: "ארטישוק", re: /ארטישוק|artichoke/i, kcal100g: 47, unitGrams: 120 },
    { name: "אספרגוס", re: /אספרגוס|asparagus/i, kcal100g: 20, unitGrams: 100 },
    { name: "בורגול", re: /בורגול|bulgur/i, kcal100g: 83, unitGrams: 150 },
    { name: "צ'יפס", re: /צ['׳]?יפס|fries|french fries/i, kcal100g: 312, unitGrams: 150 },
    { name: "פירה", re: /פירה|mashed potato(es)?/i, kcal100g: 105, unitGrams: 150 },
];
// ממירות יחידות נפח/מיכל שכיחות (כף/כפית/כוס/גביע/חופן) לגרם משוער - כדי
// שאפשר יהיה לחשב גם בלי משקל מדויק בגרם/מ"ל, למשל "2 כפות קוטג'". הרגקס
// כאן רק מזהה *איזו* יחידה נכתבה - לא מכיל יותר את הספרה בעצמו (הייתה כאן
// קודם דרישה ל-(\d+...) בתחילת הביטוי, שבגללה "חצי גביע"/"חצי כוס" נכשלו
// לגמרי כי אין שם ספרה בכלל, רק מילת שבר) - הכמות (ספרה/שבר/ברירת מחדל 1)
// מחושבת בנפרד ב-parseQuantityCount ומוכפלת ב-gramsPerUnit ב-estimateIngredientLineCalories
// (?![א-תA-Za-z0-9_]) במקום \b בסוף - \b לא עובד אחרי מילה עברית ב-JS (אותיות
// עבריות אינן "תו מילה"), אז "כוס"/"כף"/"כפית" עם \b בסופן לא היו תופסים כלום
// בפועל כשמדובר בעברית (רק cups/tbsp/tsp האנגליים היו עובדים). לוקהד יחיד
// שעובד לשני הכיוונים: הבא לא יכול להיות לא אות עברית ולא תו-מילה לטיני
const VOLUME_UNIT_TO_GRAMS = [
    { re: /(?:כוסות|כוס|cups?)(?![א-תA-Za-z0-9_])/i, gramsPerUnit: 240 },
    { re: /(?:כפות|כף|tbsp|tablespoons?)(?![א-תA-Za-z0-9_])/i, gramsPerUnit: 15 },
    { re: /(?:כפיות|כפית|tsp|teaspoons?)(?![א-תA-Za-z0-9_])/i, gramsPerUnit: 5 },
    // גביע/קופסה/אריזה - יחידת אריזה נפוצה למוצרי חלב (קוטג'/גבינה לבנה/יוגורט)
    // וגם למוצרים אחרים (חומוס וכו') - גודל ממוצע גס, לא מדויק לכל מוצר ספציפי
    { re: /(?:גביעים|גביע|קופסאות|קופסה|אריזות|אריזה|tubs?|containers?)(?![א-תA-Za-z0-9_])/i, gramsPerUnit: 250 },
    { re: /(?:חופנים|חופן|handfuls?)(?![א-תA-Za-z0-9_])/i, gramsPerUnit: 30 },
];
// מזהה כמות גם כשאין מספר בתחילת השורה - מילות שבר כמו "חצי"/"רבע" (למשל
// "חצי בננה בינונית"), לא רק ספרה מפורשת. ברירת מחדל: יחידה אחת (1) כשלא
// זוהתה שום כמות - "בננה" סתם = בננה אחת, לא 0
function parseQuantityCount(line) {
    // (^|[^א-ת])...(?:$|[^א-ת]) במקום \b סביב המילה העברית - \b לא עובד על
    // עברית ב-JS (אותיות עבריות אינן "תו מילה"/\w), אז \bחצי\b לא היה תופס
    // כלום בפועל וחצי בננה חושב כבננה שלמה. \b נשאר על הגרסה האנגלית, שם זה תקין
    const fractionWords = [
        { re: /(^|[^א-ת])חצי(?:$|[^א-ת])|\bhalf\b|1\s*\/\s*2/i, value: 0.5 },
        { re: /(^|[^א-ת])רבע(?:$|[^א-ת])|\bquarter\b|1\s*\/\s*4/i, value: 0.25 },
        { re: /(^|[^א-ת])שליש(?:$|[^א-ת])|\bthird\b|1\s*\/\s*3/i, value: 1 / 3 },
    ];
    for (const f of fractionWords) {
        if (f.re.test(line)) return f.value;
    }
    // בלי ^ בהתחלה - מספר יכול לבוא *אחרי* שם המאכל (למשל "שניצל 2 בינוני"),
    // לא רק לפניו ("2 שניצלים"). (?!\s*(?:%|אחוז)) כדי לא לבלבל בין כמות לאחוז
    // שומן (למשל "קוטג' 9%" או "גבינה 28 אחוז" - המספר שם הוא אחוז, לא כמות
    // יחידות) - גם כשהאחוז נכתב במילה ("אחוז"/"אחוזים") ולא בסימן %
    const numMatch = line.match(/(\d+(?:\.\d+)?)(?!\s*(?:%|אחוז))/);
    return numMatch ? parseFloat(numMatch[1]) : 1;
}

// "גדול"/"קטן" (או large/small באנגלית) - מתאם גס על משקל-יחידה ממוצע (unitGrams)
// כשלא צוין משקל מפורש בגרם - לא מדויק כמו לשקול, אבל עדיף מלהתעלם מזה לגמרי
function parseSizeMultiplier(line) {
    if (/(^|[^א-ת])גדול(ה)?(?:$|[^א-ת])|\blarge\b|\bbig\b/i.test(line)) return 1.3;
    if (/(^|[^א-ת])קטן(ה)?(?:$|[^א-ת])|\bsmall\b/i.test(line)) return 0.7;
    return 1;
}

// מוצרי חלב רבים (קוטג'/גבינה לבנה/גבינה/יוגורט) מתויגים על גבי האריזה לפי
// אחוז שומן, וזה משפיע משמעותית על הקלוריות - אם המשתמש כתב אחוז מפורש
// (למשל "קוטג' 9%"), מוצאים את האחוז הקרוב ביותר בטבלת המאכל ומשתמשים בערך
// המדויק יותר שלו במקום ב-kcal100g הכללי (שנשאר ברירת המחדל כשלא צוין אחוז)
function findFatPercentCalories(line, percentTable) {
    // תופס גם אחוז שנכתב במילה ("28 אחוז"/"28 אחוזים"), לא רק בסימן % -
    // בלי זה, "אחוז" לא זוהה בכלל כאחוז, והמספר עצמו נתפס (בטעות) ככמות
    // ע"י parseQuantityCount במקום כאחוז שומן
    const m = line.match(/(\d+(?:\.\d+)?)\s*(?:%|אחוזים?)/);
    if (!m || !percentTable) return null;
    const pct = parseFloat(m[1]);
    let closest = null, closestDiff = Infinity;
    Object.keys(percentTable).forEach(key => {
        const diff = Math.abs(parseFloat(key) - pct);
        if (diff < closestDiff) { closestDiff = diff; closest = percentTable[key]; }
    });
    return closest;
}

// "עם סוכר"/"ממותק" מול "ללא סוכר" (שהוא ממילא ברירת המחדל, kcal100g הרגיל)
// - למשקאות צמחיים (סויה/שקדים/שיבולת שועל) שיש להם גרסה ממותקת שונה
// משמעותית בקלוריות מהגרסה הרגילה
function findSweetenedCalories(line, sweetenedKcal100g) {
    if (sweetenedKcal100g == null) return null;
    if (/(^|[^א-ת])(עם סוכר|ממותק(ה)?)(?:$|[^א-ת])|\bsweetened\b|\bwith sugar\b/i.test(line)) return sweetenedKcal100g;
    return null;
}

// מחשבת קלוריות למאכל *ידוע מראש* (item), לפי טקסט הקשר מקומי (contextText) -
// רק ממנו נגזרות הכמות/יחידה/אחוז/גודל, לא איזה מאכל זה (זה כבר נקבע קודם).
// מופרד מהחיפוש-איזה-מאכל-זה (findAllFoodMatches/estimateIngredientLineCalories)
// כדי שאפשר יהיה להשתמש באותה לוגיקת חישוב גם כשכבר יודעים איזה פריט מתאים
// (ר' estimateFreeTextCalories) בלי לסכן זיהוי שגוי מחדש על קטע טקסט חלקי
function computeItemCalories(item, contextText) {
    let grams = null;
    const gramsMatch = contextText.match(/(\d+(?:\.\d+)?)\s*(גרם|ג['׳]|g\b|gram|grams|מ"ל|ml)/i);
    if (gramsMatch) {
        grams = parseFloat(gramsMatch[1]);
    } else {
        // הכמות (ספרה/מילת שבר כמו "חצי"/ברירת מחדל 1) מחושבת בנפרד מזיהוי
        // *איזו* יחידה נכתבה (כוס/כף/כפית/גביע/חופן) - כדי ש"חצי גביע"/"חצי
        // כוס" יעבדו, לא רק "2 כוסות" עם ספרה מפורשת (ר' ההערה על VOLUME_UNIT_TO_GRAMS)
        for (const unit of VOLUME_UNIT_TO_GRAMS) {
            if (unit.re.test(contextText)) { grams = parseQuantityCount(contextText) * unit.gramsPerUnit; break; }
        }
    }
    const count = parseQuantityCount(contextText);
    const pctKcal = item.percentTable ? findFatPercentCalories(contextText, item.percentTable) : null;
    const sweetKcal = item.sweetenedKcal100g ? findSweetenedCalories(contextText, item.sweetenedKcal100g) : null;
    const kcal100g = pctKcal != null ? pctKcal : (sweetKcal != null ? sweetKcal : item.kcal100g);
    if (item.kcalPerUnit != null) return count * item.kcalPerUnit;
    if (grams != null) return (grams / 100) * kcal100g;
    // בלי גרם/מ"ל/כף/כפית/כוס/גביע/חופן מפורש - אם למאכל יש משקל-יחידה
    // ממוצע ידוע (פרי/מנה טיפוסית, למשל בננה=118 גרם), מחשבים לפי זה *
    // הכמות שזוהתה, עם התאמת גדול/קטן אם צוינה
    if (item.unitGrams != null) return (count * item.unitGrams * parseSizeMultiplier(contextText) / 100) * kcal100g;
    return 0; // רכיב זוהה אבל בלי כמות מפורשת ובלי משקל-יחידה ידוע - לא מנחשים, מדלגים
}

function estimateIngredientLineCalories(line) {
    for (const item of FOOD_CALORIE_DB) {
        if (item.re.test(line)) return computeItemCalories(item, line);
    }
    return 0;
}

// מוצאת את *כל* המאכלים שמופיעים בשורה (לא רק את הראשון) לפי הסדר שבו הם
// מופיעים בטקסט, עם המיקום המדויק של כל התאמה. עוברים על FOOD_CALORIE_DB
// לפי סדר העדיפות הרגיל (ספציפי לפני כללי), ומדלגים על התאמה שחופפת לטווח
// שכבר תפוס - כדי ש"גבינה לבנה" לא תיספר גם בתור "גבינה" על אותו טקסט ממש
function findAllFoodMatches(line) {
    const matches = [];
    for (const item of FOOD_CALORIE_DB) {
        const m = item.re.exec(line);
        if (!m) continue;
        const start = m.index, end = m.index + m[0].length;
        const overlaps = matches.some(existing => start < existing.end && end > existing.start);
        if (!overlaps) matches.push({ item, start, end });
    }
    return matches.sort((a, b) => a.start - b.start);
}

// מוצאת את נקודת הפיצול בין שני מאכלים בתוך "הפער" ביניהם (gapStart..gapEnd) -
// הכי קרוב לאמצע הפער, אבל תמיד *על רווח* (לא באמצע מילה) - כדי שמילת כמות
// כמו "חצי" לא תיחתך לשניים (מה שהיה מונע זיהוי שלה בשני הצדדים)
function findGapSplitPoint(text, gapStart, gapEnd) {
    if (gapEnd <= gapStart) return gapStart;
    const rawMid = Math.floor((gapStart + gapEnd) / 2);
    let best = rawMid, bestDist = Infinity;
    for (let i = gapStart; i <= gapEnd; i++) {
        if (text[i] === ' ') {
            const dist = Math.abs(i - rawMid);
            if (dist < bestDist) { bestDist = dist; best = i; }
        }
    }
    return best;
}

// כמו estimateIngredientLineCalories, אבל למשפט חופשי שעשוי לתאר כמה מאכלים
// יחד - גם עם מילות חיבור ("חצי בננה וכוס יוגורט") וגם סתם ברצף בלי אף מילת
// חיבור ("ביצה אחת חצי עגבניה בצל גבינה", איך שאנשים בדרך כלל מתארים מה
// שאכלו). בלי זה, estimateIngredientLineCalories הייתה מזהה רק את המאכל
// *הראשון* שנמצא (לפי סדר המסד, לא סדר הטקסט), ומתעלמת לגמרי מכל שאר מה
// שכתוב, ואף גרוע מזה - כמות ששייכת למאכל אחר בהמשך המשפט (כמו "3 כפות")
// הייתה "נדבקת" בטעות למאכל הראשון שנמצא.
//
// הגישה: מוצאים את *מיקום* כל מאכל בטקסט (findAllFoodMatches), ואז לכל מאכל
// לוקחים "חלון הקשר" מהרווח הכי קרוב לאמצע שבינו לבין המאכל הקודם, עד הרווח
// הכי קרוב לאמצע שבינו לבין המאכל הבא - כך שמילת כמות שנמצאת *בין* שני
// מאכלים (כמו "אחת חצי" בין "ביצה" ל"עגבניה") מתחלקת בערך שווה בשווה ביניהם.
// זה לא מושלם (אין הבנה דקדוקית אמיתית של למי בדיוק שייכת כל מילה), אבל
// מילת כמות כמעט תמיד צמודה למאכל שהיא מתארת, אז ברוב המקרים זה נופל נכון
function estimateFreeTextCalories(text) {
    if (!text) return 0;
    const matches = findAllFoodMatches(text);
    if (!matches.length) return 0;
    let total = 0, matchedAny = false;
    matches.forEach((match, i) => {
        const prevEnd = i > 0 ? matches[i - 1].end : 0;
        const nextStart = i < matches.length - 1 ? matches[i + 1].start : text.length;
        const windowStart = findGapSplitPoint(text, prevEnd, match.start);
        const windowEnd = findGapSplitPoint(text, match.end, nextStart);
        const kcal = computeItemCalories(match.item, text.slice(windowStart, windowEnd));
        if (kcal > 0) { total += kcal; matchedAny = true; }
    });
    return matchedAny ? total : 0;
}

function estimateRecipeCalories(ingredientsText) {
    if (!ingredientsText) return null;
    let total = 0, matchedAny = false;
    ingredientsText.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
        const kcal = estimateFreeTextCalories(line);
        if (kcal > 0) { total += kcal; matchedAny = true; }
    });
    return matchedAny ? Math.round(total) : null;
}

// --- יומן תזונה יומי: מילוי אוטומטי של קלוריות מתוך אותו מסד מזון, כשהמשתמש
// מקליד חופשי בשדה "מה אכלת" (לא בוחר פריסט שמור) - למשל "2 כפות קוטג'"
// ממלא קלוריות לבד. לעולם לא דורס ערך קלוריות שכבר קיים בשדה (גם אם הוקלד
// ידנית וגם אם כבר נטען מפריט שמור בעריכה) - רק משדה קלוריות ריק ---
function autoFillMealCalories(foodInput) {
    const row = foodInput.closest('.meal-row');
    const caloriesInput = row && row.querySelector('.calories-input');
    if (!caloriesInput || caloriesInput.value.trim()) return;
    const estimate = estimateFreeTextCalories(foodInput.value.trim());
    if (estimate > 0) {
        caloriesInput.value = Math.round(estimate);
        updateLiveCaloriesToday();
    }
}

// --- שמירת מה שכבר הוקלד ביומן היומי כ"ארוחה קבועה" (meal_presets) בלחיצה
// אחת - בלי לצאת למסך ניהול-ארוחות נפרד ולהקליד את אותו הדבר שוב.
// data-category על ה-select הקיים בשורה כבר קובע לאיזו קטגוריה זה משתייך ---
async function saveMealRowAsPreset(button) {
    const row = button.closest('.meal-row');
    if (!row) return;
    const foodInput = row.querySelector('.food-input');
    const caloriesInput = row.querySelector('.calories-input');
    const categorySelect = row.querySelector('.preset-select');
    const name = foodInput.value.trim();
    const calories = parseInt(caloriesInput.value) || 0;
    if (!name || calories <= 0) { showAppToast(t('meal_save_preset_missing'), 'error'); return; }
    if (!isPremiumUser && cachedPresets.length >= MEAL_PRESET_FREE_LIMIT) {
        showAppToast(t('preset_limit_desc'), 'error');
        openPremiumUpgradeModal();
        return;
    }
    const category = categorySelect ? categorySelect.getAttribute('data-category') : 'snack';
    await supabaseClient.from('meal_presets').insert({ username: currentUsername, user_id: currentUserId, meal_category: category, food_name: name, calories: calories });
    showAppToast(t('meal_save_preset_success'));
    loadMealPresetsToSelects();
    loadPresetManageList();
}

// --- בורר מאכלים עם חיפוש: דרך אמינה ומדויקת יותר מהקלדה חופשית (שדורשת
// תבנית גרם/כף/כפית מדויקת כדי בכלל להיכנס לפעולה) - כאן בוחרים מאכל מוכר
// מרשימה, מזינים כמות במספר נקי, והחישוב תמיד עובד (אין תלות בניסוח חופשי) ---
let foodPickerTargetRow = null;
let foodPickerSelectedItem = null;
let foodPickerUnitMultiplier = 1;
let foodPickerUnitLabelKey = 'food_picker_unit_grams';

function openFoodPicker(button) {
    foodPickerTargetRow = button.closest('.meal-row');
    foodPickerSelectedItem = null;
    const search = document.getElementById('food-picker-search-input');
    if (search) search.value = '';
    document.getElementById('food-picker-quantity-section').classList.add('hidden');
    renderFoodPickerList('');
    openModal('modal-food-picker');
    if (search) search.focus();
}

// גרם/כף/כפית/כוס - אותם יחסי-המרה בדיוק כמו VOLUME_UNIT_TO_GRAMS (המנתח
// החופשי-מטקסט למעלה), רק כאן כבחירת-כפתור ולא זיהוי-מילה מהטקסט
function selectFoodPickerUnit(btn) {
    document.querySelectorAll('.food-picker-unit-btn').forEach(b => b.classList.toggle('active', b === btn));
    foodPickerUnitMultiplier = parseFloat(btn.getAttribute('data-multiplier')) || 1;
    foodPickerUnitLabelKey = btn.getAttribute('data-i18n');
    updateFoodPickerCaloriesPreview();
}

function renderFoodPickerList(filter) {
    const list = document.getElementById('food-picker-list');
    if (!list) return;
    const query = (filter || '').trim().toLowerCase();
    const matches = FOOD_CALORIE_DB
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.name.toLowerCase().includes(query));
    if (!matches.length) {
        list.innerHTML = `<p class="language-no-results">${t('language_no_results')}</p>`;
        return;
    }
    list.innerHTML = matches.map(({ item, index }) => `
        <button type="button" class="language-picker-item" onclick="selectFoodPickerItem(${index})">
            <span class="language-picker-name">${item.name}</span>
        </button>
    `).join('');
}

function selectFoodPickerItem(index) {
    foodPickerSelectedItem = FOOD_CALORIE_DB[index];
    if (!foodPickerSelectedItem) return;
    const isPerUnit = foodPickerSelectedItem.kcalPerUnit != null;
    document.getElementById('food-picker-selected-name').textContent = foodPickerSelectedItem.name;
    // יחידת "יחידות" (ביצה וכו') לא נמדדת בגרם/כף/כפית/כוס בכלל - מסתירים
    // את שורת בורר-היחידות ומאפסים תמיד לגרם/1 כברירת מחדל לפריט הבא
    const unitRow = document.getElementById('food-picker-unit-row');
    unitRow.classList.toggle('hidden', isPerUnit);
    unitRow.querySelectorAll('.food-picker-unit-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-multiplier') === '1'));
    foodPickerUnitMultiplier = 1;
    foodPickerUnitLabelKey = 'food_picker_unit_grams';
    document.getElementById('food-picker-qty-unit-label').textContent = isPerUnit ? t('food_picker_unit_count') : t('food_picker_unit_grams');
    document.getElementById('food-picker-qty-input').value = '';
    document.getElementById('food-picker-calories-preview').textContent = '';
    document.getElementById('food-picker-quantity-section').classList.remove('hidden');
}

function computeFoodPickerCalories(qty) {
    if (!foodPickerSelectedItem || !qty) return 0;
    if (foodPickerSelectedItem.kcalPerUnit != null) return qty * foodPickerSelectedItem.kcalPerUnit;
    const grams = qty * foodPickerUnitMultiplier;
    return (grams / 100) * foodPickerSelectedItem.kcal100g;
}

function updateFoodPickerCaloriesPreview() {
    const qty = parseFloat(document.getElementById('food-picker-qty-input').value) || 0;
    const calories = Math.round(computeFoodPickerCalories(qty));
    const unitLabel = foodPickerSelectedItem && foodPickerSelectedItem.kcalPerUnit != null ? t('food_picker_unit_count') : t(foodPickerUnitLabelKey);
    document.getElementById('food-picker-qty-unit-label').textContent = unitLabel;
    document.getElementById('food-picker-calories-preview').textContent = qty > 0 ? `${t('food_picker_calories_label')} ${calories}` : '';
}

function confirmFoodPickerSelection() {
    if (!foodPickerSelectedItem || !foodPickerTargetRow) return;
    const qty = parseFloat(document.getElementById('food-picker-qty-input').value) || 0;
    if (qty <= 0) { showAppToast(t('food_picker_missing_qty'), 'error'); return; }
    const calories = Math.round(computeFoodPickerCalories(qty));
    const isPerUnit = foodPickerSelectedItem.kcalPerUnit != null;
    const unitLabel = isPerUnit ? '' : ` ${t(foodPickerUnitLabelKey)}`;
    const foodInput = foodPickerTargetRow.querySelector('.food-input');
    const caloriesInput = foodPickerTargetRow.querySelector('.calories-input');
    foodInput.value = `${foodPickerSelectedItem.name} - ${qty}${unitLabel}`;
    caloriesInput.value = calories;
    updateLiveCaloriesToday();
    closeModal('modal-food-picker');
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

// --- כפתור מפורש בהגדרות: הפעלת ההתראות בעצמה (בנוסף לבקשה השקטה שקורית
// אוטומטית ב-initAppAfterAuth). קליק אמיתי של המשתמשת נותן שני יתרונות על
// פני בקשה שקטה מ-JS בטעינה: (1) בדפדפנים מסוימים חלון האישור מוצג רק
// בתגובה למחוות משתמש אמיתית, לא מקוד שרץ אוטומטית; (2) המצב (מופעל/חסום/
// עדיין לא הוחלט) מוצג בבירור בהגדרות, כדי שלא תישאר "עיוורת" למה שקרה ---
async function requestNotificationPermissionFromSettings() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        showAppToast(t('settings_notifications_status_unsupported'), 'error');
        renderNotificationSettingsStatus();
        return;
    }
    if (Notification.permission === 'denied') {
        // דפדפנים לא מציגים שוב את חלון האישור לאחר דחייה - היחיד שיכול
        // לשנות זאת הוא המשתמש עצמו, בהגדרות הדפדפן/הטלפון
        showAppToast(t('settings_notifications_status_denied'), 'error');
        return;
    }
    if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') { renderNotificationSettingsStatus(); return; }
    }
    await registerPushNotifications();
    renderNotificationSettingsStatus();
    showAppToast(t('settings_notifications_status_granted'));
}

function renderNotificationSettingsStatus() {
    const btn = document.getElementById('btn-enable-notifications');
    const status = document.getElementById('settings-notifications-status');
    if (!btn || !status) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        btn.textContent = t('settings_notifications_btn_blocked');
        status.textContent = t('settings_notifications_status_unsupported');
        return;
    }
    if (Notification.permission === 'granted') {
        btn.textContent = t('settings_notifications_btn_enabled');
        status.textContent = t('settings_notifications_status_granted');
    } else if (Notification.permission === 'denied') {
        btn.textContent = t('settings_notifications_btn_blocked');
        status.textContent = t('settings_notifications_status_denied');
    } else {
        btn.textContent = t('settings_notifications_btn_enable');
        status.textContent = t('settings_notifications_status_default');
    }
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
async function clearSingleSlot(day, slot) {
    await supabaseClient.from('weekly_schedule').delete().eq('user_id', currentUserId).eq('day_of_week', day).eq('slot_number', slot);
    loadWeeklySchedule();
    // בלי זה, מחיקת משימה דרך המודל היחיד הזה לא מרעננת את "לוז יומי" במסך
    // הבית - היא נשארת מוצגת שם עד שיוצאים ונכנסים לאפליקציה מחדש (רענון דף)
    if (day === dbDaysMap[new Date().getDay()]) loadTodayTasks();
}
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
    await loadTodayTasks();
}

// --- יעדים יומיים לתזונה (קלוריות/חלבון) - מקומי בלבד (localStorage), אותו
// דפוס בדיוק כמו יעד המים היומי (waterDailyGoalKey) ---
function calorieDailyGoalKey() { return `weekwise_calorie_goal_${currentUserId}`; }
function getCalorieDailyGoal() { return parseInt(localStorage.getItem(calorieDailyGoalKey())) || 2000; }
function saveCalorieDailyGoal() {
    const val = parseInt(document.getElementById('calorie-daily-goal-input').value) || 2000;
    localStorage.setItem(calorieDailyGoalKey(), String(val));
    updateNutritionGoalProgress();
}
function proteinDailyGoalKey() { return `weekwise_protein_goal_${currentUserId}`; }
function getProteinDailyGoal() { return parseInt(localStorage.getItem(proteinDailyGoalKey())) || 100; }
function saveProteinDailyGoal() {
    const val = parseInt(document.getElementById('protein-daily-goal-input').value) || 100;
    localStorage.setItem(proteinDailyGoalKey(), String(val));
    updateNutritionGoalProgress();
}
let todayCaloriesTotal = 0, todayProteinTotal = 0;
function updateNutritionGoalProgress() {
    const calorieGoal = getCalorieDailyGoal();
    const calorieFill = document.getElementById('calorie-goal-progress-fill');
    if (calorieFill) calorieFill.style.width = `${calorieGoal > 0 ? Math.min(100, Math.round((todayCaloriesTotal / calorieGoal) * 100)) : 0}%`;
    const proteinGoal = getProteinDailyGoal();
    const proteinFill = document.getElementById('protein-goal-progress-fill');
    if (proteinFill) proteinFill.style.width = `${proteinGoal > 0 ? Math.min(100, Math.round((todayProteinTotal / proteinGoal) * 100)) : 0}%`;
}

async function loadDailyNutrition(date) {
    if (!supabaseClient) return;
    const calorieGoalInput = document.getElementById('calorie-daily-goal-input');
    if (calorieGoalInput) calorieGoalInput.value = getCalorieDailyGoal();
    const proteinGoalInput = document.getElementById('protein-daily-goal-input');
    if (proteinGoalInput) proteinGoalInput.value = getProteinDailyGoal();
    document.querySelectorAll('.meal-row').forEach(row => {
        row.querySelector('.food-input').value = '';
        row.querySelector('.calories-input').value = '';
        row.querySelector('.protein-input').value = '';
    });
    document.getElementById('calories-today').innerText = '0';
    const { data } = await supabaseClient.from('calorie_tracker').select('*').eq('user_id', currentUserId).eq('date', date);
    if (!data) return;
    let total = 0, proteinTotal = 0;
    data.forEach(item => {
        const row = document.querySelector(`[data-meal="${item.meal_type}"]`);
        if (row) {
            row.querySelector('.food-input').value = item.food_description;
            row.querySelector('.calories-input').value = item.calories;
            row.querySelector('.protein-input').value = item.protein_grams || '';
            total += item.calories;
            proteinTotal += Number(item.protein_grams) || 0;
        }
    });
    document.getElementById('calories-today').innerText = total;
    todayCaloriesTotal = total;
    todayProteinTotal = proteinTotal;
    updateNutritionGoalProgress();
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

        let attempt = await attemptMealPhotoScan(token, base64, mediaType);
        if (attempt.status === 'retry') attempt = await attemptMealPhotoScan(token, base64, mediaType);

        if (attempt.status === 'limit') { showAppToast(t('ai_monthly_limit_reached'), 'error'); return; }
        if (attempt.status === 'premium_required') { openPremiumUpgradeModal(); return; }
        if (attempt.status !== 'ok') { showAppToast(t('meal_photo_failed'), 'error'); return; }

        const emptyRows = Array.from(document.querySelectorAll('.meal-row')).filter(row => !row.querySelector('.food-input').value.trim());
        attempt.items.slice(0, emptyRows.length).forEach((item, index) => {
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
        const protein = parseFloat(row.querySelector('.protein-input').value) || null;
        const { data: existing } = await supabaseClient.from('calorie_tracker').select('id').eq('user_id', currentUserId).eq('date', date).eq('meal_type', type).maybeSingle();
        if (existing) {
            await supabaseClient.from('calorie_tracker').update({ food_description: food, calories: cals, protein_grams: protein }).eq('id', existing.id);
        } else {
            await supabaseClient.from('calorie_tracker').insert({ username: currentUsername, user_id: currentUserId, date: date, meal_type: type, food_description: food, calories: cals, protein_grams: protein });
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
        if (row) {
            row.querySelector('.food-input').value = item.food_description;
            row.querySelector('.calories-input').value = item.calories;
            row.querySelector('.protein-input').value = item.protein_grams || '';
        }
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
// מחיקה רכה (is_deleted=true) בשני הסוגים (פתקים ורשימת קניות) כדי שאפשר
// יהיה לשחזר מהארכיון, לפי בקשה מפורשת
async function deleteCenterItem(id, type) {
    await supabaseClient.from('my_center_tasks').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
    loadCenterItems(type);
}

// --- ארכיון פריטים מחוקים: קישור מעומעם ומתקפל בתחתית כל רשימה (פתקים
// ורשימת קניות, כל אחת עם הארכיון שלה) - לא קוביה שתמיד מוצגת, "אלפי
// פתקים" בארכיון לא אמורים להכביד על הרשימה הרגילה. שחזור מחזיר is_deleted
// ל-false, מחיקה-לצמיתות היא delete() אמיתי. כל האלמנטים/הפונקציות
// מזוהים לפי type ('weekly'/'general') כדי שלשתי הרשימות יהיה ארכיון נפרד ---
// currentArchiveType - איזה ארכיון (פתקים/רשימת קניות) פתוח כרגע במודל
// המשותף (ר' modal-notes-archive) - נקרא גם ישירות מתוך onclick ב-HTML
// (כפתור "רוקן ארכיון" בתוך המודל), אז זו לא קבועה מקומית לפונקציה
let currentArchiveType = null;

async function refreshNotesArchiveCount(type) {
    if (!supabaseClient || !currentUserId) return;
    const countEl = document.getElementById(`archive-count-${type}`);
    if (!countEl) return;
    const { count } = await supabaseClient.from('my_center_tasks').select('id', { count: 'exact', head: true }).eq('user_id', currentUserId).eq('task_type', type).eq('is_deleted', true);
    countEl.textContent = count || '';
    document.getElementById(`archive-toggle-${type}`).classList.toggle('hidden', !count);
}

// לא מתקפל בתוך הרשימה (בלי חץ, בלי אנימציית-הרחבה) - נכנס כמודל נפרד
// לגמרי, לפי בקשה מפורשת ("כמו לעולם חדש כזה")
async function openNotesArchiveModal(type) {
    currentArchiveType = type;
    await loadNotesArchiveList(type);
    openModal('modal-notes-archive');
}

async function loadNotesArchiveList(type) {
    if (!supabaseClient || !currentUserId) return;
    const listEl = document.getElementById('notes-archive-modal-list');
    const { data } = await supabaseClient.from('my_center_tasks').select('*').eq('user_id', currentUserId).eq('task_type', type).eq('is_deleted', true).order('deleted_at', { ascending: false });
    listEl.innerHTML = '';
    if (!data || !data.length) {
        listEl.innerHTML = `<p class="today-tasks-empty">${t('notes_archive_empty_hint')}</p>`;
        return;
    }
    data.forEach(item => {
        const li = document.createElement('li');
        li.className = 'archive-item';
        const textSpan = document.createElement('span');
        textSpan.className = 'center-list-item-text';
        textSpan.textContent = item.content;
        const restoreBtn = document.createElement('button');
        restoreBtn.type = 'button';
        restoreBtn.className = 'btn-edit-item';
        restoreBtn.title = t('notes_archive_restore_btn');
        restoreBtn.textContent = '↩️';
        restoreBtn.onclick = () => restoreArchivedNote(item.id, type);
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-delete-item';
        deleteBtn.textContent = '❌';
        deleteBtn.onclick = () => permanentlyDeleteArchivedNote(item.id, type);
        li.appendChild(textSpan);
        li.appendChild(restoreBtn);
        li.appendChild(deleteBtn);
        listEl.appendChild(li);
    });
}

async function restoreArchivedNote(id, type) {
    await supabaseClient.from('my_center_tasks').update({ is_deleted: false, deleted_at: null }).eq('id', id);
    await loadNotesArchiveList(type);
    await refreshNotesArchiveCount(type);
    await loadCenterItems(type);
    showAppToast(t('notes_archive_restored'));
}

async function permanentlyDeleteArchivedNote(id, type) {
    await supabaseClient.from('my_center_tasks').delete().eq('id', id);
    await loadNotesArchiveList(type);
    await refreshNotesArchiveCount(type);
}

async function emptyNotesArchive(type) {
    if (!confirm(t('notes_archive_empty_confirm'))) return;
    await supabaseClient.from('my_center_tasks').delete().eq('user_id', currentUserId).eq('task_type', type).eq('is_deleted', true);
    await loadNotesArchiveList(type);
    await refreshNotesArchiveCount(type);
}

// --- הרגלים ורצף (streak): רשימת הרגלים אישיים, כל אחד עם סימון "בוצע
// היום" ורצף ימים רצופים. הרצף מחושב בצד הלקוח מתוך תאריכי הסימונים (לא
// עמודה נפרדת שצריך לתחזק) - כך שהוא תמיד עקבי עם הנתונים בפועל ---
function computeHabitStreak(dateSet, todayStr) {
    let streak = 0;
    const cursor = new Date(`${todayStr}T00:00:00`);
    // אם היום עצמו עוד לא סומן, לא "שוברים" את הרצף רק בגלל זה - מתחילים
    // לספור מאתמול; הרצף המוצג הוא "עד כמה ימים רצופים זה עדיין חי"
    if (!dateSet.has(getLocalDateString(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (dateSet.has(getLocalDateString(cursor))) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
}

async function loadHabits() {
    if (!supabaseClient || !currentUserId) return;
    const list = document.getElementById('habits-list');
    const emptyHint = document.getElementById('habits-empty-hint');
    if (!list) return;
    const [{ data: habits }, { data: checkins }] = await Promise.all([
        supabaseClient.from('habits').select('*').eq('user_id', currentUserId).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
        supabaseClient.from('habit_checkins').select('habit_id, checkin_date').eq('user_id', currentUserId),
    ]);
    list.innerHTML = '';
    if (!habits || !habits.length) {
        emptyHint.classList.remove('hidden');
        return;
    }
    emptyHint.classList.add('hidden');
    const todayStr = getLocalDateString();
    const checkinsByHabit = {};
    (checkins || []).forEach(c => {
        if (!checkinsByHabit[c.habit_id]) checkinsByHabit[c.habit_id] = new Set();
        checkinsByHabit[c.habit_id].add(c.checkin_date);
    });
    habits.forEach(habit => {
        const dates = checkinsByHabit[habit.id] || new Set();
        const streak = computeHabitStreak(dates, todayStr);
        const doneToday = dates.has(todayStr);

        const li = document.createElement('li');
        li.className = 'habit-item';
        const checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.className = 'btn-complete-item' + (doneToday ? ' checked' : '');
        checkBtn.textContent = doneToday ? '✓' : '';
        checkBtn.onclick = () => toggleHabitCheckin(habit.id, todayStr, !doneToday);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'center-list-item-text';
        nameSpan.textContent = habit.name;
        const streakBadge = document.createElement('span');
        streakBadge.className = 'habit-streak-badge';
        streakBadge.textContent = streak > 0 ? `🔥 ${streak}` : '–';
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-delete-item';
        deleteBtn.textContent = '❌';
        deleteBtn.onclick = () => deleteHabit(habit.id);

        li.appendChild(checkBtn);
        li.appendChild(nameSpan);
        li.appendChild(streakBadge);
        li.appendChild(deleteBtn);
        list.appendChild(li);
    });
}

function openAddHabitModal() {
    document.getElementById('habit-name-input').value = '';
    openModal('modal-add-habit');
}

async function addHabit() {
    const input = document.getElementById('habit-name-input');
    const name = input.value.trim();
    if (!name) { showAppToast(t('habits_missing_name'), 'error'); return; }
    await supabaseClient.from('habits').insert({ user_id: currentUserId, username: currentUsername, name });
    input.value = '';
    closeModal('modal-add-habit');
    await loadHabits();
}

async function deleteHabit(id) {
    await supabaseClient.from('habits').delete().eq('id', id);
    await loadHabits();
}

async function toggleHabitCheckin(habitId, dateStr, checked) {
    if (checked) {
        await supabaseClient.from('habit_checkins').insert({ habit_id: habitId, user_id: currentUserId, checkin_date: dateStr });
    } else {
        await supabaseClient.from('habit_checkins').delete().eq('habit_id', habitId).eq('checkin_date', dateStr);
    }
    await loadHabits();
}
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

// --- מד התקדמות שבועי: וי אמיתי לכל יום (לא רק מונה +/-), עם תאריך אמיתי
// מאחורי כל סימון (progress_checkins) - כדי שאפשר יהיה לחזור אחורה ולראות
// בדיוק אילו ימים סומנו בשבועות קודמים, אותו דפוס ניווט בדיוק כמו יעד חודשי ---
let viewedProgressWeekStart = null;

function getWeekStart(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setDate(date.getDate() - date.getDay()); // getDay(): 0=ראשון
    return getLocalDateString(date);
}

function currentWeekStart() { return getWeekStart(getLocalDateString()); }

function addDaysToDateStr(dateStr, days) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return getLocalDateString(new Date(y, m - 1, d + days));
}

function formatWeekRangeLabel(weekStartStr) {
    const [y, m, d] = weekStartStr.split('-').map(Number);
    const start = new Date(y, m - 1, d);
    const end = new Date(y, m - 1, d + 6);
    const opts = { day: 'numeric', month: 'short' };
    return `${start.toLocaleDateString(currentLang, opts)} - ${end.toLocaleDateString(currentLang, opts)}`;
}

function navigateProgressWeek(delta) {
    const base = viewedProgressWeekStart || currentWeekStart();
    const target = addDaysToDateStr(base, delta * 7);
    if (target > currentWeekStart()) return; // בלי לנווט לשבועות עתידיים
    viewedProgressWeekStart = target;
    loadProgressTargets();
}

async function loadProgressTargets() {
    if (!supabaseClient || !currentUserId) return;
    if (!viewedProgressWeekStart) viewedProgressWeekStart = currentWeekStart();
    const label = document.getElementById('progress-week-label');
    if (label) label.textContent = formatWeekRangeLabel(viewedProgressWeekStart);
    const isCurrentWeek = viewedProgressWeekStart === currentWeekStart();
    const nextBtn = document.getElementById('progress-week-next-btn');
    if (nextBtn) nextBtn.disabled = isCurrentWeek;

    const { data: targets } = await supabaseClient.from('weekly_progress_targets').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true });
    const container = document.getElementById('progress-container');
    if (!targets || !container) return;

    const weekEndExclusive = addDaysToDateStr(viewedProgressWeekStart, 7);
    const { data: checkins } = await supabaseClient.from('progress_checkins').select('target_id, check_date').eq('user_id', currentUserId).gte('check_date', viewedProgressWeekStart).lt('check_date', weekEndExclusive);
    const checkinsByTarget = {};
    (checkins || []).forEach(c => {
        if (!checkinsByTarget[c.target_id]) checkinsByTarget[c.target_id] = new Set();
        checkinsByTarget[c.target_id].add(c.check_date);
    });

    container.innerHTML = '';
    targets.forEach(item => {
        const checkedDates = checkinsByTarget[item.id] || new Set();
        const checkedCount = checkedDates.size;
        const pct = item.target_val > 0 ? Math.min(100, Math.round((checkedCount / item.target_val) * 100)) : 0;
        let daysHtml = '';
        for (let i = 0; i < 7; i++) {
            const dayDateStr = addDaysToDateStr(viewedProgressWeekStart, i);
            const isChecked = checkedDates.has(dayDateStr);
            const [dy, dm, dd] = dayDateStr.split('-').map(Number);
            const dayLabel = new Date(dy, dm - 1, dd).toLocaleDateString(currentLang, { weekday: 'narrow' });
            daysHtml += `<button type="button" class="progress-day-check${isChecked ? ' checked' : ''}" onclick="toggleProgressCheckin('${item.id}', '${dayDateStr}', ${!isChecked})" title="${dayDateStr}">${isChecked ? '✓' : dayLabel}</button>`;
        }
        const row = document.createElement('div');
        row.className = 'progress-row';
        row.innerHTML = `
            <div class="progress-info">
                <span>${item.target_name}</span>
                <div class="progress-counter">
                    <span>${checkedCount} / ${item.target_val}</span>
                    <button class="btn-delete-item" onclick="deleteProgressTarget('${item.id}')">❌</button>
                </div>
            </div>
            <div class="progress-days-row">${daysHtml}</div>
            <div class="progress-bar-bg"><div class="progress-bar-fill ${pct >= 100 ? 'completed' : ''}" style="width: ${pct}%;"></div></div>
        `;
        container.appendChild(row);
    });
}

async function toggleProgressCheckin(targetId, dateStr, shouldCheck) {
    if (!supabaseClient || !currentUserId) return;
    if (shouldCheck) {
        await supabaseClient.from('progress_checkins').insert({ user_id: currentUserId, username: currentUsername, target_id: targetId, check_date: dateStr });
    } else {
        await supabaseClient.from('progress_checkins').delete().eq('target_id', targetId).eq('check_date', dateStr).eq('user_id', currentUserId);
    }
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

// --- מעקב מים: הוספה מהירה (כוס/בקבוק/כמות מותאמת), סך יומי+שבועי, יעד
// יומי (מקומי בלבד - localStorage, כמו שעות ברירת מחדל ללוח הזמנים) עם
// פס התקדמות, והיסטוריית היום עם מחיקה - אותו דפוס בדיוק כמו ספורט/משקל ---
function waterDailyGoalKey() {
    return `weekwise_water_goal_${currentUserId}`;
}

function getWaterDailyGoal() {
    return parseInt(localStorage.getItem(waterDailyGoalKey())) || 2000;
}

function saveWaterDailyGoal() {
    const val = parseInt(document.getElementById('water-daily-goal-input').value) || 2000;
    localStorage.setItem(waterDailyGoalKey(), String(val));
    loadWaterData();
}

async function addWaterLog(amountMl) {
    if (!supabaseClient || !currentUserId) return;
    const today = getLocalDateString();
    const { error } = await supabaseClient.from('water_logs').insert({ username: currentUsername, user_id: currentUserId, amount_ml: amountMl, log_date: today });
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    showAppToast(t('water_add_success'));
    loadWaterData();
}

function addCustomWaterLog() {
    const input = document.getElementById('water-custom-amount-input');
    const amount = parseInt(input.value) || 0;
    if (amount <= 0) { showAppToast(t('water_missing_amount'), 'error'); return; }
    input.value = '';
    addWaterLog(amount);
}

// אותו רעיון בדיוק כמו addCustomWaterLog, רק מהחלון הקטן של הכפתור הצף
// (שדה קלט נפרד) - כדי שגם מהבועה יהיה אפשר לרשום כמות מדויקת, לא רק
// כוס/בקבוק קבועים מראש
function addCustomWaterLogFromFab() {
    const input = document.getElementById('water-quick-add-custom-input');
    const amount = parseInt(input.value) || 0;
    if (amount <= 0) { showAppToast(t('water_missing_amount'), 'error'); return; }
    input.value = '';
    closeModal('modal-water-quick-add');
    addWaterLog(amount);
}

async function deleteWaterLog(id) {
    await supabaseClient.from('water_logs').delete().eq('id', id);
    loadWaterData();
}

function toggleWaterHistory() {
    const list = document.getElementById('water-history-list');
    const chevron = document.getElementById('water-history-chevron');
    if (!list) return;
    const isHidden = list.classList.toggle('hidden');
    if (chevron) chevron.textContent = isHidden ? '▶' : '▼';
}

// קונפטי חד-פעמי ביום שמגיעים ליעד - מסומן ב-localStorage (לא DB, זו רק
// אינדיקציה UI חולפת) כדי שלא יופיע שוב ושוב בכל הוספה נוספת של מים אחרי
// שכבר חצו את היעד היום
function celebrateWaterGoalIfNeeded(todayTotal, goal, today) {
    if (goal <= 0 || todayTotal < goal) return;
    const key = `weekwise_water_celebrated_${today}`;
    if (localStorage.getItem(key) === 'true') return;
    localStorage.setItem(key, 'true');
    const container = document.getElementById('water-confetti-container');
    if (!container) return;
    container.classList.remove('hidden');
    setTimeout(() => container.classList.add('hidden'), 2500);
    showAppToast(t('water_goal_reached'));
}

async function loadWaterData() {
    if (!supabaseClient || !currentUserId) return;
    const goal = getWaterDailyGoal();
    const goalInput = document.getElementById('water-daily-goal-input');
    if (goalInput) goalInput.value = goal;

    const now = new Date();
    const sunday = new Date(now); sunday.setDate(now.getDate() - now.getDay());
    const weekStartStr = getLocalDateString(sunday);
    const today = getLocalDateString();

    const { data } = await supabaseClient.from('water_logs').select('*').eq('user_id', currentUserId).gte('log_date', weekStartStr).order('created_at', { ascending: false });
    const rows = data || [];

    const todayRows = rows.filter(r => r.log_date === today);
    const todayTotal = todayRows.reduce((sum, r) => sum + (r.amount_ml || 0), 0);
    const weeklyTotal = rows.reduce((sum, r) => sum + (r.amount_ml || 0), 0);

    const todayEl = document.getElementById('water-today-total');
    if (todayEl) todayEl.textContent = todayTotal.toLocaleString();
    const weeklyEl = document.getElementById('water-weekly-total');
    if (weeklyEl) weeklyEl.textContent = weeklyTotal.toLocaleString();

    const fill = document.getElementById('water-goal-progress-fill');
    if (fill) fill.style.width = `${goal > 0 ? Math.min(100, Math.round((todayTotal / goal) * 100)) : 0}%`;

    const list = document.getElementById('water-history-list');
    if (list) {
        list.innerHTML = '';
        if (!todayRows.length) {
            list.innerHTML = `<li class="finance-history-empty">${t('water_history_empty')}</li>`;
        } else {
            todayRows.forEach(row => {
                const li = document.createElement('li');
                li.className = 'finance-history-row';
                li.innerHTML = `
                    <div class="finance-history-main">
                        <span class="finance-history-category">${row.amount_ml} ${t('water_ml_unit')}</span>
                    </div>
                    <button type="button" class="btn-delete-slot" onclick="deleteWaterLog('${row.id}')">❌</button>
                `;
                list.appendChild(li);
            });
        }
    }

    celebrateWaterGoalIfNeeded(todayTotal, goal, today);
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
