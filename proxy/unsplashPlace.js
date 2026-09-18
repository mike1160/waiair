/**
 * Photos for a search phrase (a hotel name, a country) — same Unsplash search, access key and credit rules as
 * unsplashDestination.js, but keyed on the phrase. The caller sends its own fallback phrases, tried in order,
 * so "Holiday Inn Bangkok" can fall back to "Bangkok hotel". Landscape only.
 */

const { CACHE_TTL_MS, MISS_TTL_MS, toPhoto } = require('./unsplashDestination');

const UNSPLASH_API = 'https://api.unsplash.com';
const MAX_QUERIES = 3;
const MAX_QUERY_LEN = 80;

/** Phrase → cache/search form: trimmed, single spaces, lower case; '' when too short to search. */
function normalizeQuery(raw) {
  const q = String(raw || '').trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LEN).toLowerCase();
  return q.length >= 3 ? q : '';
}

function cacheKey(query) {
  return `unsplash_place_${normalizeQuery(query)}`;
}

/**
 * @param {object} opts
 * @param {string} [opts.accessKey] UNSPLASH_ACCESS_KEY; without it every lookup is null
 * @param {(url: string, init?: object) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>} opts.fetchImpl
 */
function createPlacePhotos({
  accessKey,
  fetchImpl,
  now = () => Date.now(),
  random = Math.random,
  log = console,
}) {
  /** @type {Map<string, { at: number, ttl: number, photo: object | null }>} */
  const cache = new Map();
  /** @type {Map<string, Promise<object | null>>} */
  const pending = new Map();

  async function search(query) {
    const url = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(query)}&orientation=landscape&per_page=3`;
    const headers = { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' };
    const res = await fetchImpl(url, { headers });
    if (!res.ok) {
      log.warn('[unsplash place]', query, '| HTTP', res.status);
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

  /** One phrase, cached (a miss is remembered for an hour so a dud phrase cannot burn the rate limit). */
  function one(rawQuery) {
    const query = normalizeQuery(rawQuery);
    if (!query || !accessKey) return Promise.resolve(null);
    const key = cacheKey(query);
    const hit = cache.get(key);
    if (hit && now() - hit.at < hit.ttl) return Promise.resolve(hit.photo);
    const running = pending.get(key);
    if (running) return running;
    const promise = search(query)
      .catch((e) => {
        log.warn('[unsplash place]', query, '|', e && e.message);
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

  /** The first phrase with a photo, or null when none of them has one. */
  async function get(queries) {
    const list = (Array.isArray(queries) ? queries : [queries]).slice(0, MAX_QUERIES);
    for (const query of list) {
      const photo = await one(query);
      if (photo) return photo;
    }
    return null;
  }

  return { get, one, size: () => cache.size };
}

module.exports = {
  MAX_QUERIES,
  MAX_QUERY_LEN,
  cacheKey,
  normalizeQuery,
  createPlacePhotos,
};
