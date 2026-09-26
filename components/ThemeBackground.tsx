/**
 * The decorative layer for the two [P/1] themes that have one: Holographic's slow shimmer and Deep Space's
 * star field. Nothing else changes — no card, no list, no screen is touched, and every other theme renders
 * null here.
 *
 * It is drawn *over* the app rather than under it, the way airport mode's scanlines are
 * (components/ScanlineOverlay.tsx). Under it is not possible: the root screen paints the theme's own
 * background opaquely (App.tsx), and it is not always `theme.bg` — the quick home screen has its own chrome
 * colour — so making those roots transparent would repaint half the app the wrong colour. Faint and
 * untouchable over the top is the same picture and costs nothing.
 *
 * Holographic shimmers with the Animated API on the native driver: one gradient, twice the screen wide,
 * sliding a screen's width in three seconds and looping. Deep Space does not animate at all — a still sky
 * costs nothing to draw, and nothing on this screen needs to twinkle for attention.
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useIsDeepSpace, useIsHolo } from '../lib/modeContext';
import { STARS, STAR_OPACITY } from '../lib/starField';
import { DEEP_SPACE, HOLO } from '../lib/themes';

/** How much of the shimmer is actually visible: enough to catch the eye moving, never enough to read through. */
const SHIMMER_OPACITY = 0.12;
/** Below the scanlines (9000), above the screens. Airport and these themes are never on at the same time. */
const LAYER_Z = 8000;

export default function ThemeBackground() {
  const holo = useIsHolo();
  const deepspace = useIsDeepSpace();
  if (holo) return <HoloShimmer />;
  if (deepspace) return <StarField />;
  return null;
}

/** The iridescent pass: pink into purple into blue, sliding across the near-white background forever. */
function HoloShimmer() {
  const { width } = useWindowDimensions();
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    slide.setValue(0);
    const loop = Animated.loop(
      Animated.timing(slide, {
        toValue: 1,
        duration: HOLO.shimmerMs,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [slide]);

  // Twice as wide as the screen and moved by one screen: the gradient leaves on the left exactly as its copy
  // arrives on the right, so the loop has no seam to see.
  const translateX = slide.interpolate({ inputRange: [0, 1], outputRange: [0, -width] });

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
      <Animated.View
        style={[
          styles.shimmer,
          { width: width * 2, opacity: SHIMMER_OPACITY, transform: [{ translateX }] },
        ]}
      >
        <LinearGradient
          colors={[...HOLO.gradient, ...HOLO.gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

/** The sky: small white dots at fixed places (lib/starField.ts), half transparent, nothing moving. */
function StarField() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
      {STARS.map((s, i) => (
        <View
          key={`star-${i}`}
          style={{
            position: 'absolute',
            left: s.x * width,
            top: s.y * height,
            width: s.size,
            height: s.size,
            borderRadius: s.size / 2,
            backgroundColor: DEEP_SPACE.stars,
            opacity: STAR_OPACITY,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: LAYER_Z },
  shimmer: { position: 'absolute', top: 0, bottom: 0, left: 0 },
});
