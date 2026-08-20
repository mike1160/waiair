import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import BrandLogoTileRow from './BrandLogoTileRow';
import { brandFields } from './lib/affiliateBrands';
import { timezoneForIata } from './lib/airportTz';
import { aviasalesCurrency, formatFare } from './lib/aviasales';
import { flightBoardDate, shiftDateKey } from './lib/boardFilter';
import { DETAIL_GOLD } from './lib/detailCardStyles';
import {
  agodaAffiliateUrl,
  airbnbUrl,
  bookingAffiliateUrl,
  openAffiliateUrl,
} from './lib/affiliateConfig';
import {
  fetchHotelsTonight,
  hotelCityName,
  type HotelOffer,
} from './lib/hotels';
import { showLandingHotel, type LandingCardPhase } from './lib/landingCards';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';
import { t } from './lib/i18n';

const LANDED_HIDE_MS = 12 * 60 * 60 * 1000;
const NAVY = '#0A1628';
const GOLD = DETAIL_GOLD;
const CREAM = '#F4F0E6';

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
    const landedMs = isoInAirportTzToUtcMs(input.arrIso, destIata, input.destCountry);
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

function buildPartnerUrls(cityName: string, arrivalDate: string) {
  const city = encodeURIComponent(cityName);
  const checkOut = shiftDateKey(arrivalDate, 1);
  return {
    agoda: agodaAffiliateUrl(cityName, arrivalDate, checkOut),
    booking: bookingAffiliateUrl(cityName, arrivalDate, checkOut),
    airbnb: `https://www.airbnb.com/s/${city}/homes`,
  };
}

function Stars({ count }: { count: number }) {
  const n = Math.max(0, Math.min(5, Math.round(count)));
  if (n <= 0) return null;
  return (
    <Text style={st.stars} accessibilityLabel={`${n} stars`}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </Text>
  );
}

function HotelRow({
  hotel,
  city,
  currencySymbol,
  onBook,
}: {
  hotel: HotelOffer;
  city: string;
  currencySymbol: string;
  onBook: () => void;
}) {
  const copy = t();
  return (
    <View style={st.hotelRow}>
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
        <Text style={st.hotelName} numberOfLines={2}>{hotel.name}</Text>
        <Stars count={hotel.stars} />
        <Text style={st.price}>{copy.hotelPerNight(formatFare(hotel.price, currencySymbol))}</Text>
      </View>
      <Pressable
        onPress={onBook}
        style={({ pressed }) => [st.bookBtn, pressed && { opacity: 0.88 }]}
        accessibilityRole="button"
        accessibilityLabel={`${copy.bookFare} ${hotel.name} ${city}`}
      >
        <Text style={st.bookTxt}>{copy.bookFare}</Text>
      </Pressable>
    </View>
  );
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
  embedded = false,
  liveOnly = false,
  liveTitle,
}: {
  type: 'arrival' | 'departure';
  destIata?: string;
  destCity?: string;
  destCountry?: string;
  arrIso?: string;
  status?: string;
  landingPhase?: LandingCardPhase;
  theme: ThemeBits;
  embedded?: boolean;
  liveOnly?: boolean;
  liveTitle?: string;
}) {
  const visible = useMemo(
    () => shouldShowHotelSearchCard({ type, destIata, destCity, destCountry, arrIso, status, landingPhase }),
    [type, destIata, destCity, destCountry, arrIso, status, landingPhase],
  );

  const cityName = useMemo(
    () => hotelCityName(destIata, destCity),
    [destIata, destCity],
  );

  const arrivalDate = useMemo(() => {
    const tz = timezoneForIata(destIata, destCountry);
    return flightBoardDate({ arrivalTime: arrIso }, tz);
  }, [arrIso, destIata, destCountry]);

  const currency = aviasalesCurrency();
  const [hotels, setHotels] = useState<HotelOffer[] | null>(null);

  useEffect(() => {
    if (!visible || !cityName || !arrivalDate) {
      setHotels(null);
      return;
    }
    let cancelled = false;
    setHotels(null);
    fetchHotelsTonight({
      city: cityName,
      checkIn: arrivalDate,
      currency: currency.code,
    }).then(rows => {
      if (!cancelled) setHotels(rows);
    }).catch(() => {
      if (!cancelled) setHotels([]);
    });
    return () => { cancelled = true; };
  }, [visible, cityName, arrivalDate, currency.code]);

  const tiles = useMemo(() => {
    if (!cityName || !arrivalDate) return [];
    const urls = buildPartnerUrls(cityName, arrivalDate);
    return [
      { key: 'agoda', label: 'Agoda', source: HOTEL_LOGOS.agoda, ...brandFields('agoda'), onPress: () => { void openAffiliateUrl(urls.agoda); } },
      { key: 'booking', label: 'Booking.com', source: HOTEL_LOGOS.booking, ...brandFields('booking'), onPress: () => { void openAffiliateUrl(urls.booking); } },
      {
        key: 'airbnb',
        label: 'Airbnb',
        source: HOTEL_LOGOS.airbnb,
        ...brandFields('airbnb'),
        onPress: () => { void openDeepLink(airbnbUrl(), urls.airbnb); },
      },
    ];
  }, [cityName, arrivalDate]);

  if (!visible || !cityName || !arrivalDate) return null;

  const showLive = !!hotels && hotels.length > 0;
  if (liveOnly && !showLive) return null;
  const liveHotels = showLive ? hotels.slice(0, 3) : [];
  const partnerTiles = liveOnly ? [] : tiles;

  const openCityBooking = () => {
    void openAffiliateUrl(
      bookingAffiliateUrl(cityName, arrivalDate, shiftDateKey(arrivalDate, 1)),
    );
  };

  const heading = embedded
    ? (liveTitle ? liveTitle.replace(/\?+$/, '').trim().toUpperCase() : undefined)
    : `🏨 ${t().needAHotel}`;

  return (
    <View style={[
      st.card,
      embedded ? st.embedded : { backgroundColor: theme.card || 'rgba(136,150,176,0.08)' },
    ]}>
      {showLive ? (
        <View style={embedded ? st.liveBlock : undefined}>
          {heading ? (
            <Text style={[st.title, embedded && liveTitle ? st.liveTitle : { color: theme.muted }]}>
              {heading}
            </Text>
          ) : null}
          <View style={st.list}>
            {liveHotels.map((hotel, i) => (
              <HotelRow
                key={`${hotel.name}-${i}`}
                hotel={hotel}
                city={cityName}
                currencySymbol={currency.symbol}
                onBook={openCityBooking}
              />
            ))}
          </View>
        </View>
      ) : null}
      {partnerTiles.length ? (
        <BrandLogoTileRow
          title={heading && !showLive && hotels !== null ? heading : undefined}
          tiles={partnerTiles}
          mutedColor={theme.muted}
        />
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  embedded: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
  },
  liveBlock: {
    gap: 10,
  },
  liveTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: GOLD,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    marginBottom: 0,
    marginTop: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    marginTop: 10,
  },
  list: {
    gap: 8,
  },
  hotelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: NAVY,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.42)',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  hotelName: {
    color: CREAM,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  stars: {
    color: GOLD,
    fontSize: 12,
    letterSpacing: 1,
  },
  price: {
    color: GOLD,
    fontSize: 13,
    fontWeight: '700',
  },
  bookBtn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexShrink: 0,
  },
  bookTxt: {
    color: NAVY,
    fontSize: 13,
    fontWeight: '800',
  },
  skel: {
    height: 72,
    borderRadius: 14,
    backgroundColor: NAVY,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.22)',
    opacity: 0.55,
  },
});
