import { StyleSheet, Text, View } from 'react-native';

export const GATE_DEP = '#f5a623';
export const GATE_ARR = '#3b82f6';
export const GATE_NONE = '#94a3b8';

type GateKind = 'departure' | 'arrival' | 'none';

export default function GateBadge({
  type,
  gate,
  terminal,
  secondary,
}: {
  type: GateKind;
  gate?: string;
  terminal?: string;
  secondary: string;
}) {
  const raw = String(gate || '').trim();
  const empty = !raw || raw === '—' || /^(-|–|n\/?a|tba|tbd)$/i.test(raw);
  const kind: GateKind = empty ? 'none' : type;
  const bg = kind === 'departure' ? GATE_DEP : kind === 'arrival' ? GATE_ARR : GATE_NONE;
  const arrow = kind === 'departure' ? '↗' : kind === 'arrival' ? '↘' : '';
  const label = empty ? '—' : raw.replace(/^gate\s+/i, '');
  const term = String(terminal || '').trim();
  const termLabel = !term || term === '—' ? '—' : /^terminal\b/i.test(term) ? term : `Terminal ${term}`;

  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: bg }]}>
        {arrow ? <Text style={styles.arrow}>{arrow}</Text> : null}
        <Text style={styles.gate} numberOfLines={1}>{label}</Text>
      </View>
      <Text style={[styles.term, { color: secondary }]} numberOfLines={1}>
        {termLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 64, alignItems: 'center' },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  arrow: {
    position: 'absolute',
    top: 6,
    left: 8,
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  gate: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  term: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
