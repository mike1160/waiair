import { useEffect, useRef } from 'react';
import { Animated, Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { startLoopWhileActive } from './lib/appActivity';
import type { ThemeColors } from './lib/themes';
import { haptics } from './lib/haptics';

export type PromoCardType = 'ssf' | 'allesis';

export type PromoListItem = {
  type: 'promo-ssf' | 'promo-allesis';
  id: 'promo-ssf' | 'promo-allesis';
};

const SSF_DONATE_URL = 'https://www.savedsouls-foundation.org/nl/donate';

const ALLESIS = {
  icon: '💻',
  title: 'Allesis — Your digital partner',
  subtitle: 'Websites, apps & SEO · Netherlands · Thai spoken 🇹🇭',
  url: 'https://www.allesis.nl/',
  badge: 'Partner',
} as const;

export const PROMO_SSF: PromoListItem = { type: 'promo-ssf', id: 'promo-ssf' };
export const PROMO_ALLESIS: PromoListItem = { type: 'promo-allesis', id: 'promo-allesis' };

export function isPromoItem(item: { type?: string; id?: string }): item is PromoListItem {
  return item.type === 'promo-ssf' || item.type === 'promo-allesis';
}

/** Insert SSF 20 rows after `fromIndex`, Allesis 35 rows after — clamped to the list end. */
export function insertBoardPromos<T extends { id: string }>(
  flights: T[],
  enabled: boolean,
  fromIndex = 0,
): Array<T | PromoListItem> {
  if (!enabled || flights.length === 0) return flights;
  const result: Array<T | PromoListItem> = flights.slice();
  const from = Math.max(0, fromIndex);
  const ssfAt = Math.min(from + 20, result.length);
  result.splice(ssfAt, 0, PROMO_SSF);
  const allesisAt = Math.min(from + 35 + (ssfAt <= from + 35 ? 1 : 0), result.length);
  result.splice(allesisAt, 0, PROMO_ALLESIS);
  return result;
}

/** Map a flight index to the FlashList index after promo rows are spliced in. */
export function fidsIndexWithPromos(
  flightIndex: number,
  fromIndex: number,
  flightCount: number,
  enabled: boolean,
): number {
  if (!enabled || flightIndex < 0 || flightCount <= 0) return flightIndex;
  const from = Math.max(0, fromIndex);
  const ssfAt = Math.min(from + 20, flightCount);
  let idx = flightIndex;
  if (flightIndex >= ssfAt) idx += 1;
  const allesisAt = Math.min(from + 35, flightCount) + (ssfAt <= from + 35 ? 1 : 0);
  if (idx >= allesisAt) idx += 1;
  return idx;
}

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
          <Text style={ssf.title} numberOfLines={2}>Saved Souls Foundation</Text>
          <Text style={ssf.subtitle} numberOfLines={2}>
            Helping disabled dogs & cats in Thailand
          </Text>
          <Text style={ssf.cta}>Donate today →</Text>
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

function AllesisPromoCard({ colors }: { colors: ThemeColors }) {
  const cardBg = colors.gateSkin === 'spotter' ? colors.card : colors.list;

  const onPress = () => {
    haptics.light();
    void Linking.openURL(ALLESIS.url);
  };

  return (
    <View style={allesis.wrap}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="link"
        accessibilityLabel={`${ALLESIS.badge}. ${ALLESIS.title}. ${ALLESIS.subtitle}`}
        style={[
          allesis.card,
          {
            backgroundColor: cardBg,
            borderColor: colors.isDark ? 'rgba(170,190,220,0.18)' : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        <Text style={allesis.icon}>{ALLESIS.icon}</Text>
        <View style={allesis.body}>
          <View style={allesis.titleRow}>
            <Text style={[allesis.title, { color: colors.text }]} numberOfLines={1}>
              {ALLESIS.title}
            </Text>
            <View style={[allesis.badge, { backgroundColor: colors.accent }]}>
              <Text style={allesis.badgeTxt}>{ALLESIS.badge}</Text>
            </View>
          </View>
          <Text style={[allesis.subtitle, { color: colors.secondary }]} numberOfLines={2}>
            {ALLESIS.subtitle}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

export default function PromoCard({
  type,
  colors,
}: {
  type: PromoCardType;
  colors: ThemeColors;
}) {
  if (type === 'ssf') return <SsfPromoCard />;
  return <AllesisPromoCard colors={colors} />;
}

const ssf = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  card: {
    height: 110,
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: '#00C853',
    backgroundColor: '#1a3a2a',
  },
  left: {
    flex: 6,
    minWidth: 0,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 12,
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  subtitle: {
    marginTop: 4,
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    opacity: 0.8,
  },
  cta: {
    marginTop: 8,
    color: '#00C853',
    fontSize: 12,
    fontWeight: '700',
  },
  imageWrap: {
    flex: 4,
    height: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#00C853',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTxt: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});

const allesis = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  card: {
    height: 100,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 12,
    borderRadius: 16,
    borderWidth: 0.5,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  icon: {
    fontSize: 28,
    lineHeight: 34,
    width: 36,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
    color: '#0A0E1A',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
