import { useIsAirport } from './lib/modeContext';
import { AIRPORT_BOARD, MONO } from './lib/themes';

/** Airport-mode status colours: green on time, amber moving, red trouble, grey done. */
const AIRPORT_TONE: Record<string, string> = {
  active: AIRPORT_BOARD.amber,
  delayed: AIRPORT_BOARD.red,
  scheduled: AIRPORT_BOARD.green,
  landed: AIRPORT_BOARD.soft,
  cancelled: AIRPORT_BOARD.red,
};
import { StyleSheet, Text, View } from 'react-native';
import {
  STATUS_PILL_TONES,
  resolveStatusPillTone,
  statusPillToneFromPhase,
  type StatusPillTone,
} from './lib/statusPill';

export type StatusBadgeTone = StatusPillTone;
export {
  STATUS_PILL_TONES,
  statusPillToneFromPhase,
  statusPillToneFromPhase as statusBadgeToneFromPhase,
};

/** Flight-status chip that always sizes to its label — never ellipsizes. */
export default function FlightStatusBadge({
  label,
  tone,
  liveDot = false,
}: {
  label: string;
  tone?: StatusPillTone | string;
  liveDot?: boolean;
}) {
  const resolved = resolveStatusPillTone(tone);
  // Airport mode: a board status — monospace, always upper case, square, no fill, in the board's own colours
  // (the regular pill colours are made for light cards; "landed" navy vanished on the black board).
  const airport = useIsAirport();
  const palette = airport ? { bg: 'transparent', fg: AIRPORT_TONE[resolved] } : STATUS_PILL_TONES[resolved];
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: palette.bg,
          borderColor: `${palette.fg}80`,
        },
        airport && { borderRadius: 0, backgroundColor: 'transparent', borderColor: palette.fg },
      ]}
    >
      {liveDot ? <View style={[styles.dot, { backgroundColor: palette.fg }]} /> : null}
      <Text
        style={[styles.txt, { color: palette.fg }, airport && { fontFamily: MONO, letterSpacing: 1 }]}
        allowFontScaling={false}
      >
        {airport ? label.toUpperCase() : label}
      </Text>
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
