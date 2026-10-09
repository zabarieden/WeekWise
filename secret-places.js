// ===== New Me: המקומות שמאחורי הדלתות במסדרון =====
// לפי בחירה מפורשת (2026-10-09), מתוך 5 אפשרויות לכל דלת על הקנבס:
// דלת 2 - המרפסת המקורה מול הים: ערסל, והמחשב שם הוא טאבלט (נעול עד שנעצב אותו יחד);
// דלת 3 - פינה חמה עם כורסה ותקליטים: הגיטרה והיומן (היומן נשמר בחשבון - רק שלך);
// דלת 4 - חדר הנשימה: חוף בשקיעה, השמש עולה ויורדת עם הנשימה. בלי דקות ובלי ספירה - נכנסים, לוחצים ומתחילים;
// דלת 5 - השביל ביער עם פנסים וספסל: נגיעה בפנסים מכבה אותם, ויש יום בחוץ.
// ובאתגר האחרון - בקבוק מגיע מהים, ובתוכו המכתב מהעבר. כל מפתח פותח דבר אחד (ר' ROOM_UNLOCKS).
// כל הציורים בגודל 390×844, כמו המסדרון, וכל מה שנוגעים בו נמצא בתוך הציור עצמו.

const SRP_DOOR_PLACE = { 2: 'porch', 3: 'music', 4: 'breath', 5: 'outside' };
const SRP_BREATH_MS = 10 * 60 * 1000;   // סשן של עשר דקות (לא כתוב בשום מקום - לפי בקשה מפורשת)
let srpCleanups = [];

// העדפות קטנות של המקום (גשם, זריחה, יום/לילה, מדורה) - נשמרות במכשיר
function srpPrefKey() { return `weekwise_room_prefs_${currentUserId || 'me'}`; }
function srpPrefs() { try { return JSON.parse(localStorage.getItem(srpPrefKey()) || '{}') || {}; } catch { return {}; } }
function srpSetPref(k, v) { const p = srpPrefs(); p[k] = v; try { localStorage.setItem(srpPrefKey(), JSON.stringify(p)); } catch {} }
function srpReduce() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
// עצירת מה שרץ במקום (מוזיקה, סשן נשימה) כשיוצאים ממנו
function srpCleanup() { srpCleanups.splice(0).forEach(fn => { try { fn(); } catch {} }); }

function roomOpenPlace(id, opts = {}) {
    if (!roomLoaded || !roomState) { roomLoad().then(() => roomOpenPlace(id, opts)); return; }
    if (!roomIsUnlocked(id)) return;
    if (!srIsOpen()) openSecretRoom({ wall: roomWall });
    const stage = srStage();
    if (!stage) return;
    srpCleanup();
    stage.querySelector('.sr-place')?.remove();
    const keys = roomKeys();
    const P = { porch: [srpPorchScene, srpInitPorch], music: [srpMusicScene, srpInitMusic], breath: [srpBreathScene, srpInitBreath], outside: [srpOutsideScene, srpInitOutside] }[id];
    if (!P) return;
    const box = document.createElement('div');
    box.className = `sr-place sr-place-${id}`;
    box.innerHTML = `
        <div class="sr-sub-head"><button type="button" class="sr-sub-back">${SR_CHEVRON.prev}${srEsc(t(opts.fromHall ? 'room_back_to_hall' : 'room_back_to_room'))}</button><b>${srEsc(roomItemName(id))}</b><span class="srp-tools"></span></div>
        <div class="srp-view">${P[0](keys)}</div>
        <button type="button" class="srp-rest-exit" aria-label="${srEsc(t('room_rest_aria'))}"></button>`;
    stage.appendChild(box);
    box.querySelector('.sr-sub-back').addEventListener('click', () => { srpCleanup(); if (opts.fromHall) closeSecretRoom(); else box.remove(); });
    box.querySelector('.srp-rest-exit').addEventListener('click', () => box.classList.remove('is-resting'));
    const handlers = P[1](box, keys) || {};
    box.querySelectorAll('[data-place-hot]').forEach(el => {
        const go = () => { const fn = handlers[el.dataset.placeHot]; if (fn) fn(el); };
        el.addEventListener('click', go);
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    if (opts.highlight) srpHighlight(box, opts.highlight);
}

// מה שנפתח עכשיו: הודעה קטנה, הבהוב זהוב והתזזיות - על הדבר עצמו (או על כל המקום)
function srpHighlight(box, id) {
    srShowTip(t('room_reveal_opened').replace('{item}', roomItemName(id)));
    const el = box.querySelector(`[data-place-hot="${id}"], [data-tool="${id}"]`);
    if (el) el.classList.add('srp-new');
    const stage = srStage();
    if (!stage || typeof spawnGentleConfettiBurst !== 'function') return;
    const s = stage.getBoundingClientRect();
    const r = el ? el.getBoundingClientRect() : { left: s.left, top: s.top + s.height * 0.35, width: s.width, height: 0 };
    setTimeout(() => spawnGentleConfettiBurst(stage, 30, r.left - s.left + r.width / 2, r.top - s.top + r.height / 2, ['#ffd27a', '#ffe2a6', '#ff9ecf', '#b9a8ff']), 500);
}

// כפתור קטן בפינה של המקום (גשם / זריחה) - מופיע רק אחרי שנפתח
function srpTool(box, id, icon, on, toggle) {
    const tools = box.querySelector('.srp-tools');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'sr-btn srp-tool';
    b.dataset.tool = id;
    b.setAttribute('aria-label', roomItemName(id));
    b.title = roomItemName(id);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
    b.innerHTML = icon;
    b.addEventListener('click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', v ? 'true' : 'false'); b.classList.remove('srp-new'); toggle(v); });
    tools.appendChild(b);
    return b;
}
const SRP_ICON_RAIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 15a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a3.5 3.5 0 0 1 .5 6.96"/><path d="M9 18l-1 2.5M13 18l-1 2.5M17 17l-1 2.5"/></svg>';
const SRP_ICON_SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M5 16a7 7 0 0 1 14 0"/><path d="M3 19h18M12 4v3M5.6 7.6l2 2M18.4 7.6l-2 2"/></svg>';

// נשימה ארוכה במנוחה (ערסל / ספסל): הכפתורים נעלמים ורק הנוף נשאר. נגיעה - חוזרים
function srpRest(box) { box.classList.add('is-resting'); }

// ---------- צלילים: הגיטרה והפטיפון (נוצרים במקום, בלי קבצים) ----------
let srpAudio = null;
function srpCtx() {
    if (!srpAudio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        const ctx = new AC();
        const master = ctx.createGain();
        master.gain.value = 0.55;
        master.connect(ctx.destination);
        srpAudio = { ctx, master, loop: null };
    }
    if (srpAudio.ctx.state === 'suspended') srpAudio.ctx.resume();
    return srpAudio;
}
function srpNote(freq, when, dur, vol, type = 'triangle', attack = 0.008) {
    const a = srpCtx();
    if (!a) return;
    const { ctx, master } = a;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.connect(f); f.connect(g); g.connect(master);
    o.start(when);
    o.stop(when + dur + 0.05);
}
// פריטה על הגיטרה: אקורד אחר בכל נגיעה (סול, דו, רה, מי מינור)
const SRP_CHORDS = [[98.0, 123.47, 146.83, 196.0, 246.94, 392.0], [130.81, 164.81, 196.0, 261.63, 329.63], [146.83, 220.0, 293.66, 369.99], [82.41, 123.47, 164.81, 196.0, 246.94, 329.63]];
function srpStrum(i) {
    const a = srpCtx();
    if (!a) return;
    const now = a.ctx.currentTime + 0.02;
    SRP_CHORDS[i % SRP_CHORDS.length].forEach((f, k) => { srpNote(f, now + k * 0.035, 2.3, 0.13); srpNote(f * 2, now + k * 0.035, 0.9, 0.025, 'sine'); });
}
// הפטיפון: לופ רך של ארבעה אקורדים עם ארפג'ו
const SRP_SONG = { bpm: 72, chords: [[261.63, 329.63, 392.0], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [196.0, 246.94, 293.66]] };
function srpMusicStart() {
    const a = srpCtx();
    if (!a) return;
    srpMusicStop(true);
    const beat = 60 / SRP_SONG.bpm;
    let bar = 0, next = a.ctx.currentTime + 0.12;
    const step = [0, 1, 2, 1, 0, 2, 1, 2];
    const schedule = () => {
        while (next < a.ctx.currentTime + 1.4) {
            const ch = SRP_SONG.chords[bar % SRP_SONG.chords.length];
            ch.forEach(f => srpNote(f / 2, next, beat * 4.2, 0.022, 'sine', 0.5));
            step.forEach((s, k) => srpNote(ch[s], next + k * beat / 2, 1.3, 0.045));
            next += beat * 4;
            bar++;
        }
        a.loop = setTimeout(schedule, 500);
    };
    schedule();
}
function srpMusicStop(quick) {
    if (!srpAudio) return;
    clearTimeout(srpAudio.loop);
    srpAudio.loop = null;
    if (quick) return;
    // מה שכבר תוזמן נעלם בדעיכה קצרה, ואז מתחילים מחדש עם עוצמה מלאה
    const { ctx, master } = srpAudio;
    master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.08);
    setTimeout(() => {
        try { master.disconnect(); } catch {}
        const m = ctx.createGain();
        m.gain.value = 0.55;
        m.connect(ctx.destination);
        srpAudio.master = m;
    }, 450);
}

// ---------- דלת 2: המרפסת מול הים ----------
function srpPorchScene(keys) {
    const tabletOpen = keys >= roomUnlockAt('tablet');
    const bottle = keys >= roomUnlockAt('bottle');
    let rain = '';
    for (let i = 0; i < 34; i++) {
        const x = 34 + ((i * 53) % 322), y = 90 + ((i * 97) % 420);
        rain += `<line x1="${x}" y1="${y}" x2="${x - 3}" y2="${y + 15}"/>`;
    }
    return `
        <svg class="srp-scene" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('porch'))}">
            <defs>
                <linearGradient id="srpPSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0a1030"/><stop offset="0.7" stop-color="#2b2a66"/><stop offset="1" stop-color="#5a3f7a"/></linearGradient>
                <linearGradient id="srpPSea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b3a78"/><stop offset="1" stop-color="#0f1640"/></linearGradient>
                <linearGradient id="srpPDeck" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6b4630"/><stop offset="1" stop-color="#8a5c3e"/></linearGradient>
                <radialGradient id="srpPMoon" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff4c9" stop-opacity="0.5"/><stop offset="1" stop-color="#fff4c9" stop-opacity="0"/></radialGradient>
                <radialGradient id="srpPLantern" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
                <radialGradient id="srpPTab" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#9fd8ff" stop-opacity="0.3"/><stop offset="1" stop-color="#9fd8ff" stop-opacity="0"/></radialGradient>
                <linearGradient id="srpPScreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="0.55" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient>
                <radialGradient id="srpPBottle" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#bff5e6" stop-opacity="0.55"/><stop offset="1" stop-color="#bff5e6" stop-opacity="0"/></radialGradient>
            </defs>
            <g aria-hidden="true">
                <rect width="390" height="520" fill="url(#srpPSky)"/>
                <g class="srp-moon"><circle cx="120" cy="250" r="60" fill="url(#srpPMoon)"/><circle cx="120" cy="250" r="20" fill="#fff4c9"/></g>
                <g fill="#fff" class="sr-twinkle"><circle cx="40" cy="160" r="1.3"/><circle cx="210" cy="140" r="1.1"/><circle cx="300" cy="190" r="1.4"/><circle cx="350" cy="120" r="1"/><circle cx="250" cy="260" r="1.1"/></g>
                <rect y="400" width="390" height="140" fill="url(#srpPSea)"/>
                <g class="srp-waves">
                    <g stroke="#fff4c9" stroke-linecap="round" opacity="0.6"><line x1="96" y1="412" x2="144" y2="412" stroke-width="2"/><line x1="104" y1="424" x2="136" y2="424" stroke-width="1.6"/><line x1="110" y1="436" x2="130" y2="436" stroke-width="1.2"/><line x1="114" y1="448" x2="126" y2="448" stroke-width="1"/></g>
                    <g stroke="#9fb3ff" stroke-opacity="0.35" stroke-linecap="round"><line x1="220" y1="420" x2="244" y2="420"/><line x1="300" y1="440" x2="320" y2="440"/><line x1="30" y1="452" x2="48" y2="452"/></g>
                </g>
                <path d="M250 400 Q300 372 390 380 V400 Z" fill="#141a3e"/>
                <g class="srp-rain">
                    <rect width="390" height="540" fill="#0a0f2a" opacity="0.35"/>
                    <g class="srp-rain-a" stroke="#b9c6ff" stroke-opacity="0.55" stroke-width="1.2" stroke-linecap="round">${rain}</g>
                    <g transform="translate(17 30)"><g class="srp-rain-b" stroke="#d8e0ff" stroke-opacity="0.35" stroke-width="1" stroke-linecap="round">${rain}</g></g>
                    <g class="srp-ripples" fill="none" stroke="#9fb3ff" stroke-opacity="0.55"><ellipse cx="80" cy="430" rx="10" ry="2.5"/><ellipse cx="200" cy="452" rx="12" ry="3" style="animation-delay:.5s"/><ellipse cx="300" cy="424" rx="9" ry="2.2" style="animation-delay:1s"/><ellipse cx="150" cy="462" rx="11" ry="2.6" style="animation-delay:.8s"/></g>
                </g>
            </g>
            ${bottle ? `<g class="srp-hot srp-bottle" data-place-hot="bottle" role="button" tabindex="0" aria-label="${srEsc(t('room_bottle_aria'))}">
                <g class="srp-bottle-drift"><g class="srp-bottle-bob">
                    <circle cx="296" cy="444" r="36" fill="url(#srpPBottle)"/>
                    <g transform="rotate(-18 296 446)">
                        <rect x="276" y="438" width="34" height="16" rx="7" fill="#bff5e6" opacity="0.6"/>
                        <rect x="308" y="442" width="10" height="8" rx="2" fill="#bff5e6" opacity="0.6"/>
                        <rect class="srp-cork" x="317" y="441.5" width="6" height="9" rx="1.5" fill="#b07b3a"/>
                        <rect x="282" y="441" width="22" height="10" rx="4" fill="#f6ecd9"/>
                        <rect x="290" y="440" width="3" height="12" fill="#ff7ab0"/>
                        <path d="M280 441 h20" stroke="#fff" stroke-opacity="0.75" stroke-width="1.2" stroke-linecap="round"/>
                    </g>
                    <ellipse cx="296" cy="459" rx="22" ry="3" fill="none" stroke="#bff5e6" stroke-opacity="0.45"/>
                </g></g>
                <ellipse class="srp-hit" cx="298" cy="446" rx="38" ry="26" fill="transparent"/>
            </g>` : ''}
            <g aria-hidden="true">
                <polygon points="0,0 390,0 390,74 0,74" fill="#3a2418"/>
                <line x1="0" y1="74" x2="390" y2="74" stroke="#5a3a26" stroke-width="6"/>
                <rect x="16" y="74" width="16" height="560" fill="#5a3a26"/>
                <rect x="358" y="74" width="16" height="560" fill="#5a3a26"/>
                <path d="M32 96 Q110 128 195 104 T358 98" fill="none" stroke="#c9a36b" stroke-width="1.2"/>
                <g class="srp-flicker"><circle cx="70" cy="108" r="3" fill="#ffd27a"/><circle cx="130" cy="116" r="3" fill="#ff9ecf"/><circle cx="195" cy="104" r="3" fill="#ffd27a"/><circle cx="260" cy="104" r="3" fill="#ff9ecf"/><circle cx="320" cy="100" r="3" fill="#ffd27a"/></g>
                <polygon points="0,520 390,520 390,844 0,844" fill="url(#srpPDeck)"/>
                <g stroke="#4a2f1d" stroke-width="1.4"><line x1="0" y1="560" x2="390" y2="560"/><line x1="0" y1="608" x2="390" y2="608"/><line x1="0" y1="666" x2="390" y2="666"/><line x1="0" y1="734" x2="390" y2="734"/><line x1="0" y1="812" x2="390" y2="812"/></g>
                <rect x="32" y="470" width="326" height="8" rx="2" fill="#7a5236"/>
                <g fill="#6b4630"><rect x="44" y="478" width="6" height="44"/><rect x="90" y="478" width="6" height="44"/><rect x="136" y="478" width="6" height="44"/><rect x="182" y="478" width="6" height="44"/><rect x="228" y="478" width="6" height="44"/><rect x="274" y="478" width="6" height="44"/><rect x="320" y="478" width="6" height="44"/></g>
                <circle cx="32" cy="300" r="5" fill="#c9a36b"/><circle cx="358" cy="300" r="5" fill="#c9a36b"/>
            </g>
            <g class="srp-hot srp-hammock" data-place-hot="hammock" role="button" tabindex="0" aria-label="${srEsc(t('room_hammock_aria'))}">
                <g class="srp-swing">
                    <g stroke="#e3cfa3" stroke-width="1.3"><line x1="32" y1="304" x2="78" y2="380"/><line x1="358" y1="304" x2="312" y2="380"/></g>
                    <path d="M78 376 Q195 498 312 376 Q195 438 78 376 Z" fill="#2fa58c"/>
                    <path d="M92 388 Q195 484 298 388" fill="none" stroke="#bff5e6" stroke-width="3"/>
                    <path d="M108 402 Q195 476 282 402" fill="none" stroke="#ffd27a" stroke-width="2.4"/>
                    <ellipse cx="116" cy="400" rx="22" ry="11" fill="#fff1d6" transform="rotate(16 116 400)"/>
                </g>
                <path class="srp-hit" d="M66 356 L324 356 L300 462 L90 462 Z" fill="transparent"/>
            </g>
            <g aria-hidden="true">
                <circle class="srp-flicker" cx="90" cy="650" r="80" fill="url(#srpPLantern)"/>
                <g transform="translate(74 618)">
                    <path d="M6 0 h20 l4 8 v30 l-4 6 h-20 l-4 -6 v-30 z" fill="#2b1a12"/>
                    <rect class="srp-flicker" x="8" y="10" width="16" height="26" rx="3" fill="#ffcf8a"/>
                    <path d="M16 30 q-5 -7 0 -14 q5 7 0 14z" fill="#ff8a3d"/>
                    <path d="M10 0 q6 -10 12 0" fill="none" stroke="#2b1a12" stroke-width="2"/>
                </g>
                <g transform="translate(244 640)">
                    <rect x="0" y="40" width="110" height="52" rx="4" fill="#9a6a44"/>
                    <path d="M0 54 h110 M0 70 h110 M55 40 v52" stroke="#7a5236" stroke-width="2"/>
                </g>
            </g>
            <g class="srp-hot srp-tablet${tabletOpen ? ' is-open' : ' locked'}" data-place-hot="tablet" role="button" tabindex="0" aria-label="${srEsc(roomItemName('tablet'))}">
                ${tabletOpen ? '<circle cx="300" cy="636" r="86" fill="url(#srpPTab)"/>' : ''}
                <path d="M292 668 l-12 14 h40 l-12 -14 z" fill="#3b3b44"/>
                <rect x="250" y="592" width="100" height="72" rx="10" fill="#26262e" stroke="#4a4a56" stroke-width="1"/>
                <rect x="256" y="598" width="88" height="60" rx="5" fill="${tabletOpen ? 'url(#srpPScreen)' : '#0d1424'}"/>
                <circle cx="300" cy="595" r="1.3" fill="#5a5a66"/>
                ${tabletOpen
        ? '<g opacity="0.85"><circle cx="280" cy="616" r="9" fill="#fff" opacity="0.25"/><rect x="296" y="610" width="36" height="6" rx="3" fill="#fff" opacity="0.5"/><rect x="296" y="622" width="26" height="6" rx="3" fill="#fff" opacity="0.35"/><rect x="266" y="640" width="68" height="8" rx="4" fill="#fff" opacity="0.3"/></g>'
        : `<g transform="translate(300 621) scale(0.55)">${srLockShape()}</g><text x="300" y="650" text-anchor="middle" font-size="8.5" font-weight="800" fill="#ffe2a6">${srEsc(t('room_key_n').replace('{n}', srFmt(roomUnlockAt('tablet'))))}</text>`}
                <rect class="srp-hit" x="242" y="584" width="116" height="104" fill="transparent"/>
            </g>
        </svg>`;
}
function srpInitPorch(box) {
    if (roomIsUnlocked('rain')) {
        const on = !!srpPrefs().rain;
        box.classList.toggle('is-rain', on);
        srpTool(box, 'rain', SRP_ICON_RAIN, on, v => { box.classList.toggle('is-rain', v); srpSetPref('rain', v); });
    }
    return {
        hammock: () => srpRest(box),
        tablet: el => {
            if (el.classList.contains('locked')) { srShowLockTip('tablet'); return; }
            srShowTip(t('room_tablet_soon'));
        },
        bottle: el => srpOpenBottle(el),
    };
}

// הבקבוק מהים (המפתח האחרון): הפקק עף, והמכתב מהעבר נפתח. נרשם שנפתח רק כשהמפתחות אמיתיים -
// כפתור המפתחות של מנהלת המוצר לא "פותח" את המכתב שלה לפני הזמן
async function srpOpenBottle(el) {
    if (el) { el.classList.add('is-open'); await new Promise(r => setTimeout(r, srpReduce() ? 0 : 650)); }
    const p = (typeof nmProfile !== 'undefined' && nmProfile) || {};
    const has = !!(p.letter_written_at && p.letter_text);
    const body = has
        ? `<div class="nm-letter-paper srp-letter"><p class="nm-letter-body">${srEsc(p.letter_text).replace(/\n/g, '<br>')}</p><p class="nm-letter-date">${srEsc(t('nm_letter_written_on').replace('{date}', nmLongDate(String(p.letter_written_at).slice(0, 10))))}</p></div>`
        : `<p class="nm-fine">${srEsc(t('nm_letter_none'))}</p>`;
    const ov = nmOpenSheet(`
        <h4>✉️ ${srEsc(t('nm_letter_gift_title'))}</h4>
        ${body}
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'srp-bottle-sheet', () => { if (el) el.classList.remove('is-open'); });
    const paper = ov.querySelector('.srp-letter');
    if (paper && typeof spawnGentleConfettiBurst === 'function') setTimeout(() => spawnGentleConfettiBurst(paper, 26), 250);
    if (has && !p.letter_opened_at && roomRealKeys() >= roomUnlockAt('bottle') && supabaseClient && currentUserId) {
        const now = new Date().toISOString();
        const { error } = await supabaseClient.from('new_me_profile').update({ letter_opened_at: now }).eq('user_id', currentUserId);
        if (!error) p.letter_opened_at = now;
    }
}

// ---------- דלת 3: הגיטרה והיומן ----------
function srpMusicScene(keys) {
    const vinyl = keys >= roomUnlockAt('vinyl');
    return `
        <svg class="srp-scene" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('music'))}">
            <defs>
                <linearGradient id="srpMWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a1d2a"/><stop offset="1" stop-color="#5a2e3a"/></linearGradient>
                <linearGradient id="srpMFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2416"/><stop offset="1" stop-color="#5e3c27"/></linearGradient>
                <linearGradient id="srpMWood" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3a25c"/><stop offset="1" stop-color="#a5622e"/></linearGradient>
                <radialGradient id="srpMLamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.6"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
                <pattern id="srpMPaper" width="30" height="30" patternUnits="userSpaceOnUse"><circle cx="15" cy="15" r="1.4" fill="#fff" opacity="0.06"/></pattern>
            </defs>
            <g aria-hidden="true">
                <rect width="390" height="610" fill="url(#srpMWall)"/>
                <rect width="390" height="610" fill="url(#srpMPaper)"/>
                <rect width="390" height="70" fill="#1e0f18"/>
                <polygon points="0,610 390,610 390,844 0,844" fill="url(#srpMFloor)"/>
                <g stroke="#000" stroke-opacity="0.24" stroke-width="1.1"><line x1="0" y1="644" x2="390" y2="644"/><line x1="0" y1="690" x2="390" y2="690"/><line x1="0" y1="748" x2="390" y2="748"/><line x1="0" y1="814" x2="390" y2="814"/></g>
                <rect y="602" width="390" height="10" fill="#1e0f18"/>
                <g transform="translate(40 140)"><circle cx="40" cy="40" r="38" fill="#141014"/><circle cx="40" cy="40" r="26" fill="#1f1a1f" stroke="#2c262c" stroke-width="1"/><circle cx="40" cy="40" r="10" fill="#ff6aa5"/><circle cx="40" cy="40" r="2" fill="#141014"/></g>
                <g transform="translate(130 120)"><circle cx="34" cy="34" r="32" fill="#141014"/><circle cx="34" cy="34" r="21" fill="#1f1a1f"/><circle cx="34" cy="34" r="8" fill="#ffd27a"/><circle cx="34" cy="34" r="2" fill="#141014"/></g>
                <g transform="translate(206 150)"><circle cx="30" cy="30" r="28" fill="#141014"/><circle cx="30" cy="30" r="18" fill="#1f1a1f"/><circle cx="30" cy="30" r="7" fill="#7fd6ff"/><circle cx="30" cy="30" r="2" fill="#141014"/></g>
                <g transform="translate(286 110)"><rect x="0" y="0" width="70" height="90" rx="4" fill="#efe4d0"/><rect x="6" y="6" width="58" height="62" fill="#3a5a78"/><path d="M10 60 l14 -18 l10 12 l8 -8 l16 14 z" fill="#5bb87a"/><circle cx="48" cy="22" r="6" fill="#ffd27a"/></g>
                <circle cx="90" cy="500" r="150" fill="url(#srpMLamp)"/>
                <path d="M70 610 V470" stroke="#3a2416" stroke-width="3"/>
                <path class="srp-flicker" d="M48 470 h44 l-10 -34 h-24 z" fill="#ffb85c"/>
                <ellipse cx="70" cy="612" rx="18" ry="5" fill="#2a1a12"/>
                <g transform="translate(150 420)">
                    <path d="M0 60 Q0 0 60 0 H150 Q210 0 210 60 V170 H0 Z" fill="#8a3a4a"/>
                    <path d="M20 70 Q20 30 60 30 H150 Q190 30 190 70 V150 H20 Z" fill="#a24a5c"/>
                    <rect x="-14" y="80" width="40" height="110" rx="18" fill="#7a2f3e"/>
                    <rect x="184" y="80" width="40" height="110" rx="18" fill="#7a2f3e"/>
                    <rect x="20" y="130" width="170" height="40" rx="10" fill="#b65a6b"/>
                    <rect x="10" y="190" width="10" height="20" fill="#3a2416"/><rect x="190" y="190" width="10" height="20" fill="#3a2416"/>
                    <path d="M40 120 q60 -16 120 0 v20 q-60 -10 -120 0 z" fill="#f0c7d1" opacity="0.9"/>
                </g>
                <ellipse cx="210" cy="760" rx="150" ry="42" fill="#3f6b5a" opacity="0.9"/>
                <ellipse cx="210" cy="760" rx="106" ry="27" fill="#4b7c68" opacity="0.7"/>
            </g>
            <g class="srp-hot srp-guitar" data-place-hot="guitar" role="button" tabindex="0" aria-label="${srEsc(t('room_guitar_aria'))}">
                <g class="srp-guitar-shake"><g transform="translate(26 488) rotate(-12)">
                    <rect x="54" y="-118" width="10" height="120" rx="3" fill="#5a3418"/>
                    <rect x="50" y="-140" width="18" height="26" rx="4" fill="#3a2010"/>
                    <g fill="#e8e8e8"><circle cx="48" cy="-134" r="2"/><circle cx="48" cy="-124" r="2"/><circle cx="70" cy="-134" r="2"/><circle cx="70" cy="-124" r="2"/></g>
                    <path d="M59 -10 C20 -10 18 30 36 44 C14 60 22 104 59 104 C96 104 104 60 82 44 C100 30 98 -10 59 -10 Z" fill="url(#srpMWood)"/>
                    <circle cx="59" cy="44" r="12" fill="#2a1408"/>
                    <rect x="47" y="76" width="24" height="5" rx="2" fill="#3a2010"/>
                    <g stroke="#f5f0e0" stroke-width="0.7" opacity="0.8"><line x1="56" y1="-136" x2="56" y2="78"/><line x1="59" y1="-136" x2="59" y2="78"/><line x1="62" y1="-136" x2="62" y2="78"/></g>
                </g></g>
                <path d="M60 600 l26 -44 M86 600 l-10 -44" stroke="#3a2416" stroke-width="3"/>
                <rect class="srp-hit" x="18" y="336" width="124" height="270" fill="transparent"/>
            </g>
            <g aria-hidden="true" transform="translate(270 520)">
                <ellipse cx="44" cy="80" rx="40" ry="8" fill="#000" opacity="0.3"/>
                <rect x="40" y="20" width="8" height="60" fill="#5a3418"/>
                <ellipse cx="44" cy="20" rx="44" ry="12" fill="#8a5a3c"/>
            </g>
            <g class="srp-hot srp-diary" data-place-hot="diary" role="button" tabindex="0" aria-label="${srEsc(t('room_diary_title'))}">
                <g transform="translate(284 516) rotate(-6)">
                    <rect x="0" y="0" width="64" height="18" rx="3" fill="#6b3fa0"/>
                    <rect x="2" y="-2" width="30" height="18" rx="2" fill="#f6ecd9"/><rect x="32" y="-2" width="30" height="18" rx="2" fill="#efe2c8"/>
                    <g stroke="#b9a07a" stroke-width="0.8"><line x1="6" y1="3" x2="28" y2="3"/><line x1="6" y1="7" x2="26" y2="7"/><line x1="36" y1="3" x2="58" y2="3"/><line x1="36" y1="7" x2="54" y2="7"/></g>
                    <rect x="30" y="-6" width="3" height="24" fill="#ff4fa3"/>
                </g>
                <path d="M344 520 l18 -12" stroke="#2a1145" stroke-width="2.4" stroke-linecap="round"/>
                <rect class="srp-hit" x="276" y="494" width="92" height="46" fill="transparent"/>
            </g>
            <g class="srp-notes" aria-hidden="true">
                <g class="srp-note-amb"><path d="M110 330 v-18 l12 -3 v18" fill="none" stroke="#ffd27a" stroke-width="2"/><circle cx="107" cy="331" r="3.4" fill="#ffd27a"/><circle cx="119" cy="328" r="3.4" fill="#ffd27a"/></g>
            </g>
            ${vinyl ? `<g class="srp-hot srp-vinyl" data-place-hot="vinyl" role="button" tabindex="0" aria-label="${srEsc(roomItemName('vinyl'))}" aria-pressed="false">
                <ellipse cx="66" cy="782" rx="58" ry="9" fill="#000" opacity="0.3"/>
                <rect x="14" y="716" width="104" height="62" rx="6" fill="#7a4a2c"/>
                <rect x="20" y="724" width="44" height="46" rx="3" fill="#6a3f25"/><rect x="68" y="724" width="44" height="46" rx="3" fill="#6a3f25"/>
                <circle cx="58" cy="747" r="2" fill="#d9b98a"/><circle cx="74" cy="747" r="2" fill="#d9b98a"/>
                <rect x="10" y="700" width="112" height="18" rx="4" fill="#3a2416"/>
                <g transform="translate(58 699) scale(1 0.34)"><g class="srp-record"><circle r="30" fill="#141014"/><circle r="22" fill="none" stroke="#2c262c" stroke-width="1.4"/><circle r="15" fill="none" stroke="#2c262c" stroke-width="1.4"/><circle r="9" fill="#ff6aa5"/><rect x="2" y="-1.8" width="7" height="3.6" fill="#ffd27a"/></g></g>
                <g class="srp-arm"><circle cx="106" cy="694" r="3" fill="#c9c9d0"/><path d="M106 694 L86 690" stroke="#c9c9d0" stroke-width="2.2" stroke-linecap="round"/></g>
                <rect class="srp-hit" x="6" y="676" width="122" height="112" fill="transparent"/>
            </g>` : ''}
        </svg>`;
}
function srpInitMusic(box) {
    let chord = 0;
    srpCleanups.push(() => srpMusicStop());
    const floatNotes = (x, y, n) => {
        const g = box.querySelector('.srp-notes');
        for (let i = 0; i < n; i++) {
            setTimeout(() => {
                if (!g.isConnected) return;
                const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                el.setAttribute('x', x + i * 9);
                el.setAttribute('y', y - i * 4);
                el.setAttribute('class', 'srp-note-fly');
                el.style.setProperty('--nx', `${(i % 2 ? 1 : -1) * (10 + i * 6)}px`);
                el.textContent = i % 2 ? '♪' : '♫';
                g.appendChild(el);
                setTimeout(() => el.remove(), 1900);
            }, i * 160);
        }
    };
    return {
        guitar: el => {
            srpStrum(chord++);
            el.classList.remove('is-strum'); void el.getBoundingClientRect(); el.classList.add('is-strum');
            floatNotes(96, 360, 3);
        },
        diary: () => srpOpenDiary(),
        vinyl: el => {
            const on = el.getAttribute('aria-pressed') !== 'true';
            el.setAttribute('aria-pressed', on ? 'true' : 'false');
            el.classList.toggle('is-playing', on);
            if (on) { srpMusicStart(); floatNotes(60, 680, 2); } else srpMusicStop();
        },
    };
}

// היומן (לפי בקשה מפורשת: "יומן לכתוב בו - שנשמר"): דף חדש למעלה, והדפים הקודמים מתחת.
// נשמר בחשבון (new_me_diary, רק לבעלים) - כדי שיהיה בכל מכשיר
async function srpOpenDiary() {
    let pages = [];
    if (supabaseClient && currentUserId) {
        const { data } = await supabaseClient.from('new_me_diary').select('id, body, created_at').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(100);
        pages = data || [];
    }
    const pageDate = ts => { const d = new Date(ts); return isNaN(d) ? '' : nmLongDate(getLocalDateString(d)); };
    const ov = nmOpenSheet(`
        <h4>${srEsc(t('room_diary_title'))}</h4>
        <textarea class="srp-diary-input" rows="6" maxlength="8000" placeholder="${srEsc(t('room_diary_ph'))}" aria-label="${srEsc(t('room_diary_title'))}"></textarea>
        <button type="button" class="nm-btn-primary" data-save>${srEsc(t('room_diary_save'))}</button>
        ${pages.length ? `<ul class="srp-diary-list">${pages.map(p => `<li data-id="${srEsc(p.id)}"><button type="button" class="srp-diary-page" aria-expanded="false"><span class="srp-diary-date">${srEsc(pageDate(p.created_at))}</span><span class="srp-diary-snip">${srEsc(srClip(String(p.body).replace(/\s+/g, ' '), 80))}</span></button></li>`).join('')}</ul>` : ''}
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'srp-diary-sheet');
    const ta = ov.querySelector('.srp-diary-input');
    ov.querySelector('[data-save]').addEventListener('click', async e => {
        const text = ta.value.trim().slice(0, 8000);
        if (!text) { ta.focus(); return; }
        const btn = e.currentTarget;
        btn.disabled = true;
        const { error } = await supabaseClient.from('new_me_diary').insert({ user_id: currentUserId, body: text });
        if (error) { btn.disabled = false; showAppToast(t('nm_save_error'), 'error'); return; }
        showAppToast(t('room_diary_saved'));
        ov.remove();
        srpOpenDiary();
    });
    ov.querySelectorAll('.srp-diary-list li').forEach(li => {
        const page = pages.find(p => String(p.id) === li.dataset.id);
        const btn = li.querySelector('.srp-diary-page');
        btn.addEventListener('click', () => {
            const open = li.classList.toggle('open');
            btn.setAttribute('aria-expanded', open ? 'true' : 'false');
            li.querySelector('.srp-diary-full')?.remove();
            if (!open) return;
            const full = document.createElement('div');
            full.className = 'srp-diary-full';
            full.innerHTML = `<p>${srEsc(page.body).replace(/\n/g, '<br>')}</p><button type="button" class="srp-diary-del">${srEsc(t('room_diary_delete'))}</button>`;
            li.appendChild(full);
            const del = full.querySelector('.srp-diary-del');
            // מחיקה בשתי נגיעות: הראשונה שואלת, השנייה מוחקת
            del.addEventListener('click', async () => {
                if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = t('room_diary_delete_q'); return; }
                del.disabled = true;
                const { error } = await supabaseClient.from('new_me_diary').delete().eq('id', page.id).eq('user_id', currentUserId);
                if (error) { del.disabled = false; showAppToast(t('nm_save_error'), 'error'); return; }
                li.remove();
            });
        });
    });
    setTimeout(() => ta.focus({ preventScroll: true }), 120);
}

// ---------- דלת 4: חדר הנשימה - חוף בשקיעה ----------
// לפי בקשה מפורשת: "משהו מגניב שיגיד איך לנשום, סשן קצר של 10 דק', אל תרשום כמה דק' זה... נכנסים, לוחצים
// ומתחילים". שאיפה ~4 שניות (השמש עולה, הגל נכנס), נשיפה ~6 שניות (השמש שוקעת, הגל יוצא)
function srpBreathScene() {
    return `
        <svg class="srp-scene" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('breath'))}">
            <defs>
                <linearGradient id="srbDusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f1c45"/><stop offset="0.45" stop-color="#5e3a78"/><stop offset="0.78" stop-color="#d9706d"/><stop offset="1" stop-color="#f6b46c"/></linearGradient>
                <linearGradient id="srbDawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fb8e8"/><stop offset="0.5" stop-color="#f7c6d0"/><stop offset="0.8" stop-color="#ffd9a8"/><stop offset="1" stop-color="#fff0c4"/></linearGradient>
                <linearGradient id="srbSeaDusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8637a"/><stop offset="0.35" stop-color="#5a4682"/><stop offset="1" stop-color="#2d3468"/></linearGradient>
                <linearGradient id="srbSeaDawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c3b0"/><stop offset="0.35" stop-color="#8fb8d8"/><stop offset="1" stop-color="#4f7fb0"/></linearGradient>
                <linearGradient id="srbSand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0d0a2"/><stop offset="1" stop-color="#ddb07c"/></linearGradient>
                <radialGradient id="srbSun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff6d6"/><stop offset="0.55" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff9f5e"/></radialGradient>
                <radialGradient id="srbGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb46a" stop-opacity="0.5"/><stop offset="1" stop-color="#ffb46a" stop-opacity="0"/></radialGradient>
            </defs>
            <g aria-hidden="true">
                <rect class="srb-sky" width="390" height="474"/>
                <g class="srb-stars" fill="#fff" opacity="0.7"><circle cx="40" cy="110" r="1.4"/><circle cx="120" cy="80" r="1.1"/><circle cx="250" cy="96" r="1.5"/><circle cx="330" cy="130" r="1.2"/><circle cx="290" cy="60" r="1"/><circle cx="80" cy="170" r="1"/></g>
                <g fill="#f4a184" opacity="0.55"><ellipse cx="90" cy="372" rx="80" ry="5"/><ellipse cx="300" cy="352" rx="96" ry="6"/><ellipse cx="240" cy="404" rx="60" ry="4"/></g>
                <g fill="none" stroke="#3a2c55" stroke-width="2" stroke-linecap="round" opacity="0.8"><path d="M86 260 q8 -8 16 0 q8 -8 16 0"/><path d="M130 232 q6 -6 12 0 q6 -6 12 0"/></g>
                <g class="srb-sun"><circle cx="195" cy="472" r="135" fill="url(#srbGlow)"/><circle cx="195" cy="472" r="85" fill="url(#srbSun)"/></g>
                <rect class="srb-sea" y="472" width="390" height="190"/>
                <g fill="#ffcf8a"><rect x="150" y="478" width="90" height="3" rx="1.5" opacity="0.75"/><rect x="160" y="492" width="70" height="3" rx="1.5" opacity="0.65"/><rect x="145" y="508" width="100" height="3" rx="1.5" opacity="0.55"/><rect x="165" y="526" width="60" height="3" rx="1.5" opacity="0.5"/><rect x="140" y="546" width="110" height="3" rx="1.5" opacity="0.4"/><rect x="155" y="568" width="80" height="3" rx="1.5" opacity="0.35"/><rect x="135" y="592" width="120" height="3" rx="1.5" opacity="0.28"/></g>
                <g stroke="#fff" stroke-opacity="0.18" stroke-width="1.4" stroke-linecap="round"><line x1="30" y1="520" x2="80" y2="520"/><line x1="290" y1="540" x2="350" y2="540"/><line x1="60" y1="590" x2="110" y2="590"/><line x1="300" y1="606" x2="370" y2="606"/></g>
                <path d="M0 652 Q100 636 195 648 T390 642 V844 H0 Z" fill="url(#srbSand)"/>
                <path d="M0 652 Q100 636 195 648 T390 642 V662 Q290 668 195 664 T0 670 Z" fill="#c9966a" opacity="0.45"/>
                <g fill="#c99a6b" opacity="0.5"><ellipse cx="70" cy="800" rx="3" ry="1.6"/><ellipse cx="300" cy="820" rx="3" ry="1.6"/><ellipse cx="340" cy="720" rx="2.4" ry="1.3"/><ellipse cx="40" cy="730" rx="2.4" ry="1.3"/></g>
                <g class="srb-wave">
                    <path d="M-20 628 H410 V648 Q386 640 362 648 T314 648 T266 648 T218 648 T170 648 T122 648 T74 648 T26 648 T-20 648 Z" fill="#8fa3d4" opacity="0.35"/>
                    <path d="M-20 648 Q4 640 26 648 T74 648 T122 648 T170 648 T218 648 T266 648 T314 648 T362 648 T410 648 V656 Q386 664 362 656 T314 656 T266 656 T218 656 T170 656 T122 656 T74 656 T26 656 T-20 656 Z" fill="#fff" opacity="0.85"/>
                </g>
            </g>
            <text class="srb-cue srb-cue-in" x="195" y="252" text-anchor="middle">${srEsc(t('room_breath_in'))}</text>
            <text class="srb-cue srb-cue-out" x="195" y="252" text-anchor="middle">${srEsc(t('room_breath_out'))}</text>
        </svg>
        <div class="srb-panel srb-start">
            <p>${srEsc(t('room_breath_line'))}</p>
            <button type="button" class="srb-btn" data-breath="start">${srEsc(t('room_breath_start'))}</button>
        </div>
        <div class="srb-panel srb-stop"><button type="button" class="srb-btn ghost" data-breath="stop">${srEsc(t('room_breath_end'))}</button></div>`;
}
let srpWake = null;
async function srpWakeOn() { try { if (navigator.wakeLock && navigator.wakeLock.request) srpWake = await navigator.wakeLock.request('screen'); } catch {} }
function srpWakeOff() { try { if (srpWake) srpWake.release(); } catch {} srpWake = null; }
function srpInitBreath(box) {
    if (roomIsUnlocked('sunrise')) {
        const on = !!srpPrefs().sunrise;
        box.classList.toggle('is-sunrise', on);
        srpTool(box, 'sunrise', SRP_ICON_SUN, on, v => { box.classList.toggle('is-sunrise', v); srpSetPref('sunrise', v); });
    }
    let timer = null;
    const stop = done => {
        clearTimeout(timer);
        timer = null;
        if (!box.classList.contains('is-on')) return;
        box.classList.remove('is-on');
        srpWakeOff();
        if (done) showAppToast(t('room_breath_done'));
        const start = box.querySelector('[data-breath="start"]');
        if (start && box.isConnected) start.focus({ preventScroll: true });
    };
    box.querySelector('[data-breath="start"]').addEventListener('click', () => {
        box.classList.add('is-on');
        srpWakeOn();
        clearTimeout(timer);
        timer = setTimeout(() => stop(true), SRP_BREATH_MS);
        box.querySelector('[data-breath="stop"]').focus({ preventScroll: true });
    });
    box.querySelector('[data-breath="stop"]').addEventListener('click', () => stop(false));
    srpCleanups.push(() => stop(false));
    return {};
}

// ---------- דלת 5: השביל ביער ----------
// לפי בקשה מפורשת: "שילחצו על התאורה היא נכבית ויש יום בחוץ" - הפנסים מחליפים בין לילה ליום
const SRP_LANTERNS = [
    { x: 88, y: 650, r: 60, post: [86, 660, 4, 96], box: [78, 632, 20, 24], cap: 'M76 632 h24 l-4 -8 h-16 z', hit: [68, 620, 40, 140] },
    { x: 312, y: 610, r: 52, post: [310, 618, 4, 84], box: [303, 594, 18, 21], cap: 'M301 594 h22 l-4 -7 h-14 z', hit: [294, 582, 36, 124] },
    { x: 146, y: 520, r: 36, post: [145, 526, 3, 58], box: [140, 508, 13, 15], cap: 'M138 508 h17 l-3 -5 h-11 z', hit: [130, 496, 32, 92] },
    { x: 180, y: 434, r: 20, post: [179, 438, 2, 32], box: [176, 426, 8, 10], cap: '', hit: [168, 418, 24, 56] },
    { x: 220, y: 420, r: 17, post: [219, 424, 2, 28], box: [216, 413, 7, 9], cap: '', hit: [208, 404, 24, 52] },
];
function srpOutsideScene(keys) {
    const swing = keys >= roomUnlockAt('swing');
    const sign = keys >= roomUnlockAt('selfcare');
    const fire = keys >= roomUnlockAt('campfire');
    const L = SRP_LANTERNS;
    return `
        <svg class="srp-scene" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('outside'))}">
            <defs>
                <linearGradient id="srpOSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--o-sky-a)"/><stop offset="0.5" style="stop-color:var(--o-sky-b)"/><stop offset="1" style="stop-color:var(--o-sky-c)"/></linearGradient>
                <linearGradient id="srpOPath" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--o-path-a)"/><stop offset="1" style="stop-color:var(--o-path-b)"/></linearGradient>
                <radialGradient id="srpOLight" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
                <radialGradient id="srpOSun" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff4c9" stop-opacity="0.85"/><stop offset="1" stop-color="#fff4c9" stop-opacity="0"/></radialGradient>
                <radialGradient id="srpOFire" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffb05c" stop-opacity="0.6"/><stop offset="1" stop-color="#ffb05c" stop-opacity="0"/></radialGradient>
            </defs>
            <g aria-hidden="true">
                <rect width="390" height="844" fill="url(#srpOSky)"/>
                <g class="srp-night-only sr-twinkle" fill="#fff"><circle cx="150" cy="150" r="1.3"/><circle cx="230" cy="120" r="1.1"/><circle cx="196" cy="210" r="1.4"/><circle cx="260" cy="250" r="1"/><circle cx="130" cy="260" r="1.1"/><circle cx="300" cy="190" r="1.2"/></g>
                <g class="srp-day-only"><circle cx="196" cy="150" r="70" fill="url(#srpOSun)"/><circle cx="196" cy="150" r="24" fill="#ffe9a8"/></g>
                <g class="srp-day-only" fill="none" stroke="#4a5a6a" stroke-width="1.8" stroke-linecap="round"><path d="M150 224 q7 -7 14 0 q7 -7 14 0"/><path d="M196 196 q5 -5 10 0 q5 -5 10 0"/></g>
                <g style="fill:var(--o-far)"><rect x="40" y="120" width="10" height="300"/><rect x="120" y="160" width="8" height="260"/><rect x="262" y="150" width="8" height="270"/><rect x="330" y="110" width="10" height="310"/></g>
                <g style="fill:var(--o-canopy)"><ellipse cx="45" cy="140" rx="46" ry="60"/><ellipse cx="124" cy="176" rx="36" ry="48"/><ellipse cx="266" cy="170" rx="38" ry="50"/><ellipse cx="336" cy="130" rx="50" ry="64"/></g>
                <path d="M0 400 Q195 380 390 400 V844 H0 Z" style="fill:var(--o-ground)"/>
                <path d="M100 844 C150 710 236 630 204 530 C190 482 192 436 196 398 L204 398 C204 436 204 482 220 530 C262 630 210 724 300 844 Z" fill="url(#srpOPath)"/>
                <g style="fill:var(--o-stone)" opacity="0.6"><ellipse cx="190" cy="780" rx="16" ry="5"/><ellipse cx="226" cy="712" rx="12" ry="4"/><ellipse cx="214" cy="640" rx="9" ry="3"/><ellipse cx="206" cy="570" rx="7" ry="2.4"/></g>
                <g style="fill:var(--o-grass)"><ellipse cx="40" cy="640" rx="70" ry="22"/><ellipse cx="350" cy="600" rx="60" ry="18"/><ellipse cx="120" cy="470" rx="40" ry="10"/><ellipse cx="290" cy="460" rx="36" ry="9"/></g>
                <path d="M26 264 Q90 244 162 256" fill="none" style="stroke:var(--o-trunk)" stroke-width="7" stroke-linecap="round"/>
            </g>
            ${swing ? `<g class="srp-hot srp-swing-hot" data-place-hot="swing" role="button" tabindex="0" aria-label="${srEsc(roomItemName('swing'))}">
                <g class="srp-swinger">
                    <g stroke="#c9b48a" stroke-width="1.6"><line x1="84" y1="254" x2="84" y2="404"/><line x1="118" y1="254" x2="118" y2="404"/></g>
                    <rect x="74" y="402" width="54" height="8" rx="2" fill="#8a5e3c"/>
                </g>
                <rect class="srp-hit" x="62" y="248" width="78" height="176" fill="transparent"/>
            </g>` : ''}
            <g class="srp-hot srp-lights" data-place-hot="lights" role="button" tabindex="0" aria-label="${srEsc(t('room_lights_aria'))}" aria-pressed="true">
                <g class="srp-night-only srp-flicker">${L.map(l => `<circle cx="${l.x}" cy="${l.y}" r="${l.r}" fill="url(#srpOLight)"/>`).join('')}</g>
                <g fill="#141414">${L.map(l => `<rect x="${l.post[0]}" y="${l.post[1]}" width="${l.post[2]}" height="${l.post[3]}"/>`).join('')}</g>
                <g class="srp-lamp" style="fill:var(--o-lamp)">${L.map(l => `<rect x="${l.box[0]}" y="${l.box[1]}" width="${l.box[2]}" height="${l.box[3]}" rx="${l.box[2] > 12 ? 4 : 2}"/>`).join('')}</g>
                <g fill="#141414">${L.filter(l => l.cap).map(l => `<path d="${l.cap}"/>`).join('')}</g>
                ${L.map(l => `<rect class="srp-hit" x="${l.hit[0]}" y="${l.hit[1]}" width="${l.hit[2]}" height="${l.hit[3]}" fill="transparent"/>`).join('')}
            </g>
            ${sign ? `<g class="srp-hot srp-sign" data-place-hot="selfcare" role="button" tabindex="0" aria-label="${srEsc(t('room_selfcare_title'))}">
                <rect x="300" y="470" width="4" height="40" fill="#5a3a24"/>
                <rect x="270" y="438" width="64" height="34" rx="4" fill="#8a5e3c"/>
                <rect x="275" y="443" width="54" height="24" rx="2" fill="#a8774d"/>
                <g stroke="#f3e6cf" stroke-width="1.6" stroke-linecap="round" opacity="0.85"><line x1="282" y1="451" x2="312" y2="451"/><line x1="282" y1="459" x2="304" y2="459"/></g>
                <path d="M318 452 q2.5 -3.5 5 0 q2.5 -3.5 5 0 q0 3.5 -5 6.5 q-5 -3 -5 -6.5z" fill="#ff7ab0"/>
                <rect class="srp-hit" x="264" y="432" width="76" height="80" fill="transparent"/>
            </g>` : ''}
            <g class="srp-hot srp-bench" data-place-hot="bench" role="button" tabindex="0" aria-label="${srEsc(t('room_bench_aria'))}">
                <g transform="translate(246 536)">
                    <rect x="0" y="0" width="84" height="8" rx="2" style="fill:var(--o-bench)"/>
                    <rect x="0" y="-26" width="84" height="6" rx="2" style="fill:var(--o-bench)"/>
                    <rect x="0" y="-14" width="84" height="6" rx="2" style="fill:var(--o-bench)"/>
                    <rect x="4" y="-30" width="5" height="62" fill="#5a3a24"/><rect x="75" y="-30" width="5" height="62" fill="#5a3a24"/>
                    <rect x="10" y="8" width="5" height="24" fill="#5a3a24"/><rect x="69" y="8" width="5" height="24" fill="#5a3a24"/>
                </g>
                <rect class="srp-hit" x="240" y="500" width="96" height="74" fill="transparent"/>
            </g>
            <g aria-hidden="true">
                <g style="fill:var(--o-trunk)"><rect x="-6" y="0" width="40" height="844"/><rect x="360" y="0" width="38" height="844"/></g>
                <g style="fill:var(--o-canopy-near)"><ellipse cx="10" cy="60" rx="90" ry="90"/><ellipse cx="380" cy="40" rx="96" ry="96"/></g>
            </g>
            ${fire ? `<g class="srp-hot srp-campfire" data-place-hot="campfire" role="button" tabindex="0" aria-label="${srEsc(roomItemName('campfire'))}" aria-pressed="true">
                <g class="srp-fire-lit"><circle class="srp-flicker" cx="326" cy="778" r="74" fill="url(#srpOFire)"/></g>
                <g fill="#6f7377"><ellipse cx="300" cy="800" rx="9" ry="6"/><ellipse cx="318" cy="806" rx="9" ry="6"/><ellipse cx="338" cy="806" rx="9" ry="6"/><ellipse cx="354" cy="799" rx="8" ry="6"/></g>
                <g stroke-linecap="round"><line x1="304" y1="796" x2="348" y2="782" stroke="#6b4426" stroke-width="7"/><line x1="306" y1="782" x2="350" y2="796" stroke="#5a3a20" stroke-width="7"/></g>
                <g class="srp-fire-lit">
                    <path class="srp-fire-flame" d="M327 790 C310 772 316 752 326 738 C332 754 344 760 340 776 C338 784 334 788 327 790 Z" fill="#ff8a3d"/>
                    <path class="srp-fire-flame" d="M327 790 C318 778 322 766 328 756 C332 768 338 772 335 782 C333 786 331 789 327 790 Z" fill="#ffd27a" style="animation-delay:.25s"/>
                    <g fill="#ffd27a" class="srp-sparks"><circle cx="320" cy="736" r="1.4"/><circle cx="334" cy="728" r="1.2"/><circle cx="328" cy="716" r="1"/></g>
                </g>
                <path class="srp-fire-smoke" d="M326 780 q-6 -12 2 -22 q8 -10 0 -22" fill="none" stroke="#c9c9d0" stroke-width="2" opacity="0.5" stroke-linecap="round"/>
                <rect class="srp-hit" x="286" y="728" width="84" height="88" fill="transparent"/>
            </g>` : ''}
            <g class="srp-night-only" fill="#ffe48e" aria-hidden="true"><circle class="srp-fly" cx="70" cy="560" r="2"/><circle class="srp-fly" cx="320" cy="690" r="2.2" style="animation-delay:1s"/><circle class="srp-fly" cx="260" cy="380" r="1.6" style="animation-delay:2s"/><circle class="srp-fly" cx="110" cy="380" r="1.6" style="animation-delay:.5s"/><circle class="srp-fly" cx="350" cy="480" r="1.8" style="animation-delay:1.6s"/></g>
        </svg>`;
}
function srpInitOutside(box) {
    const prefs = srpPrefs();
    const lights = box.querySelector('.srp-lights');
    const setDay = (day, save) => {
        box.classList.toggle('is-day', day);
        if (lights) lights.setAttribute('aria-pressed', day ? 'false' : 'true');
        if (save) {
            srpSetPref('day', day);
            const v = box.querySelector('.srp-view');
            v.classList.remove('srp-switch'); void v.offsetWidth; v.classList.add('srp-switch');
        }
    };
    setDay(!!prefs.day, false);
    const fire = box.querySelector('.srp-campfire');
    if (fire) {
        const lit = prefs.campfire !== false;
        fire.classList.toggle('is-lit', lit);
        fire.setAttribute('aria-pressed', lit ? 'true' : 'false');
    }
    return {
        lights: () => setDay(!box.classList.contains('is-day'), true),
        bench: () => srpRest(box),
        selfcare: () => srpOpenSelfCare(),
        swing: el => {
            if (el.classList.contains('is-swinging')) return;
            el.classList.add('is-swinging');
            setTimeout(() => el.classList.remove('is-swinging'), srpReduce() ? 300 : 4300);
        },
        campfire: el => {
            const lit = !el.classList.contains('is-lit');
            el.classList.toggle('is-lit', lit);
            el.setAttribute('aria-pressed', lit ? 'true' : 'false');
            srpSetPref('campfire', lit);
        },
    };
}

// השלט ליד הספסל (מתוך הרעיונות שלה ליער: "לדאוג לעצמך – בדיקה"): רשימה קטנה לסמן בה ✓ - רק להיום, רק במכשיר
function srpOpenSelfCare() {
    const key = `weekwise_room_care_${currentUserId || 'me'}`;
    const today = getLocalDateString();
    let st = {};
    try { st = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch {}
    if (st.day !== today || !Array.isArray(st.on)) st = { day: today, on: [] };
    const items = [1, 2, 3, 4, 5, 6].map(i => `<button type="button" class="srp-care-item${st.on.includes(i) ? ' on' : ''}" data-care="${i}" aria-pressed="${st.on.includes(i)}"><span class="srp-care-box" aria-hidden="true"></span><span>${srEsc(t('room_selfcare_' + i))}</span></button>`).join('');
    const ov = nmOpenSheet(`
        <h4>${srEsc(t('room_selfcare_title'))}</h4>
        <div class="srp-care">${items}</div>
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'srp-care-sheet');
    ov.querySelectorAll('[data-care]').forEach(b => b.addEventListener('click', () => {
        const i = Number(b.dataset.care);
        const on = !st.on.includes(i);
        st.on = on ? st.on.concat(i) : st.on.filter(x => x !== i);
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        try { localStorage.setItem(key, JSON.stringify(st)); } catch {}
    }));
}

// ---------- פנס המשאלות על הגג ----------
// נגיעה בפנס: כותבים משאלה (לא נשמרת בשום מקום) והפנס עף לשמיים ונעלם; אחרי רגע מחכה שם פנס חדש
function roomWishSvg() {
    return `<g class="sr-wish" role="button" tabindex="0" aria-label="${srEsc(roomItemName('wish'))}" transform="translate(236 452)">
        <defs><radialGradient id="srWishGlow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.7"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient></defs>
        <g class="sr-wish-inner">
            <circle cx="0" cy="-16" r="28" fill="url(#srWishGlow)"/>
            <path d="M-10 0 L-14 -30 Q0 -37 14 -30 L10 0 Z" fill="#ffcf8a"/>
            <path d="M-10 0 L-14 -30 Q0 -37 14 -30 L10 0" fill="none" stroke="#e8a058" stroke-width="0.9"/>
            <path d="M-4 -33 L-3 0 M4 -33 L3 0" stroke="#e8a058" stroke-width="0.7" opacity="0.8"/>
            <path d="M-3.5 -2 q3.5 -7 7 0 z" fill="#ff8a3d"/>
        </g>
        <ellipse class="sr-wish-hit" cx="0" cy="-16" rx="24" ry="28" fill="transparent"/>
    </g>`;
}
function roomInitWish(root, highlight) {
    const w = root.querySelector('.sr-wish');
    if (!w) return;
    const open = () => {
        if (w.classList.contains('is-flying')) return;
        const ov = nmOpenSheet(`
            <h4>${srEsc(roomItemName('wish'))}</h4>
            <input type="text" class="sr-wish-input" maxlength="120" placeholder="${srEsc(t('room_wish_ph'))}" aria-label="${srEsc(t('room_wish_ph'))}">
            <button type="button" class="nm-btn-primary" data-fly>${srEsc(t('room_wish_send'))}</button>
            <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'sr-wish-sheet');
        const input = ov.querySelector('.sr-wish-input');
        const fly = () => {
            ov.remove();
            w.classList.remove('is-back', 'srp-new');
            w.classList.add('is-flying');
            setTimeout(() => { if (!w.isConnected) return; w.classList.remove('is-flying'); w.classList.add('is-back'); }, srpReduce() ? 400 : 7200);
        };
        ov.querySelector('[data-fly]').addEventListener('click', fly);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fly(); } });
        setTimeout(() => input.focus({ preventScroll: true }), 120);
    };
    w.addEventListener('click', open);
    w.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    if (highlight) { w.classList.add('srp-new'); srShowTip(t('room_reveal_opened').replace('{item}', roomItemName('wish'))); }
}

// ---------- החתול בא לבקר: ישן על הכרית בחדר הסודי (מפתח 11) ----------
function srCatNapSvg() {
    const F = '#120d1f';
    return `<g class="sr-hot sr-catnap" data-hot="catvisit" role="button" tabindex="0" aria-label="${srEsc(t('room_cat_aria'))}" transform="translate(322 650)">
        <g class="sr-catnap-body">
            <path d="M-26 0 Q-30 -22 -6 -26 Q20 -28 26 -8 Q28 2 18 4 L-20 4 Q-27 4 -26 0 Z" fill="${F}"/>
            <path d="M22 2 Q27 11 8 11 Q-12 11 -20 5" stroke="${F}" stroke-width="6" fill="none" stroke-linecap="round"/>
            <g class="sr-catnap-head">
                <path d="M-25 -24 l-2 -10 l8 5 z M-12 -27 l3 -9 l4 8 z" fill="${F}"/>
                <circle cx="-16" cy="-18" r="10" fill="${F}"/>
                <path class="sr-catnap-shut" d="M-21.5 -18.5 q2 2 4 0 M-14.5 -18.5 q2 2 4 0" stroke="#9a8fc4" stroke-width="0.9" fill="none" stroke-linecap="round"/>
                <g class="sr-catnap-eyes"><ellipse cx="-19.5" cy="-19" rx="1.9" ry="2.3" fill="#d8f56a"/><ellipse cx="-12.5" cy="-19" rx="1.9" ry="2.3" fill="#d8f56a"/></g>
                <path d="M-17.2 -14.6 h2.4 l-1.2 1.4 z" fill="#ff9ecf"/>
            </g>
        </g>
        <text class="sr-catnap-z" x="-4" y="-32">z</text>
        <g class="sr-catnap-fx"></g>
        <ellipse class="sr-hit" cx="0" cy="-12" rx="34" ry="24" fill="transparent"/>
    </g>`;
}
function srCatNapTap(el) {
    if (el.classList.contains('is-awake')) return;
    el.classList.add('is-awake');
    const fx = el.querySelector('.sr-catnap-fx');
    for (let i = 0; i < 3; i++) {
        setTimeout(() => {
            if (!fx || !fx.isConnected) return;
            const h = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            h.setAttribute('x', -18 + i * 9);
            h.setAttribute('y', -34 - (i % 2) * 4);
            h.setAttribute('text-anchor', 'middle');
            h.setAttribute('class', 'sr-cat-float is-heart');
            h.textContent = '♥';
            fx.appendChild(h);
            setTimeout(() => h.remove(), 1700);
        }, i * 260);
    }
    setTimeout(() => el.classList.remove('is-awake'), srpReduce() ? 800 : 3200);
}
