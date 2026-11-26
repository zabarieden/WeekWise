// ============================================================================
// 📅 יומן שלב 2 - פרטי האירוע וחזרות (13–25 מהרשימה שבחרה; "כן מאשרת את יומן שלב 2", 2026-11-25).
// נטען אחרי calendar-views.js. העמודות: supabase/sql/2026-11-25_calendar_stage2.sql
//  13 כל היום (all_day)                14 כמה ימים - מ… עד… (end_date)
//  15+16 יומנים נפרדים עם צבע, הצגה והסתרה (user_calendars, calendar_id)
//  17 סמל לאירוע - נבחר לבד לפי המילים, או ידנית (icon; null = לפי הכותרת, '' = בלי)
//  18 מקום עם Waze / מפות (location - עכשיו גם באירוע, לא רק בפגישה)
//  19 קבצים ותמונות (attachments + התיקייה הפרטית calendar-files)
//  20 פנוי / עסוק (is_free) - "פנוי" לא נספר בחפיפה ובחיפוש זמן פנוי
//  21–24 חזרה שנתית, "יום ג׳ השני בחודש", כמה ימים בשבוע, סיום אחרי X פעמים או עד תאריך
//  25 עריכה ומחיקה של "הזה והבאים"
// ============================================================================

// ---------- יומנים (15+16) ----------
// בלי אדום (הכלל שלה) - גוונים רכים שנראים טוב בכל ערכה
const CALX_COLORS = ['#a78bfa', '#f472b6', '#60a5fa', '#34d399', '#fbbf24', '#fb923c', '#2dd4bf', '#c084fc', '#94a3b8', '#f9a8d4'];
const CALX_CAL_SUGGEST = ['calx_cal_s_personal', 'calx_cal_s_work', 'calx_cal_s_family', 'calx_cal_s_health', 'calx_cal_s_study'];
let calxCalendars = [];
let calxCalendarsLoaded = false;
async function calxLoadCalendars(force) {
    if (calxCalendarsLoaded && !force) return calxCalendars;
    if (!supabaseClient || !currentUserId) return calxCalendars;
    const { data, error } = await supabaseClient.from('user_calendars').select('*').eq('user_id', currentUserId).order('sort_order', { ascending: true }).order('created_at', { ascending: true });
    if (!error) { calxCalendars = data || []; calxCalendarsLoaded = true; }
    return calxCalendars;
}
function calxEsc(s) { return escapeHtmlForReport(s == null ? '' : String(s)); }
function calxCalOf(row) { return row && row.calendar_id ? calxCalendars.find(c => c.id === row.calendar_id) || null : null; }
function calxColorOf(row) { const c = calxCalOf(row); return c ? c.color : null; }
function calxVisible(row) { const c = calxCalOf(row); return !c || c.is_visible !== false; }

// ---------- כמה ימים (14) ----------
function calxEnd(row) { return row && row.end_date && row.end_date > row.event_date ? row.end_date : (row ? row.event_date : null); }
function calxIsMulti(row) { return !!(row && row.end_date && row.end_date > row.event_date); }
function calxCovers(row, ds) { return !!row && !!row.event_date && row.event_date <= ds && calxEnd(row) >= ds; }
function calxDaysBetween(a, b) { const [y1, m1, d1] = a.split('-').map(Number); const [y2, m2, d2] = b.split('-').map(Number); return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000); }
// "יום 2 מתוך 3"
function calxDayLabel(row, ds) {
    if (!calxIsMulti(row)) return '';
    return t('calx_day_n_of').replace('{n}', calxDaysBetween(row.event_date, ds) + 1).replace('{total}', calxDaysBetween(row.event_date, calxEnd(row)) + 1);
}
// שאילתה של "כל מה שנוגע בטווח" - כולל אירוע שהתחיל קודם ונמשך לתוך הטווח
function calxRange(q, start, end) { return q.lte('event_date', end).or(`event_date.gte.${start},end_date.gte.${start}`); }
function calxFmtShort(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString(currentLang, { day: 'numeric', month: 'short' }); }

// ---------- סמל לאירוע (17) ----------
const CALX_ICON_CHOICES = ['🦷', '🩺', '💊', '🏥', '🎂', '🎉', '💍', '💞', '✈️', '🧳', '🏖️', '🏨', '🚆', '🚗', '🏋️', '🏃', '🧘', '🏊', '⚽', '💇', '💆', '🍽️', '☕', '🛒', '🎁', '🎬', '🎵', '🎭', '📚', '📝', '🏫', '🎒', '💼', '📞', '💻', '🏦', '💳', '🧹', '🔧', '🐶', '👶', '🏡', '❤️', '⭐', '📌', '🌱', '🙏', '🎮'];
// מילים בשפות האפליקציה → סמל. הראשון שמתאים מנצח
const CALX_ICON_RULES = [
    [/שיניים|שן |dentist|zahnarzt|dentiste|dentista|стоматолог|зубн|dentysta|tandläkar|tandlæge|tannlege|hammaslääkär|fogorvos|οδοντίατρ|歯医者|歯科|牙医|牙科|치과|dokter gigi|nha sĩ|daktari wa meno|dişçi|diş hekimi|طبيب أسنان|ڈینٹسٹ|दंत|দাঁত|ทันตแพทย์|zubař|stomatolog|tandarts/i, '🦷'],
    [/יום הולדת|יומולדת|birthday|geburtstag|anniversaire|cumpleaños|aniversário|день рождения|днем народження|compleanno|urodzin|födelsedag|fødselsdag|bursdag|syntymäpäiv|születésnap|γενέθλια|誕生日|生日|생일|ulang tahun|sinh nhật|siku ya kuzaliwa|doğum günü|عيد ميلاد|سالگرہ|जन्मदिन|জন্মদিন|วันเกิด|narozenin|verjaardag|aniversari|ọjọ́ ìbí/i, '🎂'],
    [/חתונה|wedding|hochzeit|mariage|boda|casamento|свадьб|весілл|matrimonio|ślub|bröllop|bryllup|häät|esküvő|γάμος|結婚式|婚礼|결혼식|pernikahan|đám cưới|harusi|düğün|زفاف|شادی|शादी|বিয়ে|งานแต่ง|svatba|bruiloft|casament/i, '💍'],
    [/יום נישואין|anniversary|jahrestag|aniversario de boda|годовщин|річниц|anniversario|rocznic|årsdag|bryllupsdag|hääpäivä|évforduló|επέτειο|記念日|纪念日|기념일|hari jadi|kỷ niệm|maadhimisho|yıl dönümü|ذكرى|سالگرہ شادی|वर्षगांठ|বার্ষিকী|วันครบรอบ|výročí|jubileum/i, '💞'],
    [/רופא|רופאה|קופת חולים|בדיקת דם|doctor|arzt|ärztin|médecin|médico|врач|лікар|medico|lekarz|läkare|læge|lege|lääkär|orvos|γιατρ|医者|病院の予約|医生|의사|병원 예약|dokter|bác sĩ|daktari|doktor|طبيب|ڈاکٹر|डॉक्टर|ডাক্তার|หมอ|lékař|huisarts|metge/i, '🩺'],
    [/בית חולים|hospital|krankenhaus|hôpital|больниц|лікарн|ospedale|szpital|sjukhus|sygehus|sykehus|sairaala|kórház|νοσοκομείο|病院|医院|병원|rumah sakit|bệnh viện|hospitali|hastane|مستشفى|ہسپتال|अस्पताल|হাসপাতাল|โรงพยาบาล|nemocnic|ziekenhuis/i, '🏥'],
    [/תרופ|בית מרקחת|pharmacy|apotheke|pharmacie|farmacia|аптек|apteka|apotek|apteekki|gyógyszer|φαρμακ|薬|药|약국|apotek|nhà thuốc|duka la dawa|eczane|صيدلية|فارمیسی|फार्मेसी|ফার্মেসি|ร้านขายยา|lékárn|apotheek|farmàcia/i, '💊'],
    [/טיסה|טיסת|נמל תעופה|flight|flug|vol |vuelo|voo |рейс|політ|volo|lot |flyg|fly |lento|repülő|πτήση|フライト|航班|비행|penerbangan|chuyến bay|safari ya ndege|uçuş|رحلة طيران|پرواز|उड़ान|ফ্লাইট|เที่ยวบิน|letadl|vlucht|vol a/i, '✈️'],
    [/חופשה|חופש|vacation|holiday|urlaub|vacances|vacaciones|férias|отпуск|відпустк|vacanza|wakacj|semester|ferie|loma|szabadság|διακοπές|休暇|旅行|度假|휴가|liburan|kỳ nghỉ|likizo|tatil|إجازة|چھٹی|छुट्टी|ছুটি|วันหยุด|dovolen|vakantie|vacances/i, '🏖️'],
    [/נסיעה ל|טיול|trip|reise|voyage|viaje|viagem|поездк|подорож|viaggio|podróż|resa|rejse|matka|utazás|ταξίδι|旅|旅程|여행|perjalanan|chuyến đi|safari|seyahat|رحلة|سفر|यात्रा|ভ্রমণ|ทริป|výlet|reis/i, '🧳'],
    [/מלון|hotel|отель|готел|hôtel|albergo|hotell|ξενοδοχ|ホテル|酒店|호텔|khách sạn|hoteli|otel|فندق|ہوٹل|होटल|হোটেল|โรงแรม/i, '🏨'],
    [/רכבת|train|zug|tren|comboio|поезд|потяг|treno|pociąg|tåg|tog|juna|vonat|τρένο|電車|列车|기차|kereta|tàu hỏa|treni|اوٹرین|قطار|ٹرین|ट्रेन|ট্রেন|รถไฟ|vlak|trein/i, '🚆'],
    [/טסט לרכב|מוסך|רכב|car service|garage|werkstatt|auto|voiture|coche|carro|машин|автомоб|samochód|bil |bilen|vehicle|autó|αυτοκίνητο|車検|汽车|자동차|mobil|xe hơi|gari|araba|سيارة|گاڑی|कार|গাড়ি|รถยนต์|vůz/i, '🚗'],
    [/חדר כושר|כושר|אימון|gym|fitness|workout|training|training|entraînement|entrenamiento|treino|тренировк|тренуван|allenamento|trening|träning|træning|trening|treeni|edzés|γυμναστήρι|ジム|健身|헬스|latihan|tập gym|mazoezi|antrenman|تمرين|ورزش|जिम|জিম|ยิม|posilovn|sportschool|gimnàs/i, '🏋️'],
    [/ריצה|run |running|lauf|course à pied|correr|corrida|бег|біг|corsa|bieg|löpning|løb|løping|juoksu|futás|τρέξιμο|ランニング|跑步|달리기|lari|chạy bộ|kukimbia|koşu|جري|دوڑ|दौड़|দৌড়|วิ่ง|běh|hardlopen|córrer/i, '🏃'],
    [/יוגה|פילאטיס|yoga|pilates|йог|ヨガ|瑜伽|요가|โยคะ|योग|যোগ|یوگا|يوغا/i, '🧘'],
    [/שחייה|בריכה|swim|schwimm|natation|natación|natação|плаван|nuoto|pływ|simning|svømm|uinti|úszás|κολύμπ|水泳|游泳|수영|berenang|bơi|kuogelea|yüzme|سباحة|تیراکی|तैराकी|সাঁতার|ว่ายน้ำ|plavání|zwemm|natació/i, '🏊'],
    [/כדורגל|football|soccer|fußball|fútbol|futebol|футбол|calcio|piłk|fotboll|fodbold|fotball|jalkapallo|foci|ποδόσφαιρο|サッカー|足球|축구|sepak bola|bóng đá|mpira wa miguu|futbol|كرة القدم|فٹ بال|फुटबॉल|ফুটবল|ฟุตบอล|fotbal|voetbal|futbol/i, '⚽'],
    [/תספורת|מספרה|ספר |haircut|hairdresser|barber|friseur|coiffeur|peluquer|cabeleireir|стрижк|парикмах|перукар|parrucchier|fryzjer|frisör|frisør|kampaamo|fodrász|κομμωτήρι|美容院|理发|미용실|potong rambut|cắt tóc|kinyozi|kuaför|berber|حلاق|نائی|बाल कट|চুল কাটা|ตัดผม|kadeřník|kapper|perruquer/i, '💇'],
    [/עיסוי|ספא|massage|masaje|massagem|массаж|масаж|massaggio|masaż|massage|hieronta|masszázs|μασάζ|マッサージ|按摩|마사지|pijat|mát xa|kukandwa|masaj|تدليك|مالش|मालिश|ম্যাসাজ|นวด|masáž/i, '💆'],
    [/ארוחת|מסעדה|dinner|lunch|breakfast|restaurant|abendessen|mittagessen|dîner|déjeuner|cena|almuerzo|jantar|almoço|ужин|обед|вечеря|обід|pranzo|obiad|kolacj|middag|lunsj|frokost|illallinen|lounas|vacsora|ebéd|δείπνο|γεύμα|ディナー|ランチ|晚餐|午餐|저녁 식사|점심|makan malam|bữa tối|chakula cha jioni|akşam yemeği|عشاء|غداء|ڈنر|डिनर|ডিনার|อาหารเย็น|večeře|oběd|diner|sopar|dinar/i, '🍽️'],
    [/קפה|coffee|kaffee|café|кофе|кава|caffè|kawa|kaffe|kahvi|kávé|καφέ|コーヒー|咖啡|커피|kopi|cà phê|kahawa|kahve|قهوة|کافی|कॉफी|কফি|กาแฟ|káva|koffie/i, '☕'],
    [/קניות|סופר|shopping|groceries|einkauf|courses|compras|покупк|покупки|spesa|zakupy|handla|indkøb|handle|ostokset|bevásárlás|ψώνια|買い物|购物|장보기|belanja|mua sắm|manunuzi|alışveriş|تسوق|خریداری|खरीदारी|কেনাকাটা|ช้อปปิ้ง|nákup|boodschappen|compra/i, '🛒'],
    [/מתנה|gift|geschenk|cadeau|regalo|presente|подар|prezent|present|gave|lahja|ajándék|δώρο|プレゼント|礼物|선물|hadiah|quà|zawadi|hediye|هدية|تحفہ|उपहार|উপহার|ของขวัญ|dárek|cadeau/i, '🎁'],
    [/מסיבה|party|fiesta|fête|festa|вечеринк|вечірк|impreza|fest|juhlat|buli|πάρτι|パーティー|派对|파티|pesta|tiệc|sherehe|parti|حفلة|پارٹی|पार्टी|পার্টি|ปาร์ตี้|večírek|feest/i, '🎉'],
    [/סרט|קולנוע|movie|cinema|kino|cinéma|cine|filme|кино|фильм|фільм|film|bio |elokuva|mozi|ταινία|映画|电影|영화|bioskop|phim|filamu|sinema|فيلم|فلم|फिल्म|সিনেমা|หนัง|bioscoop|pel·lícula/i, '🎬'],
    [/הופעה|קונצרט|concert|konzert|concierto|show|концерт|concerto|koncert|konsert|konsertti|συναυλία|コンサート|音乐会|콘서트|konser|hòa nhạc|tamasha|كونسرت|کنسرٹ|कॉन्सर्ट|কনসার্ট|คอนเสิร์ต/i, '🎵'],
    [/תיאטרון|הצגה|theater|theatre|theater|théâtre|teatro|театр|teatr|teater|teatteri|színház|θέατρο|劇場|话剧|연극|teater|nhà hát|tamthilia|tiyatro|مسرح|تھیٹر|थिएटर|থিয়েটার|ละคร|divadlo|toneel/i, '🎭'],
    [/מבחן|בחינה|exam|test |prüfung|examen|exame|экзамен|іспит|esame|egzamin|tentamen|eksamen|koe |vizsga|εξέταση|試験|考试|시험|ujian|thi |mtihani|sınav|امتحان|امتحان|परीक्षा|পরীক্ষা|สอบ|zkouška|tentamen|examen/i, '📝'],
    [/שיעור|הרצאה|לימוד|study|lesson|lecture|lernen|cours|clase|aula|урок|лекци|лекці|lezione|lekcj|lektion|time |oppitunti|óra |μάθημα|授業|课|수업|kelas|lớp học|somo|ders|درس|سبق|कक्षा|ক্লাস|เรียน|lekce|les |classe/i, '📚'],
    [/בית ספר|גן |school|schule|école|escuela|escola|школ|scuola|szkoł|skola|skole|koulu|iskola|σχολείο|学校|学校|학교|sekolah|trường|shule|okul|مدرسة|اسکول|स्कूल|স্কুল|โรงเรียน|škola/i, '🏫'],
    [/פגישת עבודה|ראיון|רואה חשבון|עורך דין|work|accountant|lawyer|meeting|interview|arbeit|besprechung|travail|réunion|trabajo|reunión|trabalho|reunião|работ|собеседован|робот|співбесід|lavoro|riunione|praca|spotkanie|arbete|möte|arbejde|møde|jobb|møte|työ|palaveri|munka|megbeszélés|δουλειά|συνάντηση|仕事|会議|工作|会议|업무|회의|kerja|rapat|công việc|họp|kazi|mkutano|iş|toplantı|عمل|اجتماع|کام|میٹنگ|काम|मीटिंग|কাজ|মিটিং|งาน|ประชุม|práce|schůzka|werk|vergadering|feina|reunió/i, '💼'],
    [/שיחת טלפון|להתקשר|call|anruf|appel|llamada|ligação|звонок|дзвінок|chiamata|telefon|samtal|opkald|puhelu|hívás|κλήση|電話|电话|통화|telepon|cuộc gọi|simu|arama|مكالمة|کال|कॉल|কল|โทร|hovor|bellen|trucada/i, '📞'],
    [/בנק|bank|banque|banco|банк|banca|pankki|τράπεζα|銀行|银行|은행|ngân hàng|benki|banka|بنك|بینک|बैंक|ব্যাংক|ธนาคาร|bank/i, '🏦'],
    [/תשלום|לשלם|חשבונית|חשבון חשמל|חשבון מים|payment|pay |bill|zahlung|rechnung|paiement|facture|pago|factura|pagamento|conta|оплат|платёж|платіж|pagamento|bolletta|płatność|rachunek|betalning|faktura|betaling|regning|maksu|lasku|fizetés|számla|πληρωμή|λογαριασμός|支払い|付款|账单|결제|납부|pembayaran|tagihan|thanh toán|hóa đơn|malipo|ödeme|fatura|دفع|فاتورة|ادائیگی|بل|भुगतान|বিল|ชำระ|platba|betaling|pagament/i, '💳'],
    [/ניקיון|לנקות|clean|putzen|ménage|limpieza|limpeza|уборк|прибиран|pulizie|sprzątanie|städ|rengøring|vask|siivous|takarítás|καθάρισμα|掃除|打扫|청소|bersih|dọn dẹp|usafi|temizlik|تنظيف|صفائی|सफाई|পরিষ্কার|ทำความสะอาด|úklid|schoonmaak|neteja/i, '🧹'],
    [/וטרינר|כלב|חתול|vet |veterinar|tierarzt|vétérinaire|ветеринар|weterynarz|veterinär|dyrlæge|veterinær|eläinlääkär|állatorvos|κτηνίατρ|獣医|兽医|수의사|dokter hewan|thú y|daktari wa wanyama|veteriner|بيطري|ویٹرنری|पशु चिकित्सक|পশু চিকিৎসক|สัตวแพทย์|dierenarts/i, '🐶'],
    [/תינוק|baby|bébé|bebé|bebê|малыш|малюк|neonato|niemowl|bebis|baby|vauva|baba|μωρό|赤ちゃん|宝宝|아기|bayi|em bé|mtoto mchanga|bebek|طفل رضيع|بچہ|बच्चा|শিশু|ทารก|miminko/i, '👶'],
    [/משחק|game|spiel|jeu|juego|jogo|игр|гра |gioco|gra |spel|spil|peli|játék|παιχνίδι|ゲーム|游戏|게임|permainan|trò chơi|mchezo|oyun|لعبة|کھیل|खेल|খেলা|เกม|hra|spel|joc/i, '🎮'],
];
function calxSuggestIcon(title) {
    const s = ` ${String(title || '').toLowerCase()} `;
    if (!s.trim()) return '';
    const hit = CALX_ICON_RULES.find(([re]) => re.test(s));
    return hit ? hit[1] : '';
}
// מה מוצג ליד הכותרת: סמל שנבחר ('' = בלי), אחרת לפי הכותרת, אחרת undefined (calendarKindIcon משלים לפי הסוג)
function calxIconOf(row) {
    if (!row) return undefined;
    if (row.icon !== null && row.icon !== undefined) return row.icon;
    const auto = calxSuggestIcon(row.event_title);
    return auto || undefined;
}

// ---------- מקום (18) ----------
function calxIsLink(text) { return typeof isMeetingLink === 'function' ? isMeetingLink(text) : /^https?:\/\//i.test(text || ''); }
function calxNavLinks(location) {
    const q = encodeURIComponent(String(location || '').trim());
    if (!q || calxIsLink(location)) return null;
    const apple = /iPhone|iPad|Macintosh/.test(navigator.userAgent);
    return {
        waze: `https://waze.com/ul?q=${q}&navigate=yes`,
        maps: apple ? `https://maps.apple.com/?q=${q}` : `https://www.google.com/maps/search/?api=1&query=${q}`,
    };
}
const CALX_PIN_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
const CALX_CLIP_SVG = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.5 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.6-8.6a3.4 3.4 0 0 1 4.8 4.8l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.9-7.9"/></svg>';

// השורה מתחת לאירוע ברשימת היום: יומן (צבע), כמה ימים, פנוי, מקום + ניווט, קבצים
function calxExtraHtml(row, ds) {
    const bits = [];
    const cal = calxCalOf(row);
    if (cal) bits.push(`<span class="calx-tag" style="--calx-c:${calxEsc(cal.color)}"><i class="calx-dot" aria-hidden="true"></i>${calxEsc(cal.name)}</span>`);
    const dayLbl = ds ? calxDayLabel(row, ds) : '';
    if (dayLbl) bits.push(`<span class="calx-tag">${calxEsc(dayLbl)} · ${calxEsc(calxFmtShort(row.event_date))}–${calxEsc(calxFmtShort(calxEnd(row)))}</span>`);
    else if (row.all_day) bits.push(`<span class="calx-tag">${calxEsc(t('calx_allday'))}</span>`);
    if (row.is_free) bits.push(`<span class="calx-tag is-free">${calxEsc(t('calx_free'))}</span>`);
    if (row.location && calendarKindOf(row) !== 'meeting') {
        const nav = calxNavLinks(row.location);
        bits.push(`<span class="calx-place">${CALX_PIN_SVG}<span>${calxEsc(row.location)}</span></span>`);
        if (nav) bits.push(`<a class="calx-nav" href="${calxEsc(nav.waze)}" target="_blank" rel="noopener">Waze</a><a class="calx-nav" href="${calxEsc(nav.maps)}" target="_blank" rel="noopener">${calxEsc(t('calx_nav_maps'))}</a>`);
    } else if (row.location && calendarKindOf(row) === 'meeting') {
        const nav = calxNavLinks(row.location);
        if (nav) bits.push(`<a class="calx-nav" href="${calxEsc(nav.waze)}" target="_blank" rel="noopener">Waze</a><a class="calx-nav" href="${calxEsc(nav.maps)}" target="_blank" rel="noopener">${calxEsc(t('calx_nav_maps'))}</a>`);
    }
    (Array.isArray(row.attachments) ? row.attachments : []).forEach((f, i) => bits.push(`<button type="button" class="calx-file" data-calx-file="${calxEsc(row.id)}:${i}">${CALX_CLIP_SVG}<span>${calxEsc(f.n || 'file')}</span></button>`));
    return bits.length ? `<div class="calx-extra">${bits.join('')}</div>` : '';
}
function calxBindExtra(root, rowsById) {
    root.querySelectorAll('[data-calx-file]').forEach(b => {
        if (b.dataset.calxBound) return;
        b.dataset.calxBound = '1';
        b.addEventListener('click', e => {
            e.stopPropagation();
            const [id, i] = b.dataset.calxFile.split(':');
            const row = rowsById[id];
            const f = row && Array.isArray(row.attachments) ? row.attachments[Number(i)] : null;
            if (f) calxOpenFile(f);
        });
    });
    root.querySelectorAll('.calx-nav').forEach(a => a.addEventListener('click', e => e.stopPropagation()));
}

// ---------- קבצים (19) ----------
const CALX_MAX_FILE = 10 * 1024 * 1024;
const CALX_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf'];
async function calxOpenFile(f) {
    // החלון נפתח מיד (לפני הקישור) - אחרת דפדפנים חוסמים אותו
    const win = window.open('', '_blank');
    const { data, error } = await supabaseClient.storage.from('calendar-files').createSignedUrl(f.p, 600);
    if (error || !data || !data.signedUrl) { if (win) win.close(); showAppToast(t('calx_attach_failed'), 'error'); return; }
    if (win) win.location.href = data.signedUrl; else window.location.href = data.signedUrl;
}
async function calxUploadFile(file) {
    const safe = String(file.name || 'file').replace(/[^\p{L}\p{N}._-]+/gu, '_').slice(-80);
    const path = `${currentUserId}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
    const { error } = await supabaseClient.storage.from('calendar-files').upload(path, file, { contentType: file.type, upsert: false });
    if (error) return null;
    return { p: path, n: String(file.name || 'file').slice(0, 80), t: file.type, s: file.size };
}
// קובץ שאף אירוע כבר לא מצביע עליו - נמחק מהתיקייה
async function calxDropFileIfUnused(path) {
    const { data } = await supabaseClient.from('calendar_events').select('id').eq('user_id', currentUserId).contains('attachments', JSON.stringify([{ p: path }])).limit(1);
    if (!data || !data.length) await supabaseClient.storage.from('calendar-files').remove([path]);
}

// ---------- מצב החלון של האירוע ----------
let calxM = { allDay: false, endDate: '', calendarId: null, icon: null, iconManual: false, isFree: false, files: [], pending: [], removed: [], rems: [], travel: 0 };
function calxResetModal() {
    calxM = { allDay: false, endDate: '', calendarId: null, icon: null, iconManual: false, isFree: false, files: [], pending: [], removed: [], rems: [], travel: 0 };
    calxRecReset();
    calxRenderModal();
}
function calxFillModal(row) {
    calxM = {
        allDay: !!row.all_day,
        endDate: row.end_date && row.end_date > row.event_date ? row.end_date : '',
        calendarId: row.calendar_id || null,
        icon: row.icon !== undefined ? row.icon : null,
        iconManual: row.icon !== null && row.icon !== undefined,
        isFree: !!row.is_free,
        files: Array.isArray(row.attachments) ? row.attachments.slice() : [],
        pending: [], removed: [],
        seriesGroup: row.recurrence_group_id || null,
        rems: Array.isArray(row.extra_reminders) ? row.extra_reminders.map(Number).filter(n => n >= 0) : [],
        travel: Number(row.travel_minutes) > 0 ? Number(row.travel_minutes) : 0,
    };
    calxRenderModal();
}
function calxReadModal(dateStr) {
    const end = calxM.endDate && dateStr && calxM.endDate > dateStr ? calxM.endDate : null;
    if (calxM.endDate && dateStr && calxM.endDate < dateStr) return { error: 'calx_end_before_start' };
    return {
        fields: {
            all_day: !!calxM.allDay,
            end_date: end,
            calendar_id: calxM.calendarId || null,
            icon: calxM.iconManual ? (calxM.icon || '') : null,
            is_free: !!calxM.isFree,
            // ⏰ יומן שלב 3: עוד תזכורות (דקות לפני) וזמן לצאת (דקות נסיעה)
            extra_reminders: calxM.rems.length ? calxM.rems.slice().sort((a, b) => b - a) : null,
            travel_minutes: calxM.travel > 0 ? calxM.travel : null,
        },
    };
}
function calxRenderModal() {
    // כל היום: בלי שעות
    const allBtn = document.getElementById('calx-allday');
    if (allBtn) { allBtn.setAttribute('aria-pressed', calxM.allDay ? 'true' : 'false'); allBtn.classList.toggle('on', calxM.allDay); }
    document.querySelector('#modal-add-calendar-event .calendar-event-time-row')?.classList.toggle('hidden', calxM.allDay);
    // עד תאריך
    const endInput = document.getElementById('calendar-event-end-date-input');
    if (endInput) endInput.value = calxM.endDate || '';
    const endBtn = document.getElementById('calx-enddate-btn');
    if (endBtn) {
        endBtn.classList.toggle('on', !!calxM.endDate);
        endBtn.querySelector('span').textContent = calxM.endDate ? t('calx_until_label').replace('{date}', calxFmtShort(calxM.endDate)) : t('calx_until_btn');
    }
    document.getElementById('calx-enddate-clear')?.classList.toggle('hidden', !calxM.endDate);
    // הסמל
    const iconBtn = document.getElementById('calx-icon-btn');
    if (iconBtn) {
        const title = document.getElementById('calendar-event-title-input')?.value || '';
        const shown = calxM.iconManual ? calxM.icon : calxSuggestIcon(title);
        iconBtn.innerHTML = shown ? `<span>${calxEsc(shown)}</span>` : '<span class="calx-icon-empty" aria-hidden="true">＋</span>';
        iconBtn.classList.toggle('is-auto', !calxM.iconManual && !!shown);
    }
    // יומנים
    const cals = document.getElementById('calx-cals');
    if (cals) {
        cals.innerHTML = calxCalendars.map(c => `<button type="button" class="calx-chip calx-cal-chip${calxM.calendarId === c.id ? ' on' : ''}" data-calx-cal="${calxEsc(c.id)}" aria-pressed="${calxM.calendarId === c.id}" style="--calx-c:${calxEsc(c.color)}"><i class="calx-dot" aria-hidden="true"></i>${calxEsc(c.name)}</button>`).join('')
            + `<button type="button" class="calx-chip calx-cal-add" data-calx-cal-add>＋ ${calxEsc(t('calx_cal_new_chip'))}</button>`;
        cals.querySelectorAll('[data-calx-cal]').forEach(b => b.addEventListener('click', () => { calxM.calendarId = calxM.calendarId === b.dataset.calxCal ? null : b.dataset.calxCal; calxRenderModal(); }));
        cals.querySelector('[data-calx-cal-add]').addEventListener('click', () => calxOpenCalendars(true));
    }
    // פנוי / עסוק
    document.querySelectorAll('#calx-busy-row [data-calx-busy]').forEach(b => {
        const on = (b.dataset.calxBusy === 'free') === !!calxM.isFree;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on ? 'true' : 'false');
    });
    // קבצים
    const files = document.getElementById('calx-files');
    if (files) {
        const all = calxM.files.map((f, i) => ({ f, i, kind: 'saved' })).concat(calxM.pending.map((f, i) => ({ f: { n: f.name }, i, kind: 'pending' })));
        files.innerHTML = all.map(x => `<span class="calx-file-chip">${CALX_CLIP_SVG}<button type="button" class="calx-file-open" data-calx-open="${x.kind}:${x.i}">${calxEsc(x.f.n || 'file')}</button><button type="button" class="calx-file-x" data-calx-rm="${x.kind}:${x.i}" aria-label="${calxEsc(t('delete_btn') || '✕')}">✕</button></span>`).join('');
        files.querySelectorAll('[data-calx-rm]').forEach(b => b.addEventListener('click', () => {
            const [kind, i] = b.dataset.calxRm.split(':');
            if (kind === 'pending') calxM.pending.splice(Number(i), 1);
            else { const [f] = calxM.files.splice(Number(i), 1); if (f) calxM.removed.push(f.p); }
            calxRenderModal();
        }));
        files.querySelectorAll('[data-calx-open]').forEach(b => b.addEventListener('click', () => {
            const [kind, i] = b.dataset.calxOpen.split(':');
            if (kind === 'saved' && calxM.files[Number(i)]) calxOpenFile(calxM.files[Number(i)]);
        }));
    }
    calxRemsRender();
    calxRecRender();
}

// ---------- ⏰ יומן שלב 3: עוד תזכורות (26) וזמן לצאת (27) ----------
// התזכורת הראשית נשארת בבחירה הרגילה (עם "בוצע" / "עוד 10 דק׳"); אלה תזכורות נוספות לפני האירוע - "יום לפני", "שעה לפני"...
// אירוע בלי שעה (כל היום) - התזכורות נספרות מ-09:00 של אותו יום. זמן לצאת: התראה "הגיע הזמן לצאת" X דקות לפני (send-due-reminders)
const CALX_REM_CHOICES = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
const CALX_TRAVEL_CHOICES = [10, 15, 20, 30, 45, 60, 90];
const CALX_REM_MAX = 5;
function calxFmtDur(min) {
    if (min >= 10080 && min % 10080 === 0) return calFmtUnit(min / 10080, 'week');
    return calFmtMinutes(min);
}
function calxFmtBefore(min) { return min ? t('calx_rem_before').replace('{t}', calxFmtDur(min)) : t('calx_rem_at'); }
function calxRemsRender() {
    const box = document.getElementById('calx-rems');
    if (box) {
        box.innerHTML = calxM.rems.map((m, i) => `<span class="calx-chip calx-rem-chip on"><span>${calxEsc(calxFmtBefore(m))}</span><button type="button" class="calx-rem-x" data-calx-rem-rm="${i}" aria-label="${calxEsc(t('delete_btn') || '✕')}">✕</button></span>`).join('')
            + (calxM.rems.length < CALX_REM_MAX ? `<button type="button" class="calx-chip" data-calx-rem-add>＋ ${calxEsc(t('calx_rem_add'))}</button>` : '');
        box.querySelectorAll('[data-calx-rem-rm]').forEach(b => b.addEventListener('click', () => { calxM.rems.splice(Number(b.dataset.calxRemRm), 1); calxRemsRender(); }));
        box.querySelector('[data-calx-rem-add]')?.addEventListener('click', () => calxOpenRemPicker('rem'));
    }
    const leave = document.getElementById('calx-leave');
    if (leave) {
        leave.innerHTML = calxM.travel
            ? `<span class="calx-chip calx-rem-chip on"><span>${calxEsc(t('calx_leave_label').replace('{t}', calxFmtDur(calxM.travel)))}</span><button type="button" class="calx-rem-x" data-calx-leave-rm aria-label="${calxEsc(t('delete_btn') || '✕')}">✕</button></span>`
            : `<button type="button" class="calx-chip" data-calx-leave-add>${calxEsc(t('calx_leave_btn'))}</button>`;
        leave.querySelector('[data-calx-leave-rm]')?.addEventListener('click', () => { calxM.travel = 0; calxRemsRender(); });
        leave.querySelector('[data-calx-leave-add]')?.addEventListener('click', () => calxOpenRemPicker('travel'));
    }
}
// בחירה מתוך רשימה + "אחר" (מספר + יחידה) - לפי הכלל: בכל בחירה קבועה יש "אחר" עם הקלדה
let calxRemPickKind = 'rem';
let calxRemUnit = 1;
function calxOpenRemPicker(kind) {
    calxRemPickKind = kind;
    const modal = document.getElementById('modal-calx-rem');
    const list = document.getElementById('calx-rem-list');
    if (!modal || !list) return;
    document.getElementById('calx-rem-title').textContent = t(kind === 'travel' ? 'calx_leave_title' : 'calx_rem_title');
    const choices = kind === 'travel' ? CALX_TRAVEL_CHOICES : CALX_REM_CHOICES.filter(m => !calxM.rems.includes(m));
    list.innerHTML = choices.map(m => `<button type="button" class="calx-chip" data-calx-pick="${m}">${calxEsc(kind === 'travel' ? calxFmtDur(m) : calxFmtBefore(m))}</button>`).join('')
        + `<button type="button" class="calx-chip" data-calx-pick="other">${calxEsc(t('calv_other'))}</button>`;
    const other = document.getElementById('calx-rem-other');
    other.classList.add('hidden');
    document.getElementById('calx-rem-num').value = '';
    calxRemUnit = 1;
    const units = document.getElementById('calx-rem-units');
    units.innerHTML = [[1, t('calx_unit_minutes')], [60, t('calx_unit_hours')], [1440, t('calendar_event_unit_days')]]
        .filter(([u]) => kind !== 'travel' || u !== 1440)
        .map(([u, l]) => `<button type="button" class="calx-chip${u === 1 ? ' on' : ''}" data-calx-unit="${u}" role="radio" aria-checked="${u === 1}">${calxEsc(l)}</button>`).join('');
    units.querySelectorAll('[data-calx-unit]').forEach(b => b.addEventListener('click', () => {
        calxRemUnit = Number(b.dataset.calxUnit);
        units.querySelectorAll('[data-calx-unit]').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-checked', on ? 'true' : 'false'); });
    }));
    list.querySelectorAll('[data-calx-pick]').forEach(b => b.addEventListener('click', () => {
        if (b.dataset.calxPick === 'other') { other.classList.remove('hidden'); document.getElementById('calx-rem-num').focus(); return; }
        calxApplyRemPick(Number(b.dataset.calxPick));
    }));
    modal.classList.add('open');
}
function calxRemOtherSave() {
    const n = parseInt(document.getElementById('calx-rem-num').value, 10);
    const unit = calxRemUnit || 1;
    if (!(n >= 0)) return;
    const max = calxRemPickKind === 'travel' ? 600 : 40320;
    const min = Math.min(n * unit, max);
    if (calxRemPickKind === 'travel' && min < 1) return;
    calxApplyRemPick(min);
}
function calxApplyRemPick(min) {
    if (calxRemPickKind === 'travel') calxM.travel = min;
    else if (!calxM.rems.includes(min) && calxM.rems.length < CALX_REM_MAX) calxM.rems.push(min);
    document.getElementById('modal-calx-rem').classList.remove('open');
    calxRemsRender();
}
function calxToggleAllDay() { calxM.allDay = !calxM.allDay; calxRenderModal(); }
function calxSetBusy(free) { calxM.isFree = !!free; calxRenderModal(); }
function calxOpenEndDate() {
    const input = document.getElementById('calendar-event-end-date-input');
    const start = document.getElementById('calendar-event-date-input')?.value || getLocalDateString();
    if (input && !input.value) input.value = addDaysToDateStr(start, 1);
    openCustomDatePicker(input.value, date => { calxM.endDate = date; calxRenderModal(); });
}
function calxClearEndDate() { calxM.endDate = ''; calxRenderModal(); }
function calxOnTitleInput() { if (!calxM.iconManual) calxRenderModal(); }
function calxPickFiles(input) {
    const list = [...(input.files || [])];
    input.value = '';
    for (const f of list) {
        if (calxM.files.length + calxM.pending.length >= 10) { showAppToast(t('calx_attach_max'), 'error'); break; }
        if (!CALX_FILE_TYPES.includes(f.type)) { showAppToast(t('calx_attach_bad_type'), 'error'); continue; }
        if (f.size > CALX_MAX_FILE) { showAppToast(t('calx_attach_too_big'), 'error'); continue; }
        calxM.pending.push(f);
    }
    calxRenderModal();
}
// אחרי שמירה: מעלים את הקבצים החדשים ומעדכנים את האירוע (או את כל המופעים של סדרה חדשה). מחזיר את הרשימה הסופית
async function calxCommitFiles(ids) {
    if (!ids || !ids.length) return;
    const uploaded = [];
    for (const f of calxM.pending) {
        const r = await calxUploadFile(f);
        if (r) uploaded.push(r); else showAppToast(t('calx_attach_failed'), 'error');
    }
    const finalList = calxM.files.concat(uploaded);
    const changed = uploaded.length || calxM.removed.length;
    if (changed) await supabaseClient.from('calendar_events').update({ attachments: finalList.length ? finalList : null }).in('id', ids);
    for (const p of calxM.removed) await calxDropFileIfUnused(p);
    calxM.pending = [];
    calxM.removed = [];
}

// ---------- בחירת סמל ----------
function calxOpenIconPicker() {
    const box = document.getElementById('calx-icon-grid');
    if (!box) return;
    const title = document.getElementById('calendar-event-title-input')?.value || '';
    const auto = calxSuggestIcon(title);
    box.innerHTML = `<button type="button" class="calx-icon-opt is-wide${!calxM.iconManual ? ' on' : ''}" data-calx-icon="__auto">${auto ? `${calxEsc(auto)} ` : ''}${calxEsc(t('calx_icon_auto'))}</button><button type="button" class="calx-icon-opt is-wide${calxM.iconManual && !calxM.icon ? ' on' : ''}" data-calx-icon="">${calxEsc(t('calx_icon_none'))}</button>`
        + CALX_ICON_CHOICES.map(ic => `<button type="button" class="calx-icon-opt${calxM.iconManual && calxM.icon === ic ? ' on' : ''}" data-calx-icon="${calxEsc(ic)}" aria-label="${calxEsc(ic)}">${calxEsc(ic)}</button>`).join('');
    box.querySelectorAll('[data-calx-icon]').forEach(b => b.addEventListener('click', () => {
        const v = b.dataset.calxIcon;
        if (v === '__auto') { calxM.iconManual = false; calxM.icon = null; } else { calxM.iconManual = true; calxM.icon = v; }
        document.getElementById('modal-calx-icons').classList.remove('open');
        calxRenderModal();
    }));
    document.getElementById('modal-calx-icons').classList.add('open');
}

// ---------- חזרות (21–24) ----------
let calxRec = { weekdays: null, monthMode: 'date', endMode: 'dur', until: '', count: 10 };
function calxRecReset() { calxRec = { weekdays: null, monthMode: 'date', endMode: 'dur', until: '', count: 10 }; }
function calxRecStart() { return document.getElementById('calendar-event-date-input')?.value || getLocalDateString(); }
function calxWeekdayOf(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d).getDay(); }
function calxNthInfo(ds) {
    const [y, m, d] = ds.split('-').map(Number);
    const daysIn = new Date(y, m, 0).getDate();
    const n = Math.ceil(d / 7);
    return { wd: new Date(y, m - 1, d).getDay(), n: d + 7 > daysIn ? 'last' : n };
}
function calxRecUnit() { return document.getElementById('calendar-event-recur-unit')?.value || 'weeks'; }
function calxRecRender() {
    const unit = calxRecUnit();
    const start = calxRecStart();
    const wdBox = document.getElementById('calx-weekdays');
    if (wdBox) {
        wdBox.classList.toggle('hidden', unit !== 'weeks');
        const sel = calxRec.weekdays || [calxWeekdayOf(start)];
        wdBox.innerHTML = [0, 1, 2, 3, 4, 5, 6].map(d => `<button type="button" class="calx-chip calx-wd${sel.includes(d) ? ' on' : ''}" data-calx-wd="${d}" aria-pressed="${sel.includes(d)}" aria-label="${calxEsc(t(dayNameKeys[d]))}">${calxEsc(t(weekdayShortKeys[d]))}</button>`).join('');
        wdBox.querySelectorAll('[data-calx-wd]').forEach(b => b.addEventListener('click', () => {
            const d = Number(b.dataset.calxWd);
            const cur = new Set(calxRec.weekdays || [calxWeekdayOf(calxRecStart())]);
            if (cur.has(d) && cur.size > 1) cur.delete(d); else cur.add(d);
            calxRec.weekdays = [...cur].sort((a, b) => a - b);
            calxRecRender();
        }));
    }
    const mm = document.getElementById('calx-monthmode');
    if (mm) {
        mm.classList.toggle('hidden', unit !== 'months');
        const [, , dd] = start.split('-').map(Number);
        const nth = calxNthInfo(start);
        const nthWord = t(nth.n === 'last' ? 'calx_nth_last' : `calx_nth_${nth.n}`);
        // שם היום באמצע משפט - באות קטנה בשפות שבהן כך כותבים (לא בגרמנית/אנגלית/אינדונזית, ולא כשהוא בתחילת המשפט)
        const tpl = t('calx_mm_nth');
        let wdName = t(dayNameKeys[nth.wd]);
        if (tpl.indexOf('{weekday}') > 0 && ['es', 'fr', 'it', 'pt', 'nl', 'sv', 'nb', 'da', 'fi', 'hu', 'ca', 'ro', 'tr', 'el'].includes(currentLang)) wdName = wdName.toLocaleLowerCase(currentLang);
        mm.innerHTML = `<button type="button" class="calx-chip${calxRec.monthMode === 'date' ? ' on' : ''}" data-calx-mm="date" role="radio" aria-checked="${calxRec.monthMode === 'date'}">${calxEsc(t('calx_mm_date').replace('{d}', dd))}</button><button type="button" class="calx-chip${calxRec.monthMode === 'nth' ? ' on' : ''}" data-calx-mm="nth" role="radio" aria-checked="${calxRec.monthMode === 'nth'}">${calxEsc(tpl.replace('{weekday}', wdName).replace('{nth}', nthWord))}</button>`;
        mm.querySelectorAll('[data-calx-mm]').forEach(b => b.addEventListener('click', () => { calxRec.monthMode = b.dataset.calxMm; calxRecRender(); }));
    }
    // סיום: למשך / עד תאריך / מספר פעמים (בשנתית - ברירת המחדל "מספר פעמים")
    const endRow = document.getElementById('calx-end-row');
    if (endRow) {
        endRow.innerHTML = ['dur', 'until', 'count'].map(k => `<button type="button" class="calx-chip${calxRec.endMode === k ? ' on' : ''}" data-calx-end="${k}" role="radio" aria-checked="${calxRec.endMode === k}">${calxEsc(t('calx_end_' + k))}</button>`).join('');
        endRow.querySelectorAll('[data-calx-end]').forEach(b => b.addEventListener('click', () => {
            calxRec.endMode = b.dataset.calxEnd;
            if (calxRec.endMode === 'until' && !calxRec.until) {
                openCustomDatePicker(addDaysToDateStr(calxRecStart(), 60), date => { calxRec.until = date; calxRecRender(); });
            }
            calxRecRender();
        }));
    }
    document.getElementById('calendar-event-duration-trigger')?.classList.toggle('hidden', calxRec.endMode !== 'dur');
    const until = document.getElementById('calx-end-until');
    if (until) {
        until.classList.toggle('hidden', calxRec.endMode !== 'until');
        until.querySelector('span').textContent = calxRec.until ? t('calx_until_label').replace('{date}', calxFmtShort(calxRec.until)) : t('calx_until_btn');
    }
    const count = document.getElementById('calx-end-count-wrap');
    if (count) {
        count.classList.toggle('hidden', calxRec.endMode !== 'count');
        const inp = document.getElementById('calx-end-count');
        if (inp && document.activeElement !== inp) inp.value = calxRec.count;
    }
}
function calxRecUnitChanged() {
    if (calxRecUnit() === 'years' && calxRec.endMode === 'dur') calxRec.endMode = 'count';
    calxRecRender();
}
function calxPickUntil() { openCustomDatePicker(calxRec.until || addDaysToDateStr(calxRecStart(), 60), date => { calxRec.until = date; calxRecRender(); }); }
function calxCountChanged(v) { const n = parseInt(v, 10); if (n >= 1 && n <= 500) calxRec.count = n; }
// כל התאריכים של הסדרה. עד 500 מופעים
const CALX_REC_MAX = 500;
function calxRecurrenceDates(startStr, unit, interval, durationMonths) {
    const step = Math.max(1, interval || 1);
    const [sy, sm, sd] = startStr.split('-').map(Number);
    let endStr;
    if (calxRec.endMode === 'until' && calxRec.until) endStr = calxRec.until;
    else if (calxRec.endMode === 'count') endStr = null;
    else { const e = new Date(sy, sm - 1, sd); e.setMonth(e.getMonth() + (durationMonths || 3)); endStr = getLocalDateString(e); }
    const maxCount = calxRec.endMode === 'count' ? Math.min(CALX_REC_MAX, calxRec.count || 10) : CALX_REC_MAX;
    // בלי תאריך סוף ("מספר פעמים") - תקרה של 30 שנה לבטיחות
    const hardEnd = endStr || `${sy + 30}-12-31`;
    const out = [];
    const push = ds => { if (ds >= startStr && ds <= hardEnd && out.length < maxCount) out.push(ds); };
    const ymd = (y, m, d) => getLocalDateString(new Date(y, m - 1, d));
    const daysIn = (y, m) => new Date(y, m, 0).getDate();
    if (unit === 'days') {
        for (let i = 0; out.length < maxCount; i += step) { const ds = addDaysToDateStr(startStr, i); if (ds > hardEnd) break; push(ds); }
    } else if (unit === 'weeks') {
        const wds = (calxRec.weekdays && calxRec.weekdays.length ? calxRec.weekdays : [calxWeekdayOf(startStr)]).slice().sort((a, b) => a - b);
        const weekStart = addDaysToDateStr(startStr, -calxWeekdayOf(startStr));
        for (let w = 0; out.length < maxCount; w += step) {
            const ws = addDaysToDateStr(weekStart, w * 7);
            if (ws > hardEnd) break;
            wds.forEach(d => push(addDaysToDateStr(ws, d)));
        }
    } else if (unit === 'months') {
        const nth = calxNthInfo(startStr);
        for (let k = 0; out.length < maxCount; k += step) {
            const base = new Date(sy, sm - 1 + k, 1);
            const y = base.getFullYear(), m = base.getMonth() + 1;
            if (ymd(y, m, 1) > hardEnd) break;
            if (calxRec.monthMode === 'nth') {
                let day;
                if (nth.n === 'last') { day = daysIn(y, m); while (new Date(y, m - 1, day).getDay() !== nth.wd) day--; }
                else { day = 1; while (new Date(y, m - 1, day).getDay() !== nth.wd) day++; day += (nth.n - 1) * 7; if (day > daysIn(y, m)) continue; }
                push(ymd(y, m, day));
            } else {
                push(ymd(y, m, Math.min(sd, daysIn(y, m))));
            }
        }
    } else if (unit === 'years') {
        for (let k = 0; out.length < maxCount; k += step) {
            const y = sy + k;
            if (ymd(y, 1, 1) > hardEnd) break;
            push(ymd(y, sm, Math.min(sd, daysIn(y, sm))));
        }
    }
    return out;
}

// ---------- "הזה והבאים" (25) ----------
let calxScopeResolve = null;
function calxAskScope(kind) {
    return new Promise(resolve => {
        calxScopeResolve = resolve;
        const m = document.getElementById('modal-calx-scope');
        m.querySelector('h3').textContent = t(kind === 'delete' ? 'calx_scope_delete_title' : 'calx_scope_title');
        m.classList.add('open');
    });
}
function calxScopeAnswer(v) {
    document.getElementById('modal-calx-scope').classList.remove('open');
    const r = calxScopeResolve; calxScopeResolve = null;
    if (r) r(v);
}
// עדכון מופע ועוד כל המופעים הבאים בסדרה. אם התאריך זז - כולם זזים באותו מספר ימים
async function calxUpdateFollowing(eventId, fields, newDate) {
    const { data: cur } = await supabaseClient.from('calendar_events').select('id, event_date, end_date, recurrence_group_id').eq('id', eventId).maybeSingle();
    if (!cur || !cur.recurrence_group_id) return 0;
    const { data: rows } = await supabaseClient.from('calendar_events').select('id, event_date, end_date').eq('recurrence_group_id', cur.recurrence_group_id).gte('event_date', cur.event_date);
    const list = rows || [];
    const delta = newDate && newDate !== cur.event_date ? calxDaysBetween(cur.event_date, newDate) : 0;
    const span = fields.end_date ? calxDaysBetween(newDate || cur.event_date, fields.end_date) : null;
    const base = { ...fields };
    delete base.event_date;
    delete base.end_date;
    delete base.attachments;
    if (!delta && span === null) {
        await supabaseClient.from('calendar_events').update({ ...base, end_date: null }).eq('recurrence_group_id', cur.recurrence_group_id).gte('event_date', cur.event_date);
    } else {
        for (let i = 0; i < list.length; i += 20) {
            await Promise.all(list.slice(i, i + 20).map(r => {
                const d = delta ? addDaysToDateStr(r.event_date, delta) : r.event_date;
                return supabaseClient.from('calendar_events').update({ ...base, event_date: d, end_date: span ? addDaysToDateStr(d, span) : null }).eq('id', r.id);
            }));
        }
    }
    return list.length;
}
async function calxDeleteFollowing(eventId) {
    const { data: cur } = await supabaseClient.from('calendar_events').select('id, event_date, recurrence_group_id').eq('id', eventId).maybeSingle();
    if (!cur || !cur.recurrence_group_id) return 0;
    const q = () => supabaseClient.from('calendar_events').select('*').eq('recurrence_group_id', cur.recurrence_group_id).gte('event_date', cur.event_date);
    const { data: deletedRows } = await q();
    await supabaseClient.from('calendar_events').delete().eq('recurrence_group_id', cur.recurrence_group_id).gte('event_date', cur.event_date);
    if (deletedRows && deletedRows.length && typeof calShowUndo === 'function') calShowUndo(t('calv_deleted'), calRestoreEventsFn(deletedRows));
    return (deletedRows || []).length;
}
// כפתור המחיקה בחלון: מופע מסדרה - שואלים "רק את זה / את זה ואת הבאים"
async function calxDeleteFromModal() {
    const id = editingCalendarEventId;
    if (!id) return;
    if (calxM.seriesGroup) {
        const scope = await calxAskScope('delete');
        if (!scope) return;
        closeModal('modal-add-calendar-event');
        resetCalendarEventModal();
        if (scope === 'following') { await calxDeleteFollowing(id); calRefreshAll(); if (selectedCalendarDay) renderSelectedCalendarDay(); return; }
        await deleteSingleSeriesOccurrence(id);
        return;
    }
    deleteCalendarEvent(id);
    closeModal('modal-add-calendar-event');
    resetCalendarEventModal();
}

// ---------- היומנים שלי: ניהול + סינון מהיר ----------
let calxCalsFromModal = false;
let calxNewColor = CALX_COLORS[0];
async function calxOpenCalendars(fromModal) {
    calxCalsFromModal = !!fromModal;
    await calxLoadCalendars();
    calxNewColor = CALX_COLORS[calxCalendars.length % CALX_COLORS.length];
    calxRenderCalendars();
    document.getElementById('modal-calx-cals').classList.add('open');
    setTimeout(() => { if (!calxCalendars.length) document.getElementById('calx-new-cal-name')?.focus(); }, 200);
}
function calxCloseCalendars() {
    document.getElementById('modal-calx-cals').classList.remove('open');
    if (calxCalsFromModal) calxRenderModal();
    calxRenderFilter();
    calRefreshAll();
}
function calxRenderCalendars() {
    const box = document.getElementById('calx-cals-body');
    if (!box) return;
    const used = new Set(calxCalendars.map(c => c.name.trim().toLowerCase()));
    const sugg = CALX_CAL_SUGGEST.map(k => t(k)).filter(n => !used.has(n.trim().toLowerCase()));
    box.innerHTML = `
        <div class="calx-cal-list">${calxCalendars.map(c => `
            <div class="calx-cal-row" style="--calx-c:${calxEsc(c.color)}">
                <button type="button" class="calx-swatch" data-calx-swatch="${calxEsc(c.id)}" aria-label="${calxEsc(t('calx_color'))}"></button>
                <input type="text" class="calx-cal-name" maxlength="60" value="${calxEsc(c.name)}" data-calx-name="${calxEsc(c.id)}" aria-label="${calxEsc(t('calx_cals_title'))}">
                <button type="button" class="calx-eye${c.is_visible === false ? ' is-off' : ''}" data-calx-eye="${calxEsc(c.id)}" aria-pressed="${c.is_visible !== false}" aria-label="${calxEsc(t(c.is_visible === false ? 'calx_cals_hidden' : 'calx_cals_shown'))}" title="${calxEsc(t(c.is_visible === false ? 'calx_cals_hidden' : 'calx_cals_shown'))}">${c.is_visible === false ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 3l18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c5 0 9 6 9 6a15.6 15.6 0 0 1-2.6 3.1M6.3 7.8C4.2 9.3 3 12 3 12s4 6 9 6a8.7 8.7 0 0 0 4-1"/></svg>' : '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.6"/></svg>'}</button>
                <button type="button" class="calx-cal-del" data-calx-del="${calxEsc(c.id)}" aria-label="${calxEsc(t('delete_btn') || '✕')}">${typeof BIN_SVG !== 'undefined' ? BIN_SVG : '✕'}</button>
            </div>
            <div class="calx-palette hidden" data-calx-palette="${calxEsc(c.id)}">${CALX_COLORS.map(col => `<button type="button" class="calx-color${col === c.color ? ' on' : ''}" style="--calx-c:${col}" data-calx-setcolor="${calxEsc(c.id)}|${col}" aria-label="${col}"></button>`).join('')}</div>`).join('')}</div>
        <div class="calx-new-cal">
            <div class="calx-palette">${CALX_COLORS.map(col => `<button type="button" class="calx-color${col === calxNewColor ? ' on' : ''}" style="--calx-c:${col}" data-calx-newcolor="${col}" aria-label="${col}"></button>`).join('')}</div>
            <div class="calx-new-row"><input type="text" id="calx-new-cal-name" maxlength="60" placeholder="${calxEsc(t('calx_cals_add_ph'))}" aria-label="${calxEsc(t('calx_cals_add_ph'))}"><button type="button" class="btn-primary" id="calx-new-cal-btn">${calxEsc(t('calx_cals_add_btn'))}</button></div>
            ${sugg.length ? `<div class="calx-row">${sugg.map(n => `<button type="button" class="calx-chip" data-calx-sugg="${calxEsc(n)}">＋ ${calxEsc(n)}</button>`).join('')}</div>` : ''}
        </div>`;
    box.querySelectorAll('[data-calx-swatch]').forEach(b => b.addEventListener('click', () => box.querySelector(`[data-calx-palette="${b.dataset.calxSwatch}"]`)?.classList.toggle('hidden')));
    box.querySelectorAll('[data-calx-setcolor]').forEach(b => b.addEventListener('click', async () => {
        const [id, col] = b.dataset.calxSetcolor.split('|');
        const c = calxCalendars.find(x => x.id === id); if (c) c.color = col;
        calxRenderCalendars();
        await supabaseClient.from('user_calendars').update({ color: col }).eq('id', id);
    }));
    box.querySelectorAll('[data-calx-name]').forEach(inp => inp.addEventListener('change', async () => {
        const name = inp.value.trim();
        const c = calxCalendars.find(x => x.id === inp.dataset.calxName);
        if (!c || !name) { if (c) inp.value = c.name; return; }
        c.name = name.slice(0, 60);
        await supabaseClient.from('user_calendars').update({ name: c.name }).eq('id', c.id);
    }));
    box.querySelectorAll('[data-calx-eye]').forEach(b => b.addEventListener('click', async () => {
        const c = calxCalendars.find(x => x.id === b.dataset.calxEye); if (!c) return;
        c.is_visible = c.is_visible === false;
        calxRenderCalendars();
        await supabaseClient.from('user_calendars').update({ is_visible: c.is_visible }).eq('id', c.id);
    }));
    box.querySelectorAll('[data-calx-del]').forEach(b => b.addEventListener('click', () => {
        const c = calxCalendars.find(x => x.id === b.dataset.calxDel); if (!c) return;
        document.getElementById('modal-calx-cals').classList.remove('open');
        showDangerConfirm(t('calx_cals_title'), t('calx_cals_delete_confirm').replace('{name}', c.name), async () => {
            await supabaseClient.from('user_calendars').delete().eq('id', c.id);
            calxCalendars = calxCalendars.filter(x => x.id !== c.id);
            if (calxM.calendarId === c.id) calxM.calendarId = null;
            calxRenderFilter();
            calRefreshAll();
            document.getElementById('modal-calx-cals').classList.add('open');
            calxRenderCalendars();
        });
    }));
    box.querySelectorAll('[data-calx-newcolor]').forEach(b => b.addEventListener('click', () => { calxNewColor = b.dataset.calxNewcolor; box.querySelectorAll('[data-calx-newcolor]').forEach(x => x.classList.toggle('on', x === b)); }));
    const add = async (name) => {
        name = String(name || '').trim().slice(0, 60);
        if (!name) return;
        const { data, error } = await supabaseClient.from('user_calendars').insert({ user_id: currentUserId, name, color: calxNewColor, sort_order: calxCalendars.length }).select().maybeSingle();
        if (error || !data) { showAppToast(t('error_adding_item') + (error ? error.message : ''), 'error'); return; }
        calxCalendars.push(data);
        if (calxCalsFromModal) calxM.calendarId = data.id;
        calxNewColor = CALX_COLORS[calxCalendars.length % CALX_COLORS.length];
        calxRenderCalendars();
        calxRenderFilter();
    };
    box.querySelector('#calx-new-cal-btn').addEventListener('click', () => add(box.querySelector('#calx-new-cal-name').value));
    box.querySelector('#calx-new-cal-name').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(e.target.value); } });
    box.querySelectorAll('[data-calx-sugg]').forEach(b => b.addEventListener('click', () => add(b.dataset.calxSugg)));
}
// שורת סינון מהירה מעל היומן (רק כשיש יומנים): נגיעה מסתירה / מציגה
function calxRenderFilter() {
    const row = document.getElementById('calx-filter');
    if (!row) return;
    row.classList.toggle('hidden', !calxCalendars.length);
    row.innerHTML = calxCalendars.map(c => `<button type="button" class="calx-chip calx-filter-chip${c.is_visible === false ? '' : ' on'}" style="--calx-c:${calxEsc(c.color)}" data-calx-filter="${calxEsc(c.id)}" aria-pressed="${c.is_visible !== false}"><i class="calx-dot" aria-hidden="true"></i>${calxEsc(c.name)}</button>`).join('')
        + `<button type="button" class="calx-chip calx-filter-edit" data-calx-filter-edit aria-label="${calxEsc(t('calx_cals_title'))}" title="${calxEsc(t('calx_cals_title'))}">⚙️</button>`;
    row.querySelectorAll('[data-calx-filter]').forEach(b => b.addEventListener('click', async () => {
        const c = calxCalendars.find(x => x.id === b.dataset.calxFilter); if (!c) return;
        c.is_visible = c.is_visible === false;
        calxRenderFilter();
        calRefreshAll();
        await supabaseClient.from('user_calendars').update({ is_visible: c.is_visible }).eq('id', c.id);
    }));
    row.querySelector('[data-calx-filter-edit]')?.addEventListener('click', () => calxOpenCalendars(false));
}
