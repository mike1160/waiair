/** Empty-home memory: last trip, return-chip, welcome-back. Pure rules + AsyncStorage. */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const HOME_MEMORY_KEY = 'waiair.home.memory.v1';

export type HomeMemory = {
  lastOriginIata: string;
  lastDestIata: string;
  lastOriginCity: string;
  lastDestCity: string;
  travelDayYmd: string;
  /** Dest-local YMD of outbound arrival; chips for a return sit after this day. */
  arrivalDayYmd?: string;
  returnChipDismissed: boolean;
  hasTrackedOnce: boolean;
  /** Dest of a flight that reached landed/done while tracked. Empty until then. */
  lastLandedDestIata: string;
  lastLandedDestCity: string;
  destReachedLanded: boolean;
};

export type TrackedMemoryInput = {
  originIata: string;
  destIata: string;
  originCity?: string;
  destCity?: string;
  travelDayYmd: string;
  arrivalDayYmd?: string;
};

/** Dest-again / welcome-back: only after landed/done while tracked. */
export function shouldRememberDestination(input: {
  status?: string | null;
  phase?: string | null;
}): boolean {
  const compact = String(input.status || '').toLowerCase().replace(/[_\s-]/g, '');
  if (
    compact === 'cancelled' || compact === 'canceled'
    || compact === 'diverted' || compact === 'diversion' || compact === 'rerouted'
  ) {
    return false;
  }
  if (compact === 'landed' || compact === 'arrived') return true;
  const ph = String(input.phase || '').toLowerCase();
  if (ph === 'cancelled' || ph === 'diverted') return false;
  return ph === 'baggage' || ph === 'transport' || ph === 'done';
}

export function memoryAfterTrack(prev: HomeMemory | null, add: TrackedMemoryInput): HomeMemory {
  const originIata = String(add.originIata || '').trim().toUpperCase();
  const destIata = String(add.destIata || '').trim().toUpperCase();
  return {
    lastOriginIata: originIata,
    lastDestIata: destIata,
    lastOriginCity: String(add.originCity || '').trim() || originIata,
    lastDestCity: String(add.destCity || '').trim() || destIata,
    travelDayYmd: String(add.travelDayYmd || '').slice(0, 10),
    arrivalDayYmd: String(add.arrivalDayYmd || '').slice(0, 10),
    returnChipDismissed: false,
    hasTrackedOnce: true,
    lastLandedDestIata: prev?.lastLandedDestIata || '',
    lastLandedDestCity: prev?.lastLandedDestCity || '',
    destReachedLanded: !!(prev?.destReachedLanded && prev.lastLandedDestIata),
  };
}

export function memoryAfterLanding(prev: HomeMemory | null, add: TrackedMemoryInput): HomeMemory {
  const destIata = String(add.destIata || '').trim().toUpperCase();
  const destCity = String(add.destCity || '').trim() || destIata;
  const originIata = String(add.originIata || '').trim().toUpperCase();
  const originCity = String(add.originCity || '').trim() || originIata;
  if (prev) {
    return {
      ...prev,
      lastLandedDestIata: destIata,
      lastLandedDestCity: destCity,
      destReachedLanded: true,
      hasTrackedOnce: true,
    };
  }
  return {
    lastOriginIata: originIata,
    lastDestIata: destIata,
    lastOriginCity: originCity,
    lastDestCity: destCity,
    travelDayYmd: String(add.travelDayYmd || '').slice(0, 10),
    arrivalDayYmd: String(add.arrivalDayYmd || '').slice(0, 10),
    returnChipDismissed: false,
    hasTrackedOnce: true,
    lastLandedDestIata: destIata,
    lastLandedDestCity: destCity,
    destReachedLanded: true,
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
  return !!mem?.destReachedLanded && !!mem.lastLandedDestIata;
}

export type ReversePrefill = {
  query: string;
  originIata: string;
  destIata: string;
  destCity: string;
  /** Dest-local arrival day of the outbound, else the origin travel day. */
  anchorYmd: string;
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
    anchorYmd: String(mem.arrivalDayYmd || mem.travelDayYmd || '').slice(0, 10),
  };
}

function needsDestClear(data: Partial<HomeMemory>): boolean {
  return !data.destReachedLanded;
}

export function parseHomeMemory(raw: string | null): HomeMemory | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<HomeMemory>;
    if (!data || typeof data !== 'object') return null;
    if (!data.hasTrackedOnce) return null;
    const destReachedLanded = !!data.destReachedLanded;
    const lastLandedDestIata = destReachedLanded
      ? String(data.lastLandedDestIata || '').toUpperCase()
      : '';
    const lastLandedDestCity = destReachedLanded
      ? String(data.lastLandedDestCity || '')
      : '';
    return {
      lastOriginIata: String(data.lastOriginIata || '').toUpperCase(),
      lastDestIata: String(data.lastDestIata || '').toUpperCase(),
      lastOriginCity: String(data.lastOriginCity || ''),
      lastDestCity: String(data.lastDestCity || ''),
      travelDayYmd: String(data.travelDayYmd || '').slice(0, 10),
      arrivalDayYmd: String(data.arrivalDayYmd || '').slice(0, 10),
      returnChipDismissed: !!data.returnChipDismissed,
      hasTrackedOnce: true,
      lastLandedDestIata,
      lastLandedDestCity,
      destReachedLanded: destReachedLanded && !!lastLandedDestIata,
    };
  } catch {
    return null;
  }
}

export function storedMemoryNeedsPersist(raw: string | null): boolean {
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as Partial<HomeMemory> & { destReachedLanded?: unknown };
    if (!data || typeof data !== 'object') return false;
    return needsDestClear(data) && (!!data.lastDestIata || data.destReachedLanded == null);
  } catch {
    return false;
  }
}

export async function loadHomeMemory(): Promise<HomeMemory | null> {
  try {
    const raw = await AsyncStorage.getItem(HOME_MEMORY_KEY);
    const mem = parseHomeMemory(raw);
    if (mem && storedMemoryNeedsPersist(raw)) {
      await saveHomeMemory(mem);
    }
    return mem;
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
