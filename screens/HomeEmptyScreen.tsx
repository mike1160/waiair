import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  type KeyboardEvent,
} from 'react-native';
import { homeSearchKeyboardFromEvent } from '../lib/homeKeyboard';
import { horizonBandHeight } from '../lib/horizon';
import { PALETTE_TOKENS, skyChromeTint, skyFor, skyForImage, type SkyImageId } from '../lib/themeTokens';
import Horizon from '../components/Horizon';
import BoardingPassCard from '../components/BoardingPassCard';
import BookingStub from '../components/BookingStub';
import HomeDatePicker from '../components/HomeDatePicker';
import Animated, {
  cancelAnimation,
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CaretDown, ClockCounterClockwise, Gear, MagnifyingGlass, X } from 'phosphor-react-native';
import AirlineLogo, { airlineCodeFromFlight } from '../AirlineLogo';
import AddToWalletButton from '../components/AddToWalletButton';
import FlightStatusBadge, { statusBadgeToneFromPhase } from '../FlightStatusBadge';
import { FlightNumberText } from '../components/FlightNumberText';
import { airportRecByIata, COUNTRY_META } from '../lib/airportsDb';
import { COUNTRY_HUBS } from '../lib/countryHubs';
import { formatDayShort } from '../lib/boardFilter';
import { getLocalizedCity } from '../lib/cityLocalized';
import { fetchWeatherSnapshot } from '../lib/destinationServices';
import { formatFlightNumber } from '../lib/flightIdent';
import {
  EMPTY_CLOCK,
  flightClockUtcMs,
  formatAirportClock,
} from '../lib/flightTimes';
import { aviasalesSearchHomeUrl } from '../lib/aviasales';
import { haptics } from '../lib/haptics';
import { getLocale, t } from '../lib/i18n';
import { classifyLookupError, proxyHealthOk, searchTimeoutKind } from '../lib/searchTimeout';
import { isSearchQuotaError } from '../lib/net';
import type { SearchTier } from '../lib/searchQuota';
import { journeyRows } from '../lib/flightLegs';
import { formatTempC, getPrefs, subscribePrefs, type SearchStyle } from '../lib/prefs';
import {
  applyPickedChooseHub,
  applyPickedOrigin,
  applyHomeOrigin,
  dateOffsetDays,
  formatReflectLine,
  parseSmartQuery,
  homeSearchCanFetch,
  ymdFromDate,
  type ReflectLocale,
  type SmartQuery,
} from '../lib/smartQuery';
import {
  flightSearchOriginLock,
  originChipDisplayIata,
} from '../lib/originChipLock';
import {
  applyHomeDateChoice,
  formatPickDateChip,
  homeDateChoiceFromYmd,
  labelReturnDateChip,
  returnDateChipYmds,
  type HomeDateChoice,
} from '../lib/homeReturnDate';
import { popularDestinationsForHub } from '../lib/smartSearch';
import { addLocalDays, toLocalDateString } from '../lib/localFlightTime';
import { LinearGradient } from 'expo-linear-gradient';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { formatDurationMs } from '../boardingCountdown';
import {
  homeSearchDelayClocks,
  homeSearchRowStatus,
  matchingAirlineFlights,
  matchingFlightNumber,
  mergeHubSearchFlights,
  isDepartedSearchResult,
  partitionHomeSearchResults,
  pickFlightNumberHits,
  searchDepartureClock,
} from '../lib/homeNow';
import { resetSearchStartedDedupe, trackSearchStarted } from '../lib/analytics';
import {
  formatHomeLiveLine,
  homeLiveFromBoard,
  homeLiveHour,
  type HomeLiveSnapshot,
} from '../lib/homeEmptyAlive';
import type { ClipboardImportHit } from '../lib/clipboardTrackable';
import type { ImportCandidate } from '../lib/flightImport';

export type HomeEmptyFlight = {
  number: string;
  /** Multi-leg number, no leg from the From airport: this leg's position (Leg 1 of 2). */
  legOf?: { index: number; total: number };
  /** Multi-leg number, leg from the From airport: stops before the final destination. */
  via?: string[];
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

/** Today's 1-stop option: origin → hub, then hub → destination. */
export type HomeEmptyConnection = {
  id: string;
  hub: string;
  layoverMin: number;
  legs: [HomeEmptyFlight, HomeEmptyFlight];
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

type Props = {
  homeAirport: { iata: string; city: string; lat: number; lon: number };
  colors: Colors;
  /** `date` (YYYY-MM-DD): the chosen day when it is not today. */
  lookupFlight: (number: string, date?: string) => Promise<HomeEmptyFlight[]>;
  lookupRoute: (from: string, to: string, offset: number) => Promise<HomeEmptyFlight[]>;
  lookupArrivals: (hub: string, offset: number) => Promise<HomeEmptyFlight[]>;
  lookupDepartures: (hub: string, offset: number) => Promise<HomeEmptyFlight[]>;
  lookupConnections?: (from: string, to: string) => Promise<HomeEmptyConnection[]>;
  peekCachedDepartures?: (iata: string) => Promise<HomeEmptyFlight[] | null>;
  onOpenAirportPicker: () => void;
  onScan: () => void;
  onPasteImport: (candidates?: ImportCandidate[], opts?: { focusPaste?: boolean }) => void;
  onSelectFlight: (flight: HomeEmptyFlight) => void;
  onOpenSettings: () => void;
  isDark?: boolean;
  onClose?: () => void;
  initialQuery?: string;
  initialQueryGen?: number;
  welcomeBack?: boolean;
  lastDestIata?: string;
  lastDestLabel?: string;
  /** Outbound arrival YMD (dest TZ). When set with initialQuery, ask for a return day. */
  dateAnchorYmd?: string;
  /** BCBP / Continue: search this calendar day (today, tomorrow, or a picked YMD). */
  initialDateYmd?: string;
  /** BCBP departure airport so a multi-leg number shows the scanned leg. */
  initialOriginIata?: string;
  reserveHorizon?: boolean;
  /** Pro: the Wallet pass from a flight-number search gets push updates. */
  isPro?: boolean;
  /** Flight-number search quota tier (lib/searchQuota.ts). */
  searchTier?: SearchTier;
  /** Searches used up (or free user over the proxy limit): open the paywall. */
  onSearchQuotaReached?: () => void;
  onHorizonChrome?: (next: {
    collapsed: boolean;
    collapseDurationMs: number;
    forceImage: SkyImageId | null;
  }) => void;
};

const GOLD = PALETTE_TOKENS.light.gold;
const NAVY = PALETTE_TOKENS.light.navy;
const GOLD_LIGHT = PALETTE_TOKENS.light.goldLight;

function nativeDatePickerAvailable(): boolean {
  return !!NativeModules.RNDateTimePicker;
}

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

function logHomeFilter(tag: string, steps: Record<string, unknown>) {
  console.log('[homeSearch:filter]', { tag, ...steps });
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
  lookupDepartures,
  lookupConnections,
  peekCachedDepartures,
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
  dateAnchorYmd,
  initialDateYmd,
  initialOriginIata,
  reserveHorizon = false,
  onHorizonChrome,
  isPro = false,
  searchTier = 'free',
  onSearchQuotaReached,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [keyboardH, setKeyboardH] = useState(0);
  const [keyboardDurMs, setKeyboardDurMs] = useState(250);
  const [hour, setHour] = useState(() => homeLiveHour(homeAirport.iata, airportRecByIata(homeAirport.iata)?.country));
  const [liveSnap, setLiveSnap] = useState<HomeLiveSnapshot | null>(null);
  const liveFlightsRef = useRef<HomeEmptyFlight[] | null>(null);
  const [devSky, setDevSky] = useState<DevSky>('auto');
  const copy = t();
  const locale = getLocale() as ReflectLocale;
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const [stepDest, setStepDest] = useState('');
  const [searchStyle, setSearchStyle] = useState<SearchStyle>(() => getPrefs().searchStyle || 'quick');
  const [dateChoice, setDateChoice] = useState<HomeDateChoice>({ kind: 'today' });
  const [calOpen, setCalOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickDraft, setPickDraft] = useState<Date | null>(null);
  const [wxLine, setWxLine] = useState('');
  const [hits, setHits] = useState<HomeEmptyFlight[]>([]);
  const [connections, setConnections] = useState<HomeEmptyConnection[]>([]);
  const [connectionsBusy, setConnectionsBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lookedUp, setLookedUp] = useState(false);
  const [lookupError, setLookupError] = useState<'timeout' | 'slow' | 'proxy' | 'rateLimited' | 'quota' | null>(null);
  // Read in runLookup through a ref: new callback identities must not re-run the lookup effect.
  const quotaRef = useRef({ searchTier, onSearchQuotaReached });
  quotaRef.current = { searchTier, onSearchQuotaReached };
  /** Minutes until the proxy's AeroDataBox budget resets (from its 429), shown with lookupError 'rateLimited'. */
  const [retryAfterMin, setRetryAfterMin] = useState<number | null>(null);
  const [pickedHub, setPickedHub] = useState<string | null>(null);
  const [originLocked, setOriginLocked] = useState(false);
  const [lockedOriginIata, setLockedOriginIata] = useState<string | null>(null);
  const previousOriginRef = useRef(homeAirport.iata);
  const originLockSource = useRef<'picker' | 'flight' | null>(null);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chipTouched = useRef(false);

  const parsedBase = useMemo(() => {
    const now = new Date();
    return applyHomeDateChoice(
      parseSmartQuery(query, { now, homeIata: homeAirport.iata }),
      dateChoice,
      now,
      chipTouched.current,
    );
  }, [query, dateChoice, homeAirport.iata]);

  const parsed = useMemo(() => {
    const withHub = applyPickedChooseHub(parsedBase, pickedHub);
    // Unlocked chip shows the home airport: search from there (route), not the destination's whole board.
    return originLocked && lockedOriginIata
      ? applyPickedOrigin(withHub, lockedOriginIata)
      : applyHomeOrigin(withHub, homeAirport.iata);
  }, [parsedBase, pickedHub, originLocked, lockedOriginIata, homeAirport.iata]);

  const originChipIata = originChipDisplayIata({
    locked: originLocked,
    lockedIata: lockedOriginIata,
    parsedOrigin: parsed.origin,
    needsOrigin: parsed.needsOrigin,
    previousOrigin: previousOriginRef.current || homeAirport.iata,
  });
  const originCountry = airportRecByIata(originChipIata)?.country;
  const popularDests = useMemo(
    () => popularDestinationsForHub(originChipIata),
    [originChipIata],
  );
  const showPopular = searchStyle === 'steps' ? !stepDest.trim() : !query.trim();

  useEffect(() => {
    setPickedHub(prev => {
      if (!prev) return prev;
      const q = parseSmartQuery(query, { now: new Date(), homeIata: homeAirport.iata });
      if (q.placeMode === 'choose' && q.destinations?.includes(prev)) return prev;
      return null;
    });
  }, [query, homeAirport.iata]);

  useEffect(() => {
    if (originLocked) return;
    previousOriginRef.current = parsed.origin && !parsed.needsOrigin
      ? parsed.origin
      : homeAirport.iata;
  }, [originLocked, parsed.origin, parsed.needsOrigin, homeAirport.iata]);

  useEffect(() => {
    if (!originLocked || originLockSource.current !== 'picker') return;
    setLockedOriginIata(homeAirport.iata);
  }, [homeAirport.iata, originLocked]);

  const unlockOriginChip = useCallback(() => {
    originLockSource.current = null;
    setLockedOriginIata(null);
    setOriginLocked(false);
  }, []);

  useEffect(() => subscribePrefs(() => {
    setSearchStyle(getPrefs().searchStyle || 'quick');
  }), []);

  useEffect(() => {
    if (chipTouched.current) return;
    const q = parseSmartQuery(query, { now: new Date(), homeIata: homeAirport.iata });
    if (q.dateKind === 'tomorrow') setDateChoice({ kind: 'tomorrow' });
    else if (q.dateKind === 'today') setDateChoice({ kind: 'today' });
    else if (q.date && (q.dateKind === 'absolute' || q.dateKind === 'weekday' || q.dateKind === 'next_week')) {
      setDateChoice({ kind: 'ymd', date: q.date });
    }
  }, [query, homeAirport.iata]);

  useEffect(() => {
    const apply = (e: KeyboardEvent) => {
      const next = homeSearchKeyboardFromEvent({
        height: e.endCoordinates?.height ?? 0,
        duration: e.duration,
      });
      setKeyboardH(next.height);
      setKeyboardDurMs(next.durationMs);
    };
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, apply);
    const hide = Keyboard.addListener(hideEvt, apply);
    const hideDid = Platform.OS === 'ios'
      ? Keyboard.addListener('keyboardDidHide', apply)
      : null;
    return () => {
      show.remove();
      hide.remove();
      hideDid?.remove();
    };
  }, []);

  useEffect(() => {
    const tick = () => {
      setHour(homeLiveHour(originChipIata, originCountry));
      setLiveSnap(homeLiveFromBoard(liveFlightsRef.current, originChipIata));
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [originChipIata, originCountry]);

  useEffect(() => {
    let cancelled = false;
    liveFlightsRef.current = null;
    if (!peekCachedDepartures) {
      setLiveSnap(null);
      return;
    }
    peekCachedDepartures(originChipIata).then(flights => {
      if (cancelled) return;
      liveFlightsRef.current = flights;
      setLiveSnap(homeLiveFromBoard(flights, originChipIata));
    }).catch(() => {
      if (!cancelled) {
        liveFlightsRef.current = null;
        setLiveSnap(null);
      }
    });
    return () => { cancelled = true; };
  }, [originChipIata, peekCachedDepartures]);

  useEffect(() => {
    if (dateAnchorYmd) {
      chipTouched.current = true;
      setDateChoice({ kind: 'unset' });
      setCalOpen(false);
      setPickOpen(false);
    } else if (initialDateYmd) {
      chipTouched.current = true;
      setDateChoice(homeDateChoiceFromYmd(initialDateYmd));
      setCalOpen(false);
      setPickOpen(false);
    } else {
      chipTouched.current = false;
      setDateChoice({ kind: 'today' });
      setPickOpen(false);
    }
    setQuery(initialQuery || '');
    const origin = String(initialOriginIata || '').trim().toUpperCase();
    if (/^[A-Z]{3}$/.test(origin)) {
      originLockSource.current = 'flight';
      setLockedOriginIata(origin);
      setOriginLocked(true);
    } else {
      unlockOriginChip();
    }
  }, [initialQuery, initialQueryGen, dateAnchorYmd, initialDateYmd, initialOriginIata, unlockOriginChip]);

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
    setConnections([]);
    setConnectionsBusy(false);
    if (!trimmed) {
      setHits([]);
      setBusy(false);
      setLookedUp(false);
      setLookupError(null);
      resetSearchStartedDedupe();
      unlockOriginChip();
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
      let connectionRoute: { from: string; to: string } | null = null;
      const nowMs = Date.now();
      const originIata = q.flightNumber
        ? (originLocked && lockedOriginIata ? lockedOriginIata : undefined)
        : (q.origin || homeAirport.iata);
      if (q.flightNumber) {
        const offset = offsetFor(q, new Date());
        let live: HomeEmptyFlight[] = [];
        try {
          // Another day than today: that date's flights from AeroDataBox (the undated call only covers around today).
          live = await lookupFlight(q.flightNumber, offset !== 0 && q.date ? q.date : undefined);
        } catch (e) {
          if (isSearchQuotaError(e)) throw e;
          live = [];
        }
        logHomeFilter('flightNumber', { step: '1-proxy-raw', count: live.length, offset, originIata });
        // Multi-leg numbers (BR75 TPE→BKK→AMS): the leg from the From airport is primary with the final arrival; without
        // one every leg is labeled. A locked origin still filters single-leg flights only.
        const lockedOrigin = String(originIata || '').toUpperCase();
        const rows = journeyRows(live, originIata || originChipIata)
          .filter(f => f.legOf || f.via || !lockedOrigin || String(f.origin || '').toUpperCase() === lockedOrigin);
        next = pickFlightNumberHits(rows, nowMs, { dayOffset: offset });
        logHomeFilter('flightNumber', { step: '2-after-dayOrigin', count: next.length });
        if (!next.length && originIata) {
          const board = await lookupDepartures(originIata, offset);
          logHomeFilter('flightNumber', { step: '3-board-raw', count: board.length, originIata });
          const matched = matchingFlightNumber(board, q.flightNumber);
          logHomeFilter('flightNumber', { step: '4-after-numberMatch', count: matched.length });
          next = pickFlightNumberHits(matched, nowMs, { dayOffset: offset, originIata });
          logHomeFilter('flightNumber', { step: '5-after-dayOrigin', count: next.length });
        }
      } else if (q.airline && originIata && q.dateKind) {
        const offset = offsetFor(q, new Date());
        const board = await lookupDepartures(originIata, offset);
        logHomeFilter('airline', { step: '1-proxy-raw', count: board.length, offset, originIata, airline: q.airline });
        const all = matchingAirlineFlights(board, q.airline);
        logHomeFilter('airline', { step: '2-after-airlineMatch', count: all.length });
        const { upcoming, departed } = partitionHomeSearchResults(all, nowMs, {
          includeDeparted: offset <= 0,
        });
        logHomeFilter('airline', {
          step: '3-after-departedPartition',
          upcoming: upcoming.length,
          departed: departed.length,
          includeDeparted: offset <= 0,
        });
        next = [...upcoming, ...departed];
      } else if (q.placeMode === 'merge' && q.destinations?.length && q.dateKind) {
        const offset = offsetFor(q, new Date());
        const lists = q.origin
          ? await Promise.all(q.destinations.map(d => lookupRoute(q.origin!, d, offset)))
          : await Promise.all(q.destinations.flatMap(d => [
            lookupArrivals(d, offset),
            lookupDepartures(d, offset),
          ]));
        logHomeFilter('merge', {
          step: '1-proxy-raw',
          count: lists.reduce((n, list) => n + list.length, 0),
          offset, from: q.origin || 'airport', to: q.destinations.join(','),
        });
        const all = mergeHubSearchFlights(lists.flat());
        logHomeFilter('merge', { step: '2-after-merge', count: all.length });
        const { upcoming, departed } = partitionHomeSearchResults(all, Date.now(), {
          includeDeparted: offset <= 0,
        });
        logHomeFilter('merge', {
          step: '3-after-departedPartition',
          upcoming: upcoming.length,
          departed: departed.length,
          includeDeparted: offset <= 0,
        });
        next = [...upcoming, ...departed];
      } else if (q.origin && q.destination && q.origin !== q.destination && q.dateKind) {
        const offset = offsetFor(q, new Date());
        if (offset === 0) connectionRoute = { from: q.origin, to: q.destination };
        const all = await lookupRoute(q.origin, q.destination, offset);
        logHomeFilter('route', {
          step: '1-proxy-raw', count: all.length, offset, from: q.origin, to: q.destination,
        });
        const { upcoming, departed } = partitionHomeSearchResults(all, Date.now(), {
          includeDeparted: offset <= 0,
        });
        logHomeFilter('route', {
          step: '2-after-departedPartition',
          upcoming: upcoming.length,
          departed: departed.length,
          includeDeparted: offset <= 0,
        });
        next = [...upcoming, ...departed];
      } else if (q.destination && !q.origin && q.dateKind) {
        const offset = offsetFor(q, new Date());
        const iatas = q.destinations?.length ? q.destinations : [q.destination];
        const lists = await Promise.all(iatas.flatMap(d => [
          lookupArrivals(d, offset),
          lookupDepartures(d, offset),
        ]));
        const all = mergeHubSearchFlights(lists.flat());
        logHomeFilter('airport', {
          step: '1-proxy-raw', count: all.length, offset, hubs: iatas.join(','),
        });
        const { upcoming, departed } = partitionHomeSearchResults(all, Date.now(), {
          includeDeparted: offset <= 0,
        });
        logHomeFilter('airport', {
          step: '2-after-departedPartition',
          upcoming: upcoming.length,
          departed: departed.length,
          includeDeparted: offset <= 0,
        });
        next = [...upcoming, ...departed];
      }
      if (n !== seq.current) return;
      const shown = withoutLoops(next);
      logHomeFilter('ui', { step: 'final-to-ui', beforeLoops: next.length, shown: shown.length });
      setHits(shown);
      setLookedUp(true);
      setLookupError(null);
      // No direct flight today → look for 1-stop options (proxy caps hubs and caches them).
      if (connectionRoute && !shown.length && lookupConnections) {
        const route = connectionRoute;
        setConnectionsBusy(true);
        lookupConnections(route.from, route.to)
          .then(list => { if (n === seq.current) setConnections(list); })
          .catch(() => { /* optional — the empty-route copy stays */ })
          .finally(() => { if (n === seq.current) setConnectionsBusy(false); });
      }
      const lock = flightSearchOriginLock({
        query: trimmed,
        flightNumber: q.flightNumber,
        lookedUp: true,
        hitOrigin: shown[0]?.origin,
        hitCount: shown.length,
      });
      if (lock.lock) {
        originLockSource.current = 'flight';
        setLockedOriginIata(lock.iata);
        setOriginLocked(true);
      } else if (q.flightNumber) {
        originLockSource.current = null;
        setLockedOriginIata(null);
        setOriginLocked(false);
      }
    } catch (e) {
      if (n !== seq.current) return;
      setHits([]);
      setLookedUp(true);
      if (q.flightNumber) {
        originLockSource.current = null;
        setLockedOriginIata(null);
        setOriginLocked(false);
      }
      const failure = classifyLookupError(e);
      if (failure.kind === 'quota') {
        // The app already opened the paywall; the inline line reopens it.
        setLookupError('quota');
      } else if (failure.kind === 'timeout') {
        const healthOk = await proxyHealthOk();
        if (n !== seq.current) return;
        setLookupError(searchTimeoutKind(healthOk));
      } else if (failure.kind === 'rateLimited') {
        if (quotaRef.current.searchTier === 'free') {
          // Free users never see a technical limit message: the paywall explains the searches instead.
          setLookupError('quota');
          quotaRef.current.onSearchQuotaReached?.();
        } else {
          // Budget spent: say how long to wait instead of a generic failure.
          setRetryAfterMin(failure.retryAfterMin);
          setLookupError('rateLimited');
        }
      } else {
        setLookupError('proxy');
      }
    } finally {
      if (n === seq.current) setBusy(false);
    }
  }, [homeAirport.iata, lookupDepartures, lookupFlight, lookupRoute, lookupArrivals, lookupConnections, originLocked, lockedOriginIata, originChipIata, unlockOriginChip]);

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
      unlockOriginChip();
      return;
    }
    timer.current = setTimeout(() => {
      void runLookup(trimmed, parsed);
    }, 450);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, parsed, runLookup, unlockOriginChip]);

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

  const askReturnDate = !!dateAnchorYmd;
  const nowYmd = ymdFromDate(new Date());
  const returnYmds = askReturnDate && dateAnchorYmd
    ? returnDateChipYmds(dateAnchorYmd)
    : null;
  const pickedYmd = dateChoice.kind === 'ymd' ? dateChoice.date : '';
  const calMinYmd = dateAnchorYmd && dateOffsetDays(dateAnchorYmd, nowYmd) > 0
    ? dateAnchorYmd
    : nowYmd;

  const chooseIatas = parsedBase.placeMode === 'choose' ? (parsedBase.destinations || []) : [];
  const reflectOrigin = parsed.origin && !parsed.needsOrigin
    ? cityLabel(parsed.origin, homeAirport.city)
    : '';
  const reflect = formatReflectLine(
    query.trim() ? parsed : {},
    locale,
    {
      dest: cityLabel(parsed.destination),
      origin: reflectOrigin,
      airline: parsed.airlineName || parsed.airline,
      date: dateLabel,
      country: countryForHubs(chooseIatas),
      chooseA: chooseIatas[0] ? cityLabel(chooseIatas[0]) : '',
      chooseB: chooseIatas[1] ? cityLabel(chooseIatas[1]) : '',
      originInferred: parsed.originSource === 'home' && !hits[0]?.origin,
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
      if (askReturnDate) setCalOpen(true);
      else setDateChoice({ kind: 'today' });
    } else if (slot === 'dest') inputRef.current?.focus();
  };

  const skyScene = (__DEV__ && devSky !== 'auto')
    ? skyForImage(devSky, isDark)
    : skyFor(new Date().getHours(), isDark);
  const skyIcon = skyChromeTint(skyScene);

  const systemReduced = useReducedMotion();
  const keyboardUp = keyboardH > 0;
  const hideImportCards = !!query.trim() || hits.length > 0 || busy;
  useEffect(() => {
    onHorizonChrome?.({
      collapsed: keyboardUp,
      collapseDurationMs: keyboardDurMs,
      forceImage: __DEV__ && devSky !== 'auto' ? devSky : null,
    });
  }, [keyboardUp, keyboardDurMs, devSky, onHorizonChrome]);
  const passShown = useSharedValue(keyboardUp || hideImportCards ? 0 : 1);
  useEffect(() => {
    const to = keyboardUp || hideImportCards ? 0 : 1;
    if (systemReduced) {
      passShown.value = to;
      return;
    }
    passShown.value = withTiming(to, {
      duration: keyboardDurMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [keyboardUp, hideImportCards, keyboardDurMs, systemReduced, passShown]);
  const passStyle = useAnimatedStyle(() => ({
    opacity: passShown.value,
    transform: [{ translateY: (1 - passShown.value) * 12 }],
    maxHeight: passShown.value * 360,
    overflow: 'hidden' as const,
  }));

  const cycleDevSky = () => {
    if (!__DEV__) return;
    const i = DEV_SKY_CYCLE.indexOf(devSky);
    setDevSky(DEV_SKY_CYCLE[(i + 1) % DEV_SKY_CYCLE.length]);
    haptics.light();
  };

  const destAgainCity = lastDestIata
    ? getLocalizedCity(lastDestIata, getLocale(), lastDestLabel || lastDestIata)
    : '';

  const headlineExtras = useMemo(() => {
    if (!liveSnap) return [] as string[];
    const extras: string[] = [];
    const clock = searchDepartureClock(liveSnap.flight);
    const depMs = clock?.iso
      ? flightClockUtcMs(clock.iso, liveSnap.flight.origin, liveSnap.flight.originCountry)
      : null;
    const remain = depMs != null ? depMs - Date.now() : null;
    if (originChipIata && liveSnap.destIata && remain != null && remain > 0) {
      extras.push(copy.homeHeadlineRoute(originChipIata, liveSnap.destIata, formatDurationMs(remain)));
    }
    const num = formatFlightNumber(liveSnap.flight);
    if (num) extras.push(copy.homeHeadlineNextDep(num));
    return extras;
  }, [copy, liveSnap, originChipIata]);

  const liveLine = !query.trim() && !hits.length && liveSnap
    ? formatHomeLiveLine({
      hour,
      count: liveSnap.count,
      city: getLocalizedCity(
        originChipIata,
        getLocale(),
        airportRecByIata(originChipIata)?.city || homeAirport.city,
      ),
      dest: getLocalizedCity(liveSnap.destIata, getLocale(), liveSnap.destCity),
      time: liveSnap.time,
      today: copy.homeLiveToday,
      tonight: copy.homeLiveTonight,
      board: copy.homeLiveBoard,
      nextOnly: copy.homeLiveNextOnly,
    })
    : null;

  const onStubHit = (hit: ClipboardImportHit<ImportCandidate>) => {
    if (hit.kind === 'one') {
      setQuery(hit.query);
      void runLookup(hit.query, parseSmartQuery(hit.query, { now: new Date(), homeIata: homeAirport.iata }));
      return;
    }
    if (hit.kind === 'many') onPasteImport(hit.candidates);
  };

  const onStubMiss = () => {
    onPasteImport(undefined, { focusPaste: true });
  };

  const pickMin = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, [nowYmd]);
  const pickMax = useMemo(() => addLocalDays(pickMin, 7), [pickMin]);
  const pickValue = useMemo(() => {
    if (dateChoice.kind === 'ymd') {
      const m = dateChoice.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    }
    if (dateChoice.kind === 'tomorrow') return addLocalDays(pickMin, 1);
    return pickMin;
  }, [dateChoice, pickMin]);
  const pickChipOn = dateChoice.kind === 'ymd' || pickOpen;
  const pickChipLabel = dateChoice.kind === 'ymd'
    ? formatPickDateChip(dateChoice.date, getLocale())
    : `📅 ${copy.pickDate}`;
  const pickMaxYmd = toLocalDateString(pickMax);
  const pickMinYmd = toLocalDateString(pickMin);
  const pickCalColors = {
    text: c.text,
    muted: c.muted,
    accent: GOLD,
    card: c.card,
    border: GOLD_LIGHT,
  };
  const nativePick = nativeDatePickerAvailable();
  const androidNativePick = pickOpen && !askReturnDate && nativePick && Platform.OS === 'android';
  const pickModalOpen = pickOpen && !askReturnDate && !androidNativePick;

  const applyPickedYmd = (ymd: string) => {
    const today = toLocalDateString(new Date());
    const tomorrow = toLocalDateString(addLocalDays(new Date(), 1));
    chipTouched.current = true;
    if (ymd === today) setDateChoice({ kind: 'today' });
    else if (ymd === tomorrow) setDateChoice({ kind: 'tomorrow' });
    else setDateChoice({ kind: 'ymd', date: ymd });
    setPickOpen(false);
    setPickDraft(null);
  };

  const onPickDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (event.type === 'dismissed') {
      setPickOpen(false);
      setPickDraft(null);
      return;
    }
    if (!date) return;
    applyPickedYmd(toLocalDateString(date));
  };

  const openPickDate = () => {
    haptics.light();
    if (pickOpen) {
      setPickOpen(false);
      setPickDraft(null);
      return;
    }
    setPickDraft(pickValue);
    setPickOpen(true);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: reserveHorizon ? 'transparent' : c.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {reserveHorizon ? (
        <View style={{ height: horizonBandHeight(insets.top, 'search', keyboardUp) }} />
      ) : (
        <Horizon
          isDark={isDark}
          band="search"
          collapsed={keyboardUp}
          collapseDurationMs={keyboardDurMs}
          width={width}
          insetTop={insets.top}
          forceImage={__DEV__ && devSky !== 'auto' ? devSky : null}
        />
      )}
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
      <View style={[styles.mid, reserveHorizon ? { backgroundColor: c.bg } : null]}>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
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
        <HomeRotatingHeadline color={c.text} extras={headlineExtras} />

        {searchStyle === 'steps' ? (
          <View style={styles.stepBlock}>
            <Text style={[styles.stepLabel, { color: c.muted }]}>{copy.stepFrom}</Text>
            <Pressable
              onPress={() => {
                haptics.light();
                originLockSource.current = 'picker';
                setLockedOriginIata(originChipIata);
                setOriginLocked(true);
                onOpenAirportPicker();
              }}
              style={[styles.field, { backgroundColor: c.card }]}
              accessibilityRole="button"
              accessibilityLabel={copy.homeChipFrom(originChipIata)}
            >
              <Text style={[styles.input, { color: c.text, paddingVertical: 12 }]}>{originChipIata}</Text>
            </Pressable>
            <Text style={[styles.stepLabel, { color: c.muted }]}>{copy.stepTo}</Text>
            <View style={[styles.field, { backgroundColor: c.card }]}>
              <TextInput
                value={stepDest}
                onChangeText={(text) => {
                  setStepDest(text);
                  setQuery(text);
                }}
                placeholder={copy.whereTo}
                placeholderTextColor={c.muted}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                style={[styles.input, { color: c.text }]}
                accessibilityLabel={copy.stepTo}
                onSubmitEditing={() => {
                  if (timer.current) clearTimeout(timer.current);
                  void runLookup(query.trim(), parsed);
                }}
              />
            </View>
            <Text style={[styles.stepLabel, { color: c.muted }]}>{copy.stepDate}</Text>
          </View>
        ) : (
        <View style={[styles.field, { backgroundColor: c.card }]}>
          <MagnifyingGlass size={18} color={GOLD} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={(text) => {
              if (!text.trim()) {
                if (askReturnDate) {
                  setDateChoice({ kind: 'unset' });
                  setCalOpen(false);
                } else {
                  chipTouched.current = false;
                  setDateChoice({ kind: 'today' });
                }
                unlockOriginChip();
                setStepDest('');
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
        )}

        {showPopular && popularDests.length ? (
          <View style={styles.popularWrap}>
            <Text style={[styles.stepLabel, { color: c.muted }]}>{copy.popularDestinations}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.popularRow}
              keyboardShouldPersistTaps="handled"
            >
              {popularDests.map(d => (
                <Pressable
                  key={d.iata}
                  onPress={() => {
                    haptics.light();
                    setStepDest(d.iata);
                    setQuery(d.iata);
                    void trackSearchStarted({ raw: d.iata, placeMatched: true });
                  }}
                  style={[styles.popularChip, { backgroundColor: c.card, borderColor: GOLD_LIGHT }]}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.city} ${d.iata}`}
                >
                  <Text style={[styles.popularChipTxt, { color: GOLD }]}>{d.iata}</Text>
                  <Text style={[styles.popularChipCity, { color: c.muted }]} numberOfLines={1}>{d.city}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

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

        {welcomeBack && lastDestIata && (lastDestLabel || lastDestIata) && !query.trim() ? (
          <Pressable
            onPress={() => {
              haptics.light();
              setQuery(lastDestIata);
              void trackSearchStarted({ raw: lastDestIata, placeMatched: true });
            }}
            style={[styles.memoryChip, { backgroundColor: c.card }]}
            accessibilityRole="button"
            accessibilityLabel={copy.homeDestAgain(destAgainCity)}
          >
            <ClockCounterClockwise size={18} color={GOLD} weight="bold" />
            <Text style={[styles.memoryChipTxt, { color: GOLD }]} numberOfLines={1}>
              {copy.homeDestAgain(destAgainCity)}
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.chips}>
          {askReturnDate && returnYmds ? (
            <>
              {returnYmds.map(ymd => (
                <Chip
                  key={ymd}
                  label={labelReturnDateChip(ymd, nowYmd, {
                    today: copy.today,
                    tomorrow: copy.tomorrow,
                    homeRelativeInDays: copy.homeRelativeInDays,
                  })}
                  on={pickedYmd === ymd}
                  colors={c}
                  onPress={() => {
                    haptics.light();
                    chipTouched.current = true;
                    setDateChoice({ kind: 'ymd', date: ymd });
                    setCalOpen(false);
                  }}
                />
              ))}
              <Chip
                label={copy.homeChipPickADate}
                on={calOpen || (!!pickedYmd && !returnYmds.some(d => d === pickedYmd))}
                colors={c}
                onPress={() => {
                  haptics.light();
                  setCalOpen(open => !open);
                }}
              />
            </>
          ) : (
            <>
              <Chip
                label={copy.today}
                on={dateChoice.kind === 'today'}
                colors={c}
                onPress={() => {
                  haptics.light();
                  chipTouched.current = true;
                  setPickOpen(false);
                  setDateChoice({ kind: 'today' });
                }}
              />
              <Chip
                label={copy.tomorrow}
                on={dateChoice.kind === 'tomorrow'}
                colors={c}
                onPress={() => {
                  haptics.light();
                  chipTouched.current = true;
                  setPickOpen(false);
                  setDateChoice({ kind: 'tomorrow' });
                }}
              />
              <Chip
                label={pickChipLabel}
                on={pickChipOn}
                colors={c}
                onPress={openPickDate}
              />
              {parsed.needsDate ? (
                <Chip
                  label={copy.homeChipPickDate}
                  on
                  colors={c}
                  onPress={() => {
                    haptics.light();
                    chipTouched.current = true;
                    setDateChoice({ kind: 'today' });
                  }}
                />
              ) : null}
            </>
          )}
          {parsed.needsOrigin ? (
            <Chip
              label={copy.homeChipFromWhere}
              on
              colors={c}
              onPress={() => {
                haptics.light();
                originLockSource.current = 'picker';
                setLockedOriginIata(homeAirport.iata);
                setOriginLocked(true);
                onOpenAirportPicker();
              }}
            />
          ) : (
            <Chip
              label={copy.homeChipFrom(originChipIata)}
              on={originLocked}
              caret
              colors={c}
              onPress={() => {
                haptics.light();
                originLockSource.current = 'picker';
                setLockedOriginIata(originChipIata);
                setOriginLocked(true);
                onOpenAirportPicker();
              }}
            />
          )}
          {parsedBase.placeMode === 'choose' && parsedBase.destinations?.length ? (
            parsedBase.destinations.map(iata => (
              <Chip
                key={iata}
                label={destLabel(iata)}
                on={pickedHub === iata}
                colors={c}
                onPress={() => {
                  haptics.light();
                  if (parsedBase.needsDate && !askReturnDate) {
                    chipTouched.current = true;
                    setDateChoice({ kind: 'today' });
                  }
                  setPickedHub(iata);
                }}
              />
            ))
          ) : null}
        </View>

        {searchStyle === 'steps' && query.trim() ? (
          <Pressable
            onPress={() => {
              haptics.light();
              if (timer.current) clearTimeout(timer.current);
              void runLookup(query.trim(), parsed);
            }}
            style={[styles.stepSearchBtn, { backgroundColor: GOLD }]}
            accessibilityRole="button"
            accessibilityLabel={copy.stepSearch}
          >
            <Text style={styles.stepSearchTxt}>{copy.stepSearch}</Text>
          </Pressable>
        ) : null}

        <BookFlightButton label={copy.bookAFlight} />

        {liveLine && liveSnap ? (
          <Pressable
            onPress={() => {
              haptics.light();
              onSelectFlight({ ...liveSnap.flight });
            }}
            accessibilityRole="button"
            accessibilityLabel={liveLine}
          >
            <Text style={[styles.liveLine, { color: c.muted }]} numberOfLines={2}>{liveLine}</Text>
          </Pressable>
        ) : null}

        {askReturnDate && calOpen ? (
          <HomeDatePicker
            selectedYmd={pickedYmd || undefined}
            minYmd={calMinYmd}
            colors={c}
            onSelect={ymd => {
              haptics.light();
              chipTouched.current = true;
              setDateChoice({ kind: 'ymd', date: ymd });
              setCalOpen(false);
            }}
          />
        ) : null}

        {androidNativePick ? (
          <DateTimePicker
            value={pickDraft ?? pickValue}
            mode="date"
            display="default"
            minimumDate={pickMin}
            maximumDate={pickMax}
            onChange={onPickDateChange}
            accentColor={GOLD}
            locale={getLocale() === 'zh' ? 'zh-CN' : getLocale()}
          />
        ) : null}

        <Modal
          visible={pickModalOpen}
          transparent
          animationType="fade"
          onRequestClose={() => {
            setPickOpen(false);
            setPickDraft(null);
          }}
        >
          <View style={styles.pickBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => {
                setPickOpen(false);
                setPickDraft(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={copy.close}
            />
            <View style={[styles.pickSheet, { backgroundColor: c.card, borderColor: GOLD_LIGHT }]}>
              {nativePick ? (
                <>
                  <DateTimePicker
                    value={pickDraft ?? pickValue}
                    mode="date"
                    display="spinner"
                    minimumDate={pickMin}
                    maximumDate={pickMax}
                    onChange={(_event, date) => {
                      if (date) setPickDraft(date);
                    }}
                    accentColor={GOLD}
                    themeVariant={isDark ? 'dark' : 'light'}
                    locale={getLocale() === 'zh' ? 'zh-CN' : getLocale()}
                  />
                  <Pressable
                    onPress={() => {
                      haptics.light();
                      applyPickedYmd(toLocalDateString(pickDraft ?? pickValue));
                    }}
                    style={styles.pickDone}
                    accessibilityRole="button"
                    accessibilityLabel={copy.done}
                  >
                    <Text style={[styles.pickDoneTxt, { color: GOLD }]}>{copy.done}</Text>
                  </Pressable>
                </>
              ) : (
                <HomeDatePicker
                  selectedYmd={toLocalDateString(pickDraft ?? pickValue)}
                  minYmd={pickMinYmd}
                  maxYmd={pickMaxYmd}
                  colors={pickCalColors}
                  onSelect={ymd => {
                    haptics.light();
                    applyPickedYmd(ymd);
                  }}
                />
              )}
            </View>
          </View>
        </Modal>

        {parsed.ambiguous?.kind === 'place' && parsed.ambiguous.options[1] && !hits.length ? (
          <Text style={[styles.didYou, { color: c.muted }]}>
            {copy.homeDidYouMean(destLabel(parsed.ambiguous.options[1]))}
          </Text>
        ) : null}

        {busy && !hits.length ? (
          <ActivityIndicator style={{ marginTop: 16 }} color={GOLD} />
        ) : null}

        {lookedUp && !busy && lookupError ? (
          <Pressable
            onPress={() => {
              haptics.light();
              if (lookupError === 'quota') {
                quotaRef.current.onSearchQuotaReached?.();
                return;
              }
              void runLookup(query.trim(), parsed);
            }}
            accessibilityRole="button"
            accessibilityLabel={lookupError === 'quota' ? copy.searchQuotaTitle : copy.tryAgain}
            style={{ marginTop: 16 }}
          >
            <Text style={[styles.empty, { color: c.muted, marginTop: 0 }]}>
              {lookupError === 'quota'
                ? copy.searchQuotaTitle
                : lookupError === 'slow'
                ? copy.homeSearchSlow
                : lookupError === 'timeout'
                  ? `${copy.homeSearchTimeout} · ${copy.tryAgain}`
                  : lookupError === 'rateLimited'
                    ? (retryAfterMin ? copy.homeSearchRateLimited(retryAfterMin) : copy.rateLimit)
                    : copy.homeSearchFailed}
            </Text>
          </Pressable>
        ) : null}

        {lookedUp && !busy && !hits.length && !lookupError && parsed.flightNumber ? (
          <Text style={[styles.empty, { color: c.muted }]}>{copy.noFlightsFor(parsed.flightNumber)}</Text>
        ) : null}

        {lookedUp && !busy && !hits.length && !lookupError && !parsed.flightNumber && !connectionsBusy && !connections.length ? (
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
                          setDateChoice({ kind: 'tomorrow' });
                        }}
                        style={{ color: GOLD, fontWeight: '700' }}
                        accessibilityRole="button"
                        accessibilityLabel={copy.homeTodayTomorrowCta}
                      >
                        {copy.homeTodayTomorrowCta}
                      </Text>
                    </Text>
                  ) : null}
                  {[...upcoming, ...departed].slice(0, 12).map((f, i) => (
                    <View key={`${f.number}-${f.origin}-${f.destination}-${i}`} style={styles.resultItem}>
                      <ResultRow
                        flight={f}
                        colors={c}
                        today={ymdFromDate(new Date())}
                        departed={departed.includes(f)}
                        onPress={() => { haptics.light(); onSelectFlight(f); }}
                      />
                      {/* Flight-number search: Wallet pass for the next leg, right under its card (before tracking). */}
                      {parsed.flightNumber && f === upcoming[0] ? (
                        <AddToWalletButton flightNumber={f.number} isPro={isPro} isDark={isDark} mutedColor={c.muted} />
                      ) : null}
                    </View>
                  ))}
                </>
              );
            })()}
          </View>
        ) : null}

        {!hits.length && connectionsBusy ? (
          <Text style={[styles.empty, { color: c.muted }]}>{copy.connectionsSearching}</Text>
        ) : null}

        {!hits.length && connections.length ? (
          <View style={styles.results}>
            {connections.slice(0, 6).map(conn => (
              <View key={conn.id} style={styles.connection}>
                <Text style={[styles.connectionLabel, { color: GOLD }]}>{copy.oneStopVia(conn.hub)}</Text>
                <ResultRow
                  flight={conn.legs[0]}
                  colors={c}
                  today={ymdFromDate(new Date())}
                  departed={isDepartedSearchResult(conn.legs[0], Date.now())}
                  onPress={() => { haptics.light(); onSelectFlight(conn.legs[0]); }}
                />
                <Text style={[styles.layover, { color: c.muted }]}>
                  {copy.layoverDuration(formatDurationMs(conn.layoverMin * 60000))}
                </Text>
                <ResultRow
                  flight={conn.legs[1]}
                  colors={c}
                  today={ymdFromDate(new Date())}
                  departed={isDepartedSearchResult(conn.legs[1], Date.now())}
                  onPress={() => { haptics.light(); onSelectFlight(conn.legs[1]); }}
                />
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.breathe} />
      </ScrollView>
        {hideImportCards ? null : (
        <Animated.View
          style={[passStyle, { paddingBottom: insets.bottom + 8, paddingHorizontal: 24 }]}
          pointerEvents={keyboardUp ? 'none' : 'auto'}
          accessibilityElementsHidden={keyboardUp}
        >
          <BoardingPassCard
            label={copy.scanBoardingPass}
            onPress={() => { haptics.medium(); onScan(); }}
            isDark={isDark}
            holeColor={c.bg}
          />
          <BookingStub
            caption={copy.homePasteBookingStub}
            emptyHint={copy.homePasteClipboardEmpty}
            onHit={onStubHit}
            onMiss={onStubMiss}
            isDark={isDark}
            holeColor={c.bg}
          />
          <Text style={[styles.foot, { color: c.muted }]}>{copy.homeNoAccount}</Text>
        </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const HOME_HEADLINE_KEYS = [
  'homeHeadlineTrack',
  'homeHeadlineLanding',
  'homeHeadlineOnTime',
  'homeHeadlineGate',
] as const;
const HEADLINE_FADE_MS = 400;
const HEADLINE_HOLD_MS = 4000;

function HomeRotatingHeadline({ color, extras = [] }: { color: string; extras?: string[] }) {
  const copy = t();
  const headlines = useMemo(() => {
    const base = HOME_HEADLINE_KEYS.map(k => copy[k]);
    if (!extras.length) return base;
    const out: string[] = [];
    extras.forEach((line, i) => {
      if (base[i]) out.push(base[i]);
      out.push(line);
    });
    out.push(...base.slice(extras.length));
    return out;
  }, [copy, extras]);
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);
  const reduced = useReducedMotion();
  const skipFadeIn = useRef(true);
  const count = Math.max(1, headlines.length);

  const advance = useCallback(() => {
    setIndex(i => (i + 1) % count);
  }, [count]);

  useLayoutEffect(() => {
    if (skipFadeIn.current) {
      skipFadeIn.current = false;
      return;
    }
    if (reduced) {
      opacity.value = 1;
      return;
    }
    opacity.value = withTiming(1, {
      duration: HEADLINE_FADE_MS,
      easing: Easing.inOut(Easing.ease),
    });
  }, [index, opacity, reduced]);

  useEffect(() => {
    const id = setInterval(() => {
      if (reduced) {
        setIndex(i => (i + 1) % count);
        return;
      }
      opacity.value = withTiming(0, {
        duration: HEADLINE_FADE_MS,
        easing: Easing.inOut(Easing.ease),
      }, finished => {
        if (finished) runOnJS(advance)();
      });
    }, HEADLINE_HOLD_MS);
    return () => {
      clearInterval(id);
      cancelAnimation(opacity);
    };
  }, [advance, count, opacity, reduced]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View style={styles.headingWrap} accessibilityRole="header">
      <Animated.Text
        style={[styles.heading, { color }, fadeStyle]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {headlines[index % headlines.length]}
      </Animated.Text>
    </View>
  );
}

function BookFlightButton({ label }: { label: string }) {
  const reduced = useReducedMotion();
  const shimmerX = useSharedValue(-90);

  useEffect(() => {
    if (reduced) return;
    shimmerX.value = -90;
    shimmerX.value = withRepeat(
      withSequence(
        withTiming(280, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withDelay(2100, withTiming(-90, { duration: 0 })),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(shimmerX);
  }, [reduced, shimmerX]);

  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: shimmerX.value }] }));

  return (
    <Pressable
      onPress={() => {
        haptics.light();
        void Linking.openURL(aviasalesSearchHomeUrl()).catch(() => {});
      }}
      style={styles.bookFlightBtn}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {reduced ? null : (
        <Animated.View pointerEvents="none" style={[styles.bookFlightShimmer, shine]}>
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.45)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
      <Text style={styles.bookFlightIcon}>✈</Text>
      <Text style={styles.bookFlightTxt} numberOfLines={1}>{label}</Text>
    </Pressable>
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
  const fg = on ? NAVY : GOLD;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        on
          ? { borderColor: GOLD, backgroundColor: GOLD }
          : { borderColor: GOLD_LIGHT, backgroundColor: c.card },
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
  const stops = f.via?.length ? (f.via.length === 1 ? copy.oneStopVia(f.via[0]) : copy.nStops(f.via.length)) : '';
  const route = [from && to ? `${from} → ${to}` : (from || to), stops, f.legOf ? copy.flightLegOf(f.legOf.index, f.legOf.total) : '']
    .filter(Boolean)
    .join(' · ');
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

  let gateLine = '';
  let statusPill: { label: string; tone: ReturnType<typeof statusBadgeToneFromPhase> } | null = null;
  if (status.kind === 'cancelled') statusPill = { label: copy.cancelled, tone: statusBadgeToneFromPhase('cancelled') };
  else if (status.kind === 'diverted') statusPill = { label: copy.diverted, tone: statusBadgeToneFromPhase('diverted') };
  else if (status.kind === 'boarding') statusPill = { label: copy.boardingNow, tone: statusBadgeToneFromPhase('boarding') };
  else if (status.kind === 'gateClosed') statusPill = { label: copy.gateClosed, tone: statusBadgeToneFromPhase('gate-closed') };
  else if (status.kind === 'delayed') statusPill = { label: copy.delayed, tone: statusBadgeToneFromPhase('delayed') };
  else if (status.kind === 'enRoute') statusPill = { label: copy.inFlight, tone: statusBadgeToneFromPhase('in_flight') };
  else if (status.kind === 'landed') statusPill = { label: copy.landed, tone: statusBadgeToneFromPhase('landed') };
  else if (status.kind === 'scheduled') {
    statusPill = { label: copy.scheduled, tone: statusBadgeToneFromPhase('scheduled') };
    gateLine = status.gate ? copy.gate(status.gate) : '';
  }
  else if (status.kind === 'departed') {
    statusPill = { label: copy.departed, tone: statusBadgeToneFromPhase('departed') };
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
        {gateLine ? (
          <Text style={[styles.rowMeta, { color: metaColor }]} numberOfLines={1}>{gateLine}</Text>
        ) : null}
        {statusPill ? (
          <View style={styles.rowStatus}>
            <FlightStatusBadge label={statusPill.label} tone={statusPill.tone} />
          </View>
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
  mid: { flex: 1 },
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
  headingWrap: { minHeight: 34, marginBottom: 18, justifyContent: 'center' },
  heading: { fontSize: 28, fontWeight: '800', letterSpacing: -0.4, lineHeight: 34 },
  bookFlightBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 44,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: GOLD,
    marginBottom: 8,
    overflow: 'hidden',
  },
  bookFlightShimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 72,
  },
  bookFlightIcon: { fontSize: 15, color: NAVY, lineHeight: 18 },
  bookFlightTxt: {
    color: NAVY,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    minHeight: 52,
    borderColor: GOLD_LIGHT,
    shadowColor: GOLD,
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
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
  stepBlock: { gap: 6, marginTop: 4 },
  stepLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, marginTop: 6 },
  stepSearchBtn: {
    minHeight: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepSearchTxt: { color: '#0D1B2E', fontSize: 16, fontWeight: '800' },
  popularWrap: { marginTop: 4, marginBottom: 4 },
  popularRow: { gap: 8, paddingVertical: 8, paddingRight: 16 },
  popularChip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 44,
    justifyContent: 'center',
  },
  popularChipTxt: { fontSize: 13, fontWeight: '800' },
  popularChipCity: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  memoryChip: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
    borderColor: GOLD_LIGHT,
  },
  memoryChipTxt: { fontSize: 15, fontWeight: '700', flexShrink: 1 },
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
  pickBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(13,27,46,0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pickSheet: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  pickDone: {
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  pickDoneTxt: { fontSize: 16, fontWeight: '700' },
  liveLine: { fontSize: 13, fontWeight: '500', lineHeight: 18, paddingBottom: 4 },
  didYou: { fontSize: 13, marginBottom: 8 },
  results: { gap: 8, marginBottom: 8 },
  resultItem: { gap: 8 },
  connection: { gap: 6, marginBottom: 10 },
  connectionLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4 },
  layover: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
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
  rowStatus: { marginTop: 6, alignSelf: 'flex-start' },
  rowStruck: { fontSize: 11, marginTop: 2, fontWeight: '600', textDecorationLine: 'line-through' },
  rowAlso: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  empty: { fontSize: 14, lineHeight: 20, marginTop: 16 },
  breathe: { flexGrow: 1, minHeight: 8 },
  foot: { marginTop: 16, paddingTop: 8, textAlign: 'center', fontSize: 12 },
});
