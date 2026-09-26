/**
 * The Live Arrival Board [Q/1]: the full screen the person waiting in the arrivals hall gets when the flight
 * they came for is on the ground.
 *
 * Drawn as a departures board — the airport theme's own colours (AIRPORT_BOARD), monospace, square corners,
 * capitals — because that is the thing it is imitating, and because someone glancing at a phone in a crowded
 * hall reads a board faster than a card.
 *
 * ┌──────────────────────────────────┐
 * │                                ✕ │
 * │  ARRIVED ✓                       │
 * │  BR75 · BKK → AMS                │
 * ├───────────┬──────────┬───────────┤
 * │  LANDED   │  GATE    │  BAGGAGE  │
 * │  19:12    │  D7      │  12       │
 * ├───────────┴──────────┴───────────┤
 * │  Sarah has landed 🎉             │
 * │  [ Navigate ] [ Message ] [ … ]  │
 * │  Last update: 19:14              │
 * └──────────────────────────────────┘
 *
 * It closes only by the ✕ — no swipe, no tap outside. Someone holding a phone while watching a door should
 * not be able to lose this by accident. It refreshes itself every 30 seconds, because gate and belt are
 * announced minutes after the wheels are down, and it retires itself two hours after landing
 * (lib/arrivalBoard.ts holds that rule).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../lib/i18n';
import { AIRPORT_BOARD, MONO } from '../lib/themes';
import { openRideHailing, RIDEHAILING_LINKS, rideHailingFor } from '../lib/getIntoTown';
import { openMapsQuery, shareAddressText } from '../lib/tripExtras';
import {
  ARRIVAL_BOARD_BLANK,
  ARRIVAL_BOARD_REFRESH_MS,
  arrivalMessageText,
  arrivalNavigateQuery,
  type ArrivalBoardView,
} from '../lib/arrivalBoard';

type Props = {
  /** Null closes the board. Rebuilt by the caller on every refresh tick. */
  view: ArrivalBoardView | null;
  /** The arrival airport's full name, for the maps search. */
  airportName?: string;
  /** hh:mm in the arrival airport's clock, for "last update". */
  updatedClock: string;
  /** Arrival airport, to work out whether Grab is the local ride-hailing app. */
  destIata?: string;
  /** Asked for every 30 seconds; the caller refetches gate and belt. */
  onRefresh?: () => void;
  onDismiss: () => void;
  /** Hide the "share my location" button, which asks for a location permission when pressed. */
  hideShareLocation?: boolean;
};

export default function ArrivalBoardScreen({
  view,
  airportName,
  updatedClock,
  destIata,
  onRefresh,
  onDismiss,
  hideShareLocation,
}: Props) {
  const insets = useSafeAreaInsets();
  const copy = t();
  const [busy, setBusy] = useState<'navigate' | 'message' | 'location' | null>(null);

  /*
   * Gate and belt arrive after the landing does, so the board keeps asking for them.
   *
   * The callback is held in a ref and the effect depends only on *whether* the board is open. Depending on
   * `view` or on `onRefresh` looks natural and is fatal: both are rebuilt on every render, so the interval
   * was cleared and restarted before it ever reached thirty seconds and the board never refreshed at all.
   */
  const refreshRef = useRef(onRefresh);
  refreshRef.current = onRefresh;
  const open = !!view;
  useEffect(() => {
    if (!open) return undefined;
    const id = setInterval(() => refreshRef.current?.(), ARRIVAL_BOARD_REFRESH_MS);
    return () => clearInterval(id);
  }, [open]);

  const route = useMemo(() => {
    if (!view) return '';
    return [view.origin, view.destination].filter(x => x && x !== ARRIVAL_BOARD_BLANK).join(' → ');
  }, [view]);

  if (!view) return null;

  /*
   * Grab when it is actually installed, maps otherwise. The app's own opener (lib/getIntoTown.ts) is what
   * launches Grab, but its fallback is grab.com — a website is no use to someone who needs a route — so the
   * deep link is asked about here first and maps takes over when the answer is no. Nothing in the ride-hailing
   * integration itself changes.
   */
  const navigate = async () => {
    setBusy('navigate');
    try {
      const deep = rideHailingFor(destIata).includes('Grab') ? RIDEHAILING_LINKS.Grab : '';
      if (deep) {
        let installed = false;
        try { installed = await Linking.canOpenURL(deep); } catch { installed = false; }
        if (installed) {
          await openRideHailing('Grab');
          return;
        }
      }
      await openMapsQuery(arrivalNavigateQuery(view, airportName));
    } catch { /* the board stays up either way */ } finally {
      setBusy(null);
    }
  };

  const message = async () => {
    setBusy('message');
    try {
      // shareAddressText already prefers whatsapp:// and falls back to the share sheet.
      await shareAddressText(arrivalMessageText(view, copy));
    } catch { /* ignore */ } finally {
      setBusy(null);
    }
  };

  /*
   * "I am standing here." The position is read when the button is pressed, turned into a maps link and handed
   * to the share sheet — it is never stored and never sent anywhere by the app. Refusing the permission simply
   * does nothing, which is the honest outcome of saying no.
   */
  const shareLocation = async () => {
    setBusy('location');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
        .catch(() => null);
      if (!pos) return;
      const { latitude, longitude } = pos.coords;
      await shareAddressText(`https://maps.google.com/?q=${latitude},${longitude}`);
    } catch { /* ignore */ } finally {
      setBusy(null);
    }
  };

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      /* Android's back button is the one system gesture that must still work. */
      onRequestClose={onDismiss}
    >
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 56, paddingBottom: insets.bottom + 24 },
          ]}
        >
          <Text style={styles.arrived}>{`${copy.arrivalBoardArrived} ✓`}</Text>
          <Text style={styles.flight}>{view.flightNumber}</Text>
          {route ? <Text style={styles.route}>{route}</Text> : null}
          {view.city ? <Text style={styles.city}>{view.city.toUpperCase()}</Text> : null}

          <View style={styles.rule} />

          <View style={styles.cells}>
            <Cell label={copy.arrivalBoardLanded} value={view.landedAt} tone={AIRPORT_BOARD.landed} />
            <Cell label={copy.arrivalBoardGate} value={view.gate} tone={AIRPORT_BOARD.amber} />
            <Cell label={copy.arrivalBoardBaggage} value={view.baggage} tone={AIRPORT_BOARD.amber} />
          </View>
          {view.terminal ? (
            <Text style={styles.terminal}>{view.terminal}</Text>
          ) : null}

          <View style={styles.rule} />

          {view.travelerName ? (
            <Text style={styles.landedLine}>{copy.arrivalBoardHasLanded(view.travelerName)}</Text>
          ) : (
            <Text style={styles.landedLine}>{copy.arrivalBoardTitle}</Text>
          )}

          <Action
            label={`🚗  ${copy.arrivalBoardNavigate}`}
            onPress={navigate}
            busy={busy === 'navigate'}
            primary
          />
          <Action
            label={`✉️  ${copy.arrivalBoardMessage}`}
            onPress={message}
            busy={busy === 'message'}
          />
          {hideShareLocation ? null : (
            <Action
              label={`📍  ${copy.arrivalBoardShareLocation}`}
              onPress={shareLocation}
              busy={busy === 'location'}
            />
          )}

          <Text style={styles.updated}>{copy.arrivalBoardLastUpdate(updatedClock)}</Text>
        </ScrollView>

        {/* The only way out. A swipe or a tap outside cannot close this by accident. */}
        <TouchableOpacity
          onPress={onDismiss}
          style={[styles.close, { top: insets.top + 8 }]}
          accessibilityRole="button"
          accessibilityLabel={copy.arrivalBoardDismiss}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

/** One board cell: a small grey caption over a big value, the way the panel overhead does it. */
function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label.toUpperCase()}</Text>
      <Text style={[styles.cellValue, { color: value === ARRIVAL_BOARD_BLANK ? AIRPORT_BOARD.soft : tone }]}>
        {value}
      </Text>
    </View>
  );
}

function Action({
  label,
  onPress,
  busy,
  primary,
}: { label: string; onPress: () => void; busy?: boolean; primary?: boolean }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={[styles.action, primary ? styles.actionPrimary : null, busy ? styles.actionBusy : null]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? AIRPORT_BOARD.bg : AIRPORT_BOARD.amber} />
      ) : (
        <Text style={[styles.actionText, primary ? styles.actionTextPrimary : null]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AIRPORT_BOARD.bg },
  scroll: { paddingHorizontal: 20 },
  arrived: {
    color: AIRPORT_BOARD.green,
    fontFamily: MONO,
    fontSize: 22,
    letterSpacing: 2,
    fontWeight: '700',
  },
  flight: {
    color: '#FFFFFF',
    fontFamily: MONO,
    fontSize: 46,
    letterSpacing: 2,
    fontWeight: '700',
    marginTop: 10,
  },
  route: {
    color: AIRPORT_BOARD.amber,
    fontFamily: MONO,
    fontSize: 20,
    letterSpacing: 2,
    marginTop: 6,
  },
  city: {
    color: AIRPORT_BOARD.soft,
    fontFamily: MONO,
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 4,
  },
  rule: { height: 1, backgroundColor: AIRPORT_BOARD.rule, marginVertical: 18 },
  cells: { flexDirection: 'row' },
  cell: { flex: 1, backgroundColor: AIRPORT_BOARD.card, paddingVertical: 14, paddingHorizontal: 10, marginRight: 1 },
  cellLabel: { color: AIRPORT_BOARD.soft, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5 },
  cellValue: { fontFamily: MONO, fontSize: 26, fontWeight: '700', marginTop: 6 },
  terminal: {
    color: AIRPORT_BOARD.amber,
    fontFamily: MONO,
    fontSize: 14,
    letterSpacing: 2,
    marginTop: 10,
  },
  landedLine: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 20,
  },
  action: {
    borderWidth: 1,
    borderColor: AIRPORT_BOARD.amber,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  actionPrimary: { backgroundColor: AIRPORT_BOARD.amber },
  actionBusy: { opacity: 0.7 },
  actionText: { color: AIRPORT_BOARD.amber, fontFamily: MONO, fontSize: 15, letterSpacing: 1 },
  actionTextPrimary: { color: AIRPORT_BOARD.bg, fontWeight: '700' },
  updated: {
    color: AIRPORT_BOARD.soft,
    fontFamily: MONO,
    fontSize: 12,
    letterSpacing: 1,
    marginTop: 14,
  },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: AIRPORT_BOARD.rule,
    backgroundColor: AIRPORT_BOARD.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: '#FFFFFF', fontSize: 18, fontFamily: MONO },
});
