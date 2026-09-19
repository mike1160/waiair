import { useSquareStyles } from '../lib/modeContext';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type Colors = {
  text: string;
  accent: string;
  card: string;
  border: string;
};

export default function HomeNowCard({
  line,
  sub,
  kicker,
  colors: c,
  style,
  onPress,
  accessibilityLabel,
  debug,
}: {
  line: string;
  /** Phase hint under the title; empty shows the title alone. */
  sub?: string;
  kicker: string;
  colors: Colors;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  accessibilityLabel?: string;
  debug?: string;
}) {
  const styles = useSquareStyles(baseStyles);
  if (!line) return null;
  const inner = (
    <>
      <Text style={[styles.nowKicker, { color: c.accent }]}>{kicker}</Text>
      <Text style={[styles.nowTxt, { color: c.text }]}>{line}</Text>
      {sub ? <Text style={[styles.nowSub, { color: c.text }]}>{sub}</Text> : null}
      {debug ? <Text style={[styles.debug, { color: c.accent }]}>{debug}</Text> : null}
    </>
  );
  const box = [styles.nowCard, { backgroundColor: c.card, borderColor: c.border }, style];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={box}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel || line}
      >
        {inner}
      </Pressable>
    );
  }
  return <View style={box}>{inner}</View>;
}

const baseStyles = StyleSheet.create({
  nowCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  nowKicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 4 },
  nowTxt: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  nowSub: { fontSize: 13, fontWeight: '500', lineHeight: 18, marginTop: 3, opacity: 0.7 },
  debug: { fontSize: 11, fontWeight: '500', marginTop: 6, opacity: 0.7 },
});
