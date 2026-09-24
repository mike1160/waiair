/**
 * First run: one screen, one obvious way in.
 *
 * The app explains itself, so there is nothing to read here and nothing to swipe through — the three cards
 * that used to be here asked people to learn the app before they had seen a single flight. "Open the app"
 * goes straight to the empty home; signing in with Google is offered underneath, for the Gmail scan, and is
 * never demanded.
 *
 * The photo band, the type and the gold button are the app's own, so the first screen looks like the screen
 * behind it. Light by design: this shows before the app's theme matters.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Horizon from '../components/Horizon';
import LegalScreen from '../LegalScreen';
import { t } from '../lib/i18n';
import { PALETTE_TOKENS } from '../lib/themeTokens';

const light = PALETTE_TOKENS.light;

const BG = light.bg;
const CARD_BG = light.card;
const CARD_EDGE = 'rgba(13,27,46,0.10)';
const TEXT = light.text;
const MUTED = light.textMuted;
const GOLD = light.gold;
const GOOGLE_TEXT = '#3C4043';
const EXIT_MS = 220;
const LOGO = require('../assets/images/waiair-logo.png');

type Props = {
  visible: boolean;
  onGoogle: () => void;
  /** Into the app, no account: the main action. */
  onManual: () => void;
};

/** Google's four-colour "G" (the standard sign-in mark). */
function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export default function OpeningScreen({ visible, onGoogle, onManual }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [legal, setLegal] = useState<'privacy' | 'terms' | null>(null);
  const leaving = useRef(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(on => { if (!cancelled) setReduceMotion(!!on); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    leaving.current = false;
    if (reduceMotion) {
      fade.setValue(1);
      rise.setValue(1);
      return undefined;
    }
    fade.setValue(0);
    rise.setValue(0);
    const intro = Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rise, { toValue: 1, duration: 560, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    intro.start();
    return () => intro.stop();
  }, [visible, reduceMotion, fade, rise]);

  /** Fades the screen out before handing over, so the app appears instead of replacing it in one frame. */
  const leave = useCallback((go: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    if (reduceMotion) {
      go();
      return;
    }
    Animated.timing(fade, { toValue: 0, duration: EXIT_MS, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(() => go());
  }, [fade, reduceMotion]);

  if (!visible) return null;

  const copy = t();
  const riseStyle = { transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] };

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <Horizon isDark={false} band="search" width={width} insetTop={insets.top} />

      <Animated.View style={[styles.top, riseStyle]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.wordmark}>WaiAir</Text>
        <Text style={styles.tagline}>{copy.onboardingTagline}</Text>
      </Animated.View>

      <View style={styles.spacer} />

      <Animated.View style={[styles.actions, riseStyle]}>
        {/* The one thing to do on this screen. Everything below it is deliberately smaller. */}
        <TouchableOpacity
          style={styles.openBtn}
          activeOpacity={0.85}
          onPress={() => leave(onManual)}
          accessibilityRole="button"
          accessibilityLabel={copy.onboardingOpenApp}
        >
          <Text style={styles.openTxt}>{copy.onboardingOpenApp}</Text>
        </TouchableOpacity>

        <View style={styles.gap} />

        <View style={styles.secondary}>
          <TouchableOpacity
            style={styles.googleBtn}
            activeOpacity={0.85}
            onPress={() => leave(onGoogle)}
            accessibilityRole="button"
            accessibilityLabel={copy.onboardingGoogle}
            accessibilityHint={copy.onboardingGmailIncluded}
          >
            <GoogleG size={17} />
            <Text style={styles.googleTxt}>{copy.onboardingGoogle}</Text>
          </TouchableOpacity>
          <Text style={styles.gmailNote}>{copy.onboardingGmailIncluded}</Text>
        </View>

        <View style={styles.legalRow} accessibilityLabel={copy.onboardingPrivacy}>
          <TouchableOpacity onPress={() => setLegal('privacy')} hitSlop={8} accessibilityRole="link">
            <Text style={styles.legalTxt}>{copy.privacy}</Text>
          </TouchableOpacity>
          <Text style={styles.legalTxt}> · </Text>
          <TouchableOpacity onPress={() => setLegal('terms')} hitSlop={8} accessibilityRole="link">
            <Text style={styles.legalTxt}>{copy.termsShort}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <LegalScreen
        visible={!!legal}
        kind={legal || 'privacy'}
        colors={{ bg: BG, text: TEXT, secondary: MUTED, muted: MUTED, list: CARD_BG, accent: GOLD }}
        onClose={() => setLegal(null)}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingBottom: 28 },
  top: { alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingTop: 16 },
  logo: { width: 64, height: 64, borderRadius: 16 },
  wordmark: { color: TEXT, fontSize: 30, fontWeight: '800', letterSpacing: -0.4 },
  tagline: { color: MUTED, fontSize: 16, fontWeight: '500', letterSpacing: 0.2, textAlign: 'center' },
  spacer: { flex: 1 },
  // The gold button sits in the middle of what is left; the quieter options stay at the bottom.
  gap: { flex: 0.55 },
  actions: { gap: 18, paddingHorizontal: 24 },
  openBtn: {
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: TEXT,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  openTxt: { color: '#FFFFFF', fontSize: 17, fontWeight: '700', letterSpacing: 0.2 },
  secondary: { alignItems: 'center', gap: 6 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },
  googleTxt: { color: GOOGLE_TEXT, fontSize: 15, fontWeight: '600' },
  gmailNote: { color: MUTED, fontSize: 12, textAlign: 'center' },
  legalRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  legalTxt: { color: MUTED, fontSize: 12 },
});
