import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

type Props = {
  onComplete: () => void;
};

export default function LandedStampOverlay({ onComplete }: Props) {
  const scale = useRef(new Animated.Value(2)).current;
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const slam = Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        speed: 22,
        bounciness: 7,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 150,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);

    slam.start(({ finished }) => {
      if (!finished || cancelled) return;
      holdTimer = setTimeout(() => {
        if (cancelled) return;
        Animated.timing(opacity, {
          toValue: 0,
          duration: 450,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }).start(({ finished: fadeDone }) => {
          if (fadeDone && !cancelled) onComplete();
        });
      }, 2000);
    });

    return () => {
      cancelled = true;
      if (holdTimer) clearTimeout(holdTimer);
      slam.stop();
    };
  }, [scale, opacity, onComplete]);

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        style={[
          styles.stamp,
          {
            opacity,
            transform: [{ scale }, { rotate: '-15deg' }],
          },
        ]}
      >
        <Text style={styles.arc}>LANDED</Text>
        <Text style={styles.check}>✓</Text>
      </Animated.View>
    </View>
  );
}

const STAMP = 88;

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  stamp: {
    width: STAMP,
    height: STAMP,
    borderRadius: STAMP / 2,
    borderWidth: 3,
    borderColor: '#2E7D32',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(46, 125, 50, 0.06)',
  },
  arc: {
    position: 'absolute',
    top: 16,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.2,
    color: '#2E7D32',
  },
  check: {
    fontSize: 38,
    fontWeight: '900',
    color: '#2E7D32',
    lineHeight: 42,
    marginTop: 6,
  },
});
