import { StyleSheet, Text, View } from 'react-native';
import {
  buildCrowdForecast,
  type CrowdFlightLike,
  type CrowdLevel,
} from './lib/crowdForecast';
import { t } from './lib/i18n';

const GOLD = '#C9A84C';
const BG = '#0F1728';

function levelLabel(level: CrowdLevel): string {
  const copy = t();
  if (level === 'veryBusy') return copy.crowdVeryBusy;
  if (level === 'busy') return copy.crowdBusy;
  if (level === 'moderate') return copy.crowdModerate;
  return copy.crowdQuiet;
}

function barH(count: number, max: number): number {
  const peak = Math.max(max, 4);
  return Math.max(4, Math.round((count / peak) * 28));
}

export default function CrowdForecastCard({
  flights,
  iata,
  country,
}: {
  flights: CrowdFlightLike[];
  iata: string;
  country?: string;
}) {
  const forecast = buildCrowdForecast(flights, iata, country);
  if (!forecast || !flights.length) return null;
  const upcoming = forecast.hours.slice(1);
  const max = Math.max(...upcoming.map(h => h.count), 1);

  return (
    <View style={styles.wrap}>
      <Text style={styles.now} numberOfLines={1}>
        {t().crowdNow(levelLabel(forecast.now.level))}
      </Text>
      <View style={styles.bars}>
        {upcoming.map((h, i) => (
          <View key={`${h.hour}-${i}`} style={styles.col}>
            <View style={[styles.bar, { height: barH(h.count, max) }]} />
            <Text style={styles.lbl}>{`${String(h.hour).padStart(2, '0')}h`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    backgroundColor: BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(245,158,11,0.22)',
  },
  now: { color: GOLD, fontSize: 12, fontWeight: '800' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, marginTop: 8 },
  col: { alignItems: 'center', gap: 4, flex: 1 },
  bar: {
    width: 14,
    borderRadius: 6,
    backgroundColor: GOLD,
    minHeight: 4,
  },
  lbl: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
});
