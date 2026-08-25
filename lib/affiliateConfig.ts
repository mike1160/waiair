import { Linking } from 'react-native';

/** Travelpayouts partner marker — used on every tp.media redirect. */
export const AFFILIATE_MARKER = '706883';
export const AFFILIATE_TRS = '564311';

export const AFFILIATE_CONFIG = {
  flights: {
    aviasales: 'https://tp.media/r?campaign_id=100&marker=706883&p=4114&trs=564311&u=https%3A%2F%2Faviasales.com',
    kiwi: 'https://kiwi.tpx.lu/cy0bYokD',
  },
  hotels: {
    airbnb: 'https://www.airbnb.com',
    hotelscom: 'https://www.hotels.com',
    booking: 'https://www.booking.com',
    agoda: 'https://www.agoda.com',
  },
  activities: {
    klook: 'https://klook.tpx.lu/YOtYeGqc',
    kkday: 'https://kkday.tpx.lu/h8y7FTyS',
    tiqets: 'https://tp.media/r?campaign_id=89&marker=706883&p=2074&sub_id=waiair&trs=564311&u=https%3A%2F%2Ftiqets.com',
    getyourguide: 'https://tpx.lu/Bz4mdd9x',
    gocity: 'https://tp.media/r?campaign_id=62&marker=706883&p=1942&sub_id=waiair&trs=564311&u=https%3A%2F%2Fgocity.com',
    wegotrip: 'https://tp.media/r?campaign_id=150&marker=706883&p=4487&sub_id=waiair&trs=564311&u=https%3A%2F%2Fwegotrip.com',
  },
  esim: {
    airalo: 'https://airalo.tpx.lu/XcNtPQ8C',
    yesim: 'https://yesim.tpx.lu/7c36GQ6d',
    gigsky: 'https://gigsky.tpx.lu/NKsLikxC',
    saily: 'https://saily.tpx.lu/VfChTTnO',
    kkday: 'https://kkday.tpx.lu/h8y7FTyS',
    drimsim: 'https://tp.media/r?campaign_id=102&marker=706883&p=2762&sub_id=waiair&trs=564311&u=https%3A%2F%2Fw1.drimsim.com',
  },
  transfers: {
    gettransfer: 'https://www.gettransfer.com',
    kiwitaxi: 'https://kiwitaxi.tpx.lu/rkyY3eYE',
    welcomepickups: 'https://tp.media/r?campaign_id=627&marker=706883&p=8919&sub_id=waiair&trs=564311&u=https%3A%2F%2Fwelcomepickups.com',
    intui: 'https://tp.media/r?campaign_id=22&marker=706883&p=657&sub_id=waiair&trs=564311&u=https%3A%2F%2Fintui.travel',
  },
  carrental: {
    qeeq: 'https://tp.media/r?campaign_id=172&marker=706883&p=4845&sub_id=waiair&trs=564311&u=https%3A%2F%2Fqeeq.com',
    autoeurope: 'https://autoeurope.tpx.lu/AQ9xbLan',
    autoeuropeeu: 'https://tp.media/r?campaign_id=143&marker=706883&p=4354&sub_id=waiair&trs=564311&u=https%3A%2F%2Fautoeurope.eu',
    localrent: 'https://tp.media/r?campaign_id=87&marker=706883&p=2043&sub_id=waiair&trs=564311&u=https%3A%2F%2Flocalrent.com%2Fen',
    getrentacar: 'https://tp.media/r?campaign_id=222&marker=706883&p=5996&sub_id=waiair&trs=564311&u=https%3A%2F%2Fgetrentacar.com',
    economybookings: 'https://tp.media/r?campaign_id=10&marker=706883&p=2018&sub_id=waiair&trs=564311&u=https%3A%2F%2Fwww.economybookings.com',
  },
  bikes: {
    bikesbooking: 'https://tp.media/r?campaign_id=57&marker=706883&p=1767&sub_id=waiair&trs=564311&u=https%3A%2F%2Fbikesbooking.com',
    localrent: 'https://tp.media/r?campaign_id=87&marker=706883&p=2043&sub_id=waiair&trs=564311&u=https%3A%2F%2Flocalrent.com%2Fen',
  },
  insurance: {
    ekta: 'https://tp.media/r?campaign_id=225&marker=706883&p=5869&sub_id=waiair&trs=564311&u=https%3A%2F%2Fektatraveling.com',
    safetywing: 'https://tp.media/r?campaign_id=285&marker=706883&trs=564311&u=https%3A%2F%2Fsafetywing.com',
  },
  compensation: {
    airhelp: 'https://airhelp.tpx.lu/pFLen7yJ',
    compensair: 'https://tp.media/r?campaign_id=86&marker=706883&p=4129&sub_id=waiair&trs=564311&u=https%3A%2F%2Fcompensair.com',
  },
  luggage: {
    bounce: 'https://go.bounce.com/WAIAIR51730877123974',
  },
  promoCodes: {
    kiwitaxi: 'TPO5',
    kkday: 'IANEWKK10',
  },
} as const;

export const KKDAY_PROMO = `10% off with ${AFFILIATE_CONFIG.promoCodes.kkday}`;
export const KIWITAXI_PROMO = `5% off with ${AFFILIATE_CONFIG.promoCodes.kiwitaxi}`;

/**
 * Travelpayouts campaign IDs for remaining tp.media wrappers (Booking, Agoda, lounge, Trip.com).
 */
export const AFFILIATE_CAMPAIGNS = {
  booking: '200',
  bookingP: '4114',
  agoda: '560',
  loungeBuddy: 'lounge',
  tripCom: '100',
} as const;

export const KIWI = {
  url: AFFILIATE_CONFIG.flights.kiwi,
  campaign_id: '111',
  marker: AFFILIATE_MARKER,
} as const;

export const ASIA_IATA = new Set([
  'BKK', 'DMK', 'CNX', 'HKT', 'USM', 'SGN', 'HAN', 'KUL', 'SIN', 'MNL',
]);

const EUROPE_IATA = new Set(['AMS', 'LHR', 'CDG', 'FRA', 'BCN']);

const ASIA_CC = new Set([
  'TH', 'VN', 'MY', 'SG', 'PH', 'ID', 'KH', 'LA', 'MM', 'BN',
  'JP', 'KR', 'CN', 'TW', 'HK', 'MO', 'IN', 'BD', 'NP', 'LK',
]);

const EUROPE_CC = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'GB', 'UK', 'CH', 'NO', 'IS', 'LI',
]);

export type DestRegion = 'asia' | 'europe' | 'other';

function normCc(country?: string): string {
  const c = String(country || '').trim().toUpperCase();
  if (c === 'UK' || c === 'GBR' || c === 'UNITED KINGDOM') return 'GB';
  if (c === 'NLD' || c === 'NETHERLANDS' || c === 'HOLLAND') return 'NL';
  if (c === 'THA' || c === 'THAILAND') return 'TH';
  return c.length === 2 ? c : '';
}

export function destRegion(iata?: string, country?: string): DestRegion {
  const code = String(iata || '').trim().toUpperCase();
  if (ASIA_IATA.has(code)) return 'asia';
  if (EUROPE_IATA.has(code)) return 'europe';
  const cc = normCc(country);
  if (cc && ASIA_CC.has(cc)) return 'asia';
  if (cc && EUROPE_CC.has(cc)) return 'europe';
  return 'other';
}

export function isEuropeDest(iata?: string, country?: string): boolean {
  return destRegion(iata, country) === 'europe';
}

export function isAsiaDest(iata?: string, country?: string): boolean {
  return destRegion(iata, country) === 'asia';
}

export type AffiliatePick = { key: string; label: string; url: string; hint?: string };

function pick(key: string, label: string, url: string, hint?: string): AffiliatePick {
  return hint ? { key, label, url, hint } : { key, label, url };
}

function kkdayPick(url: string): AffiliatePick {
  return pick('kkday', 'KKday', url, KKDAY_PROMO);
}

export function esimPicks(destIata?: string, destCountry?: string): AffiliatePick[] {
  const e = AFFILIATE_CONFIG.esim;
  const region = destRegion(destIata, destCountry);
  if (region === 'asia') {
    return [
      pick('airalo', 'Airalo', e.airalo),
      kkdayPick(e.kkday),
      pick('yesim', 'Yesim', e.yesim),
    ];
  }
  if (region === 'europe') {
    return [
      pick('airalo', 'Airalo', e.airalo),
      pick('saily', 'Saily', e.saily),
      pick('gigsky', 'GigSky', e.gigsky),
    ];
  }
  return [
    pick('airalo', 'Airalo', e.airalo),
    pick('yesim', 'Yesim', e.yesim),
    pick('drimsim', 'Drimsim', e.drimsim),
  ];
}

export function allEsimPicks(): AffiliatePick[] {
  const e = AFFILIATE_CONFIG.esim;
  return [
    pick('airalo', 'Airalo', e.airalo),
    kkdayPick(e.kkday),
    pick('yesim', 'Yesim', e.yesim),
    pick('saily', 'Saily', e.saily),
    pick('gigsky', 'GigSky', e.gigsky),
    pick('drimsim', 'Drimsim', e.drimsim),
  ];
}

export function activityPicks(destIata?: string, destCountry?: string): AffiliatePick[] {
  const a = AFFILIATE_CONFIG.activities;
  const region = destRegion(destIata, destCountry);
  if (region === 'asia') {
    return [
      pick('klook', 'Klook', a.klook),
      kkdayPick(a.kkday),
      pick('tiqets', 'Tiqets', a.tiqets),
    ];
  }
  if (region === 'europe') {
    return [
      pick('getyourguide', 'GetYourGuide', a.getyourguide),
      pick('tiqets', 'Tiqets', a.tiqets),
      pick('gocity', 'GoCity', a.gocity),
    ];
  }
  return [
    pick('klook', 'Klook', a.klook),
    pick('getyourguide', 'GetYourGuide', a.getyourguide),
    pick('tiqets', 'Tiqets', a.tiqets),
  ];
}

export function allActivityPicks(): AffiliatePick[] {
  const a = AFFILIATE_CONFIG.activities;
  return [
    pick('klook', 'Klook', a.klook),
    kkdayPick(a.kkday),
    pick('tiqets', 'Tiqets', a.tiqets),
    pick('getyourguide', 'GetYourGuide', a.getyourguide),
    pick('gocity', 'GoCity', a.gocity),
    pick('wegotrip', 'WeGoTrip', a.wegotrip),
  ];
}

export function carPicks(destIata?: string, destCountry?: string): AffiliatePick[] {
  const c = AFFILIATE_CONFIG.carrental;
  const region = destRegion(destIata, destCountry);
  if (region === 'asia') {
    return [
      pick('qeeq', 'QEEQ', c.qeeq),
      pick('localrent', 'Localrent', c.localrent),
      pick('getrentacar', 'GetRentACar', c.getrentacar),
    ];
  }
  if (region === 'europe') {
    return [
      pick('autoeuropeeu', 'AutoEurope', c.autoeuropeeu),
      pick('economybookings', 'EconomyBookings', c.economybookings),
      pick('qeeq', 'QEEQ', c.qeeq),
    ];
  }
  return [
    pick('qeeq', 'QEEQ', c.qeeq),
    pick('getrentacar', 'GetRentACar', c.getrentacar),
    pick('economybookings', 'EconomyBookings', c.economybookings),
  ];
}

export function allCarPicks(): AffiliatePick[] {
  const c = AFFILIATE_CONFIG.carrental;
  return [
    pick('qeeq', 'QEEQ', c.qeeq),
    pick('localrent', 'LocalRent', c.localrent),
    pick('getrentacar', 'GetRentACar', c.getrentacar),
    pick('economybookings', 'EconomyBookings', c.economybookings),
    pick('autoeuropeeu', 'AutoEurope', c.autoeuropeeu),
  ];
}

export function bikePicks(destIata?: string, destCountry?: string): AffiliatePick[] {
  if (!isAsiaDest(destIata, destCountry)) return [];
  const b = AFFILIATE_CONFIG.bikes;
  return [
    pick('bikesbooking', 'BikesBooking', b.bikesbooking),
    pick('localrent', 'Localrent', b.localrent),
  ];
}

/** Cars plus a scooter pick in Asia — never more than 3. */
export function carOrScooterPicks(destIata?: string, destCountry?: string): AffiliatePick[] {
  const cars = carPicks(destIata, destCountry);
  const bikes = bikePicks(destIata, destCountry);
  if (bikes.length) return [...cars.slice(0, 2), bikes[0]];
  return cars.slice(0, 3);
}

export function airportTransferPicks(destIata?: string, destCountry?: string): AffiliatePick[] {
  const tr = AFFILIATE_CONFIG.transfers;
  const second = isEuropeDest(destIata, destCountry)
    ? pick('welcomepickups', 'Welcome Pickups', tr.welcomepickups)
    : pick('kiwitaxi', 'Kiwitaxi', tr.kiwitaxi, KIWITAXI_PROMO);
  return [
    pick('gettransfer', 'GetTransfer', tr.gettransfer),
    second,
  ].filter(p => p.url.trim());
}

export function allTransferPicks(): AffiliatePick[] {
  const tr = AFFILIATE_CONFIG.transfers;
  return [
    pick('gettransfer', 'GetTransfer', tr.gettransfer),
    pick('kiwitaxi', 'Kiwitaxi', tr.kiwitaxi, KIWITAXI_PROMO),
    pick('welcomepickups', 'Welcome Pickups', tr.welcomepickups),
    pick('intui', 'Intui', tr.intui),
  ].filter(p => p.url.trim());
}

export function insurancePicks(): AffiliatePick[] {
  const i = AFFILIATE_CONFIG.insurance;
  return [
    pick('ekta', 'EKTA', i.ekta),
    pick('safetywing', 'SafetyWing', i.safetywing),
  ];
}

export function compensationPicks(): AffiliatePick[] {
  const c = AFFILIATE_CONFIG.compensation;
  return [
    pick('airhelp', 'AirHelp', c.airhelp),
    pick('compensair', 'Compensair', c.compensair),
  ];
}

export const MAX_AFFILIATE_SECTIONS = 3;

export const AFFILIATE_SECTION_IDS = [
  'hotelCard',
  'activitiesCard',
  'rentalCarCard',
  'insuranceBanner',
  'earlyCheckIn',
] as const;

const AFFILIATE_SECTION_SET = new Set<string>(AFFILIATE_SECTION_IDS);

/** Data API token from env — never commit the raw key. */
export function travelpayoutsToken(): string {
  return String(
    process.env.EXPO_PUBLIC_AVIASALES_TOKEN || process.env.AVIASALES_TOKEN || '',
  ).trim();
}

function tpMediaUrl(
  campaignId: string,
  destination: string,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({
    campaign_id: campaignId,
    marker: AFFILIATE_MARKER,
    trs: AFFILIATE_TRS,
    ...(extra || {}),
    u: destination,
  });
  return `https://tp.media/r?${params.toString()}`;
}

export function bookingAffiliateUrl(_city: string, _checkIn?: string, _checkOut?: string): string {
  return AFFILIATE_CONFIG.hotels.booking;
}

export function agodaAffiliateUrl(_city: string, _checkIn?: string, _checkOut?: string): string {
  return AFFILIATE_CONFIG.hotels.agoda;
}

export function getYourGuideUrl(_city?: string, _queryExtra?: string): string {
  return AFFILIATE_CONFIG.activities.getyourguide;
}

export function rentalCarsUrl(_iata?: string): string {
  return AFFILIATE_CONFIG.carrental.qeeq;
}

export function safetyWingUrl(): string {
  return AFFILIATE_CONFIG.insurance.safetywing;
}

export function airHelpAffiliateUrl(_flightNumber?: string, _dateIso?: string): string {
  return AFFILIATE_CONFIG.compensation.airhelp;
}

export function aisSimUrl(): string {
  return AFFILIATE_CONFIG.esim.airalo;
}

export function loungeBuddyUrl(): string {
  return 'https://www.loungebuddy.com';
}

export function tripComFlightsUrl(): string {
  return tpMediaUrl(AFFILIATE_CAMPAIGNS.tripCom, 'https://www.trip.com/flights');
}

export function kiwiFlightsUrl(): string {
  return AFFILIATE_CONFIG.flights.kiwi;
}

export function aviasalesAffiliateUrl(): string {
  return AFFILIATE_CONFIG.flights.aviasales;
}

export function getTransferUrl(): string {
  return AFFILIATE_CONFIG.transfers.gettransfer;
}

export function kiwiTaxiUrl(): string {
  return AFFILIATE_CONFIG.transfers.kiwitaxi;
}

export function airbnbUrl(): string {
  return AFFILIATE_CONFIG.hotels.airbnb;
}

export function bounceUrl(): string {
  return AFFILIATE_CONFIG.luggage.bounce;
}

export function stasherUrl(): string {
  return bounceUrl();
}

export async function openAffiliateUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch { /* hide silently */ }
}

export function countriesDiffer(originCountry?: string, destCountry?: string): boolean {
  const a = normCc(originCountry) || String(originCountry || '').trim().toUpperCase();
  const b = normCc(destCountry) || String(destCountry || '').trim().toUpperCase();
  if (!a || !b) return false;
  return a !== b;
}

export function isLongHaulMs(durationMs?: number | null, minHours = 3): boolean {
  return durationMs != null && Number.isFinite(durationMs) && durationMs >= minHours * 3600 * 1000;
}

export function shouldShowAirHelp(status?: string, delayMin?: number): boolean {
  if (String(status || '').toLowerCase() === 'cancelled') return true;
  return (Number(delayMin) || 0) > 120;
}

/** Keep at most 3 affiliate blocks on one screen. Compensation at the top counts as one. */
export function capAffiliateSections(sectionIds: string[], compensationShown: boolean): string[] {
  let left = MAX_AFFILIATE_SECTIONS - (compensationShown ? 1 : 0);
  return sectionIds.filter(id => {
    if (!AFFILIATE_SECTION_SET.has(id)) return true;
    if (left <= 0) return false;
    left -= 1;
    return true;
  });
}

export type LocalLifeCategory =
  | 'money'
  | 'supermarket'
  | 'health'
  | 'hospital'
  | 'coworking'
  | 'deals'
  | 'laundry';

export type LocalLifeService = {
  key: string;
  name: string;
  color: string;
  initials: string;
  url: string;
  logoUrl: string | null;
  emoji?: string;
  regions: string[];
  category: LocalLifeCategory;
  urlByRegion?: Record<string, string>;
};

export const LOCAL_LIFE_CATEGORY_META: Record<LocalLifeCategory, { label: string }> = {
  money: { label: 'GELD & WISSEL' },
  supermarket: { label: 'SUPERMARKT' },
  health: { label: 'GEZONDHEID' },
  hospital: { label: 'ZIEKENHUIS' },
  coworking: { label: 'COWORKING' },
  deals: { label: 'DEALS' },
  laundry: { label: 'LAUNDRY' },
};

export const LOCAL_LIFE_CATEGORY_ORDER: LocalLifeCategory[] = [
  'money',
  'supermarket',
  'health',
  'hospital',
  'coworking',
  'deals',
  'laundry',
];

function lifeInitials(name: string): string {
  if (name === '7-Eleven') return '7E';
  if (name === 'ATM Locator') return 'ATM';
  const parts = name.replace(/-/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}

function life(
  key: string,
  name: string,
  color: string,
  url: string,
  logoUrl: string | null,
  regions: string[],
  category: LocalLifeCategory,
  extra?: { emoji?: string; initials?: string; urlByRegion?: Record<string, string> },
): LocalLifeService {
  return {
    key,
    name,
    color,
    url,
    logoUrl,
    regions,
    category,
    initials: extra?.initials || lifeInitials(name),
    ...(extra?.emoji ? { emoji: extra.emoji } : {}),
    ...(extra?.urlByRegion ? { urlByRegion: extra.urlByRegion } : {}),
  };
}

export const LOCAL_LIFE_SERVICES: LocalLifeService[] = [
  life('superrich', 'Superrich', '#FFD700', 'https://www.superrichthailand.com', 'https://www.superrichthailand.com/favicon.ico', ['BKK', 'DMK', 'HKT'], 'money'),
  life('mammyexchange', 'Mammy Exchange', '#E8001C', 'https://www.mammyexchange.com', 'https://www.mammyexchange.com/favicon.ico', ['BKK', 'DMK'], 'money'),
  life('wise', 'Wise', '#9FE870', 'https://wise.com', 'https://wise.com/favicon.ico', ['ALL'], 'money'),
  life('revolut', 'Revolut', '#0666EB', 'https://revolut.com', 'https://revolut.com/favicon.ico', ['ALL'], 'money'),
  life('atmlocator', 'ATM Locator', '#4A4A4A', 'https://www.google.com/maps/search/ATM+near+me', null, ['ALL'], 'money', { emoji: '🏧' }),
  life('seveneleven', '7-Eleven', '#E8001C', 'https://www.7-eleven.com', 'https://www.7-eleven.com/favicon.ico', ['BKK', 'DMK', 'HKT', 'SIN', 'NRT', 'HND'], 'supermarket'),
  life('familymart', 'FamilyMart', '#0066CC', 'https://www.familymart.co.th', 'https://www.family.co.jp/favicon.ico', ['BKK', 'DMK', 'HKT', 'NRT', 'HND'], 'supermarket'),
  life('topsmarket', 'Tops Market', '#E31837', 'https://www.tops.co.th', 'https://www.tops.co.th/favicon.ico', ['BKK', 'DMK', 'HKT'], 'supermarket'),
  life('makro', 'Makro', '#CC0000', 'https://www.siammakro.co.th', 'https://www.siammakro.co.th/favicon.ico', ['BKK', 'DMK', 'HKT'], 'supermarket'),
  life('albertheijn', 'Albert Heijn', '#00A0E2', 'https://www.ah.nl', 'https://www.ah.nl/favicon.ico', ['AMS', 'RTM', 'EIN'], 'supermarket'),
  life('jumbo', 'Jumbo', '#FFD700', 'https://www.jumbo.com', 'https://www.jumbo.com/favicon.ico', ['AMS', 'RTM', 'EIN'], 'supermarket'),
  life('lidl', 'Lidl', '#0050AA', 'https://www.lidl.com', 'https://www.lidl.com/favicon.ico', ['AMS', 'RTM', 'EIN', 'LHR', 'LGW', 'STN', 'MAN', 'CDG', 'ORY', 'BRU', 'FRA', 'MUC', 'TXL', 'BER', 'MAD', 'BCN', 'FCO', 'MXP', 'LIS', 'ZRH', 'VIE', 'CPH', 'ARN', 'OSL', 'HEL', 'WAW', 'PRG', 'BUD'], 'supermarket'),
  life('tesco', 'Tesco', '#EE1C2E', 'https://www.tesco.com', 'https://www.tesco.com/favicon.ico', ['LHR', 'LGW', 'STN'], 'supermarket'),
  life('carrefour', 'Carrefour', '#004A97', 'https://www.carrefour.com', 'https://www.carrefour.com/favicon.ico', ['DXB', 'AUH', 'CDG', 'ORY'], 'supermarket'),
  life('fairprice', 'FairPrice', '#E31837', 'https://www.fairprice.com.sg', 'https://www.fairprice.com.sg/favicon.ico', ['SIN'], 'supermarket'),
  life('boots', 'Boots', '#004B87', 'https://www.boots.com', 'https://www.boots.com/favicon.ico', ['BKK', 'DMK', 'HKT', 'LHR', 'LGW', 'DXB', 'SIN'], 'health'),
  life('watsons', 'Watsons', '#007AC2', 'https://www.watsons.com.hk', 'https://www.watsons.com/favicon.ico', ['BKK', 'DMK', 'HKT', 'SIN', 'KUL', 'HKG'], 'health', {
    urlByRegion: {
      BKK: 'https://www.watsons.co.th',
      DMK: 'https://www.watsons.co.th',
      HKT: 'https://www.watsons.co.th',
      SIN: 'https://www.watsons.com.sg',
      KUL: 'https://www.watsons.com.my',
      HKG: 'https://www.watsons.com.hk',
      PHL: 'https://www.watsons.com.ph',
      MNL: 'https://www.watsons.com.ph',
      TWN: 'https://www.watsons.com.tw',
      TPE: 'https://www.watsons.com.tw',
      DEFAULT: 'https://www.watsons.com.hk',
    },
  }),
  life('guardian', 'Guardian', '#E31837', 'https://www.guardian.com.sg', 'https://www.guardian.com.sg/favicon.ico', ['SIN', 'KUL'], 'health'),
  life('kruidvat', 'Kruidvat', '#CC0000', 'https://www.kruidvat.nl', 'https://www.kruidvat.nl/favicon.ico', ['AMS', 'RTM', 'EIN'], 'health'),
  life('etos', 'Etos', '#0066CC', 'https://www.etos.nl', 'https://www.etos.nl/favicon.ico', ['AMS', 'RTM', 'EIN'], 'health'),
  life('bumrungrad', 'Bumrungrad', '#003087', 'https://www.bumrungrad.com', 'https://www.bumrungrad.com/favicon.ico', ['BKK', 'DMK'], 'hospital'),
  life('bangkokhosp', 'Bangkok Hosp', '#0054A6', 'https://www.bangkokhospital.com', 'https://www.bangkokhospital.com/favicon.ico', ['BKK', 'DMK', 'HKT'], 'hospital'),
  life('samitivej', 'Samitivej', '#006B3F', 'https://www.samitivejhospitals.com', 'https://www.samitivejhospitals.com/favicon.ico', ['BKK', 'DMK'], 'hospital'),
  life('wework', 'WeWork', '#0000FF', 'https://www.wework.com', 'https://www.wework.com/favicon.ico', ['ALL'], 'coworking'),
  life('regus', 'Regus', '#5B2D8E', 'https://www.regus.com', 'https://www.regus.com/favicon.ico', ['ALL'], 'coworking'),
  life('thehive', 'The Hive', '#F7B731', 'https://thehive.com.hk', 'https://thehive.com.hk/favicon.ico', ['BKK', 'DMK', 'HKG'], 'coworking'),
  life('justco', 'JustCo', '#FF0000', 'https://www.justcollective.com', 'https://www.justcollective.com/favicon.ico', ['SIN', 'BKK'], 'coworking'),
  life('rakuten', 'Rakuten', '#BF0000', 'https://www.rakuten.com', 'https://www.rakuten.com/favicon.ico', ['ALL'], 'deals'),
  life('shopback', 'ShopBack', '#EE3524', 'https://www.shopback.com', 'https://www.shopback.com/favicon.ico', ['BKK', 'DMK', 'HKT', 'SIN', 'KUL', 'HKG', 'NRT'], 'deals'),
  life('coupert', 'Coupert', '#FF6B00', 'https://www.coupert.com', 'https://www.coupert.com/favicon.ico', ['ALL'], 'deals'),
  life('mrwash', 'MrWash', '#00AEEF', 'https://www.mrwash.com', 'https://www.mrwash.com/favicon.ico', ['BKK', 'DMK'], 'laundry'),
  life('laundrymaps', 'Laundry Maps', '#4A4A4A', 'https://www.google.com/maps/search/laundry+near+me', null, ['ALL'], 'laundry', { emoji: '🧺' }),
];

const LOCAL_LIFE_HERO_NAMES = [
  'Superrich',
  'Wise',
  '7-Eleven',
  'Boots',
  'Rakuten',
  'WeWork',
  'Bumrungrad',
  'MrWash',
] as const;

export const LOCAL_LIFE_HERO: LocalLifeService[] = LOCAL_LIFE_HERO_NAMES.map(name => {
  const found = LOCAL_LIFE_SERVICES.find(s => s.name === name);
  if (!found) throw new Error(`Missing local-life hero: ${name}`);
  return found;
});

export function localLifeVisible(destIata?: string): LocalLifeService[] {
  const code = String(destIata || '').trim().toUpperCase();
  return LOCAL_LIFE_SERVICES.filter(s =>
    s.regions.includes('ALL') || (!!code && s.regions.includes(code)),
  );
}

export function localLifeByCategory(
  category: LocalLifeCategory,
  destIata?: string,
): LocalLifeService[] {
  return localLifeVisible(destIata).filter(s => s.category === category);
}

export type EpicPlace = {
  name: string;
  iata: string[];
  emoji: string;
  tag: string;
  tiktokUrl: string;
  instaUrl: string;
};

export const EPIC_DEST_GROUPS: { label: string; iata: string[] }[] = [
  { label: 'Bangkok', iata: ['BKK', 'DMK'] },
  { label: 'Dubai', iata: ['DXB', 'AUH'] },
  { label: 'Amsterdam', iata: ['AMS'] },
  { label: 'London', iata: ['LHR', 'LGW', 'STN'] },
  { label: 'Singapore', iata: ['SIN'] },
  { label: 'Hong Kong', iata: ['HKG'] },
  { label: 'Tokyo', iata: ['NRT', 'HND'] },
  { label: 'Seoul', iata: ['ICN', 'GMP'] },
  { label: 'Shanghai', iata: ['PVG', 'SHA'] },
  { label: 'Beijing', iata: ['PEK', 'PKX'] },
  { label: 'Bali', iata: ['DPS'] },
  { label: 'Istanbul', iata: ['IST', 'SAW'] },
  { label: 'Paris', iata: ['CDG', 'ORY'] },
  { label: 'Rome', iata: ['FCO'] },
  { label: 'Santorini', iata: ['JTR'] },
  { label: 'Osaka', iata: ['KIX'] },
];

function epicPlace(name: string, iata: string[], emoji: string, tag: string): EpicPlace {
  return {
    name,
    iata,
    emoji,
    tag,
    tiktokUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(name)}`,
    instaUrl: `https://www.instagram.com/explore/tags/${tag}`,
  };
}

function epicGroup(iata: string[], items: { name: string; emoji: string; tag: string }[]): EpicPlace[] {
  return items.map(item => epicPlace(item.name, iata, item.emoji, item.tag));
}

/** Rotating Insta-worthy globe: never project more than this many bubbles. */
export const INSTA_WORTHY_MAX = 10;

/** Globally iconic landmarks when the destination has no curated set. */
const INSTA_WORTHY_ICONIC_TAGS = [
  'eiffeltower',
  'burjkhalifa',
  'colosseumrome',
  'oiasantorini',
  'shibuyacrossing',
  'gardensbythebay',
  'grandpalacebangkok',
  'hagiasophia',
  'forbiddencity',
  'marinabasands',
];

export const EPIC_PLACES: EpicPlace[] = [
  ...epicGroup(['BKK', 'DMK'], [
    { name: 'Grand Palace Bangkok', emoji: '🏯', tag: 'grandpalacebangkok' },
    { name: 'Wat Arun', emoji: '⛩️', tag: 'watarun' },
    { name: 'Chatuchak Market', emoji: '🛍️', tag: 'chatuchakmarket' },
    { name: 'Train Night Market', emoji: '🌙', tag: 'trainmarketbangkok' },
    { name: 'Khao San Road', emoji: '🎉', tag: 'khaosanroad' },
    { name: 'Sky Bar Bangkok', emoji: '🌆', tag: 'skybarlebua' },
  ]),
  ...epicGroup(['DXB', 'AUH'], [
    { name: 'Burj Khalifa', emoji: '🏙️', tag: 'burjkhalifa' },
    { name: 'Dubai Creek', emoji: '⛵', tag: 'dubaicreek' },
    { name: 'Gold Souk Dubai', emoji: '✨', tag: 'goldsoukdubai' },
    { name: 'Palm Jumeirah', emoji: '🌴', tag: 'palmjumeirah' },
    { name: 'Museum of the Future', emoji: '🔮', tag: 'museumofthefuture' },
    { name: 'Dubai Frame', emoji: '🖼️', tag: 'dubaiframe' },
  ]),
  ...epicGroup(['AMS'], [
    { name: 'Jordaan Amsterdam', emoji: '🌷', tag: 'jordaanamsterdam' },
    { name: 'NDSM Wharf', emoji: '🎨', tag: 'ndsmamsterdam' },
    { name: 'Bloemenmarkt', emoji: '💐', tag: 'bloemenmarkt' },
    { name: "A'DAM Lookout", emoji: '🎡', tag: 'adamlookout' },
    { name: 'Vondelpark', emoji: '🌿', tag: 'vondelpark' },
    { name: 'De Pijp', emoji: '🍺', tag: 'depijpamsterdam' },
  ]),
  ...epicGroup(['LHR', 'LGW', 'STN'], [
    { name: 'Borough Market', emoji: '🥐', tag: 'boroughmarket' },
    { name: 'Shoreditch London', emoji: '🎭', tag: 'shoreditchlondon' },
    { name: 'Camden Market', emoji: '🎸', tag: 'camdenmarket' },
    { name: 'Sky Garden London', emoji: '🌸', tag: 'skygardenlondon' },
    { name: 'Notting Hill', emoji: '🌺', tag: 'nottinghill' },
    { name: 'Brick Lane', emoji: '🍛', tag: 'bricklane' },
  ]),
  ...epicGroup(['SIN'], [
    { name: 'Gardens by the Bay', emoji: '🌿', tag: 'gardensbythebay' },
    { name: 'Haji Lane', emoji: '🎨', tag: 'hajilane' },
    { name: 'Clarke Quay', emoji: '🍹', tag: 'clarkequay' },
    { name: 'Marina Bay Sands', emoji: '🏊', tag: 'marinabasands' },
    { name: 'Chinatown Singapore', emoji: '🏮', tag: 'chinatownsingapore' },
    { name: 'Hawker Chan', emoji: '🍜', tag: 'hawkerchan' },
  ]),
  ...epicGroup(['HKG'], [
    { name: 'Victoria Peak', emoji: '🌆', tag: 'victoriapeakhk' },
    { name: 'Temple Street', emoji: '🌙', tag: 'templestreethk' },
    { name: 'Mong Kok', emoji: '🛍️', tag: 'mongkok' },
    { name: 'Star Ferry HK', emoji: '⛴️', tag: 'starferryhk' },
    { name: 'Lan Kwai Fong', emoji: '🎉', tag: 'lankwaifong' },
    { name: 'Sham Shui Po', emoji: '🧵', tag: 'shamshuipo' },
  ]),
  ...epicGroup(['NRT', 'HND'], [
    { name: 'Shibuya Crossing', emoji: '🚦', tag: 'shibuyacrossing' },
    { name: 'Shinjuku Tokyo', emoji: '🏮', tag: 'shinjukutokyo' },
    { name: 'Akihabara', emoji: '🎮', tag: 'akihabara' },
    { name: 'Senso-ji Temple', emoji: '⛩️', tag: 'sensoji' },
    { name: 'teamLab Planets', emoji: '🌊', tag: 'teamlabplanets' },
    { name: 'Harajuku', emoji: '🎀', tag: 'harajuku' },
  ]),
  ...epicGroup(['ICN', 'GMP'], [
    { name: 'Gyeongbokgung', emoji: '🏯', tag: 'gyeongbokgung' },
    { name: 'Myeongdong', emoji: '🛍️', tag: 'myeongdong' },
    { name: 'Hongdae Seoul', emoji: '🎨', tag: 'hongdaeseoul' },
    { name: 'Bukchon Hanok', emoji: '🏘️', tag: 'bukchonhanokvillage' },
    { name: 'Gangnam', emoji: '💅', tag: 'gangnamseoul' },
    { name: 'Dongdaemun', emoji: '✂️', tag: 'dongdaemun' },
  ]),
  ...epicGroup(['PVG', 'SHA'], [
    { name: 'The Bund Shanghai', emoji: '🌉', tag: 'thebundshanghai' },
    { name: 'Yu Garden', emoji: '🌸', tag: 'yugarden' },
    { name: 'Xintiandi', emoji: '☕', tag: 'xintiandi' },
    { name: 'M50 Art District', emoji: '🎨', tag: 'm50artdistrict' },
    { name: 'Tianzifang', emoji: '🏮', tag: 'tianzifang' },
    { name: 'Shanghai Tower', emoji: '🏙️', tag: 'shanghaitower' },
  ]),
  ...epicGroup(['PEK', 'PKX'], [
    { name: 'Forbidden City', emoji: '🏯', tag: 'forbiddencity' },
    { name: 'Great Wall China', emoji: '🧱', tag: 'greatwallofchina' },
    { name: 'Sanlitun Beijing', emoji: '🛍️', tag: 'sanlitun' },
    { name: '798 Art District', emoji: '🎨', tag: '798artdistrict' },
    { name: 'Temple of Heaven', emoji: '⛩️', tag: 'templeofheaven' },
    { name: 'Nanluoguxiang', emoji: '🏮', tag: 'nanluoguxiang' },
  ]),
  ...epicGroup(['DPS'], [
    { name: 'Ubud Rice Terraces', emoji: '🌾', tag: 'ububdriceterraces' },
    { name: 'Tanah Lot', emoji: '🌊', tag: 'tanahlot' },
    { name: 'Uluwatu Temple', emoji: '⛩️', tag: 'uluwatu' },
    { name: 'Seminyak Beach', emoji: '🏖️', tag: 'seminyakbali' },
    { name: 'Sacred Monkey Forest', emoji: '🐒', tag: 'monkeyforestubud' },
    { name: 'Tirta Empul', emoji: '💧', tag: 'tirtaempul' },
  ]),
  ...epicGroup(['IST', 'SAW'], [
    { name: 'Hagia Sophia', emoji: '🕌', tag: 'hagiasophia' },
    { name: 'Grand Bazaar Istanbul', emoji: '🛍️', tag: 'grandbazaaristanbul' },
    { name: 'Galata Tower', emoji: '🗼', tag: 'galatatower' },
    { name: 'Bosphorus Istanbul', emoji: '⛵', tag: 'bosphorusistanbul' },
    { name: 'Balat District', emoji: '🎨', tag: 'balatistanbul' },
    { name: 'Kapalıçarşı', emoji: '✨', tag: 'kapalicarsi' },
  ]),
  ...epicGroup(['CDG', 'ORY'], [
    { name: 'Eiffel Tower', emoji: '🗼', tag: 'eiffeltower' },
    { name: 'Montmartre Paris', emoji: '🎨', tag: 'montmartreparis' },
    { name: 'Le Marais', emoji: '🥐', tag: 'lemarais' },
    { name: 'Louvre Museum', emoji: '🖼️', tag: 'louvremuseum' },
    { name: 'Seine River Paris', emoji: '🌊', tag: 'seineparis' },
    { name: 'Palais Royal', emoji: '👑', tag: 'palaisroyal' },
  ]),
  ...epicGroup(['FCO'], [
    { name: 'Colosseum Rome', emoji: '🏛️', tag: 'colosseumrome' },
    { name: 'Trevi Fountain', emoji: '⛲', tag: 'trevifountain' },
    { name: 'Vatican City', emoji: '⛪', tag: 'vaticancity' },
    { name: 'Trastevere Rome', emoji: '🍕', tag: 'trastevere' },
    { name: 'Spanish Steps', emoji: '🌺', tag: 'spanishsteps' },
    { name: 'Pantheon Rome', emoji: '🏛️', tag: 'pantheonrome' },
  ]),
  ...epicGroup(['JTR'], [
    { name: 'Oia Santorini', emoji: '🤍', tag: 'oiasantorini' },
    { name: 'Fira Santorini', emoji: '🌅', tag: 'firasantorini' },
    { name: 'Red Beach', emoji: '🏖️', tag: 'redbeachsantorini' },
    { name: 'Caldera View', emoji: '🌋', tag: 'calderasantorini' },
    { name: 'Amoudi Bay', emoji: '⛵', tag: 'amoudibay' },
    { name: 'Akrotiri', emoji: '🏺', tag: 'akrotirisantorini' },
  ]),
  ...epicGroup(['KIX'], [
    { name: 'Dotonbori', emoji: '🦞', tag: 'dotonbori' },
    { name: 'Namba Osaka', emoji: '🏮', tag: 'nambaosaka' },
    { name: 'Osaka Castle', emoji: '🏯', tag: 'osakacastle' },
    { name: 'Kuromon Market', emoji: '🐟', tag: 'kuromon' },
    { name: 'Shinsekai', emoji: '🎡', tag: 'shinsekai' },
    { name: 'Amerikamura', emoji: '🎸', tag: 'amerikamura' },
  ]),
];

function epicPlacesIconicFallback(): EpicPlace[] {
  const byTag = new Map(EPIC_PLACES.map(place => [place.tag, place]));
  const picked = INSTA_WORTHY_ICONIC_TAGS
    .map(tag => byTag.get(tag))
    .filter((place): place is EpicPlace => !!place);
  if (picked.length >= INSTA_WORTHY_MAX) return picked.slice(0, INSTA_WORTHY_MAX);
  const extra = EPIC_PLACES.filter(place => !picked.includes(place));
  return [...picked, ...extra].slice(0, INSTA_WORTHY_MAX);
}

export function epicPlacesVisible(destIata?: string): EpicPlace[] {
  const code = String(destIata || '').trim().toUpperCase();
  if (code) {
    const matched = EPIC_PLACES.filter(p => p.iata.includes(code));
    if (matched.length) return matched.slice(0, INSTA_WORTHY_MAX);
  }
  return epicPlacesIconicFallback();
}

export function epicPlacesHero(destIata?: string): EpicPlace[] {
  const visible = epicPlacesVisible(destIata);
  if (visible.length >= 8) return visible.slice(0, 8);
  const extra = EPIC_PLACES.filter(p => !visible.includes(p));
  return [...visible, ...extra].slice(0, 8);
}

export function epicPlacesGrouped(destIata?: string): { label: string; places: EpicPlace[] }[] {
  const visible = epicPlacesVisible(destIata);
  return EPIC_DEST_GROUPS.map(group => ({
    label: group.label,
    places: visible.filter(p => p.iata.some(code => group.iata.includes(code))),
  })).filter(group => group.places.length > 0);
}
