/**
 * Country info — client for the proxy's REST Countries v5 route (proxy/countryFacts.js).
 * The v5 API key stays on the proxy. One fetch per country per app session.
 */
import { fetchWithTimeout } from './net';
import { PROXY_BASE } from './proxyUrl.ts';

const PROXY = PROXY_BASE;

export type CountryFacts = {
  code: string;
  name: string;
  officialName: string;
  nativeName: string;
  capital: string;
  region: string;
  subregion: string;
  population: number | null;
  languages: string[];
  currencies: { code: string; name: string; symbol: string }[];
  callingCodes: string[];
  timezones: string[];
  drivingSide: 'left' | 'right' | '';
  startOfWeek: string;
  temperatureScale: string;
  flag: string;
  description: string;
};

const cache = new Map<string, Promise<CountryFacts | null>>();

/** REST Countries v5 facts for an ISO alpha-2 code; null when unknown or offline (a later call retries). */
export function fetchCountryFacts(country?: string): Promise<CountryFacts | null> {
  const code = String(country || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return Promise.resolve(null);
  const hit = cache.get(code);
  if (hit) return hit;
  const promise = fetchWithTimeout(`${PROXY}/countries/${code}`, {}, 8000)
    .then(res => (res.ok ? res.json() as Promise<CountryFacts | null> : null))
    .then(json => (json && json.code === code ? json : null))
    .catch(() => null)
    .then(facts => {
      if (!facts) cache.delete(code);
      return facts;
    });
  cache.set(code, promise);
  return promise;
}
