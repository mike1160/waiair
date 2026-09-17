import { fetchJsonRetry, fetchWithTimeout } from '../lib/net';
import { withUpstreamAbortLog } from '../lib/searchTimeout';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

function fidsQuery(offsetDays = 0, date?: string, arrIata?: string): string {
  const params = new URLSearchParams();
  if (date) {
    params.set('date', date);
    params.set('offsetDays', String(offsetDays || 0));
  } else if (offsetDays) {
    params.set('offsetDays', String(offsetDays));
  }
  if (arrIata) params.set('arr_iata', String(arrIata).toUpperCase());
  const q = params.toString();
  return q ? `?${q}` : '';
}

export async function getADBDepartures(iata: string, offsetDays = 0, date?: string, arrIata?: string): Promise<any[]> {
  const q = fidsQuery(offsetDays, date, arrIata);
  const json = await withUpstreamAbortLog('ADB', () => fetchJsonRetry(
    `${PROXY}/fids/${encodeURIComponent(iata)}/departure${q}`,
    date ? 20000 : 8000,
  ));
  const items = fidsItems(json, 'departure');
  if (!items.length && !offsetDays && !date) throw new Error('ADB_DEP_EMPTY');
  return items;
}

export async function getADBArrivals(iata: string, offsetDays = 0, date?: string): Promise<any[]> {
  const q = fidsQuery(offsetDays, date);
  const json = await withUpstreamAbortLog('ADB', () => fetchJsonRetry(
    `${PROXY}/fids/${encodeURIComponent(iata)}/arrival${q}`,
    date ? 20000 : 8000,
  ));
  const items = fidsItems(json, 'arrival');
  if (!items.length && !offsetDays) throw new Error('ADB_ARR_EMPTY');
  return items;
}

/** Cold hub boards are rate-limited upstream — one generous attempt, no retries. */
const CONNECTIONS_TIMEOUT_MS = 60000;

export type ADBConnection = {
  id: string;
  hub: string;
  layoverMin: number;
  /** FIDS departure items (origin → hub, hub → destination) with an `arrival.movement` side. */
  legs: any[];
};

/** 1-stop options for today. The proxy caches hub boards and results for 30 min across users. */
export async function getADBConnections(
  from: string,
  to: string,
  zones?: { fromTz?: string | null; toTz?: string | null },
): Promise<ADBConnection[]> {
  // Airport time zones pick the right local "today" on the proxy (it has no tz for most airports).
  const params = new URLSearchParams();
  if (zones?.fromTz) params.set('fromTz', zones.fromTz);
  if (zones?.toTz) params.set('toTz', zones.toTz);
  const q = params.toString();
  const res = await fetchWithTimeout(
    `${PROXY}/connections/${encodeURIComponent(from)}/${encodeURIComponent(to)}${q ? `?${q}` : ''}`,
    {},
    CONNECTIONS_TIMEOUT_MS,
  );
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const json = await res.json();
  return Array.isArray(json?.connections) ? json.connections : [];
}

function fidsItems(json: any, type: 'arrival' | 'departure'): any[] {
  if (type === 'arrival' && Array.isArray(json?.arrivals)) return json.arrivals;
  if (type === 'departure' && Array.isArray(json?.departures)) return json.departures;
  if (Array.isArray(json?.arrivals)) return json.arrivals;
  if (Array.isArray(json?.departures)) return json.departures;
  if (Array.isArray(json)) return json;
  return [];
}

/**
 * `headers`: a user search adds the quota headers (lib/searchQuotaStore.ts); polling and refreshes send none.
 * `date` (YYYY-MM-DD): that day's flights for a search on another day; without it, flights around today.
 */
export async function getADBFlight(ident: string, signal?: AbortSignal, headers?: Record<string, string>, date?: string): Promise<any[]> {
  const clean = String(ident || '').replace(/\s+/g, '').toUpperCase();
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) ? String(date) : '';
  const url = `${PROXY}/flight/${encodeURIComponent(clean)}${day ? `?date=${day}` : ''}`;
  const json = await withUpstreamAbortLog('ADB', () =>
    fetchJsonRetry(url, 8000, signal, headers));
  const items = Array.isArray(json) ? json : json ? [json] : [];
  if (!items.length) throw new Error('ADB_FLIGHT_EMPTY');
  return items;
}
