// ============================================================================
// 🖼️ כרטיסי שיתוף כתמונה ודפי PDF להדפסה (לפי בקשה מפורשת, 2026-11-25: "1 עד 10 מצויין תבנה את כולם", וגם "שבשום
// מקום באפליקציה לא יהיה CSV, תמיד משהו כתמונה או PDF"). אותו מראה זכוכיתי כמו תמונת השבוע באימונים (wkPaintShareBg
// ב-workouts.js), ותמיד דרך בורר השיתוף: תצוגה מקדימה, שמירת התמונה, ו"PDF להדפסה" כשיש לזה דף.
//  1 השביל ביעד            2 המדף בפינת הקריאה + כרטיס ציטוט     3 השגרה כ-PDF למקרר
//  4 רשימת הקניות           5 כרטיס מתכון (+ PDF)                  6 התפריט של NOT10 Nourish+ (+ שבוע ב-PDF עם קניות)
//  7 השבוע / החודש ביומן    8 3 דברים טובים מהשבוע                 9 המים של החודש בטיפות
//  10 השנה שלי ב-NOT10
// ============================================================================
const SC_W = 1080;
const SC_PAD = 64;

function scEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
async function scFontsReady() { try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 800))]); } catch {} }
function scF(s, weight, px) { return `${weight} ${px}px ${s.font}`; }
// קנבס למדידה בלבד (לחישוב הגובה לפני שמציירים)
let scMeasureCtx = null;
function scMeasurer(font) {
    if (!scMeasureCtx) scMeasureCtx = document.createElement('canvas').getContext('2d');
    if (font) scMeasureCtx.font = font;
    return scMeasureCtx;
}
// הסגנון (צבעים, פונט, כיוון) בלי לצייר - בשביל המדידה
function scStyle() {
    const css = getComputedStyle(document.documentElement);
    const light = document.documentElement.classList.contains('light-mode');
    return {
        light,
        font: getComputedStyle(document.body).fontFamily || 'sans-serif',
        rtl: document.documentElement.dir === 'rtl',
        pink: wkRgb(css.getPropertyValue('--accent-pink').trim() || '#f9a8d4', [249, 168, 212]),
        purple: wkRgb(css.getPropertyValue('--accent-purple').trim() || '#c4b5fd', [196, 181, 253]),
    };
}
function scStart(H, bg) {
    const canvas = document.createElement('canvas');
    canvas.width = SC_W;
    canvas.height = Math.round(H);
    const ctx = canvas.getContext('2d');
    const s = bg ? bg(ctx, SC_W, canvas.height) : wkPaintShareBg(ctx, SC_W, canvas.height);
    s.startX = s.rtl ? SC_W - SC_PAD : SC_PAD;
    s.endX = s.rtl ? SC_PAD : SC_W - SC_PAD;
    ctx.direction = s.rtl ? 'rtl' : 'ltr';
    ctx.textBaseline = 'middle';
    return { canvas, ctx, s };
}
// שבירת שורות לפי רוחב: לפי מילים, ובשפות בלי רווחים (סינית, יפנית, תאית) - לפי תווים
function scWrap(ctx, text, maxW, maxLines) {
    const words = String(text || '').replace(/\s+/g, ' ').trim().split(/(\s)/).filter(x => x !== '');
    const tokens = [];
    words.forEach(w => {
        if (w !== ' ' && ctx.measureText(w).width > maxW) [...w].forEach(ch => tokens.push(ch));
        else tokens.push(w);
    });
    const lines = [];
    let cur = '';
    tokens.forEach(tk => {
        const next = cur + tk;
        if (ctx.measureText(next.trim()).width <= maxW || !cur.trim()) { cur = next; return; }
        lines.push(cur.trim());
        cur = tk === ' ' ? '' : tk;
    });
    if (cur.trim()) lines.push(cur.trim());
    if (maxLines && lines.length > maxLines) {
        const keep = lines.slice(0, maxLines);
        keep[maxLines - 1] = wkFitText(ctx, keep[maxLines - 1] + ' ' + lines[maxLines], maxW);
        if (!keep[maxLines - 1].endsWith('…')) keep[maxLines - 1] = wkFitText(ctx, keep[maxLines - 1] + '…', maxW);
        return keep;
    }
    return lines;
}
// כותרת + שורה מתחתיה; מחזיר את ה-y שאחריהן
function scHead(ctx, s, title, sub, y0 = 104) {
    ctx.textAlign = 'start';
    ctx.fillStyle = s.ink;
    ctx.font = scF(s, 800, 60);
    let y = y0;
    scWrap(ctx, title, SC_W - SC_PAD * 2, 2).forEach(l => { ctx.fillText(l, s.startX, y); y += 72; });
    if (sub) {
        ctx.fillStyle = s.sub;
        ctx.font = scF(s, 600, 34);
        ctx.fillText(wkFitText(ctx, sub, SC_W - SC_PAD * 2), s.startX, y - 12);
        y += 46;
    }
    return y + 14;
}
function scHeadHeight(s, title, sub) {
    const ctx = scMeasurer(scF(s, 800, 60));
    return 104 + scWrap(ctx, title, SC_W - SC_PAD * 2, 2).length * 72 + (sub ? 46 : 0) + 14;
}
function scGlass(ctx, s, x, y, w, h, r = 28) {
    wkRoundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = s.glass;
    ctx.fill();
    ctx.strokeStyle = s.glassEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
}
function scFoot(ctx, s, H) {
    ctx.textAlign = 'center';
    ctx.fillStyle = s.sub;
    ctx.font = scF(s, 600, 30);
    ctx.fillText(SHARE_APP_HOST, SC_W / 2, H - 48);
}
// מספרים/שעות תמיד משמאל לימין (שה-~ וה-: לא יתהפכו בעברית ובערבית)
function scLtr(ctx, s, text, x, y, align) {
    ctx.save();
    ctx.direction = 'ltr';
    ctx.textAlign = align || 'center';
    ctx.fillText(text, x, y);
    ctx.restore();
}
function scBlob(canvas) { return new Promise(res => canvas.toBlob(b => res(b), 'image/jpeg', 0.92)); }
async function scOpenShare(canvas, text, imageName, subject, pdf) {
    let blob = null;
    try { blob = await scBlob(canvas); } catch {}
    openSharePicker(text, { imageBlob: blob, imageName, subject, pdf });
}
// תמונה מבחוץ (כריכה / תמונת מתכון): רק אם מותר לצייר אותה בלי "לזהם" את הקנבס - אחרת null
function scLoadImage(url, timeout = 4000) {
    return new Promise(res => {
        if (!url) { res(null); return; }
        const im = new Image();
        let done = false;
        const finish = v => { if (!done) { done = true; res(v); } };
        im.crossOrigin = 'anonymous';
        im.onload = () => {
            try { const c = document.createElement('canvas'); c.width = c.height = 2; const x = c.getContext('2d'); x.drawImage(im, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1); finish(im); } catch { finish(null); }
        };
        im.onerror = () => finish(null);
        setTimeout(() => finish(null), timeout);
        im.src = url;
    });
}
// ציור תמונה במילוי (cover) בתוך מלבן מעוגל
function scDrawCover(ctx, im, x, y, w, h, r) {
    ctx.save();
    wkRoundRect(ctx, x, y, w, h, r);
    ctx.clip();
    const k = Math.max(w / im.width, h / im.height);
    const dw = im.width * k, dh = im.height * k;
    ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    ctx.restore();
}

// ---------- PDF: דף נקי בחלון חדש, ודיאלוג ההדפסה ("שמירה כ-PDF" היא אחת האפשרויות). החלון נפתח מיד (לפני טעינה) ----------
const SC_PRINT_CSS = `
    body { font-family: 'Segoe UI', Arial, Tahoma, sans-serif; margin: 0; padding: 28px; color: #2b2438; background: #fff; }
    header { border-bottom: 2px solid #efe3fb; padding-bottom: 10px; margin-bottom: 16px; }
    h1 { margin: 0; font-size: 1.6rem; color: #7c3aed; }
    h2 { margin: 18px 0 8px; font-size: 1.1rem; color: #4c3b63; }
    .sub { color: #8a8399; font-size: 0.95rem; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
    th { text-align: start; color: #7c3aed; font-weight: 700; border-bottom: 2px solid #efe3fb; padding: 6px 4px; }
    td { border-bottom: 1px dashed #eee5f7; padding: 7px 4px; vertical-align: top; }
    tr { break-inside: avoid; }
    .muted { color: #8a8399; }
    .box { display: inline-block; width: 0.95em; height: 0.95em; border: 1.6px solid #b9a6d8; border-radius: 4px; vertical-align: -0.12em; }
    ul.check { list-style: none; padding: 0; margin: 0; columns: 2; column-gap: 28px; }
    ul.check li { break-inside: avoid; padding: 4px 0; }
    footer { margin-top: 18px; text-align: center; color: #b0a8bd; font-size: 0.8rem; }
    @media print { body { padding: 12px; } }`;
function scPrintPage(makePage) {
    const win = window.open('', '_blank');
    if (!win) { showAppToast(t('settings_export_data_failed'), 'error'); return; }
    Promise.resolve().then(makePage).then(page => {
        if (!page) { try { win.close(); } catch {} return; }
        const rtl = document.documentElement.dir === 'rtl';
        win.document.write(`<!DOCTYPE html><html dir="${rtl ? 'rtl' : 'ltr'}" lang="${currentLang}"><head><meta charset="utf-8"><title>NOT10.ai - ${scEsc(page.title)}</title><style>${SC_PRINT_CSS}${page.css || ''}</style></head><body>
<header><h1>${scEsc(page.title)}</h1>${page.sub ? `<div class="sub">${scEsc(page.sub)}</div>` : ''}</header>
${page.body}
<footer>NOT10.ai · ${scEsc(SHARE_APP_HOST)}</footer>
</body></html>`);
        win.document.close();
        setTimeout(() => { try { win.focus(); win.print(); } catch (err) {} }, 450);
    }).catch(() => { try { win.close(); } catch {} });
}

// ============================================================================
// 1 · השביל ביעד כתמונה
// ============================================================================
async function scShareGoal(goalId) {
    const goal = (typeof visionGoalsCache !== 'undefined' ? visionGoalsCache : []).find(g => g.id === goalId);
    if (!goal) return;
    await scFontsReady();
    const prog = visionGoalProgress(goal);
    const milestones = visionSortedMilestones(goal.id);
    const model = visionPathModel(goal, milestones, prog);
    const track = goal.track_type || 'steps';
    const meta1 = goal.is_achieved
        ? t('gv_achieved_on').replace('{date}', goal.achieved_at ? new Date(goal.achieved_at).toLocaleDateString(currentLang, { day: 'numeric', month: 'long', year: 'numeric' }) : '')
        : t('gv_journey_day').replace('{n}', visionJourneyDay(goal));
    const meta2 = track === 'steps' && milestones.length
        ? t('gv_stations_progress').replace('{done}', milestones.filter(m => m.is_done).length).replace('{total}', milestones.length)
        : (prog.label || '');
    const H = 1350;
    const { canvas, ctx, s } = scStart(H);
    const title = `${visionGoalIcon(goal)} ${goal.title}`.trim();
    const top = scHead(ctx, s, title, [meta1, meta2].filter(Boolean).join(' · '));
    // התחנות: עד 7 סביב היום (כמו בשביל באפליקציה), מלמטה למעלה, ובראש - הגביע
    const L = model.stones.length;
    const cur = model.current;
    let a = 0, b = L - 1;
    if (L > 7) { const c = cur === -1 ? L - 1 : cur; a = Math.max(0, Math.min(L - 7, c - 3)); b = a + 6; }
    const shown = model.stones.slice(a, b + 1).map((st, i) => ({ st, idx: a + i }));
    const trophyY = top + 70;
    const bottomY = H - 170;
    const n = shown.length;
    const gap = n ? (bottomY - trophyY - 90) / Math.max(1, n) : 0;
    // השביל מתפתל בצד אחד, והשמות בצד הרחב (שלא ייחתכו)
    const baseX = s.rtl ? SC_W - 250 : 250;
    const pts = shown.map((x, i) => ({ x: baseX + (i % 2 === 0 ? -1 : 1) * 64, y: bottomY - i * gap, ...x }));
    const trophy = { x: baseX, y: trophyY };
    const all = [...pts, trophy];
    const pathTo = (k) => {
        ctx.beginPath();
        ctx.moveTo(all[0].x, all[0].y + 60);
        ctx.lineTo(all[0].x, all[0].y);
        for (let i = 1; i <= k && i < all.length; i++) {
            const p = all[i - 1], q = all[i];
            const end = i === all.length - 1 ? { x: q.x, y: q.y + 62 } : q;
            ctx.bezierCurveTo(p.x, p.y - gap * 0.5, end.x, end.y + gap * 0.5, end.x, end.y);
        }
    };
    // המסלול כולו, דהוי
    pathTo(all.length - 1);
    ctx.strokeStyle = s.light ? 'rgba(80, 60, 110, 0.18)' : 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.stroke();
    // מה שכבר עברתי - בצבעי הערכה
    const walkedTo = goal.is_achieved ? all.length - 1 : Math.max(0, pts.findIndex(p => !p.st.done) === -1 ? pts.length - 1 : pts.findIndex(p => !p.st.done));
    if (walkedTo > 0 || (pts[0] && pts[0].st.done)) {
        const g = ctx.createLinearGradient(0, bottomY, 0, trophyY);
        g.addColorStop(0, wkRgba(s.purple, 1));
        g.addColorStop(1, wkRgba(s.pink, 1));
        pathTo(walkedTo);
        ctx.strokeStyle = g;
        ctx.lineWidth = 22;
        ctx.stroke();
    }
    // התחנות והשמות לידן
    pts.forEach((p, i) => {
        const isCur = p.idx === cur && !goal.is_achieved;
        const r = isCur ? 40 : 34;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        if (p.st.done) {
            const g = ctx.createLinearGradient(p.x - r, p.y - r, p.x + r, p.y + r);
            g.addColorStop(0, wkRgba(s.purple, 1));
            g.addColorStop(1, wkRgba(s.pink, 1));
            ctx.fillStyle = g;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(p.x - 14, p.y + 1);
            ctx.lineTo(p.x - 4, p.y + 11);
            ctx.lineTo(p.x + 15, p.y - 10);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 6;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.stroke();
        } else if (isCur) {
            const glow = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, r * 2.2);
            glow.addColorStop(0, wkRgba(s.pink, 0.9));
            glow.addColorStop(1, wkRgba(s.pink, 0));
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 2.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(p.x, p.y, r * 0.6, 0, Math.PI * 2);
            ctx.fillStyle = '#fff';
            ctx.fill();
        } else {
            ctx.fillStyle = s.light ? 'rgba(255, 255, 255, 0.85)' : 'rgba(20, 14, 40, 0.85)';
            ctx.fill();
            ctx.setLineDash([7, 7]);
            ctx.strokeStyle = s.light ? 'rgba(60, 40, 90, 0.45)' : 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.setLineDash([]);
            if (p.st.num != null) {
                ctx.fillStyle = s.sub;
                ctx.font = scF(s, 700, 28);
                scLtr(ctx, s, String(track === 'number' ? visionFmt(p.st.num) : p.st.num), p.x, p.y + 1);
            }
        }
        const label = p.st.title || '';
        if (label) {
            ctx.font = scF(s, p.st.done ? 700 : 600, 34);
            ctx.fillStyle = p.st.done ? s.ink : s.sub;
            ctx.textAlign = 'start';
            const lx = s.rtl ? baseX - 64 - 40 - 34 : baseX + 64 + 40 + 34;
            const room = s.rtl ? lx - SC_PAD : SC_W - SC_PAD - lx;
            const lines = scWrap(ctx, label, room, 2);
            lines.forEach((l, k) => ctx.fillText(l, lx, p.y + (k - (lines.length - 1) / 2) * 42));
        }
    });
    // הגביע בראש השביל (אותו גביע כמו באפליקציה), והשם של היעד לידו
    const tim = await achTrophyImage();
    if (tim) ctx.drawImage(tim, trophy.x - 62, trophy.y - 66, 124, 124);
    ctx.textAlign = 'start';
    ctx.fillStyle = s.ink;
    ctx.font = scF(s, 800, 38);
    const fx = s.rtl ? baseX - 64 - 40 - 34 : baseX + 64 + 40 + 34;
    const flagLines = scWrap(ctx, model.flag || goal.title, s.rtl ? fx - SC_PAD : SC_W - SC_PAD - fx, 2);
    flagLines.forEach((l, k) => ctx.fillText(l, fx, trophy.y + (k - (flagLines.length - 1) / 2) * 46));
    scFoot(ctx, s, H);
    const text = [`🎯 ${shareBold(goal.title)}`, [meta1, meta2].filter(Boolean).join(' · '), '', '💜'].join('\n');
    await scOpenShare(canvas, text, 'my-goal.jpg', goal.title);
}

// ============================================================================
// 2 · המדף בפינת הקריאה (שדרות צבעוניות, כמו במדף באפליקציה) + כרטיס ציטוט
// ============================================================================
async function scShareShelf() {
    const all = (typeof booksCache !== 'undefined' ? booksCache : []).filter(b => b.status === 'read');
    if (!all.length) return;
    await scFontsReady();
    const year = new Date().getFullYear();
    const yearBooks = booksReadThisYear();
    const books = (yearBooks.length ? yearBooks : all).slice().sort((x, y) => String(y.finished_at || '').localeCompare(String(x.finished_at || ''))).slice(0, 48);
    const pages = yearBooks.reduce((sum, b) => sum + (Number(b.total_pages) || 0), 0);
    const st = scStyle();
    const title = t('sc_shelf_title').replace('{year}', year);
    const sub = yearBooks.length ? t('books_year_line').replace('{year}', year).replace('{books}', bookFmt(yearBooks.length)).replace('{pages}', bookFmt(pages)) : '';
    const spine = b => { const p = Number(b.total_pages) || 250; return { w: Math.round((26 + Math.min(12, p / 70)) * 2.5), h: Math.round((104 + Math.min(46, p / 12)) * 2.5) }; };
    // שורות של מדף
    const rows = [];
    let row = [], rowW = 0;
    const maxW = SC_W - SC_PAD * 2 - 20;
    books.forEach(b => {
        const sp = spine(b);
        if (row.length && rowW + sp.w + 6 > maxW) { rows.push(row); row = []; rowW = 0; }
        row.push({ b, ...sp });
        rowW += sp.w + 6;
    });
    if (row.length) rows.push(row);
    const rowH = 400;
    const headH = scHeadHeight(st, title, sub);
    const H = Math.max(1350, headH + rows.length * (rowH + 30) + 140);
    const { canvas, ctx, s } = scStart(H);
    // המדפים באמצע הגובה שנשאר
    let y = scHead(ctx, s, title, sub) + 10;
    y += Math.max(0, (H - 110 - y - rows.length * (rowH + 30)) / 2);
    rows.forEach(r => {
        const total = r.reduce((a, x) => a + x.w + 6, -6);
        let x = s.rtl ? (SC_W + total) / 2 : (SC_W - total) / 2;
        const base = y + rowH - 18;
        r.forEach(it => {
            const left = s.rtl ? x - it.w : x;
            const hue = bookHue(it.b.title);
            const g = ctx.createLinearGradient(left, 0, left + it.w, 0);
            g.addColorStop(0, `hsl(${hue}, 46%, 40%)`);
            g.addColorStop(0.5, `hsl(${hue}, 52%, 54%)`);
            g.addColorStop(1, `hsl(${hue}, 46%, 38%)`);
            wkRoundRect(ctx, left, base - it.h, it.w, it.h, 6);
            ctx.fillStyle = g;
            ctx.fill();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.fillRect(left + 6, base - it.h + 16, it.w - 12, 3);
            ctx.fillRect(left + 6, base - 22, it.w - 12, 3);
            // השם לאורך השדרה
            ctx.save();
            ctx.translate(left + it.w / 2, base - it.h / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#fff';
            ctx.font = scF(s, 700, Math.min(30, it.w * 0.42));
            ctx.textAlign = 'center';
            ctx.direction = s.rtl ? 'rtl' : 'ltr';
            ctx.fillText(wkFitText(ctx, it.b.title, it.h - 56), 0, 1);
            ctx.restore();
            x += s.rtl ? -(it.w + 6) : it.w + 6;
        });
        // המדף עצמו
        const plank = ctx.createLinearGradient(0, base, 0, base + 22);
        plank.addColorStop(0, '#c08a55');
        plank.addColorStop(1, '#7a4f2b');
        wkRoundRect(ctx, SC_PAD - 10, base, SC_W - SC_PAD * 2 + 20, 22, 6);
        ctx.fillStyle = plank;
        ctx.fill();
        y += rowH + 30;
    });
    scFoot(ctx, s, H);
    const list = books.slice(0, 12).map(b => `• ${b.title}${b.author ? ` – ${b.author}` : ''}${b.rating ? ` ${'★'.repeat(b.rating)}` : ''}`);
    const text = [`📚 ${shareBold(title)}`, sub, '', ...list, books.length > 12 ? `+${books.length - 12}` : '', '', '💜'].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
    await scOpenShare(canvas, text, `my-shelf-${year}.jpg`, title);
}

async function scShareQuote(q) {
    if (!q || !q.quote) return;
    await scFontsReady();
    const H = 1350;
    const { canvas, ctx, s } = scStart(H);
    // סימנייה זכוכיתית גדולה באמצע
    const x = 110, y = 150, w = SC_W - 220, h = H - 330;
    scGlass(ctx, s, x, y, w, h, 44);
    ctx.fillStyle = wkRgba(s.pink, 0.9);
    ctx.font = scF(s, 800, 180);
    ctx.textAlign = 'center';
    ctx.fillText('“', SC_W / 2, y + 120);
    const caption = [q.book_title, q.author].filter(Boolean).join(' · ');
    let size = 66, lines;
    for (; size >= 30; size -= 4) {
        ctx.font = scF(s, 700, size);
        lines = scWrap(ctx, q.quote, w - 120);
        if (lines.length * size * 1.35 <= h - 340) break;
    }
    ctx.font = scF(s, 700, size);
    lines = scWrap(ctx, q.quote, w - 120, Math.floor((h - 340) / (size * 1.35)));
    const lh = size * 1.35;
    let ty = y + 230 + (h - 340 - lines.length * lh) / 2;
    ctx.fillStyle = s.ink;
    lines.forEach(l => { ctx.fillText(l, SC_W / 2, ty); ty += lh; });
    if (caption) {
        ctx.fillStyle = s.sub;
        ctx.font = scF(s, 600, 32);
        ctx.fillText(wkFitText(ctx, `— ${caption}`, w - 120), SC_W / 2, y + h - 70);
    }
    scFoot(ctx, s, H);
    const text = [`“${q.quote}”`, caption ? `— ${caption}` : '', '', '💜'].filter((l, i, arr) => l !== '' || arr[i - 1] !== '').join('\n');
    await scOpenShare(canvas, text, 'quote.jpg', caption || 'NOT10.ai');
}

// ============================================================================
// 3 · השגרה כ-PDF למקרר: כל הפריטים של הטאב, ולכל יום של הטאב ריבוע לסמן לאורך השבוע
// ============================================================================
function scPrintRoutine() {
    const tab = (typeof dailyBoardTabs !== 'undefined' ? dailyBoardTabs : []).find(x => x.id === activeDailyBoardTabId) || null;
    if (!tab || !supabaseClient || !currentUserId) return;
    scPrintPage(async () => {
        const { data } = await supabaseClient.from('routine_items').select('*').eq('tab_id', tab.id);
        const items = (data || []).filter(it => String(it.title || '').trim() && !it.hidden_by_new_me);
        const wd = routineTabWeekdays(tab);
        const days = (wd.length ? wd : [0, 1, 2, 3, 4, 5, 6]).slice().sort((a, b) => a - b);
        const timed = items.filter(it => routineItemTime(it)).sort((a, b) => routineItemTime(a).localeCompare(routineItemTime(b)));
        const untimed = items.filter(it => !routineItemTime(it));
        const rowHtml = it => `<tr><td class="time">${routineItemTime(it) ? `<bdi dir="ltr">${scEsc(routineItemTime(it))}</bdi>` : ''}</td><td class="what">${scEsc(it.title)}${it.block_name ? ` <span class="muted">· ${scEsc(it.block_name)}</span>` : ''}</td>${days.map(d => `<td class="day">${routineItemOnDay(it, d) ? '<span class="box"></span>' : ''}</td>`).join('')}</tr>`;
        const head = `<tr><th></th><th></th>${days.map(d => `<th class="day">${scEsc(t(weekdayShortKeys[d]))}</th>`).join('')}</tr>`;
        const body = items.length
            ? `<table>${head}${untimed.length ? `<tr><td colspan="${days.length + 2}" class="bucket">${scEsc(t('routine_bucket_anytime'))}</td></tr>${untimed.map(rowHtml).join('')}` : ''}${timed.map(rowHtml).join('')}</table>`
            : `<p class="muted">—</p>`;
        return {
            title: tab.name || t('daily_board_title'),
            sub: wd.length ? days.map(d => t(dayNameKeys[d])).join(' · ') : '',
            body,
            css: `td.time { width: 4.2em; color: #7c3aed; font-weight: 700; white-space: nowrap; } td.what { font-size: 1.05rem; } th.day, td.day { width: 2.6em; text-align: center; } td.bucket { color: #8a8399; font-weight: 700; padding-top: 12px; } .box { width: 1.1em; height: 1.1em; }`,
        };
    });
}

// ============================================================================
// 4 · רשימת הקניות כתמונה (לפי מחלקות, ומה שכבר בדרך)
// ============================================================================
async function scShopImage(groups, transit, heads) {
    await scFontsReady();
    const st = scStyle();
    const title = `🛒 ${t('general_title')}`;
    const qty = it => (shopQtyOf(it) > 1 ? ` ×${shopQtyOf(it)}` : '');
    // שורות: כותרת מחלקה / פריט
    const lines = [];
    groups.forEach(g => {
        if (heads) lines.push({ head: `${SHOP_DEPT_EMOJI[g.dept] || SHOP_DEPT_EMOJI.other} ${shopDeptName(g.dept)}` });
        g.items.forEach(it => lines.push({ text: `${it.content}${qty(it)}`, cart: shopIsCart(it) }));
        lines.push({ gap: true });
    });
    if (transit.length) {
        lines.push({ head: `🚚 ${t('shop_share_transit').replace(/[:：]\s*$/, '')}` });
        transit.forEach(it => lines.push({ text: `${it.content}${qty(it)}`, transit: true }));
    }
    while (lines.length && lines[lines.length - 1].gap) lines.pop();
    const lh = l => (l.gap ? 20 : l.head ? 72 : 62);
    const total = lines.reduce((a, l) => a + lh(l), 0);
    const cols = total > 1500 ? 2 : 1;
    const colW = (SC_W - SC_PAD * 2 - (cols - 1) * 40) / cols;
    // חלוקה לעמודות
    const colLines = [[]];
    let acc = 0;
    lines.forEach(l => {
        if (cols === 2 && colLines.length === 1 && acc > total / 2 && (l.head || l.gap)) { colLines.push([]); acc = 0; if (l.gap) return; }
        colLines[colLines.length - 1].push(l);
        acc += lh(l);
    });
    const colH = Math.max(...colLines.map(c => c.reduce((a, l) => a + lh(l), 0)));
    const headH = scHeadHeight(st, title, '');
    const H = Math.max(1080, headH + colH + 120 + 80);
    const { canvas, ctx, s } = scStart(H);
    const y0 = scHead(ctx, s, title, '');
    scGlass(ctx, s, SC_PAD - 24, y0 - 10, SC_W - SC_PAD * 2 + 48, colH + 50, 34);
    colLines.forEach((c, ci) => {
        let y = y0 + 30;
        const colStart = s.rtl ? SC_W - SC_PAD - ci * (colW + 40) : SC_PAD + ci * (colW + 40);
        c.forEach(l => {
            if (l.gap) { y += 20; return; }
            ctx.textAlign = 'start';
            if (l.head) {
                ctx.fillStyle = s.ink;
                ctx.font = scF(s, 800, 44);
                ctx.fillText(wkFitText(ctx, l.head, colW), colStart, y + 10);
                y += 72;
                return;
            }
            ctx.fillStyle = l.transit ? s.sub : s.ink;
            ctx.font = scF(s, 600, 42);
            // עיגול קטן לסימון
            const bx = s.rtl ? colStart - 14 : colStart + 14;
            ctx.beginPath();
            ctx.arc(bx, y, 13, 0, Math.PI * 2);
            ctx.strokeStyle = l.cart ? wkRgba(s.pink, 0.9) : (s.light ? 'rgba(60, 40, 90, 0.45)' : 'rgba(255, 255, 255, 0.6)');
            ctx.lineWidth = 3;
            ctx.stroke();
            const tx = s.rtl ? colStart - 42 : colStart + 42;
            const txt = wkFitText(ctx, l.text, colW - 50);
            ctx.fillText(txt, tx, y);
            if (l.cart) {
                const w = ctx.measureText(txt).width;
                ctx.strokeStyle = wkRgba(s.pink, 0.9);
                ctx.lineWidth = 3.5;
                ctx.beginPath();
                ctx.moveTo(tx, y);
                ctx.lineTo(s.rtl ? tx - w : tx + w, y);
                ctx.stroke();
            }
            y += 62;
        });
    });
    scFoot(ctx, s, H);
    return scBlob(canvas);
}

// ============================================================================
// 5 · כרטיס מתכון (על לוח בצבע של הערכה, כמו במתכונים) + PDF
// ============================================================================
function scChalkBg(ctx, W, H) {
    const st = scStyle();
    const mix = (a, b, k) => a.map((v, i) => Math.round(v * k + b[i] * (1 - k)));
    const base = mix(st.purple, [20, 16, 30], 0.2);
    ctx.fillStyle = `rgb(${base.join(',')})`;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createRadialGradient(W * 0.28, 0, 0, W * 0.28, 0, W * 0.9);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    return { ...st, light: false, ink: '#f3f1e8', sub: 'rgba(243, 241, 232, 0.7)', glass: 'rgba(255, 255, 255, 0.06)', glassEdge: 'rgba(243, 241, 232, 0.24)' };
}
function scRecipeLists(recipe) {
    const listLines = v => String(v || '').split('\n').map(x => x.trim().replace(/^([-•*·]|\d+[.)])\s+/, '')).filter(Boolean);
    return { ingredients: listLines(recipe.ingredients), steps: listLines(recipe.instructions) };
}
async function scRecipeImage(recipe) {
    await scFontsReady();
    const st = scChalkBg(scMeasurer(), 1, 1);
    st.font = getComputedStyle(document.body).fontFamily || 'sans-serif';
    const { ingredients, steps } = scRecipeLists(recipe);
    const label = key => t(key).replace(/[:：]\s*$/, '');
    const photo = await scLoadImage(recipe.image_url);
    const textW = SC_W - SC_PAD * 2;
    const m = scMeasurer(scF(st, 600, 38));
    const ingLines = ingredients.flatMap(x => scWrap(m, x, textW - 40).map((l, i) => ({ l, bullet: i === 0 })));
    const stepLines = steps.flatMap((x, n) => scWrap(m, x, textW - 56).map((l, i) => ({ l, num: i === 0 ? n + 1 : null })));
    const MAX_LINES = 30;
    const room = Math.max(8, MAX_LINES - Math.min(ingLines.length, 16));
    const ingShown = ingLines.slice(0, 16), stepShown = stepLines.slice(0, room);
    const cut = ingLines.length > ingShown.length || stepLines.length > stepShown.length;
    const headH = scHeadHeight(st, recipe.title, '');
    const H = headH + (photo ? 520 : 0) + 70 + (ingShown.length ? 86 + ingShown.length * 54 : 0) + (stepShown.length ? 96 + stepShown.length * 54 : 0) + (cut ? 50 : 0) + 130;
    const { canvas, ctx, s } = scStart(Math.max(1080, H), scChalkBg);
    let y = scHead(ctx, s, recipe.title, '');
    // צבע הקטגוריה כפס דק (כמו בכרטיס המתכון)
    ctx.fillStyle = wkRgba(s.pink, 0.9);
    wkRoundRect(ctx, s.rtl ? SC_W - SC_PAD - 120 : SC_PAD, y - 14, 120, 8, 4);
    ctx.fill();
    if (photo) { scDrawCover(ctx, photo, SC_PAD, y + 10, SC_W - SC_PAD * 2, 480, 30); y += 520; }
    if (recipe.calories) {
        let meta = `🔥 ${Number(recipe.calories).toLocaleString()} ${t('calories_unit')}`;
        if (recipe.servings) meta += ` · ≈${Math.round(recipe.calories / recipe.servings)} ${t('recipe_calories_per_serving_unit')}`;
        ctx.textAlign = 'start';
        ctx.fillStyle = s.sub;
        ctx.font = scF(s, 600, 32);
        ctx.fillText(wkFitText(ctx, meta, textW), s.startX, y + 26);
    }
    y += 70;
    const section = (name, rows, numbered) => {
        if (!rows.length) return;
        ctx.textAlign = 'start';
        ctx.fillStyle = s.ink;
        ctx.font = scF(s, 800, 46);
        ctx.fillText(name, s.startX, y + 20);
        y += 76;
        ctx.font = scF(s, 600, 38);
        rows.forEach(r => {
            ctx.fillStyle = s.ink;
            const indent = numbered ? 56 : 40;
            if (r.bullet) { ctx.beginPath(); ctx.arc(s.rtl ? s.startX - 10 : s.startX + 10, y, 6, 0, Math.PI * 2); ctx.fillStyle = wkRgba(s.pink, 0.95); ctx.fill(); ctx.fillStyle = s.ink; }
            if (r.num) { ctx.fillStyle = wkRgba(s.pink, 0.95); ctx.font = scF(s, 800, 38); scLtr(ctx, s, `${r.num}.`, s.rtl ? s.startX - 18 : s.startX + 18, y); ctx.font = scF(s, 600, 38); ctx.fillStyle = s.ink; }
            ctx.fillText(r.l, s.rtl ? s.startX - indent : s.startX + indent, y);
            y += 54;
        });
        y += 24;
    };
    section(label('recipe_ingredients_label'), ingShown, false);
    section(label('recipe_instructions_label'), stepShown, true);
    if (cut) { ctx.textAlign = 'center'; ctx.fillStyle = s.sub; ctx.font = scF(s, 700, 34); ctx.fillText('…', SC_W / 2, y); }
    scFoot(ctx, s, canvas.height);
    return scBlob(canvas);
}
function scPrintRecipe(recipe) {
    if (!recipe) return;
    scPrintPage(() => {
        const { ingredients, steps } = scRecipeLists(recipe);
        const label = key => t(key).replace(/[:：]\s*$/, '');
        let meta = '';
        if (recipe.calories) {
            meta = `${Number(recipe.calories).toLocaleString()} ${t('calories_unit')}`;
            if (recipe.servings) meta += ` · ≈${Math.round(recipe.calories / recipe.servings)} ${t('recipe_calories_per_serving_unit')}`;
        }
        return {
            title: recipe.title,
            sub: meta,
            body: `${recipe.image_url ? `<img class="photo" src="${scEsc(recipe.image_url)}" alt="">` : ''}
                ${ingredients.length ? `<h2>${scEsc(label('recipe_ingredients_label'))}</h2><ul class="check">${ingredients.map(x => `<li><span class="box"></span> ${scEsc(x)}</li>`).join('')}</ul>` : ''}
                ${steps.length ? `<h2>${scEsc(label('recipe_instructions_label'))}</h2><ol class="steps">${steps.map(x => `<li>${scEsc(x)}</li>`).join('')}</ol>` : ''}`,
            css: `.photo { display: block; width: 100%; max-height: 280px; object-fit: cover; border-radius: 16px; margin-bottom: 8px; } ol.steps { padding-inline-start: 1.4em; } ol.steps li { padding: 4px 0; line-height: 1.45; }`,
        };
    });
}

// ============================================================================
// 6 · NOT10 Nourish+: התפריט של היום כתמונה, ו-PDF של השבוע עם רשימת קניות
// ============================================================================
// השם עם סימן הכיוון שלו (כמו באפליקציה) - שה-+ לא יקפוץ להתחלה בעברית ובערבית
function scNmName() { const n = String(typeof NM_NAME !== 'undefined' ? NM_NAME : 'NOT10 Nourish+'); return /‎/.test(n) ? n : n + '‎'; }
function scNmSlotLine(slot, key) {
    if (!key) return { name: t('nm_free_meal'), text: '', kcal: typeof NEW_ME_FREE_MEAL_KCAL !== 'undefined' ? NEW_ME_FREE_MEAL_KCAL : 0 };
    const it = nmItemInfo(key);
    return { name: nmItemShort(it), text: nmItemFull(it), kcal: it.kcal };
}
async function scShareNmMenu() {
    if (typeof nmProfile === 'undefined' || !nmProfile) return;
    await scFontsReady();
    const st = scStyle();
    const slots = nmActiveOrder();
    const meals = slots.map(slot => {
        const free = nmIsFree(slot);
        const line = scNmSlotLine(slot, free ? null : nmTodayKey(slot));
        const time = nmProfile.reminders_on && nmSlotReminderEnabled(slot) ? nmSlotReminderTime(slot) : '';
        return { slot, slotName: nmSlotName(slot), time, ...line };
    });
    const m = scMeasurer(scF(st, 500, 30));
    meals.forEach(x => { x.lines = x.text ? scWrap(m, x.text, SC_W - SC_PAD * 2 - 60, 3) : []; });
    const title = `${t('nm_tile_menu')}`;
    const sub = `${scNmName()} · ${new Date().toLocaleDateString(currentLang, { weekday: 'long', day: 'numeric', month: 'long' })}`;
    const cardH = x => 150 + x.lines.length * 40;
    const H = Math.max(1350, scHeadHeight(st, title, sub) + meals.reduce((a, x) => a + cardH(x) + 20, 0) + 120 + 110);
    const { canvas, ctx, s } = scStart(H);
    let y = scHead(ctx, s, title, sub);
    meals.forEach(x => {
        const h = cardH(x);
        scGlass(ctx, s, SC_PAD, y, SC_W - SC_PAD * 2, h, 30);
        const sx = s.rtl ? SC_W - SC_PAD - 30 : SC_PAD + 30;
        ctx.textAlign = 'start';
        ctx.fillStyle = wkRgba(s.pink, 1);
        ctx.font = scF(s, 800, 30);
        ctx.fillText(wkFitText(ctx, x.slotName, 560), sx, y + 40);
        ctx.fillStyle = s.sub;
        ctx.font = scF(s, 700, 30);
        const right = s.rtl ? SC_PAD + 30 : SC_W - SC_PAD - 30;
        scLtr(ctx, s, `~${nmFmt(x.kcal)}${x.time ? `  ·  ${x.time}` : ''}`, right, y + 40, s.rtl ? 'left' : 'right');
        ctx.fillStyle = s.ink;
        ctx.font = scF(s, 800, 40);
        ctx.textAlign = 'start';
        ctx.fillText(wkFitText(ctx, x.name, SC_W - SC_PAD * 2 - 60), sx, y + 96);
        ctx.fillStyle = s.sub;
        ctx.font = scF(s, 500, 30);
        x.lines.forEach((l, i) => ctx.fillText(l, sx, y + 146 + i * 40));
        y += h + 20;
    });
    const total = nmMenuTotal();
    ctx.textAlign = 'center';
    ctx.fillStyle = s.ink;
    ctx.font = scF(s, 800, 38);
    scLtr(ctx, s, `~${nmFmt(total)} / ${nmFmt(nmProfile.plan)}`, SC_W / 2, y + 40);
    scFoot(ctx, s, H);
    const text = [`🍽️ ${shareBold(title)}`, sub, '', ...meals.map(x => `${x.slotName}${x.time ? ` (${x.time})` : ''}: ${x.name} · ~${nmFmt(x.kcal)}`), '', '💜'].join('\n');
    await scOpenShare(canvas, text, 'my-menu.jpg', title, scPrintNmWeek);
}
function scPrintNmWeek() {
    if (typeof nmProfile === 'undefined' || !nmProfile) return;
    scPrintPage(() => {
        const today = getLocalDateString();
        const slots = nmActiveOrder();
        const days = Array.from({ length: 7 }, (_, i) => nmAddDays(today, i));
        const rows = days.map(ds => {
            const dayRow = (typeof nmWeekDays !== 'undefined' ? nmWeekDays : []).find(r => r.day === ds);
            const cells = slots.map(slot => {
                if (ds === today && nmIsFree(slot)) return `<td>${scEsc(t('nm_free_meal'))}</td>`;
                if (dayRow && dayRow.free_slot === slot) return `<td>${scEsc(t('nm_free_meal'))}</td>`;
                const ov = ds === today ? nmTodayKey(slot) : (dayRow && dayRow.overrides && dayRow.overrides[slot]);
                const key = nmValidKey(ov) ? ov : nmPermanentKey(slot);
                const it = nmItemInfo(key);
                return `<td><b>${scEsc(nmItemShort(it))}</b><div class="muted small">~${scEsc(nmFmt(it.kcal))}</div></td>`;
            }).join('');
            const label = nmDate(ds).toLocaleDateString(currentLang, { weekday: 'short', day: 'numeric', month: 'numeric' });
            return `<tr><th class="dayh">${scEsc(label)}</th>${cells}</tr>`;
        }).join('');
        const shop = nmShopItems(7);
        const groups = Object.keys(NEW_ME_SHOP_GROUPS).concat('other');
        const shopHtml = groups.map(g => {
            const list = shop.filter(x => x.group === g);
            if (!list.length) return '';
            return `<h3>${scEsc(t('nm_shop_group_' + g))}</h3><ul class="check">${list.map(x => `<li><span class="box"></span> ${scEsc(t('nm_ing_' + x.ing))} <span class="muted">— ${scEsc(nmFmtQty(x.qty, x.unit))}</span></li>`).join('')}</ul>`;
        }).join('');
        return {
            // השם בסוף השורה (שה-+ שלו לא יקפוץ לתחילת הכותרת בעברית ובערבית)
            title: t('sc_nm_week_title'),
            sub: `${nmShortDate(days[0])} – ${nmShortDate(days[6])} · ${nmFmt(nmProfile.plan)} ${t('calories_unit')} · ${scNmName()}`,
            body: `<table class="week"><tr><th></th>${slots.map(sl => `<th>${scEsc(nmSlotName(sl))}</th>`).join('')}</tr>${rows}</table>
                ${shopHtml ? `<h2>${scEsc(t(NEW_ME_VIEW_TITLES.shop || 'nm_tile_shop'))}</h2>${shopHtml}` : ''}`,
            css: `table.week td, table.week th { font-size: 0.86rem; } th.dayh { white-space: nowrap; color: #4c3b63; } .small { font-size: 0.78rem; } h3 { margin: 12px 0 4px; font-size: 0.95rem; color: #7c3aed; }`,
        };
    });
}

// ============================================================================
// 7 · היומן: השבוע (או החודש, בתצוגת חודש / שנה) כתמונה, ו-PDF
// ============================================================================
async function scCalRange() {
    const view = calActiveView();
    if (view === 'month' || view === 'year') {
        const key = view === 'month' ? (viewedCalendarMonthKey || currentMonthKey()) : String(calAnchor || getLocalDateString()).slice(0, 7);
        const [y, m] = key.split('-').map(Number);
        const start = `${key}-01`, end = `${key}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
        return { kind: 'month', key, start, end, label: formatMonthLabel(key) };
    }
    const start = calWeekStart(calAnchor || getLocalDateString());
    const end = addDaysToDateStr(start, 6);
    return { kind: 'week', start, end, label: formatWeekRangeLabel(start) };
}
function scCalItemLine(it) { return `${it.start !== null && it.start !== undefined ? calFmtTime(calFromMin(it.start)) + ' ' : ''}${it.title}`; }
async function scShareCalendar() {
    if (!supabaseClient || !currentUserId) return;
    await scFontsReady();
    const r = await scCalRange();
    const data = await calFetchRange(r.start, r.end);
    const st = scStyle();
    const title = t(r.kind === 'month' ? 'monthly_calendar_title' : 'calv_title_week');
    let canvas, ctx, s;
    if (r.kind === 'week') {
        const dates = Array.from({ length: 7 }, (_, i) => addDaysToDateStr(r.start, i)).filter(calIsShown);
        const perDay = dates.map(ds => calItemsForDate(ds, data));
        const rowH = it => 70 + Math.max(1, Math.min(4, it.length)) * 46;
        const H = Math.max(1350, scHeadHeight(st, title, r.label) + perDay.reduce((a, it) => a + rowH(it) + 14, 0) + 110);
        ({ canvas, ctx, s } = scStart(H));
        let y = scHead(ctx, s, title, r.label);
        const today = getLocalDateString();
        dates.forEach((ds, i) => {
            const items = perDay[i];
            const h = rowH(items);
            scGlass(ctx, s, SC_PAD, y, SC_W - SC_PAD * 2, h, 28);
            if (ds === today) { wkRoundRect(ctx, SC_PAD, y, SC_W - SC_PAD * 2, h, 28); ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)'; ctx.lineWidth = 4; ctx.stroke(); }
            const sx = s.rtl ? SC_W - SC_PAD - 30 : SC_PAD + 30;
            ctx.textAlign = 'start';
            ctx.fillStyle = s.ink;
            ctx.font = scF(s, 800, 34);
            ctx.fillText(calFmtDate(ds, { weekday: 'long', day: 'numeric', month: 'short' }), sx, y + 40);
            ctx.font = scF(s, 600, 32);
            const shown = items.slice(0, 4);
            if (!shown.length) { ctx.fillStyle = s.sub; ctx.fillText('—', sx, y + 90); }
            shown.forEach((it, k) => {
                const line = k === 3 && items.length > 4 ? `+${items.length - 3}` : scCalItemLine(it);
                ctx.fillStyle = it.done ? s.sub : s.ink;
                ctx.fillText(wkFitText(ctx, `${it.icon ? it.icon + ' ' : ''}${line}`, SC_W - SC_PAD * 2 - 60), sx, y + 90 + k * 46);
            });
            y += h + 14;
        });
        scFoot(ctx, s, H);
    } else {
        const [yy, mm] = r.key.split('-').map(Number);
        const first = new Date(yy, mm - 1, 1);
        const daysIn = new Date(yy, mm, 0).getDate();
        const lead = (first.getDay() - (calPrefs.firstDay || 0) + 7) % 7;
        const rows = Math.ceil((lead + daysIn) / 7);
        const cellW = (SC_W - SC_PAD * 2) / 7, cellH = 170;
        const H = Math.max(1350, scHeadHeight(st, title, r.label) + 60 + rows * cellH + 110);
        ({ canvas, ctx, s } = scStart(H));
        const y0 = scHead(ctx, s, title, r.label);
        const colX = c => (s.rtl ? SC_W - SC_PAD - (c + 1) * cellW : SC_PAD + c * cellW);
        ctx.textAlign = 'center';
        ctx.fillStyle = s.sub;
        ctx.font = scF(s, 700, 26);
        for (let c = 0; c < 7; c++) ctx.fillText(t(weekdayShortKeys[(c + (calPrefs.firstDay || 0)) % 7]), colX(c) + cellW / 2, y0 + 20);
        const today = getLocalDateString();
        for (let d = 1; d <= daysIn; d++) {
            const pos = lead + d - 1, c = pos % 7, rr = Math.floor(pos / 7);
            const x = colX(c), y = y0 + 50 + rr * cellH;
            const ds = `${r.key}-${String(d).padStart(2, '0')}`;
            const items = calItemsForDate(ds, data, false);
            wkRoundRect(ctx, x + 4, y + 4, cellW - 8, cellH - 8, 16);
            ctx.fillStyle = items.length ? s.glass : (s.light ? 'rgba(255, 255, 255, 0.3)' : 'rgba(255, 255, 255, 0.04)');
            ctx.fill();
            ctx.strokeStyle = ds === today ? 'rgba(251, 191, 36, 0.95)' : s.glassEdge;
            ctx.lineWidth = ds === today ? 3.5 : 1.5;
            ctx.stroke();
            ctx.fillStyle = s.ink;
            ctx.font = scF(s, 800, 28);
            ctx.textAlign = 'center';
            scLtr(ctx, s, String(d), x + cellW / 2, y + 30);
            ctx.font = scF(s, 600, 22);
            items.slice(0, 3).forEach((it, k) => {
                const line = k === 2 && items.length > 3 ? `+${items.length - 2}` : it.title;
                ctx.fillStyle = it.done ? s.sub : s.ink;
                ctx.fillText(wkFitText(ctx, line, cellW - 18), x + cellW / 2, y + 66 + k * 30);
            });
        }
        scFoot(ctx, s, H);
    }
    // הטקסט: כל מה שיש, יום אחרי יום
    const lines = [`📅 ${shareBold(title)} · ${r.label}`, ''];
    for (let ds = r.start; ds <= r.end; ds = addDaysToDateStr(ds, 1)) {
        if (!calIsShown(ds) && r.kind === 'week') continue;
        const items = calItemsForDate(ds, data, r.kind === 'week');
        if (!items.length) continue;
        lines.push(`${shareBold(calFmtDate(ds, { weekday: 'short', day: 'numeric', month: 'short' }))}`);
        items.forEach(it => lines.push(`• ${scCalItemLine(it)}`));
    }
    lines.push('', '💜');
    await scOpenShare(canvas, lines.join('\n'), r.kind === 'week' ? 'my-week.jpg' : `my-month-${r.key}.jpg`, `${title} · ${r.label}`, scPrintCalendar);
}
function scPrintCalendar() {
    scPrintPage(async () => {
        const r = await scCalRange();
        const data = await calFetchRange(r.start, r.end);
        let rows = '';
        for (let ds = r.start; ds <= r.end; ds = addDaysToDateStr(ds, 1)) {
            if (!calIsShown(ds)) continue;
            const items = calItemsForDate(ds, data, r.kind === 'week');
            if (r.kind === 'month' && !items.length) continue;
            rows += `<tr><th class="dayh">${scEsc(calFmtDate(ds, { weekday: 'short', day: 'numeric', month: 'short' }))}</th><td>${items.length ? items.map(it => `<div class="ev${it.done ? ' done' : ''}">${it.start !== null && it.start !== undefined ? `<b><bdi dir="ltr">${scEsc(calFmtTime(calFromMin(it.start)))}</bdi></b> ` : ''}${scEsc(it.title)}</div>`).join('') : '<span class="muted">—</span>'}</td></tr>`;
        }
        return {
            title: t(r.kind === 'month' ? 'monthly_calendar_title' : 'calv_title_week'),
            sub: r.label,
            body: `<table>${rows}</table>`,
            css: `th.dayh { width: 8em; white-space: nowrap; color: #4c3b63; vertical-align: top; border-bottom: 1px dashed #eee5f7; } .ev { padding: 2px 0; } .ev.done { color: #8a8399; text-decoration: line-through; }`,
        };
    });
}

// ============================================================================
// 8 · 3 דברים טובים מהשבוע
// ============================================================================
async function scShareGoodWeek() {
    if (!supabaseClient || !currentUserId) return;
    await scFontsReady();
    const end = goodThingsDay();
    const start = addDaysToDateStr(end, -6);
    const { data } = await supabaseClient.from('good_things').select('day, items').eq('user_id', currentUserId).gte('day', start).lte('day', end).order('day', { ascending: true });
    const days = (data || []).map(r => ({ day: r.day, items: (Array.isArray(r.items) ? r.items : []).map(x => String(x || '').trim()).filter(Boolean) })).filter(r => r.items.length);
    if (!days.length) { showAppToast(t('good_things_past_empty')); return; }
    const st = scStyle();
    const title = t('sc_good_week_title');
    const sub = `${calFmtDateSafe(start)} – ${calFmtDateSafe(end)}`;
    const m = scMeasurer(scF(st, 600, 34));
    days.forEach(d => { d.lines = d.items.map(x => scWrap(m, x, SC_W - SC_PAD * 2 - 110, 2)); });
    const cardH = d => 76 + d.lines.reduce((a, l) => a + l.length * 46 + 8, 0) + 16;
    const H = Math.max(1080, scHeadHeight(st, title, sub) + days.reduce((a, d) => a + cardH(d) + 16, 0) + 110);
    const { canvas, ctx, s } = scStart(H);
    let y = scHead(ctx, s, title, sub);
    days.forEach(d => {
        const h = cardH(d);
        scGlass(ctx, s, SC_PAD, y, SC_W - SC_PAD * 2, h, 28);
        const sx = s.rtl ? SC_W - SC_PAD - 30 : SC_PAD + 30;
        ctx.textAlign = 'start';
        ctx.fillStyle = wkRgba(s.pink, 1);
        ctx.font = scF(s, 800, 30);
        ctx.fillText(calFmtDateSafe(d.day, { weekday: 'long', day: 'numeric', month: 'short' }), sx, y + 40);
        let ly = y + 92;
        d.lines.forEach(lines => {
            // פרח קטן ליד כל דבר טוב
            const fx = s.rtl ? sx - 14 : sx + 14;
            for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; ctx.beginPath(); ctx.arc(fx + Math.cos(a) * 7, ly + Math.sin(a) * 7, 6, 0, Math.PI * 2); ctx.fillStyle = wkRgba(s.pink, 0.75); ctx.fill(); }
            ctx.beginPath(); ctx.arc(fx, ly, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#fcd34d'; ctx.fill();
            ctx.fillStyle = s.ink;
            ctx.font = scF(s, 600, 34);
            lines.forEach((l, i) => ctx.fillText(l, s.rtl ? sx - 46 : sx + 46, ly + i * 46));
            ly += lines.length * 46 + 8;
        });
        y += h + 16;
    });
    scFoot(ctx, s, H);
    const text = [`🌼 ${shareBold(title)}`, '', ...days.flatMap(d => [shareBold(calFmtDateSafe(d.day, { weekday: 'short', day: 'numeric', month: 'short' })), ...d.items.map(x => `• ${x}`), '']), '💜'].join('\n');
    await scOpenShare(canvas, text, 'good-things.jpg', title);
}
function calFmtDateSafe(ds, opts) {
    const [y, m, d] = String(ds).split('-').map(Number);
    try { return new Date(y, m - 1, d).toLocaleDateString(currentLang, opts || { day: 'numeric', month: 'short' }); } catch { return ds; }
}

// ============================================================================
// 9 · המים של החודש - טיפה לכל יום, מתמלאת לפי היעד
// ============================================================================
function scDropPath(ctx, cx, cy, r) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - r * 1.45);
    ctx.bezierCurveTo(cx + r * 0.25, cy - r * 0.95, cx + r, cy - r * 0.35, cx + r, cy + r * 0.2);
    ctx.arc(cx, cy + r * 0.2, r, 0, Math.PI, false);
    ctx.bezierCurveTo(cx - r, cy - r * 0.35, cx - r * 0.25, cy - r * 0.95, cx, cy - r * 1.45);
    ctx.closePath();
}
async function scShareWaterMonth() {
    if (!waterMonthKey) waterMonthKey = getLocalDateString().slice(0, 7);
    await scFontsReady();
    const key = waterMonthKey;
    const [yy, mm] = key.split('-').map(Number);
    const daysIn = new Date(yy, mm, 0).getDate();
    const first = new Date(yy, mm - 1, 1);
    const byDay = {};
    (waterMonthRows || []).forEach(r => { byDay[r.log_date] = (byDay[r.log_date] || 0) + (r.amount_ml || 0); });
    const goal = getWaterDailyGoal();
    const totalMl = Object.values(byDay).reduce((a, v) => a + v, 0);
    const goalDays = goal > 0 ? Object.values(byDay).filter(v => v >= goal).length : 0;
    const fmtL = ml => (ml / 1000).toLocaleString(currentLang, { maximumFractionDigits: 1 });
    const title = t('water_title');
    const sub = first.toLocaleDateString(currentLang, { month: 'long', year: 'numeric' });
    const H = 1500;
    const { canvas, ctx, s } = scStart(H);
    let y = scHead(ctx, s, title, sub);
    // שני כרטיסים: כמה ליטר החודש, וכמה ימים ביעד
    const tiles = [[fmtL(totalMl), t('sc_water_total')], [String(goalDays), t('sc_water_goal_days')]];
    const tw = (SC_W - SC_PAD * 2 - 20) / 2;
    tiles.forEach(([v, l], i) => {
        const x = s.rtl ? SC_W - SC_PAD - tw - i * (tw + 20) : SC_PAD + i * (tw + 20);
        scGlass(ctx, s, x, y, tw, 170, 28);
        ctx.fillStyle = s.ink;
        ctx.font = scF(s, 800, 70);
        scLtr(ctx, s, v, x + tw / 2, y + 70);
        ctx.fillStyle = s.sub;
        ctx.font = scF(s, 600, 30);
        ctx.textAlign = 'center';
        ctx.fillText(wkFitText(ctx, l, tw - 30), x + tw / 2, y + 132);
    });
    y += 210;
    // הטיפות
    const cellW = (SC_W - SC_PAD * 2) / 7, cellH = 150;
    const water = [96, 165, 250];
    ctx.textAlign = 'center';
    ctx.fillStyle = s.sub;
    ctx.font = scF(s, 700, 26);
    const colX = c => (s.rtl ? SC_W - SC_PAD - (c + 1) * cellW : SC_PAD + c * cellW);
    ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].forEach((k, c) => ctx.fillText(t('weekday_short_' + k), colX(c) + cellW / 2, y));
    y += 40;
    for (let d = 1; d <= daysIn; d++) {
        const pos = first.getDay() + d - 1, c = pos % 7, r = Math.floor(pos / 7);
        const cx = colX(c) + cellW / 2, cy = y + r * cellH + 52;
        const ds = `${key}-${String(d).padStart(2, '0')}`;
        const ml = byDay[ds] || 0;
        const fill = goal > 0 ? Math.min(1, ml / goal) : (ml ? 1 : 0);
        const R = 34;
        scDropPath(ctx, cx, cy, R);
        ctx.fillStyle = s.light ? 'rgba(96, 165, 250, 0.12)' : 'rgba(255, 255, 255, 0.07)';
        ctx.fill();
        if (fill > 0) {
            ctx.save();
            scDropPath(ctx, cx, cy, R);
            ctx.clip();
            const top = cy + R * 1.2 - fill * R * 2.65;
            const g = ctx.createLinearGradient(0, top, 0, cy + R * 1.2);
            g.addColorStop(0, `rgba(${water.join(',')}, 0.95)`);
            g.addColorStop(1, 'rgba(37, 99, 235, 0.95)');
            ctx.fillStyle = g;
            ctx.fillRect(cx - R - 2, top, R * 2 + 4, R * 3);
            ctx.restore();
        }
        scDropPath(ctx, cx, cy, R);
        ctx.strokeStyle = fill >= 1 ? 'rgba(251, 191, 36, 0.95)' : `rgba(${water.join(',')}, 0.7)`;
        ctx.lineWidth = fill >= 1 ? 4 : 2.5;
        ctx.stroke();
        ctx.fillStyle = s.ink;
        ctx.font = scF(s, 700, 24);
        scLtr(ctx, s, String(d), cx, cy + R * 1.2 + 26);
    }
    scFoot(ctx, s, H);
    const text = [`💧 ${shareBold(title)} · ${sub}`, `${fmtL(totalMl)} ${t('sc_water_total')}`, `${goalDays} ${t('sc_water_goal_days')}`, '', '💜'].join('\n');
    await scOpenShare(canvas, text, `water-${key}.jpg`, `${title} · ${sub}`);
}

// ============================================================================
// 10 · השנה שלי ב-NOT10 - תמונה בגודל סטורי
// ============================================================================
async function scYearStats(year) {
    const from = `${year}-01-01`, to = `${year}-12-31`;
    const q = (table, cols, dateCol) => fetchAllRows(supabaseClient.from(table).select(cols).eq('user_id', currentUserId).gte(dateCol, from).lte(dateCol, to)).then(r => r.data || []).catch(() => []);
    const [sport, water, good, checks, goals, books] = await Promise.all([
        q('sport_sessions', 'id, duration_minutes', 'session_date'),
        q('water_logs', 'id, amount_ml', 'log_date'),
        q('good_things', 'id, items', 'day'),
        q('routine_item_checkins', 'item_id, checkin_date', 'checkin_date'),
        supabaseClient.from('vision_goals').select('id, achieved_at').eq('user_id', currentUserId).eq('is_achieved', true).gte('achieved_at', from).lte('achieved_at', `${to}T23:59:59`).then(r => r.data || []).catch(() => []),
        supabaseClient.from('books').select('id, total_pages, finished_at').eq('user_id', currentUserId).eq('status', 'read').gte('finished_at', from).lte('finished_at', `${to}T23:59:59`).then(r => r.data || []).catch(() => []),
    ]);
    return {
        workouts: sport.length,
        minutes: sport.reduce((a, r) => a + (Number(r.duration_minutes) || 0), 0),
        books: books.length,
        pages: books.reduce((a, r) => a + (Number(r.total_pages) || 0), 0),
        goals: goals.length,
        good: good.filter(r => Array.isArray(r.items) && r.items.some(Boolean)).length,
        water: Math.round(water.reduce((a, r) => a + (Number(r.amount_ml) || 0), 0) / 1000),
        routine: checks.length,
    };
}
async function scShareYear() {
    if (!supabaseClient || !currentUserId) return;
    const now = new Date();
    // בתחילת ינואר - עדיין השנה שהסתיימה
    const year = now.getMonth() === 0 && now.getDate() <= 10 ? now.getFullYear() - 1 : now.getFullYear();
    showAppToast(t('sc_y_working'));
    const [st0] = await Promise.all([scYearStats(year), scFontsReady()]);
    const tiles = [
        ['workouts', st0.workouts, 'sc_y_workouts'], ['minutes', st0.minutes, 'sc_y_minutes'],
        ['books', st0.books, 'sc_y_books'], ['goals', st0.goals, 'sc_y_goals'],
        ['routine', st0.routine, 'sc_y_routine'], ['good', st0.good, 'sc_y_good'],
        ['water', st0.water, 'sc_y_water'],
    ].filter(x => x[1] > 0);
    if (!tiles.length) { showAppToast(t('sc_y_empty')); return; }
    const H = 1920;
    const { canvas, ctx, s } = scStart(H);
    // כותרת גדולה באמצע למעלה
    ctx.textAlign = 'center';
    ctx.fillStyle = wkRgba(s.pink, 1);
    ctx.font = scF(s, 800, 150);
    scLtr(ctx, s, String(year), SC_W / 2, 250);
    ctx.fillStyle = s.ink;
    ctx.font = scF(s, 800, 62);
    scWrap(ctx, t('sc_y_title'), SC_W - SC_PAD * 2, 2).forEach((l, i) => ctx.fillText(l, SC_W / 2, 390 + i * 74));
    const tim = await achTrophyImage();
    if (tim) ctx.drawImage(tim, SC_W / 2 - 60, 470, 120, 120);
    const cols = 2, tw = (SC_W - SC_PAD * 2 - 24) / cols, th = 230;
    const top = 640;
    tiles.forEach(([k, v, label], i) => {
        const c = i % cols, r = Math.floor(i / cols);
        const lastOdd = i === tiles.length - 1 && tiles.length % 2 === 1;
        const w = lastOdd ? SC_W - SC_PAD * 2 : tw;
        const x = lastOdd ? SC_PAD : (s.rtl ? SC_W - SC_PAD - tw - c * (tw + 24) : SC_PAD + c * (tw + 24));
        const y = top + r * (th + 24);
        scGlass(ctx, s, x, y, w, th, 34);
        ctx.fillStyle = s.ink;
        ctx.font = scF(s, 800, 92);
        scLtr(ctx, s, Number(v).toLocaleString(currentLang), x + w / 2, y + 96);
        ctx.fillStyle = s.sub;
        ctx.font = scF(s, 600, 32);
        ctx.textAlign = 'center';
        ctx.fillText(wkFitText(ctx, t(label), w - 40), x + w / 2, y + 176);
    });
    scFoot(ctx, s, H);
    const text = [`🏆 ${shareBold(t('sc_y_title'))} · ${year}`, '', ...tiles.map(([, v, label]) => `${Number(v).toLocaleString(currentLang)} ${t(label)}`), '', '💜'].join('\n');
    await scOpenShare(canvas, text, `my-year-${year}.jpg`, `${t('sc_y_title')} · ${year}`);
}
// בצ'יפים של מסך הבית: בדצמבר ועד 10 בינואר
function scYearChipVisible() {
    const d = new Date();
    return d.getMonth() === 11 || (d.getMonth() === 0 && d.getDate() <= 10);
}
