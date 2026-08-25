/** Local airport catalog for smart search: IATA, name, city, country, coords, aliases. */

import { AIRPORT_ROWS as ROWS } from './airportsRows.generated';

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
  if (!a && !b) return '';
  if (a && b && a === b) return `??? → ${b}`;
  return `${a || '???'} → ${b || '???'}`;
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
