import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Circle, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { formatInTimeZone } from 'date-fns-tz';
import AirlineLogo, { AIRLINE_LOGO_SIZE, airlineCodeFromFlight } from './AirlineLogo';
import { GOLD, NAVY, WalkOnceStrip } from './AnimatedBookingCard';
import BookFlightScreen from './BookFlightScreen';
import { lookupAircraft, seatGuruUrl, wikipediaSummaryUrl } from './constants/aircraftInfo';
import { airportMapUrl } from './constants/airportMaps';
import { timezoneForIata } from './lib/airportTz';
import AirQualityScreen from './AirQualityScreen';
import { TripExtrasAddBanner } from './TripExtrasCards';
import type { TripExtras } from './lib/tripExtras';
import {
  aqiColor,
  arrivalTzDeltaHours,
  fetchAqiSnapshot,
  fetchWeatherSnapshot,
  type AqiSnapshot,
  type WeatherSnapshot,
} from './lib/destinationServices';
import { EMPTY_CLOCK, formatAirportClock } from './lib/flightTimes';
import { formatDurationMs } from './boardingCountdown';
import { getActiveTogetherCode, listTogetherParticipants, loadCachedGroup, type TogetherParticipant } from './lib/flyTogether';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';
import { getPrefs } from './lib/prefs';
import { openGrabToAirport, TRANSPORT_INFO } from './lib/transportBooking';
import { klookQuickActionUrl, openTransitQuickAction } from './lib/destinationQuickLinks';
import { openAffiliateUrl } from './lib/affiliateConfig';
import {
  barLevelForSeverity,
  flightDateKey,
  loadTurbulenceForecast,
  severityAtRouteFrac,
  type TurbulenceForecast,
} from './lib/turbulence';
import {
  arcLatLngSamples,
  bearingDeg,
  buildRouteMapHTML,
  groupOverlay,
  interpolateGC,
  routeLineColor,
  routeT,
  toPt,
  wxEmoji,
} from './lib/routeMapHtml';

const MAP_H = 320;
const HERO_BG = '#0D1B2E';
const CARD_BG = '#0B1220';
const GRAY = '#94A3B8';
const ORANGE = '#FF9800';
const GREEN = '#22c55e';
const RED = '#EF4444';
const AMBER = '#F59E0B';

function quadPoint(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

const ROUTE_LINE = 'rgba(255,255,255,0.38)';
const DEP_DOT = '#E5E7EB';

function clock(iso?: string, iata?: string, country?: string): string {
  if (!iso) return '';
  const v = formatAirportClock(iso, iata, getPrefs().timeFormat === '12h', country);
  return v === EMPTY_CLOCK ? '' : v;
}

function termGate(term?: string, gate?: string): string {
  const t1 = String(term || '').replace(/^terminal\s+/i, '').trim();
  const g = String(gate || '').replace(/^gate\s+/i, '').trim();
  const left = t1 ? (/^\d/.test(t1) ? `T${t1}` : t1) : '';
  const right = g ? `Gate ${g}` : '';
  return [left, right].filter(Boolean).join(' · ');
}

function gateCodeOf(raw?: string): string {
  return String(raw || '').replace(/^gate\s+/i, '').trim();
}

function isUnassignedGate(raw?: string): boolean {
  const g = gateCodeOf(raw).toUpperCase();
  if (!g) return true;
  return g === 'ARR' || g === 'DEP' || g === 'TBA' || g === 'TBD' || g === 'UNKNOWN' || g === 'N/A' || g === '-';
}

function MiniBar({ level }: { level: number }) {
  const filled = Math.max(0, Math.min(10, Math.round(level)));
  return (
    <View style={st.barRow}>
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={[st.barSlot, { backgroundColor: i < filled ? AMBER : 'rgba(148,163,184,0.25)' }]} />
      ))}
    </View>
  );
}

function initialsOf(name: string): string {
  const p = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (p.length >= 2) return (p[0][0] + p[1][0]).toUpperCase();
  return (p[0] || '?').slice(0, 2).toUpperCase();
}

function QuickActionTile({
  label,
  icon,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      style={[st.pill, st.actionTile, disabled && st.actionTileDisabled]}
      onPress={onPress ? () => { haptics.light(); onPress(); } : undefined}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
    >
      <View style={st.actionTileInner}>
        {icon ? (
          <MaterialCommunityIcons name={icon} size={14} color="#8892A4" style={st.actionTileIcon} />
        ) : null}
        <Text style={st.pillTxt} numberOfLines={1}>{label}</Text>
      </View>
    </Pressable>
  );
}

function HeroChip({
  icon, label, onPress, hot, accessibilityLabel,
}: {
  icon?: string;
  label: string;
  onPress?: () => void;
  hot?: boolean;
  accessibilityLabel?: string;
}) {
  const inner = (
    <>
      {icon ? <Text style={st.pillIcon}>{icon}</Text> : null}
      <Text style={[st.pillTxt, hot && { color: RED }]} numberOfLines={1}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        style={[st.pill, hot && st.pillHot]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || label}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={st.pill}>{inner}</View>;
}

function AircraftSheet({
  visible, onClose, onDismiss, model, airline, origin, destination, flightNumber, date, gate, onSearchFlights,
}: {
  visible: boolean;
  onClose: () => void;
  onDismiss?: () => void;
  model: string;
  airline?: string;
  origin?: string;
  destination?: string;
  flightNumber?: string;
  date?: string;
  gate?: string;
  onSearchFlights?: () => void;
}) {
  const specs = lookupAircraft(model);
  const name = specs?.name || model;
  const copy = t();
  const [thumb, setThumb] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const title = specs?.wikiTitle || model;
    if (!title) return;
    let cancelled = false;
    setBusy(true);
    setThumb(null);
    fetch(wikipediaSummaryUrl(title), {
      headers: {
        Accept: 'application/json',
        'Api-User-Agent': 'WaiAir/1.2 (https://waiair.app; support@waiair.app)',
      },
    })
      .then(r => (r.ok ? r.json() : null))
      .then((json: { thumbnail?: { source?: string } } | null) => {
        if (cancelled) return;
        const src = json?.thumbnail?.source;
        setThumb(typeof src === 'string' && src ? src : null);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [visible, model, specs?.wikiTitle]);

  const seatUrl = seatGuruUrl(airline, specs?.seatGuruSlug);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      onDismiss={onDismiss}
    >
      <ScrollView style={{ flex: 1, backgroundColor: '#0d1117' }} contentContainerStyle={{ padding: 24 }}>
        <TouchableOpacity onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.close}>
          <Text style={{ color: 'white', fontSize: 16 }}>✕ Close</Text>
        </TouchableOpacity>
        <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginTop: 16 }}>{name}</Text>
        {specs?.iata ? (
          <Text style={{ color: '#888', marginTop: 8 }}>{specs.iata} · Aircraft information</Text>
        ) : (
          <Text style={{ color: '#888', marginTop: 8 }}>Aircraft information</Text>
        )}
        {thumb ? (
          <Image source={{ uri: thumb }} style={st.sheetHero} resizeMode="cover" />
        ) : (
          <View style={st.sheetHeroPh}>
            {busy ? <ActivityIndicator color="#94A3B8" /> : null}
          </View>
        )}
        {specs ? (
          <View style={st.specRow}>
            <View style={st.spec}>
              <Text style={st.specK}>{copy.aircraftPassengers}</Text>
              <Text style={st.specV}>{specs.passengers}</Text>
            </View>
            <View style={st.spec}>
              <Text style={st.specK}>{copy.aircraftRange}</Text>
              <Text style={st.specV}>{specs.range}</Text>
            </View>
            <View style={st.spec}>
              <Text style={st.specK}>{copy.aircraftEngines}</Text>
              <Text style={st.specV} numberOfLines={2}>{specs.engines}</Text>
            </View>
          </View>
        ) : null}
        <TouchableOpacity
          style={st.seatBtn}
          onPress={() => { void Linking.openURL(seatUrl); }}
          accessibilityRole="link"
          accessibilityLabel={copy.viewSeatMap}
        >
          <Text style={st.seatBtnTxt}>{copy.viewSeatMap}</Text>
        </TouchableOpacity>
        <View style={st.walkBox}>
          {visible ? (
            <WalkOnceStrip
              origin={origin}
              destination={destination}
              flightNumber={flightNumber}
              date={date}
              gate={gate}
              active={visible}
            />
          ) : null}
        </View>
        <Pressable
          onPress={() => {
            haptics.light();
            onSearchFlights?.();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={copy.claimYourSeatA11y}
          style={st.searchCta}
        >
          <Text style={st.searchCtaTxt}>{copy.claimYourSeat}</Text>
        </Pressable>
      </ScrollView>
    </Modal>
  );
}

type HeroProps = {
  origin: string;
  destination: string;
  originCity?: string;
  destCity?: string;
  progress?: number;
  duration?: string;
  status?: string;
  animated?: boolean;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  liveLat?: number;
  liveLng?: number;
  headingDeg?: number;
  flightId?: string;
  departureIso?: string;
  durationMin?: number;
  airlineCode?: string;
  airline?: string;
  flightNumber?: string;
  actualTime?: string;
  clockIata?: string;
  clockCountry?: string;
  aircraft?: string;
  depTerminal?: string;
  arrTerminal?: string;
  gate?: string;
  previousGate?: string;
  baggage?: string;
  delayMin?: number;
  originCountry?: string;
  destCountry?: string;
  scheduledDepIso?: string;
  actualDepIso?: string;
  scheduledArrIso?: string;
  actualArrIso?: string;
  boardType?: 'arrival' | 'departure';
  onSearchFlights?: () => void;
  onLoungePress?: () => void;
  onVisaPress?: () => void;
  onCurrencyPress?: () => void;
  onWakePress?: () => void;
  tracked?: boolean;
  isPro?: boolean;
  flightKey?: string;
  tripExtras?: TripExtras | null;
  onOpenTripExtras?: () => void;
};

export default function RouteHero({
  origin, destination, originCity, destCity,
  progress = 0, duration, status, originLat, originLon, destLat, destLon,
  liveLat, liveLng, headingDeg, flightId, departureIso, durationMin,
  airlineCode, airline, flightNumber, actualTime, clockIata, clockCountry,
  aircraft, depTerminal, arrTerminal, gate, previousGate, baggage, delayMin = 0,
  originCountry, destCountry, scheduledDepIso, actualDepIso, scheduledArrIso, actualArrIso,
  boardType, onLoungePress, onVisaPress, onCurrencyPress, onWakePress, tracked, isPro,
  flightKey, tripExtras, onOpenTripExtras,
}: HeroProps) {
  const originPt = toPt(originLat, originLon);
  const destPt = toPt(destLat, destLon);
  const livePt = toPt(liveLat, liveLng);
  const oCode = (origin || '').toUpperCase();
  const dCode = (destination || '').toUpperCase();
  const canMap = Platform.OS !== 'web' && !!originPt && !!destPt && oCode !== dCode
    && !(originPt.latitude === destPt.latitude && originPt.longitude === destPt.longitude);

  const [forecast, setForecast] = useState<TurbulenceForecast | null>(null);
  const [originWx, setOriginWx] = useState<WeatherSnapshot | null>(null);
  const [destWx, setDestWx] = useState<WeatherSnapshot | null>(null);
  const [aqi, setAqi] = useState<AqiSnapshot | null>(null);
  const [aqiOpen, setAqiOpen] = useState(false);
  const [aircraftModalVisible, setAircraftModalVisible] = useState(false);
  const [bookOpen, setBookOpen] = useState(false);
  const pendingBook = useRef(false);
  const [mates, setMates] = useState<TogetherParticipant[]>([]);

  useEffect(() => {
    const id = String(flightId || '').trim();
    if (!id || !oCode || !dCode || oCode === dCode) { setForecast(null); return; }
    let cancelled = false;
    loadTurbulenceForecast({
      flightId: id, origin: oCode, destination: dCode,
      date: flightDateKey(departureIso), departureIso, durationMin,
      allowNetwork: status !== 'en-route' && status !== 'landed',
    }).then(data => { if (!cancelled) setForecast(data); });
    return () => { cancelled = true; };
  }, [flightId, oCode, dCode, departureIso, durationMin, status]);

  useEffect(() => {
    let cancelled = false;
    if (originPt) {
      fetchWeatherSnapshot(originPt.latitude, originPt.longitude, originCity || oCode, departureIso, oCode, originCountry)
        .then(s => { if (!cancelled) setOriginWx(s); });
    }
    if (destPt) {
      fetchWeatherSnapshot(destPt.latitude, destPt.longitude, destCity || dCode, scheduledArrIso || actualArrIso, dCode, destCountry)
        .then(s => { if (!cancelled) setDestWx(s); });
      fetchAqiSnapshot(destPt.latitude, destPt.longitude)
        .then(s => { if (!cancelled) setAqi(s); });
    }
    return () => { cancelled = true; };
  }, [originPt?.latitude, originPt?.longitude, destPt?.latitude, destPt?.longitude, oCode, dCode, originCity, destCity, departureIso, scheduledArrIso, actualArrIso, originCountry, destCountry]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const code = await getActiveTogetherCode();
      if (!code || cancelled) return;
      const g = await loadCachedGroup(code);
      if (cancelled || !g) return;
      const num = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
      const rows = listTogetherParticipants(g.participants).filter(p => {
        const fn = String(p.flightNumber || '').replace(/\s+/g, '').toUpperCase();
        return fn === num || p.destIata === dCode || p.originIata === dCode;
      });
      setMates(rows);
    })();
    return () => { cancelled = true; };
  }, [flightNumber, dCode]);

  const copy = t();
  const phase = String(status || '').toLowerCase();
  const tFrac = routeT(progress);
  const arcPlane = originPt && destPt ? interpolateGC(originPt, destPt, tFrac) : null;
  const enRoute = phase === 'en-route';
  const planeCoord = enRoute && livePt ? livePt : arcPlane;
  const heading = enRoute && livePt && headingDeg != null && Number.isFinite(headingDeg)
    ? headingDeg
    : (planeCoord && originPt && destPt
      ? bearingDeg(planeCoord, interpolateGC(originPt, destPt, Math.min(0.999, tFrac + 0.02)))
      : 0);

  const overlaySegs = useMemo(() => {
    if (!forecast || !originPt || !destPt) return [];
    const arc = arcLatLngSamples(originPt.latitude, originPt.longitude, destPt.latitude, destPt.longitude);
    const n = arc.length - 1;
    return groupOverlay(arc.map((ll, i) => ({
      severity: severityAtRouteFrac(forecast, i / n),
      pt: ll,
    }))).map(g => ({ color: g.color, latlngs: g.pts }));
  }, [forecast, originPt?.latitude, originPt?.longitude, destPt?.latitude, destPt?.longitude]);

  const windDeg = destWx?.windDeg ?? originWx?.windDeg;
  const html = useMemo(() => {
    if (!originPt || !destPt) return '';
    return buildRouteMapHTML(
      originPt, destPt, oCode, dCode, planeCoord, heading, routeLineColor(status), overlaySegs,
      originWx ? { emoji: wxEmoji(originWx.icon), temp: originWx.temp } : null,
      destWx ? { emoji: wxEmoji(destWx.icon), temp: destWx.temp } : null,
      windDeg,
    );
  }, [
    originPt?.latitude, originPt?.longitude, destPt?.latitude, destPt?.longitude,
    oCode, dCode, planeCoord?.latitude, planeCoord?.longitude, heading, status, overlaySegs,
    originWx, destWx, windDeg,
  ]);

  const code = String(airlineCode || '').replace(/[^A-Za-z0-9]/g, '') || airlineCodeFromFlight(flightNumber);
  const num = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  const from = String(originCity || '').trim();
  const to = String(destCity || '').trim();
  const cities = from && to && from.toUpperCase() !== to.toUpperCase() ? copy.cityToCity(from, to) : (from || to);

  const dateIso = scheduledDepIso || departureIso;
  let dateLbl = '';
  if (dateIso) {
    const tz = timezoneForIata(clockIata || oCode, clockCountry || originCountry);
    const ms = isoInAirportTzToUtcMs(dateIso, clockIata || oCode, clockCountry || originCountry)
      ?? Date.parse(String(dateIso).replace(' ', 'T'));
    if (Number.isFinite(ms)) {
      try {
        const day = formatInTimeZone(new Date(ms), tz, 'yyyy-MM-dd');
        const nowDay = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd');
        dateLbl = day === nowDay ? copy.today : formatInTimeZone(new Date(ms), tz, 'd MMM');
      } catch {
        dateLbl = copy.today;
      }
    }
  }

  const arrivedClock = clock(actualArrIso || actualTime, dCode, destCountry);
  let statusLabel: string = copy.scheduled;
  let statusColor = GRAY;
  if (phase === 'landed' || phase === 'arrived') {
    statusLabel = arrivedClock ? `${copy.arrived} · ${arrivedClock}` : copy.arrived;
    statusColor = GREEN;
  } else if (phase === 'delayed' || (delayMin > 0 && phase !== 'en-route' && phase !== 'landed')) {
    statusLabel = delayMin > 0 ? copy.delayedMin(delayMin) : copy.delayed;
    statusColor = RED;
  } else if (phase === 'en-route') {
    statusLabel = delayMin > 0
      ? `${copy.inFlight} · ${copy.delayedMin(delayMin)}`
      : `${copy.inFlight} · ${copy.onTimeLower}`;
    statusColor = ORANGE;
  } else if (phase === 'cancelled') {
    statusLabel = copy.cancelled;
    statusColor = RED;
  }

  const gateChanged = !!(previousGate && gate && String(previousGate).replace(/^gate\s+/i, '').toUpperCase()
    !== String(gate).replace(/^gate\s+/i, '').toUpperCase());
  const tg = termGate(boardType === 'arrival' ? arrTerminal : depTerminal, gate);
  const tzH = arrivalTzDeltaHours(oCode, dCode, originCountry, destCountry);
  const belt = String(baggage || '').trim();
  const landed = phase === 'landed' || phase === 'arrived';

  const arrMs = isoInAirportTzToUtcMs(scheduledArrIso || actualArrIso, dCode, destCountry);
  const minsToArr = arrMs != null ? Math.round((arrMs - Date.now()) / 60000) : null;
  const showPickup = landed || (minsToArr != null && minsToArr <= 30 && minsToArr >= -90);
  const transport = TRANSPORT_INFO[dCode];
  const grab = transport?.options.find(o => o.kind === 'grab');
  const mapIata = landed || boardType === 'arrival' ? dCode : oCode;
  const showWake = !!tracked && !!isPro && !!onWakePress;

  const depClkS = clock(scheduledDepIso || departureIso, oCode, originCountry);
  const depClkA = clock(actualDepIso, oCode, originCountry);
  const arrClkS = clock(scheduledArrIso, dCode, destCountry);
  const arrClkA = clock(actualArrIso, dCode, destCountry);
  const pct = Math.max(0, Math.min(1, progress));
  const durLbl = duration || (durationMin && durationMin > 0 ? formatDurationMs(durationMin * 60000) : '');

  const w = Dimensions.get('window').width;
  const x0 = 36;
  const x1 = w - 36;
  const y = 96;
  const cx = w / 2;
  const cy = y - 36;
  const plane = originPt && destPt ? null : quadPoint(tFrac, x0, y, cx, cy, x1, y);

  return (
    <View style={st.root}>
      <View style={st.mapWrap} pointerEvents="none">
        {canMap ? (
          <WebView
            originWhitelist={['*']}
            source={{ html, headers: { 'Accept-Language': 'en-US,en;q=1.0' } }}
            style={st.map}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            setSupportMultipleWindows={false}
            mixedContentMode="always"
            androidLayerType="hardware"
            injectedJavaScript="setTimeout(function(){try{window.__rhMap&&window.__rhMap.invalidateSize();}catch(e){}},180);true;"
          />
        ) : (
          <Svg width={w} height={MAP_H} style={StyleSheet.absoluteFill}>
            <Rect width={w} height={MAP_H} fill="#07090f" />
            <Path
              d={`M ${x0} ${y} Q ${cx} ${cy} ${x1} ${y}`}
              stroke={ROUTE_LINE}
              strokeWidth={1.7}
              strokeDasharray="5 7"
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={x0} cy={y} r={4.5} fill={DEP_DOT} />
            <Circle cx={x1} cy={y} r={4.5} fill={routeLineColor(status)} />
            {plane ? (
              <G transform={`translate(${plane.x} ${plane.y}) rotate(${
                Math.atan2(
                  2 * (1 - tFrac) * (cy - y) + 2 * tFrac * (y - cy),
                  2 * (1 - tFrac) * (cx - x0) + 2 * tFrac * (x1 - cx),
                ) * 180 / Math.PI + 90
              })`}>
                <Path
                  d="M0 -9.8 L0.55 -8.7 L1.25 -1.4 L8.8 1.05 L8.8 1.6 L1.25 2.3 L0.7 8.2 L2.4 9.35 L2.4 9.75 L0 9.1 L-2.4 9.75 L-2.4 9.35 L-0.7 8.2 L-1.25 2.3 L-8.8 1.6 L-8.8 1.05 L-1.25 -1.4 L-0.55 -8.7 Z"
                  fill="#F1F5F9"
                />
              </G>
            ) : null}
          </Svg>
        )}
        <Svg pointerEvents="none" style={st.fade} width={w} height={110}>
          <Defs>
            <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={HERO_BG} stopOpacity="0" />
              <Stop offset="1" stopColor={HERO_BG} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect width={w} height={110} fill="url(#heroFade)" />
        </Svg>
        <View style={st.overlay}>
          <AirlineLogo iata={code} name={airline} size={AIRLINE_LOGO_SIZE} preferAirhex />
          <View style={st.overlayText}>
            <Text style={st.flightLine} numberOfLines={1}>
              {num}{dateLbl ? `  ·  ${dateLbl}` : ''}
            </Text>
            {cities ? <Text style={st.cities} numberOfLines={1}>{cities}</Text> : null}
            <Text style={[st.status, { color: statusColor }]} numberOfLines={1}>{statusLabel}</Text>
          </View>
        </View>
      </View>

      <View style={st.card}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[st.pills, { paddingRight: 16 }]}>
          {aircraft ? (
            <TouchableOpacity
              style={st.pill}
              onPress={() => { haptics.light(); setAircraftModalVisible(true); }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={aircraft}
            >
              <Text style={st.pillTxt} numberOfLines={1}>{aircraft}</Text>
            </TouchableOpacity>
          ) : null}
          {tg ? (
            <TouchableOpacity
              style={[st.pill, gateChanged && st.pillHot]}
              onPress={() => {
                haptics.light();
                void Linking.openURL(airportMapUrl(
                  boardType === 'arrival' ? dCode : oCode,
                  gateCodeOf(gate),
                ));
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={tg}
            >
              <Text style={[st.pillTxt, gateChanged && { color: RED }]} numberOfLines={1}>{tg}</Text>
            </TouchableOpacity>
          ) : null}
          {landed && belt ? <View style={st.pill}><Text style={st.pillTxt} numberOfLines={1}>{copy.baggageBelt(belt)}</Text></View> : null}
          {tzH !== 0 ? <View style={st.pill}><Text style={st.pillTxt} numberOfLines={1}>{copy.tzDeltaOnArrival(tzH)}</Text></View> : null}
          {aqi ? (
            <Pressable
              style={st.pill}
              onPress={() => { haptics.light(); setAqiOpen(true); }}
              accessibilityRole="button"
              accessibilityLabel={`AQI ${aqi.aqi} ${aqi.label}`}
            >
              <View style={st.aqiPillRow}>
                <View style={[st.aqiDot, { backgroundColor: aqiColor(aqi.aqi) }]} />
                <Text style={st.pillTxt} numberOfLines={1}>AQI {aqi.aqi}</Text>
              </View>
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={st.blocks}>
          <View style={st.block}>
            <Text style={st.blockK}>{copy.departs}</Text>
            <Text style={[st.blockV, landed && st.blockDepLanded]}>{depClkA || depClkS || '—'}</Text>
            {depClkA && depClkS && depClkA !== depClkS ? <Text style={st.blockMuted}>{depClkS}</Text> : null}
            {termGate(depTerminal, boardType === 'departure' ? gate : undefined) ? (
              <Text style={st.blockMuted} numberOfLines={1}>{termGate(depTerminal, boardType === 'departure' ? gate : undefined)}</Text>
            ) : null}
          </View>
          <View style={st.block}>
            <Text style={st.blockK}>{copy.enRoute}</Text>
            {enRoute ? (
              <View style={st.progTrack}>
                <View style={[st.progFill, { width: `${Math.round(pct * 100)}%` }]} />
              </View>
            ) : (
              <Text style={st.blockV}>{durLbl || '—'}</Text>
            )}
            {enRoute ? <Text style={st.blockMuted}>{durLbl ? `${durLbl} · ${Math.round(pct * 100)}%` : `${Math.round(pct * 100)}%`}</Text> : null}
          </View>
          <View style={st.block}>
            <Text style={st.blockK}>{copy.arrives}</Text>
            <Text style={st.blockV}>{arrClkA || arrClkS || '—'}</Text>
            {arrClkA && arrClkS && arrClkA !== arrClkS ? <Text style={st.blockMuted}>{arrClkS}</Text> : null}
            {termGate(arrTerminal, boardType === 'arrival' ? gate : undefined) ? (
              <Text style={st.blockMuted} numberOfLines={1}>{termGate(arrTerminal, boardType === 'arrival' ? gate : undefined)}</Text>
            ) : null}
          </View>
        </View>

        {forecast ? (
          <View style={st.comfort}>
            <Text style={st.comfortTitle}>{copy.airComfort}</Text>
            <View style={st.comfortRow}>
              <MiniBar level={forecast.barLevel || barLevelForSeverity(forecast.peak)} />
              <View style={[st.badge, {
                backgroundColor: forecast.peak === 'smooth' ? 'rgba(0,200,83,0.15)'
                  : forecast.peak === 'light' ? 'rgba(245,158,11,0.18)' : 'rgba(239,68,68,0.18)',
              }]}>
                <Text style={[st.badgeTxt, {
                  color: forecast.peak === 'smooth' ? GREEN : forecast.peak === 'light' ? AMBER : RED,
                }]}>
                  {forecast.peak === 'light' ? copy.turbulenceLight
                    : forecast.peak === 'moderate' || forecast.peak === 'severe' ? copy.turbulenceModerate
                      : copy.turbulenceSmooth}
                </Text>
              </View>
              {forecast.peakTime || forecast.windowStart ? (
                <View style={st.pill}><Text style={st.pillTxt}>{forecast.peakTime || forecast.windowStart}</Text></View>
              ) : null}
            </View>
          </View>
        ) : null}

        {landed || showPickup ? (
          <>
            {landed ? (
              <TripExtrasAddBanner
                extras={tripExtras}
                flightKey={flightKey}
                onOpen={tracked ? onOpenTripExtras : undefined}
              />
            ) : null}
          <View style={st.actionGrid}>
            <View style={st.actionGridRow}>
              <QuickActionTile
                label="Grab"
                icon="car"
                onPress={grab && (landed || showPickup) ? () => {
                  const lat = destPt?.latitude ?? transport?.lat;
                  const lon = destPt?.longitude ?? transport?.lng;
                  void openGrabToAirport(lat, lon);
                } : undefined}
              />
              <QuickActionTile label="Lounge" icon="sofa" onPress={landed ? onLoungePress : undefined} />
              <QuickActionTile label="Visa" icon="passport" onPress={landed ? onVisaPress : undefined} />
              <QuickActionTile label="Currency" icon="currency-usd" onPress={landed ? onCurrencyPress : undefined} />
            </View>
            <View style={st.actionGridRow}>
              <QuickActionTile
                label="Klook"
                icon="ticket-confirmation"
                onPress={landed ? () => {
                  void openAffiliateUrl(klookQuickActionUrl(destCity || destWx?.city, dCode));
                } : undefined}
              />
              <QuickActionTile
                label="Transit"
                icon="train"
                onPress={landed ? () => {
                  void openTransitQuickAction(dCode, destCity || destWx?.city);
                } : undefined}
              />
              {showWake ? (
                <QuickActionTile label="Wake" icon="alarm" onPress={onWakePress} />
              ) : null}
              <QuickActionTile
                label="Map"
                icon="map-outline"
                onPress={() => {
                  void Linking.openURL(airportMapUrl(mapIata, gateCodeOf(gate)));
                }}
              />
            </View>
          </View>
          </>
        ) : null}

        {mates.length ? (
          <View style={st.ctx}>
            <Text style={st.ctxTitle}>{copy.startFlyTogether}</Text>
            <View style={st.avatars}>
              {mates.slice(0, 8).map(p => (
                <View key={p.id} style={st.avatar}>
                  <Text style={st.avatarTxt}>{initialsOf(p.displayName)}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </View>
      <AirQualityScreen
        visible={aqiOpen}
        onClose={() => setAqiOpen(false)}
        lat={destPt?.latitude}
        lon={destPt?.longitude}
        city={destCity || destWx?.city || dCode}
      />
      <AircraftSheet
        visible={aircraftModalVisible}
        onClose={() => setAircraftModalVisible(false)}
        onDismiss={() => {
          if (!pendingBook.current) return;
          pendingBook.current = false;
          setBookOpen(true);
        }}
        model={aircraft || ''}
        airline={airline}
        origin={oCode}
        destination={dCode}
        flightNumber={flightNumber}
        date={scheduledDepIso || departureIso}
        gate={gate}
        onSearchFlights={() => {
          pendingBook.current = true;
          setAircraftModalVisible(false);
          setTimeout(() => {
            if (!pendingBook.current) return;
            pendingBook.current = false;
            setBookOpen(true);
          }, 500);
        }}
      />
      <BookFlightScreen
        visible={bookOpen}
        onClose={() => setBookOpen(false)}
        origin={oCode}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root: { backgroundColor: HERO_BG },
  mapWrap: {
    width: '100%',
    height: MAP_H,
    overflow: 'hidden',
    backgroundColor: '#07090f',
  },
  map: { flex: 1, width: '100%', height: MAP_H, backgroundColor: '#07090f' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  overlay: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  overlayText: { flex: 1, minWidth: 0 },
  flightLine: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  cities: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '600', marginTop: 1 },
  status: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  card: {
    backgroundColor: HERO_BG,
    paddingTop: 4,
    paddingBottom: 16,
    marginTop: -2,
  },
  pills: { paddingHorizontal: 14, gap: 6, paddingBottom: 12, alignItems: 'center' },
  pill: {
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 0,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillHot: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.45)' },
  pillTxt: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '500' },
  blocks: { flexDirection: 'row', paddingHorizontal: 10, gap: 6, marginBottom: 10 },
  block: { flex: 1, backgroundColor: 'rgba(148,163,184,0.08)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 10 },
  blockK: { color: GRAY, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  blockV: { color: '#fff', fontSize: 15, fontWeight: '800' },
  blockDepLanded: { color: GRAY, textDecorationLine: 'line-through' },
  blockMuted: { color: GRAY, fontSize: 11, fontWeight: '600', marginTop: 2, textDecorationLine: 'line-through' },
  progTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(148,163,184,0.2)', overflow: 'hidden', marginTop: 8 },
  progFill: { height: 6, borderRadius: 3, backgroundColor: ORANGE },
  comfort: { marginHorizontal: 14, marginBottom: 10, padding: 12, borderRadius: 12, backgroundColor: 'rgba(148,163,184,0.08)' },
  comfortTitle: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 8 },
  comfortRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barRow: { flexDirection: 'row', gap: 2, height: 10, flex: 1 },
  barSlot: { flex: 1, borderRadius: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  badgeTxt: { fontSize: 11, fontWeight: '800' },
  actionGrid: {
    paddingHorizontal: 14,
    gap: 6,
    paddingBottom: 8,
  },
  actionGridRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionTile: {
    flex: 1,
    minWidth: 0,
  },
  actionTileInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  actionTileIcon: { marginRight: 4 },
  actionTileDisabled: { opacity: 0.35 },
  aqiPillRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  aqiDot: { width: 5, height: 5, borderRadius: 2.5 },
  ctx: { marginHorizontal: 14, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(148,163,184,0.08)' },
  ctxTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  ctxBody: { color: GRAY, fontSize: 12, fontWeight: '600', marginTop: 2 },
  avatars: { flexDirection: 'row', gap: 6, marginTop: 8 },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E293B',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
  pillIcon: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },
  sheetOverlay: {
    flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    paddingHorizontal: 18, paddingTop: 16, paddingBottom: 32,
  },
  sheetClose: {
    position: 'absolute', top: 12, right: 12, zIndex: 2,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  sheetName: { color: '#fff', fontSize: 20, fontWeight: '700', paddingRight: 36 },
  sheetIata: { color: GRAY, fontSize: 13, fontWeight: '600', marginTop: 2, marginBottom: 12 },
  sheetHero: { width: '100%', height: 150, borderRadius: 10, backgroundColor: '#111827', marginBottom: 14 },
  sheetHeroPh: {
    width: '100%', height: 120, borderRadius: 10, marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
  },
  walkBox: {
    width: '100%',
    minHeight: 260,
    overflow: 'visible',
    marginTop: 16,
    paddingBottom: 16,
    borderRadius: 10,
  },
  specRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  spec: { flex: 1, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: 10 },
  specK: { color: GRAY, fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  specV: { color: '#fff', fontSize: 13, fontWeight: '600' },
  seatBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  seatBtnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
  searchCta: {
    marginTop: 12,
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  searchCtaTxt: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
