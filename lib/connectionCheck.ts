/**
 * Same-day connection check for tracked flights.
 * Same airport + same terminal: 30 min MCT.
 * Same airport + different terminal: 60 min MCT.
 * Different airport: cannot connect.
 */

import { resolveArrivalIso, resolveDepartureIso } from './flightTimes.ts';
import { isoInAirportTzToUtcMs, toLocalDateString } from './localFlightTime.ts';

export const MCT_SAME_TERMINAL_MIN = 30;
export const MCT_DIFFERENT_TERMINAL_MIN = 60;

export type ConnectionFlightLike = {
  number: string;
  status?: string;
  delay?: number;
  origin?: string;
  destination?: string;
  originCountry?: string;
  destCountry?: string;
  terminal?: string;
  depTerminal?: string;
  arrTerminal?: string;
  scheduledTime?: string;
  revisedTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
};

export type ConnectionTone = 'green' | 'orange' | 'red';

export type ConnectionCheck = {
  incoming: ConnectionFlightLike;
  outgoing: ConnectionFlightLike;
  hub: string;
  gapMin: number;
  mctMin: number;
  tone: ConnectionTone;
  reason: 'safe' | 'risk' | 'missed' | 'cannot_connect';
  sameAirport: boolean;
  sameTerminal: boolean | null;
};

function iata(code?: string): string {
  return String(code || '').trim().toUpperCase();
}

function terminalOf(value?: string): string {
  return String(value || '').trim().toUpperCase();
}

function clockMs(iso: string, airport?: string, country?: string): number {
  const ms = isoInAirportTzToUtcMs(iso, airport, country);
  return ms != null && Number.isFinite(ms) ? ms : 0;
}

function arrivalMs(f: ConnectionFlightLike): number {
  return clockMs(resolveArrivalIso(f), f.destination, f.destCountry);
}

function departureMs(f: ConnectionFlightLike): number {
  return clockMs(resolveDepartureIso(f), f.origin, f.originCountry);
}

function arrivalYmd(f: ConnectionFlightLike): string {
  const ms = arrivalMs(f);
  if (!ms) return '';
  return toLocalDateString(new Date(ms));
}

function departureYmd(f: ConnectionFlightLike): string {
  const ms = departureMs(f);
  if (!ms) return '';
  return toLocalDateString(new Date(ms));
}

export function formatGapLabel(min: number): string {
  const abs = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h <= 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function inboundTerminal(f: ConnectionFlightLike): string {
  return terminalOf(f.arrTerminal || f.terminal);
}

export function outboundTerminal(f: ConnectionFlightLike): string {
  return terminalOf(f.depTerminal || f.terminal);
}

export function evaluateConnection(
  incoming: ConnectionFlightLike,
  outgoing: ConnectionFlightLike,
  now = Date.now(),
): ConnectionCheck {
  const hubIn = iata(incoming.destination);
  const hubOut = iata(outgoing.origin);
  const sameAirport = !!hubIn && hubIn === hubOut;
  const inTerm = inboundTerminal(incoming);
  const outTerm = outboundTerminal(outgoing);
  const sameTerminal = sameAirport && !!inTerm && !!outTerm ? inTerm === outTerm : null;
  const mctMin = !sameAirport
    ? Infinity
    : sameTerminal === false
      ? MCT_DIFFERENT_TERMINAL_MIN
      : MCT_SAME_TERMINAL_MIN;

  const arrive = arrivalMs(incoming);
  const depart = departureMs(outgoing);
  const innLanded = incoming.status === 'landed' || incoming.status === 'en-route';
  const liveArrive = innLanded && now > arrive ? now : arrive;
  const gapMin = arrive && depart ? (depart - liveArrive) / 60000 : NaN;

  if (!sameAirport) {
    return {
      incoming, outgoing, hub: hubIn || hubOut, gapMin: Number.isFinite(gapMin) ? gapMin : 0,
      mctMin: 0, tone: 'red', reason: 'cannot_connect', sameAirport: false, sameTerminal: null,
    };
  }
  if (Number.isFinite(gapMin) && gapMin < 0) {
    return {
      incoming, outgoing, hub: hubIn, gapMin, mctMin, tone: 'red', reason: 'missed',
      sameAirport: true, sameTerminal,
    };
  }
  if (Number.isFinite(gapMin) && gapMin < mctMin) {
    return {
      incoming, outgoing, hub: hubIn, gapMin, mctMin, tone: 'orange', reason: 'risk',
      sameAirport: true, sameTerminal,
    };
  }
  return {
    incoming, outgoing, hub: hubIn, gapMin: Number.isFinite(gapMin) ? gapMin : 0,
    mctMin, tone: 'green', reason: 'safe', sameAirport: true, sameTerminal,
  };
}

export function findSameDayConnections(
  flights: ConnectionFlightLike[],
  now = Date.now(),
): ConnectionCheck[] {
  const sorted = [...flights].sort((a, b) => (departureMs(a) || arrivalMs(a)) - (departureMs(b) || arrivalMs(b)));
  const out: ConnectionCheck[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < sorted.length; i += 1) {
    const inn = sorted[i];
    for (let j = i + 1; j < sorted.length; j += 1) {
      const dep = sorted[j];
      const dayA = arrivalYmd(inn);
      const dayB = departureYmd(dep);
      if (!dayA || !dayB || dayA !== dayB) continue;
      const key = `${String(inn.number)}>${String(dep.number)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(evaluateConnection(inn, dep, now));
      break;
    }
  }
  return out;
}

export function bannerCopy(c: ConnectionCheck): { tone: ConnectionTone; text: string } {
  const gap = formatGapLabel(c.gapMin);
  if (c.reason === 'cannot_connect') {
    return { tone: 'red', text: 'Cannot connect — flights are at different airports' };
  }
  if (c.reason === 'missed') {
    return { tone: 'red', text: 'Connection missed' };
  }
  if (c.reason === 'risk') {
    return { tone: 'orange', text: `Connection at risk — only ${gap}` };
  }
  return { tone: 'green', text: `Connection safe — ${gap} between flights` };
}
