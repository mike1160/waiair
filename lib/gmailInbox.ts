/**
 * The travel-mail inbox: what was found, what happened to it, and what is still waiting for an answer.
 *
 * Until now a booking found in Gmail had two possible fates and no memory of either. It waited in the queue
 * (lib/gmailInboxStore.ts), or it was merged into a trip and forgotten — the mail's id went on the
 * already-imported list and nothing recorded which trip it had joined. Saying no to a booking was not
 * possible at all; it simply stayed in the queue for ninety days.
 *
 * So an item now carries a status, and the two ends of its life are written down:
 *
 *   waiting / suggested  still in the queue, the scan's own working set
 *   linked               on a trip, with which trip, when, and whether the app or the traveller decided
 *   ignored              deliberately put aside, and restorable
 *
 * Everything here is pure: reading, counting, filtering and the transitions between those states. The queue
 * and the decisions are stored elsewhere, and the screen does the drawing.
 */

import { gmailItemFromExtras, type WaitingBooking } from './gmailImport.ts';
import type { GmailItemKind } from './gmailInboxScan.ts';
import type { TripExtras } from './tripExtrasModel.ts';
import type { LinkedBy } from './matchScore.ts';

export type InboxStatus = 'waiting' | 'suggested' | 'linked' | 'ignored';

/** The three tabs. 'new' holds both of the statuses that still want an answer. */
export type InboxTab = 'new' | 'linked' | 'ignored';

export type InboxSort = 'newest' | 'tripDate';

/** One travel mail, as the inbox knows it. */
export interface InboxItem {
  messageId: string;
  kind: GmailItemKind;
  /** The hotel, company or activity name; '' when the mail never said one. */
  title: string;
  /** yyyy-MM-dd of the day the booking is for, or '' when the mail had no date. */
  startYmd: string;
  /** Where it is, when the booking said: a city, an airport or an address fragment. */
  place: string;
  status: InboxStatus;
  /** When the mail was first queued. */
  savedMs: number;
  /** For 'suggested': the trip it probably belongs to, and how sure that was. */
  suggestedFlightKey?: string;
  matchScore?: number;
  /** For 'linked': which trip, when, and who decided. */
  linkedToTripKey?: string;
  linkedBy?: LinkedBy;
  linkedAt?: number;
  /** For 'ignored': when it was put aside. */
  ignoredAt?: number;
  /** Kept so a linked or restored item can still be attached to a trip. */
  extras?: Partial<TripExtras>;
}

export const INBOX_TABS: InboxTab[] = ['new', 'linked', 'ignored'];

/** Which tab an item belongs in. */
export function tabOf(status: InboxStatus): InboxTab {
  if (status === 'linked') return 'linked';
  if (status === 'ignored') return 'ignored';
  return 'new';
}

/** Items still wanting an answer — what the envelope in the header counts. */
export function unprocessed(items: InboxItem[]): InboxItem[] {
  return (items || []).filter(i => i && tabOf(i.status) === 'new');
}

/**
 * What the envelope wears: the number still waiting, or a quiet dot once everything has been dealt with.
 *
 * Null before the first scan — an envelope with a dot on an inbox nobody has ever filled would be claiming
 * something it does not know.
 */
export type InboxBadge = { kind: 'count'; n: number } | { kind: 'dot' } | null;

export function inboxBadge(items: InboxItem[], opts?: { scanned?: boolean }): InboxBadge {
  const list = items || [];
  const waiting = unprocessed(list).length;
  if (waiting > 0) return { kind: 'count', n: waiting };
  if (list.length > 0 || opts?.scanned) return { kind: 'dot' };
  return null;
}

/** The filter chips, and the kinds each one covers. */
export type InboxFilter = 'all' | 'flights' | 'hotels' | 'stay' | 'transport' | 'activities' | 'other';

export const INBOX_FILTERS: InboxFilter[] = [
  'all', 'flights', 'hotels', 'stay', 'transport', 'activities', 'other',
];

const FILTER_KINDS: Record<Exclude<InboxFilter, 'all' | 'other'>, GmailItemKind[]> = {
  flights: ['flight', 'extraBaggage', 'specialAssistance', 'mealOrder', 'inflightPurchase',
    'cabinUpgrade', 'petReservation', 'lounge'],
  hotels: ['hotel'],
  stay: ['hostel', 'bandB', 'vacationRental', 'camping', 'boatRental'],
  transport: ['carRental', 'transfer', 'parking', 'ferry', 'cruise', 'transport'],
  activities: ['excursion', 'restaurant', 'event', 'course', 'diving', 'bikeRental', 'adventure',
    'experience', 'wellness', 'sport'],
};

/** Everything no chip above claims falls under "other" — insurance, visas, and whatever is added next. */
export function filterOf(kind: GmailItemKind): Exclude<InboxFilter, 'all'> {
  for (const [name, kinds] of Object.entries(FILTER_KINDS)) {
    if (kinds.includes(kind)) return name as Exclude<InboxFilter, 'all' | 'other'>;
  }
  return 'other';
}

export function matchesFilter(item: InboxItem, filter: InboxFilter): boolean {
  if (filter === 'all') return true;
  return filterOf(item.kind) === filter;
}

/** Folded for searching: lower case, accents flattened, so "Zürich" is found by typing "zurich". */
function fold(s: string): string {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}

/**
 * Does this item answer the search? Name, place and the kind itself are searched — the kind through the
 * label the caller passes, so "hotel" finds hotels in whatever language the app is in.
 */
export function matchesQuery(item: InboxItem, query: string, kindLabel?: (k: GmailItemKind) => string): boolean {
  const q = fold(query);
  if (!q) return true;
  const hay = [item.title, item.place, item.kind, kindLabel?.(item.kind) || '', item.startYmd]
    .map(fold)
    .join(' ');
  return q.split(/\s+/).every(word => hay.includes(word));
}

function sortValue(item: InboxItem, sort: InboxSort): number {
  if (sort === 'tripDate') {
    const t = Date.parse(`${item.startYmd}T00:00:00Z`);
    // A booking with no date sorts last rather than leading the list from 1970.
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  }
  return -(Number(item.savedMs) || 0);
}

/** The list one tab shows: its own items, searched, filtered and sorted. */
export function inboxList(
  items: InboxItem[],
  opts: { tab: InboxTab; query?: string; filter?: InboxFilter; sort?: InboxSort; kindLabel?: (k: GmailItemKind) => string },
): InboxItem[] {
  const sort = opts.sort || 'newest';
  return (items || [])
    .filter(i => !!i && !!i.messageId)
    .filter(i => tabOf(i.status) === opts.tab)
    .filter(i => matchesFilter(i, opts.filter || 'all'))
    .filter(i => matchesQuery(i, opts.query || '', opts.kindLabel))
    .sort((a, b) => sortValue(a, sort) - sortValue(b, sort));
}

/** How many items each tab holds, for the tab labels. */
export function tabCounts(items: InboxItem[]): Record<InboxTab, number> {
  const out: Record<InboxTab, number> = { new: 0, linked: 0, ignored: 0 };
  for (const item of items || []) {
    if (item?.messageId) out[tabOf(item.status)] += 1;
  }
  return out;
}

/* ── The transitions ─────────────────────────────────────────────────────────────────────────────── */

/** Onto a trip. Keeps what it was suggested against, so a wrong guess can still be read back. */
export function linkItem(item: InboxItem, tripKey: string, by: LinkedBy, now: number): InboxItem {
  return {
    ...item,
    status: 'linked',
    linkedToTripKey: tripKey,
    linkedBy: by,
    linkedAt: now,
    ignoredAt: undefined,
  };
}

/** Put aside on purpose. Nothing is thrown away: it can be brought back from the ignored tab. */
export function ignoreItem(item: InboxItem, now: number): InboxItem {
  return {
    ...item,
    status: 'ignored',
    ignoredAt: now,
    linkedToTripKey: undefined,
    linkedBy: undefined,
    linkedAt: undefined,
  };
}

/**
 * Back to the new tab, from either end. A suggestion that was linked returns as a suggestion, so the app
 * does not forget what it thought — the traveller disagreed with the link, not with the guess.
 */
export function unlinkItem(item: InboxItem): InboxItem {
  return {
    ...item,
    status: item.suggestedFlightKey ? 'suggested' : 'waiting',
    linkedToTripKey: undefined,
    linkedBy: undefined,
    linkedAt: undefined,
    ignoredAt: undefined,
  };
}

/** Applies one change to the list, leaving the rest as they were. */
export function replaceItem(items: InboxItem[], next: InboxItem): InboxItem[] {
  let found = false;
  const out = (items || []).map(i => {
    if (i?.messageId !== next.messageId) return i;
    found = true;
    return next;
  });
  return found ? out : [...out, next];
}

export function removeItem(items: InboxItem[], messageId: string): InboxItem[] {
  return (items || []).filter(i => i?.messageId !== messageId);
}

/* ── From the queue to the inbox ─────────────────────────────────────────────────────────────────── */

/** What to call a booking: whatever name its mail gave, or nothing rather than a guess. */
export function titleOf(extras: Partial<TripExtras> | undefined): string {
  const e = extras || {};
  return String(
    e.hotel?.name
    || e.carRental?.company
    || e.transfer?.provider
    || e.excursion?.name
    || e.restaurant?.name
    || '',
  ).trim();
}

/** Where it is, in the words the mail used: a city if one could be read, else the address it came with. */
export function placeOf(extras: Partial<TripExtras> | undefined, city?: string): string {
  if (city) return city;
  const e = extras || {};
  return String(
    e.hotel?.address
    || e.carRental?.pickupLocation
    || e.transfer?.pickupLocation
    || e.excursion?.pickupLocation
    || e.restaurant?.address
    || '',
  ).trim();
}

/**
 * The queue as the inbox sees it: still-waiting bookings, each with the kind, day and place already worked
 * out for matching (lib/gmailImport.ts), so the two views cannot disagree about what a mail is.
 */
export function itemsFromQueue(queue: WaitingBooking[]): InboxItem[] {
  return (queue || [])
    .filter(q => q && q.messageId)
    .map(q => {
      const read = gmailItemFromExtras(q.messageId, q.extras || {});
      return {
        messageId: q.messageId,
        kind: read.kind,
        title: titleOf(q.extras),
        startYmd: String(read.date || '').slice(0, 10),
        place: placeOf(q.extras, read.city),
        status: q.suggestedFlightKey ? ('suggested' as const) : ('waiting' as const),
        savedMs: Number(q.savedMs) || 0,
        suggestedFlightKey: q.suggestedFlightKey,
        matchScore: q.matchScore,
        extras: q.extras,
      };
    });
}

/**
 * The whole inbox: what is still queued, plus the decisions already taken.
 *
 * The queue is the pipeline's own working set and wins where both know a mail — a booking that came back in
 * a later scan is waiting again, whatever was once decided about it.
 */
export function mergeInbox(queue: WaitingBooking[], decided: InboxItem[]): InboxItem[] {
  const fromQueue = itemsFromQueue(queue);
  const queued = new Set(fromQueue.map(i => i.messageId));
  return [
    ...fromQueue,
    ...(decided || []).filter(d => d?.messageId && !queued.has(d.messageId)),
  ];
}
