import { Alert } from 'react-native';
import { t } from './i18n';
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
    40000,
  );
  const raw = await res.text();
  if (!res.ok) {
    console.log('[Duffel] HTTP error', { path, status: res.status, body: raw.slice(0, 800) });
    throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  }
  if (!raw || !raw.trim()) throw new Error('Empty response from Duffel proxy');
  return JSON.parse(raw);
}

function placeCode(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>;
    const code = rec.iata_code || rec.iata;
    if (typeof code === 'string') return code;
  }
  return '';
}

function ownerName(v: unknown): string {
  if (v && typeof v === 'object') {
    const rec = v as Record<string, unknown>;
    if (typeof rec.name === 'string' && rec.name) return rec.name;
    if (typeof rec.iata_code === 'string' && rec.iata_code) return rec.iata_code;
  }
  return 'Airline';
}

function normalizeOffer(raw: unknown): DuffelOffer | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const slicesIn = Array.isArray(o.slices) ? o.slices : [];
  return {
    id: String(o.id || ''),
    total_amount: String(o.total_amount || ''),
    total_currency: String(o.total_currency || ''),
    owner: { name: ownerName(o.owner) },
    slices: slicesIn.map((slice) => {
      const rec = slice && typeof slice === 'object' ? slice as Record<string, unknown> : {};
      const segs = Array.isArray(rec.segments) ? rec.segments : [];
      return {
        segments: segs.map((seg) => {
          const s = seg && typeof seg === 'object' ? seg as Record<string, unknown> : {};
          return {
            origin: placeCode(s.origin),
            destination: placeCode(s.destination),
            departing_at: String(s.departing_at || ''),
            arriving_at: String(s.arriving_at || ''),
          };
        }),
      };
    }),
  };
}

function asOffers(json: unknown): DuffelOffer[] {
  let list: unknown[] = [];
  if (Array.isArray(json)) list = json;
  else if (json && typeof json === 'object') {
    const rec = json as Record<string, unknown>;
    if (Array.isArray(rec.offers)) list = rec.offers;
    else if (Array.isArray(rec.data)) list = rec.data;
  }
  return list.map(normalizeOffer).filter((o): o is DuffelOffer => !!o && !!o.id);
}

function offerSummary(offers: DuffelOffer[]) {
  return offers.slice(0, 3).map((o) => {
    const seg = o.slices[0]?.segments[0];
    return {
      id: o.id,
      airline: o.owner.name,
      price: `${o.total_currency} ${o.total_amount}`,
      route: seg ? `${seg.origin}→${seg.destination}` : '',
      depart: seg?.departing_at || '',
    };
  });
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
  const offers = asOffers(json);
  const rawCount = Array.isArray(json) ? json.length : offers.length;
  console.log('[Duffel] search result', {
    origin,
    destination,
    date,
    passengers,
    rawType: Array.isArray(json) ? 'array' : typeof json,
    rawCount,
    offers: offers.length,
    sample: offerSummary(offers),
  });
  return offers;
}

/** Search Duffel and deliver results (possibly empty) via onOffers, or show an alert on error. */
export async function searchDuffelFlightsOrFallback(
  origin?: string,
  destination?: string,
  date?: string,
  passengers = 1,
  onOffers?: (offers: DuffelOffer[]) => void,
): Promise<void> {
  const o = String(origin || '').trim().toUpperCase();
  const d = String(destination || '').trim().toUpperCase();
  const day = String(date || '').trim();
  console.log('[Duffel] search start', { origin: o, destination: d, date: day, passengers });
  if (!o || !d || !day) {
    console.log('[Duffel] skip — missing origin, destination or date');
    return;
  }
  try {
    const offers = await searchDuffelFlights(o, d, day, passengers);
    if (offers.length === 0) {
      console.log('[Duffel] empty offers — showing sheet/fallback UI');
    } else {
      console.log('[Duffel] opening DuffelOffersSheet with real offers', offers.length);
    }
    if (onOffers) {
      onOffers(offers);
    } else if (offers.length === 0) {
      Alert.alert(t().noFlights, undefined, [{ text: t().cancel, style: 'cancel' }]);
    }
  } catch (err) {
    console.log('[Duffel] search failed — falling back to empty sheet', err);
    if (onOffers) {
      onOffers([]);
    } else {
      Alert.alert(t().noFlights, undefined, [{ text: t().cancel, style: 'cancel' }]);
    }
  }
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
