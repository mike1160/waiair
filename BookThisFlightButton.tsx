import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AirplaneTakeoff } from 'phosphor-react-native';
import { t } from './lib/i18n';
import { openAviasalesBooking } from './lib/aviasales';

const MUTED = '#8896B0';

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
  const onPress = () => {
    const origin = String(props.origin || '').toUpperCase().slice(0, 3);
    const destination = String(props.destination || '').toUpperCase().slice(0, 3);
    if (origin.length !== 3 || destination.length !== 3) return;
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
