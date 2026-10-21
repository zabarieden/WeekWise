// נבנה אוטומטית מ-i18n.js (build-i18n.pl) - לא לערוך כאן
// --- מנוע תרגום ורב-לשוניות: מילון + לוגיקת RTL/LTR דינמית ---
// סדר אלפביתי לפי שם השפה באנגלית (Arabic, Bengali, Catalan...) - כדי שרשימת
// בורר השפה תוצג לפי סדר א"ב יציב, ולא לפי סדר ההוספה ההיסטורי של כל שפה
const SUPPORTED_LANGUAGES = ['ar', 'bn', 'ca', 'zh', 'cs', 'da', 'nl', 'en', 'fi', 'fr', 'de', 'el', 'he', 'hi', 'hu', 'id', 'it', 'ja', 'ko', 'nb', 'pl', 'pt', 'ro', 'ru', 'es', 'sw', 'sv', 'th', 'tr', 'uk', 'ur', 'vi', 'yo'];
const RTL_LANGUAGES = ['he', 'ar', 'ur'];
const LANGUAGE_NAMES = { en: 'English', he: 'עברית', es: 'Español', fr: 'Français', ar: 'العربية', ru: 'Русский', de: 'Deutsch', pt: 'Português', ja: '日本語', zh: '中文', hi: 'हिन्दी', ko: '한국어', tr: 'Türkçe', id: 'Bahasa Indonesia', it: 'Italiano', vi: 'Tiếng Việt', pl: 'Polski', th: 'ไทย', ur: 'اردو', bn: 'বাংলা', sw: 'Kiswahili', uk: 'Українська', el: 'Ελληνικά', nl: 'Nederlands', ca: 'Català', ro: 'Română', yo: 'Yorùbá', sv: 'Svenska', nb: 'Norsk', da: 'Dansk', cs: 'Čeština', hu: 'Magyar', fi: 'Suomi' };
// דגלים לבורר השפה החדש (חיפוש) - מפה נפרדת מ-LANGUAGE_NAMES כדי שהוספת שפה
// עתידית תדרוש רק שורה אחת נוספת כאן ובתרגומים, לא שינוי מבני
const LANGUAGE_FLAGS = { en: '🇺🇸', he: '🇮🇱', es: '🇪🇸', fr: '🇫🇷', ar: '🇸🇦', ru: '🇷🇺', de: '🇩🇪', pt: '🇧🇷', ja: '🇯🇵', zh: '🇨🇳', hi: '🇮🇳', ko: '🇰🇷', tr: '🇹🇷', id: '🇮🇩', it: '🇮🇹', vi: '🇻🇳', pl: '🇵🇱', th: '🇹🇭', ur: '🇵🇰', bn: '🇧🇩', sw: '🇰🇪', uk: '🇺🇦', el: '🇬🇷', nl: '🇳🇱', ca: '🇪🇸', ro: '🇷🇴', yo: '🇳🇬', sv: '🇸🇪', nb: '🇳🇴', da: '🇩🇰', cs: '🇨🇿', hu: '🇭🇺', fi: '🇫🇮' };

// בורר-חיפוש המדינה (openCountryPicker ב-app.js) - אותו רעיון בדיוק כמו
// LANGUAGE_NAMES/LANGUAGE_FLAGS למעלה. שמות המדינות נשארים באנגלית בכל שפת
// ממשק (לא מתורגמים) - כמו LANGUAGE_NAMES עצמו, כדי לא להוסיף עוד עשרות
// מפתחות תרגום פר-שפה רק בשביל שם מדינה בבורר. הרשימה כוללת כמה מדינות
// עיקריות לכל שפה נתמכת (לא רק אחת) - למשל אנגלית: ארה"ב/בריטניה/קנדה/
// אוסטרליה/אירלנד/ניו זילנד/דרום אפריקה, ספרדית: ספרד/מקסיקו/ארגנטינה/
// קולומביה/צ'ילה/פרו וכו' - לפי בקשה מפורשת. il/us ראשונות (ברירת המחדל
// הוותיקה), השאר לפי סדר א"ב של השם האנגלי
const COUNTRY_LIST = ['il', 'us', 'ar', 'au', 'at', 'bd', 'by', 'be', 'br', 'ca', 'cl', 'cn', 'co', 'cy', 'cz', 'dk', 'eg', 'fi', 'fr', 'de', 'gr', 'hk', 'hu', 'in', 'id', 'ie', 'it', 'jp', 'jo', 'kz', 'ke', 'mx', 'ma', 'nl', 'nz', 'ng', 'no', 'pk', 'pe', 'pl', 'pt', 'ro', 'ru', 'sa', 'sg', 'za', 'kr', 'es', 'se', 'ch', 'tw', 'tz', 'th', 'tr', 'ae', 'ua', 'gb', 'vn'];
const COUNTRY_NAMES = { il: 'Israel', us: 'United States', ar: 'Argentina', au: 'Australia', at: 'Austria', bd: 'Bangladesh', by: 'Belarus', be: 'Belgium', br: 'Brazil', ca: 'Canada', cl: 'Chile', cn: 'China', co: 'Colombia', cy: 'Cyprus', cz: 'Czechia', dk: 'Denmark', eg: 'Egypt', fi: 'Finland', fr: 'France', de: 'Germany', gr: 'Greece', hk: 'Hong Kong', hu: 'Hungary', in: 'India', id: 'Indonesia', ie: 'Ireland', it: 'Italy', jp: 'Japan', jo: 'Jordan', kz: 'Kazakhstan', ke: 'Kenya', mx: 'Mexico', ma: 'Morocco', nl: 'Netherlands', nz: 'New Zealand', ng: 'Nigeria', no: 'Norway', pk: 'Pakistan', pe: 'Peru', pl: 'Poland', pt: 'Portugal', ro: 'Romania', ru: 'Russia', sa: 'Saudi Arabia', sg: 'Singapore', za: 'South Africa', kr: 'South Korea', es: 'Spain', se: 'Sweden', ch: 'Switzerland', tw: 'Taiwan', tz: 'Tanzania', th: 'Thailand', tr: 'Turkey', ae: 'United Arab Emirates', ua: 'Ukraine', gb: 'United Kingdom', vn: 'Vietnam' };
const COUNTRY_FLAGS = { il: '🇮🇱', us: '🇺🇸', ar: '🇦🇷', au: '🇦🇺', at: '🇦🇹', bd: '🇧🇩', by: '🇧🇾', be: '🇧🇪', br: '🇧🇷', ca: '🇨🇦', cl: '🇨🇱', cn: '🇨🇳', co: '🇨🇴', cy: '🇨🇾', cz: '🇨🇿', dk: '🇩🇰', eg: '🇪🇬', fi: '🇫🇮', fr: '🇫🇷', de: '🇩🇪', gr: '🇬🇷', hk: '🇭🇰', hu: '🇭🇺', in: '🇮🇳', id: '🇮🇩', ie: '🇮🇪', it: '🇮🇹', jp: '🇯🇵', jo: '🇯🇴', kz: '🇰🇿', ke: '🇰🇪', mx: '🇲🇽', ma: '🇲🇦', nl: '🇳🇱', nz: '🇳🇿', ng: '🇳🇬', no: '🇳🇴', pk: '🇵🇰', pe: '🇵🇪', pl: '🇵🇱', pt: '🇵🇹', ro: '🇷🇴', ru: '🇷🇺', sa: '🇸🇦', sg: '🇸🇬', za: '🇿🇦', kr: '🇰🇷', es: '🇪🇸', se: '🇸🇪', ch: '🇨🇭', tw: '🇹🇼', tz: '🇹🇿', th: '🇹🇭', tr: '🇹🇷', ae: '🇦🇪', ua: '🇺🇦', gb: '🇬🇧', vn: '🇻🇳' };

let currentLang = 'en';

function isRTL(lang) { return RTL_LANGUAGES.includes(lang); }

// כל שפה בקובץ משלה (2026-10-21, "שיעבוד חלק גם בחיבור איטי"): הקובץ הזה הוא המקור, וממנו נבנים i18n/core.js
// (המנוע) ו-i18n/<lang>.js (שפה אחת). האפליקציה טוענת רק את השפה שבשימוש; שפה אחרת נטענת כשעוברים אליה
const i18nFiles = {};
function i18nLoad(lang) {
    if (translations[lang]) return Promise.resolve(true);
    if (!SUPPORTED_LANGUAGES.includes(lang) || typeof document === 'undefined') return Promise.resolve(false);
    if (!i18nFiles[lang]) {
        i18nFiles[lang] = new Promise(resolve => {
            const s = document.createElement('script');
            s.src = `i18n/${lang}.js?v=${typeof I18N_V !== 'undefined' ? I18N_V : '0'}`;
            s.onload = () => resolve(!!translations[lang]);
            s.onerror = () => { delete i18nFiles[lang]; resolve(false); };
            document.head.appendChild(s);
        });
    }
    return i18nFiles[lang];
}
// ערך של מפתח בכל השפות (לזיהוי מילים שנכתבו בשפה אחרת) - גם כשרק שפה אחת טעונה (I18N_CROSS ב-i18n/core.js)
function i18nAllValues(key) {
    if (typeof I18N_CROSS !== 'undefined' && I18N_CROSS[key]) return Object.values(I18N_CROSS[key]);
    return Object.keys(translations).map(l => translations[l] && translations[l][key]).filter(Boolean);
}
// הכותרות המוכנות של "מה חשוב היום" בכל השפות (כותרת → מפתח), נטען רק כשצריך (i18n/focus.js)
let i18nFocusPromise = null;
function i18nFocusIndex() {
    if (typeof I18N_FOCUS !== 'undefined') return Promise.resolve(I18N_FOCUS);
    if (typeof document === 'undefined' || typeof I18N_V === 'undefined') return Promise.resolve(null);
    if (!i18nFocusPromise) {
        i18nFocusPromise = new Promise(resolve => {
            const s = document.createElement('script');
            s.src = `i18n/focus.js?v=${I18N_V}`;
            s.onload = () => resolve(typeof I18N_FOCUS !== 'undefined' ? I18N_FOCUS : null);
            s.onerror = () => { i18nFocusPromise = null; resolve(null); };
            document.head.appendChild(s);
        });
    }
    return i18nFocusPromise;
}
let i18nEnAsked = false;
function t(key) {
    const dict = translations[currentLang] || translations.en || {};
    if (dict[key] !== undefined) return dict[key];
    const en = translations.en;
    if (!en && !i18nEnAsked) { i18nEnAsked = true; i18nLoad('en'); }
    return en && en[key] !== undefined ? en[key] : key;
}

function setLanguage(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) lang = 'en';
    if (!translations[lang]) {
        // השפה עוד לא נטענה: טוענים את הקובץ שלה ואז מחליפים (אם הטעינה נכשלה - אנגלית, ובלי לולאה)
        return i18nLoad(lang).then(ok => {
            if (ok) return setLanguage(lang);
            if (lang !== 'en' && translations[currentLang] === undefined) return setLanguage('en');
        });
    }
    currentLang = lang;
    localStorage.setItem('weekwise_lang', lang);
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL(lang) ? 'rtl' : 'ltr';
    applyTranslations();
    if (typeof onLanguageChanged === 'function') onLanguageChanged();
}

function loadSavedLanguage() {
    const saved = localStorage.getItem('weekwise_lang');
    return setLanguage(saved && SUPPORTED_LANGUAGES.includes(saved) ? saved : 'en');
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.getAttribute('data-i18n-title'));
    });
    // data-i18n-tooltip: מזין תוכן לתגית עצמאית (::after ב-theme.css, ר'
    // [data-tooltip]) בעיצוב האפליקציה, במקום ה-title הדפדפני הגנרי (לא ניתן
    // לעצב עם CSS בכלל). data-i18n-aria-label נפרד (לא title) לנגישות בלבד -
    // לא מציג תגית ויזואלית משלו, כדי לא ליצור שתי תגיות-רמז כפולות בו-זמנית
    document.querySelectorAll('[data-i18n-tooltip]').forEach(el => {
        el.setAttribute('data-tooltip', t(el.getAttribute('data-i18n-tooltip')));
    });
    document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
        el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria-label')));
    });
    const langSelect = document.getElementById('language-select');
    if (langSelect) langSelect.value = currentLang;
}

const I18N_V = '498';
const I18N_CROSS = {
    nm_pos_1: { en: "Breakfast", he: "ארוחת בוקר", es: "Desayuno", fr: "Petit-déjeuner", ar: "الفطور", ru: "Завтрак", de: "Frühstück", pt: "Café da manhã", ja: "朝食", zh: "早餐", hi: "नाश्ता", ko: "아침 식사", tr: "Kahvaltı", id: "Sarapan", it: "Colazione", vi: "Bữa sáng", pl: "Śniadanie", th: "มื้อเช้า", ur: "ناشتہ", bn: "সকালের নাশতা", sw: "Kifungua kinywa", uk: "Сніданок", el: "Πρωινό", nl: "Ontbijt", ca: "Esmorzar", ro: "Mic dejun", yo: "Oúnjẹ àárọ̀", sv: "Frukost", nb: "Frokost", da: "Morgenmad", cs: "Snídaně", hu: "Reggeli", fi: "Aamiainen" },
    nm_pos_2: { en: "Snack", he: "נשנוש", es: "Tentempié", fr: "Collation", ar: "وجبة خفيفة", ru: "Перекус", de: "Snack", pt: "Lanche", ja: "間食", zh: "加餐", hi: "स्नैक", ko: "간식", tr: "Ara öğün", id: "Camilan", it: "Spuntino", vi: "Bữa phụ", pl: "Przekąska", th: "ของว่าง", ur: "اسنیک", bn: "নাশতা", sw: "Kitafunio", uk: "Перекус", el: "Σνακ", nl: "Tussendoortje", ca: "Refrigeri", ro: "Gustare", yo: "Ìpanu", sv: "Mellanmål", nb: "Mellommåltid", da: "Mellemmåltid", cs: "Svačina", hu: "Nasi", fi: "Välipala" },
    nm_pos_3: { en: "Lunch", he: "ארוחת צהריים", es: "Almuerzo", fr: "Déjeuner", ar: "الغداء", ru: "Обед", de: "Mittagessen", pt: "Almoço", ja: "昼食", zh: "午餐", hi: "दोपहर का भोजन", ko: "점심 식사", tr: "Öğle yemeği", id: "Makan siang", it: "Pranzo", vi: "Bữa trưa", pl: "Obiad", th: "มื้อกลางวัน", ur: "دوپہر کا کھانا", bn: "দুপুরের খাবার", sw: "Chakula cha mchana", uk: "Обід", el: "Μεσημεριανό", nl: "Lunch", ca: "Dinar", ro: "Prânz", yo: "Oúnjẹ ọ̀sán", sv: "Lunch", nb: "Lunsj", da: "Frokost", cs: "Oběd", hu: "Ebéd", fi: "Lounas" },
    nm_pos_4: { en: "Evening snack", he: "נשנוש ערב", es: "Merienda", fr: "Collation du soir", ar: "وجبة خفيفة مسائية", ru: "Вечерний перекус", de: "Abendsnack", pt: "Lanche da noite", ja: "夜の間食", zh: "晚间加餐", hi: "शाम का स्नैक", ko: "저녁 간식", tr: "Akşam ara öğünü", id: "Camilan malam", it: "Spuntino serale", vi: "Bữa phụ tối", pl: "Wieczorna przekąska", th: "ของว่างตอนเย็น", ur: "شام کا اسنیک", bn: "সন্ধ্যার নাশতা", sw: "Kitafunio cha jioni", uk: "Вечірній перекус", el: "Βραδινό σνακ", nl: "Avondsnack", ca: "Refrigeri del vespre", ro: "Gustare de seară", yo: "Ìpanu ìrọ̀lẹ́", sv: "Kvällsmål", nb: "Kveldsmat", da: "Aftensnack", cs: "Večerní svačina", hu: "Esti nasi", fi: "Iltapala" },
    nm_pos_dinner: { en: "Light dinner", he: "ארוחת ערב קלה", es: "Cena ligera", fr: "Dîner léger", ar: "عشاء خفيف", ru: "Лёгкий ужин", de: "Leichtes Abendessen", pt: "Jantar leve", ja: "軽めの夕食", zh: "清淡晚餐", hi: "हल्का रात का खाना", ko: "가벼운 저녁 식사", tr: "Hafif akşam yemeği", id: "Makan malam ringan", it: "Cena leggera", vi: "Bữa tối nhẹ", pl: "Lekka kolacja", th: "มื้อเย็นเบาๆ", ur: "ہلکا رات کا کھانا", bn: "হালকা রাতের খাবার", sw: "Chakula chepesi cha jioni", uk: "Легка вечеря", el: "Ελαφρύ βραδινό", nl: "Licht avondeten", ca: "Sopar lleuger", ro: "Cină ușoară", yo: "Oúnjẹ alẹ́ fẹ́ẹ́rẹ́", sv: "Lätt middag", nb: "Lett middag", da: "Let aftensmad", cs: "Lehká večeře", hu: "Könnyű vacsora", fi: "Kevyt illallinen" },
    bag_ex_col_groceries: { en: "Have ingredients", he: "יש מצרכים", es: "Hay ingredientes", fr: "Ingrédients à la maison", ar: "المكوّنات متوفرة", ru: "Продукты есть", de: "Zutaten da", pt: "Tem ingredientes", ja: "材料あり", zh: "食材已备", hi: "सामान है", ko: "재료 있음", tr: "Malzeme var", id: "Bahan tersedia", it: "Ingredienti in casa", vi: "Có nguyên liệu", pl: "Składniki w domu", th: "มีวัตถุดิบ", ur: "سامان موجود ہے", bn: "উপকরণ আছে", sw: "Viungo vipo", uk: "Продукти є", el: "Υπάρχουν υλικά", nl: "Ingrediënten in huis", ca: "Tenim ingredients", ro: "Avem ingrediente", yo: "Èròjà wà", sv: "Har ingredienser", nb: "Har ingredienser", da: "Har ingredienser", cs: "Suroviny doma", hu: "Van hozzávaló", fi: "Ainekset kotona" },
};
const translations = {};
