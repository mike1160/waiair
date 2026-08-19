import { normalizeAirlineCode } from '../AirlineLogo';
import { formatInTimeZone } from 'date-fns-tz';
import { timezoneForIata } from './airportTz';
import { isoInAirportTzToUtcMs } from './localFlightTime';

export type DelayOutlook = {
  airline: string;
  onTimePercent: number;
  avgDelayWhenLate: number;
  source: 'historical' | 'airline';
};

const AIRLINE_ON_TIME: Record<string, { name: string; pct: number; lateAvg: number }> = {
  TG: { name: 'Thai Airways', pct: 82, lateAvg: 14 },
  FD: { name: 'Thai AirAsia', pct: 71, lateAvg: 18 },
  AK: { name: 'AirAsia', pct: 71, lateAvg: 18 },
  QZ: { name: 'Indonesia AirAsia', pct: 71, lateAvg: 18 },
  D7: { name: 'AirAsia X', pct: 70, lateAvg: 22 },
  PG: { name: 'Bangkok Airways', pct: 88, lateAvg: 11 },
  VJ: { name: 'VietJet Air', pct: 68, lateAvg: 22 },
  VN: { name: 'Vietnam Airlines', pct: 76, lateAvg: 16 },
  MH: { name: 'Malaysia Airlines', pct: 79, lateAvg: 15 },
  SQ: { name: 'Singapore Airlines', pct: 86, lateAvg: 12 },
  GA: { name: 'Garuda Indonesia', pct: 77, lateAvg: 16 },
  PR: { name: 'Philippine Airlines', pct: 74, lateAvg: 18 },
  '5J': { name: 'Cebu Pacific', pct: 69, lateAvg: 21 },
  CX: { name: 'Cathay Pacific', pct: 83, lateAvg: 13 },
  EK: { name: 'Emirates', pct: 80, lateAvg: 15 },
  QR: { name: 'Qatar Airways', pct: 84, lateAvg: 12 },
  KL: { name: 'KLM', pct: 78, lateAvg: 16 },
  LH: { name: 'Lufthansa', pct: 76, lateAvg: 17 },
  BA: { name: 'British Airways', pct: 75, lateAvg: 18 },
};

/** Canonical display names keyed by IATA — used in reliability popup. */
export const AIRLINE_IATA_NAMES: Record<string, string> = {
  TG: 'Thai Airways',
  FD: 'Thai AirAsia',
  AK: 'AirAsia',
  QZ: 'Indonesia AirAsia',
  D7: 'AirAsia X',
  PG: 'Bangkok Airways',
  VJ: 'VietJet Air',
  VN: 'Vietnam Airlines',
  MH: 'Malaysia Airlines',
  SQ: 'Singapore Airlines',
  GA: 'Garuda Indonesia',
  PR: 'Philippine Airlines',
  '5J': 'Cebu Pacific',
  CX: 'Cathay Pacific',
  EK: 'Emirates',
  QR: 'Qatar Airways',
  KL: 'KLM',
  LH: 'Lufthansa',
  BA: 'British Airways',
  AF: 'Air France',
};

function airlineCode(raw?: string): string {
  return normalizeAirlineCode(raw).slice(0, 3);
}

export function airlineReliabilityDisplayName(code?: string): string | null {
  const iata = airlineCode(code);
  if (!iata) return null;
  return AIRLINE_IATA_NAMES[iata] ?? AIRLINE_ON_TIME[iata]?.name ?? null;
}

export function airlineOutlook(code?: string, name?: string): DelayOutlook | null {
  const iata = airlineCode(code);
  const hit = AIRLINE_ON_TIME[iata];
  if (hit) {
    return {
      airline: airlineReliabilityDisplayName(code) || hit.name,
      onTimePercent: hit.pct,
      avgDelayWhenLate: hit.lateAvg,
      source: 'airline',
    };
  }
  if (!iata) return null;
  return {
    airline: name || iata,
    onTimePercent: 75,
    avgDelayWhenLate: 16,
    source: 'airline',
  };
}

/** Historical on-time % from static table — null if airline unknown (no badge on list). */
export function airlineHistoricalOnTime(code?: string): number | null {
  const iata = airlineCode(code);
  return AIRLINE_ON_TIME[iata]?.pct ?? null;
}

export function airlineReliabilityDotColor(code?: string): string | null {
  const pct = airlineHistoricalOnTime(code);
  if (pct == null) return null;
  if (pct >= 80) return '#2E7D32';
  if (pct >= 60) return '#E65100';
  return '#C62828';
}

export type AirlineReliabilitySnapshot = {
  iata: string;
  name: string;
  onTimePercent: number;
  avgDelayWhenLate: number;
};

/** Static reliability row for list badge popup — null when unknown. */
export function airlineReliabilitySnapshot(code?: string): AirlineReliabilitySnapshot | null {
  const iata = airlineCode(code);
  const hit = AIRLINE_ON_TIME[iata];
  if (!hit) return null;
  return {
    iata,
    name: airlineReliabilityDisplayName(code) || hit.name,
    onTimePercent: hit.pct,
    avgDelayWhenLate: hit.lateAvg,
  };
}

export function weekdayPart(iso?: string, iata?: string, country?: string): { weekday: string; part: string } {
  const tz = timezoneForIata(iata, country);
  const ms = isoInAirportTzToUtcMs(iso, iata, country) ?? (iso ? Date.parse(String(iso).replace(' ', 'T')) : Date.now());
  const d = Number.isFinite(ms) ? new Date(ms) : new Date();
  let weekday = 'today';
  let h = 12;
  try {
    weekday = formatInTimeZone(d, tz, 'EEEE');
    h = Number(formatInTimeZone(d, tz, 'H'));
  } catch {
    weekday = d.toLocaleDateString('en-GB', { weekday: 'long', timeZone: tz });
    h = Number(formatInTimeZone(d, tz, 'H')) || d.getUTCHours();
  }
  if (!Number.isFinite(h)) h = 12;
  const part = h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
  return { weekday, part };
}
