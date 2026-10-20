// 🛒 המחלקות בסופר לרשימת הקניות (2026-10-20, לפי בחירה מפורשת: "מיון לפי מחלקות בסופר", בלי AI).
// כל פריט נכנס למחלקה לפי מילים מוכרות בשם שלו (תחילת מילה; בעברית גם אחרי ו/ה/ב/ל/מ/ש/כ), וההתאמה הארוכה ביותר
// מנצחת - כך ש"שוקולד חלב" הוא חטיף ולא חלב, ו"מיץ תפוזים" הוא משקה. בודקים את שפת האפליקציה, עברית ואנגלית.
// הסדר כאן = סדר ההליכה בסופר (וגם שובר שוויון). מחלקה שהמשתמש בחר בעצמו נשמרת ב-shop_dept
const SHOP_DEPTS = ['produce', 'bakery', 'dairy', 'meat', 'pantry', 'frozen', 'drinks', 'snacks', 'cleaning', 'care', 'baby', 'pets'];
const SHOP_DEPT_COLORS = {
    produce: '#6fdc8c', bakery: '#f5b65b', dairy: '#8fd3ff', meat: '#f29ac0', pantry: '#d9b38c', frozen: '#9fe7f5',
    drinks: '#7aa8ff', snacks: '#c79bff', cleaning: '#7ee0c8', care: '#ffb3d9', baby: '#ffe28a', pets: '#c9a37a', other: '#b8b0c8',
};
// מילים לכל מחלקה, מופרדות ב-| (התחלה של מילה מספיקה: "עגבני" תופס עגבנייה ועגבניות)
const SHOP_DEPT_WORDS = {
    he: {
        produce: 'עגבני|מלפפו|גזר|בצל|שום|תפוח|תפוז|בננ|ענב|אבטיח|מלון|לימון|פלפל|חסה|כרוב|ברוקולי|כרובית|קישוא|חציל|תות|אבוקדו|תפוחי אדמה|בטטה|פטרוזיליה|כוסברה|שמיר|נענע|פטריות|ירק|פרי|פירות|אגס|אפרסק|שזיף|מנגו|אננס|קיווי|רימון|סלק|צנון|דלעת|תירס|תרד|ג\'ינג\'ר|ג׳ינג׳ר|אפונה|שעועית ירוקה|נבטים|ארטישוק|סלרי|כרישה|קולרבי|אוכמניות|דובדבן|ליים|אשכולית|קלמנטינ|נקטרינ|משמש|פומלה|פסיפלורה|ליצ\'י|בזיליקום|רוקט|עלי בייבי|ירוקים',
        bakery: 'לחם|לחמני|פיתה|פיתות|חלה|חלות|באגט|בייגל|קרואסון|עוגה|עוגות|עוגיות|מאפה|מאפים|טורטיה|לאפה|קרקר|פריכיות|בורקס|מאפינס|טוסט|ג\'בטה|מצות|מצה|פוקצ\'ה|רוגעלך|דונאט|סופגני|פרוסות לחם',
        dairy: 'חלב|גבינ|יוגורט|לבן|לבנה|שמנת|חמאה|ביצ|קוטג\'|קוטג׳|קוטג|מעדן|בולגרית|צפתית|מוצרלה|פרמזן|ריקוטה|שוקו|מילקי|דנונה|פודינג|קשקבל|לאבנה|קפיר|חלב סויה|חלב שקדים|חלב שיבולת',
        meat: 'בשר|עוף|חזה|כרעיים|שניצל|קציצות|נקניק|סטייק|אנטריקוט|המבורגר|כבד|הודו|דג|דגים|סלמון|אמנון|לברק|דניס|בקלה|שרימפס|פרגית|כנפיים|קבב|טחון|צלע|אסאדו|פילה|פסטרמה|סלמי|שוקיים|לבבות|שווארמה|כתף|צוואר',
        pantry: 'אורז|פסטה|ספגטי|קמח|סוכר|מלח|שמן|חומץ|קטשופ|מיונז|חרדל|טחינה|חומוס|עדשים|שעועית|גרגרי|פתיתים|קוסקוס|בורגול|קינואה|שיבולת|קורנפלקס|דגני|דגנ|גרנולה|ריבה|דבש|ממרח|קפה|תה|קקאו|תבלין|פלפל שחור|פפריקה|כמון|כורכום|קינמון|אורגנו|שמרים|אבקת אפייה|סודה לשתייה|וניל|שימורים|רסק|רוטב|מרק|אבקת מרק|שקדים|אגוזים|בוטנים|גרעינים|צימוקים|תמרים|פירות יבשים|זיתים|חמוצים|מלפפון חמוץ|טונה|סרדינים|נודלס|אטריות|פירורי לחם|קורנפלור|מייפל|סילאן|אינסטנט|שמן זית|חלבון|קמח מצה',
        frozen: 'קפוא|קפואים|קפואה|גלידה|ארטיק|שלגון|קרטיב|פיצה|בצק עלים|בצק פילו|קוביות קרח|נאגטס',
        drinks: 'מים|סודה|קולה|קוקה|ספרייט|פאנטה|מיץ|יין|בירה|וודקה|ערק|ויסקי|משקה|משקאות|תה קר|נסטי|פריגת|פטל|סירופ|שתייה|אנרגיה|לימונדה|מי סודה|קפה קר|ג\'ין|טוניק|מיץ תפוזים|מיץ תפוחים|מיץ ענבים',
        snacks: 'חטיף|חטיפים|במבה|ביסלי|צ\'יפס|ציפס|תפוצ\'יפס|שוקולד|סוכריות|סוכרי|מסטיק|וופל|פופקורן|בייגלה|דוריטוס|קליק|טורטית|ממתק|מתוקים|נוטלה|חלבה|מרשמלו|גומי|קרמבו|אגוזי לוז|חטיף אנרגיה|חטיף חלבון|פסק זמן|קינדר',
        cleaning: 'אקונומיקה|סבון כלים|נוזל כלים|כביסה|מרכך כביסה|מרכך|אבקת כביסה|ג\'ל כביסה|נייר טואלט|נייר סופג|מגבונים|שקיות|שקיות זבל|ספוג|סקוטש|מטהר|מסיר|מנקה|ניקוי|נוזל רצפה|סנו|כלור|נייר אלומיניום|ניילון נצמד|נייר אפייה|חד פעמי|מפיות|טישו|נרות|סוללות|נורה|מטליות|מגב|מטאטא|קפסולות למדיח|טבליות למדיח|מלח למדיח|מדיח|מבשם אוויר',
        care: 'שמפו|מרכך שיער|סבון|ג\'ל רחצה|תחליב רחצה|משחת שיניים|מברשת שיניים|חוט דנטלי|דאודורנט|קרם|קרם הגנה|תחבושות|טמפונים|פדים|סכין גילוח|סכיני גילוח|גילוח|קצף גילוח|צמר גפן|מקלוני אוזניים|אקמול|נורופן|אופטלגין|ויטמין|תרופ|פלסטר|לק|איפור|מסקרה|שפתון|בושם|אלכוג\'ל|מי פה|ג\'ל לשיער|תכשיר|לחות|מסיר איפור',
        baby: 'חיתול|חיתולים|מטרנה|סימילאק|תמ"ל|תמ״ל|מוצץ|בקבוק לתינוק|דייסה|מחית|מגבוני תינוק|פמפרס|האגיס|טיטולים|משחת החתלה|קרם החתלה|בייבי',
        pets: 'אוכל לחתול|אוכל לכלב|מזון לחתול|מזון לכלב|אוכל לחתולים|אוכל לכלבים|חול לחתול|חול לחתולים|חטיף לכלב|לכלב|לחתול|ציפור|אוכל לדגים',
    },
    en: {
        produce: 'tomato|cucumber|carrot|onion|garlic|apple|orange|banana|grape|watermelon|melon|lemon|lime|pepper|bell pepper|lettuce|cabbage|broccoli|cauliflower|zucchini|courgette|eggplant|aubergine|strawberr|blueberr|raspberr|avocado|potato|sweet potato|parsley|cilantro|coriander|dill|mint|basil|mushroom|vegetable|veggie|fruit|pear|peach|plum|mango|pineapple|kiwi|pomegranate|dates|beet|radish|pumpkin|squash|corn|spinach|kale|ginger|peas|green beans|celery|leek|scallion|spring onion|cherr|grapefruit|clementine|tangerine|nectarine|apricot|herbs|salad|arugula|rocket|sprouts|berries',
        bakery: 'bread|baguette|roll|bun|bagel|croissant|pita|tortilla|wrap|cake|muffin|cookie|cracker|toast|brioche|challah|donut|doughnut|pastry|pie|sourdough|loaf|biscuit|scone|matzah|matzo',
        dairy: 'milk|cheese|yogurt|yoghurt|butter|cream|egg|cottage|sour cream|cream cheese|mozzarella|parmesan|feta|cheddar|ricotta|kefir|custard|pudding|whipping cream|half and half|ghee|almond milk|oat milk|soy milk',
        meat: 'meat|beef|chicken|steak|ground beef|mince|pork|lamb|turkey|sausage|bacon|ham|salami|hot dog|burger|fish|salmon|tuna|cod|tilapia|shrimp|prawn|wings|drumstick|schnitzel|meatball|liver|veal|duck|anchov|pastrami',
        pantry: 'rice|pasta|spaghetti|noodle|flour|sugar|salt|oil|olive oil|vinegar|ketchup|mayo|mustard|tahini|hummus|lentil|beans|chickpea|couscous|bulgur|quinoa|oats|oatmeal|rolled oats|cereal|granola|cornflakes|jam|honey|spread|peanut butter|coffee|tea|cocoa|spice|black pepper|paprika|cumin|turmeric|cinnamon|oregano|yeast|baking powder|baking soda|vanilla|canned|can of|tomato paste|tomato sauce|sauce|soup|stock|broth|chicken stock|chicken broth|fish sauce|soy sauce|almond|walnut|peanut|nuts|seeds|raisin|dried fruit|olives|pickles|breadcrumbs|cornstarch|cornflour|maple|dressing|canned tuna|coconut milk|pancake mix|barley|sardine|protein powder',
        frozen: 'frozen|ice cream|popsicle|ice pops|pizza|puff pastry|ice cubes|sorbet|gelato|fish sticks|nuggets',
        drinks: 'water|sparkling|soda|cola|coke|sprite|juice|orange juice|apple juice|grape juice|wine|beer|vodka|whiskey|gin|rum|drink|lemonade|iced tea|energy drink|kombucha|soft drink|seltzer|tonic|syrup',
        snacks: 'snack|chips|crisps|chocolate|candy|sweets|gum|popcorn|pretzel|nachos|doritos|marshmallow|gummy|gummies|licorice|nutella|bar|granola bar|protein bar|wafer|lollipop|jelly beans',
        cleaning: 'bleach|dish soap|dishwashing|detergent|laundry|fabric softener|softener|toilet paper|toilet roll|paper towel|napkin|tissue|wipes|trash bags|garbage bags|bin bags|bags|sponge|cleaner|cleaning|disinfectant|foil|aluminum foil|plastic wrap|cling film|baking paper|parchment|dishwasher|candles|batteries|light bulb|bulb|mop|broom|air freshener|scrub',
        care: 'shampoo|conditioner|soap|bar soap|body wash|shower gel|toothpaste|toothbrush|floss|deodorant|lotion|moisturizer|sunscreen|razor|shaving cream|shaving|pads|tampons|cotton|q-tips|cotton swabs|painkiller|ibuprofen|paracetamol|tylenol|advil|aspirin|vitamin|medicine|band-aid|plaster|makeup|mascara|lipstick|perfume|mouthwash|hand cream|face cream|hair gel|hand sanitizer|nail polish',
        baby: 'diaper|nappy|nappies|baby formula|formula|baby food|pacifier|dummy|baby wipes|baby bottle|diaper cream|baby',
        pets: 'cat food|dog food|cat litter|litter|dog treats|pet food|bird seed|fish food',
    },
};
