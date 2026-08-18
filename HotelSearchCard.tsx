import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { timezoneForIata } from './lib/airportTz';
import { flightBoardDate, parseTimeMs, shiftDateKey } from './lib/boardFilter';
import { showLandingHotel, type LandingCardPhase } from './lib/landingCards';
import { t } from './lib/i18n';

const AGODA_COLOR = '#E4003A';
const BOOKING_COLOR = '#003580';
const HOTELS_COLOR = '#E4423F';
const LANDED_HIDE_MS = 12 * 60 * 60 * 1000;

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

function buildHotelUrls(cityName: string, arrivalDate: string) {
  const city = encodeURIComponent(cityName);
  const checkOut = shiftDateKey(arrivalDate, 1);
  return {
    agoda: `https://www.agoda.com/search?city=${city}&checkIn=${arrivalDate}&checkOut=${checkOut}&adults=1`,
    booking: `https://www.booking.com/search.html?ss=${city}&checkin=${arrivalDate}&checkout=${checkOut}`,
    hotels: `https://www.hotels.com/search.do?destination=${city}&startDate=${arrivalDate}&endDate=${checkOut}`,
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

  if (!visible || !cityName || !arrivalDate) return null;

  const urls = buildHotelUrls(cityName, arrivalDate);

  const open = (url: string) => {
    Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[st.card, { backgroundColor: theme.card || 'rgba(136,150,176,0.08)' }]}>
      <Text style={[st.title, { color: theme.text }]}>
        {`🏨 ${t().hotelNeedIn(cityName)}`}
      </Text>
      <Text style={[st.sub, { color: theme.secondary }]}>
        {t().hotelDealsTonight}
      </Text>
      <View style={st.row}>
        <Pressable
          style={[st.pill, { backgroundColor: AGODA_COLOR }]}
          onPress={() => open(urls.agoda)}
          accessibilityRole="button"
          accessibilityLabel="Agoda"
        >
          <Text style={st.pillTxt}>Agoda</Text>
        </Pressable>
        <Pressable
          style={[st.pill, { backgroundColor: BOOKING_COLOR }]}
          onPress={() => open(urls.booking)}
          accessibilityRole="button"
          accessibilityLabel="Booking"
        >
          <Text style={st.pillTxt}>Booking</Text>
        </Pressable>
        <Pressable
          style={[st.pill, { backgroundColor: HOTELS_COLOR }]}
          onPress={() => open(urls.hotels)}
          accessibilityRole="button"
          accessibilityLabel="Hotels.com"
        >
          <Text style={st.pillTxt}>Hotels.com</Text>
        </Pressable>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 10,
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  sub: { fontSize: 13, fontWeight: '500', marginTop: 4, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillTxt: { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 0.1 },
});
