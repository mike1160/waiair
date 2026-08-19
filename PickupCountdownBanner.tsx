import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { haptics } from './lib/haptics';
import { airportRecByIata } from './lib/airportsDb';
import { resolveArrivalIso } from './lib/flightTimes';
import { isoInAirportTzToUtcMs } from './lib/localFlightTime';
import { t } from './lib/i18n';
import {
  colorForPickupName,
  estimateDriveToAirport,
  initialsForPickupName,
  isPickupEnabled,
  loadPickupHome,
  loadPickupPerson,
  minutesUntilLeave,
  type PickupPerson,
} from './lib/pickup';

type AirportLike = {
  iata: string;
  lat: number;
  lon: number;
  city?: string;
  name?: string;
};

type PickupFlight = {
  id?: string;
  number: string;
  status: string;
  destination?: string;
  arrivalTime?: string;
  revisedTime?: string;
  scheduledTime?: string;
  origin?: string;
  scheduledArrival?: string;
  actualArrival?: string;
  actualTime?: string;
  destCity?: string;
};

type TrackedLike = {
  key: string;
  type: 'arrival' | 'departure';
  airportIata: string;
  flight: PickupFlight;
};

type Candidate = {
  flight: PickupFlight;
  person: PickupPerson;
  arrMins: number;
  leaveMins: number;
};

type Props = {
  tracked: TrackedLike[];
  airport: AirportLike;
  onOpenFlight: (f: PickupFlight) => void;
  personRevision?: number;
};

export default function PickupCountdownBanner({
  tracked,
  airport,
  onOpenFlight,
  personRevision = 0,
}: Props) {
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [tick, setTick] = useState(0);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const id = setInterval(() => setTick(n => n + 1), 30_000);
    return () => {
      try {
        clearInterval(id);
        clearTimeout(id);
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let best: Candidate | null = null;
      for (const tr of tracked) {
        if (tr.type !== 'arrival') continue;
        const f = tr.flight;
        if (f.status === 'landed' || f.status === 'cancelled') continue;
        if (f.actualArrival || (tr.type === 'arrival' && f.actualTime)) continue;
        if (!(await isPickupEnabled(tr.key))) continue;
        const person = await loadPickupPerson(tr.key);
        if (!person?.name?.trim()) continue;
        const arrIso = resolveArrivalIso(f)
          || f.arrivalTime
          || f.revisedTime
          || f.scheduledTime
          || '';
        const destIata = f.destination || tr.airportIata;
        const destAp = airportRecByIata(destIata);
        const arrMs = isoInAirportTzToUtcMs(arrIso, destIata) ?? new Date(arrIso).getTime();
        if (!Number.isFinite(arrMs)) continue;
        const arrMins = Math.round((arrMs - Date.now()) / 60_000);
        if (arrMins < 0 || arrMins >= 30) continue;
        const home = await loadPickupHome();
        const drive = estimateDriveToAirport(
          home,
          {
            iata: destIata,
            lat: destAp?.lat,
            lon: destAp?.lon,
            name: destAp?.city || destAp?.name || destIata,
          },
          {
            iata: airport.iata,
            lat: airport.lat,
            lon: airport.lon,
            name: airport.city || airport.name,
          },
        );
        if (drive.tooFar || drive.minutes == null) continue;
        const leaveMins = minutesUntilLeave(arrIso, drive.minutes, destIata);
        if (!best || arrMins < best.arrMins) {
          best = {
            flight: f,
            person,
            arrMins,
            leaveMins: leaveMins ?? 0,
          };
        }
      }
      if (!cancelled) setCandidate(best);
    })();
    return () => {
      try {
        cancelled = true;
      } catch (e) {
        console.warn('[cleanup error]', e);
      }
    };
  }, [tracked, airport, personRevision, tick]);

  useEffect(() => {
    if (!candidate) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 0.55,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
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
  }, [candidate, pulse]);

  if (!candidate) return null;

  const { flight, person, arrMins, leaveMins } = candidate;
  const avatarColor = colorForPickupName(person.name);
  const initials = initialsForPickupName(person.name);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => {
        haptics.light();
        onOpenFlight(flight);
      }}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel={t().pickupArrivesLeaveCountdown(arrMins, leaveMins)}
    >
      <View style={[styles.avatar, { backgroundColor: person.photoUri ? '#111' : avatarColor }]}>
        {person.photoUri ? (
          <Image source={{ uri: person.photoUri }} style={styles.avatarImg} />
        ) : (
          <Text style={styles.avatarTxt}>{initials}</Text>
        )}
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{person.name}</Text>
        <Animated.Text style={[styles.countdown, { opacity: pulse }]} numberOfLines={1}>
          {t().pickupArrivesLeaveCountdown(arrMins, leaveMins)}
        </Animated.Text>
      </View>
    </TouchableOpacity>
  );
}

const GOLD = '#C9A84C';

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${GOLD}55`,
    backgroundColor: '#0B1220',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarTxt: { color: '#fff', fontSize: 20, fontWeight: '800' },
  body: { flex: 1, minWidth: 0, gap: 4 },
  name: { color: '#F8FAFC', fontSize: 20, fontWeight: '800', letterSpacing: -0.2 },
  countdown: { color: GOLD, fontSize: 15, fontWeight: '700' },
});
