/** OpenSky Network — direct client fetch (SEA bbox). */

export const OPENSKY_STATES_URL =
  'https://opensky-network.org/api/states/all?lamin=0&lomin=90&lamax=25&lomax=140';

const OPENSKY_USER = process.env.EXPO_PUBLIC_OPENSKY_USER || '';
const OPENSKY_PASS = process.env.EXPO_PUBLIC_OPENSKY_PASS || '';

function basicAuthHeader(user: string, pass: string): string {
  const raw = `${user}:${pass}`;
  if (typeof globalThis.btoa !== 'function') {
    throw new Error('btoa unavailable for OpenSky Basic auth');
  }
  return `Basic ${globalThis.btoa(raw)}`;
}

export type OpenSkyStatesResponse = {
  time?: number;
  states: unknown[] | null;
};

/** Fetch SEA aircraft states. Throws on HTTP/network errors. */
export async function fetchOpenSkyStates(): Promise<OpenSkyStatesResponse> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (OPENSKY_USER && OPENSKY_PASS) {
    headers.Authorization = basicAuthHeader(OPENSKY_USER, OPENSKY_PASS);
  }
  const res = await fetch(OPENSKY_STATES_URL, { headers });
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  return res.json();
}
