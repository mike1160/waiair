import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { Airplane } from 'phosphor-react-native';
import { formatInTimeZone } from 'date-fns-tz';
import AirlineLogo, { AIRLINE_LOGO_SIZE, airlineCodeFromFlight } from './AirlineLogo';
import { timezoneForIata } from './lib/airportTz';
import AirQualityScreen from './AirQualityScreen';
import {
  aqiColor,
  arrivalTzDeltaHours,
  fetchAqiSnapshot,
  fetchWeatherSnapshot,
  taxiMinutes,
  type AqiSnapshot,
  type WeatherKind,
  type WeatherSnapshot,
} from './lib/destinationServices';
import { ENGLISH_DARK_BASE, ENGLISH_DARK_LABELS } from './lib/englishMapTiles';
import { EMPTY_CLOCK, formatAirportClock } from './lib/flightTimes';
import { formatDurationMs } from './boardingCountdown';
import { getActiveTogetherCode, listTogetherParticipants, loadCachedGroup, type TogetherParticipant } from './lib/flyTogether';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';
import { getPrefs } from './lib/prefs';
import { openGrabToAirport, TRANSPORT_INFO } from './lib/transportBooking';
import {
  barLevelForSeverity,
  flightDateKey,
  loadTurbulenceForecast,
  overlayZoneColor,
  severityAtRouteFrac,
  type TurbulenceForecast,
  type TurbulenceSeverity,
} from './lib/turbulence';

const MAP_H = 248;
const CARD_BG = '#0B1220';
const GRAY = '#94A3B8';
const ORANGE = '#FF9800';
const GREEN = '#00C853';
const RED = '#EF4444';
const AMBER = '#F59E0B';

type LatLng = { latitude: number; longitude: number };

function validCoord(lat?: number, lon?: number): boolean {
  return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}
function toPt(lat?: number, lon?: number): LatLng | null {
  if (!validCoord(lat, lon)) return null;
  return { latitude: lat as number, longitude: lon as number };
}
function toRad(d: number) { return (d * Math.PI) / 180; }
function toDeg(r: number) { return (r * 180) / Math.PI; }

function interpolateGC(a: LatLng, b: LatLng, t: number): LatLng {
  const lat1 = toRad(a.latitude);
  const lon1 = toRad(a.longitude);
  const lat2 = toRad(b.latitude);
  const lon2 = toRad(b.longitude);
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
    latitude: toDeg(Math.atan2(z, Math.sqrt(x * x + y * y))),
    longitude: toDeg(Math.atan2(y, x)),
  };
}

function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function quadPoint(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const u = 1 - t;
  return {
    x: u * u * x0 + 2 * u * t * cx + t * t * x1,
    y: u * u * y0 + 2 * u * t * cy + t * t * y1,
  };
}

function routeT(progress: number) {
  return Math.min(0.97, Math.max(0.03, progress));
}

function esc(s: string) {
  return String(s || '').replace(/[<>&"']/g, '');
}

function groupOverlay<T>(
  items: Array<{ severity: TurbulenceSeverity; pt: T }>,
): Array<{ color: string; pts: T[] }> {
  if (items.length < 2) return [];
  const out: Array<{ color: string; pts: T[] }> = [];
  let pts = [items[0].pt];
  let sev = items[0].severity;
  for (let i = 1; i < items.length; i++) {
    const pt = items[i].pt;
    if (items[i].severity === sev) {
      pts.push(pt);
      continue;
    }
    pts.push(pt);
    if (pts.length >= 2 && sev !== 'smooth') out.push({ color: overlayZoneColor(sev), pts });
    pts = [pt];
    sev = items[i].severity;
  }
  if (pts.length >= 2 && sev !== 'smooth') out.push({ color: overlayZoneColor(sev), pts });
  return out;
}

function arcLatLngSamples(
  oLat: number, oLng: number, dLat: number, dLng: number, segments = 56,
): [number, number][] {
  const origin = { latitude: oLat, longitude: oLng };
  const dest = { latitude: dLat, longitude: dLng };
  const pts: [number, number][] = [];
  let prevLon = oLng;
  for (let i = 0; i <= segments; i++) {
    const p = interpolateGC(origin, dest, i / segments);
    let lon = p.longitude;
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    pts.push([p.latitude, lon]);
    prevLon = lon;
  }
  return pts;
}

function routeLineColor(status?: string): string {
  switch (String(status || '').toLowerCase()) {
    case 'landed':
    case 'arrived':
      return GREEN;
    case 'en-route':
      return ORANGE;
    case 'delayed':
    case 'cancelled':
      return RED;
    default:
      return GRAY;
  }
}

function wxEmoji(kind?: WeatherKind): string {
  switch (kind) {
    case 'sun': return '☀️';
    case 'rain': return '🌧️';
    case 'storm': return '⛈️';
    case 'snow': return '❄️';
    case 'fog': return '🌫️';
    default: return '☁️';
  }
}

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

type WxPin = { emoji: string; temp: number } | null;

function buildRouteMapHTML(
  origin: LatLng,
  dest: LatLng,
  originCode: string,
  destCode: string,
  plane: LatLng | null,
  heading: number,
  lineColor: string,
  overlaySegs: Array<{ color: string; latlngs: [number, number][] }>,
  originWx: WxPin,
  destWx: WxPin,
  windDeg?: number,
) {
  const oCode = esc(originCode.toUpperCase());
  const dCode = esc(destCode.toUpperCase());
  const arc = arcLatLngSamples(origin.latitude, origin.longitude, dest.latitude, dest.longitude);
  const mid = arc[Math.floor(arc.length / 2)];
  const wxChip = (pin: WxPin) => pin
    ? `<div class="wx">${esc(pin.emoji)} ${pin.temp}°</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#05070d;overflow:hidden}
  .leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
  .pin{display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-80%)}
  .dot{width:10px;height:10px;border-radius:6px;border:1.5px solid #fff}
  .wx{margin-top:4px;background:rgba(11,18,32,.88);color:#fff;font:700 11px/1.2 -apple-system,system-ui,sans-serif;
    padding:3px 6px;border-radius:8px;white-space:nowrap}
  .wind{font-size:16px;line-height:16px;filter:drop-shadow(0 1px 2px #000);transform-origin:center}
</style></head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var o=[${origin.latitude},${origin.longitude}];
  var d=[${dest.latitude},${dest.longitude}];
  var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,tap:false});
  L.tileLayer('${ENGLISH_DARK_BASE}',{maxZoom:16,keepBuffer:2}).addTo(map);
  L.tileLayer('${ENGLISH_DARK_LABELS}',{maxZoom:16,keepBuffer:2}).addTo(map);
  var arc=[${arc.map(([la, ln]) => `[${la},${ln}]`).join(',')}];
  var line=L.polyline(arc,{color:'${esc(lineColor)}',weight:2.5}).addTo(map);
  map.fitBounds(line.getBounds().pad(0.28),{paddingTopLeft:[48,36],paddingBottomRight:[48,100],maxZoom:5});
  ${overlaySegs.map(s =>
    `L.polyline([${s.latlngs.map(([la, ln]) => `[${la},${ln}]`).join(',')}],{color:'${esc(s.color)}',weight:5,opacity:0.85,lineCap:'round',interactive:false}).addTo(map);`
  ).join('\n  ')}
  function pin(ll,color,html){
    return L.marker(ll,{interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[0,0],html:'<div class="pin"><div class="dot" style="background:'+color+'"></div>'+html+'</div>'})});
  }
  pin(o,'#00C853','${wxChip(originWx)}').addTo(map);
  ${dCode && dCode !== oCode ? `pin(d,'#94A3B8','${wxChip(destWx)}').addTo(map);` : ''}
  ${windDeg != null && Number.isFinite(windDeg) ? `
  L.marker([${mid[0]},${mid[1]}],{interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[18,18],iconAnchor:[9,9],html:'<div class="wind" style="transform:rotate(${Math.round(windDeg + 180)}deg)">➤</div>'})}).addTo(map);
  ` : ''}
  var p=${plane ? `[${plane.latitude},${plane.longitude}]` : 'null'};
  if(p){
    L.marker(p,{interactive:false,keyboard:false,icon:L.divIcon({className:'',iconSize:[18,18],iconAnchor:[9,9],
      html:'<div style="transform:rotate(${Number.isFinite(heading) ? heading : 0}deg);font-size:16px;line-height:18px;filter:drop-shadow(0 0 3px #3B82F6)">✈</div>'})}).addTo(map);
  }
</script></body></html>`;
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
};

export default function RouteHero({
  origin, destination, originCity, destCity,
  progress = 0, duration, status, originLat, originLon, destLat, destLon,
  liveLat, liveLng, headingDeg, flightId, departureIso, durationMin,
  airlineCode, airline, flightNumber, actualTime, clockIata, clockCountry,
  aircraft, depTerminal, arrTerminal, gate, previousGate, baggage, delayMin = 0,
  originCountry, destCountry, scheduledDepIso, actualDepIso, scheduledArrIso, actualArrIso,
  boardType,
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
    : (originPt && destPt ? bearingDeg(originPt, destPt) : 0);

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
  const pickupMin = taxiMinutes(dCode);

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
          />
        ) : (
          <Svg width={w} height={MAP_H} style={StyleSheet.absoluteFill}>
            <Rect width={w} height={MAP_H} fill="#05070d" />
            <Path d={`M ${x0} ${y} Q ${cx} ${cy} ${x1} ${y}`} stroke={routeLineColor(status)} strokeWidth={2.5} fill="none" />
            <Circle cx={x0} cy={y} r={4} fill={GREEN} />
            <Circle cx={x1} cy={y} r={4} fill={GRAY} />
          </Svg>
        )}
        {!canMap && plane ? (
          <View style={[st.plane, { left: plane.x - 11, top: plane.y - 11 }]}>
            <Airplane size={22} color={ORANGE} weight="fill" />
          </View>
        ) : null}
        <Svg pointerEvents="none" style={st.fade} width={w} height={110}>
          <Defs>
            <LinearGradient id="heroFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={CARD_BG} stopOpacity="0" />
              <Stop offset="1" stopColor={CARD_BG} stopOpacity="1" />
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.pills}>
          {aircraft ? <View style={st.pill}><Text style={st.pillTxt} numberOfLines={1}>{aircraft}</Text></View> : null}
          {tg ? (
            <View style={[st.pill, gateChanged && st.pillHot]}>
              <Text style={[st.pillTxt, gateChanged && { color: RED }]} numberOfLines={1}>{tg}</Text>
            </View>
          ) : null}
          {landed && belt ? <View style={st.pill}><Text style={st.pillTxt} numberOfLines={1}>{copy.baggageBelt(belt)}</Text></View> : null}
          {tzH !== 0 ? <View style={st.pill}><Text style={st.pillTxt} numberOfLines={1}>{copy.tzDeltaOnArrival(tzH)}</Text></View> : null}
        </ScrollView>

        <View style={st.blocks}>
          <View style={st.block}>
            <Text style={st.blockK}>{copy.departs}</Text>
            <Text style={st.blockV}>{depClkA || depClkS || '—'}</Text>
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

        {showPickup && grab ? (
          <Pressable
            style={st.ctx}
            onPress={() => {
              haptics.light();
              const lat = destPt?.latitude ?? transport?.lat;
              const lon = destPt?.longitude ?? transport?.lng;
              void openGrabToAirport(lat, lon);
            }}
            accessibilityRole="button"
            accessibilityLabel={grab.name}
          >
            <Text style={st.ctxTitle}>{grab.name}</Text>
            <Text style={st.ctxBody}>
              {pickupMin != null ? `~${pickupMin} min · ${grab.price}` : grab.price}
            </Text>
          </Pressable>
        ) : null}

        {aqi ? (
          <Pressable
            style={st.ctx}
            onPress={() => { haptics.light(); setAqiOpen(true); }}
            accessibilityRole="button"
            accessibilityLabel={`AQI ${aqi.aqi}`}
          >
            <View style={st.aqiRow}>
              <View style={[st.aqiDot, { backgroundColor: aqiColor(aqi.aqi) }]} />
              <Text style={st.ctxTitle}>AQI {aqi.aqi}</Text>
              <Text style={st.ctxBody}>{aqi.label}</Text>
            </View>
          </Pressable>
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
    </View>
  );
}

const st = StyleSheet.create({
  root: { backgroundColor: CARD_BG },
  mapWrap: { width: '100%', height: MAP_H, overflow: 'hidden', backgroundColor: '#05070d' },
  map: { width: '100%', height: MAP_H },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  overlay: {
    position: 'absolute', left: 14, right: 14, bottom: 10,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  overlayText: { flex: 1, minWidth: 0 },
  flightLine: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  cities: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '600', marginTop: 1 },
  status: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  plane: { position: 'absolute' },
  card: {
    backgroundColor: CARD_BG,
    paddingTop: 4,
    paddingBottom: 16,
    marginTop: -2,
  },
  pills: { paddingHorizontal: 14, gap: 8, paddingBottom: 12 },
  pill: {
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: 'rgba(148,163,184,0.12)', borderWidth: 1, borderColor: 'rgba(148,163,184,0.22)',
  },
  pillHot: { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.45)' },
  pillTxt: { color: '#E2E8F0', fontSize: 12, fontWeight: '700' },
  blocks: { flexDirection: 'row', paddingHorizontal: 10, gap: 6, marginBottom: 10 },
  block: { flex: 1, backgroundColor: 'rgba(148,163,184,0.08)', borderRadius: 12, padding: 10 },
  blockK: { color: GRAY, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  blockV: { color: '#fff', fontSize: 15, fontWeight: '800' },
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
  ctx: { marginHorizontal: 14, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(148,163,184,0.08)' },
  ctxTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  ctxBody: { color: GRAY, fontSize: 12, fontWeight: '600', marginTop: 2 },
  aqiRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aqiDot: { width: 10, height: 10, borderRadius: 5 },
  avatars: { flexDirection: 'row', gap: 6, marginTop: 8 },
  avatar: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#1E293B',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { color: '#fff', fontSize: 11, fontWeight: '800' },
});
