import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { detailCardBg, detailCardStyles as st, type DetailCardTheme } from './lib/detailCardStyles';
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

const BTN_COLORS: Record<'grab' | 'bolt' | 'taxi', string> = {
  grab: '#00B14F',
  bolt: '#34D186',
  taxi: '#F59E0B',
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

  if (!visible || !info || !buttons.length) return null;

  return (
    <View style={[st.card, { backgroundColor: detailCardBg(theme) }]}>
      <Text style={[st.title, { color: theme.text }]}>
        {`🚕 ${t().getIntoTownTitle}`}
      </Text>
      <View style={st.row}>
        {buttons.map(opt => (
          <Pressable
            key={opt.kind}
            style={[st.pill, { backgroundColor: BTN_COLORS[opt.kind as keyof typeof BTN_COLORS] || theme.accent }]}
            onPress={() => openTransportOption(opt, info)}
            accessibilityRole="button"
            accessibilityLabel={labelForKind(opt.kind)}
          >
            <Text style={st.pillTxt}>{labelForKind(opt.kind)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
