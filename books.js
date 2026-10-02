// ============================================================================
// 📚 הספרים שלי (לפי בקשה מפורשת): רשימת ספרים בארבעה טאבים - לקנות / מחכים לי /
// בקריאה / קראתי. ספר בקריאה: התקדמות בעמודים, דד-ליין ("לסיים עד") עם קצב עמודים
// ליום ומשימה יומית בהצצה להיום, ורצף ימי קריאה. ספרים שנקראו עומדים כשדרות על מדף,
// עם דירוג ⭐ ומשפט שאהבתי. סיום ספר מוסיף +1 ליעד קריאה מ"היעדים שלי" (אם חובר).
// בהוספה - חיפוש כריכה, סופר ומספר עמודים ב-Open Library (חינמי, בלי מפתח); ספר שלא
// נמצא (למשל הרבה ספרים בעברית) מקבל כריכה צבעונית מהשם. הרעיונות מאפליקציות קריאה
// (Goodreads - מדפים, Leaf/Basmo - דד-ליין וקצב יומי, Bookly - רצף)
// ============================================================================
const BOOK_STATUSES = [
    { key: 'to_buy', icon: '🛒', label: 'books_tab_to_buy' },
    { key: 'to_read', icon: '📚', label: 'books_tab_to_read' },
    { key: 'reading', icon: '📖', label: 'books_tab_reading' },
    { key: 'read', icon: '✅', label: 'books_tab_read' },
];
let booksCache = [];
let bookLogCache = [];      // עמודים שנקראו ביום (60 הימים האחרונים) - לרצף ולקצב היומי
let booksGoalId = null;     // יעד ספירה מ"היעדים שלי" שמקבל +1 על כל ספר שנגמר
let booksActiveTab = 'reading';
let editingBookId = null;
let bookModalStatus = 'to_read';
let bookFinishState = null;

function bookEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function bookStatusMeta(key) { return BOOK_STATUSES.find(s => s.key === key) || BOOK_STATUSES[1]; }
function bookFmt(n) { return Number(n || 0).toLocaleString(currentLang); }

async function loadBooks() {
    if (!supabaseClient || !currentUserId) return;
    const since = new Date();
    since.setDate(since.getDate() - 60);
    const [booksRes, logRes, prefRes] = await Promise.all([
        supabaseClient.from('books').select('*').eq('user_id', currentUserId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
        supabaseClient.from('book_reading_log').select('book_id, log_date, pages, source').eq('user_id', currentUserId).gte('log_date', getLocalDateString(since)),
        supabaseClient.from('user_premium').select('books_goal_id').eq('user_id', currentUserId).maybeSingle(),
    ]);
    booksCache = booksRes.data || [];
    bookLogCache = logRes.data || [];
    booksGoalId = prefRes && prefRes.data ? prefRes.data.books_goal_id : null;
    if (isBooksSectionOpen()) renderBooks();
    // משימת הקריאה היומית מופיעה בהצצה להיום
    if (document.getElementById('today-tasks-list')) loadTodayTasks();
}

function isBooksSectionOpen() {
    const section = document.getElementById('books-section');
    return !!(section && section.classList.contains('active-tab'));
}

function openBooksSection() {
    closeHamburgerMenu();
    switchToTab('books-section');
    renderBooks();
    loadBooks();
}

// --- חישובים ---
function bookLoggedToday(bookId, source) {
    const today = getLocalDateString();
    return bookLogCache.filter(l => l.book_id === bookId && l.log_date === today && (!source || l.source === source))
        .reduce((sum, l) => sum + (Number(l.pages) || 0), 0);
}

// כמה עמודים צריך לקרוא היום כדי לסיים עד הדד-ליין - לפי המצב בתחילת היום, כך שהמספר
// לא "בורח" תוך כדי קריאה. דד-ליין שעבר = כל מה שנשאר, היום
function bookDailyPace(book) {
    if (!book || book.status !== 'reading' || !book.deadline || !book.total_pages) return null;
    const startOfDay = Math.max(0, (Number(book.current_page) || 0) - bookLoggedToday(book.id));
    const remaining = book.total_pages - startOfDay;
    if (remaining <= 0) return null;
    const daysLeft = Math.max(1, visionDaysLeft(book.deadline) + 1);
    return Math.ceil(remaining / daysLeft);
}

// רצף: ימים רצופים עם עמודים שנקראו (בכל הספרים), עד היום - או עד אתמול אם היום עוד לא נקרא
function bookReadingStreak() {
    const byDate = new Map();
    bookLogCache.forEach(l => byDate.set(l.log_date, (byDate.get(l.log_date) || 0) + (Number(l.pages) || 0)));
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    if (!((byDate.get(getLocalDateString(d)) || 0) > 0)) d.setDate(d.getDate() - 1);
    let n = 0;
    while ((byDate.get(getLocalDateString(d)) || 0) > 0) { n++; d.setDate(d.getDate() - 1); }
    return n;
}

function booksReadThisYear() {
    const year = String(new Date().getFullYear());
    return booksCache.filter(b => b.status === 'read' && (b.finished_at || '').startsWith(year));
}

// צבע קבוע לכל ספר לפי השם - לכריכה הצבעונית ולשדרה על המדף
function bookHue(title) {
    let h = 0;
    for (const ch of String(title || '')) h = (h * 31 + ch.codePointAt(0)) % 360;
    return h;
}

function bookCoverHtml(book, cls) {
    if (book.cover_url) return `<span class="book-cover ${cls}"><img src="${bookEsc(book.cover_url)}" alt="" loading="lazy" onerror="this.parentNode.classList.add('book-cover-fallback');this.remove();"><span class="book-cover-title">${bookEsc(book.title)}</span></span>`;
    return `<span class="book-cover book-cover-fallback ${cls}" style="--book-hue:${bookHue(book.title)}"><span class="book-cover-title">${bookEsc(book.title)}</span></span>`;
}

// --- מסך הספרים ---
function renderBooks() {
    const list = document.getElementById('books-list');
    if (!list) return;
    renderBooksStats();
    renderBooksGoalChip();
    renderBooksTabs();
    const books = booksCache.filter(b => b.status === booksActiveTab);
    list.innerHTML = '';
    if (booksActiveTab === 'read' && books.length) {
        list.appendChild(buildBookShelf(books));
        return;
    }
    if (!books.length) {
        const empty = document.createElement('p');
        empty.className = 'books-empty';
        empty.textContent = `${bookStatusMeta(booksActiveTab).icon} ${t('books_empty_' + booksActiveTab)}`;
        list.appendChild(empty);
        return;
    }
    books.forEach(b => list.appendChild(booksActiveTab === 'reading' ? buildReadingBookCard(b) : buildBookRow(b)));
}

function renderBooksStats() {
    const el = document.getElementById('books-stats');
    if (!el) return;
    const reading = booksCache.filter(b => b.status === 'reading').length;
    const year = booksReadThisYear().length;
    const streak = bookReadingStreak();
    const chips = [];
    if (reading) chips.push(`📖 ${t('books_stat_reading').replace('{n}', bookFmt(reading))}`);
    chips.push(`✅ ${t('books_stat_year').replace('{n}', bookFmt(year))}`);
    if (streak) chips.push(`🔥 ${t('books_stat_streak').replace('{n}', bookFmt(streak))}`);
    el.innerHTML = chips.map(c => `<span class="books-stat-chip">${bookEsc(c)}</span>`).join('');
}

function renderBooksGoalChip() {
    const chip = document.getElementById('books-goal-chip');
    if (!chip) return;
    const goal = booksGoalId ? visionGoalsCache.find(g => g.id === booksGoalId) : null;
    const anyCountGoal = visionGoalsCache.some(g => g.track_type === 'number' && !g.is_achieved);
    chip.classList.toggle('hidden', !goal && !anyCountGoal);
    chip.textContent = goal
        ? `🎯 ${goal.title} · ${visionFmt(goal.current_value || 0)}/${visionFmt(goal.target_value || 0)}`
        : `🎯 ${t('books_goal_link_btn')}`;
    chip.classList.toggle('is-linked', !!goal);
}

function renderBooksTabs() {
    const wrap = document.getElementById('books-tabs');
    if (!wrap) return;
    wrap.innerHTML = '';
    BOOK_STATUSES.forEach(st => {
        const count = booksCache.filter(b => b.status === st.key).length;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'books-tab' + (booksActiveTab === st.key ? ' active' : '');
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', booksActiveTab === st.key ? 'true' : 'false');
        btn.innerHTML = `<span class="books-tab-icon">${st.icon}</span><span class="books-tab-label">${bookEsc(t(st.label))}</span>${count ? `<span class="books-tab-count">${bookFmt(count)}</span>` : ''}`;
        btn.onclick = () => { booksActiveTab = st.key; renderBooks(); };
        wrap.appendChild(btn);
    });
}

// שורת ספר בטאבים "לקנות" / "מחכים לי": כריכה, שם, סופר, ופעולה אחת ברורה להעברה הלאה
function buildBookRow(book) {
    const row = document.createElement('div');
    row.className = 'book-row';
    const meta = [book.author, book.total_pages ? t('books_pages_count').replace('{n}', bookFmt(book.total_pages)) : ''].filter(Boolean).join(' · ');
    row.innerHTML = `${bookCoverHtml(book, 'book-cover-sm')}
        <div class="book-row-main">
            <div class="book-title">${bookEsc(book.title)}</div>
            ${meta ? `<div class="book-meta">${bookEsc(meta)}</div>` : ''}
        </div>`;
    const action = document.createElement('button');
    action.type = 'button';
    action.className = 'book-action-btn';
    if (book.status === 'to_buy') {
        action.textContent = t('books_bought_btn');
        action.onclick = () => moveBook(book.id, 'to_read');
    } else {
        action.textContent = t('books_start_btn');
        action.onclick = () => moveBook(book.id, 'reading');
    }
    row.appendChild(action);
    row.appendChild(buildBookEditButton(book));
    return row;
}

function buildBookEditButton(book) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'book-edit-btn';
    btn.innerHTML = EDIT_ICON_SVG;
    btn.title = t('books_edit_title');
    btn.setAttribute('aria-label', btn.title);
    btn.onclick = () => openBookModal(book.id);
    return btn;
}

// כרטיס ספר בקריאה: פס התקדמות, עמוד נוכחי, +10/+25, דד-ליין עם קצב יומי, "סיימתי"
function buildReadingBookCard(book) {
    const card = document.createElement('div');
    card.className = 'book-card';
    const total = Number(book.total_pages) || 0;
    const cur = Number(book.current_page) || 0;
    const pct = total ? Math.min(100, Math.round((cur / total) * 100)) : 0;
    let deadlineHtml = '';
    if (book.deadline) {
        const days = visionDaysLeft(book.deadline);
        const pace = bookDailyPace(book);
        const parts = [visionDaysLeftText(days)];
        if (pace) parts.push(t('books_pace').replace('{n}', bookFmt(pace)));
        deadlineHtml = `<button type="button" class="book-deadline-chip${days < 0 ? ' is-late' : ''}" data-act="deadline">📅 ${bookEsc(parts.join(' · '))}</button>`;
    } else {
        deadlineHtml = `<button type="button" class="book-deadline-chip is-empty" data-act="deadline">📅 ${bookEsc(t('books_add_deadline'))}</button>`;
    }
    card.innerHTML = `
        <div class="book-card-top">
            ${bookCoverHtml(book, 'book-cover-md')}
            <div class="book-card-main">
                <div class="book-title">${bookEsc(book.title)}</div>
                ${book.author ? `<div class="book-meta">${bookEsc(book.author)}</div>` : ''}
                ${total ? `<div class="book-progress"><span style="width:${pct}%"></span></div>
                <div class="book-progress-text">${bookEsc(t('books_progress').replace('{cur}', bookFmt(cur)).replace('{total}', bookFmt(total)))} · ${pct}%</div>` : ''}
                <div class="book-page-row">
                    <label class="book-page-label">${bookEsc(t('books_page_label'))}</label>
                    <input type="number" class="book-page-input" inputmode="numeric" min="0" ${total ? `max="${total}"` : ''} value="${cur}">
                    <button type="button" class="book-plus-btn" data-add="10">+10</button>
                    <button type="button" class="book-plus-btn" data-add="25">+25</button>
                </div>
                ${deadlineHtml}
            </div>
        </div>
        <div class="book-card-actions">
            <button type="button" class="book-finish-btn">${bookEsc(t('books_finish_btn'))}</button>
        </div>`;
    const input = card.querySelector('.book-page-input');
    input.onchange = () => setBookPage(book.id, input.value);
    input.onkeydown = (e) => { if (e.key === 'Enter') input.blur(); };
    card.querySelectorAll('.book-plus-btn').forEach(btn => { btn.onclick = () => addBookPages(book.id, Number(btn.dataset.add)); });
    card.querySelector('[data-act="deadline"]').onclick = () => openBookModal(book.id, true);
    card.querySelector('.book-finish-btn').onclick = () => openBookFinish(book.id);
    card.querySelector('.book-card-actions').appendChild(buildBookEditButton(book));
    return card;
}

// טאב "קראתי": שדרות צבעוניות על מדפי עץ, ומעליהן כמה ספרים ועמודים השנה
function buildBookShelf(books) {
    const wrap = document.createElement('div');
    wrap.className = 'book-shelf-wrap';
    const year = booksReadThisYear();
    const pages = year.reduce((sum, b) => sum + (Number(b.total_pages) || 0), 0);
    const line = document.createElement('p');
    line.className = 'books-year-line';
    line.textContent = `📚 ${t('books_year_line').replace('{year}', new Date().getFullYear()).replace('{books}', bookFmt(year.length)).replace('{pages}', bookFmt(pages))}`;
    wrap.appendChild(line);
    const sorted = books.slice().sort((a, b) => String(b.finished_at || '').localeCompare(String(a.finished_at || '')));
    const listEl = document.getElementById('books-list');
    const perRow = Math.max(5, Math.floor(((listEl && listEl.clientWidth) || 320) / 40));
    for (let i = 0; i < sorted.length; i += perRow) {
        const row = document.createElement('div');
        row.className = 'book-shelf-row';
        sorted.slice(i, i + perRow).forEach(book => {
            const pagesN = Number(book.total_pages) || 250;
            const spine = document.createElement('button');
            spine.type = 'button';
            spine.className = 'book-spine';
            spine.style.setProperty('--book-hue', bookHue(book.title));
            spine.style.height = `${Math.round(104 + Math.min(46, pagesN / 12))}px`;
            spine.style.width = `${Math.round(26 + Math.min(12, pagesN / 70))}px`;
            spine.title = book.title;
            spine.innerHTML = `<span class="book-spine-title">${bookEsc(book.title)}</span>${book.rating ? `<span class="book-spine-stars">${'★'.repeat(book.rating)}</span>` : ''}`;
            spine.onclick = () => openBookFinish(book.id);
            row.appendChild(spine);
        });
        wrap.appendChild(row);
    }
    return wrap;
}

// --- פעולות ---
async function moveBook(bookId, status) {
    const book = booksCache.find(b => b.id === bookId);
    if (!book || !supabaseClient) return;
    const patch = { status };
    if (status === 'reading' && !book.started_at) patch.started_at = getLocalDateString();
    if (status !== 'read') patch.finished_at = null;
    // חזרה מ"קראתי" מורידה את הספר מיעד הקריאה
    if (book.status === 'read' && status !== 'read' && book.goal_counted) {
        patch.goal_counted = false;
        await bumpBooksGoal(-1);
    }
    const { error } = await supabaseClient.from('books').update(patch).eq('id', bookId);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    Object.assign(book, patch);
    const meta = bookStatusMeta(status);
    showAppToast(t('books_moved_toast').replace('{tab}', `${meta.icon} ${t(meta.label)}`));
    renderBooks();
    loadTodayTasks();
}

async function setBookPage(bookId, newPage, source = 'manual') {
    const book = booksCache.find(b => b.id === bookId);
    if (!book || !supabaseClient || !currentUserId) return;
    const max = Number(book.total_pages) || 100000;
    const page = Math.max(0, Math.min(max, Math.round(Number(newPage) || 0)));
    const delta = page - (Number(book.current_page) || 0);
    if (!delta) { renderBooks(); return; }
    const { error } = await supabaseClient.from('books').update({ current_page: page }).eq('id', bookId);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    book.current_page = page;
    const { data } = await supabaseClient.from('book_reading_log')
        .insert({ user_id: currentUserId, book_id: bookId, log_date: getLocalDateString(), pages: delta, source })
        .select('book_id, log_date, pages, source').single();
    if (data) bookLogCache.push(data);
    renderBooks();
    loadTodayTasks();
    // הגיע לעמוד האחרון - חגיגת "סיימתי"
    if (book.total_pages && page >= book.total_pages && delta > 0) openBookFinish(bookId);
}

function addBookPages(bookId, n) {
    const book = booksCache.find(b => b.id === bookId);
    if (book) setBookPage(bookId, (Number(book.current_page) || 0) + n);
}

// יעד הקריאה מ"היעדים שלי" (ספירה עד יעד) - +1 על כל ספר שנגמר, -1 כשמחזירים אותו
async function bumpBooksGoal(delta) {
    if (!booksGoalId) return false;
    if (!visionGoalsCache.length) await loadVisionGoals();
    const goal = visionGoalsCache.find(g => g.id === booksGoalId && g.track_type === 'number');
    if (!goal || goal.is_achieved) return false;
    await adjustVisionGoalNumber(goal.id, delta);
    return true;
}

// --- 🎉 סיימתי: דירוג ⭐ + משפט שאהבתי. גם מסך הפרטים של ספר מהמדף ---
function openBookFinish(bookId) {
    const book = booksCache.find(b => b.id === bookId);
    if (!book) return;
    const alreadyRead = book.status === 'read';
    bookFinishState = { bookId, rating: book.rating || 0, alreadyRead };
    document.getElementById('book-finish-title').textContent = alreadyRead ? `📖 ${book.title}` : t('books_finish_title');
    const sub = document.getElementById('book-finish-subtitle');
    if (alreadyRead) {
        const parts = [];
        if (book.author) parts.push(book.author);
        if (book.finished_at) {
            const [y, m, d] = book.finished_at.split('-').map(Number);
            parts.push(t('books_finished_on').replace('{date}', new Date(y, m - 1, d).toLocaleDateString(currentLang, { day: 'numeric', month: 'long', year: 'numeric' })));
        }
        sub.textContent = parts.join(' · ');
    } else {
        sub.textContent = book.title;
    }
    document.getElementById('book-finish-note').value = book.note || '';
    document.getElementById('btn-book-read-again').classList.toggle('hidden', !alreadyRead);
    document.getElementById('btn-book-finish-edit').classList.toggle('hidden', !alreadyRead);
    renderBookFinishStars();
    openModal('modal-book-finish');
}

function renderBookFinishStars() {
    const wrap = document.getElementById('book-finish-stars');
    if (!wrap || !bookFinishState) return;
    wrap.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('button');
        star.type = 'button';
        star.className = 'book-star' + (i <= bookFinishState.rating ? ' on' : '');
        star.textContent = i <= bookFinishState.rating ? '★' : '☆';
        star.setAttribute('aria-label', String(i));
        star.onclick = () => { bookFinishState.rating = bookFinishState.rating === i ? 0 : i; renderBookFinishStars(); };
        wrap.appendChild(star);
    }
}

async function saveBookFinish() {
    const st = bookFinishState;
    const book = st && booksCache.find(b => b.id === st.bookId);
    if (!book || !supabaseClient) return;
    const patch = {
        status: 'read',
        rating: st.rating || null,
        note: document.getElementById('book-finish-note').value.trim().slice(0, 500) || null,
    };
    if (!st.alreadyRead) {
        patch.finished_at = getLocalDateString();
        if (book.total_pages) patch.current_page = book.total_pages;
        if (!book.goal_counted && await bumpBooksGoal(1)) patch.goal_counted = true;
    }
    const { error } = await supabaseClient.from('books').update(patch).eq('id', book.id);
    if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
    Object.assign(book, patch);
    closeModal('modal-book-finish');
    bookFinishState = null;
    renderBooks();
    loadTodayTasks();
    if (!st.alreadyRead) {
        showAppToast(t('books_finished_toast'));
        const header = document.querySelector('#books-section .books-header');
        if (header && typeof spawnGentleConfettiBurst === 'function') spawnGentleConfettiBurst(header, 40);
    }
}

async function readBookAgain() {
    const st = bookFinishState;
    if (!st) return;
    closeModal('modal-book-finish');
    const book = booksCache.find(b => b.id === st.bookId);
    if (book) { book.current_page = 0; await supabaseClient.from('books').update({ current_page: 0, started_at: getLocalDateString() }).eq('id', book.id); }
    bookFinishState = null;
    booksActiveTab = 'reading';
    await moveBook(st.bookId, 'reading');
}

function editBookFromFinish() {
    const st = bookFinishState;
    if (!st) return;
    closeModal('modal-book-finish');
    openBookModal(st.bookId);
}

// --- ➕ הוספה / עריכה ---
function openBookModal(bookId = null, focusDeadline = false) {
    editingBookId = bookId;
    const book = bookId ? booksCache.find(b => b.id === bookId) : null;
    document.getElementById('book-modal-title').textContent = t(book ? 'books_modal_edit_title' : 'books_modal_add_title');
    document.getElementById('book-title-input').value = book ? book.title : '';
    document.getElementById('book-author-input').value = book ? (book.author || '') : '';
    document.getElementById('book-pages-input').value = book && book.total_pages ? book.total_pages : '';
    document.getElementById('book-current-input').value = book ? (book.current_page || 0) : '';
    document.getElementById('book-cover-url').value = book ? (book.cover_url || '') : '';
    document.getElementById('book-deadline-input').value = book ? (book.deadline || '') : '';
    const display = document.getElementById('book-deadline-input-display');
    if (display) display.setAttribute('data-placeholder', t('books_field_deadline'));
    updateDateFieldDisplay('book-deadline-input');
    onBookDeadlineChange();
    bookModalStatus = book ? book.status : booksActiveTab;
    renderBookStatusChips();
    hideBookLookup();
    const deleteBtn = document.getElementById('btn-delete-book');
    deleteBtn.classList.toggle('hidden', !book);
    deleteBtn.onclick = () => deleteBook(bookId);
    openModal('modal-book');
    if (focusDeadline) setTimeout(() => openDateFieldPicker('book-deadline-input'), 250);
}

function renderBookStatusChips() {
    const wrap = document.getElementById('book-status-chips');
    if (!wrap) return;
    wrap.innerHTML = '';
    BOOK_STATUSES.forEach(st => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'vision-goal-category-chip' + (bookModalStatus === st.key ? ' selected' : '');
        chip.textContent = `${st.icon} ${t(st.label)}`;
        chip.onclick = () => { bookModalStatus = st.key; renderBookStatusChips(); };
        wrap.appendChild(chip);
    });
    document.getElementById('book-reading-fields').classList.toggle('hidden', bookModalStatus !== 'reading');
}

function onBookDeadlineChange() {
    const input = document.getElementById('book-deadline-input');
    const clearBtn = document.getElementById('book-deadline-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !(input && input.value));
}
function clearBookDeadline() {
    document.getElementById('book-deadline-input').value = '';
    updateDateFieldDisplay('book-deadline-input');
    onBookDeadlineChange();
}

async function saveBook() {
    if (!supabaseClient || !currentUserId) { showAppToast(t('error_not_connected'), 'error'); return; }
    const title = document.getElementById('book-title-input').value.trim().slice(0, 200);
    if (!title) { showAppToast(t('books_title_required'), 'error'); return; }
    const pagesVal = parseInt(document.getElementById('book-pages-input').value, 10);
    const totalPages = pagesVal > 0 ? Math.min(20000, pagesVal) : null;
    const payload = {
        title,
        author: document.getElementById('book-author-input').value.trim().slice(0, 120) || null,
        total_pages: totalPages,
        cover_url: document.getElementById('book-cover-url').value || null,
        deadline: bookModalStatus === 'reading' ? (document.getElementById('book-deadline-input').value || null) : null,
    };
    const existing = editingBookId ? booksCache.find(b => b.id === editingBookId) : null;
    const newStatus = bookModalStatus;
    if (newStatus === 'reading') {
        const cur = Math.max(0, parseInt(document.getElementById('book-current-input').value, 10) || 0);
        payload.current_page = totalPages ? Math.min(totalPages, cur) : cur;
    }
    let bookId = editingBookId;
    if (existing) {
        const { error } = await supabaseClient.from('books').update(payload).eq('id', bookId);
        if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
        Object.assign(existing, payload);
    } else {
        const maxOrder = booksCache.reduce((max, b) => Math.max(max, b.sort_order || 0), 0);
        const row = { ...payload, user_id: currentUserId, status: newStatus === 'read' ? 'to_read' : newStatus, sort_order: maxOrder + 10 };
        if (newStatus === 'reading') row.started_at = getLocalDateString();
        const { data, error } = await supabaseClient.from('books').insert(row).select().single();
        if (error) { showAppToast(t('error_adding_item') + error.message, 'error'); return; }
        booksCache.push(data);
        bookId = data.id;
    }
    closeModal('modal-book');
    const book = booksCache.find(b => b.id === bookId);
    booksActiveTab = newStatus;
    // מעבר ל"קראתי" עובר דרך החגיגה (דירוג + יעד הקריאה); מעבר אחר - רגיל
    if (newStatus === 'read' && book && book.status !== 'read') { renderBooks(); openBookFinish(bookId); return; }
    if (existing && book && book.status !== newStatus) { await moveBook(bookId, newStatus); return; }
    if (!existing) showAppToast(t('books_added_toast'));
    renderBooks();
    loadTodayTasks();
}

function deleteBook(bookId) {
    const book = booksCache.find(b => b.id === bookId);
    if (!book) return;
    showDangerConfirm(t('books_delete_title'), t('books_delete_confirm').replace('{title}', book.title), async () => {
        await supabaseClient.from('books').delete().eq('id', bookId);
        booksCache = booksCache.filter(b => b.id !== bookId);
        bookLogCache = bookLogCache.filter(l => l.book_id !== bookId);
        closeModal('modal-book');
        renderBooks();
        loadTodayTasks();
    });
}

// --- 🔎 חיפוש ב-Open Library תוך כדי הקלדת השם (רק בהוספה): כריכה, סופר, עמודים ---
let bookLookupTimer = null;
let bookLookupSeq = 0;
function onBookTitleInput() {
    clearTimeout(bookLookupTimer);
    const q = document.getElementById('book-title-input').value.trim();
    if (q.length < 3 || editingBookId) { hideBookLookup(); return; }
    bookLookupTimer = setTimeout(() => runBookLookup(q), 650);
}
function hideBookLookup() {
    const box = document.getElementById('book-lookup-results');
    if (box) { box.innerHTML = ''; box.classList.add('hidden'); }
}
async function runBookLookup(q) {
    const seq = ++bookLookupSeq;
    try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 6000);
        const res = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=4&fields=title,author_name,number_of_pages_median,cover_i`, { signal: ctrl.signal });
        clearTimeout(timer);
        if (!res.ok || seq !== bookLookupSeq) return;
        const json = await res.json();
        const docs = (json.docs || []).filter(d => d.title).slice(0, 4);
        const box = document.getElementById('book-lookup-results');
        if (!box || seq !== bookLookupSeq) return;
        if (!docs.length) { hideBookLookup(); return; }
        box.innerHTML = `<p class="book-lookup-hint">${bookEsc(t('books_lookup_hint'))}</p>`;
        docs.forEach(doc => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'book-lookup-item';
            const author = (doc.author_name || [])[0] || '';
            const pages = doc.number_of_pages_median || null;
            const cover = doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : '';
            btn.innerHTML = `${cover ? `<img src="${bookEsc(cover.replace('-M.jpg', '-S.jpg'))}" alt="" loading="lazy">` : '<span class="book-lookup-noimg">📕</span>'}
                <span class="book-lookup-text"><span class="book-lookup-title">${bookEsc(doc.title)}</span><span class="book-lookup-meta">${bookEsc([author, pages ? t('books_pages_count').replace('{n}', bookFmt(pages)) : ''].filter(Boolean).join(' · '))}</span></span>`;
            btn.onclick = () => {
                const titleInput = document.getElementById('book-title-input');
                // השם שהוקלד נשאר, אלא אם הוא חלק מהשם שנמצא (השלמה של שם חלקי)
                if (doc.title.toLowerCase().includes(titleInput.value.trim().toLowerCase())) titleInput.value = doc.title;
                if (author) document.getElementById('book-author-input').value = author;
                if (pages) document.getElementById('book-pages-input').value = pages;
                document.getElementById('book-cover-url').value = cover;
                hideBookLookup();
            };
            box.appendChild(btn);
        });
        box.classList.remove('hidden');
    } catch (e) { /* אין רשת / חסום - החיפוש אופציונלי */ }
}

// --- 🎯 חיבור ליעד קריאה מ"היעדים שלי" ---
function openBooksGoalPicker() {
    const wrap = document.getElementById('books-goal-options');
    const hint = document.getElementById('books-goal-none-hint');
    if (!wrap) return;
    const goals = visionGoalsCache.filter(g => g.track_type === 'number' && (!g.is_achieved || g.id === booksGoalId));
    wrap.innerHTML = '';
    goals.forEach(goal => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'vision-goal-category-chip' + (goal.id === booksGoalId ? ' selected' : '');
        chip.textContent = `🎯 ${goal.title} · ${visionFmt(goal.current_value || 0)}/${visionFmt(goal.target_value || 0)}`;
        chip.onclick = () => selectBooksGoal(goal.id);
        wrap.appendChild(chip);
    });
    const none = document.createElement('button');
    none.type = 'button';
    none.className = 'vision-goal-category-chip' + (!booksGoalId ? ' selected' : '');
    none.textContent = t('books_goal_none');
    none.onclick = () => selectBooksGoal(null);
    wrap.appendChild(none);
    hint.classList.toggle('hidden', goals.length > 0);
    openModal('modal-books-goal-picker');
}

async function selectBooksGoal(goalId) {
    booksGoalId = goalId;
    closeModal('modal-books-goal-picker');
    renderBooksGoalChip();
    if (supabaseClient && currentUserId) {
        await supabaseClient.from('user_premium').upsert({ user_id: currentUserId, username: currentUsername, books_goal_id: goalId }, { onConflict: 'user_id' });
    }
    if (goalId) showAppToast(t('books_goal_linked_toast'));
}

// --- 📖 משימת הקריאה היומית בהצצה להיום (ספר בקריאה עם דד-ליין) ---
// ✓ מוסיף את העמודים של היום לספר; ביטול ה-✓ מחזיר רק את מה שנוסף מההצצה
function getPeekBookTaskItems() {
    return booksCache.filter(b => b.status === 'reading' && b.deadline).map(book => {
        const pace = bookDailyPace(book);
        if (!pace) return null;
        return {
            icon: '📖', text: t('books_peek_task').replace('{n}', bookFmt(pace)), tag: book.title,
            done: bookLoggedToday(book.id) >= pace,
            toggle: checked => toggleBookPeekTask(book.id, checked, pace),
        };
    }).filter(Boolean);
}

async function toggleBookPeekTask(bookId, checked, pace) {
    const book = booksCache.find(b => b.id === bookId);
    if (!book || !supabaseClient) return;
    if (checked) {
        const need = Math.max(0, pace - bookLoggedToday(bookId));
        if (need > 0) await setBookPage(bookId, (Number(book.current_page) || 0) + need, 'peek');
        else loadTodayTasks();
        return;
    }
    const today = getLocalDateString();
    const fromPeek = bookLoggedToday(bookId, 'peek');
    if (fromPeek) {
        await supabaseClient.from('book_reading_log').delete().eq('user_id', currentUserId).eq('book_id', bookId).eq('log_date', today).eq('source', 'peek');
        bookLogCache = bookLogCache.filter(l => !(l.book_id === bookId && l.log_date === today && l.source === 'peek'));
        book.current_page = Math.max(0, (Number(book.current_page) || 0) - fromPeek);
        await supabaseClient.from('books').update({ current_page: book.current_page }).eq('id', bookId);
    }
    if (isBooksSectionOpen()) renderBooks();
    loadTodayTasks();
}
