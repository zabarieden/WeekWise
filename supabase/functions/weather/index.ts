// Supabase Edge Function: weather
//
// "Weather in the sky" on the home screen (off by default, turned on in Settings). Returns a
// simple sky state for an approximate location, so the home background can show clouds, rain,
// snow, fog or a storm. Calls MET Norway's Locationforecast 2.0 (free, also for commercial use,
// CC BY 4.0 / NLOD - credited in the privacy pages) from the server with an identifying
// User-Agent, as their terms require. The browser sends coordinates already rounded to 2
// decimals (about 1 km); nothing is stored, and MET Norway never sees the user's IP.
//
// Body: { lat, lon }  →  { sky: "clear" | "partly" | "clouds" | "rain" | "snow" | "storm" | "fog", day, symbol }
//
// Deploy: supabase functions deploy weather   (JWT verified by the gateway - logged-in users only)

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const USER_AGENT = "NOT10.ai/1.0 (+https://app.not10.ai)";

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS, ...extra },
    });
}

// MET symbol codes (e.g. "lightrainshowers_day", "partlycloudy_night", "heavysnowandthunder")
// → one of the few sky states the home screen draws
function skyFromSymbol(symbol: string): string {
    const s = symbol.replace(/_(day|night|polartwilight)$/, "");
    if (s.includes("thunder")) return "storm";
    if (s.includes("snow") || s.includes("sleet")) return "snow";
    if (s.includes("rain")) return "rain";
    if (s === "fog") return "fog";
    if (s === "cloudy") return "clouds";
    if (s === "partlycloudy" || s === "fair") return "partly";
    return "clear";
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
    try {
        const body = await req.json().catch(() => ({}));
        const lat = Number(body?.lat);
        const lon = Number(body?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            return jsonResponse({ error: "bad_location" }, 400);
        }
        // MET asks for at most 4 decimals; 2 is enough for the sky and keeps the location approximate
        const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(2)}&lon=${lon.toFixed(2)}`;
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
        if (!res.ok) return jsonResponse({ error: "upstream", status: res.status }, 502);
        const data = await res.json();
        const now = Date.now();
        const series: any[] = data?.properties?.timeseries || [];
        // the forecast hour we are in (or the first one if the list starts later)
        const step = series.find((p, i) => {
            const next = series[i + 1];
            return !next || Date.parse(next.time) > now;
        }) || series[0];
        const symbol: string = step?.data?.next_1_hours?.summary?.symbol_code || step?.data?.next_6_hours?.summary?.symbol_code || "";
        if (!symbol) return jsonResponse({ error: "no_symbol" }, 502);
        return jsonResponse(
            { sky: skyFromSymbol(symbol), day: !/_night$/.test(symbol), symbol },
            200,
            { "Cache-Control": "private, max-age=1800" },
        );
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
