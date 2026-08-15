// Supabase Edge Function: estimate-food-text
//
// Premium-only feature: real AI estimate of calories from a free-text food
// description (the quick-add 🍎 FAB), instead of the always-free local regex
// heuristic (estimateFreeTextCalories in app.js, which every user still gets
// and which this function falls back to on quota/error - see logFoodQuickAdd).
//
// Free-text descriptions are sometimes genuinely ambiguous (e.g. "iced coffee
// based on oats, quarter cup of milk" - is the oats the coffee's milk
// substitute, or a separate food?) in a way no fixed rule set can resolve.
// This function lets the AI ask ONE clarifying question instead of guessing,
// but only ever one: the follow-up call (with clarificationAnswer set) uses a
// tool schema that structurally cannot return "clarify" again, so there's no
// risk of an endless back-and-forth.
//
// Usage limit: its own dedicated monthly quota (premium_food_text_month_used/_key
// in user_ai_usage) - NOT shared with the image-scan quota, mirroring how
// parse-schedule-request also gets its own pool (text-only calls are much
// cheaper than vision calls, so they don't need to share a pool with them).
// Quota is checked/incremented only on the initial call - the forced
// follow-up resolution call doesn't cost a second unit.
//
// Deploy + configure this via the Supabase CLI - see DEPLOY.md in this folder.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY")!;
// כדאי לבדוק שהמודל הזה עדיין נתמך/מומלץ לפני הפריסה:
// https://docs.anthropic.com/en/docs/about-claude/models
const ANTHROPIC_MODEL = Deno.env.get("ANTHROPIC_MODEL") || "claude-sonnet-5";

const FOOD_TEXT_MONTHLY_LIMIT = 100;

// מטמון גלובלי (משותף לכל המשתמשות) של תוצאות "estimate" בלבד - לא clarify/
// unknown, ולא קריאות המשך אחרי הבהרה (אלה תלויות-הקשר, לא ניתנות למטמון
// לפי טקסט בלבד). תיאור מזון שכבר נשאל בעבר (זהה אחרי נירמול טריוויאלי -
// חיתוך רווחים + lowercase, לא fuzzy matching) חוזר מיידית בלי לפנות ל-AI
// או לחיפוש-רשת בכלל, ובלי לצרוך מהמכסה החודשית - לפי בקשה מפורשת "שיהיה
// מהיר יותר בלי לפגוע באיך שהוא מחשב ומחפש". תיאור חדש/שונה עדיין עובר את
// כל התהליך הרגיל בלי שום שינוי. פג-תוקף אחרי 180 יום כדי לא "לנעול" לתמיד
// הערכה של מנת-רשת שהמתכון שלה עשוי להשתנות עם הזמן
const CACHE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;

function normalizeCacheText(text: string): string {
    return text.trim().toLowerCase().replace(/\s+/g, " ");
}

// עוקף בדיקת פרימיום למפתחת בלבד - חייב להיות זהה לרשימה בצד הלקוח (app.js) וגם
// בכל שאר ה-Edge Functions, כי בדיקת לקוח בלבד ניתנת לעקיפה. שימו לב: זה עוקף
// רק את שער הפרימיום - לא את בדיקת המכסה החודשית עצמה (ר' למטה), אותו דבר
// בדיוק כמו בשאר הפונקציות
const DEV_SUPERUSER_EMAILS = ["zabarieden111@gmail.com"];

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function currentMonthKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS },
    });
}

const LANGUAGE_NAMES: Record<string, string> = { en: "English", he: "Hebrew", es: "Spanish", fr: "French", ar: "Arabic", ru: "Russian", de: "German", pt: "Portuguese", ja: "Japanese", zh: "Chinese", hi: "Hindi", ko: "Korean", tr: "Turkish", id: "Indonesian", it: "Italian", vi: "Vietnamese", pl: "Polish", th: "Thai", ur: "Urdu", bn: "Bengali", sw: "Swahili", uk: "Ukrainian", el: "Greek", nl: "Dutch", ca: "Catalan", ro: "Romanian", yo: "Yoruba" };
// המדינה שהמשתמשת בחרה בהגדרות (לא ניחוש לפי שפה) - כדי שאם ה-AI צריך להעריך
// מנת רשת בעצמו (לא נמצאה במאגר המקומי), הוא לפחות ידע על איזו גרסה-ארצית
// לחשוב (מתכון/מנה יכולים להיות שונים באמריקה מול ישראל)
const COUNTRY_NAMES: Record<string, string> = { il: "Israel", us: "the United States" };

// status "unknown" (חדש): לפי בקשה מפורשת - כשה-AI באמת לא מזהה את הפריט
// ולא בטוח בהערכה כלשהי (גם אחרי חיפוש/הבהרה), שיגיד את זה בפירוש במקום
// לנחש בביטחון מזויף. הצד שלנו (app.js) עדיין נופל להערכה המקומית במקרה
// כזה (אף פעם לא משאיר את המשתמשת בלי לרשום כלום - עיקרון קבוע באפליקציה),
// אבל מציג הודעה כנה שהמערכת לא הייתה בטוחה, כדי שהמשתמשת תדע לבדוק/לנסח
// אחרת אם היא רוצה דיוק גבוה יותר
const ESTIMATE_OR_CLARIFY_TOOL = {
    name: "estimate_or_clarify",
    description: "Give a final calorie estimate, ask one clarifying question if the description is genuinely ambiguous about what was eaten or how much, or report that you genuinely don't know. This must always be your LAST tool call - after any web searches, call this one to actually report the result.",
    input_schema: {
        type: "object",
        properties: {
            status: { type: "string", enum: ["estimate", "clarify", "unknown"] },
            calories: { type: "integer", description: "Total estimated calories. Required when status is 'estimate'." },
            question: { type: "string", description: "A short clarifying question, in the user's language. Required when status is 'clarify'." },
        },
        required: ["status"],
    },
};

// זהה לכלי למעלה, אבל בלי "clarify" באפשרויות בכלל - נועד לשיחת ההמשך אחרי
// שהמשתמשת כבר ענתה על שאלת ההבהרה, כדי שלא יהיה סבב שני של שאלות. זו אכיפה
// מבנית (הכלי עצמו לא מאפשר את זה), לא רק הנחיה במילים שה-AI יכול "לשכוח".
// "unknown" עדיין נשאר אפשרי כאן - גם אחרי תשובת הבהרה יכול להתברר שעדיין
// אין מספיק מידע לזהות את הפריט בביטחון
const ESTIMATE_ONLY_TOOL = {
    name: "estimate_or_clarify",
    description: "Give a final calorie estimate using the original description plus the clarifying answer given, or report that you genuinely don't know. This must always be your LAST tool call - after any web searches, call this one to actually report the result.",
    input_schema: {
        type: "object",
        properties: {
            status: { type: "string", enum: ["estimate", "unknown"] },
            calories: { type: "integer", description: "Total estimated calories. Required when status is 'estimate'." },
        },
        required: ["status"],
    },
};

// כלי חיפוש בשרת (server-side) - רץ על תשתית Anthropic, לא דורש כלום מאיתנו
// חוץ מלהצהיר עליו. משמש רק כשהתיאור מזכיר רשת/מותג ספציפי (ר' searchNote
// למטה) - כדי שמידע תזונתי על מנות רשת יהיה מבוסס על נתונים אמיתיים ועדכניים
// במקום על ידע מהאימון של המודל בלבד, שיכול להיות לא מדויק או לא ספציפי
// למדינה. max_uses מגביל את מספר החיפושים בקריאה אחת כדי לשמור על עלות/זמן
// תגובה סבירים לפיצ'ר "הוספה מהירה"
const WEB_SEARCH_TOOL = { type: "web_search_20260209", name: "web_search", max_uses: 3 };

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS_HEADERS });
    if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

    try {
        const authHeader = req.headers.get("Authorization") || "";
        const jwt = authHeader.replace("Bearer ", "");
        const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
        if (userError || !userData?.user) return jsonResponse({ error: "unauthorized" }, 401);
        const userEmail = (userData.user.email || "").toLowerCase();
        const userId = userData.user.id;

        const { data: premiumRow } = await supabase
            .from("user_premium")
            .select("is_premium")
            .eq("user_id", userId)
            .maybeSingle();
        const isPremium = DEV_SUPERUSER_EMAILS.includes(userEmail) || !!premiumRow?.is_premium;
        if (!isPremium) return jsonResponse({ error: "premium_required" }, 402);

        const body = await req.json();
        const { text, clarificationQuestion, clarificationAnswer, isLocalClarify, language, country } = body;
        if (!text || !String(text).trim()) return jsonResponse({ error: "missing_text" }, 400);
        const hasAnswer = !!(clarificationQuestion && clarificationAnswer);
        // שני סוגי "יש תשובה לשאלת הבהרה": מה-AI (שכבר שאל וכבר חויב על זה -
        // הקריאה הזו היא קריאת המשך חינמית), או שהשאלה זוהתה מקומית בקוד
        // הלקוח בלי לפנות ל-AI כלל (ר' detectAmbiguousPlantMilk באפליקציה) -
        // במקרה הזה זו עדיין הקריאה הראשונה שמחייבת מכסה, לא קריאת המשך.
        // בשני המקרים כופים על ה-AI לתת מספר סופי בלבד (בלי עוד שאלה)
        const hasAiFollowUp = hasAnswer && !isLocalClarify;
        const useEstimateOnlyTool = hasAnswer;
        const shouldIncrementQuota = !hasAiFollowUp;

        // בדיקת מטמון - רק על הקריאה הראשונה (לא קריאת-הבהרה, שתלוית-הקשר),
        // ולפני בדיקת המכסה בכוונה: פגיעה במטמון לא אמורה לעלות למשתמשת כלום,
        // גם אם המכסה החודשית שלה כבר נגמרה
        if (!hasAnswer) {
            const cacheKey = `${language}|${country}|${normalizeCacheText(String(text))}`;
            const { data: cacheRow } = await supabase
                .from("food_text_cache")
                .select("calories, created_at")
                .eq("cache_key", cacheKey)
                .maybeSingle();
            if (cacheRow && Date.now() - new Date(cacheRow.created_at).getTime() < CACHE_MAX_AGE_MS) {
                return jsonResponse({ ok: true, status: "estimate", calories: cacheRow.calories, cached: true });
            }
        }

        const { data: usageRow } = await supabase
            .from("user_ai_usage")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();
        const monthKey = currentMonthKey();
        const foodTextMonthUsed = usageRow?.premium_food_text_month_key === monthKey
            ? (usageRow?.premium_food_text_month_used || 0)
            : 0;
        // המכסה נבדקת תמיד (גם בשיחת ההמשך) כדי לא לאפשר קריאה בלי שער בכלל,
        // אבל רק הקריאה הראשונה (לא שיחת ההמשך) *מגדילה* את המונה - ר' הערה
        // בראש הקובץ. אם המכסה כבר נגמרה, גם שיחת המשך לא תעבור (לא אמור
        // לקרות בפועל - הלקוח לא פותח שיחת המשך בלי שהקריאה הראשונה הצליחה)
        if (foodTextMonthUsed >= FOOD_TEXT_MONTHLY_LIMIT) {
            return jsonResponse({ error: "limit_reached", scope: "premium_monthly", used: foodTextMonthUsed, limit: FOOD_TEXT_MONTHLY_LIMIT }, 402);
        }

        const languageName = LANGUAGE_NAMES[language] || "English";
        const countryName = COUNTRY_NAMES[country] || "Israel";
        const countryNote = `If this describes a dish from a specific chain restaurant or brand, use the version/recipe/portion size typical for that chain in ${countryName}, since the same chain's dish can differ meaningfully by country.`;
        // הנחיה חוזרת בשתי הקריאות: לפי בקשה מפורשת נוספת - גם כשהמשתמשת כבר
        // ציינה כמות (כמו "רבע כוס"), זה עדיין לא אומר שה-AI יודע אם זו כמות
        // של חלב/תחליף-חלב או של מזון מוצק נפרד - אז זו נשארת שאלת הבהרה
        // *חובה* (לא רק "אם זה נראה מעורפל"), כדי לא לנחש ולפספס כמו קודם
        // (120 קלוריות שיצאו במקום כ-70 לפי גוגל, בלי שהוא שאל בכלל)
        // "התייחס לזה כתפקיד הקטן" (השורה השנייה למטה) הייתה בעבר הנחיה גורפת
        // ("More generally...") שדחפה כלפי מטה גם במקרים בלי שום עמימות בכלל
        // (למשל "4 יחידות בייגלה" - כמות ברורה) - זה עצמו הפך להטיה שיטתית
        // (206 מול טווח 206-220, 20 מול 22) שמצטברת משמעותית לאורך יום שלם
        // של רישום, לפי בקשה מפורשת. צומצם עכשיו לדייק *רק* על העמימות
        // המקורית (חלב-בתוך-משקה מול מזון-מוצק-נפרד) שבשבילה זה נכתב, ונוספה
        // הנחיה נגד הטיה לכל כיוון כשאין עמימות
        const realismNote = "If an ingredient like oats, almonds, soy, or milk is mentioned alongside a drink (coffee, smoothie, etc.) - even if a quantity like \"a quarter cup\" is already given - you STILL don't know if that quantity is milk/a milk-substitute mixed into the drink versus a separate solid-food serving. Do not silently guess one or the other, and do not treat this as merely optional extra precision - always ask that clarifying question directly (e.g. confirm \"a quarter cup of milk?\" in the user's language) before estimating. Use the correct native/established food terminology in that language (e.g. in Hebrew, oat-milk is \"חלב שיבולת שועל\") - do NOT phonetically transliterate the English term into the other language's alphabet. When a fraction or quantity word is given (quarter, half, a tablespoon, etc.), apply it precisely and literally to your calculation - do not round it up to a full/larger serving or ignore it. This \"treat it as the smaller role, not the large standalone portion\" caution applies ONLY when it's genuinely unclear whether something is an ingredient inside another item versus a separate serving on its own, as above - it is NOT a general instruction to round every estimate down or play it safe. When the food's identity and quantity are already clear and unambiguous (an exact count of units, a stated weight, a specific named product), give your single most accurate estimate - aim for the realistic center of the known range for that food, not systematically the low end or the high end. Being consistently a little low is exactly as wrong as being consistently a little high, and small systematic errors compound significantly across a full day of logged meals.";
        // הנחיה חדשה: "ביס" בהקשר לחם/פיתה הוא שם-מוצר אמיתי ממאפייה (למשל
        // "פיתת ביס"/"פיתה ביס" - פיתה קטנה בגודל נשנוש), לא המילה "נגיסה".
        // בלי ההנחיה הזו ה-AI עלול לפרש "פיתה ביס" כ"ביס אחד מפיתה" (כמות
        // זעירה) ולתת הערכה נמוכה משמעותית ממה שבאמת נאכל - נוסף אחרי בקשה
        // מפורשת בעקבות פער שהתגלה בפועל (365 מול כ-610 בגוגל, כשהתיאור
        // כלל "פיתה ביס כוסמין")
        const breadTermNote = `In Hebrew, the word "ביס" attached to a bread/pita name (e.g. "פיתת ביס", "פיתה ביס", "לחם ביס") is a real bakery product name for a specific smaller/snack-size bread item - it does NOT mean "a bite" or "a nibble" taken out of a regular-size bread. Treat it as one whole small bread item at its typical product size and calorie count (use web_search if you're unsure of the exact size/calories for ${countryName}), not as a tiny fraction of a larger item.`;
        // הנחיה חדשה שנייה: כשתיאור המנה כולל כמה רכיבים שכל אחד מהם בנפרד
        // עמום באופן-הכנה (לא רק בכמות) - כמו תפוח אדמה (מבושל/מאודה לעומת
        // אפוי/מטוגן בשמן) או יוגורט (רזה/דיאטטי לעומת רגיל/מתוק) - ה-AI נטה
        // להניח את אופן-ההכנה הכי דל-קלוריות בכל רכיב כזה בנפרד, וזה מצטבר
        // לפער גדול על פני הארוחה כולה (נבדק בפועל: "200 גרם תפוח אדמה" +
        // "יוגורט גביע 150 גרם" בלי לציין אופן הכנה/סוג, יחד עם הפריט הקודם -
        // תוצאה שנשארה נמוכה משמעותית גם אחרי התיקון על "ביס" בלבד). זו
        // הרחבה של realismNote (שם העמימות הייתה "ingredient בתוך drink") -
        // כאן העמימות היא "שיטת-הכנה" של פריט עצמאי, לא תפקידו בתוך פריט אחר
        const prepMethodNote = `When a food's preparation method or type isn't stated but meaningfully changes its calories (e.g. potato: boiled/steamed vs. roasted/fried with oil; yogurt: plain/low-fat vs. regular/sweetened; rice: plain vs. cooked with oil), do NOT default to the leanest/lowest-calorie version - use the preparation that's actually most common as a home-cooked side dish or everyday product in ${countryName} (e.g. oven-roasted potato wedges with some oil, not steamed plain potato; regular 3% yogurt, not diet 0%, unless the description implies otherwise). This matters most when a meal description lists several such unspecified items together - defaulting to the leanest assumption on each one individually compounds into a large, consistent underestimate for the whole meal, which is exactly the systematic bias this feature must avoid.`;
        // מנחה שימוש ב-web_search כשיש שם מקום/רשת/מותג במשפט - לא לכל תיאור
        // מזון (זה היה מבזבז זמן ועלות על "תפוח" או "אורז לבן"). תוקן אחרי
        // בדיקה בפועל: הניסוח הקודם (רק "רשת ידועה" עם דוגמאות מקדונלד'ס/
        // דומינו'ס) גרם למודל לפספס רשתות ישראליות מקומיות ופחות מוכרות
        // עולמית (למשל "בית הפנקייק" - נשמע כמו תיאור גנרי, לא כמו שם מותג,
        // אז ההנחיה לא הופעלה וזה חזר להערכה גסה מהזיכרון - 750 קלוריות
        // בפועל מול טווח מתועד של 300-450). הניסוח החדש לא מסתמך על שיפוט
        // המודל לגבי "האם זו רשת מוכרת מספיק" - מפעיל חיפוש על כל שם עסק/
        // מקום נקוב, מוכר או לא. הכלי עצמו רץ בצד השרת של Anthropic - אין
        // כאן שום לוגיקה נוספת מהצד שלנו, רק הצהרה עליו ב-tools (ר'
        // WEB_SEARCH_TOOL למעלה)
        const searchNote = `If this description names any specific restaurant, cafe, chain, or branded food business - international (e.g. "מקדונלד'ס", "Domino's") OR local/small (e.g. "בית הפנקייק", "קפה קפית", any Israeli chain or independent restaurant you don't instantly recognize) - use the web_search tool first to find that place's actual current nutrition info for ${countryName} before estimating. Do NOT skip the search just because the name sounds generic or unfamiliar to you, or because you're not fully sure it's a real chain - a name that reads like a plain description (e.g. a Hebrew name that literally translates to "the pancake house") can still be a specific real business with its own menu and calorie counts; when in doubt, search rather than guess. Only skip the search for genuinely generic home-cooked or unbranded food with no place name at all (e.g. "an apple", "white rice").`;
        // status "unknown" (חדש) - לפי בקשה מפורשת: אם ה-AI באמת לא מזהה את
        // הפריט/המקום ולא הצליח למצוא מידע רלוונטי גם אחרי חיפוש, שיגיד את
        // זה בפירוש במקום להמציא מספר. חשוב: זה נדיר ומכוון - לא תירוץ
        // לוותר בקלות. הצד שלנו עדיין נופל להערכה מקומית במקרה כזה (ר'
        // handling ב-app.js), רק עם הודעה כנה למשתמשת
        const unknownNote = `If, even after a web search when relevant, you genuinely cannot identify this food/place at all or have no reasonable basis for any calorie estimate (e.g. a completely unfamiliar name with no search results and no similar known food to reason from) - use status "unknown" instead of inventing a number. This should be rare: a vague or unfamiliar-sounding description is USUALLY still estimable (e.g. from ingredients, food type, or similar known dishes) and does not by itself justify "unknown" - reserve it for cases where you truly have nothing to go on.`;
        // הנחיה חדשה שלישית: כפיית "חשיבה בקול" - פירוק לרכיבים בטקסט חופשי
        // *לפני* קריאת הכלי (לא בתוך input הכלי עצמו) - נוסף אחרי שגם breadTermNote
        // וגם prepMethodNote לא הזיזו כמעט כלום בפועל למנה מרובת-רכיבים אמיתית
        // (356-367 קלוריות מה-AI מול 650-710 בגוגל, גם אחרי שני התיקונים
        // הקודמים). ההשערה: הערכה הוליסטית-אינטואיטיבית של מנה שלמה נוטה
        // להטיה-כלפי-מטה חזקה יותר מסכימת קלוריות מפורשת פריט-אחר-פריט -
        // לפי בקשה מפורשת "חייב לתקן"
        const breakdownNote = `Before calling the tool, think step by step in plain text (not inside the tool call): list every distinct food item in the description separately, and for each one write your best calorie estimate for the stated (or inferred, per the notes above) quantity. Then explicitly add these numbers together and state the sum. Only after that, call the tool with that summed total as "calories". Do not skip straight to a single holistic guess for the whole meal - a multi-item meal estimated item-by-item and then summed is measurably more accurate than one intuitive total, and this step is required even when it feels obvious.`;
        const promptText = hasAnswer
            ? `The user described a food/meal: "${text}". You previously asked: "${clarificationQuestion}". Their answer: "${clarificationAnswer}". ${realismNote} ${breadTermNote} ${prepMethodNote} ${countryNote} ${searchNote} ${unknownNote} ${breakdownNote} Using all of this, give your best final total calorie estimate now. Respond in ${languageName} if the question needed a language, but the tool call itself just needs the number. End by calling the estimate_or_clarify tool with the result.`
            : `Estimate the total calories for this food/meal description, written by the user in ${languageName}: "${text}". ${realismNote} ${breadTermNote} ${prepMethodNote} ${countryNote} ${searchNote} ${unknownNote} ${breakdownNote} If the description is genuinely ambiguous about what was eaten or the quantity (not just imprecise - genuinely unclear), ask ONE short clarifying question in ${languageName} instead of guessing. Otherwise give your best total calorie estimate. End by calling the estimate_or_clarify tool with the result.`;

        const estimateTool = useEstimateOnlyTool ? ESTIMATE_ONLY_TOOL : ESTIMATE_OR_CLARIFY_TOOL;
        const messages: any[] = [{ role: "user", content: promptText }];
        let anthropicJson: any = null;
        // עד 3 סבבי "המשך" אם המודל נעצר עם pause_turn (מגבלת ברירת המחדל של
        // 10 סבבי כלי-שרת בקריאה אחת - עם max_uses:3 על החיפוש כמעט ולא
        // אמור לקרות, אבל זו הדרך התקנית להתמודד איתו אם כן)
        for (let attempt = 0; attempt < 4; attempt++) {
            const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: {
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    model: ANTHROPIC_MODEL,
                    max_tokens: 1500,
                    messages,
                    tools: [WEB_SEARCH_TOOL, estimateTool],
                    // לא ניתן לכפות tool_choice על "estimate_or_clarify" בלבד כאן
                    // כי אז המודל לא יוכל להשתמש ב-web_search קודם - ההנחיה
                    // ל"תמיד לסיים בקריאה לכלי" נמצאת בפרומפט ובתיאור הכלי עצמו
                }),
            });

            if (!anthropicRes.ok) {
                const errText = await anthropicRes.text();
                return jsonResponse({ error: "ai_provider_error", detail: errText }, 502);
            }

            anthropicJson = await anthropicRes.json();
            if (anthropicJson.stop_reason !== "pause_turn") break;
            messages.push({ role: "assistant", content: anthropicJson.content });
        }

        const toolUseBlock = (anthropicJson?.content || []).find((b: any) => b.type === "tool_use" && b.name === "estimate_or_clarify");
        if (!toolUseBlock) return jsonResponse({ error: "no_extraction" }, 502);
        const result = toolUseBlock.input || {};

        // המכסה עולה רק בקריאה הראשונה בפועל (כולל שיחת-הבהרה מקומית שלא
        // עברה דרך ה-AI קודם) - ר' חישוב shouldIncrementQuota למעלה
        if (shouldIncrementQuota) {
            await supabase.from("user_ai_usage").upsert(
                { user_id: userId, username: userData.user.email, premium_food_text_month_key: monthKey, premium_food_text_month_used: foodTextMonthUsed + 1 },
                { onConflict: "user_id" },
            );
        }

        if (result.status === "clarify" && result.question) {
            return jsonResponse({ ok: true, status: "clarify", question: result.question });
        }
        if (typeof result.calories === "number") {
            const calories = Math.round(result.calories);
            // שומרים במטמון רק תוצאות מהקריאה הראשונה הרגילה (לא קריאת-הבהרה,
            // שתלוית-תשובה ולא ניתנת למטמון לפי הטקסט המקורי בלבד) - ר' בדיקת
            // המטמון למעלה. upsert כדי לרענן גם תיאור שכבר קיים אך פג-תוקף
            if (!hasAnswer) {
                const cacheKey = `${language}|${country}|${normalizeCacheText(String(text))}`;
                await supabase.from("food_text_cache").upsert(
                    { cache_key: cacheKey, calories, created_at: new Date().toISOString() },
                    { onConflict: "cache_key" },
                );
            }
            return jsonResponse({ ok: true, status: "estimate", calories });
        }
        // status "unknown" - ר' unknownNote למעלה. הצד שלנו (app.js) עדיין
        // נופל להערכה מקומית במקרה כזה, רק עם הודעה כנה שהמערכת לא הייתה
        // בטוחה - לא משאיר את המשתמשת בלי לרשום כלום
        if (result.status === "unknown") {
            return jsonResponse({ ok: true, status: "unknown" });
        }
        return jsonResponse({ error: "no_extraction" }, 502);
    } catch (err) {
        return jsonResponse({ error: "server_error", detail: String(err) }, 500);
    }
});
