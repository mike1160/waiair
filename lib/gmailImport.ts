/**
 * What the picked Gmail mails become: flights for the tracker, and a hotel / car / transfer for the trip they
 * belong to. The scan itself only reads headers; a mail's body is fetched when the user imports it, parsed
 * here, and thrown away again — only the parsed fields and the message id are ever stored.
 *
 * Pure (no React Native, no network), so the parsing and the flight matching are unit-tested.
 */
import { parseImportText, parseTripExtras, type ImportCandidate } from './flightImport.ts';
import { joinSplitFlightNumbers } from './gmailMessageText.ts';
import { bestTrip, linkDecision, type GmailItem, type LinkedBy, type Trip } from './matchScore.ts';
import { placeFromText } from './placeText.ts';
import type { GmailItemKind } from './gmailInboxScan.ts';
import type { TripExtras } from './tripExtrasModel.ts';

/** A fetched mail: its id, the subject, and the body already flattened to text. */
export type ImportedMessage = {
  id: string;
  subject?: string;
  /** The `From:` header, which decides how far a flight number in this mail is trusted. */
  from?: string;
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
    /*
     * The sender and the source were left out here, so every flight out of Gmail was scored as if it came
     * from nowhere in particular: 85 with a date, which is exactly the threshold, and below it the moment
     * anything else was missing. An airline's own confirmation now scores what it is worth.
     */
    const flights = parseImportText(text, undefined, { from: m.from, source: 'gmail' })
      .filter(c => !(today && c.dateIso && c.dateIso < today));
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
  /** Where this flight lands: the place half of the score (lib/matchScore.ts). */
  destinationIata?: string;
  destinationCity?: string;
  destinationCountry?: string;
  /**
   * Last day of the stay — normally the day the return leg leaves. Without it the trip is one day long, and
   * a dinner booked for the fourth evening scores nothing for its date.
   */
  endYmd?: string;
};

/** A tracked flight as the matcher sees it, or null when it has no day to anchor on. */
export function tripFromFlight(f: FlightForMatch): Trip | null {
  const start = f?.arrivalYmd || f?.departureYmd || '';
  if (!f?.key || !start) return null;
  return {
    key: f.key,
    startDate: start,
    endDate: f.endYmd || start,
    destinationCity: f.destinationCity || '',
    destinationCountry: f.destinationCountry || '',
    destinationIata: f.destinationIata || '',
  };
}

/**
 * Which kind a parsed mail counts as, and the text that says where it is.
 *
 * One mail can hold several bookings; the first one present decides, in the order the anchor day is read
 * (extrasAnchorYmd) so the kind and the date always describe the same booking. A transfer counts as
 * 'transport', the kind the scanner uses for anything on rails, roads or water.
 */
const EXTRAS_READERS: {
  kind: GmailItemKind;
  has: (e: Partial<TripExtras>) => boolean;
  date: (e: Partial<TripExtras>) => string | undefined;
  where: (e: Partial<TripExtras>) => (string | undefined)[];
}[] = [
  {
    kind: 'hotel',
    has: e => !!e.hotel,
    date: e => e.hotel?.checkIn,
    where: e => [e.hotel?.address, e.hotel?.name],
  },
  {
    kind: 'carRental',
    has: e => !!e.carRental,
    date: e => e.carRental?.pickupTime,
    where: e => [e.carRental?.pickupLocation, e.carRental?.company],
  },
  {
    kind: 'transport',
    has: e => !!e.transfer,
    date: e => e.transfer?.pickupTime,
    where: e => [e.transfer?.pickupLocation, e.transfer?.provider],
  },
  {
    kind: 'excursion',
    has: e => !!e.excursion,
    date: e => e.excursion?.dateTime,
    where: e => [e.excursion?.pickupLocation, e.excursion?.name, e.excursion?.operator],
  },
  {
    kind: 'restaurant',
    has: e => !!e.restaurant,
    date: e => e.restaurant?.dateTime,
    where: e => [e.restaurant?.address, e.restaurant?.name],
  },
];

/** A parsed mail as the matcher sees it: a kind, a day, and wherever its text says it is. */
export function gmailItemFromExtras(messageId: string, extras: Partial<TripExtras>): GmailItem {
  const reader = EXTRAS_READERS.find(r => r.has(extras));
  if (!reader) return { id: messageId, kind: 'hotel' };
  const place = placeFromText(...reader.where(extras));
  return {
    id: messageId,
    kind: reader.kind,
    date: reader.date(extras) || undefined,
    city: place.city,
    country: place.country,
    airportIata: place.airportIata,
  };
}

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
 * A booking sitting in the waiting queue: parsed, but not on a trip yet. Mirrors OrphanExtras in
 * lib/gmailInboxStore.ts, which is where the queue is kept.
 */
export type WaitingBooking = {
  messageId: string;
  extras: Partial<TripExtras>;
  savedMs?: number;
  /** Set while the booking is only a suggestion (the 'suggest' tier), so it can be offered again. */
  suggestedFlightKey?: string;
  matchScore?: number;
};

/** A queued booking on its way back to storage: it always carries the day it was first queued. */
export type SettledWaiting = WaitingBooking & { savedMs: number };

export type Resettled = {
  /** Bookings that now belong to a trip and can be attached without asking. */
  attach: AttachPlan[];
  /** The queue as it should be stored afterwards: what still waits, suggestions included. */
  queue: SettledWaiting[];
  autoLinked: number;
  suggested: number;
  waiting: number;
};

/**
 * Scores the waiting queue against the flights that are tracked *now*, and says what to do with each booking.
 *
 * This is the whole of the re-match: after a Gmail scan, and again the moment a flight is added by hand. A
 * hotel that arrived in the mailbox before its flight was tracked has been waiting for exactly this, and the
 * same run also re-reads the suggestions — a better flight can turn yesterday's maybe into a link, and a
 * booking whose flight is gone drops back to waiting.
 *
 * The day a booking was first queued is carried over, so nothing loses its place in the 90-day queue by
 * being looked at again.
 */
export function resettleWaiting(queue: WaitingBooking[], flights: FlightForMatch[], now = Date.now()): Resettled {
  const list = (queue || []).filter(q => q && q.messageId && q.extras);
  const savedAt = new Map<string, number>();
  for (const q of list) savedAt.set(q.messageId, Number(q.savedMs) || now);

  // One booking, however many mails brought it: the fullest wins, as everywhere else.
  const kept = dedupeByBookingRef(list.map(q => ({ messageId: q.messageId, extras: q.extras }))).kept;
  const plan = planImports(
    kept.map(k => ({ id: k.messageId, flights: [], extras: k.extras, empty: false })),
    flights,
  );

  const stays = (messageId: string, extras: Partial<TripExtras>, suggestion?: AttachPlan): SettledWaiting => ({
    messageId,
    extras,
    savedMs: savedAt.get(messageId) ?? now,
    ...(suggestion ? { suggestedFlightKey: suggestion.flightKey, matchScore: suggestion.matchScore } : {}),
  });

  return {
    attach: plan.attach,
    queue: [
      ...plan.orphans.map(o => stays(o.messageId, o.extras)),
      ...plan.suggest.map(a => stays(a.messageId, a.extras, a)),
    ],
    autoLinked: plan.attach.length,
    suggested: plan.suggest.length,
    waiting: plan.orphans.length,
  };
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
  /** How sure the match was (lib/matchScore.ts); absent when the booking reference decided it. */
  matchScore?: number;
  /** 'auto' for a link made without asking, 'suggestion' for one the traveller still has to accept. */
  linkedBy?: LinkedBy;
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
  /** Extras that found their trip and are attached without asking (score >= AUTO_LINK_MIN). */
  attach: AttachPlan[];
  /** Extras that probably belong to a trip (score >= SUGGEST_MIN) but want a yes first. */
  suggest: AttachPlan[];
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
export function planImports(parsed: ParsedMessage[], flights: FlightForMatch[]): ApplyPlan {
  const plan: ApplyPlan = {
    flights: [], flightsAutoImport: [], flightsPendingReview: [],
    attach: [], suggest: [], orphans: [], importedIds: [], unparsedIds: [],
  };
  const trips = (flights || []).map(tripFromFlight).filter((t): t is Trip => !!t);
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
    // How well does this booking fit any tracked trip? The score decides what happens to it: attach it,
    // offer it, or leave it in the queue (lib/matchScore.ts).
    const { trip, score } = bestTrip(gmailItemFromExtras(b.messageId, b.extras), trips);
    const tier = trip ? linkDecision(score) : 'inbox';
    if (tier === 'auto' && trip) {
      plan.attach.push({
        messageId: b.messageId, flightKey: trip.key, extras: b.extras, matchScore: score, linkedBy: 'auto',
      });
    } else if (tier === 'suggest' && trip) {
      plan.suggest.push({
        messageId: b.messageId, flightKey: trip.key, extras: b.extras, matchScore: score, linkedBy: 'suggestion',
      });
    } else {
      plan.orphans.push(b);
    }
  }
  plan.flights = [...plan.flightsAutoImport, ...plan.flightsPendingReview];
  return plan;
}
