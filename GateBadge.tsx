import { StyleSheet, Text, View } from 'react-native';

export const GATE_DEP = '#f5a623';
export const GATE_ARR = '#3b82f6';
export const GATE_NONE = '#94a3b8';

type GateKind = 'departure' | 'arrival' | 'none';

export function hasRealGate(gate?: string): boolean {
  const g = String(gate || '').trim();
  return !!g && !/^(—|-|–|n\/?a|tba|tbd|null|undefined|\.+)$/i.test(g);
}

/** "Terminal 2" / "2" / "T2" → "T2" so the label never truncates. */
export function compactTerminal(terminal?: string): string {
  const raw = String(terminal || '').trim();
  if (!raw || raw === '—' || /^(-|–|n\/?a|tba|tbd)$/i.test(raw)) return '';
  const body = raw.replace(/^terminal\s+/i, '').replace(/\s+/g, '');
  if (!body) return '';
  if (/^t/i.test(body)) return body.toUpperCase();
  return `T${body}`;
}

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
  if (!hasRealGate(gate)) return null;
  const kind: GateKind = type === 'none' ? 'departure' : type;
  const bg = kind === 'arrival' ? GATE_ARR : GATE_DEP;
  const arrow = kind === 'arrival' ? '↘' : '↗';
  const label = String(gate).trim().replace(/^gate\s+/i, '');
  const termLabel = compactTerminal(terminal);

  return (
    <View style={styles.wrap}>
      <View style={[styles.badge, { backgroundColor: bg }]}>
        <Text style={styles.arrow}>{arrow}</Text>
        <Text style={styles.gate} numberOfLines={1}>{label}</Text>
      </View>
      {termLabel ? (
        <Text style={[styles.term, { color: secondary }]} numberOfLines={1}>
          {termLabel}
        </Text>
      ) : null}
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
