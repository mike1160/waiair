import { fetchWithTimeout } from './net';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export interface DuffelOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  owner: { name: string };
  slices: Array<{
    segments: Array<{
      origin: string;
      destination: string;
      departing_at: string;
      arriving_at: string;
    }>;
  }>;
}

async function postDuffel(path: string, body: unknown): Promise<unknown> {
  const res = await fetchWithTimeout(
    `${PROXY}${path}`,
    {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    20000,
  );
  if (!res.ok) {
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  }
  const raw = await res.text();
  if (!raw || !raw.trim()) throw new Error('Empty response from Duffel proxy');
  return JSON.parse(raw);
}

function asOffers(json: unknown): DuffelOffer[] {
  if (Array.isArray(json)) return json as DuffelOffer[];
  if (json && typeof json === 'object') {
    const rec = json as Record<string, unknown>;
    if (Array.isArray(rec.offers)) return rec.offers as DuffelOffer[];
    if (Array.isArray(rec.data)) return rec.data as DuffelOffer[];
  }
  return [];
}

export async function searchDuffelFlights(
  origin: string,
  destination: string,
  date: string,
  passengers: number,
): Promise<DuffelOffer[]> {
  const json = await postDuffel('/duffel/search', {
    origin,
    destination,
    departure_date: date,
    passengers,
  });
  return asOffers(json);
}

export async function bookDuffelFlight(
  offerId: string,
  passengerData: object,
): Promise<unknown> {
  return postDuffel('/duffel/book', {
    offer_id: offerId,
    passengers: passengerData,
  });
}
