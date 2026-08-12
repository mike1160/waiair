import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
};

type Stats = {
  onTimePercent: number;
  averageDelayMinutes: number;
  totalFlights: number;
};

function tierColor(pct: number) {
  if (pct > 80) return '#34C759';
  if (pct >= 60) return '#FF9500';
  return '#FF3B30';
}

export default function FlightDelayHistory({
  flightNumber,
  theme,
}: {
  flightNumber: string;
  theme: ThemeBits;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const count = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const clean = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
    if (!clean) { setStats(null); return; }
    setStats(null);
    fetch(`${PROXY}/flights/number/${encodeURIComponent(clean)}/stats`)
      .then(async r => {
        if (!r.ok) throw new Error('no');
        return r.json();
      })
      .then((json: Stats) => {
        if (cancelled) return;
        if (typeof json?.onTimePercent !== 'number') { setStats(null); return; }
        setStats(json);
      })
      .catch(() => { if (!cancelled) setStats(null); });
    return () => { cancelled = true; };
  }, [flightNumber]);

  useEffect(() => {
    if (!stats) return;
    count.setValue(0);
    const id = count.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(count, {
      toValue: stats.onTimePercent,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => count.removeListener(id);
  }, [stats, count]);

  if (!stats) return null;

  const color = tierColor(stats.onTimePercent);
  const size = 96;
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const dash = (Math.max(0, Math.min(100, stats.onTimePercent)) / 100) * c;

  return (
    <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.card }]}>
      <View style={[styles.gradient, { backgroundColor: color + '14' }]} />
      <View style={styles.head}>
        <Ionicons name="time-outline" size={16} color={theme.accent} />
        <Text style={[styles.headTxt, { color: theme.secondary }]}>
          Delay History · Last 30 days
        </Text>
      </View>
      <View style={styles.body}>
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={size} height={size} style={{ position: 'absolute' }}>
            <Circle cx={size / 2} cy={size / 2} r={r} stroke={color + '33'} strokeWidth={stroke} fill="none" />
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke={color}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${dash} ${Math.max(c - dash, 0)}`}
              strokeLinecap="round"
              rotation="-90"
              origin={`${size / 2}, ${size / 2}`}
            />
          </Svg>
          <Text style={[styles.pct, { color }]}>{display}%</Text>
          <Text style={[styles.pctSub, { color: theme.muted }]}>on time</Text>
        </View>
        <View style={{ flex: 1, gap: 6 }}>
          <Text style={[styles.avg, { color: theme.text }]}>
            avg {stats.averageDelayMinutes}m late
          </Text>
          <Text style={[styles.meta, { color: theme.muted }]}>
            Based on {stats.totalFlights} recent flights
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    padding: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  gradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  headTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  body: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  pct: { fontSize: 22, fontWeight: '800' },
  pctSub: { fontSize: 10, fontWeight: '600', marginTop: -2 },
  avg: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 12, fontWeight: '500' },
});
