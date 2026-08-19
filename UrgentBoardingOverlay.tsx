import { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { formatGateLabel } from './GateBadge';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';

export type UrgentBoardingPhase = 'boarding' | 'lastCall';

export type UrgentBoardingData = {
  key: string;
  flightNumber: string;
  gate: string;
  destination: string;
  phase: UrgentBoardingPhase;
};

type Props = {
  data: UrgentBoardingData | null;
  onDismiss: () => void;
};

const AUTO_DISMISS_MS = 8000;
const BG = '#B71C1C';

export default function UrgentBoardingOverlay({ data, onDismiss }: Props) {
  const glow = useRef(new Animated.Value(0.35)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!data) return;
    let loop: Animated.CompositeAnimation | null = null;
    try {
      haptics.heavy();
      glow.setValue(0.35);
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(glow, {
            toValue: 0.85,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(glow, {
            toValue: 0.35,
            duration: 700,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
      timerRef.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
    } catch (e) {
      console.warn('[UrgentBoarding] start error', e);
    }
    return () => {
      try {
        loop?.stop();
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
      try {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, [data, glow, onDismiss]);

  if (!data) return null;

  const gate = formatGateLabel(data.gate, true);
  const title = data.phase === 'lastCall' ? t().urgentLastCall : t().urgentBoardingNow;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onDismiss}>
      <StatusBar style="light" />
      <Pressable style={styles.backdrop} onPress={onDismiss}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.center}>
            <Animated.View style={[styles.glow, { opacity: glow }]} />
            <Text style={styles.gate}>{gate}</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta} numberOfLines={2}>
            {data.flightNumber}
            {data.destination ? ` · ${data.destination}` : ''}
          </Text>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => {
              haptics.light();
              onDismiss();
            }}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={t().dismiss}
          >
            <Text style={styles.dismissTxt}>{t().dismiss}</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    backgroundColor: BG,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    marginBottom: 8,
  },
  glow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: '#FF5252',
  },
  gate: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '900',
    letterSpacing: -2,
    textAlign: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginTop: 4,
    textAlign: 'center',
  },
  meta: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    textAlign: 'center',
  },
  dismissBtn: {
    marginTop: 28,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  dismissTxt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
