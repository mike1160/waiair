/**
 * Kids mode building blocks: the sky behind every screen, the bouncy press, the slow float of a card and a
 * silent looping video. Each one renders its plain child (or nothing) outside kids mode, so the other themes
 * stay exactly as they were.
 */
import { useEffect, useRef, type ReactNode } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  ImageBackground,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useIsKids, useMode } from '../../lib/modeContext';
import { KIDS_ART } from '../../lib/kidsAssets';
import { KIDS_COLORS } from '../../lib/themes';

/** Spring for every kids-mode bounce. */
export const KIDS_SPRING = { tension: 200, friction: 10, useNativeDriver: true } as const;
/** Rounded display face for kids-mode headings (Android falls back to its medium sans). */
export const KIDS_FONT = Platform.OS === 'ios' ? 'Arial Rounded MT Bold' : 'sans-serif-medium';
export const KIDS_NAVY = '#1A1A2E';

/** The sky picture behind a whole screen, washed light (or deep blue for Kids mode's dark variant). */
export function KidsBackground() {
  const { mode, kidsDark } = useMode();
  if (mode !== 'kids') return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <ImageBackground source={KIDS_ART.sky} resizeMode="cover" style={StyleSheet.absoluteFill}>
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: kidsDark ? KIDS_COLORS.overlayDark : KIDS_COLORS.overlayLight },
          ]}
        />
      </ImageBackground>
    </View>
  );
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * A Pressable that grows to 1.08 on touch and springs back. The style and the scale sit on the Pressable
 * itself, so flex and width behave exactly as on a plain Pressable.
 */
export function KidsBounce({
  style,
  children,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      {...rest}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={e => {
        Animated.spring(scale, { toValue: 1.08, ...KIDS_SPRING }).start();
        onPressIn?.(e);
      }}
      onPressOut={e => {
        Animated.spring(scale, { toValue: 1, ...KIDS_SPRING }).start();
        onPressOut?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

function useReduceMotion(): React.MutableRefObject<boolean> {
  const ref = useRef(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(on => { ref.current = !!on; }).catch(() => {});
  }, []);
  return ref;
}

/** Floats its child up and down by 4 pt on a 3 s loop in kids mode; a plain View otherwise. */
export function KidsFloat({ children, style, delayMs = 0 }: { children: ReactNode; style?: StyleProp<ViewStyle>; delayMs?: number }) {
  const kids = useIsKids();
  const y = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    if (!kids) {
      y.setValue(0);
      return undefined;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(y, { toValue: -4, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(y, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const id = setTimeout(() => { if (!reduce.current) loop.start(); }, delayMs);
    return () => { clearTimeout(id); loop.stop(); };
  }, [kids, y, delayMs, reduce]);
  if (!kids) return <View style={style}>{children}</View>;
  return <Animated.View style={[style, { transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

/** A muted, looping, control-less video (the kids-mode animations). */
export function KidsVideo({
  source,
  style,
  loop = true,
  onEnd,
}: {
  source: number;
  style?: StyleProp<ViewStyle>;
  loop?: boolean;
  onEnd?: () => void;
}) {
  const player = useVideoPlayer(source, p => {
    p.loop = loop;
    p.muted = true;
    p.audioMixingMode = 'mixWithOthers';
    p.play();
  });
  useEffect(() => {
    if (!onEnd) return undefined;
    const sub = player.addListener('playToEnd', () => onEnd());
    return () => sub.remove();
  }, [player, onEnd]);
  return (
    <VideoView
      player={player}
      style={style}
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
      pointerEvents="none"
    />
  );
}

/** A gentle wave: rocks its child between -5° and 5° on a 2 s loop (the pilot and the stewardess). */
export function KidsWave({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const turn = useRef(new Animated.Value(0)).current;
  const reduce = useReduceMotion();
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(turn, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(turn, { toValue: 0, duration: 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const id = setTimeout(() => { if (!reduce.current) loop.start(); }, 50);
    return () => { clearTimeout(id); loop.stop(); };
  }, [turn, reduce]);
  const rotate = turn.interpolate({ inputRange: [0, 1], outputRange: ['-5deg', '5deg'] });
  return <Animated.View style={[style, { transform: [{ rotate }] }]}>{children}</Animated.View>;
}
