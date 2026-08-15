import { fetchJsonRetry } from '../lib/net';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export async function getADBDepartures(iata: string, offsetDays = 0): Promise<any[]> {
  const q = offsetDays ? `?offsetDays=${offsetDays}` : '';
  const json = await fetchJsonRetry(`${PROXY}/fids/${encodeURIComponent(iata)}/departure${q}`);
  const items = Array.isArray(json?.departures) ? json.departures
    : Array.isArray(json?.arrivals) ? json.arrivals
    : [];
  if (!items.length) throw new Error('ADB_DEP_EMPTY');
  return items;
}

export async function getADBArrivals(iata: string, offsetDays = 0): Promise<any[]> {
  const q = offsetDays ? `?offsetDays=${offsetDays}` : '';
  const json = await fetchJsonRetry(`${PROXY}/fids/${encodeURIComponent(iata)}/arrival${q}`);
  const items = Array.isArray(json?.arrivals) ? json.arrivals : [];
  if (!items.length) throw new Error('ADB_ARR_EMPTY');
  return items;
}

export async function getADBFlight(ident: string): Promise<any[]> {
  const clean = String(ident || '').replace(/\s+/g, '').toUpperCase();
  const json = await fetchJsonRetry(`${PROXY}/flight/${encodeURIComponent(clean)}`);
  const items = Array.isArray(json) ? json : json ? [json] : [];
  if (!items.length) throw new Error('ADB_FLIGHT_EMPTY');
  return items;
}
