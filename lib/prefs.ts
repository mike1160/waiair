import AsyncStorage from '@react-native-async-storage/async-storage';
import { setLocale, type Locale } from './i18n';

export type TempUnit = 'C' | 'F';
export type TimeFormat = '24h' | '12h';

export type NotifyPrefs = {
  delay: boolean;
  gate: boolean;
  boarding: boolean;
  landed: boolean;
};

export type DefaultAirport = {
  iata: string;
  name: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
};

export type LocalePref = 'en' | 'nl';

export type AppPrefs = {
  tempUnit: TempUnit;
  timeFormat: TimeFormat;
  defaultAirport: DefaultAirport | null;
  notify: NotifyPrefs;
  hasSeenOnboarding: boolean;
  locale: LocalePref;
  refreshIntervalMs: number;
  offlineEnabled: boolean;
};

const KEY = 'waiair.prefs.v1';
export const ONBOARDING_KEY = 'hasSeenOnboarding';
export const LAST_BOARD_DAY_KEY = 'waiair.lastBoardDay.v1';

const DEFAULT_NOTIFY: NotifyPrefs = {
  delay: true,
  gate: true,
  boarding: true,
  landed: true,
};

const DEFAULTS: AppPrefs = {
  tempUnit: 'C',
  timeFormat: '24h',
  defaultAirport: null,
  notify: DEFAULT_NOTIFY,
  hasSeenOnboarding: false,
  locale: 'en',
  refreshIntervalMs: 60 * 1000,
  offlineEnabled: true,
};

let current: AppPrefs = { ...DEFAULTS, notify: { ...DEFAULT_NOTIFY } };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach(fn => fn());
}

export function getPrefs(): AppPrefs {
  return current;
}

export function subscribePrefs(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function formatClock(isoOrDate: Date | string, timeFormat: TimeFormat = current.timeFormat): string {
  const d = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return '--:--';
  return d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: timeFormat === '12h',
  });
}

export function formatTempC(celsius: number, unit: TempUnit = current.tempUnit): string {
  if (unit === 'F') return `${Math.round(celsius * 9 / 5 + 32)}°F`;
  return `${Math.round(celsius)}°C`;
}

export async function loadPrefs(): Promise<AppPrefs> {
  try {
    const [raw, onboard] = await Promise.all([
      AsyncStorage.getItem(KEY),
      AsyncStorage.getItem(ONBOARDING_KEY),
    ]);
    let next: AppPrefs = { ...DEFAULTS, notify: { ...DEFAULT_NOTIFY } };
    if (raw) {
      const parsed = JSON.parse(raw);
      next = {
        tempUnit: parsed?.tempUnit === 'F' ? 'F' : 'C',
        timeFormat: parsed?.timeFormat === '12h' ? '12h' : '24h',
        defaultAirport: parsed?.defaultAirport?.iata ? parsed.defaultAirport : null,
        notify: { ...DEFAULT_NOTIFY, ...(parsed?.notify || {}) },
        hasSeenOnboarding: !!parsed?.hasSeenOnboarding,
        locale: parsed?.locale === 'nl' ? 'nl' : 'en',
        refreshIntervalMs: [30000, 60000, 300000].includes(Number(parsed?.refreshIntervalMs))
          ? Number(parsed.refreshIntervalMs)
          : 60000,
        offlineEnabled: parsed?.offlineEnabled !== false,
      };
    }
    if (onboard === '1' || onboard === 'true') next.hasSeenOnboarding = true;
    current = next;
    setLocale(current.locale as Locale);
    emit();
    return current;
  } catch {
    return current;
  }
}

export async function savePrefs(partial: Partial<AppPrefs>): Promise<AppPrefs> {
  current = {
    ...current,
    ...partial,
    notify: { ...current.notify, ...(partial.notify || {}) },
  };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(current));
    if (partial.hasSeenOnboarding != null) {
      await AsyncStorage.setItem(ONBOARDING_KEY, current.hasSeenOnboarding ? '1' : '0');
    }
  } catch { /* ignore */ }
  emit();
  setLocale(current.locale as Locale);
  return current;
}

export async function markOnboardingSeen(): Promise<void> {
  await savePrefs({ hasSeenOnboarding: true });
}

/** Drop FIDS + weather + FX caches. Keep country, tracked flights, prefs. */
export async function clearAppCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const drop = keys.filter(k =>
      k.startsWith('cache_') ||
      k.startsWith('waiair.wx.') ||
      k.startsWith('waiair.fx.')
    );
    if (drop.length) await AsyncStorage.multiRemove(drop);
  } catch { /* ignore */ }
}

export async function clearFidsCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const drop = keys.filter(k => k.startsWith('cache_'));
    if (drop.length) await AsyncStorage.multiRemove(drop);
  } catch { /* ignore */ }
}
