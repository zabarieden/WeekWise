// Per-user rate limit for the AI functions, on top of the monthly quotas in user_ai_usage: at most `max` calls of one
// function in `windowSeconds`. Counted in public.ai_rate_events by the SQL function ai_rate_hit() (atomic per user and
// function; old rows are cleaned as it goes - see supabase/sql/2026-11-07_5_rate_limit.sql). It stops a script or a
// stuck button from firing hundreds of paid AI calls in a minute; a person using the app never gets near it.
// If the limiter itself fails (e.g. the SQL function isn't there yet) the call goes through - a real user is never
// blocked because of the limiter.
export const AI_RATE_MAX = 10;
export const AI_RATE_WINDOW_SECONDS = 60;

// deno-lint-ignore no-explicit-any
export async function aiRateOk(supabase: any, userId: string, fn: string, max = AI_RATE_MAX, windowSeconds = AI_RATE_WINDOW_SECONDS): Promise<boolean> {
    try {
        const { data, error } = await supabase.rpc("ai_rate_hit", { p_user: userId, p_fn: fn, p_max: max, p_window_seconds: windowSeconds });
        if (error) return true;
        return data !== false;
    } catch {
        return true;
    }
}
