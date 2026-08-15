import { fetchJsonRetry } from '../lib/net';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

function fidsQuery(offsetDays = 0, date?: string): string {
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  if (offsetDays) params.set('offsetDays', String(offsetDays));
  const q = params.toString();
  return q ? `?${q}` : '';
}

export async function getADBDepartures(iata: string, offsetDays = 0, date?: string): Promise<any[]> {
  const q = fidsQuery(offsetDays, date);
  const json = await fetchJsonRetry(
    `${PROXY}/fids/${encodeURIComponent(iata)}/departure${q}`,
    date ? 20000 : 8000,
  );
  const items = fidsItems(json, 'departure');
  if (!items.length && !offsetDays) throw new Error('ADB_DEP_EMPTY');
  return items;
}

export async function getADBArrivals(iata: string, offsetDays = 0, date?: string): Promise<any[]> {
  const q = fidsQuery(offsetDays, date);
  const json = await fetchJsonRetry(
    `${PROXY}/fids/${encodeURIComponent(iata)}/arrival${q}`,
    date ? 20000 : 8000,
  );
  const items = fidsItems(json, 'arrival');
  if (!items.length && !offsetDays) throw new Error('ADB_ARR_EMPTY');
  return items;
}

function fidsItems(json: any, type: 'arrival' | 'departure'): any[] {
  if (type === 'arrival' && Array.isArray(json?.arrivals)) return json.arrivals;
  if (type === 'departure' && Array.isArray(json?.departures)) return json.departures;
  if (Array.isArray(json?.arrivals)) return json.arrivals;
  if (Array.isArray(json?.departures)) return json.departures;
  if (Array.isArray(json)) return json;
  return [];
}

export async function getADBFlight(ident: string): Promise<any[]> {
  const clean = String(ident || '').replace(/\s+/g, '').toUpperCase();
  const json = await fetchJsonRetry(`${PROXY}/flight/${encodeURIComponent(clean)}`);
  const items = Array.isArray(json) ? json : json ? [json] : [];
  if (!items.length) throw new Error('ADB_FLIGHT_EMPTY');
  return items;
}
