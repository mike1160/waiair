/**
 * Trip timeline on the flight detail page: which rows exist and which slots are still empty.
 * Pure: the rows carry data only, the screen decides how they look.
 */

import type { TripExtras } from './tripExtras';

export type TripTimelineKind = 'outbound' | 'return';

export type TripTimelineRow = {
  kind: TripTimelineKind;
  /** ISO time of the row, when it has one (sorting and the date/time label). */
  iso?: string;
  title: string;
  sub?: string;
};

/** A slot with nothing in it yet; the screen shows a soft invite for each. */
export type TripTimelineSlot = 'hotel' | 'return';

export type TripTimelineInput = {
  /** Departure of the flight this page is about. */
  depIso?: string | null;
  originCity?: string | null;
  originIata?: string | null;
  extras?: TripExtras | null;
  /** A return flight already tracked ('' when there is none). */
  returnFlightNumber?: string | null;
  returnIso?: string | null;
};

function clean(v?: string | null): string {
  return String(v || '').trim();
}

/** True when the hotel holds anything worth a row. */
export function hasHotelRow(extras?: TripExtras | null): boolean {
  const h = extras?.hotel;
  return !!(h && (clean(h.name) || clean(h.address) || clean(h.confirmationRef)));
}

export function hasCarRow(extras?: TripExtras | null): boolean {
  const c = extras?.carRental;
  return !!(c && (clean(c.company) || clean(c.pickupLocation) || clean(c.confirmationRef)));
}

/**
 * The flight rows to draw: departure first, the return flight last. The hotel and car rental sit between them as
 * their existing cards (photo, fields, edit), so they are not repeated here.
 */
export function tripTimelineRows(input: TripTimelineInput): TripTimelineRow[] {
  const rows: TripTimelineRow[] = [];
  const dep = clean(input.depIso);
  const from = clean(input.originCity) || clean(input.originIata);
  if (dep || from) rows.push({ kind: 'outbound', iso: dep || undefined, title: from });
  const ret = clean(input.returnFlightNumber);
  if (ret) rows.push({ kind: 'return', iso: clean(input.returnIso) || undefined, title: ret });
  return rows;
}

/** Empty slots, in the order the invites are shown. */
export function tripTimelineSlots(input: TripTimelineInput): TripTimelineSlot[] {
  const slots: TripTimelineSlot[] = [];
  if (!hasHotelRow(input.extras)) slots.push('hotel');
  if (!clean(input.returnFlightNumber)) slots.push('return');
  return slots;
}
