/**
 * What has already been added, for as long as the app is open [S/1].
 *
 * Tapping "Add to calendar" gave a toast and then looked exactly as it had before, so there was no way to
 * tell a flight that was in the calendar from one that was not — and the honest response to that is to tap
 * it again, which is how people end up with the same flight in their calendar three times.
 *
 * The memory is deliberately shallow. It lives in this module and nowhere else: it survives a card
 * scrolling out of view and back, a screen being left and returned to, the flight page being opened twice —
 * and it is gone when the app is. That is the right lifetime. A calendar entry can be deleted by the person
 * who made it, and an app that still insists a year later that it added something is wrong more often than
 * it is right.
 *
 * Pure apart from the module-level set, and unit-tested in lib/addedThisSession.test.ts.
 */

export type AddedKind = 'calendar' | 'wallet';

const added = new Set<string>();

/** One key per thing: the kind, and whatever identifies what it was added for. */
function keyOf(kind: AddedKind, id: string): string {
  return `${kind}|${String(id || '').trim().toUpperCase()}`;
}

/** Remember that this was added. Anything without an id is not remembered — it could not be told apart. */
export function markAdded(kind: AddedKind, id: string): void {
  if (!String(id || '').trim()) return;
  added.add(keyOf(kind, id));
}

export function wasAdded(kind: AddedKind, id: string): boolean {
  if (!String(id || '').trim()) return false;
  return added.has(keyOf(kind, id));
}

/** For tests, and for a sign-out that should not carry one account's state into the next. */
export function clearAdded(): void {
  added.clear();
}

/**
 * The id for a set of flights going into the calendar together: one flight is itself, a whole trip is all
 * of them, so adding one leg and adding the trip are remembered as the different things they are.
 */
export function calendarId(flightNumbers: (string | undefined)[], dateIso?: string): string {
  const numbers = (flightNumbers || [])
    .map(n => String(n || '').replace(/\s+/g, '').toUpperCase())
    .filter(Boolean);
  if (!numbers.length) return '';
  return `${numbers.join('+')}${dateIso ? `@${dateIso.slice(0, 10)}` : ''}`;
}
