import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  computePassportStats,
  formatPassportKm,
  loadPassportEntries,
} from './lib/flightPassport';
import { t } from './lib/i18n';

const NAVY = '#1a237e';
const GOLD = '#F5A623';

export default function PassportTabCover({
  refreshKey = 0,
  onPress,
}: {
  refreshKey?: number;
  onPress: () => void;
}) {
  const [count, setCount] = useState<number | null>(null);
  const [km, setKm] = useState('0');

  useEffect(() => {
    let cancelled = false;
    loadPassportEntries().then(entries => {
      if (cancelled) return;
      const stats = computePassportStats(entries);
      setCount(stats.totalFlights);
      setKm(formatPassportKm(stats.totalKm));
    }).catch(() => {
      if (!cancelled) setCount(0);
    });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (count === null || count <= 0) return null;

  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={t().myFlightPassport}
    >
      <Text style={styles.logo}>✈️ WaiAir</Text>
      <Text style={styles.title}>{t().flightPassportTitle}</Text>
      <Text style={styles.sub}>{t().passportCoverStats(count, km)}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: NAVY,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: GOLD,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  logo: { color: GOLD, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  title: { color: GOLD, fontSize: 16, fontWeight: '900', letterSpacing: 2.5 },
  sub: { color: 'rgba(255,255,255,0.82)', fontSize: 13, fontWeight: '700', marginTop: 6 },
});
