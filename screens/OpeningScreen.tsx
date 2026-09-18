/**
 * First-run opening screen: one look shows what WaiAir does, and the spotlight points at the action.
 * Dark by design — this screen ignores the app theme; every other screen keeps its own.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ArrowRight, Camera } from 'phosphor-react-native';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { t } from '../lib/i18n';

const BG = '#0D1B2A';
const CARD_BG = '#14263C';
const CARD_EDGE = '#20395A';
const WHITE = '#FFFFFF';
const MUTED = '#8CA2BD';
const GLOW = '#6AA5FF';
const DIMMED = 0.6;
const HERO_LOOP_MS = 4000;
const LOGO = require('../assets/images/waiair-logo.png');
const W = Dimensions.get('window').width;
const GLOW_SIZE = Math.min(W * 1.15, 460);

type Props = {
  visible: boolean;
  onScan: () => void;
  onGoogle: () => void;
  onManual: () => void;
};

/** The hero card shows a sample leg: no data, no network, nothing to load. */
const SAMPLE = { number: 'KL 855', from: 'AMS', to: 'ICN', seat: '24K' };
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function sampleDate(now = new Date()): string {
  const d = new Date(now.getTime() + 2 * 86_400_000);
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]}`;
}

export default function OpeningScreen({ visible, onScan, onGoogle, onManual }: Props) {
  const logoIn = useRef(new Animated.Value(0)).current;
  const cardIn = useRef(new Animated.Value(0)).current;
  const detail = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  const scanIn = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const googleIn = useRef(new Animated.Value(0)).current;
  const dim = useRef(new Animated.Value(1)).current;
  /** 0 = spotlight on the scan button, 1 = on the Google button. */
  const spot = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [date] = useState(() => sampleDate());

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(on => { if (!cancelled) setReduceMotion(!!on); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!visible) return undefined;
    const values = [logoIn, cardIn, scanIn, googleIn, ...detail];
    if (reduceMotion) {
      for (const v of values) v.setValue(1);
      dim.setValue(DIMMED);
      return undefined;
    }
    for (const v of values) v.setValue(0);
    dim.setValue(1);
    const step = (v: Animated.Value, duration: number, delay = 0) =>
      Animated.timing(v, { toValue: 1, duration, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true });

    const details = () => Animated.stagger(500, detail.map(v => step(v, 420)));
    const intro = Animated.sequence([
      step(logoIn, 500),
      step(cardIn, 800),
      details(),
      Animated.parallel([
        step(scanIn, 500),
        // Everything but the spotlit action settles back a little.
        Animated.timing(dim, { toValue: DIMMED, duration: 500, useNativeDriver: true }),
      ]),
      step(googleIn, 300),
    ]);
    intro.start();

    // Subtle pulse on the scan button, and the hero details replay every 4s.
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1200, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    const replay = setInterval(() => {
      for (const v of detail) v.setValue(0);
      details().start();
    }, HERO_LOOP_MS);

    return () => {
      intro.stop();
      loop.stop();
      clearInterval(replay);
    };
  }, [visible, reduceMotion, logoIn, cardIn, detail, scanIn, googleIn, dim, pulse]);

  const moveSpot = useCallback((toGoogle: boolean) => {
    if (reduceMotion) return;
    Animated.timing(spot, { toValue: toGoogle ? 1 : 0, duration: 260, useNativeDriver: true }).start();
  }, [reduceMotion, spot]);

  if (!visible) return null;

  const detailStyle = (i: number) => ({
    opacity: detail[i],
    transform: [{ translateY: detail[i].interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  });

  return (
    <View style={styles.root}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowWrap,
          { transform: [{ translateY: spot.interpolate({ inputRange: [0, 1], outputRange: [0, 120] }) }] },
        ]}
      >
        <Svg width={GLOW_SIZE} height={GLOW_SIZE}>
          <Defs>
            <RadialGradient id="spot" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={GLOW} stopOpacity={0.34} />
              <Stop offset="0.55" stopColor={GLOW} stopOpacity={0.12} />
              <Stop offset="1" stopColor={GLOW} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x="0" y="0" width={GLOW_SIZE} height={GLOW_SIZE} fill="url(#spot)" />
        </Svg>
      </Animated.View>

      <Animated.View style={[styles.top, { opacity: Animated.multiply(logoIn, dim) }]}>
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>{t().openingTagline}</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.heroWrap,
          {
            opacity: Animated.multiply(cardIn, dim),
            transform: [{ translateY: cardIn.interpolate({ inputRange: [0, 1], outputRange: [90, 0] }) }],
          },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.cardGlow} />
          <Animated.Text style={[styles.cardNumber, detailStyle(0)]}>{SAMPLE.number}</Animated.Text>
          <Animated.View style={[styles.cardRoute, detailStyle(1)]}>
            <Text style={styles.cardIata}>{SAMPLE.from}</Text>
            <View style={styles.cardLine} />
            <Text style={styles.cardIata}>{SAMPLE.to}</Text>
          </Animated.View>
          <Animated.View style={[styles.cardFoot, detailStyle(2)]}>
            <Text style={styles.cardMeta}>{date}</Text>
            <Text style={styles.cardMeta}>{SAMPLE.seat}</Text>
          </Animated.View>
        </View>
      </Animated.View>

      <View style={styles.actions}>
        <Animated.View
          style={{
            opacity: scanIn,
            transform: [
              { scale: Animated.multiply(scanIn.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }), pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] })) },
            ],
          }}
        >
          <TouchableOpacity
            style={styles.scanBtn}
            activeOpacity={0.9}
            onPress={onScan}
            onPressIn={() => moveSpot(false)}
            accessibilityRole="button"
            accessibilityLabel={t().scanBoardingPass}
          >
            <Camera size={24} color={BG} weight="fill" />
            <Text style={styles.scanTxt}>{t().scanBoardingPass}</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.dividerRow, { opacity: Animated.multiply(googleIn, dim) }]}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerTxt}>{t().openingOr}</Text>
          <View style={styles.dividerLine} />
        </Animated.View>

        <Animated.View style={[styles.googleWrap, { opacity: googleIn }]}>
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Light}
            onPress={onGoogle}
            style={styles.googleBtn}
          />
          <Text style={styles.googleSub}>{t().openingGoogleSub}</Text>
        </Animated.View>

        <Animated.View style={{ opacity: Animated.multiply(googleIn, dim) }}>
          <TouchableOpacity
            style={styles.manualBtn}
            onPress={onManual}
            onPressIn={() => moveSpot(true)}
            accessibilityRole="button"
            accessibilityLabel={t().openingManual}
          >
            <Text style={styles.manualTxt}>{t().openingManual}</Text>
            <ArrowRight size={12} color={MUTED} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 24, paddingTop: 64, paddingBottom: 36 },
  glowWrap: { position: 'absolute', alignSelf: 'center', bottom: 90, width: GLOW_SIZE, height: GLOW_SIZE, left: (W - GLOW_SIZE) / 2 },
  top: { alignItems: 'center', gap: 6 },
  logo: { width: 108, height: 32 },
  tagline: { color: MUTED, fontSize: 13, letterSpacing: 0.2 },
  heroWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  card: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: CARD_EDGE,
    paddingVertical: 22,
    paddingHorizontal: 22,
    gap: 16,
    shadowColor: GLOW,
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  cardGlow: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, backgroundColor: GLOW, opacity: 0.5, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  cardNumber: { color: WHITE, fontSize: 30, fontWeight: '700', letterSpacing: 1 },
  cardRoute: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardIata: { color: WHITE, fontSize: 22, fontWeight: '600', letterSpacing: 2 },
  cardLine: { flex: 1, height: 1, backgroundColor: CARD_EDGE },
  cardFoot: { flexDirection: 'row', justifyContent: 'space-between' },
  cardMeta: { color: MUTED, fontSize: 13, letterSpacing: 1 },
  actions: { gap: 14 },
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: GLOW,
    shadowOpacity: 0.5,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 0 },
    elevation: 10,
  },
  scanTxt: { color: BG, fontSize: 17, fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: CARD_EDGE },
  dividerTxt: { color: MUTED, fontSize: 12 },
  googleWrap: { alignItems: 'center', gap: 6 },
  googleBtn: { width: 240, height: 48 },
  googleSub: { color: MUTED, fontSize: 11 },
  manualBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  manualTxt: { color: MUTED, fontSize: 12 },
});
