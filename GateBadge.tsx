import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Door } from 'phosphor-react-native';

export const GATE_DEP = '#FF8A00';
export const GATE_LAST = '#FF3B30';
export const GATE_DARK = '#1a1d27';
export const GATE_GOLD = '#C9A84C';

export type GateTone = 'normal' | 'boarding' | 'lastCall';

type GateKind = 'departure' | 'arrival' | 'none';

export function hasRealGate(gate?: string): boolean {
  const g = String(gate || '').trim();
  return !!g && !/^(—|-|–|n\/?a|tba|tbd|null|undefined|\.+)$/i.test(g);
}

/** "Terminal 2" / "2" / "T2" → "T2". Letter concourses stay "D" (never "TD"). */
export function compactTerminal(terminal?: string): string {
  const raw = String(terminal || '').trim();
  if (!raw || raw === '—' || /^(-|–|n\/?a|tba|tbd)$/i.test(raw)) return '';
  const body = raw.replace(/^terminal\s+/i, '').replace(/\s+/g, '');
  if (!body) return '';
  if (/^t\d/i.test(body)) return body.toUpperCase();
  if (/^\d/.test(body)) return `T${body}`;
  return body.toUpperCase();
}

function gateNumber(gate?: string): string {
  return String(gate || '').trim().replace(/^gate\s+/i, '');
}

function CompactGateFace({
  gate,
  terminal,
  color,
}: {
  gate: string;
  terminal: string;
  color: string;
}) {
  const g = gate;
  const t = terminal;
  const long = g.length >= 3;
  const gateSize = long ? 13 : g.length <= 2 ? 16 : 14;
  if (t && g) {
    return (
      <View style={styles.stack}>
        <Text style={[styles.termLine, { color }]} allowFontScaling={false}>{t}</Text>
        <Text style={[styles.gateLine, { color, fontSize: long ? 13 : 15 }]} allowFontScaling={false}>{g}</Text>
      </View>
    );
  }
  return (
    <Text style={[styles.gateLine, { color, fontSize: gateSize }]} allowFontScaling={false}>
      {g || t}
    </Text>
  );
}

export default function GateBadge({
  type,
  gate,
  terminal,
  previousGate,
  secondary,
  tone = 'normal',
  compact = false,
}: {
  type: GateKind;
  gate?: string;
  terminal?: string;
  previousGate?: string;
  secondary: string;
  tone?: GateTone;
  compact?: boolean;
}) {
  const termLabel = compactTerminal(terminal);
  const hasGate = hasRealGate(gate);
  const kind: GateKind = type === 'none' ? 'departure' : type;
  const label = hasGate ? gateNumber(gate) : '';
  const prev = gateNumber(previousGate);
  const changed = !!prev && hasRealGate(prev) && prev.toUpperCase() !== label.toUpperCase();
  const boarding = tone === 'boarding';
  const lastCall = tone === 'lastCall';
  const compactBg = lastCall ? GATE_LAST : boarding ? GATE_DEP : GATE_GOLD;
  const fullBg = lastCall ? GATE_LAST : boarding ? GATE_DEP : GATE_DARK;
  const compactFg = compactBg === GATE_GOLD ? '#1A1408' : '#ffffff';

  const scale = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!boarding && !lastCall) {
      scale.setValue(1);
      return;
    }
    const peak = lastCall ? 1.12 : 1.08;
    const dur = lastCall ? 400 : 1000;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: peak, duration: dur, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: dur, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [boarding, lastCall, scale]);

  useEffect(() => {
    if (!changed) {
      flash.setValue(0);
      return;
    }
    const seq = Animated.sequence(
      [0, 1, 2].flatMap(() => [
        Animated.timing(flash, { toValue: 1, duration: 160, useNativeDriver: false }),
        Animated.timing(flash, { toValue: 0, duration: 160, useNativeDriver: false }),
      ]),
    );
    seq.start();
    return () => seq.stop();
  }, [changed, label, flash]);

  const bg = flash.interpolate({
    inputRange: [0, 1],
    outputRange: [compact ? compactBg : fullBg, '#ffffff'],
  });

  if (!hasGate && !termLabel) return null;

  if (compact) {
    return (
      <Animated.View style={{ transform: [{ scale }] }}>
        <Animated.View
          style={[
            styles.compactBadge,
            { backgroundColor: changed ? bg : compactBg },
          ]}
        >
          {changed ? (
            <Text style={[styles.oldGate, { color: compactFg }]} allowFontScaling={false}>{prev}</Text>
          ) : null}
          <CompactGateFace gate={label} terminal={termLabel} color={compactFg} />
        </Animated.View>
      </Animated.View>
    );
  }

  const title = label ? `GATE ${label}` : termLabel;
  const long = title.replace(/\s/g, '').length >= 7;

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {(boarding || lastCall) ? (
          <View
            pointerEvents="none"
            style={[styles.glow, { backgroundColor: fullBg, opacity: lastCall ? 0.45 : 0.28 }]}
          />
        ) : null}
        <Animated.View style={[
          styles.fullBadge,
          { backgroundColor: changed ? bg : fullBg },
        ]}>
          <Door size={13} color="rgba(255,255,255,0.72)" />
          {changed ? (
            <Text style={styles.oldGate}>{prev}</Text>
          ) : (
            <Text style={styles.arrow}>{kind === 'arrival' ? '↘' : '↗'}</Text>
          )}
          <Text
            style={[styles.fullTxt, long && styles.fullTxtLong]}
            allowFontScaling={false}
          >
            {title}
          </Text>
          {termLabel && label ? (
            <Text style={styles.fullTerm} allowFontScaling={false}>{termLabel}</Text>
          ) : null}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'flex-start' },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
  },
  compactBadge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 10,
  },
  stack: { alignItems: 'center', justifyContent: 'center' },
  termLine: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  gateLine: {
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  fullBadge: {
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
    minHeight: 52,
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 8,
    borderRadius: 14,
  },
  arrow: {
    position: 'absolute',
    top: 5,
    left: 7,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
  },
  oldGate: {
    fontSize: 9,
    fontWeight: '700',
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 1,
  },
  fullTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  fullTxtLong: { fontSize: 13 },
  fullTerm: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
});
