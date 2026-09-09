import { useEffect, useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PALETTE_TOKENS } from '../lib/themeTokens';
import { consumeBoardingPassShimmer } from '../lib/boardingPassCard';

const TILT = '-2deg';
const SHIMMER_MS = 900;
const BAR_WIDTHS = [2, 1, 3, 1, 2, 4, 1, 2, 1, 3, 2, 1, 4, 1, 2, 3, 1, 2, 1, 3, 2, 4, 1, 2];

export default function BoardingPassCard({
  label,
  onPress,
  isDark,
  holeColor,
}: {
  label: string;
  onPress: () => void;
  isDark: boolean;
  holeColor: string;
}) {
  const systemReduced = useReducedMotion();
  const [a11yReduced, setA11yReduced] = useState(systemReduced);
  const reduced = systemReduced || a11yReduced;
  const navy = isDark ? PALETTE_TOKENS.dark.card : PALETTE_TOKENS.light.navy;
  const ink = isDark ? PALETTE_TOKENS.dark.text : '#F7F5F0';
  const gold = PALETTE_TOKENS.light.gold;
  const shimmerX = useSharedValue(-80);
  const [shimmerOn, setShimmerOn] = useState(false);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setA11yReduced);
    AccessibilityInfo.isReduceMotionEnabled().then(setA11yReduced).catch(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (reduced) return;
    if (!consumeBoardingPassShimmer()) return;
    setShimmerOn(true);
    shimmerX.value = withTiming(220, { duration: SHIMMER_MS, easing: Easing.out(Easing.cubic) });
  }, [reduced, shimmerX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shimmerX.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.wrap}
    >
      <View
        style={[
          styles.card,
          { backgroundColor: navy, transform: [{ rotate: TILT }] },
        ]}
      >
        <Text style={[styles.label, { color: ink }]}>{label}</Text>
        <View style={styles.perf} pointerEvents="none">
          <View style={[styles.notch, { left: -8, backgroundColor: holeColor }]} />
          <View style={styles.dots}>
            {Array.from({ length: 18 }, (_, i) => (
              <View key={i} style={[styles.dot, { backgroundColor: holeColor }]} />
            ))}
          </View>
          <View style={[styles.notch, { right: -8, backgroundColor: holeColor }]} />
        </View>
        <View style={[styles.barcode, { backgroundColor: gold }]}>
          <View style={styles.bars}>
            {BAR_WIDTHS.map((w, i) => (
              <View key={i} style={{ width: w, height: i % 5 === 0 ? 18 : 22, backgroundColor: navy }} />
            ))}
          </View>
          {shimmerOn ? (
            <Animated.View style={[styles.shimmer, shimmerStyle]} pointerEvents="none">
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.55)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.shimmerFill}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 8 },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    marginBottom: 14,
  },
  perf: {
    height: 16,
    marginHorizontal: -20,
    marginBottom: 12,
    justifyContent: 'center',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  notch: {
    position: 'absolute',
    top: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  barcode: {
    height: 36,
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 72,
  },
  shimmerFill: { flex: 1 },
});
