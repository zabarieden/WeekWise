// AI outage alerts. When Anthropic answers that the API key is invalid, the credit balance is too low or a usage/spend
// limit was reached, every AI feature in the app is down for every user - so the support inbox gets an email (her ask
// 2026-11-15, after the key silently stopped working for two weeks). Ordinary errors (a busy moment, a bad request)
// never send anything.
// At most one email per kind per day: public.ai_provider_alerts has primary key (kind, day), and the email is sent only
// by the call that managed to insert that row (see supabase/sql/2026-11-15_ai_alerts.sql). Nothing here ever throws or
// blocks the user's request.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ALERT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "obeko.support@gmail.com";

// The ANTHROPIC_API_KEY secret, cleaned. On 2026-11-15 the console's copy button put a whole curl example (with the key
// inside) into the secret: fetch then threw "Invalid header value: <the whole text>", and the functions' error replies
// would have carried the key to the browser. So: take just the key out of whatever was pasted (spaces, new lines,
// quotes, a curl command), else the trimmed value.
export function anthropicKey(): string {
    const raw = Deno.env.get("ANTHROPIC_API_KEY") || "";
    const m = raw.match(/sk-ant-[A-Za-z0-9_-]+/);
    return m ? m[0] : raw.trim();
}

export type AiAlertKind ="invalid_key" | "key_permission" | "no_credit" | "spend_limit" | "test";

export function aiAlertKind(status: number, body: string): AiAlertKind | null {
    if (status === 401) return "invalid_key";
    if (/credit balance|billing_error/i.test(body) || status === 402) return "no_credit";
    if (status === 403) return "key_permission";
    if (/(usage|spend(ing)?) limit/i.test(body)) return "spend_limit";
    return null;
}

const SUBJECT: Record<AiAlertKind, string> = {
    invalid_key: "ה-AI באפליקציה לא עובד: מפתח ה-API לא תקין",
    key_permission: "ה-AI באפליקציה לא עובד: למפתח אין הרשאה",
    no_credit: "ה-AI באפליקציה לא עובד: נגמר הקרדיט",
    spend_limit: "ה-AI באפליקציה לא עובד: הגעת לתקרת ההוצאה",
    test: "בדיקה: התראות ה-AI מגיעות למייל הזה",
};

const WHAT_TO_DO: Record<AiAlertKind, string> = {
    invalid_key:
        "המפתח ששמור ב-Supabase כבר לא תקף (נמחק או הושבת).<br>" +
        "1. platform.claude.com/settings/keys ← Create Key ← להעתיק.<br>" +
        "2. Supabase ← Edge Functions ← Secrets ← ANTHROPIC_API_KEY ← Edit ← להדביק ← Save.",
    key_permission:
        "למפתח אין הרשאה לשימוש הזה. לבדוק ב-platform.claude.com/settings/keys שהמפתח פעיל ושייך לארגון עם הקרדיט.",
    no_credit:
        "נגמר הקרדיט ב-Anthropic. platform.claude.com/settings/billing ← Add funds (וכדאי להשאיר Auto-reload דלוק).",
    spend_limit:
        "הגעת לתקרת ההוצאה החודשית שהוגדרה ב-Anthropic. platform.claude.com/settings/limits ← להעלות את התקרה.",
    test: "זו רק בדיקה. אם המייל הזה הגיע, גם התראה אמיתית תגיע לכאן. אין צורך לעשות כלום.",
};

function escapeHtml(s: string): string {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// Sends the email. Without `force`, only if this kind wasn't already sent today. Returns true when an email went out.
// deno-lint-ignore no-explicit-any
export async function sendAiAlert(supabase: any, kind: AiAlertKind, fn: string, detail: string, force = false): Promise<boolean> {
    try {
        if (!force) {
            const { error } = await supabase.from("ai_provider_alerts").insert({ kind, fn, detail: detail.slice(0, 1000) });
            if (error) return false; // already sent today (duplicate key) - or the table isn't there: never spam
        }
        if (!RESEND_API_KEY) return false;
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                from: "NOT10.ai Alerts <onboarding@resend.dev>",
                to: [ALERT_EMAIL],
                subject: `[NOT10.ai] ${SUBJECT[kind]}`,
                html:
                    `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">` +
                    `<p><b>${escapeHtml(SUBJECT[kind])}</b></p>` +
                    `<p>${WHAT_TO_DO[kind]}</p>` +
                    `<p style="color:#777;font-size:13px">פונקציה: ${escapeHtml(fn)}<br>` +
                    `פרטים: <span dir="ltr">${escapeHtml(detail.slice(0, 400))}</span><br>` +
                    `מייל אחד לכל היותר ביום לכל סוג תקלה.</p></div>`,
            }),
        });
        return res.ok;
    } catch {
        return false;
    }
}

// Call right after a failed Anthropic response; pass a clone so the caller can still read the body.
// deno-lint-ignore no-explicit-any
export async function noteAiProviderError(supabase: any, fn: string, res: Response): Promise<void> {
    try {
        const body = await res.text();
        const kind = aiAlertKind(res.status, body);
        if (kind) await sendAiAlert(supabase, kind, fn, `${res.status} ${body}`);
    } catch {
        // never blocks the user's request
    }
}
