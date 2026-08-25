import { cleanBaggageBelt } from './baggageBelt';
import { isoInAirportTzToUtcMs } from './localFlightTime';

export const LOST_LUGGAGE_WAIT_MS = 30 * 60 * 1000;
export const WORLDTRACER_URL = 'https://www.worldtracer.aero/filenew/claim.exe';

const AIRLINE_FORMS: Record<string, string> = {
  TG: WORLDTRACER_URL,
  SQ: WORLDTRACER_URL,
  EK: WORLDTRACER_URL,
  QR: WORLDTRACER_URL,
  KL: WORLDTRACER_URL,
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

export function lostLuggagePhase(input: {
  status?: string;
  belt?: string;
  landedAtMs?: number | null;
  arrIso?: string;
  destIata?: string;
  destCountry?: string;
  now?: number;
}): 'hidden' | 'hint' | 'report' {
  if (String(input.status || '').toLowerCase() !== 'landed') return 'hidden';
  if (!cleanBaggageBelt(input.belt)) return 'hidden';
  const mins = minutesSinceLanding(input);
  if (mins == null) return 'hint';
  return mins >= 30 ? 'report' : 'hint';
}

export function shouldShowLostLuggage(input: Parameters<typeof lostLuggagePhase>[0]): boolean {
  return lostLuggagePhase(input) === 'report';
}
