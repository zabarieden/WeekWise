// --- 📚 ספריית יעדים (לפי בקשה מפורשת: "מלא מלא קטגוריות... קטגוריה בתוך קטגוריה"): 12 נושאים, בכל
// נושא תחומים, ובכל תחום תוכניות מוכנות - תחנות / אתגר ימים / ספירה / משקל - כל אחת עם צעד קטן יומי.
// 2 התוכניות הראשונות בכל נושא בחינם (רק תחנות או אתגר ימים, שאינם פרימיום ממילא), הכול בפרימיום ⭐.
// מסך מלא מעל "היעדים שלי" (z-index 1950, ר' theme.css). הטקסטים: glib_* ב-i18n.js ---

// hue/sat - צבע הנושא (אריחים, כותרת, תגיות). category - הקטגוריה הקיימת של היעד שנוצר
const GLIB_TOPICS = [
    { id: 'health', icon: '💪', hue: 150, sat: 62, category: 'health', subs: [['health_move', '🚶'], ['health_body', '🧘'], ['health_check', '🩺']] },
    { id: 'weight', icon: '⚖️', hue: 38, sat: 70, category: 'health', subs: [['weight_lose', '⬇️'], ['weight_gain', '⬆️'], ['weight_eat', '🥗']] },
    { id: 'arts', icon: '🎵', hue: 275, sat: 60, category: 'personal', subs: [['arts_play', '🎸'], ['arts_sing', '🎤'], ['arts_create', '🎨']] },
    { id: 'learning', icon: '📚', hue: 195, sat: 70, category: 'learning', subs: [['learn_exams', '📝'], ['learn_lang', '🗣️'], ['learn_read', '📖'], ['learn_skills', '🧠']] },
    { id: 'career', icon: '💼', hue: 220, sat: 22, category: 'career', subs: [['career_job', '🔎'], ['career_grow', '📈'], ['career_skills', '🧩']] },
    { id: 'money', icon: '💰', hue: 100, sat: 50, category: 'finance', subs: [['money_save', '🐷'], ['money_budget', '📊'], ['money_debt', '💳']] },
    { id: 'buy', icon: '🛍️', hue: 330, sat: 65, category: 'finance', subs: [['buy_big', '🚗'], ['buy_wants', '🎁'], ['buy_smart', '🛒']] },
    { id: 'mind', icon: '🧘', hue: 172, sat: 55, category: 'personal', subs: [['mind_calm', '🌬️'], ['mind_screen', '📵'], ['mind_thanks', '🙏'], ['mind_conf', '✨']] },
    { id: 'family', icon: '❤️', hue: 355, sat: 60, category: 'relationships', subs: [['family_time', '👨‍👩‍👧'], ['family_couple', '💑'], ['family_friends', '🤝']] },
    { id: 'home', icon: '🏠', hue: 28, sat: 38, category: 'personal', subs: [['home_tidy', '🧹'], ['home_projects', '🛠️'], ['home_routine', '🗓️']] },
    { id: 'travel', icon: '✈️', hue: 222, sat: 65, category: 'travel', subs: [['travel_trips', '🧳'], ['travel_exp', '🌟']] },
    { id: 'habits', icon: '🌱', hue: 85, sat: 55, category: 'personal', subs: [['habits_morning', '🌅'], ['habits_quit', '🚭'], ['habits_kids', '🧒'], ['habits_daily', '📆']] },
];

// track: steps (stations=N תחנות, weeks=משך) / days (days=כמה ימים, tasks=N משימות יומיות) /
// number (target + unit) / weight (lose|gain - משקל היעד אישי, אז נפתח חלון היעד).
// minutes - תגית "X דק׳ ביום". freq: 'weekly' - הצעד הקטן פעם בשבוע. kids: 'for' / 'with'.
// הסדר בתוך נושא קובע מה בחינם (2 הראשונות מסוג תחנות/ימים)
const GLIB_TEMPLATES = [
    { id: 'walk_daily', sub: 'health_move', icon: '🚶', track: 'days', days: 30, tasks: 1, minutes: 20, at: [18] },
    { id: 'run_5k', sub: 'health_move', icon: '🏃', track: 'steps', weeks: 8, stations: 4, minutes: 10, at: [18] },
    { id: 'home_workout', sub: 'health_move', icon: '🏋️', track: 'steps', weeks: 6, stations: 3, minutes: 10 },
    { id: 'stretch', sub: 'health_body', icon: '🤸', track: 'days', days: 21, tasks: 1, minutes: 5 },
    { id: 'sleep_better', sub: 'health_body', icon: '😴', track: 'steps', weeks: 4, stations: 3, at: [22] },
    { id: 'water', sub: 'health_body', icon: '💧', track: 'days', days: 30, tasks: 1 },
    { id: 'checkups', sub: 'health_check', icon: '🩺', track: 'steps', weeks: 8, stations: 3 },

    { id: 'less_sugar', sub: 'weight_lose', icon: '🍬', track: 'days', days: 21, tasks: 2 },
    { id: 'more_veggies', sub: 'weight_eat', icon: '🥦', track: 'days', days: 30, tasks: 1 },
    { id: 'lose_weight', sub: 'weight_lose', icon: '⚖️', track: 'weight', direction: 'lose' },
    { id: 'gain_weight', sub: 'weight_gain', icon: '💪', track: 'weight', direction: 'gain' },
    { id: 'regular_meals', sub: 'weight_gain', icon: '🍽️', track: 'days', days: 21, tasks: 3, at: [8, 13, 19] },
    { id: 'cook_home', sub: 'weight_eat', icon: '🍲', track: 'steps', weeks: 6, stations: 3 },

    { id: 'guitar', sub: 'arts_play', icon: '🎸', track: 'steps', weeks: 8, stations: 4, minutes: 15 },
    { id: 'piano', sub: 'arts_play', icon: '🎹', track: 'steps', weeks: 10, stations: 4, minutes: 15 },
    { id: 'drums', sub: 'arts_play', icon: '🥁', track: 'steps', weeks: 8, stations: 3, minutes: 10 },
    { id: 'old_instrument', sub: 'arts_play', icon: '🎻', track: 'days', days: 30, tasks: 1, minutes: 10 },
    { id: 'singing', sub: 'arts_sing', icon: '🎤', track: 'steps', weeks: 6, stations: 3, minutes: 5 },
    { id: 'draw_daily', sub: 'arts_create', icon: '🎨', track: 'days', days: 30, tasks: 1, minutes: 10 },
    { id: 'write_story', sub: 'arts_create', icon: '✍️', track: 'steps', weeks: 6, stations: 4 },
    { id: 'photos', sub: 'arts_create', icon: '📷', track: 'steps', weeks: 4, stations: 3 },

    { id: 'exam_prep', sub: 'learn_exams', icon: '📝', track: 'steps', weeks: 4, stations: 4, minutes: 25 },
    { id: 'driving_theory', sub: 'learn_exams', icon: '🚗', track: 'steps', weeks: 3, stations: 3 },
    { id: 'language', sub: 'learn_lang', icon: '🗣️', track: 'steps', weeks: 12, stations: 4, minutes: 10 },
    { id: 'vocabulary', sub: 'learn_lang', icon: '🔤', track: 'number', target: 300, unit: 'words' },
    { id: 'read_books', sub: 'learn_read', icon: '📚', track: 'number', target: 12, unit: 'books' },
    { id: 'read_kids', sub: 'learn_read', icon: '📖', track: 'days', days: 30, tasks: 1, kids: 'with', at: [20] },
    { id: 'online_course', sub: 'learn_skills', icon: '💻', track: 'steps', weeks: 6, stations: 3 },
    { id: 'typing', sub: 'learn_skills', icon: '⌨️', track: 'steps', weeks: 4, stations: 3, minutes: 10 },

    { id: 'new_job', sub: 'career_job', icon: '🔎', track: 'steps', weeks: 8, stations: 4 },
    { id: 'interview', sub: 'career_job', icon: '🎙️', track: 'steps', weeks: 2, stations: 3 },
    { id: 'raise', sub: 'career_grow', icon: '📈', track: 'steps', weeks: 4, stations: 3 },
    { id: 'side_business', sub: 'career_grow', icon: '🚀', track: 'steps', weeks: 12, stations: 4, minutes: 30 },
    { id: 'pro_skill', sub: 'career_skills', icon: '🧩', track: 'steps', weeks: 8, stations: 3, minutes: 20 },
    { id: 'portfolio', sub: 'career_skills', icon: '🗂️', track: 'steps', weeks: 6, stations: 3 },

    { id: 'emergency_fund', sub: 'money_save', icon: '🛟', track: 'steps', weeks: 24, stations: 4 },
    { id: 'save_trip', sub: 'money_save', icon: '🏝️', track: 'steps', weeks: 16, stations: 4 },
    { id: 'track_expenses', sub: 'money_budget', icon: '🧾', track: 'days', days: 30, tasks: 1 },
    { id: 'cut_expense', sub: 'money_budget', icon: '✂️', track: 'steps', weeks: 3, stations: 3 },
    { id: 'pay_debt', sub: 'money_debt', icon: '💳', track: 'steps', weeks: 24, stations: 4 },

    { id: 'buy_car', sub: 'buy_big', icon: '🚗', track: 'steps', weeks: 24, stations: 4 },
    { id: 'save_home', sub: 'buy_big', icon: '🏡', track: 'steps', weeks: 52, stations: 4 },
    { id: 'buy_gadget', sub: 'buy_wants', icon: '💻', track: 'steps', weeks: 8, stations: 3 },
    { id: 'wishes', sub: 'buy_wants', icon: '🎁', track: 'number', target: 5, unit: 'wishes', freq: 'weekly' },
    { id: 'smart_shopping', sub: 'buy_smart', icon: '🛒', track: 'days', days: 30, tasks: 1 },

    { id: 'meditate', sub: 'mind_calm', icon: '🧘', track: 'days', days: 30, tasks: 1, minutes: 5 },
    { id: 'breathing', sub: 'mind_calm', icon: '🌬️', track: 'days', days: 21, tasks: 1 },
    { id: 'less_phone', sub: 'mind_screen', icon: '📵', track: 'steps', weeks: 4, stations: 3 },
    { id: 'gratitude', sub: 'mind_thanks', icon: '🙏', track: 'days', days: 30, tasks: 1 },
    { id: 'kindness', sub: 'mind_thanks', icon: '💝', track: 'days', days: 30, tasks: 1 },
    { id: 'confidence', sub: 'mind_conf', icon: '✨', track: 'steps', weeks: 6, stations: 3 },

    { id: 'kid_time', sub: 'family_time', icon: '🤗', track: 'days', days: 30, tasks: 1, minutes: 15, kids: 'with', at: [17] },
    { id: 'talk_more', sub: 'family_couple', icon: '💬', track: 'days', days: 21, tasks: 1, minutes: 10 },
    { id: 'family_evening', sub: 'family_time', icon: '🎲', track: 'number', target: 12, unit: 'evenings', freq: 'weekly' },
    { id: 'date_night', sub: 'family_couple', icon: '💑', track: 'number', target: 6, unit: 'dates', freq: 'weekly' },
    { id: 'call_friend', sub: 'family_friends', icon: '📞', track: 'number', target: 12, unit: 'calls', freq: 'weekly' },

    { id: 'declutter', sub: 'home_tidy', icon: '📦', track: 'steps', weeks: 8, stations: 4 },
    { id: 'daily_tidy', sub: 'home_tidy', icon: '🧺', track: 'days', days: 30, tasks: 1, minutes: 10 },
    { id: 'refresh_room', sub: 'home_projects', icon: '🖌️', track: 'steps', weeks: 4, stations: 3 },
    { id: 'plants', sub: 'home_projects', icon: '🪴', track: 'steps', weeks: 6, stations: 3 },
    { id: 'share_chores', sub: 'home_routine', icon: '🗂️', track: 'steps', weeks: 3, stations: 3, kids: 'with' },

    { id: 'family_trip', sub: 'travel_trips', icon: '🧳', track: 'steps', weeks: 8, stations: 4 },
    { id: 'weekend_away', sub: 'travel_trips', icon: '🏕️', track: 'steps', weeks: 3, stations: 3 },
    { id: 'new_things', sub: 'travel_exp', icon: '🌟', track: 'number', target: 12, unit: 'new_things', freq: 'weekly' },
    { id: 'explore_area', sub: 'travel_exp', icon: '🗺️', track: 'number', target: 10, unit: 'places', freq: 'weekly' },

    { id: 'wake_early', sub: 'habits_morning', icon: '⏰', track: 'steps', weeks: 4, stations: 3, at: [7] },
    { id: 'make_bed', sub: 'habits_morning', icon: '🛏️', track: 'days', days: 21, tasks: 1, at: [8] },
    { id: 'quit_smoking', sub: 'habits_quit', icon: '🚭', track: 'steps', weeks: 8, stations: 4 },
    { id: 'less_coffee', sub: 'habits_quit', icon: '☕', track: 'days', days: 21, tasks: 1 },
    { id: 'kids_teeth', sub: 'habits_kids', icon: '🪥', track: 'days', days: 21, tasks: 2, kids: 'for', at: [8, 20] },
    { id: 'kids_room', sub: 'habits_kids', icon: '🧸', track: 'days', days: 21, tasks: 1, kids: 'for', at: [19] },
    { id: 'one_line', sub: 'habits_daily', icon: '📓', track: 'days', days: 30, tasks: 1 },
];

const GLIB_SUB_TOPIC = {};
GLIB_TOPICS.forEach(tp => tp.subs.forEach(([sub]) => { GLIB_SUB_TOPIC[sub] = tp.id; }));
GLIB_TEMPLATES.forEach(tpl => { tpl.topic = GLIB_SUB_TOPIC[tpl.sub]; });

let glibState = { view: 'home', topic: null, sub: null, tpl: null, query: '', from: 'home', routineOn: true, routinePlan: null };

function glibTopic(id) { return GLIB_TOPICS.find(tp => tp.id === id) || null; }
function glibTopicTemplates(topicId) { return GLIB_TEMPLATES.filter(tpl => tpl.topic === topicId); }
// 2 התוכניות הראשונות בכל נושא שאינן מספר/משקל (שהם ממילא חלק מפרימיום) - בחינם
function glibIsFree(tpl) {
    if (tpl.track === 'number' || tpl.track === 'weight') return false;
    return glibTopicTemplates(tpl.topic).filter(x => x.track === 'steps' || x.track === 'days').slice(0, 2).includes(tpl);
}
function glibCanUse(tpl) { return isPremiumUser || glibIsFree(tpl); }
function glibEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function glibHueStyle(tp) { return `--h: ${tp.hue}; --s: ${tp.sat}%;`; }
function glibRange(n) { return Array.from({ length: n || 0 }, (_, i) => i + 1); }
function glibStationTitles(tpl) {
    if (tpl.track === 'steps') return glibRange(tpl.stations).map(i => t(`glib_tpl_${tpl.id}_s${i}`));
    if (tpl.track === 'days') return glibRange(tpl.tasks).map(i => t(`glib_tpl_${tpl.id}_t${i}`));
    return [];
}
function glibDailyText(tpl) { return tpl.track === 'days' ? null : t(`glib_tpl_${tpl.id}_daily`); }

// התגיות של תוכנית: משך / אתגר ימים / ספירה / משקל, דקות ביום, מספר תחנות, לילדים, פרימיום
function glibTagsHtml(tpl, withPremium) {
    const tags = [];
    if (tpl.track === 'steps') tags.push(['is-accent', t('glib_tag_weeks').replace('{n}', tpl.weeks)]);
    if (tpl.track === 'days') tags.push(['is-accent', t('glib_tag_challenge').replace('{n}', tpl.days)]);
    if (tpl.track === 'number') tags.push(['is-accent', t('glib_tag_count').replace('{n}', tpl.target.toLocaleString(currentLang))]);
    if (tpl.track === 'weight') tags.push(['is-accent', t('glib_tag_weight')]);
    if (tpl.minutes) tags.push(['', t('glib_tag_minutes').replace('{n}', tpl.minutes)]);
    if (tpl.track === 'steps') tags.push(['', t('glib_tag_stations').replace('{n}', tpl.stations)]);
    if (tpl.kids === 'for') tags.push(['is-kids', t('glib_tag_kids')]);
    if (tpl.kids === 'with') tags.push(['is-kids', t('glib_tag_with_kids')]);
    if (withPremium && !glibCanUse(tpl)) tags.push(['is-premium', t('glib_premium')]);
    return `<span class="glib-tags">${tags.map(([cls, txt]) => `<span class="glib-tag ${cls}">${glibEsc(txt)}</span>`).join('')}</span>`;
}

function openGoalsLibrary(topicId) {
    const view = document.getElementById('goals-library');
    if (!view) return;
    glibState = { view: topicId ? 'topic' : 'home', topic: topicId || null, sub: null, tpl: null, query: '', from: 'home', routineOn: true, routinePlan: null };
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    renderGoalsLibrary();
}
function closeGoalsLibrary() {
    const view = document.getElementById('goals-library');
    if (!view) return;
    view.classList.remove('open');
    view.setAttribute('aria-hidden', 'true');
}
function isGoalsLibraryOpen() {
    const view = document.getElementById('goals-library');
    return !!(view && view.classList.contains('open'));
}
function glibGo(view, patch = {}) {
    glibState = { ...glibState, ...patch, view };
    renderGoalsLibrary();
    const scroll = document.getElementById('glib-scroll');
    if (scroll) scroll.scrollTop = 0;
}
function glibBack() {
    if (glibState.view === 'template') glibGo(glibState.from === 'topic' ? 'topic' : 'home');
    else if (glibState.view === 'topic') glibGo('home', { topic: null, sub: null });
    else closeGoalsLibrary();
}

function renderGoalsLibrary() {
    const scroll = document.getElementById('glib-scroll');
    if (!scroll) return;
    scroll.innerHTML = '';
    if (glibState.view === 'template' && glibState.tpl) scroll.appendChild(glibBuildTemplatePage(glibState.tpl));
    else if (glibState.view === 'topic' && glibTopic(glibState.topic)) scroll.appendChild(glibBuildTopicPage(glibTopic(glibState.topic)));
    else scroll.appendChild(glibBuildHomePage());
}

function glibBackButton(label) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gv-icon-btn glib-back';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.innerHTML = '<svg class="gv-back-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"></path></svg>';
    btn.onclick = glibBack;
    return btn;
}

// אריח נושא - גם בספרייה וגם במצב הריק של "היעדים שלי"
function glibBuildTopicTile(tp, onClick) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'glib-tile';
    tile.style.cssText = glibHueStyle(tp);
    const count = glibTopicTemplates(tp.id).length;
    tile.innerHTML = `<span class="glib-tile-icon" aria-hidden="true">${tp.icon}</span><span class="glib-tile-foot"><span class="glib-tile-name">${glibEsc(t('glib_cat_' + tp.id))}</span><span class="glib-tile-count">${glibEsc(t('glib_ideas_count').replace('{n}', count))}</span></span>`;
    tile.onclick = onClick || (() => glibGo('topic', { topic: tp.id, sub: null }));
    return tile;
}

function glibOwnGoalButton(category) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gv-own-goal-btn glib-own-btn';
    btn.textContent = t('glib_own_goal');
    btn.onclick = () => {
        closeGoalsLibrary();
        openVisionGoalModal();
        if (category) selectVisionGoalCategory(category);
    };
    return btn;
}

function glibBuildHomePage() {
    const page = document.createElement('div');
    page.className = 'glib-page';
    const top = document.createElement('div');
    top.className = 'glib-top';
    top.appendChild(glibBackButton(t('gv_back')));
    top.insertAdjacentHTML('beforeend', `<h2 class="glib-title">${glibEsc(t('glib_title'))}</h2>`);
    page.appendChild(top);
    page.insertAdjacentHTML('beforeend', `<p class="glib-sub">${glibEsc(t('glib_subtitle'))}</p>`);

    const search = document.createElement('label');
    search.className = 'glib-search';
    search.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>';
    const input = document.createElement('input');
    input.type = 'search';
    input.id = 'glib-search-input';
    input.placeholder = t('glib_search_ph');
    input.setAttribute('aria-label', t('glib_search_ph'));
    input.value = glibState.query;
    input.oninput = () => { glibState.query = input.value; glibRenderHomeResults(page); };
    search.appendChild(input);
    page.appendChild(search);
    if (!isPremiumUser) page.insertAdjacentHTML('beforeend', `<p class="glib-free-hint">${glibEsc(t('glib_free_hint'))}</p>`);

    const results = document.createElement('div');
    results.className = 'glib-home-results';
    page.appendChild(results);
    page.appendChild(glibOwnGoalButton(null));
    glibRenderHomeResults(page);
    return page;
}

// חיפוש: בשם התוכנית, בצעד הקטן, בתחנות, בשם הנושא והתחום (בשפה הנוכחית). בלי חיפוש - אריחי הנושאים
function glibNormalize(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-֑ͯ-ׇ]/g, ''); }
function glibSearch(query) {
    const q = glibNormalize(query).trim();
    if (!q) return [];
    const words = q.split(/\s+/).filter(Boolean);
    return GLIB_TEMPLATES.filter(tpl => {
        const hay = glibNormalize([t('glib_tpl_' + tpl.id), glibDailyText(tpl) || '', ...glibStationTitles(tpl), t('glib_cat_' + tpl.topic), t('glib_sub_' + tpl.sub)].join(' '));
        return words.every(w => hay.includes(w));
    });
}
function glibRenderHomeResults(page) {
    const results = page.querySelector('.glib-home-results');
    if (!results) return;
    results.innerHTML = '';
    const q = glibState.query.trim();
    if (!q) {
        const grid = document.createElement('div');
        grid.className = 'glib-grid';
        GLIB_TOPICS.forEach(tp => grid.appendChild(glibBuildTopicTile(tp)));
        results.appendChild(grid);
        return;
    }
    const found = glibSearch(q);
    if (!found.length) {
        results.insertAdjacentHTML('beforeend', `<p class="glib-empty">${glibEsc(t('glib_no_results'))}</p>`);
        return;
    }
    const list = document.createElement('div');
    list.className = 'glib-list';
    found.forEach(tpl => list.appendChild(glibBuildTemplateCard(tpl, 'home')));
    results.appendChild(list);
}

function glibBuildTopicPage(tp) {
    const page = document.createElement('div');
    page.className = 'glib-topic';
    page.style.cssText = glibHueStyle(tp);
    const all = glibTopicTemplates(tp.id);
    const hero = document.createElement('div');
    hero.className = 'glib-hero';
    const heroTop = document.createElement('div');
    heroTop.className = 'glib-hero-top';
    heroTop.appendChild(glibBackButton(t('gv_back')));
    heroTop.insertAdjacentHTML('beforeend', `<span class="glib-crumb">${glibEsc(t('glib_title'))}</span>`);
    hero.appendChild(heroTop);
    hero.insertAdjacentHTML('beforeend', `<div class="glib-hero-main"><span class="glib-hero-icon" aria-hidden="true">${tp.icon}</span><div class="glib-hero-text"><h2 class="glib-hero-name">${glibEsc(t('glib_cat_' + tp.id))}</h2><span class="glib-hero-meta">${glibEsc(t('glib_topic_meta').replace('{n}', all.length).replace('{m}', tp.subs.length))}</span></div></div>`);
    const subs = document.createElement('div');
    subs.className = 'glib-subs';
    const addChip = (id, label) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        const sel = (glibState.sub || null) === id;
        chip.className = 'glib-sub-chip' + (sel ? ' selected' : '');
        chip.setAttribute('aria-pressed', sel ? 'true' : 'false');
        chip.textContent = label;
        chip.onclick = () => { glibState.sub = id; renderGoalsLibrary(); };
        subs.appendChild(chip);
    };
    addChip(null, t('glib_all'));
    tp.subs.forEach(([sub, icon]) => addChip(sub, `${icon} ${t('glib_sub_' + sub)}`));
    hero.appendChild(subs);
    page.appendChild(hero);

    const list = document.createElement('div');
    list.className = 'glib-list';
    all.filter(tpl => !glibState.sub || tpl.sub === glibState.sub).forEach(tpl => list.appendChild(glibBuildTemplateCard(tpl, 'topic')));
    page.appendChild(list);
    const foot = document.createElement('div');
    foot.className = 'glib-foot';
    foot.appendChild(glibOwnGoalButton(tp.category));
    page.appendChild(foot);
    return page;
}

function glibBuildTemplateCard(tpl, from) {
    const tp = glibTopic(tpl.topic);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'glib-card' + (glibCanUse(tpl) ? '' : ' is-locked');
    card.style.cssText = glibHueStyle(tp);
    card.innerHTML = `<span class="glib-card-icon" aria-hidden="true">${tpl.icon}</span><span class="glib-card-body"><span class="glib-card-title">${glibEsc(t('glib_tpl_' + tpl.id))}</span>${glibTagsHtml(tpl, true)}</span><svg class="glib-card-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>`;
    card.onclick = () => glibGo('template', { tpl, topic: tpl.topic, from, routineOn: true, routinePlan: null });
    return card;
}

// טווח השבועות של תחנה i מתוך n בתוכנית של w שבועות ("שבועות 1–2")
function glibWeekRange(i, n, w) {
    const a = Math.floor(((i - 1) * w) / n) + 1;
    const b = Math.max(a, Math.floor((i * w) / n));
    return a === b ? t('glib_week_one').replace('{a}', a) : t('glib_week_range').replace('{a}', a).replace('{b}', b);
}

function glibBuildTemplatePage(tpl) {
    const tp = glibTopic(tpl.topic);
    const page = document.createElement('div');
    page.className = 'glib-template';
    page.style.cssText = glibHueStyle(tp);
    const hero = document.createElement('div');
    hero.className = 'glib-tpl-hero';
    hero.appendChild(glibBackButton(t('gv_back')));
    hero.insertAdjacentHTML('beforeend', `<span class="glib-tpl-emoji" aria-hidden="true">${tpl.icon}</span>`);
    page.appendChild(hero);

    const body = document.createElement('div');
    body.className = 'glib-tpl-body';
    body.insertAdjacentHTML('beforeend', `<h2 class="glib-tpl-title">${glibEsc(t('glib_tpl_' + tpl.id))}</h2>${glibTagsHtml(tpl, true)}`);

    const plan = document.createElement('div');
    plan.className = 'glib-plan';
    const titles = glibStationTitles(tpl);
    if (tpl.track === 'steps') {
        plan.insertAdjacentHTML('beforeend', `<span class="glib-plan-title">${glibEsc(t('gv_plan_title'))}</span>`);
        titles.forEach((title, i) => plan.insertAdjacentHTML('beforeend', `<div class="glib-plan-row"><span class="glib-plan-num">${i + 1}</span><span class="glib-plan-text"><span class="glib-plan-when">${glibEsc(glibWeekRange(i + 1, titles.length, tpl.weeks))}</span><span class="glib-plan-what">${glibEsc(title)}</span></span></div>`));
    } else if (tpl.track === 'days') {
        plan.insertAdjacentHTML('beforeend', `<span class="glib-plan-title">${glibEsc(t('vision_days_tasks_title'))}</span>`);
        titles.forEach((title, i) => plan.insertAdjacentHTML('beforeend', `<div class="glib-plan-row"><span class="glib-plan-num">${i + 1}</span><span class="glib-plan-text"><span class="glib-plan-what">${glibEsc(title)}</span></span></div>`));
        plan.insertAdjacentHTML('beforeend', `<span class="glib-plan-note">${glibEsc(t('glib_days_note').replace('{n}', tpl.days))}</span>`);
    } else if (tpl.track === 'number') {
        plan.insertAdjacentHTML('beforeend', `<span class="glib-plan-title">${glibEsc(t('gv_progress_title'))}</span><span class="glib-plan-note">${glibEsc(t('glib_count_note').replace('{n}', tpl.target.toLocaleString(currentLang)).replace('{unit}', t('glib_unit_' + tpl.unit)))}</span>`);
    } else {
        plan.insertAdjacentHTML('beforeend', `<span class="glib-plan-title">${glibEsc(t('gv_progress_title'))}</span><span class="glib-plan-note">${glibEsc(t('glib_weight_note'))}</span>`);
    }
    body.appendChild(plan);

    const daily = glibDailyText(tpl);
    if (daily) {
        const when = tpl.freq === 'weekly' ? t('glib_weekly_label') : t('glib_daily_label');
        body.insertAdjacentHTML('beforeend', `<div class="glib-daily"><span class="glib-daily-icon" aria-hidden="true">👣</span><span><strong>${glibEsc(when)}</strong> ${glibEsc(daily)} <em>${glibEsc(t('glib_daily_counts'))}</em></span></div>`);
    }

    // ➕ לשגרה שלי: צעד קטן יומי (או המשימות היומיות של אתגר ימים) בשעה פנויה - לא במשקל ולא בצעד שבועי
    const canRoutine = glibCanUse(tpl) && tpl.track !== 'weight' && tpl.freq !== 'weekly';
    if (canRoutine) {
        const row = document.createElement('label');
        row.className = 'glib-routine hidden';
        row.innerHTML = `<span class="glib-routine-text"></span><span class="switch"><input type="checkbox" id="glib-routine-toggle"${glibState.routineOn ? ' checked' : ''}><span class="switch-slider"></span></span>`;
        row.querySelector('input').onchange = (e) => { glibState.routineOn = e.target.checked; };
        body.appendChild(row);
        glibPrepareRoutine(tpl).then(planInfo => {
            if (!planInfo || !row.isConnected || glibState.tpl !== tpl) return;
            glibRenderRoutineText(row.querySelector('.glib-routine-text'), tpl);
            row.classList.remove('hidden');
        });
    }

    const actions = document.createElement('div');
    actions.className = 'glib-actions';
    if (!glibCanUse(tpl)) {
        const unlock = document.createElement('button');
        unlock.type = 'button';
        unlock.className = 'glib-start-btn';
        unlock.textContent = t('glib_unlock_btn');
        unlock.onclick = () => openPremiumUpgradeModal();
        actions.appendChild(unlock);
    } else {
        const start = document.createElement('button');
        start.type = 'button';
        start.className = 'glib-start-btn';
        start.textContent = t(tpl.track === 'weight' ? 'glib_set_weight_btn' : 'glib_start_btn');
        start.onclick = () => (tpl.track === 'weight' ? glibEditFirst(tpl) : glibStartGoal(tpl, start));
        actions.appendChild(start);
        if (tpl.track !== 'weight') {
            const edit = document.createElement('button');
            edit.type = 'button';
            edit.className = 'glib-edit-btn';
            edit.textContent = t('glib_edit_first_btn');
            edit.onclick = () => glibEditFirst(tpl);
            actions.appendChild(edit);
        }
    }
    body.appendChild(actions);
    page.appendChild(body);
    return page;
}

// --- ➕ "להוסיף לשגרה שלי": לאיזה טאבים - טאבים של ימים (כל יום בטאב שלו), ואם הם לא מכסים את כל
// השבוע - גם הטאב הכללי הראשון; בלי טאבים של ימים - הטאב הראשון. לא יוצרים טאבים מכאן (מי שעוד לא
// פתח את "השגרה שלי" לא רואה את המתג). השעה: הפנויה הכי קרובה לשעה שמתאימה לתוכנית (tpl.at, ברירת
// מחדל 20:00 - ערב), ועדיף אותה שעה בכל הטאבים ---
function glibHourText(h) { return `${String(h).padStart(2, '0')}:00`; }
async function glibRoutineTabs() {
    if (dailyBoardTabs.length) return dailyBoardTabs;
    const { data } = await supabaseClient.from('routine_tabs').select('*').eq('user_id', currentUserId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    return data || [];
}
function glibTargetTabs(tabs) {
    const dayTabs = tabs.filter(tb => routineTabWeekdays(tb).length);
    if (!dayTabs.length) return tabs.slice(0, 1);
    const covered = new Set(dayTabs.flatMap(tb => routineTabWeekdays(tb)));
    const general = tabs.find(tb => !routineTabWeekdays(tb).length);
    return covered.size >= 7 || !general ? dayTabs : [...dayTabs, general];
}
// השעות של טאב (כמו getDailyBoardCustomHours, אבל גם לטאב שלא נטען ל-dailyBoardTabs)
function glibTabHours(tab) {
    const saved = tab && tab.custom_hours && typeof tab.custom_hours === 'object' ? tab.custom_hours : {};
    const pick = b => (Array.isArray(saved[b]) ? saved[b] : DAILY_BOARD_DEFAULT_HOURS[b]);
    return [...new Set(['morning', 'noon', 'afternoon', 'evening'].flatMap(pick).map(Number))].sort((x, y) => x - y);
}
// לכל שעה רצויה - השעה הפנויה הכי קרובה (בשוויון - המאוחרת), בלי לחזור על שעה
function glibPickHours(free, desired) {
    const pool = [...free];
    const out = [];
    for (const want of desired) {
        if (!pool.length) return null;
        const best = pool.reduce((b, h) => {
            const d = Math.abs(h - want), bd = Math.abs(b - want);
            return d < bd || (d === bd && h > b) ? h : b;
        });
        out.push(best);
        pool.splice(pool.indexOf(best), 1);
    }
    return out.sort((x, y) => x - y);
}
async function glibPrepareRoutine(tpl) {
    if (!supabaseClient || !currentUserId) return null;
    const tabs = glibTargetTabs(await glibRoutineTabs());
    if (!tabs.length) return null;
    const need = tpl.track === 'days' ? Math.max(1, tpl.tasks || 1) : 1;
    const desired = tpl.at && tpl.at.length >= need ? tpl.at.slice(0, need) : Array(need).fill(20);
    const { data } = await supabaseClient.from('routine_items').select('tab_id, time').eq('user_id', currentUserId).eq('kind', 'scheduled').in('tab_id', tabs.map(tb => tb.id));
    const freeByTab = tabs.map(tab => {
        const used = new Set((data || []).filter(r => r.tab_id === tab.id).map(r => (r.time || '').slice(0, 5)));
        return { tabId: tab.id, free: glibTabHours(tab).filter(h => !used.has(glibHourText(h))) };
    });
    const common = freeByTab.reduce((acc, x) => acc.filter(h => x.free.includes(h)), freeByTab[0].free);
    const commonPick = glibPickHours(common, desired);
    const plans = freeByTab.map(x => ({ tabId: x.tabId, hours: commonPick || glibPickHours(x.free, desired) })).filter(p => p.hours);
    if (!plans.length) return null;
    // שעות שכבר יש בהן משהו באחד הטאבים - לא אפשריות בבחירת שעה אחרת
    const used = new Set((data || []).map(r => parseInt(String(r.time || '').slice(0, 2), 10)).filter(h => !Number.isNaN(h)));
    glibState.routinePlan = { tplId: tpl.id, plans, tabs, used, label: plans[0].hours.map(glibHourText).join(', ') };
    return glibState.routinePlan;
}

// "להוסיף ל'השגרה שלי' · 21:00" - השעה היא כפתור: לחיצה פותחת בחירת שעה אחרת (לפי בקשה מפורשת - לא רק
// השעה שהוצעה). באתגר עם כמה משימות ביום - כפתור לכל משימה
function glibRenderRoutineText(el, tpl) {
    const plan = glibState.routinePlan;
    if (!el || !plan) return;
    const text = t('glib_routine_toggle');
    const parts = text.includes('{time}') ? text.split('{time}') : [text + ' · ', ''];
    el.innerHTML = '';
    el.append(parts[0]);
    plan.plans[0].hours.forEach((h, i) => {
        if (i) el.append(', ');
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'glib-time-chip';
        chip.innerHTML = `<bdi dir="ltr">${glibHourText(h)}</bdi><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.6 19.4l1.35-3.75 8.35-8.35a1.7 1.7 0 0 1 2.4 2.4l-8.35 8.35z"></path></svg>`;
        chip.setAttribute('aria-label', `${t('glib_routine_time_title')} ${glibHourText(h)}`);
        // בתוך <label> של המתג - בלי preventDefault הלחיצה הייתה גם מדליקה/מכבה אותו
        chip.onclick = (e) => { e.preventDefault(); e.stopPropagation(); glibOpenHourPicker(tpl, i, () => glibRenderRoutineText(el, tpl)); };
        el.appendChild(chip);
    });
    el.append(parts[1]);
}

// בחירת שעה: 05:00 עד 23:00. שעה שכבר תפוסה בשגרה (או נבחרה למשימה אחרת של אותו אתגר) - מסומנת ולא
// לחיצה. שעה שעוד לא מופיעה בשעות של הטאב - תתווסף לטאב כשהיעד נשמר (ר' glibEnsureTabHours)
function glibOpenHourPicker(tpl, index, onDone) {
    const plan = glibState.routinePlan;
    if (!plan || plan.tplId !== tpl.id) return;
    const current = plan.plans[0].hours[index];
    const others = new Set(plan.plans[0].hours.filter((_, i) => i !== index));
    const ov = document.createElement('div');
    ov.className = 'glib-hour-overlay';
    ov.innerHTML = `<div class="glib-hour-sheet" role="dialog" aria-modal="true"><span class="glib-hour-grip" aria-hidden="true"></span><h3 class="glib-hour-title">${glibEsc(t('glib_routine_time_title'))}</h3><p class="glib-hour-hint">${glibEsc(t('glib_routine_time_hint'))}</p><div class="glib-hour-grid"></div></div>`;
    ov.querySelector('.glib-hour-sheet').setAttribute('aria-label', t('glib_routine_time_title'));
    const grid = ov.querySelector('.glib-hour-grid');
    for (let h = 5; h <= 23; h++) {
        const busy = h !== current && (plan.used.has(h) || others.has(h));
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'glib-hour' + (h === current ? ' is-current' : '') + (busy ? ' is-busy' : '');
        b.disabled = busy;
        b.innerHTML = `<bdi dir="ltr">${glibHourText(h)}</bdi>${busy ? `<small>${glibEsc(t('glib_routine_hour_busy'))}</small>` : ''}`;
        if (h === current) b.setAttribute('aria-pressed', 'true');
        b.onclick = () => {
            plan.plans.forEach(p => { p.hours[index] = h; });
            plan.label = plan.plans[0].hours.map(glibHourText).join(', ');
            ov.remove();
            onDone();
        };
        grid.appendChild(b);
    }
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
    const cur = grid.querySelector('.is-current');
    if (cur) cur.focus();
}

// שעה שנבחרה ועוד לא מופיעה בשעות של הטאב - נוספת לבלוק המתאים (בוקר / צהריים / אחר הצהריים / ערב),
// אחרת הצעד לא היה מופיע ב"השגרה שלי" (הטאב מציג רק את השעות שלו)
async function glibEnsureTabHours(plan) {
    const updates = [];
    plan.plans.forEach(p => {
        const tab = (plan.tabs || []).find(tb => tb.id === p.tabId);
        if (!tab) return;
        const saved = tab.custom_hours && typeof tab.custom_hours === 'object' ? tab.custom_hours : {};
        const hours = {};
        ['morning', 'noon', 'afternoon', 'evening'].forEach(b => { hours[b] = (Array.isArray(saved[b]) ? saved[b] : DAILY_BOARD_DEFAULT_HOURS[b]).map(Number); });
        let changed = false;
        p.hours.forEach(h => {
            if (Object.values(hours).some(list => list.includes(h))) return;
            const bucket = Object.keys(DAILY_BOARD_BUCKET_RANGES).find(b => DAILY_BOARD_BUCKET_RANGES[b].includes(h));
            if (!bucket) return;
            hours[bucket] = [...hours[bucket], h].sort((a, b) => a - b);
            changed = true;
        });
        if (!changed) return;
        tab.custom_hours = hours;
        const cached = dailyBoardTabs.find(tb => tb.id === tab.id);
        if (cached) cached.custom_hours = hours;
        updates.push(supabaseClient.from('routine_tabs').update({ custom_hours: hours }).eq('id', tab.id));
    });
    if (updates.length) await Promise.all(updates);
}

// התוכנית → פריטים בשגרה: באתגר ימים - כל משימה יומית בשעה שלה (vision_milestone_id; בלי משימות -
// היעד עצמו), ובשאר - הצעד הקטן היומי (vision_goal_id). צעד שבועי / בלי צעד - לא נוסף
async function glibApplyRoutinePlan(goal, milestones, plan) {
    if (!plan || !goal || !supabaseClient || !currentUserId) return false;
    const items = [];
    const base = (tabId, hour, title) => ({ tab_id: tabId, user_id: currentUserId, title: `🎯 ${title}`, time: glibHourText(hour), kind: 'scheduled' });
    plan.plans.forEach(p => {
        if (goal.track_type === 'days') {
            if (milestones.length) milestones.forEach((m, i) => { if (p.hours[i] != null) items.push({ ...base(p.tabId, p.hours[i], m.title), vision_milestone_id: m.id }); });
            else items.push({ ...base(p.tabId, p.hours[0], goal.title), vision_goal_id: goal.id });
        } else if (goal.reminder_freq === 'daily' && goal.reminder_text) {
            items.push({ ...base(p.tabId, p.hours[0], goal.reminder_text), vision_goal_id: goal.id });
        }
    });
    if (!items.length) return false;
    await glibEnsureTabHours(plan);
    const { error } = await supabaseClient.from('routine_items').insert(items);
    if (error) { console.error('library routine items failed', error); return false; }
    const board = document.getElementById('modal-daily-board');
    if (board && board.classList.contains('open')) renderDailyBoard();
    return true;
}

// תוכנית → יעד בחלון היעד (לשינויים לפני השמירה) - אותו מבנה כמו "התחלה" אבל דרך openVisionGoalModal
function glibTemplateGoal(tpl) {
    const tp = glibTopic(tpl.topic);
    return {
        libId: tpl.id, title: t('glib_tpl_' + tpl.id), icon: tpl.icon, category: tp ? tp.category : null,
        track: tpl.track, target: tpl.track === 'days' ? tpl.days : (tpl.track === 'number' ? tpl.target : null),
        unit: tpl.unit ? t('glib_unit_' + tpl.unit) : null, milestoneTitles: glibStationTitles(tpl),
        daily: glibDailyText(tpl), freq: tpl.track === 'days' ? null : (tpl.freq || 'daily'),
        weeks: tpl.track === 'steps' ? tpl.weeks : null,
    };
}

// המתג "להוסיף לשגרה שלי" (אם הופיע והוא דלוק) - התוכנית שהוכנה לתבנית הזו
function glibActiveRoutinePlan(tpl) {
    const plan = glibState.routinePlan;
    return glibState.routineOn && plan && plan.tplId === tpl.id && tpl.track !== 'weight' && tpl.freq !== 'weekly' ? plan : null;
}

function glibEditFirst(tpl) {
    if (!glibCanUse(tpl)) { openPremiumUpgradeModal(); return; }
    const goal = { ...glibTemplateGoal(tpl), routine: glibActiveRoutinePlan(tpl) };
    closeGoalsLibrary();
    openVisionGoalModal(null, goal);
}

// "להתחיל את היעד": היעד נשמר מיד עם התחנות / המשימות היומיות, הצעד הקטן, תאריך יעד (תוכנית
// תחנות) וקישור לשגרה (אם הופעל). אחר כך נפתח השביל שלו
async function glibStartGoal(tpl, btn) {
    if (!glibCanUse(tpl)) { openPremiumUpgradeModal(); return; }
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    if (btn) btn.disabled = true;
    const g = glibTemplateGoal(tpl);
    let targetDate = null;
    if (g.weeks) { const d = new Date(); d.setDate(d.getDate() + g.weeks * 7); targetDate = getLocalDateString(d); }
    const payload = {
        user_id: currentUserId, title: g.title, icon: g.icon, category: g.category, track_type: g.track,
        target_value: g.target, current_value: g.track === 'number' ? 0 : null, unit: g.unit,
        reminder_freq: g.freq, reminder_weekday: g.freq === 'weekly' ? new Date().getDay() : null, reminder_text: g.daily,
        template_key: tpl.id, target_date: targetDate,
    };
    const { data: goal, error } = await supabaseClient.from('vision_goals').insert(payload).select().single();
    if (error || !goal) { if (btn) btn.disabled = false; showAppToast(t('error_adding_item') + (error ? error.message : ''), 'error'); return; }
    let milestones = [];
    if (g.milestoneTitles.length) {
        const rows = g.milestoneTitles.map((title, i) => ({ goal_id: goal.id, user_id: currentUserId, title, is_done: false, sort_order: (i + 1) * 10 }));
        const { data } = await supabaseClient.from('vision_goal_milestones').insert(rows).select();
        milestones = (data || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
    const routineAdded = await glibApplyRoutinePlan(goal, milestones, glibActiveRoutinePlan(tpl));
    closeGoalsLibrary();
    visionSelectedGoalId = goal.id;
    visionAnimatePath = true;
    try { localStorage.setItem(VISION_SELECTED_KEY, goal.id); } catch {}
    if (!isGoalsViewOpen()) openGoalsVisionDrawer(goal.id);
    else await loadVisionGoals();
    showAppToast(t(routineAdded ? 'glib_started_routine_toast' : 'glib_started_toast'));
    const scroll = document.getElementById('goals-view-scroll');
    const panel = document.getElementById('gv-goal');
    if (scroll && panel) scroll.scrollTo({ top: Math.max(0, panel.offsetTop - 12), behavior: 'smooth' });
}
