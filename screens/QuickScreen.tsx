import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { compactTerminal, formatGateLabel, hasRealGate } from '../GateBadge';
import QuickRadarEmbed, { type QuickRadarAirport } from '../QuickRadarEmbed';
import RouteMapEmbed from '../RouteMapEmbed';
import AirlineLogo, { airlineCodeFromFlight } from '../AirlineLogo';
import {
  FLIGHT_NUMBER_DIGIT_BAR_HEIGHT,
  hideFlightNumberDigitBar,
  useFlightNumberKeyboard,
} from '../components/FlightNumberKeyboardAccessory';
import { airportRecByIata } from '../lib/airportsDb';
import { cleanBaggageBelt } from '../lib/baggageBelt';
import { slugFlightIdent } from '../lib/flightIdent';
import { arcProgressForStatus } from '../lib/quickRouteMapHtml';
import {
  EMPTY_CLOCK,
  flightClockUtcMs,
  formatAirportClock,
  resolveArrivalIso,
  resolveDepartureIso,
  type FlightClockFields,
} from '../lib/flightTimes';
import { flightStatusLabel, t } from '../lib/i18n';
import { haptics } from '../lib/haptics';
import { useQuickTheme, QuickThemeModeContext, type QuickThemeColors } from '../lib/quickTheme';

const GREEN = '#22C55E';
const RED = '#FF3B30';
const ORANGE = '#FF9800';
const GRAB_DEEPLINK = 'https://call.grab.com/deeplink';
const TICK_MS = 30_000;
const ROUTE_MAP_H = 200;
const MAX_SECTION_FLIGHTS = 5;
const EMBEDDED_MAP_MIN_H = 120;
const QUICK_CARD_MAP_H = 180;
const QUICK_CARD_MAP_MIN_H = 120;
const QUICK_CARD_TRACK_BTN_H = 36;
const QUICK_PAGER_DOTS_H = 34;

const QUICK_HEADER_H = 100;
const QUICK_SCANNER_H = 48;
const QUICK_SECTION_LABEL_H = 32;
const QUICK_SAFE_AREA_H = 44;
const QUICK_BODY_PAD_V = 12;
const QUICK_FOOTER_BASE = 44;
const QUICK_SCAN_DIVIDER_GAP = 10;
const QUICK_PANEL_INPUT_FULL_H = 78;
const QUICK_CARD_IDENTITY_H = 44;
const QUICK_CARD_INFO_H = 48;
const QUICK_CARD_TRACK_BLOCK_H = QUICK_CARD_TRACK_BTN_H + 18;

function quickSectionHeight(windowHeight: number, insets: { top: number; bottom: number }): number {
  const footerH = QUICK_FOOTER_BASE + Math.max(insets.bottom, 8);
  const remaining =
    windowHeight -
    QUICK_HEADER_H -
    QUICK_SCANNER_H -
    QUICK_SCAN_DIVIDER_GAP -
    QUICK_SECTION_LABEL_H * 2 -
    QUICK_BODY_PAD_V -
    footerH -
    Math.max(QUICK_SAFE_AREA_H, insets.top);
  return Math.max(120, Math.floor(remaining / 2));
}

function quickCardFooterHeight(): number {
  return QUICK_CARD_IDENTITY_H + QUICK_CARD_INFO_H + QUICK_PAGER_DOTS_H + QUICK_CARD_TRACK_BLOCK_H + 8;
}

function quickMapHeight(sectionHeight: number, hasInputPanel: boolean): number {
  const bodyH = sectionHeight - QUICK_SECTION_LABEL_H;
  const overhead = 8 + (hasInputPanel ? QUICK_PANEL_INPUT_FULL_H : 0) + quickCardFooterHeight();
  const available = bodyH - overhead;
  if (available >= QUICK_CARD_MAP_H) return QUICK_CARD_MAP_H;
  return Math.max(QUICK_CARD_MAP_MIN_H, Math.min(QUICK_CARD_MAP_H, available));
}

function quickFullDepartureHeight(windowHeight: number, insets: { top: number; bottom: number }): number {
  const footerH = QUICK_FOOTER_BASE + Math.max(insets.bottom, 8);
  const arrivalEmptyH = QUICK_SECTION_LABEL_H + 108;
  const chrome =
    QUICK_HEADER_H +
    QUICK_BODY_PAD_V +
    footerH +
    Math.max(QUICK_SAFE_AREA_H, insets.top) +
    QUICK_SCANNER_H +
    QUICK_SCAN_DIVIDER_GAP +
    arrivalEmptyH;
  return Math.max(200, windowHeight - chrome);
}

const QUICK_PANEL_INPUT_H = 52;

function airportCoords(iata?: string): { lat: number; lon: number } | null {
  const ap = airportRecByIata(iata);
  if (!ap || !Number.isFinite(ap.lat) || !Number.isFinite(ap.lon)) return null;
  if (ap.lat === 0 && ap.lon === 0) return null;
  return { lat: ap.lat, lon: ap.lon };
}

export type QuickFlight = FlightClockFields & {
  id: string;
  number: string;
  origin: string;
  originCity: string;
  originCountry?: string;
  destination: string;
  destCity: string;
  destCountry?: string;
  gate: string;
  terminal?: string;
  arrTerminal?: string;
  baggage?: string;
  status: string;
  delay?: number;
  airline?: string;
  airlineCode?: string;
  progress?: number;
  lat?: number;
  lng?: number;
  headingDeg?: number;
};

type Props = {
  airport: QuickRadarAirport;
  lookupFlight: (number: string) => Promise<QuickFlight[]>;
  onOpenFlight?: (flight: QuickFlight, mode: 'departure' | 'arrival') => void;
  trackFlight?: (flight: QuickFlight) => Promise<void>;
  untrackFlight?: (flight: QuickFlight) => Promise<void>;
  isFlightTracked?: (flight: QuickFlight) => boolean;
  timeFormat12h?: boolean;
  pollsActive?: boolean;
  onOpenSettings?: () => void;
  onScanBoardingPass?: () => void;
  pendingDepartingScan?: { flightNumber: string; requestId: number } | null;
  onPendingDepartingScanHandled?: () => void;
  themeMode: 'light' | 'dark';
};

function cleanFlightInput(raw: string): string {
  return slugFlightIdent(raw.replace(/\s+/g, ' ').trim());
}

function pickNearestFlight(hits: QuickFlight[]): QuickFlight | null {
  if (!hits.length) return null;
  const now = Date.now();
  return [...hits].sort((a, b) => {
    const ta = new Date(a.scheduledTime || 0).getTime();
    const tb = new Date(b.scheduledTime || 0).getTime();
    return Math.abs(ta - now) - Math.abs(tb - now);
  })[0];
}

function sameQuickFlight(a: QuickFlight, b: QuickFlight): boolean {
  return a.id === b.id || cleanFlightInput(a.number) === cleanFlightInput(b.number);
}

function arrivalTerminalLabel(f: QuickFlight): string {
  const term = compactTerminal(f.arrTerminal || f.terminal);
  return term ? `Terminal ${term.replace(/^T/i, '')}` : 'Terminal: TBD';
}

function arrivalGateLabel(f: QuickFlight): string {
  return hasRealGate(f.gate) ? formatGateLabel(f.gate) : 'Gate: TBD';
}

function isoToUtcMs(iso: string, iata?: string, country?: string): number | null {
  const ms = flightClockUtcMs(iso, iata, country) ?? new Date(iso).getTime();
  return Number.isFinite(ms) ? ms : null;
}

function formatLandsIn(msUntil: number): string {
  if (msUntil <= 0) return 'Lands in 0 min';
  const totalMin = Math.max(1, Math.ceil(msUntil / 60_000));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0 && mins > 0) return `Lands in ${hours} hours ${mins} min`;
  if (hours > 0) return `Lands in ${hours} hours 0 min`;
  return `Lands in ${mins} min`;
}

function formatLandsInDuration(msUntil: number): string {
  if (msUntil <= 0) return '0m';
  const totalMin = Math.max(1, Math.ceil(msUntil / 60_000));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h 0m`;
  return `${mins}m`;
}

const LANDED_PHASE_GREEN = '#00C853';

type FlightCardPhaseView = {
  text: string;
  color: string;
  boarding?: boolean;
};

function buildFlightCardPhase(
  f: QuickFlight,
  timeFormat12h: boolean,
  now: number,
  q: QuickThemeColors,
): FlightCardPhaseView | null {
  const copy = t();
  const status = String(f.status || '').toLowerCase();

  if (status === 'cancelled') return null;

  if (status === 'landed') {
    const clk = formatAirportClock(
      resolveActualArrivalIso(f),
      f.destination,
      timeFormat12h,
      f.destCountry,
    );
    const time = clk && clk !== EMPTY_CLOCK ? clk : '';
    return {
      text: time ? `${copy.landed} ${time}` : copy.landed,
      color: LANDED_PHASE_GREEN,
    };
  }

  if (status === 'en-route' || status === 'departed') {
    const arrivalIso = resolveArrivalIso(f);
    const arrivalMs = arrivalIso
      ? isoToUtcMs(arrivalIso, f.destination, f.destCountry)
      : null;
    if (arrivalMs != null) {
      return {
        text: copy.landsIn(formatLandsInDuration(arrivalMs - now)),
        color: q.accent,
      };
    }
    return null;
  }

  if (status === 'boarding') {
    const depIso = resolveDepartureIso(f);
    const clk = depIso
      ? formatAirportClock(depIso, f.origin, timeFormat12h, f.originCountry)
      : EMPTY_CLOCK;
    const gate = hasRealGate(f.gate) ? formatGateLabel(f.gate) : 'Gate TBD';
    const time = clk && clk !== EMPTY_CLOCK ? ` · ${clk}` : '';
    return {
      text: `Boarding · ${gate}${time}`,
      color: q.accent,
      boarding: true,
    };
  }

  const depIso = resolveDepartureIso(f);
  const clk = depIso
    ? formatAirportClock(depIso, f.origin, timeFormat12h, f.originCountry)
    : EMPTY_CLOCK;
  if (!clk || clk === EMPTY_CLOCK) return null;
  return { text: copy.departsAt(clk), color: q.accent };
}

function FlightCardPhaseTime({
  flight,
  timeFormat12h,
}: {
  flight: QuickFlight;
  timeFormat12h: boolean;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const [now, setNow] = useState(() => Date.now());
  const status = String(flight.status || '').toLowerCase();
  const needsTick = status === 'en-route' || status === 'departed';

  useEffect(() => {
    if (!needsTick) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [needsTick]);

  const phase = buildFlightCardPhase(flight, timeFormat12h, now, q);
  if (!phase) return null;

  return (
    <Text
      style={[
        st.cardPhaseTime,
        phase.boarding && st.cardPhaseTimeBoarding,
        { color: phase.color },
      ]}
      numberOfLines={1}
    >
      {phase.text}
    </Text>
  );
}

function pickupShowTransport(f: QuickFlight, now: number): boolean {
  if (!f.actualArrival) return false;
  const landedMs = isoToUtcMs(f.actualArrival, f.destination, f.destCountry);
  return landedMs != null && now > landedMs;
}

function gateLine(f: QuickFlight): string {
  return hasRealGate(f.gate) ? formatGateLabel(f.gate) : 'Gate: TBD';
}

function resolveActualArrivalIso(f: QuickFlight): string {
  const actual = f.actualArrival || f.actualTime;
  return actual || resolveArrivalIso(f);
}

type QuickStatusView = {
  hero: string;
  sub?: string | null;
  color: string;
  heroLarge?: boolean;
};

function buildDepartureStatus(f: QuickFlight, timeFormat12h: boolean, q: QuickThemeColors): QuickStatusView {
  const copy = t();
  const delay = f.delay ?? 0;
  const gate = gateLine(f);
  switch (f.status) {
    case 'cancelled':
      return { hero: `❌ ${copy.cancelled}`, sub: 'Check airline for rebooking', color: RED };
    case 'landed': {
      const clk = formatAirportClock(
        resolveActualArrivalIso(f),
        f.destination,
        timeFormat12h,
        f.destCountry,
      );
      const time = clk && clk !== EMPTY_CLOCK ? ` · ${clk}` : '';
      return {
        hero: `✅ ${copy.landed}${time}`,
        sub: `${arrivalTerminalLabel(f)} · ${arrivalGateLabel(f)}`,
        color: GREEN,
      };
    }
    case 'boarding':
      return { hero: `🟢 ${copy.boardingNow} · ${gate}`, color: q.accent };
    case 'en-route':
    case 'departed':
      return {
        hero: `✈️ ${copy.inFlight}${delay > 0 ? ` · ${copy.delayedMin(delay)}` : ` · ${copy.onTimeLower}`}`,
        sub: gate,
        color: ORANGE,
      };
    case 'delayed':
      return {
        hero: `⏱ ${delay > 0 ? copy.delayedMin(delay) : copy.delayed} · ${gate}`,
        color: q.accent,
      };
    default:
      return { hero: copy.scheduled, sub: gate, color: q.subtext };
  }
}

function buildArrivalStatus(f: QuickFlight, timeFormat12h: boolean, now: number, q: QuickThemeColors): QuickStatusView {
  const copy = t();
  const delay = f.delay ?? 0;
  if (f.status === 'cancelled') {
    return { hero: `❌ ${copy.cancelled}`, sub: 'Check airline for rebooking', color: RED };
  }
  if (f.status === 'landed') {
    const clk = formatAirportClock(
      resolveActualArrivalIso(f),
      f.destination,
      timeFormat12h,
      f.destCountry,
    );
    const time = clk && clk !== EMPTY_CLOCK ? ` · ${clk}` : '';
    return {
      hero: `✅ ${copy.landed}${time}`,
      sub: `${arrivalTerminalLabel(f)} · ${arrivalGateLabel(f)}`,
      color: GREEN,
    };
  }

  const arrivalIso = resolveArrivalIso(f);
  const arrivalClock = arrivalIso
    ? formatAirportClock(arrivalIso, f.destination, timeFormat12h, f.destCountry)
    : EMPTY_CLOCK;
  const arrivalMs = arrivalIso
    ? isoToUtcMs(arrivalIso, f.destination, f.destCountry)
    : null;
  const landsIn = arrivalMs != null ? formatLandsIn(arrivalMs - now) : '';

  let sub: string | null = null;
  if (f.status === 'en-route' || f.status === 'departed') {
    sub = delay > 0
      ? `${copy.inFlight} · ${copy.delayedMin(delay)}`
      : `${copy.inFlight} · ${copy.onTimeLower}`;
  } else if (delay > 0) {
    sub = copy.delayedMin(delay);
  } else if (arrivalClock && arrivalClock !== EMPTY_CLOCK) {
    sub = `Arrives ${arrivalClock}`;
  } else {
    sub = `${arrivalTerminalLabel(f)} · ${arrivalGateLabel(f)}`;
  }

  if (landsIn) {
    return { hero: landsIn, sub, color: q.accent, heroLarge: true };
  }
  if (arrivalClock && arrivalClock !== EMPTY_CLOCK) {
    return {
      hero: arrivalClock,
      sub,
      color: q.accent,
      heroLarge: true,
    };
  }
  return { hero: copy.scheduled, sub, color: q.subtext };
}

function QuickStatusBlock({
  flight,
  mode,
  timeFormat12h,
  compact = false,
}: {
  flight: QuickFlight;
  mode: 'departure' | 'arrival';
  timeFormat12h: boolean;
  compact?: boolean;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (mode !== 'arrival' || flight.status === 'landed' || flight.status === 'cancelled') return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [flight.status, mode]);

  const view = mode === 'arrival'
    ? buildArrivalStatus(flight, timeFormat12h, now, q)
    : buildDepartureStatus(flight, timeFormat12h, q);

  return (
    <View style={[st.statusBlock, compact && st.statusBlockCompact]}>
      <Text
        style={[
          view.heroLarge ? st.statusHeroLarge : st.statusHero,
          compact && st.statusHeroCompact,
          view.heroLarge && compact && st.statusHeroLargeCompact,
          { color: view.color },
        ]}
        numberOfLines={2}
      >
        {view.hero}
      </Text>
      {view.sub ? (
        <Text style={[st.statusSub, compact && st.statusSubCompact]} numberOfLines={1}>{view.sub}</Text>
      ) : null}
    </View>
  );
}

function LandedExtras({
  flight,
  now,
}: {
  flight: QuickFlight;
  now: number;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const belt = cleanBaggageBelt(flight.baggage);
  const showTransport = pickupShowTransport(flight, now);

  return (
    <>
      <Text style={st.pickupSubTxt}>
        {belt ? `🧳 Baggage: Belt ${belt}` : '🧳 Baggage: checking...'}
      </Text>
      {showTransport ? (
        <View style={st.transportRow}>
          <TransportButton label="🚗 Grab" onPress={openGrabPickup} />
          <TransportButton label="🚕 Taxi" onPress={openTaxiPickup} />
          <TransportButton label="🚇 MRT/BTS" onPress={() => openTransitPickup(flight)} />
        </View>
      ) : null}
    </>
  );
}

function openGrabPickup(): void {
  void Linking.openURL(GRAB_DEEPLINK).catch(() => {});
}

function openTaxiPickup(): void {
  Alert.alert('Taxi', 'Call a taxi?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Call', onPress: () => { void Linking.openURL('tel:').catch(() => {}); } },
  ]);
}

function openTransitPickup(f: QuickFlight): void {
  const airport = `${f.destCity || f.destination} Airport`;
  const dest = f.destCity || 'city centre';
  const url =
    `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(airport)}` +
    `&destination=${encodeURIComponent(dest)}&travelmode=transit`;
  void Linking.openURL(url).catch(() => {});
}

function statusPillStyle(status: string, q: QuickThemeColors): { bg: string; fg: string } {
  switch (status) {
    case 'cancelled':
      return { bg: RED, fg: q.text };
    case 'delayed':
      return { bg: q.accent, fg: q.onAccent };
    case 'boarding':
    case 'landed':
    case 'en-route':
    case 'scheduled':
      return { bg: GREEN, fg: q.onAccent };
    default:
      return { bg: q.accent, fg: q.onAccent };
  }
}

function TrackingDot({ active }: { active: boolean }) {
  const { styles: st } = useQuickTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      opacity.stopAnimation();
      scale.stopAnimation();
      opacity.setValue(1);
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(scale, {
            toValue: 1.12,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(scale, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [active, opacity, scale]);

  if (!active) return null;

  return (
    <Animated.View
      style={[st.trackBtnDotInline, { opacity, transform: [{ scale }] }]}
      pointerEvents="none"
    >
      <View style={st.trackBtnDotRing} />
      <View style={st.trackBtnDot} />
    </Animated.View>
  );
}

function FlightRouteMap({
  flight,
  mapHeight = ROUTE_MAP_H,
  embedded = false,
  showOverlay = true,
}: {
  flight: QuickFlight;
  mapHeight?: number;
  embedded?: boolean;
  showOverlay?: boolean;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const o = airportCoords(flight.origin);
  const d = airportCoords(flight.destination);
  const depIso = resolveDepartureIso(flight);
  const arrIso = resolveArrivalIso(flight);
  const depMs = depIso ? flightClockUtcMs(depIso, flight.origin, flight.originCountry) : null;
  const arrMs = arrIso ? flightClockUtcMs(arrIso, flight.destination, flight.destCountry) : null;
  const durationMin = depMs != null && arrMs != null && arrMs > depMs
    ? Math.round((arrMs - depMs) / 60_000)
    : undefined;
  const progress = typeof flight.progress === 'number' && Number.isFinite(flight.progress)
    ? flight.progress
    : arcProgressForStatus(flight.status);
  const h = Math.max(EMBEDDED_MAP_MIN_H, mapHeight);

  const mapNode = (
    <RouteMapEmbed
      height={h}
      compact
      showOverlay={showOverlay}
      showStatusInOverlay={false}
      origin={flight.origin}
      destination={flight.destination}
      originCity={flight.originCity}
      destCity={flight.destCity}
      originLat={o?.lat}
      originLon={o?.lon}
      destLat={d?.lat}
      destLon={d?.lon}
      liveLat={flight.lat}
      liveLng={flight.lng}
      headingDeg={flight.headingDeg}
      progress={progress}
      status={flight.status}
      flightId={flight.id}
      flightNumber={flight.number}
      airline={flight.airline}
      airlineCode={flight.airlineCode}
      delayMin={flight.delay}
      originCountry={flight.originCountry}
      destCountry={flight.destCountry}
      departureIso={depIso}
      scheduledDepIso={flight.scheduledDeparture}
      scheduledArrIso={flight.scheduledArrival}
      actualArrIso={flight.actualArrival || flight.actualTime}
      durationMin={durationMin}
    />
  );

  return (
    <View
      style={[
        st.routeMapWrap,
        embedded && st.routeMapWrapEmbedded,
        { height: h, minHeight: EMBEDDED_MAP_MIN_H },
      ]}
    >
      {mapNode}
    </View>
  );
}

function FlightCardIdentityRow({ flight }: { flight: QuickFlight }) {
  const { colors: q, styles: st } = useQuickTheme();
  const code = flight.airlineCode || airlineCodeFromFlight(flight.number);
  const route = `${flight.origin} → ${flight.destination}`;

  return (
    <View style={st.cardIdentityRow}>
      <AirlineLogo iata={code} name={flight.airline} size={36} preferAirhex />
      <View style={st.cardIdentityText}>
        <Text style={st.cardIdentityNumber} numberOfLines={1}>{flight.number}</Text>
        <Text style={st.cardIdentityRoute} numberOfLines={1}>{route}</Text>
      </View>
    </View>
  );
}

function TrackButton({
  flight,
  trackFlight,
  untrackFlight,
  tracking,
  onTrackingChange,
  compact = false,
  embedded = false,
}: {
  flight: QuickFlight;
  trackFlight: (flight: QuickFlight) => Promise<void>;
  untrackFlight?: (flight: QuickFlight) => Promise<void>;
  tracking: boolean;
  onTrackingChange: (next: boolean) => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const [busy, setBusy] = useState(false);
  const stopTracking = untrackFlight ?? trackFlight;

  const handleTrackToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (tracking) {
        await stopTracking(flight);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTrackingChange(false);
      } else {
        await trackFlight(flight);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onTrackingChange(true);
      }
    } catch {
      haptics.error();
    } finally {
      setBusy(false);
    }
  }, [busy, flight, onTrackingChange, stopTracking, trackFlight, tracking]);

  return (
    <View style={[st.trackBtnWrap, compact && st.trackBtnWrapCompact, embedded && st.trackBtnWrapEmbedded]}>
      <Pressable
        style={[st.trackBtn, compact && !embedded && st.trackBtnCompact, embedded && st.trackBtnEmbedded, tracking && st.trackBtnActive]}
        onPress={() => { void handleTrackToggle(); }}
        disabled={false}
        accessibilityRole="button"
        accessibilityState={{ disabled: false }}
        accessibilityLabel={tracking ? 'Stop tracking this flight' : 'Track this flight'}
      >
        {busy ? (
          <ActivityIndicator color={tracking ? q.accent : q.onAccent} />
        ) : (
          <View style={st.trackBtnInner}>
            <Ionicons
              name={tracking ? 'checkmark' : 'notifications-outline'}
              size={compact && !embedded ? 14 : 16}
              color={tracking ? q.accent : q.onAccent}
            />
            <Text
              style={[
                st.trackBtnTxt,
                compact && !embedded && st.trackBtnTxtCompact,
                tracking && st.trackBtnTxtActive,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
            >
              {tracking ? 'Tracking' : 'Track this flight'}
            </Text>
            <TrackingDot active={tracking} />
          </View>
        )}
      </Pressable>
    </View>
  );
}

function FlightCard({
  flight,
  stackCount = 1,
  timeFormat12h,
  compact = false,
  embedded = false,
  fitHeight = false,
  mapHeight = ROUTE_MAP_H,
  onPress,
  onDismiss,
  trackFlight,
  untrackFlight,
  tracking,
  onTrackingChange,
}: {
  flight: QuickFlight;
  stackCount?: number;
  timeFormat12h: boolean;
  compact?: boolean;
  embedded?: boolean;
  fitHeight?: boolean;
  mapHeight?: number;
  onPress?: () => void;
  onDismiss?: () => void;
  trackFlight?: (flight: QuickFlight) => Promise<void>;
  untrackFlight?: (flight: QuickFlight) => Promise<void>;
  tracking: boolean;
  onTrackingChange: (next: boolean) => void;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const [now, setNow] = useState(() => Date.now());
  const landed = flight.status === 'landed';
  const gateText = gateLine(flight);
  const pill = statusPillStyle(flight.status, q);
  const statusLabel = flightStatusLabel(flight.status) || flight.status;

  useEffect(() => {
    if (!landed) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [landed]);

  const metaBlock = (
    <View style={[st.cardMetaStack, fitHeight && st.cardMetaStackFit]}>
      <FlightCardPhaseTime flight={flight} timeFormat12h={timeFormat12h} />
      <View style={[st.cardMetaRow, embedded && st.cardMetaEmbedded, fitHeight && st.cardMetaFit]}>
        <Text style={[st.cardGate, compact && st.cardGateCompact, embedded && st.cardGateEmbedded]} numberOfLines={1}>
          {gateText}
        </Text>
        <View style={[st.statusPill, embedded && st.statusPillEmbedded, { backgroundColor: pill.bg }]}>
          <Text style={[st.statusPillTxt, { color: pill.fg }]}>{statusLabel}</Text>
        </View>
      </View>
    </View>
  );

  const trackBlock = trackFlight ? (
    <TrackButton
      flight={flight}
      trackFlight={trackFlight}
      untrackFlight={untrackFlight}
      tracking={tracking}
      onTrackingChange={onTrackingChange}
      compact={compact || fitHeight}
      embedded={embedded}
    />
  ) : null;

  if (embedded && fitHeight) {
    const resolvedMapH = Math.max(QUICK_CARD_MAP_MIN_H, Math.min(QUICK_CARD_MAP_H, mapHeight));
    return (
      <View style={st.cardFlowColumn}>
        {onDismiss ? (
          <Pressable
            style={[st.cardDismiss, st.cardDismissEmbedded]}
            onPress={() => {
              haptics.light();
              onDismiss();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove flight"
          >
            <Ionicons name="close" size={18} color={q.subtext} />
          </Pressable>
        ) : null}
        <View style={[st.cardMapFixed, { height: resolvedMapH }]}>
          <FlightRouteMap
            flight={flight}
            embedded
            mapHeight={resolvedMapH}
            showOverlay={false}
          />
          {onPress ? (
            <Pressable
              style={st.cardMapTap}
              onPress={onPress}
              accessibilityRole="button"
            />
          ) : null}
        </View>
        <FlightCardIdentityRow flight={flight} />
        <View style={st.cardInfoRow}>
          {metaBlock}
        </View>
      </View>
    );
  }

  if (embedded) {
    return (
      <View style={[st.card, st.cardEmbedded]}>
        {onDismiss ? (
          <Pressable
            style={[st.cardDismiss, st.cardDismissEmbedded]}
            onPress={() => {
              haptics.light();
              onDismiss();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove flight"
          >
            <Ionicons name="close" size={18} color={q.subtext} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole={onPress ? 'button' : 'text'}
        >
          <FlightRouteMap flight={flight} mapHeight={mapHeight} embedded />
        </Pressable>
        <View style={st.cardFooterEmbedded}>
          {metaBlock}
          {landed && !compact ? <LandedExtras flight={flight} now={now} /> : null}
          {trackBlock}
        </View>
      </View>
    );
  }

  return (
    <View style={[st.card, compact ? st.cardCompact : null]}>
      {onDismiss ? (
        <Pressable
          style={st.cardDismiss}
          onPress={() => {
            haptics.light();
            onDismiss();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove flight"
        >
          <Ionicons name="close" size={18} color={q.subtext} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        style={compact ? st.cardPressCompact : undefined}
      >
        <FlightRouteMap flight={flight} mapHeight={mapHeight} embedded={false} />
        <View style={st.cardMeta}>
          {metaBlock}
          {landed && !compact ? <LandedExtras flight={flight} now={now} /> : null}
        </View>
      </Pressable>
      {trackBlock}
    </View>
  );
}

function TransportButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  return (
    <Pressable
      style={st.transportBtn}
      onPress={() => {
        haptics.light();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={st.transportBtnTxt}>{label}</Text>
    </Pressable>
  );
}

function PickupFlightCard({
  flight,
  stackCount = 1,
  timeFormat12h,
  compact = false,
  embedded = false,
  fitHeight = false,
  mapHeight = ROUTE_MAP_H,
  onPress,
  onDismiss,
  trackFlight,
  untrackFlight,
  tracking,
  onTrackingChange,
}: {
  flight: QuickFlight;
  stackCount?: number;
  timeFormat12h: boolean;
  compact?: boolean;
  embedded?: boolean;
  fitHeight?: boolean;
  mapHeight?: number;
  onPress?: () => void;
  onDismiss?: () => void;
  trackFlight?: (flight: QuickFlight) => Promise<void>;
  untrackFlight?: (flight: QuickFlight) => Promise<void>;
  tracking: boolean;
  onTrackingChange: (next: boolean) => void;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const [now, setNow] = useState(() => Date.now());
  const landed = flight.status === 'landed';

  useEffect(() => {
    if (!landed) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [landed]);

  const metaBlock = (
    <View style={[st.cardMeta, embedded && st.cardMetaEmbedded, fitHeight && st.cardMetaFit]}>
      <QuickStatusBlock flight={flight} mode="arrival" timeFormat12h={timeFormat12h} compact={compact || fitHeight} />
      {landed && !compact && !fitHeight ? <LandedExtras flight={flight} now={now} /> : null}
    </View>
  );

  const trackBlock = trackFlight ? (
    <TrackButton
      flight={flight}
      trackFlight={trackFlight}
      untrackFlight={untrackFlight}
      tracking={tracking}
      onTrackingChange={onTrackingChange}
      compact={compact || fitHeight}
      embedded={embedded}
    />
  ) : null;

  if (embedded && fitHeight) {
    const resolvedMapH = Math.max(QUICK_CARD_MAP_MIN_H, Math.min(QUICK_CARD_MAP_H, mapHeight));
    return (
      <View style={st.cardFlowColumn}>
        {onDismiss ? (
          <Pressable
            style={[st.cardDismiss, st.cardDismissEmbedded]}
            onPress={() => {
              haptics.light();
              onDismiss();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove flight"
          >
            <Ionicons name="close" size={18} color={q.subtext} />
          </Pressable>
        ) : null}
        <View style={[st.cardMapFixed, { height: resolvedMapH }]}>
          <FlightRouteMap
            flight={flight}
            embedded
            mapHeight={resolvedMapH}
            showOverlay={false}
          />
          {onPress ? (
            <Pressable
              style={st.cardMapTap}
              onPress={onPress}
              accessibilityRole="button"
            />
          ) : null}
        </View>
        <FlightCardIdentityRow flight={flight} />
        <View style={st.cardInfoRow}>
          {metaBlock}
        </View>
      </View>
    );
  }

  if (embedded) {
    return (
      <View style={[st.card, st.cardEmbedded]}>
        {onDismiss ? (
          <Pressable
            style={[st.cardDismiss, st.cardDismissEmbedded]}
            onPress={() => {
              haptics.light();
              onDismiss();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Remove flight"
          >
            <Ionicons name="close" size={18} color={q.subtext} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onPress}
          disabled={!onPress}
          accessibilityRole={onPress ? 'button' : 'text'}
        >
          <FlightRouteMap flight={flight} mapHeight={mapHeight} embedded />
        </Pressable>
        <View style={st.cardFooterEmbedded}>
          {metaBlock}
          {trackBlock}
        </View>
      </View>
    );
  }

  return (
    <View style={[st.card, compact ? st.cardCompact : null]}>
      {onDismiss ? (
        <Pressable
          style={st.cardDismiss}
          onPress={() => {
            haptics.light();
            onDismiss();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove flight"
        >
          <Ionicons name="close" size={18} color={q.subtext} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        style={compact ? st.cardPressCompact : undefined}
      >
        <FlightRouteMap flight={flight} mapHeight={mapHeight} embedded={false} />
        {metaBlock}
      </Pressable>
      {trackBlock}
    </View>
  );
}

function BoardingPassScanRow({
  onPress,
  pinnedBottom,
  bottomInset = 0,
}: {
  onPress?: () => void;
  pinnedBottom?: boolean;
  bottomInset?: number;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const copy = t();
  const content = (
    <>
      <View style={st.scanTearLine} />
      <View style={st.scanCenter}>
        <Ionicons name="barcode-outline" size={18} color={q.accent} />
        <Text style={st.scanDividerTxt}>{copy.scanBoardingPass.toUpperCase()}</Text>
      </View>
      <View style={st.scanTearLine} />
    </>
  );

  if (pinnedBottom) {
    return (
      <View style={[st.scanBottomHost, { paddingBottom: bottomInset }]}>
        <Pressable
          style={st.scanDividerBottom}
          onPress={() => {
            if (!onPress) return;
            haptics.light();
            onPress();
          }}
          disabled={!onPress}
          accessibilityRole="button"
          accessibilityLabel={copy.scanBoardingPass}
        >
          {content}
        </Pressable>
      </View>
    );
  }

  return (
    <Pressable
      style={st.scanDivider}
      onPress={() => {
        if (!onPress) return;
        haptics.light();
        onPress();
      }}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={copy.scanBoardingPass}
    >
      {content}
    </Pressable>
  );
}

function QuickFlightsCapacityHint() {
  const { colors: q, styles: st } = useQuickTheme();
  const copy = t();
  return (
    <Text style={st.sectionCapacityHint}>
      {copy.quickFlightsMultiHint(MAX_SECTION_FLIGHTS)}
    </Text>
  );
}

function QuickFlightMetaPanel({
  flight,
  mode,
  timeFormat12h,
}: {
  flight: QuickFlight;
  mode: 'departure' | 'arrival';
  timeFormat12h: boolean;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  if (mode === 'arrival') {
    return (
      <View style={st.cardMetaPanel}>
        <FlightCardIdentityRow flight={flight} />
        <View style={st.cardInfoRow}>
          <View style={[st.cardMeta, st.cardMetaEmbedded, st.cardMetaFit]}>
            <QuickStatusBlock flight={flight} mode="arrival" timeFormat12h={timeFormat12h} compact />
          </View>
        </View>
      </View>
    );
  }

  const gateText = gateLine(flight);
  const pill = statusPillStyle(flight.status, q);
  const statusLabel = flightStatusLabel(flight.status) || flight.status;

  return (
    <View style={st.cardMetaPanel}>
      <FlightCardIdentityRow flight={flight} />
      <View style={st.cardInfoRow}>
        <View style={[st.cardMetaStack, st.cardMetaStackFit]}>
          <FlightCardPhaseTime flight={flight} timeFormat12h={timeFormat12h} />
          <View style={[st.cardMetaRow, st.cardMetaEmbedded, st.cardMetaFit]}>
            <Text style={[st.cardGate, st.cardGateCompact, st.cardGateEmbedded]} numberOfLines={1}>
              {gateText}
            </Text>
            <View style={[st.statusPill, st.statusPillEmbedded, { backgroundColor: pill.bg }]}>
              <Text style={[st.statusPillTxt, { color: pill.fg }]}>{statusLabel}</Text>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

function QuickFlightMapSlide({
  flight,
  mapHeight,
  pageWidth,
  onPress,
  onDismiss,
}: {
  flight: QuickFlight;
  mapHeight: number;
  pageWidth: number;
  onPress?: () => void;
  onDismiss: () => void;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const resolvedMapH = Math.max(QUICK_CARD_MAP_MIN_H, Math.min(QUICK_CARD_MAP_H, mapHeight));
  return (
    <View style={[st.cardMapSlide, { width: pageWidth, height: resolvedMapH }]}>
      <Pressable
        style={[st.cardDismiss, st.cardDismissEmbedded]}
        onPress={() => {
          haptics.light();
          onDismiss();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Remove flight"
      >
        <Ionicons name="close" size={18} color={q.subtext} />
      </Pressable>
      <View style={[st.cardMapFixed, { height: resolvedMapH }]}>
        <FlightRouteMap flight={flight} embedded mapHeight={resolvedMapH} showOverlay={false} />
        {onPress ? (
          <Pressable
            style={st.cardMapTap}
            onPress={onPress}
            accessibilityRole="button"
          />
        ) : null}
      </View>
    </View>
  );
}

function QuickFlightPager({
  flights,
  pageWidth,
  mapHeight,
  mapFlex = false,
  mode,
  timeFormat12h,
  onOpenFlight,
  onDismissFlight,
  trackFlight,
  untrackFlight,
  isFlightTracked,
}: {
  flights: QuickFlight[];
  pageWidth: number;
  mapHeight: number;
  mapFlex?: boolean;
  mode: 'departure' | 'arrival';
  timeFormat12h: boolean;
  onOpenFlight?: (flight: QuickFlight, mode: 'departure' | 'arrival') => void;
  onDismissFlight: (flight: QuickFlight) => void;
  trackFlight?: (flight: QuickFlight) => Promise<void>;
  untrackFlight?: (flight: QuickFlight) => Promise<void>;
  isFlightTracked?: (flight: QuickFlight) => boolean;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const [pageIndex, setPageIndex] = useState(0);
  const [mapClipHeight, setMapClipHeight] = useState(() =>
    Math.max(QUICK_CARD_MAP_MIN_H, Math.min(QUICK_CARD_MAP_H, mapHeight)),
  );
  const lastIndexRef = useRef(0);
  const listRef = useRef<FlatList<QuickFlight>>(null);
  const prevFlightCountRef = useRef(flights.length);
  const activeFlight = flights[Math.min(pageIndex, Math.max(0, flights.length - 1))];
  const resolvedMapHeight = Math.max(
    QUICK_CARD_MAP_MIN_H,
    Math.min(QUICK_CARD_MAP_H, mapFlex ? mapClipHeight : mapHeight),
  );
  const [tracking, setTracking] = useState(() => (
    activeFlight ? (isFlightTracked?.(activeFlight) ?? false) : false
  ));

  useEffect(() => {
    if (pageIndex >= flights.length) {
      setPageIndex(Math.max(0, flights.length - 1));
    }
  }, [flights.length, pageIndex]);

  useEffect(() => {
    setMapClipHeight(Math.max(QUICK_CARD_MAP_MIN_H, Math.min(QUICK_CARD_MAP_H, mapHeight)));
  }, [mapHeight]);

  useEffect(() => {
    if (!activeFlight) {
      setTracking(false);
      return;
    }
    setTracking(isFlightTracked?.(activeFlight) ?? false);
  }, [activeFlight?.id, activeFlight?.number, activeFlight?.scheduledTime, activeFlight, isFlightTracked]);

  useEffect(() => {
    if (flights.length <= prevFlightCountRef.current) {
      prevFlightCountRef.current = flights.length;
      return;
    }
    const newIndex = flights.length - 1;
    const scrollToNew = () => {
      listRef.current?.scrollToIndex({ index: newIndex, animated: true });
      setPageIndex(newIndex);
      lastIndexRef.current = newIndex;
    };
    requestAnimationFrame(scrollToNew);
    prevFlightCountRef.current = flights.length;
  }, [flights.length]);

  const onScrollEnd = useCallback((ev: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(ev.nativeEvent.contentOffset.x / pageWidth);
    const clamped = Math.max(0, Math.min(next, flights.length - 1));
    if (clamped !== lastIndexRef.current) {
      lastIndexRef.current = clamped;
      haptics.light();
    }
    setPageIndex(clamped);
  }, [flights.length, pageWidth]);

  const renderPage = useCallback(({ item }: { item: QuickFlight; index: number }) => (
    <QuickFlightMapSlide
      flight={item}
      mapHeight={resolvedMapHeight}
      pageWidth={pageWidth}
      onPress={onOpenFlight ? () => onOpenFlight(item, mode) : undefined}
      onDismiss={() => onDismissFlight(item)}
    />
  ), [
    resolvedMapHeight,
    mode,
    onDismissFlight,
    onOpenFlight,
    pageWidth,
  ]);

  return (
    <View style={[st.pagerRoot, mapFlex && st.pagerRootFill]}>
      <View
        style={[st.pagerMapClip, mapFlex && st.pagerMapClipFlex]}
        onLayout={mapFlex
          ? (ev) => {
            const h = Math.round(ev.nativeEvent.layout.height);
            if (h >= QUICK_CARD_MAP_MIN_H) {
              setMapClipHeight(Math.min(QUICK_CARD_MAP_H, h));
            }
          }
          : undefined}
      >
        <FlatList
        ref={listRef}
        data={flights}
        keyExtractor={item => item.id || `${item.number}-${item.scheduledTime}`}
        renderItem={renderPage}
        horizontal
        pagingEnabled
        bounces={flights.length > 1}
        scrollEnabled={flights.length > 1}
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={pageWidth}
        snapToAlignment="start"
        disableIntervalMomentum
        onMomentumScrollEnd={onScrollEnd}
        getItemLayout={(_, index) => ({
          length: pageWidth,
          offset: pageWidth * index,
          index,
        })}
        onScrollToIndexFailed={info => {
          setTimeout(() => {
            listRef.current?.scrollToOffset({
              offset: info.averageItemLength * info.index,
              animated: true,
            });
          }, 80);
        }}
        style={[st.pagerList, { height: resolvedMapHeight }]}
      />
      </View>
      {activeFlight ? (
        <QuickFlightMetaPanel
          flight={activeFlight}
          mode={mode}
          timeFormat12h={timeFormat12h}
        />
      ) : null}
      {flights.length >= 1 ? (
        <View
          style={st.pagerDots}
          accessibilityLabel={`Flight ${pageIndex + 1} of ${flights.length}, ${MAX_SECTION_FLIGHTS} max`}
        >
          {Array.from({ length: MAX_SECTION_FLIGHTS }, (_, i) => {
            const hasFlight = i < flights.length;
            const active = hasFlight && i === pageIndex;
            return (
              <View
                key={`slot-${i}`}
                style={[
                  st.pagerDot,
                  hasFlight ? st.pagerDotFilled : st.pagerDotSlot,
                  active && st.pagerDotActive,
                ]}
              />
            );
          })}
        </View>
      ) : null}
      {trackFlight && activeFlight ? (
        <View style={st.cardTrackSlot}>
          <TrackButton
            flight={activeFlight}
            trackFlight={trackFlight}
            untrackFlight={untrackFlight}
            tracking={tracking}
            onTrackingChange={setTracking}
            compact
            embedded
          />
        </View>
      ) : null}
    </View>
  );
}

function FlightLookupInputRow({
  query,
  onQueryChange,
  placeholder,
  busy,
  disabled,
  error,
  onSubmit,
  accessibilityLabel,
}: {
  query: string;
  onQueryChange: (text: string) => void;
  placeholder: string;
  busy: boolean;
  disabled?: boolean;
  error?: string;
  onSubmit: () => void;
  accessibilityLabel: string;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const { inputProps: flightKeyboardProps, inputRef: flightInputRef } = useFlightNumberKeyboard(query, onQueryChange, {
    maxLength: 7,
  });

  const closeKeyboard = () => {
    hideFlightNumberDigitBar();
    flightInputRef.current?.blur();
    Keyboard.dismiss();
  };

  const go = () => {
    closeKeyboard();
    onSubmit();
  };

  return (
    <View style={st.inputShellEmpty}>
      <View style={st.inputRow}>
        <View style={st.inputWrap}>
          <TextInput
            ref={flightInputRef}
            style={st.input}
            value={query}
            onChangeText={onQueryChange}
            placeholder={placeholder}
            placeholderTextColor={q.inputPlaceholder}
            keyboardType="ascii-capable"
            keyboardAppearance="dark"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            returnKeyType="go"
            onSubmitEditing={go}
            accessibilityLabel={accessibilityLabel}
            editable={!disabled && !busy}
            {...flightKeyboardProps}
          />
        </View>
        <Pressable
          style={[st.goBtn, (busy || disabled) && st.goBtnDisabled]}
          onPress={go}
          disabled={busy || disabled}
          accessibilityRole="button"
          accessibilityLabel="Go"
        >
          {busy ? (
            <ActivityIndicator color={q.onAccent} />
          ) : (
            <Text style={st.goBtnTxt}>Go</Text>
          )}
        </Pressable>
      </View>
      {error ? <Text style={st.errorTxt}>{error}</Text> : null}
    </View>
  );
}

function FlightLookupSection({
  emoji,
  title,
  placeholder,
  mode,
  sectionHeight,
  layoutMode = 'fit',
  fillRemaining = false,
  flights,
  onFlightsChange,
  lookupFlight,
  onOpenFlight,
  trackFlight,
  untrackFlight,
  isFlightTracked,
  timeFormat12h,
  onFlightAdded,
  inputSeed,
  inputSeedRequestId,
}: {
  emoji: string;
  title: string;
  placeholder: string;
  mode: 'departure' | 'arrival';
  sectionHeight: number;
  layoutMode?: 'scroll' | 'fit';
  fillRemaining?: boolean;
  flights: QuickFlight[];
  onFlightsChange: (next: QuickFlight[]) => void;
  lookupFlight: (number: string) => Promise<QuickFlight[]>;
  onOpenFlight?: (flight: QuickFlight, mode: 'departure' | 'arrival') => void;
  trackFlight?: (flight: QuickFlight) => Promise<void>;
  untrackFlight?: (flight: QuickFlight) => Promise<void>;
  isFlightTracked?: (flight: QuickFlight) => boolean;
  timeFormat12h: boolean;
  onFlightAdded?: (mode: 'departure' | 'arrival') => void;
  inputSeed?: string;
  inputSeedRequestId?: number;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const atCapacity = flights.length >= MAX_SECTION_FLIGHTS;
  const hasInputPanel = !atCapacity;
  const mapHeight = useMemo(
    () => quickMapHeight(sectionHeight, hasInputPanel),
    [hasInputPanel, sectionHeight],
  );
  const pagerPageWidth = Dimensions.get('window').width - 40;

  useEffect(() => {
    if (!inputSeedRequestId || mode !== 'departure') return;
    setQuery(inputSeed || '');
    setError('');
  }, [inputSeed, inputSeedRequestId, mode]);

  const submit = useCallback(async (overrideQuery?: string) => {
    const clean = cleanFlightInput(overrideQuery ?? query);
    if (!clean || busy || atCapacity) return;
    setBusy(true);
    setError('');
    haptics.light();
    try {
      const hits = await lookupFlight(clean);
      const hit = pickNearestFlight(hits);
      if (!hit) {
        setError('Flight not found');
        haptics.error();
        return;
      }
      let added = false;
      const prev = flights;
      if (prev.length < MAX_SECTION_FLIGHTS && !prev.some(f => sameQuickFlight(f, hit))) {
        added = true;
        onFlightsChange([...prev, hit]);
      }
      if (!added) {
        setError('Flight already added');
        haptics.error();
        return;
      }
      setQuery('');
      hideFlightNumberDigitBar();
      Keyboard.dismiss();
      onFlightAdded?.(mode);
      haptics.success();
    } catch {
      setError('Flight not found');
      haptics.error();
    } finally {
      setBusy(false);
    }
  }, [atCapacity, busy, flights, lookupFlight, mode, onFlightAdded, onFlightsChange, query]);

  const dismissFlight = useCallback((target: QuickFlight) => {
    onFlightsChange(flights.filter(f => !sameQuickFlight(f, target)));
    setError('');
  }, [flights, onFlightsChange]);

  const inputRow = (
    <FlightLookupInputRow
      query={query}
      onQueryChange={text => {
        setQuery(text);
        if (error) setError('');
      }}
      placeholder={placeholder}
      busy={busy}
      disabled={atCapacity}
      error={error}
      onSubmit={() => { void submit(); }}
      accessibilityLabel={title}
    />
  );

  return (
    <View style={[
      st.section,
      layoutMode === 'fit' && !fillRemaining && { height: sectionHeight },
      fillRemaining && st.sectionFill,
    ]}>
      <View style={st.sectionHeadRow}>
        <Text style={st.sectionLabel}>{emoji}  {title}</Text>
        {flights.length > 0 ? (
          <Text style={st.sectionCount}>
            {t().quickFlightsCount(flights.length, MAX_SECTION_FLIGHTS)}
          </Text>
        ) : null}
      </View>
      <View
        style={[st.sectionBody, flights.length === 0 && st.sectionBodyEmpty, flights.length > 0 && st.sectionBodyFill]}
      >
        {flights.length === 0 ? (
          mode === 'arrival' ? (
            <View style={st.sectionInputOnly}>
              <View style={st.inputShellEmpty}>
                {inputRow}
                <QuickFlightsCapacityHint />
              </View>
            </View>
          ) : (
            <View style={st.sectionPlaceholder}>
              <Text style={st.placeholderHint}>{t().enterFlightNumber}</Text>
              <View style={st.inputShellEmpty}>
                {inputRow}
                <QuickFlightsCapacityHint />
              </View>
            </View>
          )
        ) : (
          <View style={st.sectionPanelWrap}>
            {!atCapacity ? (
              <View style={st.sectionPanelInput}>
                {inputRow}
                <QuickFlightsCapacityHint />
              </View>
            ) : null}
            <QuickFlightPager
              flights={flights}
              pageWidth={pagerPageWidth}
              mapHeight={mapHeight}
              mapFlex={fillRemaining}
              mode={mode}
              timeFormat12h={timeFormat12h}
              onOpenFlight={onOpenFlight}
              onDismissFlight={dismissFlight}
              trackFlight={trackFlight}
              untrackFlight={untrackFlight}
              isFlightTracked={isFlightTracked}
            />
          </View>
        )}
      </View>
    </View>
  );
}

function QuickRadarEmptyLookup({
  lookupFlight,
  onAddFlight,
  inputSeed,
  inputSeedRequestId,
}: {
  lookupFlight: (number: string) => Promise<QuickFlight[]>;
  onAddFlight: (flight: QuickFlight) => void;
  inputSeed?: string;
  inputSeedRequestId?: number;
}) {
  const { colors: q, styles: st } = useQuickTheme();
  const copy = t();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!inputSeedRequestId) return;
    setQuery(inputSeed || '');
    setError('');
  }, [inputSeed, inputSeedRequestId]);

  const submit = useCallback(async (overrideQuery?: string) => {
    const clean = cleanFlightInput(overrideQuery ?? query);
    if (!clean || busy) return;
    setBusy(true);
    setError('');
    haptics.light();
    try {
      const hits = await lookupFlight(clean);
      const hit = pickNearestFlight(hits);
      if (!hit) {
        setError('Flight not found');
        haptics.error();
        return;
      }
      onAddFlight(hit);
      setQuery('');
      hideFlightNumberDigitBar();
      Keyboard.dismiss();
      haptics.success();
    } catch {
      setError('Flight not found');
      haptics.error();
    } finally {
      setBusy(false);
    }
  }, [busy, lookupFlight, onAddFlight, query]);

  return (
    <View style={st.radarLookupOverlayHost} pointerEvents="box-none">
      <View style={st.radarLookupOverlayTop} pointerEvents="none" />
      <View style={st.radarLookupOverlayPanel}>
        <View style={st.quickTagline}>
          <Text style={st.quickTagline1}>{copy.quickTagline1}</Text>
          <Text style={st.quickTagline2}>{copy.quickTagline2}</Text>
        </View>
        <FlightLookupInputRow
          query={query}
          onQueryChange={text => {
            setQuery(text);
            if (error) setError('');
          }}
          placeholder="TG403"
          busy={busy}
          error={error}
          onSubmit={() => { void submit(); }}
          accessibilityLabel={copy.quickSectionDeparting}
        />
      </View>
      <View style={st.radarLookupOverlayBottom} pointerEvents="none" />
    </View>
  );
}

export default function QuickScreen({
  airport,
  lookupFlight,
  onOpenFlight,
  trackFlight,
  untrackFlight,
  isFlightTracked,
  timeFormat12h = false,
  pollsActive = true,
  onOpenSettings,
  onScanBoardingPass,
  pendingDepartingScan,
  onPendingDepartingScanHandled,
  themeMode,
}: Props) {
  const { colors: q, styles: st } = useQuickTheme(themeMode);
  const copy = t();
  const year = new Date().getFullYear();
  const insets = useSafeAreaInsets();
  const windowHeight = Dimensions.get('window').height;
  const sectionHeight = quickSectionHeight(windowHeight, insets);
  const [departingFlights, setDepartingFlights] = useState<QuickFlight[]>([]);
  const [arrivingFlights, setArrivingFlights] = useState<QuickFlight[]>([]);
  const [departingInputSeed, setDepartingInputSeed] = useState('');
  const [departingInputSeedId, setDepartingInputSeedId] = useState(0);
  const showRadarEmpty = departingFlights.length === 0 && arrivingFlights.length === 0;
  const needsScroll = departingFlights.length > 0 && arrivingFlights.length > 0;
  const depSectionHeight = needsScroll
    ? sectionHeight
    : quickFullDepartureHeight(windowHeight, insets);
  const wasRadarEmptyRef = useRef(true);
  const bodyScrollRef = useRef<ScrollView>(null);
  const sectionLayoutY = useRef({ departure: 0, arrival: 0 });

  const scrollSectionCardIntoView = useCallback((mode: 'departure' | 'arrival') => {
    if (!needsScroll) return;
    const sectionY = sectionLayoutY.current[mode];
    const revealMapY = sectionY + QUICK_SECTION_LABEL_H + QUICK_PANEL_INPUT_H;
    setTimeout(() => {
      bodyScrollRef.current?.scrollTo({ y: Math.max(0, revealMapY - 8), animated: true });
    }, 120);
  }, [needsScroll]);

  useEffect(() => {
    if (showRadarEmpty) {
      wasRadarEmptyRef.current = true;
      return;
    }
    if (!wasRadarEmptyRef.current) return;
    wasRadarEmptyRef.current = false;
    if (departingFlights.length > 0) {
      scrollSectionCardIntoView('departure');
    }
  }, [showRadarEmpty, departingFlights.length, scrollSectionCardIntoView]);

  const addDepartingFromRadar = useCallback((flight: QuickFlight) => {
    setDepartingFlights(prev => {
      if (prev.some(f => sameQuickFlight(f, flight))) return prev;
      return [...prev, flight];
    });
    Keyboard.dismiss();
    hideFlightNumberDigitBar();
  }, []);

  useEffect(() => {
    if (!pendingDepartingScan?.flightNumber) return;
    const clean = cleanFlightInput(pendingDepartingScan.flightNumber);
    setDepartingInputSeed(clean);
    setDepartingInputSeedId(pendingDepartingScan.requestId);
    if (!clean) {
      onPendingDepartingScanHandled?.();
      return;
    }
    let cancelled = false;
    (async () => {
      haptics.light();
      try {
        const hits = await lookupFlight(clean);
        const hit = pickNearestFlight(hits);
        if (cancelled) return;
        if (!hit) {
          haptics.error();
          return;
        }
        addDepartingFromRadar(hit);
        haptics.success();
      } catch {
        if (!cancelled) haptics.error();
      } finally {
        if (!cancelled) onPendingDepartingScanHandled?.();
      }
    })();
    return () => { cancelled = true; };
  }, [
    addDepartingFromRadar,
    lookupFlight,
    onPendingDepartingScanHandled,
    pendingDepartingScan?.requestId,
    pendingDepartingScan?.flightNumber,
  ]);

  return (
    <QuickThemeModeContext.Provider value={themeMode}>
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? FLIGHT_NUMBER_DIGIT_BAR_HEIGHT : 0}
    >
      <View style={[showRadarEmpty ? st.body : st.bodyFlex, showRadarEmpty && st.bodyRadar]}>
        {showRadarEmpty ? (
          <>
            <View style={st.radarFill}>
              <QuickRadarEmbed
                airport={airport}
                lookupFlight={lookupFlight}
                mapTheme={q.isDark ? 'dark' : 'light'}
                onOpenFlight={onOpenFlight
                  ? (f, mode) => onOpenFlight(f as QuickFlight, mode)
                  : undefined}
                pollsActive={pollsActive}
              />
              <QuickRadarEmptyLookup
                lookupFlight={lookupFlight}
                onAddFlight={addDepartingFromRadar}
                inputSeed={departingInputSeed}
                inputSeedRequestId={departingInputSeedId}
              />
            </View>
            <BoardingPassScanRow
              pinnedBottom
              bottomInset={Math.max(insets.bottom, 8)}
              onPress={onScanBoardingPass}
            />
          </>
        ) : needsScroll ? (
          <ScrollView
            ref={bodyScrollRef}
            style={st.bodyScroll}
            contentContainerStyle={st.bodyScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View
              onLayout={ev => {
                sectionLayoutY.current.departure = ev.nativeEvent.layout.y;
              }}
            >
              <FlightLookupSection
                emoji="✈"
                title={copy.quickSectionDeparting}
                placeholder="TG403"
                mode="departure"
                sectionHeight={depSectionHeight}
                layoutMode="scroll"
                flights={departingFlights}
                onFlightsChange={setDepartingFlights}
                lookupFlight={lookupFlight}
                onOpenFlight={onOpenFlight}
                trackFlight={trackFlight}
                untrackFlight={untrackFlight}
                isFlightTracked={isFlightTracked}
                timeFormat12h={timeFormat12h}
                onFlightAdded={scrollSectionCardIntoView}
                inputSeed={departingInputSeed}
                inputSeedRequestId={departingInputSeedId}
              />
            </View>

            <BoardingPassScanRow onPress={onScanBoardingPass} />

            <View
              onLayout={ev => {
                sectionLayoutY.current.arrival = ev.nativeEvent.layout.y;
              }}
            >
              <FlightLookupSection
                emoji="👤"
                title={copy.quickSectionArriving}
                placeholder="TG403"
                mode="arrival"
                sectionHeight={sectionHeight}
                layoutMode="scroll"
                flights={arrivingFlights}
                onFlightsChange={setArrivingFlights}
                lookupFlight={lookupFlight}
                onOpenFlight={onOpenFlight}
                trackFlight={trackFlight}
                untrackFlight={untrackFlight}
                isFlightTracked={isFlightTracked}
                timeFormat12h={timeFormat12h}
                onFlightAdded={scrollSectionCardIntoView}
              />
            </View>
          </ScrollView>
        ) : (
          <View style={st.bodySplit}>
            <View style={st.sectionDepFill}>
              <FlightLookupSection
                emoji="✈"
                title={copy.quickSectionDeparting}
                placeholder="TG403"
                mode="departure"
                sectionHeight={depSectionHeight}
                layoutMode="fit"
                fillRemaining={departingFlights.length > 0}
                flights={departingFlights}
                onFlightsChange={setDepartingFlights}
                lookupFlight={lookupFlight}
                onOpenFlight={onOpenFlight}
                trackFlight={trackFlight}
                untrackFlight={untrackFlight}
                isFlightTracked={isFlightTracked}
                timeFormat12h={timeFormat12h}
                onFlightAdded={scrollSectionCardIntoView}
                inputSeed={departingInputSeed}
                inputSeedRequestId={departingInputSeedId}
              />
            </View>

            <BoardingPassScanRow onPress={onScanBoardingPass} />

            <FlightLookupSection
              emoji="👤"
              title={copy.quickSectionArriving}
              placeholder="TG403"
              mode="arrival"
              sectionHeight={sectionHeight}
              layoutMode="fit"
              flights={arrivingFlights}
              onFlightsChange={setArrivingFlights}
              lookupFlight={lookupFlight}
              onOpenFlight={onOpenFlight}
              trackFlight={trackFlight}
              untrackFlight={untrackFlight}
              isFlightTracked={isFlightTracked}
              timeFormat12h={timeFormat12h}
              onFlightAdded={scrollSectionCardIntoView}
            />
          </View>
        )}
      </View>
      <Pressable
        style={[
          st.footer,
          {
            paddingHorizontal: 20,
            paddingBottom: Math.max(insets.bottom, 8) + 28,
          },
        ]}
        onPress={() => {
          haptics.light();
          onOpenSettings?.();
        }}
        disabled={!onOpenSettings}
        accessibilityRole="button"
        accessibilityLabel={copy.settings}
      >
        <Text style={st.footerCopy}>{`© ${year} WaiAir`}</Text>
      </Pressable>
    </KeyboardAvoidingView>
    </QuickThemeModeContext.Provider>
  );
}

