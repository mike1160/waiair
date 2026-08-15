import AsyncStorage from '@react-native-async-storage/async-storage';

/** Hardcoded lounge + Fast Track data until LoungeReview API is wired. */

export type LoungeAccessTag =
  | 'Priority Pass'
  | 'DragonPass'
  | 'Business Class'
  | 'Any Business'
  | string;

export type Lounge = {
  name: string;
  terminal: string;
  hours: string;
  access: LoungeAccessTag[];
  amenities: string[];
  airline?: string;
  airlineIata?: string;
  lat?: number;
  lng?: number;
};

export type FastTrackLane = {
  name: string;
  terminal: string;
  hours: string;
  access: string[];
  notes?: string;
};

export const LOUNGES: Record<string, Lounge[]> = {
  HKT: [
    {
      name: 'Coral Lounge',
      terminal: 'T1',
      hours: '05:00–23:00',
      access: ['Priority Pass', 'DragonPass', 'Business Class'],
      amenities: ['WiFi', 'Food', 'Drinks', 'AC'],
      lat: 8.1132,
      lng: 98.3017,
    },
    {
      name: 'Royal Silk Lounge',
      terminal: 'T1',
      airline: 'Thai Airways',
      airlineIata: 'TG',
      hours: '04:30–23:30',
      access: ['Thai Business/First', 'Star Alliance Gold'],
      amenities: ['WiFi', 'Food', 'Drinks'],
    },
  ],
  BKK: [
    {
      name: 'Royal Orchid Lounge',
      terminal: 'T1',
      airline: 'Thai Airways',
      airlineIata: 'TG',
      hours: '04:00–00:00',
      access: ['Thai Business/First', 'Star Alliance Gold'],
      amenities: ['WiFi', 'Food', 'Showers', 'Spa'],
    },
    {
      name: 'Miracle First Class Lounge',
      terminal: 'T1',
      hours: '24h',
      access: ['Priority Pass', 'DragonPass', 'Any Business'],
      amenities: ['WiFi', 'Food', 'Showers', 'Massage'],
    },
    {
      name: 'Coral Executive Lounge',
      terminal: 'T2',
      hours: '05:00–23:00',
      access: ['Priority Pass', 'DragonPass'],
      amenities: ['WiFi', 'Food', 'Drinks'],
    },
  ],
  DMK: [
    {
      name: 'Miracle Lounge Don Mueang',
      terminal: 'T1',
      hours: '05:00–23:00',
      access: ['Priority Pass', 'DragonPass'],
      amenities: ['WiFi', 'Food', 'Drinks'],
    },
  ],
  AMS: [
    {
      name: 'KLM Crown Lounge',
      terminal: 'Pier F',
      airline: 'KLM',
      airlineIata: 'KL',
      hours: '05:00–22:00',
      access: ['KLM Business', 'SkyTeam Elite Plus'],
      amenities: ['WiFi', 'Hot Food', 'Showers', 'Bar'],
    },
    {
      name: 'Aspire Lounge',
      terminal: 'Pier H',
      hours: '05:00–22:00',
      access: ['Priority Pass', 'DragonPass'],
      amenities: ['WiFi', 'Food', 'Drinks'],
    },
  ],
  SIN: [
    {
      name: 'SilverKris Lounge',
      terminal: 'T3',
      airline: 'Singapore Airlines',
      airlineIata: 'SQ',
      hours: '24h',
      access: ['SQ Business/First', 'Star Alliance Gold'],
      amenities: ['WiFi', 'Fine Dining', 'Showers', 'Nap Rooms'],
    },
    {
      name: 'SATS Premier Lounge',
      terminal: 'T2',
      hours: '24h',
      access: ['Priority Pass', 'DragonPass', 'Any Business'],
      amenities: ['WiFi', 'Food', 'Showers'],
    },
  ],
  KUL: [
    {
      name: 'Plaza Premium Lounge',
      terminal: 'KLIA',
      hours: '24h',
      access: ['Priority Pass', 'DragonPass', 'Any Business'],
      amenities: ['WiFi', 'Food', 'Showers', 'Spa'],
    },
  ],
  DXB: [
    {
      name: 'Emirates Business Lounge',
      terminal: 'T3',
      airline: 'Emirates',
      airlineIata: 'EK',
      hours: '24h',
      access: ['Emirates Business/First'],
      amenities: ['WiFi', 'Fine Dining', 'Showers', 'Spa', 'Pool'],
    },
    {
      name: 'Marhaba Lounge',
      terminal: 'T1',
      hours: '24h',
      access: ['Priority Pass', 'DragonPass'],
      amenities: ['WiFi', 'Food', 'Showers'],
    },
  ],
};

export const FAST_TRACK: Record<string, FastTrackLane[]> = {
  HKT: [
    {
      name: 'Fast Track Immigration',
      terminal: 'T1',
      hours: 'Follows flight schedule',
      access: ['Business Class', 'First Class', 'Paid service'],
      notes: 'Paid Fast Track at arrivals and departures.',
    },
  ],
  BKK: [
    {
      name: 'Fast Track',
      terminal: 'T1',
      hours: 'Follows flight schedule',
      access: ['Thai Business/First', 'Star Alliance Gold', 'Paid service'],
    },
  ],
  DMK: [
    {
      name: 'Fast Track',
      terminal: 'T1',
      hours: '05:00–23:00',
      access: ['Business Class', 'Paid service'],
    },
  ],
  AMS: [
    {
      name: 'Privium / Fast Track',
      terminal: 'All piers',
      hours: '05:00–22:00',
      access: ['KLM Business', 'SkyTeam Elite Plus', 'Privium'],
    },
  ],
  SIN: [
    {
      name: 'FAST / Fast Track',
      terminal: 'T2 · T3',
      hours: '24h',
      access: ['SQ Business/First', 'Star Alliance Gold'],
    },
  ],
  KUL: [
    {
      name: 'Fast Track',
      terminal: 'KLIA',
      hours: '24h',
      access: ['Business Class', 'Any Business'],
    },
  ],
  DXB: [
    {
      name: 'Emirates Fast Track',
      terminal: 'T3',
      hours: '24h',
      access: ['Emirates Business/First'],
    },
  ],
};

export type LoungeCardId =
  | 'none'
  | 'amex_plat'
  | 'csr'
  | 'venture_x'
  | 'amex_biz_plat'
  | 'priority_pass'
  | 'dragonpass';

export type AllianceStatusId =
  | 'none'
  | 'star_gold'
  | 'skyteam_plus'
  | 'oneworld_sapphire'
  | 'oneworld_emerald';

export type TicketClassId = 'economy' | 'premium' | 'business' | 'first';

export const LOUNGE_CARDS: { id: LoungeCardId; label: string; grants: Array<'pp' | 'dragon'> }[] = [
  { id: 'none', label: 'No card', grants: [] },
  { id: 'amex_plat', label: 'Amex Platinum', grants: ['pp'] },
  { id: 'csr', label: 'Chase Sapphire Reserve', grants: ['pp'] },
  { id: 'venture_x', label: 'Capital One Venture X', grants: ['pp'] },
  { id: 'amex_biz_plat', label: 'Amex Business Platinum', grants: ['pp'] },
  { id: 'priority_pass', label: 'Priority Pass', grants: ['pp'] },
  { id: 'dragonpass', label: 'DragonPass', grants: ['dragon'] },
];

export const ALLIANCE_STATUS: { id: AllianceStatusId; label: string }[] = [
  { id: 'none', label: 'No status' },
  { id: 'star_gold', label: 'Star Alliance Gold' },
  { id: 'skyteam_plus', label: 'SkyTeam Elite Plus' },
  { id: 'oneworld_sapphire', label: 'oneworld Sapphire' },
  { id: 'oneworld_emerald', label: 'oneworld Emerald' },
];

export const TICKET_CLASSES: { id: TicketClassId; label: string }[] = [
  { id: 'economy', label: 'Economy' },
  { id: 'premium', label: 'Premium economy' },
  { id: 'business', label: 'Business' },
  { id: 'first', label: 'First' },
];

export type LoungeAccessPrefs = {
  card: LoungeCardId;
  status: AllianceStatusId;
  ticket: TicketClassId;
};

const ACCESS_KEY = 'waiair.loungeAccess.v1';

export function defaultLoungeAccess(): LoungeAccessPrefs {
  return { card: 'none', status: 'none', ticket: 'economy' };
}

export async function loadLoungeAccess(): Promise<LoungeAccessPrefs> {
  try {
    const raw = await AsyncStorage.getItem(ACCESS_KEY);
    if (!raw) return defaultLoungeAccess();
    const parsed = JSON.parse(raw);
    return {
      card: parsed?.card || 'none',
      status: parsed?.status || 'none',
      ticket: parsed?.ticket || 'economy',
    };
  } catch {
    return defaultLoungeAccess();
  }
}

export async function saveLoungeAccess(prefs: LoungeAccessPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(ACCESS_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

function tagsOf(item: { access: string[] }): string {
  return item.access.join(' ').toLowerCase();
}

export function hasPriorityPass(card: LoungeCardId): boolean {
  return !!LOUNGE_CARDS.find(c => c.id === card)?.grants.includes('pp');
}

export function hasDragonPass(card: LoungeCardId): boolean {
  return !!LOUNGE_CARDS.find(c => c.id === card)?.grants.includes('dragon');
}

export function canAccessLounge(
  lounge: Lounge,
  prefs: LoungeAccessPrefs,
  airlineIata?: string,
): boolean {
  const tags = tagsOf(lounge);
  if (hasPriorityPass(prefs.card) && tags.includes('priority pass')) return true;
  if (hasDragonPass(prefs.card) && tags.includes('dragon')) return true;

  if (prefs.status === 'star_gold' && tags.includes('star alliance')) return true;
  if (prefs.status === 'skyteam_plus' && tags.includes('skyteam')) return true;
  if (
    (prefs.status === 'oneworld_sapphire' || prefs.status === 'oneworld_emerald')
    && tags.includes('oneworld')
  ) return true;

  const isBiz = prefs.ticket === 'business' || prefs.ticket === 'first';
  if (isBiz && (tags.includes('any business') || tags.includes('business class'))) {
    return true;
  }
  if (isBiz && lounge.airlineIata && airlineIata && lounge.airlineIata === airlineIata.toUpperCase()) {
    return true;
  }
  return false;
}

export function canAccessFastTrack(
  lane: FastTrackLane,
  prefs: LoungeAccessPrefs,
  airlineIata?: string,
): boolean {
  const tags = tagsOf(lane);
  if (prefs.status === 'star_gold' && tags.includes('star alliance')) return true;
  if (prefs.status === 'skyteam_plus' && tags.includes('skyteam')) return true;
  const isBiz = prefs.ticket === 'business' || prefs.ticket === 'first';
  if (isBiz && (tags.includes('any business') || tags.includes('business class') || tags.includes('first class'))) {
    return true;
  }
  if (isBiz && airlineIata && /klm|thai|emirates|sq /i.test(tags)) {
    const map: Record<string, string> = { KL: 'klm', TG: 'thai', EK: 'emirates', SQ: 'sq' };
    const needle = map[airlineIata.toUpperCase()];
    if (needle && tags.includes(needle)) return true;
  }
  return false;
}

export function loungesFor(iata: string): Lounge[] {
  return LOUNGES[String(iata || '').toUpperCase()] || [];
}

export function fastTrackFor(iata: string): FastTrackLane[] {
  return FAST_TRACK[String(iata || '').toUpperCase()] || [];
}
