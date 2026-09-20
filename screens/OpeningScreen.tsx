/**
 * First-run opening screen: the logo, what WaiAir does in three cards you can swipe, and two ways in —
 * sign in with Google, or continue without an account. No account is needed to use the app; Gmail can be
 * connected later in Settings.
 *
 * Light by design — this screen shows before the app's theme matters, and follows the light palette
 * (lib/themeTokens.ts) so it looks like the rest of the app in day mode.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { AirplaneTilt, Camera, Confetti, EnvelopeSimple } from 'phosphor-react-native';
import Svg, { Path } from 'react-native-svg';
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
  onManual: () => void;
  /** Scanning a boarding pass stays reachable from here, quietly, under the two ways in. */
  onScan: () => void;
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

type Card = { key: string; icon: ReactElement; title: string; body: string };

function cards(): Card[] {
  const copy = t();
  return [
    {
      key: 'track',
      icon: <AirplaneTilt size={30} color={GOLD} weight="fill" />,
      title: copy.introTrackTitle,
      body: copy.introTrackBody,
    },
    {
      key: 'import',
      icon: <EnvelopeSimple size={30} color={GOLD} weight="fill" />,
      title: copy.introImportTitle,
      body: copy.introImportBody,
    },
    {
      key: 'family',
      icon: <Confetti size={30} color={GOLD} weight="fill" />,
      title: copy.introFamilyTitle,
      body: copy.introFamilyBody,
    },
  ];
}

export default function OpeningScreen({ visible, onGoogle, onManual, onScan }: Props) {
  const { width } = useWindowDimensions();
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [page, setPage] = useState(0);
  const [list] = useState(() => cards());
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

  const riseStyle = { transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] };

  return (
    <Animated.View style={[styles.root, { opacity: fade }]}>
      <Animated.View style={[styles.top, riseStyle]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>{t().openingTagline}</Text>
      </Animated.View>

      <View style={styles.pagerWrap}>
        <FlatList
          data={list}
          keyExtractor={c => c.key}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={{ width, marginHorizontal: -24 }}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={e => {
            const at = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width));
            setPage(Math.max(0, Math.min(list.length - 1, at)));
          }}
          renderItem={({ item }) => (
            <View style={[styles.page, { width }]}>
              <View style={styles.card}>
                <View style={styles.cardIcon}>{item.icon}</View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardBody}>{item.body}</Text>
              </View>
            </View>
          )}
        />
        <View style={styles.dots}>
          {list.map((c, i) => (
            <View
              key={c.key}
              style={[styles.dot, i === page ? styles.dotOn : null]}
            />
          ))}
        </View>
      </View>

      <Animated.View style={[styles.actions, riseStyle]}>
        <TouchableOpacity
          style={styles.googleBtn}
          activeOpacity={0.85}
          onPress={() => leave(onGoogle)}
          accessibilityRole="button"
          accessibilityLabel={t().introSignInGoogle}
        >
          <GoogleG size={18} />
          <Text style={styles.googleTxt}>{t().introSignInGoogle}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipBtn}
          activeOpacity={0.7}
          onPress={() => leave(onManual)}
          accessibilityRole="button"
          accessibilityLabel={t().introContinueNoAccount}
        >
          <Text style={styles.skipTxt}>{t().introContinueNoAccount}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.scanLink}
          activeOpacity={0.7}
          onPress={() => leave(onScan)}
          accessibilityRole="button"
          accessibilityLabel={t().scanBoardingPass}
        >
          <Camera size={15} color={MUTED} />
          <Text style={styles.scanLinkTxt}>{t().scanBoardingPass}</Text>
        </TouchableOpacity>

        <Text style={styles.footNote}>{t().introGmailLater}</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 28 },
  top: { alignItems: 'center', gap: 8 },
  logo: { width: 108, height: 32 },
  tagline: { color: MUTED, fontSize: 13, letterSpacing: 0.2, textAlign: 'center' },
  pagerWrap: { flex: 1, justifyContent: 'center', gap: 18 },
  page: { paddingHorizontal: 24, justifyContent: 'center' },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    paddingVertical: 28,
    paddingHorizontal: 22,
    gap: 12,
    minHeight: 220,
    justifyContent: 'center',
    shadowColor: TEXT,
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: light.goldLight,
  },
  cardTitle: { color: TEXT, fontSize: 22, fontWeight: '700', lineHeight: 28 },
  cardBody: { color: MUTED, fontSize: 15, lineHeight: 21 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CARD_EDGE },
  dotOn: { width: 20, backgroundColor: GOLD },
  actions: { gap: 10 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    paddingVertical: 17,
    shadowColor: TEXT,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  googleTxt: { color: GOOGLE_TEXT, fontSize: 16, fontWeight: '600' },
  skipBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  skipTxt: { color: TEXT, fontSize: 15, fontWeight: '600' },
  scanLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 6 },
  scanLinkTxt: { color: MUTED, fontSize: 13, fontWeight: '500' },
  footNote: { color: MUTED, fontSize: 12, textAlign: 'center' },
});
