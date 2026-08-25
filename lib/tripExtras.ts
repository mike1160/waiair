import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform, Share } from 'react-native';

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

export type TripExtras = {
  hotel?: TripHotel;
  carRental?: TripCarRental;
  transfer?: TripTransfer;
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

export function cleanTripExtras(extras?: TripExtras | null): TripExtras | undefined {
  if (!extras) return undefined;
  const next: TripExtras = {
    hotel: cleanHotel(extras.hotel),
    carRental: cleanCar(extras.carRental),
    transfer: cleanTransfer(extras.transfer),
  };
  if (!next.hotel && !next.carRental && !next.transfer) return undefined;
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
  if (source) {
    if (patch?.hotel && Object.values(patch.hotel).some(Boolean)) hotel.source = source;
    if (patch?.carRental && Object.values(patch.carRental).some(Boolean)) carRental.source = source;
    if (patch?.transfer && Object.values(patch.transfer).some(Boolean)) transfer.source = source;
  }
  return cleanTripExtras({ hotel, carRental, transfer });
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

export async function openMapsQuery(query: string): Promise<void> {
  const q = encodeURIComponent(query.trim());
  if (!q) return;
  if (Platform.OS === 'ios') {
    try {
      await Linking.openURL(`http://maps.apple.com/?q=${q}`);
      return;
    } catch { /* google fallback */ }
  }
  try {
    await Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
  } catch { /* ignore */ }
}

export async function shareAddressText(message: string): Promise<void> {
  const text = String(message || '').trim();
  if (!text) return;
  const encoded = encodeURIComponent(text);
  try {
    if (await Linking.canOpenURL(`whatsapp://send?text=${encoded}`)) {
      await Linking.openURL(`whatsapp://send?text=${encoded}`);
      return;
    }
  } catch { /* next */ }
  try {
    await Linking.openURL(`https://wa.me/?text=${encoded}`);
    return;
  } catch { /* next */ }
  try {
    await Linking.openURL(`https://line.me/R/share?text=${encoded}`);
    return;
  } catch { /* system share */ }
  try {
    await Share.share({ message: text });
  } catch { /* ignore */ }
}

export async function callPhone(raw?: string): Promise<void> {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return;
  try {
    await Linking.openURL(`tel:${digits}`);
  } catch { /* ignore */ }
}

export async function openRideToAddress(name: string, address: string): Promise<void> {
  const dest = String(address || '').trim();
  const encoded = encodeURIComponent(dest);
  if (!dest) return;
  const deep: Record<string, string> = {
    Grab: `grab://open?dropoffAddress=${encoded}`,
    Uber: `uber://?action=setPickup&dropoff[formatted_address]=${encoded}`,
    Bolt: `bolt://order?dropoff=${encoded}`,
  };
  const url = deep[name];
  if (url) {
    try {
      await Linking.openURL(url);
      return;
    } catch { /* maps fallback */ }
  }
  await openMapsQuery(dest);
}

const BANNER_DISMISS_PREFIX = 'waiair.tripExtrasBannerDismissed.';

export async function isTripExtrasBannerDismissed(flightKey?: string): Promise<boolean> {
  const key = String(flightKey || '').trim();
  if (!key) return false;
  try {
    return (await AsyncStorage.getItem(BANNER_DISMISS_PREFIX + key)) === '1';
  } catch {
    return false;
  }
}

export async function dismissTripExtrasBanner(flightKey?: string): Promise<void> {
  const key = String(flightKey || '').trim();
  if (!key) return;
  try {
    await AsyncStorage.setItem(BANNER_DISMISS_PREFIX + key, '1');
  } catch { /* ignore */ }
}
