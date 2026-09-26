import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { haptics } from '../lib/haptics';
import { t } from '../lib/i18n';
import { shareFlightsAsCalendar } from '../lib/calendarExport';
import { addFlightsToCalendar } from '../lib/calendarWrite';
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
 * "📅 Add to calendar", and a smaller "Share" beside it.
 *
 * The first writes the event into the traveller's own calendar. It used to hand a .ics to the share sheet
 * instead, where the Calendar app never appears — iOS gives it no share extension for that type — so the
 * one thing the button promised was the one thing it could not do [M/3]. Sharing the file is still offered,
 * because that is how it reaches Mail, WhatsApp or Files.
 *
 * Neither path may leave the spinner running or fail without saying so.
 */
export default function CalendarExportButton({
  flights, route, label, colors, style, onToast,
}: Props) {
  const [busy, setBusy] = useState<'none' | 'add' | 'share'>('none');

  const icalFlights = () => (flights || []).map(f => icalFlightFrom(f, flights.length === 1 ? route : undefined));

  const addToCalendar = async () => {
    if (busy !== 'none') return;
    haptics.light();
    setBusy('add');
    const copy = t();
    try {
      const { result } = await addFlightsToCalendar(icalFlights(), icalOptions());
      if (result === 'added') onToast?.(copy.calendarAdded);
      else if (result === 'denied') onToast?.(copy.calendarPermissionDenied);
      else if (result === 'nothing') {
        // No flight had a departure time yet: there is nothing to say about that.
      } else onToast?.(copy.calendarExportError);
    } catch (e) {
      console.warn('[calendar] writing the event failed', e);
      onToast?.(copy.calendarExportError);
    } finally {
      setBusy('none');
    }
  };

  const shareFile = async () => {
    if (busy !== 'none') return;
    haptics.light();
    setBusy('share');
    const copy = t();
    try {
      const result = await shareFlightsAsCalendar(icalFlights(), icalOptions());
      if (result === 'shared') onToast?.(copy.calendarExportDone);
      else if (result === 'nothing' || result === 'timeout') {
        // 'nothing': no flight had a departure time. 'timeout': the sheet never reported back, so what the
        // traveller chose is unknown — neither is worth a message, and both must stop the spinner.
      } else onToast?.(copy.calendarExportError);
    } catch (e) {
      console.warn('[calendar] sharing the file failed', e);
      onToast?.(copy.calendarExportError);
    } finally {
      setBusy('none');
    }
  };

  return (
    <View style={[styles.row, style]}>
      <Pressable
        onPress={() => { void addToCalendar(); }}
        disabled={busy !== 'none'}
        style={({ pressed }) => [
          styles.btn,
          { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed || busy === 'add' ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {busy === 'add'
          ? <ActivityIndicator color={colors.text} />
          : <Text style={[styles.txt, { color: colors.text }]} numberOfLines={1}>{`📅  ${label}`}</Text>}
      </Pressable>
      <Pressable
        onPress={() => { void shareFile(); }}
        disabled={busy !== 'none'}
        style={({ pressed }) => [
          styles.shareBtn,
          { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed || busy === 'share' ? 0.7 : 1 },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t().calendarShareFile}
      >
        {busy === 'share'
          ? <ActivityIndicator color={colors.text} />
          : <Text style={[styles.txt, { color: colors.text }]} numberOfLines={1}>{t().calendarShareFile}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', justifyContent: 'center', gap: 8 },
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
  shareBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  txt: { fontSize: 14, fontWeight: '700' },
});
