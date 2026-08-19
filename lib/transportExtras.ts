import { Linking } from 'react-native';
import { TRANSPORT_INFO } from './transportBooking';

export const FERRY_AIRPORTS = new Set(['HKT', 'KBV', 'USM', 'HKG', 'MFM', 'DPS']);
export const TUK_TUK_AIRPORTS = new Set(['BKK', 'DMK', 'CNX', 'HKT', 'PNH', 'REP', 'DAD']);
export const SIM_AIRPORTS = new Set(['BKK', 'DMK', 'HKT', 'CNX', 'USM', 'KBV']);

const AIRPORT_FALLBACK: Record<string, { name: string; city: string }> = {
  KBV: { name: 'Krabi Airport', city: 'Krabi' },
  USM: { name: 'Samui Airport', city: 'Koh Samui' },
  MFM: { name: 'Macau Airport', city: 'Macau' },
  PNH: { name: 'Phnom Penh Airport', city: 'Phnom Penh' },
  REP: { name: 'Siem Reap Airport', city: 'Siem Reap' },
  DAD: { name: 'Da Nang Airport', city: 'Da Nang' },
};

export function hasTransportExtras(destIata?: string): boolean {
  const code = String(destIata || '').trim().toUpperCase();
  return FERRY_AIRPORTS.has(code) || TUK_TUK_AIRPORTS.has(code) || SIM_AIRPORTS.has(code);
}

export function getAirportLabel(destIata?: string): { name: string; city: string } {
  const code = String(destIata || '').trim().toUpperCase();
  const info = TRANSPORT_INFO[code];
  if (info) return { name: info.name, city: info.city };
  return AIRPORT_FALLBACK[code] ?? { name: `${code} Airport`, city: code };
}

export function ferryUrl(destIata: string, city: string): string {
  const code = destIata.trim().toUpperCase();
  if (code === 'HKT') {
    return 'https://www.google.com/search?q=Rassada+Pier+ferry+Phuket';
  }
  if (code === 'HKG') {
    return 'https://www.turbojet.com.hk';
  }
  return `https://www.google.com/search?q=${encodeURIComponent(`${city} ferry terminal`)}`;
}

export function tukTukUrl(airportName: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`tuk tuk near ${airportName}`)}`;
}

export const SIM_CARD_URL = 'https://www.ais.th/traveler/';

export async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch { /* ignore */ }
}
