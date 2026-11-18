// NOT10 Nourish+ is loaded only when needed (her OK 2026-11-17: "לטעון אותו רק כשצריך - כן תעשה אותו").
// The 8 Nourish+/world files (~380 KB compressed) used to load for everyone on every first visit. Now:
// - owners (hasNewMe) get them in the background right after sign-in (even earlier when this device remembers they own it);
// - everyone else loads them only when they open NOT10 Nourish+, the quotes or the quick book-page sheet.
// Also here (not in new-me.js) because the whole app uses it: the styled time picker (nmTimeBtnHtml & co.).
// ⚠️ When one of these files changes, bump its ?v= HERE (they are no longer in index.html).
const NOURISH_SCRIPTS = [
    'new-me-data.js?v=21',
    'new-me.js?v=89',
    'new-me-challenges.js?v=15',
    'secret-room.js?v=39',
    'secret-places.js?v=34',
    'new-me-game.js?v=20',
    'world3d.js?v=16',
    'world-map.js?v=1',
];
let nourishPromise = null;
function nourishLoaded() { return typeof renderNewMe === 'function'; }
function nourishOwnerKey() { return `weekwise_has_nourish_${typeof currentUserId !== 'undefined' ? currentUserId : ''}`; }
function loadScriptOnce(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.async = false; // keep the order (data → program → challenges → room → places → game → 3D → map)
        s.onload = () => resolve();
        s.onerror = () => { s.remove(); reject(new Error('load ' + src)); };
        document.body.appendChild(s);
    });
}
// loads all the files once, in order; resolves true when Nourish+ is ready (false if the network failed - tried again next time)
function ensureNourish() {
    if (nourishLoaded()) return Promise.resolve(true);
    if (!nourishPromise) {
        nourishPromise = NOURISH_SCRIPTS.reduce((p, src) => p.then(() => loadScriptOnce(src)), Promise.resolve())
            .then(() => {
                if (window.__nmDeepLink && typeof nmPendingDeepLink !== 'undefined') { nmPendingDeepLink = true; window.__nmDeepLink = false; }
                document.dispatchEvent(new CustomEvent('nourish-loaded'));
                return true;
            })
            .catch(() => { nourishPromise = null; return false; });
    }
    return nourishPromise;
}
// calls a Nourish+ function, loading Nourish+ first if needed (for things people tap)
function nourishCall(name, ...args) {
    const real = () => (typeof window[name] === 'function' && !window[name].__nourishStub ? window[name] : null);
    if (nourishLoaded() && real()) return real()(...args);
    return ensureNourish().then(ok => { const fn = ok && real(); return fn ? fn(...args) : undefined; });
}
// after the purchase status is known (loadPremiumStatus): owners get Nourish+ now and everything it shows (home tile,
// My Day meals, challenges, the meal-reminder deep link) through its own updateNewMeShortcut; others only get the lock
function nourishAfterStatus() {
    try { localStorage.setItem(nourishOwnerKey(), hasNewMe ? '1' : '0'); } catch { /* not important */ }
    if (hasNewMe) {
        // already here = loadPremiumStatus just ran updateNewMeShortcut itself
        if (!nourishLoaded()) ensureNourish().then(ok => { if (ok && typeof updateNewMeShortcut === 'function') updateNewMeShortcut(); });
    } else if (!nourishLoaded()) {
        document.querySelectorAll('.hamburger-newme-item').forEach(b => b.classList.add('locked'));
        document.getElementById('btn-newme-shortcut')?.classList.add('hidden');
    }
}
// owners on this device: start loading as soon as the login is known, before the status even arrives
function nourishPreloadIfOwner() {
    try { if (localStorage.getItem(nourishOwnerKey()) === '1') ensureNourish(); } catch { /* not important */ }
}

// stand-ins for the entry points that the page itself calls (onclick in index.html, checkout return): load, then run the
// real one. new-me.js declares the real functions with the same names, so once it loads these are replaced
function openNewMeFromHome(...args) { return nourishCall('openNewMeFromHome', ...args); }
function openDiaryFromMenu(...args) { return nourishCall('openDiaryFromMenu', ...args); }
function handleNewMeCheckoutReturn(...args) { return nourishCall('handleNewMeCheckoutReturn', ...args); }
function roomOpenQuotes(...args) { return nourishCall('roomOpenQuotes', ...args); }
// marked, so a stand-in never calls itself if the real function is missing
[openNewMeFromHome, openDiaryFromMenu, handleNewMeCheckoutReturn, roomOpenQuotes].forEach(f => { f.__nourishStub = true; });

// ---------- the styled time picker (used everywhere: My Routine, reminders, shopping, workouts, Nourish+) ----------
// לפי בקשה מפורשת ("יש חלון בלי עיצוב בכלל של השעות"): במקום בורר השעה של הדפדפן - כפתור עם השעה, ונגיעה פותחת
// מתחת לשורה את השעות (00–23) ואת הדקות (כל 5 דקות, ו"אחר" לדקה מדויקת). כל בחירה נכנסת מיד; דקות - וזה נסגר
const nmTimePickHandlers = {};
function nmTpEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function nmTimeBtnHtml(id, value, label, onPick, disabled) {
    nmTimePickHandlers[id] = onPick;
    return `<button type="button" class="nm-time-btn" data-time-id="${nmTpEsc(id)}" aria-expanded="false" aria-label="${nmTpEsc(label)}" ${disabled ? 'disabled' : ''} onclick="nmToggleTimePicker(this)"><bdi dir="ltr">${nmTpEsc(value)}</bdi></button>`;
}
function nmCloseTimePickers() {
    document.querySelectorAll('.nm-time-picker').forEach(p => p.remove());
    document.querySelectorAll('.nm-time-btn.is-open').forEach(b => { b.classList.remove('is-open'); b.setAttribute('aria-expanded', 'false'); });
}
function nmToggleTimePicker(btn) {
    const wasOpen = btn.classList.contains('is-open');
    nmCloseTimePickers();
    if (wasOpen || btn.disabled) return;
    const pad = n => String(n).padStart(2, '0');
    let [h, m] = (btn.textContent.trim().match(/^\d{2}:\d{2}$/) ? btn.textContent.trim() : '12:00').split(':');
    const picker = document.createElement('div');
    picker.className = 'nm-time-picker';
    picker.innerHTML = `
        <span class="nm-time-label">${nmTpEsc(t('nm_time_hour'))}</span>
        <div class="nm-time-grid" role="group" aria-label="${nmTpEsc(t('nm_time_hour'))}">${Array.from({ length: 24 }, (_, i) => pad(i)).map(v => `<button type="button" class="nm-time-chip" data-h="${v}"><bdi dir="ltr">${v}</bdi></button>`).join('')}</div>
        <span class="nm-time-label">${nmTpEsc(t('nm_time_minutes'))}</span>
        <div class="nm-time-grid" role="group" aria-label="${nmTpEsc(t('nm_time_minutes'))}">${Array.from({ length: 12 }, (_, i) => pad(i * 5)).map(v => `<button type="button" class="nm-time-chip" data-m="${v}"><bdi dir="ltr">:${v}</bdi></button>`).join('')}<button type="button" class="nm-time-chip nm-time-other" data-other>${nmTpEsc(t('nm_other'))}</button></div>
        <div class="nm-time-exact hidden"><input type="text" inputmode="numeric" maxlength="2" class="nm-time-exact-input" aria-label="${nmTpEsc(t('nm_time_minutes'))}"><button type="button" class="nm-time-chip on" data-exact>✓</button></div>`;
    (btn.closest('.nm-rem-row') || btn.parentElement).after(picker);
    btn.classList.add('is-open');
    btn.setAttribute('aria-expanded', 'true');
    const mark = () => {
        picker.querySelectorAll('[data-h]').forEach(x => { const on = x.dataset.h === h; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        picker.querySelectorAll('[data-m]').forEach(x => { const on = x.dataset.m === m; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        picker.querySelector('[data-other]').classList.toggle('on', Number(m) % 5 !== 0);
    };
    const apply = close => {
        const v = `${h}:${m}`;
        btn.querySelector('bdi').textContent = v;
        const fn = nmTimePickHandlers[btn.dataset.timeId];
        if (fn) fn(v);
        mark();
        if (close) { nmCloseTimePickers(); btn.focus({ preventScroll: true }); }
    };
    mark();
    picker.querySelectorAll('[data-h]').forEach(x => x.addEventListener('click', () => { h = x.dataset.h; apply(false); }));
    picker.querySelectorAll('[data-m]').forEach(x => x.addEventListener('click', () => { m = x.dataset.m; apply(true); }));
    const exactBox = picker.querySelector('.nm-time-exact'), exactIn = picker.querySelector('.nm-time-exact-input');
    picker.querySelector('[data-other]').addEventListener('click', () => { exactBox.classList.remove('hidden'); exactIn.value = m; exactIn.focus(); exactIn.select(); });
    const exactOk = () => { const v = parseInt(exactIn.value, 10); if (!(v >= 0 && v <= 59)) { exactIn.focus(); return; } m = pad(v); apply(true); };
    picker.querySelector('[data-exact]').addEventListener('click', exactOk);
    exactIn.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); exactOk(); } });
    const on = picker.querySelector('[data-h].on');
    if (on) on.focus({ preventScroll: true });
}
