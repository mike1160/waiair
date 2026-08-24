import { isoInAirportTzToUtcMs } from './localFlightTime';

/** Baggage belt polling after landing (AeroDataBox arrival.baggageBelt). */
export const BAGGAGE_POLL_MS = 2 * 60 * 1000;
/** Keep polling up to 8h after landing — long delays can push belt assignment late. */
export const BAGGAGE_POLL_MAX_MS = 8 * 60 * 60 * 1000;

export function cleanBaggageBelt(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s || /^(—|-|–|n\/?a|tba|tbd|unknown|null|undefined)$/i.test(s)) return '';
  return s.replace(/^belt\s*/i, '').trim();
}

function normalizeAdbTime(iso: string): string {
  return String(iso || '').trim().replace(' ', 'T');
}

export function trackLandedAtMs(
  t: {
    landedAtMs?: number;
    flight?: {
      actualArrival?: string;
      actualTime?: string;
      arrivalTime?: string;
      status?: string;
      baggage?: string;
      destination?: string;
      destCountry?: string;
    };
  },
): number {
  if (t.landedAtMs && t.landedAtMs > 0) return t.landedAtMs;
  const iso =
    t.flight?.actualArrival ||
    t.flight?.actualTime ||
    t.flight?.arrivalTime ||
    '';
  if (iso) {
    const ms = isoInAirportTzToUtcMs(iso, t.flight?.destination, t.flight?.destCountry)
      ?? new Date(normalizeAdbTime(iso)).getTime();
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

export function needsBaggagePoll(
  t: {
    lastStatus?: string;
    flight?: { status?: string; baggage?: string };
    lastBaggage?: string;
    notifiedBaggageClaim?: boolean;
    landedAtMs?: number;
  },
  now = Date.now(),
): boolean {
  const landed = t.lastStatus === 'landed' || t.flight?.status === 'landed';
  if (!landed) return false;
  if (t.notifiedBaggageClaim) return false;
  const belt = cleanBaggageBelt(t.lastBaggage || t.flight?.baggage);
  if (belt) return false;
  const landedAt = trackLandedAtMs(t);
  if (landedAt > 0 && now - landedAt > BAGGAGE_POLL_MAX_MS) return false;
  return true;
}
