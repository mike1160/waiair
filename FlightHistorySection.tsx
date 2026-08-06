import { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { History, Lock } from 'lucide-react-native';
import { loadFlightHistory, type HistoryFlight } from './lib/proStorage';

type ThemeColors = {
  text: string; secondary: string; muted: string; accent: string;
  card: string; list: string; gold: string; border: string;
};

type Props = {
  isPro: boolean;
  colors: ThemeColors;
  refreshKey?: number;
  onRequirePro: () => void;
};

function monthLabel(iso: string): string {
  const d = new Date(iso || 0);
  if (Number.isNaN(d.getTime())) return 'Unknown';
  return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

export default function FlightHistorySection({ isPro, colors: C, refreshKey, onRequirePro }: Props) {
  const [items, setItems] = useState<HistoryFlight[]>([]);

  useEffect(() => {
    if (!isPro) return;
    loadFlightHistory().then(setItems);
  }, [isPro, refreshKey]);

  const groups = useMemo(() => {
    const map = new Map<string, HistoryFlight[]>();
    for (const item of items) {
      const label = monthLabel(item.landedAt || item.actualTime || item.scheduledTime);
      const list = map.get(label) ?? [];
      list.push(item);
      map.set(label, list);
    }
    return [...map.entries()];
  }, [items]);

  if (!isPro) {
    return (
      <TouchableOpacity
        style={[styles.lockCard, { backgroundColor: C.card }]}
        onPress={onRequirePro}
        activeOpacity={0.8}
      >
        <View style={styles.lockHead}>
          <History size={16} color={C.gold} strokeWidth={2} />
          <Text style={[styles.lockTitle, { color: C.text }]}>History</Text>
          <View style={[styles.proPill, { borderColor: C.gold }]}>
            <Lock size={11} color={C.gold} strokeWidth={2.5} />
            <Text style={[styles.proPillTxt, { color: C.gold }]}>Pro</Text>
          </View>
        </View>
        <Text style={[styles.lockSub, { color: C.secondary }]}>
          Unlock flight history — all your past flights in one place
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <History size={14} color={C.accent} strokeWidth={2} />
        <Text style={[styles.headTitle, { color: C.accent }]}>History</Text>
        <Text style={[styles.count, { color: C.secondary, backgroundColor: C.list }]}>{items.length}</Text>
      </View>
      {items.length === 0 ? (
        <Text style={[styles.empty, { color: C.muted }]}>
          Landed tracked flights appear here automatically.
        </Text>
      ) : (
        groups.map(([month, flights]) => (
          <View key={month} style={styles.group}>
            <Text style={[styles.month, { color: C.muted }]}>{month.toUpperCase()}</Text>
            {flights.map((f, i) => (
              <View key={`${f.flightNumber}-${f.landedAt}-${i}`} style={[styles.row, { backgroundColor: C.card }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.num, { color: C.text }]}>{f.flightNumber}</Text>
                  <Text style={[styles.route, { color: C.secondary }]}>{f.route}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.time, { color: C.text }]}>{fmtTime(f.actualTime || f.scheduledTime)}</Text>
                  {f.delay > 0
                    ? <Text style={styles.delay}>+{f.delay}m</Text>
                    : <Text style={[styles.gate, { color: C.muted }]}>{f.gate ? `Gate ${f.gate}` : 'On time'}</Text>}
                </View>
              </View>
            ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 8, marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, flex: 1 },
  count: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  empty: { fontSize: 13, paddingVertical: 8 },
  group: { marginBottom: 12 },
  month: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8,
  },
  num: { fontSize: 15, fontWeight: '800' },
  route: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  time: { fontSize: 14, fontWeight: '300' },
  delay: { fontSize: 11, fontWeight: '700', color: '#F59E0B', marginTop: 2 },
  gate: { fontSize: 11, marginTop: 2 },
  lockCard: {
    marginHorizontal: 16, marginTop: 8, marginBottom: 12,
    borderRadius: 16, padding: 16, gap: 8,
  },
  lockHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  lockTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  lockSub: { fontSize: 13, lineHeight: 18 },
  proPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  proPillTxt: { fontSize: 11, fontWeight: '800' },
});
