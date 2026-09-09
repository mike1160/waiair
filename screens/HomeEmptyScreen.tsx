import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Barcode, CaretDown, Gear, MagnifyingGlass, X } from 'phosphor-react-native';
import AirlineLogo, { airlineCodeFromFlight } from '../AirlineLogo';
import { FlightNumberText } from '../components/FlightNumberText';
import { airportRecByIata } from '../lib/airportsDb';
import { normalizeAirlineName } from '../lib/airlineDisplay';
import { formatDayShort } from '../lib/boardFilter';
import { getLocalizedCity } from '../lib/cityLocalized';
import { fetchWeatherSnapshot } from '../lib/destinationServices';
import { formatFlightNumber } from '../lib/flightIdent';
import { haptics } from '../lib/haptics';
import { getLocale, t } from '../lib/i18n';
import { formatTempC, getPrefs } from '../lib/prefs';
import {
  dateOffsetDays,
  parseSmartQuery,
  ymdFromDate,
  type SmartQuery,
} from '../lib/smartQuery';
import {
  partitionHomeSearchResults,
  pickFlightNumberHits,
} from '../lib/homeNow';
import { resetSearchStartedDedupe, trackSearchStarted } from '../lib/analytics';

export type HomeEmptyFlight = {
  number: string;
  origin: string;
  destination: string;
  originCity?: string;
  destCity?: string;
  originCountry?: string;
  destCountry?: string;
  status?: string;
  scheduledTime?: string;
  arrivalTime?: string;
  departureTime?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  actualDeparture?: string;
  airline?: string;
  airlineCode?: string;
  operatingNumber?: string;
  codeshareStatus?: string;
  alsoCodeshare?: string;
};

type Colors = {
  bg: string;
  text: string;
  muted: string;
  accent: string;
  card: string;
  border: string;
  secondary: string;
};

type DayChip = 'today' | 'tomorrow';

type Props = {
  homeAirport: { iata: string; city: string; lat: number; lon: number };
  colors: Colors;
  lookupFlight: (number: string) => Promise<HomeEmptyFlight[]>;
  lookupRoute: (from: string, to: string, offset: number) => Promise<HomeEmptyFlight[]>;
  lookupArrivals: (hub: string, offset: number) => Promise<HomeEmptyFlight[]>;
  onOpenAirportPicker: () => void;
  onScan: () => void;
  onPasteImport: () => void;
  onSelectFlight: (flight: HomeEmptyFlight) => void;
  onOpenSettings: () => void;
  onClose?: () => void;
};

function greetingKey(now: Date): 'homeGreetingMorning' | 'homeGreetingAfternoon' | 'homeGreetingEvening' {
  const h = now.getHours();
  if (h < 12) return 'homeGreetingMorning';
  if (h < 18) return 'homeGreetingAfternoon';
  return 'homeGreetingEvening';
}

function clock(iso?: string): string {
  const m = String(iso || '').match(/T(\d{2}:\d{2})/);
  return m ? m[1] : '';
}

function dayKey(iso?: string): string {
  return String(iso || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
}

function placeWithCode(iata: string, fallbackCity?: string): string {
  const rec = airportRecByIata(iata);
  const city = getLocalizedCity(iata, getLocale(), rec?.city || fallbackCity || iata);
  return `${city || iata} (${iata})`;
}

function withoutLoops(list: HomeEmptyFlight[]): HomeEmptyFlight[] {
  return list.filter(f => String(f.origin || '').toUpperCase() !== String(f.destination || '').toUpperCase());
}

function applyChip(q: SmartQuery, chip: DayChip, now: Date, locked: boolean): SmartQuery {
  if (!locked && q.dateKind && q.dateKind !== 'today') return q;
  if (chip === 'today') {
    return { ...q, dateKind: 'today', date: ymdFromDate(now), needsDate: false };
  }
  const tom = new Date(now.getTime());
  tom.setDate(tom.getDate() + 1);
  return { ...q, dateKind: 'tomorrow', date: ymdFromDate(tom), needsDate: false };
}

function offsetFor(q: SmartQuery, now: Date): number {
  if (!q.date) {
    if (q.dateKind === 'today') return 0;
    if (q.dateKind === 'tomorrow') return 1;
    if (q.dateKind === 'next_week') return 7;
    return 0;
  }
  return dateOffsetDays(q.date, ymdFromDate(now));
}

export default function HomeEmptyScreen({
  homeAirport,
  colors: c,
  lookupFlight,
  lookupRoute,
  lookupArrivals,
  onOpenAirportPicker,
  onScan,
  onPasteImport,
  onSelectFlight,
  onOpenSettings,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const copy = t();
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<DayChip>('today');
  const [wxLine, setWxLine] = useState('');
  const [hits, setHits] = useState<HomeEmptyFlight[]>([]);
  const [busy, setBusy] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipTouched = useRef(false);

  const parsed = useMemo(() => {
    const now = new Date();
    return applyChip(
      parseSmartQuery(query, { now, homeIata: homeAirport.iata }),
      chip,
      now,
      chipTouched.current,
    );
  }, [query, chip, homeAirport.iata]);

  useEffect(() => {
    if (chipTouched.current) return;
    const q = parseSmartQuery(query, { now: new Date(), homeIata: homeAirport.iata });
    setChip(q.dateKind === 'tomorrow' ? 'tomorrow' : 'today');
  }, [query, homeAirport.iata]);

  useEffect(() => {
    let cancelled = false;
    const city = getLocalizedCity(homeAirport.iata, getLocale(), homeAirport.city);
    const greet = copy[greetingKey(new Date())];
    fetchWeatherSnapshot(homeAirport.lat, homeAirport.lon, city || homeAirport.iata)
      .then(snap => {
        if (cancelled || !snap) {
          if (!cancelled) setWxLine(greet);
          return;
        }
        setWxLine(copy.homeGreetingWeather(greet, city, formatTempC(snap.temp, getPrefs().tempUnit)));
      })
      .catch(() => {
        if (!cancelled) setWxLine(greet);
      });
    return () => { cancelled = true; };
  }, [homeAirport.iata, homeAirport.city, homeAirport.lat, homeAirport.lon, copy]);

  const runLookup = useCallback(async (raw: string, q: SmartQuery) => {
    const n = ++seq.current;
    const trimmed = raw.trim();
    if (!trimmed) {
      setHits([]);
      setBusy(false);
      setLookedUp(false);
      resetSearchStartedDedupe();
      return;
    }
    const canFetch = !!(q.flightNumber
      || (q.origin && q.destination && q.origin !== q.destination && q.dateKind)
      || (q.destination && !q.origin && q.dateKind));
    if (!canFetch) {
      setHits([]);
      setBusy(false);
      setLookedUp(false);
      return;
    }
    setBusy(true);
    void trackSearchStarted({
      raw: trimmed,
      placeMatched: !q.flightNumber && !!q.destination,
    });
    try {
      let next: HomeEmptyFlight[] = [];
      if (q.flightNumber) {
        const all = await lookupFlight(q.flightNumber);
        next = pickFlightNumberHits(all, Date.now(), { dayOffset: offsetFor(q, new Date()) });
      } else if (q.origin && q.destination && q.origin !== q.destination && q.dateKind) {
        const offset = offsetFor(q, new Date());
        const all = await lookupRoute(q.origin, q.destination, offset);
        const { upcoming, departed } = partitionHomeSearchResults(all, Date.now(), {
          includeDeparted: offset < 0,
        });
        next = [...upcoming, ...departed];
      } else if (q.destination && !q.origin && q.dateKind) {
        const offset = offsetFor(q, new Date());
        const all = await lookupArrivals(q.destination, offset);
        const { upcoming, departed } = partitionHomeSearchResults(all, Date.now(), {
          includeDeparted: offset < 0,
        });
        next = [...upcoming, ...departed];
      }
      if (n !== seq.current) return;
      setHits(withoutLoops(next));
      setLookedUp(true);
    } catch {
      if (n !== seq.current) return;
      setHits([]);
      setLookedUp(true);
    } finally {
      if (n === seq.current) setBusy(false);
    }
  }, [lookupFlight, lookupRoute, lookupArrivals]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = query.trim();
    if (!trimmed) {
      seq.current++;
      setHits([]);
      setBusy(false);
      setLookedUp(false);
      resetSearchStartedDedupe();
      return;
    }
    timer.current = setTimeout(() => {
      void runLookup(trimmed, parsed);
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, parsed, runLookup]);

  const destLabel = (iata: string) => {
    const rec = airportRecByIata(iata);
    return rec ? `${getLocalizedCity(iata, getLocale(), rec.city)} (${iata})` : iata;
  };

  const destOptions = parsed.destinations?.length
    ? parsed.destinations
    : parsed.destination
      ? [parsed.destination]
      : [];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.topBar}>
        <View style={styles.topBarFill} />
        {onClose ? (
          <Pressable
            onPress={() => { haptics.light(); onClose(); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={copy.close}
            style={styles.settingsBtn}
          >
            <X size={20} color={c.muted} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { haptics.light(); onOpenSettings(); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={copy.settings}
            style={styles.settingsBtn}
          >
            <Gear size={20} color={c.muted} />
          </Pressable>
        )}
      </View>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
      >
        {wxLine ? (
          <Text style={[styles.greet, { color: c.muted }]} numberOfLines={1}>{wxLine}</Text>
        ) : null}
        <Text style={[styles.heading, { color: c.text }]}>{copy.homeWhereTo}</Text>

        <View style={[styles.field, { backgroundColor: c.card, borderColor: c.border }]}>
          <MagnifyingGlass size={18} color={c.muted} />
          <TextInput
            value={query}
            onChangeText={(text) => {
              if (!text.trim()) {
                chipTouched.current = false;
                setChip('today');
              }
              setQuery(text);
            }}
            placeholder={copy.searchPlaceholder}
            placeholderTextColor={c.muted}
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={[styles.input, { color: c.text }]}
            accessibilityLabel={copy.searchPlaceholder}
            onSubmitEditing={() => {
              if (timer.current) clearTimeout(timer.current);
              void runLookup(query.trim(), parsed);
            }}
          />
        </View>

        <ScrollView
          horizontal
          nestedScrollEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.chipsScroll}
          contentContainerStyle={styles.chips}
        >
          <Chip
            label={copy.today}
            on={chip === 'today'}
            colors={c}
            onPress={() => {
              haptics.light();
              chipTouched.current = true;
              setChip('today');
            }}
          />
          <Chip
            label={copy.tomorrow}
            on={chip === 'tomorrow'}
            colors={c}
            onPress={() => {
              haptics.light();
              chipTouched.current = true;
              setChip('tomorrow');
            }}
          />
          {parsed.needsOrigin ? (
            <Chip
              label={copy.homeChipFromWhere}
              on
              colors={c}
              onPress={() => { haptics.light(); onOpenAirportPicker(); }}
            />
          ) : (
            <Chip
              label={copy.homeChipFrom(homeAirport.iata)}
              on={false}
              caret
              colors={c}
              onPress={() => { haptics.light(); onOpenAirportPicker(); }}
            />
          )}
          {parsed.needsDate ? (
            <Chip
              label={copy.homeChipPickDate}
              on
              colors={c}
              onPress={() => {
                haptics.light();
                chipTouched.current = true;
                setChip('today');
              }}
            />
          ) : null}
        </ScrollView>

        {parsed.ambiguous?.kind === 'place' && parsed.ambiguous.options[1] ? (
          <Text style={[styles.didYou, { color: c.muted }]}>
            {copy.homeDidYouMean(destLabel(parsed.ambiguous.options[1]))}
          </Text>
        ) : null}

        {destOptions.length > 0 && !parsed.flightNumber && !hits.length && !busy && !lookedUp ? (
          <View style={styles.results}>
            {destOptions.map(iata => (
              <Pressable
                key={iata}
                onPress={() => {
                  haptics.light();
                  if (parsed.needsDate) setChip('today');
                  setQuery(prev => (prev.includes(iata) ? prev : `${prev} ${iata}`.trim()));
                }}
                style={[styles.row, { backgroundColor: c.card, borderColor: c.border }]}
              >
                <Text style={[styles.rowTitle, { color: c.text }]}>{destLabel(iata)}</Text>
                <Text style={[styles.rowSub, { color: c.muted }]}>
                  {parsed.origin && parsed.origin !== iata ? `${parsed.origin} → ${iata}` : iata}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {busy ? (
          <ActivityIndicator style={{ marginTop: 16 }} color={c.accent} />
        ) : null}

        {lookedUp && !busy && !hits.length && parsed.flightNumber ? (
          <Text style={[styles.empty, { color: c.muted }]}>{copy.noFlightsFor(parsed.flightNumber)}</Text>
        ) : null}

        {lookedUp && !busy && !hits.length && !parsed.flightNumber ? (
          <Text style={[styles.empty, { color: c.muted }]}>
            {copy.homeRouteEmpty(
              parsed.origin
                ? getLocalizedCity(parsed.origin, getLocale(), airportRecByIata(parsed.origin)?.city || parsed.origin)
                : getLocalizedCity(homeAirport.iata, getLocale(), homeAirport.city),
              parsed.destination
                ? getLocalizedCity(parsed.destination, getLocale(), airportRecByIata(parsed.destination)?.city || parsed.destination)
                : '',
              parsed.dateKind === 'tomorrow'
                ? copy.tomorrow
                : parsed.date
                  ? formatDayShort(parsed.date)
                  : copy.today,
            )}
          </Text>
        ) : null}

        {hits.length ? (
          <View style={styles.results}>
            {(() => {
              const includeDeparted = offsetFor(parsed, new Date()) < 0;
              const { upcoming, departed } = partitionHomeSearchResults(hits, Date.now(), { includeDeparted });
              return [...upcoming, ...departed].slice(0, 12).map((f, i) => (
                <ResultRow
                  key={`${f.number}-${f.origin}-${f.destination}-${i}`}
                  flight={f}
                  colors={c}
                  today={ymdFromDate(new Date())}
                  departed={departed.includes(f)}
                  onPress={() => { haptics.light(); onSelectFlight(f); }}
                />
              ));
            })()}
          </View>
        ) : null}

        <Pressable
          onPress={() => { haptics.medium(); onScan(); }}
          style={[styles.scan, { backgroundColor: c.accent }]}
          accessibilityRole="button"
          accessibilityLabel={copy.scanBoardingPass}
        >
          <Barcode size={20} color="#0D1B2E" weight="bold" />
          <Text style={styles.scanTxt}>{copy.scanBoardingPass}</Text>
        </Pressable>

        <Pressable onPress={() => { haptics.light(); onPasteImport(); }} accessibilityRole="link">
          <Text style={[styles.link, { color: c.secondary }]}>{copy.homePasteBooking}</Text>
        </Pressable>

        <Text style={[styles.foot, { color: c.muted }]}>{copy.homeNoAccount}</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({
  label,
  on,
  colors: c,
  onPress,
  caret,
}: {
  label: string;
  on: boolean;
  colors: Colors;
  onPress: () => void;
  caret?: boolean;
}) {
  const fg = on ? '#0D1B2E' : c.text;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: on ? c.accent : c.border, backgroundColor: on ? c.accent : c.card },
      ]}
    >
      <Text style={[styles.chipTxt, { color: fg }]} numberOfLines={1}>{label}</Text>
      {caret ? <CaretDown size={12} color={fg} weight="bold" /> : null}
    </Pressable>
  );
}

function ResultRow({
  flight: f,
  colors: c,
  today,
  departed,
  onPress,
}: {
  flight: HomeEmptyFlight;
  colors: Colors;
  today: string;
  departed?: boolean;
  onPress: () => void;
}) {
  const code = f.airlineCode || airlineCodeFromFlight(f.number);
  const airline = normalizeAirlineName(f.airline, code);
  const from = placeWithCode(f.origin, f.originCity);
  const to = placeWithCode(f.destination, f.destCity);
  const dep = clock(f.scheduledDeparture || f.departureTime || f.scheduledTime);
  const arr = clock(f.scheduledArrival || f.arrivalTime);
  const times = dep && arr ? `${dep} → ${arr}` : (dep || arr);
  const when = dayKey(f.scheduledDeparture || f.departureTime || f.scheduledTime);
  const dateBit = when && when !== today ? ` · ${formatDayShort(when)}` : '';
  const titleColor = departed ? c.muted : c.text;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.row, { backgroundColor: c.card, borderColor: c.border, opacity: departed ? 0.55 : 1 }]}
    >
      <AirlineLogo iata={code} name={f.airline} size={36} preferAirhex />
      <View style={styles.rowText}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', minWidth: 0 }}>
          {airline ? (
            <Text style={[styles.rowTitle, { color: titleColor, flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
              {airline}
            </Text>
          ) : null}
          {airline ? (
            <Text style={[styles.rowTitle, { color: titleColor, flexShrink: 0 }]}>{' · '}</Text>
          ) : null}
          <FlightNumberText style={[styles.rowTitle, { color: titleColor, flex: 1, minWidth: 0 }]}>
            {formatFlightNumber(f)}
          </FlightNumberText>
        </View>
        <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>{`${from} → ${to}`}</Text>
        {times ? (
          <Text style={[styles.rowMeta, { color: departed ? c.muted : c.secondary }]} numberOfLines={1}>
            {`${times}${dateBit}${departed ? ` · ${t().departed}` : ''}`}
          </Text>
        ) : departed ? (
          <Text style={[styles.rowMeta, { color: c.muted }]} numberOfLines={1}>{t().departed}</Text>
        ) : null}
        {f.alsoCodeshare ? (
          <Text style={[styles.rowAlso, { color: c.muted }]} numberOfLines={1}>{t().homeAlsoCodeshare(f.alsoCodeshare)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    minHeight: 36,
  },
  topBarFill: { flex: 1 },
  settingsBtn: { padding: 6 },
  scroll: { flex: 1 },
  body: { paddingHorizontal: 24, paddingTop: 4, flexGrow: 1 },
  greet: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  heading: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4, marginBottom: 18 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  chipsScroll: { flexGrow: 0, flexShrink: 0, alignSelf: 'stretch', height: 56 },
  chips: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    flexGrow: 0,
  },
  chip: {
    height: 32,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexGrow: 0,
    flexShrink: 0,
  },
  chipTxt: { fontSize: 13, fontWeight: '600', lineHeight: 16 },
  didYou: { fontSize: 13, marginBottom: 8 },
  results: { gap: 8, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 16, fontWeight: '700' },
  rowSub: { fontSize: 13, marginTop: 2 },
  rowMeta: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  rowAlso: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  empty: { fontSize: 14, lineHeight: 20, marginTop: 16 },
  scan: {
    marginTop: 28,
    minHeight: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  scanTxt: { fontSize: 16, fontWeight: '800', color: '#0D1B2E' },
  link: { marginTop: 16, textAlign: 'center', fontSize: 14, fontWeight: '600' },
  foot: { marginTop: 'auto', paddingTop: 28, textAlign: 'center', fontSize: 12 },
});
