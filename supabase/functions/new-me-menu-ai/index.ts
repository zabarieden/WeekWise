// Supabase Edge Function: new-me-menu-ai
//
// Builds a personal New Me menu (her request, 2026-10-13: "לשנות את האפשרויות בnew me עם ai"): the
// questionnaire asks which meals the user eats and when, food preferences and how they drink coffee or
// tea, and this function returns 3 options for every meal - each sized to that meal's share of the day
// (the app computes the targets, so the day still adds up to exactly 1,300 / 1,500) - plus up to 4
// drinks that fit their coffee/tea habit. The app stores the options as the user's own meals
// (new_me_custom_meals, source 'ai_menu'); the original menu options stay available next to them.
//
// Access: New Me buyers (user_premium.new_me_purchased) or the dev superuser. Each build counts as one
// of the daily New Me AI calls (new_me_meal_day_key/_used in user_ai_usage, shared with new-me-meal-kcal).
//
// Deploy: supabase functions deploy new-me-menu-ai

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";
const DAILY_LIMIT = 40;
const DEV_SUPERUSER_EMAILS = ["zabarieden111@gmail.com"];
const SLOTS = ["meal1", "meal2", "snack1", "snack2"];
const ROLES: Record<string, string> = { meal1: "breakfast (a full meal)", meal2: "lunch (a full meal)", snack1: "a small snack between meals", snack2: "a light dinner (small)" };
const LANGUAGES: Record<string, string> = {
    he: "Hebrew", en: "English", es: "Spanish", fr: "French", ar: "Arabic", ru: "Russian", de: "German", pt: "Portuguese (Brazil)",
    ja: "Japanese", zh: "Simplified Chinese", hi: "Hindi", ko: "Korean", tr: "Turkish", id: "Indonesian", it: "Italian", vi: "Vietnamese",
    pl: "Polish", th: "Thai", ur: "Urdu", bn: "Bengali", sw: "Swahili", uk: "Ukrainian", el: "Greek", nl: "Dutch", ca: "Catalan",
    ro: "Romanian", yo: "Yoruba", sv: "Swedish", nb: "Norwegian Bokmål", da: "Danish", cs: "Czech", hu: "Hungarian", fi: "Finnish",
};
const PREFS: Record<string, string> = {
    vegetarian: "vegetarian (no meat, no chicken, no fish)",
    vegan: "vegan (no animal products at all)",
    kosher: "kosher (no pork or shellfish, and never meat and dairy in the same meal)",
    no_dairy: "no dairy / lactose",
    gluten_free: "gluten-free",
    no_fish: "no fish",
    no_eggs: "no eggs",
    no_nuts: "no nuts or peanuts",
};
const STYLES: Record<string, string> = { black: "black", milk: "with milk", plant_milk: "with plant milk", sugar: "with sugar", sweetener: "with sweetener" };

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
}
const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    try {
        const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userId = userData.user.id;
        const userEmail = (userData.user.email || "").toLowerCase();

        const { data: premiumRow } = await supabase.from("user_premium").select("new_me_purchased").eq("user_id", userId).maybeSingle();
        if (!DEV_SUPERUSER_EMAILS.includes(userEmail) && !premiumRow?.new_me_purchased) {
            return jsonResponse({ error: "not_purchased" }, 403);
        }

        const dayKey = new Date().toISOString().slice(0, 10);
        const { data: usageRow } = await supabase.from("user_ai_usage").select("new_me_meal_day_key, new_me_meal_day_used").eq("user_id", userId).maybeSingle();
        const usedToday = usageRow?.new_me_meal_day_key === dayKey ? (usageRow?.new_me_meal_day_used || 0) : 0;
        if (usedToday >= DAILY_LIMIT) return jsonResponse({ error: "limit_reached", limit: DAILY_LIMIT }, 402);

        const body = await req.json().catch(() => ({}));
        const language = clean(body?.language || "en", 5);
        const languageName = LANGUAGES[language] || "English";
        const plan = Number(body?.plan) === 1500 ? 1500 : 1300;
        const slots = (Array.isArray(body?.slots) ? body.slots : [])
            .filter((s: any) => SLOTS.includes(s?.slot))
            .map((s: any) => ({
                slot: String(s.slot),
                time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s.time || "")) ? String(s.time) : "",
                kcal: Math.max(60, Math.min(1000, Math.round(Number(s.kcal) || 0))),
            }))
            .filter((s: any, i: number, all: any[]) => all.findIndex((x: any) => x.slot === s.slot) === i);
        if (slots.length < 2) return jsonResponse({ error: "missing_slots" }, 400);
        const prefs = (Array.isArray(body?.prefs) ? body.prefs : []).map(String).filter((p: string) => PREFS[p]);
        const prefsOther = clean(body?.prefs_other, 200);
        const cups = Math.max(0, Math.min(8, Math.round(Number(body?.drinks?.cups) || 0)));
        const styles = (Array.isArray(body?.drinks?.style) ? body.drinks.style : []).map(String).filter((s: string) => STYLES[s]);
        const drinkOther = clean(body?.drinks?.other, 120);
        const late = ["eat", "drink", "none"].includes(body?.late) ? body.late : "none";
        const lateTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(body?.late_time || "")) ? String(body.late_time) : "21:00";
        const avoid = (Array.isArray(body?.avoid) ? body.avoid : []).map((a: unknown) => clean(a, 60)).filter(Boolean).slice(0, 24);

        const mealLines = slots.map((s: any) => `- ${s.slot}: ${ROLES[s.slot]}${s.time ? ` at ${s.time}` : ""}, about ${s.kcal} kcal`).join("\n");
        const prefLine = [...prefs.map((p: string) => PREFS[p]), prefsOther ? `also avoid: ${prefsOther}` : ""].filter(Boolean).join("; ");
        const drinkLine = cups
            ? `${cups} cup(s) of coffee or tea a day${styles.length ? `, ${styles.map((s: string) => STYLES[s]).join(", ")}` : ""}${drinkOther ? ` (${drinkOther})` : ""}`
            : (drinkOther ? `no regular coffee or tea (${drinkOther})` : "no regular coffee or tea - suggest water-based drinks");
        const lateLine = late === "eat"
            ? `They also eat something small (about 100 kcal) at ${lateTime}; that is planned separately, do not include it.`
            : late === "drink" ? `They have only a drink at ${lateTime}.` : "";

        const prompt =
            `You are a registered dietitian writing a personal menu template for a weight-loss program of ${plan} kcal a day in total ` +
            `(about 150 kcal of that is for coffee, tea and other drinks). The meals are:\n${mealLines}\n` +
            (lateLine ? lateLine + "\n" : "") +
            `For EACH meal above, write exactly 3 different options of realistic, everyday home food that is simple to prepare and suits the time of day and the role of the meal. ` +
            "List every option's components, each with its exact portion (for example \"2 eggs\", \"60 g pita\", \"1 tsp olive oil\") and that component's calories from standard nutrition values. " +
            "Choose the PORTIONS so the components add up to the meal's calories (within plus or minus 8%) - change the portions, never the calorie numbers, and every component's calories must be honest for its portion. " +
            "Snacks and a light dinner are small and simple. Vary the protein sources and styles between the options. " +
            "Unless an option is clearly a fried dish, it is NOT fried: oven-baked, grilled, boiled or cooked with at most 1 teaspoon of oil - say the oil amount. " +
            `Write every name (at most 5 words) and every component in ${languageName}, phrased the way a native speaker writes, ` +
            `using foods that are easy to buy where ${languageName} is spoken` + (language === "he" ? " (Israel: for example cottage cheese 5%, white cheese 5%, pita, tahini, hummus, shakshuka, Israeli salad)" : "") + ". " +
            (language === "he" ? "In Hebrew never address the reader with gendered verbs - only list the foods. " : "") +
            (prefLine ? `Respect these food rules strictly in every option: ${prefLine}. ` : "") +
            (avoid.length ? `Do not repeat these dishes, offer different ones: ${avoid.join(" | ")}. ` : "") +
            `Also suggest 3 or 4 drinks for this habit: ${drinkLine}. Give each drink's calories per cup; all the day's drinks together should fit in about 150 kcal. ` +
            `Drink names are short (at most 5 words) and in ${languageName}. Answer with the build_menu tool only.`;

        const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: ANTHROPIC_MODEL,
                max_tokens: 3500,
                messages: [{ role: "user", content: prompt }],
                tools: [{
                    name: "build_menu",
                    description: "A personal menu: 3 options for every requested meal, plus drinks.",
                    input_schema: {
                        type: "object",
                        properties: {
                            meals: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        slot: { type: "string", enum: SLOTS },
                                        options: {
                                            type: "array",
                                            items: {
                                                type: "object",
                                                properties: {
                                                    name: { type: "string", description: "Short name of the dish" },
                                                    components: {
                                                        type: "array",
                                                        description: "Every food in the option with its exact portion, and that portion's calories",
                                                        items: {
                                                            type: "object",
                                                            properties: {
                                                                item: { type: "string", description: "Food with its portion, e.g. \"2 eggs\" or \"60 g pita\"" },
                                                                kcal: { type: "integer", description: "Calories of exactly this portion" },
                                                            },
                                                            required: ["item", "kcal"],
                                                        },
                                                    },
                                                    protein_g: { type: "number", description: "Protein grams of the whole option" },
                                                },
                                                required: ["name", "components", "protein_g"],
                                            },
                                        },
                                    },
                                    required: ["slot", "options"],
                                },
                            },
                            drinks: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: { name: { type: "string" }, kcal: { type: "integer" } },
                                    required: ["name", "kcal"],
                                },
                            },
                        },
                        required: ["meals", "drinks"],
                    },
                }],
                tool_choice: { type: "tool", name: "build_menu" },
            }),
        });
        if (!anthropicRes.ok) return jsonResponse({ error: "ai_provider_error", detail: await anthropicRes.text() }, 502);
        const anthropicJson = await anthropicRes.json();
        const tool = (anthropicJson.content || []).find((b: any) => b.type === "tool_use");
        if (!tool) return jsonResponse({ error: "no_menu" }, 502);

        // the option's calories are the sum of its components (honest per portion); only options close to the
        // meal's share are kept - the app balances the small remainder
        const meals: Record<string, { name: string; description: string; kcal: number; protein_g: number }[]> = {};
        for (const s of slots) {
            const block = (tool.input?.meals || []).find((m: any) => m?.slot === s.slot);
            meals[s.slot] = (block?.options || [])
                .map((o: any) => {
                    const parts = (Array.isArray(o?.components) ? o.components : [])
                        .map((c: any) => ({ item: clean(c?.item, 80), kcal: Math.max(0, Math.round(Number(c?.kcal) || 0)) }))
                        .filter((c: any) => c.item);
                    return {
                        name: clean(o?.name, 80),
                        description: clean(parts.map((c: any) => c.item).join(", "), 400),
                        kcal: parts.reduce((a: number, c: any) => a + c.kcal, 0),
                        protein_g: Math.max(0, Math.min(150, Math.round((Number(o?.protein_g) || 0) * 10) / 10)),
                    };
                })
                .filter((o: any) => o.name && o.kcal >= s.kcal * 0.7 && o.kcal <= s.kcal * 1.3)
                .slice(0, 3);
            if (!meals[s.slot].length) return jsonResponse({ error: "bad_menu", slot: s.slot }, 502);
        }
        const drinks = (tool.input?.drinks || [])
            .map((d: any) => ({ name: clean(d?.name, 60), kcal: Math.round(Number(d?.kcal) || 0) }))
            .filter((d: any) => d.name && d.kcal >= 0 && d.kcal <= 200)
            .slice(0, 4);

        await supabase.from("user_ai_usage").upsert(
            { user_id: userId, username: userData.user.email, new_me_meal_day_key: dayKey, new_me_meal_day_used: usedToday + 1 },
            { onConflict: "user_id" },
        );
        return jsonResponse({ ok: true, meals, drinks });
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
