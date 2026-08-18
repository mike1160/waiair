import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Airplane, ShareNetwork } from 'phosphor-react-native';
import {
  computePassportStats,
  countryFlag,
  formatPassportDuration,
  formatPassportHours,
  formatPassportKm,
  loadPassportEntries,
  type PassportEntry,
} from './lib/flightPassport';
import { t } from './lib/i18n';

type ThemeColors = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  card: string;
  list: string;
  gold: string;
  border: string;
};

function fmtStampDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

function StampRow({ entry, colors: C }: { entry: PassportEntry; colors: ThemeColors }) {
  const originFlag = countryFlag(entry.originCountry || '');
  const destFlag = countryFlag(entry.destCountry || '');
  const onTime = entry.delayMin <= 0;
  const km = entry.distanceKm > 0 ? `${formatPassportKm(entry.distanceKm)} km` : '';
  const dur = entry.durationMs > 0 ? formatPassportDuration(entry.durationMs) : '';

  return (
    <View style={[styles.stamp, { backgroundColor: C.card, borderColor: C.border }]}>
      <Text style={styles.stampFlags}>{originFlag || '🛫'} → {destFlag || '🛬'}</Text>
      <Text style={[styles.stampFlight, { color: C.text }]}>{entry.flightNumber} · {fmtStampDate(entry.landedAt)}</Text>
      <Text style={[styles.stampMeta, { color: C.secondary }]}>
        {[km, dur].filter(Boolean).join(' · ') || `${entry.originIata} → ${entry.destIata}`}
      </Text>
      <Text style={[styles.stampStatus, { color: onTime ? '#22C55E' : '#F59E0B' }]}>
        {onTime ? `${t().onTimeStatus} ✅` : `+${entry.delayMin}m`}
      </Text>
    </View>
  );
}

export default function FlightPassportSection({
  colors: C,
  refreshKey = 0,
  onSharePassport,
}: {
  colors: ThemeColors;
  refreshKey?: number;
  onSharePassport: () => void;
}) {
  const [entries, setEntries] = useState<PassportEntry[]>([]);
  const [expanded, setExpanded] = useState(false);

  const reload = useCallback(() => {
    loadPassportEntries().then(setEntries);
  }, []);

  useEffect(() => {
    reload();
  }, [reload, refreshKey]);

  const stats = useMemo(() => computePassportStats(entries), [entries]);
  const shown = expanded ? entries : entries.slice(0, 5);

  if (!entries.length) {
    return (
      <View style={[styles.wrap, styles.emptyWrap, { borderColor: C.border }]}>
        <Airplane size={22} color={C.accent} weight="fill" />
        <Text style={[styles.headTitle, { color: C.accent }]}>{t().myFlightPassport}</Text>
        <Text style={[styles.emptyTxt, { color: C.muted }]}>{t().passportEmpty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={[styles.cover, { backgroundColor: '#0A0E1A', borderColor: 'rgba(255,215,0,0.28)' }]}
        onPress={onSharePassport}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={t().sharePassport}
      >
        <Text style={styles.coverLogo}>✈️ WaiAir</Text>
        <Text style={styles.coverTitle}>{t().flightPassportTitle}</Text>
        <Text style={styles.coverSub}>{t().passportTraveler} · {t().passportStatsFlights(stats.totalFlights)}</Text>
        <View style={styles.statsGrid}>
          <Text style={styles.statChip}>🌍 {stats.totalFlights}</Text>
          <Text style={styles.statChip}>📏 {formatPassportKm(stats.totalKm)} km</Text>
          <Text style={styles.statChip}>⏱️ {formatPassportHours(stats.totalDurationMs)}</Text>
          <Text style={styles.statChip}>🗺️ {stats.countries.length}</Text>
          <Text style={styles.statChip}>✈️ {stats.airlines.length}</Text>
        </View>
        <View style={styles.shareHint}>
          <ShareNetwork size={14} color="#FFD700" />
          <Text style={styles.shareHintTxt}>{t().sharePassport}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.head}>
        <Text style={[styles.listTitle, { color: C.text }]}>{t().passportStamps}</Text>
        <Text style={[styles.count, { color: C.secondary, backgroundColor: C.list }]}>{entries.length}</Text>
      </View>

      {shown.map(entry => (
        <StampRow key={entry.id} entry={entry} colors={C} />
      ))}

      {entries.length > 5 ? (
        <TouchableOpacity onPress={() => setExpanded(v => !v)} style={styles.moreBtn}>
          <Text style={[styles.moreTxt, { color: C.accent }]}>
            {expanded ? t().showLess : t().showAllPassport(entries.length)}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  emptyWrap: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  emptyTxt: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  cover: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  coverLogo: { color: '#FFD700', fontSize: 16, fontWeight: '800' },
  coverTitle: { color: '#FFD700', fontSize: 22, fontWeight: '900', letterSpacing: 2, marginTop: 8 },
  coverSub: { color: 'rgba(255,255,255,0.55)', fontSize: 13, fontWeight: '600', marginTop: 6 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  statChip: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', backgroundColor: 'rgba(255,255,255,0.08)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  shareHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  shareHintTxt: { color: '#FFD700', fontSize: 12, fontWeight: '700' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headTitle: { fontSize: 14, fontWeight: '800' },
  listTitle: { fontSize: 13, fontWeight: '800', flex: 1 },
  count: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  stamp: {
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  stampFlags: { fontSize: 18, marginBottom: 4 },
  stampFlight: { fontSize: 15, fontWeight: '800' },
  stampMeta: { fontSize: 12, fontWeight: '600', marginTop: 3 },
  stampStatus: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  moreBtn: { alignSelf: 'center', paddingVertical: 8 },
  moreTxt: { fontSize: 13, fontWeight: '700' },
});
