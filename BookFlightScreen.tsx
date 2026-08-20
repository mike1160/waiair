import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Airplane,
  AirplaneLanding,
  AirplaneTakeoff,
  ArrowsDownUp,
  Buildings,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  Minus,
  Plus,
  X,
} from 'phosphor-react-native';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  isWithinInterval,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { nl as nlLocale } from 'date-fns/locale/nl';
import { getLocale, t } from './lib/i18n';
import { haptics } from './lib/haptics';
import { startLoopWhileActive } from './lib/appActivity';
import { airportRecByIata, searchAirportsLocal, type AirportRec } from './lib/airportsDb';
import {
  airlineLogoUrl,
  aviasalesCurrency,
  fetchLatestFares,
  fareSearchCode,
  formatFare,
  placeSubtitle,
  placeTitle,
  searchAirportPlaces,
  openAviasalesBooking,
  type AirportPlace,
  type LatestFare,
} from './lib/aviasales';
import { kiwiFlightsUrl, openAffiliateUrl } from './lib/affiliateConfig';
import {
  BookingPassCard,
  GOLD,
  NAVY,
  Walker,
  YOU_EASE,
} from './AnimatedBookingCard';

const POPULAR_IATAS = ['AMS', 'LHR', 'BKK', 'DXB', 'SIN', 'CDG', 'NRT', 'HKG', 'JFK', 'BCN'];

function dateFnsLocale() {
  return getLocale() === 'nl' ? nlLocale : enUS;
}

function tomorrow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(12, 0, 0, 0);
  return d;
}

function weekFromTomorrow(): Date {
  return addDays(tomorrow(), 7);
}

function atNoon(d: Date): Date {
  const n = new Date(d);
  n.setHours(12, 0, 0, 0);
  return n;
}

function isoDay(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function parseIsoDay(raw?: string): Date | null {
  const m = String(raw || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function niceDay(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(`${d}T12:00:00`) : d;
  if (Number.isNaN(date.getTime())) return String(d);
  return format(date, 'EEE d MMM', { locale: dateFnsLocale() });
}

function nextSaturday(from = new Date()): Date {
  const d = atNoon(from);
  return addDays(d, (6 - d.getDay() + 7) % 7);
}

function recToPlace(rec: AirportRec): AirportPlace {
  return {
    code: rec.iata,
    name: rec.name,
    city: rec.city,
    country: rec.countryName,
    kind: 'airport',
  };
}

function placeFromIata(iata: string): AirportPlace {
  const code = iata.toUpperCase().slice(0, 3);
  const rec = airportRecByIata(code);
  if (rec) return recToPlace(rec);
  return { code, name: code, city: code, country: '', kind: 'airport' };
}

function cityLabel(code: string): string {
  return airportRecByIata(code)?.city || code;
}

function mergePlaces(primary: AirportPlace[], extra: AirportPlace[]): AirportPlace[] {
  const seen = new Set<string>();
  const out: AirportPlace[] = [];
  for (const p of [...primary, ...extra]) {
    const id = `${p.kind}:${p.code}`;
    if (!p.code || p.code.length !== 3 || seen.has(id)) continue;
    seen.add(id);
    out.push(p);
    if (out.length >= 8) break;
  }
  return out;
}

function resolveCode(
  place: AirportPlace | null,
  draft: string,
  hits: AirportPlace[],
): string | null {
  const typed = draft.trim();
  if (/^[A-Za-z]{3}$/.test(typed)) return typed.toUpperCase();
  if (place) {
    const title = placeTitle(place).toLowerCase();
    if (!typed || typed.toLowerCase() === title || typed.toUpperCase() === place.code) {
      return place.code;
    }
  }
  if (hits[0]) return hits[0].code;
  return place?.code || null;
}

function SadWalker() {
  const walkX = useRef(new Animated.Value(-90)).current;
  const stride = useRef(new Animated.Value(0)).current;
  const bob = useRef(new Animated.Value(0)).current;
  const tilt = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loopWalk = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(stride, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(stride, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(bob, { toValue: -4, duration: 260, useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 260, useNativeDriver: true }),
        ]),
      ]),
    );
    loopWalk.start();
    const seq = Animated.sequence([
      Animated.timing(walkX, { toValue: 48, duration: 1600, useNativeDriver: true }),
      Animated.timing(tilt, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.delay(700),
      Animated.timing(tilt, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(walkX, { toValue: 340, duration: 1600, useNativeDriver: true }),
    ]);
    seq.start(() => loopWalk.stop());
    return () => {
      loopWalk.stop();
      seq.stop();
    };
  }, [walkX, stride, bob, tilt]);

  const rotate = tilt.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-14deg'] });

  return (
    <View style={st.sadStage} pointerEvents="none">
      <Animated.View style={{ transform: [{ translateX: walkX }, { rotate }] }}>
        <Walker stride={stride} bob={bob} />
      </Animated.View>
    </View>
  );
}

function ResultSkeleton() {
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    return startLoopWhileActive(() =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 0.85, duration: 700, useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.4, duration: 700, useNativeDriver: true }),
        ]),
      ),
    );
  }, [v]);
  return (
    <Animated.View style={[st.card, { opacity: v }]}>
      <View style={st.skelLogo} />
      <View style={{ flex: 1, gap: 8 }}>
        <View style={st.skelLg} />
        <View style={st.skelSm} />
      </View>
      <View style={st.skelPrice} />
    </Animated.View>
  );
}

function stopLabel(transfers: number, copy: ReturnType<typeof t>): string {
  if (transfers <= 0) return copy.directFlight;
  if (transfers === 1) return copy.oneStop;
  return copy.nStops(transfers);
}

function FareCard({
  fare,
  currency,
  pulse,
  onBook,
}: {
  fare: LatestFare;
  currency: { symbol: string };
  pulse: Animated.Value;
  onBook: (fare: LatestFare) => void;
}) {
  const copy = t();
  const direct = fare.transfers === 0;
  const fromCity = cityLabel(fare.origin);
  const toCity = cityLabel(fare.destination);
  return (
    <View style={st.card}>
      <View style={st.cardAccent} />
      {fare.airline ? (
        <Image
          source={{ uri: airlineLogoUrl(fare.airline) }}
          style={st.logo}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={st.logo} />
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={st.route} numberOfLines={1}>
          {fromCity} → {toCity}
        </Text>
        <Text style={st.iataLine}>
          {fare.origin} → {fare.destination}
        </Text>
        <Text style={st.meta}>
          {fare.returnDate
            ? `${niceDay(fare.departDate)} – ${niceDay(fare.returnDate)}`
            : niceDay(fare.departDate)}
        </Text>
        <View style={[st.badge, direct ? st.badgeDirect : st.badgeStop]}>
          <Text style={[st.badgeTxt, direct ? st.badgeDirectTxt : st.badgeStopTxt]}>
            {stopLabel(fare.transfers, copy)}
          </Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 8 }}>
        <Animated.Text style={[st.price, { transform: [{ scale: pulse }] }]}>
          {formatFare(fare.price, currency.symbol)}
        </Animated.Text>
        <TouchableOpacity
          onPress={() => onBook(fare)}
          activeOpacity={0.85}
          style={st.bookBtn}
          accessibilityRole="button"
          accessibilityLabel={copy.bookFare}
        >
          <Text style={st.bookTxt}>{copy.bookFare}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function PlaceHits({
  hits,
  popular,
  showPopular,
  onPick,
}: {
  hits: AirportPlace[];
  popular: AirportPlace[];
  showPopular: boolean;
  onPick: (place: AirportPlace) => void;
}) {
  const copy = t();
  const rows = hits.length > 0 ? hits : showPopular ? popular : [];
  if (!rows.length) return null;
  const popularMode = hits.length === 0 && showPopular;
  return (
    <View style={st.drop}>
      {popularMode ? (
        <Text style={st.dropHead}>{copy.popularDestinations}</Text>
      ) : null}
      {rows.map(hit => (
        <Pressable
          key={`${hit.kind}-${hit.code}-${hit.name}`}
          onPress={() => onPick(hit)}
          style={st.dropRow}
          accessibilityRole="button"
          accessibilityLabel={`${placeTitle(hit)} ${hit.code}`}
        >
          <View style={st.dropIcon}>
            {hit.kind === 'city' ? (
              <Buildings size={16} color={GOLD} />
            ) : (
              <Airplane size={16} color={GOLD} />
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={st.dropName} numberOfLines={1}>{placeTitle(hit)}</Text>
            <Text style={st.dropSub} numberOfLines={1}>{placeSubtitle(hit)}</Text>
          </View>
          <View style={st.kindPill}>
            <Text style={st.kindTxt}>
              {hit.kind === 'city' ? copy.placeCity : copy.placeAirport}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function weekdayLabels(): string[] {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end: addDays(start, 6) }).map(d =>
    format(d, 'EEEEEE', { locale: dateFnsLocale() }),
  );
}

function monthDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

type TripType = 'oneway' | 'return' | 'multi';
type CalPick = 'depart' | 'return';

type MultiLeg = {
  from: AirportPlace | null;
  to: AirportPlace | null;
  fromDraft: string;
  toDraft: string;
  date: Date;
};

function MonthGrid({
  month,
  selected,
  rangeStart,
  rangeEnd,
  minDate,
  onSelect,
}: {
  month: Date;
  selected?: Date | null;
  rangeStart?: Date | null;
  rangeEnd?: Date | null;
  minDate: Date;
  onSelect: (d: Date) => void;
}) {
  const days = monthDays(month);
  const min = startOfDay(minDate);
  const start = rangeStart ? startOfDay(rangeStart) : null;
  const end = rangeEnd ? startOfDay(rangeEnd) : null;
  return (
    <View style={st.month}>
      <Text style={st.monthTitle}>
        {format(month, 'MMMM yyyy', { locale: dateFnsLocale() })}
      </Text>
      <View style={st.weekRow}>
        {weekdayLabels().map((d, i) => (
          <Text key={`${d}-${i}`} style={st.weekLbl}>{d}</Text>
        ))}
      </View>
      <View style={st.grid}>
        {days.map(day => {
          const inMonth = isSameMonth(day, month);
          const past = isBefore(startOfDay(day), min);
          const isStart = !!start && isSameDay(day, start);
          const isEnd = !!end && isSameDay(day, end);
          const inRange = !!(start && end && isWithinInterval(startOfDay(day), { start, end }));
          const selectedDay = isStart || isEnd || (!start && !!selected && isSameDay(day, selected));
          const todayMark = isToday(day);
          return (
            <Pressable
              key={isoDay(day)}
              disabled={past}
              onPress={() => onSelect(atNoon(day))}
              style={st.dayCell}
              accessibilityRole="button"
              accessibilityState={{ selected: selectedDay, disabled: past }}
              accessibilityLabel={format(day, 'PPP', { locale: dateFnsLocale() })}
            >
              <View
                style={[
                  st.dayRange,
                  inRange && st.dayRangeOn,
                  isStart && st.dayRangeStart,
                  isEnd && st.dayRangeEnd,
                ]}
              >
                <View
                  style={[
                    st.dayInner,
                    selectedDay && st.daySelected,
                    !selectedDay && todayMark && st.dayToday,
                  ]}
                >
                  <Text
                    style={[
                      st.dayTxt,
                      !inMonth && st.dayMuted,
                      past && st.dayPast,
                      selectedDay && st.daySelectedTxt,
                    ]}
                  >
                    {format(day, 'd')}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function BookFlightScreen({
  visible,
  onClose,
  origin: originProp,
}: {
  visible: boolean;
  onClose: () => void;
  origin?: string;
}) {
  const copy = t();
  const currency = aviasalesCurrency();
  const originDefault = String(originProp || 'BKK').toUpperCase().slice(0, 3);
  const today = startOfDay(new Date());

  const [fromPlace, setFromPlace] = useState<AirportPlace | null>(() => placeFromIata(originDefault));
  const [toPlace, setToPlace] = useState<AirportPlace | null>(null);
  const [fromDraft, setFromDraft] = useState('');
  const [toDraft, setToDraft] = useState('');
  const [tripType, setTripType] = useState<TripType>('return');
  const [depart, setDepart] = useState(tomorrow);
  const [returnDate, setReturnDate] = useState<Date | null>(weekFromTomorrow);
  const [calPick, setCalPick] = useState<CalPick>('depart');
  const [calLeg, setCalLeg] = useState<number | null>(null);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(tomorrow()));
  const [calOpen, setCalOpen] = useState(false);
  const [legs, setLegs] = useState<MultiLeg[]>([]);
  const [legFocus, setLegFocus] = useState<{ i: number; side: 'from' | 'to' } | null>(null);
  const [fromHits, setFromHits] = useState<AirportPlace[]>([]);
  const [toHits, setToHits] = useState<AirportPlace[]>([]);
  const [focus, setFocus] = useState<'from' | 'to' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [fares, setFares] = useState<LatestFare[] | null>(null);
  const [fareGroups, setFareGroups] = useState<{ label: string; fares: LatestFare[] }[] | null>(null);
  const [confirm, setConfirm] = useState<LatestFare | null>(null);
  const pricePulse = useRef(new Animated.Value(1)).current;
  const youSize = useRef(new Animated.Value(11)).current;
  const cursor = useRef(new Animated.Value(1)).current;
  const acSeq = useRef(0);

  const popular = useMemo(() => {
    const skip = (legFocus?.side === 'to' || focus === 'to'
      ? (legFocus ? legs[legFocus.i]?.from?.code : fromPlace?.code)
      : (legFocus ? legs[legFocus.i]?.to?.code : toPlace?.code)) || '';
    return POPULAR_IATAS
      .filter(code => code !== skip)
      .map(placeFromIata)
      .slice(0, 6);
  }, [focus, fromPlace?.code, toPlace?.code, legFocus, legs]);

  useEffect(() => {
    if (!visible) return;
    const origin = placeFromIata(originDefault);
    setFromPlace(origin);
    setToPlace(null);
    setFromDraft(placeTitle(origin));
    setToDraft('');
    setDepart(tomorrow());
    setReturnDate(weekFromTomorrow());
    setTripType('return');
    setLegs([]);
    setLegFocus(null);
    setCalPick('depart');
    setCalLeg(null);
    setCalMonth(startOfMonth(tomorrow()));
    setCalOpen(false);
    setFares(null);
    setFareGroups(null);
    setError(false);
    setConfirm(null);
    setFromHits([]);
    setToHits([]);
    setFocus(null);
  }, [visible, originDefault]);

  useEffect(() => {
    if (!visible) return;
    return startLoopWhileActive(() =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(cursor, { toValue: 0.15, duration: 420, useNativeDriver: true }),
          Animated.timing(cursor, { toValue: 1, duration: 420, useNativeDriver: true }),
        ]),
      ),
    );
  }, [visible, cursor]);

  useEffect(() => {
    const side = legFocus?.side || focus;
    const i = legFocus?.i;
    const q = (
      side === 'from'
        ? (i != null ? legs[i]?.fromDraft : fromDraft)
        : side === 'to'
          ? (i != null ? legs[i]?.toDraft : toDraft)
          : ''
    ).trim();
    if (!side) {
      setFromHits([]);
      setToHits([]);
      return;
    }
    const local = q.length >= 2
      ? searchAirportsLocal(q, 8).map(recToPlace)
      : [];
    if (side === 'from') setFromHits(local);
    else setToHits(local);
    if (q.length < 2) return;
    const id = ++acSeq.current;
    const timer = setTimeout(() => {
      searchAirportPlaces(q, getLocale())
        .then(hits => {
          if (id !== acSeq.current) return;
          const merged = mergePlaces(hits, local);
          if (side === 'from') setFromHits(merged);
          else setToHits(merged);
        })
        .catch(() => {});
    }, 280);
    return () => clearTimeout(timer);
  }, [fromDraft, toDraft, focus, legs, legFocus]);

  const search = async () => {
    Keyboard.dismiss();
    setFocus(null);
    setLegFocus(null);
    setCalOpen(false);
    haptics.light();
    setBusy(true);
    setError(false);
    setFares(null);
    setFareGroups(null);
    try {
      const jobs: { label: string; origin: string; destination: string; date: string; returnDate?: string }[] = [];
      if (tripType === 'multi') {
        for (let i = 0; i < legs.length; i++) {
          const origin = fareSearchCode(legs[i].from, resolveCode(legs[i].from, legs[i].fromDraft, []));
          const destination = fareSearchCode(legs[i].to, resolveCode(legs[i].to, legs[i].toDraft, []));
          if (!origin || !destination || origin === destination) continue;
          jobs.push({
            label: copy.flightN(i + 1),
            origin,
            destination,
            date: isoDay(legs[i].date),
          });
        }
      } else {
        const origin = fareSearchCode(fromPlace, resolveCode(fromPlace, fromDraft, fromHits));
        const destination = fareSearchCode(toPlace, resolveCode(toPlace, toDraft, toHits));
        if (!origin || !destination || origin === destination) {
          setBusy(false);
          return;
        }
        jobs.push({
          label: `${origin} → ${destination}`,
          origin,
          destination,
          date: isoDay(depart),
          returnDate: tripType === 'return' && returnDate ? isoDay(returnDate) : undefined,
        });
      }
      if (!jobs.length) {
        setBusy(false);
        return;
      }
      const groups = await Promise.all(jobs.map(async job => {
        const rows = await fetchLatestFares({
          origin: job.origin,
          destination: job.destination,
          currency: currency.code,
          departDate: job.date,
          returnDate: job.returnDate,
        });
        return { label: job.label, fares: rows };
      }));
      setFareGroups(groups);
      setFares(groups.flatMap(g => g.fares));
      pricePulse.setValue(0.86);
      Animated.timing(pricePulse, {
        toValue: 1,
        duration: 520,
        easing: YOU_EASE,
        useNativeDriver: true,
      }).start();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };

  const onBook = (fare: LatestFare) => {
    haptics.light();
    setConfirm(fare);
    youSize.setValue(11);
    Animated.sequence([
      Animated.timing(youSize, { toValue: 22, duration: 420, easing: YOU_EASE, useNativeDriver: false }),
      Animated.timing(youSize, { toValue: 11, duration: 480, easing: YOU_EASE, useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (!finished) return;
      if (tripType === 'multi' && legs.length) {
        const first = legs[0];
        const origin = resolveCode(first.from, first.fromDraft, []) || fare.origin;
        const destination = resolveCode(first.to, first.toDraft, []) || fare.destination;
        const extra = legs.slice(1).flatMap(leg => {
          const o = resolveCode(leg.from, leg.fromDraft, []);
          const d = resolveCode(leg.to, leg.toDraft, []);
          if (!o || !d) return [];
          return [{ origin: o, destination: d, date: leg.date }];
        });
        void openAviasalesBooking(
          origin,
          destination,
          first.date,
          1,
          extra.length ? 'multicity' : 'oneway',
          undefined,
          extra.length ? extra : undefined,
        ).catch(() => {});
        return;
      }
      const origin = resolveCode(fromPlace, fromDraft, fromHits) || fare.origin;
      const destination = resolveCode(toPlace, toDraft, toHits) || fare.destination;
      const departDay = parseIsoDay(fare.departDate) || depart;
      const backDay = parseIsoDay(fare.returnDate) || returnDate || undefined;
      void openAviasalesBooking(
        origin,
        destination,
        departDay,
        1,
        tripType === 'return' && backDay ? 'return' : 'oneway',
        tripType === 'return' ? backDay : undefined,
      ).catch(() => {});
    });
  };

  const pickPlace = (place: AirportPlace) => {
    haptics.light();
    if (legFocus) {
      const { i, side } = legFocus;
      setLegs(prev => prev.map((leg, idx) => {
        if (idx !== i) return leg;
        if (side === 'from') {
          return { ...leg, from: place, fromDraft: placeTitle(place) };
        }
        const next = { ...leg, to: place, toDraft: placeTitle(place) };
        return next;
      }));
      if (legFocus.side === 'from' && !legs[i]?.to) {
        setLegFocus({ i, side: 'to' });
        return;
      }
      setLegFocus(null);
      setFromHits([]);
      setToHits([]);
      return;
    }
    if (focus === 'from') {
      setFromPlace(place);
      setFromDraft(placeTitle(place));
      setFromHits([]);
      if (!toPlace) {
        setFocus('to');
        return;
      }
    } else {
      setToPlace(place);
      setToDraft(placeTitle(place));
      setToHits([]);
    }
    setFocus(null);
  };

  const swapPlaces = () => {
    haptics.light();
    setFromPlace(toPlace);
    setToPlace(fromPlace);
    setFromDraft(toPlace ? placeTitle(toPlace) : '');
    setToDraft(fromPlace ? placeTitle(fromPlace) : '');
    setFromHits([]);
    setToHits([]);
  };

  const applyTripType = (next: TripType) => {
    if (next === tripType) return;
    haptics.light();
    setTripType(next);
    setCalOpen(false);
    setFares(null);
    setFareGroups(null);
    setFocus(null);
    setLegFocus(null);
    if (next === 'return') {
      setReturnDate(d => d || addDays(depart, 7));
      setCalPick('depart');
    }
    if (next === 'multi') {
      setLegs([
        {
          from: fromPlace,
          to: toPlace,
          fromDraft: fromPlace ? placeTitle(fromPlace) : fromDraft,
          toDraft: toPlace ? placeTitle(toPlace) : toDraft,
          date: depart,
        },
        {
          from: toPlace,
          to: null,
          fromDraft: toPlace ? placeTitle(toPlace) : '',
          toDraft: '',
          date: addDays(depart, 3),
        },
      ]);
    }
    if (next !== 'multi' && legs[0]) {
      setFromPlace(legs[0].from);
      setToPlace(legs[0].to);
      setFromDraft(legs[0].fromDraft);
      setToDraft(legs[0].toDraft);
      setDepart(legs[0].date);
    }
  };

  const addLeg = () => {
    if (legs.length >= 3) return;
    haptics.light();
    const last = legs[legs.length - 1];
    setLegs(prev => [...prev, {
      from: last?.to || null,
      to: null,
      fromDraft: last?.to ? placeTitle(last.to) : '',
      toDraft: '',
      date: addDays(last?.date || depart, 3),
    }]);
  };

  const removeLeg = (i: number) => {
    if (legs.length <= 2) return;
    haptics.light();
    setLegs(prev => prev.filter((_, idx) => idx !== i));
    setLegFocus(null);
  };

  const openCalendar = (pick: CalPick = 'depart', legIndex: number | null = null) => {
    Keyboard.dismiss();
    setFocus(null);
    setLegFocus(null);
    const same = calOpen && calPick === pick && calLeg === legIndex;
    if (same) {
      setCalOpen(false);
      return;
    }
    setCalPick(pick);
    setCalLeg(legIndex);
    const anchor = legIndex != null
      ? legs[legIndex]?.date
      : pick === 'return' && returnDate
        ? returnDate
        : depart;
    setCalMonth(startOfMonth(anchor || depart));
    setCalOpen(true);
  };

  const chooseDate = (d: Date) => {
    if (isBefore(startOfDay(d), today)) return;
    haptics.light();
    const day = atNoon(d);
    if (tripType === 'multi' && calLeg != null) {
      setLegs(prev => prev.map((leg, i) => i === calLeg ? { ...leg, date: day } : leg));
      setCalOpen(false);
      return;
    }
    if (tripType === 'return') {
      if (calPick === 'return' && !isBefore(startOfDay(day), startOfDay(depart))) {
        setReturnDate(day);
        setCalOpen(false);
        return;
      }
      setDepart(day);
      if (returnDate && isBefore(startOfDay(returnDate), startOfDay(day))) setReturnDate(null);
      setCalPick('return');
      return;
    }
    setDepart(day);
    setCalOpen(false);
  };

  const canPrevMonth = !isBefore(startOfMonth(addMonths(calMonth, -1)), startOfMonth(today));
  const canSearch = tripType === 'multi'
    ? legs.length >= 2 && legs.every(leg => {
      const o = resolveCode(leg.from, leg.fromDraft, []);
      const d = resolveCode(leg.to, leg.toDraft, []);
      return !!o && !!d && o !== d;
    })
    : !!resolveCode(fromPlace, fromDraft, fromHits)
      && !!resolveCode(toPlace, toDraft, toHits)
      && (tripType !== 'return' || !!returnDate);

  const hits = (legFocus?.side || focus) === 'from' ? fromHits : (legFocus?.side || focus) === 'to' ? toHits : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={st.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={st.head}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={st.title}>{copy.findAFlight}</Text>
            <View style={st.tripSeg}>
              {([
                ['return', copy.roundTrip],
                ['oneway', copy.oneWay],
                ['multi', copy.multiCity],
              ] as const).map(([id, label]) => (
                <Pressable
                  key={id}
                  onPress={() => applyTripType(id)}
                  style={[st.tripPill, tripType === id && st.tripPillOn]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tripType === id }}
                >
                  <Text style={[st.tripPillTxt, tripType === id && st.tripPillTxtOn]}>{label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={10}
            style={st.close}
            accessibilityRole="button"
            accessibilityLabel={copy.close}
          >
            <X size={18} color="#F4F0E6" />
          </TouchableOpacity>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={st.body}
          showsVerticalScrollIndicator={false}
        >
          <View style={st.form}>
            {tripType !== 'multi' ? (
              <>
            <View style={st.placeBlock}>
              <View style={st.placeIcon}>
                <AirplaneTakeoff size={18} color={GOLD} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.lbl}>{copy.from}</Text>
                {focus === 'from' ? (
                  <TextInput
                    value={fromDraft}
                    onChangeText={setFromDraft}
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="words"
                    placeholder={copy.whereFrom}
                    placeholderTextColor="rgba(255,255,255,0.28)"
                    style={st.placeInput}
                    accessibilityLabel={copy.from}
                  />
                ) : (
                  <Pressable
                    onPress={() => {
                      setCalOpen(false);
                      setLegFocus(null);
                      setFocus('from');
                      setFromDraft(fromPlace ? placeTitle(fromPlace) : '');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={copy.from}
                  >
                    <Text style={fromPlace ? st.placeCity : st.placePh} numberOfLines={1}>
                      {fromPlace ? placeTitle(fromPlace) : copy.whereFrom}
                    </Text>
                    {fromPlace ? (
                      <Text style={st.placeSub} numberOfLines={1}>{placeSubtitle(fromPlace)}</Text>
                    ) : null}
                  </Pressable>
                )}
              </View>
            </View>

            {focus === 'from' ? (
              <PlaceHits
                hits={hits}
                popular={popular}
                showPopular={fromDraft.trim().length < 2}
                onPick={pickPlace}
              />
            ) : null}

            <View style={st.swapRow}>
              <View style={st.swapLine} />
              <TouchableOpacity
                onPress={swapPlaces}
                style={st.swapBtn}
                accessibilityRole="button"
                accessibilityLabel={copy.swapAirports}
              >
                <ArrowsDownUp size={16} color={NAVY} weight="bold" />
              </TouchableOpacity>
            </View>

            <View style={st.placeBlock}>
              <View style={st.placeIcon}>
                <AirplaneLanding size={18} color={GOLD} />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={st.lbl}>{copy.to}</Text>
                {focus === 'to' ? (
                  <TextInput
                    value={toDraft}
                    onChangeText={setToDraft}
                    autoFocus
                    autoCorrect={false}
                    autoCapitalize="words"
                    placeholder={copy.whereTo}
                    placeholderTextColor="rgba(255,255,255,0.28)"
                    style={st.placeInput}
                    accessibilityLabel={copy.to}
                  />
                ) : (
                  <Pressable
                    onPress={() => {
                      setCalOpen(false);
                      setLegFocus(null);
                      setFocus('to');
                      setToDraft(toPlace ? placeTitle(toPlace) : '');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={copy.to}
                  >
                    <Text style={toPlace ? st.placeCity : st.placePh} numberOfLines={1}>
                      {toPlace ? placeTitle(toPlace) : copy.whereTo}
                    </Text>
                    {toPlace ? (
                      <Text style={st.placeSub} numberOfLines={1}>{placeSubtitle(toPlace)}</Text>
                    ) : null}
                  </Pressable>
                )}
              </View>
            </View>

            {focus === 'to' ? (
              <PlaceHits
                hits={hits}
                popular={popular}
                showPopular={toDraft.trim().length < 2}
                onPick={pickPlace}
              />
            ) : null}

            {tripType === 'return' ? (
              <View style={st.datePair}>
                <Pressable
                  onPress={() => openCalendar('depart')}
                  style={[st.dateHalf, calOpen && calPick === 'depart' && st.dateHalfOn]}
                  accessibilityRole="button"
                  accessibilityLabel={copy.departDate}
                >
                  <Text style={st.lbl}>{copy.departDate}</Text>
                  <Text style={st.placeCity}>{niceDay(depart)}</Text>
                </Pressable>
                <View style={st.dateSplit} />
                <Pressable
                  onPress={() => openCalendar('return')}
                  style={[st.dateHalf, calOpen && calPick === 'return' && st.dateHalfOn]}
                  accessibilityRole="button"
                  accessibilityLabel={copy.returnDate}
                >
                  <Text style={st.lbl}>{copy.returnDate}</Text>
                  <Text style={returnDate ? st.placeCity : st.placePh}>
                    {returnDate ? niceDay(returnDate) : copy.selectReturnDate}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => openCalendar('depart')}
                style={[st.dateTap, calOpen && st.dateTapOpen]}
                accessibilityRole="button"
                accessibilityLabel={copy.date}
              >
                <View style={st.placeIcon}>
                  <CalendarBlank size={18} color={GOLD} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={st.lbl}>{copy.date}</Text>
                  <Text style={st.placeCity}>{niceDay(depart)}</Text>
                </View>
                <View style={{ transform: [{ rotate: calOpen ? '90deg' : '0deg' }] }}>
                  <CaretRight size={16} color={GOLD} />
                </View>
              </Pressable>
            )}
              </>
            ) : (
              <>
                {legs.map((leg, i) => (
                  <View key={`leg-${i}`} style={i > 0 ? st.legBlock : undefined}>
                    <View style={st.legHead}>
                      <Text style={st.legTitle}>{copy.flightN(i + 1)}</Text>
                      {legs.length > 2 ? (
                        <Pressable onPress={() => removeLeg(i)} hitSlop={8} accessibilityLabel={copy.removeFlight}>
                          <Minus size={16} color={GOLD} />
                        </Pressable>
                      ) : null}
                    </View>
                    <View style={st.placeBlock}>
                      <View style={st.placeIcon}>
                        <AirplaneTakeoff size={16} color={GOLD} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.lbl}>{copy.from}</Text>
                        {legFocus?.i === i && legFocus.side === 'from' ? (
                          <TextInput
                            value={leg.fromDraft}
                            onChangeText={txt => setLegs(prev => prev.map((l, idx) => idx === i ? { ...l, fromDraft: txt, from: null } : l))}
                            autoFocus
                            autoCorrect={false}
                            autoCapitalize="words"
                            placeholder={copy.whereFrom}
                            placeholderTextColor="rgba(255,255,255,0.28)"
                            style={st.placeInput}
                          />
                        ) : (
                          <Pressable
                            onPress={() => {
                              setCalOpen(false);
                              setFocus(null);
                              setLegFocus({ i, side: 'from' });
                            }}
                          >
                            <Text style={leg.from ? st.placeCity : st.placePh} numberOfLines={1}>
                              {leg.from ? placeTitle(leg.from) : copy.whereFrom}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                    {legFocus?.i === i && legFocus.side === 'from' ? (
                      <PlaceHits
                        hits={hits}
                        popular={popular}
                        showPopular={leg.fromDraft.trim().length < 2}
                        onPick={pickPlace}
                      />
                    ) : null}
                    <View style={st.placeBlock}>
                      <View style={st.placeIcon}>
                        <AirplaneLanding size={16} color={GOLD} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={st.lbl}>{copy.to}</Text>
                        {legFocus?.i === i && legFocus.side === 'to' ? (
                          <TextInput
                            value={leg.toDraft}
                            onChangeText={txt => setLegs(prev => prev.map((l, idx) => idx === i ? { ...l, toDraft: txt, to: null } : l))}
                            autoFocus
                            autoCorrect={false}
                            autoCapitalize="words"
                            placeholder={copy.whereTo}
                            placeholderTextColor="rgba(255,255,255,0.28)"
                            style={st.placeInput}
                          />
                        ) : (
                          <Pressable
                            onPress={() => {
                              setCalOpen(false);
                              setFocus(null);
                              setLegFocus({ i, side: 'to' });
                            }}
                          >
                            <Text style={leg.to ? st.placeCity : st.placePh} numberOfLines={1}>
                              {leg.to ? placeTitle(leg.to) : copy.whereTo}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    </View>
                    {legFocus?.i === i && legFocus.side === 'to' ? (
                      <PlaceHits
                        hits={hits}
                        popular={popular}
                        showPopular={leg.toDraft.trim().length < 2}
                        onPick={pickPlace}
                      />
                    ) : null}
                    <Pressable
                      onPress={() => openCalendar('depart', i)}
                      style={[st.dateTap, calOpen && calLeg === i && st.dateTapOpen]}
                    >
                      <View style={st.placeIcon}>
                        <CalendarBlank size={16} color={GOLD} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.lbl}>{copy.date}</Text>
                        <Text style={st.placeCity}>{niceDay(leg.date)}</Text>
                      </View>
                    </Pressable>
                  </View>
                ))}
                {legs.length < 3 ? (
                  <Pressable onPress={addLeg} style={st.addLeg} accessibilityRole="button" accessibilityLabel={copy.addFlight}>
                    <Plus size={16} color={GOLD} weight="bold" />
                    <Text style={st.addLegTxt}>{copy.addFlight}</Text>
                  </Pressable>
                ) : null}
              </>
            )}

            {calOpen ? (
              <View style={st.calWrap}>
                <View style={st.calNav}>
                  <TouchableOpacity
                    onPress={() => canPrevMonth && setCalMonth(m => addMonths(m, -1))}
                    disabled={!canPrevMonth}
                    hitSlop={8}
                    style={st.dateBtn}
                    accessibilityRole="button"
                  >
                    <CaretLeft size={18} color={canPrevMonth ? GOLD : 'rgba(201,168,76,0.28)'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setCalMonth(m => addMonths(m, 1))}
                    hitSlop={8}
                    style={st.dateBtn}
                    accessibilityRole="button"
                  >
                    <CaretRight size={18} color={GOLD} />
                  </TouchableOpacity>
                </View>
                <MonthGrid
                  month={calMonth}
                  selected={tripType === 'return' ? null : (calLeg != null ? legs[calLeg]?.date : depart)}
                  rangeStart={tripType === 'return' ? depart : null}
                  rangeEnd={tripType === 'return' ? returnDate : null}
                  minDate={tripType === 'return' && calPick === 'return' ? depart : today}
                  onSelect={chooseDate}
                />
                <MonthGrid
                  month={addMonths(calMonth, 1)}
                  selected={tripType === 'return' ? null : (calLeg != null ? legs[calLeg]?.date : depart)}
                  rangeStart={tripType === 'return' ? depart : null}
                  rangeEnd={tripType === 'return' ? returnDate : null}
                  minDate={tripType === 'return' && calPick === 'return' ? depart : today}
                  onSelect={chooseDate}
                />
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={st.chips}
                >
                  <Pressable onPress={() => chooseDate(atNoon(new Date()))} style={st.chip}>
                    <Text style={st.chipTxt}>{copy.today}</Text>
                  </Pressable>
                  <Pressable onPress={() => chooseDate(tomorrow())} style={st.chip}>
                    <Text style={st.chipTxt}>{copy.tomorrow}</Text>
                  </Pressable>
                  <Pressable onPress={() => chooseDate(nextSaturday())} style={st.chip}>
                    <Text style={st.chipTxt}>{copy.nextWeekend}</Text>
                  </Pressable>
                  <Pressable onPress={() => chooseDate(addDays(atNoon(new Date()), 7))} style={st.chip}>
                    <Text style={st.chipTxt}>{copy.inOneWeek}</Text>
                  </Pressable>
                </ScrollView>
              </View>
            ) : null}
          </View>

          {busy ? (
            <View style={{ gap: 10, marginTop: 8 }}>
              <ResultSkeleton />
              <ResultSkeleton />
              <ResultSkeleton />
            </View>
          ) : null}

          {error ? (
            <Text style={st.emptyTxt}>{copy.couldNotLoadFlights}</Text>
          ) : null}

          {!busy && fares && fares.length === 0 ? (
            <View style={st.empty}>
              <SadWalker />
              <TouchableOpacity
                onPress={() => { void openAffiliateUrl(kiwiFlightsUrl()); }}
                activeOpacity={0.88}
                accessibilityRole="link"
                accessibilityLabel={copy.noFlightsTryKiwi}
                style={st.kiwiCta}
              >
                <Text style={st.kiwiCtaTxt}>{copy.noFlightsTryKiwi}</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!busy && fareGroups && fares && fares.length > 0 ? (
            <View style={{ gap: 16, marginTop: 8 }}>
              {fareGroups.map(group => (
                <View key={group.label} style={{ gap: 10 }}>
                  {fareGroups.length > 1 ? (
                    <Text style={st.groupLbl}>{group.label}</Text>
                  ) : null}
                  {group.fares.map((fare, i) => (
                    <FareCard
                      key={`${group.label}-${fare.origin}-${fare.destination}-${fare.departDate}-${fare.airline}-${i}`}
                      fare={fare}
                      currency={currency}
                      pulse={pricePulse}
                      onBook={onBook}
                    />
                  ))}
                </View>
              ))}
              {fares.length <= 3 ? (
                <TouchableOpacity
                  onPress={() => { void openAffiliateUrl(kiwiFlightsUrl()); }}
                  activeOpacity={0.7}
                  accessibilityRole="link"
                  accessibilityLabel={copy.seeMoreOnKiwi}
                  style={st.kiwiLink}
                >
                  <Text style={st.kiwiLinkTxt}>{copy.seeMoreOnKiwi}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          {confirm ? (
            <View style={st.confirm}>
              <Text style={st.confirmLbl}>{copy.yourBoardingPass}</Text>
              <BookingPassCard
                origin={confirm.origin}
                destination={confirm.destination}
                flightNumber={confirm.airline}
                dateLabel={niceDay(confirm.departDate)}
                gate="—"
                youSize={youSize}
                cursor={cursor}
              />
            </View>
          ) : null}
        </ScrollView>

        <View style={st.footer}>
          <TouchableOpacity
            onPress={() => { void search(); }}
            activeOpacity={0.88}
            disabled={!canSearch}
            style={[st.searchBtn, !canSearch && st.searchBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={copy.searchFlights}
          >
            <MagnifyingGlass size={18} color={NAVY} weight="bold" />
            <Text style={st.searchTxt}>{copy.searchFlights}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const CARD = '#112240';
const SECONDARY = 'rgba(255,255,255,0.4)';

const st = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NAVY,
    paddingTop: Platform.OS === 'ios' ? 54 : 24,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  tripSeg: {
    flexDirection: 'row',
    marginTop: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  tripPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -StyleSheet.hairlineWidth,
  },
  tripPillOn: {
    borderBottomColor: GOLD,
  },
  tripPillTxt: {
    color: SECONDARY,
    fontSize: 12,
    fontWeight: '800',
  },
  tripPillTxtOn: {
    color: GOLD,
  },
  close: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  form: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  placeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  placeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(201,168,76,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lbl: {
    color: SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  placeCity: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  placePh: {
    color: 'rgba(255,255,255,0.32)',
    fontSize: 20,
    fontWeight: '700',
  },
  placeSub: {
    color: SECONDARY,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  placeInput: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
    padding: 0,
    margin: 0,
  },
  swapRow: {
    height: 22,
    justifyContent: 'center',
    marginLeft: 46,
  },
  swapLine: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  swapBtn: {
    position: 'absolute',
    right: 4,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    marginTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  dateTapOpen: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  datePair: {
    flexDirection: 'row',
    marginTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    paddingTop: 8,
  },
  dateHalf: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  dateHalfOn: {
    backgroundColor: 'rgba(201,168,76,0.12)',
  },
  dateSplit: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginVertical: 6,
  },
  legBlock: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  legHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  legTitle: {
    color: GOLD,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  addLeg: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    marginTop: 4,
  },
  addLegTxt: {
    color: GOLD,
    fontSize: 14,
    fontWeight: '800',
  },
  groupLbl: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  calWrap: {
    paddingBottom: 8,
  },
  calNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  month: {
    marginTop: 4,
    marginBottom: 10,
  },
  monthTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekLbl: {
    flex: 1,
    textAlign: 'center',
    color: SECONDARY,
    fontSize: 11,
    fontWeight: '700',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRange: {
    width: '100%',
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRangeOn: {
    backgroundColor: 'rgba(201,168,76,0.18)',
  },
  dayRangeStart: {
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  dayRangeEnd: {
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
  },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: GOLD,
  },
  dayToday: {
    borderWidth: 1,
    borderColor: GOLD,
  },
  dayTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dayMuted: {
    color: 'rgba(255,255,255,0.22)',
  },
  dayPast: {
    color: 'rgba(255,255,255,0.18)',
  },
  daySelectedTxt: {
    color: NAVY,
    fontWeight: '800',
  },
  chips: {
    gap: 8,
    paddingVertical: 8,
    paddingRight: 8,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dateBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drop: {
    marginLeft: 46,
    marginBottom: 8,
    backgroundColor: 'rgba(10,22,40,0.55)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  dropHead: {
    color: SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
  },
  dropRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  dropSub: {
    color: SECONDARY,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  kindPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  kindTxt: {
    color: SECONDARY,
    fontSize: 10,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  searchBtn: {
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  searchBtnOff: {
    opacity: 0.38,
  },
  searchTxt: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    paddingLeft: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    left: 0,
    top: 10,
    bottom: 10,
    width: 3,
    borderRadius: 2,
    backgroundColor: GOLD,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  route: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  iataLine: {
    color: SECONDARY,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: 2,
  },
  meta: {
    color: SECONDARY,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 3,
  },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeDirect: {
    backgroundColor: 'rgba(34,197,94,0.18)',
  },
  badgeStop: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  badgeTxt: {
    fontSize: 11,
    fontWeight: '800',
  },
  badgeDirectTxt: {
    color: '#4ADE80',
  },
  badgeStopTxt: {
    color: SECONDARY,
  },
  price: {
    color: GOLD,
    fontSize: 22,
    fontWeight: '800',
  },
  bookBtn: {
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  bookTxt: {
    color: NAVY,
    fontSize: 12,
    fontWeight: '800',
  },
  empty: {
    alignItems: 'center',
    marginTop: 12,
  },
  emptyTxt: {
    color: SECONDARY,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 16,
  },
  kiwiCta: {
    marginTop: 16,
    width: '100%',
    backgroundColor: GOLD,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  kiwiCtaTxt: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  kiwiLink: {
    marginTop: 14,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  kiwiLinkTxt: {
    color: 'rgba(245,240,228,0.45)',
    fontSize: 13,
    fontWeight: '500',
  },
  sadStage: {
    height: 110,
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  skelLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  skelLg: {
    height: 14,
    width: '70%',
    borderRadius: 7,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  skelSm: {
    height: 10,
    width: '44%',
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  skelPrice: {
    width: 56,
    height: 22,
    borderRadius: 8,
    backgroundColor: 'rgba(201,168,76,0.2)',
  },
  confirm: {
    marginTop: 20,
  },
  confirmLbl: {
    color: GOLD,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
  },
});
