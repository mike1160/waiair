import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

function ShimmerCard({ delay = 0 }: { delay?: number }) {
  const v = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(v, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(v, { toValue: 0.45, duration: 700, useNativeDriver: true }),
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
  }, [delay, v]);

  return (
    <Animated.View style={[st.card, { opacity: v }]}>
      <View style={st.logo} />
      <View style={st.mid}>
        <View style={st.lineLg} />
        <View style={st.lineSm} />
        <View style={st.pill} />
      </View>
      <View style={st.right}>
        <View style={st.time} />
        <View style={st.gate} />
      </View>
    </Animated.View>
  );
}

export default function SkeletonCards({ count = 6 }: { count?: number }) {
  return (
    <View style={st.wrap} accessibilityLabel="Loading flights">
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} delay={i * 80} />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { paddingHorizontal: 16, gap: 10, paddingTop: 8 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(136,150,176,0.12)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  logo: { width: 40, height: 40, borderRadius: 8, backgroundColor: 'rgba(136,150,176,0.28)' },
  mid: { flex: 1, gap: 8 },
  lineLg: { height: 14, width: '55%', borderRadius: 7, backgroundColor: 'rgba(136,150,176,0.32)' },
  lineSm: { height: 10, width: '40%', borderRadius: 5, backgroundColor: 'rgba(136,150,176,0.22)' },
  pill: { height: 18, width: 72, borderRadius: 9, backgroundColor: 'rgba(136,150,176,0.22)' },
  right: { alignItems: 'flex-end', gap: 8 },
  time: { height: 18, width: 56, borderRadius: 8, backgroundColor: 'rgba(136,150,176,0.32)' },
  gate: { height: 28, width: 36, borderRadius: 8, backgroundColor: 'rgba(136,150,176,0.22)' },
});
