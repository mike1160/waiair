import type { Locale } from './i18n';

/** Picker labels in each language's own script — never translated into the active UI locale. */
export const LANGUAGE_OPTIONS: readonly { code: Locale; flag: string; name: string }[] = [
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'nl', flag: '🇳🇱', name: 'Nederlands' },
  { code: 'th', flag: '🇹🇭', name: 'ไทย' },
  { code: 'zh', flag: '🇨🇳', name: '中文' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'ru', flag: '🇷🇺', name: 'Русский' },
  { code: 'ja', flag: '🇯🇵', name: '日本語' },
  { code: 'ko', flag: '🇰🇷', name: '한국어' },
  { code: 'vi', flag: '🇻🇳', name: 'Tiếng Việt' },
  { code: 'id', flag: '🇮🇩', name: 'Indonesia' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
] as const;
