/**
 * Country info (flight detail → country card): REST Countries API v5.
 * GET https://api.restcountries.com/countries/v5?q={country}, Authorization: Bearer RESTCOUNTRIES_API_KEY (key stays on the proxy).
 * `q` is a full-text search, so the proxy turns the ISO code into the English country name (Intl.DisplayNames)
 * and keeps only the object whose codes.alpha_2 matches. Country facts barely change: cached 7 days per code.
 *
 * v5 has no visa, climate, phrases, ATM or emergency-number fields — the app keeps those from data/countryInfo.json.
 */

const RESTCOUNTRIES_API = 'https://api.restcountries.com/countries/v5';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MISS_TTL_MS = 60 * 60 * 1000;

const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });

/** ISO alpha-2 → search strings, most specific first ("Hong Kong SAR China" → "Hong Kong"). */
function searchNames(code) {
  let name = '';
  try {
    name = regionNames.of(code) || '';
  } catch {
    return [];
  }
  if (!name || name === code) return [];
  const clean = name
    .replace(/\s*\(.*?\)\s*/g, ' ')
    .replace(/\s+SAR China$/, '')
    .replace(/ - .*$/, '')
    .trim();
  const first = clean.split(/\s+/)[0];
  return [...new Set([clean, first].filter(s => s && s.length >= 3))];
}

function list(v) {
  return Array.isArray(v) ? v : [];
}

/** v5 country object → the compact shape the app renders. Full strings, nothing truncated. */
function toFacts(o) {
  const names = o.names || {};
  const native = Object.values(names.native || {})[0] || {};
  const capital = list(o.capitals).find(c => c && c.attributes && c.attributes.primary) || list(o.capitals)[0];
  return {
    code: (o.codes && o.codes.alpha_2) || '',
    name: names.common || '',
    officialName: names.official || '',
    nativeName: native.common || '',
    capital: (capital && capital.name) || '',
    region: o.region || '',
    subregion: o.subregion || '',
    population: Number.isFinite(o.population) ? o.population : null,
    languages: list(o.languages).map(l => l && l.name).filter(Boolean),
    currencies: list(o.currencies)
      .filter(c => c && c.code)
      .map(c => ({ code: c.code, name: c.name || '', symbol: c.symbol || '' })),
    callingCodes: list(o.calling_codes).map(String),
    timezones: list(o.timezones).map(String),
    drivingSide: (o.cars && o.cars.driving_side) || '',
    startOfWeek: (o.date && o.date.start_of_week) || '',
    temperatureScale: (o.units && o.units.temperature_scale) || '',
    flag: (o.flag && o.flag.emoji) || '',
    description: (o.descriptions && (o.descriptions.long || o.descriptions.short)) || '',
  };
}

/**
 * @param {object} opts
 * @param {string} [opts.apiKey] RESTCOUNTRIES_API_KEY; without it every lookup is null
 * @param {(url: string, init?: object) => Promise<{ ok: boolean, status: number, json: () => Promise<any> }>} opts.fetchImpl
 */
function createCountryFacts({ apiKey, fetchImpl, now = () => Date.now(), log = console }) {
  const cache = new Map();
  const pending = new Map();

  async function lookup(code) {
    for (const q of searchNames(code)) {
      const res = await fetchImpl(`${RESTCOUNTRIES_API}?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      });
      if (!res.ok) {
        log.warn('[restcountries]', code, q, '| HTTP', res.status);
        return null;
      }
      const json = await res.json();
      const hit = list(json && json.data && json.data.objects).find(o => o && o.codes && o.codes.alpha_2 === code);
      if (hit) return toFacts(hit);
    }
    return null;
  }

  /** Facts for an ISO alpha-2 code, or null (invalid code, no match, no key, API error). */
  function get(rawCode) {
    const code = String(rawCode || '').trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code) || !apiKey) return Promise.resolve(null);
    const hit = cache.get(code);
    if (hit && now() - hit.at < hit.ttl) return Promise.resolve(hit.facts);
    const running = pending.get(code);
    if (running) return running;
    const promise = lookup(code)
      .catch((e) => {
        log.warn('[restcountries]', code, '|', e && e.message);
        return null;
      })
      .then((facts) => {
        cache.set(code, { at: now(), ttl: facts ? CACHE_TTL_MS : MISS_TTL_MS, facts });
        return facts;
      })
      .finally(() => { pending.delete(code); });
    pending.set(code, promise);
    return promise;
  }

  return { get };
}

module.exports = {
  CACHE_TTL_MS,
  searchNames,
  toFacts,
  createCountryFacts,
};
