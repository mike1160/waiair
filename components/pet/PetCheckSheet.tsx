import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetScrollView, BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { AnimalType, PetCheckResult } from '../../types/pet';
import { checkPet } from '../../lib/pet/petChecker';
import { PET_STRINGS } from '../../lib/pet/petStrings';
import { AnimalSelector } from './AnimalSelector';
import { WeightSelector } from './WeightSelector';
import { PetResultCard } from './PetResultCard';

interface Props {
  airlineIata: string;
  flightNumber: string;
  destIata?: string;
  destCity?: string;
  onClose: () => void;
}

type Step = 1 | 2 | 3;

export function PetCheckSheet({ airlineIata, flightNumber, destIata, destCity, onClose }: Props) {
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
          <PetResultCard
            key={result.sourceUrl + result.allowed}
            result={result}
            flightNumber={flightNumber}
            destIata={destIata}
            destCity={destCity}
          />
        )}

        {step === 3 && !horseSelected && !result && (
          <View style={styles.unknownBox}>
            <Text style={styles.unknownText}>
              ❓ {PET_STRINGS.unknownAirline(airlineIata)}
            </Text>
          </View>
        )}

        {step === 3 && !horseSelected && (
          <CrateSizeCalculator />
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

/** IATA CR 1 approximation from length (nose→tail base) + standing height only. */
function iataCrateCm(lengthCm: number, heightCm: number) {
  const crateLength = Math.ceil(lengthCm + heightCm * 0.2);
  const crateWidth = Math.ceil(heightCm * 0.7);
  const crateHeight = Math.ceil(heightCm + 3);
  return { crateLength, crateWidth, crateHeight };
}

function CrateSizeCalculator() {
  const [length, setLength] = useState('');
  const [height, setHeight] = useState('');
  const l = Number(length);
  const h = Number(height);
  const ready = l > 0 && h > 0;
  const size = ready ? iataCrateCm(l, h) : null;

  return (
    <View style={crateStyles.box}>
      <Text style={crateStyles.title}>{PET_STRINGS.crateTitle}</Text>
      <Text style={crateStyles.label}>{PET_STRINGS.crateLength}</Text>
      <BottomSheetTextInput
        style={crateStyles.input}
        keyboardType="numeric"
        value={length}
        onChangeText={setLength}
        placeholder="cm"
        placeholderTextColor="#9ca3af"
      />
      <Text style={crateStyles.label}>{PET_STRINGS.crateHeight}</Text>
      <BottomSheetTextInput
        style={crateStyles.input}
        keyboardType="numeric"
        value={height}
        onChangeText={setHeight}
        placeholder="cm"
        placeholderTextColor="#9ca3af"
      />
      {size ? (
        <Text style={crateStyles.result}>
          {PET_STRINGS.crateResult(size.crateLength, size.crateWidth, size.crateHeight)}
        </Text>
      ) : null}
      <Text style={crateStyles.hint}>{PET_STRINGS.crateHint}</Text>
    </View>
  );
}

const crateStyles = StyleSheet.create({
  box: {
    margin: 16,
    marginTop: 8,
    padding: 14,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  label: { fontSize: 13, color: '#166534', marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#fff',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    marginBottom: 8,
  },
  result: { fontSize: 15, fontWeight: '700', color: '#166534', marginTop: 8, lineHeight: 22 },
  hint: { fontSize: 12, color: '#047857', marginTop: 8, lineHeight: 18 },
});
