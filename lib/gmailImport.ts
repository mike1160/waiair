/**
 * What the picked Gmail mails become: flights for the tracker, and a hotel / car / transfer for the trip they
 * belong to. The scan itself only reads headers; a mail's body is fetched when the user imports it, parsed
 * here, and thrown away again — only the parsed fields and the message id are ever stored.
 *
 * Pure (no React Native, no network), so the parsing and the flight matching are unit-tested.
 */
import { parseImportText, parseTripExtras, type ImportCandidate } from './flightImport.ts';
import { joinSplitFlightNumbers } from './gmailMessageText.ts';
import type { TripExtras } from './tripExtras.ts';

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
  return !!(extras.hotel || extras.carRental || extras.transfer);
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
};

/** The day a booking starts: check-in, pick-up, or the transfer's pickup. */
export function extrasAnchorYmd(extras: Partial<TripExtras>): string | null {
  const raw = extras.hotel?.checkIn
    || extras.carRental?.pickupTime
    || extras.transfer?.pickupTime
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

export type ApplyPlan = {
  /** Flights to add to the tracker. */
  flights: ImportCandidate[];
  /** Extras that found their trip. */
  attach: { messageId: string; flightKey: string; extras: Partial<TripExtras> }[];
  /** Extras with no trip (yet): they stay queued and are retried on the next run. */
  orphans: { messageId: string; extras: Partial<TripExtras> }[];
  /** Mails that produced something: only these count as imported. */
  importedIds: string[];
  /** Mails that produced nothing: left pending so a later scan can try again. */
  unparsedIds: string[];
};

/** Turns parsed mails into the work to do, without doing any of it. */
export function planImports(parsed: ParsedMessage[], flights: FlightForMatch[], opts?: { windowDays?: number }): ApplyPlan {
  const plan: ApplyPlan = { flights: [], attach: [], orphans: [], importedIds: [], unparsedIds: [] };
  for (const p of parsed || []) {
    if (p.empty) {
      plan.unparsedIds.push(p.id);
      continue;
    }
    plan.importedIds.push(p.id);
    for (const c of p.flights) plan.flights.push(c);
    if (hasAnyExtras(p.extras)) {
      const key = matchExtrasFlightKey(p.extras, flights, opts);
      if (key) plan.attach.push({ messageId: p.id, flightKey: key, extras: p.extras });
      else plan.orphans.push({ messageId: p.id, extras: p.extras });
    }
  }
  return plan;
}
