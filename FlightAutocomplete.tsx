import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { ArrowsClockwise, Airplane, CaretRight } from 'phosphor-react-native';
import { t } from './lib/i18n';
import { formatRouteHint } from './lib/airportsDb';

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

export type AutocompleteHit = {
  flightNumber: string;
  airline: string;
  from?: string;
  to?: string;
};

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
};

export default function FlightAutocomplete({
  query,
  theme,
  onSelect,
  flush,
}: {
  query: string;
  theme: ThemeBits;
  onSelect: (flightNumber: string) => void;
  flush?: boolean;
}) {
  const [hits, setHits] = useState<AutocompleteHit[]>([]);
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const seq = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setHits([]);
      setBusy(false);
      setVisible(false);
      return;
    }
    const id = ++seq.current;
    setBusy(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `${PROXY}/flights/number/${encodeURIComponent(q.replace(/\s+/g, ''))}/autocomplete`,
        );
        if (id !== seq.current) return;
        if (!res.ok) {
          setHits([]);
          setVisible(false);
          return;
        }
        const data = await res.json();
        const list = (Array.isArray(data) ? data : []).slice(0, 5) as AutocompleteHit[];
        setHits(list);
        setVisible(list.length > 0);
      } catch {
        if (id === seq.current) {
          setHits([]);
          setVisible(false);
        }
      } finally {
        if (id === seq.current) setBusy(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: visible || busy ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [visible, busy, anim]);

  if (!busy && !visible) return null;

  const Card = Platform.OS === 'ios' ? BlurView : View;

  return (
    <Animated.View
      style={[
        styles.wrap,
        flush && styles.wrapFlush,
        {
          opacity: anim,
          transform: [{
            translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }),
          }],
        },
      ]}
      pointerEvents={visible || busy ? 'auto' : 'none'}
    >
      <Card
        intensity={40}
        tint="dark"
        style={[
          styles.card,
          {
            backgroundColor: Platform.OS === 'ios' ? 'rgba(10,22,40,0.92)' : '#12233C',
            borderColor: theme.border,
          },
        ]}
      >
        {busy && hits.length === 0 ? (
          <View style={styles.loading}>
            <ArrowsClockwise size={16} color={theme.accent} />
            <Text style={[styles.loadingTxt, { color: theme.muted }]}>{t().searchingFlights}</Text>
          </View>
        ) : null}
        {hits.map((h, i) => (
          <Pressable
            key={`${h.flightNumber}-${i}`}
            onPress={() => onSelect(h.flightNumber)}
            style={[styles.row, i < hits.length - 1 && { borderBottomColor: theme.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
          >
            <Airplane size={16} color={theme.accent} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[styles.num, { color: theme.text }]}>{h.flightNumber}</Text>
              <Text style={[styles.air, { color: theme.secondary }]} numberOfLines={1}>
                {[h.airline, formatRouteHint(h.from, h.to)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <CaretRight size={16} color={theme.muted} />
          </Pressable>
        ))}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 8,
    zIndex: 20,
  },
  wrapFlush: {
    marginHorizontal: 0,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 14,
  },
  loadingTxt: { fontSize: 12, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  num: { fontSize: 14, fontWeight: '800' },
  air: { fontSize: 11, fontWeight: '500', marginTop: 1 },
});
