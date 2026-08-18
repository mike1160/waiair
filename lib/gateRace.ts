import { Platform } from 'react-native';
import {
  parseTimeMs,
  resolveArrivalIso,
  resolveDepartureIso,
  type FlightClockFields,
} from './flightTimes';
import {
  connectionMissed,
  connectionWalkMinutes,
  walkBuffered,
  type WalkEstimate,
} from './gateWalk';
import { airportRecByIata } from './airportsDb';
import { t } from './i18n';

const MAX_GAP_MIN = 180;

export type RaceFlight = FlightClockFields & {
  number: string;
  origin: string;
  destination: string;
  status: string;
  gate?: string;
  terminal?: string;
  arrTerminal?: string;
  depTerminal?: string;
  delay?: number;
};

export type GateRacePair = {
  key: string;
  hub: string;
  incoming: RaceFlight;
  outgoing: RaceFlight;
  fromGate: string;
  toGate: string;
  fromTerminal: string;
  toTerminal: string;
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
  return da.getUTCFullYear() === db.getUTCFullYear()
    && da.getUTCMonth() === db.getUTCMonth()
    && da.getUTCDate() === db.getUTCDate();
}

function resolveIata(raw?: string): string {
  const direct = iataCode(raw);
  if (direct) return direct;
  const rec = airportRecByIata(String(raw || '').trim());
  return rec?.iata || '';
}

function gateCode(g?: string): string {
  const raw = String(g || '').replace(/^gates?\s*:?\s*/i, '').trim();
  if (!raw || /^(—|-|–|n\/?a|tba|tbd)$/i.test(raw)) return '';
  return raw.toUpperCase();
}

function termFor(f: RaceFlight, side: 'arrival' | 'departure'): string {
  if (side === 'arrival') return (f.arrTerminal || f.terminal || '').trim();
  return (f.depTerminal || f.terminal || '').trim();
}

function iataCode(raw?: string): string {
  const s = String(raw || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(s) ? s : '';
}

function buildPair(inn: RaceFlight, out: RaceFlight): GateRacePair | null {
  if (inn.status === 'cancelled' || out.status === 'cancelled') return null;
  if (out.status === 'en-route' || out.status === 'landed') return null;
  const arriveIata = resolveIata(inn.destination);
  const departIata = resolveIata(out.origin);
  if (!arriveIata || !departIata || arriveIata !== departIata) return null;
  const hub = arriveIata;
  const arriveMs = parseTimeMs(resolveArrivalIso(inn)) ?? 0;
  const departMs = parseTimeMs(resolveDepartureIso(out)) ?? 0;
  if (!arriveMs || !departMs || !sameDay(arriveMs, departMs)) return null;
  const gapMin = (departMs - arriveMs) / 60000;
  if (!Number.isFinite(gapMin) || gapMin < 0 || gapMin >= MAX_GAP_MIN) return null;
  const fromGate = gateCode(inn.gate);
  const toGate = gateCode(out.gate);
  const fromTerminal = termFor(inn, 'arrival');
  const toTerminal = termFor(out, 'departure');
  return {
    key: `${slug(inn.number)}>${slug(out.number)}|${hub}`,
    hub,
    incoming: inn,
    outgoing: out,
    fromGate: fromGate || 'TBA',
    toGate: toGate || 'TBA',
    fromTerminal,
    toTerminal,
    arriveMs,
    departMs,
    walk: connectionWalkMinutes(hub, fromGate, toGate, fromTerminal, toTerminal),
  };
}

export function findGateRacePairs(flights: RaceFlight[]): GateRacePair[] {
  const out: GateRacePair[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < flights.length; i++) {
    for (let j = 0; j < flights.length; j++) {
      if (i === j) continue;
      const pair = buildPair(flights[i], flights[j]);
      if (!pair || seen.has(pair.key)) continue;
      seen.add(pair.key);
      out.push(pair);
    }
  }
  return out.sort((a, b) => (a.departMs - a.arriveMs) - (b.departMs - b.arriveMs));
}

export function findGateRacePair(flights: RaceFlight[]): GateRacePair | null {
  return findGateRacePairs(flights)[0] ?? null;
}

export function gateRacePairForFlight(flights: RaceFlight[], flightNumber: string): GateRacePair | null {
  const n = slug(flightNumber);
  return findGateRacePairs(flights).find(
    p => slug(p.incoming.number) === n || slug(p.outgoing.number) === n,
  ) ?? null;
}

export function isIncomingLanded(pair: GateRacePair, now = Date.now()): boolean {
  if (pair.incoming.status === 'landed') return true;
  if (pair.incoming.status === 'en-route' && now >= pair.arriveMs) return true;
  return false;
}

export function connectionGapMin(pair: GateRacePair): number {
  return Math.max(0, (pair.departMs - pair.arriveMs) / 60000);
}

export function connectionRemainMin(pair: GateRacePair, now = Date.now()): number {
  const base = isIncomingLanded(pair, now) ? now : pair.arriveMs;
  return Math.max(0, (pair.departMs - base) / 60000);
}

export function connectionMarginMin(pair: GateRacePair, now = Date.now()): number {
  return connectionRemainMin(pair, now) - walkBuffered(pair.walk);
}

const notifiedLanding = new Set<string>();
const notifiedDelay = new Set<string>();
const notifiedMissed = new Set<string>();

function termLabel(raw: string): string {
  const t = raw.trim();
  if (!t) return '';
  if (/^t\d/i.test(t)) return t.toUpperCase();
  if (/^\d/.test(t)) return `T${t}`;
  return t;
}

async function pushGateRace(title: string, body: string, urgent = false) {
  if (Platform.OS === 'web') return;
  try {
    const Notifications = require('expo-notifications') as typeof import('expo-notifications');
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: true,
        ...(Platform.OS === 'android'
          ? { channelId: urgent ? 'flights-urgent' : 'flights' }
          : {}),
      },
      trigger: null,
    });
  } catch { /* ignore */ }
}

export async function notifyGateRaceLanding(pair: GateRacePair, now = Date.now()) {
  if (notifiedLanding.has(pair.key)) return;
  const remain = Math.round(connectionRemainMin(pair, now));
  const term = termLabel(pair.toTerminal) || pair.hub;
  notifiedLanding.add(pair.key);
  await pushGateRace(
    t().gateRaceNotifyLandingTitle,
    t().gateRaceNotifyLandingBody(remain, pair.toGate, term),
    true,
  );
}

export async function notifyGateRaceDelayRisk(pair: GateRacePair, remainMin: number) {
  const delayKey = `${pair.key}|${Math.round(remainMin)}`;
  if (notifiedDelay.has(delayKey)) return;
  notifiedDelay.add(delayKey);
  await pushGateRace(
    t().gateRaceNotifyDelayTitle,
    t().gateRaceNotifyDelayBody(
      pair.incoming.number,
      pair.outgoing.number,
      Math.round(remainMin),
    ),
    true,
  );
}

export async function notifyGateRaceMissed(pair: GateRacePair) {
  if (notifiedMissed.has(pair.key)) return;
  notifiedMissed.add(pair.key);
  await pushGateRace(
    t().gateRaceConnectionMissedTitle,
    t().gateRaceConnectionMissedBody,
    true,
  );
}

export function shouldNotifyGateRaceMissed(pair: GateRacePair, now = Date.now()): boolean {
  return connectionMissed(connectionMarginMin(pair, now));
}
