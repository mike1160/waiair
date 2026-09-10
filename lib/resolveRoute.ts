/** Origin/destination for FIDS rows and tracked flights.

 * Never invert a known route when the local airport is only one end
 * (pickup at the destination, or a tracked departure on the Arrivals tab).
 * Incomplete FIDS rows still get the missing local end from the board type.
 */
import { usableAirportCode } from './airportCode.ts';
import {
  formatAirportClock,
  resolveArrivalIso,
  resolveDepartureIso,
  type FlightClockFields,
} from './flightTimes.ts';

export type RouteBoardType = 'arrival' | 'departure';

export type RouteFlightFields = FlightClockFields & {
  origin?: string;
  destination?: string;
};

export function resolveRouteEnds(
  f: Pick<RouteFlightFields, 'origin' | 'destination'>,
  type: RouteBoardType,
  localIata: string,
): { origin: string; dest: string } {
  const local = usableAirportCode(localIata);
  const a = usableAirportCode(f.origin);
  const b = usableAirportCode(f.destination);
  const remoteOf = (x: string, y: string) => [x, y].find(c => !!c && c !== local) || '';

  let origin = '';
  let dest = '';

  if (a && b && a !== b) {
    origin = a;
    dest = b;
  } else if (type === 'arrival') {
    dest = local;
    origin = remoteOf(a, b);
  } else {
    origin = local;
    dest = remoteOf(a, b);
  }

  if (origin && dest && origin === dest) {
    if (type === 'arrival') origin = '';
    else dest = '';
  }

  return { origin, dest };
}

/** Same TZ wiring as the FIDS row: dep clock at resolved origin, arr at dest. */
export function routeDisplayClocks(
  f: RouteFlightFields,
  type: RouteBoardType,
  localIata: string,
): {
  origin: string;
  destination: string;
  depIso: string;
  arrIso: string;
  depClock: string;
  arrClock: string;
} {
  const { origin, dest } = resolveRouteEnds(f, type, localIata);
  const depIso = resolveDepartureIso(f);
  const arrIso = resolveArrivalIso(f);
  return {
    origin,
    destination: dest,
    depIso,
    arrIso,
    depClock: formatAirportClock(depIso, origin, false, f.originCountry),
    arrClock: formatAirportClock(arrIso, dest, false, f.destCountry),
  };
}
