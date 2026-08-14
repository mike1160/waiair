/** OpenSky Network — SEA bbox via authenticated WaiAir proxy (OAuth2). */

const PROXY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_PROXY_URL) ||
  'https://waiair-production.up.railway.app';

export const OPENSKY_STATES_URL =
  'https://opensky-network.org/api/states/all?lamin=0&lomin=92&lamax=28&lomax=140';

export type OpenSkyStatesResponse = {
  time?: number;
  states: unknown[] | null;
};

/** Fetch SEA aircraft states via proxy (Bearer OAuth) with direct fallback. */
export async function fetchOpenSkyStates(): Promise<OpenSkyStatesResponse> {
  try {
    const res = await fetch(`${PROXY}/opensky/region/sea`);
    if (res.ok) return res.json();
  } catch { /* fall through */ }

  try {
    const res = await fetch(`${PROXY}/radar`);
    if (res.ok) return res.json();
  } catch { /* fall through */ }

  const res = await fetch(OPENSKY_STATES_URL, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`OpenSky ${res.status}`);
  return res.json();
}
