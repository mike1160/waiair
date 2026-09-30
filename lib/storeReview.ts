import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';
import { storeListingUrl } from './storeListingUrl';

const LAST_PROMPT_KEY = 'waiair.storeReview.last.v1';
const OPENS_KEY = 'waiair.storeReview.opens.v1';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export async function recordAppOpen(): Promise<number> {
  try {
    const n = Number(await AsyncStorage.getItem(OPENS_KEY) || '0') + 1;
    await AsyncStorage.setItem(OPENS_KEY, String(n));
    return n;
  } catch {
    return 0;
  }
}

async function tooSoon(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(LAST_PROMPT_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < THIRTY_DAYS_MS;
  } catch {
    return false;
  }
}

/** Never interrupt boarding. Max once per 30 days. */
export async function maybeRequestReview(opts: {
  reason: 'untrack' | 'second_track' | 'opens';
  boardingActive?: boolean;
  trackedCount?: number;
}): Promise<void> {
  if (Platform.OS === 'web') return;
  if (opts.boardingActive) return;
  if (await tooSoon()) return;

  if (opts.reason === 'second_track' && (opts.trackedCount || 0) < 2) return;
  if (opts.reason === 'opens') {
    const n = Number(await AsyncStorage.getItem(OPENS_KEY) || '0');
    if (n < 3) return;
  }

  try {
    const available = await StoreReview.isAvailableAsync();
    const hasAction = await StoreReview.hasAction();
    if (!available && !hasAction) return;
    await StoreReview.requestReview();
    await AsyncStorage.setItem(LAST_PROMPT_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Open the store listing so someone can leave a review [W/9].
 *
 * This used to reach StoreReview.requestReview() whenever StoreReview.storeUrl() came back empty, and to
 * pull in Linking through a dynamic import. Tapping the button crashed the app natively — which a JS catch
 * cannot prevent — and both of those were candidates. lib/storeListingUrl.ts explains the reasoning; what is
 * left here is one https URL and the ordinary import.
 *
 * requestReview is untouched in maybeRequestReview above, where it belongs: an in-app review is a prompt the
 * store chooses to show, not something a button may demand.
 */
export async function openStoreListing(): Promise<void> {
  const url = storeListingUrl(Platform.OS);
  if (!url) return;
  try {
    await Linking.openURL(url);
  } catch {
    /* No browser, no store app: nothing more this can do, and it must not take the app down trying. */
  }
}
