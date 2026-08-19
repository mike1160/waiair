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
import { t } from './lib/i18n';
import { parseTimeMs } from './lib/boardFilter';
import { landingCardPhase, type LandingCardPhase } from './lib/landingCards';
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

const PICKUP_LANDED_EXPIRE_MS = 90 * 60 * 1000;

function pickupLandedExpired(status?: string, landedIso?: string, now = Date.now()): boolean {
  if (status !== 'landed') return false;
  const ms = landedIso ? parseTimeMs(landedIso) : null;
  if (!ms) return false;
  return now - ms > PICKUP_LANDED_EXPIRE_MS;
}

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
  flightStatus,
  landedIso,
  theme,
  onToast,
  onEnsureTracked,
  onOpenWho,
  boardType = 'arrival',
  personRevision = 0,
  landingPhase: landingPhaseProp,
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
  flightStatus?: string;
  landedIso?: string;
  theme: ThemeBits;
  onToast: (msg: string) => void;
  onEnsureTracked: () => void;
  onOpenWho?: () => void;
  boardType?: 'arrival' | 'departure';
  personRevision?: number;
  landingPhase?: LandingCardPhase;
}) {
  const [home, setHome] = useState<PickupHome | null>(null);
  const [on, setOn] = useState(false);
  const [surpriseOn, setSurpriseOn] = useState(false);
  const [busy, setBusy] = useState(false);
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
    if (flightStatus !== 'landed') return;
    const id = setInterval(() => setTick(n => n + 1), 60_000);
    return () => {
      try { clearInterval(id); } catch (e) {}
    };
  }, [flightStatus]);

  const pickupExpired = pickupLandedExpired(flightStatus, landedIso);
  const computedPhase = landingCardPhase({
    status: flightStatus,
    arrIso: landedIso || etaIso,
  });
  const landingPhase =
    landingPhaseProp === 'hidden' || computedPhase === 'hidden'
      ? 'hidden'
      : (landingPhaseProp ?? computedPhase);
  const hidePickup = landingPhase === 'hidden';
  const togglesDisabled = busy || pickupExpired || hidePickup || drive.tooFar;

  useEffect(() => {
    if (!pickupExpired && !hidePickup) return;
    if (!on && !surpriseOn) return;
    let cancelled = false;
    void (async () => {
      try {
        await disablePickup(flightKey);
        await savePickupAlertsEnabled(flightKey, false);
      } catch { /* ignore */ }
      if (!cancelled) {
        setOn(false);
        setSurpriseOn(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pickupExpired, hidePickup, flightKey, on, surpriseOn]);

  useEffect(() => {
    if (!surpriseOn || !on || pickupExpired || hidePickup) return;
    const id = setInterval(() => setTick(n => n + 1), 30_000);
    return () => {
      try { clearInterval(id); } catch (e) {}
    };
  }, [surpriseOn, on, pickupExpired, hidePickup, etaIso, drive.minutes]);

  const toggle = async (next: boolean, opts?: { surprise?: boolean }): Promise<boolean> => {
    if (togglesDisabled) return false;
    const useSurprise = opts?.surprise ?? surpriseOn;
    const prevOn = on;
    setOn(next);
    setBusy(true);
    try {
      await savePickupAlertsEnabled(flightKey, next);
      if (!next) {
        await disablePickup(flightKey);
        setSurpriseOn(false);
        haptics.light();
        onToast(t().pickupAlertsOff);
        return true;
      }
      let loc = home;
      if (!loc) {
        loc = await capturePickupHome();
        if (loc) setHome(loc);
      }
      if (!loc) {
        setOn(prevOn);
        await savePickupAlertsEnabled(flightKey, prevOn);
        haptics.success();
        onToast(t().pickupAlertsOnAllowLocation);
        return false;
      }
      const est = estimateDriveToAirport(
        loc,
        { iata: destIata, lat: destLat, lon: destLon, name: destName },
        { iata: localIata, lat: localLat, lon: localLon, name: localName },
      );
      if (est.tooFar || est.minutes == null) {
        setOn(prevOn);
        await savePickupAlertsEnabled(flightKey, prevOn);
        return false;
      }
      if (!etaIso) {
        setOn(prevOn);
        await savePickupAlertsEnabled(flightKey, prevOn);
        haptics.success();
        onToast(t().pickupAlertsOnEta);
        return false;
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
      return true;
    } catch {
      setOn(prevOn);
      await savePickupAlertsEnabled(flightKey, prevOn).catch(() => {});
      onToast(next ? t().pickupAlertsOn : t().pickupAlertsOff);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const toggleSurprise = async (next: boolean) => {
    if (togglesDisabled) return;
    if (next && !person?.name?.trim()) {
      onToast(t().surpriseEnterName);
      haptics.error();
      return;
    }

    const prev = surpriseOn;
    setSurpriseOn(next);

    if (next && !on) {
      const ok = await toggle(true, { surprise: true });
      if (!ok) setSurpriseOn(false);
      return;
    }

    setBusy(true);
    try {
      const updated = await setSurpriseWelcomeEnabled(flightKey, next, person);
      if (next && !updated) {
        setBusy(false);
        const ok = await toggle(true, { surprise: true });
        if (!ok) setSurpriseOn(false);
        return;
      }
      if (next) setOn(true);
      haptics.light();
      onToast(next ? t().surpriseEnabled : t().surpriseDisabled);
    } catch {
      setSurpriseOn(prev);
      haptics.error();
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
  const leaveLine = !pickupExpired && driveLine && leaveClock
    ? `${driveLine} · ${copy.leaveAt(leaveClock)}`
    : !pickupExpired ? driveLine : null;
  const leaveMins = !pickupExpired && etaIso && drive.minutes != null && !drive.tooFar
    ? minutesUntilLeave(etaIso, drive.minutes)
    : null;
  const surpriseCountdown = !pickupExpired && surpriseOn && on && leaveClock && leaveMins != null
    ? copy.surpriseLeaveCountdown(leaveClock, leaveMins)
    : '';

  if (boardType !== 'arrival') return null;
  if (hidePickup) return null;

  const named = !!person?.name;
  const avatarColor = colorForPickupName(person?.name || '');
  const initials = initialsForPickupName(person?.name || '');

  return (
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
              {pickupExpired ? copy.pickupFlightArrived : copy.wellTellWhenToLeave}
            </Text>
            {!pickupExpired && leaveLine ? (
              <Text style={[styles.meta, { color: theme.secondary }]} numberOfLines={2} ellipsizeMode="tail">
                {leaveLine}
              </Text>
            ) : null}
            {!pickupExpired && surpriseOn && on ? (
              <Text style={[styles.surpriseActive, { color: theme.accent }]} numberOfLines={2}>
                {copy.surpriseWelcomeActive}
              </Text>
            ) : null}
            {!pickupExpired && surpriseCountdown ? (
              <Text style={[styles.meta, { color: theme.text }]} numberOfLines={2} ellipsizeMode="tail">
                {surpriseCountdown}
              </Text>
            ) : null}
          </View>
        </View>
      ) : (
        <>
          <Text style={[styles.lead, { color: theme.text }]} numberOfLines={1} ellipsizeMode="tail">{copy.pickingSomeoneUp}</Text>
          <Text style={[styles.sub, { color: theme.secondary }]} numberOfLines={1} ellipsizeMode="tail">
            {pickupExpired ? copy.pickupFlightArrived : copy.wellTellWhenToLeave}
          </Text>
          {!pickupExpired && home ? (
            <Text style={[styles.meta, { color: theme.secondary }]} numberOfLines={1} ellipsizeMode="tail">
              {copy.yourLocation(home.label)}
            </Text>
          ) : !pickupExpired ? (
            <Text style={[styles.meta, { color: theme.muted }]} numberOfLines={2} ellipsizeMode="tail">
              {copy.saveLocationOnce}
            </Text>
          ) : null}
          {!pickupExpired && driveLine ? (
            <Text style={[styles.meta, { color: theme.secondary }]} numberOfLines={2} ellipsizeMode="tail">
              {driveLine}
            </Text>
          ) : null}
        </>
      )}

      {!pickupExpired ? (
      <>
      <Text style={[styles.hint, { color: theme.muted }]} numberOfLines={2} ellipsizeMode="tail">
        {copy.pickupBaggageHint(BAGGAGE_MIN, ARRIVALS_WALK_MIN)}
      </Text>

      {drive.tooFar ? (
        <Text style={[styles.tooFarHint, { color: theme.muted }]} numberOfLines={2} ellipsizeMode="tail">
          {copy.tooFarFromAirport}
        </Text>
      ) : null}

      <View style={styles.row}>
        <Car size={16} color={drive.tooFar ? theme.muted : theme.accent} />
        <Text style={[styles.toggleLbl, { color: drive.tooFar ? theme.muted : theme.text }]} numberOfLines={1} ellipsizeMode="tail">{copy.enablePickupAlerts}</Text>
        <Switch
          value={on}
          onValueChange={v => { void toggle(v); }}
          disabled={togglesDisabled}
          trackColor={{ false: theme.border, true: theme.accent }}
          thumbColor="#fff"
          accessibilityLabel={copy.enablePickupAlerts}
        />
      </View>

      <View style={[styles.surpriseRow, { borderColor: theme.border }]}>
        <View style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <Text style={[styles.surpriseTitle, { color: drive.tooFar ? theme.muted : theme.text }]} numberOfLines={1}>
            {copy.surpriseWelcome}
          </Text>
          <Text style={[styles.surpriseSub, { color: theme.secondary }]} numberOfLines={2}>
            {copy.surpriseWelcomeSub}
          </Text>
        </View>
        <Switch
          value={surpriseOn}
          onValueChange={toggleSurprise}
          disabled={togglesDisabled}
          trackColor={{ false: theme.border, true: '#F5A623' }}
          thumbColor="#fff"
          accessibilityLabel={copy.surpriseWelcome}
        />
      </View>
      {!home && !on && !drive.tooFar ? (
        <TouchableOpacity onPress={() => toggle(true)} hitSlop={8}>
          <Text style={[styles.link, { color: theme.accent }]}>{copy.saveMyLocation}</Text>
        </TouchableOpacity>
      ) : null}

      {onOpenWho ? (
        <View style={styles.whoWrap}>
          <TouchableOpacity
            style={[styles.whoBtn, { backgroundColor: `${theme.accent}18`, borderColor: `${theme.accent}40` }]}
            onPress={onOpenWho}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={copy.addPersonToPickUp}
          >
            <Text
              style={[styles.whoBtnTxt, { color: theme.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
            >
              👤 {copy.addPersonToPickUp}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
      </>
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
  tooFarHint: { fontSize: 12, fontWeight: '600', marginBottom: 10, fontStyle: 'italic' },
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
  whoWrap: { alignItems: 'center', marginTop: 12, marginBottom: 4, alignSelf: 'stretch' },
  whoBtn: {
    maxWidth: '92%',
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  whoBtnTxt: { fontSize: 13, fontWeight: '700', textAlign: 'center', width: '100%' },
});
