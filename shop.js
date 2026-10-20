// 🛒 רשימת קניות חכמה (2026-10-20, לפי בקשה מפורשת: "רשימת קניות לעשות חכם יותר כמו 2 כפתורים עם אחד מחיקה חד פעמית
// ואחת להשתמש אחר כך... אולי גם המשלוח בדרך הכל הגיע? ואם לא אז מה לא הגיע לרשום ואז זה חוזר לרשימה", ובחירתה:
// "✕ פעם אחת · ↺ לפעם הבאה", משלוח בדרך, מחלקות בסופר, כמות ושיתוף, הצעות חכמות).
// מצב כל פריט ב-my_center_tasks (task_type='general', is_deleted=false):
//   ברשימה     - is_completed=false, shop_state ריק
//   בדרך       - shop_state='transit' (+ transit_due = היום שבו המשלוח מגיע)
//   קונים שוב  - is_completed=true (shop_state='again'; גם פריט ישן שסומן ✓ לפני התכונה, או ✓ בעמוד מחברת מקושר)
// ✕ = נקנה ויוצא (לארכיון, כמו מחיקה עד היום); ↺ = נקנה ומחכה בשורת "קונים שוב" - נגיעה מחזירה אותו לרשימה

let shopItemsCache = [];
let shopAgainManage = false;
let shopDueKey = '';
const SHOP_ICONS = {
    again: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4.5v4.2h4.2"/></svg>',
    once: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 6.5h11v9h-11z"/><path d="M13.5 9.5h4l3 3.2v2.8h-7"/><circle cx="6.5" cy="17.2" r="1.7"/><circle cx="17" cy="17.2" r="1.7"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.2 10.8l7.6-4.1M8.2 13.2l7.6 4.1"/></svg>',
};

function shopNorm(s) { return String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(); }
function shopEsc(s) { return escapeHtmlForReport(String(s ?? '')); }
function shopIsAgain(it) { return !!it.is_completed; }
function shopIsTransit(it) { return !it.is_completed && it.shop_state === 'transit'; }
function shopIsActive(it) { return !it.is_completed && it.shop_state !== 'transit'; }
function shopQtyOf(it) { return Math.max(1, Math.min(99, Number(it.quantity) || 1)); }

// ---------- המחלקות (shop-depts.js) ----------
// עברית ואנגלית בפנים; שאר השפות - shop-depts/<lang>.js, נטען רק כשהאפליקציה בשפה הזו (ואז הרשימה מתסדרת מחדש)
const shopDeptLoading = {};
function shopEnsureDeptLang(lang) {
    if (!lang || typeof SHOP_DEPT_WORDS === 'undefined' || SHOP_DEPT_WORDS[lang]) return Promise.resolve(true);
    if (!shopDeptLoading[lang]) {
        shopDeptLoading[lang] = new Promise(resolve => {
            const s = document.createElement('script');
            s.src = `shop-depts/${lang}.js?v=1`;
            s.onload = () => { delete shopDeptMatchers[lang]; resolve(!!SHOP_DEPT_WORDS[lang]); };
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
    }
    return shopDeptLoading[lang];
}
// אותיות שנכתבות בכמה דרכים: צורה אחידה (NFC), גרש אחד, İ טורקית, ş/ţ רומניות עם פסיק מתחת
function shopNormFor(s, lang) {
    let x = String(s || '').normalize('NFC').replace(/[’ʼ]/g, "'");
    x = (lang === 'tr' ? x.toLocaleLowerCase('tr') : x.toLowerCase()).replace(/̇/g, '');
    if (lang === 'ro') x = x.replace(/ş/g, 'ș').replace(/ţ/g, 'ț');
    return x.trim().replace(/\s+/g, ' ');
}
const shopDeptMatchers = {};
function shopDeptMatchersFor(lang) {
    if (shopDeptMatchers[lang]) return shopDeptMatchers[lang];
    const words = (typeof SHOP_DEPT_WORDS !== 'undefined' && SHOP_DEPT_WORDS[lang]) || null;
    const list = [];
    if (words) {
        const noSpaces = ['ja', 'zh', 'ko', 'th'].includes(lang);
        const pre = lang === 'he' ? '(?:[והבלמשכ]{0,2})' : (lang === 'ar' || lang === 'ur') ? '(?:و?(?:ال|ل|ب)?)' : '';
        SHOP_DEPTS.forEach((dept, rank) => {
            String(words[dept] || '').split('|').map(w => shopNormFor(w, lang)).filter(Boolean).forEach(w => {
                const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const re = noSpaces ? new RegExp(esc, 'u') : new RegExp(`(?:^|[^\\p{L}\\p{N}])${pre}${esc}`, 'u');
                list.push({ re, dept, len: w.length, rank });
            });
        });
    }
    shopDeptMatchers[lang] = list;
    return list;
}
// ההתאמה הארוכה ביותר מנצחת; שוויון - המחלקה שקודמת בסדר ההליכה בסופר
function shopAutoDept(text) {
    if (!shopNorm(text)) return 'other';
    let best = null;
    [...new Set([typeof currentLang !== 'undefined' ? currentLang : 'he', 'he', 'en'])].forEach(lang => {
        const s = shopNormFor(text, lang);
        shopDeptMatchersFor(lang).forEach(m => {
            if ((!best || m.len > best.len || (m.len === best.len && m.rank < best.rank)) && m.re.test(s)) best = m;
        });
    });
    return best ? best.dept : 'other';
}
function shopDeptOf(it) { return (it.shop_dept && String(it.shop_dept).trim()) || shopAutoDept(it.content); }
function shopDeptName(key) { return SHOP_DEPTS.includes(key) ? t(`shop_dept_${key}`) : key === 'other' ? t('shop_dept_other_name') : key; }
// סדר המחלקות: לפי סדר הסופר, מחלקה שכתבו בעצמם - אחריהן, ו"אחר" בסוף
function shopDeptRank(key) { const i = SHOP_DEPTS.indexOf(key); return i >= 0 ? i : key === 'other' ? 999 : 500; }
function shopGroups(items) {
    const groups = new Map();
    items.forEach(it => { const d = shopDeptOf(it); if (!groups.has(d)) groups.set(d, []); groups.get(d).push(it); });
    return [...groups.keys()].sort((a, b) => shopDeptRank(a) - shopDeptRank(b) || String(a).localeCompare(String(b))).map(d => ({ dept: d, items: groups.get(d) }));
}

// ---------- הציור ----------
// נקרא מ-loadCenterItems('general') עם כל הפריטים שלא נמחקו
function renderShoppingList(data) {
    shopItemsCache = data || [];
    const ul = document.getElementById('general-list');
    if (!ul) return;
    // מילות המחלקות של שפת האפליקציה עוד לא נטענו - מציירים עכשיו, ושוב כשהן מגיעות
    const lang = typeof currentLang !== 'undefined' ? currentLang : 'he';
    if (typeof SHOP_DEPT_WORDS !== 'undefined' && !SHOP_DEPT_WORDS[lang]) shopEnsureDeptLang(lang).then(ok => { if (ok) renderShoppingList(shopItemsCache); });
    const active = shopItemsCache.filter(shopIsActive);
    const groups = shopGroups(active);
    // כותרות מחלקה רק כשיש בהן משהו להגיד (לא כשהכול "אחר")
    const heads = groups.length > 1 || (groups.length === 1 && groups[0].dept !== 'other');
    ul.innerHTML = '';
    ul.classList.add('shop-list');
    groups.forEach(g => {
        if (heads) {
            const h = document.createElement('li');
            h.className = 'shop-dept-head';
            h.textContent = shopDeptName(g.dept);
            ul.appendChild(h);
        }
        g.items.forEach(it => ul.appendChild(shopRow(it)));
    });
    renderShopHoliday();
    renderShopTransit();
    renderShopAgain();
    document.getElementById('shop-btn-share')?.classList.toggle('hidden', !active.length);
    document.getElementById('shop-btn-order')?.classList.toggle('hidden', !active.length);
    // משלוח שהיום שלו הגיע - "המשלוח הגיע?" ב"היום שלי" (מרעננים את היום שלי רק כשזה משתנה)
    const due = shopDeliveryDue();
    const key = due ? `${due.length}:${due.map(x => x.id).join(',')}` : '';
    if (key !== shopDueKey) {
        shopDueKey = key;
        if (typeof todayTasksLoadedFor !== 'undefined' && todayTasksLoadedFor && typeof loadTodayTasks === 'function') loadTodayTasks();
    }
}
function shopRow(it) {
    const li = document.createElement('li');
    li.className = 'shop-row';
    li.setAttribute('data-item-id', it.id);
    li.setAttribute('data-written-at', it.content_updated_at || it.created_at || '');
    if (it.text_color) li.setAttribute('data-text-color', it.text_color);
    if (it.glow_color) li.setAttribute('data-glow-color', it.glow_color);
    if (it.bg_color) { li.setAttribute('data-bg-color', it.bg_color); li.style.backgroundColor = hexToRgba(it.bg_color, 0.18); }
    const style = [];
    if (it.text_color) style.push(`color: ${it.text_color}`);
    if (it.glow_color) style.push(`text-shadow: 0 0 4px ${it.glow_color}, 0 0 10px ${it.glow_color}, 0 0 18px ${it.glow_color}`);
    const q = shopQtyOf(it);
    li.innerHTML = `
        <span class="center-list-item-text shop-text"${style.length ? ` style="${style.join('; ')};"` : ''} onclick="openCenterItemEditor(this, 'general')" role="button" tabindex="0">${shopEsc(it.content)}</span>
        <span class="shop-qty${q > 1 ? ' is-many' : ''}">
            ${q > 1 ? `<button type="button" class="shop-qty-btn" onclick="shopQty('${it.id}', -1)" aria-label="${shopEsc(t('shop_qty_less'))}">−</button><b class="shop-qty-n"><bdi dir="ltr">×${q.toLocaleString(currentLang)}</bdi></b>` : ''}
            <button type="button" class="shop-qty-btn" onclick="shopQty('${it.id}', 1)" aria-label="${shopEsc(t('shop_qty_more'))}" title="${shopEsc(t('shop_qty_more'))}">+</button>
        </span>
        <button type="button" class="shop-btn shop-btn-again" onclick="shopMarkAgain('${it.id}')" aria-label="${shopEsc(t('shop_btn_again'))}" title="${shopEsc(t('shop_btn_again'))}">${SHOP_ICONS.again}</button>
        <button type="button" class="shop-btn shop-btn-once" onclick="shopMarkOnce('${it.id}')" aria-label="${shopEsc(t('shop_btn_once'))}" title="${shopEsc(t('shop_btn_once'))}">${SHOP_ICONS.once}</button>`;
    li.querySelector('.shop-text').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCenterItemEditor(e.currentTarget, 'general'); } });
    return li;
}
function shopDueLabel(due) {
    if (!due) return '';
    const today = getLocalDateString();
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 1);
    const tomorrow = getLocalDateString(d);
    if (due === today) return t('shop_due_today');
    if (due === tomorrow) return t('shop_due_tomorrow');
    if (due < today) return t('shop_due_past');
    const nice = new Date(`${due}T12:00:00`).toLocaleDateString(currentLang, { weekday: 'short', day: 'numeric', month: 'numeric' });
    return t('shop_due_date').replace('{date}', nice);
}
function renderShopTransit() {
    const box = document.getElementById('shop-transit');
    if (!box) return;
    const transit = shopItemsCache.filter(shopIsTransit);
    box.classList.toggle('hidden', !transit.length);
    if (!transit.length) { box.innerHTML = ''; return; }
    const due = transit.map(x => x.transit_due).filter(Boolean).sort()[0] || '';
    const isDue = !due || due <= getLocalDateString();
    box.innerHTML = `
        <div class="shop-transit-head">
            <span class="shop-transit-icon" aria-hidden="true">${SHOP_ICONS.truck}</span>
            <b>${shopEsc(t('shop_transit_title'))}</b>
            ${due ? `<span class="shop-transit-due${isDue ? ' is-due' : ''}">${shopEsc(shopDueLabel(due))}</span>` : ''}
            <button type="button" class="shop-transit-btn" onclick="openShopArrival()">${shopEsc(t('shop_arrived_btn'))}</button>
        </div>
        <p class="shop-transit-items">${transit.map(x => shopEsc(x.content) + (shopQtyOf(x) > 1 ? ` <bdi dir="ltr">×${shopQtyOf(x)}</bdi>` : '')).join(' · ')}</p>`;
}
function renderShopAgain() {
    const box = document.getElementById('shop-again');
    if (!box) return;
    const again = shopItemsCache.filter(shopIsAgain)
        .sort((a, b) => (Number(b.bought_count) || 0) - (Number(a.bought_count) || 0) || String(b.last_bought_at || '').localeCompare(String(a.last_bought_at || '')));
    box.classList.toggle('hidden', !again.length);
    if (!again.length) { box.innerHTML = ''; shopAgainManage = false; return; }
    box.classList.toggle('is-manage', shopAgainManage);
    box.innerHTML = `
        <div class="shop-again-head">
            <span class="shop-again-title">${SHOP_ICONS.again}${shopEsc(t('shop_again_title'))}</span>
            <button type="button" class="shop-again-manage" onclick="toggleShopAgainManage()">${shopEsc(t(shopAgainManage ? 'shop_again_done' : 'shop_again_manage'))}</button>
        </div>
        <div class="shop-again-chips">${again.map(it => shopAgainManage
            ? `<button type="button" class="shop-chip is-remove" onclick="shopRemoveFromAgain('${it.id}')" aria-label="${shopEsc(t('shop_again_remove'))}: ${shopEsc(it.content)}"><span>${shopEsc(it.content)}</span><i aria-hidden="true">✕</i></button>`
            : `<button type="button" class="shop-chip" onclick="shopRevive('${it.id}')"><i aria-hidden="true">+</i><span>${shopEsc(it.content)}</span></button>`).join('')}</div>`;
}
function toggleShopAgainManage() { shopAgainManage = !shopAgainManage; renderShopAgain(); }

// ---------- הפעולות ----------
function shopFind(id) { return shopItemsCache.find(x => String(x.id) === String(id)); }
async function shopUpdate(ids, patch) {
    const list = [].concat(ids);
    let q = supabaseClient.from('my_center_tasks').update(patch);
    q = list.length === 1 ? q.eq('id', list[0]) : q.in('id', list);
    const { error } = await q.eq('user_id', currentUserId);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return false; }
    return true;
}
function shopRowOut(id) { document.querySelector(`#general-list li[data-item-id="${id}"]`)?.classList.add('is-removing'); }
function shopBoughtPatch(it) {
    return { is_completed: true, shop_state: 'again', transit_due: null, quantity: 1, bought_count: (Number(it && it.bought_count) || 0) + 1, last_bought_at: new Date().toISOString() };
}
// ↺ נקנה - לשמור לפעם הבאה
async function shopMarkAgain(id) {
    const it = shopFind(id);
    shopRowOut(id);
    if (await shopUpdate(id, shopBoughtPatch(it))) await syncShopItemToTable(id, true);
    loadCenterItems('general');
}
// ✕ נקנה - למחוק (לארכיון, כמו מחיקה רגילה - למקרה של טעות)
function shopMarkOnce(id) { deleteCenterItem(id, 'general'); }
// מ"קונים שוב" חזרה לרשימה
async function shopRevive(id, quiet) {
    if (!(await shopUpdate(id, { is_completed: false, shop_state: null, transit_due: null, quantity: 1 }))) return false;
    await syncShopItemToTable(id, false);
    await loadCenterItems('general');
    if (!quiet) showAppToast(t('shop_revived'));
    return true;
}
async function shopRemoveFromAgain(id) {
    await deleteCenterItem(id, 'general');
}
async function shopQty(id, delta) {
    const it = shopFind(id);
    if (!it) return;
    const q = Math.max(1, Math.min(99, shopQtyOf(it) + delta));
    if (q === shopQtyOf(it)) return;
    it.quantity = q;
    renderShoppingList(shopItemsCache);
    if (!(await shopUpdate(id, { quantity: q }))) loadCenterItems('general');
}

// ---------- הוספה חכמה: בלי כפילויות ----------
// מה שכבר ברשימה (או בדרך) - לא נוסף שוב (bump: הכמות עולה באחד); מה שמחכה ב"קונים שוב" - חוזר לרשימה; אחרת - שורה חדשה
async function shopFetchLive() {
    const { data } = await supabaseClient.from('my_center_tasks').select('id, content, is_completed, shop_state, quantity').eq('user_id', currentUserId).eq('task_type', 'general').eq('is_deleted', false);
    return data || [];
}
async function shopAddSmart(content, { bump = true, row = {} } = {}) {
    const k = shopNorm(content);
    if (!k) return { status: 'none' };
    const same = (await shopFetchLive()).filter(r => shopNorm(r.content) === k);
    const live = same.find(r => !r.is_completed);
    if (live) {
        if (!bump || live.shop_state === 'transit') return { status: 'exists' };
        const q = Math.min(99, (Number(live.quantity) || 1) + 1);
        return (await shopUpdate(live.id, { quantity: q })) ? { status: 'bumped', qty: q } : { status: 'error' };
    }
    const pool = same.find(r => r.is_completed);
    if (pool) return (await shopUpdate(pool.id, { is_completed: false, shop_state: null, transit_due: null, quantity: 1 })) ? { status: 'revived' } : { status: 'error' };
    const { error } = await supabaseClient.from('my_center_tasks').insert({ username: currentUsername, user_id: currentUserId, task_type: 'general', content: String(content).trim(), is_completed: false, is_deleted: false, ...row });
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return { status: 'error' }; }
    return { status: 'added' };
}
// כמה שורות בבת אחת (מתכון, New Me): מחזיר כמה נוספו / חזרו לרשימה
async function shopAddMany(lines, row = {}) {
    const live = await shopFetchLive();
    const byKey = new Map();
    live.forEach(r => { const k = shopNorm(r.content); if (!byKey.has(k) || !r.is_completed) byKey.set(k, r); });
    const toInsert = [];
    const revive = [];
    lines.forEach(line => {
        const k = shopNorm(line);
        if (!k) return;
        const hit = byKey.get(k);
        if (hit && !hit.is_completed) return;
        if (hit) { revive.push(hit.id); byKey.set(k, { ...hit, is_completed: false }); return; }
        byKey.set(k, { content: line, is_completed: false });
        toInsert.push({ username: currentUsername, user_id: currentUserId, task_type: 'general', content: String(line).trim(), is_completed: false, is_deleted: false, ...row });
    });
    if (revive.length && !(await shopUpdate(revive, { is_completed: false, shop_state: null, transit_due: null, quantity: 1 }))) return { added: 0, error: true };
    if (toInsert.length) {
        const { error } = await supabaseClient.from('my_center_tasks').insert(toInsert);
        if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return { added: revive.length, error: true }; }
    }
    return { added: toInsert.length + revive.length, error: false };
}

// ---------- חלון ההוספה / העריכה (המשותף לפתקים) ----------
// בהוספה: הצעות ממה שכבר קנו ("קונים שוב") ו"כבר ברשימה"; בעריכה: המחלקה (כולל "אחר…" וכתיבה חופשית)
function shopModalOpen(type, editId) {
    const isShop = type === 'general';
    const sug = document.getElementById('center-item-shop-suggest');
    const dup = document.getElementById('center-item-shop-dup');
    const deptWrap = document.getElementById('center-item-dept-wrap');
    if (dup) dup.classList.add('hidden');
    if (sug) sug.classList.toggle('hidden', !isShop || !!editId);
    if (deptWrap) deptWrap.classList.toggle('hidden', !isShop || !editId);
    if (!isShop) return;
    if (editId) shopFillDeptSelect(shopFind(editId));
    else shopModalSync();
}
function shopFillDeptSelect(it) {
    const select = document.getElementById('center-item-dept');
    const custom = document.getElementById('center-item-dept-custom');
    if (!select || !it) return;
    const auto = shopAutoDept(it.content);
    select.innerHTML = [`<option value="">${shopEsc(t('shop_dept_auto').replace('{dept}', shopDeptName(auto)))}</option>`]
        .concat(SHOP_DEPTS.map(d => `<option value="${d}">${shopEsc(t(`shop_dept_${d}`))}</option>`))
        .concat(`<option value="custom">${shopEsc(t('shop_dept_other'))}</option>`).join('');
    const cur = (it.shop_dept || '').trim();
    select.value = !cur ? '' : SHOP_DEPTS.includes(cur) ? cur : 'custom';
    if (custom) { custom.value = cur && !SHOP_DEPTS.includes(cur) ? cur : ''; custom.classList.toggle('hidden', select.value !== 'custom'); }
    if (typeof updateCustomSelectDisplay === 'function') updateCustomSelectDisplay('center-item-dept');
}
// הערך לשמירה: '' = אוטומטי (null), מחלקה מוכרת, או השם שכתבו
function shopDeptFromModal() {
    const select = document.getElementById('center-item-dept');
    if (!select) return undefined;
    if (select.value === 'custom') { const v = (document.getElementById('center-item-dept-custom')?.value || '').trim().slice(0, 40); return v || null; }
    return select.value || null;
}
function shopModalSync() {
    if (typeof pendingCenterItemType === 'undefined' || pendingCenterItemType !== 'general' || editingCenterItemId) return;
    const input = document.getElementById('center-item-input');
    const sug = document.getElementById('center-item-shop-suggest');
    const dup = document.getElementById('center-item-shop-dup');
    const k = shopNorm(input ? input.value : '');
    const live = shopItemsCache.find(it => !it.is_completed && k && shopNorm(it.content) === k);
    if (dup) {
        dup.classList.toggle('hidden', !live);
        dup.textContent = live ? t('shop_dup_hint') : '';
    }
    const save = document.getElementById('btn-save-center-item');
    if (save) save.textContent = live && live.shop_state !== 'transit' ? t('shop_dup_add').replace('{n}', (shopQtyOf(live) + 1).toLocaleString(currentLang)) : t('add_btn');
    if (!sug) return;
    const pool = shopItemsCache.filter(shopIsAgain)
        .filter(it => !k || shopNorm(it.content).includes(k))
        .sort((a, b) => (Number(b.bought_count) || 0) - (Number(a.bought_count) || 0))
        .slice(0, 8);
    sug.classList.toggle('hidden', !pool.length);
    sug.innerHTML = pool.length ? `<span class="shop-suggest-label">${SHOP_ICONS.again}${shopEsc(t('shop_again_title'))}</span>${pool.map(it => `<button type="button" class="shop-chip" data-id="${it.id}"><i aria-hidden="true">+</i><span>${shopEsc(it.content)}</span></button>`).join('')}` : '';
    sug.querySelectorAll('[data-id]').forEach(b => b.addEventListener('click', async () => {
        closeModal('modal-add-center-item');
        await shopRevive(b.dataset.id);
    }));
}
document.addEventListener('input', e => { if (e.target && e.target.id === 'center-item-input') shopModalSync(); });

// ---------- 📤 שיתוף ----------
function shareShoppingList() {
    const active = shopItemsCache.filter(shopIsActive);
    if (!active.length) return;
    const groups = shopGroups(active);
    const heads = groups.length > 1 || (groups.length === 1 && groups[0].dept !== 'other');
    const lines = [`🛒 ${shareBold(t('general_title'))}`];
    groups.forEach(g => {
        lines.push('');
        if (heads) lines.push(shareBold(shopDeptName(g.dept)));
        g.items.forEach(it => lines.push(`▫️ ${it.content}${shopQtyOf(it) > 1 ? ` ×${shopQtyOf(it)}` : ''}`));
    });
    openSharePicker(lines.join('\n'), { subject: `🛒 ${t('general_title')}` });
}

// ---------- 🚚 משלוח בדרך ----------
function shopSheet(html) {
    const body = document.getElementById('shop-sheet-body');
    if (!body) return null;
    body.innerHTML = html;
    openModal('modal-shop-sheet');
    return body;
}
function closeShopSheet() { closeModal('modal-shop-sheet'); }
function openShopOrder() {
    const active = shopItemsCache.filter(shopIsActive);
    if (!active.length) return;
    const today = getLocalDateString();
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 1);
    const st = { picked: new Set(active.map(x => String(x.id))), when: 'tomorrow', date: getLocalDateString(d) };
    const tomorrow = st.date;
    const body = shopSheet(`
        <h3>${shopEsc(t('shop_order_title'))}</h3>
        <div class="shop-pick-tools"><button type="button" data-all>${shopEsc(t('shop_order_all'))}</button><button type="button" data-clear>${shopEsc(t('shop_order_clear'))}</button></div>
        <div class="shop-pick-list">${active.map(it => `<button type="button" class="shop-pick on" data-id="${it.id}" aria-pressed="true"><span class="shop-pick-box" aria-hidden="true">✓</span><span>${shopEsc(it.content)}${shopQtyOf(it) > 1 ? ` <bdi dir="ltr">×${shopQtyOf(it)}</bdi>` : ''}</span></button>`).join('')}</div>
        <p class="settings-label">${shopEsc(t('shop_order_when'))}</p>
        <div class="shop-when">
            <button type="button" data-when="today">${shopEsc(t('shop_when_today'))}</button>
            <button type="button" data-when="tomorrow" class="on">${shopEsc(t('shop_when_tomorrow'))}</button>
            <button type="button" data-when="other">${shopEsc(t('shop_when_other'))}</button>
        </div>
        <div class="action-buttons-wrap">
            <button type="button" class="btn-primary" data-go>${shopEsc(t('shop_order_go'))}</button>
            <button type="button" class="btn-clear-specific" data-cancel>${shopEsc(t('cancel_btn'))}</button>
        </div>`);
    if (!body) return;
    const sync = () => body.querySelectorAll('.shop-pick').forEach(b => { const on = st.picked.has(b.dataset.id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    body.querySelectorAll('.shop-pick').forEach(b => b.addEventListener('click', () => { st.picked.has(b.dataset.id) ? st.picked.delete(b.dataset.id) : st.picked.add(b.dataset.id); sync(); }));
    body.querySelector('[data-all]').addEventListener('click', () => { active.forEach(x => st.picked.add(String(x.id))); sync(); });
    body.querySelector('[data-clear]').addEventListener('click', () => { st.picked.clear(); sync(); });
    const whenBtns = body.querySelectorAll('[data-when]');
    const markWhen = () => whenBtns.forEach(b => b.classList.toggle('on', b.dataset.when === st.when));
    whenBtns.forEach(b => b.addEventListener('click', () => {
        if (b.dataset.when === 'today') { st.when = 'today'; st.date = today; }
        else if (b.dataset.when === 'tomorrow') { st.when = 'tomorrow'; st.date = tomorrow; }
        else {
            openCustomDatePicker(st.when === 'other' ? st.date : tomorrow, value => {
                if (!value) return;
                st.when = 'other';
                st.date = value;
                b.textContent = new Date(`${value}T12:00:00`).toLocaleDateString(currentLang, { weekday: 'short', day: 'numeric', month: 'numeric' });
                markWhen();
            });
            return;
        }
        markWhen();
    }));
    body.querySelector('[data-cancel]').addEventListener('click', closeShopSheet);
    body.querySelector('[data-go]').addEventListener('click', async e => {
        const ids = [...st.picked];
        if (!ids.length) { showAppToast(t('shop_order_pick_one')); return; }
        e.currentTarget.disabled = true;
        if (await shopUpdate(ids, { shop_state: 'transit', transit_due: st.date })) closeShopSheet();
        else e.currentTarget.disabled = false;
        await loadCenterItems('general');
    });
}
// "המשלוח הגיע?" - הכל הגיע (הכל עובר ל"קונים שוב"), או משהו חסר: נוגעים במה שלא הגיע והוא חוזר לרשימה
function openShopArrival() {
    const transit = shopItemsCache.filter(shopIsTransit);
    if (!transit.length) return;
    const names = transit.map(x => shopEsc(x.content)).join(' · ');
    const body = shopSheet(`
        <h3>${shopEsc(t('shop_arrived_q'))}</h3>
        <p class="shop-transit-items">${names}</p>
        <div class="action-buttons-wrap">
            <button type="button" class="btn-primary" data-all>${shopEsc(t('shop_arrived_all'))}</button>
            <button type="button" class="btn-clear-specific" data-missing>${shopEsc(t('shop_arrived_missing'))}</button>
        </div>`);
    if (!body) return;
    body.querySelector('[data-all]').addEventListener('click', async e => {
        e.currentTarget.disabled = true;
        await shopApplyArrival(transit, new Set());
    });
    body.querySelector('[data-missing]').addEventListener('click', () => shopArrivalMissing(transit));
}
function shopArrivalMissing(transit) {
    const missing = new Set();
    const body = shopSheet(`
        <h3>${shopEsc(t('shop_missing_title'))}</h3>
        <div class="shop-pick-list">${transit.map(it => `<button type="button" class="shop-pick is-missing-pick" data-id="${it.id}" aria-pressed="false"><span class="shop-pick-box" aria-hidden="true">✕</span><span>${shopEsc(it.content)}</span></button>`).join('')}</div>
        <div class="action-buttons-wrap">
            <button type="button" class="btn-primary" data-return disabled></button>
            <button type="button" class="btn-clear-specific" data-back>${shopEsc(t('recipe_back_btn'))}</button>
        </div>`);
    if (!body) return;
    const ret = body.querySelector('[data-return]');
    const sync = () => {
        body.querySelectorAll('.shop-pick').forEach(b => { const on = missing.has(b.dataset.id); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        ret.textContent = t('shop_missing_return').replace('{n}', missing.size.toLocaleString(currentLang));
        ret.disabled = !missing.size;
    };
    body.querySelectorAll('.shop-pick').forEach(b => b.addEventListener('click', () => { missing.has(b.dataset.id) ? missing.delete(b.dataset.id) : missing.add(b.dataset.id); sync(); }));
    body.querySelector('[data-back]').addEventListener('click', openShopArrival);
    ret.addEventListener('click', async () => { ret.disabled = true; await shopApplyArrival(transit, missing); });
    sync();
}
async function shopApplyArrival(transit, missing) {
    const back = transit.filter(it => missing.has(String(it.id)));
    const came = transit.filter(it => !missing.has(String(it.id)));
    const results = await Promise.all(came.map(it => shopUpdate(it.id, shopBoughtPatch(it)))
        .concat(back.length ? [shopUpdate(back.map(x => x.id), { shop_state: null, transit_due: null })] : []));
    closeShopSheet();
    await Promise.all(came.map(it => syncShopItemToTable(it.id, true)));
    await loadCenterItems('general');
    if (results.every(Boolean)) showAppToast(back.length ? t('shop_missing_toast').replace('{items}', back.map(x => x.content).join(', ')) : t('shop_arrived_toast'));
    if (typeof loadTodayTasks === 'function') loadTodayTasks();
}
// משלוח שהיום שלו הגיע (או בלי יום) - מה שעוד בדרך
function shopDeliveryDue() {
    const transit = shopItemsCache.filter(shopIsTransit);
    if (!transit.length) return null;
    const today = getLocalDateString();
    return transit.some(it => !it.transit_due || it.transit_due <= today) ? transit : null;
}
// שורה ב"היום שלי": "🚚 המשלוח הגיע?" - נגיעה פותחת את השאלה
function shopMyDayItems() {
    if (!shopDeliveryDue() || typeof myDayRow !== 'function') return [];
    const text = t('shop_myday_q');
    return [{
        kind: 'shop', group: 'tasks', minutes: null, done: false, checkable: false, title: text,
        build: () => myDayRow({ done: false, text: `🚚 ${text}`, kindClass: 'shop', onopen: openShopArrival }),
    }];
}

// ---------- 🎉 מה לקנות לחג (shop-holidays.js) ----------
// כפתור המתנה בכותרת: החגים של המדינה לפי הסדר; נגיעה בחג - רשימה מוכנה (הכל מסומן, מה שכבר ברשימה - לא), ו"להוסיף
// לרשימה". שבועיים לפני חג מופיע כרטיס קטן בראש הרשימה (✕ = לא עכשיו, עד החג הבא)
const SHOP_GIFT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="8.5" width="17" height="4" rx="1"/><path d="M5 12.5v7.5h14v-7.5M12 8.5V20"/><path d="M12 8.5c-1.6-3.6-6-4-6-1.6 0 1.2 1.6 1.6 6 1.6zM12 8.5c1.6-3.6 6-4 6-1.6 0 1.2-1.6 1.6-6 1.6z"/></svg>';
const shopHolLoading = {};
function shopEnsureHolLang(lang) {
    if (!lang || typeof SHOP_HOLIDAY_TEXT === 'undefined' || SHOP_HOLIDAY_TEXT[lang]) return Promise.resolve(true);
    if (!shopHolLoading[lang]) {
        shopHolLoading[lang] = new Promise(resolve => {
            const s = document.createElement('script');
            s.src = `shop-holidays/${lang}.js?v=1`;
            s.onload = () => resolve(!!SHOP_HOLIDAY_TEXT[lang]);
            s.onerror = () => resolve(false);
            document.head.appendChild(s);
        });
    }
    return shopHolLoading[lang];
}
function shopHolLangText() { return (typeof SHOP_HOLIDAY_TEXT !== 'undefined' && (SHOP_HOLIDAY_TEXT[currentLang] || SHOP_HOLIDAY_TEXT.en)) || { names: {}, items: {} }; }
function shopHolName(id) { const L = shopHolLangText(); return (L.names && L.names[id]) || SHOP_HOLIDAY_TEXT.en.names[id] || id; }
function shopHolItems(id) { const L = shopHolLangText(); return String((L.items && L.items[id]) || SHOP_HOLIDAY_TEXT.en.items[id] || '').split('|').map(s => s.trim()).filter(Boolean); }
function shopHolWhen(date) {
    const today = getLocalDateString();
    const d = new Date(`${today}T12:00:00`);
    d.setDate(d.getDate() + 1);
    if (date === today) return t('shop_when_today');
    if (date === getLocalDateString(d)) return t('shop_when_tomorrow');
    return new Date(`${date}T12:00:00`).toLocaleDateString(currentLang, { weekday: 'short', day: 'numeric', month: 'numeric' });
}
function shopHolKey(id, date) { return `weekwise_shop_hol_${id}_${date}`; }
function shopHolDone(id, date) { try { return localStorage.getItem(shopHolKey(id, date)) === '1'; } catch { return false; } }
function shopHolMarkDone(id, date) { try { localStorage.setItem(shopHolKey(id, date), '1'); } catch {} }
function shopHolList() { return typeof shopHolidaysForCountry === 'function' ? shopHolidaysForCountry(typeof getUserCountry === 'function' ? getUserCountry() : 'il') : []; }
// החג הקרוב, אם הוא בעוד שבועיים לכל היותר ועוד לא טיפלו בו
function shopHolSoon() {
    const h = shopHolList()[0];
    if (!h) return null;
    const days = Math.round((new Date(`${h.date}T12:00:00`) - new Date(`${getLocalDateString()}T12:00:00`)) / 86400000);
    return days <= 14 && !shopHolDone(h.id, h.date) ? h : null;
}
function renderShopHoliday() {
    const box = document.getElementById('shop-holiday');
    if (!box) return;
    if (typeof SHOP_HOLIDAY_TEXT !== 'undefined' && !SHOP_HOLIDAY_TEXT[currentLang]) shopEnsureHolLang(currentLang).then(ok => { if (ok) renderShopHoliday(); });
    const h = shopHolSoon();
    box.classList.toggle('hidden', !h);
    if (!h) { box.innerHTML = ''; return; }
    box.innerHTML = `
        <button type="button" class="shop-hol-open" onclick="openShopHolidayItems('${h.id}', '${h.date}')">
            <span class="shop-hol-icon">${SHOP_GIFT_ICON}</span>
            <span class="shop-hol-text"><b>${shopEsc(shopHolName(h.id))}</b> · ${shopEsc(shopHolWhen(h.date))}<small>${shopEsc(t('shop_hol_btn'))}</small></span>
        </button>
        <button type="button" class="shop-hol-x" onclick="shopHolMarkDone('${h.id}', '${h.date}'); renderShopHoliday()" aria-label="${shopEsc(t('shop_hol_not_now'))}" title="${shopEsc(t('shop_hol_not_now'))}">${SHOP_ICONS.once}</button>`;
}
async function openShopHolidays() {
    await shopEnsureHolLang(currentLang);
    const list = shopHolList();
    shopSheet(`
        <h3>${shopEsc(t('shop_hol_btn'))}</h3>
        <div class="shop-hol-list">${list.map(h => `<button type="button" class="shop-hol-row" onclick="openShopHolidayItems('${h.id}', '${h.date}')"><b>${shopEsc(shopHolName(h.id))}</b><span>${shopEsc(shopHolWhen(h.date))}</span></button>`).join('')}</div>
        <div class="action-buttons-wrap"><button type="button" class="btn-clear-specific" onclick="closeShopSheet()">${shopEsc(t('close_btn'))}</button></div>`);
}
async function openShopHolidayItems(id, date) {
    await shopEnsureHolLang(currentLang);
    const inList = new Set(shopItemsCache.filter(it => !it.is_completed).map(it => shopNorm(it.content)));
    const items = shopHolItems(id);
    const picked = new Set(items.filter(x => !inList.has(shopNorm(x))));
    const body = shopSheet(`
        <h3>${shopEsc(t('shop_hol_items_title').replace('{holiday}', shopHolName(id)))}</h3>
        <div class="shop-pick-list">${items.map((x, i) => {
            const has = inList.has(shopNorm(x));
            return `<button type="button" class="shop-pick${has ? ' is-have' : ' on'}" data-i="${i}" aria-pressed="${has ? 'false' : 'true'}"${has ? ' disabled' : ''}><span class="shop-pick-box" aria-hidden="true">✓</span><span>${shopEsc(x)}</span>${has ? `<small>${shopEsc(t('shop_dup_hint'))}</small>` : ''}</button>`;
        }).join('')}</div>
        <div class="action-buttons-wrap">
            <button type="button" class="btn-primary" data-add></button>
            <button type="button" class="btn-clear-specific" data-back>${shopEsc(t('recipe_back_btn'))}</button>
        </div>`);
    if (!body) return;
    const add = body.querySelector('[data-add]');
    const sync = () => {
        body.querySelectorAll('.shop-pick:not(.is-have)').forEach(b => { const on = picked.has(items[b.dataset.i]); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
        add.textContent = t('shop_hol_add').replace('{n}', picked.size.toLocaleString(currentLang));
        add.disabled = !picked.size;
    };
    body.querySelectorAll('.shop-pick:not(.is-have)').forEach(b => b.addEventListener('click', () => { const x = items[b.dataset.i]; picked.has(x) ? picked.delete(x) : picked.add(x); sync(); }));
    body.querySelector('[data-back]').addEventListener('click', openShopHolidays);
    add.addEventListener('click', async () => {
        add.disabled = true;
        const res = await shopAddMany(items.filter(x => picked.has(x)), { source_ref: `holiday:${id}` });
        if (res.error) { add.disabled = false; return; }
        shopHolMarkDone(id, date);
        closeShopSheet();
        await loadCenterItems('general');
        showAppToast(t('shop_hol_added').replace('{n}', res.added.toLocaleString(currentLang)));
    });
    sync();
}
