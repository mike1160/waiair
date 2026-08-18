import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Platform,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Circle, Ellipse, Path } from 'react-native-svg';
import ViewShot, { type ViewShotRef } from 'react-native-view-shot';
import QuickShareRow from './components/QuickShareRow';
import { ShareNetwork, GlobeHemisphereWest } from 'phosphor-react-native';
import AirlineLogo from './AirlineLogo';
import { compactTerminal, gateCodeOnly } from './GateBadge';
import { haptics } from './lib/haptics';
import { buildFlightShareMessage } from './lib/flightQuickShare';
import {
  buildLiveShareMessage,
  copyLiveShareLink,
  createLiveShare,
  shareLiveLink,
} from './lib/liveShare';
import { t } from './lib/i18n';

const BG = '#0A0E1A';
const GOLD = '#F5A623';
const ROUTE = '#94A3B8';
const FOOTER = '#64748B';
const STAR_N = 80;
const DRAW_MS = 1500;
const MAP_PAD = 28;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type NextFlightShareData = {
  flightNumber: string;
  airlineCode: string;
  airline?: string;
  originIata: string;
  destIata: string;
  originCity: string;
  destCity: string;
  originPlace: string;
  destPlace: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  dateIso: string;
  durationMs?: number | null;
  distanceKm?: number | null;
  gate?: string;
  arrTerminal?: string;
  aircraft?: string;
};

function seededStars(n: number) {
  let s = 1103515245;
  const rnd = () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return Array.from({ length: n }, () => ({
    left: rnd(),
    top: rnd(),
    size: 1 + rnd() * 1.5,
  }));
}

const STARS = seededStars(STAR_N);

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

async function openNativeShareSheet(imageUri: string | null, message: string): Promise<void> {
  if (imageUri) {
    const url = toShareFileUrl(imageUri);
    try {
      await Share.share(Platform.OS === 'ios' ? { url, message } : { message, url });
      return;
    } catch (e) {
      console.warn('[Share] failed', e);
      /* fall through to text-only */
    }
  }
  try {
    await Share.share({ message });
  } catch (e) {
    console.warn('[Share] failed', e);
    throw e;
  }
}

function formatShareDate(iso: string): string {
  if (!iso) return '';
  try {
    const m = String(iso).match(/(\d{4})-(\d{2})-(\d{2})/);
    const d = m
      ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
      : new Date(String(iso).includes('T') ? iso : String(iso).replace(' ', 'T'));
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

function formatShareDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatKmNl(km: number): string {
  return `${new Intl.NumberFormat('nl-NL').format(Math.round(km))} km`;
}

function terminalShareLabel(terminal?: string): string {
  const raw = String(terminal || '').trim();
  if (!raw || /^(—|-|–|n\/?a|tba|tbd)$/i.test(raw)) return '';
  const body = raw.replace(/^terminal\s+/i, '').replace(/\s+/g, '');
  const m = body.match(/^t?(\d+)$/i);
  if (m) return `Terminal ${m[1]}`;
  if (/^t\d/i.test(body)) return `Terminal ${body.slice(1)}`;
  return body.toUpperCase();
}

function cleanAircraft(s?: string): string {
  const t = String(s || '').trim();
  if (!t || /^(—|-|–|n\/?a|tba|tbd|unknown|null|undefined)$/i.test(t)) return '';
  return t;
}

function gateShareFace(gate?: string, terminal?: string): { main: string; sub: string } | null {
  const code = gateCodeOnly(gate);
  const term = compactTerminal(terminal);
  if (!code && !term) return null;
  return {
    main: code || '—',
    sub: term ? `Gate · ${term}` : 'Gate',
  };
}

function arrivalLine(terminal: string | undefined, destPlace: string): string {
  const term = terminalShareLabel(terminal);
  if (term && destPlace) return `${term} · ${destPlace}`;
  return term || destPlace;
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
  return {
    lat: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    lon: toDeg(Math.atan2(y, x)),
  };
}

function unwrapLon(lon1: number, lon2: number): [number, number] {
  let a = lon1;
  let b = lon2;
  const d = b - a;
  if (d > 180) b -= 360;
  if (d < -180) b += 360;
  return [a, b];
}

function quadPoint(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

type Pt = { x: number; y: number };

function polylineLength(pts: Pt[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x;
    const dy = pts[i].y - pts[i - 1].y;
    len += Math.hypot(dx, dy);
  }
  return len;
}

function polylinePath(pts: Pt[]): string {
  if (!pts.length) return '';
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
}

function buildRouteGeometry(
  w: number,
  h: number,
  data: NextFlightShareData,
): { pts: Pt[]; dest: Pt; origin: Pt; d: string; len: number } {
  const x0 = MAP_PAD;
  const x1 = Math.max(MAP_PAD + 8, w - MAP_PAD);
  const yMid = h * 0.58;
  const fallbackOrigin = { x: x0, y: yMid };
  const fallbackDest = { x: x1, y: yMid - 18 };
  const cx = (fallbackOrigin.x + fallbackDest.x) / 2;
  const cy = Math.min(h * 0.28, yMid - 48);

  if (
    hasGeo(data.originLat, data.originLon) &&
    hasGeo(data.destLat, data.destLon)
  ) {
    const [lonA, lonB] = unwrapLon(data.originLon!, data.destLon!);
    const samples = 48;
    const geo: { lat: number; lon: number }[] = [];
    for (let i = 0; i <= samples; i++) {
      const p = interpolateGC(
        { lat: data.originLat!, lon: lonA },
        { lat: data.destLat!, lon: lonB },
        i / samples,
      );
      geo.push(p);
    }
    const lats = geo.map(g => g.lat);
    const lons = geo.map(g => g.lon);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const latPad = Math.max(8, (maxLat - minLat) * 0.35 || 12);
    const lonPad = Math.max(12, (maxLon - minLon) * 0.28 || 18);
    const lat0 = minLat - latPad;
    const lat1 = maxLat + latPad;
    const lon0 = minLon - lonPad;
    const lon1 = maxLon + lonPad;
    const innerW = w - MAP_PAD * 2;
    const innerH = h - MAP_PAD * 2;
    const project = (lat: number, lon: number): Pt => ({
      x: MAP_PAD + ((lon - lon0) / Math.max(1e-6, lon1 - lon0)) * innerW,
      y: MAP_PAD + (1 - (lat - lat0) / Math.max(1e-6, lat1 - lat0)) * innerH,
    });
    const pts = geo.map(g => project(g.lat, g.lon));
    return { pts, origin: pts[0], dest: pts[pts.length - 1], d: polylinePath(pts), len: polylineLength(pts) };
  }

  const pts: Pt[] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    pts.push(quadPoint(i / steps, fallbackOrigin.x, fallbackOrigin.y, cx, cy, fallbackDest.x, fallbackDest.y));
  }
  return { pts, origin: pts[0], dest: pts[pts.length - 1], d: polylinePath(pts), len: polylineLength(pts) };
}

function ShareCard({
  data,
  draw,
  planeScale,
  freeze,
}: {
  data: NextFlightShareData;
  draw: Animated.Value;
  planeScale: Animated.Value;
  freeze: boolean;
}) {
  const [mapSize, setMapSize] = useState({ w: 320, h: 240 });
  const geo = useMemo(
    () => buildRouteGeometry(mapSize.w, mapSize.h, data),
    [mapSize.w, mapSize.h, data],
  );
  const dashOffset = freeze
    ? 0
    : draw.interpolate({
        inputRange: [0, 1],
        outputRange: [Math.max(1, geo.len), 0],
      });

  const number = prettyFlightNumber(data.flightNumber);
  const routeCities = [data.originCity, data.destCity].filter(Boolean).join(' → ');
  const dateLabel = formatShareDate(data.dateIso);
  const durationLabel = data.durationMs && data.durationMs > 0 ? formatShareDuration(data.durationMs) : '';
  const distanceLabel = data.distanceKm && data.distanceKm > 0 ? formatKmNl(data.distanceKm) : '';
  const originGate = gateShareFace(data.gate);
  const destArr = arrivalLine(data.arrTerminal, data.destPlace);
  const aircraft = cleanAircraft(data.aircraft);

  type StatItem =
    | { key: string; icon: string; text: string }
    | { key: string; icon: string; gate: { main: string; sub: string } };

  const stats: StatItem[] = [];
  if (dateLabel) stats.push({ key: 'date', icon: '📅', text: dateLabel });
  if (durationLabel) stats.push({ key: 'dur', icon: '⏱', text: durationLabel });
  if (distanceLabel) stats.push({ key: 'dist', icon: '📍', text: distanceLabel });
  if (originGate) stats.push({ key: 'gate', icon: '🛫', gate: originGate });
  if (destArr) stats.push({ key: 'arr', icon: '🛬', text: destArr });
  if (aircraft) stats.push({ key: 'ac', icon: '✈', text: aircraft });

  const mid = Math.ceil(stats.length / 2);
  const row1 = stats.slice(0, mid);
  const row2 = stats.slice(mid);

  return (
    <View style={styles.card} collapsable={false}>
      {STARS.map((star, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: `${star.left * 100}%`,
            top: `${star.top * 100}%`,
            width: star.size,
            height: star.size,
            borderRadius: star.size / 2,
            backgroundColor: '#fff',
            opacity: 0.3,
          }}
        />
      ))}

      <View style={styles.logoWrap}>
        <AirlineLogo iata={data.airlineCode} name={data.airline} size={64} />
      </View>

      <Text style={styles.flightNum} maxFontSizeMultiplier={1.1}>{number}</Text>
      <Text style={styles.routeCities} maxFontSizeMultiplier={1.1}>
        {routeCities || `${data.originIata} → ${data.destIata}`}
      </Text>

      <View
        style={styles.mapWrap}
        onLayout={e => {
          const { width, height } = e.nativeEvent.layout;
          if (width > 0 && height > 0 && (Math.abs(width - mapSize.w) > 1 || Math.abs(height - mapSize.h) > 1)) {
            setMapSize({ w: width, h: height });
          }
        }}
      >
        <Svg width="100%" height="100%" viewBox={`0 0 ${mapSize.w} ${mapSize.h}`}>
          <Ellipse
            cx={mapSize.w / 2}
            cy={mapSize.h / 2}
            rx={mapSize.w * 0.44}
            ry={mapSize.h * 0.4}
            fill="rgba(15,23,42,0.45)"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={1}
          />
          {[0.22, 0.4, 0.58, 0.76].map((y, i) => (
            <Path
              key={`lat-${i}`}
              d={`M ${MAP_PAD} ${y * mapSize.h} H ${mapSize.w - MAP_PAD}`}
              stroke="rgba(255,255,255,0.06)"
              strokeWidth={1}
              strokeDasharray="3 7"
            />
          ))}
          {[0.18, 0.38, 0.58, 0.78].map((x, i) => (
            <Path
              key={`lon-${i}`}
              d={`M ${x * mapSize.w} ${MAP_PAD * 0.6} V ${mapSize.h - MAP_PAD * 0.5}`}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
              strokeDasharray="3 8"
            />
          ))}
          {geo.d ? (
            <>
              <Path
                d={geo.d}
                stroke="rgba(245,166,35,0.22)"
                strokeWidth={6}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {freeze ? (
                <Path
                  d={geo.d}
                  stroke={GOLD}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : (
                <AnimatedPath
                  d={geo.d}
                  stroke={GOLD}
                  strokeWidth={2}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={`${Math.max(1, geo.len)} ${Math.max(1, geo.len)}`}
                  strokeDashoffset={dashOffset as unknown as number}
                />
              )}
              <Circle cx={geo.origin.x} cy={geo.origin.y} r={4} fill={GOLD} />
              <Circle cx={geo.origin.x} cy={geo.origin.y} r={8} fill="none" stroke={GOLD} strokeWidth={1} opacity={0.45} />
              <Circle cx={geo.dest.x} cy={geo.dest.y} r={4} fill={GOLD} />
            </>
          ) : null}
        </Svg>
        <Text style={[styles.iataPin, { left: Math.max(4, geo.origin.x - 18), top: Math.max(2, geo.origin.y - 22) }]}>
          {data.originIata}
        </Text>
        <Text style={[styles.iataPin, { left: Math.max(4, geo.dest.x - 18), top: Math.max(2, geo.dest.y - 22) }]}>
          {data.destIata}
        </Text>
        <Animated.Text
          style={[
            styles.planeEmoji,
            {
              left: geo.dest.x - 11,
              top: geo.dest.y - 14,
              opacity: freeze ? 1 : planeScale,
              transform: [{ scale: freeze ? 1 : planeScale }],
            },
          ]}
        >
          ✈️
        </Animated.Text>
      </View>

      <View style={styles.stats}>
        <View style={styles.statRow}>
          {row1.map(item => (
            <View key={item.key} style={styles.statItem}>
              <Text style={styles.statIcon}>{item.icon}</Text>
              {'gate' in item ? (
                <View style={styles.gateStatBody}>
                  <Text style={styles.gateStatMain} numberOfLines={1}>{item.gate.main}</Text>
                  <Text style={styles.gateStatSub} numberOfLines={1}>{item.gate.sub}</Text>
                </View>
              ) : (
                <Text style={styles.statTxt} numberOfLines={1}>{item.text}</Text>
              )}
            </View>
          ))}
        </View>
        {row2.length > 0 ? (
          <View style={styles.statRow}>
            {row2.map(item => (
              <View key={item.key} style={styles.statItem}>
                <Text style={styles.statIcon}>{item.icon}</Text>
                {'gate' in item ? (
                  <View style={styles.gateStatBody}>
                    <Text style={styles.gateStatMain} numberOfLines={1}>{item.gate.main}</Text>
                    <Text style={styles.gateStatSub} numberOfLines={1}>{item.gate.sub}</Text>
                  </View>
                ) : (
                  <Text style={styles.statTxt} numberOfLines={1}>{item.text}</Text>
                )}
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        <View style={styles.goldLine} />
        <View style={styles.footerRow}>
          <Text style={styles.footerBrand}>✈ WaiAir</Text>
          <Text style={styles.footerUrl}>waiair.app</Text>
        </View>
      </View>
    </View>
  );
}

export default function MyNextFlightShare({
  visible,
  data,
  onClose,
  onStartFlyTogether,
  flyTogetherBusy = false,
}: {
  visible: boolean;
  data: NextFlightShareData | null;
  onClose: () => void;
  onStartFlyTogether?: () => void;
  flyTogetherBusy?: boolean;
}) {
  const { width: winW, height: winH } = useWindowDimensions();
  const shotRef = useRef<ViewShotRef>(null);
  const draw = useRef(new Animated.Value(0)).current;
  const planeScale = useRef(new Animated.Value(0)).current;
  const sharePulse = useRef(new Animated.Value(1)).current;
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [liveBusy, setLiveBusy] = useState(false);
  const [liveCopied, setLiveCopied] = useState(false);
  const [freeze, setFreeze] = useState(false);
  const [senderName, setSenderName] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  const previewW = Math.min(winW - 40, (winH - 300) * (1080 / 1920));
  const previewH = previewW * (1920 / 1080);
  const flightKey = data
    ? `${data.flightNumber}-${data.originIata}-${data.destIata}-${data.dateIso}`
    : '';

  useEffect(() => {
    if (!visible || !data) return;
    setReady(false);
    setFreeze(false);
    setSenderName('');
    setCustomMessage('');
    setLiveCopied(false);
    draw.setValue(0);
    planeScale.setValue(0);
    sharePulse.setValue(1);
    animRef.current?.stop();
    const run = Animated.sequence([
      Animated.timing(draw, {
        toValue: 1,
        duration: DRAW_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.spring(planeScale, {
        toValue: 1,
        friction: 4,
        tension: 160,
        useNativeDriver: false,
      }),
      Animated.sequence([
        Animated.timing(sharePulse, { toValue: 1.07, duration: 240, useNativeDriver: false }),
        Animated.timing(sharePulse, { toValue: 1, duration: 280, useNativeDriver: false }),
      ]),
    ]);
    animRef.current = run;
    run.start(({ finished }) => {
      if (finished) setReady(true);
    });
    return () => {
      run.stop();
    };
  }, [visible, flightKey, data, draw, planeScale, sharePulse]);

  const captureCardImage = async (): Promise<string | null> => {
    setFreeze(true);
    await new Promise<void>(r => {
      requestAnimationFrame(() => requestAnimationFrame(() => r()));
    });
    try {
      const uri = await shotRef.current?.capture?.();
      return uri || null;
    } catch {
      return null;
    }
  };

  const shareLive = async () => {
    if (!data || liveBusy || busy) return;
    setLiveBusy(true);
    haptics.medium();
    try {
      const session = await createLiveShare(data, {
        senderName: senderName.trim() || undefined,
        customMessage: customMessage.trim() || undefined,
      });
      const message = buildLiveShareMessage(data, senderName.trim() || undefined);
      try {
        await shareLiveLink(session.url, message);
      } catch {
        await copyLiveShareLink(session.url);
        setLiveCopied(true);
        haptics.success();
      }
    } catch {
      haptics.error();
    } finally {
      setLiveBusy(false);
    }
  };

  const shareCard = async () => {
    if (!data || busy) return;
    setBusy(true);
    haptics.medium();
    const message = buildFlightShareMessage(data);
    try {
      const uri = ready ? await captureCardImage() : null;
      await openNativeShareSheet(uri, message);
    } catch (e) {
      console.warn('[Share] failed', e);
      try {
        await Share.share({ message });
      } catch (e2) {
        console.warn('[Share] failed', e2);
        haptics.error();
        Alert.alert('Share failed', 'Could not share flight. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.closeBtn}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeTxt}>✕</Text>
        </TouchableOpacity>
        <View style={styles.topBar}>
          <Text style={styles.topTitle}>{t().myNextFlight}</Text>
        </View>

        {data ? (
          <View style={[styles.previewFrame, { width: previewW, height: previewH }]}>
            <ViewShot
              ref={shotRef}
              style={{ width: previewW, height: previewH }}
              options={{
                format: 'png',
                quality: 1,
                result: 'tmpfile',
                width: 1080,
                height: 1920,
              }}
            >
              <ShareCard data={data} draw={draw} planeScale={planeScale} freeze={freeze} />
            </ViewShot>
          </View>
        ) : null}

        {data ? (
          <View style={styles.actions}>
            <View style={styles.customBox}>
              <TextInput
                style={styles.input}
                value={senderName}
                onChangeText={setSenderName}
                placeholder={t().yourNamePlaceholder}
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="words"
                autoCorrect={false}
              />
              <TextInput
                style={styles.input}
                value={customMessage}
                onChangeText={setCustomMessage}
                placeholder={t().shareMessagePlaceholder}
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="sentences"
              />
            </View>

            <TouchableOpacity
              style={[styles.liveBtn, (liveBusy || busy) && styles.shareBtnDim]}
              onPress={shareLive}
              disabled={liveBusy || busy || !data}
              accessibilityRole="button"
              accessibilityLabel={t().shareLiveLink}
            >
              {liveBusy ? (
                <ActivityIndicator color="#0A0E1A" />
              ) : (
                <>
                  <GlobeHemisphereWest size={18} color="#0A0E1A" weight="fill" />
                  <Text style={styles.liveBtnTxt}>{t().shareLiveLink}</Text>
                </>
              )}
            </TouchableOpacity>
            {liveCopied ? (
              <Text style={styles.copiedHint}>{t().liveLinkCopied}</Text>
            ) : null}

            <Text style={styles.shareAsLabel}>{t().shareAsImageCard}</Text>
            <QuickShareRow
              data={data}
              ready={ready}
              busy={busy || liveBusy}
              onBusy={setBusy}
              captureImage={captureCardImage}
              onLiveShare={shareLive}
            />

            {onStartFlyTogether ? (
              <TouchableOpacity
                style={[styles.raceBtn, (flyTogetherBusy || !data || busy) && styles.raceBtnDim]}
                onPress={() => {
                  if (flyTogetherBusy || !data || busy) return;
                  onStartFlyTogether();
                }}
                disabled={!data || busy || flyTogetherBusy}
                accessibilityRole="button"
                accessibilityLabel={t().togetherCreateAction}
              >
                {flyTogetherBusy ? (
                  <ActivityIndicator color="#0A0E1A" />
                ) : (
                  <Text style={styles.raceBtnTxt}>{t().togetherCreateAction}</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <Animated.View style={{ transform: [{ scale: sharePulse }] }}>
              <TouchableOpacity
                style={[styles.shareBtn, busy && styles.shareBtnDim]}
                onPress={shareCard}
                disabled={busy || !data}
                accessibilityRole="button"
                accessibilityLabel={t().share}
              >
                {busy ? (
                  <ActivityIndicator color="#0A0E1A" />
                ) : (
                  <>
                    <ShareNetwork size={18} color="#0A0E1A" weight="bold" />
                    <Text style={styles.shareBtnTxt}>{t().share}</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#05070F',
    paddingTop: Platform.OS === 'web' ? 20 : 54,
    alignItems: 'center',
  },
  topBar: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingRight: 56,
    paddingBottom: 10,
  },
  topTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 20 : 54,
    right: 16,
    zIndex: 30,
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
    marginTop: -1,
  },
  previewFrame: {
    borderRadius: 20,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  card: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 28,
    paddingTop: 36,
    paddingBottom: 28,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: 18,
  },
  flightNum: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  routeCities: {
    color: ROUTE,
    fontSize: 18,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
    marginBottom: 18,
  },
  mapWrap: {
    flex: 1,
    minHeight: 180,
    marginBottom: 18,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  iataPin: {
    position: 'absolute',
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    width: 36,
    textAlign: 'center',
  },
  planeEmoji: {
    position: 'absolute',
    fontSize: 18,
    width: 22,
    textAlign: 'center',
  },
  stats: {
    gap: 10,
    marginBottom: 18,
  },
  statRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexGrow: 1,
    flexBasis: '46%',
    minWidth: 0,
  },
  statIcon: {
    fontSize: 14,
    color: GOLD,
  },
  statTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  gateStatBody: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  gateStatMain: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 18,
  },
  gateStatSub: {
    color: GOLD,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  footer: {
    marginTop: 'auto',
  },
  goldLine: {
    height: 1,
    backgroundColor: GOLD,
    marginBottom: 14,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  footerBrand: {
    color: FOOTER,
    fontSize: 12,
    fontWeight: '600',
  },
  footerUrl: {
    color: FOOTER,
    fontSize: 12,
    fontWeight: '500',
  },
  shareBtn: {
    marginTop: 16,
    marginBottom: 28,
    minWidth: 180,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 16,
  },
  shareBtnDim: {
    opacity: 0.55,
  },
  shareBtnTxt: {
    color: '#0A0E1A',
    fontSize: 16,
    fontWeight: '800',
  },
  raceBtn: {
    marginTop: 16,
    minWidth: 220,
    minHeight: 48,
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.55)',
    backgroundColor: 'rgba(245,166,35,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  raceBtnDim: {
    opacity: 0.55,
  },
  raceBtnTxt: {
    color: GOLD,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    alignItems: 'center',
  },
  customBox: {
    width: '100%',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  liveBtn: {
    marginTop: 8,
    minWidth: 220,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FFD700',
    paddingVertical: 13,
    paddingHorizontal: 24,
    borderRadius: 16,
  },
  liveBtnTxt: {
    color: '#0A0E1A',
    fontSize: 15,
    fontWeight: '800',
  },
  copiedHint: {
    marginTop: 8,
    color: '#FFD700',
    fontSize: 13,
    fontWeight: '700',
  },
  shareAsLabel: {
    marginTop: 16,
    marginBottom: 2,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
