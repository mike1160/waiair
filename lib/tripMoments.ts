/**
 * The reasoning layer: the handful of moments on a trip that are worth saying something about, and when.
 *
 * Pure — no notifications, no storage, no network, no React Native — so every rule here is unit-tested.
 * lib/schedulePassengerPushes.ts turns what this returns into local notifications; nothing is scheduled here.
 *
 * A moment is only produced when the data behind it is actually known. Guessing is worse than silence: a
 * "your hotel check-in is at risk" that fires on every 20-minute delay trains people to ignore the app.
 */

import { baggageWalkMinutes, gateWalkMinutes } from './gateWalkCore.ts';
import { publicTransportFor, rideHailingFor } from './getIntoTownData.ts';
import { eveningPushFireUtcMs, leaveAtUtcMs } from './leaveTime.ts';
import { resolveArrivalIso, resolveDepartureIso } from './flightTimes.ts';
import { timezoneForIata } from './airportTz.ts';
import { formatInTimeZone } from 'date-fns-tz';
import { wallClockInZoneToUtcMs } from './localFlightTime.ts';
import type { TripFlight, TripGroup } from './tripOrchestrator.ts';

const MIN_MS = 60_000;
const DAY_MS = 86_400_000;

/** Under this much time between landing and the next departure, the connection is at risk. */
export const CONNECTION_RISK_MIN = 45;
/** How long before an activity starts the reminder fires. */
export const ACTIVITY_LEAD_MIN = 120;
/** Local hour, the day before, for the car-return reminder. */
export const CAR_RETURN_HOUR = 18;

export type MomentKind =
  | 'evening_before'
  | 'depart_now'
  | 'gate_change'
  | 'delay_impact'
  | 'landed'
  | 'activity_reminder'
  | 'car_return'
  | 'connection_risk'
  /** Follower only: the traveller is in the air. */
  | 'departed'
  /** Follower only: long enough after landing that they are probably at the hotel. */
  | 'hotel_arrived';

/**
 * Who a moment is for. 'traveler' stays on the device as a local notification; 'follower' is fanned out to
 * the people the traveller shared the flight with; 'both' goes to each, and may word itself differently.
 */
export type MomentAudience = 'traveler' | 'follower' | 'both';

/** Which audience each kind serves. */
export const MOMENT_AUDIENCE: Record<MomentKind, MomentAudience> = {
  evening_before: 'traveler',
  depart_now: 'traveler',
  gate_change: 'both',
  delay_impact: 'both',
  landed: 'both',
  activity_reminder: 'traveler',
  car_return: 'traveler',
  connection_risk: 'both',
  departed: 'follower',
  hotel_arrived: 'follower',
};

export type TripMoment = {
  key: string;
  /** When to fire. */
  triggerMs: number;
  kind: MomentKind;
  audience: MomentAudience;
  title: string;
  body: string;
  /**
   * What the people following this flight should read, when that differs from what the traveller reads.
   * Absent on a traveller-only moment; on an 'both' moment the follower text never repeats anything the
   * traveller would act on (a baggage belt is useless to someone at home).
   */
  followerTitle?: string;
  followerBody?: string;
  actionLabel?: string;
  /** mailto: / maps / https: — something the notification can open. */
  actionUrl?: string;
  flightKey: string;
  urgent: boolean;
};

export type MomentOpts = {
  locale: string;
  homeAirportCode?: string;
  /**
   * Minutes from where you are to the departure airport. There is no geocoder in a pure function, so the
   * caller passes it (lib/schedulePassengerPushes.ts already resolves one); left out it is treated as
   * unknown and leaveTime falls back to its own estimate.
   */
  travelMin?: number | null;
  /** The traveller's name, for the copy the followers read. Falls back to a neutral phrase. */
  travelerName?: string;
};

/*
 * Copy lives here rather than in lib/i18n.ts on purpose: this function takes its locale as an argument and
 * must stay pure and deterministic, while t() reads a module-level locale and pulls in the JSON catalogues,
 * which cannot be imported under `node --test`. English is the fallback for every other language.
 */
type Copy = {
  eveningTitle: (city: string, clock: string) => string;
  eveningLeave: (clock: string) => string;
  hotelCheckIn: (name: string, when: string) => string;
  carPickup: (company: string, when: string) => string;
  activityAt: (name: string, when: string) => string;
  departTitle: string;
  departBody: (flight: string, gate: string, walkMin: number) => string;
  gateUnknown: string;
  delayTitle: (min: number) => string;
  delayHotel: (name: string, when: string) => string;
  delayCar: (company: string, when: string) => string;
  openHotel: string;
  landedTitle: (city: string) => string;
  landedBelt: (belt: string) => string;
  landedNoBelt: string;
  landedTransport: (options: string) => string;
  landedHotel: (name: string, address: string) => string;
  activityTitle: string;
  activityBody: (name: string, pickup: string, clock: string) => string;
  carReturnTitle: string;
  carReturnBody: (company: string, place: string, when: string) => string;
  connectionTitle: string;
  connectionBody: (first: string, second: string, min: number) => string;
  /* Follower copy — what the people at home read. */
  /** Used when the traveller has not given a name. */
  someone: string;
  departedTitle: (name: string, flight: string, dest: string) => string;
  departedBody: (name: string, flight: string, dest: string, time: string) => string;
  hotelArrivedTitle: (name: string) => string;
  hotelArrivedBody: (name: string, hotel: string | undefined) => string;
  landedFollowerTitle: (name: string, dest: string) => string;
  landedFollowerBody: (name: string, dest: string, time: string) => string;
};

const EN: Copy = {
  eveningTitle: (city, clock) => `${city} tomorrow · ${clock}`,
  eveningLeave: clock => `Leave around ${clock}.`,
  hotelCheckIn: (name, when) => `Check in at ${name} ${when}.`,
  carPickup: (company, when) => `${company} car pick-up ${when}.`,
  activityAt: (name, when) => `${name} ${when}.`,
  departTitle: 'Time to leave',
  departBody: (flight, gate, walkMin) => `${flight} · ${gate} · about ${walkMin} min to the gate.`,
  gateUnknown: 'gate to be announced',
  delayTitle: min => `Delayed ${min} min — this affects your bookings`,
  delayHotel: (name, when) => `You land after check-in at ${name} (${when}).`,
  delayCar: (company, when) => `Your ${company} pick-up is at ${when}, before you land.`,
  openHotel: 'Open hotel in maps',
  landedTitle: city => `Welcome to ${city}`,
  landedBelt: belt => `Bags on belt ${belt}.`,
  landedNoBelt: 'Belt not announced yet.',
  landedTransport: options => `Into town: ${options}.`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}.`,
  activityTitle: 'Coming up in 2 hours',
  activityBody: (name, pickup, clock) => `${name} at ${clock}. Pick-up: ${pickup}.`,
  carReturnTitle: 'Car back tomorrow',
  carReturnBody: (company, place, when) => `${company}${place ? ` at ${place}` : ''} ${when}.`,
  connectionTitle: 'Tight connection',
  connectionBody: (first, second, min) => `${first} is late — ${min} min left to catch ${second}.`,
  someone: 'Your travel companion',
  departedTitle: (name) => `${name} has taken off`,
  departedBody: (name, flight, dest, time) => `${flight} on its way to ${dest}. Arrival: ${time}`,
  hotelArrivedTitle: (name) => `${name} has arrived`,
  hotelArrivedBody: (name, hotel) => hotel ? `Likely checked in at ${hotel}` : 'Likely at the hotel',
  landedFollowerTitle: (name, dest) => `${name} has landed in ${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `Local time: ${time}`,
};

const NL: Copy = {
  eveningTitle: (city, clock) => `${city} morgen · ${clock}`,
  eveningLeave: clock => `Vertrek rond ${clock}.`,
  hotelCheckIn: (name, when) => `Inchecken bij ${name} ${when}.`,
  carPickup: (company, when) => `Auto ophalen bij ${company} ${when}.`,
  activityAt: (name, when) => `${name} ${when}.`,
  departTitle: 'Vertrek nu',
  departBody: (flight, gate, walkMin) => `${flight} · ${gate} · ongeveer ${walkMin} min naar de gate.`,
  gateUnknown: 'gate nog niet bekend',
  delayTitle: min => `${min} min vertraging — dit raakt je boekingen`,
  delayHotel: (name, when) => `Je landt na het inchecken bij ${name} (${when}).`,
  delayCar: (company, when) => `Je ophaalmoment bij ${company} is om ${when}, voordat je landt.`,
  openHotel: 'Hotel op de kaart',
  landedTitle: city => `Welkom in ${city}`,
  landedBelt: belt => `Bagage op band ${belt}.`,
  landedNoBelt: 'Band nog niet bekend.',
  landedTransport: options => `Naar de stad: ${options}.`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}.`,
  activityTitle: 'Over 2 uur',
  activityBody: (name, pickup, clock) => `${name} om ${clock}. Ophalen: ${pickup}.`,
  carReturnTitle: 'Auto morgen terug',
  carReturnBody: (company, place, when) => `${company}${place ? ` bij ${place}` : ''} ${when}.`,
  connectionTitle: 'Krappe overstap',
  connectionBody: (first, second, min) => `${first} is laat — nog ${min} min voor ${second}.`,
  someone: 'Je reisgenoot',
  departedTitle: (name) => `${name} is vertrokken`,
  departedBody: (name, flight, dest, time) => `${flight} onderweg naar ${dest}. Aankomst: ${time}`,
  hotelArrivedTitle: (name) => `${name} is aangekomen`,
  hotelArrivedBody: (name, hotel) => hotel ? `Waarschijnlijk ingecheckt bij ${hotel}` : 'Waarschijnlijk in het hotel',
  landedFollowerTitle: (name, dest) => `${name} is geland in ${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `Lokale tijd: ${time}`,
};


const TH: Copy = {
  eveningTitle: (city, clock) => `${city} พรุ่งนี้ · ${clock}`,
  eveningLeave: clock => `ออกเดินทางประมาณ ${clock}`,
  hotelCheckIn: (name, when) => `เช็คอินที่ ${name} ${when}`,
  carPickup: (company, when) => `รับรถที่ ${company} ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: 'ถึงเวลาออกเดินทาง',
  departBody: (flight, gate, min) => `${flight} · ${gate} · ประมาณ ${min} นาทีถึงเกต`,
  gateUnknown: 'ยังไม่ประกาศเกต',
  delayTitle: min => `ล่าช้า ${min} นาที — กระทบการจอง`,
  delayHotel: (name, when) => `คุณลงจอดหลังเช็คอินที่ ${name} (${when})`,
  delayCar: (company, when) => `รับรถที่ ${company} เวลา ${when} ก่อนลงจอด`,
  openHotel: 'เปิดโรงแรมในแผนที่',
  landedTitle: city => `ยินดีต้อนรับสู่${city}`,
  landedBelt: belt => `สัมภาระที่สายพาน ${belt}`,
  landedNoBelt: 'ยังไม่ประกาศสายพาน',
  landedTransport: options => `เข้าเมือง: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: 'อีก 2 ชั่วโมง',
  activityBody: (name, pickup, clock) => `${name} เวลา ${clock} รับที่: ${pickup}`,
  carReturnTitle: 'คืนรถพรุ่งนี้',
  carReturnBody: (company, place, when) => `${company}${place ? ` ที่ ${place}` : ''} ${when}`,
  connectionTitle: 'ต่อเครื่องแบบเร่งด่วน',
  connectionBody: (first, second, min) => `${first} ล่าช้า — เหลือ ${min} นาทีสำหรับ ${second}`,
  someone: 'เพื่อนร่วมเดินทางของคุณ',
  departedTitle: (name) => `${name} ออกเดินทางแล้ว`,
  departedBody: (name, flight, dest, time) => `${flight} มุ่งหน้าสู่${dest} ถึงเวลา ${time}`,
  hotelArrivedTitle: (name) => `${name} มาถึงแล้ว`,
  hotelArrivedBody: (name, hotel) => hotel ? `น่าจะเช็คอินที่ ${hotel} แล้ว` : 'น่าจะถึงที่พักแล้ว',
  landedFollowerTitle: (name, dest) => `${name} ลงจอดที่${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `เวลาท้องถิ่น: ${time}`,
};

const JA: Copy = {
  eveningTitle: (city, clock) => `明日${city} · ${clock}`,
  eveningLeave: clock => `${clock}頃に出発してください`,
  hotelCheckIn: (name, when) => `${name}にチェックイン ${when}`,
  carPickup: (company, when) => `${company}でレンタカー受取 ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: '出発の時間です',
  departBody: (flight, gate, min) => `${flight} · ${gate} · ゲートまで約${min}分`,
  gateUnknown: 'ゲート未発表',
  delayTitle: min => `${min}分遅延 — 予約に影響があります`,
  delayHotel: (name, when) => `${name}のチェックイン(${when})より後に到着します`,
  delayCar: (company, when) => `${company}の受取時刻${when}より後に到着します`,
  openHotel: '地図でホテルを開く',
  landedTitle: city => `${city}へようこそ`,
  landedBelt: belt => `手荷物はベルト${belt}番`,
  landedNoBelt: 'ベルト番号未発表',
  landedTransport: options => `市内へ: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: '2時間後',
  activityBody: (name, pickup, clock) => `${clock}から${name}。集合場所: ${pickup}`,
  carReturnTitle: '明日車を返却',
  carReturnBody: (company, place, when) => `${company}${place ? ` (${place})` : ''} ${when}`,
  connectionTitle: '乗り継ぎが危険',
  connectionBody: (first, second, min) => `${first}が遅延 — ${second}まであと${min}分`,
  someone: 'ご同行の方',
  departedTitle: (name) => `${name}が出発しました`,
  departedBody: (name, flight, dest, time) => `${flight}は${dest}へ向かっています。到着予定: ${time}`,
  hotelArrivedTitle: (name) => `${name}が到着しました`,
  hotelArrivedBody: (name, hotel) => hotel ? `${hotel}にチェックイン済みの可能性` : 'ホテルに到着した可能性があります',
  landedFollowerTitle: (name, dest) => `${name}が${dest}に着陸しました ✈️`,
  landedFollowerBody: (name, dest, time) => `現地時間：${time}`,
};

const ZH: Copy = {
  eveningTitle: (city, clock) => `明天 ${city} · ${clock}`,
  eveningLeave: clock => `请在 ${clock} 左右出发`,
  hotelCheckIn: (name, when) => `${when} 在 ${name} 办理入住`,
  carPickup: (company, when) => `${when} 在 ${company} 取车`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: '该出发了',
  departBody: (flight, gate, min) => `${flight} · ${gate} · 约 ${min} 分钟到登机口`,
  gateUnknown: '登机口待定',
  delayTitle: min => `延误 ${min} 分钟 — 影响您的预订`,
  delayHotel: (name, when) => `您将在 ${name} 办理入住时间(${when})后才能到达`,
  delayCar: (company, when) => `您的 ${company} 取车时间 ${when} 早于降落时间`,
  openHotel: '在地图中打开酒店',
  landedTitle: city => `欢迎来到${city}`,
  landedBelt: belt => `行李在 ${belt} 号传送带`,
  landedNoBelt: '传送带号码待定',
  landedTransport: options => `前往市区: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: '2小时后',
  activityBody: (name, pickup, clock) => `${clock} ${name}，接送地点: ${pickup}`,
  carReturnTitle: '明天还车',
  carReturnBody: (company, place, when) => `${company}${place ? `（${place}）` : ''} ${when}`,
  connectionTitle: '转机时间紧张',
  connectionBody: (first, second, min) => `${first} 延误 — 距离 ${second} 还有 ${min} 分钟`,
  someone: '您的同行者',
  departedTitle: (name) => `${name}已出发`,
  departedBody: (name, flight, dest, time) => `${flight}正飞往${dest}，预计到达: ${time}`,
  hotelArrivedTitle: (name) => `${name}已抵达`,
  hotelArrivedBody: (name, hotel) => hotel ? `可能已在${hotel}办理入住` : '可能已到达住所',
  landedFollowerTitle: (name, dest) => `${name}已降落在${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `当地时间：${time}`,
};

const KO: Copy = {
  eveningTitle: (city, clock) => `내일 ${city} · ${clock}`,
  eveningLeave: clock => `${clock} 경에 출발하세요`,
  hotelCheckIn: (name, when) => `${name} 체크인 ${when}`,
  carPickup: (company, when) => `${company} 렌터카 픽업 ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: '출발할 시간입니다',
  departBody: (flight, gate, min) => `${flight} · ${gate} · 게이트까지 약 ${min}분`,
  gateUnknown: '게이트 미정',
  delayTitle: min => `${min}분 지연 — 예약에 영향 있음`,
  delayHotel: (name, when) => `${name} 체크인(${when}) 이후 도착 예정`,
  delayCar: (company, when) => `${company} 픽업 시간 ${when}이 착륙 전입니다`,
  openHotel: '지도에서 호텔 열기',
  landedTitle: city => `${city}에 오신 것을 환영합니다`,
  landedBelt: belt => `수하물은 ${belt}번 벨트`,
  landedNoBelt: '벨트 번호 미정',
  landedTransport: options => `시내로: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: '2시간 후',
  activityBody: (name, pickup, clock) => `${clock} ${name}. 픽업: ${pickup}`,
  carReturnTitle: '내일 반납',
  carReturnBody: (company, place, when) => `${company}${place ? ` (${place})` : ''} ${when}`,
  connectionTitle: '환승 시간 촉박',
  connectionBody: (first, second, min) => `${first} 지연 — ${second}까지 ${min}분 남음`,
  someone: '동행자',
  departedTitle: (name) => `${name}이 출발했습니다`,
  departedBody: (name, flight, dest, time) => `${flight} ${dest}로 향하는 중. 도착 예정: ${time}`,
  hotelArrivedTitle: (name) => `${name}이 도착했습니다`,
  hotelArrivedBody: (name, hotel) => hotel ? `${hotel} 체크인 완료 가능성` : '숙소에 도착한 것 같습니다',
  landedFollowerTitle: (name, dest) => `${name}이 ${dest}에 착륙했습니다 ✈️`,
  landedFollowerBody: (name, dest, time) => `현지 시간: ${time}`,
};

const AR: Copy = {
  eveningTitle: (city, clock) => `${city} غداً · ${clock}`,
  eveningLeave: clock => `غادر حوالي ${clock}`,
  hotelCheckIn: (name, when) => `تسجيل الوصول في ${name} ${when}`,
  carPickup: (company, when) => `استلام السيارة من ${company} ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: 'حان وقت المغادرة',
  departBody: (flight, gate, min) => `${flight} · ${gate} · حوالي ${min} دقيقة للبوابة`,
  gateUnknown: 'البوابة لم تُعلن بعد',
  delayTitle: min => `تأخير ${min} دقيقة — يؤثر على حجوزاتك`,
  delayHotel: (name, when) => `ستصل بعد موعد تسجيل الوصول في ${name} (${when})`,
  delayCar: (company, when) => `موعد استلام سيارة ${company} ${when} قبل هبوطك`,
  openHotel: 'فتح الفندق على الخريطة',
  landedTitle: city => `مرحباً بك في ${city}`,
  landedBelt: belt => `الأمتعة على السير رقم ${belt}`,
  landedNoBelt: 'لم يُعلن عن رقم السير بعد',
  landedTransport: options => `إلى المدينة: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: 'بعد ساعتين',
  activityBody: (name, pickup, clock) => `${name} الساعة ${clock}. نقطة الالتقاء: ${pickup}`,
  carReturnTitle: 'إعادة السيارة غداً',
  carReturnBody: (company, place, when) => `${company}${place ? ` في ${place}` : ''} ${when}`,
  connectionTitle: 'رحلة الترانزيت ضيقة',
  connectionBody: (first, second, min) => `${first} متأخرة — ${min} دقيقة لإدراك ${second}`,
  someone: 'رفيق سفرك',
  departedTitle: (name) => `غادر ${name}`,
  departedBody: (name, flight, dest, time) => `رحلة ${flight} في طريقها إلى ${dest}. الوصول: ${time}`,
  hotelArrivedTitle: (name) => `وصل ${name}`,
  hotelArrivedBody: (name, hotel) => hotel ? `ربما سجّل الوصول في ${hotel}` : 'ربما وصل إلى مكان إقامته',
  landedFollowerTitle: (name, dest) => `هبط ${name} في ${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `التوقيت المحلي: ${time}`,
};

const ID: Copy = {
  eveningTitle: (city, clock) => `${city} besok · ${clock}`,
  eveningLeave: clock => `Berangkat sekitar ${clock}`,
  hotelCheckIn: (name, when) => `Check-in di ${name} ${when}`,
  carPickup: (company, when) => `Ambil mobil di ${company} ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: 'Saatnya berangkat',
  departBody: (flight, gate, min) => `${flight} · ${gate} · sekitar ${min} menit ke gate`,
  gateUnknown: 'gate belum diumumkan',
  delayTitle: min => `Terlambat ${min} menit — mempengaruhi pemesanan Anda`,
  delayHotel: (name, when) => `Anda tiba setelah check-in di ${name} (${when})`,
  delayCar: (company, when) => `Pengambilan mobil ${company} pukul ${when} sebelum Anda mendarat`,
  openHotel: 'Buka hotel di peta',
  landedTitle: city => `Selamat datang di ${city}`,
  landedBelt: belt => `Bagasi di belt ${belt}`,
  landedNoBelt: 'Belt belum diumumkan',
  landedTransport: options => `Ke kota: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: '2 jam lagi',
  activityBody: (name, pickup, clock) => `${name} pukul ${clock}. Penjemputan: ${pickup}`,
  carReturnTitle: 'Kembalikan mobil besok',
  carReturnBody: (company, place, when) => `${company}${place ? ` di ${place}` : ''} ${when}`,
  connectionTitle: 'Transit mepet',
  connectionBody: (first, second, min) => `${first} terlambat — ${min} menit tersisa untuk ${second}`,
  someone: 'Teman perjalanan Anda',
  departedTitle: (name) => `${name} telah berangkat`,
  departedBody: (name, flight, dest, time) => `${flight} menuju ${dest}. Tiba sekitar ${time}`,
  hotelArrivedTitle: (name) => `${name} telah tiba`,
  hotelArrivedBody: (name, hotel) => hotel ? `Kemungkinan sudah check-in di ${hotel}` : 'Kemungkinan sudah sampai di penginapan',
  landedFollowerTitle: (name, dest) => `${name} telah mendarat di ${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `Waktu lokal: ${time}`,
};

const DE: Copy = {
  eveningTitle: (city, clock) => `Morgen ${city} · ${clock}`,
  eveningLeave: clock => `Abfahrt gegen ${clock}`,
  hotelCheckIn: (name, when) => `Check-in bei ${name} ${when}`,
  carPickup: (company, when) => `Mietwagen bei ${company} abholen ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: 'Zeit aufzubrechen',
  departBody: (flight, gate, min) => `${flight} · ${gate} · ca. ${min} Min. zum Gate`,
  gateUnknown: 'Gate noch nicht bekannt',
  delayTitle: min => `${min} Min. Verspätung — betrifft deine Buchungen`,
  delayHotel: (name, when) => `Du landest nach dem Check-in bei ${name} (${when})`,
  delayCar: (company, when) => `Deine ${company}-Abholung ist um ${when}, vor der Landung`,
  openHotel: 'Hotel auf der Karte öffnen',
  landedTitle: city => `Willkommen in ${city}`,
  landedBelt: belt => `Gepäck an Band ${belt}`,
  landedNoBelt: 'Band noch nicht bekannt',
  landedTransport: options => `In die Stadt: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: 'In 2 Stunden',
  activityBody: (name, pickup, clock) => `${name} um ${clock}. Abholung: ${pickup}`,
  carReturnTitle: 'Auto morgen zurückgeben',
  carReturnBody: (company, place, when) => `${company}${place ? ` bei ${place}` : ''} ${when}`,
  connectionTitle: 'Knappe Verbindung',
  connectionBody: (first, second, min) => `${first} verspätet — noch ${min} Min. bis ${second}`,
  someone: 'Deine Reisebegleitung',
  departedTitle: (name) => `${name} ist abgehoben`,
  departedBody: (name, flight, dest, time) => `${flight} auf dem Weg nach ${dest}. Ankunft: ${time}`,
  hotelArrivedTitle: (name) => `${name} ist angekommen`,
  hotelArrivedBody: (name, hotel) => hotel ? `Wahrscheinlich eingecheckt in ${hotel}` : 'Wahrscheinlich im Hotel angekommen',
  landedFollowerTitle: (name, dest) => `${name} ist in ${dest} gelandet ✈️`,
  landedFollowerBody: (name, dest, time) => `Ortszeit: ${time}`,
};

const FR: Copy = {
  eveningTitle: (city, clock) => `${city} demain · ${clock}`,
  eveningLeave: clock => `Partez vers ${clock}`,
  hotelCheckIn: (name, when) => `Enregistrement à ${name} ${when}`,
  carPickup: (company, when) => `Récupérer la voiture chez ${company} ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: 'Il est temps de partir',
  departBody: (flight, gate, min) => `${flight} · ${gate} · environ ${min} min jusqu'à la porte`,
  gateUnknown: 'porte non encore annoncée',
  delayTitle: min => `Retard de ${min} min — impact sur vos réservations`,
  delayHotel: (name, when) => `Vous atterrissez après l'enregistrement à ${name} (${when})`,
  delayCar: (company, when) => `Votre prise en charge ${company} est à ${when}, avant l'atterrissage`,
  openHotel: "Ouvrir l'hôtel sur la carte",
  landedTitle: city => `Bienvenue à ${city}`,
  landedBelt: belt => `Bagages au tapis ${belt}`,
  landedNoBelt: 'Tapis non encore annoncé',
  landedTransport: options => `Vers la ville : ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: 'Dans 2 heures',
  activityBody: (name, pickup, clock) => `${name} à ${clock}. Rendez-vous : ${pickup}`,
  carReturnTitle: 'Rendre la voiture demain',
  carReturnBody: (company, place, when) => `${company}${place ? ` à ${place}` : ''} ${when}`,
  connectionTitle: 'Correspondance serrée',
  connectionBody: (first, second, min) => `${first} en retard — ${min} min restantes pour ${second}`,
  someone: 'Votre compagnon de voyage',
  departedTitle: (name) => `${name} a décollé`,
  departedBody: (name, flight, dest, time) => `${flight} en route vers ${dest}. Arrivée : ${time}`,
  hotelArrivedTitle: (name) => `${name} est arrivé(e)`,
  hotelArrivedBody: (name, hotel) => hotel ? `Probablement enregistré(e) à ${hotel}` : "Probablement arrivé(e) à l'hôtel",
  landedFollowerTitle: (name, dest) => `${name} a atterri à ${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `Heure locale : ${time}`,
};

const ES: Copy = {
  eveningTitle: (city, clock) => `${city} mañana · ${clock}`,
  eveningLeave: clock => `Salir hacia las ${clock}`,
  hotelCheckIn: (name, when) => `Check-in en ${name} ${when}`,
  carPickup: (company, when) => `Recoger coche en ${company} ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: 'Es hora de salir',
  departBody: (flight, gate, min) => `${flight} · ${gate} · unos ${min} min hasta la puerta`,
  gateUnknown: 'puerta por anunciar',
  delayTitle: min => `Retraso de ${min} min — afecta tus reservas`,
  delayHotel: (name, when) => `Llegas después del check-in en ${name} (${when})`,
  delayCar: (company, when) => `Tu recogida de ${company} es a las ${when}, antes de aterrizar`,
  openHotel: 'Abrir hotel en el mapa',
  landedTitle: city => `Bienvenido a ${city}`,
  landedBelt: belt => `Equipaje en cinta ${belt}`,
  landedNoBelt: 'Cinta no anunciada aún',
  landedTransport: options => `Al centro: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: 'En 2 horas',
  activityBody: (name, pickup, clock) => `${name} a las ${clock}. Recogida: ${pickup}`,
  carReturnTitle: 'Devolver coche mañana',
  carReturnBody: (company, place, when) => `${company}${place ? ` en ${place}` : ''} ${when}`,
  connectionTitle: 'Conexión ajustada',
  connectionBody: (first, second, min) => `${first} con retraso — ${min} min para ${second}`,
  someone: 'Tu compañero de viaje',
  departedTitle: (name) => `${name} ha despegado`,
  departedBody: (name, flight, dest, time) => `${flight} rumbo a ${dest}. Llegada: ${time}`,
  hotelArrivedTitle: (name) => `${name} ha llegado`,
  hotelArrivedBody: (name, hotel) => hotel ? `Probablemente en ${hotel}` : 'Probablemente en el hotel',
  landedFollowerTitle: (name, dest) => `${name} ha aterrizado en ${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `Hora local: ${time}`,
};

const PT: Copy = {
  eveningTitle: (city, clock) => `${city} amanhã · ${clock}`,
  eveningLeave: clock => `Saia por volta das ${clock}`,
  hotelCheckIn: (name, when) => `Check-in no ${name} ${when}`,
  carPickup: (company, when) => `Levantar carro na ${company} ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: 'Hora de sair',
  departBody: (flight, gate, min) => `${flight} · ${gate} · cerca de ${min} min até à porta`,
  gateUnknown: 'porta ainda não anunciada',
  delayTitle: min => `Atraso de ${min} min — afeta as suas reservas`,
  delayHotel: (name, when) => `Chega depois do check-in no ${name} (${when})`,
  delayCar: (company, when) => `O levantamento na ${company} é às ${when}, antes de aterrar`,
  openHotel: 'Abrir hotel no mapa',
  landedTitle: city => `Bem-vindo a ${city}`,
  landedBelt: belt => `Bagagem na correia ${belt}`,
  landedNoBelt: 'Correia ainda não anunciada',
  landedTransport: options => `Para a cidade: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: 'Daqui a 2 horas',
  activityBody: (name, pickup, clock) => `${name} às ${clock}. Ponto de encontro: ${pickup}`,
  carReturnTitle: 'Devolver carro amanhã',
  carReturnBody: (company, place, when) => `${company}${place ? ` em ${place}` : ''} ${when}`,
  connectionTitle: 'Ligação apertada',
  connectionBody: (first, second, min) => `${first} atrasado — ${min} min para apanhar ${second}`,
  someone: 'O seu companheiro de viagem',
  departedTitle: (name) => `${name} decolou`,
  departedBody: (name, flight, dest, time) => `${flight} a caminho de ${dest}. Chegada: ${time}`,
  hotelArrivedTitle: (name) => `${name} chegou`,
  hotelArrivedBody: (name, hotel) => hotel ? `Provavelmente fez check-in no ${hotel}` : 'Provavelmente no hotel',
  landedFollowerTitle: (name, dest) => `${name} pousou em ${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `Hora local: ${time}`,
};

const IT: Copy = {
  eveningTitle: (city, clock) => `${city} domani · ${clock}`,
  eveningLeave: clock => `Parti verso le ${clock}`,
  hotelCheckIn: (name, when) => `Check-in all'${name} ${when}`,
  carPickup: (company, when) => `Ritiro auto da ${company} ${when}`,
  activityAt: (name, when) => `${name} ${when}`,
  departTitle: 'È ora di partire',
  departBody: (flight, gate, min) => `${flight} · ${gate} · circa ${min} min al gate`,
  gateUnknown: 'gate non ancora annunciato',
  delayTitle: min => `Ritardo di ${min} min — impatta le tue prenotazioni`,
  delayHotel: (name, when) => `Atterri dopo il check-in all'${name} (${when})`,
  delayCar: (company, when) => `Il ritiro da ${company} è alle ${when}, prima dell'atterraggio`,
  openHotel: "Apri l'hotel sulla mappa",
  landedTitle: city => `Benvenuto a ${city}`,
  landedBelt: belt => `Bagagli al nastro ${belt}`,
  landedNoBelt: 'Nastro non ancora annunciato',
  landedTransport: options => `In città: ${options}`,
  landedHotel: (name, address) => `${name}${address ? ` — ${address}` : ''}`,
  activityTitle: 'Tra 2 ore',
  activityBody: (name, pickup, clock) => `${name} alle ${clock}. Punto di incontro: ${pickup}`,
  carReturnTitle: 'Restituire auto domani',
  carReturnBody: (company, place, when) => `${company}${place ? ` da ${place}` : ''} ${when}`,
  connectionTitle: 'Coincidenza stretta',
  connectionBody: (first, second, min) => `${first} in ritardo — ${min} min rimasti per ${second}`,
  someone: 'Il tuo compagno di viaggio',
  departedTitle: (name) => `${name} è decollato/a`,
  departedBody: (name, flight, dest, time) => `${flight} diretto a ${dest}. Arrivo: ${time}`,
  hotelArrivedTitle: (name) => `${name} è arrivato/a`,
  hotelArrivedBody: (name, hotel) => hotel ? `Probabilmente all'hotel ${hotel}` : 'Probabilmente in hotel',
  landedFollowerTitle: (name, dest) => `${name} è atterrato/a a ${dest} ✈️`,
  landedFollowerBody: (name, dest, time) => `Ora locale: ${time}`,
};

function copyFor(locale: string): Copy {
  const l = String(locale || '').toLowerCase();
  if (l.startsWith('nl')) return NL;
  if (l.startsWith('th')) return TH;
  if (l.startsWith('ja')) return JA;
  if (l.startsWith('zh')) return ZH;
  if (l.startsWith('ko')) return KO;
  if (l.startsWith('ar')) return AR;
  if (l.startsWith('id') || l.startsWith('ms')) return ID;
  if (l.startsWith('de')) return DE;
  if (l.startsWith('fr')) return FR;
  if (l.startsWith('es')) return ES;
  if (l.startsWith('pt')) return PT;
  if (l.startsWith('it')) return IT;
  return EN;
}

function ms(iso?: string | null): number | null {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : null;
}

function clock(at: number | null, locale: string): string {
  if (at == null) return '';
  try {
    return new Date(at).toLocaleTimeString(locale || 'en', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC',
    });
  } catch {
    return new Date(at).toISOString().slice(11, 16);
  }
}

function dayAndClock(at: number | null, locale: string): string {
  if (at == null) return '';
  try {
    const day = new Date(at).toLocaleDateString(locale || 'en', {
      day: 'numeric', month: 'short', timeZone: 'UTC',
    });
    return `${day} ${clock(at, locale)}`;
  } catch {
    return new Date(at).toISOString().slice(0, 16).replace('T', ' ');
  }
}

/** True when the ISO carries a time of day, not just a calendar date. */
function hasTime(iso?: string): boolean {
  return /\d{2}:\d{2}/.test(String(iso || ''));
}

/**
 * How far a real delay can move an arrival before the "actual" time must belong to another day's flight.
 * A number like TG208 flies daily, so a rotation mismatch is at least 24 hours out; a delay almost never is.
 */
const ROTATION_SANITY_MS = 12 * 60 * 60 * 1000;

type LegTimes = {
  depMs: number | null;
  /** Scheduled arrival — what the bookings were made against. */
  schedArrMs: number | null;
  /** Arrival as it now looks: revised or actual when live data says so. */
  liveArrMs: number | null;
  actualArrMs: number | null;
  /** Actual departure, once it is believable — the 'departed' moment reads this. */
  actualDepMs: number | null;
  delayMin: number;
};

function legTimes<T extends TripFlight>(f: T): LegTimes {
  const live = f.flight || {};
  const depMs = ms(resolveDepartureIso(live) || f.scheduledTime);
  const schedArrMs = ms(live.scheduledArrival || live.arrivalTime) ?? ms(resolveArrivalIso(live));
  const status = String(live.status || f.lastStatus || '').toLowerCase();

  /*
   * A number like TG208 flies every day, and a live lookup can answer with another day's rotation: the
   * record then carries a landing that already happened, days from this trip. Believing it sent "welcome to
   * Bangkok" four days before the flight, and the followers "has landed in Bangkok" with it. A time that
   * sits more than half a day from the schedule is therefore another flight, not a delay.
   */
  const near = (at: number | null, anchor: number | null): number | null => (
    at != null && (anchor == null || Math.abs(at - anchor) <= ROTATION_SANITY_MS) ? at : null
  );
  // The tracked departure is the anchor of this trip, so live times from a different day are dropped whole.
  const trackedDepMs = ms(f.scheduledTime);
  const sameRotation = trackedDepMs == null || depMs == null || Math.abs(depMs - trackedDepMs) <= ROTATION_SANITY_MS;

  const actualArrMs = sameRotation
    ? near(ms(live.actualArrival) ?? (status === 'landed' ? ms(live.actualTime) : null), schedArrMs)
    : null;
  const actualDepMs = sameRotation
    ? near(ms(live.actualDeparture) ?? (status === 'en-route' ? ms(live.actualTime) : null), depMs)
    : null;
  const revisedArrMs = sameRotation
    ? near(ms(live.estimatedArrival) ?? ms(live.revisedTime), schedArrMs)
    : null;
  const liveArrMs = actualArrMs ?? revisedArrMs ?? schedArrMs;
  const fromField = Number(f.lastDelay);
  const computed = liveArrMs != null && schedArrMs != null
    ? Math.round((liveArrMs - schedArrMs) / MIN_MS)
    : 0;
  const delayMin = Number.isFinite(fromField) && fromField > 0 ? Math.round(fromField) : Math.max(0, computed);
  return { depMs, schedArrMs, liveArrMs, actualArrMs, actualDepMs, delayMin };
}

function cityOf<T extends TripFlight>(f: T, fallback: string): string {
  return String(f.flight?.destCity || '').trim() || String(f.flight?.destination || '').trim() || fallback;
}

function numberOf<T extends TripFlight>(f: T): string {
  return String(f.flightNumber || '').trim() || String(f.key || '').trim();
}

function mapsUrl(place?: string): string | undefined {
  const q = String(place || '').trim();
  if (!q) return undefined;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/**
 * The given hour, the day before, on the clock where the car is handed back — not on UTC. In Bangkok the old
 * UTC reading turned "18:00 the evening before" into 01:00 in the night.
 */
function dayBeforeAt(at: number, hour: number, tz: string): number {
  const ymd = formatInTimeZone(new Date(at), tz, 'yyyy-MM-dd');
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return at - DAY_MS;
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return wallClockInZoneToUtcMs(
    prev.getUTCFullYear(),
    prev.getUTCMonth() + 1,
    prev.getUTCDate(),
    hour,
    0,
    0,
    tz,
  ) ?? at - DAY_MS;
}

/**
 * Everything worth saying about this trip, with the time to say it. Ordered by trigger, earliest first.
 * The caller decides what to do with moments whose trigger has already passed.
 */
export function computeMoments<T extends TripFlight>(
  group: TripGroup<T>,
  now: number,
  opts: MomentOpts,
): TripMoment[] {
  const legs = group?.flights || [];
  if (!legs.length) return [];
  const c = copyFor(opts?.locale);
  const locale = opts?.locale || 'en';
  const who = String(opts?.travelerName || '').trim() || c.someone;
  const extras = group.extras || {};
  const out: TripMoment[] = [];
  const times = legs.map(legTimes);
  const first = legs[0];
  const firstT = times[0];

  // ── Evening before ─────────────────────────────────────────────────────────
  // Only with a hotel: without one there is nothing to tell you the night before that you do not know.
  if (extras.hotel && firstT.depMs != null) {
    const fire = eveningPushFireUtcMs(firstT.depMs, first.flight?.origin, first.flight?.originCountry);
    if (fire != null) {
      const leave = leaveAtUtcMs(firstT.depMs, {
        international: (first.flight?.originCountry || '') !== (first.flight?.destCountry || ''),
        travelMin: opts?.travelMin ?? null,
      });
      const lines = [c.eveningLeave(clock(leave.leaveAt, locale))];
      if (extras.hotel.name || extras.hotel.checkIn) {
        lines.push(c.hotelCheckIn(
          extras.hotel.name || '',
          extras.hotel.checkIn ? dayAndClock(ms(extras.hotel.checkIn), locale) : '',
        ));
      }
      if (extras.carRental?.pickupTime) {
        lines.push(c.carPickup(extras.carRental.company || '', dayAndClock(ms(extras.carRental.pickupTime), locale)));
      }
      if (extras.excursion?.dateTime) {
        lines.push(c.activityAt(extras.excursion.name || '', dayAndClock(ms(extras.excursion.dateTime), locale)));
      }
      out.push({
        key: `${group.key}:evening_before`,
        triggerMs: fire,
        kind: 'evening_before',
      audience: MOMENT_AUDIENCE.evening_before,
        title: c.eveningTitle(cityOf(first, group.name), clock(firstT.depMs, locale)),
        body: lines.filter(Boolean).join(' '),
        flightKey: first.key,
        urgent: false,
      });
    }
  }

  // ── Depart now ─────────────────────────────────────────────────────────────
  // Only for a leg you actually travel to the airport for: the first one, and any later leg that starts more
  // than a day after the previous one landed. A connection is not something you leave home for.
  legs.forEach((f, i) => {
    const t = times[i];
    if (t.depMs == null) return;
    if (i > 0) {
      const prevArr = times[i - 1].liveArrMs ?? times[i - 1].depMs;
      if (prevArr == null || t.depMs - prevArr < DAY_MS) return;
    }
    const leave = leaveAtUtcMs(t.depMs, {
      international: (f.flight?.originCountry || '') !== (f.flight?.destCountry || ''),
      travelMin: opts?.travelMin ?? null,
    });
    const gate = String(f.lastGate || '').trim();
    const walk = gateWalkMinutes(f.flight?.origin, undefined, gate || undefined);
    out.push({
      key: `${group.key}:depart_now:${f.key}`,
      triggerMs: leave.leaveAt,
      kind: 'depart_now',
      audience: MOMENT_AUDIENCE.depart_now,
      title: c.departTitle,
      body: c.departBody(numberOf(f), gate || c.gateUnknown, walk.minutes),
      flightKey: f.key,
      urgent: false,
    });
  });

  // ── Delay impact ───────────────────────────────────────────────────────────
  // A delay on its own is not a moment. Only when landing later actually breaks something you booked.
  legs.forEach((f, i) => {
    const t = times[i];
    if (!t.delayMin || t.liveArrMs == null) return;
    const clashes: string[] = [];
    let action: { label: string; url?: string } | null = null;

    const checkIn = extras.hotel?.checkIn;
    if (checkIn) {
      const checkInMs = ms(checkIn);
      // A bare date has no time, so it can only clash when you now land on a later day altogether.
      const clash = checkInMs != null && (
        hasTime(checkIn)
          ? t.liveArrMs > checkInMs
          : t.liveArrMs > checkInMs + DAY_MS
      );
      if (clash) {
        clashes.push(c.delayHotel(extras.hotel?.name || '', dayAndClock(checkInMs, locale)));
        const place = extras.hotel?.address || extras.hotel?.name;
        // There is no hotel e-mail address anywhere in the data model, so the action is the map.
        if (place) action = { label: c.openHotel, url: mapsUrl(place) };
      }
    }
    const pickup = ms(extras.carRental?.pickupTime);
    if (pickup != null && t.liveArrMs > pickup) {
      clashes.push(c.delayCar(extras.carRental?.company || '', dayAndClock(pickup, locale)));
    }
    if (!clashes.length) return;
    out.push({
      key: `${group.key}:delay_impact:${f.key}`,
      triggerMs: now,
      kind: 'delay_impact',
      audience: MOMENT_AUDIENCE.delay_impact,
      title: c.delayTitle(t.delayMin),
      body: clashes.join(' '),
      followerTitle: `${who} · ${c.delayTitle(t.delayMin)}`,
      followerBody: clashes.join(' '),
      actionLabel: action?.label,
      actionUrl: action?.url,
      flightKey: f.key,
      urgent: false,
    });
  });

  // ── Landed ─────────────────────────────────────────────────────────────────
  legs.forEach((f, i) => {
    const at = times[i].actualArrMs;
    if (at == null) return;
    const iataCode = String(f.flight?.destination || '').trim();
    const belt = String(f.lastBaggage || '').trim();
    const rides = rideHailingFor(iataCode);
    const transit = publicTransportFor(iataCode).map(x => x.name);
    const options = [...transit, ...rides].slice(0, 3).join(', ');
    const lines = [
      belt ? c.landedBelt(belt) : c.landedNoBelt,
      options ? c.landedTransport(options) : '',
    ];
    if (extras.hotel?.name || extras.hotel?.address) {
      lines.push(c.landedHotel(extras.hotel?.name || '', extras.hotel?.address || ''));
      if (extras.hotel?.checkIn) lines.push(c.hotelCheckIn(extras.hotel.name || '', dayAndClock(ms(extras.hotel.checkIn), locale)));
    }
    out.push({
      key: `${group.key}:landed:${f.key}`,
      triggerMs: at + baggageWalkMinutes(iataCode) * MIN_MS,
      kind: 'landed',
      audience: MOMENT_AUDIENCE.landed,
      title: c.landedTitle(cityOf(f, group.name)),
      body: lines.filter(Boolean).join(' '),
      // The people at home want to know they are down and what the clock says there — not the baggage belt.
      followerTitle: c.landedFollowerTitle(who, cityOf(f, group.name)),
      followerBody: c.landedFollowerBody(who, cityOf(f, group.name), clock(at, locale)),
      actionLabel: extras.hotel?.address ? c.openHotel : undefined,
      actionUrl: mapsUrl(extras.hotel?.address),
      flightKey: f.key,
      urgent: false,
    });
  });

  // ── Activity reminder ──────────────────────────────────────────────────────
  // Without a pickup location there is nothing actionable to say two hours ahead.
  const activityAt = ms(extras.excursion?.dateTime);
  if (activityAt != null && extras.excursion?.pickupLocation) {
    out.push({
      key: `${group.key}:activity_reminder`,
      triggerMs: activityAt - ACTIVITY_LEAD_MIN * MIN_MS,
      kind: 'activity_reminder',
      audience: MOMENT_AUDIENCE.activity_reminder,
      title: c.activityTitle,
      body: c.activityBody(
        extras.excursion.name || extras.excursion.operator || '',
        extras.excursion.pickupLocation,
        clock(activityAt, locale),
      ),
      actionLabel: c.openHotel,
      actionUrl: mapsUrl(extras.excursion.pickupLocation),
      flightKey: first.key,
      urgent: false,
    });
  }

  // ── Car return ─────────────────────────────────────────────────────────────
  const dropAt = ms(extras.carRental?.dropoffTime);
  if (dropAt != null) {
    const place = extras.carRental?.dropoffLocation || extras.carRental?.pickupLocation || '';
    out.push({
      key: `${group.key}:car_return`,
      // The car goes back where the trip ends, so that airport's clock decides when the evening before is.
      triggerMs: dayBeforeAt(dropAt, CAR_RETURN_HOUR, timezoneForIata(
        legs[legs.length - 1].flight?.destination,
        legs[legs.length - 1].flight?.destCountry,
      )),
      kind: 'car_return',
      audience: MOMENT_AUDIENCE.car_return,
      title: c.carReturnTitle,
      // Drive time from the hotel is not here: that needs geocoding and a routing call, neither of which
      // belongs in a pure function. The place and the time are what the data actually holds.
      body: c.carReturnBody(extras.carRental?.company || '', place, dayAndClock(dropAt, locale)),
      actionLabel: place ? c.openHotel : undefined,
      actionUrl: mapsUrl(place),
      flightKey: legs[legs.length - 1].key,
      urgent: false,
    });
  }

  // ── Departed (followers) ───────────────────────────────────────────────────
  // Wheels-off when the live data knows it, otherwise the scheduled departure plus the quarter of an hour
  // it takes to push back and get in the air. Only the first leg: the people at home are waiting for "gone".
  {
    const off = firstT.actualDepMs;
    const at = off ?? (firstT.depMs != null ? firstT.depMs + 15 * MIN_MS : null);
    // The people at home want to know when to expect them, so the copy quotes the arrival clock.
    const arrivalClock = clock(firstT.liveArrMs ?? firstT.schedArrMs, locale);
    if (at != null) {
      out.push({
        key: `${group.key}:departed:${first.key}`,
        triggerMs: at,
        kind: 'departed',
        audience: MOMENT_AUDIENCE.departed,
        title: c.departedTitle(who, numberOf(first), cityOf(first, group.name)),
        body: c.departedBody(who, numberOf(first), cityOf(first, group.name), arrivalClock),
        followerTitle: c.departedTitle(who, numberOf(first), cityOf(first, group.name)),
        followerBody: c.departedBody(who, numberOf(first), cityOf(first, group.name), arrivalClock),
        flightKey: first.key,
        urgent: false,
      });
    }
  }

  // ── Hotel arrived (followers) ──────────────────────────────────────────────
  // An inference, not a fact: landed plus an hour and a half is long enough for bags, customs and the ride.
  // The copy says "likely" in every language because that is all this is.
  {
    const lastLanded = times.map(t => t.actualArrMs).filter((x): x is number => x != null).pop();
    if (lastLanded != null) {
      const leg = legs[times.findIndex(t => t.actualArrMs === lastLanded)] || legs[legs.length - 1];
      out.push({
        key: `${group.key}:hotel_arrived`,
        triggerMs: lastLanded + 90 * MIN_MS,
        kind: 'hotel_arrived',
        audience: MOMENT_AUDIENCE.hotel_arrived,
        title: c.hotelArrivedTitle(who),
        body: c.hotelArrivedBody(who, extras.hotel?.name),
        followerTitle: c.hotelArrivedTitle(who),
        followerBody: c.hotelArrivedBody(who, extras.hotel?.name),
        flightKey: leg.key,
        urgent: false,
      });
    }
  }

  // ── Connection risk ────────────────────────────────────────────────────────
  for (let i = 0; i < legs.length - 1; i++) {
    const arr = times[i].liveArrMs;
    const dep = times[i + 1].depMs;
    if (arr == null || dep == null) continue;
    // Only a real connection: legs a day or more apart are two journeys, not an overstap.
    if (dep - arr > DAY_MS) continue;
    const left = Math.round((dep - arr) / MIN_MS);
    if (left >= CONNECTION_RISK_MIN) continue;
    out.push({
      key: `${group.key}:connection_risk:${legs[i].key}`,
      triggerMs: now,
      kind: 'connection_risk',
      audience: MOMENT_AUDIENCE.connection_risk,
      title: c.connectionTitle,
      body: c.connectionBody(numberOf(legs[i]), numberOf(legs[i + 1]), Math.max(0, left)),
      followerTitle: `${who} · ${c.connectionTitle}`,
      followerBody: c.connectionBody(numberOf(legs[i]), numberOf(legs[i + 1]), Math.max(0, left)),
      flightKey: legs[i + 1].key,
      urgent: true,
    });
  }

  return out.sort((a, b) => a.triggerMs - b.triggerMs);
}

/** Notification priority per kind, used by lib/schedulePassengerPushes.ts. */
export type MomentPriority = 'max' | 'high' | 'normal';

export function momentPriority(kind: MomentKind): MomentPriority {
  if (kind === 'connection_risk') return 'max';
  if (kind === 'delay_impact' || kind === 'depart_now') return 'high';
  return 'normal';
}

/** Moments that still lie ahead, which are the only ones worth scheduling. */
export function upcomingMoments(moments: TripMoment[], now: number): TripMoment[] {
  return (moments || []).filter(m => m.triggerMs > now);
}
