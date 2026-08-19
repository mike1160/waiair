import { Alert, Linking } from 'react-native';
import { t } from './i18n';
import { getAirportLabel } from './transportExtras';

export type TransportKind = 'rail' | 'grab' | 'taxi' | 'bolt' | 'indrive' | 'bus';
export type TransportOption = { kind: TransportKind; name: string; price: string; url?: string };
export type TransportInfo = {
  options: TransportOption[];
  name: string;
  city: string;
  railDest?: string;
  grabCountry: string;
  lat: number;
  lng: number;
  bolt: string | null;
};

export const TRANSPORT_INFO: Record<string, TransportInfo> = {
  BKK: {
    options: [
      { kind: 'rail', name: 'Airport Rail Link', price: '45฿', url: 'https://www.srtet.co.th' },
      { kind: 'bus', name: 'Airport Bus', price: '35฿', url: 'https://www.srtet.co.th' },
      { kind: 'grab', name: 'Grab', price: '~350฿' },
      { kind: 'indrive', name: 'inDrive', price: '~300฿' },
      { kind: 'taxi', name: 'Taxi', price: '~500฿' },
    ],
    name: 'Suvarnabhumi Airport',
    city: 'Bangkok',
    railDest: 'Phaya Thai Station',
    grabCountry: 'th',
    lat: 13.6811,
    lng: 100.7475,
    bolt: null,
  },
  DMK: {
    options: [
      { kind: 'bus', name: 'Bus A1', price: '30฿' },
      { kind: 'bus', name: 'Minivan', price: '~150฿' },
      { kind: 'grab', name: 'Grab', price: '~280฿' },
      { kind: 'indrive', name: 'inDrive', price: '~250฿' },
      { kind: 'taxi', name: 'Taxi', price: '~400฿' },
    ],
    name: 'Don Mueang Airport',
    city: 'Bangkok',
    grabCountry: 'th',
    lat: 13.9126,
    lng: 100.6067,
    bolt: null,
  },
  HKT: {
    options: [
      { kind: 'bus', name: 'Airport Bus', price: '100฿', url: 'https://www.airportphuketbus.com' },
      { kind: 'grab', name: 'Grab Patong', price: '~600฿' },
      { kind: 'bolt', name: 'Bolt', price: '~500฿' },
      { kind: 'indrive', name: 'inDrive', price: '~450฿' },
      { kind: 'taxi', name: 'Taxi', price: '~650฿' },
    ],
    name: 'Phuket Airport',
    city: 'Phuket',
    grabCountry: 'th',
    lat: 8.1132,
    lng: 98.3169,
    bolt: null,
  },
  CNX: {
    options: [
      { kind: 'grab', name: 'Grab', price: '~120฿' },
      { kind: 'bolt', name: 'Bolt', price: '~100฿' },
      { kind: 'indrive', name: 'inDrive', price: '~90฿' },
      { kind: 'taxi', name: 'Taxi', price: '~150฿' },
    ],
    name: 'Chiang Mai Airport',
    city: 'Chiang Mai',
    grabCountry: 'th',
    lat: 18.7668,
    lng: 98.9628,
    bolt: null,
  },
  SIN: {
    options: [
      { kind: 'rail', name: 'MRT', price: '$2.50', url: 'https://www.lta.gov.sg' },
      { kind: 'grab', name: 'Grab', price: '~$25' },
      { kind: 'taxi', name: 'Taxi', price: '~$30' },
    ],
    name: 'Changi Airport',
    city: 'Singapore',
    railDest: 'City Hall MRT Station',
    grabCountry: 'sg',
    lat: 1.3644,
    lng: 103.9915,
    bolt: null,
  },
  KUL: {
    options: [
      { kind: 'rail', name: 'KLIA Ekspres', price: 'RM55', url: 'https://www.kliaekspres.com' },
      { kind: 'grab', name: 'Grab', price: '~RM45' },
    ],
    name: 'Kuala Lumpur International Airport',
    city: 'Kuala Lumpur',
    railDest: 'KL Sentral',
    grabCountry: 'my',
    lat: 2.7456,
    lng: 101.7099,
    bolt: null,
  },
  SGN: {
    options: [
      { kind: 'bus', name: 'Bus 109', price: '20k₫' },
      { kind: 'grab', name: 'Grab', price: '~150k₫' },
    ],
    name: 'Tan Son Nhat Airport',
    city: 'Ho Chi Minh City',
    grabCountry: 'vn',
    lat: 10.8188,
    lng: 106.6520,
    bolt: null,
  },
  HAN: {
    options: [
      { kind: 'bus', name: 'Bus 86', price: '9k₫' },
      { kind: 'grab', name: 'Grab', price: '~200k₫' },
    ],
    name: 'Noi Bai Airport',
    city: 'Hanoi',
    grabCountry: 'vn',
    lat: 21.2212,
    lng: 105.8072,
    bolt: null,
  },
  CGK: {
    options: [
      { kind: 'rail', name: 'Railink', price: 'Rp70k' },
      { kind: 'grab', name: 'Grab', price: '~Rp150k' },
    ],
    name: 'Soekarno-Hatta Airport',
    city: 'Jakarta',
    railDest: 'Manggarai Station',
    grabCountry: 'id',
    lat: -6.1256,
    lng: 106.6559,
    bolt: null,
  },
  DPS: {
    options: [
      { kind: 'grab', name: 'Grab', price: '~Rp120k' },
      { kind: 'taxi', name: 'Taxi Kuta', price: '~Rp150k' },
    ],
    name: 'Ngurah Rai Airport',
    city: 'Kuta',
    grabCountry: 'id',
    lat: -8.7481,
    lng: 115.1670,
    bolt: null,
  },
  MNL: {
    options: [
      { kind: 'grab', name: 'Grab', price: '~₱400' },
      { kind: 'taxi', name: 'Taxi', price: '~₱500' },
    ],
    name: 'Ninoy Aquino Airport',
    city: 'Manila',
    grabCountry: 'ph',
    lat: 14.5086,
    lng: 121.0194,
    bolt: null,
  },
  AMS: {
    options: [
      { kind: 'rail', name: 'Train to Centraal', price: '€5.90', url: 'https://www.ns.nl' },
    ],
    name: 'Amsterdam Schiphol Airport',
    city: 'Amsterdam',
    railDest: 'Amsterdam Centraal',
    grabCountry: 'nl',
    lat: 52.3105,
    lng: 4.7683,
    bolt: null,
  },
  LHR: {
    options: [
      { kind: 'rail', name: 'Elizabeth Line / Heathrow Express', price: 'from £12', url: 'https://www.heathrowexpress.com' },
    ],
    name: 'London Heathrow Airport',
    city: 'London',
    railDest: 'Paddington Station',
    grabCountry: 'gb',
    lat: 51.4700,
    lng: -0.4543,
    bolt: null,
  },
  FRA: {
    options: [
      { kind: 'rail', name: 'S-Bahn', price: '€5.35', url: 'https://www.bahn.de' },
    ],
    name: 'Frankfurt Airport',
    city: 'Frankfurt',
    railDest: 'Frankfurt Hauptbahnhof',
    grabCountry: 'de',
    lat: 50.0379,
    lng: 8.5622,
    bolt: null,
  },
  CDG: {
    options: [
      { kind: 'rail', name: 'RER B', price: '€11.80', url: 'https://www.ratp.fr' },
    ],
    name: 'Paris Charles de Gaulle Airport',
    city: 'Paris',
    railDest: 'Gare du Nord',
    grabCountry: 'fr',
    lat: 49.0097,
    lng: 2.5479,
    bolt: null,
  },
  BCN: {
    options: [
      { kind: 'bus', name: 'Aerobus', price: '€7.25', url: 'https://www.aerobusbcn.com' },
    ],
    name: 'Barcelona El Prat Airport',
    city: 'Barcelona',
    grabCountry: 'es',
    lat: 41.2974,
    lng: 2.0833,
    bolt: null,
  },
  MAD: {
    options: [
      { kind: 'rail', name: 'Metro Line 8', price: '€5.00', url: 'https://www.metromadrid.es' },
    ],
    name: 'Madrid Barajas Airport',
    city: 'Madrid',
    railDest: 'Nuevos Ministerios',
    grabCountry: 'es',
    lat: 40.4983,
    lng: -3.5676,
    bolt: null,
  },
  FCO: {
    options: [
      { kind: 'rail', name: 'Leonardo Express', price: '€14', url: 'https://www.trenitalia.com' },
    ],
    name: 'Rome Fiumicino Airport',
    city: 'Rome',
    railDest: 'Roma Termini',
    grabCountry: 'it',
    lat: 41.8003,
    lng: 12.2389,
    bolt: null,
  },
  MUC: {
    options: [
      { kind: 'rail', name: 'S-Bahn S1/S8', price: '€13.60', url: 'https://www.mvv-muenchen.de' },
    ],
    name: 'Munich Airport',
    city: 'Munich',
    railDest: 'München Hauptbahnhof',
    grabCountry: 'de',
    lat: 48.3537,
    lng: 11.7750,
    bolt: null,
  },
  ZRH: {
    options: [
      { kind: 'rail', name: 'Train', price: 'CHF 8.80', url: 'https://www.sbb.ch' },
    ],
    name: 'Zurich Airport',
    city: 'Zurich',
    railDest: 'Zürich HB',
    grabCountry: 'ch',
    lat: 47.4647,
    lng: 8.5492,
    bolt: null,
  },
  VIE: {
    options: [
      { kind: 'rail', name: 'CAT City Airport Train', price: '€12', url: 'https://www.cityairporttrain.com' },
    ],
    name: 'Vienna International Airport',
    city: 'Vienna',
    railDest: 'Wien Mitte',
    grabCountry: 'at',
    lat: 48.1103,
    lng: 16.5697,
    bolt: null,
  },
  BRU: {
    options: [
      { kind: 'rail', name: 'Airport Express', price: '€9.30', url: 'https://www.belgiantrain.be' },
    ],
    name: 'Brussels Airport',
    city: 'Brussels',
    railDest: 'Brussels Central',
    grabCountry: 'be',
    lat: 50.9010,
    lng: 4.4856,
    bolt: null,
  },
  CPH: {
    options: [
      { kind: 'rail', name: 'Metro', price: 'DKK 36', url: 'https://www.m.dk' },
    ],
    name: 'Copenhagen Airport',
    city: 'Copenhagen',
    railDest: 'København H',
    grabCountry: 'dk',
    lat: 55.6180,
    lng: 12.6500,
    bolt: null,
  },
  ARN: {
    options: [
      { kind: 'rail', name: 'Arlanda Express', price: 'SEK 299', url: 'https://www.arlandaexpress.com' },
    ],
    name: 'Stockholm Arlanda Airport',
    city: 'Stockholm',
    railDest: 'Stockholm Central',
    grabCountry: 'se',
    lat: 59.6519,
    lng: 17.9186,
    bolt: null,
  },
  HKG: {
    options: [
      { kind: 'rail', name: 'Airport Express', price: 'HK$115', url: 'https://www.mtr.com.hk' },
    ],
    name: 'Hong Kong International Airport',
    city: 'Hong Kong',
    railDest: 'Hong Kong Station',
    grabCountry: 'hk',
    lat: 22.3080,
    lng: 113.9185,
    bolt: null,
  },
  DXB: {
    options: [
      { kind: 'rail', name: 'Metro', price: 'AED 6', url: 'https://www.rta.ae/wps/portal/rta/ae/public-transport' },
    ],
    name: 'Dubai International Airport',
    city: 'Dubai',
    grabCountry: 'ae',
    lat: 25.2532,
    lng: 55.3657,
    bolt: null,
  },
  AUH: {
    options: [
      { kind: 'bus', name: 'A1 Bus', price: 'AED 4', url: 'https://www.darb.ae' },
    ],
    name: 'Abu Dhabi International Airport',
    city: 'Abu Dhabi',
    grabCountry: 'ae',
    lat: 24.4330,
    lng: 54.6511,
    bolt: null,
  },
  DOH: {
    options: [
      { kind: 'rail', name: 'Metro', price: 'QAR 6', url: 'https://www.qr.com.qa' },
    ],
    name: 'Hamad International Airport',
    city: 'Doha',
    grabCountry: 'qa',
    lat: 25.2609,
    lng: 51.6138,
    bolt: null,
  },
};

function mapsDirUrl(airportName: string, destination: string, lat: number, lng: number, zoom = 11): string {
  return `https://www.google.com/maps/dir/${encodeURIComponent(airportName)}/${encodeURIComponent(destination)}/@${lat},${lng},${zoom}z`;
}

async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch { /* ignore */ }
}

export async function openGrab(): Promise<void> {
  const grabUrl = 'grab://open';
  const grabFallback = 'https://apps.apple.com/app/grab/id647268330';
  try {
    if (await Linking.canOpenURL(grabUrl)) {
      await Linking.openURL(grabUrl);
      return;
    }
  } catch { /* fall through */ }
  try {
    await Linking.openURL(grabUrl);
  } catch {
    await Linking.openURL(grabFallback);
  }
}

export async function openBolt(): Promise<void> {
  const boltUrl = 'bolt://';
  try {
    if (await Linking.canOpenURL(boltUrl)) {
      await Linking.openURL(boltUrl);
      return;
    }
  } catch {
    try {
      await Linking.openURL(boltUrl);
      return;
    } catch { /* show alert below */ }
  }
  Alert.alert('Bolt', t().downloadBolt);
}

export async function openInDrive(): Promise<void> {
  const indriveUrl = 'indrive://';
  const indriveFallback = 'https://indrive.com';
  try {
    if (await Linking.canOpenURL(indriveUrl)) {
      await Linking.openURL(indriveUrl);
      return;
    }
  } catch { /* fall through */ }
  try {
    await Linking.openURL(indriveUrl);
  } catch {
    await openUrl(indriveFallback);
  }
}

export async function openUber(): Promise<void> {
  const uberUrl = 'uber://';
  const uberFallback = 'https://m.uber.com';
  try {
    if (await Linking.canOpenURL(uberUrl)) {
      await Linking.openURL(uberUrl);
      return;
    }
  } catch { /* fall through */ }
  try {
    await Linking.openURL(uberUrl);
  } catch {
    await openUrl(uberFallback);
  }
}

export async function openTransportOption(opt: TransportOption, info: TransportInfo): Promise<void> {
  const { name: airportName, city, lat, lng } = info;
  if (opt.kind === 'grab') {
    await openGrab();
    return;
  }
  if (opt.kind === 'bolt') {
    await openBolt();
    return;
  }
  if (opt.kind === 'indrive') {
    await openInDrive();
    return;
  }
  if (opt.kind === 'taxi') {
    await openUrl(mapsDirUrl(airportName, city, lat, lng, 11));
    return;
  }
  if (opt.kind === 'rail' || opt.kind === 'bus') {
    if (opt.url) {
      await openUrl(opt.url);
      return;
    }
    const dest = info.railDest ?? city;
    const zoom = info.railDest ? 12 : 11;
    if (info.railDest) {
      await openUrl(mapsDirUrl(airportName, dest, lat, lng, zoom));
      return;
    }
    await openUrl(
      `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(airportName)}&destination=${encodeURIComponent(dest)}&travelmode=transit`,
    );
  }
}

export function townTransportButtons(destIata?: string): TransportOption[] {
  const code = String(destIata || '').trim().toUpperCase();
  const info = TRANSPORT_INFO[code];
  if (!info) return [];
  return info.options.filter(
    o =>
      o.kind === 'grab'
      || o.kind === 'bolt'
      || o.kind === 'indrive'
      || o.kind === 'taxi'
      || o.kind === 'rail'
      || o.kind === 'bus',
  );
}

const TOP_BY_IATA: Record<string, string[]> = {
  HKT: ['grab', 'indrive', 'bus'],
  BKK: ['grab', 'indrive', 'bus'],
  DMK: ['grab', 'indrive', 'bus'],
  CNX: ['grab', 'indrive', 'bus'],
  SIN: ['grab', 'train', 'taxi'],
  KUL: ['grab', 'train', 'taxi'],
  AMS: ['train', 'bolt', 'taxi'],
  FRA: ['train', 'bolt', 'taxi'],
  CDG: ['train', 'bolt', 'taxi'],
  LHR: ['train', 'uber', 'taxi'],
  DXB: ['uber', 'taxi', 'train'],
  AUH: ['uber', 'taxi', 'train'],
  DOH: ['uber', 'taxi', 'train'],
};

const DEFAULT_TOP = ['uber', 'taxi', 'train'] as const;

/** Exactly 3 transport types for the landing transport card. */
export function topTransportOptions(iata: string): string[] {
  const code = String(iata || '').trim().toUpperCase();
  const opts = TOP_BY_IATA[code];
  if (opts?.length === 3) return opts;
  return [...DEFAULT_TOP];
}

function findOption(info: TransportInfo | undefined, kind: TransportKind): TransportOption | undefined {
  return info?.options.find(o => o.kind === kind);
}

export async function openTopTransport(type: string, destIata: string): Promise<void> {
  const code = String(destIata || '').trim().toUpperCase();
  const info = TRANSPORT_INFO[code];
  const { name: airportName, city } = getAirportLabel(code);

  switch (type) {
    case 'grab':
      await openGrab();
      return;
    case 'indrive':
      await openInDrive();
      return;
    case 'bolt':
      await openBolt();
      return;
    case 'uber':
      await openUber();
      return;
    case 'taxi':
      if (info) {
        await openUrl(mapsDirUrl(info.name, info.city, info.lat, info.lng, 11));
      } else {
        await openUrl(
          `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`taxi near ${airportName}`)}`,
        );
      }
      return;
    case 'train': {
      const rail = findOption(info, 'rail');
      if (rail && info) {
        await openTransportOption(rail, info);
        return;
      }
      if (info) {
        await openUrl(mapsDirUrl(airportName, info.railDest ?? info.city, info.lat, info.lng, 12));
        return;
      }
      await openUrl(
        `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(airportName)}&destination=${encodeURIComponent(city)}&travelmode=transit`,
      );
      return;
    }
    case 'bus': {
      const bus = findOption(info, 'bus');
      if (bus && info) {
        await openTransportOption(bus, info);
        return;
      }
      await openUrl(
        `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`bus ${airportName}`)}`,
      );
      return;
    }
    default:
      return;
  }
}
