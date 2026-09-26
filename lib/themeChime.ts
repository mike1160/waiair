/**
 * When a theme chimes, and when it stays quiet.
 *
 * Two of the [P/1] themes answer a moment out loud: Eagle when the aircraft leaves the ground, Cockpit when
 * boarding is called. Nothing else in the app makes a sound except airport mode's split-flap tick, so the
 * rule here is deliberately narrow — one theme, one event, one chime.
 *
 * A chime is a *transition*, not a state. Opening the app while already boarding is not a boarding call, so
 * the first status we ever see is only remembered, never sounded. Without that, every cold launch mid-flight
 * would greet the traveller with a chime for something that happened an hour ago.
 *
 * Pure on purpose: the hook around it (lib/useThemeChime.ts) does the playing, this decides.
 */

/** The statuses the home screen resolves a flight to (lib/homeNow.ts). */
export type ChimeStatus =
  | 'cancelled' | 'diverted' | 'boarding' | 'en-route' | 'landed' | 'delayed' | 'scheduled';

/** The event each theme listens for. 'en-route' is departure: the phase a flight enters once it is airborne. */
const CHIME_ON: Record<string, ChimeStatus> = {
  eagle: 'en-route',
  cockpit: 'boarding',
};

/** Does this theme chime at all? Every theme outside the table is silent. */
export function themeHasChime(themeId: string | null | undefined): boolean {
  return !!CHIME_ON[String(themeId || '')];
}

/**
 * Should the chime play now? Only when this theme's own event has just happened: the status moved *into* it
 * from a status we had already seen. A null or empty `prev` is a first sighting and stays quiet.
 */
export function shouldChime(
  themeId: string | null | undefined,
  prev: string | null | undefined,
  next: string | null | undefined,
): boolean {
  const want = CHIME_ON[String(themeId || '')];
  if (!want) return false;
  const from = String(prev || '');
  const to = String(next || '');
  if (!from || !to) return false;
  return to === want && from !== want;
}
