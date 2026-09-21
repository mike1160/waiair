import { Linking } from 'react-native';
import { RIDEHAILING_LINKS } from './getIntoTownData';

const RIDEHAILING_WEB: Record<string, string> = {
  Grab: 'https://www.grab.com',
  Uber: 'https://m.uber.com/ul/?action=setPickup',
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

export {
  PUBLIC_TRANSPORT,
  RIDEHAILING,
  RIDEHAILING_LINKS,
  RIDE_COLORS,
  publicTransportFor,
  rideHailingFor,
  rideInitials,
} from './getIntoTownData';

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
