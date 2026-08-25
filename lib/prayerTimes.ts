import AsyncStorage from '@react-native-async-storage/async-storage';
import { fromZonedTime } from 'date-fns-tz';
import { fetchWithTimeout } from './net';
import type { TimeFormat } from './prefs';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FAIL_TTL_MS = 30 * 60 * 1000;
const CACHE_PREFIX = 'waiair.prayer.';

export interface PrayerTimes {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Maghrib: string;
  Isha: string;
  date: string;
  lat: number;
  lon: number;
}

export type PrayerName = 'Fajr' | 'Sunrise' | 'Dhuhr' | 'Asr' | 'Maghrib' | 'Isha';

export const PRAYER_ROWS: { key: PrayerName; emoji: string }[] = [
  { key: 'Fajr', emoji: '🌙' },
  { key: 'Sunrise', emoji: '' },
  { key: 'Dhuhr', emoji: '☀️' },
  { key: 'Asr', emoji: '' },
  { key: 'Maghrib', emoji: '🌅' },
  { key: 'Isha', emoji: '⭐' },
];

const NEXT_PRAYER_KEYS: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

type CacheEntry = {
  at: number;
  times?: PrayerTimes;
  failed?: boolean;
};

const mem = new Map<string, CacheEntry>();

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function prayerDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function prayerCacheKey(lat: number, lon: number, dateStr: string): string {
  return `${CACHE_PREFIX}${Number(lat).toFixed(2)}.${Number(lon).toFixed(2)}.${dateStr}`;
}

function hhmm(raw: unknown): string {
  const m = String(raw || '').match(/(\d{1,2}):(\d{2})/);
  if (!m) return '';
  return `${pad2(Number(m[1]))}:${m[2]}`;
}

function parseCache(raw: string | null): CacheEntry | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as CacheEntry;
    if (!parsed || typeof parsed.at !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function readCache(key: string): Promise<CacheEntry | null> {
  const hit = mem.get(key);
  if (hit) return hit;
  try {
    const parsed = parseCache(await AsyncStorage.getItem(key));
    if (parsed) mem.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(key: string, entry: CacheEntry): Promise<void> {
  mem.set(key, entry);
  try {
    await AsyncStorage.setItem(key, JSON.stringify(entry));
  } catch { /* ignore */ }
}

function parseTimings(raw: unknown, lat: number, lon: number, dateStr: string): PrayerTimes | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const times: PrayerTimes = {
    Fajr: hhmm(t.Fajr),
    Sunrise: hhmm(t.Sunrise),
    Dhuhr: hhmm(t.Dhuhr),
    Asr: hhmm(t.Asr),
    Maghrib: hhmm(t.Maghrib),
    Isha: hhmm(t.Isha),
    date: dateStr,
    lat,
    lon,
  };
  if (!times.Fajr || !times.Dhuhr || !times.Asr || !times.Maghrib || !times.Isha) return null;
  return times;
}

export async function fetchPrayerTimes(
  lat: number,
  lon: number,
  date: Date = new Date(),
): Promise<PrayerTimes | null> {
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const dateStr = prayerDateKey(date);
    const key = prayerCacheKey(lat, lon, dateStr);
    const cached = await readCache(key);
    const now = Date.now();
    if (cached?.times && now - cached.at < CACHE_TTL_MS) return cached.times;
    if (cached?.failed && !cached.times && now - cached.at < FAIL_TTL_MS) return null;

    const ts = Math.floor(date.getTime() / 1000);
    const url = `https://api.aladhan.com/v1/timings/${ts}?latitude=${lat}&longitude=${lon}&method=2`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) {
      if (cached?.times) return cached.times;
      await writeCache(key, { at: now, failed: true, times: cached?.times });
      return null;
    }
    const json = await res.json();
    const times = parseTimings(json?.data?.timings, lat, lon, dateStr);
    if (!times) {
      if (cached?.times) return cached.times;
      await writeCache(key, { at: now, failed: true, times: cached?.times });
      return null;
    }
    await writeCache(key, { at: now, times });
    return times;
  } catch {
    try {
      const dateStr = prayerDateKey(date);
      const key = prayerCacheKey(lat, lon, dateStr);
      const cached = await readCache(key);
      if (cached?.times) return cached.times;
      await writeCache(key, { at: Date.now(), failed: true, times: cached?.times });
    } catch { /* ignore */ }
    return null;
  }
}

function parseMinutes(hhmmStr: string): number | null {
  const m = hhmmStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

function wallMinutes(now: Date, timeZone?: string): number {
  if (!timeZone) return now.getHours() * 60 + now.getMinutes();
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const h = Number(parts.find(p => p.type === 'hour')?.value);
    const min = Number(parts.find(p => p.type === 'minute')?.value);
    if (Number.isFinite(h) && Number.isFinite(min)) return h * 60 + min;
  } catch { /* fall through */ }
  return now.getHours() * 60 + now.getMinutes();
}

function wallMs(dateStr: string, time: string, timeZone?: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const wall = `${dateStr}T${time}:00`;
  if (timeZone) {
    try {
      const ms = fromZonedTime(wall, timeZone).getTime();
      return Number.isFinite(ms) ? ms : null;
    } catch { /* fall through */ }
  }
  const local = new Date(`${wall}`);
  return Number.isNaN(local.getTime()) ? null : local.getTime();
}

export type NextPrayer = {
  name: PrayerName;
  time: string;
  inMs: number;
  tomorrow: boolean;
};

export function getNextPrayer(
  times: PrayerTimes,
  now: Date = new Date(),
  timeZone?: string,
): NextPrayer | null {
  const nowMs = now.getTime();
  const nowMins = wallMinutes(now, timeZone);
  for (const name of NEXT_PRAYER_KEYS) {
    const time = times[name];
    const mins = parseMinutes(time);
    if (mins == null) continue;
    if (mins > nowMins) {
      const at = wallMs(times.date, time, timeZone);
      const inMs = at != null ? Math.max(0, at - nowMs) : (mins - nowMins) * 60 * 1000;
      return { name, time, inMs, tomorrow: false };
    }
  }
  const fajr = times.Fajr;
  const fajrMins = parseMinutes(fajr);
  if (fajrMins == null) return null;
  const fajrAt = wallMs(times.date, fajr, timeZone);
  const inMs = fajrAt != null
    ? Math.max(0, fajrAt + 24 * 60 * 60 * 1000 - nowMs)
    : (24 * 60 - nowMins + fajrMins) * 60 * 1000;
  return { name: 'Fajr', time: fajr, inMs, tomorrow: true };
}

export function formatPrayerClock(hhmmStr: string, timeFormat: TimeFormat = '24h'): string {
  const m = hhmmStr.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return hhmmStr || '--:--';
  const h = Number(m[1]);
  const min = m[2];
  if (timeFormat !== '12h') return `${pad2(h)}:${min}`;
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${min} ${suffix}`;
}

export function formatPrayerCountdown(ms: number, compact = false): string {
  const totalMin = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const min = totalMin % 60;
  if (compact) {
    if (h <= 0) return `${min}min`;
    return min ? `${h}h ${min}m` : `${h}h`;
  }
  if (h <= 0) return `${min}m`;
  return `${h}h ${min}m`;
}
