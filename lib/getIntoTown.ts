import { Linking } from 'react-native';

export const RIDEHAILING: Record<string, string[]> = {
  BKK: ['Grab', 'Bolt', 'InDrive'],
  DMK: ['Grab', 'Bolt', 'InDrive'],
  CNX: ['Grab', 'InDrive'],
  HKT: ['Grab', 'InDrive'],
  USM: ['Grab'],
  SIN: ['Grab', 'Gojek'],
  KUL: ['Grab'],
  SGN: ['Grab', 'Be'],
  HAN: ['Grab', 'Be'],
  CGK: ['Grab', 'Gojek'],
  DPS: ['Grab', 'Gojek'],
  MNL: ['Grab', 'InDrive'],
  RGN: ['Grab'],
  NRT: ['Uber', 'GO'],
  HND: ['Uber', 'GO'],
  KIX: ['Uber', 'GO'],
  ICN: ['Kakao T', 'Uber'],
  PUS: ['Kakao T', 'Uber'],
  HKG: ['Uber'],
  PEK: ['DiDi'],
  PVG: ['DiDi'],
  CAN: ['DiDi'],
  DXB: ['Uber', 'Careem'],
  DOH: ['Uber', 'Careem'],
  AUH: ['Uber', 'Careem'],
  AMS: ['Bolt', 'Uber'],
  LHR: ['Uber', 'Bolt'],
  CDG: ['Uber', 'Bolt'],
  FRA: ['Uber', 'Bolt'],
  BCN: ['Uber', 'Bolt', 'Cabify'],
  IST: ['Uber', 'BiTaksi'],
  JFK: ['Uber', 'Lyft'],
  LAX: ['Uber', 'Lyft'],
  MIA: ['Uber', 'Lyft'],
  MEX: ['Uber', 'DiDi', 'InDrive'],
  GRU: ['Uber', '99', 'InDrive'],
  BOG: ['Uber', 'InDrive', 'DiDi'],
  JNB: ['Uber', 'Bolt', 'InDrive'],
  NBO: ['Uber', 'Bolt', 'InDrive'],
  LOS: ['Uber', 'Bolt', 'InDrive'],
  DEL: ['Uber', 'Ola', 'Rapido'],
  BOM: ['Uber', 'Ola', 'Rapido'],
  DAC: ['Uber', 'Pathao', 'Shohoz'],
  KHI: ['Uber', 'InDrive'],
  SVO: ['Yandex Go'],
  LED: ['Yandex Go'],
  SYD: ['Uber', 'Ola'],
  MEL: ['Uber', 'Ola'],
  DEFAULT: ['Uber', 'InDrive'],
};

export const RIDEHAILING_LINKS: Record<string, string> = {
  Grab: 'grab://',
  Uber: 'uber://',
  Bolt: 'bolt://',
  InDrive: 'indrive://',
  Gojek: 'gojek://',
  DiDi: 'didiglobal://',
  Careem: 'careem://',
  'Kakao T': 'kakaot://',
  'Yandex Go': 'yandexnavi://',
  BiTaksi: 'bitaksi://',
  Ola: 'olacabs://',
  Lyft: 'lyft://',
  GO: 'gomobility://',
  Be: 'be://',
  Pathao: 'pathao://',
  Cabify: 'cabify://',
  '99': 'ninetynine://',
  Shohoz: 'shohoz://',
  Rapido: 'rapido://',
};

const RIDEHAILING_WEB: Record<string, string> = {
  Grab: 'https://www.grab.com',
  Uber: 'https://m.uber.com',
  Bolt: 'https://bolt.eu',
  InDrive: 'https://indrive.com',
  Gojek: 'https://www.gojek.com',
  DiDi: 'https://www.didiglobal.com',
  Careem: 'https://www.careem.com',
  'Kakao T': 'https://www.kakaomobility.com',
  'Yandex Go': 'https://taxi.yandex.com',
  BiTaksi: 'https://www.bitaksi.com',
  Ola: 'https://www.olacabs.com',
  Lyft: 'https://www.lyft.com',
  GO: 'https://go.goinc.jp',
  Be: 'https://be.com.vn',
  Pathao: 'https://pathao.com',
  Cabify: 'https://cabify.com',
  '99': 'https://99app.com',
  Shohoz: 'https://shohoz.com',
  Rapido: 'https://rapido.bike',
};

export const RIDE_COLORS: Record<string, string> = {
  Grab: '#00B14F',
  Uber: '#000000',
  Bolt: '#34D186',
  InDrive: '#C6FF00',
  Gojek: '#00AA13',
  DiDi: '#FF7D41',
  Careem: '#49B265',
  'Kakao T': '#FEE500',
  'Yandex Go': '#FC3F1D',
  BiTaksi: '#00AEEF',
  Ola: '#111111',
  Lyft: '#FF00BF',
  GO: '#06C755',
  Be: '#FFD100',
  Pathao: '#E31E24',
  Cabify: '#7145D6',
  '99': '#FFDD00',
  Shohoz: '#00A651',
  Rapido: '#F9A825',
};

export const PUBLIC_TRANSPORT: Record<string, { name: string; url: string }[]> = {
  BKK: [
    { name: 'BTS Skytrain', url: 'https://www.bts.co.th' },
    { name: 'MRT', url: 'https://www.bangkokmetro.co.th' },
    { name: 'Airport Rail Link', url: 'https://www.srtet.co.th' },
    { name: 'Ferry', url: 'https://www.chaophrayaexpressboat.com' },
  ],
  AMS: [
    { name: 'GVB', url: 'https://www.gvb.nl' },
    { name: 'NS Trein', url: 'https://www.ns.nl' },
  ],
  SIN: [
    { name: 'MRT', url: 'https://www.smrt.com.sg' },
    { name: 'Bus', url: 'https://www.transitlink.com.sg' },
  ],
  NRT: [
    { name: 'Narita Express', url: 'https://www.jreast.co.jp' },
    { name: 'Limousine Bus', url: 'https://www.limousinebus.co.jp' },
  ],
  HND: [
    { name: 'Tokyo Monorail', url: 'https://www.tokyo-monorail.co.jp' },
    { name: 'Keikyu Line', url: 'https://www.keikyu.co.jp' },
  ],
  LHR: [
    { name: 'Elizabeth line', url: 'https://tfl.gov.uk' },
    { name: 'Heathrow Express', url: 'https://www.heathrowexpress.com' },
  ],
  CDG: [
    { name: 'RER B', url: 'https://www.ratp.fr' },
    { name: 'Le Bus Direct', url: 'https://www.lebusdirect.com' },
  ],
  ICN: [
    { name: 'AREX', url: 'https://www.arex.or.kr' },
    { name: 'KTX', url: 'https://www.letskorail.com' },
  ],
  DXB: [
    { name: 'Dubai Metro', url: 'https://www.rta.ae' },
    { name: 'Bus', url: 'https://www.rta.ae' },
  ],
};

export function rideHailingFor(iata?: string): string[] {
  const code = String(iata || '').trim().toUpperCase();
  return RIDEHAILING[code] || RIDEHAILING.DEFAULT;
}

export function publicTransportFor(iata?: string): { name: string; url: string }[] {
  const code = String(iata || '').trim().toUpperCase();
  return PUBLIC_TRANSPORT[code] || [];
}

export function rideInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '?';
}

export async function openRideHailing(name: string): Promise<void> {
  const deep = RIDEHAILING_LINKS[name];
  const web = RIDEHAILING_WEB[name];
  if (deep) {
    try {
      if (await Linking.canOpenURL(deep)) {
        await Linking.openURL(deep);
        return;
      }
    } catch { /* web fallback */ }
  }
  if (web) {
    try {
      await Linking.openURL(web);
    } catch { /* ignore */ }
  }
}

export async function openPublicTransport(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch { /* ignore */ }
}
