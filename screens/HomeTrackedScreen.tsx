import ModeSwitcher from '../components/ModeSwitcher';
import { useIsAirport, useMode } from '../lib/modeContext';
import { KidsTrackedBand } from '../components/kids/KidsHome';
import { AIRPORT_BOARD, MONO } from '../lib/themes';
import { squareStyles } from '../lib/squareStyles';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AirplaneLanding,
  Armchair,
  CloudSun,
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
import { FlightNumberText } from '../components/FlightNumberText';
import HomeNowCard from '../components/HomeNowCard';
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
import { skyChromeTint, skyFor, statusBarStyleForSky } from '../lib/themeTokens';
import { inWalletWindow } from '../lib/walletButton';
import FlightOverviewProgressBar from '../components/FlightOverviewProgressBar';
import {
  overviewBarPct,
  remainingMinutesTo,
  shouldShowOverviewProgress,
} from '../lib/flightOverviewProgress';
import { groupTrips, type TripFlight, type TripGroup } from '../lib/tripOrchestrator';
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
  onUntrack: (flight: HomeTrackedFlight) => void;
  isDark?: boolean;
  /** Pro: Wallet passes get push updates. */
  isPro?: boolean;
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

/** "14–21 mrt" when both days are known, otherwise whichever half we have. */
function dateRangeLabel(startMs: number | null, endMs: number | null, locale: string): string {
  const a = shortDay(startMs, locale);
  const b = shortDay(endMs, locale);
  if (a && b && a !== b) return `${a} – ${b}`;
  return a || b;
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

/** Purely visual: it says these flights are one trip. No chevron, nothing to tap. */
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
  onUntrack,
  isDark = false,
  isPro = false,
}: Props) {
  const insets = useSafeAreaInsets();
  // Airport mode: no rounded corners.
  const { mode, C: modeC } = useMode();
  const st = useMemo(() => (mode === 'airport' ? squareStyles(styles) : styles), [mode]);
  const copy = t();
  const reduced = useReducedMotion();
  const [now, setNow] = useState(() => Date.now());
  const slide = homeConfirmSlideCards(confirmPhase, reduced);
  const intro = useSharedValue(slide ? 0 : 1);
  const chipOp = useSharedValue(homeConfirmShowChip(confirmPhase, reduced) ? 1 : 0);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

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
  const primaryGroup = groups.find(g => g.flights.some(l => l.key === primaryKey)) || null;
  const leaveOpts = useMemo(() => ({
    tight: getPrefs().airportTiming === 'tight',
    boardingPass: !!primary?.hasBoardingPass,
    travelMin: primary ? taxiMinutes(primary.origin) : null,
  }), [primary, now]);
  // The language is a dependency: these hold translated lines, and t() changes without a re-mount.
  const locale = getLocale();
  const rows = useMemo<HomeRow[]>(() => {
    const out: HomeRow[] = [];
    const range = (g: TripGroup<GroupLeg>): string =>
      dateRangeLabel(msOfIso(g.startDate), msOfIso(g.endDate), locale);
    // The trip the primary card belongs to comes first; its header already sits above that card.
    const ordered = [
      ...groups.filter(g => g.flights.some(l => l.key === primaryKey)),
      ...groups.filter(g => !g.flights.some(l => l.key === primaryKey)),
    ];
    for (const g of ordered) {
      const isPrimaryGroup = g.flights.some(l => l.key === primaryKey);
      if (!isPrimaryGroup && g.flights.length >= 2) {
        out.push({ kind: 'header', key: `h:${g.key}`, name: g.name, range: range(g) });
      }
      g.flights.forEach((item, i) => {
        if (item.key !== primaryKey) out.push({ kind: 'flight', key: `f:${item.key}`, f: item.home });
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
  }, [groups, primaryKey, locale, timeFormat12h]);
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
  const skyIcon = kids ? modeC.text : skyChromeTint(skyScene);

  return (
    <View style={[st.root, { backgroundColor: 'transparent' }]}>
      <StatusBar style={kids ? (modeC.isDark ? 'light' : 'dark') : statusBarStyleForSky(skyScene)} />
      {kids ? (
        <KidsTrackedBand height={horizonBandHeight(insets.top, 'tracked', false)} insetTop={insets.top} />
      ) : (
        <View style={{ height: horizonBandHeight(insets.top, 'tracked', false) }} />
      )}
      <View style={[st.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        {/* Fix: header clipped — the day label ("Vandaag") stays whole, only a long city name shortens. */}
        <TripTitleText title={tripTitle} containerStyle={{ flex: 1 }} style={[st.relDay, { flex: undefined, color: skyIcon }]} />
        <ModeSwitcher tint={skyIcon} />
        <Pressable
          onPress={() => { haptics.light(); onOpenSettings(); }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={copy.settings}
          style={st.settingsBtn}
        >
          <Gear size={20} color={skyIcon} />
        </Pressable>
      </View>

      <ScrollView
        style={[st.scroll, { backgroundColor: mode === 'kids' ? 'transparent' : c.bg }]}
        contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 24 }]}
      >
        <Animated.View style={[introStyle, { gap: 12 }]}>
        {primary && primaryGroup && primaryGroup.flights.length >= 2 ? (
          <TripGroupHeader
            name={primaryGroup.name}
            range={dateRangeLabel(msOfIso(primaryGroup.startDate), msOfIso(primaryGroup.endDate), locale)}
            colors={c}
          />
        ) : null}
        {primary ? (
          <HomeFlightCard
            flight={primary}
            colors={c}
            timeFormat12h={timeFormat12h}
            phase={resolved?.phase}
            onPress={() => { haptics.light(); onOpenFlight(primary); }}
          />
        ) : null}

        {primary && (inWalletWindow(depMs, now) || primary.hasBoardingPass) ? (
          <AddToWalletButton flightNumber={primary.number} isPro={isPro} isDark={isDark} mutedColor={c.muted} />
        ) : null}

        <HomeNowCard
          line={nowPhaseCard ? nowPhaseCard.title : nowLine}
          sub={nowPhaseCard ? nowPhaseCard.sub : undefined}
          kicker={copy.homeNowKicker}
          debug={__DEV__ ? resolved?.leaveParts : undefined}
          colors={{ text: c.text, accent: c.accent, card: c.card, border: c.border }}
          onPress={primary && resolved?.override && resolved.hasRightsBlock
            ? () => { haptics.light(); onOpenFlight(primary, 'eu261'); }
            : undefined}
        />

        {primary ? (
          <View>
            {modules.length > 0 ? (
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
              />
              {inWalletWindow(departureMsOf(f), now) || f.hasBoardingPass ? (
                <AddToWalletButton
                  flightNumber={f.number}
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

        {returnChipCity && onReturnChip && !cancelledOverride ? (
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
}: {
  flight: HomeTrackedFlight;
  colors: Colors;
  timeFormat12h: boolean;
  compact?: boolean;
  phase?: HomeNowPhase;
  onPress: () => void;
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

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, compact && styles.cardCompact, { backgroundColor: c.card, borderColor: c.border }, airportCard && { borderRadius: 0 }]}
      accessibilityRole="button"
      accessibilityLabel={copy.openFlightDetails(f.number)}
    >
      <View style={styles.logoBox} collapsable={false}>
        <AirlineLogo iata={code} name={f.airline} size={AIRLINE_LOGO_SIZE} preferAirhex />
      </View>
      <View style={styles.cardText}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', minWidth: 0 }}>
          {airline ? (
            <Text style={[styles.cardTitle, { color: c.text, flexShrink: 1 }]} numberOfLines={1} ellipsizeMode="tail">
              {airline}
            </Text>
          ) : null}
          {airline ? (
            <Text style={[styles.cardTitle, { color: c.text, flexShrink: 0 }]}>{' · '}</Text>
          ) : null}
          <FlightNumberText style={[styles.cardTitle, { color: c.text, flex: 1, minWidth: 0 }]}>
            {formatFlightNumber(f)}
          </FlightNumberText>
        </View>
        <Text style={[styles.cardSub, { color: c.muted }]} numberOfLines={1}>{`${from} → ${to}`}</Text>
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
            <Text style={[styles.gate, { color: c.text }]} numberOfLines={1}>{copy.gate(chip.value)}</Text>
          ) : null}
          {chip?.kind === 'belt' ? (
            <Text style={[styles.gate, { color: c.text }]} numberOfLines={1}>{copy.baggageBelt(chip.value)}</Text>
          ) : null}
          {status ? (
            <FlightStatusBadge label={status} tone={liveTone(resolved, overlay)} />
          ) : null}
        </View>
      </View>
    </Pressable>
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
  scroll: { flex: 1 },
  walletUnderCard: { marginTop: 8 },
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
