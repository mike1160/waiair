import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

/** Schiphol FIDS yellow */
export const GATE_YELLOW = '#FFD700';
export const GATE_ORANGE = '#FF8C00';
export const GATE_DARK_ORANGE = '#FF4500';
export const GATE_RED = '#FF3B30';
export const GATE_UNKNOWN_BG = '#4A5568';
export const GATE_UNKNOWN_FG = '#FFFFFF';

const BADGE_W = 88;
const BADGE_H = 72;

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

function isLightBackground(bg: string): boolean {
  return bg === GATE_YELLOW || bg === GATE_ORANGE || bg === GATE_DARK_ORANGE;
}

function isRedBackground(bg: string): boolean {
  return bg === GATE_RED;
}

function planeArrowColor(bg: string): string {
  if (isLightBackground(bg)) return 'rgba(0,0,0,0.55)';
  return 'rgba(255,255,255,0.65)';
}

/** High-contrast primary text (gate number / terminal). */
function mainTextColor(bg: string): string {
  if (isLightBackground(bg)) return '#000000';
  return '#FFFFFF';
}

function badgeFace(
  code: string,
  term: string,
  showPlaceholder: boolean,
): { main: string; label: string; terminalLine?: string } | null {
  if (code) {
    return {
      main: code,
      label: 'Gate',
      terminalLine: term || undefined,
    };
  }
  if (term) {
    return { main: term, label: 'Terminal' };
  }
  if (showPlaceholder) {
    return { main: '—', label: 'Gate' };
  }
  return null;
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
  if (!code) return null;
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
  const wrapStyle = [
    styles.badge,
    compact && styles.badgeCompact,
    { backgroundColor: urgency.bg, minHeight: BADGE_H, ...(urgency.pulseMs ? { opacity } : null) },
  ];

  const mainColor = mainTextColor(urgency.bg);
  const terminalColor = mainTextColor(urgency.bg);

  return (
    <Wrap style={wrapStyle}>
      <Text
        style={[styles.cornerIcon, { color: planeArrowColor(urgency.bg) }]}
        allowFontScaling={false}
        pointerEvents="none"
      >
        ✈ ↗
      </Text>
      <View style={styles.center} pointerEvents="none">
        <Text
          style={[styles.main, { color: mainColor }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {face.main}
        </Text>
        <Text
          style={[styles.label, { color: mainColor }]}
          numberOfLines={1}
          allowFontScaling={false}
        >
          {face.label}
        </Text>
        {face.terminalLine ? (
          <Text
            style={[styles.terminal, { color: terminalColor }]}
            numberOfLines={1}
            allowFontScaling={false}
          >
            {face.terminalLine}
          </Text>
        ) : null}
      </View>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-end',
    flexShrink: 0,
    position: 'relative',
    overflow: 'visible',
    width: BADGE_W,
    minWidth: BADGE_W,
    maxWidth: BADGE_W,
    minHeight: BADGE_H,
    height: BADGE_H,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 5,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  badgeCompact: {
    width: BADGE_W,
    minWidth: BADGE_W,
    maxWidth: BADGE_W,
    minHeight: BADGE_H,
    height: BADGE_H,
  },
  cornerIcon: {
    position: 'absolute',
    top: 5,
    left: 5,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0.2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  main: {
    fontSize: 26,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 28,
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.15,
    opacity: 0.75,
  },
  terminal: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 2,
    letterSpacing: 0.1,
    opacity: 1,
  },
});
