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
import { formatAirportClockLabeled, formatAirportDate, formatArrivesClockLabeled } from './lib/flightTimes';
import { t } from './lib/i18n';
import { PASSPORT } from './lib/passportTheme';

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

function fmtStampDate(iso: string, iata?: string, country?: string): string {
  return formatAirportDate(iso, iata, country) || '—';
}

function StampRow({ entry, index }: { entry: PassportEntry; index: number }) {
  const destFlag = countryFlag(entry.destCountry || '');
  const onTime = entry.delayMin <= 0;
  const airportLabel = entry.destCity
    ? `${entry.destIata} · ${entry.destCity}`
    : entry.destIata;
  const km = entry.distanceKm > 0 ? `${formatPassportKm(entry.distanceKm)} km` : '';
  const dur = entry.durationMs > 0 ? formatPassportDuration(entry.durationMs) : '';
  const tilt = index % 2 === 0 ? '-2deg' : '1.5deg';

  return (
    <View style={[styles.stamp, { transform: [{ rotate: tilt }] }]}>
      <Text style={styles.stampFlag}>{destFlag || '🛬'}</Text>
      <Text style={styles.stampAirport}>{airportLabel.toUpperCase()}</Text>
      <Text style={styles.stampDate}>{fmtStampDate(entry.landedAt, entry.destIata, entry.destCountry)}</Text>
      <Text style={styles.stampFlight}>{entry.flightNumber}</Text>
      <Text style={styles.stampMeta}>
        {[
          `${entry.originIata} → ${entry.destIata}`,
          formatAirportClockLabeled(entry.depTimeIso, entry.originIata, false, entry.originCountry),
          formatArrivesClockLabeled(entry.arrTimeIso, entry.destIata, false, entry.destCountry),
          km,
          dur,
        ].filter(v => v && v !== '–:–').join(' · ')}
      </Text>
      <Text style={[styles.stampStatus, { color: onTime ? '#166534' : '#92400E' }]}>
        {onTime ? t().landed.toUpperCase() : `+${entry.delayMin}M`}
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
      <View style={[styles.wrap, styles.emptyWrap]}>
        <Airplane size={22} color={PASSPORT.gold} weight="fill" />
        <Text style={styles.headTitle}>{t().myFlightPassport}</Text>
        <Text style={styles.emptyTxt}>{t().passportEmpty}</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.cover}
        onPress={onSharePassport}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={t().sharePassport}
      >
        <Text style={styles.crestIcon}>✈</Text>
        <Text style={styles.coverTitle}>{t().flightPassportTitle}</Text>
        <Text style={styles.coverTraveler}>{t().passportTraveler}</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{stats.totalFlights}</Text>
            <Text style={styles.statLbl}>flights</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{formatPassportKm(stats.totalKm)}</Text>
            <Text style={styles.statLbl}>km</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{formatPassportHours(stats.totalDurationMs)}</Text>
            <Text style={styles.statLbl}>hours</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{stats.countries.length}</Text>
            <Text style={styles.statLbl}>countries</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{stats.airlines.length}</Text>
            <Text style={styles.statLbl}>airlines</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statVal}>{formatPassportKm(stats.totalCo2Kg)}</Text>
            <Text style={styles.statLbl}>kg CO₂</Text>
          </View>
        </View>
        <View style={styles.shareHint}>
          <ShareNetwork size={14} color={PASSPORT.gold} />
          <Text style={styles.shareHintTxt}>{t().sharePassport}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.stampPage}>
        <View style={styles.head}>
          <Text style={styles.listTitle}>{t().passportStamps.toUpperCase()}</Text>
          <Text style={styles.count}>{entries.length}</Text>
        </View>

        {shown.map((entry, index) => (
          <StampRow key={entry.id} entry={entry} index={index} />
        ))}

        {entries.length > 5 ? (
          <TouchableOpacity onPress={() => setExpanded(v => !v)} style={styles.moreBtn}>
            <Text style={styles.moreTxt}>
              {expanded ? t().showLess : t().showAllPassport(entries.length)}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 8 },
  emptyWrap: {
    backgroundColor: PASSPORT.cover,
    borderWidth: 2,
    borderColor: PASSPORT.gold,
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    gap: 8,
  },
  emptyTxt: { color: 'rgba(255,255,255,0.75)', fontSize: 13, textAlign: 'center', lineHeight: 18 },
  cover: {
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PASSPORT.gold,
    backgroundColor: PASSPORT.cover,
    padding: 18,
    marginBottom: 14,
    alignItems: 'center',
  },
  crestIcon: { color: PASSPORT.gold, fontSize: 28, fontWeight: '900' },
  coverTitle: {
    color: PASSPORT.gold,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 8,
    textTransform: 'uppercase',
  },
  coverTraveler: {
    color: PASSPORT.gold,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '600',
    marginTop: 8,
  },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14, justifyContent: 'center' },
  statCell: {
    alignItems: 'center',
    backgroundColor: PASSPORT.stat,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: PASSPORT.goldDim,
    minWidth: 72,
  },
  statVal: { color: PASSPORT.gold, fontSize: 16, fontWeight: '900' },
  statLbl: { color: '#FFFFFF', fontSize: 9, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  shareHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  shareHintTxt: { color: PASSPORT.gold, fontSize: 12, fontWeight: '700' },
  stampPage: {
    backgroundColor: PASSPORT.ivory,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(28,20,16,0.12)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  headTitle: { fontSize: 14, fontWeight: '800', color: PASSPORT.gold },
  listTitle: { fontSize: 11, fontWeight: '800', flex: 1, letterSpacing: 2, color: PASSPORT.ink, opacity: 0.65 },
  count: {
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    color: PASSPORT.ink,
    backgroundColor: 'rgba(28,20,16,0.08)',
  },
  stamp: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    borderWidth: 2,
    borderColor: PASSPORT.ink,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stampFlag: { fontSize: 20, marginBottom: 4 },
  stampAirport: { color: PASSPORT.ink, fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  stampDate: { color: PASSPORT.inkMuted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  stampFlight: { color: PASSPORT.ink, fontSize: 13, fontWeight: '800', marginTop: 4 },
  stampMeta: { color: PASSPORT.inkMuted, fontSize: 11, fontWeight: '600', marginTop: 4 },
  stampStatus: { fontSize: 10, fontWeight: '800', marginTop: 6, letterSpacing: 1 },
  moreBtn: { alignSelf: 'center', paddingVertical: 8 },
  moreTxt: { fontSize: 13, fontWeight: '700', color: PASSPORT.ink, opacity: 0.7 },
});
