/**
 * Restaurants per neighbourhood (flight detail page → "Restaurants & wijken", Pro).
 * Google Places API (New) places:searchText; GOOGLE_PLACES_API_KEY stays on the proxy, like hotelPlaces.js.
 * One billed call per neighbourhood per 24h: every user asking for the same neighbourhood shares that result.
 */

const PLACES_API = 'https://places.googleapis.com/v1';
const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
/** A miss (no key, HTTP error, nothing found) is remembered briefly so a broken upstream is not hammered. */
const MISS_TTL_MS = 10 * 60 * 1000;
const MAX_CACHE = 500;
const MAX_TERM = 80;
const TOP_N = 8;

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.rating',
  'places.userRatingCount',
  'places.priceLevel',
  'places.primaryTypeDisplayName',
  'places.currentOpeningHours.openNow',
  'places.formattedAddress',
  'places.location',
].join(',');

const PRICE_LEVELS = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

function cleanTerm(raw) {
  return String(raw || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TERM);
}

function cleanLang(raw) {
  const s = String(raw || '').trim();
  return /^[a-z]{2}(-[A-Za-z]{2})?$/.test(s) ? s : 'en';
}

/** The text query Google gets: `restaurants in "Sukhumvit Bangkok"`. */
function searchText(area) {
  return `restaurants in "${area}"`;
}

/** Places (New) place → the fields the card shows; null when it has no name. */
function toRestaurant(p) {
  const name = (p && p.displayName && p.displayName.text) || '';
  if (!name) return null;
  const rating = Number(p && p.rating);
  const priceLevel = PRICE_LEVELS[p && p.priceLevel];
  const loc = (p && p.location) || null;
  return {
    placeId: (p && p.id) || '',
    name,
    rating: Number.isFinite(rating) && rating > 0 ? Math.round(rating * 10) / 10 : null,
    ratingCount: Number.isFinite(Number(p && p.userRatingCount)) ? Number(p.userRatingCount) : null,
    priceLevel: typeof priceLevel === 'number' ? priceLevel : null,
    cuisine: (p && p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || '',
    openNow: typeof (p && p.currentOpeningHours && p.currentOpeningHours.openNow) === 'boolean'
      ? p.currentOpeningHours.openNow
      : null,
    address: (p && p.formattedAddress) || '',
    lat: loc && Number.isFinite(Number(loc.latitude)) ? Number(loc.latitude) : null,
    lng: loc && Number.isFinite(Number(loc.longitude)) ? Number(loc.longitude) : null,
  };
}

/** Highest rating first; a rated place always beats an unrated one, ties broken by how many people rated it. */
function byRating(a, b) {
  const ra = a.rating == null ? -1 : a.rating;
  const rb = b.rating == null ? -1 : b.rating;
  if (rb !== ra) return rb - ra;
  return (b.ratingCount || 0) - (a.ratingCount || 0);
}

function rankRestaurants(places, top = TOP_N) {
  return (Array.isArray(places) ? places : [])
    .map(toRestaurant)
    .filter(Boolean)
    .sort(byRating)
    .slice(0, top);
}

function setBounded(map, key, value) {
  if (map.size >= MAX_CACHE) map.delete(map.keys().next().value);
  map.set(key, value);
}

/**
 * @param {object} opts
 * @param {string} [opts.apiKey] GOOGLE_PLACES_API_KEY; without it every search is empty
 * @param {(url: string, init?: object) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>} opts.fetchImpl
 * @param {() => void} [opts.acquire] spend guard, called before the billed Google call; throws when over budget
 */
function createRestaurantPlaces({ apiKey, fetchImpl, acquire = () => {}, now = () => Date.now(), log = console }) {
  const cache = new Map();

  /** Top-rated restaurants for "{neighbourhood} {city}"; always an array, empty when unknown. */
  async function search({ area, city, lang } = {}) {
    const hood = cleanTerm(area);
    const town = cleanTerm(city);
    const where = [hood, town].filter(Boolean).join(' ');
    if (!where) return [];
    const language = cleanLang(lang);
    const key = `${language}|${where.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < (hit.list.length ? SEARCH_TTL_MS : MISS_TTL_MS)) return hit.list;
    if (!apiKey) return [];

    acquire();
    let list = [];
    try {
      const res = await fetchImpl(`${PLACES_API}/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify({
          textQuery: searchText(where),
          includedType: 'restaurant',
          languageCode: language,
          maxResultCount: 20,
        }),
      });
      if (!res.ok) {
        log.warn('[places] restaurants HTTP', res.status);
      } else {
        const json = await res.json();
        list = rankRestaurants(json && json.places);
      }
    } catch (e) {
      log.warn('[places] restaurants |', e && e.message);
    }
    setBounded(cache, key, { at: now(), list });
    return list;
  }

  return { search };
}

module.exports = {
  MISS_TTL_MS,
  SEARCH_TTL_MS,
  TOP_N,
  cleanTerm,
  searchText,
  toRestaurant,
  rankRestaurants,
  createRestaurantPlaces,
};
