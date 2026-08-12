import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');
const REFRESH_MS = 5 * 60 * 1000;

type DelayInfo = {
  level: 'smooth' | 'moderate' | 'major';
  averageDelayMinutes: number;
  message: string;
};

type ThemeBits = {
  text: string;
  muted: string;
  border: string;
  card: string;
};

function styleFor(level: DelayInfo['level']) {
  if (level === 'smooth') return { color: '#34C759', icon: 'checkmark-circle' as const };
  if (level === 'moderate') return { color: '#FF9500', icon: 'warning' as const };
  return { color: '#FF3B30', icon: 'alert-circle' as const };
}

export default function AirportDelayBanner({
  iata,
  theme,
}: {
  iata: string;
  theme: ThemeBits;
}) {
  const [info, setInfo] = useState<DelayInfo | null>(null);
  const fade = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    let cancelled = false;
    const code = String(iata || '').toUpperCase();
    if (!code) { setInfo(null); return; }

    const load = async () => {
      try {
        const res = await fetch(`${PROXY}/airports/${encodeURIComponent(code)}/delays`);
        if (!res.ok) throw new Error('no');
        const json = await res.json();
        if (cancelled) return;
        if (!json?.message) { setInfo(null); return; }
        setInfo({
          level: json.level || 'smooth',
          averageDelayMinutes: json.averageDelayMinutes || 0,
          message: json.message,
        });
      } catch {
        if (!cancelled) setInfo(null);
      }
    };

    load();
    const id = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [iata]);

  useEffect(() => {
    if (!info) {
      fade.setValue(0);
      return;
    }
    Animated.timing(fade, {
      toValue: 1,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [info, fade, pulse]);

  if (!info) return null;
  const s = styleFor(info.level);

  return (
    <Animated.View style={[styles.wrap, { opacity: fade }]}>
      <View style={[styles.pill, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <Animated.View style={[styles.dot, { backgroundColor: s.color, opacity: pulse }]} />
        <Ionicons name={s.icon} size={16} color={s.color} />
        <Text style={[styles.txt, { color: theme.text }]} numberOfLines={1}>
          {info.message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: 16, marginBottom: 10 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  txt: { flex: 1, fontSize: 13, fontWeight: '700' },
});
