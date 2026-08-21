import AsyncStorage from '@react-native-async-storage/async-storage';

export type MilesMembership = {
  airlineCode: string;
  program: string;
  memberNumber: string;
  tier: 'none' | 'silver' | 'gold' | 'platinum';
};

const KEY_PREFIX = 'waiair.miles.';
const TIERS = new Set<MilesMembership['tier']>(['none', 'silver', 'gold', 'platinum']);

function storageKey(airlineCode: string): string {
  return `${KEY_PREFIX}${String(airlineCode || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2)}`;
}

function parseMembership(raw: string | null): MilesMembership | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MilesMembership>;
    const airlineCode = String(parsed.airlineCode || '').toUpperCase();
    const memberNumber = String(parsed.memberNumber || '').trim();
    const program = String(parsed.program || '').trim();
    const tier = parsed.tier;
    if (!airlineCode || !memberNumber || !program || !tier || !TIERS.has(tier)) return null;
    return { airlineCode, program, memberNumber, tier };
  } catch {
    return null;
  }
}

export async function saveMembership(m: MilesMembership): Promise<void> {
  const airlineCode = String(m.airlineCode || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (!airlineCode) return;
  const row: MilesMembership = {
    airlineCode,
    program: String(m.program || '').trim(),
    memberNumber: String(m.memberNumber || '').trim(),
    tier: TIERS.has(m.tier) ? m.tier : 'none',
  };
  try {
    await AsyncStorage.setItem(storageKey(airlineCode), JSON.stringify(row));
  } catch {
    /* ignore */
  }
}

export async function getMembership(airlineCode: string): Promise<MilesMembership | null> {
  const code = String(airlineCode || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (!code) return null;
  try {
    return parseMembership(await AsyncStorage.getItem(storageKey(code)));
  } catch {
    return null;
  }
}

export async function getAllMemberships(): Promise<MilesMembership[]> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const milesKeys = keys.filter(k => k.startsWith(KEY_PREFIX));
    if (!milesKeys.length) return [];
    const pairs = await AsyncStorage.multiGet(milesKeys);
    const out: MilesMembership[] = [];
    for (const [, raw] of pairs) {
      const row = parseMembership(raw);
      if (row) out.push(row);
    }
    return out;
  } catch {
    return [];
  }
}

export async function deleteMembership(airlineCode: string): Promise<void> {
  const code = String(airlineCode || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2);
  if (!code) return;
  try {
    await AsyncStorage.removeItem(storageKey(code));
  } catch {
    /* ignore */
  }
}
