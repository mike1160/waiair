import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { X } from 'phosphor-react-native';
import type { NextFlightShareData } from './MyNextFlightShare';
import QuickShareRow from './components/QuickShareRow';
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
import PassportRouteMap from './PassportRouteMap';

const NAVY = '#1A2744';
const GOLD = '#C9A84C';
const CAPTURE_DELAY_MS = 1500;

function fmtStampDate(iso: string, iata?: string, country?: string): string {
  return formatAirportDate(iso, iata, country) || '—';
}

function StampRow({ entry }: { entry: PassportEntry }) {
  const originFlag = countryFlag(entry.originCountry || '');
  const destFlag = countryFlag(entry.destCountry || '');
  const onTime = entry.delayMin <= 0;
  const km = entry.distanceKm > 0 ? `${formatPassportKm(entry.distanceKm)} km` : '';
  const dur = entry.durationMs > 0 ? formatPassportDuration(entry.durationMs) : '';

  return (
    <View style={styles.stamp}>
      <Text style={styles.stampFlags}>{originFlag || '🛫'} → {destFlag || '🛬'}</Text>
      <Text style={styles.stampFlight}>{entry.flightNumber} · {fmtStampDate(entry.landedAt, entry.destIata, entry.destCountry)}</Text>
      <Text style={styles.stampMeta}>
        {[
          formatAirportClockLabeled(entry.depTimeIso, entry.originIata, false, entry.originCountry),
          formatArrivesClockLabeled(entry.arrTimeIso, entry.destIata, false, entry.destCountry),
          km,
          dur,
        ].filter(v => v && v !== '–:–').join(' · ') || `${entry.originIata} → ${entry.destIata}`}
      </Text>
      <Text style={[styles.stampStatus, { color: onTime ? '#22C55E' : GOLD }]}>
        {onTime ? t().landed : `+${entry.delayMin}m`}
      </Text>
    </View>
  );
}

function PassportShareArt({
  stats,
  entries,
  airportCount,
}: {
  stats: ReturnType<typeof computePassportStats>;
  entries: PassportEntry[];
  airportCount: number;
}) {
  const recent = entries.slice(0, 4);
  return (
    <View style={styles.shareCard} collapsable={false}>
      <Text style={styles.shareLogo}>✈️ WaiAir</Text>
      <Text style={styles.shareTitle}>{t().flightPassportTitle}</Text>
      <Text style={styles.shareTraveler}>{t().passportTraveler}</Text>
      <View style={styles.shareStats}>
        <Text style={styles.shareStatLine}>🌍 {t().passportStatsFlights(stats.totalFlights)}</Text>
        <Text style={styles.shareStatLine}>📏 {t().passportStatsKm(formatPassportKm(stats.totalKm))}</Text>
        <Text style={styles.shareStatLine}>⏱️ {t().passportStatsAirTime(formatPassportHours(stats.totalDurationMs))}</Text>
        <Text style={styles.shareStatLine}>🗺️ {t().passportStatsCountries(stats.countries.length)}</Text>
        <Text style={styles.shareStatLine}>🛫 {airportCount} airports</Text>
      </View>
      {recent.map(e => (
        <Text key={e.id} style={styles.shareRecent}>{e.originIata} → {e.destIata} · {e.flightNumber}</Text>
      ))}
      <Text style={styles.shareTagline}>{t().passportShareTagline(formatPassportKm(stats.totalKm))}</Text>
      <Text style={styles.shareUrl}>waiair.app</Text>
    </View>
  );
}

export default function FlightPassportShare({
  visible,
  refreshKey = 0,
  onClose,
}: {
  visible: boolean;
  refreshKey?: number;
  onClose: () => void;
}) {
  const shotRef = useRef<ViewShotRef>(null);
  const layoutReadyRef = useRef(false);
  const [entries, setEntries] = useState<PassportEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const stats = useMemo(() => computePassportStats(entries), [entries]);
  const airportCount = stats.airports.length;
  const shown = expanded ? entries : entries.slice(0, 8);
  const shareMessage = t().passportShareTagline(formatPassportKm(stats.totalKm));
  const shareData: NextFlightShareData = useMemo(() => ({
    flightNumber: 'WaiAir',
    airlineCode: 'WA',
    originIata: entries[0]?.originIata || '—',
    destIata: entries[0]?.destIata || '—',
    originCity: entries[0]?.originCity || '',
    destCity: entries[0]?.destCity || '',
    originPlace: '',
    destPlace: '',
    dateIso: new Date().toISOString(),
  }), [entries]);

  const [loaded, setLoaded] = useState(false);

  const reload = useCallback(() => {
    loadPassportEntries().then(e => { setEntries(e); setLoaded(true); });
  }, []);

  useEffect(() => {
    if (!visible) return;
    layoutReadyRef.current = false;
    setReady(false);
    setExpanded(false);
    setLoaded(false);
    reload();
  }, [visible, refreshKey, reload]);

  const onCaptureLayout = () => {
    layoutReadyRef.current = true;
    setReady(true);
  };

  const waitForCaptureReady = async () => {
    for (let i = 0; i < 60; i++) {
      if (layoutReadyRef.current) break;
      await new Promise<void>(resolve => setTimeout(resolve, 50));
    }
    await new Promise<void>(resolve => setTimeout(resolve, CAPTURE_DELAY_MS));
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  };

  const captureImage = async (): Promise<string | null> => {
    await waitForCaptureReady();
    if (!shotRef.current?.capture) {
      console.warn('[Share] passport capture: shotRef not attached');
      return null;
    }
    try {
      const uri = (await shotRef.current.capture()) || null;
      console.warn('[Share] passport capture result:', uri);
      return uri;
    } catch (e) {
      console.warn('[Share] passport capture failed', e);
      return null;
    }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t().close}>
            <X size={22} color={GOLD} />
          </TouchableOpacity>
        </View>

        {loaded && entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>✈️</Text>
            <Text style={styles.emptyTitle}>{t().flightPassportTitle}</Text>
            <Text style={styles.emptyMsg}>{t().passportEmpty}</Text>
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.cover}>
            <Text style={styles.coverLogo}>✈️ WaiAir</Text>
            <Text style={styles.coverTitle}>{t().flightPassportTitle}</Text>
            <Text style={styles.coverTraveler}>{t().passportTraveler}</Text>
            <PassportRouteMap
              entries={entries}
              routeCount={stats.totalFlights}
              countryCount={stats.countries.length}
              airportCount={airportCount}
            />
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
                <Text style={styles.statVal}>{airportCount}</Text>
                <Text style={styles.statLbl}>airports</Text>
              </View>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t().passportStamps}</Text>
          {!entries.length ? (
            <Text style={styles.empty}>{t().passportEmpty}</Text>
          ) : (
            <>
              {shown.map(entry => <StampRow key={entry.id} entry={entry} />)}
              {entries.length > 8 ? (
                <TouchableOpacity onPress={() => setExpanded(v => !v)} style={styles.moreBtn}>
                  <Text style={styles.moreTxt}>
                    {expanded ? t().showLess : t().showAllPassport(entries.length)}
                  </Text>
                </TouchableOpacity>
              ) : null}
            </>
          )}

          <View style={styles.shareWrap}>
            <QuickShareRow
              data={shareData}
              ready={ready && entries.length > 0}
              busy={busy}
              onBusy={setBusy}
              captureImage={captureImage}
              shareMessage={shareMessage}
              showLabels={false}
              compact
            />
          </View>
        </ScrollView>
        )}

        {entries.length > 0 && (
          <View collapsable={false} style={styles.captureWrap} pointerEvents="none">
            <ViewShot
              ref={shotRef}
              style={{ width: 1080, height: 1920, backgroundColor: 'transparent' }}
              options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 }}
              onLayout={onCaptureLayout}
            >
              <PassportShareArt stats={stats} entries={entries} airportCount={airportCount} />
            </ViewShot>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0F1728' },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'flex-end',
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 40 },
  cover: {
    backgroundColor: NAVY,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: GOLD,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  coverLogo: { color: GOLD, fontSize: 18, fontWeight: '900' },
  coverTitle: {
    color: GOLD,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: 10,
    textAlign: 'center',
  },
  coverTraveler: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600', marginTop: 8 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  statCell: {
    minWidth: '28%',
    alignItems: 'center',
    backgroundColor: 'rgba(245,166,35,0.12)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.25)',
  },
  statVal: { color: GOLD, fontSize: 18, fontWeight: '900' },
  statLbl: { color: 'rgba(255,255,255,0.65)', fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  sectionTitle: { color: GOLD, fontSize: 13, fontWeight: '800', letterSpacing: 1.2, marginBottom: 10 },
  empty: { color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center', marginBottom: 20 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: GOLD, fontSize: 20, fontWeight: '900', letterSpacing: 2.5, marginBottom: 12 },
  emptyMsg: { color: 'rgba(255,255,255,0.6)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  stamp: {
    backgroundColor: 'rgba(26,35,126,0.35)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.22)',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  stampFlags: { fontSize: 18, marginBottom: 4 },
  stampFlight: { color: '#F8FAFC', fontSize: 15, fontWeight: '800' },
  stampMeta: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', marginTop: 3 },
  stampStatus: { fontSize: 12, fontWeight: '700', marginTop: 4 },
  moreBtn: { alignSelf: 'center', paddingVertical: 8, marginBottom: 8 },
  moreTxt: { color: GOLD, fontSize: 13, fontWeight: '700' },
  shareWrap: { alignItems: 'center', marginTop: 16, gap: 12, paddingBottom: 8 },
  captureWrap: {
    position: 'absolute',
    left: -12000,
    top: 0,
    width: 1080,
    height: 1920,
    opacity: 0.01,
  },
  shareCard: {
    width: 1080,
    height: 1920,
    backgroundColor: NAVY,
    paddingHorizontal: 80,
    paddingTop: 140,
    paddingBottom: 100,
    alignItems: 'center',
  },
  shareLogo: { color: GOLD, fontSize: 48, fontWeight: '900' },
  shareTitle: { color: GOLD, fontSize: 52, fontWeight: '900', letterSpacing: 4, marginTop: 24, textAlign: 'center' },
  shareTraveler: { color: 'rgba(255,255,255,0.55)', fontSize: 32, fontWeight: '600', marginTop: 20 },
  shareStats: { marginTop: 48, gap: 18, width: '100%' },
  shareStatLine: { color: '#F8FAFC', fontSize: 34, fontWeight: '700', textAlign: 'center' },
  shareRecent: { color: 'rgba(255,255,255,0.45)', fontSize: 26, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  shareTagline: { color: GOLD, fontSize: 38, fontWeight: '800', textAlign: 'center', marginTop: 'auto', paddingHorizontal: 20 },
  shareUrl: { color: 'rgba(255,255,255,0.45)', fontSize: 28, fontWeight: '700', marginTop: 16 },
});
