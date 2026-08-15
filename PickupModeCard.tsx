import { useEffect, useMemo, useState } from 'react';
import {
  Image,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Car } from 'phosphor-react-native';
import { haptics } from './lib/haptics';
import {
  ARRIVALS_WALK_MIN,
  BAGGAGE_MIN,
  TOO_FAR_DRIVE_MSG,
  capturePickupHome,
  colorForPickupName,
  disablePickup,
  enablePickup,
  estimateDriveToAirport,
  initialsForPickupName,
  loadPickupAlertsEnabled,
  loadPickupHome,
  loadPickupPerson,
  pickupLeaveClock,
  savePickupAlertsEnabled,
  type DriveEstimate,
  type PickupHome,
  type PickupPerson,
} from './lib/pickup';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  list: string;
  border: string;
};

export default function PickupModeCard({
  flightKey,
  flightNumber,
  destIata,
  destName,
  destLat,
  destLon,
  localIata,
  localName,
  localLat,
  localLon,
  terminal,
  etaIso,
  theme,
  onToast,
  onEnsureTracked,
  boardType = 'arrival',
  personRevision = 0,
}: {
  flightKey: string;
  flightNumber: string;
  destIata: string;
  destName: string;
  destLat?: number;
  destLon?: number;
  localIata: string;
  localName?: string;
  localLat?: number;
  localLon?: number;
  terminal?: string;
  etaIso: string;
  theme: ThemeBits;
  onToast: (msg: string) => void;
  onEnsureTracked: () => void;
  boardType?: 'arrival' | 'departure';
  personRevision?: number;
}) {
  const [home, setHome] = useState<PickupHome | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [person, setPerson] = useState<PickupPerson | null>(null);

  const drive: DriveEstimate = useMemo(
    () => estimateDriveToAirport(
      home,
      { iata: destIata, lat: destLat, lon: destLon, name: destName },
      { iata: localIata, lat: localLat, lon: localLon, name: localName },
    ),
    [home, destIata, destLat, destLon, destName, localIata, localLat, localLon, localName],
  );

  useEffect(() => {
    let cancelled = false;
    loadPickupHome().then(h => { if (!cancelled) setHome(h); });
    loadPickupAlertsEnabled(flightKey).then(enabled => {
      if (!cancelled) setOn(enabled);
    });
    loadPickupPerson(flightKey).then(p => { if (!cancelled) setPerson(p); });
    return () => { cancelled = true; };
  }, [flightKey, personRevision]);

  const toggle = async (next: boolean) => {
    if (busy) return;
    setOn(next);
    setBusy(true);
    try {
      await savePickupAlertsEnabled(flightKey, next);
      if (!next) {
        await disablePickup(flightKey);
        haptics.light();
        onToast('Pickup alerts off');
        return;
      }
      let loc = home;
      if (!loc) {
        loc = await capturePickupHome();
        if (loc) setHome(loc);
      }
      if (!loc) {
        haptics.success();
        onToast('Pickup alerts on — allow location to time your drive');
        return;
      }
      const est = estimateDriveToAirport(
        loc,
        { iata: destIata, lat: destLat, lon: destLon, name: destName },
        { iata: localIata, lat: localLat, lon: localLon, name: localName },
      );
      if (est.tooFar || est.minutes == null) {
        haptics.success();
        onToast(TOO_FAR_DRIVE_MSG);
        return;
      }
      if (!etaIso) {
        haptics.success();
        onToast('Pickup alerts on — we\'ll time the drive when the ETA is known');
        return;
      }
      onEnsureTracked();
      await enablePickup({
        flightKey,
        flightNumber,
        destIata: est.iata || destIata,
        destName: est.label || destName || destIata,
        terminal: terminal || '',
        etaIso,
        driveMin: est.minutes,
        homeLabel: loc.label,
      });
      haptics.success();
      onToast('Pickup alerts on — we\'ll tell you when to leave');
    } catch {
      onToast(next ? 'Pickup alerts on' : 'Pickup alerts off');
    } finally {
      setBusy(false);
    }
  };

  const driveLine = drive.tooFar
    ? TOO_FAR_DRIVE_MSG
    : drive.minutes != null
      ? `~${drive.minutes} min to airport`
      : null;
  const leaveClock = etaIso && drive.minutes != null && !drive.tooFar
    ? pickupLeaveClock(etaIso, drive.minutes)
    : '';
  const leaveLine = driveLine && leaveClock
    ? `${driveLine} · Leave at ${leaveClock}`
    : driveLine;

  if (boardType !== 'arrival') return null;

  const named = !!person?.name;
  const avatarColor = colorForPickupName(person?.name || '');
  const initials = initialsForPickupName(person?.name || '');

  return (
    <View style={[styles.card, { backgroundColor: theme.list, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">🚗 Pickup Mode</Text>
      {named ? (
        <View style={styles.personRow}>
          <View style={[styles.avatar, { backgroundColor: person?.photoUri ? '#111' : avatarColor }]}>
            {person?.photoUri ? (
              <Image source={{ uri: person.photoUri }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarTxt}>{initials}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.lead, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">
              Picking up: {person!.name}
            </Text>
            <Text style={[styles.sub, { color: theme.secondary, marginBottom: 0 }]} numberOfLines={1} ellipsizeMode="tail">
              We'll tell you when to leave
            </Text>
            {leaveLine ? (
              <Text style={[styles.meta, { color: theme.secondary }]} numberOfLines={2} ellipsizeMode="tail">
                {leaveLine}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.lead, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">Picking someone up?</Text>
          <Text style={[styles.sub, { color: theme.secondary }]} numberOfLines={1} ellipsizeMode="tail">We'll tell you when to leave</Text>
          {home ? (
            <Text style={[styles.meta, { color: theme.secondary }]} numberOfLines={1} ellipsizeMode="tail">
              Your location: {home.label}
            </Text>
          ) : (
            <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={2} ellipsizeMode="tail">
              We'll save your location once when you enable alerts
            </Text>
          )}
          {driveLine ? (
            <Text style={[styles.meta, { color: theme.secondary }]} numberOfLines={2} ellipsizeMode="tail">
              {driveLine}
            </Text>
          ) : null}
        </>
      )}

      <Text style={[styles.hint, { color: theme.muted }]} numberOfLines={2} ellipsizeMode="tail">
        Includes ~{BAGGAGE_MIN} min baggage + {ARRIVALS_WALK_MIN} min to arrivals
      </Text>

      <View style={styles.row}>
        <Car size={16} color={theme.accent} />
        <Text style={[styles.toggleLbl, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">Enable Pickup Alerts</Text>
        <Switch
          value={on}
          onValueChange={toggle}
          disabled={busy}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor="#fff"
          accessibilityLabel="Enable Pickup Alerts"
        />
      </View>
      {!home && !on ? (
        <TouchableOpacity onPress={() => toggle(true)} hitSlop={8}>
          <Text style={[styles.link, { color: theme.accent }]}>Save my location</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 4 },
  lead: { fontSize: 14, fontWeight: '700' },
  sub: { fontSize: 13, fontWeight: '600', marginTop: 2, marginBottom: 10 },
  meta: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  hint: { fontSize: 11, fontWeight: '500', marginTop: 6, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLbl: { flex: 1, fontSize: 14, fontWeight: '700' },
  link: { fontSize: 12, fontWeight: '700', marginTop: 8 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6, marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  avatarImg: { width: 48, height: 48, borderRadius: 24 },
  avatarTxt: { color: '#fff', fontSize: 18, fontWeight: '800' },
  optIn: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  optInTitle: { fontSize: 13, fontWeight: '700' },
  optInSub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
});
