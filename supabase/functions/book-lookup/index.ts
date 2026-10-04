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

        // Plain-text search only: Google's intitle:/inauthor: filters currently return nothing on
        // their own (and nothing for Hebrew or quoted names). So: the typed words (plus the author
        // when known), 20 candidates, then keep only books that really match - the title for a
        // name search, the author for an author search. Better no Google result than unrelated ones
        const query = mode === "author" ? q : (author ? `${q} ${author}` : q);
        const params = new URLSearchParams({
            q: query,
            maxResults: "20",
            printType: "books",
            fields: "items(volumeInfo(title,subtitle,authors,pageCount,imageLinks(smallThumbnail,thumbnail),infoLink,canonicalVolumeLink))",
        });
        if (GOOGLE_BOOKS_API_KEY) params.set("key", GOOGLE_BOOKS_API_KEY);

        // Results depend on the country Google guesses from the server's IP (this function runs
        // in Europe, where Google Books often answers 503 or leaves out Hebrew editions) - so the
        // country is set: Israel for Hebrew, otherwise US; one retry with the other on failure
        const countries = /[֐-׿]/.test(query) ? ["IL", "US"] : ["US", "IL"];
        let data: any = null;
        let lastStatus = 0;
        for (const country of countries) {
            params.set("country", country);
            const res = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`);
            if (res.ok) { data = await res.json(); break; }
            lastStatus = res.status;
        }
        if (!data) return jsonResponse({ items: [], unavailable: lastStatus });
        const norm = (s: string) => s.toLowerCase().replace(/[֑-ׇ]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
        const words = (s: string) => norm(s).split(" ").filter(Boolean);
        const hasAll = (text: string, s: string) => { const t = ` ${norm(text)} `; return words(s).every((w) => t.includes(` ${w} `) || t.includes(` ${w}`)); };
        const scored = (data?.items || []).map((it: any) => {
            const v = it?.volumeInfo || {};
            const images = v.imageLinks || {};
            const book = {
                title: String(v.title || "").trim(),
                author: Array.isArray(v.authors) ? String(v.authors[0] || "") : "",
                pages: Number(v.pageCount) > 0 ? Number(v.pageCount) : null,
                cover: https(images.thumbnail || images.smallThumbnail),
                thumb: https(images.smallThumbnail || images.thumbnail),
                link: https(v.canonicalVolumeLink || v.infoLink),
            };
            const allAuthors = Array.isArray(v.authors) ? v.authors.join(" ") : "";
            let score = 0;
            if (mode === "author") {
                if (hasAll(allAuthors, q)) score = 3;
            } else if (hasAll(book.title, q)) {
                score = 3 + (norm(book.title).startsWith(norm(q)) ? 1 : 0) + (author && hasAll(allAuthors, author) ? 3 : 0);
            }
            if (score && book.cover) score += 0.5;
            return { book, score };
        }).filter((x: any) => x.book.title && x.score > 0);
        scored.sort((a: any, b: any) => b.score - a.score);
        return jsonResponse({ items: scored.slice(0, 6).map((x: any) => x.book) });
    } catch (err) {
        return jsonResponse({ items: [], error: "server_error", detail: String(err) }, 200);
    }
});
