import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { AlertTriangle, Clock, ShieldCheck, X } from 'lucide-react-native';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

const REL_GREEN = '#34C759';
const REL_ORANGE = '#FF9500';
const REL_RED = '#FF3B30';

type WorstRoute = {
  from: string;
  to: string;
  flights: number;
  averageDelayMinutes: number;
  cancelled?: number;
};

export type AirlineReliability = {
  airline: string;
  totalFlights: number;
  onTimePercent: number;
  averageDelayMinutes: number;
  worstRoutes: WorstRoute[];
};

function tierColor(pct: number): string {
  if (pct >= 85) return REL_GREEN;
  if (pct >= 70) return REL_ORANGE;
  return REL_RED;
}

function delayColor(mins: number): string {
  if (mins < 15) return REL_GREEN;
  if (mins < 30) return REL_ORANGE;
  return REL_RED;
}

function TierIcon({ pct, size = 14 }: { pct: number; size?: number }) {
  const color = tierColor(pct);
  if (pct >= 85) return <ShieldCheck size={size} color={color} strokeWidth={2.4} />;
  if (pct >= 70) return <Clock size={size} color={color} strokeWidth={2.4} />;
  return <AlertTriangle size={size} color={color} strokeWidth={2.4} />;
}

function OnTimeRing({ percent, color, size = 112 }: { percent: number; color: string; size?: number }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, percent));
  const dash = (pct / 100) * c;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color + '33'}
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${Math.max(c - dash, 0)}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={{ fontSize: 26, fontWeight: '800', color }}>{Math.round(pct)}%</Text>
      <Text style={{ fontSize: 11, fontWeight: '600', color: color + 'cc', marginTop: 2 }}>on time</Text>
    </View>
  );
}

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  card: string;
  border: string;
  bg: string;
  list: string;
};

export default function ReliabilityBadge({
  airlineCode,
  airlineName,
  theme,
}: {
  airlineCode: string;
  airlineName?: string;
  theme: ThemeBits;
}) {
  const code = String(airlineCode || '').replace(/[^A-Za-z]/g, '').toUpperCase();
  const [data, setData] = useState<AirlineReliability | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!code || code.length < 2) {
      setData(null);
      return;
    }
    setBusy(true);
    setData(null);
    fetch(`${PROXY}/reliability/${encodeURIComponent(code)}`)
      .then(async r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: AirlineReliability) => {
        if (cancelled) return;
        if (!json || typeof json.onTimePercent !== 'number') {
          setData(null);
          return;
        }
        setData(json);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  const color = data ? tierColor(data.onTimePercent) : theme.muted;
  const topRoutes = useMemo(
    () => (data?.worstRoutes || []).slice(0, 3),
    [data],
  );

  if (!code) return null;
  if (busy && !data) {
    return (
      <View style={[styles.badge, { backgroundColor: theme.list }]}>
        <ActivityIndicator size="small" color={theme.muted} />
        <Text style={[styles.badgeTxt, { color: theme.muted }]}>Reliability…</Text>
      </View>
    );
  }
  if (!data || !data.totalFlights) return null;

  const pctLabel = `${Math.round(data.onTimePercent)}% on time`;

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        activeOpacity={0.75}
        style={[styles.badge, { backgroundColor: color + '1A' }]}
        accessibilityRole="button"
        accessibilityLabel={`Airline reliability ${pctLabel}`}
      >
        <TierIcon pct={data.onTimePercent} />
        <Text style={[styles.badgeTxt, { color }]}>{pctLabel}</Text>
      </TouchableOpacity>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.handle} />
            <View style={styles.sheetHead}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={[styles.sheetTitle, { color: theme.text }]}>
                  {airlineName || data.airline} reliability
                </Text>
                <Text style={[styles.sheetSub, { color: theme.secondary }]}>
                  {data.airline} · WaiAir tracked flights
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setOpen(false)}
                style={[styles.close, { backgroundColor: theme.list }]}
                hitSlop={8}
              >
                <X size={16} color={theme.muted} strokeWidth={2.2} />
              </TouchableOpacity>
            </View>

            <View style={styles.ringWrap}>
              <OnTimeRing percent={data.onTimePercent} color={color} />
            </View>

            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: theme.list }]}>
                <Text style={[styles.statLabel, { color: theme.muted }]}>TRACKED</Text>
                <Text style={[styles.statVal, { color: theme.text }]}>{data.totalFlights}</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: theme.list }]}>
                <Text style={[styles.statLabel, { color: theme.muted }]}>AVG DELAY</Text>
                <Text style={[styles.statVal, { color }]}>
                  {Number(data.averageDelayMinutes).toFixed(1)}m
                </Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: color + '1A' }]}>
                <Text style={[styles.statLabel, { color }]}>ON TIME</Text>
                <Text style={[styles.statVal, { color }]}>
                  {Math.round(data.onTimePercent)}%
                </Text>
              </View>
            </View>

            <Text style={[styles.sectionLabel, { color: theme.secondary }]}>Worst routes</Text>
            {topRoutes.length === 0 ? (
              <Text style={[styles.emptyRoutes, { color: theme.muted }]}>No route data yet</Text>
            ) : (
              topRoutes.map((route, i) => (
                <View
                  key={`${route.from}-${route.to}-${i}`}
                  style={[styles.routeRow, { borderColor: theme.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.routePath, { color: theme.text }]}>
                      {route.from} → {route.to}
                    </Text>
                    <Text style={[styles.routeMeta, { color: theme.muted }]}>
                      {route.flights} flight{route.flights === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Text style={[styles.routeDelay, { color: delayColor(route.averageDelayMinutes) }]}>
                    +{Math.round(route.averageDelayMinutes)}m
                  </Text>
                </View>
              ))
            )}

            <Text style={[styles.disclaimer, { color: theme.muted }]}>
              Based on WaiAir data — last 30 days
            </Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeTxt: {
    fontSize: 12,
    fontWeight: '700',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    marginBottom: 14,
    opacity: 0.5,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  sheetSub: {
    fontSize: 12,
    marginTop: 3,
    fontWeight: '500',
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringWrap: {
    alignItems: 'center',
    marginVertical: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  statVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  emptyRoutes: {
    fontSize: 13,
    marginBottom: 12,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  routePath: {
    fontSize: 15,
    fontWeight: '700',
  },
  routeMeta: {
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  routeDelay: {
    fontSize: 15,
    fontWeight: '800',
  },
  disclaimer: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    fontWeight: '500',
  },
});
