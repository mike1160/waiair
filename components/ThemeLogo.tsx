/**
 * The brand mark in the current mode. Airport: "WAIAIR" in yellow monospace, spaced like a board.
 * Kids: a small airplane tile and "WaiAir ✈️" in coral, with a little bounce when it appears.
 * Day and Night keep the app as it was (nothing extra), so existing screens are unchanged.
 */
import { useEffect, useRef } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';
import { useMode } from '../lib/modeContext';
import { KIDS_ART } from '../lib/kidsAssets';
import { MONO } from '../lib/themes';

const KIDS_CORAL = '#FF6B6B';

export default function ThemeLogo() {
  const { mode } = useMode();
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (mode !== 'kids') return undefined;
    bounce.setValue(0);
    const spring = Animated.spring(bounce, { toValue: 1, tension: 200, friction: 10, useNativeDriver: true });
    spring.start();
    return () => spring.stop();
  }, [mode, bounce]);

  if (mode === 'airport') {
    return <Text style={styles.airport} accessibilityRole="header">WAIAIR</Text>;
  }
  if (mode === 'kids') {
    const scale = bounce.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
    return (
      <Animated.View style={[styles.kidsRow, { opacity: bounce, transform: [{ scale }] }]} accessibilityRole="header">
        <Image source={KIDS_ART.airplane} style={styles.kidsIcon} />
        <Text style={styles.kidsText}>WaiAir ✈️</Text>
      </Animated.View>
    );
  }
  return null;
}

const styles = StyleSheet.create({
  airport: {
    fontFamily: MONO,
    fontSize: 20,
    fontWeight: '800',
    color: '#FFC600',
    letterSpacing: 8,
    marginBottom: 10,
  },
  kidsRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  kidsIcon: { width: 24, height: 24, borderRadius: 6 },
  kidsText: { fontSize: 22, fontWeight: '900', color: KIDS_CORAL, letterSpacing: 0.2 },
});
