import { useMemo } from 'react';
import { Car } from 'phosphor-react-native';
import AffiliatePanel from './AffiliatePanel';
import BrandLogoTileRow, { type BrandLogoTile } from './BrandLogoTileRow';
import { brandFields, TILE_GOLD } from './lib/affiliateBrands';
import {
  allCarPicks,
  bikePicks,
  countriesDiffer,
  openAffiliateUrl,
} from './lib/affiliateConfig';
import { type DetailCardTheme } from './lib/detailCardStyles';
import { t } from './lib/i18n';

export function shouldShowNeedACarCard(input: {
  destIata?: string;
  originCountry?: string;
  destCountry?: string;
}): boolean {
  const iata = String(input.destIata || '').trim().toUpperCase();
  if (iata.length !== 3) return false;
  return countriesDiffer(input.originCountry, input.destCountry);
}

export function carFeedTiles(): BrandLogoTile[] {
  return allCarPicks().map(pick => ({
    key: pick.key,
    label: pick.label,
    hint: pick.hint,
    ...brandFields(pick.key),
    onPress: () => { void openAffiliateUrl(pick.url); },
  }));
}

export function scooterFeedTiles(destIata?: string, destCountry?: string): BrandLogoTile[] {
  return bikePicks(destIata, destCountry).map(pick => ({
    key: pick.key,
    label: pick.label,
    hint: pick.hint,
    ...brandFields(pick.key),
    onPress: () => { void openAffiliateUrl(pick.url); },
  }));
}

export function carOrScooterTiles(_destIata?: string, _destCountry?: string): BrandLogoTile[] {
  return carFeedTiles();
}

export default function NeedACarCard({
  destIata,
  originCountry,
  destCountry,
}: {
  destIata?: string;
  originCountry?: string;
  destCountry?: string;
  theme: DetailCardTheme;
}) {
  const visible = useMemo(
    () => shouldShowNeedACarCard({ destIata, originCountry, destCountry }),
    [destIata, originCountry, destCountry],
  );

  const tiles = useMemo(
    () => carFeedTiles(),
    [],
  );

  if (!visible || tiles.length === 0) return null;

  return (
    <AffiliatePanel
      title={t().needACarOrScooter}
      icon={<Car size={16} color={TILE_GOLD} weight="light" />}
    >
      <BrandLogoTileRow tiles={tiles} mutedColor={TILE_GOLD} />
    </AffiliatePanel>
  );
}
