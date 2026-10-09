// ===== העוזר: חלון שיחה (לפי בחירה מפורשת – אפשרות ג, "כאן בשבילך") =====
// במקום ארבע לשוניות: שיחה. בוחרים כלי (משהו ליומן / מה אכלתי / תמונה של מתכון / טבלה) או פשוט כותבים,
// והעוזר מזהה לבד. מאחורי הקלעים רצים בדיוק אותם מנועים כמו קודם (parseScheduleWithAI, logFoodQuickAdd,
// buildTableWithAI וסריקת התמונה) דרך השדות של החלון הקודם (#modal-ai-brain, שנשאר מוסתר). כל הודעה
// שהם מציגים בזמן שהשיחה פתוחה מגיעה לשיחה כתשובה של העוזר, במקום טוסט. השיחה לא נשמרת - כל פתיחה מתחילה מחדש
let aiChatTool = null;        // 'schedule' | 'food' | 'table' | null (= לזהות לבד)
let aiChatMode = 'onetime';   // ללו"ז: פעם אחת / כל שבוע / כל יום (כמו הכפתורים בחלון הקודם)
let aiChatBusy = false;
let aiChatAnswered = false;   // האם המנוע כבר ענה בשיחה (דרך הודעה) בריצה הנוכחית
let aiChatToastOrig = null;

const AI_CHAT_SVG = {
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
};

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
                <span class="ai-chat-orb" aria-hidden="true"></span>
                <span class="ai-chat-titles"><b>${aiChatEsc(t('ai_chat_title'))}</b><small>${aiChatEsc(t('ai_chat_sub'))}</small></span>
                <button type="button" class="ai-chat-x" aria-label="${aiChatEsc(t('close_btn'))}">${AI_CHAT_SVG.x}</button>
            </div>
            <div class="ai-chat-body" aria-live="polite"></div>
            <form class="ai-chat-input">
                <input type="text" maxlength="600" enterkeyhint="send" placeholder="${aiChatEsc(t('ai_chat_placeholder'))}" aria-label="${aiChatEsc(t('ai_chat_placeholder'))}">
                <button type="button" class="ai-chat-cam" aria-label="${aiChatEsc(t('ai_chat_camera'))}" title="${aiChatEsc(t('ai_chat_camera'))}">${AI_CHAT_SVG.cam}</button>
                <button type="submit" class="ai-chat-send" aria-label="${aiChatEsc(t('ai_chat_send'))}">${AI_CHAT_SVG.send}</button>
            </form>
        </div>`;
    (document.querySelector('.phone-wrapper') || document.body).appendChild(wrap);
    document.body.classList.add('ai-chat-open');
    wrap.addEventListener('click', e => { if (e.target === wrap) closeAiChat(); });
    wrap.addEventListener('keydown', e => { if (e.key === 'Escape') closeAiChat(); });
    wrap.querySelector('.ai-chat-x').addEventListener('click', () => closeAiChat());
    wrap.querySelector('.ai-chat-cam').addEventListener('click', aiChatPhoto);
    wrap.querySelector('.ai-chat-input').addEventListener('submit', e => { e.preventDefault(); aiChatSend(); });
    aiChatHookToasts();
    aiChatTool = null;
    aiChatMode = 'onetime';
    aiChatBusy = false;
    aiChatSay(t('ai_chat_hi'), aiChatToolChips());
    if (tool && tool !== 'photo') aiChatPickTool(tool);
    setTimeout(() => { const i = wrap.querySelector('.ai-chat-input input'); if (i) i.focus(); }, 80);
}

function closeAiChat() {
    const el = aiChatEl();
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
    el.textContent = text;
    b.appendChild(el);
    aiChatScroll();
    return el;
}
function aiChatChips(chips) {
    const b = aiChatBody();
    if (!b || !chips || !chips.length) return null;
    const row = document.createElement('div');
    row.className = 'ai-chat-chips';
    chips.forEach(c => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `ai-chat-chip${c.cls ? ' ' + c.cls : ''}${c.on ? ' is-on' : ''}`;
        btn.textContent = c.label;
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
    return [['schedule', 'ai_chat_tool_schedule'], ['food', 'ai_chat_tool_food'], ['photo', 'ai_chat_tool_photo'], ['table', 'ai_chat_tool_table']]
        .map(([tool, key]) => ({ label: t(key), tool, cls: 'ai-chat-tool', onClick: () => (tool === 'photo' ? aiChatPhoto() : aiChatPickTool(tool)) }));
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
function aiChatPickTool(tool) {
    if (!aiChatIsOpen()) return;
    aiChatTool = tool;
    aiChatHighlightTool(tool);
    aiChatSay(t('ai_chat_ask_' + tool), tool === 'schedule' ? aiChatModeChips() : null);
    const i = aiChatEl().querySelector('.ai-chat-input input');
    if (i) i.focus();
}
function aiChatAfterChips(tool) {
    const chips = [{ label: t('ai_chat_more'), onClick: () => { aiChatTool = null; aiChatSay(t('ai_chat_hi_again'), aiChatToolChips()); } }];
    if (tool === 'schedule') chips.push({ label: t('ai_chat_see_calendar'), onClick: () => { closeAiChat(); showTabSection('schedule-section'); } });
    if (tool === 'food') chips.push({ label: t('ai_chat_see_food'), onClick: () => { closeAiChat(); showTabSection('nutrition-section'); } });
    return chips;
}

// ---------- ההודעות של המנועים מגיעות לשיחה ----------
function aiChatHookToasts() {
    if (aiChatToastOrig) return;
    aiChatToastOrig = showAppToast;
    const orig = aiChatToastOrig;
    const hooked = function (msg, type, ...rest) {
        if (aiChatIsOpen() && msg) {
            aiChatAnswered = true;
            const err = type === 'error';
            aiChatSay(String(msg), err ? null : aiChatAfterChips(aiChatTool), err ? 'is-error' : 'is-ok');
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
    const tool = aiChatTool || aiChatDetect(text);
    aiChatTool = tool;
    const typing = aiChatBubble(t('ai_chat_working_' + tool), 'bot', 'is-typing');
    aiChatBusy = true;
    aiChatAnswered = false;
    try {
        if (tool === 'food') {
            document.getElementById('food-quick-add-input').value = text;
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
