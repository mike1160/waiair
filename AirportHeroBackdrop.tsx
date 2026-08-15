import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';
import { CaretDown } from 'phosphor-react-native';
import {
  fetchWeatherSnapshot,
  localTimeSnapshot,
  type WeatherSnapshot,
} from './lib/destinationServices';
import { formatTempC, getPrefs, subscribePrefs } from './lib/prefs';
import { WeatherGlyph } from './LuxuryInfoPanel';

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
  { x: 0.14, y: 0.72, r: 0.6, o: 0.16 },
  { x: 0.88, y: 0.66, r: 0.7, o: 0.18 },
];

export default function AirportHeroBackdrop({
  iata,
  name,
  city,
  country,
  flag,
  lat,
  lon,
  flightCount,
  boardingCount,
  delayedCount,
  onPressAirport,
  onPressBackground,
}: {
  iata: string;
  name: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
  flightCount: number;
  boardingCount: number;
  delayedCount: number;
  onPressAirport: () => void;
  onPressBackground?: () => void;
}) {
  const [wx, setWx] = useState<WeatherSnapshot | null>(null);
  const [local, setLocal] = useState(() => localTimeSnapshot(iata, country));
  const [, setTick] = useState(0);
  useEffect(() => subscribePrefs(() => setTick(n => n + 1)), []);
  const tempUnit = getPrefs().tempUnit;

  useEffect(() => {
    const id = setInterval(() => setLocal(localTimeSnapshot(iata, country)), 30000);
    setLocal(localTimeSnapshot(iata, country));
    return () => clearInterval(id);
  }, [iata, country]);

  useEffect(() => {
    let cancelled = false;
    fetchWeatherSnapshot(lat, lon, city || iata).then(snap => {
      if (!cancelled) setWx(snap);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [lat, lon, city, iata]);

  const title = name || city || iata;

  return (
    <Pressable style={styles.fill} onPress={onPressBackground} accessibilityRole="button" accessibilityLabel="Expand flight sheet">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 390 844">
        <Defs>
          <LinearGradient id="heroBg" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#05070d" />
            <Stop offset="1" stopColor="#0b1a36" />
          </LinearGradient>
        </Defs>
        <Path d="M0 0 H390 V844 H0 Z" fill="url(#heroBg)" />
        {STARS.map((s, i) => (
          <Circle key={i} cx={s.x * 390} cy={s.y * 844} r={s.r} fill="#ffffff" opacity={s.o} />
        ))}
        <SvgText
          x="195"
          y="420"
          fill="rgba(255,255,255,0.05)"
          fontSize="92"
          fontWeight="800"
          textAnchor="middle"
        >
          {iata}
        </SvgText>
      </Svg>

      <View style={styles.card} pointerEvents="box-none">
        <Pressable onPress={onPressAirport} style={styles.airportBtn} accessibilityRole="button" accessibilityLabel={`${iata}, ${city}. Tap to change airport`}>
          <Text style={styles.flag}>{flag}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={styles.name}
              numberOfLines={1}
              ellipsizeMode="tail"
              adjustsFontSizeToFit
              minimumFontScale={0.55}
              allowFontScaling={false}
            >{iata} · {city || title}</Text>
            <Text style={styles.meta} numberOfLines={1} ellipsizeMode="tail">tap to change</Text>
          </View>
          <CaretDown size={16} color="rgba(255,255,255,0.7)" />
        </Pressable>

        <Text
          style={styles.heroName}
          numberOfLines={1}
          ellipsizeMode="tail"
          adjustsFontSizeToFit
          minimumFontScale={0.55}
          allowFontScaling={false}
        >{title}</Text>
        <Text style={styles.heroMeta} numberOfLines={1}>{iata} · {local.utcOffset}</Text>
        <Text style={styles.count}>{flightCount} flights today</Text>
        <Text style={styles.sub} numberOfLines={1}>
          {boardingCount} boarding · {delayedCount} delayed
        </Text>

        <View style={styles.row}>
          {wx ? (
            <View style={styles.chip}>
              <WeatherGlyph icon={wx.icon} color="#C9A84C" size={16} />
              <Text style={styles.chipTxt} numberOfLines={1}>
                {formatTempC(wx.temp, tempUnit)} · {wx.description}
              </Text>
            </View>
          ) : null}
          <View style={styles.chip}>
            <Text style={styles.chipTxt} numberOfLines={1}>🕐 {local.time} local</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#05070d' },
  card: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 108,
  },
  airportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 18,
  },
  flag: { fontSize: 28 },
  name: { color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.4, minWidth: 0 },
  meta: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600', marginTop: 2 },
  heroName: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.3, marginTop: 4, minWidth: 0 },
  heroMeta: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: '600', marginTop: 2, marginBottom: 12 },
  count: { color: '#fff', fontSize: 18, fontWeight: '800' },
  sub: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600', marginTop: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  chipTxt: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '700' },
});
