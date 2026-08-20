import { StyleSheet, Text, View } from 'react-native';

export type StatusBadgeTone =
  | 'enRoute'
  | 'landed'
  | 'gateClosed'
  | 'delayed'
  | 'cancelled'
  | 'boarding'
  | 'onTime';

const TONES: Record<StatusBadgeTone, { bg: string; fg: string }> = {
  enRoute: { bg: '#1A4A8A', fg: '#6BB8FF' },
  landed: { bg: '#1A4A2A', fg: '#00C853' },
  gateClosed: { bg: '#2A2A2A', fg: '#AAAAAA' },
  delayed: { bg: '#3A2A00', fg: '#FFB300' },
  cancelled: { bg: '#3A0A0A', fg: '#FF6B6B' },
  boarding: { bg: '#2A2000', fg: '#C9A84C' },
  onTime: { bg: '#1A4A2A', fg: '#00C853' },
};

export function statusBadgeToneFromPhase(
  phase?: string | null,
  opts?: { boarding?: boolean; delayed?: boolean; cancelled?: boolean },
): StatusBadgeTone {
  if (opts?.cancelled || phase === 'cancelled') return 'cancelled';
  if (phase === 'landed') return 'landed';
  if (phase === 'enRoute' || phase === 'departed') return 'enRoute';
  if (phase === 'gateClosed') return 'gateClosed';
  if (opts?.boarding || phase === 'boarding') return 'boarding';
  if (opts?.delayed || phase === 'delayed') return 'delayed';
  return 'onTime';
}

/** Flight-status chip that always sizes to its label — never ellipsizes. */
export default function FlightStatusBadge({
  label,
  color,
  tone,
  filled = false,
  filledTextColor,
  liveDot = false,
}: {
  label: string;
  color?: string;
  tone?: StatusBadgeTone;
  filled?: boolean;
  filledTextColor?: string;
  liveDot?: boolean;
}) {
  const palette = tone ? TONES[tone] : null;
  const bg = palette?.bg ?? (filled && color ? color : color) ?? TONES.onTime.bg;
  const fg = palette?.fg ?? (filled ? (filledTextColor || '#000000') : color) ?? TONES.onTime.fg;
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: bg,
          borderColor: `${fg}80`,
        },
      ]}
    >
      {liveDot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      <Text style={[styles.txt, { color: fg }]} allowFontScaling={false}>{label}</Text>
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
