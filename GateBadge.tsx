import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Buildings, Door } from 'phosphor-react-native';

export const GATE_DEP = '#FF8A00';
export const GATE_LAST = '#FF3B30';
export const GATE_DARK = '#1a1d27';

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
  const accent = lastCall ? GATE_LAST : boarding ? GATE_DEP : GATE_DARK;
  const title = label ? `GATE ${label}` : termLabel;
  const long = title.replace(/\s/g, '').length >= 7;

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

  if (!hasGate && !termLabel) return null;

  return (
    <View style={styles.wrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        {(boarding || lastCall) ? (
          <View
            pointerEvents="none"
            style={[styles.glow, { backgroundColor: accent, opacity: lastCall ? 0.45 : 0.28 }]}
          />
        ) : null}
        <Animated.View style={[
          styles.badge,
          compact ? styles.badgeCompact : styles.badgeFull,
          { backgroundColor: changed ? bg : accent },
        ]}>
          <Door size={compact ? 11 : 13} color="rgba(255,255,255,0.72)" />
          {changed ? (
            <Text style={styles.oldGate}>{prev}</Text>
          ) : (
            <Text style={styles.arrow}>{kind === 'arrival' ? '↘' : '↗'}</Text>
          )}
          <Text
            style={[
              styles.gateTxt,
              compact ? styles.gateTxtCompact : styles.gateTxtFull,
              long && (compact ? styles.gateTxtLongSm : styles.gateTxtLong),
            ]}
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.65}
          >
            {title}
          </Text>
        </Animated.View>
      </Animated.View>
      {termLabel && label ? (
        <View style={styles.termRow}>
          <Buildings size={10} color={secondary} />
          <Text style={[styles.term, { color: secondary }]}>
            {termLabel}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', alignSelf: 'flex-start' },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingTop: 14,
    paddingBottom: 8,
  },
  badgeCompact: {
    minWidth: 58,
    minHeight: 44,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 6,
  },
  badgeFull: {
    minWidth: 72,
    minHeight: 52,
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
    position: 'absolute',
    top: 5,
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    textDecorationLine: 'line-through',
  },
  gateTxt: {
    color: '#ffffff',
    fontWeight: '800',
    letterSpacing: 0.2,
    textAlign: 'center',
    flexShrink: 0,
  },
  gateTxtFull: { fontSize: 15 },
  gateTxtCompact: { fontSize: 12 },
  gateTxtLong: { fontSize: 13 },
  gateTxtLongSm: { fontSize: 11 },
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
