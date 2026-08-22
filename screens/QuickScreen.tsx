import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
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
import { cleanBaggageBelt } from '../lib/baggageBelt';
import { slugFlightIdent } from '../lib/flightIdent';
import {
  EMPTY_CLOCK,
  flightClockUtcMs,
  formatAirportClock,
  resolveArrivalIso,
  resolveDepartureIso,
  type FlightClockFields,
} from '../lib/flightTimes';
import { flightStatusLabel } from '../lib/i18n';
import { haptics } from '../lib/haptics';

const BG = '#0f1117';
const CARD_BG = '#1a1c23';
const YELLOW = '#F5C518';
const INPUT_BG = '#1a1c23';
const WHITE = '#FFFFFF';
const GREY = '#888888';
const GREEN = '#22C55E';
const RED = '#FF3B30';
const GRAB_DEEPLINK = 'https://call.grab.com/deeplink';
const TICK_MS = 30_000;

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
};

type Props = {
  lookupFlight: (number: string) => Promise<QuickFlight[]>;
  onOpenFlight?: (flight: QuickFlight, mode: 'departure' | 'arrival') => void;
  timeFormat12h?: boolean;
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

function routeLabel(f: QuickFlight): string {
  const from = f.originCity || f.origin || '—';
  const to = f.destCity || f.destination || '—';
  return `${from} → ${to}`;
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

function FlightCard({
  flight,
  mode,
  timeFormat12h,
  onPress,
}: {
  flight: QuickFlight;
  mode: 'departure' | 'arrival';
  timeFormat12h: boolean;
  onPress?: () => void;
}) {
  const isArrival = mode === 'arrival';
  const timeIso = isArrival
    ? resolveArrivalIso(flight)
    : resolveDepartureIso(flight);
  const timeIata = isArrival ? flight.destination : flight.origin;
  const timeCountry = isArrival ? flight.destCountry : flight.originCountry;
  const clock = timeIso
    ? formatAirportClock(timeIso, timeIata, timeFormat12h, timeCountry)
    : EMPTY_CLOCK;
  const gateText = hasRealGate(flight.gate)
    ? formatGateLabel(flight.gate)
    : 'Gate: TBD';
  const pill = statusPillStyle(flight.status);
  const statusLabel = flightStatusLabel(flight.status) || flight.status;

  return (
    <Pressable
      style={st.card}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      <Text style={st.cardNumber}>{flight.number}</Text>
      <Text style={st.cardRoute}>{routeLabel(flight)}</Text>
      <Text style={st.cardTime}>{clock}</Text>
      <Text style={st.cardGate}>{gateText}</Text>
      <View style={[st.statusPill, { backgroundColor: pill.bg }]}>
        <Text style={[st.statusPillTxt, { color: pill.fg }]}>{statusLabel}</Text>
      </View>
    </Pressable>
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
  timeFormat12h,
  onPress,
}: {
  flight: QuickFlight;
  timeFormat12h: boolean;
  onPress?: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const arrivalIso = resolveArrivalIso(flight);
  const clock = arrivalIso
    ? formatAirportClock(
        arrivalIso,
        flight.destination,
        timeFormat12h,
        flight.destCountry,
      )
    : EMPTY_CLOCK;
  const cancelled = flight.status === 'cancelled';
  const landed = flight.status === 'landed';
  const preLanding = !landed && !cancelled;
  const belt = cleanBaggageBelt(flight.baggage);
  const showTransport = landed && pickupShowTransport(flight, now);
  const arrivalMs = arrivalIso
    ? isoToUtcMs(arrivalIso, flight.destination, flight.destCountry)
    : null;
  const landsIn =
    preLanding && arrivalMs != null
      ? formatLandsIn(arrivalMs - now)
      : '';

  return (
    <Pressable
      style={st.card}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      <Text style={st.cardNumber}>{flight.number}</Text>
      <Text style={st.cardRoute}>{routeLabel(flight)}</Text>

      {cancelled ? (
        <>
          <Text style={st.pickupCancelled}>❌ Cancelled</Text>
          <Text style={st.pickupSubTxt}>Check airline for rebooking</Text>
        </>
      ) : null}

      {preLanding ? (
        <>
          <Text style={st.cardTime}>{clock}</Text>
          <Text style={st.cardGate}>{arrivalTerminalLabel(flight)} · {arrivalGateLabel(flight)}</Text>
          {landsIn ? <Text style={st.pickupCountdown}>{landsIn}</Text> : null}
        </>
      ) : null}

      {landed ? (
        <>
          <Text style={st.pickupLanded}>✅ Landed</Text>
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
      ) : null}
    </Pressable>
  );
}

function FlightLookupSection({
  emoji,
  title,
  placeholder,
  mode,
  lookupFlight,
  onOpenFlight,
  timeFormat12h,
}: {
  emoji: string;
  title: string;
  placeholder: string;
  mode: 'departure' | 'arrival';
  lookupFlight: (number: string) => Promise<QuickFlight[]>;
  onOpenFlight?: (flight: QuickFlight, mode: 'departure' | 'arrival') => void;
  timeFormat12h: boolean;
}) {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [flight, setFlight] = useState<QuickFlight | null>(null);

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
        setFlight(null);
        setError('Flight not found');
        haptics.error();
        return;
      }
      setFlight(hit);
      haptics.success();
    } catch {
      setFlight(null);
      setError('Flight not found');
      haptics.error();
    } finally {
      setBusy(false);
    }
  }, [busy, lookupFlight, query]);

  return (
    <View style={st.section}>
      <Text style={st.sectionLabel}>{emoji}  {title}</Text>
      <View style={st.inputRow}>
        <TextInput
          style={st.input}
          value={query}
          onChangeText={text => {
            setQuery(text);
            if (error) setError('');
          }}
          placeholder={placeholder}
          placeholderTextColor={GREY}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => { void submit(); }}
          accessibilityLabel={title}
        />
        <Pressable
          style={[st.goBtn, busy && st.goBtnDisabled]}
          onPress={() => { void submit(); }}
          disabled={busy}
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
      {flight ? (
        mode === 'arrival' ? (
          <PickupFlightCard
            flight={flight}
            timeFormat12h={timeFormat12h}
            onPress={onOpenFlight ? () => onOpenFlight(flight, mode) : undefined}
          />
        ) : (
          <FlightCard
            flight={flight}
            mode={mode}
            timeFormat12h={timeFormat12h}
            onPress={onOpenFlight ? () => onOpenFlight(flight, mode) : undefined}
          />
        )
      ) : null}
    </View>
  );
}

export default function QuickScreen({
  lookupFlight,
  onOpenFlight,
  timeFormat12h = false,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={[st.root, { paddingTop: insets.top + 16 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <FlightLookupSection
          emoji="✈"
          title="My Flight"
          placeholder="TG403"
          mode="departure"
          lookupFlight={lookupFlight}
          onOpenFlight={onOpenFlight}
          timeFormat12h={timeFormat12h}
        />

        <Text style={st.divider}>── or ──</Text>

        <FlightLookupSection
          emoji="👤"
          title="Picking someone up"
          placeholder="TG403"
          mode="arrival"
          lookupFlight={lookupFlight}
          onOpenFlight={onOpenFlight}
          timeFormat12h={timeFormat12h}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    minHeight: '100%',
    paddingHorizontal: 20,
    paddingBottom: 48,
    justifyContent: 'space-between',
  },
  section: {
    flex: 1,
    gap: 20,
    paddingVertical: 12,
  },
  sectionLabel: {
    color: YELLOW,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: INPUT_BG,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 12,
    color: WHITE,
    fontSize: 20,
    fontWeight: '700',
    paddingHorizontal: 16,
    height: 48,
  },
  goBtn: {
    backgroundColor: YELLOW,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  goBtnDisabled: {
    opacity: 0.7,
  },
  goBtnTxt: {
    color: BG,
    fontSize: 17,
    fontWeight: '800',
  },
  errorTxt: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 12,
    padding: 24,
    gap: 10,
    marginTop: 16,
    marginBottom: 32,
  },
  cardNumber: {
    color: WHITE,
    fontSize: 42,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  cardRoute: {
    color: WHITE,
    fontSize: 18,
    fontWeight: '600',
  },
  cardTime: {
    color: YELLOW,
    fontSize: 52,
    fontWeight: '800',
    marginTop: 6,
  },
  cardGate: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 4,
  },
  statusPillTxt: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  divider: {
    textAlign: 'center',
    color: GREY,
    fontSize: 13,
    fontWeight: '600',
    marginVertical: 24,
  },
  pickupCountdown: {
    color: YELLOW,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 4,
  },
  pickupLanded: {
    color: GREEN,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  pickupCancelled: {
    color: RED,
    fontSize: 28,
    fontWeight: '800',
    marginTop: 6,
  },
  pickupSubTxt: {
    color: WHITE,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 4,
  },
  transportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  transportBtn: {
    backgroundColor: CARD_BG,
    borderWidth: 2,
    borderColor: YELLOW,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  transportBtnTxt: {
    color: YELLOW,
    fontSize: 13,
    fontWeight: '700',
  },
});
