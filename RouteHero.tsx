import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Airplane } from 'phosphor-react-native';

const LIVE_GREEN = '#00C853';
const GLOW = 'rgba(0, 200, 83, 0.55)';

const STARS = [
  { x: 0.08, y: 0.18, r: 1.1, o: 0.35 },
  { x: 0.16, y: 0.42, r: 0.8, o: 0.22 },
  { x: 0.22, y: 0.12, r: 1.4, o: 0.4 },
  { x: 0.31, y: 0.55, r: 0.7, o: 0.18 },
  { x: 0.38, y: 0.2, r: 1.0, o: 0.28 },
  { x: 0.47, y: 0.08, r: 1.3, o: 0.45 },
  { x: 0.54, y: 0.48, r: 0.9, o: 0.2 },
  { x: 0.61, y: 0.16, r: 1.1, o: 0.32 },
  { x: 0.69, y: 0.38, r: 0.8, o: 0.24 },
  { x: 0.76, y: 0.11, r: 1.2, o: 0.38 },
  { x: 0.84, y: 0.5, r: 0.7, o: 0.2 },
  { x: 0.91, y: 0.22, r: 1.0, o: 0.3 },
  { x: 0.12, y: 0.68, r: 0.6, o: 0.16 },
  { x: 0.88, y: 0.66, r: 0.7, o: 0.18 },
];

function quadPoint(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

function quadAngle(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
  const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function routeT(progress: number) {
  return Math.min(0.97, Math.max(0.03, progress));
}

export default function RouteHero({
  origin,
  destination,
  originCity,
  destCity,
  progress = 0,
  duration,
  status,
  animated = true,
}: {
  origin: string;
  destination: string;
  originCity?: string;
  destCity?: string;
  progress?: number;
  duration?: string;
  status?: string;
  animated?: boolean;
}) {
  const w = Dimensions.get('window').width;
  const h = 196;
  const pad = 36;
  const x0 = pad;
  const x1 = w - pad;
  const y = 86;
  const cx = w / 2;
  const cy = 28;
  const target = routeT(progress);
  const anim = useRef(new Animated.Value(status === 'landed' ? 0.97 : 0.03)).current;
  const twinkle = useRef(new Animated.Value(0.45)).current;
  const [t, setT] = useState(target);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setT(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (!animated) {
      anim.setValue(target);
      setT(target);
      return;
    }
    Animated.timing(anim, {
      toValue: target,
      duration: 1400,
      useNativeDriver: false,
    }).start();
  }, [anim, animated, target]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0.35, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [twinkle]);

  const plane = useMemo(() => quadPoint(t, x0, y, cx, cy, x1, y), [t, x0, x1, y, cx, cy]);
  const angle = useMemo(() => quadAngle(t, x0, y, cx, cy, x1, y), [t, x0, x1, y, cx, cy]);
  const o = (origin || '').toUpperCase();
  const d = (destination || '').toUpperCase();
  const dash = Math.max(8, Math.round(t * 220));

  return (
    <View style={[styles.wrap, { width: w, height: h }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="routeHeroBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#05070d" />
            <Stop offset="1" stopColor="#0b1a36" />
          </LinearGradient>
        </Defs>
        <Path d={`M0 0 H${w} V${h} H0 Z`} fill="url(#routeHeroBg)" />
        {STARS.map((s, i) => (
          <Circle
            key={i}
            cx={s.x * w}
            cy={s.y * h}
            r={s.r}
            fill="#ffffff"
            opacity={s.o}
          />
        ))}
        <Path
          d={`M ${x0} ${y} Q ${cx} ${cy} ${x1} ${y}`}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={2}
          fill="none"
        />
        <Path
          d={`M ${x0} ${y} Q ${cx} ${cy} ${x1} ${y}`}
          stroke={LIVE_GREEN}
          strokeWidth={2}
          fill="none"
          strokeDasharray={`${dash} 240`}
          strokeLinecap="round"
        />
        <Circle cx={x0} cy={y} r={9} fill="rgba(0,200,83,0.18)" />
        <Circle cx={x0} cy={y} r={4.5} fill={GLOW} />
        <Circle cx={x0} cy={y} r={2.4} fill="#ffffff" />
        <Circle cx={x1} cy={y} r={9} fill="rgba(0,200,83,0.18)" />
        <Circle cx={x1} cy={y} r={4.5} fill={GLOW} />
        <Circle cx={x1} cy={y} r={2.4} fill="#ffffff" />
      </Svg>
      <Animated.View
        style={[
          styles.plane,
          {
            left: plane.x - 11,
            top: plane.y - 11,
            transform: [{ rotate: `${angle}deg` }],
            opacity: twinkle.interpolate({ inputRange: [0.35, 1], outputRange: [0.82, 1] }),
          },
        ]}
        pointerEvents="none"
      >
        <Airplane size={22} color={LIVE_GREEN} weight="fill" />
      </Animated.View>
      <View style={styles.cities} pointerEvents="none">
        <View style={styles.cityCol}>
          <Text style={styles.code}>{o || ''}</Text>
          <Text style={styles.city} numberOfLines={1}>{originCity || o}</Text>
        </View>
        <View style={styles.midCol}>
          {duration ? <Text style={styles.duration}>{duration}</Text> : null}
        </View>
        <View style={[styles.cityCol, styles.cityRight]}>
          <Text style={styles.code}>{d || ''}</Text>
          <Text style={styles.city} numberOfLines={1}>{destCity || d}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  plane: { position: 'absolute' },
  cities: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  cityCol: { flex: 1, maxWidth: '38%' },
  cityRight: { alignItems: 'flex-end' },
  midCol: { flex: 1, alignItems: 'center', paddingBottom: 2 },
  code: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  city: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  duration: {
    color: 'rgba(255,255,255,0.72)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
