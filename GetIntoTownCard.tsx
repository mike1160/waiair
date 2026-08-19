import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Car } from 'phosphor-react-native';
import BrandLogoTileRow from './BrandLogoTileRow';
import { detailCardBg, type DetailCardTheme } from './lib/detailCardStyles';
import { showLandingGrab, type LandingCardPhase } from './lib/landingCards';
import { landedWithinMs } from './lib/localFlightTime';
import { t } from './lib/i18n';
import {
  openTransportOption,
  townTransportButtons,
  TRANSPORT_INFO,
  type TransportKind,
} from './lib/transportBooking';

const LANDED_WINDOW_MS = 2 * 60 * 60 * 1000;

const TRANSPORT_LOGOS: Partial<Record<'grab' | 'bolt', ReturnType<typeof require>>> = {
  grab: require('./assets/logos/grab.png'),
  bolt: require('./assets/logos/bolt.png'),
};

export function shouldShowGetIntoTownCard(input: {
  type: 'arrival' | 'departure';
  status?: string;
  arrIso?: string;
  destIata?: string;
  landingPhase?: LandingCardPhase;
}): boolean {
  if (input.type !== 'arrival') return false;
  if (String(input.status || '').toLowerCase() !== 'landed') return false;
  const code = String(input.destIata || '').trim().toUpperCase();
  if (townTransportButtons(code).length === 0) return false;
  if (input.landingPhase !== undefined) {
    return showLandingGrab(input.landingPhase);
  }
  if (!landedWithinMs(input.arrIso, LANDED_WINDOW_MS)) return false;
  return true;
}

function labelForKind(kind: TransportKind): string {
  if (kind === 'grab') return 'Grab';
  if (kind === 'bolt') return 'Bolt';
  return t().taxiLabel;
}

export default function GetIntoTownCard({
  type,
  status,
  arrIso,
  destIata,
  landingPhase,
  theme,
}: {
  type: 'arrival' | 'departure';
  status?: string;
  arrIso?: string;
  destIata?: string;
  landingPhase?: LandingCardPhase;
  theme: DetailCardTheme;
}) {
  const visible = useMemo(
    () => shouldShowGetIntoTownCard({ type, status, arrIso, destIata, landingPhase }),
    [type, status, arrIso, destIata, landingPhase],
  );

  const code = String(destIata || '').trim().toUpperCase();
  const info = TRANSPORT_INFO[code];
  const buttons = useMemo(() => townTransportButtons(code), [code]);

  const tiles = useMemo(() => {
    if (!info) return [];
    return buttons.map(opt => ({
      key: opt.kind,
      label: labelForKind(opt.kind),
      source: opt.kind === 'grab' || opt.kind === 'bolt' ? TRANSPORT_LOGOS[opt.kind] : undefined,
      icon: opt.kind === 'taxi' ? <Car size={32} color="#F59E0B" weight="fill" /> : undefined,
      onPress: () => { void openTransportOption(opt, info); },
    }));
  }, [buttons, info]);

  if (!visible || !tiles.length) return null;

  return (
    <View style={[st.card, { backgroundColor: detailCardBg(theme) }]}>
      <BrandLogoTileRow
        title={`🚕 ${t().getIntoTownTitle}`}
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
