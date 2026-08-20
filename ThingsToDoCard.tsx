import { useMemo } from 'react';
import { Ticket } from 'phosphor-react-native';
import AffiliatePanel from './AffiliatePanel';
import BrandLogoTileRow, { type BrandLogoTile } from './BrandLogoTileRow';
import { brandFields, TILE_GOLD } from './lib/affiliateBrands';
import { allActivityPicks, openAffiliateUrl } from './lib/affiliateConfig';
import { type DetailCardTheme } from './lib/detailCardStyles';
import { hotelCityName } from './lib/hotels';
import { showLandingHotel, type LandingCardPhase } from './lib/landingCards';
import { t } from './lib/i18n';

export function shouldShowThingsToDoCard(input: {
  type: 'arrival' | 'departure';
  status?: string;
  destIata?: string;
  destCity?: string;
  landingPhase?: LandingCardPhase;
}): boolean {
  if (input.type !== 'arrival') return false;
  if (String(input.status || '').toLowerCase() !== 'landed') return false;
  if (input.landingPhase === 'hidden' || input.landingPhase === 'none') return false;
  if (input.landingPhase && !showLandingHotel(input.landingPhase) && input.landingPhase !== 'immediate') {
    return false;
  }
  const city = hotelCityName(input.destIata, input.destCity);
  return !!city && city.length >= 2;
}

export function thingsToDoTiles(_destIata?: string, _destCountry?: string): BrandLogoTile[] {
  return allActivityPicks().map(pick => ({
    key: pick.key,
    label: pick.label,
    hint: pick.hint,
    ...brandFields(pick.key),
    onPress: () => { void openAffiliateUrl(pick.url); },
  }));
}

export default function ThingsToDoCard({
  type,
  status,
  destIata,
  destCity,
  destCountry,
  landingPhase,
  theme,
}: {
  type: 'arrival' | 'departure';
  status?: string;
  destIata?: string;
  destCity?: string;
  destCountry?: string;
  landingPhase?: LandingCardPhase;
  theme: DetailCardTheme;
}) {
  const city = useMemo(() => hotelCityName(destIata, destCity), [destIata, destCity]);
  const visible = useMemo(
    () => shouldShowThingsToDoCard({ type, status, destIata, destCity, landingPhase }),
    [type, status, destIata, destCity, landingPhase],
  );

  const tiles = useMemo(
    () => (city ? thingsToDoTiles(destIata, destCountry) : []),
    [city, destIata, destCountry],
  );

  if (!visible || !city || tiles.length === 0) return null;

  return (
    <AffiliatePanel
      title={t().thingsToDoTitle}
      icon={<Ticket size={16} color={TILE_GOLD} weight="light" />}
    >
      <BrandLogoTileRow tiles={tiles} mutedColor={TILE_GOLD} />
    </AffiliatePanel>
  );
}
