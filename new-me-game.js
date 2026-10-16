// ===== New Me כמשחק (לפי בקשה מפורשת, 2026-10-14) =====
// "אני רוצה שהכפתורים יהיו באותו מקום כל הזמן כמו משחק" - שכבת כפתורים אחת קבועה (#nm-hud) מעל כל העולם: המסדרון, החדר,
// כל המקומות, הגג ומפת העולם. רק הציור שבאמצע מתחלף. הסגנון: 8 "קריסטל" מהקנבס ("סגנון 8 מהמם"), והמשימה הבאה "בדיוק
// ככה רק בצד בקטן". בנוסף: מפת עולם שאפשר ללכת ממנה לכל מקום, והדמות של המשתמש/ת - Me1 (התינוק), אחרי כמה אתגרים Me2,
// ולפני הסוף Me3 - עם מהפך שרואים קורה. הציורים שלה: world/me1.png, me2.png, me3.png, bag.png
// מתי השכבה מוצגת - ב-CSS (#nm-hud מוצג רק כש-New Me במסדרון או כשהחדר / מקום פתוחים); כאן רק התוכן שלה

const NMG_STAGES = [
    { n: 1, img: 'me1.png', at: 0, ratio: 393 / 420 },
    { n: 2, img: 'me2.png', at: 4, ratio: 321 / 302 },
    { n: 3, img: 'me3.png', at: 9, ratio: 751 / 420 },
];
// המקומות במפה, לפי הסדר שבו הם נפתחים (המפתח הראשון = החדר)
const NMG_MAP = [
    { id: 'hall', img: 'forest-gate.jpg', name: () => t('nm_map_gate'), at: 0 },
    { id: 'room', img: 'tree-desk.jpg', name: () => t('room_title'), at: 1 },
    { id: 'roof', img: 'treetop.jpg', name: () => roomItemName('roof') },
    { id: 'porch', img: 'lake-dock.jpg', name: () => roomItemName('porch') },
    { id: 'music', img: 'music-hollow.jpg', name: () => roomItemName('music') },
    { id: 'breath', img: 'lake-sunset.jpg', name: () => roomItemName('breath') },
    { id: 'outside', img: 'forest-night.jpg', name: () => roomItemName('outside') },
    { id: 'yoga', img: 'yoga.jpg', name: () => roomItemName('yoga') },
    { id: 'waterfall', img: 'waterfall.jpg', name: () => roomItemName('waterfall') },
];
const NMG_SVG = {
    hex: '<svg class="nmg-hx" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><use href="#nmg-hexdef"/></svg>',
    defs: '<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs><linearGradient id="nmg-rim" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#c9b6ff"/><stop offset=".5" stop-color="#a7f3d0"/><stop offset=".7" stop-color="#ff9ecf"/><stop offset="1" stop-color="#ffffff"/></linearGradient><linearGradient id="nmg-fill" x1="0" y1="0" x2=".6" y2="1"><stop offset="0" stop-color="#f1e9ff" stop-opacity=".6"/><stop offset=".45" stop-color="#b9a0f2" stop-opacity=".34"/><stop offset=".56" stop-color="#8a68dc" stop-opacity=".46"/><stop offset="1" stop-color="#ddd0ff" stop-opacity=".58"/></linearGradient><g id="nmg-hexdef"><polygon points="50,1.5 98.5,25.5 98.5,74.5 50,98.5 1.5,74.5 1.5,25.5" fill="url(#nmg-fill)" stroke="url(#nmg-rim)" stroke-width="3" vector-effect="non-scaling-stroke"/><polygon points="50,15 81,31 81,69 50,85 19,69 19,31" fill="rgba(255,255,255,.07)" stroke="rgba(255,255,255,.42)" stroke-width="1" vector-effect="non-scaling-stroke"/><path d="M50 1.5V15M98.5 25.5L81 31M98.5 74.5L81 69M50 98.5V85M1.5 74.5L19 69M1.5 25.5L19 31" stroke="rgba(255,255,255,.4)" stroke-width="1" vector-effect="non-scaling-stroke"/></g></defs></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M21 12v2"/></svg>',
    fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c.6 3.4 5 5.6 5 10.5a5 5 0 0 1-10 0c0-2.6 1.4-4.2 2.6-5.3.2 1.7 1 2.7 2.3 3.2-.5-3 .7-5.7.1-8.4z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 3L5 14h6l-1 7 8-11h-6z"/></svg>',
    meal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 3-3 6s1 3 3 3v9"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
};
const NMG_ICONS = {
    day: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    challenges: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
    journey: '<path d="M4 20c4 0 4-5 8-5s4-6 8-6"/><circle cx="4" cy="20" r="1.5"/><circle cx="20" cy="9" r="1.5"/>',
    shop: '<path d="M4 9h16l-1.5 10.5A1.5 1.5 0 0 1 17 21H7a1.5 1.5 0 0 1-1.5-1.5z"/><path d="M8 9l3-5M16 9l-3-5M9.5 13v4M14.5 13v4"/>',
    badges: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M9 20h6"/>',
    measure: '<path d="M3 15L15 3l6 6L9 21z"/><path d="M6 12l2 2M9 9l1.5 1.5M12 6l2 2"/>',
    photos: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 5"/><circle cx="16" cy="9" r="1.5"/>',
    month: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01"/>',
    world: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
    reminders: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14.5h18M9 9v11M15 9v11"/>',
    pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 12h6M9 15.5h6M9 19h4"/>',
    gift: '<rect x="4" y="10" width="16" height="11" rx="1.5"/><path d="M3 7h18v3H3z"/><path d="M12 7v14"/><path d="M12 7c-1.4-3-5-3.4-5-1.4S10.5 7 12 7c1.5 0 5 .6 5-1.4S13.4 4 12 7"/>',
    stats: '<path d="M5 20V11M11 20V5M17 20v-6M3 20h18"/>',
    home: '<path d="M4 11.5L12 4l8 7.5"/><path d="M6.5 10v10h11V10"/><path d="M10 20v-5h4v5"/>',
    gate: '<path d="M5 21V11a7 7 0 0 1 14 0v10"/><path d="M3 21h18"/><path d="M9 21v-7a3 3 0 0 1 6 0v7"/><path d="M12 4v-1.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
};
function nmgIcon(k) { return `<svg class="nmg-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NMG_ICONS[k]}</svg>`; }
function nmgKeys() { return typeof roomKeys === 'function' && typeof roomLoaded !== 'undefined' && roomLoaded ? roomKeys() : 0; }
function nmgStage(keys = nmgKeys()) { return NMG_STAGES.slice().reverse().find(s => keys >= s.at) || NMG_STAGES[0]; }
// הדמות שמוצגת: מי שרוצה יכול להחזיר דמות קודמת (2026-10-16, לפי בקשה מפורשת) - new_me_room.me_pick; ריק = השלב שהמפתחות הגיעו אליו
function nmgShownStage(keys = nmgKeys()) {
    const cur = nmgStage(keys);
    const pick = typeof roomState !== 'undefined' && roomState ? Number(roomState.me_pick) || 0 : 0;
    return pick >= 1 && pick < cur.n ? NMG_STAGES[pick - 1] : cur;
}
function nmgNextSlot() { return typeof nmNextSlot === 'function' && nmProfile ? nmNextSlot(nmActiveOrder()) : null; }

// ---------- הכפתורים הקבועים ----------
function nmgButton(view, label, extra = '') {
    return `<button type="button" class="nmg-b nmg-it" data-hud="${view}" onclick="nmgGo('${view}')">${extra}<span class="nmg-btn">${NMG_SVG.hex}${nmgIcon(view)}</span><span class="nmg-lb">${nmEsc(label)}</span></button>`;
}
function nmgRenderHud() {
    const wrap = document.querySelector('.phone-wrapper') || document.body;
    let hud = document.getElementById('nm-hud');
    if (typeof hasNewMe === 'undefined' || !hasNewMe || !nmProfile) { if (hud) hud.remove(); return; }
    if (!hud) { hud = document.createElement('div'); hud.id = 'nm-hud'; hud.className = 'nmg-hud'; hud.setAttribute('dir', document.documentElement.dir || 'rtl'); wrap.appendChild(hud); }
    const eaten = nmEatenToday();
    const goal = nmProfile.plan + (typeof nmBurnedToday !== 'undefined' ? nmBurnedToday : 0);
    const pct = Math.max(0, Math.min(100, Math.round(eaten.kcal / goal * 100)));
    const st = nmStreaks();
    const next = nmgNextSlot();
    const nextName = next ? (nmIsFree(next) ? t('nm_free_meal') : nmItemShort(nmItemInfo(nmTodayKey(next)))) : '';
    const nextKcal = next && !nmIsFree(next) ? nmItemInfo(nmTodayKey(next)).kcal + nmSlotExtra(next) : 0;
    const title = k => t(NEW_ME_VIEW_TITLES[k]);
    // למטה (2026-10-16, לפי בקשה מפורשת): התיק הקסום גדול באמצע, מצד אחד מפת העולם ומהצד השני המסע שלי. ✓ אכלתי - במשימה
    // הבאה; הישגים, תזכורות, הגדרות, קניות, מדידות, תמונות ולוח חודשי - בתוך התיק (בצד נשארו כל היום ואתגרים)
    hud.innerHTML = `${NMG_SVG.defs}
        <div class="nmg-top">
            <button type="button" class="nmg-b nmg-day" onclick="nmgGo('journey')" aria-label="${nmEsc(t('nm_day_n').replace('{n}', nmFmt(nmJourneyDay())))}">${NMG_SVG.hex}<span class="nmg-dayt"><small>${nmEsc(t('nm_hud_day'))}</small><b>${nmFmt(nmJourneyDay())}</b></span></button>
            <button type="button" class="nmg-b nmg-pill nmg-key" onclick="nmgKeysTip()" aria-label="🔑 ${nmFmt(nmgKeys())}">${NMG_SVG.key}<span>${nmFmt(nmgKeys())}</span></button>
            <span class="nmg-pill nmg-fire" aria-label="🔥 ${nmFmt(st.current)}">${NMG_SVG.fire}<span>${nmFmt(st.current)}</span></span>
            <button type="button" class="nmg-b nmg-pill nmg-en" onclick="nmgGo('day')" aria-label="${nmEsc(t('nm_eaten'))} ${nmFmt(eaten.kcal)} / ${nmFmt(goal)}">${NMG_SVG.bolt}<span class="nmg-track"><span class="nmg-fill" style="width:${pct}%"></span></span><span class="nmg-num"><bdi dir="ltr">${nmFmt(eaten.kcal)} / ${nmFmt(goal)}</bdi></span></button>
        </div>
        <button type="button" class="nmg-b nmg-home" onclick="goHome()" aria-label="${nmEsc(t('back_to_home_btn'))}"><span class="nmg-btn">${NMG_SVG.hex}${nmgIcon('home')}</span></button>
        <button type="button" class="nmg-b nmg-hall" onclick="nmgBackToHall()" aria-label="${nmEsc(t('room_back_to_hall'))}"><span class="nmg-btn">${NMG_SVG.hex}${nmgIcon('gate')}</span><span class="nmg-lb">${nmEsc(t('room_back_to_hall'))}</span></button>
        ${next ? `<button type="button" class="nmg-b nmg-quest" onclick="nmOpenHallMeal('${next}')">
            <span class="nmg-q1">${NMG_SVG.meal}<span>${nmEsc(t('nm_hud_next').replace('{time}', nmSlotReminderTime(next)))}</span></span>
            <span class="nmg-q2">${nmEsc(nmSlotName(next))}: ${nmEsc(nextName)}</span>
            ${nextKcal ? `<span class="nmg-q3"><bdi dir="ltr">~${nmFmt(nextKcal)}</bdi> ${nmEsc(t('calories_unit'))}</span>` : ''}
        </button>` : `<button type="button" class="nmg-b nmg-quest is-done" onclick="nmgGo('day')"><span class="nmg-q2">${nmEsc(t('nm_hall_all_done'))}</span></button>`}
        ${nmgWeekCardHtml()}
        <div class="nmg-rail nmg-rr">${['day', 'challenges'].map(k => nmgButton(k, title(k))).join('')}</div>
        <div class="nmg-dock">
            ${nmgButton('world', t('nm_hud_world'))}
            <button type="button" class="nmg-b nmg-it nmg-bagit is-big" data-hud="bag" onclick="nmgGo('bag')" aria-label="${nmEsc(t('nm_backpack'))}"><span class="nmg-bagv"><span class="nmg-plinth"></span><img class="nmg-bag" src="world/bag.png" alt=""></span><span class="nmg-lb">${nmEsc(t('nm_hud_bag'))}</span></button>
            ${nmgButton('journey', title('journey'))}
        </div>`;
    nmgFitLabels(hud);
}
// מילה ארוכה בשם של כפתור (Einstellungen, Fortschrittsfotos): הגופן קטן קצת עד שהיא נכנסת; רק אם גם אז לא - נשברת
function nmgFitLabels(hud) {
    // גם השורה "המשימה הבאה · 13:00" - קטנה עד שהשעה נכנסת (לא נחתכת)
    hud.querySelectorAll('.nmg-q1 > span').forEach(el => {
        el.style.fontSize = '';
        if (!el.clientWidth) return;
        let size = parseFloat(getComputedStyle(el).fontSize);
        while (el.scrollWidth > el.clientWidth + 1 && size > 7.5) { size -= 0.5; el.style.fontSize = `${size}px`; }
    });
    hud.querySelectorAll('.nmg-lb').forEach(el => {
        el.style.fontSize = '';
        el.style.overflowWrap = 'normal';
        if (!el.clientWidth) { el.style.overflowWrap = ''; return; }
        let size = parseFloat(getComputedStyle(el).fontSize);
        while (el.scrollWidth > el.clientWidth + 1 && size > 7.5) { size -= 0.5; el.style.fontSize = `${size}px`; }
        if (el.scrollWidth > el.clientWidth + 1) el.style.overflowWrap = '';
    });
}
// ✨ אתגר השבוע - כרטיס גדול במסדרון (לפי בקשה מפורשת, 2026-10-16: "אתגר השבוע שיהיה בגדול"): האתגר של השבוע, שבעת
// הימים שלו ו-✓ להיום; בלי אתגר - "על מה רוצים לעבוד השבוע?" (הבחירה של המשתמש/ת, לא של האפליקציה)
function nmgWeekCardHtml() {
    if (typeof nmChActiveWeek !== 'function' || typeof nmChallengesLoaded === 'undefined' || !nmChallengesLoaded) return '';
    const c = nmChActiveWeek();
    if (!c) {
        return `<button type="button" class="nmg-b nmg-week is-empty" onclick="nmOpenGrowthPicker()">
            <span class="nmg-week-eyebrow">✨ ${nmEsc(t('nm_week_ch_label'))}</span>
            <b class="nmg-week-title">${nmEsc(t('nm_week_pick_q'))}</b>
            <span class="nmg-week-cta">${nmEsc(t('nm_week_pick_btn'))}</span>
        </button>`;
    }
    const def = nmChDef(c.challenge_key);
    const st = nmChState(c);
    const lastFinal = nmAddDays(st.today, -2);
    const dots = Array.from({ length: c.days }, (_, i) => {
        const d = nmAddDays(c.start_date, i);
        const m = st.marks[d];
        const cls = m === 'done' ? 'done' : m === 'free' ? 'free' : d > st.today ? 'future' : d <= lastFinal ? 'missed' : 'open';
        return `<i class="nmg-week-dot ${cls}${d === st.today ? ' today' : ''}"></i>`;
    }).join('');
    const mark = st.marks[st.today];
    return `<div class="nmg-week${st.scheduled ? ' is-scheduled' : ''}">
        <button type="button" class="nmg-b nmg-week-main" onclick="nmOpenChallenge('${c.challenge_key}')">
            <span class="nmg-week-eyebrow">✨ ${nmEsc(t('nm_week_ch_label'))}${st.scheduled ? ` · ⏳ ${nmEsc(nmShortDate(c.start_date))}` : ''}</span>
            <b class="nmg-week-title"><span aria-hidden="true">${def.icon}</span> ${nmEsc(nmChTitle(c.challenge_key))}</b>
            <span class="nmg-week-dots" aria-label="${nmEsc(t('nm_ch_progress_line').replace('{done}', st.done).replace('{needed}', st.needed))}">${dots}</span>
        </button>
        ${st.canToday ? `<button type="button" class="nmg-b nmg-week-check${mark === 'done' ? ' on' : ''}" onclick="nmMarkChallengeDay('${c.id}', '${st.today}', 'done')" aria-pressed="${mark === 'done'}" aria-label="${nmEsc(t('nm_ch_mark_today'))}">✓</button>` : ''}
    </div>`;
}
// כפתור בשכבה: מסך של New Me (החדר / המקום / המפה נסגרים קודם), התיק, או המפה
function nmgGo(view) {
    if (view === 'world') { nmgOpenMap(); return; }
    nmgCloseMap();
    if (typeof srIsOpen === 'function' && srIsOpen() && typeof closeSecretRoom === 'function') closeSecretRoom();
    if (view === 'bag') { if (document.getElementById('nmg-bag')) { nmgCloseBag(); return; } nmGo('home'); nmgOpenBag(); return; }
    nmgCloseBag();
    nmGo(view);
}
// ✓ אכלתי: הארוחה הבאה. כשכולן כבר סומנו - כל היום
async function nmgEat(btn) {
    const next = nmgNextSlot();
    if (!next) { nmgGo('day'); return; }
    if (btn) btn.disabled = true;
    await nmToggleCheck(next);
    nmgRenderHud();
}
// "למסדרון" - מכל חדר ומכל מקום, באותו מקום תמיד (לפי בקשה מפורשת, 2026-10-16: "שיהיה אפשר לחזור מכל חדר למסדרון בצורה קלה")
function nmgBackToHall() {
    nmgCloseMap();
    nmgCloseBag();
    if (typeof srIsOpen === 'function' && srIsOpen() && typeof closeSecretRoom === 'function') closeSecretRoom();
    nmGo('home');
}
function nmgKeysTip() { if (typeof nmhKeysTip === 'function' && nmView === 'home' && !(typeof srIsOpen === 'function' && srIsOpen())) nmhKeysTip(); else showAppToast(t('nm_keys_tip')); }

// ---------- התיק הקסום: מסך משלו, בסגנון המשחק ----------
// (לפי בקשה מפורשת, 2026-10-16: "תפתח מסך חדש גם שיראה כמו המשחק ועם ציורי יהלומים לכל דבר לכל קטגוריה"). כל קטגוריה -
// יהלום קריסטל עם ציור משלו. בלי הארוחות, בלי "כל היום" ובלי האתגרים (הם בצד); הכפתורים הקבועים נשארים מסביב
// ההגדרות - למטה בצד, קטנות יותר (לפי בקשה מפורשת, 2026-10-16)
function nmgBagItems() { return nmTiles().filter(k => k !== 'challenges'); }
function nmgBagItemHtml(k, i, cls = '') {
    return `<button type="button" class="nmg-b nmg-bag-item${cls}" data-tile="${k}" style="--i:${i}">
        <span class="nmg-btn">${NMG_SVG.hex}${nmgIcon(k)}</span>
        <span class="nmg-lb">${nmEsc(t(NEW_ME_VIEW_TITLES[k]))}</span>
    </button>`;
}
function nmgOpenBag() {
    nmgCloseMap();
    nmgCloseBag();
    const box = document.createElement('div');
    box.id = 'nmg-bag';
    box.className = 'nmg-bagview';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', t('nm_hud_bag'));
    box.innerHTML = `${NMG_SVG.defs}
        <div class="nmg-bag-scroll">
            <div class="nmg-bag-head"><img src="world/bag.png" alt=""><b>${nmEsc(t('nm_hud_bag'))}</b></div>
            <div class="nmg-bag-grid">${nmgBagItems().map((k, i) => nmgBagItemHtml(k, i)).join('')}</div>
            <div class="nmg-bag-foot">${nmgBagItemHtml('settings', nmgBagItems().length, ' is-small')}</div>
        </div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(box);
    document.querySelector('.phone-wrapper')?.classList.add('nmg-bag-open');
    box.querySelectorAll('[data-tile]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.tile;
        nmgCloseBag();
        if (k === 'pdf') nmOpenPdf(b);
        else nmGo(k);
    }));
    nmgFitLabels(box);
}
function nmgCloseBag() {
    document.getElementById('nmg-bag')?.remove();
    document.querySelector('.phone-wrapper')?.classList.remove('nmg-bag-open');
}

// ---------- מפת העולם ----------
function nmgPlaceOpen(p, keys) {
    if (p.id === 'hall') return true;
    if (p.id === 'room') return keys >= 1;
    return typeof roomUnlockAt === 'function' && keys >= roomUnlockAt(p.id);
}
function nmgOpenMap() {
    nmgCloseBag();
    nmgCloseMap();
    const keys = nmgKeys();
    const stage = nmgShownStage(keys);
    const box = document.createElement('div');
    box.id = 'nmg-map';
    box.className = 'nmg-map';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', t('nm_map_title'));
    const nodes = NMG_MAP.map((p, i) => {
        const open = nmgPlaceOpen(p, keys);
        const at = p.id === 'room' ? 1 : p.id === 'hall' ? 0 : roomUnlockAt(p.id);
        const side = i % 2 ? 'is-l' : 'is-r';
        return `<button type="button" class="nmg-node ${side}${open ? '' : ' is-locked'}" data-place="${p.id}" onclick="nmgMapGo('${p.id}')" aria-label="${nmEsc(p.name())}${open ? '' : ` – 🔑 ${nmFmt(at)}`}">
            <span class="nmg-node-pic" style="background-image:url('world/${p.img}')">${open ? '' : `<span class="nmg-node-lock">${NMG_SVG.lock}<b>${nmFmt(at)}</b></span>`}</span>
            <span class="nmg-node-name">${nmEsc(p.name())}</span>
        </button>`;
    }).join('');
    box.innerHTML = `
        <div class="nmg-map-scroll">
            <div class="nmg-map-head"><b>${nmEsc(t('nm_map_title'))}</b><button type="button" class="nmg-map-me" onclick="nmgOpenMe()" aria-label="${nmEsc(t('nm_me_title'))}"><img src="world/${stage.img}" alt=""><span>Me${stage.n}</span></button></div>
            <div class="nmg-path">${nodes}</div>
        </div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(box);
    document.querySelector('.phone-wrapper')?.classList.add('nmg-map-open');
}
function nmgCloseMap() {
    document.getElementById('nmg-map')?.remove();
    document.querySelector('.phone-wrapper')?.classList.remove('nmg-map-open');
}
function nmgMapGo(id) {
    const p = NMG_MAP.find(x => x.id === id);
    const keys = nmgKeys();
    if (!p) return;
    if (!nmgPlaceOpen(p, keys)) {
        const at = id === 'room' ? 1 : roomUnlockAt(id);
        showAppToast(`🔒 ${p.name()} · ${roomKeysLeftText(Math.max(1, at - keys))}`);
        return;
    }
    nmgCloseMap();
    if (typeof srIsOpen === 'function' && srIsOpen() && typeof closeSecretRoom === 'function') closeSecretRoom();
    if (id === 'hall') { nmGo('home'); return; }
    if (nmView !== 'home') nmGo('home');
    if (id === 'room') { openSecretRoom(); return; }
    if (id === 'roof') { nmhHatchTap(); return; }
    roomOpenPlace(id, { fromHall: true });
}

// ---------- הדמות: Me1 → Me2 → Me3 ----------
function nmgMeSeenKey() { return `weekwise_me_seen_${currentUserId}`; }
function nmgMeSeen() {
    if (typeof roomState !== 'undefined' && roomState && Number(roomState.me_seen) > 0) return Number(roomState.me_seen);
    try { return parseInt(localStorage.getItem(nmgMeSeenKey()), 10) || 1; } catch { return 1; }
}
async function nmgSetMeSeen(n) {
    try { localStorage.setItem(nmgMeSeenKey(), String(n)); } catch {}
    if (typeof roomSave === 'function') await roomSave({ me_seen: n });
}
// הדמות במסדרון מרחפת, והולכים איתה (לפי בקשה מפורשת, 2026-10-16: "אני אלך איתה ממקום למקום באמצעות העכבר/אצבע
// והדלתות שהיא תיגע בהם ממש אעבור לשם כמו מפת עולם"): גוררים אותה, כניסה שהיא נוגעת בה נדלקת, ואחרי רגע (או כשעוזבים
// עליה) נכנסים. נעולה - רק אומרת כמה מפתחות חסרים והדמות נהדפת אחורה. נגיעה בלי לגרור - "הדמות שלי" (כל השלבים)
const NMG_ME_W = 124, NMG_ME_H = 150, NMG_ME_HOME = { x: 195, y: 595 };
let nmgMePos = null;     // מרכז הדמות ביחידות של הציור (390×844); null = המקום שלה על השביל
let nmgMeDragged = false;
function nmgMeScale(y) { return Math.max(0.6, Math.min(1, 0.6 + (y - 380) / 260 * 0.4)); }
function nmgMeClamp(p) { return { x: Math.max(45, Math.min(NMH_W - 45, p.x)), y: Math.max(360, Math.min(650, p.y)) }; }
function nmgMeStyle(p) { return `left:${nmhX(p.x - NMG_ME_W / 2)};top:${nmhY(p.y - NMG_ME_H / 2)};width:${nmhX(NMG_ME_W)};height:${nmhY(NMG_ME_H)};--mes:${nmgMeScale(p.y).toFixed(3)}`; }
function nmgMeHallHtml() {
    const s = nmgShownStage();
    return `<button type="button" class="nmh-me nmg-me-${s.n}" style="${nmgMeStyle(nmgMePos || NMG_ME_HOME)}" onpointerdown="nmgMeDown(event)" onclick="nmgMeClick()" aria-label="${nmEsc(t('nm_me_aria').replace('{name}', 'Me' + s.n))}"><img src="world/${s.img}" alt="" draggable="false"></button>`;
}
function nmgMeClick() { if (nmgMeDragged) { nmgMeDragged = false; return; } nmgOpenMe(); }
// הכניסות שאפשר לגעת בהן: דלתות 1–5 וקשת הפרחים לגג. hit = אזור הכניסה, front = איפה הדמות עומדת כשחוזרים משם
function nmgMeTargets() {
    const keys = typeof roomKeys === 'function' ? roomKeys() : 0;
    const front = ([x, y, w, h]) => nmgMeClamp({ x: x + w / 2, y: y + h + 46 });
    const doors = NMH_DOORS.map(d => ({ sel: `.nmh-door[data-door="${d.n}"]`, hit: d.hit, front: front(d.hit), open: nmhDoorOpen(d.n, keys), go: () => nmhDoorTap(d.n) }));
    const roofOpen = typeof roomUnlockAt === 'function' && keys >= roomUnlockAt('roof');
    return doors.concat([{ sel: '.nmh-hatch-btn', hit: NMH_ROOF.hit, front: front(NMH_ROOF.hit), open: roofOpen, go: () => nmhHatchTap() }]);
}
function nmgMeHit(p, targets) {
    return targets.find(({ hit: [x, y, w, h] }) => p.x > x - 8 && p.x < x + w + 8 && p.y > y - 8 && p.y < y + h + 8) || null;
}
function nmgMeDown(e) {
    if (e.button > 0) return;
    const me = e.currentTarget;
    const hall = me.closest('.nmh');
    if (!hall) return;
    const r = hall.getBoundingClientRect();
    const kx = NMH_W / r.width, ky = NMH_H / r.height;
    const start = nmgMePos || NMG_ME_HOME;
    const x0 = e.clientX, y0 = e.clientY;
    const targets = nmgMeTargets();
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let pos = { ...start }, moved = false, near = null, timer = 0, lastX = x0, bumped = null, lastSpark = 0;
    nmgMeDragged = false;
    try { me.setPointerCapture(e.pointerId); } catch {}
    const glow = tg => {
        hall.querySelectorAll('.is-near').forEach(el => el.classList.remove('is-near'));
        const el = tg && hall.querySelector(tg.sel);
        if (el) el.classList.add('is-near');
    };
    const place = (p, tilt = 0) => { me.style.cssText = `${nmgMeStyle(p)};--tilt:${tilt}deg`; };
    const stop = () => {
        clearTimeout(timer);
        me.removeEventListener('pointermove', move);
        me.removeEventListener('pointerup', up);
        me.removeEventListener('pointercancel', up);
        me.classList.remove('is-flying');
        glow(null);
    };
    // נכנסים: הדמות נבלעת בכניסה, וכשחוזרים למסדרון היא עומדת מולה
    const enter = tg => {
        if (!tg.open) {
            if (bumped === tg) return;
            bumped = tg;
            const door = hall.querySelector(tg.sel);
            if (door) { door.classList.remove('is-bump'); void door.offsetWidth; door.classList.add('is-bump'); }
            tg.go();
            if (!document.querySelector('#new-me-root .nmh-me') || document.querySelector('.nm-sheet-overlay')) { stop(); return; }
            return;
        }
        stop();
        const [x, y, w, h] = tg.hit;
        nmgMePos = tg.front;
        me.classList.add('is-entering');
        place({ x: x + w / 2, y: y + h * 0.6 });
        setTimeout(() => {
            tg.go();
            // החדר / המקום נפתח מעליה; כשחוזרים - היא כבר עומדת מול הכניסה
            setTimeout(() => { me.classList.remove('is-entering'); place(nmgMePos); }, 400);
        }, reduce ? 0 : 420);
    };
    const move = ev => {
        if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
        if (!moved) { moved = true; nmgMeDragged = true; me.classList.add('is-flying'); }
        pos = nmgMeClamp({ x: start.x + (ev.clientX - x0) * kx, y: start.y + (ev.clientY - y0) * ky });
        const tilt = Math.max(-12, Math.min(12, (ev.clientX - lastX) * 1.6));
        lastX = ev.clientX;
        place(pos, tilt);
        if (!reduce && Date.now() - lastSpark > 70) { lastSpark = Date.now(); nmgMeSpark(hall, pos); }
        const tg = nmgMeHit(pos, targets);
        if (tg !== near) {
            near = tg;
            clearTimeout(timer);
            glow(tg);
            if (bumped && bumped !== tg) bumped = null;
            if (tg) timer = setTimeout(() => enter(tg), 450);
        }
    };
    const up = () => {
        if (near) { enter(near); if (!near.open) { stop(); nmgMePushBack(me, pos, near); } return; }
        stop();
        if (moved) { nmgMePos = pos; place(pos); }
    };
    me.addEventListener('pointermove', move);
    me.addEventListener('pointerup', up);
    me.addEventListener('pointercancel', up);
}
// כניסה נעולה: הדמות מתרחקת קצת ממנה
function nmgMePushBack(me, pos, tg) {
    const [x, y, w, h] = tg.hit;
    const away = nmgMeClamp({ x: pos.x + (pos.x < x + w / 2 ? -30 : 30), y: Math.max(pos.y, y + h) + 40 });
    nmgMePos = away;
    me.style.cssText = `${nmgMeStyle(away)};--tilt:0deg`;
}
// אבקת כוכבים קטנה מאחורי הדמות כשהיא עפה
function nmgMeSpark(hall, p) {
    const s = document.createElement('i');
    s.className = 'nmg-spark';
    s.style.left = nmhX(p.x + (Math.random() * 30 - 15));
    s.style.top = nmhY(p.y + 30 + Math.random() * 20);
    hall.appendChild(s);
    setTimeout(() => s.remove(), 900);
}
// "הדמות שלי": שלושת השלבים. כל דמות שכבר הגיעו אליה - נגיעה בוחרת אותה (גם להחזיר דמות קודמת), והמוצגת עם מסגרת
function nmgOpenMe() {
    const keys = nmgKeys();
    const cur = nmgStage(keys);
    const shown = nmgShownStage(keys);
    const ov = nmOpenSheet(`
        <h4>${nmEsc(t('nm_me_title'))}</h4>
        <div class="nmg-me-row">${NMG_STAGES.map(s => {
            const reached = s.n <= cur.n;
            const state = !reached ? 'is-next' : s.n === shown.n ? 'is-now' : 'is-past';
            const body = `<span class="nmg-me-pic"><img src="world/${s.img}" alt=""></span>
                <b>Me${s.n}</b>
                <small>${state === 'is-now' ? nmEsc(t('nm_me_on_screen')) : state === 'is-past' ? nmEsc(t('nm_me_choose')) : nmEsc(t('nm_me_next').replace('{n}', nmFmt(s.at - keys)))}</small>`;
            return reached
                ? `<button type="button" class="nmg-me-card ${state}" data-me-pick="${s.n}" aria-pressed="${state === 'is-now'}">${body}</button>`
                : `<div class="nmg-me-card ${state}">${body}</div>`;
        }).join('')}</div>
        <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('close_btn'))}</button>`, 'nmg-me-sheet');
    ov.querySelectorAll('[data-me-pick]').forEach(b => b.addEventListener('click', async () => {
        const n = Number(b.dataset.mePick);
        if (n === shown.n) return;
        ov.remove();
        await nmgSetMePick(n >= cur.n ? null : n);
    }));
    return ov;
}
async function nmgSetMePick(n) {
    if (typeof roomState !== 'undefined' && roomState) roomState.me_pick = n;
    if (typeof roomSave === 'function') await roomSave({ me_pick: n });
    if (typeof nmView !== 'undefined' && nmView === 'home' && typeof nmRenderView === 'function') nmRenderView(nmRoot());
    const map = document.getElementById('nmg-map');
    if (map) nmgOpenMap();
}
// המהפך: הדמות הקודמת זוהרת, נצנצים מסתחררים, הבזק - והחדשה מופיעה (לפי בקשה מפורשת: "שהוא יעשה כמו מהפך כזה ושממש
// יראו את זה קורה"). פעם אחת לכל שלב (new_me_room.me_seen)
let nmgEvolving = false;
function nmgCheckEvolve() {
    if (nmgEvolving || typeof hasNewMe === 'undefined' || !hasNewMe || !nmProfile || typeof roomLoaded === 'undefined' || !roomLoaded) return;
    // רק כשבאמת בתוך העולם (לא כשארוחה מוחלפת מ"השגרה שלי" וכדומה)
    const sec = document.getElementById('new-me-section');
    if (!(sec && sec.classList.contains('active-tab')) && !(typeof srIsOpen === 'function' && srIsOpen())) return;
    const cur = nmgStage().n, seen = nmgMeSeen();
    if (cur > seen) nmgPlayEvolve(NMG_STAGES[seen - 1] || NMG_STAGES[0], NMG_STAGES[cur - 1]);
    else if (cur < seen) nmgSetMeSeen(cur);
}
function nmgPlayEvolve(from, to) {
    nmgEvolving = true;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ov = document.createElement('div');
    ov.className = 'nmg-evolve';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', t('nm_me_evolved'));
    const sparks = Array.from({ length: 18 }, (_, i) => `<i style="--a:${i * 20}deg;--d:${(i % 6) * 0.12}s"></i>`).join('');
    ov.innerHTML = `
        <div class="nmg-ev-stage">
            <div class="nmg-ev-ring" aria-hidden="true"></div>
            <div class="nmg-ev-sparks" aria-hidden="true">${sparks}</div>
            <img class="nmg-ev-from" src="world/${from.img}" alt="">
            <img class="nmg-ev-to" src="world/${to.img}" alt="">
            <div class="nmg-ev-flash" aria-hidden="true"></div>
        </div>
        <div class="nmg-ev-text"><b>Me${to.n}</b><span>${nmEsc(t('nm_me_evolved'))}</span></div>
        <button type="button" class="nm-btn-primary nmg-ev-go">${nmEsc(t('nm_continue'))}</button>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
    void ov.offsetWidth;
    ov.classList.add('go');
    const done = () => { ov.remove(); nmgEvolving = false; nmgSetMeSeen(to.n); if (roomState && roomState.me_pick) nmgSetMePick(null); if (nmView === 'home' && typeof nmRenderView === 'function') nmRenderView(nmRoot()); };
    ov.querySelector('.nmg-ev-go').addEventListener('click', done);
    if (reduce) ov.classList.add('is-reduced');
    if (typeof spawnGentleConfettiBurst === 'function') setTimeout(() => { if (ov.isConnected) spawnGentleConfettiBurst(ov.querySelector('.nmg-ev-stage'), 36); }, reduce ? 0 : 2300);
}
