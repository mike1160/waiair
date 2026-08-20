import { Linking } from 'react-native';
import { getLocales } from 'expo-localization';
import { AFFILIATE_MARKER, travelpayoutsToken } from './affiliateConfig';

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

export function fareSearchCode(place: AirportPlace | null | undefined, fallback?: string | null): string | null {
  const fromPlace = place?.cityCode || place?.code;
  const code = String(fromPlace || fallback || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  return code.length === 3 ? code : null;
}

function aviasalesMarket(): string {
  const loc = getLocales()[0];
  const lang = String(loc?.languageCode || '').toLowerCase();
  const region = String(loc?.regionCode || loc?.languageRegionCode || '').toUpperCase();
  const byLang: Record<string, string> = {
    th: 'th', nl: 'nl', de: 'de', fr: 'fr', es: 'es', it: 'it',
    pl: 'pl', ru: 'ru', vi: 'vn', ja: 'jp', ko: 'kr', pt: 'br',
  };
  if (byLang[lang]) return byLang[lang];
  if (region === 'GB') return 'gb';
  if (region === 'AU') return 'au';
  if (region === 'US') return 'us';
  return 'us';
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
  const returnDate = dayFromIso(r.return_at) || undefined;
  return {
    origin: String(r.origin_airport || r.origin || fallbackOrigin).toUpperCase(),
    destination: String(r.destination_airport || r.destination || fallbackDest).toUpperCase(),
    departDate,
    returnDate,
    airline: String(r.airline || '').toUpperCase(),
    transfers: Number(r.transfers ?? r.number_of_changes ?? 0),
    price,
  };
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
  const res = await fetch(url, { headers: { 'X-Access-Token': token } });
  if (!res.ok) throw new Error('fares');
  return res.json();
}

async function pricesForDates(opts: {
  origin: string;
  destination: string;
  currency: string;
  token: string;
  market: string;
  depart?: string;
  returnDate?: string;
}): Promise<LatestFare[]> {
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
    market: opts.market,
    token: opts.token,
  });
  if (opts.depart) params.set('departure_at', opts.depart);
  if (opts.returnDate) params.set('return_at', opts.returnDate);
  const json = await travelpayoutsJson(
    `https://api.travelpayouts.com/aviasales/v3/prices_for_dates?${params.toString()}`,
    opts.token,
  ) as { data?: V3FareRaw[] };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows
    .map(r => mapFare(r, opts.origin, opts.destination))
    .filter((r): r is LatestFare => !!r);
}

async function groupedMonthPrices(opts: {
  origin: string;
  destination: string;
  currency: string;
  token: string;
  market: string;
  month: string;
  returnDate?: string;
}): Promise<LatestFare[]> {
  const params = new URLSearchParams({
    origin: opts.origin,
    destination: opts.destination,
    currency: opts.currency,
    group_by: 'departure_at',
    direct: 'false',
    market: opts.market,
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
  ) as { data?: Record<string, V3FareRaw> | V3FareRaw[] };
  const raw = json.data;
  const rows = Array.isArray(raw) ? raw : raw && typeof raw === 'object' ? Object.values(raw) : [];
  return rows
    .map(r => mapFare(r, opts.origin, opts.destination))
    .filter((r): r is LatestFare => !!r);
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
  ) as { data?: V3FareRaw[] };
  const rows = Array.isArray(json.data) ? json.data : [];
  return rows
    .map(r => mapFare(r, opts.origin, opts.destination))
    .filter((r): r is LatestFare => !!r);
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
  const origin = iata(opts.origin);
  const destination = iata(opts.destination);
  if (origin.length !== 3 || destination.length !== 3) return [];
  const currency = String(opts.currency || 'usd').toLowerCase();
  const day = opts.departDate;
  const month = day?.slice(0, 7);
  const returnDate = opts.returnDate;
  const market = aviasalesMarket();
  const common = { origin, destination, currency, token, market };

  const settled = await Promise.allSettled([
    day ? pricesForDates({ ...common, depart: day, returnDate }) : Promise.resolve([] as LatestFare[]),
    month ? pricesForDates({ ...common, depart: month, returnDate: returnDate?.slice(0, 7) }) : Promise.resolve([] as LatestFare[]),
    month ? groupedMonthPrices({ ...common, month, returnDate }) : Promise.resolve([] as LatestFare[]),
  ]);
  let rows = dedupeFares(
    settled.flatMap(r => r.status === 'fulfilled' ? r.value : []),
  );
  if (!rows.length) {
    rows = await latestMonthFallback({
      origin,
      destination,
      currency,
      token,
      month,
      oneWay: !returnDate,
    }).catch(() => []);
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
