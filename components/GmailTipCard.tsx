/**
 * The one time the app mentions Gmail on its own: after the first flight is being followed.
 *
 * Same card as the Gmail scan results (screens/GmailDiscoveryCard.tsx) — springs up from the bottom, leaves
 * by itself, and can simply be ignored. It is an offer, not a step: "Later" closes it for good (the rule and
 * the storage key live in lib/gmailTip.ts).
 */
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EnvelopeSimple } from 'phosphor-react-native';
import { t } from '../lib/i18n';
import { haptics } from '../lib/haptics';
import { useMode } from '../lib/modeContext';
import { GMAIL_TIP_MS } from '../lib/gmailTip';

type Props = {
  visible: boolean;
  onConnect: () => void;
  /** "Later": never shown again. */
  onLater: () => void;
  /** The ten seconds ran out — not a decision, so nothing is remembered. */
  onTimeout: () => void;
};

export default function GmailTipCard({ visible, onConnect, onLater, onTimeout }: Props) {
  const copy = t();
  const { C } = useMode();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      progress.setValue(0);
      if (timer.current) clearTimeout(timer.current);
      return undefined;
    }
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 160, mass: 0.9 }).start();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: GMAIL_TIP_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    timer.current = setTimeout(onTimeout, GMAIL_TIP_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [visible, slide, progress, onTimeout]);

  if (!visible) return null;

  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['100%', '0%'] });
  const lift = slide.interpolate({ inputRange: [0, 1], outputRange: [200, 0] });

  return (
    <Animated.View
      style={[
        st.wrap,
        {
          backgroundColor: C.card,
          borderColor: C.border,
          shadowColor: C.isDark ? '#000000' : '#0A1628',
          paddingBottom: 14 + insets.bottom,
          transform: [{ translateY: lift }],
        },
      ]}
    >
      <View style={st.head}>
        <EnvelopeSimple size={20} color={C.accent} weight="fill" />
        <Text style={[st.title, { color: C.text }]}>{copy.onboardingGmailTip}</Text>
      </View>

      <View style={st.actions}>
        <Pressable
          onPress={() => { haptics.medium(); onConnect(); }}
          style={({ pressed }) => [st.primary, { backgroundColor: C.accent, opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={copy.onboardingGmailConnect}
        >
          <Text style={[st.primaryTxt, { color: C.isDark ? '#0A1628' : '#FFFFFF' }]}>
            {copy.onboardingGmailConnect}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => { haptics.light(); onLater(); }}
          style={({ pressed }) => [st.secondary, { borderColor: C.border, opacity: pressed ? 0.7 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={copy.onboardingGmailLater}
        >
          <Text style={[st.secondaryTxt, { color: C.muted }]}>{copy.onboardingGmailLater}</Text>
        </Pressable>
      </View>

      <View style={[st.progressTrack, { backgroundColor: C.border, bottom: Math.max(6, insets.bottom - 8) }]}>
        <Animated.View style={[st.progressFill, { width: barWidth, backgroundColor: C.accent }]} />
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 40,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  actions: { paddingHorizontal: 20, gap: 8 },
  primary: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryTxt: { fontSize: 16, fontWeight: '800' },
  secondary: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  secondaryTxt: { fontSize: 15, fontWeight: '700' },
  progressTrack: { position: 'absolute', left: 0, right: 0, height: 3 },
  progressFill: { height: 3 },
});
