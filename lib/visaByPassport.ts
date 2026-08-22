import { getLocales } from 'expo-localization';

export type PassportOpt = { code: string; flag: string };

export const PASSPORT_OPTIONS: PassportOpt[] = [
  { code: 'NL', flag: '🇳🇱' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'FR', flag: '🇫🇷' },
  { code: 'GB', flag: '🇬🇧' },
  { code: 'US', flag: '🇺🇸' },
  { code: 'AU', flag: '🇦🇺' },
  { code: 'CN', flag: '🇨🇳' },
  { code: 'JP', flag: '🇯🇵' },
  { code: 'KR', flag: '🇰🇷' },
  { code: 'IN', flag: '🇮🇳' },
  { code: 'TH', flag: '🇹🇭' },
  { code: 'SG', flag: '🇸🇬' },
  { code: 'MY', flag: '🇲🇾' },
];

const EU = new Set(['NL', 'DE', 'FR']);
const SCHENGEN = new Set(['NL', 'DE', 'FR', 'ES', 'IT', 'AT', 'BE', 'PT', 'IE']);
const CODES = new Set(PASSPORT_OPTIONS.map(p => p.code));

const LANG_TO_PASSPORT: Record<string, string> = {
  nl: 'NL', de: 'DE', fr: 'FR', th: 'TH', ja: 'JP', ko: 'KR',
  zh: 'CN', hi: 'IN', ms: 'MY',
};

export function defaultPassportCode(): string {
  const loc = getLocales()[0];
  const region = String(loc?.regionCode || '').toUpperCase();
  if (CODES.has(region)) return region;
  const lang = String(loc?.languageCode || '').toLowerCase();
  if (lang === 'en') {
    if (region === 'US' || region === 'AU' || region === 'GB') return region;
    return 'GB';
  }
  return LANG_TO_PASSPORT[lang] || 'NL';
}

export function passportFlag(code: string): string {
  return PASSPORT_OPTIONS.find(p => p.code === code)?.flag || '🛂';
}

/** Short nationality-aware line; falls back to the destination’s generic visa note. */
export function visaTextForPassport(destCountry: string, passport: string, generic: string): string {
  const dest = String(destCountry || '').toUpperCase();
  const p = String(passport || '').toUpperCase();
  if (!p) return generic;
  if (p === dest) return 'You are entering your home country — citizens do not need a visitor visa.';
  if (EU.has(p) && (EU.has(dest) || SCHENGEN.has(dest))) {
    return 'EU/Schengen free movement for EU citizens. Bring your passport or national ID.';
  }
  if (dest === 'TH' && ['NL', 'DE', 'FR', 'GB', 'US', 'AU', 'JP', 'KR', 'SG', 'MY'].includes(p)) {
    return 'Visa exemption up to 60 days for this passport; e-visa is also available.';
  }
  if (dest === 'TH' && (p === 'CN' || p === 'IN')) {
    return 'e-visa or visa exemption may apply — confirm the current rule for this passport before travel.';
  }
  if (dest === 'SG' && p !== 'CN' && p !== 'IN') {
    return 'Visa-free for this passport (typically 30–90 days). Check the latest ICA advice.';
  }
  if (dest === 'MY' && p !== 'CN') {
    return 'Visa exemption is typical for this passport (often 30–90 days).';
  }
  if (dest === 'GB' && ['NL', 'DE', 'FR', 'US', 'AU', 'SG', 'JP', 'KR'].includes(p)) {
    return 'ETA required before travel for this passport (not a visa). Apply online.';
  }
  if (dest === 'US' && ['NL', 'DE', 'FR', 'GB', 'AU', 'JP', 'KR', 'SG'].includes(p)) {
    return 'ESTA / Visa Waiver likely for this passport — authorize before boarding.';
  }
  if (dest === 'AU' && ['NL', 'DE', 'FR', 'GB', 'US', 'SG', 'JP', 'KR', 'MY'].includes(p)) {
    return 'ETA or eVisitor required before travel for this passport.';
  }
  if (p === 'CN' || p === 'IN') {
    return `${generic} ${p} passports often need an e-visa or pre-approval — verify before you fly.`;
  }
  return `${generic} Confirm the latest rule for ${p} passports before you fly.`;
}
