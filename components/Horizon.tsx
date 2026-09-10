import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { isAppForeground, runWhileAppActive } from '../lib/appActivity';
import {
  COLLAPSED_BAND,
  EXPANDED_BAND,
  horizonParkedX,
  horizonPlaneAction,
  horizonShowAliveDecor,
  horizonTrackedHeight,
  resolveHorizonPlaneMode,
  type HorizonBand,
  type HorizonPlaneMode,
} from '../lib/horizon';
import {
  HOME_CONFIRM_DIM,
  HOME_CONFIRM_MS,
  HOME_CONFIRM_TAKEOFF_DEG,
  homeConfirmDim,
  homeConfirmLocksPlane,
  homeConfirmShowGreet,
  type HomeConfirmState,
} from '../lib/homeConfirm';
import { PALETTE_TOKENS, skyChromeTint, skyFor, skyForImage, type SkyImageId } from '../lib/themeTokens';
import {
  HOME_EMPTY_CRUISE_GAP_MS,
  HOME_EMPTY_PLANE_MS,
  homeEmptyShowGlow,
  homeEmptyShowMoon,
  homeEmptyShowStars,
  homeEmptyStarSeed,
  homeEmptyStars,
  moonPhase,
  moonShadowDx,
} from '../lib/homeEmptyAlive';

const PLANE_MS = HOME_EMPTY_PLANE_MS;
const TRACKED_PLANE_GAP_MS = 1000;
const PLANE_TOP = 56;
const PLANE_CLIMB = Math.tan((6 * Math.PI) / 180);
const TRAIL_W = 52;
const TRAIL_STROKE = 1.5;
/** Nose + contrail fully left of the band before the crossing starts. */
const PLANE_OFFSCREEN_X = -(TRAIL_W + 48);

function localYmd(now = Date.now()): string {
  const d = new Date(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const ZOOM_MS = 60_000;
const FADE_MS = 480;
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

function TwinkleStar({
  left,
  top,
  size,
  color,
}: {
  left: number;
  top: number;
  size: number;
  color: string;
}) {
  const op = useSharedValue(0.22);
  useEffect(() => {
    op.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(op);
  }, [op]);
  const st = useAnimatedStyle(() => ({ opacity: op.value }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left,
          top,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        st,
      ]}
    />
  );
}

function SkyDecor({
  width,
  height,
  image,
  reduced,
}: {
  width: number;
  height: number;
  image: SkyImageId;
  reduced: boolean;
}) {
  const stars = useMemo(() => homeEmptyStars(homeEmptyStarSeed(localYmd())), []);
  const phase = useMemo(() => moonPhase(), []);
  const showStars = homeEmptyShowStars(image);
  const showMoon = homeEmptyShowMoon(image) && phase.illumination >= 0.02;
  const showGlow = homeEmptyShowGlow(image);
  const starColor = '#F7F5F0';
  const moonR = 7;
  const shadowDx = moonShadowDx(phase.illumination, phase.waxing, moonR);
  const moonShadow = '#06121C';
  const skyH = Math.max(height - 16, 1);
  const glowId = `cityGlow-${image}`;
  const moonLeft = width * 0.68 - moonR * 2;
  const moonTop = Math.max(12, height * 0.08);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {showGlow ? (
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient
              id={glowId}
              cx={width / 2}
              cy={height}
              rx={width * 0.2}
              ry={height * 0.5}
              fx={width / 2}
              fy={height}
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#E88C3C" stopOpacity="0.12" />
              <Stop offset="1" stopColor="#E88C3C" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill={`url(#${glowId})`} />
        </Svg>
      ) : null}
      {showStars ? (
        <>
          <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
            {stars.filter(s => reduced || !s.twinkle).map((s, i) => (
              <Circle
                key={i}
                cx={s.x * width}
                cy={8 + s.y * skyH}
                r={s.size / 2}
                fill={s.bright ? '#FFFFFF' : starColor}
                opacity={s.bright ? 1 : 0.85}
              />
            ))}
          </Svg>
          {!reduced
            ? stars.filter(s => s.twinkle).map((s, i) => (
              <TwinkleStar
                key={`t-${i}`}
                left={s.x * width - s.size / 2}
                top={8 + s.y * skyH - s.size / 2}
                size={s.size}
                color={s.bright ? '#FFFFFF' : starColor}
              />
            ))
            : null}
        </>
      ) : null}
      {showMoon ? (
        <View style={[styles.moon, { left: moonLeft, top: moonTop, opacity: 0.8 }]}>
          <Svg width={moonR * 4} height={moonR * 4}>
            <Circle cx={moonR * 2} cy={moonR * 2} r={moonR} fill="#F4EED8" />
            <Circle cx={moonR * 2 + shadowDx} cy={moonR * 2} r={moonR} fill={moonShadow} />
          </Svg>
        </View>
      ) : null}
    </View>
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
  collapseDurationMs = 420,
  confirm = 'idle',
  greetText,
}: {
  isDark: boolean;
  collapsed?: boolean;
  collapseDurationMs?: number;
  band?: HorizonBand;
  plane?: HorizonPlaneMode;
  width: number;
  insetTop: number;
  forceImage?: SkyImageId | null;
  confirm?: HomeConfirmState;
  greetText?: string;
}) {
  const systemReduced = useReducedMotion();
  const [a11yReduced, setA11yReduced] = useState(systemReduced);
  const [hour, setHour] = useState(() => new Date().getHours());
  const reduced = systemReduced || a11yReduced;
  const sky = forceImage ? skyForImage(forceImage, isDark) : skyFor(hour, isDark);
  const isTracked = band === 'tracked';
  const showAliveDecor = horizonShowAliveDecor(band);
  const locksPlane = homeConfirmLocksPlane(confirm);
  const chrome = skyChromeTint(sky);
  const expandedH = insetTop + EXPANDED_BAND;
  const collapsedH = insetTop + COLLAPSED_BAND;
  const trackedH = horizonTrackedHeight(insetTop);
  const targetH = isTracked ? trackedH : (collapsed ? collapsedH : expandedH);
  const decoOn = isTracked || !collapsed;
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
  const planeX = useSharedValue(PLANE_OFFSCREEN_X);
  const parked = useSharedValue(0);
  const liftY = useSharedValue(0);
  const nose = useSharedValue(0);
  const takeoffOn = useSharedValue(0);
  const extraDim = useSharedValue(0);
  const greetOp = useSharedValue(0);
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
    const to = isTracked ? trackedH : (collapsed ? collapsedH : expandedH);
    const decoTo = isTracked || !collapsed ? 1 : 0;
    if (reduced) {
      height.value = to;
      deco.value = decoTo;
      return;
    }
    const ms = Math.max(0, collapseDurationMs);
    height.value = withTiming(to, {
      duration: ms,
      easing: Easing.out(Easing.cubic),
    });
    deco.value = withTiming(decoTo, { duration: Math.min(ms, 280) });
  }, [collapsed, collapseDurationMs, reduced, expandedH, collapsedH, trackedH, isTracked, height, deco]);

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

  useEffect(() => {
    const dimTo = homeConfirmDim(confirm) ? HOME_CONFIRM_DIM : 0;
    const greetTo = homeConfirmShowGreet(confirm) ? 1 : 0;
    if (reduced) {
      extraDim.value = dimTo;
      greetOp.value = greetTo;
      return;
    }
    extraDim.value = withTiming(dimTo, { duration: HOME_CONFIRM_MS.dim });
    greetOp.value = withTiming(greetTo, {
      duration: greetTo ? HOME_CONFIRM_MS.greet : 180,
    });
  }, [confirm, reduced, extraDim, greetOp]);

  function commitFade(next: SkyImageId) {
    setBaseImage(next);
    incomingRef.current = null;
    setIncomingImage(null);
    fade.value = 0;
  }

  useEffect(() => {
    let cancelled = false;
    let raf = 0;
    let cruiseGap: ReturnType<typeof setTimeout> | null = null;
    let ready = false;

    const clearCruiseGap = () => {
      if (cruiseGap != null) {
        clearTimeout(cruiseGap);
        cruiseGap = null;
      }
    };

    const stop = () => {
      clearCruiseGap();
      cancelAnimation(planeX);
      cancelAnimation(zoom);
    };

    const scheduleNextCruise = () => {
      if (cancelled) return;
      clearCruiseGap();
      cruiseGap = setTimeout(() => {
        cruiseGap = null;
        startCruisePass();
      }, isTracked ? TRACKED_PLANE_GAP_MS : HOME_EMPTY_CRUISE_GAP_MS);
    };

    function startCruisePass() {
      if (cancelled || reduced || !isAppForeground() || !decoOn) return;
      const w = Math.max(width, 1);
      planeX.value = PLANE_OFFSCREEN_X;
      planeX.value = withTiming(w + 48, {
        duration: PLANE_MS,
        easing: Easing.inOut(Easing.cubic),
      }, finished => {
        if (!finished || cancelled) return;
        planeX.value = PLANE_OFFSCREEN_X;
        runOnJS(scheduleNextCruise)();
      });
    }

    const start = () => {
      stop();
      if (locksPlane) {
        cancelAnimation(zoom);
        zoom.value = 1;
        if (confirm === 'takeoff' && !reduced) {
          const w = Math.max(width, 1);
          const x = planeX.value;
          if (x < 8 || x > w - 24) {
            planeX.value = Math.round(w * 0.32);
          }
          parked.value = 0;
          takeoffOn.value = 1;
          liftY.value = withTiming(-(targetH + 28), {
            duration: HOME_CONFIRM_MS.takeoff,
            easing: Easing.in(Easing.cubic),
          });
          nose.value = withTiming(-HOME_CONFIRM_TAKEOFF_DEG, { duration: 140 });
          return;
        }
        parked.value = 0;
        return;
      }
      takeoffOn.value = 0;
      liftY.value = 0;
      nose.value = 0;
      if (!isTracked) {
        if (reduced || !isAppForeground() || collapsed) {
          zoom.value = 1;
          return;
        }
        zoom.value = 1;
        zoom.value = withRepeat(
          withTiming(1.05, { duration: ZOOM_MS, easing: Easing.inOut(Easing.quad) }),
          -1,
          true,
        );
        startCruisePass();
        return;
      }
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
        planeX.value = PLANE_OFFSCREEN_X;
        parked.value = 0;
        return;
      }
      if (action === 'park') {
        parked.value = 1;
        planeX.value = horizonParkedX(w);
        return;
      }
      parked.value = 0;
      if (action === 'hold') return;
      if (action === 'once') {
        onceConsumedRef.current = true;
        planeX.value = PLANE_OFFSCREEN_X;
        planeX.value = withTiming(w + 48, {
          duration: PLANE_MS,
          easing: Easing.inOut(Easing.cubic),
        });
        return;
      }
      startCruisePass();
    };

    ready = true;
    raf = requestAnimationFrame(() => {
      if (!cancelled) start();
    });

    const sub = AppState.addEventListener('change', next => {
      if (!ready) return;
      if (isAppForeground(next)) start();
      else stop();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      sub.remove();
      stop();
    };
  }, [reduced, collapsed, isTracked, decoOn, width, planeMode, confirm, locksPlane, targetH, planeX, parked, zoom, liftY, nose, takeoffOn]);

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
    const isParked = parked.value === 1;
    const lifting = takeoffOn.value === 1;
    return {
      transform: [
        { translateX: x },
        { translateY: (isParked && !lifting ? 8 : -x * PLANE_CLIMB) + liftY.value },
        { rotate: lifting ? `${nose.value}deg` : (isParked ? '0deg' : '-6deg') },
      ],
    };
  });
  const trailStyle = useAnimatedStyle(() => ({
    opacity: parked.value === 1 || takeoffOn.value === 1 ? 0 : 0.45,
  }));
  const dimStyle = useAnimatedStyle(() => ({
    opacity: extraDim.value,
  }));
  const greetStyle = useAnimatedStyle(() => ({
    opacity: greetOp.value,
  }));

  const overlayColors = [...sky.overlay.colors] as [string, string, ...string[]];
  const overlayLocations = [...sky.overlay.locations] as [number, number, ...number[]];
  const shownImage = incomingImage || baseImage;
  const decoH = Math.max(1, targetH - decoTop);

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
          <Animated.View
            style={[styles.fill, { backgroundColor: '#000' }, dimStyle]}
            pointerEvents="none"
          />
        </Animated.View>
        <LinearGradient
          colors={overlayColors}
          locations={overlayLocations}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fill}
        />
        <Animated.View style={[styles.deco, { top: decoTop }, decoStyle]}>
          {showAliveDecor ? (
            <SkyDecor
              width={width}
              height={decoH}
              image={shownImage}
              reduced={reduced}
            />
          ) : null}
          <Animated.View
            style={[
              styles.plane,
              planeStyle,
            ]}
          >
            <Animated.View style={[styles.trail, trailStyle]}>
              <LinearGradient
                colors={['transparent', tint]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
            <View style={styles.planeIcon}>
              <AirlinerSilhouette color={tint} />
            </View>
          </Animated.View>
          {greetText ? (
            <Animated.Text
              style={[
                styles.greet,
                { color: chrome, top: Math.max(20, insetTop * 0.15 + 28) },
                greetStyle,
              ]}
            >
              {greetText}
            </Animated.Text>
          ) : null}
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
    top: PLANE_TOP,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trail: {
    width: TRAIL_W,
    height: TRAIL_STROKE,
    marginRight: -1,
  },
  planeIcon: {
    opacity: 0.65,
  },
  moon: { position: 'absolute' },
  greet: {
    position: 'absolute',
    left: 24,
    right: 24,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
});
