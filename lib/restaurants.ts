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

/** Price level as repeated local symbols: level 2 in Thailand is "฿฿". '' when Google has no level. */
export function priceLabel(priceLevel: number | null | undefined, currencyCode?: string | null): string {
  const level = num(priceLevel);
  if (level == null || level < 1) return '';
  return currencySymbol(currencyCode).repeat(Math.min(MAX_PRICE_SYMBOLS, Math.round(level)));
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

/** Unsplash phrases for a restaurant: its own food first, then the cuisine, then the city. */
export function restaurantPhotoQueries(r: Restaurant, city?: string | null): string[] {
  const town = clean(city);
  const out: string[] = [];
  if (r.name.length >= 3) out.push([r.name, town, 'food'].filter(Boolean).join(' '));
  if (r.cuisine) out.push([r.cuisine, 'food', town].filter(Boolean).join(' '));
  if (town) out.push(`${town} food`);
  return out;
}

/** One cache entry (and one in-session fetch) per neighbourhood. */
export function restaurantsCacheKey(area: string, city: string): string {
  const id = [clean(area), clean(city)].filter(Boolean).join('|').toLowerCase();
  return id ? `${RESTAURANTS_KEY_PREFIX}.${id}` : '';
}

export function restaurantsUrl(proxyBase: string, area: string, city: string, lang?: string): string {
  const base = String(proxyBase || '').replace(/\/$/, '');
  const qs = new URLSearchParams({ area: clean(area), city: clean(city) });
  if (clean(lang)) qs.set('lang', clean(lang));
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
