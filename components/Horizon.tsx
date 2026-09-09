import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { isAppForeground, runWhileAppActive } from '../lib/appActivity';
import {
  horizonBandHeight,
  resolveHorizonPlaneMode,
  horizonPlaneAction,
  type HorizonBand,
  type HorizonPlaneMode,
} from '../lib/horizon';
import { PALETTE_TOKENS, skyFor, skyForImage, type SkyImageId } from '../lib/themeTokens';

const PLANE_MS = 9000;
const PLANE_GAP_MS = 1000;
const ZOOM_MS = 60_000;
const FADE_MS = 480;
const CLIMB = Math.tan((6 * Math.PI) / 180);
const SKY_SRC: Record<SkyImageId, number> = {
  dawn: require('../assets/sky/dawn.jpg'),
  day: require('../assets/sky/day.jpg'),
  dusk: require('../assets/sky/dusk.jpg'),
  night: require('../assets/sky/night.jpg'),
};

function planeTint(image: SkyImageId): string {
  if (image === 'night') return '#E8EEF6';
  if (image === 'dusk') return '#F4E4C8';
  if (image === 'dawn') return PALETTE_TOKENS.light.navy;
  return PALETTE_TOKENS.light.navy;
}

function AirlinerSilhouette({ color }: { color: string }) {
  return (
    <Svg width={22} height={10} viewBox="0 0 88 40">
      <Path fill={color} d="M12 20 L16 4 L24 8 L20 20 Z" />
      <Path fill={color} d="M8 21 L2 18 L4 24 L12 23 Z" />
      <Path fill={color} d="M10 22 C12 19.5 16 18.5 22 18.5 L60 17.5 C70 17 78 18 86 21 C78 24.5 70 25 60 24.5 L22 23.5 C16 23.5 12 23 10 22 Z" />
      <Path fill={color} d="M40 24 L26 38 L34 38 L54 25 L48 24 Z" />
      <Path fill={color} d="M32 31 C32 28 40 28 40 31 C40 34 32 34 32 31 Z" />
      <Path fill={color} d="M42 29 C42 26.5 49 26.5 49 29 C49 31.5 42 31.5 42 29 Z" />
    </Svg>
  );
}

export default function Horizon({
  isDark,
  collapsed = false,
  band = 'search',
  plane,
  width,
  insetTop,
  forceImage,
}: {
  isDark: boolean;
  collapsed?: boolean;
  band?: HorizonBand;
  plane?: HorizonPlaneMode;
  width: number;
  insetTop: number;
  forceImage?: SkyImageId | null;
}) {
  const systemReduced = useReducedMotion();
  const [a11yReduced, setA11yReduced] = useState(systemReduced);
  const [hour, setHour] = useState(() => new Date().getHours());
  const reduced = systemReduced || a11yReduced;
  const sky = forceImage ? skyForImage(forceImage, isDark) : skyFor(hour, isDark);
  const targetH = horizonBandHeight(insetTop, band, collapsed);
  const decoOn = band === 'tracked' || !collapsed;
  const decoTop = insetTop + 8;
  const tint = planeTint(sky.image);
  const planeMode = resolveHorizonPlaneMode({ plane, band, collapsed });
  const onceArmedRef = useRef(planeMode === 'once');
  const onceConsumedRef = useRef(false);

  const [baseImage, setBaseImage] = useState(sky.image);
  const [incomingImage, setIncomingImage] = useState<SkyImageId | null>(null);
  const incomingRef = useRef<SkyImageId | null>(null);

  const height = useSharedValue(targetH);
  const deco = useSharedValue(decoOn ? 1 : 0);
  const planeX = useSharedValue(-40);
  const zoom = useSharedValue(1);
  const fade = useSharedValue(0);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setA11yReduced);
    AccessibilityInfo.isReduceMotionEnabled().then(setA11yReduced).catch(() => {});
    return () => sub.remove();
  }, []);

  useEffect(() => {
    return runWhileAppActive(() => {
      const tick = () => setHour(new Date().getHours());
      tick();
      const id = setInterval(tick, 30_000);
      return () => clearInterval(id);
    });
  }, []);

  useEffect(() => {
    if (reduced) {
      height.value = targetH;
      deco.value = decoOn ? 1 : 0;
      return;
    }
    height.value = withTiming(targetH, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
    deco.value = withTiming(decoOn ? 1 : 0, { duration: 280 });
  }, [reduced, targetH, decoOn, height, deco]);

  useEffect(() => {
    const shown = incomingRef.current || baseImage;
    if (sky.image === shown) return;
    if (reduced) {
      incomingRef.current = null;
      setIncomingImage(null);
      setBaseImage(sky.image);
      fade.value = 0;
      return;
    }
    incomingRef.current = sky.image;
    setIncomingImage(sky.image);
    fade.value = 0;
    const next = sky.image;
    fade.value = withTiming(1, { duration: FADE_MS }, finished => {
      if (!finished) return;
      runOnJS(commitFade)(next);
    });
  }, [sky.image, reduced, baseImage, fade]);

  function commitFade(next: SkyImageId) {
    setBaseImage(next);
    incomingRef.current = null;
    setIncomingImage(null);
    fade.value = 0;
  }

  useEffect(() => {
    const stop = () => {
      cancelAnimation(planeX);
      cancelAnimation(zoom);
    };
    const start = () => {
      stop();
      const foreground = isAppForeground();
      const action = horizonPlaneAction({
        mode: planeMode,
        reduced,
        foreground,
        onceArmed: onceArmedRef.current,
        onceConsumed: onceConsumedRef.current,
      });
      const allowZoom = !reduced && foreground && decoOn;
      if (allowZoom) {
        zoom.value = 1;
        zoom.value = withRepeat(
          withTiming(1.05, { duration: ZOOM_MS, easing: Easing.inOut(Easing.quad) }),
          -1,
          true,
        );
      } else {
        zoom.value = 1;
      }

      const w = Math.max(width, 1);
      if (action === 'hide') {
        planeX.value = -40;
        return;
      }
      if (action === 'hold') return;
      if (action === 'once') {
        onceConsumedRef.current = true;
        planeX.value = -40;
        planeX.value = withTiming(w + 48, {
          duration: PLANE_MS,
          easing: Easing.inOut(Easing.cubic),
        });
        return;
      }
      planeX.value = -40;
      planeX.value = withRepeat(
        withSequence(
          withTiming(w + 48, { duration: PLANE_MS, easing: Easing.inOut(Easing.cubic) }),
          withDelay(PLANE_GAP_MS, withTiming(-40, { duration: 1 })),
        ),
        -1,
        false,
      );
    };

    start();
    const sub = AppState.addEventListener('change', next => {
      if (isAppForeground(next)) start();
      else stop();
    });
    return () => {
      sub.remove();
      stop();
    };
  }, [reduced, decoOn, width, planeMode, planeX, zoom]);

  const bandStyle = useAnimatedStyle(() => ({
    height: height.value,
  }));
  const decoStyle = useAnimatedStyle(() => ({
    opacity: deco.value,
  }));
  const zoomStyle = useAnimatedStyle(() => ({
    transform: [{ scale: zoom.value }],
  }));
  const incomingStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
  }));
  const planeStyle = useAnimatedStyle(() => {
    const x = planeX.value;
    return {
      transform: [
        { translateX: x },
        { translateY: -x * CLIMB },
        { rotate: '-6deg' },
      ],
    };
  });

  const overlayColors = [...sky.overlay.colors] as [string, string, ...string[]];
  const overlayLocations = [...sky.overlay.locations] as [number, number, ...number[]];

  return (
    <Animated.View
      style={[styles.band, bandStyle]}
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
        <Animated.View style={[styles.fill, zoomStyle]}>
          <Image source={SKY_SRC[baseImage]} style={styles.fill} resizeMode="cover" />
          {incomingImage ? (
            <Animated.Image
              source={SKY_SRC[incomingImage]}
              style={[styles.fill, incomingStyle]}
              resizeMode="cover"
            />
          ) : null}
          {sky.dim > 0 ? (
            <View style={[styles.fill, { backgroundColor: `rgba(0,0,0,${sky.dim})` }]} />
          ) : null}
        </Animated.View>
        <LinearGradient
          colors={overlayColors}
          locations={overlayLocations}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
        <Animated.View style={[styles.deco, { top: decoTop }, decoStyle]}>
          <Animated.View style={[styles.plane, planeStyle]}>
            <LinearGradient
              colors={['transparent', tint]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.trail}
            />
            <View style={styles.planeIcon}>
              <AirlinerSilhouette color={tint} />
            </View>
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  band: {
    overflow: 'hidden',
  },
  fill: { ...StyleSheet.absoluteFill },
  deco: { ...StyleSheet.absoluteFill },
  plane: {
    position: 'absolute',
    top: 56,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trail: {
    width: 52,
    height: 1.5,
    marginRight: -1,
    opacity: 0.45,
  },
  planeIcon: {
    opacity: 0.65,
  },
});
