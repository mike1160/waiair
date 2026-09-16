/** Persist smart-paywall dismissal / once-per-flight landing (rules in lib/smartPaywall.ts). */
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  landingPaywallStorageKey,
  localDateKey,
  paywallDismissedStorageKey,
  paywallShownStorageKey,
  shouldShowSmartPaywall,
  type SmartPaywallMoment,
} from './smartPaywall';

async function readFlag(key: string): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw === '1' || raw === 'true';
  } catch {
    return false;
  }
}

async function writeFlag(key: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key, '1');
  } catch { /* in-memory gate still applies this session */ }
}

export async function canPresentSmartPaywall(opts: {
  isPro: boolean;
  betaMode: boolean;
  launchCount: number;
  moment: SmartPaywallMoment;
  flightKey?: string;
}): Promise<boolean> {
  const date = localDateKey();
  const dismissedToday = await readFlag(paywallDismissedStorageKey(date));
  const shownToday = await readFlag(paywallShownStorageKey(date));
  const landingAlreadyShown = opts.moment === 'landing' && opts.flightKey
    ? await readFlag(landingPaywallStorageKey(opts.flightKey))
    : false;
  return shouldShowSmartPaywall({
    isPro: opts.isPro,
    betaMode: opts.betaMode,
    launchCount: opts.launchCount,
    dismissedToday,
    shownToday,
    landingAlreadyShown,
    moment: opts.moment,
  });
}

export async function markSmartPaywallPresented(opts: {
  moment: SmartPaywallMoment;
  flightKey?: string;
}): Promise<void> {
  const date = localDateKey();
  await writeFlag(paywallShownStorageKey(date));
  if (opts.moment === 'landing' && opts.flightKey) {
    await writeFlag(landingPaywallStorageKey(opts.flightKey));
  }
}

export async function markSmartPaywallDismissed(): Promise<void> {
  await writeFlag(paywallDismissedStorageKey(localDateKey()));
}
