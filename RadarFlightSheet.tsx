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
import { Airplane, BellSimple, Check, X } from 'phosphor-react-native';
import {
  altFeet,
  COUNTRY_FLAG,
  fmtCoord,
  headingCompass,
  speedKnots,
} from './lib/radar';
import ReliabilityBadge from './ReliabilityBadge';
import {
  EMPTY_CLOCK,
  airportClockLabel,
  flightProgressPct,
  formatAirportClock,
  resolveArrivalIso,
  resolveDepartureIso,
} from './lib/flightTimes';
import { t } from './lib/i18n';

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

function fmtTime(iso: string, iata?: string) {
  if (!iso) return EMPTY_CLOCK;
  return formatAirportClock(iso, iata, false);
}

function statusBadge(f: RadarFlightInfo): { label: string; color: string } {
  const st = (f.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'canceled') return { label: t().cancelled, color: RED };
  if (st === 'delayed' || (f.delay || 0) >= 15) return { label: t().delayed, color: ORANGE };
  if (st === 'landed') return { label: t().landed, color: GREEN };
  if (st === 'en-route') return { label: t().enRoute, color: BLUE };
  if (st === 'boarding') return { label: t().boarding, color: BLUE };
  return { label: t().onTime, color: GREEN };
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
          <Text style={[styles.progressTime, { color: theme.secondary }]}>{fmtTime(depIso, flight.origin)}</Text>
          <Text style={[styles.progressTime, { color: theme.muted, fontSize: 10 }]}>
            {airportClockLabel(flight.originCity, flight.origin, flight.destination)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.progressTime, { color: theme.secondary }]}>{fmtTime(arrIso, flight.destination)}</Text>
          <Text style={[styles.progressTime, { color: theme.muted, fontSize: 10 }]}>
            {airportClockLabel(flight.destCity, flight.destination, flight.origin)}
          </Text>
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
                  <View style={{ flex: 1, paddingRight: 10 }}>
                    <Text style={[styles.flightNum, { color: theme.text }]}>{flight.number}</Text>
                    <Text style={[styles.airline, { color: theme.secondary }]}>{flight.airline}</Text>
                    <ReliabilityBadge
                      airlineCode={airlineIata}
                      airlineName={flight.airline}
                      theme={theme}
                    />
                  </View>
                  {badge ? (
                    <View
                      style={[
                        styles.statusPill,
                        { backgroundColor: badge.color + '1A', borderColor: badge.color + '55' },
                      ]}
                    >
                      <View style={[styles.statusDot, { backgroundColor: badge.color }]} />
                      <Text style={[styles.statusTxt, { color: badge.color }]}>{badge.label}</Text>
                    </View>
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
                      {fmtTime(resolveDepartureIso(flight), flight.origin)}
                    </Text>
                    <Text style={[styles.tLabel, { color: theme.muted }]}>
                      {airportClockLabel(flight.originCity, flight.origin, flight.destination)}
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
                      {fmtTime(resolveArrivalIso(flight), flight.destination)}
                    </Text>
                    <Text style={[styles.tLabel, { color: theme.muted }]}>
                      {airportClockLabel(flight.destCity, flight.destination, flight.origin)}
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
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  flightNum: { fontSize: 26, fontWeight: '800' },
  airline: { fontSize: 13, marginTop: 4, fontWeight: '500' },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusTxt: { fontSize: 12, fontWeight: '700' },
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
