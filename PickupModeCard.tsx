import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
  capturePickupHome,
  disablePickup,
  enablePickup,
  estimateDriveMinutes,
  loadPickup,
  loadPickupHome,
  type PickupHome,
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
  terminal,
  etaIso,
  airportLat,
  airportLon,
  theme,
  onToast,
  onEnsureTracked,
}: {
  flightKey: string;
  flightNumber: string;
  destIata: string;
  destName: string;
  terminal?: string;
  etaIso: string;
  airportLat?: number;
  airportLon?: number;
  theme: ThemeBits;
  onToast: (msg: string) => void;
  onEnsureTracked: () => void;
}) {
  const [home, setHome] = useState<PickupHome | null>(null);
  const [on, setOn] = useState(false);
  const [driveMin, setDriveMin] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPickupHome().then(h => { if (!cancelled) setHome(h); });
    loadPickup(flightKey).then(e => {
      if (cancelled) return;
      setOn(!!e?.enabled);
      if (e?.driveMin) setDriveMin(e.driveMin);
    });
    return () => { cancelled = true; };
  }, [flightKey]);

  useEffect(() => {
    if (!home) return;
    let cancelled = false;
    estimateDriveMinutes(home, airportLat, airportLon, destIata).then(mins => {
      if (!cancelled) setDriveMin(mins);
    });
    return () => { cancelled = true; };
  }, [home, airportLat, airportLon, destIata]);

  const toggle = async (next: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      if (!next) {
        await disablePickup(flightKey);
        setOn(false);
        haptics.light();
        onToast('Pickup alerts off');
        return;
      }
      let loc = home;
      if (!loc) {
        loc = await capturePickupHome();
        if (!loc) {
          onToast('Location permission needed for pickup alerts');
          return;
        }
        setHome(loc);
      }
      const mins = driveMin ?? await estimateDriveMinutes(loc, airportLat, airportLon, destIata);
      setDriveMin(mins);
      if (!etaIso) {
        onToast('Arrival time unknown — try again when the flight has an ETA');
        return;
      }
      onEnsureTracked();
      await enablePickup({
        flightKey,
        flightNumber,
        destIata,
        destName: destName || destIata,
        terminal: terminal || '',
        etaIso,
        driveMin: mins,
        homeLabel: loc.label,
      });
      setOn(true);
      haptics.success();
      onToast('Pickup alerts on — we\'ll tell you when to leave');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.list, borderColor: theme.border }]}>
      <Text style={[styles.title, { color: theme.text }]}>🚗 Pickup Mode</Text>
      <Text style={[styles.lead, { color: theme.text }]}>Picking someone up?</Text>
      <Text style={[styles.sub, { color: theme.secondary }]}>We'll tell you when to leave</Text>

      {home ? (
        <Text style={[styles.meta, { color: theme.secondary }]}>
          Your location: {home.label}
        </Text>
      ) : (
        <Text style={[styles.meta, { color: theme.muted }]}>
          We'll save your location once when you enable alerts
        </Text>
      )}
      {driveMin != null ? (
        <Text style={[styles.meta, { color: theme.secondary }]}>
          Drive time to {destIata || 'airport'}: ~{driveMin} min
        </Text>
      ) : null}
      <Text style={[styles.hint, { color: theme.muted }]}>
        Includes ~{BAGGAGE_MIN} min baggage + {ARRIVALS_WALK_MIN} min to arrivals
      </Text>

      <View style={styles.row}>
        <Car size={16} color={theme.accent} />
        <Text style={[styles.toggleLbl, { color: theme.text }]}>Enable Pickup Alerts</Text>
        {busy ? (
          <ActivityIndicator size="small" color={theme.accent} />
        ) : (
          <Switch
            value={on}
            onValueChange={toggle}
            trackColor={{ false: theme.border, true: theme.accent }}
            thumbColor="#fff"
            accessibilityLabel="Enable Pickup Alerts"
          />
        )}
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
});
