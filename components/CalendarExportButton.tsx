import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { haptics } from '../lib/haptics';
import { t } from '../lib/i18n';
import { shareFlightsAsCalendar } from '../lib/calendarExport';
import { icalFlightFrom, icalOptions, type CalendarFlightInput } from '../lib/calendarFlight';

type Props = {
  /** The flights to export: one from a card, all of them from the trip overview. */
  flights: CalendarFlightInput[];
  /** The route the calling screen already resolved, for a single flight. */
  route?: { origin?: string; destination?: string };
  label: string;
  colors: { text: string; border: string; card: string };
  style?: StyleProp<ViewStyle>;
  onToast?: (msg: string) => void;
};

/**
 * "📅 Add to calendar" — writes a .ics and opens the share sheet, where the traveller picks their own
 * calendar app. The button says what happened: nothing silently succeeds or silently fails.
 */
export default function CalendarExportButton({
  flights, route, label, colors, style, onToast,
}: Props) {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    if (busy) return;
    haptics.light();
    setBusy(true);
    const copy = t();
    try {
      const result = await shareFlightsAsCalendar(
        (flights || []).map(f => icalFlightFrom(f, flights.length === 1 ? route : undefined)),
        icalOptions(),
      );
      if (result === 'shared') onToast?.(copy.calendarExportDone);
      else if (result !== 'nothing') onToast?.(copy.calendarExportError);
      // 'nothing' means no flight had a departure time yet: there is nothing to say about that.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable
      onPress={() => { void run(); }}
      disabled={busy}
      style={({ pressed }) => [
        styles.btn,
        { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed || busy ? 0.7 : 1 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      {busy
        ? <ActivityIndicator color={colors.text} />
        : <Text style={[styles.txt, { color: colors.text }]} numberOfLines={1}>{`📅  ${label}`}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  txt: { fontSize: 14, fontWeight: '700' },
});
