import { useEffect, useRef, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Clipboard, EnvelopeSimple, QrCode } from 'phosphor-react-native';
import { haptics } from './lib/haptics';

const NAVY = '#0D1B2E';
const GOLD = '#C9A84C';
const CREAM = '#F5F0E8';
const MUTED = '#8896B0';
const SIZE = 78;

type Props = {
  gmailBusy?: boolean;
  showGmailTrial?: boolean;
  trialLabel: string;
  gmailLabel: string;
  pasteLabel: string;
  scanLabel: string;
  onGmail: () => void;
  onPaste: () => void;
  onScan: () => void;
};

function Bubble({
  delay,
  color,
  label,
  pill,
  busy,
  onPress,
  children,
}: {
  delay: number;
  color: string;
  label: string;
  pill?: string;
  busy?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const bob = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: -7,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bob, {
          toValue: 7,
          duration: 2600,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    const t = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [bob, delay]);

  const tap = () => {
    haptics.light();
    Animated.parallel([
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 110, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(glow, { toValue: 1, duration: 110, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 420, useNativeDriver: true }),
      ]),
    ]).start();
    onPress();
  };

  const ring = SIZE + 18;

  return (
    <View style={st.col}>
      <Animated.View style={{ transform: [{ translateY: bob }, { scale }] }}>
        <Animated.View
          pointerEvents="none"
          style={[
            st.glow,
            {
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              opacity: glow,
            },
          ]}
        />
        <Pressable
          onPress={tap}
          accessibilityRole="button"
          accessibilityLabel={label}
          style={[st.dot, { backgroundColor: color }]}
        >
          {busy ? <ActivityIndicator color="#fff" /> : children}
        </Pressable>
      </Animated.View>
      <Text style={st.label}>{label}</Text>
      {pill ? (
        <View style={st.pill}>
          <Text style={st.pillTxt}>{pill}</Text>
        </View>
      ) : (
        <View style={st.pillSpacer} />
      )}
    </View>
  );
}

export default function TripExtrasBubbleRow({
  gmailBusy,
  showGmailTrial,
  trialLabel,
  gmailLabel,
  pasteLabel,
  scanLabel,
  onGmail,
  onPaste,
  onScan,
}: Props) {
  return (
    <View style={st.card}>
      <View style={st.row}>
        <Bubble
          delay={0}
          color="#EA4335"
          label={gmailLabel}
          pill={showGmailTrial ? trialLabel : undefined}
          busy={gmailBusy}
          onPress={onGmail}
        >
          <EnvelopeSimple size={32} color="#fff" weight="bold" />
        </Bubble>
        <Bubble
          delay={180}
          color="#1D4E89"
          label={pasteLabel}
          onPress={onPaste}
        >
          <Clipboard size={32} color="#fff" weight="bold" />
        </Bubble>
        <Bubble
          delay={360}
          color="#0F6B4C"
          label={scanLabel}
          onPress={onScan}
        >
          <QrCode size={32} color="#fff" weight="bold" />
        </Bubble>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    backgroundColor: NAVY,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.32)',
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 8,
    marginBottom: 14,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
  },
  col: {
    width: 96,
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    left: (96 - (SIZE + 18)) / 2,
    top: -9,
    borderWidth: 2,
    borderColor: GOLD,
    backgroundColor: 'rgba(201,168,76,0.18)',
  },
  dot: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  label: {
    color: CREAM,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 8,
  },
  pill: {
    marginTop: 5,
    backgroundColor: GOLD,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillTxt: {
    color: NAVY,
    fontSize: 10,
    fontWeight: '800',
  },
  pillSpacer: {
    height: 21,
    marginTop: 5,
  },
});
