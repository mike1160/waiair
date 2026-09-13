/** Destination tip inside AfterLandingCard once a tracked flight lands (Klook hubs, Tiqets elsewhere). */

export type DiscoveryProvider = 'klook' | 'tiqets';

export const DISCOVERY_COPY_KEYS = [
  'Bangkok',
  'Phuket',
  'ChiangMai',
  'KotaKinabalu',
  'Singapore',
  'KualaLumpur',
  'Bali',
  'Tokyo',
  'Seoul',
  'Paris',
  'Fallback',
] as const;

export type DiscoveryCopyKey = (typeof DISCOVERY_COPY_KEYS)[number];

export type LandingDiscovery = {
  provider: DiscoveryProvider;
  copy: DiscoveryCopyKey;
};

const KLOOK_BY_IATA: Record<string, DiscoveryCopyKey> = {
  BKK: 'Bangkok',
  DMK: 'Bangkok',
  HKT: 'Phuket',
  CNX: 'ChiangMai',
  BKI: 'KotaKinabalu',
  SIN: 'Singapore',
  KUL: 'KualaLumpur',
  DPS: 'Bali',
  NRT: 'Tokyo',
  HND: 'Tokyo',
  ICN: 'Seoul',
  CDG: 'Paris',
  ORY: 'Paris',
};

/** Card appears this long after the landing card opens; slide-up duration below. */
export const DISCOVERY_REVEAL_DELAY_MS = 3000;
export const DISCOVERY_REVEAL_MS = 300;

export const DISCOVERY_STORAGE_KEY = 'shown_discovery_cards';
const SHOWN_MAX = 200;

export function landingDiscovery(destIata?: string): LandingDiscovery {
  const copy = KLOOK_BY_IATA[String(destIata || '').trim().toUpperCase()];
  return copy ? { provider: 'klook', copy } : { provider: 'tiqets', copy: 'Fallback' };
}

export function parseShownDiscoveryIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string' && !!v) : [];
  } catch {
    return [];
  }
}

/** Newest last, no duplicates, capped so storage never grows unbounded. */
export function withShownDiscoveryId(list: string[], id: string): string[] {
  if (!id || list.includes(id)) return list;
  return [...list, id].slice(-SHOWN_MAX);
}

/** Landed push (foreground + background): city-specific with a nudge to explore. */
export function landingPushCopy(
  copy: {
    landed: string;
    landedDotNum: (num: string) => string;
    landedInPush: (city: string) => string;
    landedThingsNearby: string;
  },
  city: string,
  flightNumber: string,
): { title: string; body: string } {
  const place = String(city || '').trim();
  if (!place) return { title: copy.landed, body: copy.landedDotNum(flightNumber) };
  return { title: copy.landedInPush(place), body: copy.landedThingsNearby };
}
