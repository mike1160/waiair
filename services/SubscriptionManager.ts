import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkProStatus } from '../lib/purchases';

const PRO_FLAG_KEY = 'waiair.pro.flag.v1';
let cachedPro = false;

/** Keep DataManager in sync with the in-app Pro flag (incl. BETA_MODE). */
export function setProOverride(value: boolean) {
  cachedPro = !!value;
  AsyncStorage.setItem(PRO_FLAG_KEY, cachedPro ? '1' : '0').catch(() => {});
}

export async function isPro(): Promise<boolean> {
  if (cachedPro) return true;
  try {
    const raw = await AsyncStorage.getItem(PRO_FLAG_KEY);
    if (raw === '1') return true;
  } catch { /* ignore */ }
  try {
    return await checkProStatus();
  } catch {
    return false;
  }
}
