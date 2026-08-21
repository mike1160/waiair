import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AFFILIATE_CONFIG,
  AFFILIATE_MARKER,
  AFFILIATE_TRS,
  openAffiliateUrl,
} from './affiliateConfig';

export const SERVICE_VIEW_KEY = 'waiair.serviceView.v1';
export type ServiceViewMode = 'globe' | 'list';

export const CATEGORIES = {
  transport: { label: 'Vervoer', services: ['Grab', 'InDrive', 'Bolt'] },
  transfer: { label: 'Airport transfer', services: ['Kiwitaxi', 'Welcome Pickups', 'Intui'] },
  hotels: { label: 'Hotels', services: ['Agoda', 'Booking.com', 'Airbnb', 'Hotels.com'] },
  esim: { label: 'eSIM', services: ['Airalo', 'Yesim', 'Saily', 'GigSky', 'KKday', 'Drimsim'] },
  activities: { label: 'Activiteiten', services: ['Klook', 'KKday', 'Tiqets', 'GetYourGuide', 'GoCity', 'WeGoTrip'] },
  car: { label: 'Autoverhuur', services: ['QEEQ', 'LocalRent', 'GetRentACar', 'EconomyBookings', 'AutoEurope'] },
  bikes: { label: 'Scooter/fiets', services: ['BikesBooking', 'LocalRent'] },
  insurance: { label: 'Verzekering', services: ['EKTA', 'SafetyWing'] },
  compensation: { label: 'Compensatie', services: ['AirHelp', 'Compensair'] },
  luggage: { label: 'Bagage', services: ['Bounce'] },
  flights: { label: 'Vluchten', services: ['Aviasales', 'Kiwi.com'] },
} as const;

export type GlobeCategory = keyof typeof CATEGORIES;

export type GlobeService = {
  key: string;
  name: string;
  color: string;
  initials: string;
  category: GlobeCategory;
};

export type GlobeServiceCtx = {
  city?: string;
  checkIn?: string;
  checkOut?: string;
};

type CatalogEntry = {
  key: string;
  name: string;
  color: string;
  initials: string;
};

const CATALOG: CatalogEntry[] = [
  { key: 'grab', name: 'Grab', color: '#00B14F', initials: 'G' },
  { key: 'indrive', name: 'InDrive', color: '#C6FF00', initials: 'ID' },
  { key: 'bolt', name: 'Bolt', color: '#34D186', initials: 'B' },
  { key: 'gettransfer', name: 'GetTransfer', color: '#00A651', initials: 'GT' },
  { key: 'kiwitaxi', name: 'Kiwitaxi', color: '#FFCC00', initials: 'KT' },
  { key: 'welcomepickups', name: 'Welcome Pickups', color: '#C9A84C', initials: 'WP' },
  { key: 'intui', name: 'Intui', color: '#2E5BFF', initials: 'IN' },
  { key: 'agoda', name: 'Agoda', color: '#E5132C', initials: 'A' },
  { key: 'booking', name: 'Booking.com', color: '#003580', initials: 'B' },
  { key: 'airbnb', name: 'Airbnb', color: '#FF5A5F', initials: 'AB' },
  { key: 'hotelscom', name: 'Hotels.com', color: '#E31837', initials: 'HC' },
  { key: 'airalo', name: 'Airalo', color: '#6B4EFF', initials: 'AI' },
  { key: 'yesim', name: 'Yesim', color: '#FF9500', initials: 'Y' },
  { key: 'saily', name: 'Saily', color: '#111111', initials: 'S' },
  { key: 'gigsky', name: 'GigSky', color: '#00A3E0', initials: 'GS' },
  { key: 'kkday', name: 'KKday', color: '#FF6B35', initials: 'K' },
  { key: 'drimsim', name: 'Drimsim', color: '#E31E24', initials: 'D' },
  { key: 'klook', name: 'Klook', color: '#FF5722', initials: 'KL' },
  { key: 'tiqets', name: 'Tiqets', color: '#00A896', initials: 'T' },
  { key: 'getyourguide', name: 'GetYourGuide', color: '#FF5533', initials: 'GY' },
  { key: 'gocity', name: 'GoCity', color: '#1A1A2E', initials: 'GC' },
  { key: 'wegotrip', name: 'WeGoTrip', color: '#6C5CE7', initials: 'WG' },
  { key: 'qeeq', name: 'QEEQ', color: '#00B4D8', initials: 'Q' },
  { key: 'localrent', name: 'LocalRent', color: '#2D9C5A', initials: 'LR' },
  { key: 'getrentacar', name: 'GetRentACar', color: '#1B4F72', initials: 'GR' },
  { key: 'economybookings', name: 'EconomyBookings', color: '#E67E22', initials: 'EB' },
  { key: 'autoeurope', name: 'AutoEurope', color: '#003366', initials: 'AE' },
  { key: 'bikesbooking', name: 'BikesBooking', color: '#00A651', initials: 'BB' },
  { key: 'ekta', name: 'EKTA', color: '#2C3E8C', initials: 'EK' },
  { key: 'safetywing', name: 'SafetyWing', color: '#7B61FF', initials: 'SW' },
  { key: 'airhelp', name: 'AirHelp', color: '#1DA1F2', initials: 'AH' },
  { key: 'compensair', name: 'Compensair', color: '#0B1F3A', initials: 'CA' },
  { key: 'bounce', name: 'Bounce', color: '#FF3B30', initials: 'B' },
  { key: 'aviasales', name: 'Aviasales', color: '#FF6D00', initials: 'AS' },
  { key: 'kiwi', name: 'Kiwi.com', color: '#00B2A9', initials: 'KW' },
];

const CATALOG_BY_NAME = new Map(CATALOG.map(s => [s.name, s]));

/** Curated sphere dots — one visual set, each with a real affiliate URL. */
const GLOBE_DOT_NAMES: { name: string; category: GlobeCategory }[] = [
  { name: 'Airalo', category: 'esim' },
  { name: 'KKday', category: 'activities' },
  { name: 'Klook', category: 'activities' },
  { name: 'QEEQ', category: 'car' },
  { name: 'Tiqets', category: 'activities' },
  { name: 'Yesim', category: 'esim' },
  { name: 'Bounce', category: 'luggage' },
  { name: 'AirHelp', category: 'compensation' },
  { name: 'Kiwitaxi', category: 'transfer' },
  { name: 'Saily', category: 'esim' },
  { name: 'Aviasales', category: 'flights' },
  { name: 'Kiwi.com', category: 'flights' },
  { name: 'EKTA', category: 'insurance' },
  { name: 'Agoda', category: 'hotels' },
  { name: 'Hotels.com', category: 'hotels' },
  { name: 'BikesBooking', category: 'bikes' },
];

export const GLOBE_CATEGORY_ORDER = Object.keys(CATEGORIES) as GlobeCategory[];

function campaignUrl(campaignId: string, dest: string, extra?: Record<string, string>): string {
  const params = new URLSearchParams({
    campaign_id: campaignId,
    marker: AFFILIATE_MARKER,
    trs: AFFILIATE_TRS,
    ...(extra || {}),
    u: dest,
  });
  return `https://tp.media/r?${params.toString()}`;
}

function isTrackingUrl(url: string): boolean {
  return /adjust\.com|google-analytics|doubleclick|googletagmanager/i.test(url);
}

export function isValidAffiliateUrl(url: string): boolean {
  const trimmed = String(url || '').trim();
  if (!trimmed) return false;
  if (isTrackingUrl(trimmed)) return false;
  return true;
}

export function globeServiceUrl(service: Pick<GlobeService, 'key'>, ctx?: GlobeServiceCtx): string {
  const cfg = AFFILIATE_CONFIG;
  switch (service.key) {
    case 'airalo': return cfg.esim.airalo;
    case 'yesim': return cfg.esim.yesim;
    case 'saily': return cfg.esim.saily;
    case 'gigsky': return cfg.esim.gigsky;
    case 'kkday': return cfg.activities.kkday;
    case 'drimsim': return cfg.esim.drimsim;
    case 'klook': return cfg.activities.klook;
    case 'tiqets': return cfg.activities.tiqets;
    case 'getyourguide': return cfg.activities.getyourguide;
    case 'gocity': return cfg.activities.gocity;
    case 'wegotrip': return cfg.activities.wegotrip;
    case 'qeeq': return cfg.carrental.qeeq;
    case 'localrent': return cfg.carrental.localrent;
    case 'getrentacar': return cfg.carrental.getrentacar;
    case 'economybookings': return cfg.carrental.economybookings;
    case 'autoeurope': return cfg.carrental.autoeurope;
    case 'bikesbooking': return cfg.bikes.bikesbooking;
    case 'gettransfer': return cfg.transfers.gettransfer;
    case 'kiwitaxi': return cfg.transfers.kiwitaxi;
    case 'welcomepickups': return cfg.transfers.welcomepickups;
    case 'intui': return cfg.transfers.intui;
    case 'ekta': return cfg.insurance.ekta;
    case 'safetywing': return cfg.insurance.safetywing;
    case 'airhelp': return cfg.compensation.airhelp;
    case 'compensair': return cfg.compensation.compensair;
    case 'bounce': return cfg.luggage.bounce;
    case 'aviasales': return cfg.flights.aviasales;
    case 'kiwi': return cfg.flights.kiwi;
    case 'airbnb': return cfg.hotels.airbnb;
    case 'hotelscom': return cfg.hotels.hotelscom;
    case 'agoda': return cfg.hotels.agoda;
    case 'booking': return cfg.hotels.booking;
    default:
      return '';
  }
}

function withCategory(entry: CatalogEntry, category: GlobeCategory): GlobeService {
  return { ...entry, category };
}

function isLinked(service: Pick<GlobeService, 'key'>, ctx?: GlobeServiceCtx): boolean {
  return isValidAffiliateUrl(globeServiceUrl(service, ctx));
}

export const GLOBE_SERVICES: GlobeService[] = GLOBE_DOT_NAMES
  .map(({ name, category }) => {
    const entry = CATALOG_BY_NAME.get(name);
    return entry ? withCategory(entry, category) : null;
  })
  .filter((s): s is GlobeService => !!s && isLinked(s));

export function servicesByCategory(category: GlobeCategory, ctx?: GlobeServiceCtx): GlobeService[] {
  return CATEGORIES[category].services
    .map(name => CATALOG_BY_NAME.get(name))
    .filter((s): s is CatalogEntry => !!s)
    .map(s => withCategory(s, category))
    .filter(s => isLinked(s, ctx));
}

export function globeInkColor(hex: string): string {
  const raw = hex.replace('#', '');
  const full = raw.length === 3
    ? raw.split('').map(ch => ch + ch).join('')
    : raw;
  const n = parseInt(full, 16);
  if (Number.isNaN(n)) return '#FFFFFF';
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0A1628' : '#FFFFFF';
}

export async function openGlobeService(service: GlobeService, ctx?: GlobeServiceCtx): Promise<void> {
  const url = globeServiceUrl(service, ctx);
  if (isValidAffiliateUrl(url)) await openAffiliateUrl(url);
}

export async function loadServiceViewMode(): Promise<ServiceViewMode> {
  try {
    const raw = await AsyncStorage.getItem(SERVICE_VIEW_KEY);
    return raw === 'list' ? 'list' : 'globe';
  } catch {
    return 'globe';
  }
}

export async function saveServiceViewMode(mode: ServiceViewMode): Promise<void> {
  try {
    await AsyncStorage.setItem(SERVICE_VIEW_KEY, mode);
  } catch { /* ignore */ }
}
