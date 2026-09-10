import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Clipboard as ClipboardIcon } from 'phosphor-react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PALETTE_TOKENS } from '../lib/themeTokens';
import { BOOKING_STUB_LIFT_AFTER_MS, consumeBookingStubLift } from '../lib/boardingPassCard';
import { clipboardImportHit, type ClipboardImportHit } from '../lib/clipboardTrackable';
import { parseImportText, type ImportCandidate } from '../lib/flightImport';
import { haptics } from '../lib/haptics';

const IDLE_TILT = 1.5;
const IDLE_LIFT = -2;
const PRESS_LIFT = -8;
const SLIDE_UP = -88;
const CREAM = '#F7F5F0';

export default function BookingStub({
  caption,
  emptyHint,
  onHit,
  onMiss,
  isDark,
  holeColor,
}: {
  caption: string;
  emptyHint: string;
  onHit: (hit: ClipboardImportHit<ImportCandidate>) => void;
  onMiss: () => void;
  isDark: boolean;
  holeColor: string;
}) {
  const systemReduced = useReducedMotion();
  const [a11yReduced, setA11yReduced] = useState(systemReduced);
  const reduced = systemReduced || a11yReduced;
  const navy = isDark ? PALETTE_TOKENS.dark.card : PALETTE_TOKENS.light.navy;
  const gold = PALETTE_TOKENS.light.gold;
  const rotate = useSharedValue(IDLE_TILT);
  const lift = useSharedValue(0);
  const opacity = useSharedValue(1);
  const pendingHit = useRef<ClipboardImportHit<ImportCandidate> | null>(null);
  const missTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState('BOOKING');
  const [settledLift, setSettledLift] = useState(0);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setA11yReduced);
    AccessibilityInfo.isReduceMotionEnabled().then(setA11yReduced).catch(() => {});
    return () => {
      sub.remove();
      if (missTimer.current) clearTimeout(missTimer.current);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    if (!consumeBookingStubLift()) return;
    const t = setTimeout(() => {
      lift.value = withTiming(IDLE_LIFT, { duration: 300, easing: Easing.out(Easing.cubic) });
      setSettledLift(IDLE_LIFT);
    }, BOOKING_STUB_LIFT_AFTER_MS);
    return () => clearTimeout(t);
  }, [reduced, lift]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: lift.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const settle = (toLift: number) => {
    const ms = reduced ? 0 : 220;
    rotate.value = withTiming(IDLE_TILT, { duration: ms, easing: Easing.out(Easing.cubic) });
    lift.value = withTiming(toLift, { duration: ms, easing: Easing.out(Easing.cubic) });
    opacity.value = 1;
  };

  const flushHit = () => {
    const hit = pendingHit.current;
    pendingHit.current = null;
    if (hit && hit.kind !== 'none') onHit(hit);
    else setBusy(false);
  };

  const afterClipboard = (raw: string) => {
    const hit = clipboardImportHit<ImportCandidate>(parseImportText(raw), raw);
    if (hit.kind !== 'none') {
      pendingHit.current = hit;
      const ms = reduced ? 0 : 280;
      lift.value = withTiming(SLIDE_UP, { duration: ms, easing: Easing.in(Easing.cubic) });
      opacity.value = withTiming(0, { duration: ms }, finished => {
        if (finished) runOnJS(flushHit)();
        else runOnJS(setBusy)(false);
      });
      return;
    }
    settle(settledLift);
    setLabel(emptyHint);
    if (missTimer.current) clearTimeout(missTimer.current);
    missTimer.current = setTimeout(() => {
      missTimer.current = null;
      setLabel('BOOKING');
      onMiss();
      setBusy(false);
    }, 1000);
  };

  const readClipboard = () => {
    void Clipboard.getStringAsync()
      .then(text => afterClipboard(text))
      .catch(() => afterClipboard(''));
  };

  const onPress = () => {
    if (busy) return;
    setBusy(true);
    haptics.light();
    const ms = reduced ? 0 : 150;
    rotate.value = withTiming(0, { duration: ms, easing: Easing.out(Easing.cubic) });
    lift.value = withTiming(PRESS_LIFT, { duration: ms, easing: Easing.out(Easing.cubic) }, finished => {
      if (!finished) {
        runOnJS(setBusy)(false);
        return;
      }
      runOnJS(readClipboard)();
    });
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={caption}
      style={styles.hit}
    >
      <Animated.View style={[styles.shadow, { shadowColor: PALETTE_TOKENS.light.navy }, animStyle]}>
        <View style={[styles.stub, { backgroundColor: navy }]}>
          <View style={styles.perf} pointerEvents="none">
            <View style={[styles.notch, { left: -8, backgroundColor: holeColor }]} />
            <View style={styles.dots}>
              {Array.from({ length: 18 }, (_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: CREAM }]} />
              ))}
            </View>
            <View style={[styles.notch, { right: -8, backgroundColor: holeColor }]} />
          </View>
          <View style={styles.row}>
            <View style={styles.copy}>
              <Text style={[styles.kicker, { color: gold }]}>{label}</Text>
              <Text style={[styles.caption, { color: CREAM }]} numberOfLines={2}>{caption}</Text>
            </View>
            <View style={styles.glyph}>
              <ClipboardIcon size={16} color={CREAM} weight="regular" />
            </View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    marginTop: 10,
    marginLeft: 8,
    width: '60%',
    alignSelf: 'flex-start',
  },
  shadow: {
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  stub: {
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: 10,
  },
  perf: {
    height: 14,
    marginHorizontal: 0,
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  dot: { width: 4, height: 4, borderRadius: 2 },
  notch: {
    position: 'absolute',
    top: -1,
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 2,
  },
  copy: { flex: 1, minWidth: 0 },
  glyph: { opacity: 0.7 },
  kicker: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 2,
  },
  caption: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
});
