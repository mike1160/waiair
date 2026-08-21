import { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import Svg, { Circle, Line } from 'react-native-svg';
import {
  flightDateKey,
  loadTurbulenceForecast,
  turbulencePolylines,
  turbulenceRoutePoints,
  zoneColor,
  type TurbulenceForecast,
} from '../../lib/turbulence';
import { t } from '../../lib/i18n';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  list: string;
};

const MAP_H = 168;
const GREEN = '#22C55E';
const AMBER = '#F59E0B';
const RED = '#EF4444';

function hasCoord(lat?: number, lon?: number): boolean {
  return lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon) && !(lat === 0 && lon === 0);
}

function flightLevel(ft: number): string {
  return `FL${Math.max(1, Math.round(ft / 100))}`;
}

function InfoPill({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ThemeBits;
}) {
  return (
    <View
      style={[st.pill, { backgroundColor: theme.list, borderColor: theme.border }]}
      accessibilityRole="text"
      accessibilityLabel={`${label} ${value}`}
    >
      <Text style={[st.pillLabel, { color: theme.muted }]} numberOfLines={1}>{label}</Text>
      <Text style={[st.pillValue, { color: theme.text }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function RouteSvg({
  points,
  theme,
}: {
  points: Array<{ latitude: number; longitude: number; severity: string }>;
  theme: ThemeBits;
}) {
  const w = 320;
  const h = MAP_H;
  const pad = 18;
  const lats = points.map(p => p.latitude);
  const lons = points.map(p => p.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const latSpan = Math.max(0.4, maxLat - minLat);
  const lonSpan = Math.max(0.4, maxLon - minLon);
  const xy = (lat: number, lon: number) => ({
    x: pad + ((lon - minLon) / lonSpan) * (w - pad * 2),
    y: pad + ((maxLat - lat) / latSpan) * (h - pad * 2),
  });
  const segs: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
  for (let i = 1; i < points.length; i++) {
    const a = xy(points[i - 1].latitude, points[i - 1].longitude);
    const b = xy(points[i].latitude, points[i].longitude);
    segs.push({
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      color: zoneColor(points[i - 1].severity as 'smooth' | 'light' | 'moderate' | 'severe'),
    });
  }
  const start = xy(points[0].latitude, points[0].longitude);
  const end = xy(points[points.length - 1].latitude, points[points.length - 1].longitude);
  return (
    <View style={[st.map, { backgroundColor: theme.list }]}>
      <Svg width="100%" height={MAP_H} viewBox={`0 0 ${w} ${h}`}>
        {segs.map((s, i) => (
          <Line
            key={i}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            stroke={s.color}
            strokeWidth={5}
            strokeLinecap="round"
          />
        ))}
        <Circle cx={start.x} cy={start.y} r={5} fill={GREEN} />
        <Circle cx={end.x} cy={end.y} r={5} fill={RED} />
      </Svg>
    </View>
  );
}

export default function TurbulenceForecastCard({
  flightId,
  origin,
  destination,
  originLat,
  originLon,
  destLat,
  destLon,
  departureIso,
  durationMin,
  allowFetch = true,
  theme,
}: {
  flightId: string;
  origin: string;
  destination: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  departureIso?: string;
  durationMin?: number;
  allowFetch?: boolean;
  theme: ThemeBits;
}) {
  const [forecast, setForecast] = useState<TurbulenceForecast | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadTurbulenceForecast({
        flightId,
        origin,
        destination,
        date: flightDateKey(departureIso),
        departureIso,
        durationMin,
        allowNetwork: allowFetch,
      });
      if (cancelled) return;
      setForecast(data);
    })();
    return () => { cancelled = true; };
  }, [flightId, origin, destination, departureIso, durationMin, allowFetch]);

  const canMap = hasCoord(originLat, originLon) && hasCoord(destLat, destLon);
  const points = useMemo(() => {
    if (!forecast || !canMap) return [];
    return turbulenceRoutePoints(originLat as number, originLon as number, destLat as number, destLon as number, forecast);
  }, [forecast, canMap, originLat, originLon, destLat, destLon]);
  const lines = useMemo(() => turbulencePolylines(points), [points]);

  if (!forecast || !canMap || points.length < 2) return null;

  const region = {
    latitude: ((originLat as number) + (destLat as number)) / 2,
    longitude: ((originLon as number) + (destLon as number)) / 2,
    latitudeDelta: Math.max(4, Math.abs((originLat as number) - (destLat as number)) * 1.8 + 2),
    longitudeDelta: Math.max(4, Math.abs((originLon as number) - (destLon as number)) * 1.8 + 2),
  };
  const copy = t();
  const bumps = Math.max(0, Math.round(forecast.bumpMinutes || 0));
  const cruise = flightLevel(forecast.cruiseAltitudeFt || 35000);
  const peak = forecast.peakTime || forecast.windowStart || '—';

  return (
    <View style={[st.card, { backgroundColor: theme.list, borderColor: theme.border }]} accessibilityRole="summary">
      <Text style={[st.title, { color: theme.text }]}>{copy.turbulenceForecast}</Text>
      <View style={st.legend}>
        <View style={st.legendItem}><View style={[st.dot, { backgroundColor: GREEN }]} /><Text style={[st.legendTxt, { color: theme.muted }]}>{copy.turbulenceSmooth}</Text></View>
        <View style={st.legendItem}><View style={[st.dot, { backgroundColor: AMBER }]} /><Text style={[st.legendTxt, { color: theme.muted }]}>{copy.turbulenceLight}</Text></View>
        <View style={st.legendItem}><View style={[st.dot, { backgroundColor: RED }]} /><Text style={[st.legendTxt, { color: theme.muted }]}>{copy.turbulenceModerate}</Text></View>
      </View>
      {Platform.OS === 'web' ? (
        <RouteSvg points={points} theme={theme} />
      ) : (
        <View style={st.map} pointerEvents="none">
          <MapView
            style={StyleSheet.absoluteFill}
            region={region}
            mapType="standard"
            scrollEnabled={false}
            zoomEnabled={false}
            rotateEnabled={false}
            pitchEnabled={false}
            toolbarEnabled={false}
          >
            {lines.map((line, i) => (
              <Polyline
                key={`${line.severity}-${i}`}
                coordinates={line.coordinates}
                strokeColor={zoneColor(line.severity)}
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
              />
            ))}
            <Marker coordinate={{ latitude: originLat as number, longitude: originLon as number }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[st.pin, { backgroundColor: GREEN }]} />
            </Marker>
            <Marker coordinate={{ latitude: destLat as number, longitude: destLon as number }} anchor={{ x: 0.5, y: 0.5 }}>
              <View style={[st.pin, { backgroundColor: RED }]} />
            </Marker>
          </MapView>
        </View>
      )}
      <View style={st.pills}>
        <InfoPill label={copy.turbulenceBumpsLabel} value={copy.turbulenceBumps(bumps)} theme={theme} />
        <InfoPill label={copy.turbulenceCruiseLabel} value={copy.turbulenceCruise(cruise)} theme={theme} />
        <InfoPill label={copy.turbulencePeakLabel} value={copy.turbulencePeakAt(peak)} theme={theme} />
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
  },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  legend: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendTxt: { fontSize: 11, fontWeight: '600' },
  map: {
    height: MAP_H,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  pin: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: '#fff' },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  pillLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginBottom: 2 },
  pillValue: { fontSize: 13, fontWeight: '800' },
});
