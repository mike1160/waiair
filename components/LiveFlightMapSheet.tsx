import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../lib/i18n';
import {
  interpolatePosition,
  LIVE_MAP_POLL_MS,
  positionFromCoords,
  type MapPosition,
} from '../lib/liveMapPosition';
import { arcLatLngSamples, toPt } from '../lib/routeMapHtml';
import { PALETTE_TOKENS } from '../lib/themeTokens';

export type LiveFlightMapSheetProps = {
  visible: boolean;
  onClose: () => void;
  isPro: boolean;
  liveAllowed: boolean;
  originIata: string;
  destIata: string;
  originLabel?: string;
  destLabel?: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  liveLat?: number;
  liveLng?: number;
  headingDeg?: number;
  onUpgrade?: () => void;
  /** Called while the sheet is open (Pro + live allowed). Parent should refresh position. */
  onPollLive?: () => void;
};

export default function LiveFlightMapSheet({
  visible,
  onClose,
  isPro,
  liveAllowed,
  originIata,
  destIata,
  originLabel,
  destLabel,
  originLat,
  originLon,
  destLat,
  destLon,
  liveLat,
  liveLng,
  headingDeg,
  onUpgrade,
  onPollLive,
}: LiveFlightMapSheetProps) {
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme();
  const pal = scheme === 'light' ? PALETTE_TOKENS.light : PALETTE_TOKENS.dark;
  const copy = t();
  const origin = toPt(originLat, originLon);
  const dest = toPt(destLat, destLon);
  const liveEnabled = isPro && liveAllowed;
  const target = liveEnabled ? positionFromCoords(liveLat, liveLng, headingDeg) : null;

  const fromRef = useRef<MapPosition | null>(null);
  const [display, setDisplay] = useState<MapPosition | null>(target);

  useEffect(() => {
    if (!visible || !liveEnabled) {
      fromRef.current = null;
      setDisplay(target);
      return;
    }
    const from = fromRef.current || target;
    const to = target;
    fromRef.current = to;
    if (!to || !from) {
      setDisplay(to);
      return;
    }
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const p = Math.min(1, (Date.now() - start) / LIVE_MAP_POLL_MS);
      setDisplay(interpolatePosition(from, to, p));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, liveEnabled, target?.latitude, target?.longitude, target?.heading]);

  useEffect(() => {
    if (!visible || !liveEnabled || !onPollLive) return;
    onPollLive();
    const id = setInterval(onPollLive, LIVE_MAP_POLL_MS);
    return () => clearInterval(id);
  }, [visible, liveEnabled, onPollLive]);

  const route = useMemo(() => {
    if (!origin || !dest) return [];
    return arcLatLngSamples(origin.latitude, origin.longitude, dest.latitude, dest.longitude).map(([latitude, longitude]) => ({
      latitude,
      longitude,
    }));
  }, [origin?.latitude, origin?.longitude, dest?.latitude, dest?.longitude]);

  const region = useMemo(() => {
    if (!origin || !dest) return null;
    const lats = [origin.latitude, dest.latitude];
    const lons = [origin.longitude, dest.longitude];
    if (display) {
      lats.push(display.latitude);
      lons.push(display.longitude);
    }
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLon + maxLon) / 2,
      latitudeDelta: Math.max(4, (maxLat - minLat) * 1.6 + 2),
      longitudeDelta: Math.max(4, (maxLon - minLon) * 1.6 + 2),
    };
  }, [origin, dest, display]);

  const banner = !isPro
    ? copy.liveMapUpgrade
    : !liveAllowed
      ? copy.liveMapCapped
      : null;

  if (Platform.OS === 'web') return null;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={copy.close} />
        <View style={[styles.sheet, { backgroundColor: pal.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.handle, { backgroundColor: pal.textMuted }]} />
          <View style={styles.header}>
            <Text style={[styles.title, { color: pal.text }]}>
              {originIata} → {destIata}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={copy.close}>
              <Text style={[styles.close, { color: pal.gold }]}>{copy.close}</Text>
            </Pressable>
          </View>
          {banner ? (
            <Pressable
              onPress={isPro ? undefined : onUpgrade}
              style={[styles.banner, { backgroundColor: pal.goldLight }]}
              accessibilityRole={isPro ? 'text' : 'button'}
              accessibilityLabel={banner}
            >
              <Text style={[styles.bannerTxt, { color: pal.text }]}>{banner}</Text>
            </Pressable>
          ) : null}
          <View style={styles.mapBox}>
            {region ? (
              <MapView style={StyleSheet.absoluteFill} initialRegion={region} mapType="standard">
                {route.length > 1 ? (
                  <Polyline coordinates={route} strokeColor={pal.gold} strokeWidth={3} />
                ) : null}
                {origin ? (
                  <Marker coordinate={origin} anchor={{ x: 0.5, y: 1 }} title={originLabel || originIata}>
                    <View style={[styles.apt, { backgroundColor: pal.gold }]}>
                      <Text style={styles.aptTxt}>{originIata}</Text>
                    </View>
                  </Marker>
                ) : null}
                {dest ? (
                  <Marker coordinate={dest} anchor={{ x: 0.5, y: 1 }} title={destLabel || destIata}>
                    <View style={[styles.apt, { backgroundColor: pal.text }]}>
                      <Text style={[styles.aptTxt, { color: pal.card }]}>{destIata}</Text>
                    </View>
                  </Marker>
                ) : null}
                {liveEnabled && display ? (
                  <Marker
                    coordinate={display}
                    anchor={{ x: 0.5, y: 0.5 }}
                    rotation={display.heading}
                    flat
                    title={copy.live}
                  >
                    <Text style={styles.plane}>✈</Text>
                  </Marker>
                ) : null}
              </MapView>
            ) : (
              <View style={[styles.empty, { backgroundColor: pal.bg }]}>
                <Text style={{ color: pal.textMuted }}>{copy.liveMapUnavailable}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingTop: 8, maxHeight: '88%' },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    marginBottom: 8,
  },
  title: { fontSize: 18, fontWeight: '800' },
  close: { fontSize: 15, fontWeight: '700' },
  banner: { marginHorizontal: 16, marginBottom: 10, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  bannerTxt: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  mapBox: { height: 420, marginHorizontal: 12, borderRadius: 16, overflow: 'hidden' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  apt: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  aptTxt: { color: '#fff', fontWeight: '800', fontSize: 11 },
  plane: { fontSize: 26 },
});
