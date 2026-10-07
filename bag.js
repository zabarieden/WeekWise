// --- 🎒 התיק שלי (bag.js, נטען אחרי app.js): המחברות, הטבלאות והמשימות במקום אחד - לפי בקשה מפורשת,
// במקום "המחברות שלי" ו"טבלאות" הנפרדים. כל כיס הוא פרויקט (projects: שם, אייקון וצבע) ובו המחברות שלו
// (project_notebooks), הטבלאות (custom_tables.project_id) והמשימות (study_tasks.project_id). כיס נפתח
// כקלסר (#bag-binder): דף אחד עם כל מה שבכיס, וחוצצים צבעוניים בצד למעבר בין הכיסים. טבלה נפתחת במסך
// מלא (#table-view). כרטיס "✅ משימות" קבוע למעלה (חינם לכולם) פותח את מחברת המשימות. בכניסה הראשונה של
// מנוי/ת פרימיום התיק מקבל פעם אחת דוגמאות לבית ולמשפחה - לא בית ספר (bag_examples_seeded) ---

const BAG_POCKET_COLORS = ['#ff4f9a', '#a855f7', '#00b4d8', '#f59e0b', '#10b981', '#ef6c57', '#6366f1', '#84cc16'];
const BAG_FILTERS = [
    { id: 'all', icon: '🎒', key: 'bag_filter_all' },
    { id: 'notebooks', icon: '📓', key: 'bag_filter_notebooks' },
    { id: 'tables', icon: '▦', key: 'bag_filter_tables' },
    { id: 'tasks', icon: '✅', key: 'bag_filter_tasks' },
];
const BAG_PLUS_SVG = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"></path><path d="M5 12h14"></path></svg>';
const BAG_SEARCH_SVG = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-3.5-3.5"></path></svg>';
const BAG_CLOSE_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12"></path><path d="M18 6L6 18"></path></svg>';
const BAG_CHEVRON_SVG = '<svg class="bag-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"></path></svg>';
const BAG_CHECK_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>';
// התיק עצמו: מחברת, דף משבצות ועיפרון מציצים מתוכו. הצבעים של התיק מגיעים מערכת הנושא (theme.css)
const BAG_ART_SVG = `<svg class="bag-art" viewBox="0 0 300 150" aria-hidden="true">
<g class="bag-art-pop bag-art-pop-1"><g transform="rotate(-10 120 51)"><rect x="98" y="22" width="44" height="58" rx="5" fill="#8ab4f8"></rect><rect x="100" y="24" width="6" height="54" rx="2" fill="#5f8fe0"></rect><rect x="111" y="33" width="24" height="9" rx="2" fill="rgba(255,255,255,.78)"></rect></g></g>
<g class="bag-art-pop bag-art-pop-2"><g transform="rotate(8 175 48)"><rect x="150" y="18" width="50" height="60" rx="4" fill="#f8f8fb"></rect><path d="M156 32h38M156 42h38M156 52h38M170 26v48M184 26v48" stroke="#c9c9d6" stroke-width="1.6"></path><rect x="157" y="34" width="11" height="6" rx="3" fill="#10b981"></rect><rect x="171" y="44" width="11" height="6" rx="3" fill="#f59e0b"></rect></g></g>
<g class="bag-art-pop bag-art-pop-3"><g transform="rotate(16 207 46)"><rect x="203" y="20" width="9" height="52" rx="3" fill="#f59e0b"></rect><rect x="203" y="20" width="9" height="7" rx="2" fill="#ff7ab8"></rect><path d="M203 70l4.5 9 4.5-9z" fill="#f5d0a9"></path><path d="M206 76.2l1.5 2.8 1.5-2.8z" fill="#3b3b3b"></path></g></g>
<path class="bag-art-handle" d="M106 64 C104 2, 196 2, 194 64" fill="none" stroke-width="7" stroke-linecap="round"></path>
<path class="bag-art-body" d="M70 58 h160 l-14 84 a8 8 0 0 1 -8 7 h-116 a8 8 0 0 1 -8 -7 z"></path>
<path class="bag-art-rim" d="M70 58 h160 l-2 12 h-156 z"></path>
<path class="bag-art-pocket" d="M96 92 h108 v30 a8 8 0 0 1 -8 8 h-92 a8 8 0 0 1 -8 -8 z"></path>
<path class="bag-art-stitch" d="M100 96 h100 v24 a6 6 0 0 1 -6 6 h-88 a6 6 0 0 1 -6 -6 z" fill="none" stroke-width="1.5" stroke-dasharray="4 4"></path>
<circle class="bag-art-button" cx="150" cy="92" r="5"></circle>
</svg>`;

let bagFilter = 'all';
let bagQuery = '';
let bagSearchOpen = false;
let bagBinderPocketId = null;
// הכיס שממנו נפתחה הוספה (מהקלסר או מה-"+" שבכרטיס כיס) - ברירת המחדל בחלונות של טבלה/משימה
let bagPendingPocketId = null;
let bagPageCounts = {};
let bagRowCounts = {};
let bagSeedChecked = false;
let bagSeeding = false;
let bagArtIntro = false;

function bagEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function bagNum(n) { return Number(n || 0).toLocaleString(currentLang); }
// "דף אחד" / "4 דפים" לפי חוקי הרבים של השפה (ברוסית/פולנית/צ'כית/אוקראינית יש גם few/many)
function bagPlural(base, n) {
    let cat = 'other';
    try { cat = new Intl.PluralRules(currentLang).select(n); } catch { /* דפדפן ישן - "other" */ }
    const dict = translations[currentLang] || translations.en;
    const key = dict[`${base}_${cat}`] !== undefined ? `${base}_${cat}` : `${base}_other`;
    return t(key).replace('{n}', bagNum(n));
}
function bagPocket(id) { return id ? projectsCache.find(p => p.id === id) || null : null; }
function bagPocketLabel(p) { return p ? `${p.icon || '📁'} ${p.title}` : ''; }
// כיס בלי צבע שמור (נוצר לפני התיק) מקבל צבע קבוע לפי המקום שלו
function bagPocketColor(p) {
    if (p && /^#[0-9a-f]{6}$/i.test(p.color || '')) return p.color;
    const idx = Math.max(0, projectsCache.indexOf(p));
    return BAG_POCKET_COLORS[idx % BAG_POCKET_COLORS.length];
}
// טקסט כהה על צבע בהיר (טורקיז, כתום, ירוק, ליים) ולבן על צבע כהה
function bagInkOn(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex || '');
    if (!m) return '#fff';
    const [r, g, b] = m.slice(1).map(h => { const c = parseInt(h, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.33 ? '#1c1c1e' : '#fff';
}
function bagItemsOf(pocketId) {
    return {
        notebooks: allNotebooksCache.filter(n => n.project_id === pocketId),
        tables: customTablesCache.filter(x => x.project_id === pocketId),
        tasks: studyTasksCache.filter(x => x.project_id === pocketId),
    };
}
// טבלאות ומשימות מלפני התיק (בלי כיס)
function bagLooseTables() { return customTablesCache.filter(x => !bagPocket(x.project_id)); }
function bagLooseTasks() { return studyTasksCache.filter(x => !bagPocket(x.project_id)); }
function bagSortTasks(tasks) { return [...tasks.filter(x => !x.is_completed), ...tasks.filter(x => x.is_completed)]; }
// "📓 2 · ▦ 1 · ✅ 2" - סמלים ומספרים, בלי צורות רבים
function bagMetaLine(items) {
    const parts = [];
    if (items.notebooks.length) parts.push(`📓 ${bagNum(items.notebooks.length)}`);
    if (items.tables.length) parts.push(`▦ ${bagNum(items.tables.length)}`);
    const open = items.tasks.filter(x => !x.is_completed).length;
    if (open) parts.push(`✅ ${bagNum(open)}`);
    return parts.join(' · ');
}

// --- כניסה וטעינה ---
function openBag(filter) {
    closeHamburgerMenu();
    bagFilter = BAG_FILTERS.some(f => f.id === filter) ? filter : 'all';
    bagQuery = '';
    bagSearchOpen = false;
    bagArtIntro = true;
    // תיק שכבר צויר בביקור קודם: הכניסה מתנגנת שוב כשהמסך מוצג מחדש
    const art = document.querySelector('#bag-root .bag-art-wrap');
    if (art) { art.classList.remove('wiggle'); art.classList.add('intro'); bagArtIntro = false; }
    switchToTab('notebooks-section');
    renderBag();
    loadNotebooksHome();
}
function openNotebooksSection() { openBag(); }
function openTablesSection() { openBag('tables'); }

async function bagFetchCounts() {
    try { return await supabaseClient.rpc('bag_item_counts'); } catch { return null; }
}
function bagApplyCounts(res) {
    const d = res && !res.error ? res.data : null;
    if (!d || typeof d !== 'object') return;
    bagPageCounts = d.pages && typeof d.pages === 'object' ? d.pages : {};
    bagRowCounts = d.rows && typeof d.rows === 'object' ? d.rows : {};
}

async function loadNotebooksHome() {
    if (!supabaseClient || !currentUserId) return;
    const uid = currentUserId;
    const [projectsRes, notebooksRes, tasksRes, tablesRes, countsRes] = await Promise.all([
        supabaseClient.from('projects').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        supabaseClient.from('project_notebooks').select('*').eq('user_id', uid).order('created_at', { ascending: true }),
        supabaseClient.from('study_tasks').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
        supabaseClient.from('custom_tables').select('*').eq('user_id', uid).order('sort_order', { ascending: true, nullsFirst: false }).order('created_at', { ascending: true }),
        bagFetchCounts(),
    ]);
    if (uid !== currentUserId) return;
    if (!projectsRes.error) projectsCache = (projectsRes.data || []).slice().sort(nbSortByOrder);
    if (!notebooksRes.error) allNotebooksCache = (notebooksRes.data || []).slice().sort(nbSortByOrder);
    if (!tasksRes.error) studyTasksCache = tasksRes.data || [];
    if (!tablesRes.error) customTablesCache = tablesRes.data || [];
    bagApplyCounts(countsRes);
    renderBag();
    if (await bagMaybeSeedExamples()) await loadNotebooksHome();
}

// --- המסך הראשי של התיק ---
function renderNotebookShelves() { renderBag(); }
function renderBag() {
    bagRenderOverview();
    if (isBagBinderOpen()) renderBagBinder();
    if (isTableViewOpen()) renderTableViewHead();
}

function bagRenderOverview() {
    const root = document.getElementById('bag-root');
    if (!root) return;
    const searchFocused = bagSearchOpen && document.activeElement && document.activeElement.id === 'bag-search-input';
    // התיק המצויר נשאר במקומו בין רינדורים (רק שורת הסיכום מתעדכנת) - אחרת אנימציית הכניסה נקטעת
    // ברינדור השני, אחרי שהנתונים נטענים
    const keepHero = bagSearchOpen ? null : root.querySelector(':scope > .bag-hero');
    [...root.children].forEach(child => { if (child !== keepHero) child.remove(); });
    root.insertBefore(bagBuildHead(), root.firstChild);
    if (keepHero) bagFillTotals(keepHero);
    else root.appendChild(bagSearchOpen ? bagBuildSearch() : bagBuildHero());
    if (isPremiumUser) root.appendChild(bagBuildFilters());
    const content = document.createElement('div');
    content.id = 'bag-content';
    content.className = 'bag-content';
    root.appendChild(content);
    const emptyShown = bagFillContent(content);
    if (isPremiumUser && !bagQuery.trim() && !emptyShown) {
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'bag-new-pocket';
        add.textContent = t('nb_add_shelf_btn');
        add.onclick = () => openAddShelfModal();
        root.appendChild(add);
    }
    if (searchFocused) document.getElementById('bag-search-input')?.focus();
}

function bagBuildHead() {
    const head = document.createElement('div');
    head.className = 'bag-head';
    head.innerHTML = `<h2 class="bag-title">${bagEsc(t('study_title'))}</h2>`;
    const actions = document.createElement('div');
    actions.className = 'bag-head-actions';
    if (isPremiumUser) {
        const search = document.createElement('button');
        search.type = 'button';
        search.className = 'gv-icon-btn bag-search-btn' + (bagSearchOpen ? ' active' : '');
        search.innerHTML = BAG_SEARCH_SVG;
        search.title = t('bag_search_title');
        search.setAttribute('aria-label', search.title);
        search.setAttribute('aria-pressed', bagSearchOpen ? 'true' : 'false');
        search.onclick = () => bagToggleSearch();
        actions.appendChild(search);
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'bag-add-btn';
    add.innerHTML = BAG_PLUS_SVG;
    add.title = t('bag_new_title');
    add.setAttribute('aria-label', add.title);
    add.onclick = () => openBagAddMenu(null);
    actions.appendChild(add);
    head.appendChild(actions);
    return head;
}

function bagToggleSearch(force) {
    bagSearchOpen = typeof force === 'boolean' ? force : !bagSearchOpen;
    if (!bagSearchOpen) bagQuery = '';
    bagRenderOverview();
    if (bagSearchOpen) setTimeout(() => document.getElementById('bag-search-input')?.focus(), 30);
}
function bagBuildSearch() {
    const label = document.createElement('label');
    label.className = 'glib-search bag-search';
    label.innerHTML = BAG_SEARCH_SVG;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = 'bag-search-input';
    input.inputMode = 'search';
    input.autocomplete = 'off';
    input.placeholder = t('bag_search_placeholder');
    input.value = bagQuery;
    input.setAttribute('enterkeyhint', 'search');
    // רק התוצאות מתרעננות - לא כל המסך, כדי שהמקלדת לא תיסגר בזמן ההקלדה
    input.oninput = () => { bagQuery = input.value; const content = document.getElementById('bag-content'); if (content) bagFillContent(content); };
    input.onkeydown = e => { if (e.key === 'Escape') bagToggleSearch(false); };
    label.appendChild(input);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'bag-search-close';
    close.innerHTML = BAG_CLOSE_SVG;
    close.setAttribute('aria-label', t('close_btn'));
    close.onclick = e => { e.preventDefault(); bagToggleSearch(false); };
    label.appendChild(close);
    return label;
}

function bagBuildHero() {
    const hero = document.createElement('div');
    hero.className = 'bag-hero';
    const art = document.createElement('div');
    art.className = 'bag-art-wrap' + (bagArtIntro ? ' intro' : '');
    bagArtIntro = false;
    art.innerHTML = BAG_ART_SVG;
    // נגיעה בתיק - הוא מקפץ והדברים שבתוכו קופצים החוצה לרגע
    art.onclick = () => { art.classList.remove('intro', 'wiggle'); void art.offsetWidth; art.classList.add('wiggle'); };
    hero.appendChild(art);
    bagFillTotals(hero);
    return hero;
}
// "🗂️ 4 · 📓 5 · ▦ 3 · ✅ 2" מתחת לתיק
function bagFillTotals(hero) {
    const parts = [];
    if (isPremiumUser) {
        if (projectsCache.length) parts.push(`🗂️ ${bagNum(projectsCache.length)}`);
        if (allNotebooksCache.length) parts.push(`📓 ${bagNum(allNotebooksCache.length)}`);
        if (customTablesCache.length) parts.push(`▦ ${bagNum(customTablesCache.length)}`);
        const open = studyTasksCache.filter(x => !x.is_completed).length;
        if (open) parts.push(`✅ ${bagNum(open)}`);
    }
    let line = hero.querySelector('.bag-totals');
    if (!parts.length) { if (line) line.remove(); return; }
    if (!line) { line = document.createElement('p'); line.className = 'bag-totals'; hero.appendChild(line); }
    line.textContent = parts.join(' · ');
}

function bagBuildFilters() {
    const wrap = document.createElement('div');
    wrap.className = 'bag-filters';
    wrap.setAttribute('role', 'tablist');
    BAG_FILTERS.forEach(f => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bag-filter' + (bagFilter === f.id ? ' active' : '');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', bagFilter === f.id ? 'true' : 'false');
        b.innerHTML = `<span class="bag-filter-icon" aria-hidden="true">${f.icon}</span><span class="bag-filter-label">${bagEsc(t(f.key))}</span>`;
        b.onclick = () => { if (bagFilter === f.id) return; bagFilter = f.id; bagRenderOverview(); };
        wrap.appendChild(b);
    });
    return wrap;
}

// ממלא את רשימת הכיסים לפי המסנן והחיפוש. מחזיר true כשמוצג מצב "התיק ריק" (ואז בלי כפתור "כיס חדש" כפול)
function bagFillContent(content) {
    content.innerHTML = '';
    if (bagSeeding) content.appendChild(bagBuildSeedingCard());
    if (!isPremiumUser) {
        content.appendChild(bagBuildTasksCard());
        content.appendChild(bagBuildPremiumCard());
        return false;
    }
    const q = bagQuery.trim().toLowerCase();
    const has = s => String(s || '').toLowerCase().includes(q);
    if (bagFilter === 'tasks') { bagFillTasks(content, q, has); return false; }
    if (bagFilter === 'all' && !q) content.appendChild(bagBuildTasksCard());
    const filtered = bagFilter !== 'all' || !!q;
    let shown = 0;
    projectsCache.forEach(p => {
        const items = bagItemsOf(p.id);
        const whole = !q || has(p.title);
        let nbs = bagFilter === 'tables' ? [] : items.notebooks;
        let tbs = bagFilter === 'notebooks' ? [] : items.tables;
        let tasks = [];
        if (!whole) {
            nbs = nbs.filter(n => has(n.title));
            tbs = tbs.filter(x => has(x.name));
            if (bagFilter === 'all') tasks = items.tasks.filter(x => has(x.title));
        }
        if (filtered && !nbs.length && !tbs.length && !tasks.length && !(q && whole)) return;
        content.appendChild(bagBuildPocketCard(p, nbs, tbs, tasks, { addSlot: !q, emptyHint: !filtered }));
        shown++;
    });
    if (bagFilter !== 'notebooks') {
        const loose = bagLooseTables().filter(x => !q || has(x.name));
        if (loose.length) { content.appendChild(bagBuildLooseCard(loose)); shown++; }
    }
    if (q && bagFilter === 'all') {
        const looseTasks = bagLooseTasks().filter(x => has(x.title));
        if (looseTasks.length) { content.appendChild(bagBuildTaskGroup(null, bagSortTasks(looseTasks))); shown++; }
    }
    if (shown) return false;
    if (q) { content.appendChild(bagBuildEmpty('search')); return false; }
    content.appendChild(bagBuildEmpty(bagFilter));
    return bagFilter === 'all';
}

function bagBuildPocketCard(p, nbs, tbs, tasks, opts = {}) {
    const card = document.createElement('section');
    card.className = 'bag-pocket';
    card.style.setProperty('--pocket', bagPocketColor(p));
    card.dataset.pocketId = p.id;
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'bag-pocket-head';
    const meta = bagMetaLine(bagItemsOf(p.id));
    head.innerHTML = `<span class="bag-pocket-icon" aria-hidden="true">${bagEsc(p.icon || '📁')}</span><span class="bag-pocket-name">${bagEsc(p.title)}</span>${meta ? `<span class="bag-pocket-meta">${bagEsc(meta)}</span>` : ''}${BAG_CHEVRON_SVG}`;
    head.setAttribute('aria-label', t('bag_open_pocket').replace('{name}', p.title));
    head.onclick = () => openBagBinder(p.id);
    card.appendChild(head);
    if (nbs.length || tbs.length || opts.addSlot) {
        const row = document.createElement('div');
        row.className = 'bag-pocket-row';
        nbs.forEach(n => row.appendChild(buildNotebookCover(n)));
        tbs.forEach(x => row.appendChild(bagBuildTableCard(x)));
        if (opts.addSlot) row.appendChild(bagBuildAddSlot(p.id));
        if (!nbs.length && !tbs.length && opts.emptyHint) row.insertAdjacentHTML('beforeend', `<span class="bag-pocket-empty">${bagEsc(t('bag_pocket_empty'))}</span>`);
        card.appendChild(row);
    }
    if (tasks.length) card.appendChild(bagBuildTaskList(bagSortTasks(tasks)));
    return card;
}

function bagBuildTableCard(tb) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bag-table-card';
    btn.dataset.tableId = tb.id;
    const rows = bagRowCounts[tb.id];
    btn.innerHTML = `<span class="bag-table-card-name"><span class="bag-table-card-icon" aria-hidden="true">${tableIconHtml(tb.icon)}</span>${bagEsc(tb.name)}</span><span class="bag-table-card-lines" aria-hidden="true"><i></i><i></i><i></i></span>${rows != null ? `<span class="bag-table-card-foot" aria-hidden="true">▤ ${bagNum(rows)}</span>` : ''}`;
    btn.title = tb.name;
    btn.setAttribute('aria-label', rows != null ? `${tb.name} · ${bagPlural('bag_rows', rows)}` : tb.name);
    btn.onclick = () => openTableView(tb.id);
    return btn;
}

// "+" בסוף שורת הכיס: במסנן מחברות - מחברת חדשה, במסנן טבלאות - טבלה חדשה, ובשאר - תפריט ההוספה
function bagBuildAddSlot(pocketId) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bag-add-slot';
    btn.innerHTML = BAG_PLUS_SVG;
    const label = bagFilter === 'notebooks' ? t('notebooks_add_item_title') : bagFilter === 'tables' ? t('table_add_modal_title') : t('bag_add_in').replace('{name}', bagPocketLabel(bagPocket(pocketId)));
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.onclick = () => {
        if (bagFilter === 'notebooks') { bagPendingPocketId = pocketId; openNotebookCoverModal(null, pocketId); }
        else if (bagFilter === 'tables') { bagPendingPocketId = pocketId; openAddTableModal(); }
        else openBagAddMenu(pocketId);
    };
    return btn;
}

function bagBuildLooseCard(tables) {
    const card = document.createElement('section');
    card.className = 'bag-pocket is-loose';
    card.innerHTML = `<div class="bag-pocket-head is-static"><span class="bag-pocket-icon" aria-hidden="true">📂</span><span class="bag-pocket-name">${bagEsc(t('bag_loose_title'))}</span></div>`;
    const row = document.createElement('div');
    row.className = 'bag-pocket-row';
    tables.forEach(x => row.appendChild(bagBuildTableCard(x)));
    card.appendChild(row);
    return card;
}

// כרטיס המשימות הקבוע (פתק צהוב): שתי המשימות הפתוחות הבאות + מספר הפתוחות; פותח את מחברת המשימות
function bagBuildTasksCard() {
    const open = studyTasksCache.filter(x => !x.is_completed);
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bag-tasks-card';
    const lines = open.length
        ? open.slice(0, 2).map(x => `<span class="bag-tasks-line">${bagEsc(x.title)}</span>`).join('')
        : `<span class="bag-tasks-line is-calm">${bagEsc(t(studyTasksCache.length ? 'bag_tasks_all_done' : 'bag_empty_tasks'))}</span>`;
    btn.innerHTML = `<span class="bag-tasks-icon" aria-hidden="true">✅</span><span class="bag-tasks-body"><span class="bag-tasks-title">${bagEsc(t('nb_tasks_notebook_title'))}</span>${lines}</span>${open.length ? `<span class="bag-tasks-count">${bagNum(open.length)}</span>` : ''}${BAG_CHEVRON_SVG}`;
    btn.onclick = () => openTasksNotebook();
    return btn;
}

function bagFillTasks(content, q, has) {
    const groups = [{ pocket: null, tasks: bagLooseTasks() }, ...projectsCache.map(p => ({ pocket: p, tasks: studyTasksCache.filter(x => x.project_id === p.id) }))];
    let shown = 0;
    groups.forEach(g => {
        const whole = !q || (g.pocket && has(g.pocket.title));
        const tasks = whole ? g.tasks : g.tasks.filter(x => has(x.title));
        if (!tasks.length) return;
        content.appendChild(bagBuildTaskGroup(g.pocket, bagSortTasks(tasks)));
        shown++;
    });
    if (!shown) content.appendChild(bagBuildEmpty(q ? 'search' : 'tasks'));
}

function bagBuildTaskGroup(pocket, tasks) {
    const card = document.createElement('section');
    card.className = 'bag-pocket bag-task-group' + (pocket ? '' : ' is-general');
    if (pocket) card.style.setProperty('--pocket', bagPocketColor(pocket));
    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'bag-pocket-head';
    head.innerHTML = pocket
        ? `<span class="bag-pocket-icon" aria-hidden="true">${bagEsc(pocket.icon || '📁')}</span><span class="bag-pocket-name">${bagEsc(pocket.title)}</span>${BAG_CHEVRON_SVG}`
        : `<span class="bag-pocket-name">${bagEsc(t('bag_tasks_general'))}</span>${BAG_CHEVRON_SVG}`;
    head.onclick = () => (pocket ? openBagBinder(pocket.id) : openTasksNotebook());
    card.appendChild(head);
    card.appendChild(bagBuildTaskList(tasks));
    return card;
}

function bagBuildTaskList(tasks) {
    const ul = document.createElement('ul');
    ul.className = 'bag-task-list';
    tasks.forEach(x => ul.appendChild(bagBuildTaskRow(x)));
    return ul;
}
function bagBuildTaskRow(x) {
    const li = document.createElement('li');
    li.className = 'bag-task' + (x.is_completed ? ' is-done' : '');
    li.dataset.taskId = x.id;
    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'bag-task-check';
    check.setAttribute('aria-pressed', x.is_completed ? 'true' : 'false');
    check.setAttribute('aria-label', x.title);
    check.innerHTML = `<span class="bag-task-box" aria-hidden="true">${x.is_completed ? BAG_CHECK_SVG : ''}</span>`;
    check.onclick = () => bagToggleTask(x.id);
    const title = document.createElement('button');
    title.type = 'button';
    title.className = 'bag-task-title';
    title.textContent = x.title;
    title.onclick = () => openEditStudyItemModal(x.id);
    li.append(check, title);
    return li;
}
async function bagToggleTask(id) {
    const item = studyTasksCache.find(x => x.id === id);
    if (!item) return;
    const was = item.is_completed;
    item.is_completed = !was;
    renderBag();
    await toggleStudyTaskStatus(id, was);
}

function bagBuildEmpty(kind) {
    const box = document.createElement('div');
    box.className = 'bag-empty';
    if (kind === 'search') {
        box.textContent = t('bag_no_results').replace('{q}', bagQuery.trim());
        return box;
    }
    const conf = {
        all: { title: 'bag_empty_title', text: 'bag_empty_text', actions: [['', 'nb_add_shelf_btn', () => openAddShelfModal()]] },
        notebooks: { title: 'bag_empty_notebooks', actions: [['', 'nb_add_notebook_btn', () => openNotebookCoverModal()]] },
        tables: { title: 'bag_empty_tables', actions: [['▦', 'bag_add_table', () => { bagPendingPocketId = null; openAddTableModal(); }], ['🧠', 'bag_add_table_ai', () => { bagPendingPocketId = null; openAiBrainModal('table'); }]] },
        tasks: { title: 'bag_empty_tasks', actions: [['✅', 'bag_add_task', () => { bagPendingPocketId = null; openAddStudyItemModal(); }]] },
    }[kind] || { title: 'bag_empty_title', actions: [] };
    box.innerHTML = `<p class="bag-empty-title">${bagEsc(t(conf.title))}</p>${conf.text ? `<p class="bag-empty-text">${bagEsc(t(conf.text))}</p>` : ''}`;
    const row = document.createElement('div');
    row.className = 'bag-empty-actions';
    conf.actions.forEach(([icon, key, run]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bag-chip-btn';
        b.textContent = icon ? `${icon} ${t(key)}` : t(key);
        b.onclick = run;
        row.appendChild(b);
    });
    if (conf.actions.length) box.appendChild(row);
    return box;
}

function bagBuildSeedingCard() {
    const box = document.createElement('div');
    box.className = 'bag-seeding';
    box.innerHTML = `<span class="bag-seeding-dot" aria-hidden="true"></span><span>${bagEsc(t('bag_seeding'))}</span>`;
    return box;
}

// למי שאינו/ה פרימיום: כרטיס המשימות פתוח לכולם, ומתחתיו הזמנה לכיסים, מחברות וטבלאות
function bagBuildPremiumCard() {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'nb-premium-card';
    card.innerHTML = `<span class="nb-premium-covers" aria-hidden="true"><span style="--nb-color:#ef8a80"></span><span style="--nb-color:#8ab4f8"></span><span style="--nb-color:#f3d36b"></span></span>
        <span class="nb-premium-text"><b>${bagEsc(t('nb_premium_title'))}</b><span>${bagEsc(t('nb_premium_text'))}</span></span>
        <span class="nb-premium-badge">⭐ ${bagEsc(t('home_premium_badge_label'))}</span>`;
    card.onclick = () => openPremiumUpgradeModal();
    return card;
}

// --- הקלסר: כיס פתוח. הטבעות בצד ה-start של הדף, החוצצים בצד ה-end ---
function isBagBinderOpen() {
    const view = document.getElementById('bag-binder');
    return !!(view && view.classList.contains('open'));
}
function bagSyncWrapper() {
    const wrapper = document.querySelector('.phone-wrapper');
    if (wrapper) wrapper.classList.toggle('bag-open', isBagBinderOpen() || isTableViewOpen());
}

function openBagBinder(pocketId) {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    const view = document.getElementById('bag-binder');
    if (!view || !bagPocket(pocketId)) return;
    const switching = isBagBinderOpen() && bagBinderPocketId !== pocketId;
    bagBinderPocketId = pocketId;
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    bagSyncWrapper();
    renderBagBinder({ fresh: true });
    const scroll = document.getElementById('bag-binder-scroll');
    if (scroll) scroll.scrollTop = 0;
    const sheet = document.getElementById('bag-binder-sheet');
    if (switching && sheet) { sheet.classList.remove('is-turning'); void sheet.offsetWidth; sheet.classList.add('is-turning'); }
}
function closeBagBinder() {
    const view = document.getElementById('bag-binder');
    if (view) { view.classList.remove('open'); view.setAttribute('aria-hidden', 'true'); }
    bagBinderPocketId = null;
    bagPendingPocketId = null;
    bagSyncWrapper();
    bagRenderOverview();
}

function renderBagBinder(opts = {}) {
    const view = document.getElementById('bag-binder');
    if (!view) return;
    const p = bagPocket(bagBinderPocketId);
    // הכיס נמחק (מחלון העריכה או ממכשיר אחר) - חוזרים לתיק
    if (!p) { closeBagBinder(); return; }
    const color = bagPocketColor(p);
    view.style.setProperty('--pocket', color);
    view.style.setProperty('--pocket-ink', bagInkOn(color));
    const crumb = document.getElementById('bag-binder-crumb');
    if (crumb) crumb.innerHTML = `<span class="bag-crumb-root">${bagEsc(t('study_title'))}</span><span class="bag-crumb-sep" aria-hidden="true">›</span><span class="bag-crumb-name"><span aria-hidden="true">${bagEsc(p.icon || '📁')}</span> ${bagEsc(p.title)}</span>`;
    const scroll = document.getElementById('bag-binder-scroll');
    if (scroll) {
        const keep = opts.fresh ? null : bagBinderInputState();
        const top = scroll.scrollTop;
        scroll.innerHTML = '';
        const items = bagItemsOf(p.id);
        const title = document.createElement('div');
        title.className = 'bag-page-title';
        title.innerHTML = `<span class="bag-page-mark" aria-hidden="true"></span><h3 class="bag-page-name"><span aria-hidden="true">${bagEsc(p.icon || '📁')}</span> ${bagEsc(p.title)}</h3>`;
        const edit = document.createElement('button');
        edit.type = 'button';
        edit.className = 'bag-page-edit';
        edit.innerHTML = EDIT_ICON_SVG;
        edit.title = t('nb_shelf_edit_title');
        edit.setAttribute('aria-label', edit.title);
        edit.onclick = () => openEditProjectModal(p.id);
        title.appendChild(edit);
        scroll.appendChild(title);
        const meta = bagMetaLine(items);
        scroll.insertAdjacentHTML('beforeend', `<p class="bag-page-meta${meta ? '' : ' hidden'}">${bagEsc(meta)}</p>`);
        if (items.notebooks.length || items.tables.length) {
            const list = document.createElement('div');
            list.className = 'bag-page-items';
            items.notebooks.forEach(n => list.appendChild(bagBuildNotebookRow(n)));
            items.tables.forEach(x => list.appendChild(bagBuildTableRow(x)));
            scroll.appendChild(list);
        } else {
            scroll.appendChild(bagBuildBinderEmpty(p.id));
        }
        scroll.appendChild(bagBuildBinderTasks(p.id, items.tasks));
        bagBinderInputRestore(keep);
        if (!opts.fresh) scroll.scrollTop = top;
    }
    renderBagBinderTabs();
}

function bagBuildNotebookRow(n) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bag-item';
    btn.dataset.notebookId = n.id;
    const pages = bagPageCounts[n.id];
    const meta = [t('bag_add_notebook'), pages != null ? bagPlural('bag_pages', pages) : null].filter(Boolean).join(' · ');
    btn.innerHTML = `<span class="bag-item-cover nb-pat-${nbCoverPattern(n)}" style="--nb-color:${bagEsc(nbCoverColor(n))}" aria-hidden="true">${bagEsc(n.cover_emoji || '📓')}</span><span class="bag-item-text"><span class="bag-item-name">${bagEsc(n.title)}</span><span class="bag-item-meta">${bagEsc(meta)}</span></span>${n.bookmark_page_id ? '<span class="bag-item-mark" aria-hidden="true">🔖</span>' : ''}${BAG_CHEVRON_SVG}`;
    btn.onclick = () => openNotebookView(n.id);
    return btn;
}
function bagBuildTableRow(x) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'bag-item';
    btn.dataset.tableId = x.id;
    const rows = bagRowCounts[x.id];
    const meta = [t('bag_add_table'), rows != null ? bagPlural('bag_rows', rows) : null].filter(Boolean).join(' · ');
    btn.innerHTML = `<span class="bag-item-cover is-table" aria-hidden="true">${tableIconHtml(x.icon)}</span><span class="bag-item-text"><span class="bag-item-name">${bagEsc(x.name)}</span><span class="bag-item-meta">${bagEsc(meta)}</span></span>${BAG_CHEVRON_SVG}`;
    btn.onclick = () => openTableView(x.id);
    return btn;
}

function bagBuildBinderEmpty(pocketId) {
    const box = document.createElement('div');
    box.className = 'bag-page-empty';
    box.innerHTML = `<p>${bagEsc(t('bag_page_empty'))}</p>`;
    const chips = document.createElement('div');
    chips.className = 'bag-page-empty-chips';
    [
        ['📓', 'bag_add_notebook', () => openNotebookCoverModal(null, pocketId)],
        ['▦', 'bag_add_table', () => { bagPendingPocketId = pocketId; openAddTableModal(); }],
        ['🧠', 'bag_add_table_ai', () => { bagPendingPocketId = pocketId; openAiBrainModal('table'); }],
    ].forEach(([icon, key, run]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bag-paper-chip';
        b.textContent = `${icon} ${t(key)}`;
        b.onclick = run;
        chips.appendChild(b);
    });
    box.appendChild(chips);
    return box;
}

// המשימות של הכיס - פתק צהוב בתחתית הדף, עם שורת הוספה מהירה
function bagBuildBinderTasks(pocketId, tasks) {
    const box = document.createElement('div');
    box.className = 'bag-page-tasks';
    box.innerHTML = `<div class="bag-page-tasks-head"><span aria-hidden="true">✅</span> ${bagEsc(t('nb_tasks_notebook_title'))}</div>`;
    if (tasks.length) box.appendChild(bagBuildTaskList(bagSortTasks(tasks)));
    const form = document.createElement('form');
    form.className = 'bag-task-add';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 300;
    input.autocomplete = 'off';
    input.placeholder = t('bag_task_add_placeholder');
    input.setAttribute('aria-label', t('study_add_btn_title'));
    input.setAttribute('enterkeyhint', 'done');
    const add = document.createElement('button');
    add.type = 'submit';
    add.className = 'bag-task-add-btn';
    add.innerHTML = BAG_PLUS_SVG;
    add.setAttribute('aria-label', t('study_add_btn_title'));
    form.append(input, add);
    form.onsubmit = e => { e.preventDefault(); bagAddTaskFromBinder(pocketId, input); };
    box.appendChild(form);
    return box;
}
async function bagAddTaskFromBinder(pocketId, input) {
    const title = input.value.trim();
    if (!title || !supabaseClient || !currentUserId) return;
    input.value = '';
    const { data, error } = await supabaseClient.from('study_tasks').insert({ user_id: currentUserId, username: currentUsername, title, project_id: pocketId }).select().maybeSingle();
    if (error || !data) { input.value = title; showAppToast(t('error_adding_item') + (error ? error.message : ''), 'error'); return; }
    studyTasksCache.unshift(data);
    bagRenderOverview();
    bagRefreshBinderTasks();
}
// מחליפה רק את רשימת המשימות ואת שורת הסיכום - שורת ההוספה נשארת (והמקלדת לא נסגרת)
function bagRefreshBinderTasks() {
    const p = bagPocket(bagBinderPocketId);
    const box = document.querySelector('#bag-binder .bag-page-tasks');
    if (!p || !box) return;
    const items = bagItemsOf(p.id);
    const oldList = box.querySelector('.bag-task-list');
    const newList = items.tasks.length ? bagBuildTaskList(bagSortTasks(items.tasks)) : null;
    if (oldList && newList) oldList.replaceWith(newList);
    else if (oldList) oldList.remove();
    else if (newList) box.insertBefore(newList, box.querySelector('.bag-task-add'));
    const metaEl = document.querySelector('#bag-binder .bag-page-meta');
    if (metaEl) {
        const meta = bagMetaLine(items);
        metaEl.textContent = meta;
        metaEl.classList.toggle('hidden', !meta);
    }
}
function bagBinderInputState() {
    const input = document.querySelector('#bag-binder .bag-task-add input');
    return input ? { value: input.value, focused: document.activeElement === input } : null;
}
function bagBinderInputRestore(state) {
    if (!state) return;
    const input = document.querySelector('#bag-binder .bag-task-add input');
    if (!input) return;
    input.value = state.value;
    if (state.focused) input.focus();
}

function renderBagBinderTabs() {
    const tabs = document.getElementById('bag-binder-tabs');
    if (!tabs) return;
    tabs.innerHTML = '';
    projectsCache.forEach(p => {
        const color = bagPocketColor(p);
        const active = p.id === bagBinderPocketId;
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.className = 'bag-tab' + (active ? ' active' : '');
        tab.style.setProperty('--tab', color);
        tab.style.setProperty('--tab-ink', bagInkOn(color));
        // האייקון עומד (כתב אופקי) מעל השם - בכתב אנכי אימוג'י מורכב כמו 👨‍👩‍👧 מתפרק לכמה פרצופים
        tab.innerHTML = `<span class="bag-tab-icon" aria-hidden="true">${bagEsc(p.icon || '📁')}</span><span class="bag-tab-label">${bagEsc(p.title)}</span>`;
        tab.setAttribute('aria-label', p.title);
        if (active) tab.setAttribute('aria-current', 'true');
        tab.onclick = () => { if (!active) openBagBinder(p.id); };
        tabs.appendChild(tab);
    });
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'bag-tab bag-tab-add';
    add.innerHTML = BAG_PLUS_SVG;
    add.title = t('nb_shelf_add_title');
    add.setAttribute('aria-label', add.title);
    add.onclick = () => openAddShelfModal();
    tabs.appendChild(add);
    // החוצץ של הכיס הפתוח תמיד גלוי, גם כשיש הרבה כיסים
    const current = tabs.querySelector('.bag-tab.active');
    if (current) tabs.scrollTop = Math.max(0, current.offsetTop - tabs.offsetTop - (tabs.clientHeight - current.offsetHeight) / 2);
}

// כיס חדש (מ"+ כיס חדש" / מהחוצץ "+") - נפתח מיד, מוכן למלא
function bagOnPocketCreated(p) {
    if (!p || !isNotebooksSectionOpen()) return;
    openBagBinder(p.id);
}

// --- ＋ מה להוסיף: מחברת, טבלה, טבלה עם AI, משימה, כיס (בתוך כיס - בלי "כיס") ---
function openBagAddMenu(pocketId) {
    const p = bagPocket(pocketId);
    bagPendingPocketId = p ? p.id : null;
    const title = document.getElementById('bag-add-title');
    const grid = document.getElementById('bag-add-grid');
    if (!title || !grid) return;
    title.textContent = p ? t('bag_add_in').replace('{name}', bagPocketLabel(p)) : t('bag_add_title');
    grid.innerHTML = '';
    const options = [
        { icon: '📓', key: 'bag_add_notebook', desc: 'bag_add_notebook_desc', premium: true, run: () => openNotebookCoverModal(null, bagPendingPocketId) },
        { icon: '▦', key: 'bag_add_table', desc: 'bag_add_table_desc', premium: true, run: () => openAddTableModal() },
        { icon: '🧠', key: 'bag_add_table_ai', desc: 'bag_add_table_ai_desc', premium: true, run: () => openAiBrainModal('table') },
        { icon: '✅', key: 'bag_add_task', desc: 'bag_add_task_desc', premium: false, run: () => openAddStudyItemModal() },
    ];
    if (!p) options.push({ icon: '🗂️', key: 'bag_add_pocket', desc: 'bag_add_pocket_desc', premium: true, run: () => openAddShelfModal() });
    options.forEach(o => {
        const locked = o.premium && !isPremiumUser;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bag-add-option' + (locked ? ' is-locked' : '');
        btn.innerHTML = `<span class="bag-add-option-icon" aria-hidden="true">${o.icon}</span><span class="bag-add-option-text"><span class="bag-add-option-name">${bagEsc(t(o.key))}</span><span class="bag-add-option-desc">${bagEsc(t(o.desc))}</span></span>${locked ? `<span class="glib-tag is-premium">⭐ ${bagEsc(t('home_premium_badge_label'))}</span>` : ''}`;
        btn.onclick = () => { closeModal('modal-bag-add'); if (locked) openPremiumUpgradeModal(); else o.run(); };
        grid.appendChild(btn);
    });
    openModal('modal-bag-add');
}

// --- בורר "כיס" בחלונות של טבלה ומשימה: הכיסים + "➕ כיס חדש…" (עם שם להקלדה), ואפשרות "בלי כיס"
// כשמעבירים לה noneLabel (משימות כלליות, או טבלה ישנה שעוד לא בכיס) ---
function bagFillPocketSelect(selectId, inputId, value, opts = {}) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select) return;
    select.innerHTML = '';
    const addOption = (val, text) => { const o = document.createElement('option'); o.value = val; o.textContent = text; select.appendChild(o); };
    if (opts.noneLabel) addOption('', opts.noneLabel);
    projectsCache.forEach(p => addOption(p.id, bagPocketLabel(p)));
    addOption(NB_NEW_SHELF, t('nb_shelf_new_option'));
    let v = value == null ? '' : value;
    if (v === '' && !opts.noneLabel) v = projectsCache[0] ? projectsCache[0].id : NB_NEW_SHELF;
    if (v !== '' && v !== NB_NEW_SHELF && !bagPocket(v)) v = opts.noneLabel ? '' : (projectsCache[0] ? projectsCache[0].id : NB_NEW_SHELF);
    select.value = v;
    updateCustomSelectDisplay(selectId);
    if (input) {
        input.value = projectsCache.length ? '' : t('nb_default_shelf_name');
        input.classList.toggle('hidden', v !== NB_NEW_SHELF);
    }
}
function onBagPocketSelectChange(selectId, inputId) {
    const select = document.getElementById(selectId);
    const input = document.getElementById(inputId);
    if (!select || !input) return;
    input.classList.toggle('hidden', select.value !== NB_NEW_SHELF);
    if (select.value === NB_NEW_SHELF) setTimeout(() => input.focus(), 120);
}
// מחזירה את ה-id של הכיס שנבחר (יוצרת כיס חדש אם צריך), null = בלי כיס, false = יצירת הכיס נכשלה
async function bagResolvePocketSelect(selectId, inputId) {
    const select = document.getElementById(selectId);
    if (!select) return null;
    const v = select.value;
    if (v === '') return null;
    if (v !== NB_NEW_SHELF && bagPocket(v)) return v;
    const name = (document.getElementById(inputId)?.value || '').trim() || t('nb_default_shelf_name');
    const pocket = await bagCreatePocket(name);
    return pocket ? pocket.id : false;
}
async function bagCreatePocket(title, icon = '📁') {
    if (!supabaseClient || !currentUserId) return null;
    const color = BAG_POCKET_COLORS[projectsCache.length % BAG_POCKET_COLORS.length];
    const { data, error } = await supabaseClient.from('projects').insert({ user_id: currentUserId, username: currentUsername, title, icon, color }).select().maybeSingle();
    if (error || !data) { showAppToast(t('error_adding_item') + (error ? error.message : ''), 'error'); return null; }
    projectsCache.push(data);
    return data;
}
// טבלה חדשה נכנסת לכיס שממנו נפתחה ההוספה, אחרת לכיס הראשון. טבלה ישנה בלי כיס מקבלת גם "בלי כיס"
function bagPrepareTablePocketField(value, allowNone) {
    bagFillPocketSelect('table-pocket', 'table-new-pocket', value, { noneLabel: allowNone ? t('bag_pocket_none') : null });
}
// משימה: הכיס שממנו נפתחה ההוספה, או "משימות כלליות". בלי פרימיום אין כיסים - השדה מוסתר
function bagPrepareTaskPocketField(value) {
    document.querySelectorAll('#modal-add-study-item .bag-pocket-field').forEach(el => el.classList.toggle('hidden', !isPremiumUser));
    if (!isPremiumUser) { document.getElementById('study-item-new-pocket')?.classList.add('hidden'); return; }
    bagFillPocketSelect('study-item-pocket', 'study-item-new-pocket', value || '', { noneLabel: t('bag_tasks_general') });
}

// --- טבלה פתוחה (#table-view): מסך מלא מעל התיק והקלסר ---
function isTableViewOpen() {
    const view = document.getElementById('table-view');
    return !!(view && view.classList.contains('open'));
}
function openTableView(tableId) {
    if (!isPremiumUser) { openPremiumUpgradeModal(); return; }
    const view = document.getElementById('table-view');
    if (!view || !tableId) return;
    const same = isTableViewOpen() && currentOpenTableId === tableId;
    currentOpenTableId = tableId;
    if (!same) {
        // עד שהעמודות והשורות נטענות - מסך נקי (בלי "אין עמודות" שמהבהב)
        customTableColumnsCache = [];
        customTableRowsCache = [];
        ['tbl-body', 'tbl-tools'].forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
        ['table-grid-empty', 'tbl-add-row', 'tbl-row-hint', 'tbl-sum-pill'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
        if (typeof tblRenderModes === 'function') tblRenderModes();
        const scroll = document.getElementById('table-view-scroll');
        if (scroll) scroll.scrollTop = 0;
    }
    renderTableViewHead();
    view.classList.add('open');
    view.setAttribute('aria-hidden', 'false');
    bagSyncWrapper();
    return loadTableColumnsAndRows(tableId);
}
function closeTableView() {
    const view = document.getElementById('table-view');
    // תא שעדיין בעריכה נשמר ב-blur
    if (view && document.activeElement && view.contains(document.activeElement)) document.activeElement.blur();
    if (currentOpenTableId) bagRowCounts[currentOpenTableId] = customTableRowsCache.length;
    if (view) { view.classList.remove('open'); view.setAttribute('aria-hidden', 'true'); }
    currentOpenTableId = null;
    bagSyncWrapper();
    renderBag();
}
function renderTableViewHead() {
    const tb = customTablesCache.find(x => x.id === currentOpenTableId);
    const titleEl = document.getElementById('table-detail-title');
    if (titleEl && tb) titleEl.innerHTML = `<span class="tbl-title-icon" aria-hidden="true">${tableIconHtml(tb.icon)}</span><span class="tbl-title-name">${bagEsc(tb.name)}</span>`;
    const crumb = document.getElementById('table-view-crumb');
    if (crumb) {
        const p = tb ? bagPocket(tb.project_id) : null;
        crumb.textContent = p ? `${t('study_title')} › ${bagPocketLabel(p)}` : t('study_title');
    }
}
function openTableDetail(tableId) { openTableView(tableId); }
function showTablesListView() { closeTableView(); }

// יציאה מהתיק (בית / מסך אחר / סיור) סוגרת גם את הקלסר ואת הטבלה הפתוחה, בלי לרנדר מחדש
function bagCloseOverlays() {
    const table = document.getElementById('table-view');
    if (table && table.classList.contains('open')) {
        if (document.activeElement && table.contains(document.activeElement)) document.activeElement.blur();
        if (currentOpenTableId) bagRowCounts[currentOpenTableId] = customTableRowsCache.length;
        table.classList.remove('open');
        table.setAttribute('aria-hidden', 'true');
        currentOpenTableId = null;
    }
    const binder = document.getElementById('bag-binder');
    if (binder && binder.classList.contains('open')) {
        binder.classList.remove('open');
        binder.setAttribute('aria-hidden', 'true');
        bagBinderPocketId = null;
    }
    bagPendingPocketId = null;
    bagSyncWrapper();
}

// --- דוגמאות לתיק חדש: לבית, למשפחה, רעיונות וטיולים - לילדים ולהורים, אף פעם לא בית ספר. נכתבות פעם
// אחת בשפה של אותו רגע, ואפשר לשנות או למחוק אותן כמו כל דבר אחר ---
const BAG_EXAMPLES = [
    {
        key: 'home', icon: '🏠', color: '#ff4f9a',
        notebooks: [
            // דף "קניות" מחובר לרשימת הקניות של האפליקציה (אותה רשימה בשני מקומות) - בלי שורות דוגמה משלו
            { key: 'lists', emoji: '🛒', color: '#7fd1c1', pattern: 'dots', type: 'list', linked: 'shopping' },
            { key: 'recipes', emoji: '🍲', color: '#f6b26b', pattern: 'stripes', type: 'write' },
        ],
        tables: [{
            key: 'meals', icon: '🍽️',
            cols: [{ key: 'day', type: 'text' }, { key: 'dinner', type: 'text' }, { key: 'groceries', type: 'checkbox' }],
            rows: () => [[bagExDay(0), t('bag_ex_meal_1'), true], [bagExDay(1), t('bag_ex_meal_2'), true], [bagExDay(2), t('bag_ex_meal_3'), false], [bagExDay(3), t('bag_ex_meal_4'), false]],
        }],
        tasks: [['task_1', false], ['task_2', true]],
    },
    {
        key: 'family', icon: '👨‍👩‍👧', color: '#a855f7',
        notebooks: [
            { key: 'moments', emoji: '📸', color: '#b39ddb', pattern: 'plain', type: 'write' },
            { key: 'birthday', emoji: '🎂', color: '#f48fb1', pattern: 'gingham', type: 'list', items: [['birthday_1', true], ['birthday_2', false], ['birthday_3', false]] },
        ],
        tables: [{
            key: 'activities', icon: '⚽',
            cols: [{ key: 'activity', type: 'text' }, { key: 'day', type: 'text' }, { key: 'time', type: 'text' }, { key: 'paid', type: 'checkbox' }],
            rows: () => [[t('bag_ex_act_1'), bagExDay(0, true), bagExTime(17, 0), true], [t('bag_ex_act_2'), bagExDay(2, true), bagExTime(16, 30), false]],
        }],
    },
    {
        key: 'ideas', icon: '💡', color: '#00b4d8',
        notebooks: [
            { key: 'weekend', emoji: '💡', color: '#f3d36b', pattern: 'grid', type: 'list', items: [['weekend_1', false], ['weekend_2', false], ['weekend_3', false], ['weekend_4', false]] },
        ],
    },
    {
        key: 'trips', icon: '🧳', color: '#f59e0b',
        tables: [{
            key: 'packing', icon: '🧳',
            cols: [{ key: 'item', type: 'text' }, { key: 'type', type: 'select', options: [['clothes', '#22d3ee'], ['gear', '#a855f7'], ['food', '#34d399']] }, { key: 'packed', type: 'checkbox' }],
            rows: () => [[t('bag_ex_pack_1'), 1, true], [t('bag_ex_pack_2'), 0, true], [t('bag_ex_pack_3'), 1, false], [t('bag_ex_pack_4'), 2, false]],
        }],
    },
];
// שמות ימים ושעות בפורמט של השפה; בעברית ובערבית השבוע מתחיל ביום ראשון
function bagExDay(i, fromMonday) {
    const start = !fromMonday && ['he', 'ar'].includes(currentLang) ? 4 : 5; // 4.1.2026 = יום ראשון
    return new Date(2026, 0, start + i).toLocaleDateString(currentLang, { weekday: 'long' });
}
function bagExTime(h, m) { return new Date(2026, 0, 5, h, m).toLocaleTimeString(currentLang, { hour: 'numeric', minute: '2-digit' }); }

async function bagMaybeSeedExamples() {
    if (!isPremiumUser || bagSeedChecked || bagSeeding || !supabaseClient || !currentUserId) return false;
    const uid = currentUserId;
    const localKey = `weekwise_bag_seeded_${uid}`;
    try { if (localStorage.getItem(localKey) === '1') { bagSeedChecked = true; return false; } } catch { /* פרטי */ }
    try {
        const { data, error } = await supabaseClient.from('user_premium').select('bag_examples_seeded').eq('user_id', uid).maybeSingle();
        if (error || uid !== currentUserId) return false;
        bagSeedChecked = true;
        if (data && data.bag_examples_seeded) { try { localStorage.setItem(localKey, '1'); } catch { /* פרטי */ } return false; }
        // קודם הסימון ואז הדוגמאות - כדי ששני מכשירים שנפתחים באותו רגע לא ימלאו את התיק פעמיים
        const { error: flagError } = await supabaseClient.from('user_premium').upsert({ user_id: uid, username: currentUsername, bag_examples_seeded: true }, { onConflict: 'user_id' });
        if (flagError) return false;
        try { localStorage.setItem(localKey, '1'); } catch { /* פרטי */ }
        bagSeeding = true;
        bagRenderOverview();
        await bagSeedExamples(uid);
        showAppToast(t('bag_examples_toast'));
        return true;
    } catch {
        return false;
    } finally {
        if (bagSeeding) { bagSeeding = false; bagRenderOverview(); }
    }
}

// 8 בקשות בסך הכול: כיסים, מחברות, דפים, שורות, טבלאות, עמודות, שורות טבלה ומשימות
async function bagSeedExamples(uid) {
    const base = { user_id: uid, username: currentUsername };
    const { data: pockets } = await supabaseClient.from('projects').insert(BAG_EXAMPLES.map((ex, i) => ({ ...base, title: t(`bag_ex_${ex.key}`), icon: ex.icon, color: ex.color, sort_order: i + 1 }))).select();
    if (!pockets || !pockets.length) return;
    const pocketOf = ex => pockets.find(p => p.title === t(`bag_ex_${ex.key}`) && p.icon === ex.icon);
    const nbDefs = [];
    BAG_EXAMPLES.forEach(ex => { const p = pocketOf(ex); if (p) (ex.notebooks || []).forEach((nb, i) => nbDefs.push({ nb, p, sort: i + 1 })); });
    const tblDefs = [];
    BAG_EXAMPLES.forEach(ex => { const p = pocketOf(ex); if (p) (ex.tables || []).forEach((tb, i) => tblDefs.push({ tb, p, sort: i + 1 })); });
    const [nbRes, tblRes] = await Promise.all([
        nbDefs.length ? supabaseClient.from('project_notebooks').insert(nbDefs.map(d => ({ ...base, project_id: d.p.id, title: t(`bag_ex_nb_${d.nb.key}`), cover_color: d.nb.color, cover_pattern: d.nb.pattern, cover_emoji: d.nb.emoji, sort_order: d.sort }))).select() : { data: [] },
        tblDefs.length ? supabaseClient.from('custom_tables').insert(tblDefs.map(d => ({ ...base, project_id: d.p.id, name: t(`bag_ex_tb_${d.tb.key}`), icon: d.tb.icon, sort_order: d.sort }))).select() : { data: [] },
    ]);
    const notebooks = nbRes.data || [];
    const tables = tblRes.data || [];
    const tasks = [];
    BAG_EXAMPLES.forEach(ex => { const p = pocketOf(ex); if (p) (ex.tasks || []).forEach(([key, done]) => tasks.push({ ...base, project_id: p.id, title: t(`bag_ex_${key}`), is_completed: done })); });
    const pageDefs = nbDefs.map(d => ({ d, n: notebooks.find(n => n.project_id === d.p.id && n.title === t(`bag_ex_nb_${d.nb.key}`)) })).filter(x => x.n);
    const colDefs = [];
    const tableOf = d => tables.find(x => x.project_id === d.p.id && x.name === t(`bag_ex_tb_${d.tb.key}`));
    tblDefs.forEach(d => {
        const tb = tableOf(d);
        if (!tb) return;
        d.tb.cols.forEach((c, i) => colDefs.push({
            table_id: tb.id, user_id: uid, name: t(`bag_ex_col_${c.key}`), type: c.type, sort_order: (i + 1) * 10,
            select_options: c.options ? c.options.map(([key, color]) => ({ id: crypto.randomUUID(), label: t(`bag_ex_opt_${key}`), color })) : null,
            // "יש מצרכים" בארוחות השבוע מחוברת לרשימת הקניות (🛒 בשורות שלא סומנו)
            shop_link: c.key === 'groceries' ? true : null,
        }));
    });
    const [pagesRes, colsRes] = await Promise.all([
        pageDefs.length ? supabaseClient.from('notebook_pages').insert(pageDefs.map(({ d, n }) => ({ ...base, notebook_id: n.id, title: t(`bag_ex_pg_${d.nb.key}`), sort_order: 0, canvas_data: [], page_type: d.nb.type, text_content: d.nb.type === 'write' ? t(`bag_ex_txt_${d.nb.key}`) : '', linked_list: d.nb.linked || null }))).select() : { data: [] },
        colDefs.length ? supabaseClient.from('custom_table_columns').insert(colDefs).select() : { data: [] },
        tasks.length ? supabaseClient.from('study_tasks').insert(tasks) : null,
    ]);
    const pages = pagesRes.data || [];
    const cols = colsRes.data || [];
    const lines = [];
    pageDefs.forEach(({ d, n }) => {
        const page = pages.find(pg => pg.notebook_id === n.id);
        if (page) (d.nb.items || []).forEach(([key, done]) => lines.push({ ...base, notebook_id: n.id, page_id: page.id, title: t(`bag_ex_li_${key}`), is_completed: done }));
    });
    const rows = [];
    tblDefs.forEach(d => {
        const tb = tableOf(d);
        if (!tb) return;
        const tableCols = cols.filter(c => c.table_id === tb.id).sort((a, b) => a.sort_order - b.sort_order);
        d.tb.rows().forEach((vals, ri) => {
            const data = {};
            vals.forEach((v, ci) => {
                const col = tableCols[ci];
                if (!col) return;
                data[col.id] = col.type === 'select' ? ((col.select_options || [])[v] || {}).id || null : v;
            });
            rows.push({ table_id: tb.id, user_id: uid, data, sort_order: ri + 1 });
        });
    });
    await Promise.all([
        lines.length ? supabaseClient.from('notebook_items').insert(lines) : null,
        rows.length ? supabaseClient.from('custom_table_rows').insert(rows) : null,
    ]);
}
