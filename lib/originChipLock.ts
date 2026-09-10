/**
 * Origin chip: lock only after a recognised flight number has hits.
 * Unlock when the typed query is empty (back to the previous origin).
 */

export type FlightSearchOriginLock =
  | { lock: true; iata: string }
  | { lock: false };

export function originChipUnlocksOnClear(query: string): boolean {
  return !String(query || '').trim();
}

export function flightSearchOriginLock(opts: {
  query: string;
  flightNumber?: string | null;
  lookedUp: boolean;
  hitOrigin?: string | null;
  hitCount?: number;
}): FlightSearchOriginLock {
  if (originChipUnlocksOnClear(opts.query)) return { lock: false };
  if (!opts.flightNumber || !opts.lookedUp) return { lock: false };
  if ((opts.hitCount ?? 0) < 1) return { lock: false };
  const iata = String(opts.hitOrigin || '').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(iata)) return { lock: false };
  return { lock: true, iata };
}

export function originChipDisplayIata(opts: {
  locked: boolean;
  lockedIata?: string | null;
  parsedOrigin?: string | null;
  needsOrigin?: boolean;
  previousOrigin: string;
}): string {
  if (opts.locked) {
    const locked = String(opts.lockedIata || '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(locked)) return locked;
  }
  const parsed = String(opts.parsedOrigin || '').trim().toUpperCase();
  if (!opts.needsOrigin && /^[A-Z]{3}$/.test(parsed)) return parsed;
  return String(opts.previousOrigin || '').trim().toUpperCase();
}
