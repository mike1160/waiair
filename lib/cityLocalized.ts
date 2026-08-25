/** Localized city names for airports in lib/airportsDb.ts. Display only — catalog `city` stays as-is. */

type LocalizedCities = Record<string, Partial<Record<'th' | 'ja' | 'ko' | 'zh' | 'ru', string>>>;

function L(th: string, ja: string, ko: string, zh: string, ru: string) {
  return { th, ja, ko, zh, ru };
}

const AMSTERDAM = L('อัมสเตอร์ดัม', 'アムステルダム', '암스테르담', '阿姆斯特丹', 'Амстердам');
const ROTTERDAM = L('รอตเทอร์ดัม', 'ロッテルダム', '로테르담', '鹿特丹', 'Роттердам');
const EINDHOVEN = L('ไอนด์โฮเฟน', 'アイントホーフェン', '에인트호번', '埃因霍温', 'Эйндховен');
const BRUSSELS = L('บรัสเซลส์', 'ブリュッセル', '브뤼셀', '布鲁塞尔', 'Брюссель');
const CHARLEROI = L('ชาร์เลอรัว', 'シャルルロワ', '샤를루아', '沙勒罗瓦', 'Шарлеруа');
const FRANKFURT = L('แฟรงก์เฟิร์ต', 'フランクフルト', '프랑크푸르트', '法兰克福', 'Франкфурт');
const MUNICH = L('มิวนิก', 'ミュンヘン', '뮌헨', '慕尼黑', 'Мюнхен');
const BERLIN = L('เบอร์ลิน', 'ベルリン', '베를린', '柏林', 'Берлин');
const DUSSELDORF = L('ดุสเซลดอร์ฟ', 'デュッセルドルフ', '뒤셀도르프', '杜塞尔多夫', 'Дюссельдорф');
const HAMBURG = L('ฮัมบูร์ก', 'ハンブルク', '함부르크', '汉堡', 'Гамбург');
const COLOGNE = L('โคโลญ', 'ケルン', '쾰른', '科隆', 'Кёльн');
const STUTTGART = L('สตุตการ์ท', 'シュトゥットガルト', '슈투트가르트', '斯图加特', 'Штутгарт');
const PARIS = L('ปารีส', 'パリ', '파리', '巴黎', 'Париж');
const NICE = L('นีซ', 'ニース', '니스', '尼斯', 'Ницца');
const LYON = L('ลียง', 'リヨン', '리옹', '里昂', 'Лион');
const MARSEILLE = L('มาร์เซย', 'マルセイユ', '마르세유', '马赛', 'Марсель');
const LONDON = L('ลอนดอน', 'ロンドン', '런던', '伦敦', 'Лондон');
const MANCHESTER = L('แมนเชสเตอร์', 'マンチェスター', '맨체스터', '曼彻斯特', 'Манчестер');
const EDINBURGH = L('เอดินบะระ', 'エディンバラ', '에든버러', '爱丁堡', 'Эдинбург');
const DUBLIN = L('ดับลิน', 'ダブリン', '더블린', '都柏林', 'Дублин');
const MADRID = L('มาดริด', 'マドリード', '마드리드', '马德里', 'Мадрид');
const BARCELONA = L('บาร์เซโลนา', 'バルセロナ', '바르셀로나', '巴塞罗那', 'Барселона');
const MALAGA = L('มาลากา', 'マラガ', '말라가', '马拉加', 'Малага');
const PALMA = L('ปัลมา', 'パルマ', '팔마', '帕尔马', 'Пальма');
const LISBON = L('ลิสบอน', 'リスボン', '리스본', '里斯本', 'Лиссабон');
const PORTO = L('ปอร์โต', 'ポルト', '포르투', '波尔图', 'Порту');
const ROME = L('โรม', 'ローマ', '로마', '罗马', 'Рим');
const MILAN = L('มิลาน', 'ミラノ', '밀라노', '米兰', 'Милан');
const VENICE = L('เวนิส', 'ベネチア', '베네치아', '威尼斯', 'Венеция');
const NAPLES = L('เนเปิลส์', 'ナポリ', '나폴리', '那不勒斯', 'Неаполь');
const ZURICH = L('ซูริก', 'チューリッヒ', '취리히', '苏黎世', 'Цюрих');
const GENEVA = L('เจนีวา', 'ジュネーヴ', '제네바', '日内瓦', 'Женева');
const VIENNA = L('เวียนนา', 'ウィーン', '빈', '维也纳', 'Вена');
const WARSAW = L('วอร์ซอ', 'ワルシャワ', '바르샤바', '华沙', 'Варшава');
const STOCKHOLM = L('สตอกโฮล์ม', 'ストックホルム', '스톡홀름', '斯德哥尔摩', 'Стокгольм');
const OSLO = L('ออสโล', 'オスロ', '오슬로', '奥斯陆', 'Осло');
const COPENHAGEN = L('โคเปนเฮเกน', 'コペンハーゲン', '코펜하겐', '哥本哈根', 'Копенгаген');
const HELSINKI = L('เฮลซิงกิ', 'ヘルシンキ', '헬싱키', '赫尔辛基', 'Хельсинки');
const ATHENS = L('เอเธนส์', 'アテネ', '아테네', '雅典', 'Афины');
const PRAGUE = L('ปราก', 'プラハ', '프라하', '布拉格', 'Прага');
const BUDAPEST = L('บูดาเปสต์', 'ブダペスト', '부다페스트', '布达佩斯', 'Будапешт');
const BUCHAREST = L('บูคาเรสต์', 'ブカレスト', '부쿠레슈티', '布加勒斯特', 'Бухарест');
const ISTANBUL = L('อิสตันบูล', 'イスタンブール', '이스탄불', '伊斯坦布尔', 'Стамбул');
const ANTALYA = L('อันตัลยา', 'アンタルヤ', '안탈리아', '安塔利亚', 'Анталья');
const MOSCOW = L('มอสโก', 'モスクワ', '모스크바', '莫斯科', 'Москва');
const KYIV = L('เคียฟ', 'キーウ', '키이우', '基辅', 'Киев');
const REYKJAVIK = L('เรคยาวิก', 'レイキャヴィーク', '레이캬비크', '雷克雅未克', 'Рейкьявик');
const LUXEMBOURG = L('ลักเซมเบิร์ก', 'ルクセンブルク', '룩셈부르크', '卢森堡', 'Люксембург');
const ZAGREB = L('ซาเกร็บ', 'ザグレブ', '자그레브', '萨格勒布', 'Загреб');
const BELGRADE = L('เบลเกรด', 'ベオグラード', '베오그라드', '贝尔格莱德', 'Белград');
const SOFIA = L('โซเฟีย', 'ソフィア', '소피아', '索非亚', 'София');
const LARNACA = L('ลาร์นากา', 'ラルナカ', '라르나카', '拉纳卡', 'Ларнака');
const VALLETTA = L('วัลเลตตา', 'バレッタ', '발레타', '瓦莱塔', 'Валлетта');
const TALLINN = L('ทาลลินน์', 'タリン', '탈린', '塔林', 'Таллин');
const RIGA = L('ริกา', 'リガ', '리가', '里加', 'Рига');
const VILNIUS = L('วิลนีอุส', 'ヴィリニュス', '빌뉴스', '维尔纽斯', 'Вильнюс');
const BRATISLAVA = L('บราติสลาวา', 'ブラチスラヴァ', '브라티슬라바', '布拉迪斯拉发', 'Братислава');
const LJUBLJANA = L('ลูบลิยานา', 'リュブリャナ', '류블랴나', '卢布尔雅那', 'Любляна');
const TBILISI = L('ทบิลิซี', 'トビリシ', '트빌리시', '第比利斯', 'Тбилиси');
const BAKU = L('บากู', 'バクー', '바쿠', '巴库', 'Баку');
const ASTANA = L('อัสตานา', 'アスタナ', '아스타나', '阿斯塔纳', 'Астана');
const TASHKENT = L('ทาชเคนต์', 'タシュケント', '타슈켄트', '塔什干', 'Ташкент');
const ULAANBAATAR = L('อูลานบาตอร์', 'ウランバートル', '울란바토르', '乌兰巴托', 'Улан-Батор');

const BANGKOK = L('กรุงเทพฯ', 'バンコク', '방콕', '曼谷', 'Бангкок');
const PHUKET = L('ภูเก็ต', 'プーケット', '푸켓', '普吉', 'Пхукет');
const CHIANG_MAI = L('เชียงใหม่', 'チェンマイ', '치앙마이', '清迈', 'Чиангмай');
const KOH_SAMUI = L('เกาะสมุย', 'サムイ', '코사무이', '苏梅', 'Самуи');
const KRABI = L('กระบี่', 'クラビ', '크라비', '甲米', 'Краби');
const HAT_YAI = L('หาดใหญ่', 'ハートヤイ', '핫야이', '合艾', 'Хатъяй');
const PATTAYA = L('พัทยา', 'パタヤ', '파타야', '芭提雅', 'Паттайя');
const CHIANG_RAI = L('เชียงราย', 'チエンラーイ', '치앙라이', '清莱', 'Чианграй');
const KHON_KAEN = L('ขอนแก่น', 'コーンケン', '콘깬', '孔敬', 'Кхонкэн');
const SINGAPORE = L('สิงคโปร์', 'シンガポール', '싱가포르', '新加坡', 'Сингапур');
const KUALA_LUMPUR = L('กัวลาลัมเปอร์', 'クアラルンプール', '쿠알라룸푸르', '吉隆坡', 'Куала-Лумпур');
const PENANG = L('ปีนัง', 'ペナン', '페낭', '槟城', 'Пенанг');
const KOTA_KINABALU = L('โกตาคินาบาลู', 'コタキナバル', '코타키나발루', '亚庇', 'Кота-Кинабалу');
const JAKARTA = L('จาการ์ตา', 'ジャカルタ', '자카르타', '雅加达', 'Джакарта');
const DENPASAR = L('เดนปาซาร์', 'デンパサール', '덴파사르', '登巴萨', 'Денпасар');
const SURABAYA = L('สุราบายา', 'スラバヤ', '수라바야', '泗水', 'Сурабая');
const HO_CHI_MINH = L('โฮจิมินห์', 'ホーチミン', '호찌민', '胡志明市', 'Хошимин');
const HANOI = L('ฮานอย', 'ハノイ', '하노이', '河内', 'Ханой');
const DA_NANG = L('ดานัง', 'ダナン', '다낭', '岘港', 'Дананг');
const PHNOM_PENH = L('พนมเปญ', 'プノンペン', '프놈펜', '金边', 'Пномпень');
const SIEM_REAP = L('เสียมราฐ', 'シェムリアップ', '씨엠립', '暹粒', 'Сиемреап');
const VIENTIANE = L('เวียงจันทน์', 'ビエンチャン', '비엔티안', '万象', 'Вьентьян');
const YANGON = L('ย่างกุ้ง', 'ヤンゴン', '양곤', '仰光', 'Янгон');
const MANILA = L('มะนิลา', 'マニラ', '마닐라', '马尼拉', 'Манила');
const CEBU = L('เซบู', 'セブ', '세부', '宿务', 'Себу');
const BANDAR = L('บันดาร์เสรีเบกาวัน', 'バンダルスリブガワン', '반다르스리브가완', '斯里巴加湾', 'Бандар-Сери-Бегаван');

const BEIJING = L('ปักกิ่ง', '北京', '베이징', '北京', 'Пекин');
const SHANGHAI = L('เซี่ยงไฮ้', '上海', '상하이', '上海', 'Шанхай');
const GUANGZHOU = L('กว่างโจว', '広州', '광저우', '广州', 'Гуанчжоу');
const SHENZHEN = L('เซินเจิ้น', '深圳', '선전', '深圳', 'Шэньчжэнь');
const HONG_KONG = L('ฮ่องกง', '香港', '홍콩', '香港', 'Гонконг');
const TAIPEI = L('ไทเป', '台北', '타이베이', '台北', 'Тайбэй');
const MACAU = L('มาเก๊า', 'マカオ', '마카오', '澳门', 'Макао');
const TOKYO = L('โตเกียว', '東京', '도쿄', '东京', 'Токио');
const OSAKA = L('โอซาก้า', '大阪', '오사카', '大阪', 'Осака');
const SAPPORO = L('ซัปโปโร', '札幌', '삿포로', '札幌', 'Саппоро');
const FUKUOKA = L('ฟูกูโอกะ', '福岡', '후쿠오카', '福冈', 'Фукуока');
const SEOUL = L('โซล', 'ソウル', '서울', '首尔', 'Сеул');
const DELHI = L('นิวเดลี', 'ニューデリー', '뉴델리', '新德里', 'Нью-Дели');
const MUMBAI = L('มุมไบ', 'ムンバイ', '뭄바이', '孟买', 'Мумбаи');
const BENGALURU = L('เบงกาลูรู', 'ベンガルール', '벵갈루루', '班加罗尔', 'Бенгалуру');
const CHENNAI = L('เชนไน', 'チェンナイ', '첸나이', '金奈', 'Ченнаи');
const KOLKATA = L('โกลกาตา', 'コルカタ', '콜카타', '加尔各答', 'Калькутта');
const HYDERABAD = L('ไฮเดอราบัด', 'ハイデラバード', '하이데라바드', '海得拉巴', 'Хайдарабад');
const ISLAMABAD = L('อิสลามาบัด', 'イスラマバード', '이슬라마바드', '伊斯兰堡', 'Исламабад');
const KARACHI = L('การาจี', 'カラチ', '카라치', '卡拉奇', 'Карачи');
const DHAKA = L('ธากา', 'ダッカ', '다카', '达卡', 'Дакка');
const COLOMBO = L('โคลัมโบ', 'コロンボ', '콜롬보', '科伦坡', 'Коломбо');
const KATHMANDU = L('กาฐมาณฑุ', 'カトマンズ', '카트만두', '加德满都', 'Катманду');
const MALE = L('มาเล', 'マレ', '말레', '马累', 'Мале');

const DUBAI = L('ดูไบ', 'ドバイ', '두바이', '迪拜', 'Дубай');
const ABU_DHABI = L('อาบูดาบี', 'アブダビ', '아부다비', '阿布扎比', 'Абу-Даби');
const DOHA = L('โดฮา', 'ドーハ', '도하', '多哈', 'Доха');
const RIYADH = L('ริยาด', 'リヤド', '리야드', '利雅得', 'Эр-Рияд');
const JEDDAH = L('เจดดาห์', 'ジッダ', '제다', '吉达', 'Джидда');
const MANAMA = L('มานามา', 'マナーマ', '마나마', '麦纳麦', 'Манама');
const MUSCAT = L('มัสกัต', 'マスカット', '무스카트', '马斯喀特', 'Маскат');
const KUWAIT = L('คูเวต', 'クウェート', '쿠웨이트', '科威特', 'Эль-Кувейт');
const TEL_AVIV = L('เทลอาวีฟ', 'テルアビブ', '텔아비브', '特拉维夫', 'Тель-Авив');
const AMMAN = L('อัมมาน', 'アンマン', '암만', '安曼', 'Амман');
const TEHRAN = L('เตหะราน', 'テヘラン', '테헤란', '德黑兰', 'Тегеран');
const BAGHDAD = L('แบกแดด', 'バグダード', '바그다드', '巴格达', 'Багдад');
const BEIRUT = L('เบรุต', 'ベイルート', '베이루트', '贝鲁特', 'Бейрут');

const CAIRO = L('ไคโร', 'カイロ', '카이로', '开罗', 'Каир');
const JOHANNESBURG = L('โจฮันเนสเบิร์ก', 'ヨハネスブルク', '요하네스버그', '约翰内斯堡', 'Йоханнесбург');
const CAPE_TOWN = L('เคปทาวน์', 'ケープタウン', '케이프타운', '开普敦', 'Кейптаун');
const NAIROBI = L('ไนโรบี', 'ナイロビ', '나이로비', '内罗毕', 'Найроби');
const CASABLANCA = L('คาซาบลังกา', 'カサブランカ', '카사블랑카', '卡萨布兰卡', 'Касабланка');
const LAGOS = L('ลากอส', 'ラゴス', '라고스', '拉各斯', 'Лагос');
const DAR_ES_SALAAM = L('ดาร์เอสซาลาม', 'ダルエスサラーム', '다르에스살람', '达累斯萨拉姆', 'Дар-эс-Салам');
const ADDIS_ABABA = L('แอดดิสอาบาบา', 'アディスアベバ', '아디스아바바', '亚的斯亚贝巴', 'Аддис-Абеба');
const ACCRA = L('อักกรา', 'アクラ', '아크라', '阿克拉', 'Аккра');
const TUNIS = L('ตูนิส', 'チュニス', '튀니스', '突尼斯', 'Тунис');
const ALGIERS = L('แอลเจียร์', 'アルジェ', '알제', '阿尔及尔', 'Алжир');
const DAKAR = L('ดาการ์', 'ダカール', '다카르', '达喀尔', 'Дакар');
const PORT_LOUIS = L('พอร์ตลูอิส', 'ポートルイス', '포트루이스', '路易港', 'Порт-Луи');
const VICTORIA = L('วิกตอเรีย', 'ビクトリア', '빅토리아', '维多利亚', 'Виктория');
const KIGALI = L('คิกาลี', 'キガリ', '키갈리', '基加利', 'Кигали');
const KAMPALA = L('กัมปาลา', 'カンパラ', '캄팔라', '坎帕拉', 'Кампала');
const WINDHOEK = L('วินด์ฮุก', 'ウィントフック', '빈트후크', '温得和克', 'Виндхук');
const GABORONE = L('กาโบโรเน', 'ハボローネ', '가보로네', '哈博罗内', 'Габороне');
const MAPUTO = L('มาปูโต', 'マプト', '마푸투', '马普托', 'Мапуту');
const LUANDA = L('ลวนดา', 'ルアンダ', '루안다', '罗安达', 'Луанда');
const ABIDJAN = L('อาบีจาน', 'アビジャン', '아비장', '阿比让', 'Абиджан');

const NEW_YORK = L('นิวยอร์ก', 'ニューヨーク', '뉴욕', '纽约', 'Нью-Йорк');
const LOS_ANGELES = L('ลอสแอนเจลิส', 'ロサンゼルス', '로스앤젤레스', '洛杉矶', 'Лос-Анджелес');
const SAN_FRANCISCO = L('ซานฟรานซิสโก', 'サンフランシスコ', '샌프란시스코', '旧金山', 'Сан-Франциско');
const CHICAGO = L('ชิคาโก', 'シカゴ', '시카고', '芝加哥', 'Чикаго');
const MIAMI = L('ไมอามี', 'マイアミ', '마이애미', '迈阿密', 'Майами');
const DALLAS = L('ดัลลัส', 'ダラス', '댈러스', '达拉斯', 'Даллас');
const ATLANTA = L('แอตแลนตา', 'アトランタ', '애틀랜타', '亚特兰大', 'Атланта');
const SEATTLE = L('ซีแอตเทิล', 'シアトル', '시애틀', '西雅图', 'Сиэтл');
const BOSTON = L('บอสตัน', 'ボストン', '보스턴', '波士顿', 'Бостон');
const WASHINGTON = L('วอชิงตัน', 'ワシントン', '워싱턴', '华盛顿', 'Вашингтон');
const DENVER = L('เดนเวอร์', 'デンバー', '덴버', '丹佛', 'Денвер');
const LAS_VEGAS = L('ลาสเวกัส', 'ラスベガス', '라스베이거스', '拉斯维加斯', 'Лас-Вегас');
const ORLANDO = L('ออร์แลนโด', 'オーランド', '올랜도', '奥兰多', 'Орландо');
const HONOLULU = L('โฮโนลูลู', 'ホノルル', '호놀룰루', '檀香山', 'Гонолулу');
const TORONTO = L('โตรอนโต', 'トロント', '토론토', '多伦多', 'Торонто');
const VANCOUVER = L('แวนคูเวอร์', 'バンクーバー', '밴쿠버', '温哥华', 'Ванкувер');
const MONTREAL = L('มอนทรีออล', 'モントリオール', '몬트리올', '蒙特利尔', 'Монреаль');
const CALGARY = L('แคลกะรี', 'カルガリー', '캘거리', '卡尔加里', 'Калгари');
const MEXICO_CITY = L('เม็กซิโกซิตี', 'メキシコシティ', '멕시코시티', '墨西哥城', 'Мехико');
const CANCUN = L('กันกุน', 'カンクン', '칸쿤', '坎昆', 'Канкун');
const SAO_PAULO = L('เซาเปาโล', 'サンパウロ', '상파울루', '圣保罗', 'Сан-Паулу');
const RIO = L('รีโอเดจาเนโร', 'リオデジャネイロ', '리우데자네이루', '里约热内卢', 'Рио-де-Жанейро');
const BRASILIA = L('บราซีเลีย', 'ブラジリア', '브라질리아', '巴西利亚', 'Бразилиа');
const BUENOS_AIRES = L('บัวโนสไอเรส', 'ブエノスアイレス', '부에노스아이레스', '布宜诺斯艾利斯', 'Буэнос-Айрес');
const SANTIAGO = L('ซันติอาโก', 'サンティアゴ', '산티아고', '圣地亚哥', 'Сантьяго');
const BOGOTA = L('โบโกตา', 'ボゴタ', '보고타', '波哥大', 'Богота');
const LIMA = L('ลิมา', 'リマ', '리마', '利马', 'Лима');
const PANAMA_CITY = L('ปานามาซิตี', 'パナマ市', '파나마시티', '巴拿马城', 'Панама');
const MONTEVIDEO = L('มอนเตวิเดโอ', 'モンテビデオ', '몬테비디오', '蒙得维的亚', 'Монтевидео');
const QUITO = L('กีโต', 'キト', '키토', '基多', 'Кито');
const CARACAS = L('การากัส', 'カラカス', '카라카스', '加拉加斯', 'Каракас');
const ASUNCION = L('อาซุนซิออน', 'アスンシオン', '아순시온', '亚松森', 'Асунсьон');
const SANTA_CRUZ = L('ซานตากรุซ', 'サンタクルス', '산타크루스', '圣克鲁斯', 'Санта-Крус');
const GUATEMALA_CITY = L('กัวเตมาลาซิตี', 'グアテマラシティ', '과테말라시티', '危地马拉城', 'Гватемала');
const SAN_SALVADOR = L('ซานซัลวาดอร์', 'サンサルバドル', '산살바도르', '圣萨尔瓦多', 'Сан-Сальвадор');
const TEGUCIGALPA = L('เตกูซิกัลปา', 'テグシガルパ', '테구시갈파', '特古西加尔巴', 'Тегусигальпа');
const MANAGUA = L('มานากัว', 'マナグア', '마나과', '马那瓜', 'Манагуа');
const SAN_JOSE = L('ซานโฮเซ', 'サンホセ', '산호세', '圣何塞', 'Сан-Хосе');
const HAVANA = L('ฮาวานา', 'ハバナ', '하바나', '哈瓦那', 'Гавана');
const SANTO_DOMINGO = L('ซานโตโดมิงโก', 'サントドミンゴ', '산토도밍고', '圣多明各', 'Санто-Доминго');
const KINGSTON = L('คิงส์ตัน', 'キングストン', '킹스턴', '金斯敦', 'Кингстон');
const SAN_JUAN = L('ซานฮวน', 'サンフアン', '산후안', '圣胡安', 'Сан-Хуан');
const NASSAU = L('แนสซอ', 'ナッソー', '나소', '拿骚', 'Нассау');
const PORT_OF_SPAIN = L('พอร์ตออฟสเปน', 'ポートオブスペイン', '포트오브스페인', '西班牙港', 'Порт-оф-Спейн');
const ORANJESTAD = L('โอรันเยสตัด', 'オラニエスタッド', '오랑예스타트', '奥拉涅斯塔德', 'Ораньестад');
const WILLEMSTAD = L('วิลเลมสตัด', 'ウィレムスタット', '빌렘스타트', '威廉斯塔德', 'Виллемстад');
const PHILIPSBURG = L('ฟิลิปส์บูร์ก', 'フィリップスブルフ', '필립스뷔르흐', '菲利普斯堡', 'Филипсбург');

const SYDNEY = L('ซิดนีย์', 'シドニー', '시드니', '悉尼', 'Сидней');
const MELBOURNE = L('เมลเบิร์น', 'メルボルン', '멜버른', '墨尔本', 'Мельбурн');
const BRISBANE = L('บริสเบน', 'ブリスベン', '브리즈번', '布里斯班', 'Брисбен');
const PERTH = L('เพิร์ท', 'パース', '퍼스', '珀斯', 'Перт');
const ADELAIDE = L('แอดิเลด', 'アデレード', '애들레이드', '阿德莱德', 'Аделаида');
const AUCKLAND = L('โอ๊คแลนด์', 'オークランド', '오클랜드', '奥克兰', 'Окленд');
const WELLINGTON = L('เวลลิงตัน', 'ウェリントン', '웰링턴', '惠灵顿', 'Веллингтон');
const CHRISTCHURCH = L('ไครสต์เชิร์ช', 'クライストチャーチ', '크라이스트처치', '基督城', 'Крайстчерч');
const NADI = L('นาดี', 'ナンディ', '난디', '楠迪', 'Нанди');
const PAPEETE = L('ปาเปเอเต', 'パペーテ', '파페에테', '帕皮提', 'Папеэте');
const NOUMEA = L('นูเมอา', 'ヌメア', '누메아', '努美阿', 'Нумеа');
const PORT_MORESBY = L('พอร์ตมอร์สบี', 'ポートモレスビー', '포트모르즈비', '莫尔兹比港', 'Порт-Морсби');
const APIA = L('อาเปีย', 'アピア', '아피아', '阿皮亚', 'Апиа');
const NUKUALOFA = L('นูกูอาโลฟา', 'ヌクアロファ', '누쿠알로파', '努库阿洛法', 'Нукуалофа');
const HAGATNA = L('ฮากัตญา', 'ハガニア', '하갓냐', '阿加尼亚', 'Хагатна');
const SAIPAN = L('ไซปัน', 'サイパン', '사이판', '塞班', 'Сайпан');

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
  const lang = locale.split('-')[0] as keyof typeof loc;
  return loc[lang] ?? fallback;
}
