// 🎉 מה לקנות לחג (2026-10-20, לפי בחירה מפורשת: "רשימה מוכנה לכל חג" + "לפי המדינה"). החגים של המדינה שנבחרה
// בהגדרות (getUserCountry), התאריכים מחושבים לבד מהלוחות המובנים בדפדפן (עברי, הג'רי, סיני) ומפסחא/תאריכים קבועים,
// כך שהם נכונים כל שנה. לכל חג - רשימה מוכנה של מה קונים; עברית ואנגלית כאן, שאר השפות ב-shop-holidays/<lang>.js
const SHOP_HOLIDAY_RULES = {
    rosh_hashana: { cal: 'hebrew', m: ['Tishri'], d: 1 },
    yom_kippur: { cal: 'hebrew', m: ['Tishri'], d: 10 },
    sukkot: { cal: 'hebrew', m: ['Tishri'], d: 15 },
    hanukkah: { cal: 'hebrew', m: ['Kislev'], d: 25 },
    tu_bishvat: { cal: 'hebrew', m: ['Shevat'], d: 15 },
    purim: { cal: 'hebrew', m: ['Adar', 'Adar II'], d: 14 },
    pesach: { cal: 'hebrew', m: ['Nisan'], d: 15 },
    shavuot: { cal: 'hebrew', m: ['Sivan'], d: 6 },
    ramadan: { cal: 'islamic-umalqura', m: ['9'], d: 1 },
    eid_fitr: { cal: 'islamic-umalqura', m: ['10'], d: 1 },
    eid_adha: { cal: 'islamic-umalqura', m: ['12'], d: 10 },
    lny_cn: { cal: 'chinese', m: ['1'], d: 1 },
    seollal: { cal: 'chinese', m: ['1'], d: 1 },
    tet: { cal: 'chinese', m: ['1'], d: 1 },
    mid_autumn: { cal: 'chinese', m: ['8'], d: 15 },
    chuseok: { cal: 'chinese', m: ['8'], d: 15 },
    christmas: { fixed: '12-25' },
    easter: { easter: 'west' },
    new_year: { fixed: '12-31' },
    thanksgiving: { nth: { month: 11, weekday: 4, n: 4 } },
    oshogatsu: { fixed: '01-01' },
    songkran: { fixed: '04-13' },
    // ההודית: לוח ירחי שאין בדפדפן - התאריכים מראש
    diwali: { dates: ['2026-11-08', '2027-10-29', '2028-10-17', '2029-11-05', '2030-10-26', '2031-11-14', '2032-11-02'] },
};
// אילו חגים בכל מדינה; יוצאי דופן: חג המולד ב-7.1 ופסחא האורתודוקסית, חג ההודיה הקנדי
const SHOP_HOLIDAY_SETS = {
    jewish: ['rosh_hashana', 'yom_kippur', 'sukkot', 'hanukkah', 'tu_bishvat', 'purim', 'pesach', 'shavuot'],
    muslim: ['ramadan', 'eid_fitr', 'eid_adha'],
    west: ['christmas', 'easter', 'new_year'],
};
const SHOP_HOLIDAY_BY_COUNTRY = {
    il: SHOP_HOLIDAY_SETS.jewish,
    us: [...SHOP_HOLIDAY_SETS.west, 'thanksgiving'], ca: [...SHOP_HOLIDAY_SETS.west, 'thanksgiving'],
    sa: SHOP_HOLIDAY_SETS.muslim, ae: SHOP_HOLIDAY_SETS.muslim, eg: SHOP_HOLIDAY_SETS.muslim, jo: SHOP_HOLIDAY_SETS.muslim, ma: SHOP_HOLIDAY_SETS.muslim,
    pk: SHOP_HOLIDAY_SETS.muslim, bd: SHOP_HOLIDAY_SETS.muslim, id: SHOP_HOLIDAY_SETS.muslim,
    tr: [...SHOP_HOLIDAY_SETS.muslim, 'new_year'], kz: [...SHOP_HOLIDAY_SETS.muslim, 'new_year'],
    gr: SHOP_HOLIDAY_SETS.west, cy: SHOP_HOLIDAY_SETS.west, ro: SHOP_HOLIDAY_SETS.west, ua: SHOP_HOLIDAY_SETS.west, ru: SHOP_HOLIDAY_SETS.west, by: SHOP_HOLIDAY_SETS.west,
    in: ['diwali', 'christmas', 'new_year'],
    cn: ['lny_cn', 'mid_autumn'], tw: ['lny_cn', 'mid_autumn'], hk: ['lny_cn', 'mid_autumn', 'christmas'], sg: ['lny_cn', 'mid_autumn', 'christmas', 'eid_fitr'],
    kr: ['seollal', 'chuseok', 'christmas'],
    vn: ['tet', 'mid_autumn'],
    jp: ['oshogatsu', 'christmas'],
    th: ['songkran', 'new_year'],
    ng: ['christmas', 'easter', 'eid_fitr', 'eid_adha'], ke: ['christmas', 'easter', 'eid_fitr'], tz: ['christmas', 'easter', 'eid_fitr'],
};
const SHOP_HOLIDAY_ORTHODOX = ['gr', 'cy', 'ro', 'ua', 'ru', 'by'];
const SHOP_HOLIDAY_JULIAN_XMAS = ['ru', 'by'];

const SHOP_HOLIDAY_TEXT = {
    he: {
        names: {
            rosh_hashana: 'ראש השנה', yom_kippur: 'יום כיפור', sukkot: 'סוכות', hanukkah: 'חנוכה', tu_bishvat: 'ט״ו בשבט', purim: 'פורים', pesach: 'פסח', shavuot: 'שבועות',
            ramadan: 'רמדאן', eid_fitr: 'עיד אל-פיטר', eid_adha: 'עיד אל-אדחא', christmas: 'חג המולד', easter: 'פסחא', new_year: 'ערב השנה החדשה', thanksgiving: 'חג ההודיה',
            diwali: 'דיוואלי', lny_cn: 'ראש השנה הסיני', seollal: 'סולאל – ראש השנה הקוריאני', tet: 'טט – ראש השנה הווייטנאמי', mid_autumn: 'חג אמצע הסתיו', chuseok: 'צ׳וסוק', oshogatsu: 'אושוגאטסו – ראש השנה היפני', songkran: 'סונגקראן',
        },
        items: {
            rosh_hashana: 'תפוחים|דבש|רימונים|חלה עגולה|תמרים|ראש דג|סלק|כרתי|גזר|דלעת|עוגת דבש|יין לקידוש',
            yom_kippur: 'עוף לסעודה מפסקת|אורז|ירקות למרק|מים|נרות נשמה|נעלי בד|עוגה לשבירת הצום|תמרים|מיץ|קפה',
            sukkot: 'ארבעת המינים|קישוטים לסוכה|שרשרת אורות|חלות|יין לקידוש|פירות|ירקות|שתייה|כלים חד־פעמיים',
            hanukkah: 'נרות חנוכה|שמן|תפוחי אדמה|בצל|ביצים|קמח|סופגניות|ריבה|אבקת סוכר|מטבעות שוקולד|סביבונים',
            tu_bishvat: 'תמרים|תאנים מיובשות|צימוקים|שקדים|אגוזי מלך|משמש מיובש|חרובים|רימון|מיץ ענבים',
            purim: 'אוזני המן|ממתקים למשלוחי מנות|סלסלות|צלופן וסרטים|יין|פירות|תחפושת|רעשן',
            pesach: 'מצות|קמח מצה|יין לקידוש|מיץ ענבים|ביצים|חזרת|חסה|פטרוזיליה|תפוחים|אגוזים|תמרים|כנף עוף לזרוע|הגדות',
            shavuot: 'גבינה לבנה|שמנת מתוקה|שמנת חמוצה|ביסקוויטים|חמאה|חלב|גבינות|בלינצ׳ס|פירות|פרחים',
            ramadan: 'תמרים|מים|חלב|לבן|עדשים|אורז|עוף|קמח|סוכר|אגוזים|משמש מיובש|מיץ',
            eid_fitr: 'סולת|תמרים|אגוזים|חמאה|סוכר|ממתקים|שוקולד|קפה|מיץ|פירות|מתנות לילדים',
            eid_adha: 'בשר כבש|אורז|תבלינים|בצל|לחם|ירקות לסלט|יוגורט|פחמים|ממתקים|תמרים',
            christmas: 'הודו|תפוחי אדמה|ירקות|רוטב חמוציות|עוגיות|שוקולד|יין|גבינות|אגוזים|נרות|נייר עטיפה',
            easter: 'ביצים|ביצי שוקולד|צבע לביצים|כבש|לחם פסחא|תפוחי אדמה|ירקות|עוגה|יין|פרחים',
            new_year: 'יין מבעבע|חטיפים|גבינות|קרקרים|פירות|עוגה|כלים לאירוח|בלונים|זיקוקי יד|מיץ',
            thanksgiving: 'הודו|מילוי|תפוחי אדמה|בטטות|רוטב חמוציות|רוטב בשר|שעועית ירוקה|פירה דלעת|בצק פאי|לחמניות|תירס|יין',
            diwali: 'ממתקים הודיים|פירות יבשים|נרות שמן|נרות|צבעי רנגולי|גהי|סוכר|קמח|קמח חומוס|חלב|אגוזים|מתנות',
            lny_cn: 'עלי בצק לכיסונים|בשר חזיר|כרוב|דג|עוגת אורז|קלמנטינות|מעטפות אדומות|אגרולים|אטריות|ממתקים|עוף',
            seollal: 'עוגת אורז פרוסה|בקר|ביצים|בצל ירוק|קמח|דג|אגסים|תפוחים|אפרסמון מיובש|משקה אורז|סטים מתנה',
            tet: 'באן צ׳ונג|אורז דביק|שעועית מונג|בשר חזיר|בצל כבוש|פירות מסוכרים|אבטיח|פרחים|מעטפות אדומות|אגרולים|עוף',
            mid_autumn: 'עוגות ירח|פומלה|פנסים|תה|טארו|אפרסמון|ענבים|אגוזים',
            chuseok: 'עוגות אורז|קמח אורז|ערמונים|שיזפים|אגסים|תפוחים|בקר|דג|משקה אורז|סטים מתנה',
            oshogatsu: 'אוסצ׳י|מוצ׳י|סובה|קמאבוקו|שעועית שחורה|סאקה|מנדרינות|קגמי מוצ׳י|מעטפות לילדים',
            songkran: 'רובי מים|אבקת טלק|זרי יסמין|פירות|אורז דביק|מנגו|מים|מי בושם',
        },
    },
    en: {
        names: {
            rosh_hashana: 'Rosh Hashanah', yom_kippur: 'Yom Kippur', sukkot: 'Sukkot', hanukkah: 'Hanukkah', tu_bishvat: 'Tu BiShvat', purim: 'Purim', pesach: 'Passover', shavuot: 'Shavuot',
            ramadan: 'Ramadan', eid_fitr: 'Eid al-Fitr', eid_adha: 'Eid al-Adha', christmas: 'Christmas', easter: 'Easter', new_year: "New Year's Eve", thanksgiving: 'Thanksgiving',
            diwali: 'Diwali', lny_cn: 'Chinese New Year', seollal: 'Seollal – Korean New Year', tet: 'Tết – Vietnamese New Year', mid_autumn: 'Mid-Autumn Festival', chuseok: 'Chuseok', oshogatsu: 'Shōgatsu – Japanese New Year', songkran: 'Songkran',
        },
        items: {
            rosh_hashana: 'apples|honey|pomegranates|round challah|dates|fish head|beets|leeks|carrots|squash|honey cake|wine for kiddush',
            yom_kippur: 'chicken for the pre-fast meal|rice|soup vegetables|water|memorial candles|canvas shoes|cake to break the fast|dates|juice|coffee',
            sukkot: 'the four species|sukkah decorations|string lights|challah|wine for kiddush|fruit|vegetables|drinks|disposable plates',
            hanukkah: 'Hanukkah candles|oil|potatoes|onions|eggs|flour|doughnuts|jam|powdered sugar|chocolate coins|dreidels',
            tu_bishvat: 'dates|dried figs|raisins|almonds|walnuts|dried apricots|carob|pomegranate|grape juice',
            purim: 'hamantaschen|sweets for mishloach manot|gift baskets|cellophane and ribbons|wine|fruit|costume|grogger',
            pesach: 'matzah|matzah meal|wine for kiddush|grape juice|eggs|horseradish|lettuce|parsley|apples|walnuts|dates|chicken wing for the seder plate|haggadahs',
            shavuot: 'cream cheese|whipping cream|sour cream|biscuits|butter|milk|cheeses|blintzes|fruit|flowers',
            ramadan: 'dates|water|milk|laban|lentils|rice|chicken|flour|sugar|nuts|dried apricots|juice',
            eid_fitr: 'semolina|dates|nuts|butter|sugar|sweets|chocolate|coffee|juice|fruit|gifts for the kids',
            eid_adha: 'lamb|rice|spices|onions|bread|salad vegetables|yogurt|charcoal|sweets|dates',
            christmas: 'turkey|potatoes|vegetables|cranberry sauce|cookies|chocolate|wine|cheeses|nuts|candles|wrapping paper',
            easter: 'eggs|chocolate eggs|egg dye|lamb|Easter bread|potatoes|vegetables|cake|wine|flowers',
            new_year: 'sparkling wine|snacks|cheeses|crackers|fruit|cake|party plates|balloons|sparklers|juice',
            thanksgiving: 'turkey|stuffing|potatoes|sweet potatoes|cranberry sauce|gravy|green beans|pumpkin purée|pie crust|dinner rolls|corn|wine',
            diwali: 'mithai|dry fruits|diyas|candles|rangoli colours|ghee|sugar|maida|besan|milk|nuts|gifts',
            lny_cn: 'dumpling wrappers|pork|cabbage|fish|rice cake|tangerines|red envelopes|spring rolls|noodles|candy box|chicken',
            seollal: 'sliced rice cakes|beef|eggs|green onions|flour|fish|pears|apples|dried persimmons|sikhye|gift sets',
            tet: 'bánh chưng|glutinous rice|mung beans|pork|pickled onions|candied fruit|watermelon|blossoms|red envelopes|spring rolls|chicken',
            mid_autumn: 'mooncakes|pomelo|lanterns|tea|taro|persimmons|grapes|nuts',
            chuseok: 'songpyeon|rice flour|chestnuts|jujubes|pears|apples|beef|fish|sikhye|gift sets',
            oshogatsu: 'osechi|mochi|soba|kamaboko|black beans|sake|mandarins|kagami mochi|otoshidama envelopes',
            songkran: 'water guns|talcum powder|jasmine garlands|fruit|sticky rice|mango|water|scented water',
        },
    },
};

// ---------- התאריכים ----------
const shopHolCalCache = {};
// פרטי היום בלוח מסוים (חודש/יום), ל-400 הימים הבאים - פעם אחת לכל לוח
function shopHolCalDays(cal) {
    const today = getLocalDateString();
    const key = `${cal}|${today}`;
    if (shopHolCalCache[key]) return shopHolCalCache[key];
    let fmt;
    try { fmt = new Intl.DateTimeFormat('en-u-ca-' + cal, { month: cal === 'hebrew' ? 'long' : 'numeric', day: 'numeric' }); } catch { return (shopHolCalCache[key] = []); }
    const days = [];
    const d = new Date(`${today}T12:00:00`);
    for (let i = 0; i < 400; i++) {
        const parts = {};
        fmt.formatToParts(d).forEach(p => { parts[p.type] = p.value; });
        days.push({ iso: getLocalDateString(d), m: parts.month, d: Number(parts.day) });
        d.setDate(d.getDate() + 1);
    }
    return (shopHolCalCache[key] = days);
}
// פסחא: מערבית (גרגוריאנית) או אורתודוקסית (יוליאנית + 13 ימים, נכון ל-1900–2099)
function shopEasterDate(year, orthodox) {
    if (orthodox) {
        const a = year % 4, b = year % 7, c = year % 19, d = (19 * c + 15) % 30, e = (2 * a + 4 * b - d + 34) % 7;
        const month = Math.floor((d + e + 114) / 31), day = ((d + e + 114) % 31) + 1;
        const x = new Date(year, month - 1, day, 12);
        x.setDate(x.getDate() + 13);
        return getLocalDateString(x);
    }
    const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return getLocalDateString(new Date(year, month - 1, day, 12));
}
// התאריך הבא של חג (היום או אחריו), או null
function shopHolidayNext(id, country) {
    const r = SHOP_HOLIDAY_RULES[id];
    if (!r) return null;
    const today = getLocalDateString();
    const y = Number(today.slice(0, 4));
    const pick = list => list.filter(Boolean).sort().find(x => x >= today) || null;
    if (r.cal) {
        const hit = shopHolCalDays(r.cal).find(x => r.m.includes(String(x.m)) && x.d === r.d);
        return hit ? hit.iso : null;
    }
    if (r.dates) return pick(r.dates);
    if (r.easter) { const o = SHOP_HOLIDAY_ORTHODOX.includes(country); return pick([shopEasterDate(y, o), shopEasterDate(y + 1, o)]); }
    if (r.fixed) {
        const mmdd = id === 'christmas' && SHOP_HOLIDAY_JULIAN_XMAS.includes(country) ? '01-07' : r.fixed;
        return pick([`${y}-${mmdd}`, `${y + 1}-${mmdd}`]);
    }
    if (r.nth) {
        // חג ההודיה: ארה"ב - יום חמישי הרביעי בנובמבר; קנדה - יום שני השני באוקטובר
        const spec = id === 'thanksgiving' && country === 'ca' ? { month: 10, weekday: 1, n: 2 } : r.nth;
        const nth = yy => { const x = new Date(yy, spec.month - 1, 1, 12); const off = (spec.weekday - x.getDay() + 7) % 7; x.setDate(1 + off + 7 * (spec.n - 1)); return getLocalDateString(x); };
        return pick([nth(y), nth(y + 1)]);
    }
    return null;
}
// החגים של המדינה, לפי מה שמגיע ראשון
function shopHolidaysForCountry(country) {
    const ids = SHOP_HOLIDAY_BY_COUNTRY[country] || SHOP_HOLIDAY_SETS.west;
    return ids.map(id => ({ id, date: shopHolidayNext(id, country) })).filter(h => h.date).sort((a, b) => a.date.localeCompare(b.date));
}
