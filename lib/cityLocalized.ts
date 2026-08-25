/** Localized city names for airports in lib/airportsDb.ts. Display only — catalog `city` stays as-is. */

type CityLang = 'th' | 'ja' | 'ko' | 'zh' | 'ru' | 'fr' | 'ar' | 'pt' | 'tr' | 'hi' | 'ms';
type LocalizedCities = Record<string, Partial<Record<CityLang, string>>>;

function L(
  th: string,
  ja: string,
  ko: string,
  zh: string,
  ru: string,
  fr: string,
  ar: string,
  pt: string,
  tr: string,
  hi: string,
  ms: string,
) {
  return { th, ja, ko, zh, ru, fr, ar, pt, tr, hi, ms };
}

const AMSTERDAM = L('อัมสเตอร์ดัม', 'アムステルダム', '암스테르담', '阿姆斯特丹', 'Амстердам', "Amsterdam", "أمستردام", "Amesterdão", "Amsterdam", "एम्स्टर्डम", "Amsterdam");
const ROTTERDAM = L('รอตเทอร์ดัม', 'ロッテルダム', '로테르담', '鹿特丹', 'Роттердам', "Rotterdam", "روتردام", "Roterdão", "Rotterdam", "रॉटरडैम", "Rotterdam");
const EINDHOVEN = L('ไอนด์โฮเฟน', 'アイントホーフェン', '에인트호번', '埃因霍温', 'Эйндховен', "Eindhoven", "آيندهوفن", "Eindhoven", "Eindhoven", "आइंडहोवन", "Eindhoven");
const BRUSSELS = L('บรัสเซลส์', 'ブリュッセル', '브뤼셀', '布鲁塞尔', 'Брюссель', "Bruxelles", "بروكسل", "Bruxelas", "Brüksel", "ब्रुसेल्स", "Brussels");
const CHARLEROI = L('ชาร์เลอรัว', 'シャルルロワ', '샤를루아', '沙勒罗瓦', 'Шарлеруа', "Charleroi", "شارلروا", "Charleroi", "Charleroi", "शार्लरुआ", "Charleroi");
const FRANKFURT = L('แฟรงก์เฟิร์ต', 'フランクフルト', '프랑크푸르트', '法兰克福', 'Франкфурт', "Francfort", "فرانكفورت", "Francoforte", "Frankfurt", "फ्रैंकफर्ट", "Frankfurt");
const MUNICH = L('มิวนิก', 'ミュンヘン', '뮌헨', '慕尼黑', 'Мюнхен', "Munich", "ميونخ", "Munique", "Münih", "म्यूनिख", "Munich");
const BERLIN = L('เบอร์ลิน', 'ベルリン', '베를린', '柏林', 'Берлин', "Berlin", "برلين", "Berlim", "Berlin", "बर्लिन", "Berlin");
const DUSSELDORF = L('ดุสเซลดอร์ฟ', 'デュッセルドルフ', '뒤셀도르프', '杜塞尔多夫', 'Дюссельдорф', "Düsseldorf", "دوسلدورف", "Düsseldorf", "Düsseldorf", "ड्यूसलडोर्फ", "Düsseldorf");
const HAMBURG = L('ฮัมบูร์ก', 'ハンブルク', '함부르크', '汉堡', 'Гамбург', "Hambourg", "هامبورغ", "Hamburgo", "Hamburg", "हैम्बर्ग", "Hamburg");
const COLOGNE = L('โคโลญ', 'ケルン', '쾰른', '科隆', 'Кёльн', "Cologne", "كولونيا", "Colónia", "Köln", "कोलोन", "Cologne");
const STUTTGART = L('สตุตการ์ท', 'シュトゥットガルト', '슈투트가르트', '斯图加特', 'Штутгарт', "Stuttgart", "شتوتغارت", "Estugarda", "Stuttgart", "स्टटगार्ट", "Stuttgart");
const PARIS = L('ปารีส', 'パリ', '파리', '巴黎', 'Париж', "Paris", "باريس", "Paris", "Paris", "पेरिस", "Paris");
const NICE = L('นีซ', 'ニース', '니스', '尼斯', 'Ницца', "Nice", "نيس", "Nice", "Nice", "नीस", "Nice");
const LYON = L('ลียง', 'リヨン', '리옹', '里昂', 'Лион', "Lyon", "ليون", "Lyon", "Lyon", "लियोन", "Lyon");
const MARSEILLE = L('มาร์เซย', 'マルセイユ', '마르세유', '马赛', 'Марсель', "Marseille", "مارسيليا", "Marselha", "Marsilya", "मार्सेय", "Marseille");
const LONDON = L('ลอนดอน', 'ロンドン', '런던', '伦敦', 'Лондон', "Londres", "لندن", "Londres", "Londra", "लंदन", "London");
const MANCHESTER = L('แมนเชสเตอร์', 'マンチェスター', '맨체스터', '曼彻斯特', 'Манчестер', "Manchester", "مانشستر", "Manchester", "Manchester", "मैनचेस्टर", "Manchester");
const EDINBURGH = L('เอดินบะระ', 'エディンバラ', '에든버러', '爱丁堡', 'Эдинбург', "Édimbourg", "إدنبرة", "Edimburgo", "Edinburgh", "एडिनबरा", "Edinburgh");
const DUBLIN = L('ดับลิน', 'ダブリン', '더블린', '都柏林', 'Дублин', "Dublin", "دبلن", "Dublin", "Dublin", "डबलिन", "Dublin");
const MADRID = L('มาดริด', 'マドリード', '마드리드', '马德里', 'Мадрид', "Madrid", "مدريد", "Madrid", "Madrid", "मैड्रिड", "Madrid");
const BARCELONA = L('บาร์เซโลนา', 'バルセロナ', '바르셀로나', '巴塞罗那', 'Барселона', "Barcelone", "برشلونة", "Barcelona", "Barselona", "बार्सिलोना", "Barcelona");
const MALAGA = L('มาลากา', 'マラガ', '말라가', '马拉加', 'Малага', "Malaga", "مالقة", "Málaga", "Malaga", "मलागा", "Malaga");
const PALMA = L('ปัลมา', 'パルマ', '팔마', '帕尔马', 'Пальма', "Palma", "بالما", "Palma", "Palma", "पाल्मा", "Palma");
const LISBON = L('ลิสบอน', 'リスボン', '리스본', '里斯本', 'Лиссабон', "Lisbonne", "لشبونة", "Lisboa", "Lizbon", "लिस्बन", "Lisbon");
const PORTO = L('ปอร์โต', 'ポルト', '포르투', '波尔图', 'Порту', "Porto", "بورتو", "Porto", "Porto", "पोर्टो", "Porto");
const ROME = L('โรม', 'ローマ', '로마', '罗马', 'Рим', "Rome", "روما", "Roma", "Roma", "रोम", "Rome");
const MILAN = L('มิลาน', 'ミラノ', '밀라노', '米兰', 'Милан', "Milan", "ميلانو", "Milão", "Milano", "मिलान", "Milan");
const VENICE = L('เวนิส', 'ベネチア', '베네치아', '威尼斯', 'Венеция', "Venise", "البندقية", "Veneza", "Venedik", "वेनिस", "Venice");
const NAPLES = L('เนเปิลส์', 'ナポリ', '나폴리', '那不勒斯', 'Неаполь', "Naples", "نابولي", "Nápoles", "Napoli", "नेपल्स", "Naples");
const ZURICH = L('ซูริก', 'チューリッヒ', '취리히', '苏黎世', 'Цюрих', "Zurich", "زيورخ", "Zurique", "Zürih", "ज़्यूरिख", "Zurich");
const GENEVA = L('เจนีวา', 'ジュネーヴ', '제네바', '日内瓦', 'Женева', "Genève", "جنيف", "Genebra", "Cenevre", "जेनेवा", "Geneva");
const VIENNA = L('เวียนนา', 'ウィーン', '빈', '维也纳', 'Вена', "Vienne", "فيينا", "Viena", "Viyana", "वियना", "Vienna");
const WARSAW = L('วอร์ซอ', 'ワルシャワ', '바르샤바', '华沙', 'Варшава', "Varsovie", "وارسو", "Varsóvia", "Varşova", "वारसॉ", "Warsaw");
const STOCKHOLM = L('สตอกโฮล์ม', 'ストックホルム', '스톡홀름', '斯德哥尔摩', 'Стокгольм', "Stockholm", "ستوكهولم", "Estocolmo", "Stokholm", "स्टॉकहोम", "Stockholm");
const OSLO = L('ออสโล', 'オスロ', '오슬로', '奥斯陆', 'Осло', "Oslo", "أوسلو", "Oslo", "Oslo", "ओस्लो", "Oslo");
const COPENHAGEN = L('โคเปนเฮเกน', 'コペンハーゲン', '코펜하겐', '哥本哈根', 'Копенгаген', "Copenhague", "كوبنهاغن", "Copenhaga", "Kopenhag", "कोपेनहेगन", "Copenhagen");
const HELSINKI = L('เฮลซิงกิ', 'ヘルシンキ', '헬싱키', '赫尔辛基', 'Хельсинки', "Helsinki", "هلسنكي", "Helsínquia", "Helsinki", "हेलसिंकी", "Helsinki");
const ATHENS = L('เอเธนส์', 'アテネ', '아테네', '雅典', 'Афины', "Athènes", "أثينا", "Atenas", "Atina", "एथेंस", "Athens");
const PRAGUE = L('ปราก', 'プラハ', '프라하', '布拉格', 'Прага', "Prague", "براغ", "Praga", "Prag", "प्राग", "Prague");
const BUDAPEST = L('บูดาเปสต์', 'ブダペスト', '부다페스트', '布达佩斯', 'Будапешт', "Budapest", "بودابست", "Budapeste", "Budapeşte", "बुडापेस्ट", "Budapest");
const BUCHAREST = L('บูคาเรสต์', 'ブカレスト', '부쿠레슈티', '布加勒斯特', 'Бухарест', "Bucarest", "بوخارست", "Bucareste", "Bükreş", "बुखारेस्ट", "Bucharest");
const ISTANBUL = L('อิสตันบูล', 'イスタンブール', '이스탄불', '伊斯坦布尔', 'Стамбул', "Istanbul", "إسطنبول", "Istambul", "İstanbul", "इस्तांबुल", "Istanbul");
const ANTALYA = L('อันตัลยา', 'アンタルヤ', '안탈리아', '安塔利亚', 'Анталья', "Antalya", "أنطاليا", "Antália", "Antalya", "अंताल्या", "Antalya");
const MOSCOW = L('มอสโก', 'モスクワ', '모스크바', '莫斯科', 'Москва', "Moscou", "موسكو", "Moscovo", "Moskova", "मास्को", "Moscow");
const KYIV = L('เคียฟ', 'キーウ', '키이우', '基辅', 'Киев', "Kiev", "كييف", "Kiev", "Kiev", "कीव", "Kyiv");
const REYKJAVIK = L('เรคยาวิก', 'レイキャヴィーク', '레이캬비크', '雷克雅未克', 'Рейкьявик', "Reykjavik", "ريكيافيك", "Reiquiavique", "Reykjavik", "रेक्जाविक", "Reykjavik");
const LUXEMBOURG = L('ลักเซมเบิร์ก', 'ルクセンブルク', '룩셈부르크', '卢森堡', 'Люксембург', "Luxembourg", "لوكسمبورغ", "Luxemburgo", "Lüksemburg", "लक्ज़मबर्ग", "Luxembourg");
const ZAGREB = L('ซาเกร็บ', 'ザグレブ', '자그레브', '萨格勒布', 'Загреб', "Zagreb", "زغرب", "Zagreb", "Zagreb", "ज़ाग्रेब", "Zagreb");
const BELGRADE = L('เบลเกรด', 'ベオグラード', '베오그라드', '贝尔格莱德', 'Белград', "Belgrade", "بلغراد", "Belgrado", "Belgrad", "बेलग्रेड", "Belgrade");
const SOFIA = L('โซเฟีย', 'ソフィア', '소피아', '索非亚', 'София', "Sofia", "صوفيا", "Sófia", "Sofya", "सोफिया", "Sofia");
const LARNACA = L('ลาร์นากา', 'ラルナカ', '라르나카', '拉纳卡', 'Ларнака', "Larnaca", "لارنكا", "Lárnaca", "Larnaka", "लारनाका", "Larnaca");
const VALLETTA = L('วัลเลตตา', 'バレッタ', '발레타', '瓦莱塔', 'Валлетта', "La Valette", "فاليتا", "Valeta", "Valletta", "वैलेटा", "Valletta");
const TALLINN = L('ทาลลินน์', 'タリン', '탈린', '塔林', 'Таллин', "Tallinn", "تالين", "Taline", "Tallinn", "टैलिन", "Tallinn");
const RIGA = L('ริกา', 'リガ', '리가', '里加', 'Рига', "Riga", "ريغا", "Riga", "Riga", "रीगा", "Riga");
const VILNIUS = L('วิลนีอุส', 'ヴィリニュス', '빌뉴스', '维尔纽斯', 'Вильнюс', "Vilnius", "فيلنيوس", "Vilnius", "Vilnius", "विल्नियस", "Vilnius");
const BRATISLAVA = L('บราติสลาวา', 'ブラチスラヴァ', '브라티슬라바', '布拉迪斯拉发', 'Братислава', "Bratislava", "براتيسلافا", "Bratislava", "Bratislava", "ब्रातिस्लावा", "Bratislava");
const LJUBLJANA = L('ลูบลิยานา', 'リュブリャナ', '류블랴나', '卢布尔雅那', 'Любляна', "Ljubljana", "ليوبليانا", "Liubliana", "Ljubljana", "लुब्लियाना", "Ljubljana");
const TBILISI = L('ทบิลิซี', 'トビリシ', '트빌리시', '第比利斯', 'Тбилиси', "Tbilissi", "تبليسي", "Tbilisi", "Tiflis", "त्बिलिसी", "Tbilisi");
const BAKU = L('บากู', 'バクー', '바쿠', '巴库', 'Баку', "Bakou", "باكو", "Bacu", "Bakü", "बाकू", "Baku");
const ASTANA = L('อัสตานา', 'アスタナ', '아스타나', '阿斯塔纳', 'Астана', "Astana", "أستانا", "Astana", "Astana", "अस्ताना", "Astana");
const TASHKENT = L('ทาชเคนต์', 'タシュケント', '타슈켄트', '塔什干', 'Ташкент', "Tachkent", "طشقند", "Tasquente", "Taşkent", "ताशकंद", "Tashkent");
const ULAANBAATAR = L('อูลานบาตอร์', 'ウランバートル', '울란바토르', '乌兰巴托', 'Улан-Батор', "Oulan-Bator", "أولان باتور", "Ulan Bator", "Ulan Bator", "उलानबटार", "Ulaanbaatar");

const BANGKOK = L('กรุงเทพฯ', 'バンコク', '방콕', '曼谷', 'Бангкок', "Bangkok", "بانكوك", "Banguecoque", "Bangkok", "बैंकॉक", "Bangkok");
const PHUKET = L('ภูเก็ต', 'プーケット', '푸켓', '普吉', 'Пхукет', "Phuket", "فوكيت", "Phuket", "Phuket", "फुकेत", "Phuket");
const CHIANG_MAI = L('เชียงใหม่', 'チェンマイ', '치앙마이', '清迈', 'Чиангмай', "Chiang Mai", "شيانغ ماي", "Chiang Mai", "Chiang Mai", "चियांग माई", "Chiang Mai");
const KOH_SAMUI = L('เกาะสมุย', 'サムイ', '코사무이', '苏梅', 'Самуи', "Ko Samui", "كو ساموي", "Ko Samui", "Ko Samui", "को सामुई", "Koh Samui");
const KRABI = L('กระบี่', 'クラビ', '크라비', '甲米', 'Краби', "Krabi", "كرابي", "Krabi", "Krabi", "क्राबी", "Krabi");
const HAT_YAI = L('หาดใหญ่', 'ハートヤイ', '핫야이', '合艾', 'Хатъяй', "Hat Yai", "هات ياي", "Hat Yai", "Hat Yai", "हाट याई", "Hat Yai");
const PATTAYA = L('พัทยา', 'パタヤ', '파타야', '芭提雅', 'Паттайя', "Pattaya", "باتايا", "Pattaya", "Pattaya", "पट्टया", "Pattaya");
const CHIANG_RAI = L('เชียงราย', 'チエンラーイ', '치앙라이', '清莱', 'Чианграй', "Chiang Rai", "شيانغ راي", "Chiang Rai", "Chiang Rai", "चियांग राई", "Chiang Rai");
const KHON_KAEN = L('ขอนแก่น', 'コーンケン', '콘깬', '孔敬', 'Кхонкэн', "Khon Kaen", "خون كاين", "Khon Kaen", "Khon Kaen", "खोन काएन", "Khon Kaen");
const SUKHOTHAI = L('สุโขทัย', 'スコータイ', '수코타이', '素可泰', 'Сукхотхай', "Sukhothai", "سوخوثاي", "Sukhothai", "Sukhothai", "सुखोथाई", "Sukhothai");
const TRAT = L('ตราด', 'トラート', '뜨랏', '达叻', 'Трат', "Trat", "ترات", "Trat", "Trat", "त्रात", "Trat");
const UDON_THANI = L('อุดรธานี', 'ウドーンターニー', '우돈타니', '乌隆', 'Удонтхани', "Udon Thani", "أودون ثاني", "Udon Thani", "Udon Thani", "उदोन थानी", "Udon Thani");
const UBON = L('อุบลราชธานี', 'ウボンラーチャターニー', '우본랏차타니', '乌汶', 'Убонратчатхани', "Ubon Ratchathani", "أوبون راتشاثاني", "Ubon Ratchathani", "Ubon Ratchathani", "उबोन रात्चाथानी", "Ubon Ratchathani");
const SINGAPORE = L('สิงคโปร์', 'シンガポール', '싱가포르', '新加坡', 'Сингапур', "Singapour", "سنغافورة", "Singapura", "Singapur", "सिंगापुर", "Singapura");
const KUALA_LUMPUR = L('กัวลาลัมเปอร์', 'クアラルンプール', '쿠알라룸푸르', '吉隆坡', 'Куала-Лумпур', "Kuala Lumpur", "كوالالمبور", "Kuala Lumpur", "Kuala Lumpur", "कुआलालंपुर", "Kuala Lumpur");
const PENANG = L('ปีนัง', 'ペナン', '페낭', '槟城', 'Пенанг', "Penang", "بينانغ", "Penang", "Penang", "पेनांग", "Pulau Pinang");
const KOTA_KINABALU = L('โกตาคินาบาลู', 'コタキナバル', '코타키나발루', '亚庇', 'Кота-Кинабалу', "Kota Kinabalu", "كوتا كينابالو", "Kota Kinabalu", "Kota Kinabalu", "कोटा किनाबालु", "Kota Kinabalu");
const JAKARTA = L('จาการ์ตา', 'ジャカルタ', '자카르타', '雅加达', 'Джакарта', "Jakarta", "جاكرتا", "Jacarta", "Cakarta", "जकार्ता", "Jakarta");
const DENPASAR = L('เดนปาซาร์', 'デンパサール', '덴파사르', '登巴萨', 'Денпасар', "Denpasar", "دنباسار", "Denpasar", "Denpasar", "देनपसार", "Denpasar");
const SURABAYA = L('สุราบายา', 'スラバヤ', '수라바야', '泗水', 'Сурабая', "Surabaya", "سورابايا", "Surabaya", "Surabaya", "सुराबाया", "Surabaya");
const HO_CHI_MINH = L('โฮจิมินห์', 'ホーチミン', '호찌민', '胡志明市', 'Хошимин', "Hô Chi Minh-Ville", "هو تشي منه", "Cidade de Ho Chi Minh", "Ho Chi Minh", "हो ची मिन्ह", "Ho Chi Minh");
const HANOI = L('ฮานอย', 'ハノイ', '하노이', '河内', 'Ханой', "Hanoï", "هانوي", "Hanói", "Hanoi", "हनोई", "Hanoi");
const DA_NANG = L('ดานัง', 'ダナン', '다낭', '岘港', 'Дананг', "Đà Nẵng", "دا نانغ", "Da Nang", "Da Nang", "दा नांग", "Da Nang");
const PHNOM_PENH = L('พนมเปญ', 'プノンペン', '프놈펜', '金边', 'Пномпень', "Phnom Penh", "بنوم بنه", "Phnom Penh", "Phnom Penh", "नॉम पेन्ह", "Phnom Penh");
const SIEM_REAP = L('เสียมราฐ', 'シェムリアップ', '시엠레아프', '暹粒', 'Сиемреап', "Siem Reap", "سيم رياب", "Siem Reap", "Siem Reap", "सिएम रिएप", "Siem Reap");
const VIENTIANE = L('เวียงจันทน์', 'ビエンチャン', '비엔티안', '万象', 'Вьентьян', "Vientiane", "فيينتيان", "Vientiane", "Vientiane", "वियंतियान", "Vientiane");
const YANGON = L('ย่างกุ้ง', 'ヤンゴン', '양곤', '仰光', 'Янгон', "Rangoun", "يانغون", "Yangon", "Yangon", "यांगून", "Yangon");
const MANILA = L('มะนิลา', 'マニラ', '마닐라', '马尼拉', 'Манила', "Manille", "مانيلا", "Manila", "Manila", "मनीला", "Manila");
const CEBU = L('เซบู', 'セブ', '세부', '宿务', 'Себу', "Cebu", "سيبو", "Cebu", "Cebu", "सेबू", "Cebu");
const BANDAR = L('บันดาร์เสรีเบกาวัน', 'バンダルスリブガワン', '반다르스리브가완', '斯里巴加湾', 'Бандар-Сери-Бегаван', "Bandar Seri Begawan", "بندر سري بكاوان", "Bandar Seri Begawan", "Bandar Seri Begawan", "बंदर सेरी बेगवान", "Bandar Seri Begawan");

const BEIJING = L('ปักกิ่ง', '北京', '베이징', '北京', 'Пекин', "Pékin", "بكين", "Pequim", "Pekin", "बीजिंग", "Beijing");
const SHANGHAI = L('เซี่ยงไฮ้', '上海', '상하이', '上海', 'Шанхай', "Shanghai", "شنغهاي", "Xangai", "Şanghay", "शंघाई", "Shanghai");
const GUANGZHOU = L('กว่างโจว', '広州', '광저우', '广州', 'Гуанчжоу', "Canton", "قوانغتشو", "Cantão", "Guangzhou", "गुआंगझोउ", "Guangzhou");
const SHENZHEN = L('เซินเจิ้น', '深圳', '선전', '深圳', 'Шэньчжэнь', "Shenzhen", "شنتشن", "Shenzhen", "Shenzhen", "शेनझेन", "Shenzhen");
const HONG_KONG = L('ฮ่องกง', '香港', '홍콩', '香港', 'Гонконг', "Hong Kong", "هونغ كونغ", "Hong Kong", "Hong Kong", "हांगकांग", "Hong Kong");
const TAIPEI = L('ไทเป', '台北', '타이베이', '台北', 'Тайбэй', "Taipei", "تايبيه", "Taipé", "Taipei", "ताइपेई", "Taipei");
const MACAU = L('มาเก๊า', 'マカオ', '마카오', '澳门', 'Макао', "Macao", "ماكاو", "Macau", "Makao", "मकाऊ", "Macau");
const TOKYO = L('โตเกียว', '東京', '도쿄', '东京', 'Токио', "Tokyo", "طوكيو", "Tóquio", "Tokyo", "टोक्यो", "Tokyo");
const OSAKA = L('โอซาก้า', '大阪', '오사카', '大阪', 'Осака', "Osaka", "أوساكا", "Osaka", "Osaka", "ओसाका", "Osaka");
const SAPPORO = L('ซัปโปโร', '札幌', '삿포로', '札幌', 'Саппоро', "Sapporo", "سابورو", "Sapporo", "Sapporo", "सप्पोरो", "Sapporo");
const FUKUOKA = L('ฟูกูโอกะ', '福岡', '후쿠오카', '福冈', 'Фукуока', "Fukuoka", "فوكوكا", "Fukuoka", "Fukuoka", "फुकुओका", "Fukuoka");
const SEOUL = L('โซล', 'ソウル', '서울', '首尔', 'Сеул', "Séoul", "سيول", "Seul", "Seul", "सियोल", "Seoul");
const DELHI = L('นิวเดลี', 'ニューデリー', '뉴델리', '新德里', 'Нью-Дели', "New Delhi", "نيودلهي", "Nova Deli", "Yeni Delhi", "नई दिल्ली", "New Delhi");
const MUMBAI = L('มุมไบ', 'ムンバイ', '뭄바이', '孟买', 'Мумбаи', "Bombay", "مومباي", "Bombaim", "Mumbai", "मुंबई", "Mumbai");
const BENGALURU = L('เบงกาลูรู', 'ベンガルール', '벵갈루루', '班加罗尔', 'Бенгалуру', "Bangalore", "بنغالور", "Bengaluru", "Bengaluru", "बेंगलुरु", "Bengaluru");
const CHENNAI = L('เชนไน', 'チェンナイ', '첸나이', '金奈', 'Ченнаи', "Chennai", "تشيناي", "Chennai", "Chennai", "चेन्नई", "Chennai");
const KOLKATA = L('โกลกาตา', 'コルカタ', '콜카타', '加尔各答', 'Калькутта', "Calcutta", "كلكتا", "Calcutá", "Kalküta", "कोलकाता", "Kolkata");
const HYDERABAD = L('ไฮเดอราบัด', 'ハイデラバード', '하이데라바드', '海得拉巴', 'Хайдарабад', "Hyderabad", "حيدر آباد", "Hiderabade", "Haydarabad", "हैदराबाद", "Hyderabad");
const ISLAMABAD = L('อิสลามาบัด', 'イスラマバード', '이슬라마바드', '伊斯兰堡', 'Исламабад', "Islamabad", "إسلام آباد", "Islamabade", "İslamabad", "इस्लामाबाद", "Islamabad");
const KARACHI = L('การาจี', 'カラチ', '카라치', '卡拉奇', 'Карачи', "Karachi", "كراتشي", "Carachi", "Karaçi", "कराची", "Karachi");
const DHAKA = L('ธากา', 'ダッカ', '다카', '达卡', 'Дакка', "Dacca", "دكا", "Daca", "Dakka", "ढाका", "Dhaka");
const COLOMBO = L('โคลัมโบ', 'コロンボ', '콜롬보', '科伦坡', 'Коломбо', "Colombo", "كولومبو", "Colombo", "Kolombo", "कोलंबो", "Colombo");
const KATHMANDU = L('กาฐมาณฑุ', 'カトマンズ', '카트만두', '加德满都', 'Катманду', "Katmandou", "كاتماندو", "Catmandu", "Katmandu", "काठमांडू", "Kathmandu");
const MALE = L('มาเล', 'マレ', '말레', '马累', 'Мале', "Malé", "ماليه", "Malé", "Male", "माले", "Male");

const DUBAI = L('ดูไบ', 'ドバイ', '두바이', '迪拜', 'Дубай', "Dubaï", "دبي", "Dubai", "Dubai", "दुबई", "Dubai");
const ABU_DHABI = L('อาบูดาบี', 'アブダビ', '아부다비', '阿布扎比', 'Абу-Даби', "Abou Dabi", "أبوظبي", "Abu Dhabi", "Abu Dabi", "अबू धाबी", "Abu Dhabi");
const DOHA = L('โดฮา', 'ドーハ', '도하', '多哈', 'Доха', "Doha", "الدوحة", "Doha", "Doha", "दोहा", "Doha");
const RIYADH = L('ริยาด', 'リヤド', '리야드', '利雅得', 'Эр-Рияд', "Riyad", "الرياض", "Riade", "Riyad", "रियाद", "Riyadh");
const JEDDAH = L('เจดดาห์', 'ジッダ', '제다', '吉达', 'Джидда', "Djeddah", "جدة", "Jidá", "Cidde", "जेद्दा", "Jeddah");
const MANAMA = L('มานามา', 'マナーマ', '마나마', '麦纳麦', 'Манама', "Manama", "المنامة", "Manama", "Manama", "मनामा", "Manama");
const MUSCAT = L('มัสกัต', 'マスカット', '무스카트', '马斯喀特', 'Маскат', "Mascate", "مسقط", "Mascate", "Maskat", "मस्कट", "Muscat");
const KUWAIT = L('คูเวต', 'クウェート', '쿠웨이트', '科威特', 'Эль-Кувейт', "Koweït", "الكويت", "Kuwait", "Kuveyt", "कुवैत", "Kuwait");
const TEL_AVIV = L('เทลอาวีฟ', 'テルアビブ', '텔아비브', '特拉维夫', 'Тель-Авив', "Tel Aviv", "تل أبيب", "Tel Aviv", "Tel Aviv", "तेल अवीव", "Tel Aviv");
const AMMAN = L('อัมมาน', 'アンマン', '암만', '安曼', 'Амман', "Amman", "عمّان", "Amã", "Amman", "अम्मान", "Amman");
const TEHRAN = L('เตหะราน', 'テヘラン', '테헤란', '德黑兰', 'Тегеран', "Téhéran", "طهران", "Teerão", "Tahran", "तेहरान", "Tehran");
const BAGHDAD = L('แบกแดด', 'バグダード', '바그다드', '巴格达', 'Багдад', "Bagdad", "بغداد", "Bagdade", "Bağdat", "बगदाद", "Baghdad");
const BEIRUT = L('เบรุต', 'ベイルート', '베이루트', '贝鲁特', 'Бейрут', "Beyrouth", "بيروت", "Beirute", "Beyrut", "बेरूत", "Beirut");

const CAIRO = L('ไคโร', 'カイロ', '카이로', '开罗', 'Каир', "Le Caire", "القاهرة", "Cairo", "Kahire", "काहिरा", "Cairo");
const JOHANNESBURG = L('โจฮันเนสเบิร์ก', 'ヨハネスブルク', '요하네스버그', '约翰内斯堡', 'Йоханнесбург', "Johannesburg", "جوهانسبرغ", "Joanesburgo", "Johannesburg", "जोहान्सबर्ग", "Johannesburg");
const CAPE_TOWN = L('เคปทาวน์', 'ケープタウン', '케이프타운', '开普敦', 'Кейптаун', "Le Cap", "كيب تاون", "Cidade do Cabo", "Cape Town", "केप टाउन", "Cape Town");
const NAIROBI = L('ไนโรบี', 'ナイロビ', '나이로비', '内罗毕', 'Найроби', "Nairobi", "نيروبي", "Nairóbi", "Nairobi", "नैरोबी", "Nairobi");
const CASABLANCA = L('คาซาบลังกา', 'カサブランカ', '카사블랑카', '卡萨布兰卡', 'Касабланка', "Casablanca", "الدار البيضاء", "Casablanca", "Kazablanka", "कासाब्लांका", "Casablanca");
const LAGOS = L('ลากอส', 'ラゴス', '라고스', '拉各斯', 'Лагос', "Lagos", "لاغوس", "Lagos", "Lagos", "लागोस", "Lagos");
const DAR_ES_SALAAM = L('ดาร์เอสซาลาม', 'ダルエスサラーム', '다르에스살람', '达累斯萨拉姆', 'Дар-эс-Салам', "Dar es Salam", "دار السلام", "Dar es Salaam", "Darüsselam", "दार अस सलाम", "Dar es Salaam");
const ADDIS_ABABA = L('แอดดิสอาบาบา', 'アディスアベバ', '아디스아바바', '亚的斯亚贝巴', 'Аддис-Абеба', "Addis-Abeba", "أديس أبابا", "Adis Abeba", "Addis Ababa", "अदीस अबाबा", "Addis Ababa");
const ACCRA = L('อักกรา', 'アクラ', '아크라', '阿克拉', 'Аккра', "Accra", "أكرا", "Acra", "Akra", "अकरा", "Accra");
const TUNIS = L('ตูนิส', 'チュニス', '튀니스', '突尼斯', 'Тунис', "Tunis", "تونس", "Tunes", "Tunus", "ट्यूनिस", "Tunis");
const ALGIERS = L('แอลเจียร์', 'アルジェ', '알제', '阿尔及尔', 'Алжир', "Alger", "الجزائر", "Argel", "Cezayir", "अल्जीयर्स", "Algiers");
const DAKAR = L('ดาการ์', 'ダカール', '다카르', '达喀尔', 'Дакар', "Dakar", "داكار", "Dacar", "Dakar", "डाकार", "Dakar");
const PORT_LOUIS = L('พอร์ตลูอิส', 'ポートルイス', '포트루이스', '路易港', 'Порт-Луи', "Port-Louis", "بورت لويس", "Port Louis", "Port Louis", "पोर्ट लुई", "Port Louis");
const VICTORIA = L('วิกตอเรีย', 'ビクトリア', '빅토리아', '维多利亚', 'Виктория', "Victoria", "فيكتوريا", "Vitória", "Victoria", "विक्टोरिया", "Victoria");
const KIGALI = L('คิกาลี', 'キガリ', '키갈리', '基加利', 'Кигали', "Kigali", "كيغالي", "Kigali", "Kigali", "किगाली", "Kigali");
const KAMPALA = L('กัมปาลา', 'カンパラ', '캄팔라', '坎帕拉', 'Кампала', "Kampala", "كامبالا", "Kampala", "Kampala", "कंपाला", "Kampala");
const WINDHOEK = L('วินด์ฮุก', 'ウィントフック', '빈트후크', '温得和克', 'Виндхук', "Windhoek", "ويندهوك", "Windhoek", "Windhoek", "विंडहुक", "Windhoek");
const GABORONE = L('กาโบโรเน', 'ハボローネ', '가보로네', '哈博罗内', 'Габороне', "Gaborone", "غابورون", "Gaborone", "Gaborone", "गाबोरोन", "Gaborone");
const MAPUTO = L('มาปูโต', 'マプト', '마푸투', '马普托', 'Мапуту', "Maputo", "مابوتو", "Maputo", "Maputo", "मापुटो", "Maputo");
const LUANDA = L('ลวนดา', 'ルアンダ', '루안다', '罗安达', 'Луанда', "Luanda", "لواندا", "Luanda", "Luanda", "लुआंडा", "Luanda");
const ABIDJAN = L('อาบีจาน', 'アビジャン', '아비장', '阿比让', 'Абиджан', "Abidjan", "أبيدجان", "Abidjan", "Abidjan", "अबीजान", "Abidjan");

const NEW_YORK = L('นิวยอร์ก', 'ニューヨーク', '뉴욕', '纽约', 'Нью-Йорк', "New York", "نيويورك", "Nova Iorque", "New York", "न्यूयॉर्क", "New York");
const LOS_ANGELES = L('ลอสแอนเจลิส', 'ロサンゼルス', '로스앤젤레스', '洛杉矶', 'Лос-Анджелес', "Los Angeles", "لوس أنجلوس", "Los Angeles", "Los Angeles", "लॉस एंजेलिस", "Los Angeles");
const SAN_FRANCISCO = L('ซานฟรานซิสโก', 'サンフランシスコ', '샌프란시스코', '旧金山', 'Сан-Франциско', "San Francisco", "سان فرانسيسكو", "São Francisco", "San Francisco", "सैन फ्रांसिस्को", "San Francisco");
const CHICAGO = L('ชิคาโก', 'シカゴ', '시카고', '芝加哥', 'Чикаго', "Chicago", "شيكاغو", "Chicago", "Chicago", "शिकागो", "Chicago");
const MIAMI = L('ไมอามี', 'マイアミ', '마이애미', '迈阿密', 'Майами', "Miami", "ميامي", "Miami", "Miami", "मियामी", "Miami");
const DALLAS = L('ดัลลัส', 'ダラス', '댈러스', '达拉斯', 'Даллас', "Dallas", "دالاس", "Dallas", "Dallas", "डलास", "Dallas");
const ATLANTA = L('แอตแลนตา', 'アトランタ', '애틀랜타', '亚特兰大', 'Атланта', "Atlanta", "أتلانتا", "Atlanta", "Atlanta", "अटलांटा", "Atlanta");
const SEATTLE = L('ซีแอตเทิล', 'シアトル', '시애틀', '西雅图', 'Сиэтл', "Seattle", "سياتل", "Seattle", "Seattle", "सिएटल", "Seattle");
const BOSTON = L('บอสตัน', 'ボストン', '보스턴', '波士顿', 'Бостон', "Boston", "بوسطن", "Boston", "Boston", "बॉस्टन", "Boston");
const WASHINGTON = L('วอชิงตัน', 'ワシントン', '워싱턴', '华盛顿', 'Вашингтон', "Washington", "واشنطن", "Washington", "Washington", "वाशिंगटन", "Washington");
const DENVER = L('เดนเวอร์', 'デンバー', '덴버', '丹佛', 'Денвер', "Denver", "دنفر", "Denver", "Denver", "डेनवर", "Denver");
const LAS_VEGAS = L('ลาสเวกัส', 'ラスベガス', '라스베이거스', '拉斯维加斯', 'Лас-Вегас', "Las Vegas", "لاس فيغاس", "Las Vegas", "Las Vegas", "लास वेगास", "Las Vegas");
const ORLANDO = L('ออร์แลนโด', 'オーランド', '올랜도', '奥兰多', 'Орландо', "Orlando", "أورلاندو", "Orlando", "Orlando", "ऑरलैंडो", "Orlando");
const HONOLULU = L('โฮโนลูลู', 'ホノルル', '호놀룰루', '檀香山', 'Гонолулу', "Honolulu", "هونولولو", "Honolulu", "Honolulu", "होनोलूलू", "Honolulu");
const TORONTO = L('โตรอนโต', 'トロント', '토론토', '多伦多', 'Торонто', "Toronto", "تورونتو", "Toronto", "Toronto", "टोरंटो", "Toronto");
const VANCOUVER = L('แวนคูเวอร์', 'バンクーバー', '밴쿠버', '温哥华', 'Ванкувер', "Vancouver", "فانكوفر", "Vancouver", "Vancouver", "वैंकूवर", "Vancouver");
const MONTREAL = L('มอนทรีออล', 'モントリオール', '몬트리올', '蒙特利尔', 'Монреаль', "Montréal", "مونتريال", "Montreal", "Montreal", "मॉन्ट्रियल", "Montreal");
const CALGARY = L('แคลกะรี', 'カルガリー', '캘거리', '卡尔加里', 'Калгари', "Calgary", "كالغاري", "Calgary", "Calgary", "कैलगरी", "Calgary");
const MEXICO_CITY = L('เม็กซิโกซิตี', 'メキシコシティ', '멕시코시티', '墨西哥城', 'Мехико', "Mexico", "مكسيكو سيتي", "Cidade do México", "Meksiko", "मेक्सिको सिटी", "Mexico City");
const CANCUN = L('กันกุน', 'カンクン', '칸쿤', '坎昆', 'Канкун', "Cancún", "كانكون", "Cancún", "Cancún", "कानकुन", "Cancun");
const SAO_PAULO = L('เซาเปาโล', 'サンパウロ', '상파울루', '圣保罗', 'Сан-Паулу', "São Paulo", "ساو باولو", "São Paulo", "São Paulo", "साओ पाउलो", "Sao Paulo");
const RIO = L('รีโอเดจาเนโร', 'リオデジャネイロ', '리우데자네이루', '里约热内卢', 'Рио-де-Жанейро', "Rio de Janeiro", "ريو دي جانيرو", "Rio de Janeiro", "Rio de Janeiro", "रियो डि जेनेरो", "Rio de Janeiro");
const BRASILIA = L('บราซีเลีย', 'ブラジリア', '브라질리아', '巴西利亚', 'Бразилиа', "Brasilia", "برازيليا", "Brasília", "Brasília", "ब्रासीलिया", "Brasilia");
const BUENOS_AIRES = L('บัวโนสไอเรส', 'ブエノスアイレス', '부에노스아이레스', '布宜诺斯艾利斯', 'Буэнос-Айрес', "Buenos Aires", "بوينس آيرس", "Buenos Aires", "Buenos Aires", "ब्यूनस आयर्स", "Buenos Aires");
const SANTIAGO = L('ซันติอาโก', 'サンティアゴ', '산티아고', '圣地亚哥', 'Сантьяго', "Santiago", "سانتياغو", "Santiago", "Santiago", "सैंटियागो", "Santiago");
const BOGOTA = L('โบโกตา', 'ボゴタ', '보고타', '波哥大', 'Богота', "Bogotá", "بوغوتا", "Bogotá", "Bogota", "बोगोटा", "Bogota");
const LIMA = L('ลิมา', 'リマ', '리마', '利马', 'Лима', "Lima", "ليما", "Lima", "Lima", "लीमा", "Lima");
const PANAMA_CITY = L('ปานามาซิตี', 'パナマ市', '파나마시티', '巴拿马城', 'Панама', "Panama", "مدينة بنما", "Cidade do Panamá", "Panama", "पनामा सिटी", "Panama City");
const MONTEVIDEO = L('มอนเตวิเดโอ', 'モンテビデオ', '몬테비디오', '蒙得维的亚', 'Монтевидео', "Montevideo", "مونتفيدو", "Montevideu", "Montevideo", "मोंटेवीडियो", "Montevideo");
const QUITO = L('กีโต', 'キト', '키토', '基多', 'Кито', "Quito", "كيتو", "Quito", "Quito", "क्विटो", "Quito");
const CARACAS = L('การากัส', 'カラカス', '카라카스', '加拉加斯', 'Каракас', "Caracas", "كاراكاس", "Caracas", "Caracas", "काराकास", "Caracas");
const ASUNCION = L('อาซุนซิออน', 'アスンシオン', '아순시온', '亚松森', 'Асунсьон', "Asuncion", "أسونسيون", "Assunção", "Asunción", "असुनसियोन", "Asuncion");
const SANTA_CRUZ = L('ซานตากรุซ', 'サンタクルス', '산타크루스', '圣克鲁斯', 'Санта-Крус', "Santa Cruz", "سانتا كروز", "Santa Cruz", "Santa Cruz", "सांता क्रूज़", "Santa Cruz");
const GUATEMALA_CITY = L('กัวเตมาลาซิตี', 'グアテマラシティ', '과테말라시티', '危地马拉城', 'Гватемала', "Guatemala", "غواتيمالا", "Cidade da Guatemala", "Guatemala", "ग्वाटेमाला सिटी", "Guatemala City");
const SAN_SALVADOR = L('ซานซัลวาดอร์', 'サンサルバドル', '산살바도르', '圣萨尔瓦多', 'Сан-Сальвадор', "San Salvador", "سان سلفادور", "San Salvador", "San Salvador", "सान साल्वाडोर", "San Salvador");
const TEGUCIGALPA = L('เตกูซิกัลปา', 'テグシガルパ', '테구시갈파', '特古西加尔巴', 'Тегусигальпа', "Tegucigalpa", "تيغوسيغالبا", "Tegucigalpa", "Tegucigalpa", "तेगुसिगाल्पा", "Tegucigalpa");
const MANAGUA = L('มานากัว', 'マナグア', '마나과', '马那瓜', 'Манагуа', "Managua", "ماناغوا", "Manágua", "Managua", "मानागुआ", "Managua");
const SAN_JOSE = L('ซานโฮเซ', 'サンホセ', '산호세', '圣何塞', 'Сан-Хосе', "San José", "سان خوسيه", "San José", "San José", "सान होसे", "San Jose");
const HAVANA = L('ฮาวานา', 'ハバナ', '하바나', '哈瓦那', 'Гавана', "La Havane", "هافانا", "Havana", "Havana", "हवाना", "Havana");
const SANTO_DOMINGO = L('ซานโตโดมิงโก', 'サントドミンゴ', '산토도밍고', '圣多明各', 'Санто-Доминго', "Saint-Domingue", "سانتو دومينغو", "Santo Domingo", "Santo Domingo", "सैंटो डोमिंगो", "Santo Domingo");
const KINGSTON = L('คิงส์ตัน', 'キングストン', '킹스턴', '金斯敦', 'Кингстон', "Kingston", "كينغستون", "Kingston", "Kingston", "किंग्स्टन", "Kingston");
const SAN_JUAN = L('ซานฮวน', 'サンフアン', '산후안', '圣胡安', 'Сан-Хуан', "San Juan", "سان خوان", "San Juan", "San Juan", "सान जुआन", "San Juan");
const NASSAU = L('แนสซอ', 'ナッソー', '나소', '拿骚', 'Нассау', "Nassau", "ناسو", "Nassau", "Nassau", "नासाउ", "Nassau");
const PORT_OF_SPAIN = L('พอร์ตออฟสเปน', 'ポートオブスペイン', '포트오브스페인', '西班牙港', 'Порт-оф-Спейн', "Port-d'Espagne", "بورت أوف سبين", "Porto de Espanha", "Port of Spain", "पोर्ट ऑफ स्पेन", "Port of Spain");
const ORANJESTAD = L('โอรันเยสตัด', 'オラニエスタッド', '오랑예스타트', '奥拉涅斯塔德', 'Ораньестад', "Oranjestad", "أورانجيستاد", "Oranjestad", "Oranjestad", "ओरंजेस्टाद", "Oranjestad");
const WILLEMSTAD = L('วิลเลมสตัด', 'ウィレムスタット', '빌렘스타트', '威廉斯塔德', 'Виллемстад', "Willemstad", "ويليمستاد", "Willemstad", "Willemstad", "विलेमस्टाद", "Willemstad");
const PHILIPSBURG = L('ฟิลิปส์บูร์ก', 'フィリップスブルフ', '필립스뷔르흐', '菲利普斯堡', 'Филипсбург', "Philipsburg", "فيليبسبرغ", "Philipsburg", "Philipsburg", "फिलिप्सबर्ग", "Philipsburg");

const SYDNEY = L('ซิดนีย์', 'シドニー', '시드니', '悉尼', 'Сидней', "Sydney", "سيدني", "Sydney", "Sidney", "सिडनी", "Sydney");
const MELBOURNE = L('เมลเบิร์น', 'メルボルン', '멜버른', '墨尔本', 'Мельбурн', "Melbourne", "ملبورن", "Melbourne", "Melbourne", "मेलबर्न", "Melbourne");
const BRISBANE = L('บริสเบน', 'ブリスベン', '브리즈번', '布里斯班', 'Брисбен', "Brisbane", "بريزبان", "Brisbane", "Brisbane", "ब्रिस्बेन", "Brisbane");
const PERTH = L('เพิร์ท', 'パース', '퍼스', '珀斯', 'Перт', "Perth", "بيرث", "Perth", "Perth", "पर्थ", "Perth");
const ADELAIDE = L('แอดิเลด', 'アデレード', '애들레이드', '阿德莱德', 'Аделаида', "Adélaïde", "أديلايد", "Adelaide", "Adelaide", "एडिलेड", "Adelaide");
const AUCKLAND = L('โอ๊คแลนด์', 'オークランド', '오클랜드', '奥克兰', 'Окленд', "Auckland", "أوكلاند", "Auckland", "Auckland", "ऑकलैंड", "Auckland");
const WELLINGTON = L('เวลลิงตัน', 'ウェリントン', '웰링턴', '惠灵顿', 'Веллингтон', "Wellington", "ويلينغتون", "Wellington", "Wellington", "वेलिंगटन", "Wellington");
const CHRISTCHURCH = L('ไครสต์เชิร์ช', 'クライストチャーチ', '크라이스트처치', '基督城', 'Крайстчерч', "Christchurch", "كرايستشرش", "Christchurch", "Christchurch", "क्राइस्टचर्च", "Christchurch");
const NADI = L('นาดี', 'ナンディ', '난디', '楠迪', 'Нанди', "Nadi", "نادي", "Nadi", "Nadi", "नाडी", "Nadi");
const PAPEETE = L('ปาเปเอเต', 'パペーテ', '파페에테', '帕皮提', 'Папеэте', "Papeete", "بابيتي", "Papeete", "Papeete", "पापेएते", "Papeete");
const NOUMEA = L('นูเมอา', 'ヌメア', '누메아', '努美阿', 'Нумеа', "Nouméa", "نوميا", "Nouméa", "Nouméa", "नूमेआ", "Noumea");
const PORT_MORESBY = L('พอร์ตมอร์สบี', 'ポートモレスビー', '포트모르즈비', '莫尔兹比港', 'Порт-Морсби', "Port Moresby", "بورت مورسبي", "Porto Moresby", "Port Moresby", "पोर्ट मोरेस्बी", "Port Moresby");
const APIA = L('อาเปีย', 'アピア', '아피아', '阿皮亚', 'Апиа', "Apia", "آبيا", "Apia", "Apia", "आपिया", "Apia");
const NUKUALOFA = L('นูกูอาโลฟา', 'ヌクアロファ', '누쿠알로파', '努库阿洛法', 'Нукуалофа', "Nukuʻalofa", "نوكو ألوفا", "Nuku'alofa", "Nuku'alofa", "नुकुआलोफा", "Nuku'alofa");
const HAGATNA = L('ฮากัตญา', 'ハガニア', '하갓냐', '阿加尼亚', 'Хагатна', "Hagåtña", "هاغاتنا", "Hagåtña", "Hagåtña", "हागात्ना", "Hagatna");
const SAIPAN = L('ไซปัน', 'サイパン', '사이판', '塞班', 'Сайпан', "Saipan", "سايبان", "Saipan", "Saipan", "साइपान", "Saipan");

export const CITY_LOCALIZED: LocalizedCities = {
  AMS: AMSTERDAM,
  RTM: ROTTERDAM,
  EIN: EINDHOVEN,
  BRU: BRUSSELS,
  CRL: CHARLEROI,
  FRA: FRANKFURT,
  MUC: MUNICH,
  BER: BERLIN,
  DUS: DUSSELDORF,
  HAM: HAMBURG,
  CGN: COLOGNE,
  STR: STUTTGART,
  CDG: PARIS,
  ORY: PARIS,
  NCE: NICE,
  LYS: LYON,
  MRS: MARSEILLE,
  LHR: LONDON,
  LGW: LONDON,
  STN: LONDON,
  LCY: LONDON,
  MAN: MANCHESTER,
  EDI: EDINBURGH,
  DUB: DUBLIN,
  MAD: MADRID,
  BCN: BARCELONA,
  AGP: MALAGA,
  PMI: PALMA,
  LIS: LISBON,
  OPO: PORTO,
  FCO: ROME,
  MXP: MILAN,
  LIN: MILAN,
  VCE: VENICE,
  NAP: NAPLES,
  ZRH: ZURICH,
  GVA: GENEVA,
  VIE: VIENNA,
  WAW: WARSAW,
  ARN: STOCKHOLM,
  OSL: OSLO,
  CPH: COPENHAGEN,
  HEL: HELSINKI,
  ATH: ATHENS,
  PRG: PRAGUE,
  BUD: BUDAPEST,
  OTP: BUCHAREST,
  IST: ISTANBUL,
  SAW: ISTANBUL,
  AYT: ANTALYA,
  SVO: MOSCOW,
  KBP: KYIV,
  KEF: REYKJAVIK,
  LUX: LUXEMBOURG,
  ZAG: ZAGREB,
  BEG: BELGRADE,
  SOF: SOFIA,
  LCA: LARNACA,
  MLA: VALLETTA,
  TLL: TALLINN,
  RIX: RIGA,
  VNO: VILNIUS,
  BTS: BRATISLAVA,
  LJU: LJUBLJANA,
  TBS: TBILISI,
  GYD: BAKU,
  NQZ: ASTANA,
  TAS: TASHKENT,
  ULN: ULAANBAATAR,
  BKK: BANGKOK,
  DMK: BANGKOK,
  HKT: PHUKET,
  CNX: CHIANG_MAI,
  USM: KOH_SAMUI,
  KBV: KRABI,
  HDY: HAT_YAI,
  UTP: PATTAYA,
  CEI: CHIANG_RAI,
  KKC: KHON_KAEN,
  TDX: TRAT,
  THS: SUKHOTHAI,
  UTH: UDON_THANI,
  UBP: UBON,
  SIN: SINGAPORE,
  KUL: KUALA_LUMPUR,
  SZB: KUALA_LUMPUR,
  PEN: PENANG,
  BKI: KOTA_KINABALU,
  CGK: JAKARTA,
  DPS: DENPASAR,
  SUB: SURABAYA,
  SGN: HO_CHI_MINH,
  HAN: HANOI,
  DAD: DA_NANG,
  PNH: PHNOM_PENH,
  REP: SIEM_REAP,
  VTE: VIENTIANE,
  RGN: YANGON,
  MNL: MANILA,
  CEB: CEBU,
  BWN: BANDAR,
  PEK: BEIJING,
  PKX: BEIJING,
  PVG: SHANGHAI,
  SHA: SHANGHAI,
  CAN: GUANGZHOU,
  SZX: SHENZHEN,
  HKG: HONG_KONG,
  TPE: TAIPEI,
  MFM: MACAU,
  NRT: TOKYO,
  HND: TOKYO,
  KIX: OSAKA,
  ITM: OSAKA,
  CTS: SAPPORO,
  FUK: FUKUOKA,
  ICN: SEOUL,
  GMP: SEOUL,
  DEL: DELHI,
  BOM: MUMBAI,
  BLR: BENGALURU,
  MAA: CHENNAI,
  CCU: KOLKATA,
  HYD: HYDERABAD,
  ISB: ISLAMABAD,
  KHI: KARACHI,
  DAC: DHAKA,
  CMB: COLOMBO,
  KTM: KATHMANDU,
  MLE: MALE,
  DXB: DUBAI,
  DWC: DUBAI,
  AUH: ABU_DHABI,
  DOH: DOHA,
  RUH: RIYADH,
  JED: JEDDAH,
  BAH: MANAMA,
  MCT: MUSCAT,
  KWI: KUWAIT,
  TLV: TEL_AVIV,
  AMM: AMMAN,
  IKA: TEHRAN,
  BGW: BAGHDAD,
  BEY: BEIRUT,
  CAI: CAIRO,
  JNB: JOHANNESBURG,
  CPT: CAPE_TOWN,
  NBO: NAIROBI,
  CMN: CASABLANCA,
  LOS: LAGOS,
  DAR: DAR_ES_SALAAM,
  ADD: ADDIS_ABABA,
  ACC: ACCRA,
  TUN: TUNIS,
  ALG: ALGIERS,
  DSS: DAKAR,
  MRU: PORT_LOUIS,
  SEZ: VICTORIA,
  KGL: KIGALI,
  EBB: KAMPALA,
  WDH: WINDHOEK,
  GBE: GABORONE,
  MPM: MAPUTO,
  LAD: LUANDA,
  ABJ: ABIDJAN,
  JFK: NEW_YORK,
  EWR: NEW_YORK,
  LGA: NEW_YORK,
  LAX: LOS_ANGELES,
  SFO: SAN_FRANCISCO,
  ORD: CHICAGO,
  MIA: MIAMI,
  DFW: DALLAS,
  ATL: ATLANTA,
  SEA: SEATTLE,
  BOS: BOSTON,
  IAD: WASHINGTON,
  DCA: WASHINGTON,
  DEN: DENVER,
  LAS: LAS_VEGAS,
  MCO: ORLANDO,
  HNL: HONOLULU,
  YYZ: TORONTO,
  YVR: VANCOUVER,
  YUL: MONTREAL,
  YYC: CALGARY,
  MEX: MEXICO_CITY,
  CUN: CANCUN,
  GRU: SAO_PAULO,
  GIG: RIO,
  BSB: BRASILIA,
  EZE: BUENOS_AIRES,
  SCL: SANTIAGO,
  BOG: BOGOTA,
  LIM: LIMA,
  PTY: PANAMA_CITY,
  MVD: MONTEVIDEO,
  UIO: QUITO,
  CCS: CARACAS,
  ASU: ASUNCION,
  VVI: SANTA_CRUZ,
  GUA: GUATEMALA_CITY,
  SAL: SAN_SALVADOR,
  TGU: TEGUCIGALPA,
  MGA: MANAGUA,
  SJO: SAN_JOSE,
  HAV: HAVANA,
  SDQ: SANTO_DOMINGO,
  KIN: KINGSTON,
  SJU: SAN_JUAN,
  NAS: NASSAU,
  POS: PORT_OF_SPAIN,
  AUA: ORANJESTAD,
  CUR: WILLEMSTAD,
  SXM: PHILIPSBURG,
  SYD: SYDNEY,
  MEL: MELBOURNE,
  BNE: BRISBANE,
  PER: PERTH,
  ADL: ADELAIDE,
  AKL: AUCKLAND,
  WLG: WELLINGTON,
  CHC: CHRISTCHURCH,
  NAN: NADI,
  PPT: PAPEETE,
  NOU: NOUMEA,
  POM: PORT_MORESBY,
  APW: APIA,
  TBU: NUKUALOFA,
  GUM: HAGATNA,
  SPN: SAIPAN,
};

export function getLocalizedCity(
  iata: string,
  locale: string,
  fallback: string,
): string {
  const loc = CITY_LOCALIZED[String(iata || '').trim().toUpperCase()];
  if (!loc) return fallback;
  const lang = locale.split('-')[0] as CityLang;
  return loc[lang] ?? fallback;
}
