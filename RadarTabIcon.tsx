import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
import { startLoopWhileActive } from './lib/appActivity';
import { radarBlipLottie } from './radarBlipLottie';

export const USE_LOTTIE = true;
const SIZE = 28;
const GOLD = '#C9A84C';
const INACTIVE = 'rgba(255,255,255,0.35)';

const BLIPS = [
  { x: 20, y: 8, at: 0.14 },
  { x: 8, y: 18, at: 0.47 },
  { x: 21, y: 20, at: 0.76 },
] as const;

let LottieView: typeof import('lottie-react-native').default | null = null;
if (USE_LOTTIE) {
  try {
    LottieView = require('lottie-react-native').default;
  } catch {
    LottieView = null;
  }
}

function StaticRadar({ color, blip = true }: { color: string; blip?: boolean }) {
  return (
    <Svg width={SIZE} height={SIZE} viewBox="0 0 28 28">
      <Circle cx={14} cy={14} r={12} stroke={color} strokeWidth={1.1} fill="none" />
      <Circle cx={14} cy={14} r={8} stroke={color} strokeWidth={1.1} fill="none" />
      <Circle cx={14} cy={14} r={4} stroke={color} strokeWidth={1.1} fill="none" />
      <Line x1={14} y1={1.5} x2={14} y2={26.5} stroke={color} strokeWidth={1} />
      <Line x1={1.5} y1={14} x2={26.5} y2={14} stroke={color} strokeWidth={1} />
      {blip ? <Circle cx={20} cy={9} r={1.5} fill={color} /> : null}
    </Svg>
  );
}

function AnimatedRadar() {
  const sweep = useRef(new Animated.Value(0)).current;
  const opacities = useRef(BLIPS.map(() => new Animated.Value(0))).current;
  const rings = useRef(BLIPS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    return startLoopWhileActive(() => {
      sweep.setValue(0);
      opacities.forEach(v => v.setValue(0));
      rings.forEach(v => v.setValue(0));
      const pulse = (i: number) =>
        Animated.sequence([
          Animated.delay(Math.round(3000 * BLIPS[i].at)),
          Animated.parallel([
            Animated.sequence([
              Animated.timing(opacities[i], { toValue: 1, duration: 90, useNativeDriver: true }),
              Animated.timing(opacities[i], { toValue: 0, duration: 620, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            ]),
            Animated.timing(rings[i], {
              toValue: 1,
              duration: 710,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(rings[i], { toValue: 0, duration: 0, useNativeDriver: true }),
        ]);
      return Animated.loop(
        Animated.parallel([
          Animated.timing(sweep, {
            toValue: 1,
            duration: 3000,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
          ...BLIPS.map((_, i) => pulse(i)),
        ]),
      );
    });
  }, [sweep, opacities, rings]);

  const rotate = sweep.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View style={st.box}>
      <StaticRadar color={GOLD} blip={false} />
      <Animated.View
        pointerEvents="none"
        style={[st.sweepWrap, { transform: [{ rotate }] }]}
      >
        <View style={st.arm} />
      </Animated.View>
      {BLIPS.map((b, i) => (
        <Animated.View
          key={i}
          pointerEvents="none"
          style={[
            st.blip,
            {
              left: b.x - 5,
              top: b.y - 5,
              opacity: opacities[i],
            },
          ]}
        >
          <Animated.View
            style={[
              st.ring,
              {
                transform: [{
                  scale: rings[i].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.4, 1.8],
                  }),
                }],
                opacity: rings[i].interpolate({
                  inputRange: [0, 0.2, 1],
                  outputRange: [0.9, 0.6, 0],
                }),
              },
            ]}
          />
          <View style={st.dot} />
        </Animated.View>
      ))}
    </View>
  );
}

function LottieRadar({ onFail }: { onFail: () => void }) {
  const source = useMemo(() => radarBlipLottie(), []);
  if (!LottieView) return null;
  return (
    <LottieView
      source={source}
      autoPlay
      loop
      style={st.box}
      onAnimationFailure={onFail}
    />
  );
}

/**
 * Tracked-tab radar. `focused` is the tab-selected flag
 * (this app has no React Navigation `useIsFocused`).
 */
export default function RadarTabIcon({ focused }: { focused: boolean }) {
  const [lottieFailed, setLottieFailed] = useState(false);
  const useLottie = USE_LOTTIE && !!LottieView && !lottieFailed;

  if (!focused) {
    return (
      <View style={st.box} accessibilityElementsHidden>
        <StaticRadar color={INACTIVE} />
      </View>
    );
  }

  if (useLottie) {
    return (
      <View style={st.box}>
        <LottieRadar onFail={() => setLottieFailed(true)} />
      </View>
    );
  }

  return <AnimatedRadar />;
}

const st = StyleSheet.create({
  box: {
    width: SIZE,
    height: SIZE,
  },
  sweepWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
  },
  arm: {
    width: 1.6,
    height: SIZE / 2 - 1.5,
    marginTop: 1.5,
    borderRadius: 1,
    backgroundColor: GOLD,
  },
  blip: {
    position: 'absolute',
    width: 10,
    height: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: GOLD,
  },
  dot: {
    width: 3.2,
    height: 3.2,
    borderRadius: 1.6,
    backgroundColor: GOLD,
  },
});
