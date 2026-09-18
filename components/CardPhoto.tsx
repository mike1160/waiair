/**
 * Unsplash photo on a card: fades in when it loads, never shifts the layout and always carries its credit.
 * `header` sits at the top of a card (gradient at the bottom for the text on it); `background` fills the card
 * behind existing content, with a flat dark overlay and an optional slow Ken Burns zoom.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { DestinationPhoto } from '../lib/destinationPhoto';

const FADE_MS = 300;
const KEN_BURNS_MS = 8000;
const CREDIT = 'Photo: Unsplash';

type Props = {
  photo: DestinationPhoto | null;
  mode?: 'header' | 'background';
  /** Header only: the photo's height; the card keeps its own height in background mode. */
  height?: number;
  /** Header only: the dark gradient at the bottom, under the text on the photo. */
  gradientHeight?: number;
  /** Background only: flat dark overlay so the existing text stays readable (0.5 = 50%). */
  overlayOpacity?: number;
  /** Background only: slow 1.0 → 1.05 zoom, looping; pass false to hold still (e.g. when a card opens). */
  kenBurns?: boolean;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  /** Text laid over the photo (header mode): label, name. */
  children?: ReactNode;
};

export default function CardPhoto({
  photo,
  mode = 'header',
  height = 140,
  gradientHeight = 60,
  overlayOpacity = 0.5,
  kenBurns = false,
  radius = 16,
  style,
  children,
}: Props) {
  const fade = useRef(new Animated.Value(0)).current;
  const zoom = useRef(new Animated.Value(0)).current;
  const reduceMotion = useRef(false);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(on => { if (alive) reduceMotion.current = !!on; })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    fade.setValue(0);
  }, [photo?.url, fade]);

  useEffect(() => {
    if (!photo?.url || !kenBurns || reduceMotion.current) {
      zoom.stopAnimation();
      return undefined;
    }
    zoom.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(zoom, { toValue: 1, duration: KEN_BURNS_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(zoom, { toValue: 0, duration: KEN_BURNS_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [photo?.url, kenBurns, zoom]);

  if (!photo?.url) return null;

  const scale = zoom.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const wrap = mode === 'background'
    ? [StyleSheet.absoluteFill, { borderRadius: radius, overflow: 'hidden' as const }, style]
    : [{ height, borderTopLeftRadius: radius, borderTopRightRadius: radius, overflow: 'hidden' as const }, style];

  return (
    <View style={wrap} pointerEvents="none">
      <Animated.Image
        source={{ uri: photo.url }}
        resizeMode="cover"
        onLoad={() => {
          Animated.timing(fade, { toValue: 1, duration: FADE_MS, useNativeDriver: true }).start();
        }}
        style={[StyleSheet.absoluteFill, { opacity: fade, transform: [{ scale }] }]}
      />
      {mode === 'background' ? (
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: Animated.multiply(fade, overlayOpacity) }]} />
      ) : (
        <Animated.View style={[styles.gradientWrap, { height: gradientHeight, opacity: fade }]}>
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.75)']} style={StyleSheet.absoluteFill} />
        </Animated.View>
      )}
      {children ? <Animated.View style={[styles.children, { opacity: fade }]}>{children}</Animated.View> : null}
      <Animated.Text style={[styles.credit, { opacity: Animated.multiply(fade, 0.6) }]}>{CREDIT}</Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  gradientWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  children: { position: 'absolute', left: 14, right: 14, bottom: 10 },
  credit: { position: 'absolute', right: 8, bottom: 6, color: '#FFFFFF', fontSize: 10 },
});
