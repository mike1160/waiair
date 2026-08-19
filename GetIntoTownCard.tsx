import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Car } from 'phosphor-react-native';
import BrandLogoTileRow from './BrandLogoTileRow';
import { detailCardBg, type DetailCardTheme } from './lib/detailCardStyles';
import { showLandingGrab, type LandingCardPhase } from './lib/landingCards';
import { landedWithinMs } from './lib/localFlightTime';
import { t } from './lib/i18n';
import { openTopTransport, topTransportOptions } from './lib/transportBooking';

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
  return t().taxiLabel;
}

function iconForType(type: string) {
  if (type === 'grab' || type === 'bolt' || type === 'indrive') return undefined;
  if (type === 'train') return <Text style={st.emojiIcon}>🚆</Text>;
  if (type === 'bus') return <Text style={st.emojiIcon}>🚌</Text>;
  if (type === 'uber' || type === 'taxi') {
    return <Car size={32} color={type === 'uber' ? '#000000' : '#F59E0B'} weight="fill" />;
  }
  return undefined;
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
  if (!landedWithinMs(input.arrIso, LANDED_WINDOW_MS)) return false;
  return true;
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

  const tiles = useMemo(() => {
    return topTransportOptions(code).map(typeKey => ({
      key: typeKey,
      label: labelForType(typeKey),
      source:
        typeKey === 'grab' || typeKey === 'bolt' || typeKey === 'indrive'
          ? TRANSPORT_LOGOS[typeKey]
          : undefined,
      icon: iconForType(typeKey),
      onPress: () => { void openTopTransport(typeKey, code); },
    }));
  }, [code]);

  if (!visible) return null;

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
  emojiIcon: {
    fontSize: 32,
    lineHeight: 36,
  },
});
