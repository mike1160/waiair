/**
 * Fix: header clipped ("Frankfurt-am-Main · Vandaag" became "Frankfurt-am-Main · Vand…").
 * The "{city} · {day}" title was one numberOfLines={1} Text, so the day was cut first. The day part now never
 * shrinks; only a very long city name is shortened with an ellipsis.
 */
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

const SEPARATOR = ' · ';

export default function TripTitleText({
  title,
  style,
  containerStyle,
}: {
  title: string;
  style: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}) {
  const at = title.lastIndexOf(SEPARATOR);
  const city = at > 0 ? title.slice(0, at) : title;
  const day = at > 0 ? title.slice(at) : '';
  return (
    <View style={[st.row, containerStyle]} accessibilityRole="header" accessibilityLabel={title}>
      <Text style={[style, st.city]} numberOfLines={1} ellipsizeMode="tail">{city}</Text>
      {day ? <Text style={[style, st.day]} numberOfLines={1}>{day}</Text> : null}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline', minWidth: 0, overflow: 'hidden' },
  city: { flex: 0, flexShrink: 1, minWidth: 0 },
  day: { flex: 0, flexShrink: 0 },
});
