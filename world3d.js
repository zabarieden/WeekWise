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
