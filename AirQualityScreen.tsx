import { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X } from 'phosphor-react-native';
import {
  aqiColor,
  fetchWeatherStation,
  windCompass,
  type WeatherKind,
  type WeatherStationHour,
  type WeatherStationSnapshot,
} from './lib/destinationServices';
import { t } from './lib/i18n';
import { haptics } from './lib/haptics';

const BG = '#0B1220';
const MUTED = '#94A3B8';
const GOLD = '#F5A623';

function wxEmoji(kind?: WeatherKind): string {
  switch (kind) {
    case 'sun': return '☀️';
    case 'cloud': return '☁️';
    case 'rain': return '🌧️';
    case 'storm': return '⛈️';
    case 'snow': return '❄️';
    case 'fog': return '🌫️';
    default: return '☁️';
  }
}

function hourLabel(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function barColor(temp: number): string {
  if (temp >= 30) return '#F59E0B';
  if (temp <= 10) return '#38BDF8';
  return '#00C853';
}

function HourChart({ hours }: { hours: WeatherStationHour[] }) {
  if (hours.length < 2) return null;
  const temps = hours.map(h => h.temp);
  const minT = Math.min(...temps);
  const span = Math.max(4, Math.max(...temps) - minT);
  const trackH = 88;
  return (
    <View style={st.chart}>
      {hours.map((h, i) => {
        const barH = Math.max(6, Math.round(((h.temp - minT) / span) * trackH));
        return (
          <View key={`${h.time}-${i}`} style={st.col}>
            <Text style={st.colVal}>{h.temp}°</Text>
            <View style={[st.colTrack, { height: trackH }]}>
              <View style={[st.colBar, { height: barH, backgroundColor: barColor(h.temp) }]} />
            </View>
            <Text style={st.colH}>{hourLabel(h.time)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View style={st.tile}>
      <Text style={st.tileL}>{label}</Text>
      <Text style={st.tileV}>{value}</Text>
    </View>
  );
}

export default function AirQualityScreen({
  visible,
  onClose,
  lat,
  lon,
  city,
}: {
  visible: boolean;
  onClose: () => void;
  lat?: number;
  lon?: number;
  city?: string;
}) {
  const [snap, setSnap] = useState<WeatherStationSnapshot | null>(null);

  useEffect(() => {
    if (!visible || lat == null || lon == null) return;
    let cancelled = false;
    fetchWeatherStation(lat, lon).then(data => {
      if (!cancelled) setSnap(data);
    });
    return () => { cancelled = true; };
  }, [visible, lat, lon]);

  const copy = t();
  const title = snap?.name || city || copy.weatherStation;
  const sub = [snap?.region, snap?.elevationM != null ? `${Math.round(snap.elevationM)} m` : null]
    .filter(Boolean).join(' · ');
  const windDir = windCompass(snap?.windDeg);
  const wind = snap?.windKmh != null
    ? `${snap.windKmh} km/h${windDir ? ` ${windDir}` : ''}${snap.windGustKmh != null ? ` · ${snap.windGustKmh}` : ''}`
    : '';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={st.screen}>
        <View style={st.head}>
          <View style={{ flex: 1 }}>
            <Text style={st.kicker}>{copy.weatherStation}</Text>
            <Text style={st.title} numberOfLines={1}>{title}</Text>
            {sub ? <Text style={st.sub} numberOfLines={1}>{sub}</Text> : null}
          </View>
          <TouchableOpacity
            onPress={() => { haptics.light(); onClose(); }}
            style={st.close}
            accessibilityRole="button"
            accessibilityLabel={copy.close}
          >
            <X size={18} color="#fff" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={st.body}>
          {snap ? (
            <>
              <View style={st.hero}>
                <Text style={st.emoji}>{wxEmoji(snap.icon)}</Text>
                <Text style={st.heroN}>{snap.temp}°</Text>
                <Text style={st.heroL}>{snap.description}</Text>
              </View>
              <View style={st.grid}>
                <Tile label={copy.wxFeelsLike} value={`${snap.feelsLike}°`} />
                <Tile label={copy.wxHumidity} value={`${snap.humidity}%`} />
                {snap.dewPoint != null ? <Tile label={copy.wxDewPoint} value={`${snap.dewPoint}°`} /> : null}
                {wind ? <Tile label={copy.wxWind} value={wind} /> : null}
                {snap.pressureHpa != null ? <Tile label={copy.wxPressure} value={`${snap.pressureHpa} hPa`} /> : null}
                {snap.cloudCover != null ? <Tile label={copy.wxClouds} value={`${snap.cloudCover}%`} /> : null}
                {snap.visibilityKm != null ? <Tile label={copy.wxVisibility} value={`${snap.visibilityKm} km`} /> : null}
                {snap.precipitationMm != null ? <Tile label={copy.wxPrecip} value={`${snap.precipitationMm} mm`} /> : null}
                {snap.aqi != null ? (
                  <View style={st.tile}>
                    <Text style={st.tileL}>AQI</Text>
                    <View style={st.aqiRow}>
                      <View style={[st.aqiDot, { backgroundColor: aqiColor(snap.aqi) }]} />
                      <Text style={st.tileV}>{snap.aqi}{snap.aqiLabel ? ` · ${snap.aqiLabel}` : ''}</Text>
                    </View>
                  </View>
                ) : null}
              </View>
              {snap.hourly.length ? (
                <>
                  <Text style={st.chartTitle}>{copy.wxNext12h}</Text>
                  <HourChart hours={snap.hourly} />
                </>
              ) : null}
            </>
          ) : (
            <Text style={st.sub}>{copy.updating}</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
    paddingTop: Platform.OS === 'web' ? 20 : 16,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  kicker: { color: GOLD, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 20, fontWeight: '800', marginTop: 2 },
  sub: { color: MUTED, fontSize: 13, fontWeight: '600', marginTop: 2 },
  close: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(148,163,184,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 18, gap: 4 },
  emoji: { fontSize: 36 },
  heroN: { color: '#fff', fontSize: 56, fontWeight: '800', letterSpacing: -1 },
  heroL: { color: MUTED, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(148,163,184,0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  tileL: { color: MUTED, fontSize: 11, fontWeight: '700' },
  tileV: { color: '#fff', fontSize: 16, fontWeight: '800' },
  aqiRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  aqiDot: { width: 8, height: 8, borderRadius: 4 },
  chartTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  col: { flex: 1, alignItems: 'center' },
  colVal: { color: MUTED, fontSize: 9, fontWeight: '700', marginBottom: 4 },
  colTrack: { width: '100%', justifyContent: 'flex-end', backgroundColor: 'rgba(148,163,184,0.12)', borderRadius: 4, overflow: 'hidden' },
  colBar: { width: '100%', borderRadius: 4 },
  colH: { color: MUTED, fontSize: 8, fontWeight: '600', marginTop: 4 },
});
