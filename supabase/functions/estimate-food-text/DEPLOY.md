# Deploying AI-powered quick food-add (Premium)

Same pattern as `scan-meal-photo`/`scan-recipe-image`/`parse-schedule-request`.
Reuses the same `ANTHROPIC_API_KEY` secret - no new account or key needed if
you've already set one up.

## 1. Database changes

```sql
alter table user_ai_usage add column if not exists premium_food_text_month_key text;
alter table user_ai_usage add column if not exists premium_food_text_month_used integer default 0;
alter table user_ai_usage add column if not exists food_text_lifetime_used integer default 0;

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

- **5 free lifetime uses for non-premium users** (`food_text_lifetime_used`,
  never resets) - after that, non-premium users fall back to the existing
  instant local heuristic (`estimateFreeTextMacros` in app.js). Premium users
  are governed only by the monthly quota below and never touch this counter.
- **At most one clarifying question per entry** - enforced by swapping to a
  tool schema that has no "clarify" option at all on the follow-up call, not
  just by prompt wording, so there's no risk of an endless back-and-forth.
- **180/month cap for premium**: once reached, the app silently falls back to
  the local heuristic (with a toast noting it's less precise) rather than
  blocking logging entirely - a paying user should never be unable to log a
  meal.
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

## Nutrition reference data (TZAMERET + USDA)

Two more free advisory data sources, same "AI judges relevance itself, empty
result changes nothing" philosophy as Open Food Facts above - see
`lookupNutritionReference`/`buildOrTsQuery` in `index.ts`. Already applied
and populated directly against the linked project (not something you need to
re-run unless rebuilding the database from scratch):

```sql
create table if not exists tzameret_foods (
    id uuid primary key default gen_random_uuid(),
    source text not null default 'tzameret',
    source_id text not null,
    name text not null,
    name_en text,
    kcal_100g numeric,
    protein_100g numeric,
    fat_100g numeric,
    carbs_100g numeric,
    name_tsv tsvector generated always as (to_tsvector('simple', coalesce(name, ''))) stored,
    created_at timestamptz not null default now(),
    unique (source, source_id)
);
create index if not exists tzameret_foods_tsv_idx on tzameret_foods using gin (name_tsv);
alter table tzameret_foods enable row level security;

create table if not exists usda_foods (
    id uuid primary key default gen_random_uuid(),
    source text not null,
    source_id text not null,
    name text not null,
    kcal_100g numeric,
    protein_100g numeric,
    fat_100g numeric,
    carbs_100g numeric,
    name_tsv tsvector generated always as (to_tsvector('english', coalesce(name, ''))) stored,
    created_at timestamptz not null default now(),
    unique (source, source_id)
);
create index if not exists usda_foods_tsv_idx on usda_foods using gin (name_tsv);
alter table usda_foods enable row level security;

create or replace function search_tzameret_foods(query_text text, max_rows int default 3)
returns table(name text, kcal_100g numeric, protein_100g numeric, fat_100g numeric, carbs_100g numeric)
language sql stable as $$
    select name, kcal_100g, protein_100g, fat_100g, carbs_100g
    from tzameret_foods
    where name_tsv @@ to_tsquery('simple', query_text)
    order by ts_rank(name_tsv, to_tsquery('simple', query_text)) desc
    limit max_rows;
$$;
revoke execute on function search_tzameret_foods(text, int) from public, anon, authenticated;

create or replace function search_usda_foods(query_text text, max_rows int default 3)
returns table(name text, kcal_100g numeric, protein_100g numeric, fat_100g numeric, carbs_100g numeric)
language sql stable as $$
    select name, kcal_100g, protein_100g, fat_100g, carbs_100g
    from usda_foods
    where name_tsv @@ to_tsquery('english', query_text)
    order by ts_rank(name_tsv, to_tsquery('english', query_text)) desc
    limit max_rows;
$$;
revoke execute on function search_usda_foods(text, int) from public, anon, authenticated;
```

Like `feedback_messages`, no RLS policies are added on purpose - only this
Edge Function's service-role key ever reads these tables (which bypasses RLS
regardless), so zero policies locks the anon/authenticated PostgREST
auto-API out entirely as defense-in-depth.

**Data**: `tzameret_foods` holds Israel's Ministry of Health national
nutrition database (4,624 Hebrew items, including prepared/traditional
dishes like חמין and מג'דרה - not just raw ingredients), pulled in one call
from data.gov.il's CKAN `datastore_search` API (its static CSV download is
behind a bot-challenge, but this API isn't). `usda_foods` holds USDA
FoodData Central's "Foundation Foods" (469 lab-analyzed items) and "SR
Legacy" (7,793 items) subsets - generic English ingredients only, not the
much larger "Branded Foods" set, since branded/packaged products are already
covered by Open Food Facts above. Both were bulk-inserted via
`./supabase.exe db query --file <sql> --linked` from PowerShell-generated
SQL (no Node.js in this environment) - see conversation history if this
ever needs to be re-run/refreshed from the source data.

Query strategy: user text is tokenized and joined with `|` (OR, not AND) so
a multi-item description has a real chance of matching a single-food-name
row - `plainto_tsquery`/`websearch_to_tsquery` would AND every word
together and almost never match anything. This trades precision for recall
on purpose, same as Open Food Facts: the AI is shown 1-3 candidate matches
per source and decides for itself whether any is actually relevant.

## Fixed: `temperature: 0` removed

The previous version pinned `temperature: 0` for deterministic output.
Claude Sonnet 5 (the model this function defaults to) rejects any
non-default sampling parameter with a 400 - so if the `ANTHROPIC_MODEL`
secret was on Sonnet 5, every call to this function was failing and silently
falling back to the local heuristic client-side. Removed; determinism is
now left to the prompt instructions alone (temperature 0 never fully
guaranteed identical output across calls anyway).
