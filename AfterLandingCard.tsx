import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Airplane, Briefcase, Clock, CurrencyEur, Taxi } from 'phosphor-react-native';
import { WeatherGlyph } from './LuxuryInfoPanel';
import { formatRate, type FxSnapshot, type WeatherSnapshot } from './lib/destinationServices';

export type LandedWelcome = {
  flightNumber: string;
  city: string;
  flag: string;
  iata: string;
  localTime: string;
  weather?: WeatherSnapshot | null;
  fx?: FxSnapshot | null;
  belt?: string;
  taxiMin?: number | null;
};

export default function AfterLandingCard({
  data,
  onDismiss,
}: {
  data: LandedWelcome | null;
  onDismiss: () => void;
}) {
  if (!data) return null;
  const wx = data.weather;
  const fx = data.fx;

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onDismiss}>
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.plane}>
            <Airplane size={28} color="#C9A84C" weight="fill" />
          </View>
          <Text style={styles.kicker}>Landed</Text>
          <Text style={styles.title}>
            Welcome to {data.city} {data.flag || ''}
          </Text>
          <Text style={styles.flight}>{data.flightNumber} · {data.iata}</Text>

          <View style={styles.rows}>
            <View style={styles.row}>
              <Clock size={16} color="#C9A84C" />
              <Text style={styles.rowTxt}>Local time: {data.localTime}</Text>
            </View>
            {wx ? (
              <View style={styles.row}>
                <WeatherGlyph icon={wx.icon} color="#C9A84C" size={16} />
                <Text style={styles.rowTxt}>{wx.temp}°C · {wx.description}</Text>
              </View>
            ) : null}
            {fx?.eurToDest != null ? (
              <View style={styles.row}>
                <CurrencyEur size={16} color="#C9A84C" />
                <Text style={styles.rowTxt}>1 EUR = {formatRate(fx.eurToDest)} {fx.destCode}</Text>
              </View>
            ) : null}
            <View style={styles.row}>
              <Briefcase size={16} color="#C9A84C" />
              <Text style={styles.rowTxt}>
                {data.belt ? `Baggage belt: ${data.belt}` : 'Baggage info not yet available'}
              </Text>
            </View>
            {data.taxiMin != null ? (
              <View style={styles.row}>
                <Taxi size={16} color="#C9A84C" />
                <Text style={styles.rowTxt}>Taxi to center: ~{data.taxiMin} min</Text>
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={styles.btn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.btnTxt}>Dismiss</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5,7,13,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0b1224',
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
  },
  plane: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(201,168,76,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  kicker: {
    color: '#C9A84C',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 6,
  },
  flight: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 18,
  },
  rows: { gap: 12, marginBottom: 22 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowTxt: { color: '#F0F4FF', fontSize: 15, fontWeight: '600', flex: 1 },
  btn: {
    backgroundColor: '#C9A84C',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnTxt: { color: '#0A0F1E', fontSize: 15, fontWeight: '800' },
});
