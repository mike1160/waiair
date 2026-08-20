import { travelpayoutsToken } from './affiliateConfig';
import { shiftDateKey } from './boardFilter';

export { bookingAffiliateUrl } from './affiliateConfig';

export const AIRPORT_CITY: Record<string, string> = {
  BKK: 'Bangkok',
  DMK: 'Bangkok',
  CNX: 'Chiang Mai',
  HKT: 'Phuket',
  USM: 'Koh Samui',
  SGN: 'Ho Chi Minh City',
  HAN: 'Hanoi',
  KUL: 'Kuala Lumpur',
  SIN: 'Singapore',
  AMS: 'Amsterdam',
  LHR: 'London',
  CDG: 'Paris',
};

export type HotelOffer = {
  name: string;
  price: number;
  stars: number;
};

type HotelRaw = Record<string, unknown>;

function asRecord(v: unknown): HotelRaw | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as HotelRaw : null;
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  return String(v || '').trim();
}

export function hotelCityName(iata?: string, destCity?: string): string {
  const code = String(iata || '').trim().toUpperCase();
  if (AIRPORT_CITY[code]) return AIRPORT_CITY[code];
  const city = String(destCity || '').split(',')[0].trim();
  if (city && city !== '—' && !/^unknown$/i.test(city)) return city;
  return code;
}

function mapHotel(raw: unknown): HotelOffer | null {
  const r = asRecord(raw);
  if (!r) return null;
  const loc = asRecord(r.location);
  const name = str(
    r.hotelName ?? r.hotel_name ?? r.name ?? r.title ?? loc?.name,
  );
  if (!name) return null;
  const price = num(
    r.priceFrom ?? r.price_from ?? r.price ?? r.avg_price ?? r.minPrice ?? r.value,
  );
  if (price == null || price <= 0) return null;
  const stars = Math.max(0, Math.min(5, Math.round(num(r.stars ?? r.starRating ?? r.star_rating ?? r.rating) ?? 0)));
  return { name, price, stars };
}

function rowsFromJson(json: unknown): unknown[] {
  if (Array.isArray(json)) return json;
  const r = asRecord(json);
  if (!r) return [];
  for (const key of ['data', 'hotels', 'results', 'items']) {
    const v = r[key];
    if (Array.isArray(v)) return v;
  }
  return [];
}

async function getJson(url: string, token: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'X-Access-Token': token },
    });
    if (!res.ok) throw new Error('hotels');
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function searchTravelpayoutsHotels(opts: {
  city: string;
  checkIn: string;
  checkOut: string;
  currency: string;
  token: string;
}): Promise<HotelOffer[]> {
  const params = new URLSearchParams({
    query: opts.city,
    check_in: opts.checkIn,
    check_out: opts.checkOut,
    adults: '1',
    currency: opts.currency.toLowerCase(),
    limit: '3',
    token: opts.token,
  });
  const json = await getJson(
    `https://api.travelpayouts.com/v1/hotels/search?${params.toString()}`,
    opts.token,
  );
  return rowsFromJson(json).map(mapHotel).filter((h): h is HotelOffer => !!h);
}

async function searchHotellookCache(opts: {
  city: string;
  checkIn: string;
  checkOut: string;
  currency: string;
  token: string;
}): Promise<HotelOffer[]> {
  const params = new URLSearchParams({
    location: opts.city,
    checkIn: opts.checkIn,
    checkOut: opts.checkOut,
    currency: opts.currency.toLowerCase(),
    limit: '3',
    token: opts.token,
  });
  const json = await getJson(
    `https://engine.hotellook.com/api/v2/cache.json?${params.toString()}`,
    opts.token,
  );
  return rowsFromJson(json).map(mapHotel).filter((h): h is HotelOffer => !!h);
}

export async function fetchHotelsTonight(opts: {
  city: string;
  checkIn: string;
  currency: string;
}): Promise<HotelOffer[]> {
  const token = travelpayoutsToken();
  if (!token || !opts.city) return [];
  const checkOut = shiftDateKey(opts.checkIn, 1);
  const common = {
    city: opts.city,
    checkIn: opts.checkIn,
    checkOut,
    currency: opts.currency,
    token,
  };
  try {
    const primary = await searchTravelpayoutsHotels(common);
    if (primary.length) return primary.slice(0, 3);
  } catch { /* try legacy cache */ }
  try {
    const cached = await searchHotellookCache(common);
    return cached.slice(0, 3);
  } catch {
    return [];
  }
}
