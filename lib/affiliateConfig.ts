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
    airbnb: 'airbnb://',
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
    gettransfer: '',
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

export function bookingAffiliateUrl(city: string, checkIn?: string, checkOut?: string): string {
  const inner = new URL('https://www.booking.com/searchresults.html');
  inner.searchParams.set('ss', city);
  if (checkIn) inner.searchParams.set('checkin', checkIn);
  if (checkOut) inner.searchParams.set('checkout', checkOut);
  return tpMediaUrl(AFFILIATE_CAMPAIGNS.booking, inner.toString(), {
    p: AFFILIATE_CAMPAIGNS.bookingP,
  });
}

export function agodaAffiliateUrl(city: string, checkIn?: string, checkOut?: string): string {
  const inner = new URL('https://www.agoda.com/search');
  inner.searchParams.set('city', city);
  if (checkIn) inner.searchParams.set('checkIn', checkIn);
  if (checkOut) inner.searchParams.set('checkOut', checkOut);
  inner.searchParams.set('adults', '1');
  return tpMediaUrl(AFFILIATE_CAMPAIGNS.agoda, inner.toString());
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
  return tpMediaUrl(AFFILIATE_CAMPAIGNS.loungeBuddy, 'https://www.loungebuddy.com');
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
