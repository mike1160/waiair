import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
  computePassportStats,
  formatPassportKm,
  loadPassportEntries,
} from './lib/flightPassport';
import { t } from './lib/i18n';
import { PASSPORT } from './lib/passportTheme';

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

  const gridLines = useMemo(() => {
    const rows = [];
    for (let i = 0; i < 8; i++) {
      rows.push(
        <View key={`h${i}`} style={[styles.gridLine, { top: i * 18, height: StyleSheet.hairlineWidth }]} />,
      );
    }
    for (let i = 0; i < 10; i++) {
      rows.push(
        <View key={`v${i}`} style={[styles.gridLineV, { left: i * 28, width: StyleSheet.hairlineWidth }]} />,
      );
    }
    return rows;
  }, []);

  if (count === null || count <= 0) return null;

  return (
    <TouchableOpacity
      style={styles.wrap}
      onPress={onPress}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={t().myFlightPassport}
    >
      <View pointerEvents="none" style={styles.grid}>{gridLines}</View>
      <View style={styles.crest}>
        <Text style={styles.crestIcon}>✈</Text>
        <Text style={styles.crestBrand}>WaiAir</Text>
      </View>
      <Text style={styles.title}>{t().flightPassportTitle}</Text>
      <Text style={styles.stats}>{t().passportCoverStats(count, km)}</Text>
      <Text style={styles.traveler}>{t().passportTraveler}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    backgroundColor: PASSPORT.cover,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: PASSPORT.gold,
    paddingVertical: 20,
    paddingHorizontal: 18,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  grid: { ...StyleSheet.absoluteFillObject },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: PASSPORT.grid,
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: PASSPORT.grid,
  },
  crest: { alignItems: 'center', marginBottom: 10 },
  crestIcon: {
    color: PASSPORT.gold,
    fontSize: 28,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  crestBrand: {
    color: PASSPORT.gold,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: PASSPORT.gold,
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 4,
    textTransform: 'uppercase',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  stats: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 10,
    textAlign: 'center',
  },
  traveler: {
    color: PASSPORT.gold,
    fontSize: 14,
    fontStyle: 'italic',
    fontWeight: '600',
    marginTop: 14,
    textAlign: 'center',
  },
});
