// ===== New Me כמשחק (לפי בקשה מפורשת, 2026-10-14) =====
// "אני רוצה שהכפתורים יהיו באותו מקום כל הזמן כמו משחק" - שכבת כפתורים אחת קבועה (#nm-hud) מעל כל העולם: המסדרון, החדר,
// כל המקומות, הגג ומפת העולם. רק הציור שבאמצע מתחלף. הסגנון: 8 "קריסטל" מהקנבס ("סגנון 8 מהמם"), והמשימה הבאה "בדיוק
// ככה רק בצד בקטן". בנוסף: מפת עולם שאפשר ללכת ממנה לכל מקום, והדמות של המשתמש/ת - Me1 (התינוק), אחרי כמה אתגרים Me2,
// ולפני הסוף Me3 - עם מהפך שרואים קורה. הציורים שלה: world/me1.png, me2.png, me3.png, bag.png
// מתי השכבה מוצגת - ב-CSS (#nm-hud מוצג רק כש-New Me במסדרון או כשהחדר / מקום פתוחים); כאן רק התוכן שלה

// מ-2026-10-20 (לפי בקשה מפורשת: "שלא רואים גרסאות ישנות לשום דבר") התמונות של Me הן צילומים של הדמויות שלה בתלת־ממד
// (world/3d/ava-me1–3.png, מהדגמים world/3d/me1–3.glb) - במסדרון, במפה, בכרטיסים של "הדמות שלי" ובמהפך. גם התיק הקסום
// (בכפתור ובמסך התיק) הוא צילום של התיק שלה בתלת־ממד: world/3d/ava-bag.png
const NMG_STAGES = [
    { n: 1, img: '3d/ava-me1.png', at: 0, ratio: 327 / 403 },
    { n: 2, img: '3d/ava-me2.png', at: 4, ratio: 399 / 365 },
    { n: 3, img: '3d/ava-me3.png', at: 9, ratio: 425 / 245 },
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
    // 📓 יומן האתגרים - ספר עם ✓
    chjournal: '<path d="M5 4.5h10.5A3.5 3.5 0 0 1 19 8v12H8.5A3.5 3.5 0 0 1 5 16.5z"/><path d="M5 16.5A3.5 3.5 0 0 1 8.5 13H19"/><path d="m9 7.8 1.9 1.9L14.6 6"/>',
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
    // למטה (2026-10-20, לפי בקשה מפורשת: "מפת העולם שים בתוך התיק ואת התיק שים מצד שמאל ואת המסע שלי מצד ימין"):
    // התיק הקסום לבד למטה (בלי בסיס מתחתיו, רק זוהר), והמסע שלי למעלה מתחת לאתגרים (לפי בקשה מפורשת, 2026-10-20). ✓ אכלתי - במשימה הבאה;
    // מפת העולם, הישגים, תזכורות, הגדרות, קניות, מדידות, תמונות ולוח חודשי - בתוך התיק (בצד נשארו כל היום ואתגרים)
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
        <div class="nmg-rail nmg-rr">${['day', 'challenges', 'journey'].map(k => nmgButton(k, title(k))).join('')}</div>
        <div class="nmg-dock">
            <button type="button" class="nmg-b nmg-it nmg-bagit is-big" data-hud="bag" onclick="nmgGo('bag')" aria-label="${nmEsc(t('nm_backpack'))}"><span class="nmg-bagv"><span class="nmg-plinth"></span><img class="nmg-bag" src="world/3d/ava-bag.png" alt=""></span><span class="nmg-lb">${nmEsc(t('nm_hud_bag'))}</span></button>
        </div>`;
    if (typeof nmg3dFollowSync === 'function') nmg3dFollowSync();
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
// מפת העולם - הראשונה בתיק (2026-10-20, לפי בקשה מפורשת: "מפת העולם שים בתוך התיק")
function nmgBagItems() { return ['world'].concat(nmTiles().filter(k => k !== 'challenges')); }
function nmgBagItemHtml(k, i, cls = '') {
    return `<button type="button" class="nmg-b nmg-bag-item${cls}" data-tile="${k}" style="--i:${i}">
        <span class="nmg-btn">${NMG_SVG.hex}${nmgIcon(k)}</span>
        <span class="nmg-lb">${nmEsc(t(k === 'world' ? 'nm_map_title' : NEW_ME_VIEW_TITLES[k]))}</span>
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
            <div class="nmg-bag-head"><img src="world/3d/ava-bag.png" alt=""><b>${nmEsc(t('nm_hud_bag'))}</b></div>
            <div class="nmg-bag-grid">${nmgBagItems().map((k, i) => nmgBagItemHtml(k, i)).join('')}</div>
            <div class="nmg-bag-foot">${nmgBagItemHtml('settings', nmgBagItems().length, ' is-small')}</div>
        </div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(box);
    document.querySelector('.phone-wrapper')?.classList.add('nmg-bag-open');
    box.querySelectorAll('[data-tile]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.tile;
        nmgCloseBag();
        if (k === 'world') nmgOpenMap();
        else if (k === 'pdf') nmOpenPdf(b);
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
    // 🗺️ מפה מצוירת עם עומק, אם יש שכבות ב-world/map (world3d.js); אחרת - השביל עם המקומות
    if (typeof nmg3dUpgradeMap === 'function') nmg3dUpgradeMap(box, keys);
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
        if (typeof nmg3dMeFace === 'function') nmg3dMeFace(me, ev.clientX - lastX, ev.clientY - (me.__lastY ?? ev.clientY));
        me.__lastY = ev.clientY;
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
            // 💎 לכל Me שנפתח - כפתור קטן לשיתוף הכרטיס שלו (תמונה)
            return reached
                ? `<div class="nmg-me-slot"><button type="button" class="nmg-me-card ${state}" data-me-pick="${s.n}" aria-pressed="${state === 'is-now'}">${body}</button><button type="button" class="nmg-me-share" data-me-share="${s.n}" aria-label="${nmEsc(t('nm_card_share'))} – Me${s.n}" title="${nmEsc(t('nm_card_share'))}">${NMG_SHARE_SVG}</button></div>`
                : `<div class="nmg-me-slot"><div class="nmg-me-card ${state}">${body}</div></div>`;
        }).join('')}</div>
        <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('close_btn'))}</button>`, 'nmg-me-sheet');
    ov.querySelectorAll('[data-me-share]').forEach(b => b.addEventListener('click', async () => {
        if (b.disabled) return;
        b.disabled = true;
        await nmgShareCard(Number(b.dataset.meShare));
        b.disabled = false;
    }));
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

// ⌨️ במחשב: הולכים עם Me בחיצים (או W A S D) - אותה הליכה כמו בגרירה באצבע/בעכבר: הכניסה שהיא מגיעה אליה נדלקת,
// Enter (או לעמוד עליה רגע) נכנס, ונעולה רועדת ומראה כמה מפתחות חסרים (לפי בקשה מפורשת, 2026-10-20: "שאם זה במחשב
// אפשר ללכת עם המקשים")
const NMG_KEY_STEP = 14;
const nmgKey = { near: null, timer: 0, idle: 0, bumped: null };
function nmgKeyEnter(me, hall, tg) {
    clearTimeout(nmgKey.timer);
    hall.querySelectorAll('.is-near').forEach(el => el.classList.remove('is-near'));
    if (!tg.open) {
        if (nmgKey.bumped === tg) return;
        nmgKey.bumped = tg;
        const door = hall.querySelector(tg.sel);
        if (door) { door.classList.remove('is-bump'); void door.offsetWidth; door.classList.add('is-bump'); }
        tg.go();
        return;
    }
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const [x, y, w, h] = tg.hit;
    nmgMePos = tg.front;
    nmgKey.near = null;
    me.classList.remove('is-flying');
    me.classList.add('is-entering');
    me.style.cssText = nmgMeStyle({ x: x + w / 2, y: y + h * 0.6 });
    setTimeout(() => {
        tg.go();
        setTimeout(() => { me.classList.remove('is-entering'); me.style.cssText = nmgMeStyle(nmgMePos); }, 400);
    }, reduce ? 0 : 420);
}
document.addEventListener('keydown', e => {
    const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
    const k = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!dirs[k] && k !== 'Enter') return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // בתוך שדה כתיבה - לא; Enter על כפתור אחר נשאר של הכפתור
    if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    if (k === 'Enter' && e.target && e.target.closest && e.target.closest('button:not(.nmh-me), a')) return;
    const me = document.querySelector('#new-me-root .nmh-me');
    if (!me || !me.offsetParent || document.querySelector('.nm-sheet-overlay, #sr-overlay, #nmg-map, #nmg-bag, .app-tour-layer, .nm1-stage')) return;
    const hall = me.closest('.nmh');
    if (!hall) return;
    if (k === 'Enter') {
        if (!nmgKey.near) return;
        e.preventDefault();
        nmgKeyEnter(me, hall, nmgKey.near);
        return;
    }
    e.preventDefault();
    const [dx, dy] = dirs[k];
    if (typeof nmg3dMeFace === 'function') nmg3dMeFace(me, dx * 10, dy * 10);
    const pos = nmgMeClamp({ x: (nmgMePos || NMG_ME_HOME).x + dx * NMG_KEY_STEP, y: (nmgMePos || NMG_ME_HOME).y + dy * NMG_KEY_STEP });
    nmgMePos = pos;
    me.classList.add('is-flying');
    me.style.cssText = `${nmgMeStyle(pos)};--tilt:${dx * 10}deg`;
    if (!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)) nmgMeSpark(hall, pos);
    clearTimeout(nmgKey.idle);
    nmgKey.idle = setTimeout(() => { me.classList.remove('is-flying'); me.style.cssText = nmgMeStyle(nmgMePos || NMG_ME_HOME); }, 320);
    const tg = nmgMeHit(pos, nmgMeTargets());
    if (tg !== nmgKey.near) {
        nmgKey.near = tg;
        clearTimeout(nmgKey.timer);
        hall.querySelectorAll('.is-near').forEach(el => el.classList.remove('is-near'));
        const el = tg && hall.querySelector(tg.sel);
        if (el) el.classList.add('is-near');
        if (nmgKey.bumped && nmgKey.bumped !== tg) nmgKey.bumped = null;
        if (tg) nmgKey.timer = setTimeout(() => { if (nmgKey.near === tg && document.contains(me)) nmgKeyEnter(me, hall, tg); }, 650);
    }
});


// ---------- ✨ Me1 מלווה את הכניסה ל-New Me ----------
// (לפי בקשה מפורשת, 2026-10-20: "אני רוצה שתכניס אותו לתוך מי שקונה והוא יהיה העוזר שלו לכתוב את הארוחות והכל... שתהיה כניסה
// מרשימה שיראו שהן לא סתם קנו והן עכשיו נכנסות לעולם חדש"). הציורים שלה, גזורים מהרקע: me1-hello (עומד ומחייך ומסביר הכל),
// me1-dreams (כותב בספר - בבחירת הארוחות: "נכתוב ביחד את החלומות ונגשים אותם ביחד"), me1-joy (שמח - כשמסיימים) ו-me1-heart
// (הלב - "נעשה את הדרך הזו ביחד", אחרי הסיור). 1. פתיחה: פורטל של אור נפתח, Me1 עף ממנו ומסביר בכמה נגיעות, ובסוף עף למקום שלו
// בשאלון → 2. בשאלון Me1 ליד כל שאלה (בבחירת הארוחות כותב בספר, ונגיעה בעצה שלו - עוד עצה: "הוא אוהב אורז... זה לא משנה איזה
// מאכל אם אוהבים אותו להשאיר אותו בתפריט ואפשר גם להשתמש באיי איי") → 3. בסוף - Me1 שמח, זיקוקים, ומשם לסיור → 4. אחרי הסיור - הלב.
// Me1 מדבר בלי פעלים בהווה (לא "אני אוהב/ת") - כדי שיתאים בכל שפה; למשתמש/ת - תמיד בלשון שמתאימה לכולם
const NM1_ART = { hello: 'world/me1-hello.webp', dreams: 'world/me1-dreams.webp', joy: 'world/me1-joy.webp', heart: 'world/me1-heart.webp' };
const NM1_INTRO = [['nm_m1_hi_title', 'nm_m1_hi_text'], [null, 'nm_m1_menu_text'], [null, 'nm_m1_day_text'], [null, 'nm_m1_magic_text'], [null, 'nm_m1_ready_text']];
const NM1_STEP_LINES = { agree: 'nm_m1_q_agree', about: 'nm_m1_q_about', plan: 'nm_m1_q_plan', times: 'nm_m1_q_times', menu: 'nm_m1_q_menu', letter: 'nm_m1_q_letter' };
const NM1_TIPS = ['nm_m1_tip_rice', 'nm_m1_tip_love', 'nm_m1_tip_ai'];
const NM1_SEEN_KEY = 'weekwise_nm_me1_intro_seen';
const NM1_HEART_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.4-4.5-9.5-9.1C1 8.4 3.1 5 6.5 5c2.2 0 3.6 1.3 4.5 2.7C12 6.3 13.3 5 15.5 5 18.9 5 21 8.4 19.5 11.9 17.4 16.5 12 21 12 21z"/></svg>';
let nm1JoyPending = false;

function nm1Reduce() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
function nm1Preload() { Object.values(NM1_ART).forEach(src => { const im = new Image(); im.src = src; }); }
// המילים נכנסות אחת אחרי השנייה (Intl.Segmenter מחלק נכון גם סינית, יפנית ותאית - בלי רווחים)
function nm1WordsHtml(text) {
    const s = String(text || '');
    let parts;
    try { parts = Array.from(new Intl.Segmenter(typeof currentLang === 'string' ? currentLang : undefined, { granularity: 'word' }).segment(s), x => x.segment); }
    catch { parts = s.split(/(\s+)/); }
    let i = 0;
    return parts.map(p => (/^\s+$/.test(p) ? p : `<span class="nm1-w" style="--i:${i++}">${nmEsc(p)}</span>`)).join('');
}
function nm1Stars(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;--d:${(Math.random() * 4).toFixed(2)}s;--s:${(1 + Math.random() * 1.8).toFixed(1)}px"></i>`;
    return s;
}
// ✨ נצנצים - כוכבים קטנים של ארבע קרניים שמנצנצים ומסתובבים בכל המסך (לפי בקשה מפורשת, 2026-10-20: "שהכניסה תהיה עם נצנצים כאלה")
function nm1Glitter(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<i style="--x:${(4 + Math.random() * 92).toFixed(1)}%;--y:${(4 + Math.random() * 80).toFixed(1)}%;--z:${(8 + Math.random() * 16).toFixed(0)}px;--d:${(Math.random() * 4).toFixed(2)}s;--t:${(2.2 + Math.random() * 2.4).toFixed(1)}s"></i>`;
    return s;
}
function nm1Motes(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += `<i style="--x:${(Math.random() * 100).toFixed(1)}%;--y:${(30 + Math.random() * 65).toFixed(1)}%;--mx:${(Math.random() * 60 - 30).toFixed(0)}px;--my:${(-40 - Math.random() * 80).toFixed(0)}px;--t:${(5 + Math.random() * 5).toFixed(1)}s;--d:${(Math.random() * 6).toFixed(1)}s"></i>`;
    return s;
}
// מסך מלא אחד לכל הרגעים של Me1 (מעל הכל, גם מעל הכפתורים של המשחק)
function nm1Stage(kind, html) {
    document.querySelectorAll('.nm1-stage').forEach(s => s.remove());
    const wrap = document.querySelector('.phone-wrapper') || document.body;
    const st = document.createElement('div');
    st.className = `nm1-stage nm1-${kind}`;
    st.setAttribute('role', 'dialog');
    st.setAttribute('aria-modal', 'true');
    st.setAttribute('aria-label', 'Me');
    st.setAttribute('dir', document.documentElement.dir || 'rtl');
    st.innerHTML = `<div class="nm1-sky" aria-hidden="true">${nm1Stars(48)}</div><div class="nm1-motes" aria-hidden="true">${nm1Motes(16)}</div><div class="nm1-glitter" aria-hidden="true">${nm1Glitter(26)}</div>${html}`;
    wrap.appendChild(st);
    requestAnimationFrame(() => st.classList.add('on'));
    return st;
}
function nm1Close(st, then) {
    if (!st || st.classList.contains('off')) return;
    st.classList.remove('on');
    st.classList.add('off');
    setTimeout(() => { st.remove(); if (then) then(); }, nm1Reduce() ? 0 : 520);
}
function nm1TalkHtml(titleKey, textKey, btnKey, dots) {
    return `<div class="nm1-talk">
            <div class="nm1-bubble" aria-live="polite"><span class="nm1-name">Me</span><div class="nm1-say">${titleKey ? `<h2 class="nm1-title">${nm1WordsHtml(t(titleKey))}</h2>` : ''}${textKey ? `<p class="nm1-text">${nm1WordsHtml(t(textKey))}</p>` : ''}</div></div>
            <div class="nm1-foot">${dots ? `<div class="nm1-dots" aria-hidden="true">${'<i></i>'.repeat(dots)}</div>` : ''}<button type="button" class="nm1-next${btnKey ? ' is-go' : ''}">${btnKey ? nmEsc(t(btnKey)) : ''}</button></div>
        </div>`;
}
// ניצוצות זהב שמתפזרים מ-Me1 (ברגע של "עולם קסום")
function nm1Burst(st) {
    if (nm1Reduce()) return;
    const me = st.querySelector('.nm1-me');
    if (!me) return;
    const box = document.createElement('div');
    box.className = 'nm1-burst';
    box.setAttribute('aria-hidden', 'true');
    let s = '';
    for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2 + Math.random() * 0.3, d = 90 + Math.random() * 90;
        s += `<i style="--bx:${(Math.cos(a) * d).toFixed(0)}px;--by:${(Math.sin(a) * d).toFixed(0)}px;--bd:${(Math.random() * 0.25).toFixed(2)}s"></i>`;
    }
    box.innerHTML = s;
    me.appendChild(box);
    setTimeout(() => box.remove(), 1800);
}

// 1. הפתיחה - פעם אחת, לקונה חדש/ה (אין עדיין תוכנית) או ל"קנייה" של מנהלת המוצר; בשלב הראשון של השאלון
function nm1MaybeIntro() {
    const q = typeof nmQuiz !== 'undefined' ? nmQuiz : null;
    if (!q || q.step !== 0 || q.menuOnly || q.fromSettings || q.m1Intro || document.querySelector('.nm1-stage')) return;
    if (!q.fresh && nmProfile) return;
    q.m1Intro = true;
    let seen = false;
    try { seen = localStorage.getItem(NM1_SEEN_KEY) === '1'; } catch {}
    if (seen && !q.fresh) return;
    nm1Preload();
    // אחרי הקנייה - קודם החגיגה (זיקוקים); הפתיחה מתחילה כשהיא נסגרת
    const start = () => {
        if (nmQuiz !== q || q.step !== 0) return;
        const cer = document.getElementById('newme-unlock-ceremony');
        if (cer && cer.classList.contains('open')) { setTimeout(start, 350); return; }
        nm1Intro();
    };
    start();
}
function nm1Intro() {
    let i = 0;
    const st = nm1Stage('intro', `
        <button type="button" class="nm1-skip">${nmEsc(t('nm_m1_skip'))}</button>
        <div class="nm1-scene">
            <div class="nm1-portal" aria-hidden="true"><span class="nm1-core"></span><span class="nm1-ring"></span><span class="nm1-ring nm1-ring2"></span></div>
            <p class="nm1-portal-text">${nmEsc(t('nm_m1_portal'))}</p>
            <figure class="nm1-me"><img src="${NM1_ART.hello}" alt="" draggable="false"></figure>
        </div>
        ${nm1TalkHtml(null, null, null, NM1_INTRO.length)}`);
    st.classList.add('is-opening');
    const say = st.querySelector('.nm1-say'), next = st.querySelector('.nm1-next'), me = st.querySelector('.nm1-me');
    const show = () => {
        const [tk, xk] = NM1_INTRO[i];
        const last = i === NM1_INTRO.length - 1;
        say.innerHTML = `${tk ? `<h2 class="nm1-title">${nm1WordsHtml(t(tk))}</h2>` : ''}<p class="nm1-text">${nm1WordsHtml(t(xk))}</p>`;
        say.classList.remove('in');
        void say.offsetWidth;
        say.classList.add('in');
        st.querySelectorAll('.nm1-dots i').forEach((d, k) => d.classList.toggle('on', k <= i));
        next.textContent = t(last ? 'nm_m1_go' : 'nm_continue');
        next.classList.toggle('is-go', last);
        st.dataset.slide = String(i);
        if (i > 0) { me.classList.remove('hop'); void me.offsetWidth; me.classList.add('hop'); }
        if (xk === 'nm_m1_magic_text') nm1Burst(st);
    };
    const talking = () => st.classList.contains('is-talking') && !st.classList.contains('off');
    const finish = () => {
        document.removeEventListener('keydown', onKey, true);
        try { localStorage.setItem(NM1_SEEN_KEY, '1'); } catch {}
        nm1FlyToHelper(st, me);
    };
    const advance = () => { if (!talking()) return; if (i < NM1_INTRO.length - 1) { i++; show(); } else finish(); };
    const onKey = e => {
        if (!st.isConnected) { document.removeEventListener('keydown', onKey, true); return; }
        if (e.key === 'Escape') { e.preventDefault(); finish(); return; }
        if (['Enter', ' ', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !(e.target && e.target.closest && e.target.closest('.nm1-skip'))) { e.preventDefault(); advance(); }
    };
    next.addEventListener('click', e => { e.stopPropagation(); advance(); });
    st.querySelector('.nm1-skip').addEventListener('click', e => { e.stopPropagation(); finish(); });
    st.querySelector('.nm1-scene').addEventListener('click', advance);
    document.addEventListener('keydown', onKey, true);
    // הפורטל נפתח, Me1 עף ממנו (פרץ של ניצוצות כשהוא מגיע) - ואז הבועה
    setTimeout(() => { if (st.isConnected && !st.classList.contains('off')) nm1Burst(st); }, nm1Reduce() ? 0 : 2300);
    setTimeout(() => {
        if (!st.isConnected || st.classList.contains('off')) return;
        st.classList.remove('is-opening');
        st.classList.add('is-talking');
        show();
        try { next.focus({ preventScroll: true }); } catch {}
    }, nm1Reduce() ? 0 : 2400);
}
// בסוף הפתיחה Me1 עף למקום שלו ליד השאלה הראשונה
function nm1FlyToHelper(st, me) {
    const img = me && me.querySelector('img');
    const target = document.querySelector('#new-me-root .nm1-help-me img');
    const tr = target && target.getBoundingClientRect();
    if (nm1Reduce() || !img || !tr || !tr.width) { nm1Close(st); return; }
    const a = img.getBoundingClientRect();
    const fly = document.createElement('img');
    fly.className = 'nm1-fly';
    fly.src = img.src;
    fly.alt = '';
    Object.assign(fly.style, { left: `${a.left}px`, top: `${a.top}px`, width: `${a.width}px`, height: `${a.height}px` });
    document.body.appendChild(fly);
    me.style.visibility = 'hidden';
    target.style.opacity = '0';
    nm1Close(st);
    requestAnimationFrame(() => requestAnimationFrame(() => {
        fly.style.transform = `translate(${(tr.left - a.left).toFixed(1)}px, ${(tr.top - a.top).toFixed(1)}px) scale(${(tr.width / a.width).toFixed(3)}, ${(tr.height / a.height).toFixed(3)})`;
    }));
    setTimeout(() => { fly.remove(); target.style.opacity = ''; }, 820);
}

// 2. Me1 ליד כל שאלה בשאלון. הכניסה שלו רק כשהשלב מתחלף; בחירה באותו שלב = קפיצה קטנה של שמחה
function nm1HelpHtml(q, id) {
    const line = NM1_STEP_LINES[id];
    if (!q || !line) return '';
    const anim = q.m1Step !== id ? ' is-enter' : ' is-hop';
    q.m1Step = id;
    if (id === 'menu') {
        const k = q.m1Tip || 0;
        return `<div class="nm1-help is-dreams${anim}">
            <img class="nm1-help-art" src="${NM1_ART.dreams}" alt="" draggable="false">
            <p class="nm1-help-line">${nmEsc(t(line))}</p>
            <button type="button" class="nm1-tip" onclick="nm1NextTip(this)">
                <span class="nm1-tip-ic" aria-hidden="true">💡</span>
                <span class="nm1-tip-text" aria-live="polite">${nmEsc(t(NM1_TIPS[k]))}</span>
                <span class="nm1-tip-dots" aria-hidden="true">${NM1_TIPS.map((_, j) => `<i${j === k ? ' class="on"' : ''}></i>`).join('')}</span>
            </button>
        </div>`;
    }
    return `<div class="nm1-help${anim}">
            <span class="nm1-help-me"><img src="${NM1_ART.hello}" alt="" draggable="false"></span>
            <p class="nm1-help-bubble">${nmEsc(t(line))}</p>
        </div>`;
}
function nm1NextTip(btn) {
    if (!nmQuiz || !btn) return;
    nmQuiz.m1Tip = ((nmQuiz.m1Tip || 0) + 1) % NM1_TIPS.length;
    const k = nmQuiz.m1Tip;
    btn.querySelector('.nm1-tip-text').textContent = t(NM1_TIPS[k]);
    btn.querySelectorAll('.nm1-tip-dots i').forEach((d, j) => d.classList.toggle('on', j === k));
    btn.classList.remove('flip');
    void btn.offsetWidth;
    btn.classList.add('flip');
}

// 3. סיימו את השאלון - Me1 שמח, וזיקוקים; משם לסיור
function nm1Joy() {
    // הסיור נפתח מכאן (ולא לבד); אם יוצאים לפני שהוא מתחיל - בכניסה הבאה Me1 שואל אם ממשיכים
    try { localStorage.setItem('weekwise_nm_tour_seen', '1'); localStorage.setItem('weekwise_nm_tour_at', 'start'); } catch {}
    const st = nm1Stage('joy', `
        <div class="nm1-scene"><div class="nm1-halo" aria-hidden="true"></div><figure class="nm1-me"><img src="${NM1_ART.joy}" alt="" draggable="false"></figure></div>
        ${nm1TalkHtml('nm_m1_joy_title', 'nm_m1_joy_text', 'nm_m1_joy_btn', 0)}`);
    st.querySelector('.nm1-say').classList.add('in');
    const btn = st.querySelector('.nm1-next');
    btn.addEventListener('click', () => nm1Close(st, () => { if (typeof nmQueueTour === 'function') nmQueueTour(); }));
    setTimeout(() => { try { btn.focus({ preventScroll: true }); } catch {} }, 60);
    if (!nm1Reduce() && typeof spawnGentleConfettiBurst === 'function') {
        const colors = ['#ffd27a', '#c9b6ff', '#a7f3d0', '#fff3c4', '#f7b8ff'];
        setTimeout(() => { if (st.isConnected) spawnGentleConfettiBurst(st, 46, st.clientWidth / 2, st.clientHeight * 0.36, colors); }, 350);
        setTimeout(() => { if (st.isConnected) spawnGentleConfettiBurst(st, 28, st.clientWidth * 0.28, st.clientHeight * 0.3, colors); }, 900);
        setTimeout(() => { if (st.isConnected) spawnGentleConfettiBurst(st, 28, st.clientWidth * 0.72, st.clientHeight * 0.3, colors); }, 1300);
    }
}

// 4. אחרי הסיור - הלב: "נעשה את הדרך הזו ביחד"
function nm1Heart() {
    let hearts = '';
    for (let i = 0; i < 9; i++) hearts += `<i style="--x:${(30 + Math.random() * 40).toFixed(1)}%;--s:${(10 + Math.random() * 12).toFixed(0)}px;--d:${(i * 0.7 + Math.random() * 0.4).toFixed(2)}s;--sx:${(Math.random() * 60 - 30).toFixed(0)}px">${NM1_HEART_SVG}</i>`;
    const st = nm1Stage('heart', `
        <div class="nm1-scene"><div class="nm1-halo is-warm" aria-hidden="true"></div>
            <figure class="nm1-me"><img src="${NM1_ART.heart}" alt="" draggable="false"><span class="nm1-heartglow" aria-hidden="true"></span></figure>
            <div class="nm1-hearts" aria-hidden="true">${hearts}</div></div>
        ${nm1TalkHtml('nm_m1_heart_title', 'nm_m1_heart_text', 'nm_m1_heart_btn', 0)}`);
    st.querySelector('.nm1-say').classList.add('in');
    const btn = st.querySelector('.nm1-next');
    // ההזמנות האחרות (ערכה קסומה, מפתח חדש) מחכות לכניסה הבאה - הכניסה נגמרת ברגע הזה
    btn.addEventListener('click', () => nm1Close(st));
    setTimeout(() => { try { btn.focus({ preventScroll: true }); } catch {} }, 60);
}

// 5. יצאו באמצע (השאלון או הסיור) - Me1 שמח לראות אותך שוב ושואל אם ממשיכים (לפי בקשה מפורשת, 2026-10-20: "זה יחזיר אותה לאותו
// מקום והme1 שואל שנמשיך? בהתלהבות")
function nm1Resume(kind) {
    if (document.querySelector('.nm1-stage')) return;
    const st = nm1Stage('resume', `
        <div class="nm1-scene"><div class="nm1-halo" aria-hidden="true"></div><figure class="nm1-me"><img src="${NM1_ART.joy}" alt="" draggable="false"></figure></div>
        <div class="nm1-talk">
            <div class="nm1-bubble" aria-live="polite"><span class="nm1-name">Me</span><div class="nm1-say in"><h2 class="nm1-title">${nm1WordsHtml(t('nm_m1_resume_title'))}</h2><p class="nm1-text">${nm1WordsHtml(t(kind === 'tour' ? 'nm_m1_resume_tour' : 'nm_m1_resume_quiz'))}</p></div></div>
            <div class="nm1-foot"><button type="button" class="nm1-later">${nmEsc(t(kind === 'tour' ? 'nm_m1_resume_later' : 'nm_m1_resume_restart'))}</button><button type="button" class="nm1-next is-go">${nmEsc(t('nm_m1_resume_yes'))}</button></div>
        </div>`);
    const yes = st.querySelector('.nm1-next'), later = st.querySelector('.nm1-later');
    yes.addEventListener('click', () => nm1Close(st, () => {
        if (kind !== 'tour') return;
        let at = null;
        try { at = localStorage.getItem('weekwise_nm_tour_at'); } catch {}
        if (typeof nmStartTour === 'function') nmStartTour(at && at !== 'start' ? at : null);
    }));
    later.addEventListener('click', () => nm1Close(st, () => {
        if (kind === 'tour') { try { localStorage.removeItem('weekwise_nm_tour_at'); } catch {} return; }
        // להתחיל את השאלון מההתחלה
        const fresh = !!(nmQuiz && nmQuiz.fresh);
        if (typeof nmQuizClearDraft === 'function') nmQuizClearDraft();
        nmStartQuiz(false, fresh);
        nmQuiz.m1Intro = true;
        nmTimes = null;
        nmRenderQuiz(nmRoot());
        if (typeof nmScrollTop === 'function') nmScrollTop();
    }));
    if (!nm1Reduce() && typeof spawnGentleConfettiBurst === 'function') setTimeout(() => { if (st.isConnected) spawnGentleConfettiBurst(st, 30, st.clientWidth / 2, st.clientHeight * 0.36, ['#ffd27a', '#c9b6ff', '#a7f3d0', '#fff3c4', '#f7b8ff']); }, 300);
    setTimeout(() => { try { yes.focus({ preventScroll: true }); } catch {} }, 60);
}


// ---------- 💎 כרטיס Me לשיתוף ----------
// (לפי בקשה מפורשת, 2026-10-20: "לעשות כרטיס לכל ME שנפתח ושיהיה אפשר לשלוח את זה בוואטסאפ שיהיה כמו כרטיס מגנט זכוכית
// שאפשר יהיה להראות לחברים... שאי אפשר יהיה להעתיק רק להראות שיש כמו תמונה כזו שלי עם השם או משהו מעניין"). תמונה (לא קישור
// ולא קובץ של הדמות): הדמות על כרטיס זכוכית בשמי לילה, בצבע של השלב, השם הפרטי, היום במסע והמפתחות, והמשפט של העולם הקסום
const NMG_CARD_HUES = { 1: ['#a7f3d0', '#5eead4'], 2: ['#d8b4fe', '#a78bfa'], 3: ['#fde68a', '#f9a8d4'] };
const NMG_SHARE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
function nmgLoadImg(src) { return new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; }); }
function nmgHexA(hex, a) { const v = parseInt(hex.slice(1), 16); return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${a})`; }
function nmgRoundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
// שורות לפי רוחב (גם בשפות בלי רווחים - Intl.Segmenter), לכל היותר max שורות
function nmgWrapLines(ctx, text, maxW, max) {
    let parts;
    try { parts = Array.from(new Intl.Segmenter(typeof currentLang === 'string' ? currentLang : undefined, { granularity: 'word' }).segment(String(text || '')), x => x.segment); }
    catch { parts = String(text || '').split(/(\s+)/); }
    const lines = [];
    let line = '';
    parts.forEach(p => {
        const next = line + p;
        if (line && ctx.measureText(next.trim()).width > maxW) { lines.push(line.trim()); line = p.trimStart(); }
        else line = next;
    });
    if (line.trim()) lines.push(line.trim());
    return lines.slice(0, max);
}
async function nmgCardImage(n) {
    const stage = NMG_STAGES.find(s => s.n === n) || NMG_STAGES[0];
    const W = 1080, H = 1350;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    try { await document.fonts.ready; } catch { /* בלי */ }
    const font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    ctx.direction = document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr';
    const [c1, c2] = NMG_CARD_HUES[stage.n] || NMG_CARD_HUES[1];
    // שמי הלילה, כוכבים (תמיד אותם כוכבים לכל שלב) והילה בצבע של השלב
    const sky = ctx.createRadialGradient(W / 2, H * 0.36, 60, W / 2, H * 0.46, H * 0.85);
    sky.addColorStop(0, '#3b2572'); sky.addColorStop(0.5, '#1e1142'); sky.addColorStop(1, '#0c0720');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    let seed = 7 + stage.n * 131;
    const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    ctx.fillStyle = '#fff';
    for (let i = 0; i < 150; i++) { ctx.globalAlpha = 0.18 + rnd() * 0.7; ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, 0.7 + rnd() * 1.9, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = 1;
    const aura = ctx.createRadialGradient(W / 2, H * 0.4, 30, W / 2, H * 0.4, 560);
    aura.addColorStop(0, nmgHexA(c1, 0.42)); aura.addColorStop(0.55, nmgHexA(c2, 0.12)); aura.addColorStop(1, nmgHexA(c2, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, W, H);
    // כרטיס הזכוכית: מילוי שקוף, ברק אלכסוני, מסגרת לבנה ופס דק בצבע השלב
    const cx = 100, cy = 96, cw = W - 200, ch = H - 210, r = 76;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 24;
    nmgRoundRect(ctx, cx, cy, cw, ch, r);
    ctx.fillStyle = 'rgba(40, 24, 80, 0.35)';
    ctx.fill();
    ctx.restore();
    ctx.save();
    nmgRoundRect(ctx, cx, cy, cw, ch, r);
    ctx.clip();
    const glass = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    glass.addColorStop(0, 'rgba(255, 255, 255, 0.22)'); glass.addColorStop(0.45, 'rgba(255, 255, 255, 0.06)'); glass.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
    ctx.fillStyle = glass;
    ctx.fillRect(cx, cy, cw, ch);
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(cx, cy + ch * 0.16); ctx.lineTo(cx + cw * 0.5, cy); ctx.lineTo(cx + cw * 0.72, cy); ctx.lineTo(cx, cy + ch * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
    nmgRoundRect(ctx, cx, cy, cw, ch, r);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'; ctx.stroke();
    nmgRoundRect(ctx, cx + 20, cy + 20, cw - 40, ch - 40, r - 16);
    ctx.lineWidth = 2; ctx.strokeStyle = nmgHexA(c1, 0.55); ctx.stroke();
    // הדמות, זוהרת
    const img = await nmgLoadImg(`world/${stage.img}`);
    let y = cy + 70;
    if (img) {
        const maxW = cw * 0.8, maxH = ch * 0.46;
        const s = Math.min(maxW / img.width, maxH / img.height);
        const iw = img.width * s, ih = img.height * s;
        ctx.save();
        ctx.shadowColor = nmgHexA(c1, 0.85); ctx.shadowBlur = 70;
        ctx.drawImage(img, (W - iw) / 2, y + (maxH - ih) / 2, iw, ih);
        ctx.restore();
        y += maxH;
    } else y += ch * 0.46;
    // השם, השלב, השם הפרטי, היום במסע והמפתחות
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.save();
    ctx.shadowColor = nmgHexA(c1, 0.75); ctx.shadowBlur = 34;
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 132px ${font}`;
    ctx.fillText(`Me${stage.n}`, W / 2, y + 140);
    ctx.restore();
    ctx.fillStyle = c1;
    ctx.font = `700 48px ${font}`;
    ctx.fillText(t(`nm_card_stage_${stage.n}`), W / 2, y + 214);
    const first = String((typeof nmProfile !== 'undefined' && nmProfile && nmProfile.cert_name) || '').trim().split(/\s+/)[0];
    let ly = y + 296;
    if (first) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `700 54px ${font}`;
        ctx.fillText(`✦ ${first} ✦`, W / 2, ly);
        ly += 84;
    }
    const stats = `${t('nm_day_n').replace('{n}', nmFmt(nmJourneyDay()))}  ·  🔑 ${nmFmt(nmgKeys())}`;
    ctx.font = `600 40px ${font}`;
    const sw = ctx.measureText(stats).width + 70;
    nmgRoundRect(ctx, (W - sw) / 2, ly - 50, sw, 70, 35);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)'; ctx.stroke();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillText(stats, W / 2, ly - 3);
    // המשפט של העולם הקסום, בתחתית הכרטיס, וקישור עדין לאפליקציה מתחתיו
    ctx.font = `500 36px ${font}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.78)';
    const tag = nmgWrapLines(ctx, t('nm_card_tagline'), cw - 160, 2);
    tag.forEach((line, i) => ctx.fillText(line, W / 2, cy + ch - 70 - (tag.length - 1 - i) * 48));
    ctx.font = `600 30px ${font}`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(typeof SHARE_APP_HOST === 'string' ? SHARE_APP_HOST : 'app.not10.ai', W / 2, H - 48);
    return new Promise(res => { try { canvas.toBlob(b => res(b), 'image/jpeg', 0.92); } catch { res(null); } });
}
async function nmgShareCard(n) {
    const blob = await nmgCardImage(n);
    if (!blob) { showAppToast(t('nm_save_error'), 'error'); return; }
    if (typeof openSharePicker === 'function') openSharePicker(t('nm_card_share_text').replace('{n}', `Me${n}`), { imageBlob: blob, imageName: `me${n}.jpg`, subject: `Me${n}` });
}
