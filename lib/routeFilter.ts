/** Route search (AMS → BKK): only flights that depart the searched origin and arrive at the searched destination. */
import { usableAirportCode } from './airportCode.ts';

export type RouteFilterFlight = {
  origin?: string;
  destination?: string;
};

/**
 * True when the flight flies `from` → `to`. The reverse direction (BKK → AMS), other legs and rows
 * with a missing end are rejected. Board side is not used: an AMS → BKK row can come from either board.
 */
export function matchesRouteDirection(f: RouteFilterFlight, from: string, to: string): boolean {
  const origin = usableAirportCode(from);
  const dest = usableAirportCode(to);
  if (!origin || !dest || origin === dest) return false;
  return usableAirportCode(f.origin) === origin && usableAirportCode(f.destination) === dest;
}

export function filterRouteFlights<T extends RouteFilterFlight>(flights: readonly T[], from: string, to: string): T[] {
  return flights.filter(f => matchesRouteDirection(f, from, to));
}
