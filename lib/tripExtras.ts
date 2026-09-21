import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform, Share } from 'react-native';

export {
  cleanTripExtras,
  hasTripExtras,
  mergeTripExtras,
  minutesUntilIso,
  parseMs,
} from './tripExtrasModel';
export type {
  TripCarRental,
  TripExcursion,
  TripExtras,
  TripExtrasSource,
  TripHotel,
  TripRestaurant,
  TripTransfer,
} from './tripExtrasModel';

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
