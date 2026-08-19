/** Local airport catalog for smart search: IATA, name, city, country, coords, aliases. */

export type AirportRec = {
  iata: string;
  name: string;
  city: string;
  country: string;
  countryName: string;
  lat: number;
  lon: number;
  aliases: string[];
};

/** ISO2 → display name (NL) + extra aliases. */
export const COUNTRY_META: Record<string, { name: string; aliases: string[] }> = {
  NL: { name: 'Nederland', aliases: ['netherlands', 'holland', 'nederland'] },
  BE: { name: 'België', aliases: ['belgium', 'belgie', 'belgië'] },
  DE: { name: 'Duitsland', aliases: ['germany', 'duitsland', 'deutschland'] },
  FR: { name: 'Frankrijk', aliases: ['france', 'frankrijk'] },
  GB: { name: 'Verenigd Koninkrijk', aliases: ['uk', 'united kingdom', 'england', 'britain', 'groot-brittannie', 'groot-brittannië'] },
  IE: { name: 'Ierland', aliases: ['ireland', 'ierland'] },
  ES: { name: 'Spanje', aliases: ['spain', 'spanje'] },
  PT: { name: 'Portugal', aliases: ['portugal'] },
  IT: { name: 'Italië', aliases: ['italy', 'italie', 'italië'] },
  CH: { name: 'Zwitserland', aliases: ['switzerland', 'zwitserland'] },
  AT: { name: 'Oostenrijk', aliases: ['austria', 'oostenrijk'] },
  PL: { name: 'Polen', aliases: ['poland', 'polen'] },
  SE: { name: 'Zweden', aliases: ['sweden', 'zweden'] },
  NO: { name: 'Noorwegen', aliases: ['norway', 'noorwegen'] },
  DK: { name: 'Denemarken', aliases: ['denmark', 'denemarken'] },
  FI: { name: 'Finland', aliases: ['finland'] },
  GR: { name: 'Griekenland', aliases: ['greece', 'griekenland'] },
  CZ: { name: 'Tsjechië', aliases: ['czech', 'czechia', 'tsjechie', 'tsjechië'] },
  HU: { name: 'Hongarije', aliases: ['hungary', 'hongarije'] },
  RO: { name: 'Roemenië', aliases: ['romania', 'roemenie', 'roemenië'] },
  TR: { name: 'Turkije', aliases: ['turkey', 'turkiye', 'turkije'] },
  RU: { name: 'Rusland', aliases: ['russia', 'rusland'] },
  UA: { name: 'Oekraïne', aliases: ['ukraine', 'oekraine', 'oekraïne'] },
  TH: { name: 'Thailand', aliases: ['thailand', 'ไทย'] },
  SG: { name: 'Singapore', aliases: ['singapore', 'singapura', 'sgp'] },
  MY: { name: 'Maleisië', aliases: ['malaysia', 'maleisie', 'maleisië'] },
  ID: { name: 'Indonesië', aliases: ['indonesia', 'indonesie', 'indonesië'] },
  VN: { name: 'Vietnam', aliases: ['vietnam'] },
  KH: { name: 'Cambodja', aliases: ['cambodia', 'cambodja'] },
  LA: { name: 'Laos', aliases: ['laos'] },
  MM: { name: 'Myanmar', aliases: ['myanmar', 'burma'] },
  PH: { name: 'Filipijnen', aliases: ['philippines', 'filipijnen'] },
  BN: { name: 'Brunei', aliases: ['brunei'] },
  CN: { name: 'China', aliases: ['china'] },
  HK: { name: 'Hongkong', aliases: ['hong kong', 'hongkong'] },
  TW: { name: 'Taiwan', aliases: ['taiwan'] },
  JP: { name: 'Japan', aliases: ['japan'] },
  KR: { name: 'Zuid-Korea', aliases: ['korea', 'south korea', 'zuid-korea'] },
  IN: { name: 'India', aliases: ['india'] },
  PK: { name: 'Pakistan', aliases: ['pakistan'] },
  BD: { name: 'Bangladesh', aliases: ['bangladesh'] },
  LK: { name: 'Sri Lanka', aliases: ['sri lanka', 'srilanka'] },
  NP: { name: 'Nepal', aliases: ['nepal'] },
  AE: { name: 'Verenigde Arabische Emiraten', aliases: ['uae', 'emirates', 'united arab emirates'] },
  QA: { name: 'Qatar', aliases: ['qatar'] },
  SA: { name: 'Saoedi-Arabië', aliases: ['saudi', 'saudi arabia', 'saoedi'] },
  BH: { name: 'Bahrein', aliases: ['bahrain', 'bahrein'] },
  OM: { name: 'Oman', aliases: ['oman'] },
  KW: { name: 'Koeweit', aliases: ['kuwait', 'koeweit'] },
  IL: { name: 'Israël', aliases: ['israel', 'israël'] },
  JO: { name: 'Jordanië', aliases: ['jordan', 'jordanie', 'jordanië'] },
  EG: { name: 'Egypte', aliases: ['egypt', 'egypte'] },
  ZA: { name: 'Zuid-Afrika', aliases: ['south africa', 'zuid-afrika'] },
  KE: { name: 'Kenia', aliases: ['kenya', 'kenia'] },
  MA: { name: 'Marokko', aliases: ['morocco', 'marokko'] },
  NG: { name: 'Nigeria', aliases: ['nigeria'] },
  TZ: { name: 'Tanzania', aliases: ['tanzania'] },
  ET: { name: 'Ethiopië', aliases: ['ethiopia', 'ethiopie', 'ethiopië'] },
  GH: { name: 'Ghana', aliases: ['ghana'] },
  US: { name: 'Verenigde Staten', aliases: ['usa', 'united states', 'america', 'verenigde staten'] },
  CA: { name: 'Canada', aliases: ['canada'] },
  MX: { name: 'Mexico', aliases: ['mexico'] },
  BR: { name: 'Brazilië', aliases: ['brazil', 'brazilie', 'brazilië'] },
  AR: { name: 'Argentinië', aliases: ['argentina', 'argentinie', 'argentinië'] },
  CL: { name: 'Chili', aliases: ['chile', 'chili'] },
  CO: { name: 'Colombia', aliases: ['colombia'] },
  PE: { name: 'Peru', aliases: ['peru'] },
  PA: { name: 'Panama', aliases: ['panama'] },
  AU: { name: 'Australië', aliases: ['australia', 'australie', 'australië'] },
  NZ: { name: 'Nieuw-Zeeland', aliases: ['new zealand', 'nieuw-zeeland'] },
  FJ: { name: 'Fiji', aliases: ['fiji'] },
  IS: { name: 'IJsland', aliases: ['iceland', 'ijsland'] },
  LU: { name: 'Luxemburg', aliases: ['luxembourg', 'luxemburg'] },
  HR: { name: 'Kroatië', aliases: ['croatia', 'kroatie', 'kroatië'] },
  RS: { name: 'Servië', aliases: ['serbia', 'servie', 'servië'] },
  BG: { name: 'Bulgarije', aliases: ['bulgaria', 'bulgarije'] },
  CY: { name: 'Cyprus', aliases: ['cyprus'] },
  MT: { name: 'Malta', aliases: ['malta'] },
  EE: { name: 'Estland', aliases: ['estonia', 'estland'] },
  LV: { name: 'Letland', aliases: ['latvia', 'letland'] },
  LT: { name: 'Litouwen', aliases: ['lithuania', 'litouwen'] },
  SK: { name: 'Slowakije', aliases: ['slovakia', 'slowakije'] },
  SI: { name: 'Slovenië', aliases: ['slovenia', 'slovenie', 'slovenië'] },
  GE: { name: 'Georgië', aliases: ['georgia', 'georgie', 'georgië'] },
  AZ: { name: 'Azerbeidzjan', aliases: ['azerbaijan', 'azerbeidzjan'] },
  KZ: { name: 'Kazachstan', aliases: ['kazakhstan', 'kazachstan'] },
  UZ: { name: 'Oezbekistan', aliases: ['uzbekistan', 'oezbekistan'] },
  MN: { name: 'Mongolië', aliases: ['mongolia', 'mongolie', 'mongolië'] },
  MO: { name: 'Macau', aliases: ['macau', 'macao'] },
  MV: { name: 'Malediven', aliases: ['maldives', 'malediven'] },
  IR: { name: 'Iran', aliases: ['iran'] },
  IQ: { name: 'Irak', aliases: ['iraq', 'irak'] },
  LB: { name: 'Libanon', aliases: ['lebanon', 'libanon'] },
  TN: { name: 'Tunesië', aliases: ['tunisia', 'tunesie', 'tunesië'] },
  DZ: { name: 'Algerije', aliases: ['algeria', 'algerije'] },
  SN: { name: 'Senegal', aliases: ['senegal'] },
  MU: { name: 'Mauritius', aliases: ['mauritius'] },
  RE: { name: 'Réunion', aliases: ['reunion', 'réunion'] },
  SC: { name: 'Seychellen', aliases: ['seychelles', 'seychellen'] },
  RW: { name: 'Rwanda', aliases: ['rwanda'] },
  UG: { name: 'Oeganda', aliases: ['uganda', 'oeganda'] },
  NA: { name: 'Namibië', aliases: ['namibia', 'namibie', 'namibië'] },
  BW: { name: 'Botswana', aliases: ['botswana'] },
  MZ: { name: 'Mozambique', aliases: ['mozambique'] },
  AO: { name: 'Angola', aliases: ['angola'] },
  CI: { name: 'Ivoorkust', aliases: ['ivory coast', 'cote divoire', 'ivoorkust'] },
  CR: { name: 'Costa Rica', aliases: ['costa rica'] },
  CU: { name: 'Cuba', aliases: ['cuba'] },
  DO: { name: 'Dominicaanse Republiek', aliases: ['dominican republic', 'dominicaanse'] },
  JM: { name: 'Jamaica', aliases: ['jamaica'] },
  PR: { name: 'Puerto Rico', aliases: ['puerto rico'] },
  BS: { name: 'Bahama\'s', aliases: ['bahamas'] },
  TT: { name: 'Trinidad en Tobago', aliases: ['trinidad'] },
  UY: { name: 'Uruguay', aliases: ['uruguay'] },
  EC: { name: 'Ecuador', aliases: ['ecuador'] },
  VE: { name: 'Venezuela', aliases: ['venezuela'] },
  PY: { name: 'Paraguay', aliases: ['paraguay'] },
  BO: { name: 'Bolivia', aliases: ['bolivia'] },
  GT: { name: 'Guatemala', aliases: ['guatemala'] },
  SV: { name: 'El Salvador', aliases: ['el salvador'] },
  HN: { name: 'Honduras', aliases: ['honduras'] },
  NI: { name: 'Nicaragua', aliases: ['nicaragua'] },
  AW: { name: 'Aruba', aliases: ['aruba'] },
  CW: { name: 'Curaçao', aliases: ['curacao', 'curaçao'] },
  SX: { name: 'Sint Maarten', aliases: ['sint maarten', 'st maarten'] },
  PF: { name: 'Frans-Polynesië', aliases: ['tahiti', 'french polynesia'] },
  NC: { name: 'Nieuw-Caledonië', aliases: ['new caledonia'] },
  PG: { name: 'Papoea-Nieuw-Guinea', aliases: ['papua new guinea'] },
  WS: { name: 'Samoa', aliases: ['samoa'] },
  TO: { name: 'Tonga', aliases: ['tonga'] },
  GU: { name: 'Guam', aliases: ['guam'] },
  MP: { name: 'Noordelijke Marianen', aliases: ['saipan'] },
};

type Row = [string, string, string, string, number, number, string[]?];

const ROWS: Row[] = [
  ['AMS','Amsterdam Airport Schiphol','Amsterdam','NL',52.3105,4.7683,['schiphol']],
  ['RTM','Rotterdam The Hague','Rotterdam','NL',51.9569,4.4372,['den haag','the hague']],
  ['EIN','Eindhoven Airport','Eindhoven','NL',51.4501,5.3745],
  ['BRU','Brussels Airport','Brussel','BE',50.9014,4.4844,['brussels','brussel','zaventem']],
  ['CRL','Brussels South Charleroi','Charleroi','BE',50.4592,4.4538],
  ['FRA','Frankfurt Airport','Frankfurt','DE',50.0379,8.5622],
  ['MUC','Munich Airport','München','DE',48.3538,11.7861,['munich','munchen']],
  ['BER','Berlin Brandenburg','Berlijn','DE',52.3667,13.5033,['berlin','berlijn']],
  ['DUS','Düsseldorf Airport','Düsseldorf','DE',51.2895,6.7668,['dusseldorf']],
  ['HAM','Hamburg Airport','Hamburg','DE',53.6304,9.9882],
  ['CGN','Cologne Bonn','Keulen','DE',50.8659,7.1427,['cologne','keulen','bonn']],
  ['STR','Stuttgart Airport','Stuttgart','DE',48.6899,9.2220],
  ['CDG','Paris Charles de Gaulle','Parijs','FR',49.0097,2.5479,['paris','parijs','charles de gaulle']],
  ['ORY','Paris Orly','Parijs','FR',48.7233,2.3794,['orly']],
  ['NCE','Nice Côte d\'Azur','Nice','FR',43.6584,7.2178],
  ['LYS','Lyon-Saint Exupéry','Lyon','FR',45.7256,5.0811],
  ['MRS','Marseille Provence','Marseille','FR',43.4393,5.2214],
  ['LHR','London Heathrow','Londen','GB',51.4700,-0.4543,['london','londen','heathrow']],
  ['LGW','London Gatwick','Londen','GB',51.1537,-0.1821,['gatwick']],
  ['STN','London Stansted','Londen','GB',51.8860,0.2389,['stansted']],
  ['LCY','London City','Londen','GB',51.5053,0.0553],
  ['MAN','Manchester Airport','Manchester','GB',53.3537,-2.2750],
  ['EDI','Edinburgh Airport','Edinburgh','GB',55.9500,-3.3725],
  ['DUB','Dublin Airport','Dublin','IE',53.4213,-6.2701],
  ['MAD','Madrid-Barajas','Madrid','ES',40.4983,-3.5676,['barajas']],
  ['BCN','Barcelona-El Prat','Barcelona','ES',41.2971,2.0785,['el prat']],
  ['AGP','Málaga Airport','Málaga','ES',36.6749,-4.4991,['malaga']],
  ['PMI','Palma de Mallorca','Palma','ES',39.5517,2.7388,['mallorca']],
  ['LIS','Lisbon Humberto Delgado','Lissabon','PT',38.7742,-9.1342,['lisbon','lissabon']],
  ['OPO','Porto Airport','Porto','PT',41.2481,-8.6814],
  ['FCO','Rome Fiumicino','Rome','IT',41.8003,12.2389,['roma','fiumicino']],
  ['MXP','Milan Malpensa','Milaan','IT',45.6306,8.7281,['milan','milaan','malpensa']],
  ['LIN','Milan Linate','Milaan','IT',45.4451,9.2767,['linate']],
  ['VCE','Venice Marco Polo','Venetië','IT',45.5053,12.3519,['venice','venetie','venetië']],
  ['NAP','Naples Airport','Napels','IT',40.8860,14.2908,['naples','napels']],
  ['ZRH','Zurich Airport','Zürich','CH',47.4581,8.5555,['zurich']],
  ['GVA','Geneva Airport','Genève','CH',46.2381,6.1089,['geneva','geneve','genève']],
  ['VIE','Vienna International','Wenen','AT',48.1103,16.5697,['vienna','wenen']],
  ['WAW','Warsaw Chopin','Warschau','PL',52.1657,20.9671,['warsaw','warschau']],
  ['ARN','Stockholm Arlanda','Stockholm','SE',59.6519,17.9186,['arlanda']],
  ['OSL','Oslo Gardermoen','Oslo','NO',60.1939,11.1004],
  ['CPH','Copenhagen Airport','Kopenhagen','DK',55.6180,12.6560,['copenhagen','kopenhagen']],
  ['HEL','Helsinki-Vantaa','Helsinki','FI',60.3172,24.9633],
  ['ATH','Athens International','Athene','GR',37.9364,23.9445,['athens','athene']],
  ['PRG','Prague Václav Havel','Praag','CZ',50.1008,14.2600,['prague','praag']],
  ['BUD','Budapest Ferenc Liszt','Boedapest','HU',47.4394,19.2618,['budapest','boedapest']],
  ['OTP','Bucharest Otopeni','Boekarest','RO',44.5711,26.0850,['bucharest','boekarest']],
  ['IST','Istanbul Airport','Istanbul','TR',41.2753,28.7519],
  ['SAW','Istanbul Sabiha Gökçen','Istanbul','TR',40.8986,29.3092,['sabiha']],
  ['AYT','Antalya Airport','Antalya','TR',36.8987,30.8005],
  ['SVO','Moscow Sheremetyevo','Moskou','RU',55.9726,37.4146,['moscow','moskou']],
  ['KBP','Kyiv Boryspil','Kiev','UA',50.3450,30.8947,['kyiv','kiev']],
  ['KEF','Keflavík Airport','Reykjavik','IS',63.9850,-22.6056,['iceland','reykjavik']],
  ['LUX','Luxembourg Airport','Luxemburg','LU',49.6233,6.2044],
  ['ZAG','Zagreb Airport','Zagreb','HR',45.7429,16.0688],
  ['BEG','Belgrade Nikola Tesla','Belgrado','RS',44.8184,20.3091,['belgrade','belgrado']],
  ['SOF','Sofia Airport','Sofia','BG',42.6952,23.4062],
  ['LCA','Larnaca Airport','Larnaca','CY',34.8751,33.6249],
  ['MLA','Malta International','Valletta','MT',35.8575,14.4775],
  ['TLL','Tallinn Airport','Tallinn','EE',59.4133,24.8328],
  ['RIX','Riga Airport','Riga','LV',56.9236,23.9711],
  ['VNO','Vilnius Airport','Vilnius','LT',54.6341,25.2858],
  ['BTS','Bratislava Airport','Bratislava','SK',48.1702,17.2127],
  ['LJU','Ljubljana Airport','Ljubljana','SI',46.2237,14.4576],
  ['TBS','Tbilisi Airport','Tbilisi','GE',41.6692,44.9547],
  ['GYD','Baku Heydar Aliyev','Bakoe','AZ',40.4675,50.0467,['baku','bakoe']],
  ['NQZ','Astana Nazarbayev','Astana','KZ',51.0273,71.4670],
  ['TAS','Tashkent Airport','Tasjkent','UZ',41.2579,69.2812,['tashkent','tasjkent']],
  ['ULN','Ulaanbaatar Chinggis Khaan','Ulaanbaatar','MN',47.8431,106.7666],

  ['BKK','Suvarnabhumi Airport','Bangkok','TH',13.6900,100.7501,['krung thep','krungthep','suvarnabhumi','กรุงเทพ']],
  ['DMK','Don Mueang Airport','Bangkok','TH',13.9126,100.6067,['don mueang','donmueang']],
  ['HKT','Phuket Airport','Phuket','TH',8.1132,98.3017],
  ['CNX','Chiang Mai Airport','Chiang Mai','TH',18.7668,98.9628,['chiangmai']],
  ['USM','Samui Airport','Koh Samui','TH',9.5478,100.0623,['samui','ko samui','koh samui']],
  ['KBV','Krabi Airport','Krabi','TH',8.0992,98.9863],
  ['HDY','Hat Yai Airport','Hat Yai','TH',6.9332,100.3930,['hatyai']],
  ['UTP','U-Tapao Airport','Pattaya','TH',12.6799,101.0050,['pattaya','utapao']],
  ['CEI','Chiang Rai Airport','Chiang Rai','TH',19.9523,99.8829],
  ['SIN','Singapore Changi','Singapore','SG',1.3644,103.9915,['changi']],
  ['KUL','Kuala Lumpur International','Kuala Lumpur','MY',2.7456,101.7099,['klia']],
  ['SZB','Sultan Abdul Aziz Shah','Kuala Lumpur','MY',3.1306,101.5493,['subang']],
  ['PEN','Penang Airport','Penang','MY',5.2971,100.2769,['georgetown']],
  ['BKI','Kota Kinabalu Airport','Kota Kinabalu','MY',5.9372,116.0510],
  ['CGK','Soekarno-Hatta','Jakarta','ID',-6.1256,106.6558],
  ['DPS','Ngurah Rai','Denpasar','ID',-8.7482,115.1672,['bali']],
  ['SUB','Juanda Airport','Surabaya','ID',-7.3798,112.7869],
  ['SGN','Tan Son Nhat','Ho Chi Minh','VN',10.8188,106.6520,['saigon','ho chi minh city']],
  ['HAN','Noi Bai','Hanoi','VN',21.2212,105.8072],
  ['DAD','Da Nang Airport','Da Nang','VN',16.0439,108.1994],
  ['PNH','Phnom Penh Airport','Phnom Penh','KH',11.5466,104.8441],
  ['REP','Siem Reap Angkor','Siem Reap','KH',13.4107,103.8128],
  ['VTE','Wattay Airport','Vientiane','LA',17.9883,102.5633],
  ['RGN','Yangon Airport','Yangon','MM',16.9073,96.1332,['rangoon']],
  ['MNL','Ninoy Aquino','Manila','PH',14.5086,121.0194],
  ['CEB','Mactan-Cebu','Cebu','PH',10.3075,123.9794],
  ['BWN','Brunei Airport','Bandar Seri Begawan','BN',4.9442,114.9283],

  ['PEK','Beijing Capital','Peking','CN',40.0801,116.5846,['beijing','peking']],
  ['PKX','Beijing Daxing','Peking','CN',39.5099,116.4105,['daxing']],
  ['PVG','Shanghai Pudong','Shanghai','CN',31.1434,121.8052,['pudong']],
  ['SHA','Shanghai Hongqiao','Shanghai','CN',31.1979,121.3363,['hongqiao']],
  ['CAN','Guangzhou Baiyun','Guangzhou','CN',23.3924,113.2988,['canton']],
  ['SZX','Shenzhen Bao\'an','Shenzhen','CN',22.6393,113.8107],
  ['HKG','Hong Kong International','Hongkong','HK',22.3080,113.9185],
  ['TPE','Taiwan Taoyuan','Taipei','TW',25.0777,121.2328,['taoyuan']],
  ['MFM','Macau Airport','Macau','MO',22.1496,113.5915],
  ['NRT','Tokyo Narita','Tokio','JP',35.7647,140.3864,['tokyo','tokio','narita']],
  ['HND','Tokyo Haneda','Tokio','JP',35.5494,139.7798,['haneda']],
  ['KIX','Osaka Kansai','Osaka','JP',34.4342,135.2440,['kansai']],
  ['ITM','Osaka Itami','Osaka','JP',34.7855,135.4382,['itami']],
  ['CTS','New Chitose','Sapporo','JP',42.7752,141.6923],
  ['FUK','Fukuoka Airport','Fukuoka','JP',33.5859,130.4507],
  ['ICN','Seoul Incheon','Seoel','KR',37.4602,126.4407,['seoul','seoel','incheon']],
  ['GMP','Seoul Gimpo','Seoel','KR',37.5583,126.7906,['gimpo']],
  ['DEL','Indira Gandhi','Delhi','IN',28.5562,77.1000,['new delhi']],
  ['BOM','Chhatrapati Shivaji','Mumbai','IN',19.0896,72.8656,['bombay']],
  ['BLR','Kempegowda','Bengaluru','IN',13.1986,77.7066,['bangalore']],
  ['MAA','Chennai Airport','Chennai','IN',12.9944,80.1805,['madras']],
  ['CCU','Netaji Subhas Chandra Bose','Kolkata','IN',22.6547,88.4467,['calcutta']],
  ['HYD','Rajiv Gandhi','Hyderabad','IN',17.2313,78.4299],
  ['ISB','Islamabad Airport','Islamabad','PK',33.5490,72.8257],
  ['KHI','Jinnah Airport','Karachi','PK',24.9065,67.1608],
  ['DAC','Hazrat Shahjalal','Dhaka','BD',23.8433,90.3978],
  ['CMB','Bandaranaike','Colombo','LK',7.1808,79.8841],
  ['KTM','Tribhuvan','Kathmandu','NP',27.6966,85.3591],
  ['MLE','Velana Airport','Malé','MV',4.1918,73.5290,['male','maldives']],

  ['DXB','Dubai International','Dubai','AE',25.2532,55.3657],
  ['DWC','Al Maktoum','Dubai','AE',24.8964,55.1614],
  ['AUH','Abu Dhabi International','Abu Dhabi','AE',24.4330,54.6511],
  ['DOH','Hamad International','Doha','QA',25.2731,51.6081],
  ['RUH','King Khalid','Riyadh','SA',24.9576,46.6988],
  ['JED','King Abdulaziz','Jeddah','SA',21.6796,39.1565],
  ['BAH','Bahrain International','Manama','BH',26.2708,50.6336],
  ['MCT','Muscat Airport','Muscat','OM',23.5933,58.2844],
  ['KWI','Kuwait International','Koeweit','KW',29.2266,47.9689],
  ['TLV','Ben Gurion','Tel Aviv','IL',32.0114,34.8867,['telaviv']],
  ['AMM','Queen Alia','Amman','JO',31.7226,35.9932],
  ['IKA','Imam Khomeini','Teheran','IR',35.4161,51.1522,['tehran','teheran']],
  ['BGW','Baghdad Airport','Bagdad','IQ',33.2625,44.2346,['baghdad','bagdad']],
  ['BEY','Beirut Rafic Hariri','Beiroet','LB',33.8209,35.4884,['beirut','beiroet']],

  ['CAI','Cairo International','Caïro','EG',30.1219,31.4056,['cairo','caïro']],
  ['JNB','O.R. Tambo','Johannesburg','ZA',-26.1392,28.2460],
  ['CPT','Cape Town Airport','Kaapstad','ZA',-33.9648,18.6017,['cape town','kaapstad']],
  ['NBO','Jomo Kenyatta','Nairobi','KE',-1.3192,36.9278],
  ['CMN','Mohammed V','Casablanca','MA',33.3675,-7.5900],
  ['LOS','Murtala Muhammed','Lagos','NG',6.5774,3.3212],
  ['DAR','Julius Nyerere','Dar es Salaam','TZ',-6.8781,39.2026],
  ['ADD','Addis Ababa Bole','Addis Abeba','ET',8.9779,38.7993,['addis ababa']],
  ['ACC','Kotoka','Accra','GH',5.6052,-0.1668],
  ['TUN','Tunis-Carthage','Tunis','TN',36.8510,10.2272],
  ['ALG','Houari Boumediene','Algiers','DZ',36.6910,3.2154],
  ['DSS','Blaise Diagne','Dakar','SN',14.6700,-17.0733],
  ['MRU','Sir Seewoosagur Ramgoolam','Port Louis','MU',-20.4302,57.6836],
  ['SEZ','Seychelles Airport','Victoria','SC',-4.6743,55.5218],
  ['KGL','Kigali Airport','Kigali','RW',-1.9686,30.1395],
  ['EBB','Entebbe Airport','Kampala','UG',0.0424,32.4435],
  ['WDH','Hosea Kutako','Windhoek','NA',-22.4799,17.4709],
  ['GBE','Sir Seretse Khama','Gaborone','BW',-24.5552,25.9182],
  ['MPM','Maputo Airport','Maputo','MZ',-25.9208,32.5726],
  ['LAD','Quatro de Fevereiro','Luanda','AO',-8.8584,13.2312],
  ['ABJ','Félix-Houphouët-Boigny','Abidjan','CI',5.2614,-3.9263],

  ['JFK','John F. Kennedy','New York','US',40.6413,-73.7781,['new york','nyc']],
  ['EWR','Newark Liberty','New York','US',40.6895,-74.1745,['newark']],
  ['LGA','LaGuardia','New York','US',40.7769,-73.8740,['laguardia']],
  ['LAX','Los Angeles International','Los Angeles','US',33.9416,-118.4085],
  ['SFO','San Francisco International','San Francisco','US',37.6213,-122.3790],
  ['ORD','Chicago O\'Hare','Chicago','US',41.9742,-87.9073,['ohare']],
  ['MIA','Miami International','Miami','US',25.7959,-80.2870],
  ['DFW','Dallas/Fort Worth','Dallas','US',32.8998,-97.0403],
  ['ATL','Hartsfield-Jackson','Atlanta','US',33.6407,-84.4277],
  ['SEA','Seattle-Tacoma','Seattle','US',47.4502,-122.3088],
  ['BOS','Logan International','Boston','US',42.3656,-71.0096],
  ['IAD','Washington Dulles','Washington','US',38.9531,-77.4565,['dulles']],
  ['DCA','Ronald Reagan National','Washington','US',38.8512,-77.0402],
  ['DEN','Denver International','Denver','US',39.8561,-104.6737],
  ['LAS','Harry Reid','Las Vegas','US',36.0840,-115.1537],
  ['MCO','Orlando International','Orlando','US',28.4312,-81.3081],
  ['HNL','Daniel K. Inouye','Honolulu','US',21.3187,-157.9225],
  ['YYZ','Toronto Pearson','Toronto','CA',43.6777,-79.6248],
  ['YVR','Vancouver International','Vancouver','CA',49.1947,-123.1792],
  ['YUL','Montréal-Trudeau','Montreal','CA',45.4706,-73.7408,['montreal']],
  ['YYC','Calgary International','Calgary','CA',51.1215,-114.0076],
  ['MEX','Mexico City International','Mexico-Stad','MX',19.4363,-99.0721,['mexico city']],
  ['CUN','Cancún Airport','Cancún','MX',21.0365,-86.8771,['cancun']],
  ['GRU','São Paulo Guarulhos','São Paulo','BR',-23.4356,-46.4731,['sao paulo','saopaulo']],
  ['GIG','Rio de Janeiro Galeão','Rio de Janeiro','BR',-22.8090,-43.2506,['rio']],
  ['BSB','Brasília Airport','Brasilia','BR',-15.8692,-47.9208],
  ['EZE','Ministro Pistarini','Buenos Aires','AR',-34.8222,-58.5358],
  ['SCL','Arturo Merino Benítez','Santiago','CL',-33.3930,-70.7858],
  ['BOG','El Dorado','Bogotá','CO',4.7016,-74.1469,['bogota']],
  ['LIM','Jorge Chávez','Lima','PE',-12.0219,-77.1143],
  ['PTY','Tocumen','Panama-Stad','PA',9.0714,-79.3835],
  ['MVD','Carrasco','Montevideo','UY',-34.8384,-56.0308],
  ['UIO','Mariscal Sucre','Quito','EC',-0.1235,-78.3576],
  ['CCS','Simón Bolívar','Caracas','VE',10.6012,-66.9912],
  ['ASU','Silvio Pettirossi','Asunción','PY',-25.2398,-57.5191],
  ['VVI','Viru Viru','Santa Cruz','BO',-17.6448,-63.1354],
  ['GUA','La Aurora','Guatemala-Stad','GT',14.5833,-90.5275],
  ['SAL','Óscar Arnulfo Romero','San Salvador','SV',13.4409,-89.0557],
  ['TGU','Toncontín','Tegucigalpa','HN',14.0609,-87.2172],
  ['MGA','Augusto C. Sandino','Managua','NI',12.1415,-86.1682],
  ['SJO','Juan Santamaría','San José','CR',9.9939,-84.2088,['san jose']],
  ['HAV','José Martí','Havana','CU',22.9892,-82.4091],
  ['SDQ','Las Américas','Santo Domingo','DO',18.4297,-69.6689],
  ['KIN','Norman Manley','Kingston','JM',17.9357,-76.7875],
  ['SJU','Luis Muñoz Marín','San Juan','PR',18.4394,-66.0018],
  ['NAS','Lynden Pindling','Nassau','BS',25.0390,-77.4662],
  ['POS','Piarco','Port of Spain','TT',10.5954,-61.3372],
  ['AUA','Queen Beatrix','Oranjestad','AW',12.5014,-70.0152],
  ['CUR','Curaçao Airport','Willemstad','CW',12.1889,-68.9598,['curacao']],
  ['SXM','Princess Juliana','Philipsburg','SX',18.0410,-63.1089],

  ['SYD','Sydney Kingsford Smith','Sydney','AU',-33.9399,151.1753],
  ['MEL','Melbourne Airport','Melbourne','AU',-37.6733,144.8433],
  ['BNE','Brisbane Airport','Brisbane','AU',-27.3842,153.1175],
  ['PER','Perth Airport','Perth','AU',-31.9403,115.9669],
  ['ADL','Adelaide Airport','Adelaide','AU',-34.9450,138.5306],
  ['AKL','Auckland Airport','Auckland','NZ',-37.0082,174.7850],
  ['WLG','Wellington Airport','Wellington','NZ',-41.3272,174.8053],
  ['CHC','Christchurch Airport','Christchurch','NZ',-43.4894,172.5320],
  ['NAN','Nadi Airport','Nadi','FJ',-17.7554,177.4434],
  ['PPT','Faa\'a Airport','Papeete','PF',-17.5537,-149.6111,['tahiti']],
  ['NOU','La Tontouta','Nouméa','NC',-22.0146,166.2130],
  ['POM','Jacksons','Port Moresby','PG',-9.4434,147.2202],
  ['APW','Faleolo','Apia','WS',-13.8297,-172.0082],
  ['TBU','Fua\'amotu','Nuku\'alofa','TO',-21.2412,-175.1496],
  ['GUM','Antonio B. Won Pat','Hagåtña','GU',13.4834,144.7960],
  ['SPN','Saipan Airport','Saipan','MP',15.1190,145.7294],
];

export const AIRPORTS: AirportRec[] = ROWS.map(([iata, name, city, country, lat, lon, aliases]) => ({
  iata,
  name,
  city,
  country,
  countryName: COUNTRY_META[country]?.name || country,
  lat,
  lon,
  aliases: aliases || [],
}));

const BY_IATA = new Map(AIRPORTS.map(a => [a.iata, a]));

export function airportRecByIata(iata?: string): AirportRec | undefined {
  return BY_IATA.get(String(iata || '').toUpperCase());
}

const PLACEHOLDER_IATA = /^(UNK|\?\?\?|NULL|UNKNOWN|N\/A|NA|—|-|–)$/;

/** Display IATA only — never UNK / Unknown placeholders. */
export function displayAirportIata(code?: string): string {
  const raw = String(code || '').trim().toUpperCase();
  if (!raw || PLACEHOLDER_IATA.test(raw)) return '';
  if (/^[A-Z]{3}$/.test(raw)) return raw;
  if (/^[A-Z]{4}$/.test(raw)) return raw;
  return '';
}

/** `AMS → JFK`, or just the known side when the other is missing. Never `→ UNK`. */
export function formatRouteHint(from?: string, to?: string): string {
  const a = displayAirportIata(from);
  const b = displayAirportIata(to);
  if (a && b) return `${a} → ${b}`;
  return a || b;
}

export function countryDisplay(cc?: string): string {
  const c = String(cc || '').toUpperCase();
  return COUNTRY_META[c]?.name || c;
}

export function normKey(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_'’.,/]+/g, '');
}

/** Common country search aliases → English name used in COUNTRY_META. */
const COUNTRY_QUERY_ALIASES: Record<string, string> = {
  polen: 'poland',
  duitsland: 'germany',
  frankrijk: 'france',
  spanje: 'spain',
  italie: 'italy',
  belgie: 'belgium',
  oostenrijk: 'austria',
  zwitserland: 'switzerland',
  griekenland: 'greece',
  turkije: 'turkey',
  'verenigde staten': 'united states',
  'verenigde arabische emiraten': 'united arab emirates',
  'groot brittannie': 'united kingdom',
  engeland: 'united kingdom',
  'ไทย': 'thailand',
  'ญี่ปุ่น': 'japan',
  '중국': 'china',
  '한국': 'korea',
};

const COUNTRY_ALIAS_LOOKUP = (() => {
  const map = new Map<string, string>();
  for (const [key, value] of Object.entries(COUNTRY_QUERY_ALIASES)) {
    map.set(key.toLowerCase().trim(), value);
    map.set(normKey(key), value);
  }
  return map;
})();

/** Map localized / informal country queries to canonical English search terms. */
export function normalizeCountryQuery(raw: string): string {
  const q = String(raw || '').trim().toLowerCase();
  if (!q) return q;
  return COUNTRY_ALIAS_LOOKUP.get(q) || COUNTRY_ALIAS_LOOKUP.get(normKey(q)) || q;
}

function countryCodesForQuery(q: string, qc: string): string[] {
  const hits: string[] = [];
  for (const [cc, meta] of Object.entries(COUNTRY_META)) {
    const names = [meta.name, cc, ...meta.aliases].map(normKey);
    if (names.some(n => n === qc || (qc.length >= 2 && n.startsWith(qc)) || (qc.length >= 4 && n.includes(qc)))) {
      hits.push(cc);
    }
  }
  return hits;
}

function countryMetaAliasesMatch(meta: { name: string; aliases: string[] }, qc: string): boolean {
  return [meta.name, ...meta.aliases].some(a => normKey(a) === qc);
}

export type PlaceHit = {
  kind: 'airport' | 'country';
  iata?: string;
  iatas: string[];
  label: string;
  sublabel: string;
  score: number;
};

export function matchPlaces(raw: string, limit = 6): PlaceHit[] {
  const q = String(raw || '').trim();
  if (q.length < 2) return [];
  const normalizedCountryQ = normalizeCountryQuery(q);
  const ql = normalizedCountryQ.toLowerCase();
  const qc = normKey(normalizedCountryQ);
  const qcRaw = normKey(q);
  const out: PlaceHit[] = [];

  if (/^[a-z]{3}$/i.test(q)) {
    const rec = BY_IATA.get(q.toUpperCase());
    if (rec) {
      out.push({
        kind: 'airport',
        iata: rec.iata,
        iatas: [rec.iata],
        label: placeLabel(rec),
        sublabel: rec.countryName,
        score: 100,
      });
    }
  }

  for (const rec of AIRPORTS) {
    const city = normKey(rec.city);
    const name = normKey(rec.name);
    const countryName = normKey(rec.countryName);
    const countryCode = normKey(rec.country);
    const countryMeta = COUNTRY_META[rec.country];
    const countryTerms = [
      countryName,
      countryCode,
      ...(countryMeta?.aliases || []).map(normKey),
    ];
    const aliasHit = rec.aliases.some(a => {
      const n = normKey(a);
      return n === qc || n === qcRaw || (qc.length >= 2 && n.startsWith(qc)) || (qc.length >= 3 && n.includes(qc));
    });
    let score = 0;
    if (rec.iata.toLowerCase() === ql) score = 100;
    else if (rec.iata.toLowerCase().startsWith(ql)) score = 92;
    else if (city === qc || city === qcRaw) score = 88;
    else if (city.startsWith(qc) || city.startsWith(qcRaw)) score = 82;
    else if (aliasHit && rec.aliases.some(a => normKey(a) === qc || normKey(a) === qcRaw)) score = 80;
    else if (aliasHit) score = 74;
    else if (countryTerms.some(t => t === qc || t === qcRaw)) score = 78;
    else if (countryTerms.some(t => (qc.length >= 3 && t.startsWith(qc)) || (qcRaw.length >= 3 && t.startsWith(qcRaw)))) score = 72;
    else if (countryTerms.some(t => (qc.length >= 4 && t.includes(qc)) || (qcRaw.length >= 4 && t.includes(qcRaw)))) score = 66;
    else if (name.startsWith(qc) || name.startsWith(qcRaw)) score = 68;
    else if (qc.length >= 3 && (city.includes(qc) || name.includes(qc))) score = 55;
    else if (qcRaw.length >= 3 && qcRaw !== qc && (city.includes(qcRaw) || name.includes(qcRaw))) score = 50;
    if (!score) continue;
    out.push({
      kind: 'airport',
      iata: rec.iata,
      iatas: [rec.iata],
      label: placeLabel(rec),
      sublabel: rec.countryName,
      score,
    });
  }

  for (const cc of [...countryCodesForQuery(normalizedCountryQ, qc), ...countryCodesForQuery(q, qcRaw)]) {
    const iatas = AIRPORTS.filter(a => a.country === cc).map(a => a.iata);
    if (!iatas.length) continue;
    const meta = COUNTRY_META[cc];
    if (!meta) continue;
    out.push({
      kind: 'country',
      iatas,
      label: meta.name,
      sublabel: iatas.slice(0, 4).join(', '),
      score: qc === normKey(meta.name) || countryMetaAliasesMatch(meta, qc) ? 86 : 62,
    });
  }

  out.sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const uniq: PlaceHit[] = [];
  for (const h of out) {
    const id = h.kind === 'country' ? `c:${h.label}` : `a:${h.iata}`;
    if (seen.has(id)) continue;
    seen.add(id);
    uniq.push(h);
    if (uniq.length >= limit) break;
  }
  return uniq;
}

function placeLabel(rec: AirportRec): string {
  const short = shortName(rec);
  if (!short || short.toLowerCase() === rec.city.toLowerCase()) {
    return `${rec.city} (${rec.iata})`;
  }
  return `${rec.city} ${short} (${rec.iata})`;
}

function shortName(rec: AirportRec): string {
  return rec.name.replace(/\s+Airport$/i, '').replace(/\s+International$/i, '').trim();
}

export function searchAirportsLocal(raw: string, limit = 50): AirportRec[] {
  const hits = matchPlaces(raw, Math.max(limit, 8));
  const out: AirportRec[] = [];
  const seen = new Set<string>();
  for (const hit of hits) {
    if (hit.kind === 'airport' && hit.iata) {
      const rec = BY_IATA.get(hit.iata);
      if (rec && !seen.has(rec.iata)) {
        seen.add(rec.iata);
        out.push(rec);
      }
      continue;
    }
    for (const iata of hit.iatas) {
      const rec = BY_IATA.get(iata);
      if (rec && !seen.has(rec.iata)) {
        seen.add(rec.iata);
        out.push(rec);
      }
      if (out.length >= limit) return out;
    }
  }
  return out.slice(0, limit);
}

export function iatasForQuery(raw: string): string[] {
  const hits = matchPlaces(raw, 20);
  const codes = new Set<string>();
  for (const h of hits) h.iatas.forEach(c => codes.add(c));
  return [...codes];
}

export function resolvePlaceToIata(raw: string): string | null {
  const q = String(raw || '').trim();
  if (!q) return null;
  if (/^[A-Za-z]{3}$/.test(q)) {
    const rec = BY_IATA.get(q.toUpperCase());
    if (rec) return rec.iata;
  }
  const hits = matchPlaces(q, 4);
  const airport = hits.find(h => h.kind === 'airport' && h.iata);
  return airport?.iata || hits[0]?.iatas[0] || null;
}

export const POPULAR_ROUTES: { from: string; to: string }[] = [
  { from: 'AMS', to: 'BKK' },
  { from: 'AMS', to: 'SIN' },
  { from: 'AMS', to: 'KUL' },
  { from: 'BKK', to: 'HKT' },
  { from: 'BKK', to: 'SIN' },
  { from: 'SIN', to: 'BKK' },
  { from: 'KUL', to: 'SIN' },
  { from: 'LHR', to: 'AMS' },
  { from: 'CDG', to: 'AMS' },
  { from: 'DXB', to: 'AMS' },
];
