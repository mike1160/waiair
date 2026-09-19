import { useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { globeInkColor } from './lib/globeServices';

export const LOGOS: Record<string, string> = {
  Grab: 'https://www.google.com/s2/favicons?sz=128&domain=grab.com',
  'Booking.com': 'https://www.google.com/s2/favicons?sz=128&domain=booking.com',
  Agoda: 'https://www.google.com/s2/favicons?sz=128&domain=agoda.com',
  Airbnb: 'https://www.google.com/s2/favicons?sz=128&domain=airbnb.com',
  Klook: 'https://www.google.com/s2/favicons?sz=128&domain=klook.com',
  Airalo: 'https://www.google.com/s2/favicons?sz=128&domain=airalo.com',
  KKday: 'https://www.google.com/s2/favicons?sz=128&domain=kkday.com',
  Aviasales: 'https://www.google.com/s2/favicons?sz=128&domain=aviasales.com',
  'Hotels.com': 'https://www.google.com/s2/favicons?sz=128&domain=hotels.com',
  Uber: 'https://www.google.com/s2/favicons?sz=128&domain=uber.com',
  Bolt: 'https://www.google.com/s2/favicons?sz=128&domain=bolt.eu',
  InDrive: 'https://www.google.com/s2/favicons?sz=128&domain=indrive.com',
  Gojek: 'https://www.google.com/s2/favicons?sz=128&domain=www.gojek.com',
  DiDi: 'https://www.google.com/s2/favicons?sz=128&domain=didiglobal.com',
  Careem: 'https://www.google.com/s2/favicons?sz=128&domain=careem.com',
  'Kakao T': 'https://www.google.com/s2/favicons?sz=128&domain=kakaomobility.com',
  'Yandex Go': 'https://www.google.com/s2/favicons?sz=128&domain=taxi.yandex.com',
  BiTaksi: 'https://www.google.com/s2/favicons?sz=128&domain=bitaksi.com',
  Lyft: 'https://www.google.com/s2/favicons?sz=128&domain=lyft.com',
  GO: 'https://www.google.com/s2/favicons?sz=128&domain=go.goinc.jp',
  Be: 'https://www.google.com/s2/favicons?sz=128&domain=be.com.vn',
  Pathao: 'https://www.google.com/s2/favicons?sz=128&domain=pathao.com',
  Cabify: 'https://www.google.com/s2/favicons?sz=128&domain=cabify.com',
  '99': 'https://www.google.com/s2/favicons?sz=128&domain=99app.com',
  Shohoz: 'https://www.google.com/s2/favicons?sz=128&domain=shohoz.com',
  Rapido: 'https://www.google.com/s2/favicons?sz=128&domain=rapido.bike',
  Kiwitaxi: 'https://www.google.com/s2/favicons?sz=128&domain=kiwitaxi.com',
  QEEQ: 'https://www.google.com/s2/favicons?sz=128&domain=qeeq.com',
  Tiqets: 'https://www.google.com/s2/favicons?sz=128&domain=tiqets.com',
  Yesim: 'https://www.google.com/s2/favicons?sz=128&domain=yesim.app',
  Bounce: 'https://www.google.com/s2/favicons?sz=128&domain=bounce.com',
  AirHelp: 'https://www.google.com/s2/favicons?sz=128&domain=airhelp.com',
  Saily: 'https://www.google.com/s2/favicons?sz=128&domain=saily.com',
  'Kiwi.com': 'https://www.google.com/s2/favicons?sz=128&domain=kiwi.com',
  EKTA: 'https://www.google.com/s2/favicons?sz=128&domain=ektatraveling.com',
  BikesBooking: 'https://www.google.com/s2/favicons?sz=128&domain=bikesbooking.com',
};

export const LOCAL_LOGOS: Record<string, ImageSourcePropType> = {
  Grab: require('./assets/logos/grab.png'),
  'Booking.com': require('./assets/logos/booking.png'),
  Agoda: require('./assets/logos/agoda.png'),
  Airbnb: require('./assets/logos/airbnb.png'),
  'Hotels.com': require('./assets/logos/hotels.png'),
  Bolt: require('./assets/logos/bolt.png'),
  InDrive: require('./assets/logos/indrive.png'),
};

export type HeroBrand = {
  name: string;
  color: string;
  initials: string;
};

export const HERO_BRANDS: HeroBrand[] = [
  { name: 'Booking.com', color: '#003580', initials: 'B' },
  { name: 'Agoda', color: '#E5132C', initials: 'A' },
  { name: 'Airbnb', color: '#FF5A5F', initials: 'AB' },
  { name: 'Hotels.com', color: '#E31837', initials: 'HC' },
  { name: 'Grab', color: '#00B14F', initials: 'G' },
  { name: 'Bolt', color: '#34D186', initials: 'B' },
  { name: 'Uber', color: '#000000', initials: 'U' },
  { name: 'InDrive', color: '#C6FF00', initials: 'ID' },
];

export function GlobeBrandMark({
  name,
  initials,
  color,
  size,
}: {
  name: string;
  initials: string;
  color: string;
  size: number;
}) {
  const local = LOCAL_LOGOS[name];
  const uri = LOGOS[name];
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const ink = globeInkColor(color);
  const source = local || (uri && !failed ? { uri } : undefined);
  const tryImage = !!source && !failed;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{
          color: ink,
          fontSize: Math.max(9, size * 0.28),
          fontWeight: '800',
          letterSpacing: 0.2,
          opacity: tryImage && ready ? 0 : 1,
        }}
      >
        {initials}
      </Text>
      {tryImage ? (
        <Image
          source={source}
          resizeMode="cover"
          onLoad={() => setReady(true)}
          onError={() => {
            setFailed(true);
            setReady(false);
          }}
          style={[StyleSheet.absoluteFill, { opacity: ready ? 1 : 0 }]}
        />
      ) : null}
    </View>
  );
}
