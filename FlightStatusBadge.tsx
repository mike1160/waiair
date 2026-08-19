import { StyleSheet, Text, View } from 'react-native';

/** Flight-status chip that always sizes to its label — never ellipsizes. */
export default function FlightStatusBadge({
  label,
  color,
  filled = false,
  filledTextColor,
  liveDot = false,
}: {
  label: string;
  color: string;
  filled?: boolean;
  filledTextColor?: string;
  liveDot?: boolean;
}) {
  const fg = filled ? (filledTextColor || '#000000') : color;
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: filled ? color : `${color}22`,
          borderColor: `${color}80`,
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
