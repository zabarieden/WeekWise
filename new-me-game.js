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
    home: '<path d="M4 11.5L12 4l8 7.5"/><path d="M6.5 10v10h11V10"/><path d="M10 20v-5h4v5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="6.5"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
};
function nmgIcon(k) { return `<svg class="nmg-i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${NMG_ICONS[k]}</svg>`; }
function nmgKeys() { return typeof roomKeys === 'function' && typeof roomLoaded !== 'undefined' && roomLoaded ? roomKeys() : 0; }
function nmgStage(keys = nmgKeys()) { return NMG_STAGES.slice().reverse().find(s => keys >= s.at) || NMG_STAGES[0]; }
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
    hud.innerHTML = `${NMG_SVG.defs}
        <div class="nmg-top">
            <button type="button" class="nmg-b nmg-day" onclick="nmgGo('journey')" aria-label="${nmEsc(t('nm_day_n').replace('{n}', nmFmt(nmJourneyDay())))}">${NMG_SVG.hex}<span class="nmg-dayt"><small>${nmEsc(t('nm_hud_day'))}</small><b>${nmFmt(nmJourneyDay())}</b></span></button>
            <button type="button" class="nmg-b nmg-pill nmg-key" onclick="nmgKeysTip()" aria-label="🔑 ${nmFmt(nmgKeys())}">${NMG_SVG.key}<span>${nmFmt(nmgKeys())}</span></button>
            <span class="nmg-pill nmg-fire" aria-label="🔥 ${nmFmt(st.current)}">${NMG_SVG.fire}<span>${nmFmt(st.current)}</span></span>
            <button type="button" class="nmg-b nmg-pill nmg-en" onclick="nmgGo('day')" aria-label="${nmEsc(t('nm_eaten'))} ${nmFmt(eaten.kcal)} / ${nmFmt(goal)}">${NMG_SVG.bolt}<span class="nmg-track"><span class="nmg-fill" style="width:${pct}%"></span></span><span class="nmg-num"><bdi dir="ltr">${nmFmt(eaten.kcal)} / ${nmFmt(goal)}</bdi></span></button>
        </div>
        <button type="button" class="nmg-b nmg-home" onclick="goHome()" aria-label="${nmEsc(t('back_to_home_btn'))}"><span class="nmg-btn">${NMG_SVG.hex}${nmgIcon('home')}</span></button>
        ${next ? `<button type="button" class="nmg-b nmg-quest" onclick="nmOpenHallMeal('${next}')">
            <span class="nmg-q1">${NMG_SVG.meal}<span>${nmEsc(t('nm_hud_next').replace('{time}', nmSlotReminderTime(next)))}</span></span>
            <span class="nmg-q2">${nmEsc(nmSlotName(next))}: ${nmEsc(nextName)}</span>
            ${nextKcal ? `<span class="nmg-q3"><bdi dir="ltr">~${nmFmt(nextKcal)}</bdi> ${nmEsc(t('calories_unit'))}</span>` : ''}
        </button>` : `<button type="button" class="nmg-b nmg-quest is-done" onclick="nmgGo('day')"><span class="nmg-q2">${nmEsc(t('nm_hall_all_done'))}</span></button>`}
        <div class="nmg-rail nmg-rr">${['day', 'challenges', 'journey', 'shop'].map(k => nmgButton(k, title(k))).join('')}</div>
        <div class="nmg-rail nmg-rl">${['badges', 'measure', 'photos', 'month'].map(k => nmgButton(k, title(k))).join('')}</div>
        <div class="nmg-tray" aria-hidden="true"></div>
        <div class="nmg-dock">
            ${nmgButton('world', t('nm_hud_world'))}
            <button type="button" class="nmg-b nmg-it nmg-bagit" data-hud="bag" onclick="nmgGo('bag')" aria-label="${nmEsc(t('nm_backpack'))}"><span class="nmg-bagv"><span class="nmg-plinth"></span><img class="nmg-bag" src="world/bag.png" alt=""></span><span class="nmg-lb">${nmEsc(t('nm_hud_bag'))}</span></button>
            <button type="button" class="nmg-b nmg-eat${next ? '' : ' is-done'}" data-hud="eat" onclick="nmgEat(this)" aria-label="${nmEsc(next ? `${t('nm_mark_eaten')} – ${nextName}` : t('nm_hall_all_done'))}"><span class="nmg-eatv">${NMG_SVG.hex}<span class="nmg-eatc"><span class="nmg-chk">✓</span><span class="nmg-eatt">${nmEsc(t('nm_hud_ate'))}</span><span class="nmg-bar"><span class="nmg-barf" style="width:${pct}%"></span></span></span></span></button>
            ${nmgButton('reminders', t('nm_hud_reminders'))}
            ${nmgButton('settings', t('nm_hud_settings'))}
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
// כפתור בשכבה: מסך של New Me (החדר / המקום / המפה נסגרים קודם), התיק, או המפה
function nmgGo(view) {
    if (view === 'world') { nmgOpenMap(); return; }
    nmgCloseMap();
    if (typeof srIsOpen === 'function' && srIsOpen() && typeof closeSecretRoom === 'function') closeSecretRoom();
    if (view === 'bag') { nmGo('home'); nmOpenBackpack(); return; }
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
function nmgKeysTip() { if (typeof nmhKeysTip === 'function' && nmView === 'home' && !(typeof srIsOpen === 'function' && srIsOpen())) nmhKeysTip(); else showAppToast(t('nm_keys_tip')); }

// ---------- מפת העולם ----------
function nmgPlaceOpen(p, keys) {
    if (p.id === 'hall') return true;
    if (p.id === 'room') return keys >= 1;
    return typeof roomUnlockAt === 'function' && keys >= roomUnlockAt(p.id);
}
function nmgOpenMap() {
    nmgCloseMap();
    const keys = nmgKeys();
    const stage = nmgStage(keys);
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
// הדמות במסדרון, על השביל (נגיעה - "הדמות שלי": כל התמונות, ומה הבא)
function nmgMeHallHtml() {
    const s = nmgStage();
    return `<button type="button" class="nmh-me nmg-me-${s.n}" style="left:${nmhX(195 - 62)};top:${nmhY(520)};width:${nmhX(124)};height:${nmhY(150)}" onclick="nmgOpenMe()" aria-label="${nmEsc(t('nm_me_aria').replace('{name}', 'Me' + s.n))}"><img src="world/${s.img}" alt=""></button>`;
}
function nmgOpenMe() {
    const keys = nmgKeys();
    const cur = nmgStage(keys);
    const ov = nmOpenSheet(`
        <h4>${nmEsc(t('nm_me_title'))}</h4>
        <div class="nmg-me-row">${NMG_STAGES.map(s => {
            const state = s.n < cur.n ? 'is-past' : s.n === cur.n ? 'is-now' : 'is-next';
            return `<div class="nmg-me-card ${state}">
                <span class="nmg-me-pic"><img src="world/${s.img}" alt=""></span>
                <b>Me${s.n}</b>
                <small>${state === 'is-now' ? nmEsc(t('nm_me_now')) : state === 'is-past' ? '✓' : nmEsc(t('nm_me_next').replace('{n}', nmFmt(s.at - keys)))}</small>
            </div>`;
        }).join('')}</div>
        <button type="button" class="nm-btn-ghost" data-close>${nmEsc(t('close_btn'))}</button>`, 'nmg-me-sheet');
    return ov;
}
// המהפך: הדמות הקודמת זוהרת, נצנצים מסתחררים, הבזק - והחדשה מופיעה (לפי בקשה מפורשת: "שהוא יעשה כמו מהפך כזה ושממש
// יראו את זה קורה"). פעם אחת לכל שלב (new_me_room.me_seen)
let nmgEvolving = false;
function nmgCheckEvolve() {
    if (nmgEvolving || typeof hasNewMe === 'undefined' || !hasNewMe || !nmProfile || typeof roomLoaded === 'undefined' || !roomLoaded) return;
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
    const done = () => { ov.remove(); nmgEvolving = false; nmgSetMeSeen(to.n); if (nmView === 'home' && typeof nmRenderView === 'function') nmRenderView(nmRoot()); };
    ov.querySelector('.nmg-ev-go').addEventListener('click', done);
    if (reduce) ov.classList.add('is-reduced');
    if (typeof spawnGentleConfettiBurst === 'function') setTimeout(() => { if (ov.isConnected) spawnGentleConfettiBurst(ov.querySelector('.nmg-ev-stage'), 36); }, reduce ? 0 : 2300);
}
