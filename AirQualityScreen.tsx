import { useEffect, useState } from 'react';
import {
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
const ACCENT = '#C9A84C';

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
  return '#22c55e';
}

function HourChart({ hours }: { hours: WeatherStationHour[] }) {
  if (hours.length < 2) return null;
  const temps = hours.map(h => h.temp);
  const minT = Math.min(...temps);
  const span = Math.max(4, Math.max(...temps) - minT);
  const trackH = 72;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.chart}>
      {hours.map((h, i) => {
        const barH = Math.max(4, Math.round(((h.temp - minT) / span) * trackH));
        return (
          <View key={`${h.time}-${i}`} style={st.col}>
            <Text style={st.colVal} numberOfLines={1}>{h.temp}°</Text>
            <View style={[st.colTrack, { height: trackH }]}>
              <View style={[st.colBar, { height: barH, backgroundColor: barColor(h.temp) }]} />
            </View>
            <Text style={st.colH} numberOfLines={1}>{hourLabel(h.time)}</Text>
          </View>
        );
      })}
    </ScrollView>
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

function wttrUrl(city?: string, lat?: number, lon?: number): string {
  const place = String(city || '').trim();
  if (place) return `https://wttr.in/${encodeURIComponent(place)}?lang=en`;
  if (lat != null && lon != null && Number.isFinite(lat) && Number.isFinite(lon)) {
    return `https://wttr.in/${lat},${lon}?lang=en`;
  }
  return 'https://wttr.in/?lang=en';
}

async function openWeatherApp(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      await Linking.openURL('weather://');
      return;
    } catch { /* fall through */ }
  }
  try {
    await Linking.openURL('https://weather.com');
  } catch { /* ignore */ }
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
  const elev = snap?.elevationM != null ? `${Math.round(snap.elevationM)} m` : '';
  const windDir = windCompass(snap?.windDeg);
  const wind = snap?.windKmh != null
    ? `${snap.windKmh} km/h${windDir ? ` ${windDir}` : ''}${snap.windGustKmh != null ? ` · ${snap.windGustKmh}` : ''}`
    : '';

  const close = () => { haptics.light(); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        <Pressable style={st.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel={copy.close} />
        <View style={st.sheet}>
          <View style={st.head}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={st.title} numberOfLines={1}>
                {title}
                {elev ? <Text style={st.age}>  {elev}</Text> : null}
              </Text>
            </View>
            <TouchableOpacity
              onPress={close}
              style={st.close}
              accessibilityRole="button"
              accessibilityLabel={copy.close}
            >
              <X size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
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
                    <View style={[st.tile, st.aqiTile]}>
                      <Text style={st.tileL}>AQI</Text>
                      <View style={st.aqiRow}>
                        <View style={[st.aqiDot, { backgroundColor: aqiColor(snap.aqi) }]} />
                        <Text style={st.aqiV}>{snap.aqi}{snap.aqiLabel ? ` · ${snap.aqiLabel}` : ''}</Text>
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
                <View style={st.links}>
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      void Linking.openURL(wttrUrl(title, lat, lon));
                    }}
                    accessibilityRole="link"
                    accessibilityLabel={copy.moreWeatherData}
                  >
                    <Text style={st.link}>{copy.moreWeatherData}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { haptics.light(); void openWeatherApp(); }}
                    accessibilityRole="link"
                    accessibilityLabel={copy.openInWeatherApp}
                  >
                    <Text style={st.link}>{copy.openInWeatherApp}</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text style={st.loading}>{copy.updating}</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingTop: 14,
    paddingBottom: Platform.OS === 'web' ? 16 : 8,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 10,
  },
  title: { color: '#fff', fontSize: 20, fontWeight: '700' },
  age: { color: MUTED, fontSize: 11, fontWeight: '500' },
  close: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  body: { paddingHorizontal: 16, paddingBottom: 28 },
  loading: { color: MUTED, fontSize: 13, fontWeight: '500', paddingVertical: 20 },
  hero: { alignItems: 'center', paddingVertical: 10, gap: 2 },
  emoji: { fontSize: 36 },
  heroN: { color: '#fff', fontSize: 48, fontWeight: '200', letterSpacing: -1 },
  heroL: { color: MUTED, fontSize: 13, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 3,
  },
  tileL: {
    color: MUTED, fontSize: 10, fontWeight: '600',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  tileV: { color: '#fff', fontSize: 15, fontWeight: '600' },
  aqiTile: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  aqiRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aqiDot: { width: 7, height: 7, borderRadius: 4 },
  aqiV: { color: '#fff', fontSize: 13, fontWeight: '600' },
  chartTitle: { color: '#fff', fontSize: 13, fontWeight: '700', marginBottom: 10 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, paddingRight: 4 },
  col: { width: 34, alignItems: 'center', gap: 4, flexShrink: 0 },
  colVal: { color: MUTED, fontSize: 10, fontWeight: '600', fontVariant: ['tabular-nums'] },
  colTrack: {
    width: 6, justifyContent: 'flex-end',
    backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden',
  },
  colBar: { width: 6, borderRadius: 3 },
  colH: {
    color: MUTED, fontSize: 9, fontWeight: '500', width: 34,
    textAlign: 'center', fontVariant: ['tabular-nums'],
  },
  links: { alignItems: 'center', gap: 10, marginTop: 22, paddingBottom: 8 },
  link: { color: ACCENT, fontSize: 12, fontWeight: '600' },
});
