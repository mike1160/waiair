import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Airplane, CaretDown, GearSix } from 'phosphor-react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const PROXY = (process.env.EXPO_PUBLIC_PROXY_URL || 'https://waiair-production.up.railway.app').replace(/\/$/, '');

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
  list: string;
  icon: string;
};

type AircraftInfo = {
  reg: string;
  typeName: string;
  ageYears: string | null;
  airline: string;
  imageUrl: string | null;
};

function pickImage(json: any): string | null {
  const img = json?.image || json?.aircraftImage || json?.photo;
  if (!img) return null;
  if (typeof img === 'string') return img;
  return img.url || img.href || img.src || null;
}

export default function AircraftInfoCard({
  model,
  registration,
  theme,
}: {
  model?: string;
  registration?: string;
  theme: ThemeBits;
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<AircraftInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const chevron = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(chevron, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, chevron]);

  useEffect(() => {
    const reg = String(registration || '').replace(/\s+/g, '').toUpperCase();
    if (!open || !reg) return;
    let cancelled = false;
    setBusy(true);
    fetch(`${PROXY}/aircraft/reg/${encodeURIComponent(reg)}`)
      .then(async r => {
        if (!r.ok) throw new Error('no');
        return r.json();
      })
      .then(json => {
        if (cancelled) return;
        const typeName =
          json?.typeName ||
          json?.model ||
          json?.aircraftType?.name ||
          model ||
          'Aircraft';
        const age =
          json?.ageYears != null
            ? `${json.ageYears}y`
            : json?.firstFlightDate
              ? `Since ${String(json.firstFlightDate).slice(0, 4)}`
              : null;
        setInfo({
          reg: json?.reg || reg,
          typeName,
          ageYears: age,
          airline: json?.airlineName || json?.airline?.name || '',
          imageUrl: pickImage(json),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setInfo({
            reg,
            typeName: model || 'Aircraft',
            ageYears: null,
            airline: '',
            imageUrl: null,
          });
        }
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [open, registration, model]);

  if (!model && !registration) return null;

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(v => !v);
  };

  const rotate = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.wrap, { borderColor: theme.border }]}>
      <Pressable onPress={toggle} style={styles.row} accessibilityRole="button">
        <GearSix size={18} color={theme.accent} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.model, { color: theme.text }]}>{model || 'Aircraft'}</Text>
          {registration ? (
            <Text style={[styles.reg, { color: theme.muted }]}>{registration}</Text>
          ) : null}
        </View>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <CaretDown size={20} color={theme.muted} />
        </Animated.View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <View style={[styles.photoCard, { backgroundColor: theme.list }]}>
            {info?.imageUrl ? (
              <Image source={{ uri: info.imageUrl }} style={styles.photo} resizeMode="cover" />
            ) : (
              <View style={styles.photoFallback}>
                <Airplane size={36} color={theme.muted} />
              </View>
            )}
            <View style={styles.photoOverlay}>
              <Text style={styles.photoTitle}>{info?.typeName || model || 'Aircraft'}</Text>
              <Text style={styles.photoReg}>{info?.reg || registration}</Text>
            </View>
          </View>
          {busy ? (
            <Text style={[styles.meta, { color: theme.muted }]}>Loading fleet details…</Text>
          ) : (
            <>
              {info?.airline ? (
                <Text style={[styles.meta, { color: theme.secondary }]}>
                  Operator · {info.airline}
                </Text>
              ) : null}
              {info?.ageYears ? (
                <Text style={[styles.meta, { color: theme.muted }]}>Age · {info.ageYears}</Text>
              ) : null}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  model: { fontSize: 14, fontWeight: '700' },
  reg: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  body: { marginTop: 12, gap: 8 },
  photoCard: {
    height: 140,
    borderRadius: 14,
    overflow: 'hidden',
  },
  photo: { width: '100%', height: '100%' },
  photoFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 12,
    backgroundColor: 'rgba(10,15,30,0.55)',
  },
  photoTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  photoReg: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '600', marginTop: 2 },
  meta: { fontSize: 12, fontWeight: '600' },
});
