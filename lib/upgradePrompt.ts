import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'waiair.upgradePrompt.dismissedAt.v1';
const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export async function shouldShowUpgradePrompt(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return true;
    const at = Number(raw);
    if (!Number.isFinite(at) || at <= 0) return true;
    return Date.now() - at >= COOLDOWN_MS;
  } catch {
    return true;
  }
}

export async function dismissUpgradePrompt(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, String(Date.now()));
  } catch { /* ignore */ }
}
