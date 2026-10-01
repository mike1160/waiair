/**
 * Why a mail's body never arrived [W/19].
 *
 * The import counts the bodies it could not read as `pending.length - messages.length` — a subtraction, so
 * the number is right and says nothing at all. On iOS a batch of Thai confirmations produced no candidates
 * and on Android 27 mails came back empty, and there was no way to tell a spent token from a 429 from a
 * request that simply never answered. Every failure path in fetchMessageTexts was a bare `continue`.
 *
 * So each one now records the id and the reason. This is a notebook, not a decision: nothing reads it to
 * choose what to do, and fetchMessageTexts returns exactly what it returned before. Until the reasons have
 * been seen on a real device, changing the behaviour would be guessing — and the whole point of the last
 * two of these was that a guess dressed as a diagnosis costs more than the silence did.
 *
 * Ids only, never a subject, a sender or a line of body: this goes on screen and gets photographed.
 *
 * Pure apart from the one capped list, and unit-tested in lib/bodyFetchLog.test.ts.
 */

/** How many reasons are kept and shown. Enough to see a pattern, short enough to stay on the card. */
export const MAX_BODY_FETCH_NOTES = 5;

export type BodyFetchNote = {
  /** The Gmail message id, shortened where it is shown: enough to tell two mails apart. */
  id: string;
  /** Short and technical: 'http 429', 'no token', 'timeout', 'network', 'empty body'. */
  reason: string;
};

let notes: BodyFetchNote[] = [];
/**
 * Counted apart from the notes, because the notes are capped: with six failures and five lines, the count
 * still has to say six. And counted apart from each other, because they are different problems — a body
 * that never arrived is worth fetching again, a body that arrived empty is not.
 */
let unread = 0;
let empty = 0;

/** A fresh notebook for one import run. */
export function startBodyFetchLog(): void {
  notes = [];
  unread = 0;
  empty = 0;
}

function push(id: string, reason: string): void {
  if (notes.length >= MAX_BODY_FETCH_NOTES) return;
  notes.push({ id: String(id || '').trim(), reason: String(reason || 'unknown').slice(0, 40) });
}

/** Records one body that did not arrive. Never throws: a diagnostic may not break the thing it watches. */
export function noteBodyFetch(id: string, reason: string): void {
  unread += 1;
  push(id, reason);
}

/**
 * Records one body that arrived with nothing in it.
 *
 * Not a failed fetch: the mail is returned and parsed like any other, and whatever comes of it is counted as
 * unparsed. It is here because "the body is empty" and "the body never came" look identical from the outside
 * and call for opposite answers, and the Thai confirmations could still be either.
 */
export function noteBodyEmpty(id: string): void {
  empty += 1;
  push(id, 'empty body');
}

export function bodyFetchNotes(): BodyFetchNote[] {
  return [...notes];
}

/** How many bodies never arrived in all, which is not the same as how many reasons were kept. */
export function bodyFetchSeen(): number {
  return unread;
}

/** How many arrived with nothing in them. */
export function bodyEmptySeen(): number {
  return empty;
}

/** An HTTP answer that was not a body. The status is the whole diagnosis: 401 is a token, 429 is a quota. */
export function httpBodyReason(status: number): string {
  const code = Number(status);
  return Number.isFinite(code) && code > 0 ? `http ${Math.trunc(code)}` : 'http ?';
}

/**
 * What a thrown error was. Deliberately four buckets and nothing clever: a timeout, a dead network, a
 * refused request, or something whose own message is the best description available.
 */
export function errorBodyReason(error: unknown): string {
  const message = String((error as Error | null)?.message || error || '').toLowerCase();
  if (!message) return 'error';
  if (message.includes('abort') || message.includes('timeout') || message.includes('timed out')) return 'timeout';
  if (message.includes('network request failed') || message.includes('failed to fetch')) return 'network';
  if (message.includes('offline')) return 'network';
  if (message.includes('json')) return 'bad json';
  return `error: ${message.slice(0, 28)}`;
}

/**
 * The lines the import screen shows, under the counts it already has.
 *
 * Shortened ids, because the full one is 16 hex characters of no use to anyone reading this out loud, and
 * because a shorter line is one that actually fits.
 */
export function bodyFetchLines(
  list: BodyFetchNote[] = bodyFetchNotes(),
  counts: { unread?: number; empty?: number } = { unread: bodyFetchSeen(), empty: bodyEmptySeen() },
): string[] {
  const kept = (list || []).slice(0, MAX_BODY_FETCH_NOTES);
  const notRead = Number(counts?.unread) || 0;
  const wasEmpty = Number(counts?.empty) || 0;
  if (!kept.length && !notRead && !wasEmpty) return [];
  const head = `bodies: ${notRead} unread · ${wasEmpty} empty`
    + (notRead + wasEmpty > kept.length ? ` · first ${kept.length}` : '');
  return [head, ...kept.map(n => `  ${String(n.id || '?').slice(0, 8)} · ${n.reason}`)];
}
