/**
 * Split-flap text for airport mode: when the value changes, every changed character flips on its own —
 * the old character folds away (rotateX 0° → 90°), the new one folds in (90° → 0°), 80 ms each half,
 * 40 ms apart from left to right, with one clack per character. Unchanged characters stay still.
 * The first render never animates, and with Reduce Motion on it simply shows the new value.
 */
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { FLIP_HALF_MS, FLIP_STAGGER_MS, flipCells } from '../lib/modes';
import { useFlipSound } from '../lib/useFlipSound';

type Props = {
  value: string;
  style?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
};

function Cell({
  char,
  delay,
  style,
  reduceMotion,
  onFlip,
}: {
  char: string;
  delay: number;
  style?: StyleProp<TextStyle>;
  reduceMotion: boolean;
  onFlip: () => void;
}) {
  const [shown, setShown] = useState(char);
  const turn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (char === shown) return undefined;
    if (reduceMotion) {
      setShown(char);
      return undefined;
    }
    turn.setValue(0);
    const out = Animated.sequence([
      Animated.delay(delay),
      Animated.timing(turn, { toValue: 1, duration: FLIP_HALF_MS, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]);
    let back: Animated.CompositeAnimation | null = null;
    out.start(({ finished }) => {
      if (!finished) return;
      setShown(char);
      onFlip();
      back = Animated.timing(turn, { toValue: 0, duration: FLIP_HALF_MS, easing: Easing.out(Easing.quad), useNativeDriver: true });
      back.start();
    });
    return () => { out.stop(); back?.stop(); };
    // `shown` changes because of this effect; re-running on it would restart the flip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [char, delay, reduceMotion]);

  const rotateX = turn.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
  return (
    <Animated.Text style={[style, { transform: [{ perspective: 400 }, { rotateX }] }]}>
      {shown === ' ' ? ' ' : shown}
    </Animated.Text>
  );
}

export default function FlipText({ value, style, accessibilityLabel }: Props) {
  const next = String(value ?? '');
  const prevRef = useRef(next);
  const [reduceMotion, setReduceMotion] = useState(false);
  const tick = useFlipSound();

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(on => { if (alive) setReduceMotion(!!on); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const cells = flipCells(prevRef.current, next);
  useEffect(() => { prevRef.current = next; }, [next]);

  // A left-to-right wave: each position waits 40 ms more than the one before it. Trailing blanks from a longer
  // old value flip away like any other character (a blank cell renders a space).
  return (
    <View style={styles.row} accessible accessibilityRole="text" accessibilityLabel={accessibilityLabel ?? next}>
      {cells.map((c, i) => {
        const delay = c.flips ? i * FLIP_STAGGER_MS : 0;
        return (
          <Cell
            key={i}
            char={c.to}
            delay={delay}
            style={style}
            reduceMotion={reduceMotion}
            onFlip={tick}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'baseline' },
});
