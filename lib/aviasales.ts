import { Linking } from 'react-native';
import { getLocales } from 'expo-localization';
import { AFFILIATE_MARKER, travelpayoutsToken } from './affiliateConfig';
import { typicalDurationMs } from './flightTimes';
import { airportRecByIata } from './airportsDb';
import { alignQuotedPrice, filterAnomalousFares } from './farePriceGuard';

export type AviasalesTripType = 'oneway' | 'return' | 'multicity';

export type AviasalesLeg = {
  origin: string;
  destination: string;
  date: Date;
};

function fmtAviasalesDay(d: Date): string {
  return `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function iata(code: string): string {
  return String(code || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}

export const buildAviasalesUrl = (
  origin: string,
  destination: string,
  departDate: Date,
  passengers: number = 1,
  tripType: AviasalesTripType = 'oneway',
  returnDate?: Date,
  extraLegs?: Array<{ origin: string; destination: string; date: Date }>,
): string => {
  const from = iata(origin);
  const to = iata(destination);
  const pax = Math.max(1, Math.min(9, Math.round(passengers) || 1));
  const base = 'https://www.aviasales.com/search/';
  const marker = `?marker=${AFFILIATE_MARKER}&no_mobile_redirect=true`;

  if (tripType === 'return' && returnDate) {
    return `${base}${from}${fmtAviasalesDay(departDate)}${to}${fmtAviasalesDay(returnDate)}${pax}${marker}`;
  }

  if (tripType === 'multicity' && extraLegs?.length) {
    const legs = [
      `${from}${fmtAviasalesDay(departDate)}${to}`,
      ...extraLegs.map(l => `${iata(l.origin)}${fmtAviasalesDay(l.date)}${iata(l.destination)}`),
    ].join('');
    return `${base}${legs}${pax}${marker}`;
  }

  return `${base}${from}${fmtAviasalesDay(departDate)}${to}${pax}${marker}`;
};

/** Opens Aviasales search results in Safari / the system browser — never an in-app WebView. */
export function openAviasalesBooking(
  origin: string,
  destination: string,
  departDate: Date,
  passengers: number = 1,
  tripType: AviasalesTripType = 'oneway',
  returnDate?: Date,
  extraLegs?: Array<{ origin: string; destination: string; date: Date }>,
): Promise<boolean> {
  return Linking.openURL(
    buildAviasalesUrl(origin, destination, departDate, passengers, tripType, returnDate, extraLegs),
  );
}

export function aviasalesToken(): string {
  return travelpayoutsToken();
}

export type AviasalesCurrency = {
  code: 'thb' | 'eur' | 'gbp' | 'usd';
  symbol: string;
};

export function aviasalesCurrency(): AviasalesCurrency {
  const loc = getLocales()[0];
  const lang = String(loc?.languageCode || '').toLowerCase();
  const region = String(loc?.regionCode || loc?.languageRegionCode || '').toUpperCase();
  if (lang === 'th') return { code: 'thb', symbol: '฿' };
  if (lang === 'nl' || lang === 'de' || lang === 'fr') return { code: 'eur', symbol: '€' };
  if (lang === 'en' && region === 'GB') return { code: 'gbp', symbol: '£' };
  return { code: 'usd', symbol: '$' };
}

export type AirportPlace = {
  code: string;
  /** Travelpayouts city IATA when the row is an airport (e.g. LHR → LON). */
  cityCode?: string;
  name: string;
  city: string;
  country: string;
  kind: 'city' | 'airport';
};

export type LatestFare = {
  origin: string;
  destination: string;
  departDate: string;
  returnDate?: string;
  /** Full ISO from Travelpayouts when present (used for clock display). */
  departureAt?: string;
  airline: string;
  transfers: number;
  price: number;
};

type PlaceRaw = {
  code?: string;
  name?: string;
  city_name?: string;
  city_code?: string;
  country_name?: string;
  type?: string;
};

type V3FareRaw = {
  origin?: string;
  destination?: string;
  origin_airport?: string;
  destination_airport?: string;
  departure_at?: string;
  return_at?: string;
  return_date?: string;
  depart_date?: string;
  airline?: string;
  transfers?: number;
  number_of_changes?: number;
  value?: number;
  price?: number;
};

const AUTOCOMPLETE_LOCALES = new Set(['en', 'de', 'fr', 'it', 'es', 'pl', 'th', 'ru']);

export function aviasalesPlaceLocale(appLocale?: string): string {
  const loc = String(appLocale || 'en').toLowerCase().slice(0, 2);
  if (AUTOCOMPLETE_LOCALES.has(loc)) return loc;
  return 'en';
}

export function placeTitle(p: AirportPlace): string {
  return (p.city || p.name || p.code).trim();
}

export function placeSubtitle(p: AirportPlace): string {
  const bits: string[] = [p.code];
  if (p.kind === 'airport' && p.name && p.name.toLowerCase() !== p.city.toLowerCase()) {
    bits.push(p.name);
  }
  if (p.country) bits.push(p.country);
  return bits.join(' · ');
}

export async function searchAirportPlaces(
  term: string,
  locale = 'en',
): Promise<AirportPlace[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const loc = aviasalesPlaceLocale(locale);
  const url =
    `https://autocomplete.travelpayouts.com/places2?term=${encodeURIComponent(q)}` +
    `&locale=${encodeURIComponent(loc)}&types[]=city&types[]=airport`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('autocomplete');
  const json = (await res.json()) as PlaceRaw[] | { data?: PlaceRaw[] };
  const rows = Array.isArray(json) ? json : json.data || [];
  const seen = new Set<string>();
  const out: AirportPlace[] = [];
  for (const p of rows) {
    const code = String(p.code || '').toUpperCase();
    if (code.length !== 3) continue;
    const kind: AirportPlace['kind'] = p.type === 'city' ? 'city' : 'airport';
    const id = `${kind}:${code}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const name = String(p.name || '');
    const city = String(p.city_name || (kind === 'city' ? name : ''));
    const cityCode = String(p.city_code || '').toUpperCase();
    out.push({
      code,
      cityCode: cityCode.length === 3 && cityCode !== code ? cityCode : undefined,
      name,
      city,
      country: String(p.country_name || ''),
      kind,
    });
    if (out.length >= 10) break;
  }
  return out;
}

/** Travelpayouts fare APIs want city IATA (LON), not airport (LHR). */
const AIRPORT_TO_CITY: Record<string, string> = {
  LHR: 'LON', LGW: 'LON', STN: 'LON', LTN: 'LON', LCY: 'LON',
  CDG: 'PAR', ORY: 'PAR', BVA: 'PAR',
  NRT: 'TYO', HND: 'TYO',
  KIX: 'OSA', ITM: 'OSA',
  PEK: 'BJS', PKX: 'BJS',
  PVG: 'SHA',
  FCO: 'ROM', CIA: 'ROM',
  MXP: 'MIL', LIN: 'MIL', BGY: 'MIL',
  JFK: 'NYC', EWR: 'NYC', LGA: 'NYC',
  ORD: 'CHI', MDW: 'CHI',
  LAX: 'LAX',
  IAD: 'WAS', DCA: 'WAS', BWI: 'WAS',
  MIA: 'MIA',
  YYZ: 'YTO', YTZ: 'YTO',
  GIG: 'RIO', SDU: 'RIO',
  GRU: 'SAO', CGH: 'SAO', VCP: 'SAO',
  ICN: 'SEL', GMP: 'SEL',
  DMK: 'BKK',
  ARN: 'STO', BMA: 'STO', NYO: 'STO',
  TXL: 'BER', SXF: 'BER', BER: 'BER',
};

function cityCodeFor(code: string): string {
  const c = iata(code);
  return AIRPORT_TO_CITY[c] || c;
}

export function fareSearchCode(place: AirportPlace | null | undefined, fallback?: string | null): string | null {
  const fromPlace = place?.cityCode || place?.code;
  const code = String(fromPlace || fallback || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  if (code.length !== 3) return null;
  return cityCodeFor(code);
}

function dayFromIso(raw?: string): string {
  const m = String(raw || '').match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

function mapFare(r: V3FareRaw, fallbackOrigin: string, fallbackDest: string): LatestFare | null {
  const price = Number(r.price ?? r.value);
  if (!Number.isFinite(price) || price <= 0) return null;
  const departDate = dayFromIso(r.departure_at || r.depart_date);
  if (!departDate) return null;
  const returnDate = dayFromIso(r.return_at || r.return_date) || undefined;
  const departureAt = String(r.departure_at || '').trim() || undefined;
  return {
    origin: String(r.origin_airport || r.origin || fallbackOrigin).toUpperCase(),
    destination: String(r.destination_airport || r.destination || fallbackDest).toUpperCase(),
    departDate,
    returnDate,
    departureAt,
    airline: String(r.airline || '').toUpperCase(),
    transfers: Number(r.transfers ?? r.number_of_changes ?? 0),
    price,
  };
}

function faresFromUnknown(data: unknown, origin: string, dest: string): LatestFare[] {
  if (!data) return [];
  if (Array.isArray(data)) {
    return data
      .map(r => mapFare(r as V3FareRaw, origin, dest))
      .filter((r): r is LatestFare => !!r);
  }
  if (typeof data !== 'object') return [];
  const out: LatestFare[] = [];
  for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const rec = val as Record<string, unknown>;
    const looksFare = 'price' in rec || 'value' in rec || 'departure_at' in rec || 'depart_date' in rec;
    if (looksFare) {
      const raw = val as V3FareRaw;
      const fare = mapFare(
        { ...raw, destination: raw.destination || (key.length === 3 ? key : raw.destination) },
        origin,
        dest,
      );
      if (fare) out.push(fare);
      continue;
    }
    out.push(...faresFromUnknown(val, origin, dest));
  }
  return out;
}

function dedupeFares(rows: LatestFare[]): LatestFare[] {
  const seen = new Set<string>();
  const out: LatestFare[] = [];
  for (const r of rows) {
    const id = `${r.origin}|${r.destination}|${r.departDate}|${r.returnDate || ''}|${r.airline}|${r.price}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(r);
  }
  return out;
}

function hubAirportForCity(code: string): string {
  const c = iata(code);
  for (const [ap, city] of Object.entries(AIRPORT_TO_CITY)) {
    if (city === c) return ap;
  }
  return c;
}

function fareDurationHours(origin: string, destination: string): number | null {
  const o = airportRecByIata(origin) || airportRecByIata(hubAirportForCity(origin));
  const d = airportRecByIata(destination) || airportRecByIata(hubAirportForCity(destination));
  if (!o || !d) return null;
  const ms = typicalDurationMs(o.lat, o.lon, d.lat, d.lon);
  return ms != null ? ms / 3_600_000 : null;
}

function localQuoteCurrency(origin: string, destination: string): string | null {
  const rec =
    airportRecByIata(destination) ||
    airportRecByIata(hubAirportForCity(destination)) ||
    airportRecByIata(origin) ||
    airportRecByIata(hubAirportForCity(origin));
  const cc = String(rec?.country || '').toUpperCase();
  const map: Record<string, string> = {
    TH: 'thb', KR: 'krw', JP: 'jpy', ID: 'idr', VN: 'vnd', IN: 'inr', RU: 'rub',
  };
  return map[cc] || null;
}

function sanitizeFetchedFares(rows: LatestFare[], currency: string): LatestFare[] {
  const aligned = rows.map(f => ({
    ...f,
    price: alignQuotedPrice(
      f.price,
      currency,
      localQuoteCurrency(f.origin, f.destination),
    ),
  }));
  return filterAnomalousFares(aligned, {
    currency,
    durationHours: f => fareDurationHours(f.origin, f.destination),
  });
}

function rankFares(rows: LatestFare[], wantedDay?: string): LatestFare[] {
  const wanted = wantedDay ? Date.parse(`${wantedDay}T12:00:00`) : NaN;
  return [...rows].sort((a, b) => {
    if (Number.isFinite(wanted)) {
      const da = Math.abs(Date.parse(`${a.departDate}T12:00:00`) - wanted);
      const db = Math.abs(Date.parse(`${b.departDate}T12:00:00`) - wanted);
      if (da !== db) return da - db;
    }
    return a.price - b.price;
  });
}

async function travelpayoutsJson(url: string, token: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'X-Access-Token': token },
    });
    if (!res.ok) throw new Error('fares');
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

type FareQuery = {
  origin: string;
  destination: string;
  currency: string;
  token: string;
  depart?: string;
  returnDate?: string;
};

async function pricesForDates(opts: FareQuery): Promise<LatestFare[]> {
  const round = !!opts.returnDate;
  const params = new URLSearchParams({
    origin: opts.origin,
    destination: opts.destination,
    cy: opts.currency,
    currency: opts.currency,
    sorting: 'price',
    direct: 'false',
    unique: 'false',
    limit: '30',
    page: '1',
    one_way: round ? 'false' : 'true',
    token: opts.token,
  });
  if (opts.depart) params.set('departure_at', opts.depart);
  if (opts.returnDate) params.set('return_at', opts.returnDate);
  const json = await travelpayoutsJson(
    `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params.toString()}`,
    opts.token,
  ) as { data?: unknown };
  return faresFromUnknown(json.data, opts.origin, opts.destination);
}

async function groupedMonthPrices(opts: FareQuery & { month: string }): Promise<LatestFare[]> {
  const params = new URLSearchParams({
    origin: opts.origin,
    destination: opts.destination,
    currency: opts.currency,
    group_by: 'departure_at',
    direct: 'false',
    departure_at: opts.month,
    token: opts.token,
  });
  if (opts.returnDate) {
    params.set('return_at', opts.returnDate.slice(0, 7));
    params.set('one_way', 'false');
  }
  const json = await travelpayoutsJson(
    `https://api.travelpayouts.com/aviasales/v3/grouped_prices?${params.toString()}`,
    opts.token,
  ) as { data?: unknown };
  return faresFromUnknown(json.data, opts.origin, opts.destination);
}

async function cheapMonthPrices(opts: FareQuery & { month: string }): Promise<LatestFare[]> {
  const params = new URLSearchParams({
    origin: opts.origin,
    destination: opts.destination,
    currency: opts.currency,
    depart_date: opts.month,
    token: opts.token,
  });
  if (opts.returnDate) params.set('return_date', opts.returnDate.slice(0, 7));
  const json = await travelpayoutsJson(
    `https://api.travelpayouts.com/v1/prices/cheap?${params.toString()}`,
    opts.token,
  ) as { data?: unknown };
  return faresFromUnknown(json.data, opts.origin, opts.destination);
}

async function calendarMonthPrices(opts: FareQuery & { month: string }): Promise<LatestFare[]> {
  const params = new URLSearchParams({
    origin: opts.origin,
    destination: opts.destination,
    currency: opts.currency,
    depart_date: opts.month,
    calendar_type: 'departure_date',
    token: opts.token,
  });
  if (opts.returnDate) params.set('return_date', opts.returnDate.slice(0, 7));
  const json = await travelpayoutsJson(
    `https://api.travelpayouts.com/v1/prices/calendar?${params.toString()}`,
    opts.token,
  ) as { data?: unknown };
  return faresFromUnknown(json.data, opts.origin, opts.destination);
}

async function monthMatrixPrices(opts: FareQuery & { month: string }): Promise<LatestFare[]> {
  const params = new URLSearchParams({
    origin: opts.origin,
    destination: opts.destination,
    currency: opts.currency,
    month: `${opts.month}-01`,
    show_to_affiliates: 'true',
    token: opts.token,
  });
  if (opts.returnDate) params.set('return_date', opts.returnDate);
  const json = await travelpayoutsJson(
    `https://api.travelpayouts.com/v2/prices/month-matrix?${params.toString()}`,
    opts.token,
  ) as { data?: unknown };
  return faresFromUnknown(json.data, opts.origin, opts.destination);
}

async function latestMonthFallback(opts: {
  origin: string;
  destination: string;
  currency: string;
  token: string;
  month?: string;
  oneWay: boolean;
}): Promise<LatestFare[]> {
  const params = new URLSearchParams({
    origin: opts.origin,
    destination: opts.destination,
    currency: opts.currency,
    limit: '30',
    one_way: opts.oneWay ? 'true' : 'false',
    token: opts.token,
  });
  if (opts.month) {
    params.set('beginning_of_period', `${opts.month}-01`);
    params.set('period_type', 'month');
  } else {
    params.set('period_type', 'year');
  }
  const json = await travelpayoutsJson(
    `https://api.travelpayouts.com/v2/prices/latest?${params.toString()}`,
    opts.token,
  ) as { data?: unknown };
  return faresFromUnknown(json.data, opts.origin, opts.destination);
}

export async function fetchLatestFares(opts: {
  origin: string;
  destination: string;
  currency: string;
  departDate?: string;
  returnDate?: string;
}): Promise<LatestFare[]> {
  const token = aviasalesToken();
  if (!token) throw new Error('missing-token');
  const origin = cityCodeFor(opts.origin);
  const destination = cityCodeFor(opts.destination);
  if (origin.length !== 3 || destination.length !== 3) return [];
  const currency = String(opts.currency || 'usd').toLowerCase();
  const day = opts.departDate;
  const month = day?.slice(0, 7);
  const returnDate = opts.returnDate;
  const common = { origin, destination, currency, token };

  const settled = await Promise.allSettled([
    month ? cheapMonthPrices({ ...common, month, returnDate }) : Promise.resolve([] as LatestFare[]),
    month ? calendarMonthPrices({ ...common, month, returnDate }) : Promise.resolve([] as LatestFare[]),
    month ? monthMatrixPrices({ ...common, month, returnDate }) : Promise.resolve([] as LatestFare[]),
    month ? pricesForDates({ ...common, depart: month, returnDate: returnDate?.slice(0, 7) }) : Promise.resolve([] as LatestFare[]),
    month ? groupedMonthPrices({ ...common, month, returnDate }) : Promise.resolve([] as LatestFare[]),
    day ? pricesForDates({ ...common, depart: day, returnDate }) : Promise.resolve([] as LatestFare[]),
  ]);
  let raw = dedupeFares(
    settled.flatMap(r => r.status === 'fulfilled' ? r.value : []),
  );
  if (returnDate) {
    const roundTrip = raw.filter(r => !!r.returnDate);
    if (roundTrip.length) raw = roundTrip;
  }
  let rows = sanitizeFetchedFares(raw, currency);
  if (!rows.length) {
    rows = sanitizeFetchedFares(
      await latestMonthFallback({
        origin,
        destination,
        currency,
        token,
        month,
        oneWay: !returnDate,
      }).catch(() => []),
      currency,
    );
  }
  if (!rows.length) {
    rows = sanitizeFetchedFares(
      await latestMonthFallback({
        origin,
        destination,
        currency,
        token,
        oneWay: !returnDate,
      }).catch(() => []),
      currency,
    );
  }
  return rankFares(rows, day).slice(0, 30);
}

export function formatFare(price: number, symbol: string): string {
  const n = Math.round(price);
  return `${symbol}${n.toLocaleString()}`;
}

export function airlineLogoUrl(code: string): string {
  return `https://pics.avs.io/100/100/${encodeURIComponent(code)}.png`;
}
