import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AirplaneTakeoff } from 'phosphor-react-native';
import { searchDuffelFlightsOrFallback, type DuffelOffer } from './lib/duffel';
import { t } from './lib/i18n';
import DuffelOffersSheet from './DuffelOffersSheet';

const NAVY = '#1A2F5A';
const GOLD = '#C9A84C';

export default function BookThisFlightButton({
  compact = false,
  origin,
  destination,
  date,
  passengers = 1,
}: {
  compact?: boolean;
  origin?: string;
  destination?: string;
  date?: string;
  passengers?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [offers, setOffers] = useState<DuffelOffer[]>([]);
  const [showOffers, setShowOffers] = useState(false);

  const o = String(origin || '').trim().toUpperCase();
  const d = String(destination || '').trim().toUpperCase();

  const onPress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await searchDuffelFlightsOrFallback(origin, destination, date, passengers, (found) => {
        setOffers(found);
        setShowOffers(true);
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DuffelOffersSheet
        visible={showOffers}
        offers={offers}
        origin={o}
        destination={d}
        onClose={() => setShowOffers(false)}
      />
      <TouchableOpacity
      style={[styles.btn, compact && styles.btnCompact, busy && styles.btnBusy]}
      onPress={() => { void onPress(); }}
      activeOpacity={0.8}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={t().bookThisFlight}
      accessibilityState={{ busy }}
    >
      {busy ? (
        <ActivityIndicator size="small" color={GOLD} />
      ) : (
        <AirplaneTakeoff size={compact ? 14 : 16} color={GOLD} />
      )}
      <Text style={[styles.txt, compact && styles.txtCompact]} numberOfLines={1} ellipsizeMode="clip">
        {busy ? t().searchingFlights : t().bookThisFlight}
      </Text>
    </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 10,
    backgroundColor: NAVY,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: GOLD,
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    alignSelf: 'stretch',
  },
  btnCompact: {
    marginTop: 8,
    marginHorizontal: 12,
    marginBottom: 10,
    borderRadius: 12,
    paddingVertical: 10,
    gap: 6,
  },
  btnBusy: {
    opacity: 0.85,
  },
  txt: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  txtCompact: {
    fontSize: 13,
  },
});
