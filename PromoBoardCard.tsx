import { useEffect, useRef } from 'react';
import { Animated, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { startLoopWhileActive } from './lib/appActivity';
import { haptics } from './lib/haptics';

export const SSF_DONATE_URL = 'https://www.savedsouls-foundation.org/nl/donate';

function SsfPromoCard() {
  const badgeOpacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    return startLoopWhileActive(() =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(badgeOpacity, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(badgeOpacity, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        ]),
      ),
    );
  }, [badgeOpacity]);

  const onPress = () => {
    haptics.light();
    void Linking.openURL(SSF_DONATE_URL);
  };

  return (
    <View style={ssf.wrap}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.88}
        accessibilityRole="link"
        accessibilityLabel="Good cause. Saved Souls Foundation. Helping disabled dogs and cats in Thailand. Donate today"
        style={ssf.card}
      >
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="ssfPromoBg" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1a3a2a" />
              <Stop offset="1" stopColor="#0d2016" />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#ssfPromoBg)" />
        </Svg>
        <View style={ssf.left}>
          <Text style={ssf.title} numberOfLines={2} ellipsizeMode="tail">Saved Souls Foundation</Text>
          <Text style={ssf.subtitle} numberOfLines={2} ellipsizeMode="tail">
            Helping disabled dogs & cats in Thailand
          </Text>
          <Text style={ssf.cta} numberOfLines={1} ellipsizeMode="tail">Donate today →</Text>
        </View>
        <View style={ssf.imageWrap}>
          <Image source={require('./assets/ssf-hero.jpg')} style={ssf.image} resizeMode="cover" />
          <Animated.View style={[ssf.badge, { opacity: badgeOpacity }]} pointerEvents="none">
            <Text style={ssf.badgeTxt}>Good cause</Text>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function PromoCard() {
  return <SsfPromoCard />;
}

const ssf = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  card: {
    height: 120,
    maxHeight: 120,
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    backgroundColor: '#1a3a2a',
  },
  left: {
    flex: 1,
    minWidth: 0,
    maxHeight: 120,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    opacity: 0.8,
    flexShrink: 1,
  },
  cta: {
    marginTop: 6,
    color: '#22c55e',
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  imageWrap: {
    width: '50%',
    maxWidth: '50%',
    height: '100%',
    maxHeight: 120,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTxt: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
