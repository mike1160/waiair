import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import BrandLogoTileRow from './BrandLogoTileRow';
import { timezoneForIata } from './lib/airportTz';
import { flightBoardDate, parseTimeMs, shiftDateKey } from './lib/boardFilter';
import { showLandingHotel, type LandingCardPhase } from './lib/landingCards';
import { t } from './lib/i18n';

const LANDED_HIDE_MS = 12 * 60 * 60 * 1000;

const HOTEL_LOGOS = {
  agoda: require('./assets/logos/agoda.png'),
  booking: require('./assets/logos/booking.png'),
  airbnb: require('./assets/logos/airbnb.png'),
} as const;

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  card: string;
};

function localDateKey(d: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function cleanCityName(raw?: string): string {
  const s = String(raw || '').split(',')[0].trim();
  if (!s || s === '—' || /^unknown$/i.test(s)) return '';
  return s;
}

export function shouldShowHotelSearchCard(input: {
  type: 'arrival' | 'departure';
  destIata?: string;
  destCity?: string;
  destCountry?: string;
  arrIso?: string;
  status?: string;
  landingPhase?: LandingCardPhase;
}): boolean {
  if (input.type !== 'arrival') return false;
  if (String(input.status || '').toLowerCase() === 'cancelled') return false;

  const destIata = String(input.destIata || '').trim().toUpperCase();
  const city = cleanCityName(input.destCity);
  if (!destIata && !city) return false;

  const tz = timezoneForIata(destIata, input.destCountry);
  const today = localDateKey(new Date(), tz);
  const tomorrow = shiftDateKey(today, 1);
  const arrivalDay = flightBoardDate({ arrivalTime: input.arrIso }, tz);
  if (!arrivalDay || (arrivalDay !== today && arrivalDay !== tomorrow)) return false;

  const st = String(input.status || '').toLowerCase();
  if (input.landingPhase !== undefined) {
    if (input.landingPhase === 'hidden' || input.landingPhase === 'none') return false;
    if (!showLandingHotel(input.landingPhase)) return false;
    return true;
  }
  if (st === 'landed') {
    const landedMs = parseTimeMs(input.arrIso);
    if (landedMs && Date.now() - landedMs > LANDED_HIDE_MS) return false;
  }

  return true;
}

async function openDeepLink(appUrl: string, fallback: string): Promise<void> {
  try {
    if (await Linking.canOpenURL(appUrl)) {
      await Linking.openURL(appUrl);
      return;
    }
  } catch { /* fall through */ }
  try {
    await Linking.openURL(appUrl);
  } catch {
    Linking.openURL(fallback).catch(() => {});
  }
}

function buildHotelUrls(cityName: string, arrivalDate: string) {
  const city = encodeURIComponent(cityName);
  const checkOut = shiftDateKey(arrivalDate, 1);
  return {
    agoda: `https://www.agoda.com/search?city=${city}&checkIn=${arrivalDate}&checkOut=${checkOut}&adults=1`,
    booking: `https://www.booking.com/search.html?ss=${city}&checkin=${arrivalDate}&checkout=${checkOut}`,
    airbnb: `https://www.airbnb.com/s/${city}/homes`,
  };
}

export default function HotelSearchCard({
  type,
  destIata,
  destCity,
  destCountry,
  arrIso,
  status,
  landingPhase,
  theme,
}: {
  type: 'arrival' | 'departure';
  destIata?: string;
  destCity?: string;
  destCountry?: string;
  arrIso?: string;
  status?: string;
  landingPhase?: LandingCardPhase;
  theme: ThemeBits;
}) {
  const visible = useMemo(
    () => shouldShowHotelSearchCard({ type, destIata, destCity, destCountry, arrIso, status, landingPhase }),
    [type, destIata, destCity, destCountry, arrIso, status, landingPhase],
  );

  const cityName = useMemo(() => {
    const city = cleanCityName(destCity);
    if (city) return city;
    return String(destIata || '').trim().toUpperCase();
  }, [destCity, destIata]);

  const arrivalDate = useMemo(() => {
    const tz = timezoneForIata(destIata, destCountry);
    return flightBoardDate({ arrivalTime: arrIso }, tz);
  }, [arrIso, destIata, destCountry]);

  const tiles = useMemo(() => {
    if (!cityName || !arrivalDate) return [];
    const urls = buildHotelUrls(cityName, arrivalDate);
    const open = (url: string) => {
      Linking.openURL(url).catch(() => {});
    };
    return [
      { key: 'agoda', label: 'Agoda', source: HOTEL_LOGOS.agoda, onPress: () => open(urls.agoda) },
      { key: 'booking', label: 'Booking.com', source: HOTEL_LOGOS.booking, onPress: () => open(urls.booking) },
      {
        key: 'airbnb',
        label: 'Airbnb',
        source: HOTEL_LOGOS.airbnb,
        onPress: () => { void openDeepLink('airbnb://', urls.airbnb); },
      },
    ];
  }, [cityName, arrivalDate]);

  if (!visible || !tiles.length) return null;

  return (
    <View style={[st.card, { backgroundColor: theme.card || 'rgba(136,150,176,0.08)' }]}>
      <BrandLogoTileRow
        title={`🏨 ${t().hotelNeedTonight}`}
        tiles={tiles}
        mutedColor={theme.muted}
      />
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
