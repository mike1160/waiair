import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';
import {
  boardingCountdownLabel,
  formatDurationMs,
  getBoardingPhase,
  liveStatusLabel,
} from '../boardingCountdown';
import { cleanBaggageBelt } from './baggageBelt';
import { airportRecByIata } from './airportsDb';
import { fetchWeatherSnapshot } from './destinationServices';
import { formatAirportClock, resolveArrivalIso, resolveDepartureIso } from './flightTimes';
import { getPrefs } from './prefs';
import FlightHomeWidget, { type FlightHomeWidgetProps } from '../widgets/FlightHomeWidget';

export const WIDGET_APP_GROUP = 'group.com.waiair.WaiAir';
export const TRACKED_FLIGHTS_WIDGET_KEY = 'trackedFlights';

const REFRESH_MS = 5 * 60 * 1000;
const TIMELINE_HOURS = 6;

const storage = new ExtensionStorage(WIDGET_APP_GROUP);

export type WidgetFlightSnapshot = {
  key: string;
  flightNumber: string;
  airline?: string;
  origin: string;
  destination: string;
  destCity?: string;
  status: string;
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
  boardSide?: 'arrival' | 'departure' | 'both';
  gate?: string;
  terminal?: string;
  baggage?: string;
  delay?: number;
  type?: 'arrival' | 'departure';
  seat?: string;
  originCountry?: string;
  destCountry?: string;
};

export type WidgetTrackedInput = {
  key: string;
  flightNumber?: string;
  lastGate?: string;
  lastDelay?: number;
  lastStatus?: string;
  lastBaggage?: string;
  type?: 'arrival' | 'departure';
  boardingPass?: { seat?: string };
  flight: {
    number?: string;
    airline?: string;
    origin?: string;
    destination?: string;
    destCity?: string;
    status?: string;
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
    boardSide?: 'arrival' | 'departure' | 'both';
    gate?: string;
    terminal?: string;
    baggage?: string;
    delay?: number;
    originCountry?: string;
    destCountry?: string;
    seat?: string;
  };
};

function displayFlightNumber(raw: string): string {
  const clean = String(raw || '').replace(/\s+/g, '').toUpperCase();
  const m = clean.match(/^([A-Z]{1,3})(\d{1,4}[A-Z]?)$/);
  if (m) return `${m[1]} ${m[2]}`;
  return raw || '—';
}

function relevantIso(f: WidgetFlightSnapshot): string {
  if (f.type === 'arrival') return resolveArrivalIso(f);
  return resolveDepartureIso(f);
}

function formatClock(iso: string | undefined, iata?: string, country?: string): string {
  if (!iso) return '—';
  return formatAirportClock(iso, iata, getPrefs().timeFormat === '12h', country);
}

function countdownLabel(f: WidgetFlightSnapshot, now = Date.now()): string {
  const phase = getBoardingPhase(f, now);
  if (f.type === 'arrival') {
    if (phase === 'landed') return 'Landed';
    if (phase === 'cancelled') return 'Cancelled';
    const iso = resolveArrivalIso(f);
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

function statusLabel(f: WidgetFlightSnapshot, now = Date.now()): string {
  return liveStatusLabel({ ...f, status: f.status }, now, f.type);
}

function emptySecond(): Pick<
  FlightHomeWidgetProps,
  | 'hasFlight2'
  | 'flightNumber2'
  | 'origin2'
  | 'destination2'
  | 'departureTime2'
  | 'arrivalTime2'
  | 'gate2'
  | 'status2'
  | 'statusLabel2'
  | 'seat2'
  | 'countdown2'
> {
  return {
    hasFlight2: false,
    flightNumber2: '',
    origin2: '',
    destination2: '',
    departureTime2: '',
    arrivalTime2: '',
    gate2: '',
    status2: '',
    statusLabel2: '',
    seat2: '',
    countdown2: '',
  };
}

export function pickNextTrackedFlights(list: WidgetFlightSnapshot[], now = Date.now()): WidgetFlightSnapshot[] {
  if (!list.length) return [];
  const scored = list
    .map((f) => {
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
  return scored.map((s) => s.f).slice(0, 2);
}

function pickArrivingFlight(
  list: WidgetFlightSnapshot[],
  primary: WidgetFlightSnapshot | null,
): WidgetFlightSnapshot | null {
  for (const f of list) {
    if (f.type === 'arrival' && f.key !== primary?.key) return f;
  }
  return null;
}

function toSnapshot(t: WidgetTrackedInput): WidgetFlightSnapshot {
  const f = t.flight || {};
  return {
    key: t.key,
    flightNumber: t.flightNumber || String(f.number || ''),
    airline: f.airline,
    origin: f.origin || '',
    destination: f.destination || '',
    destCity: f.destCity,
    status: f.status || t.lastStatus || 'scheduled',
    scheduledTime: f.scheduledTime,
    revisedTime: f.revisedTime,
    departureTime: f.departureTime,
    arrivalTime: f.arrivalTime,
    scheduledDeparture: f.scheduledDeparture,
    scheduledArrival: f.scheduledArrival,
    estimatedDeparture: f.estimatedDeparture,
    estimatedArrival: f.estimatedArrival,
    actualDeparture: f.actualDeparture,
    actualArrival: f.actualArrival,
    boardSide: f.boardSide,
    gate: f.gate || t.lastGate || '',
    terminal: f.terminal || '',
    baggage: cleanBaggageBelt(f.baggage || t.lastBaggage || ''),
    delay: typeof f.delay === 'number' ? f.delay : (t.lastDelay || 0),
    type: t.type,
    seat: t.boardingPass?.seat || f.seat || '',
    originCountry: f.originCountry,
    destCountry: f.destCountry,
  };
}

function persistToAppGroup(list: WidgetFlightSnapshot[]): void {
  try {
    storage.set(TRACKED_FLIGHTS_WIDGET_KEY, JSON.stringify(list));
  } catch {
    /* App Group unavailable until prebuild */
  }
}

async function weatherLineFor(f: WidgetFlightSnapshot | null): Promise<string> {
  if (!f?.destination) return '';
  const ap = airportRecByIata(f.destination);
  if (!ap) return '';
  try {
    const wx = await fetchWeatherSnapshot(
      ap.lat,
      ap.lon,
      f.destCity || ap.city,
      resolveArrivalIso(f),
      f.destination,
      f.destCountry || ap.country,
    );
    if (!wx) return '';
    return `${f.destination} · ${wx.temp}°C · ${wx.description}`;
  } catch {
    return '';
  }
}

function snapshotToProps(
  primary: WidgetFlightSnapshot | null,
  arriving: WidgetFlightSnapshot | null,
  weatherLine: string,
  now = Date.now(),
): FlightHomeWidgetProps {
  if (!primary) {
    return {
      hasFlight: false,
      flightNumber: '',
      origin: '',
      destination: '',
      departureTime: '',
      arrivalTime: '',
      gate: '',
      status: '',
      statusLabel: '',
      seat: '',
      baggageBelt: '',
      countdown: '',
      weatherLine: '',
      emptyTitle: 'Track a flight',
      emptySubtitle: '',
      ...emptySecond(),
    };
  }

  const depIso = resolveDepartureIso(primary);
  const arrIso = resolveArrivalIso(primary);
  const landed = getBoardingPhase(primary, now) === 'landed' || primary.status === 'landed';
  const belt = landed ? cleanBaggageBelt(primary.baggage || '') : '';

  const second = arriving
    ? {
        hasFlight2: true,
        flightNumber2: displayFlightNumber(arriving.flightNumber),
        origin2: (arriving.origin || '—').toUpperCase(),
        destination2: (arriving.destination || '—').toUpperCase(),
        departureTime2: formatClock(resolveDepartureIso(arriving), arriving.origin, arriving.originCountry),
        arrivalTime2: formatClock(resolveArrivalIso(arriving), arriving.destination, arriving.destCountry),
        gate2: String(arriving.gate || '').trim(),
        status2: arriving.status,
        statusLabel2: statusLabel(arriving, now),
        seat2: String(arriving.seat || '').trim(),
        countdown2: countdownLabel(arriving, now),
      }
    : emptySecond();

  return {
    hasFlight: true,
    flightNumber: displayFlightNumber(primary.flightNumber),
    origin: (primary.origin || '—').toUpperCase(),
    destination: (primary.destination || '—').toUpperCase(),
    departureTime: formatClock(depIso, primary.origin, primary.originCountry),
    arrivalTime: formatClock(arrIso, primary.destination, primary.destCountry),
    gate: String(primary.gate || '').trim(),
    status: primary.status,
    statusLabel: statusLabel(primary, now),
    seat: String(primary.seat || '').trim(),
    baggageBelt: belt,
    countdown: countdownLabel(primary, now),
    weatherLine,
    emptyTitle: '',
    emptySubtitle: '',
    ...second,
  };
}

let syncEpoch = 0;

function pushTimeline(
  primary: WidgetFlightSnapshot | null,
  arriving: WidgetFlightSnapshot | null,
  weatherLine: string,
  now: number,
): void {
  const entries: { date: Date; props: FlightHomeWidgetProps }[] = [];
  const steps = Math.ceil((TIMELINE_HOURS * 60 * 60 * 1000) / REFRESH_MS);
  for (let i = 0; i <= steps; i++) {
    const at = now + i * REFRESH_MS;
    entries.push({
      date: new Date(at),
      props: snapshotToProps(primary, arriving, weatherLine, at),
    });
  }
  // updateTimeline already reloads. Do not call updateSnapshot after this —
  // that replaces the 6h timeline with a single "now" entry (.atEnd → empty widget).
  FlightHomeWidget.updateTimeline(entries);
  try {
    ExtensionStorage.reloadWidget();
  } catch {
    /* optional until native build */
  }
}

/** Push tracked flights into App Group and refresh the home screen widget timeline. */
export async function syncHomeScreenWidget(tracked: WidgetTrackedInput[]): Promise<void> {
  const epoch = ++syncEpoch;
  const snapshots = (tracked || []).map(toSnapshot);
  persistToAppGroup(snapshots);

  if (Platform.OS !== 'ios') return;

  const now = Date.now();
  const nextTwo = pickNextTrackedFlights(snapshots, now);
  const primary = nextTwo[0] ?? null;
  const arriving = pickArrivingFlight(snapshots, primary);

  try {
    pushTimeline(primary, arriving, '', now);
  } catch (e) {
    console.warn('[Widget] sync FAILED', e);
    return;
  }

  if (!primary || epoch !== syncEpoch) return;

  try {
    const weatherLine = await weatherLineFor(primary);
    if (!weatherLine || epoch !== syncEpoch) return;
    pushTimeline(primary, arriving, weatherLine, Date.now());
  } catch (e) {
    console.warn('[Widget] weather update FAILED', e);
  }
}
