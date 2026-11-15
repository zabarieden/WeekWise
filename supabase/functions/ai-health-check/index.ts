// Supabase Edge Function: ai-health-check
//
// Called once a day by pg_cron (supabase/sql/2026-11-15_ai_alerts.sql) with the service role key. It makes one tiny
// Anthropic call (1 output token - a tiny fraction of a cent), so an invalid key, an empty credit balance or a reached
// spend limit is noticed even on days when nobody uses AI - in November 2026 the key stopped working and nobody knew
// for two weeks. On those errors the support inbox gets an email (at most one per kind per day, see _shared/ai-alert.ts).
// POST {"test": true} sends a test email instead, so the owner can see that alerts arrive.
// Only the service role may call it (the gateway checks the JWT signature, this checks the role).

import { createClient } from "npm:@supabase/supabase-js@2";
import { anthropicKey, lastResend, noteAiProviderError, sendAiAlert } from "../_shared/ai-alert.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = anthropicKey();
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function jwtRole(req: Request): string | null {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const part = token.split(".")[1];
    if (!part) return null;
    try {
        const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
        return JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, "="))).role || null;
    } catch {
        return null;
    }
}

Deno.serve(async (req) => {
    if (jwtRole(req) !== "service_role") return jsonResponse({ error: "forbidden" }, 403);

    // deno-lint-ignore no-explicit-any
    let body: any = {};
    try { body = await req.json(); } catch { /* the daily cron sends no body */ }

    if (body?.test) {
        // also proves the alerts table is there and writable (the real alerts need it to send at most once a day)
        const { error } = await supabase.from("ai_provider_alerts").insert({ kind: "test", fn: "ai-health-check", detail: "test" });
        const sent = await sendAiAlert(supabase, "test", "ai-health-check", "test", true);
        return jsonResponse({ test: true, table_ok: !error || error.code === "23505", sent, resend: lastResend });
    }

    if (typeof body?.email_id === "string" && /^[A-Za-z0-9-]{8,64}$/.test(body.email_id)) {
        // what happened to a sent email (delivered / bounced / complained ...), for when a test doesn't show up
        const r = await fetch(`https://api.resend.com/emails/${body.email_id}`, {
            headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY") || ""}` },
        });
        return jsonResponse({ status: r.status, email: await r.json().catch(() => null) });
    }

    if (!ANTHROPIC_API_KEY.trim()) {
        await sendAiAlert(supabase, "invalid_key", "ai-health-check", "ANTHROPIC_API_KEY is empty");
        return jsonResponse({ ok: false, error: "no_key" });
    }

    try {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({ model: ANTHROPIC_MODEL, max_tokens: 1, messages: [{ role: "user", content: "ping" }] }),
        });
        if (!res.ok) {
            const text = await res.clone().text();
            await noteAiProviderError(supabase, "ai-health-check", res);
            return jsonResponse({ ok: false, status: res.status, detail: text.slice(0, 300) });
        }
        return jsonResponse({ ok: true, model: ANTHROPIC_MODEL });
    } catch (err) {
        return jsonResponse({ ok: false, error: String(err).replace(/sk-ant-[A-Za-z0-9_-]+/g, "sk-ant-***").slice(0, 300) });
    }
});
