/**
 * Photos for a search phrase (a hotel name, a country) — same Unsplash search, access key and credit rules as
 * unsplashDestination.js, but keyed on the phrase. The caller sends its own fallback phrases, tried in order,
 * so "Holiday Inn Bangkok" can fall back to "Bangkok hotel". Landscape only.
 */

const { CACHE_TTL_MS, MISS_TTL_MS, toPhoto } = require('./unsplashDestination');

const UNSPLASH_API = 'https://api.unsplash.com';
const MAX_QUERIES = 3;
const MAX_QUERY_LEN = 80;
/** Enough results per phrase that a list of restaurants sharing one fallback phrase still gets distinct photos. */
const PER_PAGE = 10;

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
  /**
   * One entry per phrase, holding the whole result page. A caller asking for offset 3 of a phrase another
   * caller already searched costs nothing: the list is shared, only the pick differs.
   * @type {Map<string, { at: number, ttl: number, results: object[] }>}
   */
  const cache = new Map();
  /** @type {Map<string, Promise<object[]>>} */
  const pending = new Map();
  /** Photos whose use is already registered with Unsplash, so a re-pick does not register it twice. */
  const registered = new Set();
  const headers = { Authorization: `Client-ID ${accessKey}`, 'Accept-Version': 'v1' };

  /** Unsplash API guidelines: register the use of a displayed photo via its download_location. */
  function register(raw) {
    const id = raw && raw.id;
    const track = raw && raw.links && raw.links.download_location;
    if (!track || (id && registered.has(id))) return;
    if (id) registered.add(id);
    Promise.resolve(fetchImpl(track, { headers })).catch(() => {});
  }

  async function search(query) {
    const url = `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(query)}`
      + `&orientation=landscape&per_page=${PER_PAGE}`;
    const res = await fetchImpl(url, { headers });
    if (!res.ok) {
      log.warn('[unsplash place]', query, '| HTTP', res.status);
      return [];
    }
    const json = await res.json();
    return (Array.isArray(json && json.results) ? json.results : []).filter(toPhoto);
  }

  /** Phrase → its result page, cached (a miss is remembered for an hour so a dud phrase cannot burn the rate limit). */
  function page(rawQuery) {
    const query = normalizeQuery(rawQuery);
    if (!query || !accessKey) return Promise.resolve([]);
    const key = cacheKey(query);
    const hit = cache.get(key);
    if (hit && now() - hit.at < hit.ttl) return Promise.resolve(hit.results);
    const running = pending.get(key);
    if (running) return running;
    const promise = search(query)
      .catch((e) => {
        log.warn('[unsplash place]', query, '|', e && e.message);
        return [];
      })
      .then((results) => {
        cache.set(key, { at: now(), ttl: results.length ? CACHE_TTL_MS : MISS_TTL_MS, results });
        return results;
      })
      .finally(() => { pending.delete(key); });
    pending.set(key, promise);
    return promise;
  }

  /**
   * One phrase. `offset` picks the nth result, so several callers on the same phrase get different photos
   * (a restaurant list passes its row index). Without an offset the pick stays random, as it always was.
   */
  async function one(rawQuery, offset) {
    const results = await page(rawQuery);
    if (!results.length) return null;
    const n = Number(offset);
    const pick = Number.isInteger(n) && n >= 0
      ? results[n % results.length]
      : results[Math.min(results.length - 1, Math.floor(random() * results.length))];
    register(pick);
    return toPhoto(pick);
  }

  /** The first phrase with a photo, or null when none of them has one. */
  async function get(queries, offset) {
    const list = (Array.isArray(queries) ? queries : [queries]).slice(0, MAX_QUERIES);
    for (const query of list) {
      const photo = await one(query, offset);
      if (photo) return photo;
    }
    return null;
  }

  return { get, one, size: () => cache.size };
}

module.exports = {
  MAX_QUERIES,
  MAX_QUERY_LEN,
  PER_PAGE,
  cacheKey,
  normalizeQuery,
  createPlacePhotos,
};
