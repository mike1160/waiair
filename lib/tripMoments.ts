/**
 * The reasoning layer: the handful of moments on a trip that are worth saying something about, and when.
 *
 * Pure — no notifications, no storage, no network, no React Native — so every rule here is unit-tested.
 * lib/schedulePassengerPushes.ts turns what this returns into local notifications; nothing is scheduled here.
 *
 * A moment is only produced when the data behind it is actually known. Guessing is worse than silence: a
 * "your hotel check-in is at risk" that fires on every 20-minute delay trains people to ignore the app.
 */

import { baggageWalkMinutes, gateWalkMinutes } from './gateWalkCore.ts';
import { publicTransportFor, rideHailingFor } from './getIntoTownData.ts';
import { eveningPushFireUtcMs, leaveAtUtcMs } from './leaveTime.ts';
import { resolveArrivalIso, resolveDepartureIso } from './flightTimes.ts';
import type { TripFlight, TripGroup } from './tripOrchestrator.ts';

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;

/** Under this much time between landing and the next departure, the connection is at risk. */
export const CONNECTION_RISK_MIN = 45;
/** How long before an activity starts the reminder fires. */
export const ACTIVITY_LEAD_MIN = 120;
/** Local hour, the day before, for the car-return reminder. */
export const CAR_RETURN_HOUR = 18;

export type MomentKind =
  | 'evening_before'
  | 'depart_now'
  | 'gate_change'
  | 'delay_impact'
  | 'landed'
  | 'activity_reminder'
  | 'car_return'
  | 'connection_risk';

export type TripMoment = {
  key: string;
  /** When to fire. */
  triggerMs: number;
  kind: MomentKind;
  title: string;
  body: string;
  actionLabel?: string;
  /** mailto: / maps / https: — something the notification can open. */
  actionUrl?: string;
  flightKey: string;
  urgent: boolean;
};

export type MomentOpts = {
  locale: string;
  homeAirportCode?: string;
  /**
   * Minutes from where you are to the departure airport. There is no geocoder in a pure function, so the
   * caller passes it (lib/schedulePassengerPushes.ts already resolves one); left out it is treated as
   * unknown and leaveTime falls back to its own estimate.
   */
  travelMin?: number | null;
};

/*
 * Copy lives here rather than in lib/i18n.ts on purpose: this function takes its locale as an argument and
 * must stay pure and deterministic, while t() reads a module-level locale and pulls in the JSON catalogues,
 * which cannot be imported under `node --test`. English is the fallback for every other language.
 */
type Copy = {
  eveningTitle: (city: string, clock: string) => string;
  eveningLeave: (clock: string) => string;
  hotelCheckIn: (name: string, when: string) => string;
  carPickup: (company: string, when: string) => string;
  activityAt: (name: string, when: string) => string;
  departTitle: string;
  departBody: (flight: string, gate: string, walkMin: number) => string;
  gateUnknown: string;
  delayTitle: (min: number) => string;
  delayHotel: (name: string, when: string) => string;
  delayCar: (company: string, when: string) => string;
  openHotel: string;
  landedTitle: (city: string) => string;
  landedBelt: (belt: string) => string;
  landedNoBelt: string;
  landedTransport: (options: string) => string;
  landedHotel: (name: string, address: string) => string;
  activityTitle: string;
  activityBody: (name: string, pickup: string, clock: string) => string;
  carReturnTitle: string;
  carReturnBody: (company: string, place: string, when: string) => string;
  connectionTitle: string;
  connectionBody: (first: string, second: string, min: number) => string;
};

const EN: Copy = {
  eveningTitle: (city, clock) => `${city} tomorrow · ${clock}`,
  eveningLeave: clock => `Leave around ${clock}.`,
  hotelCheckIn: (name, when) => `Check in at ${name} ${when}.`,
  carPickup: (company, when) => `${company} car pick-up ${when}.`,
  activityAt: (name, when) => `${name} ${when}.`,
  departTitle: 'Time to leave',
  departBody: (flight, gate, walkMin) => `${flight} · ${gate} · about ${walkMin} min to the gate.`,
  gateUnknown: 'gate to be announced',
  delayTitle: min => `Delayed ${min} min — this affects your bookings`,
  delayHotel: (name, when) => `You land after check-in at ${name} (${when}).`,
  delayCar: (company, when) => `Your ${company} pick-up is at ${when}, before you land.`,
  openHotel: 'Open hotel in maps',
  landedTitle: city => `Welcome to ${city}`,
  landedBelt: belt => `Bags on belt ${belt}.`,
  landedNoBelt: 'Belt not announced yet.',
  landedTransport: options => `Into town: ${options}.`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}.`,
  activityTitle: 'Coming up in 2 hours',
  activityBody: (name, pickup, clock) => `${name} at ${clock}. Pick-up: ${pickup}.`,
  carReturnTitle: 'Car back tomorrow',
  carReturnBody: (company, place, when) => `${company}${place ? ` at ${place}` : ''} ${when}.`,
  connectionTitle: 'Tight connection',
  connectionBody: (first, second, min) => `${first} is late — ${min} min left to catch ${second}.`,
};

const NL: Copy = {
  eveningTitle: (city, clock) => `${city} morgen · ${clock}`,
  eveningLeave: clock => `Vertrek rond ${clock}.`,
  hotelCheckIn: (name, when) => `Inchecken bij ${name} ${when}.`,
  carPickup: (company, when) => `Auto ophalen bij ${company} ${when}.`,
  activityAt: (name, when) => `${name} ${when}.`,
  departTitle: 'Vertrek nu',
  departBody: (flight, gate, walkMin) => `${flight} · ${gate} · ongeveer ${walkMin} min naar de gate.`,
  gateUnknown: 'gate nog niet bekend',
  delayTitle: min => `${min} min vertraging — dit raakt je boekingen`,
  delayHotel: (name, when) => `Je landt na het inchecken bij ${name} (${when}).`,
  delayCar: (company, when) => `Je ophaalmoment bij ${company} is om ${when}, voordat je landt.`,
  openHotel: 'Hotel op de kaart',
  landedTitle: city => `Welkom in ${city}`,
  landedBelt: belt => `Bagage op band ${belt}.`,
  landedNoBelt: 'Band nog niet bekend.',
  landedTransport: options => `Naar de stad: ${options}.`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}.`,
  activityTitle: 'Over 2 uur',
  activityBody: (name, pickup, clock) => `${name} om ${clock}. Ophalen: ${pickup}.`,
  carReturnTitle: 'Auto morgen terug',
  carReturnBody: (company, place, when) => `${company}${place ? ` bij ${place}` : ''} ${when}.`,
  connectionTitle: 'Krappe overstap',
  connectionBody: (first, second, min) => `${first} is laat — nog ${min} min voor ${second}.`,
};

function copyFor(locale: string): Copy {
  return String(locale || '').toLowerCase().startsWith('nl') ? NL : EN;
}

function ms(iso?: string | null): number | null {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : null;
}

function clock(at: number | null, locale: string): string {
  if (at == null) return '';
  try {
    return new Date(at).toLocaleTimeString(locale || 'en', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
    });
  } catch {
    return new Date(at).toISOString().slice(11, 16);
  }
}

function dayAndClock(at: number | null, locale: string): string {
  if (at == null) return '';
  try {
    const day = new Date(at).toLocaleDateString(locale || 'en', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    });
    return `${day} ${clock(at, locale)}`;
  } catch {
    return new Date(at).toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** True when the ISO carries a time of day, not just a calendar date. */
function hasTime(iso?: string): boolean {
  return /\d{2}:\d{2}/.test(String(iso || ''));
}

type LegTimes = {
  depMs: number | null;
  /** Scheduled arrival — what the bookings were made against. */
  schedArrMs: number | null;
  /** Arrival as it now looks: revised or actual when live data says so. */
  liveArrMs: number | null;
  actualArrMs: number | null;
  delayMin: number;
};

function legTimes<T extends TripFlight>(f: T): LegTimes {
  const live = f.flight || {};
  const depMs = ms(resolveDepartureIso(live) || f.scheduledTime);
  const schedArrMs = ms(live.scheduledArrival || live.arrivalTime) ?? ms(resolveArrivalIso(live));
  const actualArrMs = ms(live.actualArrival) ?? (
    String(live.status || f.lastStatus || '').toLowerCase() === 'landed' ? ms(live.actualTime) : null
  );
  const revisedArrMs = ms(live.estimatedArrival) ?? ms(live.revisedTime);
  const liveArrMs = actualArrMs ?? revisedArrMs ?? schedArrMs;
  const fromField = Number(f.lastDelay);
  const computed = liveArrMs != null && schedArrMs != null
    ? Math.round((liveArrMs - schedArrMs) / MIN_MS)
    : 0;
  const delayMin = Number.isFinite(fromField) && fromField > 0 ? Math.round(fromField) : Math.max(0, computed);
  return { depMs, schedArrMs, liveArrMs, actualArrMs, delayMin };
}

function cityOf<T extends TripFlight>(f: T, fallback: string): string {
  return String(f.flight?.destCity || '').trim() || String(f.flight?.destination || '').trim() || fallback;
}

function numberOf<T extends TripFlight>(f: T): string {
  return String(f.flightNumber || '').trim() || String(f.key || '').trim();
}

function mapsUrl(place?: string): string | undefined {
  const q = String(place || '').trim();
  if (!q) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** 18:00 UTC the day before the given moment. */
function dayBeforeAt(at: number, hour: number): number {
  const d = new Date(at - DAY_MS);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0);
}

/**
 * Everything worth saying about this trip, with the time to say it. Ordered by trigger, earliest first.
 * The caller decides what to do with moments whose trigger has already passed.
 */
export function computeMoments<T extends TripFlight>(
  group: TripGroup<T>,
  now: number,
  opts: MomentOpts,
): TripMoment[] {
  const legs = group?.flights || [];
  if (!legs.length) return [];
  const c = copyFor(opts?.locale);
  const locale = opts?.locale || 'en';
  const extras = group.extras || {};
  const out: TripMoment[] = [];
  const times = legs.map(legTimes);
  const first = legs[0];
  const firstT = times[0];

  // ── Evening before ─────────────────────────────────────────────────────────
  // Only with a hotel: without one there is nothing to tell you the night before that you do not know.
  if (extras.hotel && firstT.depMs != null) {
    const fire = eveningPushFireUtcMs(firstT.depMs, first.flight?.origin, first.flight?.originCountry);
    if (fire != null) {
      const leave = leaveAtUtcMs(firstT.depMs, {
        international: (first.flight?.originCountry || '') !== (first.flight?.destCountry || ''),
        travelMin: opts?.travelMin ?? null,
      });
      const lines = [c.eveningLeave(clock(leave.leaveAt, locale))];
      if (extras.hotel.name || extras.hotel.checkIn) {
        lines.push(c.hotelCheckIn(
          extras.hotel.name || '',
          extras.hotel.checkIn ? dayAndClock(ms(extras.hotel.checkIn), locale) : '',
        ));
      }
      if (extras.carRental?.pickupTime) {
        lines.push(c.carPickup(extras.carRental.company || '', dayAndClock(ms(extras.carRental.pickupTime), locale)));
      }
      if (extras.excursion?.dateTime) {
        lines.push(c.activityAt(extras.excursion.name || '', dayAndClock(ms(extras.excursion.dateTime), locale)));
      }
      out.push({
        key: `${group.key}:evening_before`,
        triggerMs: fire,
        kind: 'evening_before',
        title: c.eveningTitle(cityOf(first, group.name), clock(firstT.depMs, locale)),
        body: lines.filter(Boolean).join(' '),
        flightKey: first.key,
        urgent: false,
      });
    }
  }

  // ── Depart now ─────────────────────────────────────────────────────────────
  // Only for a leg you actually travel to the airport for: the first one, and any later leg that starts more
  // than a day after the previous one landed. A connection is not something you leave home for.
  legs.forEach((f, i) => {
    const t = times[i];
    if (t.depMs == null) return;
    if (i > 0) {
      const prevArr = times[i - 1].liveArrMs ?? times[i - 1].depMs;
      if (prevArr == null || t.depMs - prevArr < DAY_MS) return;
    }
    const leave = leaveAtUtcMs(t.depMs, {
      international: (f.flight?.originCountry || '') !== (f.flight?.destCountry || ''),
      travelMin: opts?.travelMin ?? null,
    });
    const gate = String(f.lastGate || '').trim();
    const walk = gateWalkMinutes(f.flight?.origin, undefined, gate || undefined);
    out.push({
      key: `${group.key}:depart_now:${f.key}`,
      triggerMs: leave.leaveAt,
      kind: 'depart_now',
      title: c.departTitle,
      body: c.departBody(numberOf(f), gate || c.gateUnknown, walk.minutes),
      flightKey: f.key,
      urgent: false,
    });
  });

  // ── Delay impact ───────────────────────────────────────────────────────────
  // A delay on its own is not a moment. Only when landing later actually breaks something you booked.
  legs.forEach((f, i) => {
    const t = times[i];
    if (!t.delayMin || t.liveArrMs == null) return;
    const clashes: string[] = [];
    let action: { label: string; url?: string } | null = null;

    const checkIn = extras.hotel?.checkIn;
    if (checkIn) {
      const checkInMs = ms(checkIn);
      // A bare date has no time, so it can only clash when you now land on a later day altogether.
      const clash = checkInMs != null && (
        hasTime(checkIn)
          ? t.liveArrMs > checkInMs
          : t.liveArrMs > checkInMs + DAY_MS
      );
      if (clash) {
        clashes.push(c.delayHotel(extras.hotel?.name || '', dayAndClock(checkInMs, locale)));
        const place = extras.hotel?.address || extras.hotel?.name;
        // There is no hotel e-mail address anywhere in the data model, so the action is the map.
        if (place) action = { label: c.openHotel, url: mapsUrl(place) };
      }
    }
    const pickup = ms(extras.carRental?.pickupTime);
    if (pickup != null && t.liveArrMs > pickup) {
      clashes.push(c.delayCar(extras.carRental?.company || '', dayAndClock(pickup, locale)));
    }
    if (!clashes.length) return;
    out.push({
      key: `${group.key}:delay_impact:${f.key}`,
      triggerMs: now,
      kind: 'delay_impact',
      title: c.delayTitle(t.delayMin),
      body: clashes.join(' '),
      actionLabel: action?.label,
      actionUrl: action?.url,
      flightKey: f.key,
      urgent: false,
    });
  });

  // ── Landed ─────────────────────────────────────────────────────────────────
  legs.forEach((f, i) => {
    const at = times[i].actualArrMs;
    if (at == null) return;
    const iataCode = String(f.flight?.destination || '').trim();
    const belt = String(f.lastBaggage || '').trim();
    const rides = rideHailingFor(iataCode);
    const transit = publicTransportFor(iataCode).map(x => x.name);
    const options = [...transit, ...rides].slice(0, 3).join(', ');
    const lines = [
      belt ? c.landedBelt(belt) : c.landedNoBelt,
      options ? c.landedTransport(options) : '',
    ];
    if (extras.hotel?.name || extras.hotel?.address) {
      lines.push(c.landedHotel(extras.hotel?.name || '', extras.hotel?.address || ''));
      if (extras.hotel?.checkIn) lines.push(c.hotelCheckIn(extras.hotel.name || '', dayAndClock(ms(extras.hotel.checkIn), locale)));
    }
    out.push({
      key: `${group.key}:landed:${f.key}`,
      triggerMs: at + baggageWalkMinutes(iataCode) * MIN_MS,
      kind: 'landed',
      title: c.landedTitle(cityOf(f, group.name)),
      body: lines.filter(Boolean).join(' '),
      actionLabel: extras.hotel?.address ? c.openHotel : undefined,
      actionUrl: mapsUrl(extras.hotel?.address),
      flightKey: f.key,
      urgent: false,
    });
  });

  // ── Activity reminder ──────────────────────────────────────────────────────
  // Without a pickup location there is nothing actionable to say two hours ahead.
  const activityAt = ms(extras.excursion?.dateTime);
  if (activityAt != null && extras.excursion?.pickupLocation) {
    out.push({
      key: `${group.key}:activity_reminder`,
      triggerMs: activityAt - ACTIVITY_LEAD_MIN * MIN_MS,
      kind: 'activity_reminder',
      title: c.activityTitle,
      body: c.activityBody(
        extras.excursion.name || extras.excursion.operator || '',
        extras.excursion.pickupLocation,
        clock(activityAt, locale),
      ),
      actionLabel: c.openHotel,
      actionUrl: mapsUrl(extras.excursion.pickupLocation),
      flightKey: first.key,
      urgent: false,
    });
  }

  // ── Car return ─────────────────────────────────────────────────────────────
  const dropAt = ms(extras.carRental?.dropoffTime);
  if (dropAt != null) {
    const place = extras.carRental?.dropoffLocation || extras.carRental?.pickupLocation || '';
    out.push({
      key: `${group.key}:car_return`,
      triggerMs: dayBeforeAt(dropAt, CAR_RETURN_HOUR),
      kind: 'car_return',
      title: c.carReturnTitle,
      // Drive time from the hotel is not here: that needs geocoding and a routing call, neither of which
      // belongs in a pure function. The place and the time are what the data actually holds.
      body: c.carReturnBody(extras.carRental?.company || '', place, dayAndClock(dropAt, locale)),
      actionLabel: place ? c.openHotel : undefined,
      actionUrl: mapsUrl(place),
      flightKey: legs[legs.length - 1].key,
      urgent: false,
    });
  }

  // ── Connection risk ────────────────────────────────────────────────────────
  for (let i = 0; i < legs.length - 1; i++) {
    const arr = times[i].liveArrMs;
    const dep = times[i + 1].depMs;
    if (arr == null || dep == null) continue;
    // Only a real connection: legs a day or more apart are two journeys, not an overstap.
    if (dep - arr > DAY_MS) continue;
    const left = Math.round((dep - arr) / MIN_MS);
    if (left >= CONNECTION_RISK_MIN) continue;
    out.push({
      key: `${group.key}:connection_risk:${legs[i].key}`,
      triggerMs: now,
      kind: 'connection_risk',
      title: c.connectionTitle,
      body: c.connectionBody(numberOf(legs[i]), numberOf(legs[i + 1]), Math.max(0, left)),
      flightKey: legs[i + 1].key,
      urgent: true,
    });
  }

  return out.sort((a, b) => a.triggerMs - b.triggerMs);
}

/** Notification priority per kind, used by lib/schedulePassengerPushes.ts. */
export type MomentPriority = 'max' | 'high' | 'normal';

export function momentPriority(kind: MomentKind): MomentPriority {
  if (kind === 'connection_risk') return 'max';
  if (kind === 'delay_impact' || kind === 'depart_now') return 'high';
  return 'normal';
}

/** Moments that still lie ahead, which are the only ones worth scheduling. */
export function upcomingMoments(moments: TripMoment[], now: number): TripMoment[] {
  return (moments || []).filter(m => m.triggerMs > now);
}
