// AI alerts by email to the support inbox (her ask 2026-11-15, after the AI key silently stopped working for two weeks,
// and then "every small thing - email me"):
// - the key is invalid / the credit ran out / a spend limit was reached → every AI feature is down for everyone;
// - any other error answer from Anthropic (busy moment, rate limit, a request it refused) → a small alert;
// - an AI function crashed while serving a user → a small alert.
// At most one email per alert per day: public.ai_provider_alerts has primary key (kind, day), and the email is sent only
// by the call that managed to insert that row (see supabase/sql/2026-11-15_ai_alerts.sql). The big three are one alert
// each for the whole app; the small ones are per function and error code. Nothing here ever throws or blocks the
// user's request, and the API key is never written into an email or an error reply.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const ALERT_EMAIL = Deno.env.get("SUPPORT_EMAIL") || "obeko.support@gmail.com";

// The ANTHROPIC_API_KEY secret, cleaned. On 2026-11-15 the console's copy button put a whole curl example (with the key
// inside) into the secret: fetch then threw "Invalid header value: <the whole text>", and the functions' error replies
// carried the key to the browser. So: take just the key out of whatever was pasted (spaces, new lines, quotes, a curl
// command), else the trimmed value.
export function anthropicKey(): string {
    const raw = Deno.env.get("ANTHROPIC_API_KEY") || "";
    const m = raw.match(/sk-ant-[A-Za-z0-9_-]+/);
    return m ? m[0] : raw.trim();
}

export function redactKey(s: string): string {
    return s.replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-***");
}

// "invalid_key" | "key_permission" | "no_credit" | "spend_limit" | "test" | "error_<status>:<fn>" | "crash:<fn>"
export type AiAlertKind = string;

export function aiAlertKind(status: number, body: string): AiAlertKind | null {
    if (status === 401) return "invalid_key";
    if (/credit balance|billing_error/i.test(body) || status === 402) return "no_credit";
    if (status === 403) return "key_permission";
    if (/(usage|spend(ing)?) limit/i.test(body)) return "spend_limit";
    return null;
}

const SERIOUS: Record<string, { subject: string; what: string }> = {
    invalid_key: {
        subject: "ה-AI באפליקציה לא עובד: מפתח ה-API לא תקין",
        what:
            "המפתח ששמור ב-Supabase כבר לא תקף (נמחק או הושבת).<br>" +
            "1. platform.claude.com/settings/keys ← Create Key ← להעתיק.<br>" +
            "2. Supabase ← Edge Functions ← Secrets ← ANTHROPIC_API_KEY ← Edit ← להדביק ← Save.",
    },
    key_permission: {
        subject: "ה-AI באפליקציה לא עובד: למפתח אין הרשאה",
        what: "למפתח אין הרשאה לשימוש הזה. לבדוק ב-platform.claude.com/settings/keys שהמפתח פעיל ושייך לארגון עם הקרדיט.",
    },
    no_credit: {
        subject: "ה-AI באפליקציה לא עובד: נגמר הקרדיט",
        what: "נגמר הקרדיט ב-Anthropic. platform.claude.com/settings/billing ← Add funds (וכדאי להשאיר Auto-reload דלוק).",
    },
    spend_limit: {
        subject: "ה-AI באפליקציה לא עובד: הגעת לתקרת ההוצאה",
        what: "הגעת לתקרת ההוצאה החודשית שהוגדרה ב-Anthropic. platform.claude.com/settings/limits ← להעלות את התקרה.",
    },
    test: {
        subject: "בדיקה: התראות ה-AI מגיעות למייל הזה",
        what: "זו רק בדיקה. אם המייל הזה הגיע, גם התראה אמיתית תגיע לכאן. אין צורך לעשות כלום.",
    },
};

function alertText(kind: string, fn: string): { subject: string; what: string } {
    if (SERIOUS[kind]) return SERIOUS[kind];
    if (kind.startsWith("crash:")) {
        return {
            subject: `תקלה קטנה בשרת: ${fn}`,
            what: "פונקציה בשרת נכשלה בזמן בקשה של משתמש (הפרטים למטה). אם זה חוזר, להעביר לי את המייל הזה.",
        };
    }
    const code = kind.match(/^error_(\d+)/)?.[1] || "?";
    return {
        subject: `תקלה קטנה ב-AI: ${fn} (קוד ${code})`,
        what:
            "Anthropic החזירו שגיאה לבקשה אחת. בדרך כלל זה עומס רגעי אצלם (529/500) או בקשה חריגה (400), והניסיון הבא " +
            "עובד. אין צורך לעשות כלום, אלא אם זה חוזר כל יום - אז להעביר לי את המייל הזה.",
    };
}

function escapeHtml(s: string): string {
    return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

// Sends the email. Without `force`, only if this alert wasn't already sent today. Returns true when an email went out.
// deno-lint-ignore no-explicit-any
export async function sendAiAlert(supabase: any, kind: AiAlertKind, fn: string, detail: string, force = false): Promise<boolean> {
    try {
        const safeDetail = redactKey(detail);
        if (!force) {
            const { error } = await supabase.from("ai_provider_alerts").insert({ kind, fn, detail: safeDetail.slice(0, 1000) });
            if (error) return false; // already sent today (duplicate key) - or the table isn't there: never spam
        }
        if (!RESEND_API_KEY) return false;
        const { subject, what } = alertText(kind, fn);
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
                from: "NOT10.ai Alerts <onboarding@resend.dev>",
                to: [ALERT_EMAIL],
                subject: `[NOT10.ai] ${subject}`,
                html:
                    `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6">` +
                    `<p><b>${escapeHtml(subject)}</b></p>` +
                    `<p>${what}</p>` +
                    `<p style="color:#777;font-size:13px">פונקציה: ${escapeHtml(fn)}<br>` +
                    `פרטים: <span dir="ltr">${escapeHtml(safeDetail.slice(0, 400))}</span><br>` +
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
        const kind = aiAlertKind(res.status, body) || `error_${res.status}:${fn}`;
        await sendAiAlert(supabase, kind, fn, `${res.status} ${body}`);
    } catch {
        // never blocks the user's request
    }
}

// Call in a function's last catch, before answering 500.
// deno-lint-ignore no-explicit-any
export async function noteAiCrash(supabase: any, fn: string, err: unknown): Promise<void> {
    try {
        await sendAiAlert(supabase, `crash:${fn}`, fn, String(err));
    } catch {
        // never blocks the user's request
    }
}
