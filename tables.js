// --- ▦ טבלה פתוחה (tables.js, נטען אחרי bag.js): שלוש תצוגות - טבלה (עמודה ראשונה צמודה בגלילה הצידה,
// אייקון סוג בכל כותרת ושורת סיכום), כרטיסים, ולוח לפי עמודת בחירה (גרירת כרטיס בין הטורים משנה את
// הערך). מיון וסינון נשמרים לכל טבלה בנפרד (custom_tables.view). נגיעה בשורה פותחת אותה ככרטיס מלא
// לעריכה (#modal-table-row) - נוח יותר בטלפון מתאים קטנים. ✓ בטבלה מסמנים ישירות ---

const TBL_TYPE_ICONS = { text: 'Aa', number: '#', select: '◉', date: '📅', checkbox: '☑' };
const TBL_COL_WIDTH = { text: 140, number: 96, select: 124, date: 118, checkbox: 76 };
const TBL_STICKY_WIDTH = 132;
const TBL_MODES = [
    { id: 'grid', icon: '▦', key: 'tbl_view_grid' },
    { id: 'cards', icon: '▤', key: 'tbl_view_cards' },
    { id: 'board', icon: '▥', key: 'tbl_view_board' },
];
const TBL_FILTER_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7.5V19l-4 1.5v-8z"></path></svg>';
let tblRowCardId = null;
let tblSaveViewTimer = null;
let tblQuickColumn = false;
let addTableRowInFlight = false;

function tblTable() { return customTablesCache.find(x => x.id === currentOpenTableId) || null; }
function tblView() {
    const tb = tblTable();
    if (!tb) return {};
    if (!tb.view || typeof tb.view !== 'object' || Array.isArray(tb.view)) tb.view = {};
    return tb.view;
}
function tblMode() { const m = tblView().mode; return TBL_MODES.some(x => x.id === m) ? m : 'grid'; }
// התצוגה, המיון והסינון נשמרים לטבלה (מכל מכשיר) - בהשהיה קצרה, כדי שכמה לחיצות ברצף ייכתבו פעם אחת
function tblSaveView() {
    const tb = tblTable();
    if (!tb || !supabaseClient) return;
    clearTimeout(tblSaveViewTimer);
    const id = tb.id;
    // שאילתה של supabase נשלחת רק ב-then/await
    tblSaveViewTimer = setTimeout(() => { supabaseClient.from('custom_tables').update({ view: { ...tb.view } }).eq('id', id).then(() => {}); }, 400);
}
function tblCol(id) { return customTableColumnsCache.find(c => c.id === id) || null; }
function tblCellValue(row, col) { return row && row.data ? row.data[col.id] : undefined; }
function tblIsEmpty(v) { return v === undefined || v === null || v === ''; }
function tblValidDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function tblOption(col, id) { return (col.select_options || []).find(o => o.id === id) || null; }
// ערך כטקסט פשוט (לכותרת הכרטיס, לחיפוש ולסינון)
function tblPlainValue(col, v) {
    if (tblIsEmpty(v)) return '';
    if (col.type === 'number') return typeof v === 'number' ? v.toLocaleString(currentLang) : String(v);
    if (col.type === 'date') return tblValidDate(v) ? formatTableDateCellLabel(v) : '';
    if (col.type === 'select') { const o = tblOption(col, v); return o ? o.label : ''; }
    if (col.type === 'checkbox') return v ? t('tbl_checked') : t('tbl_unchecked');
    return String(v);
}
// תצוגת ערך בתא / בכרטיס: צ'יפ צבעוני לבחירה, ✓ לוי, תאריך ומספר בפורמט של השפה
function tblValueHtml(col, v, opts = {}) {
    if (col.type === 'select') {
        const o = tblOption(col, v);
        return o ? `<span class="tbl-opt" style="--opt:${bagEsc(o.color)}">${bagEsc(o.label)}</span>` : '<span class="tbl-muted">—</span>';
    }
    if (col.type === 'checkbox') {
        if (opts.words) return v ? `<span class="tbl-yes">${bagEsc(t('tbl_yes'))}</span>` : `<span class="tbl-muted">${bagEsc(t('tbl_no'))}</span>`;
        return '';
    }
    const text = tblPlainValue(col, v);
    if (!text) return '<span class="tbl-muted">—</span>';
    return `<span class="${col.type === 'number' ? 'tbl-num ' : ''}tbl-td-text">${bagEsc(text)}</span>`;
}

// --- מיון וסינון ---
function tblCompare(a, b, col, dir) {
    const va = tblCellValue(a, col), vb = tblCellValue(b, col);
    const ea = tblIsEmpty(va) || (col.type === 'select' && !tblOption(col, va)), eb = tblIsEmpty(vb) || (col.type === 'select' && !tblOption(col, vb));
    if (ea && eb) return 0;
    if (ea) return 1; // ריקים תמיד בסוף, בשני הכיוונים
    if (eb) return -1;
    let r;
    if (col.type === 'number') r = Number(va) - Number(vb);
    else if (col.type === 'checkbox') r = (va ? 1 : 0) - (vb ? 1 : 0);
    else if (col.type === 'select') { const opts = col.select_options || []; r = opts.findIndex(o => o.id === va) - opts.findIndex(o => o.id === vb); }
    else r = String(va).localeCompare(String(vb), currentLang, { numeric: true, sensitivity: 'base' });
    return r * dir;
}
function tblMatches(row, col, value) {
    const v = tblCellValue(row, col);
    if (col.type === 'checkbox') return !!v === (value === true);
    if (col.type === 'select') return value === '' ? !tblOption(col, v) : v === value;
    return tblPlainValue(col, v).toLowerCase().includes(String(value || '').toLowerCase());
}
function tblVisibleRows() {
    const v = tblView();
    let rows = customTableRowsCache.slice();
    const fcol = v.filter ? tblCol(v.filter.col) : null;
    if (fcol) rows = rows.filter(r => tblMatches(r, fcol, v.filter.value));
    const scol = v.sort ? tblCol(v.sort.col) : null;
    if (scol) { const dir = v.sort.dir === 'desc' ? -1 : 1; rows.sort((a, b) => tblCompare(a, b, scol, dir)); }
    return rows;
}
function tblFilterLabel(v) {
    const col = v.filter ? tblCol(v.filter.col) : null;
    if (!col) return '';
    let val;
    if (col.type === 'checkbox') val = t(v.filter.value === true ? 'tbl_checked' : 'tbl_unchecked');
    else if (col.type === 'select') val = v.filter.value === '' ? t('tbl_filter_empty_value') : (tblOption(col, v.filter.value) || {}).label || '';
    else val = `“${v.filter.value}”`;
    return `${col.name}: ${val}`;
}

// --- המסך: תצוגות, כלים, והגוף לפי התצוגה ---
function renderTableGrid() {
    const body = document.getElementById('tbl-body');
    if (!body) return;
    tblRenderModes();
    tblRenderTools();
    tblRenderSumPill();
    const empty = document.getElementById('table-grid-empty');
    const addRow = document.getElementById('tbl-add-row');
    const hint = document.getElementById('tbl-row-hint');
    body.innerHTML = '';
    const cols = customTableColumnsCache;
    const mode = tblMode();
    if (!cols.length) {
        empty.innerHTML = '';
        empty.insertAdjacentHTML('beforeend', `<span>${bagEsc(t('tbl_no_columns'))}</span>`);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bag-chip-btn';
        b.textContent = t('tbl_add_column');
        b.onclick = () => openTableQuickAddColumn();
        empty.appendChild(b);
        empty.classList.remove('hidden');
        addRow.classList.add('hidden');
        hint.classList.add('hidden');
        return;
    }
    const rows = tblVisibleRows();
    if (mode === 'cards') body.appendChild(tblBuildCards(rows));
    else if (mode === 'board') body.appendChild(tblBuildBoard(rows));
    else body.appendChild(tblBuildGrid(rows));
    const noRows = !customTableRowsCache.length;
    empty.textContent = noRows ? t('tbl_empty_rows') : t('tbl_filter_no_results');
    empty.classList.toggle('hidden', !noRows && rows.length > 0);
    addRow.classList.remove('hidden');
    addRow.textContent = mode === 'grid' ? t('table_add_row_btn') : t('tbl_new_card');
    addRow.classList.toggle('is-strong', mode !== 'grid');
    hint.classList.toggle('hidden', mode !== 'grid' || noRows);
}

function tblRenderModes() {
    const wrap = document.getElementById('tbl-modes');
    if (!wrap) return;
    const mode = tblMode();
    wrap.innerHTML = '';
    TBL_MODES.forEach(m => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tbl-mode' + (m.id === mode ? ' active' : '');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', m.id === mode ? 'true' : 'false');
        b.innerHTML = `<span aria-hidden="true">${m.icon}</span><span class="tbl-mode-label">${bagEsc(t(m.key))}</span>`;
        b.onclick = () => { if (m.id === tblMode()) return; tblView().mode = m.id; tblSaveView(); renderTableGrid(); };
        wrap.appendChild(b);
    });
}

function tblRenderTools() {
    const tools = document.getElementById('tbl-tools');
    if (!tools) return;
    tools.innerHTML = '';
    const v = tblView();
    const cols = customTableColumnsCache;
    if (cols.length) {
        const scol = v.sort ? tblCol(v.sort.col) : null;
        const sort = document.createElement('button');
        sort.type = 'button';
        sort.className = 'tbl-chip' + (scol ? ' active' : '');
        sort.textContent = scol ? `${v.sort.dir === 'desc' ? '↓' : '↑'} ${t('tbl_sort_by').replace('{col}', scol.name)}` : `↕ ${t('tbl_sort')}`;
        sort.onclick = () => openTableSortPicker();
        tools.appendChild(sort);
        const flabel = tblFilterLabel(v);
        const filter = document.createElement('button');
        filter.type = 'button';
        filter.className = 'tbl-chip' + (flabel ? ' active' : '');
        filter.innerHTML = `${TBL_FILTER_SVG}<span class="tbl-chip-text">${bagEsc(flabel || t('tbl_filter'))}</span>`;
        filter.onclick = () => openTableFilterPicker();
        if (flabel) {
            const x = document.createElement('span');
            x.className = 'tbl-chip-x';
            x.setAttribute('role', 'button');
            x.setAttribute('aria-label', t('tbl_filter_clear'));
            x.textContent = '×';
            x.onclick = e => { e.stopPropagation(); delete tblView().filter; tblSaveView(); renderTableGrid(); };
            filter.appendChild(x);
        }
        tools.appendChild(filter);
    }
    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'tbl-chip is-accent';
    add.textContent = t('tbl_add_column');
    add.onclick = () => openTableQuickAddColumn();
    tools.appendChild(add);
}

// בכרטיסים ובלוח (שאין בהם שורת סיכום): סכום עמודת המספר הראשונה ו-✓ של עמודת הוי הראשונה, ליד הכותרת
function tblRenderSumPill() {
    const pill = document.getElementById('tbl-sum-pill');
    if (!pill) return;
    const parts = [];
    if (tblMode() !== 'grid') {
        const rows = tblVisibleRows();
        const num = customTableColumnsCache.find(c => c.type === 'number');
        const chk = customTableColumnsCache.find(c => c.type === 'checkbox');
        if (num) { const vals = rows.map(r => tblCellValue(r, num)).filter(x => typeof x === 'number'); if (vals.length) parts.push(`Σ ${vals.reduce((a, b) => a + b, 0).toLocaleString(currentLang)}`); }
        if (chk && rows.length) parts.push(`✓ ${rows.filter(r => tblCellValue(r, chk)).length.toLocaleString(currentLang)}/${rows.length.toLocaleString(currentLang)}`);
    }
    pill.textContent = parts.join(' · ');
    pill.classList.toggle('hidden', !parts.length);
}

// --- תצוגת טבלה: שורות flex (כך שהעמודה הראשונה נצמדת בגלילה הצידה), כותרת = מיון ---
// עמודת ✓ שמחוברת לרשימת הקניות רחבה יותר - יש בה גם את כפתור ה-🛒
function tblColWidth(col, index) { return index === 0 ? TBL_STICKY_WIDTH : (tblIsShopCol(col) ? 104 : (TBL_COL_WIDTH[col.type] || 130)); }
function tblBuildGrid(rows) {
    const cols = customTableColumnsCache;
    const v = tblView();
    const wrap = document.createElement('div');
    wrap.className = 'tbl-grid-scroll';
    const grid = document.createElement('div');
    grid.className = 'tbl-grid';
    grid.setAttribute('role', 'table');
    const head = document.createElement('div');
    head.className = 'tbl-tr is-head';
    head.setAttribute('role', 'row');
    cols.forEach((col, i) => {
        const th = document.createElement('button');
        th.type = 'button';
        th.className = 'tbl-th' + (i === 0 ? ' is-sticky' : '');
        th.style.width = `${tblColWidth(col, i)}px`;
        th.setAttribute('role', 'columnheader');
        const sorted = v.sort && v.sort.col === col.id;
        th.innerHTML = `<span class="tbl-th-icon" aria-hidden="true">${TBL_TYPE_ICONS[col.type] || 'Aa'}</span><span class="tbl-th-name">${bagEsc(col.name)}</span>${sorted ? `<span class="tbl-th-sort" aria-hidden="true">${v.sort.dir === 'desc' ? '↓' : '↑'}</span>` : ''}`;
        th.setAttribute('aria-sort', sorted ? (v.sort.dir === 'desc' ? 'descending' : 'ascending') : 'none');
        th.onclick = () => tblToggleSort(col.id);
        head.appendChild(th);
    });
    grid.appendChild(head);
    rows.forEach(row => {
        const tr = document.createElement('div');
        tr.className = 'tbl-tr';
        tr.setAttribute('role', 'row');
        tr.dataset.rowId = row.id;
        tr.tabIndex = 0;
        tr.onclick = () => openTableRowCard(row.id);
        tr.onkeydown = e => { if (e.key === 'Enter') openTableRowCard(row.id); };
        cols.forEach((col, i) => {
            const td = document.createElement('div');
            td.className = 'tbl-td' + (i === 0 ? ' is-sticky' : '');
            td.style.width = `${tblColWidth(col, i)}px`;
            td.setAttribute('role', 'cell');
            const val = tblCellValue(row, col);
            if (col.type === 'checkbox') {
                const b = document.createElement('button');
                b.type = 'button';
                b.className = 'tbl-check' + (val ? ' on' : '');
                b.setAttribute('aria-pressed', val ? 'true' : 'false');
                b.setAttribute('aria-label', col.name);
                b.innerHTML = val ? BAG_CHECK_SVG : '';
                b.onclick = e => { e.stopPropagation(); tblSetCell(row.id, col.id, !val); };
                td.appendChild(b);
                if (!val && tblIsShopCol(col)) { td.classList.add('has-shop'); td.appendChild(tblShopButton(row.id, col.id)); }
            } else {
                td.innerHTML = tblValueHtml(col, val);
            }
            tr.appendChild(td);
        });
        grid.appendChild(tr);
    });
    if (customTableRowsCache.length) grid.appendChild(tblBuildSummary(rows));
    wrap.appendChild(grid);
    return wrap;
}
// שורת הסיכום: מספר השורות, סכום כל עמודת מספר, וכמה ✓ מתוך כמה
function tblBuildSummary(rows) {
    const cols = customTableColumnsCache;
    const tr = document.createElement('div');
    tr.className = 'tbl-tr is-sum';
    tr.setAttribute('role', 'row');
    let countShown = false;
    cols.forEach((col, i) => {
        const td = document.createElement('div');
        td.className = 'tbl-td' + (i === 0 ? ' is-sticky' : '');
        td.style.width = `${tblColWidth(col, i)}px`;
        td.setAttribute('role', 'cell');
        let text = '';
        if (i === 0) text = t('tbl_summary');
        else if (col.type === 'number') { const vals = rows.map(r => tblCellValue(r, col)).filter(x => typeof x === 'number'); if (vals.length) text = vals.reduce((a, b) => a + b, 0).toLocaleString(currentLang); }
        else if (col.type === 'checkbox') text = `${rows.filter(r => tblCellValue(r, col)).length.toLocaleString(currentLang)}/${rows.length.toLocaleString(currentLang)}`;
        else if (!countShown && (col.type === 'text' || col.type === 'date' || col.type === 'select')) { text = bagPlural('bag_rows', rows.length); countShown = true; td.classList.add('is-count'); }
        td.innerHTML = text ? `<span class="tbl-num tbl-td-text">${bagEsc(text)}</span>` : '';
        tr.appendChild(td);
    });
    return tr;
}

// --- תצוגת כרטיסים: כותרת = העמודה הראשונה, צ'יפ = עמודת הבחירה הראשונה, ושאר השדות ברשת ---
function tblBuildCards(rows) {
    const list = document.createElement('div');
    list.className = 'tbl-cards';
    rows.forEach(row => list.appendChild(tblBuildCard(row)));
    return list;
}
// הכרטיס הוא div עם role=button (לא <button>) - כדי שכפתור ה-🛒 יוכל לשבת בתוכו
function tblBuildCard(row, compact, skipColId) {
    const cols = customTableColumnsCache;
    const titleCol = cols[0];
    const statusCol = cols.find((c, i) => i > 0 && c.type === 'select' && c.id !== skipColId);
    const card = document.createElement('div');
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.className = 'tbl-card' + (compact ? ' is-compact' : '');
    card.dataset.rowId = row.id;
    const status = statusCol ? tblOption(statusCol, tblCellValue(row, statusCol)) : null;
    if (status) card.style.setProperty('--tbl-accent', status.color);
    const title = tblPlainValue(titleCol, tblCellValue(row, titleCol));
    const head = `<span class="tbl-card-head"><span class="tbl-card-title">${title ? bagEsc(title) : '<span class="tbl-muted">—</span>'}</span>${status ? tblValueHtml(statusCol, status.id) : ''}</span>`;
    const fields = cols.filter((c, i) => i > 0 && c !== statusCol && c.id !== skipColId).slice(0, compact ? 2 : 6);
    const grid = fields.length ? `<span class="tbl-card-fields">${fields.map(c => `<span class="tbl-card-field"><span class="tbl-card-label">${bagEsc(c.name)}</span><span class="tbl-card-value" data-col-id="${bagEsc(c.id)}">${tblValueHtml(c, tblCellValue(row, c), { words: true })}</span></span>`).join('')}</span>` : '';
    card.innerHTML = head + grid;
    fields.forEach(c => {
        if (!tblIsShopCol(c) || tblCellValue(row, c)) return;
        const slot = card.querySelector(`.tbl-card-value[data-col-id="${CSS.escape(c.id)}"]`);
        if (slot) slot.appendChild(tblShopButton(row.id, c.id));
    });
    card.onclick = () => openTableRowCard(row.id);
    card.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openTableRowCard(row.id); } };
    return card;
}

// --- תצוגת לוח: טור לכל אפשרות של עמודת בחירה (+ "בלי ערך" כשיש כאלה); גרירה בין טורים משנה את הערך ---
function tblBuildBoard(rows) {
    const cols = customTableColumnsCache;
    const v = tblView();
    const wrap = document.createElement('div');
    const selects = cols.filter(c => c.type === 'select');
    if (!selects.length) {
        wrap.className = 'tbl-board-need';
        wrap.innerHTML = `<p>${bagEsc(t('tbl_board_need_select'))}</p>`;
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bag-chip-btn';
        b.textContent = t('tbl_board_add_select');
        b.onclick = () => openTableQuickAddColumn('select');
        wrap.appendChild(b);
        return wrap;
    }
    const boardCol = selects.find(c => c.id === v.board) || selects[0];
    wrap.className = 'tbl-board-wrap';
    if (selects.length > 1) {
        const by = document.createElement('div');
        by.className = 'tbl-board-by';
        by.innerHTML = `<span>${bagEsc(t('tbl_board_by'))}</span>`;
        selects.forEach(c => {
            const b = document.createElement('button');
            b.type = 'button';
            b.className = 'tbl-chip' + (c === boardCol ? ' active' : '');
            b.textContent = c.name;
            b.onclick = () => { tblView().board = c.id; tblSaveView(); renderTableGrid(); };
            by.appendChild(b);
        });
        wrap.appendChild(by);
    }
    const board = document.createElement('div');
    board.className = 'tbl-board';
    const lanes = (boardCol.select_options || []).map(o => ({ id: o.id, label: o.label, color: o.color }));
    if (rows.some(r => !tblOption(boardCol, tblCellValue(r, boardCol)))) lanes.push({ id: '', label: t('tbl_filter_empty_value'), color: null });
    const lists = [];
    lanes.forEach(lane => {
        const laneRows = rows.filter(r => (tblOption(boardCol, tblCellValue(r, boardCol)) ? tblCellValue(r, boardCol) : '') === lane.id);
        const el = document.createElement('section');
        el.className = 'tbl-lane';
        if (lane.color) el.style.setProperty('--lane', lane.color);
        el.innerHTML = `<div class="tbl-lane-head"><span class="tbl-lane-dot" aria-hidden="true"></span><span class="tbl-lane-name">${bagEsc(lane.label)}</span><span class="tbl-lane-count">${laneRows.length.toLocaleString(currentLang)}</span></div>`;
        const list = document.createElement('div');
        list.className = 'tbl-lane-list';
        list.dataset.laneId = lane.id;
        laneRows.forEach(r => list.appendChild(tblBuildCard(r, true, boardCol.id)));
        el.appendChild(list);
        board.appendChild(el);
        lists.push(list);
    });
    wrap.appendChild(board);
    if (typeof Sortable !== 'undefined') {
        lists.forEach(list => new Sortable(list, {
            group: 'tbl-board', animation: 150, delay: 150, delayOnTouchOnly: true, ghostClass: 'sortable-ghost', chosenClass: 'sortable-chosen',
            onAdd: e => tblSetCell(e.item.dataset.rowId, boardCol.id, e.to.dataset.laneId || null),
        }));
    }
    return wrap;
}

// --- 🛒 עמודת ✓ שמחוברת לרשימת הקניות (למשל "יש מצרכים" בארוחות השבוע, לפי בקשה מפורשת): בשורה שלא
// מסומנת יש כפתור 🛒 שמוסיף אותה לרשימת הקניות - פעם אחת בלבד (הפריט מקושר לתא דרך
// my_center_tasks.source_ref). מסמנים כאן ✓ (יש) - הפריט יורד מהרשימה; מוחקים אותו ברשימה - גם כאן הוא
// כבר לא "ברשימה"; מסמנים אותו שם כנקנה - התא כאן מסומן ✓ לבד (ר' syncShopItemToTable ב-app.js) ---
let tblShopItems = new Map();
let tblShopNameSetCache = null;
// עמודה שלא נקבע לה במפורש (shop_link ריק) - מחוברת אם השם שלה הוא שם עמודת הדוגמה "יש מצרכים" באחת השפות
function tblShopNameSet() {
    if (!tblShopNameSetCache) tblShopNameSetCache = new Set(SUPPORTED_LANGUAGES.map(l => translations[l] && translations[l].bag_ex_col_groceries).filter(Boolean));
    return tblShopNameSetCache;
}
function tblIsShopCol(col) {
    if (!col || col.type !== 'checkbox') return false;
    if (col.shop_link === true || col.shop_link === false) return col.shop_link;
    return tblShopNameSet().has(String(col.name || '').trim());
}
function tblShopRef(rowId, colId) { return `tbl:${currentOpenTableId}:${rowId}:${colId}`; }
async function tblLoadShopItems() {
    tblShopItems = new Map();
    if (!supabaseClient || !currentUserId || !currentOpenTableId || !customTableColumnsCache.some(tblIsShopCol)) return;
    const tableId = currentOpenTableId;
    const { data } = await supabaseClient.from('my_center_tasks').select('id, source_ref, is_completed').eq('user_id', currentUserId).eq('task_type', 'general').eq('is_deleted', false).like('source_ref', `tbl:${tableId}:%`);
    if (tableId !== currentOpenTableId) return;
    (data || []).forEach(it => tblShopItems.set(it.source_ref, it));
}
// שם הפריט ברשימה: עמודת הטקסט הבאה שיש בה משהו (בארוחות השבוע - שם הארוחה, לא היום), אחרת העמודה הראשונה
function tblShopName(row) {
    const cols = customTableColumnsCache;
    const col = cols.find((c, i) => i > 0 && c.type === 'text' && !tblIsEmpty(tblCellValue(row, c))) || cols[0];
    return (col ? tblPlainValue(col, tblCellValue(row, col)) : '') || (tblTable() || {}).name || '';
}
async function tblAddToShopping(rowId, colId) {
    const row = customTableRowsCache.find(r => r.id === rowId);
    if (!row || !supabaseClient || !currentUserId) return;
    const ref = tblShopRef(rowId, colId);
    if (tblShopItems.has(ref)) { showAppToast(t('tbl_shop_already')); return; }
    const content = t('tbl_shop_item').replace('{name}', tblShopName(row));
    const { data, error } = await supabaseClient.from('my_center_tasks').insert({ username: currentUsername, user_id: currentUserId, task_type: 'general', content, source_ref: ref, is_completed: false, is_deleted: false }).select('id, source_ref, is_completed').single();
    if (error || !data) { showAppToast(t('error_adding_item') + (error ? error.message : ''), 'error'); return; }
    tblShopItems.set(ref, data);
    showAppToast(t('tbl_shop_added_toast'));
    if (typeof loadCenterItems === 'function') loadCenterItems('general');
    renderTableGrid();
    if (tblRowCardId === rowId) tblRenderRowCard();
}
// ✓ "יש" / שורה שנמחקה - הפריט המקושר יורד מרשימת הקניות (לארכיון שלה, כמו מחיקה רגילה שם)
async function tblDropShopItems(refs) {
    const ids = refs.map(r => tblShopItems.get(r)).filter(Boolean).map(it => it.id);
    refs.forEach(r => tblShopItems.delete(r));
    if (!ids.length || !supabaseClient) return;
    await supabaseClient.from('my_center_tasks').update({ is_deleted: true, deleted_at: new Date().toISOString() }).in('id', ids);
    if (typeof loadCenterItems === 'function') loadCenterItems('general');
}
// כפתור קטן ליד ✓ שלא סומן: 🛒 (להוסיף) או 🛒✓ (כבר ברשימה)
function tblShopButton(rowId, colId) {
    const inList = tblShopItems.has(tblShopRef(rowId, colId));
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tbl-shop-btn' + (inList ? ' is-in' : '');
    b.innerHTML = inList ? '🛒<span aria-hidden="true">✓</span>' : '🛒';
    b.title = t(inList ? 'tbl_shop_in_list' : 'tbl_shop_add');
    b.setAttribute('aria-label', b.title);
    b.onclick = e => { e.stopPropagation(); if (inList) showAppToast(t('tbl_shop_already')); else tblAddToShopping(rowId, colId); };
    b.onkeydown = e => e.stopPropagation();
    return b;
}

// --- עריכה ---
async function tblSetCell(rowId, colId, value) {
    await updateCellValue(rowId, colId, value);
    if (value === true && tblIsShopCol(tblCol(colId))) await tblDropShopItems([tblShopRef(rowId, colId)]);
    renderTableGrid();
}
function tblToggleSort(colId) {
    const v = tblView();
    if (v.sort && v.sort.col === colId) {
        if (v.sort.dir === 'asc') v.sort = { col: colId, dir: 'desc' };
        else delete v.sort;
    } else {
        v.sort = { col: colId, dir: 'asc' };
    }
    tblSaveView();
    renderTableGrid();
}

// שורה חדשה נפתחת מיד ככרטיס, מוכנה למילוי
async function addTableRow() {
    if (addTableRowInFlight) return;
    if (!supabaseClient || !currentUserId || !currentOpenTableId) return;
    addTableRowInFlight = true;
    try {
        const { data, error } = await supabaseClient.from('custom_table_rows').insert({ table_id: currentOpenTableId, user_id: currentUserId, data: {}, sort_order: Date.now() }).select().single();
        if (error || !data) { showAppToast(t('error_adding_item') + (error ? error.message : ''), 'error'); return; }
        customTableRowsCache.push(data);
        bagRowCounts[currentOpenTableId] = customTableRowsCache.length;
        renderTableGrid();
        openTableRowCard(data.id, true);
    } finally {
        addTableRowInFlight = false;
    }
}

// --- כרטיס שורה (חלון): כל העמודות עם עורך לפי הסוג; כל שינוי נשמר מיד ---
function openTableRowCard(rowId, focusFirst) {
    if (!customTableRowsCache.some(r => r.id === rowId)) return;
    tblRowCardId = rowId;
    tblRenderRowCard();
    openModal('modal-table-row');
    if (focusFirst) setTimeout(() => { const first = document.querySelector('#tbl-row-fields .tbl-input'); if (first) first.focus(); }, 160);
}
function closeTableRowCard() {
    const modal = document.getElementById('modal-table-row');
    // שדה שעדיין בעריכה נשמר ב-change
    if (modal && document.activeElement && modal.contains(document.activeElement)) document.activeElement.blur();
    closeModal('modal-table-row');
    tblRowCardId = null;
}
function tblRenderRowCard() {
    const row = customTableRowsCache.find(r => r.id === tblRowCardId);
    const wrap = document.getElementById('tbl-row-fields');
    if (!row || !wrap) return;
    const first = customTableColumnsCache[0];
    const title = first ? tblPlainValue(first, tblCellValue(row, first)) : '';
    document.getElementById('tbl-row-title').textContent = title || t('tbl_row_card_title');
    wrap.innerHTML = '';
    customTableColumnsCache.forEach(col => wrap.appendChild(tblBuildField(row, col)));
}
function tblAutoGrow(el) { el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 180)}px`; }
function tblBuildField(row, col) {
    const field = document.createElement('div');
    field.className = 'tbl-field';
    const label = document.createElement('label');
    label.className = 'tbl-field-label';
    label.innerHTML = `<span class="tbl-th-icon" aria-hidden="true">${TBL_TYPE_ICONS[col.type] || 'Aa'}</span><span>${bagEsc(col.name)}</span>`;
    field.appendChild(label);
    const val = tblCellValue(row, col);
    const rerender = async value => { await updateCellValue(row.id, col.id, value); tblRenderRowCard(); renderTableGrid(); };
    if (col.type === 'checkbox') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tbl-toggle' + (val ? ' on' : '');
        b.setAttribute('aria-pressed', val ? 'true' : 'false');
        b.innerHTML = `<span class="tbl-toggle-box" aria-hidden="true">${val ? BAG_CHECK_SVG : ''}</span><span>${bagEsc(t(val ? 'tbl_checked' : 'tbl_unchecked'))}</span>`;
        b.onclick = async () => {
            if (!val && tblIsShopCol(col)) await tblDropShopItems([tblShopRef(row.id, col.id)]);
            rerender(!val);
        };
        field.appendChild(b);
        // 🛒 בכרטיס: להוסיף לרשימת הקניות, או "כבר ברשימה" עם אפשרות להוריד
        if (!val && tblIsShopCol(col)) {
            const ref = tblShopRef(row.id, col.id);
            const line = document.createElement('div');
            line.className = 'tbl-shop-line';
            if (tblShopItems.has(ref)) {
                line.innerHTML = `<span class="tbl-shop-status">${bagEsc(t('tbl_shop_in_list'))}</span>`;
                const off = document.createElement('button');
                off.type = 'button';
                off.className = 'tbl-shop-off';
                off.textContent = t('tbl_shop_remove');
                off.onclick = async () => { await tblDropShopItems([ref]); tblRenderRowCard(); renderTableGrid(); };
                line.appendChild(off);
            } else {
                const add = document.createElement('button');
                add.type = 'button';
                add.className = 'tbl-shop-add';
                add.textContent = t('tbl_shop_add');
                add.onclick = () => tblAddToShopping(row.id, col.id);
                line.appendChild(add);
            }
            field.appendChild(line);
        }
    } else if (col.type === 'select') {
        field.appendChild(tblBuildOptionChips(row, col));
    } else if (col.type === 'date') {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tbl-date-btn';
        b.textContent = tblValidDate(val) ? formatTableDateCellLabel(val) : t('tbl_pick_date');
        b.onclick = () => openCustomDatePicker(tblValidDate(val) ? val : null, d => rerender(d || null));
        field.appendChild(b);
    } else {
        const input = document.createElement(col.type === 'number' ? 'input' : 'textarea');
        input.className = 'tbl-input';
        input.id = `tbl-f-${col.id}`;
        label.htmlFor = input.id;
        if (col.type === 'number') {
            input.type = 'number';
            input.inputMode = 'decimal';
            input.value = typeof val === 'number' ? val : '';
        } else {
            input.rows = 1;
            input.value = tblIsEmpty(val) ? '' : String(val);
            input.oninput = () => tblAutoGrow(input);
            setTimeout(() => tblAutoGrow(input), 0);
        }
        input.onchange = async () => {
            const raw = input.value.trim();
            let value = raw || null;
            if (col.type === 'number') { const n = raw === '' ? null : parseFloat(raw); value = Number.isNaN(n) ? null : n; }
            await updateCellValue(row.id, col.id, value);
            if (col === customTableColumnsCache[0]) document.getElementById('tbl-row-title').textContent = tblPlainValue(col, value) || t('tbl_row_card_title');
            renderTableGrid();
        };
        field.appendChild(input);
    }
    return field;
}
// עמודת בחירה בכרטיס: צ'יפים בצבעי האפשרויות (נגיעה בנבחר מנקה), × מוחק אפשרות מהעמודה, ו"✏️ אחר" מוסיף
function tblBuildOptionChips(row, col) {
    const box = document.createElement('div');
    box.className = 'tbl-chips';
    const current = tblCellValue(row, col);
    (col.select_options || []).forEach(opt => {
        const chip = document.createElement('span');
        chip.className = 'tbl-chip-opt' + (opt.id === current ? ' selected' : '');
        chip.style.setProperty('--opt', opt.color);
        const pick = document.createElement('button');
        pick.type = 'button';
        pick.className = 'tbl-chip-pick';
        pick.textContent = opt.label;
        pick.setAttribute('aria-pressed', opt.id === current ? 'true' : 'false');
        pick.onclick = async () => { await updateCellValue(row.id, col.id, opt.id === current ? null : opt.id); tblRenderRowCard(); renderTableGrid(); };
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'tbl-chip-del';
        del.textContent = '×';
        del.setAttribute('aria-label', `${t('table_select_option_delete_title')}: ${opt.label}`);
        del.onclick = () => tblDeleteOption(col, opt.id);
        chip.append(pick, del);
        box.appendChild(chip);
    });
    const other = document.createElement('button');
    other.type = 'button';
    other.className = 'tbl-chip-other';
    other.textContent = t('select_other_manual');
    other.onclick = () => {
        const wrap = document.createElement('div');
        wrap.className = 'select-other-manual-row';
        const input = document.createElement('input');
        input.type = 'text';
        input.maxLength = 60;
        input.placeholder = t('select_other_placeholder');
        const add = document.createElement('button');
        add.type = 'button';
        add.className = 'btn-primary';
        add.textContent = t('add_btn');
        add.onclick = () => tblAddOption(row, col, input.value);
        input.onkeydown = e => { if (e.key === 'Enter') tblAddOption(row, col, input.value); };
        wrap.append(input, add);
        other.replaceWith(wrap);
        input.focus();
    };
    box.appendChild(other);
    return box;
}
// ערך חדש נכנס כאפשרות קבועה של העמודה (בפעם הבאה הוא כבר ברשימה) ונבחר לשורה
async function tblAddOption(row, col, raw) {
    const label = String(raw || '').trim();
    if (!label) return;
    const options = col.select_options || [];
    let opt = options.find(o => o.label.trim().toLowerCase() === label.toLowerCase());
    if (!opt) {
        opt = { id: crypto.randomUUID(), label, color: TABLE_SELECT_OPTION_COLOR_PRESETS[options.length % TABLE_SELECT_OPTION_COLOR_PRESETS.length] };
        const next = [...options, opt];
        const { error } = await supabaseClient.from('custom_table_columns').update({ select_options: next }).eq('id', col.id);
        if (error) { showAppToast(t('error_adding_item'), 'error'); return; }
        col.select_options = next;
    }
    await updateCellValue(row.id, col.id, opt.id);
    tblRenderRowCard();
    renderTableGrid();
}
// מחיקת אפשרות מהעמודה; אם יש שורות שמשתמשות בה - קודם אישור, והתאים האלה מתרוקנים
function tblDeleteOption(col, optionId) {
    const used = customTableRowsCache.filter(r => r.data && r.data[col.id] === optionId);
    const run = async () => {
        const prev = col.select_options || [];
        const next = prev.filter(o => o.id !== optionId);
        const { error } = await supabaseClient.from('custom_table_columns').update({ select_options: next }).eq('id', col.id);
        if (error) { showAppToast(t('error_adding_item'), 'error'); return; }
        col.select_options = next;
        for (const r of used) await updateCellValue(r.id, col.id, null);
        tblRenderRowCard();
        renderTableGrid();
    };
    if (used.length) showDangerConfirm(t('table_select_option_delete_title'), t('table_select_option_delete_confirm').replace('{count}', used.length), run);
    else run();
}
function deleteTableRowFromCard() {
    const id = tblRowCardId;
    const row = customTableRowsCache.find(r => r.id === id);
    if (!row) return;
    const first = customTableColumnsCache[0];
    const title = first ? tblPlainValue(first, tblCellValue(row, first)) : '';
    closeTableRowCard();
    showDangerConfirm(t('tbl_row_delete_confirm'), title, async () => {
        const { error } = await supabaseClient.from('custom_table_rows').delete().eq('id', id);
        if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
        customTableRowsCache = customTableRowsCache.filter(r => r.id !== id);
        bagRowCounts[currentOpenTableId] = customTableRowsCache.length;
        // שורה שנמחקה - גם הפריטים שלה ברשימת הקניות יורדים
        await tblDropShopItems(customTableColumnsCache.filter(tblIsShopCol).map(c => tblShopRef(id, c.id)));
        renderTableGrid();
    });
}

// --- בחירה מתוך רשימה (מיון / סינון) - חלון אחד שמתמלא לפי הצורך ---
function tblPick(title, items, extra) {
    document.getElementById('tbl-pick-title').textContent = title;
    const list = document.getElementById('tbl-pick-list');
    list.innerHTML = '';
    items.forEach(item => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'tbl-pick-row' + (item.danger ? ' is-danger' : '');
        const lead = item.color ? `<span class="tbl-pick-dot" style="--opt:${bagEsc(item.color)}" aria-hidden="true"></span>` : `<span class="tbl-pick-icon" aria-hidden="true">${bagEsc(item.icon || '')}</span>`;
        b.innerHTML = `${lead}<span class="tbl-pick-label">${bagEsc(item.label)}</span>${item.mark ? `<span class="tbl-pick-mark" aria-hidden="true">${bagEsc(item.mark)}</span>` : ''}`;
        if (item.mark) b.setAttribute('aria-current', 'true');
        b.onclick = () => { if (!item.keepOpen) closeModal('modal-table-pick'); item.run(); };
        list.appendChild(b);
    });
    if (extra) list.appendChild(extra);
    openModal('modal-table-pick');
}
function openTableSortPicker() {
    const v = tblView();
    const items = customTableColumnsCache.map(c => ({
        icon: TBL_TYPE_ICONS[c.type] || 'Aa', label: c.name,
        mark: v.sort && v.sort.col === c.id ? (v.sort.dir === 'desc' ? '↓' : '↑') : '',
        run: () => { const cur = tblView().sort; tblView().sort = { col: c.id, dir: cur && cur.col === c.id && cur.dir === 'asc' ? 'desc' : 'asc' }; tblSaveView(); renderTableGrid(); },
    }));
    if (v.sort) items.push({ icon: '✕', label: t('tbl_sort_none'), run: () => { delete tblView().sort; tblSaveView(); renderTableGrid(); } });
    tblPick(t('tbl_sort_title'), items);
}
function openTableFilterPicker() {
    const v = tblView();
    const items = customTableColumnsCache.map(c => ({
        icon: TBL_TYPE_ICONS[c.type] || 'Aa', label: c.name, mark: v.filter && v.filter.col === c.id ? '●' : '', keepOpen: true,
        run: () => tblFilterValues(c),
    }));
    if (v.filter) items.push({ icon: '✕', label: t('tbl_filter_clear'), run: () => { delete tblView().filter; tblSaveView(); renderTableGrid(); } });
    tblPick(t('tbl_filter_title'), items);
}
function tblFilterValues(col) {
    const set = value => { tblView().filter = { col: col.id, value }; tblSaveView(); renderTableGrid(); };
    const cur = tblView().filter && tblView().filter.col === col.id ? tblView().filter.value : undefined;
    if (col.type === 'select') {
        tblPick(col.name, [
            ...(col.select_options || []).map(o => ({ color: o.color, label: o.label, mark: cur === o.id ? '✓' : '', run: () => set(o.id) })),
            { icon: '∅', label: t('tbl_filter_empty_value'), mark: cur === '' ? '✓' : '', run: () => set('') },
        ]);
        return;
    }
    if (col.type === 'checkbox') {
        tblPick(col.name, [
            { icon: '☑', label: t('tbl_checked'), mark: cur === true ? '✓' : '', run: () => set(true) },
            { icon: '☐', label: t('tbl_unchecked'), mark: cur === false ? '✓' : '', run: () => set(false) },
        ]);
        return;
    }
    const form = document.createElement('form');
    form.className = 'tbl-pick-text';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 80;
    input.placeholder = t('tbl_filter_contains');
    input.value = typeof cur === 'string' ? cur : '';
    const go = document.createElement('button');
    go.type = 'submit';
    go.className = 'btn-primary';
    go.textContent = t('tbl_filter_apply');
    form.append(input, go);
    form.onsubmit = e => { e.preventDefault(); const q = input.value.trim(); closeModal('modal-table-pick'); if (q) set(q); else { delete tblView().filter; tblSaveView(); renderTableGrid(); } };
    tblPick(col.name, [], form);
    setTimeout(() => input.focus(), 150);
}

// --- ⋯ פעולות הטבלה: עמודות, שם/אייקון/כיס, מחיקה ---
function openTableActions() {
    const tb = tblTable();
    if (!tb) return;
    document.getElementById('tbl-actions-title').textContent = tb.name;
    const grid = document.getElementById('tbl-actions-grid');
    grid.innerHTML = '';
    [
        { icon: '☰', key: 'table_manage_columns_btn', desc: 'tbl_actions_columns_desc', run: () => openColumnManager() },
        { icon: '✏️', key: 'tbl_actions_edit', desc: 'tbl_actions_edit_desc', run: () => openEditTableModal(tb.id) },
        { icon: '🗑️', key: 'tbl_actions_delete', desc: 'tbl_actions_delete_desc', danger: true, run: () => deleteCustomTable(tb.id) },
    ].forEach(o => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'bag-add-option' + (o.danger ? ' is-danger' : '');
        b.innerHTML = `<span class="bag-add-option-icon" aria-hidden="true">${o.icon}</span><span class="bag-add-option-text"><span class="bag-add-option-name">${bagEsc(t(o.key))}</span><span class="bag-add-option-desc">${bagEsc(t(o.desc))}</span></span>`;
        b.onclick = () => { closeModal('modal-table-actions'); o.run(); };
        grid.appendChild(b);
    });
    openModal('modal-table-actions');
}

// "+ עמודה": ישר לחלון עמודה חדשה, ונשמר מיד בלי לעבור דרך רשימת העמודות
function openTableQuickAddColumn(type) {
    if (!currentOpenTableId) return;
    pendingTableColumns = customTableColumnsCache.map(col => ({ ...col }));
    originalTableColumnIds = pendingTableColumns.filter(c => c.id).map(c => c.id);
    tblQuickColumn = true;
    openAddColumnSubModal();
    if (type) selectColumnType(type);
}
function cancelColumnSubModal() {
    closeModal('modal-add-column');
    editingCustomColumnId = null;
    if (tblQuickColumn) { tblQuickColumn = false; return; }
    openModal('modal-manage-columns');
}
