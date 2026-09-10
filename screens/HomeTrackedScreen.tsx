import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
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
import { FlightNumberText } from '../components/FlightNumberText';
import Horizon from '../components/Horizon';
import HomeNowCard from '../components/HomeNowCard';
import FlightStatusBadge, { statusBadgeToneFromPhase } from '../FlightStatusBadge';
import { airportRecByIata } from '../lib/airportsDb';
import { normalizeAirlineName } from '../lib/airlineDisplay';
import { getLocalizedCity } from '../lib/cityLocalized';
import { formatFlightNumber } from '../lib/flightIdent';
import {
  flightClockUtcMs,
  resolveDepartureIso,
} from '../lib/flightTimes';
import { haptics } from '../lib/haptics';
import { horizonPlaneModeForPhase } from '../lib/horizon';
import {
  formatHomeNowLine,
  homeCardTimes,
  homeFlightDurationMs,
  homeModulesForPhase,
  homeNowCardChip,
  homeNowOverlayStatus,
  homeRelativeDayLabel,
  homeRelativeDayOffset,
  isInternationalFlight,
  resolveHomeNow,
  type HomeCardClockPart,
  type HomeNowFlight,
  type HomeNowPhase,
} from '../lib/homeNow';
import { taxiMinutes } from '../lib/destinationServices';
import { flightStatusLabel, getLocale, t } from '../lib/i18n';
import { getPrefs } from '../lib/prefs';
import type { ModuleId } from '../lib/modules';
import { PALETTE_TOKENS, skyFor, skyTopIsDark } from '../lib/themeTokens';

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
  airline?: string;
  airlineCode?: string;
  origin: string;
  destination: string;
  hasBoardingPass?: boolean;
};

type Props = {
  flights: HomeTrackedFlight[];
  colors: Colors;
  timeFormat12h?: boolean;
  confirmFlight?: string | null;
  onDismissConfirm: () => void;
  returnChipCity?: string | null;
  onReturnChip?: () => void;
  onOpenFlight: (flight: HomeTrackedFlight, module?: ModuleId | 'eu261') => void;
  onAddAnother: () => void;
  onOpenSettings: () => void;
  onUntrack: (flight: HomeTrackedFlight) => void;
  isDark?: boolean;
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

function liveTone(phase: HomeNowPhase, overlay: string) {
  return statusBadgeToneFromPhase(overlay || phase, { delayed: overlay === 'delayed' });
}

export default function HomeTrackedScreen({
  flights,
  colors: c,
  timeFormat12h = false,
  confirmFlight,
  onDismissConfirm,
  returnChipCity,
  onReturnChip,
  onOpenFlight,
  onAddAnother,
  onOpenSettings,
  onUntrack,
  isDark = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const copy = t();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!confirmFlight) return;
    const id = setTimeout(() => onDismissConfirm(), 2800);
    return () => clearTimeout(id);
  }, [confirmFlight, onDismissConfirm]);

  const primary = flights[0];
  const rest = flights.slice(1);
  const leaveOpts = useMemo(() => ({
    tight: getPrefs().airportTiming === 'tight',
    boardingPass: !!primary?.hasBoardingPass,
    travelMin: primary ? taxiMinutes(primary.origin) : null,
  }), [primary, now]);
  const resolved = useMemo(
    () => (primary ? resolveHomeNow(primary, now, timeFormat12h, leaveOpts) : null),
    [primary, now, timeFormat12h, leaveOpts],
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
  const relOffset = primary
    ? homeRelativeDayOffset(depMs, now, primary.origin, primary.originCountry)
    : 0;
  const relLabel = homeRelativeDayLabel(relOffset, {
    today: copy.today,
    tomorrow: copy.tomorrow,
    homeRelativeInDays: copy.homeRelativeInDays,
  });
  const skyScene = skyFor(new Date(now).getHours(), isDark);
  const skyIcon = skyTopIsDark(skyScene) ? '#FFFFFF' : PALETTE_TOKENS.light.navy;

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <Horizon
        isDark={isDark}
        band="tracked"
        plane={horizonPlaneModeForPhase(resolved?.phase)}
        width={width}
        insetTop={insets.top}
      />
      <View style={[styles.topBar, { paddingTop: insets.top }]} pointerEvents="box-none">
        <Text style={[styles.relDay, { color: skyIcon }]} numberOfLines={1}>{relLabel}</Text>
        <Pressable
          onPress={() => { haptics.light(); onOpenSettings(); }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={copy.settings}
          style={styles.settingsBtn}
        >
          <Gear size={20} color={skyIcon} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 24 }]}
      >
        {primary ? (
          <HomeFlightCard
            flight={primary}
            colors={c}
            timeFormat12h={timeFormat12h}
            phase={resolved?.phase}
            onPress={() => { haptics.light(); onOpenFlight(primary); }}
          />
        ) : null}

        <HomeNowCard
          line={nowLine}
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
              <View style={styles.modules}>
                {modules.map(id => (
                  <Pressable
                    key={id}
                    onPress={() => { haptics.light(); onOpenFlight(primary, id); }}
                    style={[styles.modChip, { backgroundColor: c.card, borderColor: c.border }]}
                    accessibilityRole="button"
                    accessibilityLabel={moduleLabel(id)}
                  >
                    <ModuleIcon id={id} color={c.accent} />
                    <Text style={[styles.modTxt, { color: c.text }]} numberOfLines={1}>{moduleLabel(id)}</Text>
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

        {rest.map(f => (
          <View key={f.id || f.number}>
            <HomeFlightCard
              flight={f}
              colors={c}
              timeFormat12h={timeFormat12h}
              compact
              onPress={() => { haptics.light(); onOpenFlight(f); }}
            />
            <StopFollowingLink flight={f} colors={c} onUntrack={onUntrack} spacing />
          </View>
        ))}

        <Pressable
          onPress={() => { haptics.medium(); onAddAnother(); }}
          style={[styles.addBtn, { borderColor: c.border, backgroundColor: c.card }]}
          accessibilityRole="button"
          accessibilityLabel={copy.homeAddAnother}
        >
          <Plus size={18} color={c.accent} weight="bold" />
          <Text style={[styles.addTxt, { color: c.accent }]}>{copy.homeAddAnother}</Text>
        </Pressable>

        {returnChipCity && onReturnChip && !confirmFlight && !cancelledOverride ? (
          <Pressable
            onPress={() => { haptics.light(); onReturnChip(); }}
            style={[styles.returnChip, { borderColor: c.border, backgroundColor: c.card }]}
            accessibilityRole="button"
            accessibilityLabel={copy.homeAlsoFlyingBack(returnChipCity)}
          >
            <Text style={[styles.returnChipTxt, { color: c.text }]}>
              {copy.homeAlsoFlyingBack(returnChipCity)}
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      {confirmFlight ? (
        <View style={[styles.confirm, { backgroundColor: c.bg }]} pointerEvents="box-none">
          <Pressable
            onPress={() => { haptics.light(); onDismissConfirm(); }}
            accessibilityRole="button"
            style={styles.confirmInner}
          >
            <Text style={[styles.confirmTitle, { color: c.text }]}>{copy.homeGoodTrip}</Text>
            <Text style={[styles.confirmBody, { color: c.muted }]}>
              {copy.homeWatchingFlight(formatFlightNumber({ number: confirmFlight }))}
            </Text>
          </Pressable>
          {returnChipCity && onReturnChip ? (
            <Pressable
              onPress={() => { haptics.light(); onReturnChip(); }}
              style={[styles.returnChip, { borderColor: c.border, backgroundColor: c.card, marginTop: 20 }]}
              accessibilityRole="button"
              accessibilityLabel={copy.homeAlsoFlyingBack(returnChipCity)}
            >
              <Text style={[styles.returnChipTxt, { color: c.text }]}>
                {copy.homeAlsoFlyingBack(returnChipCity)}
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
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

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, compact && styles.cardCompact, { backgroundColor: c.card, borderColor: c.border }]}
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

function clockPair(part: HomeCardClockPart, colors: Colors) {
  return (
    <View style={styles.clockPair}>
      {part.strike && part.scheduled ? (
        <FlightNumberText style={[styles.cardMetaStrike, { color: colors.muted }]}>
          {part.scheduled}
        </FlightNumberText>
      ) : null}
      <FlightNumberText style={[styles.cardMeta, { color: colors.secondary }]}>
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
  if (!dep && !arr && !duration) return null;
  return (
    <View style={styles.cardTimes}>
      {dep ? clockPair(dep, c) : null}
      {dep && arr ? (
        <Text style={[styles.cardMeta, { color: c.secondary }]}>{' → '}</Text>
      ) : null}
      {arr ? clockPair(arr, c) : null}
      {duration ? (
        <Text style={[styles.cardMeta, { color: c.secondary }]}>{`${dep || arr ? ' · ' : ''}${duration}`}</Text>
      ) : null}
    </View>
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
    gap: 12,
  },
  relDay: { flex: 1, fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  settingsBtn: { padding: 6 },
  scroll: { flex: 1 },
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
  confirm: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  confirmInner: {
    width: '85%',
    maxWidth: 420,
    alignItems: 'center',
  },
  confirmTitle: { fontSize: 28, fontWeight: '800', textAlign: 'center', marginBottom: 12, alignSelf: 'center' },
  confirmBody: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
});
