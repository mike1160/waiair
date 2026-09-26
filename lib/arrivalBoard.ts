/**
 * The Live Arrival Board [Q/1]: what a phone shows the person waiting at the airport once the flight they
 * came for is on the ground.
 *
 * Who this is for, and why it is not Family Safety Mode. The brief asked for the follower's view of a shared
 * flight, but the app has no follower side of that feature: it creates shares and lists who joined
 * (lib/familyShare.ts), and the joining happens on the web — nothing in the app posts to
 * `/family-share/:token/follow`, and nothing reads a `source: 'family'` push. The app's own "I am following
 * someone else's flight" is pickup mode (lib/pickup.ts): a flight key, a destination, a terminal and the
 * name of the person being met. That is the follower, so that is what this board speaks for.
 *
 * It is a board, not an alert: it says where the flight got to, which gate and which belt, and it offers the
 * three things someone standing in an arrivals hall actually does next — drive there, say something, share
 * where they are standing. It stops speaking two hours after landing, because by then either they have met
 * or the board is not the problem.
 *
 * Pure: every rule here is decided from plain values and unit-tested. The screen
 * (components/ArrivalBoardScreen.tsx) draws it and App.tsx decides when to open it.
 */

/** A board outlives baggage reclaim and a slow passport queue, and not much more. */
export const ARRIVAL_BOARD_WINDOW_MS = 2 * 3600_000;
/** Gate and belt are announced minutes after landing, so the board keeps asking. */
export const ARRIVAL_BOARD_REFRESH_MS = 30_000;
/** What a board writes when it has not been told yet. Never a guess, never an empty gap. */
export const ARRIVAL_BOARD_BLANK = '—';

export interface ArrivalBoardFlight {
  flightNumber: string;
  origin?: string;
  destination?: string;
  destCity?: string;
  airlineCode?: string;
  /** Where the flight got to, as the live data says: 'landed' is what opens this board. */
  status?: string;
  gate?: string;
  /** Arrival belt, when the airport has announced one. */
  baggage?: string;
  arrTerminal?: string;
  terminal?: string;
}

export interface ArrivalBoardInput {
  flightKey: string;
  flight: ArrivalBoardFlight;
  /** The person being met, from the pickup record. Empty when nobody was named. */
  travelerName?: string;
  /** When the flight touched down. */
  landedAtMs?: number | null;
  /** When the flight data on screen was last refreshed. */
  updatedAtMs?: number | null;
  now?: number;
}

export interface ArrivalBoardView {
  flightKey: string;
  flightNumber: string;
  airlineCode: string;
  origin: string;
  destination: string;
  city: string;
  /** Landing time as hh:mm in the arrival airport's own clock, or the blank. */
  landedAt: string;
  gate: string;
  baggage: string;
  terminal: string;
  travelerName: string;
  landedAtMs: number;
  updatedAtMs: number;
  /** How long the board still has before it retires itself. */
  msLeft: number;
}

function clean(raw: unknown): string {
  return String(raw ?? '').trim();
}

function blank(raw: unknown): string {
  return clean(raw) || ARRIVAL_BOARD_BLANK;
}

/** A board shouts in capitals, the way the one over the carousel does. */
export function boardLabel(raw: unknown): string {
  return blank(raw).toUpperCase();
}

/** A terminal is written T2, whether the data said "2", "t2" or "Terminal 2". */
export function terminalLabel(raw: unknown): string {
  const t = clean(raw).replace(/^terminal\s*/i, '');
  if (!t) return '';
  if (/^t\d/i.test(t)) return t.toUpperCase();
  if (/^\d/.test(t)) return `T${t}`;
  return t.toUpperCase();
}

/** Has this flight landed? The one status that opens the board, however the source spells it. */
export function hasLanded(status: unknown): boolean {
  const s = clean(status).toLowerCase().replace(/[_\s-]/g, '');
  return s === 'landed' || s === 'arrived' || s === 'ontheground';
}

/**
 * Is the board still worth showing? Two hours from landing, and not once it has been closed.
 *
 * A landing time in the future is trusted rather than rejected: airport clocks and phone clocks disagree by
 * a minute or two all the time, and refusing to show the board over that would be absurd.
 */
export function arrivalBoardLive(opts: {
  landedAtMs?: number | null;
  now?: number;
  dismissed?: boolean;
}): boolean {
  if (opts.dismissed) return false;
  const landed = Number(opts.landedAtMs);
  if (!Number.isFinite(landed) || landed <= 0) return false;
  const now = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now();
  return now - landed < ARRIVAL_BOARD_WINDOW_MS;
}

/**
 * The board's content, or null when there is nothing to show — no flight, not landed, or the two hours are
 * up. Times are formatted by the caller's clock helper so the arrival airport's own time is used; this holds
 * the rules, not the timezone database.
 */
export function arrivalBoardView(
  input: ArrivalBoardInput,
  clock: (ms: number) => string,
): ArrivalBoardView | null {
  const f = input.flight;
  if (!f || !clean(f.flightNumber)) return null;
  const landedAtMs = Number(input.landedAtMs) || 0;
  if (!arrivalBoardLive({ landedAtMs, now: input.now })) return null;
  const now = Number.isFinite(Number(input.now)) ? Number(input.now) : Date.now();
  const updatedAtMs = Number(input.updatedAtMs) || now;
  return {
    flightKey: clean(input.flightKey),
    flightNumber: clean(f.flightNumber).toUpperCase(),
    airlineCode: clean(f.airlineCode) || clean(f.flightNumber).replace(/\d.*/, '').toUpperCase(),
    origin: boardLabel(f.origin),
    destination: boardLabel(f.destination),
    city: clean(f.destCity) || clean(f.destination),
    landedAt: landedAtMs ? clock(landedAtMs) : ARRIVAL_BOARD_BLANK,
    gate: boardLabel(f.gate),
    baggage: boardLabel(f.baggage),
    terminal: terminalLabel(f.arrTerminal || f.terminal),
    travelerName: clean(input.travelerName),
    landedAtMs,
    updatedAtMs,
    msLeft: Math.max(0, ARRIVAL_BOARD_WINDOW_MS - (now - landedAtMs)),
  };
}

/**
 * What to say to someone who has just landed. The city is used when it is known, because "you have landed"
 * is a strange thing to be told by someone who does not know where you are.
 */
export function arrivalMessageText(
  view: Pick<ArrivalBoardView, 'city' | 'destination'>,
  copy: { arrivalBoardWhatsApp: (city: string) => string },
): string {
  const where = clean(view.city) || clean(view.destination);
  return copy.arrivalBoardWhatsApp(where);
}

/** The airport to navigate to, in the words a maps search understands. */
export function arrivalNavigateQuery(
  view: Pick<ArrivalBoardView, 'destination' | 'city'>,
  airportName?: string,
): string {
  const name = clean(airportName);
  if (name) return name;
  const city = clean(view.city);
  const iata = clean(view.destination).replace(ARRIVAL_BOARD_BLANK, '');
  if (city && iata) return `${city} Airport (${iata})`;
  return city ? `${city} Airport` : `${iata} Airport`;
}
