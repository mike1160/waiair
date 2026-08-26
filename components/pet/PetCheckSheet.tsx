import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { AnimalType, PetCheckResult } from '../../types/pet';
import { checkPet } from '../../lib/pet/petChecker';
import { PET_STRINGS } from '../../lib/pet/petStrings';
import { AnimalSelector } from './AnimalSelector';
import { WeightSelector } from './WeightSelector';
import { PetResultCard } from './PetResultCard';

interface Props {
  airlineIata: string;
  flightNumber: string;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

export function PetCheckSheet({ airlineIata, flightNumber, onClose }: Props) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['50%', '90%'], []);

  const [step, setStep] = useState<Step>(1);
  const [animal, setAnimal] = useState<AnimalType | null>(null);
  const [result, setResult] = useState<PetCheckResult | null>(null);
  const [horseSelected, setHorseSelected] = useState(false);

  const handleAnimalSelect = (a: AnimalType) => {
    setAnimal(a);
    if (a === 'horse') {
      setHorseSelected(true);
      setResult(null);
      setStep(3);
      sheetRef.current?.snapToIndex(1);
      return;
    }
    setHorseSelected(false);
    if (a !== 'dog_small' && a !== 'cat') {
      const r = checkPet(airlineIata, a, 0, false);
      setResult(r);
      setStep(3);
      sheetRef.current?.snapToIndex(1);
      return;
    }
    setStep(2);
  };

  const handleWeightConfirm = useCallback((w: number, brachy: boolean) => {
    if (!animal || animal === 'horse') return;
    const r = checkPet(airlineIata, animal, w, brachy);
    setResult(r);
    setStep(3);
    sheetRef.current?.snapToIndex(1);
  }, [airlineIata, animal]);

  const handleClose = useCallback(() => {
    setStep(1);
    setAnimal(null);
    setResult(null);
    setHorseSelected(false);
    onClose();
  }, [onClose]);

  const title =
    step === 1 ? PET_STRINGS.sheetTitle1
    : step === 2 ? PET_STRINGS.sheetTitle2
    : PET_STRINGS.sheetTitle3;

  return (
    <BottomSheet
      ref={sheetRef}
      snapPoints={snapPoints}
      index={0}
      onClose={handleClose}
      enablePanDownToClose
    >
      <BottomSheetScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.stepIndicator}>{PET_STRINGS.stepIndicator(step)}</Text>
        </View>

        {step === 1 && (
          <AnimalSelector onSelect={handleAnimalSelect} />
        )}

        {step === 2 && animal && animal !== 'horse' && (
          <WeightSelector
            animal={animal}
            onConfirm={handleWeightConfirm}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && horseSelected && (
          <View style={horseStyles.box}>
            <Text style={horseStyles.emoji}>🐴</Text>
            <Text style={horseStyles.title}>{PET_STRINGS.horseTitle}</Text>
            <Text style={horseStyles.text}>{PET_STRINGS.horseText}</Text>
            <Text style={horseStyles.disclaimer}>{PET_STRINGS.horseDisclaimer}</Text>
          </View>
        )}

        {step === 3 && !horseSelected && result && (
          <PetResultCard key={result.sourceUrl + result.allowed} result={result} flightNumber={flightNumber} />
        )}

        {step === 3 && !horseSelected && !result && (
          <View style={styles.unknownBox}>
            <Text style={styles.unknownText}>
              ❓ {PET_STRINGS.unknownAirline(airlineIata)}
            </Text>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  content:        { paddingBottom: 40 },
  header:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 8 },
  title:          { fontSize: 17, fontWeight: '700', color: '#111827' },
  stepIndicator:  { fontSize: 13, color: '#9ca3af' },
  unknownBox:     { margin: 16, padding: 16, backgroundColor: '#f3f4f6', borderRadius: 10 },
  unknownText:    { fontSize: 14, color: '#374151', lineHeight: 22 },
});

const horseStyles = StyleSheet.create({
  box: {
    margin: 16,
    padding: 20,
    backgroundColor: '#fffbeb',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fcd34d',
  },
  emoji: { fontSize: 36, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '700', color: '#92400e', textAlign: 'center', marginBottom: 10 },
  text: { fontSize: 14, color: '#78350f', lineHeight: 22 },
  disclaimer: { fontSize: 12, color: '#92400e', marginTop: 16, lineHeight: 18 },
});
