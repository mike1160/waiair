import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { runWhileAppActive, startLoopWhileActive } from './lib/appActivity';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';

/** Schiphol FIDS yellow */
export const GATE_YELLOW = '#FFD700';
export const GATE_ORANGE = '#FF8C00';
export const GATE_DARK_ORANGE = '#FF4500';
export const GATE_RED = '#FF3B30';
/** Pickup signal: passenger is landing / has landed */
export const GATE_GREEN = '#00C853';
export const GATE_UNKNOWN_BG = '#4A5568';
export const GATE_UNKNOWN_FG = '#FFFFFF';

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

/** Strip an existing "Gate" prefix so we can always render "Gate: B31". */
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
  closed?: boolean;
};

const URGENCY_IDLE: GateUrgency = { bg: GATE_YELLOW, fg: '#000000', pulseMs: 0 };
const URGENCY_ARRIVAL_LANDED: GateUrgency = { bg: GATE_GREEN, fg: '#000000', pulseMs: 0 };
const URGENCY_PLACEHOLDER: GateUrgency = { bg: GATE_UNKNOWN_BG, fg: GATE_UNKNOWN_FG, pulseMs: 0 };

function parseEventMs(iso?: string, iata?: string, country?: string): number | null {
  if (!iso) return null;
  const s = String(iso).trim();
  if (!s) return null;
  return isoInAirportTzToUtcMs(s.includes('T') ? s : s.replace(' ', 'T'), iata, country);
}

/**
 * Departure: minutes until departure (gate closing — red = urgent).
 * >30 yellow · 20–30 orange pulse 2s · 10–20 red pulse 1s · <10 red pulse 0.4s
 *
 * Arrival: minutes until arrival (pickup — all pulses green).
 * Landed: solid green, no pulse.
 * >30 yellow · 20–30 green pulse 2s · 10–20 green pulse 1s · 0–10 green pulse 0.4s
 */
export function gateUrgencyFor(
  eventIso?: string,
  status?: string,
  now = Date.now(),
  iata?: string,
  country?: string,
  kind: GateKind = 'departure',
): GateUrgency {
  const st = String(status || '');
  if (st === 'cancelled') return URGENCY_IDLE;
  if (kind === 'arrival' && st === 'landed') return URGENCY_ARRIVAL_LANDED;
  const at = parseEventMs(eventIso, iata, country);
  if (at == null) return URGENCY_IDLE;
  const mins = (at - now) / 60000;
  if (kind === 'arrival') {
    if (mins >= 30) return URGENCY_IDLE;
    if (mins >= 20) return { bg: GATE_GREEN, fg: '#000000', pulseMs: 2000 };
    if (mins >= 10) return { bg: GATE_GREEN, fg: '#000000', pulseMs: 1000 };
    // 0–10 min, or past ETA but not yet marked landed
    return { bg: GATE_GREEN, fg: '#000000', pulseMs: 400 };
  }
  if (mins >= 30) return URGENCY_IDLE;
  if (mins >= 20) return { bg: GATE_ORANGE, fg: '#000000', pulseMs: 2000 };
  if (mins >= 10) return { bg: GATE_RED, fg: '#000000', pulseMs: 1000 };
  if (mins >= 0) return { bg: GATE_RED, fg: '#000000', pulseMs: 400 };
  return URGENCY_IDLE;
}

export default function GateBadge({
  type = 'departure',
  gate,
  compact = false,
  departureIso,
  status,
  originIata,
  originCountry,
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
  closed?: boolean;
  originIata?: string;
  originCountry?: string;
}) {
  const label = formatGateLabel(gate, true);
  const known = hasRealGate(gate);
  const kind: GateKind = type === 'arrival' ? 'arrival' : 'departure';
  const [now, setNow] = useState(() => Date.now());
  const urgency = useMemo(
    () => known
      ? gateUrgencyFor(departureIso, status, now, originIata, originCountry, kind)
      : URGENCY_PLACEHOLDER,
    [known, departureIso, status, now, originIata, originCountry, kind],
  );

  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!departureIso || !known) return;
    return runWhileAppActive(() => {
      const id = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(id);
    });
  }, [departureIso, known]);

  useEffect(() => {
    const ms = urgency.pulseMs;
    if (!ms) {
      opacity.setValue(1);
      return;
    }
    return startLoopWhileActive(() => {
      const half = Math.max(80, Math.round(ms / 2));
      opacity.setValue(0.55);
      return Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: half, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.55, duration: half, useNativeDriver: true }),
        ]),
      );
    });
  }, [urgency.pulseMs, opacity]);

  const Wrap = urgency.pulseMs ? Animated.View : View;

  return (
    <Wrap
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: urgency.bg, ...(urgency.pulseMs ? { opacity } : null) },
      ]}
    >
      <Text
        style={[styles.txt, { color: urgency.fg }]}
        allowFontScaling={false}
      >
        {label}
      </Text>
    </Wrap>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-end',
    flexShrink: 0,
    flexGrow: 0,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeCompact: {
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  txt: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.15,
    color: '#000000',
  },
});
