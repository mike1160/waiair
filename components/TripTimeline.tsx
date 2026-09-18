/**
 * Trip timeline on the flight detail page: the departure, the saved hotel and car rental, the return flight, and a
 * soft invite for whatever is still missing. Always visible — nothing has to be tapped open first.
 */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { TripTimelineRow, TripTimelineSlot } from '../lib/tripTimeline';

type Theme = {
  text: string;
  muted: string;
  accent: string;
  card: string;
  border: string;
};

type Props = {
  rows: TripTimelineRow[];
  slots: TripTimelineSlot[];
  theme: Theme;
  /** Date and time label for a row; the screen formats it, because it knows the airport's clock. */
  whenLabel: (iso?: string) => string;
  labels: {
    departure: (place: string) => string;
    returnFlight: (flight: string) => string;
    addHotel: string;
    addReturn: string;
  };
  onAdd: (slot: TripTimelineSlot) => void;
  /** The saved hotel and car rental cards, shown between the flight rows. */
  children?: ReactNode;
};

export default function TripTimeline({ rows, slots, theme, whenLabel, labels, onAdd, children }: Props) {
  const outbound = rows.filter(r => r.kind === 'outbound');
  const back = rows.filter(r => r.kind === 'return');
  if (!outbound.length && !back.length && !children && !slots.length) return null;

  const flightRow = (row: TripTimelineRow) => {
    const when = whenLabel(row.iso);
    const title = row.kind === 'return' ? labels.returnFlight(row.title) : labels.departure(row.title);
    return (
      <View key={`${row.kind}-${row.iso || row.title}`} style={styles.row}>
        <Text style={styles.icon}>✈️</Text>
        <View style={styles.rowText}>
          {when ? <Text style={[styles.when, { color: theme.muted }]}>{when}</Text> : null}
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{title}</Text>
        </View>
      </View>
    );
  };

  const invite = (slot: TripTimelineSlot) => (
    <Pressable
      key={`add-${slot}`}
      onPress={() => onAdd(slot)}
      style={[styles.invite, { borderColor: theme.border }]}
      accessibilityRole="button"
      accessibilityLabel={slot === 'hotel' ? labels.addHotel : labels.addReturn}
    >
      <Text style={[styles.inviteTxt, { color: theme.muted }]}>
        {`＋  ${slot === 'hotel' ? labels.addHotel : labels.addReturn}`}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {outbound.map(flightRow)}
      {children}
      {back.map(flightRow)}
      {slots.map(invite)}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 2 },
  icon: { fontSize: 16, marginTop: 1 },
  rowText: { flex: 1, minWidth: 0 },
  when: { fontSize: 12, fontWeight: '600' },
  title: { fontSize: 15, fontWeight: '700', marginTop: 1 },
  invite: {
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  inviteTxt: { fontSize: 13, fontWeight: '600' },
});
