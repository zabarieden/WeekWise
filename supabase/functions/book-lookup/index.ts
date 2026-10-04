// Supabase Edge Function: book-lookup
//
// Second source for "📚 Reading Corner" book details (title, author, pages, cover), used when
// Open Library (called straight from the browser, no key) doesn't find enough - common for
// books in Hebrew. Calls the Google Books API with the GOOGLE_BOOKS_API_KEY secret, so the key
// never ships in the public client code. Without the secret it still tries keyless, which
// Google usually rejects with 429 - the client then simply shows the Open Library results.
//
// Body: { q, mode: "title" | "author", author? }  →  { items: [{ title, author, pages, cover, thumb, link }] }
// Google's terms: results are shown with the "Powered by Google" logo and a link to each
// book's Google Books page (link field) - see renderBookLookup in books.js.
//
// Deploy: supabase functions deploy book-lookup   (JWT verified by the gateway - logged-in users only)

const GOOGLE_BOOKS_API_KEY = Deno.env.get("GOOGLE_BOOKS_API_KEY") || "";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
}

const https = (url?: string) => (url ? url.replace(/^http:\/\//, "https://") : "");
const clean = (s: unknown) => String(s ?? "").replace(/["\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 120);

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    try {
        const body = await req.json().catch(() => ({}));
        const q = clean(body?.q);
        const author = clean(body?.author);
        const mode = body?.mode === "author" ? "author" : "title";
        if (q.length < 2) return jsonResponse({ items: [] });

        // by author: that author's books; by title: the words (plus the author when it's known)
        const query = mode === "author" ? `inauthor:"${q}"` : (author ? `${q} inauthor:"${author}"` : q);
        const params = new URLSearchParams({
            q: query,
            maxResults: "8",
            printType: "books",
            fields: "items(volumeInfo(title,subtitle,authors,pageCount,imageLinks(smallThumbnail,thumbnail),infoLink,canonicalVolumeLink))",
        });
        if (GOOGLE_BOOKS_API_KEY) params.set("key", GOOGLE_BOOKS_API_KEY);

        const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
        if (!res.ok) return jsonResponse({ items: [], unavailable: res.status });
        const data = await res.json();
        const items = (data?.items || []).map((it: any) => {
            const v = it?.volumeInfo || {};
            const images = v.imageLinks || {};
            return {
                title: String(v.title || "").trim(),
                author: Array.isArray(v.authors) ? String(v.authors[0] || "") : "",
                pages: Number(v.pageCount) > 0 ? Number(v.pageCount) : null,
                cover: https(images.thumbnail || images.smallThumbnail),
                thumb: https(images.smallThumbnail || images.thumbnail),
                link: https(v.canonicalVolumeLink || v.infoLink),
            };
        }).filter((b: any) => b.title).slice(0, 6);
        return jsonResponse({ items });
    } catch (err) {
        return jsonResponse({ items: [], error: "server_error", detail: String(err) }, 200);
    }
});
