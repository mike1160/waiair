import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AirplaneLanding,
  Armchair,
  CloudSun,
  Gear,
  IdentificationCard,
  Plus,
  Sun,
  Taxi,
  Warning,
  Wind,
} from 'phosphor-react-native';
import AirlineLogo, { airlineCodeFromFlight } from '../AirlineLogo';
import { FlightNumberText } from '../components/FlightNumberText';
import HomeNowCard from '../components/HomeNowCard';
import FlightStatusBadge, { statusBadgeToneFromPhase } from '../FlightStatusBadge';
import { airportRecByIata } from '../lib/airportsDb';
import { normalizeAirlineName } from '../lib/airlineDisplay';
import { getLocalizedCity } from '../lib/cityLocalized';
import { formatFlightNumber } from '../lib/flightIdent';
import {
  EMPTY_CLOCK,
  flightClockUtcMs,
  formatAirportClock,
  resolveArrivalIso,
  resolveDepartureIso,
} from '../lib/flightTimes';
import { haptics } from '../lib/haptics';
import {
  formatHomeNowLine,
  homeFlightDurationMs,
  homeModulesForPhase,
  homeRelativeDayLabel,
  homeRelativeDayOffset,
  isInternationalFlight,
  resolveHomeNow,
  type HomeNowFlight,
  type HomeNowPhase,
} from '../lib/homeNow';
import { flightStatusLabel, getLocale, t } from '../lib/i18n';
import type { ModuleId } from '../lib/modules';

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
};

type Props = {
  flights: HomeTrackedFlight[];
  colors: Colors;
  timeFormat12h?: boolean;
  confirmFlight?: string | null;
  onDismissConfirm: () => void;
  returnChipCity?: string | null;
  onReturnChip?: () => void;
  onOpenFlight: (flight: HomeTrackedFlight, module?: ModuleId) => void;
  onAddAnother: () => void;
  onOpenSettings: () => void;
};

function formatDuration(ms: number | null): string {
  if (ms == null || !(ms > 0)) return '';
  const totalMin = Math.max(0, Math.floor(ms / 60000));
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function clock(iso: string, iata: string, hour12: boolean, country?: string): string {
  const c = formatAirportClock(iso, iata, hour12, country);
  return !c || c === EMPTY_CLOCK ? '' : c;
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

function liveTone(phase: HomeNowPhase, status: string) {
  if (phase === 'in_flight') return statusBadgeToneFromPhase('enRoute');
  if (phase === 'boarding') return statusBadgeToneFromPhase('boarding');
  if (phase === 'baggage' || phase === 'transport' || phase === 'done') {
    return statusBadgeToneFromPhase('landed');
  }
  return statusBadgeToneFromPhase(status, { delayed: status === 'delayed' });
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
}: Props) {
  const insets = useSafeAreaInsets();
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
  const resolved = useMemo(
    () => (primary ? resolveHomeNow(primary, now, timeFormat12h) : null),
    [primary, now, timeFormat12h],
  );
  const nowLine = resolved
    ? formatHomeNowLine(resolved, {
      homeNowCheckin: copy.homeNowCheckin,
      homeNowLeave: copy.homeNowLeave,
      homeNowAtAirport: copy.homeNowAtAirport,
      homeNowGate: copy.homeNowGate,
      homeNowBoarding: copy.homeNowBoarding,
      homeNowLandsIn: copy.homeNowLandsIn,
      homeNowBelt: copy.homeNowBelt,
      homeNowTransport: copy.homeNowTransport,
      homeGoodTrip: copy.homeGoodTrip,
      gateTbdShort: copy.gateTbdShort,
    })
    : '';
  const modules = resolved
    ? homeModulesForPhase(resolved.phase, { international: isInternationalFlight(primary) })
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

  return (
    <View style={[styles.root, { backgroundColor: c.bg, paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <Text style={[styles.relDay, { color: c.text }]} numberOfLines={1}>{relLabel}</Text>
        <Pressable
          onPress={() => { haptics.light(); onOpenSettings(); }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={copy.settings}
          style={styles.settingsBtn}
        >
          <Gear size={20} color={c.muted} />
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
          colors={{ text: c.text, accent: c.accent, card: c.card, border: c.border }}
        />

        {modules.length ? (
          <View style={styles.modules}>
            {modules.map(id => (
              <Pressable
                key={id}
                onPress={() => { if (primary) { haptics.light(); onOpenFlight(primary, id); } }}
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

        {rest.map(f => (
          <HomeFlightCard
            key={f.id || f.number}
            flight={f}
            colors={c}
            timeFormat12h={timeFormat12h}
            compact
            onPress={() => { haptics.light(); onOpenFlight(f); }}
          />
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

        {returnChipCity && onReturnChip && !confirmFlight ? (
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
  const dep = clock(resolveDepartureIso(f), f.origin || '', timeFormat12h, f.originCountry);
  const arr = clock(resolveArrivalIso(f), f.destination || '', timeFormat12h, f.destCountry);
  const dur = formatDuration(homeFlightDurationMs(f));
  const times = [dep && arr ? `${dep} → ${arr}` : (dep || arr), dur].filter(Boolean).join(' · ');
  const status = flightStatusLabel(f.status || '') || f.status || '';
  const gate = resolvedGate(f.gate);
  const resolved = phase || resolveHomeNow(f, Date.now(), timeFormat12h).phase;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, compact && styles.cardCompact, { backgroundColor: c.card, borderColor: c.border }]}
      accessibilityRole="button"
      accessibilityLabel={copy.openFlightDetails(f.number)}
    >
      <AirlineLogo iata={code} name={f.airline} size={compact ? 32 : 40} preferAirhex />
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
        {times ? (
          <Text style={[styles.cardMeta, { color: c.secondary }]} numberOfLines={1}>{times}</Text>
        ) : null}
        <View style={styles.cardStatus}>
          {gate ? (
            <Text style={[styles.gate, { color: c.text }]} numberOfLines={1}>{copy.gate(gate)}</Text>
          ) : null}
          {status ? (
            <FlightStatusBadge label={status} tone={liveTone(resolved, String(f.status || ''))} />
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

function resolvedGate(gate?: string): string {
  const raw = String(gate || '').trim();
  if (!raw || /^(—|-|–|n\/?a|tba|tbd|null|undefined|\.+)$/i.test(raw)) return '';
  return raw.replace(/^gates?\s*:?\s*/i, '').trim();
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
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
  cardMeta: { fontSize: 12, marginTop: 4, fontWeight: '600' },
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
