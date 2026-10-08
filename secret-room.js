// ===== New Me: החדר הסודי =====
// לפי בקשה מפורשת (2026-10-06): חדר פרטי בתוך New Me - "רק שלך, לא צריך לספר עליו לאף אחד".
// רואים קיר אחד בכל פעם (כמו משחקי חדר בריחה) וחצים מסובבים את החדר. כל אתגר שמסתיים = מפתח,
// וכל מפתח פותח עוד משהו: 1 הדלת, 2 המחשב, 3 המשחק, 4 המדף, 5 גג הכוכבים, 8 הסטודיו, 12 הספרייה.
// המפתח הראשון הוא אתגר קטן: ✓ על ארוחה ב-3 ימים שונים. ניצוץ (הבועה עם העיניים) גר בחדר.
// ברירת המחדל כהה ("לילה נעים"); "בוקר פסטל" ו"עליית גג" (נפתחת עם הסטודיו) - ב"לעצב את החדר".
// מנהלת המוצר (חשבון המפתחים) מקבלת כפתור מפתח בצד: כל לחיצה = "כאילו הסתיים אתגר", והפתיחה
// נראית בדיוק כמו אצל כולם (לפי בקשה מפורשת); "−" סוגר את האחרון כדי לראות את הפתיחה שוב.
// נשמר ב-new_me_room: אילו מפתחות כבר נחשפו, השיחה הראשונה עם ניצוץ, מראה החדר והשיא במשחק.

const ROOM_UNLOCKS = [
    { n: 1, id: 'door', wall: 0 },
    { n: 2, id: 'computer', wall: 0 },
    { n: 3, id: 'game', wall: 2 },
    { n: 4, id: 'shelf', wall: 3 },
    { n: 5, id: 'roof', wall: 3 },
    { n: 8, id: 'studio', map: true },
    { n: 12, id: 'library', map: true },
];
const ROOM_STARTER_DAYS = 3;
const ROOM_WALLS = 4;
const ROOM_GAME_SECONDS = 60;
const ROOM_PUZZLE_PIECES = 12;
const ROOM_STYLES = {
    night: { wallA: '#22143a', wallB: '#3d2858', panelA: '#2b1a40', panelB: '#24152f', line: '#3b2752', trim: '#4a3266', ceil: '#120a1d', ceilLine: '#2a1a3a', floorA: '#3a2416', floorB: '#65412c', base: '#1a0f24', bg: '#140c1e' },
    pastel: { wallA: '#f7d3e3', wallB: '#eeb3cd', panelA: '#e59ec0', panelB: '#d98cb2', line: '#cf7fa8', trim: '#fbe4ee', ceil: '#fbe4ee', ceilLine: '#f3c6d8', floorA: '#d9b48a', floorB: '#c49668', base: '#f7cfe0', bg: '#f3dbe6' },
    attic: { wallA: '#5a3826', wallB: '#8a5a3c', panelA: '#4a2c1e', panelB: '#3e2418', line: '#2e1a10', trim: '#a87a50', ceil: '#2b1a12', ceilLine: '#4a2c1e', floorA: '#4a2c1e', floorB: '#6c442e', base: '#24150e', bg: '#24150e' },
};
const ROOM_WALL_COLORS = ['#3d2858', '#f2bcd4', '#a8c3a0', '#1e2a5a', '#f3e6cf', '#c4b5fd'];
const ROOM_FRIEND_LINES = 6;

const SR_KEY_SVG = '<svg class="sr-key-ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4.5" fill="currentColor"/><rect x="11" y="10.8" width="10" height="2.4" rx="1.2" fill="currentColor"/><rect x="17" y="12" width="2.2" height="4" rx="1" fill="currentColor"/><circle cx="8" cy="12" r="1.6" class="sr-key-hole"/></svg>';
const SR_KEY_OUTLINE_SVG = '<svg class="sr-key-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="8" cy="12" r="4.5"/><path d="M12.5 12H21M18 12v3.5"/></svg>';
const SR_LOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
const SR_CLOSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const SR_BRUSH_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20c4 0 5-2 5-4a3 3 0 0 0-3-3c-2 0-3 1.5-2 7z"/><path d="M9 14l10-10 1 1-10 10"/></svg>';
const SR_HOUSE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>';
const SR_CHEVRON = { next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>', prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>' };

let roomState = null;        // שורת new_me_room (או ברירת מחדל עד השמירה הראשונה)
let roomLoaded = false;
let roomWall = 0;
let roomPreview = null;      // מראה שנבחר ב"לעצב את החדר" ועוד לא נשמר
let roomGame = null;

function srEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function srFmt(n) { try { return Number(n).toLocaleString(currentLang); } catch { return String(n); } }
function srIsRtl() { return document.documentElement.dir === 'rtl'; }
function srStage() { return document.querySelector('#sr-overlay .sr-stage'); }
function srIsOpen() { return !!document.getElementById('sr-overlay'); }

// ---------- מפתחות ----------
function roomUnlockAt(id) { const u = ROOM_UNLOCKS.find(x => x.id === id); return u ? u.n : Infinity; }
function roomIsUnlocked(id) { return roomKeys() >= roomUnlockAt(id); }
// האתגר הקטן הראשון: ימים שונים עם ✓ על ארוחה (מתוך סיכומי המסע של New Me)
function roomStarterDays() {
    const stats = typeof nmStats !== 'undefined' && Array.isArray(nmStats) ? nmStats : [];
    return Math.min(ROOM_STARTER_DAYS, stats.filter(r => Number(r.checks) > 0).length);
}
function roomRealKeys() {
    const starter = roomStarterDays() >= ROOM_STARTER_DAYS ? 1 : 0;
    return starter + (typeof nmChDoneCount === 'function' ? nmChDoneCount() : 0);
}
function roomIsDev() { return typeof isDevSuperuserAccount !== 'undefined' && !!isDevSuperuserAccount; }
function roomDevStoreKey() { return `weekwise_room_dev_keys_${currentUserId}`; }
// המפתחות של כפתור ה-PM נשמרים בחשבון (new_me_room.dev_keys) - אותו מספר בכל מכשיר. לפני כן נשמרו
// רק במכשיר, ובמכשיר אחר הדלת חזרה להיות נעולה; null = עוד לא נשמר → מה שיש במכשיר (ומועבר לחשבון ב-roomLoad)
function roomDevLocalDelta() {
    try { return parseInt(localStorage.getItem(roomDevStoreKey()), 10) || 0; } catch { return 0; }
}
function roomDevDelta() {
    if (!roomIsDev()) return 0;
    if (roomState && roomState.dev_keys != null) return parseInt(roomState.dev_keys, 10) || 0;
    return roomDevLocalDelta();
}
async function roomSetDevDelta(n) {
    try { localStorage.setItem(roomDevStoreKey(), String(n)); } catch {}
    await roomSave({ dev_keys: n });
}
function roomKeys() { return Math.max(0, roomRealKeys() + roomDevDelta()); }
function roomNextUnlock(keys) { return ROOM_UNLOCKS.find(u => u.n > keys) || null; }
function roomItemName(id) { return t('room_item_' + id); }
function roomKeysLeftText(left) { return left === 1 ? t('room_keys_left_one') : t('room_keys_left_many').replace('{n}', srFmt(left)); }

async function roomLoad() {
    if (!supabaseClient || !currentUserId) return;
    const { data } = await supabaseClient.from('new_me_room').select('*').eq('user_id', currentUserId).maybeSingle();
    roomState = data || { keys_seen: 0, style: 'night', wall_color: null, life_score: null, next_step: null, game_best: 0 };
    roomLoaded = true;
    if (roomIsDev() && roomState.dev_keys == null) {
        const local = roomDevLocalDelta();
        if (local) roomSave({ dev_keys: local });
    }
}

async function roomSave(fields) {
    if (!roomState) roomState = { keys_seen: 0, style: 'night' };
    Object.assign(roomState, fields);
    if (!supabaseClient || !currentUserId) return false;
    const { error } = await supabaseClient.from('new_me_room').upsert({ user_id: currentUserId, ...fields, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    return !error;
}

// אחרי כל שינוי במפתחות: המסדרון של New Me (לוח המפתחות והדלת), הקיר הפתוח, וכפתור המפתח של מנהלת המוצר
function roomAfterKeysChange() {
    const sec = document.getElementById('new-me-section');
    if (sec && sec.classList.contains('active-tab') && typeof nmView !== 'undefined' && nmView === 'home' && nmProfile && !nmQuiz) {
        if (document.querySelector('#new-me-root .nmh')) nmRenderView(nmRoot());
    }
    if (srIsOpen()) srRenderWall();
    roomRenderDevKeys();
}

// מפתח חדש (או כמה) שעוד לא נחשף - חגיגת מפתח, ומשם ישר למה שנפתח
async function roomCheckNewKeys() {
    if (typeof hasNewMe === 'undefined' || !hasNewMe || typeof nmProfile === 'undefined' || !nmProfile) return;
    if (!roomLoaded) await roomLoad();
    if (!roomState) return;
    const keys = roomKeys();
    const seen = Number(roomState.keys_seen) || 0;
    if (keys <= seen || document.querySelector('.sr-reveal')) return;
    roomShowKeyReveal(seen, keys);
}

// ---------- כרטיס הדלת במסך של New Me ----------
function roomDoorSvg(open, withLight) {
    return `<svg class="sr-door-art" viewBox="0 0 200 250" aria-hidden="true">
        <defs>
            <linearGradient id="srDoorWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#5a3626"/><stop offset="0.5" stop-color="#7a4b33"/><stop offset="1" stop-color="#5a3626"/></linearGradient>
            <radialGradient id="srDoorKey" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.9"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
            <radialGradient id="srDoorLight" cx="0.5" cy="0.6" r="0.6"><stop offset="0" stop-color="#ffe2a6"/><stop offset="1" stop-color="#ff9ecf" stop-opacity="0.2"/></radialGradient>
        </defs>
        <ellipse cx="100" cy="242" rx="92" ry="9" fill="#ffd27a" opacity="0.22"/>
        <path d="M28 238 V98 A72 72 0 0 1 172 98 V238 Z" fill="#3a2418"/>
        ${open || withLight ? '<path d="M38 238 V102 A62 62 0 0 1 162 102 V238 Z" fill="url(#srDoorLight)"/>' : ''}
        <g class="${open ? 'sr-door-leaf open' : 'sr-door-leaf'}">
            <path d="M38 238 V102 A62 62 0 0 1 162 102 V238 Z" fill="url(#srDoorWood)"/>
            <g stroke="#4a2c1e" stroke-width="2"><line x1="69" y1="52" x2="69" y2="238"/><line x1="100" y1="40" x2="100" y2="238"/><line x1="131" y1="52" x2="131" y2="238"/></g>
            <rect x="38" y="118" width="124" height="7" fill="#2b1a12"/><rect x="38" y="196" width="124" height="7" fill="#2b1a12"/>
            <circle cx="140" cy="158" r="7" fill="#e8b84f"/>
            ${open ? '' : '<circle class="sr-glow" cx="140" cy="178" r="16" fill="url(#srDoorKey)"/><circle cx="140" cy="175" r="3.4" fill="#ffd27a"/><path d="M138.4 176 h3.2 l1.2 7 h-5.6z" fill="#ffd27a"/>'}
        </g>
        <rect x="38" y="234" width="124" height="4" fill="#ffd27a" opacity="0.9"/>
        <circle cx="18" cy="70" r="2" fill="#ffd27a" opacity="0.7"/><circle cx="184" cy="54" r="1.6" fill="#ff9ecf" opacity="0.8"/><circle cx="178" cy="120" r="1.4" fill="#b9a8ff"/><circle cx="12" cy="150" r="1.4" fill="#ff9ecf"/>
    </svg>`;
}

function roomDoorCardHtml() {
    if (!roomLoaded || !roomState) return '';
    const keys = roomKeys();
    const open = keys >= 1;
    const starter = roomStarterDays();
    const slots = ROOM_UNLOCKS.slice(0, 5).map(u => {
        const on = keys >= u.n;
        return `<span class="sr-slot${on ? ' on' : ''}">${on ? SR_KEY_SVG : SR_KEY_OUTLINE_SVG}<span>${srEsc(roomItemName(u.id))}${on ? ' ✓' : ''}</span></span>`;
    }).join('');
    const next = roomNextUnlock(keys);
    const nextLine = open && next ? `<p class="sr-door-next">${srEsc(t('room_next_line').replace('{item}', roomItemName(next.id)).replace('{left}', roomKeysLeftText(next.n - keys)))}</p>` : '';
    const starterHtml = open ? '' : `
        <div class="sr-starter">
            <b>${srEsc(t('room_starter_title'))}</b>
            <span>${srEsc(t('room_starter_hint'))}</span>
            <span class="sr-starter-dots" aria-label="${srEsc(t('room_starter_progress').replace('{n}', srFmt(starter)))}">${Array.from({ length: ROOM_STARTER_DAYS }, (_, i) => `<i class="${i < starter ? 'on' : ''}"></i>`).join('')}</span>
        </div>`;
    return `
        <section class="sr-door-card${open ? ' open' : ''}">
            <button type="button" class="sr-door-info" onclick="roomOpenHowItWorks()" aria-label="${srEsc(t('room_how_title'))}" title="${srEsc(t('room_how_title'))}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 11v6.5"/><circle cx="12" cy="7" r="1.5" fill="currentColor" stroke="none"/></svg></button>
            ${roomDoorSvg(open)}
            <h3>${srEsc(t('room_title'))}</h3>
            <p class="sr-door-tag">${srEsc(t('room_tagline'))}</p>
            ${open ? `<p class="sr-door-keys">${srEsc(t('room_keys_line'))}</p>` : starterHtml}
            <div class="sr-slots">${slots}</div>
            ${nextLine}
            <button type="button" class="sr-enter" onclick="openSecretRoom()" ${open ? '' : 'disabled'}>${open ? srEsc(t('room_enter_btn')) : `${SR_LOCK_SVG}${srEsc(t('room_locked_btn'))}`}</button>
        </section>`;
}

// "איך זה עובד?" - ההסבר על הדלת והמפתחות (לפי בקשה מפורשת: שיהיה מוסבר באפליקציה)
function roomOpenHowItWorks() {
    const rows = ROOM_UNLOCKS.map(u => `<li><span class="sr-how-n">${SR_KEY_SVG}${srFmt(u.n)}</span><span>${srEsc(roomItemName(u.id))}</span></li>`).join('');
    nmOpenSheet(`
        <h4>${srEsc(t('room_how_title'))}</h4>
        <p class="nm-fine">${srEsc(t('room_how_text'))}</p>
        <ul class="sr-how-list">${rows}</ul>
        <p class="nm-fine">${srEsc(t('room_how_private'))}</p>
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'sr-how-sheet');
}

// ---------- חגיגת מפתח ("כאילו הסתיים אתגר" - אותו דבר בדיוק אצל כולם) ----------
function roomShowKeyReveal(from, to) {
    const opened = ROOM_UNLOCKS.filter(u => u.n > from && u.n <= to);
    const next = roomNextUnlock(to);
    const many = to - from > 1;
    const first = from === 0;
    const eyebrow = first ? t('room_reveal_first_eyebrow') : (many ? t('room_reveal_many_eyebrow').replace('{n}', srFmt(to - from)) : t('room_reveal_eyebrow'));
    const title = opened.some(u => u.id === 'door') ? t('room_reveal_door_title') : t('room_reveal_key_title').replace('{n}', srFmt(to));
    const openedHtml = opened.filter(u => u.id !== 'door').map(u => `<li>${SR_KEY_SVG}<span>${srEsc(t('room_reveal_opened').replace('{item}', roomItemName(u.id)))}</span></li>`).join('');
    const nextHtml = !opened.length && next ? `<p class="sr-reveal-next">${srEsc(t('room_next_line').replace('{item}', roomItemName(next.id)).replace('{left}', roomKeysLeftText(next.n - to)))}</p>` : '';
    const ov = document.createElement('div');
    ov.className = 'sr-reveal';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.innerHTML = `
        <div class="sr-reveal-card">
            <div class="sr-reveal-rays" aria-hidden="true"></div>
            <div class="sr-reveal-key" aria-hidden="true">${SR_KEY_SVG}</div>
            <p class="sr-reveal-eyebrow">${srEsc(eyebrow)}</p>
            <h3>${srEsc(title)}</h3>
            ${openedHtml ? `<ul class="sr-reveal-opened">${openedHtml}</ul>` : ''}
            ${nextHtml}
            <button type="button" class="sr-reveal-go">${srEsc(t(opened.length ? (opened.some(u => u.id === 'door') ? 'room_enter_btn' : 'room_reveal_go') : 'room_reveal_enter'))}</button>
            <button type="button" class="sr-reveal-later">${srEsc(t('room_reveal_later'))}</button>
        </div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
    const card = ov.querySelector('.sr-reveal-card');
    if (typeof spawnGentleConfettiBurst === 'function') {
        const gold = ['#ffd27a', '#ffe2a6', '#ff9ecf', '#f6b73c'];
        setTimeout(() => spawnGentleConfettiBurst(card, 34, undefined, undefined, gold), 650);
        setTimeout(() => spawnGentleConfettiBurst(card, 22, undefined, undefined, gold), 1050);
    }
    const seen = roomSave({ keys_seen: to });
    const close = () => { ov.classList.add('closing'); setTimeout(() => ov.remove(), 220); };
    ov.querySelector('.sr-reveal-later').addEventListener('click', async () => { close(); await seen; roomAfterKeysChange(); });
    ov.querySelector('.sr-reveal-go').addEventListener('click', async () => {
        close();
        await seen;
        const target = opened.filter(u => u.id !== 'door').slice(-1)[0];
        if (typeof openNewMe === 'function' && !document.getElementById('new-me-section').classList.contains('active-tab')) openNewMe('home');
        if (opened.some(u => u.id === 'door')) { roomPlayDoorOpening(); return; }
        if (target && target.map) { openSecretRoom({ wall: 0 }); setTimeout(() => roomOpenMap(target.id), 350); return; }
        openSecretRoom(target ? { wall: target.wall, highlight: target.id } : {});
    });
    roomAfterKeysChange();
}

// הדלת נפתחת (מפתח 1) - ואז נכנסים, וניצוץ מציג את עצמו בפעם הראשונה
function roomPlayDoorOpening() {
    const ov = document.createElement('div');
    ov.className = 'sr-door-anim';
    ov.innerHTML = `<div class="sr-door-anim-frame">${roomDoorSvg(false, true)}</div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('go'));
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => {
        openSecretRoom({ wall: 0 });
        ov.classList.add('done');
        setTimeout(() => ov.remove(), 400);
        if (!roomState.talked_at) setTimeout(roomStartFirstTalk, 650);
    }, reduce ? 150 : 1500);
}

// ---------- החדר ----------
function openSecretRoom(opts = {}) {
    if (!roomLoaded || !roomState) { roomLoad().then(() => openSecretRoom(opts)); return; }
    if (roomKeys() < 1) { roomOpenHowItWorks(); return; }
    document.getElementById('sr-overlay')?.remove();
    roomPreview = null;
    roomWall = Number.isInteger(opts.wall) ? opts.wall : roomWall;
    const ov = document.createElement('div');
    ov.id = 'sr-overlay';
    ov.className = 'sr-overlay';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', t('room_title'));
    ov.innerHTML = `
        <div class="sr-stage">
            <div class="sr-scene" id="sr-scene"></div>
            <div class="sr-topfade" aria-hidden="true"></div>
            <button type="button" class="sr-btn sr-close" onclick="closeSecretRoom()" aria-label="${srEsc(t('room_close_aria'))}">${SR_CLOSE_SVG}</button>
            <span class="sr-title">${srEsc(t('room_title'))}</span>
            <div class="sr-tools">
                <button type="button" class="sr-btn" onclick="roomOpenDecor()" aria-label="${srEsc(t('room_decor_title'))}" title="${srEsc(t('room_decor_title'))}">${SR_BRUSH_SVG}</button>
                <button type="button" class="sr-btn" onclick="roomOpenMap()" aria-label="${srEsc(t('room_map_title'))}" title="${srEsc(t('room_map_title'))}">${SR_HOUSE_SVG}</button>
            </div>
            <button type="button" class="sr-arrow sr-arrow-next" onclick="roomTurn(1)" aria-label="${srEsc(t('room_turn_next'))}">${srIsRtl() ? SR_CHEVRON.prev : SR_CHEVRON.next}</button>
            <button type="button" class="sr-arrow sr-arrow-prev" onclick="roomTurn(-1)" aria-label="${srEsc(t('room_turn_prev'))}">${srIsRtl() ? SR_CHEVRON.next : SR_CHEVRON.prev}</button>
            <div class="sr-caption" id="sr-caption" aria-live="polite"></div><!-- מוסתר: רק לקורא מסך -->
            <div class="sr-tip hidden" id="sr-tip" role="status"></div>
        </div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(ov);
    srApplyStyle();
    srRenderWall(opts.highlight || null);
    srBindSwipe(ov.querySelector('.sr-scene'));
    ov.addEventListener('keydown', e => { if (e.key === 'Escape') closeSecretRoom(); });
    roomRenderDevKeys();
    // פוקוס על החדר עצמו (בשביל Escape / קורא מסך) - בלי טבעת פוקוס על כפתור
    ov.tabIndex = -1;
    setTimeout(() => ov.focus({ preventScroll: true }), 50);
}

function closeSecretRoom() {
    roomStopGame();
    if (pcState) { pcStopTimers(); pcState = null; }
    document.getElementById('sr-overlay')?.remove();
    roomRenderDevKeys();
}

function roomTurn(dir) {
    roomWall = (roomWall + dir + ROOM_WALLS) % ROOM_WALLS;
    srRenderWall(null, dir);
}

function srBindSwipe(el) {
    let x0 = null, y0 = null;
    el.addEventListener('touchstart', e => { const p = e.touches[0]; x0 = p.clientX; y0 = p.clientY; }, { passive: true });
    el.addEventListener('touchend', e => {
        if (x0 == null) return;
        const p = e.changedTouches[0];
        const dx = p.clientX - x0, dy = p.clientY - y0;
        x0 = null;
        if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        // מחליקים את החדר: החלקה שמאלה = הקיר הבא (כמו דפדוף), בעברית - הפוך
        const next = dx < 0 ? 1 : -1;
        roomTurn(srIsRtl() ? -next : next);
    }, { passive: true });
}

function srCurrentStyle() {
    const style = (roomPreview && roomPreview.style) || roomState.style || 'night';
    const wallColor = roomPreview ? roomPreview.wall_color : roomState.wall_color;
    return { style: ROOM_STYLES[style] ? style : 'night', wallColor: wallColor || null };
}

function srApplyStyle() {
    const stage = srStage();
    if (!stage) return;
    const { style, wallColor } = srCurrentStyle();
    const s = ROOM_STYLES[style];
    const vars = { '--sr-wall-a': s.wallA, '--sr-wall-b': s.wallB, '--sr-panel-a': s.panelA, '--sr-panel-b': s.panelB, '--sr-line': s.line, '--sr-trim': s.trim, '--sr-ceil': s.ceil, '--sr-ceil-line': s.ceilLine, '--sr-floor-a': s.floorA, '--sr-floor-b': s.floorB, '--sr-base': s.base, '--sr-bg': s.bg };
    if (wallColor) { vars['--sr-wall-a'] = `color-mix(in srgb, ${wallColor} 72%, #000)`; vars['--sr-wall-b'] = wallColor; }
    Object.entries(vars).forEach(([k, v]) => stage.style.setProperty(k, v));
    stage.dataset.style = style;
}

const ROOM_WALL_IDS = ['window', 'board', 'game', 'shelf'];
function srRenderWall(highlight, dir) {
    const scene = document.getElementById('sr-scene');
    if (!scene) return;
    const keys = roomKeys();
    const walls = [srWallWindow, srWallBoard, srWallGame, srWallShelf];
    scene.innerHTML = `<svg class="sr-svg" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" style="direction:${srIsRtl() ? 'rtl' : 'ltr'}" role="group" aria-label="${srEsc(t('room_wall_' + ROOM_WALL_IDS[roomWall] + '_title'))}">${walls[roomWall](keys, highlight)}</svg>`;
    scene.classList.remove('turn-next', 'turn-prev');
    if (dir) { void scene.offsetWidth; scene.classList.add(dir > 0 ? 'turn-next' : 'turn-prev'); }
    // בלי כיתוב על הקיר (לפי בקשה מפורשת: "לא צריך להסביר כל דבר") - רק לקורא מסך, שם הקיר
    const cap = document.getElementById('sr-caption');
    if (cap) cap.textContent = t('room_wall_' + ROOM_WALL_IDS[roomWall] + '_title');
    srHideTip();
    srFitTexts(scene);
    srFitBubbles(scene.querySelector('svg'));
    scene.querySelectorAll('[data-hot]').forEach(el => {
        el.addEventListener('click', () => srHotspot(el.dataset.hot, el));
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); srHotspot(el.dataset.hot, el); } });
    });
    if (highlight) srPlayUnlock(highlight);
}

// טקסט על שלט / פתק שארוך מדי בשפה מסוימת מתכווץ לרוחב שלו (data-fit) - קצר לא נמתח
function srFitTexts(root) {
    if (!root) return;
    root.querySelectorAll('text[data-fit]').forEach(el => {
        const max = Number(el.getAttribute('data-fit'));
        if (!max || typeof el.getComputedTextLength !== 'function') return;
        let len = 0;
        try { len = el.getComputedTextLength(); } catch { return; }
        if (len > max) { el.setAttribute('textLength', String(max)); el.setAttribute('lengthAdjust', 'spacingAndGlyphs'); }
    });
}

// בועות הדיבור במידה של הטקסט (בכל שפה)
function srFitBubbles(svg) {
    if (!svg) return;
    svg.querySelectorAll('.sr-say').forEach(g => {
        const text = g.querySelector('text');
        const rect = g.querySelector('rect');
        if (!text || !rect || typeof text.getComputedTextLength !== 'function') return;
        let len = 0;
        try { len = text.getComputedTextLength(); } catch { return; }
        if (!len) return;
        const w = Math.min(300, Math.max(70, len + 28));
        const cx = Number(text.getAttribute('x'));
        const minX = 8, maxX = 382 - w;
        rect.setAttribute('width', w.toFixed(1));
        rect.setAttribute('x', Math.min(maxX, Math.max(minX, cx - w / 2)).toFixed(1));
    });
}

function srHotspot(id, el) {
    const locked = el && el.classList.contains('locked');
    if (locked) { srShowLockTip(id); return; }
    if (id === 'friend') { srFriendSays(el); return; }
    if (id === 'computer') { roomOpenComputer(); return; }
    if (id === 'game') { roomOpenGame(); return; }
    if (id === 'shelf') { roomOpenShelf(); return; }
    if (id === 'roof') { roomOpenRoof(); return; }
    if (id === 'talk-note') { roomStartFirstTalk(); return; }
    if (id === 'add-challenge') { closeSecretRoom(); if (typeof nmGo === 'function') nmGo('challenges'); return; }
    if (id.startsWith('ch-')) { const key = id.slice(3); if (typeof nmOpenChallenge === 'function') nmOpenChallenge(key); return; }
    if (id === 'trophies') { closeSecretRoom(); if (typeof nmGo === 'function') nmGo('challenges'); }
}

function srShowLockTip(id) {
    const n = roomUnlockAt(id);
    const left = Math.max(1, n - roomKeys());
    srShowTip(`${t('room_locked_tip').replace('{item}', roomItemName(id)).replace('{n}', srFmt(n))} · ${roomKeysLeftText(left)}`);
}

let srTipTimer = null;
function srShowTip(text) {
    const tip = document.getElementById('sr-tip');
    if (!tip) return;
    tip.textContent = text;
    tip.classList.remove('hidden');
    clearTimeout(srTipTimer);
    srTipTimer = setTimeout(srHideTip, 3200);
}
function srHideTip() { const tip = document.getElementById('sr-tip'); if (tip) tip.classList.add('hidden'); }

let srFriendIdx = 0;
function srFriendSays(el) {
    const g = el.closest('svg')?.querySelector('.sr-say');
    if (!g) return;
    srFriendIdx = (srFriendIdx % ROOM_FRIEND_LINES) + 1;
    g.querySelector('text').textContent = t('room_friend_line_' + srFriendIdx);
    srFitBubbles(el.closest('svg'));
    g.classList.remove('pop'); void g.getBoundingClientRect(); g.classList.add('pop');
}

// פתיחת מנעול: המנעול נפתח ונעלם, טבעת זהב והתזזיות - על הדבר שנפתח
function srPlayUnlock(id) {
    const svg = document.querySelector('#sr-scene svg');
    const target = svg && svg.querySelector(`[data-hot="${id}"]`);
    if (!target) return;
    const box = target.getBBox();
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const fx = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    fx.setAttribute('class', 'sr-unlock-fx');
    fx.innerHTML = `
        <circle class="sr-unlock-ring" cx="${cx}" cy="${cy}" r="${Math.max(box.width, box.height) / 2 + 10}" fill="none" stroke="#ffd27a" stroke-width="4"/>
        <g transform="translate(${cx} ${cy})"><g class="sr-unlock-lock">${srLockShape()}</g></g>`;
    svg.appendChild(fx);
    srShowTip(t('room_reveal_opened').replace('{item}', roomItemName(id)));
    const stage = srStage();
    if (stage && typeof spawnGentleConfettiBurst === 'function') {
        const r = target.getBoundingClientRect(), s = stage.getBoundingClientRect();
        setTimeout(() => spawnGentleConfettiBurst(stage, 30, r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, ['#ffd27a', '#ffe2a6', '#ff9ecf', '#b9a8ff']), 900);
    }
    setTimeout(() => fx.remove(), 4200);
}

function srLockShape() {
    return `<circle r="22" fill="rgba(10,6,16,0.78)" stroke="#ffd27a" stroke-opacity="0.7" stroke-width="1.5"/>
        <g transform="translate(-9 -12)" fill="none" stroke="#ffd27a" stroke-width="2.4" stroke-linecap="round">
            <rect x="1" y="10" width="16" height="12" rx="2.5"/>
            <path class="sr-shackle" d="M4.5 10 V6.5 a4.5 4.5 0 0 1 9 0 V10"/>
        </g>`;
}

// מנעול על חפץ נעול - עם "מפתח N" מתחתיו
function srLockBadge(x, y, id) {
    return `<g transform="translate(${x} ${y})" class="sr-lock-badge">${srLockShape()}<text y="38" text-anchor="middle" font-size="11.5" font-weight="800" fill="#ffe2a6">${srEsc(t('room_key_n').replace('{n}', srFmt(roomUnlockAt(id))))}</text></g>`;
}

// ---------- ציורי הקירות (מהעיצובים שאושרו על הקנבס, בצבעי "לעצב את החדר") ----------
function srShell(p, panels, bulbs, rug) {
    const floorLines = '<line x1="0" y1="600" x2="-152" y2="844"/><line x1="56" y1="600" x2="-52" y2="844"/><line x1="112" y1="600" x2="47" y2="844"/><line x1="168" y1="600" x2="147" y2="844"/><line x1="224" y1="600" x2="247" y2="844"/><line x1="280" y1="600" x2="346" y2="844"/><line x1="336" y1="600" x2="446" y2="844"/><line x1="0" y1="622" x2="390" y2="622"/><line x1="0" y1="650" x2="390" y2="650"/><line x1="0" y1="688" x2="390" y2="688"/><line x1="0" y1="736" x2="390" y2="736"/><line x1="0" y1="796" x2="390" y2="796"/>';
    const colors = ['#ffd27a', '#ff9ecf', '#b9a8ff'];
    const bulbHtml = bulbs.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="9" fill="${colors[i % 3]}" opacity="0.2"/><circle cx="${x}" cy="${y}" r="3.2" fill="${colors[i % 3]}" class="sr-bulb"/>`).join('');
    const path = `M0 ${bulbs[0][1] - 4} ` + bulbs.map(([x, y]) => `L${x} ${y}`).join(' ') + ` L390 ${bulbs[bulbs.length - 1][1] - 2}`;
    return `
        <defs>
            <linearGradient id="${p}Wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sr-wall-a)"/><stop offset="1" style="stop-color:var(--sr-wall-b)"/></linearGradient>
            <linearGradient id="${p}Panel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sr-panel-a)"/><stop offset="1" style="stop-color:var(--sr-panel-b)"/></linearGradient>
            <linearGradient id="${p}Floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--sr-floor-a)"/><stop offset="1" style="stop-color:var(--sr-floor-b)"/></linearGradient>
            <radialGradient id="${p}Orb" cx="0.32" cy="0.35" r="0.75"><stop offset="0" stop-color="#ff86c6"/><stop offset="0.55" stop-color="#d45ddb"/><stop offset="1" stop-color="#8b4cf0"/></radialGradient>
            <radialGradient id="${p}Lamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.42"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
            <pattern id="${p}Paper" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M14 9 l3 5 -3 5 -3 -5z" fill="#ffffff" opacity="0.045"/></pattern>
        </defs>
        <rect width="390" height="600" fill="url(#${p}Wall)"/>
        <rect width="390" height="470" fill="url(#${p}Paper)"/>
        <rect width="390" height="86" style="fill:var(--sr-ceil)"/>
        <rect y="84" width="390" height="6" style="fill:var(--sr-ceil-line)"/>
        <rect y="466" width="390" height="134" fill="url(#${p}Panel)"/>
        <rect y="462" width="390" height="6" style="fill:var(--sr-trim)"/>
        <g fill="none" stroke-width="2" style="stroke:var(--sr-line)">${panels}</g>
        <path d="${path}" fill="none" stroke="#6b5a48" stroke-width="1.2"/>
        <g>${bulbHtml}</g>
        <polygon points="0,600 390,600 390,844 0,844" fill="url(#${p}Floor)"/>
        <g stroke="#000" stroke-opacity="0.26" stroke-width="1.2">${floorLines}</g>
        <rect y="592" width="390" height="12" style="fill:var(--sr-base)"/>
        ${rug}`;
}

// ניצוץ + בועת דיבור. faceY - מרכז הבועה; say - הטקסט בבועה
function srFriend(p, cx, cy, r, bubble) {
    const eyeDx = r * 0.31, eyeY = cy + r * 0.12;
    return `
        <ellipse cx="${cx}" cy="${cy + r * 4.4}" rx="${r * 1.05}" ry="${r * 0.24}" fill="#000" opacity="0.26"/>
        <g class="sr-hot sr-friend" data-hot="friend" role="button" tabindex="0" aria-label="${srEsc(t('room_friend_name'))}">
            <g class="sr-float">
                <circle cx="${cx}" cy="${cy}" r="${r * 1.44}" fill="#ff4fa3" opacity="0.14"/>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${p}Orb)"/>
                <ellipse cx="${cx - r * 0.34}" cy="${cy - r * 0.44}" rx="${r * 0.28}" ry="${r * 0.16}" fill="#fff" opacity="0.65"/>
                <ellipse class="sr-eye" cx="${cx - eyeDx}" cy="${eyeY}" rx="${r * 0.144}" ry="${r * 0.2}" fill="#fff"/><ellipse class="sr-eye" cx="${cx + eyeDx}" cy="${eyeY}" rx="${r * 0.144}" ry="${r * 0.2}" fill="#fff"/>
                <circle cx="${cx - eyeDx + 1}" cy="${eyeY + 1.5}" r="${r * 0.08}" fill="#2a1240"/><circle cx="${cx + eyeDx + 1}" cy="${eyeY + 1.5}" r="${r * 0.08}" fill="#2a1240"/>
                <ellipse cx="${cx - r * 0.53}" cy="${cy + r * 0.44}" rx="${r * 0.125}" ry="${r * 0.075}" fill="#ff9ecf" opacity="0.8"/><ellipse cx="${cx + r * 0.53}" cy="${cy + r * 0.44}" rx="${r * 0.125}" ry="${r * 0.075}" fill="#ff9ecf" opacity="0.8"/>
            </g>
        </g>
        <g class="sr-say">
            <rect x="${bubble.x - 60}" y="${bubble.y - 22}" width="120" height="34" rx="15" fill="#fff"/>
            <path d="${bubble.tail}" fill="#fff"/>
            <text x="${bubble.x}" y="${bubble.y}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#2a1240">${srEsc(bubble.text)}</text>
        </g>`;
}

function srWallWindow(keys, highlight) {
    const p = 'srw0';
    const pcOpen = keys >= roomUnlockAt('computer');
    const panels = '<rect x="12" y="482" width="70" height="98" rx="4"/><rect x="94" y="482" width="70" height="98" rx="4"/><rect x="176" y="482" width="70" height="98" rx="4"/><rect x="258" y="482" width="70" height="98" rx="4"/><rect x="340" y="482" width="70" height="98" rx="4"/>';
    const bulbs = [[20, 104], [56, 116], [92, 122], [128, 120], [164, 112], [200, 106], [236, 107], [272, 112], [308, 111], [344, 106], [380, 102]];
    const rug = '<ellipse cx="200" cy="742" rx="164" ry="50" fill="#5f3470" opacity="0.92"/><ellipse cx="200" cy="742" rx="134" ry="38" fill="none" stroke="#e29ad0" stroke-width="2" stroke-dasharray="7 6" opacity="0.8"/><ellipse cx="200" cy="742" rx="92" ry="24" fill="#7d4689"/>';
    return `${srShell(p, panels, bulbs, rug)}
        <defs>
            <linearGradient id="${p}Sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#121a42"/><stop offset="1" stop-color="#3e2c6a"/></linearGradient>
            <linearGradient id="${p}Curtain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e2639f"/><stop offset="1" stop-color="#9a3369"/></linearGradient>
            <linearGradient id="${p}Screen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0c2a28"/><stop offset="1" stop-color="#103a33"/></linearGradient>
            <radialGradient id="${p}Glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#5effc6" stop-opacity="0.30"/><stop offset="1" stop-color="#5effc6" stop-opacity="0"/></radialGradient>
            <radialGradient id="${p}Moon" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff4c9" stop-opacity="0.35"/><stop offset="1" stop-color="#fff4c9" stop-opacity="0"/></radialGradient>
        </defs>
        <line x1="24" y1="140" x2="216" y2="140" stroke="#c9a36b" stroke-width="3.5" stroke-linecap="round"/>
        <rect x="40" y="152" width="160" height="236" rx="8" fill="#e8dcc6"/>
        <rect x="49" y="161" width="142" height="218" fill="url(#${p}Sky)"/>
        <circle cx="160" cy="200" r="34" fill="url(#${p}Moon)"/><circle cx="160" cy="200" r="15" fill="#fff4c9"/><circle cx="166" cy="196" r="13" fill="#2c2560" opacity="0.18"/>
        <g class="sr-twinkle" fill="#fff"><circle cx="70" cy="184" r="1.5"/><circle cx="98" cy="210" r="1.1"/><circle cx="84" cy="244" r="1.3"/><circle cx="178" cy="262" r="1.1"/><circle cx="120" cy="176" r="1"/></g>
        <g fill="#1e1740"><rect x="49" y="318" width="26" height="61"/><rect x="77" y="300" width="20" height="79"/><rect x="99" y="326" width="30" height="53"/><rect x="131" y="294" width="22" height="85"/><rect x="155" y="314" width="36" height="65"/></g>
        <g fill="#ffd27a" opacity="0.85"><rect x="55" y="328" width="4" height="5"/><rect x="64" y="342" width="4" height="5"/><rect x="82" y="310" width="4" height="5"/><rect x="88" y="330" width="4" height="5"/><rect x="106" y="336" width="4" height="5"/><rect x="138" y="304" width="4" height="5"/><rect x="144" y="322" width="4" height="5"/><rect x="162" y="326" width="4" height="5"/><rect x="176" y="340" width="4" height="5"/></g>
        <rect x="117" y="161" width="5" height="218" fill="#e8dcc6"/><rect x="49" y="268" width="142" height="5" fill="#e8dcc6"/>
        <path d="M26 140 C 40 220, 22 300, 36 398 L 54 398 C 46 300, 62 220, 52 140 Z" fill="url(#${p}Curtain)"/>
        <path d="M214 140 C 200 220, 218 300, 204 398 L 186 398 C 194 300, 178 220, 188 140 Z" fill="url(#${p}Curtain)"/>
        <rect x="30" y="296" width="26" height="6" rx="3" fill="#ffd27a"/><rect x="184" y="296" width="26" height="6" rx="3" fill="#ffd27a"/>
        <rect x="32" y="386" width="176" height="12" rx="3" fill="#e8dcc6"/>
        <rect x="58" y="360" width="76" height="26" rx="3" fill="#b07b3a"/><rect x="54" y="355" width="84" height="8" rx="2" fill="#d19a4c"/>
        <path d="M70 355 V332 M84 355 V320 M98 355 V328 M112 355 V316 M124 355 V334" stroke="#6f9a5a" stroke-width="2"/>
        <circle cx="84" cy="318" r="7" fill="#fff"/><circle cx="84" cy="318" r="2.8" fill="#ffd23f"/>
        <circle cx="112" cy="314" r="7" fill="#fff"/><circle cx="112" cy="314" r="2.8" fill="#ffd23f"/>
        <circle cx="98" cy="326" r="7" fill="#fff"/><circle cx="98" cy="326" r="2.8" fill="#ffd23f"/>
        <ellipse cx="70" cy="330" rx="3.2" ry="5.5" fill="#b388e6"/><ellipse cx="124" cy="332" rx="3.2" ry="5.5" fill="#b388e6"/>
        <rect x="160" y="368" width="12" height="18" rx="2" fill="#f3e6cf"/><path class="sr-flame" d="M166 368 q-3 -6 0 -11 q3 5 0 11z" fill="#ffb347"/><circle cx="166" cy="360" r="12" fill="#ffd27a" opacity="0.22"/>
        <rect x="238" y="194" width="118" height="104" rx="6" fill="#6b4630"/>
        <rect x="245" y="201" width="104" height="90" rx="3" fill="#fff1a8"/>
        <text x="297" y="236" text-anchor="middle" font-size="14" font-weight="800" fill="#4a3a10" data-fit="96">${srEsc(t('room_note_a'))}</text>
        <text x="297" y="260" text-anchor="middle" font-size="12.5" fill="#4a3a10" data-fit="96">${srEsc(t('room_note_b'))}</text>
        <circle cx="297" cy="197" r="3" fill="#ff4fa3"/>
        <circle cx="366" cy="390" r="150" fill="url(#${p}Lamp)"/>
        ${pcOpen ? `<circle cx="297" cy="420" r="90" fill="url(#${p}Glow)"/>` : ''}
        <rect x="214" y="486" width="176" height="13" rx="3" fill="#8a5a3c"/>
        <rect x="222" y="499" width="160" height="64" fill="#6c442e"/>
        <rect x="290" y="524" width="26" height="5" rx="2.5" fill="#c99b5b"/>
        <rect x="226" y="563" width="10" height="86" fill="#4f3122"/><rect x="368" y="563" width="10" height="86" fill="#4f3122"/>
        <g class="sr-hot${pcOpen ? '' : ' locked'}" data-hot="computer" role="button" tabindex="0" aria-label="${srEsc(roomItemName('computer'))}">
            <rect x="240" y="370" width="114" height="104" rx="10" fill="#efe4d0"/>
            <rect x="251" y="381" width="92" height="70" rx="6" fill="${pcOpen ? `url(#${p}Screen)` : '#1a1424'}"/>
            ${pcOpen ? `<text x="297" y="406" text-anchor="middle" font-size="11" fill="#7dffcf" data-fit="84">${srEsc(t('room_pc_screen'))}</text>
            <text x="297" y="424" text-anchor="middle" font-size="9" fill="#7dffcf" opacity="0.6" data-fit="84">${srEsc(t('room_pc_screen_sub'))}</text>
            <rect class="sr-blink" x="292" y="432" width="8" height="10" fill="#7dffcf"/>
            <circle class="sr-pulse" cx="297" cy="416" r="10" fill="none" stroke="#7dffcf" stroke-width="2"/>` : ''}
            <rect x="280" y="474" width="34" height="8" fill="#ded1bb"/>
            <polygon points="252,486 342,486 336,478 258,478" fill="#ded1bb"/>
            <g stroke="#bfb19a" stroke-width="1"><line x1="262" y1="481" x2="332" y2="481"/><line x1="266" y1="484" x2="328" y2="484"/></g>
            ${pcOpen ? '' : srLockBadge(297, 412, 'computer')}
        </g>
        <ellipse cx="370" cy="484" rx="13" ry="4" fill="#2e2018"/>
        <path d="M370 482 L364 420 L376 384" fill="none" stroke="#2e2018" stroke-width="3" stroke-linecap="round"/>
        <polygon points="356,386 392,386 384,362 364,362" fill="#ffb85c"/>
        <rect x="268" y="510" width="62" height="58" rx="14" fill="#4b2d6b"/><rect x="275" y="516" width="48" height="44" rx="10" fill="#8d4fb8"/>
        <rect x="258" y="566" width="82" height="14" rx="6" fill="#5b3680"/>
        <rect x="266" y="580" width="7" height="70" fill="#2e1d3e"/><rect x="325" y="580" width="7" height="70" fill="#2e1d3e"/>
        <g transform="translate(22 520)"><rect x="0" y="80" width="40" height="40" rx="6" fill="#c46b4a"/><ellipse cx="20" cy="60" rx="10" ry="26" fill="#3f8a5c" transform="rotate(-20 20 60)"/><ellipse cx="22" cy="54" rx="9" ry="28" fill="#4fa36c" transform="rotate(12 22 54)"/><ellipse cx="14" cy="66" rx="8" ry="20" fill="#5bb87a" transform="rotate(-48 14 66)"/></g>
        ${srFriend(p, 130, 548, 32, { x: 198, y: 493, text: t('room_friend_hi'), tail: 'M160 504 l-8 12 l18 -10z' })}`;
}

// הפתקים על הלוח: הצעד הבא מהשיחה עם ניצוץ + האתגרים הפעילים + "＋ אתגר חדש"
function srBoardNotes() {
    const notes = [];
    if (roomState && roomState.talked_at) {
        notes.push({ hot: 'talk-note', color: '#fff1a8', ink: '#4a3a10', title: t('room_board_my_step'), line: roomState.next_step || '', sub: roomState.life_score ? t('room_board_score').replace('{n}', srFmt(roomState.life_score)) : '' });
    } else {
        notes.push({ hot: 'talk-note', color: '#fff1a8', ink: '#4a3a10', title: t('room_board_talk_title'), line: t('room_board_talk_line'), sub: '' });
    }
    const active = typeof nmChActive === 'function' ? nmChActive() : [];
    const palette = [['#ffd1e8', '#4a1d34'], ['#d4f7d9', '#1d4a26']];
    active.slice(0, 2).forEach((c, i) => {
        const st = typeof nmChState === 'function' ? nmChState(c) : null;
        notes.push({ hot: 'ch-' + c.challenge_key, color: palette[i][0], ink: palette[i][1], title: nmChTitle(c.challenge_key), line: '', sub: st ? t('room_note_day').replace('{d}', srFmt(Math.max(1, st.dayN))).replace('{n}', srFmt(c.days)) : '', progress: st ? Math.min(1, st.done / Math.max(1, st.needed)) : 0 });
    });
    return notes;
}

function srWallBoard(keys) {
    const p = 'srw1';
    const panels = '<rect x="-20" y="482" width="70" height="98" rx="4"/><rect x="62" y="482" width="70" height="98" rx="4"/><rect x="144" y="482" width="70" height="98" rx="4"/><rect x="226" y="482" width="70" height="98" rx="4"/><rect x="308" y="482" width="70" height="98" rx="4"/>';
    const bulbs = [[24, 108], [68, 118], [112, 121], [156, 116], [200, 108], [244, 104], [288, 104], [332, 102], [376, 99]];
    const rug = '<ellipse cx="196" cy="748" rx="150" ry="46" fill="#2f5a6b" opacity="0.85"/><ellipse cx="196" cy="748" rx="120" ry="34" fill="none" stroke="#9ee0e8" stroke-width="2" stroke-dasharray="7 6" opacity="0.6"/>';
    const slots = [{ x: 52, y: 186, w: 120, h: 86, rot: -4, pin: '#ff4fa3' }, { x: 222, y: 184, w: 120, h: 86, rot: 3, pin: '#60a5fa' }, { x: 56, y: 296, w: 120, h: 86, rot: 2, pin: '#ff4fa3' }];
    const notes = srBoardNotes();
    const notesSvg = notes.map((nt, i) => {
        const s = slots[i];
        const cx = s.x + s.w / 2;
        const wrap = srWrapText(nt.line || '', 15);
        return `<g class="sr-hot sr-note" data-hot="${srEsc(nt.hot)}" role="button" tabindex="0" aria-label="${srEsc(nt.title)}" transform="rotate(${s.rot} ${cx} ${s.y + s.h / 2})">
            <rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${nt.color}"/>
            <text x="${cx}" y="${s.y + 22}" text-anchor="middle" font-size="12" font-weight="800" fill="${nt.ink}" data-fit="${s.w - 14}">${srEsc(srClip(nt.title, 18))}</text>
            ${wrap.slice(0, 2).map((ln, j) => `<text x="${cx}" y="${s.y + 42 + j * 15}" text-anchor="middle" font-size="11" fill="${nt.ink}" data-fit="${s.w - 14}">${srEsc(ln)}</text>`).join('')}
            ${nt.progress != null && nt.hot.startsWith('ch-') ? `<rect x="${s.x + 14}" y="${s.y + 44}" width="${s.w - 28}" height="7" rx="3.5" fill="${nt.ink}" opacity="0.18"/><rect x="${s.x + 14}" y="${s.y + 44}" width="${Math.max(7, (s.w - 28) * nt.progress)}" height="7" rx="3.5" fill="${nt.ink}" opacity="0.7"/>` : ''}
            ${nt.sub ? `<text x="${cx}" y="${s.y + s.h - 12}" text-anchor="middle" font-size="10.5" fill="${nt.ink}" opacity="0.85" data-fit="${s.w - 14}">${srEsc(nt.sub)}</text>` : ''}
        </g><circle cx="${cx}" cy="${s.y + 2}" r="4" fill="${s.pin}"/>`;
    }).join('');
    const done = typeof nmChDoneCount === 'function' ? nmChDoneCount() : 0;
    const trophies = [100, 140, 184, 226].map((x, i) => i < done
        ? `<path d="M${x} 470 h22 v10 a11 11 0 0 1 -22 0z" fill="#e8b84f"/><rect x="${x + 8}" y="490" width="6" height="6" fill="#d69a2b"/><rect x="${x + 2}" y="495" width="18" height="5" rx="1.5" fill="#b07b1e"/>`
        : `<path d="M${x} 470 h22 v10 a11 11 0 0 1 -22 0z" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" stroke-dasharray="3 3"/>`).join('');
    return `${srShell(p, panels, bulbs, rug)}
        <defs><pattern id="${p}Cork" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="#9c7246"/><circle cx="5.5" cy="5" r="0.8" fill="#dcb07c"/></pattern></defs>
        <circle cx="195" cy="290" r="210" fill="url(#${p}Lamp)" opacity="0.7"/>
        <rect x="26" y="128" width="338" height="318" rx="10" fill="#6b4630"/>
        <rect x="35" y="137" width="320" height="300" rx="5" fill="#c4955f"/>
        <rect x="35" y="137" width="320" height="300" rx="5" fill="url(#${p}Cork)"/>
        <rect x="120" y="146" width="150" height="26" rx="4" fill="#fbf3e4"/>
        <text x="195" y="164" text-anchor="middle" font-size="13" font-weight="800" fill="#4a2c1e" data-fit="140">${srEsc(t('room_board_sign'))}</text>
        ${notesSvg}
        <!-- המכתב מהעבר לא כאן: הוא יחכה ל"חדר הים" שייפתח אחרי הרבה אתגרים (לפי בקשה מפורשת) -->
        <g class="sr-hot" data-hot="add-challenge" role="button" tabindex="0" aria-label="${srEsc(t('room_board_add'))}" transform="rotate(2 288 340)">
            <rect x="228" y="300" width="120" height="80" rx="4" fill="rgba(255,255,255,0.08)" stroke="#fff7e6" stroke-width="1.6" stroke-dasharray="5 5"/>
            <text x="288" y="346" text-anchor="middle" font-size="12" font-weight="800" fill="#fff7e6" data-fit="108">${srEsc(t('room_board_add'))}</text>
        </g>
        <rect x="58" y="500" width="276" height="10" rx="2" fill="#8a5a3c"/>
        <rect x="64" y="510" width="8" height="14" fill="#6c442e"/><rect x="320" y="510" width="8" height="14" fill="#6c442e"/>
        <g class="sr-hot" data-hot="trophies" role="button" tabindex="0" aria-label="${srEsc(t('room_trophies_aria').replace('{n}', srFmt(done)))}">${trophies}<rect x="96" y="462" width="160" height="40" fill="transparent"/></g>
        <g transform="translate(276 458)"><rect x="6" y="26" width="26" height="16" rx="3" fill="#c46b4a"/><ellipse cx="14" cy="18" rx="6" ry="13" fill="#4fa36c" transform="rotate(-18 14 18)"/><ellipse cx="24" cy="16" rx="6" ry="14" fill="#5bb87a" transform="rotate(16 24 16)"/></g>
        ${srFriend(p, 62, 566, 25, { x: 160, y: 556, text: t('room_friend_board'), tail: 'M100 562 l-10 10 l18 -8z' })}`;
}

function srWallGame(keys) {
    const p = 'srw2';
    const gameOpen = keys >= roomUnlockAt('game');
    const panels = '<rect x="4" y="482" width="70" height="98" rx="4"/><rect x="86" y="482" width="70" height="98" rx="4"/><rect x="168" y="482" width="70" height="98" rx="4"/><rect x="250" y="482" width="70" height="98" rx="4"/><rect x="332" y="482" width="70" height="98" rx="4"/>';
    const bulbs = [[18, 106], [62, 116], [106, 119], [150, 113], [194, 105], [238, 104], [282, 108], [326, 106], [370, 101]];
    const rug = '<ellipse cx="150" cy="742" rx="140" ry="44" fill="#6b3a50" opacity="0.88"/><ellipse cx="150" cy="742" rx="108" ry="32" fill="none" stroke="#ffc4a8" stroke-width="2" stroke-dasharray="7 6" opacity="0.6"/>';
    // הפאזל בחלון: כל מפתח = חתיכה
    const filled = Math.min(ROOM_PUZZLE_PIECES, keys);
    let holes = '';
    for (let i = filled; i < ROOM_PUZZLE_PIECES; i++) {
        const col = i % 4, row = Math.floor(i / 4);
        const x = 42 + col * 36, y = 154 + row * 37.3;
        holes += `<rect x="${x}" y="${y.toFixed(1)}" width="36" height="37.3" fill="#24152f"/><rect x="${x}" y="${y.toFixed(1)}" width="36" height="37.3" fill="none" stroke="#ffd27a" stroke-width="1.3" stroke-dasharray="3 3"/>`;
    }
    return `${srShell(p, panels, bulbs, rug)}
        <defs>
            <linearGradient id="${p}Sunrise" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9ecf"/><stop offset="0.55" stop-color="#ffcf8a"/><stop offset="1" stop-color="#ffe9b0"/></linearGradient>
            <linearGradient id="${p}Cab" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a1d5a"/><stop offset="0.5" stop-color="#3d2a7a"/><stop offset="1" stop-color="#2a1d5a"/></linearGradient>
            <linearGradient id="${p}CabSide" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4fa3"/><stop offset="1" stop-color="#7c3aed"/></linearGradient>
            <radialGradient id="${p}Screen" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#7dd3fc" stop-opacity="0.32"/><stop offset="1" stop-color="#7dd3fc" stop-opacity="0"/></radialGradient>
        </defs>
        <circle cx="360" cy="230" r="170" fill="url(#${p}Lamp)"/>
        <rect x="356" y="236" width="5" height="404" fill="#2e2018"/>
        <ellipse cx="358" cy="640" rx="20" ry="5" fill="#2e2018"/>
        <polygon points="336,236 382,236 372,200 346,200" fill="#ffb85c"/>
        <rect x="34" y="146" width="160" height="128" rx="6" fill="#6b4630"/>
        <rect x="42" y="154" width="144" height="112" fill="url(#${p}Sunrise)"/>
        <circle cx="114" cy="226" r="22" fill="#fff4c9"/>
        <path d="M42 246 Q 80 222 114 240 T 186 236 V266 H42 Z" fill="#c084fc"/>
        <path d="M42 256 Q 96 240 140 254 T 186 252 V266 H42 Z" fill="#7c3aed"/>
        <g stroke="#6b4630" stroke-opacity="0.35" stroke-width="1"><line x1="78" y1="154" x2="78" y2="266"/><line x1="114" y1="154" x2="114" y2="266"/><line x1="150" y1="154" x2="150" y2="266"/><line x1="42" y1="191" x2="186" y2="191"/><line x1="42" y1="228" x2="186" y2="228"/></g>
        ${holes}
        <rect x="60" y="280" width="108" height="20" rx="4" fill="#c9a36b"/>
        <text x="114" y="294" text-anchor="middle" font-size="10" font-weight="800" fill="#4a2c1e" data-fit="100">${srEsc(t('room_puzzle_sign'))}</text>
        <g class="sr-hot${gameOpen ? '' : ' locked'}" data-hot="game" role="button" tabindex="0" aria-label="${srEsc(roomItemName('game'))}">
            ${gameOpen ? `<circle cx="286" cy="262" r="96" fill="url(#${p}Screen)"/>` : ''}
            <polygon points="222,206 350,206 354,640 218,640" fill="url(#${p}Cab)"/>
            <polygon points="222,206 232,206 228,640 218,640" fill="url(#${p}CabSide)" opacity="0.85"/>
            <polygon points="340,206 350,206 354,640 344,640" fill="url(#${p}CabSide)" opacity="0.85"/>
            <rect x="222" y="166" width="128" height="40" rx="6" fill="#1a1238"/>
            <text class="${gameOpen ? 'sr-neon' : ''}" x="286" y="192" text-anchor="middle" font-size="15" font-weight="800" fill="${gameOpen ? '#ff7ab8' : '#5a4a7a'}" data-fit="118">${srEsc(t('room_note_a'))}</text>
            <rect x="240" y="220" width="92" height="82" rx="6" fill="#0b0b1e"/>
            ${gameOpen ? `<g fill="#7dd3fc"><rect x="250" y="284" width="30" height="5"/><rect x="290" y="270" width="30" height="5"/><rect x="262" y="252" width="22" height="5"/></g>
            <g fill="#ffd27a"><circle cx="300" cy="236" r="2"/><circle cx="274" cy="240" r="1.6"/><circle cx="318" cy="252" r="1.6"/></g>
            <circle cx="266" cy="276" r="7" fill="#ff7ab8"/><circle cx="263.5" cy="275" r="1.6" fill="#fff"/><circle cx="268.5" cy="275" r="1.6" fill="#fff"/>
            <text x="320" y="232" text-anchor="middle" font-size="9" fill="#fff">${srFmt(roomState.game_best || 0)}</text>
            <circle class="sr-pulse" cx="286" cy="262" r="10" fill="none" stroke="#7dd3fc" stroke-width="2"/>` : ''}
            <polygon points="228,314 344,314 352,346 220,346" fill="#2a1d5a"/>
            <circle cx="256" cy="326" r="8" fill="#151034"/><rect x="254" y="306" width="4" height="20" rx="2" fill="#d4d4e0"/><circle cx="256" cy="304" r="6" fill="#ff4fa3"/>
            <circle cx="300" cy="330" r="7" fill="#ff4fa3"/><circle cx="322" cy="326" r="7" fill="#22d3ee"/>
            <rect x="268" y="400" width="36" height="46" rx="4" fill="#1a1238"/><rect x="282" y="414" width="8" height="18" rx="2" fill="#ffd27a"/>
            ${gameOpen ? '' : srLockBadge(286, 262, 'game')}
        </g>
        <rect x="36" y="440" width="146" height="128" rx="30" fill="#5b3680"/>
        <rect x="48" y="452" width="122" height="104" rx="22" fill="#8d55b5"/>
        <rect x="22" y="512" width="40" height="92" rx="18" fill="#5b3680"/>
        <rect x="156" y="512" width="40" height="92" rx="18" fill="#5b3680"/>
        <rect x="48" y="556" width="122" height="44" rx="12" fill="#7a46a3"/>
        <path d="M60 470 l10 16 l10 -16 l10 16 l10 -16 l10 16 l10 -16 l10 16 l10 -16 V540 H60 Z" fill="#ff8fc4" opacity="0.85"/>
        <rect x="34" y="604" width="8" height="40" fill="#2e1d3e"/><rect x="176" y="604" width="8" height="40" fill="#2e1d3e"/>
        <rect x="188" y="600" width="28" height="44" rx="4" fill="#4f3122"/>
        <rect x="182" y="590" width="40" height="12" rx="3" fill="#8a5a3c"/>
        <rect x="188" y="574" width="28" height="16" rx="2" fill="#f3e6cf"/><rect x="192" y="578" width="6" height="6" fill="#ff4fa3"/><rect x="201" y="578" width="6" height="6" fill="#22d3ee"/><rect x="210" y="578" width="4" height="6" fill="#ffd27a"/>
        ${srFriend(p, 110, 394, 26, { x: 91, y: 342, text: t(gameOpen ? 'room_friend_game' : 'room_friend_game_locked'), tail: 'M96 352 l4 14 l8 -14z' })}`;
}

function srWallShelf(keys) {
    const p = 'srw3';
    const shelfOpen = keys >= roomUnlockAt('shelf');
    const roofOpen = keys >= roomUnlockAt('roof');
    const panels = '<rect x="176" y="482" width="70" height="98" rx="4"/>';
    const bulbs = [[22, 104], [66, 114], [110, 117], [154, 112], [198, 104], [242, 104], [286, 109], [330, 106], [374, 102]];
    const rug = '<ellipse cx="236" cy="744" rx="150" ry="46" fill="#5f3470" opacity="0.9"/><ellipse cx="236" cy="744" rx="118" ry="34" fill="none" stroke="#e29ad0" stroke-width="2" stroke-dasharray="7 6" opacity="0.75"/>';
    return `${srShell(p, panels, bulbs, rug)}
        <defs>
            <linearGradient id="${p}Door" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4f3324"/><stop offset="0.5" stop-color="#6d4430"/><stop offset="1" stop-color="#4f3324"/></linearGradient>
            <linearGradient id="${p}Shelf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7a4b33"/><stop offset="1" stop-color="#5f3a28"/></linearGradient>
            <linearGradient id="${p}Gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#d69a2b"/></linearGradient>
            <linearGradient id="${p}PhotoA" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#93c5fd"/><stop offset="1" stop-color="#c084fc"/></linearGradient>
            <linearGradient id="${p}PhotoB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fda4af"/><stop offset="1" stop-color="#fcd34d"/></linearGradient>
            <radialGradient id="${p}Port" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#3b3a8a"/><stop offset="1" stop-color="#14123a"/></radialGradient>
            <radialGradient id="${p}Jar" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
            <radialGradient id="${p}RoofLight" cx="0.5" cy="0.4" r="0.6"><stop offset="0" stop-color="#b9a8ff" stop-opacity="0.55"/><stop offset="1" stop-color="#b9a8ff" stop-opacity="0"/></radialGradient>
        </defs>
        <g class="sr-hot${roofOpen ? '' : ' locked'}" data-hot="roof" role="button" tabindex="0" aria-label="${srEsc(roomItemName('roof'))}">
            ${roofOpen ? `<circle cx="106" cy="300" r="140" fill="url(#${p}RoofLight)"/>` : ''}
            <rect x="52" y="150" width="108" height="24" rx="5" fill="#f3e6cf"/>
            <text x="106" y="167" text-anchor="middle" font-size="11.5" font-weight="800" fill="#3e261a" data-fit="100">${srEsc(roomItemName('roof'))}</text>
            <rect x="30" y="184" width="152" height="456" rx="8" fill="#3a2418"/>
            <rect x="40" y="194" width="132" height="446" fill="url(#${p}Door)"/>
            <circle cx="106" cy="252" r="30" fill="#2a1a12"/>
            <circle cx="106" cy="252" r="25" fill="url(#${p}Port)"/>
            <g class="sr-twinkle" fill="#fff"><circle cx="96" cy="244" r="1.6"/><circle cx="114" cy="240" r="1.2"/><circle cx="108" cy="262" r="1.5"/><circle cx="120" cy="256" r="1"/></g>
            <circle cx="100" cy="256" r="1.1" fill="#ffd27a"/>
            <rect x="54" y="300" width="104" height="128" rx="5" fill="none" stroke="#83533b" stroke-width="3"/>
            <rect x="54" y="446" width="104" height="170" rx="5" fill="none" stroke="#83533b" stroke-width="3"/>
            ${roofOpen
        ? `<path d="M80 352 l26 -16 l26 16" fill="none" stroke="#ffd27a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><text x="106" y="384" text-anchor="middle" font-size="10.5" font-weight="800" fill="#ffe2a6" data-fit="96">${srEsc(t('room_roof_open_sign'))}</text>`
        : srLockBadge(106, 366, 'roof')}
            <circle cx="158" cy="470" r="6" fill="#e8b84f"/>
            <rect x="40" y="636" width="132" height="4" fill="#9a8cff" opacity="${roofOpen ? 0.9 : 0.6}"/>
        </g>
        <rect x="188" y="168" width="8" height="10" fill="#c9a36b"/>
        <path d="M192 176 C 178 210, 206 240, 186 280 L 200 286 C 214 246, 190 214, 196 178 Z" fill="#ff8fc4"/>
        <g class="sr-hot${shelfOpen ? '' : ' locked'}" data-hot="shelf" role="button" tabindex="0" aria-label="${srEsc(roomItemName('shelf'))}">
            <rect x="208" y="150" width="166" height="452" rx="6" fill="url(#${p}Shelf)"/>
            <rect x="218" y="160" width="146" height="432" fill="#3b2418"/>
            <g fill="#8a5a3c"><rect x="214" y="246" width="154" height="9"/><rect x="214" y="338" width="154" height="9"/><rect x="214" y="430" width="154" height="9"/><rect x="214" y="522" width="154" height="9"/></g>
            ${shelfOpen ? `<g>
                <rect x="226" y="186" width="13" height="60" rx="2" fill="#ff7ab8"/><rect x="241" y="196" width="11" height="50" rx="2" fill="#93c5fd"/><rect x="254" y="180" width="15" height="66" rx="2" fill="#fcd34d"/><rect x="271" y="192" width="10" height="54" rx="2" fill="#86efac"/>
                <rect x="284" y="200" width="12" height="46" rx="2" fill="#c084fc" transform="rotate(-12 290 246)"/>
                <circle cx="338" cy="232" r="14" fill="url(#${p}Jar)"/>
                <rect x="324" y="206" width="28" height="40" rx="8" fill="#ffffff" opacity="0.18"/><rect x="326" y="200" width="24" height="8" rx="3" fill="#c9a36b"/>
                <g fill="#ffd27a" class="sr-twinkle"><circle cx="332" cy="226" r="2.2"/><circle cx="342" cy="232" r="2"/><circle cx="336" cy="238" r="2.2"/><circle cx="344" cy="222" r="1.6"/></g>
                <rect x="228" y="270" width="52" height="66" rx="3" fill="#f3e6cf"/><rect x="233" y="275" width="42" height="44" fill="url(#${p}PhotoA)"/><path d="M233 319 L248 300 L258 310 L266 302 L275 319 Z" fill="#4c1d95" opacity="0.5"/>
                <rect x="290" y="282" width="44" height="54" rx="3" fill="#f3e6cf"/><rect x="294" y="286" width="36" height="36" fill="url(#${p}PhotoB)"/><circle cx="318" cy="298" r="5" fill="#fff4c9"/>
                <rect x="340" y="296" width="18" height="40" rx="3" fill="#a855f7"/>
                <rect x="226" y="368" width="22" height="62" rx="3" fill="#ff4fa3"/><rect x="250" y="368" width="22" height="62" rx="3" fill="#60a5fa"/><rect x="274" y="368" width="22" height="62" rx="3" fill="#fbbf24"/>
                <g fill="#fff" opacity="0.85"><rect x="231" y="380" width="12" height="3" rx="1.5"/><rect x="255" y="380" width="12" height="3" rx="1.5"/><rect x="279" y="380" width="12" height="3" rx="1.5"/></g>
                <path d="M318 386 h26 v12 a13 13 0 0 1 -26 0z" fill="url(#${p}Gold)"/><rect x="328" y="410" width="6" height="8" fill="#d69a2b"/><rect x="321" y="417" width="20" height="13" rx="2" fill="#b07b1e"/>
                <rect x="230" y="474" width="40" height="48" rx="5" fill="#c46b4a"/>
                <ellipse cx="244" cy="466" rx="8" ry="16" fill="#4fa36c" transform="rotate(-20 244 466)"/><ellipse cx="258" cy="462" rx="8" ry="18" fill="#5bb87a" transform="rotate(14 258 462)"/>
                <rect x="284" y="486" width="70" height="36" rx="4" fill="#5b3680"/><rect x="290" y="492" width="58" height="24" rx="3" fill="none" stroke="#c9a2ff" stroke-width="1.5"/>
                <text x="319" y="508" text-anchor="middle" font-size="9" fill="#e9d5ff" data-fit="54">${srEsc(t('room_shelf_memories'))}</text>
            </g>` : `<g fill="#2a190f"><rect x="226" y="196" width="60" height="50" rx="3"/><rect x="300" y="210" width="50" height="36" rx="3"/><rect x="230" y="290" width="104" height="46" rx="3"/><rect x="226" y="380" width="70" height="50" rx="3"/><rect x="232" y="470" width="110" height="52" rx="3"/></g>
            ${srLockBadge(291, 376, 'shelf')}`}
            <rect x="226" y="548" width="138" height="44" rx="4" fill="#4a2c1e"/><rect x="290" y="566" width="12" height="5" rx="2.5" fill="#c99b5b"/>
        </g>
        <ellipse cx="320" cy="660" rx="44" ry="18" fill="#ff8fc4" opacity="0.9"/><ellipse cx="320" cy="652" rx="40" ry="12" fill="#ffb3d6"/>
        ${srFriend(p, 196, 560, 23, { x: 201, y: 509, text: t(roofOpen ? 'room_friend_roof' : 'room_friend_door'), tail: 'M190 518 l4 12 l8 -12z' })}`;
}

function srClip(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }
function srWrapText(s, n) {
    const words = String(s || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    words.forEach(w => { if ((cur + ' ' + w).trim().length > n && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); });
    if (cur) lines.push(cur);
    if (lines.length > 2) lines[1] = srClip(lines.slice(1).join(' '), n);
    return lines;
}

// ---------- השיחה הראשונה עם ניצוץ ----------
function roomStartFirstTalk() {
    const stage = srStage();
    if (!stage) return;
    stage.querySelector('.sr-talk')?.remove();
    const panel = document.createElement('div');
    panel.className = 'sr-talk';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('room_talk_aria'));
    const score = roomState.life_score || null;
    panel.innerHTML = `
        <div class="sr-talk-head"><span class="sr-talk-orb" aria-hidden="true"></span><b>${srEsc(t('room_friend_name'))}</b><button type="button" class="sr-talk-x" aria-label="${srEsc(t('close_btn'))}">${SR_CLOSE_SVG}</button></div>
        <div class="sr-talk-body">
            <div class="sr-msg">${srEsc(t('room_talk_hi'))}</div>
            <div class="sr-msg">${srEsc(t('room_talk_q1'))}</div>
            <div class="sr-scale" role="radiogroup" aria-label="${srEsc(t('room_talk_q1'))}">${Array.from({ length: 10 }, (_, i) => `<button type="button" role="radio" aria-checked="${score === i + 1}" class="${score === i + 1 ? 'on' : ''}${i === 9 ? ' ten' : ''}" data-score="${i + 1}">${srFmt(i + 1)}</button>`).join('')}</div>
            <div class="sr-talk-step${score ? '' : ' hidden'}">
                <div class="sr-msg">${srEsc(t('room_talk_q2'))}</div>
                <textarea class="sr-talk-input" rows="2" maxlength="300" placeholder="${srEsc(t('room_talk_placeholder'))}">${srEsc(roomState.next_step || '')}</textarea>
                <button type="button" class="sr-talk-save">${srEsc(t('room_talk_save'))}</button>
            </div>
            <button type="button" class="sr-talk-later">${srEsc(t('room_reveal_later'))}</button>
        </div>`;
    stage.appendChild(panel);
    let picked = score;
    const close = () => { panel.classList.add('closing'); setTimeout(() => panel.remove(), 200); };
    panel.querySelector('.sr-talk-x').addEventListener('click', close);
    panel.querySelector('.sr-talk-later').addEventListener('click', close);
    panel.querySelectorAll('[data-score]').forEach(b => b.addEventListener('click', () => {
        picked = Number(b.dataset.score);
        panel.querySelectorAll('[data-score]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
        const step = panel.querySelector('.sr-talk-step');
        step.classList.remove('hidden');
        setTimeout(() => step.querySelector('textarea').focus(), 60);
    }));
    panel.querySelector('.sr-talk-save').addEventListener('click', async () => {
        const text = panel.querySelector('.sr-talk-input').value.trim().slice(0, 300);
        if (!picked) return;
        const ok = await roomSave({ life_score: picked, next_step: text || null, talked_at: new Date().toISOString() });
        if (!ok) { showAppToast(t('nm_save_error'), 'error'); return; }
        close();
        roomWall = 1;
        srRenderWall('talk-note', 1);
        srShowTip(t('room_talk_thanks'));
    });
}

// ---------- המחשב (מפתח 2): שיחה בעץ ----------
// שלושה מסלולים לפי התסריטים שנשלחו - יום טוב / עמוס / קשה - כל אחד עם ענפים, ובסוף משימה קטנה 🎯.
// בכל שלב: "↩ חזרה" (צעד אחורה, לענות אחרת) ו"שיחה חדשה". אחרי יום עמוס / קשה, מי שחוזר למחשב באותו
// יום מקבל "חזרתי..." עם תסריט ההמשך. נשמרות רק הבחירות (לא מה שנכתב), רק במכשיר הזה ועד סוף היום.
// צומת: say = שורות המחשב, ואז אחד מ: opts ([תשובה, הצומת הבא]), task (משימה קטנה → next),
// write (כתיבה חופשית → next; בלי שורות → empty), breathe (5 נשימות → next), when (באיזו שעה + תזכורת → next),
// go (ממשיך לבד), end (סוף השיחה)
const PCX = {
    welcome: { say: ['pcx_back_hi'] },
    root: { say: ['pcx_hi'], opts: [['pcx_o_good', 'a'], ['pcx_o_busy', 'b'], ['pcx_o_hard', 'c']] },
    // 🟢 יום טוב
    a: { say: ['pcx_a_q'], opts: [['pcx_a_o1', 'a1'], ['pcx_a_o2', 'a2'], ['pcx_a_o3', 'a3']] },
    a1: { say: ['pcx_a1_q'], opts: [['pcx_a1_o1', 'a1a'], ['pcx_a1_o2', 'a1b'], ['pcx_a1_o3', 'a1c']] },
    a1a: { say: ['pcx_a1a_q'], opts: [['pcx_a1a_r1', 'a1a_t'], ['pcx_a1a_r2', 'a1a_t']] },
    a1a_t: { say: ['pcx_a1a_s'], task: 'a1a', next: 'a_end' },
    a1b: { say: ['pcx_a1b_q'], opts: [['pcx_a1b_r1', 'a1b_t'], ['pcx_a1b_r2', 'a1b_t']] },
    a1b_t: { say: ['pcx_a1b_s'], task: 'a1b', next: 'a_end' },
    a1c: { say: ['pcx_a1c_q'], opts: [['pcx_a1c_r1', 'a1c_t1'], ['pcx_a1c_r2', 'a1c_t2']] },
    a1c_t1: { say: ['pcx_a1c_s1'], task: 'a1c', next: 'a_end' },
    a1c_t2: { say: ['pcx_a1c_s2'], task: 'a1c', next: 'a_end' },
    a2: { say: ['pcx_a2_q'], opts: [['pcx_a2_o1', 'a2a'], ['pcx_a2_o2', 'a2b']] },
    a2a: { say: ['pcx_a2a_q'], opts: [['pcx_a2a_r1', 'a2a_t'], ['pcx_a2a_r2', 'a2a_t']] },
    a2a_t: { say: ['pcx_a2a_s'], task: 'a2a', next: 'a_end' },
    a2b: { say: ['pcx_a2b_q'], opts: [['pcx_a2b_r1', 'a2b_t'], ['pcx_a2b_r2', 'a2b_t']] },
    a2b_t: { say: ['pcx_a2b_s'], task: 'a2b', next: 'a_end' },
    a3: { say: ['pcx_a3_q'], opts: [['pcx_a3_o1', 'a3a'], ['pcx_a3_o2', 'a3b']] },
    a3a: { say: ['pcx_a3a_q'], opts: [['pcx_a3a_r1', 'a3a_t'], ['pcx_a3a_r2', 'a3a_t']] },
    a3a_t: { say: ['pcx_a3a_s'], task: 'a3a', next: 'a_end' },
    a3b: { say: ['pcx_a3b_q'], opts: [['pcx_a3b_r1', 'a3b_t'], ['pcx_a3b_r2', 'a3b_t']] },
    a3b_t: { say: ['pcx_a3b_s'], task: 'a3b', next: 'a_end' },
    a_end: { say: ['pcx_a_end'], end: true },
    // 🟡 יום עמוס
    b: { say: ['pcx_b_q'], opts: [['pcx_b_o1', 'b1'], ['pcx_b_o2', 'b2'], ['pcx_b_o3', 'b3']] },
    b1: { say: ['pcx_b1_q'], opts: [['pcx_b1_o1', 'b1a'], ['pcx_b1_o2', 'b1b']] },
    b1a: { say: ['pcx_b1a_q'], opts: [['pcx_b1a_r1', 'b1a_t'], ['pcx_b1a_r2', 'b1a_t']] },
    b1a_t: { say: ['pcx_b1a_s'], task: 'b1a', next: 'b_end' },
    b1b: { say: ['pcx_b1b_q'], opts: [['pcx_b1b_r1', 'b1b_t'], ['pcx_b1b_r2', 'b1b_t']] },
    b1b_t: { say: ['pcx_b1b_s'], task: 'b1b', next: 'b_end' },
    b2: { say: ['pcx_b2_q'], opts: [['pcx_b2_o1', 'b2a'], ['pcx_b2_o2', 'b2b']] },
    b2a: { say: ['pcx_b2a_q'], opts: [['pcx_b2a_r1', 'b2a_t'], ['pcx_b2a_r2', 'b2a_t']] },
    b2a_t: { say: ['pcx_b2a_s'], task: 'b2a', next: 'b_end' },
    b2b: { say: ['pcx_b2b_q'], opts: [['pcx_b2b_r1', 'b2b_t']] },
    b2b_t: { say: ['pcx_b2b_s'], task: 'b2b', next: 'b2b_ask' },
    b2b_ask: { say: ['pcx_b2b_ask'], opts: [['pcx_b2b_yes', 'b2b_w'], ['pcx_b2b_no', 'b_end']] },
    b2b_w: { write: 'dump', next: 'b2b_wd', empty: 'b_end' },
    b2b_wd: { say: ['pcx_dump_done_s'], go: 'b_end' },
    b3: { say: ['pcx_b3_q'], opts: [['pcx_b3_o1', 'b3a'], ['pcx_b3_o2', 'b3b']] },
    b3a: { say: ['pcx_b3a_q'], opts: [['pcx_b3a_r1', 'b3a_t'], ['pcx_b3a_r2', 'b3a_t']] },
    b3a_t: { say: ['pcx_b3a_s'], task: 'b3a', next: 'b3a_when' },
    b3a_when: { say: ['pcx_b3a_ask'], when: true, next: 'b_end' },
    b3b: { say: ['pcx_b3b_q'], opts: [['pcx_b3b_r1', 'b3b_t']] },
    b3b_t: { say: ['pcx_b3b_s'], task: 'b3b', next: 'b_end' },
    b_end: { say: ['pcx_b_end1', 'pcx_b_end2'], end: true },
    // 🟡 חוזרים אחרי יום עמוס
    br: { say: ['pcx_br_q'], opts: [['pcx_br_o1', 'br1'], ['pcx_br_o2', 'br2'], ['pcx_br_o3', 'br3']] },
    br1: { say: ['pcx_br1_q'], opts: [['pcx_br1_r1', 'br1_t1'], ['pcx_br1_r2', 'br1_t2']] },
    br1_t1: { say: ['pcx_br1_s1'], task: 'br1', next: 'here_end' },
    br1_t2: { say: ['pcx_br1_s2'], task: 'br1', next: 'here_end' },
    br2: { say: ['pcx_br2_q'], opts: [['pcx_br2_r1', 'br2_t']] },
    br2_t: { say: ['pcx_br2_s'], task: 'br2', next: 'here_end' },
    br3: { say: ['pcx_br3_q'], opts: [['pcx_br3_r1', 'br3_t']] },
    br3_t: { say: ['pcx_br3_s'], task: 'br3', next: 'here_end' },
    // 🔴 יום קשה
    c: { say: ['pcx_c_q'], opts: [['pcx_c_o1', 'c1'], ['pcx_c_o2', 'c2'], ['pcx_c_o3', 'c3'], ['pcx_c_o4', 'c4']] },
    c1: { say: ['pcx_c1_q'], opts: [['pcx_c1_o1', 'c1a'], ['pcx_c1_o2', 'c1b']] },
    c1a: { say: ['pcx_c1a_q'], opts: [['pcx_c1a_r1', 'c1a_t'], ['pcx_c1a_r2', 'c1a_t']] },
    c1a_t: { say: ['pcx_c1a_s'], task: 'c1a', next: 'c_end' },
    c1b: { say: ['pcx_c1b_q'], opts: [['pcx_c1b_r1', 'c1b_t']] },
    c1b_t: { say: ['pcx_c1b_s'], task: 'c1b', next: 'c_end' },
    c2: { say: ['pcx_c2_q'], opts: [['pcx_c2_o1', 'c2a'], ['pcx_c2_o2', 'c2b']] },
    c2a: { say: ['pcx_c2a_q'], opts: [['pcx_c2a_r1', 'c2a_w'], ['pcx_c2a_r2', 'c2a_t']] },
    c2a_w: { write: 'vent', next: 'c2a_wt', empty: 'c2a_t' },
    c2a_wt: { say: ['pcx_vent_s'], task: 'c2a', next: 'c_end' },
    c2a_t: { say: ['pcx_c2a_s'], task: 'c2a', next: 'c_end' },
    c2b: { say: ['pcx_c2b_q'], opts: [['pcx_c2b_r1', 'c2b_t']] },
    c2b_t: { say: ['pcx_c2b_s'], task: 'c2b', next: 'c_end' },
    c3: { say: ['pcx_c3_q'], opts: [['pcx_c3_o1', 'c3a'], ['pcx_c3_o2', 'c3b']] },
    c3a: { say: ['pcx_c3a_q'], opts: [['pcx_c3a_r1', 'c3a_t']] },
    c3a_t: { say: ['pcx_c3a_s'], task: 'c3a', next: 'c_end' },
    c3b: { say: ['pcx_c3b_q'], opts: [['pcx_c3b_r1', 'c3b_t']] },
    c3b_t: { say: ['pcx_c3b_s'], task: 'c3b', next: 'c_end' },
    c4: { say: ['pcx_c4_q'], opts: [['pcx_c4_o1', 'c4a_t'], ['pcx_c4_o2', 'c4b_t']] },
    c4a_t: { say: ['pcx_c4a_s'], task: 'c4a', next: 'c_end' },
    c4b_t: { say: ['pcx_c4b_s'], task: 'c4b', next: 'c_end' },
    c_end: { say: ['pcx_c_end1', 'pcx_c_end2'], end: true },
    // 🔴 חוזרים אחרי יום קשה
    cr: { say: ['pcx_cr_q'], opts: [['pcx_cr_o1', 'cr1'], ['pcx_cr_o2', 'cr2'], ['pcx_cr_o3', 'cr3']] },
    cr1: { say: ['pcx_cr1_s'], go: 'here_end' },
    cr2: { say: ['pcx_cr2_s'], opts: [['pcx_cr2_o1', 'cr2_b'], ['pcx_cr2_o2', 'cr2_w']] },
    cr2_b: { breathe: true, next: 'cr2_bd' },
    cr2_bd: { say: ['pcx_breath_done'], go: 'here_end' },
    cr2_w: { write: 'three', next: 'cr2_wd', empty: 'here_end' },
    cr2_wd: { say: ['pcx_vent_s'], go: 'here_end' },
    cr3: { say: ['pcx_cr3_s'], go: 'here_end' },
    here_end: { say: ['pcx_here_end'], end: true },
};
const PCX_ROOT_PATHS = ['a', 'b', 'c'];
const PCX_WHEN = [0, 30, 60]; // "עכשיו" / "בעוד חצי שעה" / "בעוד שעה"
let pcState = null; // { el, lines, history: [{ node, pick, opts?, lines?, time? }], timers, busy, saved, writing }

function pcStoreKey() { return `weekwise_room_pc_${currentUserId || 'me'}`; }
// השיחה של היום (רק אם כבר ענו בה משהו) - כדי להציע "חזרתי..." / לחזור אליה
function pcLoadSaved() {
    try {
        const s = JSON.parse(localStorage.getItem(pcStoreKey()) || 'null');
        return s && s.date === getLocalDateString() && Array.isArray(s.history) && s.history.some(e => e.pick !== undefined && e.pick !== null) ? s : null;
    } catch { return null; }
}
function pcSave() {
    if (!pcState) return;
    // בלי מה שנכתב חופשי - רק כמה שורות היו
    const history = pcState.history.map(e => ({ node: e.node, pick: e.pick, opts: e.opts, time: e.time, n: e.lines ? e.lines.length : e.n }));
    try { localStorage.setItem(pcStoreKey(), JSON.stringify({ date: getLocalDateString(), history })); } catch { /* פרטי */ }
}
// באיזה מסלול השיחה (בשביל ההמשך כשחוזרים): לפי התשובה הראשונה, או לפי "חזרתי..."
function pcPathOf(history) {
    let path = null;
    (history || []).forEach(e => {
        if (e.node === 'root' && typeof e.pick === 'number') path = PCX_ROOT_PATHS[e.pick] || null;
        if (e.node === 'br') path = 'b';
        if (e.node === 'cr') path = 'c';
    });
    return path;
}
function pcLast() { return pcState.history[pcState.history.length - 1]; }
function pcOpts(entry) { return entry.opts || PCX[entry.node].opts || null; }
function pcStopTimers() {
    if (!pcState) return;
    pcState.timers.forEach(id => clearTimeout(id));
    pcState.timers = [];
    pcState.busy = false;
    pcState.lines.querySelectorAll('.sr-crt-typing, .sr-crt-breath-box').forEach(el => el.remove());
}
function pcLater(fn, ms) { const id = setTimeout(fn, ms); pcState.timers.push(id); return id; }
function pcReducedMotion() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
// השאלה שעניתי עליה נשארת בעין (לפי בקשה מפורשת: "הצהוב עולה למעלה והשאלה הקודמת מוסתרת"): מה שלפניה
// מתכווץ, והגלילה נעצרת על השאלה הקודמת כל עוד רואים גם את תחילת הכפתורים; אחרת - השאלה החדשה למעלה
function pcCondense() {
    const kids = Array.from(pcState.lines.children);
    let me = -1;
    kids.forEach((k, i) => { if (k.classList.contains('sr-crt-me')) me = i; });
    let i = (me < 0 ? kids.length : me) - 1;
    while (i >= 0 && !kids[i].classList.contains('sr-crt-bot')) i--;
    while (i > 0 && kids[i - 1].classList.contains('sr-crt-bot') && !kids[i - 1].classList.contains('sr-crt-meta')) i--;
    const anchor = me >= 0 && i >= 0 ? i : -1;
    kids.forEach((k, j) => k.classList.toggle('is-old', anchor > 0 && j < anchor && !k.classList.contains('sr-crt-meta')));
    pcState.anchor = anchor >= 0 ? kids[anchor] : null;
}
function pcScroll() {
    const l = pcState.lines;
    const bottom = Math.max(0, l.scrollHeight - l.clientHeight);
    const a = pcState.anchor;
    if (!a || !a.isConnected) { l.scrollTop = bottom; return; }
    const box = l.getBoundingClientRect();
    const rel = el => el.getBoundingClientRect().top - box.top + l.scrollTop;
    const top = Math.max(0, rel(a) - 6);
    if (top >= bottom) { l.scrollTop = bottom; return; }
    const ctrl = l.querySelector('.sr-crt-ctrl');
    if (!ctrl || rel(ctrl) + ctrl.offsetHeight - top <= l.clientHeight) { l.scrollTop = top; return; }
    const kids = Array.from(l.children);
    const meIdx = kids.map(k => k.classList.contains('sr-crt-me')).lastIndexOf(true);
    const newQ = kids.slice(meIdx + 1).find(k => k.classList.contains('sr-crt-bot') && !k.classList.contains('sr-crt-typing'));
    l.scrollTop = newQ ? Math.min(bottom, Math.max(0, rel(newQ) - 6)) : bottom;
}

// טקסט חופשי במקום כפתור (לפי בקשה מפורשת): מתחברים לתשובה הכי קרובה. ההתאמה כאן במכשיר בלבד - שום דבר
// לא נשלח לשרת, כי השיחה נשארת במכשיר. מילים משותפות עם התשובה (עם ובלי ו/ה/ב/ל/מ/ש/כ בהתחלה, ובלי
// אותיות סופיות), ולשאלות הקצרות גם מילים נרדפות. אם אין שום רמז - שואלים מה הכי קרוב, והכפתורים נשארים
const PCX_HINTS = {
    pcx_o_good: 'טוב טובה טובים מעולה מצוין מצוינת נהדר נפלא שמח שמחה כיף אחלה סבבה בסדר אנרגיה פרודוקטיבי פרודוקטיבית מדהים מדהימה רגוע רגועה good great happy fine okay awesome amazing productive energy nice calm',
    pcx_o_busy: 'עמוס עמוסה לחוץ לחוצה לחץ הרבה מלא מלאה רץ רצה ריצות זמן משימות עבודה מטורף מטורפת בלגן טירוף שנייה busy stressed rushed hectic lot work tasks crazy time',
    pcx_o_hard: 'קשה רע רעה עצוב עצובה עייף עייפה תשוש תשושה מותש מותשת גמור גמורה שבור שבורה כבד כבדה בוכה בכיתי כועס כועסת מדוכא מדוכאת מבואס מבואסת גרוע נורא hard bad sad tired exhausted heavy cry cried angry down awful terrible',
    pcx_task_today: 'להוסיף תוסיף תוסיפי תכניס היום יומן רשימה add today list calendar',
    pcx_when_0: 'עכשיו מיד כבר now right away',
    pcx_when_1: 'חצי 30 half',
    pcx_when_2: 'שעה 60 hour',
    pcx_back_resume: 'להמשיך המשך נמשיך חזרה continue resume back',
    pcx_new: 'חדשה חדש מההתחלה new start over',
};
function pcFold(s) { return String(s || '').toLowerCase().replace(/[֑-ׇ]/g, '').replace(/ך/g, 'כ').replace(/ם/g, 'מ').replace(/ן/g, 'נ').replace(/ף/g, 'פ').replace(/ץ/g, 'צ'); }
const PCX_STOP = new Set(('אני את אתה אתם לי לך לו לה לנו זה זאת זו של שלי עם על אל גם כן רק כל היה היתה הייתה היו יש אבל או כי אז מה איך כמו עוד ממש קצת יותר מאוד הכי די פשוט ' +
    'the a an and or but to of in on at is am are was were be been it its this that i im my me you your so just very really quite some').split(' ').map(pcFold));
function pcWords(s) { return pcFold(s).replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(w => w.length > 1 && !PCX_STOP.has(w)); }
function pcVariants(w) {
    const v = [w];
    const pre = 'ובלמשהכ';
    if (/^[א-ת]/.test(w)) {
        if (w.length >= 4 && pre.includes(w[0])) v.push(w.slice(1));
        if (w.length >= 5 && pre.includes(w[0]) && pre.includes(w[1])) v.push(w.slice(2));
    }
    return v;
}
function pcWordScore(a, b) {
    const va = pcVariants(a), vb = pcVariants(b);
    if (va.some(x => vb.includes(x))) return 1;
    for (const x of va) for (const y of vb) {
        const [s, l] = x.length <= y.length ? [x, y] : [y, x];
        if (s.length >= 3 && l.startsWith(s)) return 0.7;
    }
    return 0;
}
// choices: [{ key, value }] → הערך של התשובה הכי קרובה, או null כשאין שום רמז
function pcMatch(text, choices) {
    const words = pcWords(text);
    if (!words.length) return null;
    const best1 = (list, w) => list.reduce((m, x) => Math.max(m, pcWordScore(w, x)), 0);
    const neg = /(^|\s)(לא|not|no)(\s|$)/.test(pcFold(text));
    const goodHints = pcWords(PCX_HINTS.pcx_o_good);
    const negGood = neg && words.some(w => best1(goodHints, w) === 1);
    // הדירוג מחלק באורך התשובה (תשובה ארוכה לא מנצחת רק כי יש בה הרבה מילים); מספיקה מילה משותפת אחת
    let best = null, bestScore = 0, bestRaw = 0;
    choices.forEach(c => {
        const label = pcWords(t(c.key));
        const hints = PCX_HINTS[c.key] ? pcWords(PCX_HINTS[c.key]) : [];
        let ls = 0, hs = 0;
        words.forEach(w => { ls += best1(label, w); hs += best1(hints, w); });
        let score = (label.length ? ls / Math.sqrt(label.length) : 0) + hs * 0.8;
        let raw = ls + hs;
        // "לא טוב" ≠ יום טוב
        if (negGood && c.key === 'pcx_o_good') { score -= 2; raw = 0; }
        if (negGood && c.key === 'pcx_o_hard') { score += 1.5; raw += 1; }
        if (score > bestScore + 1e-9) { best = c.value; bestScore = score; bestRaw = raw; }
    });
    return bestRaw >= 0.7 ? best : null;
}
function pcLine(text, who, cls) {
    const el = document.createElement('span');
    el.className = (who === 'me' ? 'sr-crt-me' : 'sr-crt-bot') + (cls ? ' ' + cls : '');
    // מראה הניאון: בועות - מי מדבר רואים לפי הצד והצבע, בלי חיצים
    el.textContent = text;
    pcState.lines.appendChild(el);
    return el;
}
// שורות המחשב אחת אחרי השנייה, עם "···" קצר לפני כל אחת (מיד, כשמבקשים פחות תנועה)
function pcSay(texts, done) {
    const list = (texts || []).filter(Boolean);
    if (!list.length) { if (done) done(); return; }
    pcState.busy = true;
    const step = i => {
        if (i >= list.length) { pcState.busy = false; if (done) done(); return; }
        const typing = pcLine('···', 'bot', 'sr-crt-typing');
        pcScroll();
        const wait = pcReducedMotion() ? 120 : Math.min(1100, 380 + list[i].length * 9);
        pcLater(() => { typing.remove(); pcLine(list[i], 'bot'); pcScroll(); step(i + 1); }, wait);
    };
    step(0);
}
function pcMeText(entry) {
    // מה שנכתב חופשי (וחובר לתשובה הקרובה) מוצג כמו שנכתב - רק בזמן השיחה, לא נשמר
    if (entry.said) return entry.said;
    const node = PCX[entry.node];
    const opts = pcOpts(entry);
    if (opts && typeof entry.pick === 'number' && opts[entry.pick]) return t(opts[entry.pick][0]);
    if (node.task && entry.pick) return t(entry.pick === 'today' ? 'pcx_task_today' : 'pcx_task_ok');
    if (node.when && typeof entry.pick === 'number') return t('pcx_when_' + entry.pick);
    return null;
}
// מה המחשב עונה מיד אחרי הבחירה (לפני הצומת הבא)
function pcAfterTexts(entry) {
    const node = PCX[entry.node];
    if (node.task && entry.pick) return [t('pcx_task_ack')];
    if (node.when && typeof entry.pick === 'number') return [entry.time ? t('pcx_when_remind').replace('{time}', entry.time) : t('pcx_when_now')];
    return [];
}
function pcTaskCard(id, live) {
    const card = document.createElement('div');
    card.className = 'sr-crt-task' + (live ? '' : ' is-done');
    card.innerHTML = `<b>${srEsc(t('pcx_task_label'))} · ${srEsc(t(`pcx_${id}_tn`))}</b><span>${srEsc(t(`pcx_${id}_t`))}</span>`;
    pcState.lines.appendChild(card);
    return card;
}

function roomOpenComputer() {
    const stage = srStage();
    if (!stage) return;
    if (pcState) { pcStopTimers(); pcState = null; }
    // הגופן של מראה הניאון - נטען רק כשפותחים את המחשב
    if (!document.getElementById('sr-pc-font')) {
        const fl = document.createElement('link');
        fl.id = 'sr-pc-font';
        fl.rel = 'stylesheet';
        fl.href = 'https://fonts.googleapis.com/css2?family=Secular+One&display=swap';
        document.head.appendChild(fl);
    }
    const pc = document.createElement('div');
    pc.className = 'sr-pc';
    pc.innerHTML = `
        <div class="sr-sub-head"><button type="button" class="sr-sub-back">${SR_CHEVRON.prev}${srEsc(t('room_back_to_room'))}</button><b>${srEsc(roomItemName('computer'))}</b><span></span></div>
        <div class="sr-crt">
            <div class="sr-crt-screen">
                <div class="sr-crt-on">
                    <div class="sr-crt-lines" aria-live="polite"></div>
                    <div class="sr-crt-nav">
                        <button type="button" class="sr-crt-navbtn" data-pc="back">${srEsc(t('pcx_back'))}</button>
                        <button type="button" class="sr-crt-navbtn" data-pc="new">✦ ${srEsc(t('pcx_new'))}</button>
                    </div>
                    <form class="sr-crt-input"><label aria-hidden="true">‹</label><input type="text" maxlength="300" placeholder="${srEsc(t('room_pc_input'))}" aria-label="${srEsc(t('room_pc_input'))}"><button type="submit" aria-label="${srEsc(t('room_pc_send'))}">↵</button></form>
                </div>
            </div>
            <div class="sr-crt-brand"><span>NOT10</span><button type="button" class="sr-crt-power" aria-pressed="true" aria-label="${srEsc(t('room_pc_power'))}" title="${srEsc(t('room_pc_power'))}"></button></div>
        </div>
        <p class="sr-crt-private">${SR_LOCK_SVG}${srEsc(t('room_pc_private'))}</p>`;
    stage.appendChild(pc);
    pcState = { el: pc, lines: pc.querySelector('.sr-crt-lines'), history: [], timers: [], busy: false, saved: null, writing: null, off: false, anchor: null };
    pcBoot();
    pc.querySelector('[data-pc="back"]').addEventListener('click', pcBack);
    pc.querySelector('[data-pc="new"]').addEventListener('click', pcNew);
    pc.querySelector('.sr-crt-input').addEventListener('submit', e => { e.preventDefault(); pcSubmitText(); });
    pc.querySelector('.sr-crt-power').addEventListener('click', pcPower);
    pc.querySelector('.sr-sub-back').addEventListener('click', () => { pcStopTimers(); pc.remove(); pcState = null; });
}

// כמו להדליק את המחשב: חוזרים באותו יום → להמשיך את השיחה, "חזרתי..." (אחרי עמוס / קשה), או שיחה חדשה
function pcBoot() {
    const saved = pcLoadSaved();
    pcState.saved = null;
    pcState.anchor = null;
    if (saved) {
        pcState.saved = saved.history;
        const path = pcPathOf(saved.history);
        const opts = [['pcx_back_resume', '@resume']];
        if (path === 'b') opts.push(['pcx_br_me', 'br']);
        if (path === 'c') opts.push(['pcx_cr_me', 'cr']);
        opts.push(['pcx_new', '@new']);
        pcState.history = [{ node: 'welcome', opts }];
    } else {
        pcState.history = [{ node: 'root' }];
    }
    pcRenderAll(true);
}

// הנורה הירוקה = כפתור הדלקה (לפי בקשה מפורשת: "יסגור ויפתח את המחשב כאילו אמיתי"): המסך מתכווץ לפס
// ולנקודה ונכבה; בהדלקה הוא נפתח בחזרה, כמו מחשב שנדלק מחדש
function pcPower() {
    if (!pcState) return;
    const screen = pcState.el.querySelector('.sr-crt-screen');
    const btn = pcState.el.querySelector('.sr-crt-power');
    pcState.off = !pcState.off;
    btn.setAttribute('aria-pressed', String(!pcState.off));
    btn.classList.toggle('is-off', pcState.off);
    if (pcState.off) {
        pcStopTimers();
        pcState.writing = null;
        screen.classList.remove('pc-on');
        screen.classList.add('pc-off');
        return;
    }
    screen.classList.remove('pc-off');
    screen.classList.add('pc-on');
    pcBoot();
}

// כל השיחה מההתחלה (פתיחה / חזרה / המשך) - הכול מיד, ורק הצומת האחרון "מוקלד" כשפותחים
function pcRenderAll(animateLast) {
    pcStopTimers();
    const lines = pcState.lines;
    lines.innerHTML = '';
    const when = new Intl.DateTimeFormat(currentLang, { weekday: 'long', hour: '2-digit', minute: '2-digit' }).format(new Date());
    const meta = document.createElement('span');
    meta.className = 'sr-crt-meta';
    meta.textContent = `${t('room_title')} · ${when}`;
    lines.appendChild(meta);
    const h = pcState.history;
    h.forEach((entry, i) => {
        const node = PCX[entry.node];
        const isLast = i === h.length - 1;
        if (isLast && animateLast) return;
        (node.say || []).forEach(k => pcLine(t(k), 'bot'));
        if (node.task) pcTaskCard(node.task, isLast && entry.pick === undefined);
        if (node.write && entry.pick !== undefined) {
            if (entry.lines) entry.lines.forEach(x => pcLine(x, 'me', 'is-free'));
            else if (entry.n) pcLine('✍️ ···', 'me', 'is-free');
        }
        if (entry.pick !== undefined && entry.pick !== null) {
            const me = pcMeText(entry);
            if (me) pcLine(me, 'me');
            pcAfterTexts(entry).forEach(x => pcLine(x, 'bot'));
        }
    });
    pcCondense();
    const last = pcLast();
    if (animateLast) pcEnter(last, true);
    else pcShowControls(last);
    pcScroll();
    pcUpdateNav();
}

// נכנסים לצומת: השורות שלו, ואז הכפתורים / המשימה / הכתיבה (או ממשיכים לבד)
function pcEnter(entry, fresh) {
    const node = PCX[entry.node];
    pcSay((node.say || []).map(k => t(k)), () => {
        if (node.task) { pcTaskCard(node.task, true); }
        if (node.go) { pcGo(node.go); return; }
        pcShowControls(entry);
        pcScroll();
    });
    if (!fresh) pcSave();
}
function pcGo(id) {
    pcState.history.push({ node: id });
    pcUpdateNav();
    pcEnter(pcLast());
}

function pcShowControls(entry) {
    pcState.lines.querySelector('.sr-crt-ctrl')?.remove();
    pcState.writing = null;
    if (entry.pick !== undefined && entry.pick !== null) return;
    const node = PCX[entry.node];
    const box = document.createElement('div');
    box.className = 'sr-crt-ctrl';
    const btn = (label, onClick, cls) => {
        const b = document.createElement('button');
        b.type = 'button';
        if (cls) b.className = cls;
        b.textContent = label;
        b.addEventListener('click', onClick);
        box.appendChild(b);
        return b;
    };
    const opts = pcOpts(entry);
    if (opts) {
        opts.forEach(([key], i) => btn(t(key), () => pcPick(i)));
    } else if (node.task) {
        btn(t('pcx_task_ok'), () => pcPick('ok'));
        btn(t('pcx_task_today'), async () => {
            if (pcState.busy) return;
            const ok = await pcAddTodayTask(t(`pcx_${node.task}_t`));
            if (ok) { showAppToast(t('pcx_task_added')); pcPick('today'); }
        });
    } else if (node.write) {
        pcState.writing = entry;
        box.classList.add('is-write');
        btn(t('pcx_write_done'), () => pcWriteDone(false));
        if (node.write === 'dump') btn(t('pcx_dump_save'), () => pcWriteDone(true), 'is-save');
        setTimeout(() => pcState && pcState.el.querySelector('.sr-crt-input input')?.focus(), 60);
    } else if (node.when) {
        PCX_WHEN.forEach((_, i) => btn(t('pcx_when_' + i), () => pcPickWhen(i)));
    } else if (node.breathe) {
        pcBreathe(entry);
        return;
    } else if (node.end) {
        box.classList.add('is-end');
        btn(`✦ ${t('pcx_new')}`, pcNew, 'is-new');
    }
    pcState.lines.appendChild(box);
}

function pcPick(value, said) {
    if (!pcState || pcState.busy || pcState.off) return;
    const entry = pcLast();
    if (entry.node === 'welcome') {
        const target = entry.opts[value][1];
        if (target === '@resume') { pcState.history = pcState.saved.map(e => ({ ...e })); pcRenderAll(false); pcSave(); return; }
        if (target === '@new') { pcNew(); return; }
    }
    pcState.lines.querySelector('.sr-crt-ctrl')?.remove();
    pcState.lines.querySelectorAll('.sr-crt-task:not(.is-done)').forEach(c => c.classList.add('is-done'));
    entry.pick = value;
    if (said) entry.said = said; else delete entry.said;
    const me = pcMeText(entry);
    if (me) pcLine(me, 'me', said ? 'is-free' : '');
    pcCondense();
    pcScroll();
    const node = PCX[entry.node];
    const opts = pcOpts(entry);
    const next = opts ? opts[value][1] : node.next;
    pcSave();
    pcUpdateNav();
    pcSay(pcAfterTexts(entry), () => { if (next) pcGo(next); });
}

// "באיזו שעה תהיה ההפסקה?" - בעוד חצי שעה / שעה נכנסת משימה עם תזכורת להיום שלי
async function pcPickWhen(i, said) {
    if (!pcState || pcState.busy) return;
    const entry = pcLast();
    if (PCX_WHEN[i]) {
        const d = new Date(Date.now() + PCX_WHEN[i] * 60000);
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
        const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        if (d.getDate() === new Date().getDate() && await pcAddTodayTask(t('pcx_break_title'), time)) entry.time = time;
    }
    pcPick(i, said);
}

async function pcAddTodayTask(title, time) {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return false; }
    const row = { username: currentUsername, user_id: currentUserId, event_title: title, event_date: getLocalDateString(), kind: 'task' };
    if (time) Object.assign(row, { event_time: time, reminder_minutes: 1 });
    const { error } = await supabaseClient.from('calendar_events').insert(row);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return false; }
    if (typeof loadTodayTasks === 'function') loadTodayTasks();
    return true;
}

// כתיבה חופשית בתוך השיחה (פריקה / "מה שקרה" / 3 משפטים): כל שורה נכנסת, ו"סיימתי" ממשיך
function pcSubmitText() {
    if (!pcState || pcState.off) return;
    const input = pcState.el.querySelector('.sr-crt-input input');
    const text = input.value.trim();
    if (!text || pcState.busy) return;
    input.value = '';
    const entry = pcLast();
    const ctrl = pcState.lines.querySelector('.sr-crt-ctrl');
    if (pcState.writing === entry) {
        entry.lines = entry.lines || [];
        entry.lines.push(text);
        pcLine(text, 'me', 'is-free');
        if (ctrl) pcState.lines.appendChild(ctrl);
        pcScroll();
        if (entry.lines.length === 1) pcSay([t('pcx_write_more')], () => { const c = pcState && pcState.lines.querySelector('.sr-crt-ctrl'); if (c) { pcState.lines.appendChild(c); pcScroll(); } });
        return;
    }
    // בסוף שיחה (או בשלב שכבר נענה): מתחילים שיחה חדשה, ומה שנכתב עונה על השאלה הראשונה
    if (PCX[entry.node].end || (entry.pick !== undefined && entry.pick !== null)) {
        pcState.history = [{ node: 'root' }];
        pcState.saved = null;
        pcRenderAll(false);
    }
    pcFree(text);
}
// מה שנכתב חופשי → התשובה הכי קרובה בשלב הזה
function pcFree(text) {
    const entry = pcLast();
    const node = PCX[entry.node];
    const opts = pcOpts(entry);
    let value = null;
    if (opts) value = pcMatch(text, opts.map(([key], i) => ({ key, value: i })));
    else if (node.task) value = pcMatch(text, [{ key: 'pcx_task_today', value: 'today' }]) || 'ok';
    else if (node.when) value = pcMatch(text, PCX_WHEN.map((_, i) => ({ key: 'pcx_when_' + i, value: i })));
    if (value === null) {
        pcLine(text, 'me', 'is-free');
        pcCondense();
        pcScroll();
        pcSay([t('pcx_free_pick')], () => { const c = pcState && pcState.lines.querySelector('.sr-crt-ctrl'); if (c) { pcState.lines.appendChild(c); pcScroll(); } });
        return;
    }
    if (node.task && value === 'today') {
        pcAddTodayTask(t(`pcx_${node.task}_t`)).then(ok => { if (ok) { showAppToast(t('pcx_task_added')); pcPick('today', text); } });
        return;
    }
    if (node.when) { pcPickWhen(value, text); return; }
    pcPick(value, text);
}
async function pcWriteDone(saveNote) {
    if (!pcState || pcState.writing !== pcLast()) return;
    pcStopTimers();
    const entry = pcLast();
    const node = PCX[entry.node];
    const written = entry.lines || [];
    if (saveNote && written.length && typeof insertCenterItemDirect === 'function') {
        const ok = await insertCenterItemDirect('weekly', `🧠 ${written.join(' · ')}`, null, null, null, true);
        if (ok) showAppToast(t('pcx_dump_saved'));
    }
    pcState.writing = null;
    pcState.lines.querySelector('.sr-crt-ctrl')?.remove();
    entry.pick = 'done';
    pcSave();
    pcUpdateNav();
    pcGo(written.length ? node.next : (node.empty || node.next));
}

// 5 נשימות יחד: עיגול שגדל (שאיפה) וקטן (נשיפה)
function pcBreathe(entry) {
    const box = document.createElement('div');
    box.className = 'sr-crt-breath-box';
    box.innerHTML = '<span class="sr-crt-breath" aria-hidden="true"></span><span class="sr-crt-breath-label" aria-live="polite"></span>';
    pcState.lines.appendChild(box);
    pcScroll();
    const circle = box.querySelector('.sr-crt-breath');
    const label = box.querySelector('.sr-crt-breath-label');
    const half = pcReducedMotion() ? 2500 : 3500;
    pcState.busy = true;
    const cycle = n => {
        if (n > 5) {
            pcState.busy = false;
            box.remove();
            entry.pick = 'done';
            pcSave();
            pcGo(PCX[entry.node].next);
            return;
        }
        label.textContent = `${t('pcx_breath_in')} ${srFmt(n)}/${srFmt(5)}`;
        circle.classList.add('in');
        pcLater(() => {
            label.textContent = `${t('pcx_breath_out')} ${srFmt(n)}/${srFmt(5)}`;
            circle.classList.remove('in');
            pcLater(() => cycle(n + 1), half);
        }, half);
    };
    cycle(1);
}

// ↩ חזרה: מבטלים את התשובה האחרונה (וצמתים שעברו לבד), והבחירות של השלב חוזרות
function pcBack() {
    if (!pcState) return;
    pcStopTimers();
    const h = pcState.history;
    const answered = e => e.pick !== undefined && e.pick !== null;
    if (!answered(pcLast())) {
        if (h.length <= 1) return;
        h.pop();
    }
    // צמתים שעוברים לבד (וגם הנשימות) - לא עוצרים בהם בדרך אחורה
    while (h.length > 1 && (PCX[pcLast().node].go || PCX[pcLast().node].breathe)) h.pop();
    const last = pcLast();
    delete last.pick; delete last.time; delete last.lines; delete last.n; delete last.said;
    pcState.writing = null;
    pcRenderAll(false);
    pcSave();
}
function pcNew() {
    if (!pcState || pcState.off) return;
    pcStopTimers();
    pcState.history = [{ node: 'root' }];
    pcState.saved = null;
    pcRenderAll(true);
    pcSave();
}
function pcUpdateNav() {
    if (!pcState) return;
    const h = pcState.history;
    const atStart = h.length === 1 && (h[0].pick === undefined || h[0].pick === null);
    const back = pcState.el.querySelector('[data-pc="back"]');
    if (back) back.disabled = atStart;
}

// ---------- המשחק (מפתח 3): לתפוס ניצוצות, דקה אחת ----------
function roomOpenGame() {
    const stage = srStage();
    if (!stage) return;
    roomStopGame();
    const box = document.createElement('div');
    box.className = 'sr-game';
    box.innerHTML = `
        <div class="sr-sub-head"><button type="button" class="sr-sub-back">${SR_CHEVRON.prev}${srEsc(t('room_back_to_room'))}</button><b>${srEsc(t('room_game_title'))}</b><span class="sr-game-best">${srEsc(t('room_game_best').replace('{n}', srFmt(roomState.game_best || 0)))}</span></div>
        <div class="sr-game-hud"><span class="sr-game-score">${srEsc(t('room_game_score').replace('{n}', srFmt(0)))}</span><span class="sr-game-time">${srEsc(t('room_game_time').replace('{s}', srFmt(ROOM_GAME_SECONDS)))}</span></div>
        <div class="sr-game-field">
            <div class="sr-game-intro">
                <span class="sr-talk-orb big" aria-hidden="true"></span>
                <p>${srEsc(t('room_game_how'))}</p>
                <button type="button" class="sr-game-start">${srEsc(t('room_game_start'))}</button>
            </div>
        </div>`;
    stage.appendChild(box);
    box.querySelector('.sr-sub-back').addEventListener('click', () => { roomStopGame(); box.remove(); srRenderWall(); });
    box.querySelector('.sr-game-start').addEventListener('click', () => roomStartGame(box));
}

function roomStartGame(box) {
    const field = box.querySelector('.sr-game-field');
    field.innerHTML = '';
    const g = { score: 0, left: ROOM_GAME_SECONDS, timers: [], box };
    roomGame = g;
    const scoreEl = box.querySelector('.sr-game-score');
    const timeEl = box.querySelector('.sr-game-time');
    const colors = ['#ff86c6', '#ffd27a', '#7dd3fc', '#b9a8ff', '#86efac'];
    const spawn = () => {
        if (roomGame !== g) return;
        const w = field.clientWidth, h = field.clientHeight;
        const size = 44 + Math.round(Math.random() * 14);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'sr-spark';
        b.setAttribute('aria-label', t('room_game_spark_aria'));
        b.style.cssText = `width:${size}px;height:${size}px;left:${Math.round(Math.random() * Math.max(10, w - size))}px;top:${Math.round(Math.random() * Math.max(10, h - size))}px;--sr-spark:${colors[Math.floor(Math.random() * colors.length)]}`;
        const life = Math.max(900, 1700 - (ROOM_GAME_SECONDS - g.left) * 12);
        b.style.animationDuration = `${life}ms`;
        b.addEventListener('pointerdown', e => {
            e.preventDefault();
            if (b.classList.contains('caught')) return;
            b.classList.add('caught');
            g.score++;
            scoreEl.textContent = t('room_game_score').replace('{n}', srFmt(g.score));
            setTimeout(() => b.remove(), 260);
        });
        field.appendChild(b);
        setTimeout(() => { if (!b.classList.contains('caught')) b.remove(); }, life);
        g.timers.push(setTimeout(spawn, Math.max(380, 720 - (ROOM_GAME_SECONDS - g.left) * 5)));
    };
    spawn();
    g.clock = setInterval(() => {
        g.left--;
        timeEl.textContent = t('room_game_time').replace('{s}', srFmt(Math.max(0, g.left)));
        if (g.left <= 0) roomEndGame(g);
    }, 1000);
}

async function roomEndGame(g) {
    if (roomGame !== g) return;
    roomStopGame();
    const best = Math.max(Number(roomState.game_best) || 0, g.score);
    const record = g.score > (Number(roomState.game_best) || 0) && g.score > 0;
    const field = g.box.querySelector('.sr-game-field');
    field.innerHTML = `
        <div class="sr-game-intro">
            <span class="sr-talk-orb big" aria-hidden="true"></span>
            <h4>${srEsc(t('room_game_done').replace('{n}', srFmt(g.score)))}</h4>
            <p>${srEsc(record ? t('room_game_record') : t('room_game_best').replace('{n}', srFmt(best)))}</p>
            <button type="button" class="sr-game-start">${srEsc(t('room_game_again'))}</button>
        </div>`;
    field.querySelector('.sr-game-start').addEventListener('click', () => roomStartGame(g.box));
    g.box.querySelector('.sr-game-best').textContent = t('room_game_best').replace('{n}', srFmt(best));
    if (record) {
        if (typeof spawnGentleConfettiBurst === 'function') spawnGentleConfettiBurst(field, 30, undefined, undefined, ['#ffd27a', '#ff86c6', '#7dd3fc']);
        await roomSave({ game_best: best });
    }
}

function roomStopGame() {
    if (!roomGame) return;
    roomGame.timers.forEach(clearTimeout);
    clearInterval(roomGame.clock);
    roomGame = null;
}

// ---------- המדף (מפתח 4): הספרים, המחברות והזיכרונות ----------
function roomOpenShelf() {
    const item = (id, icon, key) => `<button type="button" class="sr-shelf-item" data-go="${id}"><span aria-hidden="true">${icon}</span><b>${srEsc(t(key))}</b></button>`;
    const ov = nmOpenSheet(`
        <h4>${srEsc(roomItemName('shelf'))}</h4>
        <p class="nm-fine">${srEsc(t('room_shelf_hint'))}</p>
        <div class="sr-shelf-items">
            ${item('books', '📚', 'room_shelf_books')}
            ${item('notebooks', '📒', 'room_shelf_notebooks')}
            ${item('photos', '📸', 'room_shelf_memories')}
        </div>
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('room_back_to_room'))}</button>`, 'sr-shelf-sheet');
    ov.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
        ov.remove();
        closeSecretRoom();
        if (b.dataset.go === 'books' && typeof openBooksSection === 'function') openBooksSection();
        else if (b.dataset.go === 'notebooks' && typeof openBag === 'function') openBag();
        else if (b.dataset.go === 'photos' && typeof nmGo === 'function') nmGo('photos');
    }));
}

// ---------- הגג (מפתח 5) ----------
// לפי בקשה מפורשת: כוכבים שהם לא מפתחות - פשוט יפים; נגיעה בכוכב = הוא נופל ככוכב נופל וחוזר למקום;
// עיר יפה מבצבצת מעל הרעפים, ובאופק הרחוק יער וים. וגם (מהבקשה על הגג): רעפים, מקום לשבת וחתול
const ROOF_STARS = 24;
function roomRoofScene() {
    // עיר: בניינים בגבהים שונים עם חלונות דולקים (מיקומים קבועים, כדי שהעיר תהיה אותה עיר בכל פעם)
    let seed = 11;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const blds = [[34, 48], [58, 70], [80, 40], [100, 96], [126, 58], [146, 120], [170, 74], [196, 104], [222, 62], [244, 88], [268, 52], [290, 78], [314, 44], [336, 66]];
    let city = '';
    blds.forEach(([x, h], i) => {
        const w = i % 3 === 1 ? 22 : 20;
        const top = 418 - h;
        city += `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${i % 2 ? '#1c1538' : '#221a42'}"/>`;
        for (let wy = top + 7; wy < 404; wy += 11) {
            for (let wx = x + 4; wx < x + w - 4; wx += 6) {
                if (rnd() < 0.42) city += `<rect x="${wx}" y="${wy}" width="2.6" height="4" fill="${rnd() < 0.8 ? '#ffd98a' : '#ff9ecf'}" opacity="${(0.55 + rnd() * 0.45).toFixed(2)}"/>`;
            }
        }
    });
    // מגדל עם אור אדום, וכיפה קטנה
    city += '<rect x="150" y="262" width="4" height="36" fill="#221a42"/><circle class="sr-roof-beacon" cx="152" cy="260" r="2.6" fill="#ff5a6a"/>';
    city += '<path d="M200 314 a13 13 0 0 1 26 0 z" fill="#2a2150"/><rect x="211.5" y="296" width="3" height="6" fill="#2a2150"/>';
    // יער באופק: גבעה ועצי אורן קטנים
    let pines = '';
    for (let i = 0; i < 16; i++) {
        const x = 214 + i * 11 + (i % 2 ? 3 : 0), base = 334 - Math.sin(i / 3) * 6, h = 14 + (i % 3) * 5;
        pines += `<path d="M${x} ${base} l5 -${h} l5 ${h} z" fill="#0f2c26"/>`;
    }
    return `
        <svg class="sr-roof-scene" viewBox="0 0 390 780" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
            <defs>
                <linearGradient id="srRoofSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3a78"/><stop offset="1" stop-color="#121a44"/></linearGradient>
                <radialGradient id="srRoofGlow" cx="0.5" cy="1" r="0.8"><stop offset="0" stop-color="#ff9ecf" stop-opacity="0.35"/><stop offset="1" stop-color="#ff9ecf" stop-opacity="0"/></radialGradient>
                <pattern id="srRoofTile" width="26" height="16" patternUnits="userSpaceOnUse">
                    <rect width="26" height="16" fill="#6f2b20"/>
                    <path d="M0 0 h26 v8 a13 8 0 0 1 -26 0 z" fill="#93402d"/>
                    <path d="M2 2 h22" stroke="#b55a40" stroke-width="1.2" opacity="0.7"/>
                    <path d="M13 0 v16" stroke="#5a2118" stroke-width="0.8" opacity="0.6"/>
                </pattern>
            </defs>
            <circle cx="104" cy="118" r="24" fill="#fff4c9"/>
            <circle cx="104" cy="118" r="46" fill="#fff4c9" opacity="0.12"/>
            <g transform="translate(0 220)">
            <rect x="0" y="230" width="390" height="140" fill="url(#srRoofGlow)"/>
            <g class="sr-roof-sea">
                <rect x="0" y="330" width="250" height="40" fill="url(#srRoofSea)"/>
                <g stroke="#fff4c9" stroke-linecap="round" opacity="0.55"><line x1="56" y1="336" x2="84" y2="336" stroke-width="1.6"/><line x1="60" y1="343" x2="80" y2="343" stroke-width="1.3"/><line x1="64" y1="350" x2="76" y2="350" stroke-width="1"/></g>
                <g stroke="#9fb3ff" stroke-linecap="round" opacity="0.35"><line x1="120" y1="340" x2="134" y2="340"/><line x1="180" y1="347" x2="192" y2="347"/><line x1="24" y1="352" x2="34" y2="352"/></g>
            </g>
            <g class="sr-roof-forest">
                <path d="M200 340 Q260 318 320 326 T390 322 V370 H200 Z" fill="#0d241f"/>
                ${pines}
            </g>
            <g class="sr-roof-city">${city}</g>
            <g class="sr-roof-tiles">
                <path d="M0 418 L390 404 V560 H0 Z" fill="url(#srRoofTile)"/>
                <path d="M0 418 L390 404" stroke="#4a1a12" stroke-width="7"/>
                <path d="M0 414.5 L390 400.5" stroke="#a8503a" stroke-width="1.5" opacity="0.8"/>
                <rect x="0" y="420" width="390" height="140" fill="url(#srRoofGlow)" opacity="0.25"/>
            </g>
            <g class="sr-roof-seat">
                <ellipse cx="292" cy="472" rx="30" ry="9" fill="#000" opacity="0.3"/>
                <ellipse cx="292" cy="464" rx="28" ry="11" fill="#ff8fc4"/>
                <ellipse cx="292" cy="460" rx="24" ry="7" fill="#ffb3d6"/>
                <path d="M270 462 q22 8 44 0" stroke="#e86aa6" stroke-width="1.2" fill="none"/>
            </g>
            <g class="sr-roof-cat">
                <path class="sr-roof-tail" d="M132 404 q22 -4 20 -24 q-1 -9 6 -10" stroke="#120d1f" stroke-width="6" fill="none" stroke-linecap="round"/>
                <ellipse cx="118" cy="398" rx="17" ry="14" fill="#120d1f"/>
                <circle cx="116" cy="378" r="10" fill="#120d1f"/>
                <path d="M108 372 l-2 -11 l8 6 z M124 372 l2 -11 l-8 6 z" fill="#120d1f"/>
            </g>
            </g>
        </svg>`;
}
function roomOpenRoof() {
    const stage = srStage();
    if (!stage) return;
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    let stars = '';
    for (let i = 0; i < ROOF_STARS; i++) {
        const x = 6 + rnd() * 88, y = 5 + rnd() * 44;
        const size = rnd() < 0.3 ? 'is-big' : rnd() < 0.5 ? 'is-small' : '';
        stars += `<button type="button" class="sr-star ${size}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;animation-delay:${((i * 0.37) % 3).toFixed(2)}s" aria-label="${srEsc(t('room_star_aria'))}"></button>`;
    }
    const box = document.createElement('div');
    box.className = 'sr-roof';
    box.innerHTML = `
        <div class="sr-sub-head"><button type="button" class="sr-sub-back">${SR_CHEVRON.prev}${srEsc(t('room_back_to_room'))}</button><b>${srEsc(roomItemName('roof'))}</b><span></span></div>
        <div class="sr-roof-sky">
            ${roomRoofScene()}
            ${stars}
        </div>`;
    stage.appendChild(box);
    box.querySelector('.sr-sub-back').addEventListener('click', () => box.remove());
    // כוכב נופל: יורד באלכסון עם שובל, נעלם, וחוזר למקומו
    box.querySelectorAll('.sr-star').forEach(s => s.addEventListener('click', () => {
        if (s.classList.contains('falling') || s.classList.contains('back')) return;
        s.classList.add('falling');
        setTimeout(() => { s.classList.remove('falling'); s.classList.add('back'); }, 1100);
        setTimeout(() => s.classList.remove('back'), 1950);
    }));
}

// ---------- מפת הבית: החדר, הגג, הסטודיו (8), הספרייה (12) והגינה (רצף ימים) ----------
function roomOpenMap(highlight) {
    const stage = srStage();
    if (!stage) return;
    stage.querySelector('.sr-map')?.remove();
    const keys = roomKeys();
    const streak = typeof nmStreaks === 'function' && nmProfile ? (nmStreaks().current || 0) : 0;
    const flowers = Math.min(12, streak);
    let flowerSvg = '';
    for (let i = 0; i < flowers; i++) {
        const x = 12 + (i % 6) * 13 + (i >= 6 ? 6 : 0), y = 340 - (i >= 6 ? 12 : 0);
        flowerSvg += `<circle cx="${x}" cy="${y}" r="4" fill="${i % 2 ? '#ff9ecf' : '#fff'}"/><circle cx="${x}" cy="${y}" r="1.6" fill="#ffd23f"/>`;
    }
    const room = (id, x, y, w, h, fill, label) => {
        const open = keys >= roomUnlockAt(id);
        return `<g class="sr-hot${open ? '' : ' locked'}" data-room="${id}" role="button" tabindex="0" aria-label="${srEsc(label)}">
            <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${open ? fill : '#1e1636'}"/>
            ${open ? '' : `<g transform="translate(${x + w / 2 - 12} ${y + 26})"><rect x="4" y="12" width="16" height="13" rx="2.5" fill="none" stroke="#8f84c4" stroke-width="2"/><path d="M7 12 v-3 a5 5 0 0 1 10 0 v3" fill="none" stroke="#8f84c4" stroke-width="2"/></g>`}
            <text x="${x + w / 2}" y="${y + h - 16}" text-anchor="middle" font-size="10.5" font-weight="${open ? 800 : 400}" fill="${open ? '#fff' : '#b9b0e0'}" data-fit="${w - 8}">${srEsc(label)}${open ? '' : ` · ${srFmt(roomUnlockAt(id))}`}</text>
        </g>`;
    };
    const chips = ROOM_UNLOCKS.map(u => `<span class="sr-map-chip${keys >= u.n ? ' on' : ''}">${srFmt(u.n)} ${srEsc(roomItemName(u.id))}${keys >= u.n ? ' ✓' : ''}</span>`).join('');
    const box = document.createElement('div');
    box.className = 'sr-map';
    box.innerHTML = `
        <div class="sr-sub-head"><button type="button" class="sr-sub-back">${SR_CHEVRON.prev}${srEsc(t('room_back_to_room'))}</button><b>${srEsc(t('room_map_title'))}</b><span></span></div>
        <p class="sr-map-sub">${srEsc(t('room_map_sub'))}</p>
        <svg class="sr-map-svg" viewBox="0 0 358 372" style="direction:${srIsRtl() ? 'rtl' : 'ltr'}" aria-hidden="false" role="group" aria-label="${srEsc(t('room_map_title'))}">
            <defs>
                <linearGradient id="srmSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#141a44"/><stop offset="1" stop-color="#3a2a66"/></linearGradient>
                <linearGradient id="srmSecret" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff9ecf"/><stop offset="1" stop-color="#a855f7"/></linearGradient>
                <linearGradient id="srmWarm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf8a"/><stop offset="1" stop-color="#f59e5b"/></linearGradient>
                <linearGradient id="srmStudio" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#6366f1"/></linearGradient>
                <linearGradient id="srmLib" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86efac"/><stop offset="1" stop-color="#0d9488"/></linearGradient>
            </defs>
            <rect width="358" height="372" rx="24" fill="url(#srmSky)"/>
            <g fill="#fff" class="sr-twinkle"><circle cx="30" cy="30" r="1.4"/><circle cx="80" cy="54" r="1.1"/><circle cx="300" cy="24" r="1.5"/><circle cx="250" cy="44" r="1"/><circle cx="340" cy="70" r="1.2"/><circle cx="140" cy="20" r="1.1"/><circle cx="20" cy="110" r="1"/></g>
            <circle cx="44" cy="60" r="12" fill="#fff4c9"/>
            <rect y="326" width="358" height="46" fill="#1f3a2a"/>
            <path d="M0 330 Q 40 318 80 330 V372 H0 Z" fill="#2f5a3c"/>
            <g><rect x="34" y="276" width="8" height="52" fill="#5a3a26"/><circle cx="38" cy="268" r="22" fill="#3f8a5c"/><circle cx="26" cy="280" r="14" fill="#4fa36c"/><circle cx="52" cy="278" r="13" fill="#5bb87a"/></g>
            ${flowerSvg}
            <text x="40" y="362" text-anchor="middle" font-size="10" font-weight="700" fill="#c9f5d6" data-fit="76">${srEsc(t('room_map_garden'))}${streak ? ` · ${srFmt(streak)}` : ''}</text>
            <g class="sr-hot${keys >= roomUnlockAt('roof') ? '' : ' locked'}" data-room="roof" role="button" tabindex="0" aria-label="${srEsc(roomItemName('roof'))}">
                <rect x="92" y="86" width="252" height="10" fill="#4a3266"/>
                <g stroke="#7a6a9a" stroke-width="2"><line x1="96" y1="86" x2="96" y2="70"/><line x1="340" y1="86" x2="340" y2="70"/><line x1="96" y1="70" x2="340" y2="70"/><line x1="150" y1="86" x2="150" y2="70"/><line x1="210" y1="86" x2="210" y2="70"/><line x1="270" y1="86" x2="270" y2="70"/></g>
                <g opacity="${keys >= roomUnlockAt('roof') ? 1 : 0.55}"><line x1="300" y1="84" x2="290" y2="60" stroke="#c9c2e8" stroke-width="3"/><rect x="276" y="46" width="28" height="9" rx="4" fill="#c9c2e8" transform="rotate(-24 290 50)"/></g>
                <rect x="138" y="38" width="160" height="24" rx="12" fill="rgba(10,6,16,0.7)"/>
                <text x="218" y="55" text-anchor="middle" font-size="11" font-weight="800" fill="#d8ccff" data-fit="150">${srEsc(roomItemName('roof'))}${keys >= roomUnlockAt('roof') ? ' ✓' : ` · ${srEsc(t('room_key_n').replace('{n}', srFmt(roomUnlockAt('roof'))))}`}</text>
            </g>
            <rect x="96" y="96" width="244" height="230" fill="#2a1d40"/>
            ${room('library', 104, 104, 112, 100, 'url(#srmLib)', roomItemName('library'))}
            ${room('studio', 224, 104, 108, 100, 'url(#srmStudio)', roomItemName('studio'))}
            <rect x="96" y="210" width="244" height="6" fill="#4a3266"/>
            <g class="sr-hot" data-room="secret" role="button" tabindex="0" aria-label="${srEsc(t('room_title'))}">
                <rect x="104" y="222" width="112" height="98" rx="4" fill="url(#srmSecret)"/>
                <circle cx="160" cy="262" r="12" fill="#fff" opacity="0.25"/><circle cx="160" cy="262" r="8" fill="#ffd6ec"/><ellipse cx="157" cy="263" rx="1.6" ry="2.2" fill="#2a1240"/><ellipse cx="163" cy="263" rx="1.6" ry="2.2" fill="#2a1240"/>
                <rect x="112" y="296" width="96" height="16" rx="8" fill="rgba(10,6,16,0.6)"/>
                <text x="160" y="308" text-anchor="middle" font-size="10" font-weight="800" fill="#fff" data-fit="88">${srEsc(t('room_title'))} ✓</text>
            </g>
            <rect x="224" y="222" width="108" height="98" rx="4" fill="url(#srmWarm)"/>
            <rect x="236" y="244" width="30" height="40" rx="3" fill="#8a5a3c" opacity="0.6"/><circle cx="300" cy="262" r="10" fill="#fff4c9" opacity="0.7"/>
            <rect x="234" y="296" width="88" height="16" rx="8" fill="rgba(10,6,16,0.5)"/>
            <text x="278" y="308" text-anchor="middle" font-size="10" font-weight="800" fill="#fff" data-fit="82">${srEsc(t('room_map_hall'))}</text>
        </svg>
        <div class="sr-map-legend">
            <span>${SR_KEY_SVG}${srEsc(t('room_map_l1'))}</span>
            <span>✦ ${srEsc(t('room_map_l2'))}</span>
            <span>🌱 ${srEsc(t('room_map_l3'))}</span>
        </div>
        <div class="sr-map-chips">${chips}</div>`;
    stage.appendChild(box);
    srFitTexts(box);
    box.querySelector('.sr-sub-back').addEventListener('click', () => box.remove());
    box.querySelectorAll('[data-room]').forEach(el => {
        const go = () => {
            const id = el.dataset.room;
            if (el.classList.contains('locked')) { srShowLockTip(id); return; }
            if (id === 'secret') { box.remove(); return; }
            if (id === 'roof') { box.remove(); roomOpenRoof(); return; }
            if (id === 'studio') { roomOpenDecor(true); return; }
            if (id === 'library') { roomOpenLibrary(); }
        };
        el.addEventListener('click', go);
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    if (highlight) {
        const el = box.querySelector(`[data-room="${highlight}"]`);
        if (el) {
            el.classList.add('sr-map-new');
            srShowTip(t('room_reveal_opened').replace('{item}', roomItemName(highlight)));
            if (typeof spawnGentleConfettiBurst === 'function') {
                const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
                setTimeout(() => spawnGentleConfettiBurst(stage, 30, r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, ['#ffd27a', '#ffe2a6', '#ff9ecf']), 500);
            }
        }
    }
}

// ---------- הספרייה (מפתח 12): הספרים מפינת הקריאה ----------
async function roomOpenLibrary() {
    const stage = srStage();
    if (!stage) return;
    let books = [];
    if (supabaseClient && currentUserId) {
        const { data } = await supabaseClient.from('books').select('id, title').eq('user_id', currentUserId).order('created_at', { ascending: true }).limit(40);
        books = data || [];
    }
    const spines = ['#ff7ab8', '#93c5fd', '#fcd34d', '#86efac', '#c084fc', '#fda4af', '#7dd3fc', '#f59e0b'];
    const box = document.createElement('div');
    box.className = 'sr-library';
    box.innerHTML = `
        <div class="sr-sub-head"><button type="button" class="sr-sub-back">${SR_CHEVRON.prev}${srEsc(t('room_back_to_room'))}</button><b>${srEsc(roomItemName('library'))}</b><span></span></div>
        <div class="sr-lib-shelves">
            ${books.length ? books.map((b, i) => `<button type="button" class="sr-book" style="--sr-book:${spines[i % spines.length]};height:${120 + ((i * 37) % 40)}px" title="${srEsc(b.title)}"><span>${srEsc(srClip(b.title, 26))}</span></button>`).join('') : `<p class="sr-lib-empty">${srEsc(t('room_library_empty'))}</p>`}
        </div>
        <button type="button" class="sr-lib-open">📚 ${srEsc(t('room_library_open'))}</button>`;
    stage.appendChild(box);
    box.querySelector('.sr-sub-back').addEventListener('click', () => box.remove());
    const open = () => { closeSecretRoom(); if (typeof openBooksSection === 'function') openBooksSection(); };
    box.querySelector('.sr-lib-open').addEventListener('click', open);
    box.querySelectorAll('.sr-book').forEach(b => b.addEventListener('click', open));
}

// ---------- לעצב את החדר: סגנון מוכן + צבע קירות ("עליית גג" נפתחת עם הסטודיו) ----------
function roomOpenDecor(fromStudio) {
    const stage = srStage();
    if (!stage) return;
    stage.querySelector('.sr-decor')?.remove();
    const cur = srCurrentStyle();
    roomPreview = { style: cur.style, wall_color: cur.wallColor };
    const studioOpen = roomIsUnlocked('studio');
    const styleBtn = (id) => {
        const locked = id === 'attic' && !studioOpen;
        return `<button type="button" class="sr-style sr-style-${id}${cur.style === id ? ' on' : ''}${locked ? ' locked' : ''}" data-style="${id}" aria-pressed="${cur.style === id}">${locked ? SR_LOCK_SVG : ''}<span>${srEsc(t('room_style_' + id))}</span></button>`;
    };
    const box = document.createElement('div');
    box.className = 'sr-decor';
    box.innerHTML = `
        <div class="sr-decor-sheet">
            <div class="sr-decor-head"><b>${srEsc(fromStudio ? roomItemName('studio') : t('room_decor_title'))}</b><button type="button" class="sr-decor-x" aria-label="${srEsc(t('close_btn'))}">${SR_CLOSE_SVG}</button></div>
            ${fromStudio ? `<p class="sr-decor-hint">${srEsc(t('room_studio_hint'))}</p>` : ''}
            <span class="sr-decor-label">${srEsc(t('room_decor_styles'))}</span>
            <div class="sr-styles">${['night', 'pastel', 'attic'].map(styleBtn).join('')}</div>
            <span class="sr-decor-label">${srEsc(t('room_decor_walls'))}</span>
            <div class="sr-swatches">
                <button type="button" class="sr-swatch none${cur.wallColor ? '' : ' on'}" data-color="" aria-label="${srEsc(t('room_decor_wall_default'))}" title="${srEsc(t('room_decor_wall_default'))}"></button>
                ${ROOM_WALL_COLORS.map((c, i) => `<button type="button" class="sr-swatch${cur.wallColor === c ? ' on' : ''}" data-color="${c}" style="--sr-swatch:${c}" aria-label="${srEsc(t('room_decor_wall_' + (i + 1)))}" title="${srEsc(t('room_decor_wall_' + (i + 1)))}"></button>`).join('')}
            </div>
            <button type="button" class="sr-decor-save">${srEsc(t('room_decor_save'))}</button>
        </div>`;
    stage.appendChild(box);
    const cancel = () => { roomPreview = null; srApplyStyle(); box.remove(); };
    box.querySelector('.sr-decor-x').addEventListener('click', cancel);
    box.addEventListener('click', e => { if (e.target === box) cancel(); });
    box.querySelectorAll('[data-style]').forEach(b => b.addEventListener('click', () => {
        if (b.classList.contains('locked')) { srShowLockTip('studio'); return; }
        roomPreview.style = b.dataset.style;
        box.querySelectorAll('[data-style]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        srApplyStyle();
    }));
    box.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
        roomPreview.wall_color = b.dataset.color || null;
        box.querySelectorAll('[data-color]').forEach(x => x.classList.toggle('on', x === b));
        srApplyStyle();
    }));
    box.querySelector('.sr-decor-save').addEventListener('click', async () => {
        const fields = { style: roomPreview.style, wall_color: roomPreview.wall_color || null };
        roomPreview = null;
        const ok = await roomSave(fields);
        srApplyStyle();
        box.remove();
        showAppToast(t(ok ? 'room_decor_saved' : 'nm_save_error'), ok ? undefined : 'error');
    });
}

// ---------- כפתור המפתח של מנהלת המוצר (חשבון המפתחים בלבד) ----------
// לפי בקשה מפורשת: "כאילו אני אחרי אתגר... שיפתח כמו שיפתח כרגיל למשתמשים". + = אתגר הסתיים
// (חגיגת האתגר הרגילה ואז חגיגת המפתח, בדיוק כמו אצל כולם); − = סוגר את המפתח האחרון כדי לראות שוב
function roomRenderDevKeys() {
    let el = document.getElementById('sr-dev-keys');
    const sec = document.getElementById('new-me-section');
    const secOpen = !!(sec && sec.classList.contains('active-tab'));
    const inNewMe = secOpen && typeof hasNewMe !== 'undefined' && hasNewMe && typeof nmProfile !== 'undefined' && !!nmProfile;
    // תצוגת "כמו לפני רכישה" של חשבון הפיתוח: אותו כפתור, עם פתיחה של New Me
    const lockedPreview = secOpen && roomIsDev() && typeof hasNewMe !== 'undefined' && !hasNewMe && typeof nmDevLockedPreview === 'function' && nmDevLockedPreview();
    const show = roomIsDev() && (lockedPreview || (roomLoaded && (srIsOpen() || inNewMe)));
    if (!show) { if (el) el.remove(); return; }
    // במסדרון: בתוך הציור, בשורה מתחת לפס העליון (כדי לא לכסות את ⋯ ולזוז יחד עם המסדרון)
    const hallSlot = !srIsOpen() && !lockedPreview ? document.querySelector('#new-me-root .nmh .nmh-dev') : null;
    const parent = hallSlot || document.querySelector('.phone-wrapper') || document.body;
    if (!el || el.parentNode !== parent) {
        if (el) el.remove();
        el = document.createElement('div');
        el.id = 'sr-dev-keys';
        el.className = 'sr-dev-keys';
        parent.appendChild(el);
    }
    el.classList.toggle('is-row', !!hallSlot || lockedPreview);
    if (lockedPreview) {
        el.innerHTML = `<span class="sr-dev-tag">PM</span><button type="button" class="sr-dev-unlock" onclick="setNmDevLockedPreview(false)">🔓 ${srEsc(t('nm_dev_preview_exit'))}</button>`;
        return;
    }
    el.innerHTML = `
        <span class="sr-dev-tag">PM</span>
        <button type="button" class="sr-dev-add" onclick="roomDevAddKey()" title="${srEsc(t('room_dev_add'))}" aria-label="${srEsc(t('room_dev_add'))}">${SR_KEY_SVG}<b>+</b></button>
        <span class="sr-dev-count" aria-label="${srEsc(t('room_dev_count').replace('{n}', srFmt(roomKeys())))}">${srFmt(roomKeys())}</span>
        <button type="button" class="sr-dev-remove" onclick="roomDevRemoveKey()" title="${srEsc(t('room_dev_remove'))}" aria-label="${srEsc(t('room_dev_remove'))}" ${roomKeys() > 0 ? '' : 'disabled'}>−</button>`;
}

async function roomDevAddKey() {
    if (!roomIsDev()) return;
    if (!roomLoaded) await roomLoad();
    await roomSetDevDelta(roomDevDelta() + 1);
    const keys = roomKeys();
    roomRenderDevKeys();
    // המפתח הראשון מגיע מ-3 ימים עם New Me (בלי חגיגת אתגר) - שאר המפתחות אחרי חגיגת אתגר רגילה
    if (keys > 1 && typeof nmCelebrateChallenge === 'function' && typeof NEW_ME_CHALLENGES !== 'undefined') {
        const def = NEW_ME_CHALLENGES[(keys - 2) % NEW_ME_CHALLENGES.length];
        nmCelebrateChallenge({ challenge_key: def.key, kind: def.kind }, { n: Math.min(NEW_ME_CHALLENGES.length, keys - 1), simulated: true });
        return;
    }
    await roomCheckNewKeys();
}

async function roomDevRemoveKey() {
    if (!roomIsDev() || roomKeys() <= 0) return;
    if (!roomLoaded) await roomLoad();
    const before = roomKeys();
    await roomSetDevDelta(roomDevDelta() - 1);
    const keys = roomKeys();
    if ((Number(roomState.keys_seen) || 0) > keys) await roomSave({ keys_seen: keys });
    const closed = ROOM_UNLOCKS.find(u => u.n === before);
    showAppToast(closed ? t('room_dev_closed').replace('{item}', roomItemName(closed.id)) : t('room_dev_count').replace('{n}', srFmt(keys)));
    if (keys < 1 && srIsOpen()) closeSecretRoom();
    roomAfterKeysChange();
}
