import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { compactTerminal, formatGateLabel, hasRealGate } from '../GateBadge';
import QuickRadarEmbed, { type QuickRadarAirport } from '../QuickRadarEmbed';
import RouteMapEmbed from '../RouteMapEmbed';
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

const BG = '#0f1117';
const CARD_BG = '#1a1c23';
const YELLOW = '#F5C518';
const INPUT_BG = '#3a3f4a';
const INPUT_PLACEHOLDER = '#c8c8c8';
const SCAN_MUTED = '#b0b0b0';
const WHITE = '#FFFFFF';
const GREY = '#888888';
const GREEN = '#22C55E';
const RED = '#FF3B30';
const ORANGE = '#FF9800';
const GRAB_DEEPLINK = 'https://call.grab.com/deeplink';
const TICK_MS = 30_000;
const FOOTNOTE = `#999999`;
const ROUTE_MAP_H = 200;
const MAX_SECTION_FLIGHTS = 2;
const EMBEDDED_MAP_MIN_H = 80;
const QUICK_CARD_INFO_H = 60;
const QUICK_CARD_TRACK_H = 44;

const QUICK_HEADER_H = 100;
const QUICK_SCANNER_H = 48;
const QUICK_SECTION_LABEL_H = 32;
const QUICK_SAFE_AREA_H = 44;

function quickSectionHeight(windowHeight: number, insets: { top: number; bottom: number }): number {
  const safeArea = Math.max(QUICK_SAFE_AREA_H, insets.top + insets.bottom);
  const remaining = windowHeight - QUICK_HEADER_H - QUICK_SCANNER_H - QUICK_SECTION_LABEL_H * 2 - safeArea;
  return Math.max(100, Math.floor(remaining / 2));
}

const QUICK_PANEL_INPUT_H = 62;
const QUICK_PEEK_INFO_H = 40;
const QUICK_PEEK_TRACK_H = QUICK_CARD_TRACK_H;

function quickHeroMapHeight(sectionHeight: number, hasPeek: boolean): number {
  const overhead =
    QUICK_SECTION_LABEL_H +
    QUICK_PANEL_INPUT_H +
    QUICK_CARD_INFO_H +
    QUICK_CARD_TRACK_H +
    (hasPeek ? QUICK_PEEK_INFO_H + QUICK_PEEK_TRACK_H + 8 : 0) +
    12;
  return Math.max(EMBEDDED_MAP_MIN_H, sectionHeight - overhead);
}

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

function buildDepartureStatus(f: QuickFlight, timeFormat12h: boolean): QuickStatusView {
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
      return { hero: `🟢 ${copy.boardingNow} · ${gate}`, color: YELLOW };
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
        color: YELLOW,
      };
    default:
      return { hero: copy.scheduled, sub: gate, color: GREY };
  }
}

function buildArrivalStatus(f: QuickFlight, timeFormat12h: boolean, now: number): QuickStatusView {
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
    return { hero: landsIn, sub, color: YELLOW, heroLarge: true };
  }
  if (arrivalClock && arrivalClock !== EMPTY_CLOCK) {
    return {
      hero: arrivalClock,
      sub,
      color: YELLOW,
      heroLarge: true,
    };
  }
  return { hero: copy.scheduled, sub, color: GREY };
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
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (mode !== 'arrival' || flight.status === 'landed' || flight.status === 'cancelled') return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [flight.status, mode]);

  const view = mode === 'arrival'
    ? buildArrivalStatus(flight, timeFormat12h, now)
    : buildDepartureStatus(flight, timeFormat12h);

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

function statusPillStyle(status: string): { bg: string; fg: string } {
  switch (status) {
    case 'cancelled':
      return { bg: '#FF3B30', fg: WHITE };
    case 'delayed':
      return { bg: YELLOW, fg: BG };
    case 'boarding':
    case 'landed':
    case 'en-route':
    case 'scheduled':
      return { bg: '#22C55E', fg: BG };
    default:
      return { bg: YELLOW, fg: BG };
  }
}

function TrackingDot({ active }: { active: boolean }) {
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
      style={[st.trackBtnDotWrap, { opacity, transform: [{ scale }] }]}
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
}: {
  flight: QuickFlight;
  mapHeight?: number;
  embedded?: boolean;
}) {
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
      showOverlay
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
  untrackFlight: (flight: QuickFlight) => Promise<void>;
  tracking: boolean;
  onTrackingChange: (next: boolean) => void;
  compact?: boolean;
  embedded?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const handleTrackToggle = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (tracking) {
        await untrackFlight(flight);
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
  }, [busy, flight, onTrackingChange, trackFlight, tracking, untrackFlight]);

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
          <ActivityIndicator color={tracking ? YELLOW : '#000000'} />
        ) : (
          <View style={st.trackBtnInner}>
            <Ionicons
              name={tracking ? 'checkmark' : 'notifications-outline'}
              size={compact ? 14 : 16}
              color={tracking ? YELLOW : '#000000'}
            />
            <Text style={[st.trackBtnTxt, compact && st.trackBtnTxtCompact, tracking && st.trackBtnTxtActive]}>
              {tracking ? 'Tracking' : 'Track this flight'}
            </Text>
          </View>
        )}
      </Pressable>
      <TrackingDot active={tracking} />
    </View>
  );
}

function FlightCard({
  flight,
  stackCount = 1,
  heroMapHeight,
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
  heroMapHeight?: number;
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
  const [now, setNow] = useState(() => Date.now());
  const landed = flight.status === 'landed';
  const gateText = gateLine(flight);
  const pill = statusPillStyle(flight.status);
  const statusLabel = flightStatusLabel(flight.status) || flight.status;
  const resolvedMapH = Math.max(EMBEDDED_MAP_MIN_H, heroMapHeight ?? mapHeight ?? ROUTE_MAP_H);

  useEffect(() => {
    if (!landed) return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [landed]);

  const metaBlock = landed ? (
    <QuickStatusBlock flight={flight} mode="departure" timeFormat12h={timeFormat12h} compact={compact || fitHeight} />
  ) : (
    <View style={[st.cardMetaRow, embedded && st.cardMetaEmbedded, fitHeight && st.cardMetaFit]}>
      <Text style={[st.cardGate, compact && st.cardGateCompact, embedded && st.cardGateEmbedded]} numberOfLines={1}>
        {gateText}
      </Text>
      <View style={[st.statusPill, embedded && st.statusPillEmbedded, { backgroundColor: pill.bg }]}>
        <Text style={[st.statusPillTxt, { color: pill.fg }]}>{statusLabel}</Text>
      </View>
    </View>
  );

  const trackBlock = trackFlight && untrackFlight ? (
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
    return (
      <View style={[st.card, st.cardEmbedded, st.cardEmbeddedFit]}>
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
            <Ionicons name="close" size={18} color={GREY} />
          </Pressable>
        ) : null}
        <View style={st.cardFitBody}>
          <View style={[st.cardMapFixed, { height: resolvedMapH }]}>
            <FlightRouteMap flight={flight} embedded mapHeight={resolvedMapH} />
            {onPress ? (
              <Pressable
                style={st.cardMapTap}
                onPress={onPress}
                accessibilityRole="button"
              />
            ) : null}
          </View>
          <View style={st.cardInfoRow}>
            {metaBlock}
          </View>
          {trackBlock ? (
            <View style={st.cardTrackSlot}>
              {trackBlock}
            </View>
          ) : null}
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
            <Ionicons name="close" size={18} color={GREY} />
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
          <Ionicons name="close" size={18} color={GREY} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : 'text'}
        style={compact ? st.cardPressCompact : undefined}
      >
        <FlightRouteMap flight={flight} mapHeight={mapHeight} embedded={false} />
        {landed ? (
          <View style={st.cardMeta}>
            {metaBlock}
            {!compact ? <LandedExtras flight={flight} now={now} /> : null}
          </View>
        ) : (
          <View style={st.cardMeta}>
            <Text style={[st.cardGate, compact && st.cardGateCompact]} numberOfLines={1}>{gateText}</Text>
            <View style={[st.statusPill, { backgroundColor: pill.bg }]}>
              <Text style={[st.statusPillTxt, { color: pill.fg }]}>{statusLabel}</Text>
            </View>
          </View>
        )}
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
  heroMapHeight,
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
  heroMapHeight?: number;
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
  const [now, setNow] = useState(() => Date.now());
  const landed = flight.status === 'landed';
  const resolvedMapH = Math.max(EMBEDDED_MAP_MIN_H, heroMapHeight ?? mapHeight ?? ROUTE_MAP_H);

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

  const trackBlock = trackFlight && untrackFlight ? (
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
    return (
      <View style={[st.card, st.cardEmbedded, st.cardEmbeddedFit]}>
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
            <Ionicons name="close" size={18} color={GREY} />
          </Pressable>
        ) : null}
        <View style={st.cardFitBody}>
          <View style={[st.cardMapFixed, { height: resolvedMapH }]}>
            <FlightRouteMap flight={flight} embedded mapHeight={resolvedMapH} />
            {onPress ? (
              <Pressable
                style={st.cardMapTap}
                onPress={onPress}
                accessibilityRole="button"
              />
            ) : null}
          </View>
          <View style={st.cardInfoRow}>
            {metaBlock}
          </View>
          {trackBlock ? (
            <View style={st.cardTrackSlot}>
              {trackBlock}
            </View>
          ) : null}
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
            <Ionicons name="close" size={18} color={GREY} />
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
          <Ionicons name="close" size={18} color={GREY} />
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
  const copy = t();
  const content = (
    <>
      <View style={st.scanTearLine} />
      <View style={st.scanCenter}>
        <Ionicons name="barcode-outline" size={18} color={YELLOW} />
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

function QuickFlightPeek({
  flight,
  label,
  onPress,
  onDismiss,
  trackFlight,
  untrackFlight,
  isFlightTracked,
}: {
  flight: QuickFlight;
  label: string;
  onPress?: () => void;
  onDismiss: () => void;
  trackFlight?: (flight: QuickFlight) => Promise<void>;
  untrackFlight?: (flight: QuickFlight) => Promise<void>;
  isFlightTracked?: (flight: QuickFlight) => boolean;
}) {
  const route = `${(flight.origin || '').toUpperCase()} → ${(flight.destination || '').toUpperCase()}`;
  const [tracking, setTracking] = useState(() => isFlightTracked?.(flight) ?? false);

  useEffect(() => {
    setTracking(isFlightTracked?.(flight) ?? false);
  }, [flight.id, flight.number, flight.scheduledTime, isFlightTracked]);

  return (
    <View style={st.peekBlock}>
      <View style={st.peekBtn}>
        <Pressable
          style={st.peekMain}
          onPress={() => {
            haptics.light();
            onPress?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${flight.number} ${route}`}
        >
          <Text style={st.peekBadge}>{label}</Text>
          <Text style={st.peekNum} numberOfLines={1}>{flight.number}</Text>
          <Text style={st.peekRoute} numberOfLines={1}>{route}</Text>
        </Pressable>
        <Pressable
          style={st.peekDismiss}
          onPress={() => {
            haptics.light();
            onDismiss();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Remove flight"
        >
          <Ionicons name="close" size={16} color={GREY} />
        </Pressable>
      </View>
      {trackFlight && untrackFlight ? (
        <TrackButton
          flight={flight}
          trackFlight={trackFlight}
          untrackFlight={untrackFlight}
          tracking={tracking}
          onTrackingChange={setTracking}
          compact
          embedded
        />
      ) : null}
    </View>
  );
}

function QuickSectionCard({
  flight,
  mode,
  stackCount,
  cardIndex,
  heroMapHeight,
  timeFormat12h,
  onOpenFlight,
  onDismiss,
  trackFlight,
  untrackFlight,
  isFlightTracked,
}: {
  flight: QuickFlight;
  mode: 'departure' | 'arrival';
  stackCount: number;
  cardIndex: number;
  heroMapHeight: number;
  timeFormat12h: boolean;
  onOpenFlight?: (flight: QuickFlight, mode: 'departure' | 'arrival') => void;
  onDismiss: () => void;
  trackFlight?: (flight: QuickFlight) => Promise<void>;
  untrackFlight?: (flight: QuickFlight) => Promise<void>;
  isFlightTracked?: (flight: QuickFlight) => boolean;
}) {
  const [tracking, setTracking] = useState(() => isFlightTracked?.(flight) ?? false);

  useEffect(() => {
    setTracking(isFlightTracked?.(flight) ?? false);
  }, [flight.id, flight.number, flight.scheduledTime, isFlightTracked]);

  const shared = {
    flight,
    stackCount,
    heroMapHeight,
    compact: true as const,
    embedded: true as const,
    fitHeight: true as const,
    timeFormat12h,
    onPress: onOpenFlight ? () => onOpenFlight(flight, mode) : undefined,
    onDismiss,
    trackFlight,
    untrackFlight,
    tracking,
    onTrackingChange: setTracking,
  };

  return (
    <View style={st.cardSlot}>
      {stackCount > 1 ? (
        <Text style={st.cardIndexBadge} accessibilityLabel={`Card ${cardIndex} of ${stackCount}`}>
          {cardIndex}/{stackCount}
        </Text>
      ) : null}
      {mode === 'arrival'
        ? <PickupFlightCard {...shared} />
        : <FlightCard {...shared} />}
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
  return (
    <View style={st.inputShellEmpty}>
      <View style={st.inputRow}>
        <View style={st.inputWrap}>
          <TextInput
            style={st.input}
            value={query}
            onChangeText={onQueryChange}
            placeholder={placeholder}
            placeholderTextColor={INPUT_PLACEHOLDER}
            keyboardType="ascii-capable"
            keyboardAppearance="dark"
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={7}
            returnKeyType="go"
            onSubmitEditing={onSubmit}
            accessibilityLabel={accessibilityLabel}
            editable={!disabled && !busy}
          />
        </View>
        <Pressable
          style={[st.goBtn, (busy || disabled) && st.goBtnDisabled]}
          onPress={onSubmit}
          disabled={busy || disabled}
          accessibilityRole="button"
          accessibilityLabel="Go"
        >
          {busy ? (
            <ActivityIndicator color={BG} />
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
  flights,
  onFlightsChange,
  lookupFlight,
  onOpenFlight,
  trackFlight,
  untrackFlight,
  isFlightTracked,
  timeFormat12h,
}: {
  emoji: string;
  title: string;
  placeholder: string;
  mode: 'departure' | 'arrival';
  sectionHeight: number;
  flights: QuickFlight[];
  onFlightsChange: (next: QuickFlight[]) => void;
  lookupFlight: (number: string) => Promise<QuickFlight[]>;
  onOpenFlight?: (flight: QuickFlight, mode: 'departure' | 'arrival') => void;
  trackFlight?: (flight: QuickFlight) => Promise<void>;
  untrackFlight?: (flight: QuickFlight) => Promise<void>;
  isFlightTracked?: (flight: QuickFlight) => boolean;
  timeFormat12h: boolean;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const atCapacity = flights.length >= MAX_SECTION_FLIGHTS;
  const hasPeek = flights.length > 1;
  const heroMapHeight = quickHeroMapHeight(sectionHeight, hasPeek);

  const submit = useCallback(async () => {
    const clean = cleanFlightInput(query);
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
      haptics.success();
    } catch {
      setError('Flight not found');
      haptics.error();
    } finally {
      setBusy(false);
    }
  }, [atCapacity, busy, flights, lookupFlight, onFlightsChange, query]);

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
    <View style={[st.section, { height: sectionHeight }]}>
      <Text style={st.sectionLabel}>{emoji}  {title}</Text>
      <View style={[st.sectionBody, flights.length === 0 && st.sectionBodyEmpty]}>
        {flights.length === 0 ? (
          mode === 'arrival' ? (
            <View style={st.sectionInputOnly}>
              {inputRow}
            </View>
          ) : (
            <View style={st.sectionPlaceholder}>
              <Text style={st.placeholderHint}>{t().enterFlightNumber}</Text>
              <View style={st.inputShellEmpty}>
                {inputRow}
              </View>
            </View>
          )
        ) : (
          <View style={st.sectionPanel}>
            {!atCapacity ? (
              <View style={st.sectionPanelInput}>
                {inputRow}
              </View>
            ) : null}
            <View style={st.cardsStack}>
              <QuickSectionCard
                key={flights[0].id || `${flights[0].number}-${flights[0].scheduledTime}`}
                flight={flights[0]}
                mode={mode}
                cardIndex={1}
                stackCount={flights.length}
                heroMapHeight={heroMapHeight}
                timeFormat12h={timeFormat12h}
                onOpenFlight={onOpenFlight}
                onDismiss={() => dismissFlight(flights[0])}
                trackFlight={trackFlight}
                untrackFlight={untrackFlight}
                isFlightTracked={isFlightTracked}
              />
              {flights.length > 1 ? (
                <View style={st.peekStack}>
                  {flights.slice(1).map((f, idx) => (
                    <QuickFlightPeek
                      key={f.id || `${f.number}-${f.scheduledTime}`}
                      flight={f}
                      label={`${idx + 2}/${flights.length}`}
                      onPress={onOpenFlight ? () => onOpenFlight(f, mode) : undefined}
                      onDismiss={() => dismissFlight(f)}
                      trackFlight={trackFlight}
                      untrackFlight={untrackFlight}
                      isFlightTracked={isFlightTracked}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </View>
  );
}

function QuickRadarEmptyLookup({
  lookupFlight,
  onAddFlight,
}: {
  lookupFlight: (number: string) => Promise<QuickFlight[]>;
  onAddFlight: (flight: QuickFlight) => void;
}) {
  const copy = t();
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = useCallback(async () => {
    const clean = cleanFlightInput(query);
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
}: Props) {
  const copy = t();
  const year = new Date().getFullYear();
  const insets = useSafeAreaInsets();
  const windowHeight = Dimensions.get('window').height;
  const sectionHeight = quickSectionHeight(windowHeight, insets);
  const [departingFlights, setDepartingFlights] = useState<QuickFlight[]>([]);
  const [arrivingFlights, setArrivingFlights] = useState<QuickFlight[]>([]);
  const showRadarEmpty = departingFlights.length === 0 && arrivingFlights.length === 0;

  const addDepartingFromRadar = useCallback((flight: QuickFlight) => {
    setDepartingFlights(prev => {
      if (prev.some(f => sameQuickFlight(f, flight))) return prev;
      return [...prev, flight];
    });
  }, []);

  return (
    <KeyboardAvoidingView
      style={st.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[st.body, showRadarEmpty && st.bodyRadar]}>
        {showRadarEmpty ? (
          <>
            <View style={st.radarFill}>
              <QuickRadarEmbed
                airport={airport}
                lookupFlight={lookupFlight}
                onOpenFlight={onOpenFlight
                  ? (f, mode) => onOpenFlight(f as QuickFlight, mode)
                  : undefined}
                pollsActive={pollsActive}
              />
              <QuickRadarEmptyLookup
                lookupFlight={lookupFlight}
                onAddFlight={addDepartingFromRadar}
              />
            </View>
            <BoardingPassScanRow
              pinnedBottom
              bottomInset={Math.max(insets.bottom, 8)}
              onPress={onScanBoardingPass}
            />
          </>
        ) : (
          <>
            <FlightLookupSection
              emoji="✈"
              title={copy.quickSectionDeparting}
              placeholder="TG403"
              mode="departure"
              sectionHeight={sectionHeight}
              flights={departingFlights}
              onFlightsChange={setDepartingFlights}
              lookupFlight={lookupFlight}
              onOpenFlight={onOpenFlight}
              trackFlight={trackFlight}
              untrackFlight={untrackFlight}
              isFlightTracked={isFlightTracked}
              timeFormat12h={timeFormat12h}
            />

            <BoardingPassScanRow onPress={onScanBoardingPass} />

            <FlightLookupSection
              emoji="👤"
              title={copy.quickSectionArriving}
              placeholder="TG403"
              mode="arrival"
              sectionHeight={sectionHeight}
              flights={arrivingFlights}
              onFlightsChange={setArrivingFlights}
              lookupFlight={lookupFlight}
              onOpenFlight={onOpenFlight}
              trackFlight={trackFlight}
              untrackFlight={untrackFlight}
              isFlightTracked={isFlightTracked}
              timeFormat12h={timeFormat12h}
            />
          </>
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
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  bodyRadar: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 0,
    paddingTop: 0,
    position: 'relative',
  },
  radarFill: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    position: 'relative',
  },
  radarLookupOverlayHost: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'column',
    alignItems: 'stretch',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  radarLookupOverlayTop: {
    flex: 0.28,
    minHeight: 72,
  },
  radarLookupOverlayPanel: {
    backgroundColor: 'rgba(15, 17, 23, 0.85)',
    borderRadius: 12,
    padding: 12,
  },
  radarLookupOverlayBottom: {
    flex: 1,
  },
  section: {
    gap: 0,
    justifyContent: 'flex-start',
  },
  sectionLabel: {
    color: YELLOW,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    textTransform: 'uppercase',
    height: QUICK_SECTION_LABEL_H,
    lineHeight: QUICK_SECTION_LABEL_H,
  },
  sectionBody: {
    flex: 1,
    minHeight: 0,
  },
  sectionBodyEmpty: {
    justifyContent: 'center',
  },
  sectionInputOnly: {
    width: '100%',
    justifyContent: 'center',
  },
  sectionPlaceholder: {
    width: '100%',
    borderWidth: 2,
    borderColor: 'rgba(245, 197, 24, 0.55)',
    borderRadius: 14,
    backgroundColor: CARD_BG,
    paddingVertical: 20,
    paddingHorizontal: 14,
    gap: 12,
    alignItems: 'stretch',
  },
  sectionPanel: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 14,
    backgroundColor: CARD_BG,
    overflow: 'hidden',
  },
  sectionPanelInput: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245, 197, 24, 0.22)',
    gap: 4,
    flexShrink: 0,
  },
  cardsStack: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  cardSlot: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
  },
  cardIndexBadge: {
    position: 'absolute',
    top: 4,
    left: 6,
    zIndex: 3,
    color: YELLOW,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    backgroundColor: 'rgba(15, 17, 23, 0.82)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  peekStack: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingBottom: 8,
    gap: 8,
  },
  peekBlock: {
    gap: 4,
  },
  peekBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.45)',
    backgroundColor: '#2f3540',
  },
  peekMain: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  peekBadge: {
    color: YELLOW,
    fontSize: 10,
    fontWeight: '800',
    minWidth: 28,
  },
  peekNum: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
  },
  peekRoute: {
    flex: 1,
    minWidth: 0,
    color: GREY,
    fontSize: 12,
    fontWeight: '600',
  },
  peekDismiss: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderHint: {
    color: '#d4d4d4',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  sectionInputTop: {
    width: '100%',
    marginBottom: 4,
  },
  inputShellEmpty: {
    width: '100%',
    gap: 6,
  },
  scanDivider: {
    height: QUICK_SCANNER_H,
    marginHorizontal: -20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: CARD_BG,
  },
  scanBottomHost: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  quickTagline: {
    marginBottom: 12,
    alignItems: 'center',
  },
  quickTagline1: {
    fontSize: 16,
    color: '#ffffff',
    fontWeight: '600',
    textAlign: 'center',
  },
  quickTagline2: {
    fontSize: 12,
    color: '#888888',
    fontWeight: '400',
    textAlign: 'center',
  },
  scanDividerBottom: {
    height: QUICK_SCANNER_H,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    backgroundColor: CARD_BG,
  },
  scanTearLine: {
    width: 3,
    height: 24,
    backgroundColor: YELLOW,
    borderRadius: 1,
  },
  scanCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  scanDividerTxt: {
    color: YELLOW,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  footer: {
    alignItems: 'flex-start',
    paddingTop: 8,
    gap: 2,
  },
  footerCopy: {
    color: FOOTNOTE,
    fontSize: 11,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inputWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(245, 197, 24, 0.45)',
    borderRadius: 10,
    backgroundColor: '#2f3540',
  },
  input: {
    flex: 1,
    backgroundColor: '#2f3540',
    borderWidth: 0,
    borderRadius: 10,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 14,
    height: 44,
  },
  goBtn: {
    backgroundColor: YELLOW,
    borderRadius: 10,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  goBtnDisabled: {
    opacity: 0.7,
  },
  goBtnTxt: {
    color: BG,
    fontSize: 15,
    fontWeight: '800',
  },
  errorTxt: {
    color: '#FF3B30',
    fontSize: 12,
    fontWeight: '600',
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    marginTop: 8,
  },
  cardCompact: {
    padding: 8,
    marginTop: 0,
    overflow: 'hidden',
    position: 'relative',
  },
  cardEmbedded: {
    borderWidth: 0,
    borderRadius: 0,
    backgroundColor: 'transparent',
    padding: 0,
    marginTop: 0,
  },
  cardEmbeddedFit: {
    flex: 1,
    minHeight: 0,
  },
  cardFitBody: {
    flex: 1,
    minHeight: 0,
  },
  cardMapFlex: {
    flex: 1,
    minHeight: EMBEDDED_MAP_MIN_H,
    position: 'relative',
  },
  cardMapFixed: {
    width: '100%',
    flexShrink: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  cardMapTap: {
    ...StyleSheet.absoluteFill,
  },
  cardInfoRow: {
    height: QUICK_CARD_INFO_H,
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    overflow: 'hidden',
  },
  cardTrackSlot: {
    height: QUICK_CARD_TRACK_H,
    flexShrink: 0,
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingBottom: 4,
  },
  cardMetaFit: {
    marginTop: 0,
    gap: 0,
  },
  cardFooterEmbedded: {
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 10,
    gap: 8,
  },
  cardMeta: {
    gap: 4,
  },
  cardMetaEmbedded: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  cardDismissEmbedded: {
    top: 4,
    right: 4,
    backgroundColor: 'rgba(15, 17, 23, 0.72)',
    borderRadius: 14,
  },
  cardPressCompact: {
    flexShrink: 0,
  },
  cardDismiss: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 2,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMapWrap: {
    marginHorizontal: -4,
    marginTop: 2,
    marginBottom: 0,
    borderRadius: 8,
    overflow: 'hidden',
  },
  routeMapWrapEmbedded: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
    minHeight: EMBEDDED_MAP_MIN_H,
    backgroundColor: '#07090f',
    width: '100%',
  },
  routeMapFill: {
    flex: 1,
    minHeight: EMBEDDED_MAP_MIN_H,
    width: '100%',
  },
  statusBlock: {
    marginTop: 4,
    gap: 2,
  },
  statusBlockCompact: {
    marginTop: 2,
    gap: 0,
  },
  statusHero: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  statusHeroCompact: {
    fontSize: 14,
  },
  statusHeroLarge: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.3,
    marginTop: 0,
  },
  statusHeroLargeCompact: {
    fontSize: 17,
  },
  statusSub: {
    color: GREY,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 1,
  },
  statusSubCompact: {
    fontSize: 11,
  },
  cardNumber: {
    color: WHITE,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardRoute: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '600',
  },
  cardGate: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  cardGateCompact: {
    fontSize: 12,
    marginTop: 0,
  },
  cardGateEmbedded: {
    flex: 1,
    marginTop: 0,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 2,
  },
  statusPillEmbedded: {
    alignSelf: 'auto',
    marginTop: 0,
    flexShrink: 0,
  },
  statusPillTxt: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  trackBtnWrap: {
    position: 'relative',
    width: '100%',
    marginTop: 8,
  },
  trackBtnWrapCompact: {
    marginTop: 4,
  },
  trackBtnWrapEmbedded: {
    marginTop: 0,
    height: QUICK_CARD_TRACK_H,
  },
  trackBtn: {
    width: '100%',
    height: 40,
    borderRadius: 10,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackBtnCompact: {
    height: 30,
    borderRadius: 8,
  },
  trackBtnEmbedded: {
    height: QUICK_CARD_TRACK_H,
    borderRadius: 8,
  },
  trackBtnDotWrap: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: BG,
    shadowColor: '#00C853',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 5,
    elevation: 5,
  },
  trackBtnDotRing: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: 'rgba(0, 200, 83, 0.45)',
  },
  trackBtnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00C853',
  },
  trackBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trackBtnActive: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: YELLOW,
  },
  trackBtnTxt: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  trackBtnTxtCompact: {
    fontSize: 11,
  },
  trackBtnTxtActive: {
    color: YELLOW,
  },
  pickupSubTxt: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  transportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  transportBtn: {
    backgroundColor: CARD_BG,
    borderWidth: 1,
    borderColor: YELLOW,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  transportBtnTxt: {
    color: YELLOW,
    fontSize: 11,
    fontWeight: '700',
  },
});
