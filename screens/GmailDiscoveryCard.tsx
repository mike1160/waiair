/**
 * What the Gmail scan just found, shown over My Flights.
 *
 * Not a modal and not a screen: a View that springs up from the bottom inside the existing layout, so the
 * flights behind it stay visible and the user can ignore it. It closes itself after AUTO_DISMISS_MS unless
 * the user touches it — a card that vanishes mid-read would be worse than one that stays.
 */
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'phosphor-react-native';
import { t } from '../lib/i18n';
import { haptics } from '../lib/haptics';
import { useMode } from '../lib/modeContext';
import { formatFlightNumber } from '../lib/flightIdent';
import type { ImportCandidate } from '../lib/flightImport';
import type { TripGroup } from '../lib/tripOrchestrator';

/** Long enough to read a few rows, short enough not to sit in the way. */
export const AUTO_DISMISS_MS = 15_000;
const MAX_HEIGHT_RATIO = 0.6;

export type GmailDiscoveryCardProps = {
  groups: TripGroup[];
  /** Flights the parser was not sure enough about to track on its own. */
  pendingReview: ImportCandidate[];
  visible: boolean;
  onAddAll: () => void;
  onReview: () => void;
  onDismiss: () => void;
};

/** "27 sep" in the app's language; the ISO date is never shown raw. */
function shortDay(iso?: string): string {
  const ymd = String(iso || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  const ms = Date.parse(`${ymd}T12:00:00Z`);
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' })
      .format(new Date(ms))
      .replace(/\./g, '');
  } catch {
    return ymd.slice(8, 10);
  }
}

function dateRange(start?: string, end?: string): string {
  const a = shortDay(start);
  const b = shortDay(end);
  if (a && b && a !== b) return `${a} – ${b}`;
  return a || b;
}

type Row = { icon: string; title: string; sub?: string; day?: string };

/** One group's flights and bookings as the rows the card draws. */
function rowsForGroup(group: TripGroup): Row[] {
  const rows: Row[] = [];
  for (const f of group.flights) {
    const number = formatFlightNumber({ number: f.flightNumber || '' });
    const from = String(f.flight?.origin || '').toUpperCase();
    const to = String(f.flight?.destination || '').toUpperCase();
    rows.push({
      icon: '✈️',
      title: number || '—',
      sub: from && to ? `${from} → ${to}` : undefined,
      day: shortDay(f.scheduledTime),
    });
  }
  const e = group.extras || {};
  if (e.hotel?.name) rows.push({ icon: '🏨', title: e.hotel.name, day: shortDay(e.hotel.checkIn) });
  if (e.carRental?.company) rows.push({ icon: '🚗', title: e.carRental.company, day: shortDay(e.carRental.pickupTime) });
  if (e.transfer?.provider) rows.push({ icon: '🚐', title: e.transfer.provider, day: shortDay(e.transfer.pickupTime) });
  if (e.excursion?.name) rows.push({ icon: '🎟️', title: e.excursion.name, day: shortDay(e.excursion.dateTime) });
  if (e.restaurant?.name) rows.push({ icon: '🍜', title: e.restaurant.name, day: shortDay(e.restaurant.dateTime) });
  return rows;
}

function DiscoveryRow({ row, muted, text, faded }: { row: Row; muted: string; text: string; faded?: boolean }) {
  return (
    <View style={[st.row, faded ? st.rowFaded : null]}>
      <Text style={st.rowIcon}>{row.icon}</Text>
      <Text style={[st.rowTitle, { color: text }]} numberOfLines={1}>{row.title}</Text>
      {row.sub ? <Text style={[st.rowSub, { color: muted }]} numberOfLines={1}>{row.sub}</Text> : null}
      {row.day ? <Text style={[st.rowDay, { color: muted }]}>{row.day}</Text> : null}
    </View>
  );
}

export default function GmailDiscoveryCard({
  groups,
  pendingReview,
  visible,
  onAddAll,
  onReview,
  onDismiss,
}: GmailDiscoveryCardProps) {
  const copy = t();
  const { C } = useMode();
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set the moment the user touches the card: from then on it only closes when they say so. */
  const [held, setHeld] = useState(false);
  const maxHeight = Math.round(Dimensions.get('window').height * MAX_HEIGHT_RATIO);

  const stopAutoDismiss = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    progress.stopAnimation();
    setHeld(true);
  };

  useEffect(() => {
    if (!visible) {
      slide.setValue(0);
      progress.setValue(0);
      setHeld(false);
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    Animated.spring(slide, { toValue: 1, useNativeDriver: true, damping: 18, stiffness: 160, mass: 0.9 }).start();
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: AUTO_DISMISS_MS,
      easing: Easing.linear,
      useNativeDriver: false,
    }).start();
    timer.current = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
    };
    // onDismiss is stable enough here: the card is remounted for every discovery.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;
  // Keyed on what a group actually draws: a trip whose flights are already tracked still has bookings to show.
  const grouped = (groups || [])
    .filter(Boolean)
    .map(group => ({ group, rows: rowsForGroup(group) }))
    .filter(g => g.rows.length > 0);
  const pending = pendingReview || [];
  if (!grouped.length && !pending.length) return null;

  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [maxHeight, 0] });
  const barWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ['100%', '0%'] });

  return (
    <Animated.View
      style={[
        st.wrap,
        {
          transform: [{ translateY }],
          maxHeight,
          backgroundColor: C.card,
          borderColor: C.border,
          shadowColor: C.isDark ? '#000000' : '#0A1628',
        },
      ]}
      onStartShouldSetResponderCapture={() => {
        stopAutoDismiss();
        return false;
      }}
    >
      <View style={st.header}>
        <Text style={[st.title, { color: C.text }]} numberOfLines={1}>{copy.gmailDiscoveryTitle}</Text>
        <Pressable
          onPress={() => { haptics.light(); onDismiss(); }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={copy.close}
        >
          <X size={20} color={C.muted} />
        </Pressable>
      </View>

      <ScrollView
        style={st.body}
        contentContainerStyle={st.bodyContent}
        onScrollBeginDrag={stopAutoDismiss}
        showsVerticalScrollIndicator={false}
      >
        {grouped.map(({ group, rows }) => {
          // A single flight needs no section header — the row says it all.
          const solo = group.flights.length < 2 && rows.length === 1;
          return (
            <View key={group.key} style={st.group}>
              {solo ? null : (
                <View style={st.groupHead}>
                  <Text style={[st.groupName, { color: C.text }]} numberOfLines={1}>{group.name}</Text>
                  <Text style={[st.groupRange, { color: C.muted }]}>{dateRange(group.startDate, group.endDate)}</Text>
                </View>
              )}
              {rows.map((row, i) => (
                <DiscoveryRow key={`${group.key}:${i}`} row={row} muted={C.muted} text={C.text} />
              ))}
            </View>
          );
        })}

        {pending.length ? (
          <View style={st.group}>
            <Text style={[st.pendingHead, { color: C.muted }]}>{copy.gmailDiscoveryPending}</Text>
            {pending.map(c => (
              <DiscoveryRow
                key={c.id}
                row={{
                  icon: '✈️',
                  title: formatFlightNumber({ number: c.flightNumber }),
                  sub: c.origin && c.destination ? `${c.origin} → ${c.destination}` : undefined,
                  day: shortDay(c.dateIso),
                }}
                muted={C.muted}
                text={C.text}
                faded
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View style={[st.footer, { paddingBottom: 14 + insets.bottom }]}>
        <Pressable
          onPress={() => { haptics.medium(); stopAutoDismiss(); onAddAll(); }}
          style={({ pressed }) => [st.primary, { backgroundColor: C.accent, opacity: pressed ? 0.85 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={copy.gmailDiscoveryAddAll}
        >
          <Text style={[st.primaryTxt, { color: C.isDark ? '#0A1628' : '#FFFFFF' }]}>
            {copy.gmailDiscoveryAddAll}
          </Text>
        </Pressable>
        {pending.length ? (
          <Pressable
            onPress={() => { haptics.light(); stopAutoDismiss(); onReview(); }}
            style={({ pressed }) => [st.secondary, { borderColor: C.border, opacity: pressed ? 0.7 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel={copy.gmailDiscoveryReview}
          >
            <Text style={[st.secondaryTxt, { color: C.text }]}>{copy.gmailDiscoveryReview}</Text>
          </Pressable>
        ) : null}
      </View>

      {/* The countdown, and the first sign that the card will leave on its own. */}
      {held ? null : (
        <View
          style={[st.progressTrack, { backgroundColor: C.border, bottom: Math.max(6, insets.bottom - 8) }]}
          accessibilityLabel={copy.gmailDiscoveryAutoDismiss}
        >
          <Animated.View style={[st.progressFill, { width: barWidth, backgroundColor: C.accent }]} />
        </View>
      )}
    </Animated.View>
  );
}

const st = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 16,
    zIndex: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  title: { flex: 1, fontSize: 17, fontWeight: '800' },
  body: { flexGrow: 0 },
  bodyContent: { paddingHorizontal: 20, paddingBottom: 8, gap: 14 },
  group: { gap: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  groupName: { flex: 1, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
  groupRange: { fontSize: 13, fontWeight: '600' },
  pendingHead: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  rowFaded: { opacity: 0.55 },
  rowIcon: { fontSize: 15 },
  rowTitle: { fontSize: 14, fontWeight: '700' },
  rowSub: { flex: 1, fontSize: 13, fontWeight: '500' },
  rowDay: { fontSize: 13, fontWeight: '600', marginLeft: 'auto' },
  footer: { paddingHorizontal: 20, paddingTop: 10, gap: 8 },
  primary: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryTxt: { fontSize: 16, fontWeight: '800' },
  secondary: { borderRadius: 14, paddingVertical: 12, alignItems: 'center', borderWidth: 1 },
  secondaryTxt: { fontSize: 15, fontWeight: '700' },
  progressTrack: { position: 'absolute', left: 0, right: 0, height: 3 },
  progressFill: { height: 3 },
});
