import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CaretDown } from 'phosphor-react-native';
import CountryFlagWatermark from './CountryFlagWatermark';
import {
  fetchWeatherSnapshot,
  localTimeSnapshot,
  type WeatherSnapshot,
} from './lib/destinationServices';
import { formatTempC, getPrefs, subscribePrefs } from './lib/prefs';
import { WeatherGlyph } from './LuxuryInfoPanel';
import type { ThemeId } from './lib/themes';

const HEADER_TOP = Platform.OS === 'web' ? 16 : 54;

export default function AirportHeroBackdrop({
  iata,
  city,
  country,
  flag,
  lat,
  lon,
  flightCount,
  delayedCount,
  onPressAirport,
  rightSlot,
  textColor,
  mutedColor,
  accentColor,
  themeId,
}: {
  iata: string;
  name?: string;
  city: string;
  country: string;
  flag: string;
  lat: number;
  lon: number;
  flightCount: number;
  boardingCount?: number;
  delayedCount: number;
  onPressAirport: () => void;
  onPressBackground?: () => void;
  rightSlot?: ReactNode;
  textColor?: string;
  secondaryColor?: string;
  mutedColor?: string;
  accentColor?: string;
  themeId?: ThemeId;
}) {
  const [wx, setWx] = useState<WeatherSnapshot | null>(null);
  const [local, setLocal] = useState(() => localTimeSnapshot(iata, country));
  const [, setTick] = useState(0);
  useEffect(() => subscribePrefs(() => setTick(n => n + 1)), []);
  const tempUnit = getPrefs().tempUnit;
  const text = textColor || '#FFFFFF';
  const muted = mutedColor || 'rgba(255,255,255,0.55)';
  const accent = accentColor || '#C9A84C';

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

  return (
    <View style={styles.wrap}>
      {themeId ? <CountryFlagWatermark themeId={themeId} /> : null}
      <View style={styles.content}>
        <View style={styles.row}>
          <Pressable
            onPress={onPressAirport}
            style={styles.airportBtn}
            accessibilityRole="button"
            accessibilityLabel={`${iata}, ${city}. Tap to change airport`}
          >
            <Text style={styles.flag}>{flag}</Text>
            <Text
              style={[styles.title, { color: text }]}
              numberOfLines={1}
              ellipsizeMode="tail"
              allowFontScaling={false}
            >
              {iata} · {city}
            </Text>
            <CaretDown size={14} color={muted} />
          </Pressable>
          <View style={styles.meta}>
            {wx ? (
              <View style={styles.wx}>
                <WeatherGlyph icon={wx.icon} color={accent} size={14} />
                <Text style={[styles.metaTxt, { color: text }]} allowFontScaling={false}>
                  {formatTempC(wx.temp, tempUnit)}
                </Text>
              </View>
            ) : null}
            <Text style={[styles.metaTxt, { color: text }]} allowFontScaling={false}>
              {local.time}
            </Text>
            {rightSlot}
          </View>
        </View>
        <Text
          style={styles.sub}
          numberOfLines={1}
          allowFontScaling={false}
        >
          <Text style={[styles.flightsTxt, { color: text }]}>{flightCount} flights today · </Text>
          <Text style={styles.delayedTxt}>{delayedCount} delayed</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: HEADER_TOP,
    paddingHorizontal: 16,
    paddingBottom: 4,
    maxHeight: HEADER_TOP + 62,
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 32,
    gap: 8,
  },
  airportBtn: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  flag: { fontSize: 16, flexShrink: 0 },
  title: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  wx: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaTxt: { fontSize: 12, fontWeight: '700' },
  sub: {
    marginTop: 4,
  },
  flightsTxt: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.85,
  },
  delayedTxt: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '800',
  },
});
