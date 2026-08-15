import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as StoreReview from 'expo-store-review';

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

const APP_STORE_ID = '6798072839';

export async function openStoreListing(): Promise<void> {
  try {
    const { Linking } = await import('react-native');
    if (Platform.OS === 'ios') {
      await Linking.openURL(
        `https://apps.apple.com/app/apple-store/id${APP_STORE_ID}?action=write-review`,
      );
      return;
    }
    const url = StoreReview.storeUrl();
    if (url) await Linking.openURL(url);
    else await StoreReview.requestReview();
  } catch {
    /* ignore */
  }
}
