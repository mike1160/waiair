import { Linking, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AirplaneTakeoff } from 'phosphor-react-native';
import { t } from './lib/i18n';

const MUTED = '#8896B0';

export default function BookThisFlightButton({
  origin,
  destination,
}: {
  origin?: string;
  destination?: string;
  date?: string;
  passengers?: number;
}) {
  const onPress = () => {
    const o = String(origin || '').trim().toUpperCase();
    const d = String(destination || '').trim().toUpperCase();
    const base = 'https://intui.tpx.lu/4OdGWX2W';
    const url = o && d
      ? `https://www.intui.travel/en/flights/${o}/${d}`
      : base;
    Linking.openURL(url);
  };

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={t().bookThisFlight}
    >
      <AirplaneTakeoff size={14} color={MUTED} />
      <Text style={styles.txt} numberOfLines={1} ellipsizeMode="clip">
        {t().bookThisFlight}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(136,150,176,0.35)',
    backgroundColor: 'transparent',
  },
  txt: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
});
