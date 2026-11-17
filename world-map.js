// NOT10 Nourish+ - the world map (her pick 2026-11-08, into the app 2026-11-17: "לראות את המפה ולחבר אותה עם מה שעשינו
// עם המפה באותו מקום וכל פעם זה מתקדם קצת"). It replaces the old list of places in the Bag ("מפת העולם") with one tall
// painted map read from the bottom up: each painting melts into the next, a path of island-tile stones links the places,
// places ahead sit under drifting fog.
// - A stone = one day on target: at least one meal ✓ and the day's calories not over the plan (1,300 / 1,500, + what a workout
//   burned; a planned free-meal day counts). Today's stone is gold and lights once the day is over. 42 stones ≈ 6 weeks.
// - The stones come from the server (new_me_day_stats), so the journey is the same on every device and never goes back.
// - Walking the stones opens the places; the treasure inside each place opens with keys (finished challenges), exactly like
//   the secret room (roomUnlockAt). Tapping a place shows its painting; "Go in" enters the place in the app.
// - Sky (Me 1) stands on the last lit stone, turns slowly and hops on to new stones since the last visit.

const WM_STONES = [4, 5, 6, 6, 7, 7, 7];
const WM_ALL = WM_STONES.reduce((a, b) => a + b, 0);
// from the bottom up; app = the place in the app it opens (secret-places / the room); color = the stones lying on that painting
const WM_PLACES = [
    { key: 'gate', app: 'hall', img: 'forest-gate.jpg', sx: 0.5, sy: 0.68, color: '#9b5de5' },
    { key: 'forest', app: 'outside', img: 'forest-night.jpg', sx: 0.38, sy: 0.64, color: '#c95ccf', treasure: 'fire' },
    { key: 'waterfall', app: 'waterfall', img: 'waterfall.jpg', sx: 0.6, sy: 0.66, color: '#19a9a8', friend: { img: 'bottle.png', x: 0.3, y: 0.8, w: 0.1 }, treasure: 'bottle' },
    { key: 'dock', app: 'porch', img: 'lake-dock.jpg', sx: 0.42, sy: 0.72, color: '#4f7fe6', treasure: 'lamp' },
    { key: 'yoga', app: 'yoga', img: 'yoga.jpg', sx: 0.5, sy: 0.67, color: '#e0739f', treasure: 'yoga' },
    { key: 'music', app: 'music', img: 'music-hollow.jpg', sx: 0.38, sy: 0.72, color: '#ec7f63', treasure: 'music' },
    { key: 'treehouse', app: 'room', porthole: 'tree-desk.jpg', color: '#c27445', views: [['tree-desk.jpg', 'desk'], ['tree-bed.jpg', 'bed'], ['tree-shelf.jpg', 'shelf'], ['tree-fun.jpg', 'fun']], treasure: 'computer' },
    { key: 'treetop', app: 'roof', img: 'treetop.jpg', sx: 0.56, sy: 0.74, color: '#7a72e6', treasure: 'telescope' },
];
const WM_ICON = {
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    star: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l2.2 7.3 7.3 2.2-7.3 2.2L12 21.5l-2.2-7.3L2.5 12l7.3-2.2z"/></svg>',
    chest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 11h16v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 11a8 6 0 0 1 16 0"/><path d="M10.5 13.5h3v3h-3z"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    x: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
};

let wm = null; // the open map: { box, world, W, H, TOTAL, pts, segs, stonePts, sky, ... }

function wmReduce() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
function wmEsc(s) { return typeof nmEsc === 'function' ? nmEsc(s) : escapeHtmlForReport(s == null ? '' : String(s)); }
function wmFmt(n) { return typeof nmFmt === 'function' ? nmFmt(n) : String(n); }
function wmPlaceName(p) { return t('wm_place_' + p.key); }
function wmGoal() { return (typeof nmProfile !== 'undefined' && nmProfile && Number(nmProfile.plan)) || 1300; }
function wmSeenKey() { return `weekwise_wm_seen_${currentUserId}`; }
function wmDoneKey() { return `weekwise_wm_done_${currentUserId}`; }

// the days behind the stones: finished days (not today - it is still open) with ✓ on a meal and calories not over the plan
function wmGoodDays() {
    const today = getLocalDateString();
    const start = typeof nmStartDay === 'function' ? nmStartDay() : '0000-00-00';
    const goal = wmGoal();
    const stats = typeof nmStats !== 'undefined' && Array.isArray(nmStats) ? nmStats : [];
    return stats.filter(r => r.day >= start && r.day < today && (Number(r.checks) || 0) > 0
        && (r.free || ((Number(r.kcal) || 0) > 0 && Number(r.kcal) <= goal + (Number(r.burned) || 0))))
        .map(r => ({ day: r.day, kcal: Number(r.kcal) || 0, free: !!r.free }));
}
// total stones → which journey and how far along it (a finished map stays full until the next stone starts a new one)
function wmJourneyOf(total) {
    if (total > 0 && total % WM_ALL === 0) return { journey: total / WM_ALL, days: WM_ALL };
    return { journey: Math.floor(total / WM_ALL) + 1, days: total % WM_ALL };
}
function wmStateFor(d) {
    let open = 1, left = d;
    for (const n of WM_STONES) { if (left >= n) { left -= n; open++; } else break; }
    return { open, lit: open < WM_PLACES.length ? left : 0 };
}
function wmKeys() { return typeof nmgKeys === 'function' ? nmgKeys() : 0; }
function wmTreasureAt(i) { const p = WM_PLACES[i]; return p.app === 'hall' ? 0 : p.app === 'room' ? 1 : (typeof roomUnlockAt === 'function' ? roomUnlockAt(p.app) : Infinity); }
function wmTreasureOpen(i) { return i < wmStateFor(wm.days).open && wmKeys() >= wmTreasureAt(i); }
function wmDaysLeftText(n) { return n === 1 ? t('wm_days_left_one') : t('wm_days_left_many').replace('{n}', wmFmt(n)); }
function wmDate(day) {
    try { return new Date(day + 'T12:00:00').toLocaleDateString(currentLang, { weekday: 'short', day: 'numeric', month: 'numeric' }); } catch { return day; }
}

// ---------- open / close ----------
function wmOpen() {
    if (typeof nmgCloseBag === 'function') nmgCloseBag();
    if (typeof nmgCloseMap === 'function') nmgCloseMap();
    const box = document.createElement('div');
    box.id = 'nmg-map';
    box.className = 'wm';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', t('wm_title'));
    box.innerHTML = `<div class="wm-scroll"><main class="wm-world"></main></div>
        <header class="wm-top"><h2>${wmEsc(t('wm_title'))} <span class="wm-chip" hidden></span></h2><button type="button" class="wm-x" aria-label="${wmEsc(t('close_btn'))}">${WM_ICON.x}</button><p class="wm-rule"></p></header>
        <div class="wm-toast" role="status" hidden></div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(box);
    document.querySelector('.phone-wrapper')?.classList.add('nmg-map-open');
    box.querySelector('.wm-x').addEventListener('click', () => nmgCloseMap());
    const log = wmGoodDays();
    const total = log.length;
    const { journey, days } = wmJourneyOf(total);
    let seen = 0;
    try { seen = Number(localStorage.getItem(wmSeenKey())) || 0; } catch {}
    // new stones since the last visit (in this journey) are walked now, one by one - "every time it moves on a bit"
    const startDays = seen > 0 && seen < total && wmJourneyOf(seen).journey === journey ? wmJourneyOf(seen).days : days;
    wm = { box, scroll: box.querySelector('.wm-scroll'), world: box.querySelector('.wm-world'), log, total, journey, days: startDays, target: days, busy: false, skyTheta: 0, skyHeading: null, skyAct: null, skyNextAct: 0, skyLift: 0 };
    wmBuild();
    wmScrollTo(wmLightPoint().y, false);
    wmParallax();
    wm.scroll.addEventListener('scroll', wmOnScroll, { passive: true });
    window.addEventListener('resize', wmOnResize);
    wmLoad3d();
    requestAnimationFrame(wmSkyLife);
    wmCatchUp();
}
function wmClose() {
    window.removeEventListener('resize', wmOnResize);
    document.querySelectorAll('.wm-zoom, .wm-finish').forEach(x => x.remove());
    wm = null;
}

// ---------- build ----------
function wmIsle(state) {
    const poly = a => a.map(p => p.map(n => +n.toFixed(1)).join(',')).join(' ');
    const star = (cx, cy, R, r, n = 5) => poly(Array.from({ length: n * 2 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / n, d = i % 2 ? r : R; return [cx + d * Math.cos(a), cy + d * Math.sin(a)]; }));
    const ico = {
        done: '<path d="M33 48 L45 60 L67 37" class="ico-s"/>',
        current: `<polygon points="${star(50, 47, 18, 8)}" class="ico-f"/>`,
        locked: '<rect x="36" y="46" width="28" height="20" rx="6" class="ico-f"/><path d="M42 46 v-5 a8 8 0 0 1 16 0 v5" class="ico-s" style="stroke-width:6"/>',
    };
    return `<svg viewBox="2 6 96 84" aria-hidden="true">${state === 'current' ? '<ellipse cx="50" cy="40" rx="50" ry="34" class="halo"/>' : ''}`
        + '<polygon points="10,36 50,58 50,82 10,60" class="l rj"/><polygon points="90,36 50,58 50,82 90,60" class="l2 rj"/>'
        + '<polygon points="50,14 90,36 50,58 10,36" class="m rj"/><path d="M30 30 L50 19 L60 24" class="wl"/>'
        + `<g transform="translate(50 36) scale(.74 .48) translate(-50 -47)">${ico[state]}</g></svg>`;
}
function wmBuild() {
    const { world } = wm;
    const W = Math.min(wm.scroll.clientWidth || 412, 480), H = Math.round(W * 1376 / 768);
    const STEP = Math.round(H * 0.78), GAP = Math.round(H * 0.75);
    let u = 0, first = true;
    WM_PLACES.forEach((p, i) => {
        if (p.porthole) return;
        if (!first) u += STEP + (WM_PLACES[i - 1].porthole ? GAP : 0);
        first = false;
        p.u = u;
    });
    const TOTAL = u + H;
    Object.assign(wm, { W, H, TOTAL });
    world.style.setProperty('--w', W + 'px');
    world.style.height = TOTAL + 'px';
    world.innerHTML = '';
    const pts = [];
    WM_PLACES.forEach((p, i) => { if (!p.porthole) { p.top = TOTAL - p.u - H; pts[i] = { x: p.sx * W, y: p.top + p.sy * H }; } });
    WM_PLACES.forEach((p, i) => { if (p.porthole) pts[i] = { x: W / 2, y: WM_PLACES[i - 1].top + H * 0.02 }; });
    wm.pts = pts;
    WM_PLACES.forEach((p, i) => {
        if (p.porthole) {
            const d = Math.round(W * 0.62), g = Math.round(W * 1.05);
            world.insertAdjacentHTML('beforeend', `<div class="wm-porthole-glow" style="left:${pts[i].x - g / 2}px;top:${pts[i].y - g / 2}px;width:${g}px;height:${g}px"></div>`
                + `<div class="wm-porthole" data-i="${i}" style="left:${pts[i].x - d / 2}px;top:${pts[i].y - d / 2}px;width:${d}px;height:${d}px"><img class="wm-paint" src="world/${p.porthole}" alt="" loading="lazy"><div class="wm-fog"><i></i><i></i><i></i></div></div>`);
            return;
        }
        const f = p.friend ? `<img class="wm-friend" data-i="${i}" src="world/${p.friend.img}" alt="" style="left:${(p.friend.x - p.friend.w / 2) * W}px;top:${p.top + p.friend.y * H - p.friend.w * W}px;width:${p.friend.w * W}px">` : '';
        world.insertAdjacentHTML('beforeend', `<section class="wm-panel" data-i="${i}" style="top:${p.top}px;height:${H}px"><img class="wm-paint" src="world/${p.img}" alt="" ${i > 2 ? 'loading="lazy"' : ''}><div class="wm-fog"><i></i><i></i><i></i></div></section>${f}`);
    });
    WM_PLACES.forEach((p, i) => {
        if (p.porthole || i === 0) return;
        const prev = WM_PLACES[i - 1].porthole ? WM_PLACES[i - 2] : WM_PLACES[i - 1];
        const seam = (p.top + H + prev.top) / 2;
        world.insertAdjacentHTML('beforeend', `<div class="wm-mist" data-y="${seam}" style="top:${seam - H * 0.18}px;height:${H * 0.36}px"></div>`);
    });
    // the path: faint dots all the way, a soft glowing line for the way already walked
    let base = '', glow = '';
    for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], b = pts[i + 1], dy = (a.y - b.y) * 0.5;
        const d = `M${a.x},${a.y} C${a.x},${a.y - dy} ${b.x},${b.y + dy} ${b.x},${b.y}`;
        base += `<path class="base" d="${d}"/>`;
        glow += `<path class="lit" data-s="${i}" d="${d}"/>`;
    }
    world.insertAdjacentHTML('beforeend', `<svg class="wm-path" viewBox="0 0 ${W} ${TOTAL}" preserveAspectRatio="none" aria-hidden="true">${base}${glow}</svg>`);
    wm.segs = [...world.querySelectorAll('.wm-path .lit')];
    wm.segs.forEach(sg => { const len = sg.getTotalLength(); sg.style.strokeDasharray = len; sg.dataset.len = len; });
    // each stone takes the colour of the painting it lies on (the tree house around the porthole)
    const porthole = WM_PLACES.findIndex(p => p.porthole);
    const placeAt = y => {
        if (Math.abs(y - pts[porthole].y) < W * 0.36) return porthole;
        let best = porthole, dist = Infinity;
        WM_PLACES.forEach((p, i) => { if (p.porthole || y < p.top || y > p.top + H) return; const dd = Math.abs(y - (p.top + H / 2)); if (dd < dist) { dist = dd; best = i; } });
        return best;
    };
    let num = 0;
    wm.stonePts = WM_STONES.map((n, si) => Array.from({ length: n }, (_, k) => {
        const sg = wm.segs[si], len = +sg.dataset.len, at = (len - 34) * (k + 1) / (n + 1);
        const pt = sg.getPointAtLength(at);
        num++;
        world.insertAdjacentHTML('beforeend', `<button type="button" class="wm-stone" data-seg="${si}" data-k="${k}" data-n="${num}" style="left:${pt.x}px;top:${pt.y}px;--accent:${WM_PLACES[placeAt(pt.y)].color}"></button>`);
        return { x: pt.x, y: pt.y, at };
    }));
    world.querySelectorAll('.wm-stone').forEach(b => b.addEventListener('click', () => wmTapStone(+b.dataset.n)));
    WM_PLACES.forEach((p, i) => {
        world.insertAdjacentHTML('beforeend', `<button type="button" class="wm-station" data-i="${i}" style="left:${pts[i].x}px;top:${pts[i].y}px"></button><span class="wm-label" data-i="${i}" style="left:${pts[i].x}px;top:${pts[i].y}px"></span>`);
        if (p.treasure) {
            const side = pts[i].x < W / 2 ? 1 : -1;
            world.insertAdjacentHTML('beforeend', `<button type="button" class="wm-treasure" data-t="${i}" style="left:${pts[i].x + side * 52}px;top:${pts[i].y - 4}px"></button>`);
        }
    });
    world.querySelectorAll('.wm-station').forEach(b => b.addEventListener('click', () => wmTapPlace(+b.dataset.i, b)));
    world.querySelectorAll('.wm-treasure').forEach(b => b.addEventListener('click', () => wmTapTreasure(+b.dataset.t)));
    world.insertAdjacentHTML('beforeend', '<div class="wm-sky no-3d" aria-hidden="true"><i class="wm-sky-shadow"></i><div class="wm-sky-body"><div class="wm-sky-act"><div class="wm-sky-bob"><img src="world/3d/ava-me1.png" alt=""></div></div></div></div>');
    wm.sky = world.querySelector('.wm-sky');
    wm.sky.querySelector('.wm-sky-bob').addEventListener('click', () => { if (!wm.busy) wmSkyDo('loop', performance.now(), true); });
    if (wm.mv) { wm.sky.querySelector('.wm-sky-bob').appendChild(wm.mv); wm.sky.classList.toggle('has-3d', !!wm.mvLoaded); wm.sky.classList.toggle('no-3d', !wm.mvLoaded); }
    wmPaint(false);
    wmPlaceSky(wmLightPoint());
}

// ---------- state on screen ----------
function wmStone(n) { return wm.log[(wm.journey - 1) * WM_ALL + n - 1] || null; }
function wmPaint(animate) {
    const { world } = wm;
    const { open, lit } = wmStateFor(wm.days);
    WM_PLACES.forEach((p, i) => {
        const isOpen = i < open;
        world.querySelectorAll(`[data-i="${i}"]`).forEach(el => {
            if (el.classList.contains('wm-panel') || el.classList.contains('wm-porthole')) { el.classList.toggle('is-open', isOpen); el.classList.toggle('is-locked', !isOpen); }
            if (el.classList.contains('wm-friend')) el.classList.toggle('is-hidden', !wmTreasureOpen(i));
            if (el.classList.contains('wm-label')) {
                el.classList.toggle('is-locked', !isOpen);
                const left = WM_STONES.slice(0, i).reduce((a, b) => a + b, 0) - wm.days;
                el.innerHTML = i === open && left > 0 ? `${wmEsc(wmPlaceName(p))} <span class="wm-left">· ${wmEsc(t('wm_left').replace('{n}', wmFmt(left)))}</span>` : wmEsc(wmPlaceName(p));
            }
            if (el.classList.contains('wm-station')) {
                el.classList.toggle('is-open', isOpen);
                el.classList.toggle('is-locked', !isOpen);
                el.classList.toggle('is-here', i === open - 1);
                el.innerHTML = isOpen ? WM_ICON.star : WM_ICON.lock;
                el.setAttribute('aria-label', isOpen ? wmPlaceName(p) : `${wmPlaceName(p)} – ${t('wm_fog')}`);
            }
        });
        const tb = world.querySelector(`.wm-treasure[data-t="${i}"]`);
        if (tb) {
            tb.hidden = !isOpen;
            const on = wmTreasureOpen(i);
            tb.classList.toggle('is-open', on);
            tb.innerHTML = on ? WM_ICON.chest : WM_ICON.lock;
            tb.setAttribute('aria-label', t('wm_tr_' + p.treasure));
        }
    });
    world.querySelectorAll('.wm-stone').forEach(st => {
        const n = +st.dataset.n, on = n <= wm.days;
        const state = on ? 'done' : n === wm.days + 1 ? 'current' : 'locked';
        if (st.dataset.state !== state) { st.dataset.state = state; st.className = `wm-stone st-${state}`; st.innerHTML = wmIsle(state); }
        st.setAttribute('aria-label', t('wm_stone_n').replace('{n}', wmFmt(n)));
    });
    wm.segs.forEach((sg, i) => {
        if (!animate) sg.style.transition = 'none';
        const len = +sg.dataset.len;
        const walked = i < open - 1 ? len : i === open - 1 && lit > 0 ? wm.stonePts[i][lit - 1].at : 0;
        sg.style.strokeDashoffset = len - walked;
    });
    wm.box.querySelector('.wm-rule').innerHTML = `<b>✦ ${wmEsc(t('wm_rule').replace('{kcal}', wmFmt(wmGoal())))}</b> · <span class="nw">${wmEsc(t('wm_count').replace('{n}', wmFmt(wm.days)).replace('{total}', wmFmt(WM_ALL)))}</span> · <span class="nw">🔑 ${wmFmt(wmKeys())}</span>`;
    const chip = wm.box.querySelector('.wm-chip');
    chip.hidden = wm.journey < 2;
    chip.textContent = t('wm_journey').replace('{n}', wmFmt(wm.journey));
}

// ---------- Sky ----------
const WM_SKY_ACTS = { spin: 1100, hop: 700, look: 2200, loop: 1500, wiggle: 900 };
function wmRestAt(si, lit) { return lit > 0 ? wm.stonePts[si][lit - 1].at : 0; }
function wmBesidePlace(i) { return (wm.pts[i].x < wm.W / 2 ? -1 : 1) * 46; }
function wmLightPoint() {
    const { open, lit } = wmStateFor(wm.days);
    if (open >= WM_PLACES.length || lit === 0) return { x: wm.pts[open - 1].x + wmBesidePlace(open - 1), y: wm.pts[open - 1].y };
    return wm.segs[open - 1].getPointAtLength(wmRestAt(open - 1, lit));
}
function wmPlaceSky(pt, lift = 0) {
    wm.sky.style.transform = `translate(${pt.x - 54}px, ${pt.y - 91}px)`;
    wm.sky.style.setProperty('--lift', `${lift.toFixed(1)}px`);
    wm.skyLift = lift;
}
// the same 3D Sky as in the hall (world/3d/me1.glb), when the device can show it; the picture made from it until then
async function wmLoad3d() {
    const mine = wm;
    if (!mine || wmReduce() || typeof nmg3dLoadViewer !== 'function' || (typeof nmg3dWebgl === 'function' && !nmg3dWebgl()) || (typeof nmg3dSlowNet === 'function' && nmg3dSlowNet())) return;
    if (!(await nmg3dLoadViewer()) || wm !== mine) return;
    const mv = document.createElement('model-viewer');
    const attrs = { src: 'world/3d/me1.glb', alt: '', 'disable-zoom': '', 'disable-pan': '', 'disable-tap': '', 'interaction-prompt': 'none', 'shadow-intensity': '0', exposure: '1.1', 'environment-image': 'neutral', 'camera-orbit': '0deg 78deg auto', loading: 'eager' };
    Object.entries(attrs).forEach(([k, v]) => mv.setAttribute(k, v));
    mv.addEventListener('load', () => { if (wm !== mine) return; mine.mvLoaded = true; mine.sky.classList.add('has-3d'); mine.sky.classList.remove('no-3d'); }, { once: true });
    mine.mv = mv;
    mine.sky.querySelector('.wm-sky-bob').appendChild(mv);
}
function wmSkyDo(name, now, sparkle) {
    wm.skyAct = { name, t0: now, dur: WM_SKY_ACTS[name], side: Math.random() < 0.5 ? -1 : 1 };
    if (sparkle || name === 'loop') {
        const r = wm.sky.getBoundingClientRect(), w = wm.world.getBoundingClientRect();
        wmBurst({ x: r.left - w.left + r.width / 2, y: r.top - w.top + r.height * 0.4 }, 12, 30);
    }
}
function wmTurnToward(cur, target, k) { return cur + (((((target - cur) % 360) + 540) % 360) - 180) * k; }
function wmSkyLife(now) {
    if (!wm || !wm.box.isConnected) return;
    let turn = 0, act = 0;
    if (wm.skyHeading != null) {
        wm.skyTheta = wmTurnToward(wm.skyTheta, wm.skyHeading, 0.2);
        wm.skyAct = null;
        wm.skyNextAct = now + 2500;
    } else {
        wm.skyTheta = wmTurnToward(wm.skyTheta, Math.sin(now / 1500) * 16, 0.06);
        if (!wm.skyAct && !wmReduce() && now > wm.skyNextAct) { const names = Object.keys(WM_SKY_ACTS); wmSkyDo(names[Math.floor(Math.random() * names.length)], now); }
        if (wm.skyAct) {
            const a = wm.skyAct, k = Math.min(1, (now - a.t0) / a.dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2, up = Math.sin(Math.PI * k);
            if (a.name === 'spin') turn = 360 * e * a.side;
            if (a.name === 'hop') act = up * 22;
            if (a.name === 'look') turn = a.side * 80 * up;
            if (a.name === 'loop') { turn = 360 * e; act = up * 34; }
            if (a.name === 'wiggle') turn = Math.sin(k * Math.PI * 4) * 22 * (1 - k);
            if (k >= 1) { wm.skyAct = null; wm.skyNextAct = now + 3000 + Math.random() * 4000; }
        }
    }
    const theta = wm.skyTheta + turn;
    if (wm.mv) wm.mv.cameraOrbit = `${theta.toFixed(1)}deg 78deg auto`;
    wm.sky.style.setProperty('--act', `${act.toFixed(1)}px`);
    wm.sky.style.setProperty('--sh', Math.max(0.35, 1 - (wm.skyLift + act) / 70).toFixed(2));
    wm.sky.style.setProperty('--turn', `${(-theta).toFixed(1)}deg`);
    requestAnimationFrame(wmSkyLife);
}
function wmSkyLand() {
    wm.skyHeading = 0;
    clearTimeout(wm.landTimer);
    const mine = wm;
    wm.landTimer = setTimeout(() => { if (mine) mine.skyHeading = null; }, 1600);
}

// ---------- moving on ----------
function wmWait(ms) { return new Promise(r => setTimeout(r, ms)); }
function wmScrollTo(y, smooth) { wm.scroll.scrollTo({ top: wm.world.offsetTop + y - wm.scroll.clientHeight * 0.55, behavior: smooth && !wmReduce() ? 'smooth' : 'auto' }); }
function wmWalk(seg, fromAt, toAt, dur, pathFrom, dx0 = 0, dx1 = 0) {
    const len = +seg.dataset.len, t0 = performance.now(), mine = wm;
    seg.style.transition = 'none';
    const at0 = seg.getPointAtLength(fromAt);
    let prev = { x: at0.x + dx0, y: at0.y };
    return new Promise(done => {
        const step = now => {
            if (wm !== mine) { done(); return; }
            const k = dur ? Math.min(1, (now - t0) / dur) : 1;
            const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
            if (pathFrom != null) seg.style.strokeDashoffset = len - (pathFrom + (toAt - pathFrom) * e);
            const on = seg.getPointAtLength(fromAt + (toAt - fromAt) * e);
            const p = { x: on.x + dx0 + (dx1 - dx0) * e, y: on.y };
            if (dur && Math.hypot(p.x - prev.x, p.y - prev.y) > 0.5) { wm.skyHeading = -Math.atan2(p.x - prev.x, p.y - prev.y) * 180 / Math.PI; prev = p; }
            wmPlaceSky(p, dur ? Math.sin(Math.PI * k) * 26 : 0);
            if (dur) wm.scroll.scrollTop = wm.world.offsetTop + p.y - wm.scroll.clientHeight * 0.55;
            if (k < 1) requestAnimationFrame(step); else done();
        };
        requestAnimationFrame(step);
    });
}
// the stones lit since the last visit are walked now (up to 4 with the hop, the rest at once), then a place that opened says so
async function wmCatchUp() {
    const mine = wm;
    const reduce = wmReduce();
    if (wm.days < wm.target) {
        wm.busy = true;
        await wmWait(reduce ? 0 : 700);
        while (wm === mine && wm.days < wm.target) {
            const quick = wm.target - wm.days > 4;
            await wmStepOn(quick || reduce);
        }
        if (wm !== mine) return;
        wm.busy = false;
    }
    try { localStorage.setItem(wmSeenKey(), String(wm.total)); } catch {}
    // the whole map done: a new journey (and maybe a new menu with it) - asked once per journey
    if (wm.days >= WM_ALL) {
        let asked = 0;
        try { asked = Number(localStorage.getItem(wmDoneKey())) || 0; } catch {}
        if (asked < wm.journey) { await wmWait(reduce ? 0 : 900); if (wm === mine) wmAskNewJourney(); }
    }
}
async function wmStepOn(quick) {
    const before = wmStateFor(wm.days);
    const si = before.open - 1, seg = wm.segs[si], n = WM_STONES[si];
    const fromAt = before.lit > 0 ? wm.stonePts[si][before.lit - 1].at : 0;
    const target = wm.stonePts[si][before.lit];
    if (!quick) { wmScrollTo(target.y, true); await wmWait(450); }
    await wmWalk(seg, wmRestAt(si, before.lit), target.at, quick ? 0 : 700, fromAt, before.lit === 0 ? wmBesidePlace(si) : 0);
    if (!wm) return;
    wm.days++;
    wmPaint(true);
    const st = wm.world.querySelector(`.wm-stone[data-seg="${si}"][data-k="${before.lit}"]`);
    if (st && !quick) { st.classList.add('pop'); setTimeout(() => st.classList.remove('pop'), 350); wmBurst(target, 10, 22); }
    if (before.lit + 1 < n) {
        if (!quick) {
            wmSkyLand();
            const d = wmStone(wm.days);
            if (d) wmToast(`${t('wm_stone_lit').replace('{kcal}', wmFmt(d.kcal)).replace('{goal}', wmFmt(wmGoal()))} ✦ ${wmDaysLeftText(n - before.lit - 1)} · ${wmPlaceName(WM_PLACES[si + 1])}`);
            await wmWait(900);
        }
    } else {
        // the last stone of the way: one more hop on to the place, the fog lifts
        if (!quick) await wmWait(250);
        await wmWalk(seg, target.at, +seg.dataset.len, quick ? 0 : 600, target.at, 0, wmBesidePlace(si + 1));
        if (!wm) return;
        wmPaint(true);
        wmPlaceSky(wmLightPoint());
        if (!quick) { wmBurst(wm.pts[si + 1]); wmSkyLand(); }
        wmToast(t('wm_new_place').replace('{place}', wmPlaceName(WM_PLACES[si + 1])));
        if (!quick) await wmWait(1400);
    }
}
function wmBurst(pt, count = 22, spread = 50) {
    if (!wm || wmReduce()) return;
    const colors = ['#f5c76b', '#fff3c4', '#c9b2ff', '#ff9ecf', '#ffffff'];
    const el = document.createElement('div');
    el.className = 'wm-burst';
    el.style.left = pt.x + 'px';
    el.style.top = pt.y + 'px';
    el.innerHTML = Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2, d = spread + Math.random() * spread * 0.9;
        return `<i style="--dx:${(Math.cos(a) * d).toFixed(1)}px;--dy:${(Math.sin(a) * d).toFixed(1)}px;--c:${colors[i % colors.length]}"></i>`;
    }).join('');
    wm.world.appendChild(el);
    setTimeout(() => el.remove(), 1500);
}
function wmToast(text) {
    if (!wm) return;
    const el = wm.box.querySelector('.wm-toast');
    el.textContent = text;
    el.hidden = false;
    clearTimeout(wm.toastTimer);
    wm.toastTimer = setTimeout(() => { el.hidden = true; }, 3000);
}

// ---------- taps ----------
function wmTapStone(n) {
    if (n <= wm.days) {
        const d = wmStone(n);
        if (!d) return;
        wmToast(t(d.free ? 'wm_stone_free' : 'wm_stone_done').replace('{n}', wmFmt(n)).replace('{date}', wmDate(d.day)).replace('{kcal}', wmFmt(d.kcal)).replace('{goal}', wmFmt(wmGoal())));
    } else if (n === wm.days + 1) wmToast(t('wm_stone_today').replace('{n}', wmFmt(n)));
    else wmToast(t('wm_stone_ahead').replace('{n}', wmFmt(n)));
}
function wmTapTreasure(i) {
    const p = WM_PLACES[i];
    if (wmTreasureOpen(i)) { wmEnter(i); return; }
    const left = Math.max(1, wmTreasureAt(i) - wmKeys());
    wmToast(`${t('wm_tr_' + p.treasure)} · 🔑 ${typeof roomKeysLeftText === 'function' ? roomKeysLeftText(left) : left}`);
}
function wmEnter(i) {
    const p = WM_PLACES[i];
    if (typeof nmgMapGo === 'function') nmgMapGo(p.app);
}
function wmTapPlace(i, btn) {
    const { open } = wmStateFor(wm.days);
    if (i >= open) {
        const left = WM_STONES.slice(0, i).reduce((a, b) => a + b, 0) - wm.days;
        wmToast(i === open && left > 0 ? `${t('wm_fog')} · ${wmDaysLeftText(left)}` : t('wm_fog'));
        return;
    }
    const p = WM_PLACES[i], r = btn.getBoundingClientRect();
    const canEnter = wmTreasureOpen(i) || p.app === 'hall';
    const z = document.createElement('div');
    z.className = 'wm-zoom';
    z.setAttribute('role', 'dialog');
    z.setAttribute('aria-label', wmPlaceName(p));
    const br = wm.box.getBoundingClientRect();
    z.style.setProperty('--ox', `${r.left - br.left + r.width / 2}px`);
    z.style.setProperty('--oy', `${r.top - br.top + r.height / 2}px`);
    const views = p.views || [[p.img, '']];
    const many = views.length > 1;
    z.innerHTML = `<div class="wm-zoom-art"><div class="wm-zoom-bg"></div><div class="wm-zoom-frame">
            <div class="wm-rooms">${views.map(([img, name]) => `<div class="wm-room"><img src="world/${img}" alt="">${name ? `<span>${wmEsc(t('wm_room_' + name))}</span>` : ''}</div>`).join('')}</div>
            ${many ? `<button type="button" class="wm-room-nav prev" aria-label="${wmEsc(t('wm_room_prev'))}">${WM_ICON.chev}</button><button type="button" class="wm-room-nav next" aria-label="${wmEsc(t('wm_room_next'))}">${WM_ICON.chev}</button>` : ''}
        </div></div>
        <div class="wm-zoom-bar"><h3>${wmEsc(wmPlaceName(p))}</h3><div class="wm-zoom-btns">${canEnter ? `<button type="button" class="wm-btn primary wm-go">${wmEsc(t('wm_enter'))}</button>` : `<button type="button" class="wm-btn wm-lockinfo">🔑 ${wmEsc(t('wm_tr_' + p.treasure))}</button>`}<button type="button" class="wm-btn wm-back">${wmEsc(t('wm_back'))}</button></div></div>`;
    wm.box.appendChild(z);
    const roomsEl = z.querySelector('.wm-rooms'), roomEls = [...z.querySelectorAll('.wm-room')], bg = z.querySelector('.wm-zoom-bg');
    let cur = 0;
    const show = () => {
        bg.style.backgroundImage = `url('world/${views[cur][0]}')`;
        z.querySelectorAll('.wm-room-nav').forEach(b => { b.disabled = b.classList.contains('prev') ? cur === 0 : cur === views.length - 1; });
    };
    const go = k => { cur = Math.max(0, Math.min(views.length - 1, k)); roomEls[cur].scrollIntoView({ behavior: wmReduce() ? 'auto' : 'smooth', block: 'nearest', inline: 'start' }); show(); };
    roomsEl.addEventListener('scroll', () => {
        const c = roomsEl.getBoundingClientRect(), mid = c.left + c.width / 2;
        let k = 0, d = Infinity;
        roomEls.forEach((el, j) => { const rr = el.getBoundingClientRect(), dd = Math.abs(rr.left + rr.width / 2 - mid); if (dd < d) { d = dd; k = j; } });
        if (k !== cur) { cur = k; show(); }
    }, { passive: true });
    z.querySelector('.wm-room-nav.prev')?.addEventListener('click', () => go(cur - 1));
    z.querySelector('.wm-room-nav.next')?.addEventListener('click', () => go(cur + 1));
    show();
    const rtl = document.documentElement.dir === 'rtl';
    const onKey = e => {
        if (e.key === 'Escape') close();
        else if (many && e.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) go(cur + 1);
        else if (many && e.key === (rtl ? 'ArrowRight' : 'ArrowLeft')) go(cur - 1);
    };
    const close = () => { z.remove(); document.removeEventListener('keydown', onKey); try { btn.focus({ preventScroll: true }); } catch {} };
    z.querySelector('.wm-back').addEventListener('click', close);
    z.querySelector('.wm-go')?.addEventListener('click', () => { close(); wmEnter(i); });
    z.querySelector('.wm-lockinfo')?.addEventListener('click', () => wmTapTreasure(i));
    document.addEventListener('keydown', onKey);
    (z.querySelector('.wm-go') || z.querySelector('.wm-back')).focus();
}
// the end of the map (42 days on target, about 6 weeks): the next stone starts a new journey - with the same menu or a new one
function wmAskNewJourney() {
    const f = document.createElement('div');
    f.className = 'wm-finish';
    f.setAttribute('role', 'dialog');
    f.setAttribute('aria-modal', 'true');
    f.innerHTML = `<div class="wm-finish-card"><h3>✦ ${wmEsc(t('wm_done_title'))}</h3><p>${wmEsc(t('wm_done_text').replace('{n}', wmFmt(WM_ALL)))}</p><div class="wm-row"><button type="button" class="wm-btn primary" data-a="same">${wmEsc(t('wm_same_menu'))}</button><button type="button" class="wm-btn" data-a="menu">${wmEsc(t('wm_new_menu'))}</button></div></div>`;
    wm.box.appendChild(f);
    f.querySelector('.wm-btn').focus();
    f.addEventListener('click', e => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (!a) return;
        try { localStorage.setItem(wmDoneKey(), String(wm.journey)); } catch {}
        f.remove();
        if (a === 'menu' && typeof nmStartMenuQuiz === 'function') { nmgCloseMap(); nmStartMenuQuiz('map'); }
        else wmToast(t('wm_next_journey').replace('{n}', wmFmt(wm.journey + 1)));
    });
}

// ---------- scroll depth + resize ----------
let wmTicking = false;
function wmParallax() {
    wmTicking = false;
    if (!wm) return;
    const mid = wm.scroll.scrollTop + wm.scroll.clientHeight / 2 - wm.world.offsetTop;
    wm.world.querySelectorAll('.wm-mist').forEach(m => { m.style.transform = `translateY(${((+m.dataset.y - mid) * 0.18).toFixed(1)}px)`; });
}
function wmOnScroll() { if (!wmTicking && !wmReduce()) { wmTicking = true; requestAnimationFrame(wmParallax); } }
let wmResizeTimer = 0;
function wmOnResize() {
    clearTimeout(wmResizeTimer);
    wmResizeTimer = setTimeout(() => {
        if (!wm || wm.busy || !wm.box.isConnected) return;
        if (Math.min(wm.scroll.clientWidth, 480) !== wm.W) { wmBuild(); wmScrollTo(wmLightPoint().y, false); wmParallax(); }
    }, 200);
}
