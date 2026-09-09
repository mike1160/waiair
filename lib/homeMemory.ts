/** Empty-home memory: last trip, return-chip, welcome-back. Pure rules + AsyncStorage. */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const HOME_MEMORY_KEY = 'waiair.home.memory.v1';

export type HomeMemory = {
  lastOriginIata: string;
  lastDestIata: string;
  lastOriginCity: string;
  lastDestCity: string;
  travelDayYmd: string;
  returnChipDismissed: boolean;
  hasTrackedOnce: boolean;
};

export type TrackedMemoryInput = {
  originIata: string;
  destIata: string;
  originCity?: string;
  destCity?: string;
  travelDayYmd: string;
};

export function memoryAfterTrack(prev: HomeMemory | null, add: TrackedMemoryInput): HomeMemory {
  const originIata = String(add.originIata || '').trim().toUpperCase();
  const destIata = String(add.destIata || '').trim().toUpperCase();
  return {
    lastOriginIata: originIata,
    lastDestIata: destIata,
    lastOriginCity: String(add.originCity || '').trim() || originIata,
    lastDestCity: String(add.destCity || '').trim() || destIata,
    travelDayYmd: String(add.travelDayYmd || '').slice(0, 10),
    returnChipDismissed: false,
    hasTrackedOnce: true,
  };
}

export function dismissReturnChip(mem: HomeMemory): HomeMemory {
  return { ...mem, returnChipDismissed: true };
}

/** Chip after an add: once, until tap or the origin travel day has passed. */
export function shouldShowReturnChip(mem: HomeMemory | null, nowYmd: string): boolean {
  if (!mem?.hasTrackedOnce) return false;
  if (mem.returnChipDismissed) return false;
  if (!mem.lastOriginIata || !mem.lastDestIata) return false;
  if (mem.lastOriginIata === mem.lastDestIata) return false;
  if (!mem.lastOriginCity) return false;
  const day = mem.travelDayYmd;
  if (!day) return false;
  return String(nowYmd || '').slice(0, 10) <= day;
}

/** Empty home, user has flown before (memory survives untrack). */
export function shouldShowWelcomeBack(mem: HomeMemory | null, trackedCount: number): boolean {
  if (trackedCount > 0) return false;
  return !!mem?.hasTrackedOnce && !!mem.lastDestIata;
}

export type ReversePrefill = {
  query: string;
  originIata: string;
  destIata: string;
  destCity: string;
};

/** Reverse the last outbound; no date. Query is IATA pair so the parser is locale-proof. */
export function reverseRoutePrefill(mem: HomeMemory): ReversePrefill {
  const originIata = mem.lastDestIata;
  const destIata = mem.lastOriginIata;
  return {
    query: `${originIata} ${destIata}`.trim(),
    originIata,
    destIata,
    destCity: mem.lastOriginCity,
  };
}

function parseMemory(raw: string | null): HomeMemory | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<HomeMemory>;
    if (!data || typeof data !== 'object') return null;
    if (!data.hasTrackedOnce) return null;
    return {
      lastOriginIata: String(data.lastOriginIata || '').toUpperCase(),
      lastDestIata: String(data.lastDestIata || '').toUpperCase(),
      lastOriginCity: String(data.lastOriginCity || ''),
      lastDestCity: String(data.lastDestCity || ''),
      travelDayYmd: String(data.travelDayYmd || '').slice(0, 10),
      returnChipDismissed: !!data.returnChipDismissed,
      hasTrackedOnce: true,
    };
  } catch {
    return null;
  }
}

export async function loadHomeMemory(): Promise<HomeMemory | null> {
  try {
    return parseMemory(await AsyncStorage.getItem(HOME_MEMORY_KEY));
  } catch {
    return null;
  }
}

export async function saveHomeMemory(mem: HomeMemory): Promise<void> {
  try {
    await AsyncStorage.setItem(HOME_MEMORY_KEY, JSON.stringify(mem));
  } catch {
    /* ignore */
  }
}
