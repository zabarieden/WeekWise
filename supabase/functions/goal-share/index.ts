// Supabase Edge Function: goal-share
//
// The accountability friend (her pick, idea 14 from Coach.me, approved 2026-11-17): app.not10.ai/goal.html?t=TOKEN asks
// GET /goal-share?t=TOKEN and gets ONE goal's read-only path - title, icon, how it is tracked, its stations (title + done),
// the step days of the last 12 weeks and whether it was reached. Nothing else about the person (no name, email or other
// goals). The token lives in public.goal_shares; turning the share off in the app deletes it, and the link stops working.
// Deployed with --no-verify-jwt (the friend has no account); reads with the service role.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
};
function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "GET") return json({ error: "method" }, 405);
    const token = new URL(req.url).searchParams.get("t") || "";
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return json({ error: "not_found" }, 404);
    try {
        const { data: share } = await supabase.from("goal_shares").select("goal_id, user_id").eq("token", token).maybeSingle();
        if (!share) return json({ error: "not_found" }, 404);
        const { data: goal } = await supabase.from("vision_goals")
            .select("id, title, icon, category, track_type, target_value, current_value, unit, is_achieved, achieved_at, created_at")
            .eq("id", share.goal_id).eq("user_id", share.user_id).maybeSingle();
        if (!goal) return json({ error: "not_found" }, 404);
        const since = new Date(Date.now() - 84 * 86400000).toISOString().slice(0, 10);
        const [{ data: milestones }, { data: checkins }] = await Promise.all([
            supabase.from("vision_goal_milestones").select("title, is_done, sort_order").eq("goal_id", goal.id).order("sort_order", { ascending: true }).limit(60),
            supabase.from("vision_goal_checkins").select("checkin_date").eq("goal_id", goal.id).gte("checkin_date", since).limit(400),
        ]);
        const days = [...new Set((checkins || []).map((c: { checkin_date: string }) => String(c.checkin_date).slice(0, 10)))].sort();
        return json({
            goal: {
                title: goal.title, icon: goal.icon, category: goal.category, track: goal.track_type || "steps",
                target: goal.target_value, current: goal.current_value, unit: goal.unit,
                reached: !!goal.is_achieved, reached_at: goal.achieved_at, started: String(goal.created_at).slice(0, 10),
            },
            stations: (milestones || []).map((m: { title: string; is_done: boolean }) => ({ title: m.title, done: !!m.is_done })),
            days,
        });
    } catch {
        return json({ error: "server" }, 500);
    }
});
