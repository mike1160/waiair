import ModeSwitcher from '../components/ModeSwitcher';
import { useIsAirport, useIsArctic, useIsBlackout, useIsVapor, useMode } from '../lib/modeContext';
import { KidsTrackedBand } from '../components/kids/KidsHome';
import { AIRPORT_BOARD, ARCTIC, BLACKOUT, MONO } from '../lib/themes';
import { squareStyles } from '../lib/squareStyles';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActionSheetIOS, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AirplaneLanding,
  Armchair,
  CloudSun,
  EnvelopeSimple,
  Gear,
  IdentificationCard,
  MinusCircle,
  Plus,
  Sun,
  Taxi,
  Warning,
  Wind,
} from 'phosphor-react-native';
import AirlineLogo, { AIRLINE_LOGO_SIZE, airlineCodeFromFlight } from '../AirlineLogo';
import AddToWalletButton from '../components/AddToWalletButton';
import CalendarExportButton from '../components/CalendarExportButton';
import WalletStaleBanner from '../components/WalletStaleBanner';
import { FlightNumberText } from '../components/FlightNumberText';
import HomeNowCard from '../components/HomeNowCard';
import FlightAssistantHub, { type HubFx, type HubStopover } from '../components/FlightAssistantHub';
import { arrivalMs, getFlightPhase, hasKnownDeparture, hotelSuggestionFor, type FlightPhase, type PreviousLeg } from '../lib/flightPhase';
import { fetchFxSnapshot, fetchWeatherSnapshot, type WeatherSnapshot } from '../lib/destinationServices';
import { gmailBadgeFor, type GmailSyncStatus, type WaitingBooking } from '../lib/gmailSyncStatus';
import FlightStatusBadge, { statusBadgeToneFromPhase } from '../FlightStatusBadge';
import { airportRecByIata } from '../lib/airportsDb';
import { normalizeAirlineName } from '../lib/airlineDisplay';
import { getLocalizedCity } from '../lib/cityLocalized';
import { formatFlightNumber } from '../lib/flightIdent';
import {
  flightClockUtcMs,
  flightProgressPct,
  resolveArrivalIso,
  resolveDepartureIso,
} from '../lib/flightTimes';
import {
  HOME_CONFIRM_MS,
  homeConfirmShowChip,
  homeConfirmSlideCards,
  type HomeConfirmState,
} from '../lib/homeConfirm';
import { haptics } from '../lib/haptics';
import { horizonBandHeight } from '../lib/horizon';
import {
  formatHomeNowLine,
  homeCardTimes,
  homeFlightDurationMs,
  homeModulesForPhase,
  homeNowCardChip,
  homeNowOverlayStatus,
  homeRelativeDayOffset,
  isHomeNowLandedOrLater,
  isInternationalFlight,
  resolveHomeNow,
  type HomeCardClockPart,
  type HomeNowFlight,
  type HomeNowPhase,
} from '../lib/homeNow';
import { nowCardLines } from '../lib/nowPhaseLines';
import { taxiMinutes } from '../lib/destinationServices';
import { homeTripTitle } from '../lib/homeTripTitle';
import TripTitleText from '../components/TripTitleText';
import { flightStatusLabel, getLocale, t } from '../lib/i18n';
import { getPrefs } from '../lib/prefs';
import type { ModuleId } from '../lib/modules';
import { homeChrome, skyFor } from '../lib/themeTokens';
import { inWalletWindow } from '../lib/walletButton';
import FlightOverviewProgressBar from '../components/FlightOverviewProgressBar';
import {
  overviewBarPct,
  remainingMinutesTo,
  shouldShowOverviewProgress,
} from '../lib/flightOverviewProgress';
import { tripName, type TripNameFlight } from '../lib/tripName';
import { groupTrips, type TripFlight } from '../lib/tripOrchestrator';
import { openMapsQuery, type TripExtras } from '../lib/tripExtras';

type Colors = {
  bg: string;
  text: string;
  muted: string;
  accent: string;
  card: string;
  border: string;
  secondary: string;
};

export type HomeTrackedFlight = HomeNowFlight & {
  id: string;
  number: string;
  /** The tracked key, so the home list can be grouped into trips (lib/tripOrchestrator.ts). */
  trackKey?: string;
  /** The bookings on this leg, used to show what sits between two flights of one trip. */
  tripExtras?: TripExtras;
  airline?: string;
  airlineCode?: string;
  origin: string;
  destination: string;
  destCity?: string;
  /** Arrival terminal, for the baggage line after landing. */
  arrTerminal?: string;
  hasBoardingPass?: boolean;
  /** "Are you boarding in X?" for a multi-leg number added from outside the user's trips (lib/boardingSegment.ts). */
  boardingPrompt?: { routeOrigin: string; boardIata: string } | null;
};

type Props = {
  flights: HomeTrackedFlight[];
  colors: Colors;
  timeFormat12h?: boolean;
  confirmPhase?: HomeConfirmState;
  returnChipCity?: string | null;
  onReturnChip?: () => void;
  onOpenFlight: (flight: HomeTrackedFlight, module?: ModuleId | 'eu261') => void;
  onAddAnother: () => void;
  onOpenSettings: () => void;
  /** Short confirmations: what the calendar export did. */
  onToast?: (msg: string) => void;
  /** Rescan Gmail from My Flights; shown only with a connected Gmail, so Settings is not the only way in. */
  gmailConnected?: boolean;
  onGmailScan?: () => void;
  /**
   * What the envelope wears [J/5]: how many travel mails still want an answer, or a dot once none do.
   * Preferred over the last scan's own count — the inbox knows what is left, not just what was found.
   */
  inboxBadge?: { kind: 'count'; n: number } | { kind: 'dot' } | null;
  onUntrack: (flight: HomeTrackedFlight) => void;
  isDark?: boolean;
  /** Pro: Wallet passes get push updates. */
  isPro?: boolean;
  /** Answer to the boarding prompt on a card: true = boards at the suggested airport. */
  onBoardingAnswer?: (flight: HomeTrackedFlight, boardHere: boolean) => void;
  /** Travel assistant (components/FlightAssistantHub.tsx): the last Gmail scan and the bookings waiting for a trip. */
  gmailStatus?: GmailSyncStatus | null;
  gmailWaiting?: WaitingBooking[];
  /** Family share sheet for this flight, from the hub's "Share your trip" and "Someone picking you up?". */
  onShareTrip?: (flight: HomeTrackedFlight) => void;
  /** Link a waiting hotel from the mail to this flight's trip. */
  onLinkHotel?: (flight: HomeTrackedFlight, messageId: string) => void;
};

function formatDuration(ms: number | null): string {
  if (ms == null || !(ms > 0)) return '';
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function moduleLabel(id: ModuleId): string {
  const copy = t();
  switch (id) {
    case 'weather': return copy.homeModuleWeather;
    case 'transport': return copy.homeModuleTransport;
    case 'lounge': return copy.homeModuleLounge;
    case 'inbound_tracking': return copy.homeModuleInbound;
    case 'connection_risk': return copy.homeModuleConnection;
    case 'immigration': return copy.homeModuleImmigration;
    case 'turbulence': return copy.homeModuleTurbulence;
    case 'morning_briefing': return copy.homeModuleMorning;
    default: return id;
  }
}

function ModuleIcon({ id, color }: { id: ModuleId; color: string }) {
  const props = { size: 16, color, weight: 'bold' as const };
  switch (id) {
    case 'weather': return <CloudSun {...props} />;
    case 'transport': return <Taxi {...props} />;
    case 'lounge': return <Armchair {...props} />;
    case 'inbound_tracking': return <AirplaneLanding {...props} />;
    case 'connection_risk': return <Warning {...props} />;
    case 'immigration': return <IdentificationCard {...props} />;
    case 'turbulence': return <Wind {...props} />;
    case 'morning_briefing': return <Sun {...props} />;
    default: return <Sun {...props} />;
  }
}

/** Departure (UTC ms) of a tracked flight, for the Wallet button window. */
function departureMsOf(f: HomeTrackedFlight): number | null {
  return flightClockUtcMs(resolveDepartureIso(f), f.origin, f.originCountry);
}

function liveTone(phase: HomeNowPhase, overlay: string) {
  return statusBadgeToneFromPhase(overlay || phase, { delayed: overlay === 'delayed' });
}


/** One leg as the grouper wants it, with the card data it came from kept alongside. */
type GroupLeg = TripFlight & { home: HomeTrackedFlight };

/** What the list draws after the primary card: the other legs, their trip headers, and the bookings between. */
type HomeRow =
  /** The trip's own name, above the first date header of a journey of several flights. */
  | { kind: 'tripName'; key: string; name: string }
  | { kind: 'header'; key: string; name: string; range: string }
  | { kind: 'flight'; key: string; f: HomeTrackedFlight }
  | { kind: 'extra'; key: string; item: ExtraCardItem };

/** A booking that sits between two flights of the same trip. */
type ExtraCardItem = {
  key: string;
  icon: string;
  title: string;
  sub: string;
  /** When it happens, so the cards sit in the order you live them rather than alphabetically. */
  atMs: number;
  /** Somewhere to open in maps; without one the card is not tappable. */
  place?: string;
};

/** True when the ISO carries a time of day, not just a calendar date. */
function hasClock(iso?: string): boolean {
  return /\d{2}:\d{2}/.test(String(iso || ''));
}

function msOfIso(iso?: string): number | null {
  const t = Date.parse(String(iso || ''));
  return Number.isFinite(t) ? t : null;
}

function legMs(f: HomeTrackedFlight): { dep: number | null; arr: number | null } {
  return {
    dep: msOfIso(resolveDepartureIso(f) || f.scheduledTime),
    arr: msOfIso(resolveArrivalIso(f)),
  };
}

function shortDay(ms: number | null, locale: string): string {
  if (ms == null) return '';
  try {
    return new Date(ms).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  } catch {
    return new Date(ms).toISOString().slice(0, 10);
  }
}

/**
 * The name of a trip, from the flights in it. Only for a journey of several flights: a single flight already
 * has its own date-and-city header, and repeating it above itself says nothing.
 */
function groupTripName(
  legs: { home: HomeTrackedFlight }[],
  locale: ReturnType<typeof getLocale>,
  copy: ReturnType<typeof t>,
): string {
  if (!legs || legs.length < 2) return '';
  const flights: TripNameFlight[] = legs.map(({ home }) => ({
    origin: home.origin,
    destination: home.destination,
    departureIso: resolveDepartureIso(home) || home.scheduledTime,
    destCity: home.destCity,
  }));
  return tripName(flights, {
    locale,
    copy: {
      to: (destination, date) => copy.tripNameTo(destination, date),
      roundtrip: (destination, from, to) => copy.tripNameRoundtrip(destination, from, to),
      multi: (origin, destination, date) => copy.tripNameMulti(origin, destination, date),
    },
    // The same city names the date header uses, so the two lines cannot disagree about where you are going.
    cityFor: (iata, fallback) => getLocalizedCity(iata, locale, fallback),
  });
}

/**
 * Overview header of one flight: "[City] · [weekday] [day] [month]" of its departure — the boarding leg once confirmed,
 * as the tracked flight is re-based onto it. Keyed by date + destination, so flights on different days never share one.
 */
function dayHeader(f: HomeTrackedFlight, locale: ReturnType<typeof getLocale>): { key: string; label: string } {
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(resolveDepartureIso(f) || f.scheduledTime || '').trim());
  const dest = String(f.destination || '').toUpperCase();
  const city = getLocalizedCity(dest, locale, airportRecByIata(dest)?.city || f.destCity || dest);
  let day = '';
  if (ymd) {
    try {
      day = new Date(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3]), 12)
        .toLocaleDateString(locale === 'zh' ? 'zh-CN' : locale, { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      day = ymd[0];
    }
  }
  return { key: `${ymd?.[0] || ''}|${dest}`, label: day ? `${city} · ${day}` : city };
}

function clockLabel(ms: number | null, locale: string, hour12: boolean): string {
  if (ms == null) return '';
  try {
    return new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', hour12 });
  } catch {
    return '';
  }
}

/**
 * The bookings whose own moment falls between one flight landing and the next taking off. A booking with no
 * time of its own cannot be placed, so it is left out here rather than guessed into the wrong gap.
 */
function extrasBetween(
  extras: TripExtras | undefined,
  fromMs: number | null,
  toMs: number | null,
  locale: string,
  hour12: boolean,
): ExtraCardItem[] {
  if (!extras || fromMs == null || toMs == null || !(toMs > fromMs)) return [];
  const out: ExtraCardItem[] = [];
  const within = (iso?: string): number | null => {
    const ms = msOfIso(iso);
    return ms != null && ms >= fromMs && ms <= toMs ? ms : null;
  };
  /**
   * A check-in parsed from "2026-10-15" has no time in it, only a date. Rendering that as a clock invents a
   * 07:00 the booking never mentioned, so a date-only value shows the day and nothing more.
   */
  const when = (iso: string | undefined, ms: number | null): string => {
    const day = shortDay(ms, locale);
    if (!hasClock(iso)) return day;
    return [day, clockLabel(ms, locale, hour12)].filter(Boolean).join(' · ');
  };

  const hotelMs = within(extras.hotel?.checkIn);
  if (hotelMs != null) {
    const h = extras.hotel;
    out.push({
      key: 'hotel',
      icon: '🏨',
      title: h?.name || '',
      sub: [when(h?.checkIn, hotelMs), h?.address].filter(Boolean).join(' · '),
      atMs: hotelMs,
      place: h?.address || h?.name,
    });
  }
  const carMs = within(extras.carRental?.pickupTime);
  if (carMs != null) {
    const car = extras.carRental;
    out.push({
      key: 'carRental',
      icon: '🚗',
      title: car?.company || '',
      sub: [when(car?.pickupTime, carMs), car?.pickupLocation].filter(Boolean).join(' · '),
      atMs: carMs,
      place: car?.pickupLocation,
    });
  }
  const excMs = within(extras.excursion?.dateTime);
  if (excMs != null) {
    const e = extras.excursion;
    out.push({
      key: 'excursion',
      icon: '🎟️',
      title: e?.name || e?.operator || '',
      sub: [when(e?.dateTime, excMs), e?.pickupLocation].filter(Boolean).join(' · '),
      atMs: excMs,
      place: e?.pickupLocation,
    });
  }
  const restMs = within(extras.restaurant?.dateTime);
  if (restMs != null) {
    const r = extras.restaurant;
    out.push({
      key: 'restaurant',
      icon: '🍽️',
      title: r?.name || '',
      sub: [when(r?.dateTime, restMs), r?.partySize ? `${r.partySize}` : '', r?.address].filter(Boolean).join(' · '),
      atMs: restMs,
      place: r?.address || r?.name,
    });
  }
  // Chronological: the cards between two flights are read as the order of the days, not as a list of kinds.
  return out.filter(i => i.title || i.sub).sort((a, b) => a.atMs - b.atMs || a.key.localeCompare(b.key));
}

/** A booking between two flights. Same card language as the flight cards, with the category as the accent. */
function TripExtraCard({
  item,
  colors: c,
}: {
  item: ExtraCardItem;
  colors: Colors;
}) {
  const body = (
    <View style={[styles.extraCard, { backgroundColor: c.card, borderColor: c.border }]}>
      <Text style={styles.extraIcon}>{item.icon}</Text>
      <View style={styles.extraText}>
        {item.title ? (
          <Text style={[styles.extraTitle, { color: c.text }]} numberOfLines={1}>{item.title}</Text>
        ) : null}
        {item.sub ? (
          <Text style={[styles.extraSub, { color: c.secondary }]} numberOfLines={1}>{item.sub}</Text>
        ) : null}
      </View>
    </View>
  );
  if (!item.place) return body;
  return (
    <Pressable
      onPress={() => { haptics.light(); void openMapsQuery(item.place as string); }}
      accessibilityRole="button"
      accessibilityLabel={[item.title, item.sub].filter(Boolean).join(', ')}
    >
      {body}
    </Pressable>
  );
}

/** Purely visual: the date + destination above a flight card (dayHeader). No chevron, nothing to tap. */
function TripGroupHeader({
  name,
  range,
  colors: c,
}: {
  name: string;
  range: string;
  colors: Colors;
}) {
  return (
    <View style={styles.groupHead} accessibilityRole="header">
      <Text style={[styles.groupName, { color: c.text }]} numberOfLines={1}>{name}</Text>
      {range ? <Text style={[styles.groupRange, { color: c.secondary }]}>{range}</Text> : null}
    </View>
  );
}


/**
 * Blackout mode's line for the flight, in place of the usual now-card copy. Gate first when it is known —
 * that is the one thing worth acting on — then the phase. Null when nothing definite can be said, so the
 * ordinary copy stands rather than inventing a slogan.
 */
type FocusVoice = 'blackout' | 'vapor' | 'arctic';

/**
 * The six lines a focus mode can speak. Picking the set up front keeps the logic below voice-agnostic:
 * a fourth mode is a row here, not another branch in every line.
 */
function focusVoiceCopy(voice: FocusVoice) {
  const copy = t();
  if (voice === 'vapor') {
    return {
      cancelled: copy.vaporCancelled, landed: copy.vaporLanded, onTime: copy.vaporOnTime,
      boarding: copy.vaporBoarding, delay: copy.vaporDelay, gate: copy.vaporGate,
    };
  }
  if (voice === 'arctic') {
    return {
      cancelled: copy.arcticCancelled, landed: copy.arcticLanded, onTime: copy.arcticOnTime,
      boarding: copy.arcticBoarding, delay: copy.arcticDelay, gate: copy.arcticGate,
    };
  }
  return {
    cancelled: copy.blackoutCancelled, landed: copy.blackoutLanded, onTime: copy.blackoutOnTime,
    boarding: copy.blackoutBoarding, delay: copy.blackoutDelay, gate: copy.blackoutGate,
  };
}

function focusStatusLine(
  voice: FocusVoice,
  flight: HomeTrackedFlight | undefined,
  phase: HomeNowPhase | null | undefined,
): string | null {
  if (!flight) return null;
  const v = focusVoiceCopy(voice);
  const status = String(flight.status || '').toLowerCase();
  if (status === 'cancelled') return v.cancelled;
  if (status === 'landed' || (phase != null && isHomeNowLandedOrLater(phase))) return v.landed;
  const gate = String(flight.gate || '').trim();
  if (phase === 'boarding') {
    const dep = flightClockUtcMs(resolveDepartureIso(flight), flight.origin, flight.originCountry);
    const min = dep == null ? null : Math.max(0, Math.round((dep - Date.now()) / 60_000));
    return min == null ? v.onTime : v.boarding(min);
  }
  // There is no delay field on the card's flight, so it comes from the clocks: revised against scheduled.
  const sched = Date.parse(String(flight.scheduledTime || flight.scheduledDeparture || ''));
  const revised = Date.parse(String(flight.revisedTime || flight.estimatedDeparture || ''));
  const delay = Number.isFinite(sched) && Number.isFinite(revised)
    ? Math.round((revised - sched) / 60_000)
    : 0;
  if (delay > 0) return v.delay(delay);
  if (gate) return v.gate(gate);
  if (status === 'scheduled' || status === 'en-route' || !status) return v.onTime;
  return null;
}

/** Opens a music app. No playlist, no artist — the app and nothing more. */
function enterTheZone(): void {
  const open = (deep: string, web: string) => {
    Linking.openURL(deep).catch(() => { void Linking.openURL(web).catch(() => {}); });
  };
  const spotify = () => open('spotify://', 'https://open.spotify.com');
  const apple = () => open('music://', 'https://music.apple.com');
  if (Platform.OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      { options: ['Spotify', 'Apple Music', t().cancel], cancelButtonIndex: 2, userInterfaceStyle: 'dark' },
      i => { if (i === 0) spotify(); else if (i === 1) apple(); },
    );
    return;
  }
  Alert.alert(t().blackoutEnterZone, undefined, [
    { text: 'Spotify', onPress: spotify },
    { text: 'Apple Music', onPress: apple },
    { text: t().cancel, style: 'cancel' },
  ]);
}

/** Both kinds of badge carry a number; the scan's calls it `found`, the inbox's calls it `n`. */
function badgeCount(badge: { kind: 'count'; found?: number; n?: number }): number {
  return Number(badge.n ?? badge.found ?? 0);
}

export default function HomeTrackedScreen({
  flights,
  colors: c,
  timeFormat12h = false,
  confirmPhase = 'idle',
  returnChipCity,
  onReturnChip,
  onOpenFlight,
  onAddAnother,
  onOpenSettings,
  onToast,
  gmailConnected = false,
  onGmailScan,
  inboxBadge: inboxBadgeProp,
  onUntrack,
  isDark = false,
  isPro = false,
  onBoardingAnswer,
  gmailStatus = null,
  gmailWaiting,
  onShareTrip,
  onLinkHotel,
}: Props) {
  const insets = useSafeAreaInsets();
  // Airport mode: no rounded corners.
  const { mode, C: modeC } = useMode();
  const blackout = useIsBlackout();
  const vapor = useIsVapor();
  const arctic = useIsArctic();
  /** Blackout, vapor and arctic all strip the screen back and speak in their own voice. */
  const focusMode = blackout || vapor || arctic;
  const st = useMemo(() => (mode === 'airport' ? squareStyles(styles) : styles), [mode]);
  const copy = t();
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const [gmailTip, setGmailTip] = useState(false);
  const slide = homeConfirmSlideCards(confirmPhase, reduced);
  const intro = useSharedValue(slide ? 0 : 1);
  const chipOp = useSharedValue(homeConfirmShowChip(confirmPhase, reduced) ? 1 : 0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!gmailTip) return undefined;
    const id = setTimeout(() => setGmailTip(false), 2200);
    return () => clearTimeout(id);
  }, [gmailTip]);

  useEffect(() => {
    if (slide) {
      intro.value = 0;
      intro.value = withTiming(1, {
        duration: HOME_CONFIRM_MS.mounted,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      intro.value = 1;
    }
  }, [slide, intro]);

  useEffect(() => {
    const to = homeConfirmShowChip(confirmPhase, reduced) ? 1 : 0;
    if (reduced) {
      chipOp.value = to;
      return;
    }
    chipOp.value = withTiming(to, { duration: to ? HOME_CONFIRM_MS.chip : 0 });
  }, [confirmPhase, reduced, chipOp]);

  const introStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [{ translateY: (1 - intro.value) * 28 }],
  }));
  const chipStyle = useAnimatedStyle(() => ({
    opacity: chipOp.value,
  }));

  const primary = flights[0];
  const primaryKey = primary ? (primary.trackKey || primary.id || primary.number) : '';
  /**
   * Trip grouping is display only (lib/tripOrchestrator.ts): it never changes what is tracked, and a flight
   * that meets no other is a group of one, which is drawn exactly as it always was.
   */
  const groups = useMemo(
    () => groupTrips<GroupLeg>(flights.map(f => ({
      key: f.trackKey || f.id || f.number,
      scheduledTime: f.scheduledTime,
      tripExtras: f.tripExtras,
      flight: f,
      home: f,
    }))),
    [flights],
  );
  const leaveOpts = useMemo(() => ({
    tight: getPrefs().airportTiming === 'tight',
    boardingPass: !!primary?.hasBoardingPass,
    travelMin: primary ? taxiMinutes(primary.origin) : null,
  }), [primary, now]);
  // The language is a dependency: these hold translated lines, and t() changes without a re-mount.
  const locale = getLocale();
  /** The name of the journey the primary card belongs to; '' when it flies alone. */
  const primaryTripName = useMemo(() => {
    const own = groups.find(g => g.flights.some(l => l.key === primaryKey));
    return own ? groupTripName(own.flights, locale, copy) : '';
  }, [groups, primaryKey, locale, copy]);

  const rows = useMemo<HomeRow[]>(() => {
    const out: HomeRow[] = [];
    // The trip the primary card belongs to comes first; its header already sits above that card.
    const ordered = [
      ...groups.filter(g => g.flights.some(l => l.key === primaryKey)),
      ...groups.filter(g => !g.flights.some(l => l.key === primaryKey)),
    ];
    // Every card sits under its own date + destination header; the next card shares it only on the same day and city.
    let lastHeader = primary ? dayHeader(primary, locale).key : '';
    for (const g of ordered) {
      const name = groupTripName(g.flights, locale, copy);
      /*
       * The primary card's own trip already has its name printed above it, outside this list. Without this
       * the name appeared a second time above the next leg of the very same journey.
       */
      let named = g.flights.some(l => l.key === primaryKey);
      g.flights.forEach((item, i) => {
        if (item.key !== primaryKey) {
          const head = dayHeader(item.home, locale);
          if (head.key !== lastHeader) {
            // The trip's name once, above the first card of the journey that carries it.
            if (name && !named) {
              out.push({ kind: 'tripName', key: `t:${g.key}`, name });
              named = true;
            }
            out.push({ kind: 'header', key: `h:${item.key}`, name: head.label, range: '' });
            lastHeader = head.key;
          }
          out.push({ kind: 'flight', key: `f:${item.key}`, f: item.home });
        }
        const next = g.flights[i + 1];
        if (!next) return;
        const from = legMs(item.home);
        const to = legMs(next.home);
        for (const extra of extrasBetween(g.extras, from.arr ?? from.dep, to.dep, locale, timeFormat12h)) {
          out.push({ kind: 'extra', key: `e:${g.key}:${item.key}:${extra.key}`, item: extra });
        }
      });
    }
    return out;
  }, [groups, primary, primaryKey, locale, timeFormat12h, copy]);
  const resolved = useMemo(
    () => (primary ? resolveHomeNow(primary, now, timeFormat12h, leaveOpts) : null),
    [primary, now, timeFormat12h, leaveOpts, locale],
  );
  const nowLine = resolved
    ? formatHomeNowLine(resolved, {
      homeNowCheckin: copy.homeNowCheckin,
      homeNowLeave: copy.homeNowLeave,
      homeNowLeaveAround: copy.homeNowLeaveAround,
      homeNowAtAirport: copy.homeNowAtAirport,
      homeNowGate: copy.homeNowGate,
      homeNowGoToGate: copy.homeNowGoToGate,
      homeNowBoarding: copy.homeNowBoarding,
      homeNowLastCall: copy.homeNowLastCall,
      homeNowLandsIn: copy.homeNowLandsIn,
      homeNowBelt: copy.homeNowBelt,
      homeNowTransport: copy.homeNowTransport,
      homeGoodTrip: copy.homeGoodTrip,
      gateTbdShort: copy.gateTbdShort,
      homeNowCancelledOptions: copy.homeNowCancelledOptions,
      homeNowCancelledAirline: copy.homeNowCancelledAirline,
      homeNowDivertedOptions: copy.homeNowDivertedOptions,
      homeNowDivertedAirline: copy.homeNowDivertedAirline,
    })
    : '';
  const cancelledOverride = !!resolved?.override;
  const modules = resolved
    ? homeModulesForPhase(resolved.phase, {
      international: isInternationalFlight(primary),
      cancelled: cancelledOverride,
    })
    : [];
  const depIso = primary ? resolveDepartureIso(primary) : '';
  const depMs = primary
    ? flightClockUtcMs(depIso, primary.origin, primary.originCountry)
    : null;
  /**
   * Now card message from the time left until departure (lib/nowPhase.ts); the 30s ticker keeps it current.
   * A cancellation or diversion keeps its own line — that matters more than the phase.
   */
  const nowPhaseCard = useMemo(() => {
    if (!primary || !resolved || resolved.override) return null;
    return nowCardLines({
      minutesToDeparture: depMs == null ? null : Math.round((depMs - now) / 60_000),
      calendarDays: depMs == null ? null : homeRelativeDayOffset(depMs, now, primary.origin, primary.originCountry),
      boarding: resolved.phase === 'boarding',
      departed: resolved.phase === 'in_flight',
      landed: isHomeNowLandedOrLater(resolved.phase),
      landsIn: resolved.landsIn,
      city: primary.destCity,
      terminal: primary.arrTerminal,
    });
  }, [primary, resolved, depMs, now, locale]);
  /**
   * Travel assistant (components/FlightAssistantHub.tsx) for the next flight. The phase comes from
   * lib/flightPhase.ts; a stopover needs the leg flown just before, landed at this flight's origin.
   */
  const previousLeg = useMemo((): { leg: PreviousLeg; city?: string } | null => {
    if (!primary) return null;
    const origin = String(primary.origin || '').toUpperCase();
    let best: { leg: PreviousLeg; city?: string } | null = null;
    for (const f of flights) {
      if (f === primary || String(f.destination || '').toUpperCase() !== origin) continue;
      const arr = f.landedAtMs != null && Number.isFinite(f.landedAtMs) ? f.landedAtMs : arrivalMs(f);
      if (arr == null || arr > now) continue;
      const landed = isHomeNowLandedOrLater(resolveHomeNow(f, now, timeFormat12h).phase);
      if (!best || (best.leg.arrMs ?? 0) < arr) best = { leg: { destination: f.destination, landed, arrMs: arr }, city: f.destCity };
    }
    return best;
  }, [flights, primary, now, timeFormat12h]);
  // No known departure (a flight tracked from an arrivals board): no phase, so the old card renders instead.
  const hubPhase = useMemo(
    (): FlightPhase | null => (primary && hasKnownDeparture(primary) ? getFlightPhase(primary, now, previousLeg?.leg) : null),
    [primary, now, previousLeg],
  );
  const hubKey = primary && hubPhase ? `${primary.id}|${hubPhase}` : '';
  const hubStopover: HubStopover | null = hubPhase === 'STOPOVER' && primary && depMs != null
    ? { city: previousLeg?.city || primary.origin, nextNumber: primary.number, msLeft: depMs - now, depGate: primary.gate }
    : null;
  const hubHotel = primary && (hubPhase === 'PRACTICAL' || hubPhase === 'FINAL')
    ? hotelSuggestionFor(gmailWaiting || [], String(resolveArrivalIso(primary) || '').slice(0, 10) || null)
    : null;
  /** The same status the card above shows, so the two never disagree on departure day. */
  const hubStatus = primary && resolved
    ? (() => {
      const overlay = homeNowOverlayStatus(resolved.phase, primary.status);
      const label = overlay === 'en-route' ? copy.inFlight : (flightStatusLabel(overlay) || overlay);
      return label ? { label, tone: liveTone(resolved.phase, overlay) } : null;
    })()
    : null;

  /** Weather for the hub: the departure airport around departure, the destination around arrival. */
  const [hubWeather, setHubWeather] = useState<{ key: string; origin: WeatherSnapshot | null; dest: WeatherSnapshot | null } | null>(null);
  useEffect(() => {
    if (!primary || !hubPhase || !hubKey) return undefined;
    const wantOrigin = hubPhase === 'EVE' || hubPhase === 'DEPARTURE';
    const wantDest = hubPhase === 'FINAL' || hubPhase === 'INFLIGHT' || hubPhase === 'ARRIVED';
    if (!wantOrigin && !wantDest) return undefined;
    let alive = true;
    const at = (iata: string, city: string | undefined, whenIso: string | undefined, country?: string) => {
      const rec = airportRecByIata(iata);
      if (!rec) return Promise.resolve(null);
      return fetchWeatherSnapshot(rec.lat, rec.lon, city || rec.city, whenIso, iata, country).catch(() => null);
    };
    void Promise.all([
      wantOrigin ? at(primary.origin, undefined, resolveDepartureIso(primary) || undefined, primary.originCountry) : Promise.resolve(null),
      wantDest ? at(primary.destination, primary.destCity, resolveArrivalIso(primary) || undefined, primary.destCountry) : Promise.resolve(null),
    ]).then(([origin, dest]) => { if (alive) setHubWeather({ key: hubKey, origin, dest }); });
    return () => { alive = false; };
    // Fetched once per flight and phase; the 30s ticker must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubKey]);

  /** Exchange rate for the briefing (PREP) and on arrival; the cached rate stands in when offline. */
  const [hubFx, setHubFx] = useState<{ key: string; fx: HubFx | null } | null>(null);
  useEffect(() => {
    if (!primary || !hubKey || (hubPhase !== 'PREP' && hubPhase !== 'ARRIVED')) return undefined;
    let alive = true;
    fetchFxSnapshot(primary.origin, primary.originCountry, primary.destination, primary.destCountry)
      .then(snap => {
        if (!alive) return;
        let fx: HubFx | null = null;
        if (snap && snap.localCode && snap.localCode !== snap.destCode && snap.localToDest) {
          fx = { from: snap.localCode, to: snap.destCode, rate: snap.localToDest };
        } else if (snap && snap.destCode !== 'EUR' && snap.localCode !== snap.destCode && snap.eurToDest) {
          fx = { from: 'EUR', to: snap.destCode, rate: snap.eurToDest };
        }
        setHubFx({ key: hubKey, fx });
      })
      .catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubKey]);
  const hubWeatherNow = hubWeather?.key === hubKey ? hubWeather : null;
  const hubFxNow = hubFx?.key === hubKey ? hubFx.fx : null;

  /** Blackout replaces the now-card copy entirely; null means nothing definite to say, so the usual line stands. */
  const blackoutLine = useMemo(
    () => (focusMode ? focusStatusLine(vapor ? 'vapor' : arctic ? 'arctic' : 'blackout', primary, resolved?.phase) : null),
    [focusMode, vapor, arctic, primary, resolved?.phase, now, locale],
  );
  const tripTitle = primary
    ? homeTripTitle({
      destIata: primary.destination,
      destCity: primary.destCity,
      originIata: primary.origin,
      originCountry: primary.originCountry,
      depMs,
      now,
      locale: getLocale(),
      today: copy.today,
      tomorrow: copy.tomorrow,
    })
    : '';
  const skyScene = skyFor(new Date(now).getHours(), isDark);
  const kids = mode === 'kids';
  // Kids and the focus modes draw no photo, so the header takes the theme's own colours instead of the sky's.
  const chrome = homeChrome({
    photo: !kids && !focusMode,
    scene: skyScene,
    themeText: modeC.text,
    themeIsDark: !!modeC.isDark,
  });
  const skyIcon = chrome.tint;
  const chromeScrim = chrome.scrim;
  const chromeRadius = modeC.square ? 0 : 999;
  const scanBadge = gmailBadgeFor(gmailStatus, now);
  // The inbox is the better answer when it has one: it counts what is unanswered rather than what was found.
  const gmailBadge = inboxBadgeProp !== undefined ? inboxBadgeProp : scanBadge;

  return (
    <View style={[st.root, { backgroundColor: 'transparent' }]}>
      <StatusBar style={chrome.statusBar} />
      {kids ? (
        <KidsTrackedBand height={horizonBandHeight(insets.top, 'tracked', false)} insetTop={insets.top} />
      ) : (
        <View style={{ height: horizonBandHeight(insets.top, 'tracked', false) }} />
      )}
      <View style={[st.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        {/* Fix: header clipped — the day label ("Vandaag") stays whole, only a long city name shortens. */}
        <TripTitleText title={tripTitle} containerStyle={{ flex: 1 }} style={[st.relDay, { flex: undefined, color: skyIcon }]} />
        {gmailConnected && onGmailScan && flights.length > 0 ? (
          <Pressable
            onPress={() => { haptics.light(); onGmailScan(); }}
            onLongPress={() => { haptics.light(); setGmailTip(true); }}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={gmailBadge?.kind === 'count'
              ? `${copy.inboxTitle} · ${copy.hubGmailFound(badgeCount(gmailBadge))}`
              : copy.inboxTitle}
            accessibilityHint={copy.gmailScanHint}
            style={[st.chromeBtn, { borderColor: skyIcon, borderRadius: chromeRadius, backgroundColor: chromeScrim }]}
          >
            <EnvelopeSimple size={20} color={skyIcon} />
            {gmailBadge?.kind === 'count' ? (
              <View style={[st.gmailBadge, { backgroundColor: c.accent, borderColor: c.card }]}>
                <Text style={[st.gmailBadgeTxt, { color: c.card }]} allowFontScaling={false}>
                  {badgeCount(gmailBadge) > 9 ? '9+' : String(badgeCount(gmailBadge))}
                </Text>
              </View>
            ) : gmailBadge?.kind === 'dot' ? (
              <View style={[st.gmailDot, { borderColor: c.card }]} />
            ) : null}
          </Pressable>
        ) : null}
        <ModeSwitcher tint={skyIcon} scrim={chromeScrim} />
        <Pressable
          onPress={() => { haptics.light(); onOpenSettings(); }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={copy.settings}
          style={[st.chromeBtn, { borderColor: skyIcon, borderRadius: chromeRadius, backgroundColor: chromeScrim }]}
        >
          <Gear size={20} color={skyIcon} />
        </Pressable>
      </View>

      {/* What the envelope is for — on long press, since the icon alone says little. */}
      {gmailTip ? (
        <View style={[st.tipWrap, { top: insets.top + 40 }]} pointerEvents="none">
          <Text style={[st.tipTxt, { backgroundColor: c.text, color: c.bg }]}>{copy.gmailScanHint}</Text>
        </View>
      ) : null}

      <ScrollView
        style={[st.scroll, { backgroundColor: mode === 'kids' ? 'transparent' : c.bg }]}
        contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 24 }]}
      >
        <Animated.View style={[introStyle, { gap: 12 }]}>
        {primary && primaryTripName ? (
          <Text style={[st.tripName, { color: c.muted }]} numberOfLines={1}>{primaryTripName}</Text>
        ) : null}
        {primary ? (
          <TripGroupHeader name={dayHeader(primary, locale).label} range="" colors={c} />
        ) : null}
        {primary ? (
          <HomeFlightCard
            flight={primary}
            colors={c}
            timeFormat12h={timeFormat12h}
            phase={resolved?.phase}
            onPress={() => { haptics.light(); onOpenFlight(primary); }}
            footer={<CardFooter flight={primary} colors={c} isPro={isPro} onBoardingAnswer={onBoardingAnswer} />}
          />
        ) : null}

        {primary ? (
          <View style={st.passRow}>
            {inWalletWindow(depMs, now) || primary.hasBoardingPass ? (
              <AddToWalletButton flightNumber={primary.number} departureIso={depIso} originIata={primary.origin} isPro={isPro} isDark={isDark} mutedColor={c.muted} />
            ) : null}
            {/* The same flight, for whichever calendar app the traveller actually uses. */}
            <CalendarExportButton
              flights={[primary]}
              label={copy.calendarExportShort}
              colors={{ text: c.text, border: c.border, card: c.card }}
              onToast={onToast}
            />
          </View>
        ) : null}

        {/* The travel assistant replaces the "in X days" card. A cancellation or diversion keeps the old card —
            it carries the rights tap — and the focus themes keep their own voice. */}
        {primary && hubPhase && !resolved?.override && !focusMode ? (
          <FlightAssistantHub
            flight={primary}
            phase={hubPhase}
            now={now}
            colors={{ text: c.text, muted: c.muted, accent: c.accent, card: c.card, border: c.border, bg: c.bg }}
            hour12={timeFormat12h}
            destLat={airportRecByIata(primary.destination)?.lat ?? null}
            status={hubStatus}
            originWeather={hubWeatherNow?.origin ?? null}
            destWeather={hubWeatherNow?.dest ?? null}
            fx={hubFxNow}
            stopover={hubStopover}
            gmailStatus={gmailStatus}
            hotel={hubHotel}
            onOpenModule={id => { haptics.light(); onOpenFlight(primary, id); }}
            onGmailScan={onGmailScan ? () => { haptics.light(); onGmailScan(); } : undefined}
            onShareTrip={onShareTrip ? () => { haptics.light(); onShareTrip(primary); } : undefined}
            onLinkHotel={onLinkHotel && primary.trackKey ? messageId => { haptics.success(); onLinkHotel(primary, messageId); } : undefined}
          />
        ) : (
          <HomeNowCard
            line={blackoutLine ?? (nowPhaseCard ? nowPhaseCard.title : nowLine)}
            sub={blackoutLine ? undefined : (nowPhaseCard ? nowPhaseCard.sub : undefined)}
            kicker={vapor ? copy.vaporModeOn : arctic ? copy.arcticModeOn : blackout ? copy.blackoutModeOn : copy.homeNowKicker}
            debug={__DEV__ ? resolved?.leaveParts : undefined}
            colors={{ text: c.text, accent: c.accent, card: c.card, border: c.border }}
            onPress={primary && resolved?.override && resolved.hasRightsBlock
              ? () => { haptics.light(); onOpenFlight(primary, 'eu261'); }
              : undefined}
          />
        )}

        {primary ? (
          <View>
            {modules.length > 0 && !focusMode ? (
              <View style={st.modules}>
                {modules.map(id => (
                  <Pressable
                    key={id}
                    onPress={() => { haptics.light(); onOpenFlight(primary, id); }}
                    style={[st.modChip, { backgroundColor: c.card, borderColor: c.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={moduleLabel(id)}
                  >
                    <ModuleIcon id={id} color={c.accent} />
                    <Text style={[st.modTxt, { color: c.text }]} numberOfLines={1}>{moduleLabel(id)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <StopFollowingLink
              flight={primary}
              colors={c}
              onUntrack={onUntrack}
              spacing={modules.length > 0}
            />
          </View>
        ) : null}

        {rows.map(row => {
          if (row.kind === 'tripName') {
            return (
              <Text key={row.key} style={[st.tripName, { color: c.muted }]} numberOfLines={1}>{row.name}</Text>
            );
          }
          if (row.kind === 'header') {
            return <TripGroupHeader key={row.key} name={row.name} range={row.range} colors={c} />;
          }
          if (row.kind === 'extra') {
            return <TripExtraCard key={row.key} item={row.item} colors={c} />;
          }
          const f = row.f;
          return (
            <View key={row.key}>
              <HomeFlightCard
                flight={f}
                colors={c}
                timeFormat12h={timeFormat12h}
                compact
                onPress={() => { haptics.light(); onOpenFlight(f); }}
                footer={<CardFooter flight={f} colors={c} isPro={isPro} onBoardingAnswer={onBoardingAnswer} />}
              />
              {inWalletWindow(departureMsOf(f), now) || f.hasBoardingPass ? (
                <AddToWalletButton
                  flightNumber={f.number}
                  departureIso={resolveDepartureIso(f)}
                  originIata={f.origin}
                  isPro={isPro}
                  isDark={isDark}
                  mutedColor={c.muted}
                  style={st.walletUnderCard}
                />
              ) : null}
              <StopFollowingLink flight={f} colors={c} onUntrack={onUntrack} spacing />
            </View>
          );
        })}

        {blackout && flights.length > 0 ? (
          <Pressable
            onPress={() => { haptics.medium(); enterTheZone(); }}
            style={st.zoneBtn}
            accessibilityRole="button"
            accessibilityLabel={copy.blackoutEnterZone}
          >
            <Text style={st.zoneTxt}>{copy.blackoutEnterZone}</Text>
          </Pressable>
        ) : null}

        {/* A trip of several flights goes into the calendar in one file, one entry per flight. */}
        {flights.length > 1 ? (
          <CalendarExportButton
            flights={flights}
            label={copy.calendarExportTrip}
            colors={{ text: c.text, border: c.border, card: c.card }}
            style={st.tripCalendarBtn}
            onToast={onToast}
          />
        ) : null}

        <Pressable
          onPress={() => { haptics.medium(); onAddAnother(); }}
          style={[st.addBtn, { borderColor: c.border, backgroundColor: c.card }]}
          accessibilityRole="button"
          accessibilityLabel={copy.homeAddAnother}
        >
          <Plus size={18} color={c.accent} weight="bold" />
          <Text style={[st.addTxt, { color: c.accent }]}>{copy.homeAddAnother}</Text>
        </Pressable>
        </Animated.View>

        {returnChipCity && onReturnChip && !cancelledOverride && !focusMode ? (
          <Animated.View style={chipStyle} pointerEvents={homeConfirmShowChip(confirmPhase, reduced) ? 'auto' : 'none'}>
          <Pressable
            onPress={() => { haptics.light(); onReturnChip(); }}
            style={[st.returnChip, { borderColor: c.border, backgroundColor: c.card }]}
            accessibilityRole="button"
            accessibilityLabel={copy.homeAlsoFlyingBack(returnChipCity)}
          >
            <Text style={[st.returnChipTxt, { color: c.text }]}>
              {copy.homeAlsoFlyingBack(returnChipCity)}
            </Text>
          </Pressable>
          </Animated.View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function StopFollowingLink({
  flight,
  colors: c,
  onUntrack,
  spacing = false,
}: {
  flight: HomeTrackedFlight;
  colors: Colors;
  onUntrack: (flight: HomeTrackedFlight) => void;
  spacing?: boolean;
}) {
  const copy = t();
  const ident = formatFlightNumber(flight);
  return (
    <Pressable
      onPress={() => {
        haptics.light();
        Alert.alert(
          copy.homeStopFollowingQ(ident),
          undefined,
          [
            { text: copy.homeStopFollowingKeep, style: 'cancel' },
            {
              text: copy.homeStopFollowingStop,
              style: 'destructive',
              onPress: () => onUntrack(flight),
            },
          ],
        );
      }}
      accessibilityRole="button"
      accessibilityLabel={copy.homeStopFollowingQ(ident)}
      style={[styles.stopFollow, spacing && styles.stopFollowSpaced]}
    >
      <MinusCircle size={13} color={c.muted} weight="regular" />
      <Text style={[styles.stopFollowTxt, { color: c.muted }]}>{copy.homeStopFollowing}</Text>
    </Pressable>
  );
}

function HomeFlightCard({
  flight: f,
  colors: c,
  timeFormat12h,
  compact,
  phase,
  onPress,
  footer,
}: {
  flight: HomeTrackedFlight;
  colors: Colors;
  timeFormat12h: boolean;
  compact?: boolean;
  phase?: HomeNowPhase;
  onPress: () => void;
  /** Inline lines on the card itself: the boarding prompt, the stale Wallet pass banner. */
  footer?: ReactNode;
}) {
  const copy = t();
  const code = f.airlineCode || airlineCodeFromFlight(f.number);
  const airline = normalizeAirlineName(f.airline, code);
  const from = getLocalizedCity(f.origin, getLocale(), airportRecByIata(f.origin)?.city || f.origin);
  const to = getLocalizedCity(f.destination, getLocale(), airportRecByIata(f.destination)?.city || f.destination);
  const clocks = homeCardTimes(f, timeFormat12h);
  const dur = formatDuration(homeFlightDurationMs(f));
  const resolved = phase || resolveHomeNow(f, Date.now(), timeFormat12h).phase;
  const overlay = homeNowOverlayStatus(resolved, f.status);
  const status = overlay === 'en-route' ? copy.inFlight : (flightStatusLabel(overlay) || overlay);
  const chip = homeNowCardChip(resolved, f.gate, f.baggage, f.status);
  const airportCard = useIsAirport();
  // Arctic: a softer corner, a little more air, and type that whispers rather than states.
  const arcticCard = useIsArctic();
  const arcticCardStyle = arcticCard ? {
    borderRadius: 12,
    paddingHorizontal: 14 + ARCTIC.extraPadding,
    paddingVertical: (compact ? 10 : 14) + ARCTIC.extraPadding,
  } : null;
  const arcticTitle = arcticCard ? { fontWeight: ARCTIC.weightTitle, letterSpacing: ARCTIC.letterSpacingTitle } : null;
  const arcticBody = arcticCard ? { fontWeight: ARCTIC.weightBody, letterSpacing: ARCTIC.letterSpacingBody } : null;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, compact && styles.cardCompact, { backgroundColor: c.card, borderColor: c.border }, airportCard && { borderRadius: 0 }, arcticCardStyle]}
      accessibilityRole="button"
      accessibilityLabel={copy.openFlightDetails(f.number)}
    >
      <View style={styles.logoBox} collapsable={false}>
        <AirlineLogo iata={code} name={f.airline} size={AIRLINE_LOGO_SIZE} preferAirhex />
      </View>
      <View style={styles.cardText}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', minWidth: 0 }}>
          {airline ? (
            <Text style={[styles.cardTitle, { color: c.text, flexShrink: 1 }, arcticTitle]} numberOfLines={1} ellipsizeMode="tail">
              {airline}
            </Text>
          ) : null}
          {airline ? (
            <Text style={[styles.cardTitle, { color: c.text, flexShrink: 0 }, arcticTitle]}>{' · '}</Text>
          ) : null}
          <FlightNumberText style={[styles.cardTitle, { color: c.text, flex: 1, minWidth: 0 }, arcticTitle]}>
            {formatFlightNumber(f)}
          </FlightNumberText>
        </View>
        <Text style={[styles.cardSub, { color: c.muted }, arcticBody]} numberOfLines={1}>{`${from} → ${to}`}</Text>
        <CardTimesRow dep={clocks.dep} arr={clocks.arr} duration={dur} colors={c} />
        {shouldShowOverviewProgress(overlay) || resolved === 'in_flight' ? (
          <FlightOverviewProgressBar
            pct={overviewBarPct(flightProgressPct(f), overlay === 'landed')}
            origin={String(f.origin || '').toUpperCase()}
            dest={String(f.destination || '').toUpperCase()}
            remainMin={remainingMinutesTo(flightClockUtcMs(
              resolveArrivalIso(f),
              f.destination,
              f.destCountry,
            ))}
            delay={(f as { delay?: number }).delay}
            status={f.status}
            trackColor={c.border}
            labelColor={c.muted}
            iataColor={c.secondary}
          />
        ) : null}
        <View style={styles.cardStatus}>
          {chip?.kind === 'gate' ? (
            <Text style={[styles.gate, { color: c.text }, arcticTitle]} numberOfLines={1}>{copy.gate(chip.value)}</Text>
          ) : null}
          {chip?.kind === 'belt' ? (
            <Text style={[styles.gate, { color: c.text }, arcticTitle]} numberOfLines={1}>{copy.baggageBelt(chip.value)}</Text>
          ) : null}
          {status ? (
            <FlightStatusBadge label={status} tone={liveTone(resolved, overlay)} />
          ) : null}
        </View>
        {footer}
      </View>
    </Pressable>
  );
}

/** What sits inline at the bottom of a flight card: the boarding question, then the stale Wallet pass line. */
function CardFooter({
  flight: f,
  colors: c,
  isPro,
  onBoardingAnswer,
}: {
  flight: HomeTrackedFlight;
  colors: Colors;
  isPro: boolean;
  onBoardingAnswer?: (flight: HomeTrackedFlight, boardHere: boolean) => void;
}) {
  return (
    <>
      {f.boardingPrompt && onBoardingAnswer ? (
        <BoardingPromptBar flight={f} prompt={f.boardingPrompt} colors={c} onAnswer={onBoardingAnswer} />
      ) : null}
      <WalletStaleBanner
        flightNumber={f.number}
        departureIso={resolveDepartureIso(f)}
        originIata={f.origin}
        isPro={isPro}
        colors={c}
      />
    </>
  );
}

/** "BR75 departs from Taipei. Are you boarding in Bangkok?" with the two answers, right on the card (no modal). */
function BoardingPromptBar({
  flight: f,
  prompt,
  colors: c,
  onAnswer,
}: {
  flight: HomeTrackedFlight;
  prompt: { routeOrigin: string; boardIata: string };
  colors: Colors;
  onAnswer: (flight: HomeTrackedFlight, boardHere: boolean) => void;
}) {
  const copy = t();
  const locale = getLocale();
  const city = (iata: string) => getLocalizedCity(iata, locale, airportRecByIata(iata)?.city || iata);
  return (
    <View style={[styles.boardPrompt, { borderColor: c.border }]}>
      <Text style={[styles.boardPromptQ, { color: c.text }]}>
        {copy.boardingPromptQ(formatFlightNumber(f), city(prompt.routeOrigin), city(prompt.boardIata))}
      </Text>
      <View style={styles.boardPromptRow}>
        <Pressable
          onPress={() => onAnswer(f, true)}
          style={[styles.boardPromptBtn, { backgroundColor: c.accent, borderColor: c.accent }]}
          accessibilityRole="button"
          accessibilityLabel={copy.boardingPromptYes(prompt.boardIata)}
        >
          <Text style={[styles.boardPromptBtnTxt, { color: c.card }]} numberOfLines={1}>
            {copy.boardingPromptYes(prompt.boardIata)}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onAnswer(f, false)}
          style={[styles.boardPromptBtn, { borderColor: c.border }]}
          accessibilityRole="button"
          accessibilityLabel={copy.boardingPromptNo(prompt.routeOrigin)}
        >
          <Text style={[styles.boardPromptBtnTxt, { color: c.text }]} numberOfLines={1}>
            {copy.boardingPromptNo(prompt.routeOrigin)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function clockPair(part: HomeCardClockPart, colors: Colors, airport = false) {
  return (
    <View style={styles.clockPair}>
      {part.strike && part.scheduled ? (
        <FlightNumberText style={[styles.cardMetaStrike, { color: colors.muted }, airport && { fontFamily: MONO }]}>
          {part.scheduled}
        </FlightNumberText>
      ) : null}
      {/* Airport mode: times in yellow monospace, like a departures board. */}
      <FlightNumberText style={[styles.cardMeta, { color: airport ? AIRPORT_BOARD.amber : colors.secondary }, airport && { fontFamily: MONO, fontWeight: '700' }]}>
        {part.live}
      </FlightNumberText>
    </View>
  );
}

function CardTimesRow({
  dep,
  arr,
  duration,
  colors: c,
}: {
  dep: HomeCardClockPart | null;
  arr: HomeCardClockPart | null;
  duration: string;
  colors: Colors;
}) {
  const airport = useIsAirport();
  if (!dep && !arr && !duration) return null;
  return (
    <View style={styles.cardTimes}>
      {dep ? clockPair(dep, c, airport) : null}
      {dep && arr ? (
        <Text style={[styles.cardMeta, { color: c.secondary }]}>{' → '}</Text>
      ) : null}
      {arr ? clockPair(arr, c, airport) : null}
      {duration ? (
        <Text style={[styles.cardMeta, { color: c.secondary }]}>{`${dep || arr ? ' · ' : ''}${duration}`}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Blackout only: one white bar, square, no shadow.
  zoneBtn: {
    height: 52,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  zoneTxt: { color: '#000000', fontSize: 15, fontWeight: '800', letterSpacing: 2 },
  // Trip grouping: a quiet header over the legs of one journey, and the bookings that sit between them.
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: -4,
    gap: 10,
  },
  groupName: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  groupRange: { fontSize: 13, fontWeight: '600' },
  boardPrompt: { marginTop: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  boardPromptQ: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  boardPromptRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  boardPromptBtn: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  boardPromptBtnTxt: { fontSize: 13, fontWeight: '700' },
  extraCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginLeft: 16,
  },
  extraIcon: { fontSize: 18 },
  extraText: { flex: 1, gap: 2 },
  extraTitle: { fontSize: 14, fontWeight: '700' },
  extraSub: { fontSize: 12, fontWeight: '500' },
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
    gap: 12,
  },
  relDay: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  settingsBtn: { padding: 6 },
  // Same ring as the mode button beside it, so both stay visible on a light photo.
  chromeBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  gmailBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gmailBadgeTxt: { fontSize: 10, fontWeight: '800' },
  gmailDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1,
    backgroundColor: '#22C55E',
  },
  tipWrap: { position: 'absolute', left: 0, right: 16, alignItems: 'flex-end', zIndex: 3 },
  tipTxt: { fontSize: 12, fontWeight: '600', overflow: 'hidden', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  scroll: { flex: 1 },
  walletUnderCard: { marginTop: 8 },
  passRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  /* Context above the date header, not a replacement for it: smaller, quieter, one line. */
  tripName: { fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: -6 },
  tripCalendarBtn: { marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 8, gap: 12 },
  logoBox: {
    width: AIRLINE_LOGO_SIZE,
    height: AIRLINE_LOGO_SIZE,
    flexShrink: 0,
  },
  stopFollow: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  stopFollowSpaced: { marginTop: 12 },
  stopFollowTxt: { fontSize: 13, fontWeight: '500' },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardCompact: { paddingVertical: 10 },
  cardText: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSub: { fontSize: 13, marginTop: 2 },
  cardTimes: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', marginTop: 4 },
  clockPair: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  cardMeta: { fontSize: 12, fontWeight: '600' },
  cardMetaStrike: { fontSize: 12, fontWeight: '600', textDecorationLine: 'line-through' },
  cardStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  gate: { fontSize: 13, fontWeight: '700' },
  modules: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  modTxt: { fontSize: 13, fontWeight: '600' },
  addBtn: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addTxt: { fontSize: 15, fontWeight: '700' },
  returnChip: {
    marginTop: 10,
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  returnChipTxt: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
});
