import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Airplane } from 'phosphor-react-native';
import { ENGLISH_DARK_BASE, ENGLISH_DARK_LABELS } from './lib/englishMapTiles';

const MAP_H = 200;
const LIVE_GREEN = '#00C853';
const DEST_GRAY = '#94A3B8';
const GLOW = 'rgba(0, 200, 83, 0.55)';

const STARS = [
  { x: 0.08, y: 0.18, r: 1.1, o: 0.35 },
  { x: 0.16, y: 0.42, r: 0.8, o: 0.22 },
  { x: 0.22, y: 0.12, r: 1.4, o: 0.4 },
  { x: 0.31, y: 0.55, r: 0.7, o: 0.18 },
  { x: 0.38, y: 0.2, r: 1.0, o: 0.28 },
  { x: 0.47, y: 0.08, r: 1.3, o: 0.45 },
  { x: 0.54, y: 0.48, r: 0.9, o: 0.2 },
  { x: 0.61, y: 0.16, r: 1.1, o: 0.32 },
  { x: 0.69, y: 0.38, r: 0.8, o: 0.24 },
  { x: 0.76, y: 0.11, r: 1.2, o: 0.38 },
  { x: 0.84, y: 0.5, r: 0.7, o: 0.2 },
  { x: 0.91, y: 0.22, r: 1.0, o: 0.3 },
  { x: 0.12, y: 0.68, r: 0.6, o: 0.16 },
  { x: 0.88, y: 0.66, r: 0.7, o: 0.18 },
];

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

function quadAngle(t: number, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number) {
  const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx);
  const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

function routeT(progress: number) {
  return Math.min(0.97, Math.max(0.03, progress));
}

function esc(s: string) {
  return String(s || '').replace(/[<>&"']/g, '');
}

/** Quadratic bezier sample for curved flight path on Leaflet map. */
function arcLatLngSamples(
  oLat: number,
  oLng: number,
  dLat: number,
  dLng: number,
  segments = 28,
): [number, number][] {
  const midLat = (oLat + dLat) / 2;
  const midLng = (oLng + dLng) / 2;
  const dx = dLat - oLat;
  const dy = dLng - oLng;
  const dist = Math.hypot(dx, dy) || 1;
  const bow = dist * 0.1;
  const cx = midLat + bow;
  const cy = midLng;
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    pts.push([
      u * u * oLat + 2 * u * t * cx + t * t * dLat,
      u * u * oLng + 2 * u * t * cy + t * t * dLng,
    ]);
  }
  return pts;
}

function buildRouteMapHTML(
  origin: LatLng,
  dest: LatLng,
  originCode: string,
  destCode: string,
  plane?: LatLng | null,
  heading = 0,
) {
  const oCode = esc(originCode.toUpperCase());
  const dCode = esc(destCode.toUpperCase());
  const planeJs = plane
    ? `[${plane.latitude},${plane.longitude}]`
    : 'null';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta http-equiv="content-language" content="en"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;width:100%;height:100%;background:#05070d;overflow:hidden}
  .leaflet-control-attribution,.leaflet-control-zoom{display:none!important}
  .pin{display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-70%)}
  .dot{width:10px;height:10px;border-radius:6px;border:1.5px solid #fff}
  .lbl{margin-top:3px;color:#fff;font:800 10px/1 -apple-system,system-ui,sans-serif;
    letter-spacing:.6px;text-shadow:0 1px 2px rgba(0,0,0,.7);white-space:nowrap}
</style>
</head>
<body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var o=[${origin.latitude},${origin.longitude}];
  var d=[${dest.latitude},${dest.longitude}];
  var map=L.map('map',{zoomControl:false,attributionControl:false,dragging:false,scrollWheelZoom:false,doubleClickZoom:false,boxZoom:false,keyboard:false,tap:false}).fitBounds([o,d],{padding:[28,28],maxZoom:8});
  L.tileLayer('${ENGLISH_DARK_BASE}',{maxZoom:16,keepBuffer:2}).addTo(map);
  L.tileLayer('${ENGLISH_DARK_LABELS}',{maxZoom:16,keepBuffer:2}).addTo(map);
  var arc=[${arcLatLngSamples(origin.latitude, origin.longitude, dest.latitude, dest.longitude)
    .map(([la, ln]) => `[${la},${ln}]`).join(',')}];
  L.polyline(arc,{color:'rgba(255,255,255,0.7)',weight:2}).addTo(map);
  function marker(ll,color){
    return L.marker(ll,{interactive:false,keyboard:false,icon:L.divIcon({
      className:'',iconSize:[0,0],html:'<div class="pin"><div class="dot" style="background:'+color+'"></div></div>'
    })});
  }
  marker(o,'#00C853').addTo(map);
  ${dCode && dCode !== oCode ? `marker(d,'#94A3B8').addTo(map);` : ''}
  var p=${planeJs};
  if(p){
    var rot=${Number.isFinite(heading)?heading:0};
    L.marker(p,{interactive:false,keyboard:false,icon:L.divIcon({
      className:'',iconSize:[18,18],iconAnchor:[9,9],
      html:'<div style="transform:rotate('+rot+'deg);font-size:16px;line-height:18px;filter:drop-shadow(0 0 3px #3B82F6)">✈</div>'
    })}).addTo(map);
  }
</script>
</body>
</html>`;
}

function CityOverlay({
  origin,
  destination,
  originCity,
  destCity,
  duration,
}: {
  origin: string;
  destination: string;
  originCity?: string;
  destCity?: string;
  duration?: string;
}) {
  const o = (origin || '').toUpperCase();
  const d = (destination || '').toUpperCase();
  const left = o;
  const right = d && d !== o ? d : '';
  return (
    <View style={styles.cities} pointerEvents="none">
      <View style={styles.cityCol}>
        <Text style={styles.code}>{left}</Text>
        <Text style={styles.city} numberOfLines={1}>{left ? (originCity || left) : ''}</Text>
      </View>
      <View style={styles.midCol}>
        {duration ? <Text style={styles.duration}>{duration}</Text> : null}
      </View>
      <View style={[styles.cityCol, styles.cityRight]}>
        <Text style={styles.code}>{right}</Text>
        <Text style={styles.city} numberOfLines={1}>{right ? (destCity || right) : ''}</Text>
      </View>
    </View>
  );
}

function SvgRouteHero({
  origin,
  destination,
  originCity,
  destCity,
  progress = 0,
  duration,
  status,
  animated = true,
}: {
  origin: string;
  destination: string;
  originCity?: string;
  destCity?: string;
  progress?: number;
  duration?: string;
  status?: string;
  animated?: boolean;
}) {
  const w = Dimensions.get('window').width;
  const h = MAP_H;
  const pad = 36;
  const x0 = pad;
  const x1 = w - pad;
  const y = 86;
  const cx = w / 2;
  const cy = y - 40;
  const target = routeT(progress);
  const anim = useRef(new Animated.Value(status === 'landed' ? 0.97 : 0.03)).current;
  const twinkle = useRef(new Animated.Value(0.45)).current;
  const [t, setT] = useState(target);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setT(value));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    if (!animated) {
      anim.setValue(target);
      setT(target);
      return;
    }
    Animated.timing(anim, {
      toValue: target,
      duration: 1400,
      useNativeDriver: false,
    }).start();
  }, [anim, animated, target]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(twinkle, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(twinkle, { toValue: 0.35, duration: 1800, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      try {
        loop.stop();
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, [twinkle]);

  const plane = useMemo(() => quadPoint(t, x0, y, cx, cy, x1, y), [t, x0, x1, y, cx, cy]);
  const angle = useMemo(() => quadAngle(t, x0, y, cx, cy, x1, y), [t, x0, x1, y, cx, cy]);
  const dash = Math.max(8, Math.round(t * 220));

  return (
    <View style={[styles.wrap, { width: w, height: h }]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="routeHeroBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#05070d" />
            <Stop offset="1" stopColor="#0b1a36" />
          </LinearGradient>
        </Defs>
        <Path d={`M0 0 H${w} V${h} H0 Z`} fill="url(#routeHeroBg)" />
        {STARS.map((s, i) => (
          <Circle
            key={i}
            cx={s.x * w}
            cy={s.y * h}
            r={s.r}
            fill="#ffffff"
            opacity={s.o}
          />
        ))}
        <Path
          d={`M ${x0} ${y} Q ${cx} ${cy} ${x1} ${y}`}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={2}
          fill="none"
        />
        <Path
          d={`M ${x0} ${y} Q ${cx} ${cy} ${x1} ${y}`}
          stroke={LIVE_GREEN}
          strokeWidth={2}
          fill="none"
          strokeDasharray={`${dash} 240`}
          strokeLinecap="round"
        />
        <Circle cx={x0} cy={y} r={4.5} fill={GLOW} />
        <Circle cx={x0} cy={y} r={2.4} fill="#ffffff" />
        <Circle cx={x1} cy={y} r={4.5} fill={DEST_GRAY} />
        <Circle cx={x1} cy={y} r={2.4} fill="#ffffff" />
      </Svg>
      <Animated.View
        style={[
          styles.plane,
          {
            left: plane.x - 11,
            top: plane.y - 11,
            transform: [{ rotate: `${angle}deg` }],
            opacity: twinkle.interpolate({ inputRange: [0.35, 1], outputRange: [0.82, 1] }),
          },
        ]}
        pointerEvents="none"
      >
        <Airplane size={22} color={LIVE_GREEN} weight="fill" />
      </Animated.View>
      <CityOverlay
        origin={origin}
        destination={destination}
        originCity={originCity}
        destCity={destCity}
        duration={duration}
      />
    </View>
  );
}

export default function RouteHero({
  origin,
  destination,
  originCity,
  destCity,
  progress = 0,
  duration,
  status,
  animated = true,
  originLat,
  originLon,
  destLat,
  destLon,
  liveLat,
  liveLng,
  headingDeg,
}: {
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
}) {
  const originPt = toPt(originLat, originLon);
  const destPt = toPt(destLat, destLon);
  const livePt = toPt(liveLat, liveLng);
  const oCode = (origin || '').toUpperCase();
  const dCode = (destination || '').toUpperCase();
  const sameAirport = !!oCode && oCode === dCode;
  const samePt = !!(originPt && destPt
    && originPt.latitude === destPt.latitude
    && originPt.longitude === destPt.longitude);
  const canMap = Platform.OS !== 'web' && !!originPt && !!destPt && !sameAirport && !samePt;

  const t = routeT(progress);
  const arcPlane = originPt && destPt ? interpolateGC(originPt, destPt, t) : null;
  const enRoute = status === 'en-route';
  const planeCoord = enRoute && livePt ? livePt : arcPlane;
  const heading = enRoute && livePt && headingDeg != null && Number.isFinite(headingDeg)
    ? headingDeg
    : (originPt && destPt ? bearingDeg(originPt, destPt) : 0);

  const html = useMemo(() => {
    if (!originPt || !destPt) return '';
    return buildRouteMapHTML(originPt, destPt, oCode, dCode, planeCoord, heading);
  }, [
    originPt?.latitude, originPt?.longitude,
    destPt?.latitude, destPt?.longitude,
    oCode, dCode,
    planeCoord?.latitude, planeCoord?.longitude,
    heading,
  ]);

  if (!canMap) {
    return (
      <SvgRouteHero
        origin={origin}
        destination={destination}
        originCity={originCity}
        destCity={destCity}
        progress={progress}
        duration={duration}
        status={status}
        animated={animated}
      />
    );
  }

  return (
    <View style={styles.mapWrap} pointerEvents="none">
      <WebView
        originWhitelist={['*']}
        source={{ html, headers: { 'Accept-Language': 'en-US,en;q=1.0' } }}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        setSupportMultipleWindows={false}
        mixedContentMode="always"
        androidLayerType="hardware"
      />
      <CityOverlay
        origin={origin}
        destination={destination}
        originCity={originCity}
        destCity={destCity}
        duration={duration}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  mapWrap: { width: '100%', height: MAP_H, overflow: 'hidden', backgroundColor: '#05070d' },
  map: { width: '100%', height: MAP_H },
  plane: { position: 'absolute' },
  cities: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  cityCol: { flex: 1, maxWidth: '38%' },
  cityRight: { alignItems: 'flex-end' },
  midCol: { flex: 1, alignItems: 'center', paddingBottom: 2 },
  code: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1.6,
    textShadowColor: 'rgba(0,0,0,0.55)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  city: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  duration: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
});
