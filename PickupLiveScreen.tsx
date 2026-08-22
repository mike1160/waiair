import { useEffect, useRef, useState } from 'react';
import {
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
import AirlineLogo from './AirlineLogo';
import { runWhileAppActive, startLoopWhileActive } from './lib/appActivity';
import { haptics } from './lib/haptics';
import { useStayAwake } from './lib/keepAwake';
import { formatMmSs } from './lib/gateWalk';
import { t } from './lib/i18n';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';

const GOLD = '#C9A84C';
const GREEN = '#22C55E';
const CIRCLE = 200;

export type PickupLiveData = {
  flightNumber: string;
  airlineCode: string;
  airline?: string;
  etaIso: string;
  destIata?: string;
  destCountry?: string;
  landed?: boolean;
  baggage?: string;
  exitLine?: string | null;
  walkMin: number;
};

function prettyNumber(n: string): string {
  const s = String(n || '').replace(/\s+/g, '').toUpperCase();
  const m = s.match(/^([A-Z]{1,3})(\d{1,4}[A-Z]?)$/);
  return m ? `${m[1]}${m[2]}` : s;
}

function beltLabel(baggage?: string): string {
  const b = String(baggage || '').trim();
  if (!b || /^(—|-|–|n\/?a|tba|tbd)$/i.test(b)) return t().baggageBeltTba;
  return t().baggageBelt(b);
}

async function openWhatsApp(text: string) {
  const encoded = encodeURIComponent(text);
  const appUrl = `whatsapp://send?text=${encoded}`;
  const webUrl = `https://wa.me/?text=${encoded}`;
  try {
    const can = await Linking.canOpenURL(appUrl);
    if (can) {
      await Linking.openURL(appUrl);
      return;
    }
  } catch { /* fall through */ }
  try { await Linking.openURL(webUrl); } catch { /* ignore */ }
}

export default function PickupLiveScreen({
  visible,
  data,
  onClose,
  bg,
  text,
  secondary,
  isDark,
}: {
  visible: boolean;
  data: PickupLiveData | null;
  onClose: () => void;
  bg: string;
  text: string;
  secondary: string;
  isDark: boolean;
}) {
  useStayAwake('waiair-pickup', visible);
  const [now, setNow] = useState(Date.now());
  const pulse = useRef(new Animated.Value(1)).current;
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const lastPhase = useRef<'ok' | 'soon' | 'landed' | null>(null);

  const etaMs = data?.etaIso
    ? (isoInAirportTzToUtcMs(data.etaIso, data.destIata, data.destCountry) ?? new Date(data.etaIso).getTime())
    : 0;
  const remain = Number.isFinite(etaMs) ? etaMs - now : 0;
  const landed = !!data?.landed || (Number.isFinite(etaMs) && remain <= 0);
  const soon = !landed && remain > 0 && remain < 5 * 60_000;
  const phase: 'ok' | 'soon' | 'landed' = landed ? 'landed' : soon ? 'soon' : 'ok';

  useEffect(() => {
    if (!visible) return;
    return runWhileAppActive(() => {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    });
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      lastPhase.current = null;
      pulseLoop.current?.stop();
      pulse.setValue(1);
      return;
    }
    if (lastPhase.current && lastPhase.current !== phase) {
      if (phase === 'landed') haptics.success();
      else if (phase === 'soon') haptics.warning();
      else haptics.light();
    }
    lastPhase.current = phase;

    pulseLoop.current?.stop();
    if (phase === 'soon') {
      return startLoopWhileActive(() =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: 0.45, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ]),
        ),
      );
    }
    pulse.setValue(1);
    return () => {
      try {
        pulseLoop.current?.stop();
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, [visible, phase, pulse]);

  if (!data) return null;

  const copy = t();
  const num = prettyNumber(data.flightNumber);
  const label = !num || num === '—' ? copy.yourFlight : num;
  const remainMin = Math.max(0, Math.floor(remain / 60000));
  const waText = landed
    ? copy.waHereLanded(label)
    : remainMin < 1
      ? copy.waHereLandingNow(label)
      : copy.waHereLandsIn(label, remainMin);
  const belt = beltLabel(data.baggage);
  const screenBg = bg;
  const fg = text;
  const mute = secondary;
  const border = landed ? GREEN : GOLD;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.screen, { backgroundColor: screenBg }]}>
        <View style={styles.logo}>
          <AirlineLogo iata={data.airlineCode} name={data.airline} size={40} />
        </View>

        <Text style={[styles.headline, { color: fg }]} maxFontSizeMultiplier={1.15}>
          {copy.isLanding(label)}
        </Text>

        <Animated.View
          style={[
            styles.circle,
            { borderColor: border, opacity: pulse },
          ]}
        >
          {landed ? (
            <Text style={[styles.check, { color: GREEN }]}>✓</Text>
          ) : (
            <Text style={[styles.clock, { color: fg }]} maxFontSizeMultiplier={1}>
              {formatMmSs(remain)}
            </Text>
          )}
        </Animated.View>

        {landed ? (
          <Text style={[styles.landed, { color: fg }]}>
            {copy.landedBeltWalk(belt, data.walkMin)}
          </Text>
        ) : (
          <View style={styles.meta}>
            <Text style={[styles.metaLine, { color: fg }]}>{belt}</Text>
            {data.exitLine ? (
              <Text style={[styles.metaLine, { color: fg }]}>{data.exitLine}</Text>
            ) : null}
            <Text style={[styles.metaSub, { color: mute }]}>
              {copy.walkTimeGateBaggage(data.walkMin)}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.waBtn}
          onPress={() => { haptics.light(); openWhatsApp(waText); }}
          accessibilityRole="button"
          accessibilityLabel={copy.sendWhatsApp}
        >
          <Text style={styles.waTxt}>📱 {copy.sendWhatsApp}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={copy.exitPickupMode}>
          <Text style={[styles.exit, { color: mute }]}>{copy.exitPickupMode}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 28 : 64,
    paddingHorizontal: 28,
    paddingBottom: 36,
  },
  logo: { marginBottom: 22 },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.6,
    textAlign: 'center',
    marginBottom: 28,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  clock: {
    fontSize: 72,
    fontWeight: '700',
    letterSpacing: -1,
  },
  check: {
    fontSize: 64,
    fontWeight: '700',
  },
  landed: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  meta: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 28,
  },
  metaLine: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  metaSub: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  waBtn: {
    backgroundColor: '#25D366',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 28,
    minWidth: 240,
    alignItems: 'center',
  },
  waTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  exit: {
    marginTop: 22,
    fontSize: 13,
    fontWeight: '600',
  },
});
