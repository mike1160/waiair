import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

  if (!stats) return null;

  const color = tierColor(stats.onTimePercent);
  const pct = Math.round(stats.onTimePercent);

  return (
    <View
      style={[styles.badge, { backgroundColor: color + '1A' }]}
      accessibilityLabel={`${pct} percent on time`}
    >
      <Text style={[styles.pct, { color }]}>{pct}% on time</Text>
      {stats.totalFlights > 0 ? (
        <Text style={[styles.meta, { color: theme.muted }]}>
          · {stats.totalFlights} flights
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 4,
  },
  pct: { fontSize: 12, fontWeight: '700' },
  meta: { fontSize: 11, fontWeight: '600' },
});
