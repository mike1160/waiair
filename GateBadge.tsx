import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

/** Schiphol FIDS yellow */
export const GATE_YELLOW = '#FFD700';
export const GATE_ORANGE = '#FF8C00';
export const GATE_DARK_ORANGE = '#FF4500';
export const GATE_RED = '#FF0000';
export const GATE_UNKNOWN_BG = '#C8C8C8';
export const GATE_UNKNOWN_FG = '#3A3A3A';

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

/** Strip an existing "Gate" prefix so we can always render "GATE B31". */
export function gateCodeOnly(gate?: string): string {
  const raw = String(gate || '').trim();
  if (!hasRealGate(raw)) return '';
  const stripped = raw.replace(/^gates?\s*:?\s*/i, '').trim();
  return hasRealGate(stripped) ? stripped : '';
}

/** Share / status copy: "Gate: D" / "Gate: B31". */
export function formatGateLabel(gate?: string, fallbackDash = false): string {
  const code = gateCodeOnly(gate);
  if (code) return `Gate: ${code}`;
  return fallbackDash ? 'Gate: —' : '';
}

/** Badge face: "Gate: D" / "Gate: 11". */
export function formatGateBadgeText(gate?: string, fallbackDash = false): string {
  return formatGateLabel(gate, fallbackDash);
}

export type GateUrgency = {
  bg: string;
  fg: string;
  /** Full pulse cycle in ms; 0 = no pulse */
  pulseMs: number;
};

const URGENCY_IDLE: GateUrgency = { bg: GATE_YELLOW, fg: '#000000', pulseMs: 0 };
const URGENCY_UNKNOWN: GateUrgency = { bg: GATE_UNKNOWN_BG, fg: GATE_UNKNOWN_FG, pulseMs: 0 };

function parseDepMs(iso?: string): number | null {
  if (!iso) return null;
  const s = String(iso).trim();
  if (!s) return null;
  const t = Date.parse(s.includes('T') ? s : s.replace(' ', 'T'));
  return Number.isFinite(t) ? t : null;
}

/**
 * Minutes until departure (not interaction, not theme).
 * >30 yellow · 20–30 orange · 10–20 dark orange · <10 red + pulse
 */
export function gateUrgencyFor(
  departureIso?: string,
  status?: string,
  now = Date.now(),
): GateUrgency {
  const st = String(status || '');
  if (st === 'cancelled' || st === 'en-route' || st === 'landed') return URGENCY_IDLE;
  const dep = parseDepMs(departureIso);
  if (dep == null) return URGENCY_IDLE;
  const mins = (dep - now) / 60000;
  if (mins >= 30) return URGENCY_IDLE;
  if (mins >= 20) return { bg: GATE_ORANGE, fg: '#000000', pulseMs: 0 };
  if (mins >= 10) return { bg: GATE_DARK_ORANGE, fg: '#000000', pulseMs: 0 };
  return { bg: GATE_RED, fg: '#FFFFFF', pulseMs: 400 };
}

export default function GateBadge({
  gate,
  terminal,
  compact = false,
  departureIso,
  status,
  showPlaceholder = false,
}: {
  type?: GateKind;
  gate?: string;
  terminal?: string;
  previousGate?: string;
  secondary?: string;
  compact?: boolean;
  departureIso?: string;
  status?: string;
  skin?: 'schiphol' | 'spotter';
  showPlaceholder?: boolean;
  colon?: boolean;
}) {
  const code = gateCodeOnly(gate);
  const term = compactTerminal(terminal);
  const display = code
    ? `Gate: ${code}`
    : term
      ? `Terminal ${term}`
      : (showPlaceholder ? 'Gate: —' : '');
  const [now, setNow] = useState(() => Date.now());
  const urgency = useMemo(
    () => code
      ? gateUrgencyFor(departureIso, status, now)
      : term
        ? URGENCY_IDLE
        : URGENCY_UNKNOWN,
    [code, term, departureIso, status, now],
  );

  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!departureIso) return;
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, [departureIso]);

  useEffect(() => {
    const ms = urgency.pulseMs;
    if (!ms) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.5);
    const half = Math.max(80, Math.round(ms / 2));
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1.0, duration: half, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: half, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.setValue(1);
    };
  }, [urgency.pulseMs, opacity]);

  if (!display) return null;

  const fontSize = compact ? (display.length > 10 ? 13 : 15) : (display.length > 10 ? 15 : 17);
  const Wrap = urgency.pulseMs ? Animated.View : View;
  const wrapStyle = [
    styles.badge,
    compact && styles.badgeCompact,
    { backgroundColor: urgency.bg, ...(urgency.pulseMs ? { opacity } : null) },
  ];

  const innerBorder = urgency.fg === '#FFFFFF'
    ? 'rgba(255,255,255,0.45)'
    : 'rgba(0,0,0,0.14)';

  return (
    <Wrap style={wrapStyle}>
      <View
        pointerEvents="none"
        style={[styles.badgeInner, { borderColor: innerBorder }]}
      />
      <View style={styles.arrow} pointerEvents="none">
        <View style={styles.arrowBar} />
        <View style={styles.arrowCapH} />
        <View style={styles.arrowCapV} />
      </View>
      <Text
        style={[styles.label, { color: urgency.fg, fontSize }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {display}
      </Text>
    </Wrap>
  );
}

const ARROW = '#000000';

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-end',
    flexShrink: 0,
    position: 'relative',
    overflow: 'visible',
    minWidth: 90,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 7,
    paddingHorizontal: 14,
    paddingLeft: 18,
    borderRadius: 10,
  },
  badgeCompact: {
    paddingTop: 13,
    paddingBottom: 6,
    paddingHorizontal: 12,
    paddingLeft: 16,
  },
  badgeInner: {
    ...StyleSheet.absoluteFill,
    borderRadius: 9,
    borderWidth: 0.5,
  },
  arrow: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: 9,
    height: 9,
  },
  arrowBar: {
    position: 'absolute',
    width: 1.5,
    height: 10,
    left: 4,
    top: -0.5,
    backgroundColor: ARROW,
    transform: [{ rotate: '45deg' }],
    borderRadius: 1,
  },
  arrowCapH: {
    position: 'absolute',
    height: 1.5,
    width: 5.5,
    top: 0,
    right: 0,
    backgroundColor: ARROW,
    borderRadius: 1,
  },
  arrowCapV: {
    position: 'absolute',
    width: 1.5,
    height: 5.5,
    top: 0,
    right: 0,
    backgroundColor: ARROW,
    borderRadius: 1,
  },
  label: {
    fontWeight: '900',
    letterSpacing: 0.5,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
