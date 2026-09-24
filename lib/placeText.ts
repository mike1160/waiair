/**
 * Where a booking actually is, read out of the text it came with.
 *
 * A parsed booking (lib/tripExtrasModel.ts) has no city and no country field: a hotel carries a name and an
 * address, a car carries a pick-up location, an excursion carries where you are collected. That is all free
 * text. Matching a booking to a trip on more than its date (lib/matchScore.ts) needs a place, so this reads
 * one out of those strings — conservatively, because a wrong place is worse than no place at all.
 *
 * Two things are looked for, and nothing is invented:
 *   - an airport code, but only when the text also talks about an airport, so a street number called "SEA"
 *     is not read as Seattle;
 *   - a city, airport or metro name from the airport table, accents and capitals folded away (normKey).
 *
 * When several names appear, the last one wins: an address runs from the doorstep outwards, so the city sits
 * behind the street ("Sukhumvit Soi 11, Bangkok"), and a hotel called "Grand Hotel Vienna" in Bangkok should
 * be read as Bangkok rather than as Austria.
 */

import { AIRPORTS, COUNTRY_META, airportRecByIata, normKey, type AirportRec } from './airportsDb.ts';

export interface PlaceFromText {
  city?: string;
  /** ISO country code, taken from whatever was recognised. */
  country?: string;
  airportIata?: string;
}

/** Words that make a three-letter code trustworthy. Kept short and multilingual on purpose. */
const AIRPORT_WORDS = [
  'airport', 'airpt', 'terminal', 'aeroport', 'aéroport', 'aeropuerto', 'aeroporto', 'flughafen',
  'luchthaven', 'vliegveld', 'สนามบิน', '空港', '机场', '공항', 'havalimani', 'lufthavn', 'flygplats',
];

/** Names too short to be safe: "ABC Road" or a two-letter town would match far too eagerly. */
const MIN_NAME_LEN = 4;

let nameIndex: Map<string, AirportRec> | null = null;

/**
 * Every city, airport and alias name worth matching, folded to a key.
 *
 * A record's own city name beats an alias, so "Bangkok" resolves to Suvarnabhumi rather than to whichever
 * airport happens to list it as a nickname. Built once, on first use — the table has thousands of rows.
 */
function index(): Map<string, AirportRec> {
  if (nameIndex) return nameIndex;
  const map = new Map<string, AirportRec>();
  const cityKeys = new Set<string>();
  for (const rec of AIRPORTS) {
    const cityKey = normKey(rec.city);
    if (cityKey.length >= MIN_NAME_LEN && !cityKeys.has(cityKey)) {
      map.set(cityKey, rec);
      cityKeys.add(cityKey);
    }
  }
  for (const rec of AIRPORTS) {
    for (const name of [rec.name, ...(rec.aliases || [])]) {
      const key = normKey(name);
      if (key.length < MIN_NAME_LEN || cityKeys.has(key) || map.has(key)) continue;
      map.set(key, rec);
    }
  }
  nameIndex = map;
  return map;
}

let countryIndex: Map<string, string> | null = null;

/** Country names and their aliases → ISO code, so "Thailand" and "Thaïlande" both land on TH. */
function countries(): Map<string, string> {
  if (countryIndex) return countryIndex;
  const map = new Map<string, string>();
  for (const [code, meta] of Object.entries(COUNTRY_META as Record<string, { name?: string; aliases?: string[] }>)) {
    for (const name of [meta?.name, ...(meta?.aliases || [])]) {
      const key = normKey(name || '');
      if (key.length >= MIN_NAME_LEN && !map.has(key)) map.set(key, code);
    }
  }
  countryIndex = map;
  return countryIndex;
}

/** The words of a string, in order, with their original spelling kept for the airport-code check. */
function words(text: string): string[] {
  return String(text || '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** An airport code the text vouches for by also mentioning an airport. */
function iataFromText(text: string): string | undefined {
  const lower = String(text || '').toLowerCase();
  if (!AIRPORT_WORDS.some(w => lower.includes(w))) return undefined;
  for (const w of words(text)) {
    if (!/^[A-Z]{3}$/.test(w)) continue;
    if (airportRecByIata(w)) return w;
  }
  return undefined;
}

/**
 * The place a booking's text points at, or an empty object when it points at nothing we know.
 *
 * An empty answer is a real answer: lib/matchScore.ts treats "no place" differently from "the wrong place",
 * so guessing here would be worse than admitting ignorance.
 */
export function placeFromText(...parts: (string | undefined)[]): PlaceFromText {
  const text = parts.filter(Boolean).join(', ');
  if (!text.trim()) return {};

  const out: PlaceFromText = {};
  const iata = iataFromText(text);
  if (iata) {
    const rec = airportRecByIata(iata);
    out.airportIata = iata;
    if (rec) {
      out.city = rec.city;
      out.country = rec.country;
    }
    return out;
  }

  const ws = words(text);
  const names = index();
  let hit: AirportRec | null = null;
  // Longest phrase first at each position, and the last match in the string wins — see the note on top.
  for (let i = 0; i < ws.length; i += 1) {
    for (let n = Math.min(3, ws.length - i); n >= 1; n -= 1) {
      const key = normKey(ws.slice(i, i + n).join(''));
      if (key.length < MIN_NAME_LEN) continue;
      const rec = names.get(key);
      if (rec) { hit = rec; break; }
    }
  }
  if (hit) {
    out.city = hit.city;
    out.country = hit.country;
    return out;
  }

  // No city, but the country may still be spelled out at the end of an address.
  const cc = countries();
  for (let i = 0; i < ws.length; i += 1) {
    for (let n = Math.min(3, ws.length - i); n >= 1; n -= 1) {
      const key = normKey(ws.slice(i, i + n).join(''));
      if (key.length < MIN_NAME_LEN) continue;
      const code = cc.get(key);
      if (code) out.country = code;
    }
  }
  return out;
}
