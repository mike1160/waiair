/**
 * Fix: date picker — trip-extras date/time fields were raw text inputs ("YYYY-MM-DD" / "YYYY-MM-DDTHH:mm").
 * This field shows DD/MM/YYYY (dates) or DD/MM/YYYY · HH:mm (date + time) and opens the native picker:
 * an inline iOS spinner, Android's date (then time) dialog. The stored value keeps the existing
 * "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm" format, so saved trip extras and the parsers are unchanged.
 */
import { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { X } from 'phosphor-react-native';
import { getLocale, t } from './lib/i18n';
import { haptics } from './lib/haptics';
import { useMode } from './lib/modeContext';
import { tripExtrasPalette, type TripExtrasPalette } from './lib/tripExtrasPalette';

/** Follows the active theme like the hotel & transfer sheet it sits in (lib/tripExtrasPalette.ts). */
function useThemedStyles() {
  const { C } = useMode();
  return useMemo(() => {
    const p = tripExtrasPalette(C);
    return { p, st: makeStyles(p) };
  }, [C]);
}

export type TripDateMode = 'date' | 'datetime';

const pad = (n: number) => String(n).padStart(2, '0');

/** "2026-09-18" / "2026-09-18T14:30" (local wall time) → Date; null for anything else. */
export function parseTripDate(value?: string): Date | null {
  const m = String(value || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toTripDateValue(d: Date, mode: TripDateMode): string {
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return mode === 'date' ? day : `${day}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** DD/MM/YYYY or DD/MM/YYYY · HH:mm; unparseable text (e.g. from an old paste) is shown as-is. */
export function formatTripDate(value: string | undefined, mode: TripDateMode): string {
  const d = parseTripDate(value);
  if (!d) return String(value || '');
  const day = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  return mode === 'date' ? day : `${day} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultDraft(mode: TripDateMode, fallback?: string): Date {
  const base = parseTripDate(fallback);
  if (base) return base;
  const now = new Date();
  if (mode === 'date') return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
  return now;
}

export default function TripDateField({
  label,
  value,
  onChange,
  mode,
  fallback,
  error,
}: {
  label: string;
  value?: string;
  onChange: (value: string | undefined) => void;
  mode: TripDateMode;
  /** Value the picker starts on when the field is empty (e.g. the arrival date). */
  fallback?: string;
  /** Red validation message under the field. */
  error?: string;
}) {
  const { st, p } = useThemedStyles();
  const copy = t();
  const [open, setOpen] = useState(false);
  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(null);
  const [draft, setDraft] = useState<Date>(() => parseTripDate(value) || defaultDraft(mode, fallback));
  const placeholder = mode === 'date' ? 'DD/MM/YYYY' : 'DD/MM/YYYY · HH:mm';
  const locale = getLocale() === 'zh' ? 'zh-CN' : getLocale();

  const openPicker = () => {
    haptics.light();
    const start = parseTripDate(value) || defaultDraft(mode, fallback);
    setDraft(start);
    if (Platform.OS === 'android') {
      setAndroidStep('date');
      return;
    }
    // Opening an empty field fills it with the starting point, so "Klaar" without scrolling keeps that value.
    if (!value) onChange(toTripDateValue(start, mode));
    setOpen(v => !v);
  };

  const onIosChange = (_e: DateTimePickerEvent, d?: Date) => {
    if (!d) return;
    setDraft(d);
    onChange(toTripDateValue(d, mode));
  };

  const onAndroidChange = (e: DateTimePickerEvent, d?: Date) => {
    const step = androidStep;
    setAndroidStep(null);
    if (e.type !== 'set' || !d) return;
    if (step === 'date') {
      const next = new Date(d.getFullYear(), d.getMonth(), d.getDate(), draft.getHours(), draft.getMinutes());
      setDraft(next);
      if (mode === 'datetime') {
        setAndroidStep('time');
        return;
      }
      onChange(toTripDateValue(next, mode));
      return;
    }
    const next = new Date(draft.getFullYear(), draft.getMonth(), draft.getDate(), d.getHours(), d.getMinutes());
    setDraft(next);
    onChange(toTripDateValue(next, mode));
  };

  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <View style={st.row}>
        <Pressable
          onPress={openPicker}
          style={[st.input, !!error && st.inputError, open && st.inputOpen]}
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${value ? formatTripDate(value, mode) : placeholder}`}
        >
          <Text style={value ? st.valueTxt : st.placeholderTxt}>
            {value ? formatTripDate(value, mode) : placeholder}
          </Text>
        </Pressable>
        {value ? (
          <Pressable
            onPress={() => { haptics.light(); setOpen(false); onChange(undefined); }}
            hitSlop={8}
            style={st.clear}
            accessibilityRole="button"
            accessibilityLabel={`${copy.importClose} ${label}`}
          >
            <X size={14} color={p.muted} weight="bold" />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={st.error}>{error}</Text> : null}

      {Platform.OS === 'ios' && open ? (
        <View style={st.picker}>
          <DateTimePicker
            value={draft}
            mode={mode}
            display="spinner"
            onChange={onIosChange}
            locale={locale}
            themeVariant={p.dark ? 'dark' : 'light'}
            textColor={p.text}
            accentColor={p.accent}
            minuteInterval={5}
          />
          <Pressable onPress={() => { haptics.light(); setOpen(false); }} style={st.done} accessibilityRole="button">
            <Text style={st.doneTxt}>{copy.done}</Text>
          </Pressable>
        </View>
      ) : null}

      {Platform.OS === 'android' && androidStep ? (
        <DateTimePicker value={draft} mode={androidStep} onChange={onAndroidChange} is24Hour />
      ) : null}
    </View>
  );
}

function makeStyles(p: TripExtrasPalette) {
  return StyleSheet.create({
    field: { marginBottom: 10 },
    label: { color: p.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    input: {
      flex: 1,
      backgroundColor: p.field,
      borderWidth: 1,
      borderColor: p.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    },
    inputOpen: { borderColor: p.accent },
    inputError: { borderColor: '#E07A7A' },
    valueTxt: { color: p.text, fontSize: 15, fontWeight: '600' },
    placeholderTxt: { color: p.muted, fontSize: 15, fontWeight: '600' },
    clear: { width: 32, height: 32, borderRadius: 16, backgroundColor: p.field, alignItems: 'center', justifyContent: 'center' },
    error: { color: '#E07A7A', fontSize: 12, fontWeight: '700', marginTop: 6 },
    picker: { marginTop: 8, backgroundColor: p.field, borderRadius: 12, paddingBottom: 8, alignItems: 'center' },
    done: { alignSelf: 'stretch', marginHorizontal: 12, backgroundColor: p.accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
    doneTxt: { color: p.surface, fontSize: 14, fontWeight: '800' },
  });
}
