import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { X } from 'phosphor-react-native';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';
import { startLoopWhileActive } from './lib/appActivity';
import { t } from './lib/i18n';
import { haptics } from './lib/haptics';
import { gateCodeOnly } from './GateBadge';
import { BoardingPassMark, PASS_CREAM, PASS_NAVY } from './BoardingPassMark';

export const BOOK_HINT_KEY = 'waiair.bookHint.v1';

export const NAVY = '#0D1B2E';
export const GOLD = '#C9A84C';
const SKIN = '#F3D2B3';
const HAIR = '#8A4E28';
const JACKET = '#5BA3E6';
const TROUSER = '#7B8CA8';
const WALK_MS = 520;
const CHAR_W = 78;
const GATE_RESERVE = 90;

export const YOU_EASE = Easing.bezier(0.34, 1.56, 0.64, 1);

const BARCODE = [2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2, 3, 1, 1, 2, 2, 1, 3, 1, 2, 1, 2, 3, 1, 2, 1, 3];

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function passDate(raw?: string): string {
  const m = String(raw || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '—';
  return `${parseInt(m[3], 10)} ${MONTHS[parseInt(m[2], 10) - 1]}`;
}

export function Walker({
  stride,
  bob,
}: {
  stride: Animated.Value;
  bob: Animated.Value;
}) {
  const leftLeg = stride.interpolate({ inputRange: [0, 1], outputRange: ['16deg', '-16deg'] });
  const rightLeg = stride.interpolate({ inputRange: [0, 1], outputRange: ['-16deg', '16deg'] });
  const leftArm = stride.interpolate({ inputRange: [0, 1], outputRange: ['-14deg', '14deg'] });
  const rightArm = stride.interpolate({ inputRange: [0, 1], outputRange: ['14deg', '-14deg'] });

  return (
    <View style={st.walker} pointerEvents="none">
      <View style={st.suitcase}>
        <Svg width={24} height={30} viewBox="0 0 20 26">
          <Rect x="5" y="1" width="10" height="3" rx="1" fill={GOLD} />
          <Rect x="2" y="4" width="16" height="16" rx="2.5" fill={GOLD} />
          <Rect x="4" y="7" width="12" height="2" rx="1" fill="#0D1B2E" opacity={0.25} />
          <Circle cx="6" cy="22" r="2.2" fill="#1A1A1A" />
          <Circle cx="14" cy="22" r="2.2" fill="#1A1A1A" />
        </Svg>
      </View>
      <Animated.View style={{ transform: [{ translateY: bob }], alignItems: 'center' }}>
        <Svg width={34} height={34} viewBox="0 0 28 28">
          <Ellipse cx="14" cy="8" rx="10" ry="6" fill={HAIR} />
          <Circle cx="14" cy="15" r="9" fill={SKIN} />
          <Ellipse cx="14" cy="7.5" rx="9" ry="5" fill={HAIR} />
          <Circle cx="11" cy="15" r="1.2" fill="#2A1A12" />
          <Circle cx="17" cy="15" r="1.2" fill="#2A1A12" />
          <Ellipse cx="14" cy="19.2" rx="2.2" ry="1.1" fill="#C4896A" />
        </Svg>
        <View style={st.torsoRow}>
          <Animated.View style={[st.limb, { transform: [{ rotate: leftArm }] }]}>
            <View style={[st.arm, { borderBottomLeftRadius: 6 }]} />
            <View style={st.miniPass} />
          </Animated.View>
          <View style={st.jacket} />
          <Animated.View style={[st.limb, { transform: [{ rotate: rightArm }] }]}>
            <View style={[st.arm, { borderBottomRightRadius: 6 }]} />
          </Animated.View>
        </View>
        <View style={st.legRow}>
          <Animated.View style={{ transform: [{ rotate: leftLeg }] }}>
            <View style={st.leg} />
            <View style={st.shoe} />
          </Animated.View>
          <Animated.View style={{ transform: [{ rotate: rightLeg }] }}>
            <View style={st.leg} />
            <View style={st.shoe} />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const WALK_ONCE_MS = 3400;

/** One-shot walk → jump → pass fade. Freezes on the last frame. */
export function WalkOnceStrip({
  origin,
  destination,
  flightNumber,
  date,
  gate,
  active,
}: {
  origin?: string;
  destination?: string;
  flightNumber?: string;
  date?: string;
  gate?: string;
  active: boolean;
}) {
  const from = String(origin || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const to = String(destination || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3);
  const gateCode = gateCodeOnly(gate) || '—';
  const num = String(flightNumber || '—').replace(/\s+/g, '');
  const day = passDate(date);

  const [sceneW, setSceneW] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const walkX = useRef(new Animated.Value(0)).current;
  const jumpY = useRef(new Animated.Value(0)).current;
  const stride = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const passOpacity = useRef(new Animated.Value(0)).current;
  const passY = useRef(new Animated.Value(18)).current;
  const youSize = useRef(new Animated.Value(11)).current;
  const cursor = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active || sceneW <= 0) return;
    let cancelled = false;
    setShowPass(false);
    walkX.setValue(0);
    jumpY.setValue(0);
    stride.setValue(0);
    bob.setValue(0);
    passOpacity.setValue(0);
    passY.setValue(18);
    youSize.setValue(11);
    cursor.setValue(1);

    const stopAt = Math.max(28, Math.min(sceneW * 0.6, sceneW - GATE_RESERVE - CHAR_W));
    const cycles = Math.max(1, Math.round(WALK_ONCE_MS / WALK_MS));
    const gait = Animated.sequence(
      Array.from({ length: cycles }, () =>
        Animated.parallel([
          Animated.sequence([
            Animated.timing(stride, { toValue: 1, duration: WALK_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(stride, { toValue: 0, duration: WALK_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(bob, { toValue: -4, duration: WALK_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(bob, { toValue: 0, duration: WALK_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ]),
      ),
    );

    Animated.parallel([
      gait,
      Animated.timing(walkX, {
        toValue: stopAt,
        duration: WALK_ONCE_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (!finished || cancelled) return;
      stride.setValue(0.5);
      bob.setValue(0);
      Animated.sequence([
        Animated.timing(jumpY, { toValue: -16, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(jumpY, { toValue: 0, duration: 280, easing: Easing.bounce, useNativeDriver: true }),
      ]).start(({ finished: jumped }) => {
        if (!jumped || cancelled) return;
        setShowPass(true);
        Animated.parallel([
          Animated.timing(passOpacity, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(passY, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start(({ finished: shown }) => {
          if (!shown || cancelled) return;
          Animated.sequence([
            Animated.timing(youSize, { toValue: 22, duration: 420, easing: YOU_EASE, useNativeDriver: false }),
            Animated.timing(youSize, { toValue: 11, duration: 480, easing: YOU_EASE, useNativeDriver: false }),
          ]).start();
        });
      });
    });

    return () => {
      cancelled = true;
      walkX.stopAnimation();
      jumpY.stopAnimation();
      stride.stopAnimation();
      bob.stopAnimation();
      passOpacity.stopAnimation();
      passY.stopAnimation();
      youSize.stopAnimation();
    };
  }, [active, sceneW, walkX, jumpY, stride, bob, passOpacity, passY, youSize, cursor]);

  return (
    <View
      style={st.onceWrap}
      onLayout={e => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - sceneW) > 1) setSceneW(w);
      }}
    >
      <View style={[st.scene, { height: 80 }]}>
        <View style={st.floor} />
        <Animated.View
          style={[
            st.char,
            { transform: [{ translateX: walkX }, { translateY: jumpY }] },
          ]}
        >
          <Walker stride={stride} bob={bob} />
        </Animated.View>
        <View style={st.gate} accessibilityLabel={`GATE ${gateCode}`}>
          <View style={st.pole} />
          <View style={st.sign}>
            <Text style={st.signLbl}>GATE</Text>
            <Text style={st.signNum}>{gateCode}</Text>
          </View>
        </View>
      </View>
      {showPass ? (
        <View style={st.oncePass} pointerEvents="none">
          <BookingPassCard
            origin={from || '—'}
            destination={to || '—'}
            flightNumber={num}
            dateLabel={day}
            gate={gateCode}
            youSize={youSize}
            cursor={cursor}
            passOpacity={passOpacity}
            passY={passY}
            compact
          />
        </View>
      ) : null}
    </View>
  );
}

export default function AnimatedBookingCard({
  origin,
  destination,
  flightNumber,
  date,
  gate,
  cabinClass = 'Y',
  onSearchFlights,
}: {
  origin?: string;
  destination?: string;
  flightNumber?: string;
  date?: string;
  gate?: string;
  cabinClass?: string;
  onSearchFlights?: () => void;
}) {
  const from = String(origin || 'AMS').toUpperCase().slice(0, 3);
  const to = String(destination || 'BKK').toUpperCase().slice(0, 3);
  const gateCode = gateCodeOnly(gate) || (hasGateFallback(gate) ? String(gate).trim() : 'B4');
  const num = String(flightNumber || '—').replace(/\s+/g, '');
  const day = passDate(date);

  const copy = t();
  const [sceneW, setSceneW] = useState(0);
  const [showPass, setShowPass] = useState(false);
  const walkX = useRef(new Animated.Value(0)).current;
  const jumpY = useRef(new Animated.Value(0)).current;
  const stride = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const passOpacity = useRef(new Animated.Value(0)).current;
  const passY = useRef(new Animated.Value(18)).current;
  const youSize = useRef(new Animated.Value(11)).current;
  const cursor = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    return startLoopWhileActive(() =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(cursor, { toValue: 0.15, duration: 420, useNativeDriver: true }),
          Animated.timing(cursor, { toValue: 1, duration: 420, useNativeDriver: true }),
        ]),
      ),
    );
  }, [cursor]);

  useEffect(() => {
    if (sceneW <= 0) return;
    let cancelled = false;
    let walkLoop: Animated.CompositeAnimation | null = null;
    setShowPass(false);
    walkX.setValue(0);
    jumpY.setValue(0);
    stride.setValue(0);
    bob.setValue(0);
    passOpacity.setValue(0);
    passY.setValue(18);
    youSize.setValue(11);

    const stopAt = Math.max(28, Math.min(sceneW * 0.6, sceneW - GATE_RESERVE - CHAR_W));
    const delay = setTimeout(() => {
      if (cancelled) return;
      walkLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(stride, { toValue: 1, duration: WALK_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(stride, { toValue: 0, duration: WALK_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          Animated.sequence([
            Animated.timing(bob, { toValue: -4, duration: WALK_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(bob, { toValue: 0, duration: WALK_MS / 2, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ]),
      );
      walkLoop.start();

      Animated.timing(walkX, {
        toValue: stopAt,
        duration: 3400,
        easing: Easing.linear,
        useNativeDriver: true,
      }).start(({ finished }) => {
        walkLoop?.stop();
        if (!finished || cancelled) return;
        stride.setValue(0.5);
        bob.setValue(0);
        Animated.sequence([
          Animated.timing(jumpY, { toValue: -16, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(jumpY, { toValue: 0, duration: 280, easing: Easing.bounce, useNativeDriver: true }),
        ]).start(({ finished: jumped }) => {
          if (!jumped || cancelled) return;
          setShowPass(true);
          Animated.parallel([
            Animated.timing(passOpacity, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(passY, { toValue: 0, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]).start(({ finished: shown }) => {
            if (!shown || cancelled) return;
            Animated.sequence([
              Animated.timing(youSize, { toValue: 22, duration: 420, easing: YOU_EASE, useNativeDriver: false }),
              Animated.timing(youSize, { toValue: 11, duration: 480, easing: YOU_EASE, useNativeDriver: false }),
            ]).start();
          });
        });
      });
    }, 800);

    return () => {
      cancelled = true;
      clearTimeout(delay);
      walkLoop?.stop();
      walkX.stopAnimation();
      jumpY.stopAnimation();
      stride.stopAnimation();
      bob.stopAnimation();
      passOpacity.stopAnimation();
      passY.stopAnimation();
      youSize.stopAnimation();
    };
  }, [sceneW, walkX, jumpY, stride, bob, passOpacity, passY, youSize]);

  const onPress = () => {
    haptics.light();
    if (onSearchFlights) {
      onSearchFlights();
      return;
    }
  };

  return (
    <View style={st.wrap}>
      <View style={st.card}>
        <View
          style={st.scene}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && Math.abs(w - sceneW) > 1) setSceneW(w);
          }}
        >
          <View style={st.floor} />
          <Animated.View
            style={[
              st.char,
              { transform: [{ translateX: walkX }, { translateY: jumpY }] },
            ]}
          >
            <Walker stride={stride} bob={bob} />
          </Animated.View>
          <View style={st.gate} accessibilityLabel={`GATE ${gateCode}`}>
            <View style={st.pole} />
            <View style={st.sign}>
              <Text style={st.signLbl}>GATE</Text>
              <Text style={st.signNum}>{gateCode}</Text>
            </View>
          </View>
        </View>

        {showPass ? (
        <BookingPassCard
          origin={from}
          destination={to}
          flightNumber={num}
          dateLabel={day}
          gate={gateCode}
          cabinClass={cabinClass}
          youSize={youSize}
          cursor={cursor}
          passOpacity={passOpacity}
          passY={passY}
        />
        ) : null}
        {onSearchFlights ? (
          <TouchableOpacity
            onPress={onPress}
            activeOpacity={0.82}
            style={st.cta}
            accessibilityRole="button"
            accessibilityLabel={copy.claimYourSeatA11y}
          >
            <Text style={st.ctaTxt}>{copy.claimYourSeat}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function hasGateFallback(gate?: string): boolean {
  const g = String(gate || '').trim();
  return !!g && g !== '—' && !/^(-|–)$/.test(g);
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
}) {
  return (
    <View style={st.field}>
      <Text style={st.fieldLbl}>{label}</Text>
      {children ?? <Text style={st.fieldVal}>{value}</Text>}
    </View>
  );
}

export function BookingPassCard({
  origin,
  destination,
  flightNumber,
  dateLabel,
  gate,
  cabinClass = 'Y',
  youSize,
  cursor,
  passOpacity,
  passY,
  ctaOpacity,
  onCta,
  compact,
}: {
  origin: string;
  destination: string;
  flightNumber?: string;
  dateLabel: string;
  gate: string;
  cabinClass?: string;
  youSize: Animated.Value;
  cursor: Animated.Value;
  passOpacity?: Animated.Value;
  passY?: Animated.Value;
  ctaOpacity?: Animated.Value;
  onCta?: () => void;
  compact?: boolean;
}) {
  const copy = t();
  const num = String(flightNumber || '—').replace(/\s+/g, '');
  return (
    <Animated.View
      style={[
        st.pass,
        compact && st.passCompact,
        passOpacity && passY
          ? { opacity: passOpacity, transform: [{ translateY: passY }] }
          : null,
      ]}
    >
      <View style={st.passTop}>
        <Text style={st.route}>
          {origin}  →  {destination}
        </Text>
      </View>
      <View style={st.tear}>
        <View style={st.notchLeft} />
        <View style={st.dash} />
        <View style={st.notchRight} />
      </View>
      <View style={st.fields}>
        <Field label={copy.bookingCardPassenger}>
          <Animated.Text style={[st.you, { fontSize: youSize, lineHeight: 24 }]}>YOU</Animated.Text>
        </Field>
        <Field label={copy.bookingCardFlight} value={num} />
        <Field label={copy.bookingCardDate} value={dateLabel} />
        <Field label={copy.bookingCardSeat}>
          <View style={st.seatRow}>
            <Text style={st.fieldVal}>— </Text>
            <Animated.Text style={[st.cursor, { opacity: cursor }]}>|</Animated.Text>
          </View>
        </Field>
        <Field label={copy.bookingCardGate} value={gate} />
        <Field label={copy.bookingCardClass} value={cabinClass} />
      </View>
      <View style={st.barcode}>
        {BARCODE.map((w, i) => (
          <View key={i} style={{ width: w, height: i % 7 === 0 ? 18 : 22, backgroundColor: i % 5 === 2 ? GOLD : PASS_NAVY }} />
        ))}
      </View>
      {onCta && ctaOpacity ? (
        <Animated.View style={{ opacity: ctaOpacity }}>
          <TouchableOpacity
            onPress={onCta}
            activeOpacity={0.82}
            style={st.cta}
            accessibilityRole="button"
            accessibilityLabel={copy.claimYourSeatA11y}
          >
            <Text style={st.ctaTxt}>{copy.claimYourSeat}</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: {
    marginTop: 10,
    marginBottom: 8,
    width: '100%',
    minHeight: 148,
  },
  card: {
    backgroundColor: NAVY,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.45)',
  },
  scene: {
    height: 132,
    paddingHorizontal: 10,
    justifyContent: 'flex-end',
    backgroundColor: '#1E334F',
  },
  onceWrap: {
    width: '100%',
    minHeight: 260,
    overflow: 'visible',
    paddingBottom: 16,
    backgroundColor: NAVY,
  },
  oncePass: {
    overflow: 'visible',
    backgroundColor: NAVY,
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 22,
    backgroundColor: 'rgba(201,168,76,0.16)',
  },
  char: {
    position: 'absolute',
    left: 8,
    bottom: 6,
    zIndex: 2,
  },
  walker: {
    width: CHAR_W,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  suitcase: {
    marginRight: 2,
    marginBottom: 2,
  },
  torsoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: -2,
  },
  jacket: {
    width: 22,
    height: 24,
    borderRadius: 6,
    backgroundColor: JACKET,
  },
  limb: {
    width: 10,
    alignItems: 'center',
  },
  arm: {
    width: 6,
    height: 18,
    backgroundColor: JACKET,
    borderRadius: 3,
  },
  miniPass: {
    position: 'absolute',
    left: -6,
    top: 8,
    width: 10,
    height: 7,
    borderRadius: 1,
    backgroundColor: '#F4F0E6',
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
  },
  legRow: {
    flexDirection: 'row',
    gap: 3,
    marginTop: -1,
  },
  leg: {
    width: 8,
    height: 18,
    backgroundColor: TROUSER,
    borderRadius: 2,
  },
  shoe: {
    width: 9,
    height: 4,
    marginTop: -1,
    marginLeft: -1,
    backgroundColor: '#111111',
    borderRadius: 2,
  },
  gate: {
    position: 'absolute',
    right: 10,
    bottom: 6,
    alignItems: 'center',
    zIndex: 1,
  },
  pole: {
    position: 'absolute',
    bottom: 0,
    width: 3,
    height: 36,
    backgroundColor: 'rgba(201,168,76,0.45)',
    borderRadius: 1,
  },
  sign: {
    marginBottom: 28,
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: GOLD,
    backgroundColor: '#122033',
    alignItems: 'center',
  },
  signLbl: {
    color: GOLD,
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  signNum: {
    color: '#F4F0E6',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  pass: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: PASS_CREAM,
    borderRadius: 14,
    overflow: 'hidden',
  },
  passCompact: {
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 0,
  },
  passTop: {
    backgroundColor: PASS_NAVY,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
  },
  route: {
    color: GOLD,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  tear: {
    height: 14,
    justifyContent: 'center',
  },
  dash: {
    marginHorizontal: 12,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: GOLD,
  },
  notchLeft: {
    position: 'absolute',
    left: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: NAVY,
  },
  notchRight: {
    position: 'absolute',
    right: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: NAVY,
  },
  fields: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 8,
    rowGap: 8,
  },
  field: {
    width: '33.33%',
    paddingRight: 6,
  },
  fieldLbl: {
    color: 'rgba(26,47,74,0.5)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  fieldVal: {
    color: PASS_NAVY,
    fontSize: 13,
    fontWeight: '800',
  },
  you: {
    color: GOLD,
    fontWeight: '800',
    letterSpacing: 1,
  },
  seatRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cursor: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '400',
    marginTop: -1,
  },
  barcode: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 1.5,
    height: 24,
    paddingHorizontal: 14,
    paddingBottom: 8,
    overflow: 'hidden',
  },
  cta: {
    marginHorizontal: 12,
    marginBottom: 12,
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaTxt: {
    color: NAVY,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

function MiniPassMark({ w = 40, h = 24 }: { w?: number; h?: number }) {
  return <BoardingPassMark w={w} h={h} />;
}

export function HeaderBookButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={t().tickets}
      style={ui.headerBtn}
    >
      <BoardingPassMark w={36} h={22} />
      <Text style={ui.headerBtnTxt}>{t().tickets}</Text>
    </TouchableOpacity>
  );
}

export function BookTicketHintBar({
  onPress,
  onDismiss,
}: {
  onPress: () => void;
  onDismiss: () => void;
}) {
  const copy = t();
  return (
    <View style={ui.hintBar}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        style={ui.hintMain}
        accessibilityRole="button"
        accessibilityLabel={copy.bookTicketHint}
      >
        <MiniPassMark w={32} h={20} />
        <Text style={ui.hintTxt} numberOfLines={2}>{copy.bookTicketHint}</Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onDismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={copy.bookTicketHintDismiss}
        style={ui.hintClose}
      >
        <X size={12} color={NAVY} weight="bold" />
      </TouchableOpacity>
    </View>
  );
}

export function CompactBookingPass({ onPress }: { onPress: () => void }) {
  const copy = t();
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={copy.bookTicketA11y}
      style={ui.compact}
    >
      <MiniPassMark w={44} h={26} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={ui.compactTitle} numberOfLines={1}>{copy.needATicket}</Text>
        <Text style={ui.compactSub} numberOfLines={1}>{copy.bookTicketHint}</Text>
      </View>
      <Text style={ui.compactCta}>{copy.claimYourSeat}</Text>
    </TouchableOpacity>
  );
}

export function BookingTicketSheet({
  visible,
  onClose,
  onSearchFlights,
  origin,
  destination,
  flightNumber,
  date,
  gate,
}: {
  visible: boolean;
  onClose: () => void;
  onSearchFlights?: () => void;
  origin?: string;
  destination?: string;
  flightNumber?: string;
  date?: string;
  gate?: string;
}) {
  const copy = t();
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <View style={ui.sheet}>
        <View style={ui.sheetHead}>
          <View style={ui.sheetTitleRow}>
            <MiniPassMark />
            <Text style={ui.sheetTitle}>{copy.bookTicketA11y}</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={10}
            style={ui.sheetClose}
            accessibilityRole="button"
            accessibilityLabel={copy.close}
          >
            <X size={18} color="#F4F0E6" />
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={ui.sheetBody} showsVerticalScrollIndicator={false}>
          {visible ? (
            <AnimatedBookingCard
              origin={origin}
              destination={destination}
              flightNumber={flightNumber}
              date={date}
              gate={gate}
              onSearchFlights={onSearchFlights}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export async function readBookHintSeen(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(BOOK_HINT_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markBookHintSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(BOOK_HINT_KEY, '1');
  } catch {
    /* ignore */
  }
}

const ui = StyleSheet.create({
  headerBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  headerBtnTxt: {
    color: '#C9A84C',
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 12,
  },
  hintBar: {
    marginHorizontal: 16,
    marginBottom: 8,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GOLD,
    borderRadius: 12,
    paddingVertical: 6,
    paddingLeft: 8,
    paddingRight: 4,
  },
  hintMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  hintTxt: {
    flex: 1,
    color: NAVY,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  hintClose: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: NAVY,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.45)',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  compactTitle: {
    color: '#F4F0E6',
    fontSize: 14,
    fontWeight: '800',
  },
  compactSub: {
    color: 'rgba(201,168,76,0.85)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  compactCta: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    flexShrink: 0,
  },
  sheet: {
    flex: 1,
    backgroundColor: '#070D18',
    paddingTop: Platform.OS === 'ios' ? 12 : 54,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  sheetTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sheetTitle: {
    color: '#F4F0E6',
    fontSize: 16,
    fontWeight: '800',
  },
  sheetClose: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBody: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
});
