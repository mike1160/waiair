import { isoInAirportTzToUtcMs } from './localFlightTime';

export type LandingCardPhase = 'none' | 'immediate' | 'hotel' | 'hidden';

const HOTEL_AFTER_MS = 5 * 60 * 1000;
const HIDE_AFTER_MS = 90 * 60 * 1000;

export function landingCardPhase(input: {
  status?: string;
  arrIso?: string;
  landedAtMs?: number | null;
  destIata?: string;
  destCountry?: string;
}): LandingCardPhase {
  if (String(input.status || '').toLowerCase() !== 'landed') return 'none';
  const fromIso = isoInAirportTzToUtcMs(input.arrIso, input.destIata, input.destCountry);
  const fromMs = input.landedAtMs ?? null;
  const candidates = [fromMs, fromIso].filter(
    (n): n is number => n != null && Number.isFinite(n),
  );
  const landedMs = candidates.length ? Math.min(...candidates) : null;
  if (!landedMs) return 'immediate';
  const elapsed = Date.now() - landedMs;
  if (elapsed >= HIDE_AFTER_MS) return 'hidden';
  if (elapsed >= HOTEL_AFTER_MS) return 'hotel';
  return 'immediate';
}

export function showLandingBaggage(phase: LandingCardPhase, hasBelt: boolean): boolean {
  return hasBelt && (phase === 'immediate' || phase === 'hotel');
}

export function showLandingGrab(phase: LandingCardPhase): boolean {
  return phase === 'immediate' || phase === 'hotel';
}

export function showLandingHotel(phase: LandingCardPhase): boolean {
  return phase === 'hotel';
}

export function showLandingExtraCards(_phase: LandingCardPhase): boolean {
  return false;
}
