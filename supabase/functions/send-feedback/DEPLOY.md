# Deploying the in-app Feedback form

Lets a logged-in user submit a bug report / feature idea / help question / other
message from inside the app. It's stored in the database AND emailed in real time to
the support inbox, so nothing relies on the device having a mail client configured.

## 1. Database changes

Already applied directly to the linked project:

```sql
create table if not exists public.feedback_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    username text,
    category text not null,
    message text not null,
    created_at timestamptz not null default now()
);
alter table public.feedback_messages enable row level security;
```

No RLS policy is added on purpose - this table is written ONLY by this Edge Function
via the service-role key, exactly like `user_premium`/`user_ai_usage` are protected.
There is no client-side SELECT/INSERT policy at all, so even a technical user poking
at the browser devtools cannot read other people's messages or write fake ones
directly against the table.

## 2. Deploy the function

```bash
supabase functions deploy send-feedback
```

## 3. Secrets

This function needs a Resend account (https://resend.com) to actually send the email -
free tier is enough for this volume. Sign up, then get an API key from the dashboard
(Dashboard → API Keys → Create API Key).

```bash
supabase secrets set RESEND_API_KEY=<your-resend-api-key-here>
```

`SUPPORT_EMAIL` defaults to `obeko.support@gmail.com` if not set. Only set it explicitly
if a different inbox should receive these:

```bash
supabase secrets set SUPPORT_EMAIL=<your-support-address-here>
```

`ANTHROPIC_API_KEY` (for the Hebrew translation below) is already set from deploying
`scan-recipe-image`/`parse-schedule-request` - nothing new to do there, it's shared
automatically since secrets are per-project, not per-function.

## Hebrew translation for the support inbox

The app has 33 languages, so a submitted message can be in anything. Every email sent
to `SUPPORT_EMAIL` also includes a Hebrew translation above the original text (via the
Anthropic API, same key/model as the other AI features) - this is support-inbox-only,
the submitting user never sees it and their own message is stored/treated exactly as
they wrote it. If the message is already in Hebrew, or the translation call fails for
any reason, the email still sends with just the original text - translation never
blocks or delays the actual feedback from reaching the inbox.

## Known limitations

- **Sender address**: emails are sent from Resend's shared `onboarding@resend.dev`
  sender since no custom domain is verified yet on the Resend account. This works fine
  for delivery, it just won't show "NOT10.ai" as the sending domain in the recipient's
  email client - once `not10.ai` (already purchased) is verified in Resend, switch the
  `from` address in `index.ts` to something like `NOT10.ai Support <support@not10.ai>`.
- **Reply-To**: each email sets `reply_to` to the submitting user's own email, so
  replying from Gmail goes straight back to them even though the `from` address is
  Resend's shared one.
- **Silent email failure**: if the Resend API call fails for any reason, the feedback
  is still saved to `feedback_messages` (that insert happens first and is what the
  function reports success/failure on) - only the real-time email notification would
  be missing. Check the `feedback_messages` table directly if a report seems to have
  gone unanswered.
