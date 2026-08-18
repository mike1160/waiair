import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { X } from 'phosphor-react-native';
import type { NextFlightShareData } from './MyNextFlightShare';
import QuickShareRow from './components/QuickShareRow';
import {
  computePassportStats,
  formatPassportHours,
  formatPassportKm,
  loadPassportEntries,
  type PassportEntry,
} from './lib/flightPassport';
import { t } from './lib/i18n';

const BG = '#0A0E1A';
const GOLD = '#FFD700';

function PassportShareArt({
  stats,
  entries,
}: {
  stats: ReturnType<typeof computePassportStats>;
  entries: PassportEntry[];
}) {
  const recent = entries.slice(0, 3);
  return (
    <View style={styles.card} collapsable={false}>
      <Text style={styles.logo}>✈️ WaiAir</Text>
      <Text style={styles.title}>{t().flightPassportTitle}</Text>
      <Text style={styles.traveler}>{t().passportTraveler}</Text>
      <Text style={styles.flights}>{t().passportStatsFlights(stats.totalFlights)}</Text>
      <View style={styles.statsBlock}>
        <Text style={styles.statLine}>🌍 {t().passportStatsFlights(stats.totalFlights)}</Text>
        <Text style={styles.statLine}>📏 {t().passportStatsKm(formatPassportKm(stats.totalKm))}</Text>
        <Text style={styles.statLine}>⏱️ {t().passportStatsAirTime(formatPassportHours(stats.totalDurationMs))}</Text>
        <Text style={styles.statLine}>🗺️ {t().passportStatsCountries(stats.countries.length)}</Text>
        <Text style={styles.statLine}>✈️ {t().passportStatsAirlines(stats.airlines.length)}</Text>
      </View>
      {recent.map(e => (
        <Text key={e.id} style={styles.recentLine}>{e.originIata} → {e.destIata} · {e.flightNumber}</Text>
      ))}
      <Text style={styles.tagline}>{t().passportShareTagline(formatPassportKm(stats.totalKm))}</Text>
      <Text style={styles.url}>waiair.app</Text>
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
  const { width: winW, height: winH } = useWindowDimensions();
  const shotRef = useRef<ViewShotRef>(null);
  const [entries, setEntries] = useState<PassportEntry[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const previewW = Math.min(winW - 40, (winH - 280) * (1080 / 1920));
  const previewH = previewW * (1920 / 1080);
  const stats = useMemo(() => computePassportStats(entries), [entries]);
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

  useEffect(() => {
    if (!visible) return;
    setReady(false);
    loadPassportEntries().then(setEntries);
    const tmr = setTimeout(() => setReady(true), 400);
    return () => clearTimeout(tmr);
  }, [visible, refreshKey]);

  const captureImage = async (): Promise<string | null> => {
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    try {
      return (await shotRef.current?.capture?.()) || null;
    } catch {
      return null;
    }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.screen}>
        <TouchableOpacity style={styles.close} onPress={onClose} accessibilityLabel={t().dismiss}>
          <X size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.head}>{t().sharePassport}</Text>
        <View style={[styles.previewWrap, { width: previewW, height: previewH }]}>
          <ViewShot ref={shotRef} style={{ width: previewW, height: previewH }} options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 }}>
            <View style={{ transform: [{ scale: previewW / 1080 }], width: 1080, height: 1920 }}>
              <PassportShareArt stats={stats} entries={entries} />
            </View>
          </ViewShot>
          {!ready ? <View style={styles.loader}><ActivityIndicator color={GOLD} /></View> : null}
        </View>
        <QuickShareRow
          data={shareData}
          ready={ready}
          busy={busy}
          onBusy={setBusy}
          captureImage={captureImage}
          shareMessage={shareMessage}
          showLabels
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'rgba(5,7,13,0.96)', paddingTop: Platform.OS === 'ios' ? 56 : 24, alignItems: 'center' },
  close: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 22, right: 16, zIndex: 2, padding: 8 },
  head: { color: GOLD, fontSize: 14, fontWeight: '800', letterSpacing: 1, marginBottom: 14 },
  previewWrap: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)' },
  loader: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,14,26,0.5)' },
  card: { width: 1080, height: 1920, backgroundColor: BG, paddingHorizontal: 80, paddingTop: 140, paddingBottom: 100, alignItems: 'center' },
  logo: { color: GOLD, fontSize: 48, fontWeight: '900' },
  title: { color: GOLD, fontSize: 52, fontWeight: '900', letterSpacing: 4, marginTop: 24, textAlign: 'center' },
  traveler: { color: 'rgba(255,255,255,0.55)', fontSize: 32, fontWeight: '600', marginTop: 20 },
  flights: { color: '#F8FAFC', fontSize: 36, fontWeight: '700', marginTop: 8 },
  statsBlock: { marginTop: 48, gap: 18, width: '100%' },
  statLine: { color: '#F8FAFC', fontSize: 34, fontWeight: '700', textAlign: 'center' },
  recentLine: { color: 'rgba(255,255,255,0.45)', fontSize: 26, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  tagline: { color: GOLD, fontSize: 38, fontWeight: '800', textAlign: 'center', marginTop: 'auto', paddingHorizontal: 20 },
  url: { color: 'rgba(255,255,255,0.45)', fontSize: 28, fontWeight: '700', marginTop: 16 },
});
