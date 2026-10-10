// ===== New Me: המקומות שמאחורי הדלתות במסדרון =====
// לפי בחירה מפורשת (2026-10-09), מתוך 5 אפשרויות לכל דלת על הקנבס:
// דלת 2 - המרפסת המקורה מול הים: ערסל, והמחשב שם הוא טאבלט (נעול עד שנעצב אותו יחד);
// דלת 3 - פינה חמה עם כורסה ותקליטים: הגיטרה והיומן (היומן נשמר בחשבון - רק שלך);
// דלת 4 - חדר הנשימה: חוף בשקיעה, השמש עולה ויורדת עם הנשימה. בלי דקות ובלי ספירה - נכנסים, לוחצים ומתחילים.
//          ובחול (מפתח 17) - מקל לכתוב בו, וגל בא ומוחק;
// דלת 5 - השביל ביער עם פנסים וספסל: נגיעה בפנסים מכבה אותם, ויש יום בחוץ.
// ובאתגר האחרון - בקבוק מגיע מהים, ובתוכו המכתב מהעבר. כל מפתח פותח דבר אחד (ר' ROOM_UNLOCKS).
// כל הציורים בגודל 390×844, כמו המסדרון, וכל מה שנוגעים בו נמצא בתוך הציור עצמו.

const SRP_DOOR_PLACE = { 2: 'porch', 3: 'music', 4: 'breath', 5: 'outside' };
// מקום בתוך מקום: היוגה בסוף השביל ביער (מפתח 12), והמפל מאחורי היוגה (מפתח 13)
const SRP_PLACE_PARENT = { yoga: 'outside', waterfall: 'yoga' };
const SRP_BACK_KEYS = { outside: 'room_back_to_forest', yoga: 'room_back_to_yoga' };
const SRP_BREATH_MS = 10 * 60 * 1000;   // סשן של עשר דקות (לא כתוב בשום מקום - לפי בקשה מפורשת)
let srpCleanups = [];

// העדפות קטנות של המקום (גשם, יום/לילה, מדורה) - נשמרות במכשיר
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
    if (typeof roomClearArrow === 'function') roomClearArrow();
    stage.querySelector('.sr-place')?.remove();
    const keys = roomKeys();
    const P = { porch: [srpPorchScene, srpInitPorch], music: [srpMusicScene, srpInitMusic], breath: [srpBreathScene, srpInitBreath], outside: [srpOutsideScene, srpInitOutside], yoga: [srpYogaScene, srpInitYoga], waterfall: [srpWaterfallScene, srpInitWaterfall] }[id];
    if (!P) return;
    const box = document.createElement('div');
    box.className = `sr-place sr-place-${id}`;
    box.innerHTML = `
        <div class="sr-sub-head"><button type="button" class="sr-sub-back">${SR_CHEVRON.prev}${srEsc(t(opts.parent ? SRP_BACK_KEYS[opts.parent] : opts.fromHall ? 'room_back_to_hall' : 'room_back_to_room'))}</button><b>${srEsc(roomItemName(id))}</b><span class="srp-tools"></span></div>
        <div class="srp-view">${P[0](keys)}</div>
        <button type="button" class="srp-rest-exit" aria-label="${srEsc(t('room_rest_aria'))}"></button>`;
    stage.appendChild(box);
    box.querySelector('.sr-sub-back').addEventListener('click', () => {
        srpCleanup();
        // מקום בתוך מקום: חזרה למקום שממנו באו (מהמפל ליוגה, מהיוגה לשביל)
        if (opts.parent) { roomOpenPlace(opts.parent, { fromHall: opts.fromHall, parent: SRP_PLACE_PARENT[opts.parent] }); return; }
        if (opts.fromHall) closeSecretRoom(); else box.remove();
    });
    box.querySelector('.srp-rest-exit').addEventListener('click', () => box.classList.remove('is-resting'));
    const handlers = P[1](box, keys, opts) || {};
    box.querySelectorAll('[data-place-hot]').forEach(el => {
        const go = () => { const fn = handlers[el.dataset.placeHot]; if (fn) fn(el); };
        el.addEventListener('click', go);
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
    });
    // משהו נפתח כאן ועוד לא הגיעו אליו - חץ מצביע עליו (ר' roomGuide ב-secret-room.js)
    const g = typeof roomGuideUnlock === 'function' ? roomGuideUnlock() : null;
    if (g && g.place) {
        if (g.id === id) roomGuideDone();
        else {
            // הדבר עצמו כאן - או הכניסה למקום שבתוך המקום הזה, בדרך אליו
            let target = g.place === id ? g.id : null;
            if (!target) { let pl = g.place; while (pl && SRP_PLACE_PARENT[pl] !== id) pl = SRP_PLACE_PARENT[pl]; target = pl || null; }
            if (target) setTimeout(() => { if (box.isConnected) roomShowArrow(box, box.querySelector(`[data-place-hot="${target}"], [data-tool="${target}"]`), g.place === id ? roomGuideDone : null); }, 60);
        }
    }
}

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
// הפטיפון: חמישה תקליטים (לפי בקשה מפורשת: "5 שירים שונים... מוכרים עולמיים"). שירים מודרניים מוגנים בזכויות
// יוצרים - לכן רק לחנים קלאסיים ועממיים שכולם מכירים ושהם נחלת הכלל. הכול נוצר במקום, בלי קבצים.
// תווים: "E5 D#5:2 -:3" - שם התו ואורכו ביחידות של השיר (ברירת מחדל 1; "-" = שקט). אקורדים: "Am C:4" - צליל
// בס ואחריו ארפג'ו רך. start = מאיפה מתחילים בלופ (למשל שתי הנקודות שלפני התיבה הראשונה ב"לאליזה")
const SRP_CHORD_NOTES = { Am: ['A2', 'C4', 'E4'], C: ['C3', 'E4', 'G4'], G: ['G2', 'B3', 'D4'], Em: ['E2', 'G3', 'B3'], F: ['F2', 'A3', 'C4'], E: ['E2', 'G#3', 'B3'] };
const srpRep = (s, n) => Array(n).fill(s).join(' ');
const SRP_RECORDS = [
    // לאליזה - בטהובן
    { id: 1, color: '#ff6aa5', unit: 0.19, start: 46, voices: [
        { vol: 0.06, ring: 1.5, notes: 'E5 D#5 E5 B4 D5 C5 A4:3 C4 E4 A4 B4:3 E4 G#4 B4 C5:3 E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4:3 C4 E4 A4 B4:3 E4 C5 B4 A4:4 E5 D#5' },
        { vol: 0.04, ring: 2.4, type: 'sine', notes: '-:6 A2 E3 A3 -:3 E2 E3 G#3 -:3 A2 E3 A3 -:3 -:6 A2 E3 A3 -:3 E2 E3 G#3 -:3 A2 E3 A3 -:3' },
    ] },
    // האודה לשמחה - בטהובן
    { id: 2, color: '#ffd27a', unit: 0.25, bar: 8, chords: 'C G C G C G C G:4 C:4 G:4 C:4 G:4 C:4 G C:4 G:4 C G C G:4 C:4', voices: [
        { vol: 0.055, ring: 1.3, notes: 'E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 E5:3 D5 D5:4 E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 D5:3 C5 C5:4 D5:2 D5:2 E5:2 C5:2 D5:2 E5 F5 E5:2 C5:2 D5:2 E5 F5 E5:2 D5:2 C5:2 D5:2 G4:4 E5:2 E5:2 F5:2 G5:2 G5:2 F5:2 E5:2 D5:2 C5:2 C5:2 D5:2 E5:2 D5:3 C5 C5:4' },
    ] },
    // הקאנון - פכלבל: הבס החוזר, ושלושה כינורות שנכנסים אחד אחרי השני
    { id: 3, color: '#7fd6ff', unit: 0.85, voices: [
        { vol: 0.045, ring: 1.4, type: 'sine', notes: srpRep('D3 A2 B2 F#2 G2 D2 G2 A2', 4) },
        { vol: 0.035, ring: 1.15, notes: '-:8 F#5 E5 D5 C#5 B4 A4 B4 C#5 D5 C#5 B4 A4 G4 F#4 G4 E4 D5:.5 F#5:.5 A5:.5 G5:.5 F#5:.5 D5:.5 F#5:.5 E5:.5 D5:.5 B4:.5 D5:.5 A5:.5 G5:.5 B5:.5 A5:.5 G5:.5' },
        { vol: 0.03, ring: 1.15, notes: '-:16 F#5 E5 D5 C#5 B4 A4 B4 C#5 D5 C#5 B4 A4 G4 F#4 G4 E4' },
        { vol: 0.028, ring: 1.15, notes: '-:24 F#5 E5 D5 C#5 B4 A4 B4 C#5' },
    ] },
    // ג'ימנופדי מס' 1 - סאטי
    { id: 4, color: '#b9a8ff', unit: 0.72, voices: [
        { vol: 0.04, ring: 3, type: 'sine', notes: srpRep('G2 -:2 D2 -:2', 6) },
        { vol: 0.018, ring: 1.3, type: 'sine', notes: srpRep('-:1 B3:2 -:1 A3:2', 6) },
        { vol: 0.018, ring: 1.3, type: 'sine', notes: srpRep('-:1 D4:2 -:1 C#4:2', 6) },
        { vol: 0.018, ring: 1.3, type: 'sine', notes: srpRep('-:1 F#4:2 -:1 F#4:2', 6) },
        { vol: 0.06, ring: 1.2, notes: '-:13 F#5 A5 G5 F#5 C#5 B4 C#5 D5 A4:3 F#4:12' },
    ] },
    // גרינסליבס - עממי
    { id: 5, color: '#5bd18b', unit: 0.27, bar: 6, start: 190, chords: 'Am C G Em Am F E E Am C G Em Am E Am Am C Em G Em Am F E E C Em G Em Am E Am Am', voices: [
        { vol: 0.055, ring: 1.25, notes: 'C5:4 D5:2 E5:3 F5 E5:2 D5:4 B4:2 G4:3 A4 B4:2 C5:4 A4:2 A4:3 G#4 A4:2 B4:4 G#4:2 E4:4 A4:2 C5:4 D5:2 E5:3 F5 E5:2 D5:4 B4:2 G4:3 A4 B4:2 C5:3 B4 A4:2 G#4:3 F#4 G#4:2 A4:6 A4:6 G5:6 G5:3 F#5 E5:2 D5:4 B4:2 G4:3 A4 B4:2 C5:4 A4:2 A4:3 G#4 A4:2 B4:4 G#4:2 E4:6 G5:6 G5:3 F#5 E5:2 D5:4 B4:2 G4:3 A4 B4:2 C5:3 B4 A4:2 G#4:3 F#4 G#4:2 A4:6 A4:4 A4:2' },
    ] },
];
function srpFreq(name) {
    const m = /^([A-G])(#|b)?(\d)$/.exec(name || '');
    if (!m) return 0;
    const semi = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) - 4) * 12;
    return 440 * Math.pow(2, semi / 12);
}
// כל התווים של התקליט ביחידות של השיר, ממוינים לפי הזמן, ואורך הלופ
function srpSongEvents(song) {
    const ev = [];
    let len = 0;
    const walk = (str, fn) => { let at = 0; String(str).trim().split(/\s+/).forEach(tok => { const [n, l] = tok.split(':'); const d = l ? Number(l) : (fn.bar || 1); if (n !== '-') fn(n, at, d); at += d; }); return at; };
    song.voices.forEach(v => {
        len = Math.max(len, walk(v.notes, (n, at, d) => ev.push({ at, f: srpFreq(n), dur: d * song.unit * (v.ring || 1.2), vol: v.vol, type: v.type || 'triangle' })));
    });
    if (song.chords) {
        const add = (n, at, d) => {
            const [root, third, fifth] = SRP_CHORD_NOTES[n] || [];
            if (!root) return;
            ev.push({ at, f: srpFreq(root), dur: d * song.unit * 1.1, vol: 0.045, type: 'sine' });
            for (let k = 2; k < d; k += 2) ev.push({ at: at + k, f: srpFreq((k / 2) % 2 ? third : fifth), dur: 2 * song.unit * 1.3, vol: 0.022, type: 'sine' });
        };
        add.bar = song.bar;
        len = Math.max(len, walk(song.chords, add));
    }
    ev.sort((a, b) => a.at - b.at);
    return { ev, len };
}
function srpMusicStart(i) {
    const a = srpCtx();
    if (!a) return;
    srpMusicStop(true);
    const song = SRP_RECORDS[i] || SRP_RECORDS[0];
    const { ev, len } = srpSongEvents(song);
    if (!ev.length || !len) return;
    const u = song.unit, start = song.start || 0;
    let base = a.ctx.currentTime + 0.15 - start * u;
    let idx = Math.max(0, ev.findIndex(e => e.at >= start));
    const schedule = () => {
        const horizon = a.ctx.currentTime + 1.4;
        for (let guard = 0; guard < 400; guard++) {
            if (idx >= ev.length) { idx = 0; base += len * u; }
            const e = ev[idx];
            const when = base + e.at * u;
            if (when > horizon) break;
            if (when >= a.ctx.currentTime - 0.05) srpNote(e.f, when, e.dur, e.vol, e.type, e.type === 'sine' ? 0.03 : 0.012);
            idx++;
        }
        a.loop = setTimeout(schedule, 400);
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
    const rainOpen = keys >= roomUnlockAt('rain');
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
            ${rainOpen ? `<g class="srp-hot srp-cloud" data-place-hot="rain" role="button" tabindex="0" aria-label="${srEsc(roomItemName('rain'))}" aria-pressed="false">
                <!-- ענן קטן בשמיים: נגיעה עוצרת את הגשם ומחזירה אותו (לפי בקשה מפורשת: "אולי ענן קטן?") -->
                <g class="srp-cloud-float">
                    <path class="srp-cloud-body" d="M252 222 a17 17 0 0 1 12 -29 a23 23 0 0 1 43 -7 a16 16 0 0 1 27 16 a14 14 0 0 1 -5 29 h-69 a14 14 0 0 1 -8 -9 z"/>
                    <path class="srp-cloud-shine" d="M272 196 a17 17 0 0 1 26 -6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
                    <g class="srp-cloud-drops" stroke="#b9c6ff" stroke-width="2.2" stroke-linecap="round"><line x1="268" y1="240" x2="265" y2="250"/><line x1="288" y1="242" x2="285" y2="252"/><line x1="308" y1="240" x2="305" y2="250"/><line x1="326" y1="238" x2="323" y2="248"/></g>
                </g>
                <rect class="srp-hit" x="240" y="170" width="112" height="88" fill="transparent"/>
            </g>` : ''}
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
                    <g transform="translate(118 398) rotate(18)">
                        <path d="M-25 -12 Q0 -17 25 -12 Q29 0 25 12 Q0 17 -25 12 Q-29 0 -25 -12 Z" fill="#ff8fb8"/>
                        <g stroke="#ffe3ee" stroke-width="2.2" opacity="0.85"><line x1="-11" y1="-13" x2="-11" y2="13"/><line x1="0" y1="-14.5" x2="0" y2="14.5"/><line x1="11" y1="-13" x2="11" y2="13"/></g>
                        <path d="M-25 -12 Q0 -17 25 -12 Q29 0 25 12 Q0 17 -25 12 Q-29 0 -25 -12 Z" fill="none" stroke="#fff6fa" stroke-width="1.4"/>
                        <g fill="#ffd27a"><circle cx="-26" cy="-12" r="2.4"/><circle cx="26" cy="-12" r="2.4"/><circle cx="-26" cy="12" r="2.4"/><circle cx="26" cy="12" r="2.4"/></g>
                    </g>
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
            </g>
            <!-- הטאבלט מונח על שולחן קטן ועדין - בלי מעמד ובלי ארגז (לפי בקשה מפורשת: "טבלט הוא בלי משהו שמחזיק אותו...
                 ואפשר לשים אותו על שולחן קטן עדין לבחוץ") -->
            <g class="srp-hot srp-tablet${tabletOpen ? ' is-open' : ' locked'}" data-place-hot="tablet" role="button" tabindex="0" aria-label="${srEsc(roomItemName('tablet'))}">
                <ellipse cx="300" cy="737" rx="36" ry="5" fill="#000" opacity="0.22"/>
                <g fill="none" stroke="#efe4d0" stroke-width="2.2" stroke-linecap="round">
                    <path d="M300 670 V734"/><path d="M298 672 C292 698 283 716 272 735"/><path d="M302 672 C308 698 317 716 328 735"/>
                    <ellipse cx="300" cy="708" rx="13" ry="3" stroke-width="1.5"/>
                </g>
                <ellipse cx="300" cy="664" rx="54" ry="24" fill="#cbb994"/>
                <ellipse cx="300" cy="660" rx="54" ry="24" fill="#f3ece0"/>
                <ellipse cx="300" cy="660" rx="47" ry="20" fill="none" stroke="#e2d6bf" stroke-width="1"/>
                ${tabletOpen ? '<ellipse cx="300" cy="652" rx="74" ry="38" fill="url(#srpPTab)"/>' : ''}
                <g transform="translate(300 657) scale(1 0.45) rotate(-12)">
                    <rect x="-38" y="-27" width="76" height="54" rx="7" fill="#26262e"/>
                    <rect x="-34" y="-23" width="68" height="46" rx="4" fill="${tabletOpen ? 'url(#srpPScreen)' : '#0d1424'}"/>
                    ${tabletOpen ? '<g fill="#fff"><circle cx="-18" cy="-9" r="7" opacity="0.28"/><rect x="-6" y="-14" width="30" height="5" rx="2.5" opacity="0.5"/><rect x="-6" y="-4" width="22" height="5" rx="2.5" opacity="0.35"/><rect x="-26" y="8" width="52" height="7" rx="3.5" opacity="0.3"/></g>' : ''}
                </g>
                ${tabletOpen ? '' : `<g transform="translate(300 630) scale(0.5)">${srLockShape()}</g><text x="300" y="608" text-anchor="middle" font-size="8.5" font-weight="800" fill="#ffe2a6">${srEsc(t('room_key_n').replace('{n}', srFmt(roomUnlockAt('tablet'))))}</text>`}
                <rect class="srp-hit" x="240" y="592" width="120" height="152" fill="transparent"/>
            </g>
        </svg>`;
}
function srpInitPorch(box) {
    // הגשם: דלוק כברירת מחדל ברגע שנפתח (לפי בקשה מפורשת: "פתח גשם על המרפסת זה לא עושה שום דבר"),
    // והענן הקטן בשמיים עוצר אותו ומחזיר אותו
    const cloud = box.querySelector('.srp-cloud');
    const setRain = (on, save) => {
        box.classList.toggle('is-rain', on);
        if (cloud) cloud.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (save) srpSetPref('rain', on);
    };
    if (cloud) setRain(srpPrefs().rain !== false, false);
    return {
        // נגיעה בערסל - הוא מתנדנד חזק כמה שניות ונרגע (לפי בקשה מפורשת: בלי "להתקרב סתם למסך")
        hammock: el => {
            if (el.classList.contains('is-rocking')) return;
            el.classList.add('is-rocking');
            setTimeout(() => el.classList.remove('is-rocking'), srpReduce() ? 300 : 5200);
        },
        rain: () => setRain(!box.classList.contains('is-rain'), true),
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
                <g transform="translate(58 699) scale(1 0.34)"><g class="srp-record"><circle r="30" fill="#141014"/><circle r="22" fill="none" stroke="#2c262c" stroke-width="1.4"/><circle r="15" fill="none" stroke="#2c262c" stroke-width="1.4"/><circle r="9" style="fill:var(--rec, #ff6aa5)"/><rect x="2" y="-1.8" width="7" height="3.6" fill="#ffd27a"/></g></g>
                <g class="srp-arm"><circle cx="106" cy="694" r="3" fill="#c9c9d0"/><path d="M106 694 L86 690" stroke="#c9c9d0" stroke-width="2.2" stroke-linecap="round"/></g>
                <g transform="translate(132 736)">
                    ${SRP_RECORDS.map((r, i) => `<rect x="${5 + i * 10.5}" y="${i % 2 ? 2 : 0}" width="11" height="34" rx="1.5" fill="${r.color}" transform="rotate(${-8 + i * 4} ${10 + i * 10.5} 34)"/>`).join('')}
                    <rect x="0" y="18" width="64" height="30" rx="3" fill="#8a5a3c"/><path d="M6 27 h52" stroke="#6a3f25" stroke-width="2" stroke-linecap="round"/>
                </g>
                <rect class="srp-hit" x="6" y="676" width="196" height="112" fill="transparent"/>
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
        vinyl: el => srpOpenRecords(el, floatNotes),
    };
}

// התקליטים: נגיעה בפטיפון (או בארגז) פותחת את חמשת התקליטים; בחירה מנגנת מיד, ו"לעצור" עוצר
function srpOpenRecords(el, floatNotes) {
    const playing = el.classList.contains('is-playing') ? Number(el.dataset.song) : -1;
    const ov = nmOpenSheet(`
        <h4>${srEsc(roomItemName('vinyl'))}</h4>
        <div class="srp-records">${SRP_RECORDS.map((r, i) => `
            <button type="button" class="srp-record-btn${i === playing ? ' is-on' : ''}" data-song="${i}" style="--rec:${r.color}" aria-pressed="${i === playing}">
                <span class="srp-record-disc" aria-hidden="true"></span>
                <span class="srp-record-name">${srEsc(t('room_song_' + r.id))}</span>
            </button>`).join('')}</div>
        ${playing >= 0 ? `<button type="button" class="nm-btn-ghost" data-stop>${srEsc(t('room_vinyl_stop'))}</button>` : ''}
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'srp-records-sheet');
    ov.querySelectorAll('[data-song]').forEach(b => b.addEventListener('click', () => { ov.remove(); srpPlayRecord(el, Number(b.dataset.song), floatNotes); }));
    const stop = ov.querySelector('[data-stop]');
    if (stop) stop.addEventListener('click', () => { ov.remove(); srpPlayRecord(el, -1); });
}
function srpPlayRecord(el, i, floatNotes) {
    const on = i >= 0 && !!SRP_RECORDS[i];
    el.classList.toggle('is-playing', on);
    el.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (!on) { delete el.dataset.song; srpMusicStop(); return; }
    el.dataset.song = String(i);
    el.style.setProperty('--rec', SRP_RECORDS[i].color);
    srpMusicStart(i);
    if (floatNotes) floatNotes(60, 680, 2);
}

// היומן (לפי בקשה מפורשת: "יומן לכתוב בו - שנשמר"): דף חדש למעלה, ומתחת לוח חודשי מקופל - נקודה בכל יום שכתבו
// בו, ונגיעה ביום פותחת את הדפים שלו (לפי בקשה מפורשת: "טבלה מקופלת חודשית... הוא פותח את היום הספציפי ויש שם
// נקודה"). נשמר בחשבון (new_me_diary, רק לבעלים) - כדי שיהיה בכל מכשיר
let srpDiaryCal = { open: false, month: null, day: null };
async function srpOpenDiary() {
    let pages = [];
    if (supabaseClient && currentUserId) {
        const { data } = await supabaseClient.from('new_me_diary').select('id, body, created_at').eq('user_id', currentUserId).order('created_at', { ascending: false }).limit(1000);
        pages = data || [];
    }
    const byDay = new Map();
    pages.forEach(p => { const d = new Date(p.created_at); if (isNaN(d)) return; const k = getLocalDateString(d); if (!byDay.has(k)) byDay.set(k, []); byDay.get(k).push(p); });
    const today = getLocalDateString();
    if (!srpDiaryCal.month) srpDiaryCal.month = today.slice(0, 7);
    const ov = nmOpenSheet(`
        <h4>${srEsc(t('room_diary_title'))}</h4>
        <textarea class="srp-diary-input" rows="6" maxlength="8000" placeholder="${srEsc(t('room_diary_ph'))}" aria-label="${srEsc(t('room_diary_title'))}"></textarea>
        <button type="button" class="nm-btn-primary" data-save>${srEsc(t('room_diary_save'))}</button>
        <div class="srp-cal${srpDiaryCal.open ? ' open' : ''}">
            <button type="button" class="srp-cal-fold" aria-expanded="${srpDiaryCal.open}"><span class="srp-cal-month"></span><span class="srp-cal-count"></span><span class="srp-cal-chev" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span></button>
            <div class="srp-cal-body">
                <div class="srp-cal-nav">
                    <button type="button" data-m="-1" aria-label="${srEsc(t('monthly_goal_prev_month'))}">${srIsRtl() ? SR_CHEVRON.next : SR_CHEVRON.prev}</button>
                    <b class="srp-cal-title"></b>
                    <button type="button" data-m="1" aria-label="${srEsc(t('monthly_goal_next_month'))}">${srIsRtl() ? SR_CHEVRON.prev : SR_CHEVRON.next}</button>
                </div>
                <div class="srp-cal-week">${[0, 1, 2, 3, 4, 5, 6].map(d => `<span>${srEsc(new Date(2026, 0, 4 + d).toLocaleDateString(currentLang, { weekday: 'narrow' }))}</span>`).join('')}</div>
                <div class="srp-cal-grid"></div>
                <div class="srp-cal-day"></div>
            </div>
        </div>
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'srp-diary-sheet');
    const cal = ov.querySelector('.srp-cal');
    const pageTime = p => { const d = new Date(p.created_at); return isNaN(d) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
    const renderDay = () => {
        const box = cal.querySelector('.srp-cal-day');
        const list = srpDiaryCal.day ? byDay.get(srpDiaryCal.day) || [] : [];
        if (!list.length) { box.innerHTML = ''; return; }
        box.innerHTML = `<p class="srp-diary-date">${srEsc(nmLongDate(srpDiaryCal.day))}</p>` + list.map(p => `
            <div class="srp-diary-full" data-id="${srEsc(p.id)}">
                <span class="srp-diary-time"><bdi dir="ltr">${srEsc(pageTime(p))}</bdi></span>
                <p>${srEsc(p.body).replace(/\n/g, '<br>')}</p>
                <button type="button" class="srp-diary-del">${srEsc(t('room_diary_delete'))}</button>
            </div>`).join('');
        box.querySelectorAll('.srp-diary-full').forEach(row => {
            const page = list.find(p => String(p.id) === row.dataset.id);
            const del = row.querySelector('.srp-diary-del');
            // מחיקה בשתי נגיעות: הראשונה שואלת, השנייה מוחקת
            del.addEventListener('click', async () => {
                if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = t('room_diary_delete_q'); return; }
                del.disabled = true;
                const { error } = await supabaseClient.from('new_me_diary').delete().eq('id', page.id).eq('user_id', currentUserId);
                if (error) { del.disabled = false; showAppToast(t('nm_save_error'), 'error'); return; }
                list.splice(list.indexOf(page), 1);
                if (!list.length) byDay.delete(srpDiaryCal.day);
                renderMonth();
            });
        });
    };
    const renderMonth = () => {
        const [y, m] = srpDiaryCal.month.split('-').map(Number);
        const first = new Date(y, m - 1, 1);
        const days = new Date(y, m, 0).getDate();
        const label = first.toLocaleDateString(currentLang, { month: 'long', year: 'numeric' });
        const written = [...byDay.keys()].filter(k => k.startsWith(srpDiaryCal.month)).length;
        cal.querySelector('.srp-cal-month').textContent = label;
        cal.querySelector('.srp-cal-title').textContent = label;
        cal.querySelector('.srp-cal-count').innerHTML = written ? `<span class="srp-cal-dot" aria-hidden="true"></span><bdi dir="ltr">${srFmt(written)}</bdi>` : '';
        let cells = '<span></span>'.repeat(first.getDay());
        for (let d = 1; d <= days; d++) {
            const k = `${srpDiaryCal.month}-${String(d).padStart(2, '0')}`;
            const has = byDay.has(k);
            cells += `<button type="button" class="srp-cal-cell${has ? ' has' : ''}${k === today ? ' today' : ''}${k === srpDiaryCal.day ? ' on' : ''}" data-day="${k}" ${has ? '' : 'disabled'} aria-label="${srEsc(nmLongDate(k))}"><span>${srFmt(d)}</span>${has ? '<i aria-hidden="true"></i>' : ''}</button>`;
        }
        cal.querySelector('.srp-cal-grid').innerHTML = cells;
        cal.querySelectorAll('.srp-cal-cell.has').forEach(b => b.addEventListener('click', () => { srpDiaryCal.day = srpDiaryCal.day === b.dataset.day ? null : b.dataset.day; renderMonth(); }));
        renderDay();
    };
    cal.querySelector('.srp-cal-fold').addEventListener('click', e => {
        srpDiaryCal.open = !srpDiaryCal.open;
        cal.classList.toggle('open', srpDiaryCal.open);
        e.currentTarget.setAttribute('aria-expanded', srpDiaryCal.open ? 'true' : 'false');
    });
    cal.querySelectorAll('[data-m]').forEach(b => b.addEventListener('click', () => {
        const [y, m] = srpDiaryCal.month.split('-').map(Number);
        const d = new Date(y, m - 1 + Number(b.dataset.m), 1);
        srpDiaryCal.month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        srpDiaryCal.day = null;
        renderMonth();
    }));
    renderMonth();
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
        // אחרי שמירה: הלוח פתוח על היום, והדף החדש בפנים
        srpDiaryCal = { open: true, month: today.slice(0, 7), day: today };
        srpOpenDiary();
    });
    setTimeout(() => ta.focus({ preventScroll: true }), 120);
}

// ---------- דלת 4: חדר הנשימה - חוף בשקיעה ----------
// לפי בקשה מפורשת: "משהו מגניב שיגיד איך לנשום, סשן קצר של 10 דק', אל תרשום כמה דק' זה... נכנסים, לוחצים
// ומתחילים". שאיפה ~6 שניות (השמש עולה, הגל נכנס), נשיפה ~8 שניות (השמש שוקעת, הגל יוצא).
// מפתח 17 (במקום הזריחה - לפי בקשה מפורשת: "למחוק את הזריחה בחוף ולעשות משהו אחר במקום"): מקל על החול -
// כותבים בו מה רוצים לשחרר, וגל גדול בא ומוחק. לא נשמר בשום מקום
function srpBreathScene(keys) {
    const sand = keys >= roomUnlockAt('sand');
    return `
        <svg class="srp-scene" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('breath'))}">
            <defs>
                <linearGradient id="srbDusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f1c45"/><stop offset="0.45" stop-color="#5e3a78"/><stop offset="0.78" stop-color="#d9706d"/><stop offset="1" stop-color="#f6b46c"/></linearGradient>
                <linearGradient id="srbSeaDusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8637a"/><stop offset="0.35" stop-color="#5a4682"/><stop offset="1" stop-color="#2d3468"/></linearGradient>
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
            ${sand ? `<g class="srb-writing" aria-hidden="true"><text class="srb-word-light" x="195" y="717" text-anchor="middle"></text><text class="srb-word" x="195" y="716" text-anchor="middle"></text></g>
            <g class="srb-bigwave" aria-hidden="true">
                <path d="M-20 600 H410 V690 Q385 702 360 690 T310 690 T260 690 T210 690 T160 690 T110 690 T60 690 T10 690 T-20 690 Z" fill="#a9bde8" opacity="0.6"/>
                <path d="M-20 690 Q5 702 30 690 T80 690 T130 690 T180 690 T230 690 T280 690 T330 690 T380 690 T430 690" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
            </g>
            <g class="srp-hot srb-stick" data-place-hot="sand" role="button" tabindex="0" aria-label="${srEsc(roomItemName('sand'))}">
                <path d="M292 812 L366 788" stroke="#7a5236" stroke-width="5" stroke-linecap="round"/>
                <path d="M318 804 l9 -13" stroke="#7a5236" stroke-width="3" stroke-linecap="round"/>
                <g transform="translate(262 812)"><path d="M0 6 Q9 -12 18 6 Z" fill="#f8dccb"/><path d="M9 -4 V5 M5 -1 L7 5 M13 -1 L11 5" stroke="#e0a98f" stroke-width="0.9" fill="none" stroke-linecap="round"/></g>
                <rect class="srp-hit" x="252" y="772" width="128" height="58" fill="transparent"/>
            </g>` : ''}
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
    let timer = null;
    // המסך נשאר דולק כל הסשן; יציאה קצרה מהאפליקציה משחררת את זה - בחזרה מבקשים שוב
    const onVisible = () => { if (document.visibilityState === 'visible' && box.classList.contains('is-on') && box.isConnected) srpWakeOn(); };
    document.addEventListener('visibilitychange', onVisible);
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
    srpCleanups.push(() => { stop(false); document.removeEventListener('visibilitychange', onVisible); });
    return { sand: () => srpWriteInSand(box) };
}

// כותבים בחול: המילים מופיעות אות אחרי אות, ואחרי רגע גל גדול עולה על החול ומוחק אותן (לא נשמר בשום מקום)
function srpWriteInSand(box) {
    if (box.classList.contains('is-writing')) return;
    const ov = nmOpenSheet(`
        <h4>${srEsc(roomItemName('sand'))}</h4>
        <input type="text" class="sr-wish-input srp-sand-input" maxlength="40" placeholder="${srEsc(t('room_sand_ph'))}" aria-label="${srEsc(t('room_sand_ph'))}">
        <button type="button" class="nm-btn-primary" data-write>${srEsc(t('room_sand_write'))}</button>
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'srp-sand-sheet');
    const input = ov.querySelector('.srp-sand-input');
    const write = () => {
        const text = input.value.trim().slice(0, 40);
        if (!text) { input.focus(); return; }
        ov.remove();
        const words = [...box.querySelectorAll('.srb-word, .srb-word-light')];
        if (!words.length) return;
        box.classList.add('is-writing');
        box.classList.remove('is-washing');
        words.forEach(w => { w.textContent = ''; w.removeAttribute('font-size'); });
        const chars = [...text];
        const step = srpReduce() ? 0 : 85;
        chars.forEach((ch, i) => setTimeout(() => {
            if (!box.isConnected) return;
            words.forEach(w => { w.textContent += ch; });
            const len = words[0].getComputedTextLength ? words[0].getComputedTextLength() : 0;
            if (len > 300) words.forEach(w => w.setAttribute('font-size', String(Math.max(14, Math.floor(32 * 300 / len)))));
        }, i * step));
        const wash = chars.length * step + 1800;
        setTimeout(() => { if (box.isConnected) box.classList.add('is-washing'); }, wash);
        setTimeout(() => {
            if (!box.isConnected) return;
            words.forEach(w => { w.textContent = ''; });
            box.classList.remove('is-writing', 'is-washing');
        }, wash + (srpReduce() ? 900 : 3400));
    };
    ov.querySelector('[data-write]').addEventListener('click', write);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); write(); } });
    setTimeout(() => input.focus({ preventScroll: true }), 120);
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
    const yoga = keys >= roomUnlockAt('yoga');
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
                ${swing ? '<path d="M26 264 Q90 244 162 256" fill="none" style="stroke:var(--o-trunk)" stroke-width="7" stroke-linecap="round"/>' : ''}
            </g>
            ${swing ? `<g class="srp-hot srp-swing-hot" data-place-hot="swing" role="button" tabindex="0" aria-label="${srEsc(roomItemName('swing'))}">
                <!-- תלויה על הענף (לפי בקשה מפורשת: "אל תמחוק את הענף יש נדנדה בדרך"), ומתנדנדת קדימה ואחורה - לא לצדדים -->
                <ellipse class="srp-swing-shadow" cx="101" cy="434" rx="26" ry="4" fill="#000" opacity="0.22"/>
                <g class="srp-swing-ropes" stroke="#c9b48a" stroke-width="1.6"><line x1="84" y1="254" x2="84" y2="404"/><line x1="118" y1="254" x2="118" y2="404"/></g>
                <rect class="srp-swing-seat" x="74" y="402" width="54" height="8" rx="2" fill="#8a5e3c"/>
                <rect class="srp-hit" x="62" y="248" width="78" height="194" fill="transparent"/>
            </g>` : ''}
            ${yoga ? `<g class="srp-hot srp-yoga" data-place-hot="yoga" role="button" tabindex="0" aria-label="${srEsc(roomItemName('yoga'))}">
                <!-- מפתח 12: השביל ממשיך - קשת עץ קטנה בסוף השביל, ומאחוריה קרחת היוגה ליד המפל -->
                <ellipse class="srp-flicker" cx="200" cy="388" rx="40" ry="18" fill="url(#srpOLight)"/>
                <g fill="none" stroke="#8a5e3c" stroke-width="3" stroke-linecap="round"><path d="M188 400 V378"/><path d="M212 400 V378"/><path d="M185 380 Q200 364 215 380"/></g>
                <g fill="#ffd27a"><circle cx="200" cy="371" r="1.8"/><circle cx="190" cy="377" r="1.3"/><circle cx="210" cy="377" r="1.3"/></g>
                <rect class="srp-hit" x="174" y="356" width="52" height="50" fill="transparent"/>
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
function srpInitOutside(box, keys, opts = {}) {
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
        selfcare: () => srpOpenSignView(box),
        yoga: () => roomOpenPlace('yoga', { fromHall: !!opts.fromHall, parent: 'outside' }),
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

// השלט ליד הספסל (מתוך הרעיונות שלה ליער: "לדאוג לעצמך – בדיקה"). לפי בקשה מפורשת: נגיעה בשלט מושיבה על הספסל -
// מתקרבים, והשלט גדול: לוח עץ ובתוכו שישה פוסטרים מנייר, כל אחד שאלה קטנה. ✓ על פוסטר - רק להיום, רק במכשיר
const SRP_CARE_ICONS = ['💭', '😴', '⏳', '💗', '🤸', '🌬️'];
const SRP_CARE_PAPER = ['#fff3c4', '#dff1ff', '#ffe1ec', '#e3fbe6', '#efe6ff', '#ffe9d6'];
const SRP_CARE_TILT = [-2.5, 1.8, 2.2, -1.6, -2, 2.6];
function srpOpenSignView(box) {
    box.querySelector('.srp-signview')?.remove();
    const key = `weekwise_room_care_${currentUserId || 'me'}`;
    const today = getLocalDateString();
    let st = {};
    try { st = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch {}
    if (st.day !== today || !Array.isArray(st.on)) st = { day: today, on: [] };
    const view = document.createElement('div');
    view.className = 'srp-signview';
    view.innerHTML = `
        <button type="button" class="sr-sub-back srp-signview-back">${SR_CHEVRON.prev}${srEsc(t('nm_back'))}</button>
        <div class="srp-signview-board" role="group" aria-label="${srEsc(t('room_selfcare_title'))}">
            <div class="srp-signview-plank">${srEsc(t('room_selfcare_title'))}</div>
            <div class="srp-signview-posters">${[1, 2, 3, 4, 5, 6].map(i => `
                <button type="button" class="srp-poster${st.on.includes(i) ? ' on' : ''}" data-care="${i}" aria-pressed="${st.on.includes(i)}" style="--paper:${SRP_CARE_PAPER[i - 1]};--tilt:${SRP_CARE_TILT[i - 1]}deg">
                    <span class="srp-poster-pin" aria-hidden="true"></span>
                    <span class="srp-poster-icon" aria-hidden="true">${SRP_CARE_ICONS[i - 1]}</span>
                    <span class="srp-poster-text">${srEsc(t('room_selfcare_' + i))}</span>
                    <span class="srp-poster-stamp" aria-hidden="true">✓</span>
                </button>`).join('')}</div>
        </div>
        <div class="srp-signview-legs" aria-hidden="true"><span></span><span></span></div>`;
    box.appendChild(view);
    box.classList.add('is-sign');
    const close = () => { box.classList.remove('is-sign'); view.remove(); };
    view.querySelector('.srp-signview-back').addEventListener('click', close);
    view.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } });
    view.querySelectorAll('[data-care]').forEach(b => b.addEventListener('click', () => {
        const i = Number(b.dataset.care);
        const on = !st.on.includes(i);
        st.on = on ? st.on.concat(i) : st.on.filter(x => x !== i);
        b.classList.toggle('on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        try { localStorage.setItem(key, JSON.stringify(st)); } catch {}
    }));
    setTimeout(() => { const first = view.querySelector('.srp-poster'); if (first) first.focus({ preventScroll: true }); }, 400);
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
function roomInitWish(root) {
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
}

// ---------- החתול בא לבקר: יושב על הכרית בחדר הסודי (מפתח 11) ----------
// לפי בקשה מפורשת: דומה לחתול מהגג (אותו ציור), ועושה 5 דברים אחרים לגמרי מאלה שבגג - כל נגיעה הדבר הבא:
// כדור צמר, מסתובב אחרי הזנב, מתגלגל על הגב, צד עכבר צעצוע, ופרפר שנוחת לו על האף
const SR_ROOMCAT_ACTIONS = [['yarn', 2400], ['chase', 1900], ['roll', 2300], ['mouse', 2400], ['butterfly', 3000]];
function srCatNapSvg() {
    const F = '#120d1f';
    return `<g class="sr-hot sr-roomcat" data-hot="catvisit" role="button" tabindex="0" aria-label="${srEsc(t('room_cat_aria'))}" transform="translate(320 656) scale(1.3)">
        <g class="rc-yarn" aria-hidden="true"><circle cx="34" cy="-7" r="7" fill="#ff7ab0"/><path d="M28 -10 q6 -4 12 2 M29 -4 q6 3 11 -3 M31 -13 q5 6 1 13" stroke="#ffc4dd" stroke-width="1" fill="none"/><path d="M27 -3 q-8 6 -16 2" stroke="#ff7ab0" stroke-width="1" fill="none"/></g>
        <g class="rc-mouse" aria-hidden="true"><path d="M32 -4 q-7 2 -9 -4" stroke="#b9a8ff" stroke-width="1.2" fill="none"/><ellipse cx="39" cy="-4" rx="7" ry="4.6" fill="#b9a8ff"/><circle cx="45.5" cy="-7" r="2.8" fill="#b9a8ff"/><circle cx="44.5" cy="-9.8" r="1.7" fill="#d9ceff"/><circle cx="47.2" cy="-7.2" r="0.6" fill="${F}"/></g>
        <g class="rc-all">
            <path class="rc-tail" d="M11 -6 q17 -1 16 -18 q-1 -8 5 -9" stroke="${F}" stroke-width="5.5" fill="none" stroke-linecap="round"/>
            <g class="rc-body">
                <ellipse cx="0" cy="-14" rx="15" ry="15" fill="${F}"/>
                <ellipse cx="0" cy="-12" rx="6.5" ry="9" fill="#2a2042"/>
                <ellipse class="rc-paw rc-paw-l" cx="-6" cy="-2" rx="4.6" ry="3" fill="#1d1633"/>
                <ellipse class="rc-paw rc-paw-r" cx="6" cy="-2" rx="4.6" ry="3" fill="#1d1633"/>
            </g>
            <g class="rc-head">
                <path d="M-12 -40 l-2.5 -12 l9.5 6.5 z M12 -40 l2.5 -12 l-9.5 6.5 z" fill="${F}"/>
                <path d="M-10.6 -42.5 l-1.1 -6 l4.4 3.2 z M10.6 -42.5 l1.1 -6 l-4.4 3.2 z" fill="#ff9ecf" opacity="0.5"/>
                <circle cx="0" cy="-35" r="12.5" fill="${F}"/>
                <ellipse cx="-4.6" cy="-37" rx="2.9" ry="3.4" fill="#d8f56a"/><ellipse cx="4.6" cy="-37" rx="2.9" ry="3.4" fill="#d8f56a"/>
                <ellipse class="rc-pupil rc-pupil-l" cx="-4.6" cy="-37" rx="1" ry="2.6" fill="${F}"/><ellipse class="rc-pupil rc-pupil-r" cx="4.6" cy="-37" rx="1" ry="2.6" fill="${F}"/>
                <circle cx="-3.8" cy="-38.2" r="0.7" fill="#fff"/><circle cx="5.4" cy="-38.2" r="0.7" fill="#fff"/>
                <g class="rc-lids"><ellipse cx="-4.6" cy="-37" rx="3.3" ry="3.8" fill="${F}"/><ellipse cx="4.6" cy="-37" rx="3.3" ry="3.8" fill="${F}"/><path d="M-7.4 -36.4 q2.8 2.2 5.6 0 M1.8 -36.4 q2.8 2.2 5.6 0" stroke="#9a8fc4" stroke-width="0.8" fill="none" stroke-linecap="round"/></g>
                <path d="M-1.5 -32.2 h3 l-1.5 1.7 z" fill="#ff9ecf"/>
                <path d="M0 -30.5 q-1.6 1.7 -3.2 0.4 M0 -30.5 q1.6 1.7 3.2 0.4" stroke="#9a8fc4" stroke-width="0.7" fill="none" stroke-linecap="round"/>
                <path d="M-6 -31.6 l-8 -1.4 M-6 -30.4 l-8 1.2 M6 -31.6 l8 -1.4 M6 -30.4 l8 1.2" stroke="#9a8fc4" stroke-width="0.6" opacity="0.75" stroke-linecap="round"/>
            </g>
        </g>
        <g class="rc-fly" aria-hidden="true"><g class="rc-wings"><path d="M0 0 q-6 -7 -8 -1 q-1 4 8 1 z" fill="#ffd27a"/><path d="M0 0 q6 -7 8 -1 q1 4 -8 1 z" fill="#ffb3d6"/></g><line x1="0" y1="-1.5" x2="0" y2="2" stroke="${F}" stroke-width="0.9" stroke-linecap="round"/></g>
        <g class="rc-fx"></g>
        <ellipse class="sr-hit" cx="6" cy="-24" rx="38" ry="34" fill="transparent"/>
    </g>`;
}
function srCatNapTap(el) {
    if (el.dataset.busy) return;
    const i = Number(el.dataset.next || 0) % SR_ROOMCAT_ACTIONS.length;
    const [name, ms] = SR_ROOMCAT_ACTIONS[i];
    el.dataset.next = String((i + 1) % SR_ROOMCAT_ACTIONS.length);
    el.dataset.busy = '1';
    el.classList.add('do-' + name);
    const fx = el.querySelector('.rc-fx');
    const pop = (ch, x, y, cls, delay) => setTimeout(() => {
        if (!fx || !fx.isConnected) return;
        const h = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        h.setAttribute('x', x);
        h.setAttribute('y', y);
        h.setAttribute('text-anchor', 'middle');
        h.setAttribute('class', `sr-cat-float ${cls}`);
        h.textContent = ch;
        fx.appendChild(h);
        setTimeout(() => h.remove(), 1700);
    }, srpReduce() ? 0 : delay);
    if (name === 'mouse') pop('✦', 40, -20, 'is-spark', 1500);
    if (name === 'butterfly') pop('♥', 0, -56, 'is-heart', 2100);
    if (name === 'yarn') pop('♥', 20, -50, 'is-heart', 1700);
    setTimeout(() => { el.classList.remove('do-' + name); delete el.dataset.busy; }, srpReduce() ? 400 : ms);
}

// ---------- מפתח 12: יוגה ביער - קרחת ליד המפל, המדריכה ואנשים טובים במעגל ----------
// לפי בחירה מפורשת (2026-10-10): המקום = ה (ליד המפל); השיחה = א (מעגל שיתוף), "גזע שנפתח כמו במחשב" לפי מה
// שעונים, עם כל המסלולים; "המעגל יראה עם האנשים אבל הנראות תהיה כמו במחשב" (זכוכית רכה, ערכה 10)
const SRP_GUIDE_LOOK = { skin: '#a96f4a', hair: '#2a1a12', band: '#7fd6c0' };   // פני המדריכה - עד שתיבחר אחת מהאפשרויות על הקנבס
const SRP_SKIN = ['#f1c7a5', '#c98e64', '#8d5a3b', '#e3a982', '#5e3a24'];
function ygHair(style, x, y, c) {
    if (style === 'bun') return `<circle cx="${x}" cy="${y - 12}" r="4.6" fill="${c}"/><path d="M${x - 9} ${y} Q${x - 10} ${y - 10} ${x} ${y - 10} Q${x + 10} ${y - 10} ${x + 9} ${y} Q${x + 6} ${y - 5} ${x} ${y - 5} Q${x - 6} ${y - 5} ${x - 9} ${y} Z" fill="${c}"/>`;
    if (style === 'curly') return `<g fill="${c}"><circle cx="${x - 6}" cy="${y - 6}" r="4.5"/><circle cx="${x}" cy="${y - 9}" r="5"/><circle cx="${x + 6}" cy="${y - 6}" r="4.5"/><circle cx="${x - 8.5}" cy="${y}" r="3.4"/><circle cx="${x + 8.5}" cy="${y}" r="3.4"/></g>`;
    if (style === 'long') return `<path d="M${x - 10} ${y + 8} Q${x - 11} ${y - 11} ${x} ${y - 11} Q${x + 11} ${y - 11} ${x + 10} ${y + 8} L${x + 7} ${y + 8} Q${x + 6} ${y - 5} ${x} ${y - 5} Q${x - 6} ${y - 5} ${x - 7} ${y + 8} Z" fill="${c}"/>`;
    if (style === 'puff') return `<g fill="${c}"><circle cx="${x}" cy="${y - 15}" r="7"/><path d="M${x - 9} ${y} Q${x - 10} ${y - 10} ${x} ${y - 10} Q${x + 10} ${y - 10} ${x + 9} ${y} Q${x + 6} ${y - 5} ${x} ${y - 5} Q${x - 6} ${y - 5} ${x - 9} ${y} Z"/></g>`;
    return `<path d="M${x - 9} ${y - 1} Q${x - 9} ${y - 11} ${x} ${y - 11} Q${x + 9} ${y - 11} ${x + 9} ${y - 1} Q${x + 6} ${y - 6} ${x} ${y - 6} Q${x - 6} ${y - 6} ${x - 9} ${y - 1} Z" fill="${c}"/>`;
}
function ygFace(x, y) {
    return `<path d="M${x - 4.6} ${y - 1} q1.4 1.3 2.8 0 M${x + 1.8} ${y - 1} q1.4 1.3 2.8 0" stroke="#2a1d1a" stroke-width="0.9" fill="none" stroke-linecap="round"/><path d="M${x - 2} ${y + 3} q2 1.6 4 0" stroke="#7a3b2e" stroke-width="0.9" fill="none" stroke-linecap="round"/><circle cx="${x - 5}" cy="${y + 2}" r="1.4" fill="#ff9ecf" opacity="0.45"/><circle cx="${x + 5}" cy="${y + 2}" r="1.4" fill="#ff9ecf" opacity="0.45"/>`;
}
function ygSit(x, y, s, skin, hair, top, pants, style, heart) {
    const hands = heart
        ? `<path d="M-12 -36 Q-9 -24 -2 -24 M12 -36 Q9 -24 2 -24" stroke="${top}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M-2 -30 L0 -22 L2 -30 Z" fill="${skin}"/>`
        : `<path d="M-12 -36 Q-20 -24 -22 -9 M12 -36 Q20 -24 22 -9" stroke="${top}" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="-22" cy="-8" r="3" fill="${skin}"/><circle cx="22" cy="-8" r="3" fill="${skin}"/>`;
    return `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="-5" rx="27" ry="9" fill="${pants}"/><path d="M-14 -8 Q-17 -38 0 -44 Q17 -38 14 -8 Z" fill="${top}"/>${hands}<rect x="-3" y="-50" width="6" height="7" fill="${skin}"/><circle cx="0" cy="-57" r="9.5" fill="${skin}"/>${ygHair(style, 0, -57, hair)}${ygFace(0, -57)}</g>`;
}
function ygMat(x, y, w, color) {
    const h = w * 0.22;
    return `<path d="M${x - w / 2 + 8} ${y - h} H${x + w / 2 - 8} L${x + w / 2} ${y} H${x - w / 2} Z" fill="${color}"/><path d="M${x - w / 2} ${y} H${x + w / 2} V${y + 3} H${x - w / 2} Z" fill="#000" opacity="0.18"/>`;
}
// המדריכה בתנוחת העץ: רגל אחת על הברך, הידיים מעל הראש
function ygGuide(x, y, s) {
    const L = SRP_GUIDE_LOOK, top = '#f7efe2', pants = '#cdbb9a';
    return `<g transform="translate(${x} ${y}) scale(${s})">
        <path d="M-2 0 L-3 -36" stroke="${pants}" stroke-width="8" stroke-linecap="round"/>
        <path d="M-3 -34 L14 -26 L-1 -18" stroke="${pants}" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M-12 -38 Q-14 -64 0 -70 Q14 -64 10 -38 Z" fill="${top}"/>
        <path d="M-9 -64 Q-14 -84 -2 -102 M9 -64 Q14 -84 2 -102" stroke="${top}" stroke-width="5.5" fill="none" stroke-linecap="round"/>
        <path d="M-2.5 -103 L0 -96 L2.5 -103 Z" fill="${L.skin}"/>
        <rect x="-3" y="-76" width="6" height="7" fill="${L.skin}"/>
        <circle cx="0" cy="-83" r="9" fill="${L.skin}"/>
        ${ygHair('puff', 0, -83, L.hair)}
        <path d="M-8.6 -88 Q0 -93 8.6 -88" stroke="${L.band}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        ${ygFace(0, -83)}
    </g>`;
}
// הפנים של המדריכה בכותרת השיחה
function ygAvatar() {
    const L = SRP_GUIDE_LOOK;
    return `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="40" fill="#d9efe6"/><g fill="${L.hair}"><circle cx="40" cy="15" r="11"/><circle cx="31" cy="19" r="7"/><circle cx="49" cy="19" r="7"/></g><path d="M18 80 Q20 62 40 60 Q60 62 62 80 Z" fill="#f7efe2"/><rect x="35" y="50" width="10" height="12" rx="4" fill="${L.skin}"/><ellipse cx="40" cy="40" rx="17" ry="20" fill="${L.skin}"/><path d="M23 36 Q24 22 40 22 Q56 22 57 36 Q52 29 40 29 Q28 29 23 36 Z" fill="${L.hair}"/><path d="M24 31 Q40 22 56 31" stroke="${L.band}" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M30 40 q3 2.6 6 0 M44 40 q3 2.6 6 0" stroke="#1d130f" stroke-width="1.6" fill="none" stroke-linecap="round"/><path d="M35 48 q5 4 10 0" stroke="#a8494a" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="29" cy="46" r="3" fill="#ff8fa8" opacity="0.35"/><circle cx="51" cy="46" r="3" fill="#ff8fa8" opacity="0.35"/></svg>`;
}
function srpYogaScene(keys) {
    const falls = keys >= roomUnlockAt('waterfall');
    return `
        <svg class="srp-scene" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('yoga'))}">
            <defs>
                <linearGradient id="ygSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b8e3f0"/><stop offset="1" stop-color="#d8efd2"/></linearGradient>
                <radialGradient id="ygHalo" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff1c9" stop-opacity="0.55"/><stop offset="1" stop-color="#fff1c9" stop-opacity="0"/></radialGradient>
            </defs>
            <g aria-hidden="true">
                <rect width="390" height="844" fill="url(#ygSky)"/>
                <path d="M0 120 Q60 80 120 130 L150 420 H0 Z" fill="#7a8b8f"/>
                <path d="M390 110 Q330 70 270 130 L240 420 H390 Z" fill="#6f8287"/>
                <g fill="#5d8a5f"><ellipse cx="20" cy="110" rx="70" ry="60"/><ellipse cx="372" cy="100" rx="70" ry="58"/></g>
            </g>
            <g class="srp-hot srp-falls${falls ? '' : ' locked'}" data-place-hot="waterfall" role="button" tabindex="0" aria-label="${srEsc(roomItemName('waterfall'))}">
                <rect x="150" y="120" width="90" height="300" fill="#e6f6ff"/>
                <g class="srp-fall-lines" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-dasharray="18 6" opacity="0.85"><line x1="166" y1="124" x2="166" y2="414"/><line x1="186" y1="130" x2="186" y2="408"/><line x1="206" y1="122" x2="206" y2="416"/><line x1="226" y1="128" x2="226" y2="410"/></g>
                ${falls ? '' : srLockBadge(195, 256, 'waterfall')}
                <rect class="srp-hit" x="140" y="110" width="110" height="320" fill="transparent"/>
            </g>
            <g aria-hidden="true">
                <ellipse cx="195" cy="440" rx="150" ry="36" fill="#7fc6d6"/>
                <ellipse cx="195" cy="430" rx="120" ry="20" fill="#ffffff" opacity="0.5"/>
                <path d="M0 470 Q195 450 390 470 V844 H0 Z" fill="#8fbf7c"/>
                <path d="M0 520 Q195 500 390 520 V844 H0 Z" fill="#86b873"/>
                <g fill="#5f9a5a"><path d="M20 790 q10 -40 20 0 q8 -30 16 0 z"/><path d="M340 800 q10 -40 20 0 q8 -30 16 0 z"/></g>
                <ellipse cx="195" cy="576" rx="74" ry="12" fill="#9aa5a8"/>
                <circle cx="195" cy="500" r="80" fill="url(#ygHalo)"/>
                ${ygMat(195, 576, 104, '#efe2c8')}
                ${ygMat(95, 640, 76, '#b9a8ff')}${ygMat(295, 640, 76, '#7fd6c0')}${ygMat(145, 704, 82, '#ffb3d6')}${ygMat(245, 704, 82, '#ffd27a')}
                ${ygSit(95, 634, 0.82, SRP_SKIN[1], '#2a1d1a', '#7c6bd6', '#3d3566', 'curly')}
                ${ygSit(295, 634, 0.82, SRP_SKIN[3], '#6b3e26', '#2fa58c', '#1f4d44', 'bun', true)}
                ${ygSit(145, 698, 0.9, SRP_SKIN[0], '#d8b26a', '#ff8fb8', '#6b2f4a', 'long')}
                ${ygSit(245, 698, 0.9, SRP_SKIN[2], '#111111', '#f6b73c', '#6b4a12', 'short', true)}
            </g>
            <g class="srp-hot srp-guide" data-place-hot="guide" role="button" tabindex="0" aria-label="${srEsc(t('room_yoga_guide_aria'))}">
                ${ygGuide(195, 570, 1.12)}
                <rect class="srp-hit" x="160" y="440" width="70" height="140" fill="transparent"/>
            </g>
        </svg>`;
}
// השיחה: עץ קטן כמו במחשב - כל צומת: מה נאמר (המדריכה / נועה / איתי), ואז בחירה, משימה קטנה, תנוחה עם נשימות או סוף
const YG_TREE = {
    start: { say: [['g', 'yg_g_start'], ['p1', 'yg_p1_start'], ['p2', 'yg_p2_start']], opts: [['good', 'yg_o_good'], ['hard', 'yg_o_hard'], ['alone', 'yg_o_alone']] },
    good: { say: [['g', 'yg_g_good']], opts: [['good_x', 'yg_o_friend'], ['good_x', 'yg_o_family'], ['good_x', 'yg_o_partner']] },
    good_x: { say: [['p1', 'yg_p1_good'], ['g', 'yg_g_good_msg']], task: 'yg_task_good', next: 'pose_tree' },
    hard: { say: [['g', 'yg_g_hard']], opts: [['hard_listen', 'yg_o_listen'], ['hard_critic', 'yg_o_critic'], ['hard_used', 'yg_o_used']] },
    hard_listen: { say: [['g', 'yg_g_listen'], ['p2', 'yg_p2_hard'], ['g', 'yg_g_gate']], task: 'yg_task_hard', next: 'pose_child' },
    hard_critic: { say: [['g', 'yg_g_critic'], ['p2', 'yg_p2_hard'], ['g', 'yg_g_gate']], task: 'yg_task_hard', next: 'pose_child' },
    hard_used: { say: [['g', 'yg_g_used'], ['p2', 'yg_p2_hard'], ['g', 'yg_g_gate']], task: 'yg_task_hard', next: 'pose_child' },
    alone: { say: [['g', 'yg_g_alone'], ['p1', 'yg_p1_alone'], ['g', 'yg_g_alone_q']], opts: [['alone_old', 'yg_o_old'], ['alone_new', 'yg_o_new'], ['pose_heart', 'yg_o_breathe']] },
    alone_old: { say: [['g', 'yg_g_old']], task: 'yg_task_old', next: 'pose_heart' },
    alone_new: { say: [['g', 'yg_g_new']], task: 'yg_task_new', next: 'pose_heart' },
    pose_tree: { say: [['g', 'yg_pose_tree']], breath: true, next: 'end' },
    pose_child: { say: [['g', 'yg_pose_child']], breath: true, next: 'end' },
    pose_heart: { say: [['g', 'yg_pose_heart']], breath: true, next: 'end' },
    end: { say: [['g', 'yg_g_end']], end: true },
};
const YG_WHO = { g: 'yg_name_guide', p1: 'yg_name_p1', p2: 'yg_name_p2' };
let ygState = null;   // { box, path: [{ id, pick }], timers: [] }
function ygStopTimers() { if (ygState) { ygState.timers.forEach(clearTimeout); ygState.timers = []; } }
function ygOpenTalk(box) {
    if (box.querySelector('.yg-talk')) return;
    const panel = document.createElement('div');
    panel.className = 'yg-talk';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', t('room_yoga_guide_aria'));
    panel.innerHTML = `
        <div class="yg-talk-head"><span class="yg-avatar">${ygAvatar()}</span><b>${srEsc(t('yg_name_guide'))}</b><button type="button" class="yg-x" aria-label="${srEsc(t('close_btn'))}">${SR_CLOSE_SVG}</button></div>
        <div class="yg-screen"><div class="yg-lines" aria-live="polite"></div></div>
        <div class="yg-nav"><button type="button" class="yg-navbtn" data-yg="back">${srEsc(t('pcx_back'))}</button><button type="button" class="yg-navbtn" data-yg="new">✦ ${srEsc(t('pcx_new'))}</button></div>`;
    box.appendChild(panel);
    box.classList.add('is-talking');
    ygState = { box, path: [{ id: 'start', pick: null }], timers: [] };
    const close = () => { ygStopTimers(); ygState = null; panel.remove(); box.classList.remove('is-talking'); };
    panel.querySelector('.yg-x').addEventListener('click', close);
    panel.querySelector('[data-yg="new"]').addEventListener('click', () => { if (!ygState) return; ygState.path = [{ id: 'start', pick: null }]; ygRender(true); });
    panel.querySelector('[data-yg="back"]').addEventListener('click', () => { if (!ygState || ygState.path.length < 2) return; ygState.path.pop(); ygState.path[ygState.path.length - 1].pick = null; ygRender(false); });
    srpCleanups.push(close);
    ygRender(true);
}
function ygBubble(lines, who, text, extra) {
    const el = document.createElement('div');
    el.className = `yg-line is-${who}${extra ? ' ' + extra : ''}`;
    if (who === 'p1' || who === 'p2') el.innerHTML = `<span class="yg-name">${srEsc(t(YG_WHO[who]))}</span>`;
    el.appendChild(document.createTextNode(text));
    lines.appendChild(el);
    return el;
}
// הכול מחדש לפי המסלול (כמו במחשב): מה שכבר נאמר מופיע מיד, והצומת האחרון נאמר לאט
function ygRender(animateLast) {
    if (!ygState) return;
    ygStopTimers();
    const lines = ygState.box.querySelector('.yg-lines');
    if (!lines) return;
    lines.innerHTML = '';
    const nav = ygState.box.querySelector('[data-yg="back"]');
    if (nav) nav.disabled = ygState.path.length < 2;
    const reduce = srpReduce();
    ygState.path.forEach((entry, i) => {
        const node = YG_TREE[entry.id];
        const last = i === ygState.path.length - 1;
        const step = last && animateLast && !reduce ? 650 : 0;
        node.say.forEach(([who, key], j) => {
            const show = () => { if (!ygState) return; ygBubble(lines, who, t(key), last ? '' : 'is-old'); ygScroll(); };
            if (step) ygState.timers.push(setTimeout(show, j * step)); else show();
        });
        if (!last) {
            if (entry.pick) ygBubble(lines, 'me', entry.pick, 'is-old');
            return;
        }
        const after = () => { if (ygState) ygControls(entry, node); };
        if (step) ygState.timers.push(setTimeout(after, node.say.length * step)); else after();
    });
}
function ygScroll() { const sc = ygState && ygState.box.querySelector('.yg-screen'); if (sc) sc.scrollTop = sc.scrollHeight; }
function ygGo(next, pickText) {
    if (!ygState) return;
    ygState.path[ygState.path.length - 1].pick = pickText;
    ygState.path.push({ id: next, pick: null });
    ygRender(true);
}
function ygControls(entry, node) {
    const lines = ygState.box.querySelector('.yg-lines');
    const box = document.createElement('div');
    box.className = 'yg-ctrl';
    const btn = (text, fn, cls) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = text; if (cls) b.className = cls; b.addEventListener('click', fn); box.appendChild(b); return b; };
    if (node.opts) {
        node.opts.forEach(([next, key]) => btn(t(key), () => ygGo(next, t(key))));
    } else if (node.task) {
        const card = document.createElement('div');
        card.className = 'yg-task';
        card.innerHTML = `<b>🎯</b><span>${srEsc(t(node.task))}</span>`;
        lines.appendChild(card);
        btn(t('pcx_task_ok'), () => ygGo(node.next, t('pcx_task_ok')));
        btn(t('pcx_task_today'), async () => {
            const ok = typeof pcAddTodayTask === 'function' ? await pcAddTodayTask(t(node.task)) : false;
            if (ok) showAppToast(t('pcx_task_added'));
            ygGo(node.next, t('pcx_task_today'));
        });
    } else if (node.breath) {
        ygBreathe(lines, () => { if (ygState) { const b2 = document.createElement('div'); b2.className = 'yg-ctrl is-end'; const go = document.createElement('button'); go.type = 'button'; go.textContent = t('nm_continue'); go.addEventListener('click', () => ygGo(node.next, null)); b2.appendChild(go); lines.appendChild(b2); ygScroll(); } });
        return;
    } else if (node.end) {
        box.classList.add('is-end');
        btn(`✦ ${t('pcx_new')}`, () => { ygState.path = [{ id: 'start', pick: null }]; ygRender(true); });
        btn(t('close_btn'), () => ygState && ygState.box.querySelector('.yg-x').click());
    }
    lines.appendChild(box);
    ygScroll();
}
// שלוש נשימות ביחד: העיגול גדל (שאיפה) וקטן (נשיפה)
function ygBreathe(lines, done) {
    const wrap = document.createElement('div');
    wrap.className = 'yg-breath-box';
    wrap.innerHTML = `<span class="yg-breath"></span><span class="yg-breath-label"></span>`;
    lines.appendChild(wrap);
    ygScroll();
    const ring = wrap.querySelector('.yg-breath'), label = wrap.querySelector('.yg-breath-label');
    const reduce = srpReduce();
    const half = reduce ? 300 : 4000;
    let n = 0;
    const tick = () => {
        if (!ygState || !wrap.isConnected) return;
        if (n >= 6) { label.textContent = ''; ring.classList.remove('in'); done(); return; }
        const inhale = n % 2 === 0;
        ring.classList.toggle('in', inhale);
        label.textContent = t(inhale ? 'room_breath_in' : 'room_breath_out');
        n++;
        ygState.timers.push(setTimeout(tick, half));
    };
    tick();
}
function srpInitYoga(box, keys, opts = {}) {
    return {
        guide: () => ygOpenTalk(box),
        waterfall: el => {
            if (el.classList.contains('locked')) { srShowLockTip('waterfall'); return; }
            roomOpenPlace('waterfall', { fromHall: !!opts.fromHall, parent: 'yoga' });
        },
    };
}

// ---------- מפתח 13: המפל - קרחת יער עם מפל (ה' של דלת 5, לפי בחירה מפורשת), מגיעים אליו דרך היוגה ----------
// יושבים על הסלע: הכפתורים נעלמים, הקשת מתחזקת ונשמע קול של מים (נוצר במקום, בלי קבצים); נגיעה במים - אדוות
function srpWaterfallScene() {
    return `
        <svg class="srp-scene" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('waterfall'))}">
            <defs>
                <linearGradient id="wfBack" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe9e0"/><stop offset="1" stop-color="#8fc4b0"/></linearGradient>
                <linearGradient id="wfWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e6f6fa"/><stop offset="1" stop-color="#b4e0ec"/></linearGradient>
                <linearGradient id="wfPool" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc4d2"/><stop offset="1" stop-color="#3f8fa3"/></linearGradient>
                <linearGradient id="wfRain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9a9a"/><stop offset="0.5" stop-color="#ffe08a"/><stop offset="1" stop-color="#9ad6ff"/></linearGradient>
            </defs>
            <g aria-hidden="true">
                <rect width="390" height="844" fill="url(#wfBack)"/>
                <path d="M70 120 Q100 90 140 100 L250 100 Q296 92 320 124 L340 560 H50 Z" fill="#6b7b78"/>
                <path d="M90 140 L130 120 L140 200 L110 260 Z M280 130 L310 150 L300 260 L276 220 Z" fill="#5a6967"/>
                <path d="M70 120 Q100 90 140 100 L250 100 Q296 92 320 124 L316 140 Q290 112 250 116 L140 116 Q102 108 76 134 Z" fill="#4f8f5a"/>
                <rect x="150" y="104" width="90" height="440" fill="url(#wfWater)"/>
                <g class="srp-fall-lines" stroke="#ffffff" stroke-width="3" stroke-dasharray="18 6" stroke-linecap="round" opacity="0.9"><line x1="160" y1="104" x2="160" y2="544"/><line x1="178" y1="110" x2="178" y2="544"/><line x1="196" y1="104" x2="196" y2="544"/><line x1="214" y1="110" x2="214" y2="544"/><line x1="230" y1="104" x2="230" y2="544"/></g>
                <path class="srp-rainbow" d="M120 470 A90 90 0 0 1 280 470" fill="none" stroke="url(#wfRain)" stroke-width="6"/>
                <g class="srp-mist" fill="#ffffff"><ellipse cx="150" cy="540" rx="80" ry="22" opacity="0.6"/><ellipse cx="250" cy="536" rx="90" ry="20" opacity="0.55"/><ellipse cx="200" cy="520" rx="60" ry="16" opacity="0.5"/></g>
            </g>
            <g class="srp-hot srp-pool" data-place-hot="pool" role="button" tabindex="0" aria-label="${srEsc(t('room_waterfall_pool_aria'))}">
                <ellipse cx="195" cy="580" rx="210" ry="80" fill="url(#wfPool)"/>
                <g class="srp-ripples-wf" fill="none" stroke="#ffffff" stroke-width="2"><ellipse cx="195" cy="560" rx="70" ry="14"/><ellipse cx="195" cy="566" rx="90" ry="18" style="animation-delay:1.2s"/><ellipse cx="195" cy="572" rx="110" ry="22" style="animation-delay:2.4s"/></g>
                <g class="srp-splash"></g>
            </g>
            <g aria-hidden="true">
                <g fill="#5d6a68"><ellipse cx="30" cy="560" rx="60" ry="40"/><ellipse cx="370" cy="556" rx="56" ry="42"/><ellipse cx="90" cy="640" rx="40" ry="20"/></g>
                <g fill="#77857f"><ellipse cx="24" cy="546" rx="40" ry="18"/><ellipse cx="364" cy="540" rx="36" ry="18"/></g>
                <path d="M0 640 Q120 610 200 640 T390 630 V844 H0 Z" fill="#2f6b45"/>
                <path d="M0 700 Q100 680 195 700 T390 694 V844 H0 Z" fill="#245a3a"/>
                <g stroke="#4f9a5e" stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M30 700 q-14 -30 -30 -40"/><path d="M38 700 q-4 -36 -14 -54"/><path d="M46 700 q8 -32 22 -48"/><path d="M54 700 q16 -24 34 -30"/><path d="M340 694 q-16 -26 -32 -34"/><path d="M348 694 q-4 -34 -12 -50"/><path d="M356 694 q8 -30 20 -44"/><path d="M364 694 q14 -22 30 -28"/></g>
                <path d="M0 0 H390 V62 Q362 92 324 72 Q292 98 254 74 Q222 94 192 72 Q160 96 130 74 Q98 98 68 72 Q38 94 0 68 Z" fill="#1d4a30"/>
                <g fill="#1d4a30"><rect x="-10" y="0" width="70" height="140" rx="30"/><ellipse cx="20" cy="40" rx="90" ry="70"/><ellipse cx="380" cy="30" rx="96" ry="70"/></g>
            </g>
            <g class="srp-hot srp-rock" data-place-hot="rock" role="button" tabindex="0" aria-label="${srEsc(t('room_waterfall_rock_aria'))}">
                <ellipse cx="292" cy="760" rx="70" ry="24" fill="#6f7a78"/>
                <ellipse cx="292" cy="752" rx="64" ry="16" fill="#8a9692"/>
                <ellipse cx="270" cy="748" rx="22" ry="5" fill="#a3aeaa"/>
                <rect class="srp-hit" x="216" y="724" width="152" height="64" fill="transparent"/>
            </g>
        </svg>`;
}
// קול המים: רעש רך עם מסנן, בלולאה - רק כשיושבים על הסלע
let srpWater = null;
function srpWaterStart() {
    const a = srpCtx();
    if (!a || srpWater) return;
    const { ctx } = a;
    const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) { last = (last + 0.04 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 6; }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 1.2);
    src.connect(f); f.connect(g); g.connect(a.master);
    src.start();
    srpWater = { src, g, ctx };
}
function srpWaterStop() {
    if (!srpWater) return;
    const { src, g, ctx } = srpWater;
    srpWater = null;
    try { g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.25); setTimeout(() => { try { src.stop(); } catch {} }, 900); } catch {}
}
function srpInitWaterfall(box) {
    srpCleanups.push(srpWaterStop);
    box.querySelector('.srp-rest-exit').addEventListener('click', srpWaterStop);
    return {
        rock: () => { srpRest(box); srpWaterStart(); },
        pool: el => {
            const g = el.querySelector('.srp-splash');
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    if (!g.isConnected) return;
                    const r = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
                    r.setAttribute('cx', 150 + Math.random() * 90);
                    r.setAttribute('cy', 590 + Math.random() * 30);
                    r.setAttribute('rx', '18');
                    r.setAttribute('ry', '5');
                    r.setAttribute('class', 'srp-splash-ring');
                    g.appendChild(r);
                    setTimeout(() => r.remove(), 1500);
                }, srpReduce() ? 0 : i * 220);
            }
        },
    };
}
