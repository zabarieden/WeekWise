// 🧊 העולם בתלת־ממד - הוכן מראש (2026-10-20), לפי התוכנית שלה: הדמויות מ-Meshy כקובצי GLB, ומפת עולם עם עומק בשכבות.
// כשהקבצים מגיעים - שמים אותם בתיקיות, בלי לגעת בקוד:
//   world/3d/me1.glb, me2.glb, me3.glb  - Me בכל שלב. קובץ שחסר = הציור הרגיל נשאר (me1.png…)
//   world/map/back.png, mid.png, front.png (או .jpg) - שכבות המפה. בלי back = המפה הרגילה (השביל עם המקומות)
// הכול נטען רק כשצריך. בלי WebGL, או כשמבקשים "פחות תנועה" - נשארים הציורים. ✓ ומעברים אף פעם לא מחכים לתלת־ממד
// (לפי הכלל שסיכמנו: המשחק הוא הפרס, לא המכשול)

const NMG3D_VIEWER_URL = 'https://cdn.jsdelivr.net/npm/@google/model-viewer@3.4.0/dist/model-viewer.min.js';
const nmg3dFileCache = {};
// קובץ קיים? (HEAD; בדף שגיאה של GitHub Pages מקבלים 404 / HTML)
function nmg3dExists(url) {
    if (!(url in nmg3dFileCache)) {
        nmg3dFileCache[url] = fetch(url, { method: 'HEAD', cache: 'no-cache' })
            .then(r => r.ok && !/text\/html/i.test(r.headers.get('content-type') || ''))
            .catch(() => false);
    }
    return nmg3dFileCache[url];
}
async function nmg3dFirstExisting(urls) {
    for (const u of urls) if (await nmg3dExists(u)) return u;
    return null;
}
// חיבור איטי או חיסכון בנתונים (2026-10-21, "שיעבוד חלק גם בחיבור איטי"): Me נשאר בתמונה שצולמה מהדגם (אותו מראה, בלי
// תנועה) והחתול הקישוטי לא נטען - חוסך כמה מגה. הג'יני נשאר בתלת־ממד (הציור הישן שלו לא חוזר אף פעם)
function nmg3dSlowNet() { const c = typeof navigator !== 'undefined' && navigator.connection; return !!(c && (c.saveData || /2g|3g/.test(c.effectiveType || ''))); }
function nmg3dReduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
function nmg3dWebgl() {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
}
let nmg3dViewerPromise = null;
function nmg3dLoadViewer() {
    if (window.customElements && customElements.get('model-viewer')) return Promise.resolve(true);
    if (!nmg3dViewerPromise) {
        nmg3dViewerPromise = new Promise(resolve => {
            const s = document.createElement('script');
            s.type = 'module';
            s.src = NMG3D_VIEWER_URL;
            s.onload = () => customElements.whenDefined('model-viewer').then(() => resolve(true));
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
    }
    return nmg3dViewerPromise;
}

// ---------- Me בתלת־ממד ----------
// אותו כפתור של Me (גרירה, כניסה לדלתות, נגיעה = "הדמות שלי") - רק שבמקום התמונה מופיע המודל, עם אנימציית
// העמידה/הריחוף, והליכה/תעופה בזמן גרירה, ופונה לכיוון התנועה. התמונה נשארת עד שהמודל נטען (ואם לא נטען - נשארת)
function nmg3dAfterHallRender() {
    const btn = document.querySelector('#new-me-root .nmh-me');
    const hall = document.querySelector('#new-me-root .nmh');
    if (hall) nmg3dAddCat(hall);
    nmg3dPrefetchYoga();
    if (!btn || typeof nmgShownStage !== 'function') return;
    nmg3dUpgradeMe(btn, nmgShownStage().n);
}
// התמונות של Me (world/3d/ava-me{n}.png) צולמו מהדגמים בריבוע של 512 (מצלמה 0°/80°): [x, y, רוחב, גובה] של הדמות בתוך
// הריבוע. כך הדגם החי יושב בדיוק על התמונה (אותו גודל, אותו מקום) - בלי קפיצה כשהוא נטען
// מסגרת עם מקום לסיבוב (לפי בקשה מפורשת, 2026-10-21: "נחתך לו הזנב… בעצם לכל מקום שהוא מסתכל"): הצילום מתוכנן לפנים בלבד,
// אז כשהוא מסתובב (צד, גב) כנפיים וזנב יצאו מהמסגרת. המצלמה רחוקה פי 140/105 והמסגרת גדולה באותו יחס - אותו גודל בדיוק,
// עם מקום מכל הצדדים
const NMG3D_ROOM = 140 / 105;
const NMG3D_RADIUS = '140%';
const NMG3D_ME_FRAMES = { 1: [90, 42, 327, 403], 2: [62, 72, 399, 365], 3: [42, 132, 425, 245] };
async function nmg3dUpgradeMe(btn, stageN) {
    if (!btn || btn.querySelector('model-viewer') || nmg3dReduced() || nmg3dSlowNet() || !nmg3dWebgl()) return;
    const url = `world/3d/me${stageN}.glb`;
    if (!(await nmg3dExists(url)) || !(await nmg3dLoadViewer()) || !btn.isConnected || btn.querySelector('model-viewer')) return;
    const mv = document.createElement('model-viewer');
    mv.className = 'nmg-me3d';
    const attrs = {
        src: url, alt: '', autoplay: '', 'disable-zoom': '', 'disable-pan': '', 'disable-tap': '', 'interaction-prompt': 'none',
        'shadow-intensity': '0', exposure: '1.1', 'environment-image': 'neutral',
        'camera-orbit': `0deg 80deg ${NMG3D_RADIUS}`, 'max-camera-orbit': 'auto auto 300%', loading: 'eager', 'aria-hidden': 'true',
    };
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    const F = NMG3D_ME_FRAMES[stageN];
    if (F) {
        // ריבוע הצילום (512) בקנה מידה אחד, והדמות יושבת בדיוק כמו התמונה: באמצע ולמטה (contain, 50% 100%). קודם הריבוע
        // נמתח למלבן, והדגם זז הצידה ולמעלה (לפי בקשה מפורשת, 2026-10-21: "היא לא באמצע")
        const [x, y, w, h] = F;
        const BW = typeof NMG_ME_W === 'number' ? NMG_ME_W : 124, BH = typeof NMG_ME_H === 'number' ? NMG_ME_H : 150;
        const k = Math.min(BW / w, BH / h), S0 = 512 * k, S = S0 * NMG3D_ROOM;
        const left = (BW - w * k) / 2 - x * k - (S - S0) / 2, top = BH - h * k - y * k - (S - S0) / 2;
        const pct = v => `${(v * 100).toFixed(2)}%`;
        Object.assign(mv.style, { left: pct(left / BW), top: pct(top / BH), width: pct(S / BW), height: pct(S / BH), right: 'auto', bottom: 'auto' });
    }
    mv.addEventListener('load', () => {
        const names = mv.availableAnimations || [];
        const pick = re => names.find(n => re.test(n)) || '';
        mv.dataset.idle = pick(/idle|breath|stand|float|hover/i) || names[0] || '';
        mv.dataset.walk = pick(/walk|run|fly|move/i) || mv.dataset.idle;
        if (mv.dataset.idle) mv.animationName = mv.dataset.idle;
        btn.classList.add('has-3d');
    }, { once: true });
    btn.appendChild(mv);
    // הגרירה כותבת is-flying על הכפתור (אנימציית הליכה, אם יש); הכיוון - nmg3dMeFace (הגב למעלה, הפנים למטה, הצד לצדדים)
    const sync = () => {
        if (!mv.isConnected) { obs.disconnect(); return; }
        const flying = btn.classList.contains('is-flying');
        const want = flying ? mv.dataset.walk : mv.dataset.idle;
        if (want && mv.animationName !== want) mv.animationName = want;
    };
    const obs = new MutationObserver(sync);
    obs.observe(btn, { attributes: true, attributeFilter: ['class'] });
    nmg3dFaceLoop(btn, mv);
}
// 🧭 לאן Me פונה (כמו בכל משחק בתלת־ממד): הולכים למעלה - רואים את הגב, למטה - את הפנים, לצדדים - את הצד. אחרי שעוצרים,
// כעבור רגע הוא חוזר לאט להסתכל עלינו. dx/dy - כיוון התנועה על המסך
function nmg3dHeading(dx, dy) { return -Math.atan2(dx, dy) * 180 / Math.PI; }
function nmg3dMeFace(el, dx, dy) {
    if (!el || Math.hypot(dx, dy) < 1.5) return;
    el.dataset.heading = String(nmg3dHeading(dx, dy));
    el.dataset.headAt = String(Date.now());
}
function nmg3dTurnToward(cur, target, k) { const d = ((((target - cur) % 360) + 540) % 360) - 180; return cur + d * k; }
function nmg3dFaceLoop(el, mv) {
    let theta = 0;
    const step = () => {
        if (!mv.isConnected) return;
        const recent = Date.now() - Number(el.dataset.headAt || 0) < 2600;
        const target = recent ? Number(el.dataset.heading || 0) : 0;
        const next = nmg3dTurnToward(theta, target, recent ? 0.22 : 0.06);
        if (Math.abs(next - theta) > 0.05) {
            theta = next;
            mv.cameraOrbit = `${theta.toFixed(1)}deg 80deg ${NMG3D_RADIUS}`;
            if (typeof mv.jumpCameraToGoal === 'function') mv.jumpCameraToGoal();
        }
        requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// ---------- 🗺️ מפת העולם עם עומק ----------
// שלוש שכבות (רחוק / אמצע / קרוב). גוררים את המפה - הקרובה זזה מהר והרחוקה לאט, וזו תחושת העומק. המקומות הם
// סיכות על השכבה האמצעית (נגיעה = הולכים לשם, נעול = כמה מפתחות חסרים - בדיוק כמו במפה הרגילה)
const NMG3D_MAP_LAYERS = [['back', 0.55], ['mid', 1], ['front', 1.35]];
// איפה כל מקום על המפה, באחוזים מהשכבה האמצעית [x, y] - יכוונו לפי המפה שלה כשתגיע
const NMG3D_MAP_PINS = {
    hall: [50, 86], room: [50, 62], roof: [50, 40], porch: [20, 70], music: [80, 70],
    breath: [24, 46], outside: [76, 48], yoga: [66, 26], waterfall: [36, 22],
};
async function nmg3dMapLayers() {
    const found = {};
    for (const [name] of NMG3D_MAP_LAYERS) {
        found[name] = await nmg3dFirstExisting([`world/map/${name}.png`, `world/map/${name}.jpg`, `world/map/${name}.webp`]);
    }
    return found.back ? found : null;
}
// נקרא מ-nmgOpenMap: אם יש שכבות - מחליף את התוכן של המפה במפה המצוירת (ומחזיר true)
async function nmg3dUpgradeMap(box, keys) {
    if (!box || typeof NMG_MAP === 'undefined') return false;
    const layers = await nmg3dMapLayers();
    if (!layers || !box.isConnected) return false;
    const reduce = nmg3dReduced();
    const pins = NMG_MAP.map(p => {
        const at = NMG3D_MAP_PINS[p.id] || [50, 50];
        const open = nmgPlaceOpen(p, keys);
        const need = p.id === 'room' ? 1 : p.id === 'hall' ? 0 : roomUnlockAt(p.id);
        return `<button type="button" class="nmg3d-pin${open ? '' : ' is-locked'}" style="left:${at[0]}%;top:${at[1]}%" onclick="nmgMapGo('${p.id}')" aria-label="${nmEsc(p.name())}${open ? '' : ` – 🔑 ${nmFmt(need)}`}">
            <span class="nmg3d-pin-dot">${open ? '' : NMG_SVG.lock}</span><span class="nmg3d-pin-name">${nmEsc(p.name())}</span>
        </button>`;
    }).join('');
    const scroll = box.querySelector('.nmg-map-scroll');
    const head = scroll ? scroll.querySelector('.nmg-map-head') : null;
    const stage = document.createElement('div');
    stage.className = 'nmg3d-map';
    // הסיכות - בשכבה משלהן מעל הכול (זזה יחד עם האמצעית), כך ששכבה קרובה אף פעם לא מסתירה מקום
    stage.innerHTML = NMG3D_MAP_LAYERS.map(([name, speed]) => layers[name] ? `<div class="nmg3d-layer nmg3d-${name}" data-speed="${speed}" style="background-image:url('${layers[name]}')"></div>` : '').join('')
        + `<div class="nmg3d-layer nmg3d-pins" data-speed="1">${pins}</div>`;
    if (scroll) { scroll.innerHTML = ''; if (head) scroll.appendChild(head); scroll.appendChild(stage); } else box.appendChild(stage);
    box.classList.add('has-depth');
    // גרירה: כל שכבה זזה לפי המהירות שלה; הגבולות - כמה שהשכבה האמצעית גדולה מהמסך
    let x = 0, y = 0, sx = 0, sy = 0, px = 0, py = 0, drag = false;
    const apply = () => stage.querySelectorAll('.nmg3d-layer').forEach(l => {
        const k = Number(l.dataset.speed) || 1;
        l.style.transform = `translate3d(${(x * k).toFixed(1)}px, ${(y * k).toFixed(1)}px, 0)`;
    });
    const bounds = () => {
        const r = stage.getBoundingClientRect();
        const mid = stage.querySelector('.nmg3d-mid') || stage.querySelector('.nmg3d-back');
        const m = mid ? mid.getBoundingClientRect() : r;
        return { mx: Math.max(0, (m.width - r.width) / 2), my: Math.max(0, (m.height - r.height) / 2) };
    };
    stage.addEventListener('pointerdown', e => {
        if (e.target.closest('.nmg3d-pin')) return;
        drag = true; sx = e.clientX; sy = e.clientY; px = x; py = y;
        try { stage.setPointerCapture(e.pointerId); } catch {}
    });
    stage.addEventListener('pointermove', e => {
        if (!drag) return;
        const b = bounds();
        x = Math.max(-b.mx, Math.min(b.mx, px + (e.clientX - sx)));
        y = Math.max(-b.my, Math.min(b.my, py + (e.clientY - sy)));
        apply();
    });
    const end = () => { drag = false; };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    // תנועה עדינה מעצמה כשלא נוגעים - העולם "נושם" (לא כשמבקשים פחות תנועה)
    if (!reduce) {
        let tt = 0;
        const breathe = () => {
            if (!stage.isConnected) return;
            if (!drag) {
                tt += 0.006;
                stage.querySelectorAll('.nmg3d-layer').forEach(l => {
                    const k = Number(l.dataset.speed) || 1;
                    const dx = Math.sin(tt) * 6 * (k - 1), dy = Math.cos(tt * 0.8) * 4 * (k - 1);
                    l.style.transform = `translate3d(${(x * k + dx).toFixed(1)}px, ${(y * k + dy).toFixed(1)}px, 0)`;
                });
            }
            requestAnimationFrame(breathe);
        };
        requestAnimationFrame(breathe);
    }
    return true;
}

// ---------- 🐈 החתול של הכוכבים ----------
// world/3d/cat.glb (מ-Meshy, 2026-10-20, לפי בקשה מפורשת: "פה הוא הולך… אם אתה רוצה להשתמש בזה כבר עכשיו אפשר"):
// מטייל לאט על השביל במסדרון - נכנס מצד אחד, עובר ונעלם, ואחרי הפסקה חוזר מהצד השני. לא חוסם שום לחיצה.
// אם בקובץ יש גם אנימציה של ליקוק (lick / groom) - לפעמים עוצר באמצע הדרך ומלקק את עצמו, ואז ממשיך.
// הוא אותו חתול בכל ציור חדש של המסדרון (לא נטען מחדש), ממשיך מאיפה שהיה. בלי הקובץ / WebGL / עם "פחות תנועה" - אין חתול
const NMG3D_CAT = {
    url: 'world/3d/cat.glb',
    feetY: 730, w: 196, h: 136, // במידות הציור (390 × 844): איפה הרגליים, וגודל החתול
    speed: 40,                  // יחידות ציור בשנייה
    timeScale: 0.6,             // קצב הצעדים (שהרגליים לא "יחליקו")
    rest: [6000, 15000],        // הפסקה בין מעבר למעבר (מ"ש)
};
let nmg3dCatReady = null;
async function nmg3dAddCat(hall) {
    if (!hall || nmg3dReduced() || nmg3dSlowNet() || !nmg3dWebgl()) return;
    if (!nmg3dCatReady) nmg3dCatReady = nmg3dMakeCat();
    const cat = await nmg3dCatReady;
    if (!cat || !hall.isConnected) return;
    if (cat.wrap.parentNode !== hall) hall.appendChild(cat.wrap);
    cat.wake();
}
async function nmg3dMakeCat() {
    const C = NMG3D_CAT;
    if (!(await nmg3dExists(C.url)) || !(await nmg3dLoadViewer())) return null;
    const wrap = document.createElement('div');
    wrap.className = 'nmg3d-cat';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.cssText = `--w:${C.w};--h:${C.h};--top:${C.feetY - C.h}`;
    const mv = document.createElement('model-viewer');
    const attrs = {
        src: C.url, alt: '', 'disable-zoom': '', 'disable-pan': '', 'disable-tap': '', 'interaction-prompt': 'none',
        // בלי צל תלת־ממדי: בדגם שהולך הוא מחושב מחדש בכל פריים וכבד במובייל (2026-10-20: "החתול במסדרון... יש תקיעות") - צל מצויר ב-CSS
        'shadow-intensity': '0', exposure: '1.75', 'environment-image': 'neutral',
        'camera-orbit': '-62deg 76deg auto', 'field-of-view': '22deg', loading: 'eager',
    };
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    wrap.appendChild(mv);
    const st = { dir: 1, x: -C.w, phase: 'rest', until: performance.now() + 1500, lickAt: null, walk: '', lick: '', last: 0, raf: 0 };
    const place = () => { wrap.style.setProperty('--x', st.x.toFixed(1)); };
    const startWalk = () => {
        st.phase = 'walk';
        st.x = st.dir > 0 ? -C.w : 390;
        // פונה לכיוון ההליכה, בשלושה רבעים כדי שיראו את הפנים (2026-10-20: "מה קרה לחתול??" - מהצד הוא נראה צללית): -62° = ימינה, 62° = שמאלה
        mv.cameraOrbit = `${st.dir > 0 ? -62 : 62}deg 76deg auto`;
        if (st.walk) mv.animationName = st.walk;
        mv.timeScale = C.timeScale;
        mv.play();
        st.lickAt = st.lick && Math.random() < 0.5 ? 110 + Math.random() * 130 : null;
        wrap.classList.add('is-on');
        place();
    };
    const tick = now => {
        st.raf = 0;
        if (!wrap.isConnected || !wrap.offsetParent) { mv.pause(); return; }  // המסדרון לא על המסך - נח עד wake
        const dt = Math.min(0.1, (now - (st.last || now)) / 1000);
        st.last = now;
        // בתוך חדר / מקום (המסדרון מתחתיו): עומד במקום ולא מצייר, עד שחוזרים
        if (document.getElementById('sr-overlay')) { mv.pause(); st.away = true; st.raf = requestAnimationFrame(tick); return; }
        if (st.away) { st.away = false; if (st.phase !== 'rest') mv.play(); }
        if (st.phase === 'rest' && now >= st.until) startWalk();
        else if (st.phase === 'walk') {
            st.x += st.dir * C.speed * dt;
            const mid = st.x + C.w / 2;
            if (st.lickAt !== null && (st.dir > 0 ? mid >= st.lickAt : mid <= 390 - st.lickAt)) {
                // עוצר ומלקק את עצמו (פעמיים), ואז ממשיך ללכת
                st.lickAt = null; st.phase = 'lick';
                mv.animationName = st.lick; mv.timeScale = 1;
                st.until = now + Math.max(1500, (mv.duration || 2) * 2000);
            } else if (st.x > 390 + 4 || st.x < -C.w - 4) {
                st.phase = 'rest'; st.dir = -st.dir;
                st.until = now + C.rest[0] + Math.random() * (C.rest[1] - C.rest[0]);
                wrap.classList.remove('is-on');
                mv.pause();
            }
            place();
        } else if (st.phase === 'lick' && now >= st.until) {
            st.phase = 'walk';
            if (st.walk) mv.animationName = st.walk;
            mv.timeScale = C.timeScale;
        }
        st.raf = requestAnimationFrame(tick);
    };
    const wake = () => { if (!st.raf) { st.last = 0; if (st.phase !== 'rest') mv.play(); st.raf = requestAnimationFrame(tick); } };
    mv.addEventListener('load', () => {
        const names = mv.availableAnimations || [];
        st.walk = names.find(n => /walk|run|move/i.test(n)) || names.find(n => !/lick|groom|clean|wash|idle/i.test(n)) || names[0] || '';
        st.lick = names.find(n => /lick|groom|clean|wash/i.test(n)) || '';
        if (st.walk) mv.animationName = st.walk;
    }, { once: true });
    place();
    return { wrap, mv, wake };
}

// ---------- 🧘 היוגה בתלת־ממד ----------
// (2026-10-20, לפי בקשה מפורשת: "היצורים של היער בתלת מימד אתה יכול לשים אותם" / "מורת יוגה עיניים פקוחות שמתקרבים
// לדבר איתם לשים שם"). world/3d/<שם הציור>.glb מחליף את הציור של אותו יצור על המזרון (yg-baby.glb, yg-blob.glb,
// yg-fluffy.glb, yg-spirit.glb) - מרחף ונושם כמו הציורים. teacher-open.glb = המורה בעיניים פקוחות: מופיעה כשמתקרבים
// לדבר איתה, בגודל המלא של הזום (חד, לא מתיחה של תמונה קטנה). teacher-closed.glb, אם יגיע - המורה במדיטציה
// כמה גדול המודל מהציור שהוא מחליף (המודל ממוסגר עם שוליים)
const NMG3D_YOGA_FRAME = { w: 1.8, h: 1.8, drop: 0.1 };
// יצורים שהגיעו עם מזרון משלהם (2026-10-20): המזרון של הדגם יושב בדיוק על המזרון שבציור - מרכז (cx, y) ורוחב (w)
// של המזרון בציור (390×844). המזרון של דגם מ-Meshy תופס בערך 61% מרוחב המסגרת ומרכזו ב-71% מגובהה, כשהמצלמה גבוהה כמו בציור (62°)
const NMG3D_YOGA_MATS = {
    'yg-fluffy': { cx: 128, y: 640, w: 118 },
    'yg-blob': { cx: 44, y: 614, w: 100 },
    'yg-spirit': { cx: 350, y: 614, w: 100 },
};
const NMG3D_MAT_IN_FRAME = { w: 0.61, y: 0.71, aspect: 260 / 300, phi: 62 };
// מ-2026-10-20: הדמויות ביוגה (ובגג) הן תמונות שצולמו מהדגמים בתלת־ממד (world/3d/<שם>.png), באותה מצלמה ובאותו יחס
// של המסגרת - בדיוק מה שהדגם החי הראה, אבל עובד בכל מסך (דגם חי בתוך החדר צויר במקום הלא נכון במסך רחב) ונטען מהר
function nmg3dYogaViewer(url, cls) {
    const img = document.createElement('img');
    img.className = cls;
    img.src = url;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    return img;
}
// מלבן של <image> בציור (viewBox 390×844, slice) בפיקסלים של המסגרת, בלי טרנספורמציות (גם באמצע זום/אנימציה)
function nmg3dSceneScale(frame) {
    const W = frame.clientWidth, H = frame.clientHeight;
    const s = Math.max(W / 390, H / 844);
    return { s, ox: (W - 390 * s) / 2, oy: (H - 844 * s) / 2 };
}
function nmg3dSvgRect(svg, img, frame) {
    const { s, ox, oy } = nmg3dSceneScale(frame);
    const x = +img.getAttribute('x'), y = +img.getAttribute('y'), w = +img.getAttribute('width'), h = +img.getAttribute('height');
    return { left: ox + x * s, top: oy + y * s, width: w * s, height: h * s };
}
// מסגרת לדגם עם מזרון: כך שהמזרון שלו נופל בדיוק על המזרון שבציור
function nmg3dPlaceOnMat(el, mat, frame) {
    const { s, ox, oy } = nmg3dSceneScale(frame);
    const M = NMG3D_MAT_IN_FRAME;
    const w = mat.w / M.w, h = w * M.aspect;
    Object.assign(el.style, {
        left: `${(ox + (mat.cx - w / 2) * s).toFixed(1)}px`, top: `${(oy + (mat.y - h * M.y) * s).toFixed(1)}px`,
        width: `${(w * s).toFixed(1)}px`, height: `${(h * s).toFixed(1)}px`,
    });
}
function nmg3dPlace(el, r, F = NMG3D_YOGA_FRAME) {
    const w = r.width * F.w, h = r.height * F.h;
    Object.assign(el.style, {
        left: `${(r.left + r.width / 2 - w / 2).toFixed(1)}px`, top: `${(r.top + r.height * (1 + F.drop) - h).toFixed(1)}px`,
        width: `${w.toFixed(1)}px`, height: `${h.toFixed(1)}px`,
    });
}
// כיוונון קטן לדמות בלי מזרון (dy = כמה יחידות ציור להוריד): המורה בעיניים עצומות יושבת על הסלע
const NMG3D_YOGA_TUNE = { 'teacher-closed': { dy: 22 } };
// בודקים מראש אילו דמויות יש בתלת־ממד (נקרא מהמסדרון), כך שבכניסה ליוגה הציורים מוסתרים מיד - בלי הבזק של הגרסה הישנה
const NMG3D_YOGA_NAMES = ['yg-blob', 'yg-fluffy', 'yg-spirit', 'yg-baby', 'teacher-closed', 'teacher-open'];
function nmg3dPrefetchYoga() {
    // רק בחיבור טוב ובזמן פנוי (2026-10-21, "שיעבוד חלק גם בחיבור איטי"): בחיבור איטי / חסכון בנתונים התמונות נטענות רק
    // כשנכנסים ליוגה, כדי לא להתחרות במה שצריך עכשיו
    if (nmg3dSlowNet()) return;
    const go = () => NMG3D_YOGA_NAMES.forEach(n => { const im = new Image(); im.fetchPriority = 'low'; im.src = `world/3d/${n}.png`; });
    if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 6000 }); else setTimeout(go, 3000);
}
async function nmg3dUpgradeYoga(box) {
    if (!box) return;
    const view = box.querySelector('.srp-view');
    const svg = view && view.querySelector('svg.srp-scene');
    if (!svg) return;
    const base = img => img.getAttribute('data-yg-art') || (img.getAttribute('href') || '').split('/').pop().replace(/\.(png|jpe?g|webp)$/i, '');
    const glb = img => `world/3d/${base(img)}.png`;
    const imgs = [...svg.querySelectorAll('image.yg-sitter, image.yg-eyes-closed')];
    const open = svg.querySelector('image.yg-eyes-open');
    // התמונות של התלת־ממד תמיד באות עם האפליקציה (world/3d/<שם>.png) - בלי בדיקת HEAD מראש (חוסך 6 בקשות בחיבור איטי, ואין
    // מצב שבדיקה שנכשלה משאירה מזרונים ריקים); קובץ שלא נטען מסיר את עצמו (error למטה)
    const has = imgs.concat(open ? [open] : []).map(img => !!base(img));
    const sitters = imgs.filter((_, i) => has[i]);
    const openUrl = open && has[imgs.length] ? glb(open) : null;
    if ((!sitters.length && !openUrl) || !box.isConnected) return;
    // הציורים של מי שיש לו גרסה בתלת־ממד נעלמים מיד (לפי בקשה מפורשת, 2026-10-20: "שים לב שלא רואים גרסאות ישנות לשום
    // דבר"), והדגם נכנס בעדינות כשהוא נטען. (מ-2026-10-21 הציורים הישנים של היוגה לא נטענים בכלל - ב-<image> יש רק מקום, data-yg-art)
    sitters.forEach(img => img.classList.add('has-3d'));
    if (openUrl) open.classList.add('has-3d');
    if (!box.isConnected) return;
    // היצורים (והמורה בעיניים עצומות): מעל התמונה, באותו מקום בדיוק (התמונה ממלאת את המקום כולו). בזום של השיחה הם
    // נחים (הזום מתמקד במורה, והם נשארים מחוץ למסגרת / מתחת לחלון השיחה)
    const placed = sitters.map((img, i) => {
        const name = base(img);
        const mat = NMG3D_YOGA_MATS[name] || null;
        const wrap = document.createElement('div');
        wrap.className = `yg-3d${mat ? ' is-mat' : ''}${img.classList.contains('yg-eyes-closed') ? ' is-guide' : ''}`;
        wrap.style.setProperty('--d', `${(-1.2 * i).toFixed(1)}s`);
        const mv = nmg3dYogaViewer(glb(img), 'yg-3d-mv');
        mv.addEventListener('load', () => { wrap.dataset.ready = '1'; wrap.classList.add('is-ready'); }, { once: true });
        mv.addEventListener('error', () => { wrap.remove(); img.classList.remove('has-3d'); }, { once: true });
        wrap.appendChild(mv);
        box.appendChild(wrap);
        return { wrap, img, mat, tune: NMG3D_YOGA_TUNE[name] || null };
    });
    const layout = () => placed.forEach(p => {
        if (p.mat) { nmg3dPlaceOnMat(p.wrap, p.mat, view); return; }
        const r = nmg3dSvgRect(svg, p.img, view);
        if (p.tune) r.top += p.tune.dy * nmg3dSceneScale(view).s;
        nmg3dPlace(p.wrap, r);
    });
    layout();
    // המורה בעיניים פקוחות: מחוץ לתמונה (שלא תימתח בזום, נשארת חדה) - מופיעה ברגע שמתחילים להתקרב, כבר במקום שבו
    // הזום ייגמר (מחושב מהזום עצמו), ונעלמת כשמתרחקים. הציור שלה לא מופיע אף פעם
    let teacher = null;
    // המקום שלה בשיחה: כל הדמות, באמצע, ברווח שבין הכותרת לחלון השיחה (שתופס עד חצי מלמטה) - תמיד שלמה וגלויה
    const placeTeacher = () => {
        if (!teacher) return;
        const W = box.clientWidth, H = box.clientHeight;
        Object.assign(teacher.style, { left: `${(W * 0.04).toFixed(1)}px`, width: `${(W * 0.92).toFixed(1)}px`, top: `${(H * 0.075).toFixed(1)}px`, height: `${(H * 0.43).toFixed(1)}px` });
    };
    const showTeacher = () => {
        if (!teacher || !teacher.dataset.ready || !box.classList.contains('yg-zoomed')) return;
        placeTeacher();
        teacher.classList.add('is-on');
    };
    if (openUrl) {
        teacher = document.createElement('div');
        teacher.className = 'yg-3d yg-3d-teacher';
        const mv = nmg3dYogaViewer(openUrl, 'yg-3d-mv is-contain');
        mv.addEventListener('load', () => { teacher.dataset.ready = '1'; showTeacher(); }, { once: true });
        mv.addEventListener('error', () => { teacher.remove(); teacher = null; open.classList.remove('has-3d'); }, { once: true });
        teacher.appendChild(mv);
        box.appendChild(teacher);
        // כבר בגודל ובמקום הסופיים (מודל בגודל 0 תוקע את הציור של כל שאר המודלים בעמוד, ושינוי גודל פתאומי משאיר אותו קטן)
        placeTeacher();
    }
    const sync = () => {
        if (!box.isConnected) { ro.disconnect(); mo.disconnect(); return; }
        const zoomed = box.classList.contains('yg-zoomed') && box.classList.contains('yg-awake');
        placed.forEach(p => p.wrap.classList.toggle('is-away', zoomed));
        if (!teacher) return;
        if (zoomed) showTeacher(); else teacher.classList.remove('is-on');
    };
    const ro = new ResizeObserver(() => { layout(); placeTeacher(); });
    ro.observe(view);
    const mo = new MutationObserver(sync);
    mo.observe(box, { attributes: true, attributeFilter: ['class'] });
}

// ---------- 🧞 רוח היער בתלת־ממד ----------
// world/3d/genie.glb (2026-10-20, לפי בקשה מפורשת: "זה הגיני החדש שיצא מהבקבוק" / "שהוא מסתובב מהבקבוק תן לו מלא
// נצנצים שבקושי יראו"): עולה מהמנורה באותה ספירלה, מסתובב סביב עצמו (כמו רקדן, לא כמו גלגל) בתוך ענן צפוף של
// נצנצים שכמעט מסתיר אותו, ובסוף הנצנצים נמוגים והוא עומד מולנו לשאלות. נטען מראש כשנכנסים למרפסת
const NMG3D_GENIE = { url: 'world/3d/genie.glb', spinFrom: 1080, start: 200, spin: 3200, sparks: 70 };
const nmg3dGenieState = { ok: null };
function nmg3dPrepGenie() {
    if (nmg3dGenieState.ok !== null || nmg3dReduced() || !nmg3dWebgl()) return;
    nmg3dGenieState.ok = false;
    nmg3dExists(NMG3D_GENIE.url).then(ok => {
        if (!ok) return;
        nmg3dLoadViewer().then(v => {
            if (!v) return;
            nmg3dGenieState.ok = true;
            // מחממים את הדגם עצמו (לא רק את הקובץ): דגם זעיר ושקוף (2×2, לא 0×0 - דגם בגודל 0 תוקע את כל השאר) טוען ומפענח אותו
            // כבר עכשיו, ו-model-viewer שומר אותו - כשנוגעים במנורה הג'יני מופיע מיד ולא בסוף. נמחק כשהוא נטען
            const warm = document.createElement('model-viewer');
            warm.setAttribute('src', NMG3D_GENIE.url);
            warm.setAttribute('loading', 'eager');
            warm.setAttribute('aria-hidden', 'true');
            warm.style.cssText = 'position:fixed;left:0;bottom:0;width:2px;height:2px;opacity:0.01;pointer-events:none;z-index:-1';
            const done = () => setTimeout(() => warm.remove(), 400);
            warm.addEventListener('load', done, { once: true });
            warm.addEventListener('error', done, { once: true });
            setTimeout(() => warm.remove(), 20000);
            document.body.appendChild(warm);
        });
    });
}
function nmg3dGenieOk() { return nmg3dGenieState.ok === true && !!(window.customElements && customElements.get('model-viewer')); }
function nmg3dMountGenie(layer) {
    const G = NMG3D_GENIE;
    const swirl = layer.querySelector('.srp-genie-swirl');
    if (!swirl) return;
    const colors = ['#fff6c8', '#ffd27a', '#ff9ecf', '#a7f3d0', '#c9b6ff', '#ffffff'];
    const sparks = document.createElement('div');
    sparks.className = 'srp-genie-sparks';
    sparks.setAttribute('aria-hidden', 'true');
    sparks.innerHTML = Array.from({ length: G.sparks }, (_, i) => {
        const a = i * 137.5 * Math.PI / 180, rr = 14 + (i * 53 % 38);  // פיזור "חמנייה" בתוך אליפסה
        const x = 50 + Math.cos(a) * rr, y = 46 + Math.sin(a) * rr * 1.25;
        return `<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--s:${(0.7 + (i % 6) * 0.3).toFixed(2)};--c:${colors[i % colors.length]};--d:${((i * 0.137) % 1.2).toFixed(2)}s;--t:${(0.6 + (i % 4) * 0.2).toFixed(2)}s"></i>`;
    }).join('') + '<b class="srp-genie-haze"></b>';
    const mv = document.createElement('model-viewer');
    mv.className = 'srp-genie-3d';
    const attrs = {
        src: G.url, alt: '', 'disable-zoom': '', 'disable-pan': '', 'disable-tap': '', 'interaction-prompt': 'none',
        'shadow-intensity': '0', exposure: '1.15', 'environment-image': 'neutral',
        'camera-orbit': `${G.spinFrom}deg 82deg auto`, 'interpolation-decay': '1', loading: 'eager', 'aria-hidden': 'true',
    };
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    swirl.appendChild(mv);
    swirl.appendChild(sparks);
    // הסיבוב: מ-3 סיבובים ועד שהוא פונה אלינו, לאט יותר ויותר (יחד עם הספירלה של ה-CSS)
    const t0 = performance.now() + G.start;
    const step = now => {
        if (!mv.isConnected) return;
        const p = Math.max(0, Math.min(1, (now - t0) / G.spin));
        const e = 1 - Math.pow(1 - p, 3);
        mv.cameraOrbit = `${(G.spinFrom * (1 - e)).toFixed(1)}deg 82deg auto`;
        if (typeof mv.jumpCameraToGoal === 'function') mv.jumpCameraToGoal();
        if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

// ---------- 🐈 החתול על הגג בתלת־ממד ----------
// world/3d/cat-roof.glb (החתול העומד שלה מ-Meshy) במקום החתול המצויר על הכרית (לפי בקשה מפורשת, 2026-10-20: "שים לב
// שלא רואים גרסאות ישנות לשום דבר"). עומד על הכרית ונושם בעדינות, לא תופס לחיצות. הציור מוסתר מיד, וחוזר רק אם אין תלת־ממד
const NMG3D_ROOF_CAT = { url: 'world/3d/cat-roof.png', x: 165.4, y: 580, w: 61.2, h: 76, fw: 3.1, fh: 1.95, drop: 0.08 };
async function nmg3dUpgradeRoofCat(sky) {
    if (!sky) return;
    const C = NMG3D_ROOF_CAT;
    const svg = sky.querySelector('svg.sr-roof-scene');
    const art = sky.querySelector('.sr-cat-art');
    if (!svg || !art || !(await nmg3dExists(C.url)) || !sky.isConnected) return;
    art.classList.add('has-3d');
    const wrap = document.createElement('div');
    wrap.className = 'sr-cat-3d';
    // תמונה שצולמה מהדגם (אותה מצלמה: -32°/80°, אותו יחס מסגרת) - ר' nmg3dYogaViewer
    const mv = nmg3dYogaViewer(C.url, '');
    mv.addEventListener('load', () => wrap.classList.add('is-ready'), { once: true });
    mv.addEventListener('error', () => { wrap.remove(); art.classList.remove('has-3d'); }, { once: true });
    wrap.appendChild(mv);
    sky.appendChild(wrap);
    // הציור בתוך viewBox 390×780 (slice, מיושר למטה): המקום של החתול המצויר → פיקסלים בתוך השמיים
    const place = () => {
        const sr = svg.getBoundingClientRect(), kr = sky.getBoundingClientRect();
        const W = sr.width, H = sr.height;
        const s = Math.max(W / 390, H / 780), ox = (W - 390 * s) / 2 + sr.left - kr.left, oy = H - 780 * s + sr.top - kr.top;
        const w = C.w * C.fw, h = C.h * C.fh;
        Object.assign(wrap.style, {
            left: `${(ox + (C.x + C.w / 2 - w / 2) * s).toFixed(1)}px`, top: `${(oy + (C.y + C.h * (1 + C.drop) - h) * s).toFixed(1)}px`,
            width: `${(w * s).toFixed(1)}px`, height: `${(h * s).toFixed(1)}px`,
        });
    };
    place();
    const ro = new ResizeObserver(() => { if (!wrap.isConnected) { ro.disconnect(); return; } place(); });
    ro.observe(svg);
}


// ---------- ✨ Me איתי בכל מקום ----------
// (לפי בקשה מפורשת, 2026-10-20: "הME1 לא משנה לאן אני הולכת הוא יבוא איתי", ואז: "למה הוא סתם מתעופף? אני רוצה לשלוט לאן
// הוא הולך ואהבתי שהוא מסתובב תעשה שיהיה אפשרות שהוא יסתובב אם נסובב אותו עם האצבע"). בכל חדר ובכל מקום Me (הדמות החיה
// בתלת־ממד) מרחף במקום שבו השארנו אותו, ורק זז כשמזיזים אותו: גוררים אותו (באצבע / בעכבר / בחיצים) לכל מקום, ומסובבים
// אותו סביב עצמו בגרירה על הטבעת הזוהרת שמתחת לרגליים (Q / E במקלדת) - סיבוב חלק עם תנופה, 360 מעלות.
// בלי WebGL / "פחות תנועה" - התמונה שלו (בלי סיבוב). המיקום נשמר בין המקומות (באותה הפעלה)
const nmgFollow = { layer: null, el: null, ring: null, img: null, mv: null, stage: 0, raf: 0, watch: 0, pos: null, theta: 0, spinV: 0, dragging: false, face: null };
function nmg3dFollowSync() {
    if (typeof nmgShownStage !== 'function') return;
    const wrap = document.querySelector('.phone-wrapper');
    if (!wrap) return;
    if (!nmgFollow.layer || !nmgFollow.layer.isConnected) {
        const layer = document.createElement('div');
        layer.id = 'nmg-follow-layer';
        layer.innerHTML = `<div class="nmg-follow" role="img" aria-label="${(typeof nmEsc === 'function' ? nmEsc : String)(t('nm_me_title'))}"><img alt="" draggable="false"><span class="nmg-follow-ring" aria-hidden="true"></span></div>`;
        wrap.appendChild(layer);
        Object.assign(nmgFollow, { layer, el: layer.firstElementChild, ring: layer.querySelector('.nmg-follow-ring'), img: layer.querySelector('img'), mv: null, stage: 0 });
        nmg3dFollowBind();
    }
    const s = nmgShownStage();
    if (nmgFollow.stage !== s.n) {
        nmgFollow.stage = s.n;
        nmgFollow.img.src = `world/${s.img}`;
        nmg3dFollowDrop();
    }
    if (!nmgFollow.watch) nmgFollow.watch = setInterval(nmg3dFollowWatch, 500);
}
// דגם חי שמוסתר (display:none, גודל 0×0) עוצר את הציור של כל שאר הדגמים בעמוד (החתול ו-Me במסדרון) - לכן הדגם של Me
// כאן קיים רק כשמקום פתוח, ונמחק כשיוצאים
function nmg3dFollowDrop() {
    if (nmgFollow.mv) { nmgFollow.mv.remove(); nmgFollow.mv = null; }
    if (nmgFollow.el) nmgFollow.el.classList.remove('has-3d');
}
// הסיבוב סביב החזה והראש של כל שלב (נמדד מהדגמים) ולא סביב מרכז הקופסה (שהזנב והכנפיים מזיזים) - כך הגוף נשאר בדיוק מעל
// הטבעת מכל צד (לפי בקשה מפורשת, 2026-10-21: "והעיגול לא מתחתיו")
const NMG3D_BODY = { 1: '0.01m auto 0.13m', 2: '0.18m auto 0.05m', 3: '0.10m auto -0.03m' };
async function nmg3dFollowLive(n) {
    if (nmg3dReduced() || nmg3dSlowNet() || !nmg3dWebgl()) return;
    const url = `world/3d/me${n}.glb`;
    if (!(await nmg3dExists(url)) || !(await nmg3dLoadViewer()) || nmgFollow.stage !== n || nmgFollow.mv || !nmgFollow.layer || !nmgFollow.layer.offsetParent) return;
    const mv = document.createElement('model-viewer');
    const attrs = {
        src: url, alt: '', 'disable-zoom': '', 'disable-pan': '', 'disable-tap': '', 'interaction-prompt': 'none',
        'shadow-intensity': '0', exposure: '1.1', 'environment-image': 'neutral', 'camera-orbit': `${nmgFollow.theta}deg 80deg ${NMG3D_RADIUS}`, 'max-camera-orbit': 'auto auto 300%', 'camera-target': NMG3D_BODY[n] || 'auto auto auto', loading: 'eager',
    };
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    mv.addEventListener('load', () => nmgFollow.el.classList.add('has-3d'), { once: true });
    nmgFollow.el.insertBefore(mv, nmgFollow.ring);
    nmgFollow.mv = mv;
}
function nmg3dFollowWatch() {
    const shown = !!(nmgFollow.layer && nmgFollow.layer.isConnected && nmgFollow.layer.offsetParent);
    if (shown && !nmgFollow.mv) nmg3dFollowLive(nmgFollow.stage);
    else if (!shown && nmgFollow.mv) nmg3dFollowDrop();
    if (shown) { nmg3dFollowPlace(); if (!nmgFollow.raf) nmgFollow.raf = requestAnimationFrame(nmg3dFollowTick); }
}
// המיקום (פיקסלים בתוך השכבה), תמיד בתוך המסך; ברירת המחדל - למטה בצד, מעל התיק
function nmg3dFollowClamp(p) {
    const L = nmgFollow.layer, el = nmgFollow.el;
    const W = L.clientWidth, H = L.clientHeight, w = el.offsetWidth || 128, h = el.offsetHeight || 140;
    return { x: Math.max(4, Math.min(W - w - 4, p.x)), y: Math.max(60, Math.min(H - h - 96, p.y)) };
}
function nmg3dFollowPlace() {
    const L = nmgFollow.layer;
    if (!L || !L.offsetParent) return;
    if (!nmgFollow.pos) nmgFollow.pos = { x: L.clientWidth * 0.08, y: L.clientHeight * 0.58 };
    nmgFollow.pos = nmg3dFollowClamp(nmgFollow.pos);
    nmgFollow.el.style.setProperty('--fx', `${nmgFollow.pos.x.toFixed(1)}px`);
    nmgFollow.el.style.setProperty('--fy', `${nmgFollow.pos.y.toFixed(1)}px`);
}
// הסיבוב: תנופה שנרגעת לאט (אחרי שעוזבים את הטבעת הוא ממשיך להסתובב עוד קצת). כשמזיזים אותו - פונה לאן שהולך (למעלה -
// רואים את הגב, למטה - את הפנים, כמו בכל משחק בתלת־ממד), ונשאר כך כשעוצרים
function nmg3dFollowTick() {
    nmgFollow.raf = 0;
    if (!nmgFollow.layer || !nmgFollow.layer.offsetParent) return;
    if (nmgFollow.face !== null) {
        nmgFollow.spinV = 0;
        nmgFollow.theta = nmg3dTurnToward(nmgFollow.theta, nmgFollow.face, 0.2);
        if (Math.abs(nmg3dTurnToward(nmgFollow.theta, nmgFollow.face, 1) - nmgFollow.theta) < 0.4) nmgFollow.face = null;
    } else if (!nmgFollow.dragging && Math.abs(nmgFollow.spinV) > 0.05) { nmgFollow.theta += nmgFollow.spinV; nmgFollow.spinV *= 0.94; }
    else if (!nmgFollow.dragging) nmgFollow.spinV = 0;
    const mv = nmgFollow.mv;
    if (mv && nmgFollow.el.classList.contains('has-3d')) {
        mv.cameraOrbit = `${nmgFollow.theta.toFixed(1)}deg 80deg ${NMG3D_RADIUS}`;
        if (typeof mv.jumpCameraToGoal === 'function') mv.jumpCameraToGoal();
    }
    if (nmgFollow.dragging || nmgFollow.face !== null || Math.abs(nmgFollow.spinV) > 0.05) nmgFollow.raf = requestAnimationFrame(nmg3dFollowTick);
}
function nmg3dFollowSpinKick() { if (!nmgFollow.raf) nmgFollow.raf = requestAnimationFrame(nmg3dFollowTick); }
// לאן הוא פונה כשמזיזים אותו (dx/dy על המסך)
function nmg3dFollowFace(dx, dy) { if (Math.hypot(dx, dy) < 1.5) return; nmgFollow.face = nmg3dHeading(dx, dy); nmg3dFollowSpinKick(); }
function nmg3dFollowBind() {
    const el = nmgFollow.el, ring = nmgFollow.ring;
    // גרירה על Me = הזזה; גרירה על הטבעת = סיבוב
    el.addEventListener('pointerdown', e => {
        if (e.button > 0) return;
        const rotate = e.target === ring;
        const x0 = e.clientX, y0 = e.clientY, start = { ...(nmgFollow.pos || { x: 0, y: 0 }) };
        let lastX = x0, lastY = y0, lastT = performance.now();
        nmgFollow.dragging = true;
        el.classList.add(rotate ? 'is-spinning' : 'is-moving');
        if (rotate) nmgFollow.face = null;
        try { el.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
        nmg3dFollowSpinKick();
        const move = ev => {
            if (rotate) {
                const dx = ev.clientX - lastX, now = performance.now();
                nmgFollow.theta -= dx * 1.4;
                nmgFollow.spinV = -dx * 1.4 / Math.max(1, (now - lastT) / 16);
                lastX = ev.clientX; lastT = now;
            } else {
                nmgFollow.pos = nmg3dFollowClamp({ x: start.x + ev.clientX - x0, y: start.y + ev.clientY - y0 });
                el.style.setProperty('--fx', `${nmgFollow.pos.x.toFixed(1)}px`);
                el.style.setProperty('--fy', `${nmgFollow.pos.y.toFixed(1)}px`);
                el.style.setProperty('--tilt', `${Math.max(-10, Math.min(10, (ev.clientX - lastX) * 1.5))}deg`);
                if (Math.hypot(ev.clientX - lastX, ev.clientY - lastY) >= 3) { nmg3dFollowFace(ev.clientX - lastX, ev.clientY - lastY); lastX = ev.clientX; lastY = ev.clientY; }
            }
        };
        const up = () => {
            nmgFollow.dragging = false;
            el.classList.remove('is-spinning', 'is-moving');
            el.style.setProperty('--tilt', '0deg');
            el.removeEventListener('pointermove', move);
            el.removeEventListener('pointerup', up);
            el.removeEventListener('pointercancel', up);
            nmg3dFollowSpinKick();
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
        el.addEventListener('pointercancel', up);
    });
    // במקלדת (בתוך מקום): חיצים / W A S D מזיזים, Q / E מסובבים
    document.addEventListener('keydown', e => {
        if (!nmgFollow.layer || !nmgFollow.layer.offsetParent || getComputedStyle(nmgFollow.layer).visibility === 'hidden') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.target && e.target.closest && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        const k = e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key;
        const dirs = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1], a: [-1, 0], d: [1, 0], w: [0, -1], s: [0, 1] };
        if (k === 'q' || k === 'e') { e.preventDefault(); nmgFollow.face = null; nmgFollow.spinV += k === 'q' ? 6 : -6; nmg3dFollowSpinKick(); return; }
        if (!dirs[k]) return;
        e.preventDefault();
        const [dx, dy] = dirs[k];
        nmgFollow.pos = nmg3dFollowClamp({ x: (nmgFollow.pos || { x: 0 }).x + dx * 16, y: (nmgFollow.pos || { y: 0 }).y + dy * 16 });
        nmg3dFollowPlace();
        nmg3dFollowFace(dx * 10, dy * 10);
    });
}
