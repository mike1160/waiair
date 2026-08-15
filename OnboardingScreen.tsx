import { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Airplane, BellSimple, MagnifyingGlass } from 'phosphor-react-native';
import { t } from './lib/i18n';

type ThemeBits = { bg: string; text: string; secondary: string; muted: string; accent: string; card: string };

type Props = {
  visible: boolean;
  colors: ThemeBits;
  onSkip: () => void;
  onDone: () => void;
};

const W = Dimensions.get('window').width;

export default function OnboardingScreen({ visible, colors: C, onSkip, onDone }: Props) {
  const [page, setPage] = useState(0);
  const plane = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.timing(plane, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, plane]);

  if (!visible) return null;
  const copy = t();
  const slides = [
    { title: copy.onboarding1Title, body: copy.onboarding1Body, Icon: Airplane },
    { title: copy.onboarding2Title, body: copy.onboarding2Body, Icon: BellSimple },
    { title: copy.onboarding3Title, body: copy.onboarding3Body, Icon: MagnifyingGlass },
  ];
  const slide = slides[page];
  const Icon = slide.Icon;

  const go = (next: number) => {
    Animated.timing(fade, { toValue: 0, duration: 140, useNativeDriver: true }).start(() => {
      setPage(next);
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: C.bg }]} accessibilityViewIsModal>
      <TouchableOpacity
        onPress={onSkip}
        style={styles.skip}
        accessibilityRole="button"
        accessibilityLabel={copy.skip}
      >
        <Text style={[styles.skipTxt, { color: C.muted }]}>{copy.skip}</Text>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.hero,
          {
            transform: [{
              translateX: plane.interpolate({ inputRange: [0, 1], outputRange: [-W * 0.35, W * 0.35] }),
            }, {
              translateY: plane.interpolate({ inputRange: [0, 0.5, 1], outputRange: [8, -12, 8] }),
            }],
          },
        ]}
      >
        <Airplane size={56} color={C.accent} weight="fill" />
      </Animated.View>

      <Animated.View style={[styles.body, { opacity: fade }]}>
        <Icon size={32} color={C.accent} />
        <Text style={[styles.title, { color: C.text }]}>{slide.title}</Text>
        <Text style={[styles.sub, { color: C.secondary }]}>{slide.body}</Text>
      </Animated.View>

      <View style={styles.dots}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[styles.dot, { backgroundColor: i === page ? C.accent : C.muted, opacity: i === page ? 1 : 0.35 }]}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.cta, { backgroundColor: C.accent }]}
        onPress={() => {
          if (page < slides.length - 1) go(page + 1);
          else onDone();
        }}
        accessibilityRole="button"
        accessibilityLabel={page < slides.length - 1 ? copy.next : copy.getStarted}
      >
        <Text style={styles.ctaTxt}>{page < slides.length - 1 ? copy.next : copy.getStarted}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 80, paddingTop: 64, paddingHorizontal: 28, justifyContent: 'space-between', paddingBottom: 48 },
  skip: { alignSelf: 'flex-end', padding: 8 },
  skipTxt: { fontSize: 15, fontWeight: '700' },
  hero: { alignItems: 'center', height: 80, justifyContent: 'center' },
  body: { alignItems: 'center', gap: 14, paddingHorizontal: 8 },
  title: { fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: -0.4 },
  sub: { fontSize: 16, lineHeight: 24, textAlign: 'center', fontWeight: '500' },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cta: { borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  ctaTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
