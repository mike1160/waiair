/** Parse push/local notification payloads and map them to in-app routes. */

export type NotificationLinkType =
  | 'eu261'
  | 'baggage'
  | 'pickup'
  | 'gateChange'
  | 'boarding'
  | 'landed'
  | 'flight';

/** Scroll/highlight target inside a flight DetailCard. */
export type DetailFocusSection =
  | 'eu261'
  | 'baggage'
  | 'pickup'
  | 'globe'
  | 'turbulence'
  | 'gate'
  | 'boarding'
  | 'arrival';

export type ParsedNotificationRoute = {
  raw: Record<string, unknown>;
  flightNumber: string;
  flightKey: string;
  flightId: string;
  linkType: NotificationLinkType;
  focusSection: DetailFocusSection | null;
  targetSection: DetailFocusSection | null;
};

const PICKUP_KINDS = new Set([
  'pickup',
  'pickup-landed',
  'pickup-gate',
  'surprise-landed',
  'surprise-welcome',
]);

const EU261_KINDS = new Set(['cancelled', 'delay', 'connection', 'eu261', 'together-delayed']);

const FOCUS_SECTIONS = new Set<DetailFocusSection>([
  'eu261',
  'baggage',
  'pickup',
  'globe',
  'turbulence',
  'gate',
  'boarding',
  'arrival',
]);

function slug(raw: unknown): string {
  return String(raw || '').replace(/\s+/g, '').toUpperCase();
}

function asFocusSection(raw: unknown): DetailFocusSection | null {
  const v = String(raw || '').trim();
  return FOCUS_SECTIONS.has(v as DetailFocusSection) ? (v as DetailFocusSection) : null;
}

/** Map legacy `kind` values to the canonical `type` strings used for routing. */
export function notifyKindToLinkType(kind: string): NotificationLinkType {
  const k = String(kind || '').toLowerCase();
  if (k === 'gate' || k === 'gaterace' || k === 'gate-race' || k === 'pickup-gate') return 'gateChange';
  if (k === 'boarding' || k === 'lastcall' || k === 'gateclose') return 'boarding';
  if (k === 'landed' || k === 'together-landed' || k === 'together') return 'landed';
  if (k === 'baggage') return 'baggage';
  if (EU261_KINDS.has(k)) return 'eu261';
  if (PICKUP_KINDS.has(k)) return 'pickup';
  if (k === 'turbulence') return 'flight';
  return 'flight';
}

/** Canonical DetailCard section for a notification kind. */
export function kindToTargetSection(kind: string): DetailFocusSection {
  const k = String(kind || '').toLowerCase();
  if (k === 'turbulence') return 'turbulence';
  if (k === 'gate' || k === 'gaterace' || k === 'gate-race' || k === 'pickup-gate') return 'gate';
  if (k === 'boarding' || k === 'lastcall' || k === 'gateclose' || k === 't30m') return 'boarding';
  if (k === 'baggage') return 'baggage';
  if (EU261_KINDS.has(k)) return 'eu261';
  if (k === 'pickup' || k === 'surprise-welcome') return 'pickup';
  if (k === 'pickup-landed' || k === 'surprise-landed') return 'arrival';
  if (k === 'landed') return 'globe';
  if (
    k === 'departed'
    || k === 'early'
    || k === 'wake'
    || k === 'together'
    || k === 'together-landed'
    || k === 'together-delayed'
    || k === 'alllanded'
  ) return 'arrival';
  if (k === 't24' || k === 't3h' || k === 't1h') return 'gate';
  return 'gate';
}

export function linkTypeToFocusSection(type: NotificationLinkType): DetailFocusSection | null {
  if (type === 'eu261') return 'eu261';
  if (type === 'baggage') return 'baggage';
  if (type === 'pickup') return 'pickup';
  if (type === 'gateChange') return 'gate';
  if (type === 'boarding') return 'boarding';
  if (type === 'landed') return 'globe';
  return null;
}

export function buildNotificationData(input: {
  flightNumber: string;
  kind: string;
  flightKey?: string;
  flightId?: string;
  type?: NotificationLinkType;
  focusSection?: DetailFocusSection | null;
  targetSection?: DetailFocusSection | null;
}): Record<string, string> {
  const clean = slug(input.flightNumber);
  const linkType = input.type || notifyKindToLinkType(input.kind);
  const flightKey = String(input.flightKey || '').trim();
  const flightId = String(input.flightId || flightKey || clean).trim();
  const targetSection =
    input.targetSection
    || input.focusSection
    || kindToTargetSection(input.kind)
    || linkTypeToFocusSection(linkType)
    || 'gate';
  return {
    thread: `flight-${clean}`,
    flightNumber: clean,
    flightKey: flightKey || flightId,
    flightId,
    kind: input.kind,
    type: linkType,
    targetSection,
    focusSection: targetSection,
  };
}

export function parseNotificationData(raw: unknown): ParsedNotificationRoute | null {
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const flightNumber = slug(data.flightNumber);
  const flightKey = String(data.flightKey || data.flightId || '').trim();
  const flightId = String(data.flightId || data.flightKey || flightNumber).trim();
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
  const targetSection =
    asFocusSection(data.targetSection)
    || asFocusSection(data.focusSection)
    || kindToTargetSection(kind)
    || linkTypeToFocusSection(linkType);
  return {
    raw: data,
    flightNumber,
    flightKey: flightKey || flightId,
    flightId: flightId || flightKey || flightNumber,
    linkType,
    focusSection: targetSection,
    targetSection,
  };
}

/** Cold-start taps can arrive before JS finishes booting — allow a generous window. */
export const COLD_START_NOTIFICATION_MS = 5 * 60_000;
