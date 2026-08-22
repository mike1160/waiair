import { cleanBaggageBelt } from './baggageBelt';
import { isoInAirportTzToUtcMs } from './localFlightTime';

export const LOST_LUGGAGE_WAIT_MS = 30 * 60 * 1000;
export const WORLDTRACER_URL = 'https://www.worldtracer.aero';

const AIRLINE_FORMS: Record<string, string> = {
  TG: 'https://www.thaiairways.com/baggage',
  SQ: 'https://www.singaporeair.com/baggage',
  EK: 'https://www.emirates.com/baggage',
  QR: 'https://www.qatarairways.com/baggage',
  KL: 'https://www.klm.com/baggage',
};

export function lostLuggageUrl(airlineCode?: string): string {
  const iata = String(airlineCode || '').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 2);
  return AIRLINE_FORMS[iata] || WORLDTRACER_URL;
}

export function minutesSinceLanding(input: {
  landedAtMs?: number | null;
  arrIso?: string;
  destIata?: string;
  destCountry?: string;
  now?: number;
}): number | null {
  const fromIso = isoInAirportTzToUtcMs(input.arrIso, input.destIata, input.destCountry);
  const fromMs = input.landedAtMs ?? null;
  const candidates = [fromMs, fromIso].filter(
    (n): n is number => n != null && Number.isFinite(n),
  );
  if (!candidates.length) return null;
  const landedMs = Math.min(...candidates);
  return Math.max(0, Math.floor(((input.now ?? Date.now()) - landedMs) / 60000));
}

export function shouldShowLostLuggage(input: {
  status?: string;
  belt?: string;
  landedAtMs?: number | null;
  arrIso?: string;
  destIata?: string;
  destCountry?: string;
  now?: number;
}): boolean {
  if (String(input.status || '').toLowerCase() !== 'landed') return false;
  if (!cleanBaggageBelt(input.belt)) return false;
  const mins = minutesSinceLanding(input);
  return mins != null && mins >= 30;
}
