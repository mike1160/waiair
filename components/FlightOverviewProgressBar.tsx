import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { getLocale, t } from '../lib/i18n';
import {
  formatRemainClock,
  overviewBarTone,
  type OverviewProgressTone,
} from '../lib/flightOverviewProgress';
import { useIsArctic, useIsBlackout, useIsVapor } from '../lib/modeContext';
import { ARCTIC, BLACKOUT, VAPOR } from '../lib/themes';

const PLANE = '✈';
const BAR_H = 4;
const PLANE_SIZE = 14;

const TONE_COLOR: Record<OverviewProgressTone, string> = {
  onTime: '#22c55e',
  delayed: '#F59E0B',
  unknown: '#94a3b8',
  landed: '#22c55e',
};

/**
 * The tone colours above are fixed, which left a bright green arrow on the themes that set out to have no
 * stray colour at all. Each of those themes brings its own status set instead.
 */
function toneSet(t: typeof BLACKOUT | typeof VAPOR | typeof ARCTIC): Record<OverviewProgressTone, string> {
  return {
    onTime: t.statusGreen,
    landed: t.statusGreen,
    delayed: t.statusOrange,
    unknown: t.textSubtle,
  };
}

type Props = {
  pct: number;
  origin: string;
  dest: string;
  remainMin?: number | null;
  delay?: number;
  status?: string;
  landed?: boolean;
  trackColor?: string;
  labelColor?: string;
  iataColor?: string;
};

export default function FlightOverviewProgressBar({
  pct,
  origin,
  dest,
  remainMin,
  delay,
  status,
  landed,
  trackColor = 'rgba(136,146,164,0.28)',
  labelColor = '#8892A4',
  iataColor = '#8892A4',
}: Props) {
  const copy = t();
  const locale = getLocale();
  const tone = overviewBarTone({ delay, status, landed });
  const blackout = useIsBlackout();
  const vapor = useIsVapor();
  const arctic = useIsArctic();
  const tones = blackout ? toneSet(BLACKOUT) : vapor ? toneSet(VAPOR) : arctic ? toneSet(ARCTIC) : TONE_COLOR;
  const color = tones[tone];
  const shown = Math.min(100, Math.max(0, pct));
  const slide = useRef(new Animated.Value(0)).current;
  const animatedOnce = useRef(false);

  useEffect(() => {
    if (!animatedOnce.current) {
      animatedOnce.current = true;
      Animated.timing(slide, {
        toValue: shown,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
      return;
    }
    slide.setValue(shown);
  }, [shown, slide]);

  const remainClock = remainMin != null ? formatRemainClock(remainMin, locale) : '';
  const remain = remainClock ? copy.overviewProgressRemain(remainClock) : '';
  const meta = copy.overviewProgressMeta(shown, remain);
  const fillWidth = slide.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });
  const planeLeft = slide.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={styles.wrap}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: shown }}
      accessibilityLabel={`${origin} ${dest} ${meta}`}
    >
      <View style={styles.row}>
        <Text style={[styles.iata, { color: iataColor }]}>{origin}</Text>
        <View style={[styles.track, { backgroundColor: trackColor }]}>
          <Animated.View style={[styles.fill, { backgroundColor: color, width: fillWidth }]} />
          <Animated.View
            pointerEvents="none"
            style={[styles.planeWrap, { left: planeLeft }]}
          >
            <Text style={[styles.plane, { color }]}>{PLANE}</Text>
          </Animated.View>
        </View>
        <Text style={[styles.iata, styles.iataEnd, { color: iataColor }]}>{dest}</Text>
      </View>
      <Text style={[styles.meta, { color: labelColor }]}>{meta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', marginTop: 10, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  iata: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, width: 28 },
  iataEnd: { textAlign: 'right' },
  track: {
    flex: 1,
    height: BAR_H,
    borderRadius: BAR_H / 2,
    overflow: 'visible',
    justifyContent: 'center',
  },
  fill: {
    height: BAR_H,
    borderRadius: BAR_H / 2,
  },
  planeWrap: {
    position: 'absolute',
    top: -(PLANE_SIZE / 2 - BAR_H / 2),
    marginLeft: -PLANE_SIZE / 2,
    width: PLANE_SIZE,
    alignItems: 'center',
  },
  plane: { fontSize: 12, lineHeight: PLANE_SIZE },
  meta: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
