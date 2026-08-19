import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AirplaneTakeoff } from 'phosphor-react-native';
import { searchDuffelFlights } from './lib/duffel';
import { t } from './lib/i18n';

const NAVY = '#1A2F5A';
const GOLD = '#C9A84C';

export default function BookThisFlightButton({
  compact = false,
  origin,
  destination,
  date,
  passengers = 1,
}: {
  compact?: boolean;
  origin?: string;
  destination?: string;
  date?: string;
  passengers?: number;
}) {
  const onPress = () => {
    const o = String(origin || '').trim().toUpperCase();
    const d = String(destination || '').trim().toUpperCase();
    const day = String(date || '').trim();
    if (!o || !d || !day) return;
    void searchDuffelFlights(o, d, day, passengers).catch(() => {});
  };

  return (
    <TouchableOpacity
      style={[styles.btn, compact && styles.btnCompact]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={t().bookThisFlight}
    >
      <AirplaneTakeoff size={compact ? 14 : 16} color={GOLD} />
      <Text style={[styles.txt, compact && styles.txtCompact]} numberOfLines={1} ellipsizeMode="clip">
        {t().bookThisFlight}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 10,
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: GOLD,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  btnCompact: {
    marginTop: 8,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  txt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  txtCompact: {
    fontSize: 13,
  },
});
