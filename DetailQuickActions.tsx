import { useRef } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { haptics } from './lib/haptics';

const GOLD = '#C9A84C';
const MUTED = '#8892A4';
const FADE_BG = '#0F1728';

export type QuickActionItem = {
  id: string;
  label: string;
  icon: string;
  iconLib: 'ion' | 'mci';
  proOnly?: boolean;
  onPress: () => void;
};

function ActionIcon({ lib, name }: { lib: 'ion' | 'mci'; name: string }) {
  if (lib === 'ion') {
    return <Ionicons name={name as keyof typeof Ionicons.glyphMap} size={26} color={GOLD} />;
  }
  return <MaterialCommunityIcons name={name as keyof typeof MaterialCommunityIcons.glyphMap} size={26} color={GOLD} />;
}

function QuickActionButton({
  item,
  locked,
  onLockedPress,
}: {
  item: QuickActionItem;
  locked?: boolean;
  onLockedPress?: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const borderMix = useRef(new Animated.Value(0)).current;

  const pressIn = () => {
    Animated.spring(scale, { toValue: 0.95, useNativeDriver: true, friction: 6, tension: 220 }).start();
    Animated.timing(borderMix, { toValue: 1, duration: 120, useNativeDriver: false }).start();
  };
  const pressOut = () => {
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 220 }).start();
    Animated.timing(borderMix, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  };
  const borderColor = borderMix.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(201,168,76,0.25)', GOLD],
  });

  const handlePress = () => {
    haptics.light();
    if (locked) {
      onLockedPress?.();
      return;
    }
    item.onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole="button"
      accessibilityLabel={item.label}
      accessibilityState={{ disabled: locked }}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Animated.View style={[styles.btn, { borderColor }]}>
          <ActionIcon lib={item.iconLib} name={item.icon} />
          <Text style={styles.label} numberOfLines={2}>{item.label}</Text>
          {locked ? (
            <View style={styles.lockWrap} pointerEvents="none">
              <MaterialCommunityIcons name="lock" size={13} color={GOLD} />
            </View>
          ) : null}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

export default function DetailQuickActions({
  actions,
  isPro,
  onRequirePro,
  style,
}: {
  actions: QuickActionItem[];
  isPro: boolean;
  onRequirePro?: () => void;
  style?: ViewStyle;
}) {
  if (!actions.length) return null;

  return (
    <View style={[styles.wrap, style]}>
      <ScrollView
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {actions.map(item => (
          <QuickActionButton
            key={item.id}
            item={item}
            locked={!!item.proOnly && !isPro}
            onLockedPress={onRequirePro}
          />
        ))}
      </ScrollView>
      <View pointerEvents="none" style={styles.fade}>
        <Svg width={40} height={72}>
          <Defs>
            <LinearGradient id="qaFade" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={FADE_BG} stopOpacity="0" />
              <Stop offset="1" stopColor={FADE_BG} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="40" height="100%" fill="url(#qaFade)" />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    marginBottom: 4,
  },
  row: {
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'flex-start',
    paddingRight: 36,
  },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  label: {
    fontSize: 10,
    color: MUTED,
    marginTop: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
    fontWeight: '600',
  },
  lockWrap: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(15,23,40,0.88)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(201,168,76,0.35)',
  },
  fade: {
    position: 'absolute',
    top: 0,
    right: 0,
    height: 72,
    width: 40,
  },
});
