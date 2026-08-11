# Deploying AI-powered quick food-add (Premium)

Same pattern as `scan-meal-photo`/`scan-recipe-image`/`parse-schedule-request`.
Reuses the same `ANTHROPIC_API_KEY` secret - no new account or key needed if
you've already set one up.

## 1. Database changes

```sql
alter table user_ai_usage add column if not exists premium_food_text_month_key text;
alter table user_ai_usage add column if not exists premium_food_text_month_used integer default 0;

create table if not exists food_text_cache (
    id uuid primary key default gen_random_uuid(),
    cache_key text not null unique,
    calories integer not null,
    created_at timestamptz not null default now()
);
create index if not exists food_text_cache_key_idx on food_text_cache(cache_key);
```

Own dedicated quota, not shared with the image-scan pool (text-only calls are
much cheaper than vision calls, so they get their own 100/month pool instead
of eating into the image quota - matches how `parse-schedule-request` also
has its own pool).

`food_text_cache` is a global (all-users) cache of past "estimate" results,
keyed on `language|country|normalized-text`. A repeat/identical description
(after trivial whitespace/case normalization - not fuzzy matching) returns
instantly with no AI call, no web search, and no quota cost. New/different
descriptions are completely unaffected - same AI+web-search pipeline as
before, same accuracy. Entries expire after 180 days so a chain's menu
change eventually gets re-estimated rather than staying cached forever.

## 2. Deploy the function

```bash
supabase functions deploy estimate-food-text
```

## 3. Secrets

Nothing new if `ANTHROPIC_API_KEY` is already set for this project. Otherwise:

```bash
supabase secrets set ANTHROPIC_API_KEY=<your-api-key-here>
```

## Known limitations

- **Premium-only, no free tier** - free users keep the existing instant local
  heuristic (`estimateFreeTextCalories` in app.js) unchanged; this function is
  never called for them.
- **At most one clarifying question per entry** - enforced by swapping to a
  tool schema that has no "clarify" option at all on the follow-up call, not
  just by prompt wording, so there's no risk of an endless back-and-forth.
- **100/month cap**: once reached, the app silently falls back to the local
  heuristic (with a toast noting it's less precise) rather than blocking
  logging entirely - a paying user should never be unable to log a meal.
- **Estimates, not measurements**: like every AI calorie estimate in this
  app, this is a best-effort guess, not a lab measurement.

## Web search for chain/branded items

The function now declares Anthropic's server-side `web_search` tool
alongside `estimate_or_clarify`. The prompt instructs the model to search
*only* when the description names a specific chain/brand (e.g. "מקדונלד'ס
ביג מק") - generic home-cooked food is still estimated directly with no
search, to keep the common case fast and cheap. This is a prompt-level
instruction, not a hard code gate, so it's not airtight - the model can
occasionally search when it didn't need to, or skip a search it should have
done. Worth a periodic spot-check on the Anthropic console's usage logs.

`web_search` bills separately per search (in addition to normal token
usage) - check current pricing on platform.claude.com before/while this is
live, since it changes the per-call cost profile beyond what the existing
100/month quota was sized around.

`tool_choice` can no longer be forced to `estimate_or_clarify` alone (that
would block the model from calling `web_search` first), so the "always end
with a real answer" instruction now lives in the tool descriptions and the
prompt itself instead of being structurally enforced. The `pause_turn`
retry loop (max 3 extra round-trips) handles the rare case where a call
runs long enough to hit the server-side tool-call cap.

## Fixed: `temperature: 0` removed

The previous version pinned `temperature: 0` for deterministic output.
Claude Sonnet 5 (the model this function defaults to) rejects any
non-default sampling parameter with a 400 - so if the `ANTHROPIC_MODEL`
secret was on Sonnet 5, every call to this function was failing and silently
falling back to the local heuristic client-side. Removed; determinism is
now left to the prompt instructions alone (temperature 0 never fully
guaranteed identical output across calls anyway).
