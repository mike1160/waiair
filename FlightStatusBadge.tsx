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
  const palette = STATUS_PILL_TONES[resolveStatusPillTone(tone)];
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
