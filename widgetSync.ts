import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  boardingCountdownLabel,
  formatDurationMs,
  getBoardingPhase,
} from './boardingCountdown';
import FlightHomeWidget, { type FlightHomeWidgetProps } from './widgets/FlightHomeWidget';

/** User-facing / widget-friendly mirror of tracked flights (also kept for App Group sync docs). */
export const TRACKED_FLIGHTS_WIDGET_KEY = 'trackedFlights';

const REFRESH_MS = 15 * 60 * 1000;
const TIMELINE_HOURS = 6;

export type WidgetFlightSnapshot = {
  key: string;
  flightNumber: string;
  origin: string;
  destination: string;
  status: string;
  scheduledTime?: string;
  revisedTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  actualTime?: string;
  gate?: string;
  delay?: number;
  type?: 'arrival' | 'departure';
};

function statusBadge(status: string): string {
  switch (status) {
    case 'boarding': return 'Boarding';
    case 'delayed': return 'Delayed';
    case 'scheduled': return 'On time';
    case 'en-route': return 'En route';
    case 'landed': return 'Landed';
    case 'cancelled': return 'Cancelled';
    default: return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'On time';
  }
}

function formatTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function displayFlightNumber(raw: string): string {
  const clean = String(raw || '').replace(/\s+/g, '').toUpperCase();
  const m = clean.match(/^([A-Z]{1,3})(\d{1,4}[A-Z]?)$/);
  if (m) return `${m[1]} ${m[2]}`;
  return raw || '—';
}

function relevantIso(f: WidgetFlightSnapshot): string {
  if (f.type === 'arrival') {
    return f.arrivalTime || f.revisedTime || f.scheduledTime || '';
  }
  return f.departureTime || f.revisedTime || f.scheduledTime || '';
}

function countdownLabel(f: WidgetFlightSnapshot, now = Date.now()): string {
  const phase = getBoardingPhase(f, now);
  if (f.type === 'arrival') {
    if (phase === 'landed') return 'Landed';
    if (phase === 'cancelled') return 'Cancelled';
    const iso = relevantIso(f);
    if (!iso) return '';
    const diff = new Date(iso).getTime() - now;
    if (diff <= 0) return 'Landing soon';
    return `Lands in ${formatDurationMs(diff)}`;
  }
  const board = boardingCountdownLabel(f, now);
  if (board) return board;
  const iso = relevantIso(f);
  if (!iso) return '';
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return 'Departing';
  return `Departs in ${formatDurationMs(diff)}`;
}

/** Prefer next upcoming flight; fall back to first tracked. */
export function pickNextTrackedFlight(list: WidgetFlightSnapshot[], now = Date.now()): WidgetFlightSnapshot | null {
  if (!list.length) return null;
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
  return scored[0]?.f ?? list[0];
}

export function toFlightHomeWidgetProps(
  f: WidgetFlightSnapshot | null,
  now = Date.now(),
): FlightHomeWidgetProps {
  if (!f) {
    return {
      hasFlight: false,
      flightNumber: '',
      origin: '',
      destination: '',
      statusBadge: '',
      timeLabel: '',
      countdown: '',
      gate: '',
      delayMinutes: 0,
      showDelayBanner: false,
      emptyMessage: 'No tracked flights',
    };
  }
  const delay = typeof f.delay === 'number' ? f.delay : 0;
  const gate = String(f.gate || '').trim();
  return {
    hasFlight: true,
    flightNumber: displayFlightNumber(f.flightNumber),
    origin: f.origin || '—',
    destination: f.destination || '—',
    statusBadge: statusBadge(f.status),
    timeLabel: formatTime(f.revisedTime || f.scheduledTime || relevantIso(f)),
    countdown: countdownLabel(f, now),
    gate: gate && gate !== '—' ? gate : '',
    delayMinutes: delay,
    showDelayBanner: delay > 0 || f.status === 'delayed',
    emptyMessage: '',
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
    origin?: string;
    destination?: string;
    status?: string;
    scheduledTime?: string;
    revisedTime?: string;
    departureTime?: string;
    arrivalTime?: string;
    actualTime?: string;
    gate?: string;
    delay?: number;
  };
}): WidgetFlightSnapshot {
  const f = t.flight || ({} as WidgetFlightSnapshot);
  return {
    key: t.key,
    flightNumber: t.flightNumber || f.number || '',
    origin: f.origin || '',
    destination: f.destination || '',
    status: f.status || 'scheduled',
    scheduledTime: f.scheduledTime,
    revisedTime: f.revisedTime,
    departureTime: f.departureTime,
    arrivalTime: f.arrivalTime,
    actualTime: f.actualTime,
    gate: f.gate || t.lastGate || '',
    delay: typeof f.delay === 'number' ? f.delay : (t.lastDelay || 0),
    type: t.type,
  };
}

async function persistWidgetMirror(list: WidgetFlightSnapshot[]): Promise<void> {
  try {
    await AsyncStorage.setItem(TRACKED_FLIGHTS_WIDGET_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

/** Push current tracked flight into the home screen widget (snapshot + 15‑min timeline). */
export async function syncHomeScreenWidget(
  tracked: {
    key: string;
    flightNumber?: string;
    lastGate?: string;
    lastDelay?: number;
    type?: 'arrival' | 'departure';
    flight: {
      number?: string;
      origin?: string;
      destination?: string;
      status?: string;
      scheduledTime?: string;
      revisedTime?: string;
      departureTime?: string;
      arrivalTime?: string;
      actualTime?: string;
      gate?: string;
      delay?: number;
    };
  }[],
): Promise<void> {
  const snapshots = (tracked || []).map(toSnapshot);
  await persistWidgetMirror(snapshots);

  if (Platform.OS !== 'ios') return;

  try {
    const next = pickNextTrackedFlight(snapshots);
    const now = Date.now();
    const entries: { date: Date; props: FlightHomeWidgetProps }[] = [];
    const steps = Math.ceil((TIMELINE_HOURS * 60 * 60 * 1000) / REFRESH_MS);

    for (let i = 0; i <= steps; i++) {
      const at = now + i * REFRESH_MS;
      entries.push({
        date: new Date(at),
        props: toFlightHomeWidgetProps(next, at),
      });
    }

    FlightHomeWidget.updateTimeline(entries);
    // Immediate paint in case timeline scheduling lags
    FlightHomeWidget.updateSnapshot(toFlightHomeWidgetProps(next, now));
  } catch (e) {
    console.warn('[WaiAir] Home screen widget sync failed', e);
  }
}
