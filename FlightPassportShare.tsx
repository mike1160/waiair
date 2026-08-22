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
import { PASSPORT } from './lib/passportTheme';
import PassportRouteMap from './PassportRouteMap';

const CAPTURE_DELAY_MS = 1500;

function fmtStampDate(iso: string, iata?: string, country?: string): string {
  return formatAirportDate(iso, iata, country) || '—';
}

function PassportGrid() {
  const lines = useMemo(() => {
    const out = [];
    for (let i = 0; i < 24; i++) {
      out.push(
        <View key={`h${i}`} style={[gridStyles.line, { top: i * 22, height: StyleSheet.hairlineWidth }]} />,
      );
    }
    for (let i = 0; i < 14; i++) {
      out.push(
        <View key={`v${i}`} style={[gridStyles.lineV, { left: i * 30, width: StyleSheet.hairlineWidth }]} />,
      );
    }
    return out;
  }, []);
  return <View pointerEvents="none" style={gridStyles.wrap}>{lines}</View>;
}

const gridStyles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject },
  line: { position: 'absolute', left: 0, right: 0, backgroundColor: PASSPORT.grid },
  lineV: { position: 'absolute', top: 0, bottom: 0, backgroundColor: PASSPORT.grid },
});

function PassportCrest({ large }: { large?: boolean }) {
  return (
    <View style={styles.crest}>
      <Text style={[styles.crestIcon, large && styles.crestIconLg]}>✈</Text>
      <Text style={[styles.crestBrand, large && styles.crestBrandLg]}>WaiAir</Text>
    </View>
  );
}

function StampRow({ entry, index }: { entry: PassportEntry; index: number }) {
  const destFlag = countryFlag(entry.destCountry || '');
  const originFlag = countryFlag(entry.originCountry || '');
  const onTime = entry.delayMin <= 0;
  const airportLabel = entry.destCity
    ? `${entry.destIata} · ${entry.destCity}`
    : entry.destIata;
  const km = entry.distanceKm > 0 ? `${formatPassportKm(entry.distanceKm)} km` : '';
  const dur = entry.durationMs > 0 ? formatPassportDuration(entry.durationMs) : '';
  const tilt = index % 2 === 0 ? '-2deg' : '1.5deg';

  return (
    <View style={[styles.stamp, { transform: [{ rotate: tilt }] }]}>
      <Text style={styles.stampFlag}>{destFlag || originFlag || '🛬'}</Text>
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
      <PassportGrid />
      <PassportCrest large />
      <Text style={styles.shareTitle}>{t().flightPassportTitle}</Text>
      <Text style={styles.shareTraveler}>{t().passportTraveler}</Text>
      <View style={styles.shareStatsRow}>
        <View style={styles.shareStatCell}>
          <Text style={styles.shareStatVal}>{stats.totalFlights}</Text>
          <Text style={styles.shareStatLbl}>flights</Text>
        </View>
        <View style={styles.shareStatCell}>
          <Text style={styles.shareStatVal}>{formatPassportKm(stats.totalKm)}</Text>
          <Text style={styles.shareStatLbl}>km</Text>
        </View>
        <View style={styles.shareStatCell}>
          <Text style={styles.shareStatVal}>{formatPassportHours(stats.totalDurationMs)}</Text>
          <Text style={styles.shareStatLbl}>hours</Text>
        </View>
        <View style={styles.shareStatCell}>
          <Text style={styles.shareStatVal}>{stats.countries.length}</Text>
          <Text style={styles.shareStatLbl}>countries</Text>
        </View>
        <View style={styles.shareStatCell}>
          <Text style={styles.shareStatVal}>{airportCount}</Text>
          <Text style={styles.shareStatLbl}>airports</Text>
        </View>
      </View>
      <View style={styles.shareStampPage}>
        {recent.map((e, i) => (
          <View key={e.id} style={[styles.shareStamp, { transform: [{ rotate: i % 2 ? '1deg' : '-1.5deg' }] }]}>
            <Text style={styles.shareStampAirport}>{e.destIata}</Text>
            <Text style={styles.shareStampFlight}>{e.flightNumber} · {e.originIata} → {e.destIata}</Text>
          </View>
        ))}
      </View>
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
        <PassportGrid />
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel={t().close}>
            <X size={22} color={PASSPORT.gold} />
          </TouchableOpacity>
        </View>

        {loaded && entries.length === 0 ? (
          <View style={styles.emptyWrap}>
            <PassportCrest large />
            <Text style={styles.emptyTitle}>{t().flightPassportTitle}</Text>
            <Text style={styles.emptyMsg}>{t().passportEmpty}</Text>
          </View>
        ) : (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.cover}>
            <PassportGrid />
            <PassportCrest />
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

          <View style={styles.stampPage}>
            <Text style={styles.sectionTitle}>{t().passportStamps.toUpperCase()}</Text>
            {!entries.length ? (
              <Text style={styles.empty}>{t().passportEmpty}</Text>
            ) : (
              <>
                {shown.map((entry, index) => <StampRow key={entry.id} entry={entry} index={index} />)}
                {entries.length > 8 ? (
                  <TouchableOpacity onPress={() => setExpanded(v => !v)} style={styles.moreBtn}>
                    <Text style={styles.moreTxt}>
                      {expanded ? t().showLess : t().showAllPassport(entries.length)}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>

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
  root: { flex: 1, backgroundColor: PASSPORT.bg, overflow: 'hidden' },
  topBar: {
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
    paddingHorizontal: 16,
    paddingBottom: 8,
    alignItems: 'flex-end',
    zIndex: 2,
  },
  scroll: { paddingHorizontal: 16, paddingBottom: 40, zIndex: 1 },
  cover: {
    backgroundColor: PASSPORT.cover,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PASSPORT.gold,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    position: 'relative',
  },
  crest: { alignItems: 'center', marginBottom: 8 },
  crestIcon: {
    color: PASSPORT.gold,
    fontSize: 32,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  crestIconLg: { fontSize: 72 },
  crestBrand: {
    color: PASSPORT.gold,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3.5,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  crestBrandLg: { fontSize: 28, letterSpacing: 6, marginTop: 8 },
  coverTitle: {
    color: PASSPORT.gold,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 6,
    textAlign: 'center',
    textTransform: 'uppercase',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  coverTraveler: {
    color: PASSPORT.gold,
    fontSize: 15,
    fontStyle: 'italic',
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 4,
  },
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
    backgroundColor: PASSPORT.stat,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: PASSPORT.goldDim,
  },
  statVal: { color: PASSPORT.gold, fontSize: 18, fontWeight: '900' },
  statLbl: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  stampPage: {
    backgroundColor: PASSPORT.ivory,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(28,20,16,0.12)',
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    color: PASSPORT.ink,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
    marginBottom: 14,
    opacity: 0.65,
  },
  empty: { color: PASSPORT.inkMuted, fontSize: 14, textAlign: 'center', marginBottom: 8 },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, zIndex: 1 },
  emptyTitle: {
    color: PASSPORT.gold,
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 4,
    marginTop: 16,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  emptyMsg: { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center', lineHeight: 22 },
  stamp: {
    alignSelf: 'flex-start',
    maxWidth: '92%',
    borderWidth: 2,
    borderColor: PASSPORT.ink,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 18,
    marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  stampFlag: { fontSize: 22, marginBottom: 4 },
  stampAirport: {
    color: PASSPORT.ink,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  stampDate: {
    color: PASSPORT.inkMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  stampFlight: {
    color: PASSPORT.ink,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 4,
  },
  stampMeta: {
    color: PASSPORT.inkMuted,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 16,
  },
  stampStatus: {
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: 1,
  },
  moreBtn: { alignSelf: 'center', paddingVertical: 8, marginBottom: 4 },
  moreTxt: { color: PASSPORT.ink, fontSize: 13, fontWeight: '700', opacity: 0.7 },
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
    backgroundColor: PASSPORT.cover,
    paddingHorizontal: 80,
    paddingTop: 140,
    paddingBottom: 100,
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 8,
    borderColor: PASSPORT.gold,
  },
  shareTitle: {
    color: PASSPORT.gold,
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: 8,
    marginTop: 24,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  shareTraveler: {
    color: PASSPORT.gold,
    fontSize: 32,
    fontStyle: 'italic',
    fontWeight: '600',
    marginTop: 20,
  },
  shareStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 20,
    marginTop: 48,
    width: '100%',
  },
  shareStatCell: {
    minWidth: 160,
    alignItems: 'center',
    backgroundColor: PASSPORT.stat,
    borderRadius: 16,
    paddingVertical: 20,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: PASSPORT.goldDim,
  },
  shareStatVal: { color: PASSPORT.gold, fontSize: 40, fontWeight: '900' },
  shareStatLbl: { color: '#FFFFFF', fontSize: 18, fontWeight: '700', marginTop: 6, textTransform: 'uppercase' },
  shareStampPage: {
    marginTop: 48,
    width: '100%',
    backgroundColor: PASSPORT.ivory,
    borderRadius: 24,
    padding: 32,
    gap: 16,
  },
  shareStamp: {
    borderWidth: 3,
    borderColor: PASSPORT.ink,
    borderRadius: 999,
    paddingVertical: 16,
    paddingHorizontal: 28,
    alignSelf: 'flex-start',
  },
  shareStampAirport: { color: PASSPORT.ink, fontSize: 28, fontWeight: '900', letterSpacing: 2 },
  shareStampFlight: { color: PASSPORT.inkMuted, fontSize: 22, fontWeight: '700', marginTop: 4 },
  shareTagline: {
    color: PASSPORT.gold,
    fontSize: 34,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 'auto',
    paddingHorizontal: 20,
  },
  shareUrl: { color: 'rgba(255,255,255,0.55)', fontSize: 26, fontWeight: '700', marginTop: 16 },
});
