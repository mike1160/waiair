/**
 * One leg's time on the flight detail screen: the clock time is the loud line, the countdown the quiet one under it.
 * Clock times are never truncated (they shrink to 20px at most on a narrow screen); only the countdown may ellipsize.
 */
import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, Text, View } from 'react-native';
import { clockColor, pulseTiming, type ClockEmphasis } from '../lib/clockEmphasis';

const CLOCK_SIZE = 28;
const CLOCK_MIN_SIZE = 20;

type Props = {
  /** "12:25" */
  clock: string;
  /** "BKK time" */
  suffix?: string;
  /** "Departs in 3h 12m" — secondary, may ellipsize. */
  countdown?: string;
  /** The scheduled time a new time replaced: struck through, grey. */
  originalClock?: string;
  emphasis: ClockEmphasis;
  textColor: string;
  mutedColor: string;
};

export default function LegClock({ clock, suffix, countdown, originalClock, emphasis, textColor, mutedColor }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;
  const timing = pulseTiming(emphasis.pulse);
  const from = timing?.from ?? 1;
  const duration = timing?.duration ?? 0;

  useEffect(() => {
    let cancelled = false;
    if (!duration) {
      pulse.setValue(1);
      return undefined;
    }
    let loop: Animated.CompositeAnimation | null = null;
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then(reduce => {
        if (cancelled || reduce) return;
        loop = Animated.loop(
          Animated.sequence([
            Animated.timing(pulse, { toValue: from, duration, useNativeDriver: true }),
            Animated.timing(pulse, { toValue: 1, duration, useNativeDriver: true }),
          ]),
        );
        loop.start();
      });
    return () => {
      cancelled = true;
      loop?.stop();
      pulse.setValue(1);
    };
  }, [from, duration, pulse]);

  if (!clock) return null;
  const color = clockColor(emphasis.tone, textColor);

  return (
    <View style={styles.wrap}>
      {originalClock ? (
        <Text style={[styles.original, { color: mutedColor }]} numberOfLines={1} allowFontScaling={false}>
          {originalClock}
        </Text>
      ) : null}
      <View style={styles.clockRow}>
        <Text
          style={[styles.clock, { color }, emphasis.strike ? styles.struck : null]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={CLOCK_MIN_SIZE / CLOCK_SIZE}
          allowFontScaling={false}
        >
          {clock}
        </Text>
        {suffix ? (
          <Text style={[styles.suffix, { color: mutedColor }]} numberOfLines={1} allowFontScaling={false}>
            {suffix}
          </Text>
        ) : null}
      </View>
      {countdown ? (
        <Animated.Text
          style={[styles.countdown, { color: mutedColor, opacity: pulse }]}
          numberOfLines={1}
          ellipsizeMode="tail"
          allowFontScaling={false}
        >
          {countdown}
        </Animated.Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { minWidth: 0 },
  original: { fontSize: 15, fontWeight: '400', textDecorationLine: 'line-through', letterSpacing: 0.3, marginBottom: 1 },
  clockRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, minWidth: 0 },
  clock: { fontSize: CLOCK_SIZE, fontWeight: '800', letterSpacing: -0.5, fontVariant: ['tabular-nums'], flexShrink: 0 },
  struck: { textDecorationLine: 'line-through' },
  suffix: { fontSize: 12, fontWeight: '600', marginBottom: 3, flexShrink: 1, minWidth: 0 },
  countdown: { fontSize: 13, fontWeight: '600', marginTop: 3 },
});
