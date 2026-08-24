import { resolveArrivalIso, resolveDepartureIso, formatAirportClock } from './flightTimes';
import { isoInAirportTzToUtcMs } from './localFlightTime';

export type ConnectionFlight = {
  number: string;
  status?: string;
  delay?: number;
  gate?: string;
  airlineCode?: string;
  origin?: string;
  destination?: string;
  originCountry?: string;
  destCountry?: string;
  scheduledTime?: string;
  revisedTime?: string;
  departureTime?: string;
  arrivalTime?: string;
};

export type TightConnectionLike = {
  key: string;
  incoming: ConnectionFlight;
  outgoing: ConnectionFlight;
  hub: string;
  gapMin: number;
};

function clockMs(iso: string, iata?: string, country?: string): number {
  const ms = isoInAirportTzToUtcMs(iso, iata, country);
  return ms != null && Number.isFinite(ms) ? ms : 0;
}

export function layoverRemainMin(c: TightConnectionLike, now = Date.now()): number {
  const arriveMs = clockMs(resolveArrivalIso(c.incoming), c.incoming.destination, c.incoming.destCountry);
  const departMs = clockMs(resolveDepartureIso(c.outgoing), c.outgoing.origin, c.outgoing.originCountry);
  if (!arriveMs || !departMs) return Math.max(0, c.gapMin);
  const landed =
    c.incoming.status === 'landed'
    || (now >= arriveMs && c.incoming.status === 'en-route');
  const base = landed ? now : arriveMs;
  return Math.max(0, (departMs - base) / 60000);
}

export function inboundDelayMin(c: TightConnectionLike): number {
  const d = c.incoming.delay;
  return typeof d === 'number' && d > 0 ? d : 0;
}

/** At risk when layover < 45 min or inbound is delayed. */
export function isConnectionAtRisk(c: TightConnectionLike, now = Date.now()): boolean {
  if (inboundDelayMin(c) > 0) return true;
  return layoverRemainMin(c, now) < 45;
}

export function filterAtRiskConnections<T extends TightConnectionLike>(
  connections: T[],
  now = Date.now(),
): T[] {
  return connections.filter(c => isConnectionAtRisk(c, now));
}

export function outgoingDepartureClock(
  c: TightConnectionLike,
  hour12: boolean,
): string {
  const iso = resolveDepartureIso(c.outgoing);
  return formatAirportClock(iso, c.outgoing.origin, hour12, c.outgoing.originCountry);
}
