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
import { Airplane, ShareNetwork } from 'phosphor-react-native';
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
  arrTime?: string;
  gate?: string;
  terminal?: string;
  theme: ThemeBits;
  shareUrl?: string;
  onToast?: (msg: string) => void;
};

export default function ShareFlightCardBtn({
  flightNumber,
  origin,
  destination,
  status,
  depTime,
  arrTime,
  gate,
  terminal,
  theme,
  shareUrl,
  onToast,
}: Props) {
  const shotRef = useRef<any>(null);
  const [busy, setBusy] = useState(false);

  const textBody = [
    `✈️ WaiAir  ${flightNumber}`,
    `${origin} → ${destination}`,
    `${depTime} · ${status}`,
    gate || terminal ? [gate ? `Gate ${gate}` : '', terminal ? `Terminal ${terminal}` : ''].filter(Boolean).join(' · ') : '',
    shareUrl ? `Track at ${shareUrl}` : 'Track at WaiAir app',
  ].filter(Boolean).join('\n');

  const share = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const uri = await shotRef.current?.capture?.();
      if (uri) {
        if (Platform.OS === 'ios') {
          await Share.share({ url: uri, message: textBody });
        } else {
          await Share.share({ message: textBody, url: uri });
        }
      } else {
        await Share.share({ message: textBody });
      }
    } catch {
      try {
        await Share.share({ message: textBody });
      } catch {
        onToast?.('Could not create share card');
      }
    } finally {
      setBusy(false);
    }
  };

  const meta = [gate ? `Gate ${gate}` : '', terminal ? `Terminal ${terminal}` : ''].filter(Boolean).join(' · ');

  return (
    <>
      <TouchableOpacity
        onPress={share}
        style={styles.btn}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Share flight card"
      >
        {busy
          ? <ActivityIndicator size="small" color={theme.icon} />
          : <ShareNetwork size={14} color={theme.icon} />}
        <Text style={[styles.btnTxt, { color: theme.secondary }]}>Share Card</Text>
      </TouchableOpacity>

      <View style={styles.offscreen} pointerEvents="none">
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
          <View style={styles.card}>
            <View style={styles.gradTop} />
            <View style={styles.gradBottom} />
            <View style={styles.brandRow}>
              <Airplane size={16} color="#C9A84C" weight="fill" />
              <Text style={styles.brand}>WaiAir</Text>
            </View>
            <Text style={styles.num}>{flightNumber}</Text>
            <View style={styles.routeRow}>
              <Text style={styles.iata}>{origin || '—'}</Text>
              <Airplane size={16} color="#C9A84C" />
              <Text style={styles.iata}>{destination || '—'}</Text>
            </View>
            <Text style={styles.line}>{depTime || '—'}  ·  {status}</Text>
            {meta ? <Text style={styles.meta}>{meta}</Text> : null}
            {arrTime ? <Text style={styles.meta}>Arrives {arrTime}</Text> : null}
            <Text style={styles.footer}>Track at WaiAir app</Text>
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
    width: 360,
    height: 240,
    backgroundColor: '#0A0F1E',
    borderRadius: 22,
    padding: 22,
    overflow: 'hidden',
  },
  gradTop: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(201,168,76,0.2)',
  },
  gradBottom: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(26,47,90,0.95)',
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  brand: {
    color: '#C9A84C',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  num: {
    color: '#fff',
    fontSize: 36,
    fontWeight: '800',
    marginTop: 18,
    letterSpacing: -0.6,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  iata: { color: '#fff', fontSize: 24, fontWeight: '700' },
  line: { color: '#fff', fontSize: 16, fontWeight: '600', marginTop: 16 },
  meta: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600', marginTop: 6 },
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 22,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 12,
    fontWeight: '600',
  },
});
