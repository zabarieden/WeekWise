// ===== העוזר: חלון שיחה (לפי בחירה מפורשת – אפשרות ג, "כאן בשבילך") =====
// במקום ארבע לשוניות: שיחה. בוחרים כלי (משהו ליומן / מה אכלתי / תמונה של מתכון / טבלה) או פשוט כותבים,
// והעוזר מזהה לבד. מאחורי הקלעים רצים בדיוק אותם מנועים כמו קודם (parseScheduleWithAI, logFoodQuickAdd,
// buildTableWithAI וסריקת התמונה) דרך השדות של החלון הקודם (#modal-ai-brain, שנשאר מוסתר). כל הודעה
// שהם מציגים בזמן שהשיחה פתוחה מגיעה לשיחה כתשובה של העוזר, במקום טוסט. השיחה לא נשמרת - כל פתיחה מתחילה מחדש.
// מתחת לשורת הכתיבה: "AI עלול לטעות" (כמו שהיה); אחרי רישום אוכל: ✏️ לתקן קלוריות / חלבון (לפי בקשה מפורשת)
let aiChatTool = null;        // 'schedule' | 'food' | 'table' | null (= לזהות לבד)
let aiChatMode = 'onetime';   // ללו"ז: פעם אחת / כל שבוע / כל יום (כמו הכפתורים בחלון הקודם)
let aiChatBusy = false;
let aiChatAnswered = false;   // האם המנוע כבר ענה בשיחה (דרך הודעה) בריצה הנוכחית
let aiChatToastOrig = null;
let aiChatAsk = null;         // השאלה של הכלי שנבחר (ועוד לא נענתה) - בחירה בכלי אחר מחליפה אותה, לא מוסיפה עוד אחת

const AI_CHAT_SVG = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    // המראה בזכוכית (לפי בחירה מפורשת, 2026-10-21: "העוזר האישי - 6 זכוכית"): ניצוץ במקום הכדור, וציורים קטנים לכלים
    spark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 15.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z"/></svg>',
    mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
    schedule: '<svg class="ai-chat-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
    food: '<svg class="ai-chat-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8c-3-2-8-1-8 5 0 4 3 8 5 8 1 0 2-.6 3-.6s2 .6 3 .6c2 0 5-4 5-8 0-6-5-7-8-5z"/><path d="M12 8c0-2 1-4 3-5"/></svg>',
    photo: '<svg class="ai-chat-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
    table: '<svg class="ai-chat-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M3 14h18M9 4v16"/></svg>',
    money: '<svg class="ai-chat-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3h8l-1.5 4h-5z"/><path d="M9.5 7C6 9.5 4 13 4 16a5 5 0 0 0 5 5h6a5 5 0 0 0 5-5c0-3-2-6.5-5.5-9"/><path d="M14 12.5c-.5-.8-1.3-1-2-1-1.2 0-2 .6-2 1.5s.9 1.3 2 1.5 2 .7 2 1.6-.9 1.5-2 1.5c-.8 0-1.6-.3-2-1M12 10.5v1M12 17.6v1"/></svg>',
    // הלב בברכה (במקום 💛, לפי בקשה מפורשת, 2026-11-15: "ללב סגול כזה מצויר שיהיה קשור לאפליקציה"): לב מצויר
    // ביד בסגול, עם הניצוץ של העוזר בפינה
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="aiHeartG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8b4fe"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient></defs><path d="M12 20.3c-.4 0-.8-.2-1.1-.5C7.3 17 3.7 14 3.4 9.7 3.2 6.6 5.3 4.3 8 4.3c1.7 0 3.1.9 4 2.5.9-1.6 2.4-2.6 4.1-2.6 2.7 0 4.7 2.4 4.5 5.5-.3 4.3-3.9 7.3-7.5 10.1-.3.3-.7.5-1.1.5z" fill="url(#aiHeartG)" stroke="#7c3aed" stroke-width="1.5" stroke-linejoin="round"/><path d="M6.4 8.2c.2-1 .9-1.7 1.8-1.9" fill="none" stroke="#fff" stroke-width="1.5" stroke-linecap="round" opacity=".85"/><path class="ai-heart-spark" d="M20.2 1.6l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" fill="#f5edff" stroke="#a78bfa" stroke-width=".6" stroke-linejoin="round"/></svg>',
};
// הכיתוב של כלי בלי האימוג'י שבתחילתו (בזכוכית יש ציור במקומו)
function aiChatPlainLabel(s) { return String(s || '').replace(/^\p{Extended_Pictographic}[️‍\p{Extended_Pictographic}]*\s*/u, ''); }

function aiChatEl() { return document.getElementById('ai-chat'); }
function aiChatIsOpen() { return !!aiChatEl(); }
function aiChatEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function aiChatBody() { const el = aiChatEl(); return el ? el.querySelector('.ai-chat-body') : null; }
function aiChatScroll() { const b = aiChatBody(); if (b) b.scrollTop = b.scrollHeight; }

function openAiChat(tool) {
    closeAiChat();
    const wrap = document.createElement('div');
    wrap.id = 'ai-chat';
    wrap.className = 'ai-chat';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', t('ai_chat_title'));
    wrap.innerHTML = `
        <div class="ai-chat-sheet">
            <div class="ai-chat-head">
                <span class="ai-chat-orb" aria-hidden="true">${AI_CHAT_SVG.spark}</span>
                <span class="ai-chat-titles"><b>${aiChatEsc(t('ai_chat_title'))}</b><small>${aiChatEsc(t('ai_chat_sub'))}</small></span>
                <button type="button" class="ai-chat-x" aria-label="${aiChatEsc(t('close_btn'))}">${AI_CHAT_SVG.x}</button>
            </div>
            <div class="ai-chat-body" aria-live="polite"></div>
            <form class="ai-chat-input">
                <input type="text" id="ai-chat-field" maxlength="600" enterkeyhint="send" placeholder="${aiChatEsc(t('ai_chat_placeholder'))}" aria-label="${aiChatEsc(t('ai_chat_placeholder'))}">
                <button type="button" class="ai-chat-mic dictate-btn${typeof homeSpeechSupported === 'function' && homeSpeechSupported() ? '' : ' hidden'}" aria-pressed="false" aria-label="${aiChatEsc(t('dictation_btn_aria'))}" title="${aiChatEsc(t('dictation_btn_aria'))}">${AI_CHAT_SVG.mic}</button>
                <button type="submit" class="ai-chat-send" aria-label="${aiChatEsc(t('ai_chat_send'))}">${AI_CHAT_SVG.send}</button>
                <p class="ai-chat-note">${aiChatEsc(t('ai_disclaimer_caption'))}</p>
            </form>
        </div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(wrap);
    document.body.classList.add('ai-chat-open');
    wrap.addEventListener('click', e => { if (e.target === wrap) closeAiChat(); });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') closeAiChat(); });
    wrap.querySelector('.ai-chat-x').addEventListener('click', () => closeAiChat());
    wrap.querySelector('.ai-chat-input').addEventListener('submit', e => { e.preventDefault(); if (aiChatBusy) return; if (typeof stopDictation === 'function') stopDictation(); aiChatSend(); });
    // 🎙️ לדבר במקום להקליד (לפי בקשה מפורשת, 2026-10-21) - אותה הכתבה כמו בפתקים, בכל הכלים של העוזר
    wrap.querySelector('.ai-chat-mic').addEventListener('click', e => { if (typeof toggleDictation === 'function') toggleDictation('ai-chat-field', e.currentTarget); });
    aiChatHookToasts();
    aiChatTool = null;
    aiChatMode = 'onetime';
    aiChatBusy = false;
    aiChatAsk = null;
    aiMoney = null;
    aiChatSay(t('ai_chat_hi'), aiChatToolChips(), 'is-hello');
    if (tool && tool !== 'photo') aiChatPickTool(tool);
    setTimeout(() => { const i = wrap.querySelector('.ai-chat-input input'); if (i) i.focus(); }, 80);
}

function closeAiChat() {
    const el = aiChatEl();
    if (el && typeof stopDictation === 'function') stopDictation();
    if (el) el.remove();
    document.body.classList.remove('ai-chat-open');
    aiChatUnhookToasts();
}

// ---------- בועות וכפתורים ----------
function aiChatBubble(text, who, cls) {
    const b = aiChatBody();
    if (!b) return null;
    const el = document.createElement('div');
    el.className = `ai-chat-msg ${who === 'me' ? 'is-me' : 'is-bot'}${cls ? ' ' + cls : ''}`;
    if (who !== 'me' && text.includes('💛')) {
        text.split('💛').forEach((part, i) => {
            if (i) { const h = document.createElement('span'); h.className = 'ai-chat-heart'; h.innerHTML = AI_CHAT_SVG.heart; el.appendChild(h); }
            if (part) el.appendChild(document.createTextNode(part));
        });
    } else el.textContent = text;
    b.appendChild(el);
    aiChatScroll();
    return el;
}
function aiChatChips(chips) {
    const b = aiChatBody();
    if (!b || !chips || !chips.length) return null;
    const row = document.createElement('div');
    // ארבעת הכלים - באמצע, שניים בשורה (לפי בקשה מפורשת: "את הכל במרכז... רק שהשיחה תהיה בצד")
    row.className = 'ai-chat-chips' + (chips.every(c => c.tool) ? ' is-tools' : '');
    chips.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `ai-chat-chip${c.cls ? ' ' + c.cls : ''}${c.on ? ' is-on' : ''}`;
        if (c.icon) { btn.innerHTML = c.icon; const sp = document.createElement('span'); sp.textContent = c.label; btn.appendChild(sp); } else btn.textContent = c.label;
        if (c.tool) btn.dataset.tool = c.tool;
        if (c.mode) btn.dataset.mode = c.mode;
        btn.addEventListener('click', c.onClick);
        row.appendChild(btn);
    });
    b.appendChild(row);
    aiChatScroll();
    return row;
}
function aiChatSay(text, chips, cls) {
    const el = aiChatBubble(text, 'bot', cls);
    aiChatChips(chips);
    return el;
}
function aiChatToolChips() {
    return [['schedule', 'ai_chat_tool_schedule'], ['food', 'ai_chat_tool_food'], ['photo', 'ai_chat_tool_photo'], ['table', 'ai_chat_tool_table'], ['money', 'ai_chat_tool_money']]
        .map(([tool, key]) => ({ label: aiChatPlainLabel(t(key)), icon: AI_CHAT_SVG[tool], tool, cls: 'ai-chat-tool', onClick: () => (tool === 'photo' ? aiChatPhoto() : tool === 'money' ? aiMoneyStart() : aiChatPickTool(tool)) }));
}

// ---------- 💰 שיחה על כסף (הבחירה שלה, 2026-11-15: w4 "העוזר מוביל לתקציב") ----------
// שלוש שאלות קצרות ואז סיכום, בלי AI: כמה נכנס בחודש → על מה הולך כסף (צ'יפים) → כמה בערך לכל אחד (שדות) →
// סיכום עם "להכניס לתקציב" (הכנסה צפויה + תקציב מתוכנן + תקציב לכל קטגוריה). תמיד יש "סיימנו" - אין לופ
let aiMoney = null;   // { step: 'income' | 'cats' | 'amounts' | 'summary', income, cats: [], amounts: {} }
function aiMoneyCats() {
    const built = (typeof FINANCE_CATEGORIES !== 'undefined' ? FINANCE_CATEGORIES.expense : []).map(([v, k]) => ({ v, label: t(k) }));
    const custom = typeof getCustomFinanceCategoriesForType === 'function' ? getCustomFinanceCategoriesForType('expense').map(c => ({ v: `custom_${c.id}`, label: `${c.icon || '🏷️'} ${c.name}` })) : [];
    return built.concat(custom);
}
function aiMoneyDone() { return { label: t('ai_money_done'), onClick: () => aiMoneyEnd() }; }
function aiMoneyEnd(silent) {
    aiMoney = null;
    aiChatTool = null;
    aiChatSyncNote();
    aiChatHighlightTool(null);
    if (!silent) aiChatSay(t('ai_chat_hi_again'), aiChatToolChips());
}
async function aiMoneyStart() {
    if (!aiChatIsOpen()) return;
    if (aiChatAsk) aiChatAsk.forEach(el => el.remove());
    aiChatAsk = null;
    aiChatTool = 'money';
    aiChatSyncNote();
    aiChatHighlightTool('money');
    if (typeof loadCustomFinanceCategories === 'function' && typeof cachedCustomFinanceCategories !== 'undefined' && !cachedCustomFinanceCategories.length) { try { await loadCustomFinanceCategories(); } catch {} }
    aiMoney = { step: 'income', income: 0, cats: [], amounts: {} };
    aiChatSay(t('ai_money_q_income'), [aiMoneyDone()]);
}
function aiMoneyNumbers(text) {
    const s = String(text || '').replace(/(\d),(\d{3})/g, '$1$2').replace(/(\d+(?:\.\d+)?)\s*(אלף|k\b|K\b|thousand)/g, (m, n) => String(Number(n) * 1000));
    return (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0);
}
function aiMoneyAnswer(text) {
    if (!aiMoney) return;
    if (aiMoney.step === 'income') {
        const total = aiMoneyNumbers(text).reduce((a, b) => a + b, 0);
        if (!total) { aiChatSay(t('ai_money_need_number'), [aiMoneyDone()]); return; }
        aiMoney.income = Math.round(total);
        aiMoneyAskCats();
        return;
    }
    // בשאר השלבים התשובה היא בכפתורים ובשדות
    aiChatSay(t('ai_money_use_buttons'), [aiMoneyDone()]);
}
function aiMoneyAskCats() {
    aiMoney.step = 'cats';
    const chosen = new Set(aiMoney.cats);
    aiChatSay(t('ai_money_q_cats'));
    aiChatChips(aiMoneyCats().map(c => ({
        label: c.label, cls: 'ai-chat-mode', on: chosen.has(c.v),
        onClick: e => { chosen.has(c.v) ? chosen.delete(c.v) : chosen.add(c.v); e.currentTarget.classList.toggle('is-on', chosen.has(c.v)); },
    })));
    aiChatChips([{ label: t('ai_money_next'), cls: 'is-on', onClick: () => {
        if (!chosen.size) { aiChatSay(t('ai_money_pick_one')); return; }
        aiMoney.cats = [...chosen];
        aiMoneyAskAmounts();
    } }, aiMoneyDone()]);
}
function aiMoneyAskAmounts() {
    aiMoney.step = 'amounts';
    const b = aiChatBody();
    if (!b) return;
    aiChatSay(t('ai_money_q_amounts'));
    const cats = aiMoneyCats().filter(c => aiMoney.cats.includes(c.v));
    const known = typeof cachedFinanceCatTargets !== 'undefined' ? cachedFinanceCatTargets : {};
    const form = document.createElement('form');
    form.className = 'ai-chat-msg is-bot ai-chat-fix ai-money-form';
    form.innerHTML = cats.map(c => `<label><span>${aiChatEsc(c.label)}</span><input type="number" name="${aiChatEsc(c.v)}" inputmode="decimal" min="0" step="1" value="${aiChatEsc(aiMoney.amounts[c.v] || known[c.v] || '')}"></label>`).join('')
        + `<button type="submit" class="ai-chat-chip is-on">${aiChatEsc(t('ai_money_next'))}</button>`;
    form.addEventListener('submit', e => {
        e.preventDefault();
        aiMoney.amounts = {};
        cats.forEach(c => { const v = Math.max(0, Math.round(Number(form.querySelector(`[name="${CSS.escape(c.v)}"]`).value) || 0)); if (v) aiMoney.amounts[c.v] = v; });
        form.querySelectorAll('input, button').forEach(x => { x.disabled = true; });
        aiMoneySummary();
    });
    b.appendChild(form);
    aiChatScroll();
    const first = form.querySelector('input');
    if (first) first.focus();
}
function aiMoneySummary() {
    aiMoney.step = 'summary';
    const total = Object.values(aiMoney.amounts).reduce((a, n) => a + n, 0);
    const left = aiMoney.income - total;
    const fmt = n => Math.round(n).toLocaleString();
    const b = aiChatBody();
    if (!b) return;
    aiChatSay(t('ai_money_summary_intro'));
    const card = document.createElement('div');
    card.className = 'ai-chat-msg is-bot ai-money-sum';
    card.innerHTML = `<div><span>${aiChatEsc(t('ai_money_sum_in'))}</span><b>${fmt(aiMoney.income)}</b></div>`
        + `<div><span>${aiChatEsc(t('ai_money_sum_out'))}</span><b>${fmt(total)}</b></div>`
        + `<div class="${left < 0 ? 'is-over' : 'is-left'}"><span>${aiChatEsc(t(left < 0 ? 'ai_money_sum_over' : 'ai_money_sum_left'))}</span><b>${fmt(Math.abs(left))}</b></div>`;
    b.appendChild(card);
    aiChatChips([
        { label: t('ai_money_save'), cls: 'is-on', onClick: () => aiMoneySave() },
        { label: t('ai_money_change'), onClick: () => aiMoneyAskAmounts() },
        aiMoneyDone(),
    ]);
}
async function aiMoneySave() {
    if (!aiMoney || !supabaseClient || !currentUserId) return;
    const m = aiMoney;
    const total = Object.values(m.amounts).reduce((a, n) => a + n, 0);
    const monthKey = typeof currentFinancePeriodKey === 'function' ? currentFinancePeriodKey() : getLocalDateString().slice(0, 7);
    const rows = Object.entries(m.amounts).map(([category, amount]) => ({ user_id: currentUserId, category, amount, updated_at: new Date().toISOString() }));
    const [r1, r2] = await Promise.all([
        supabaseClient.from('budget_monthly_targets').upsert({ user_id: currentUserId, username: currentUsername, month_key: monthKey, target_income: m.income, target_amount: total }, { onConflict: 'user_id,month_key' }),
        rows.length ? supabaseClient.from('budget_category_targets').upsert(rows, { onConflict: 'user_id,category' }) : Promise.resolve({ error: null }),
    ]);
    if (!aiChatIsOpen()) return;
    if ((r1 && r1.error) || (r2 && r2.error)) { aiChatSay(t('nm_save_error'), [aiMoneyDone()], 'is-error'); return; }
    if (typeof renderFinanceSummary === 'function' && document.getElementById('finance-summary-month-label')) { try { renderFinanceSummary(); } catch {} }
    aiMoneyEnd(true);
    aiChatSay(t('ai_money_saved'), [
        { label: t('ai_money_open_budget'), onClick: () => { closeAiChat(); showTabSection('finance-section'); } },
        { label: t('ai_chat_more'), onClick: () => aiChatSay(t('ai_chat_hi_again'), aiChatToolChips()) },
    ], 'is-ok');
}
function aiChatModeChips() {
    return [['onetime', 'ai_chat_mode_onetime'], ['recurring', 'ai_chat_mode_recurring'], ['recurring-daily', 'ai_chat_mode_daily']]
        .map(([mode, key]) => ({
            label: t(key), mode, on: aiChatMode === mode, cls: 'ai-chat-mode',
            onClick: e => {
                aiChatMode = mode;
                e.currentTarget.parentElement.querySelectorAll('.ai-chat-mode').forEach(x => x.classList.toggle('is-on', x.dataset.mode === mode));
            },
        }));
}
// סימון הכלי בכפתורים בלבד (לסיור באפליקציה) - בלי הודעה חדשה
function aiChatHighlightTool(tool) {
    const el = aiChatEl();
    if (el) el.querySelectorAll('.ai-chat-tool').forEach(x => x.classList.toggle('is-on', x.dataset.tool === tool));
}
// "AI עלול לטעות" לא מופיע בכלי "משהו ליומן" (לפי בקשה מפורשת: "אפשר למחוק רק ביומן בכל השאר להשאיר")
function aiChatSyncNote() { const el = aiChatEl(); if (el) el.classList.toggle('is-schedule', aiChatTool === 'schedule'); }
function aiChatPickTool(tool) {
    if (!aiChatIsOpen()) return;
    aiChatTool = tool;
    aiChatSyncNote();
    aiChatHighlightTool(tool);
    if (aiChatAsk) aiChatAsk.forEach(el => el.remove());
    const ask = aiChatBubble(t('ai_chat_ask_' + tool), 'bot');
    const modes = tool === 'schedule' ? aiChatChips(aiChatModeChips()) : null;
    aiChatAsk = [ask, modes].filter(Boolean);
    const i = aiChatEl().querySelector('.ai-chat-input input');
    if (i) i.focus();
}
function aiChatAfterChips(tool) {
    const chips = [{ label: t('ai_chat_more'), onClick: () => { aiChatTool = null; aiChatSyncNote(); aiChatSay(t('ai_chat_hi_again'), aiChatToolChips()); } }];
    if (tool === 'schedule') chips.push({ label: t('ai_chat_see_calendar'), onClick: () => { closeAiChat(); showTabSection('schedule-section'); } });
    if (tool === 'money_log') chips.push({ label: t('ai_money_open_budget'), onClick: () => { closeAiChat(); showTabSection('finance-section'); } });
    if (tool === 'food') {
        const entry = aiChatFoodEntry();
        if (entry) chips.unshift({ label: t('ai_chat_food_edit'), cls: 'ai-chat-fix-chip', onClick: () => aiChatOpenFoodFix(entry) });
        chips.push({ label: t('ai_chat_see_food'), onClick: () => { closeAiChat(); showTabSection('nutrition-section'); } });
    }
    return chips;
}

// ---------- ✏️ תיקון קלוריות / חלבון של מה שנרשם עכשיו ----------
// lastFoodQuickEntry (app.js) מתאפס בכל שליחה של אוכל, אז זה תמיד מה שנרשם בשליחה הזו
function aiChatFoodEntry() {
    return typeof lastFoodQuickEntry !== 'undefined' && lastFoodQuickEntry ? lastFoodQuickEntry : null;
}
function aiChatOpenFoodFix(entry) {
    const b = aiChatBody();
    if (!b || !entry) return;
    b.querySelectorAll('.ai-chat-fix').forEach(el => el.remove());
    const form = document.createElement('form');
    form.className = 'ai-chat-msg is-bot ai-chat-fix';
    const prot = entry.protein != null ? Math.round(entry.protein) : '';
    form.innerHTML = `<label><span>${aiChatEsc(t('calories_input_placeholder'))}</span><input type="number" name="cal" inputmode="numeric" min="1" max="9999" step="1" value="${aiChatEsc(entry.calories)}"></label>`
        + `<label><span>${aiChatEsc(t('protein_input_placeholder'))}</span><input type="number" name="prot" inputmode="numeric" min="0" max="999" step="1" value="${aiChatEsc(prot)}"></label>`
        + `<button type="submit" class="ai-chat-chip is-on">${aiChatEsc(t('save_generic'))}</button>`;
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const calRaw = form.querySelector('[name="cal"]').value.trim();
        const protRaw = form.querySelector('[name="prot"]').value.trim();
        const cal = Math.round(Number(calRaw));
        const protein = protRaw === '' ? null : Math.round(Number(protRaw));
        if (!calRaw || !Number.isFinite(cal) || cal <= 0 || (protein != null && (!Number.isFinite(protein) || protein < 0))) {
            aiChatSay(t('ai_chat_food_invalid'), null, 'is-error');
            return;
        }
        const btn = form.querySelector('button');
        btn.disabled = true;
        const ok = await updateQuickLogEntry(entry, cal, protein);
        if (!aiChatIsOpen()) return;
        if (!ok) { btn.disabled = false; aiChatSay(t('nm_save_error'), null, 'is-error'); return; }
        form.remove();
        const summary = `${cal} ${t('calories_unit')}${protein != null ? ` · ${t('nm_protein_short').replace('{n}', protein)}` : ''}`;
        aiChatSay(`${t('ai_chat_food_updated')} ${entry.text} (${summary})`, aiChatAfterChips('food'), 'is-ok');
    });
    b.appendChild(form);
    aiChatScroll();
    const first = form.querySelector('input');
    if (first) { first.focus(); first.select(); }
}

// ---------- ההודעות של המנועים מגיעות לשיחה ----------
function aiChatHookToasts() {
    if (aiChatToastOrig) return;
    aiChatToastOrig = showAppToast;
    const orig = aiChatToastOrig;
    const hooked = function (msg, type, ...rest) {
        if (aiChatIsOpen() && msg) {
            // הודעה של המיקרופון ("לא שמעתי") היא לא התשובה לבקשה - ה"✓ בוצע" עדיין מגיע
            const fromMic = typeof DICTATION_ERROR_KEYS !== 'undefined' && Object.values(DICTATION_ERROR_KEYS).concat('quick_note_voice_failed').some(k => t(k) === String(msg));
            if (!fromMic) aiChatAnswered = true;
            const err = type === 'error';
            // גם כשההודעה היא אזהרה (כמו "נראה הרבה") - אם האוכל כבר נרשם, אפשר לתקן אותו
            const fixable = err && aiChatTool === 'food' && aiChatFoodEntry();
            aiChatSay(String(msg), err && !fixable ? null : aiChatAfterChips(aiChatTool), err ? 'is-error' : 'is-ok');
            return undefined;
        }
        return orig.call(this, msg, type, ...rest);
    };
    showAppToast = hooked;
    window.showAppToast = hooked;
}
function aiChatUnhookToasts() {
    if (!aiChatToastOrig) return;
    showAppToast = aiChatToastOrig;
    window.showAppToast = aiChatToastOrig;
    aiChatToastOrig = null;
}

// ---------- שליחה ----------
// בלי כלי שנבחר: אוכל ("אכלתי", "ארוחה"...) / טבלה / ואחרת - היומן
function aiChatDetect(text) {
    const s = String(text || '').toLowerCase();
    if (/טבלה|טבלת|\btable\b|spreadsheet/.test(s)) return 'table';
    // 💰 כסף: "לסדר את החודש / התקציב" פותח את השיחה על כסף; "הוצאתי 50 על סופר" נרשם ישר בתקציב
    if (/(לסדר|לבנות|לתכנן).{0,12}(תקציב|הוצאות|הכנסות|החודש)|\bbudget\b|plan my month/.test(s)) return 'money';
    if (/\d/.test(s) && /הוצאתי|שילמתי|קיבלתי|קניתי|משכורת|הכנסה|הוצאה|₪|\bspent\b|\bpaid\b|\bsalary\b|\bincome\b|\bexpense\b|\bearned\b/.test(s)) return 'money_log';
    if (/אכלתי|שתיתי|נשנשתי|ארוחה|ארוחת|קלוריות|קק"ל|קק״ל|\bate\b|\beaten\b|calorie|kcal|breakfast|lunch|dinner|snack/.test(s)) return 'food';
    return 'schedule';
}
async function aiChatSend() {
    const el = aiChatEl();
    if (!el || aiChatBusy) return;
    const input = el.querySelector('.ai-chat-input input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    aiChatBubble(text, 'me');
    aiChatAsk = null;
    // באמצע השיחה על כסף - התשובה הולכת לשאלה ששאלנו
    if (aiMoney) { aiMoneyAnswer(text); return; }
    let tool = aiChatTool || aiChatDetect(text);
    if (tool === 'money' && !aiChatTool) { aiMoneyStart(); return; }
    if (tool === 'money') tool = aiChatDetect(text) === 'money_log' ? 'money_log' : 'money';
    if (tool === 'money') { aiMoneyStart(); return; }
    if (tool === 'money_log') {
        aiChatTool = 'money_log';
        const fin = document.getElementById('ai-finance-input');
        if (fin && typeof parseFinanceWithAI === 'function') { fin.value = text; aiChatAnswered = false; await parseFinanceWithAI(); }
        aiChatTool = null;
        aiChatSyncNote();
        return;
    }
    aiChatTool = tool;
    aiChatSyncNote();
    const typing = aiChatBubble(t('ai_chat_working_' + tool), 'bot', 'is-typing');
    aiChatBusy = true;
    aiChatAnswered = false;
    try {
        if (tool === 'food') {
            document.getElementById('food-quick-add-input').value = text;
            if (typeof lastFoodQuickEntry !== 'undefined') lastFoodQuickEntry = null;
            await logFoodQuickAdd();
        } else if (tool === 'table') {
            document.getElementById('ai-table-input').value = text;
            await buildTableWithAI();
        } else {
            setScheduleAiMode(aiChatMode);
            document.getElementById('ai-schedule-input').value = text;
            await parseScheduleWithAI();
        }
    } catch (e) {
        console.error('ai chat failed', e);
        if (aiChatIsOpen()) aiChatSay(t('ai_chat_error'), null, 'is-error');
        aiChatAnswered = true;
    } finally {
        aiChatBusy = false;
        if (typing) typing.remove();
    }
    if (!aiChatIsOpen()) return;
    // יציאה מהלופ (לפי דיווח מפורש, 2026-11-15: "איך יוצאים מהלופ?"): טבלה היא בקשה חד-פעמית - אחרי שנבנתה, ההודעה
    // הבאה שוב מזוהה לבד (ולא בונה עוד טבלה)
    if (tool === 'table') { aiChatTool = null; aiChatSyncNote(); aiChatHighlightTool(null); }
    // הטבלה נפתחת במסך שלה - שם התוצאה
    if (tool === 'table' && document.querySelector('.apple-modal.open') && !aiChatAnswered) { closeAiChat(); return; }
    // שאלת הבהרה של היומן נפתחה מעל השיחה
    const clarify = document.getElementById('modal-schedule-clarify');
    if (clarify && clarify.classList.contains('open')) { aiChatSay(t('ai_chat_pending')); return; }
    if (!aiChatAnswered) aiChatSay(t('ai_chat_done'), aiChatAfterChips(tool), 'is-ok');
}

// תמונה של מתכון (או ארוחה): כמו הלשונית "תמונה" בחלון הקודם - בוחרים תמונה והסריקה ממשיכה בטופס המתכון
function aiChatPhoto() {
    closeAiChat();
    const inp = document.getElementById('ai-brain-image-input');
    if (inp) inp.click();
}
