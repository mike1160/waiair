import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Airplane, CaretDown, GearSix } from 'phosphor-react-native';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';

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
  firstFlightDate: string | null;
  yearsOld: number | null;
  numFlights: number | null;
};

const GOLD = '#C9A84C';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PLANESPOTTERS_UA = 'WaiAir/1.0 (+https://github.com/mike1160/waiair)';

type SpotterPhoto = { url: string; photographer: string };

function formatFirstFlight(iso?: string | null): string | null {
  const raw = String(iso || '').trim();
  if (!raw) return null;
  const m = raw.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return raw.slice(0, 10);
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`;
}

function yearsFromDate(iso?: string | null): number | null {
  const ms = Date.parse(String(iso || ''));
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / (365.25 * 24 * 60 * 60 * 1000)));
}

function pickNumFlights(json: any): number | null {
  const n = Number(json?.numFlights ?? json?.numberOfFlights ?? json?.flightsCount ?? json?.totalFlights);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

function pickImage(json: any): string | null {
  const img = json?.image || json?.aircraftImage || json?.photo;
  if (!img) return null;
  if (typeof img === 'string') return img;
  return img.url || img.href || img.src || null;
}

function PhotoSkeleton({ color }: { color: string }) {
  const pulse = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <Animated.View style={[styles.spotterSkeleton, { backgroundColor: color, opacity: pulse }]} />;
}

export default function AircraftInfoCard({
  model,
  registration,
  theme,
  onClose,
  onDismiss,
}: {
  model?: string;
  registration?: string;
  theme: ThemeBits;
  onClose?: () => void;
  onDismiss?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<AircraftInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [spotterPhoto, setSpotterPhoto] = useState<SpotterPhoto | null>(null);
  const [spotterLoading, setSpotterLoading] = useState(false);
  const chevron = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('[Planespotters] registration prop on mount:', registration);
  }, [registration]);

  useEffect(() => {
    Animated.timing(chevron, {
      toValue: open ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [open, chevron]);

  useEffect(() => {
    const reg = String(registration || '').replace(/\s+/g, '').toUpperCase();
    if (!reg) {
      setInfo(null);
      return;
    }
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
        const firstFlightDate = formatFirstFlight(json?.firstFlightDate);
        const yearsOld =
          json?.ageYears != null && Number.isFinite(Number(json.ageYears))
            ? Math.max(0, Math.round(Number(json.ageYears)))
            : yearsFromDate(json?.firstFlightDate);
        const age =
          yearsOld != null
            ? `${yearsOld}y`
            : firstFlightDate
              ? `Since ${firstFlightDate.slice(-4)}`
              : null;
        setInfo({
          reg: json?.reg || reg,
          typeName,
          ageYears: age,
          airline: json?.airlineName || json?.airline?.name || '',
          imageUrl: pickImage(json),
          firstFlightDate,
          yearsOld,
          numFlights: pickNumFlights(json),
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
            firstFlightDate: null,
            yearsOld: null,
            numFlights: null,
          });
        }
      })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [registration, model]);

  useEffect(() => {
    const reg = String(registration || '').replace(/\s+/g, '').toUpperCase();
    console.log('[Planespotters] reg:', reg || undefined);
    if (!reg) {
      setSpotterPhoto(null);
      setSpotterLoading(false);
      return;
    }
    let cancelled = false;
    setSpotterLoading(true);
    setSpotterPhoto(null);
    fetch(`https://api.planespotters.net/pub/photos/reg/${encodeURIComponent(reg)}`, {
      headers: { 'User-Agent': PLANESPOTTERS_UA },
    })
      .then(async r => {
        if (!r.ok) throw new Error('no');
        return r.json();
      })
      .then(json => {
        console.log('[Planespotters] result:', JSON.stringify(json));
        if (cancelled) return;
        const hit = json?.photos?.[0];
        const src = hit?.thumbnail_large?.src;
        if (src) {
          setSpotterPhoto({
            url: String(src),
            photographer: String(hit?.photographer || '').trim() || 'Unknown',
          });
        } else {
          setSpotterPhoto(null);
        }
      })
      .catch((err) => {
        console.log('[Planespotters] fetch failed:', err);
        if (!cancelled) setSpotterPhoto(null);
      })
      .finally(() => {
        if (!cancelled) setSpotterLoading(false);
      });
    return () => { cancelled = true; };
  }, [registration]);

  if (!model && !registration) return null;

  const dismiss = () => {
    console.log('close pressed');
    haptics.light();
    setOpen(false);
    onClose?.();
    onDismiss?.();
  };
  const toggle = () => {
    if (open) dismiss();
    else {
      haptics.light();
      setOpen(true);
    }
  };
  const onChevronPress = () => {
    if (open) dismiss();
    else {
      haptics.light();
      setOpen(true);
    }
  };

  const rotate = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.wrap, { borderColor: theme.border }]}>
      <View style={styles.row}>
        <Pressable
          onPress={toggle}
          style={styles.rowMain}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
        >
          <GearSix size={18} color={theme.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.model, { color: theme.text }]}>{model || 'Aircraft'}</Text>
            {(() => {
              const parts: string[] = [];
              if (info?.firstFlightDate) parts.push(t().firstFlight(info.firstFlightDate));
              if (info?.yearsOld != null) parts.push(t().yearsOld(info.yearsOld));
              if (info?.numFlights != null) parts.push(t().flightsFlown(info.numFlights));
              if (!parts.length) return registration ? (
                <Text style={[styles.reg, { color: theme.muted }]}>{registration}</Text>
              ) : null;
              return (
                <Text style={styles.ageLine} numberOfLines={2}>
                  {parts.join(' · ')}
                </Text>
              );
            })()}
          </View>
        </Pressable>
        <Pressable
          onPress={onChevronPress}
          hitSlop={10}
          style={styles.chevronBtn}
          accessibilityRole="button"
          accessibilityLabel={open ? t().close : 'Expand aircraft info'}
          accessibilityState={{ expanded: open }}
        >
          <Animated.View style={{ transform: [{ rotate }] }} pointerEvents="none">
            <CaretDown size={20} color={theme.muted} />
          </Animated.View>
        </Pressable>
      </View>

      {open ? (
        <View style={styles.body}>
          {spotterLoading && registration ? (
            <PhotoSkeleton color={theme.list} />
          ) : spotterPhoto ? (
            <>
              <Image source={{ uri: spotterPhoto.url }} style={styles.spotterPhoto} resizeMode="cover" />
              <Text style={[styles.spotterCredit, { color: theme.muted }]}>
                📸 {spotterPhoto.photographer}
              </Text>
            </>
          ) : (
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
          )}
          {busy ? (
            <Text style={[styles.meta, { color: theme.muted }]}>{t().loadingFleet}</Text>
          ) : (
            <>
              {info?.airline ? (
                <Text style={[styles.meta, { color: theme.secondary }]}>
                  Operator · {info.airline}
                </Text>
              ) : null}
              {info?.ageYears ? (
                <Text style={[styles.meta, { color: theme.muted }]}>{t().ageYears(info.ageYears)}</Text>
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
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  chevronBtn: { padding: 4, alignItems: 'center', justifyContent: 'center' },
  model: { fontSize: 14, fontWeight: '700' },
  ageLine: { color: GOLD, fontSize: 11, fontWeight: '700', marginTop: 3 },
  reg: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  body: { marginTop: 12, gap: 8 },
  spotterPhoto: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  spotterCredit: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: -4,
  },
  spotterSkeleton: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
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
