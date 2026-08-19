import { useMemo } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import BrandLogoTileRow from './BrandLogoTileRow';
import { detailCardBg, type DetailCardTheme } from './lib/detailCardStyles';
import { showLandingGrab, type LandingCardPhase } from './lib/landingCards';
import { t } from './lib/i18n';

const FOOD_LOGOS = {
  grab: require('./assets/logos/grab.png'),
  foodpanda: require('./assets/logos/foodpanda.png'),
  ubereats: require('./assets/logos/ubereats.png'),
} as const;

async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch { /* ignore */ }
}

async function openDeepLink(appUrl: string, fallback: string): Promise<void> {
  try {
    if (await Linking.canOpenURL(appUrl)) {
      await Linking.openURL(appUrl);
      return;
    }
  } catch { /* fall through */ }
  try {
    await Linking.openURL(appUrl);
  } catch {
    await openUrl(fallback);
  }
}

export function shouldShowFoodAfterLandingCard(input: {
  type: 'arrival' | 'departure';
  status?: string;
  landingPhase?: LandingCardPhase;
}): boolean {
  if (input.type !== 'arrival') return false;
  if (String(input.status || '').toLowerCase() !== 'landed') return false;
  if (input.landingPhase !== undefined) {
    return showLandingGrab(input.landingPhase);
  }
  return true;
}

export default function FoodAfterLandingCard({
  type,
  status,
  landingPhase,
  theme,
}: {
  type: 'arrival' | 'departure';
  status?: string;
  landingPhase?: LandingCardPhase;
  theme: DetailCardTheme;
}) {
  const visible = useMemo(
    () => shouldShowFoodAfterLandingCard({ type, status, landingPhase }),
    [type, status, landingPhase],
  );

  const tiles = useMemo(
    () => [
      {
        key: 'grab-food',
        label: t().grabFoodLabel,
        source: FOOD_LOGOS.grab,
        onPress: () => { void openDeepLink('grab://food', 'https://food.grab.com'); },
      },
      {
        key: 'foodpanda',
        label: t().foodpandaLabel,
        source: FOOD_LOGOS.foodpanda,
        onPress: () => { void openDeepLink('foodpanda://', 'https://www.foodpanda.com'); },
      },
      {
        key: 'ubereats',
        label: t().uberEatsLabel,
        source: FOOD_LOGOS.ubereats,
        onPress: () => { void openDeepLink('ubereats://', 'https://www.ubereats.com'); },
      },
    ],
    [],
  );

  if (!visible) return null;

  return (
    <View style={[st.card, { backgroundColor: detailCardBg(theme) }]}>
      <BrandLogoTileRow
        title={`🍜 ${t().hungryAfterLanding}`}
        tiles={tiles}
        mutedColor={theme.muted}
      />
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
});
