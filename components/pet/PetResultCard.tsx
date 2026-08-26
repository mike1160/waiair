import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Linking, TouchableOpacity } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import { PetCheckResult } from '../../types/pet';
import { PET_STRINGS } from '../../lib/pet/petStrings';

interface Props {
  result: PetCheckResult;
  flightNumber: string;
}

const LABELS: Record<string, { emoji: string; text: string; color: string; bg: string }> = {
  cabin:       { emoji: '✅', text: PET_STRINGS.resultCabin,  color: '#166534', bg: '#dcfce7' },
  hold:        { emoji: '⚠️', text: PET_STRINGS.resultHold,        color: '#92400e', bg: '#fef3c7' },
  not_allowed: { emoji: '❌', text: PET_STRINGS.resultNotAllowed,       color: '#991b1b', bg: '#fee2e2' },
  unknown:     { emoji: '❓', text: PET_STRINGS.resultUnknown, color: '#374151', bg: '#f3f4f6' },
};

export function PetResultCard({ result, flightNumber }: Props) {
  const label = LABELS[result.allowed];
  const [checked, setChecked] = useState<boolean[]>(
    new Array(result.requirements.length).fill(false)
  );

  useEffect(() => {
    setChecked(new Array(result.requirements.length).fill(false));
  }, [result]);

  return (
    <View>
      <View style={[styles.resultBanner, { backgroundColor: label.bg }]}>
        <Text style={styles.emoji}>{label.emoji}</Text>
        <Text style={[styles.resultText, { color: label.color }]}>{label.text}</Text>
        <Text style={[styles.airline, { color: label.color }]}>
          {result.airlineName} · {flightNumber}
        </Text>
      </View>

      {result.requirements.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{PET_STRINGS.requirementsTitle}</Text>
          {result.requirements.map((req, i) => (
            <GHTouchableOpacity
              key={i}
              style={styles.checkRow}
              onPress={() => {
                const next = [...checked];
                next[i] = !next[i];
                setChecked(next);
              }}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: !!checked[i] }}
            >
              <Text style={[
                styles.checkIcon,
                checked[i] && styles.checkIconDone
              ]}>
                {checked[i] ? '☑' : '□'}
              </Text>
              <Text style={[
                styles.checkText,
                checked[i] && styles.checkTextDone
              ]}>
                {req}
              </Text>
            </GHTouchableOpacity>
          ))}
        </View>
      )}

      {result.warnings.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{PET_STRINGS.warningsTitle}</Text>
          {result.warnings.map((w, i) => (
            <View key={i} style={styles.warnRow}>
              <Text style={styles.warnIcon}>⚠️</Text>
              <Text style={styles.warnText}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.sourceRow}
        onPress={() => Linking.openURL(result.sourceUrl)}
      >
        <Text style={styles.sourceText}>
          {PET_STRINGS.sourceText(result.lastVerified)}
        </Text>
      </TouchableOpacity>

      <View style={styles.disclaimerBox}>
        <Text style={styles.disclaimerTitle}>{PET_STRINGS.disclaimerTitle}</Text>
        <Text style={styles.disclaimerText}>{PET_STRINGS.disclaimerText}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  resultBanner:  { borderRadius: 12, padding: 20, alignItems: 'center', margin: 16, marginBottom: 8 },
  emoji:         { fontSize: 36, marginBottom: 8 },
  resultText:    { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  airline:       { fontSize: 13, fontWeight: '500', opacity: 0.8 },
  section:       { marginHorizontal: 16, marginTop: 16 },
  sectionTitle:  { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  checkRow:      { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  checkIcon:     { fontSize: 16, color: '#059669', marginRight: 10, marginTop: 1 },
  checkIconDone: { color: '#059669' },
  checkText:     { fontSize: 15, color: '#111827', flex: 1, lineHeight: 22 },
  checkTextDone: { color: '#9ca3af', textDecorationLine: 'line-through' },
  warnRow:       { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  warnIcon:      { fontSize: 14, marginRight: 10, marginTop: 1 },
  warnText:      { fontSize: 14, color: '#92400e', flex: 1, lineHeight: 20 },
  sourceRow:     { margin: 16, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  sourceText:    { fontSize: 12, color: '#6b7280', textAlign: 'center' },
  disclaimerBox: {
    margin: 16,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#fffbeb',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  disclaimerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 6,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#78350f',
    lineHeight: 18,
  },
});
