import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import { BookmarkSimple, DownloadSimple, X } from 'phosphor-react-native';
import QuickShareRow from './components/QuickShareRow';
import { haptics } from './lib/haptics';
import {
  formatPassportDuration,
  savePassportEntry,
  type MemoryCardData,
  type PassportEntry,
} from './lib/flightPassport';
import { t } from './lib/i18n';
import { formatAirportClockLabeled, formatArrivesClockLabeled } from './lib/flightTimes';
import { saveImageToPhotos } from './lib/saveImage';
import type { NextFlightShareData } from './MyNextFlightShare';

const BG = '#0D1B2E';
const GOLD = '#FFD700';
const MAP_PAD = 28;

function prettyFlightNumber(n: string): string {
  const s = String(n || '').replace(/\s+/g, '').toUpperCase();
  const m = s.match(/^([A-Z]{1,3})(\d{1,4}[A-Z]?)$/);
  return m ? `${m[1]} ${m[2]}` : (n || '').trim();
}

function toShareFileUrl(uri: string): string {
  if (!uri) return uri;
  if (uri.startsWith('file://') || uri.startsWith('data:') || uri.startsWith('content:')) return uri;
  return `file://${uri}`;
}

function hasGeo(lat?: number, lon?: number): boolean {
  return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

function interpolateGC(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  t: number,
): { lat: number; lon: number } {
  const lat1 = toRad(a.lat);
  const lon1 = toRad(a.lon);
  const lat2 = toRad(b.lat);
  const lon2 = toRad(b.lon);
  const d = 2 * Math.asin(Math.sqrt(
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
  ));
  if (!(d > 1e-6)) return a;
  const A = Math.sin((1 - t) * d) / Math.sin(d);
  const B = Math.sin(t * d) / Math.sin(d);
  const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
  const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
  const z = A * Math.sin(lat1) + B * Math.sin(lat2);
  return { lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))), lon: toDeg(Math.atan2(y, x)) };
}

function unwrapLon(lon1: number, lon2: number): [number, number] {
  let a = lon1;
  let b = lon2;
  const d = b - a;
  if (d > 180) b -= 360;
  if (d < -180) b += 360;
  return [a, b];
}

type Pt = { x: number; y: number };

function polylinePath(pts: Pt[]): string {
  if (!pts.length) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function buildRouteGeometry(w: number, h: number, data: MemoryCardData) {
  const x0 = MAP_PAD;
  const x1 = Math.max(MAP_PAD + 8, w - MAP_PAD);
  const yMid = h * 0.58;
  const fallbackOrigin = { x: x0, y: yMid };
  const fallbackDest = { x: x1, y: yMid - 18 };
  const cx = (fallbackOrigin.x + fallbackDest.x) / 2;
  const cy = Math.min(h * 0.28, yMid - 48);

  if (hasGeo(data.originLat, data.originLon) && hasGeo(data.destLat, data.destLon)) {
    const [lonA, lonB] = unwrapLon(data.originLon!, data.destLon!);
    const geo: { lat: number; lon: number }[] = [];
    for (let i = 0; i <= 48; i++) {
      geo.push(interpolateGC(
        { lat: data.originLat!, lon: lonA },
        { lat: data.destLat!, lon: lonB },
        i / 48,
      ));
    }
    const lats = geo.map(g => g.lat);
    const lons = geo.map(g => g.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const lat0 = minLat - Math.max(8, (maxLat - minLat) * 0.35 || 12);
    const lat1b = maxLat + Math.max(8, (maxLat - minLat) * 0.35 || 12);
    const lon0 = minLon - Math.max(12, (maxLon - minLon) * 0.28 || 18);
    const lon1b = maxLon + Math.max(12, (maxLon - minLon) * 0.28 || 18);
    const innerW = w - MAP_PAD * 2;
    const innerH = h - MAP_PAD * 2;
    const project = (lat: number, lon: number): Pt => ({
      x: MAP_PAD + ((lon - lon0) / Math.max(1e-6, lon1b - lon0)) * innerW,
      y: MAP_PAD + (1 - (lat - lat0) / Math.max(1e-6, lat1b - lat0)) * innerH,
    });
    const pts = geo.map(g => project(g.lat, g.lon));
    return { pts, origin: pts[0], dest: pts[pts.length - 1], d: polylinePath(pts) };
  }

  const pts: Pt[] = [];
  for (let i = 0; i <= 40; i++) {
    const tVal = i / 40;
    const u = 1 - tVal;
    pts.push({
      x: u * u * fallbackOrigin.x + 2 * u * tVal * cx + tVal * tVal * fallbackDest.x,
      y: u * u * fallbackOrigin.y + 2 * u * tVal * cy + tVal * tVal * fallbackDest.y,
    });
  }
  return { pts, origin: pts[0], dest: pts[pts.length - 1], d: polylinePath(pts) };
}

function fmtCardDep(iso: string, iata?: string): string {
  return formatAirportClockLabeled(iso, iata);
}

function fmtCardArr(iso: string, iata?: string): string {
  return formatArrivesClockLabeled(iso, iata);
}

function formatKm(km: number): string {
  return `${new Intl.NumberFormat('en-US').format(Math.round(km))} km`;
}

function formatAlt(ft?: number | null): string {
  if (!ft || !Number.isFinite(ft)) return '—';
  return `${Math.round(ft).toLocaleString('en-US')} ft`;
}

function memoryToShareData(data: MemoryCardData): NextFlightShareData {
  return {
    flightNumber: data.flightNumber,
    airlineCode: data.airlineCode,
    airline: data.airline,
    originIata: data.originIata,
    destIata: data.destIata,
    originCity: data.originCity,
    destCity: data.destCity,
    originPlace: data.originCity,
    destPlace: data.destCity,
    originLat: data.originLat,
    originLon: data.originLon,
    destLat: data.destLat,
    destLon: data.destLon,
    dateIso: data.dateIso,
    durationMs: data.durationMs,
    distanceKm: data.distanceKm,
  };
}

function memoryToPassportEntry(data: MemoryCardData): PassportEntry {
  const landedAt = data.arrTimeIso || data.dateIso || new Date().toISOString();
  const day = landedAt.slice(0, 10);
  const num = data.flightNumber.replace(/\s+/g, '').toUpperCase();
  return {
    id: `${day}:${num}`,
    flightNumber: num,
    originIata: data.originIata,
    destIata: data.destIata,
    originCity: data.originCity,
    destCity: data.destCity,
    airline: data.airline,
    airlineCode: data.airlineCode,
    depTimeIso: data.depTimeIso,
    arrTimeIso: data.arrTimeIso,
    scheduledTime: data.depTimeIso,
    actualTime: data.arrTimeIso,
    delayMin: data.delayMin,
    distanceKm: data.distanceKm || 0,
    durationMs: data.durationMs || 0,
    altitudeFt: data.altitudeFt,
    landedAt,
    welcomeMessage: data.welcomeMessage,
  };
}

const CAPTURE_DELAY_MS = 1500;

function MemoryCardArt({ data, onLayoutReady }: { data: MemoryCardData; onLayoutReady?: () => void }) {
  const [mapSize, setMapSize] = useState({ w: 320, h: 220 });
  const geo = useMemo(() => buildRouteGeometry(mapSize.w, mapSize.h, data), [mapSize.w, mapSize.h, data]);
  const number = prettyFlightNumber(data.flightNumber);
  const route = `${data.originCity} → ${data.destCity}`;
  const onTime = data.delayMin <= 0;
  const welcome = data.welcomeMessage || t().memoryWelcomeDefault(data.destCity);

  return (
    <View
      style={styles.card}
      collapsable={false}
      onLayout={() => onLayoutReady?.()}
    >
      <Text style={styles.cardFlight}>✈️ {number}</Text>
      <Text style={styles.cardRoute}>{route}</Text>
      <View
        style={styles.mapWrap}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0) setMapSize({ w: width, h: height });
        }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${mapSize.w} ${mapSize.h}`}>
          <Ellipse cx={mapSize.w / 2} cy={mapSize.h / 2} rx={mapSize.w * 0.44} ry={mapSize.h * 0.4} fill="rgba(15,23,42,0.45)" stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
          {geo.d ? (
            <>
              <Path d={geo.d} stroke="rgba(255,215,0,0.22)" strokeWidth={6} fill="none" strokeLinecap="round" />
              <Path d={geo.d} stroke={GOLD} strokeWidth={2.5} fill="none" strokeLinecap="round" />
              <Circle cx={geo.origin.x} cy={geo.origin.y} r={4} fill={GOLD} />
              <Circle cx={geo.dest.x} cy={geo.dest.y} r={4} fill="#fff" />
            </>
          ) : null}
        </Svg>
        <Text style={[styles.iataPin, { left: geo.origin.x - 14, top: geo.origin.y - 20 }]}>{data.originIata}</Text>
        <Text style={[styles.iataPin, { left: geo.dest.x - 14, top: geo.dest.y - 20 }]}>{data.destIata}</Text>
      </View>
      <Text style={styles.times}>🛫 {fmtCardDep(data.depTimeIso, data.originIata)} → 🛬 {fmtCardArr(data.arrTimeIso, data.destIata)}</Text>
      <View style={styles.metaGrid}>
        {data.distanceKm && data.distanceKm > 0 ? <Text style={styles.metaItem}>📏 {formatKm(data.distanceKm)}</Text> : null}
        {data.durationMs && data.durationMs > 0 ? <Text style={styles.metaItem}>⏱️ {formatPassportDuration(data.durationMs)}</Text> : null}
        <Text style={styles.metaItem}>🌤️ {formatAlt(data.altitudeFt)}</Text>
        <Text style={styles.metaItem}>{onTime ? `✅ ${t().landed}` : `⏳ +${data.delayMin}m`}</Text>
      </View>
      <Text style={styles.welcome}>"{welcome}"</Text>
      <View style={styles.footer}>
        <View style={styles.goldLine} />
        <Text style={styles.footerBrand}>✈️ WaiAir · waiair.app</Text>
      </View>
    </View>
  );
}

export default function FlightMemoryCard({
  visible,
  data,
  inPassport = false,
  onDismiss,
  onPassportChange,
  onViewPassport,
}: {
  visible: boolean;
  data: MemoryCardData | null;
  inPassport?: boolean;
  onDismiss: () => void;
  onPassportChange?: () => void;
  onViewPassport?: () => void;
}) {
  const { width: winW, height: winH } = useWindowDimensions();
  const shotRef = useRef<ViewShotRef>(null);
  const layoutReadyRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [passportAdded, setPassportAdded] = useState(inPassport);

  const previewW = Math.min(winW - 40, (winH - 320) * (1080 / 1920));
  const previewH = previewW * (1920 / 1080);

  useEffect(() => {
    if (!visible || !data) return;
    layoutReadyRef.current = false;
    setReady(false);
    setSaved(false);
    setPassportAdded(inPassport);
  }, [visible, data, inPassport]);

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

  const captureCardImage = async (): Promise<string | null> => {
    await waitForCaptureReady();
    if (!shotRef.current?.capture) {
      console.warn('[Share] captureCardImage: shotRef not attached');
      return null;
    }
    try {
      const uri = (await shotRef.current.capture()) || null;
      console.warn('[Share] captureCardImage result:', uri);
      return uri;
    } catch (e) {
      console.warn('[Share] captureCardImage result:', null, e);
      return null;
    }
  };

  const savePhoto = async () => {
    if (!data || busy) return;
    setBusy(true);
    haptics.medium();
    try {
      const uri = await captureCardImage();
      if (!uri) { haptics.error(); return; }
      const ok = await saveImageToPhotos(uri);
      if (ok) { setSaved(true); haptics.success(); }
      else {
        const url = toShareFileUrl(uri);
        await Share.share(Platform.OS === 'ios' ? { url, message: t().memoryCardTitle } : { message: t().memoryCardTitle, url });
      }
    } catch {
      haptics.error();
    } finally {
      setBusy(false);
    }
  };

  const addPassport = async () => {
    if (!data) return;
    if (passportAdded) { onViewPassport?.(); return; }
    haptics.light();
    const added = await savePassportEntry(memoryToPassportEntry(data));
    setPassportAdded(true);
    if (added) haptics.success();
    onPassportChange?.();
  };

  if (!data) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
      <View style={styles.screen}>
        <TouchableOpacity style={styles.close} onPress={onDismiss} accessibilityRole="button" accessibilityLabel={t().dismiss}>
          <X size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>{t().memoryCardTitle}</Text>
        <Text style={styles.sub}>{t().memoryCardSubtitle}</Text>
        <View style={[styles.previewWrap, { width: previewW, height: previewH }]}>
          <View
            style={{ width: previewW, height: previewH, overflow: 'hidden' }}
            pointerEvents="none"
          >
            <View style={{ width: 1080, height: 1920, transform: [{ scale: previewW / 1080 }] }}>
              <MemoryCardArt data={data} onLayoutReady={onCaptureLayout} />
            </View>
          </View>
          <View collapsable={false} style={styles.captureShot}>
            <ViewShot
              ref={shotRef}
              style={{ width: 1080, height: 1920, backgroundColor: 'transparent' }}
              options={{ format: 'png', quality: 1, result: 'tmpfile', width: 1080, height: 1920 }}
              onLayout={onCaptureLayout}
            >
              <MemoryCardArt data={data} onLayoutReady={onCaptureLayout} />
            </ViewShot>
          </View>
          {!ready ? <View style={styles.previewLoader}><ActivityIndicator color={GOLD} /></View> : null}
        </View>
        <View style={styles.actions}>
          <QuickShareRow data={memoryToShareData(data)} ready={ready} busy={busy} onBusy={setBusy} captureImage={captureCardImage} showLabels />
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={savePhoto} disabled={busy}>
              <DownloadSimple size={18} color="#fff" />
              <Text style={styles.secondaryBtnTxt}>{saved ? t().savedToPhotos : t().saveToPhotos}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={addPassport}>
              <BookmarkSimple size={18} color={passportAdded ? GOLD : '#fff'} weight={passportAdded ? 'fill' : 'regular'} />
              <Text style={[styles.secondaryBtnTxt, passportAdded && { color: GOLD }]}>{passportAdded ? t().inPassport : t().addToPassport}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss}>
            <Text style={styles.dismissTxt}>{t().dismiss}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'rgba(5,7,13,0.96)', paddingTop: Platform.OS === 'ios' ? 56 : 24, paddingHorizontal: 16, alignItems: 'center' },
  close: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 22, right: 16, zIndex: 2, padding: 8 },
  title: { color: GOLD, fontSize: 13, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  sub: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '600', marginTop: 4, marginBottom: 14, textAlign: 'center' },
  previewWrap: { borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,215,0,0.25)' },
  captureShot: { position: 'absolute', left: -10000, top: 0, width: 1080, height: 1920, opacity: 0.01 },
  previewLoader: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(10,14,26,0.5)' },
  actions: { width: '100%', marginTop: 16 },
  btnRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, marginTop: 12 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14, paddingVertical: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  secondaryBtnTxt: { color: '#fff', fontSize: 13, fontWeight: '700' },
  dismissBtn: { alignSelf: 'center', marginTop: 14, paddingVertical: 8, paddingHorizontal: 16 },
  dismissTxt: { color: 'rgba(255,255,255,0.45)', fontSize: 14, fontWeight: '600' },
  card: { width: 1080, height: 1920, backgroundColor: BG, paddingHorizontal: 72, paddingTop: 120, paddingBottom: 80 },
  cardFlight: { color: GOLD, fontSize: 56, fontWeight: '800', textAlign: 'center', letterSpacing: 1 },
  cardRoute: { color: '#F8FAFC', fontSize: 42, fontWeight: '700', textAlign: 'center', marginTop: 16, marginBottom: 36 },
  mapWrap: { height: 520, borderRadius: 24, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,215,0,0.18)', marginBottom: 36 },
  iataPin: { position: 'absolute', color: GOLD, fontSize: 22, fontWeight: '800' },
  times: { color: '#F8FAFC', fontSize: 38, fontWeight: '700', textAlign: 'center', marginBottom: 28 },
  metaGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginBottom: 36 },
  metaItem: { color: 'rgba(248,250,252,0.88)', fontSize: 30, fontWeight: '600', minWidth: '42%', textAlign: 'center' },
  welcome: { color: GOLD, fontSize: 36, fontWeight: '700', textAlign: 'center', fontStyle: 'italic', marginTop: 12, marginBottom: 48, paddingHorizontal: 20 },
  footer: { marginTop: 'auto', alignItems: 'center' },
  goldLine: { width: 120, height: 2, backgroundColor: GOLD, opacity: 0.5, marginBottom: 20 },
  footerBrand: { color: 'rgba(255,255,255,0.55)', fontSize: 28, fontWeight: '700', letterSpacing: 0.5 },
});
