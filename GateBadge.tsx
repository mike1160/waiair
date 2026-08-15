import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Buildings, Door } from 'phosphor-react-native';

export const GATE_DEP = '#FF8A00';
export const GATE_LAST = '#D32F2F';
export const GATE_DARK = '#1a1d27';

export type GateTone = 'normal' | 'boarding' | 'lastCall';

type GateKind = 'departure' | 'arrival' | 'none';

export function hasRealGate(gate?: string): boolean {
  const g = String(gate || '').trim();
  return !!g && !/^(—|-|–|n\/?a|tba|tbd|null|undefined|\.+)$/i.test(g);
}

/** "Terminal 2" / "2" / "T2" → "T2" so the label never truncates. */
export function compactTerminal(terminal?: string): string {
  const raw = String(terminal || '').trim();
  if (!raw || raw === '—' || /^(-|–|n\/?a|tba|tbd)$/i.test(raw)) return '';
  const body = raw.replace(/^terminal\s+/i, '').replace(/\s+/g, '');
  if (!body) return '';
  if (/^t/i.test(body)) return body.toUpperCase();
  return `T${body}`;
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
  if (!hasRealGate(gate)) return null;
  const kind: GateKind = type === 'none' ? 'departure' : type;
  const label = String(gate).trim().replace(/^gate\s+/i, '');
  const termLabel = compactTerminal(terminal);
  const prev = String(previousGate || '').trim().replace(/^gate\s+/i, '');
  const changed = !!prev && hasRealGate(prev) && prev.toUpperCase() !== label.toUpperCase();
  const boarding = tone === 'boarding';
  const lastCall = tone === 'lastCall';
  const accent = lastCall ? GATE_LAST : boarding ? GATE_DEP : GATE_DARK;
  const size = compact
    ? (boarding || lastCall ? 52 : 44)
    : (boarding ? 72 : lastCall ? 64 : 56);

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
    outputRange: [accent, '#ffffff'],
  });

  return (
    <View style={[styles.wrap, { width: size + 8 }]}>
      <Animated.View style={[styles.badgeWrap, { width: size, height: size, transform: [{ scale }] }]}>
        {(boarding || lastCall) ? (
          <View
            pointerEvents="none"
            style={[styles.glow, { backgroundColor: accent, opacity: lastCall ? 0.45 : 0.28 }]}
          />
        ) : null}
        <Animated.View style={[
          styles.badge,
          {
            width: size,
            height: size,
            backgroundColor: changed ? bg : accent,
            borderRadius: compact ? 12 : 14,
          },
        ]}>
          <Door size={compact ? 11 : 13} color="rgba(255,255,255,0.72)" />
          {changed ? (
            <Text style={styles.oldGate} numberOfLines={1}>{prev}</Text>
          ) : (
            <Text style={styles.arrow}>{kind === 'arrival' ? '↘' : '↗'}</Text>
          )}
          <Text style={[styles.gate, compact && styles.gateSm]} numberOfLines={1}>{label}</Text>
        </Animated.View>
      </Animated.View>
      {termLabel ? (
        <View style={styles.termRow}>
          <Buildings size={10} color={secondary} />
          <Text style={[styles.term, { color: secondary }]} numberOfLines={1}>
            {termLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  badgeWrap: { alignItems: 'center', justifyContent: 'center' },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 20,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 1,
  },
  arrow: {
    position: 'absolute',
    top: 6,
    left: 8,
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '700',
  },
  oldGate: {
    position: 'absolute',
    top: 6,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  gate: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginTop: 2,
  },
  gateSm: { fontSize: 18 },
  termRow: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  term: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
});
