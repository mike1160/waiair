import { Alert, Linking } from 'react-native';
import { t } from './i18n';

export type TransportKind = 'rail' | 'grab' | 'taxi' | 'bolt' | 'bus';
export type TransportOption = { kind: TransportKind; name: string; price: string };
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
      { kind: 'rail', name: 'Rail Link', price: '45฿' },
      { kind: 'grab', name: 'Grab', price: '~350฿' },
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
      { kind: 'grab', name: 'Grab', price: '~280฿' },
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
      { kind: 'grab', name: 'Grab Patong', price: '~600฿' },
      { kind: 'bolt', name: 'Bolt', price: '~500฿' },
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
      { kind: 'rail', name: 'MRT', price: '$2.50' },
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
      { kind: 'rail', name: 'KLIA Ekspres', price: 'RM55' },
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
  if (opt.kind === 'taxi') {
    await openUrl(mapsDirUrl(airportName, city, lat, lng, 11));
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

export function townTransportButtons(destIata?: string): TransportOption[] {
  const code = String(destIata || '').trim().toUpperCase();
  const info = TRANSPORT_INFO[code];
  if (!info) return [];
  return info.options.filter(o => o.kind === 'grab' || o.kind === 'bolt' || o.kind === 'taxi');
}
