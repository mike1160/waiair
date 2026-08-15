import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Airplane, ShareNetwork } from 'phosphor-react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { haptics } from './lib/haptics';

const LOGO = require('./assets/waiair-logo.png');

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  card: string;
  border: string;
};

type FlightBits = {
  flightNumber: string;
  airline?: string;
  origin: string;
  destination: string;
  status: string;
  depTime: string;
  dateLabel?: string;
  gate?: string;
  terminal?: string;
  onTime?: boolean;
};

function shareText(f: FlightBits): string {
  return [
    `✈️ ${f.flightNumber} · ${f.origin}→${f.destination}`,
    [f.depTime, f.status, f.gate ? `Gate ${f.gate}` : ''].filter(Boolean).join(' · '),
    'Track: waiair.app',
  ].join('\n');
}

export async function shareFlightText(f: FlightBits) {
  const message = shareText(f);
  try {
    await Share.share({ message });
  } catch { /* dismissed */ }
}

export default function ShareFlightCardBtn({
  flight,
  theme,
  dark,
  filled,
  onToast,
}: {
  flight: FlightBits;
  theme: ThemeBits;
  dark?: boolean;
  filled?: boolean;
  onToast?: (msg: string) => void;
}) {
  const shotRef = useRef<ViewShotRef>(null);
  const [busy, setBusy] = useState(false);
  const bg = dark ? '#0B1F3A' : '#F7F4EE';
  const fg = dark ? '#ffffff' : '#0B1F3A';
  const mute = dark ? 'rgba(255,255,255,0.7)' : '#5B6472';
  const gold = '#C9A84C';

  const captureShare = async () => {
    if (busy) return;
    setBusy(true);
    haptics.light();
    try {
      const uri = await shotRef.current?.capture?.();
      const message = shareText(flight);
      if (uri) {
        if (Platform.OS === 'ios') {
          await Share.share({ url: uri, message });
        } else {
          await Share.share({ message, url: uri });
        }
      } else {
        await Share.share({ message });
      }
    } catch {
      try {
        await Share.share({ message: shareText(flight) });
      } catch {
        onToast?.('Could not create share card');
      }
    } finally {
      setBusy(false);
    }
  };

  const meta = [
    flight.gate ? `Gate ${flight.gate}` : '',
    flight.terminal ? (String(flight.terminal).toUpperCase().startsWith('T') ? flight.terminal : `Terminal ${flight.terminal}`) : '',
  ].filter(Boolean).join(' · ');
  const statusLine = [
    flight.dateLabel || 'Today',
    flight.depTime,
    flight.onTime ? 'On Time ✓' : flight.status,
  ].filter(Boolean).join(' · ');

  return (
    <>
      <TouchableOpacity
        onPress={captureShare}
        style={filled ? styles.filledBtn : styles.btn}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel="Share flight card"
      >
        {busy
          ? <ActivityIndicator size="small" color={filled ? '#fff' : theme.secondary} />
          : <ShareNetwork size={14} color={filled ? '#fff' : theme.secondary} />}
        <Text style={filled ? styles.filledTxt : [styles.btnTxt, { color: theme.secondary }]}>
          {filled ? 'Share' : 'Share Card'}
        </Text>
      </TouchableOpacity>

      <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
        <ViewShot ref={shotRef} options={{ format: 'png', quality: 1, result: 'tmpfile' }}>
          <View style={[styles.card, { backgroundColor: bg }]} collapsable={false}>
            <View style={styles.brandRow}>
              <Image source={LOGO} style={styles.logo} />
              <Airplane size={18} color={gold} weight="fill" />
            </View>
            <Text style={[styles.num, { color: fg }]}>
              {flight.flightNumber}{'  '}
              <Text style={styles.iata}>{flight.origin || '—'}</Text>
              {'  ————→  '}
              <Text style={styles.iata}>{flight.destination || '—'}</Text>
            </Text>
            {flight.airline ? (
              <Text style={[styles.airline, { color: mute }]}>{flight.airline}</Text>
            ) : null}
            <Text style={[styles.line, { color: fg }]}>{statusLine}</Text>
            {meta ? <Text style={[styles.meta, { color: mute }]}>{meta}</Text> : null}
            <Text style={[styles.footer, { color: mute }]}>Track at waiair.app</Text>
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
  filledBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#1d4ed8',
  },
  filledTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },
  offscreen: {
    position: 'absolute',
    left: 0,
    top: -280,
    opacity: 0.02,
  },
  card: {
    width: 375,
    height: 200,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    overflow: 'hidden',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: { width: 92, height: 28, resizeMode: 'contain' },
  num: { fontSize: 18, fontWeight: '800', marginTop: 16, letterSpacing: 0.2 },
  iata: { fontWeight: '800', letterSpacing: 1 },
  airline: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  line: { fontSize: 14, fontWeight: '700', marginTop: 14 },
  meta: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  footer: { position: 'absolute', bottom: 14, left: 18, fontSize: 12, fontWeight: '700' },
});
