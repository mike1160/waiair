import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { AirplaneTakeoff } from 'phosphor-react-native';
import { searchDuffelFlightsOrFallback, type DuffelOffer } from './lib/duffel';
import { t } from './lib/i18n';
import DuffelOffersSheet from './DuffelOffersSheet';

const MUTED = '#8896B0';

export default function BookThisFlightButton({
  origin,
  destination,
  date,
  passengers = 1,
}: {
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
        style={[styles.btn, busy && styles.btnBusy]}
        onPress={() => { void onPress(); }}
        activeOpacity={0.75}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={t().bookThisFlight}
        accessibilityState={{ busy }}
      >
        {busy ? (
          <ActivityIndicator size="small" color={MUTED} />
        ) : (
          <AirplaneTakeoff size={14} color={MUTED} />
        )}
        <Text style={styles.txt} numberOfLines={1} ellipsizeMode="clip">
          {busy ? t().searchingFlights : t().bookThisFlight}
        </Text>
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  btn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(136,150,176,0.35)',
    backgroundColor: 'transparent',
  },
  btnBusy: {
    opacity: 0.7,
  },
  txt: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '700',
  },
});
