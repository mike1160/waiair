/**
 * Destination chips on the flight detail page: temperature, currency and visa in one row, always visible.
 * Each chip opens what the app already has for it — the weather card, the currency calculator, the visa check.
 * A chip without a value is simply left out.
 */
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import countryInfoData from '../data/countryInfo.json';
import { fetchWeatherSnapshot } from '../lib/destinationServices';
import {
  currencyChipLabel,
  destinationChips,
  tempChipLabel,
  visaChipLabel,
  type DestinationChip,
} from '../lib/destinationChips';
import { t } from '../lib/i18n';
import { formatTempC, getPrefs } from '../lib/prefs';
import { defaultPassportCode, visaCheckResult } from '../lib/visaByPassport';

type CountryRow = { currency?: { code?: string }; visa?: string };

type Props = {
  destCountry?: string;
  destCity?: string;
  lat?: number | null;
  lon?: number | null;
  theme: { text: string; muted: string; card: string; border: string };
  onTempPress: () => void;
  onCurrencyPress: () => void;
  onVisaPress: () => void;
};

export default function DestinationChips({
  destCountry,
  destCity,
  lat,
  lon,
  theme,
  onTempPress,
  onCurrencyPress,
  onVisaPress,
}: Props) {
  const [temp, setTemp] = useState<number | null>(null);
  const country = String(destCountry || '').trim().toUpperCase();
  const row = (countryInfoData as Record<string, CountryRow>)[country];

  useEffect(() => {
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      setTemp(null);
      return undefined;
    }
    let alive = true;
    fetchWeatherSnapshot(lat, lon, String(destCity || country || ''))
      .then(snap => { if (alive) setTemp(snap ? snap.temp : null); })
      .catch(() => { if (alive) setTemp(null); });
    return () => { alive = false; };
  }, [lat, lon, destCity, country]);

  const visa = country
    ? visaCheckResult(country, defaultPassportCode(), String(row?.visa || '')).kind
    : null;
  const copy = t();
  const chips = destinationChips({
    temp: tempChipLabel(temp, c => formatTempC(c, getPrefs().tempUnit)),
    currency: currencyChipLabel(row?.currency?.code),
    visa: visaChipLabel(visa, {
      visaFreeShort: copy.visaFreeShort,
      visaEvisaShort: copy.visaEvisaShort,
      visaEtaShort: copy.visaEtaShort,
      visaRequiredShort: copy.visaRequiredShort,
    }),
  });
  if (!chips.length) return null;

  const press = (id: DestinationChip['id']) => {
    if (id === 'temp') return onTempPress();
    if (id === 'currency') return onCurrencyPress();
    return onVisaPress();
  };

  return (
    <View style={styles.row}>
      {chips.map(chip => (
        <Pressable
          key={chip.id}
          onPress={() => press(chip.id)}
          style={[styles.chip, { backgroundColor: theme.card, borderColor: theme.border }]}
          accessibilityRole="button"
          accessibilityLabel={`${chip.label}`}
        >
          <Text style={styles.icon}>{chip.icon}</Text>
          <Text style={[styles.label, { color: theme.text }]} numberOfLines={1}>{chip.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  icon: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '700' },
});
