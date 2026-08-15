import {
  parseTimeMs,
  resolveArrivalIso,
  resolveDepartureIso,
  type FlightClockFields,
} from './flightTimes';
import { gateWalkMinutes, type WalkEstimate } from './gateWalk';

const MAX_GAP_MIN = 90;

export type RaceFlight = FlightClockFields & {
  number: string;
  origin: string;
  destination: string;
  status: string;
  gate?: string;
};

export type GateRacePair = {
  key: string;
  hub: string;
  incoming: RaceFlight;
  outgoing: RaceFlight;
  fromGate: string;
  toGate: string;
  arriveMs: number;
  departMs: number;
  walk: WalkEstimate;
};

function slug(n: string): string {
  return String(n || '').replace(/\s+/g, '').toUpperCase();
}

function sameDay(a: number, b: number): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear()
    && da.getMonth() === db.getMonth()
    && da.getDate() === db.getDate();
}

function gateCode(g?: string): string {
  const raw = String(g || '').replace(/^gates?\s*:?\s*/i, '').trim();
  if (!raw || /^(—|-|–|n\/?a|tba|tbd)$/i.test(raw)) return '';
  return raw.toUpperCase();
}

export function findGateRacePair(flights: RaceFlight[]): GateRacePair | null {
  let best: GateRacePair | null = null;
  for (let i = 0; i < flights.length; i++) {
    for (let j = 0; j < flights.length; j++) {
      if (i === j) continue;
      const inn = flights[i];
      const out = flights[j];
      if (inn.status === 'cancelled' || out.status === 'cancelled') continue;
      if (out.status === 'en-route' || out.status === 'landed') continue;
      const hub = String(inn.destination || '').toUpperCase();
      if (!hub || hub !== String(out.origin || '').toUpperCase()) continue;
      const arriveMs = parseTimeMs(resolveArrivalIso(inn)) ?? 0;
      const departMs = parseTimeMs(resolveDepartureIso(out)) ?? 0;
      if (!arriveMs || !departMs || !sameDay(arriveMs, departMs)) continue;
      const gapMin = (departMs - arriveMs) / 60000;
      if (!Number.isFinite(gapMin) || gapMin < 0 || gapMin >= MAX_GAP_MIN) continue;
      const fromGate = gateCode(inn.gate);
      const toGate = gateCode(out.gate);
      const pair: GateRacePair = {
        key: `${slug(inn.number)}>${slug(out.number)}|${hub}`,
        hub,
        incoming: inn,
        outgoing: out,
        fromGate: fromGate || 'TBA',
        toGate: toGate || 'TBA',
        arriveMs,
        departMs,
        walk: gateWalkMinutes(hub, fromGate, toGate),
      };
      if (!best || gapMin < (best.departMs - best.arriveMs) / 60000) best = pair;
    }
  }
  return best;
}

export function isIncomingLanded(pair: GateRacePair, now = Date.now()): boolean {
  if (pair.incoming.status === 'landed') return true;
  if (pair.incoming.status === 'en-route' && now >= pair.arriveMs) return true;
  return false;
}
