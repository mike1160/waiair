import { useEffect, useRef, useState, type ReactNode } from 'react';
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
import Svg, { Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { AirplaneTakeoff, Clipboard, EnvelopeSimple, QrCode } from 'phosphor-react-native';
import { haptics } from './lib/haptics';

const NAVY = '#0D1B2E';
const GOLD = '#C9A84C';
const CARD_H = 160;
const PASS_MS = 3500;
const PAUSE_MS = 4000;

type Props = {
  gmailBusy?: boolean;
  showGmailTrial?: boolean;
  trialLabel: string;
  gmailLabel: string;
  pasteLabel: string;
  scanLabel: string;
  onGmail: () => void;
  onPaste: () => void;
  onScan: () => void;
};

const CLOUD_PATH =
  'M 20,60 Q 5,60 5,45 Q 5,30 20,30 Q 22,18 35,18 Q 45,10 55,18 Q 68,15 72,28 Q 85,25 85,40 Q 90,55 75,60 Z';

function Cloud({
  x,
  y,
  scale,
  opacity,
}: {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}) {
  return (
    <G transform={`translate(${x}, ${y}) scale(${scale})`} opacity={opacity}>
      <Path d={CLOUD_PATH} fill="#FFFFFF" />
    </G>
  );
}

function SkyBackdrop({ width }: { width: number }) {
  const w = Math.max(width, 1);
  return (
    <Svg width={w} height={CARD_H} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="tripExtrasSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0D2137" />
          <Stop offset="1" stopColor="#1A3A5C" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={w} height={CARD_H} fill="url(#tripExtrasSky)" />
      <Cloud x={-28} y={-4} scale={1.55} opacity={0.16} />
      <Cloud x={w * 0.12} y={58} scale={1.3} opacity={0.14} />
      <Cloud x={w - 36} y={-14} scale={1.85} opacity={0.12} />
      <Cloud x={w * 0.36} y={96} scale={1.6} opacity={0.15} />
      <Cloud x={w - 18} y={68} scale={1.35} opacity={0.18} />
    </Svg>
  );
}

function FlyingPlane({ width }: { width: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const fly = () =>
      Animated.timing(progress, {
        toValue: 1,
        duration: PASS_MS,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true,
      });
    const reset = () =>
      Animated.timing(progress, {
        toValue: 0,
        duration: 1,
        useNativeDriver: true,
      });
    const loop = Animated.loop(
      Animated.sequence([
        fly(),
        reset(),
        fly(),
        reset(),
        Animated.delay(PAUSE_MS),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      progress.stopAnimation();
    };
  }, [progress]);

  const x = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [-28, Math.max(width, 200) + 28],
  });
  const y = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [102, 22],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.1, 0.88, 1],
    outputRange: [0, 1, 1, 0],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[st.planeWrap, { opacity, transform: [{ translateX: x }, { translateY: y }, { rotate: '-22deg' }] }]}
    >
      <View style={[st.trail, st.trail3]} />
      <View style={[st.trail, st.trail2]} />
      <View style={[st.trail, st.trail1]} />
      <AirplaneTakeoff size={18} color={GOLD} weight="fill" />
    </Animated.View>
  );
}

function Bubble({
  size,
  offsetY,
  delay,
  bobMs,
  label,
  a11yLabel,
  pill,
  busy,
  onPress,
  children,
}: {
  size: number;
  offsetY: number;
  delay: number;
  bobMs: number;
  label: string;
  a11yLabel?: string;
  pill?: string;
  busy?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const bob = useRef(new Animated.Value(delay === 0 ? -2 : delay > 1500 ? 3 : 1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const face = {
    width: size,
    height: size,
    borderRadius: size / 2,
  };

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -5,
          duration: bobMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 5,
          duration: bobMs,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [bob, bobMs, delay]);

  const tap = () => {
    haptics.light();
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.08, duration: 110, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    onPress();
  };

  return (
    <View style={st.col}>
      <View style={{ transform: [{ translateY: offsetY }] }}>
        <Animated.View style={{ transform: [{ translateY: bob }, { scale }] }}>
          <Pressable
            onPress={tap}
            accessibilityRole="button"
            accessibilityLabel={a11yLabel || label}
            style={[st.dotWrap, face]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView intensity={28} tint="dark" style={[st.dot, face]}>
                {busy ? <ActivityIndicator color={GOLD} /> : children}
              </BlurView>
            ) : (
              <View style={[st.dot, face]}>
                {busy ? <ActivityIndicator color={GOLD} /> : children}
              </View>
            )}
            <View
              pointerEvents="none"
              style={[
                st.insetRing,
                { borderRadius: (size / 2) - 2 },
              ]}
            />
            {pill ? (
              <View style={st.pill} pointerEvents="none">
                <Text style={st.pillTxt}>{pill}</Text>
              </View>
            ) : null}
          </Pressable>
        </Animated.View>
      </View>
      <Text style={st.label}>{label}</Text>
    </View>
  );
}

export default function TripExtrasBubbleRow({
  gmailBusy,
  showGmailTrial,
  trialLabel,
  gmailLabel,
  pasteLabel,
  scanLabel,
  onGmail,
  onPaste,
  onScan,
}: Props) {
  const [width, setWidth] = useState(320);

  return (
    <View
      style={st.card}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      <SkyBackdrop width={width} />
      <FlyingPlane width={width} />
      <View style={st.row}>
        <Bubble
          size={76}
          offsetY={-6}
          delay={0}
          bobMs={3100}
          label={gmailLabel}
          a11yLabel={showGmailTrial ? `${gmailLabel}, ${trialLabel}` : gmailLabel}
          pill={showGmailTrial ? '7d' : undefined}
          busy={gmailBusy}
          onPress={onGmail}
        >
          <EnvelopeSimple size={26} color={GOLD} weight="bold" />
        </Bubble>
        <Bubble
          size={68}
          offsetY={4}
          delay={1100}
          bobMs={2600}
          label={pasteLabel}
          onPress={onPaste}
        >
          <Clipboard size={26} color={GOLD} weight="bold" />
        </Bubble>
        <Bubble
          size={72}
          offsetY={-2}
          delay={1900}
          bobMs={3450}
          label={scanLabel}
          onPress={onScan}
        >
          <QrCode size={26} color={GOLD} weight="bold" />
        </Bubble>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    height: CARD_H,
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
  },
  row: {
    zIndex: 2,
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 6,
  },
  col: {
    width: 96,
    alignItems: 'center',
  },
  planeWrap: {
    position: 'absolute',
    left: 0,
    top: 0,
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  trail: {
    position: 'absolute',
    borderRadius: 99,
    backgroundColor: 'rgba(201,168,76,0.4)',
  },
  trail1: {
    width: 4,
    height: 4,
    left: -8,
    top: 12,
    opacity: 0.7,
  },
  trail2: {
    width: 3.5,
    height: 3.5,
    left: -16,
    top: 16,
    opacity: 0.45,
  },
  trail3: {
    width: 3,
    height: 3,
    left: -24,
    top: 20,
    opacity: 0.25,
  },
  dotWrap: {
    shadowColor: GOLD,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  dot: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(13,27,46,0.85)',
    borderWidth: 1,
    borderColor: GOLD,
  },
  insetRing: {
    position: 'absolute',
    top: 2,
    left: 2,
    right: 2,
    bottom: 2,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
  },
  label: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  pill: {
    position: 'absolute',
    top: -4,
    right: -6,
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    zIndex: 3,
  },
  pillTxt: {
    color: NAVY,
    fontSize: 10,
    fontWeight: '800',
  },
});
