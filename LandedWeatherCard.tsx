import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { WeatherGlyph } from './LuxuryInfoPanel';
import {
  fetchWeatherSnapshot,
  type WeatherSnapshot,
} from './lib/destinationServices';
import { formatTempC, getPrefs } from './lib/prefs';
import { t } from './lib/i18n';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  card: string;
  border: string;
};

type Props = {
  destLat?: number;
  destLon?: number;
  city: string;
  arrivalIso?: string;
  theme: ThemeBits;
};

export default function LandedWeatherCard({
  destLat,
  destLon,
  city,
  arrivalIso,
  theme,
}: Props) {
  const [wx, setWx] = useState<WeatherSnapshot | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const tempUnit = getPrefs().tempUnit;

  useEffect(() => {
    if (destLat == null || destLon == null) return;
    let cancelled = false;
    fetchWeatherSnapshot(destLat, destLon, city, arrivalIso).then(snap => {
      if (!cancelled) setWx(snap);
    });
    return () => {
      try {
        cancelled = true;
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, [destLat, destLon, city, arrivalIso]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.08,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
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
  }, [pulse]);

  if (!wx) return null;

  const temp = formatTempC(wx.temp, tempUnit);
  const feels = formatTempC(wx.feelsLike, tempUnit);

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Animated.View style={[styles.iconWrap, { transform: [{ scale: pulse }] }]}>
        <WeatherGlyph icon={wx.icon} color={theme.accent} size={48} />
      </Animated.View>
      <View style={styles.body}>
        <Text style={[styles.temp, { color: theme.text }]}>{temp}</Text>
        <Text style={[styles.line, { color: theme.text }]} numberOfLines={2}>
          {t().nowInCityWeather(city, temp, wx.description)}
        </Text>
        <Text style={[styles.sub, { color: theme.secondary }]} numberOfLines={2}>
          {t().feelsLikeHumidity(feels, wx.humidity)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  iconWrap: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: { flex: 1, minWidth: 0, gap: 4 },
  temp: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8 },
  line: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  sub: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
});
