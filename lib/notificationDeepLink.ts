/** Parse push/local notification payloads and map them to in-app routes. */

export type NotificationLinkType =
  | 'eu261'
  | 'baggage'
  | 'pickup'
  | 'gateChange'
  | 'boarding'
  | 'landed'
  | 'flight';

export type DetailFocusSection = 'eu261' | 'baggage' | 'pickup';

export type ParsedNotificationRoute = {
  raw: Record<string, unknown>;
  flightNumber: string;
  flightKey: string;
  flightId: string;
  linkType: NotificationLinkType;
  focusSection: DetailFocusSection | null;
};

const PICKUP_KINDS = new Set([
  'pickup',
  'pickup-landed',
  'pickup-gate',
  'surprise-landed',
  'surprise-welcome',
]);

const EU261_KINDS = new Set(['cancelled', 'delay', 'connection', 'eu261']);

function slug(raw: unknown): string {
  return String(raw || '').replace(/\s+/g, '').toUpperCase();
}

/** Map legacy `kind` values to the canonical `type` strings used for routing. */
export function notifyKindToLinkType(kind: string): NotificationLinkType {
  if (kind === 'gate') return 'gateChange';
  if (kind === 'boarding' || kind === 'lastCall' || kind === 'gateClose') return 'boarding';
  if (kind === 'landed') return 'landed';
  if (kind === 'baggage') return 'baggage';
  if (EU261_KINDS.has(kind)) return 'eu261';
  if (PICKUP_KINDS.has(kind)) return 'pickup';
  return 'flight';
}

export function linkTypeToFocusSection(type: NotificationLinkType): DetailFocusSection | null {
  if (type === 'eu261') return 'eu261';
  if (type === 'baggage') return 'baggage';
  if (type === 'pickup') return 'pickup';
  return null;
}

export function buildNotificationData(input: {
  flightNumber: string;
  kind: string;
  flightKey?: string;
  flightId?: string;
  type?: NotificationLinkType;
}): Record<string, string> {
  const clean = slug(input.flightNumber);
  const linkType = input.type || notifyKindToLinkType(input.kind);
  const flightKey = String(input.flightKey || '');
  const flightId = String(input.flightId || flightKey || '');
  return {
    thread: `flight-${clean}`,
    flightNumber: clean,
    flightKey,
    flightId,
    kind: input.kind,
    type: linkType,
  };
}

export function parseNotificationData(raw: unknown): ParsedNotificationRoute | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const flightNumber = slug(data.flightNumber);
  const flightKey = String(data.flightKey || data.flightId || '');
  const flightId = String(data.flightId || data.flightKey || '');
  const kind = String(data.kind || '');
  const explicitType = String(data.type || '');
  const linkType: NotificationLinkType =
    explicitType === 'eu261' ||
    explicitType === 'baggage' ||
    explicitType === 'pickup' ||
    explicitType === 'gateChange' ||
    explicitType === 'boarding' ||
    explicitType === 'landed' ||
    explicitType === 'flight'
      ? (explicitType as NotificationLinkType)
      : notifyKindToLinkType(kind);
  if (!flightNumber && !flightKey && !flightId) return null;
  return {
    raw: data,
    flightNumber,
    flightKey,
    flightId,
    linkType,
    focusSection: linkTypeToFocusSection(linkType),
  };
}

/** Cold-start taps can arrive before JS finishes booting — allow a generous window. */
export const COLD_START_NOTIFICATION_MS = 5 * 60_000;
