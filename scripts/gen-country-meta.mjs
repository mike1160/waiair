import { writeFileSync } from 'fs';
import { AIRPORT_ROWS as ROWS } from '../lib/airportsRows.generated.ts';

const by = new Map();
for (const [iata, , , cc] of ROWS) {
  if (!by.has(cc)) by.set(cc, []);
  by.get(cc).push(iata);
}
const iataSet = new Set(ROWS.map(r => r[0]));

const TWO = {
  JP: ['HND', 'NRT'],
  VN: ['SGN', 'HAN'],
  KR: ['ICN', 'GMP'],
  TW: ['TPE', 'KHH'],
  CN: ['PEK', 'PVG'],
};

const ONE = {
  AE: 'DXB', AF: 'KBL', AG: 'ANU', AI: 'AXA', AL: 'TIA', AM: 'EVN', AO: 'LAD',
  AR: 'EZE', AS: 'PPG', AT: 'VIE', AU: 'SYD', AW: 'AUA', AZ: 'GYD',
  BA: 'SJJ', BB: 'BGI', BD: 'DAC', BE: 'BRU', BF: 'OUA', BG: 'SOF', BH: 'BAH',
  BI: 'BJM', BJ: 'COO', BL: 'SBH', BM: 'BDA', BN: 'BWN', BO: 'LPB', BQ: 'BON',
  BR: 'GRU', BS: 'NAS', BT: 'PBH', BW: 'GBE', BY: 'MSQ', BZ: 'BZE',
  CA: 'YYZ', CC: 'CCK', CD: 'FIH', CF: 'BGF', CG: 'BZV', CH: 'ZRH', CI: 'ABJ',
  CK: 'RAR', CL: 'SCL', CM: 'DLA', CO: 'BOG', CR: 'SJO', CU: 'HAV', CV: 'RAI',
  CW: 'CUR', CX: 'XCH', CY: 'LCA', CZ: 'PRG',
  DE: 'FRA', DJ: 'JIB', DK: 'CPH', DM: 'DOM', DO: 'SDQ', DZ: 'ALG',
  EC: 'UIO', EE: 'TLL', EG: 'CAI', EH: 'EUN', ER: 'ASM', ES: 'MAD', ET: 'ADD',
  FI: 'HEL', FJ: 'NAN', FK: 'MPN', FM: 'PNI', FO: 'FAE', FR: 'CDG',
  GA: 'LBV', GB: 'LHR', GD: 'GND', GE: 'TBS', GF: 'CAY', GG: 'GCI', GH: 'ACC',
  GI: 'GIB', GL: 'GOH', GM: 'BJL', GN: 'CKY', GP: 'PTP', GQ: 'SSG', GR: 'ATH',
  GT: 'GUA', GU: 'GUM', GW: 'OXB', GY: 'GEO',
  HK: 'HKG', HN: 'TGU', HR: 'ZAG', HT: 'PAP', HU: 'BUD',
  ID: 'CGK', IE: 'DUB', IL: 'TLV', IM: 'IOM', IN: 'DEL', IO: 'NKW', IQ: 'BGW',
  IR: 'IKA', IS: 'KEF', IT: 'FCO',
  JE: 'JER', JM: 'KIN', JO: 'AMM',
  KE: 'NBO', KG: 'BSZ', KH: 'PNH', KI: 'TRW', KM: 'HAH', KN: 'SKB', KP: 'FNJ',
  KW: 'KWI', KY: 'GCM', KZ: 'ALA',
  LA: 'VTE', LB: 'BEY', LC: 'UVF', LK: 'CMB', LR: 'ROB', LS: 'MSU', LT: 'VNO',
  LU: 'LUX', LV: 'RIX', LY: 'MJI',
  MA: 'CMN', MD: 'RMO', ME: 'TGD', MF: 'SFG', MG: 'TNR', MH: 'MAJ', MK: 'SKP',
  ML: 'BKO', MM: 'RGN', MN: 'UBN', MO: 'MFM', MP: 'SPN', MQ: 'FDF', MR: 'NKC',
  MS: 'MNI', MT: 'MLA', MU: 'MRU', MV: 'MLE', MW: 'LLW', MX: 'MEX', MY: 'KUL',
  MZ: 'MPM',
  NA: 'WDH', NC: 'NOU', NE: 'NIM', NF: 'NLK', NG: 'LOS', NI: 'MGA', NL: 'AMS',
  NO: 'OSL', NP: 'KTM', NR: 'INU', NU: 'IUE', NZ: 'AKL',
  OM: 'MCT',
  PA: 'PTY', PE: 'LIM', PF: 'PPT', PG: 'POM', PH: 'MNL', PK: 'ISB', PL: 'WAW',
  PM: 'FSP', PR: 'SJU', PT: 'LIS', PW: 'ROR', PY: 'ASU',
  QA: 'DOH',
  RE: 'RUN', RO: 'OTP', RS: 'BEG', RU: 'SVO', RW: 'KGL',
  SA: 'RUH', SB: 'HIR', SC: 'SEZ', SD: 'KRT', SE: 'ARN', SG: 'SIN', SH: 'HLE',
  SI: 'LJU', SK: 'BTS', SL: 'FNA', SN: 'DSS', SO: 'MGQ', SR: 'PBM', SS: 'JUB',
  ST: 'TMS', SV: 'SAL', SX: 'SXM', SY: 'DAM', SZ: 'SHO',
  TC: 'PLS', TD: 'NDJ', TG: 'LFW', TH: 'BKK', TJ: 'DYU', TL: 'DIL', TM: 'ASB',
  TN: 'TUN', TO: 'TBU', TR: 'IST', TT: 'POS', TV: 'FUN', TZ: 'DAR',
  UA: 'KBP', UG: 'EBB', UM: 'MDY', US: 'JFK', UY: 'MVD', UZ: 'TAS',
  VC: 'SVD', VE: 'CCS', VG: 'EIS', VI: 'STT', VU: 'VLI',
  WF: 'WLS', WS: 'APW',
  XK: 'PRN',
  YE: 'SAH', YT: 'DZA',
  ZA: 'JNB', ZM: 'LUN', ZW: 'HRE',
};

const missingIata = [];
const missingCc = [];
const hubs = {};

for (const cc of [...by.keys()].sort()) {
  if (TWO[cc]) {
    hubs[cc] = TWO[cc];
    for (const i of TWO[cc]) {
      if (!iataSet.has(i) || !by.get(cc).includes(i)) missingIata.push(`${cc}:${i}`);
    }
    continue;
  }
  const one = ONE[cc];
  if (one) {
    if (!iataSet.has(one) || !by.get(cc).includes(one)) missingIata.push(`${cc}:${one}`);
    hubs[cc] = [one];
    continue;
  }
  const list = by.get(cc);
  if (list.length === 1) {
    hubs[cc] = [list[0]];
    continue;
  }
  missingCc.push(`${cc}(${list.length}:${list.slice(0, 6).join(',')})`);
}

if (missingIata.length || missingCc.length) {
  console.error('missing iata', missingIata);
  console.error('missing cc', missingCc);
  process.exit(1);
}

const extras = {
  NL: ['holland', 'nederland', 'netherlands'],
  GB: ['uk', 'england', 'britain', 'great britain', 'groot-brittannie', 'groot-brittannië', 'イギリス', '영국', '英国', 'อังกฤษ', 'inggris', 'anh'],
  US: ['usa', 'america', 'united states', 'verenigde staten', 'amerika', '미국', 'アメリカ', '美国', 'สหรัฐ', 'сша', 'amerika serikat', 'estados unidos'],
  KR: ['korea', 'south korea', 'zuid-korea', 'südkorea', 'sudkorea', 'corea', 'hàn quốc', 'han quoc', 'เกาหลี', '한국', '대한민국', '韓国', '韩国', '韓國', 'корея'],
  KP: ['north korea', 'noord-korea', 'nordkorea', 'corea del norte', 'เกาหลีเหนือ', '북한', '北朝鮮', '朝鲜', 'кндр'],
  TW: ['taiwan', '台湾', '台灣', '臺灣', '대만', '타이완', 'ไต้หวัน', 'đài loan', 'dai loan', 'тайвань', 'taiwán', 'formosa'],
  VN: ['vietnam', 'việt nam', 'viet nam', 'ベトナム', '베트남', '越南', 'เวียดนาม', 'вьетнам'],
  ID: ['indonesia', 'indonesie', 'indonesië', 'インドネシア', '인도네시아', '印度尼西亚', 'อินโดนีเซีย', 'индонезия'],
  JP: ['japan', 'ญี่ปุ่น', '日本', '일본', 'япония', 'jepang', 'japón', 'nhật bản', 'nhat ban'],
  CN: ['china', '中国', 'จีน', '중국', 'китай', 'tiongkok', 'trung quốc'],
  TH: ['thailand', 'ไทย', '泰国', 'タイ', '태국', 'тайланд', 'tailandia'],
  AE: ['uae', 'emirates', 'united arab emirates', 'verenigde arabische emiraten', 'emiratos'],
  SA: ['saudi', 'saudi arabia', 'saoedi', 'saoedi-arabië'],
  RU: ['russia', 'rusland', 'россия', 'ロシア', '러시아', '俄罗斯', 'รัสเซีย'],
  DE: ['germany', 'duitsland', 'deutschland', 'alemania', 'jerman', '독일', 'ドイツ', '德国', 'เยอรมนี', 'германия'],
  FR: ['france', 'frankrijk', 'frankreich', 'フランス', '프랑스', '法国', 'ฝรั่งเศส', 'франция', 'perancis', 'pháp'],
  ES: ['spain', 'spanje', 'spanien', 'españa', 'spanyol', '스페인', 'スペイン', '西班牙', 'สเปน', 'испания'],
  IT: ['italy', 'italie', 'italië', 'italien', 'italia', '이탈리아', 'イタリア', '意大利', 'อิตาลี', 'италия'],
  MY: ['malaysia', 'maleisie', 'maleisië', '말레이시아', 'マレーシア', '马来西亚', 'มาเลเซีย', 'малайзия'],
  PH: ['philippines', 'filipijnen', 'filipinas', '필리핀', 'フィリピン', '菲律宾', 'ฟิลิปปินส์', 'филиппины'],
  IN: ['india', 'indië', '인도', 'インド', '印度', 'อินเดีย', 'индия', 'hindia'],
  AU: ['australia', 'australie', 'australië', 'australien', '호주', 'オーストラリア', '澳大利亚', 'ออสเตรเลีย', 'австралия'],
  CA: ['canada', 'kanada', '캐나다', 'カナダ', '加拿大', 'แคนาดา', 'канада'],
  BR: ['brazil', 'brazilie', 'brazilië', 'brasil', 'brasilien', '브라질', 'ブラジル', '巴西', 'บราซิล', 'бразилия'],
  MX: ['mexico', 'méxico', 'mexiko', '멕시코', 'メキシコ', '墨西哥', 'เม็กซิโก', 'мексика'],
  EG: ['egypt', 'egypte', 'ägypten', 'egipto', '이집트', 'エジプト', '埃及', 'อียิปต์', 'египет'],
  ZA: ['south africa', 'zuid-afrika', 'südafrika', 'sudáfrica', '남아프리카', '南アフリカ', '南非', 'แอฟริกาใต้', 'юар'],
  TR: ['turkey', 'turkiye', 'turkije', 'türkei', 'turquía', '터키', 'トルコ', '土耳其', 'ตุรกี', 'турция'],
  GR: ['greece', 'griekenland', 'griechenland', 'grecia', 'yunani', '그리스', 'ギリシャ', '希腊', 'กรีซ', 'греция'],
  CH: ['switzerland', 'zwitserland', 'schweiz', 'suiza', '스위스', 'スイス', '瑞士', 'สวิตเซอร์แลนด์', 'швейцария'],
  AT: ['austria', 'oostenrijk', 'österreich', '오스트리아', 'オーストリア', '奥地利', 'ออสเตรีย', 'австрия'],
  BE: ['belgium', 'belgie', 'belgië', 'belgien', 'bélgica', '벨기에', 'ベルギー', '比利时', 'เบลเยียม', 'бельгия'],
  PL: ['poland', 'polen', 'polonia', 'polandia', '폴란드', 'ポーランド', '波兰', 'โปแลนด์', 'польша'],
  IE: ['ireland', 'ierland', 'irland', 'irlanda', '아일랜드', 'アイルランド', '爱尔兰', 'ไอร์แลนด์', 'ирландия'],
  NZ: ['new zealand', 'nieuw-zeeland', 'neuseeland', 'nueva zelanda', '뉴질랜드', 'ニュージーランド', '新西兰', 'นิวซีแลนด์', 'новая зеландия'],
  SG: ['singapore', 'singapura', '싱가포르', 'シンガポール', '新加坡', 'สิงคโปร์', 'сингапур'],
  HK: ['hong kong', 'hongkong', '홍콩', '香港', 'ฮ่องกง', 'гонконг'],
  MO: ['macau', 'macao', '마카오', 'マカオ', '澳门', 'มาเก๊า', 'макао'],
  IL: ['israel', 'israël', '이스라엘', 'イスラエル', '以色列', 'อิสราเอล', 'израиль'],
  CI: ['ivory coast', 'cote divoire', "côte d'ivoire", 'ivoorkust', 'elfenbeinküste', 'costa de marfil'],
  CD: ['congo', 'drc', 'dr congo', 'democratische republiek congo', 'congo-kinshasa'],
  CG: ['congo-brazzaville', 'republic of the congo'],
  PF: ['tahiti', 'french polynesia', 'frans-polynesië', 'polinesia francesa'],
  NC: ['new caledonia', 'nieuw-caledonië', 'neukaledonien', 'nueva caledonia'],
  PG: ['papua new guinea', 'papoea-nieuw-guinea', 'papua-neuguinea', 'papúa nueva guinea', 'papua'],
  MP: ['saipan', 'northern mariana', 'noordelijke marianen'],
  SX: ['sint maarten', 'st maarten', 'saint martin'],
  MM: ['myanmar', 'burma', '미얀마', 'ミャンマー', '缅甸', 'เมียนมา', 'мьянма'],
  SA: ['saudi', 'saudi arabia', 'saoedi', 'saoedi-arabië'],
  BS: ["bahamas", "bahama's"],
  TT: ['trinidad', 'trinidad en tobago'],
  DO: ['dominican republic', 'dominicaanse', 'república dominicana'],
  XK: ['kosovo', '코소보', 'コソボ', '科索沃', 'โคโซโว', 'косово'],
  SS: ['south sudan', 'zuid-soedan', 'südsudan', 'sudán del sur'],
  TL: ['timor-leste', 'east timor', 'oost-timor', 'osttimor', 'timor oriental'],
  EH: ['western sahara', 'westelijke sahara', 'westsahara', 'sáhara occidental'],
  UM: ['wake', 'midway', 'us minor outlying'],
  IO: ['diego garcia', 'british indian ocean'],
  FK: ['falkland', 'malvinas', 'falklandeilanden', 'islas malvinas'],
  BQ: ['bonaire', 'saba', 'sint eustatius', 'caribisch nederland'],
};

const NL_NAME_OVERRIDE = {
  HK: 'Hongkong',
  MO: 'Macau',
  MM: 'Myanmar',
};

const LOCALES = ['en', 'nl', 'zh', 'th', 'de', 'ru', 'ja', 'ko', 'vi', 'id', 'es'];
const dn = Object.fromEntries(LOCALES.map(loc => [loc, new Intl.DisplayNames([loc], { type: 'region' })]));
const dnNl = new Intl.DisplayNames(['nl'], { type: 'region' });

function aliasesFor(cc, nlName) {
  const set = new Set();
  const add = (s) => {
    const t = String(s || '').trim();
    if (t && t.length > 1) set.add(t);
  };
  add(nlName);
  add(cc);
  for (const loc of LOCALES) {
    try { add(dn[loc].of(cc)); } catch { /* ignore */ }
  }
  for (const extra of extras[cc] || []) add(extra);
  return [...set];
}

const metaLines = [];
for (const cc of [...by.keys()].sort()) {
  let nlName = NL_NAME_OVERRIDE[cc];
  if (!nlName) {
    try { nlName = dnNl.of(cc) || cc; }
    catch { nlName = cc; }
  }
  const aliases = aliasesFor(cc, nlName).filter(a => a.toLowerCase() !== nlName.toLowerCase() && a !== cc);
  const aliasLit = aliases.map(a => JSON.stringify(a)).join(', ');
  metaLines.push(`  ${cc}: { name: ${JSON.stringify(nlName)}, aliases: [${aliasLit}] },`);
}

const hubLines = Object.keys(hubs).sort().map(cc => {
  const list = hubs[cc].map(i => `'${i}'`).join(', ');
  return `  ${cc}: [${list}],`;
});

writeFileSync(new URL('../lib/countryHubs.ts', import.meta.url),
`/** Primary airport(s) when a country name is searched. Two codes = user choice. */
export const COUNTRY_HUBS: Record<string, string[]> = {
${hubLines.join('\n')}
};
`);

writeFileSync(new URL('../lib/countryMeta.generated.ts', import.meta.url),
`/** ISO2 → NL display name + search aliases in all app locales. */
export const COUNTRY_META: Record<string, { name: string; aliases: string[] }> = {
${metaLines.join('\n')}
};
`);

console.log('wrote hubs', hubLines.length, 'meta', metaLines.length);
