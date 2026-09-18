/** First-run opening screen: shown once, then the app opens where it always does. */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const OPENING_SEEN_KEY = 'waiair.opening.seen.v1';

export function openingSeenFromStored(raw?: string | null): boolean {
  return String(raw || '') === '1';
}

/** Storage trouble counts as seen: never trap someone in the opening screen. */
export async function hasSeenOpening(): Promise<boolean> {
  try {
    return openingSeenFromStored(await AsyncStorage.getItem(OPENING_SEEN_KEY));
  } catch {
    return true;
  }
}

export async function markOpeningSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(OPENING_SEEN_KEY, '1');
  } catch {
    // Not stored: the screen appears once more on the next launch.
  }
}
