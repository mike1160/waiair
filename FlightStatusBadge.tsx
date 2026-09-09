import { StyleSheet, Text, View } from 'react-native';
import { PALETTE_TOKENS } from './lib/themeTokens';

export type StatusBadgeTone =
  | 'enRoute'
  | 'landed'
  | 'gateClosed'
  | 'delayed'
  | 'cancelled'
  | 'boarding'
  | 'onTime';

const P = PALETTE_TOKENS.light;

/** Gold pill — boarding + in flight (same as “Boarding now” on home). */
const GOLD_PILL = { bg: '#2A2000', fg: P.gold };
/** Landed — navy on cream. */
const LANDED_PILL = { bg: P.bg, fg: P.navy };
/** Cancelled. */
const CANCELLED_PILL = { bg: 'rgba(220, 38, 38, 0.14)', fg: P.statusRed };

const TONES: Record<StatusBadgeTone, { bg: string; fg: string }> = {
  boarding: GOLD_PILL,
  enRoute: GOLD_PILL,
  delayed: GOLD_PILL,
  gateClosed: GOLD_PILL,
  landed: LANDED_PILL,
  onTime: LANDED_PILL,
  cancelled: CANCELLED_PILL,
};

export function statusBadgeToneFromPhase(
  phase?: string | null,
  opts?: { boarding?: boolean; delayed?: boolean; cancelled?: boolean },
): StatusBadgeTone {
  const raw = String(phase || '').toLowerCase().replace(/[_\s]+/g, '-');
  if (opts?.cancelled || raw === 'cancelled' || raw === 'canceled' || raw === 'diverted') {
    return 'cancelled';
  }
  if (raw === 'landed' || raw === 'arrived' || raw === 'baggage' || raw === 'transport' || raw === 'done') {
    return 'landed';
  }
  if (
    opts?.boarding
    || raw === 'boarding'
    || raw === 'last-call'
    || raw === 'lastcall'
    || raw === 'enroute'
    || raw === 'en-route'
    || raw === 'in-flight'
    || raw === 'departed'
    || raw === 'gateclosed'
    || raw === 'gate-closed'
    || opts?.delayed
    || raw === 'delayed'
  ) {
    return 'boarding';
  }
  return 'onTime';
}

/** Flight-status chip that always sizes to its label — never ellipsizes. */
export default function FlightStatusBadge({
  label,
  tone,
  liveDot = false,
}: {
  label: string;
  tone?: StatusBadgeTone;
  liveDot?: boolean;
}) {
  const palette = TONES[tone || 'onTime'];
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: palette.bg,
          borderColor: `${palette.fg}80`,
        },
      ]}
    >
      {liveDot ? <View style={[styles.dot, { backgroundColor: palette.fg }]} /> : null}
      <Text style={[styles.txt, { color: palette.fg }]} allowFontScaling={false}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 0.5,
    overflow: 'visible',
  },
  txt: {
    fontSize: 12,
    fontWeight: '700',
    flexGrow: 0,
    flexShrink: 0,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
});
