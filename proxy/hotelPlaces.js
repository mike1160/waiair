/**
 * Hotel autocomplete (trip extras → hotel name field): Google Places API (New).
 * GOOGLE_PLACES_API_KEY stays on the proxy. The app sends one session token per typing session so
 * Google bills the autocomplete keystrokes + the final details lookup as a single session.
 * Results are cached briefly per query so repeated keystrokes / other users typing the same hotel cost nothing.
 */

const PLACES_API = 'https://places.googleapis.com/v1';
const SUGGEST_TTL_MS = 10 * 60 * 1000;
const DETAILS_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE = 2000;
const MIN_QUERY = 3;
const MAX_QUERY = 120;

function cleanQuery(raw) {
  return String(raw || '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
}

function cleanLang(raw) {
  const s = String(raw || '').trim();
  return /^[a-z]{2}(-[A-Za-z]{2})?$/.test(s) ? s : 'en';
}

/** Session tokens are opaque to us; accept UUID-ish strings only. */
function cleanSession(raw) {
  const s = String(raw || '').trim();
  return /^[A-Za-z0-9-]{8,64}$/.test(s) ? s : '';
}

/** Places (New) place IDs: letters, digits, '-' and '_'. */
function cleanPlaceId(raw) {
  const s = String(raw || '').trim();
  return /^[A-Za-z0-9_-]{10,300}$/.test(s) ? s : '';
}

/** places:autocomplete suggestion → { placeId, name, secondary } (null for query predictions). */
function toSuggestion(s) {
  const p = s && s.placePrediction;
  if (!p || !p.placeId) return null;
  const main = p.structuredFormat && p.structuredFormat.mainText && p.structuredFormat.mainText.text;
  const secondary = p.structuredFormat && p.structuredFormat.secondaryText && p.structuredFormat.secondaryText.text;
  return {
    placeId: p.placeId,
    name: main || (p.text && p.text.text) || '',
    secondary: secondary || '',
  };
}

function setBounded(map, key, value) {
  if (map.size >= MAX_CACHE) map.delete(map.keys().next().value);
  map.set(key, value);
}

/**
 * @param {object} opts
 * @param {string} [opts.apiKey] GOOGLE_PLACES_API_KEY; without it every lookup is empty
 * @param {(url: string, init?: object) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>} opts.fetchImpl
 * @param {() => void} [opts.acquire] spend guard, called before every billed Google call; throws when over budget
 */
function createHotelPlaces({ apiKey, fetchImpl, acquire = () => {}, now = () => Date.now(), log = console }) {
  const suggestCache = new Map();
  const detailsCache = new Map();

  /** Lodging suggestions for `q`; optional lat/lng biases results toward the destination airport. */
  async function suggest({ q, lang, lat, lng, session }) {
    const input = cleanQuery(q);
    if (!apiKey || input.length < MIN_QUERY) return [];
    const language = cleanLang(lang);
    const hasBias = Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const key = `${language}|${input.toLowerCase()}|${hasBias ? `${lat.toFixed(1)},${lng.toFixed(1)}` : ''}`;
    const hit = suggestCache.get(key);
    if (hit && now() - hit.at < SUGGEST_TTL_MS) return hit.list;

    const body = { input, includedPrimaryTypes: ['lodging'], languageCode: language };
    if (hasBias) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius: 50000 } };
    const sessionToken = cleanSession(session);
    if (sessionToken) body.sessionToken = sessionToken;

    acquire();
    const res = await fetchImpl(`${PLACES_API}/places:autocomplete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      log.warn('[places] autocomplete HTTP', res.status);
      return [];
    }
    const json = await res.json();
    const list = (Array.isArray(json && json.suggestions) ? json.suggestions : [])
      .map(toSuggestion)
      .filter(Boolean)
      .slice(0, 6);
    setBounded(suggestCache, key, { at: now(), list });
    return list;
  }

  /** Name + formatted address for a picked suggestion; null when unknown. */
  async function details({ placeId, lang, session }) {
    const id = cleanPlaceId(placeId);
    if (!apiKey || !id) return null;
    const language = cleanLang(lang);
    const key = `${language}|${id}`;
    const hit = detailsCache.get(key);
    if (hit && now() - hit.at < DETAILS_TTL_MS) return hit.place;

    const sessionToken = cleanSession(session);
    const qs = new URLSearchParams({ languageCode: language });
    if (sessionToken) qs.set('sessionToken', sessionToken);
    acquire();
    const res = await fetchImpl(`${PLACES_API}/places/${encodeURIComponent(id)}?${qs.toString()}`, {
      headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': 'id,displayName,formattedAddress' },
    });
    if (!res.ok) {
      log.warn('[places] details HTTP', res.status);
      return null;
    }
    const json = await res.json();
    const place = {
      placeId: id,
      name: (json && json.displayName && json.displayName.text) || '',
      address: (json && json.formattedAddress) || '',
    };
    setBounded(detailsCache, key, { at: now(), place });
    return place;
  }

  return { suggest, details };
}

module.exports = {
  MIN_QUERY,
  cleanPlaceId,
  cleanQuery,
  toSuggestion,
  createHotelPlaces,
};
