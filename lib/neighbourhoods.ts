/**
 * The neighbourhoods offered per arrival airport ("Restaurants & wijken" on the flight detail page).
 * A curated list, not a lookup: these are the areas a traveller actually eats in, in the order we'd suggest them.
 * A city we have no list for falls back to one "Explore {city}" chip that opens Google Maps.
 */

/** Neighbourhoods per arrival IATA. Airports serving the same city share the list. */
const NEIGHBOURHOODS: Record<string, string[]> = {
  BKK: ['Sukhumvit', 'Silom', 'Chinatown', 'Khao San Road', 'Ari', 'Thonglor'],
  DXB: ['Downtown', 'Marina', 'Deira', 'JBR', 'Business Bay', 'Old Dubai'],
  AMS: ['Jordaan', 'De Pijp', 'Centrum', 'Oud-Zuid', 'NDSM', 'Westerpark'],
  SIN: ['Clarke Quay', 'Chinatown', 'Little India', 'Orchard', 'Tiong Bahru'],
  NRT: ['Shinjuku', 'Shibuya', 'Ginza', 'Asakusa', 'Shimokitazawa', 'Nakameguro'],
  HND: ['Shinjuku', 'Shibuya', 'Ginza', 'Asakusa', 'Shimokitazawa', 'Nakameguro'],
  LHR: ['Soho', 'Shoreditch', 'Notting Hill', 'Borough Market', 'Mayfair', 'Camden'],
  LGW: ['Soho', 'Shoreditch', 'Notting Hill', 'Borough Market', 'Mayfair', 'Camden'],
  CDG: ['Le Marais', 'Montmartre', 'Saint-Germain', 'Oberkampf', 'Bastille', 'Canal Saint-Martin'],
  HKT: ['Patong', 'Old Town', 'Kata', 'Karon', 'Rawai', 'Kamala'],
  // "Nimmanhaemin" is the full name of Nimman, so it is one chip, not two.
  CNX: ['Nimman', 'Old City', 'Santitham', 'Night Bazaar'],
  KUL: ['KLCC', 'Bukit Bintang', 'Bangsar', 'Chow Kit', 'Petaling Street', 'Mont Kiara'],
};

/** The city name Google gets next to the neighbourhood; the airport's own city is only a fallback. */
const CITY_NAMES: Record<string, string> = {
  BKK: 'Bangkok',
  DXB: 'Dubai',
  AMS: 'Amsterdam',
  SIN: 'Singapore',
  NRT: 'Tokyo',
  HND: 'Tokyo',
  LHR: 'London',
  LGW: 'London',
  CDG: 'Paris',
  HKT: 'Phuket',
  CNX: 'Chiang Mai',
  KUL: 'Kuala Lumpur',
};

function clean(raw?: string | null): string {
  return String(raw || '').trim().replace(/\s+/g, ' ');
}

function iataKey(raw?: string | null): string {
  const s = clean(raw).toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : '';
}

/** The city label for the section, from the curated name or the airport's own city. */
export function neighbourhoodCity(iata?: string | null, fallbackCity?: string | null): string {
  return CITY_NAMES[iataKey(iata)] || clean(fallbackCity);
}

export type NeighbourhoodChip =
  /** A curated area: tapping it loads restaurants in the app. */
  | { kind: 'area'; label: string; area: string; city: string }
  /** Unknown city: tapping it opens a Google Maps restaurant search. */
  | { kind: 'explore'; label: string; city: string; url: string };

/** Google Maps restaurant search for a city — the fallback when we have no neighbourhoods for it. */
export function exploreMapsUrl(city: string): string {
  const q = clean(city);
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`restaurants in ${q}`)}`;
}

/**
 * The chips for an arrival airport: the curated neighbourhoods, or a single "Explore {city}" chip.
 * Empty when we know neither a list nor a city name — then the whole section stays hidden.
 */
export function neighbourhoodChips(
  iata?: string | null,
  fallbackCity?: string | null,
  exploreLabel: (city: string) => string = (city) => `Explore ${city}`,
): NeighbourhoodChip[] {
  const city = neighbourhoodCity(iata, fallbackCity);
  const areas = NEIGHBOURHOODS[iataKey(iata)];
  if (areas && areas.length && city) {
    return areas.map(area => ({ kind: 'area' as const, label: area, area, city }));
  }
  if (!city) return [];
  return [{ kind: 'explore' as const, label: exploreLabel(city), city, url: exploreMapsUrl(city) }];
}

/** Whether this airport has a curated list (as opposed to the Explore fallback). */
export function hasNeighbourhoods(iata?: string | null): boolean {
  return !!NEIGHBOURHOODS[iataKey(iata)];
}
