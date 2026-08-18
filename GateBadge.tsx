import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Schiphol FIDS yellow */
export const GATE_YELLOW = '#FFD700';
export const GATE_ORANGE = '#FF8C00';
export const GATE_DARK_ORANGE = '#FF4500';
export const GATE_RED = '#FF0000';
export const GATE_UNKNOWN_BG = '#C8C8C8';
export const GATE_UNKNOWN_FG = '#3A3A3A';

const LABEL_MUTED = '#C9A84C';
const BADGE_W = 90;
const BADGE_H = 52;
const ICON_SIZE = 9;

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

function badgeFace(
  code: string,
  term: string,
  showPlaceholder: boolean,
): { main: string; bottomLabel: string } | null {
  if (code) {
    return {
      main: code,
      bottomLabel: term ? `Gate · ${term}` : 'Gate',
    };
  }
  if (term) {
    return { main: term, bottomLabel: 'Terminal' };
  }
  if (showPlaceholder) {
    return { main: '—', bottomLabel: 'Gate' };
  }
  return null;
}

function iconTint(urgency: GateUrgency): string {
  if (urgency.bg === GATE_UNKNOWN_BG) return '#6B7280';
  if (urgency.fg === '#FFFFFF') return 'rgba(255,255,255,0.82)';
  return LABEL_MUTED;
}

function labelTint(urgency: GateUrgency): string {
  if (urgency.bg === GATE_UNKNOWN_BG) return '#6B7280';
  return LABEL_MUTED;
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
  const face = badgeFace(code, term, showPlaceholder);
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

  if (!face) return null;

  const Wrap = urgency.pulseMs ? Animated.View : View;
  const accent = iconTint(urgency);
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
      <View style={styles.iconRow} pointerEvents="none">
        <Ionicons name="airplane" size={ICON_SIZE} color={accent} style={styles.planeIcon} />
        <Ionicons name="arrow-up" size={ICON_SIZE} color={accent} style={styles.arrowIcon} />
      </View>
      <Text
        style={[styles.main, { color: urgency.fg }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {face.main}
      </Text>
      <Text
        style={[styles.bottomLabel, { color: labelTint(urgency) }]}
        numberOfLines={1}
        allowFontScaling={false}
      >
        {face.bottomLabel}
      </Text>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-end',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
    width: BADGE_W,
    minWidth: BADGE_W,
    maxWidth: BADGE_W,
    height: BADGE_H,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingTop: 5,
    paddingBottom: 4,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
  },
  badgeCompact: {
    width: BADGE_W,
    minWidth: BADGE_W,
    maxWidth: BADGE_W,
    height: BADGE_H,
  },
  badgeInner: {
    ...StyleSheet.absoluteFill,
    borderRadius: 11,
    borderWidth: 0.5,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: 1,
    paddingLeft: 1,
  },
  planeIcon: {
    transform: [{ rotate: '-45deg' }],
  },
  arrowIcon: {
    transform: [{ rotate: '45deg' }],
  },
  main: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 24,
    letterSpacing: 0.3,
    width: '100%',
  },
  bottomLabel: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
    marginTop: 1,
    width: '100%',
  },
});
