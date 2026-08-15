/** Forgiving FIDS search: city, airport, IATA, airline, "to/from" prefixes. */

export type SearchDirection = 'destination' | 'departure' | 'both';

export type SearchableFlight = {
  id?: string;
  number: string;
  airline: string;
  airlineCode: string;
  origin: string;
  destination: string;
  originCity: string;
  destCity: string;
  originCountry?: string;
  destCountry?: string;
  originName?: string;
  destName?: string;
  status?: string;
  statusLabel?: string;
};

export type SearchSuggestion = {
  id: string;
  label: string;
  apply: string;
  kind: 'city' | 'airline';
};

const DESTINATION_LOOKUP: Record<string, string[]> = {
  // Thailand
  bangkok: ['BKK', 'DMK'],
  suvarnabhumi: ['BKK'],
  donmueang: ['DMK'],
  'don mueang': ['DMK'],
  phuket: ['HKT'],
  chiangmai: ['CNX'],
  'chiang mai': ['CNX'],
  kosamui: ['USM'],
  'koh samui': ['USM'],
  samui: ['USM'],
  krabi: ['KBV'],
  hadyai: ['HDY'],
  'hat yai': ['HDY'],
  thailand: ['BKK', 'DMK', 'HKT', 'CNX', 'USM', 'KBV', 'HDY'],

  // Singapore
  singapore: ['SIN'],
  changi: ['SIN'],
  sgp: ['SIN'],

  // Malaysia
  kualalumpur: ['KUL', 'SZB'],
  'kuala lumpur': ['KUL', 'SZB'],
  klia: ['KUL'],
  penang: ['PEN'],
  kotakinabalu: ['BKI'],
  'kota kinabalu': ['BKI'],
  malaysia: ['KUL', 'SZB', 'PEN', 'BKI'],

  // Indonesia
  bali: ['DPS'],
  denpasar: ['DPS'],
  jakarta: ['CGK'],
  surabaya: ['SUB'],
  indonesia: ['DPS', 'CGK', 'SUB'],

  // Vietnam
  hochiminh: ['SGN'],
  'ho chi minh': ['SGN'],
  saigon: ['SGN'],
  hanoi: ['HAN'],
  vietnam: ['SGN', 'HAN'],

  // Cambodia
  siemreap: ['REP'],
  'siem reap': ['REP'],
  phnompenh: ['PNH'],
  'phnom penh': ['PNH'],
  cambodia: ['REP', 'PNH'],

  // Netherlands
  amsterdam: ['AMS'],
  schiphol: ['AMS'],
  netherlands: ['AMS'],
  holland: ['AMS'],

  // UAE
  dubai: ['DXB', 'DWC'],
  uae: ['DXB', 'DWC'],

  // UK
  london: ['LHR', 'LGW', 'STN', 'LCY'],
  heathrow: ['LHR'],
  gatwick: ['LGW'],
  uk: ['LHR', 'LGW', 'STN', 'LCY'],
  england: ['LHR', 'LGW', 'STN', 'LCY'],

  // France
  paris: ['CDG', 'ORY'],
  charlesdegaulle: ['CDG'],
  'charles de gaulle': ['CDG'],
  france: ['CDG', 'ORY'],

  // Germany
  frankfurt: ['FRA'],
  munich: ['MUC'],
  germany: ['FRA', 'MUC'],

  // Japan
  tokyo: ['NRT', 'HND'],
  narita: ['NRT'],
  haneda: ['HND'],
  osaka: ['KIX'],
  japan: ['NRT', 'HND', 'KIX'],

  // South Korea
  seoul: ['ICN', 'GMP'],
  incheon: ['ICN'],
  korea: ['ICN', 'GMP'],

  // Hong Kong
  hongkong: ['HKG'],
  'hong kong': ['HKG'],

  // Australia
  sydney: ['SYD'],
  melbourne: ['MEL'],
  australia: ['SYD', 'MEL'],

  // Philippines
  manila: ['MNL'],
  philippines: ['MNL'],
};

const COUNTRY_ONLY = new Set([
  'thailand', 'malaysia', 'indonesia', 'vietnam', 'cambodia', 'netherlands',
  'holland', 'uae', 'uk', 'england', 'france', 'germany', 'japan', 'korea',
  'australia', 'philippines',
]);

const AIRLINES: { keys: string[]; code: string; name: string }[] = [
  { keys: ['thai', 'thai airways', 'thai air', 'thaiairways', 'tg'], code: 'TG', name: 'Thai Airways' },
  { keys: ['singapore airlines', 'singapore air', 'sia', 'sq'], code: 'SQ', name: 'Singapore Airlines' },
  { keys: ['klm'], code: 'KL', name: 'KLM' },
  { keys: ['emirates', 'ek'], code: 'EK', name: 'Emirates' },
  { keys: ['qatar', 'qatar airways', 'qr'], code: 'QR', name: 'Qatar Airways' },
  { keys: ['cathay', 'cathay pacific', 'cx'], code: 'CX', name: 'Cathay Pacific' },
  { keys: ['malaysia airlines', 'mh'], code: 'MH', name: 'Malaysia Airlines' },
  { keys: ['airasia', 'ak', 'fd'], code: 'AK', name: 'AirAsia' },
  { keys: ['vietjet', 'vj'], code: 'VJ', name: 'VietJet' },
  { keys: ['vietnam airlines', 'vn'], code: 'VN', name: 'Vietnam Airlines' },
  { keys: ['ana', 'nh'], code: 'NH', name: 'ANA' },
  { keys: ['jal', 'japan airlines', 'jl'], code: 'JL', name: 'Japan Airlines' },
  { keys: ['korean air', 'ke'], code: 'KE', name: 'Korean Air' },
  { keys: ['lufthansa', 'lh'], code: 'LH', name: 'Lufthansa' },
  { keys: ['british airways', 'ba'], code: 'BA', name: 'British Airways' },
  { keys: ['air france', 'af'], code: 'AF', name: 'Air France' },
  { keys: ['klm royal'], code: 'KL', name: 'KLM' },
  { keys: ['scoot', 'tr'], code: 'TR', name: 'Scoot' },
  { keys: ['batik', 'id'], code: 'ID', name: 'Batik Air' },
  { keys: ['garuda', 'ga'], code: 'GA', name: 'Garuda Indonesia' },
];

export const SEARCH_PLACEHOLDERS = [
  'Search flights...',
  'Try: Singapore',
  'Try: TG316',
  'Try: Bangkok',
  'Try: KLM',
];

export function getSearchDirection(raw: string): SearchDirection {
  const t = String(raw || '').trim();
  if (/^to\s+/i.test(t)) return 'destination';
  if (/^from\s+/i.test(t)) return 'departure';
  return 'both';
}

export function cleanQuery(raw: string): string {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^to\s+/i, '')
    .replace(/^from\s+/i, '')
    .replace(/airport$/i, '')
    .replace(/international$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function compact(s: string): string {
  return s.replace(/\s+/g, '');
}

function lookupIatas(query: string): string[] {
  if (!query) return [];
  const q = query.toLowerCase();
  const qc = compact(q);
  const codes = new Set<string>();
  for (const [name, iatas] of Object.entries(DESTINATION_LOOKUP)) {
    const n = name.toLowerCase();
    const nc = compact(n);
    if (COUNTRY_ONLY.has(n)) {
      if (n === q || (q.length >= 5 && (n.startsWith(q) || nc.startsWith(qc)))) {
        iatas.forEach(c => codes.add(c));
      }
      continue;
    }
    if (n === q || nc === qc) {
      iatas.forEach(c => codes.add(c));
      continue;
    }
    if (q.length >= 3 && (n.startsWith(q) || nc.startsWith(qc))) {
      iatas.forEach(c => codes.add(c));
      continue;
    }
    if (q.length >= 4 && (n.includes(q) || nc.includes(qc))) {
      iatas.forEach(c => codes.add(c));
    }
  }
  return [...codes];
}

function matchingAirlines(query: string): typeof AIRLINES {
  const q = query.toLowerCase();
  if (!q || q.length < 2) return [];
  if (q === 'thailand' || q.startsWith('thailand')) return [];
  if (DESTINATION_LOOKUP[q] && !COUNTRY_ONLY.has(q)) return [];
  return AIRLINES.filter(a => {
    if (a.code.toLowerCase() === q) return true;
    return a.keys.some(k => {
      const kl = k.toLowerCase();
      if (kl === q) return true;
      if (kl.length <= 3) return q.length >= 2 && kl.startsWith(q);
      return q.length >= 4 && (kl.startsWith(q) || kl.includes(q));
    });
  });
}

function sideMatch(
  direction: SearchDirection,
  origin: string,
  dest: string,
  codes: string[],
): boolean {
  const o = origin.toUpperCase();
  const d = dest.toUpperCase();
  if (direction === 'destination') return codes.includes(d);
  if (direction === 'departure') return codes.includes(o);
  return codes.includes(d) || codes.includes(o);
}

export function searchFlights<T extends SearchableFlight>(flights: T[], rawQuery: string, hubIata?: string): T[] {
  const raw = String(rawQuery || '');
  if (!raw.trim()) return flights;

  const query = cleanQuery(raw);
  if (!query) return flights;

  const direction = getSearchDirection(raw);
  const hub = String(hubIata || '').toUpperCase();

  const airlineHits = matchingAirlines(query);
  const airlineFiltered = airlineHits.length
    ? flights.filter(f => {
      const code = String(f.airlineCode || '').toUpperCase();
      const name = String(f.airline || '').toLowerCase();
      return airlineHits.some(a => {
        if (code === a.code || (a.code.length >= 2 && code.startsWith(a.code))) return true;
        if (name.includes(a.name.toLowerCase())) return true;
        return a.keys.some(k => k.length >= 4 && name.includes(k));
      });
    })
    : [];

  // Exact 3-letter IATA
  if (query.length === 3 && /^[a-z]{3}$/.test(query)) {
    const iata = query.toUpperCase();
    const direct = flights.filter(f => sideMatch(direction, f.origin, f.destination, [iata]));
    if (direct.length) return direct;
  }

  const iataMatches = lookupIatas(query).filter(c => !hub || c !== hub);
  if (iataMatches.length) {
    const placeFiltered = flights.filter(f => sideMatch(direction, f.origin, f.destination, iataMatches));
    if (placeFiltered.length) return placeFiltered;
  }

  if (airlineFiltered.length) return airlineFiltered;

  return flights.filter(f => fuzzyMatch(f, query, direction));
}

function fuzzyMatch(f: SearchableFlight, query: string, direction: SearchDirection): boolean {
  const extra = [f.number, f.airline, f.airlineCode, f.status, f.statusLabel].join(' ').toLowerCase();
  if (extra.includes(query)) return true;
  const destBlob = [f.destination, f.destCity, f.destName, f.destCountry].join(' ').toLowerCase();
  const originBlob = [f.origin, f.originCity, f.originName, f.originCountry].join(' ').toLowerCase();
  if (direction === 'destination') return destBlob.includes(query);
  if (direction === 'departure') return originBlob.includes(query);
  return destBlob.includes(query) || originBlob.includes(query);
}

export function searchSuggestions(raw: string): SearchSuggestion[] {
  const query = cleanQuery(raw);
  if (query.length < 2) return [];
  const out: SearchSuggestion[] = [];
  const seen = new Set<string>();

  for (const [name, codes] of Object.entries(DESTINATION_LOOKUP)) {
    if (COUNTRY_ONLY.has(name)) {
      if (name === query || (query.length >= 5 && (name.startsWith(query) || name.includes(query)))) {
        const id = `country-${name}`;
        if (!seen.has(id)) {
          seen.add(id);
          out.push({
            id,
            label: `${titleCase(name)} · ${codes.slice(0, 3).join(', ')}`,
            apply: titleCase(name),
            kind: 'city',
          });
        }
      }
      continue;
    }
    if (name.startsWith(query) || compact(name).startsWith(compact(query))) {
      const id = `city-${codes.join('-')}`;
      if (!seen.has(id)) {
        seen.add(id);
        const label = `${titleCase(primaryCityLabel(name, codes))} · ${uniq(codes).join(', ')}`;
        out.push({ id, label, apply: titleCase(primaryCityLabel(name, codes)), kind: 'city' });
      }
    }
    if (out.length >= 6) break;
  }

  for (const a of matchingAirlines(query)) {
    const id = `air-${a.code}`;
    if (!seen.has(id)) {
      seen.add(id);
      out.push({ id, label: a.name, apply: a.name, kind: 'airline' });
    }
  }

  return out.slice(0, 6);
}

function primaryCityLabel(name: string, codes: string[]): string {
  if (name === 'changi' || name === 'sgp') return 'Singapore';
  if (name === 'schiphol') return 'Amsterdam';
  if (name === 'suvarnabhumi' || name === 'don mueang' || name === 'donmueang') {
    return name.includes('don') ? 'Don Mueang' : 'Bangkok';
  }
  if (codes.length > 1 && (name === 'bangkok' || name === 'london' || name === 'tokyo' || name === 'dubai' || name === 'paris' || name === 'seoul' || name === 'kuala lumpur' || name === 'kualalumpur')) {
    return titleCase(name.replace(/kualalumpur/, 'kuala lumpur'));
  }
  return name;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, c => c.toUpperCase());
}

function uniq(list: string[]): string[] {
  return [...new Set(list)];
}

export function prettySearchLabel(raw: string): string {
  const q = cleanQuery(raw);
  if (!q) return '';
  if (/^[a-z]{1,3}\d{1,4}[a-z]?$/i.test(q.replace(/\s/g, ''))) {
    return q.replace(/\s/g, '').toUpperCase();
  }
  return titleCase(q);
}

export function emptySearchCopy(raw: string, airportIata: string): {
  title: string;
  tryHints: string;
  hint: string;
} {
  const direction = getSearchDirection(raw);
  const label = prettySearchLabel(raw) || raw.trim();
  const prefix = direction === 'destination' ? 'to ' : direction === 'departure' ? 'from ' : 'matching ';
  const iatas = lookupIatas(cleanQuery(raw));
  const aliases = suggestionAliases(cleanQuery(raw), iatas);
  return {
    title: `No flights ${prefix}${label} at ${airportIata}`,
    tryHints: aliases.length ? `Try: ${aliases.join(' · ')}` : '',
    hint: 'Or switch airport to see flights from another hub',
  };
}

export type PopularDest = { iata: string; city: string };

const FALLBACK_POPULAR: Record<string, PopularDest[]> = {
  HKT: [{ iata: 'BKK', city: 'Bangkok' }, { iata: 'KUL', city: 'Kuala Lumpur' }, { iata: 'SIN', city: 'Singapore' }],
  BKK: [{ iata: 'HKT', city: 'Phuket' }, { iata: 'CNX', city: 'Chiang Mai' }, { iata: 'SIN', city: 'Singapore' }],
  AMS: [{ iata: 'LHR', city: 'London' }, { iata: 'BCN', city: 'Barcelona' }, { iata: 'IST', city: 'Istanbul' }],
  SIN: [{ iata: 'BKK', city: 'Bangkok' }, { iata: 'KUL', city: 'Kuala Lumpur' }, { iata: 'CGK', city: 'Jakarta' }],
  KUL: [{ iata: 'SIN', city: 'Singapore' }, { iata: 'BKK', city: 'Bangkok' }, { iata: 'PEN', city: 'Penang' }],
};

export function popularFromFlights(
  flights: SearchableFlight[],
  hubIata: string,
  type: 'arrival' | 'departure',
): PopularDest[] {
  const hub = String(hubIata || '').toUpperCase();
  const counts = new Map<string, { n: number; city: string }>();
  for (const f of flights) {
    const code = String(type === 'departure' ? f.destination : f.origin).toUpperCase();
    const city = type === 'departure' ? f.destCity : f.originCity;
    if (!code || code === hub || code === '—' || code.length !== 3) continue;
    const prev = counts.get(code) || { n: 0, city: city || code };
    counts.set(code, { n: prev.n + 1, city: prev.city || city || code });
  }
  const ranked = [...counts.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 3)
    .map(([iata, v]) => ({ iata, city: v.city }));
  if (ranked.length >= 3) return ranked;
  const fallback = FALLBACK_POPULAR[hub] || FALLBACK_POPULAR.HKT;
  const seen = new Set(ranked.map(r => r.iata));
  for (const p of fallback) {
    if (seen.has(p.iata) || p.iata === hub) continue;
    ranked.push(p);
    if (ranked.length >= 3) break;
  }
  return ranked;
}

function suggestionAliases(query: string, iatas: string[]): string[] {
  const out: string[] = [...iatas];
  for (const [name, codes] of Object.entries(DESTINATION_LOOKUP)) {
    if (COUNTRY_ONLY.has(name)) continue;
    if (codes.some(c => iatas.includes(c)) && name !== query) {
      const pretty = titleCase(name);
      if (!out.includes(pretty) && pretty.toLowerCase() !== query) out.push(pretty);
    }
  }
  if (iatas.includes('SIN') && !out.includes('SGP')) out.push('SGP');
  return out.slice(0, 4);
}
