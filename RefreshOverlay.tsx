import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { Airplane } from 'phosphor-react-native';
import { t } from './lib/i18n';

const W = Dimensions.get('window').width;

export default function RefreshOverlay({
  active,
  accent,
}: {
  active: boolean;
  accent: string;
}) {
  const x = useRef(new Animated.Value(-48)).current;
  const rot = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      x.setValue(-48);
      return;
    }
    x.setValue(-48);
    const fly = Animated.loop(
      Animated.timing(x, {
        toValue: W + 48,
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    );
    const spin = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
    );
    fly.start();
    spin.start();
    return () => {
      try {
        fly.stop();
        spin.stop();
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, [active, x, rot]);

  if (!active) return null;

  return (
    <View style={styles.wrap} pointerEvents="none" accessibilityLiveRegion="polite">
      <Animated.View
        style={{
          transform: [
            { translateX: x },
            { rotate: rot.interpolate({ inputRange: [0, 1], outputRange: ['-12deg', '12deg'] }) },
          ],
        }}
      >
        <Airplane size={22} color={accent} weight="fill" />
      </Animated.View>
      <Text style={[styles.txt, { color: accent }]}>{t().refreshing}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 36,
    marginHorizontal: 16,
    marginBottom: 4,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  txt: { position: 'absolute', alignSelf: 'center', fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },
});
