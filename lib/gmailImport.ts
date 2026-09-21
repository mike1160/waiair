/**
 * What the picked Gmail mails become: flights for the tracker, and a hotel / car / transfer for the trip they
 * belong to. The scan itself only reads headers; a mail's body is fetched when the user imports it, parsed
 * here, and thrown away again — only the parsed fields and the message id are ever stored.
 *
 * Pure (no React Native, no network), so the parsing and the flight matching are unit-tested.
 */
import { parseImportText, parseTripExtras, type ImportCandidate } from './flightImport.ts';
import { joinSplitFlightNumbers } from './gmailMessageText.ts';
import type { TripExtras } from './tripExtrasModel.ts';

/** A fetched mail: its id, the subject, and the body already flattened to text. */
export type ImportedMessage = {
  id: string;
  subject?: string;
  text: string;
};

export type ParsedMessage = {
  id: string;
  flights: ImportCandidate[];
  extras: Partial<TripExtras>;
  /** Nothing usable in this mail: it stays unimported, so a later scan can try again. */
  empty: boolean;
};

function hasAnyExtras(extras: Partial<TripExtras>): boolean {
  return !!(extras.hotel || extras.carRental || extras.transfer || extras.excursion || extras.restaurant);
}

/**
 * Parses each mail into flights and trip extras. The subject is parsed along with the body: several senders
 * put the hotel name or the flight number only in the subject line.
 */
export function parseImportedMessages(
  messages: ImportedMessage[],
  opts?: { todayIso?: string },
): ParsedMessage[] {
  const today = opts?.todayIso;
  return (messages || []).filter(m => m && m.id).map(m => {
    const text = joinSplitFlightNumbers(`${m.subject || ''}\n${m.text || ''}`);
    const flights = parseImportText(text).filter(c => !(today && c.dateIso && c.dateIso < today));
    const extras = parseTripExtras(text);
    return { id: m.id, flights, extras, empty: !flights.length && !hasAnyExtras(extras) };
  });
}

/** The tracked flights a hotel or car can belong to. */
export type FlightForMatch = {
  key: string;
  /** Arrival day (yyyy-MM-dd) — a hotel is booked around the day you land. */
  arrivalYmd?: string;
  /** Departure day, used when there is no arrival. */
  departureYmd?: string;
  /** Booking references already on this trip (see bookingRefKeys), so a change mail goes back to it. */
  refs?: string[];
};

/**
 * A booking reference, stripped to letters and digits so "ABC-123 " and "abc123" are the same booking.
 * Short ones ("1", "OK") are no reference at all: they would collapse unrelated bookings.
 */
function normalizeRef(ref?: string): string | null {
  const s = String(ref || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length >= 4 ? s : null;
}

/**
 * How a booking is recognised across mails: the confirmation, the reminder and the change mail all carry the
 * same reference. Kept per kind, so a hotel and a car with the same number are still two bookings.
 */
export function bookingRefKeys(extras?: Partial<TripExtras> | null): string[] {
  const out: string[] = [];
  const hotel = normalizeRef(extras?.hotel?.confirmationRef);
  if (hotel) out.push(`hotel:${hotel}`);
  const car = normalizeRef(extras?.carRental?.confirmationRef);
  if (car) out.push(`car:${car}`);
  const transfer = normalizeRef(extras?.transfer?.confirmationRef);
  if (transfer) out.push(`transfer:${transfer}`);
  const excursion = normalizeRef(extras?.excursion?.confirmationRef);
  if (excursion) out.push(`excursion:${excursion}`);
  const restaurant = normalizeRef(extras?.restaurant?.confirmationRef);
  if (restaurant) out.push(`restaurant:${restaurant}`);
  return out;
}

/** How much a parsed mail actually says: of two mails about one booking, the fuller one wins. */
export function extrasFieldCount(extras?: Partial<TripExtras> | null): number {
  let n = 0;
  for (const slot of [extras?.hotel, extras?.carRental, extras?.transfer, extras?.excursion, extras?.restaurant]) {
    if (!slot) continue;
    for (const [field, value] of Object.entries(slot)) {
      if (field === 'source') continue;
      if (String(value ?? '').trim()) n += 1;
    }
  }
  return n;
}

/** A booking on its way in, or waiting for a trip. */
export type BookingRecord = { messageId: string; extras: Partial<TripExtras> };

/**
 * One record per booking reference. Booking.com and the like send a confirmation, a reminder and a change mail
 * for the same stay; without this the trip would collect three copies and the result screen would count three.
 * The fullest record wins, ties go to the first (the queue keeps the one that was already waiting). Records
 * without a usable reference are all kept — there is no safe way to tell them apart.
 */
export function dedupeByBookingRef<T extends BookingRecord>(records: T[]): { kept: T[]; droppedIds: string[] } {
  const kept: T[] = [];
  const droppedIds: string[] = [];
  const byRef = new Map<string, number>();
  for (const r of records || []) {
    if (!r) continue;
    const keys = bookingRefKeys(r.extras);
    const at = keys.map(k => byRef.get(k)).find(i => i != null);
    if (at == null) {
      const index = kept.push(r) - 1;
      for (const k of keys) byRef.set(k, index);
      continue;
    }
    if (extrasFieldCount(r.extras) > extrasFieldCount(kept[at].extras)) {
      droppedIds.push(kept[at].messageId);
      kept[at] = r;
      for (const k of bookingRefKeys(r.extras)) byRef.set(k, at);
    } else {
      droppedIds.push(r.messageId);
    }
  }
  return { kept, droppedIds };
}

/**
 * The day a booking starts: check-in, pick-up, the transfer's pickup, or — for the kinds that have no other
 * clock — the activity or the sitting itself. Without one of these the booking can never be matched to a
 * flight and would sit in the orphan queue for good.
 */
export function extrasAnchorYmd(extras: Partial<TripExtras>): string | null {
  const raw = extras.hotel?.checkIn
    || extras.carRental?.pickupTime
    || extras.transfer?.pickupTime
    || extras.excursion?.dateTime
    || extras.restaurant?.dateTime
    || '';
  const m = String(raw).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function daysBetween(a: string, b: string): number | null {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return null;
  return Math.round(Math.abs(ta - tb) / 86_400_000);
}

export const MATCH_WINDOW_DAYS = 3;

/**
 * The trip that already holds this booking reference. A changed booking ("your check-in moved") then goes back
 * to the trip it belongs to, even when the new dates fall outside the window around the flight.
 */
export function flightKeyByBookingRef(extras: Partial<TripExtras>, flights: FlightForMatch[]): string | null {
  const keys = bookingRefKeys(extras);
  if (!keys.length) return null;
  for (const f of flights || []) {
    if (!f?.key || !f.refs?.length) continue;
    if (f.refs.some(r => keys.includes(r))) return f.key;
  }
  return null;
}

/**
 * Which tracked flight a hotel / car / transfer belongs to: the one landing closest to the day the booking
 * starts, at most `windowDays` apart. Null when nothing is close enough — the booking then waits in the queue
 * until such a flight is tracked, rather than being attached to the wrong trip.
 */
export function matchExtrasFlightKey(
  extras: Partial<TripExtras>,
  flights: FlightForMatch[],
  opts?: { windowDays?: number },
): string | null {
  const anchor = extrasAnchorYmd(extras);
  if (!anchor) return null;
  const window = opts?.windowDays ?? MATCH_WINDOW_DAYS;
  let best: { key: string; days: number; ymd: string } | null = null;
  for (const f of flights || []) {
    const ymd = f.arrivalYmd || f.departureYmd;
    if (!f.key || !ymd) continue;
    const days = daysBetween(anchor, ymd);
    if (days == null || days > window) continue;
    // Closest wins; on a tie the earlier flight, so a return leg never steals the outbound's hotel.
    if (!best || days < best.days || (days === best.days && ymd < best.ymd)) best = { key: f.key, days, ymd };
  }
  return best ? best.key : null;
}

/** What an import actually produced — the numbers the success screen reports. */
export type ImportOutcome = {
  flightsAdded: number;
  bookingsAttached: number;
  /** A booking the trip already had, brought up to date from a later mail. */
  bookingsUpdated: number;
  /** Parsed, but no trip to hang it on yet: kept and retried later. */
  bookingsWaiting: number;
  /** Mails that gave nothing, or could not be read: they stay pending for the next scan. */
  failed: number;
};

export function isEmptyOutcome(o: ImportOutcome): boolean {
  return !o.flightsAdded && !o.bookingsAttached && !o.bookingsUpdated && !o.bookingsWaiting && !o.failed;
}

export type AttachPlan = {
  messageId: string;
  flightKey: string;
  extras: Partial<TripExtras>;
  /** Recognised by its booking reference: the trip already has it, this mail only refreshes it. */
  update?: boolean;
};

/**
 * From this score up a candidate is trusted enough to track without asking. Below it the flight is real
 * enough to show, but the user decides — see flightsPendingReview.
 */
export const AUTO_IMPORT_THRESHOLD = 85;

export type ApplyPlan = {
  /** Flights to add to the tracker: the auto-import ones first, then the ones awaiting review. */
  flights: ImportCandidate[];
  /** Confidence >= AUTO_IMPORT_THRESHOLD: tracked straight away. */
  flightsAutoImport: ImportCandidate[];
  /** Below the threshold: offered on the discovery card instead of tracked. */
  flightsPendingReview: ImportCandidate[];
  /** Extras that found their trip. */
  attach: AttachPlan[];
  /** Extras with no trip (yet): they stay queued and are retried on the next run. */
  orphans: BookingRecord[];
  /** Mails that produced something: only these count as imported. */
  importedIds: string[];
  /** Mails that produced nothing: left pending so a later scan can try again. */
  unparsedIds: string[];
};

/**
 * The plan, counted up. The caller passes the real numbers when it also applied the waiting queue: `attached`
 * and `updated` then cover both batches, and `waiting` is the queue that is left.
 */
export function summarizeImport(
  plan: ApplyPlan,
  opts?: { attached?: number; updated?: number; waiting?: number; unreadable?: number },
): ImportOutcome {
  return {
    // Only the auto-imported flights were actually tracked; the ones awaiting review are not added yet.
    flightsAdded: plan.flightsAutoImport.length,
    bookingsAttached: opts?.attached ?? plan.attach.filter(a => !a.update).length,
    bookingsUpdated: opts?.updated ?? plan.attach.filter(a => a.update).length,
    bookingsWaiting: opts?.waiting ?? plan.orphans.length,
    failed: plan.unparsedIds.length + (opts?.unreadable ?? 0),
  };
}

/** Turns parsed mails into the work to do, without doing any of it. */
export function planImports(parsed: ParsedMessage[], flights: FlightForMatch[], opts?: { windowDays?: number }): ApplyPlan {
  const plan: ApplyPlan = {
    flights: [], flightsAutoImport: [], flightsPendingReview: [],
    attach: [], orphans: [], importedIds: [], unparsedIds: [],
  };
  const bookings: BookingRecord[] = [];
  for (const p of parsed || []) {
    if (p.empty) {
      plan.unparsedIds.push(p.id);
      continue;
    }
    plan.importedIds.push(p.id);
    for (const c of p.flights) {
      if (c.confidence >= AUTO_IMPORT_THRESHOLD) plan.flightsAutoImport.push(c);
      else plan.flightsPendingReview.push(c);
    }
    if (hasAnyExtras(p.extras)) bookings.push({ messageId: p.id, extras: p.extras });
  }
  // Several mails about one booking: only the fullest is applied. The others are parsed and done with.
  for (const b of dedupeByBookingRef(bookings).kept) {
    const known = flightKeyByBookingRef(b.extras, flights);
    if (known) {
      plan.attach.push({ messageId: b.messageId, flightKey: known, extras: b.extras, update: true });
      continue;
    }
    const key = matchExtrasFlightKey(b.extras, flights, opts);
    if (key) plan.attach.push({ messageId: b.messageId, flightKey: key, extras: b.extras });
    else plan.orphans.push(b);
  }
  plan.flights = [...plan.flightsAutoImport, ...plan.flightsPendingReview];
  return plan;
}
