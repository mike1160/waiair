/** Local airport catalog for smart search: IATA, name, city, country, coords, aliases. */

import { AIRPORT_ROWS as ROWS } from './airportsRows.generated.ts';
import { COUNTRY_HUBS } from './countryHubs.ts';
import { COUNTRY_META } from './countryMeta.generated.ts';

const HUB_IATA = new Set(Object.values(COUNTRY_HUBS).flat());

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

export { COUNTRY_META };

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

/** Extra search aliases not in the generated catalog (script + city variants). */
const EXTRA_SEARCH_ALIASES: Record<string, string[]> = {
  ICN: ['incheon', 'incheon international', '인천', '인천국제공항', '仁川', 'อินชอน', 'インチョン', 'инчхон', 'seoul', 'seoel'],
  GMP: ['gimpo', 'seoul', 'seoel', '김포', '김포공항', '金浦', 'ソウル金浦'],
  HKT: ['phuket', '푸켓', 'プーケット', '普吉', 'ภูเก็ต', 'пхукет'],
  USM: ['samui', 'ko samui', 'koh samui', 'kosamui', 'kohsamui'],
  BKK: ['bangkok', 'suvarnabhumi', 'บางกอก', 'กรุงเทพ', 'バンコク', '방콕', '曼谷', 'бангкок'],
  DMK: ['bangkok', 'don mueang', 'donmueang', 'ดอนเมือง', 'บางกอก'],
};

for (const [iata, extra] of Object.entries(EXTRA_SEARCH_ALIASES)) {
  const rec = BY_IATA.get(iata);
  if (!rec) continue;
  const have = new Set(rec.aliases.map(a => a.toLowerCase()));
  for (const alias of extra) {
    if (!have.has(alias.toLowerCase())) rec.aliases.push(alias);
  }
}

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
  '대한민국': 'korea',
  '韓国': 'korea',
  '韩国': 'korea',
  '韓國': 'korea',
  'เกาหลี': 'korea',
  'corea': 'korea',
  'корея': 'korea',
  'hàn quốc': 'korea',
  'han quoc': 'korea',
  'südkorea': 'korea',
  '日本': 'japan',
  '일본': 'japan',
  'япония': 'japan',
  '中国': 'china',
  'จีน': 'china',
  'китай': 'china',
  '泰国': 'thailand',
  'タイ': 'thailand',
  '태국': 'thailand',
  'тайланд': 'thailand',
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
    if (names.some(n => n === qc || (qc.length >= 3 && n.startsWith(qc)) || (qc.length >= 4 && n.includes(qc)))) {
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
    else if (ql.length >= 3 && rec.iata.toLowerCase().startsWith(ql)) score = 92;
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
    if (HUB_IATA.has(rec.iata)) score += 12;
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
