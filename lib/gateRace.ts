import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  parseTimeMs,
  resolveArrivalIso,
  resolveDepartureIso,
  type FlightClockFields,
} from './flightTimes';
import { isoInAirportTzToUtcMs, localDateKey } from './localFlightTime';
import { timezoneForIata } from './airportTz';
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

function sameDay(a: number, b: number, hubIata?: string): boolean {
  const tz = timezoneForIata(hubIata);
  return localDateKey(new Date(a), tz) === localDateKey(new Date(b), tz);
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
  const arriveMs = isoInAirportTzToUtcMs(resolveArrivalIso(inn), inn.destination, inn.destCountry) ?? parseTimeMs(resolveArrivalIso(inn)) ?? 0;
  const departMs = isoInAirportTzToUtcMs(resolveDepartureIso(out), out.origin, out.originCountry) ?? parseTimeMs(resolveDepartureIso(out)) ?? 0;
  if (!arriveMs || !departMs || !sameDay(arriveMs, departMs, hub)) return null;
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

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function gateRaceDedupeKey(pair: string, kind?: string): string {
  const date = todayKey();
  return kind ? `gateRace-${pair}-${kind}-${date}` : `gateRace-${pair}-${date}`;
}

/** Claim the key in-memory first so parallel calls don't double-send. */
async function claimGateRaceDedupe(key: string, mem: Set<string>): Promise<boolean> {
  if (mem.has(key)) return false;
  mem.add(key);
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw != null) return false;
  } catch { /* ignore */ }
  return true;
}

async function persistGateRaceDedupe(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, '1');
  } catch { /* ignore */ }
}

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
  const key = gateRaceDedupeKey(pair.key);
  if (!await claimGateRaceDedupe(key, notifiedLanding)) return;
  const remain = Math.round(connectionRemainMin(pair, now));
  const term = termLabel(pair.toTerminal) || pair.hub;
  await pushGateRace(
    t().gateRaceNotifyLandingTitle,
    t().gateRaceNotifyLandingBody(remain, pair.toGate, term),
    true,
  );
  await persistGateRaceDedupe(key);
}

export async function notifyGateRaceDelayRisk(pair: GateRacePair, remainMin: number) {
  const key = gateRaceDedupeKey(pair.key, 'delay');
  if (!await claimGateRaceDedupe(key, notifiedDelay)) return;
  await pushGateRace(
    t().gateRaceNotifyDelayTitle,
    t().gateRaceNotifyDelayBody(
      pair.incoming.number,
      pair.outgoing.number,
      Math.round(remainMin),
    ),
    true,
  );
  await persistGateRaceDedupe(key);
}

export async function notifyGateRaceMissed(pair: GateRacePair) {
  const key = gateRaceDedupeKey(pair.key, 'missed');
  if (!await claimGateRaceDedupe(key, notifiedMissed)) return;
  await pushGateRace(
    t().gateRaceConnectionMissedTitle,
    t().gateRaceConnectionMissedBody,
    true,
  );
  await persistGateRaceDedupe(key);
}

export function shouldNotifyGateRaceMissed(pair: GateRacePair, now = Date.now()): boolean {
  return connectionMissed(connectionMarginMin(pair, now));
}
