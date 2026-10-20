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
    if (!btn || typeof nmgShownStage !== 'function') return;
    nmg3dUpgradeMe(btn, nmgShownStage().n);
}
async function nmg3dUpgradeMe(btn, stageN) {
    if (!btn || btn.querySelector('model-viewer') || nmg3dReduced() || !nmg3dWebgl()) return;
    const url = `world/3d/me${stageN}.glb`;
    if (!(await nmg3dExists(url)) || !(await nmg3dLoadViewer()) || !btn.isConnected || btn.querySelector('model-viewer')) return;
    const mv = document.createElement('model-viewer');
    mv.className = 'nmg-me3d';
    const attrs = {
        src: url, alt: '', autoplay: '', 'disable-zoom': '', 'disable-pan': '', 'disable-tap': '', 'interaction-prompt': 'none',
        'shadow-intensity': '0.7', 'shadow-softness': '1', exposure: '1.05', 'environment-image': 'neutral',
        'camera-orbit': '0deg 78deg auto', 'field-of-view': '30deg', loading: 'eager', 'aria-hidden': 'true',
    };
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    mv.addEventListener('load', () => {
        const names = mv.availableAnimations || [];
        const pick = re => names.find(n => re.test(n)) || '';
        mv.dataset.idle = pick(/idle|breath|stand|float|hover/i) || names[0] || '';
        mv.dataset.walk = pick(/walk|run|fly|move/i) || mv.dataset.idle;
        if (mv.dataset.idle) mv.animationName = mv.dataset.idle;
        btn.classList.add('has-3d');
    }, { once: true });
    btn.appendChild(mv);
    // הגרירה כבר כותבת is-flying ו---tilt על הכפתור - מקשיבים להם
    const sync = () => {
        if (!mv.isConnected) { obs.disconnect(); return; }
        if (!mv.dataset.idle) return;
        const flying = btn.classList.contains('is-flying');
        const want = flying ? mv.dataset.walk : mv.dataset.idle;
        if (want && mv.animationName !== want) mv.animationName = want;
        const tilt = parseFloat(btn.style.getPropertyValue('--tilt')) || 0;
        const theta = flying && Math.abs(tilt) > 1 ? (tilt > 0 ? -55 : 55) : 0;
        if (Number(mv.dataset.theta || 0) !== theta) { mv.dataset.theta = String(theta); mv.cameraOrbit = `${theta}deg 78deg auto`; }
    };
    const obs = new MutationObserver(sync);
    obs.observe(btn, { attributes: true, attributeFilter: ['class', 'style'] });
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
    feetY: 722, w: 150, h: 104, // במידות הציור (390 × 844): איפה הרגליים, וגודל החתול
    speed: 40,                  // יחידות ציור בשנייה
    timeScale: 0.6,             // קצב הצעדים (שהרגליים לא "יחליקו")
    rest: [6000, 15000],        // הפסקה בין מעבר למעבר (מ"ש)
};
let nmg3dCatReady = null;
async function nmg3dAddCat(hall) {
    if (!hall || nmg3dReduced() || !nmg3dWebgl()) return;
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
        'shadow-intensity': '0.8', 'shadow-softness': '1', exposure: '1.45', 'environment-image': 'neutral',
        'camera-orbit': '-90deg 80deg auto', 'field-of-view': '22deg', loading: 'eager',
    };
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    wrap.appendChild(mv);
    const st = { dir: 1, x: -C.w, phase: 'rest', until: performance.now() + 1500, lickAt: null, walk: '', lick: '', last: 0, raf: 0 };
    const place = () => { wrap.style.setProperty('--x', st.x.toFixed(1)); };
    const startWalk = () => {
        st.phase = 'walk';
        st.x = st.dir > 0 ? -C.w : 390;
        // פונה לכיוון ההליכה: מהצד (-90° = ימינה, 90° = שמאלה)
        mv.cameraOrbit = `${st.dir > 0 ? -90 : 90}deg 80deg auto`;
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
// כמה גדול המודל מהציור שהוא מחליף (המודל ממוסגר עם שוליים): יצור על מזרון, והמורה בזום של השיחה
const NMG3D_YOGA_FRAME = { w: 1.8, h: 1.8, drop: 0.1 };
const NMG3D_TEACHER_FRAME = { w: 1.55, h: 1.3, drop: 0.04 };
// יצורים שהגיעו עם מזרון משלהם (2026-10-20): המזרון של הדגם יושב בדיוק על המזרון שבציור - מרכז (cx, y) ורוחב (w)
// של המזרון בציור (390×844). המזרון של דגם מ-Meshy תופס בערך 61% מרוחב המסגרת ומרכזו ב-71% מגובהה, כשהמצלמה גבוהה כמו בציור (62°)
const NMG3D_YOGA_MATS = {
    'yg-fluffy': { cx: 128, y: 640, w: 118 },
    'yg-blob': { cx: 44, y: 614, w: 100 },
    'yg-spirit': { cx: 350, y: 614, w: 100 },
};
const NMG3D_MAT_IN_FRAME = { w: 0.61, y: 0.71, aspect: 260 / 300, phi: 62 };
function nmg3dYogaViewer(url, cls) {
    const mv = document.createElement('model-viewer');
    mv.className = cls;
    const attrs = {
        src: url, alt: '', 'disable-zoom': '', 'disable-pan': '', 'disable-tap': '', 'interaction-prompt': 'none',
        'shadow-intensity': '0', exposure: '1.1', 'environment-image': 'neutral',
        'camera-orbit': '0deg 76deg auto', 'field-of-view': '24deg', loading: 'eager', 'aria-hidden': 'true',
    };
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    return mv;
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
async function nmg3dUpgradeYoga(box) {
    if (!box || nmg3dReduced() || !nmg3dWebgl()) return;
    const view = box.querySelector('.srp-view');
    const svg = view && view.querySelector('svg.srp-scene');
    if (!svg) return;
    const glb = img => `world/3d/${(img.getAttribute('href') || '').split('/').pop().replace(/\.(png|jpe?g|webp)$/i, '')}.glb`;
    const sitters = [];
    for (const img of svg.querySelectorAll('image.yg-sitter, image.yg-eyes-closed')) if (await nmg3dExists(glb(img))) sitters.push(img);
    const open = svg.querySelector('image.yg-eyes-open');
    const openUrl = open && (await nmg3dExists(glb(open))) ? glb(open) : null;
    if ((!sitters.length && !openUrl) || !(await nmg3dLoadViewer()) || !box.isConnected) return;
    // היצורים (ו/או המורה בעיניים עצומות): מעל התמונה, באותו מקום בדיוק (התמונה ממלאת את המקום כולו). בזום של השיחה
    // הם מתחלפים חזרה לציורים, שזזים יחד עם הזום
    const placed = sitters.map((img, i) => {
        const name = (img.getAttribute('href') || '').split('/').pop().replace(/\.(png|jpe?g|webp)$/i, '');
        const mat = NMG3D_YOGA_MATS[name] || null;
        const wrap = document.createElement('div');
        wrap.className = `yg-3d${mat ? ' is-mat' : ''}`;
        wrap.style.setProperty('--d', `${(-1.2 * i).toFixed(1)}s`);
        const mv = nmg3dYogaViewer(glb(img), 'yg-3d-mv');
        if (mat) mv.setAttribute('camera-orbit', `0deg ${NMG3D_MAT_IN_FRAME.phi}deg auto`);
        mv.addEventListener('load', () => { wrap.dataset.ready = '1'; wrap.classList.add('is-ready'); if (!box.classList.contains('yg-zoomed')) img.classList.add('has-3d'); }, { once: true });
        wrap.appendChild(mv);
        box.appendChild(wrap);
        return { wrap, img, mat };
    });
    const layout = () => placed.forEach(p => { if (p.mat) nmg3dPlaceOnMat(p.wrap, p.mat, view); else nmg3dPlace(p.wrap, nmg3dSvgRect(svg, p.img, view)); });
    layout();
    // המורה בעיניים פקוחות: מחוץ לתמונה (שלא תימתח בזום) - מופיעה במקום שלה אחרי שהזום נגמר, ונעלמת כשמתרחקים
    let teacher = null;
    if (openUrl) {
        teacher = document.createElement('div');
        teacher.className = 'yg-3d yg-3d-teacher';
        const mv = nmg3dYogaViewer(openUrl, 'yg-3d-mv');
        mv.addEventListener('load', () => { teacher.dataset.ready = '1'; }, { once: true });
        teacher.appendChild(mv);
        box.appendChild(teacher);
        // גודל אמיתי מההתחלה (מודל בגודל 0 תוקע את הציור של כל שאר המודלים בעמוד)
        nmg3dPlace(teacher, nmg3dSvgRect(svg, open, view), NMG3D_TEACHER_FRAME);
    }
    let showT = 0;
    const sync = () => {
        if (!box.isConnected) { ro.disconnect(); mo.disconnect(); return; }
        const zoomed = box.classList.contains('yg-zoomed') && box.classList.contains('yg-awake');
        placed.forEach(p => { p.wrap.classList.toggle('is-away', zoomed); p.img.classList.toggle('has-3d', !zoomed && !!p.wrap.dataset.ready); });
        if (!teacher) return;
        clearTimeout(showT);
        if (!zoomed) { teacher.classList.remove('is-on'); open.classList.remove('has-3d'); return; }
        showT = setTimeout(() => {
            if (!box.isConnected || !box.classList.contains('yg-zoomed') || !teacher.dataset.ready) return;
            const br = box.getBoundingClientRect(), vr = view.getBoundingClientRect();
            const r = nmg3dSvgRect(svg, open, view);
            const k = vr.width / view.clientWidth;  // הזום (scale) של התמונה
            nmg3dPlace(teacher, { left: vr.left - br.left + r.left * k, top: vr.top - br.top + r.top * k, width: r.width * k, height: r.height * k }, NMG3D_TEACHER_FRAME);
            teacher.classList.add('is-on');
            open.classList.add('has-3d');
        }, nmg3dReduced() ? 0 : 1000);
    };
    const ro = new ResizeObserver(() => { layout(); sync(); });
    ro.observe(view);
    const mo = new MutationObserver(sync);
    mo.observe(box, { attributes: true, attributeFilter: ['class'] });
}

// ---------- 🧞 רוח היער בתלת־ממד ----------
// world/3d/genie.glb (2026-10-20, לפי בקשה מפורשת: "זה הגיני החדש שיצא מהבקבוק" / "שהוא מסתובב מהבקבוק תן לו מלא
// נצנצים שבקושי יראו"): עולה מהמנורה באותה ספירלה, מסתובב סביב עצמו (כמו רקדן, לא כמו גלגל) בתוך ענן צפוף של
// נצנצים שכמעט מסתיר אותו, ובסוף הנצנצים נמוגים והוא עומד מולנו לשאלות. נטען מראש כשנכנסים למרפסת
const NMG3D_GENIE = { url: 'world/3d/genie.glb', spinFrom: 1080, start: 400, spin: 5000, sparks: 110 };
const nmg3dGenieState = { ok: null };
function nmg3dPrepGenie() {
    if (nmg3dGenieState.ok !== null || nmg3dReduced() || !nmg3dWebgl()) return;
    nmg3dGenieState.ok = false;
    nmg3dExists(NMG3D_GENIE.url).then(ok => {
        if (!ok) return;
        nmg3dLoadViewer().then(v => {
            if (!v) return;
            nmg3dGenieState.ok = true;
            fetch(NMG3D_GENIE.url).catch(() => {});  // מחמם את המטמון - הדגם מוכן כשנוגעים במנורה
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
