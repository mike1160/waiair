import { Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { ThemeColors } from './lib/themes';
import { haptics } from './lib/haptics';

export type PromoCardType = 'ssf' | 'allesis';

export type PromoListItem = {
  type: 'promo-ssf' | 'promo-allesis';
  id: 'promo-ssf' | 'promo-allesis';
};

const COPY: Record<PromoCardType, {
  icon: string;
  title: string;
  subtitle: string;
  url: string;
  badge: string;
}> = {
  ssf: {
    icon: '🐾',
    title: 'Saved Souls Foundation',
    subtitle: 'Helping disabled dogs & cats in Thailand — donate today',
    url: 'https://www.savedsouls-foundation.org/nl/donate',
    badge: 'Good cause',
  },
  allesis: {
    icon: '💻',
    title: 'Allesis — Your digital partner',
    subtitle: 'Websites, apps & SEO · Netherlands · Thai spoken 🇹🇭',
    url: 'https://www.allesis.nl/',
    badge: 'Partner',
  },
};

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

export default function PromoCard({
  type,
  colors,
}: {
  type: PromoCardType;
  colors: ThemeColors;
}) {
  const copy = COPY[type];
  const cause = copy.badge === 'Good cause';
  const cardBg = colors.gateSkin === 'spotter' ? colors.card : colors.list;

  const onPress = () => {
    haptics.light();
    void Linking.openURL(copy.url);
  };

  return (
    <View style={st.wrap}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        accessibilityRole="link"
        accessibilityLabel={`${copy.badge}. ${copy.title}. ${copy.subtitle}`}
        style={[
          st.card,
          {
            backgroundColor: cardBg,
            borderColor: colors.isDark ? 'rgba(170,190,220,0.18)' : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        <Text style={st.icon}>{copy.icon}</Text>
        <View style={st.body}>
          <View style={st.titleRow}>
            <Text style={[st.title, { color: colors.text }]} numberOfLines={1}>
              {copy.title}
            </Text>
            <View style={[st.badge, { backgroundColor: cause ? colors.gold : colors.accent }]}>
              <Text style={st.badgeTxt}>{copy.badge}</Text>
            </View>
          </View>
          <Text style={[st.subtitle, { color: colors.secondary }]} numberOfLines={2}>
            {copy.subtitle}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
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
