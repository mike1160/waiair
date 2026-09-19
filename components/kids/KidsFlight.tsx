/**
 * Kids mode on the flight page: a sky with the little plane (flying across while the flight is in the air),
 * the waving pilot, the two times in one big sentence, where the trip is in kid words, the confetti and the
 * suitcase belt once landed, and a pizza card in place of the restaurant guide.
 */
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Linking, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { t } from '../../lib/i18n';
import { useMode } from '../../lib/modeContext';
import { CONFETTI_BACKDROP, KIDS_ART, KIDS_VIDEO } from '../../lib/kidsAssets';
import type { KidsFlightPhase, KidsPhaseKey } from '../../lib/modes';
import { KIDS_FONT, KidsBounce, KidsFloat, KidsVideo, KidsWave } from './KidsParts';

const HEADER_H = 220;
const PLANE = 110;
const CROSS_MS = 9000;

export function KidsFlightHeader({ phase }: { phase: KidsFlightPhase }) {
  const { width } = useWindowDimensions();
  const [boxW, setBoxW] = useState(width - 40);
  const x = useRef(new Animated.Value(0)).current;
  const flying = phase === 'inflight';

  useEffect(() => {
    const travel = Math.max(0, boxW - PLANE);
    if (!flying) {
      x.setValue(travel / 2);
      return undefined;
    }
    x.setValue(0);
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(x, { toValue: travel, duration: CROSS_MS, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(x, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [flying, boxW, x]);

  return (
    <View style={st.header} onLayout={e => setBoxW(e.nativeEvent.layout.width)}>
      <Image source={KIDS_ART.sky} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <Animated.View style={[st.planeBox, { transform: [{ translateX: x }] }]}>
        <KidsVideo source={KIDS_VIDEO.airplane} style={st.plane} />
      </Animated.View>
      <KidsWave style={st.pilotWrap}>
        <Image source={KIDS_ART.pilot} style={st.pilot} />
      </KidsWave>
    </View>
  );
}

export function KidsTimeCard({ depClock, arrClock }: { depClock: string; arrClock: string }) {
  const { C } = useMode();
  const copy = t();
  return (
    <KidsFloat>
      <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={[st.big, { color: C.text }]}>{copy.kids_departs_at.replace('{time}', depClock || '--:--')}</Text>
        <Text style={[st.big, { color: C.text, marginTop: 10 }]}>{copy.kids_lands_at.replace('{time}', arrClock || '--:--')}</Text>
      </View>
    </KidsFloat>
  );
}

export function KidsPhaseCard({ phaseKey }: { phaseKey: KidsPhaseKey | null }) {
  const { C } = useMode();
  if (!phaseKey) return null;
  return (
    <KidsFloat delayMs={600}>
      <View style={[st.card, st.phaseCard, { backgroundColor: C.accent }]}>
        <Text style={st.phaseTxt}>{t()[phaseKey]}</Text>
      </View>
    </KidsFloat>
  );
}

/** Flights that already had their confetti in this session: it plays once, then the suitcase card stays. */
const celebrated = new Set<string>();
const confettiListeners = new Set<() => void>();
/** Until when the confetti shows. Kept here, not in the host: the flight page remounts the host now and then. */
let confettiUntil = 0;
const CONFETTI_MS = 3000;
/** Wait for the flight page to finish sliding in before the party starts. */
const CONFETTI_DELAY_MS = 450;

/**
 * Marks the flight as celebrated right away and starts the confetti a moment later, once the flight page has
 * slid in. The timer lives outside the card on purpose: the page re-renders its sections often.
 */
function celebrate(flightKey: string) {
  if (celebrated.has(flightKey)) return;
  celebrated.add(flightKey);
  setTimeout(() => {
    confettiUntil = Date.now() + CONFETTI_MS;
    confettiListeners.forEach(fire => fire());
  }, CONFETTI_DELAY_MS);
}

/**
 * Full-screen confetti, mounted at the root of the flight page. A nested Modal cannot be presented while the
 * page's own modal is still sliding in on iOS, so the landed card asks this host instead.
 */
export function KidsConfettiHost() {
  const [, setTick] = useState(0);
  useEffect(() => {
    let off: ReturnType<typeof setTimeout> | null = null;
    const sync = () => {
      setTick(n => n + 1);
      if (off) clearTimeout(off);
      const left = confettiUntil - Date.now();
      if (left > 0) off = setTimeout(() => setTick(n => n + 1), left + 20);
    };
    confettiListeners.add(sync);
    sync();
    return () => { confettiListeners.delete(sync); if (off) clearTimeout(off); };
  }, []);
  if (Date.now() >= confettiUntil) return null;
  return (
    <View style={[StyleSheet.absoluteFill, st.confetti, { backgroundColor: CONFETTI_BACKDROP }]} pointerEvents="none">
      <KidsVideo source={KIDS_VIDEO.confetti} style={StyleSheet.absoluteFill} loop={false} />
    </View>
  );
}

/** Landed: three seconds of confetti over everything, then the suitcase belt with the stewardess. */
export function KidsLanded({ flightKey }: { flightKey: string }) {
  const { C } = useMode();
  useEffect(() => { celebrate(flightKey); }, [flightKey]);

  return (
    <>
      <KidsFloat>
        <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={st.bagRow}>
            <View style={st.bagVideoWrap}>
              <KidsVideo source={KIDS_VIDEO.baggage} style={st.bagVideo} />
            </View>
            <KidsWave>
              <Image source={KIDS_ART.stewardess} style={st.stewardess} />
            </KidsWave>
          </View>
          <Text style={[st.big, { color: C.text, marginTop: 12, fontSize: 26 }]}>{t().kids_baggage_coming}</Text>
        </View>
      </KidsFloat>
    </>
  );
}

const GRAB_LOGO = require('../../assets/logos/grab.png');
const FOODPANDA_LOGO = require('../../assets/logos/foodpanda.png');

/** Kids mode's stand-in for the restaurant guide: pizza, and the two apps that bring it. */
export function KidsHungryCard() {
  const { C } = useMode();
  const copy = t();
  const open = (url: string) => { Linking.openURL(url).catch(() => {}); };
  return (
    <KidsFloat>
      <View style={[st.card, { backgroundColor: C.card, borderColor: C.border }]}>
        <Text style={st.pizza}>🍕</Text>
        <Text style={[st.big, { color: C.text, fontSize: 26, textAlign: 'center' }]}>{copy.kids_hungry}</Text>
        <View style={st.foodRow}>
          <KidsBounce
            onPress={() => open('https://food.grab.com')}
            style={[st.foodBtn, { borderColor: C.border }]}
            accessibilityRole="link"
            accessibilityLabel="Grab"
          >
            <Image source={GRAB_LOGO} style={st.foodLogo} resizeMode="contain" />
          </KidsBounce>
          <KidsBounce
            onPress={() => open('https://www.foodpanda.com')}
            style={[st.foodBtn, { borderColor: C.border }]}
            accessibilityRole="link"
            accessibilityLabel="foodpanda"
          >
            <Image source={FOODPANDA_LOGO} style={st.foodLogo} resizeMode="contain" />
          </KidsBounce>
        </View>
      </View>
    </KidsFloat>
  );
}

const st = StyleSheet.create({
  header: { height: HEADER_H, borderRadius: 30, overflow: 'hidden', marginTop: 8, justifyContent: 'center' },
  planeBox: { position: 'absolute', top: 24, left: 0, width: PLANE, height: PLANE, borderRadius: PLANE / 2, overflow: 'hidden' },
  plane: { width: PLANE, height: PLANE },
  pilotWrap: { position: 'absolute', left: 12, bottom: 10 },
  pilot: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: '#FFFFFF' },
  card: { borderRadius: 30, borderWidth: 2, padding: 20, marginTop: 14 },
  big: { fontFamily: KIDS_FONT, fontSize: 32, lineHeight: 40, fontWeight: '700' },
  phaseCard: { borderWidth: 0, alignItems: 'center' },
  phaseTxt: { fontFamily: KIDS_FONT, fontSize: 28, lineHeight: 36, fontWeight: '700', color: '#FFFFFF', textAlign: 'center' },
  confetti: { zIndex: 9500, elevation: 9500 },
  bagRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bagVideoWrap: { flex: 1, aspectRatio: 1, maxWidth: 200, borderRadius: 24, overflow: 'hidden' },
  bagVideo: { width: '100%', height: '100%' },
  stewardess: { width: 90, height: 90, borderRadius: 45 },
  pizza: { fontSize: 64, textAlign: 'center' },
  foodRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  foodBtn: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  foodLogo: { width: '70%', height: 40 },
});
