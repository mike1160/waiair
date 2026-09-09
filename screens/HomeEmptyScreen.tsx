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
  useWindowDimensions,
  View,
} from 'react-native';
import { PALETTE_TOKENS, skyFor, skyForImage, skyTopIsDark } from '../lib/themeTokens';
import Horizon from '../components/Horizon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Barcode, CaretDown, Gear, MagnifyingGlass, X } from 'phosphor-react-native';
import AirlineLogo, { airlineCodeFromFlight } from '../AirlineLogo';
import { FlightNumberText } from '../components/FlightNumberText';
import { airportRecByIata, COUNTRY_META } from '../lib/airportsDb';
import { COUNTRY_HUBS } from '../lib/countryHubs';
import { formatDayShort } from '../lib/boardFilter';
import { getLocalizedCity } from '../lib/cityLocalized';
import { fetchWeatherSnapshot } from '../lib/destinationServices';
import { formatFlightNumber } from '../lib/flightIdent';
import {
  EMPTY_CLOCK,
  formatAirportClock,
} from '../lib/flightTimes';
import { haptics } from '../lib/haptics';
import { getLocale, t } from '../lib/i18n';
import { TimeoutError } from '../lib/net';
import { formatTempC, getPrefs } from '../lib/prefs';
import {
  applyPickedChooseHub,
  dateOffsetDays,
  formatReflectLine,
  parseSmartQuery,
  homeSearchCanFetch,
  ymdFromDate,
  type ReflectLocale,
  type SmartQuery,
} from '../lib/smartQuery';
import {
  homeSearchDelayClocks,
  homeSearchRowStatus,
  mergeHubSearchFlights,
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
  estimatedDeparture?: string;
  actualDeparture?: string;
  revisedTime?: string;
  actualTime?: string;
  boardSide?: 'arrival' | 'departure' | 'both';
  gate?: string;
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
  isDark?: boolean;
  onClose?: () => void;
  initialQuery?: string;
  initialQueryGen?: number;
  welcomeBack?: boolean;
  lastDestIata?: string;
  lastDestLabel?: string;
};

const DEV_SKY_CYCLE = ['auto', 'dawn', 'day', 'dusk', 'night'] as const;
type DevSky = (typeof DEV_SKY_CYCLE)[number];

function greetingKey(now: Date): 'homeGreetingMorning' | 'homeGreetingAfternoon' | 'homeGreetingEvening' {
  const h = now.getHours();
  if (h < 12) return 'homeGreetingMorning';
  if (h < 18) return 'homeGreetingAfternoon';
  return 'homeGreetingEvening';
}

function clockIso(iso?: string, iata?: string, country?: string): string {
  const s = formatAirportClock(iso || '', iata, getPrefs().timeFormat === '12h', country);
  return !s || s === EMPTY_CLOCK ? '' : s;
}

function dayKey(iso?: string): string {
  return String(iso || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1] || '';
}

function placeWithCode(iata: string, fallbackCity?: string): string {
  const code = String(iata || '').trim().toUpperCase();
  const cityFallback = String(fallbackCity || '').trim();
  if (!code) return cityFallback;
  const rec = airportRecByIata(code);
  const city = getLocalizedCity(code, getLocale(), rec?.city || cityFallback || code);
  return `${city || code} (${code})`;
}

function countryForHubs(iatas: string[]): string {
  const key = [...new Set(iatas.map(c => String(c || '').toUpperCase()).filter(Boolean))].sort().join(',');
  for (const [cc, hubs] of Object.entries(COUNTRY_HUBS)) {
    const hubKey = [...hubs].sort().join(',');
    if (hubKey === key) return COUNTRY_META[cc]?.name || cc;
  }
  return '';
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
  isDark = false,
  onClose,
  initialQuery,
  initialQueryGen,
  welcomeBack,
  lastDestIata,
  lastDestLabel,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [inputFocused, setInputFocused] = useState(false);
  const [devSky, setDevSky] = useState<DevSky>('auto');
  const copy = t();
  const locale = getLocale() as ReflectLocale;
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [chip, setChip] = useState<DayChip>('today');
  const [wxLine, setWxLine] = useState('');
  const [hits, setHits] = useState<HomeEmptyFlight[]>([]);
  const [busy, setBusy] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);
  const [lookupError, setLookupError] = useState<'timeout' | 'proxy' | null>(null);
  const [pickedHub, setPickedHub] = useState<string | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipTouched = useRef(false);

  const parsedBase = useMemo(() => {
    const now = new Date();
    return applyChip(
      parseSmartQuery(query, { now, homeIata: homeAirport.iata }),
      chip,
      now,
      chipTouched.current,
    );
  }, [query, chip, homeAirport.iata]);

  const parsed = useMemo(
    () => applyPickedChooseHub(parsedBase, pickedHub),
    [parsedBase, pickedHub],
  );

  useEffect(() => {
    setPickedHub(prev => {
      if (!prev) return prev;
      const q = parseSmartQuery(query, { now: new Date(), homeIata: homeAirport.iata });
      if (q.placeMode === 'choose' && q.destinations?.includes(prev)) return prev;
      return null;
    });
  }, [query, homeAirport.iata]);

  useEffect(() => {
    if (chipTouched.current) return;
    const q = parseSmartQuery(query, { now: new Date(), homeIata: homeAirport.iata });
    setChip(q.dateKind === 'tomorrow' ? 'tomorrow' : 'today');
  }, [query, homeAirport.iata]);

  useEffect(() => {
    if (!initialQuery) return;
    chipTouched.current = false;
    setChip('today');
    setQuery(initialQuery);
  }, [initialQuery, initialQueryGen]);

  useEffect(() => {
    let cancelled = false;
    const city = getLocalizedCity(homeAirport.iata, getLocale(), homeAirport.city);
    const greet = welcomeBack ? copy.homeWelcomeBack : copy[greetingKey(new Date())];
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
  }, [homeAirport.iata, homeAirport.city, homeAirport.lat, homeAirport.lon, copy, welcomeBack]);

  const runLookup = useCallback(async (raw: string, q: SmartQuery) => {
    const n = ++seq.current;
    const trimmed = raw.trim();
    if (!trimmed) {
      setHits([]);
      setBusy(false);
      setLookedUp(false);
      setLookupError(null);
      resetSearchStartedDedupe();
      return;
    }
    const canFetch = homeSearchCanFetch(q);
    if (!canFetch) {
      setHits([]);
      setBusy(false);
      setLookedUp(false);
      setLookupError(null);
      return;
    }
    setBusy(true);
    setLookupError(null);
    void trackSearchStarted({
      raw: trimmed,
      placeMatched: !q.flightNumber && !!q.destination,
    });
    try {
      let next: HomeEmptyFlight[] = [];
      if (q.flightNumber) {
        const all = await lookupFlight(q.flightNumber);
        next = pickFlightNumberHits(all, Date.now(), { dayOffset: offsetFor(q, new Date()) });
      } else if (q.placeMode === 'merge' && q.destinations?.length && q.dateKind) {
        const offset = offsetFor(q, new Date());
        const lists = q.origin
          ? await Promise.all(q.destinations.map(d => lookupRoute(q.origin!, d, offset)))
          : await Promise.all(q.destinations.map(d => lookupArrivals(d, offset)));
        const all = mergeHubSearchFlights(lists.flat());
        const { upcoming, departed } = partitionHomeSearchResults(all, Date.now(), {
          includeDeparted: offset <= 0,
        });
        console.log('[homeSearch]', {
          from: q.origin || 'arrivals', to: q.destinations.join(','), offset,
          raw: all.length, upcoming: upcoming.length, departed: departed.length,
        });
        next = [...upcoming, ...departed];
      } else if (q.origin && q.destination && q.origin !== q.destination && q.dateKind) {
        const offset = offsetFor(q, new Date());
        const all = await lookupRoute(q.origin, q.destination, offset);
        const { upcoming, departed } = partitionHomeSearchResults(all, Date.now(), {
          includeDeparted: offset <= 0,
        });
        console.log('[homeSearch]', {
          from: q.origin, to: q.destination, offset,
          raw: all.length, upcoming: upcoming.length, departed: departed.length,
        });
        next = [...upcoming, ...departed];
      } else if (q.destination && !q.origin && q.dateKind) {
        const offset = offsetFor(q, new Date());
        const all = await lookupArrivals(q.destination, offset);
        const { upcoming, departed } = partitionHomeSearchResults(all, Date.now(), {
          includeDeparted: offset <= 0,
        });
        console.log('[homeSearch]', {
          from: 'arrivals', to: q.destination, offset,
          raw: all.length, upcoming: upcoming.length, departed: departed.length,
        });
        next = [...upcoming, ...departed];
      }
      if (n !== seq.current) return;
      setHits(withoutLoops(next));
      setLookedUp(true);
      setLookupError(null);
    } catch (e) {
      if (n !== seq.current) return;
      setHits([]);
      setLookedUp(true);
      const timeout = e instanceof TimeoutError || (e as { name?: string })?.name === 'TimeoutError';
      setLookupError(timeout ? 'timeout' : 'proxy');
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
      setLookupError(null);
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

  const cityLabel = (iata?: string, fallback?: string) => {
    const code = String(iata || '').toUpperCase();
    if (!code) return fallback || '';
    const rec = airportRecByIata(code);
    return getLocalizedCity(code, getLocale(), rec?.city || fallback || code);
  };

  const dateLabel = parsed.dateKind === 'tomorrow'
    ? copy.tomorrow
    : parsed.dateKind === 'today'
      ? copy.today
      : parsed.date
        ? formatDayShort(parsed.date)
        : '';

  const chooseIatas = parsedBase.placeMode === 'choose' ? (parsedBase.destinations || []) : [];
  const reflect = formatReflectLine(
    query.trim() ? parsed : {},
    locale,
    {
      dest: cityLabel(parsed.destination),
      origin: cityLabel(parsed.origin, homeAirport.city),
      date: dateLabel,
      country: countryForHubs(chooseIatas),
      chooseA: chooseIatas[0] ? cityLabel(chooseIatas[0]) : '',
      chooseB: chooseIatas[1] ? cityLabel(chooseIatas[1]) : '',
      copy: {
        dest: copy.homeReflectDest,
        origin: copy.homeReflectFrom,
        choose: copy.homeReflectChoose,
      },
    },
  );

  const onReflectSlot = (slot?: string, missing?: boolean) => {
    if (!missing) return;
    haptics.light();
    if (slot === 'origin') onOpenAirportPicker();
    else if (slot === 'date') {
      chipTouched.current = true;
      setChip('today');
    } else if (slot === 'dest') inputRef.current?.focus();
  };

  const skyScene = (__DEV__ && devSky !== 'auto')
    ? skyForImage(devSky, isDark)
    : skyFor(new Date().getHours(), isDark);
  const skyIcon = skyTopIsDark(skyScene)
    ? '#FFFFFF'
    : PALETTE_TOKENS.light.navy;

  const cycleDevSky = () => {
    if (!__DEV__) return;
    const i = DEV_SKY_CYCLE.indexOf(devSky);
    setDevSky(DEV_SKY_CYCLE[(i + 1) % DEV_SKY_CYCLE.length]);
    haptics.light();
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Horizon
        isDark={isDark}
        collapsed={inputFocused}
        width={width}
        insetTop={insets.top}
        forceImage={__DEV__ && devSky !== 'auto' ? devSky : null}
      />
      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <View style={styles.topBarFill} />
        {onClose ? (
          <Pressable
            onPress={() => { haptics.light(); onClose(); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={copy.close}
            style={styles.settingsBtn}
          >
            <X size={20} color={skyIcon} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => { haptics.light(); onOpenSettings(); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={copy.settings}
            style={styles.settingsBtn}
          >
            <Gear size={20} color={skyIcon} />
          </Pressable>
        )}
      </View>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
      >
        {wxLine || __DEV__ ? (
          __DEV__ ? (
            <Pressable onLongPress={cycleDevSky} delayLongPress={400}>
              {wxLine ? (
                <Text style={[styles.greet, { color: c.muted }]} numberOfLines={1}>{wxLine}</Text>
              ) : null}
              <Text style={[styles.devSky, { color: c.muted }]}>{devSky}</Text>
            </Pressable>
          ) : (
            <Text style={[styles.greet, { color: c.muted }]} numberOfLines={1}>{wxLine}</Text>
          )
        ) : null}
        <Text style={[styles.heading, { color: c.text }]}>{copy.homeWhereTo}</Text>

        <View style={[styles.field, { backgroundColor: c.card, borderColor: c.border }]}>
          <MagnifyingGlass size={18} color={c.muted} />
          <TextInput
            ref={inputRef}
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
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            onSubmitEditing={() => {
              if (timer.current) clearTimeout(timer.current);
              void runLookup(query.trim(), parsed);
            }}
          />
        </View>

        {reflect.state === 'empty' ? null : (
        <Text style={[styles.reflect, { color: c.muted }]}>
          {reflect.segments.map((seg, i) => {
              const gap = i === 0 || seg.kind === 'check' || reflect.segments[i - 1]?.kind === 'check'
                ? (seg.kind === 'check' ? '' : i === 0 ? '' : ' ')
                : ' · ';
              const color = seg.inferred || seg.missing ? c.muted : c.text;
              const node = (
                <Text
                  key={`${seg.slot || seg.kind}-${i}`}
                  onPress={seg.missing ? () => onReflectSlot(seg.slot, true) : undefined}
                  style={{ color, fontWeight: seg.missing ? '700' : seg.inferred ? '500' : '700' }}
                  accessibilityRole={seg.missing ? 'button' : undefined}
                >
                  {seg.text}
                </Text>
              );
              return (
                <Text key={`g-${i}`}>
                  {gap}
                  {node}
                </Text>
              );
            })}
        </Text>
        )}

        <View style={styles.chips}>
          {welcomeBack && lastDestIata && lastDestLabel && !query.trim() ? (
            <Chip
              label={lastDestLabel}
              on={false}
              colors={c}
              onPress={() => {
                haptics.light();
                setQuery(lastDestIata);
                void trackSearchStarted({ raw: lastDestIata, placeMatched: true });
              }}
            />
          ) : null}
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
          {parsedBase.placeMode === 'choose' && parsedBase.destinations?.length ? (
            parsedBase.destinations.map(iata => (
              <Chip
                key={iata}
                label={destLabel(iata)}
                on={pickedHub === iata}
                colors={c}
                onPress={() => {
                  haptics.light();
                  if (parsedBase.needsDate) {
                    chipTouched.current = true;
                    setChip('today');
                  }
                  setPickedHub(iata);
                }}
              />
            ))
          ) : null}
        </View>

        {parsed.ambiguous?.kind === 'place' && parsed.ambiguous.options[1] && !hits.length ? (
          <Text style={[styles.didYou, { color: c.muted }]}>
            {copy.homeDidYouMean(destLabel(parsed.ambiguous.options[1]))}
          </Text>
        ) : null}

        {busy && !hits.length ? (
          <ActivityIndicator style={{ marginTop: 16 }} color={c.accent} />
        ) : null}

        {lookedUp && !busy && lookupError ? (
          <Text style={[styles.empty, { color: c.muted }]}>
            {lookupError === 'timeout' ? copy.homeSearchTimeout : copy.homeSearchFailed}
          </Text>
        ) : null}

        {lookedUp && !busy && !hits.length && !lookupError && parsed.flightNumber ? (
          <Text style={[styles.empty, { color: c.muted }]}>{copy.noFlightsFor(parsed.flightNumber)}</Text>
        ) : null}

        {lookedUp && !busy && !hits.length && !lookupError && !parsed.flightNumber ? (
          <Text style={[styles.empty, { color: c.muted }]}>
            {copy.homeRouteEmpty(
              parsed.origin
                ? getLocalizedCity(parsed.origin, getLocale(), airportRecByIata(parsed.origin)?.city || parsed.origin)
                : getLocalizedCity(homeAirport.iata, getLocale(), homeAirport.city),
              parsed.destination
                ? getLocalizedCity(parsed.destination, getLocale(), airportRecByIata(parsed.destination)?.city || parsed.destination)
                : '',
              parsed.dateKind === 'tomorrow'
                ? copy.homeRouteWhenTomorrow
                : parsed.dateKind === 'today' || !parsed.date
                  ? copy.homeRouteWhenToday
                  : formatDayShort(parsed.date),
            )}{' '}
            {parsed.dateKind === 'today'
              ? copy.homeRouteEmptyHint
              : copy.homeRouteEmptyHintAirline}
          </Text>
        ) : null}

        {hits.length ? (
          <View style={styles.results}>
            {(() => {
              const offset = offsetFor(parsed, new Date());
              const includeDeparted = offset <= 0;
              const { upcoming, departed } = partitionHomeSearchResults(hits, Date.now(), { includeDeparted });
              const destName = parsed.destination
                ? getLocalizedCity(
                  parsed.destination,
                  getLocale(),
                  airportRecByIata(parsed.destination)?.city || parsed.destination,
                )
                : '';
              const alreadyLeft = offset === 0 && upcoming.length === 0 && departed.length > 0 && destName;
              return (
                <>
                  {alreadyLeft ? (
                    <Text style={[styles.empty, { color: c.muted, marginTop: 0, marginBottom: 4 }]}>
                      {`${copy.homeTodayAlreadyLeft(destName)} `}
                      <Text
                        onPress={() => {
                          haptics.light();
                          chipTouched.current = true;
                          setChip('tomorrow');
                        }}
                        style={{ color: c.accent, fontWeight: '700' }}
                        accessibilityRole="button"
                        accessibilityLabel={copy.homeTodayTomorrowCta}
                      >
                        {copy.homeTodayTomorrowCta}
                      </Text>
                    </Text>
                  ) : null}
                  {[...upcoming, ...departed].slice(0, 12).map((f, i) => (
                    <ResultRow
                      key={`${f.number}-${f.origin}-${f.destination}-${i}`}
                      flight={f}
                      colors={c}
                      today={ymdFromDate(new Date())}
                      departed={departed.includes(f)}
                      onPress={() => { haptics.light(); onSelectFlight(f); }}
                    />
                  ))}
                </>
              );
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
  const copy = t();
  const code = f.airlineCode || airlineCodeFromFlight(f.number);
  const airline = String(f.airline || '').trim();
  const from = placeWithCode(f.origin, f.originCity);
  const to = placeWithCode(f.destination, f.destCity);
  const route = from && to ? `${from} → ${to}` : (from || to);
  const delay = homeSearchDelayClocks(f);
  const status = homeSearchRowStatus(f, Date.now(), !!departed);
  const liveDepIso = delay?.estimatedIso || f.scheduledDeparture || f.departureTime || f.scheduledTime;
  const dep = clockIso(liveDepIso, f.origin, f.originCountry);
  const arr = clockIso(f.scheduledArrival || f.arrivalTime, f.destination, f.destCountry);
  const schedClock = delay ? clockIso(delay.scheduledIso, f.origin, f.originCountry) : '';
  const times = dep && arr ? `${dep} → ${arr}` : (dep || arr);
  const when = dayKey(f.scheduledDeparture || f.departureTime || f.scheduledTime);
  const dateBit = when && when !== today ? ` · ${formatDayShort(when)}` : '';
  const titleColor = departed ? c.muted : c.text;
  const metaColor = departed ? c.muted : c.secondary;

  let statusLine = '';
  if (status.kind === 'cancelled') statusLine = copy.cancelled;
  else if (status.kind === 'boarding') statusLine = copy.boardingNow;
  else if (status.kind === 'gateClosed') statusLine = copy.gateClosed;
  else if (status.kind === 'delayed') {
    const est = clockIso(status.estimatedIso, f.origin, f.originCountry);
    statusLine = est ? copy.homeDelayedAt(est) : copy.delayed;
  } else if (status.kind === 'enRoute') statusLine = copy.enRoute;
  else if (status.kind === 'landed') statusLine = copy.landed;
  else if (status.kind === 'departed') {
    const tClock = clockIso(status.iso, f.origin, f.originCountry);
    if (status.assumedScheduled && tClock) statusLine = copy.homeDepartedAtScheduled(tClock);
    else if (tClock) statusLine = copy.homeDepartedAt(tClock);
    else statusLine = copy.departed;
  }

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
        {route ? (
          <Text style={[styles.rowSub, { color: c.muted }]} numberOfLines={1}>{route}</Text>
        ) : null}
        {schedClock && delay ? (
          <Text style={[styles.rowStruck, { color: c.muted }]}>{schedClock}</Text>
        ) : null}
        {times ? (
          <Text style={[styles.rowMeta, { color: metaColor }]} numberOfLines={1}>
            {`${times}${dateBit}`}
          </Text>
        ) : null}
        {statusLine ? (
          <Text style={[styles.rowMeta, { color: metaColor }]} numberOfLines={1}>{statusLine}</Text>
        ) : null}
        {f.alsoCodeshare ? (
          <Text style={[styles.rowAlso, { color: c.muted }]} numberOfLines={1}>{copy.homeAlsoCodeshare(f.alsoCodeshare)}</Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
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
  devSky: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6, textTransform: 'uppercase' as const },
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
  reflect: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 10,
    minHeight: 22,
    lineHeight: 22,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
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
  rowStruck: { fontSize: 11, marginTop: 2, fontWeight: '600', textDecorationLine: 'line-through' },
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
