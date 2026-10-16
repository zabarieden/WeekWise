// ===== New Me: המקומות שמאחורי הדלתות במסדרון =====
// לפי בחירה מפורשת (2026-10-09), מתוך 5 אפשרויות לכל דלת על הקנבס:
// דלת 2 - המרפסת המקורה מול הים: ערסל, והמחשב שם הוא טאבלט (נעול עד שנעצב אותו יחד);
// דלת 3 - פינה חמה עם כורסה ותקליטים: הגיטרה והיומן (היומן נשמר בחשבון - רק שלך);
// דלת 4 - חדר הנשימה: חוף בשקיעה, השמש עולה ויורדת עם הנשימה. בלי דקות ובלי ספירה - נכנסים, לוחצים ומתחילים.
//          ובחול (עם חדר הנשימה) - מקל לכתוב בו;
// דלת 5 - השביל ביער עם פנסים וספסל: נגיעה בפנסים מכבה אותם, ויש יום בחוץ.
// ובאתגר האחרון - בקבוק מגיע מהים, ובתוכו המכתב מהעבר. 10 שלבים: כל מפתח פותח מקום שלם, עם כל מה שבו (ר' ROOM_UNLOCKS).
// כל הציורים בגודל 390×844, כמו המסדרון, וכל מה שנוגעים בו נמצא בתוך הציור עצמו.

const SRP_DOOR_PLACE = { 2: 'porch', 3: 'music', 4: 'breath', 5: 'outside' };
// מקום בתוך מקום: היוגה בסוף השביל ביער (שלב 6, עם היער), והמפל מאחורי היוגה (שלב 7)
const SRP_PLACE_PARENT = { yoga: 'outside', waterfall: 'yoga' };
const SRP_BACK_KEYS = { outside: 'room_back_to_forest', yoga: 'room_back_to_yoga' };
const SRP_BREATH_MS = 10 * 60 * 1000;   // סשן של עשר דקות (לא כתוב בשום מקום - לפי בקשה מפורשת)
// 🎨 הציורים של היער הקסום (לפי בקשה מפורשת, 2026-10-14: "יש את הציורים אתה יכול לשים אותם"): world/*.jpg, 768×1376,
// ממורכזים על 390×844 - הצדדים נחתכים קצת. מה שזז או נפתח נשאר קוד מעל הציור
const SRP_ART = 'world/';
function srpArt(name) { return `<image class="srp-art" href="${SRP_ART}${name}" x="-40.55" y="0" width="471.1" height="844" preserveAspectRatio="none"/>`; }
// דמות מגזורה (PNG שקוף) שיושבת על נקודה: cx = האמצע, bottom = איפה שהיא יושבת, h = הגובה, ratio = רוחב / גובה
function srpSprite(name, cx, bottom, h, ratio, cls = '') { const w = h * ratio; return `<image class="${cls}" href="${SRP_ART}${name}" x="${(cx - w / 2).toFixed(1)}" y="${(bottom - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h}"/>`; }
// מה שעוד נעול בציור: צעיף כהה ורך (מטושטש בשוליים) ומנעול מעליו
function srpVeil(x, y, w, h) { return `<g class="srp-veil" aria-hidden="true"><filter id="srpVeilBlur" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="10"/></filter><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${Math.min(w, h) / 3}" fill="#120a24" opacity="0.62" filter="url(#srpVeilBlur)"/></g>`; }
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
        <div class="sr-sub-head"><button type="button" class="sr-sub-back${!opts.parent && opts.fromHall ? ' is-to-hall' : ''}">${SR_CHEVRON.prev}${srEsc(t(opts.parent ? SRP_BACK_KEYS[opts.parent] : opts.fromHall ? 'room_back_to_hall' : 'room_back_to_room'))}</button><b>${srEsc(roomItemName(id))}</b><span class="srp-tools"></span></div>
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
// הפטיפון (בחדר, פתוח עם החדר): קודם הקליפים הרשמיים של להיטים עולמיים מהשנים האחרונות ביוטיוב (SRP_HITS - לפי
// בקשה מפורשת: "שירים מודרניים ממש... מה-10 שנים אחרונות", והם נפתחים ביוטיוב כי הם מוגנים בזכויות יוצרים), ומתחת
// חמישה לחנים קלאסיים ועממיים שכולם מכירים ושהם נחלת הכלל - הם מתנגנים כאן בחדר. הכול נוצר במקום, בלי קבצים.
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
// הלהיטים (yt = מזהה הקליפ הרשמי ביוטיוב, נבדק מול youtube.com/oembed): שמות השירים והזמרים כמו שהם בכל שפה
const SRP_HITS = [
    { yt: '4NRXx6U8ABQ', song: 'Blinding Lights', artist: 'The Weeknd', color: '#ff5a6a' },
    { yt: 'TUVcZfQe-Kw', song: 'Levitating', artist: 'Dua Lipa', color: '#c084fc' },
    { yt: 'H5v3kku4y6Q', song: 'As It Was', artist: 'Harry Styles', color: '#7fd6ff' },
    { yt: 'G7KNmW9a75Y', song: 'Flowers', artist: 'Miley Cyrus', color: '#ffd27a' },
    { yt: 'q0hyYWKXF0Q', song: 'Dance Monkey', artist: 'Tones And I', color: '#5bd18b' },
    { yt: 'ru0K8uYEZWw', song: "Can't Stop the Feeling!", artist: 'Justin Timberlake', color: '#ff9ecf' },
    { yt: 'kPa7bsKwL-c', song: 'Die With A Smile', artist: 'Lady Gaga, Bruno Mars', color: '#f59e0b' },
    { yt: 'ekr2nIex040', song: 'APT.', artist: 'ROSÉ, Bruno Mars', color: '#fb7185' },
    { yt: 'gdZLi9oWNZg', song: 'Dynamite', artist: 'BTS', color: '#facc15' },
    { yt: 'WcIcVapfqXw', song: 'Calm Down', artist: 'Rema, Selena Gomez', color: '#38bdf8' },
    { yt: 'kJQP7kiw5Fk', song: 'Despacito', artist: 'Luis Fonsi, Daddy Yankee', color: '#f97316' },
    { yt: 'JGwWNGJdvx8', song: 'Shape of You', artist: 'Ed Sheeran', color: '#a78bfa' },
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
let srpNowPlaying = -1;   // התקליט שמתנגן עכשיו בחדר - גם כשמסתובבים לקיר אחר וחוזרים, הפטיפון נשאר "מנגן"
function srpMusicStart(i) { srpPlaySong(SRP_RECORDS[i] || SRP_RECORDS[0]); }
// 🎵 השירים הקסומים של פינת המוזיקה (לפי בקשה מפורשת, 2026-10-14: "שירים מיוחדים וקסומים שמנגנים ומרגיעים... שנוגעים
// בגיטרה ובכל פטיפון בנפרד"): לחנים מקוריים ושקטים - אחד לגיטרה ואחד לכל תקליט שתלוי בעץ. נגיעה מנגנת, נגיעה שוב עוצרת
const SRP_MAGIC_SONGS = {
    // שיר ערש של היער - פריטה על הגיטרה (רה, סי מינור, סול, לה) ומנגינה רכה מעליה
    guitar: { color: '#ffd27a', unit: 0.3, once: true, voices: [
        { vol: 0.05, ring: 2.2, notes: 'D3 A3 D4 F#4 A4 F#4 D4 A3 B2 F#3 B3 D4 F#4 D4 B3 F#3 G2 D3 G3 B3 D4 B3 G3 D3 A2 E3 A3 C#4 E4 C#4 A3 E3' },
        { vol: 0.03, ring: 1.6, type: 'sine', notes: 'A4:4 F#4:2 E4:2 D4:6 -:2 B4:4 A4:2 F#4:2 E4:8' },
    ] },
    // תיבת נגינה של כוכבים - ואלס איטי
    rec1: { color: '#ff9ecf', unit: 0.36, voices: [
        { vol: 0.04, ring: 1.6, type: 'sine', notes: 'E5 C#5 A4 B4:3 C#5 E5 F#5 E5:3 C#5 B4 A4 F#4:3 A4 B4 C#5 B4:3' },
        { vol: 0.012, ring: 1.2, type: 'sine', notes: 'E6 C#6 A5 B5:3 C#6 E6 F#6 E6:3 C#6 B5 A5 F#5:3 A5 B5 C#6 B5:3' },
        { vol: 0.04, ring: 2.4, type: 'sine', notes: 'A2:3 -:3 F#2:3 -:3 D2:3 -:3 E2:3 -:3' },
        { vol: 0.016, ring: 1.4, type: 'sine', notes: 'A3:6 F#3:6 D3:6 E3:6' },
    ] },
    // נבל הירח - ארפג'ים איטיים וצלילים ארוכים מעליהם
    rec2: { color: '#b9a8ff', unit: 0.28, voices: [
        { vol: 0.035, ring: 2.6, notes: 'F3 C4 E4 A4 C5 A4 E4 C4 E3 B3 D4 G4 B4 G4 D4 B3 D3 A3 C4 F4 A4 F4 C4 A3 C3 G3 B3 E4 G4 E4 B3 G3' },
        { vol: 0.022, ring: 1.4, type: 'sine', notes: 'A5:8 G5:8 F5:8 E5:8' },
    ] },
    // פעמוני המפל - פעמונים שקטים מעל צליל עמוק
    rec3: { color: '#7fd6ff', unit: 0.45, voices: [
        { vol: 0.03, ring: 2.8, type: 'sine', notes: 'E5 G5 A5:2 G5 E5 D5:2 C5 D5 E5:2 G5:2 -:2 A5 C6 A5:2 G5 E5 D5:2 E5:4 -:4' },
        { vol: 0.035, ring: 1.3, type: 'sine', notes: 'C3:16 A2:16' },
        { vol: 0.014, ring: 1.3, type: 'sine', notes: 'G3:16 E3:16' },
    ] },
};
let srpMagicNow = null;   // השיר הקסום שמתנגן עכשיו (guitar / rec1 / rec2 / rec3)
function srpMagicToggle(id) {
    if (srpMagicNow === id) { srpMusicStop(); return null; }
    srpPlaySong(SRP_MAGIC_SONGS[id]);
    srpNowPlaying = -1;
    srpMagicNow = id;
    return id;
}
function srpPlaySong(song) {
    const a = srpCtx();
    if (!a || !song) return;
    srpMusicStop(true);
    const { ev, len } = srpSongEvents(song);
    if (!ev.length || !len) return;
    const u = song.unit, start = song.start || 0;
    let base = a.ctx.currentTime + 0.15 - start * u;
    let idx = Math.max(0, ev.findIndex(e => e.at >= start));
    const schedule = () => {
        const horizon = a.ctx.currentTime + 1.4;
        for (let guard = 0; guard < 400; guard++) {
            if (idx >= ev.length) {
                // שיר קצר (הגיטרה): פעם אחת, ואז נעצר לבד (לפי בקשה מפורשת, 2026-10-16)
                if (song.once) {
                    const left = (base + len * u - a.ctx.currentTime) * 1000;
                    a.loop = setTimeout(() => { srpMusicStop(); window.dispatchEvent(new Event('srp-song-end')); }, Math.max(0, left) + 300);
                    return;
                }
                idx = 0; base += len * u;
            }
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
    if (!quick) { srpNowPlaying = -1; srpMagicNow = null; }
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
        const x = 34 + ((i * 53) % 322), y = 160 + ((i * 97) % 470);
        rain += `<line x1="${x}" y1="${y}" x2="${x - 3}" y2="${y + 15}"/>`;
    }
    // הציור (world/lake-dock.jpg): מרפסת עץ מול אגם קסום, ירח, פנס על הרצפה ומנורת אלאדין על שולחן קטן (המנורה מחכה
    // לדמות שתצא ממנה - לפי בקשה מפורשת: "בנתיים אל תשים"). מעל הציור: הערסל בין העמודים, הגשם והענן, הבקבוק במים,
    // והטאבלט שמונח על הרצפה
    return `
        <svg class="srp-scene srp-painted" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('porch'))}">
            <defs>
                <radialGradient id="srpPLantern" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.5"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
                <radialGradient id="srpPTab" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#9fd8ff" stop-opacity="0.35"/><stop offset="1" stop-color="#9fd8ff" stop-opacity="0"/></radialGradient>
                <linearGradient id="srpPScreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e3a8a"/><stop offset="0.55" stop-color="#7c3aed"/><stop offset="1" stop-color="#ec4899"/></linearGradient>
                <radialGradient id="srpPBottle" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#bff5e6" stop-opacity="0.55"/><stop offset="1" stop-color="#bff5e6" stop-opacity="0"/></radialGradient>
            </defs>
            <g aria-hidden="true">
                ${srpArt('lake-dock.jpg')}
                <circle class="srp-flicker" cx="70" cy="640" r="70" fill="url(#srpPLantern)"/>
                <g class="srp-waves"><g stroke="#e6dcff" stroke-opacity="0.35" stroke-linecap="round"><line x1="150" y1="540" x2="176" y2="540"/><line x1="240" y1="590" x2="262" y2="590"/><line x1="90" y1="600" x2="110" y2="600"/></g></g>
                <g class="srp-rain">
                    <rect width="390" height="700" fill="#0a0f2a" opacity="0.32"/>
                    <g class="srp-rain-a" stroke="#b9c6ff" stroke-opacity="0.55" stroke-width="1.2" stroke-linecap="round">${rain}</g>
                    <g transform="translate(17 30)"><g class="srp-rain-b" stroke="#d8e0ff" stroke-opacity="0.35" stroke-width="1" stroke-linecap="round">${rain}</g></g>
                    <g class="srp-ripples" fill="none" stroke="#c9d2ff" stroke-opacity="0.55"><ellipse cx="120" cy="560" rx="10" ry="2.5"/><ellipse cx="220" cy="600" rx="12" ry="3" style="animation-delay:.5s"/><ellipse cx="300" cy="570" rx="9" ry="2.2" style="animation-delay:1s"/></g>
                </g>
            </g>
            ${rainOpen ? `<g class="srp-hot srp-cloud" data-place-hot="rain" role="button" tabindex="0" aria-label="${srEsc(roomItemName('rain'))}" aria-pressed="false">
                <!-- ענן קטן בשמיים: נגיעה עוצרת את הגשם ומחזירה אותו (לפי בקשה מפורשת: "אולי ענן קטן?") -->
                <g class="srp-cloud-float">
                    <path class="srp-cloud-body" d="M252 222 a17 17 0 0 1 12 -29 a23 23 0 0 1 43 -7 a16 16 0 0 1 27 16 a14 14 0 0 1 -5 29 h-69 a14 14 0 0 1 -8 -9 z"/>
                    <path class="srp-cloud-shine" d="M272 196 a17 17 0 0 1 26 -6" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity="0.6"/>
                </g>
                <rect class="srp-hit" x="240" y="170" width="112" height="88" fill="transparent"/>
            </g>` : ''}
            ${bottle ? `<g class="srp-hot srp-bottle" data-place-hot="bottle" role="button" tabindex="0" aria-label="${srEsc(t('room_bottle_aria'))}">
                <g class="srp-bottle-drift"><g class="srp-bottle-bob">
                    <circle cx="236" cy="562" r="36" fill="url(#srpPBottle)"/>
                    <!-- הבקבוק עם המכתב שבא מהים - הציור שלה (world/bottle.png, לפי בקשה מפורשת, 2026-10-14) -->
                    <image class="srp-bottle-art" href="${SRP_ART}bottle.png" x="222" y="526" width="28" height="60" transform="rotate(-14 236 560)"/>
                    <ellipse cx="236" cy="583" rx="22" ry="3" fill="none" stroke="#bff5e6" stroke-opacity="0.45"/>
                </g></g>
                <ellipse class="srp-hit" cx="238" cy="568" rx="38" ry="26" fill="transparent"/>
            </g>` : ''}
            <!-- 🪔 מנורת אלאדין שעל השולחן (מצוירת): נגיעה - רוח היער יוצאת ממנה בערפל ושואלת מה המשאלה (srpOpenGenie) -->
            <g class="srp-hot srp-lamp" data-place-hot="lamp" role="button" tabindex="0" aria-label="${srEsc(t('room_genie_aria'))}">
                <rect class="srp-hit" x="280" y="554" width="110" height="88" fill="transparent"/>
            </g>
            <!-- הטאבלט מונח על הרצפה של המרפסת (על השולחן הקטן עומדת עכשיו מנורת אלאדין) -->
            <g class="srp-hot srp-tablet${tabletOpen ? ' is-open' : ' locked'}" data-place-hot="tablet" role="button" tabindex="0" aria-label="${srEsc(roomItemName('tablet'))}">
                <ellipse cx="196" cy="772" rx="46" ry="9" fill="#000" opacity="0.28"/>
                ${tabletOpen ? '<ellipse cx="196" cy="762" rx="78" ry="34" fill="url(#srpPTab)"/>' : ''}
                <g transform="translate(196 764) scale(1 0.42) rotate(-10)">
                    <rect x="-40" y="-29" width="80" height="58" rx="7" fill="#26262e"/>
                    <rect x="-36" y="-25" width="72" height="50" rx="4" fill="${tabletOpen ? 'url(#srpPScreen)' : '#0d1424'}"/>
                    ${tabletOpen ? '<g fill="#fff"><circle cx="-18" cy="-9" r="7" opacity="0.28"/><rect x="-6" y="-14" width="30" height="5" rx="2.5" opacity="0.5"/><rect x="-6" y="-4" width="22" height="5" rx="2.5" opacity="0.35"/><rect x="-26" y="8" width="52" height="7" rx="3.5" opacity="0.3"/></g>' : ''}
                </g>
                ${tabletOpen ? '' : `<g transform="translate(196 728) scale(0.5)">${srLockShape()}</g><text x="196" y="706" text-anchor="middle" font-size="8.5" font-weight="800" fill="#ffe2a6">${srEsc(t('room_key_n').replace('{n}', srFmt(roomUnlockAt('tablet'))))}</text>`}
                <rect class="srp-hit" x="136" y="694" width="120" height="96" fill="transparent"/>
            </g>
        </svg>`;
}
function srpInitPorch(box) {
    // הגשם: בכל כניסה בלי גשם (לפי בקשה מפורשת, 2026-10-16: "שהברירת מחדל לא תהיה גשם - תמיד שנכנסים שוב אז שמשי");
    // הענן הקטן בשמיים מדליק אותו ומכבה (לא נזכר בפעם הבאה)
    const cloud = box.querySelector('.srp-cloud');
    const setRain = (on, save) => {
        box.classList.toggle('is-rain', on);
        if (cloud) cloud.setAttribute('aria-pressed', on ? 'true' : 'false');
    };
    if (cloud) setRain(false);
    return {
        rain: () => setRain(!box.classList.contains('is-rain')),
        tablet: el => {
            if (el.classList.contains('locked')) { srShowLockTip('tablet'); return; }
            srShowTip(t('room_tablet_soon'));
        },
        bottle: el => srpOpenBottle(el),
        lamp: () => srpOpenGenie(box),
    };
}

// 🪔 רוח היער ממנורת אלאדין (לפי בקשה מפורשת, 2026-10-14: "שלוחצים עליו זה נפתח... הוא יוצא משם בצורה קסומה כזה עם ערפל
// ומסתובב... ואז הוא שואל מה המשאלה שלך? או מה תרצה לשנות בחייך? ומשם נפתח את זה אבל בנתיים תעשה את זה"): ערפל עולה
// מהפיה של המנורה, הרוח (world/genie.png) יוצאת קטנה ומסתובבת בספירלה עד שהיא גדולה באמצע, ואז שואלת. ההמשך - בהמשך
const SRP_GENIE_FROM = { x: 254 / 390, y: 586 / 844 };   // הפיה של המנורה בציור
function srpOpenGenie(box) {
    if (!box || box.querySelector('.srp-genie')) return;
    const reduce = srpReduce();
    const r = box.getBoundingClientRect();
    const layer = document.createElement('div');
    layer.className = `srp-genie${reduce ? ' is-reduced' : ''}`;
    layer.style.setProperty('--gx', `${Math.round((SRP_GENIE_FROM.x - 0.5) * r.width)}px`);
    layer.style.setProperty('--gy', `${Math.round((SRP_GENIE_FROM.y - 0.42) * r.height)}px`);
    layer.style.setProperty('--fx', `${(SRP_GENIE_FROM.x * 100).toFixed(1)}%`);
    layer.style.setProperty('--fy', `${(SRP_GENIE_FROM.y * 100).toFixed(1)}%`);
    layer.innerHTML = `
        <div class="srp-genie-fog" aria-hidden="true">${Array.from({ length: 10 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
        <div class="srp-genie-swirl" aria-hidden="true"><img class="srp-genie-img" src="${SRP_ART}genie.png" alt=""></div>
        <div class="srp-genie-ask" role="dialog" aria-label="${srEsc(t('room_genie_q1'))}">
            <b>${srEsc(t('room_genie_q1'))}</b>
            <span>${srEsc(t('room_genie_q2'))}</span>
            <button type="button" class="srp-genie-close">${srEsc(t('close_btn'))}</button>
        </div>`;
    box.appendChild(layer);
    void layer.offsetWidth;
    layer.classList.add('go');
    const close = () => { layer.classList.add('bye'); setTimeout(() => layer.remove(), reduce ? 0 : 600); };
    layer.querySelector('.srp-genie-close').addEventListener('click', close);
    srpCleanups.push(() => layer.remove());
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
// הציור (world/music-hollow.jpg): פינה בתוך שורשי העץ - הגיטרה, שלושה תקליטים תלויים, מנורת פטרייה, הספה והיומן על הגדם.
// נגיעה בגיטרה או בתקליט מנגנת את השיר הקסום שלו (SRP_MAGIC_SONGS), נגיעה שוב עוצרת
const SRP_MUSIC_RECS = [
    { id: 'rec1', x: 33, y: 355, r: 25 },
    { id: 'rec2', x: 119, y: 300, r: 28 },
    { id: 'rec3', x: 169, y: 375, r: 22 },
];
function srpMusicScene(keys) {
    return `
        <svg class="srp-scene srp-painted" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('music'))}">
            <defs>
                <radialGradient id="srpMLamp" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffc9b8" stop-opacity="0.5"/><stop offset="1" stop-color="#ffc9b8" stop-opacity="0"/></radialGradient>
                ${SRP_MUSIC_RECS.map(r => `<radialGradient id="srpMHalo-${r.id}" cx="0.5" cy="0.5" r="0.5"><stop offset="0.45" stop-color="${SRP_MAGIC_SONGS[r.id].color}" stop-opacity="0.75"/><stop offset="1" stop-color="${SRP_MAGIC_SONGS[r.id].color}" stop-opacity="0"/></radialGradient>`).join('')}
            </defs>
            <g aria-hidden="true">
                ${srpArt('music-hollow.jpg')}
                <circle class="srp-flicker" cx="112" cy="418" r="70" fill="url(#srpMLamp)"/>
            </g>
            ${SRP_MUSIC_RECS.map(r => `<g class="srp-hot srp-rec${srpMagicNow === r.id ? ' is-playing' : ''}" data-place-hot="${r.id}" data-song-id="${r.id}" role="button" tabindex="0" aria-pressed="${srpMagicNow === r.id}" aria-label="${srEsc(t('room_magic_song_' + r.id))}">
                <circle class="srp-rec-halo" cx="${r.x}" cy="${r.y}" r="${(r.r * 1.45).toFixed(1)}" fill="url(#srpMHalo-${r.id})"/>
                <circle class="srp-hit" cx="${r.x}" cy="${r.y}" r="${r.r + 6}" fill="transparent"/>
            </g>`).join('')}
            <g class="srp-hot srp-guitar${srpMagicNow === 'guitar' ? ' is-playing' : ''}" data-place-hot="guitar" data-song-id="guitar" role="button" tabindex="0" aria-pressed="${srpMagicNow === 'guitar'}" aria-label="${srEsc(t('room_guitar_aria'))}">
                <g class="srp-guitar-spk">${typeof srSparkleField === 'function' ? srSparkleField(58, 530, 52, 90, 14, 1.9, 8) : ''}</g>
                <rect class="srp-hit" x="6" y="424" width="104" height="218" fill="transparent"/>
            </g>
            <g class="srp-hot srp-diary" data-place-hot="diary" role="button" tabindex="0" aria-label="${srEsc(t('room_diary_title'))}">
                ${typeof srSparkleField === 'function' ? srSparkleField(340, 556, 46, 30, 10, 1.7, 5) : ''}
                <rect class="srp-hit" x="298" y="542" width="86" height="52" fill="transparent"/>
            </g>
            <g class="srp-notes" aria-hidden="true">
                <g class="srp-note-amb"><path d="M240 262 v-18 l12 -3 v18" fill="none" stroke="#ffd27a" stroke-width="2"/><circle cx="237" cy="263" r="3.4" fill="#ffd27a"/><circle cx="249" cy="260" r="3.4" fill="#ffd27a"/></g>
            </g>
        </svg>`;
}
function srpInitMusic(box) {
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
    // מה מתנגן מסומן (הילה + aria-pressed), וכל עוד משהו מתנגן - תווים עולים ממנו מדי פעם
    let notesTimer = null;
    const mark = () => {
        box.querySelectorAll('[data-song-id]').forEach(el => { const on = el.dataset.songId === srpMagicNow; el.classList.toggle('is-playing', on); el.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        clearInterval(notesTimer);
        if (!srpMagicNow || srpReduce()) return;
        const from = () => { const r = SRP_MUSIC_RECS.find(x => x.id === srpMagicNow); return r ? [r.x - 6, r.y - r.r] : [52, 440]; };
        notesTimer = setInterval(() => { if (!box.isConnected) { clearInterval(notesTimer); return; } const [x, y] = from(); floatNotes(x, y, 2); }, 2600);
    };
    srpCleanups.push(() => clearInterval(notesTimer));
    const onSongEnd = () => { if (box.isConnected) mark(); };
    window.addEventListener('srp-song-end', onSongEnd);
    srpCleanups.push(() => window.removeEventListener('srp-song-end', onSongEnd));
    const play = (id, el) => {
        const on = srpMagicToggle(id);
        if (id === 'guitar' && on) { el.classList.remove('is-strum'); void el.getBoundingClientRect(); el.classList.add('is-strum'); }
        mark();
        if (on) { const r = SRP_MUSIC_RECS.find(x => x.id === id); floatNotes(r ? r.x - 6 : 52, r ? r.y - r.r : 440, 3); }
    };
    mark();
    return {
        guitar: el => play('guitar', el),
        rec1: el => play('rec1', el),
        rec2: el => play('rec2', el),
        rec3: el => play('rec3', el),
        diary: () => srpOpenDiary(),
    };
}

// התקליטים: נגיעה בפטיפון שבחדר פותחת אותם - הלהיטים (נפתחים ביוטיוב בלשונית חדשה) ומתחת חמשת הלחנים השקטים
// (מתנגנים כאן מיד, ו"לעצור" עוצר)
function srpOpenRecords(el, floatNotes) {
    const playing = el.classList.contains('is-playing') ? Number(el.dataset.song) : -1;
    const ov = nmOpenSheet(`
        <h4>${srEsc(roomItemName('vinyl'))}</h4>
        <p class="srp-records-group">${srEsc(t('room_vinyl_yt'))}</p>
        <div class="srp-hits">${SRP_HITS.map(h => `
            <a class="srp-hit-btn" href="https://www.youtube.com/watch?v=${h.yt}" target="_blank" rel="noopener" style="--rec:${h.color}" aria-label="${srEsc(`${h.song} – ${h.artist} · YouTube`)}">
                <span class="srp-record-disc" aria-hidden="true"></span>
                <span class="srp-hit-name"><b><bdi>${srEsc(h.song)}</bdi></b><small><bdi>${srEsc(h.artist)}</bdi></small></span>
                <span class="srp-hit-yt" aria-hidden="true">▶</span>
            </a>`).join('')}</div>
        <p class="srp-records-group">${srEsc(t('room_vinyl_here'))}</p>
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
    srpNowPlaying = on ? i : -1;
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
        ${typeof nmDiaryMenuRowHtml === 'function' ? nmDiaryMenuRowHtml() : ''}
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
// המקל בחול (עם חדר הנשימה; במקום הזריחה - לפי בקשה מפורשת: "למחוק את הזריחה בחוף ולעשות משהו אחר במקום"): מקל על החול -
// כותבים בו מה רוצים לשחרר, וגל גדול בא ומוחק. לא נשמר בשום מקום
function srpBreathScene(keys) {
    const sand = keys >= roomUnlockAt('sand');
    // הציור (world/lake-sunset.jpg): אגם בשקיעה. מאז 2026-10-16 מקום שקט בלבד (לפי בקשה מפורשת): בלי השמש שעולה ויורדת
    // ובלי "להתחיל"; הגל הקטן על קו המים, והמקל הקסום שעל החול (בלי נצנוץ) הוא המקל לכתיבה
    return `
        <svg class="srp-scene srp-painted" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('breath'))}">
            <g aria-hidden="true">
                ${srpArt('lake-sunset.jpg')}
                <g class="srb-wave">
                    <path d="M-20 648 Q4 640 26 648 T74 648 T122 648 T170 648 T218 648 T266 648 T314 648 T362 648 T410 648 V655 Q386 662 362 655 T314 655 T266 655 T218 655 T170 655 T122 655 T74 655 T26 655 T-20 655 Z" fill="#fff" opacity="0.55"/>
                </g>
            </g>
            ${sand ? `<g class="srb-writing" role="button" tabindex="0" aria-label="${srEsc(t('room_sand_erase_aria'))}"><text class="srb-word-light" x="195" y="733" text-anchor="middle"></text><text class="srb-word" x="195" y="732" text-anchor="middle"></text></g>
            ${roomWishSvg()}
            <g class="srb-bigwave" aria-hidden="true">
                <path d="M-20 620 H410 V712 Q385 724 360 712 T310 712 T260 712 T210 712 T160 712 T110 712 T60 712 T10 712 T-20 712 Z" fill="#b9c4ee" opacity="0.6"/>
                <path d="M-20 712 Q5 724 30 712 T80 712 T130 712 T180 712 T230 712 T280 712 T330 712 T380 712 T430 712" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" opacity="0.9"/>
            </g>
            <g class="srp-hot srb-stick" data-place-hot="sand" role="button" tabindex="0" aria-label="${srEsc(roomItemName('sand'))}">
                <rect class="srp-hit" x="206" y="676" width="184" height="98" fill="transparent"/>
            </g>` : ''}
        </svg>`;
}
function srpInitBreath(box) {
    srpInitSandErase(box);
    roomInitWish(box);
    return { sand: () => srpWriteInSand(box) };
}

// כותבים בחול: המילים מופיעות אות אחרי אות, ואחרי רגע גל גדול עולה על החול ומוחק אותן (לא נשמר בשום מקום)
// מחיקה ביד: משפשפים על הכתוב באצבע והוא הולך ונמחק (או Enter / רווח במקלדת)
function srpInitSandErase(box) {
    const g = box.querySelector('.srb-writing');
    if (!g) return;
    const words = [...box.querySelectorAll('.srb-word, .srb-word-light')];
    const saved = srpPrefs().sand;
    if (saved) { words.forEach(w => { w.textContent = saved; }); box.classList.add('is-writing'); fitSand(); }
    function fitSand() {
        const len = words[0] && words[0].getComputedTextLength ? words[0].getComputedTextLength() : 0;
        if (len > 300) words.forEach(w => w.setAttribute('font-size', String(Math.max(14, Math.floor(32 * 300 / len)))));
    }
    let rub = 0, last = null;
    const erase = () => {
        box.classList.add('is-erasing');
        srpSetPref('sand', '');
        setTimeout(() => { words.forEach(w => { w.textContent = ''; w.removeAttribute('font-size'); }); g.style.opacity = ''; box.classList.remove('is-writing', 'is-erasing'); }, srpReduce() ? 0 : 500);
    };
    g.addEventListener('pointerdown', e => { if (!box.classList.contains('is-writing')) return; last = [e.clientX, e.clientY]; try { g.setPointerCapture(e.pointerId); } catch {} });
    g.addEventListener('pointermove', e => {
        if (!last || !box.classList.contains('is-writing')) return;
        rub += Math.hypot(e.clientX - last[0], e.clientY - last[1]);
        last = [e.clientX, e.clientY];
        const left = Math.max(0, 1 - rub / 280);
        g.style.opacity = String(left);
        if (left === 0) { last = null; rub = 0; erase(); }
    });
    ['pointerup', 'pointercancel'].forEach(ev => g.addEventListener(ev, () => { last = null; }));
    g.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && box.classList.contains('is-writing')) { e.preventDefault(); erase(); } });
}
function srpWriteInSand(box) {
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
        // נשאר בחול עד שמוחקים ביד (לפי בקשה מפורשת, 2026-10-11) - נשמר רק במכשיר הזה
        srpSetPref('sand', text);
        const g = box.querySelector('.srb-writing');
        if (g) g.style.opacity = '';
    };
    ov.querySelector('[data-write]').addEventListener('click', write);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); write(); } });
    setTimeout(() => input.focus({ preventScroll: true }), 120);
}

// ---------- דלת 5: השביל ביער ----------
// לפי בקשה מפורשת: "שילחצו על התאורה היא נכבית ויש יום בחוץ" - הפנסים מחליפים בין לילה ליום. מאז 2026-10-14 שני ציורים
// (world/forest-night.jpg / forest-day.jpg) - מוזזים קצת שמאלה (x -64) כדי שהשלט שליד הספסל ייכנס למסך.
// לכל פנס: אור (x, y, r) והמקום שנוגעים בו (hit), בקואורדינטות של הסצנה
const SRP_LANTERNS = [
    { x: 66, y: 578, r: 58, hit: [36, 520, 56, 174] },
    { x: 129, y: 471, r: 30, hit: [112, 446, 30, 72] },
    { x: 218, y: 494, r: 34, hit: [202, 466, 32, 96] },
];
function srpOutsideScene(keys) {
    const swing = keys >= roomUnlockAt('swing');
    const yoga = keys >= roomUnlockAt('yoga');
    const sign = keys >= roomUnlockAt('selfcare');
    const L = SRP_LANTERNS;
    const art = n => `<image class="srp-art" href="${SRP_ART}${n}" x="-64" y="0" width="471.1" height="844" preserveAspectRatio="none"/>`;
    return `
        <svg class="srp-scene srp-painted" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('outside'))}">
            <defs>
                <radialGradient id="srpOLight" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffcf8a" stop-opacity="0.5"/><stop offset="1" stop-color="#ffcf8a" stop-opacity="0"/></radialGradient>
            </defs>
            <g aria-hidden="true">
                <g class="srp-night-only">${art('forest-night.jpg')}</g>
                <g class="srp-day-only">${art('forest-day.jpg')}</g>
            </g>
            ${swing ? `<g class="srp-hot srp-swing-hot" data-place-hot="swing" role="button" tabindex="0" aria-label="${srEsc(roomItemName('swing'))}">
                <!-- תלויה על הענף הגדול שבציור (לפי בקשה מפורשת: "אל תמחוק את הענף יש נדנדה בדרך"), ומתנדנדת קדימה ואחורה -->
                <!-- נדנדה קסומה (2026-10-16): חבלי גפן עם עלים ופרחים זוהרים, מושב עם זר פרחים ונצנצים - בלי צל -->
                <defs>
                    <linearGradient id="srpSwVine" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fcf8f"/><stop offset="1" stop-color="#b6f0c0"/></linearGradient>
                    <linearGradient id="srpSwSeat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9d2ff"/><stop offset="0.5" stop-color="#b48ae6"/><stop offset="1" stop-color="#7c56b8"/></linearGradient>
                    <radialGradient id="srpSwFlower"><stop offset="0" stop-color="#fffbe6"/><stop offset="0.45" stop-color="#ffd27a"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
                </defs>
                <g class="srp-swing-ropes">
                    <path d="M62 283 C59 320 65 360 62 414 M92 280 C95 318 89 362 92 414" fill="none" stroke="url(#srpSwVine)" stroke-width="2" stroke-linecap="round"/>
                    <g fill="#8fdc9c">
                        <ellipse cx="58" cy="304" rx="4.2" ry="1.8" transform="rotate(-30 58 304)"/><ellipse cx="66" cy="332" rx="4.2" ry="1.8" transform="rotate(30 66 332)"/><ellipse cx="58" cy="362" rx="4.2" ry="1.8" transform="rotate(-30 58 362)"/><ellipse cx="66" cy="392" rx="4.2" ry="1.8" transform="rotate(30 66 392)"/>
                        <ellipse cx="96" cy="300" rx="4.2" ry="1.8" transform="rotate(30 96 300)"/><ellipse cx="88" cy="330" rx="4.2" ry="1.8" transform="rotate(-30 88 330)"/><ellipse cx="96" cy="360" rx="4.2" ry="1.8" transform="rotate(30 96 360)"/><ellipse cx="88" cy="390" rx="4.2" ry="1.8" transform="rotate(-30 88 390)"/>
                    </g>
                    <g class="srp-swing-glow"><circle cx="62" cy="318" r="4" fill="url(#srpSwFlower)"/><circle cx="92" cy="346" r="4" fill="url(#srpSwFlower)"/><circle cx="62" cy="376" r="4" fill="url(#srpSwFlower)"/><circle cx="92" cy="404" r="3.6" fill="url(#srpSwFlower)"/></g>
                </g>
                <g class="srp-swing-seat">
                    <rect x="49" y="410" width="56" height="10" rx="5" fill="url(#srpSwSeat)" stroke="#f3e6ff" stroke-opacity="0.6" stroke-width="0.8"/>
                    <g>${[56, 66, 77, 88, 98].map((x, i) => `<g transform="translate(${x} 415)"><circle r="2.6" fill="${['#ff9ecf', '#ffd27a', '#c9b6ff', '#ffd27a', '#ff9ecf'][i]}"/><circle r="1" fill="#fffbe6"/></g>`).join('')}</g>
                </g>
                ${typeof srSparkleField === 'function' ? srSparkleField(77, 372, 34, 58, 12, 1.5, 6) : ''}
                <rect class="srp-hit" x="40" y="276" width="74" height="176" fill="transparent"/>
            </g>` : ''}
            ${yoga ? `<g class="srp-hot srp-yoga" data-place-hot="yoga" role="button" tabindex="0" aria-label="${srEsc(roomItemName('yoga'))}">
                <!-- השער בסוף השביל - מאחוריו קרחת היוגה ליד המפל -->
                <ellipse class="srp-flicker" cx="172" cy="440" rx="44" ry="40" fill="url(#srpOLight)"/>
                <rect class="srp-hit" x="126" y="378" width="92" height="110" fill="transparent"/>
            </g>` : ''}
            <g class="srp-hot srp-lights" data-place-hot="lights" role="button" tabindex="0" aria-label="${srEsc(t('room_lights_aria'))}" aria-pressed="true">
                <g class="srp-night-only srp-flicker">${L.map(l => `<circle cx="${l.x}" cy="${l.y}" r="${l.r}" fill="url(#srpOLight)"/>`).join('')}</g>
                ${L.map(l => `<rect class="srp-hit" x="${l.hit[0]}" y="${l.hit[1]}" width="${l.hit[2]}" height="${l.hit[3]}" fill="transparent"/>`).join('')}
            </g>
            ${sign ? `<g class="srp-hot srp-sign" data-place-hot="selfcare" role="button" tabindex="0" aria-label="${srEsc(t('room_selfcare_title'))}">
                <g class="srp-sign-writing">
                    <path class="srp-sign-heart" d="M358 563 q2.5 -3.7 5 0 q2.5 -3.7 5 0 q0 3.7 -5 6.7 q-5 -3 -5 -6.7z" fill="#ff9ecf"/>
                    <text class="sr-magic-script srp-sign-word" x="363" y="583" text-anchor="middle" font-size="7" fill="#ffe7a8">${srEsc(t('room_sign_text'))}</text>
                </g>
                <rect class="srp-hit" x="336" y="544" width="56" height="106" fill="transparent"/>
            </g>` : ''}
            <g class="srp-hot srp-bench" data-place-hot="bench" role="button" tabindex="0" aria-label="${srEsc(t('room_bench_aria'))}">
                <rect class="srp-hit" x="234" y="518" width="102" height="108" fill="transparent"/>
            </g>
            <g class="srp-night-only" fill="#ffe48e" aria-hidden="true"><circle class="srp-fly" cx="40" cy="520" r="2"/><circle class="srp-fly" cx="300" cy="610" r="2.2" style="animation-delay:1s"/><circle class="srp-fly" cx="250" cy="360" r="1.6" style="animation-delay:2s"/></g>
        </svg>`;
}
function srpInitOutside(box, keys, opts = {}) {
    const prefs = srpPrefs();
    const lights = box.querySelector('.srp-lights');
    const setDay = (day, save) => {
        box.classList.toggle('is-day', day);
        if (lights) lights.setAttribute('aria-pressed', day ? 'false' : 'true');
        if (save) {
            const v = box.querySelector('.srp-view');
            v.classList.remove('srp-switch'); void v.offsetWidth; v.classList.add('srp-switch');
        }
    };
    // בכל כניסה - לילה (לפי בקשה מפורשת, 2026-10-16: "שזה יהיה כברירת מחדל"); הפנסים מחליפים ליום, בלי לזכור
    setDay(false, false);
    // הכיתוב על השלט נכנס לרוחב הלוח בכל שפה
    const word = box.querySelector('.srp-sign-word');
    if (word && typeof word.getComputedTextLength === 'function') { try { const len = word.getComputedTextLength(); if (len > 34) word.setAttribute('font-size', (7 * 34 / len).toFixed(2)); } catch {} }
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
        <div class="srp-signview-sky" aria-hidden="true">${Array.from({ length: 34 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--y:${(i * 53) % 92}%;--d:${(i % 7) * 0.45}s;--s:${0.6 + (i % 4) * 0.35}"></i>`).join('')}</div>
        <button type="button" class="sr-sub-back srp-signview-back">${SR_CHEVRON.prev}${srEsc(t('nm_back'))}</button>
        <div class="srp-signview-board" role="group" aria-label="${srEsc(t('room_selfcare_title'))}">
            <div class="srp-signview-plank">${srEsc(t('room_selfcare_title'))}</div>
            <div class="srp-signview-posters">${[1, 2, 3, 4, 5, 6].map(i => `
                <button type="button" class="srp-poster${st.on.includes(i) ? ' on' : ''}" data-care="${i}" aria-pressed="${st.on.includes(i)}" style="--paper:${SRP_CARE_PAPER[i - 1]};--tilt:${SRP_CARE_TILT[i - 1]}deg">
                    <span class="srp-poster-pin" aria-hidden="true">✦</span>
                    <span class="srp-poster-icon" aria-hidden="true">${SRP_CARE_ICONS[i - 1]}</span>
                    <span class="srp-poster-text">${srEsc(t('room_selfcare_' + i))}</span>
                    <span class="srp-poster-stamp" aria-hidden="true">✓</span>
                </button>`).join('')}</div>
        </div>
`;
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
// 🪷 פנס הלוטוס על האגם של חדר הנשימה (הבחירה שלה מעמוד האפשרויות, 2026-10-16). (0,0) = קו המים מתחת לפרח
function roomWishSvg() {
    return `<g class="sr-wish srp-lotus" role="button" tabindex="0" aria-label="${srEsc(roomItemName('wish'))}" transform="translate(206 590)">
        <defs>
            <radialGradient id="srpLotusGlow"><stop offset="0" stop-color="#ffd6ec" stop-opacity="0.7"/><stop offset="1" stop-color="#ffd6ec" stop-opacity="0"/></radialGradient>
            <linearGradient id="srpLotusPet" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff0f8"/><stop offset="0.6" stop-color="#ffb3d6"/><stop offset="1" stop-color="#e87bb5"/></linearGradient>
            <linearGradient id="srpLotusPet2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe3f1"/><stop offset="1" stop-color="#f497c6"/></linearGradient>
            <radialGradient id="srpLotusCore"><stop offset="0" stop-color="#fffbe6"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
        </defs>
        <g class="srp-lotus-ripples" aria-hidden="true"><ellipse cx="0" cy="1" rx="22" ry="4.5" fill="none" stroke="#f3eaff" stroke-width="1.2"/><ellipse cx="0" cy="1" rx="22" ry="4.5" fill="none" stroke="#f3eaff" stroke-width="1"/></g>
        <g class="sr-wish-inner">
            <circle cx="0" cy="-14" r="30" fill="url(#srpLotusGlow)"/>
            <g transform="scale(0.5) translate(-60 -112)">
                <ellipse cx="60" cy="112" rx="40" ry="9" fill="#7cc7a0" opacity="0.85"/>
                <ellipse cx="60" cy="110" rx="36" ry="6" fill="#a7f3d0" opacity="0.55"/>
                <path d="M60 112 C36 108 24 92 28 72 C42 80 52 92 60 112 Z" fill="url(#srpLotusPet2)"/>
                <path d="M60 112 C84 108 96 92 92 72 C78 80 68 92 60 112 Z" fill="url(#srpLotusPet2)"/>
                <path d="M60 112 C44 100 38 78 46 56 C56 70 60 90 60 112 Z" fill="url(#srpLotusPet)"/>
                <path d="M60 112 C76 100 82 78 74 56 C64 70 60 90 60 112 Z" fill="url(#srpLotusPet)"/>
                <path d="M60 110 C52 92 52 66 60 46 C68 66 68 92 60 110 Z" fill="url(#srpLotusPet)"/>
                <circle cx="60" cy="96" r="18" fill="url(#srpLotusCore)"/>
            </g>
        </g>
        <ellipse class="sr-wish-hit" cx="0" cy="-16" rx="30" ry="26" fill="transparent"/>
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
            // הלוטוס שוקע לאט באגם עם המשאלה, ואחרי רגע לוטוס חדש עולה מהמים במקומו
            setTimeout(() => { if (!w.isConnected) return; w.classList.remove('is-flying'); w.classList.add('is-back'); }, srpReduce() ? 600 : 5200);
        };
        ov.querySelector('[data-fly]').addEventListener('click', fly);
        input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fly(); } });
        setTimeout(() => input.focus({ preventScroll: true }), 120);
    };
    w.addEventListener('click', open);
    w.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
}

// ---------- שלב 6: יוגה ביער - קרחת ליד המפל, המדריכה ואנשים טובים במעגל ----------
// לפי בחירה מפורשת (2026-10-10): המקום = ה (ליד המפל); השיחה = א (מעגל שיתוף), "גזע שנפתח כמו במחשב" לפי מה
// שעונים, עם כל המסלולים; "המעגל יראה עם האנשים אבל הנראות תהיה כמו במחשב" (זכוכית רכה, ערכה 10)
// הפנים של המורה בכותרת השיחה - מהציור שלה בעיניים פתוחות
function ygAvatar() { return `<img src="${SRP_ART}teacher-open.png" alt="">`; }
// יצורי היער - כל אחד עם השם שלו (לפי בקשה מפורשת, 2026-10-14: לומי, פופי, ניקסי וספארקלט; המורה - פלאורה). הם לא יושבים
// על המזרונים אלא מרחפים מעליהם (YG_FLOAT מעל המזרון, ותנועת ריחוף - ygFloat ב-theme.css), עם צל רך על המזרון.
// המזרונים בציור בחצי עיגול מול פלאורה, כך שהם מתרגלים איתה. mat = הנקודה על המזרון
const YG_FLOAT = 16;
const YG_SITTERS = [
    { img: 'yg-blob.png', name: 'yg_name_p1', cx: 40, mat: 616, h: 62, ratio: 328 / 300 },
    { img: 'yg-spirit.png', name: 'yg_name_p3', cx: 351, mat: 616, h: 64, ratio: 311 / 300 },
    { img: 'yg-fluffy.png', name: 'yg_name_p2', cx: 127, mat: 640, h: 70, ratio: 396 / 300 },
    { img: 'yg-baby.png', name: 'yg_name_p4', cx: 256, mat: 640, h: 72, ratio: 404 / 300 },
];
function ygSitter(img, nameKey, cx, bottom, h, ratio) {
    const name = srEsc(t(nameKey));
    return srpSprite(img, cx, bottom, h, ratio, 'yg-sitter').replace('/>', ` role="img" aria-label="${name}"><title>${name}</title></image>`);
}
// היוגה (לפי בקשה מפורשת, 2026-10-14): יצורי היער על המזרונים בעיניים עצומות, והמורה על המזרון הבודד שעל הסלע -
// עיניים עצומות כמו כולם. נגיעה בה: העיניים נפתחות, מתקרבים אליה, ושם מתחילה השיחה (ygTeacherWake)
const YG_TEACHER = { cx: 199, bottom: 552, h: 126 };
function srpYogaScene(keys) {
    const falls = keys >= roomUnlockAt('waterfall');
    const T = YG_TEACHER;
    return `
        <svg class="srp-scene srp-painted" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('yoga'))}">
            <g aria-hidden="true">${srpArt('yoga.jpg')}</g>
            <g class="srp-hot srp-falls${falls ? '' : ' locked'}" data-place-hot="waterfall" role="button" tabindex="0" aria-label="${srEsc(roomItemName('waterfall'))}">
                ${falls ? '' : srpVeil(158, 128, 78, 336) + srLockBadge(197, 290, 'waterfall')}
                <rect class="srp-hit" x="150" y="120" width="94" height="350" fill="transparent"/>
            </g>
            <g class="yg-mat-shadows" aria-hidden="true">${YG_SITTERS.map(s => `<ellipse class="yg-float-shadow" cx="${s.cx}" cy="${s.mat - 3}" rx="${Math.round(s.h * 0.34)}" ry="5"/>`).join('')}</g>
            <g class="yg-circle">${YG_SITTERS.map(s => ygSitter(s.img, s.name, s.cx, s.mat - YG_FLOAT, s.h, s.ratio)).join('')}</g>
            <g class="srp-hot srp-guide" data-place-hot="guide" role="button" tabindex="0" aria-label="${srEsc(t('room_yoga_guide_aria'))}">
                <title>${srEsc(t('yg_name_guide'))}</title>
                ${srpSprite('teacher-closed.png', T.cx, T.bottom, T.h, 359 / 400, 'yg-teacher yg-eyes-closed')}
                ${srpSprite('teacher-open.png', T.cx, T.bottom, T.h, 357 / 400, 'yg-teacher yg-eyes-open')}
                <rect class="srp-hit" x="${T.cx - 46}" y="${T.bottom - T.h + 8}" width="92" height="${T.h}" fill="transparent"/>
            </g>
        </svg>`;
}
// נגיעה במורה: העיניים נפתחות, המצלמה מתקרבת לפנים שלה (הפנים בערך ברבע העליון של המסך, מעל חלון השיחה), ואז השיחה
function ygTeacherWake(box) {
    if (box.querySelector('.yg-talk')) return;
    const view = box.querySelector('.srp-view');
    const face = box.querySelector('.yg-eyes-closed');
    if (!view || !face) { ygOpenTalk(box); return; }
    const vr = view.getBoundingClientRect(), fr = face.getBoundingClientRect();
    const s = 2.3;
    const px = fr.left + fr.width / 2 - vr.left, py = fr.top + fr.height * 0.3 - vr.top;
    const tx = vr.width / 2 - s * px, ty = vr.height * 0.25 - s * py;
    box.classList.add('yg-awake');
    view.style.transformOrigin = '0 0';
    view.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s})`;
    box.classList.add('yg-zoomed');
    const t0 = setTimeout(() => { if (box.isConnected && box.classList.contains('yg-zoomed')) ygOpenTalk(box); }, srpReduce() ? 0 : 950);
    srpCleanups.push(() => clearTimeout(t0));
}
// סוף השיחה: מתרחקים בחזרה, והמורה עוצמת שוב את העיניים
function ygTeacherRest(box) {
    const view = box.querySelector('.srp-view');
    box.classList.remove('yg-zoomed', 'yg-awake');
    if (view) view.style.transform = '';
}
// השיחה: עץ קטן כמו במחשב - כל צומת: מה נאמר (המדריכה / נועה / איתי), ואז בחירה, משימה קטנה, תנוחה עם נשימות או סוף
const YG_TREE = {
    start: { say: [['g', 'yg_g_start'], ['p1', 'yg_p1_start'], ['p2', 'yg_p2_start'], ['p3', 'yg_p3_start'], ['p4', 'yg_p4_start']], opts: [['good', 'yg_o_good'], ['hard', 'yg_o_hard'], ['alone', 'yg_o_alone']] },
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
const YG_WHO = { g: 'yg_name_guide', p1: 'yg_name_p1', p2: 'yg_name_p2', p3: 'yg_name_p3', p4: 'yg_name_p4' };
// מי שמדבר - ציור קטן שלו ליד השורה (לפי בקשה מפורשת, 2026-10-14)
const YG_PIC = { g: 'teacher-open.png', p1: 'yg-blob.png', p2: 'yg-fluffy.png', p3: 'yg-spirit.png', p4: 'yg-baby.png' };
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
    const close = () => { ygStopTimers(); ygState = null; panel.remove(); box.classList.remove('is-talking'); ygTeacherRest(box); };
    panel.querySelector('.yg-x').addEventListener('click', close);
    panel.querySelector('[data-yg="new"]').addEventListener('click', () => { if (!ygState) return; ygState.path = [{ id: 'start', pick: null }]; ygRender(true); });
    panel.querySelector('[data-yg="back"]').addEventListener('click', () => { if (!ygState || ygState.path.length < 2) return; ygState.path.pop(); ygState.path[ygState.path.length - 1].pick = null; ygRender(false); });
    srpCleanups.push(close);
    ygRender(true);
}
function ygBubble(lines, who, text, extra) {
    const el = document.createElement('div');
    el.className = `yg-line is-${who}${extra ? ' ' + extra : ''}`;
    if (YG_WHO[who]) el.innerHTML = `<span class="yg-name">${srEsc(t(YG_WHO[who]))}</span>`;
    el.appendChild(document.createTextNode(text));
    if (!YG_PIC[who]) { lines.appendChild(el); return el; }
    const row = document.createElement('div');
    row.className = `yg-row is-${who}${extra ? ' ' + extra : ''}`;
    row.innerHTML = `<span class="yg-mini is-${who}" aria-hidden="true"><img src="${SRP_ART}${YG_PIC[who]}" alt=""></span>`;
    row.appendChild(el);
    lines.appendChild(row);
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
        guide: () => ygTeacherWake(box),
        waterfall: el => {
            if (el.classList.contains('locked')) { srShowLockTip('waterfall'); return; }
            roomOpenPlace('waterfall', { fromHall: !!opts.fromHall, parent: 'yoga' });
        },
    };
}

// ---------- שלב 7: המפל - קרחת יער עם מפל (ה' של דלת 5, לפי בחירה מפורשת), מגיעים אליו דרך היוגה ----------
// יושבים על הסלע: הכפתורים נעלמים, הקשת מתחזקת ונשמע קול של מים (נוצר במקום, בלי קבצים); נגיעה במים - אדוות
function srpWaterfallScene() {
    // הציור (world/waterfall.jpg); מעליו: קווי מים זורמים שקופים, ערפל, הקשת שמתחזקת כשיושבים, והבריכה (מראה)
    return `
        <svg class="srp-scene srp-painted" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" role="group" aria-label="${srEsc(roomItemName('waterfall'))}">
            <defs>
                <linearGradient id="wfRain" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff9ad0"/><stop offset="0.5" stop-color="#ffe08a"/><stop offset="1" stop-color="#9ad6ff"/></linearGradient>
                <linearGradient id="wfStone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a99cc0"/><stop offset="1" stop-color="#5c5274"/></linearGradient>
                <filter id="wfMistBlur" x="-30%" y="-80%" width="160%" height="260%"><feGaussianBlur stdDeviation="7"/></filter>
            </defs>
            <g aria-hidden="true">
                ${srpArt('waterfall.jpg')}
                <g class="srp-fall-lines" stroke="#ffffff" stroke-width="2.2" stroke-dasharray="16 9" stroke-linecap="round" opacity="0.32"><line x1="180" y1="142" x2="180" y2="272"/><line x1="194" y1="146" x2="194" y2="270"/><line x1="208" y1="142" x2="208" y2="272"/><line x1="160" y1="284" x2="160" y2="444"/><line x1="174" y1="290" x2="174" y2="446"/><line x1="214" y1="290" x2="214" y2="446"/><line x1="228" y1="284" x2="228" y2="444"/></g>
                <path class="srp-rainbow" d="M128 462 A70 62 0 0 1 262 462" fill="none" stroke="url(#wfRain)" stroke-width="5" stroke-linecap="round"/>
                <g class="srp-mist" fill="#ffffff" filter="url(#wfMistBlur)"><ellipse cx="160" cy="452" rx="70" ry="16" opacity="0.32"/><ellipse cx="236" cy="448" rx="74" ry="15" opacity="0.28"/><ellipse cx="198" cy="438" rx="52" ry="12" opacity="0.26"/></g>
            </g>
            <g class="srp-hot srp-pool" data-place-hot="pool" role="button" tabindex="0" aria-label="${srEsc(t('room_waterfall_pool_aria'))}">
                <ellipse class="srp-hit" cx="195" cy="612" rx="236" ry="150" fill="transparent"/>
                <g class="srp-ripples-wf" fill="none" stroke="#ffffff" stroke-width="2"><ellipse cx="195" cy="586" rx="70" ry="16"/><ellipse cx="195" cy="592" rx="94" ry="21" style="animation-delay:1.2s"/><ellipse cx="195" cy="598" rx="118" ry="26" style="animation-delay:2.4s"/></g>
                <g class="srp-splash"></g>
                <text class="srp-pool-q" x="195" y="626" text-anchor="middle" font-size="17" font-weight="800" fill="#f2fdff" data-fit="320">${srEsc(t('room_pool_q'))}</text>
            </g>
            <g class="srp-hot srp-rock" data-place-hot="rock" role="button" tabindex="0" aria-label="${srEsc(t('room_waterfall_rock_aria'))}">
                <ellipse cx="300" cy="806" rx="62" ry="12" fill="#1c1430" opacity="0.45"/>
                <path d="M244 800 Q248 780 280 776 Q320 772 350 782 Q362 790 356 800 Q330 810 296 810 Q258 810 244 800 Z" fill="url(#wfStone)"/>
                <path d="M258 788 Q284 780 318 781 Q340 783 348 789" stroke="#d9cdf0" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.6"/>
                <rect class="srp-hit" x="232" y="760" width="140" height="60" fill="transparent"/>
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
function srpOpenMirror(box) {
    const ov = nmOpenSheet(`
        <div class="srp-mirror-q">${srEsc(t('room_pool_q'))}</div>
        <textarea class="srp-mirror-input" rows="2" maxlength="140" placeholder="${srEsc(t('room_pool_ph'))}" aria-label="${srEsc(t('room_pool_q'))}"></textarea>
        <button type="button" class="nm-btn-primary" data-add>${srEsc(t('room_pool_add'))}</button>
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'srp-mirror-sheet');
    const input = ov.querySelector('.srp-mirror-input');
    setTimeout(() => input.focus(), 60);
    ov.querySelector('[data-add]').addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        const ok = await pcAddTodayTask(text);
        if (!ok) return;
        ov.remove();
        box.classList.remove('is-asking');
        showAppToast(t('room_pool_added'));
    });
}
function srpInitWaterfall(box) {
    srpCleanups.push(srpWaterStop);
    box.querySelector('.srp-rest-exit').addEventListener('click', srpWaterStop);
    return {
        rock: () => { srpRest(box); srpWaterStart(); },
        pool: el => {
            // 🪞 בריכת המראה (לפי בחירה מפורשת - רעיון למפל 3): מתכופפים מעל המים ושאלה עולה מהם; נגיעה נוספת
            // בזמן שהיא שם - עונים, והתשובה נכנסת ל"היום שלי" כמשימה קטנה
            if (box.classList.contains('is-asking')) { srpOpenMirror(box); return; }
            box.classList.add('is-asking');
            if (typeof srFitTexts === 'function') srFitTexts(el);
            clearTimeout(box.nmAskTimer);
            box.nmAskTimer = setTimeout(() => box.classList.remove('is-asking'), 9000);
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

// ===================== צנצנת המשאלות + ציטוטים מספרים (בארון הספרים, מהמפתח הראשון) =====================
// לפי בקשה מפורשת (2026-10-12): "רשימת משאלות - איך אני רוצה שהחיים שלי יראו? לדמיין הכי פרוע" - כל משאלה
// היא פתק מקופל בצנצנת זכוכית בארון (room_wishes). פעם בשבוע פופ-אפ עדין עם משאלה אקראית - פעם אחת, במכשיר
// אחד (new_me_room.wish_popup_at); ובפתיחה השנייה של משאלה מסוימת (לא בראשונה) - אפשר להפוך אותה ליעד
// ולפרק לצעדים קטנים (היעד שנוצר מקושר אליה - room_wishes.goal_id). עיצוב הצנצנת: 8 אפשרויות + לוח מעל
// המיטה בקנבס שלה; SR_JAR_DESIGN בוחר אחת, כך שהחלפה = שינוי מספר אחד. הציטוטים (room_quotes): מהארון,
// וגם בקטן מפינת הקריאה - לכולם, לא רק בחדר
// הבחירה שלה (2026-10-12): 1 - מייסון, עם "חלומות" על התווית במקום "משאלות" והגחליליות של 3 בתוכה
const SR_JAR_DESIGN = 1;
const SR_JAR_PAPERS = ['#fff4d6', '#ffd1e3', '#ccf2df', '#e2d6ff', '#ffdcc2', '#d3ecff'];
const SR_WISH_GOAL_AT = 2;
const SR_WISH_POPUP_DAYS = 7;
const SR_JAR_ICON = '<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><rect x="9" y="4" width="14" height="5" rx="1.6" fill="#e2b45c"/><path d="M10 9h12v2c3 1 4 3 4 5v9c0 3-2 5-5 5H11c-3 0-5-2-5-5v-9c0-2 1-4 4-5z" fill="rgba(255,255,255,0.18)" stroke="#fff" stroke-opacity="0.7" stroke-width="1.2"/><rect x="10" y="21" width="5" height="3.4" rx="0.6" fill="#ffd1e3" transform="rotate(-14 12 22)"/><rect x="15.5" y="22" width="5" height="3.4" rx="0.6" fill="#ccf2df" transform="rotate(10 18 23)"/><rect x="12.5" y="18" width="5" height="3.4" rx="0.6" fill="#fff4d6" transform="rotate(4 15 19)"/></svg>';
let roomWishes = null;
let roomQuotes = null;
let roomWishPopupScheduled = false;
let srWishGoalLink = null;

async function roomFetchWishes() {
    if (!supabaseClient || !currentUserId) return roomWishes || [];
    const { data } = await supabaseClient.from('room_wishes').select('*').eq('user_id', currentUserId).order('created_at', { ascending: true });
    roomWishes = data || [];
    return roomWishes;
}

function srWishPaper(w) {
    const list = roomWishes || [];
    const i = Math.max(0, list.findIndex(x => x.id === w.id));
    return SR_JAR_PAPERS[i % SR_JAR_PAPERS.length];
}
function srWishCountText(n) { return n === 1 ? t('room_jar_count_one') : t('room_jar_count_many').replace('{n}', srFmt(n)); }
function srWishDate(iso) {
    try { return t('room_wish_written').replace('{date}', new Intl.DateTimeFormat(currentLang, { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso))); } catch { return ''; }
}

// ---------- ציורי הצנצנות (אותם ציורים כמו בקנבס) ----------
function srjRng(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
function srjNote(x, y, r, color) {
    const w = 26, h = 16;
    return `<g class="srj-note" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${r.toFixed(1)})"><rect x="${-w / 2 + 1}" y="${-h / 2 + 2}" width="${w}" height="${h}" rx="2" fill="#000" opacity="0.16"/><rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="2" fill="${color}"/><rect x="0" y="${-h / 2}" width="${w / 2}" height="${h}" rx="2" fill="#000" opacity="0.07"/><line x1="0" y1="${-h / 2 + 1}" x2="0" y2="${h / 2 - 1}" stroke="#000" stroke-opacity="0.14" stroke-width="0.8"/></g>`;
}
function srjSlot(def, i) {
    const perRow = def.perRow || 5, row = Math.floor(i / perRow), col = i % perRow;
    const span = (def.xr - def.xl) / perRow, r = srjRng(SR_JAR_DESIGN * 31 + i * 7 + 3);
    return { x: def.xl + span * (col + 0.5) + (r() - 0.5) * span * 0.5, y: def.floor - 9 - row * (def.dy || 11) + (r() - 0.5) * 4, rot: (r() - 0.5) * 56, color: SR_JAR_PAPERS[i % SR_JAR_PAPERS.length] };
}
const srjDefs = p => `
    <linearGradient id="${p}g" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.26"/><stop offset="0.16" stop-color="#fff" stop-opacity="0.07"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.025"/><stop offset="0.82" stop-color="#fff" stop-opacity="0.07"/><stop offset="1" stop-color="#fff" stop-opacity="0.24"/></linearGradient>
    <linearGradient id="${p}hl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <linearGradient id="${p}gold" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#fbe6a8"/><stop offset="0.35" stop-color="#d9a648"/><stop offset="0.6" stop-color="#f3d27d"/><stop offset="1" stop-color="#9c6d22"/></linearGradient>
    <linearGradient id="${p}silver" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f4f6fb"/><stop offset="0.45" stop-color="#a9b0c0"/><stop offset="0.7" stop-color="#e3e7f0"/><stop offset="1" stop-color="#6f7686"/></linearGradient>
    <radialGradient id="${p}warm" cx="0.5" cy="0.55" r="0.55"><stop offset="0" stop-color="#ffd27a" stop-opacity="0.55"/><stop offset="1" stop-color="#ffd27a" stop-opacity="0"/></radialGradient>
    <linearGradient id="${p}plank" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#a26d48"/><stop offset="1" stop-color="#6e4329"/></linearGradient>`;
const srjPlank = p => `<rect x="0" y="292" width="240" height="38" fill="url(#${p}plank)"/><rect x="0" y="292" width="240" height="2" fill="#c08a5f" opacity="0.6"/>`;
const srjShadow = (cx, rx) => `<ellipse cx="${cx}" cy="293" rx="${rx}" ry="7" fill="#000" opacity="0.38"/>`;
const srjGlass = (p, d, extra = '') => `<path d="${d}" fill="url(#${p}g)"/><path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.5" stroke-width="1.6"/>${extra}`;
const srjTwinkle = (x, y, r = 1.9) => `<g class="srj-twinkle"><circle cx="${x}" cy="${y}" r="${r * 2.7}" fill="#ffd27a" opacity="0.28"/><circle cx="${x}" cy="${y}" r="${r}" fill="#ffe7a8"/></g>`;
const SR_JARS = {
    1: { floor: 284, xl: 56, xr: 184, draw(p, notes) {
        const d = 'M68 84 L172 84 L172 96 C188 101 192 112 192 126 L192 262 C192 278 182 288 166 288 L74 288 C58 288 48 278 48 262 L48 126 C48 112 52 101 68 96 Z';
        return `${srjShadow(120, 76)}
            <clipPath id="${p}in"><path d="M70 98 L170 98 C184 104 188 114 188 128 L188 262 C188 275 179 284 166 284 L74 284 C61 284 52 275 52 262 L52 128 C52 114 56 104 70 98 Z"/></clipPath>
            <g clip-path="url(#${p}in)"><rect x="40" y="90" width="160" height="200" fill="url(#${p}warm)" opacity="0.5"/><g class="srj-notes">${notes}</g>${[[78, 150], [160, 136], [104, 122], [140, 178], [92, 198], [170, 212], [124, 110]].map(([x, y]) => srjTwinkle(x, y)).join('')}</g>
            ${srjGlass(p, d, `<path d="M58 132 C56 170 56 220 60 262" stroke="url(#${p}hl)" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.65"/><path d="M178 140 C181 180 181 230 178 258" stroke="#fff" stroke-opacity="0.18" stroke-width="3" stroke-linecap="round" fill="none"/><g stroke="#fff" stroke-opacity="0.22" stroke-width="1"><path d="M72 88 Q120 92 168 88"/><path d="M72 92 Q120 96 168 92"/></g>`)}
            <rect x="62" y="60" width="116" height="26" rx="5" fill="url(#${p}gold)"/><g stroke="#8a5d1c" stroke-opacity="0.45">${Array.from({ length: 13 }, (_, i) => `<line x1="${68 + i * 8.5}" y1="63" x2="${68 + i * 8.5}" y2="83"/>`).join('')}</g>
            <rect x="66" y="54" width="108" height="9" rx="4" fill="url(#${p}gold)"/><rect x="70" y="55" width="70" height="2.5" rx="1" fill="#fff" opacity="0.5"/>
            <path d="M66 100 C90 108 150 108 174 100" fill="none" stroke="#c8a36e" stroke-width="3"/><path d="M66 104 C90 112 150 112 174 104" fill="none" stroke="#b18b55" stroke-width="2.4"/>
            <path d="M150 106 c8 -10 20 -6 16 2 c-4 6 -12 2 -16 -2 c4 8 6 18 -2 22" fill="none" stroke="#c8a36e" stroke-width="2.4" stroke-linecap="round"/>
            <g transform="rotate(14 172 140)"><path d="M160 128 L196 128 L204 140 L196 152 L160 152 Z" fill="#e9cf9e"/><circle cx="196" cy="140" r="2.6" fill="#7a5a32"/><text x="179" y="144" text-anchor="middle" font-family="Amatic SC, Assistant, sans-serif" font-weight="700" font-size="13" fill="#5a3d1e" data-fit="30">${srEsc(t('room_jar_dreams'))}</text></g>`;
    } },
    2: { floor: 286, xl: 46, xr: 194, perRow: 6, draw(p, notes) {
        const d = 'M86 98 C86 90 92 86 100 86 L140 86 C148 86 154 90 154 98 L154 102 C192 112 204 136 204 164 L204 258 C204 276 192 288 172 288 L68 288 C48 288 36 276 36 258 L36 164 C36 136 48 112 86 102 Z';
        return `${srjShadow(120, 86)}
            <clipPath id="${p}in"><path d="M90 104 C190 112 200 140 200 166 L200 258 C200 274 190 284 172 284 L68 284 C50 284 40 274 40 258 L40 166 C40 140 50 112 90 104 Z"/></clipPath>
            <g clip-path="url(#${p}in)"><rect x="30" y="100" width="180" height="190" fill="url(#${p}warm)" opacity="0.45"/><g class="srj-notes">${notes}</g></g>
            ${srjGlass(p, d, `<path d="M50 160 C46 196 46 236 52 262" stroke="url(#${p}hl)" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.6"/><path d="M70 120 C80 112 96 108 110 107" stroke="#fff" stroke-opacity="0.45" stroke-width="3" stroke-linecap="round" fill="none"/>`)}
            <rect x="98" y="70" width="44" height="18" rx="4" fill="url(#${p}g)" stroke="#fff" stroke-opacity="0.45"/>
            <circle cx="120" cy="50" r="23" fill="url(#${p}g)" stroke="#fff" stroke-opacity="0.55" stroke-width="1.6"/><circle cx="120" cy="50" r="23" fill="url(#${p}warm)" opacity="0.4"/><path d="M106 40 a16 16 0 0 1 12 -9" stroke="#fff" stroke-opacity="0.8" stroke-width="3.5" stroke-linecap="round" fill="none"/><circle cx="131" cy="58" r="2.4" fill="#fff" opacity="0.7"/>
            <g transform="translate(120 152)"><path d="M-44 -18 Q0 -30 44 -18 Q52 0 44 18 Q0 30 -44 18 Q-52 0 -44 -18 Z" fill="#f7ecd6"/><path d="M-40 -14 Q0 -25 40 -14 Q47 0 40 14 Q0 25 -40 14 Q-47 0 -40 -14 Z" fill="none" stroke="url(#${p}gold)" stroke-width="2"/><text x="0" y="7" text-anchor="middle" font-family="Amatic SC, Assistant, sans-serif" font-weight="700" font-size="19" fill="#6b4a1f" data-fit="74">${srEsc(t('room_jar_dreams'))}</text></g>`;
    } },
    3: { floor: 266, xl: 64, xr: 176, dy: 9, draw(p, notes) {
        const d = 'M46 268 L46 150 C46 88 82 52 120 52 C158 52 194 88 194 150 L194 268 Z';
        return `${srjShadow(120, 98)}
            <ellipse cx="120" cy="280" rx="96" ry="13" fill="#5b3a26"/><rect x="24" y="268" width="192" height="12" fill="#6e4730"/><ellipse cx="120" cy="268" rx="96" ry="13" fill="#8f603f"/><ellipse cx="120" cy="268" rx="88" ry="10" fill="none" stroke="#b07a52" stroke-opacity="0.6"/>
            <clipPath id="${p}in"><path d="M50 268 L50 150 C50 92 84 56 120 56 C156 56 190 92 190 150 L190 268 Z"/></clipPath>
            <g clip-path="url(#${p}in)"><ellipse cx="120" cy="250" rx="70" ry="40" fill="url(#${p}warm)" opacity="0.7"/><g class="srj-notes">${notes}</g>${[[78, 150], [160, 132], [104, 118], [140, 176], [92, 196], [170, 210], [124, 86]].map(([x, y]) => srjTwinkle(x, y)).join('')}</g>
            ${srjGlass(p, d, `<path d="M62 150 C62 110 80 84 104 72" stroke="url(#${p}hl)" stroke-width="8" stroke-linecap="round" fill="none" opacity="0.7"/><path d="M180 160 C182 200 182 236 180 262" stroke="#fff" stroke-opacity="0.2" stroke-width="3" stroke-linecap="round" fill="none"/>`)}
            <ellipse cx="120" cy="268" rx="74" ry="7" fill="none" stroke="#fff" stroke-opacity="0.3"/><circle cx="120" cy="44" r="10" fill="url(#${p}g)" stroke="#fff" stroke-opacity="0.6" stroke-width="1.4"/><circle cx="116" cy="40" r="3" fill="#fff" opacity="0.7"/>`;
    } },
    4: { floor: 270, xl: 52, xr: 188, perRow: 6, draw(p, notes) {
        const d = 'M102 70 L138 70 L138 98 C182 108 212 142 212 184 C212 236 172 276 120 276 C68 276 28 236 28 184 C28 142 58 108 102 98 Z';
        const bulbs = [[52, 170], [76, 186], [102, 194], [128, 194], [154, 186], [180, 170], [64, 140], [92, 150], [120, 154], [148, 150], [176, 140]];
        return `${srjShadow(120, 70)}
            <rect x="96" y="276" width="48" height="16" rx="5" fill="url(#${p}g)" stroke="#fff" stroke-opacity="0.35"/>
            <clipPath id="${p}in"><path d="M104 74 L136 74 L136 102 C178 112 208 144 208 184 C208 232 170 272 120 272 C70 272 32 232 32 184 C32 144 62 112 104 102 Z"/></clipPath>
            <g clip-path="url(#${p}in)"><circle cx="120" cy="190" r="90" fill="url(#${p}warm)" opacity="0.55"/><g class="srj-notes">${notes}</g><path d="M40 160 Q120 216 200 160" fill="none" stroke="#6b5a3a" stroke-width="1.2"/><path d="M50 132 Q120 176 190 132" fill="none" stroke="#6b5a3a" stroke-width="1.2"/>${bulbs.map(([x, y]) => srjTwinkle(x, y, 2.3)).join('')}</g>
            ${srjGlass(p, d, `<path d="M46 172 C46 146 62 124 86 112" stroke="url(#${p}hl)" stroke-width="9" stroke-linecap="round" fill="none" opacity="0.7"/><ellipse cx="160" cy="232" rx="16" ry="6" transform="rotate(-38 160 232)" fill="#fff" opacity="0.12"/>`)}
            <rect x="98" y="62" width="44" height="10" rx="4" fill="url(#${p}g)" stroke="#fff" stroke-opacity="0.5"/><path d="M104 36 L136 36 L134 64 L106 64 Z" fill="#b98a5a"/><g fill="#8a6038" opacity="0.7"><circle cx="112" cy="44" r="1.4"/><circle cx="126" cy="50" r="1.2"/><circle cx="118" cy="58" r="1.5"/><circle cx="130" cy="41" r="1"/></g><rect x="104" y="36" width="32" height="5" rx="2" fill="#d4a674"/>
            <path d="M104 68 C96 74 92 86 98 94" fill="none" stroke="#e7d3a6" stroke-width="2"/><path d="M136 68 C146 72 150 84 142 92" fill="none" stroke="#e7d3a6" stroke-width="2"/>`;
    } },
    5: { floor: 284, xl: 52, xr: 188, draw(p, notes) {
        const d = 'M62 100 L178 100 L196 122 L196 266 L178 288 L62 288 L44 266 L44 122 Z';
        return `${srjShadow(120, 80)}
            <clipPath id="${p}in"><path d="M64 104 L176 104 L192 124 L192 264 L176 284 L64 284 L48 264 L48 124 Z"/></clipPath>
            <g clip-path="url(#${p}in)"><rect x="40" y="100" width="160" height="190" fill="url(#${p}warm)" opacity="0.45"/><g class="srj-notes">${notes}</g><rect x="44" y="100" width="40" height="190" fill="#fff" opacity="0.05"/><rect x="156" y="100" width="40" height="190" fill="#000" opacity="0.12"/></g>
            ${srjGlass(p, d, `<g stroke="url(#${p}gold)" stroke-width="1.6" fill="none" opacity="0.9"><line x1="84" y1="100" x2="84" y2="288"/><line x1="156" y1="100" x2="156" y2="288"/></g><path d="${d}" fill="none" stroke="url(#${p}gold)" stroke-width="2"/><path d="M60 130 L60 256" stroke="url(#${p}hl)" stroke-width="6" stroke-linecap="round" opacity="0.6"/>`)}
            <rect x="58" y="86" width="124" height="14" rx="2" fill="url(#${p}gold)"/><rect x="72" y="74" width="96" height="13" rx="2" fill="url(#${p}gold)"/><rect x="88" y="64" width="64" height="11" rx="2" fill="url(#${p}gold)"/><g fill="none" stroke="#8a5d1c" stroke-opacity="0.5"><path d="M58 93 H182"/><path d="M72 80 H168"/></g>
            <path d="M120 40 L132 54 L120 66 L108 54 Z" fill="#b48cff"/><path d="M120 40 L132 54 L120 54 Z" fill="#d9c4ff"/><path d="M108 54 L120 66 L120 54 Z" fill="#7d5bd1"/>`;
    } },
    6: { floor: 284, xl: 56, xr: 184, draw(p, notes) {
        const d = 'M68 84 L172 84 L172 96 C188 101 192 112 192 126 L192 262 C192 278 182 288 166 288 L74 288 C58 288 48 278 48 262 L48 126 C48 112 52 101 68 96 Z';
        return `${srjShadow(120, 76)}
            <linearGradient id="${p}aqua" x1="0" x2="1"><stop offset="0" stop-color="#8fe3dc" stop-opacity="0.42"/><stop offset="0.5" stop-color="#8fe3dc" stop-opacity="0.16"/><stop offset="1" stop-color="#8fe3dc" stop-opacity="0.4"/></linearGradient>
            <clipPath id="${p}in"><path d="M70 98 L170 98 C184 104 188 114 188 128 L188 262 C188 275 179 284 166 284 L74 284 C61 284 52 275 52 262 L52 128 C52 114 56 104 70 98 Z"/></clipPath>
            <g clip-path="url(#${p}in)"><g class="srj-notes">${notes}</g><rect x="40" y="90" width="160" height="200" fill="#5fc9c1" opacity="0.18"/></g>
            <path d="${d}" fill="url(#${p}aqua)"/><path d="${d}" fill="none" stroke="#c9fffa" stroke-opacity="0.6" stroke-width="1.6"/><path d="M58 132 C56 170 56 220 60 262" stroke="#eafffd" stroke-opacity="0.55" stroke-width="7" stroke-linecap="round" fill="none"/>
            <text x="120" y="176" text-anchor="middle" font-family="Amatic SC, Assistant, sans-serif" font-weight="700" font-size="34" fill="#eafffd" fill-opacity="0.35" stroke="#7fd4cc" stroke-opacity="0.5" stroke-width="0.8" data-fit="120">${srEsc(t('room_jar_dreams'))}</text><path d="M84 190 Q120 200 156 190" fill="none" stroke="#eafffd" stroke-opacity="0.3" stroke-width="1.5"/>
            <rect x="62" y="60" width="116" height="26" rx="4" fill="url(#${p}silver)"/><g stroke="#5d6372" stroke-opacity="0.5">${Array.from({ length: 6 }, (_, i) => `<line x1="62" y1="${64 + i * 4}" x2="178" y2="${64 + i * 4}"/>`).join('')}</g><rect x="66" y="54" width="108" height="9" rx="4" fill="url(#${p}silver)"/><circle cx="120" cy="58" r="3" fill="#5d6372" opacity="0.6"/>`;
    } },
    7: { floor: 284, xl: 56, xr: 184, draw(p, notes) {
        const d = 'M74 82 L166 82 L166 94 C184 100 190 114 190 132 L190 262 C190 278 180 288 164 288 L76 288 C60 288 50 278 50 262 L50 132 C50 114 56 100 74 94 Z';
        const stars = [[78, 140], [104, 124], [128, 150], [160, 132], [150, 176], [96, 182], [120, 210], [170, 228], [74, 236]];
        return `${srjShadow(120, 76)}
            <filter id="${p}frost" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.6"/></filter>
            <radialGradient id="${p}moon" cx="0.5" cy="0.6" r="0.6"><stop offset="0" stop-color="#cfe0ff" stop-opacity="0.5"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient>
            <clipPath id="${p}in"><path d="M76 96 L164 96 C180 102 186 116 186 134 L186 262 C186 275 177 284 164 284 L76 284 C63 284 54 275 54 262 L54 134 C54 116 60 102 76 96 Z"/></clipPath>
            <g clip-path="url(#${p}in)"><rect x="40" y="90" width="160" height="200" fill="url(#${p}moon)"/><g class="srj-notes" filter="url(#${p}frost)">${notes}</g><rect x="40" y="90" width="160" height="200" fill="#e9eefb" opacity="0.2"/></g>
            <path d="${d}" fill="none" stroke="#fff" stroke-opacity="0.55" stroke-width="1.6"/>
            <g stroke="#fff" stroke-opacity="0.55" stroke-width="0.9" fill="none"><polyline points="${stars.slice(0, 5).map(s => s.join(',')).join(' ')}"/><polyline points="${stars.slice(4).map(s => s.join(',')).join(' ')}"/></g>
            ${stars.map(([x, y], i) => `<path d="M${x} ${y - 4.5} L${x + 1.3} ${y - 1.3} L${x + 4.5} ${y} L${x + 1.3} ${y + 1.3} L${x} ${y + 4.5} L${x - 1.3} ${y + 1.3} L${x - 4.5} ${y} L${x - 1.3} ${y - 1.3} Z" fill="#fff" opacity="${i % 2 ? 0.75 : 0.95}"/>`).join('')}
            <path d="M60 136 C58 176 58 222 62 262" stroke="#fff" stroke-opacity="0.45" stroke-width="6" stroke-linecap="round" fill="none"/>
            <rect x="68" y="58" width="104" height="26" rx="5" fill="url(#${p}silver)"/><rect x="72" y="52" width="96" height="9" rx="4" fill="url(#${p}silver)"/><rect x="76" y="54" width="54" height="2.4" rx="1" fill="#fff" opacity="0.7"/>`;
    } },
    8: { floor: 284, xl: 56, xr: 184, perRow: 4, draw(p, notes) {
        const d = 'M66 96 L174 96 L174 104 C190 110 194 122 194 136 L194 262 C194 278 184 288 168 288 L72 288 C56 288 46 278 46 262 L46 136 C46 122 50 110 66 104 Z';
        return `${srjShadow(120, 78)}
            <radialGradient id="${p}candle" cx="0.5" cy="0.62" r="0.5"><stop offset="0" stop-color="#ffcf70" stop-opacity="0.85"/><stop offset="0.45" stop-color="#ff9f43" stop-opacity="0.28"/><stop offset="1" stop-color="#ff9f43" stop-opacity="0"/></radialGradient>
            <clipPath id="${p}in"><path d="M68 106 L172 106 C186 112 190 124 190 138 L190 262 C190 275 181 284 168 284 L72 284 C59 284 50 275 50 262 L50 138 C50 124 54 112 68 106 Z"/></clipPath>
            <g clip-path="url(#${p}in)"><rect x="40" y="100" width="160" height="190" fill="url(#${p}candle)"/><g class="srj-notes">${notes}</g><rect x="108" y="228" width="24" height="18" rx="3" fill="#f3efe6"/><rect x="104" y="244" width="32" height="6" rx="2" fill="#c9c3b6"/><line x1="120" y1="228" x2="120" y2="222" stroke="#333" stroke-width="1.2"/><path class="srj-flame" d="M120 202 C126 210 127 218 120 224 C113 218 114 210 120 202 Z" fill="#ffd36b"/><path d="M120 210 C123 214 123 219 120 222 C117 219 117 214 120 210 Z" fill="#fff6d6"/></g>
            ${srjGlass(p, d, `<path d="M56 140 C54 178 54 224 58 262" stroke="url(#${p}hl)" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.6"/>`)}
            <path d="M64 96 C64 72 90 62 120 62 C150 62 176 72 176 96 Z" fill="url(#${p}g)" stroke="#fff" stroke-opacity="0.5" stroke-width="1.4"/><path d="M80 82 C88 72 102 68 116 67" stroke="#fff" stroke-opacity="0.6" stroke-width="3" stroke-linecap="round" fill="none"/><rect x="62" y="94" width="116" height="6" rx="3" fill="#f08a2c"/>
            <g fill="none" stroke="url(#${p}silver)" stroke-width="3" stroke-linecap="round"><path d="M70 98 C60 90 62 74 76 70"/><path d="M170 98 C180 90 178 74 164 70"/><path d="M76 70 C96 52 144 52 164 70"/></g><path d="M182 124 C200 128 204 150 192 160" fill="none" stroke="url(#${p}silver)" stroke-width="3" stroke-linecap="round"/>`;
    } },
    // 9: במקום צנצנת - לוח פשתן מעל המיטה; כל משאלה פתק מוצמד שרואים בו את תחילת הטקסט
    9: { board: true, draw(p, notes) {
        return `<rect x="18" y="58" width="204" height="196" rx="8" fill="#6e4730"/><rect x="26" y="66" width="188" height="180" rx="4" fill="#d9c8ab"/>
            <g opacity="0.25" stroke="#a48d68">${Array.from({ length: 18 }, (_, i) => `<line x1="26" y1="${70 + i * 10}" x2="214" y2="${70 + i * 10}"/>`).join('')}</g>
            <path d="M16 46 Q66 70 120 52 T224 48" fill="none" stroke="#3a2a1c" stroke-width="1.5"/>${[[30, 52], [58, 60], [86, 59], [114, 54], [142, 53], [170, 52], [198, 50]].map(([x, y]) => srjTwinkle(x, y + 4, 2.6)).join('')}
            <g class="srj-notes">${notes}</g>
            <rect x="0" y="266" width="240" height="64" fill="#3d2a52"/><rect x="0" y="262" width="240" height="10" rx="4" fill="#5b3a26"/><path d="M20 266 Q60 250 110 262 L110 300 L20 300 Z" fill="#f3e6f7" opacity="0.92"/><path d="M118 264 Q170 252 224 262 L224 300 L118 300 Z" fill="#ffd1e3" opacity="0.9"/>`;
    } },
};

function srjBoardNotes(wishes) {
    const spots = [[30, 76, -4], [116, 70, 3], [72, 128, 2], [154, 124, -5], [28, 182, 4], [118, 186, -2]];
    return wishes.slice(-spots.length).map((w, i) => {
        const [x, y, r] = spots[i];
        return `<g class="srj-note" transform="translate(${x} ${y}) rotate(${r})"><rect x="2" y="3" width="70" height="44" rx="2" fill="#000" opacity="0.15"/><rect x="0" y="0" width="70" height="44" rx="2" fill="${srWishPaper(w)}"/><circle cx="35" cy="6" r="3.4" fill="#e0457b"/><circle cx="34" cy="5" r="1.1" fill="#fff" opacity="0.7"/><text x="35" y="28" text-anchor="middle" font-size="9" fill="#4a3618" data-fit="62">${srEsc(srClip(w.text, 16))}</text></g>`;
    }).join('');
}

function srJarSvg(wishes) {
    const def = SR_JARS[SR_JAR_DESIGN] || SR_JARS[1];
    const p = 'srj' + SR_JAR_DESIGN;
    const notes = def.board ? srjBoardNotes(wishes) : wishes.slice(0, 40).map((w, i) => { const s = srjSlot(def, i); return srjNote(s.x, s.y, s.rot, s.color); }).join('');
    return `<svg class="sr-jar-svg" viewBox="0 0 240 330" role="button" tabindex="0" aria-label="${srEsc(t('room_jar_pull'))}"><defs>${srjDefs(p)}</defs>${def.board ? '' : srjPlank(p)}${def.draw(p, notes)}</svg>`;
}
// אותה צנצנת, יושבת על המדף (ר' srShelfSceneSvg): בלי הקרש שלה, מוקטנת כך שהתחתית שלה על הקרש של המדף.
// cx = מרכז הצנצנת, baseY = גובה הקרש, h = גובה הצנצנת (מהמכסה עד התחתית)
function srJarShelfSvg(wishes, cx, baseY, h) {
    const def = SR_JARS[SR_JAR_DESIGN] || SR_JARS[1];
    if (def.board) return '';
    const p = 'srjs';
    const notes = (wishes || []).slice(0, 40).map((w, i) => { const s = srjSlot(def, i); return srjNote(s.x, s.y, s.rot, s.color); }).join('');
    const s = h / 238;
    return `<g transform="translate(${(cx - 120 * s).toFixed(1)} ${(baseY - 292 * s).toFixed(1)}) scale(${s.toFixed(3)})"><defs>${srjDefs(p)}</defs>${def.draw(p, notes)}</g>`;
}

// ---------- הצנצנת (מסך בתוך החדר) ----------
// fromShelf: נפתחה מהמדף - "חזרה" מחזירה למדף (שנשאר מתחת), לא לקיר של החדר
async function roomOpenJar(opts = {}) {
    const stage = srStage();
    if (!stage) return;
    stage.querySelector('.sr-jar')?.remove();
    const box = document.createElement('div');
    box.className = 'sr-jar';
    if (opts.fromShelf) box.dataset.from = 'shelf';
    stage.appendChild(box);
    srRenderJar(box);
    await roomFetchWishes();
    if (box.isConnected) srRenderJar(box);
}

function srRenderJar(box) {
    const wishes = roomWishes || [];
    box.innerHTML = `
        <div class="sr-sub-head"><button type="button" class="sr-sub-back">${SR_CHEVRON.prev}${srEsc(t(box.dataset.from === 'shelf' ? 'room_back_to_shelf' : 'room_back_to_room'))}</button><b>${srEsc(roomItemName('jar'))}</b><span>${wishes.length ? srEsc(srWishCountText(wishes.length)) : ''}</span></div>
        <div class="sr-jar-niche">${srJarSvg(wishes)}</div>
        ${wishes.length ? '' : `<p class="sr-jar-empty">${srEsc(t('room_jar_empty'))}</p>`}
        <div class="sr-jar-actions">
            <button type="button" class="sr-jar-add">${srEsc(t('room_jar_add'))}</button>
            ${wishes.length ? `<button type="button" class="sr-jar-pull">${srEsc(t('room_jar_pull'))}</button>` : ''}
        </div>
        ${wishes.length ? `<div class="sr-jar-notes">${wishes.slice().reverse().map(w => `<button type="button" class="sr-jar-note" data-wish="${w.id}" style="--paper:${srWishPaper(w)}"><span>${srEsc(srClip(w.text, 40))}</span>${w.goal_id ? '<i aria-hidden="true">🎯</i>' : ''}</button>`).join('')}</div>` : ''}`;
    if (typeof srFitTexts === 'function') srFitTexts(box);
    box.querySelector('.sr-sub-back').addEventListener('click', () => {
        box.remove();
        if (box.dataset.from === 'shelf' && typeof srRefreshShelfView === 'function') srRefreshShelfView();
        else if (srIsOpen() && typeof srRenderWall === 'function') srRenderWall();
    });
    box.querySelector('.sr-jar-add').addEventListener('click', () => srNewWish(box));
    const pull = () => srPullWish(box);
    box.querySelector('.sr-jar-pull')?.addEventListener('click', pull);
    const svg = box.querySelector('.sr-jar-svg');
    svg.addEventListener('click', () => { if ((roomWishes || []).length) pull(); else srNewWish(box); });
    svg.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); svg.dispatchEvent(new MouseEvent('click')); } });
    box.querySelectorAll('[data-wish]').forEach(b => b.addEventListener('click', () => srOpenWish(b.dataset.wish, box)));
}

// שליפה: פתק אקראי עולה מהצנצנת ונפתח (לא אותו פתק פעמיים ברצף כשיש יותר מאחד)
let srLastPulledWish = null;
function srPullWish(box) {
    const list = roomWishes || [];
    if (!list.length) return;
    const pool = list.length > 1 ? list.filter(w => w.id !== srLastPulledWish) : list;
    const w = pool[Math.floor(Math.random() * pool.length)];
    srLastPulledWish = w.id;
    const notes = box.querySelectorAll('.srj-notes .srj-note');
    const note = notes[Math.min(notes.length - 1, list.indexOf(w))] || notes[notes.length - 1];
    if (!note || srpReduce() || typeof note.animate !== 'function') { srOpenWish(w.id, box); return; }
    const tr = note.getAttribute('transform') || '';
    const m = tr.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
    const x = m ? Number(m[1]) : 120, y = m ? Number(m[2]) : 260;
    // נפתח בסוף התנועה - ובכל מקרה אחרי רגע, גם אם הדפדפן לא מריץ אנימציות (רקע, חיסכון בסוללה)
    let opened = false;
    const open = () => { if (opened) return; opened = true; srOpenWish(w.id, box); };
    const anim = note.animate([{ transform: `translate(${x}px, ${y}px)`, opacity: 1 }, { transform: `translate(${x}px, ${y - 170}px) scale(1.4)`, opacity: 0.15 }], { duration: 480, easing: 'ease-in' });
    anim.onfinish = open;
    setTimeout(open, 650);
}

// כתיבת משאלה חדשה - ואחר כך הפתק מתקפל ונופל לצנצנת
function srNewWish(box) {
    const ov = nmOpenSheet(`
        <h4>${srEsc(t('room_wish_new_title'))}</h4>
        <textarea class="sr-wish-input" rows="5" maxlength="600" placeholder="${srEsc(t('room_wish_new_ph'))}" aria-label="${srEsc(t('room_wish_new_title'))}"></textarea>
        <button type="button" class="nm-btn-primary" data-save>${srEsc(t('room_wish_fold_btn'))}</button>
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('cancel_btn'))}</button>`, 'sr-wish-new-sheet');
    const input = ov.querySelector('.sr-wish-input');
    setTimeout(() => input.focus({ preventScroll: true }), 120);
    let saving = false;
    ov.querySelector('[data-save]').addEventListener('click', async () => {
        const text = input.value.trim();
        if (!text || saving) { if (!text) input.focus(); return; }
        saving = true;
        if (!supabaseClient || !currentUserId) { saving = false; return; }
        const { data, error } = await supabaseClient.from('room_wishes').insert({ user_id: currentUserId, text }).select().single();
        if (error || !data) { saving = false; showAppToast(t('error_adding_item') + (error ? error.message : ''), 'error'); return; }
        ov.remove();
        roomWishes = [...(roomWishes || []), data];
        if (!box || !box.isConnected) return;
        srRenderJar(box);
        // הפתק החדש נופל לצנצנת
        const notes = box.querySelectorAll('.srj-notes .srj-note');
        const note = notes[notes.length - 1];
        if (!note || srpReduce() || typeof note.animate !== 'function' || (SR_JARS[SR_JAR_DESIGN] || {}).board) return;
        const s = srjSlot(SR_JARS[SR_JAR_DESIGN] || SR_JARS[1], roomWishes.length - 1);
        note.animate([{ transform: `translate(${s.x}px, ${s.y - 210}px) rotate(${s.rot - 90}deg)` }, { transform: `translate(${s.x}px, ${s.y + 4}px) rotate(${s.rot}deg)`, offset: 0.82 }, { transform: `translate(${s.x}px, ${s.y}px) rotate(${s.rot}deg)` }], { duration: 820, easing: 'cubic-bezier(.35,.0,.6,1)' });
    });
}

// פתיחת משאלה: הפתק נפתח. כל פתיחה נספרת; מהפתיחה השנייה (לא בראשונה) - "להפוך ליעד, בצעדים קטנים"
function srOpenWish(id, box) {
    const w = (roomWishes || []).find(x => x.id === id);
    if (!w) return;
    w.open_count = (Number(w.open_count) || 0) + 1;
    w.last_opened_at = new Date().toISOString();
    if (supabaseClient && currentUserId) supabaseClient.from('room_wishes').update({ open_count: w.open_count, last_opened_at: w.last_opened_at }).eq('id', w.id).eq('user_id', currentUserId).then(() => {}, () => {});
    const canGoal = !w.goal_id && w.open_count >= SR_WISH_GOAL_AT;
    const ov = nmOpenSheet(`
        <div class="sr-wish-paper" style="--paper:${srWishPaper(w)}"><small>${srEsc(srWishDate(w.created_at))}</small><p class="sr-wish-paper-text">${srEsc(w.text)}</p></div>
        ${w.goal_id ? `<button type="button" class="nm-btn-primary sr-wish-goal" data-goal-open>${srEsc(t('room_wish_in_goals'))}</button>` : ''}
        ${canGoal ? `<button type="button" class="nm-btn-primary sr-wish-goal" data-goal>${srEsc(t('room_wish_to_goal'))}</button>` : ''}
        <div class="sr-wish-tools"><button type="button" class="nm-btn-ghost" data-edit>${srEsc(t('edit_btn'))}</button><button type="button" class="nm-btn-ghost sr-wish-del" data-del>${srEsc(t('room_wish_delete'))}</button></div>
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('room_wish_back_in'))}</button>`, 'sr-wish-open-sheet');
    ov.querySelector('[data-goal]')?.addEventListener('click', () => {
        ov.remove();
        srWishGoalLink = { wishId: w.id, at: Date.now() };
        if (srIsOpen()) closeSecretRoom();
        openVisionGoalModal(null, { title: String(w.text).slice(0, 120), category: null, track: 'steps', milestoneTitles: [] }, { fromWish: true });
    });
    ov.querySelector('[data-goal-open]')?.addEventListener('click', () => {
        ov.remove();
        if (srIsOpen()) closeSecretRoom();
        if (typeof openGoalsVisionDrawer === 'function') openGoalsVisionDrawer(w.goal_id);
    });
    ov.querySelector('[data-edit]').addEventListener('click', () => {
        const sheet = ov.querySelector('.nm-sheet');
        sheet.innerHTML = `<span class="nm-sheet-grip" aria-hidden="true"></span>
            <h4>${srEsc(t('edit_btn'))}</h4>
            <textarea class="sr-wish-input" rows="5" maxlength="600" aria-label="${srEsc(t('room_wish_new_title'))}">${srEsc(w.text)}</textarea>
            <button type="button" class="nm-btn-primary" data-save>${srEsc(t('save_generic'))}</button>
            <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('cancel_btn'))}</button>`;
        const input = sheet.querySelector('.sr-wish-input');
        setTimeout(() => input.focus({ preventScroll: true }), 80);
        sheet.querySelector('[data-save]').addEventListener('click', async () => {
            const text = input.value.trim();
            if (!text) { input.focus(); return; }
            const { error } = await supabaseClient.from('room_wishes').update({ text }).eq('id', w.id).eq('user_id', currentUserId);
            if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
            w.text = text;
            ov.remove();
            if (box && box.isConnected) srRenderJar(box);
        });
    });
    ov.querySelector('[data-del]').addEventListener('click', () => {
        ov.remove();
        showDangerConfirm(t('room_wish_delete_title'), t('room_wish_delete_confirm'), async () => {
            await supabaseClient.from('room_wishes').delete().eq('id', w.id).eq('user_id', currentUserId);
            roomWishes = (roomWishes || []).filter(x => x.id !== w.id);
            if (box && box.isConnected) srRenderJar(box);
        });
    });
}

// היעד שנפתח מ"להפוך ליעד" נשמר - מקשרים אותו למשאלה ומראים אותו ב"היעדים שלי" (נקרא מ-saveVisionGoal)
async function roomLinkWishToGoal(goal) {
    const link = srWishGoalLink;
    srWishGoalLink = null;
    if (!link || !goal || !goal.id || Date.now() - link.at > 3600000) return;
    if (supabaseClient && currentUserId) await supabaseClient.from('room_wishes').update({ goal_id: goal.id }).eq('id', link.wishId).eq('user_id', currentUserId);
    const w = (roomWishes || []).find(x => x.id === link.wishId);
    if (w) w.goal_id = goal.id;
    if (typeof openGoalsVisionDrawer === 'function' && !document.getElementById('vision-drawer-overlay')?.classList.contains('open')) openGoalsVisionDrawer(goal.id);
}

// ---------- פעם בשבוע: משאלה אקראית מהצנצנת, בעדינות (פעם אחת, במכשיר אחד) ----------
function roomWishPopupSoon() {
    if (roomWishPopupScheduled) return;
    roomWishPopupScheduled = true;
    let tries = 0;
    const attempt = async () => {
        tries++;
        // רק במסך הבית, כשאין שום חלון פתוח (גם לא הסיור באפליקציה)
        const busy = document.visibilityState === 'hidden' || (typeof appTourActive !== 'undefined' && appTourActive) || document.querySelector('.apple-modal.open, .nm-sheet-overlay, #sr-overlay, .tab-content.active-tab, .app-tour-layer');
        if (busy) { if (tries < 12) setTimeout(attempt, 20000); return; }
        await roomWishPopupCheck();
    };
    setTimeout(attempt, 5000);
}

async function roomWishPopupCheck(force) {
    if (!supabaseClient || !currentUserId) return false;
    if (typeof hasNewMe !== 'undefined' && !hasNewMe && !roomIsDev()) return false;
    if (!roomLoaded) await roomLoad();
    const last = roomState && roomState.wish_popup_at ? new Date(roomState.wish_popup_at).getTime() : 0;
    if (!force && Date.now() - last < SR_WISH_POPUP_DAYS * 864e5) return false;
    const wishes = await roomFetchWishes();
    const ripe = force ? wishes : wishes.filter(w => Date.now() - new Date(w.created_at).getTime() > 864e5);
    if (!ripe.length) return false;
    const lastId = roomState ? roomState.wish_popup_last_id : null;
    const pool = ripe.length > 1 ? ripe.filter(w => w.id !== lastId) : ripe;
    const w = pool[Math.floor(Math.random() * pool.length)];
    await roomSave({ wish_popup_at: new Date().toISOString(), wish_popup_last_id: w.id });
    const ov = nmOpenSheet(`
        <div class="sr-wish-pop">
            <span class="sr-wish-pop-glow" aria-hidden="true"></span>
            <small>${srEsc(t('room_wish_pop_title'))}</small>
            <div class="sr-wish-paper" style="--paper:${srWishPaper(w)}"><p class="sr-wish-paper-text">${srEsc(w.text)}</p></div>
        </div>
        <button type="button" class="nm-btn-primary" data-jar>${srEsc(t('room_wish_pop_jar'))}</button>
        <button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`, 'sr-wish-pop-sheet');
    ov.querySelector('[data-jar]').addEventListener('click', () => {
        ov.remove();
        openSecretRoom({ wall: 3 });
        setTimeout(() => { if (srIsOpen()) roomOpenJar(); }, 450);
    });
    return true;
}

// ---------- ציטוטים מספרים שאהבתי (מהארון, וגם בקטן מפינת הקריאה) ----------
async function roomFetchQuotes() {
    if (!supabaseClient || !currentUserId) return roomQuotes || [];
    const { data } = await supabaseClient.from('room_quotes').select('*').eq('user_id', currentUserId).order('created_at', { ascending: false });
    roomQuotes = data || [];
    return roomQuotes;
}

// מהמדף בחדר (fromShelf): מסך מלא על רקע המדף, והציטוטים עומדים כמו כרטיסים ממוסגרים על מדפים (לפי בקשה מפורשת,
// 2026-10-12: "וגם הציטוטים וכל מה שבתוכו - לעשות את זה כמו מדף"). מפינת הקריאה (בלי החדר) - אותו תוכן, בחלונית
async function roomOpenQuotes(opts = {}) {
    const stage = opts.fromShelf && typeof srStage === 'function' ? srStage() : null;
    let ov;
    if (stage) {
        stage.querySelector('.sr-quotesview')?.remove();
        ov = document.createElement('div');
        ov.className = 'sr-quotesview';
        ov.dataset.mode = 'shelf';
        ov.innerHTML = `<div class="sr-sub-head"><button type="button" class="sr-sub-back">${SR_CHEVRON.prev}${srEsc(t('room_back_to_shelf'))}</button><b>${srEsc(t('room_shelf_quotes'))}</b><span></span></div><div class="sr-quotes-wrap"></div>`;
        stage.appendChild(ov);
        ov.querySelector('.sr-sub-back').addEventListener('click', () => {
            ov.remove();
            if (typeof booksQuotesCount !== 'undefined' && Array.isArray(roomQuotes)) booksQuotesCount = roomQuotes.length;
            if (typeof srRefreshShelfView === 'function') srRefreshShelfView();
        });
    } else {
        // בסגירה - הצ'יפ בפינת הקריאה מתעדכן במספר הציטוטים
        ov = nmOpenSheet('<div class="sr-quotes-wrap"></div>', 'sr-quotes-sheet', () => {
            if (typeof booksQuotesCount !== 'undefined' && Array.isArray(roomQuotes)) booksQuotesCount = roomQuotes.length;
            if (typeof renderBooksStats === 'function' && typeof isBooksSectionOpen === 'function' && isBooksSectionOpen()) renderBooksStats();
        });
    }
    const wrap = ov.querySelector('.sr-quotes-wrap');
    srRenderQuotes(wrap, ov);
    await roomFetchQuotes();
    if (wrap.isConnected) srRenderQuotes(wrap, ov);
}

function srRenderQuotes(wrap, ov) {
    const list = roomQuotes || [];
    const inShelf = ov.dataset.mode === 'shelf';
    // 🎨 הנראות: סימניות (ברירת המחדל) / תמונות עם סלוטייפ / קיר של כרטיסים (getQuotesLook ב-app.js)
    const look = document.documentElement.getAttribute('data-quote-look') || (typeof getQuotesLook === 'function' ? getQuotesLook() : 'bookmarks');
    const looks = typeof QUOTE_LOOKS !== 'undefined' ? QUOTE_LOOKS : [];
    wrap.innerHTML = `
        <div class="sr-quotes-head">${inShelf ? '<span></span>' : `<h4>${srEsc(t('room_quotes_title'))}</h4>`}${looks.length && list.length ? `<button type="button" class="sr-quote-look-btn" aria-expanded="false" aria-label="${srEsc(t('quotes_look_title'))}" title="${srEsc(t('quotes_look_title'))}">🎨</button>` : ''}</div>
        ${looks.length && list.length ? `<div class="sr-quote-looks hidden" role="group" aria-label="${srEsc(t('quotes_look_title'))}">${looks.map(k => `<button type="button" class="sr-quote-look${k === look ? ' selected' : ''}" data-qlook="${k}" aria-pressed="${k === look}">${srEsc(t('quotes_look_' + k))}</button>`).join('')}</div>` : ''}
        <div class="sr-quotes">${list.length ? list.map(q => `
            <figure class="sr-quote">
                <blockquote>${srEsc(q.quote)}</blockquote>
                ${q.book_title || q.author ? `<figcaption>${srEsc([q.book_title, q.author].filter(Boolean).join(' · '))}</figcaption>` : ''}
                <div class="sr-quote-tools"><button type="button" data-qedit="${q.id}" aria-label="${srEsc(t('edit_btn'))}" title="${srEsc(t('edit_btn'))}">✏️</button><button type="button" data-qdel="${q.id}" aria-label="${srEsc(t('room_quote_delete'))}" title="${srEsc(t('room_quote_delete'))}">🗑️</button></div>
            </figure>`).join('') : `<p class="sr-quotes-empty">${srEsc(t('room_quotes_empty'))}</p>`}</div>
        <button type="button" class="nm-btn-primary" data-qadd>${srEsc(t('room_quotes_add'))}</button>
        ${inShelf ? '' : `<button type="button" class="nm-btn-ghost" data-close>${srEsc(t('close_btn'))}</button>`}`;
    const lookBtn = wrap.querySelector('.sr-quote-look-btn');
    if (lookBtn) lookBtn.addEventListener('click', () => {
        const row = wrap.querySelector('.sr-quote-looks');
        const open = row.classList.toggle('hidden') === false;
        lookBtn.setAttribute('aria-expanded', String(open));
    });
    wrap.querySelectorAll('[data-qlook]').forEach(b => b.addEventListener('click', () => {
        setQuotesLook(b.dataset.qlook);
        if (wrap.isConnected) srRenderQuotes(wrap, ov);
    }));
    wrap.querySelector('[data-qadd]').addEventListener('click', () => srQuoteForm(wrap, ov, null));
    wrap.querySelectorAll('[data-qedit]').forEach(b => b.addEventListener('click', () => srQuoteForm(wrap, ov, list.find(q => q.id === b.dataset.qedit))));
    wrap.querySelectorAll('[data-qdel]').forEach(b => b.addEventListener('click', () => {
        const q = list.find(x => x.id === b.dataset.qdel);
        if (!q) return;
        if (!inShelf) ov.remove();
        showDangerConfirm(t('room_quote_delete_title'), t('room_quote_delete_confirm'), async () => {
            await supabaseClient.from('room_quotes').delete().eq('id', q.id).eq('user_id', currentUserId);
            roomQuotes = (roomQuotes || []).filter(x => x.id !== q.id);
            if (inShelf) { if (wrap.isConnected) srRenderQuotes(wrap, ov); } else roomOpenQuotes();
        });
    }));
}

// הוספה/עריכה: הציטוט, מאיזה ספר (הספרים מפינת הקריאה כצ'יפים + "אחר" להקלדה), ומי כתב (לא חובה)
function srQuoteForm(wrap, ov, q) {
    const books = typeof booksCache !== 'undefined' && Array.isArray(booksCache) ? booksCache.slice(-10).reverse() : [];
    let selBook = q && q.book_id && books.some(b => b.id === q.book_id) ? q.book_id : (q && q.book_title ? 'other' : null);
    wrap.innerHTML = `
        <h4>${srEsc(t(q ? 'room_quote_edit_title' : 'room_quotes_add'))}</h4>
        <textarea class="sr-quote-input" rows="4" maxlength="1500" placeholder="${srEsc(t('room_quote_ph'))}" aria-label="${srEsc(t('room_quote_ph'))}">${q ? srEsc(q.quote) : ''}</textarea>
        <p class="sr-quote-label">${srEsc(t('room_quote_book'))}</p>
        <div class="sr-quote-books">${books.map(b => `<button type="button" class="sr-qbook" data-book="${b.id}" aria-pressed="false">${srEsc(srClip(b.title, 30))}</button>`).join('')}<button type="button" class="sr-qbook" data-book="other" aria-pressed="false">${srEsc(t('select_other_manual'))}</button></div>
        <input type="text" class="sr-quote-title hidden" maxlength="200" placeholder="${srEsc(t('room_quote_book_ph'))}" aria-label="${srEsc(t('room_quote_book_ph'))}" value="${q && selBook === 'other' ? srEsc(q.book_title || '') : ''}">
        <input type="text" class="sr-quote-author" maxlength="120" placeholder="${srEsc(t('room_quote_author_ph'))}" aria-label="${srEsc(t('room_quote_author_ph'))}" value="${q ? srEsc(q.author || '') : ''}">
        <button type="button" class="nm-btn-primary" data-qsave>${srEsc(t('save_generic'))}</button>
        <button type="button" class="nm-btn-ghost" data-qback>${srEsc(t('cancel_btn'))}</button>`;
    const titleIn = wrap.querySelector('.sr-quote-title');
    const authorIn = wrap.querySelector('.sr-quote-author');
    const syncBooks = () => {
        wrap.querySelectorAll('.sr-qbook').forEach(b => { const on = b.dataset.book === selBook; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
        titleIn.classList.toggle('hidden', selBook !== 'other');
    };
    syncBooks();
    wrap.querySelectorAll('.sr-qbook').forEach(b => b.addEventListener('click', () => {
        selBook = selBook === b.dataset.book ? null : b.dataset.book;
        const book = books.find(x => x.id === selBook);
        if (book && book.author && !authorIn.value.trim()) authorIn.value = book.author;
        syncBooks();
        if (selBook === 'other') titleIn.focus();
    }));
    const input = wrap.querySelector('.sr-quote-input');
    setTimeout(() => input.focus({ preventScroll: true }), 80);
    wrap.querySelector('[data-qback]').addEventListener('click', () => srRenderQuotes(wrap, ov));
    let saving = false;
    wrap.querySelector('[data-qsave]').addEventListener('click', async () => {
        const quote = input.value.trim();
        if (!quote) { input.focus(); return; }
        if (saving || !supabaseClient || !currentUserId) return;
        saving = true;
        const book = books.find(x => x.id === selBook);
        const fields = { quote, book_id: book ? book.id : null, book_title: book ? book.title : (selBook === 'other' ? (titleIn.value.trim() || null) : null), author: authorIn.value.trim() || null };
        const res = q
            ? await supabaseClient.from('room_quotes').update(fields).eq('id', q.id).eq('user_id', currentUserId)
            : await supabaseClient.from('room_quotes').insert({ user_id: currentUserId, ...fields });
        saving = false;
        if (res.error) { showAppToast(t('error_adding_item') + res.error.message, 'error'); return; }
        await roomFetchQuotes();
        if (wrap.isConnected) srRenderQuotes(wrap, ov);
    });
}
