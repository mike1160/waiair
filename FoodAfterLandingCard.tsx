import { useMemo } from 'react';
import { Linking } from 'react-native';
import { ForkKnife } from 'phosphor-react-native';
import AffiliatePanel from './AffiliatePanel';
import BrandLogoTileRow, { type BrandLogoTile } from './BrandLogoTileRow';
import { brandFields, TILE_GOLD } from './lib/affiliateBrands';
import { type DetailCardTheme } from './lib/detailCardStyles';
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

export function foodAfterLandingTiles(): BrandLogoTile[] {
  return [
    {
      key: 'grab',
      label: t().grabFoodLabel,
      source: FOOD_LOGOS.grab,
      ...brandFields('grab'),
      onPress: () => { void openDeepLink('grab://food', 'https://food.grab.com'); },
    },
    {
      key: 'foodpanda',
      label: t().foodpandaLabel,
      source: FOOD_LOGOS.foodpanda,
      ...brandFields('foodpanda'),
      onPress: () => { void openDeepLink('foodpanda://', 'https://www.foodpanda.com'); },
    },
    {
      key: 'ubereats',
      label: t().uberEatsLabel,
      source: FOOD_LOGOS.ubereats,
      ...brandFields('ubereats'),
      onPress: () => { void openDeepLink('ubereats://', 'https://www.ubereats.com'); },
    },
  ];
}

export default function FoodAfterLandingCard({
  type,
  status,
  landingPhase,
  theme,
}: {
  type: 'arrival' | 'departure';
  status?: string;
  arrIso?: string;
  destIata?: string;
  destCountry?: string;
  landingPhase?: LandingCardPhase;
  theme: DetailCardTheme;
}) {
  const visible = useMemo(
    () => shouldShowFoodAfterLandingCard({ type, status, landingPhase }),
    [type, status, landingPhase],
  );

  const tiles = useMemo(() => foodAfterLandingTiles(), []);

  if (!visible) return null;

  return (
    <AffiliatePanel
      title={t().hungryAfterLanding}
      icon={<ForkKnife size={16} color={TILE_GOLD} weight="light" />}
    >
      <BrandLogoTileRow tiles={tiles} mutedColor={TILE_GOLD} />
    </AffiliatePanel>
  );
}
