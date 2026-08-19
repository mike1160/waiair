import { StyleSheet, Text, View } from 'react-native';
import { airlineOutlook, weekdayPart } from './lib/delayHistory';
import { t } from './lib/i18n';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  list: string;
  border: string;
};

export default function DelayPredictionCard({
  airlineCode,
  airlineName,
  origin,
  destination,
  scheduledIso,
  theme,
}: {
  airlineCode: string;
  airlineName?: string;
  origin: string;
  destination: string;
  scheduledIso?: string;
  theme: ThemeBits;
}) {
  const outlook = airlineOutlook(airlineCode, airlineName);
  if (!outlook) return null;
  const { weekday, part } = weekdayPart(scheduledIso, origin);
  const onTime = outlook.onTimePercent >= 75;
  const route = [origin, destination].filter(Boolean).join('→');

  return (
    <View style={[styles.card, { backgroundColor: theme.list, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>{t().delayHistory}</Text>
      <Text style={[styles.sub, { color: theme.muted }]}>{t().delayHistorySub}</Text>
      <Text style={[styles.line, { color: theme.secondary }]}>
        {outlook.airline}{route ? ` ${route}` : ''} on {weekday} {part}
      </Text>
      <Text style={[styles.stat, { color: theme.text }]}>
        {t().typicallyOnTime(outlook.onTimePercent)}
      </Text>
      <Text style={[styles.stat, { color: theme.secondary }]}>
        {t().avgDelayWhenLate(outlook.avgDelayWhenLate)}
      </Text>
      <Text style={[styles.today, { color: onTime ? '#22C55E' : '#F59E0B' }]}>
        {onTime ? t().todayOutlookOnTime : t().todayOutlookLate}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 2 },
  sub: { fontSize: 11, fontWeight: '600', marginBottom: 8 },
  line: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  stat: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  today: { fontSize: 13, fontWeight: '800', marginTop: 8 },
});
