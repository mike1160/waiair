import { useMemo } from 'react';
import { Taxi } from 'phosphor-react-native';
import AffiliatePanel from './AffiliatePanel';
import BrandLogoTileRow, { type BrandLogoTile } from './BrandLogoTileRow';
import { brandFields, TILE_GOLD } from './lib/affiliateBrands';
import {
  allEsimPicks,
  allTransferPicks,
  countriesDiffer,
  openAffiliateUrl,
} from './lib/affiliateConfig';
import { type DetailCardTheme } from './lib/detailCardStyles';
import { showLandingGrab, type LandingCardPhase } from './lib/landingCards';
import { landedWithinMs } from './lib/localFlightTime';
import { t } from './lib/i18n';
import { openTopTransport } from './lib/transportBooking';

const LANDED_WINDOW_MS = 2 * 60 * 60 * 1000;

const TRANSPORT_LOGOS: Partial<Record<'grab' | 'bolt' | 'indrive', ReturnType<typeof require>>> = {
  grab: require('./assets/logos/grab.png'),
  bolt: require('./assets/logos/bolt.png'),
  indrive: require('./assets/logos/indrive.png'),
};

function labelForType(type: string): string {
  if (type === 'grab') return 'Grab';
  if (type === 'bolt') return 'Bolt';
  if (type === 'indrive') return 'inDrive';
  if (type === 'uber') return 'Uber';
  if (type === 'train') return 'Train';
  if (type === 'bus') return 'Bus';
  if (type === 'taxi') return t().taxiLabel;
  return t().taxiLabel;
}

export function shouldShowGetIntoTownCard(input: {
  type: 'arrival' | 'departure';
  status?: string;
  arrIso?: string;
  destIata?: string;
  landingPhase?: LandingCardPhase;
}): boolean {
  if (input.type !== 'arrival') return false;
  if (String(input.status || '').toLowerCase() !== 'landed') return false;
  if (!String(input.destIata || '').trim()) return false;
  if (input.landingPhase !== undefined) {
    return showLandingGrab(input.landingPhase);
  }
  if (!landedWithinMs(input.arrIso, LANDED_WINDOW_MS, input.destIata)) return false;
  return true;
}

export function getIntoTownTiles(destIata?: string, originCountry?: string, destCountry?: string): BrandLogoTile[] {
  const code = String(destIata || '').trim().toUpperCase();
  return (['grab', 'indrive', 'bus'] as const).map(typeKey => ({
    key: typeKey,
    label: labelForType(typeKey),
    source: typeKey === 'grab' || typeKey === 'indrive' ? TRANSPORT_LOGOS[typeKey] : undefined,
    ...brandFields(typeKey),
    onPress: () => { void openTopTransport(typeKey, code); },
  }));
}

export function airportTransferTiles(_destIata?: string, _destCountry?: string): BrandLogoTile[] {
  return allTransferPicks().map(pick => ({
    key: pick.key,
    label: pick.label,
    hint: pick.hint,
    ...brandFields(pick.key),
    onPress: () => { void openAffiliateUrl(pick.url); },
  }));
}

export function esimTiles(_destIata?: string, originCountry?: string, destCountry?: string): BrandLogoTile[] {
  if (!countriesDiffer(originCountry, destCountry)) return [];
  return allEsimPicks().map(pick => ({
    key: pick.key,
    label: pick.label,
    hint: pick.hint,
    ...brandFields(pick.key),
    onPress: () => { void openAffiliateUrl(pick.url); },
  }));
}

export default function GetIntoTownCard({
  type,
  status,
  arrIso,
  destIata,
  originCountry,
  destCountry,
  landingPhase,
  theme,
}: {
  type: 'arrival' | 'departure';
  status?: string;
  arrIso?: string;
  destIata?: string;
  originCountry?: string;
  destCountry?: string;
  landingPhase?: LandingCardPhase;
  theme: DetailCardTheme;
}) {
  const visible = useMemo(
    () => shouldShowGetIntoTownCard({ type, status, arrIso, destIata, landingPhase }),
    [type, status, arrIso, destIata, landingPhase],
  );

  const tiles = useMemo(
    () => getIntoTownTiles(destIata, originCountry, destCountry),
    [destIata, originCountry, destCountry],
  );

  if (!visible) return null;

  return (
    <AffiliatePanel
      title={t().getIntoTownTitle}
      icon={<Taxi size={16} color={TILE_GOLD} weight="light" />}
    >
      <BrandLogoTileRow tiles={tiles} mutedColor={TILE_GOLD} />
    </AffiliatePanel>
  );
}
