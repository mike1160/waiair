import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from './lib/i18n';

const HEADER_TOP = Platform.OS === 'web' ? 16 : 54;
const BANNER_H = 56;
const PULSE_MS = 800;

type Props = {
  gate: string;
  mins: number;
  onDismiss: () => void;
};

export default function GateClosingBanner({ gate, mins, onDismiss }: Props) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.6,
          duration: PULSE_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: PULSE_MS / 2,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      try {
        loop.stop();
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, [pulse]);

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Animated.View style={[styles.banner, { opacity: pulse }]}>
        <Pressable
          onPress={onDismiss}
          style={styles.inner}
          accessibilityRole="button"
          accessibilityLabel={t().gateClosesInMin(mins)}
        >
          <Text style={styles.gate}>{gate}</Text>
          <Text style={styles.label}>{t().gateClosesInMin(mins)}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export const GATE_CLOSING_BANNER_HEIGHT = HEADER_TOP + BANNER_H;

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2000,
  },
  banner: {
    backgroundColor: '#C62828',
    paddingTop: HEADER_TOP,
  },
  inner: {
    height: BANNER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 16,
  },
  gate: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  label: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    flexShrink: 1,
  },
});
