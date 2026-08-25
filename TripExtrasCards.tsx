import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'phosphor-react-native';
import { t } from './lib/i18n';
import { localHourFromIso } from './lib/localFlightTime';
import {
  callPhone,
  dismissTripExtrasBanner,
  hasTripExtras,
  isTripExtrasBannerDismissed,
  minutesUntilIso,
  openMapsQuery,
  openRideToAddress,
  shareAddressText,
  type TripExtras,
} from './lib/tripExtras';
import {
  clearGmailSuggestion,
  extrasFromSuggestion,
  getCachedGmailSuggestions,
  type GmailSuggestion,
} from './lib/gmailTripExtras';
import { TILE_GOLD } from './lib/affiliateBrands';
import { rideHailingFor } from './lib/getIntoTown';
import { haptics } from './lib/haptics';

const NAVY = '#0D1B2E';
const GOLD = TILE_GOLD;
const CREAM = '#F5F0E8';
const MUTED = '#8896B0';

export function TripExtrasAddBanner({
  extras,
  flightKey,
  onOpen,
}: {
  extras?: TripExtras | null;
  flightKey?: string;
  onOpen?: () => void;
}) {
  const copy = t();
  const [dismissed, setDismissed] = useState(false);
  const extrasFilled = hasTripExtras(extras);

  useEffect(() => {
    if (extrasFilled || !flightKey) return;
    isTripExtrasBannerDismissed(flightKey).then(setDismissed).catch(() => {});
  }, [extrasFilled, flightKey]);

  if (!onOpen || extrasFilled || dismissed) return null;

  return (
    <View style={st.addBanner}>
      <Pressable
        style={st.addBannerTap}
        onPress={() => { haptics.light(); onOpen(); }}
        accessibilityRole="button"
        accessibilityLabel={copy.tripExtrasAddBanner}
      >
        <Text style={st.addBannerTitle}>{copy.tripExtrasAddBanner}</Text>
        <Text style={st.addBannerSub}>{copy.tripExtrasAddBannerSub}</Text>
      </Pressable>
      <Pressable
        style={st.addBannerClose}
        onPress={() => {
          haptics.light();
          setDismissed(true);
          void dismissTripExtrasBanner(flightKey);
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={copy.tripExtrasAddBannerDismiss}
      >
        <X size={14} color={GOLD} weight="bold" />
      </Pressable>
    </View>
  );
}

export default function TripExtrasCards({
  extras,
  flightKey,
  destIata,
  arrIso,
  destCountry,
  onApplySuggestion,
}: {
  extras?: TripExtras | null;
  flightKey?: string;
  destIata?: string;
  arrIso?: string;
  destCountry?: string;
  onApplySuggestion?: (next: TripExtras) => void;
}) {
  const copy = t();
  const [suggestions, setSuggestions] = useState<GmailSuggestion[]>([]);
  const pulse = useRef(new Animated.Value(1)).current;
  const hotel = extras?.hotel;
  const car = extras?.carRental;
  const transfer = extras?.transfer;
  const pickupMins = minutesUntilIso(transfer?.pickupTime);
  const urgent = pickupMins != null && pickupMins <= 15 && pickupMins >= -30;
  const soon = pickupMins != null && pickupMins <= 60 && pickupMins >= -30;
  const checkHour = localHourFromIso(arrIso, destIata, destCountry);
  const early = checkHour != null && checkHour < 14;
  const rides = rideHailingFor(destIata);
  const grabName = rides[0] || 'Grab';

  useEffect(() => {
    if (!flightKey) return;
    getCachedGmailSuggestions(flightKey).then(setSuggestions).catch(() => {});
  }, [flightKey, extras]);

  useEffect(() => {
    if (!urgent) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, urgent]);

  const hotelQuery = [hotel?.name, hotel?.address].filter(Boolean).join(', ');

  if (!hotel && !car && !transfer && !suggestions.length) return null;

  return (
    <View style={st.wrap}>
      {suggestions.map(s => (
        <View key={s.id} style={st.card}>
          <Text style={st.title}>
            {s.kind === 'hotel' ? copy.tripExtrasGmailFoundHotel
              : s.kind === 'carRental' ? copy.tripExtrasGmailFoundCar
                : copy.tripExtrasGmailFoundTransfer}
          </Text>
          {s.snippet ? <Text style={st.body}>{s.snippet}</Text> : null}
          <Pressable
            style={st.goldBtn}
            onPress={() => {
              const next = extrasFromSuggestion(s);
              if (next) onApplySuggestion?.(next);
              if (flightKey) void clearGmailSuggestion(flightKey, s.id);
              setSuggestions(prev => prev.filter(x => x.id !== s.id));
            }}
          >
            <Text style={st.goldTxt}>{copy.tripExtrasGmailAdd}</Text>
          </Pressable>
        </View>
      ))}

      {hotel && (hotel.name || hotel.address) ? (
        <View style={st.card}>
          <Text style={st.kicker}>{copy.tripExtrasYourHotel}</Text>
          {hotel.name ? <Text style={st.title}>{hotel.name}</Text> : null}
          {hotel.address ? <Text style={st.body}>{hotel.address}</Text> : null}
          {hotel.checkIn ? (
            <Text style={st.meta}>
              {copy.tripExtrasCheckIn}: {hotel.checkIn}
              {early ? ` · ${copy.tripExtrasEarlyCheckIn}` : ` · ${copy.tripExtrasOnTimeCheckIn}`}
            </Text>
          ) : null}
          <View style={st.row}>
            {hotelQuery ? (
              <Pressable style={st.goldBtn} onPress={() => { void openMapsQuery(hotelQuery); }}>
                <Text style={st.goldTxt}>{copy.tripExtrasNavigate}</Text>
              </Pressable>
            ) : null}
            {hotel.address ? (
              <Pressable style={st.ghostBtn} onPress={() => { void shareAddressText(`${hotel.name || ''}\n${hotel.address}`); }}>
                <Text style={st.ghostTxt}>{copy.tripExtrasShareAddress}</Text>
              </Pressable>
            ) : null}
          </View>
          {hotel.address ? (
            <Pressable
              style={st.grabBtn}
              onPress={() => { void openRideToAddress(grabName, hotel.address || ''); }}
            >
              <Text style={st.grabTxt}>{copy.grabToHotel(hotel.name || grabName)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {car && (car.company || car.pickupLocation) ? (
        <View style={st.card}>
          <Text style={st.kicker}>{copy.tripExtrasYourCar}</Text>
          {car.company ? <Text style={st.title}>{car.company}</Text> : null}
          {car.pickupLocation ? <Text style={st.body}>{car.pickupLocation}</Text> : null}
          {car.pickupTime ? (
            <Text style={st.meta}>
              {minutesUntilIso(car.pickupTime) != null && Math.abs(minutesUntilIso(car.pickupTime)!) <= 120
                ? copy.tripExtrasPickupIn(Math.max(0, minutesUntilIso(car.pickupTime)!))
                : car.pickupTime}
            </Text>
          ) : null}
          {car.pickupLocation ? (
            <Pressable style={st.goldBtn} onPress={() => { void openMapsQuery(car.pickupLocation || ''); }}>
              <Text style={st.goldTxt}>{copy.tripExtrasNavPickup}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {transfer && soon ? (
        <Animated.View style={[st.card, st.transfer, urgent && { opacity: pulse }]}>
          <Text style={st.kicker}>{copy.tripExtrasYourTransfer}</Text>
          {transfer.provider ? <Text style={st.title}>{transfer.provider}</Text> : null}
          {transfer.driverName ? <Text style={st.body}>{transfer.driverName}</Text> : null}
          {transfer.vehicleDescription ? <Text style={st.body}>{transfer.vehicleDescription}</Text> : null}
          {pickupMins != null ? (
            <Text style={st.meta}>{pickupMins <= 0 ? copy.tripExtrasPickupSoon : copy.tripExtrasPickupIn(pickupMins)}</Text>
          ) : null}
          <View style={st.row}>
            {transfer.driverPhone ? (
              <Pressable style={st.goldBtn} onPress={() => { void callPhone(transfer.driverPhone); }}>
                <Text style={st.goldTxt}>{copy.tripExtrasCallDriver}</Text>
              </Pressable>
            ) : null}
            {transfer.pickupLocation ? (
              <Pressable style={st.ghostBtn} onPress={() => { void openMapsQuery(transfer.pickupLocation || ''); }}>
                <Text style={st.ghostTxt}>{copy.tripExtrasNavPickup}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : transfer && (transfer.provider || transfer.driverName) ? (
        <View style={st.card}>
          <Text style={st.kicker}>{copy.tripExtrasYourTransfer}</Text>
          {transfer.provider ? <Text style={st.title}>{transfer.provider}</Text> : null}
          {transfer.driverName ? <Text style={st.body}>{transfer.driverName}</Text> : null}
          {transfer.pickupLocation ? <Text style={st.body}>{transfer.pickupLocation}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 8 },
  card: {
    backgroundColor: NAVY,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.32)',
    gap: 6,
  },
  transfer: { borderColor: GOLD },
  kicker: { color: GOLD, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: CREAM, fontSize: 16, fontWeight: '800' },
  body: { color: MUTED, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  meta: { color: CREAM, fontSize: 12, fontWeight: '700', marginTop: 2 },
  row: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  goldBtn: { backgroundColor: GOLD, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  goldTxt: { color: NAVY, fontSize: 12, fontWeight: '800' },
  ghostBtn: { borderWidth: 1, borderColor: 'rgba(201,168,76,0.45)', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  ghostTxt: { color: GOLD, fontSize: 12, fontWeight: '800' },
  grabBtn: { backgroundColor: '#00B14F', borderRadius: 12, paddingVertical: 11, alignItems: 'center', marginTop: 6 },
  grabTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  addBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(201,168,76,0.10)',
    borderWidth: 1,
    borderColor: GOLD,
    borderRadius: 14,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 8,
    gap: 8,
    marginBottom: 12,
  },
  addBannerTap: { flex: 1, gap: 4 },
  addBannerTitle: { color: CREAM, fontSize: 15, fontWeight: '800' },
  addBannerSub: { color: GOLD, fontSize: 12, fontWeight: '700' },
  addBannerClose: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});

