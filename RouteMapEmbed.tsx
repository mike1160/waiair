import { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { formatInTimeZone } from 'date-fns-tz';
import AirlineLogo, { AIRLINE_LOGO_SIZE, airlineCodeFromFlight } from './AirlineLogo';
import { timezoneForIata } from './lib/airportTz';
import {
  fetchWeatherSnapshot,
  type WeatherSnapshot,
} from './lib/destinationServices';
import { EMPTY_CLOCK, formatAirportClock } from './lib/flightTimes';
import { t } from './lib/i18n';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';
import { getPrefs } from './lib/prefs';
import {
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

const HERO_BG = '#0F1728';
const GRAY = '#94A3B8';
const ORANGE = '#FF9800';
const GREEN = '#22c55e';
const RED = '#EF4444';

export type RouteMapEmbedProps = {
  height?: number;
  compact?: boolean;
  showOverlay?: boolean;
  showStatusInOverlay?: boolean;
  origin?: string;
  destination?: string;
  originCity?: string;
  destCity?: string;
  progress?: number;
  status?: string;
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
  delayMin?: number;
  originCountry?: string;
  destCountry?: string;
  scheduledDepIso?: string;
  scheduledArrIso?: string;
  actualArrIso?: string;
  actualTime?: string;
};

function clock(iso?: string, iata?: string, country?: string): string {
  if (!iso) return '';
  const v = formatAirportClock(iso, iata, getPrefs().timeFormat === '12h', country);
  return v === EMPTY_CLOCK ? '' : v;
}

export default function RouteMapEmbed({
  height = 320,
  compact = false,
  showOverlay = true,
  showStatusInOverlay = true,
  origin,
  destination,
  originCity,
  destCity,
  progress = 0,
  status,
  originLat,
  originLon,
  destLat,
  destLon,
  liveLat,
  liveLng,
  headingDeg,
  flightId,
  departureIso,
  durationMin,
  airlineCode,
  airline,
  flightNumber,
  delayMin = 0,
  originCountry,
  destCountry,
  scheduledDepIso,
  scheduledArrIso,
  actualArrIso,
  actualTime,
}: RouteMapEmbedProps) {
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

  useEffect(() => {
    const id = String(flightId || '').trim();
    if (!id || !oCode || !dCode || oCode === dCode) {
      setForecast(null);
      return;
    }
    let cancelled = false;
    loadTurbulenceForecast({
      flightId: id,
      origin: oCode,
      destination: dCode,
      date: flightDateKey(departureIso),
      departureIso,
      durationMin,
      allowNetwork: status !== 'en-route' && status !== 'landed',
    }).then(data => { if (!cancelled) setForecast(data); });
    return () => { cancelled = true; };
  }, [flightId, oCode, dCode, departureIso, durationMin, status]);

  useEffect(() => {
    let cancelled = false;
    if (originPt) {
      fetchWeatherSnapshot(
        originPt.latitude,
        originPt.longitude,
        originCity || oCode,
        departureIso,
        oCode,
        originCountry,
      ).then(s => { if (!cancelled) setOriginWx(s); });
    }
    if (destPt) {
      fetchWeatherSnapshot(
        destPt.latitude,
        destPt.longitude,
        destCity || dCode,
        scheduledArrIso || actualArrIso,
        dCode,
        destCountry,
      ).then(s => { if (!cancelled) setDestWx(s); });
    }
    return () => { cancelled = true; };
  }, [
    originPt?.latitude, originPt?.longitude, destPt?.latitude, destPt?.longitude,
    oCode, dCode, originCity, destCity, departureIso, scheduledArrIso, actualArrIso,
    originCountry, destCountry,
  ]);

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
      originPt,
      destPt,
      oCode,
      dCode,
      planeCoord,
      heading,
      routeLineColor(status),
      overlaySegs,
      originWx ? { emoji: wxEmoji(originWx.icon), temp: originWx.temp } : null,
      destWx ? { emoji: wxEmoji(destWx.icon), temp: destWx.temp } : null,
      windDeg,
      compact,
    );
  }, [
    originPt?.latitude, originPt?.longitude, destPt?.latitude, destPt?.longitude,
    oCode, dCode, planeCoord?.latitude, planeCoord?.longitude, heading, status, overlaySegs,
    originWx, destWx, windDeg, compact,
  ]);

  const code = String(airlineCode || '').replace(/[^A-Za-z0-9]/g, '') || airlineCodeFromFlight(flightNumber);
  const num = String(flightNumber || '').replace(/\s+/g, '').toUpperCase();
  const from = String(originCity || '').trim();
  const to = String(destCity || '').trim();
  const cities = from && to && from.toUpperCase() !== to.toUpperCase()
    ? copy.cityToCity(from, to)
    : (from || to);

  const dateIso = scheduledDepIso || departureIso;
  let dateLbl = '';
  if (dateIso) {
    const tz = timezoneForIata(oCode, originCountry);
    const ms = isoInAirportTzToUtcMs(dateIso, oCode, originCountry)
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

  const fadeH = compact ? 72 : 110;
  const w = Dimensions.get('window').width;
  const webRef = useRef<WebView>(null);

  useEffect(() => {
    if (!canMap || Platform.OS === 'web') return;
    const invalidate = () => {
      webRef.current?.injectJavaScript(
        'try{window.__rhMap&&window.__rhMap.invalidateSize(true);}catch(e){} true;',
      );
    };
    invalidate();
    const timers = [80, 250, 600, 1200].map(ms => setTimeout(invalidate, ms));
    return () => timers.forEach(clearTimeout);
  }, [height, html, canMap]);

  return (
    <View style={[st.wrap, { height }]} pointerEvents="none">
      {canMap ? (
        <WebView
          ref={webRef}
          key={`${flightId || flightNumber || 'map'}-${Math.round(height)}`}
          originWhitelist={['*']}
          source={{ html, headers: { 'Accept-Language': 'en-US,en;q=1.0' } }}
          style={[st.map, { height }]}
          javaScriptEnabled
          domStorageEnabled
          scrollEnabled={false}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
          setSupportMultipleWindows={false}
          mixedContentMode="always"
          androidLayerType="hardware"
          injectedJavaScript="setTimeout(function(){try{window.__rhMap&&window.__rhMap.invalidateSize(true);}catch(e){}},180);true;"
        />
      ) : (
        <View style={[st.map, { height, backgroundColor: '#07090f' }]} />
      )}
      {showOverlay ? (
        <>
          <Svg pointerEvents="none" style={st.fade} width={w} height={fadeH}>
            <Defs>
              <LinearGradient id="routeMapFade" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={HERO_BG} stopOpacity="0" />
                <Stop offset="1" stopColor={HERO_BG} stopOpacity="1" />
              </LinearGradient>
            </Defs>
            <Rect width={w} height={fadeH} fill="url(#routeMapFade)" />
          </Svg>
          <View style={st.overlay}>
            <AirlineLogo iata={code} name={airline} size={compact ? 36 : AIRLINE_LOGO_SIZE} preferAirhex />
            <View style={st.overlayText}>
              <Text style={[st.flightLine, compact && st.flightLineCompact]} numberOfLines={1}>
                {num}{dateLbl ? `  ·  ${dateLbl}` : ''}
              </Text>
              {cities ? (
                <Text style={[st.cities, compact && st.citiesCompact]} numberOfLines={1}>{cities}</Text>
              ) : null}
              {showStatusInOverlay ? (
                <Text style={[st.status, { color: statusColor }]} numberOfLines={1}>{statusLabel}</Text>
              ) : null}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#07090f',
    borderRadius: 8,
  },
  map: { flex: 1, width: '100%', backgroundColor: '#07090f' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  overlay: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overlayText: { flex: 1, minWidth: 0 },
  flightLine: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  flightLineCompact: { fontSize: 14 },
  cities: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '600', marginTop: 1 },
  citiesCompact: { fontSize: 11 },
  status: { fontSize: 13, fontWeight: '700', marginTop: 2 },
});
