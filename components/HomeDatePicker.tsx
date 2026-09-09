import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { enUS } from 'date-fns/locale/en-US';
import { nl as nlLocale } from 'date-fns/locale/nl';
import { CaretLeft, CaretRight } from 'phosphor-react-native';
import { getLocale } from '../lib/i18n';

function dateFnsLocale() {
  return getLocale() === 'nl' ? nlLocale : enUS;
}

function atNoon(d: Date): Date {
  const n = new Date(d);
  n.setHours(12, 0, 0, 0);
  return n;
}

function parseYmd(raw: string): Date {
  const m = String(raw || '').match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return atNoon(new Date());
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
}

function weekdayLabels(): string[] {
  const start = startOfWeek(new Date(), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end: addDays(start, 6) }).map(d =>
    format(d, 'EEEEEE', { locale: dateFnsLocale() }),
  );
}

function monthDays(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

type Colors = {
  text: string;
  muted: string;
  accent: string;
  card: string;
  border: string;
};

/** Compact month grid — same pattern as Book a flight, home colors. */
export default function HomeDatePicker({
  selectedYmd,
  minYmd,
  colors: c,
  onSelect,
}: {
  selectedYmd?: string;
  minYmd: string;
  colors: Colors;
  onSelect: (ymd: string) => void;
}) {
  const minDate = startOfDay(parseYmd(minYmd));
  const selected = selectedYmd ? parseYmd(selectedYmd) : null;
  const [month, setMonth] = useState(() => startOfMonth(selected || minDate));
  const days = useMemo(() => monthDays(month), [month]);
  const canPrev = !isBefore(startOfMonth(addMonths(month, -1)), startOfMonth(minDate));
  const week = weekdayLabels();

  return (
    <View style={styles.wrap}>
      <View style={styles.nav}>
        <Pressable
          onPress={() => canPrev && setMonth(m => addMonths(m, -1))}
          disabled={!canPrev}
          hitSlop={8}
          accessibilityRole="button"
        >
          <CaretLeft size={18} color={canPrev ? c.accent : c.muted} />
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>
          {format(month, 'MMMM yyyy', { locale: dateFnsLocale() })}
        </Text>
        <Pressable
          onPress={() => setMonth(m => addMonths(m, 1))}
          hitSlop={8}
          accessibilityRole="button"
        >
          <CaretRight size={18} color={c.accent} />
        </Pressable>
      </View>
      <View style={styles.weekRow}>
        {week.map((d, i) => (
          <Text key={`${d}-${i}`} style={[styles.weekLbl, { color: c.muted }]}>{d}</Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map(day => {
          const inMonth = isSameMonth(day, month);
          const past = isBefore(startOfDay(day), minDate);
          const on = !!selected && isSameDay(day, selected);
          const todayMark = isToday(day);
          return (
            <Pressable
              key={format(day, 'yyyy-MM-dd')}
              disabled={past}
              onPress={() => onSelect(format(atNoon(day), 'yyyy-MM-dd'))}
              style={styles.dayCell}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: past }}
            >
              <View
                style={[
                  styles.dayInner,
                  on && { backgroundColor: c.accent },
                  !on && todayMark && { borderWidth: 1, borderColor: c.accent },
                ]}
              >
                <Text
                  style={[
                    styles.dayTxt,
                    { color: on ? '#0D1B2E' : c.text },
                    !inMonth && { color: c.muted },
                    past && { color: c.muted, opacity: 0.45 },
                  ]}
                >
                  {format(day, 'd')}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 8 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  title: { fontSize: 15, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginBottom: 4 },
  weekLbl: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTxt: { fontSize: 14, fontWeight: '600' },
});
