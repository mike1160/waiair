/** Home-widget card payload — App Group JSON, no React Native. */

import { formatAirportClock, resolveArrivalIso, resolveDepartureIso } from './flightTimes.ts';
import { BRANDS } from './brands.ts';

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

export type WidgetCardPayload = {
  hasFlight: boolean;
  flightNumber: string;
  from: string;
  to: string;
  departureTime: string;
  status: string;
  statusLabel: string;
  gate: string;
  emptyTitle: string;
  emptySubtitle: string;
  brandLabel: string;
};

export function displayFlightNumber(raw: string): string {
  return String(raw || '').replace(/\s+/g, '').toUpperCase() || '—';
}

function relevantIso(f: WidgetFlightSnapshot): string {
  if (f.type === 'arrival') return resolveArrivalIso(f);
  return resolveDepartureIso(f);
}

function cardClock(iso: string | undefined, iata?: string, hour12 = false, country?: string): string {
  if (!iso) return '—';
  return formatAirportClock(iso, iata, hour12, country);
}

function isDoneStatus(status: string): boolean {
  const s = String(status || '').toLowerCase().replace(/[_\s-]/g, '');
  return s === 'landed' || s === 'cancelled' || s === 'canceled';
}

function cardStatusLabel(status: string, delay?: number): string {
  const s = String(status || '').toLowerCase().replace(/[_\s-]/g, '');
  if (s === 'cancelled' || s === 'canceled') return 'Cancelled';
  if (s === 'landed') return 'Landed';
  if (s === 'delayed' || (typeof delay === 'number' && delay >= 10)) return 'Delayed';
  if (s.includes('board')) return 'Boarding';
  if (s === 'ontime' || s === 'scheduled') return 'On time';
  return 'Scheduled';
}

export function pickNextTrackedFlights(list: WidgetFlightSnapshot[], now = Date.now()): WidgetFlightSnapshot[] {
  if (!list.length) return [];
  const scored = list
    .map((f) => {
      const iso = relevantIso(f);
      const at = iso ? new Date(iso).getTime() : NaN;
      const done = isDoneStatus(f.status);
      return { f, t: Number.isFinite(at) ? at : Number.POSITIVE_INFINITY, done };
    })
    .sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.t - b.t;
    });
  return scored.map((s) => s.f).slice(0, 2);
}

/** Next tracked flight as the home-widget card (App Group JSON the Swift extension reads). */
export function widgetCardFromSnapshots(
  list: WidgetFlightSnapshot[],
  now = Date.now(),
  hour12 = false,
): WidgetCardPayload {
  const primary = pickNextTrackedFlights(list, now)[0] ?? null;
  if (!primary) {
    return {
      hasFlight: false,
      flightNumber: '',
      from: '',
      to: '',
      departureTime: '',
      status: '',
      statusLabel: '',
      gate: '',
      emptyTitle: 'Track a flight',
      emptySubtitle: 'Tap to add your flight',
      brandLabel: BRANDS.waiair,
    };
  }
  const depIso = resolveDepartureIso(primary);
  return {
    hasFlight: true,
    flightNumber: displayFlightNumber(primary.flightNumber),
    from: (primary.origin || '—').toUpperCase(),
    to: (primary.destination || '—').toUpperCase(),
    departureTime: cardClock(depIso, primary.origin, hour12, primary.originCountry),
    status: primary.status,
    statusLabel: cardStatusLabel(primary.status, primary.delay),
    gate: String(primary.gate || '').trim(),
    emptyTitle: '',
    emptySubtitle: '',
    brandLabel: BRANDS.waiair,
  };
}
