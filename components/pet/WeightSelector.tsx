import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AnimalType } from '../../types/pet';
import { PET_STRINGS } from '../../lib/pet/petStrings';

interface Props {
  animal: AnimalType;
  onConfirm: (weightKg: number, isBrachycephalic: boolean) => void;
  onBack: () => void;
}

export function WeightSelector({ animal, onConfirm, onBack }: Props) {
  const needsWeight = animal === 'dog_small' || animal === 'cat';
  const [weight, setWeight] = useState(4);
  const [brachy, setBrachy] = useState(false);

  useEffect(() => {
    if (!needsWeight) {
      onConfirm(0, false);
    }
  }, [needsWeight, onConfirm]);

  if (!needsWeight) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.weightValue}>{PET_STRINGS.weightLabel(weight)}</Text>
      <View style={styles.sliderRow}>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => setWeight(w => Math.max(1, w - 1))}
        >
          <Text style={styles.stepTxt}>−</Text>
        </TouchableOpacity>
        <View style={styles.track}>
          <View style={[styles.trackFill, { width: `${((weight - 1) / 9) * 100}%` }]} />
        </View>
        <TouchableOpacity
          style={styles.stepBtn}
          onPress={() => setWeight(w => Math.min(10, w + 1))}
        >
          <Text style={styles.stepTxt}>+</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={styles.checkRow}
        onPress={() => setBrachy(v => !v)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, brachy && styles.checkboxOn]}>
          {brachy ? <Text style={styles.tick}>✓</Text> : null}
        </View>
        <Text style={styles.checkLabel}>{PET_STRINGS.brachyLabel}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.confirm} onPress={() => onConfirm(weight, brachy)}>
        <Text style={styles.confirmTxt}>{PET_STRINGS.confirmCheck}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.back} onPress={onBack}>
        <Text style={styles.backTxt}>{PET_STRINGS.back}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 8 },
  weightValue: { fontSize: 22, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 16 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  stepBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { fontSize: 22, fontWeight: '600', color: '#111827' },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  trackFill: { height: '100%', backgroundColor: '#2563eb' },
  checkRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#9ca3af',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  tick: { color: '#fff', fontSize: 13, fontWeight: '700' },
  checkLabel: { fontSize: 14, color: '#111827', flex: 1 },
  confirm: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  confirmTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  back: { paddingVertical: 12, alignItems: 'center' },
  backTxt: { fontSize: 15, color: '#6b7280', fontWeight: '600' },
});
