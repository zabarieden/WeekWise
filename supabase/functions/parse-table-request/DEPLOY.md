# Deploying the AI Table Builder

Same pattern as `scan-recipe-image`/`parse-schedule-request`. If `ANTHROPIC_API_KEY` is
already set for those, you don't need a new key - just deploy this function and it'll
reuse the same secret.

## 1. Database changes

```sql
alter table user_ai_usage add column if not exists table_ai_lifetime_used integer default 0;
alter table user_ai_usage add column if not exists premium_table_ai_month_key text;
alter table user_ai_usage add column if not exists premium_table_ai_month_used integer default 0;
```

Otherwise reads `user_premium.is_premium` (already exists). The frontend never writes
this function's result straight to the DB - it stages the AI's proposed columns/rows
into the exact same editable modal-add-table -> modal-manage-columns flow used for
manual table creation, so a bad AI guess costs nothing to fix.

## 2. Deploy the function

```bash
supabase functions deploy parse-table-request
```

## 3. Secrets

If `ANTHROPIC_API_KEY` is already set as a secret in this project, there's nothing more
to do - secrets are shared across all functions in the same project. If not:

```bash
supabase secrets set ANTHROPIC_API_KEY=<your-api-key-here>
```

## That's it

No cron, no extra tables beyond the 3 new `user_ai_usage` columns above. Called
on-demand from the "Table" tab of the AI assistant modal.

## Known limitations

- **5 free lifetime uses for non-premium users** (`table_ai_lifetime_used`, never
  resets), 40/month for premium (`premium_table_ai_month_used`, lower than schedule's
  60 since a table-build response is heavier per call). No local fallback exists for
  this feature (unlike schedule text parsing) - hitting the limit or a provider error
  just shows a toast and leaves the typed description in place to retry.
- **Cost**: every call is a real, billed Anthropic API call with up to 3000 output
  tokens (12 columns x 10 rows is a lot of structured JSON) - keep an eye on usage.
- **Column/row caps**: 12 columns, 10 rows max, enforced by the tool's `input_schema`
  (Anthropic will not return more even if asked).
