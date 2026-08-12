import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ViewShot from 'react-native-view-shot';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  list: string;
  icon: string;
};

type Props = {
  flightNumber: string;
  origin: string;
  destination: string;
  status: string;
  depTime: string;
  arrTime: string;
  theme: ThemeBits;
  onToast?: (msg: string) => void;
};

export default function ShareFlightCardBtn({
  flightNumber,
  origin,
  destination,
  status,
  depTime,
  arrTime,
  theme,
  onToast,
}: Props) {
  const shotRef = useRef<any>(null);
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await shotRef.current?.capture?.();
      if (!uri) throw new Error('capture failed');
      if (Platform.OS === 'ios') {
        await Share.share({ url: uri, message: `Track ${flightNumber} on WaiAir` });
      } else {
        await Share.share({ message: `Track ${flightNumber} on WaiAir`, url: uri });
      }
    } catch {
      onToast?.('Could not create share card');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        onPress={share}
        style={styles.btn}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Share card"
      >
        {busy
          ? <ActivityIndicator size="small" color={theme.icon} />
          : <Ionicons name="image-outline" size={14} color={theme.icon} />}
        <Text style={[styles.btnTxt, { color: theme.secondary }]}>Share Card</Text>
      </TouchableOpacity>

      {/* Off-screen card for capture */}
      <View style={styles.offscreen} pointerEvents="none">
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
          <View style={styles.card}>
            <View style={styles.gradTop} />
            <View style={styles.gradBottom} />
            <Text style={styles.brand}>WaiAir</Text>
            <Text style={styles.num}>{flightNumber}</Text>
            <View style={styles.routeRow}>
              <Text style={styles.iata}>{origin || '—'}</Text>
              <Ionicons name="airplane" size={18} color="#C9A84C" />
              <Text style={styles.iata}>{destination || '—'}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{status}</Text>
            </View>
            <View style={styles.times}>
              <View>
                <Text style={styles.tLabel}>DEP</Text>
                <Text style={styles.tVal}>{depTime || '—'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.tLabel}>ARR</Text>
                <Text style={styles.tVal}>{arrTime || '—'}</Text>
              </View>
            </View>
            <Text style={styles.footer}>waiair.app</Text>
          </View>
        </ViewShot>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(136,150,176,0.35)',
    backgroundColor: 'rgba(136,150,176,0.08)',
  },
  btnTxt: { fontSize: 12, fontWeight: '600' },
  offscreen: {
    position: 'absolute',
    left: -9999,
    top: 0,
    opacity: 0,
  },
  card: {
    width: 320,
    height: 420,
    backgroundColor: '#0A0F1E',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  gradTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(201,168,76,0.18)',
  },
  gradBottom: {
    position: 'absolute',
    bottom: -60,
    left: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(26,47,90,0.9)',
  },
  brand: {
    color: '#C9A84C',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  num: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '800',
    marginTop: 36,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 18,
  },
  iata: { color: '#fff', fontSize: 28, fontWeight: '700' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 20,
    backgroundColor: 'rgba(201,168,76,0.2)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.45)',
  },
  badgeTxt: { color: '#C9A84C', fontSize: 12, fontWeight: '800' },
  times: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 40,
  },
  tLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  tVal: { color: '#fff', fontSize: 24, fontWeight: '300', marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 24,
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },
});
