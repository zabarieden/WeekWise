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

// אייקון עיפרון (SVG, לא אימוג'י) - כדי שיהיה ניתן לצבוע בסגול דרך currentColor;
// אימוג'י ✏️ מגיע עם צבע קבוע משלו ולא ניתן לצביעה ב-CSS (כמו שקרה עם ⭐)
const EDIT_ICON_SVG = '<svg class="btn-edit-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z"></path></svg>';

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
let currentUserCreatedAt = null;
let reminderIntervalStarted = false;
let dailyFocusMidnightCheckStarted = false;
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
    // הבאג השורשי (דווח חוזר: "האימון תמיד באמצע"): כל אחת מארבע הפונקציות
    // האלה קראה בעבר ל-restackFabs()/applyDockOrder() בעצמה - אז הקריאה
    // הראשונה (אחרי applyWaterFabSetting בלבד) רצה כשעדיין רק כפתור המים
    // עצמו קיבל את מצב ה-hidden הנכון שלו, ושלושת האחרים עדיין במצב ברירת
    // המחדל הגולמי של ה-HTML. applyDockOrder בונה את fabCarouselOrder
    // (ומשחזר את הבועה-הקדמית-השמורה לתוכו) בקריאה הראשונה הזו בלבד - כך
    // שהמערך שנבנה תמיד התבסס על מצב-נראות חלקי/שגוי, וכל קריאה נוספת רק
    // "מסדרת" אותו סביב הטעות הזו במקום לתקן אותה. עכשיו מיישמים את כל
    // הנראות קודם (skipRestack=true, בלי restack באמצע), ומסדרים את ה-Dock
    // פעם אחת בסוף כשכל ארבעת המצבים כבר נכונים
    applyWaterFabSetting(isWaterFabOn(), true);
    applySportFabSetting(isSportFabOn(), true);
    applyPresetFabSetting(isPresetFabOn(), true);
    applyFinanceFabSetting(isFinanceFabOn(), true);
    restackFabs();
    applyMealRowCounts();
    applyFinanceCycleSetting();
    // אתחול חד-פעמי של התצוגה בכל תפריטי-הבחירה המותאמים (custom-select) -
    // רשימות סטטיות (שלעולם לא מתמלאות מחדש דינמית) מקבלות כאן את הטקסט
    // הנכון (מתורגם, אחרי loadSavedLanguage למעלה) פעם אחת; רשימות דינמיות
    // (עדיין ריקות בשלב הזה, לפני התחברות/טעינת נתונים) פשוט מקבלות תצוגה
    // ריקה זמנית - ומתעדכנות נכון כשהפונקציה שממלאת אותן רצה בהמשך
    document.querySelectorAll('select').forEach(select => { if (select.id) updateCustomSelectDisplay(select.id); });
    initFabOrderDragReorder();
    initDockCarouselGestures();
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
    document.getElementById('btn-save-weight').addEventListener('click', saveNewWeightRecord);
    document.getElementById('btn-save-hours').addEventListener('click', saveDefaultHours);
    document.querySelectorAll('.calories-input, .protein-input').forEach(input => {
        input.addEventListener('input', updateLiveCaloriesToday);
    });
    // מסמנת שהשורה נערכה בפועל בסשן הזה (data-touched על ה-.meal-row) - ר'
    // saveNutrition, שמשתמשת בזה כדי לא לדרוס נתון קיים במסד עם שורה שנראית
    // ריקה רק כי היא מעולם לא נטענה, לא כי המשתמשת התכוונה לרוקן אותה
    document.querySelectorAll('.meal-row .food-input, .meal-row .calories-input, .meal-row .protein-input').forEach(input => {
        input.addEventListener('input', () => {
            const row = input.closest('.meal-row');
            if (row) row.dataset.touched = 'true';
        });
    });
    // לוכדים את הערך *לפני* עריכה (focus) כדי שנוכל להשוות מול הערך אחרי
    // (onchange) - ר' autoFillMealCalories, שמזהה "הוספת מספר לפני טקסט
    // קיים" ו"הוספת תוכן בסוף" כמקרים מיוחדים במקום להריץ את המנוע הכללי
    // מחדש על כל הטקסט המאוחד (לא אמין לזה - ר' ההערה שם)
    document.querySelectorAll('.meal-row .food-input').forEach(input => {
        input.addEventListener('focus', () => { input.dataset.valueBeforeEdit = input.value.trim(); });
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

// עמודי המשפטי (תנאי שימוש/מדיניות פרטיות/הצהרת נגישות) קיימים רק בעברית,
// אנגלית וספרדית (לא ב-33 השפות - מסמכים משפטיים ארוכים, לא שווה לתרגם
// לכולן) - עברית לעברית, ספרדית לספרדית, וכל שפה אחרת נופלת לאנגלית
function updateLegalLinksForLanguage() {
    const suffix = currentLang === 'he' ? '' : (currentLang === 'es' ? '-es' : '-en');
    document.querySelectorAll('.legal-link-terms').forEach(a => a.href = `terms${suffix}.html`);
    document.querySelectorAll('.legal-link-privacy').forEach(a => a.href = `privacy${suffix}.html`);
    document.querySelectorAll('.legal-link-accessibility').forEach(a => a.href = `accessibility${suffix}.html`);
}

function onLanguageChanged() {
    updateLanguagePickerTriggers();
    updateLegalLinksForLanguage();
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

// מאגר המשפטים המתחלפים מ-7 פתיחות ואילך (ר' loadTodayTasks) - כל הכתיבה
// אימפרסונלית/גוף שני ניטרלי-מגדרית בכוונה (שם פועל, "אפשר", "צריך" וכו'
// - לא נטיית פועל בגוף שני נקבה/זכר), לפי בקשה מפורשת
const TODAY_TASKS_ROTATING_MESSAGE_KEYS = [
    'today_tasks_rotate_1', 'today_tasks_rotate_2', 'today_tasks_rotate_3', 'today_tasks_rotate_4',
    'today_tasks_rotate_5', 'today_tasks_rotate_6', 'today_tasks_rotate_7',
];

// סף-סבירות למנה/פריט בודד - לא חוסם שמירה, רק מסמן ויזואלית + טוסט חד-פעמי
// בכניסה למצב-אזהרה. נועד לתפוס בדיוק את סוג התקלה שהתגלתה בפועל (פירוט-
// מרכיבים שהתפרש לא נכון וניפח מספר בודד ל-23,200+ קלוריות) - לפי בקשה מפורשת
const IMPLAUSIBLE_SINGLE_MEAL_CALORIES = 2000;

// מסמנת ויזואלית (מסגרת אדומה) שדה-קלוריות שחרג מהסף, ומציגה טוסט אזהרה *רק*
// ברגע המעבר למצב-אזהרה (לא בכל קריאה חוזרת - updateLiveCaloriesToday רצה על
// כל הקשה) כדי לא להציף בטוסטים חוזרים על אותה שורה
function flagImplausibleCalories(input, calories) {
    const isImplausible = calories > IMPLAUSIBLE_SINGLE_MEAL_CALORIES;
    const wasImplausible = input.classList.contains('calories-implausible');
    input.classList.toggle('calories-implausible', isImplausible);
    input.title = isImplausible ? t('calories_implausible_tooltip').replace('{calories}', calories) : '';
    if (isImplausible && !wasImplausible) {
        showAppToast(t('calories_implausible_toast').replace('{calories}', calories), 'error');
    }
}

function updateLiveCaloriesToday() {
    let total = 0;
    document.querySelectorAll('.calories-input').forEach(input => {
        const calories = parseInt(input.value) || 0;
        total += calories;
        flagImplausibleCalories(input, calories);
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
    // הרשימה; בתוך כל קבוצה - sort_order ידני (שנקבע ע"י גרירה בפתקים) קודם;
    // פריטים בלי אחד עדיין (חדשים/מלפני התכונה) נופלים אחריהם, ממויינים לפי
    // created_at יורד כדי שמשימה חדשה שנרשמת תופיע ראשונה בתוך הקבוצה הזו -
    // לפי בקשה מפורשת ("שכל משימה שאני רושמת תבוא ראשונה")
    const { data, error } = await supabaseClient.from('my_center_tasks').select('*').eq('user_id', currentUserId).eq('task_type', type).eq('is_deleted', false).order('is_someday', { ascending: true }).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: false });
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
        if (item.text_color) li.setAttribute('data-text-color', item.text_color);
        if (item.glow_color) li.setAttribute('data-glow-color', item.glow_color);
        if (item.bg_color) li.setAttribute('data-bg-color', item.bg_color);
        // רקע על ה-li כולו (עמעום 18% דרך hexToRgba כדי שהטקסט/הכפתורים
        // יישארו קריאים) - אבל הזוהר על הטקסט עצמו (text-shadow), לא box-
        // shadow על כל השורה, לפי בקשה מפורשת ("הזוהר תחבר לטקסט")
        if (item.bg_color) li.setAttribute('style', `background-color: ${hexToRgba(item.bg_color, 0.18)}`);
        // ידית גרירה רק לפתקים (weekly) - רשימת הקניות אין לה יעדי גרירה משלה,
        // לפי בקשה מפורשת (רק פתקים נגררים - כולל אל "רשימת קניות" כיעד)
        const dragHandle = type === 'weekly' ? `<span class="note-drag-handle">⠿</span>` : '';
        const textStyleParts = [];
        if (item.text_color) textStyleParts.push(`color: ${item.text_color}`);
        if (item.glow_color) textStyleParts.push(`text-shadow: 0 0 4px ${item.glow_color}, 0 0 10px ${item.glow_color}, 0 0 18px ${item.glow_color}`);
        const colorStyle = textStyleParts.length ? ` style="${textStyleParts.join('; ')};"` : '';
        li.innerHTML = `
            ${dragHandle}
            <button class="btn-complete-item${item.is_completed ? ' checked' : ''}" onclick="toggleTaskStatus('${item.id}', ${item.is_completed}, '${type}')">
                ${item.is_completed ? '✓' : ''}
            </button>
            <span class="center-list-item-text${item.is_completed ? ' completed' : ''}"${colorStyle}>
                ${escapeHtmlForReport(item.content)}
            </span>
            <button class="btn-edit-item" onclick="openCenterItemEditor(this, '${type}')" title="${t('edit_btn')}">${EDIT_ICON_SVG}</button>
            <button class="btn-delete-item" onclick="deleteCenterItem('${item.id}', '${type}')">❌</button>
        `;
        listUl.appendChild(li);
    });
    if (type === 'weekly' && !dividerInserted) listUl.appendChild(buildNoteSomedayDivider());
    initNoteTriageDragDrop(type);
    refreshNotesArchiveCount(type);
}

// מתקפל, מכווץ כברירת מחדל (לא פתוח) - לפי בקשה מפורשת. כל הפתקים
// שאחריו מוסתרים לגמרי (display:none, לא רק דהויים) כל עוד אין קלאס
// expanded על ה-li של המפריד עצמו - נשלט לגמרי ב-CSS (ר' .center-list-
// divider:not(.expanded) ~ li) כדי שלא צריך לגעת בכל פתק בנפרד ב-JS
function buildNoteSomedayDivider() {
    const li = document.createElement('li');
    li.className = 'center-list-divider';
    li.onclick = () => li.classList.toggle('expanded');
    const label = document.createElement('span');
    label.className = 'center-list-divider-label';
    label.textContent = t('note_someday_section_label');
    const chevron = document.createElement('span');
    chevron.className = 'center-list-divider-chevron';
    chevron.textContent = '›';
    li.appendChild(label);
    li.appendChild(chevron);
    return li;
}

// --- גרירת פתק אל "היום"/"מחר"/"תאריך אחר": כל השלושה הופכים אותו למשימה
// מתוזמנת אמיתית (calendar_events), אותה טבלה בדיוק שכבר מזינה את "מבט
// ליומן", "משימות להיום" ולוח החודש - אז זה "נכנס ללו"ז החודשי" אוטומטית
// בלי שום קוד נוסף באותם מסכים. "תאריך אחר" פותח מודל בחירת תאריך במקום
// לפעול מיד (ר' handleNoteTriageDrop/confirmNoteTriageOtherDate למטה) -
// יעד "לרשימת קניות" הוסר מכאן (פתק מהיר כבר מכסה הוספה ישירה לרשימת
// קניות). בכל המקרים הפתק המקורי נמחק (לא מועתק). רלוונטי רק לכרטיס
// הפתקים (type='weekly') - לרשימת קניות עצמה אין יעדי גרירה משלה ---
const noteTriageInitialized = {};
function initNoteTriageDragDrop(type) {
    if (noteTriageInitialized[type] || typeof Sortable === 'undefined') return;
    const list = document.getElementById(`${type}-list`);
    const todayZone = document.getElementById(`note-triage-today-${type}`);
    const tomorrowZone = document.getElementById(`note-triage-tomorrow-${type}`);
    const otherDateZone = document.getElementById(`note-triage-otherdate-${type}`);
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
    if (otherDateZone) zones.push(otherDateZone);
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

// גרירה לאזור "תאריך אחר" לא יכולה לבצע מיד (בניגוד להיום/מחר) - צריך קודם
// לבחור תאריך במודל נפרד. השורה כבר הוסרה חזותית מה-DOM ע"י Sortable
// (onAdd) לפני שהגענו לכאן, אבל עדיין קיימת ב-DB עד לאישור בפועל - אם
// מבטלים, מרעננים את הרשימה כדי שהפתק "יחזור" למקומו (ר' cancelNoteTriageOtherDate)
let pendingNoteOtherDate = null;

async function handleNoteTriageDrop(itemId, triageType, content, type) {
    if (!supabaseClient || !currentUserId || !content) return;

    if (triageType === 'otherdate') {
        pendingNoteOtherDate = { itemId, content, type };
        const dateInput = document.getElementById('note-triage-otherdate-input');
        if (dateInput) { dateInput.value = getLocalDateString(); updateDateFieldDisplay('note-triage-otherdate-input'); }
        openModal('modal-note-triage-otherdate');
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

async function confirmNoteTriageOtherDate() {
    if (!pendingNoteOtherDate || !supabaseClient || !currentUserId) return;
    const dateInput = document.getElementById('note-triage-otherdate-input');
    const targetDate = dateInput ? dateInput.value : '';
    if (!targetDate) { showAppToast(t('note_triage_otherdate_missing'), 'error'); return; }
    const { itemId, content, type } = pendingNoteOtherDate;
    await supabaseClient.from('calendar_events').insert({ username: currentUsername, user_id: currentUserId, event_title: content, event_date: targetDate, source: 'note_task' });
    await supabaseClient.from('my_center_tasks').delete().eq('id', itemId);
    pendingNoteOtherDate = null;
    closeModal('modal-note-triage-otherdate');
    loadCenterItems(type);
    loadTodayTasks();
    loadMonthlyCalendarGrid();
    loadCalendarEvents();
    showAppToast(t('note_triage_success_otherdate'));
}

function cancelNoteTriageOtherDate() {
    const type = pendingNoteOtherDate ? pendingNoteOtherDate.type : 'weekly';
    pendingNoteOtherDate = null;
    closeModal('modal-note-triage-otherdate');
    // הפתק הוסר חזותית מה-DOM כשנגרר (ר' ההערה למעלה) בלי שנמחק בפועל -
    // מרעננים מה-DB כדי שהוא "יחזור" למקום, כאילו הגרירה מעולם לא קרתה
    loadCenterItems(type);
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
    updateCustomSelectDisplay('new-preset-category');
    document.getElementById('btn-add-preset').textContent = t('preset_update_btn');
}

function cancelPresetEdit() {
    editingPresetId = null;
    document.getElementById('new-preset-name').value = '';
    document.getElementById('new-preset-calories').value = '';
    document.getElementById('new-preset-description').value = '';
    document.getElementById('btn-add-preset').textContent = t('preset_add_btn');
}

// הערכת קלוריות עם AI בטופס "הוספת ארוחה למאגר" - אותה בדיוק לוגיקה כמו
// הוספה-מהירה-עם-AI (estimateFoodTextViaAI, פרימיום עם חיפוש אמיתי / נופל
// להערכה המקומית) - רק על שם+מרכיבים במקום תיאור-ארוחה חופשי, לפי בקשה
// מפורשת ("גם פה שיהיה AI")
async function estimatePresetCaloriesWithAI() {
    const nameInput = document.getElementById('new-preset-name');
    const descInput = document.getElementById('new-preset-description');
    const caloriesInput = document.getElementById('new-preset-calories');
    const text = [nameInput.value.trim(), descInput.value.trim()].filter(Boolean).join(', ');
    if (!text) { showAppToast(t('quick_add_missing_text'), 'error'); return; }
    const btn = document.getElementById('btn-estimate-preset-calories');
    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = t('food_ai_estimating');
    try {
        let estimate = estimateFreeTextCalories(text);
        if (isPremiumUser && supabaseClient) {
            const { data: sessionData } = await supabaseClient.auth.getSession();
            const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
            if (token) {
                let attempt = await estimateFoodTextViaAI(token, text);
                if (attempt.status === 'retry') attempt = await estimateFoodTextViaAI(token, text);
                if (attempt.status === 'estimate' && attempt.calories > 0) estimate = attempt.calories;
            }
        }
        if (estimate > 0) caloriesInput.value = Math.round(estimate);
        else showAppToast(t('quick_add_cant_estimate'), 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
    }
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
const PRESET_CATEGORY_ORDER = ['morning', 'noon', 'evening', 'snack', 'drinks'];

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
                    <button class="btn-edit-item" onclick="editPreset('${item.id}')">${EDIT_ICON_SVG}</button>
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

// אם בשורה כבר יש תוכן, בוחרים ארוחה קבועה נוספת *מוסיפים* אליה (טקסט
// מחובר ב-"+", קלוריות מצטברות) במקום לדרוס אותה - לפי בקשה מפורשת
// ("כשאני בוחרת עוד ארוחה... שיוסיף אותה ליד... אם אני ארצה אני אמחק ידנית").
// אותו רעיון בדיוק כמו המיזוג בהוספה המהירה (addQuickLogEntry)
function selectPresetPickerItem(id) {
    const preset = cachedPresets.find(p => p.id === id);
    if (!preset || !presetPickerTargetRow) return;
    const foodInput = presetPickerTargetRow.querySelector('.food-input');
    const caloriesInput = presetPickerTargetRow.querySelector('.calories-input');
    const existingFood = foodInput.value.trim();
    const existingCalories = parseInt(caloriesInput.value) || 0;
    foodInput.value = existingFood ? `${existingFood} + ${preset.food_name}` : preset.food_name;
    caloriesInput.value = existingCalories + (parseInt(preset.calories) || 0);
    presetPickerTargetRow.dataset.touched = 'true';
    updateLiveCaloriesToday();
    closeModal('modal-preset-picker');
}

// --- הוספה מהירה (מהכפתורים הצפים): ארוחה קבועה שמורה, או מזון בטקסט חופשי -
// שתיהן נכנסות ישירות למשבצת הפנויה הבאה של calorie_tracker להיום, בלי לעבור
// דרך מסך התזונה בכלל. סדר קבוע (לא כרונולוגי) כדי שהתוצאה תמיד עקבית ---
// meal_4/snack הם שמות-מפתח היסטוריים ("ארוחה 4"/"נשנוש") שכבר קיימים
// בנתונים שמורים אצל משתמשות - לא ניתן לשנות אותם בלי "לאבד" נתונים קיימים,
// אז המשבצות החדשות (meal_extra1/2, snack_extra1/2/3) מקבלות מפתחות חדשים
// שלא מתנגשים, גם אם המספור הפנימי כבר לא תואם 1:1 לתווית המוצגת - ר'
// MEAL_SLOT_KEYS/SNACK_SLOT_KEYS למטה (בהם סדר התפקיד/ordinal אכן תואם)
const MEAL_TYPE_ORDER = ['meal_1', 'meal_2', 'meal_3', 'meal_extra1', 'meal_extra2', 'meal_4', 'snack', 'snack_extra1', 'snack_extra2', 'snack_extra3'];
const MEAL_TYPE_LABEL_KEYS = { meal_1: 'meal_label_1', meal_2: 'meal_label_2', meal_3: 'meal_label_3', meal_extra1: 'meal_label_meal_4', meal_extra2: 'meal_label_meal_5', meal_4: 'meal_label_4', snack: 'meal_label_snack', snack_extra1: 'meal_label_snack_3', snack_extra2: 'meal_label_snack_4', snack_extra3: 'meal_label_snack_5' };
// סדר-תפקיד (לא מפתח ה-DB!) - משבצת ראשונה/שנייה/... מכל סוג, בשימוש
// לתרגום "כמה ארוחות/נשנושים להציג" (ר' getMealCount/getSnackCount/
// applyMealRowCounts) להצג/הסתר בפועל. עד 5 מכל סוג, לפי בקשה מפורשת
const MEAL_SLOT_KEYS = ['meal_1', 'meal_2', 'meal_3', 'meal_extra1', 'meal_extra2'];
const SNACK_SLOT_KEYS = ['meal_4', 'snack', 'snack_extra1', 'snack_extra2', 'snack_extra3'];

// כמה משבצות ארוחה/נשנוש להציג בפועל - נשמר בנפרד (לא רק "מוסתר/מוצג" per
// slot כמו הבועות הצפות) כי כאן זה תמיד "ה-N הראשונות בסדר קבוע", לא בחירה
// חופשית איזה משבצת ספציפית. ברירת מחדל: 4 ארוחות, 4 נשנושים (לפי בקשה
// מפורשת, במקום 3/3 הקודם) - clamp 1-5 מגן מפני ערך פגום ב-localStorage
function getMealCount() {
    const n = parseInt(localStorage.getItem('weekwise_meal_count'));
    return n >= 1 && n <= MEAL_SLOT_KEYS.length ? n : 4;
}
function getSnackCount() {
    const n = parseInt(localStorage.getItem('weekwise_snack_count'));
    return n >= 1 && n <= SNACK_SLOT_KEYS.length ? n : 4;
}
// מחזירה את סדר-המפתחות של המשבצות *הנראות בלבד* לפי ההגדרות - ר'
// getTodayEmptyMealSlot למטה, שמשתמשת בזה כדי לא "לכתוב" נתונים למשבצת
// שהמשתמשת בחרה להסתיר (הם היו נעלמים לה בלי שום סימן שמשהו נרשם)
function getVisibleMealTypeOrder() {
    return [...MEAL_SLOT_KEYS.slice(0, getMealCount()), ...SNACK_SLOT_KEYS.slice(0, getSnackCount())];
}
function applyMealRowCounts() {
    const mealCount = getMealCount();
    const snackCount = getSnackCount();
    MEAL_SLOT_KEYS.forEach((key, i) => {
        const row = document.querySelector(`.meal-row[data-meal="${key}"]`);
        if (row) row.classList.toggle('hidden', i >= mealCount);
    });
    SNACK_SLOT_KEYS.forEach((key, i) => {
        const row = document.querySelector(`.meal-row[data-meal="${key}"]`);
        if (row) row.classList.toggle('hidden', i >= snackCount);
    });
    const mealSelect = document.getElementById('meal-count-select');
    if (mealSelect) mealSelect.value = String(mealCount);
    const snackSelect = document.getElementById('snack-count-select');
    if (snackSelect) snackSelect.value = String(snackCount);
}
function setMealCount(count) {
    localStorage.setItem('weekwise_meal_count', String(count));
    applyMealRowCounts();
}
function setSnackCount(count) {
    localStorage.setItem('weekwise_snack_count', String(count));
    applyMealRowCounts();
}

// preferredSlotKeys (MEAL_SLOT_KEYS/SNACK_SLOT_KEYS, אופציונלי) - כשידוע
// שהתוספת שייכת למאכל/נשנוש (לפי הקטגוריה של הפריסט), מחפשים קודם משבצת
// ריקה *מאותה קבוצה* לפני שנופלים לכל משבצת ריקה אחרת - כדי ש"אורז וחזה
// עוף" (פריסט של ארוחה) לא ינחת בטעות בשורת נשנוש רק כי היא נמצאת קודם
// בסדר-התצוגה הכללי (הלגאסי) של החמש שורות המקוריות
async function getTodayEmptyMealSlot(preferredSlotKeys) {
    const today = getLocalDateString();
    const { data } = await supabaseClient.from('calorie_tracker').select('meal_type').eq('user_id', currentUserId).eq('date', today);
    const used = new Set((data || []).map(r => r.meal_type));
    const visible = getVisibleMealTypeOrder();
    if (preferredSlotKeys) {
        const preferredEmpty = visible.find(mt => preferredSlotKeys.includes(mt) && !used.has(mt));
        if (preferredEmpty) return preferredEmpty;
    }
    return visible.find(mt => !used.has(mt)) || null;
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

// כל המשבצות ה*נראות* (ר' getVisibleMealTypeOrder) הן "משבצת אחת = שורה
// אחת" בכל שאר האפליקציה (ר' loadMealForm - כשעורכים משבצת קיימת דרך מסך
// התזונה, זה מעדכן את השורה הקיימת, לא מוסיף שורה נוספת). כשכולן תפוסות,
// אין אפשרות ליצור משבצת נוספת - אז במקום לחסום עם שגיאה (שהייתה כאן קודם),
// מצרפים את התוספת למשבצת-הנשנוש *הנראית האחרונה* (מחברים קלוריות + מוסיפים
// לתיאור) כדי שתמיד תהיה אפשרות להוסיף עוד. לא 'snack' קבוע יותר - תלוי
// כמה נשנושים המשתמשת בחרה להציג (ר' getSnackCount)
async function addQuickLogEntry(foodDescription, calories, presetCategory) {
    const today = getLocalDateString();
    const preferredSlotKeys = presetCategory ? (presetCategory === 'snack' ? SNACK_SLOT_KEYS : MEAL_SLOT_KEYS) : null;
    const slot = await getTodayEmptyMealSlot(preferredSlotKeys);
    if (slot) {
        await supabaseClient.from('calorie_tracker').insert({
            username: currentUsername, user_id: currentUserId, date: today, meal_type: slot,
            food_description: foodDescription, calories: calories, protein_grams: null,
        });
        return;
    }
    const mergeSlot = SNACK_SLOT_KEYS[getSnackCount() - 1];
    const { data: existing } = await supabaseClient.from('calorie_tracker').select('id, food_description, calories').eq('user_id', currentUserId).eq('date', today).eq('meal_type', mergeSlot).maybeSingle();
    if (existing) {
        await supabaseClient.from('calorie_tracker').update({
            food_description: `${existing.food_description} + ${foodDescription}`,
            calories: (existing.calories || 0) + calories,
        }).eq('id', existing.id);
    } else {
        await supabaseClient.from('calorie_tracker').insert({
            username: currentUsername, user_id: currentUserId, date: today, meal_type: mergeSlot,
            food_description: foodDescription, calories: calories, protein_grams: null,
        });
    }
}

async function logPresetQuickAdd(id) {
    const preset = cachedPresets.find(p => p.id === id);
    if (!preset) return;
    await addQuickLogEntry(preset.food_name, preset.calories, preset.meal_category);
    closeModal('modal-preset-quick-add');
    if (preset.calories > IMPLAUSIBLE_SINGLE_MEAL_CALORIES) {
        showAppToast(t('calories_implausible_toast').replace('{calories}', preset.calories), 'error');
    } else {
        showAppToast(`${t('quick_add_logged_toast')} ${preset.food_name} (${preset.calories} ${t('calories_unit')})`);
    }
    refreshTodayNutritionViewIfOpen();
}

// עברה מלהיות מודל עצמאי משלה לטאב ראשון בתוך מוח ה-AI (modal-ai-brain) -
// לפי בקשה מפורשת ("כפתור ההוספה המהירה של האוכל שיהיה הראשון בתוך ה-AI").
// כותרת המודל עצמו קבועה עכשיו ("✨ AI Assistant ✨") ולא מתחלפת יותר לפי
// סטטוס פרימיום (כפי שהיה למודל העצמאי הקודם) - הטאב עצמו כבר נמצא בתוך
// מוקד ה-AI, כך שאין צורך יותר להבחין ויזואלית בין "מזון רגיל" ל"מזון AI".
// ניקוי השדה מתבצע כבר בתוך openAiBrainModal עצמה
function openFoodQuickAddModal() {
    openAiBrainModal('food');
}

// שומרים את הטקסט המקורי + שאלת ההבהרה בזמן שממתינים לתשובת המשתמשת (פרימיום
// בלבד) - כדי לשלוח קריאת המשך ל-AI עם טקסט+שאלה+תשובה יחד, ר' confirmFoodClarify
let pendingFoodQuickAddText = '';
let pendingFoodClarifyQuestion = '';
// true כששאלת ההבהרה זוהתה מקומית (detectAmbiguousPlantMilk) ולא נשאלה ע"י
// ה-AI - צריך להעביר את זה לשרת כדי שהוא ידע שזו עדיין הקריאה הראשונה
// המחויבת במכסה (לא "קריאת המשך חינמית" אחרי שה-AI כבר שאל וכבר חויב)
let pendingFoodClarifyIsLocal = false;

// זיהוי דטרמיניסטי (לא תלוי בשיקול הדעת של ה-AI!) של המקרה שגרם לחוסר-דיוק
// חוזר: משקה (קפה/שייק) + מרכיב שיכול להיות גם "חלב" צמחי וגם מזון מוצק
// (שיבולת שועל/שקדים/סויה), בלי שהמשתמשת כבר פירטה איזה מהשניים. גילינו
// בפועל שההנחיה "תמיד תשאל" ל-AI לא נאכפת ב-100% מהמקרים (זו מגבלה אמיתית
// של מודלי שפה - הנחיה בטקסט היא לא אכיפה מובטחת כמו קוד) - אז כדי להבטיח
// שהשאלה **תמיד** תישאל במקרה הזה הספציפי, הבדיקה עצמה זזה מהפרומפט לקוד:
// אם הביטוי מזוהה, פותחים את חלון ההבהרה ישירות בלי לפנות ל-AI בכלל בשלב
// הזה - ורק אחרי שיש תשובה, פונים ל-AI (מוגבל לתשובה סופית בלבד, לא עוד שאלה)
const FOOD_CLARIFY_DRINK_RE = /(קפה|שייק|smoothie|\bcoffee\b)/i;
const FOOD_CLARIFY_PLANT_MILK_RE = /(שיבולת שועל|שקדים|סויה|קוקוס|\boats?\b|\balmonds?\b|\bsoy\b|\bcoconut\b)/i;
const FOOD_CLARIFY_EXPLICIT_MILK_RE = /(חלב\s*(שיבולת שועל|שקדים|סויה|קוקוס)|oat.?milk|almond.?milk|soy.?milk|coconut.?milk)/i;
const FOOD_CLARIFY_EXPLICIT_SOLID_RE = /(קערת|קערה של|מנה נפרדת|כמזון נפרד|bowl of|separately|as a side)/i;

function detectAmbiguousPlantMilk(text) {
    if (!FOOD_CLARIFY_DRINK_RE.test(text)) return null;
    if (FOOD_CLARIFY_EXPLICIT_MILK_RE.test(text) || FOOD_CLARIFY_EXPLICIT_SOLID_RE.test(text)) return null;
    const m = text.match(FOOD_CLARIFY_PLANT_MILK_RE);
    return m ? m[0] : null;
}

// חינמי: מיד לחישוב המקומי החינמי, בדיוק כמו קודם, בלי שום שינוי התנהגות.
// פרימיום: קריאה אמיתית ל-AI (יכולה לשאול שאלת הבהרה אחת) - ר' logFoodQuickAddViaAI
async function logFoodQuickAdd() {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const input = document.getElementById('food-quick-add-input');
    const text = input ? input.value.trim() : '';
    if (!text) { showAppToast(t('quick_add_missing_text'), 'error'); return; }

    if (isPremiumUser) {
        await logFoodQuickAddViaAI(text);
        return;
    }
    await finishFoodQuickAdd(text, estimateFreeTextCalories(text));
}

// נופלת חזרה בשקט לחישוב המקומי החינמי בכל מקרה של תקלה/מכסה חודשית שנגמרה -
// משתמשת פרימיום לעולם לא אמורה "להיתקע" בלי אפשרות לרשום בכלל
async function logFoodQuickAddViaAI(text) {
    // בדיקה דטרמיניסטית לפני שפונים ל-AI בכלל - ר' הערה על detectAmbiguousPlantMilk
    const ambiguousIngredient = detectAmbiguousPlantMilk(text);
    if (ambiguousIngredient) {
        pendingFoodQuickAddText = text;
        pendingFoodClarifyIsLocal = true;
        pendingFoodClarifyQuestion = t('food_clarify_milk_question').replace('{ingredient}', ambiguousIngredient);
        openFoodClarifyModal(pendingFoodClarifyQuestion);
        return;
    }

    setFoodQuickAddLoading(true);
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) { await finishFoodQuickAdd(text, estimateFreeTextCalories(text)); return; }

        let attempt = await estimateFoodTextViaAI(token, text);
        // רק 'retry' (תקלת רשת/פרסור) מנסה שוב - 'timeout' לא, כדי לא להכפיל
        // את ההמתנה המקסימלית לדקתיים, ר' ההערה על estimateFoodTextViaAI
        if (attempt.status === 'retry') attempt = await estimateFoodTextViaAI(token, text);

        if (attempt.status === 'limit') {
            showAppToast(t('quick_add_ai_limit_toast'), 'error');
            await finishFoodQuickAdd(text, estimateFreeTextCalories(text));
            return;
        }
        if (attempt.status === 'clarify') {
            pendingFoodQuickAddText = text;
            pendingFoodClarifyQuestion = attempt.question;
            pendingFoodClarifyIsLocal = false;
            openFoodClarifyModal(attempt.question);
            return;
        }
        if (attempt.status === 'estimate') {
            await finishFoodQuickAdd(text, attempt.calories);
            return;
        }
        // status "unknown" - ה-AI עצמו אמר בפירוש שהוא לא מזהה את הפריט, לפי
        // בקשה מפורשת ("אם הוא לא מכיר משהו שיגיד"). עדיין נופלים להערכה
        // המקומית (לא משאירים בלי לרשום כלום), רק עם הודעה כנה שהמערכת לא
        // הייתה בטוחה - כדי שהמשתמשת תדע לבדוק/לנסח אחרת אם היא רוצה דיוק
        if (attempt.status === 'unknown') {
            showAppToast(t('food_ai_unknown_toast'), 'error');
            await finishFoodQuickAdd(text, estimateFreeTextCalories(text));
            return;
        }
        // 'premium_required'/'retry' שני פעמים - נופלים לחישוב המקומי. בעבר בלי
        // שום הודעה ("בלי הודעת שגיאה מפחידה"), אבל זה גרם למשתמשת פרימיום
        // לחשוב שקיבלה הערכת AI מדויקת בזמן שבפועל קיבלה את החישוב המקומי הגס
        // (מבוסס-מאגר, בלי הבנת אופן הכנה) בלי שום דרך לדעת את זה - לפי דיווח
        // מפורש על פער של כ-100 קלוריות מול הערכה חיצונית לאותה ארוחה בדיוק
        showAppToast(t('food_ai_fallback_toast'), 'error');
        await finishFoodQuickAdd(text, estimateFreeTextCalories(text));
    } finally {
        setFoodQuickAddLoading(false);
    }
}

// תקרת זמן קשיחה - לפי בקשה מפורשת ("לא רוצה שיחשוב יותר מדקה"). עכשיו
// שיש web_search זה יכול לפעמים לקחת הרבה זמן (כמה סבבי חיפוש ברצף) בלי
// שום תקרה קודם. AbortController מבטל את הבקשה בפועל (לא רק מפסיק לחכות
// לה בצד שלנו) כדי לא להשאיר קריאה תקועה ברקע
const FOOD_AI_TIMEOUT_MS = 60000;

// status: 'timeout' נבדל בכוונה מ-'retry' הרגיל - קריאה שנעצרה כי לקח לה
// יותר מדי זמן לא אמורה "לנסות שוב" עם עוד דקה שלמה (זה יכפיל את ההמתנה
// המקסימלית לשתי דקות בפועל, בדיוק ההפך ממה שהתבקש) - היא צריכה לרדת ישר
// לחישוב המקומי, ר' logFoodQuickAddViaAI/confirmFoodClarify
async function estimateFoodTextViaAI(token, text, clarificationQuestion, clarificationAnswer, isLocalClarify) {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), FOOD_AI_TIMEOUT_MS);
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/estimate-food-text`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text, clarificationQuestion, clarificationAnswer, isLocalClarify, language: currentLang, country: getUserCountry() }),
            signal: controller.signal
        });
        const result = await res.json();
        if (result.error === 'limit_reached') return { status: 'limit' };
        if (res.status === 402 || result.error === 'premium_required') return { status: 'premium_required' };
        if (res.ok && result.status === 'clarify' && result.question) return { status: 'clarify', question: result.question };
        if (res.ok && result.status === 'estimate' && typeof result.calories === 'number') return { status: 'estimate', calories: result.calories };
        if (res.ok && result.status === 'unknown') return { status: 'unknown' };
        return { status: 'retry' };
    } catch (err) {
        return { status: err && err.name === 'AbortError' ? 'timeout' : 'retry' };
    } finally {
        clearTimeout(timeoutTimer);
    }
}

// מכבה/מדליקה את כפתור "הוספה" בזמן קריאת ה-AI (יש כעת השהיית רשת אמיתית,
// בניגוד לחישוב המקומי המיידי) - שומר את הטקסט המקורי שלו כדי לשחזר אחרי.
// בנוסף (חדש): חיווי-טעינה נפרד עם עיגולים קופצים (food-quick-add-loading),
// מתעכב 5 שניות במקום מיידי - אותו דפוס בדיוק כמו schedule-ai-loading -
// כדי שהמתנה ארוכה (חיפוש ברשת יכול לקחת זמן) תיראה ברור כ"עוד עובד" ולא
// כאילו זה נתקע, לפי בקשה מפורשת
let foodQuickAddLoadingTimer = null;
function setFoodQuickAddLoading(isLoading) {
    const btn = document.getElementById('btn-food-quick-add-submit');
    if (btn) {
        if (isLoading) {
            btn.dataset.originalText = btn.textContent;
            btn.textContent = t('food_ai_estimating');
        } else if (btn.dataset.originalText) {
            btn.textContent = btn.dataset.originalText;
        }
        btn.disabled = isLoading;
    }
    const loadingEl = document.getElementById('food-quick-add-loading');
    clearTimeout(foodQuickAddLoadingTimer);
    if (isLoading) {
        foodQuickAddLoadingTimer = setTimeout(() => { if (loadingEl) loadingEl.classList.remove('hidden'); }, 5000);
    } else if (loadingEl) {
        loadingEl.classList.add('hidden');
    }
}

async function finishFoodQuickAdd(text, estimate) {
    const calories = Math.round(estimate || 0);
    if (!calories || calories <= 0) { showAppToast(t('quick_add_cant_estimate'), 'error'); return; }
    await addQuickLogEntry(text, calories);
    closeModal('modal-ai-brain');
    if (calories > IMPLAUSIBLE_SINGLE_MEAL_CALORIES) {
        showAppToast(t('calories_implausible_toast').replace('{calories}', calories), 'error');
    } else {
        showAppToast(`${t('quick_add_logged_toast')} ${text} (${calories} ${t('calories_unit')})`);
    }
    refreshTodayNutritionViewIfOpen();
}

// מודל מזערי לשאלת הבהרה אחת מה-AI (פרימיום) - לא תור של כמה שאלות כמו
// modal-schedule-clarify, כי כאן תמיד יש לכל היותר שאלה אחת בודדת
function openFoodClarifyModal(question) {
    const questionEl = document.getElementById('food-clarify-question');
    if (questionEl) questionEl.textContent = question;
    const input = document.getElementById('food-clarify-input');
    if (input) input.value = '';
    openModal('modal-food-clarify');
}

function cancelFoodClarify() {
    pendingFoodQuickAddText = '';
    pendingFoodClarifyQuestion = '';
    pendingFoodClarifyIsLocal = false;
    closeModal('modal-food-clarify');
}

function showFoodClarifyLoading() {
    const el = document.getElementById('food-clarify-loading');
    if (el) el.classList.remove('hidden');
}

function hideFoodClarifyLoading() {
    const el = document.getElementById('food-clarify-loading');
    if (el) el.classList.add('hidden');
}

async function confirmFoodClarify() {
    const answerInput = document.getElementById('food-clarify-input');
    const answer = answerInput ? answerInput.value.trim() : '';
    if (!answer) { showAppToast(t('quick_add_missing_text'), 'error'); return; }
    const text = pendingFoodQuickAddText;
    const question = pendingFoodClarifyQuestion;
    const isLocalClarify = pendingFoodClarifyIsLocal;
    pendingFoodClarifyIsLocal = false;
    // לא סוגרים את המודל כאן! (בניגוד לקודם) - סגירה מיידית לפני קריאת
    // הרשת השאירה את המסך ריק לגמרי בזמן ההמתנה (יכולה לקחת זמן, במיוחד
    // עכשיו עם web_search) - נראה כאילו זה "לא עבד" ומעודד יציאה מוקדמת,
    // בדיוק מה שדווח. במקום זה: משביתים את הכפתורים ומראים חיווי בתוך אותו
    // מודל, ורק אז סוגרים בפועל (finishFoodQuickAdd דואגת לזה)
    const actionsEl = document.getElementById('food-clarify-actions');
    if (actionsEl) actionsEl.querySelectorAll('button').forEach(btn => { btn.disabled = true; });
    const loadingTimer = setTimeout(showFoodClarifyLoading, 5000);
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) { closeModal('modal-food-clarify'); await finishFoodQuickAdd(text, estimateFreeTextCalories(text)); return; }
        const attempt = await estimateFoodTextViaAI(token, text, question, answer, isLocalClarify);
        closeModal('modal-food-clarify');
        if (attempt.status === 'estimate') { await finishFoodQuickAdd(text, attempt.calories); return; }
        // status "unknown" - ר' ההערה המקבילה ב-logFoodQuickAddViaAI
        if (attempt.status === 'unknown') {
            showAppToast(t('food_ai_unknown_toast'), 'error');
            await finishFoodQuickAdd(text, estimateFreeTextCalories(text));
            return;
        }
        // תקלה כלשהי בשיחת ההמשך - נופלים לחישוב המקומי במקום להשאיר תקוע בלי לרשום כלום
        await finishFoodQuickAdd(text, estimateFreeTextCalories(text));
    } finally {
        clearTimeout(loadingTimer);
        hideFoodClarifyLoading();
        if (actionsEl) actionsEl.querySelectorAll('button').forEach(btn => { btn.disabled = false; });
    }
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
        // חותמת ברירת מחדל להרשמה חדשה: ערכת נושא ברירת מחדל (theme לא
        // מוגדר בכוונה - loadColorTheme כבר מטפל בזה כ"default") + מצב
        // כהה (light_mode:false) - לפי בקשה מפורשת שכל משתמשת חדשה תתחיל
        // מהערכה הראשונה על רקע כהה, ואחר כך תשנה איך שבא לה. נכתב כאן,
        // ברגע ההרשמה עצמה, ולא כברירת מחדל כללית ב-isLightModeOn, כדי
        // לא לשנות בטעות משתמשות ותיקות שכבר סומכות על ברירת המחדל הישנה
        if (data.user) {
            await supabaseClient.from('user_premium').insert({ user_id: data.user.id, username: email, light_mode: false });
        }
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
    currentUserCreatedAt = user.created_at;
    document.getElementById('login-overlay').style.display = 'none';
    document.getElementById('app-container').style.display = 'flex';
    showAppLoadingOverlay();
    const loadingStartedAt = Date.now();

    // כאן הוספתי את מילוי התאריך האוטומטי גם למשקל וגם לארוחות להיום
    const today = getLocalDateString();
    const selectedDateInput = document.getElementById('selected-date');
    if(selectedDateInput) { selectedDateInput.value = today; updateDateFieldDisplay('selected-date'); }
    const weightDateInput = document.getElementById('new-weight-date');
    if(weightDateInput) { weightDateInput.value = today; updateDateFieldDisplay('new-weight-date'); }

    loadCustomDefaultHours();
    buildWeeklyScheduleAccordionUI();
    applyUserCountrySetting();
    // loadPremiumStatus מחוץ ל-Promise.all שלמטה ומחכה לו קודם: loadGlobalFont
    // צריך לדעת כבר את isPremiumUser הסופי כדי לאכוף את הנעילה שלו כראוי
    // (בניגוד ל-loadColorTheme, ששם הנעילה נאכפת רק בבחירה עצמה, לא בטעינה) -
    // אם שניהם היו רצים במקביל בתוך אותו Promise.all, היה מרוץ-תזמון שבו
    // isPremiumUser עוד false (הערך ההתחלתי) כש-loadGlobalFont כבר קורא אותו
    await loadPremiumStatus();
    // loadFinanceCycleSetting מחוץ ל-Promise.all שלמטה ומחכה לו קודם: loadFinanceData
    // (בפנים ה-Promise.all) קורא ל-getFinanceCycleStartDay באופן סינכרוני כדי לחשב
    // את טווח התאריכים - אם שניהם היו רצים במקביל, היה מרוץ-תזמון שבו הערך עדיין
    // ברירת המחדל (1) כש-loadFinanceData כבר קורא אותו, בדיוק כמו ההערה למעלה על
    // loadPremiumStatus/loadGlobalFont
    await loadFinanceCycleSetting();
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
        loadCalorieMonthlyCalendar(),
        loadRecipes(),
        loadAiUsage(),
        loadColorTheme(),
        loadLightModeSetting(),
        loadGlobalTextColor(),
        loadGlobalFont(),
        loadMonthlyGoal(),
        loadFinanceData(),
        loadSportData(),
        loadWaterData(),
        loadHabits(),
        loadNutritionGoals()
    ]);
    // ניקוי שורות "יתומות" (שנשארו מברירת מחדל ישנה עם יותר שורות) רץ פעם
    // אחת בלבד כאן, בטעינת האפליקציה - לא בכל loadWeeklySchedule (ר' ההערה שם)
    await pruneEmptyExcessSlots();
    loadAllCenterItems();
    // מחכים שאנימציית "הספר" תסיים לרוץ במלואה לפני שמסתירים את מסך הטעינה -
    // בלי זה, כשהטעינה האמיתית מהירה (רשת טובה/מטמון), האנימציה נקטעת אחרי
    // חלק שנייה ("נראה כאילו זה נפתח ומיד נסגר") - לפי בקשה מפורשת. אם הטעינה
    // בפועל לקחה יותר זמן מהאנימציה, אין המתנה נוספת בכלל (הפרש שלילי/0)
    const loadingElapsedMs = Date.now() - loadingStartedAt;
    if (loadingElapsedMs < BOOK_LOADING_ANIMATION_MS) {
        await new Promise(resolve => setTimeout(resolve, BOOK_LOADING_ANIMATION_MS - loadingElapsedMs));
    }
    hideAppLoadingOverlay();
    applyPwaShortcutDeepLink();
    initFixedAiFab();
    initFixedAiBrainFab();
    document.getElementById('btn-save-nutrition').onclick = saveNutrition;
    document.getElementById('btn-copy-yesterday').onclick = copyFromYesterday;
    document.getElementById('btn-save-daily-focus').onclick = saveDailyFocus;
    selectedDateInput.onchange = (e) => { loadDailyNutrition(e.target.value); loadDailySteps(e.target.value); };

    // טעינת תזונה וצעדים להיום אוטומטית (אם קיים)
    if(today) { loadDailyNutrition(today); loadDailySteps(today); }

    requestNotificationPermission();
    checkReminders();
    if (!reminderIntervalStarted) {
        reminderIntervalStarted = true;
        setInterval(checkReminders, 20000);
    }
    checkDailyGreeting();
    checkDailyFocusPrompt();
    // איפוס בחצות: אם האפליקציה נשארת פתוחה על פני חצות, בודקים כל דקה אם
    // התאריך המקומי התקדם, ואם כן מריצים מחדש את הבדיקה כדי שהאייקון יחזור
    // למצב הבולט ליום החדש בלי צורך ברענון ידני - לפי בקשה מפורשת ("איפוס
    // בחצות: המערכת מרעננת... ומחזירה את האיקון לסטייט הבולט")
    if (!dailyFocusMidnightCheckStarted) {
        dailyFocusMidnightCheckStarted = true;
        setInterval(() => {
            if (getLocalDateString() !== lastCheckedDailyFocusDate) checkDailyFocusPrompt();
        }, 60000);
    }
}

// ברכה יומית עם נצנצים - לפי בקשה מפורשת ("בפעם הראשונה ביום, עם נצנצים
// שיורדים מהתקרה ובוקר טוב/ערב טוב"). פעם אחת בלבד ביום, בפעם הראשונה
// שהאפליקציה נטענת לאחר התחברות - לא בכל טעינה חוזרת (ר' הדגל ב-localStorage,
// אותו דפוס כמו weekwise_today_celebrated_${todayStr})
function checkDailyGreeting() {
    const todayStr = getLocalDateString();
    if (localStorage.getItem(`weekwise_daily_greeting_${todayStr}`) === 'true') return;
    localStorage.setItem(`weekwise_daily_greeting_${todayStr}`, 'true');
    const hour = new Date().getHours();
    let key, emoji;
    if (hour >= 5 && hour < 12) { key = 'daily_greeting_morning'; emoji = '☀️'; }
    else if (hour >= 12 && hour < 17) { key = 'daily_greeting_afternoon'; emoji = '🌤️'; }
    else if (hour >= 17 && hour < 21) { key = 'daily_greeting_evening'; emoji = '🌆'; }
    else { key = 'daily_greeting_night'; emoji = '🌙'; }
    showDailyGreetingBanner(`${emoji} ${t(key)}`);
    triggerDailyGreetingSparkles();
}

// שאלה יומית "מה הכי חשוב לך לעשות היום" - לא קופצת מעצמה יותר: מציגים רק
// תג "1" קטן על אייקון המוח (כמו הודעה שלא נקראה), ולוחצים על המוח כדי
// לפתוח ולראות אותה (ר' initFixedAiBrainFab) - לפי בקשה מפורשת ("בא לי
// שיהיה מספר 1 כזה כמו הודעה ממנו ואני אפתח"). ר' dailyFocusState למטה
// למצבים המדויקים (בולט/דהוי/נעלם).
//
// הבדיקה אם כבר נענה/נצפה היום מתבססת על Supabase (calendar_events) - לא
// localStorage: דווח שהתג ממשיך לקפוץ מחדש למרות שכבר נענתה השאלה, וזה קורה
// כשמשתמשים גם באפליקציה המותקנת וגם בדפדפן הרגיל על אותו מחשב - לשניהם
// יכול להיות אחסון-דפדפן נפרד לגמרי, אז דגל ב-localStorage לא בהכרח מסונכרן
// ביניהם. Supabase כן משותף (אותו חשבון), אז זה המקור האמין היחיד
// יום אחרון שנבדק (ר' תת-הפרק על איפוס בחצות בתוך initAppAfterAuth) - כדי
// לדעת מתי getLocalDateString() התקדם ליום חדש בזמן שהאפליקציה עדיין פתוחה
let lastCheckedDailyFocusDate = null;

// שלושה מצבים לתג "1" עצמו (לא לאייקון המוח - הוא תמיד נשאר בשקיפות מלאה,
// ר' ההערה על applyDailyFocusIconState): 'unseen' - עוד לא נצפה היום, תג
// בולט. 'dismissed' - נסגר עם X/קליק מחוץ בלי לבחור תגית - התג *נשאר*, רק
// חלש/דהוי יותר, כדי לא להטריד אבל גם לא להיעלם לגמרי - לפי בקשה מפורשת
// ("שיהיה שם אבל פשוט פחות חזק שלא יציק"). 'answered' - נשמרה לפחות תגית
// אחת בפועל - התג נעלם לגמרי, אין יותר מה להזכיר. כל הפרימיום נעול, כולל
// "Daily Mix" - לפי בקשה מפורשת ("שכל הפרימיום יהיה חסום") - לא-פרימיום
// מקבל 'answered' (תג מוסתר) בלי שום רמז/פיתוי
let dailyFocusState = 'unseen';
async function checkDailyFocusPrompt() {
    if (!currentUserId || !supabaseClient) return;
    if (!isPremiumUser) {
        dailyFocusState = 'answered';
        applyDailyFocusIconState();
        return;
    }
    const todayStr = getLocalDateString();
    lastCheckedDailyFocusDate = todayStr;
    const { data } = await supabaseClient.from('calendar_events').select('source').eq('user_id', currentUserId).eq('event_date', todayStr).in('source', ['daily_focus', 'daily_focus_dismissed']);
    if (data && data.some(row => row.source === 'daily_focus')) dailyFocusState = 'answered';
    else if (data && data.some(row => row.source === 'daily_focus_dismissed')) dailyFocusState = 'dismissed';
    else dailyFocusState = 'unseen';
    applyDailyFocusIconState();
}

// רק התג "1" עצמו מגיב למצב (בולט/דהוי/נעלם) - אייקון המוח עצמו תמיד נשאר
// בשקיפות מלאה ולחיץ. תוקן: דהייה הוחלה בטעות על כל אייקון המוח (.ai-brain-fab)
// במקום רק על ההודעה הקופצת - דווח: "למה עשית את כל המוח דהוי??? זה היה
// אמור להיות רק על המספר 1"
function applyDailyFocusIconState() {
    const badge = document.getElementById('ai-brain-fab-badge');
    if (!badge) return;
    badge.classList.toggle('hidden', dailyFocusState === 'answered');
    badge.classList.toggle('daily-focus-badge-dim', dailyFocusState === 'dismissed');
}

// "Daily Mix" - בנק 42 המשפטים (7 קטגוריות × 6), בעברית בלבד (תוכן אישי/
// מנוסח, לא מחרוזת ממשק - לא עובר דרך i18n.js כמו שאר האפליקציה) - לפי בקשה
// מפורשת, כולל התוכן המדויק שנשלח
const DAILY_FOCUS_TAG_BANK = [
    ["לשמור על המרחב השקט שלי מול העומס מסביב", "להציב גבולות ברורים באהבה ובלי רגשות אשמה", "להישאר בעוגן שלי גם כשמסביב יש סערה", "לשמור על השלווה והאנרגיה שלי כעדיפות עליונה", "לא לקחת על עצמי רגשות ומצבי רוח של אחרים", "לא לאפשר למילים של אחרים לערער את הערך שלי"],
    ["להקשיב למה שהגוף והנפש שלי צריכים", "ליהנות מהדברים הקטנים בדרך", "להאט ולהיות בקשב נקי לעצמי", "לתת לעצמי מקום לנשום באמצע העשייה", "להרגיש בבית ובשקט בתוך עצמי", "להתמקד במה שקורה עכשיו, בלי לרוץ קדימה"],
    ["לשמור על דיבור מקדם, סבלני ומבין", "לא לקחת שום דבר באופן אישי", "לא להניח הנחות – פשוט לשאול או לשחרר", "לסמוך על הקצב שלי ועל הדרך", "לשחרר את השלמות ולבחור בהתקדמות", "להיות בסבלנות כלפי התהליך שלי"],
    ["לסיים את היום בתחושת גאווה וסיפוק", "לראות את ההתקדמות שלי, גם בצעדים קטנים", "להתמקד במשימה אחת בכל פעם", "לעשות סדר במשימות ולפעול ברוגע", "לקבל את עצמי בדיוק כמו שאני היום", "לדעת מתי לפעול ומתי להניח"],
    ["להביא חיוך וקלילות לכל מה שאעשה", "לפתוח את היום באנרגיה טובה ומחודשת", "לתת לעצמי יום אחד רגוע, בלי ציפיות מוגזמות", "להכניס שמחה פשוטה לתוך השגרה", "לפתוח את הלב להפתעות טובות היום", "להתחיל את היום בהודיה ובחיוך"],
    ["להקשיב באמת ולא רק לחכות לענות", "לזכור שכל אחד עובר משהו שלא רואים", "להפיץ אנרגיה טובה ומקרבת סביבי", "לשמור על פתיחות וכבוד בתקשורת שלי", "לראות את הטוב באנשים שמסביבי", "לתת מילה טובה למי שצריך היום"],
    ["לזכור את מה שיש ולא רק את מה שחסר", "לשחרר את מה שלא בשליטתי", "להעריך את הלמידה גם כשדברים לא מתוכננים", "לעצור לרגע ולהגיד תודה על מה שיש", "לבטוח בעצמי וביכולת שלי להתמודד", "להחזיר לעצמי פרופורציה בריאה על הדברים"],
];
// לא רנדומלי - סבב קבוע לפי אינדקס-יום: יום 1 = משפט #1 מכל קטגוריה, יום 2 =
// משפט #2 וכו', חוזר כל 6 ימים - לפי בקשה מפורשת ("את הדוגמא הראשונה מכל
// קטגוריה ליום ה-1... את הדוגמא ה-2 לסבב השני"). מבוסס על תאריך (לא על
// localStorage/מונה-פתיחות) כדי שכל המכשירים של אותה משתמשת יראו את אותה
// תערובת באותו יום קלנדרי
function getDailyFocusRotationIndex() {
    const epoch = new Date(2024, 0, 1).getTime();
    const daysSinceEpoch = Math.floor((Date.now() - epoch) / 86400000);
    return ((daysSinceEpoch % 6) + 6) % 6;
}

let selectedDailyFocusTags = [];

// בונה את 7 התגיות של היום (משפט אחד מכל קטגוריה, לפי הסבב) + תגית "אחר"
// חופשית בסוף. בחירה מרובה - כל תגית שנבחרת מתווספת ל-selectedDailyFocusTags
function renderDailyFocusTags() {
    const container = document.getElementById('daily-focus-tags-list');
    if (!container) return;
    container.innerHTML = '';
    selectedDailyFocusTags = [];
    const idx = getDailyFocusRotationIndex();
    DAILY_FOCUS_TAG_BANK.forEach(category => {
        const text = category[idx];
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'daily-focus-tag-chip';
        chip.textContent = text;
        chip.onclick = () => toggleDailyFocusTag(text, chip);
        container.appendChild(chip);
    });
    const otherChip = document.createElement('button');
    otherChip.type = 'button';
    otherChip.className = 'daily-focus-tag-chip daily-focus-tag-chip-other';
    otherChip.textContent = t('daily_focus_other_option');
    otherChip.onclick = () => toggleDailyFocusOther(otherChip);
    container.appendChild(otherChip);
}

function toggleDailyFocusTag(text, chipEl) {
    const idx = selectedDailyFocusTags.indexOf(text);
    if (idx === -1) { selectedDailyFocusTags.push(text); chipEl.classList.add('selected'); }
    else { selectedDailyFocusTags.splice(idx, 1); chipEl.classList.remove('selected'); }
}

// תגית "אחר" חופשית - לא נספרת עם selectedDailyFocusTags (יש לה טקסט חופשי
// משלה), רק מציגה/מסתירה את שדה הטקסט; התוכן שלה נקרא ישירות ב-saveDailyFocus
function toggleDailyFocusOther(chipEl) {
    const input = document.getElementById('daily-focus-input');
    const nowSelected = chipEl.classList.toggle('selected');
    if (input) {
        input.classList.toggle('hidden', !nowSelected);
        if (nowSelected) input.focus();
        else input.value = '';
    }
}

// לחיצה על אייקון המוח כשיש שאלה ממתינה (ר' initFixedAiBrainFab) - פותחת את
// הבועה במצב המכווץ (השאלה בלבד) ומסתירה את התג בזמן שהיא פתוחה
function openDailyFocusBubble() {
    const bubble = document.getElementById('daily-focus-bubble');
    const input = document.getElementById('daily-focus-input');
    if (input) { input.value = ''; input.classList.add('hidden'); }
    document.getElementById('daily-focus-bubble-collapsed').classList.remove('hidden');
    document.getElementById('daily-focus-bubble-expanded').classList.add('hidden');
    if (bubble) bubble.classList.remove('hidden');
    const badge = document.getElementById('ai-brain-fab-badge');
    if (badge) badge.classList.add('hidden');
}

// קליק מחוץ לבועה סוגר אותה בדיוק כמו X - לפי בקשה מפורשת ("בלחיצה על X או
// מחוץ לחלון"). רשום פעם אחת בלבד (ר' initFixedAiBrainFab) - בודק ב-early
// return אם הבועה בכלל פתוחה, אז זול גם כשלא רלוונטי. stopPropagation על
// כפתור התג עצמו כבר מונע מהקליק-שפותח את הבועה להגיע לכאן ולסגור אותה מיד
function handleDailyFocusOutsideClick(e) {
    const bubble = document.getElementById('daily-focus-bubble');
    if (!bubble || bubble.classList.contains('hidden')) return;
    if (bubble.contains(e.target)) return;
    dismissDailyFocusModal();
}

// לחיצה על הבועה עצמה (המצב המכווץ) - נפתחת למצב בחירת התגיות, במקום לעבור
// למודל נפרד - לפי בקשה מפורשת ("שאפשר יהיה ללחוץ עליה")
function expandDailyFocusBubble() {
    document.getElementById('daily-focus-bubble-collapsed').classList.add('hidden');
    document.getElementById('daily-focus-bubble-expanded').classList.remove('hidden');
    renderDailyFocusTags();
}

// עדכון מיידי של המצב-בזיכרון בלבד (בלי לחכות לשאילתה חוזרת ל-Supabase) -
// המקור האמין עצמו הוא השורה שכבר נשמרה ב-calendar_events, ר' ההערה על
// checkDailyFocusPrompt
function markDailyFocusPromptShown() {
    dailyFocusState = 'answered';
}

// סגירה עם ה-✕ (משני המצבים - מכווץ ומורחב) או קליק מחוץ לבועה - "נצפה
// אבל לא נענה": התג *לא* נעלם לגמרי, רק נהיה חלש/דהוי - לפי בקשה מפורשת
// ("שיהיה שם אבל פשוט פחות חזק שלא יציק למשתמש"), לא "תזכיר לי אחר כך" כמו
// המקור. נשמר כשורת calendar_events (source:'daily_focus_dismissed') כדי
// שהמצב יישאר עקבי גם אחרי רענון/במכשיר אחר, בדיוק כמו daily_focus עצמו
async function dismissDailyFocusModal() {
    const bubble = document.getElementById('daily-focus-bubble');
    if (bubble) bubble.classList.add('hidden');
    if (dailyFocusState === 'unseen' && isPremiumUser && supabaseClient && currentUserId) {
        await supabaseClient.from('calendar_events').insert({
            username: currentUsername, user_id: currentUserId, event_title: 'daily_focus_dismissed',
            event_date: getLocalDateString(), source: 'daily_focus_dismissed',
        });
    }
    if (dailyFocusState !== 'answered') dailyFocusState = 'dismissed';
    applyDailyFocusIconState();
}

// בחירה מרובה - כל תגית שנבחרה (+ הטקסט החופשי מ"אחר", אם הוזן) הופכת לשורת
// calendar_events נפרדת משלה, לפי בקשה מפורשת ("כל תגית שנבחרת... הופכת
// באופן אוטומטי להצצה יומית")
async function saveDailyFocus() {
    const input = document.getElementById('daily-focus-input');
    const freeText = input && !input.classList.contains('hidden') ? input.value.trim() : '';
    const allTexts = [...selectedDailyFocusTags];
    if (freeText) allTexts.push(freeText);
    if (!allTexts.length) { showAppToast(t('daily_focus_missing_text'), 'error'); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const todayStr = getLocalDateString();
    const rows = allTexts.map(text => ({
        username: currentUsername, user_id: currentUserId, event_title: text,
        event_date: todayStr, source: 'daily_focus',
    }));
    await supabaseClient.from('calendar_events').insert(rows);
    markDailyFocusPromptShown();
    applyDailyFocusIconState();
    const bubble = document.getElementById('daily-focus-bubble');
    if (bubble) bubble.classList.add('hidden');
    showAppToast(t('daily_focus_added_toast'));
    loadTodayTasks();
    selectedDailyFocusTags = [];
}

function showDailyGreetingBanner(text) {
    const wrapper = document.querySelector('.phone-wrapper');
    if (!wrapper) return;
    const banner = document.createElement('div');
    banner.className = 'daily-greeting-banner';
    banner.textContent = text;
    wrapper.appendChild(banner);
    // נעלם בהדרגה (fade-out) לפני ההסרה מה-DOM, לא נעלם פתאומי
    setTimeout(() => banner.classList.add('daily-greeting-banner-hide'), 3800);
    setTimeout(() => banner.remove(), 4400);
}

// נצנצים קלילים לכ-20 שניות (בניגוד ל-triggerAllDoneSparkles שרץ 2 דקות שלמות
// לרגע ה"הכל בוצע") - משתמשת באותן מחלקות CSS בדיוק (all-done-sparkles/
// all-done-sparkle), רק overlay נפרד כדי שלא יתנגש עם נצנצי ה"הכל בוצע"
// אם שניהם קורים באותו יום
function triggerDailyGreetingSparkles() {
    if (document.getElementById('daily-greeting-sparkles')) return;
    const wrapper = document.querySelector('.phone-wrapper');
    if (!wrapper) return;
    const overlay = document.createElement('div');
    overlay.id = 'daily-greeting-sparkles';
    overlay.className = 'all-done-sparkles';
    wrapper.appendChild(overlay);

    // רק כוכבים קטנים - לפי בקשה מפורשת ("רציתי כוכבים קטנים בלבד"), לא
    // התערובת המלאה שמשמשת את נצנצי ה"הכל בוצע"
    const spawnSparkle = () => {
        const sparkle = document.createElement('span');
        sparkle.className = 'all-done-sparkle';
        sparkle.textContent = '⭐';
        sparkle.style.left = `${Math.random() * 100}%`;
        sparkle.style.animationDuration = `${3 + Math.random() * 2.5}s`;
        sparkle.style.fontSize = `${0.5 + Math.random() * 0.4}rem`;
        overlay.appendChild(sparkle);
        sparkle.addEventListener('animationend', () => sparkle.remove());
    };
    const spawnTimer = setInterval(spawnSparkle, 250);
    setTimeout(() => {
        clearInterval(spawnTimer);
        setTimeout(() => overlay.remove(), 6000);
    }, 20000);
}

// משך אנימציית "הספר" המלאה (7 דפים, ר' theme.css: עמוד אחרון עם delay 9.3s
// + משך הפיכה 1.1s = 10.4s, + מרווח ביטחון קטן) - initAppAfterAuth מחכה
// לפחות עד למשך הזה לפני שמסתיר את מסך הטעינה, כדי שהאנימציה תמיד תושלם
const BOOK_LOADING_ANIMATION_MS = 10600;

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
// .modal-open על .phone-wrapper (אותו דפוס בדיוק כמו .menu-open של תפריט
// ההמבורגר) - חייב כדי להסתיר את ה-Dock (ושני כפתורי ה-FAB בפינות) בזמן
// שמודל פתוח: לכולם z-index:99999 !important, גבוה בהרבה מ-2000 של
// .apple-modal, אז בלי זה הם ממשיכים "לצוף" מעל תוכן המודל - לא רק נראים
// מוזר, אלא גם תופסים לחיצות/מגע שאמורות להגיע לכפתורים מתחתיהם (זה בדיוק
// מה שגרם לכפתור "איפוס פריסת הקיצורים" להיראות כאילו "לא עושה כלום")
function openModal(modalId) {
    document.querySelectorAll('.apple-modal.open').forEach(m => { if (m.id !== modalId) m.classList.remove('open'); });
    document.getElementById(modalId).classList.add('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.add('modal-open');
}
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('open');
    // תמיד מותר להסיר בלי תנאי - openModal כבר דואגת שלכל היותר מודל אחד
    // פתוח בו-זמנית (ר' ההערה למעלה), אז סגירת "המודל הפתוח" תמיד אומרת
    // שאף מודל אחר לא נשאר פתוח
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.remove('modal-open');
}

// --- ניווט מסך ההגדרות: מסך-ראשי (5 קטגוריות) + מסכי-משנה, בסגנון הגדרות
// וואטסאפ/iOS - לפי בקשה מפורשת. לא מודל נפרד לכל קטגוריה (היה מסבך את כל
// שאר האתר שכבר סומך על getElementById ישיר לכל שדה/כפתור בהגדרות) - אותו
// modal-settings-drawer בדיוק, רק עם div.settings-subscreen שמוסתרים/נחשפים
// ב-JS במקום גלילה ארוכה אחת ---
function openSettingsDrawer() {
    document.getElementById('settings-main-menu').classList.remove('hidden');
    document.querySelectorAll('.settings-subscreen').forEach(el => el.classList.add('hidden'));
    openModal('modal-settings-drawer');
    renderNotificationSettingsStatus();
    const badgeToggle = document.getElementById('home-calorie-badge-toggle');
    if (badgeToggle) badgeToggle.checked = isHomeCalorieBadgeOn();
}

function openSettingsSubscreen(name) {
    document.getElementById('settings-main-menu').classList.add('hidden');
    document.querySelectorAll('.settings-subscreen').forEach(el => {
        el.classList.toggle('hidden', el.id !== `settings-subscreen-${name}`);
    });
    const sheet = document.querySelector('#modal-settings-drawer .modal-sheet');
    if (sheet) sheet.scrollTop = 0;
}

function backToSettingsMain() {
    document.querySelectorAll('.settings-subscreen').forEach(el => el.classList.add('hidden'));
    document.getElementById('settings-main-menu').classList.remove('hidden');
}

let pendingCenterItemType = null;
// עיצוב טקסט לפתק/משימה בודדים - פלטת צבעים קבועה (לא var(--accent-*),
// כדי שהבחירה של המשתמשת תישאר בדיוק אותו גוון גם אם היא מחליפה אחר כך
// ערכת נושא פרימיום - זו העדפה אישית על התוכן, לא צבע-נושא) - לפי בקשה
// מפורשת ("אפשר צבע שונה למילים פה בפתקים? ובכל האפליקציה?")
const CENTER_ITEM_COLOR_PRESETS = ['#ff453a', '#f5c518', '#34d399', '#22d3ee', '#3b82f6', '#a855f7', '#ff2d95'];

function hexToRgba(hex, alpha) {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16);
    const g = parseInt(clean.substring(2, 4), 16);
    const b = parseInt(clean.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
let pendingCenterItemColor = null;

// שלושת הבוררים (טקסט/זוהר/רקע) מוצגים רק במודל ההוספה/עריכה המלא
// (modal-add-center-item) - בכוונה לא ב"פתק מהיר" (modal-ai-quick-add),
// לפי בקשה מפורשת: "פתק מהיר" נשאר פשוט וקצר, בלי בוררי צבע
function renderIntoAll(ids, buildFn) {
    ids.forEach(id => {
        const wrap = document.getElementById(id);
        if (wrap) buildFn(wrap);
    });
}

const CENTER_ITEM_COLOR_CONTAINER_IDS = ['center-item-color-swatches'];
const CENTER_ITEM_GLOW_CONTAINER_IDS = ['center-item-glow-swatches'];
const CENTER_ITEM_BG_CONTAINER_IDS = ['center-item-bg-swatches'];

function renderCenterItemColorSwatches() {
    renderIntoAll(CENTER_ITEM_COLOR_CONTAINER_IDS, wrap => {
        wrap.innerHTML = '';
        const defaultBtn = document.createElement('button');
        defaultBtn.type = 'button';
        defaultBtn.className = 'note-color-swatch note-color-swatch-default' + (!pendingCenterItemColor ? ' selected' : '');
        defaultBtn.title = t('note_text_color_default');
        defaultBtn.textContent = 'A';
        defaultBtn.onclick = () => selectCenterItemColor(null);
        wrap.appendChild(defaultBtn);
        CENTER_ITEM_COLOR_PRESETS.forEach(color => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'note-color-swatch' + (pendingCenterItemColor === color ? ' selected' : '');
            btn.style.backgroundColor = color;
            btn.onclick = () => selectCenterItemColor(color);
            wrap.appendChild(btn);
        });
    });
}

// שלושת הבוררים נעולים לפרימיום (לא רק בחירת הפונט/ערכת הנושא) - לפי
// בקשה מפורשת "שכל הבחירת צבעים בפרימיום גם הזוהרים"
function selectCenterItemColor(color) {
    if (color && !isPremiumUser) { openPremiumUpgradeModal(); return; }
    pendingCenterItemColor = color;
    renderCenterItemColorSwatches();
    updateCenterItemPreview();
}

// זוהר ניאון סביב הפתק/משימה (box-shadow) - 6 אפשרויות בלבד, בכוונה מתוך
// 6 צבעי-הדגל של האפליקציה עצמה (ר' --accent-* ב-theme.css), לא אותה
// פלטת 8 של צבע הטקסט - שני אפקטים שונים לגמרי (זוהר מסביב מול צבע
// אותיות), לפי בקשה מפורשת ("צבעים שיהיו זוהרים איזה 6 אפשרויות")
const GLOW_COLOR_PRESETS = ['#ff007f', '#a855f7', '#00d4ff', '#00e676', '#f59e0b', '#ff453a', '#d2a679'];
let pendingCenterItemGlow = null;

function renderCenterItemGlowSwatches() {
    renderIntoAll(CENTER_ITEM_GLOW_CONTAINER_IDS, wrap => {
        wrap.innerHTML = '';
        const defaultBtn = document.createElement('button');
        defaultBtn.type = 'button';
        defaultBtn.className = 'note-color-swatch note-color-swatch-default' + (!pendingCenterItemGlow ? ' selected' : '');
        defaultBtn.title = t('note_text_color_default');
        defaultBtn.textContent = 'A';
        defaultBtn.onclick = () => selectCenterItemGlow(null);
        wrap.appendChild(defaultBtn);
        GLOW_COLOR_PRESETS.forEach(color => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'note-color-swatch' + (pendingCenterItemGlow === color ? ' selected' : '');
            btn.style.backgroundColor = color;
            btn.style.boxShadow = `0 0 10px ${color}`;
            btn.onclick = () => selectCenterItemGlow(color);
            wrap.appendChild(btn);
        });
    });
}

function selectCenterItemGlow(color) {
    if (color && !isPremiumUser) { openPremiumUpgradeModal(); return; }
    pendingCenterItemGlow = color;
    renderCenterItemGlowSwatches();
    updateCenterItemPreview();
}

// רקע צבעוני לשורה כולה (לא רק הטקסט) - אותה פלטת 8 בדיוק כמו צבע הטקסט
// (אותם עיגולים, לפי בקשה מפורשת "גם הכל שיהיה בעיגולים"), עמעום ל-18%
// באמצעות rgba כשמוחל בפועל (ר' loadCenterItems) כדי שהטקסט/כפתורים
// בשורה יישארו קריאים מעל הרקע, לא צבע אטום שמכסה הכול
let pendingCenterItemBg = null;

function renderCenterItemBgSwatches() {
    renderIntoAll(CENTER_ITEM_BG_CONTAINER_IDS, wrap => {
        wrap.innerHTML = '';
        const defaultBtn = document.createElement('button');
        defaultBtn.type = 'button';
        defaultBtn.className = 'note-color-swatch note-color-swatch-default' + (!pendingCenterItemBg ? ' selected' : '');
        defaultBtn.title = t('note_text_color_default');
        defaultBtn.textContent = 'A';
        defaultBtn.onclick = () => selectCenterItemBg(null);
        wrap.appendChild(defaultBtn);
        CENTER_ITEM_COLOR_PRESETS.forEach(color => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'note-color-swatch' + (pendingCenterItemBg === color ? ' selected' : '');
            btn.style.backgroundColor = color;
            btn.onclick = () => selectCenterItemBg(color);
            wrap.appendChild(btn);
        });
    });
}

function selectCenterItemBg(color) {
    if (color && !isPremiumUser) { openPremiumUpgradeModal(); return; }
    pendingCenterItemBg = color;
    renderCenterItemBgSwatches();
    updateCenterItemPreview();
}

// איפוס+ציור ראשוני של שלושת הבוררים לפני פתיחת מודל - נקרא גם מ-
// openCenterAdder וגם מפתיחת "פתק מהיר" (ר' initFixedAiFab)
function resetCenterItemColorPickers() {
    pendingCenterItemColor = null;
    pendingCenterItemGlow = null;
    pendingCenterItemBg = null;
    renderCenterItemColorSwatches();
    renderCenterItemGlowSwatches();
    renderCenterItemBgSwatches();
    updateCenterItemPreview();
}

// תצוגה מקדימה חיה - מתעדכנת גם בהקלדה (oninput על שני שדות הטקסט) וגם
// בבחירת צבע (ר' selectCenterItemColor/Glow/Bg) - "שרושמים יש ממש דוגמא
// לאיך זה יראה", לפי בקשה מפורשת. הזוהר מוצג כ-text-shadow על הטקסט עצמו
// (לא box-shadow על כל השורה) - "הזוהר תחבר לטקסט" - בדיוק כמו שהוא באמת
// נשמר ומוצג ברשימה עצמה (ר' loadCenterItems)
const CENTER_ITEM_PREVIEW_PAIRS = [
    { input: 'center-item-input', row: 'center-item-preview-row', text: 'center-item-preview-text' },
];
// התצוגה המקדימה מוצגת רק כשיש בפועל טקסט/צבע לתצוגה - לפי בקשה מפורשת
// ("רק תצוגה מקדימה ברגע שרושמים משהו ומנסים"), לא תמיד עם משפט "ככה
// ייראה הטקסט שלך" ריק כשעוד לא הוקלד כלום
function updateCenterItemPreview() {
    CENTER_ITEM_PREVIEW_PAIRS.forEach(pair => {
        const input = document.getElementById(pair.input);
        const row = document.getElementById(pair.row);
        const textEl = document.getElementById(pair.text);
        if (!input || !row || !textEl) return;
        const text = input.value.trim();
        if (!text) { row.style.display = 'none'; return; }
        row.style.display = '';
        textEl.textContent = text;
        textEl.style.color = pendingCenterItemColor || '';
        textEl.style.textShadow = pendingCenterItemGlow ? `0 0 4px ${pendingCenterItemGlow}, 0 0 10px ${pendingCenterItemGlow}, 0 0 18px ${pendingCenterItemGlow}` : '';
        row.style.backgroundColor = pendingCenterItemBg ? hexToRgba(pendingCenterItemBg, 0.18) : '';
    });
}

// editingCenterItemId!=null אומר שהמודל פתוח במצב עריכה (לא הוספה) - אותו
// מודל/שדה משמשים את שני הזרמים, submitCenterItem מנתב לפי מה שמוגדר כאן
let editingCenterItemId = null;
function openCenterAdder(type) {
    editingCenterItemId = null;
    pendingCenterItemType = type;
    document.getElementById('center-item-modal-title').textContent = t('add_item_title');
    const input = document.getElementById('center-item-input');
    input.value = '';
    resetCenterItemColorPickers();
    openModal('modal-add-center-item');
    setTimeout(() => input.focus(), 150);
}

// נקרא מכפתור העריכה (✏️) בכל שורת פתק/משימה - קורא את הטקסט הנוכחי ואת
// מזהה הפריט ישירות מה-DOM (לא מוטבע ב-onclick) כדי לא להסתבך עם escaping
// של תווים מיוחדים שהמשתמש הקליד בתוכן עצמו. צבעי הפתק הנוכחיים נקראים מ-
// data-text-color/data-glow-color/data-bg-color על ה-li עצמו (ר'
// loadCenterItems) מאותה סיבה בדיוק
function openCenterItemEditor(btn, type) {
    const li = btn.closest('li');
    if (!li) return;
    editingCenterItemId = li.getAttribute('data-item-id');
    pendingCenterItemType = type;
    const currentText = li.querySelector('.center-list-item-text').textContent.trim();
    document.getElementById('center-item-modal-title').textContent = t('edit_item_title');
    const input = document.getElementById('center-item-input');
    input.value = currentText;
    pendingCenterItemColor = li.getAttribute('data-text-color') || null;
    pendingCenterItemGlow = li.getAttribute('data-glow-color') || null;
    pendingCenterItemBg = li.getAttribute('data-bg-color') || null;
    renderCenterItemColorSwatches();
    renderCenterItemGlowSwatches();
    renderCenterItemBgSwatches();
    updateCenterItemPreview();
    openModal('modal-add-center-item');
    setTimeout(() => input.focus(), 150);
}

function submitCenterItem() {
    const input = document.getElementById('center-item-input');
    const text = input.value.trim();
    const type = pendingCenterItemType;
    const editId = editingCenterItemId;
    const color = pendingCenterItemColor;
    const glow = pendingCenterItemGlow;
    const bg = pendingCenterItemBg;
    closeModal('modal-add-center-item');
    editingCenterItemId = null;
    pendingCenterItemType = null;
    pendingCenterItemColor = null;
    pendingCenterItemGlow = null;
    pendingCenterItemBg = null;
    if (!text || !type) return;
    if (editId) updateCenterItemDirect(editId, type, text, color, glow, bg);
    else insertCenterItemDirect(type, text, color, glow, bg);
}

async function updateCenterItemDirect(id, type, content, textColor, glowColor, bgColor) {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const { error } = await supabaseClient.from('my_center_tasks').update({ content, text_color: textColor, glow_color: glowColor, bg_color: bgColor }).eq('id', id);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    await loadCenterItems(type);
    showAppToast(t('item_added_success'));
}

// מחזירה true/false (הצלחה/כישלון) - קריטי לקוראים כמו handleAIQuickAdd
// שצריכים לדעת אם באמת להמשיך (לנקות שדה קלט, לסגור מודל, להראות טוסט
// "נוסף" משלהם) - בעבר תמיד המשיכו בלי קשר לתוצאה בפועל, מה שגרם לפתק
// להיעלם בשקט כשההוספה נכשלה (למשל עמודה חסרה בטבלה): הקריאה הראתה טוסט
// שגיאה, אבל מיד אחריה הקוד הממשיך הראה טוסט "נוסף בהצלחה" שדרס אותו
// חזותית - נראה כאילו הכול תקין בזמן שבפועל שום דבר לא נשמר
async function insertCenterItemDirect(type, content, textColor, glowColor, bgColor, skipSuccessToast) {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return false; }
    const { error } = await supabaseClient.from('my_center_tasks').insert({ username: currentUsername, user_id: currentUserId, task_type: type, content: content, text_color: textColor, glow_color: glowColor, bg_color: bgColor });
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return false; }
    await loadCenterItems(type);
    expandCardForList(`${type}-list`);
    if (!skipSuccessToast) showAppToast(t('item_added_success'));
    return true;
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

// עריכה מהירה של משימה קבועה מהלו"ז - נפתחת גם מ"הצצה ליום" (בעתיד, אם
// ייווסף קישור עריכה שם) וגם מפירוט היום בלוח החודשי (renderSelectedCalendarDay)
let editingGlanceTaskId = null;

// בורר היום (glance-edit-task-day-select) לא היה קיים עד היום - נוסף לפי
// בקשה מפורשת, כך שגם "עדכון" יכול להעביר משימה קבועה ליום אחר (לא רק
// לשנות כותרת/שעה), וגם "שכפול" (duplicateGlanceTask למטה) יודע לאיזה יום
function populateGlanceTaskDaySelect(selectedDay) {
    const select = document.getElementById('glance-edit-task-day-select');
    if (!select) return;
    select.innerHTML = dbDaysMap.map((dbDay, i) => `<option value="${dbDay}"${dbDay === selectedDay ? ' selected' : ''}>${t(dayNameKeys[i])}</option>`).join('');
    updateCustomSelectDisplay('glance-edit-task-day-select');
}

// שדות תזכורת - לא היו זמינים כאן עד היום (רק בטופס ההוספה הישן של הטבלה
// השבועית שהוסרה) - נוספו כדי לא לאבד את היכולת, לפי בקשה מפורשת
function openGlanceTaskEditor(id, title, time, day, reminderMinutes, reminderText) {
    editingGlanceTaskId = id;
    document.getElementById('glance-edit-task-title-input').value = title || '';
    document.getElementById('glance-edit-task-time-input').value = time || '';
    document.getElementById('glance-edit-task-reminder').value = String(reminderMinutes || 0);
    updateCustomSelectDisplay('glance-edit-task-reminder');
    document.getElementById('glance-edit-task-reminder-text').value = reminderText || '';
    populateGlanceTaskDaySelect(day);
    openModal('modal-edit-glance-task');
}

async function saveGlanceTaskEdit() {
    if (!editingGlanceTaskId || !supabaseClient) return;
    const title = document.getElementById('glance-edit-task-title-input').value.trim();
    if (!title) { showAppToast(t('glance_edit_task_missing_title'), 'error'); return; }
    const timeInput = document.getElementById('glance-edit-task-time-input');
    const norm = normalizeScheduleTimeInput(timeInput.value);
    if (norm.time === null || norm.needsAmpm) { showAppToast(t('schedule_invalid_time_error'), 'error'); return; }
    const day = document.getElementById('glance-edit-task-day-select').value;
    const reminderMinutes = parseInt(document.getElementById('glance-edit-task-reminder').value) || 0;
    const reminderText = document.getElementById('glance-edit-task-reminder-text').value.trim();
    const { error } = await supabaseClient.from('weekly_schedule').update({ task_title: title, time_of_day: norm.time, day_of_week: day, reminder_minutes: reminderMinutes > 0 ? reminderMinutes : null, reminder_text: reminderText }).eq('id', editingGlanceTaskId);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    closeModal('modal-edit-glance-task');
    showAppToast(t('glance_edit_task_saved'));
    await Promise.all([loadWeeklySchedule(), loadTodayTasks(), loadMonthlyCalendarGrid()]);
}

// שכפול - יוצר משימה קבועה חדשה עם הכותרת/שעה/יום שרשומים כרגע בטופס, בלי
// לגעת במקורית - לפי בקשה מפורשת ("שכפול ליום אחר"). slot_number מחושב
// כ"הבא בתור" עבור אותו יום, כדי לא להתנגש עם משבצות קיימות
async function duplicateGlanceTask() {
    if (!supabaseClient || !currentUserId) return;
    const title = document.getElementById('glance-edit-task-title-input').value.trim();
    if (!title) { showAppToast(t('glance_edit_task_missing_title'), 'error'); return; }
    const timeInput = document.getElementById('glance-edit-task-time-input');
    const norm = normalizeScheduleTimeInput(timeInput.value);
    if (norm.time === null || norm.needsAmpm) { showAppToast(t('schedule_invalid_time_error'), 'error'); return; }
    const day = document.getElementById('glance-edit-task-day-select').value;
    const reminderMinutes = parseInt(document.getElementById('glance-edit-task-reminder').value) || 0;
    const reminderText = document.getElementById('glance-edit-task-reminder-text').value.trim();
    const { data: existingSlots } = await supabaseClient.from('weekly_schedule').select('slot_number').eq('user_id', currentUserId).eq('day_of_week', day);
    const nextSlot = (existingSlots || []).reduce((max, r) => Math.max(max, r.slot_number || 0), 0) + 1;
    const { error } = await supabaseClient.from('weekly_schedule').insert({ username: currentUsername, user_id: currentUserId, day_of_week: day, slot_number: nextSlot, task_title: title, time_of_day: norm.time, reminder_minutes: reminderMinutes > 0 ? reminderMinutes : null, reminder_text: reminderText });
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    closeModal('modal-edit-glance-task');
    showAppToast(t('calendar_event_duplicated_success'));
    await Promise.all([loadWeeklySchedule(), loadTodayTasks(), loadMonthlyCalendarGrid()]);
}

async function deleteGlanceTaskEdit() {
    if (!editingGlanceTaskId || !supabaseClient) return;
    await supabaseClient.from('weekly_schedule').delete().eq('id', editingGlanceTaskId);
    closeModal('modal-edit-glance-task');
    await Promise.all([loadWeeklySchedule(), loadTodayTasks(), loadMonthlyCalendarGrid()]);
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
    // אשכול הבועות (#fab-dock) שייך למסך הבית בלבד עכשיו - לא כפתור-פינה
    // צנוע כמו עוזר ה-AI, אלא אשכול גדול וממורכז שצף ממש מעל תוכן במסכים
    // פנימיים (דווח במפורש עם צילום מסך: "אני נכנסת לפתקים... זה לא נעלם").
    // עוזר ה-AI (המוח) נשאר צף בכל מסך כרגיל - זה נוגע רק ל-Dock עצמו
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.add('subview-open');
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
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.remove('subview-open');
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
    // .menu-open מסתיר בכוח את כל כפתורי ה-FAB (theme.css) - נדרש כי ל-.fab-dock
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

// בועת הפתקים היא בועה רגילה ב-Dock עכשיו (לא נעולה יותר למרכז) - מחוות
// הטאפ/סיבוב המשותפת לכל הבועות נמצאת ב-initDockCarouselGestures (ר' למטה
// ב-app.js), כאן רק מחברים את הקליק הרגיל לפתיחת המודל
function initFixedAiFab() {
    const el = document.getElementById('btn-ai-fab');
    if (!el) return;
    el.onclick = () => { setQuickNoteDestination('weekly'); openModal('modal-ai-quick-add'); };
}

// יעד "פתק מהיר": פתקים (weekly) או רשימת קניות (general) - בורר קטן בראש
// המודל, אותו דפוס בדיוק כמו ai-schedule-mode-toggle (חד-פעמי/חוזר) שכבר
// קיים במסך הלו"ז, לעקביות ויזואלית. חוזר לברירת המחדל "פתקים" בכל פתיחה
// מחדש של המודל (ר' initFixedAiFab) כדי שלא "ייתקע" על רשימת קניות בטעות
let quickNoteDestination = 'weekly';
function setQuickNoteDestination(type) {
    quickNoteDestination = type;
    document.querySelectorAll('#quick-note-dest-toggle .ai-schedule-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === type);
    });
    const input = document.getElementById('ai-quick-add-input');
    if (input) input.placeholder = t(type === 'general' ? 'notes_ai_placeholder_shopping' : 'notes_ai_placeholder');
}

// ברירת המחדל בפתיחת המוח היא הטאב "מזון" (לא "לו"ז" כמו קודם) - לפי בקשה
// מפורשת שההוספה המהירה של אוכל תהיה "הראשונה בתוך ה-AI"
// לחיצה על אייקון המוח תמיד פותחת את מודל ה-AI הרגיל - התזכורת היומית
// ("מה חשוב היום") לא חוסמת את זה יותר, לפי בקשה מפורשת ("תפריד בינהם...
// לפעמים אני רוצה שההודעה תישמר עד שאחליט מה לרשום, ובמקביל תהיה לי
// האפשרות להיכנס למוח"). לפתיחת התזכורת עצמה יש עכשיו נקודת-כניסה נפרדת -
// לחיצה על תג ה-"1" עצמו (ר' ה-onclick הנפרד שלו ב-index.html)
function initFixedAiBrainFab() {
    const el = document.getElementById('btn-ai-brain-fab');
    if (!el) return;
    el.onclick = () => openAiBrainModal('food');
    // רשום פעם אחת בלבד (initFixedAiBrainFab נקראת פעם אחת ב-initAppAfterAuth) -
    // ר' ההערה על handleDailyFocusOutsideClick עצמה
    document.addEventListener('click', handleDailyFocusOutsideClick);
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

// אותו חישוב בדיוק כמו getFormattedDateForDay, רק בפורמט ISO (YYYY-MM-DD) -
// דרוש כדי לשלוף calendar_events לפי event_date, לא רק לתצוגה
function getIsoDateForDayThisWeek(dayIndex) {
    const current = new Date();
    const sundayDate = new Date(current); sundayDate.setDate(current.getDate() - current.getDay());
    const targetDate = new Date(sundayDate); targetDate.setDate(sundayDate.getDate() + dayIndex);
    return getLocalDateString(targetDate);
}

// אירועים חד-פעמיים (calendar_events) שחלים על השבוע הנוכחי, מוצגים בתוך
// "השבוע שלי" עצמו - לא רק ב"מבט ליומן"/"הצצה להיום"/לוח החודשי כמו קודם.
// אותו דפוס עריכה/מחיקה/השלמה בדיוק כמו ב-loadTodayTasks (closures, לא
// onclick עם מחרוזת מוטבעת, כדי שגרש בודד בכותרת לא ישבור כלום). נקראת מתוך
// loadTodayTasks עצמה (לא מפוזרת בין כל נקודת mutation של calendar_events
// בנפרד) כדי שתמיד תישאר מסונכרנת בלי לצוד כל call site בנפרד
async function loadWeekOneTimeEvents() {
    if (!supabaseClient || !currentUserId) return;
    const weekStart = getIsoDateForDayThisWeek(0);
    const weekEnd = getIsoDateForDayThisWeek(6);
    const { data } = await supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).gte('event_date', weekStart).lte('event_date', weekEnd);
    const byDate = new Map();
    (data || []).forEach(item => {
        if (!byDate.has(item.event_date)) byDate.set(item.event_date, []);
        byDate.get(item.event_date).push(item);
    });
    dbDaysMap.forEach((dbDay, dayIndex) => {
        const container = document.getElementById(`daypage-onetime-${dbDay}`);
        if (!container) return;
        const items = byDate.get(getIsoDateForDayThisWeek(dayIndex)) || [];
        container.innerHTML = '';
        items.forEach(item => {
            const row = document.createElement('div');
            row.className = 'today-tasks-row';
            row.innerHTML = `
                <input type="checkbox" class="day-detail-checkbox"${item.is_completed ? ' checked' : ''} onchange="toggleEventOccurrenceCompletion('${item.id}', this.checked)">
                <span class="today-tasks-text${item.is_completed ? ' completed' : ''}">📅 ${escapeHtmlForReport(item.event_title)}</span>
            `;
            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn-edit-item';
            editBtn.innerHTML = EDIT_ICON_SVG;
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
    });
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

// שאלת אישור לפני מחיקת שורה מהלו"ז השבועי - רק אם יש בה משימה בפועל (שורה
// ריקה אין מה לאבד ממנה, אז שם לא מציקים עם חלון אישור מיותר)
function confirmRemoveDaySlot(day, slot) {
    const slotEl = document.querySelector(`.slot-input-group[data-day="${day}"][data-slot="${slot}"]`);
    const hasTask = slotEl && slotEl.querySelector('.slot-task').value.trim();
    if (hasTask && !confirm(t('schedule_remove_row_confirm'))) return;
    removeDaySlot(day, slot);
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
    updateCustomSelectDisplay('move-slot-day-select');
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
// ברירת המחדל היא הטאב "מזון" - לפי בקשה מפורשת שההוספה המהירה של אוכל
// תהיה "הראשונה בתוך ה-AI" (ר' initFixedAiBrainFab/openFoodQuickAddModal)
function openAiBrainModal(tab = 'food') {
    document.getElementById('ai-schedule-input').value = '';
    document.getElementById('ai-finance-input').value = '';
    const foodInput = document.getElementById('food-quick-add-input');
    if (foodInput) foodInput.value = '';
    setScheduleAiMode('onetime');
    switchAiBrainTab(tab);
    openModal('modal-ai-brain');
}

// בררה מפורשת חד-פעמי/חוזר מעל תיבת הטקסט של תכנון הלו"ז - דורסת את מה
// שה-AI/המנתח המקומי מחליטים על סמך הניסוח (ר' applyExplicitScheduleMode
// למטה, שקוראת לפונקציה הזו בפועל). ברירת המחדל "חד-פעמי", לפי בקשה מפורשת
let scheduleAiMode = 'onetime';
function setScheduleAiMode(mode) {
    scheduleAiMode = mode;
    document.querySelectorAll('.ai-schedule-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    const durationInput = document.getElementById('ai-schedule-duration-months');
    if (durationInput) {
        const showDuration = mode === 'recurring' || mode === 'recurring-daily';
        durationInput.classList.toggle('hidden', !showDuration);
        if (!showDuration) durationInput.value = '';
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

    // כותבים ישירות ל-Supabase (בלי לעבור דרך הרשת הוויזואלית של "השבוע שלי",
    // שהוסרה לגמרי) - כל אירוע מקבל slot_number פנוי הבא בתור עבור אותו יום,
    // נשלף ישירות מהשרת, לא מ-DOM שכבר לא קיים
    const byDay = {};
    events.forEach(ev => {
        if (!dbDaysMap.includes(ev.day_of_week)) return;
        if (!byDay[ev.day_of_week]) byDay[ev.day_of_week] = [];
        byDay[ev.day_of_week].push(ev);
    });

    for (const day of Object.keys(byDay)) {
        const { data: existingSlots } = await supabaseClient.from('weekly_schedule').select('slot_number').eq('user_id', currentUserId).eq('day_of_week', day);
        let nextSlot = (existingSlots || []).reduce((max, r) => Math.max(max, r.slot_number || 0), 0) + 1;
        const rows = byDay[day].map(ev => ({
            username: currentUsername, user_id: currentUserId, day_of_week: day,
            slot_number: nextSlot++, time_of_day: ev.time || null, task_title: ev.task_title,
        }));
        await supabaseClient.from('weekly_schedule').insert(rows);
    }
    await loadWeeklySchedule();
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
// attemptRecipeCloudScan
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

        // כפיית הבחירה המפורשת (חד-פעמי/חוזר/חוזר-כל-יום) שנבחרה בכפתורים מעל
        // תיבת הטקסט - דורסת כל ניחוש אוטומטי, ר' applyExplicitScheduleMode.
        // "חוזר כל יום" שונה במהותו מהשניים האחרים - הוא לא רק קובע recurring
        // true/false על האירוע כמות שהוא, אלא *מכפיל* כל אירוע ל-7 (אחד לכל
        // יום בשבוע), בלי קשר לאיזה יום הוזכר בפועל בטקסט - לפי בקשה מפורשת
        // ("כפתור נוסף חוזר כל יום")
        const durationMonthsInput = document.getElementById('ai-schedule-duration-months');
        const explicitDurationMonths = durationMonthsInput ? parseInt(durationMonthsInput.value) || null : null;
        if (scheduleAiMode === 'recurring-daily') {
            events = events.flatMap(ev => ev.needsClarification ? [ev] : dbDaysMap.map(day => ({
                ...ev, day_of_week: day, recurring: true, event_date: null,
                recurring_duration_months: explicitDurationMonths || null,
            })));
        } else {
            events = events.map(ev => applyExplicitScheduleMode(ev, scheduleAiMode, explicitDurationMonths));
        }

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

// --- פריסה חכמה (Smart Split, פרימיום בלבד): מפצלת משימה עם תאריך יעד
// לחלקים יומיים, פרוסים על הימים שנשארו עד (ולא כולל) תאריך היעד עצמו.
// שני שלבים: (1) תיאור המשימה + תאריך יעד, (2) שאלת הבהרה קבועה על ימים
// פנויים - שתי התשובות נשלחות יחד בקריאת AI אחת ל-split-task-ai (לא שתי
// קריאות נפרדות), ואז מוחלות כאירועי calendar_events חד-פעמיים בדיוק כמו
// applyOneTimeScheduleEvents - עריכה/מחיקה דרך אותם כפתורי X/✏️ הרגילים ---
let pendingSmartSplitTask = null;

function openSmartSplitModal() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    document.getElementById('smart-split-task-input').value = '';
    document.getElementById('smart-split-due-date-input').value = '';
    pendingSmartSplitTask = null;
    openModal('modal-smart-split-input');
}

function submitSmartSplitTaskStep() {
    const text = document.getElementById('smart-split-task-input').value.trim();
    const dueDate = document.getElementById('smart-split-due-date-input').value;
    if (!text) { showAppToast(t('smart_split_empty_error'), 'error'); return; }
    if (!dueDate) { showAppToast(t('smart_split_due_date_required_error'), 'error'); return; }
    if (dueDate <= getLocalDateString()) { showAppToast(t('smart_split_due_date_past_error'), 'error'); return; }

    pendingSmartSplitTask = { text, dueDate };
    document.getElementById('smart-split-clarify-input').value = '';
    closeModal('modal-smart-split-input');
    openModal('modal-smart-split-clarify');
}

async function attemptSmartSplit(token, text, dueDate, today, freeDaysAnswer) {
    try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/split-task-ai`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ text, dueDate, today, freeDaysAnswer })
        });
        const result = await res.json();
        if (res.status === 402 || result.error === 'premium_required') return { status: 'premium_required' };
        if (result.error === 'limit_reached') return { status: 'limit' };
        if (res.ok && !result.error && result.chunks && result.chunks.length) return { status: 'ok', chunks: result.chunks };
        return { status: 'error' };
    } catch {
        return { status: 'error' };
    }
}

async function submitSmartSplitClarify() {
    if (!pendingSmartSplitTask || !supabaseClient || !currentUserId) return;
    const freeDaysAnswer = document.getElementById('smart-split-clarify-input').value.trim();

    const submitBtn = document.getElementById('btn-smart-split-clarify-submit');
    if (submitBtn && submitBtn.disabled) return;
    if (submitBtn) submitBtn.disabled = true;

    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) { showAppToast(t('error_not_connected'), 'error'); return; }

        const { text, dueDate } = pendingSmartSplitTask;
        const today = getLocalDateString();
        const attempt = await attemptSmartSplit(token, text, dueDate, today, freeDaysAnswer);

        if (attempt.status === 'premium_required') { closeModal('modal-smart-split-clarify'); openPremiumUpgradeModal(); return; }
        if (attempt.status === 'limit') { showAppToast(t('smart_split_limit_reached'), 'error'); return; }
        if (attempt.status !== 'ok') { showAppToast(t('smart_split_error'), 'error'); return; }

        pendingSmartSplitTask = null;
        closeModal('modal-smart-split-clarify');
        const dates = await applyOneTimeScheduleEvents(attempt.chunks.map(c => ({ event_date: c.event_date, task_title: c.task_title })));
        showAppToast(t('smart_split_success_toast').replace('{count}', String(dates.length)));
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
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
            slotsHTML += `<div class="slot-input-group" data-day="${dbDay}" data-slot="${i}"><div class="slot-time-wrap"><span class="slot-drag-handle" title="${t('schedule_drag_handle_title')}">⠿</span><input type="text" value="${defaultHours[i-1] || ''}" class="slot-time" onchange="saveScheduleSlot('${dbDay}', ${i})"></div><div class="slot-task-wrap"><span class="slot-task-icon"></span><input type="text" class="slot-task" onchange="saveScheduleSlot('${dbDay}', ${i})" oninput="updateSlotTaskIcon(this)"></div><div class="slot-actions-wrap"><button class="btn-move-slot" onclick="openMoveSlotToDay('${dbDay}', ${i})" title="${t('schedule_move_slot_title')}">📅</button><button class="btn-duplicate-slot" onclick="duplicateSlotToNextDay('${dbDay}', ${i})" title="${t('schedule_duplicate_slot_title')}">⧉</button><button class="btn-delete-slot" onclick="confirmRemoveDaySlot('${dbDay}', ${i})" title="${t('schedule_remove_row_title')}">❌</button></div></div>`;
        });
        const gridHiddenClass = slotNumbers.length ? '' : ' hidden';
        // day-page-onetime: אירועים חד-פעמיים (calendar_events, כולל תוצרי "פריסה
        // חכמה") שחלים על התאריך הספציפי הזה השבוע - ממולא בנפרד ע"י
        // loadWeekOneTimeEvents, לא כאן (בניית ה-DOM כאן סינכרונית, בלי רשת) -
        // בלעדיו הם היו מופיעים רק ב"מבט ליומן"/"הצצה להיום", לא כשמסתכלים על
        // היום הספציפי הזה בתוך "השבוע שלי" עצמו, לפי בקשה מפורשת
        pageDiv.innerHTML = `<div class="day-page-header">${dateStr} | ${dayName}</div><div class="slots-grid${gridHiddenClass}">${slotsHTML}</div><div class="day-page-empty${slotNumbers.length ? ' hidden' : ''}">${t('schedule_day_empty_hint')}</div><div class="day-page-onetime" id="daypage-onetime-${dbDay}"></div><button type="button" class="btn-add-day-slot" onclick="addDaySlot('${dbDay}')">➕ ${t('schedule_add_row_btn')}</button>`;
        container.appendChild(pageDiv);
    });
    setupDayScrollObserver();
    dbDaysMap.forEach(dbDay => initScheduleRowDragReorder(dbDay));
    // גלילה אופקית בין הימים (גם רצועת הטאבים וגם עמודי הימים עצמם) עובדת
    // באופן טבעי במגע (swipe), אבל במחשב עם עכבר אין שום דרך להגיע לימים
    // שלא נכנסים בלי scroll אופקי מפורש (הפס עצמו מוסתר בכוונה, ר' scrollbar-width:none
    // ב-theme.css) - ממירים כאן גלילת עכבר אנכית רגילה לגלילה אופקית על שני
    // המכלים, לפי דיווח מפורש ("במחשב רואים עד חמישי וזהו"). מחוברת פעם אחת
    // בלבד (דגל data-wheel-scroll-bound) כי הפונקציה הזו רצה שוב בכל בנייה
    // מחדש של האקורדיון, אבל האלמנטים עצמם (רק ה-innerHTML שלהם) נשארים אותו
    // דבר - בלי הדגל היו מצטברים כמה listeners על אותו אלמנט וכל גלגול היה
    // גולל כפול/משולש
    [tabsStrip, container].forEach(el => {
        if (!el || el.dataset.wheelScrollBound) return;
        el.dataset.wheelScrollBound = 'true';
        // ב-RTL, scrollLeft "הפוך": 0 הוא הקצה הימני (ההתחלה), וגלילה קדימה
        // (לעבר ימים מאוחרים יותר) *מקטינה* אותו למספרים שליליים - בניגוד
        // ל-LTR שבו הוא רק גדל. בלי ההיפוך הזה, גלגול "קדימה" ב-RTL היה מנסה
        // לדחוף את scrollLeft לכיוון החיובי, שכבר תקוע ב-0 (הקצה) - בדיוק
        // התסמין שדווח ("לא רואה מעבר ליום חמישי", שום דבר לא זז בכלל)
        const isRtlDir = getComputedStyle(el).direction === 'rtl';
        el.addEventListener('wheel', (e) => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
                e.preventDefault();
                el.scrollLeft += (isRtlDir ? -1 : 1) * e.deltaY;
            }
        }, { passive: false });
    });

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

    // רצועת הטאבים עצמה - כדי שהטאב הפעיל תמיד יהיה בתוך התחום הנראה, לא
    // רק תוכן היום. אותה טכניקה גיאומטרית בדיוק (הפרש בין ה-rect בפועל של
    // הטאב לזה של הרצועה) - לא scrollLeft גולמי, כדי שתעבוד נכון גם ב-RTL
    // (שם scrollLeft מתחיל מ-0 בקצה הימני והולך *ופוחת* לכיוון שלילי ככל
    // שגוללים ימינה-לשמאלה, הפוך מ-LTR)
    const tabsStrip = document.getElementById('day-tabs-strip');
    const tab = document.getElementById(`daytab-${dbDay}`);
    if (tabsStrip && tab) {
        const stripRect = tabsStrip.getBoundingClientRect();
        const tabRect = tab.getBoundingClientRect();
        if (tabRect.left < stripRect.left) tabsStrip.scrollLeft += (tabRect.left - stripRect.left);
        else if (tabRect.right > stripRect.right) tabsStrip.scrollLeft += (tabRect.right - stripRect.right);
    }
}

// שני חצים גלויים משני צידי רצועת הטאבים (ר' day-tabs-strip-row ב-index.html) -
// physicalDir הוא צד *פיזי* (-1=שמאלה, 1=ימינה), לא "יום קודם/הבא" סמנטית
// (שהיה מתחלף כיוון בין RTL ל-LTR ומסבך). מוצאים את הטאב הראשון שחלקית
// מוסתר באותו צד, וגוללים בדיוק כמות שצריך כדי לחשוף אותו במלואו - לפי
// הפרש rect אמיתי, לא scrollLeft גולמי, כדי לעבוד נכון גם ב-RTL
function stepDayTabsStrip(physicalDir) {
    const tabsStrip = document.getElementById('day-tabs-strip');
    if (!tabsStrip) return;
    const stripRect = tabsStrip.getBoundingClientRect();
    const tabs = Array.from(tabsStrip.querySelectorAll('.day-tab'));
    let target;
    if (physicalDir < 0) {
        target = tabs.filter(tab => tab.getBoundingClientRect().left < stripRect.left - 1).pop();
    } else {
        target = tabs.find(tab => tab.getBoundingClientRect().right > stripRect.right + 1);
    }
    if (!target) return;
    const targetRect = target.getBoundingClientRect();
    tabsStrip.scrollLeft += physicalDir < 0 ? (targetRect.left - stripRect.left) : (targetRect.right - stripRect.right);
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

// "הצצה להיום" (today-tasks-card) יושבת על מסך הבית ממש באזור שבו אשכול
// הבועות עכשיו צף (top:56%, ר' .fab-dock ב-theme.css) - כשהיא נפתחת היא
// מתרחבת בדיוק לשם ומתנגשת חזותית איתו, לפי בקשה מפורשת מסתירים את האשכול
// כל עוד היא פתוחה (מחלקה על .phone-wrapper, אותו דפוס בדיוק כמו menu-open/
// modal-open) - שאר הכרטיסים המתקפלים באפליקציה לא נוגעים בזה, רק זו
function toggleCardSection(headerEl) {
    const card = headerEl.closest('.card');
    if (!card) return;
    card.classList.toggle('expanded');
    if (card.classList.contains('today-tasks-card')) {
        const wrapper = document.querySelector('.phone-wrapper');
        if (wrapper) wrapper.classList.toggle('today-preview-open', card.classList.contains('expanded'));
    }
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

// --- משימות להיום: תמצית מהירה של השורות המאוכלסות בלו"ז השבועי (התבנית
// החוזרת) עבור יום-השבוע הנוכחי, בתוספת אירועי calendar_events שתאריכם היום
// (בעיקר משימות שנגררו מפתקים - source='note_task', אבל בלי סינון, כדי
// שגם אירועי calendar_events "כן ליום ספציפי" של היום יופיעו כאן) - כדי
// לראות מה מתוכנן היום בלי לצאת ממבט הבית וללחוץ על לשונית "השבוע שלי".
// שאילתה עצמאית (לא תלויה ב-DOM של loadWeeklySchedule), כי שתי הפונקציות
// רצות במקביל ב-Promise.all בטעינה
async function loadTodayTasks() {
    if (!supabaseClient || !currentUserId) return;
    // נקראת מכאן (לא מכל call site שנוגע ב-calendar_events בנפרד) כדי
    // ש"השבוע שלי" תמיד יישאר מסונכרן בלי לצוד כל מקום כזה ידנית - ר' ההערה
    // על loadWeekOneTimeEvents עצמה. לפני ה-return המוקדם למטה (שתלוי בקיום
    // #today-tasks-list, לא רלוונטי כאן) כדי שתמיד תרוץ
    loadWeekOneTimeEvents();
    const container = document.getElementById('today-tasks-list');
    if (!container) return;
    const todayDbDay = dbDaysMap[new Date().getDay()];
    const todayStr = getLocalDateString();
    const [{ data, error }, { data: eventRows }, completedScheduleIds, { data: celebratedRows }] = await Promise.all([
        supabaseClient.from('weekly_schedule').select('*').eq('user_id', currentUserId).eq('day_of_week', todayDbDay),
        supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).eq('event_date', todayStr).not('source', 'in', '(today_celebrated,daily_focus_dismissed)'),
        getScheduleCompletionsForDate(todayStr),
        supabaseClient.from('calendar_events').select('id').eq('user_id', currentUserId).eq('event_date', todayStr).eq('source', 'today_celebrated').limit(1),
    ]);
    if (error || !data) return;
    const alreadyCelebratedToday = !!(celebratedRows && celebratedRows.length > 0);
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
    // סימון "מה עשיתי" - כל משימה קבועה מהלו"ז יכולה עכשיו להיות מסומנת ✓ ליום
    // הספציפי הזה בלבד (schedule_completions, מפתח על schedule_id+תאריך) - לא
    // מוחקת ולא משנה את הלו"ז החוזר עצמו, ומתאפסת מאליה במופע הבא של אותו יום
    let allDone = true;
    populated.forEach(item => {
        const isDone = completedScheduleIds.has(item.id);
        if (!isDone) allDone = false;
        const row = document.createElement('div');
        row.className = 'today-tasks-row';
        row.innerHTML = `
            <input type="checkbox" class="day-detail-checkbox"${isDone ? ' checked' : ''} onchange="toggleScheduleCompletion('${item.id}', '${todayStr}', this.checked)">
            <span class="today-tasks-time">${item.time_of_day || ''}</span>
            <span class="today-tasks-text${isDone ? ' completed' : ''}">${getScheduleTaskIcon(item.task_title)} ${escapeHtmlForReport(item.task_title)}</span>
        `;
        container.appendChild(row);
    });
    // משימות ללא שעה (בעיקר מפתקים גרורים) - מוצגות אחרי שורות השעות, עם
    // צ'קבוקס-השלמה וכפתור מחיקה, כמו בפירוט היום בלוח החודשי
    events.forEach(item => {
        if (!item.is_completed) allDone = false;
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
        editBtn.innerHTML = EDIT_ICON_SVG;
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
    // הודעת עידוד קטנה כשהכל בוצע היום - לפי בקשה מפורשת, כדי שהכרטיס לא
    // יישאר סתם עם רשימת ✓ שקטה בלי שום הכרה בזה שסיימת הכל
    if (allDone) {
        const celebration = document.createElement('p');
        celebration.className = 'today-tasks-celebration';
        celebration.textContent = t('today_tasks_all_done_message');
        container.appendChild(celebration);
        // נצנצים על פני כל האפליקציה לרגע החגיגה - רק בפעם הראשונה שמגיעים
        // ל"הכל בוצע" ביום הזה. הדגל ב-Supabase (לא localStorage) - דווח
        // שהחגיגה חוזרת שוב במחשב אחרי שכבר נראתה בנייד, אותו דפוס בדיוק
        // כמו checkDailyFocusPrompt/דגל ה-"1" על המוח.
        //
        // בעבר היה כאן גם איפוס-הדגל (מחיקה) כל פעם שנקרא עם allDone=false,
        // כדי שסבב השלמה חדש אחרי ביטול-סימון יחגוג שוב. אבל loadTodayTasks
        // נקראת מהמון מקומות באפליקציה (ר' ההערה למעלה) - כשקריאה אחת מוצאת
        // allDone=true ומכניסה את הדגל, וקריאה אחרת כמעט-בו-זמנית (על נתונים
        // מעט שונים/לא-מסונכרנים עדיין) מוצאת allDone=false ומוחקת אותו מיד -
        // הדגל אף פעם לא נשאר שמור בפועל, וכל רענון-דף חדש חוגג מחדש. הוסר
        // לגמרי כדי לחסל את התחרות הזו - המחיר: השלמה חוזרת באותו יום אחרי
        // ביטול-סימון לא תחגוג שוב, מחיר קטן מול הבאג שדווח ("כל פעם שאני
        // מרעננת זה עושה את הנצנצים")
        if (populated.length + events.length > 0 && !alreadyCelebratedToday) {
            const { error: celebrateError } = await supabaseClient.from('calendar_events').insert({
                username: currentUsername, user_id: currentUserId,
                event_title: 'today_celebrated', event_date: todayStr, source: 'today_celebrated',
            });
            if (celebrateError) console.error('today_celebrated insert failed:', celebrateError);
            else triggerAllDoneSparkles();
        }
    // עוד לא הכל בוצע - הודעת עידוד לפי כמה פעמים נפתחה הכרטיס היום, מוצגת
    // *לצד* רשימת המשימות שנשארו (לא במקומה): מ-5 פתיחות "בלי לחץ" עדינה,
    // ומ-7 פתיחות ואילך מתחלפת כל 2 פתיחות למשפט הבא במאגר (חוזרת מההתחלה
    // כשנגמר) - עד שהיום נגמר (הספירה מתאפסת מאליה למחרת) או שכל המשימות
    // מסומנות (הענף הזה כבר לא רץ בכלל, ר' if(allDone) למעלה) - לפי בקשה
    // מפורשת
    } else {
        const viewCount = getTodayCardViewCount();
        if (populated.length + events.length > 0 && viewCount >= 5) {
            const encouragement = document.createElement('p');
            encouragement.className = 'today-tasks-celebration';
            const messageKey = viewCount >= 7
                ? TODAY_TASKS_ROTATING_MESSAGE_KEYS[Math.floor((viewCount - 7) / 2) % TODAY_TASKS_ROTATING_MESSAGE_KEYS.length]
                : 'today_tasks_still_time_message';
            encouragement.textContent = t(messageKey);
            container.appendChild(encouragement);
        }
    }
}

// נצנצים חוגגים לרגע ✨ - נזרקים בהדרגה על פני שתי דקות שלמות (לא כל הכמות
// בבת אחת), כל אחד נעלם לבד בסוף האנימציה שלו (animationend). מוגבל ל.phone-wrapper
// (position:relative + overflow:hidden כבר קיימים שם) כדי שלא יגלשו החוצה
// על מסכי דסקטופ רחבים
function triggerAllDoneSparkles() {
    if (document.getElementById('all-done-sparkles')) return;
    const wrapper = document.querySelector('.phone-wrapper');
    if (!wrapper) return;
    const overlay = document.createElement('div');
    overlay.id = 'all-done-sparkles';
    overlay.className = 'all-done-sparkles';
    wrapper.appendChild(overlay);

    const emojis = ['✨', '💫', '⭐', '💜'];
    const spawnSparkle = () => {
        const sparkle = document.createElement('span');
        sparkle.className = 'all-done-sparkle';
        sparkle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        sparkle.style.left = `${Math.random() * 100}%`;
        sparkle.style.animationDuration = `${3 + Math.random() * 2.5}s`;
        sparkle.style.fontSize = `${0.7 + Math.random() * 1}rem`;
        overlay.appendChild(sparkle);
        sparkle.addEventListener('animationend', () => sparkle.remove());
    };
    const spawnTimer = setInterval(spawnSparkle, 250);
    setTimeout(() => {
        clearInterval(spawnTimer);
        setTimeout(() => overlay.remove(), 6000);
    }, 120000);
}

// סופרת כמה פעמים "הצצה להיום" נפתחה היום בפועל (מפתח כולל תאריך - מתאפס
// מאליו כל יום, בלי מנגנון איפוס נפרד) - נקראת רק מלחיצה ממשית על הכותרת
// (לא מכל loadTodayTasks שרץ מסיבות אחרות ברקע), כדי שהודעת "יש לך עוד זמן"
// (ר' loadTodayTasks) תרגיש כמו תגובה לביקור חוזר אמיתי של המשתמשת, לא
// לכל טעינה טכנית ברקע
function getTodayCardViewCount() {
    return parseInt(localStorage.getItem(`weekwise_today_card_views_${getLocalDateString()}`)) || 0;
}

function trackTodayCardExpandView(headerEl) {
    const card = headerEl.closest('.card');
    // toggleCardSection כבר הפך את המחלקה *לפני* שהקריאה הזו רצה (שתי
    // הקריאות ב-onclick, בסדר הזה) - אז אפשר לבדוק כאן אם הכרטיס נפתח או
    // נסגר; סופרים רק פתיחה בפועל, לא סגירה
    if (!card || !card.classList.contains('expanded')) return;
    const key = `weekwise_today_card_views_${getLocalDateString()}`;
    localStorage.setItem(key, String(getTodayCardViewCount() + 1));
    loadTodayTasks();
}

// --- לוח חודשי: אותו מקור נתונים בדיוק כמו "מבט ליומן" (calendar_events),
// רק בתצוגת רשת-חודש עם נקודה על כל יום שיש בו משהו, במקום רשימה ליניארית -
// לא נתונים חדשים, רק ויזואליזציה נוספת. שימוש חוזר ב-shiftMonthKey/
// formatMonthLabel/currentMonthKey שכבר קיימים עבור יעד חודשי ---
let viewedCalendarMonthKey = null;
let selectedCalendarDay = null;

// ה-+ שהיה על כרטיס "השבוע שלי" (שהוסר) - פותח את אותו חלון הוספת אירוע כמו
// ב"כל האירועים", רק ממולא מראש עם היום שנבחר בלוח (או היום אם עדיין לא
// נבחר יום) - לפי בקשה מפורשת
function openAddEventForSelectedDay() {
    resetCalendarEventModal();
    document.getElementById('calendar-event-date-input').value = selectedCalendarDay || getLocalDateString();
    updateDateFieldDisplay('calendar-event-date-input');
    openModal('modal-add-calendar-event');
}

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
    initCalendarGridDropTargets();

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
        supabaseClient.from('calendar_events').select('*').eq('user_id', currentUserId).eq('event_date', selectedCalendarDay).order('day_sort_order', { ascending: true, nullsFirst: false }),
        supabaseClient.from('weekly_schedule').select('*').eq('user_id', currentUserId).eq('day_of_week', dayOfWeek),
    ]);
    // אותו סינון בדיוק כמו ב-loadTodayTasks - משבצות בסיס ריקות (task_title
    // "") הן פנימיות בלבד, לא משימות אמיתיות, ולא אמורות להופיע כאן כשורות ריקות
    const recurringData = (recurringDataRaw || []).filter(r => (r.task_title || '').trim());
    const dayLabel = new Date(y, m - 1, d).toLocaleDateString(currentLang, { weekday: 'long', day: 'numeric', month: 'long' });
    if ((!data || !data.length) && (!recurringData || !recurringData.length)) {
        detail.innerHTML = `<div class="monthly-calendar-day-title">${dayLabel}</div><p class="today-tasks-empty">${t('today_tasks_empty_hint')}</p>`;
        return;
    }
    detail.innerHTML = `<div class="monthly-calendar-day-title">${dayLabel}</div>`;

    // בנוי עם closures (לא onclick עם מחרוזת מוטמעת) כדי ש-openEditCalendarEvent
    // תקבל את האובייקט המלא (לא רק id) - נוסף כפתור ✏️ עריכה שלא היה קיים כאן
    // עד היום (היה רק ❌ מחיקה), לפי בקשה מפורשת
    (data || []).forEach(item => {
        const row = document.createElement('div');
        row.className = 'today-tasks-row';
        row.setAttribute('data-item-id', item.id);
        row.setAttribute('data-item-type', 'event');
        const dragHandle = document.createElement('span');
        dragHandle.className = 'calendar-task-drag-handle';
        dragHandle.textContent = '⠿';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'day-detail-checkbox';
        checkbox.checked = !!item.is_completed;
        checkbox.onchange = () => toggleEventOccurrenceCompletion(item.id, checkbox.checked);
        const textSpan = document.createElement('span');
        textSpan.className = 'today-tasks-text' + (item.is_completed ? ' completed' : '');
        textSpan.textContent = item.event_title;
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-edit-item';
        editBtn.innerHTML = EDIT_ICON_SVG;
        editBtn.onclick = () => openEditCalendarEvent(item);
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-delete-item';
        deleteBtn.textContent = '❌';
        deleteBtn.onclick = () => deleteCalendarEvent(item.id);
        row.appendChild(dragHandle);
        row.appendChild(checkbox);
        row.appendChild(textSpan);
        row.appendChild(editBtn);
        row.appendChild(deleteBtn);
        detail.appendChild(row);
    });

    // המשימות הקבועות מהלו"ז השבועי מוצגות כאן בלי צ'קבוקס השלמה (הטבלה שלהן
    // לא עוקבת אחרי השלמה של מופע ספציפי, בניגוד ל-calendar_events) - רק
    // עריכה/מחיקה, דרך אותו מודל עריכה בדיוק כמו בווידג'ט השבועי במסך הבית.
    // בנוי עם closures (לא onclick עם מחרוזת מוטמעת) מאותה סיבה בדיוק כמו
    // ב-loadTodayTasks - כותרת משימה עם גרש בודד לא תשבור כלום כך
    (recurringData || []).forEach(item => {
        const row = document.createElement('div');
        row.className = 'today-tasks-row';
        row.setAttribute('data-item-id', item.id);
        row.setAttribute('data-item-type', 'recurring');
        row.innerHTML = `
            <span class="calendar-task-drag-handle">⠿</span>
            <span class="today-tasks-recurring-icon" title="${escapeHtmlForReport(t('recurring_task_tooltip'))}">🔁</span>
            <span class="today-tasks-text">${escapeHtmlForReport(item.task_title)}</span>
        `;
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'btn-edit-item';
        editBtn.innerHTML = EDIT_ICON_SVG;
        editBtn.onclick = () => openGlanceTaskEditor(item.id, item.task_title, item.time_of_day, item.day_of_week, item.reminder_minutes, item.reminder_text);
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-delete-item';
        deleteBtn.textContent = '❌';
        deleteBtn.onclick = () => deleteRecurringScheduleItem(item.id);
        row.appendChild(editBtn);
        row.appendChild(deleteBtn);
        detail.appendChild(row);
    });
    initCalendarTaskDragSource();
}

// --- גרירת משימה מרשימת הפירוט של היום הנבחר אל תא אחר בלוח החודשי, כדי
// להעביר אותה לתאריך אחר - אותו דפוס בדיוק כמו initNoteTriageDragDrop
// למעלה (Sortable עם group משותף, pull:'clone' על המקור, put:true על כל
// יעד, onAdd מסיר מיד את האלמנט שהוזרק ומפעיל עדכון משלנו ב-DB). המקור
// (#monthly-calendar-day-detail) מאותחל פעם אחת בלבד (sort:false - אין
// סידור-מחדש בתוך הרשימה עצמה, רק גרירה החוצה); תאי הלוח נבנים מחדש בכל
// ניווט בין חודשים אז חייבים להשמיד ולבנות מחדש את מופעי ה-Sortable שלהם
// בכל render (calendarGridSortables)
let calendarTaskDragSourceInitialized = false;
// sort:true (היה false) - מאפשר גם סידור-מחדש בתוך רשימת היום עצמה (גרירה
// למעלה/למטה), לא רק גרירה החוצה לתא של יום אחר - לפי בקשה מפורשת. onEnd
// מטפל רק בסידור-מחדש (evt.from===evt.to - גרירה החוצה כבר מטופלת ב-onAdd
// של תאי הלוח, ר' initCalendarGridDropTargets). day_sort_order הוא עמודה
// נפרדת מ-sort_order (המשמש את "כל האירועים" כמפתח מיון *ראשי* וגלובלי
// חוצה-תאריכים - ר' ההערה ליד displayEntries.sort) - שימוש חוזר ב-sort_order
// כאן היה "מזנק" את פריטי היום הזה לראש כל הרשימה הגלובלית, לא רק מסדר
// אותם בתוך היום. רק אירועים חד-פעמיים (data-item-type="event") נשמרים -
// משימות קבועות (recurring) עדיין ניתנות לגרירה-החוצה אבל לא לסידור-מחדש
// כאן (יחזרו למקומן היחסי אחרי הרענון), כדי לא לגעת בסמנטיקה של slot_number
function initCalendarTaskDragSource() {
    if (calendarTaskDragSourceInitialized || typeof Sortable === 'undefined') return;
    const list = document.getElementById('monthly-calendar-day-detail');
    if (!list) return;
    calendarTaskDragSourceInitialized = true;
    new Sortable(list, {
        group: { name: 'calendar-task-move', pull: 'clone', put: false },
        handle: '.calendar-task-drag-handle',
        sort: true,
        animation: 150,
        forceFallback: true,
        fallbackOnBody: true,
        dragClass: 'note-triage-drag-clone',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        onEnd: function (evt) {
            if (evt.from !== evt.to) return;
            const eventRows = Array.from(list.children).filter(el => el.getAttribute('data-item-type') === 'event');
            const updates = eventRows.map((el, index) => supabaseClient.from('calendar_events').update({ day_sort_order: (index + 1) * 10 }).eq('id', el.getAttribute('data-item-id')));
            Promise.all(updates);
        },
    });
}

let calendarGridSortables = [];
function initCalendarGridDropTargets() {
    if (typeof Sortable === 'undefined') return;
    calendarGridSortables.forEach(s => s.destroy());
    calendarGridSortables = [];
    document.querySelectorAll('#monthly-calendar-grid .monthly-calendar-cell[data-date]').forEach(cell => {
        calendarGridSortables.push(new Sortable(cell, {
            group: { name: 'calendar-task-move', pull: false, put: true },
            animation: 150,
            forceFallback: true,
            onAdd: function (evt) {
                const itemId = evt.item.getAttribute('data-item-id');
                const itemType = evt.item.getAttribute('data-item-type');
                evt.item.remove();
                moveCalendarTaskToDate(itemId, itemType, cell.getAttribute('data-date'));
            },
        }));
    });
}

async function moveCalendarTaskToDate(itemId, itemType, targetDateStr) {
    if (!supabaseClient || !itemId || !targetDateStr) return;
    if (itemType === 'event') {
        if (targetDateStr === selectedCalendarDay) return;
        await supabaseClient.from('calendar_events').update({ event_date: targetDateStr }).eq('id', itemId);
    } else if (itemType === 'recurring') {
        const [ty, tm, td] = targetDateStr.split('-').map(Number);
        const targetDay = dbDaysMap[new Date(ty, tm - 1, td).getDay()];
        const [sy, sm, sd] = (selectedCalendarDay || '').split('-').map(Number);
        const sourceDay = selectedCalendarDay ? dbDaysMap[new Date(sy, sm - 1, sd).getDay()] : null;
        if (targetDay === sourceDay) return;
        const { data: existingSlots } = await supabaseClient.from('weekly_schedule').select('slot_number').eq('user_id', currentUserId).eq('day_of_week', targetDay);
        const nextSlot = (existingSlots || []).reduce((max, r) => Math.max(max, r.slot_number || 0), 0) + 1;
        await supabaseClient.from('weekly_schedule').update({ day_of_week: targetDay, slot_number: nextSlot }).eq('id', itemId);
    } else {
        return;
    }
    showAppToast(t('calendar_task_moved_success'));
    await Promise.all([loadMonthlyCalendarGrid(), loadWeeklySchedule(), loadTodayTasks()]);
}

async function deleteRecurringScheduleItem(id) {
    if (!supabaseClient) return;
    await supabaseClient.from('weekly_schedule').delete().eq('id', id);
    await Promise.all([loadMonthlyCalendarGrid(), loadWeeklySchedule(), loadTodayTasks()]);
}

// --- מבט חודשי לקלוריות: אותו דפוס בדיוק כמו הלוח החודשי הכללי למעלה
// (loadMonthlyCalendarGrid/navigateMonthlyCalendar/selectCalendarDay), רק
// שמקור הנתונים הוא calorie_tracker - נקודה על כל יום שיש בו רישום, ולחיצה
// על יום פותחת פירוט מה נאכל בו (כל הארוחות + סה"כ). הממוצע היומי מוצג
// מעל הלוח ומחושב רק לפי ימים שבאמת נרשמו (לא כל ימי החודש - אחרת מי
// שמתחילה לעקוב באמצע החודש הייתה רואה ממוצע נמוך ומטעה) ---
let viewedCalorieMonthKey = null;
let selectedCalorieDay = null;

async function loadCalorieMonthlyCalendar() {
    if (!supabaseClient || !currentUserId) return;
    const grid = document.getElementById('calorie-monthly-calendar-grid');
    const label = document.getElementById('calorie-monthly-calendar-label');
    if (!grid || !label) return;
    if (!viewedCalorieMonthKey) viewedCalorieMonthKey = currentMonthKey();
    label.textContent = formatMonthLabel(viewedCalorieMonthKey);

    const [y, m] = viewedCalorieMonthKey.split('-').map(Number);
    const firstDate = new Date(y, m - 1, 1);
    const lastDate = new Date(y, m, 0);
    const firstStr = getLocalDateString(firstDate);
    const lastStr = getLocalDateString(lastDate);
    const { data } = await supabaseClient.from('calorie_tracker').select('date, calories').eq('user_id', currentUserId).gte('date', firstStr).lte('date', lastStr);

    const byDate = {};
    (data || []).forEach(row => { byDate[row.date] = (byDate[row.date] || 0) + (Number(row.calories) || 0); });
    const trackedDates = Object.keys(byDate);
    const avgEl = document.getElementById('calorie-monthly-avg');
    if (avgEl) {
        if (trackedDates.length) {
            const total = trackedDates.reduce((sum, d) => sum + byDate[d], 0);
            const avg = Math.round(total / trackedDates.length);
            avgEl.innerHTML = `${escapeHtmlForReport(t('calorie_monthly_avg_label'))} <strong>${avg}</strong>`;
        } else {
            avgEl.textContent = t('calorie_monthly_avg_empty');
        }
    }

    const todayStr = getLocalDateString();
    const startWeekday = firstDate.getDay();
    const daysInMonth = lastDate.getDate();

    let html = '';
    for (let i = 0; i < startWeekday; i++) html += `<div class="monthly-calendar-cell empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === selectedCalorieDay;
        const hasData = Object.prototype.hasOwnProperty.call(byDate, dateStr);
        html += `<button type="button" class="monthly-calendar-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" data-date="${dateStr}" onclick="selectCalorieCalendarDay('${dateStr}')">
            <span class="monthly-calendar-day-num">${day}</span>
            ${hasData ? '<span class="monthly-calendar-dot"></span>' : ''}
        </button>`;
    }
    grid.innerHTML = html;

    if (selectedCalorieDay && (selectedCalorieDay < firstStr || selectedCalorieDay > lastStr)) {
        selectedCalorieDay = null;
        const detail = document.getElementById('calorie-monthly-calendar-day-detail');
        if (detail) detail.innerHTML = '';
    } else if (selectedCalorieDay) {
        await renderSelectedCalorieDay();
    }
}

async function navigateCalorieMonthlyCalendar(delta) {
    const base = viewedCalorieMonthKey || currentMonthKey();
    viewedCalorieMonthKey = shiftMonthKey(base, delta);
    selectedCalorieDay = null;
    const detail = document.getElementById('calorie-monthly-calendar-day-detail');
    if (detail) detail.innerHTML = '';
    await loadCalorieMonthlyCalendar();
}

async function selectCalorieCalendarDay(dateStr) {
    selectedCalorieDay = dateStr;
    document.querySelectorAll('#calorie-monthly-calendar-grid .monthly-calendar-cell').forEach(cell => cell.classList.remove('selected'));
    const cell = document.querySelector(`#calorie-monthly-calendar-grid .monthly-calendar-cell[data-date="${dateStr}"]`);
    if (cell) cell.classList.add('selected');
    await renderSelectedCalorieDay();
}

async function renderSelectedCalorieDay() {
    const detail = document.getElementById('calorie-monthly-calendar-day-detail');
    if (!detail || !selectedCalorieDay) return;
    const [y, m, d] = selectedCalorieDay.split('-').map(Number);
    const dayLabel = new Date(y, m - 1, d).toLocaleDateString(currentLang, { weekday: 'long', day: 'numeric', month: 'long' });
    const { data } = await supabaseClient.from('calorie_tracker').select('*').eq('user_id', currentUserId).eq('date', selectedCalorieDay);
    if (!data || !data.length) {
        detail.innerHTML = `<div class="monthly-calendar-day-title">${dayLabel}</div><p class="today-tasks-empty">${t('today_tasks_empty_hint')}</p>`;
        return;
    }
    const sorted = [...data].sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.meal_type) - MEAL_TYPE_ORDER.indexOf(b.meal_type));
    let dayTotal = 0;
    const rows = sorted.map(item => {
        dayTotal += Number(item.calories) || 0;
        const labelKey = MEAL_TYPE_LABEL_KEYS[item.meal_type];
        const mealLabel = labelKey ? t(labelKey) : item.meal_type;
        return `<div class="today-tasks-row"><span class="today-tasks-text"><strong>${escapeHtmlForReport(mealLabel)}:</strong> ${escapeHtmlForReport(item.food_description || '')}</span><span class="today-tasks-time">${Number(item.calories) || 0}</span></div>`;
    }).join('');
    detail.innerHTML = `<div class="monthly-calendar-day-title">${dayLabel}</div>${rows}<div class="monthly-calendar-day-total">${escapeHtmlForReport(t('calorie_monthly_day_total_label'))} ${dayTotal}</div>`;
}

async function loadCalendarEvents() {
    if (!supabaseClient) return;
    const container = document.getElementById('calendar-glance-list');
    if (!container) return;
    // השנה מוצגת פעם אחת בקטן ליד הכותרת (לא בכל כותרת-חודש בנפרד למטה) -
    // לפי בקשה מפורשת ("לא צריך את השנה... אפשר לשים רק בקטן למעלה")
    const yearEl = document.getElementById('calendar-glance-year');
    if (yearEl) yearEl.textContent = new Date().getFullYear();
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

    // סדר תצוגה: כוכב (⭐) קודם, אחר כך לפי תאריך בלבד - לא עוד גרירה-ידנית/
    // sort_order (שהוסרה כאן, נשארת רק במבט החודשי) - לפי בקשה מפורשת אחרי
    // שדווח שהסדר "לא לפי יום": גרירה ישנה השאירה sort_order שקבע סדר-על
    // מעל התאריך בלי שהיה ברור למה. כוכב הוא עכשיו הדרך המפורשת היחידה
    // לקבוע "הכי חשוב למעלה" בלי קשר לתאריך
    const displayEntries = [];
    singleEvents.forEach(item => displayEntries.push({
        isStarred: !!item.is_starred,
        sortDate: item.event_date,
        render: () => buildSingleEventRow(item)
    }));
    seriesMap.forEach((items, groupId) => {
        items.sort((a, b) => a.event_date.localeCompare(b.event_date));
        // הסדרה כוללת גם מופעים שכבר עברו (כדי לסמן וי על ישנים, ר' ההערה
        // למעלה) - אז items[0] יכול להיות מלפני חודשים; הסדר בפועל של השורה
        // המאוחדת נקבע לפי המופע העתידי/הקרוב ביותר, לא הראשון-אי-פעם
        const nextItem = items.find(i => i.event_date >= today) || items[items.length - 1];
        displayEntries.push({
            isStarred: items.some(i => i.is_starred),
            sortDate: nextItem.event_date,
            render: () => buildRecurringEventRow(items, groupId)
        });
    });
    displayEntries.sort((a, b) => (a.isStarred !== b.isStarred ? (b.isStarred ? 1 : -1) : a.sortDate.localeCompare(b.sortDate)));
    // כותרת-חודש קטנה לפני כל קבוצת אירועים של אותו חודש - לפי בקשה מפורשת.
    // מבוססת על sortDate (התאריך שקבע את המיקום במיון), אז גם פריטים שגררו
    // ידנית קדימה עדיין מקבלים כותרת-חודש הגיונית לפי התאריך שלהם עצמם
    let lastMonthKey = null;
    displayEntries.forEach(entry => {
        const monthKey = entry.sortDate.slice(0, 7);
        if (monthKey !== lastMonthKey) {
            const monthHeader = document.createElement('div');
            monthHeader.className = 'calendar-glance-month-header';
            monthHeader.textContent = formatMonthNameOnly(monthKey);
            container.appendChild(monthHeader);
            lastMonthKey = monthKey;
        }
        container.appendChild(entry.render());
    });
}

function buildSingleEventRow(item) {
    const row = document.createElement('div');
    row.className = 'calendar-event-item';
    const starBtn = document.createElement('button');
    starBtn.className = 'calendar-event-star-btn' + (item.is_starred ? ' starred' : '');
    starBtn.textContent = item.is_starred ? '★' : '☆';
    starBtn.title = t('calendar_event_star_title');
    starBtn.onclick = () => toggleEventStar(item.id, false, !item.is_starred);
    const dateBadge = document.createElement('span');
    dateBadge.className = 'calendar-event-date-badge';
    dateBadge.textContent = formatEventDateBadge(item.event_date);
    const titleSpan = document.createElement('span');
    titleSpan.className = 'calendar-event-title-text';
    titleSpan.textContent = item.event_title;
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-edit-item';
    editBtn.innerHTML = EDIT_ICON_SVG;
    editBtn.title = t('calendar_event_edit_title');
    editBtn.onclick = () => openEditCalendarEvent(item);
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-item';
    deleteBtn.textContent = '❌';
    deleteBtn.onclick = () => deleteCalendarEvent(item.id);
    row.appendChild(starBtn);
    row.appendChild(dateBadge);
    row.appendChild(titleSpan);
    row.appendChild(editBtn);
    row.appendChild(deleteBtn);
    return row;
}

// הכוכב מחליף לגמרי את הגרירה-הידנית הישנה (sort_order/initCalendarDragReorder,
// הוסרו) - לפי בקשה מפורשת: "הסדר לא לפי תאריך" (בעיה שדווחה) קרה כי גרירה
// ישנה השאירה sort_order ידני שקבע סדר-על מעל התאריך; עכשיו הממוין היחיד
// הוא תאריך, וכוכב הוא הדרך היחידה לקבוע "הכי חשוב" למעלה בלי קשר לתאריך.
// עבור סדרה חוזרת מסמנים בכוכב את *כל* המופעים (recurrence_group_id), לא
// רק את הקרוב - כך שהשורה המאוחדת כולה "כוכבית" בעקביות
async function toggleEventStar(id, isSeries, newValue) {
    if (isSeries) await supabaseClient.from('calendar_events').update({ is_starred: newValue }).eq('recurrence_group_id', id);
    else await supabaseClient.from('calendar_events').update({ is_starred: newValue }).eq('id', id);
    await loadCalendarEvents();
}

function buildRecurringEventRow(items, groupId) {
    const wrap = document.createElement('div');
    wrap.className = 'calendar-event-series';

    // התאריך המוצג הוא תמיד המופע הקרוב ביותר *מהיום והלאה* - לא המופע
    // הראשון של הסדרה, שכבר יכול היה לעבור מזמן. items תמיד ממוין עולה לפי
    // תאריך (ר' loadCalendarEvents), אז items[0] הוא הראשון עם תאריך>=היום -
    // הסדרה מוצגת כאן רק אם יש לה לפחות מופע עתידי אחד (ר' סינון seriesMap)
    const todayStr = getLocalDateString();
    const nearestOccurrence = items.find(i => i.event_date >= todayStr) || items[items.length - 1];

    const header = document.createElement('div');
    header.className = 'calendar-event-item calendar-event-series-header';

    const isStarred = items.some(i => i.is_starred);
    const starBtn = document.createElement('button');
    starBtn.className = 'calendar-event-star-btn' + (isStarred ? ' starred' : '');
    starBtn.textContent = isStarred ? '⭐' : '☆';
    starBtn.title = t('calendar_event_star_title');
    starBtn.onclick = (e) => { e.stopPropagation(); toggleEventStar(groupId, true, !isStarred); };

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
    editBtn.innerHTML = EDIT_ICON_SVG;
    editBtn.title = t('calendar_event_edit_title');
    editBtn.onclick = () => openEditCalendarEventSeries(groupId, items[0].event_title);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-delete-item';
    deleteBtn.textContent = '❌';
    deleteBtn.onclick = () => deleteRecurringSeries(groupId);

    header.appendChild(starBtn);
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

// השלמה של משימה קבועה מהלו"ז השבועי, ליום ספציפי בלבד - בניגוד ל-calendar_events
// שיש להן עמודת is_completed על השורה עצמה, weekly_schedule מייצג משבצת חוזרת
// ללא תאריך, אז ההשלמה חייבת להתקיים בטבלה נפרדת עם מפתח (schedule_id, תאריך)
async function getScheduleCompletionsForDate(dateStr) {
    if (!supabaseClient || !currentUserId) return new Set();
    const { data } = await supabaseClient.from('schedule_completions')
        .select('schedule_id').eq('user_id', currentUserId).eq('completion_date', dateStr);
    return new Set((data || []).map(r => r.schedule_id));
}

async function toggleScheduleCompletion(scheduleId, dateStr, isCompleted) {
    if (!supabaseClient || !currentUserId) return;
    if (isCompleted) {
        await supabaseClient.from('schedule_completions').upsert(
            { user_id: currentUserId, username: currentUsername, schedule_id: scheduleId, completion_date: dateStr },
            { onConflict: 'schedule_id,completion_date' }
        );
    } else {
        await supabaseClient.from('schedule_completions').delete()
            .eq('schedule_id', scheduleId).eq('completion_date', dateStr);
    }
    loadTodayTasks();
}


// יוצר את כל תאריכי החזרה מתחילת הטווח ועד סוף מספר החודשים שנבחר, לפי יחידת
// חזרה אחידה (ימים/שבועות/חודשים) ומרווח - "כל X ימים/שבועות/חודשים" - זהו
// הבסיס למחוללי "משימות חוזרות" כמו שיעור גיטרה שבועי
function generateRecurringDates(startDateStr, unit, interval, durationMonths) {
    const dates = [];
    const start = new Date(`${startDateStr}T00:00:00`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + durationMonths);

    const step = Math.max(1, interval);
    const current = new Date(start);
    while (current <= end) {
        dates.push(getLocalDateString(current));
        if (unit === 'months') current.setMonth(current.getMonth() + step);
        else if (unit === 'days') current.setDate(current.getDate() + step);
        else current.setDate(current.getDate() + step * 7);
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
    updateDateFieldDisplay('calendar-event-date-input');
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
    document.getElementById('btn-duplicate-calendar-event').classList.remove('hidden');
    openModal('modal-add-calendar-event');
}

function openEditCalendarEventSeries(groupId, currentTitle) {
    editingCalendarEventId = null;
    editingCalendarEventGroupId = groupId;
    document.getElementById('calendar-event-title-input').value = currentTitle;
    document.getElementById('calendar-event-date-input').value = '';
    document.getElementById('calendar-event-date-trigger').classList.add('hidden');
    document.getElementById('calendar-event-time-input').value = '';
    document.getElementById('calendar-event-time-input').classList.add('hidden');
    document.getElementById('modal-add-calendar-event').querySelector('h3').textContent = t('calendar_event_edit_modal_title');
    document.getElementById('btn-add-calendar-event').textContent = t('calendar_event_update_btn');
    document.querySelector('.calendar-event-recurring-toggle').classList.add('hidden');
    document.getElementById('calendar-event-recurring-options').classList.add('hidden');
    document.getElementById('btn-delete-calendar-event').classList.add('hidden');
    document.getElementById('btn-duplicate-calendar-event').classList.add('hidden');
    openModal('modal-add-calendar-event');
}

function resetCalendarEventModal() {
    editingCalendarEventId = null;
    editingCalendarEventGroupId = null;
    document.getElementById('calendar-event-title-input').value = '';
    document.getElementById('calendar-event-date-input').value = '';
    updateDateFieldDisplay('calendar-event-date-input');
    document.getElementById('calendar-event-date-trigger').classList.remove('hidden');
    document.getElementById('calendar-event-time-input').value = '';
    document.getElementById('calendar-event-time-input').classList.remove('hidden');
    document.getElementById('calendar-event-recurring-checkbox').checked = false;
    document.getElementById('calendar-event-recur-interval').value = '1';
    document.getElementById('calendar-event-recur-unit').value = 'weeks';
    updateCustomSelectDisplay('calendar-event-recur-unit');
    updateCustomSelectDisplay('calendar-event-duration-input');
    toggleRecurringOptionsVisibility();
    document.querySelector('.calendar-event-recurring-toggle').classList.remove('hidden');
    document.getElementById('modal-add-calendar-event').querySelector('h3').textContent = t('calendar_event_modal_title');
    document.getElementById('btn-add-calendar-event').textContent = t('calendar_event_add_btn');
    document.getElementById('btn-delete-calendar-event').classList.add('hidden');
    document.getElementById('btn-duplicate-calendar-event').classList.add('hidden');
}

async function addCalendarEvent() {
    const titleInput = document.getElementById('calendar-event-title-input');
    const dateInput = document.getElementById('calendar-event-date-input');
    const recurringCheckbox = document.getElementById('calendar-event-recurring-checkbox');
    const recurIntervalInput = document.getElementById('calendar-event-recur-interval');
    const recurUnitSelect = document.getElementById('calendar-event-recur-unit');
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
        const recurUnit = recurUnitSelect.value;
        const recurInterval = parseInt(recurIntervalInput.value) || 1;
        const groupId = crypto.randomUUID();
        rows = generateRecurringDates(date, recurUnit, recurInterval, months).map(eventDate => ({
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

// שכפול - יוצר אירוע חד-פעמי חדש בתאריך שרשום בטופס כרגע, בלי לגעת/למחוק
// את האירוע המקורי שנפתח לעריכה - לפי בקשה מפורשת ("שכפול ליום אחר").
// תמיד חד-פעמי (לא מכבד את תיבת ה"חזרה" - היא ממילא מוסתרת במצב עריכה)
async function duplicateCalendarEvent() {
    const titleInput = document.getElementById('calendar-event-title-input');
    const dateInput = document.getElementById('calendar-event-date-input');
    const timeInput = document.getElementById('calendar-event-time-input');
    const title = titleInput.value.trim();
    const date = dateInput.value;
    const timeNorm = normalizeScheduleTimeInput(timeInput.value);
    if (timeInput.value.trim() && (timeNorm.time === null || timeNorm.needsAmpm)) { showAppToast(t('schedule_invalid_time_error'), 'error'); return; }
    const eventTime = timeNorm.time || null;
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    if (!title || !date) { showAppToast(t('calendar_event_missing_fields'), 'error'); return; }
    const { error } = await supabaseClient.from('calendar_events').insert({ username: currentUsername, user_id: currentUserId, event_title: title, event_date: date, event_time: eventTime, recurrence_group_id: null });
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    resetCalendarEventModal();
    closeModal('modal-add-calendar-event');
    showAppToast(t('calendar_event_duplicated_success'));
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
    updateCustomSelectDisplay('recipe-category-input');
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
    updateCustomSelectDisplay('recipe-category-input');
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
// isPremiumUser הוא הדגל המשולב שכל בדיקת-נעילה קיימת באפליקציה כבר בודקת -
// כך ש"שבוע ניסיון חינם של הכל" (לפי בקשה מפורשת) נכנס אוטומטית לכל נעילה
// קיימת בלי לגעת בעשרות מקומות; isRealPremiumUser הוא המנוי האמיתי-בתשלום
// בלבד, לשימוש רק היכן שצריך להבדיל בין "פרימיום אמיתי" ל"בתוך תקופת ניסיון"
// (הגדרות > ניהול מנוי, כדי לא להציג כפתור "בטל מנוי" למי שאין לו בפועל מה
// לבטל)
let isPremiumUser = false;
let isRealPremiumUser = false;
let selectedPremiumTier = 'semiannual';
// tier שנקרא בפועל מ-user_premium.tier (אם העמודה קיימת) - null כשאין את
// העמודה עדיין או שאין לה ערך. isDevSuperuserAccount מבדיל בין פרימיום אמיתי
// (רשומה ב-DB, ניתן לביטול) לבין עקיפת-פיתוח קבועה (אין מה לבטל)
let premiumTierFromDb = null;
let isDevSuperuserAccount = false;

// עוקף בדיקת פרימיום למפתחת בלבד, כדי לאפשר בדיקה מלאה של כל התכונות - חסום
// זהה מיושם גם בצד השרת (Edge Functions), כי בדיקת לקוח בלבד ניתנת לעקיפה
const DEV_SUPERUSER_EMAILS = ['zabarieden111@gmail.com'];

// שבוע ניסיון חינם מלא - מבוסס על תאריך יצירת החשבון עצמו (auth.users.created_at,
// לא עמודה נפרדת) כדי שלא יהיה ניתן "לאפס" אותו, ולא דורש שום מיגרציה - לפי
// בקשה מפורשת ("ניתן להם לחוות שבוע חינם של הכל")
const FREE_TRIAL_DAYS = 7;
function getFreeTrialDaysLeft() {
    if (!currentUserCreatedAt) return 0;
    const trialEndMs = new Date(currentUserCreatedAt).getTime() + FREE_TRIAL_DAYS * 86400000;
    return Math.max(0, Math.ceil((trialEndMs - Date.now()) / 86400000));
}
function isInFreeTrial() {
    return getFreeTrialDaysLeft() > 0;
}

async function loadPremiumStatus() {
    if (!supabaseClient || !currentUserId) return;
    if (DEV_SUPERUSER_EMAILS.includes((currentUsername || '').toLowerCase())) {
        isPremiumUser = true;
        isRealPremiumUser = true;
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
    isRealPremiumUser = !!(data && data.is_premium);
    isPremiumUser = isRealPremiumUser || isInFreeTrial();
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
    const trialBanner = document.getElementById('settings-trial-banner');
    // ברגע שכבר יש פרימיום *אמיתי*, אין טעם להמשיך להציג את כפתור "שדרוג
    // לפרימיום" - מוחלף בתג עדין "פרימיום פעיל" במקומו. isRealPremiumUser
    // ולא isPremiumUser בכוונה - מי שנמצא בתוך תקופת הניסיון עדיין רואה את
    // אפשרות השדרוג האמיתית (ותג ניסיון נפרד, לא תג "פעיל" מטעה)
    if (goPremiumSection) goPremiumSection.classList.toggle('hidden', isRealPremiumUser);
    if (activeBadge) activeBadge.classList.toggle('hidden', !isRealPremiumUser);
    if (trialBanner) {
        const inTrial = isPremiumUser && !isRealPremiumUser;
        trialBanner.classList.toggle('hidden', !inTrial);
        if (inTrial) trialBanner.textContent = t('settings_trial_banner').replace('{days}', String(getFreeTrialDaysLeft()));
    }
    if (!section || !statusEl || !changeBtn || !cancelBtn) return;
    if (!isRealPremiumUser) { section.classList.add('hidden'); return; }
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
    isRealPremiumUser = false;
    isPremiumUser = isInFreeTrial();
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
    updateCustomSelectDisplay('report-month-select');
    updateCustomSelectDisplay('report-year-select');
}

let reportRangeMode = 'all';
function setReportRangeMode(mode) {
    reportRangeMode = mode;
    document.querySelectorAll('#report-range-mode-toggle .ai-schedule-mode-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    document.getElementById('report-month-year-picker').classList.toggle('hidden', mode !== 'month');
    document.getElementById('report-day-picker').classList.toggle('hidden', mode !== 'day');
}

function openReportSectionPicker() {
    populateReportMonthYearSelects();
    const dayInput = document.getElementById('report-day-select');
    if (dayInput) { dayInput.value = getLocalDateString(); updateDateFieldDisplay('report-day-select'); }
    setReportRangeMode('all');
    openModal('modal-report-section-picker');
}

async function exportUserDataReport() {
    if (!supabaseClient || !currentUserId) return;
    const includeWeight = document.getElementById('report-section-weight').checked;
    const includeGoals = document.getElementById('report-section-goals').checked;
    const includeFinance = document.getElementById('report-section-finance').checked;
    const includeSport = document.getElementById('report-section-sport').checked;
    const includeWater = document.getElementById('report-section-water').checked;
    const includeCalories = document.getElementById('report-section-calories').checked;
    if (!includeWeight && !includeGoals && !includeFinance && !includeSport && !includeWater && !includeCalories) { showAppToast(t('report_picker_none_selected'), 'error'); return; }

    const isAllTime = reportRangeMode === 'all';
    let selectedMonthKey = null, rangeStart = null, rangeEndExclusive = null;
    if (reportRangeMode === 'month') {
        const month = parseInt(document.getElementById('report-month-select').value, 10);
        const year = parseInt(document.getElementById('report-year-select').value, 10);
        selectedMonthKey = `${year}-${String(month).padStart(2, '0')}`;
        rangeStart = `${selectedMonthKey}-01`;
        const nextMonth = new Date(year, month, 1); // month כאן 1-12, אז זה כבר "החודש הבא" ב-Date (0-based)
        rangeEndExclusive = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`;
    } else if (reportRangeMode === 'day') {
        const dayStr = document.getElementById('report-day-select').value;
        if (!dayStr) { showAppToast(t('report_picker_missing_day'), 'error'); return; }
        rangeStart = dayStr;
        const [y, m, d] = dayStr.split('-').map(Number);
        // חודש "הושג" רלוונטי ליום הזה - סעיף היעדים החודשיים תמיד ברמת-חודש
        // (achieved goals אין להם תאריך יומי משלהם), אז ביום ספציפי מציגים
        // את יעדי החודש שהיום הזה נמצא בו, לא מסננים ליום בודד שאין לו משמעות שם
        selectedMonthKey = `${y}-${String(m).padStart(2, '0')}`;
        const nextDay = new Date(y, m - 1, d + 1);
        rangeEndExclusive = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
    }
    closeModal('modal-report-section-picker');
    showAppToast(t('settings_export_data_preparing'));

    let weightQuery = includeWeight ? supabaseClient.from('weight_tracker').select('*').eq('user_id', currentUserId).order('weight_date', { ascending: true }) : null;
    let goalsQuery = includeGoals ? supabaseClient.from('monthly_goals').select('*').eq('user_id', currentUserId).eq('achieved', true).order('month_key', { ascending: true }) : null;
    let financeQuery = includeFinance ? supabaseClient.from('budget_tracker').select('*').eq('user_id', currentUserId).order('entry_date', { ascending: false }) : null;
    let sportQuery = includeSport ? supabaseClient.from('sport_sessions').select('*').eq('user_id', currentUserId).order('session_date', { ascending: false }) : null;
    let waterQuery = includeWater ? supabaseClient.from('water_logs').select('*').eq('user_id', currentUserId).order('log_date', { ascending: false }) : null;
    let calorieQuery = includeCalories ? supabaseClient.from('calorie_tracker').select('*').eq('user_id', currentUserId).order('date', { ascending: false }) : null;
    if (!isAllTime) {
        if (weightQuery) weightQuery = weightQuery.gte('weight_date', rangeStart).lt('weight_date', rangeEndExclusive);
        if (goalsQuery) goalsQuery = goalsQuery.eq('month_key', selectedMonthKey);
        if (financeQuery) financeQuery = financeQuery.gte('entry_date', rangeStart).lt('entry_date', rangeEndExclusive);
        if (sportQuery) sportQuery = sportQuery.gte('session_date', rangeStart).lt('session_date', rangeEndExclusive);
        if (waterQuery) waterQuery = waterQuery.gte('log_date', rangeStart).lt('log_date', rangeEndExclusive);
        if (calorieQuery) calorieQuery = calorieQuery.gte('date', rangeStart).lt('date', rangeEndExclusive);
    }

    const [{ data: weightRows }, { data: goalRows }, { data: financeRows }, { data: sportRows }, { data: waterRows }, { data: calorieRows }] = await Promise.all([
        weightQuery || Promise.resolve({ data: null }),
        goalsQuery || Promise.resolve({ data: null }),
        financeQuery || Promise.resolve({ data: null }),
        sportQuery || Promise.resolve({ data: null }),
        waterQuery || Promise.resolve({ data: null }),
        calorieQuery || Promise.resolve({ data: null }),
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
    if (includeCalories) {
        // מקובצת לפי תאריך (סה"כ ליום + פירוט כל ארוחה מתחתיו) - אותו רעיון
        // בדיוק כמו המבט החודשי החדש (renderSelectedCalorieDay), רק שכאן
        // הכל בזה אחר זה ברשימה שטוחה במקום לוח-חודש אינטראקטיבי
        const byDate = {};
        (calorieRows || []).forEach(row => {
            // מדלגים על שורות-גדם ריקות (בלי תיאור ובלי קלוריות) - נשארו
            // בעבר במסד בגלל באג ב-saveNutrition שעודכן במקום להימחק (ר'
            // התיקון שם), ובלעדי הסינון הזה יום כזה מופיע בדוח כ"0" מוזר
            // גם אחרי שהבאג עצמו כבר תוקן, כל עוד השורות הישנות עדיין קיימות
            if (!(row.food_description || '').trim() && !Number(row.calories)) return;
            if (!byDate[row.date]) byDate[row.date] = { total: 0, meals: [] };
            byDate[row.date].total += Number(row.calories) || 0;
            byDate[row.date].meals.push(row);
        });
        const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));
        const calorieHtml = dates.length
            ? dates.map(date => {
                const dayData = byDate[date];
                const mealsHtml = dayData.meals
                    .sort((a, b) => MEAL_TYPE_ORDER.indexOf(a.meal_type) - MEAL_TYPE_ORDER.indexOf(b.meal_type))
                    .map(meal => {
                        const labelKey = MEAL_TYPE_LABEL_KEYS[meal.meal_type];
                        const mealLabel = labelKey ? t(labelKey) : (meal.meal_type || '');
                        return `<div class="entry-meal-line">${escapeHtmlForReport(mealLabel)}: ${escapeHtmlForReport(meal.food_description || '')} — ${Number(meal.calories) || 0}</div>`;
                    }).join('');
                return `<div class="entry"><span class="entry-main">${new Date(date).toLocaleDateString()}</span><span class="entry-value">${dayData.total}</span></div><div class="entry-meals-wrap">${mealsHtml}</div>`;
            }).join('')
            : `<p class="empty">${escapeHtmlForReport(t('data_report_empty_section'))}</p>`;
        sectionsHtml += `<h2>${escapeHtmlForReport(t('calorie_metrics_title'))}</h2>${calorieHtml}`;
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
    /* פירוט הארוחות מתחת לשורת הסה"כ היומי (border-inline-start מתאים
       אוטומטית לכיוון LTR/RTL, בלי צורך בכלל תנאי) */
    .entry-meals-wrap { margin: -3px 0 10px 0; padding: 2px 14px; border-inline-start: 2px solid #f3d9f7; }
    .entry-meal-line { color: #6b6478; font-size: 0.82rem; padding: 3px 0; }
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
// משתני הרקע/הטקסט (ר' theme.css). מוחל קודם מיידית מ-localStorage (מטמון
// מקומי, כדי שלא יהיה "הבזק" של הצבע הלא-נכון לפני שההתחברות/הטעינה
// מה-שרת מסתיימת - ר' הקריאה הסינכרונית ב-DOMContentLoaded), ואז מסונכרן
// עם user_premium.light_mode (ר' loadLightModeSetting/toggleLightMode) כדי
// שהבחירה תעבור בין מכשירים לאותו משתמש ("משנה בנייד, במחשב לא מתחבר") -
// בדיוק אותו דפוס כמו selectColorTheme/loadColorTheme למטה.
// "!== 'false'" (לא "=== 'true'") ב-isLightModeOn - opt-out, לא opt-in -
// כדי שמשתמשות ותיקות שמעולם לא נגעו בהגדרה (ואין להן שורת user_premium
// עם light_mode מפורש) יישארו על ברירת המחדל ההיסטורית (בהיר), בלי שינוי
// בלתי-צפוי. לעומת זאת הרשמה חדשה (ר' handleAuthSubmit) כותבת light_mode:
// false במפורש ל-user_premium כבר ברגע ההרשמה - לפי בקשה מפורשת שמשתמשות
// חדשות יתחילו בערכת הנושא הראשונה על רקע כהה, ואז ישנו איך שבא להן
function isLightModeOn() {
    return localStorage.getItem('weekwise_light_mode') !== 'false';
}

function applyLightMode(enabled) {
    document.documentElement.classList.toggle('light-mode', enabled);
    const toggle = document.getElementById('light-mode-toggle');
    if (toggle) toggle.checked = enabled;
}

async function loadLightModeSetting() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('user_premium').select('light_mode').eq('user_id', currentUserId).maybeSingle();
    if (!data || data.light_mode === null || data.light_mode === undefined) return;
    localStorage.setItem('weekwise_light_mode', data.light_mode ? 'true' : 'false');
    applyLightMode(data.light_mode);
}

async function toggleLightMode() {
    const enabled = document.getElementById('light-mode-toggle').checked;
    localStorage.setItem('weekwise_light_mode', enabled ? 'true' : 'false');
    applyLightMode(enabled);
    if (supabaseClient && currentUserId) {
        const { data: existing } = await supabaseClient.from('user_premium').select('user_id').eq('user_id', currentUserId).maybeSingle();
        if (existing) await supabaseClient.from('user_premium').update({ light_mode: enabled }).eq('user_id', currentUserId);
        else await supabaseClient.from('user_premium').insert({ user_id: currentUserId, username: currentUsername, light_mode: enabled });
    }
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
    { id: 'daily_board', category: 'general' },
    { id: 'data_export_report', category: 'general' },
    { id: 'home_calorie_badge', category: 'general' },
    { id: 'drag_note_to_schedule', category: 'notes' },
    { id: 'quick_note_shopping_list', category: 'notes' },
    { id: 'quick_note_view_full_lists', category: 'notes' },
    { id: 'restore_deleted_note', category: 'notes' },
    { id: 'smart_split', category: 'notes' },
    { id: 'add_myweek_task', category: 'myweek' },
    { id: 'myweek_reminder', category: 'myweek' },
    { id: 'move_task_between_days', category: 'myweek' },
    { id: 'task_not_done_by_eod', category: 'myweek' },
    { id: 'daily_focus_prompt', category: 'glance' },
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
    { id: 'food_variety', category: 'nutrition' },
    { id: 'multi_food_separator', category: 'nutrition' },
    { id: 'restaurant_calorie_accuracy', category: 'nutrition' },
    { id: 'chain_data_source', category: 'nutrition' },
    { id: 'save_meal_preset', category: 'nutrition' },
    { id: 'quick_add_preset_fab', category: 'nutrition' },
    { id: 'quick_add_food_fab', category: 'nutrition' },
    { id: 'photo_scan_recipe', category: 'nutrition' },
    { id: 'edit_delete_nutrition_entry', category: 'nutrition' },
    { id: 'daily_nutrition_goals', category: 'nutrition' },
    { id: 'calorie_monthly_view', category: 'nutrition' },
    { id: 'calorie_stats_total_vs_average', category: 'nutrition' },
    { id: 'habits_streaks', category: 'habits' },
    { id: 'finance_ai_add', category: 'finance' },
    { id: 'finance_cycle_day', category: 'finance' },
    { id: 'finance_recurring', category: 'finance' },
    { id: 'monthly_goal_explain', category: 'goals' },
    { id: 'notifications_not_arriving', category: 'settings_a11y' },
    { id: 'toggle_fabs', category: 'settings_a11y' },
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

// כפתור צף להוספה מהירה של מים - דלוק כברירת מחדל (opt-out, לא opt-in) לפי
// בקשה מפורשת: כל מי שלא נגע בהגדרה בכלל רואה את הכפתור מיד, בדיוק כמו
// btn-preset-fab למטה - "!== 'false'" ולא "=== 'true'"
function isWaterFabOn() {
    return localStorage.getItem('weekwise_water_fab') !== 'false';
}

function applyWaterFabSetting(enabled, skipRestack) {
    const fab = document.getElementById('btn-water-fab');
    if (fab) fab.classList.toggle('hidden', !enabled);
    const toggle = document.getElementById('water-fab-toggle');
    if (toggle) toggle.checked = enabled;
    // כפתור מקביל בתוך מסך מעקב המים עצמו (לא רק בהגדרות) - נוח יותר לגלות
    // ולהפעיל/לכבות בלי לצאת מהמסך, לפי בקשה מפורשת. שני הכפתורים תמיד
    // מסונכרנים - שינוי באחד מעדכן את השני (דרך applyWaterFabSetting המשותפת)
    const shortcutBtn = document.getElementById('btn-water-fab-shortcut');
    if (shortcutBtn) shortcutBtn.textContent = enabled ? t('water_fab_shortcut_remove_btn') : t('water_fab_shortcut_add_btn');
    if (!skipRestack) restackFabs();
}

// הסדר הבסיסי של 4 הבועות הניתנות-לכיבוי (לא כולל הפתק - ר' fabCarouselOrder
// למטה, שהוא-זה שקובע את הסדר/מי-במרכז בפועל בעגלה). btn-food-fab הוסרה
// לגמרי מהרשימה - ההוספה המהירה בטקסט חופשי עברה לטאב הראשון במוח ה-AI, לפי
// בקשה מפורשת. עדיין ניתן לגרירה בהגדרות (#fab-order-list, ר'
// initFabOrderDragReorder) - קובע רק את הסדר היחסי-ביניהן כשהן נכנסות
// לעגלה, לא משפיע יותר על ה-Dock עצמו ישירות
function getFabOrder() {
    // סדר-ברירת-מחדל עודכן לפי בקשה מפורשת עם תמונת-ייחוס (מימין לשמאל:
    // פריסה, פתקים, תפוח באמצע, מים, ספורט) - ר' ההערה על allIds ב-
    // applyDockOrder למטה, ששם בפועל מוכנס btn-ai-fab (הפתק) מיד אחרי
    // btn-preset-fab (התפוח) כדי לשחזר בדיוק את הסדר הזה
    const defaultOrder = ['btn-sport-fab', 'btn-water-fab', 'btn-preset-fab', 'btn-finance-fab'];
    try {
        const saved = JSON.parse(localStorage.getItem('weekwise_fab_order'));
        if (Array.isArray(saved) && defaultOrder.every(id => saved.includes(id))) return saved;
    } catch { /* אין סדר שמור/פגום - נופלים לברירת המחדל */ }
    return defaultOrder;
}

// מיישמת את הסדר על שורות ההגדרות (#fab-order-list) - הדרך היחידה שנשארה
// להשפיע על הסדר הבסיסי; ה-Dock עצמו (fabCarouselOrder) לא תלוי בסדר ה-DOM
// יותר בכלל, רק ב-left/top שנקבעים ישירות ב-applyDockOrder
function applyFabOrder() {
    const order = getFabOrder();
    const settingsList = document.getElementById('fab-order-list');
    if (!settingsList) return;
    order.forEach(id => {
        const row = settingsList.querySelector(`[data-fab-id="${id}"]`);
        if (row) settingsList.appendChild(row);
    });
}

// מרחק קבוע בין כל שתי משבצות סמוכות בשורה - קו ישר מקצה לקצה. צומצם (74,
// לא 85) כדי שהשורה כולה תיכנס ברוחב מסך מובייל בלי לגלוש - לפי בקשה
// מפורשת שחוזרת ("זה עוד פעם טיפה יוצא מהמסך")
const FAB_ROW_STEP = 74;

// --- מצב הקרוסלה בפועל: מי נמצא איפה עכשיו (כולל הפתק!) ---
// לא נשמר ב-localStorage בעצמו (מתאפס ל-null בכל טעינה) - אבל מי שהיה
// בחזית כן נשמר בנפרד (weekwise_fab_front_id) ומוחזר לחזית בבנייה מחדש של
// המערך, ר' applyDockOrder - לפי בקשה מפורשת "שהברירת מחדל תהיה מה
// שהמשתמשת בחרה לאחרונה" (דורס החלטה קודמת שהתחילה תמיד עם הפתק בחזית)
let fabCarouselOrder = null;

// קובעת את המיקום החזותי (left/top בפיקסלים) והגודל (fab-tier-front/
// fab-tier-side - שתי רמות בלבד, לא מדורג, לפי בקשה מפורשת "שהבועה
// האמצעית תהיה פשוט יותר גדולה וכל מה שמצדדיה יהיו יותר קטנות") של כל
// הבועות בעגלה - כולל הפתק, שכבר לא נעולה תמיד במרכז (לפי בקשה מפורשת:
// "אני רוצה שהמשתמש יבחר לעצמו מה יהיה באמצע על ידי סיבוב"). כל בועה
// ממוקמת לפי המרחק (במשבצות, לא בפיקסלים) בינה לבין אמצע-המערך בפועל -
// כך שכולן על אותו קו ישר, וסיבוב (ר' rotateFabRow) פשוט מזיז את כולן
// משבצת אחת שמאלה/ימינה במקום קפיצה. מתאמת מחדש בכל קריאה את
// fabCarouselOrder מול מי שבאמת פעיל/מוסתר כרגע (toggle בהגדרות) - מוציאה
// בועה שכובתה, מוסיפה בסוף בועה שהופעלה זה עתה, בלי לאבד את שאר הסידור
function applyDockOrder() {
    // btn-ai-fab (הפתק) מוכנס מיד אחרי btn-preset-fab (התפוח) בסדר - לא
    // תמיד ראשון כמו קודם - כדי שסדר-ברירת-המחדל הטבעי (לפני כל גרירה/סיבוב)
    // יצא בדיוק "פריסה, פתקים, תפוח באמצע, מים, ספורט" לפי בקשה מפורשת עם
    // תמונת-ייחוס. לפי מיקום התפוח בפועל (לא אינדקס קבוע) כדי שזה יישאר
    // הגיוני גם אם המשתמשת משנה את סדר ה-4 הבועות הניתנות-לכיבוי בהגדרות
    const order = getFabOrder();
    const presetIdx = order.indexOf('btn-preset-fab');
    const insertAt = presetIdx === -1 ? order.length : presetIdx + 1;
    const allIds = [...order.slice(0, insertAt), 'btn-ai-fab', ...order.slice(insertAt)];
    const active = allIds.filter(id => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    });
    if (!fabCarouselOrder) {
        fabCarouselOrder = active.slice();
        // בטעינה ראשונה: לפי בקשה מפורשת ("שהברירת מחדל תהיה מה שהמשתמשת
        // בחרה לאחרונה"), לא משאירים את מי-שיוצא-בחזית לגמרי במקרה (תלוי רק
        // בסדר הבועות במערך) - במקום זה מציבים את הבועה שהייתה בחזית
        // בפעם הקודמת (נשמרה ב-weekwise_fab_front_id, ר' השמירה בסוף
        // הפונקציה) ממש במשבצת החזית, בדיוק כמו שסיום-גרירה עושה. זה דורס
        // את ההחלטה הישנה יותר ("כל טעינה מתחילה עם הפתק בחזית") - עדיין
        // עובד גם אם הבועה שנשמרה כובתה בינתיים (פשוט נופל חזרה למקום
        // הטבעי שלה במערך)
        const savedFrontId = localStorage.getItem('weekwise_fab_front_id');
        if (savedFrontId && fabCarouselOrder.includes(savedFrontId)) {
            const targetIndex = Math.round((fabCarouselOrder.length - 1) / 2);
            const idx = fabCarouselOrder.indexOf(savedFrontId);
            fabCarouselOrder.splice(idx, 1);
            fabCarouselOrder.splice(targetIndex, 0, savedFrontId);
        }
    } else {
        fabCarouselOrder = fabCarouselOrder.filter(id => active.includes(id));
        active.forEach(id => { if (!fabCarouselOrder.includes(id)) fabCarouselOrder.push(id); });
    }
    // הבועה ה"קדמית" (הגדולה) חייבת לשבת בדיוק ב-x=0 תמיד - לא "איפה שיוצא
    // הכי קרוב למרכז המתמטי" (dist=0.5 עם מספר זוגי, כמו קודם). לפי בקשה
    // מפורשת חוזרת: "אני רוצה שזה יהיה באמצע... הבועה האמצעית" - בדסקטופ
    // (מספר אי-זוגי, יש משבצת-אמצע אמיתית) זה כבר יצא נכון מעצמו, אבל
    // במובייל (מספר זוגי, למשל 4) המרכז ה"מתמטי" נופל *בין* שתי משבצות -
    // מרכוז לפי תיבה-חוסמת (הגרסה הקודמת) ריכז את השורה כולה נכון, אבל לא
    // את הבועה הגדולה עצמה, שזה בדיוק מה שדווח כבאג. הפתרון: קובעים קודם
    // איזו בועה קדמית (המשבצת הכי קרובה למרכז), ואז מודדים מרחק של *כל*
    // בועה אחרת ממנה (לא מהמרכז המתמטי) - כך שהיא, לא המרכז התאורטי, תמיד
    // ב-0 בדיוק. במספר זוגי זה יוצא א-סימטרי (יותר בועות בצד אחד) - זה
    // מחיר סביר כדי שהבועה החשובה ביותר תהיה תמיד באמת במרכז המסך
    const centerIndex = (fabCarouselOrder.length - 1) / 2;
    const frontIndex = Math.round(centerIndex);
    // style.left הוא ערך פיזי תמיד (לא הופך לפי dir כמו left/right לוגיים) -
    // בעברית/RTL אינדקס-0 (הראשון בסדר) צריך לשבת פיזית *מימין* (שם קריאה
    // מתחילה ב-RTL), ובאנגלית/LTR דווקא *משמאל* - אחרת סדר-הקריאה הסמנטי
    // ("פריסה, פתקים, תפוח, מים, ספורט") היה מתהפך בפועל כשעוברים לאנגלית
    const dirSign = document.documentElement.dir === 'ltr' ? -1 : 1;
    fabCarouselOrder.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el) return;
        const dist = (i - frontIndex) * dirSign; // 0 בדיוק עבור הבועה הקדמית עצמה
        const absDist = Math.abs(dist);
        const isFront = i === frontIndex;
        // הבועה הקדמית קיבלה עד עכשיו הרמה 0 (הכי "נמוכה" מכולן, כי הקשת
        // מתחילה ב-0 ועולה כלפי הצדדים) - לפי בקשה מפורשת ("שהבועה המרכזית
        // תהיה קצת יותר למעלה") היא מקבלת הרמה קבועה משלה, פחותה מהמקסימום
        // שהבועות הרחוקות מגיעות אליו כדי לשמור על צורת-קשת כללית
        const lift = isFront ? 14 : Math.min(absDist * 9, 30);
        el.style.left = `${Math.round(dist * FAB_ROW_STEP)}px`;
        el.style.top = `${Math.round(-lift)}px`;
        el.classList.toggle('fab-tier-front', isFront);
        el.classList.toggle('fab-tier-side', !isFront);
    });
    allIds.forEach(id => {
        if (active.includes(id)) return;
        const el = document.getElementById(id);
        if (el) { el.style.left = ''; el.style.top = ''; el.classList.remove('fab-tier-front', 'fab-tier-side'); }
    });
    // שומרים מי בחזית עכשיו כדי שהטעינה הבאה תזכור (ר' השחזור למעלה) - לא
    // רק אחרי גרירה, גם אחרי סיבוב או שינוי הגדרות שהזיז את מי שבחזית
    const currentFrontId = fabCarouselOrder[frontIndex];
    if (currentFrontId) localStorage.setItem('weekwise_fab_front_id', currentFrontId);
}

function restackFabs() {
    applyFabOrder();
    applyDockOrder();
}

// "מסובבים" את סדר הבועות בעגלה - לפי בקשה מפורשת ("כמו משחק יהיה אפשר
// לסובב וכל פעם שמסובבים אחד אחר מגיע קדימה"). מסובב את fabCarouselOrder
// עצמו (לא weekwise_fab_order - זה כבר לא הבעלים של סדר ה-Dock, ר' ההערה
// למעלה) - כל בועה, כולל הפתק, יכולה לעבור דרך משבצת 0 (קדמי)
function rotateFabRow(direction) {
    if (!fabCarouselOrder || fabCarouselOrder.length < 2) return;
    if (direction > 0) {
        fabCarouselOrder.push(fabCarouselOrder.shift());
    } else {
        fabCarouselOrder.unshift(fabCarouselOrder.pop());
    }
    applyDockOrder();
}

// גרירה ישירה - "לוקחים" בועה ספציפית וגוררים אותה בעצמה (לא את כל השורה
// יחד) ממש עם האצבע, לפי בקשה מפורשת ("אני רוצה לבחור בועה ולגרור אותה ממש
// עם האצבע שלי לאמצע - שיבוא ביחד איתי, ושלא יתחלף רנדומלית"). גרסה קודמת
// הזיזה את כל השורה יחד לפי מרחק-הגרירה הכולל וסיבבה לפי כמה "צעדים" זה
// יצא - זה לא תאם למה שהמשתמשת בפועל תפסה/גררה, ולכן הרגיש "רנדומלי".
// עכשיו: רק הבועה שנגררת בפועל זזה (בשני צירים, ממש עם האצבע), ורק אם
// היא משתחררת קרוב מספיק למרכז (FAB_ROW_STEP/2) היא הופכת לבועה הקדמית -
// אחרת היא פשוט חוזרת למקומה. תוצאה תמיד צפויה: "מה שגררתי זה מה שזז"
function initDockCarouselGestures() {
    const TAP_THRESHOLD = 10;
    document.querySelectorAll('.dock-fab').forEach(el => {
        let startX = 0, startY = 0, baseLeft = 0, baseTop = 0, dragging = false, pointerId = null, lastDx = 0, lastDy = 0;

        function onPointerMove(e) {
            if (e.pointerId !== pointerId) return;
            const dx = e.clientX - startX, dy = e.clientY - startY;
            if (!dragging && Math.hypot(dx, dy) > TAP_THRESHOLD) {
                dragging = true;
                el.classList.add('dock-fab-active-drag');
                el.style.zIndex = '10';
                baseLeft = parseFloat(el.style.left) || 0;
                baseTop = parseFloat(el.style.top) || 0;
            }
            if (dragging) {
                e.preventDefault();
                lastDx = dx;
                lastDy = dy;
                el.style.left = `${baseLeft + dx}px`;
                el.style.top = `${baseTop + dy}px`;
            }
        }
        function cleanup() {
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', onPointerUp);
            document.removeEventListener('pointercancel', onPointerCancel);
            pointerId = null;
        }
        function settle(id) {
            el.classList.remove('dock-fab-active-drag');
            el.style.zIndex = '';
            // "קרוב מספיק למרכז" - המיקום הסופי (לא רק תזוזה מהמקום המקורי)
            // חייב להיות בטווח הזה מ-x=0 כדי לזכות במקום הקדמי. הורחב מ-חצי
            // צעד (37px) ל-65% ממנו (~48px) לפי בקשה מפורשת - היה קשה מדי
            // לפגוע בול במרכז ("קשה להחליף בינהם... בקושי מתחלף")
            if (Math.abs(baseLeft + lastDx) < FAB_ROW_STEP * 0.65) {
                const centerIndex = (fabCarouselOrder.length - 1) / 2;
                const frontIndex = Math.round(centerIndex);
                const idx = fabCarouselOrder.indexOf(id);
                if (idx > -1) {
                    fabCarouselOrder.splice(idx, 1);
                    fabCarouselOrder.splice(frontIndex, 0, id);
                }
            }
            // בלי requestAnimationFrame - הבועה הזאת כבר יצאה מ-dock-fab-active-drag
            // (transition חזר לה), אז applyDockOrder יכול לכתוב left/top חדשים
            // מיד והמעבר יהיה חלק מעצמו
            applyDockOrder();
        }
        function onPointerUp(e) {
            if (e.pointerId !== pointerId) return;
            const wasDragging = dragging;
            cleanup();
            dragging = false;
            if (wasDragging) {
                el.dataset.justSwiped = '1';
                setTimeout(() => { delete el.dataset.justSwiped; }, 150);
                settle(el.id);
            }
        }
        function onPointerCancel(e) {
            if (e.pointerId !== pointerId) return;
            cleanup();
            if (dragging) { el.classList.remove('dock-fab-active-drag'); el.style.zIndex = ''; applyDockOrder(); }
            dragging = false;
        }
        el.addEventListener('pointerdown', (e) => {
            if (e.pointerType === 'mouse' && e.button !== 0) return;
            startX = e.clientX;
            startY = e.clientY;
            pointerId = e.pointerId;
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerCancel);
        });
        // חוסם רק את ה-click שמגיע מיד אחרי גרירה אמיתית - טאפ רגיל תמיד עובר
        el.addEventListener('click', (e) => {
            if (el.dataset.justSwiped) { e.preventDefault(); e.stopImmediatePropagation(); }
        }, true);
    });
}

// גרירה-לסידור-מחדש בהגדרות (#fab-order-list, ידית ⠿ ייעודית) - היחידה
// שנשארה מבוססת-Sortable; ה-Dock עצמו עבר כולו למחוות-סיבוב (ר'
// initDockCarouselGestures למעלה), בלי Sortable בכלל
function initFabOrderDragReorder() {
    if (typeof Sortable === 'undefined') return;
    const settingsList = document.getElementById('fab-order-list');
    if (settingsList) {
        new Sortable(settingsList, {
            handle: '.fab-order-drag-handle',
            animation: 150,
            forceFallback: true,
            fallbackOnBody: false,
            dragoverBubble: false,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            onEnd: () => {
                const order = Array.from(settingsList.children)
                    .map(el => el.getAttribute('data-fab-id') || el.id)
                    .filter(Boolean);
                localStorage.setItem('weekwise_fab_order', JSON.stringify(order));
                applyFabOrder();
            },
        });
    }
}

// מאפסת גם את סדר הבועות בהגדרות וגם את מצב הקרוסלה בפועל (מי במרכז עכשיו)
// - חוזרת לפתק בחזית, בדיוק כמו בטעינה ראשונה
function resetFabLayout() {
    localStorage.removeItem('weekwise_fab_order');
    // גם מוחקים את הבועה-האחרונה-שהייתה-בחזית שנשמרת בנפרד (ר'
    // weekwise_fab_front_id ב-applyDockOrder) - בלי זה "איפוס" היה עדיין
    // מחזיר את הבועה האישית שהייתה שם קודם, לא ממש חוזר לברירת המחדל הטהורה
    localStorage.removeItem('weekwise_fab_front_id');
    fabCarouselOrder = null;
    restackFabs();
    showAppToast(t('settings_reset_fab_layout_done'));
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

// כפתור צף להוספה מהירה של ספורט - דלוק כברירת מחדל (opt-out) עכשיו, לפי
// בקשה מפורשת - "!== 'false'" ולא "=== 'true'", אותו דפוס בדיוק כמו שאר
// בועות ה-Dock (בעבר זו הייתה היחידה שנשארה opt-in במפורש, זה השתנה)
function isSportFabOn() {
    return localStorage.getItem('weekwise_sport_fab') !== 'false';
}

function applySportFabSetting(enabled, skipRestack) {
    const fab = document.getElementById('btn-sport-fab');
    if (fab) fab.classList.toggle('hidden', !enabled);
    const toggle = document.getElementById('sport-fab-toggle');
    if (toggle) toggle.checked = enabled;
    const shortcutBtn = document.getElementById('btn-sport-fab-shortcut');
    if (shortcutBtn) shortcutBtn.textContent = enabled ? t('sport_fab_shortcut_remove_btn') : t('sport_fab_shortcut_add_btn');
    if (!skipRestack) restackFabs();
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

// כפתור צף להוספה מהירה של ארוחה קבועה שמורה - דלוק כברירת מחדל (opt-out),
// אותה סיבה בדיוק כמו btn-water-fab למעלה
function isPresetFabOn() {
    return localStorage.getItem('weekwise_preset_fab') !== 'false';
}

function applyPresetFabSetting(enabled, skipRestack) {
    const fab = document.getElementById('btn-preset-fab');
    if (fab) fab.classList.toggle('hidden', !enabled);
    const toggle = document.getElementById('preset-fab-toggle');
    if (toggle) toggle.checked = enabled;
    if (!skipRestack) restackFabs();
}

function togglePresetFab() {
    const enabled = document.getElementById('preset-fab-toggle').checked;
    localStorage.setItem('weekwise_preset_fab', enabled ? 'true' : 'false');
    applyPresetFabSetting(enabled);
}

// כפתור צף למעבר מהיר למסך התקציב - היה "פריסה חכמה" (מבוססת-AI, ר' ההערה
// ב-index.html) והוחלף בבועה הזו בתקציב, לפי בקשה מפורשת: תקציב נבדק בפועל
// הרבה יותר ולא צריך AI בכלל, בעוד שפריסה חכמה עדיין נגישה דרך הקובייה שלה
// במסך הראשי. דלוק כברירת מחדל (opt-out), אותה סיבה בדיוק כמו שאר בועות
// ה-Dock (כולל ספורט, שהיה opt-in בעבר ושונה לפי בקשה מפורשת)
function isFinanceFabOn() {
    return localStorage.getItem('weekwise_finance_fab') !== 'false';
}

function applyFinanceFabSetting(enabled, skipRestack) {
    const fab = document.getElementById('btn-finance-fab');
    if (fab) fab.classList.toggle('hidden', !enabled);
    const toggle = document.getElementById('finance-fab-toggle');
    if (toggle) toggle.checked = enabled;
    if (!skipRestack) restackFabs();
}

function toggleFinanceFab() {
    const enabled = document.getElementById('finance-fab-toggle').checked;
    localStorage.setItem('weekwise_finance_fab', enabled ? 'true' : 'false');
    applyFinanceFabSetting(enabled);
}

// --- ערכות נושא צבע פרימיום: כל שאר ה-CSS כבר משתמש ב-var(--accent-*), אז
// זה רק עניין של להחליף את attribute ה-data-color-theme על ה-html ---
function colorThemeKey() {
    return `weekwise_color_theme_${currentUserId}`;
}

// מדינה - נבחרת מפורשות בהגדרות (לא ניחוש לפי שפת הממשק) - כדי שערכי קלוריות
// של רשתות מזון (ר' kcalPerUnitByCountry ב-FOOD_CALORIE_DB) יידעו איזה מדינה
// להשתמש בה. ברירת מחדל ישראל, תואם לברירת המחדל הכללית של האפליקציה
function userCountryKey() {
    return `weekwise_user_country_${currentUserId}`;
}
function getUserCountry() {
    return localStorage.getItem(userCountryKey()) || 'il';
}
function setUserCountry(code) {
    localStorage.setItem(userCountryKey(), code);
    applyUserCountrySetting();
}
function applyUserCountrySetting() {
    const code = getUserCountry();
    const flagEl = document.getElementById('country-picker-flag');
    const nameEl = document.getElementById('country-picker-name');
    if (flagEl) flagEl.textContent = COUNTRY_FLAGS[code] || '🌐';
    if (nameEl) nameEl.textContent = COUNTRY_NAMES[code] || code;
}

// בורר-חיפוש למדינה - אותו דפוס בדיוק כמו openLanguagePicker/renderLanguagePickerList
// (ר' i18n.js), לפי דיווח מפורש שרשימת ה-<select> הטבעית לא קריאה
function openCountryPicker() {
    const search = document.getElementById('country-search-input');
    if (search) search.value = '';
    renderCountryPickerList('');
    openModal('modal-country-picker');
    if (search) search.focus();
}

function renderCountryPickerList(filter) {
    const list = document.getElementById('country-picker-list');
    if (!list) return;
    const query = (filter || '').trim().toLowerCase();
    const current = getUserCountry();
    const matches = COUNTRY_LIST.filter(code => COUNTRY_NAMES[code].toLowerCase().includes(query));
    if (!matches.length) {
        list.innerHTML = `<p class="language-no-results">${t('language_no_results')}</p>`;
        return;
    }
    list.innerHTML = matches.map(code => `
        <button type="button" class="language-picker-item${code === current ? ' active' : ''}" onclick="selectCountryFromPicker('${code}')">
            <span class="language-picker-flag">${COUNTRY_FLAGS[code] || '🌐'}</span>
            <span class="language-picker-name">${COUNTRY_NAMES[code]}</span>
            ${code === current ? '<span class="language-picker-check">✓</span>' : ''}
        </button>
    `).join('');
}

function selectCountryFromPicker(code) {
    setUserCountry(code);
    closeModal('modal-country-picker');
}

function applyColorTheme(themeName) {
    if (!themeName || themeName === 'default') document.documentElement.removeAttribute('data-color-theme');
    else document.documentElement.setAttribute('data-color-theme', themeName);
    document.querySelectorAll('.theme-swatch').forEach(el => {
        const isSelected = el.getAttribute('data-theme') === (themeName || 'default');
        el.classList.toggle('selected', isSelected);
        if (isSelected) {
            const grid = el.closest('.theme-cat-grid');
            if (grid) selectThemeCategory(grid.id.replace('theme-cat-grid-', ''));
        }
    });
}

function selectThemeCategory(catId) {
    document.querySelectorAll('.theme-category-chip').forEach(chip => {
        chip.classList.toggle('active', chip.getAttribute('data-cat') === catId);
    });
    document.querySelectorAll('.theme-cat-grid').forEach(grid => {
        grid.classList.toggle('active', grid.id === `theme-cat-grid-${catId}`);
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

// --- צבע טקסט אישי לכל האפליקציה (חינמי, נפרד מערכת הנושא הפרימיום למעלה):
// דורס רק --user-accent (ר' theme.css - נכנס לגדרות --accent-pink/purple/
// purple-light-text בלבד, לא לצבעים הסמנטיים כמו ירוק/אדום/זהב), כך שבחירת
// צבע אישית לא שוברת משמעות (הכנסה/הוצאה וכו'). אותו דפוס בדיוק כמו
// selectColorTheme/loadColorTheme למעלה - synced ל-user_premium כדי שתתחבר
// בין מכשירים לאותו משתמש, לפי בקשה מפורשת
let currentGlobalTextColor = null;
function applyGlobalTextColor(color) {
    currentGlobalTextColor = color;
    if (color) document.documentElement.style.setProperty('--user-accent', color);
    else document.documentElement.style.removeProperty('--user-accent');
    renderGlobalTextColorSwatches();
}

function renderGlobalTextColorSwatches() {
    const wrap = document.getElementById('global-text-color-swatches');
    if (!wrap) return;
    wrap.innerHTML = '';
    const defaultBtn = document.createElement('button');
    defaultBtn.type = 'button';
    defaultBtn.className = 'note-color-swatch note-color-swatch-default' + (!currentGlobalTextColor ? ' selected' : '');
    defaultBtn.title = t('note_text_color_default');
    defaultBtn.textContent = 'A';
    defaultBtn.onclick = () => selectGlobalTextColor(null);
    wrap.appendChild(defaultBtn);
    CENTER_ITEM_COLOR_PRESETS.forEach(color => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'note-color-swatch' + (currentGlobalTextColor === color ? ' selected' : '');
        btn.style.backgroundColor = color;
        btn.onclick = () => selectGlobalTextColor(color);
        wrap.appendChild(btn);
    });
}

async function selectGlobalTextColor(color) {
    applyGlobalTextColor(color);
    localStorage.setItem('weekwise_global_text_color', color || '');
    if (supabaseClient && currentUserId) {
        const { data: existing } = await supabaseClient.from('user_premium').select('user_id').eq('user_id', currentUserId).maybeSingle();
        if (existing) await supabaseClient.from('user_premium').update({ custom_text_color: color }).eq('user_id', currentUserId);
        else await supabaseClient.from('user_premium').insert({ user_id: currentUserId, username: currentUsername, custom_text_color: color });
    }
}

async function loadGlobalTextColor() {
    let color = null;
    if (supabaseClient && currentUserId) {
        const { data } = await supabaseClient.from('user_premium').select('custom_text_color').eq('user_id', currentUserId).maybeSingle();
        if (data && data.custom_text_color) color = data.custom_text_color;
    }
    if (!color) {
        const local = localStorage.getItem('weekwise_global_text_color');
        if (local) color = local;
    }
    applyGlobalTextColor(color);
}

// --- פונט מותאם אישית לכל האפליקציה (פרימיום): רשימה אוצרת בלבד (לא כל
// Google Fonts) - כל פונט ברשימה נבדק שתומך גם בעברית וגם בלטינית, כי
// הרוב הגדול של Google Fonts (Roboto, Poppins, Montserrat וכו') כלל לא
// כולל גליפים בעברית, מה שהיה גורם לטקסט עברי "ליפול" לפונט גיבוי בשקט
// בלי שום שגיאה - מסוכן מדי לאפליקציה שרוב השימוש בה בעברית. אותו דפוס
// בדיוק כמו openLanguagePicker/renderLanguagePickerList (חיפוש + רשימה
// מסוננת), ואותו דפוס sync כמו selectColorTheme/selectGlobalTextColor -
// synced ל-user_premium.font_family כדי שיתחבר בין מכשירים
const CURATED_FONTS = [
    'Rubik', 'Heebo', 'Assistant', 'Alef', 'Frank Ruhl Libre', 'David Libre',
    'Miriam Libre', 'Secular One', 'Suez One', 'Varela Round', 'Tinos',
    'Arimo', 'Cardo', 'Amatic SC', 'Bellefair', 'Cousine',
    'Noto Sans Hebrew', 'Noto Serif Hebrew',
    // שני פונטים "מסולסלים"/דקורטיביים נוספים, נבדקו שתומכים בעברית - לפי
    // בקשה מפורשת ("עוד כ-3 פונטים מסולסלים - גם בעברית"). פונטים עבריים
    // מסולסלים אמיתיים נדירים ב-Google Fonts (הרוב Latin-only, כולל Amiri
    // שנבדק ונפסל - Arabic בלבד, בלי שום תמיכת עברית) - אלה השניים
    // שאומתו בפועל: Noto Rashi Hebrew (חצי-מחובר, בהשראת כתב יד ספרדי),
    // Playpen Sans Hebrew (סגנון כתב-יד משוחרר)
    'Noto Rashi Hebrew', 'Playpen Sans Hebrew',
];
let fontStylesheetsLoaded = false;
let currentFontFamily = null;

function loadCuratedFontStylesheets() {
    if (fontStylesheetsLoaded) return;
    fontStylesheetsLoaded = true;
    const families = CURATED_FONTS.map(f => `family=${encodeURIComponent(f)}:wght@400;600;700`).join('&');
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    document.head.appendChild(link);
}

function applyGlobalFont(fontName) {
    currentFontFamily = fontName;
    if (fontName) {
        loadCuratedFontStylesheets();
        document.documentElement.style.setProperty('--user-font', `'${fontName}', sans-serif`);
    } else {
        document.documentElement.style.removeProperty('--user-font');
    }
    const nameEl = document.getElementById('font-picker-settings-name');
    if (nameEl) nameEl.textContent = fontName || t('font_picker_default_option');
}

function openFontPicker() {
    loadCuratedFontStylesheets();
    const search = document.getElementById('font-search-input');
    if (search) search.value = '';
    renderFontPickerList('');
    openModal('modal-font-picker');
    if (search) search.focus();
}

function renderFontPickerList(filter) {
    const list = document.getElementById('font-picker-list');
    if (!list) return;
    const query = (filter || '').trim().toLowerCase();
    const matches = CURATED_FONTS.filter(f => f.toLowerCase().includes(query));
    let html = '';
    if (!query) {
        html += `
        <button type="button" class="language-picker-item${!currentFontFamily ? ' active' : ''}" onclick="selectFontFromPicker(null)">
            <span class="language-picker-name">${t('font_picker_default_option')}</span>
            ${!currentFontFamily ? '<span class="language-picker-check">✓</span>' : ''}
        </button>`;
    }
    if (!matches.length) {
        list.innerHTML = html || `<p class="language-no-results">${t('language_no_results')}</p>`;
        return;
    }
    html += matches.map(f => `
        <button type="button" class="language-picker-item${currentFontFamily === f ? ' active' : ''}" onclick="selectFontFromPicker('${f}')">
            <span class="language-picker-name" style="font-family: '${f}', sans-serif;">${f}</span>
            ${currentFontFamily === f ? '<span class="language-picker-check">✓</span>' : ''}
        </button>
    `).join('');
    list.innerHTML = html;
}

async function selectFontFromPicker(fontName) {
    if (fontName && !isPremiumUser) { closeModal('modal-font-picker'); openPremiumUpgradeModal(); return; }
    applyGlobalFont(fontName);
    localStorage.setItem('weekwise_global_font', fontName || '');
    closeModal('modal-font-picker');
    if (supabaseClient && currentUserId) {
        const { data: existing } = await supabaseClient.from('user_premium').select('user_id').eq('user_id', currentUserId).maybeSingle();
        if (existing) await supabaseClient.from('user_premium').update({ font_family: fontName }).eq('user_id', currentUserId);
        else await supabaseClient.from('user_premium').insert({ user_id: currentUserId, username: currentUsername, font_family: fontName });
    }
}

async function loadGlobalFont() {
    let fontName = null;
    if (supabaseClient && currentUserId) {
        const { data } = await supabaseClient.from('user_premium').select('font_family').eq('user_id', currentUserId).maybeSingle();
        if (data && data.font_family) fontName = data.font_family;
    }
    if (!fontName) {
        const local = localStorage.getItem('weekwise_global_font');
        if (local) fontName = local;
    }
    if (fontName && !isPremiumUser) fontName = null;
    applyGlobalFont(fontName);
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

// בלי שנה - רק לכותרות-החודש בתוך "כל האירועים" (ר' loadCalendarEvents),
// לא לשאר השימושים ב-formatMonthLabel (ניווט חודשי/דוחות ספורט/הרגלים
// וכו', ששם השנה כן נחוצה) - השנה מוצגת פעם אחת בלבד ליד כותרת הכרטיס
// עצמה (ר' #calendar-glance-year ב-index.html), לפי בקשה מפורשת
function formatMonthNameOnly(monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString(currentLang, { month: 'long' });
}

// --- לוח שנה מותאם-אישית, בעיצוב האפליקציה - מחליף את כל שדות
// <input type="date"> באפליקציה (שהפופ-אפ הטבעי שלהם הוא UI של הדפדפן/
// מערכת ההפעלה, בלתי-אפשרי לעצב ב-CSS בכלל) - לפי בקשה מפורשת ("אני רוצה
// את זה לכל לוחות השנה"). אותו מתכון-רשת בדיוק כמו loadMonthlyCalendarGrid
// (monthly-calendar-grid/weekdays), רק כאן בוחרים תאריך במקום לצפות באירועים -
// customDatePickerCallback נקרא עם התאריך הנבחר (yyyy-mm-dd) או '' בניקוי
let customDatePickerCallback = null;
let customDatePickerViewMonth = null;
let customDatePickerSelected = null;

// פותחת/סוגרת ישירות (לא דרך openModal/closeModal הגנריים בכוונה!) - openModal
// סוגר כל .apple-modal פתוח אחר, מה שהיה סוגר בשקט את המודל שממנו נפתח שדה
// התאריך (למשל modal-note-triage-otherdate) בלי לפתוח אותו מחדש אחרי הבחירה -
// המשתמשת בחרה תאריך אבל הפתק לא זז כי המודל שהיה אמור לאשר את זה כבר נעלם.
// לוח השנה המותאם צריך רק להצטייר *מעל* המודל הקיים (z-index גבוה יותר,
// ר' .apple-modal.nested-picker-modal ב-theme.css), לא להחליף אותו
function openCustomDatePicker(currentValue, onSelect) {
    customDatePickerCallback = onSelect;
    customDatePickerSelected = currentValue || null;
    customDatePickerViewMonth = currentValue ? currentValue.slice(0, 7) : currentMonthKey();
    renderCustomDatePickerGrid();
    document.getElementById('modal-custom-date-picker').classList.add('open');
}
function closeCustomDatePickerOnly() {
    document.getElementById('modal-custom-date-picker').classList.remove('open');
}

function navigateCustomDatePicker(delta) {
    customDatePickerViewMonth = shiftMonthKey(customDatePickerViewMonth, delta);
    renderCustomDatePickerGrid();
}

function renderCustomDatePickerGrid() {
    const grid = document.getElementById('custom-date-picker-grid');
    const label = document.getElementById('custom-date-picker-label');
    if (!grid || !label) return;
    label.textContent = formatMonthLabel(customDatePickerViewMonth);
    const [y, m] = customDatePickerViewMonth.split('-').map(Number);
    const firstDate = new Date(y, m - 1, 1);
    const daysInMonth = new Date(y, m, 0).getDate();
    const startWeekday = firstDate.getDay();
    const todayStr = getLocalDateString();
    let html = '';
    for (let i = 0; i < startWeekday; i++) html += `<div class="monthly-calendar-cell empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = dateStr === todayStr;
        const isSelected = dateStr === customDatePickerSelected;
        html += `<button type="button" class="monthly-calendar-cell${isToday ? ' today' : ''}${isSelected ? ' selected' : ''}" onclick="selectCustomDate('${dateStr}')">
            <span class="monthly-calendar-day-num">${day}</span>
        </button>`;
    }
    grid.innerHTML = html;
}

function selectCustomDate(dateStr) {
    closeCustomDatePickerOnly();
    if (customDatePickerCallback) customDatePickerCallback(dateStr);
}

function customDatePickerToday() {
    selectCustomDate(getLocalDateString());
}

function customDatePickerClear() {
    closeCustomDatePickerOnly();
    if (customDatePickerCallback) customDatePickerCallback('');
}

// עוזר גנרי לחיבור כל שדה <input type="date"> קיים ללוח השנה המותאם-אישית -
// ה-input עצמו נשאר בדיוק כפי שהיה (מוסתר-ויזואלית), כך שכל קוד קיים
// שקורא/כותב .value שלו ממשיך לעבוד בלי שינוי; רק דרך הבחירה משתנה.
// מפעיל גם 'change' אמיתי על ה-input, למקרה שקוד קיים מאזין לו
function openDateFieldPicker(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    openCustomDatePicker(input.value, (date) => {
        input.value = date;
        updateDateFieldDisplay(inputId);
        input.dispatchEvent(new Event('change', { bubbles: true }));
    });
}

// מציג את התאריך הנבחר כטקסט קריא (לא ISO גולמי) בתוך span עם id
// `${inputId}-display`, אם קיים - נקרא גם בטעינה הראשונית של מודל שמכיל
// שדה כזה, כדי שערך קיים (בעריכה) יוצג נכון מיד כשהמודל נפתח
function updateDateFieldDisplay(inputId) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(`${inputId}-display`);
    if (!input || !display) return;
    if (!input.value) { display.textContent = display.getAttribute('data-placeholder') || ''; return; }
    const [y, m, d] = input.value.split('-').map(Number);
    display.textContent = new Date(y, m - 1, d).toLocaleDateString(currentLang, { day: 'numeric', month: 'short', year: 'numeric' });
}

// תפריט-נפתח מותאם אישית - מחליף את הרשימה הטבעית של <select> (לא ניתנת
// לעיצוב מלא בדפדפן דסקטופ, בעיקר Windows - שורת הבחירה תמיד בצבע המערכת),
// לפי בקשה מפורשת ("שכל אחד יהיה בערכת נושא שלו"). אותה תבנית בדיוק כמו
// openDateFieldPicker: ה-<select> המקורי נשאר בדף (מוסתר), קורא את רשימת
// ה-<option> הקיימת שלו כמו שהיא (בלי לגעת בקוד שממלא אותה - סטטי או דינמי
// כאחד), כך שכל לוגיקת מילוי/קריאה קיימת ממשיכה לעבוד בלי שום שינוי
let customSelectPickerTargetId = null;

function openCustomSelectPicker(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    customSelectPickerTargetId = selectId;
    const list = document.getElementById('custom-select-picker-list');
    list.innerHTML = '';
    Array.from(select.options).forEach(opt => {
        const row = document.createElement('button');
        row.type = 'button';
        row.className = 'preset-quick-add-item custom-select-picker-row' + (opt.value === select.value ? ' selected' : '');
        row.textContent = opt.textContent;
        row.onclick = () => selectCustomSelectOption(opt.value);
        list.appendChild(row);
    });
    // ישירות, לא דרך openModal - אותה בעיה בדיוק כמו openCustomDatePicker
    // (ר' ההערה שם): openModal סוגר כל מודל אחר שפתוח, ואם ה-select נמצא
    // בתוך מודל קיים (כמו קטגוריית מתכון בתוך modal-add-recipe), הוא היה
    // נעלם בלי לחזור אחרי הבחירה
    document.getElementById('modal-custom-select-picker').classList.add('open');
}

function selectCustomSelectOption(value) {
    const select = document.getElementById(customSelectPickerTargetId);
    if (select) {
        select.value = value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        updateCustomSelectDisplay(customSelectPickerTargetId);
    }
    document.getElementById('modal-custom-select-picker').classList.remove('open');
}

// מציג את הטקסט של האפשרות הנבחרת כרגע בתוך span עם id `${selectId}-display` -
// נקרא גם אחרי כל מילוי/שינוי דינמי של הרשימה (כמו populate מחדש מה-DB),
// כדי שהתצוגה תמיד תואמת את הערך האמיתי של ה-<select> המוסתר
function updateCustomSelectDisplay(selectId) {
    const select = document.getElementById(selectId);
    const display = document.getElementById(`${selectId}-display`);
    if (!select || !display) return;
    const opt = select.options[select.selectedIndex];
    display.textContent = opt ? opt.textContent : '';
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
                <button class="btn-edit-item" onclick="openSetMonthlyGoalModal(true)" title="${t('monthly_goal_edit_title')}">${EDIT_ICON_SVG}</button>
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
    updateCustomSelectDisplay('monthly-goal-type-input');
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
        ['entertainment', 'finance_cat_entertainment'], ['work', 'finance_cat_work'],
        ['other', 'finance_cat_other'],
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

// --- מחזור פיננסי מותאם אישית: יום ההתחלה של "החודש" לצורך סיכום/היסטוריה -
// ברירת מחדל 1 (= חודש קלנדרי רגיל, בלי שינוי התנהגות למי שלא נגע בזה) -
// לפי בקשה מפורשת ("מי שרוצה... לפי ה-10 לחודש... לפי בחירתם, למשל יום
// המשכורת"). כל שאר הלוגיקה (currentMonthKey/shiftMonthKey הכלליים,
// שמשמשים גם תכונות אחרות כמו יעד חודשי) לא משתנה בכלל - רק 4 הפונקציות
// הספציפיות לפייננס למטה (loadFinanceData/navigateFinanceMonth/
// renderFinanceSummary/renderFinanceHistory/saveFinanceTargetBudget)
// עברו להשתמש במפתח-תקופה (period key) במקום currentMonthKey ישירות
// בעבר ההגדרה הזו נשמרה רק ב-localStorage - כלומר לא סונכרנה בין מכשירים
// בכלל (למשל בין המחשב לנייד), אז בכל מכשיר "חדש" היא חזרה לברירת המחדל (1)
// גם אם כבר נבחר יום אחר במכשיר אחר - בדיוק הבאג שדווח ("תמיד מתאפס ל-1").
// עכשיו נשמרת גם ב-user_premium (כמו theme/font_family למעלה), עם localStorage
// רק בתור מטמון-מהיר לפני שהטעינה מהשרת מסתיימת. cachedFinanceCycleStartDay
// מאפשר ל-getFinanceCycleStartDay להישאר סינכרוני (נקרא מכמה פונקציות רגילות)
let cachedFinanceCycleStartDay = 1;
function getFinanceCycleStartDay() {
    return cachedFinanceCycleStartDay;
}
async function loadFinanceCycleSetting() {
    let day = 1;
    const local = parseInt(localStorage.getItem('weekwise_finance_cycle_start_day'));
    if (local >= 1 && local <= 28) day = local;
    if (supabaseClient && currentUserId) {
        const { data } = await supabaseClient.from('user_premium').select('finance_cycle_start_day').eq('user_id', currentUserId).maybeSingle();
        if (data && data.finance_cycle_start_day >= 1 && data.finance_cycle_start_day <= 28) day = data.finance_cycle_start_day;
    }
    cachedFinanceCycleStartDay = day;
    applyFinanceCycleSetting();
}
async function setFinanceCycleStartDay(day) {
    day = parseInt(day) || 1;
    cachedFinanceCycleStartDay = day;
    localStorage.setItem('weekwise_finance_cycle_start_day', String(day));
    financeSummaryMonthKey = null; // חוזרים לתקופה הנוכחית לפי ההגדרה החדשה
    Promise.all([renderFinanceSummary(), renderFinanceHistory()]);
    if (supabaseClient && currentUserId) {
        const { data: existing } = await supabaseClient.from('user_premium').select('user_id').eq('user_id', currentUserId).maybeSingle();
        if (existing) await supabaseClient.from('user_premium').update({ finance_cycle_start_day: day }).eq('user_id', currentUserId);
        else await supabaseClient.from('user_premium').insert({ user_id: currentUserId, username: currentUsername, finance_cycle_start_day: day });
    }
}
function applyFinanceCycleSetting() {
    const select = document.getElementById('finance-cycle-day-select');
    if (!select) return;
    select.value = String(getFinanceCycleStartDay());
    updateCustomSelectDisplay('finance-cycle-day-select');
}
// מפתח-תקופה = "YYYY-MM" של החודש שבו התקופה *מתחילה* - זהה למפתח-חודש
// רגיל כש-cycleStartDay===1. אם היום בחודש עדיין לפני יום ההתחלה, התקופה
// הנוכחית התחילה בפועל בחודש הקודם
function currentFinancePeriodKey() {
    const day = getFinanceCycleStartDay();
    const now = new Date();
    if (now.getDate() < day) {
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    }
    return currentMonthKey();
}
// טווח התאריכים בפועל של תקופה נתונה - זהה לחלוטין לחודש קלנדרי (1 עד סוף
// החודש) כש-cycleStartDay===1, אחרת רץ מיום ההתחלה שנבחר עד יום לפניו בחודש הבא
function getFinancePeriodRange(periodKey) {
    const day = getFinanceCycleStartDay();
    const [y, m] = periodKey.split('-').map(Number);
    return { start: getLocalDateString(new Date(y, m - 1, day)), end: getLocalDateString(new Date(y, m, day - 1)) };
}
function formatFinancePeriodLabel(periodKey) {
    if (getFinanceCycleStartDay() === 1) return formatMonthLabel(periodKey);
    const { start, end } = getFinancePeriodRange(periodKey);
    const fmt = (s) => new Date(`${s}T00:00:00`).toLocaleDateString(currentLang, { day: 'numeric', month: 'short' });
    return `${fmt(start)} - ${fmt(end)}`;
}

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
    updateCustomSelectDisplay('finance-category-select');
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
    financeSummaryMonthKey = currentFinancePeriodKey();
    populateFinanceCategoryOptions(currentFinanceEntryType);
    loadFinanceCardVisibility();
    const dateInput = document.getElementById('finance-date-input');
    if (dateInput) { dateInput.value = getLocalDateString(); updateDateFieldDisplay('finance-date-input'); }
    await Promise.all([renderFinanceSummary(), renderFinanceHistory(), loadRecurringExpenses()]);
}

// עריכת רשומה קיימת (לא רק הוספה) - אותו טופס בדיוק "הוספת הוצאה/הכנסה"
// עובר למצב עריכה (editingFinanceEntryId), בדיוק כמו editPreset/cancelPresetEdit
// למעלה בקובץ - לפי דיווח מפורש שלא הייתה בכלל אפשרות לעדכן רשומה קיימת
let editingFinanceEntryId = null;
let cachedFinanceHistoryRows = [];

async function submitFinanceEntry() {
    if (!supabaseClient || !currentUserId) return;
    const amountInput = document.getElementById('finance-amount-input');
    const noteInput = document.getElementById('finance-note-input');
    const dateInput = document.getElementById('finance-date-input');
    const categorySelect = document.getElementById('finance-category-select');
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) { showAppToast(t('finance_invalid_amount'), 'error'); return; }
    const payload = {
        entry_type: currentFinanceEntryType, amount: amount, category: categorySelect.value,
        note: noteInput.value.trim() || null, entry_date: dateInput.value || getLocalDateString(),
    };
    let error;
    if (editingFinanceEntryId) {
        ({ error } = await supabaseClient.from('budget_tracker').update(payload).eq('id', editingFinanceEntryId));
    } else {
        ({ error } = await supabaseClient.from('budget_tracker').insert({ user_id: currentUserId, username: currentUsername, ...payload }));
    }
    if (error) { showAppToast(t('finance_add_failed'), 'error'); return; }
    const wasEditing = !!editingFinanceEntryId;
    if (wasEditing) {
        cancelFinanceEntryEdit();
    } else {
        amountInput.value = '';
        noteInput.value = '';
    }
    showAppToast(wasEditing ? t('finance_update_success') : t('finance_add_success'));
    await Promise.all([renderFinanceSummary(), renderFinanceHistory()]);
}

function editFinanceEntry(id) {
    const row = cachedFinanceHistoryRows.find(r => r.id === id);
    if (!row) return;
    editingFinanceEntryId = id;
    selectFinanceEntryType(row.entry_type);
    document.getElementById('finance-amount-input').value = row.amount;
    document.getElementById('finance-category-select').value = row.category;
    updateCustomSelectDisplay('finance-category-select');
    document.getElementById('finance-note-input').value = row.note || '';
    const dateInput = document.getElementById('finance-date-input');
    dateInput.value = row.entry_date;
    updateDateFieldDisplay('finance-date-input');
    document.getElementById('btn-add-finance-entry').textContent = t('finance_update_btn');
    document.getElementById('btn-cancel-finance-edit').classList.remove('hidden');
}

function cancelFinanceEntryEdit() {
    editingFinanceEntryId = null;
    document.getElementById('finance-amount-input').value = '';
    document.getElementById('finance-note-input').value = '';
    document.getElementById('btn-add-finance-entry').textContent = t('finance_add_btn');
    document.getElementById('btn-cancel-finance-edit').classList.add('hidden');
}

// --- הוספת הוצאה/הכנסה מהירה מהכפתור הצף (modal-sport... לא, modal-finance-
// quick-add) - state ואלמנטים נפרדים לגמרי מהמסך המלא (currentFinanceEntryType/
// finance-amount-input וכו') כדי שלא יתנגשו איתם, לפי בקשה מפורשת ("בועות
// לא יעבירו לחלון אחר... בחלון קטן לרשום כמה פרטים וזהו שישלח") ---
let currentFinanceQuickType = 'expense';
function selectFinanceQuickType(type) {
    currentFinanceQuickType = type;
    document.querySelectorAll('#modal-finance-quick-add [data-finance-quick-type]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-finance-quick-type') === type);
    });
    const select = document.getElementById('finance-quick-category-select');
    if (select) select.innerHTML = FINANCE_CATEGORIES[type].map(([value, key]) => `<option value="${value}">${t(key)}</option>`).join('');
    updateCustomSelectDisplay('finance-quick-category-select');
}

function openFinanceQuickAddModal() {
    const amountInput = document.getElementById('finance-quick-amount-input');
    if (amountInput) amountInput.value = '';
    selectFinanceQuickType('expense');
    openModal('modal-finance-quick-add');
}

async function submitFinanceQuickAdd() {
    if (!supabaseClient || !currentUserId) return;
    const amountInput = document.getElementById('finance-quick-amount-input');
    const categorySelect = document.getElementById('finance-quick-category-select');
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) { showAppToast(t('finance_invalid_amount'), 'error'); return; }
    const { error } = await supabaseClient.from('budget_tracker').insert({
        user_id: currentUserId, username: currentUsername, entry_type: currentFinanceQuickType,
        amount: amount, category: categorySelect.value, note: null, entry_date: getLocalDateString(),
    });
    if (error) { showAppToast(t('finance_add_failed'), 'error'); return; }
    amountInput.value = '';
    closeModal('modal-finance-quick-add');
    showAppToast(t('finance_add_success'));
    if (document.getElementById('finance-summary-month-label')) await Promise.all([renderFinanceSummary(), renderFinanceHistory()]);
}

async function navigateFinanceMonth(delta) {
    const base = financeSummaryMonthKey || currentFinancePeriodKey();
    const target = shiftMonthKey(base, delta);
    if (target > currentFinancePeriodKey()) return;
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
    const monthKey = financeSummaryMonthKey || currentFinancePeriodKey();
    labelEl.textContent = formatFinancePeriodLabel(monthKey);
    const { start: firstStr, end: lastStr } = getFinancePeriodRange(monthKey);
    // ההוצאות הקבועות (recurring_expenses) נספרות עכשיו גם כאן, בנוסף להיסטוריה
    // הרגילה - לא כפילות, כי הן בכלל לא נכנסות ל-budget_tracker בעצמו (ר' ההערה
    // למעלה על הטבלה) - לפי בקשה מפורשת ("שתוסיף את זה לסיכום החודשי כהוצאה
    // לכל דבר"). נספרת רק הוצאה קבועה שפעילה-בחלקה בטווח התקופה המוצגת (לא
    // רק "פעילה היום"), כדי שגם ניווט לחודשים אחרים יציג סכום נכון
    const [{ data: entries }, { data: targetRow }, { data: recurringRows }] = await Promise.all([
        supabaseClient.from('budget_tracker').select('entry_type, amount')
            .eq('user_id', currentUserId).gte('entry_date', firstStr).lte('entry_date', lastStr),
        supabaseClient.from('budget_monthly_targets').select('target_amount').eq('user_id', currentUserId).eq('month_key', monthKey).maybeSingle(),
        supabaseClient.from('recurring_expenses').select('amount, start_date, end_date')
            .eq('user_id', currentUserId).lte('start_date', lastStr).or(`end_date.is.null,end_date.gte.${firstStr}`),
    ]);
    let income = 0, expense = 0;
    (entries || []).forEach(row => { if (row.entry_type === 'income') income += Number(row.amount); else expense += Number(row.amount); });
    (recurringRows || []).forEach(row => { expense += Number(row.amount); });
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
    const monthKey = financeSummaryMonthKey || currentFinancePeriodKey();
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
    const monthKey = financeSummaryMonthKey || currentFinancePeriodKey();
    const { start: firstStr, end: lastStr } = getFinancePeriodRange(monthKey);
    const { data } = await supabaseClient.from('budget_tracker').select('*')
        .eq('user_id', currentUserId).gte('entry_date', firstStr).lte('entry_date', lastStr)
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false });
    list.innerHTML = '';
    cachedFinanceHistoryRows = data || [];
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
            <button type="button" class="btn-edit-item" onclick="editFinanceEntry('${row.id}')">${EDIT_ICON_SVG}</button>
            <button type="button" class="btn-delete-slot" onclick="deleteFinanceEntry('${row.id}')">❌</button>
        `;
        list.appendChild(li);
    });
}

async function deleteFinanceEntry(id) {
    await supabaseClient.from('budget_tracker').delete().eq('id', id);
    await Promise.all([renderFinanceSummary(), renderFinanceHistory()]);
}

// --- הוצאות קבועות / הוראות קבע: טבלת תכנון נפרדת מהיסטוריית ההכנסות/הוצאות
// למעלה (budget_tracker) - לא נכנסת אליה בכלל, כדי לא לספור פעמיים הוצאה
// שגם נרשמת ידנית בכל חודש (אין כאן cron בצד שרת ש"יחייב" אוטומטית מדי חודש).
// הוספה ידנית או ייבוא מקובץ אקסל/CSV מהבנק/כרטיס אשראי, עם מיפוי עמודות ידני
// (אין דרך לדעת מראש את פורמט הייצוא של כל בנק) ותווית "מקור" אחת שחלה על כל
// הפריטים בייבוא אחד, כדי להבדיל בין כמה כרטיסים/בנקים - לפי בקשה מפורשת.
// פרימיום, לפי בקשה מפורשת ("everything premium locked") ---
let cachedRecurringExpenses = [];
let editingRecurringExpenseId = null;

async function loadRecurringExpenses() {
    if (!supabaseClient || !currentUserId) return;
    if (!isPremiumUser) { renderRecurringExpensesSection(); return; }
    const { data } = await supabaseClient.from('recurring_expenses').select('*').eq('user_id', currentUserId).order('start_date', { ascending: false });
    cachedRecurringExpenses = data || [];
    renderRecurringExpensesSection();
}

function isRecurringExpenseActive(item) {
    const today = getLocalDateString();
    if (item.start_date > today) return false;
    if (item.end_date && item.end_date < today) return false;
    return true;
}

function renderRecurringExpensesSection() {
    const container = document.getElementById('recurring-expenses-content');
    if (!container) return;
    if (!isPremiumUser) {
        container.innerHTML = `<p class="monthly-goal-empty">${t('finance_recurring_premium_hint')}</p><button class="btn-secondary" onclick="openPremiumUpgradeModal()">${t('settings_upgrade_btn')}</button>`;
        return;
    }
    const activeItems = cachedRecurringExpenses.filter(isRecurringExpenseActive);
    const monthlyTotal = activeItems.reduce((sum, item) => sum + Number(item.amount), 0);
    container.innerHTML = `
        <div class="stats-grid stats-grid-2col">
            <div class="stat-box">
                <h3>${t('finance_recurring_active_count')}</h3>
                <div class="stat-number">${activeItems.length}</div>
            </div>
            <div class="stat-box">
                <h3>${t('finance_recurring_monthly_total')}</h3>
                <div class="stat-number">${monthlyTotal.toLocaleString()}</div>
            </div>
        </div>
        <div class="preset-manager-grid" style="margin-top:10px;">
            <button type="button" class="btn-secondary" onclick="openAddRecurringExpenseModal()">${t('finance_recurring_add_btn')}</button>
            <button type="button" class="btn-secondary" onclick="openImportRecurringExpensesModal()">${t('finance_recurring_import_btn')}</button>
        </div>
        <ul id="recurring-expenses-list" class="center-list" style="margin-top:10px;"></ul>
    `;
    renderRecurringExpensesList();
}

function formatShortMonthYear(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(currentLang, { month: 'short', year: 'numeric' });
}

// הפרש בחודשים שלמים בין שני תאריכי YYYY-MM-DD (לא מדויק ליום בחודש, רק
// לחישוב "כמה תשלומים עברו מאז הייבוא") - ר' renderRecurringExpensesList
function monthsBetweenDateStrings(fromStr, toStr) {
    const [fy, fm] = fromStr.split('-').map(Number);
    const [ty, tm] = toStr.split('-').map(Number);
    return (ty - fy) * 12 + (tm - fm);
}

function renderRecurringExpensesList() {
    const list = document.getElementById('recurring-expenses-list');
    if (!list) return;
    list.innerHTML = '';
    if (!cachedRecurringExpenses.length) { list.innerHTML = `<li class="finance-history-empty">${t('finance_recurring_empty')}</li>`; return; }
    const today = getLocalDateString();
    cachedRecurringExpenses.forEach(item => {
        const ended = item.end_date && item.end_date < today;
        let badgeText;
        if (!item.end_date) badgeText = t('finance_recurring_ongoing');
        else if (ended) badgeText = t('finance_recurring_ended_on').replace('{date}', formatShortMonthYear(item.end_date));
        else badgeText = t('finance_recurring_ends_on').replace('{date}', formatShortMonthYear(item.end_date));
        // "תשלום X מתוך Y" חי - מתקדם לבד מדי חודש מאז הייבוא, בלי לגעת בטקסט
        // השם המקורי (item.name) שהמשתמשת עשויה כבר לערוך בעצמה
        let installmentBadge = '';
        if (item.installment_total) {
            const monthsElapsed = Math.max(0, monthsBetweenDateStrings(item.start_date, today));
            const liveCurrent = Math.min((item.installment_current || 1) + monthsElapsed, item.installment_total);
            installmentBadge = `<span class="recurring-expense-source-tag">${t('finance_recurring_installment_progress').replace('{current}', liveCurrent).replace('{total}', item.installment_total)}</span>`;
        }
        const li = document.createElement('li');
        li.className = 'finance-history-row' + (ended ? ' recurring-expense-ended' : '');
        li.innerHTML = `
            <div class="finance-history-main">
                <span class="finance-history-category">${escapeHtmlForReport(item.name)}</span>
                ${item.source ? `<span class="recurring-expense-source-tag">${escapeHtmlForReport(item.source)}</span>` : ''}
                ${installmentBadge}
                <span class="finance-history-date">${badgeText}</span>
            </div>
            <span class="finance-history-amount" style="color: var(--accent-red);">−${Number(item.amount).toLocaleString()}</span>
            <button type="button" class="btn-edit-item" onclick="openEditRecurringExpenseModal('${item.id}')">${EDIT_ICON_SVG}</button>
            <button type="button" class="btn-delete-item" onclick="deleteRecurringExpense('${item.id}')">❌</button>
        `;
        list.appendChild(li);
    });
}

function populateRecurringCategoryOptions() {
    const select = document.getElementById('recurring-category-select');
    if (!select) return;
    select.innerHTML = FINANCE_CATEGORIES.expense.map(([value, key]) => `<option value="${value}">${t(key)}</option>`).join('');
}

function toggleRecurringEndDateField() {
    const noEnd = document.getElementById('recurring-no-end-date-toggle').checked;
    const trigger = document.getElementById('recurring-end-date-trigger');
    trigger.classList.toggle('hidden', noEnd);
    if (noEnd) document.getElementById('recurring-end-date-input').value = '';
}

function openAddRecurringExpenseModal() {
    editingRecurringExpenseId = null;
    document.getElementById('recurring-expense-modal-title').textContent = t('finance_recurring_add_btn');
    document.getElementById('recurring-name-input').value = '';
    document.getElementById('recurring-amount-input').value = '';
    document.getElementById('recurring-source-input').value = '';
    populateRecurringCategoryOptions();
    updateCustomSelectDisplay('recurring-category-select');
    const startInput = document.getElementById('recurring-start-date-input');
    startInput.value = getLocalDateString();
    updateDateFieldDisplay('recurring-start-date-input');
    document.getElementById('recurring-end-date-input').value = '';
    updateDateFieldDisplay('recurring-end-date-input');
    document.getElementById('recurring-no-end-date-toggle').checked = true;
    toggleRecurringEndDateField();
    openModal('modal-add-recurring-expense');
}

function openEditRecurringExpenseModal(id) {
    const item = cachedRecurringExpenses.find(x => x.id === id);
    if (!item) return;
    editingRecurringExpenseId = id;
    document.getElementById('recurring-expense-modal-title').textContent = t('edit_item_title');
    document.getElementById('recurring-name-input').value = item.name;
    document.getElementById('recurring-amount-input').value = item.amount;
    document.getElementById('recurring-source-input').value = item.source || '';
    populateRecurringCategoryOptions();
    document.getElementById('recurring-category-select').value = item.category || FINANCE_CATEGORIES.expense[0][0];
    updateCustomSelectDisplay('recurring-category-select');
    const startInput = document.getElementById('recurring-start-date-input');
    startInput.value = item.start_date;
    updateDateFieldDisplay('recurring-start-date-input');
    const noEnd = !item.end_date;
    document.getElementById('recurring-no-end-date-toggle').checked = noEnd;
    document.getElementById('recurring-end-date-input').value = item.end_date || '';
    updateDateFieldDisplay('recurring-end-date-input');
    toggleRecurringEndDateField();
    openModal('modal-add-recurring-expense');
}

async function submitRecurringExpense() {
    const name = document.getElementById('recurring-name-input').value.trim();
    const amount = parseFloat(document.getElementById('recurring-amount-input').value);
    const category = document.getElementById('recurring-category-select').value || null;
    const source = document.getElementById('recurring-source-input').value.trim() || null;
    const startDate = document.getElementById('recurring-start-date-input').value || getLocalDateString();
    const noEndDate = document.getElementById('recurring-no-end-date-toggle').checked;
    const endDate = noEndDate ? null : (document.getElementById('recurring-end-date-input').value || null);
    if (!name || !amount || amount <= 0) { showAppToast(t('finance_invalid_amount'), 'error'); return; }
    const editId = editingRecurringExpenseId;
    closeModal('modal-add-recurring-expense');
    editingRecurringExpenseId = null;
    if (!supabaseClient || !currentUserId) return;
    const payload = { name, amount, category, source, start_date: startDate, end_date: endDate };
    let error;
    if (editId) {
        ({ error } = await supabaseClient.from('recurring_expenses').update(payload).eq('id', editId));
    } else {
        ({ error } = await supabaseClient.from('recurring_expenses').insert({ user_id: currentUserId, username: currentUsername, ...payload }));
    }
    if (error) { showAppToast(t('finance_recurring_add_failed'), 'error'); return; }
    showAppToast(t('finance_recurring_add_success'));
    await loadRecurringExpenses();
}

function deleteRecurringExpense(id) {
    showDangerConfirm(t('finance_recurring_delete_title'), t('finance_recurring_delete_confirm'), async () => {
        await supabaseClient.from('recurring_expenses').delete().eq('id', id);
        await loadRecurringExpenses();
    });
}

// --- ייבוא מאקסל/CSV: אחרי שגם מיפוי-עמודות-בהקשה בלבל בבדיקה בפועל ("זה
// לא מובן, תעשה את זה הרבה יותר פשוט"), הוסר לגמרי הצורך להבין "עמודות"/
// "שורות" - התוכנה מנחשת אוטומטית שם+סכום לכל שורה (המספר הגדול ביותר
// בשורה = הסכום, שאר הטקסט = השם), ומציגה רשימת סימון פשוטה: מבטלים סימון
// למה שלא רוצים, אפשר לתקן שם/סכום ישירות בשורה, ומקישים "ייבוא". שורות בלי
// שם או בלי מספר תקין (כמו כותרת דוח) נופלות אוטומטית ולא מוצגות בכלל ---
let recurringImportCandidates = []; // [{name, amount, checked}]

function openImportRecurringExpensesModal() {
    recurringImportCandidates = [];
    document.getElementById('recurring-import-file-input').value = '';
    document.getElementById('recurring-import-step1').classList.remove('hidden');
    document.getElementById('recurring-import-step2').classList.add('hidden');
    document.getElementById('recurring-import-source-input').value = '';
    openModal('modal-import-recurring-expenses');
}

function parseFlexibleAmount(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    if (typeof raw === 'number') return raw;
    const cleaned = String(raw).replace(/[^\d.\-]/g, '');
    const value = parseFloat(cleaned);
    return isNaN(value) ? null : Math.abs(value);
}

// ניחוש אוטומטי לשורה בודדת מהקובץ: התא המספרי הגדול ביותר הוא "הסכום" (כי
// בד"כ "סכום עסקה"/"סכום חיוב" קרובים זה לזה וגדולים משדות אחרים כמו קוד
// ענף), כל שאר הטקסט (לא תאריכים) מצטרף יחד כ"שם". לא מושלם, אבל זה בסדר -
// יש שלב סקירה אחריו שבו אפשר לתקן/לבטל סימון בקלות
// זיהוי "תשלום X מתוך Y" (או "X/Y", "X of Y") בטקסט - פורמט נפוץ מאוד בתיאורי
// עסקאות פריסה בכרטיסי אשראי ישראליים. אם נמצא, מחשבים תאריך סיום משוער
// (היום + מספר התשלומים שנשארו) - כדי שהסכום החודשי הכולל לא ימשיך לספור
// תשלום שכבר הסתיים בפועל, לפי בקשה מפורשת ("הסה\"כ לחודש... זה לא נכון")
// שומרים גם את המונים הגולמיים (current/total) בנוסף לתאריך הסיום, כדי
// שאפשר יהיה להציג "תשלום X מתוך Y" *חי* שמתקדם לבד מדי חודש (ר.
// renderRecurringExpensesList) - בלי לגעת בטקסט השם המקורי, שהמשתמשת
// עשויה לערוך בעצמה - לפי בקשה מפורשת ("אני מקווה שבכל חודש זה מוריד אחד")
function extractInstallmentInfo(text) {
    const m = text.match(/(\d{1,2})\s*(?:מתוך|\/|out of|of)\s*(\d{1,2})/i);
    if (!m) return null;
    const current = parseInt(m[1]), total = parseInt(m[2]);
    if (!(current >= 1 && total >= current && total <= 60)) return null;
    const remaining = total - current;
    let endDate = null;
    if (remaining > 0) {
        const d = new Date();
        d.setMonth(d.getMonth() + remaining);
        endDate = getLocalDateString(d);
    }
    return { current, total, endDate };
}

function autoExtractRecurringRow(row) {
    let amount = null;
    const textParts = [];
    row.forEach(cell => {
        if (cell === undefined || cell === null || cell === '') return;
        if (cell instanceof Date) return;
        if (typeof cell === 'number') {
            if (amount === null || Math.abs(cell) > amount) amount = Math.abs(cell);
            return;
        }
        const str = String(cell).trim();
        if (/^[\d,.\s₪$]+$/.test(str) && /\d/.test(str)) {
            const val = parseFlexibleAmount(str);
            if (val !== null) { if (amount === null || val > amount) amount = val; return; }
        }
        textParts.push(str);
    });
    const name = textParts.join(' ').trim();
    const installment = extractInstallmentInfo(name);
    return {
        name, amount,
        endDate: installment ? installment.endDate : null,
        installmentCurrent: installment ? installment.current : null,
        installmentTotal: installment ? installment.total : null,
    };
}

async function handleRecurringImportFileSelected(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = '';
    if (!file) return;
    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
        const candidates = [];
        rows.forEach(row => {
            if (!row || !row.length) return;
            const extracted = autoExtractRecurringRow(row);
            if (extracted.name && extracted.amount) candidates.push({ name: extracted.name, amount: extracted.amount, endDate: extracted.endDate, installmentCurrent: extracted.installmentCurrent, installmentTotal: extracted.installmentTotal, checked: true });
        });
        if (!candidates.length) { showAppToast(t('finance_recurring_import_failed'), 'error'); return; }
        recurringImportCandidates = candidates;
        document.getElementById('recurring-import-step1').classList.add('hidden');
        document.getElementById('recurring-import-step2').classList.remove('hidden');
        renderRecurringImportReviewList();
    } catch (e) {
        showAppToast(t('finance_recurring_import_failed'), 'error');
    }
}

function renderRecurringImportReviewList() {
    const list = document.getElementById('recurring-import-review-list');
    if (!list) return;
    list.innerHTML = recurringImportCandidates.map((item, i) => `
        <li class="finance-history-row">
            <input type="checkbox" class="import-review-checkbox" ${item.checked ? 'checked' : ''} onchange="toggleRecurringImportCandidate(${i}, this.checked)">
            <div class="finance-history-main">
                <input type="text" class="import-review-name-input" value="${escapeHtmlForReport(item.name)}" onchange="updateRecurringImportCandidateName(${i}, this.value)">
                ${item.endDate ? `<span class="finance-history-date">${t('finance_recurring_import_end_detected').replace('{date}', formatShortMonthYear(item.endDate))}</span>` : ''}
            </div>
            <input type="number" class="import-review-amount-input" value="${item.amount}" onchange="updateRecurringImportCandidateAmount(${i}, this.value)">
        </li>
    `).join('');
    updateRecurringImportConfirmLabel();
}

function toggleRecurringImportCandidate(i, checked) {
    recurringImportCandidates[i].checked = checked;
    updateRecurringImportConfirmLabel();
}

function updateRecurringImportCandidateName(i, val) {
    recurringImportCandidates[i].name = val.trim();
}

function updateRecurringImportCandidateAmount(i, val) {
    recurringImportCandidates[i].amount = parseFloat(val) || 0;
}

function updateRecurringImportConfirmLabel() {
    const btn = document.getElementById('btn-confirm-recurring-import');
    if (!btn) return;
    const count = recurringImportCandidates.filter(c => c.checked).length;
    btn.textContent = `${t('finance_recurring_import_confirm_btn')} (${count})`;
}

async function confirmRecurringExpenseImport() {
    if (!supabaseClient || !currentUserId) return;
    const source = document.getElementById('recurring-import-source-input').value.trim() || null;
    const selected = recurringImportCandidates.filter(c => c.checked && c.name && c.amount > 0);
    if (!selected.length) { showAppToast(t('finance_recurring_import_failed'), 'error'); return; }
    const payloads = selected.map(c => ({
        user_id: currentUserId, username: currentUsername, name: c.name, amount: c.amount, category: null, source,
        start_date: getLocalDateString(), end_date: c.endDate || null,
        installment_current: c.installmentCurrent || null, installment_total: c.installmentTotal || null,
    }));
    const { error } = await supabaseClient.from('recurring_expenses').insert(payloads);
    if (error) { showAppToast(t('finance_recurring_import_failed'), 'error'); return; }
    closeModal('modal-import-recurring-expenses');
    showAppToast(t('finance_recurring_import_success').replace('{count}', String(payloads.length)));
    await loadRecurringExpenses();
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
    if (dateInput) { dateInput.value = getLocalDateString(); updateDateFieldDisplay('sport-date-input'); }
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

// --- רישום אימון מהיר מהכפתור הצף - סוג+משך בלבד, בלי מרחק/הערות/תמונה/
// מוטיבציה. state ואלמנטים נפרדים לגמרי מהמסך המלא (currentSportType/
// sport-duration-input וכו') כדי שלא יתנגשו איתם - אותה סיבה בדיוק כמו
// submitFinanceQuickAdd למעלה ---
let currentSportQuickType = 'running';
function selectSportQuickType(type) {
    currentSportQuickType = type;
    document.querySelectorAll('#sport-quick-type-picker [data-sport-quick-type]').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('data-sport-quick-type') === type);
    });
    const customInput = document.getElementById('sport-quick-custom-type-input');
    if (customInput) customInput.classList.toggle('hidden', type !== 'custom');
}

function openSportQuickAddModal() {
    const durationInput = document.getElementById('sport-quick-duration-input');
    if (durationInput) durationInput.value = '';
    const customInput = document.getElementById('sport-quick-custom-type-input');
    if (customInput) customInput.value = '';
    selectSportQuickType('running');
    openModal('modal-sport-quick-add');
}

async function submitSportQuickAdd() {
    if (!supabaseClient || !currentUserId) return;
    const durationInput = document.getElementById('sport-quick-duration-input');
    const customInput = document.getElementById('sport-quick-custom-type-input');
    const isCustom = currentSportQuickType === 'custom';
    const customName = isCustom ? customInput.value.trim() : null;
    if (isCustom && !customName) { showAppToast(t('sport_missing_custom_name'), 'error'); return; }
    const duration = parseInt(durationInput.value) || null;
    if (!duration) { showAppToast(t('sport_missing_duration'), 'error'); return; }
    const { error } = await supabaseClient.from('sport_sessions').insert({
        user_id: currentUserId, username: currentUsername, sport_type: currentSportQuickType,
        custom_type_name: customName, duration_minutes: duration, distance_km: null,
        motivation: null, session_date: getLocalDateString(), notes: null, photo_url: null,
    });
    if (error) { showAppToast(t('sport_add_failed'), 'error'); return; }
    closeModal('modal-sport-quick-add');
    showAppToast(t('sport_add_success'));
    if (document.getElementById('sport-summary-next-btn')) await Promise.all([renderSportSummary(), renderSportHistory()]);
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
    updateCustomSelectDisplay('recipe-category-input');
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
        updateCustomSelectDisplay('recipe-category-input');
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
            updateCustomSelectDisplay('recipe-category-input');
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
    closeModal('modal-ai-brain');
    openAddRecipeForm();
    await runRecipeImageScan(file);
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
    // מרקים נוספים - נתונים מדויקים מהמשתמשת (לא הערכת AI). "מרק צח" חייב
    // לבוא *לפני* "מרק עוף" למטה - "מרק עוף זך" מכיל "מרק עוף" כתת-מחרוזת,
    // ובלי סדר הפוך הוא תמיד היה נתפס כמרק עוף רגיל (40 קל') במקום צח (20 קל')
    { name: "מרק צח", re: /מרק צח|מרק עוף זך|clear soup|broth soup/i, kcal100g: 20, unitGrams: 250 },
    { name: "מרק כתומים", re: /מרק (כתומים|גזר|בטטה)|pumpkin soup|carrot soup|sweet potato soup/i, kcal100g: 40, unitGrams: 250 },
    { name: "מרק מוקרם", re: /מרק מוקרם|creamy soup|cream soup/i, kcal100g: 85, unitGrams: 250 },
    { name: "ציר", re: /ציר (מרוכז|עוף|בקר|ירקות)|broth concentrate|stock concentrate/i, kcal100g: 15, unitGrams: 20 },
    { name: "אבקת מרק", re: /אבקת מרק|soup powder/i, kcal100g: 275 },
    { name: "משחת מיסו", re: /משחת מיסו|miso paste/i, kcal100g: 200, unitGrams: 15 },
    { name: "מנה חמה יבשה למרק", re: /מנה חמה יבשה|מרק נמס|instant soup/i, kcalPerUnit: 55 },
    { name: "מרק עוף", re: /מרק עוף|chicken soup/i, kcal100g: 40, unitGrams: 250 },
    { name: "מרק ירקות", re: /מרק ירקות|vegetable soup/i, kcal100g: 35, unitGrams: 250 },
    { name: "מרק עדשים", re: /מרק עדשים|lentil soup/i, kcal100g: 80, unitGrams: 250 },
    { name: "מרק פטריות", re: /מרק פטריות|mushroom soup/i, kcal100g: 60, unitGrams: 250 },
    { name: "מרק עגבניות", re: /מרק עגבניות|tomato soup/i, kcal100g: 35, unitGrams: 250 },
    { name: "מרק דלעת", re: /מרק דלעת|pumpkin soup|squash soup/i, kcal100g: 45, unitGrams: 250 },
    { name: "מרק בצל", re: /מרק בצל|onion soup/i, kcal100g: 50, unitGrams: 250 },
    // עודכן מ-40 ל-18 לפי נתון מדויק מהמשתמשת (15-20 קל' ל-100 מ"ל, מרק דליל)
    { name: "מרק מיסו", re: /מרק מיסו|miso soup/i, kcal100g: 18, unitGrams: 200 },
    // מרק כללי (סוג לא מזוהה) - חייב לבוא *אחרי* כל הסוגים הספציפיים למעלה
    { name: "מרק", re: /מרק|\bsoup\b/i, kcal100g: 45, unitGrams: 250 },
    // קינוחים נוספים - לפי בקשה מפורשת. "מוס" גם כאן למעלה (לא ליד עוגה/עוגיות
    // בהמשך הרשימה) מאותה סיבה בדיוק כמו המרקים: "מוס שוקולד" מכיל "שוקולד",
    // שמוגדר בהמשך הרשימה - בלי סדר הפוך היה תמיד נתפס כשוקולד רגיל (546 קל')
    { name: "פודינג", re: /פודינג|pudding/i, kcal100g: 140, unitGrams: 120 },
    { name: "מוס", re: /מוס(?!ד)|mousse/i, kcal100g: 250, unitGrams: 100 },
    // גביעי ופל לגלידה - חייבים לבוא *לפני* "וופל" הכללי (מתחת), אחרת "גביע
    // ופל"/"קונוס" תמיד היו נתפסים כוופל בלגי רגיל (291 קל') במקום כאביזר-
    // גלידה קליל בהרבה. המצופה שוקולד לפני הפשוט, כי "גביע ופל...שוקולד" מכיל
    // גם את הביטוי של הפשוט - צריך את הספציפי יותר קודם
    { name: "גביע ופל מצופה שוקולד", re: /גביע ופל.*שוקולד|קונוס.*שוקולד/i, kcalPerUnit: 120 },
    { name: "גביע וופל גולדה", re: /גביע וופל.*גולדה|גולדה.*גביע וופל/i, kcalPerUnit: 60 },
    { name: "גביע ופל", re: /גביע ופל|קונוס פריך|וופל אמריקאי לגלידה/i, kcalPerUnit: 70 },
    // וופלים מותגיים - חייבים לבוא *לפני* וופל הכללי למטה, מכילים "וופל"/
    // "wafer" כתת-מחרוזת (נתונים מדויקים מהמשתמשת)
    { name: "וופל לואקר נאפוליטנה", re: /לואקר.*נאפוליטנה|loacker.*napolitaner/i, kcal100g: 520, unitGrams: 10 },
    { name: "וופל לואקר קקאו/שוקולד", re: /לואקר.*(קקאו|שוקולד)/i, kcal100g: 510, unitGrams: 10 },
    { name: "וופל לואקר טורטינה", re: /לואקר.*טורטינה|loacker.*tortina/i, kcal100g: 547, unitGrams: 21 },
    { name: "וופל לואקר גרדנה", re: /לואקר.*גרדנה|loacker.*gardena/i, kcal100g: 526, unitGrams: 38 },
    { name: "וופל עלית שוקולד", re: /וופל עלית.*שוקולד|עלית.*וופל.*שוקולד/i, kcal100g: 500, unitGrams: 10 },
    { name: "וופל עלית לימון", re: /וופל עלית.*לימון|עלית.*וופל.*לימון/i, kcal100g: 480, unitGrams: 10 },
    { name: "וופל בלגי עם שוקולד/נוטלה", re: /וופל בלגי.*(שוקולד|נוטלה)/i, kcal100g: 423, unitGrams: 85 },
    { name: "וופל בלגי", re: /וופל בלגי|belgian waffle/i, kcal100g: 400, unitGrams: 60 },
    { name: "וופל שטוח ממולא", re: /וופל שטוח ממולא|ואפל מעטפת/i, kcal100g: 500, unitGrams: 30 },
    { name: "Nilla Wafers", re: /nilla wafers?/i, kcal100g: 466, unitGrams: 30 },
    { name: "Haitai Butter Waffle", re: /haitai/i, kcal100g: 481, unitGrams: 13.5 },
    { name: "וופל", re: /וופל|waffle/i, kcal100g: 291, unitGrams: 75 },
    { name: "חלבה", re: /חלבה|halva/i, kcal100g: 520, unitGrams: 30 },
    { name: "קרם קרמל/פלאן", re: /קרם קרמל|פלאן|crème caramel|creme caramel|\bflan\b/i, kcal100g: 120, unitGrams: 100 },
    // חטיפים ומתוקים בינלאומיים (צפון אמריקה/אירופה/אסיה/אוסטרליה) - כל
    // הבלוק הזה חייב לבוא *לפני* כמה ערכים כלליים בהמשך שהיו בולעים אותם
    // בטעות: בראוני, אורז, בננה, שוקולד, חלב, בוטנים, נורי, שרימפס, קרקר/
    // ביסקוויט, תפוצ'יפס - כולם מכילים מילה כללית שמופיעה גם בשמות המותגים
    // האלה (נתונים מדויקים מהמשתמשת: יחידה/מנה + קלוריות ליחידה + 100 גרם)
    { name: "Lays", re: /\blays\b/i, kcal100g: 571, unitGrams: 28 },
    { name: "Doritos Nacho Cheese", re: /doritos nacho cheese|nacho cheese doritos/i, kcal100g: 535, unitGrams: 28 },
    { name: "Cheetos Crunchy", re: /cheetos crunchy/i, kcal100g: 571, unitGrams: 28 },
    { name: "Ruffles", re: /\bruffles\b/i, kcal100g: 571, unitGrams: 28 },
    { name: "Takis", re: /\btakis\b/i, kcal100g: 500, unitGrams: 28 },
    { name: "Tostitos", re: /\btostitos\b/i, kcal100g: 500, unitGrams: 28 },
    { name: "Walkers Shortbread Fingers", re: /walkers shortbread/i, kcal100g: 530, unitGrams: 20 },
    { name: "Walkers", re: /\bwalkers\b/i, kcal100g: 528, unitGrams: 25 },
    { name: "Monster Munch", re: /monster munch/i, kcal100g: 490, unitGrams: 20 },
    { name: "Curly Peanut Rings", re: /curly (peanut )?rings?/i, kcal100g: 533, unitGrams: 30 },
    { name: "Brets", re: /\bbrets\b/i, kcal100g: 526, unitGrams: 30 },
    { name: "Calbee Potato Chips", re: /calbee potato chips/i, kcal100g: 550, unitGrams: 30 },
    { name: "Nori Seaweed Snacks", re: /nori seaweed( snacks?)?|seaweed snacks?/i, kcal100g: 500, unitGrams: 5 },
    { name: "Shrimp Crackers", re: /shrimp crackers|nongshim/i, kcal100g: 500, unitGrams: 30 },
    { name: "Calbee Shrimp Chips", re: /calbee shrimp chips/i, kcal100g: 493, unitGrams: 30 },
    { name: "Cheez-It", re: /cheez.?it/i, kcal100g: 500, unitGrams: 30 },
    { name: "Goldfish Crackers", re: /goldfish crackers?/i, kcal100g: 466, unitGrams: 30 },
    { name: "Snyder's Pretzel", re: /snyder'?s pretzel/i, kcal100g: 500, unitGrams: 28 },
    { name: "Hula Hoops", re: /hula hoops?/i, kcal100g: 504, unitGrams: 24 },
    { name: "Tuc Crackers", re: /\btuc\b/i, kcal100g: 488, unitGrams: 12.5 },
    { name: "Chio Chips", re: /chio chips/i, kcal100g: 540, unitGrams: 30 },
    { name: "Jagabee", re: /jagabee/i, kcal100g: 575, unitGrams: 16 },
    { name: "Kettle Brand/Chips", re: /kettle (brand|chips)/i, kcal100g: 535, unitGrams: 28 },
    { name: "Tyrells", re: /tyrells/i, kcal100g: 515, unitGrams: 40 },
    { name: "Lorenz Crunchips", re: /lorenz|crunchips/i, kcal100g: 536, unitGrams: 30 },
    { name: "Shapes (Arnott's)", re: /\bshapes\b.*(barbecue|arnott)|arnott'?s shapes/i, kcal100g: 488, unitGrams: 25 },
    { name: "Fritos", re: /\bfritos\b/i, kcal100g: 571, unitGrams: 28 },
    { name: "Bugles", re: /\bbugles\b/i, kcal100g: 533, unitGrams: 30 },
    { name: "הרשיז שוקולד חלב", re: /hershey'?s milk chocolate|hershey'?s bar/i, kcal100g: 497, unitGrams: 43 },
    { name: "Butterfinger", re: /butterfinger/i, kcal100g: 471, unitGrams: 53 },
    { name: "Baby Ruth", re: /baby ruth/i, kcal100g: 466, unitGrams: 59 },
    { name: "Cadbury Crunchie", re: /cadbury crunchie|crunchie bar/i, kcal100g: 465, unitGrams: 40 },
    { name: "Cadbury Dairy Milk", re: /cadbury/i, kcal100g: 533, unitGrams: 45 },
    { name: "Stroopwafel", re: /stroopwafel/i, kcal100g: 450, unitGrams: 30 },
    { name: "KEX Choklad", re: /kex choklad/i, kcal100g: 490, unitGrams: 55 },
    { name: "Pocky", re: /\bpocky\b/i, kcal100g: 500, unitGrams: 40 },
    { name: "Hi-Chew", re: /hi.?chew/i, kcal100g: 400, unitGrams: 5 },
    { name: "Lotte Choco Pie", re: /choco pie/i, kcal100g: 464, unitGrams: 28 },
    { name: "Tim Tam", re: /tim tam/i, kcal100g: 527, unitGrams: 18 },
    { name: "Flipz", re: /\bflipz\b/i, kcal100g: 466, unitGrams: 30 },
    { name: "PayDay", re: /\bpayday\b/i, kcal100g: 461, unitGrams: 52 },
    { name: "3 Musketeers", re: /3\s*musketeers/i, kcal100g: 444, unitGrams: 54 },
    { name: "Kinder Country", re: /kinder country/i, kcal100g: 561, unitGrams: 23.5 },
    { name: "Kinder Happy Hippo", re: /happy hippo/i, kcal100g: 589, unitGrams: 20.7 },
    { name: "Kinder Choco Bons", re: /choco bons|schoko.?bons/i, kcal100g: 576, unitGrams: 6 },
    { name: "Lion Bar", re: /lion bar/i, kcal100g: 481, unitGrams: 42 },
    { name: "Daim Bar", re: /daim bar|\bdaim\b/i, kcal100g: 535, unitGrams: 28 },
    { name: "Smarties", re: /smarties/i, kcal100g: 468, unitGrams: 38 },
    { name: "Manner Neapolitan Wafers", re: /manner (neapolitan )?wafers?/i, kcal100g: 490, unitGrams: 30 },
    { name: "Tokyo Banana", re: /tokyo banana/i, kcal100g: 333, unitGrams: 30 },
    { name: "Koala's March", re: /koala'?s march/i, kcal100g: 527, unitGrams: 37 },
    { name: "White Rabbit Candy", re: /white rabbit/i, kcal100g: 444, unitGrams: 4.5 },
    { name: "Twizzlers", re: /twizzlers/i, kcal100g: 355, unitGrams: 45 },
    { name: "Rice Krispies Treats", re: /rice krispies treats?/i, kcal100g: 409, unitGrams: 22 },
    { name: "Milka Oreo Bar", re: /milka oreo/i, kcal100g: 554, unitGrams: 37 },
    { name: "Toffifee", re: /toffifee/i, kcal100g: 525, unitGrams: 33 },
    { name: "Haribo Goldbears", re: /haribo/i, kcal100g: 343, unitGrams: 30 },
    { name: "Balisto", re: /balisto/i, kcal100g: 503, unitGrams: 18.5 },
    { name: "Cherry Ripe", re: /cherry ripe/i, kcal100g: 450, unitGrams: 52 },
    { name: "Yan Yan", re: /\byan yan\b/i, kcal100g: 500, unitGrams: 50 },
    { name: "Market O Real Brownie", re: /market o (real )?brownie/i, kcal100g: 500, unitGrams: 20 },
    { name: "Doritos Cool Ranch", re: /doritos cool ranch|cool ranch doritos/i, kcal100g: 535, unitGrams: 28 },
    // גרסת הלימון חייבת לבוא *לפני* Flamin' Hot הרגיל למטה - מכילה את הביטוי
    // שלו כתת-מחרוזת, וערך הקלוריות שונה
    { name: "Cheetos Flamin' Hot Limón", re: /flamin'? hot lim[oó]n/i, kcal100g: 571, unitGrams: 28 },
    { name: "Cheetos Flamin' Hot", re: /cheetos flamin'? hot|flamin'? hot cheetos/i, kcal100g: 607, unitGrams: 28 },
    { name: "Rold Gold Pretzel Twists", re: /rold gold/i, kcal100g: 392, unitGrams: 28 },
    { name: "Calbee Pizza Potato Chips", re: /calbee pizza/i, kcal100g: 560, unitGrams: 30 },
    { name: "Want Want Senbei", re: /want want|senbei/i, kcal100g: 500, unitGrams: 12 },
    { name: "Whatchamacallit Bar", re: /whatchamacallit/i, kcal100g: 489, unitGrams: 49 },
    { name: "Almond Joy", re: /almond joy/i, kcal100g: 488, unitGrams: 45 },
    { name: "Sour Patch Kids", re: /sour patch kids/i, kcal100g: 350, unitGrams: 40 },
    { name: "Kinder Bueno White", re: /kinder bueno white/i, kcal100g: 571, unitGrams: 19.5 },
    { name: "Ritter Sport Marzipan", re: /ritter sport marzipan/i, kcal100g: 493, unitGrams: 6.25 },
    { name: "Nimm2 Smilegummi", re: /nimm2/i, kcal100g: 333, unitGrams: 30 },
    { name: "Jaffa Cakes", re: /jaffa cakes?/i, kcal100g: 383, unitGrams: 12 },
    { name: "Violet Crumble", re: /violet crumble/i, kcal100g: 464, unitGrams: 50 },
    { name: "Kancho Choco Biscuits", re: /\bkancho\b/i, kcal100g: 488, unitGrams: 42 },
    { name: "Hello Panda", re: /hello panda/i, kcal100g: 533, unitGrams: 30 },
    { name: "Cheetos Puffs", re: /cheetos puffs/i, kcal100g: 571, unitGrams: 28 },
    { name: "SunChips", re: /sunchips/i, kcal100g: 500, unitGrams: 28 },
    { name: "Gardetto's", re: /gardetto'?s/i, kcal100g: 500, unitGrams: 30 },
    { name: "Lays Max", re: /lays max/i, kcal100g: 530, unitGrams: 30 },
    { name: "Croky Chips", re: /croky chips/i, kcal100g: 540, unitGrams: 30 },
    { name: "Calbee Grill Corn Snax", re: /grill.?a?.?corn snax|calbee.*corn snax/i, kcal100g: 533, unitGrams: 30 },
    { name: "Oishi Shrimp Flakes", re: /oishi/i, kcal100g: 433, unitGrams: 30 },
    { name: "Heath Bar", re: /heath bar/i, kcal100g: 538, unitGrams: 39 },
    { name: "Milky Way Midnight", re: /milky way midnight/i, kcal100g: 449, unitGrams: 49 },
    { name: "Charleston Chew", re: /charleston chew/i, kcal100g: 434, unitGrams: 53 },
    { name: "Airheads", re: /airheads/i, kcal100g: 387, unitGrams: 15.5 },
    { name: "Kinder Bueno Dark", re: /kinder bueno dark/i, kcal100g: 568, unitGrams: 19.5 },
    { name: "Milka Lu Biscuit", re: /milka lu/i, kcal100g: 514, unitGrams: 6.2 },
    { name: "Ritter Sport Rum Raisin Hazelnut", re: /ritter sport rum raisin/i, kcal100g: 530, unitGrams: 6.25 },
    { name: "McVitie's Digestive Dark Chocolate", re: /mcvitie'?s digestive|digestive dark chocolate/i, kcal100g: 500, unitGrams: 16.6 },
    { name: "Mint Slice", re: /mint slice/i, kcal100g: 533, unitGrams: 18 },
    { name: "Choco Boy Biscuits", re: /choco boy/i, kcal100g: 533, unitGrams: 45 },
    { name: "KitKat Matcha Green Tea", re: /kit.?kat.*matcha|matcha.*kit.?kat/i, kcal100g: 550, unitGrams: 11.6 },
    { name: "KitKat Strawberry Cheesecake", re: /kit.?kat.*strawberry cheesecake/i, kcal100g: 560, unitGrams: 11.6 },
    { name: "KitKat Sake", re: /kit.?kat.*sake/i, kcal100g: 550, unitGrams: 11.6 },
    { name: "KitKat Wasabi", re: /kit.?kat.*wasabi/i, kcal100g: 543, unitGrams: 11.6 },
    { name: "KitKat Purple Sweet Potato", re: /kit.?kat.*purple sweet potato/i, kcal100g: 550, unitGrams: 11.6 },
    // דורש "chips" מפורש - בלעדיו "Samyang Buldak Carbonara Noodles" (למטה)
    // היה תמיד נתפס כחטיף הצ'יפס במקום האטריות
    { name: "Samyang Buldak Potato Chips", re: /samyang.*chips|buldak.*chips/i, kcal100g: 550, unitGrams: 30 },
    { name: "Samyang Buldak Carbonara Noodles", re: /samyang.*carbonara|buldak carbonara/i, kcal100g: 423, unitGrams: 130 },
    { name: "Calbee Salted Egg Yolk Chips", re: /salted egg yolk/i, kcal100g: 566, unitGrams: 30 },
    { name: "Calbee Honey Butter Chips", re: /honey butter chips/i, kcal100g: 560, unitGrams: 30 },
    { name: "Pocky Matcha Green Tea", re: /pocky.*matcha/i, kcal100g: 485, unitGrams: 33 },
    { name: "Pocky Cookies & Cream", re: /pocky.*cookies.*cream/i, kcal100g: 475, unitGrams: 40 },
    { name: "Doritos Flamin' Hot Limón", re: /doritos.*flamin'? hot lim[oó]n/i, kcal100g: 535, unitGrams: 28 },
    { name: "Doritos Dynamic Chili Lime", re: /doritos.*dynamic chili lime/i, kcal100g: 535, unitGrams: 28 },
    { name: "Nutella B-ready", re: /nutella b.?ready/i, kcal100g: 521, unitGrams: 22 },
    { name: "Nutella Biscuits", re: /nutella biscuits?/i, kcal100g: 513, unitGrams: 13.8 },
    { name: "Kinder Cards", re: /kinder cards/i, kcal100g: 510, unitGrams: 25.6 },
    { name: "Kinder Tronky", re: /kinder tronky/i, kcal100g: 527, unitGrams: 18 },
    { name: "Duplo Milk Chocolate", re: /\bduplo\b/i, kcal100g: 545, unitGrams: 18.2 },
    { name: "Lotus Biscoff Sandwich Cream", re: /biscoff sandwich cream|lotus biscoff cookie/i, kcal100g: 525, unitGrams: 15 },
    { name: "Milka Choco Wafer", re: /milka choco wafer/i, kcal100g: 526, unitGrams: 30 },
    { name: "Milka Choco Supreme", re: /milka choco supreme/i, kcal100g: 550, unitGrams: 30 },
    { name: "Stroopwafel Chocolate", re: /stroopwafel chocolate|chocolate stroopwafel/i, kcal100g: 473, unitGrams: 30 },
    { name: "Twinkies Chocolate", re: /twinkies.*chocolate|chocolate twinkies/i, kcal100g: 368, unitGrams: 38 },
    { name: "Twinkies", re: /twinkies/i, kcal100g: 355, unitGrams: 38 },
    { name: "Ding Dongs", re: /ding dongs?/i, kcal100g: 428, unitGrams: 42 },
    { name: "Cinnabon Minibon", re: /cinnabon minibon|\bminibon\b/i, kcal100g: 280, unitGrams: 125 },
    { name: "Cinnabon Classic Roll", re: /cinnabon classic|cinnabon.*roll/i, kcal100g: 328, unitGrams: 268 },
    { name: "Krispy Kreme Chocolate Iced Glazed", re: /krispy kreme.*chocolate iced|chocolate iced glazed/i, kcal100g: 380, unitGrams: 63 },
    { name: "Krispy Kreme Original Glazed", re: /krispy kreme.*original|original glazed.*krispy kreme/i, kcal100g: 387, unitGrams: 49 },
    { name: "Hostess CupCake Chocolate", re: /hostess cupcake/i, kcal100g: 372, unitGrams: 43 },
    { name: "Pods with Snickers", re: /pods with snickers|snickers pods/i, kcal100g: 492, unitGrams: 25 },
    { name: "Pods with Mars", re: /pods with mars|mars pods/i, kcal100g: 488, unitGrams: 25 },
    { name: "Tim Tam Double Coat", re: /tim tam double coat/i, kcal100g: 510, unitGrams: 20 },
    { name: "שלגון קראנצ' פיסטוק/מילקי", re: /קראנצ'? (פיסטוק|מילקי)/i, kcalPerUnit: 235 },
    { name: "גלידת קראנצ' קורנפלקס", re: /קראנצ'? קורנפלקס/i, kcal100g: 314, unitGrams: 70 },
    { name: "Doritos Dinamita", re: /doritos.*dinamita|dinamita.*doritos/i, kcal100g: 535, unitGrams: 28 },
    { name: "במבה ממולאת קרם בייגלה מלוח", re: /במבה ממולאת.*בייגלה/i, kcal100g: 525, unitGrams: 60 },
    { name: "במבה ממולאת קרם שוקולד לבן", re: /במבה ממולאת.*שוקולד לבן/i, kcal100g: 533, unitGrams: 60 },
    { name: "פטיבר עם שוקולד", re: /פטיבר (עם שוקולד|מוגזם)/i, kcal100g: 483, unitGrams: 12 },
    { name: "Oreo Birthday Cake/Golden", re: /oreo (birthday cake|golden)/i, kcal100g: 483, unitGrams: 12 },
    { name: "Pringles Scorchin' Hot", re: /pringles scorchin/i, kcal100g: 525, unitGrams: 20 },
    { name: "מגנום קרמל מלוח", re: /מגנום.*קרמל מלוח|salted caramel magnum/i, kcalPerUnit: 280 },
    { name: "מגנום סאנלאבר/סטארצ'ייסר", re: /מגנום.*(סאנלאבר|סטארצ'ייסר)|sunlover|starchaser/i, kcalPerUnit: 260 },
    { name: "תפוצ'יפס קראנץ'", re: /תפוצ['׳]?יפס קראנץ'?/i, kcal100g: 530, unitGrams: 50 },
    // משפחת גלידות מורחבת (האגן דאז/גולדה/שטראוס/נסטלה) - חייבת לבוא *לפני*
    // הערכים הכלליים בהמשך (גלידת פרימיום, סורבה, טילון, מיני טילון, ארטיק
    // פרי טבעי, ארטיק/קרטיב, גלידת גולדה) שהיו בולעים אותה בטעות - נתונים
    // מדויקים מהמשתמשת. וריאנטים "מיני"/ספציפיים חייבים לבוא *לפני* הגרסה
    // הרחבה יותר מאותו מותג מאותה סיבה
    { name: "האגן דאז מיני וניל", re: /מיני.*האגן דאז.*וניל|האגן דאז.*מיני.*וניל|mini cup vanilla/i, kcal100g: 247, unitGrams: 75 },
    { name: "האגן דאז מיני מקדמיה", re: /מיני.*האגן דאז.*מקדמיה|האגן דאז.*מיני.*מקדמיה|mini cup macadamia/i, kcal100g: 273, unitGrams: 75 },
    { name: "האגן דאז מיני דולצ'ה דה לצ'ה", re: /מיני.*דולצ'ה דה לצ'ה|dulce de leche mini cup/i, kcal100g: 260, unitGrams: 75 },
    { name: "האגן דאז מיני תות שדה", re: /מיני.*האגן דאז.*תות|האגן דאז.*מיני.*תות|mini cup strawberry/i, kcal100g: 233, unitGrams: 75 },
    { name: "שלגון האגן דאז וניל שקדים", re: /שלגון.*האגן דאז.*(שקדים|מריר)|haagen.?dazs.*almond/i, kcalPerUnit: 250 },
    { name: "שלגון קרמל מלוח", re: /שלגון קרמל מלוח/i, kcalPerUnit: 240 },
    { name: "האגן דאז פרלין וקרמל", re: /פרלין וקרמל|pralines.*cream/i, kcal100g: 275, unitGrams: 100 },
    { name: "האגן דאז בלגיאן צ'וקלט", re: /בלגיאן צ'וקלט|belgian chocolate/i, kcal100g: 280, unitGrams: 100 },
    { name: "האגן דאז מנגו פטל", re: /מנגו פטל|mango raspberry/i, kcal100g: 215, unitGrams: 100 },
    { name: "גולדה סורבה", re: /גולדה.*סורבה|סורבה.*גולדה/i, kcal100g: 140, unitGrams: 100 },
    { name: "גולדה ללא תוספת סוכר", re: /גולדה.*ללא תוספת סוכר/i, kcal100g: 150, unitGrams: 100 },
    { name: "גולדה פיסטוק", re: /גולדה.*פיסטוק|פיסטוק.*גולדה/i, kcal100g: 250, unitGrams: 100 },
    { name: "גולדה שוקולד לוז/הרשיז", re: /גולדה.*(שוקולד לוז|הרשיז)/i, kcal100g: 245, unitGrams: 100 },
    { name: "טילון קורנטו עוגיות", re: /קורנטו עוגיות|cornetto disc/i, kcalPerUnit: 235 },
    { name: "טילון קורנטו מיני", re: /קורנטו מיני|mini cornetto/i, kcalPerUnit: 85 },
    { name: "שלגון פסק זמן", re: /שלגון פסק זמן/i, kcalPerUnit: 240 },
    { name: "טווירל/ספירל פירות", re: /טווירל|ספירל פירות/i, kcalPerUnit: 65 },
    { name: "שלגון קראנץ' חלווה", re: /שלגון קראנץ'? חלווה/i, kcalPerUnit: 230 },
    { name: "שלגון קראנץ' תות/וניל", re: /שלגון קראנץ'? (תות|וניל)/i, kcalPerUnit: 210 },
    { name: "טילון אקסטרים מיני", re: /טילון אקסטרים מיני|מיני טילון אקסטרים/i, kcalPerUnit: 90 },
    { name: "טילון אקסטרים", re: /טילון אקסטרים/i, kcalPerUnit: 225 },
    { name: "שלגון קקטוס/לה קוקרצ'ה", re: /שלגון קקטוס|לה קוקרצ'ה/i, kcalPerUnit: 60 },
    { name: "גלידת שמנת (אניטה/קצפת/דליקטס)", re: /גלידת? שמנת|אניטה|דליקטס/i, kcal100g: 240, unitGrams: 100 },
    { name: "גלידת יוגורט טבעי", re: /גלידת? יוגורט טבעי|סושיאל יוגורט|יוגורט.*תמרה|תמרה.*יוגורט/i, kcal100g: 110, unitGrams: 150 },
    { name: "שלגון שוקובו", re: /שוקובו/i, kcalPerUnit: 220 },
    { name: "שלגון שוקו-שוקו/וניל", re: /שוקו.?שוקו/i, kcalPerUnit: 135 },
    { name: "טילון/שלגון חלבון", re: /(טילון|שלגון) חלבון|pro ice cream|go ice cream/i, kcalPerUnit: 140 },
    { name: "Baskin-Robbins", re: /baskin.?robbins/i, kcal100g: 250, unitGrams: 100 },
    { name: "Melona Ice Bar", re: /melona/i, kcal100g: 185, unitGrams: 70 },
    { name: "Samanco", re: /samanco/i, kcal100g: 146, unitGrams: 150 },
    { name: "Bingsu", re: /bingsu|פתיתי שלג/i, kcal100g: 150, unitGrams: 200 },
    { name: "קראנצ' בראוניז/בלונדי", re: /קראנצ'? (בראוניז|בלונדי)/i, kcalPerUnit: 240 },
    { name: "שלגון קוקילידה", re: /קוקילידה/i, kcalPerUnit: 230 },
    { name: "שלגון במבה", re: /שלגון במבה/i, kcalPerUnit: 210 },
    { name: "שלגון קופיקו/סנוקר", re: /קופיקו|שלגון סנוקר/i, kcalPerUnit: 140 },
    { name: "Magnum Ego", re: /magnum ego/i, kcalPerUnit: 310 },
    { name: "Dove Ice Cream Bar", re: /\bdove\b.*ice cream|ice cream.*\bdove\b/i, kcalPerUnit: 250 },
    { name: "M&M's Ice Cream", re: /m&m'?s ice cream/i, kcalPerUnit: 240 },
    { name: "עוגת גלידה", re: /עוגת גלידה|ice cream cake/i, kcal100g: 260, unitGrams: 100 },
    // עוגיות/וופלים/עוגות/מאפים מותגיים - כל הבלוק חייב לבוא *לפני* הערכים
    // הכלליים בהמשך (עוגיות, עוגה, בורקס, ריבת חלב, שקדים, קרמבו, בראוני,
    // טירמיסו) שהיו בולעים אותם בטעות (נתונים מדויקים מהמשתמשת)
    { name: "Oreo Double Stuf", re: /oreo double stuf/i, kcal100g: 466, unitGrams: 15 },
    { name: "Oreo Thin", re: /oreo thins?/i, kcal100g: 500, unitGrams: 6 },
    { name: "Oreo Golden", re: /oreo golden/i, kcal100g: 482, unitGrams: 11 },
    { name: "Oreo Original", re: /oreo( original)?/i, kcal100g: 482, unitGrams: 11 },
    { name: "Lotus Biscoff Sandwich Vanilla", re: /biscoff sandwich vanilla/i, kcal100g: 527, unitGrams: 15 },
    { name: "Lotus Biscoff Sandwich Milk Chocolate", re: /biscoff sandwich milk chocolate/i, kcal100g: 553, unitGrams: 15 },
    { name: "Lotus Biscoff Original", re: /biscoff original|\bbiscoff\b/i, kcal100g: 608, unitGrams: 6.25 },
    { name: "Chips Ahoy! Chewy", re: /chips ahoy.*chewy/i, kcal100g: 468, unitGrams: 16 },
    { name: "Chips Ahoy!", re: /chips ahoy/i, kcal100g: 500, unitGrams: 10 },
    // דורש "Milano" מפורש - בלעדיו כל מוצר של Pepperidge Farm (Chessmen/
    // Sausalito למטה) היה תמיד נתפס כמילאנו
    { name: "Pepperidge Farm Milano", re: /pepperidge farm milano|milano chocolate/i, kcal100g: 500, unitGrams: 15 },
    { name: "עוגיות פתיבר שוקולד", re: /עוגיות? פתיבר.*שוקולד|פתיבר שוקולד/i, kcal100g: 476, unitGrams: 6.5 },
    { name: "עוגיות יומולדת (פתיבר)", re: /עוגיות? יומולדת|פתיבר עם סוכריות/i, kcal100g: 461, unitGrams: 6.5 },
    { name: "עוגיות מיני פתיבר", re: /עוגיות? מיני פתיבר|מיני פתיבר/i, kcal100g: 460, unitGrams: 30 },
    { name: "עוגיות פתיבר קלאסיות", re: /עוגיות? פתיבר( קלאסי(ות)?)?/i, kcal100g: 461, unitGrams: 6.5 },
    { name: "עוגיות חמאה דנית", re: /עוגיות? חמאה דנית|royal dansk/i, kcal100g: 520, unitGrams: 10 },
    { name: "עוגיות מג'ימיק", re: /מג'ימיק/i, kcal100g: 500, unitGrams: 12 },
    { name: "עוגיות רגעים", re: /עוגיות? רגעים/i, kcal100g: 500, unitGrams: 10 },
    { name: "עוגיות מרשמלו מצופות שוקולד", re: /עוגיות? מרשמלו|קרמבו אישי|עוגיית ראש השנה/i, kcal100g: 420, unitGrams: 25 },
    { name: "עוגיות פקאן/חמאה ביתיות", re: /עוגיות? פקאן|עוגיות? חמאה ביתי(ות)?/i, kcal100g: 525, unitGrams: 20 },
    { name: "עוגיות אלפחורס", re: /אלפחורס|alfajores?/i, kcal100g: 422, unitGrams: 45 },
    { name: "עוגיות סבלה ברטון", re: /סבלה ברטון|sabl[ée] breton/i, kcal100g: 533, unitGrams: 15 },
    { name: "עוגיות מקרון", re: /מקרון|macarons?/i, kcal100g: 416, unitGrams: 12 },
    { name: "עוגיות בישקוטים", re: /בישקוטים|savoiardi|ladyfingers?/i, kcal100g: 375, unitGrams: 8 },
    { name: "עוגיות שקדים איטלקיות", re: /אמארטי|amaretti/i, kcal100g: 416, unitGrams: 6 },
    { name: "עוגיות ג'ינג'רברד", re: /ג'ינג'רברד|gingerbread/i, kcal100g: 433, unitGrams: 15 },
    { name: "קרקר מתוק/פתי בר עשיר", re: /פתי בר עשיר|קרקר מתוק/i, kcal100g: 450, unitGrams: 10 },
    { name: "עוגת מאפין שוקולד ממולא נוטלה", re: /מאפין.*ממולא נוטלה|מאפין.*נוטלה/i, kcal100g: 400, unitGrams: 120 },
    { name: "עוגת מאפין שוקולד צ'יפס", re: /מאפין.*שוקולד צ'יפס/i, kcal100g: 381, unitGrams: 110 },
    { name: "עוגת מאפין אוכמניות", re: /מאפין.*אוכמניות/i, kcal100g: 354, unitGrams: 110 },
    { name: "עוגת בלונדיז", re: /בלונדיז|בלונדי/i, kcal100g: 425, unitGrams: 60 },
    // דורש הקשר ("עשירה"/בלי כשר אחר) - "ארוזה"/"חמאת בוטנים" בהמשך הן
    // וריאנטים ספציפיים יותר עם ערכים שונים, וזה לא יכול לבלוע אותן
    { name: "עוגת בראוניז עשירה", re: /עוגת בראוניז עשירה|עוגת בראוניז(?! (ארוזה|חמאת|עם))/i, kcal100g: 433, unitGrams: 60 },
    { name: "עוגת ספוג בחושה", re: /עוגת ספוג|עוגת שיש/i, kcal100g: 360, unitGrams: 50 },
    { name: "עוגת דבש בחושה", re: /עוגת דבש/i, kcal100g: 350, unitGrams: 50 },
    { name: "עוגת גזר בחושה", re: /עוגת גזר/i, kcal100g: 342, unitGrams: 70 },
    { name: "עוגת תפוחים בחושה/פאי תפוחים", re: /עוגת תפוחים|פאי תפוחים/i, kcal100g: 275, unitGrams: 80 },
    { name: "עוגת גבינה קרה עם פירורים", re: /עוגת גבינה קרה|עוגת פלויד|עוגת פירורים/i, kcal100g: 320, unitGrams: 100 },
    { name: "עוגת גבינה פירורים אישית", re: /עוגת גבינה.*אישית|עוגת גבינה גלילי(ת|ות)/i, kcal100g: 344, unitGrams: 90 },
    { name: "עוגת גבינה אפויה", re: /עוגת גבינה( אפויה)?( קלאסית)?/i, kcal100g: 280, unitGrams: 100 },
    { name: "עוגת שמרים שוקולד", re: /עוגת שמרים.*שוקולד/i, kcal100g: 383, unitGrams: 60 },
    { name: "עוגת שמרים קינמון/אגוזים", re: /עוגת שמרים.*(קינמון|אגוזים)/i, kcal100g: 366, unitGrams: 60 },
    { name: "עוגת שמרים גבינה", re: /עוגת שמרים.*גבינה/i, kcal100g: 350, unitGrams: 60 },
    { name: "קרואסון שקדים", re: /קרואסון שקדים/i, kcal100g: 455, unitGrams: 90 },
    { name: "קרואסון גבינה מלוחה", re: /קרואסון גבינה/i, kcal100g: 362, unitGrams: 80 },
    { name: "קרואסון חמאה צרפתי", re: /קרואסון חמאה( צרפתי)?( קלאסי)?/i, kcal100g: 400, unitGrams: 60 },
    { name: "בורקס גבינה", re: /בורקס גבינה/i, kcal100g: 400, unitGrams: 45 },
    { name: "בורקס תפוח אדמה", re: /בורקס תפוח אדמה/i, kcal100g: 355, unitGrams: 45 },
    { name: "בורקס פיצה/פטריות", re: /בורקס פיצה|בורקס פטריות/i, kcal100g: 380, unitGrams: 50 },
    { name: "רוגלך שוקולד (מאפייה)", re: /רוגלך שוקולד/i, kcal100g: 433, unitGrams: 30 },
    { name: "אוזן המן שוקולד", re: /אוזן המן.*שוקולד|אוזני המן.*שוקולד/i, kcal100g: 425, unitGrams: 40 },
    { name: "אוזן המן פרג/פירות", re: /אוזן המן|אוזני המן/i, kcal100g: 375, unitGrams: 40 },
    { name: "סופגנייה ממולאת", re: /סופגני(ה|ית) ממולאת|סופגני(ה|ית).*ריבת חלב/i, kcal100g: 431, unitGrams: 95 },
    { name: "סופגניית פיסטוק/פרימיום", re: /סופגני(ה|ית) פיסטוק|סופגני(ה|ית).*פרימיום/i, kcal100g: 436, unitGrams: 110 },
    { name: "סופגנייה קלאסית", re: /סופגני(ה|ית)( קלאסית)?/i, kcal100g: 400, unitGrams: 80 },
    { name: "עוגת שכבות מוס שוקולד", re: /עוגת שכבות/i, kcal100g: 375, unitGrams: 120 },
    { name: "עוגת טירמיסו", re: /עוגת טירמיסו/i, kcal100g: 310, unitGrams: 100 },
    { name: "פאי לימון מרנג", re: /פאי לימון|lemon meringue/i, kcal100g: 270, unitGrams: 100 },
    { name: "פאי פקאן", re: /פאי פקאן|pecan pie/i, kcal100g: 422, unitGrams: 90 },
    { name: "אקלר", re: /אקלר|\b[eé]clair\b/i, kcal100g: 342, unitGrams: 70 },
    { name: "פרופיטרול", re: /פרופיטרול|profiterole/i, kcal100g: 400, unitGrams: 40 },
    { name: "רולדת שוקולד", re: /רולדת שוקולד/i, kcal100g: 380, unitGrams: 50 },
    { name: "נפוליון/מילפיי", re: /נפוליון|מילפיי|napoleon pastry|mille.?feuille/i, kcal100g: 412, unitGrams: 80 },
    // חייב לבוא *לפני* גם צ'ורוס וגם ריבת חלב בהמשך - מכיל את שניהם כתת-מחרוזת
    { name: "Churros with Dulce de Leche", re: /churros.*dulce de leche|dulce de leche.*churros/i, kcal100g: 433, unitGrams: 60 },
    { name: "צ'ורוס", re: /צ'ורוס|churros?/i, kcal100g: 480, unitGrams: 50 },
    { name: "Oreo Peanut Butter", re: /oreo peanut butter/i, kcal100g: 491, unitGrams: 12 },
    { name: "Oreo Mint Cream", re: /oreo mint/i, kcal100g: 478, unitGrams: 11.5 },
    { name: "Oreo White Fudge Covered", re: /oreo.*white fudge/i, kcal100g: 523, unitGrams: 21 },
    { name: "Chips Ahoy! Red Velvet", re: /chips ahoy.*red velvet/i, kcal100g: 466, unitGrams: 15 },
    { name: "Chips Ahoy! Chunky", re: /chips ahoy.*chunky/i, kcal100g: 500, unitGrams: 18 },
    { name: "Keebler Fudge Stripes", re: /keebler|fudge stripes/i, kcal100g: 500, unitGrams: 14 },
    { name: "Pepperidge Farm Chessmen", re: /chessmen/i, kcal100g: 450, unitGrams: 10 },
    { name: "Pepperidge Farm Sausalito", re: /sausalito/i, kcal100g: 500, unitGrams: 26 },
    { name: "עוגיות עבאדי", re: /עבאדי/i, kcal100g: 483, unitGrams: 30 },
    { name: "עוגיות מזרחיות שומשום", re: /עוגיות? מזרחי(ות|ת).*שומשום|עוגיות? שומשום/i, kcal100g: 480, unitGrams: 15 },
    { name: "עוגיות חיוכים", re: /עוגיות? חיוכים/i, kcal100g: 500, unitGrams: 12 },
    { name: "עוגיות נייס", re: /עוגיות? נייס|\bnice biscuits?\b/i, kcal100g: 462, unitGrams: 8 },
    { name: "עוגיות פרח ריבה", re: /פרח ריבה|עין החרדל/i, kcal100g: 440, unitGrams: 25 },
    { name: "עוגיות מעמול תמרים", re: /מעמול תמרים|מעמול.*תמר/i, kcal100g: 416, unitGrams: 30 },
    { name: "עוגיות מעמול אגוזים", re: /מעמול אגוזים|מעמול.*אגוז/i, kcal100g: 466, unitGrams: 30 },
    { name: "עוגיות ספינג'/שבקיה", re: /ספינג'|שבקיה/i, kcal100g: 420, unitGrams: 50 },
    { name: "KitKat Chunky Peanut Butter", re: /kit.?kat chunky.*peanut/i, kcal100g: 530, unitGrams: 42 },
    { name: "KitKat Chunky", re: /kit.?kat chunky/i, kcal100g: 517, unitGrams: 40 },
    { name: "Twix Salted Caramel", re: /twix.*salted caramel/i, kcal100g: 500, unitGrams: 23 },
    { name: "Snickers Peanut Butter", re: /snickers.*peanut butter/i, kcal100g: 490, unitGrams: 51 },
    { name: "M&M's Peanut Butter", re: /m&m'?s peanut butter/i, kcal100g: 533, unitGrams: 45 },
    { name: "M&M's Crispy", re: /m&m'?s crispy/i, kcal100g: 500, unitGrams: 36 },
    { name: "Maltesers", re: /maltesers|מלטיזרס|מלטזרס/i, kcal100g: 502, unitGrams: 37 },
    { name: "Kinder Delice", re: /kinder delice/i, kcal100g: 453, unitGrams: 39 },
    { name: "Kinder Milk Slice", re: /kinder milk slice|kinder maxi/i, kcal100g: 421, unitGrams: 28 },
    { name: "Kinder Pingui", re: /kinder pingui/i, kcal100g: 450, unitGrams: 30 },
    { name: "עוגת הבית שוקולד צ'יפס", re: /עוגת הבית.*שוקולד צ'יפס/i, kcal100g: 414, unitGrams: 35 },
    { name: "עוגת הבית שיש", re: /עוגת הבית.*שיש/i, kcal100g: 400, unitGrams: 35 },
    { name: "עוגת הבית פרג/תפוז", re: /עוגת הבית.*(פרג|תפוז)/i, kcal100g: 385, unitGrams: 35 },
    { name: "עוגת בראוניז ארוזה", re: /עוגת בראוניז ארוזה|בראוניז.*(עילית|אסם)/i, kcal100g: 442, unitGrams: 35 },
    { name: "Victoria Sponge Cake", re: /victoria sponge/i, kcal100g: 390, unitGrams: 100 },
    { name: "עוגת ספונג' קייק", re: /ספונג'? קייק|sponge cake/i, kcal100g: 360, unitGrams: 50 },
    { name: "עוגת פנטונה", re: /פנטונה|panettone/i, kcal100g: 350, unitGrams: 80 },
    { name: "עוגת שטרודל תפוחים", re: /שטרודל|apple strudel/i, kcal100g: 240, unitGrams: 100 },
    { name: "סינבון פקאן", re: /סינבון פקאן|פקאנבון|pecanbon/i, kcal100g: 360, unitGrams: 300 },
    { name: "סינבון קלאסי", re: /סינבון קלאסי|סינבון/i, kcal100g: 328, unitGrams: 268 },
    { name: "באקלאווה", re: /באקלאווה|בקלאווה|baklava/i, kcal100g: 450, unitGrams: 40 },
    { name: "כנאפה", re: /כנאפה|kanafeh|knafeh/i, kcal100g: 300, unitGrams: 150 },
    { name: "קדאיף", re: /קדאיף|kadaif|kataifi/i, kcal100g: 416, unitGrams: 60 },
    { name: "באבקה שוקולד", re: /באבקה|babka/i, kcal100g: 400, unitGrams: 70 },
    { name: "פאי דלעת", re: /פאי דלעת|pumpkin pie/i, kcal100g: 258, unitGrams: 120 },
    { name: "פאי דובדבנים/אוכמניות", re: /פאי דובדבנים|פאי אוכמניות|cherry pie|blueberry pie/i, kcal100g: 275, unitGrams: 120 },
    { name: "פאי ליים", re: /פאי ליים|key lime pie/i, kcal100g: 309, unitGrams: 110 },
    { name: "עוגת היער השחור", re: /היער השחור|black forest/i, kcal100g: 266, unitGrams: 120 },
    { name: "עוגת זאכרטורט", re: /זאכרטורט|sachertorte/i, kcal100g: 370, unitGrams: 100 },
    { name: "עוגת רד ולווט", re: /רד ולווט|red velvet/i, kcal100g: 358, unitGrams: 120 },
    { name: "Nutter Butter", re: /nutter butter/i, kcal100g: 466, unitGrams: 15 },
    { name: "Famous Amos", re: /famous amos/i, kcal100g: 500, unitGrams: 56 },
    { name: "Little Debbie Cosmic Brownies", re: /cosmic brownies?/i, kcal100g: 451, unitGrams: 62 },
    { name: "Little Debbie Oatmeal Cream Pies", re: /oatmeal cream pies?/i, kcal100g: 447, unitGrams: 38 },
    { name: "Hostess Sno Balls", re: /sno balls?/i, kcal100g: 380, unitGrams: 50 },
    { name: "Pepperidge Farm Brussels", re: /\bbrussels\b.*(cookie|chocolate)|pepperidge.*brussels/i, kcal100g: 500, unitGrams: 15 },
    { name: "McVitie's Hobnobs", re: /hobnobs/i, kcal100g: 494, unitGrams: 18.8 },
    { name: "Choco Leibniz", re: /choco leibniz|leibniz/i, kcal100g: 500, unitGrams: 14 },
    { name: "Bahlsen Pick Up!", re: /pick up!?.*bahlsen|bahlsen pick up/i, kcal100g: 507, unitGrams: 28 },
    // דורש שלא יכיל "chocolate" - בלעדיו הגרסה עם שוקולד (בהמשך) הייתה תמיד
    // נתפסת כגרסה הרגילה (433) במקום הערך הקלורי יותר שלה (480)
    { name: "Lu Petit Beurre", re: /(\blu\b.*petit beurre|petit beurre.*\blu\b)(?!.*chocolate)|petit beurre(?!.*chocolate)/i, kcal100g: 433, unitGrams: 8.3 },
    { name: "Lu Prince", re: /\blu\b.*prince|prince.*chocolate sandwich/i, kcal100g: 490, unitGrams: 20 },
    // דורש "Galettes Roulées" מפורש - בלעדיו כל מוצר St Michel (מדלן/גלטים
    // בחמאה בהמשך) היה תמיד נתפס כגלטים גליליות
    { name: "St Michel Galettes", re: /st michel.*galettes roul[ée]es|galettes roul[ée]es/i, kcal100g: 480, unitGrams: 10 },
    { name: "Gullón Sugar Free", re: /gull[oó]n/i, kcal100g: 453, unitGrams: 15 },
    { name: "Belvita", re: /belvita/i, kcal100g: 448, unitGrams: 12.5 },
    { name: "Orion Fresh Pie", re: /orion fresh pie/i, kcal100g: 460, unitGrams: 25 },
    { name: "Bourbon Alfort", re: /bourbon alfort|\balfort\b/i, kcal100g: 534, unitGrams: 10.1 },
    { name: "Glico Bisco", re: /glico bisco|\bbisco\b/i, kcal100g: 500, unitGrams: 20 },
    { name: "עוגת אננס טייוואנית", re: /עוגת אננס|pineapple cake/i, kcal100g: 450, unitGrams: 40 },
    { name: "עוגת ירח", re: /עוגת ירח|mooncake/i, kcal100g: 425, unitGrams: 100 },
    { name: "קנלה בורדו", re: /קנלה בורדו|cannel[ée]/i, kcal100g: 300, unitGrams: 60 },
    { name: "פונדנט שוקולד/קאפקייק חם", re: /פונדנט שוקולד|קאפקייק שוקולד חם|molten (chocolate|lava) cake/i, kcal100g: 400, unitGrams: 90 },
    { name: "פאי בנאפי", re: /בנאפי|banoffee/i, kcal100g: 350, unitGrams: 120 },
    { name: "פבלובה", re: /פבלובה|pavlova/i, kcal100g: 220, unitGrams: 100 },
    { name: "עוגת אנג'ל פוד", re: /אנג'ל פוד|angel food cake/i, kcal100g: 266, unitGrams: 60 },
    { name: "עוגת בראוניז חמאת בוטנים", re: /בראוניז.*חמאת בוטנים|בראוני.*חמאת בוטנים/i, kcal100g: 476, unitGrams: 65 },
    { name: "קראמבל תפוחים/פירות יער", re: /קראמבל|crumble/i, kcal100g: 213, unitGrams: 150 },
    { name: "סקון חמאה בריטי", re: /סקון|\bscone\b/i, kcal100g: 371, unitGrams: 70 },
    { name: "פסטל דה נאטה", re: /פסטל דה נאטה|pastel de nata|nata tart/i, kcal100g: 266, unitGrams: 60 },
    { name: "Graham Crackers", re: /graham crackers?/i, kcal100g: 419, unitGrams: 31 },
    { name: "Little Debbie Fudge Rounds", re: /fudge rounds?/i, kcal100g: 447, unitGrams: 67 },
    { name: "Hostess Zebra Cakes", re: /zebra cakes?/i, kcal100g: 441, unitGrams: 43 },
    { name: "Hostess Ho Hos", re: /ho hos/i, kcal100g: 428, unitGrams: 28 },
    { name: "Entenmann's Donuts", re: /entenmann'?s/i, kcal100g: 473, unitGrams: 57 },
    { name: "Lotus Biscoff Chocolate Dropped", re: /biscoff.*chocolate dropped|chocolate dropped.*biscoff/i, kcal100g: 530, unitGrams: 10 },
    { name: "Bahlsen Waffeletten", re: /waffeletten/i, kcal100g: 520, unitGrams: 7.5 },
    { name: "Lu Mikado", re: /mikado/i, kcal100g: 490, unitGrams: 2 },
    { name: "Lu Pim's", re: /\bpim'?s\b/i, kcal100g: 400, unitGrams: 12.5 },
    { name: "St Michel Madeleines", re: /madeleines?/i, kcal100g: 440, unitGrams: 25 },
    { name: "Jules Destrooper", re: /destrooper/i, kcal100g: 481, unitGrams: 11 },
    { name: "Orion Custard Cream Cupcake", re: /orion custard cream|custard cream cupcake/i, kcal100g: 443, unitGrams: 23 },
    { name: "Lotte Margaret Cookie", re: /margaret cookie/i, kcal100g: 478, unitGrams: 11.5 },
    { name: "Glico Pepero", re: /pepero/i, kcal100g: 531, unitGrams: 32 },
    { name: "Bourbon Elise Cream Wafer", re: /bourbon elise|\belise\b.*wafer/i, kcal100g: 542, unitGrams: 14 },
    { name: "Koikeya Milk Tea Biscuit", re: /koikeya/i, kcal100g: 480, unitGrams: 10 },
    { name: "Tiramisu Savoiardi Classic", re: /tiramisu savoiardi/i, kcal100g: 316, unitGrams: 120 },
    { name: "Tres Leches Cake", re: /tres leches/i, kcal100g: 269, unitGrams: 130 },
    { name: "Kouign-Amann", re: /kouign.?amann/i, kcal100g: 450, unitGrams: 80 },
    { name: "Brioche au Chocolat", re: /brioche au chocolat/i, kcal100g: 385, unitGrams: 70 },
    { name: "עוגת קסאטה סיציליאנית", re: /קסאטה|cassata/i, kcal100g: 330, unitGrams: 100 },
    { name: "פאי ראבארב", re: /ראבארב|rhubarb pie/i, kcal100g: 241, unitGrams: 120 },
    { name: "Soft Batch Cookies", re: /soft batch/i, kcal100g: 500, unitGrams: 16 },
    { name: "Lorna Doone", re: /lorna doone/i, kcal100g: 500, unitGrams: 7 },
    { name: "Little Debbie Swiss Rolls", re: /swiss rolls?/i, kcal100g: 400, unitGrams: 60 },
    { name: "Little Debbie Honey Buns", re: /honey buns?/i, kcal100g: 423, unitGrams: 85 },
    { name: "Hostess Donettes", re: /donettes/i, kcal100g: 421, unitGrams: 38 },
    { name: "Hostess Apple Fruit Pie", re: /hostess.*apple.*pie|apple fruit pie/i, kcal100g: 375, unitGrams: 128 },
    { name: "Crawford's Bourbon Creams", re: /crawford'?s bourbon/i, kcal100g: 485, unitGrams: 14 },
    { name: "Crawford's Custard Creams", re: /crawford'?s custard/i, kcal100g: 495, unitGrams: 11.5 },
    { name: "Bahlsen Hit Vanilla Cream", re: /\bhit\b.*vanilla.*bahlsen|bahlsen hit/i, kcal100g: 500, unitGrams: 15 },
    { name: "Bahlsen Afrika", re: /bahlsen afrika|\bafrika\b.*cookie/i, kcal100g: 528, unitGrams: 7 },
    { name: "Lu Véritable Petit Beurre Chocolate", re: /petit beurre.*chocolate/i, kcal100g: 480, unitGrams: 12.5 },
    { name: "Lu Granola", re: /\blu\b granola|granola milk chocolate/i, kcal100g: 496, unitGrams: 12.5 },
    { name: "St Michel Galettes au Beurre", re: /galettes au beurre/i, kcal100g: 492, unitGrams: 6.5 },
    { name: "Crown Couque d'Asse", re: /couque d'?asse/i, kcal100g: 531, unitGrams: 16 },
    { name: "Glico Pretz", re: /\bpretz\b/i, kcal100g: 500, unitGrams: 23 },
    { name: "Lotte Toppo", re: /\btoppo\b/i, kcal100g: 527, unitGrams: 36 },
    { name: "עוגת באבקה קינמון/אגוזים", re: /באבקה.*(קינמון|אגוזים)/i, kcal100g: 385, unitGrams: 70 },
    { name: "עוגת קוגלהוף", re: /קוגלהוף|kugelhopf/i, kcal100g: 362, unitGrams: 80 },
    { name: "פאי אגוזי מלך ודבש", re: /פאי אגוזי מלך/i, kcal100g: 433, unitGrams: 90 },
    { name: "עוגת אופרה", re: /עוגת אופרה|opera cake/i, kcal100g: 387, unitGrams: 80 },
    { name: "עוגת סנט אונורה", re: /סנט אונורה|saint.?honor[ée]/i, kcal100g: 340, unitGrams: 100 },
    // אגוזים/פיצוחים - כמה מהם חדשים לגמרי (לא היו במאגר), אחרים (בוטנים
    // מצופים/קוקטייל) חייבים לבוא *לפני* בוטנים הכללי בהמשך
    { name: "פיסטוק", re: /פיסטוק(ים)?|pistachios?/i, kcal100g: 560, unitGrams: 30 },
    { name: "אגוזי לוז", re: /אגוזי לוז|hazelnuts?/i, kcal100g: 628, unitGrams: 30 },
    { name: "אגוזי ברזיל", re: /אגוזי ברזיל|brazil nuts?/i, kcal100g: 656, unitGrams: 30 },
    { name: "אגוזי מקדמיה", re: /אגוזי מקדמיה|macadamia nuts?/i, kcal100g: 718, unitGrams: 30 },
    { name: "גרעיני חמניה", re: /גרעיני חמניה|sunflower seeds?/i, kcal100g: 584, unitGrams: 30 },
    { name: "בוטנים מצופים/קוקטייל", re: /בוטנים (אמריקאים|קוקטייל)|בוטנים מצופים/i, kcal100g: 516, unitGrams: 30 },
    { name: "תערובת פיצוחים קלויה", re: /תערובת פיצוחים|שקדיה|קליית גת/i, kcal100g: 583, unitGrams: 30 },
    { name: "Ruffles Cheddar & Sour Cream", re: /ruffles.*cheddar/i, kcal100g: 571, unitGrams: 28 },
    { name: "Pringles Pizza", re: /pringles pizza/i, kcal100g: 525, unitGrams: 20 },
    { name: "Combos", re: /\bcombos\b/i, kcal100g: 479, unitGrams: 48 },
    { name: "Stacy's Pita Chips", re: /stacy'?s pita chips/i, kcal100g: 464, unitGrams: 28 },
    { name: "Popchips", re: /popchips/i, kcal100g: 434, unitGrams: 23 },
    { name: "Smartfood", re: /smartfood/i, kcal100g: 571, unitGrams: 28 },
    { name: "Cheez-It Snap'd", re: /cheez.?it snap'?d/i, kcal100g: 500, unitGrams: 30 },
    { name: "Skips Prawn Cocktail", re: /skips prawn cocktail/i, kcal100g: 523, unitGrams: 17 },
    { name: "Chio Pom-Bär", re: /pom.?b[äa]r/i, kcal100g: 526, unitGrams: 30 },
    { name: "Lorenz Saltletts", re: /saltletts/i, kcal100g: 390, unitGrams: 30 },
    { name: "Lays Bugles Nacho Cheese", re: /lays bugles/i, kcal100g: 543, unitGrams: 30 },
    { name: "Calbee Green Pea Crisps", re: /green pea crisps?|snapea/i, kcal100g: 464, unitGrams: 28 },
    { name: "Oishi Pillows", re: /oishi pillows/i, kcal100g: 500, unitGrams: 38 },
    { name: "Nissin Crisp Pizza", re: /nissin crisp/i, kcal100g: 516, unitGrams: 30 },
    // unitGrams תוקן מ-30 (שגוי - זה היה מחשב "4 בייגלה" כאילו 120 גרם) ל-1.35
    // - בייגלה הוא חטיף זעיר, לא חטיף בגודל-30-גרם ליחידה. אושר מול נתון
    // אמיתי: "4 יחידות בייגלה ≈ 5.4 גרם" (כ-1.35 גרם ליחידה) - דיווח אמיתי
    // הראה "4 בייגלה שטוחים" יוצא כ-472 קלוריות בעצמו במקום כ-20-30 האמיתיים
    { name: "בייגלה שמיניות", re: /בייגלה שמיניות/i, kcal100g: 383, unitGrams: 1.35 },
    { name: "בייגלה שטוחים", re: /בייגלה שטוחים/i, kcal100g: 393, unitGrams: 1.35 },
    { name: "Toblerone Dark", re: /toblerone dark/i, kcal100g: 528, unitGrams: 12.5 },
    { name: "Toblerone White", re: /toblerone white/i, kcal100g: 535, unitGrams: 12.5 },
    { name: "Lindt Excellence Sea Salt", re: /lindt.*sea salt/i, kcal100g: 526, unitGrams: 10 },
    { name: "Lindt Lindor", re: /lindor/i, kcal100g: 632, unitGrams: 12.5 },
    { name: "Milka Whole Hazelnuts", re: /milka.*hazelnuts?/i, kcal100g: 555, unitGrams: 6.7 },
    { name: "Ritter Sport Butter Biscuit", re: /ritter sport.*butter biscuit/i, kcal100g: 547, unitGrams: 6.25 },
    { name: "Hershey's Cookies 'n' Cream", re: /hershey'?s cookies.*cream/i, kcal100g: 511, unitGrams: 43 },
    { name: "Hershey's Special Dark", re: /hershey'?s special dark/i, kcal100g: 463, unitGrams: 41 },
    { name: "אצבעות שוקולד פרה קרם חלב", re: /אצבעות.*פרה|פרה.*אצבעות/i, kcal100g: 544, unitGrams: 12.5 },
    { name: "חטיף אגוזי (עלית)", re: /חטיף אגוזי/i, kcal100g: 522, unitGrams: 45 },
    { name: "חטיף טמיגוד", re: /טמיגוד/i, kcal100g: 520, unitGrams: 25 },
    { name: "Mamba Fruit Chews", re: /\bmamba\b/i, kcal100g: 400, unitGrams: 6.5 },
    { name: "Werther's Original", re: /werther'?s/i, kcal100g: 403, unitGrams: 5.2 },
    { name: "Tic Tac", re: /tic tac/i, kcal100g: 400, unitGrams: 0.5 },
    { name: "Life Savers", re: /life savers?/i, kcal100g: 375, unitGrams: 4 },
    { name: "Fanta", re: /fanta/i, kcal100g: 48, unitGrams: 330 },
    { name: "Sprite", re: /sprite/i, kcal100g: 37, unitGrams: 330 },
    { name: "Dr Pepper", re: /dr\.? pepper/i, kcal100g: 42, unitGrams: 355 },
    { name: "Mountain Dew", re: /mountain dew/i, kcal100g: 48, unitGrams: 355 },
    { name: "Schweppes מנגו-פסיפלורה", re: /שוופס|schweppes/i, kcal100g: 38, unitGrams: 200 },
    { name: "7UP", re: /7.?up/i, kcal100g: 40, unitGrams: 330 },
    { name: "Red Bull Sugarfree", re: /red bull.*(sugar.?free|zero)/i, kcal100g: 3, unitGrams: 250 },
    { name: "Red Bull", re: /red bull/i, kcal100g: 45, unitGrams: 250 },
    { name: "Monster Ultra White", re: /monster ultra/i, kcal100g: 2, unitGrams: 500 },
    { name: "Monster Energy", re: /monster energy/i, kcal100g: 42, unitGrams: 500 },
    { name: "XL Energy Drink", re: /\bxl\b energy/i, kcal100g: 46, unitGrams: 250 },
    { name: "BLU Energy Drink", re: /\bblu\b energy/i, kcal100g: 45, unitGrams: 250 },
    { name: "Starbucks Frappuccino", re: /frappuccino/i, kcal100g: 71, unitGrams: 281 },
    { name: "Starbucks Doubleshot", re: /doubleshot espresso/i, kcal100g: 70, unitGrams: 200 },
    { name: "קפה קר יוטבתה", re: /קפה קר יוטבתה/i, kcal100g: 65, unitGrams: 250 },
    { name: "שוקו מילקה/קאקאו אירופה", re: /שוקו מילקה|שוקו קאקד/i, kcal100g: 76, unitGrams: 250 },
    { name: "משקה חלבון Pro קפה", re: /משקה חלבון.*קפה|pro.*coffee protein/i, kcal100g: 60, unitGrams: 300 },
    { name: "AriZona Iced Tea", re: /arizona iced tea/i, kcal100g: 35, unitGrams: 680 },
    { name: "Fuze Tea", re: /fuze tea/i, kcal100g: 36, unitGrams: 200 },
    { name: "פריגת תפוזים טבעי", re: /פריגת תפוזים/i, kcal100g: 45, unitGrams: 200 },
    { name: "פריגורט", re: /פריגורט/i, kcal100g: 48, unitGrams: 200 },
    { name: "Ocean Spray Cranberry", re: /ocean spray/i, kcal100g: 46, unitGrams: 240 },
    { name: "מילקשייק מקדונלד'ס", re: /מילקשייק מקדונלד|mcdonald'?s (milk)?shake/i, kcal100g: 105, unitGrams: 400 },
    { name: "באבל טי", re: /באבל טי|bubble tea/i, kcal100g: 80, unitGrams: 500 },
    // "חטיף דגנים" (חטיף בודד ולא קערת דגני בוקר) חייב לבוא *לפני* גרסאות
    // הקערה למטה - ערך קלורי שונה ליחידה
    { name: "חטיף דגנים כריות שוקולד", re: /חטיף דגנים כריות שוקולד/i, kcal100g: 460, unitGrams: 25 },
    { name: "חטיף דגנים כריות נוגט", re: /חטיף דגנים כריות נוגט/i, kcal100g: 464, unitGrams: 25 },
    { name: "כריות שוקולד", re: /כריות שוקולד/i, kcal100g: 486, unitGrams: 30 },
    { name: "כריות וניל/נוגט", re: /כריות (וניל|נוגט)/i, kcal100g: 480, unitGrams: 30 },
    { name: "קוקו פיבלס/פאפס", re: /קוקו (פיבלס|פאפס)|cocoa (pebbles|puffs)/i, kcal100g: 390, unitGrams: 30 },
    { name: "Froot Loops", re: /froot loops/i, kcal100g: 366, unitGrams: 30 },
    { name: "Cinnamon Toast Crunch", re: /cinnamon toast crunch/i, kcal100g: 433, unitGrams: 30 },
    { name: "Cheerios Honey Nut Medley Crunch", re: /cheerio'?s? honey nut medley/i, kcal100g: 400, unitGrams: 30 },
    { name: "Cheerios Honey Nut", re: /cheerio'?s? honey nut/i, kcal100g: 383, unitGrams: 30 },
    { name: "Cheerios Multigrain", re: /cheerio'?s? multigrain/i, kcal100g: 350, unitGrams: 30 },
    { name: "שוגי/עוגי", re: /שוגי|עוגי דגני בוקר/i, kcal100g: 393, unitGrams: 30 },
    { name: "פלקס שוקולד/קורנפלקס צהוב", re: /פלקס שוקולד|קורנפלקס צהוב/i, kcal100g: 380, unitGrams: 30 },
    { name: "Nature Valley Protein Peanut Butter", re: /nature valley protein.*peanut/i, kcal100g: 475, unitGrams: 40 },
    { name: "Nature Valley Peanut Butter", re: /nature valley.*peanut/i, kcal100g: 452, unitGrams: 42 },
    { name: "Nature Valley Oats & Honey", re: /nature valley/i, kcal100g: 452, unitGrams: 42 },
    { name: "Corny Big Banana Chocolate", re: /corny.*banana/i, kcal100g: 430, unitGrams: 50 },
    { name: "Corny Big Coconut Chocolate", re: /corny.*coconut/i, kcal100g: 460, unitGrams: 50 },
    { name: "Corny Big Chocolate", re: /\bcorny\b/i, kcal100g: 440, unitGrams: 50 },
    { name: "Barebells", re: /barebells/i, kcal100g: 370, unitGrams: 55 },
    { name: "Freezly", re: /freezly/i, kcal100g: 391, unitGrams: 23.5 },
    { name: "לחמניית המבורגר/נקניקייה", re: /לחמניית (המבורגר|נקניקיה)/i, kcal100g: 278, unitGrams: 70 },
    { name: "Wasa Crispbread", re: /\bwasa\b/i, kcal100g: 366, unitGrams: 9 },
    { name: "Ritz Crackers", re: /\britz\b/i, kcal100g: 500, unitGrams: 16 },
    { name: "לחמית כפרית", re: /לחמית כפרית/i, kcal100g: 400, unitGrams: 7 },
    { name: "קרקר זהב", re: /קרקר זהב/i, kcal100g: 475, unitGrams: 20 },
    { name: "פיטנס קרקר", re: /פיטנס קרקר/i, kcal100g: 416, unitGrams: 18 },
    { name: "Skippy Super Chunk", re: /skippy super chunk/i, kcal100g: 600, unitGrams: 20 },
    { name: "Skippy Creamy", re: /skippy/i, kcal100g: 590, unitGrams: 20 },
    { name: "חמאת בוטנים טבעית 100%", re: /חמאת בוטנים טבעית|natural (100%)? peanut butter/i, kcal100g: 610, unitGrams: 20 },
    { name: "ממרח קינדר/קרם חלב ואגוזים", re: /ממרח קינדר|קרם חלב ואגוזים/i, kcal100g: 560, unitGrams: 20 },
    { name: "מילקי TOP", re: /מילקי top|מילקי טופ/i, kcal100g: 191, unitGrams: 120 },
    { name: "מילקי וניל/קצפת", re: /מילקי (וניל|קצפת)/i, kcal100g: 146, unitGrams: 133 },
    { name: "מילקי שוקולד", re: /מילקי(?! (top|טופ))/i, kcal100g: 158, unitGrams: 133 },
    { name: "מעדן דני", re: /מעדן דני/i, kcal100g: 108, unitGrams: 125 },
    { name: "מעדן קרלו", re: /מעדן קרלו/i, kcal100g: 104, unitGrams: 125 },
    { name: "Danette", re: /danette|דנט שוקולד/i, kcal100g: 112, unitGrams: 125 },
    { name: "גמדאים/גמדים", re: /גמדאים|גמדים תות/i, kcal100g: 95, unitGrams: 100 },
    { name: "יוגורט מולר", re: /יוגורט מולר|müller/i, kcal100g: 96, unitGrams: 150 },
    { name: "יוגורט דנון מולטי", re: /דנון מולטי/i, kcal100g: 125, unitGrams: 140 },
    { name: "Hellmann's", re: /hellmann'?s/i, kcal100g: 642, unitGrams: 14 },
    // עודכן ל-133 (מ-285, שהיה שגוי) לפי נתון מדויק מהמשתמשת (מיונז לייט 9% שומן)
    { name: "מיונז לייט", re: /מיונז לייט|מיונז מופחת/i, kcal100g: 133, unitGrams: 15 },
    { name: "Sweet Baby Ray's", re: /sweet baby ray'?s/i, kcal100g: 194, unitGrams: 18 },
    { name: "Sriracha", re: /שריראצ'ה|sriracha/i, kcal100g: 100, unitGrams: 5 },
    { name: "רוטב אלף האיים", re: /אלף האיים|thousand island/i, kcal100g: 366, unitGrams: 15 },
    { name: "סירופ מייפל טבעי", re: /סירופ מייפל|maple syrup/i, kcal100g: 260, unitGrams: 20 },
    { name: "Hershey's Chocolate Syrup", re: /hershey'?s.*syrup/i, kcal100g: 263, unitGrams: 19 },
    { name: "Doritos Sweet Chili Pepper", re: /doritos.*sweet chili/i, kcal100g: 495, unitGrams: 44 },
    { name: "Lay's Kettle Cooked Jalapeño", re: /kettle cooked jalape[nñ]o|lay'?s.*jalape[nñ]o/i, kcal100g: 535, unitGrams: 28 },
    { name: "SkinnyPop", re: /skinnypop/i, kcal100g: 535, unitGrams: 28 },
    { name: "Pretzel Crisps", re: /pretzel crisps/i, kcal100g: 392, unitGrams: 28 },
    { name: "תפוצ'יפס מלח ים ופלפל שחור", re: /תפוצ['׳]?יפס.*(מלח ים|פלפל שחור)/i, kcal100g: 520, unitGrams: 50 },
    { name: "פופקורן מתוק/קרמל", re: /פופקורן (מתוק|קרמל)|orville redenbacher/i, kcal100g: 466, unitGrams: 30 },
    { name: "Seaweed Rice Crispy", re: /seaweed rice crispy/i, kcal100g: 475, unitGrams: 20 },
    { name: "Calbee Shrimp Chips Original", re: /calbee shrimp chips original/i, kcal100g: 464, unitGrams: 28 },
    { name: "Tao Kae Noi", re: /tao kae noi/i, kcal100g: 533, unitGrams: 15 },
    { name: "קרם שניט", re: /קרם שניט|קרמשניט/i, kcal100g: 310, unitGrams: 100 },
    { name: "עוגת מוס גבינה ופירורים", re: /עוגת מוס גבינה/i, kcal100g: 309, unitGrams: 110 },
    { name: "פאי שוקולד ולוז אישי", re: /פאי שוקולד ולוז/i, kcal100g: 433, unitGrams: 90 },
    { name: "טארטלט פירות יער/לימון", re: /טארטלט/i, kcal100g: 312, unitGrams: 80 },
    { name: "Clif Bar", re: /clif bar/i, kcal100g: 367, unitGrams: 68 },
    { name: "RXBAR", re: /rxbar/i, kcal100g: 403, unitGrams: 52 },
    { name: "Kind Bar", re: /\bkind bar\b/i, kcal100g: 500, unitGrams: 40 },
    { name: "Nerds Candy", re: /\bnerds\b/i, kcal100g: 400, unitGrams: 15 },
    { name: "Swedish Fish", re: /swedish fish/i, kcal100g: 366, unitGrams: 30 },
    { name: "Starburst", re: /starburst/i, kcal100g: 416, unitGrams: 18 },
    { name: "בייגלה שמיניות כוסמין", re: /בייגלה שמיניות.*כוסמין/i, kcal100g: 366, unitGrams: 1.35 },
    { name: "Kasugai Fruit Gummies", re: /kasugai/i, kcal100g: 330, unitGrams: 20 },
    { name: "פאי אגוזי לוז ושוקולד", re: /פאי אגוזי לוז/i, kcal100g: 438, unitGrams: 90 },
    { name: "עוגת קראנץ' שוקולד וחלבה", re: /עוגת קראנץ'? שוקולד וחלבה/i, kcal100g: 400, unitGrams: 60 },
    { name: "עוגת בבקה פרג ושקדים", re: /בבקה פרג/i, kcal100g: 375, unitGrams: 60 },
    { name: "מאפה דניש קינמון", re: /דניש קינמון|danish pastry/i, kcal100g: 388, unitGrams: 85 },
    { name: "Fulfil Protein Bar", re: /fulfil/i, kcal100g: 367, unitGrams: 55 },
    { name: "ערמונים קלויים", re: /ערמונים קלויים|roasted chestnuts?/i, kcal100g: 181, unitGrams: 80 },
    { name: "פירות יער קפואים", re: /פירות יער קפואים|frozen berries/i, kcal100g: 50, unitGrams: 100 },
    { name: "Toxic Waste", re: /toxic waste/i, kcal100g: 388, unitGrams: 9 },
    { name: "Warheads", re: /warheads/i, kcal100g: 333, unitGrams: 15 },
    { name: "Jelly Belly", re: /jelly belly/i, kcal100g: 366, unitGrams: 30 },
    { name: "Push Pop", re: /push pop/i, kcal100g: 400, unitGrams: 15 },
    { name: "Ring Pop", re: /ring pop/i, kcal100g: 392, unitGrams: 14 },
    { name: "שוש במבה/חטיף בוטנים מוזהב", re: /שוש במבה|חטיף בוטנים מוזהב/i, kcal100g: 537, unitGrams: 40 },
    { name: "Yanmaru Rice Crackers", re: /yanmaru/i, kcal100g: 420, unitGrams: 25 },
    { name: "Everyburger", re: /everyburger/i, kcal100g: 522, unitGrams: 66 },
    { name: "פאי פיסטוק וערמונים", re: /פאי פיסטוק/i, kcal100g: 422, unitGrams: 90 },
    { name: "מאפה שבלול שוקולד ולוז", re: /שבלול שוקולד/i, kcal100g: 400, unitGrams: 90 },
    { name: "עוגת בראוניז חמאת פיסטוק", re: /בראוניז.*חמאת פיסטוק|בראוני.*חמאת פיסטוק/i, kcal100g: 484, unitGrams: 65 },
    { name: "טארט אגסים ושקדים", re: /טארט אגסים|frangipane/i, kcal100g: 320, unitGrams: 100 },
    { name: "BSN Syntha-6 Bar", re: /syntha.?6/i, kcal100g: 383, unitGrams: 60 },
    { name: "Warrior CRUNCH", re: /warrior crunch/i, kcal100g: 373, unitGrams: 64 },
    { name: "ערמונים מסוכרים", re: /ערמונים מסוכרים|marron glac[ée]/i, kcal100g: 325, unitGrams: 20 },
    { name: "ממרח פסק זמן", re: /ממרח פסק זמן/i, kcal100g: 550, unitGrams: 20 },
    { name: "קשיו מצופה דבש/סוכר", re: /קשיו מצופה/i, kcal100g: 550, unitGrams: 30 },
    { name: "בוטנים מצופים שוקולד חלב", re: /בוטנים מצופים שוקולד/i, kcal100g: 533, unitGrams: 30 },
    { name: "Nestlé Aero Peppermint", re: /\baero\b.*peppermint|peppermint aero/i, kcal100g: 538, unitGrams: 36 },
    { name: "Ruffles All Dressed", re: /ruffles all dressed/i, kcal100g: 536, unitGrams: 28 },
    // דגני בוקר/גרנולה/דייסות/חטיפי דגנים - קטגוריה חדשה לגמרי במאגר, אין
    // ערך כללי "דגני בוקר" שהיה בולע אותם, רק כמה התנגשויות ספציפיות מטופלות
    // בנפרד למעלה (Cheerios Honey Nut Medley, נסקוויק, כריות חטיף)
    { name: "קורנפלקס תלמה קלאסי (האלופים)", re: /קורנפלקס תלמה|האלופים/i, kcal100g: 376, unitGrams: 30 },
    { name: "ברפלקס פלוס", re: /ברפלקס פלוס/i, kcal100g: 360, unitGrams: 30 },
    { name: "ברפלקס קלאסי", re: /ברפלקס(?! פלוס)/i, kcal100g: 293, unitGrams: 30 },
    { name: "דליפייק תפוח קינמון/שקדים", re: /דליפייק תפוח|דליפייק.*שקדים/i, kcal100g: 390, unitGrams: 30 },
    { name: "דליפייק פציצי אורז", re: /דליפייק פציצי/i, kcal100g: 360, unitGrams: 30 },
    { name: "ברנפלקס קרנצ'ים שוקולד", re: /ברנפלקס קרנצ'?ים שוקולד/i, kcal100g: 383, unitGrams: 30 },
    { name: "ברנפלקס קרנצ'ים שקדים ומייפל", re: /ברנפלקס קרנצ'?ים.*שקדים/i, kcal100g: 393, unitGrams: 30 },
    { name: "ברנפלקס קרנצ'ים פירות יבשים", re: /ברנפלקס קרנצ'?ים.*פירות/i, kcal100g: 373, unitGrams: 30 },
    { name: "ברנפלקס ללא תוספת סוכר", re: /ברנפלקס ללא תוספת סוכר/i, kcal100g: 273, unitGrams: 30 },
    { name: "ברנפלקס ללא גלוטן", re: /ברנפלקס ללא גלוטן/i, kcal100g: 366, unitGrams: 30 },
    { name: "ברנפלקס EXTRA סיבים", re: /ברנפלקס extra/i, kcal100g: 263, unitGrams: 30 },
    { name: "ברנפלקס פינוקים תות ושוקולד לבן", re: /ברנפלקס פינוקים/i, kcal100g: 386, unitGrams: 30 },
    { name: "כריות נוגט ללא גלוטן", re: /כריות נוגט ללא גלוטן/i, kcal100g: 473, unitGrams: 30 },
    { name: "Fitness Chocolate", re: /fitness chocolate/i, kcal100g: 393, unitGrams: 30 },
    { name: "Fitness Fruits", re: /fitness fruits?/i, kcal100g: 366, unitGrams: 30 },
    { name: "Fitness Classic", re: /\bfitness\b(?! (chocolate|fruits?))/i, kcal100g: 370, unitGrams: 30 },
    { name: "Nesquik Chocolate Cereal", re: /nesquik.*cereal/i, kcal100g: 387, unitGrams: 30 },
    { name: "Chocapic", re: /chocapic/i, kcal100g: 388, unitGrams: 30 },
    { name: "Lion Cereal", re: /lion cereal/i, kcal100g: 410, unitGrams: 30 },
    { name: "Kellogg's Frosted Flakes Chocolate", re: /frosted flakes chocolate/i, kcal100g: 383, unitGrams: 30 },
    { name: "Kellogg's Frosted Flakes", re: /frosted flakes/i, kcal100g: 383, unitGrams: 30 },
    { name: "Kellogg's Corn Flakes", re: /corn flakes/i, kcal100g: 378, unitGrams: 30 },
    { name: "Kellogg's Special K Red Berries", re: /special k.*(red )?berries/i, kcal100g: 373, unitGrams: 30 },
    { name: "Kellogg's Special K", re: /special k/i, kcal100g: 380, unitGrams: 30 },
    { name: "Kellogg's Smacks", re: /\bsmacks\b/i, kcal100g: 380, unitGrams: 30 },
    { name: "Kellogg's Honey Smacks", re: /honey smacks/i, kcal100g: 366, unitGrams: 30 },
    { name: "Kellogg's Krave", re: /\bkrave\b/i, kcal100g: 430, unitGrams: 30 },
    { name: "Nestlé Cookie Crisp", re: /cookie crisp/i, kcal100g: 380, unitGrams: 30 },
    { name: "Nestlé Cini Minis", re: /cini minis/i, kcal100g: 420, unitGrams: 30 },
    { name: "Kellogg's All-Bran Flakes", re: /all.?bran flakes/i, kcal100g: 356, unitGrams: 30 },
    { name: "Nestlé Choco Crossies Cereal", re: /choco crossies/i, kcal100g: 416, unitGrams: 30 },
    { name: "Post Shredded Wheat", re: /shredded wheat/i, kcal100g: 346, unitGrams: 49 },
    { name: "Rice Krispies Original", re: /rice krispies( original)?(?! treats?)/i, kcal100g: 383, unitGrams: 30 },
    { name: "Raisin Bran", re: /raisin bran/i, kcal100g: 325, unitGrams: 40 },
    { name: "Grape-Nuts", re: /grape.?nuts/i, kcal100g: 375, unitGrams: 40 },
    { name: "Honey Bunches of Oats with Almonds", re: /honey bunches.*almonds?/i, kcal100g: 410, unitGrams: 30 },
    { name: "Honey Bunches of Oats", re: /honey bunches/i, kcal100g: 400, unitGrams: 30 },
    { name: "Wheaties", re: /wheaties/i, kcal100g: 366, unitGrams: 30 },
    { name: "Life Cereal Cinnamon", re: /life cereal cinnamon/i, kcal100g: 400, unitGrams: 30 },
    { name: "Life Cereal", re: /life cereal/i, kcal100g: 400, unitGrams: 30 },
    { name: "Quaker Oatmeal Squares", re: /oatmeal squares/i, kcal100g: 400, unitGrams: 40 },
    { name: "Kellogg's Frosted Mini-Wheats", re: /frosted mini.?wheats/i, kcal100g: 375, unitGrams: 40 },
    { name: "Weetabix", re: /weetabix/i, kcal100g: 362, unitGrams: 37.5 },
    { name: "Quaker Cap'n Crunch", re: /cap'?n crunch/i, kcal100g: 441, unitGrams: 34 },
    { name: "Post Fruity Pebbles", re: /fruity pebbles/i, kcal100g: 400, unitGrams: 30 },
    { name: "Kellogg's Corn Pops", re: /corn pops/i, kcal100g: 400, unitGrams: 30 },
    { name: "Golden Grahams", re: /golden grahams/i, kcal100g: 400, unitGrams: 30 },
    { name: "Monster Cereals", re: /monster cereals?|count chocula/i, kcal100g: 388, unitGrams: 36 },
    { name: "Cascadian Farm Granola", re: /cascadian farm/i, kcal100g: 420, unitGrams: 50 },
    { name: "גרנולה שוקולד צ'יפס", re: /גרנולה שוקולד צ'יפס/i, kcal100g: 470, unitGrams: 40 },
    { name: "גרנולה קלאסית עם דבש ואגוזים", re: /גרנולה( קלאסית)?/i, kcal100g: 450, unitGrams: 40 },
    { name: "מיוזלי ללא תוספת סוכר", re: /מיוזלי/i, kcal100g: 362, unitGrams: 40 },
    { name: "Quaker Instant Oatmeal Maple", re: /instant oatmeal.*maple/i, kcal100g: 372, unitGrams: 43 },
    { name: "Quaker Instant Oatmeal Apples", re: /instant oatmeal.*apples?/i, kcal100g: 372, unitGrams: 43 },
    { name: "שיבולת שועל קוואקר קלאסית", re: /שיבולת שועל קוואקר|quaker oats/i, kcal100g: 375, unitGrams: 40 },
    { name: "Kellogg's Nutri-Grain", re: /nutri.?grain/i, kcal100g: 351, unitGrams: 37 },
    { name: "חטיף דגנים ברנפלקס תפוח", re: /חטיף דגנים ברנפלקס/i, kcal100g: 375, unitGrams: 20 },
    { name: "Quaker Chewy Granola Bars", re: /chewy granola bars?/i, kcal100g: 416, unitGrams: 24 },
    { name: "חטיף דגנים פיטנס תות", re: /חטיף דגנים פיטנס/i, kcal100g: 382, unitGrams: 23.5 },
    { name: "Cheerios Treat Bar", re: /cheerios treat bar/i, kcal100g: 416, unitGrams: 24 },
    // ריבות/ממרחים/רטבים בינלאומיים - מגוון ענק, נתונים מדויקים מהמשתמשת.
    // רוב הריבות ה"קלאסיות" קרובות מספיק לערך הכללי (ריבה, 250) ולא קיבלו
    // ערך נפרד; רק גרסאות עם הבדל קלורי אמיתי (ללא סוכר/100% פרי/ממתקי
    // פרי סמיכים) קיבלו ערך ייעודי
    { name: "ריבה ללא תוספת סוכר", re: /ריבת? .*ללא תוספת סוכר|ריבה דיאט/i, kcal100g: 155, unitGrams: 20 },
    { name: "ריבת St Dalfour/100% פרי", re: /st\.? ?dalfour|ריבת? .*100% פרי/i, kcal100g: 210, unitGrams: 20 },
    { name: "ריבת גויאבה/חבושים מוצקה", re: /ריבת גויאבה|guava paste|ריבת חבושים מוצקה|dulce de membrillo/i, kcal100g: 275, unitGrams: 30 },
    { name: "טחינה גולמית איכותית", re: /טחינה (גולמית|משומשום מלא)/i, kcal100g: 640, unitGrams: 15 },
    { name: "חמאת שקדים", re: /חמאת שקדים|almond butter/i, kcal100g: 620, unitGrams: 20 },
    { name: "חמאת אגוזי לוז", re: /חמאת אגוזי לוז|hazelnut butter/i, kcal100g: 650, unitGrams: 20 },
    { name: "חמאת קשיו", re: /חמאת קשיו|cashew butter/i, kcal100g: 580, unitGrams: 20 },
    { name: "חמאת מקדמיה", re: /חמאת מקדמיה|macadamia butter/i, kcal100g: 718, unitGrams: 20 },
    { name: "חמאת אגוזי מלך", re: /חמאת אגוזי מלך|walnut butter/i, kcal100g: 654, unitGrams: 20 },
    { name: "חמאת גרעיני דלעת", re: /חמאת גרעיני דלעת|pumpkin seed butter/i, kcal100g: 574, unitGrams: 20 },
    { name: "חמאת גרעיני חמניה", re: /חמאת גרעיני חמניה|sunflower seed butter|sunbutter/i, kcal100g: 600, unitGrams: 20 },
    { name: "ממרח שקדים וקקאו ללא סוכר", re: /שקדים וקקאו ללא סוכר/i, kcal100g: 550, unitGrams: 20 },
    { name: "ממרח פסטו", re: /פסטו|pesto/i, kcal100g: 450, unitGrams: 15 },
    { name: "ממרח עגבניות מיובשות", re: /עגבניות מיובשות.*ממרח|ממרח עגבניות מיובשות|sun.?dried tomato spread/i, kcal100g: 433, unitGrams: 15 },
    { name: "טפנאד זיתים", re: /טפנאד|tapenade/i, kcal100g: 300, unitGrams: 15 },
    { name: "ממרח חלב וקקאו (עלית)", re: /ממרח חלב וקקאו/i, kcal100g: 545, unitGrams: 20 },
    { name: "ממרח קראנץ' חלבה ושוקולד", re: /קראנץ'? חלבה ושוקולד/i, kcal100g: 560, unitGrams: 20 },
    { name: "Marshmallow Fluff", re: /marshmallow fluff/i, kcal100g: 333, unitGrams: 12 },
    { name: "Marmite", re: /marmite/i, kcal100g: 260, unitGrams: 5 },
    { name: "Vegemite", re: /vegemite/i, kcal100g: 180, unitGrams: 5 },
    { name: "Speculoos Spread", re: /speculoos/i, kcal100g: 575, unitGrams: 20 },
    { name: "Halva Spread with Cocoa", re: /halva spread.*cocoa/i, kcal100g: 550, unitGrams: 20 },
    { name: "Halva Spread", re: /halva spread/i, kcal100g: 540, unitGrams: 20 },
    { name: "קרם פיסטוק לזילוף", re: /קרם פיסטוק|pistachio cream|kremy pistacjowy|spucatella/i, kcal100g: 585, unitGrams: 20 },
    { name: "ממרח שוקולד לבן וקוקוס", re: /שוקולד לבן וקוקוס/i, kcal100g: 560, unitGrams: 20 },
    { name: "סירופ אגאבה", re: /סירופ אגאבה|agave (syrup|nectar)/i, kcal100g: 310, unitGrams: 20 },
    { name: "רכז רימונים", re: /רכז רימונים|pomegranate molasses/i, kcal100g: 270, unitGrams: 20 },
    { name: "סילאן 100% ללא תוספת סוכר", re: /סילאן.*100%|סילאן.*ללא תוספת סוכר|סילאן.*אורגני/i, kcal100g: 280, unitGrams: 20 },
    { name: "סילאן לייט", re: /סילאן לייט|סילאן מופחת/i, kcal100g: 175, unitGrams: 20 },
    { name: "מלאסה", re: /מלאסה|molasses/i, kcal100g: 290, unitGrams: 20 },
    { name: "Golden Syrup", re: /golden syrup/i, kcal100g: 300, unitGrams: 20 },
    { name: "Treacle", re: /\btreacle\b/i, kcal100g: 290, unitGrams: 20 },
    { name: "תחליף דבש ללא סוכר", re: /תחליף דבש ללא סוכר/i, kcal100g: 100, unitGrams: 20 },
    { name: "רוטב קרמל מלוח לקינוח", re: /רוטב קרמל מלוח.*(מקצועי|monin|torani)/i, kcal100g: 350, unitGrams: 20 },
    { name: "Hot Fudge Sauce", re: /hot fudge/i, kcal100g: 375, unitGrams: 20 },
    { name: "גואקמולה ארוז", re: /גואקמולה ארוז/i, kcal100g: 150, unitGrams: 30 },
    { name: "Garlic Aioli", re: /garlic aioli|aioli proven[cç]al/i, kcal100g: 633, unitGrams: 15 },
    { name: "Ranch Dressing", re: /ranch dressing|hidden valley/i, kcal100g: 486, unitGrams: 15 },
    { name: "חרדל דיז'ון גרגרים", re: /דיז'ון גרגרים|dijon.*(grain|moutarde de meaux)/i, kcal100g: 150, unitGrams: 10 },
    { name: "חרדל דבש", re: /חרדל דבש|honey mustard(?! dressing)/i, kcal100g: 300, unitGrams: 15 },
    { name: "Ajvar", re: /ajvar/i, kcal100g: 110, unitGrams: 20 },
    { name: "ממרח אריסה טוניסאית", re: /אריסה|harissa(?! (green|red))/i, kcal100g: 266, unitGrams: 15 },
    { name: "סחוג", re: /סחוג|zhoug|skhug/i, kcal100g: 250, unitGrams: 10 },
    { name: "Dulce de Leche Mardel", re: /mardel/i, kcal100g: 310, unitGrams: 20 },
    { name: "Kaya Jam", re: /\bkaya\b jam/i, kcal100g: 390, unitGrams: 20 },
    { name: "Apple Butter", re: /apple butter/i, kcal100g: 150, unitGrams: 20 },
    { name: "Lekvar", re: /\blekvar\b/i, kcal100g: 225, unitGrams: 20 },
    { name: "Clotted Cream", re: /clotted cream/i, kcal100g: 525, unitGrams: 20 },
    { name: "Chestnut Spread", re: /chestnut spread|cr[eè]me de marrons/i, kcal100g: 270, unitGrams: 20 },
    { name: "Biscoff Cookie Butter Crunch", re: /biscoff cookie butter/i, kcal100g: 575, unitGrams: 20 },
    { name: "Pimiento Cheese Spread", re: /pimiento cheese/i, kcal100g: 375, unitGrams: 20 },
    { name: "Toum (ממרח שום לבנוני)", re: /\btoum\b/i, kcal100g: 600, unitGrams: 15 },
    { name: "Gochujang", re: /gochujang/i, kcal100g: 200, unitGrams: 20 },
    { name: "Lemon Curd", re: /lemon curd/i, kcal100g: 375, unitGrams: 20 },
    { name: "Passionfruit Curd", re: /passionfruit curd/i, kcal100g: 360, unitGrams: 20 },
    { name: "Muhammara", re: /muhammara/i, kcal100g: 325, unitGrams: 20 },
    { name: "ChimiChurri", re: /chimichurri/i, kcal100g: 366, unitGrams: 15 },
    { name: "לימון כבוש ממרח", re: /לימון כבוש.*ממרח|ממרח.*לימון כבוש/i, kcal100g: 150, unitGrams: 10 },
    { name: "Tzatziki", re: /tzatziki/i, kcal100g: 100, unitGrams: 30 },
    { name: "Baba Ganoush", re: /baba ganoush/i, kcal100g: 150, unitGrams: 30 },
    { name: "Boursin", re: /boursin/i, kcal100g: 400, unitGrams: 20 },
    { name: "Liptauer", re: /liptauer/i, kcal100g: 275, unitGrams: 20 },
    { name: "Taramasalata", re: /taramasalata/i, kcal100g: 450, unitGrams: 20 },
    { name: "ממרח סויה בסגנון גבינה לבנה", re: /ממרח סויה.*גבינה לבנה|סויה.*גבינה לבנה 5%/i, kcal100g: 140, unitGrams: 30 },
    { name: "Sambal Oelek", re: /sambal oelek/i, kcal100g: 45, unitGrams: 5 },
    { name: "Hoisin Sauce", re: /hoisin/i, kcal100g: 220, unitGrams: 20 },
    { name: "רוטב פלפלים שחורים/סצ'ואן אסייתי", re: /black pepper sauce.*asian|szechuan sauce/i, kcal100g: 170, unitGrams: 20 },
    { name: "Tamarind Sauce", re: /tamarind sauce|tamarind chutney/i, kcal100g: 230, unitGrams: 20 },
    { name: "Satay Sauce", re: /satay sauce/i, kcal100g: 350, unitGrams: 20 },
    { name: "Ssamjang", re: /ssamjang/i, kcal100g: 175, unitGrams: 20 },
    { name: "Kecap Manis", re: /kecap manis/i, kcal100g: 210, unitGrams: 20 },
    { name: "Dashi Soy Sauce", re: /dashi soy/i, kcal100g: 80, unitGrams: 15 },
    { name: "Mango Chutney", re: /mango chutney/i, kcal100g: 230, unitGrams: 20 },
    { name: "Yuzu Kosho", re: /yuzu kosho/i, kcal100g: 100, unitGrams: 5 },
    { name: "Salsa Verde/Roja", re: /salsa (verde|roja)/i, kcal100g: 33, unitGrams: 30 },
    { name: "Mole Poblano", re: /mole poblano/i, kcal100g: 325, unitGrams: 20 },
    { name: "Chipotle in Adobo", re: /chipotle in adobo/i, kcal100g: 100, unitGrams: 15 },
    { name: "Chipotle Mayo", re: /chipotle mayo/i, kcal100g: 533, unitGrams: 15 },
    { name: "Salsa Chamoy", re: /salsa chamoy|\bchamoy\b/i, kcal100g: 100, unitGrams: 15 },
    { name: "Pico de Gallo", re: /pico de gallo/i, kcal100g: 26, unitGrams: 30 },
    { name: "Salsa Macha", re: /salsa macha/i, kcal100g: 633, unitGrams: 15 },
    { name: "Suero Costeño", re: /suero coste[nñ]o/i, kcal100g: 275, unitGrams: 20 },
    { name: "Pesto Rosso", re: /pesto rosso/i, kcal100g: 453, unitGrams: 15 },
    { name: "רוטב בריאני/טיקה מסאלה", re: /טיקה מסאלה|tikka masala sauce|biryani sauce/i, kcal100g: 150, unitGrams: 30 },
    { name: "רוטב ברבקיו טקסני מעושן", re: /ברבקיו.*טקסס|bull'?s.?eye|smoked bbq/i, kcal100g: 211, unitGrams: 18 },
    { name: "Fesenjan Base", re: /fesenjan/i, kcal100g: 425, unitGrams: 20 },
    { name: "חרדל טרגון", re: /חרדל טרגון|tarragon mustard/i, kcal100g: 180, unitGrams: 10 },
    { name: "Moutarde de Meaux", re: /moutarde de meaux/i, kcal100g: 160, unitGrams: 10 },
    { name: "Romesco Sauce", re: /romesco/i, kcal100g: 300, unitGrams: 20 },
    { name: "Skordalia", re: /skordalia/i, kcal100g: 200, unitGrams: 25 },
    { name: "Kyopolou", re: /kyopolou/i, kcal100g: 125, unitGrams: 20 },
    { name: "Tonkatsu Sauce", re: /tonkatsu/i, kcal100g: 155, unitGrams: 18 },
    { name: "Ponzu", re: /ponzu/i, kcal100g: 80, unitGrams: 15 },
    { name: "Peri-Peri Sauce", re: /peri.?peri sauce|nando'?s/i, kcal100g: 100, unitGrams: 15 },
    { name: "Enchilada Sauce", re: /enchilada sauce/i, kcal100g: 33, unitGrams: 60 },
    { name: "Fish Sauce", re: /fish sauce/i, kcal100g: 66, unitGrams: 15 },
    { name: "Gentleman's Relish", re: /gentleman'?s relish/i, kcal100g: 360, unitGrams: 5 },
    { name: "Mojo Picón", re: /mojo pic[oó]n/i, kcal100g: 300, unitGrams: 15 },
    { name: "חמאת מקדמיה 100%", re: /חמאת מקדמיה 100%/i, kcal100g: 718, unitGrams: 20 },
    { name: "Caesar Dressing Light", re: /caesar.*light/i, kcal100g: 233, unitGrams: 15 },
    { name: "Caesar Dressing", re: /caesar dressing/i, kcal100g: 486, unitGrams: 15 },
    { name: "Italian Dressing", re: /italian dressing/i, kcal100g: 286, unitGrams: 15 },
    { name: "Balsamic Vinaigrette", re: /balsamic vinaigrette|וינגרט בלסמי/i, kcal100g: 300, unitGrams: 15 },
    { name: "Goma Dressing", re: /goma dressing|kewpie/i, kcal100g: 400, unitGrams: 15 },
    { name: "Honey Mustard Dressing", re: /honey mustard dressing/i, kcal100g: 433, unitGrams: 15 },
    { name: "רוטב מרינרה לפסטה", re: /מרינרה לפסטה|marinara.*pasta/i, kcal100g: 52, unitGrams: 125 },
    { name: "Alfredo Sauce", re: /alfredo/i, kcal100g: 166, unitGrams: 60 },
    { name: "Worcestershire Sauce", re: /worcestershire/i, kcal100g: 96, unitGrams: 5 },
    { name: "רוטב פריאני/מקני באטר הודי", re: /פריאני.*הודי|makhani|korma sauce/i, kcal100g: 116, unitGrams: 120 },
    { name: "Petit Suisse", re: /petit suisse/i, kcal100g: 90, unitGrams: 60 },
    { name: "Skyr", re: /\bskyr\b/i, kcal100g: 80, unitGrams: 150 },
    { name: "Quark", re: /\bquark\b/i, kcal100g: 90, unitGrams: 150 },
    { name: "Muller Corner", re: /muller corner/i, kcal100g: 107, unitGrams: 130 },
    { name: "מעדן סויה שוקולד טבעוני", re: /מעדן סויה שוקולד/i, kcal100g: 80, unitGrams: 125 },
    { name: "אבקת קקאו הולנדי", re: /אבקת קקאו|dutch cocoa|cocoa powder/i, kcal100g: 320, unitGrams: 10 },
    { name: "אבקת מאצ'ה", re: /אבקת מאצ'ה|matcha powder/i, kcal100g: 300, unitGrams: 3 },
    { name: "אבקת שוקולית", re: /שוקולית|אבקת קקאו ממותק/i, kcal100g: 386, unitGrams: 15 },
    { name: "פצפוצי אורז מלא ללא סוכר", re: /פצפוצי אורז/i, kcal100g: 375, unitGrams: 20 },
    { name: "שבבי קוקוס קלוי", re: /שבבי קוקוס/i, kcal100g: 600, unitGrams: 20 },
    { name: "פולי קקאו גרוסים", re: /פולי קקאו|cacao nibs/i, kcal100g: 533, unitGrams: 15 },
    { name: "מרשמלו מיני", re: /מרשמלו( מיני)?|marshmallows?/i, kcal100g: 325, unitGrams: 20 },
    { name: "חצירי/לדר פרי", re: /חצירי|לדר (אפרסק|פרי)|fruit leather/i, kcal100g: 325, unitGrams: 20 },
    { name: "תמר מג'הול ענק עם אגוז מלך", re: /תמר.*אגוז מלך|תמר ממולא אגוז/i, kcal100g: 340, unitGrams: 25 },
    { name: "אננס מיובש", re: /אננס מיובש/i, kcal100g: 300, unitGrams: 30 },
    { name: "ג'ינג'ר מסוכר", re: /ג'ינג'ר מסוכר|candied ginger/i, kcal100g: 350, unitGrams: 20 },
    { name: "מנגו מיובש", re: /מנגו מיובש/i, kcal100g: 316, unitGrams: 30 },
    { name: "מרציפן גולמי", re: /מרציפן|marzipan(?! chocolate)/i, kcal100g: 460, unitGrams: 25 },
    { name: "סוכריית פנינה לעוגות", re: /סוכריית פנינה|פנינה לעוגות/i, kcal100g: 400, unitGrams: 15 },
    { name: "תמצית וניל טהורה", re: /תמצית וניל|vanilla bean paste/i, kcal100g: 240, unitGrams: 5 },
    { name: "שבבי שוקולד מריר לאפייה", re: /שבבי שוקולד(?! חלב)/i, kcal100g: 533, unitGrams: 15 },
    { name: "שוקולד רובי", re: /שוקולד רובי|ruby chocolate/i, kcal100g: 560, unitGrams: 10 },
    { name: "חמאת קקאו טהורה", re: /חמאת קקאו/i, kcal100g: 884, unitGrams: 15 },
    { name: "Gianduja", re: /gianduja|ג'אנדויה/i, kcal100g: 570, unitGrams: 10 },
    { name: "Wasabi Peas", re: /wasabi peas/i, kcal100g: 400, unitGrams: 30 },
    { name: "Rice Crackers with Seaweed", re: /rice crackers.*seaweed/i, kcal100g: 380, unitGrams: 25 },
    // שימורים/מדף/משקה חלב מרוכז - חלב מרוכז חייב לבוא *לפני* חלב הכללי
    // בהמשך, ושאר הפריטים שכאן חייבים לבוא *לפני* הגרסאות הטריות/כלליות
    // שלהם (טונה, סרדינים, תירס, אפונה, חומוס, שעועית, זיתים, חציל, אננס,
    // מנגו, אגס, ארטישוק, רוטב עגבניות) - נתונים מדויקים מהמשתמשת
    { name: "חלב מרוכז ממותק", re: /חלב מרוכז ממותק|condensed milk/i, kcal100g: 320, unitGrams: 20 },
    { name: "חלב מרוכז לא ממותק", re: /חלב מרוכז לא ממותק|evaporated milk/i, kcal100g: 135, unitGrams: 20 },
    { name: "תרכיז פטל/ענבים למהילה", re: /תרכיז (פטל|ענבים).*מהיל|עסיס|פרימור/i, kcal100g: 35, unitGrams: 200 },
    { name: "אבקת סחלב", re: /אבקת סחלב|sahlab/i, kcal100g: 63, unitGrams: 150 },
    // עודכן ל-620 (מ-586, ממוצע עם נתון נוסף מהמשתמשת) לפי נתון מדויק
    { name: "בצל מטוגן פריך", re: /בצל מטוגן|crispy fried onions?/i, kcal100g: 620, unitGrams: 15 },
    { name: "קרוטונים", re: /קרוטונים|croutons?/i, kcal100g: 450, unitGrams: 20 },
    { name: "שקדי מרק", re: /שקדי מרק|soup nuts?/i, kcal100g: 530, unitGrams: 10 },
    { name: "טונה בשמן זית איכותי", re: /טונה בשמן זית איכותי|rio mare/i, kcal100g: 200, unitGrams: 80 },
    { name: "טונה בשמן צמחי", re: /טונה בשמן( צמחי)?/i, kcal100g: 170, unitGrams: 112 },
    { name: "טונה במים", re: /טונה במים/i, kcal100g: 107, unitGrams: 112 },
    { name: "טונה מעושנת", re: /טונה מעושנת/i, kcal100g: 165, unitGrams: 112 },
    { name: "אנשובי בשמן זית", re: /אנשובי|anchov(y|ies)/i, kcal100g: 213, unitGrams: 15 },
    { name: "סרדינים בשמן זית", re: /סרדינ(ים)?.*שמן זית|king oscar/i, kcal100g: 216, unitGrams: 90 },
    { name: "לבבות דקל", re: /לבבות דקל|hearts? of palm/i, kcal100g: 28, unitGrams: 50 },
    { name: "ערמונים בוואקום", re: /ערמונים.*ואקום/i, kcal100g: 180, unitGrams: 100 },
    { name: "תירס גמדי", re: /תירס גמדי|baby corn/i, kcal100g: 30, unitGrams: 50 },
    { name: "אפונה עדינה בשימורים", re: /אפונה (עדינה|ירוקה עדינה)/i, kcal100g: 70, unitGrams: 60 },
    { name: "חומוס גרגרים בשימורים", re: /חומוס גרגרים|חומוס.*בשימורים|canned chickpeas/i, kcal100g: 120, unitGrams: 60 },
    { name: "שעועית ברוטב עגבניות", re: /שעועית.*רוטב עגבניות|baked beans/i, kcal100g: 91, unitGrams: 120 },
    { name: "שעועית ירוקה בשימורים", re: /שעועית ירוקה/i, kcal100g: 25, unitGrams: 60 },
    // עודכן ל-150 (מ-115) לפי נתון מדויק מהמשתמשת
    { name: "זיתים", re: /זית(ים)?|olives/i, kcal100g: 150, unitGrams: 15 },
    { name: "חציל קלוי בשימורים", re: /חציל קלוי/i, kcal100g: 40, unitGrams: 30 },
    { name: "אפרסקים בסירופ", re: /אפרסק(ים)?.*סירופ/i, kcal100g: 78, unitGrams: 70 },
    { name: "אננס בסירופ", re: /אננס.*סירופ/i, kcal100g: 66, unitGrams: 45 },
    { name: "קוקטייל פירות בסירופ", re: /קוקטייל פירות/i, kcal100g: 70, unitGrams: 100 },
    { name: "ליצ'י בסירופ", re: /ליצ'י.*סירופ|סירופ.*ליצ'י/i, kcal100g: 90, unitGrams: 50 },
    { name: "דובדבנים בסירופ", re: /דובדבנים.*סירופ|דובדבנים חמוצים/i, kcal100g: 116, unitGrams: 30 },
    // דורש "בשימורים" בלי "במים" אחריה - "סלמון בשימורים במים" (למטה, בין
    // דגים אחרים) הוא ערך שונה וצריך להיתפס לפני הערך הכללי הזה
    { name: "סלמון בשימורים", re: /סלמון בשימורים(?! במים)|canned salmon(?! .*water)/i, kcal100g: 153, unitGrams: 85 },
    { name: "לוף/Spam", re: /\bלוף\b|\bspam\b/i, kcal100g: 300, unitGrams: 50 },
    { name: "מולים/צדפות בשימורים", re: /מולים בשימורים|צדפות בשימורים|canned mussels/i, kcal100g: 200, unitGrams: 85 },
    { name: "תמנון בשמן זית", re: /תמנון(ים)?.*שמן זית|\bpulpo\b/i, kcal100g: 165, unitGrams: 85 },
    { name: "סרטנים משומרים", re: /סרטנים משומרים|crab meat/i, kcal100g: 83, unitGrams: 60 },
    { name: "עגבניות מרוסקות (Passata)", re: /עגבניות מרוסקות|passata/i, kcal100g: 32, unitGrams: 125 },
    { name: "עגבניות שלמות מקולפות", re: /עגבניות (תמר )?שלמות מקולפות|san marzano/i, kcal100g: 23, unitGrams: 120 },
    { name: "ארטישוק בשמן זית", re: /ארטישוק בשמן זית/i, kcal100g: 87, unitGrams: 80 },
    { name: "פלפלים קלויים בתחמיץ", re: /פלפלים קלויים בתחמיץ|roasted peppers?.*jar/i, kcal100g: 30, unitGrams: 80 },
    { name: "עלי גפן ממולאים", re: /עלי גפן ממולאים|stuffed grape leaves|dolma/i, kcal100g: 155, unitGrams: 90 },
    { name: "אגסים בסירופ", re: /אגס(ים)?.*סירופ/i, kcal100g: 71, unitGrams: 70 },
    { name: "מנגו בסירופ", re: /מנגו.*סירופ/i, kcal100g: 75, unitGrams: 100 },
    { name: "במיה ברוטב עגבניות", re: /במיה.*רוטב עגבניות/i, kcal100g: 55, unitGrams: 100 },
    { name: "דלעת מרוסקת", re: /דלעת מרוסקת|pumpkin pur[ée]e/i, kcal100g: 41, unitGrams: 120 },
    { name: "שעועית שחורה בשימורים", re: /שעועית שחורה/i, kcal100g: 91, unitGrams: 120 },
    { name: "תערובת קטניות בשימורים", re: /תערובת קטניות/i, kcal100g: 87, unitGrams: 120 },
    { name: "אנשובי כבוש בחומץ", re: /אנשובי כבוש|boquerones/i, kcal100g: 150, unitGrams: 20 },
    { name: "כבד דג בשימורים", re: /כבד דג|cod liver/i, kcal100g: 600, unitGrams: 30 },
    // דורש שלא יופיע "אפוי"/"מעושן" אחריו - הגרסה הטרייה (למטה, בין דגים
    // אחרים) שונה בערך ומטופלת בנפרד
    { name: "מקרל בשימורים", re: /מקרל(?! (אפוי|מעושן))|mackerel(?! (baked|smoked))/i, kcal100g: 233, unitGrams: 90 },
    { name: "פורל מעושן בשימורים", re: /פורל מעושן/i, kcal100g: 188, unitGrams: 85 },
    { name: "שזיפים בסירופ", re: /שזיפים.*סירופ/i, kcal100g: 93, unitGrams: 70 },
    { name: "תאנים בסירופ", re: /תאנים.*סירופ/i, kcal100g: 183, unitGrams: 60 },
    { name: "תפוחים מרוסקים למילוי פאי", re: /תפוחים (אפויים|מרוסקים).*פאי/i, kcal100g: 96, unitGrams: 125 },
    { name: "Stilton Cheese", re: /stilton/i, kcal100g: 410, unitGrams: 30 },
    { name: "סלמון מעושן/Lox", re: /סלמון מעושן|\blox\b|smoked salmon/i, kcal100g: 170, unitGrams: 50 },
    { name: "Kimchi", re: /kimchi|קימצ'י/i, kcal100g: 19, unitGrams: 80 },
    { name: "Sauerkraut", re: /sauerkraut|כרוב כבוש/i, kcal100g: 18, unitGrams: 100 },
    { name: "Pickled Eggs", re: /pickled eggs?/i, kcal100g: 160, unitGrams: 50 },
    { name: "Caviar", re: /caviar|קוויאר/i, kcal100g: 267, unitGrams: 15 },
    { name: "Mochi Sweet Rice Cakes", re: /mochi (sweet )?rice cakes?/i, kcal100g: 320, unitGrams: 30 },
    { name: "Turkish Delight", re: /turkish delight|לוקום/i, kcal100g: 380, unitGrams: 25 },
    { name: "Pâté de Campagne", re: /p[âa]t[ée] de campagne/i, kcal100g: 350, unitGrams: 30 },
    { name: "Duck Confit", re: /duck confit/i, kcal100g: 240, unitGrams: 150 },
    { name: "HP Sauce", re: /\bhp sauce\b/i, kcal100g: 120, unitGrams: 15 },
    { name: "Brown Cheese/Brunost", re: /brunost|brown cheese/i, kcal100g: 465, unitGrams: 20 },
    { name: "Kewpie Mayonnaise", re: /kewpie mayo/i, kcal100g: 666, unitGrams: 15 },
    { name: "Umeboshi", re: /umeboshi/i, kcal100g: 40, unitGrams: 10 },
    { name: "Gherkins in Vinegar", re: /gherkins?/i, kcal100g: 30, unitGrams: 40 },
    { name: "Cranberry Sauce", re: /cranberry sauce/i, kcal100g: 225, unitGrams: 20 },
    { name: "טחינה מתובלת מוכנה", re: /טחינה מתובלת/i, kcal100g: 425, unitGrams: 20 },
    { name: "Curry Paste Green", re: /green curry paste/i, kcal100g: 150, unitGrams: 20 },
    { name: "Curry Paste Red", re: /red curry paste/i, kcal100g: 140, unitGrams: 20 },
    { name: "Massaman Curry Paste", re: /massaman/i, kcal100g: 175, unitGrams: 20 },
    { name: "Liquid Aminos", re: /liquid aminos/i, kcal100g: 100, unitGrams: 5 },
    { name: "Mirin", re: /\bmirin\b/i, kcal100g: 280, unitGrams: 15 },
    { name: "Cooking Sake", re: /cooking sake/i, kcal100g: 133, unitGrams: 15 },
    { name: "Rice Vinegar", re: /rice vinegar/i, kcal100g: 33, unitGrams: 15 },
    { name: "Tarator Sauce", re: /tarator/i, kcal100g: 300, unitGrams: 20 },
    { name: "Chutney Mint & Cilantro", re: /mint.*cilantro chutney|chutney.*mint.*cilantro/i, kcal100g: 125, unitGrams: 20 },
    { name: "Crema Mexicana", re: /crema mexicana/i, kcal100g: 333, unitGrams: 15 },
    { name: "פריכיות אורז מצופות שוקולד", re: /פריכי(ות|ית) אורז מצופות/i, kcal100g: 468, unitGrams: 16 },
    { name: "פריכיות אורז דקות", re: /פריכי(ות|ית) אורז דקות|thin rice cakes/i, kcal100g: 360, unitGrams: 5 },
    { name: "פריכיות אורז", re: /פריכי(ות|ית) אורז/i, kcal100g: 350, unitGrams: 8 },
    { name: "פריכוניות מיני", re: /פריכוניות|מיני פריכיות/i, kcal100g: 390, unitGrams: 20 },
    { name: "פריכיות כוסמין", re: /פריכי(ות|ית) כוסמין/i, kcal100g: 337, unitGrams: 8 },
    { name: "פריכיות תירס", re: /פריכי(ות|ית) תירס/i, kcal100g: 362, unitGrams: 8 },
    { name: "פריכיות קטניות/עדשים", re: /פריכי(ות|ית) (עדשים|קטניות)/i, kcal100g: 357, unitGrams: 7 },
    { name: "פריכיות כוסמת", re: /פריכי(ות|ית) כוסמת/i, kcal100g: 350, unitGrams: 8 },
    { name: "לחמית חיטה מלאה", re: /לחמית חיטה מלאה/i, kcal100g: 387, unitGrams: 8 },
    { name: "לחמית כוסמין עם זרעים", re: /לחמית כוסמין/i, kcal100g: 411, unitGrams: 9 },
    { name: "לחמית שיפון וקצח", re: /לחמית שיפון/i, kcal100g: 375, unitGrams: 8 },
    { name: "לחמית ללא גלוטן", re: /לחמית ללא גלוטן/i, kcal100g: 371, unitGrams: 7 },
    { name: "פתית קלאסי", re: /פתית קלאסי|\bfatit\b/i, kcal100g: 380, unitGrams: 5 },
    { name: "Wasa Crispbread", re: /wasa/i, kcal100g: 350, unitGrams: 13 },
    { name: "Graze Crisp", re: /graze crisp/i, kcal100g: 433, unitGrams: 12 },
    { name: "צנים שוודי", re: /צנים שוודי|swedish toast/i, kcal100g: 380, unitGrams: 10 },
    { name: "צנימים זהובים", re: /צנימים/i, kcal100g: 377, unitGrams: 9 },
    { name: "גריסיני", re: /גריסיני|grissini/i, kcal100g: 400, unitGrams: 15 },
    { name: "קרקר ללא גלוטן", re: /קרקר.*ללא גלוטן/i, kcal100g: 450, unitGrams: 10 },
    { name: "קרוסטיני", re: /קרוסטיני|crostini/i, kcal100g: 433, unitGrams: 15 },
    { name: "זרעי צ'יה", re: /זרעי צ'יה|chia seeds?/i, kcal100g: 486, unitGrams: 12 },
    { name: "אבקת ספירולינה", re: /ספירולינה|spirulina/i, kcal100g: 290, unitGrams: 5 },
    { name: "גוג'י ברי", re: /גוג'י|goji/i, kcal100g: 333, unitGrams: 15 },
    { name: "אדממה", re: /אדממה|edamame/i, kcal100g: 120, unitGrams: 75 },
    { name: "שמרי בירה", re: /שמרי בירה|nutritional yeast/i, kcal100g: 350, unitGrams: 10 },
    { name: "קומבוצ'ה", re: /קומבוצ'ה|kombucha/i, kcal100g: 15, unitGrams: 200 },
    { name: "נאטו", re: /נאטו|\bnatto\b/i, kcal100g: 212, unitGrams: 40 },
    { name: "פסטה כוסמין מלא", re: /פסטה.*כוסמין/i, kcal100g: 128, unitGrams: 140 },
    { name: "איטריות קונג'אק/שירטאקי", re: /קונג'אק|שירטאקי|konjac|shirataki/i, kcal100g: 9, unitGrams: 200 },
    { name: "אורז בר שחור", re: /אורז בר|wild (black )?rice/i, kcal100g: 106, unitGrams: 150 },
    { name: "אטריות כוסמת/Soba", re: /אטריות כוסמת|soba noodles?/i, kcal100g: 98, unitGrams: 140 },
    { name: "זרעי פשתן טחונים", re: /זרעי פשתן|flax(seed)?/i, kcal100g: 534, unitGrams: 10 },
    { name: "זרעי המפ", re: /זרעי המפ|hemp hearts?/i, kcal100g: 553, unitGrams: 10 },
    { name: "אבקת אקאי", re: /אקאי|a[cç]a[ií]/i, kcal100g: 400, unitGrams: 5 },
    { name: "אבקת מאקה", re: /מאקה|maca powder/i, kcal100g: 325, unitGrams: 5 },
    { name: "אבקת חרוב", re: /אבקת חרוב|carob powder/i, kcal100g: 222, unitGrams: 10 },
    { name: "טפיוקה", re: /טפיוקה|tapioca/i, kcal100g: 358, unitGrams: 15 },
    { name: "קמח תפוח אדמה/עמילן", re: /קמח תפוח אדמה|עמילן טפיוקה|potato starch/i, kcal100g: 350, unitGrams: 10 },
    { name: "פסטה עדשים", re: /פסטה.*עדשים/i, kcal100g: 118, unitGrams: 140 },
    { name: "פסטה אפונה", re: /פסטה.*אפונה/i, kcal100g: 114, unitGrams: 140 },
    { name: "אריתריטול/מונק פרוט", re: /אריתריטול|מונק פרוט|erythritol|monk fruit/i, kcal100g: 0, unitGrams: 4 },
    { name: "סירופ יקון", re: /יקון|yacon/i, kcal100g: 133, unitGrams: 5 },
    { name: "תה סנצ'ה/ג'נמאיצ'ה", re: /סנצ'ה|ג'נמאיצ'ה|sencha|genmaicha/i, kcal100g: 1, unitGrams: 200 },
    { name: "תה מאצ'ה לאטה", re: /מאצ'ה לאטה|matcha latte/i, kcal100g: 17.5, unitGrams: 200 },
    { name: "תה רויבוש", re: /רויבוש|rooibos/i, kcal100g: 1, unitGrams: 200 },
    { name: "תה ירבה מאטה", re: /ירבה מאטה|yerba mate/i, kcal100g: 2.5, unitGrams: 200 },
    { name: "קפה ירוק", re: /קפה ירוק|green coffee/i, kcal100g: 2.5, unitGrams: 200 },
    { name: "סיבי פסיליום", re: /פסיליום|psyllium/i, kcal100g: 180, unitGrams: 10 },
    { name: "אינולין", re: /אינולין|inulin/i, kcal100g: 200, unitGrams: 5 },
    { name: "אבקת אשווגנדה", re: /אשוו?גנדה|ashwagandha/i, kcal100g: 266, unitGrams: 3 },
    { name: "גרגירי חומוס קלויים פריכים", re: /חומוס קלוי|roasted chickpeas?/i, kcal100g: 400, unitGrams: 30 },
    { name: "פריכוניות תפוח עץ וקינמון", re: /פריכוניות תפוח/i, kcal100g: 375, unitGrams: 20 },
    { name: "שייק ירוק בריאות", re: /שייק ירוק/i, kcal100g: 37, unitGrams: 350 },
    { name: "שייק פירות יער וחלבון", re: /שייק פירות יער.*חלבון/i, kcal100g: 60, unitGrams: 350 },
    { name: "שייק תמר בננה חמאת בוטנים", re: /שייק תמר.*בננה/i, kcal100g: 106, unitGrams: 300 },
    { name: "שייק אקאי", re: /שייק אקאי|acai smoothie/i, kcal100g: 80, unitGrams: 300 },
    { name: "שייק מנגו פסיפלורה", re: /שייק מנגו.*פסיפלורה/i, kcal100g: 53, unitGrams: 300 },
    { name: "שייק ספירולינה ירוק", re: /שייק ספירולינה/i, kcal100g: 41, unitGrams: 350 },
    { name: "כדור גלידת חלבון לשייק", re: /כדור גלידת חלבון/i, kcal100g: 120, unitGrams: 50 },
    { name: "תערובת פירות יער קפואים לשייק", re: /פירות יער קפואים/i, kcal100g: 50, unitGrams: 100 },
    { name: "תערובת מנגו אננס פפאיה קפואים", re: /מנגו.*אננס.*פפאיה|טרופי קפוא/i, kcal100g: 60, unitGrams: 100 },
    { name: "אבקת עשב חיטה", re: /עשב חיטה|wheatgrass/i, kcal100g: 300, unitGrams: 5 },
    { name: "אבקת כורכום (Golden Milk)", re: /golden milk|אבקת כורכום/i, kcal100g: 360, unitGrams: 5 },
    { name: "קפה קר ללא סוכר (Cold Brew)", re: /cold brew|קפה קר.*ללא סוכר/i, kcal100g: 6, unitGrams: 250 },
    { name: "משקה ספורט איזוטוני", re: /gatorade|powerade|משקה ספורט איזוטוני/i, kcal100g: 24, unitGrams: 500 },
    { name: "רוטב ברבקיו 0 קלוריות", re: /ברבקיו 0 קלוריות|walden farms.*bbq|zero.?cal.*bbq/i, kcal100g: 16, unitGrams: 15 },
    { name: "סירופ מייפל 0 קלוריות", re: /מייפל 0 קלוריות|walden farms.*maple|zero.?cal.*maple/i, kcal100g: 13, unitGrams: 15 },
    { name: "ספריי שמן לבישול", re: /ספריי שמן|cooking oil spray|\bpam\b spray/i, kcal100g: 800, unitGrams: 0.5 },
    { name: "Protein Cookie", re: /protein cookie|lenny.*larry/i, kcal100g: 366, unitGrams: 60 },
    { name: "Halo Top", re: /halo\s?top/i, kcal100g: 80, unitGrams: 125 },
    { name: "פריכונית שוקולד חלבון", re: /פריכונית.*חלבון/i, kcal100g: 433, unitGrams: 12 },
    { name: "קערת בוריטו", re: /קערת בוריטו|burrito bowl/i, kcal100g: 128, unitGrams: 350 },
    { name: "לקט ירקות מוקפצים קפואים", re: /לקט ירקות מוקפצים|ירקות מוקפצים קפואים/i, kcal100g: 33, unitGrams: 150 },
    { name: "שניצל תירס/חלבון צמחי", re: /שניצל תירס|שניצל חלבון צמחי/i, kcal100g: 188, unitGrams: 85 },
    { name: "גרנולה דלת סוכר עשירת חלבון", re: /גרנולה דלת סוכר|גרנולה.*חלבון/i, kcal100g: 411, unitGrams: 45 },
    { name: "תערובת פנקייק חלבון", re: /פנקייק חלבון|kodiak cakes/i, kcal100g: 380, unitGrams: 50 },
    { name: "יוגורט יווני 0%", re: /יוגורט יווני 0%|fage total 0/i, kcal100g: 54, unitGrams: 170 },
    { name: "גבינת סקי", re: /גבינת סקי/i, kcal100g: 57, unitGrams: 250 },
    { name: "מעדן חלבון פרו/GO", re: /מעדן חלבון (פרו|go)/i, kcal100g: 62, unitGrams: 200 },
    { name: "שבבי סויה יבשים (TVP)", re: /שבבי סויה|בונזו סויה|\btvp\b/i, kcal100g: 340, unitGrams: 30 },
    { name: "חמאת בוטנים באבקה (PB2)", re: /\bpb2\b|חמאת בוטנים באבקה/i, kcal100g: 500, unitGrams: 12 },
    { name: "שמן קוקוס", re: /שמן קוקוס|coconut oil/i, kcal100g: 862, unitGrams: 10 },
    { name: "פופקורן 100 קלוריות", re: /פופקורן 100 קלוריות/i, kcal100g: 333, unitGrams: 30 },
    { name: "שיבולת שועל מבושלת", re: /שיבולת שועל מבושלת|oatmeal cooked/i, kcal100g: 72, unitGrams: 230 },
    { name: "חלבון ביצה נוזלי", re: /חלבון ביצה נוזלי|liquid egg whites?/i, kcal100g: 52, unitGrams: 100 },
    { name: "אורז יבש (לפני בישול)", re: /אורז.*(יבש|לפני בישול)/i, kcal100g: 355, unitGrams: 100 },
    { name: "בקר טחון רזה מבושל", re: /בקר טחון.*מבושל|בקר טחון רזה 5%/i, kcal100g: 170, unitGrams: 150 },
    { name: "פילה דג לבן ללא שמן בתנור", re: /(אמנון|מושט).*ללא שמן|פילה דג לבן.*תנור/i, kcal100g: 96, unitGrams: 150 },
    { name: "עדשים יבשות (לפני בישול)", re: /עדשים (יבשות|לפני בישול)/i, kcal100g: 352, unitGrams: 100 },
    { name: "חומוס גרגרים יבשים (לפני בישול)", re: /חומוס.*(יבשים|לפני בישול)/i, kcal100g: 364, unitGrams: 100 },
    { name: "חומוס גרגרים מבושלים במים", re: /חומוס.*מבושלים במים/i, kcal100g: 164, unitGrams: 164 },
    { name: "שעועית לבנה מבושלת", re: /שעועית לבנה מבושלת/i, kcal100g: 144, unitGrams: 170 },
    { name: "רוטב סויה דל נתרן", re: /רוטב סויה דל נתרן|low sodium soy sauce/i, kcal100g: 66, unitGrams: 15 },
    { name: "מיונז הולנדי קלאסי", re: /מיונז הולנדי/i, kcal100g: 666, unitGrams: 15 },
    { name: "אבקת חלבון מי גבינה (Whey)", re: /אבקת חלבון|whey protein/i, kcal100g: 400, unitGrams: 30 },
    { name: "קולגן פפטידים", re: /קולגן|collagen/i, kcal100g: 350, unitGrams: 10 },
    { name: "אבקת אלקטרוליטים ללא סוכר", re: /אבקת אלקטרוליטים|electrolyte powder/i, kcal100g: 100, unitGrams: 5 },
    { name: "מי קוקוס", re: /מי קוקוס|coconut water/i, kcal100g: 19, unitGrams: 200 },
    { name: "אגוזי פקאן קלויים", re: /אגוזי פקאן|pecans?/i, kcal100g: 690, unitGrams: 20 },
    { name: "פולי סויה קלויים יבשים", re: /פולי סויה קלויים|dry roasted edamame/i, kcal100g: 433, unitGrams: 30 },
    { name: "קייל צ'יפס", re: /קייל צ'יפס|kale chips/i, kcal100g: 425, unitGrams: 20 },
    { name: "סובין חיטה", re: /סובין חיטה|wheat bran/i, kcal100g: 213, unitGrams: 15 },
    { name: "סובין שיבולת שועל", re: /סובין שיבולת שועל|oat bran/i, kcal100g: 246, unitGrams: 20 },
    { name: "אוכמניות", re: /אוכמניות|blueberr(y|ies)/i, kcal100g: 57, unitGrams: 150 },
    { name: "פיטאיה/פרי הדרקון", re: /פיטאיה|פרי הדרקון|dragon ?fruit/i, kcal100g: 60, unitGrams: 150 },
    { name: "פפאיה", re: /פפאיה|papaya/i, kcal100g: 43, unitGrams: 140 },
    { name: "פסיפלורה/שעונית", re: /פסיפלורה|שעונית|passion ?fruit/i, kcal100g: 97, unitGrams: 18 },
    { name: "ליצ'י טרי", re: /ליצ'י/i, kcal100g: 66, unitGrams: 100 },
    { name: "קרמבולה", re: /קרמבולה|starfruit/i, kcal100g: 31, unitGrams: 90 },
    { name: "אפרסמון", re: /אפרסמון|persimmon/i, kcal100g: 70, unitGrams: 120 },
    { name: "גואבה", re: /גואבה|guava/i, kcal100g: 68, unitGrams: 90 },
    { name: "דובדבנים טריים", re: /דובדבנים(?!.*סירופ)|cherr(y|ies)/i, kcal100g: 63, unitGrams: 100 },
    { name: "מנגוסטין", re: /מנגוסטין|mangosteen/i, kcal100g: 73, unitGrams: 100 },
    { name: "ג'קפרוט", re: /ג'קפרוט|jackfruit/i, kcal100g: 95, unitGrams: 150 },
    { name: "שורש סלרי", re: /שורש סלרי|celeriac|celery root/i, kcal100g: 42, unitGrams: 150 },
    { name: "שורש פטרוזיליה", re: /שורש פטרוזיליה|parsley root/i, kcal100g: 55, unitGrams: 100 },
    { name: "קולרבי", re: /קולרבי|kohlrabi/i, kcal100g: 27, unitGrams: 130 },
    { name: "ג'ינג'ר טרי", re: /ג'ינג'ר טרי|זנגביל טרי|fresh ginger/i, kcal100g: 80, unitGrams: 5 },
    { name: "קאסאווה/יוקה", re: /קאסאווה|יוקה|cassava|\byuca\b/i, kcal100g: 160, unitGrams: 150 },
    { name: "ארטישוק ירושלמי", re: /ארטישוק ירושלמי|jerusalem artichoke/i, kcal100g: 76, unitGrams: 90 },
    { name: "מיסו", re: /מיסו|miso/i, kcal100g: 198, unitGrams: 18 },
    { name: "פטריות שיטאקה", re: /שיטאקה|shiitake/i, kcal100g: 34, unitGrams: 90 },
    { name: "פטריות אנוקי", re: /אנוקי|enoki/i, kcal100g: 37, unitGrams: 100 },
    { name: "פארקע/פריקה", re: /פארקע|פריקה|freekeh/i, kcal100g: 110, unitGrams: 150 },
    { name: "אמרנט מבושל", re: /אמרנט|amaranth/i, kcal100g: 102, unitGrams: 240 },
    { name: "טף מבושל", re: /\bטף\b|\bteff\b/i, kcal100g: 101, unitGrams: 250 },
    { name: "דחן/מילט מבושל", re: /דחן|מילט|millet/i, kcal100g: 119, unitGrams: 200 },
    { name: "שוקולד מריר 85%", re: /שוקולד מריר 85%|85% (מוצקי קקאו|cacao)/i, kcal100g: 600, unitGrams: 10 },
    { name: "שוקולד מריר 100%", re: /שוקולד מריר 100%|100% (מוצקי קקאו|cacao)/i, kcal100g: 610, unitGrams: 10 },
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
    { name: "לחם לבן", re: /לחם לבן|white bread/i, kcal100g: 240, unitGrams: 30 },
    // "לחם חיטה מלאה" (100% חיטה מלאה) ו"לחם דגנים" (מולטיגריין, עם זרעים)
    // הם שני מוצרים שונים בפועל עם ערכים שונים - נתונים מדויקים מהמשתמשת,
    // מפוצלים לשני ערכים נפרדים במקום ערך "דגנים" אחד שכיסה את שניהם בעבר
    { name: "לחם חיטה מלאה", re: /לחם חיטה מלאה|לחם מלא\b|לחם מחיטה מלאה|whole\s*wheat\s*bread/i, kcal100g: 210, unitGrams: 31 },
    { name: "לחם דגנים", re: /לחם דגנים|multi[\s-]?grain\s*bread/i, kcal100g: 235, unitGrams: 34 },
    { name: "לחם שיפון", re: /לחם שיפון|rye bread/i, kcal100g: 205, unitGrams: 32 },
    { name: "לחם קל", re: /לחם קל|לחם דיאט|diet bread|light bread/i, kcal100g: 165, unitGrams: 24 },
    { name: "לחם כוסמין", re: /לחם כוסמין|spelt bread/i, kcal100g: 215, unitGrams: 32 },
    { name: "לחם מחמצת", re: /לחם מחמצת|sourdough(\s*bread)?/i, kcal100g: 230, unitGrams: 37 },
    { name: "לחם ללא גלוטן", re: /לחם ללא גלוטן|gluten.?free bread/i, kcal100g: 240, unitGrams: 30 },
    // עוד ממרחים - לפי בקשה מפורשת ("כל סוגי הממרחים"). כולם למעלה כי כמעט
    // כולם מכילים מרכיב-בסיס קיים כתת-מחרוזת (חצילים/טונה/ביצה/זיתים/חלב/
    // שמנת), ובלי הסדר הזה כל אחד מהם היה תמיד נתפס כמרכיב הבסיס הפשוט שלו
    // ולא כממרח המורכב (בד"כ עם מיונז/שמן/עוד רכיבים, ולכן קלורי יותר)
    { name: "מרגרינה", re: /מרגרינה|margarine/i, kcal100g: 717, unitGrams: 10 },
    { name: "שמנת חמוצה", re: /שמנת חמוצה|sour cream/i, kcal100g: 198, unitGrams: 20 },
    { name: "מטבוחה", re: /מטבוחה|matbucha/i, kcal100g: 90, unitGrams: 50 },
    { name: "סלט חצילים", re: /סלט חצילים|חצילים בטחינה|eggplant salad|eggplant dip/i, kcal100g: 150, unitGrams: 50 },
    { name: "גואקמולי", re: /גואקמולי|guacamole/i, kcal100g: 150, unitGrams: 50 },
    { name: "לבנה בשמן זית וזעתר", re: /לבנה.*זעתר|labn[ae]h.*za'?atar/i, kcal100g: 216, unitGrams: 30 },
    { name: "לבנה/לאבנה", re: /לבנה|לאבנה|labn[ae]h/i, kcal100g: 280, unitGrams: 30 },
    { name: "ריבת חלב", re: /ריבת חלב|dulce de leche/i, kcal100g: 315, unitGrams: 20 },
    { name: "סלט טונה", re: /סלט טונה|tuna salad/i, kcal100g: 200, unitGrams: 60 },
    { name: "סלט ביצים", re: /סלט ביצים|egg salad/i, kcal100g: 215, unitGrams: 60 },
    { name: "ממרח זיתים", re: /ממרח זיתים|olive tapenade/i, kcal100g: 230, unitGrams: 20 },
    // ממרחי שוקולד/ניוטלה-סטייל - כולם חייבים לבוא *לפני* "שוקולד" הכללי
    // למטה, כי כמעט כולם מכילים "שוקולד" כתת-מחרוזת ובלי הסדר הזה תמיד היו
    // נתפסים כטבלית שוקולד רגילה (546/5 גרם) במקום ממרח (נתונים מדויקים
    // מהמשתמשת, כפית גדושה/כף גדושה/100 גרם)
    // עודכן ל-540 (מ-504) לפי נתון מדויק מהמשתמשת
    { name: "ממרח השחר העולה", re: /שחר העולה/i, kcal100g: 540, unitGrams: 20 },
    { name: "ממרח השחר בד\"ץ", re: /שחר בד"?ץ/i, kcal100g: 547, unitGrams: 20 },
    // גרסה כללית ("שוקולד השחר"/"ממרח השחר" בלי ציון עולה/בד"ץ) - חייבת לבוא
    // *אחרי* שתי הגרסאות הספציפיות למעלה אבל *לפני* "שוקולד" הכללי למטה,
    // אחרת הייתה נופלת לטבלית שוקולד (546/5 גרם) במקום ממרח (ערך ממוצע בין
    // שתי הגרסאות: (504+547)/2≈525) - זו הייתה סיבת הפער מול ג'מיני/אינטרנט
    { name: "ממרח השחר", re: /ממרח השחר|שוקולד השחר/i, kcal100g: 525, unitGrams: 20 },
    { name: "ממרח שוקולד פרה", re: /ממרח שוקולד פרה|ממרחית פרה/i, kcal100g: 553, unitGrams: 20 },
    { name: "ממרחית", re: /ממרחית/i, kcal100g: 554, unitGrams: 20 },
    { name: "ממרח חלווה השחר", re: /חלוו?ה השחר|ממרח חלווה/i, kcal100g: 540, unitGrams: 20 },
    { name: "ממרח לוטוס", re: /ממרח לוטוס|לוטוס ממרח|biscoff/i, kcal100g: 584, unitGrams: 20 },
    // דורש "ממרח" מפורש - בלעדיו "Kinder Bueno White" (החטיף עצמו, למעלה)
    // היה תמיד נתפס כממרח (570) במקום החטיף
    { name: "ממרח קינדר בואנו", re: /ממרח קינדר בואנו|kinder bueno spread/i, kcal100g: 570, unitGrams: 20 },
    // דורש "ממרח" מפורש - בלעדיו "Hershey's" היה תמיד נתפס כממרח (540) במקום
    // חטיף השוקולד עצמו (ר' "הרשיז שוקולד חלב" למעלה, ליד שאר החטיפים הבינ"ל)
    { name: "ממרח הרשיז", re: /ממרח הרשיז|hershey'?s spread/i, kcal100g: 540, unitGrams: 20 },
    // דורש "ממרח" מפורש - בלעדיו "Maltesers" (החטיף עצמו, למעלה) היה תמיד
    // נתפס כממרח (545) במקום החטיף
    { name: "ממרח מלטזרס", re: /ממרח מלטיזרס|ממרח מלטזרס|maltesers spread/i, kcal100g: 545, unitGrams: 20 },
    // דורש "ממרח" מפורש - בלעדיו "Milky Way" היה תמיד נתפס כממרח (560) במקום
    // חטיף השוקולד עצמו (ר' "מילקי ווי" למטה, ליד שאר החטיפים המותגיים)
    { name: "ממרח טוויקס/באונטי/מילקי ווי", re: /ממרח טוויקס|ממרח באונטי|ממרח מילקי ו[ו]?אי|twix spread|bounty spread|milky way spread/i, kcal100g: 560, unitGrams: 20 },
    { name: "ממרח אוראו", re: /ממרח אוראו|oreo spread/i, kcal100g: 535, unitGrams: 20 },
    // דורש "ממרח" מפורש - בלעדיו Reese's Pieces/Big Cup (החטיפים עצמם) היו
    // תמיד נתפסים כממרח (547) במקום החטיף
    { name: "ממרח ריסז", re: /ממרח ריסז|ממרח ריסיז|reese'?s spread/i, kcal100g: 547, unitGrams: 20 },
    { name: "Reese's Big Cup", re: /reese'?s big cup/i, kcal100g: 512, unitGrams: 39 },
    { name: "Reese's Pieces", re: /reese'?s pieces/i, kcal100g: 500, unitGrams: 30 },
    { name: "ממרח שוקולד ללא תוספת סוכר", re: /שוקולד ללא תוספת סוכר|שוקולד דיאט/i, kcal100g: 420, unitGrams: 20 },
    { name: "ממרח חמאת אגוזים וקקאו טבעי", re: /חמאת אגוזים וקקאו|אגוזים וקקאו טבעי/i, kcal100g: 460, unitGrams: 20 },
    { name: "ממרח שוקולד חלבון", re: /ממרח שוקולד חלבון|protein (chocolate )?spread/i, kcal100g: 500, unitGrams: 20 },
    { name: "קקאו", re: /קקאו|cocoa/i, kcal100g: 228 },
    // חטיפי שוקולד מותגיים (מהארץ ומחו"ל) - חייבים לבוא *לפני* "שוקולד" הכללי
    // למטה, כי כולם מכילים "שוקולד" כתת-מחרוזת או שם מותג ספציפי (נתונים
    // מדויקים מהמשתמשת: יחידה/מנה + קלוריות ליחידה + 100 גרם)
    { name: "Milka Strawberry Yogurt", re: /milka.*strawberry yogurt/i, kcal100g: 560, unitGrams: 6 },
    { name: "מילקה", re: /מילקה|milka/i, kcal100g: 530, unitGrams: 6 },
    // משקה חלב מארס/M&M's/סניקרס חייב לבוא *לפני* חטיף המארס למטה - מכיל
    // "מארס"/"mars" כתת-מחרוזת ומדובר במוצר שונה לגמרי (משקה, לא חטיף)
    { name: "משקה חלב מארס/סניקרס/M&M's", re: /mars drink|m&m'?s.*(drink|milk)|snickers.*(drink|milk)|משקה חלב מארס|משקה חלב סניקרס/i, kcal100g: 66, unitGrams: 350 },
    // "מארס" (Mars) חייב גבול-מילה כדי לא להיתפס בטעות בתוך שמות אחרים
    { name: "מארס", re: /(^|[^א-ת])מארס(?:$|[^א-ת])|\bmars\b/i, kcal100g: 448, unitGrams: 51 },
    { name: "קינדר צ'וקולד", re: /קינדר צ['׳]?וקולד|kinder chocolate/i, kcal100g: 566, unitGrams: 12.5 },
    { name: "פררו רושה", re: /פררו רושה|ferrero rocher/i, kcal100g: 598, unitGrams: 12.5 },
    { name: "רפאלו", re: /רפאלו|raffaello/i, kcal100g: 628, unitGrams: 10 },
    // כל טעמי משפחת פרה (עלית) - חייבים לבוא *לפני* טבלת שוקולד פרה הכללית
    // למטה (מכילים "פרה" כתת-מחרוזת), נתונים מדויקים מהמשתמשת. וריאנטים
    // ה"קלאסי" (מריר/לבן) חייבים לבוא *אחרי* הגרסאות הספציפיות שלהם (70%/ללא
    // תוספת סוכר/עוגיות) מאותה סיבה, אז הם ממוקמים בסוף הבלוק כברירת מחדל
    { name: "פרה ממולא נוגט", re: /פרה.*ממולא.*נוגט|נוגט.*ממולא.*פרה/i, kcal100g: 550, unitGrams: 6.5 },
    { name: "פרה ממולא תות", re: /פרה.*ממולא.*תות/i, kcal100g: 495, unitGrams: 6.5 },
    { name: "פרה ממולא וניל ועוגיות", re: /פרה.*ממולא.*וניל/i, kcal100g: 540, unitGrams: 6.5 },
    { name: "פרה ממולא קרמל מלוח", re: /פרה.*ממולא.*קרמל/i, kcal100g: 538, unitGrams: 6.5 },
    { name: "פרה מריר ממולא תפוז/מנטה", re: /פרה.*ממולא.*(תפוז|מנטה)/i, kcal100g: 490, unitGrams: 6.5 },
    { name: "פרה עם אגוזי לוז", re: /פרה.*אגוזי לוז/i, kcal100g: 560, unitGrams: 6 },
    { name: "פרה עם שקדים", re: /פרה.*(עם )?שקדים/i, kcal100g: 555, unitGrams: 6 },
    { name: "פרה עם סוכריות קופצות", re: /פרה.*סוכריות קופצות|פרה פופ/i, kcal100g: 528, unitGrams: 6 },
    { name: "פרה עם עדשי שוקולד", re: /פרה.*עדשי(ם)?/i, kcal100g: 525, unitGrams: 6 },
    { name: "פרה עם אורז תפוח", re: /פרה.*(אורז תפוח|פצפצים)/i, kcal100g: 515, unitGrams: 6 },
    { name: "פרה עם ביסקוויט/פתיבר", re: /פרה.*(ביסקוויט|פתיבר)/i, kcal100g: 518, unitGrams: 6 },
    { name: "פרה עם שברי אוראו", re: /פרה.*אוראו/i, kcal100g: 532, unitGrams: 6 },
    { name: "פרה עם בייגלה מלוח", re: /פרה.*בייגלה/i, kcal100g: 520, unitGrams: 6 },
    { name: "פרה לבן עם עוגיות", re: /פרה לבן.*עוגיות|פרה.*עוגיות.*לבן/i, kcal100g: 545, unitGrams: 6 },
    { name: "פרה מריר 70% קקאו", re: /פרה.*מריר.*70%|פרה.*70%.*קקאו/i, kcal100g: 570, unitGrams: 6 },
    { name: "פרה חלב ללא תוספת סוכר", re: /פרה חלב ללא תוספת סוכר/i, kcal100g: 450, unitGrams: 6 },
    { name: "פרה מריר ללא תוספת סוכר", re: /פרה מריר ללא תוספת סוכר/i, kcal100g: 435, unitGrams: 6 },
    { name: "פרה מריר קלאסי", re: /פרה.*מריר/i, kcal100g: 530, unitGrams: 6 },
    { name: "פרה לבן קלאסי", re: /פרה.*לבן/i, kcal100g: 550, unitGrams: 6 },
    // ברירת מחדל למשפחת פרה - שוקולד חלב (טעם הבסיס) - נשאר אחרון בבלוק
    { name: "טבלת שוקולד פרה", re: /טבלת (שוקולד )?פרה|שוקולד פרה חלב|פרה שוקולד חלב|פרה חלב קלאסי/i, kcal100g: 535, unitGrams: 6 },
    { name: "לינדט", re: /לינדט|lindt/i, kcal100g: 566, unitGrams: 10 },
    { name: "ריטר ספורט", re: /ריטר ספורט|ritter sport/i, kcal100g: 575, unitGrams: 6.25 },
    { name: "גודיבה", re: /גודיבה|godiva/i, kcal100g: 540, unitGrams: 7 },
    { name: "מילקי ווי", re: /מילקי ו[ו]?אי|milky way/i, kcal100g: 441, unitGrams: 43 },
    { name: "סקיטלס", re: /סקיטלס|skittles/i, kcal100g: 405, unitGrams: 45 },
    { name: "מנטוס", re: /מנטוס|mentos/i, kcalPerUnit: 10 },
    { name: "אפרופו", re: /אפרופו|afropo|apropo/i, kcal100g: 531, unitGrams: 50 },
    // unitGrams נוסף (קובייה אחת, ~5 גרם) לפי נתון מדויק מהמשתמשת (~27 קל')
    { name: "שוקולד", re: /שוקולד|chocolate/i, kcal100g: 546, unitGrams: 5 },
    { name: "קמח", re: /קמח|flour/i, kcal100g: 364 },
    { name: "סוכר חום", re: /סוכר חום|brown sugar/i, kcal100g: 380 },
    // סוכרייה/סוכריית גומי חייבות לבוא *לפני* סוכר - שתיהן מכילות "סוכר"
    // כתת-מחרוזת (הקידומת של "סוכרייה"/"סוכריית"), ובלי סדר הפוך היו תמיד
    // נתפסות כסוכר גולמי (387 קל' ל-100 גרם) במקום ממתק בודד
    { name: "סוכרייה", re: /סוכרייה|hard candy/i, kcalPerUnit: 20 },
    { name: "סוכריית גומי", re: /סוכריית גומי|גומי ממתק|gummy candy|gummy bears?/i, kcalPerUnit: 12 },
    { name: "סוכר", re: /סוכר|sugar/i, kcal100g: 387 },
    { name: "Ghee (חמאה מזוקקת)", re: /\bghee\b|חמאה מזוקקת/i, kcal100g: 900, unitGrams: 15 },
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
    // גרסאות "בריסטה" (עשירות יותר, מתאימות להקצפה) - חייבות לבוא *לפני*
    // הגרסה הבסיסית של אותו משקה, אחרת "משקה שיבולת שועל בריסטה" תמיד היה
    // נתפס כגרסה הרגילה (ומפספס את הקלוריות הגבוהות יותר של הבריסטה)
    { name: "משקה שיבולת שועל בריסטה", re: /(חלב|משקה) שיבולת שועל.*בריסטה|בריסטה.*שיבולת שועל|oat.?milk.*barista|barista.*oat/i, kcal100g: 60, unitGrams: 200 },
    { name: "משקה סויה בריסטה", re: /(חלב|משקה) סויה.*בריסטה|בריסטה.*סויה/i, kcal100g: 54, unitGrams: 200 },
    { name: "משקה שקדים בריסטה", re: /(חלב|משקה) שקדים.*בריסטה|בריסטה.*שקדים/i, kcal100g: 44, unitGrams: 200 },
    // גם "חלב X" וגם "משקה X" - לפי בקשה מפורשת, אנשים כותבים את שני הניסוחים
    // גרסאות בטעמים (שוקולד/וניל) חייבות לבוא *לפני* הגרסאות הכלליות למטה -
    // מכילות "משקה סויה"/"משקה שקדים"/"משקה שיבולת שועל" כתת-מחרוזת, ובלי
    // הסדר הזה היו נתפסות כערך הממותק הכללי (sweetenedKcal100g) במקום הטעם
    // הספציפי (נתונים מדויקים מהמשתמשת)
    { name: "משקה סויה שוקולד", re: /משקה סויה.*שוקולד|סויה.*שוקולד.*משקה|soy.*chocolate.*milk/i, kcal100g: 61, unitGrams: 200 },
    { name: "משקה סויה וניל", re: /משקה סויה.*וניל|וניל.*משקה סויה|soy.*vanilla.*milk/i, kcal100g: 57, unitGrams: 200 },
    { name: "משקה שקדים שוקולד", re: /משקה שקדים.*שוקולד|שקדים.*שוקולד.*משקה|almond.*chocolate.*milk/i, kcal100g: 47, unitGrams: 200 },
    { name: "משקה שיבולת שועל שוקולד", re: /משקה שיבולת שועל.*שוקולד|שיבולת שועל.*שוקולד|oat.*chocolate.*milk/i, kcal100g: 61, unitGrams: 200 },
    // עודכן ל-33 (מ-44) לפי נתון מדויק מהמשתמשת (משקה סויה ללא סוכר)
    { name: "חלב סויה", re: /חלב סויה|משקה סויה|soy.?milk/i, kcal100g: 33, sweetenedKcal100g: 67, unitGrams: 200 },
    { name: "חלב שקדים", re: /חלב שקדים|משקה שקדים|almond.?milk/i, kcal100g: 14, sweetenedKcal100g: 31, unitGrams: 200 },
    { name: "חלב שיבולת שועל", re: /חלב שיבולת שועל|משקה שיבולת שועל|oat.?milk/i, kcal100g: 45, sweetenedKcal100g: 58, unitGrams: 200 },
    // קוקוס: שלושה מוצרים שונים מאוד - משקה קוקוס לשתייה (הכי דליל), חלב קוקוס
    // לבישול (פחית שימורים, הכי נפוץ בעברית סתם "חלב קוקוס"), וקרם קוקוס
    // לבישול/אפייה (הכי סמיך). "קרם קוקוס" ו"משקה קוקוס" חייבים לבוא *לפני*
    // "חלב קוקוס" כדי לא להיבלע בו
    { name: "קרם קוקוס", re: /קרם קוקוס|coconut cream/i, kcal100g: 215 },
    { name: "משקה קוקוס", re: /משקה קוקוס|coconut (milk )?drink/i, kcal100g: 23, unitGrams: 200 },
    { name: "חלב קוקוס", re: /חלב קוקוס|נוזל קוקוס|coconut milk/i, kcal100g: 170 },
    // "משקה אורז" חייב לבוא *לפני* "אורז" הרגיל (בהמשך הרשימה) - אחרת תמיד
    // היה נתפס כאורז מוצק (130 קל') במקום משקה דליל בהרבה
    { name: "משקה אורז", re: /משקה אורז|rice milk/i, kcal100g: 49, unitGrams: 200 },
    { name: "משקה אגוזי לוז", re: /משקה אגוזי לוז|hazelnut milk/i, kcal100g: 32, sweetenedKcal100g: 50, unitGrams: 200 },
    { name: "משקה קשיו", re: /משקה קשיו|cashew milk/i, kcal100g: 25, sweetenedKcal100g: 44, unitGrams: 200 },
    { name: "משקה אפונה", re: /משקה אפונה|pea milk/i, kcal100g: 45, unitGrams: 200 },
    { name: "משקה כוסמין", re: /משקה כוסמין|spelt milk/i, kcal100g: 43, unitGrams: 200 },
    // אבקת חלב חייבת לבוא *לפני* חלב - "אבקת חלב" מכילה "חלב" עם רווח לפני
    // וסוף-מחרוזת אחרי, שעונה על הגנת הגבול של חלב - בלי סדר הפוך זה תמיד
    // היה נתפס כחלב נוזלי רגיל (42) במקום אבקה מרוכזת בהרבה (496)
    { name: "אבקת חלב", re: /אבקת חלב|milk powder/i, kcal100g: 496, unitGrams: 30 },
    // משקאות חלב בטעמים ומותגים - חייבים לבוא *לפני* חלב הכללי למטה, מכילים
    // "חלב" כתת-מחרוזת עם גבול תקין (נתונים מדויקים מהמשתמשת)
    { name: "משקה חלב וניל", re: /משקה חלב.*וניל|חלב בטעם וניל/i, kcal100g: 70, unitGrams: 200 },
    { name: "משקה חלב בננה", re: /משקה חלב.*בננה|חלב בטעם בננה/i, kcal100g: 71, unitGrams: 200 },
    { name: "משקה חלב אייס קפה", re: /משקה חלב.*אייס קפה|חלב בטעם אייס קפה|iced coffee milk/i, kcal100g: 68, unitGrams: 200 },
    { name: "משקה חלב מוכפל חלבון שוקולד", re: /מוכפל חלבון.*שוקולד|חלבון כפול.*שוקולד/i, kcal100g: 58, unitGrams: 350 },
    { name: "משקה חלב מוכפל חלבון וניל", re: /מוכפל חלבון.*וניל|חלבון כפול.*וניל/i, kcal100g: 56, unitGrams: 350 },
    { name: "יזו", re: /יזו|yazoo/i, kcal100g: 60, unitGrams: 400 },
    { name: "נסקוויק", re: /נסקוויק|nesquik/i, kcal100g: 75, unitGrams: 200 },
    { name: "פיירלייף", re: /פיירלייף|fairlife/i, kcal100g: 58, unitGrams: 200 },
    { name: "חלב", re: /(^|[^א-ת])חלב(?:$|[^א-ת])|\bmilk\b/i, kcal100g: 42, unitGrams: 200, percentTable: { 1: 42, 3: 58 } },
    { name: "דבש", re: /דבש|honey/i, kcal100g: 304, unitGrams: 20 },
    { name: "סילאן", re: /סילאן|date honey|\bsilan\b/i, kcal100g: 315, unitGrams: 20 },
    { name: "נוטלה", re: /נוטלה|nutella/i, kcal100g: 539, unitGrams: 20 },
    { name: "ריבה", re: /ריבה|\bjam\b|preserves/i, kcal100g: 250, unitGrams: 20 },
    // percentTable: אחוזי שומן נפוצים על אריזות ישראליות - אם המשתמש כתב אחוז
    // מפורש (למשל "קוטג' 9%"), findFatPercentCalories משתמש בערך הקרוב ביותר
    // בטבלה במקום ב-kcal100g הכללי; קוטג'/גבינה לבנה/גבינה חייבים גם לבוא
    // *לפני* גבינה (ראו ההערה הקיימת למטה)
    // עודכן percentTable (0.5%=70, 3%=95, 5%=105) לפי נתון מדויק מהמשתמשת
    { name: "קוטג'", re: /קוטג['׳]?|cottage cheese/i, kcal100g: 95, unitGrams: 250, percentTable: { 0.5: 70, 3: 95, 5: 105, 9: 135 } },
    // גבינה לבנה/מוצרלה/פטה/פרמזן/גבינת עיזים חייבות לבוא *לפני* גבינה -
    // "גבינה לבנה" מכילה את "גבינה" כתת-מחרוזת, ומדובר במוצר שונה לגמרי בערכים
    // (רך/משוח, לא גבינה קשה) - בלי סדר הפוך זה תמיד היה נתפס כגבינה קשה
    // רגילה (350 קל') במקום 95 (5%, הכי נפוץ)
    // עודכן ל-5%=73 (מ-95) לפי נתון מדויק מהמשתמשת
    // עודכן 5%=96 (מ-73) לפי נתון מדויק מהמשתמשת
    { name: "גבינה לבנה", re: /גבינה לבנה|white cheese/i, kcal100g: 96, unitGrams: 100, percentTable: { 3: 80, 5: 96, 9: 135, 20: 220 } },
    { name: "מוצרלה", re: /מוצרלה|mozzarella/i, kcal100g: 280, unitGrams: 100 },
    { name: "פטה", re: /פטה|\bfeta\b/i, kcal100g: 264, unitGrams: 50 },
    // עודכן ל-392 (מ-431) לפי נתון מדויק מהמשתמשת (Parmigiano Reggiano)
    { name: "פרמזן", re: /פרמזן|parmesan/i, kcal100g: 392, unitGrams: 10 },
    { name: "Manchego", re: /manchego/i, kcal100g: 400, unitGrams: 28 },
    { name: "Gouda Aged", re: /gouda( aged)?/i, kcal100g: 393, unitGrams: 28 },
    { name: "Roquefort", re: /roquefort|גבינה כחולה/i, kcal100g: 369, unitGrams: 28 },
    { name: "Halloumi", re: /halloumi|חלומי/i, kcal100g: 316, unitGrams: 30 },
    { name: "Dumpling Wrappers", re: /dumpling wrappers?/i, kcal100g: 280, unitGrams: 10 },
    { name: "Bao Buns", re: /bao buns?/i, kcal100g: 260, unitGrams: 50 },
    { name: "גבינת עיזים", re: /גבינת עיזים|goat cheese/i, kcal100g: 364, unitGrams: 30 },
    // גבינה בולגרית חייבת לבוא *לפני* גבינה הכללית (מכילה "גבינה" כתת-מחרוזת)
    { name: "גבינה בולגרית", re: /גבינה בולגרית|bulgarian cheese/i, kcal100g: 120, unitGrams: 50, percentTable: { 5: 120, 16: 240 } },
    // percentTable[28] עודכן מ-300 ל-340 לפי נתון מדויק מהמשתמשת (330-350 קל')
    { name: "גבינה", re: /גבינה|cheese/i, kcal100g: 300, unitGrams: 25, percentTable: { 9: 220, 28: 340, 45: 400 } },
    { name: "אבקת אפייה", re: /אבקת אפייה|baking powder|סודה לשתייה|baking soda/i, kcal100g: 53 },
    { name: "שמרים", re: /שמרים|yeast/i, kcal100g: 105 },
    // פירוט אגוזים/זרעים/פיצוחים לפי סוג - ר' האשכול המפורט בהמשך הרשימה, אחרי
    // חמאת בוטנים (חייב לבוא *אחריה*, כי "בוטנים" תת-מחרוזת של "חמאת בוטנים")
    // עוד חלבון צמחוני/טבעוני - לפי בקשה מפורשת
    // עודכן מ-370 ל-150 לפי נתון מדויק מהמשתמשת (סייטן מוכן, לא אבקת גלוטן יבשה)
    { name: "סייטן", re: /סייטן|seitan/i, kcal100g: 150, unitGrams: 100 },
    { name: "טמפה", re: /טמפה|tempeh/i, kcal100g: 193, unitGrams: 100 },
    // עודכן ל-200 (מ-250) לפי נתון מדויק מהמשתמשת (שניצל צמחוני/טבעוני דמוי
    // עוף, יחידה אחת - 180-220 קל')
    { name: "שניצל צמחוני", re: /שניצל (צמחוני|טבעוני|סויה)|vegan schnitzel|veggie schnitzel/i, kcalPerUnit: 200 },
    // עוד סוגי שניצל (ביתי/קנוי/וינאי/תירס/בגט) - נתונים מדויקים מהמשתמשת.
    // כולם חייבים לבוא *לפני* שניצל הכללי בהמשך - כל אחד מהם מכיל "שניצל"
    // כתת-מחרוזת, ובלי הסדר הזה תמיד היו נתפסים כשניצל הכללי (300 קל')
    { name: "שניצל עוף אפוי", re: /שניצל (עוף )?אפוי( בתנור)?|baked (chicken )?schnitzel/i, kcalPerUnit: 175 },
    { name: "שניצל עוף מטוגן", re: /שניצל (עוף )?מטוגן( במחבת)?|pan.?fried (chicken )?schnitzel/i, kcalPerUnit: 265 },
    { name: "שניצל וינאי", re: /שניצל וינאי|wiener schnitzel|viennese schnitzel/i, kcalPerUnit: 450 },
    { name: "שניצל תירס קפוא", re: /שניצל תירס|corn schnitzel/i, kcalPerUnit: 175 },
    // "שניצל עוף קפוא" חייב לבוא *אחרי* "שניצל עוף אפוי"/"שניצל עוף מטוגן"
    // למעלה - כדי שהתיאורים הספציפיים יותר (אפוי/מטוגן) עדיין ייתפסו קודם
    { name: "שניצל עוף קפוא", re: /שניצל עוף קפוא|frozen chicken schnitzel/i, kcalPerUnit: 240 },
    { name: "נאגטס", re: /נאגטס|chicken nuggets?/i, kcalPerUnit: 52 },
    // שניצל בבגט (מנת סנדוויצ'רייה שלמה - בגט + 2 שניצלים + רטבים/סלטים) -
    // ממוקם כאן, *לפני* "בגט" הכללי בהמשך הקובץ, כדי שלא יישבר לשניים
    { name: "שניצל בבגט", re: /שניצל בבגט|schnitzel baguette sandwich/i, kcalPerUnit: 1025 },
    // שניצל (עוף) רגיל - חייב לבוא *אחרי* כל הסוגים הספציפיים למעלה, כדי
    // שהמילים הספציפיות (צמחוני/אפוי/מטוגן/וינאי/תירס/קפוא/בבגט) עדיין
    // ייתפסו נכון קודם. נשאר כברירת מחדל סבירה לתיאור לא-ספציפי
    // unitGrams תוקן מ-150 ל-120 - 150 גרם זו יותר מנה גדולה של מסעדה; שניצל
    // ביתי בגודל בינוני שוקל בערך 100-120 גרם מבושל
    { name: "שניצל", re: /שניצל|schnitzel/i, kcal100g: 250, unitGrams: 120 },
    { name: "קציצות בשר", re: /קציצ(ה|ות)( בשר)?|meatballs?/i, kcal100g: 215, unitGrams: 100 },
    // סלטים/ממרחים קנויים נוספים - נתונים מדויקים מהמשתמשת. חייבים לבוא
    // *לפני* חצילים/תפוח (אדמה)/כרוב/גזר הכלליים בהמשך - אותה סיבה כמו כל
    // שאר "חייב לבוא לפני" בקובץ: כל אחד מהם מכיל מרכיב-בסיס קיים כתת-מחרוזת
    { name: "סלט חצילים במיונז", re: /סלט חצילים במיונז|eggplant salad mayo/i, kcal100g: 300, unitGrams: 18 },
    { name: "סלט תפוחי אדמה", re: /סלט תפוחי אדמה|potato salad/i, kcal100g: 200, unitGrams: 18 },
    { name: "קולסלאו", re: /קולסלאו|coleslaw/i, kcal100g: 170, unitGrams: 19 },
    { name: "סלט כרוב/גזר חמוץ", re: /סלט (כרוב|גזר) חמוץ|sour cabbage salad|sour carrot salad/i, kcal100g: 50, unitGrams: 100 },
    { name: "חומוס קנוי", re: /חומוס קנוי|חומוס מוכן|store.?bought hummus/i, kcal100g: 305, unitGrams: 18 },
    { name: "טחינה מוכנה", re: /טחינה מוכנה|טחינה מדוללת|ready.?made tahini|tahini sauce/i, kcal100g: 275, unitGrams: 18 },
    // פירות יבשים/אגוזים נוספים - "בננה צ'יפס" חייב לבוא *לפני* בננה (בסמוך
    // למטה) - "חטיף" מטוגן/מיובש קלורי בהרבה מפרי טרי, אותה סיבה כמו כל שאר
    // "חייב לבוא לפני" בקובץ. "אגוזי ברזיל/מקדמיה" חייבים לבוא *לפני* "אגוזי
    // מלך" (בהמשך הרשימה) - הרגקס שלו רחב (תופס כל "אגוז"/"אגוזים")
    { name: "בננה צ'יפס", re: /בננה צ['׳]?יפס|banana chips?/i, kcal100g: 520, unitGrams: 30 },
    { name: "חמוציות", re: /חמוציות|cranberries/i, kcal100g: 320, unitGrams: 15 },
    { name: "צימוקים", re: /צימוקים|raisins?/i, kcal100g: 300, unitGrams: 15 },
    { name: "משמש יבש", re: /משמש יבש|dried apricots?/i, kcal100g: 240, unitGrams: 8 },
    { name: "שזיף יבש", re: /שזיף יבש|prunes?/i, kcal100g: 240, unitGrams: 9 },
    { name: "תאנה יבשה/דבלה", re: /תאנה יבשה|דבלה|dried figs?/i, kcal100g: 250, unitGrams: 18 },
    { name: "זרעי צ'יה/פשתן", re: /זרעי צ['׳]?יה|זרעי פשתן|chia seeds?|flax\s*seeds?|flaxseed/i, kcal100g: 505, unitGrams: 10 },
    { name: "צנוברים", re: /צנוברים|pine nuts?/i, kcal100g: 670, unitGrams: 8 },
    { name: "אגוזי ברזיל", re: /אגוזי ברזיל|brazil nuts?/i, kcal100g: 650, unitGrams: 5 },
    { name: "אגוזי מקדמיה", re: /אגוזי מקדמיה|macadamia/i, kcal100g: 715, unitGrams: 3 },
    // עוד תוצרת טרייה - לפי בקשה מפורשת
    { name: "זנגביל", re: /זנגביל|\bginger\b/i, kcal100g: 80, unitGrams: 10 },
    { name: "כוסברה/פטרוזיליה", re: /כוסברה|פטרוזיליה|cilantro|coriander|parsley/i, kcal100g: 23, unitGrams: 5 },
    // גם (?!אדמה) חוץ מ-(?!הצהריים) - בלי זה, "תפוח אדמה" (תפוח-אדמה, ערך
    // נפרד ומדויק יותר בהמשך הרשימה) היה תמיד נתפס כתפוח עץ רגיל (52 קל')
    { name: "תפוח", re: /תפוח(?!\s*(הצהריים|אדמה))|apple/i, kcal100g: 52, unitGrams: 182 },
    { name: "בננה", re: /בננה|banana/i, kcal100g: 89, unitGrams: 118 },
    // סושי/אסייתי נוספים - נתונים מדויקים מהמשתמשת. "חומץ אורז"/"פריכית אורז"
    // חייבים לבוא *לפני* אורז (בסמוך למטה) - שניהם מכילים "אורז" כתת-מחרוזת
    { name: "נורי", re: /נורי|\bnori\b/i, kcal100g: 300, unitGrams: 3 },
    { name: "חומץ אורז", re: /חומץ אורז|rice vinegar/i, kcal100g: 30, unitGrams: 15 },
    { name: "פריכית אורז", re: /פריכית אורז|rice cake/i, kcalPerUnit: 27 },
    { name: "ג'ינג'ר כבוש", re: /ג['׳]?ינג['׳]?ר כבוש|pickled ginger|\bgari\b/i, kcal100g: 73, unitGrams: 15 },
    { name: "וואסאבי", re: /וואסאבי|wasabi/i, kcal100g: 270, unitGrams: 5 },
    // מחית קארי חייבת לבוא *לפני* קארי (המנה, בהמשך הרשימה) - מכילה "קארי"
    { name: "מחית קארי אסייתי", re: /מחית קארי|curry paste/i, kcal100g: 135, unitGrams: 15 },
    // דגנים נוספים - לפי בקשה מפורשת. "פתיתים" חייב לבוא *לפני* "קוסקוס" -
    // הרגקס שלו כולל "pearl couscous"/"israeli couscous" שמכילים "couscous"
    { name: "פתיתים", re: /פתיתים|ptitim|israeli couscous|pearl couscous/i, kcal100g: 150, unitGrams: 150 },
    { name: "קוסקוס", re: /קוסקוס|couscous/i, kcal100g: 112, unitGrams: 150 },
    // אורז מטוגן חייב לבוא *לפני* אורז - מכיל "אורז" כתת-מחרוזת, וטיגון בשמן
    // משנה משמעותית את הקלוריות (200 מול 130 ל-100 גרם)
    { name: "אורז מטוגן", re: /אורז מטוגן|fried rice/i, kcal100g: 200, unitGrams: 200 },
    { name: "אורז", re: /אורז|\brice\b/i, kcal100g: 130, unitGrams: 150 },
    { name: "פסטה", re: /פסטה|pasta/i, kcal100g: 131, unitGrams: 200 },
    { name: "לחם", re: /לחם|bread/i, kcal100g: 265, unitGrams: 30 },
    // חלת שבת רגילה/לבנה היא ברירת המחדל של "חלה" סתם (המקרה הנפוץ) - לכן
    // עודכן ישירות על הערך הכללי; רק גרסאות מקמח מלא/כוסמין ומתוקה/בריוש
    // חייבות ערך נפרד משלהן *לפני* הערך הכללי (מכיל "חלה" כתת-מחרוזת)
    { name: "חלה מקמח מלא/כוסמין", re: /חלה (מקמח )?(מלאה|כוסמין)|whole\s*wheat\s*challah/i, kcal100g: 245, unitGrams: 40 },
    { name: "חלה מתוקה/בריוש", re: /חלה מתוקה|חלת בריוש|brioche challah/i, kcal100g: 320, unitGrams: 40 },
    { name: "חלה", re: /חלה|challah/i, kcal100g: 280, unitGrams: 40 },
    // בגט שלם/מקמח מלא חייבים לבוא *לפני* הערך הכללי (מכילים "בגט" כתת-
    // מחרוזת) - הערך הכללי עצמו הוא חצי-בגט/בגט אישי (המקרה הנפוץ יותר)
    { name: "בגט שלם", re: /בגט שלם|בגט צרפתי שלם|whole baguette/i, kcal100g: 265, unitGrams: 250 },
    { name: "בגט מקמח מלא/דגנים", re: /בגט מקמח מלא|בגט דגנים|whole\s*wheat\s*baguette/i, kcal100g: 240, unitGrams: 250 },
    { name: "בגט", re: /בגט|baguette/i, kcal100g: 265, unitGrams: 125 },
    // ערכי "ביס"/מיני חייבים לבוא *לפני* הגרסאות הרגילות והערך הכללי (כולם
    // מכילים "לחמני" כתת-מחרוזת) - "ביס" מלאה/כוסמין ומתוקה/בריוש חייבים
    // לבוא *לפני* "ביס" הכללי (לבנה) כי הוא לא דורש התאמה של סוג קמח ספציפי
    { name: "לחמניית ביס מלאה/כוסמין", re: /לחמניי?ת? ביס (חיטה מלאה|כוסמין)/i, kcal100g: 230, unitGrams: 30 },
    { name: "לחמניית ביס מתוקה/בריוש", re: /לחמניי?ת? ביס מתוקה|בריוש ביס|mini brioche/i, kcal100g: 310, unitGrams: 30 },
    { name: "לחמניית ביס", re: /לחמניי?ת? ביס( לבנה)?|mini (dinner )?roll/i, kcal100g: 270, unitGrams: 30 },
    { name: "לחמניית כוסמין/חיטה מלאה", re: /לחמניי?ת? (כוסמין( מלא)?|חיטה מלאה)|whole\s*wheat\s*roll/i, kcal100g: 225, unitGrams: 70 },
    { name: "לחמנייה קלה", re: /לחמניי?ה קלה|light (dinner )?roll/i, kcal100g: 165, unitGrams: 50 },
    { name: "לחמניה", re: /לחמני(ה|ות)|\bbun\b|dinner roll/i, kcal100g: 265, unitGrams: 70 },
    { name: "פוקצ'ה", re: /פוק(א)?צ['׳]?ה|focaccia/i, kcal100g: 270, unitGrams: 150 },
    // לאפה/פיתה עיראקית חייבת לבוא *לפני* "פיתה" הכללית בהמשך (מכילה "פיתה"
    // כתת-מחרוזת אם נכתבה כך)
    { name: "לאפה", re: /לאפה|פיתה עיראקית|laffa|lafa|iraqi pita/i, kcal100g: 260, unitGrams: 150 },
    { name: "ג'בטה", re: /ג['׳]בטה|ciabatta/i, kcal100g: 260, unitGrams: 120 },
    // פרנה ענקית/גדולה חייבת לבוא *לפני* הערך הכללי (הפרנה האישית/מרוקאית)
    { name: "פרנה ענקית", re: /פרנה ענקית|פרנה גדולה|פרנה מסעד(ה|ות)/i, kcal100g: 255, unitGrams: 220 },
    { name: "פרנה", re: /פרנה( מרוקאית)?/i, kcal100g: 255, unitGrams: 150 },
    // בייגל ירושלמי (עם שומשום) חייב לבוא *לפני* הערך הכללי - (?!ה) מונע
    // התנגשות עם "בייגלה" (החטיף הקטן, ערך נפרד לגמרי בהמשך הקובץ)
    { name: "בייגל ירושלמי", re: /בייגל ירושלמי|jerusalem bagel|sesame bagel/i, kcal100g: 275, unitGrams: 150 },
    { name: "בייגל", re: /בייגל(?!ה)|\bbagel\b/i, kcal100g: 260, unitGrams: 100 },
    { name: "מצה מקמח מלא", re: /מצה מקמח מלא|whole\s*wheat matzo/i, kcal100g: 360, unitGrams: 35 },
    { name: "מצה", re: /מצה|matz[ao]h?/i, kcal100g: 375, unitGrams: 35 },
    // שוקי/כנפי עוף חייבים לבוא *לפני* עוף (חזה) - שניהם מכילים "עוף" כתת-
    // מחרוזת, וזה בשר כהה/שומני יותר מחזה עוף - בלי סדר הפוך היה תמיד נתפס
    // כחזה עוף רגיל (165 קל')
    // ירך/ירכיים עוף עם עור ועצם (כפי שנשקל בפועל לפני בישול, לא פילה ללא עצם
    // כמו "פרגית" למטה) - ערך ל-100 גרם *כמו שנשקל*, כולל עור/עצם, לפי נתון
    // תזונתי סטנדרטי למוצר גולמי - חייבת לבוא *לפני* "שוקי עוף" (שם "chicken
    // thigh" מופה בטעות ל-209, ר' ההערה שם), כדי ש"ירכיים"/"ירך עוף" יתפסו
    // כאן ולא יפלו על הערך הכללי "עוף" (חזה, 165) שלא מתאים לנתח הזה בכלל
    { name: "ירך עוף עם עור ועצם", re: /ירכי עוף|ירך עוף|ירכיים/i, kcal100g: 216, unitGrams: 150 },
    { name: "שוקי עוף", re: /שוקי עוף|chicken thigh/i, kcal100g: 209, unitGrams: 150 },
    { name: "כנפי עוף", re: /כנפי עוף|chicken wings?/i, kcal100g: 203, unitGrams: 100 },
    // קציצת עוף/הודו להמבורגר - נתון מדויק מהמשתמשת. חייבת לבוא *כאן*,
    // *לפני* עוף (ו*לפני* הודו בהמשך הקובץ) - מכילה "עוף"/"הודו" כתת-
    // מחרוזת, ובלי הסדר הזה תמיד הייתה נתפסת כחזה עוף/הודו רגיל
    { name: "קציצת עוף/הודו להמבורגר", re: /קציצת (עוף|הודו)( להמבורגר)?|chicken burger patty|turkey burger patty/i, kcalPerUnit: 205 },
    { name: "עוף", re: /חזה עוף|עוף|chicken/i, kcal100g: 165, unitGrams: 150 },
    { name: "פרגית", re: /פרגית|chicken thigh fillet/i, kcal100g: 180, unitGrams: 150 },
    // טונה בשמן חייבת לבוא *לפני* טונה הכללית (במים, בסמוך למטה) - מכילה
    // "טונה" כתת-מחרוזת, וקלורית בהרבה מטונה במים
    { name: "טונה בשמן", re: /טונה בשמן|טונה שמן זית|tuna in oil/i, kcal100g: 195, unitGrams: 100 },
    // דורש שלא יופיע "אדומה"/"טרייה"/"steak" - גרסת הסטייק הטרי (למעלה, בין
    // דגים אחרים) שונה בערך ומטופלת בנפרד
    { name: "טונה", re: /טונה(?! (אדומה|טרי(ה)?))|tuna(?! steak)/i, kcal100g: 116, unitGrams: 100 },
    // עוד דגים נפוצים - לפי בקשה מפורשת ("דגים"), אותו מסד חינמי-לוקאלי
    { name: "בקלה", re: /בקלה|\bcod\b/i, kcal100g: 105, unitGrams: 150 },
    { name: "מושט/טילפיה", re: /מושט|טילפיה|tilapia/i, kcal100g: 128, unitGrams: 150 },
    // פוצל לפי מין (לברק/דניס/אמנון) עם ערכים מדויקים מהמשתמשת - כל אחד
    // חייב לבוא *לפני* ה"אמנון" הכללי, ו"דניס" לבדה כי "sea bream"/"branzino"
    // כבר לא חופפים
    { name: "פילה לברק (Sea Bass)", re: /לברק|sea bass/i, kcal100g: 124, unitGrams: 150 },
    { name: "פילה דניס/צ'פורה (Sea Bream)", re: /דניס|צ'פורה|sea bream/i, kcal100g: 135, unitGrams: 150 },
    { name: "פילה נסיכת הנילוס", re: /נסיכת הנילוס|נסיכה אפוי|nile perch/i, kcal100g: 92, unitGrams: 150 },
    { name: "פילה הליבוט (Halibut)", re: /הליבוט|halibut/i, kcal100g: 110, unitGrams: 150 },
    { name: "פילה סול/פלנדר (Sole)", re: /\bסול\b|פלנדר|\bsole\b|flounder/i, kcal100g: 90, unitGrams: 150 },
    { name: "פילה קוד/באסה אפוי", re: /קוד.*אפוי|באסה|\bbasa\b/i, kcal100g: 82, unitGrams: 150 },
    { name: "טונה אדומה/סטייק צרוב", re: /טונה אדומה|טונה טרי(ה)?|tuna steak/i, kcal100g: 130, unitGrams: 150 },
    { name: "מקרל אפוי/מעושן טרי", re: /מקרל אפוי|מקרל מעושן/i, kcal100g: 262, unitGrams: 120 },
    { name: "הרינג/דג מלוח", re: /הרינג|herring/i, kcal100g: 260, unitGrams: 50 },
    { name: "סלמון בשימורים במים", re: /סלמון בשימורים במים|canned salmon.*water/i, kcal100g: 136, unitGrams: 120 },
    { name: "קציצות/אצבעות דג אפויות", re: /קציצות דג|אצבעות דג|fish fingers?/i, kcal100g: 200, unitGrams: 90 },
    { name: "איקרה/ממרח ביצי דגים", re: /איקרה|fish roe spread/i, kcal100g: 450, unitGrams: 20 },
    { name: "סורימי", re: /סורימי|surimi/i, kcal100g: 100, unitGrams: 50 },
    { name: "בורי", re: /בורי|grey mullet/i, kcal100g: 150, unitGrams: 150 },
    { name: "קרפיון", re: /קרפיון|\bcarp\b/i, kcal100g: 127, unitGrams: 150 },
    { name: "סטייק דג חרב", re: /דג חרב|swordfish/i, kcal100g: 172, unitGrams: 150 },
    { name: "אמנון/דניס/לברק", re: /אמנון|דניס|לברק|sea bream|branzino/i, kcal100g: 120, unitGrams: 150 },
    // סלמון מעושן חייב לבוא *לפני* סלמון הכללי (בסמוך למטה) - מכיל "סלמון"
    // כתת-מחרוזת, ופחות קלורי (170 מול 208 ל-100 גרם, לפי נתון מהמשתמשת)
    { name: "סלמון מעושן", re: /סלמון מעושן|smoked salmon/i, kcal100g: 170, unitGrams: 19 },
    // עודכן ל-148 (מ-168) לפי נתון מדויק מהמשתמשת (פורל בתנור אחרי בישול)
    { name: "פורל", re: /פורל|trout/i, kcal100g: 148, unitGrams: 150 },
    { name: "הרינג", re: /הרינג|herring/i, kcal100g: 158, unitGrams: 80 },
    { name: "סרדינים", re: /סרדינ(ים)?|sardines?/i, kcal100g: 208, unitGrams: 50 },
    { name: "שרימפס/חסילון", re: /שרימפס|חסילונ(ים)?|shrimp|prawns?/i, kcal100g: 99, unitGrams: 100 },
    { name: "קלמארי/דיונון", re: /קלמארי|דיונון|calamari|squid/i, kcal100g: 92, unitGrams: 100 },
    // מותגי יוגורט ספציפיים - חייבים לבוא *לפני* הערך הכללי "יוגורט" למטה,
    // כי הלולאה עוצרת בהתאמה הראשונה: אם הכללי היה קודם, "יוגורט פרו" היה
    // תמיד נתפס כיוגורט רגיל ואף פעם לא מגיע לערך הספציפי והמדויק יותר
    // עודכן ל-70/68 (מ-90/75) לפי נתון מדויק מהמשתמשת (שטראוס PRO / תנובה GO)
    { name: "יוגורט פרו", re: /יוגורט פרו|yo\s*pro/i, kcal100g: 70, unitGrams: 200 },
    { name: "יוגורט גו", re: /יוגורט גו|yogurt go/i, kcal100g: 68, unitGrams: 200 },
    { name: "יוגורט יווני", re: /יוגורט יווני|greek yogurt/i, kcal100g: 97, unitGrams: 170 },
    // משקאות יוגורט - חלק מכילים "יוגורט" כתת-מחרוזת וחייבים לבוא *לפני*
    // יוגורט הכללי למטה (נתונים מדויקים מהמשתמשת). אקטימל 0% חייב לבוא
    // *לפני* אקטימל הרגיל מאותה סיבה (מכיל "אקטימל" כתת-מחרוזת)
    { name: "אקטימל 0%", re: /אקטימל 0%|אקטימל דל שומן|actimel 0/i, kcal100g: 27, unitGrams: 100 },
    { name: "אקטימל", re: /אקטימל|actimel/i, kcal100g: 71, unitGrams: 100 },
    { name: "משקה יוגורט עיזים", re: /משקה יוגורט עיזים|יוגורט עיזים לשתייה|goat yogurt drink/i, kcal100g: 60, unitGrams: 200 },
    { name: "משקה יוגורט פרי", re: /משקה יוגורט פרי|יופלה|דנונה משקה|yoplait|danone drink/i, kcal100g: 74, unitGrams: 250 },
    { name: "קפיר", re: /קפיר|kefir/i, kcal100g: 52, unitGrams: 200 },
    { name: "יוגורט", re: /יוגורט|yogurt|yoghurt/i, kcal100g: 66, unitGrams: 150, percentTable: { 0: 45, 3: 66, 10: 110 } },
    { name: "מלפפון", re: /מלפפון|cucumber/i, kcal100g: 15, unitGrams: 301 },
    // עודכן ל-16 (מ-11) לפי נתון מדויק מהמשתמשת
    { name: "חמוצים", re: /חמוצ(ים)?|pickles?/i, kcal100g: 16, unitGrams: 30 },
    { name: "עגבנייה", re: /עגבני|tomato/i, kcal100g: 18, unitGrams: 123 },
    { name: "חומוס", re: /חומוס|hummus/i, kcal100g: 166, unitGrams: 50 },
    // אבקת חלבון חייבת לבוא *לפני* חלבון ביצה - ל"חלבון ביצה" יש קבוצה
    // אופציונלית (ה?ביצה)? שמזהה גם "חלבון" סתם (כללי, לא דווקא ביצה), אז
    // בלי סדר הפוך "אבקת חלבון" (אבקת חלבון כושר, לא ביצה) הייתה תמיד נתפסת
    // כחלבון-ביצה-בודד (17 קל' ליחידה) במקום אבקה (380 ל-100 גרם)
    { name: "אבקת חלבון", re: /אבקת חלבון|protein powder/i, kcal100g: 380, unitGrams: 30 },
    // מותגי חטיפי חלבון ספציפיים - חייבים לבוא *לפני* "חטיף חלבון" הכללי
    // למטה (מכילים "חלבון"/protein bar כתת-מחרוזת), נתונים מדויקים מהמשתמשת
    { name: "חטיף חלבון גרנייד", re: /גרנייד|carb killa|grenade/i, kcal100g: 356, unitGrams: 60 },
    { name: "חטיף חלבון קווסט", re: /קווסט|\bquest\b/i, kcal100g: 333, unitGrams: 60 },
    { name: "חטיף חלבון אולין", re: /אולין|\ballin\b/i, kcal100g: 350, unitGrams: 60 },
    // חטיף חלבון גם כאן, מאותה סיבה בדיוק - מכיל "חלבון"
    // unitGrams עודכן מ-50 ל-60 לפי נתון מדויק מהמשתמשת (חטיף ~60 גרם, 200-230 קל')
    { name: "חטיף חלבון", re: /חטיף חלבון|protein bar/i, kcal100g: 380, unitGrams: 60 },
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
    { name: "תפוח אדמה", re: /תפוח אדמה|תפו"א|תפוא|potato/i, kcal100g: 77, unitGrams: 173 },
    { name: "גזר", re: /גזר|carrot/i, kcal100g: 41, unitGrams: 61 },
    { name: "ברוקולי", re: /ברוקולי|broccoli/i, kcal100g: 34, unitGrams: 80 },
    { name: "כרובית", re: /כרובית|cauliflower/i, kcal100g: 25, unitGrams: 80 },
    { name: "חסה", re: /חסה|lettuce/i, kcal100g: 15, unitGrams: 30 },
    { name: "פלפל", re: /פלפל|pepper/i, kcal100g: 31, unitGrams: 119 },
    // unitGrams=110 זה בצל שלם (למתכון/מנה שבה בצל הוא הרכיב היחיד שמוזכר) -
    // אבל כשבצל מוזכר כאחד מכמה מאכלים ברשימה (כמו תוספת לטורטיה/כריך), זו
    // כמעט תמיד כמות-תוספת קטנה, לא בצל שלם. ר' garnishGrams ב-computeItemCalories
    { name: "בצל", re: /בצל|onion/i, kcal100g: 40, unitGrams: 110, garnishGrams: 30 },
    { name: "כרישה", re: /כרישה|\bleek\b/i, kcal100g: 61, unitGrams: 100 },
    { name: "במיה", re: /במיה|okra/i, kcal100g: 33, unitGrams: 100 },
    { name: "לפת", re: /לפת|turnip/i, kcal100g: 28, unitGrams: 122 },
    // (^|[^א-ת])...(?:$|[^א-ת]) במקום lookbehind/lookahead: אותה תוצאה (גבול
    // מילה עברי אמיתי, כי \b לא עובד על עברית ב-JS), אבל בתחביר regex בסיסי
    // שנתמך בכל דפדפן - lookbehind (?<!...) לא נתמך ב-Safari ישן (לפני 16.4),
    // ועלול לגרום ל-SyntaxError בזמן טעינת כל הקובץ, לא רק בביטוי הזה
    // unitGrams נוסף (~שן שום אחת) לפי נתון מדויק מהמשתמשת (~5 קל' לשן)
    { name: "שום", re: /(^|[^א-ת])שום(?:$|[^א-ת])|garlic/i, kcal100g: 149, unitGrams: 3 },
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
    // "שייק תמרה" (רשת בתי הקפה) חייב לבוא *לפני* "תמר" (הפרי) למטה - "תמרה"
    // מכילה "תמר" כתת-מחרוזת, ומדובר במוצר שונה לגמרי (נתון מדויק מהמשתמשת,
    // טווח 220-280/350 מ"ל -> 65-80 ל-100 מ"ל, נלקחה נקודת האמצע)
    { name: "שייק תמרה", re: /שייק תמרה|תמרה שייק|אסאי תמרה|tamara smoothie/i, kcal100g: 73, unitGrams: 350 },
    // עוד פירות - לפי בקשה מפורשת
    // unitGrams עודכן מ-20 ל-24 כדי להתקרב ליחידה מדויקת יותר (תמר מג'הול,
    // ~66 קל' ליחידה, לפי נתון מהמשתמשת - 24*277/100≈66.5)
    { name: "תמר", re: /תמר(ים)?|\bdate\b|dates/i, kcal100g: 277, unitGrams: 24 },
    { name: "שזיף", re: /שזיף|plum/i, kcal100g: 46, unitGrams: 66 },
    { name: "אפרסק", re: /אפרסק|peach/i, kcal100g: 39, unitGrams: 150 },
    { name: "משמש", re: /משמש|apricot/i, kcal100g: 48, unitGrams: 35 },
    { name: "קיווי", re: /קיווי|kiwi/i, kcal100g: 61, unitGrams: 76 },
    { name: "רימון", re: /רימון|pomegranate/i, kcal100g: 83, unitGrams: 100 },
    { name: "תאנה", re: /תאנה|\bfig\b/i, kcal100g: 74, unitGrams: 50 },
    // percentTable נוסף לפי נתון מדויק מהמשתמשת - רזה (10% שומן) מול שמן (20%)
    { name: "בשר טחון", re: /בשר טחון|ground beef|minced meat/i, kcal100g: 254, unitGrams: 150, percentTable: { 10: 176, 20: 254 } },
    { name: "בשר בקר", re: /בשר בקר|beef/i, kcal100g: 250, unitGrams: 150 },
    { name: "אנטריקוט", re: /אנטריקוט|entrecote|ribeye/i, kcal100g: 275, unitGrams: 150 },
    // עוד סוגי בשר - לפי בקשה מפורשת
    { name: "כבש/טלה", re: /כבש|טלה|lamb/i, kcal100g: 294, unitGrams: 150 },
    { name: "חזיר", re: /חזיר|\bpork\b/i, kcal100g: 242, unitGrams: 150 },
    { name: "כבד", re: /כבד|liver/i, kcal100g: 170, unitGrams: 100 },
    // פסטרמה חייבת לבוא *לפני* פסטה - "פסטרמה" מתחילה כמעט באותן אותיות
    // (פ-ס-ט), אבל האות ה-4 שונה (ר מול ה) אז זה כן בטוח בלי סדר מיוחד -
    // ההערה כאן רק להסביר למה זה לא נראה כמו התנגשות שנשכחה
    // עודכן ל-100/18 (מ-147/30) לפי נתון מדויק מהמשתמשת (פסטרמת הודו, פרוסה)
    { name: "פסטרמה", re: /פסטרמה|pastrami/i, kcal100g: 100, unitGrams: 18 },
    { name: "חזה הודו פרוסות דל שומן", re: /חזה הודו (נקניק|פרוסות)/i, kcal100g: 100, unitGrams: 40 },
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
    // אשכול הפיתות: כל גרסאות "ביס"/קטנה/מיני (כל סוגי הדגן) חייבות לבוא
    // *לפני* הגרסאות הרגילות וגם לפני הערך הכללי (כולם מכילים "פיתה" כתת-
    // מחרוזת) - בלעדיהן "פיתה קטנה כוסמין" הייתה נופלת לערך הרגיל/גדול
    // (261 קל' במקום ~80, בדיוק הבאג שדווח). נתונים מדויקים מהמשתמשת -
    // בכל סוג דגן, ה-kcal100g זהה בין הגרסה הרגילה ל"ביס", רק המשקל שונה
    { name: "פיתה ביס ללא גלוטן", re: /פיתה (ביס|קטנה|מיני) ללא גלוטן|gluten.?free (mini|small) pita/i, kcal100g: 250, unitGrams: 30 },
    { name: "פיתה ביס קלה", re: /פיתה (ביס|קטנה|מיני) קלה|mini light pita/i, kcal100g: 160, unitGrams: 25 },
    { name: "פיתה ביס כוסמין", re: /פיתה (ביס|קטנה|מיני) כוסמין( מלא)?/i, kcal100g: 225, unitGrams: 35 },
    { name: "פיתה ביס חיטה מלאה", re: /פיתה (ביס|קטנה|מיני) (חיטה מלאה|מקמח מלא)/i, kcal100g: 220, unitGrams: 35 },
    { name: "פיתה ביס דגנים", re: /פיתה (ביס|קטנה|מיני) דגנים/i, kcal100g: 235, unitGrams: 35 },
    // "ביס" כללי (לבנה/לא מזוהה) - אחרי כל גרסאות הדגן הספציפיות, כדי שהן
    // ייתפסו קודם. כולל גם ניסוחים בסדר מילים הפוך ("מיני פיתה"/"פיתת מיני")
    { name: "פיתה ביס", re: /פיתה (ביס|קטנה)( לבנה)?|מיני פיתה|פיתת מיני|mini pita|small pita/i, kcal100g: 245, unitGrams: 35 },
    { name: "פיתה גדולה", re: /פיתה גדולה|פיתה גדולת מימדים|פיתת מאפייה|large pita/i, kcal100g: 245, unitGrams: 120 },
    { name: "פיתה קלה", re: /פיתה קלה/i, kcal100g: 160, unitGrams: 55 },
    { name: "פיתה כוסמין", re: /פיתה כוסמין( מלא)?/i, kcal100g: 225, unitGrams: 80 },
    // פיתה מקמח מלא חייבת לבוא *לפני* פיתה הכללית (מכילה "פיתה" כתת-מחרוזת)
    { name: "פיתה מקמח מלא", re: /פיתה מקמח מלא|whole\s*wheat pita/i, kcal100g: 220, unitGrams: 80 },
    // unitGrams/kcal100g עודכנו לפי נתון מדויק מהמשתמשת - זה ערך פיתה לבנה
    // רגילה בגודל סטנדרטי, לא קטנה/ביס/גדולה (ר' הערכים הספציפיים למעלה)
    { name: "פיתה", re: /פיתה|pita/i, kcal100g: 245, unitGrams: 90 },
    { name: "טורטיה מקמח מלא/כוסמין", re: /טורטיה (מקמח )?(מלאה|כוסמין)|whole\s*wheat\s*tortilla/i, kcal100g: 265, unitGrams: 45 },
    { name: "טורטיה", re: /טורטיה|tortilla/i, kcal100g: 290, unitGrams: 45 },
    // עודכן מ-76 ל-133 לפי נתון מדויק מהמשתמשת (טופו טבעי קשה, לא רך)
    // עודכן ל-120 (מ-133) לפי נתון מדויק מהמשתמשת (טופו קשה)
    { name: "טופו", re: /טופו|tofu/i, kcal100g: 120, unitGrams: 100 },
    { name: "זיתים", re: /זית(ים)?|olives/i, kcal100g: 115, unitGrams: 15 },
    { name: "טחינה", re: /טחינה|tahini/i, kcal100g: 595, unitGrams: 20 },
    // מיונז לייט חייב לבוא *לפני* מיונז הכללי (מכיל "מיונז" כתת-מחרוזת)
    { name: "מיונז לייט", re: /מיונז לייט|light mayo|mayo light/i, kcal100g: 125, unitGrams: 15 },
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
    { name: "רוטב צ'ילי מתוק", re: /רוטב צ['׳]?ילי מתוק|sweet chili sauce/i, kcal100g: 190, unitGrams: 15 },
    { name: "לבן", re: /(^|[^א-ת])לבן(?:$|[^א-ת])|labaneh|leben/i, kcal100g: 62, unitGrams: 200 },
    // קולה זירו/דיאט חייבת לבוא *לפני* קולה הרגילה (מכילה "קולה" כתת-מחרוזת)
    { name: "קולה זירו", re: /קולה זירו|קולה דיאט|דיאט קולה|coke zero|diet coke|cola zero|zero cola/i, kcal100g: 0, unitGrams: 330 },
    { name: "קולה", re: /קולה|\bcola\b/i, kcal100g: 42, unitGrams: 330 },
    { name: "בירה", re: /בירה|\bbeer\b/i, kcal100g: 43, unitGrams: 330 },
    { name: "יין", re: /(^|[^א-ת])יין(?:$|[^א-ת])|\bwine\b/i, kcal100g: 83, unitGrams: 150 },
    { name: "פרוסקו/שמפניה", re: /פרוסקו|שמפניה|prosecco|champagne/i, kcal100g: 80, unitGrams: 150 },
    // עוד משקאות - לפי בקשה מפורשת (חמים וקרים)
    // קפה הפוך/קר חייבים לבוא *לפני* קפה הכללי - שניהם מכילים "קפה" כתת-
    // מחרוזת, וההרכב (חלב/קצף, או משקה קר מתוק מבוסס-קפה) שונה משמעותית
    // בקלוריות מקפה שחור פשוט (2 קל' בלבד) - בלי סדר הפוך היו תמיד נתפסים ככה
    // עודכן מ-60 ל-50 לפי נתון מדויק מהמשתמשת (~90-110 קל' לכוס 200 מ"ל)
    { name: "קפה הפוך", re: /קפה הפוך|cappuccino|latte/i, kcal100g: 50, unitGrams: 200 },
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
    // שוקו ללא תוספת סוכר חייב לבוא *לפני* שוקו הכללי - מכיל "שוקו" כתת-מחרוזת
    { name: "שוקו ללא תוספת סוכר", re: /שוקו ללא תוספת סוכר|שוקו דיאט|sugar.?free chocolate milk/i, kcal100g: 47, unitGrams: 200 },
    // (?!לד) כדי ש"שוקו" לא יתפוס את "שוקולד" (שמתחיל באותן 4 אותיות בדיוק)
    // עודכן ל-72 (מ-75) לפי נתון מדויק מהמשתמשת (שוקו יוטבתה)
    { name: "שוקו", re: /שוקו(?!לד)|chocolate milk/i, kcal100g: 72, unitGrams: 200 },
    { name: "לימונדה", re: /לימונדה|lemonade/i, kcal100g: 40, unitGrams: 200 },
    { name: "משקה אנרגיה", re: /משקה אנרגיה|energy drink/i, kcal100g: 45, unitGrams: 250 },
    // unitGrams עודכן מ-40 ל-50 (שוט, 50 מ"ל) לפי נתון מדויק מהמשתמשת (~112 קל' לשוט)
    { name: "אלכוהול חזק", re: /וודקה|וויסקי|ג'ין|רום|vodka|whisk[e]?y|\bgin\b|\brum\b/i, kcal100g: 231, unitGrams: 50 },
    { name: "ערק", re: /(^|[^א-ת])ערק(?:$|[^א-ת])|\barak\b/i, kcal100g: 231, unitGrams: 50 },
    { name: "ליקר", re: /ליקר|liqueur/i, kcal100g: 300, unitGrams: 30 },
    // מיץ כללי (סוג לא מזוהה) - חייב לבוא *אחרי* כל סוגי המיץ הספציפיים למעלה
    { name: "מיץ", re: /מיץ|\bjuice\b/i, kcal100g: 45, unitGrams: 200 },
    // מגש שלם (משפחתי/אישי) - חייב לבוא *ראשון* מבין כל סוגי הפיצה: "פיצה
    // ביתית משפחתית" מכילה גם "פיצה ביתית" כתת-מחרוזת, ובלי סדר הפוך זו הייתה
    // תמיד נתפסת כפרוסה בודדת (205 קל') ומתעלמת לגמרי מ"משפחתית" - התיקון
    // מזהה גם בלי המילה "מגש" (אנשים כותבים "פיצה משפחתית" בלי "מגש" בכלל)
    { name: "מגש פיצה משפחתי", re: /(מגש )?פיצה (ביתית )?משפחתית|family pizza( tray)?|whole family pizza/i, kcalPerUnit: 2400 },
    { name: "מגש פיצה אישי", re: /(מגש )?פיצה (ביתית )?אישית|personal pizza( tray)?|whole personal pizza/i, kcalPerUnit: 900 },
    // עוד סוגי פיצה (ביתית/פיצרייה/קפואה/שוליים ממולאים) - נתונים מדויקים
    // מהמשתמשת, כל אחד למשולש בודד אלא אם צוין אחרת. כולם חייבים לבוא *לפני*
    // פיצה הכללית בהמשך - מכילים "פיצה" כתת-מחרוזת
    { name: "פיצה ביתית מופחתת קלוריות", re: /פיצה ביתית (מופחתת קלוריות|קלה|דיאט)|light homemade pizza|low.?calorie pizza/i, kcalPerUnit: 120 },
    { name: "פיצה ביתית עבה", re: /פיצה ביתית (עבה|עשירה)|thick crust homemade pizza/i, kcalPerUnit: 275 },
    // פיצה ביתית (קלאסית, ברירת המחדל הביתית) - חייבת לבוא *אחרי* שתי
    // הגרסאות הספציפיות למעלה - שתיהן מכילות "פיצה ביתית" כתת-מחרוזת
    { name: "פיצה ביתית", re: /פיצה ביתית( קלאסית)?|homemade pizza/i, kcalPerUnit: 205 },
    { name: "פיצה שוליים ממולאים", re: /פיצה (עם )?שוליים ממולאים|stuffed crust pizza/i, kcalPerUnit: 385 },
    { name: "פיצה קפואה", re: /פיצה קפואה|frozen pizza/i, kcalPerUnit: 250 },
    { name: "פיצה פיצרייה", re: /פיצה (מ)?פיצרייה|pizzeria pizza/i, kcalPerUnit: 295 },
    // unitGrams תוקנו לפי חיפוש - פרוסת פיצה ביתית רגילה 70-100 גרם (לא 120),
    // והמבורגר שלם (עם הלחמנייה, לא רק הקציצה) קרוב יותר ל-200 גרם
    { name: "פיצה", re: /פיצה|pizza/i, kcal100g: 266, unitGrams: 100 },
    // עוד רכיבי/גרסאות המבורגר (קציצות ביתיות/קנויות/מסעדה, לחמניות, בייקון,
    // וגרסת מסעדה/פאסט פוד למנה שלמה) - נתונים מדויקים מהמשתמשת
    { name: "קציצת בקר רזה להמבורגר", re: /קציצת בקר רז(ה)?( להמבורגר)?|lean beef burger patty/i, kcalPerUnit: 305 },
    // קציצת בקר קלאסית (20% שומן, ברירת המחדל) - חייבת לבוא *אחרי* קציצת
    // בקר רזה למעלה - מכילה "קציצת בקר" כתת-מחרוזת
    { name: "קציצת בקר להמבורגר", re: /קציצת בקר( קלאסי(ת)?)?( להמבורגר)?|classic beef burger patty/i, kcalPerUnit: 430 },
    { name: "קציצה טבעונית ביתית להמבורגר", re: /המבורגר (צמחוני|טבעוני) ביתי|homemade (veggie|vegan) burger/i, kcalPerUnit: 175 },
    { name: "קציצת המבורגר קפואה", re: /קציצת (המבורגר )?קפוא(ה)?|frozen burger patty/i, kcalPerUnit: 320 },
    // קציצת המבורגר במסעדה (הקציצה בלבד) - חייבת לבוא *לפני* המבורגר מסעדה/
    // פאסט פוד בהמשך (המנה השלמה) - מכילה "המבורגר מסעדה" כתת-מחרוזת
    { name: "קציצת המבורגר מסעדה", re: /קציצת המבורגר (מסעדה|מסעדתית)|restaurant burger patty/i, kcalPerUnit: 500 },
    { name: "לחמנית בריוש", re: /לחמנית בריוש|brioche bun/i, kcalPerUnit: 300 },
    // עודכן מ-180 ל-230 לפי נתון מדויק מהמשתמשת (290 קל'/100 גרם, ~80 גרם ליחידה)
    { name: "לחמנית להמבורגר", re: /לחמנית (קלאסית )?להמבורגר|לחמניית (ה)?המבורגר|classic burger bun/i, kcalPerUnit: 230 },
    { name: "Bacon Bits", re: /bacon bits/i, kcal100g: 428, unitGrams: 7 },
    { name: "בייקון", re: /בייקון|bacon/i, kcalPerUnit: 60 },
    // המבורגר צמחי חייב לבוא *לפני* המבורגר הכללי - הרגקס הכללי רחב (תופס גם
    // "burger" סתם), ובלי סדר הפוך תמיד היה נתפס כהמבורגר בשר רגיל
    { name: "המבורגר צמחי", re: /המבורגר צמחי|beyond burger|impossible burger|vegan burger|veggie burger/i, kcalPerUnit: 250 },
    // המבורגר מסעדה/פאסט פוד (מנה שלמה: קציצה+לחמנייה+רטבים+גבינה) - נתון
    // מדויק מהמשתמשת. חייב לבוא *לפני* המבורגר הכללי בהמשך - מכיל "המבורגר"
    // כתת-מחרוזת. ברירת המחדל הכללית (590 קל') כבר תואמת לגרסה הביתית הקלה
    // (500-650 קל' לפי נתון קודם של המשתמשת) ולכן לא שונתה
    { name: "המבורגר מסעדה", re: /המבורגר (מסעדה|מסעדתי|פאסט פוד)|burger (restaurant|fast food)|fast food burger/i, kcalPerUnit: 1000 },
    { name: "המבורגר", re: /המבורגר|hamburger|burger/i, kcal100g: 295, unitGrams: 200 },
    // בשר שווארמה (100 גרם, בלי פיתה/לאפה) ותפריטי מנה ספציפיים (פיתה/לאפה/
    // צלחת) - נתונים מדויקים מהמשתמשת. חייבים לבוא *לפני* שווארמה הכללית
    // בהמשך - מכילים "שווארמה" כתת-מחרוזת. ברירת המחדל הכללית (625 קל')
    // נשארת כברירת מחדל סבירה לתיאור לא-ספציפי
    { name: "בשר שווארמה", re: /בשר שווארמה|shawarma meat/i, kcal100g: 275, unitGrams: 100 },
    { name: "שווארמה בפיתה", re: /שווארמה בפיתה|shawarma (in )?pita/i, kcalPerUnit: 800 },
    { name: "שווארמה בלאפה", re: /שווארמה בלאפה|shawarma (in )?laffa/i, kcalPerUnit: 1300 },
    { name: "צלחת שווארמה", re: /צלחת שווארמה|shawarma plate/i, kcalPerUnit: 950 },
    { name: "שווארמה", re: /שווארמה|shawarma/i, kcal100g: 250, unitGrams: 250 },
    // כדור פלאפל בודד - חייב לבוא *לפני* פלאפל הכללי בהמשך - מכיל "פלאפל"
    // כתת-מחרוזת
    { name: "כדור פלאפל", re: /כדור(ים)? פלאפל|falafel ball/i, kcalPerUnit: 58 },
    // עודכן ל-188 (מ-150) לפי נתון מדויק מהמשתמשת - מנת פלאפל בפיתה (5-6
    // כדורים + חומוס/טחינה/סלט) 550-700 קל' (188*333/100≈625)
    { name: "פלאפל", re: /פלאפל|falafel/i, kcal100g: 333, unitGrams: 188 },
    { name: "בורקס", re: /בורקס|bourekas?/i, kcal100g: 330, unitGrams: 80 },
    // עוד מנות - ישראלי (חמין/מלאווח/ג'חנון) ועולמי (סושי)
    // unitGrams תוקן ל-160 (רול ממוצע של 8 חתיכות, לפי חיפוש) במקום 200
    { name: "סושי", re: /סושי|sushi/i, kcal100g: 150, unitGrams: 160 },
    { name: "חמין/צ'ולנט", re: /חמין|צ['׳]?ולנט|cholent/i, kcal100g: 200, unitGrams: 300 },
    // עודכן ל-515 קל' ליחידה (מ-380 קל100"ג/100 גרם) לפי נתון מדויק מהמשתמשת
    // (יחידת מלווח ללא תוספות, 480-550 קל'). נוסף גם כתיב "מלווח" (בלי א'),
    // הכתיב הנפוץ יותר בפועל - הכתיב הקודם "מלאווח" בלבד מעולם לא תפס אותו
    { name: "מלאווח/מלווח", re: /מלאווח|מלווח|malawach/i, kcalPerUnit: 515 },
    // עודכן ל-415 קל' ליחידה (מ-350 קל100"ג/150 גרם) לפי נתון מדויק מהמשתמשת
    // (יחידת ג'חנון אפוי ללא רסק/ביצה, 380-450 קל')
    { name: "ג'חנון", re: /ג['׳]?חנון|jachnun/i, kcalPerUnit: 415 },
    { name: "זיווה", re: /זיווה|zivda/i, kcalPerUnit: 750 },
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
    // כיסונים ממולאים נוספים - נתונים מדויקים מהמשתמשת
    { name: "קרפילך/פלמני", re: /קרפילך|פלמני|pelmeni|kreplach/i, kcal100g: 220, unitGrams: 14 },
    { name: "ורניקי", re: /ורניקי|vareniki/i, kcal100g: 175, unitGrams: 14 },
    { name: "קובניות/אמפנדס", re: /קובניות|אמפנדס|empanadas?/i, kcal100g: 275, unitGrams: 58 },
    { name: "בצק עלים", re: /בצק עלים|puff pastry/i, kcal100g: 390 },
    { name: "בצק פילו", re: /בצק פילו|phyllo|filo/i, kcal100g: 290, unitGrams: 12 },
    { name: "בצק פריך", re: /בצק פריך|shortcrust pastry|pastry dough/i, kcal100g: 435 },
    { name: "דפי סיגר", re: /דפי סיגר|סיגרים יבשים|spring roll wrapper|cigar pastry sheets/i, kcal100g: 295, unitGrams: 8 },
    // עודכן ל-165/20 (מ-200/100) והוספה "גיוזה" לפי נתון מדויק מהמשתמשת
    { name: "גיוזה/דים סאם", re: /גיוזה|דים סאם|dim sum/i, kcal100g: 165, unitGrams: 20 },
    { name: "סלט יווני", re: /סלט יווני|greek salad/i, kcal100g: 85, unitGrams: 200 },
    { name: "סלט ירקות", re: /סלט ירקות|vegetable salad|chopped salad/i, kcal100g: 50, unitGrams: 150 },
    { name: "פנקייק", re: /פנקייק|pancakes?/i, kcal100g: 227, unitGrams: 40 },
    { name: "קרפ", re: /קרפ|\bcr[eê]pe\b/i, kcal100g: 230, unitGrams: 60 },
    // (?!וא) כדי ש"קיש" לא יתפוס את "קישוא" (קישוא מתחיל באותן 3 אותיות בדיוק)
    { name: "קיש", re: /קיש(?!וא)|\bquiche\b/i, kcal100g: 280, unitGrams: 120 },
    // עוד חטיפים - לפי בקשה מפורשת
    // "במבה ממולאת נוגט" חייבת לבוא *לפני* במבה הרגילה - מכילה "במבה" כתת-מחרוזת
    { name: "במבה ממולאת נוגט", re: /במבה ממולאת נוגט|nougat bamba/i, kcal100g: 531, unitGrams: 60 },
    // עודכן ל-533 (מ-536) לפי נתון מדויק מהמשתמשת
    { name: "במבה", re: /במבה|bamba/i, kcal100g: 533, unitGrams: 25 },
    // unitGrams עודכן ל-35 (מ-25, שקית אישית אמיתית) לפי נתון מדויק מהמשתמשת
    { name: "ביסלי", re: /ביסלי|bissli/i, kcal100g: 490, unitGrams: 35 },
    // פופקורן למיקרוגל (חמאה) חייב לבוא *לפני* פופקורן הכללי - מכיל "פופקורן"
    // כתת-מחרוזת ומדובר במוצר קלורי יותר לגרם (נתון מדויק מהמשתמשת)
    { name: "פופקורן למיקרוגל", re: /פופקורן למיקרוגל|מיקרוגל.*פופקורן|microwave popcorn/i, kcal100g: 450, unitGrams: 10 },
    { name: "פופקורן", re: /פופקורן|popcorn/i, kcal100g: 400, unitGrams: 30 },
    { name: "קרמבו", re: /קרמבו|krembo/i, kcal100g: 460, unitGrams: 25 },
    { name: "טורטית", re: /טורטית|tortit/i, kcal100g: 525, unitGrams: 40 },
    { name: "דוריטוס", re: /דור[ט]?יטוס|doritos/i, kcal100g: 493, unitGrams: 55 },
    { name: "פרינגלס", re: /פרינגלס|pringles/i, kcal100g: 524, unitGrams: 20 },
    { name: "צ'יטוס", re: /צ['׳]?יטוס|cheetos/i, kcal100g: 533, unitGrams: 30 },
    // רוטב/ממרח בייגלה מלוח (גולדה) חייב לבוא *לפני* בייגלה הרגיל למטה -
    // מכיל "בייגלה" כתת-מחרוזת, ומדובר במוצר שונה לגמרי (רוטב לגלידה, לא חטיף)
    { name: "רוטב בייגלה מלוח", re: /רוטב בייגלה|ממרח בייגלה מלוח|golda bagel sauce/i, kcal100g: 550, unitGrams: 16 },
    // עודכן מ-450 ל-380 לפי נתון מדויק מהמשתמשת
    { name: "בייגלה", re: /בייגלה|bagele/i, kcal100g: 380, unitGrams: 1.35 },
    // --- משפחת גלידות/קפואים מפורטת (לפי בקשה מפורשת, ערכים קבועים ולא AI) -
    // כל הסוגים הספציפיים חייבים לבוא *לפני* "גלידה"/"ארטיק/קרטיב" הכלליים
    // בהמשך, אחרת כל תיאור ספציפי היה תמיד נתפס כערך הכללי. הערכים שנשלחו
    // היו טווחים (למשל "250-300 קל'") - נלקחה נקודת האמצע של כל טווח
    { name: "גלידת פרימיום", re: /גלידת? פרימיום|בן\s?(אנד|ו)?\s?ג'ריס|האגן\s?דאז|haagen.?dazs|ben.?(and|&).?jerry/i, kcal100g: 275, unitGrams: 70 },
    { name: "גלידה משפחתית", re: /גלידה משפחתית|גלידת חלב קלאסית/i, kcal100g: 200, unitGrams: 70 },
    { name: "גלידת חלבון", re: /גלידת חלבון|הילו\s?טופ|האלו\s?טופ|halo\s?top|סו\s?גוד|so\s?good|גלידה מופחתת קלוריות/i, kcal100g: 110, unitGrams: 70 },
    { name: "גלידה אמריקאית", re: /גלידה אמריקאית|soft serve/i, kcal100g: 175, unitGrams: 117 },
    { name: "גלידה טבעונית קוקוס", re: /גלידה טבעונית.*קוקוס|גלידת קוקוס טבעונית/i, kcal100g: 240, unitGrams: 69 },
    { name: "גלידה טבעונית שיבולת שועל/סויה", re: /גלידה טבעונית.*(שיבולת שועל|סויה)|גלידת (סויה|שיבולת שועל) טבעונית/i, kcal100g: 180, unitGrams: 69 },
    { name: "סורבה", re: /סורבה|sorbet/i, kcal100g: 125, unitGrams: 74 },
    // משפחת מגנום מורחבת - נתונים מדויקים מהמשתמשת (טווחים, נלקחה נקודת
    // האמצע של כל טווח). כל וריאנט "מיני" חייב לבוא *לפני* "מגנום" הכללי
    // בהמשך (מכיל "מגנום" כתת-מחרוזת), ו"דאבל" חייב לבוא *לפני* הגרסה
    // הרגילה מאותו גודל מאותה סיבה
    { name: "מגנום מיני דאבל", re: /מגנום מיני דאבל|מיני מגנום דאבל/i, kcalPerUnit: 165 },
    { name: "מגנום מיני שקדים/פצפוצים", re: /מגנום מיני (שקדים|פצפוצים)|מיני מגנום (שקדים|פצפוצים)/i, kcalPerUnit: 155 },
    // עודכן ל-148 (מ-145) לפי נתון מדויק מהמשתמשת (Magnum Mini, טווח 140-155)
    { name: "מגנום מיני", re: /מגנום מיני|מיני מגנום|שלגון מיני/i, kcalPerUnit: 148 },
    { name: "מגנום דאבל קרמל/שוקולד", re: /magnum double (caramel|chocolate)|מגנום דאבל.*(קרמל|שוקולד)/i, kcalPerUnit: 329 },
    { name: "מגנום דאבל", re: /מגנום דאבל|double magnum/i, kcalPerUnit: 295 },
    { name: "מגנום טבעוני", re: /מגנום טבעוני|vegan magnum/i, kcalPerUnit: 250 },
    { name: "מגנום שקדים", re: /מגנום שקדים|almond magnum/i, kcalPerUnit: 275 },
    { name: "מגנום", re: /מגנום|magnum/i, kcalPerUnit: 255 },
    { name: "שלגון דיאט", re: /שלגון (דיאט|ללא סוכר|מופחת קלוריות)/i, kcalPerUnit: 55 },
    { name: "שלגון חלבי", re: /שלגון חלבי|שלגון וניל|שלגון שוקו/i, kcalPerUnit: 140 },
    { name: "טילון ענק", re: /טילון (ענק|פרימיום)/i, kcalPerUnit: 305 },
    { name: "מיני טילון", re: /מיני טילון|טילון מיני/i, kcalPerUnit: 95 },
    { name: "טילון", re: /טילון/i, kcalPerUnit: 205 },
    { name: "קוקי גלידה", re: /קוקי גלידה|סנדוויץ' גלידה ענקי/i, kcalPerUnit: 400 },
    // עודכן ל-190 (מ-200) לפי נתון מדויק מהמשתמשת
    { name: "קסטה", re: /קסטה/i, kcalPerUnit: 190 },
    { name: "ארטיק דיאט", re: /ארטיק (דיאט|0% סוכר|ללא סוכר)|קרטיב דיאט/i, kcalPerUnit: 9 },
    { name: "ארטיק פרי טבעי", re: /ארטיק (פרי טבעי|100% פרי)|פריגת|פולי קראנץ/i, kcalPerUnit: 90 },
    { name: "יוגורט קפוא", re: /יוגורט קפוא|frozen yogurt|יוגורטיה/i, kcal100g: 120, unitGrams: 200 },
    { name: "גביע גלידה", re: /גביע (גלידה|שוט)/i, kcalPerUnit: 18 },
    { name: "סירופ לגלידה", re: /סירופ (שוקולד|מייפל|תות).*גלידה|סירופ לגלידה/i, kcal100g: 300 },
    { name: "סוכריות לזרייה על גלידה", re: /סוכריות (צבעוניות )?לזריי(ה|ת)|ספרינקלס|sprinkles/i, kcal100g: 360 },
    // עודכן ל-85 (מ-95) לפי נתון מדויק מהמשתמשת
    { name: "מוצ'י גלידה", re: /מוצ'י גלידה|\bmochi\b/i, kcalPerUnit: 85 },
    // עודכן ל-78/70 (מ-70/60) לפי נתון מדויק מהמשתמשת (ארטיק קרח דובדבן/לימון)
    { name: "ארטיק/קרטיב", re: /ארטיק|קרטיב|popsicle|ice pop/i, kcal100g: 78, unitGrams: 70 },
    // גלידת גולדה (רשת ישראלית) חייבת לבוא *לפני* גלידה הכללית - קלורית יותר
    // לגרם (נתון מדויק מהמשתמשת, מנה קטנה/כדור כ-100 גרם)
    { name: "גלידת גולדה", re: /גולדה|golda/i, kcal100g: 230, unitGrams: 100 },
    { name: "גלידה", re: /גלידה|ice cream/i, kcal100g: 207, unitGrams: 60 },
    { name: "עוגיות", re: /עוגי(ות|ה)|cookies?/i, kcal100g: 480, unitGrams: 15 },
    { name: "עוגה", re: /עוגה|\bcake\b/i, kcal100g: 350, unitGrams: 80 },
    { name: "דונאט", re: /דונאט|donut|doughnut/i, kcal100g: 416, unitGrams: 60 },
    { name: "פופ טארטס", re: /פופ.?טארטס|pop.?tarts?/i, kcal100g: 400, unitGrams: 50 },
    // קרואסון/רוגלך שוקולד חייב לבוא *לפני* קרואסון הכללי - מכיל "קרואסון"
    // כתת-מחרוזת ומדובר במוצר קלורי יותר (נתון מדויק מהמשתמשת)
    { name: "קרואסון שוקולד", re: /קרואסון שוקולד|רוגלך (גדול|שוקולד)|chocolate croissant/i, kcal100g: 400, unitGrams: 70 },
    // unitGrams עודכן מ-60 ל-76 לפי נתון מדויק מהמשתמשת (~270-350 קל' ליחידה)
    { name: "קרואסון", re: /קרואסון|croissant/i, kcal100g: 406, unitGrams: 76 },
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
    // תפוצ'יפס (חטיף צ'יפס בשקית) חייב לבוא *לפני* צ'יפס (צ'יפס/פירה מטוגן) -
    // מכיל "צ'יפס" כתת-מחרוזת, ומוצר שונה לגמרי (חטיף יבש, לא צ'יפס טרי מטוגן)
    // unitGrams עודכן ל-50 (שקית אישית אמיתית) לפי נתון מדויק מהמשתמשת
    { name: "תפוצ'יפס", re: /תפוצ['׳]?יפס|צ['׳]?יפס בשקית|potato chips|crisps/i, kcal100g: 536, unitGrams: 50 },
    // עוד גרסאות צ'יפס (אפוי/איירפריי מול מטוגן, ומנות פאסט פוד קטנה/גדולה) -
    // נתונים מדויקים מהמשתמשת (ל-100 גרם, אלא אם צוין אחרת). כולם חייבים
    // לבוא *לפני* צ'יפס הכללי בהמשך - מכילים "צ'יפס" כתת-מחרוזת
    { name: "צ'יפס אפוי/איירפריי", re: /צ['׳]?יפס (אפוי|באיירפריי|בנינג['׳]?ה|בתנור)|baked fries|air.?fry(er)? fries/i, kcal100g: 145, unitGrams: 100 },
    { name: "צ'יפס מטוגן", re: /צ['׳]?יפס מטוגן|fried fries/i, kcal100g: 280, unitGrams: 100 },
    { name: "מנת צ'יפס גדולה", re: /מנת צ['׳]?יפס גדולה|large fries/i, kcalPerUnit: 500 },
    // מנת צ'יפס קטנה חייבת לבוא *אחרי* מנת צ'יפס גדולה למעלה - שתיהן מכילות
    // "מנת צ'יפס" כתת-מחרוזת
    { name: "מנת צ'יפס קטנה", re: /מנת צ['׳]?יפס קטנה|small fries/i, kcalPerUnit: 255 },
    { name: "צ'יפס", re: /צ['׳]?יפס|fries|french fries/i, kcal100g: 312, unitGrams: 150 },
    { name: "פירה", re: /פירה|mashed potato(es)?/i, kcal100g: 105, unitGrams: 150 },
    // "רוטב" גנרי (בלי שם ספציפי אחריו, כמו "עגבניות"/"סויה"/"פסטו" וכו') -
    // *חייב* לבוא אחרון בטבלה כולה, כדי שכל רוטב ספציפי יזוהה קודם (הוא
    // תת-מחרוזת של כולם: "רוטב עגבניות" וכו') - נופל לערך הזה רק כשאין התאמה
    // מדויקת יותר, כדי שמשפט עם "רוטב" סתם יחושב מקומית ולא יידרש בריחה ל-AI
    { name: "רוטב", re: /רוטב/i, kcal100g: 45, unitGrams: 60 },
    // "דג" גנרי (בלי שם ספציפי, כמו "סלמון"/"טונה"/"דג חרב") - כמו "רוטב"
    // למעלה, *חייב* לבוא אחרון בטבלה כולה כדי שכל דג ספציפי יזוהה קודם.
    // ערך ממוצע לדג רזה-בינוני מבושל/מטוגן במחבת - דווח בפועל: "100 גרם דג
    // במחבת" לא זוהה בכלל וקפץ לאומדן AI פחות מדויק
    // (?!ן) חוסם התנגשות עם "דגן"/"דגנים"/"דגני בוקר" (כולם מכילים "דג" כתת-
    // מחרוזת, אבל אלה תבואות/דגני-בוקר, לא דג בכלל)
    { name: "דג", re: /דג(?!ן)/i, kcal100g: 180, unitGrams: 120 },
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
    // "גדושה"/"גדושות" (heaping) חייבות לבוא *לפני* כף/כפית הרגילים - כף/כפית
    // גדושה (נפוץ בממרחים סמיכים כמו שוקולד/חלווה) שוקלת כמעט כפול מהמידה
    // השטוחה הרגילה, לפי נתון מדויק מהמשתמשת (כפית גדושה~13 גרם, כף גדושה~30 גרם)
    { re: /כפות גדושות|כף גדושה|heaping tablespoons?|heaped tablespoons?/i, gramsPerUnit: 30 },
    { re: /כפיות גדושות|כפית גדושה|heaping teaspoons?|heaped teaspoons?/i, gramsPerUnit: 13 },
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
// מספר קלוריות מפורש שכתוב ליד המאכל (למשל "טונה 50 קלוריות") - לפי בקשה
// מפורשת ("אם רשום מספר וקלוריות אז זה המספר"). בודקים את זה *לפני* הכל -
// כשהמשתמשת כבר אמרה בדיוק כמה קלוריות זה, אין טעם לנחש לפי גרם/כמות/משקל-
// יחידה, ובלי הבדיקה הזו אותו המספר (50) היה נתפס בטעות ע"י parseQuantityCount
// ככמות-יחידות (50 טונות טונה!) - זו בדיוק התקלה שדווחה בפועל
const EXPLICIT_CALORIES_RE = /(\d{1,5}(?:\.\d+)?)\s*(kcal\b|cal\b|calories?\b|קלוריות|سعرة)/i;

function computeItemCalories(item, contextText, isMultiFood) {
    const explicitCaloriesMatch = contextText.match(EXPLICIT_CALORIES_RE);
    if (explicitCaloriesMatch) return parseFloat(explicitCaloriesMatch[1]);
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
    // מאכלי רשתות מזון - לפעמים יש ערך שונה למדינה (למשל "ביג מק" בישראל מול
    // ארה"ב) - נבחר לפי הגדרת "מדינה" בהגדרות (לא ניחוש לפי שפה), עם נפילה
    // חזרה לישראל ואז לכל ערך זמין אחר, כדי שלעולם לא ייצא 0 סתם כי המדינה
    // שנבחרה עוד לא קיימת בטבלה למאכל הזה
    if (item.kcalPerUnitByCountry) {
        const byCountry = item.kcalPerUnitByCountry;
        const chosen = byCountry[getUserCountry()] ?? byCountry.il ?? Object.values(byCountry)[0];
        return count * chosen;
    }
    if (item.kcalPerUnit != null) return count * item.kcalPerUnit;
    if (grams != null) return (grams / 100) * kcal100g;
    // בלי גרם/מ"ל/כף/כפית/כוס/גביע/חופן מפורש - אם למאכל יש משקל-יחידה
    // ממוצע ידוע (פרי/מנה טיפוסית, למשל בננה=118 גרם), מחשבים לפי זה *
    // הכמות שזוהתה, עם התאמת גדול/קטן אם צוינה. למאכלי-תוספת כמו בצל/שום -
    // כשהם חלק מרשימה של כמה מאכלים (isMultiFood), משתמשים ב-garnishGrams
    // (כמות-תוספת קטנה) במקום unitGrams (יחידה שלמה), כי ברוב המקרים "בצל"
    // ברשימת מאכלים הוא תוספת קצוצה, לא בצל שלם
    const baseGrams = (isMultiFood && item.garnishGrams != null) ? item.garnishGrams : item.unitGrams;
    if (baseGrams != null) return (count * baseGrams * parseSizeMultiplier(contextText) / 100) * kcal100g;
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

// מילות-יחידה (פרוסה/כוס/כף/וכו') שתמיד מתארות את המאכל שבא *אחריהן* בטקסט
// ("חצי פרוסת גבינה", "3 כפות פירה") - בניגוד למילות גודל כמו "גדול/קטן"
// שיכולות לתאר גם את המאכל שבא *לפניהן* ("שניצל 2 בינוני"). ההבחנה הזו קריטית
// לפיצול פער נכון בין שני מאכלים.
// גרם/ג'/מ"ל/ml/g/gram/grams חייבים להיות פה גם - בלעדיהם "+ 200 גרם אבטיח"
// אחרי מאכל אחר (בלי כמות/גרם משלו) פוצל לפי אמצע-המרווח הגס, שהשאיר את ה-
// "200" הבודד (בלי "גרם") צמוד למאכל ה*קודם* וגרם לו להיחשב כאילו נכתבו 200
// יחידות ממנו (למשל "טונה"+200 יצא 23,200 קלוריות) - דווח בפועל ואומת בקונסול
const GAP_UNIT_NOUN_RE = /^(פרוסות|פרוסת|פרוסה|כוסות|כוס|כפות|כף|כפיות|כפית|גביעים|גביע|קופסאות|קופסה|אריזות|אריזה|חופנים|חופן|גרם|גראם|ג['׳]|מ"ל|מ״ל|ml|g|gram|grams)$/i;
const GAP_QUANTITY_TOKEN_RE = /^ו?(?:\d+(?:\.\d+)?|חצי|רבע|שליש)$/;

// מוצאת את נקודת הפיצול בין שני מאכלים בתוך "הפער" ביניהם (gapStart..gapEnd).
// קודם בודקים אם בפער יש מילת-יחידה (כמו "פרוסת"/"כפות") - אם כן, כל צירוף
// הכמות שמוביל אליה (המספר/מילת השבר הצמודים לפניה, כולל "ו" מחבר) שייך
// כולו למאכל *הבא*, לא מתחלק - כי "בצל וחצי פרוסת גבינה" מתאר חצי פרוסה של
// הגבינה, לא חצי בצל, למרות שהמילים קרובות יותר (במספר תווים) לבצל.
// אחר כך, אם יש "+" או "," בפער - אלה גבול-מאכל מפורש וודאי (המשתמשת כותבת
// אותם בכוונה כדי להפריד בין פריטים, לפי בקשה מפורשת) - הכל אחרי הסימן הזה
// (כולל כמות צמודה אליו, כמו "3" ב"+ 3 בננות") שייך למאכל הבא בוודאות, בלי
// להסתמך על ניחוש-אמצע שעלול לטעות. רק אם אין גם מילת-יחידה וגם אין +/,
// חוזרים לחלוקה הכי קרובה לאמצע הפער - אבל תמיד *על רווח* (לא באמצע מילה),
// כדי שמילת כמות כמו "חצי" לא תיחתך לשניים (מה שהיה מונע זיהוי שלה בשני הצדדים)
function findGapSplitPoint(text, gapStart, gapEnd) {
    if (gapEnd <= gapStart) return gapStart;
    const gapText = text.slice(gapStart, gapEnd);
    const tokens = [];
    const tokenRe = /\S+/g;
    let tm;
    while ((tm = tokenRe.exec(gapText))) tokens.push({ text: tm[0].replace(/[,.!?;:]+$/, ''), start: tm.index });
    const unitTokenIdx = tokens.findIndex(t => GAP_UNIT_NOUN_RE.test(t.text));
    if (unitTokenIdx !== -1) {
        let cutTokenIdx = unitTokenIdx;
        for (let i = unitTokenIdx - 1; i >= 0; i--) {
            if (GAP_QUANTITY_TOKEN_RE.test(tokens[i].text)) cutTokenIdx = i;
            else break;
        }
        return gapStart + tokens[cutTokenIdx].start;
    }
    let lastSepEnd = -1;
    const sepRe = /[+,]/g;
    let sm;
    while ((sm = sepRe.exec(gapText))) lastSepEnd = sm.index + 1;
    if (lastSepEnd !== -1) return gapStart + lastSepEnd;
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
    const isMultiFood = matches.length > 1;
    let total = 0, matchedAny = false;
    matches.forEach((match, i) => {
        // לפני המאכל *הראשון* ואחרי המאכל *האחרון* אין שום מאכל מתחרה על
        // הטקסט - כל הקידומת/סיומת שייכת במלואה למאכל היחיד הזה, לא צריך
        // לפצל באמצע. בלי התיקון הזה, "חצי בננה" (בלי מאכל נוסף בטקסט) היה
        // מפצל את "חצי" באמצע הפער-מתחילת-המחרוזת ולעיתים מאבד אותו לגמרי -
        // וגם "חצי בננה" וגם "בננה" סתם יצאו באותו מספר (105 קלוריות), בלי
        // שה"חצי" הועיל בכלל
        const windowStart = i > 0 ? findGapSplitPoint(text, matches[i - 1].end, match.start) : 0;
        const windowEnd = i < matches.length - 1 ? findGapSplitPoint(text, match.end, matches[i + 1].start) : text.length;
        const kcal = computeItemCalories(match.item, text.slice(windowStart, windowEnd), isMultiFood);
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
// ממלא קלוריות לבד. שינוי טקסט המזון מעדכן את הקלוריות בהתאם, לפי בקשה
// מפורשת ("שמשנים את הטקסט זה משתנה בהתאם") - אבל *לא* תמיד ע"י הרצת המנוע
// הכללי מחדש על כל הטקסט: דיווח אמיתי הראה שהמנוע (שמכוון לתיאורי-מרכיב
// פשוטים כמו "2 כפות קוטג'") לא אמין בכלל לטקסט ארוך/מחובר של כמה
// פריטים+פריסטים ("פיתה+שוקולד+פופקורן+ערגלית+בייגלה" יצא 796 במקום כ-
// 280-320 האמיתיים) - ושהוספת מספר לפני טקסט קיים ("2 " + מה שהיה) גרמה לו
// "לתפוס" התאמה שגויה לגמרי (50 הפך ל-450). שני המקרים האלה מזוהים במפורש
// ומטופלים בלי לגעת במנוע הכללי בכלל - רק "ברירת המחדל" (טקסט חדש/מוקטן)
// עדיין מריצה אותו מחדש
function autoFillMealCalories(foodInput) {
    const row = foodInput.closest('.meal-row');
    const caloriesInput = row && row.querySelector('.calories-input');
    if (!caloriesInput) return;
    const newText = foodInput.value.trim();
    const prevText = foodInput.dataset.valueBeforeEdit || '';
    const prevCalories = parseInt(caloriesInput.value) || 0;

    // מקרה 1: "N " לפני בדיוק אותו טקסט שהיה - כוונה ברורה של "עוד N יחידות
    // מאותו הדבר", לא תיאור חדש. מכפילים את מה שכבר היה
    const prefixMatch = prevText && newText.match(/^(\d+)\s+([\s\S]+)$/);
    if (prefixMatch && prefixMatch[2] === prevText && prevCalories > 0) {
        caloriesInput.value = Math.round(prevCalories * parseInt(prefixMatch[1], 10));
        updateLiveCaloriesToday();
        return;
    }
    // מקרה 2: תוספת בסוף הטקסט הקיים (למשל "+ עוד פריט") - מחשבים קלוריות
    // רק על התוספת החדשה ומוסיפים לקיים, בדיוק כמו שבוררי-הפריסטים עצמם
    // עושים (ר' selectPresetPickerItem/confirmFoodPickerSelection) - לא
    // מריצים את המנוע מחדש על הטקסט המאוחד כולו
    if (prevText && prevCalories > 0 && newText.startsWith(prevText) && newText.length > prevText.length) {
        const addedText = newText.slice(prevText.length).replace(/^[\s+]+/, '');
        const addedEstimate = estimateFreeTextCalories(addedText);
        if (addedEstimate > 0) {
            caloriesInput.value = Math.round(prevCalories + addedEstimate);
            updateLiveCaloriesToday();
            return;
        }
    }
    // ברירת מחדל: טקסט חדש לגמרי, או שהוקטן (הוסר ממנו חלק) - מריצים את
    // המנוע הכללי מחדש על כל הטקסט
    const estimate = estimateFreeTextCalories(newText);
    caloriesInput.value = estimate > 0 ? Math.round(estimate) : '';
    updateLiveCaloriesToday();
    // אם נשאר בטקסט חלק משמעותי שהמנוע המקומי לא זיהה בכלל (למשל שם פריט
    // ממותג/מסעדה כמו "מק ריאל") - למשתמשת פרימיום מנסים ברקע גם את אותו
    // AI עם חיפוש אמיתי באינטרנט שמשמש את הוספה-מהירה-עם-AI, בלי לחסום את
    // ההקלדה ובלי לפתוח מודל שאלה שלא התבקשה כאן - לפי בקשה מפורשת
    // ("שגם בשורות האלה יהיה AI שצריך")
    if (isPremiumUser && newText && hasUnmatchedFoodText(newText)) {
        escalateMealRowToAI(foodInput, caloriesInput, newText);
    }
}

// מילות/יחידות שכיחות שנשארות "יתומות" אחרי שהמאכל שהן מתארות כבר הוסר
// מהטקסט (כמות/גודל/מילות חיבור) - לא סימן לפריט לא-מזוהה
const FOOD_LEFTOVER_IGNORE_RE = /^(עם|וגם|גם|ו|חצי|רבע|שליש|כפית|כפיות|כף|כפות|כוס|כוסות|גרם|גראם|מ["״]?ל|יחידה|יחידות|קטן|קטנה|גדול|גדולה|בינוני|בינונית|מנה|מנת|פרוסה|פרוסת|פרוסות|של|עוד|קצת|בערך)$/;
// יש בטקסט מילה משמעותית (2+ תווים, לא מספר/יחידה/מילת-כמות) שלא נתפסה ע"י
// אף רשומה ב-FOOD_CALORIE_DB - סימן שההערכה המקומית עלולה להיות חסרה (לא
// בהכרח שגויה - יכול גם להיות תיאור/שם שלא משפיע על הקלוריות, אבל עדיף
// לבדוק מול AI מאשר לפספס פריט שלם בשקט)
function hasUnmatchedFoodText(text) {
    const matches = findAllFoodMatches(text);
    let leftover = text;
    [...matches].sort((a, b) => b.start - a.start).forEach(m => {
        leftover = leftover.slice(0, m.start) + ' ' + leftover.slice(m.end);
    });
    const tokens = leftover.replace(/[,.!?;:+\-"'׳״]+/g, ' ').split(/\s+/).filter(Boolean);
    return tokens.some(tok => !/^\d+$/.test(tok) && !FOOD_LEFTOVER_IGNORE_RE.test(tok) && tok.length >= 2);
}

// קריאת AI ברקע לשורת ארוחה רגילה (לא מודל ה-AI הייעודי) - אותה
// estimateFoodTextViaAI בדיוק כמו בהוספה המהירה, אבל בלי לפתוח שום מודל:
// 'clarify'/'unknown'/'limit'/כישלון כפול פשוט משאירים את ההערכה המקומית
// שכבר מולאה, כי זו שדרוג-רקע אופציונלי ולא פעולה שהמשתמשת חיכתה לה
// במפורש. בודקים בסוף שהטקסט בשדה לא השתנה בינתיים (המשתמשת המשיכה
// לערוך) - כדי לא לדרוס עריכה חדשה עם תוצאה מאוחרת של הטקסט הישן
async function escalateMealRowToAI(foodInput, caloriesInput, text) {
    caloriesInput.classList.add('ai-estimating');
    try {
        const { data: sessionData } = await supabaseClient.auth.getSession();
        const token = sessionData && sessionData.session ? sessionData.session.access_token : null;
        if (!token) return;
        let attempt = await estimateFoodTextViaAI(token, text);
        if (attempt.status === 'retry') attempt = await estimateFoodTextViaAI(token, text);
        if (foodInput.value.trim() !== text) return;
        if (attempt.status === 'estimate' && attempt.calories > 0) {
            caloriesInput.value = Math.round(attempt.calories);
            updateLiveCaloriesToday();
        }
    } catch (e) {
        // שקט בכוונה - שדרוג-רקע אופציונלי, לא פעולה יזומה של המשתמשת
    } finally {
        caloriesInput.classList.remove('ai-estimating');
    }
}

// --- שמירת מה שכבר הוקלד ביומן היומי כ"ארוחה קבועה" (meal_presets) בלחיצה
// אחת - בלי לצאת למסך ניהול-ארוחות נפרד ולהקליד את אותו הדבר שוב.
// data-category על ה-select הקיים בשורה כבר קובע לאיזו קטגוריה זה משתייך ---
function saveMealRowAsPreset(button) {
    const row = button.closest('.meal-row');
    if (!row) return;
    const foodInput = row.querySelector('.food-input');
    const caloriesInput = row.querySelector('.calories-input');
    const categoryTrigger = row.querySelector('.preset-select-trigger');
    const name = foodInput.value.trim();
    const calories = parseInt(caloriesInput.value) || 0;
    if (!name || calories <= 0) { showAppToast(t('meal_save_preset_missing'), 'error'); return; }
    if (!isPremiumUser && cachedPresets.length >= MEAL_PRESET_FREE_LIMIT) {
        showAppToast(t('preset_limit_desc'), 'error');
        openPremiumUpgradeModal();
        return;
    }
    // לא שומרים ישירות בשקט תחת קטגוריה מנוחשת - פותחים את "הוספת ארוחה
    // למאגר" עם שם+קלוריות כבר ממולאים ובורר-קטגוריה מוצג, כדי שהמשתמשת
    // תבחר/תאשר בעצמה איפה לשמור - לפי בקשה מפורשת ("שישאל באיזה קטגוריה
    // לשמור, והמשתמש ישמור איפה שהוא רוצה"). קטגוריית השורה עצמה (data-category
    // על .preset-select-trigger) רק ממלאת ברירת מחדל סבירה בבורר, לא קובעת
    cancelPresetEdit();
    document.getElementById('new-preset-name').value = name;
    document.getElementById('new-preset-calories').value = calories;
    const defaultCategory = categoryTrigger ? categoryTrigger.getAttribute('data-category') : 'snack';
    document.getElementById('new-preset-category').value = defaultCategory;
    updateCustomSelectDisplay('new-preset-category');
    openModal('modal-add-preset');
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
    // מוסיפים למה שכבר יש בשורה (אם יש) במקום לדרוס - אותה הנהגה בדיוק כמו
    // selectPresetPickerItem (בורר "ארוחה קבועה"), לפי בקשה מפורשת
    const foodInput = foodPickerTargetRow.querySelector('.food-input');
    const caloriesInput = foodPickerTargetRow.querySelector('.calories-input');
    const existingFood = foodInput.value.trim();
    const existingCalories = parseInt(caloriesInput.value) || 0;
    const newEntry = `${foodPickerSelectedItem.name} - ${qty}${unitLabel}`;
    foodInput.value = existingFood ? `${existingFood} + ${newEntry}` : newEntry;
    caloriesInput.value = existingCalories + calories;
    foodPickerTargetRow.dataset.touched = 'true';
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
    updateCustomSelectDisplay('add-slot-day');
    updateCustomSelectDisplay('add-slot-num');
    updateCustomSelectDisplay('add-slot-reminder');
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
    if (!isNotificationsEnabled()) return;
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
    } else if (Notification.permission === 'granted' && isNotificationsEnabled()) {
        // בלי הבדיקה הזו, טעינה חוזרת הייתה תמיד רושמת-מחדש למנוי ה-push גם
        // אחרי שהמשתמשת כיבתה אותו במפורש במתג בהגדרות (הרשאת הדפדפן עצמה
        // כבר "granted" ולא ניתנת לביטול מקוד, אז זה היה עוקף את הכיבוי בכל
        // כניסה מחדש לאפליקציה)
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
    const switchWrap = document.getElementById('notifications-enabled-switch-wrap');
    const toggle = document.getElementById('notifications-enabled-toggle');
    const status = document.getElementById('settings-notifications-status');
    if (!btn || !status) return;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        btn.classList.remove('hidden');
        if (switchWrap) switchWrap.classList.add('hidden');
        btn.textContent = t('settings_notifications_btn_blocked');
        status.textContent = t('settings_notifications_status_unsupported');
        return;
    }
    // ברגע שיש הרשאת דפדפן, מציגים את המתג ברמת-האפליקציה (פתוח/סגור) במקום
    // כפתור "Enable" - ההרשאה עצמה כבר ניתנה ואי אפשר לבטל אותה מקוד, אבל
    // המתג שולט אם בפועל שולחים תזכורות, ר' toggleNotificationsEnabled
    if (Notification.permission === 'granted') {
        btn.classList.add('hidden');
        if (switchWrap) switchWrap.classList.remove('hidden');
        if (toggle) toggle.checked = isNotificationsEnabled();
        status.textContent = isNotificationsEnabled() ? t('settings_notifications_status_granted') : t('settings_notifications_status_muted');
    } else if (Notification.permission === 'denied') {
        btn.classList.remove('hidden');
        if (switchWrap) switchWrap.classList.add('hidden');
        btn.textContent = t('settings_notifications_btn_blocked');
        status.textContent = t('settings_notifications_status_denied');
    } else {
        btn.classList.remove('hidden');
        if (switchWrap) switchWrap.classList.add('hidden');
        btn.textContent = t('settings_notifications_btn_enable');
        status.textContent = t('settings_notifications_status_default');
    }
}

// מתג ברמת-האפליקציה (לא הרשאת הדפדפן עצמה, שהיא חד-כיוונית) - לפי בקשה
// מפורשת ("אפשרות לבחור אם זה פתוח או סגור"). פתוח: מרשמת/משחזרת את מנוי
// ה-push האמיתי. סגור: מבטלת את המנוי בפועל (גם מהדפדפן וגם מהטבלה בשרת)
// כדי שלא יגיעו תזכורות רקע גם כשהאפליקציה סגורה - לא רק משתיקה תצוגה
function isNotificationsEnabled() {
    return localStorage.getItem('weekwise_notifications_enabled') !== 'false';
}

async function toggleNotificationsEnabled() {
    const toggle = document.getElementById('notifications-enabled-toggle');
    const enabled = toggle ? toggle.checked : !isNotificationsEnabled();
    localStorage.setItem('weekwise_notifications_enabled', enabled ? 'true' : 'false');
    if (enabled) {
        await registerPushNotifications();
        showAppToast(t('settings_notifications_status_granted'));
    } else {
        await unsubscribePushNotifications();
        showAppToast(t('settings_notifications_status_muted'));
    }
    renderNotificationSettingsStatus();
}

async function unsubscribePushNotifications() {
    if (!('serviceWorker' in navigator)) return;
    try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) return;
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        if (supabaseClient) await supabaseClient.from('push_subscriptions').delete().eq('endpoint', endpoint);
    } catch (err) {
        console.error('Push unsubscribe failed:', err);
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

// --- יעדים יומיים לתזונה (קלוריות/חלבון) - נשמרים ב-Supabase (טבלת
// nutrition_goals, שורה אחת לכל משתמשת), לא רק ב-localStorage כמו קודם.
// localStorage-בלבד גרם ליעד "להתאפס" חזרה לברירת המחדל (2000) - בין השאר
// בגלל שבספארי ב-iOS יש מחיקה אוטומטית (ITP) של אחסון מקומי לאתרים שלא
// נפתחו כמה ימים, וגם במעבר בין מכשירים - לפי דיווח מפורש ("תבדוק שזה
// משאיר את השינוי האחרון"). cachedCalorieGoal/cachedProteinGoal נטענים פעם
// אחת מ-Supabase ב-loadNutritionGoals (נקרא באתחול), וה-getters הסינכרוניים
// הקיימים (נקראים מהמון מקומות בקוד) ממשיכים לעבוד בלי שינוי - הם רק קוראים
// מהמטמון במקום מ-localStorage ישירות. localStorage עדיין מתעדכן כגיבוי/
// מטמון-קריאה-ראשונית מהיר, אבל Supabase הוא מקור האמת בכל טעינה ---
let cachedCalorieGoal = null, cachedProteinGoal = null;
function calorieDailyGoalKey() { return `weekwise_calorie_goal_${currentUserId}`; }
function getCalorieDailyGoal() {
    if (cachedCalorieGoal != null) return cachedCalorieGoal;
    return parseInt(localStorage.getItem(calorieDailyGoalKey())) || 2000;
}
function proteinDailyGoalKey() { return `weekwise_protein_goal_${currentUserId}`; }
function getProteinDailyGoal() {
    if (cachedProteinGoal != null) return cachedProteinGoal;
    return parseInt(localStorage.getItem(proteinDailyGoalKey())) || 100;
}

async function loadNutritionGoals() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('nutrition_goals').select('*').eq('user_id', currentUserId).maybeSingle();
    if (data) {
        cachedCalorieGoal = data.calorie_goal;
        cachedProteinGoal = data.protein_goal;
    } else {
        // אין עדיין שורה ב-Supabase (משתמשת ותיקה, לפני המעבר) - שולפים ערך
        // ישן מ-localStorage אם קיים, כדי לא לאבד יעד שכבר הוגדר, ומיד כותבים
        // אותו ל-Supabase כדי שמעכשיו יהיה מסונכרן
        cachedCalorieGoal = parseInt(localStorage.getItem(calorieDailyGoalKey())) || 2000;
        cachedProteinGoal = parseInt(localStorage.getItem(proteinDailyGoalKey())) || 100;
        await supabaseClient.from('nutrition_goals').upsert({ user_id: currentUserId, username: currentUsername, calorie_goal: cachedCalorieGoal, protein_goal: cachedProteinGoal }, { onConflict: 'user_id' });
    }
    localStorage.setItem(calorieDailyGoalKey(), String(cachedCalorieGoal));
    localStorage.setItem(proteinDailyGoalKey(), String(cachedProteinGoal));
    const calorieGoalInput = document.getElementById('calorie-daily-goal-input');
    if (calorieGoalInput) calorieGoalInput.value = cachedCalorieGoal;
    const proteinGoalInput = document.getElementById('protein-daily-goal-input');
    if (proteinGoalInput) proteinGoalInput.value = cachedProteinGoal;
    updateNutritionGoalProgress();
}

async function saveCalorieDailyGoal() {
    const val = parseInt(document.getElementById('calorie-daily-goal-input').value) || 2000;
    cachedCalorieGoal = val;
    localStorage.setItem(calorieDailyGoalKey(), String(val));
    updateNutritionGoalProgress();
    await supabaseClient.from('nutrition_goals').upsert({ user_id: currentUserId, username: currentUsername, calorie_goal: val, protein_goal: getProteinDailyGoal() }, { onConflict: 'user_id' });
}
async function saveProteinDailyGoal() {
    const val = parseInt(document.getElementById('protein-daily-goal-input').value) || 100;
    cachedProteinGoal = val;
    localStorage.setItem(proteinDailyGoalKey(), String(val));
    updateNutritionGoalProgress();
    await supabaseClient.from('nutrition_goals').upsert({ user_id: currentUserId, username: currentUsername, calorie_goal: getCalorieDailyGoal(), protein_goal: val }, { onConflict: 'user_id' });
}
let todayCaloriesTotal = 0, todayProteinTotal = 0;
function updateNutritionGoalProgress() {
    const calorieGoal = getCalorieDailyGoal();
    const calorieFill = document.getElementById('calorie-goal-progress-fill');
    if (calorieFill) calorieFill.style.width = `${calorieGoal > 0 ? Math.min(100, Math.round((todayCaloriesTotal / calorieGoal) * 100)) : 0}%`;
    const proteinGoal = getProteinDailyGoal();
    const proteinFill = document.getElementById('protein-goal-progress-fill');
    if (proteinFill) proteinFill.style.width = `${proteinGoal > 0 ? Math.min(100, Math.round((todayProteinTotal / proteinGoal) * 100)) : 0}%`;
    updateMiniCalorieIndicator();
}

// --- אינדיקציה קטנה בתחתית כרטיס "מעקב ארוחות יומי" (לא כרטיס "מדדי
// קלוריות" הנפרד) - כדי שהמשתמשת תראה איפה היא עומדת בלי לצאת מהמסך הזה ---
function updateMiniCalorieIndicator() {
    const el = document.getElementById('daily-calorie-mini-indicator');
    if (!el) return;
    const goal = getCalorieDailyGoal();
    const remaining = goal - todayCaloriesTotal;
    const remainingText = remaining >= 0
        ? t('daily_calorie_mini_remaining').replace('{amount}', remaining)
        : t('daily_calorie_mini_over').replace('{amount}', Math.abs(remaining));
    el.textContent = t('daily_calorie_mini_summary').replace('{total}', todayCaloriesTotal).replace('{goal}', goal) + ' · ' + remainingText;
    updateHomeCalorieBadge();
}

// --- תג קלוריות עדין במסך הבית, ליד כפתור "סדר היום" - כבוי כברירת מחדל
// (לא כפוי על כולן, זה יכול להיות לא נעים למי שרגישה למספרי קלוריות
// קבועים מול העיניים - לפי שיקול מפורש "או שזה אכזרי?"), מי שרוצה מדליקה
// בהגדרות ומקבלת מספר קטן שמתעדכן בזמן אמת. לוחצים עליו כדי לקפוץ ישר
// למסך התזונה, לא רק תצוגה ---
function isHomeCalorieBadgeOn() { return localStorage.getItem('weekwise_home_calorie_badge') === 'true'; }
function toggleHomeCalorieBadge() {
    const enabled = document.getElementById('home-calorie-badge-toggle').checked;
    localStorage.setItem('weekwise_home_calorie_badge', String(enabled));
    updateHomeCalorieBadge();
}
function updateHomeCalorieBadge() {
    const badge = document.getElementById('home-calorie-badge');
    if (!badge) return;
    const enabled = isHomeCalorieBadgeOn();
    badge.classList.toggle('hidden', !enabled);
    if (!enabled) return;
    document.getElementById('home-calorie-badge-value').textContent = todayCaloriesTotal;
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
        // מאפסים גם את סימון ה"נגעו בשורה" הישן - הוא שייך לתאריך/טעינה
        // הקודמים, לא לתאריך שנטען עכשיו (ר' ה-listener ב-DOMContentLoaded
        // וה-guard ב-saveNutrition)
        delete row.dataset.touched;
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
async function saveNutrition() {
    const date = document.getElementById('selected-date').value;
    const mealRows = document.querySelectorAll('.meal-row');
    for (let row of mealRows) {
        const type = row.getAttribute('data-meal');
        const food = row.querySelector('.food-input').value;
        const cals = parseInt(row.querySelector('.calories-input').value) || 0;
        const protein = parseFloat(row.querySelector('.protein-input').value) || null;
        const { data: existing } = await supabaseClient.from('calorie_tracker').select('id').eq('user_id', currentUserId).eq('date', date).eq('meal_type', type).maybeSingle();
        // הגנה קריטית: אם השורה נראית ריקה בדף אבל *לא נגעו בה בכלל* בסשן
        // הזה (data-touched, ר' ה-listener ב-DOMContentLoaded), אין לדרוס
        // איתה נתון קיים במסד - זה כמעט תמיד סימן שהשורה פשוט לא נטענה
        // (למשל נוספה דרך ההוספה המהירה בזמן שהמסך הזה לא היה פתוח), לא
        // שהמשתמשת התכוונה למחוק אותה. דיווח אמיתי: נתונים שנוספו קודם
        // באותו יום נעלמו אחרי לחיצה על "שמור" בגלל בדיוק זה
        const isEmpty = !food.trim() && !cals;
        if (existing) {
            if (isEmpty) {
                // אם באמת נגעו בשורה (לא סתם נראית ריקה כי לא נטענה) וריקנו
                // אותה בכוונה - מוחקים את הרשומה לגמרי, לא משאירים "גדם" עם
                // 0 קלוריות. דיווח אמיתי: דוח ה-PDF הראה ימים עם "0" מוזר -
                // אלה היו בדיוק שורות-גדם כאלה שנשמרו ריקות במקום להימחק
                if (row.dataset.touched === 'true') await supabaseClient.from('calorie_tracker').delete().eq('id', existing.id);
                continue;
            }
            await supabaseClient.from('calorie_tracker').update({ food_description: food, calories: cals, protein_grams: protein }).eq('id', existing.id);
        } else if (!isEmpty) {
            await supabaseClient.from('calorie_tracker').insert({ username: currentUsername, user_id: currentUserId, date: date, meal_type: type, food_description: food, calories: cals, protein_grams: protein });
        }
    }
    await loadDailyNutrition(date);
    loadStats();
    loadCalorieMonthlyCalendar();
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

    // ממוצע-יומי לצד הסה"כ - לפי בקשה מפורשת ("יותר טוב לדעת אם אפשר לרדת
    // או לעלות"). מחושב רק על הימים שבאמת נרשם בהם משהו (לא חלקי 7/חלקי כל
    // ימי החודש) - יום שלא נרשם בו כלום פשוט לא נכנס למכנה, אותה עקרון
    // בדיוק כמו הסה"כ עצמו
    let weekly = 0, monthly = 0;
    const weekDates = new Set(), monthDates = new Set();
    data.forEach(item => {
        const cals = Number(item.calories) || 0;
        if (item.date >= weekStartStr && item.date <= weekEndStr) { weekly += cals; weekDates.add(item.date); }
        if (item.date && item.date.startsWith(monthPrefix)) { monthly += cals; monthDates.add(item.date); }
    });
    document.getElementById('calories-weekly').innerText = weekly;
    document.getElementById('calories-monthly').innerText = monthly;
    const weeklyAvgEl = document.getElementById('calories-weekly-avg');
    if (weeklyAvgEl) weeklyAvgEl.innerText = weekDates.size > 0 ? t('calorie_stat_avg_label').replace('{amount}', Math.round(weekly / weekDates.size)) : '';
    const monthlyAvgEl = document.getElementById('calories-monthly-avg');
    if (monthlyAvgEl) monthlyAvgEl.innerText = monthDates.size > 0 ? t('calorie_stat_avg_label').replace('{amount}', Math.round(monthly / monthDates.size)) : '';
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
        li.className = 'habit-item' + (doneToday ? ' habit-done' : '');
        const checkBtn = document.createElement('button');
        checkBtn.type = 'button';
        checkBtn.className = 'btn-complete-item' + (doneToday ? ' checked' : '');
        checkBtn.textContent = doneToday ? '✓' : '';
        checkBtn.onclick = () => toggleHabitCheckin(habit.id, todayStr, !doneToday);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'center-list-item-text';
        nameSpan.textContent = habit.name;
        const streakBadge = document.createElement('span');
        streakBadge.className = 'habit-streak-badge' + (streak > 0 ? ' habit-streak-active' : '');
        streakBadge.textContent = streak > 0 ? `🔥 ${streak}` : '–';
        // כפתור היסטוריה: לוח חודשי לכל הרגל בנפרד, ר' openHabitHistoryModal -
        // בלי זה אין שום דרך לראות מה כבר סומן בעבר, רק את הרצף הנוכחי
        const historyBtn = document.createElement('button');
        historyBtn.type = 'button';
        historyBtn.className = 'btn-habit-history';
        historyBtn.title = t('habit_history_btn_title');
        historyBtn.textContent = '📅';
        historyBtn.onclick = () => openHabitHistoryModal(habit.id, habit.name);
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'btn-delete-item';
        deleteBtn.textContent = '❌';
        deleteBtn.onclick = () => deleteHabit(habit.id);

        li.appendChild(checkBtn);
        li.appendChild(nameSpan);
        li.appendChild(streakBadge);
        li.appendChild(historyBtn);
        li.appendChild(deleteBtn);
        list.appendChild(li);
    });
}

// --- היסטוריית הרגל: לוח חודשי עם הדגשה על כל יום שסומן + סטטיסטיקות
// (רצף נוכחי/הכי ארוך אי-פעם/סה"כ ימים) - נשלף ישירות מ-habit_checkins בכל
// פתיחה (לא ממטמון loadHabits), כדי שתמיד יהיה עדכני. אותם רכיבי CSS/HTML
// בדיוק כמו הלוח החודשי הכללי (monthly-calendar-grid), לעקביות חזותית ---
let viewedHabitHistory = null;

async function openHabitHistoryModal(habitId, habitName) {
    viewedHabitHistory = { habitId, monthKey: currentMonthKey() };
    document.getElementById('habit-history-title').textContent = habitName;
    openModal('modal-habit-history');
    await renderHabitHistory();
}

async function navigateHabitHistory(delta) {
    if (!viewedHabitHistory) return;
    viewedHabitHistory.monthKey = shiftMonthKey(viewedHabitHistory.monthKey, delta);
    await renderHabitHistory();
}

// הרצף ההיסטורי הכי ארוך אי-פעם (לא רק הנוכחי, ר' computeHabitStreak) - סורק
// את כל התאריכים הידועים ומוצא את אורך הרצף הרציף הארוך ביותר ביניהם
function computeLongestHabitStreak(dateSet) {
    if (!dateSet.size) return 0;
    const sortedDates = Array.from(dateSet).sort();
    let longest = 1, current = 1;
    for (let i = 1; i < sortedDates.length; i++) {
        const diffDays = Math.round((new Date(`${sortedDates[i]}T00:00:00`) - new Date(`${sortedDates[i - 1]}T00:00:00`)) / 86400000);
        current = diffDays === 1 ? current + 1 : 1;
        longest = Math.max(longest, current);
    }
    return longest;
}

async function renderHabitHistory() {
    if (!viewedHabitHistory || !supabaseClient) return;
    const { habitId, monthKey } = viewedHabitHistory;
    const label = document.getElementById('habit-history-month-label');
    const grid = document.getElementById('habit-history-grid');
    if (!label || !grid) return;
    label.textContent = formatMonthLabel(monthKey);

    const { data: allCheckins } = await supabaseClient.from('habit_checkins').select('checkin_date').eq('user_id', currentUserId).eq('habit_id', habitId);
    const dateSet = new Set((allCheckins || []).map(c => c.checkin_date));
    const todayStr = getLocalDateString();

    document.getElementById('habit-history-stat-current').textContent = computeHabitStreak(dateSet, todayStr);
    document.getElementById('habit-history-stat-best').textContent = computeLongestHabitStreak(dateSet);
    document.getElementById('habit-history-stat-total').textContent = dateSet.size;

    const [y, m] = monthKey.split('-').map(Number);
    const firstDate = new Date(y, m - 1, 1);
    const lastDate = new Date(y, m, 0);
    const startWeekday = firstDate.getDay();
    const daysInMonth = lastDate.getDate();

    let html = '';
    for (let i = 0; i < startWeekday; i++) html += `<div class="monthly-calendar-cell empty"></div>`;
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isDone = dateSet.has(dateStr);
        html += `<div class="monthly-calendar-cell${dateStr === todayStr ? ' today' : ''}${isDone ? ' habit-history-done' : ''}">
            <span class="monthly-calendar-day-num">${day}</span>
            ${isDone ? '<span class="monthly-calendar-dot"></span>' : ''}
        </div>`;
    }
    grid.innerHTML = html;
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

// --- "לוח היום" (🧭): טאבים מותאמים-אישית (routine_tabs, ברירת מחדל 2 -
// "שגרה יומית"/"לימודים", ניתנות לשינוי שם/מחיקה/הוספה) שכל אחד מציג שורות-שעה
// קבועות (getDailyBoardCustomHours - ברירת מחדל DAILY_BOARD_DEFAULT_HOURS,
// אבל ניתנות להוספה/הסרה חופשית מהגדרות > התאמה ויומן, ר' toggleDailyBoardHour
// למטה - לפי בקשה מפורשת "לסדר את השעות, למחוק ולהוסיף"), מקובצות לפי בלוק
// (בוקר/צהריים/אחה"צ/ערב). כל שורה קיימת תמיד (גם ריקה, לחיצה עליה פותחת
// הוספה) - זו שגרה שחוזרת על עצמה בדיוק אותו הדבר כל יום, בלי בחירת ימים
// (הוסרה לפי בקשה מפורשת: "כל הקטע של הלו״ז היומי שזה שגרה שחוזרת על
// עצמה"). עוגן ויזואלי נפרד לגמרי מהלו"ז הרגיל (weekly_schedule/
// calendar_events) - לא נשלף משם, לפי בקשה מפורשת ---
let dailyBoardTabs = [];
let activeDailyBoardTabId = null;
let editingRoutineItemId = null;
let pendingRoutineItemTime = null;

// טווח-השעות הטבעי שכל בלוק מציע לבחירה בהגדרות (לא כל 24 השעות בכל בלוק -
// זה היה הופך לרשימה ארוכה ובלתי-שימושית) - השעות שמחוץ לטווח הזה (00:00-
// 04:00) פשוט לא רלוונטיות ל"סדר יום" ולכן לא מוצעות כלל
const DAILY_BOARD_BUCKET_RANGES = {
    morning: [5, 6, 7, 8, 9, 10, 11],
    noon: [12, 13, 14, 15],
    afternoon: [16, 17, 18, 19],
    evening: [20, 21, 22, 23],
};
const DAILY_BOARD_DEFAULT_HOURS = {
    morning: [7, 8, 10, 11],
    noon: [12, 14, 15],
    afternoon: [16, 17, 19],
    evening: [20, 21, 22],
};

// לכל טאב יש שעות בלוקים משלו (לא גלובלי לכל הטאבים) - לפי בקשה מפורשת
// ("כל פעם שמוסיפים טאב יהיה אפשר לשחק עם השעות ולשנות לכל טאב שונה")
// קריטי להחזיר עותק טרי בכל קריאה (לא רפרנס משותף ל-DAILY_BOARD_DEFAULT_HOURS
// הקבוע) - toggleDailyBoardHour עושה hours[bucket] = list על מה שמוחזר כאן
// ישירות; אם היה מוחזר הרפרנס המשותף עצמו, מוטציה כזו הייתה משנה את הקבוע
// הגלובלי לצמיתות עבור *כל* הטאבים שעדיין אין להם התאמה אישית משלהם - בדיוק
// הבאג שדווח ("הוספתי שעה בלימודים וזה התווסף גם לשגרה היומית"), שאומת דרך
// הקונסול: שני הטאבים הראו את אותה שעה מותאמת, כשלטאב שלא נגעו בו כלל לא
// הייתה בכלל רשומת localStorage משלו - סימן שהוא פשוט ירש את הקבוע המזוהם
function getDailyBoardCustomHours(tabId) {
    const raw = tabId ? localStorage.getItem(`weekwise_board_hours_${currentUserId}_${tabId}`) : null;
    if (!raw) return { morning: [...DAILY_BOARD_DEFAULT_HOURS.morning], noon: [...DAILY_BOARD_DEFAULT_HOURS.noon], afternoon: [...DAILY_BOARD_DEFAULT_HOURS.afternoon], evening: [...DAILY_BOARD_DEFAULT_HOURS.evening] };
    try {
        const parsed = JSON.parse(raw);
        return {
            morning: Array.isArray(parsed.morning) ? parsed.morning : [...DAILY_BOARD_DEFAULT_HOURS.morning],
            noon: Array.isArray(parsed.noon) ? parsed.noon : [...DAILY_BOARD_DEFAULT_HOURS.noon],
            afternoon: Array.isArray(parsed.afternoon) ? parsed.afternoon : [...DAILY_BOARD_DEFAULT_HOURS.afternoon],
            evening: Array.isArray(parsed.evening) ? parsed.evening : [...DAILY_BOARD_DEFAULT_HOURS.evening],
        };
    } catch (e) { return { morning: [...DAILY_BOARD_DEFAULT_HOURS.morning], noon: [...DAILY_BOARD_DEFAULT_HOURS.noon], afternoon: [...DAILY_BOARD_DEFAULT_HOURS.afternoon], evening: [...DAILY_BOARD_DEFAULT_HOURS.evening] };
    }
}

function toggleDailyBoardHour(bucket, hour) {
    if (!activeDailyBoardTabId) return;
    const hours = getDailyBoardCustomHours(activeDailyBoardTabId);
    const list = (hours[bucket] || []).slice();
    const idx = list.indexOf(hour);
    if (idx === -1) list.push(hour); else list.splice(idx, 1);
    list.sort((a, b) => a - b);
    hours[bucket] = list;
    localStorage.setItem(`weekwise_board_hours_${currentUserId}_${activeDailyBoardTabId}`, JSON.stringify(hours));
    renderDailyBoardHourSettings();
    renderDailyBoard();
}

// פאנל השעות פתוח/סגור בתוך מודל "סדר היום" עצמו (לא בהגדרות הכלליות -
// שם לא היה ברור לאיזה טאב הן מתייחסות), ליד כפתור הוספת הטאב
function toggleDailyBoardHoursPanel() {
    const panel = document.getElementById('daily-board-hours-panel');
    if (!panel) return;
    const willShow = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !willShow);
    if (willShow) renderDailyBoardHourSettings();
}

function renderDailyBoardHourSettings() {
    const panel = document.getElementById('daily-board-hours-panel');
    if (!panel || panel.classList.contains('hidden')) return;
    const hours = getDailyBoardCustomHours(activeDailyBoardTabId);
    Object.keys(DAILY_BOARD_BUCKET_RANGES).forEach(bucket => {
        const wrap = document.getElementById(`board-hours-${bucket}`);
        if (!wrap) return;
        wrap.innerHTML = '';
        DAILY_BOARD_BUCKET_RANGES[bucket].forEach(hour => {
            const active = (hours[bucket] || []).includes(hour);
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'board-hour-chip' + (active ? ' active' : '');
            chip.textContent = `${String(hour).padStart(2, '0')}:00`;
            chip.onclick = () => toggleDailyBoardHour(bucket, hour);
            wrap.appendChild(chip);
        });
    });
}

async function openDailyBoardModal() {
    if (!supabaseClient || !currentUserId) return;
    const hoursPanel = document.getElementById('daily-board-hours-panel');
    if (hoursPanel) hoursPanel.classList.add('hidden');
    openModal('modal-daily-board');
    await loadRoutineTabs();
}

async function loadRoutineTabs() {
    const { data } = await supabaseClient.from('routine_tabs').select('*').eq('user_id', currentUserId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    dailyBoardTabs = data || [];
    if (!dailyBoardTabs.length) {
        const seeded = [
            { user_id: currentUserId, username: currentUsername, name: t('daily_board_default_tab_daily'), sort_order: 0 },
            { user_id: currentUserId, username: currentUsername, name: t('daily_board_default_tab_study'), sort_order: 1 },
        ];
        const { data: inserted } = await supabaseClient.from('routine_tabs').insert(seeded).select('*');
        dailyBoardTabs = inserted || [];
    }
    if (!activeDailyBoardTabId || !dailyBoardTabs.some(tb => tb.id === activeDailyBoardTabId)) {
        activeDailyBoardTabId = dailyBoardTabs[0] ? dailyBoardTabs[0].id : null;
    }
    renderRoutineTabsBar();
    await renderDailyBoard();
}

function renderRoutineTabsBar() {
    const wrap = document.getElementById('daily-board-tabs-list');
    if (!wrap) return;
    wrap.innerHTML = '';
    dailyBoardTabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'daily-board-tab-pill' + (tab.id === activeDailyBoardTabId ? ' active' : '');
        btn.textContent = tab.name;
        btn.onclick = () => switchRoutineTab(tab.id);
        wrap.appendChild(btn);
    });
    const deleteBtn = document.getElementById('daily-board-delete-tab-btn');
    if (deleteBtn) deleteBtn.classList.toggle('hidden', dailyBoardTabs.length <= 1);
}

// לחיצה על טאב שכבר פעיל פותחת שינוי-שם (במקום כפתור "✏️ שינוי שם" נפרד
// שהוסר) - לפי בקשה מפורשת "שלוחצים על השגרה היומית תהיה אפשרות לשנות
// את השם". לחיצה על טאב לא-פעיל ממשיכה להחליף טאב כרגיל
async function switchRoutineTab(tabId) {
    if (tabId === activeDailyBoardTabId) {
        openRenameRoutineTabModal(tabId);
        return;
    }
    activeDailyBoardTabId = tabId;
    renderRoutineTabsBar();
    renderDailyBoardHourSettings();
    await renderDailyBoard();
}

// מודל מעוצב במקום prompt()/window.prompt הנייטיבי של הדפדפן (הראה "האתר
// ... אומר" מכוער ולא תואם את עיצוב האפליקציה) - לפי בקשה מפורשת. אותו
// מודל לשני המצבים (הוספה/שינוי שם), routineTabNameMode קובע מה saveRoutineTabName עושה
let routineTabNameMode = 'add';
function openAddRoutineTabPrompt() {
    routineTabNameMode = 'add';
    document.getElementById('routine-tab-name-modal-title').textContent = t('daily_board_add_tab_title');
    document.getElementById('routine-tab-name-input').value = '';
    openModal('modal-routine-tab-name');
}

function openRenameRoutineTabModal(tabId) {
    const tab = dailyBoardTabs.find(tb => tb.id === tabId);
    if (!tab) return;
    routineTabNameMode = 'rename';
    document.getElementById('routine-tab-name-modal-title').textContent = t('daily_board_rename_tab_btn');
    document.getElementById('routine-tab-name-input').value = tab.name;
    openModal('modal-routine-tab-name');
}

async function saveRoutineTabName() {
    const name = document.getElementById('routine-tab-name-input').value.trim();
    if (!name) return;
    closeModal('modal-routine-tab-name');
    if (routineTabNameMode === 'add') {
        await addRoutineTab(name);
    } else {
        await renameRoutineTab(activeDailyBoardTabId, name);
    }
}

async function addRoutineTab(name) {
    const sortOrder = dailyBoardTabs.length;
    const { data } = await supabaseClient.from('routine_tabs').insert({ user_id: currentUserId, username: currentUsername, name, sort_order: sortOrder }).select('*').single();
    if (data) {
        dailyBoardTabs.push(data);
        activeDailyBoardTabId = data.id;
        renderRoutineTabsBar();
        renderDailyBoardHourSettings();
        await renderDailyBoard();
    }
}

async function renameRoutineTab(tabId, name) {
    await supabaseClient.from('routine_tabs').update({ name }).eq('id', tabId);
    const tab = dailyBoardTabs.find(tb => tb.id === tabId);
    if (tab) tab.name = name;
    renderRoutineTabsBar();
}

function showDangerConfirm(titleText, messageText, onConfirm) {
    document.getElementById('danger-confirm-title').textContent = titleText;
    document.getElementById('danger-confirm-message').textContent = messageText;
    const btn = document.getElementById('btn-danger-confirm-proceed');
    const freshBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(freshBtn, btn);
    freshBtn.addEventListener('click', () => { closeModal('modal-danger-confirm'); onConfirm(); });
    openModal('modal-danger-confirm');
}

// --- לוח החזון (Vision Board) - מגירה שנייה מהצד (אותה תבנית בדיוק כמו
// hamburger-drawer-overlay) עם כרטיסי-יעד שמתהפכים (CSS 3D flip) לרשימת
// תחנות-ביניים. אחוז ההתקדמות *נגזר* ממספר התחנות שסומנו כבוצעו (done/total),
// לא ערך נפרד שנשמר - כדי שלא יהיה מקור-אמת כפול שיכול לסטות מרשימת התחנות ---
const VISION_GOAL_CATEGORY_PRESETS = [
    { key: 'career', icon: '💼' },
    { key: 'health', icon: '💪' },
    { key: 'finance', icon: '💰' },
    { key: 'relationships', icon: '❤️' },
    { key: 'learning', icon: '📚' },
    { key: 'travel', icon: '✈️' },
    { key: 'personal', icon: '🌱' },
    { key: 'other', icon: '🎯' },
];

let visionGoalsCache = [];
let visionMilestonesCache = [];

function openGoalsVisionDrawer() {
    const overlay = document.getElementById('vision-drawer-overlay');
    if (overlay) overlay.classList.add('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.add('vision-open');
    loadVisionGoals();
}
function closeGoalsVisionDrawer() {
    const overlay = document.getElementById('vision-drawer-overlay');
    if (overlay) overlay.classList.remove('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.remove('vision-open');
}

// --- "לימודים" - יומן שיעורי בית עצמאי, מגירה שלישית מהצד (אותה תבנית
// בדיוק כמו openGoalsVisionDrawer/closeGoalsVisionDrawer) - טבלה נפרדת
// (study_tasks) ולא my_center_tasks, כי כאן אין צבעים/"להגיע לזה"/גרירה -
// רק כותרת + וי, לפי בקשה מפורשת ("משהו נפרד וחדש לגמרי") ---
let studyTasksCache = [];
let editingStudyItemId = null;

function openStudyDrawer() {
    const overlay = document.getElementById('study-drawer-overlay');
    if (overlay) overlay.classList.add('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.add('study-open');
    loadStudyTasks();
}
function closeStudyDrawer() {
    const overlay = document.getElementById('study-drawer-overlay');
    if (overlay) overlay.classList.remove('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.remove('study-open');
}

async function loadStudyTasks() {
    if (!supabaseClient || !currentUserId) return;
    const { data, error } = await supabaseClient.from('study_tasks').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
    if (error) return;
    studyTasksCache = data || [];
    renderStudyTasksList();
}

// לחיצה על הטקסט (לא הצ'קבוקס/עריכה/מחיקה) מרחיבה את השורה במקום, במקום
// חיתוך בשלוש נקודות - "hover" לא רלוונטי באפליקציית מובייל, לפי בקשה מפורשת
function toggleStudyItemExpand(el) {
    const row = el.closest('.study-task-item');
    if (row) row.classList.toggle('expanded');
}

function renderStudyTasksList() {
    const listEl = document.getElementById('study-tasks-list');
    const emptyEl = document.getElementById('study-tasks-empty');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.toggle('hidden', studyTasksCache.length > 0);
    studyTasksCache.forEach(item => {
        const li = document.createElement('li');
        li.className = 'study-task-item';
        li.innerHTML = `
            <button type="button" class="btn-complete-item${item.is_completed ? ' checked' : ''}" onclick="toggleStudyTaskStatus('${item.id}', ${item.is_completed})">${item.is_completed ? '✓' : ''}</button>
            <span class="center-list-item-text${item.is_completed ? ' completed' : ''}" onclick="toggleStudyItemExpand(this)">${escapeHtmlForReport(item.title)}</span>
            <button type="button" class="btn-edit-item" onclick="openEditStudyItemModal('${item.id}')">${EDIT_ICON_SVG}</button>
            <button type="button" class="btn-delete-item" onclick="deleteStudyTask('${item.id}')">❌</button>
        `;
        listEl.appendChild(li);
    });
}

// אם יש תחנת-ביניים מקושרת ("קישור אופציונלי ללוח החזון"), מסמנים אותה
// באותה פעולה, ואז בודקים אם זה משלים את כל היעד - לפי בקשה מפורשת
async function toggleStudyTaskStatus(id, currentStatus) {
    if (!supabaseClient) return;
    const newStatus = !currentStatus;
    await supabaseClient.from('study_tasks').update({ is_completed: newStatus }).eq('id', id);
    const item = studyTasksCache.find(x => x.id === id);
    if (item && item.linked_milestone_id) {
        const { data: milestoneRow } = await supabaseClient.from('vision_goal_milestones').update({ is_done: newStatus }).eq('id', item.linked_milestone_id).select('goal_id').maybeSingle();
        if (milestoneRow) await checkAndMarkGoalAchieved(milestoneRow.goal_id);
    }
    loadStudyTasks();
}

// בונה את אפשרויות בורר "קישור לתחנת-ביניים" מ-visionMilestonesCache - רק
// תחנות שעוד לא בוצעו (אין טעם לקשר למשהו שכבר מסומן). אם המגירה של לוח
// החזון עוד לא נפתחה בסשן הזה, ה-cache ריק - טוענים אותו כאן במפורש כדי
// שהבורר לא יהיה ריק סתם
// שני שלבים - קודם בוחרים יעד, ואז רק התחנות של אותו יעד - לא רשימה שטוחה
// אחת עם כל התחנות מכל היעדים מעורבבות יחד, לפי בקשה מפורשת ("אם יהיו כמה
// חזונים... שתבדוק קודם על איזה חזון מדובר")
async function renderStudyMilestoneOptions(selectedMilestoneId) {
    if (!visionGoalsCache.length && !visionMilestonesCache.length) await loadVisionGoals();
    let selectedGoalId = '';
    if (selectedMilestoneId) {
        const m = visionMilestonesCache.find(x => x.id === selectedMilestoneId);
        if (m) selectedGoalId = m.goal_id;
    }
    renderStudyGoalOptions(selectedGoalId);
    renderStudyMilestoneOptionsForGoal(selectedGoalId, selectedMilestoneId);
}

function renderStudyGoalOptions(selectedGoalId) {
    const select = document.getElementById('study-item-goal');
    if (!select) return;
    select.innerHTML = `<option value="" data-i18n="study_milestone_none_option">${t('study_milestone_none_option')}</option>`;
    // רק יעדים עם לפחות תחנה אחת שעוד לא בוצעה - אין טעם להציע יעד שאין לו
    // אליו מה לקשר (או שכבר הושג לגמרי)
    visionGoalsCache.filter(g => visionMilestonesCache.some(m => m.goal_id === g.id && !m.is_done)).forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.id;
        opt.textContent = g.title;
        select.appendChild(opt);
    });
    select.value = selectedGoalId || '';
    updateCustomSelectDisplay('study-item-goal');
}

function renderStudyMilestoneOptionsForGoal(goalId, selectedMilestoneId) {
    const select = document.getElementById('study-item-milestone');
    const trigger = document.getElementById('study-item-milestone-trigger');
    if (!select) return;
    select.innerHTML = `<option value="" data-i18n="study_milestone_none_option">${t('study_milestone_none_option')}</option>`;
    if (goalId) {
        visionMilestonesCache.filter(m => m.goal_id === goalId && !m.is_done).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = m.title;
            select.appendChild(opt);
        });
    }
    select.value = selectedMilestoneId || '';
    updateCustomSelectDisplay('study-item-milestone');
    if (trigger) trigger.classList.toggle('hidden', !goalId);
}

async function openAddStudyItemModal() {
    editingStudyItemId = null;
    document.getElementById('study-item-modal-title').textContent = t('study_add_item_title');
    document.getElementById('study-item-input').value = '';
    await renderStudyMilestoneOptions(null);
    openModal('modal-add-study-item');
    setTimeout(() => document.getElementById('study-item-input').focus(), 150);
}

async function openEditStudyItemModal(id) {
    const item = studyTasksCache.find(x => x.id === id);
    if (!item) return;
    editingStudyItemId = id;
    document.getElementById('study-item-modal-title').textContent = t('edit_item_title');
    document.getElementById('study-item-input').value = item.title;
    await renderStudyMilestoneOptions(item.linked_milestone_id);
    openModal('modal-add-study-item');
    setTimeout(() => document.getElementById('study-item-input').focus(), 150);
}

async function submitStudyItem() {
    const input = document.getElementById('study-item-input');
    const title = input.value.trim();
    const milestoneSelect = document.getElementById('study-item-milestone');
    const linkedMilestoneId = milestoneSelect && milestoneSelect.value ? milestoneSelect.value : null;
    const editId = editingStudyItemId;
    closeModal('modal-add-study-item');
    editingStudyItemId = null;
    if (!title || !supabaseClient || !currentUserId) return;
    if (editId) {
        await supabaseClient.from('study_tasks').update({ title, linked_milestone_id: linkedMilestoneId }).eq('id', editId);
    } else {
        await supabaseClient.from('study_tasks').insert({ user_id: currentUserId, username: currentUsername, title, linked_milestone_id: linkedMilestoneId });
    }
    await loadStudyTasks();
    showAppToast(t('item_added_success'));
}

async function deleteStudyTask(id) {
    if (!supabaseClient) return;
    await supabaseClient.from('study_tasks').delete().eq('id', id);
    loadStudyTasks();
}

// --- "הפרויקטים שלי" - תכונה נפרדת ועוצמתית יותר מ"לימודים" (פרויקטים >
// מחברות > שורות, כל מחברת נראית בדיוק כמו לימודים), נגישה רק דרך כפתור
// בתחתית מגירת לימודים - לפי בקשה מפורשת ("אני רוצה שהלימודים עצמם ישארו
// ככה"). פרימיום בלבד, אותו דפוס נעילה בדיוק כמו openSmartSplitModal ---
let projectsCache = [];
let notebooksCache = [];
let notebookItemsCache = [];
let currentOpenProjectId = null;
let currentOpenNotebookId = null;
let editingProjectId = null;
let editingNotebookId = null;
let editingNotebookItemId = null;

// אייקון לכל פרויקט - כדי להבחין במבט חטוף בין פרויקטים (למשל "מתמטיקה" מול
// "היסטוריה" אצל ילד/ה) - לפי בקשה מפורשת. דפוס זהה ל-VISION_GOAL_CATEGORY_PRESETS/
// selectVisionGoalCategory, רק שכאן האמוג'י עצמו הוא גם המזהה וגם התצוגה
const PROJECT_ICON_PRESETS = ['📁', '📚', '💼', '🎨', '🔬', '🏋️', '🎵', '💻', '🌱', '⚽', '🧮', '🌍'];
let selectedProjectIcon = '📁';

function renderProjectIconPicker() {
    const container = document.getElementById('project-icon-picker');
    if (!container) return;
    container.innerHTML = '';
    PROJECT_ICON_PRESETS.forEach(icon => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'icon-picker-chip' + (selectedProjectIcon === icon ? ' selected' : '');
        chip.textContent = icon;
        chip.onclick = () => selectProjectIcon(icon);
        container.appendChild(chip);
    });
}
function selectProjectIcon(icon) {
    selectedProjectIcon = icon;
    renderProjectIconPicker();
}

function openMyProjectsEntry() {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    closeStudyDrawer();
    openProjectsDrawer();
}

// --- מגירה 1: רשימת פרויקטים ---
function openProjectsDrawer() {
    const overlay = document.getElementById('projects-drawer-overlay');
    if (overlay) overlay.classList.add('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.add('projects-open');
    loadProjects();
}
function closeProjectsDrawer() {
    const overlay = document.getElementById('projects-drawer-overlay');
    if (overlay) overlay.classList.remove('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.remove('projects-open');
}

async function loadProjects() {
    if (!supabaseClient || !currentUserId) return;
    const { data, error } = await supabaseClient.from('projects').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
    if (error) return;
    projectsCache = data || [];
    renderProjectsList();
}

function renderProjectsList() {
    const listEl = document.getElementById('projects-list');
    const emptyEl = document.getElementById('projects-empty');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.toggle('hidden', projectsCache.length > 0);
    projectsCache.forEach(project => {
        const li = document.createElement('li');
        li.className = 'project-card';
        li.innerHTML = `
            <span class="project-card-main" onclick="openProjectDetail('${project.id}')">${project.icon || '📁'} ${escapeHtmlForReport(project.title)}</span>
            <span class="project-card-actions">
                <button type="button" class="btn-edit-item" onclick="openEditProjectModal('${project.id}')">${EDIT_ICON_SVG}</button>
                <button type="button" class="btn-delete-item" onclick="deleteProject('${project.id}')">❌</button>
            </span>
        `;
        listEl.appendChild(li);
    });
}

function openAddProjectModal() {
    editingProjectId = null;
    document.getElementById('project-modal-title').textContent = t('projects_add_item_title');
    document.getElementById('project-item-input').value = '';
    selectedProjectIcon = PROJECT_ICON_PRESETS[0];
    renderProjectIconPicker();
    openModal('modal-add-project');
    setTimeout(() => document.getElementById('project-item-input').focus(), 150);
}

function openEditProjectModal(id) {
    const project = projectsCache.find(p => p.id === id);
    if (!project) return;
    editingProjectId = id;
    document.getElementById('project-modal-title').textContent = t('edit_item_title');
    document.getElementById('project-item-input').value = project.title;
    selectedProjectIcon = project.icon || PROJECT_ICON_PRESETS[0];
    renderProjectIconPicker();
    openModal('modal-add-project');
}

async function submitProject() {
    const input = document.getElementById('project-item-input');
    const title = input.value.trim();
    const icon = selectedProjectIcon;
    const editId = editingProjectId;
    closeModal('modal-add-project');
    editingProjectId = null;
    if (!title || !supabaseClient || !currentUserId) return;
    if (editId) {
        await supabaseClient.from('projects').update({ title, icon }).eq('id', editId);
    } else {
        await supabaseClient.from('projects').insert({ user_id: currentUserId, username: currentUsername, title, icon });
    }
    await loadProjects();
    showAppToast(t('item_added_success'));
}

function deleteProject(id) {
    showDangerConfirm(t('project_delete_title'), t('project_delete_confirm'), async () => {
        await supabaseClient.from('projects').delete().eq('id', id);
        loadProjects();
    });
}

// --- מגירה 2: מחברות בתוך פרויקט אחד (currentOpenProjectId) ---
function openProjectDetail(projectId) {
    currentOpenProjectId = projectId;
    closeProjectsDrawer();
    openNotebooksDrawer();
}

function openNotebooksDrawer() {
    const overlay = document.getElementById('notebooks-drawer-overlay');
    if (overlay) overlay.classList.add('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.add('projects-open');
    const project = projectsCache.find(p => p.id === currentOpenProjectId);
    const titleEl = document.getElementById('notebooks-drawer-title');
    if (titleEl) titleEl.textContent = project ? `${project.icon || '📁'} ${project.title}` : '';
    loadProjectNotebooks(currentOpenProjectId);
}
function closeNotebooksDrawer() {
    const overlay = document.getElementById('notebooks-drawer-overlay');
    if (overlay) overlay.classList.remove('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.remove('projects-open');
}

async function loadProjectNotebooks(projectId) {
    if (!supabaseClient || !currentUserId || !projectId) return;
    const { data, error } = await supabaseClient.from('project_notebooks').select('*').eq('project_id', projectId).eq('user_id', currentUserId).order('created_at', { ascending: false });
    if (error) return;
    notebooksCache = data || [];
    renderNotebooksList();
}

function renderNotebooksList() {
    const listEl = document.getElementById('notebooks-list');
    const emptyEl = document.getElementById('notebooks-empty');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.toggle('hidden', notebooksCache.length > 0);
    notebooksCache.forEach(notebook => {
        const li = document.createElement('li');
        li.className = 'notebook-card';
        li.innerHTML = `
            <span class="notebook-card-main" onclick="openNotebookDetail('${notebook.id}')">📓 ${escapeHtmlForReport(notebook.title)}</span>
            <span class="notebook-card-actions">
                <button type="button" class="btn-edit-item" onclick="openEditNotebookModal('${notebook.id}')">${EDIT_ICON_SVG}</button>
                <button type="button" class="btn-delete-item" onclick="deleteNotebook('${notebook.id}')">❌</button>
            </span>
        `;
        listEl.appendChild(li);
    });
}

function openAddNotebookModal() {
    editingNotebookId = null;
    document.getElementById('notebook-modal-title').textContent = t('notebooks_add_item_title');
    document.getElementById('notebook-item-input').value = '';
    openModal('modal-add-notebook');
    setTimeout(() => document.getElementById('notebook-item-input').focus(), 150);
}

function openEditNotebookModal(id) {
    const notebook = notebooksCache.find(n => n.id === id);
    if (!notebook) return;
    editingNotebookId = id;
    document.getElementById('notebook-modal-title').textContent = t('edit_item_title');
    document.getElementById('notebook-item-input').value = notebook.title;
    openModal('modal-add-notebook');
}

async function submitNotebook() {
    const input = document.getElementById('notebook-item-input');
    const title = input.value.trim();
    const editId = editingNotebookId;
    closeModal('modal-add-notebook');
    editingNotebookId = null;
    if (!title || !supabaseClient || !currentUserId || !currentOpenProjectId) return;
    if (editId) {
        await supabaseClient.from('project_notebooks').update({ title }).eq('id', editId);
    } else {
        await supabaseClient.from('project_notebooks').insert({ project_id: currentOpenProjectId, user_id: currentUserId, username: currentUsername, title });
    }
    await loadProjectNotebooks(currentOpenProjectId);
    showAppToast(t('item_added_success'));
}

function deleteNotebook(id) {
    showDangerConfirm(t('notebook_delete_title'), t('notebook_delete_confirm'), async () => {
        await supabaseClient.from('project_notebooks').delete().eq('id', id);
        loadProjectNotebooks(currentOpenProjectId);
    });
}

// --- מגירה 3: דף-מחברת בפועל (currentOpenNotebookId) - זהה חזותית ללימודים,
// ר' renderStudyTasksList - אותה תבנית בדיוק (checkbox/טקסט/עריכה/מחיקה) ---
function openNotebookDetail(notebookId) {
    currentOpenNotebookId = notebookId;
    closeNotebooksDrawer();
    openNotebookDetailDrawer();
}

function openNotebookDetailDrawer() {
    const overlay = document.getElementById('notebook-detail-drawer-overlay');
    if (overlay) overlay.classList.add('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.add('projects-open');
    const notebook = notebooksCache.find(n => n.id === currentOpenNotebookId);
    const titleEl = document.getElementById('notebook-detail-title');
    if (titleEl) titleEl.textContent = notebook ? notebook.title : '';
    loadNotebookItems(currentOpenNotebookId);
}
function closeNotebookDetailDrawer() {
    const overlay = document.getElementById('notebook-detail-drawer-overlay');
    if (overlay) overlay.classList.remove('open');
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.remove('projects-open');
}

async function loadNotebookItems(notebookId) {
    if (!supabaseClient || !currentUserId || !notebookId) return;
    const { data, error } = await supabaseClient.from('notebook_items').select('*').eq('notebook_id', notebookId).eq('user_id', currentUserId).order('created_at', { ascending: false });
    if (error) return;
    notebookItemsCache = data || [];
    renderNotebookItemsList();
}

function renderNotebookItemsList() {
    const listEl = document.getElementById('notebook-items-list');
    const emptyEl = document.getElementById('notebook-items-empty');
    if (!listEl) return;
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.toggle('hidden', notebookItemsCache.length > 0);
    notebookItemsCache.forEach(item => {
        const li = document.createElement('li');
        li.className = 'study-task-item';
        li.innerHTML = `
            <button type="button" class="btn-complete-item${item.is_completed ? ' checked' : ''}" onclick="toggleNotebookItemStatus('${item.id}', ${item.is_completed})">${item.is_completed ? '✓' : ''}</button>
            <span class="center-list-item-text${item.is_completed ? ' completed' : ''}" onclick="toggleStudyItemExpand(this)">${escapeHtmlForReport(item.title)}</span>
            <button type="button" class="btn-edit-item" onclick="openEditNotebookItemModal('${item.id}')">${EDIT_ICON_SVG}</button>
            <button type="button" class="btn-delete-item" onclick="deleteNotebookItem('${item.id}')">❌</button>
        `;
        listEl.appendChild(li);
    });
}

async function toggleNotebookItemStatus(id, currentStatus) {
    if (!supabaseClient) return;
    await supabaseClient.from('notebook_items').update({ is_completed: !currentStatus }).eq('id', id);
    loadNotebookItems(currentOpenNotebookId);
}

function openAddNotebookItemModal() {
    editingNotebookItemId = null;
    document.getElementById('notebook-item-modal-title').textContent = t('notebook_item_add_title');
    document.getElementById('notebook-item-text-input').value = '';
    openModal('modal-add-notebook-item');
    setTimeout(() => document.getElementById('notebook-item-text-input').focus(), 150);
}

function openEditNotebookItemModal(id) {
    const item = notebookItemsCache.find(x => x.id === id);
    if (!item) return;
    editingNotebookItemId = id;
    document.getElementById('notebook-item-modal-title').textContent = t('edit_item_title');
    document.getElementById('notebook-item-text-input').value = item.title;
    openModal('modal-add-notebook-item');
}

async function submitNotebookItem() {
    const input = document.getElementById('notebook-item-text-input');
    const title = input.value.trim();
    const editId = editingNotebookItemId;
    closeModal('modal-add-notebook-item');
    editingNotebookItemId = null;
    if (!title || !supabaseClient || !currentUserId || !currentOpenNotebookId) return;
    if (editId) {
        await supabaseClient.from('notebook_items').update({ title }).eq('id', editId);
    } else {
        await supabaseClient.from('notebook_items').insert({ notebook_id: currentOpenNotebookId, user_id: currentUserId, username: currentUsername, title });
    }
    await loadNotebookItems(currentOpenNotebookId);
    showAppToast(t('item_added_success'));
}

async function deleteNotebookItem(id) {
    if (!supabaseClient) return;
    await supabaseClient.from('notebook_items').delete().eq('id', id);
    loadNotebookItems(currentOpenNotebookId);
}

async function loadVisionGoals() {
    if (!supabaseClient || !currentUserId) return;
    const [goalsRes, milestonesRes] = await Promise.all([
        supabaseClient.from('vision_goals').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true }),
        supabaseClient.from('vision_goal_milestones').select('*').eq('user_id', currentUserId).order('sort_order', { ascending: true }),
    ]);
    visionGoalsCache = goalsRes.data || [];
    visionMilestonesCache = milestonesRes.data || [];
    renderVisionGoalsList();
}

function renderVisionGoalsList() {
    const list = document.getElementById('vision-goals-list');
    const empty = document.getElementById('vision-goals-empty');
    const achievedSection = document.getElementById('vision-goals-achieved-section');
    const achievedList = document.getElementById('vision-goals-achieved-list');
    if (!list) return;
    list.innerHTML = '';
    if (achievedList) achievedList.innerHTML = '';

    const activeGoals = visionGoalsCache.filter(g => !g.is_achieved);
    // ההישג האחרון קודם (לא סדר-יצירה מקורי) - לפי בקשה מפורשת ("כל חזון
    // חדש יהיה בשורה למעלה"), כך שהטרופיאה הכי טרייה תמיד הכי בולטת
    const achievedGoals = visionGoalsCache.filter(g => g.is_achieved).sort((a, b) => new Date(b.achieved_at) - new Date(a.achieved_at));

    if (!activeGoals.length) {
        if (empty) empty.classList.remove('hidden');
    } else {
        if (empty) empty.classList.add('hidden');
        activeGoals.forEach(goal => {
            const milestones = visionMilestonesCache.filter(m => m.goal_id === goal.id);
            list.appendChild(renderVisionGoalCard(goal, milestones));
        });
    }

    // "יעדים שכבשתי" - קבועים כאן לצמיתות, לא נעלמים אוטומטית לעולם (ר' ההערה
    // ב-index.html) - הסקשן עצמו מוצג רק כשיש לפחות הישג אחד
    if (achievedSection) achievedSection.classList.toggle('hidden', achievedGoals.length === 0);
    if (achievedList) {
        achievedGoals.forEach(goal => {
            const milestones = visionMilestonesCache.filter(m => m.goal_id === goal.id);
            achievedList.appendChild(renderVisionGoalCard(goal, milestones));
        });
    }
}

// שורת תחנת-ביניים בודדת (גב הכרטיס) - פונקציה משותפת לבנייה הראשונית ולהוספה
// חיה מגב הכרטיס (addMilestoneToGoalFromCardBack), כדי לא לשכפל את אותה
// לוגיקה פעמיים. נבנה ב-createElement+closures (לא onclick="..." עם טקסט
// המשתמשת משורשר) כדי שכותרות עם גרש/מירכאות לא ישברו את ה-HTML
function buildVisionMilestoneRow(goalId, goalTitle, milestone) {
    const row = document.createElement('div');
    row.className = 'vision-milestone-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = !!milestone.is_done;

    const span = document.createElement('span');
    span.textContent = milestone.title;
    if (milestone.is_done) span.classList.add('completed');

    checkbox.onchange = () => {
        span.classList.toggle('completed', checkbox.checked);
        toggleVisionMilestoneDone(milestone.id, goalId, checkbox.checked);
    };

    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'vision-milestone-add-today-btn';
    addBtn.title = t('vision_milestone_add_today_btn_title');
    addBtn.textContent = '➕';
    addBtn.onclick = () => addMilestoneTaskToToday(goalTitle, milestone.title);

    row.appendChild(checkbox);
    row.appendChild(span);
    row.appendChild(addBtn);
    return row;
}

function renderVisionGoalCard(goal, milestones) {
    const total = milestones.length;
    const done = milestones.filter(m => m.is_done).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    const card = document.createElement('div');
    card.className = 'vision-goal-card';
    card.dataset.goalId = goal.id;

    const inner = document.createElement('div');
    inner.className = 'vision-card-inner';

    const front = document.createElement('div');
    front.className = 'vision-card-face vision-card-front';
    const imgUrl = goal.image_url || '';
    front.style.backgroundImage = imgUrl
        ? `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.75) 100%), url("${imgUrl.replace(/"/g, '%22')}")`
        : 'linear-gradient(160deg, rgba(168,85,247,0.35), rgba(0,0,0,0.6))';
    front.onclick = () => flipVisionCard(goal.id);

    const categoryPreset = VISION_GOAL_CATEGORY_PRESETS.find(c => c.key === goal.category);
    if (categoryPreset) {
        const tag = document.createElement('div');
        tag.className = 'vision-card-category-tag';
        tag.textContent = `${categoryPreset.icon} ${t('vision_goal_category_' + categoryPreset.key)}`;
        front.appendChild(tag);
    }
    // גביע נוצץ-וזוהר על יעדים שהושגו - לפי בקשה מפורשת ("שיתגאו אנשים במה
    // שעשו")
    if (goal.is_achieved) {
        const trophy = document.createElement('div');
        trophy.className = 'vision-card-trophy-badge';
        trophy.title = t('vision_goal_achieved_badge_title');
        trophy.textContent = '🏆';
        front.appendChild(trophy);
    }
    const nameEl = document.createElement('div');
    nameEl.className = 'vision-card-front-name';
    nameEl.textContent = goal.title;
    front.appendChild(nameEl);

    const progressRow = document.createElement('div');
    progressRow.className = 'vision-card-progress-row';
    progressRow.innerHTML = `<div class="progress-bar-bg"><div class="progress-bar-fill${pct >= 100 ? ' completed' : ''}" style="width:${pct}%"></div></div><span class="vision-card-progress-pct">${pct}%</span>`;
    front.appendChild(progressRow);

    const back = document.createElement('div');
    back.className = 'vision-card-face vision-card-back';

    const backHeader = document.createElement('div');
    backHeader.className = 'vision-card-back-header';
    const backTitle = document.createElement('h4');
    backTitle.className = 'vision-card-back-title';
    backTitle.textContent = goal.title;
    const flipBackBtn = document.createElement('button');
    flipBackBtn.type = 'button';
    flipBackBtn.className = 'vision-card-flip-back-btn';
    flipBackBtn.title = t('vision_card_flip_back_btn_title');
    flipBackBtn.textContent = '↩';
    flipBackBtn.onclick = () => flipVisionCard(goal.id);
    backHeader.appendChild(backTitle);
    backHeader.appendChild(flipBackBtn);
    back.appendChild(backHeader);

    if (!milestones.length) {
        const hint = document.createElement('p');
        hint.className = 'vision-card-no-milestones';
        hint.textContent = t('vision_goal_no_milestones_hint');
        back.appendChild(hint);
    } else {
        milestones.forEach(m => back.appendChild(buildVisionMilestoneRow(goal.id, goal.title, m)));
    }

    const addRow = document.createElement('div');
    addRow.className = 'vision-card-back-add-row';
    const addInput = document.createElement('input');
    addInput.type = 'text';
    addInput.placeholder = t('vision_goal_milestone_input_placeholder');
    const addRowBtn = document.createElement('button');
    addRowBtn.type = 'button';
    addRowBtn.className = 'btn-secondary';
    addRowBtn.textContent = t('vision_goal_milestone_add_btn');
    addRowBtn.onclick = () => addMilestoneToGoalFromCardBack(goal.id, addInput);
    addInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addMilestoneToGoalFromCardBack(goal.id, addInput); } };
    addRow.appendChild(addInput);
    addRow.appendChild(addRowBtn);
    back.appendChild(addRow);

    const backActions = document.createElement('div');
    backActions.className = 'vision-card-back-actions';
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn-edit-item';
    editBtn.innerHTML = EDIT_ICON_SVG;
    editBtn.title = t('edit_btn');
    editBtn.onclick = () => openVisionGoalModal(goal.id);
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn-delete-item';
    deleteBtn.textContent = '❌';
    deleteBtn.onclick = () => deleteVisionGoal(goal.id);
    backActions.appendChild(editBtn);
    backActions.appendChild(deleteBtn);
    back.appendChild(backActions);

    inner.appendChild(front);
    inner.appendChild(back);
    card.appendChild(inner);
    return card;
}

function flipVisionCard(goalId) {
    const card = document.querySelector(`.vision-goal-card[data-goal-id="${goalId}"]`);
    if (card) card.classList.toggle('flipped');
}

function updateVisionCardProgressDisplay(goalId) {
    const card = document.querySelector(`.vision-goal-card[data-goal-id="${goalId}"]`);
    if (!card) return;
    const milestones = visionMilestonesCache.filter(m => m.goal_id === goalId);
    const total = milestones.length;
    const done = milestones.filter(m => m.is_done).length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    const fill = card.querySelector('.progress-bar-fill');
    if (fill) { fill.style.width = pct + '%'; fill.classList.toggle('completed', pct >= 100); }
    const pctLabel = card.querySelector('.vision-card-progress-pct');
    if (pctLabel) pctLabel.textContent = pct + '%';
}

async function toggleVisionMilestoneDone(milestoneId, goalId, checked) {
    if (!supabaseClient || !currentUserId) return;
    await supabaseClient.from('vision_goal_milestones').update({ is_done: checked }).eq('id', milestoneId);
    const m = visionMilestonesCache.find(x => x.id === milestoneId);
    if (m) m.is_done = checked;
    updateVisionCardProgressDisplay(goalId);
    await checkAndMarkGoalAchieved(goalId);
}

// כשכל התחנות של יעד מסומנות בוצע, היעד עצמו מסומן "הושג" לצמיתות - לא
// מתאפס אוטומטית אם תחנה מבוטלת אחר כך (לפי בקשה מפורשת, "תמיד שם"). נקראת
// גם מ-toggleVisionMilestoneDone (סימון ישיר בלוח החזון) וגם מ-
// toggleStudyTaskStatus (סימון משימת "לימודים" מקושרת) - שני נתיבים שונים
// לאותה תוצאה, אז הבדיקה מרוכזת כאן במקום אחד
async function checkAndMarkGoalAchieved(goalId) {
    if (!supabaseClient || !goalId) return;
    const { data: milestones } = await supabaseClient.from('vision_goal_milestones').select('is_done').eq('goal_id', goalId);
    if (!milestones || !milestones.length) return;
    if (!milestones.every(m => m.is_done)) return;
    const { data: goal } = await supabaseClient.from('vision_goals').select('is_achieved').eq('id', goalId).maybeSingle();
    if (!goal || goal.is_achieved) return;
    await supabaseClient.from('vision_goals').update({ is_achieved: true, achieved_at: new Date().toISOString() }).eq('id', goalId);
    const cached = visionGoalsCache.find(g => g.id === goalId);
    if (cached) cached.is_achieved = true;
    renderVisionGoalsList();
    showAppToast(t('vision_goal_achieved_toast'));
}

// מזריקה תחנת-ביניים בודדת ליומן כאירוע חד-פעמי להיום - בדיוק כמו "מבט
// ליומן" רגיל (source:'calendar', לא daily board/לו"ז שבועי), לפי בקשה
// מפורשת של המשתמשת. שם היעד מוצג כקידומת לתחנה כדי שברשימה שטוחה (מבט
// ליומן) יהיה ברור מתוך איזה יעד זה הגיע, בלי לפתוח את המגירה
async function addMilestoneTaskToToday(goalTitle, milestoneTitle) {
    if (!supabaseClient || !currentUserId) return;
    const { error } = await supabaseClient.from('calendar_events').insert({
        username: currentUsername, user_id: currentUserId,
        event_title: `🎯 ${goalTitle}: ${milestoneTitle}`,
        event_date: getLocalDateString(),
        source: 'calendar', recurrence_group_id: null,
    });
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    showAppToast(t('item_added_success'));
    loadTodayTasks();
    loadCalendarEvents();
    loadMonthlyCalendarGrid();
}

async function addMilestoneToGoalFromCardBack(goalId, inputEl) {
    const title = inputEl.value.trim();
    if (!title || !supabaseClient || !currentUserId) return;
    const existing = visionMilestonesCache.filter(m => m.goal_id === goalId);
    const maxOrder = existing.reduce((max, m) => Math.max(max, m.sort_order || 0), 0);
    const goal = visionGoalsCache.find(g => g.id === goalId);
    const { data, error } = await supabaseClient.from('vision_goal_milestones')
        .insert({ goal_id: goalId, user_id: currentUserId, title, is_done: false, sort_order: maxOrder + 10 })
        .select().single();
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    visionMilestonesCache.push(data);
    inputEl.value = '';
    const card = document.querySelector(`.vision-goal-card[data-goal-id="${goalId}"]`);
    if (card) {
        const back = card.querySelector('.vision-card-back');
        const noMilestonesHint = back.querySelector('.vision-card-no-milestones');
        if (noMilestonesHint) noMilestonesHint.remove();
        const addRow = back.querySelector('.vision-card-back-add-row');
        back.insertBefore(buildVisionMilestoneRow(goalId, goal ? goal.title : '', data), addRow);
    }
    updateVisionCardProgressDisplay(goalId);
}

// --- הוספה/עריכה של יעד: מודל רגיל (apple-modal), עם רשימת תחנות-ביניים
// שנבנית בזיכרון (pendingVisionMilestones) ונשמרת כולה בלחיצה על "שמירה".
// במצב עריכה שומרים גם את ה-id וה-is_done של כל תחנה קיימת (לא רק הטקסט),
// כדי שסימוני "בוצע" לא יימחקו סתם כי המשתמשת רק שינתה את שם היעד ---
let editingVisionGoalId = null;
let pendingVisionMilestones = [];
let originalVisionMilestoneIds = [];
let selectedVisionGoalCategory = null;

function openVisionGoalModal(goalId = null) {
    editingVisionGoalId = goalId;
    const titleEl = document.getElementById('vision-goal-modal-title');
    const deleteBtn = document.getElementById('btn-delete-vision-goal');
    if (goalId) {
        const goal = visionGoalsCache.find(g => g.id === goalId);
        if (!goal) return;
        if (titleEl) titleEl.textContent = t('vision_goal_modal_title_edit');
        document.getElementById('vision-goal-title-input').value = goal.title || '';
        selectedVisionGoalCategory = goal.category || null;
        setVisionGoalImagePreview(goal.image_url || '');
        const existing = visionMilestonesCache.filter(m => m.goal_id === goalId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        pendingVisionMilestones = existing.map(m => ({ id: m.id, title: m.title, is_done: m.is_done }));
        originalVisionMilestoneIds = existing.map(m => m.id);
        if (deleteBtn) deleteBtn.classList.remove('hidden');
    } else {
        if (titleEl) titleEl.textContent = t('vision_goal_modal_title_add');
        document.getElementById('vision-goal-title-input').value = '';
        selectedVisionGoalCategory = null;
        setVisionGoalImagePreview('');
        pendingVisionMilestones = [];
        originalVisionMilestoneIds = [];
        if (deleteBtn) deleteBtn.classList.add('hidden');
    }
    renderVisionGoalCategoryChips();
    renderPendingVisionMilestones();
    openModal('modal-add-vision-goal');
}

function resetVisionGoalModal() {
    editingVisionGoalId = null;
    pendingVisionMilestones = [];
    originalVisionMilestoneIds = [];
    selectedVisionGoalCategory = null;
    document.getElementById('vision-goal-title-input').value = '';
    document.getElementById('vision-goal-milestone-input').value = '';
    setVisionGoalImagePreview('');
}

function renderVisionGoalCategoryChips() {
    const container = document.getElementById('vision-goal-category-chips');
    if (!container) return;
    container.innerHTML = '';
    VISION_GOAL_CATEGORY_PRESETS.forEach(preset => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'vision-goal-category-chip' + (selectedVisionGoalCategory === preset.key ? ' selected' : '');
        chip.textContent = `${preset.icon} ${t('vision_goal_category_' + preset.key)}`;
        chip.onclick = () => selectVisionGoalCategory(preset.key);
        container.appendChild(chip);
    });
}
function selectVisionGoalCategory(key) {
    selectedVisionGoalCategory = selectedVisionGoalCategory === key ? null : key;
    renderVisionGoalCategoryChips();
}

// מעלה את קובץ תמונת-החזון עצמה ל-Supabase Storage (bucket "goal-vision-photos") -
// אותו דפוס בדיוק כמו uploadRecipeImage, נכשלת בשקט (מחזירה null) אם ה-
// bucket עדיין לא קיים - זו תוספת אופציונלית, לא חוסמת יצירת יעד בלי תמונה
async function handleVisionGoalImageSelected(event) {
    const input = event.target;
    const file = input.files && input.files[0];
    input.value = '';
    if (!file) return;
    const url = await uploadVisionGoalImage(file);
    if (url) setVisionGoalImagePreview(url);
}

async function uploadVisionGoalImage(file) {
    if (!supabaseClient || !currentUserId || !file.type.startsWith('image/')) return null;
    try {
        const ext = (file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'jpg';
        const path = `${currentUserId}/${Date.now()}.${ext}`;
        const { error } = await supabaseClient.storage.from('goal-vision-photos').upload(path, file, { upsert: false, contentType: file.type });
        if (error) return null;
        const { data } = supabaseClient.storage.from('goal-vision-photos').getPublicUrl(path);
        return data ? data.publicUrl : null;
    } catch {
        return null;
    }
}

function setVisionGoalImagePreview(url) {
    const input = document.getElementById('vision-goal-image-url-input');
    const preview = document.getElementById('vision-goal-image-preview');
    if (input) input.value = url || '';
    if (preview) {
        if (url) { preview.src = url; preview.classList.remove('hidden'); }
        else { preview.src = ''; preview.classList.add('hidden'); }
    }
}

function addPendingVisionMilestoneRow() {
    const input = document.getElementById('vision-goal-milestone-input');
    const title = input.value.trim();
    if (!title) return;
    pendingVisionMilestones.push({ id: null, title, is_done: false });
    input.value = '';
    renderPendingVisionMilestones();
}
function removePendingVisionMilestoneRow(index) {
    pendingVisionMilestones.splice(index, 1);
    renderPendingVisionMilestones();
}
function renderPendingVisionMilestones() {
    const list = document.getElementById('vision-goal-pending-milestones-list');
    if (!list) return;
    list.innerHTML = '';
    pendingVisionMilestones.forEach((m, index) => {
        const row = document.createElement('div');
        row.className = 'vision-goal-pending-milestone-row';
        const span = document.createElement('span');
        span.textContent = m.title;
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'vision-goal-pending-milestone-remove';
        removeBtn.title = t('vision_goal_milestone_remove_title');
        removeBtn.textContent = '✕';
        removeBtn.onclick = () => removePendingVisionMilestoneRow(index);
        row.appendChild(span);
        row.appendChild(removeBtn);
        list.appendChild(row);
    });
}

async function saveVisionGoal() {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const title = document.getElementById('vision-goal-title-input').value.trim();
    if (!title) { showAppToast(t('calendar_event_missing_fields'), 'error'); return; }
    const imageUrl = document.getElementById('vision-goal-image-url-input').value || null;
    const payload = { title, category: selectedVisionGoalCategory, image_url: imageUrl };

    let goalId = editingVisionGoalId;
    if (goalId) {
        const { error } = await supabaseClient.from('vision_goals').update(payload).eq('id', goalId);
        if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
        const keptIds = pendingVisionMilestones.filter(m => m.id).map(m => m.id);
        const toDelete = originalVisionMilestoneIds.filter(id => !keptIds.includes(id));
        if (toDelete.length) await supabaseClient.from('vision_goal_milestones').delete().in('id', toDelete);
        for (let i = 0; i < pendingVisionMilestones.length; i++) {
            const m = pendingVisionMilestones[i];
            if (m.id) {
                await supabaseClient.from('vision_goal_milestones').update({ title: m.title, sort_order: (i + 1) * 10 }).eq('id', m.id);
            } else {
                await supabaseClient.from('vision_goal_milestones').insert({ goal_id: goalId, user_id: currentUserId, title: m.title, is_done: false, sort_order: (i + 1) * 10 });
            }
        }
    } else {
        const { data, error } = await supabaseClient.from('vision_goals').insert({ ...payload, user_id: currentUserId }).select().single();
        if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
        goalId = data.id;
        if (pendingVisionMilestones.length) {
            const rows = pendingVisionMilestones.map((m, i) => ({ goal_id: goalId, user_id: currentUserId, title: m.title, is_done: false, sort_order: (i + 1) * 10 }));
            await supabaseClient.from('vision_goal_milestones').insert(rows);
        }
    }
    closeModal('modal-add-vision-goal');
    resetVisionGoalModal();
    showAppToast(t('item_added_success'));
    loadVisionGoals();
}

function deleteVisionGoal(goalId) {
    showDangerConfirm(t('vision_goal_delete_title'), t('vision_goal_delete_confirm'), async () => {
        await supabaseClient.from('vision_goals').delete().eq('id', goalId);
        loadVisionGoals();
    });
}


async function deleteActiveRoutineTab() {
    if (dailyBoardTabs.length <= 1) return;
    const tabId = activeDailyBoardTabId;
    showDangerConfirm(t('daily_board_delete_tab_title'), t('daily_board_delete_tab_confirm'), async () => {
        await supabaseClient.from('routine_tabs').delete().eq('id', tabId);
        dailyBoardTabs = dailyBoardTabs.filter(tb => tb.id !== tabId);
        activeDailyBoardTabId = dailyBoardTabs[0] ? dailyBoardTabs[0].id : null;
        renderRoutineTabsBar();
        await renderDailyBoard();
    });
}

async function renderDailyBoard() {
    const body = document.getElementById('daily-board-body');
    if (!body) return;
    if (!activeDailyBoardTabId) { body.innerHTML = ''; return; }
    const { data: items } = await supabaseClient.from('routine_items').select('*').eq('tab_id', activeDailyBoardTabId).eq('user_id', currentUserId);
    const itemsByTime = {};
    (items || []).forEach(it => { itemsByTime[(it.time || '').slice(0, 5)] = it; });
    const bucketOrder = ['morning', 'noon', 'afternoon', 'evening'];
    const bucketLabelKeys = { morning: 'daily_board_bucket_morning', noon: 'daily_board_bucket_noon', afternoon: 'daily_board_bucket_afternoon', evening: 'daily_board_bucket_evening' };
    const customHours = getDailyBoardCustomHours(activeDailyBoardTabId);
    body.innerHTML = '';
    bucketOrder.forEach(key => {
        const bucketHours = customHours[key] || [];
        if (!bucketHours.length) return;
        const section = document.createElement('div');
        section.className = `daily-board-bucket-section daily-board-bucket-${key}`;
        const header = document.createElement('div');
        header.className = 'daily-board-bucket-header';
        header.textContent = t(bucketLabelKeys[key]);
        section.appendChild(header);
        bucketHours.forEach(hour => {
            const timeStr = `${String(hour).padStart(2, '0')}:00`;
            const item = itemsByTime[timeStr];
            const row = document.createElement('div');
            row.className = 'daily-board-item-row' + (item ? '' : ' daily-board-item-row-empty');
            const timeSpan = document.createElement('span');
            timeSpan.className = 'daily-board-item-time';
            timeSpan.textContent = timeStr;
            const titleBtn = document.createElement('button');
            titleBtn.type = 'button';
            titleBtn.className = 'daily-board-item-title';
            titleBtn.textContent = item ? item.title : t('daily_board_item_add_placeholder');
            titleBtn.onclick = () => item ? openEditRoutineItemModal(item) : openAddRoutineItemModal(timeStr);
            row.appendChild(timeSpan);
            row.appendChild(titleBtn);
            section.appendChild(row);
        });
        body.appendChild(section);
    });
}

function openAddRoutineItemModal(time) {
    if (!activeDailyBoardTabId) return;
    editingRoutineItemId = null;
    pendingRoutineItemTime = time;
    document.getElementById('routine-item-modal-title').textContent = t('daily_board_add_item_title');
    document.getElementById('routine-item-time-label').textContent = time;
    document.getElementById('routine-item-title-input').value = '';
    document.getElementById('routine-item-delete-btn').classList.add('hidden');
    openModal('modal-add-routine-item');
}

function openEditRoutineItemModal(item) {
    editingRoutineItemId = item.id;
    pendingRoutineItemTime = (item.time || '').slice(0, 5);
    document.getElementById('routine-item-modal-title').textContent = t('daily_board_edit_item_title');
    document.getElementById('routine-item-time-label').textContent = pendingRoutineItemTime;
    document.getElementById('routine-item-title-input').value = item.title;
    document.getElementById('routine-item-delete-btn').classList.remove('hidden');
    openModal('modal-add-routine-item');
}

async function saveRoutineItem() {
    const title = document.getElementById('routine-item-title-input').value.trim();
    if (!title) { showAppToast(t('daily_board_item_missing_fields'), 'error'); return; }
    const payload = { title, time: pendingRoutineItemTime };
    if (editingRoutineItemId) {
        await supabaseClient.from('routine_items').update(payload).eq('id', editingRoutineItemId);
    } else {
        await supabaseClient.from('routine_items').insert({ ...payload, tab_id: activeDailyBoardTabId, user_id: currentUserId });
    }
    closeModal('modal-add-routine-item');
    await renderDailyBoard();
}

async function deleteRoutineItemFromModal() {
    if (!editingRoutineItemId) return;
    await supabaseClient.from('routine_items').delete().eq('id', editingRoutineItemId);
    closeModal('modal-add-routine-item');
    await renderDailyBoard();
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

    const ok = await insertCenterItemDirect(quickNoteDestination, text, null, null, null, true);
    if (!ok) return;
    showAppToast(t(quickNoteDestination === 'general' ? 'notes_ai_added_shopping' : 'notes_ai_added'));
    input.value = '';
    closeModal('modal-ai-quick-add');
}
