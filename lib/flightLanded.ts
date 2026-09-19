/**
 * Has this flight landed? Only the flight's own data decides — never the board tab the page happens to be on.
 * Lives here (not in boardingCountdown.ts, which re-exports it) so the rule is unit-tested.
 */
import { isoInAirportTzToUtcMs } from './localFlightTime.ts';

export type LandedFields = {
  status?: string;
  /** The arrival board's own column: the arrival time of this flight. */
  actualTime?: string;
  actualArrival?: string;
  boardSide?: 'arrival' | 'departure' | 'both';
  destination?: string;
  destCountry?: string;
};

/**
 * Whether `actualTime` on this row is the arrival. Only an arrival board says so: a departure board holds the
 * departure there, and a flight-number row ('both') holds the departure until the flight has actually arrived.
 * Reading it as an arrival made every departed flight look landed on the flight page.
 */
export function actualTimeIsArrival(boardSide?: string | null): boolean {
  return boardSide === 'arrival';
}

export function flightHasLanded(f: LandedFields, now = Date.now()): boolean {
  if (String(f.status || '') === 'landed') return true;
  if (String(f.actualArrival || '').trim()) {
    const ms = isoInAirportTzToUtcMs(f.actualArrival, f.destination, f.destCountry);
    return ms == null || now >= ms;
  }
  if (actualTimeIsArrival(f.boardSide) && String(f.actualTime || '').trim()) {
    const ms = isoInAirportTzToUtcMs(f.actualTime, f.destination, f.destCountry);
    return ms == null || now >= ms;
  }
  return false;
}
