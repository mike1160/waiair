import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme } from './constants/theme';
import { t } from './lib/i18n';

type Risk = 'green' | 'amber' | 'red' | 'critical';

export type ConnectionRiskItem = {
  key: string;
  incomingNumber: string;
  outgoingNumber: string;
  hub: string;
  gapMin: number;
  risk: Risk;
};

const RISK_COLOR: Record<Risk, string> = {
  green: Theme.statusGreen,
  amber: Theme.statusAmber,
  red: Theme.statusRed,
  critical: Theme.statusRed,
};

function riskLabel(risk: Risk): string {
  const copy = t();
  if (risk === 'critical') return copy.connectionRiskCritical;
  if (risk === 'red') return copy.connectionRiskRed;
  if (risk === 'amber') return copy.connectionRiskAmber;
  return copy.connectionRiskGreen;
}

export default function ConnectionRiskCard({
  connections,
  onOpen,
}: {
  connections: ConnectionRiskItem[];
  onOpen?: (flightNumber: string) => void;
}) {
  if (!connections.length) return null;
  const copy = t();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{copy.connectionRiskTitle}</Text>
      {connections.map(c => (
        <Pressable
          key={c.key}
          style={styles.row}
          onPress={() => onOpen?.(c.outgoingNumber)}
          accessibilityRole="button"
          accessibilityLabel={`${c.incomingNumber} → ${c.outgoingNumber} ${c.hub} ${riskLabel(c.risk)}`}
        >
          <View style={[styles.dot, { backgroundColor: RISK_COLOR[c.risk] }]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.line} numberOfLines={1}>
              {c.incomingNumber} → {c.outgoingNumber} · {c.hub}
            </Text>
            <Text style={[styles.sub, { color: RISK_COLOR[c.risk] }]} numberOfLines={1}>
              {copy.connectionRiskGap(Math.round(c.gapMin))} · {riskLabel(c.risk)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 8,
    padding: Theme.cardPadding,
    backgroundColor: Theme.card,
    borderRadius: Theme.cardRadius,
    borderWidth: 1,
    borderColor: 'rgba(170,190,220,0.18)',
    gap: 10,
  },
  title: { color: Theme.text, fontSize: 14, fontWeight: '800' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { color: Theme.text, fontSize: 13, fontWeight: '700' },
  sub: { fontSize: 12, fontWeight: '600', marginTop: 2 },
});
