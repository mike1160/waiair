import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import type MapViewNative from 'react-native-maps';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Airplane } from 'phosphor-react-native';
import { MapView, Marker, Polyline } from './nativeMaps';

const LIVE_GREEN = '#00C853';
const DEST_GRAY = '#94A3B8';
const PLANE_BLUE = '#3B82F6';
const GLOW = 'rgba(0, 200, 83, 0.55)';
const MAP_H = 200;

const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0b1a36' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8aa0c4' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#05070d' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1c3358' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#15284a' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#05070d' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a6288' }] },
];

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

function spanRegion(a: LatLng, b: LatLng, extra?: LatLng | null) {
  const pts = extra ? [a, b, extra] : [a, b];
  const lats = pts.map(p => p.latitude);
  const lons = pts.map(p => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: Math.max(0.8, (maxLat - minLat) * 1.8),
    longitudeDelta: Math.max(0.8, (maxLon - minLon) * 1.8),
  };
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
  return (
    <View style={styles.cities} pointerEvents="none">
      <View style={styles.cityCol}>
        <Text style={styles.code}>{o || ''}</Text>
        <Text style={styles.city} numberOfLines={1}>{originCity || o}</Text>
      </View>
      <View style={styles.midCol}>
        {duration ? <Text style={styles.duration}>{duration}</Text> : null}
      </View>
      <View style={[styles.cityCol, styles.cityRight]}>
        <Text style={styles.code}>{d || ''}</Text>
        <Text style={styles.city} numberOfLines={1}>{destCity || d}</Text>
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
  const cy = 28;
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
    return () => loop.stop();
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
  const mapRef = useRef<MapViewNative | null>(null);
  const originPt = toPt(originLat, originLon);
  const destPt = toPt(destLat, destLon);
  const livePt = toPt(liveLat, liveLng);
  const canMap = Platform.OS !== 'web' && !!originPt && !!destPt;

  const t = routeT(progress);
  const arcPlane = originPt && destPt ? interpolateGC(originPt, destPt, t) : null;
  const enRoute = status === 'en-route';
  const planeCoord = enRoute && livePt ? livePt : arcPlane;
  const heading = enRoute && livePt && headingDeg != null && Number.isFinite(headingDeg)
    ? headingDeg
    : (originPt && destPt ? bearingDeg(originPt, destPt) : 0);

  const fit = () => {
    if (!mapRef.current || !originPt || !destPt) return;
    const coords = [originPt, destPt];
    if (livePt) coords.push(livePt);
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 40, right: 40, bottom: 40, left: 40 },
      animated: false,
    });
  };

  useEffect(() => {
    if (!canMap) return;
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [canMap, originPt?.latitude, originPt?.longitude, destPt?.latitude, destPt?.longitude, livePt?.latitude, livePt?.longitude]);

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
    <View style={styles.mapWrap}>
      <MapView
        ref={mapRef as any}
        style={styles.map}
        initialRegion={spanRegion(originPt, destPt, livePt)}
        mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
        customMapStyle={Platform.OS === 'android' ? DARK_MAP_STYLE : undefined}
        userInterfaceStyle="dark"
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        zoomControlEnabled={false}
        toolbarEnabled={false}
        showsCompass={false}
        showsScale={false}
        moveOnMarkerPress={false}
        pointerEvents="none"
        onMapReady={fit}
      >
        <Polyline
          coordinates={[originPt, destPt]}
          geodesic
          strokeColor="rgba(255,255,255,0.6)"
          strokeWidth={2}
        />
        <Marker coordinate={originPt} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.pin}>
            <View style={[styles.dot, { backgroundColor: LIVE_GREEN }]} />
            <Text style={styles.pinLbl}>{origin.toUpperCase()}</Text>
          </View>
        </Marker>
        <Marker coordinate={destPt} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={styles.pin}>
            <View style={[styles.dot, { backgroundColor: DEST_GRAY }]} />
            <Text style={styles.pinLbl}>{destination.toUpperCase()}</Text>
          </View>
        </Marker>
        {planeCoord ? (
          <Marker
            coordinate={planeCoord}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={heading}
            flat
            tracksViewChanges={false}
          >
            <Airplane size={18} color={enRoute && livePt ? PLANE_BLUE : LIVE_GREEN} weight="fill" />
          </Marker>
        ) : null}
      </MapView>
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
  pin: { alignItems: 'center' },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  pinLbl: {
    marginTop: 3,
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
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
