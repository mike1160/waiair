/** Map device locales onto the 11 shipped app locales. */

export const SHIPPED_LOCALES = [
  'en', 'nl', 'zh', 'th', 'de', 'ru', 'ja', 'ko', 'vi', 'id', 'es',
] as const;

export type ShippedLocale = (typeof SHIPPED_LOCALES)[number];

export type LocaleHint = {
  languageTag?: string | null;
  languageCode?: string | null;
  languageScriptCode?: string | null;
};

const LANG_TO_LOCALE: Record<string, ShippedLocale> = {
  en: 'en',
  nl: 'nl',
  zh: 'zh',
  yue: 'zh',
  cmn: 'zh',
  wuu: 'zh',
  th: 'th',
  de: 'de',
  ru: 'ru',
  ja: 'ja',
  ko: 'ko',
  vi: 'vi',
  id: 'id',
  in: 'id',
  es: 'es',
};

function firstSegment(raw: string): string {
  return String(raw || '').trim().toLowerCase().replace(/_/g, '-').split('-')[0] || '';
}

function mapOne(hint: LocaleHint): ShippedLocale | null {
  const tag = String(hint.languageTag || '').trim().toLowerCase().replace(/_/g, '-');
  const code = String(hint.languageCode || '').trim().toLowerCase();
  const script = String(hint.languageScriptCode || '').trim().toLowerCase();
  const primary = firstSegment(code || tag);

  if (primary === 'zh' || primary === 'yue' || primary === 'cmn' || primary === 'wuu' || tag.startsWith('zh')) {
    return 'zh';
  }
  if ((script === 'hant' || script === 'hans') && (primary === 'zh' || tag.startsWith('zh'))) {
    return 'zh';
  }

  return LANG_TO_LOCALE[primary] || LANG_TO_LOCALE[firstSegment(tag)] || null;
}

/** Walk the user's preferred locale list; last resort is en after no match. */
export function localeFromDeviceLocales(hints: readonly LocaleHint[]): ShippedLocale {
  for (const hint of hints) {
    const mapped = mapOne(hint);
    if (mapped) return mapped;
  }
  return 'en';
}

export function resolveAppLocale(opts: {
  storedLocale?: string | null;
  prefsExist: boolean;
  deviceLocales: readonly LocaleHint[];
}): ShippedLocale {
  const stored = String(opts.storedLocale || '').trim();
  if (opts.prefsExist && (SHIPPED_LOCALES as readonly string[]).includes(stored)) {
    return stored as ShippedLocale;
  }
  return localeFromDeviceLocales(opts.deviceLocales);
}
