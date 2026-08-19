import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Ticket,
  DoorOpen,
  Users,
  Door,
  AirplaneTakeoff,
  Airplane,
  AirplaneLanding,
  Briefcase,
  Check,
  CaretDown,
  CaretUp,
} from 'phosphor-react-native';

import {
  EMPTY_CLOCK,
  baggageIso,
  enrouteRangeLabel,
  flightProgressPct,
  formatAirportClock,
  resolveArrivalIso,
  resolveDepartureIso,
} from './lib/flightTimes';
import { t } from './lib/i18n';

export type TimelineFlight = {
  status: string;
  gate?: string;
  baggage?: string;
  scheduledTime?: string;
  revisedTime?: string;
  departureTime?: string;
  arrivalTime?: string;
  actualTime?: string;
  scheduledDeparture?: string;
  scheduledArrival?: string;
  estimatedDeparture?: string;
  estimatedArrival?: string;
  actualDeparture?: string;
  actualArrival?: string;
  boardSide?: 'arrival' | 'departure' | 'both';
  progress?: number;
  delay?: number;
};

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  list: string;
};

type StageId =
  | 'checkin'
  | 'gateOpen'
  | 'boarding'
  | 'gateClose'
  | 'takeoff'
  | 'enroute'
  | 'landing'
  | 'baggage';

type StageDef = {
  id: StageId;
  label: string;
  icon: (color: string, size: number) => React.ReactNode;
};

const STAGES: StageDef[] = [
  {
    id: 'checkin',
    label: 'Check-in',
    icon: (c, s) => <Ticket size={s} color={c} />,
  },
  {
    id: 'gateOpen',
    label: 'Gate open',
    icon: (c, s) => <DoorOpen size={s} color={c} />,
  },
  {
    id: 'boarding',
    label: 'Boarding',
    icon: (c, s) => <Users size={s} color={c} />,
  },
  {
    id: 'gateClose',
    label: 'Gate close',
    icon: (c, s) => <Door size={s} color={c} />,
  },
  {
    id: 'takeoff',
    label: 'Takeoff',
    icon: (c, s) => <AirplaneTakeoff size={s} color={c} />,
  },
  {
    id: 'enroute',
    label: 'En route',
    icon: (c, s) => <Airplane size={s} color={c} />,
  },
  {
    id: 'landing',
    label: 'Landing',
    icon: (c, s) => <AirplaneLanding size={s} color={c} />,
  },
  {
    id: 'baggage',
    label: 'Baggage belt',
    icon: (c, s) => <Briefcase size={s} color={c} />,
  },
];

function fmtTime(iso?: string, iata?: string, country?: string): string {
  if (!iso) return '';
  const clock = formatAirportClock(iso, iata, false, country);
  return clock === EMPTY_CLOCK ? '' : clock;
}

function addMinutes(iso: string, mins: number): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  return new Date(t + mins * 60000).toISOString();
}

function depIso(f: TimelineFlight): string {
  return resolveDepartureIso(f);
}

function arrIso(f: TimelineFlight): string {
  return resolveArrivalIso(f);
}

/** Map flight status → current stage index (0–7). */
export function currentStageIndex(f: TimelineFlight): number {
  const st = (f.status || '').toLowerCase();
  const hasGate = !!(f.gate && f.gate.trim() && f.gate !== '—');
  const hasBelt = !!(f.baggage && String(f.baggage).trim());

  if (st === 'cancelled') return 0;
  if (st === 'landed' && hasBelt) return 7;
  if (st === 'landed') return 6;
  if (st === 'en-route' || st === 'airborne') return 5;
  if (st === 'boarding') return 2;
  if (st === 'delayed' || st === 'scheduled') {
    return hasGate ? 1 : 0;
  }
  return hasGate ? 1 : 0;
}

function stageTime(f: TimelineFlight, id: StageId, originIata?: string, destIata?: string, originCountry?: string, destCountry?: string): string {
  const dep = depIso(f);
  const arr = arrIso(f);
  const fmtDep = (iso: string) => fmtTime(iso, originIata, originCountry);
  const fmtArr = (iso: string) => fmtTime(iso, destIata, destCountry);
  switch (id) {
    case 'checkin':
      return dep ? fmtDep(addMinutes(dep, -180)) : '';
    case 'gateOpen':
      return f.gate ? (dep ? fmtDep(addMinutes(dep, -60)) : 'Assigned') : 'TBA';
    case 'boarding':
      return dep ? fmtDep(addMinutes(dep, -40)) : '';
    case 'gateClose':
      return dep ? fmtDep(addMinutes(dep, -15)) : '';
    case 'takeoff':
      return fmtDep(dep);
    case 'enroute':
      return enrouteRangeLabel(dep, arr, fmtDep, fmtArr);
    case 'landing':
      return fmtArr(arr) || EMPTY_CLOCK;
    case 'baggage':
      return f.baggage
        ? `Belt ${f.baggage}${arr ? ` · ${fmtArr(baggageIso(arr, 20))}` : ''}`
        : arr
          ? fmtArr(baggageIso(arr, 20))
          : '';
    default:
      return '';
  }
}

function PulseCircle({
  size,
  color,
  children,
  green,
}: {
  size: number;
  color: string;
  children: React.ReactNode;
  green?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      try {
        loop.stop();
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, [pulse]);

  const glowColor = green ? '#22c55e' : color;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{
          position: 'absolute',
          width: size + 16,
          height: size + 16,
          borderRadius: (size + 16) / 2,
          backgroundColor: glowColor,
          opacity,
          transform: [{ scale }],
        }}
      />
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: glowColor,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}

function StageRow({
  stage,
  index,
  current,
  completed,
  isLast,
  time,
  theme,
  showProgress,
  progress,
  entranceDelay,
}: {
  stage: StageDef;
  index: number;
  current: boolean;
  completed: boolean;
  isLast: boolean;
  time: string;
  theme: ThemeBits;
  showProgress: boolean;
  progress: number;
  entranceDelay: number;
}) {
  const appear = useRef(new Animated.Value(0)).current;
  const bar = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(appear, {
      toValue: 1,
      duration: 420,
      delay: entranceDelay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [appear, entranceDelay]);

  useEffect(() => {
    if (!showProgress) return;
    bar.setValue(0);
    Animated.timing(bar, {
      toValue: progress,
      duration: 900,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [showProgress, progress, bar]);

  const accent = theme.accent;
  const grey = theme.muted;
  const size = current ? 44 : 32;
  const iconSize = current ? 20 : 15;
  const isBaggageCurrent = current && stage.id === 'baggage';

  let circle: React.ReactNode;
  if (completed && !current) {
    circle = (
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: accent,
            opacity: 0.5,
          },
        ]}
      >
        {stage.icon('#fff', iconSize)}
        <View style={styles.checkOverlay}>
          <Check size={10} color="#fff" weight="bold" />
        </View>
      </View>
    );
  } else if (current) {
    circle = (
      <PulseCircle size={size} color={accent} green={isBaggageCurrent}>
        {stage.icon('#fff', iconSize)}
      </PulseCircle>
    );
  } else {
    circle = (
      <View
        style={[
          styles.circle,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: 2,
            borderColor: theme.border,
            backgroundColor: theme.list,
          },
        ]}
      >
        {stage.icon(grey, iconSize)}
      </View>
    );
  }

  const lineColor = completed || current ? accent : theme.border;

  return (
    <Animated.View
      style={[
        styles.row,
        {
          opacity: appear,
          transform: [
            {
              translateY: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [12, 0],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.rail}>
        <View style={{ width: 44, alignItems: 'center' }}>{circle}</View>
        {!isLast ? (
          <View style={[styles.line, { backgroundColor: lineColor, opacity: completed ? 0.55 : 0.35 }]} />
        ) : null}
      </View>
      <View style={styles.body}>
        <Text
          style={[
            styles.label,
            {
              color: current ? theme.text : completed ? theme.secondary : grey,
              fontWeight: current ? '800' : '600',
              fontSize: current ? 15 : 13,
            },
          ]}
        >
          {stage.label}
        </Text>
        {time ? (
          <Text style={[styles.time, { color: grey }]}>{time}</Text>
        ) : null}
        {showProgress ? (
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  backgroundColor: accent,
                  width: bar.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', '100%'],
                  }),
                },
              ]}
            />
          </View>
        ) : null}
      </View>
    </Animated.View>
  );
}

export default function FlightStageTimeline({
  flight,
  theme,
  originIata,
  destIata,
  originCountry,
  destCountry,
}: {
  flight: TimelineFlight;
  theme: ThemeBits;
  originIata?: string;
  destIata?: string;
  originCountry?: string;
  destCountry?: string;
}) {
  const [open, setOpen] = useState(false);
  const current = currentStageIndex(flight);
  const progress = flightProgressPct(flight);
  const currentStage = STAGES[current];
  const when = (id: StageId) => stageTime(flight, id, originIata, destIata, originCountry, destCountry);

  return (
    <View style={[styles.wrap, { borderTopColor: theme.border }]} accessibilityRole="summary" accessibilityLabel="Flight timeline">
      <TouchableOpacity
        style={styles.head}
        onPress={() => setOpen(v => !v)}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? 'Collapse timeline' : 'Expand timeline'}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.muted, marginBottom: 0 }]}>{t().timeline}</Text>
          {!open && currentStage ? (
            <Text style={[styles.summary, { color: theme.text }]}>
              {currentStage.label}
              {when(currentStage.id) ? ` · ${when(currentStage.id)}` : ''}
            </Text>
          ) : null}
        </View>
        {open
          ? <CaretUp size={18} color={theme.muted} />
          : <CaretDown size={18} color={theme.muted} />}
      </TouchableOpacity>
      {open ? STAGES.map((stage, i) => (
        <StageRow
          key={stage.id}
          stage={stage}
          index={i}
          current={i === current}
          completed={i < current}
          isLast={i === STAGES.length - 1}
          time={when(stage.id)}
          theme={theme}
          showProgress={i === current && stage.id === 'enroute'}
          progress={progress}
          entranceDelay={i * 55}
        />
      )) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    minHeight: 36,
  },
  title: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    marginBottom: 14,
  },
  summary: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 56,
  },
  rail: {
    width: 44,
    alignItems: 'center',
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 20,
    marginVertical: 4,
    borderRadius: 1,
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOverlay: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    paddingLeft: 12,
    paddingBottom: 14,
    paddingTop: 4,
  },
  label: {
    letterSpacing: 0.1,
  },
  time: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '500',
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
});
