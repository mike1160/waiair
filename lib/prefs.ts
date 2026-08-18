import AsyncStorage from '@react-native-async-storage/async-storage';
import { LOCALES, setLocale, type Locale } from './i18n';
import { clearRecentSearches } from './recents';
import { THEME_STORAGE_KEY, THEME_STORAGE_KEY_LEGACY } from './themes';

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

export type LocalePref = 'en' | 'nl' | 'zh' | 'th' | 'de' | 'ru' | 'ja' | 'ko' | 'vi';

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

const TRACK_STORAGE_KEY = 'waiair.tracked.v1';
const PRO_FLAG_KEY = 'waiair.pro.flag.v1';
const FAV_STORAGE_KEY = 'favouriteAirports';
const FAV_STORAGE_KEY_LEGACY = 'waiair.favorites.v1';

/** Keys kept when clearing cache (tracked flights, prefs, locale, Pro, user data). */
const CACHE_PRESERVE_EXACT = new Set([
  KEY,
  ONBOARDING_KEY,
  LAST_BOARD_DAY_KEY,
  TRACK_STORAGE_KEY,
  PRO_FLAG_KEY,
  THEME_STORAGE_KEY,
  THEME_STORAGE_KEY_LEGACY,
  FAV_STORAGE_KEY,
  FAV_STORAGE_KEY_LEGACY,
  'waiair.pickup.home.v1',
  'waiair.pickup.flights.v1',
  'waiair.pickup.person.v1',
  'waiair.pushToken.v1',
  'waiair.connQuota.v1',
  'waiair.wakeAlarms.v1',
  'waiair.loungeAccess.v1',
  'waiair.upgradePrompt.dismissedAt.v1',
  'waiair.storeReview.last.v1',
  'waiair.storeReview.opens.v1',
  'waiair.airport2.v1',
]);

function shouldPreserveCacheKey(key: string): boolean {
  if (CACHE_PRESERVE_EXACT.has(key)) return true;
  if (key.startsWith('pickupAlertsEnabled_')) return true;
  return false;
}

function shouldClearCacheKey(key: string): boolean {
  if (shouldPreserveCacheKey(key)) return false;
  if (key.startsWith('cache_')) return true;
  if (key.startsWith('waiair.recent')) return true;
  if (key.startsWith('waiair.wx.')) return true;
  if (key.startsWith('waiair.fx.')) return true;
  if (key.startsWith('waiair.country.')) return true;
  if (key.startsWith('waiair.radar.')) return true;
  if (key.startsWith('history:')) return true;
  if (key === 'trackedFlights') return true;
  if (key === 'waiair.nearMe.v1') return true;
  if (key === 'waiair.lastConnResult.v1') return true;
  if (key === 'waiair.connNotified.v1') return true;
  return false;
}

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
        locale: (LOCALES as readonly string[]).includes(parsed?.locale) ? parsed.locale : 'en',
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

/** Drop cached boards, weather/FX/country, recents, radar, and flight history mirrors. */
export async function clearAppCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const drop = keys.filter(shouldClearCacheKey);
    if (drop.length) await AsyncStorage.multiRemove(drop);
    await clearRecentSearches();
  } catch { /* ignore */ }
}

export async function clearFidsCaches(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const drop = keys.filter(k => k.startsWith('cache_'));
    if (drop.length) await AsyncStorage.multiRemove(drop);
  } catch { /* ignore */ }
}
