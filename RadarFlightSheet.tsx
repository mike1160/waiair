import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Airplane, AirplaneTakeoff, BellSimple, Check, X } from 'phosphor-react-native';
import { searchDuffelFlights } from './lib/duffel';
import {
  altFeet,
  COUNTRY_FLAG,
  fmtCoord,
  headingCompass,
  speedKnots,
} from './lib/radar';
import FlightStatusBadge from './FlightStatusBadge';
import ReliabilityBadge from './ReliabilityBadge';
import {
  EMPTY_CLOCK,
  flightProgressPct,
  formatAirportClockLabeled,
  formatArrivesClockLabeled,
  resolveArrivalIso,
  resolveDepartureIso,
} from './lib/flightTimes';
import { t } from './lib/i18n';
import { liveBoardPhase, liveStatusLabel } from './boardingCountdown';

export type RadarPick = {
  callsign: string;
  altitude: number | null;
  speedMs: number | null;
  lat?: number | null;
  lon?: number | null;
  heading?: number | null;
  vertRate?: number | null;
  country?: string;
  registration?: string;
  icao?: string;
};

export type RadarFlightInfo = {
  number: string;
  airline: string;
  airlineCode: string;
  origin: string;
  originCity: string;
  destination: string;
  destCity: string;
  scheduledTime: string;
  revisedTime: string;
  actualTime: string;
  departureTime?: string;
  arrivalTime?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  boardSide?: 'arrival' | 'departure' | 'both';
  status: string;
  delay: number;
};

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  card: string;
  border: string;
  bg: string;
  list: string;
  accent: string;
  icon: string;
};

const GREEN = '#34C759';
const ORANGE = '#FF9500';
const RED = '#FF3B30';
const BLUE = '#3B82F6';

function fmtDepLabeled(iso: string, iata?: string) {
  if (!iso) return EMPTY_CLOCK;
  return formatAirportClockLabeled(iso, iata, false);
}

function fmtArrLabeled(iso: string, iata?: string) {
  if (!iso) return EMPTY_CLOCK;
  return formatArrivesClockLabeled(iso, iata, false);
}

function statusBadge(f: RadarFlightInfo): { label: string; color: string } {
  const phase = liveBoardPhase(f);
  const label = liveStatusLabel(f);
  if (phase === 'cancelled') return { label, color: RED };
  if (phase === 'landed') return { label, color: GREEN };
  if (phase === 'enRoute' || phase === 'departed') return { label, color: BLUE };
  if (phase === 'gateClosed' || phase === 'boarding') return { label, color: BLUE };
  if (phase === 'delayed') return { label, color: ORANGE };
  return { label, color: GREEN };
}

/** Prefer AeroDataBox airline.iata; fall back to leading letters/digits on the flight number (e.g. 6E755 → 6E). */
function extractAirlineIata(f: RadarFlightInfo): string {
  const fromCode = String(f.airlineCode || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  if (fromCode.length >= 2 && fromCode.length <= 3) return fromCode;

  const fromNum = String(f.number || '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .match(/^([A-Z0-9]{2,3})(?=\d)/);
  if (fromNum?.[1]) return fromNum[1];

  return fromCode;
}


function routeProgress(f: RadarFlightInfo): number {
  return flightProgressPct(f);
}

function FlightProgressBar({
  flight,
  theme,
  color,
}: {
  flight: RadarFlightInfo;
  theme: ThemeBits;
  color: string;
}) {
  const pct = Math.min(1, Math.max(0, routeProgress(flight)));
  const pctLabel = `${Math.round(pct * 100)}%`;
  const depIso = resolveDepartureIso(flight);
  const arrIso = resolveArrivalIso(flight);

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHead}>
        <Text style={[styles.tLabel, { color: theme.muted }]}>{t().flightProgress}</Text>
        <Text style={[styles.progressPct, { color }]}>{pctLabel}</Text>
      </View>

      <View style={styles.progressAirports}>
        <Text style={[styles.progressIata, { color: theme.text }]}>{flight.origin}</Text>
        <Text style={[styles.progressIata, { color: theme.text }]}>{flight.destination}</Text>
      </View>

      <View style={styles.progressTrackRow}>
        <View style={[styles.progressDot, { backgroundColor: color }]} />
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          {pct > 0 ? (
            <View
              style={[
                styles.progressFill,
                { width: `${Math.round(pct * 100)}%` as any, backgroundColor: color },
              ]}
            />
          ) : null}
          {pct > 0 && pct < 1 ? (
            <View style={[styles.progressPlane, { left: `${Math.round(pct * 100)}%` as any }]}>
              <Airplane size={14} color={color} />
            </View>
          ) : null}
        </View>
        <View style={[styles.progressDot, { backgroundColor: color }]} />
      </View>

      <View style={styles.progressTimes}>
        <View>
          <Text style={[styles.progressTime, { color: theme.secondary }]}>{fmtDepLabeled(depIso, flight.origin)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.progressTime, { color: theme.secondary }]}>{fmtArrLabeled(arrIso, flight.destination)}</Text>
        </View>
      </View>
    </View>
  );
}

export default function RadarFlightSheet({
  pick,
  visible,
  onClose,
  theme,
  busy,
  err,
  flight,
  tracked,
  onToggleTrack,
}: {
  pick: RadarPick | null;
  visible: boolean;
  onClose: () => void;
  theme: ThemeBits;
  busy: boolean;
  err: string;
  flight: RadarFlightInfo | null;
  tracked: boolean;
  onToggleTrack: () => void;
}) {
  const badge = flight ? statusBadge(flight) : null;
  const airlineIata = flight ? extractAirlineIata(flight) : '';
  const progressColor = badge?.color || theme.accent;
  const callsign = (pick?.callsign || '').replace(/\s+/g, ' ').trim() || 'Aircraft';
  const flag = pick?.country ? (COUNTRY_FLAG[pick.country] || '') : '';
  const hdg = pick?.heading;
  const hdgTxt = hdg != null && Number.isFinite(hdg)
    ? `${String(Math.round(((hdg % 360) + 360) % 360)).padStart(3, '0')}° (${headingCompass(hdg)})`
    : '—';
  const posTxt = pick?.lat != null && pick?.lon != null && Number.isFinite(pick.lat) && Number.isFinite(pick.lon)
    ? fmtCoord(pick.lat, pick.lon)
    : '—';
  const airlineLive = flight?.airline || pick?.country || 'Live position';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close flight details" />
        <View
          style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.title, { color: theme.text }]}>✈️ {callsign}</Text>
              <Text style={[styles.sub, { color: theme.secondary }]}>{airlineLive}</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.close, { backgroundColor: theme.list }]}
              hitSlop={8}
            >
              <X size={16} color={theme.muted} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: Platform.OS === 'web' ? 420 : 480 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.liveCard, { backgroundColor: theme.list }]}>
              <Text style={[styles.tLabel, { color: theme.muted }]}>📍 {t().position}</Text>
              <Text style={[styles.liveVal, { color: theme.text, marginBottom: 12 }]}>{posTxt}</Text>
              <Text style={[styles.kv, { color: theme.text }]}>⬆️ {t().altitude(altFeet(pick?.altitude ?? null))}</Text>
              <Text style={[styles.kv, { color: theme.text }]}>💨 {t().speed(speedKnots(pick?.speedMs ?? null))}</Text>
              <Text style={[styles.kv, { color: theme.text }]}>🧭 {t().heading(hdgTxt)}</Text>
              {pick?.country ? (
                <Text style={[styles.kv, { color: theme.text, marginTop: 10 }]}>
                  {flag ? `${flag} ` : ''}Origin: {pick.country}
                </Text>
              ) : null}
              <Text style={[styles.kv, { color: theme.secondary }]}>
                Registration: {pick?.registration || pick?.icao?.toUpperCase() || '—'}
              </Text>
            </View>

            {busy ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.accent} />
                <Text style={[styles.hint, { color: theme.muted }]}>{t().loadingScheduled}</Text>
              </View>
            ) : flight ? (
              <>
                <Text style={[styles.detailsLink, { color: theme.accent }]}>{t().viewFlightDetails}</Text>
                <View style={styles.rowBetween}>
                  <View style={{ flexShrink: 1, minWidth: 0, paddingRight: 10 }}>
                    <Text style={[styles.flightNum, { color: theme.text }]}>{flight.number}</Text>
                    <Text style={[styles.airline, { color: theme.secondary }]}>{flight.airline}</Text>
                    <ReliabilityBadge
                      airlineCode={airlineIata}
                      airlineName={flight.airline}
                      theme={theme}
                    />
                  </View>
                  {badge ? (
                    <FlightStatusBadge label={badge.label} color={badge.color} liveDot />
                  ) : null}
                </View>

                <View style={[styles.routeBlock, { borderColor: theme.border }]}>
                  <View style={styles.routeCol}>
                    <Text style={[styles.iata, { color: theme.text }]}>{flight.origin}</Text>
                    <Text style={[styles.city, { color: theme.secondary }]} numberOfLines={1}>
                      {flight.originCity || flight.origin}
                    </Text>
                  </View>
                  <Airplane size={16} color={theme.muted} />
                  <View style={[styles.routeCol, { alignItems: 'flex-end' }]}>
                    <Text style={[styles.iata, { color: theme.text }]}>{flight.destination}</Text>
                    <Text style={[styles.city, { color: theme.secondary }]} numberOfLines={1}>
                      {flight.destCity || flight.destination}
                    </Text>
                  </View>
                </View>

                <FlightProgressBar flight={flight} theme={theme} color={progressColor} />

                <View style={styles.timesRow}>
                  <View style={styles.tBox}>
                    <Text style={[styles.tLabel, { color: theme.muted }]}>{t().departure}</Text>
                    <Text style={[styles.tVal, { color: theme.text }]}>
                      {fmtDepLabeled(resolveDepartureIso(flight), flight.origin)}
                    </Text>
                  </View>
                  <View style={styles.tBox}>
                    <Text style={[styles.tLabel, { color: theme.muted }]}>
                      {flight.status === 'en-route' ? t().arrivesApproxUpper : t().arrival}
                    </Text>
                    <Text
                      style={[
                        styles.tVal,
                        { color: flight.delay >= 15 ? ORANGE : theme.text },
                      ]}
                    >
                      {fmtArrLabeled(resolveArrivalIso(flight), flight.destination)}
                    </Text>
                  </View>
                </View>
              </>
            ) : err ? (
              <Text style={[styles.hint, { color: theme.muted, marginTop: 8 }]}>
                {err}
              </Text>
            ) : null}
          </ScrollView>

          {flight ? (
            <>
              <TouchableOpacity
                style={styles.bookBtn}
                onPress={() => {
                  const o = String(flight.origin || '').trim().toUpperCase();
                  const d = String(flight.destination || '').trim().toUpperCase();
                  const date = String(resolveDepartureIso(flight) || '').match(/(\d{4}-\d{2}-\d{2})/)?.[1];
                  if (!o || !d || !date) return;
                  void searchDuffelFlights(o, d, date, 1).catch(() => {});
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={t().bookThisFlight}
              >
                <AirplaneTakeoff size={16} color="#C9A84C" />
                <Text style={styles.bookTxt} numberOfLines={1}>{t().bookThisFlight}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.trackBtn,
                  {
                    backgroundColor: tracked ? theme.accent : theme.list,
                    borderColor: theme.border,
                  },
                ]}
                onPress={onToggleTrack}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel={tracked ? 'Untrack flight' : 'Track this flight'}
              >
                {tracked ? (
                  <Check size={16} color="#fff" />
                ) : (
                  <BellSimple size={16} color={theme.icon} />
                )}
                <Text style={[styles.trackTxt, { color: tracked ? '#fff' : theme.text }]}>
                  {tracked ? 'Tracking' : 'Track this flight'}
                </Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '88%',
    zIndex: 2,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#94a3b8',
    opacity: 0.5,
    marginBottom: 12,
  },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800' },
  sub: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { paddingVertical: 28, alignItems: 'center', gap: 10 },
  hint: { fontSize: 12, textAlign: 'center', paddingHorizontal: 12 },
  err: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  flightNum: { fontSize: 26, fontWeight: '800' },
  airline: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  routeBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    marginBottom: 10,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  routeCol: { flex: 1 },
  iata: { fontSize: 24, fontWeight: '800' },
  city: { fontSize: 11, marginTop: 3, fontWeight: '500' },
  progressWrap: { marginBottom: 16 },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressPct: { fontSize: 12, fontWeight: '800' },
  progressAirports: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressIata: { fontSize: 12, fontWeight: '800' },
  progressTrackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  progressDot: { width: 8, height: 8, borderRadius: 4 },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    position: 'relative',
    overflow: 'visible',
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 2,
  },
  progressPlane: {
    position: 'absolute',
    top: -7,
    marginLeft: -8,
  },
  progressTimes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  progressTime: { fontSize: 11, fontWeight: '600' },
  timesRow: { flexDirection: 'row', gap: 24, marginBottom: 14 },
  tBox: {},
  tLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 3 },
  tVal: { fontSize: 20, fontWeight: '300' },
  liveRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  liveBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  liveVal: { fontSize: 15, fontWeight: '700', marginTop: 1 },
  liveCard: { borderRadius: 14, padding: 14, marginBottom: 14 },
  kv: { fontSize: 14, fontWeight: '600', marginTop: 5 },
  detailsLink: { fontSize: 13, fontWeight: '800', marginBottom: 12 },
  bookBtn: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C9A84C',
    backgroundColor: '#1A2F5A',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 12,
    alignSelf: 'stretch',
  },
  bookTxt: { fontSize: 15, fontWeight: '800', color: '#FFFFFF', flexShrink: 0 },
  trackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 12,
  },
  trackTxt: { fontSize: 15, fontWeight: '700' },
});
