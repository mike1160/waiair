import { useMemo } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { detailCardBg, detailCardStyles as st, type DetailCardTheme } from './lib/detailCardStyles';
import { type LandingCardPhase } from './lib/landingCards';
import { localHourFromIso } from './lib/localFlightTime';
import { getAirportInfo } from './AirportInfoCard';
import { t } from './lib/i18n';

function eveningLandingHour(iso?: string, iata?: string, country?: string): boolean {
  const h = localHourFromIso(iso, iata, country);
  return h != null && h >= 17 && h <= 23;
}

export function shouldShowRestaurantsCard(input: {
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
  return eveningLandingHour(input.arrIso, input.destIata, input.destCountry);
}

async function openUrl(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch { /* ignore */ }
}

export default function RestaurantsCard({
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
    () => shouldShowRestaurantsCard({ type, status, arrIso, destIata, destCountry, landingPhase }),
    [type, status, arrIso, destIata, destCountry, landingPhase],
  );

  const airportName = useMemo(() => {
    const code = String(destIata || '').trim().toUpperCase();
    return getAirportInfo(code)?.name || code;
  }, [destIata]);

  if (!visible || !airportName) return null;

  const mapsQ = encodeURIComponent(`restaurants near ${airportName}`);

  return (
    <View style={[st.card, { backgroundColor: detailCardBg(theme) }]}>
      <Text style={[st.title, { color: theme.text }]}>
        {`🍜 ${t().hungryAfterLanding}`}
      </Text>
      <View style={[st.row, { flexDirection: 'column', gap: 8 }]}>
        <Pressable
          style={[st.pill, { backgroundColor: theme.accent, flex: 0, width: '100%' }]}
          onPress={() => openUrl(`maps://maps.google.com/?q=${mapsQ}`)}
          accessibilityRole="button"
        >
          <Text style={[st.pillTxt, { color: '#0D1B2E' }]}>
            {t().openMapsRestaurants(airportName)}
          </Text>
        </Pressable>
        <View style={st.row}>
          <Pressable
            style={[st.pill, { backgroundColor: '#00B14F' }]}
            onPress={() => openUrl('grab://food')}
            accessibilityRole="button"
          >
            <Text style={st.pillTxt}>{t().grabFoodLabel}</Text>
          </Pressable>
          <Pressable
            style={[st.pill, { backgroundColor: '#D70F64' }]}
            onPress={() => openUrl('foodpanda://')}
            accessibilityRole="button"
          >
            <Text style={st.pillTxt}>{t().foodpandaLabel}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
