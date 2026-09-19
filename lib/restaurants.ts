/**
 * Restaurants for a neighbourhood: the proxy lookup's shape, how a row is written out, and the Maps deeplink.
 * Pure — no React Native imports — so the price symbols, the sort and the cache rules are unit-tested.
 * The Google Places key lives on the proxy (proxy/restaurantPlaces.js); the app only ever sees these fields.
 */

export const RESTAURANTS_TTL_MS = 24 * 60 * 60 * 1000;
export const RESTAURANTS_KEY_PREFIX = 'waiair.restaurants.v1';
/** Price level 4 would be "฿฿฿฿฿"; the cards stay readable at 4 symbols. */
const MAX_PRICE_SYMBOLS = 4;

export type Restaurant = {
  placeId: string;
  name: string;
  rating: number | null;
  ratingCount: number | null;
  /** 0–4 from Google (free … very expensive), null when unknown. */
  priceLevel: number | null;
  cuisine: string;
  openNow: boolean | null;
  address: string;
  lat: number | null;
  lng: number | null;
};

function clean(raw?: unknown): string {
  return String(raw ?? '').trim().replace(/\s+/g, ' ');
}

function num(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** One proxy row → a restaurant; null when it has no name (then it is left out). */
export function toRestaurant(raw: unknown): Restaurant | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = clean(r.name);
  if (!name) return null;
  const rating = num(r.rating);
  const level = num(r.priceLevel);
  return {
    placeId: clean(r.placeId),
    name,
    rating: rating != null && rating > 0 ? rating : null,
    ratingCount: num(r.ratingCount),
    priceLevel: level != null && level >= 0 && level <= 4 ? Math.round(level) : null,
    cuisine: clean(r.cuisine),
    openNow: typeof r.openNow === 'boolean' ? r.openNow : null,
    address: clean(r.address),
    lat: num(r.lat),
    lng: num(r.lng),
  };
}

/** The proxy body → the list the section shows, highest rating first. */
export function parseRestaurants(body: unknown): Restaurant[] {
  if (!Array.isArray(body)) return [];
  return body
    .map(toRestaurant)
    .filter((r): r is Restaurant => !!r)
    .sort((a, b) => {
      const ra = a.rating ?? -1;
      const rb = b.rating ?? -1;
      if (rb !== ra) return rb - ra;
      return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
    });
}

/** Local currency symbol per ISO code, for the price level; '$' for anything unmapped. */
const CURRENCY_SYMBOLS: Record<string, string> = {
  THB: '฿', EUR: '€', GBP: '£', USD: '$', SGD: 'S$', MYR: 'RM', AED: 'AED',
  JPY: '¥', KRW: '₩', CNY: '¥', HKD: 'HK$', TWD: 'NT$', INR: '₹', IDR: 'Rp',
  VND: '₫', PHP: '₱', AUD: 'A$', NZD: 'NZ$', CAD: 'C$', CHF: 'CHF', TRY: '₺',
  QAR: 'QAR', SAR: 'SAR', ZAR: 'R', BRL: 'R$', MXN: 'MX$', SEK: 'kr', NOK: 'kr', DKK: 'kr',
  PLN: 'zł', CZK: 'Kč', HUF: 'Ft', EGP: 'E£', ILS: '₪', KHR: '៛', LAK: '₭',
};

export function currencySymbol(code?: string | null): string {
  return CURRENCY_SYMBOLS[clean(code).toUpperCase()] || '$';
}

/**
 * Price level as repeated local symbols: level 2 in Thailand is "฿฿". '' when Google has no level.
 * Only a one-character symbol can be repeated readably — "RMRMRMRM" (ringgit) or "S$S$" is noise — so a
 * multi-character symbol falls back to the universal "$$" price scale; the currency chip already names the money.
 */
export function priceLabel(priceLevel: number | null | undefined, currencyCode?: string | null): string {
  const level = num(priceLevel);
  if (level == null || level < 1) return '';
  const symbol = currencySymbol(currencyCode);
  const mark = [...symbol].length === 1 ? symbol : '$';
  return mark.repeat(Math.min(MAX_PRICE_SYMBOLS, Math.round(level)));
}

/** Rating as "⭐ 4.2"; '' when the place is unrated. */
export function ratingLabel(rating: number | null | undefined): string {
  const r = num(rating);
  if (r == null || r <= 0) return '';
  return `⭐ ${r.toFixed(1)}`;
}

/**
 * The grey line under a restaurant's name: rating, price, cuisine and "Open now", whichever are known.
 * `openNow: false` says nothing — a closed restaurant is still worth showing, so only "open" is called out.
 */
export function restaurantMeta(
  r: Restaurant,
  currencyCode: string | null | undefined,
  openNowLabel: string,
): string {
  return [ratingLabel(r.rating), priceLabel(r.priceLevel, currencyCode), r.cuisine, r.openNow ? openNowLabel : '']
    .filter(Boolean)
    .join('  ·  ');
}

/** Google Maps for one restaurant: the place id when we have it, otherwise a name + city search. */
export function restaurantMapsUrl(r: Restaurant, city?: string | null): string {
  const q = encodeURIComponent([r.name, clean(city)].filter(Boolean).join(' '));
  return r.placeId
    ? `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(r.placeId)}`
    : `https://www.google.com/maps/search/?api=1&query=${q}`;
}

/**
 * Unsplash phrases for a restaurant: its cuisine in this city, then the city's food.
 * Deliberately not the restaurant's own name: Unsplash has no photo of "Amritsr Restaurant Sukhumvit Soi 22",
 * so that phrase only ever cost an API call and returned nothing. Eight rows now share two or three searches,
 * and each row still gets its own photo because the row index picks a different result from the page.
 */
export function restaurantPhotoQueries(r: Restaurant, city?: string | null): string[] {
  const town = clean(city);
  const out: string[] = [];
  if (r.cuisine) out.push([r.cuisine, 'food', town].filter(Boolean).join(' '));
  if (town) out.push(`${town} food`, `${town} street food`);
  return out;
}

/** How many times a row tries another photo when its first one is already on screen in the same list. */
export const MAX_PHOTO_ATTEMPTS = 3;

/**
 * The Unsplash result a row asks for. Attempt 0 is its own position; each retry jumps a whole list further, so
 * a retry never lands on a result another row of this list is already asking for.
 */
export function restaurantPhotoOffset(index: number, attempt: number, listSize: number): number {
  const size = Math.max(1, Math.floor(listSize) || 1);
  return Math.max(0, Math.floor(index)) + Math.max(0, Math.floor(attempt)) * size;
}

/**
 * The on-device cache subject for a restaurant photo. The offset is part of it: the photo belongs to "this
 * restaurant at this position", and a photo cached before per-row offsets existed is never shown again.
 */
export function restaurantPhotoSubject(r: Restaurant, offset: number): string {
  return `${r.placeId || r.name}#${Math.max(0, Math.floor(offset))}`;
}

/**
 * Which row shows which photo, so no photo appears twice in one list. Different cuisines can still return the
 * same Unsplash photo from different searches; the second row to get it tries another one instead.
 */
export function createPhotoClaims() {
  const byRow = new Map<number, string>();
  return {
    /** True when this row may show `url`; false when another row of the list already shows it. */
    claim(url: string, row: number): boolean {
      for (const [other, taken] of byRow) {
        if (other !== row && taken === url) return false;
      }
      byRow.set(row, url);
      return true;
    },
    release(row: number): void {
      byRow.delete(row);
    },
    clear(): void {
      byRow.clear();
    },
  };
}

/** One cache entry (and one in-session fetch) per neighbourhood. */
export function restaurantsCacheKey(area: string, city: string): string {
  const id = [clean(area), clean(city)].filter(Boolean).join('|').toLowerCase();
  return id ? `${RESTAURANTS_KEY_PREFIX}.${id}` : '';
}

/**
 * The proxy URL. lat/lng are the arrival airport: Google biases a text search by the caller's IP, so without
 * them a generic area name ("Marina", "Downtown") finds restaurants near the proxy instead of near the traveller.
 */
export function restaurantsUrl(
  proxyBase: string,
  area: string,
  city: string,
  lang?: string,
  lat?: number | null,
  lng?: number | null,
): string {
  const base = String(proxyBase || '').replace(/\/$/, '');
  const qs = new URLSearchParams({ area: clean(area), city: clean(city) });
  if (clean(lang)) qs.set('lang', clean(lang));
  if (typeof lat === 'number' && Number.isFinite(lat) && typeof lng === 'number' && Number.isFinite(lng)) {
    qs.set('lat', String(lat));
    qs.set('lng', String(lng));
  }
  return clean(area) || clean(city) ? `${base}/places/restaurants?${qs.toString()}` : '';
}

export type RestaurantsCacheEntry = { at: number; list: Restaurant[] };

/** Stored entry → list; expired or malformed reads as null, so the neighbourhood is fetched again. */
export function parseRestaurantsCache(
  raw: string | null | undefined,
  now = Date.now(),
  ttlMs = RESTAURANTS_TTL_MS,
): Restaurant[] | null {
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as Partial<RestaurantsCacheEntry> | null;
    const at = Number(entry?.at);
    if (!Number.isFinite(at) || now - at >= ttlMs) return null;
    if (!Array.isArray(entry?.list)) return null;
    return parseRestaurants(entry.list);
  } catch {
    return null;
  }
}

/** A remembered lookup, including a remembered empty result (so it is not retried every tap). */
export function restaurantsCacheValue(list: Restaurant[], now = Date.now()): string {
  return JSON.stringify({ at: now, list } satisfies RestaurantsCacheEntry);
}
