import { useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { detailCardBg, detailCardStyles as st, type DetailCardTheme } from './lib/detailCardStyles';
import { type LandingCardPhase } from './lib/landingCards';
import { localHourFromIso } from './lib/localFlightTime';
import { getAirportInfo } from './AirportInfoCard';
import { t } from './lib/i18n';

export function shouldShowEarlyCheckInCard(input: {
  type: 'arrival' | 'departure';
  status?: string;
  arrIso?: string;
  destIata?: string;
  destCountry?: string;
  landingPhase?: LandingCardPhase;
}): boolean {
  if (input.type !== 'arrival') return false;
  if (String(input.status || '').toLowerCase() !== 'landed') return false;
  if (input.landingPhase !== undefined && input.landingPhase !== 'none') return false;
  const h = localHourFromIso(input.arrIso, input.destIata, input.destCountry);
  return h != null && h < 12;
}

async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch { /* ignore */ }
}

export default function EarlyCheckInCard({
  type,
  status,
  arrIso,
  destIata,
  destCountry,
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
    () => shouldShowEarlyCheckInCard({ type, status, arrIso, destIata, destCountry, landingPhase }),
    [type, status, arrIso, destIata, destCountry, landingPhase],
  );

  const airportName = useMemo(() => {
    const code = String(destIata || '').trim().toUpperCase();
    return getAirportInfo(code)?.name || code;
  }, [destIata]);

  if (!visible || !airportName) return null;

  const mapsQ = encodeURIComponent(`luggage storage near ${airportName}`);

  return (
    <View style={[st.card, { backgroundColor: detailCardBg(theme) }]}>
      <Text style={[st.title, { color: theme.text }]}>
        {`🏨 ${t().earlyArrivalTitle}`}
      </Text>
      <Text style={[st.sub, { color: theme.secondary }]}>
        {t().earlyArrivalBody}
      </Text>
      <Pressable
        style={[st.pill, { backgroundColor: theme.accent, marginTop: 12, flex: 0, width: '100%' }]}
        onPress={() => openUrl(`maps://maps.google.com/?q=${mapsQ}`)}
        accessibilityRole="button"
      >
        <Text style={[st.pillTxt, { color: '#0A0E1A' }]}>
          {t().findLuggageStorage(airportName)}
        </Text>
      </Pressable>
    </View>
  );
}
