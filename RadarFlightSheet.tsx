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
import { Bell, Check, Navigation, Plane, X } from 'lucide-react-native';
import ReliabilityBadge from './ReliabilityBadge';

export type RadarPick = {
  callsign: string;
  altitude: number | null;
  speedMs: number | null;
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
  /** Best-known departure (scheduled / revised / actual) */
  departureTime?: string;
  /** Best-known arrival (scheduled / revised / actual) */
  arrivalTime?: string;
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

function fmtTime(iso: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function statusBadge(f: RadarFlightInfo): { label: string; color: string } {
  const st = (f.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'canceled') return { label: 'Cancelled', color: RED };
  if (st === 'delayed' || (f.delay || 0) >= 15) return { label: 'Delayed', color: ORANGE };
  if (st === 'landed') return { label: 'Landed', color: GREEN };
  if (st === 'en-route') return { label: 'En Route', color: BLUE };
  if (st === 'boarding') return { label: 'Boarding', color: BLUE };
  return { label: 'On Time', color: GREEN };
}

/** Prefer AeroDataBox airline.iata; fall back to leading letters on the flight number (e.g. TG747 → TG). */
function extractAirlineIata(f: RadarFlightInfo): string {
  const fromCode = String(f.airlineCode || '')
    .replace(/[^A-Za-z]/g, '')
    .toUpperCase();
  if (fromCode.length >= 2 && fromCode.length <= 3) return fromCode;

  const fromNum = String(f.number || '')
    .replace(/\s+/g, '')
    .toUpperCase()
    .match(/^([A-Z]{2,3})(?=\d)/);
  if (fromNum?.[1]) return fromNum[1];

  return fromCode;
}


/** Progress along the route from scheduled (or best-known) dep → arr. */
function routeProgress(f: RadarFlightInfo): number {
  const st = (f.status || '').toLowerCase();
  if (st === 'cancelled' || st === 'canceled') return 0;
  if (st === 'landed') return 1;

  const depIso = f.departureTime || f.actualTime || f.revisedTime || f.scheduledTime;
  const arrIso = f.arrivalTime || '';
  const dep = depIso ? Date.parse(depIso) : NaN;
  const arr = arrIso ? Date.parse(arrIso) : NaN;

  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) {
    if (st === 'en-route') return 0.5;
    return 0;
  }

  const now = Date.now();
  if (now <= dep) return 0;
  if (now >= arr) return 1;
  return (now - dep) / (arr - dep);
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
  const depIso = flight.departureTime || flight.scheduledTime;
  const arrIso = flight.arrivalTime || '';

  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressHead}>
        <Text style={[styles.tLabel, { color: theme.muted }]}>FLIGHT PROGRESS</Text>
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
              <Plane size={14} color={color} strokeWidth={2.5} />
            </View>
          ) : null}
        </View>
        <View style={[styles.progressDot, { backgroundColor: color }]} />
      </View>

      <View style={styles.progressTimes}>
        <Text style={[styles.progressTime, { color: theme.secondary }]}>{fmtTime(depIso)}</Text>
        <Text style={[styles.progressTime, { color: theme.secondary }]}>{fmtTime(arrIso)}</Text>
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
  const altTxt =
    pick?.altitude != null && Number.isFinite(pick.altitude)
      ? `${Math.round(pick.altitude)} m`
      : '—';
  const spdTxt =
    pick?.speedMs != null && Number.isFinite(pick.speedMs)
      ? `${Math.round(pick.speedMs * 3.6)} km/h`
      : '—';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={e => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <View style={styles.head}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={[styles.title, { color: theme.text }]}>
                {pick?.callsign?.replace(/\s+/g, '') || 'Flight'}
              </Text>
              <Text style={[styles.sub, { color: theme.secondary }]}>Live radar · AeroDataBox</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.close, { backgroundColor: theme.list }]}
              hitSlop={8}
            >
              <X size={16} color={theme.muted} strokeWidth={2.2} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={{ maxHeight: Platform.OS === 'web' ? 420 : 480 }}
            showsVerticalScrollIndicator={false}
          >
            {busy ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.accent} />
                <Text style={[styles.hint, { color: theme.muted }]}>Loading flight details…</Text>
              </View>
            ) : err ? (
              <View style={styles.center}>
                <Text style={[styles.err, { color: RED }]}>{err}</Text>
                <Text style={[styles.hint, { color: theme.muted }]}>
                  OpenSky callsign may not match a scheduled flight number.
                </Text>
              </View>
            ) : flight ? (
              <>
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
                  <Plane size={16} color={theme.muted} strokeWidth={2} />
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
                    <Text style={[styles.tLabel, { color: theme.muted }]}>SCHEDULED</Text>
                    <Text
                      style={[
                        styles.tVal,
                        { color: theme.text },
                        flight.delay >= 15 && {
                          color: theme.muted,
                          textDecorationLine: 'line-through',
                        },
                      ]}
                    >
                      {fmtTime(flight.scheduledTime)}
                    </Text>
                  </View>
                  <View style={styles.tBox}>
                    <Text style={[styles.tLabel, { color: theme.muted }]}>
                      {flight.actualTime ? 'ACTUAL' : 'REVISED'}
                    </Text>
                    <Text
                      style={[
                        styles.tVal,
                        { color: flight.delay >= 15 ? ORANGE : theme.text },
                      ]}
                    >
                      {fmtTime(flight.actualTime || flight.revisedTime)}
                    </Text>
                  </View>
                </View>

                <View style={styles.liveRow}>
                  <View style={[styles.liveBox, { backgroundColor: theme.list }]}>
                    <Navigation size={14} color={theme.icon} strokeWidth={2} />
                    <View>
                      <Text style={[styles.tLabel, { color: theme.muted }]}>ALTITUDE</Text>
                      <Text style={[styles.liveVal, { color: theme.text }]}>{altTxt}</Text>
                    </View>
                  </View>
                  <View style={[styles.liveBox, { backgroundColor: theme.list }]}>
                    <Plane size={14} color={theme.icon} strokeWidth={2} />
                    <View>
                      <Text style={[styles.tLabel, { color: theme.muted }]}>SPEED</Text>
                      <Text style={[styles.liveVal, { color: theme.text }]}>{spdTxt}</Text>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </ScrollView>

          {flight && !busy && !err ? (
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
                <Check size={16} color="#fff" strokeWidth={2.5} />
              ) : (
                <Bell size={16} color={theme.icon} strokeWidth={2} />
              )}
              <Text style={[styles.trackTxt, { color: tracked ? '#fff' : theme.text }]}>
                {tracked ? 'Tracking' : 'Track this flight'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </Pressable>
      </Pressable>
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
