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
import { buildPickupShareMessage } from './lib/flightQuickShare';
import { t } from './lib/i18n';
import QuickShareRow from './components/QuickShareRow';
import {
  ARRIVALS_WALK_MIN,
  BAGGAGE_MIN,
  capturePickupHome,
  colorForPickupName,
  disablePickup,
  enablePickup,
  estimateDriveToAirport,
  initialsForPickupName,
  loadPickupAlertsEnabled,
  loadPickupHome,
  loadPickupPerson,
  loadSurpriseWelcomeEnabled,
  minutesUntilLeave,
  pickupLeaveClock,
  savePickupAlertsEnabled,
  setSurpriseWelcomeEnabled,
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
  const [surpriseOn, setSurpriseOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [person, setPerson] = useState<PickupPerson | null>(null);
  const [, setTick] = useState(0);

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
    loadSurpriseWelcomeEnabled(flightKey).then(enabled => {
      if (!cancelled) setSurpriseOn(enabled);
    });
    loadPickupPerson(flightKey).then(p => { if (!cancelled) setPerson(p); });
    return () => { cancelled = true; };
  }, [flightKey, personRevision]);

  useEffect(() => {
    if (!surpriseOn || !on) return;
    const id = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(id);
  }, [surpriseOn, on, etaIso, drive.minutes]);

  const toggle = async (next: boolean, opts?: { surprise?: boolean }) => {
    if (busy) return;
    const useSurprise = opts?.surprise ?? surpriseOn;
    setOn(next);
    setBusy(true);
    try {
      await savePickupAlertsEnabled(flightKey, next);
      if (!next) {
        await disablePickup(flightKey);
        setSurpriseOn(false);
        haptics.light();
        onToast(t().pickupAlertsOff);
        return;
      }
      let loc = home;
      if (!loc) {
        loc = await capturePickupHome();
        if (loc) setHome(loc);
      }
      if (!loc) {
        haptics.success();
        onToast(t().pickupAlertsOnAllowLocation);
        return;
      }
      const est = estimateDriveToAirport(
        loc,
        { iata: destIata, lat: destLat, lon: destLon, name: destName },
        { iata: localIata, lat: localLat, lon: localLon, name: localName },
      );
      if (est.tooFar || est.minutes == null) {
        haptics.success();
        onToast(t().tooFarToDrive);
        return;
      }
      if (!etaIso) {
        haptics.success();
        onToast(t().pickupAlertsOnEta);
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
        surpriseWelcome: useSurprise,
      });
      if (useSurprise) setSurpriseOn(true);
      haptics.success();
      onToast(useSurprise ? t().surpriseEnabled : t().pickupAlertsOnLeave);
    } catch {
      onToast(next ? t().pickupAlertsOn : t().pickupAlertsOff);
    } finally {
      setBusy(false);
    }
  };

  const toggleSurprise = async (next: boolean) => {
    if (busy) return;
    if (next && !person?.name?.trim()) {
      onToast(t().surpriseEnterName);
      haptics.error();
      return;
    }
    if (next && !on) {
      setSurpriseOn(true);
      await toggle(true, { surprise: true });
      return;
    }
    setSurpriseOn(next);
    setBusy(true);
    try {
      const updated = await setSurpriseWelcomeEnabled(flightKey, next, person);
      if (next && !updated) {
        setSurpriseOn(false);
        onToast(t().surpriseEnterName);
        return;
      }
      haptics.light();
      onToast(next ? t().surpriseEnabled : t().surpriseDisabled);
    } catch {
      setSurpriseOn(!next);
    } finally {
      setBusy(false);
    }
  };

  const copy = t();
  const driveLine = drive.tooFar
    ? copy.tooFarToDrive
    : drive.minutes != null
      ? copy.minToAirport(drive.minutes)
      : null;
  const leaveClock = etaIso && drive.minutes != null && !drive.tooFar
    ? pickupLeaveClock(etaIso, drive.minutes)
    : '';
  const leaveLine = driveLine && leaveClock
    ? `${driveLine} · ${copy.leaveAt(leaveClock)}`
    : driveLine;
  const leaveMins = etaIso && drive.minutes != null && !drive.tooFar
    ? minutesUntilLeave(etaIso, drive.minutes)
    : null;
  const surpriseCountdown = surpriseOn && on && leaveClock && leaveMins != null
    ? copy.surpriseLeaveCountdown(leaveClock, leaveMins)
    : '';
  const pickupShareMessage = useMemo(
    () => buildPickupShareMessage(person?.name || '', destName || destIata),
    [person?.name, destName, destIata],
  );

  if (boardType !== 'arrival') return null;

  const named = !!person?.name;
  const avatarColor = colorForPickupName(person?.name || '');
  const initials = initialsForPickupName(person?.name || '');

  return (
    <View>
    <View style={[styles.card, { backgroundColor: theme.list, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">🚗 {copy.pickupMode}</Text>
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
              {copy.pickingUp(person!.name)}
            </Text>
            <Text style={[styles.sub, { color: theme.secondary, marginBottom: 0 }]} numberOfLines={1} ellipsizeMode="tail">
              {copy.wellTellWhenToLeave}
            </Text>
            {leaveLine ? (
              <Text style={[styles.meta, { color: theme.secondary }]} numberOfLines={2} ellipsizeMode="tail">
                {leaveLine}
              </Text>
            ) : null}
            {surpriseOn && on ? (
              <Text style={[styles.surpriseActive, { color: theme.accent }]} numberOfLines={2}>
                {copy.surpriseWelcomeActive}
              </Text>
            ) : null}
            {surpriseCountdown ? (
              <Text style={[styles.meta, { color: theme.text }]} numberOfLines={2} ellipsizeMode="tail">
                {surpriseCountdown}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.lead, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">{copy.pickingSomeoneUp}</Text>
          <Text style={[styles.sub, { color: theme.secondary }]} numberOfLines={1} ellipsizeMode="tail">{copy.wellTellWhenToLeave}</Text>
          {home ? (
            <Text style={[styles.meta, { color: theme.secondary }]} numberOfLines={1} ellipsizeMode="tail">
              {copy.yourLocation(home.label)}
            </Text>
          ) : (
            <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={2} ellipsizeMode="tail">
              {copy.saveLocationOnce}
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
        {copy.pickupBaggageHint(BAGGAGE_MIN, ARRIVALS_WALK_MIN)}
      </Text>

      <View style={styles.row}>
        <Car size={16} color={theme.accent} />
        <Text style={[styles.toggleLbl, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">{copy.enablePickupAlerts}</Text>
        <Switch
          value={on}
          onValueChange={toggle}
          disabled={busy}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor="#fff"
          accessibilityLabel={copy.enablePickupAlerts}
        />
      </View>

      <View style={[styles.surpriseRow, { borderColor: theme.border }]}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <Text style={[styles.surpriseTitle, { color: theme.text }]} numberOfLines={1}>
            {copy.surpriseWelcome}
          </Text>
          <Text style={[styles.surpriseSub, { color: theme.secondary }]} numberOfLines={2}>
            {copy.surpriseWelcomeSub}
          </Text>
        </View>
        <Switch
          value={surpriseOn}
          onValueChange={toggleSurprise}
          disabled={busy}
          trackColor={{ false: theme.border, true: '#F5A623' }}
          thumbColor="#fff"
          accessibilityLabel={copy.surpriseWelcome}
        />
      </View>
      {!home && !on ? (
        <TouchableOpacity onPress={() => toggle(true)} hitSlop={8}>
          <Text style={[styles.link, { color: theme.accent }]}>{copy.saveMyLocation}</Text>
        </TouchableOpacity>
      ) : null}
    </View>

    <QuickShareRow
      mode="text"
      message={pickupShareMessage}
      busy={shareBusy}
      onBusy={setShareBusy}
      compact
      showLabels={false}
      showMore={false}
    />
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
  surpriseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  surpriseTitle: { fontSize: 14, fontWeight: '800' },
  surpriseSub: { fontSize: 12, fontWeight: '600', marginTop: 2, lineHeight: 16 },
  surpriseActive: { fontSize: 13, fontWeight: '800', marginTop: 6 },
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
