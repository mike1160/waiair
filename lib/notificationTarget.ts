/**
 * Where a tapped notification should land: which flight, and what to do when that flight is not known yet.
 *
 * The routing itself was already here (lib/notificationDeepLink.ts parses the payload, App.tsx opens the
 * detail card). What was missing is the honest answer to "and if the flight cannot be found?", and that gap
 * is [B17]: a tap that resolved to nothing returned early and left the traveller on the home screen, *and*
 * never queued the route for a second try. At a cold start that is every tap — the tracked list is still
 * being read from storage when the notification arrives — and for a Family Safety Mode push it is every tap
 * full stop, because that payload carries only a flightKey and no flight number to fall back on.
 *
 * So there are three answers, not two:
 *
 *   detail   the flight is in hand — open its card
 *   stub     a flight number but nothing to match it to — open a placeholder card and keep looking
 *   home     nothing usable at all — the old behaviour, and the only case that should ever reach it
 *
 * The last two both say `defer: true`: the route is kept so the retry can resolve it the moment the tracked
 * list arrives. Deciding this in one pure place means the rule can be tested; App.tsx does the navigating.
 */

import { parseNotificationData, type DetailFocusSection, type ParsedNotificationRoute } from './notificationDeepLink.ts';

/** A tracked flight, as much of it as the matching needs. */
export interface TrackedCandidate {
  key: string;
  flightNumber: string;
  flightId?: string;
}

/** A row from the airport board being shown. */
export interface BoardCandidate {
  id: string;
  number: string;
}

export type NotificationMatch =
  | { where: 'tracked'; index: number }
  | { where: 'board'; index: number };

export type NotificationTarget =
  /** The Gmail auto-sync notification, which has no flight at all. */
  | { screen: 'gmailImport' }
  /** Open this flight's detail card. */
  | { screen: 'detail'; match: NotificationMatch; route: ParsedNotificationRoute; focusSection: DetailFocusSection | null; defer: false }
  /** Open a placeholder card for this number and resolve it when the tracked list loads. */
  | { screen: 'stub'; flightNumber: string; route: ParsedNotificationRoute; focusSection: DetailFocusSection | null; defer: true }
  /** Nothing to open. `defer` says whether it is still worth retrying once the lists are in. */
  | { screen: 'home'; route: ParsedNotificationRoute | null; defer: boolean };

function slug(raw: unknown): string {
  return String(raw || '').replace(/\s+/g, '').toUpperCase();
}

/** Is this the Gmail auto-sync payload? It is the one notification that is not about a flight. */
export function isGmailImportNotification(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object') return false;
  return String((raw as Record<string, unknown>).gmailImport || '') === '1';
}

/**
 * The flight a route points at, by key, then by id, then by number.
 *
 * The order is three separate passes, and that matters. Matching all three at once — one `find` with an OR,
 * which is what this replaced — lets the *first* flight that happens to share the number win before a later
 * flight holding the exact key is ever considered. Two legs of the same rotation carry the same number, so a
 * gate change for next week's BR75 opened last week's. A key is exact and is the only thing that can tell
 * those two apart, so it gets the whole list to itself before the number is tried at all.
 */
export function findNotificationMatch(
  route: ParsedNotificationRoute,
  tracked: TrackedCandidate[],
  board: BoardCandidate[],
): NotificationMatch | null {
  const list = (tracked || []).filter(Boolean);
  const rows = (board || []).filter(Boolean);
  const num = route.flightNumber;

  const passes: Array<(t: TrackedCandidate) => boolean> = [];
  if (route.flightKey) passes.push(t => t.key === route.flightKey);
  if (route.flightId) passes.push(t => t.key === route.flightId || t.flightId === route.flightId);
  if (num) passes.push(t => slug(t.flightNumber) === num);
  for (const matches of passes) {
    const i = list.findIndex(matches);
    if (i >= 0) return { where: 'tracked', index: i };
  }

  const boardPasses: Array<(f: BoardCandidate) => boolean> = [];
  if (route.flightId) boardPasses.push(f => f.id === route.flightId);
  if (num) boardPasses.push(f => slug(f.number) === num);
  for (const matches of boardPasses) {
    const i = rows.findIndex(matches);
    if (i >= 0) return { where: 'board', index: i };
  }
  return null;
}

/**
 * What a tap should do. Pass the payload and whatever the app currently knows; an empty `tracked` is the
 * normal cold-start case and is exactly why `defer` exists.
 */
export function notificationTarget(
  raw: unknown,
  lists: { tracked?: TrackedCandidate[]; board?: BoardCandidate[] } = {},
): NotificationTarget {
  if (isGmailImportNotification(raw)) return { screen: 'gmailImport' };
  const route = parseNotificationData(raw);
  // No flight number, no key, no id: there is nothing here to look up, now or later.
  if (!route) return { screen: 'home', route: null, defer: false };

  const match = findNotificationMatch(route, lists.tracked || [], lists.board || []);
  if (match) {
    return { screen: 'detail', match, route, focusSection: route.targetSection, defer: false };
  }
  if (route.flightNumber) {
    return { screen: 'stub', flightNumber: route.flightNumber, route, focusSection: route.targetSection, defer: true };
  }
  /*
   * A key but no number — a Family Safety Mode push. Nothing can be drawn yet, so the home screen stands,
   * but the route is kept: as soon as the tracked list is read the retry opens the card.
   */
  return { screen: 'home', route, defer: true };
}
