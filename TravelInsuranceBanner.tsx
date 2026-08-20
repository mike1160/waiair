import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BrandLogoTileRow, { type BrandLogoTile } from './BrandLogoTileRow';
import { brandFields, TILE_GOLD } from './lib/affiliateBrands';
import {
  insurancePicks,
  isLongHaulMs,
  openAffiliateUrl,
} from './lib/affiliateConfig';
import { type DetailCardTheme } from './lib/detailCardStyles';
import { t } from './lib/i18n';

export function shouldShowTravelInsuranceBanner(durationMs?: number | null): boolean {
  return isLongHaulMs(durationMs);
}

export default function TravelInsuranceBanner({
  durationMs,
  embedded = false,
}: {
  durationMs?: number | null;
  theme: DetailCardTheme;
  embedded?: boolean;
}) {
  const visible = useMemo(() => shouldShowTravelInsuranceBanner(durationMs), [durationMs]);

  const tiles = useMemo((): BrandLogoTile[] => {
    return insurancePicks().map(pick => ({
      key: pick.key,
      label: pick.label,
      hint: pick.hint,
      ...brandFields(pick.key),
      onPress: () => { void openAffiliateUrl(pick.url); },
    }));
  }, []);

  if (!visible || tiles.length === 0) return null;

  const row = <BrandLogoTileRow tiles={tiles} mutedColor={TILE_GOLD} />;
  return (
    <View style={st.embed}>
      <Text style={st.embedTitle}>{t().travelInsuranceFrom.replace(/\?+$/, '').trim().toUpperCase()}</Text>
      {row}
    </View>
  );
}

const st = StyleSheet.create({
  embed: {
    gap: 10,
  },
  embedTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: TILE_GOLD,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
});
