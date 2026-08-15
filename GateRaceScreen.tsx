import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { haptics } from './lib/haptics';
import { useStayAwake } from './lib/keepAwake';
import {
  airportPhone,
  formatMmSs,
  raceBand,
  raceStatusText,
  RACE_COLOR,
  walkLabel,
  type RaceBand,
} from './lib/gateWalk';
import type { GateRacePair } from './lib/gateRace';

const notifiedRed = new Set<string>();

async function pingGateAgent(pair: GateRacePair) {
  const phone = airportPhone(pair.hub);
  const script = `Connecting passenger from ${pair.incoming.number}, walking ${pair.fromGate} → ${pair.toGate}. Please hold.`;
  const buttons: { text: string; style?: 'cancel' | 'default'; onPress?: () => void }[] = [
    { text: 'Sluit', style: 'cancel' },
  ];
  if (phone) {
    buttons.push({
      text: 'Bel luchthaven',
      onPress: () => { Linking.openURL(`tel:${phone}`).catch(() => {}); },
    });
  }
  Alert.alert('Alert gate agent', script, buttons);
}

async function openGateMap(gate: string, hub: string) {
  const q = encodeURIComponent(`Gate ${gate} ${hub} airport`);
  const url = Platform.OS === 'android'
    ? `geo:0,0?q=${q}`
    : `http://maps.apple.com/?q=${q}`;
  try { await Linking.openURL(url); } catch { /* ignore */ }
}

async function notifyRun(pair: GateRacePair) {
  if (notifiedRed.has(pair.key) || Platform.OS === 'web') return;
  notifiedRed.add(pair.key);
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Gate sluit bijna',
        body: `Vraag assistentie bij gate ${pair.fromGate}`,
        sound: true,
        ...(Platform.OS === 'android' ? { channelId: 'flights-urgent' } : {}),
      },
      trigger: null,
    });
  } catch { /* ignore */ }
}

export function GateRaceBanner({
  pair,
  onOpen,
  onDismiss,
  text,
  bg,
}: {
  pair: GateRacePair;
  onOpen: () => void;
  onDismiss: () => void;
  text: string;
  bg: string;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const remainMin = Math.max(0, (pair.departMs - now) / 60000);
  const band = raceBand(remainMin, pair.walk.minutes);
  const color = RACE_COLOR[band];
  const left = Math.max(0, Math.round(remainMin));
  const mark = band === 'green' ? '✅' : band === 'orange' ? '🚶' : '🏃';

  return (
    <View style={[styles.banner, { backgroundColor: bg, borderColor: color }]}>
      <TouchableOpacity
        style={styles.bannerTap}
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel="Open Gate Race"
      >
        <Text style={[styles.bannerTxt, { color: text }]} numberOfLines={2}>
          {`⚡ Gate Race · ${pair.fromGate} → ${pair.toGate} · ${left} min over · Looptijd ${walkLabel(pair.walk)} ${mark}`}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onDismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Sluit Gate Race banner">
        <Text style={[styles.bannerX, { color: text }]}>×</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function GateRaceScreen({
  visible,
  pair,
  onClose,
  bg,
  text,
  secondary,
  isDark,
  airportName,
}: {
  visible: boolean;
  pair: GateRacePair | null;
  onClose: () => void;
  bg: string;
  text: string;
  secondary: string;
  isDark: boolean;
  airportName?: string;
}) {
  useStayAwake('waiair-gaterace', visible);
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const lastBand = useRef<RaceBand | null>(null);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [visible]);

  const remainMs = pair ? pair.departMs - now : 0;
  const remainMin = remainMs / 60000;
  const walkMin = pair?.walk.minutes ?? 15;
  const band: RaceBand = pair ? raceBand(remainMin, walkMin) : 'green';
  const color = RACE_COLOR[band];
  const windowMs = pair ? Math.max(1, pair.departMs - pair.arriveMs) : 1;
  const pct = Math.max(0, Math.min(1, remainMs / windowMs));

  useEffect(() => {
    if (!visible || !pair) {
      lastBand.current = null;
      pulseLoop.current?.stop();
      pulse.setValue(1);
      return;
    }
    if (lastBand.current && lastBand.current !== band) {
      if (band === 'red') haptics.heavy();
      else if (band === 'orange') haptics.warning();
      else haptics.success();
    }
    lastBand.current = band;
    if (band === 'red') notifyRun(pair);

    pulseLoop.current?.stop();
    if (band === 'orange' || band === 'red') {
      const beat = band === 'red' ? 250 : 1000;
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: beat, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: beat, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]),
      );
      pulseLoop.current = loop;
      loop.start();
    } else {
      pulse.setValue(1);
    }
    return () => { pulseLoop.current?.stop(); };
  }, [visible, band, pair, pulse]);

  const screenBg = bg;
  const fg = text;
  const mute = secondary;

  const track = useMemo(() => (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color }]} />
    </View>
  ), [pct, color]);

  if (!pair) return null;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.screen, { backgroundColor: screenBg }]}>
        <Text style={[styles.kicker, { color: color }]}>⚡ GATE RACE</Text>

        <View style={styles.legs}>
          <Text style={[styles.leg, { color: fg }]}>
            Van:  Gate {pair.fromGate}  <Text style={{ color: mute }}>[eerste vlucht geland]</Text>
          </Text>
          <Text style={[styles.leg, { color: fg }]}>
            Naar: Gate {pair.toGate} <Text style={{ color: mute }}>[tweede vlucht vertrekt]</Text>
          </Text>
        </View>

        <Animated.View style={[styles.ring, { borderColor: color, opacity: pulse }]}>
          <Text style={[styles.clock, { color: fg }]} maxFontSizeMultiplier={1}>
            {formatMmSs(remainMs)}
          </Text>
          <Text style={[styles.over, { color: mute }]}>minuten over</Text>
        </Animated.View>

        {track}

        <Text style={[styles.walk, { color: fg }]}>
          Looptijd {pair.fromGate} → {pair.toGate}: {walkLabel(pair.walk)}
        </Text>
        <Text style={[styles.status, { color }]}>
          Status: {band === 'green' ? 'Nog genoeg tijd ✅' : raceStatusText(band)}
        </Text>

        <TouchableOpacity
          style={[styles.cta, { backgroundColor: color }]}
          onPress={() => { haptics.light(); openGateMap(pair.toGate, airportName || pair.hub); }}
          accessibilityRole="button"
          accessibilityLabel={`Navigate to ${pair.toGate}`}
        >
          <Text style={styles.ctaTxt}>🗺 Navigate to {pair.toGate}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctaAlt, { borderColor: color }]}
          onPress={() => { haptics.medium(); pingGateAgent(pair); }}
          accessibilityRole="button"
          accessibilityLabel="Alert gate agent"
        >
          <Text style={[styles.ctaAltTxt, { color: fg }]}>📞 Alert gate agent</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Exit Gate Race">
          <Text style={[styles.exit, { color: mute }]}>Exit Gate Race</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTap: { flex: 1, minWidth: 0 },
  bannerTxt: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  bannerX: { fontSize: 22, fontWeight: '600', paddingHorizontal: 4 },
  screen: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 28 : 64,
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  kicker: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 22,
  },
  legs: { alignSelf: 'stretch', gap: 8, marginBottom: 22 },
  leg: { fontSize: 16, fontWeight: '700' },
  ring: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  clock: { fontSize: 56, fontWeight: '700', letterSpacing: -1 },
  over: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  track: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(148,163,184,0.25)',
    overflow: 'hidden',
    marginBottom: 18,
  },
  fill: { height: 8, borderRadius: 4 },
  walk: { fontSize: 15, fontWeight: '700', textAlign: 'center', marginBottom: 8 },
  status: { fontSize: 16, fontWeight: '800', marginBottom: 24 },
  cta: {
    alignSelf: 'stretch',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  ctaTxt: { color: '#0A0E1A', fontSize: 16, fontWeight: '800' },
  ctaAlt: {
    alignSelf: 'stretch',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 13,
    alignItems: 'center',
  },
  ctaAltTxt: { fontSize: 16, fontWeight: '800' },
  exit: { marginTop: 22, fontSize: 13, fontWeight: '600' },
});
