import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type Colors = {
  text: string;
  accent: string;
  card: string;
  border: string;
};

export default function HomeNowCard({
  line,
  kicker,
  colors: c,
  style,
}: {
  line: string;
  kicker: string;
  colors: Colors;
  style?: StyleProp<ViewStyle>;
}) {
  if (!line) return null;
  return (
    <View style={[styles.nowCard, { backgroundColor: c.card, borderColor: c.border }, style]}>
      <Text style={[styles.nowKicker, { color: c.accent }]}>{kicker}</Text>
      <Text style={[styles.nowTxt, { color: c.text }]}>{line}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  nowCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  nowKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },
  nowTxt: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
});
