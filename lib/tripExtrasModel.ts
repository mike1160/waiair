/**
 * The trip-extras data model: the shapes, and the clean / merge rules that decide when a parsed booking is
 * worth keeping. Pure on purpose — no React Native, no storage — so it runs under `node --test`. The device
 * actions (maps, share, call) and the dismissed-banner storage live in ./tripExtras.ts, which re-exports
 * everything below so existing imports keep working.
 */

export type TripExtrasSource = 'manual' | 'parsed' | 'gmail';

export type TripHotel = {
  name?: string;
  address?: string;
  checkIn?: string;
  checkOut?: string;
  confirmationRef?: string;
  source?: TripExtrasSource;
};

export type TripCarRental = {
  company?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  dropoffTime?: string;
  confirmationRef?: string;
  source?: TripExtrasSource;
};

export type TripTransfer = {
  provider?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  pickupTime?: string;
  confirmationRef?: string;
  driverName?: string;
  driverPhone?: string;
  vehicleDescription?: string;
  source?: TripExtrasSource;
};

export type TripExcursion = {
  name?: string;
  /** ISO 8601 — the start of the activity. */
  dateTime?: string;
  /** Where you are collected: "hotel lobby" or a full address. */
  pickupLocation?: string;
  dropoffLocation?: string;
  confirmationRef?: string;
  /** The platform that sold it, e.g. "GetYourGuide", "Viator". */
  operator?: string;
  source?: TripExtrasSource;
};

export type TripRestaurant = {
  name?: string;
  /** ISO 8601 — the sitting. */
  dateTime?: string;
  partySize?: number;
  confirmationRef?: string;
  /** Iens is TheFork's Dutch site and its mails carry a TheFork booking, so it maps to 'thefork'. */
  platform?: 'opentable' | 'thefork' | 'other';
  address?: string;
  source?: TripExtrasSource;
};

export type TripExtras = {
  hotel?: TripHotel;
  carRental?: TripCarRental;
  transfer?: TripTransfer;
  excursion?: TripExcursion;
  restaurant?: TripRestaurant;
};

function trim(v?: string): string | undefined {
  const s = String(v || '').trim();
  return s || undefined;
}

function cleanHotel(h?: TripHotel): TripHotel | undefined {
  if (!h) return undefined;
  const next: TripHotel = {
    name: trim(h.name),
    address: trim(h.address),
    checkIn: trim(h.checkIn),
    checkOut: trim(h.checkOut),
    confirmationRef: trim(h.confirmationRef),
    source: h.source,
  };
  if (!next.name && !next.address && !next.confirmationRef && !next.checkIn && !next.checkOut) {
    return undefined;
  }
  return next;
}

function cleanCar(c?: TripCarRental): TripCarRental | undefined {
  if (!c) return undefined;
  const next: TripCarRental = {
    company: trim(c.company),
    pickupLocation: trim(c.pickupLocation),
    dropoffLocation: trim(c.dropoffLocation),
    pickupTime: trim(c.pickupTime),
    dropoffTime: trim(c.dropoffTime),
    confirmationRef: trim(c.confirmationRef),
    source: c.source,
  };
  if (!next.company && !next.pickupLocation && !next.confirmationRef && !next.pickupTime) {
    return undefined;
  }
  return next;
}

function cleanTransfer(t?: TripTransfer): TripTransfer | undefined {
  if (!t) return undefined;
  const next: TripTransfer = {
    provider: trim(t.provider),
    pickupLocation: trim(t.pickupLocation),
    dropoffLocation: trim(t.dropoffLocation),
    pickupTime: trim(t.pickupTime),
    confirmationRef: trim(t.confirmationRef),
    driverName: trim(t.driverName),
    driverPhone: trim(t.driverPhone),
    vehicleDescription: trim(t.vehicleDescription),
    source: t.source,
  };
  if (
    !next.provider && !next.pickupLocation && !next.confirmationRef
    && !next.driverName && !next.driverPhone && !next.pickupTime
  ) {
    return undefined;
  }
  return next;
}

function cleanExcursion(e?: TripExcursion): TripExcursion | undefined {
  if (!e) return undefined;
  const next: TripExcursion = {
    name: trim(e.name),
    dateTime: trim(e.dateTime),
    pickupLocation: trim(e.pickupLocation),
    dropoffLocation: trim(e.dropoffLocation),
    confirmationRef: trim(e.confirmationRef),
    operator: trim(e.operator),
    source: e.source,
  };
  if (!next.name && !next.confirmationRef && !next.dateTime && !next.pickupLocation) {
    return undefined;
  }
  return next;
}

function cleanRestaurant(r?: TripRestaurant): TripRestaurant | undefined {
  if (!r) return undefined;
  // A party size is only a number when it is one: "0 guests" and NaN are no booking detail.
  const size = Number(r.partySize);
  const next: TripRestaurant = {
    name: trim(r.name),
    dateTime: trim(r.dateTime),
    partySize: Number.isFinite(size) && size > 0 ? Math.round(size) : undefined,
    confirmationRef: trim(r.confirmationRef),
    platform: r.platform,
    address: trim(r.address),
    source: r.source,
  };
  if (!next.name && !next.confirmationRef && !next.dateTime && !next.address) {
    return undefined;
  }
  return next;
}

export function cleanTripExtras(extras?: TripExtras | null): TripExtras | undefined {
  if (!extras) return undefined;
  const next: TripExtras = {
    hotel: cleanHotel(extras.hotel),
    carRental: cleanCar(extras.carRental),
    transfer: cleanTransfer(extras.transfer),
    excursion: cleanExcursion(extras.excursion),
    restaurant: cleanRestaurant(extras.restaurant),
  };
  if (!next.hotel && !next.carRental && !next.transfer && !next.excursion && !next.restaurant) return undefined;
  return next;
}

export function hasTripExtras(extras?: TripExtras | null): boolean {
  return !!cleanTripExtras(extras);
}

export function mergeTripExtras(
  base?: TripExtras | null,
  patch?: Partial<TripExtras> | null,
  source?: TripExtrasSource,
): TripExtras | undefined {
  const hotel = { ...base?.hotel, ...patch?.hotel };
  const carRental = { ...base?.carRental, ...patch?.carRental };
  const transfer = { ...base?.transfer, ...patch?.transfer };
  const excursion = { ...base?.excursion, ...patch?.excursion };
  const restaurant = { ...base?.restaurant, ...patch?.restaurant };
  if (source) {
    if (patch?.hotel && Object.values(patch.hotel).some(Boolean)) hotel.source = source;
    if (patch?.carRental && Object.values(patch.carRental).some(Boolean)) carRental.source = source;
    if (patch?.transfer && Object.values(patch.transfer).some(Boolean)) transfer.source = source;
    if (patch?.excursion && Object.values(patch.excursion).some(Boolean)) excursion.source = source;
    if (patch?.restaurant && Object.values(patch.restaurant).some(Boolean)) restaurant.source = source;
  }
  return cleanTripExtras({ hotel, carRental, transfer, excursion, restaurant });
}

export function parseMs(iso?: string): number | null {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : null;
}

export function minutesUntilIso(iso?: string, now = Date.now()): number | null {
  const ms = parseMs(iso);
  if (ms == null) return null;
  return Math.round((ms - now) / 60000);
}
