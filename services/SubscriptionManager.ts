import AsyncStorage from '@react-native-async-storage/async-storage';
import { withTimeout } from '../lib/net';
import { checkProStatus } from '../lib/purchases';

const PRO_FLAG_KEY = 'waiair.pro.flag.v1';
/** Search path must not hang when RevenueCat getCustomerInfo never resolves. */
const PRO_CHECK_TIMEOUT_MS = 2000;
let cachedPro = false;

/** Keep DataManager in sync with the in-app Pro flag (incl. BETA_MODE). */
export function setProOverride(value: boolean) {
  cachedPro = !!value;
  AsyncStorage.setItem(PRO_FLAG_KEY, cachedPro ? '1' : '0').catch(() => {});
}

export function isProUnlocked() {
  return cachedPro;
}

export async function isPro(): Promise<boolean> {
  if (cachedPro) return true;
  try {
    const raw = await AsyncStorage.getItem(PRO_FLAG_KEY);
    if (raw === '1') return true;
  } catch { /* ignore */ }
  try {
    // Fail open as free after 2s so flight search is never blocked on RC delay.
    return await withTimeout(checkProStatus(), PRO_CHECK_TIMEOUT_MS);
  } catch {
    return false;
  }
}
