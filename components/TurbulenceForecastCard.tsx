import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  barLevelForSeverity,
  fetchTurbulenceForecast,
  flightDateKey,
  isAlertSeverity,
  type TurbulenceForecast,
  type TurbulenceSeverity,
} from '../lib/turbulence';
import { t } from '../lib/i18n';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  list: string;
};

function severityLabel(s: TurbulenceSeverity): string {
  const copy = t();
  switch (s) {
    case 'light': return copy.turbulenceLight;
    case 'moderate': return copy.turbulenceModerate;
    case 'severe': return copy.turbulenceSevere;
    default: return copy.turbulenceSmooth;
  }
}

function severityEmoji(s: TurbulenceSeverity): string {
  switch (s) {
    case 'light': return '🟡';
    case 'moderate': return '🟠';
    case 'severe': return '🔴';
    default: return '';
  }
}

function TurbulenceBar({ level, track, fill }: { level: number; track: string; fill: string }) {
  const slots = 10;
  const filled = Math.max(0, Math.min(slots, Math.round(level)));
  return (
    <View style={st.barRow} accessibilityRole="progressbar">
      {Array.from({ length: slots }, (_, i) => (
        <View
          key={i}
          style={[st.barSlot, { backgroundColor: i < filled ? fill : track }]}
        />
      ))}
    </View>
  );
}

export default function TurbulenceForecastCard({
  origin,
  destination,
  departureIso,
  durationMin,
  flightNumber,
  theme,
  onAlert,
}: {
  origin: string;
  destination: string;
  departureIso?: string;
  durationMin?: number;
  flightNumber: string;
  theme: ThemeBits;
  onAlert?: (forecast: TurbulenceForecast) => void;
}) {
  const [forecast, setForecast] = useState<TurbulenceForecast | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setBusy(true);
    setForecast(null);
    (async () => {
      const data = await fetchTurbulenceForecast({
        origin,
        destination,
        date: flightDateKey(departureIso),
        departureIso,
        durationMin,
      });
      if (cancelled) return;
      setForecast(data);
      setBusy(false);
      if (data && isAlertSeverity(data.peak)) onAlert?.(data);
    })();
    return () => { cancelled = true; };
  }, [origin, destination, departureIso, durationMin, onAlert]);

  if (busy) {
    return (
      <View style={[st.card, { backgroundColor: theme.list, borderColor: theme.border }]}>
        <ActivityIndicator color={theme.accent} size="small" />
      </View>
    );
  }
  if (!forecast) return null;

  const left = severityLabel(forecast.overall);
  const right = severityLabel(forecast.peak);
  const rightEmoji = severityEmoji(forecast.peak);
  const barLevel = forecast.barLevel || barLevelForSeverity(forecast.peak);
  const regionLine = forecast.windowStart && forecast.windowEnd
    ? t().turbulenceRegionLine(forecast.region, forecast.windowStart, forecast.windowEnd)
    : t().turbulenceOver(forecast.region);

  return (
    <View style={[st.card, { backgroundColor: theme.list, borderColor: theme.border }]}>
      <Text style={[st.title, { color: theme.text }]}>{t().turbulenceForecast}</Text>
      <View style={st.divider} />
      <View style={st.severityRow}>
        <Text style={[st.severityLabel, { color: theme.text }]}>{left}</Text>
        <View style={st.barWrap}>
          <TurbulenceBar level={barLevel} track={theme.border} fill={theme.accent} />
        </View>
        <Text style={[st.severityLabel, { color: theme.text }]}>
          {rightEmoji ? `${rightEmoji} ` : ''}{right}
        </Text>
      </View>
      <Text style={[st.detail, { color: theme.secondary }]} numberOfLines={2}>
        {regionLine}
      </Text>
      <Text style={[st.hint, { color: theme.muted }]} accessibilityElementsHidden>
        {flightNumber}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(136,150,176,0.35)',
    marginBottom: 10,
  },
  severityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  severityLabel: { fontSize: 13, fontWeight: '700', minWidth: 56 },
  barWrap: { flex: 1 },
  barRow: { flexDirection: 'row', gap: 3, height: 10 },
  barSlot: { flex: 1, borderRadius: 2 },
  detail: { fontSize: 13, fontWeight: '600', marginTop: 8 },
  hint: { height: 0, overflow: 'hidden' },
});
