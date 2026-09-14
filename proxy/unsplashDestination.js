/**
 * Destination photos for flight cards: Unsplash search "{city} landmark" for the arrival airport, cached 24h per airport
 * (key unsplash_dest_{IATA}) so a destination costs at most one Unsplash search a day. The access key stays on the proxy.
 */

const UNSPLASH_API = 'https://api.unsplash.com';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
/** No result or an Unsplash error: remember null for an hour so a failing destination does not burn the rate limit. */
const MISS_TTL_MS = 60 * 60 * 1000;
/** Unsplash API guidelines: links to photographers carry the app's referral UTM. */
const UTM = 'utm_source=waiair&utm_medium=referral';

function cacheKey(iata) {
  return `unsplash_dest_${iata}`;
}

function withUtm(url) {
  if (!url) return '';
  return `${url}${url.includes('?') ? '&' : '?'}${UTM}`;
}

/** Unsplash search result → { url, photographer, photographerUrl }; null without a usable image URL. */
function toPhoto(result) {
  const url = result && result.urls && (result.urls.regular || result.urls.full);
  if (!url) return null;
  return {
    url,
    photographer: (result.user && result.user.name) || '',
    photographerUrl: withUtm(result.user && result.user.links && result.user.links.html),
  };
}

/**
 * @param {object} opts
 * @param {string} [opts.accessKey] UNSPLASH_ACCESS_KEY; without it every lookup is null
 * @param {(iata: string) => string} opts.cityFor IATA → city name ('' when unknown)
 * @param {(url: string, init?: object) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>} opts.fetchImpl
 */
function createDestinationPhotos({
  accessKey,
  cityFor,
  fetchImpl,
  now = () => Date.now(),
  random = Math.random,
  log = console,
}) {
  /** @type {Map<string, { at: number, ttl: number, photo: object | null }>} */
  const cache = new Map();
  /** @type {Map<string, Promise<object | null>>} */
  const pending = new Map();

  async function fetchPhoto(iata) {
    const city = cityFor(iata);
    if (!city) return null;
    const url = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(`${city} landmark`)}&orientation=landscape&per_page=3`;
    const headers = { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' };
    const res = await fetchImpl(url, { headers });
    if (!res.ok) {
      log.warn('[unsplash]', iata, city, '| HTTP', res.status);
      return null;
    }
    const json = await res.json();
    const results = (Array.isArray(json && json.results) ? json.results : []).filter(toPhoto);
    if (!results.length) return null;
    const pick = results[Math.min(results.length - 1, Math.floor(random() * results.length))];
    // Unsplash API guidelines: register the use of a displayed photo via its download_location.
    const track = pick.links && pick.links.download_location;
    if (track) Promise.resolve(fetchImpl(track, { headers })).catch(() => {});
    return toPhoto(pick);
  }

  /** Photo for the arrival airport, or null (invalid/unknown airport, no result, no key, Unsplash error). */
  function get(rawIata) {
    const iata = String(rawIata || '').trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(iata) || !accessKey) return Promise.resolve(null);
    const key = cacheKey(iata);
    const hit = cache.get(key);
    if (hit && now() - hit.at < hit.ttl) return Promise.resolve(hit.photo);
    const running = pending.get(key);
    if (running) return running;
    const promise = fetchPhoto(iata)
      .catch((e) => {
        log.warn('[unsplash]', iata, '|', e && e.message);
        return null;
      })
      .then((photo) => {
        cache.set(key, { at: now(), ttl: photo ? CACHE_TTL_MS : MISS_TTL_MS, photo });
        return photo;
      })
      .finally(() => { pending.delete(key); });
    pending.set(key, promise);
    return promise;
  }

  return { get, size: () => cache.size };
}

module.exports = {
  CACHE_TTL_MS,
  MISS_TTL_MS,
  cacheKey,
  toPhoto,
  createDestinationPhotos,
};
