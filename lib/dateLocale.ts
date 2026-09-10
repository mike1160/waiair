/** date-fns locale for the app UI language (weekday / month names). */

import type { Locale as DateFnsLocale } from 'date-fns';
import { de } from 'date-fns/locale/de';
import { enUS } from 'date-fns/locale/en-US';
import { es } from 'date-fns/locale/es';
import { id } from 'date-fns/locale/id';
import { ja } from 'date-fns/locale/ja';
import { ko } from 'date-fns/locale/ko';
import { nl } from 'date-fns/locale/nl';
import { ru } from 'date-fns/locale/ru';
import { th } from 'date-fns/locale/th';
import { vi } from 'date-fns/locale/vi';
import { zhCN } from 'date-fns/locale/zh-CN';

const MAP: Record<string, DateFnsLocale> = {
  en: enUS,
  nl,
  zh: zhCN,
  th,
  de,
  ru,
  ja,
  ko,
  vi,
  id,
  es,
};

export function dateFnsLocale(locale?: string): DateFnsLocale {
  const lang = String(locale || 'en').split('-')[0];
  return MAP[lang] || enUS;
}
