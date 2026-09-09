/** Smart home-field parser: places, airlines, weekdays and relative dates in 11 languages. */

import { airportRecByIata, COUNTRY_META, matchPlaces, normKey } from './airportsDb.ts';
import { CITY_LOCALIZED, iatasForCityQuery } from './cityLocalized.ts';
import { COUNTRY_HUBS } from './countryHubs.ts';

export type SmartDateKind = 'today' | 'tomorrow' | 'weekday' | 'absolute' | 'next_week';

export type SmartQuery = {
  origin?: string;
  destination?: string;
  destinations?: string[];
  date?: string;
  dateKind?: SmartDateKind;
  weekday?: number;
  time?: string;
  airline?: string;
  airlineName?: string;
  flightNumber?: string;
  needsDate?: boolean;
  needsOrigin?: boolean;
  /** merge = fetch all dests; choose = chips, no fetch until one IATA is picked. */
  placeMode?: 'merge' | 'choose';
  ambiguous?: { kind: 'place' | 'airline' | 'date'; options: string[] };
};

export type ParseSmartQueryOpts = {
  now?: Date;
  homeIata?: string;
};

type TermKind = 'weekday' | 'today' | 'tomorrow' | 'next_week' | 'airline' | 'place' | 'month';

type Term = {
  phrase: string;
  kind: TermKind;
  weekday?: number;
  month?: number;
  airline?: { code: string; name: string };
  iatas?: string[];
};

const SKIP_FLIGHT_PREFIX = new Set(['AM', 'PM']);

const PLACE_HINTS: Record<string, string[]> = {
  seoul: ['ICN', 'GMP'],
  seoel: ['ICN', 'GMP'],
  seúl: ['ICN', 'GMP'],
  seul: ['ICN', 'GMP'],
  incheon: ['ICN'],
  korea: ['ICN', 'GMP'],
  southkorea: ['ICN', 'GMP'],
  tokyo: ['HND', 'NRT'],
  tokio: ['HND', 'NRT'],
  shanghai: ['PVG', 'SHA'],
  phuket: ['HKT'],
  bangkok: ['BKK', 'DMK'],
  amsterdam: ['AMS'],
};

/** Same-city multi-hub: one list, every airport fetched. */
const MERGE_HUB_KEYS = new Set([
  'HND,NRT',
  'GMP,ICN',
  'PVG,SHA',
  'BKK,DMK',
  'PEK,PKX',
]);

/** Different cities: chips, no fetch until the user picks one. */
const CHOOSE_HUB_KEYS = new Set([
  'HAN,SGN',
  'KHH,TPE',
  'PEK,PVG',
]);

function hubKey(iatas: string[]): string {
  return [...new Set(iatas.map(c => String(c || '').toUpperCase()).filter(Boolean))].sort().join(',');
}

export function hubPlaceMode(iatas: string[]): 'merge' | 'choose' | undefined {
  const key = hubKey(iatas);
  if (MERGE_HUB_KEYS.has(key)) return 'merge';
  if (CHOOSE_HUB_KEYS.has(key)) return 'choose';
  if (iatas.length > 1) return 'choose';
  return undefined;
}

/** True when empty-home should call FIDS (choose-hubs wait for an IATA chip). */
export function homeSearchCanFetch(q: SmartQuery): boolean {
  if (q.flightNumber) return true;
  if (q.placeMode === 'choose') return false;
  if (q.origin && q.destination && q.origin !== q.destination && q.dateKind) return true;
  if (q.placeMode === 'merge' && q.destinations?.length && q.dateKind) return true;
  if (q.destination && !q.origin && q.dateKind) return true;
  return false;
}

function applyPlaceDests(out: SmartQuery, dests: string[]) {
  const mode = hubPlaceMode(dests);
  if (mode === 'choose') {
    out.destinations = dests;
    out.placeMode = 'choose';
    return;
  }
  out.destination = dests[0];
  if (dests.length > 1) {
    out.destinations = dests;
    if (mode === 'merge') out.placeMode = 'merge';
  }
}

const WEEKDAYS: { phrase: string; weekday: number }[] = [
  // Sunday = 0
  { phrase: 'sunday', weekday: 0 }, { phrase: 'sun', weekday: 0 },
  { phrase: 'zondag', weekday: 0 },
  { phrase: 'sonntag', weekday: 0 },
  { phrase: 'domingo', weekday: 0 },
  { phrase: 'minggu', weekday: 0 }, { phrase: 'hari minggu', weekday: 0 },
  { phrase: 'chủ nhật', weekday: 0 }, { phrase: 'chu nhat', weekday: 0 },
  { phrase: 'วันอาทิตย์', weekday: 0 }, { phrase: 'อาทิตย์', weekday: 0 },
  { phrase: '日曜日', weekday: 0 }, { phrase: '日曜', weekday: 0 },
  { phrase: '일요일', weekday: 0 },
  { phrase: '星期日', weekday: 0 }, { phrase: '星期天', weekday: 0 }, { phrase: '周日', weekday: 0 },
  { phrase: 'воскресенье', weekday: 0 },
  { phrase: 'monday', weekday: 1 }, { phrase: 'mon', weekday: 1 },
  { phrase: 'maandag', weekday: 1 },
  { phrase: 'montag', weekday: 1 },
  { phrase: 'lunes', weekday: 1 },
  { phrase: 'senin', weekday: 1 },
  { phrase: 'thứ hai', weekday: 1 }, { phrase: 'thu hai', weekday: 1 },
  { phrase: 'วันจันทร์', weekday: 1 }, { phrase: 'จันทร์', weekday: 1 },
  { phrase: '月曜日', weekday: 1 }, { phrase: '月曜', weekday: 1 },
  { phrase: '월요일', weekday: 1 },
  { phrase: '星期一', weekday: 1 }, { phrase: '周一', weekday: 1 },
  { phrase: 'понедельник', weekday: 1 },
  { phrase: 'tuesday', weekday: 2 }, { phrase: 'tue', weekday: 2 }, { phrase: 'tues', weekday: 2 },
  { phrase: 'dinsdag', weekday: 2 },
  { phrase: 'dienstag', weekday: 2 },
  { phrase: 'martes', weekday: 2 },
  { phrase: 'selasa', weekday: 2 },
  { phrase: 'thứ ba', weekday: 2 }, { phrase: 'thu ba', weekday: 2 },
  { phrase: 'วันอังคาร', weekday: 2 }, { phrase: 'อังคาร', weekday: 2 },
  { phrase: '火曜日', weekday: 2 }, { phrase: '火曜', weekday: 2 },
  { phrase: '화요일', weekday: 2 },
  { phrase: '星期二', weekday: 2 }, { phrase: '周二', weekday: 2 },
  { phrase: 'вторник', weekday: 2 },
  { phrase: 'wednesday', weekday: 3 }, { phrase: 'wed', weekday: 3 },
  { phrase: 'woensdag', weekday: 3 },
  { phrase: 'mittwoch', weekday: 3 },
  { phrase: 'miércoles', weekday: 3 }, { phrase: 'miercoles', weekday: 3 },
  { phrase: 'rabu', weekday: 3 },
  { phrase: 'thứ tư', weekday: 3 }, { phrase: 'thu tu', weekday: 3 },
  { phrase: 'วันพุธ', weekday: 3 }, { phrase: 'พุธ', weekday: 3 },
  { phrase: '水曜日', weekday: 3 }, { phrase: '水曜', weekday: 3 },
  { phrase: '수요일', weekday: 3 },
  { phrase: '星期三', weekday: 3 }, { phrase: '周三', weekday: 3 },
  { phrase: 'среда', weekday: 3 },
  { phrase: 'thursday', weekday: 4 }, { phrase: 'thu', weekday: 4 }, { phrase: 'thur', weekday: 4 }, { phrase: 'thurs', weekday: 4 },
  { phrase: 'donderdag', weekday: 4 },
  { phrase: 'donnerstag', weekday: 4 },
  { phrase: 'jueves', weekday: 4 },
  { phrase: 'kamis', weekday: 4 },
  { phrase: 'thứ năm', weekday: 4 }, { phrase: 'thu nam', weekday: 4 },
  { phrase: 'วันพฤหัสบดี', weekday: 4 }, { phrase: 'พฤหัสบดี', weekday: 4 }, { phrase: 'พฤหัส', weekday: 4 },
  { phrase: '木曜日', weekday: 4 }, { phrase: '木曜', weekday: 4 },
  { phrase: '목요일', weekday: 4 },
  { phrase: '星期四', weekday: 4 }, { phrase: '周四', weekday: 4 },
  { phrase: 'четверг', weekday: 4 },
  { phrase: 'friday', weekday: 5 }, { phrase: 'fri', weekday: 5 },
  { phrase: 'vrijdag', weekday: 5 },
  { phrase: 'freitag', weekday: 5 },
  { phrase: 'viernes', weekday: 5 },
  { phrase: 'jumat', weekday: 5 }, { phrase: 'jum\'at', weekday: 5 },
  { phrase: 'thứ sáu', weekday: 5 }, { phrase: 'thu sau', weekday: 5 },
  { phrase: 'วันศุกร์', weekday: 5 }, { phrase: 'ศุกร์', weekday: 5 },
  { phrase: '金曜日', weekday: 5 }, { phrase: '金曜', weekday: 5 },
  { phrase: '금요일', weekday: 5 },
  { phrase: '星期五', weekday: 5 }, { phrase: '周五', weekday: 5 },
  { phrase: 'пятница', weekday: 5 },
  { phrase: 'saturday', weekday: 6 }, { phrase: 'sat', weekday: 6 },
  { phrase: 'zaterdag', weekday: 6 },
  { phrase: 'samstag', weekday: 6 },
  { phrase: 'sábado', weekday: 6 }, { phrase: 'sabado', weekday: 6 },
  { phrase: 'sabtu', weekday: 6 },
  { phrase: 'thứ bảy', weekday: 6 }, { phrase: 'thu bay', weekday: 6 },
  { phrase: 'วันเสาร์', weekday: 6 }, { phrase: 'เสาร์', weekday: 6 },
  { phrase: '土曜日', weekday: 6 }, { phrase: '土曜', weekday: 6 },
  { phrase: '토요일', weekday: 6 },
  { phrase: '星期六', weekday: 6 }, { phrase: '周六', weekday: 6 },
  { phrase: 'суббота', weekday: 6 },
];

const RELATIVE: { phrase: string; kind: 'today' | 'tomorrow' | 'next_week' }[] = [
  { phrase: 'today', kind: 'today' }, { phrase: 'tonight', kind: 'today' },
  { phrase: 'vandaag', kind: 'today' },
  { phrase: 'heute', kind: 'today' },
  { phrase: 'hoy', kind: 'today' },
  { phrase: 'hari ini', kind: 'today' },
  { phrase: 'hôm nay', kind: 'today' }, { phrase: 'hom nay', kind: 'today' },
  { phrase: 'วันนี้', kind: 'today' },
  { phrase: '今日', kind: 'today' },
  { phrase: '오늘', kind: 'today' },
  { phrase: '今天', kind: 'today' }, { phrase: '今日', kind: 'today' },
  { phrase: 'сегодня', kind: 'today' },
  { phrase: 'tomorrow', kind: 'tomorrow' },
  { phrase: 'morgen', kind: 'tomorrow' },
  { phrase: 'mañana', kind: 'tomorrow' }, { phrase: 'manana', kind: 'tomorrow' },
  { phrase: 'besok', kind: 'tomorrow' },
  { phrase: 'ngày mai', kind: 'tomorrow' }, { phrase: 'ngay mai', kind: 'tomorrow' },
  { phrase: 'พรุ่งนี้', kind: 'tomorrow' },
  { phrase: '明日', kind: 'tomorrow' },
  { phrase: '내일', kind: 'tomorrow' },
  { phrase: '明天', kind: 'tomorrow' },
  { phrase: 'завтра', kind: 'tomorrow' },
  { phrase: 'next week', kind: 'next_week' },
  { phrase: 'volgende week', kind: 'next_week' },
  { phrase: 'nächste woche', kind: 'next_week' }, { phrase: 'nachste woche', kind: 'next_week' },
  { phrase: 'la próxima semana', kind: 'next_week' }, { phrase: 'próxima semana', kind: 'next_week' },
  { phrase: 'proxima semana', kind: 'next_week' },
  { phrase: 'minggu depan', kind: 'next_week' },
  { phrase: 'tuần sau', kind: 'next_week' }, { phrase: 'tuan sau', kind: 'next_week' },
  { phrase: 'สัปดาห์หน้า', kind: 'next_week' },
  { phrase: '来週', kind: 'next_week' },
  { phrase: '다음 주', kind: 'next_week' }, { phrase: '다음주', kind: 'next_week' },
  { phrase: '下周', kind: 'next_week' }, { phrase: '下星期', kind: 'next_week' },
  { phrase: 'на следующей неделе', kind: 'next_week' }, { phrase: 'следующая неделя', kind: 'next_week' },
];

const MONTHS: { phrase: string; month: number }[] = [
  { phrase: 'january', month: 0 }, { phrase: 'januari', month: 0 }, { phrase: 'januar', month: 0 },
  { phrase: 'enero', month: 0 }, { phrase: 'jan', month: 0 }, { phrase: 'ene', month: 0 },
  { phrase: 'มกราคม', month: 0 }, { phrase: 'ม.ค.', month: 0 }, { phrase: 'января', month: 0 }, { phrase: 'янв', month: 0 },
  { phrase: 'february', month: 1 }, { phrase: 'februari', month: 1 }, { phrase: 'februar', month: 1 },
  { phrase: 'febrero', month: 1 }, { phrase: 'feb', month: 1 }, { phrase: 'feb', month: 1 },
  { phrase: 'กุมภาพันธ์', month: 1 }, { phrase: 'ก.พ.', month: 1 }, { phrase: 'февраля', month: 1 },
  { phrase: 'march', month: 2 }, { phrase: 'maart', month: 2 }, { phrase: 'märz', month: 2 }, { phrase: 'maerz', month: 2 },
  { phrase: 'marzo', month: 2 }, { phrase: 'mrt', month: 2 }, { phrase: 'mar', month: 2 }, { phrase: 'märz', month: 2 },
  { phrase: 'มีนาคม', month: 2 }, { phrase: 'มี.ค.', month: 2 }, { phrase: 'марта', month: 2 },
  { phrase: 'april', month: 3 }, { phrase: 'abril', month: 3 }, { phrase: 'apr', month: 3 }, { phrase: 'abr', month: 3 },
  { phrase: 'เมษายน', month: 3 }, { phrase: 'เม.ย.', month: 3 }, { phrase: 'апреля', month: 3 },
  { phrase: 'may', month: 4 }, { phrase: 'mei', month: 4 }, { phrase: 'mayo', month: 4 }, { phrase: 'mai', month: 4 },
  { phrase: 'พฤษภาคม', month: 4 }, { phrase: 'พ.ค.', month: 4 }, { phrase: 'мая', month: 4 },
  { phrase: 'june', month: 5 }, { phrase: 'juni', month: 5 }, { phrase: 'junio', month: 5 }, { phrase: 'jun', month: 5 },
  { phrase: 'มิถุนายน', month: 5 }, { phrase: 'มิ.ย.', month: 5 }, { phrase: 'июня', month: 5 },
  { phrase: 'july', month: 6 }, { phrase: 'juli', month: 6 }, { phrase: 'julio', month: 6 }, { phrase: 'jul', month: 6 },
  { phrase: 'กรกฎาคม', month: 6 }, { phrase: 'ก.ค.', month: 6 }, { phrase: 'июля', month: 6 },
  { phrase: 'august', month: 7 }, { phrase: 'augustus', month: 7 }, { phrase: 'agosto', month: 7 }, { phrase: 'aug', month: 7 },
  { phrase: 'ago', month: 7 }, { phrase: 'สิงหาคม', month: 7 }, { phrase: 'ส.ค.', month: 7 }, { phrase: 'августа', month: 7 }, { phrase: 'авг', month: 7 },
  { phrase: 'september', month: 8 }, { phrase: 'septiembre', month: 8 }, { phrase: 'sept', month: 8 }, { phrase: 'sep', month: 8 },
  { phrase: 'sep', month: 8 }, { phrase: 'กันยายน', month: 8 }, { phrase: 'ก.ย.', month: 8 }, { phrase: 'сентября', month: 8 },
  { phrase: 'october', month: 9 }, { phrase: 'oktober', month: 9 }, { phrase: 'octubre', month: 9 },
  { phrase: 'oct', month: 9 }, { phrase: 'okt', month: 9 }, { phrase: 'octubre', month: 9 },
  { phrase: 'ตุลาคม', month: 9 }, { phrase: 'ต.ค.', month: 9 }, { phrase: 'октября', month: 9 },
  { phrase: 'november', month: 10 }, { phrase: 'noviembre', month: 10 }, { phrase: 'nov', month: 10 },
  { phrase: 'พฤศจิกายน', month: 10 }, { phrase: 'พ.ย.', month: 10 }, { phrase: 'ноября', month: 10 },
  { phrase: 'december', month: 11 }, { phrase: 'diciembre', month: 11 }, { phrase: 'dec', month: 11 }, { phrase: 'dic', month: 11 },
  { phrase: 'ธันวาคม', month: 11 }, { phrase: 'ธ.ค.', month: 11 }, { phrase: 'декабря', month: 11 },
];

const AIRLINES: { keys: string[]; code: string; name: string }[] = [
  { keys: ['asiana', 'asiana airlines', '아시아나', '아시아나항공', 'アシアナ', 'アシアナ航空', '韩亚', '韩亚航空', 'азиана', 'เอเชียนา', 'oz'], code: 'OZ', name: 'Asiana' },
  { keys: ['korean air', '대한항공', '大韓航空', '대한 항공', 'ke'], code: 'KE', name: 'Korean Air' },
  { keys: ['thai', 'thai airways', 'thai air', 'การบินไทย', 'タイ国際航空', '태국항공', '泰国航空', 'tg'], code: 'TG', name: 'Thai Airways' },
  { keys: ['singapore airlines', 'singapore air', 'sia', 'sq'], code: 'SQ', name: 'Singapore Airlines' },
  { keys: ['klm', 'klm royal'], code: 'KL', name: 'KLM' },
  { keys: ['emirates', 'ek'], code: 'EK', name: 'Emirates' },
  { keys: ['qatar', 'qatar airways', 'qr'], code: 'QR', name: 'Qatar Airways' },
  { keys: ['cathay', 'cathay pacific', 'cx'], code: 'CX', name: 'Cathay Pacific' },
  { keys: ['ana', 'nh'], code: 'NH', name: 'ANA' },
  { keys: ['jal', 'japan airlines', 'jl'], code: 'JL', name: 'Japan Airlines' },
  { keys: ['lufthansa', 'lh'], code: 'LH', name: 'Lufthansa' },
  { keys: ['british airways', 'ba'], code: 'BA', name: 'British Airways' },
  { keys: ['air france', 'af'], code: 'AF', name: 'Air France' },
  { keys: ['scoot', 'tr'], code: 'TR', name: 'Scoot' },
  { keys: ['garuda', 'ga'], code: 'GA', name: 'Garuda Indonesia' },
];

const INCHEON_PHRASES = ['incheon', '인천', '仁川', 'อินชอน', 'インチョン', 'инчхон'];

function fold(s: string): string {
  return String(s || '').toLowerCase();
}

function isCjkOrThai(ch: string): boolean {
  const c = ch.codePointAt(0) || 0;
  return (
    (c >= 0x0e00 && c <= 0x0e7f) ||
    (c >= 0x3040 && c <= 0x30ff) ||
    (c >= 0x3400 && c <= 0x9fff) ||
    (c >= 0xac00 && c <= 0xd7af)
  );
}

function isWordChar(ch: string | undefined): boolean {
  if (!ch) return false;
  if (isCjkOrThai(ch)) return true;
  return /[0-9a-z]/i.test(ch);
}

function boundaryOk(hay: string, start: number, end: number): boolean {
  const left = start > 0 ? hay[start - 1] : '';
  const right = end < hay.length ? hay[end] : '';
  const needleHasLatin = /[a-z0-9]/i.test(hay.slice(start, end));
  if (!needleHasLatin) return true;
  if (left && isWordChar(left) && !isCjkOrThai(left)) return false;
  if (right && isWordChar(right) && !isCjkOrThai(right)) return false;
  return true;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function ymdFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function addDays(now: Date, days: number): Date {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

function nextWeekdayDate(now: Date, weekday: number): Date {
  const add = (weekday - now.getDay() + 7) % 7;
  return addDays(now, add);
}

function yearlessYmd(now: Date, month: number, day: number): string | undefined {
  const thisYear = now.getFullYear();
  const tryDate = new Date(now.getFullYear(), month, day);
  if (tryDate.getMonth() !== month || tryDate.getDate() !== day) return undefined;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (tryDate.getTime() < today.getTime()) {
    const next = new Date(thisYear + 1, month, day);
    return ymdFromDate(next);
  }
  return ymdFromDate(tryDate);
}

const FLIGHT_RE = /(?:^|[^A-Za-z0-9])([A-Za-z]{2})\s?(\d{1,4}[A-Za-z]?)(?=$|[^A-Za-z0-9])/g;

function extractFlightNumber(raw: string): { number: string; start: number; end: number } | null {
  const src = String(raw || '');
  FLIGHT_RE.lastIndex = 0;
  let best: { number: string; start: number; end: number } | null = null;
  let m: RegExpExecArray | null;
  while ((m = FLIGHT_RE.exec(src))) {
    const prefix = String(m[1] || '').toUpperCase();
    const digits = String(m[2] || '').toUpperCase();
    if (SKIP_FLIGHT_PREFIX.has(prefix) && /^[0-9]{1,2}$/.test(digits)) continue;
    const whole = src.slice(m.index, m.index + m[0].length);
    const lead = whole.match(/[^A-Za-z0-9]/) ? 1 : 0;
    const start = m.index + lead;
    const end = start + prefix.length + (m[0].includes(' ') ? 1 : 0) + digits.length;
    const number = `${prefix}${digits}`;
    if (/^[A-Z]{3}$/.test(number)) continue;
    if (prefix.length === 3 && airportRecByIata(prefix)) continue;
    best = { number, start, end: m.index + m[0].length };
  }
  return best;
}

function extractTime(raw: string): { time: string; start: number; end: number } | null {
  const src = String(raw || '');
  const m = src.match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
  if (!m || m.index == null) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || min > 59 || h > 24) return null;
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  if (h === 24) h = 0;
  if (h > 23) return null;
  return { time: `${pad2(h)}:${pad2(min)}`, start: m.index, end: m.index + m[0].length };
}

const ISO_DATE_RE = /\b(20\d{2})-(\d{2})-(\d{2})\b/;
const CJK_DATE_RE = /(\d{1,2})\s*[月월]\s*(\d{1,2})\s*[日일]?/;
const DM_DATE_RE = /\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/;

function extractAbsoluteDate(raw: string, now: Date, used: Uint8Array): { date: string; start: number; end: number } | null {
  const src = String(raw || '');
  const iso = src.match(ISO_DATE_RE);
  if (iso && iso.index != null && rangeFree(used, iso.index, iso.index + iso[0].length)) {
    return { date: iso[0], start: iso.index, end: iso.index + iso[0].length };
  }
  const cjk = src.match(CJK_DATE_RE);
  if (cjk && cjk.index != null && rangeFree(used, cjk.index, cjk.index + cjk[0].length)) {
    const date = yearlessYmd(now, Number(cjk[1]) - 1, Number(cjk[2]));
    if (date) return { date, start: cjk.index, end: cjk.index + cjk[0].length };
  }
  const dm = src.match(DM_DATE_RE);
  if (dm && dm.index != null && rangeFree(used, dm.index, dm.index + dm[0].length)) {
    const a = Number(dm[1]);
    const b = Number(dm[2]);
    const yearTok = dm[3];
    let month: number;
    let day: number;
    if (yearTok) {
      day = a;
      month = b - 1;
    } else if (a > 12) {
      day = a;
      month = b - 1;
    } else if (b > 12) {
      month = a - 1;
      day = b;
    } else {
      day = a;
      month = b - 1;
    }
    const date = yearTok
      ? (() => {
          const y = yearTok.length === 2 ? 2000 + Number(yearTok) : Number(yearTok);
          const d = new Date(y, month, day);
          return d.getMonth() === month && d.getDate() === day ? ymdFromDate(d) : undefined;
        })()
      : yearlessYmd(now, month, day);
    if (date) return { date, start: dm.index, end: dm.index + dm[0].length };
  }
  return null;
}

function rangeFree(used: Uint8Array, start: number, end: number): boolean {
  for (let i = start; i < end; i++) if (used[i]) return false;
  return true;
}

function markUsed(used: Uint8Array, start: number, end: number): void {
  for (let i = Math.max(0, start); i < Math.min(used.length, end); i++) used[i] = 1;
}

const TERMS: Term[] = (() => {
  const out: Term[] = [];
  for (const w of WEEKDAYS) out.push({ phrase: w.phrase, kind: 'weekday', weekday: w.weekday });
  for (const r of RELATIVE) out.push({ phrase: r.phrase, kind: r.kind });
  for (const m of MONTHS) out.push({ phrase: m.phrase, kind: 'month', month: m.month });
  for (const a of AIRLINES) {
    for (const key of a.keys) out.push({ phrase: key, kind: 'airline', airline: { code: a.code, name: a.name } });
  }
  const places = new Map<string, { phrase: string; iatas: string[] }>();
  const addPlace = (phrase: string, iatas: string[]) => {
    const key = fold(phrase);
    if (key.length < 2) return;
    const prev = places.get(key);
    if (prev) {
      for (const c of iatas) if (!prev.iatas.includes(c)) prev.iatas.push(c);
    } else {
      places.set(key, { phrase, iatas: [...iatas] });
    }
  };
  for (const phrase of INCHEON_PHRASES) addPlace(phrase, ['ICN']);
  for (const [key, iatas] of Object.entries(PLACE_HINTS)) addPlace(key, iatas);
  for (const [cc, meta] of Object.entries(COUNTRY_META)) {
    const hubs = COUNTRY_HUBS[cc];
    if (!hubs?.length) continue;
    addPlace(meta.name, hubs);
    for (const alias of meta.aliases) addPlace(alias, hubs);
  }
  for (const [iata, names] of Object.entries(CITY_LOCALIZED)) {
    addPlace(iata, [iata]);
    for (const name of Object.values(names)) {
      if (name) addPlace(name, [iata]);
    }
  }
  for (const p of places.values()) out.push({ phrase: p.phrase, kind: 'place', iatas: p.iatas });
  out.sort((a, b) => fold(b.phrase).length - fold(a.phrase).length);
  return out;
})();

type Hit = { start: number; end: number; term: Term };

function extractTerms(raw: string, used: Uint8Array): Hit[] {
  const hay = fold(raw);
  const hits: Hit[] = [];
  for (const term of TERMS) {
    const needle = fold(term.phrase);
    if (needle.length < 2 && term.kind !== 'place') continue;
    if (needle.length < 2) continue;
    let from = 0;
    while (from < hay.length) {
      const i = hay.indexOf(needle, from);
      if (i < 0) break;
      const end = i + needle.length;
      if (rangeFree(used, i, end) && boundaryOk(hay, i, end)) {
        markUsed(used, i, end);
        hits.push({ start: i, end, term });
      }
      from = i + 1;
    }
  }
  hits.sort((a, b) => a.start - b.start);
  return hits;
}

function remainingChunks(raw: string, used: Uint8Array): string[] {
  const chunks: string[] = [];
  let buf = '';
  const flush = () => {
    const t = buf.trim();
    if (t) chunks.push(t);
    buf = '';
  };
  for (let i = 0; i < raw.length; i++) {
    if (used[i]) {
      flush();
      continue;
    }
    buf += raw[i];
  }
  flush();
  const out: string[] = [];
  for (const chunk of chunks) {
    const parts = chunk.split(/[\s,./|]+|(?:→|->|–|—)/).map(s => s.trim()).filter(Boolean);
    out.push(...parts);
  }
  return out;
}

function resolvePlace(raw: string): string[] {
  const q = String(raw || '').trim();
  if (!q) return [];
  if (/^[A-Za-z]{3}$/.test(q)) {
    const rec = airportRecByIata(q);
    if (rec) return [rec.iata];
  }
  const hinted = PLACE_HINTS[normKey(q)] || PLACE_HINTS[fold(q).replace(/\s+/g, '')];
  if (hinted) return hinted;
  const loc = iatasForCityQuery(q);
  if (loc.length) return loc;
  const hits = matchPlaces(q, 8);
  if (!hits.length) return [];
  const country = hits.find(h => h.kind === 'country');
  if (country?.iatas.length) {
    const cc = airportRecByIata(country.iatas[0])?.country;
    if (cc && COUNTRY_HUBS[cc]) return COUNTRY_HUBS[cc];
    return country.iatas.slice(0, 4);
  }
  const codes: string[] = [];
  for (const h of hits) {
    for (const c of h.iatas) if (!codes.includes(c)) codes.push(c);
  }
  return codes;
}

function dayNearMonth(raw: string, used: Uint8Array, monthStart: number, monthEnd: number): number | undefined {
  const windowStart = Math.max(0, monthStart - 4);
  const windowEnd = Math.min(raw.length, monthEnd + 4);
  const left = raw.slice(windowStart, monthStart);
  const right = raw.slice(monthEnd, windowEnd);
  const leftM = left.match(/(\d{1,2})\s*$/);
  const rightM = right.match(/^\s*(\d{1,2})/);
  const take = (m: RegExpMatchArray | null, from: number, to: number) => {
    if (!m || m.index == null) return undefined;
    const day = Number(m[1]);
    if (day < 1 || day > 31) return undefined;
    if (!rangeFree(used, from + m.index, from + m.index + m[0].length)) return undefined;
    markUsed(used, from + m.index, from + m.index + m[0].length);
    return day;
  };
  return take(leftM, windowStart, monthStart) ?? take(rightM, monthEnd, windowEnd);
}

export function dateOffsetDays(dateIso: string, todayIso: string): number {
  const a = Date.parse(`${dateIso}T00:00:00`);
  const b = Date.parse(`${todayIso}T00:00:00`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((a - b) / 86_400_000);
}

export function parseSmartQuery(raw: string, opts?: ParseSmartQueryOpts): SmartQuery {
  const src = String(raw || '').trim();
  const now = opts?.now ?? new Date();
  const home = String(opts?.homeIata || '').trim().toUpperCase();
  const out: SmartQuery = {};
  if (!src) {
    if (!home) out.needsOrigin = true;
    return out;
  }

  const used = new Uint8Array(src.length);

  const flight = extractFlightNumber(src);
  if (flight) {
    out.flightNumber = flight.number;
    markUsed(used, flight.start, flight.end);
  }

  const timeHit = extractTime(src);
  if (timeHit && rangeFree(used, timeHit.start, timeHit.end)) {
    out.time = timeHit.time;
    markUsed(used, timeHit.start, timeHit.end);
  }

  const abs = extractAbsoluteDate(src, now, used);
  if (abs) {
    out.date = abs.date;
    out.dateKind = 'absolute';
    markUsed(used, abs.start, abs.end);
  }

  const hits = extractTerms(src, used);
  const placeGroups: string[][] = [];

  for (const hit of hits) {
    const term = hit.term;
    if (term.kind === 'today') {
      out.dateKind = 'today';
      out.date = ymdFromDate(now);
    } else if (term.kind === 'tomorrow') {
      out.dateKind = 'tomorrow';
      out.date = ymdFromDate(addDays(now, 1));
    } else if (term.kind === 'next_week') {
      out.dateKind = 'next_week';
      out.date = ymdFromDate(addDays(now, 7));
    } else if (term.kind === 'weekday' && term.weekday != null) {
      out.dateKind = 'weekday';
      out.weekday = term.weekday;
      out.date = ymdFromDate(nextWeekdayDate(now, term.weekday));
    } else if (term.kind === 'airline' && term.airline) {
      if (!out.airline) {
        out.airline = term.airline.code;
        out.airlineName = term.airline.name;
      } else if (out.airline !== term.airline.code) {
        out.ambiguous = { kind: 'airline', options: [out.airline, term.airline.code] };
      }
    } else if (term.kind === 'place' && term.iatas?.length) {
      placeGroups.push(term.iatas);
    } else if (term.kind === 'month' && term.month != null && !out.date) {
      const day = dayNearMonth(src, used, hit.start, hit.end);
      if (day) {
        const date = yearlessYmd(now, term.month, day);
        if (date) {
          out.date = date;
          out.dateKind = 'absolute';
        }
      }
    }
  }

  for (const chunk of remainingChunks(src, used)) {
    if (/^\d{1,2}[:.]\d{2}$/.test(chunk)) continue;
    const iatas = resolvePlace(chunk);
    if (iatas.length) placeGroups.push(iatas);
  }

  const routeSplit = src.split(/\s*(?:→|->|–|—)\s*/);
  if (routeSplit.length === 2 && !placeGroups.length) {
    const a = resolvePlace(routeSplit[0]);
    const b = resolvePlace(routeSplit[1]);
    if (a.length && b.length) {
      placeGroups.push(a, b);
    }
  }

  const uniquePlaces: string[][] = [];
  const seenKey = new Set<string>();
  for (const g of placeGroups) {
    const key = g.join(',');
    if (seenKey.has(key)) continue;
    const overlap = uniquePlaces.some(p => p.some(c => g.includes(c)) && p.length === g.length);
    if (overlap) continue;
    seenKey.add(key);
    uniquePlaces.push(g);
  }

  if (uniquePlaces.length >= 2) {
    out.origin = uniquePlaces[0][0];
    applyPlaceDests(out, uniquePlaces[1]);
  } else if (uniquePlaces.length === 1) {
    const dests = uniquePlaces[0];
    applyPlaceDests(out, dests);
    const destIsHome = !!(home && dests.some(c => c === home));
    if (home && !destIsHome) out.origin = home;
    if (destIsHome) out.needsOrigin = true;
  }

  if (out.flightNumber && !out.dateKind) {
    out.dateKind = 'today';
    out.date = ymdFromDate(now);
  }

  if ((out.destination || out.placeMode === 'choose') && !out.dateKind && !out.date) out.needsDate = true;
  if (!out.origin && !home && (out.destination || out.airline || out.flightNumber)) {
    out.needsOrigin = true;
  }
  if (!out.origin && home && !out.flightNumber) {
    if (out.airline && !out.destination) out.origin = home;
    else if (out.destination && out.destination !== home) out.origin = home;
  }

  // Destination at home (or two tokens for the same airport) is arrivals, not a loop.
  if (out.origin && out.destination && out.origin === out.destination) {
    out.origin = undefined;
    out.needsOrigin = true;
  }
  if (home && out.destination === home && out.origin && out.origin === home) {
    out.origin = undefined;
    out.needsOrigin = true;
  }

  return out;
}

export type BoardSearch =
  | { kind: 'none' }
  | { kind: 'flight'; flightNumber: string }
  | { kind: 'route'; origin: string; destination: string; offset: number }
  | { kind: 'place'; iata: string; offset: number; arrivalsOnly: boolean };

/** Map a board search-box string onto the same parser as the empty-home field. */
export function resolveBoardSearch(raw: string, opts?: ParseSmartQueryOpts): BoardSearch {
  const src = String(raw || '').trim();
  if (!src) return { kind: 'none' };
  const now = opts?.now ?? new Date();
  const q = parseSmartQuery(src, { ...opts, now });
  const today = ymdFromDate(now);
  const offset = q.date ? dateOffsetDays(q.date, today) : 0;
  if (q.flightNumber) return { kind: 'flight', flightNumber: q.flightNumber };
  if (q.origin && q.destination && q.origin !== q.destination) {
    return { kind: 'route', origin: q.origin, destination: q.destination, offset };
  }
  if (q.destination) {
    return { kind: 'place', iata: q.destination, offset, arrivalsOnly: !!q.needsOrigin };
  }
  return { kind: 'none' };
}
