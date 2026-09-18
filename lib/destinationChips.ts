/**
 * The three destination chips on the flight detail page (temperature, currency, visa).
 * Pure label logic: the screen passes in the values it already has, so this stays testable.
 */

import type { VisaCheckKind } from './visaByPassport';

export type DestinationChipsCopy = {
  visaFreeShort: string;
  visaEvisaShort: string;
  visaEtaShort: string;
  visaRequiredShort: string;
};

/** Temperature chip, e.g. "29°C"; '' when there is no reading yet (the chip is then left out). */
export function tempChipLabel(tempC: number | null | undefined, format: (c: number) => string): string {
  return typeof tempC === 'number' && Number.isFinite(tempC) ? format(tempC) : '';
}

/** Currency chip: the ISO code, e.g. "THB"; '' when the country has none on file. */
export function currencyChipLabel(code?: string | null): string {
  const c = String(code || '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(c) ? c : '';
}

/** Visa chip: the outcome in two or three words. */
export function visaChipLabel(kind: VisaCheckKind | null | undefined, copy: DestinationChipsCopy): string {
  switch (kind) {
    case 'free': return copy.visaFreeShort;
    case 'evisa': return copy.visaEvisaShort;
    case 'eta': return copy.visaEtaShort;
    case 'required': return copy.visaRequiredShort;
    default: return '';
  }
}

export type DestinationChip = { id: 'temp' | 'currency' | 'visa'; icon: string; label: string };

/** The chips worth drawing, in a fixed order; a chip without a value is left out. */
export function destinationChips(values: { temp: string; currency: string; visa: string }): DestinationChip[] {
  const chips: DestinationChip[] = [
    { id: 'temp', icon: '🌡️', label: values.temp },
    { id: 'currency', icon: '💱', label: values.currency },
    { id: 'visa', icon: '🛂', label: values.visa },
  ];
  return chips.filter(c => !!c.label);
}
