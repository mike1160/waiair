/**
 * The confirmations whose trip is already over [W/19].
 *
 * A past-dated confirmation produces no flight to track, so the mail is never written off as imported and
 * the next scan offers it again — ticked in advance, because it is a travel brand confirming a booking and
 * that is exactly what the pre-selection looks for. Importing it does nothing, and the scan after that
 * offers it again. Three mails from last month, every single time.
 *
 * Variant 1a of the three that were on the table: the mail stays on the list and stays tickable, with a
 * label saying why it is not ticked. Hiding it would be the fourth way this app has made a mail disappear
 * without saying so, and the traveller is the only one who can tell a trip that is over from one this app
 * misread.
 *
 * Remembered per message id *and* the date that was rejected, so the record says what was judged rather
 * than only that something was. A mail that now parses to a flight worth tracking is dropped from the
 * memory on the spot (the `cleared` list), which is the one case where this must not get in the way: an
 * airline that moves a flight forward sends the change on the same thread, and the mail that was over
 * yesterday is a trip again today.
 *
 * Pure (no storage, no clock), and unit-tested in lib/flownMails.test.ts.
 */

/** One mail that was looked at and judged already flown, with the date that was judged. */
export type FlownMail = {
  id: string;
  /** The date the confirmation gave, as it was read. Empty when the mail named a flight with no date. */
  dateIso: string;
};

/**
 * How many are kept. The list only has to cover the mails a scan can still turn up, and the scan window is
 * a year at its widest; past that the oldest are dropped rather than growing a store with no ceiling.
 */
export const MAX_FLOWN_MAILS = 200;

function cleanId(raw: unknown): string {
  return String(raw ?? '').trim();
}

/** Only what this was written to hold: an id and a date-shaped string. Anything else is not a record. */
export function isFlownMail(value: unknown): value is FlownMail {
  const v = value as FlownMail | null;
  if (!v || typeof v !== 'object') return false;
  if (!cleanId(v.id)) return false;
  return typeof v.dateIso === 'string';
}

/** Whatever came back out of storage, reduced to the records this can use. */
export function parseFlownMails(raw: unknown): FlownMail[] {
  if (!Array.isArray(raw)) return [];
  const out: FlownMail[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isFlownMail(item)) continue;
    const id = cleanId(item.id);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ id, dateIso: String(item.dateIso || '').slice(0, 10) });
  }
  return out;
}

/**
 * The memory after a run: what was known, plus what this run judged flown, minus the mails that produced
 * something after all.
 *
 * Newest last and capped at the end, so a mail that keeps being offered keeps its place and the oldest
 * records are the ones that fall off. A mail judged flown again simply has its date rewritten — the
 * confirmation may well have been re-read with a different date, and the newer reading is the one that
 * describes what the traveller is being shown.
 */
export function mergeFlownMails(
  known: FlownMail[],
  seen: FlownMail[],
  /** Message ids that produced a flight or a booking this run: no longer anything to warn about. */
  cleared: readonly string[] = [],
): FlownMail[] {
  const drop = new Set((cleared || []).map(cleanId).filter(Boolean));
  const byId = new Map<string, FlownMail>();
  for (const m of parseFlownMails(known)) {
    if (drop.has(m.id)) continue;
    byId.set(m.id, m);
  }
  for (const m of parseFlownMails(seen)) {
    if (drop.has(m.id)) continue;
    // Delete first, so a mail seen again moves to the back of the queue instead of keeping its old place.
    byId.delete(m.id);
    byId.set(m.id, m);
  }
  const all = [...byId.values()];
  return all.length > MAX_FLOWN_MAILS ? all.slice(all.length - MAX_FLOWN_MAILS) : all;
}

/** The ids, for the one question the import screen asks: should this row be ticked in advance? */
export function flownMailIds(list: FlownMail[] | null | undefined): Set<string> {
  return new Set(parseFlownMails(list || []).map(m => m.id));
}

/**
 * The mails to tick in advance: the strong ones, minus the ones already known to be over.
 *
 * Kept here rather than inline on the screen because this is the whole of the behaviour change — a mail in
 * this memory is still in `items`, still in its tier, and still one tap from being imported.
 */
export function preselectIds(
  items: readonly { id: string }[],
  opts: { strong: (id: string) => boolean; flown: Set<string> },
): Set<string> {
  const out = new Set<string>();
  for (const item of items || []) {
    const id = cleanId(item?.id);
    if (!id || opts.flown.has(id)) continue;
    if (opts.strong(id)) out.add(id);
  }
  return out;
}
