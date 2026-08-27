import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AnimalType } from '../../types/pet';
import { PET_STRINGS } from '../../lib/pet/petStrings';

interface Props {
  onSelect: (animal: AnimalType) => void;
}

export function AnimalSelector({ onSelect }: Props) {
  const ANIMALS: { type: AnimalType; emoji: string; label: string }[] = [
    { type: 'dog_small', emoji: '🐕', label: PET_STRINGS.animalDogSmall },
    { type: 'dog_large', emoji: '🐕', label: PET_STRINGS.animalDogLarge },
    { type: 'cat', emoji: '🐈', label: PET_STRINGS.animalCat },
    { type: 'rabbit', emoji: '🐇', label: PET_STRINGS.animalRabbit },
    { type: 'bird', emoji: '🐦', label: PET_STRINGS.animalBird },
    { type: 'other', emoji: '🦎', label: PET_STRINGS.animalOther },
    { type: 'horse', emoji: '🐴', label: PET_STRINGS.animalHorse },
  ];
  return (
    <View style={styles.grid}>
      {ANIMALS.map(item => (
        <TouchableOpacity
          key={item.type}
          style={[styles.btn, item.type === 'horse' && styles.horseBtn]}
          onPress={() => onSelect(item.type)}
          activeOpacity={0.7}
        >
          <Text style={styles.emoji}>{item.emoji}</Text>
          <Text style={styles.label}>{item.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    gap: 8,
  },
  btn: {
    width: '48%',
    height: 90,
    borderRadius: 12,
    backgroundColor: '#f9fafb',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  horseBtn: {
    width: '100%',
  },
  emoji: {
    fontSize: 36,
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    textAlign: 'center',
  },
});
