import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  boardingCountdownLabel,
  flightCardBoarding,
  formatDurationMs,
  getBoardingPhase,
  WIDGET_TIMELINE_MS,
} from './boardingCountdown';
import { formatAirportClock, resolveArrivalIso, resolveDepartureIso } from './lib/flightTimes';
import FlightHomeWidget, { type FlightHomeWidgetProps } from './widgets/FlightHomeWidget';
import { t, flightStatusLabel } from './lib/i18n';

/** User-facing / widget-friendly mirror of tracked flights (also kept for App Group sync docs). */
export const TRACKED_FLIGHTS_WIDGET_KEY = 'trackedFlights';

const REFRESH_MS = WIDGET_TIMELINE_MS;
const TIMELINE_HOURS = 6;

export type WidgetFlightSnapshot = {
  key: string;
  flightNumber: string;
  airline?: string;
  origin: string;
  destination: string;
  status: string;
  scheduledTime?: string;
  revisedTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  actualTime?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  boardSide?: 'arrival' | 'departure' | 'both';
  gate?: string;
  terminal?: string;
  delay?: number;
  type?: 'arrival' | 'departure';
};

function statusBadge(f: WidgetFlightSnapshot, now = Date.now()): string {
  const card = flightCardBoarding(f, now, f.type);
  if (card.boarding) return card.label;
  switch (f.status) {
    case 'boarding': return t().boardingNow;
    case 'delayed': return t().delayed;
    case 'scheduled': return t().onTimeStatus;
    case 'en-route': return t().enRoute;
    case 'landed': return t().landed;
    case 'cancelled': return t().cancelled;
    default: return f.status ? flightStatusLabel(f.status) : t().onTimeStatus;
  }
}

function formatTime(iso?: string, iata?: string): string {
  return formatAirportClock(iso, iata, false);
}

function displayFlightNumber(raw: string): string {
  const clean = String(raw || '').replace(/\s+/g, '').toUpperCase();
  const m = clean.match(/^([A-Z]{1,3})(\d{1,4}[A-Z]?)$/);
  if (m) return `${m[1]} ${m[2]}`;
  return raw || '—';
}

function cleanAirline(raw?: string): string {
  const s = String(raw || '').trim();
  if (!s || s === '—' || /^n\/?a$/i.test(s)) return '';
  return s;
}

function relevantIso(f: WidgetFlightSnapshot): string {
  if (f.type === 'arrival') {
    return resolveArrivalIso(f);
  }
  return resolveDepartureIso(f);
}

function countdownLabel(f: WidgetFlightSnapshot, now = Date.now()): string {
  const phase = getBoardingPhase(f, now);
  if (f.type === 'arrival') {
    if (phase === 'landed') return t().landed;
    if (phase === 'cancelled') return t().cancelled;
    const iso = relevantIso(f);
    if (!iso) return '';
    const diff = new Date(iso).getTime() - now;
    if (diff <= 0) return t().landingSoon;
    return t().landsIn(formatDurationMs(diff));
  }
  const board = boardingCountdownLabel(f, now);
  if (board) return board;
  const iso = relevantIso(f);
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return t().departing;
  return t().departsIn(formatDurationMs(diff));
}

function emptySecond(): Pick<FlightHomeWidgetProps,
  'hasFlight2'|'flightNumber2'|'airline2'|'origin2'|'destination2'|'statusBadge2'|'timeLabel2'|'gate2'|'terminal2'
> {
  return {
    hasFlight2: false,
    flightNumber2: '',
    airline2: '',
    origin2: '',
    destination2: '',
    statusBadge2: '',
    timeLabel2: '',
    gate2: '',
    terminal2: '',
  };
}

export function pickNextTrackedFlights(list: WidgetFlightSnapshot[], now = Date.now()): WidgetFlightSnapshot[] {
  if (!list.length) return [];
  const scored = list
    .map(f => {
      const iso = relevantIso(f);
      const t = iso ? new Date(iso).getTime() : NaN;
      const phase = getBoardingPhase(f, now);
      const done = phase === 'landed' || phase === 'cancelled';
      return { f, t: Number.isFinite(t) ? t : Number.POSITIVE_INFINITY, done };
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.t - b.t;
    });
  return scored.map(s => s.f).slice(0, 2);
}

export function pickNextTrackedFlight(list: WidgetFlightSnapshot[], now = Date.now()): WidgetFlightSnapshot | null {
  return pickNextTrackedFlights(list, now)[0] ?? null;
}

export function toFlightHomeWidgetProps(
  f: WidgetFlightSnapshot | null,
  now = Date.now(),
  second?: WidgetFlightSnapshot | null,
): FlightHomeWidgetProps {
  if (!f) {
    return {
      hasFlight: false,
      flightNumber: '',
      airline: '',
      origin: '',
      destination: '',
      statusBadge: '',
      timeLabel: '',
      countdown: '',
      gate: '',
      terminal: '',
      delayMinutes: 0,
      showDelayBanner: false,
      emptyMessage: 'No tracked flights',
      ...emptySecond(),
    };
  }
  const delay = typeof f.delay === 'number' ? f.delay : 0;
  const gate = String(f.gate || '').trim();
  const terminal = String(f.terminal || '').trim();
  const secondProps = second ? {
    hasFlight2: true,
    flightNumber2: displayFlightNumber(second.flightNumber),
    airline2: cleanAirline(second.airline),
    origin2: second.origin || '—',
    destination2: second.destination || '—',
    statusBadge2: statusBadge(second),
    timeLabel2: formatTime(relevantIso(second), second.type === 'arrival' ? second.destination : second.origin),
    gate2: String(second.gate || '').trim(),
    terminal2: String(second.terminal || '').trim(),
  } : emptySecond();
  return {
    hasFlight: true,
    flightNumber: displayFlightNumber(f.flightNumber),
    airline: cleanAirline(f.airline),
    origin: f.origin || '—',
    destination: f.destination || '—',
    statusBadge: statusBadge(f),
    timeLabel: formatTime(relevantIso(f), f.type === 'arrival' ? f.destination : f.origin),
    countdown: countdownLabel(f, now),
    gate: gate && gate !== '—' ? gate : '',
    terminal: terminal && terminal !== '—' ? terminal : '',
    delayMinutes: delay,
    showDelayBanner: delay > 0 || f.status === 'delayed',
    emptyMessage: '',
    ...secondProps,
  };
}

function toSnapshot(t: {
  key: string;
  flightNumber?: string;
  lastGate?: string;
  lastDelay?: number;
  type?: 'arrival' | 'departure';
  flight: {
    number?: string;
    airline?: string;
    origin?: string;
    destination?: string;
    status?: string;
    scheduledTime?: string;
    revisedTime?: string;
    departureTime?: string;
    arrivalTime?: string;
    actualTime?: string;
    scheduledDeparture?: string;
    scheduledArrival?: string;
    estimatedDeparture?: string;
    estimatedArrival?: string;
    actualDeparture?: string;
    actualArrival?: string;
    boardSide?: 'arrival' | 'departure' | 'both';
    gate?: string;
    terminal?: string;
    delay?: number;
  };
}): WidgetFlightSnapshot {
  const f = t.flight || ({} as WidgetFlightSnapshot);
  return {
    key: t.key,
    flightNumber: t.flightNumber || f.number || '',
    airline: cleanAirline(f.airline),
    origin: f.origin || '',
    destination: f.destination || '',
    status: f.status || 'scheduled',
    scheduledTime: f.scheduledTime,
    revisedTime: f.revisedTime,
    departureTime: f.departureTime,
    arrivalTime: f.arrivalTime,
    actualTime: f.actualTime,
    scheduledDeparture: f.scheduledDeparture,
    scheduledArrival: f.scheduledArrival,
    estimatedDeparture: f.estimatedDeparture,
    estimatedArrival: f.estimatedArrival,
    actualDeparture: f.actualDeparture,
    actualArrival: f.actualArrival,
    boardSide: f.boardSide,
    gate: f.gate || t.lastGate || '',
    terminal: f.terminal || '',
    delay: typeof f.delay === 'number' ? f.delay : (t.lastDelay || 0),
    type: t.type,
  };
}

async function persistWidgetMirror(list: WidgetFlightSnapshot[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TRACKED_FLIGHTS_WIDGET_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

/** Push current tracked flight into the home screen widget (snapshot + 5‑min timeline). */
export async function syncHomeScreenWidget(
  tracked: {
    key: string;
    flightNumber?: string;
    lastGate?: string;
    lastDelay?: number;
    type?: 'arrival' | 'departure';
    flight: {
      number?: string;
      airline?: string;
      origin?: string;
      destination?: string;
      status?: string;
      scheduledTime?: string;
      revisedTime?: string;
      departureTime?: string;
    arrivalTime?: string;
    actualTime?: string;
    gate?: string;
    terminal?: string;
    delay?: number;
  };
}[],
): Promise<void> {
  const snapshots = (tracked || []).map(toSnapshot);
  await persistWidgetMirror(snapshots);

  if (Platform.OS !== 'ios') return;

  try {
    const nextTwo = pickNextTrackedFlights(snapshots);
    const next = nextTwo[0] ?? null;
    const second = nextTwo[1] ?? null;
    const now = Date.now();
    const entries: { date: Date; props: FlightHomeWidgetProps }[] = [];
    const steps = Math.ceil((TIMELINE_HOURS * 60 * 60 * 1000) / REFRESH_MS);

    for (let i = 0; i <= steps; i++) {
      const at = now + i * REFRESH_MS;
      entries.push({
        date: new Date(at),
        props: toFlightHomeWidgetProps(next, at, second),
      });
    }

    FlightHomeWidget.updateTimeline(entries);
    const snapshot = toFlightHomeWidgetProps(next, now, second);
    FlightHomeWidget.updateSnapshot(snapshot);
    FlightHomeWidget.reload();
  } catch (e) {
    console.warn('[WaiAir] Home screen widget sync failed', e);
  }
}
