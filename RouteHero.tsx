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
import {
  aqiColor,
  arrivalTzDeltaHours,
  fetchAqiSnapshot,
  fetchWeatherSnapshot,
  type AqiSnapshot,
  type WeatherKind,
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
  overlayZoneColor,
  severityAtRouteFrac,
  type TurbulenceForecast,
  type TurbulenceSeverity,
} from './lib/turbulence';

const MAP_H = 320;
const HERO_BG = '#0F1728';
const CARD_BG = '#0B1220';
const GRAY = '#94A3B8';
const ORANGE = '#FF9800';
const GREEN = '#22c55e';
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

function gateCodeOf(raw?: string): string {
  return String(raw || '').replace(/^gate\s+/i, '').trim();
}

function isUnassignedGate(raw?: string): boolean {
  const g = gateCodeOf(raw).toUpperCase();
  if (!g) return true;
  return g === 'ARR' || g === 'DEP' || g === 'TBA' || g === 'TBD' || g === 'UNKNOWN' || g === 'N/A' || g === '-';
}

type WxPin = { emoji: string; temp: number } | null;

const ROUTE_LINE = 'rgba(255,255,255,0.38)';
const DEP_DOT = '#E5E7EB';
const PLANE_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"><path fill="#F1F5F9" d="M12 2.2l.55 1.1.7 7.3 7.55 2.45v.55l-7.55.7-.55 5.9 1.7 1.15v.4L12 21.1l-2.4.65v-.4l1.7-1.15-.55-5.9-7.55-.7v-.55l7.55-2.45.7-7.3z"/></svg>';

function buildRouteMapHTML(
  origin: LatLng,
  dest: LatLng,
  originCode: string,
  destCode: string,
  plane: LatLng | null,
  heading: number,
  accentColor: string,
  overlaySegs: Array<{ color: string; latlngs: [number, number][] }>,
  originWx: WxPin,
  destWx: WxPin,
  windDeg?: number,
) {
  const oCode = esc(originCode.toUpperCase());
  const dCode = esc(destCode.toUpperCase());
  const depIata = oCode;
  const arrIata = dCode;
  const arc = arcLatLngSamples(origin.latitude, origin.longitude, dest.latitude, dest.longitude);
  const mid = arc[Math.floor(arc.length / 2)];
  const hd = Number.isFinite(heading) ? Math.round(heading) : 0;
  const mapboxToken = esc(process.env.EXPO_PUBLIC_MAPBOX_TOKEN || '');
  const wxChip = (pin: WxPin, id: string) => pin
    ? `<div class="wx" id="${id}">${esc(pin.emoji)} ${pin.temp}°</div>`
    : '';
  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#07090f;overflow:hidden}
  .leaflet-control-zoom{display:none!important}
  .leaflet-div-icon{background:transparent!important;border:none!important}
  .leaflet-marker-icon{overflow:visible!important}
  .pin{position:relative;width:9px;height:9px}
  .dot{width:9px;height:9px;border-radius:50%;box-shadow:0 1px 2px rgba(0,0,0,.35);transform-origin:center center}
  .dot-dep,.dot-arr{animation:pulse 2s ease-in-out infinite}
  @keyframes pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.4}}
  .wx{position:absolute;left:50%;bottom:100%;top:auto;margin:0 0 6px 0;transform:translateX(-50%);
    background:rgba(0,0,0,0.8);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    color:#FFFFFF;font:500 11px/1.15 -apple-system,system-ui,sans-serif;
    padding:2px 5px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);
    white-space:nowrap;letter-spacing:.01em;pointer-events:none}
  .dep-label,.arr-label{background:transparent!important;border:none!important;overflow:visible!important}
  .iata-lbl{
    font:700 11px/1.2 -apple-system,system-ui,sans-serif;color:#FFFFFF;
    background:rgba(0,0,0,0.85);padding:3px 7px;border-radius:4px;
    border:1px solid rgba(255,255,255,0.5);
    text-shadow:0 1px 2px rgba(0,0,0,0.9);
    white-space:nowrap;pointer-events:none}
  .iata-lbl.dep{transform:translate(calc(-100% - 4px),10px)}
  .iata-lbl.arr{transform:translate(4px,10px)}
  .wind{font-size:12px;line-height:12px;opacity:.65;filter:drop-shadow(0 1px 1px #000);transform-origin:center}
  .ac{width:22px;height:22px;display:block;transform-origin:11px 11px;
    filter:drop-shadow(0px 0px 3px white)}
</style></head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var o=[${origin.latitude},${origin.longitude}];
  var d=[${dest.latitude},${dest.longitude}];
  var depIata='${depIata}';
  var arrIata='${arrIata}';
  var map=L.map('map',{zoomControl:false,attributionControl:true,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,tap:false});
  var mapboxToken='${mapboxToken}';
  if(mapboxToken){
    L.tileLayer(
      'https://api.mapbox.com/styles/v1/mapbox/navigation-night-v1/tiles/{z}/{x}/{y}?access_token=' + mapboxToken,
      { tileSize: 512, zoomOffset: -1, attribution: '© Mapbox © OpenStreetMap', maxZoom: 19 }
    ).addTo(map);
  }else{
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19 }
    ).addTo(map);
  }
  var arc=[${arc.map(([la, ln]) => `[${la},${ln}]`).join(',')}];
  var lineOutline=L.polyline(arc,{color:'#000000',weight:6,dashArray:'8 6',lineCap:'round',opacity:0.5,interactive:false}).addTo(map);
  var line=L.polyline(arc,{color:'#FFFFFF',weight:3,dashArray:'8 6',lineCap:'round',opacity:1,interactive:false}).addTo(map);
  map.fitBounds(line.getBounds().pad(0.28),{paddingTopLeft:[48,36],paddingBottomRight:[48,100],maxZoom:5});
  ${overlaySegs.map(s =>
    `L.polyline([${s.latlngs.map(([la, ln]) => `[${la},${ln}]`).join(',')}],{color:'${esc(s.color)}',weight:5,opacity:0.85,lineCap:'round',interactive:false}).addTo(map);`
  ).join('\n  ')}
  function pin(ll,color,html,cls){
    return L.marker(ll,{interactive:false,keyboard:false,icon:L.divIcon({className:'rh-icon',iconSize:[9,9],iconAnchor:[5,5],html:'<div class="pin"><div class="dot '+(cls||'')+'" style="background:'+color+'"></div>'+html+'</div>'})});
  }
  function iataLabel(ll,text,side){
    return L.marker(ll,{interactive:false,keyboard:false,icon:L.divIcon({
      className:side==='dep'?'dep-label':'arr-label',
      iconSize:[1,1],iconAnchor:[5,5],
      html:'<div class="iata-lbl '+side+'">'+text+'</div>'
    })});
  }
  pin(o,'${DEP_DOT}','${wxChip(originWx, 'wx-o')}','dot-dep').addTo(map);
  iataLabel(o,depIata,'dep').addTo(map);
  ${dCode && dCode !== oCode ? `pin(d,'${esc(accentColor)}','${wxChip(destWx, 'wx-d')}','dot-arr').addTo(map);
  iataLabel(d,arrIata,'arr').addTo(map);` : ''}
  ${windDeg != null && Number.isFinite(windDeg) ? `
  L.marker([${mid[0]},${mid[1]}],{interactive:false,keyboard:false,icon:L.divIcon({className:'rh-icon',iconSize:[14,14],iconAnchor:[7,7],html:'<div class="wind" style="transform:rotate(${Math.round(windDeg + 180)}deg)">➤</div>'})}).addTo(map);
  ` : ''}
  var p=${plane ? `[${plane.latitude},${plane.longitude}]` : 'null'};
  if(p){
    L.marker(p,{interactive:false,keyboard:false,icon:L.divIcon({className:'rh-icon',iconSize:[22,22],iconAnchor:[11,11],
      html:'<div class="ac" style="transform:rotate(${hd}deg)">${PLANE_SVG}</div>'})}).addTo(map);
    function havKm(a,b){
      var R=6371,p1=a[0]*Math.PI/180,p2=b[0]*Math.PI/180;
      var dlat=(b[0]-a[0])*Math.PI/180,dlng=(b[1]-a[1])*Math.PI/180;
      var s=Math.sin(dlat/2)*Math.sin(dlat/2)+Math.cos(p1)*Math.cos(p2)*Math.sin(dlng/2)*Math.sin(dlng/2);
      return 2*R*Math.asin(Math.min(1,Math.sqrt(s)));
    }
    function shiftWx(ll,id,other){
      var el=document.getElementById(id);
      if(!el||!ll) return;
      var km=havKm(p,ll);
      var ptP=map.latLngToContainerPoint(p);
      var ptB=map.latLngToContainerPoint(ll);
      var dx=ptB.x-ptP.x, dy=ptB.y-ptP.y;
      var pix=Math.sqrt(dx*dx+dy*dy);
      if(km>=150 && pix>=60) return;
      var ox,oy;
      if(pix<8){
        var ptO=map.latLngToContainerPoint(o);
        var ptD=map.latLngToContainerPoint(d);
        var rx=ptD.x-ptO.x, ry=ptD.y-ptO.y;
        var rlen=Math.sqrt(rx*rx+ry*ry)||1;
        ox=(-ry/rlen)*40;
        oy=(rx/rlen)*40;
        var ptOther=map.latLngToContainerPoint(other);
        if((ptOther.x-(ptB.x+ox))*ox+(ptOther.y-(ptB.y+oy))*oy>0){ox=-ox;oy=-oy;}
      } else {
        ox=(dx/pix)*40;
        oy=(dy/pix)*40;
      }
      el.style.transform='translate(calc(-50% + '+Math.round(ox)+'px), '+Math.round(oy)+'px)';
    }
    shiftWx(o,'wx-o',d);
    shiftWx(d,'wx-d',o);
  }
  window.__rhMap=map;
  function rhResize(){try{map.invalidateSize();}catch(e){}}
  setTimeout(rhResize,120);
  setTimeout(rhResize,520);
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
};

export default function RouteHero({
  origin, destination, originCity, destCity,
  progress = 0, duration, status, originLat, originLon, destLat, destLon,
  liveLat, liveLng, headingDeg, flightId, departureIso, durationMin,
  airlineCode, airline, flightNumber, actualTime, clockIata, clockCountry,
  aircraft, depTerminal, arrTerminal, gate, previousGate, baggage, delayMin = 0,
  originCountry, destCountry, scheduledDepIso, actualDepIso, scheduledArrIso, actualArrIso,
  boardType, onLoungePress, onVisaPress, onCurrencyPress, onWakePress, tracked, isPro,
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
