# book-lookup – deploy

Second source for book details in the Reading Corner (Google Books), used when Open Library
doesn't find enough.

## 1. Google Books API key (one-time)

Google Cloud Console → the app's project → APIs & Services:

1. Library → "Books API" → Enable.
2. Credentials → Create credentials → API key.
3. Edit the key → API restrictions → Restrict key → Books API → Save.

Without a key the function still answers, but Google rejects most keyless requests (429) and
the app shows only the Open Library results.

## 2. Secret + deploy

```
supabase secrets set GOOGLE_BOOKS_API_KEY=<the-key>
supabase functions deploy book-lookup
```

JWT stays verified by the gateway (logged-in users only), so the quota can't be used by anyone else.
