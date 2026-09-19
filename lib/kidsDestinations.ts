/**
 * The three big emoji buttons on the kids-mode home screen: a beach, a city and an adventure, picked for
 * where the family flies from. Pure, so the picks are unit-tested.
 */

export type KidsDestinationKind = 'beach' | 'city' | 'adventure';

export const KIDS_DESTINATION_EMOJI: Record<KidsDestinationKind, string> = {
  beach: '🏖️',
  city: '🏙️',
  adventure: '🗻',
};

const PICKS: Record<string, Record<KidsDestinationKind, string>> = {
  // Thailand: Phuket, Singapore, Chiang Mai.
  TH: { beach: 'HKT', city: 'SIN', adventure: 'CNX' },
  // Japan and Korea: Okinawa / Cebu, then a big city and the mountains or the north.
  JP: { beach: 'OKA', city: 'SIN', adventure: 'CTS' },
  KR: { beach: 'CEB', city: 'NRT', adventure: 'CTS' },
  SG: { beach: 'HKT', city: 'HKG', adventure: 'CNX' },
};

const ASIA = new Set(['TH', 'SG', 'MY', 'VN', 'KH', 'LA', 'MM', 'ID', 'PH', 'HK', 'TW', 'CN', 'IN']);
const ASIA_PICKS: Record<KidsDestinationKind, string> = { beach: 'HKT', city: 'SIN', adventure: 'CNX' };
// Europe and everywhere else: Mallorca, Paris, Iceland.
const DEFAULT_PICKS: Record<KidsDestinationKind, string> = { beach: 'PMI', city: 'CDG', adventure: 'KEF' };

export function kidsDestinations(homeCountry?: string | null): Record<KidsDestinationKind, string> {
  const cc = String(homeCountry || '').toUpperCase();
  return PICKS[cc] ?? (ASIA.has(cc) ? ASIA_PICKS : DEFAULT_PICKS);
}
