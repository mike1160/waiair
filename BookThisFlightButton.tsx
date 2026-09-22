import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AirplaneTakeoff } from 'phosphor-react-native';
import { t } from './lib/i18n';
import { haptics } from './lib/haptics';
import { TILE_GOLD, TILE_NAVY } from './lib/affiliateBrands';
import { aviasalesSearchHomeUrl, openAviasalesBooking } from './lib/aviasales';

function iataCode(raw?: string): string {
  return String(raw || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
}

function parseDay(raw?: string): Date {
  const m = String(raw || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

export default function BookThisFlightButton(props: {
  origin?: string;
  destination?: string;
  date?: string;
  passengers?: number;
}) {
  const origin = iataCode(props.origin);
  const destination = iataCode(props.destination);
  if (origin.length !== 3 || destination.length !== 3) return null;

  const onPress = () => {
    haptics.light();
    void openAviasalesBooking(
      origin,
      destination,
      parseDay(props.date),
      props.passengers ?? 1,
    ).catch(() => {});
  };

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={t().bookThisFlight}
    >
      <AirplaneTakeoff size={16} color={TILE_NAVY} weight="bold" />
      <Text style={styles.txt} numberOfLines={1}>
        {t().bookThisFlight}
      </Text>
    </TouchableOpacity>
  );
}

/** Trip completed (every tracked flight landed): a quiet "Need a new trip?" line with one small text link. */
export function NewTripLink(props: { mutedColor: string; accentColor: string; borderColor: string }) {
  return (
    <View style={[styles.newTrip, { borderColor: props.borderColor }]}>
      <Text style={[styles.newTripTxt, { color: props.mutedColor }]}>{t().affiliateNewTrip}</Text>
      <Text
        style={[styles.newTripLink, { color: props.accentColor }]}
        onPress={() => {
          haptics.light();
          void Linking.openURL(aviasalesSearchHomeUrl()).catch(() => {});
        }}
        accessibilityRole="link"
      >
        {t().affiliateNewTripLink}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 10,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 48,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: TILE_GOLD,
  },
  txt: {
    color: TILE_NAVY,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  newTrip: {
    marginTop: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  newTripTxt: { fontSize: 12 },
  newTripLink: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
});
