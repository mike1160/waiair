import { useEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const COLORS = ['#C9A227', '#F4E4B4', '#FFFFFF', '#7DD3C0', '#F97316', '#93C5FD'];
const COUNT = 28;

type Piece = {
  left: number;
  size: number;
  color: string;
  delay: number;
  duration: number;
  spin: number;
};

function ConfettiPiece({ piece, active }: { piece: Piece; active: boolean }) {
  const y = useRef(new Animated.Value(-48)).current;
  const rot = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!active) {
      opacity.setValue(0);
      return;
    }
    y.setValue(-48);
    rot.setValue(0);
    opacity.setValue(1);
    Animated.parallel([
      Animated.timing(y, {
        toValue: SCREEN_H * 0.92,
        duration: piece.duration,
        delay: piece.delay,
        useNativeDriver: true,
      }),
      Animated.timing(rot, {
        toValue: 1,
        duration: piece.duration,
        delay: piece.delay,
        useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.delay(piece.delay + piece.duration * 0.65),
        Animated.timing(opacity, {
          toValue: 0,
          duration: piece.duration * 0.35,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [active, piece, y, rot, opacity]);

  const rotate = rot.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', `${piece.spin}deg`],
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.piece,
        {
          left: piece.left,
          width: piece.size,
          height: piece.size * 1.4,
          backgroundColor: piece.color,
          opacity,
          transform: [{ translateY: y }, { rotate }],
        },
      ]}
    />
  );
}

export default function ConfettiBurst({ active }: { active: boolean }) {
  const pieces = useMemo<Piece[]>(
    () => Array.from({ length: COUNT }, (_, i) => ({
      left: (SCREEN_W / COUNT) * i + (i % 3) * 4,
      size: 6 + (i % 5),
      color: COLORS[i % COLORS.length],
      delay: (i * 37) % 420,
      duration: 1700 + (i % 7) * 140,
      spin: i % 2 === 0 ? 420 : -380,
    })),
    [],
  );

  if (!active) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((piece, i) => (
        <ConfettiPiece key={i} piece={piece} active={active} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: {
    position: 'absolute',
    top: 0,
    borderRadius: 2,
  },
});
