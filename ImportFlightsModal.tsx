import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Calendar from 'expo-calendar';
import { CalendarBlank, EnvelopeSimple, X } from 'phosphor-react-native';
import { type BoardingPassInfo } from './lib/bcbp';
import { parseCalendarEvent, parseImportText, type ImportCandidate } from './lib/flightImport';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';
import { Theme } from './constants/theme';

type Step = 'choose' | 'email' | 'confirm';

type Props = {
  visible: boolean;
  onClose: () => void;
  trackedNumbers: string[];
  onImport: (flightNumber: string, dateIso?: string, pass?: BoardingPassInfo) => Promise<void>;
};

const BG = Theme.background;
const ACCENT = Theme.gold;
const SCAN_DAYS = 90;

function slug(n: string): string {
  return String(n || '').replace(/\s+/g, '').toUpperCase();
}

async function requestFullCalendarAccess(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const current = await Calendar.getCalendarPermissions();
    if (current.granted) return true;
    const next = await Calendar.requestCalendarPermissions();
    return next.granted;
  } catch {
    return false;
  }
}

async function scanCalendarFlights(): Promise<ImportCandidate[]> {
  const calendars = await Calendar.getCalendars(Calendar.EntityTypes.EVENT);
  if (!calendars.length) return [];
  const start = new Date();
  const end = new Date();
  end.setDate(end.getDate() + SCAN_DAYS);
  const events = await Calendar.listEvents(calendars, start, end);
  const found: ImportCandidate[] = [];
  const seen = new Set<string>();
  for (const ev of events) {
    const parsed = parseCalendarEvent({
      title: ev.title,
      notes: ev.notes,
      location: ev.location,
      startDate: ev.startDate,
    });
    for (const c of parsed) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      found.push(c);
    }
  }
  return found;
}

export default function ImportFlightsModal({ visible, onClose, trackedNumbers, onImport }: Props) {
  const [step, setStep] = useState<Step>('choose');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [paste, setPaste] = useState('');
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const tracked = new Set(trackedNumbers.map(slug));

  const reset = useCallback(() => {
    setStep('choose');
    setBusy(false);
    setErr('');
    setPaste('');
    setCandidates([]);
    setSelected({});
  }, []);

  useEffect(() => {
    if (!visible) reset();
  }, [visible, reset]);

  const showConfirm = (list: ImportCandidate[]) => {
    setCandidates(list);
    const next: Record<string, boolean> = {};
    for (const c of list) next[c.id] = !tracked.has(slug(c.flightNumber));
    setSelected(next);
    setStep('confirm');
  };

  const startCalendar = async () => {
    haptics.light();
    setErr('');
    if (Platform.OS === 'web') {
      setErr(t().importCalendarApps);
      return;
    }
    setBusy(true);
    try {
      const granted = await requestFullCalendarAccess();
      if (!granted) {
        setErr(t().importCalendarDenied);
        return;
      }
      const list = await scanCalendarFlights();
      if (!list.length) {
        setErr(t().importCalendarEmpty);
        return;
      }
      showConfirm(list);
    } catch {
      setErr(t().importCalendarEmpty);
    } finally {
      setBusy(false);
    }
  };

  const openMail = async () => {
    haptics.light();
    try {
      await Linking.openURL('message://');
    } catch {
      /* paste instructions stay visible */
    }
  };

  const parsePaste = () => {
    haptics.light();
    const list = parseImportText(paste);
    if (!list.length) {
      setErr(t().importNoFlightsFound);
      return;
    }
    setErr('');
    showConfirm(list);
  };

  const toggle = (id: string, flightNumber: string) => {
    if (tracked.has(slug(flightNumber))) return;
    haptics.light();
    setSelected(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const selectedList = candidates.filter(c => selected[c.id] && !tracked.has(slug(c.flightNumber)));

  const importSelected = async () => {
    if (!selectedList.length || busy) return;
    haptics.medium();
    setBusy(true);
    setErr('');
    try {
      for (const c of selectedList) {
        const pass = c.origin || c.destination
          ? {
              flightNumber: c.flightNumber,
              dateIso: c.dateIso,
              from: c.origin,
              to: c.destination,
            }
          : undefined;
        await onImport(c.flightNumber, c.dateIso, pass);
      }
      onClose();
    } catch {
      setErr(t().importFailed);
    } finally {
      setBusy(false);
    }
  };

  const copy = t();
  const title = step === 'email'
    ? copy.importFromEmail
    : step === 'confirm'
      ? copy.importConfirmTitle
      : copy.importFlights;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          {step !== 'choose' ? (
            <TouchableOpacity
              onPress={() => { haptics.light(); setErr(''); setStep(step === 'confirm' && paste ? 'email' : 'choose'); }}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={copy.importBack}
            >
              <Text style={styles.back}>{copy.importBack}</Text>
            </TouchableOpacity>
          ) : <View style={{ width: 48 }} />}
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={copy.importClose}
          >
            <X size={18} color="#f4f7fb" weight="bold" />
          </TouchableOpacity>
        </View>

        {step === 'choose' ? (
          <View style={styles.body}>
            <Text style={styles.sub}>{copy.importFlightsSub}</Text>
            <Pressable
              style={styles.option}
              onPress={startCalendar}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={copy.importFromCalendar}
            >
              <View style={styles.iconWrap}>
                <CalendarBlank size={22} color={ACCENT} weight="bold" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{copy.importFromCalendar}</Text>
                <Text style={styles.optionSub}>{copy.importFromCalendarSub}</Text>
              </View>
            </Pressable>
            <Pressable
              style={styles.option}
              onPress={() => { haptics.light(); setErr(''); setStep('email'); }}
              accessibilityRole="button"
              accessibilityLabel={copy.importFromEmail}
            >
              <View style={styles.iconWrap}>
                <EnvelopeSimple size={22} color={ACCENT} weight="bold" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>{copy.importFromEmail}</Text>
                <Text style={styles.optionSub}>{copy.importFromEmailSub}</Text>
              </View>
            </Pressable>
            {busy ? <ActivityIndicator color={ACCENT} style={{ marginTop: 18 }} /> : null}
            {err ? <Text style={styles.err}>{err}</Text> : null}
          </View>
        ) : null}

        {step === 'email' ? (
          <View style={styles.body}>
            <Text style={styles.sub}>{copy.importEmailHelp}</Text>
            {Platform.OS !== 'web' ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={openMail}
                accessibilityRole="button"
                accessibilityLabel={copy.importOpenMail}
              >
                <EnvelopeSimple size={16} color={Theme.background} weight="bold" />
                <Text style={styles.secondaryBtnTxt}>{copy.importOpenMail}</Text>
              </TouchableOpacity>
            ) : null}
            <TextInput
              style={styles.paste}
              value={paste}
              onChangeText={txt => { setPaste(txt); setErr(''); }}
              placeholder={copy.importPastePlaceholder}
              placeholderTextColor="rgba(244,247,251,0.35)"
              multiline
              textAlignVertical="top"
              autoCorrect={false}
              accessibilityLabel={copy.importPasteHint}
            />
            <TouchableOpacity
              style={[styles.primaryBtn, !paste.trim() && { opacity: 0.45 }]}
              onPress={parsePaste}
              disabled={!paste.trim()}
              accessibilityRole="button"
              accessibilityLabel={copy.importFindFlights}
            >
              <Text style={styles.primaryBtnTxt}>{copy.importFindFlights}</Text>
            </TouchableOpacity>
            {err ? <Text style={styles.err}>{err}</Text> : null}
          </View>
        ) : null}

        {step === 'confirm' ? (
          <View style={styles.body}>
            <Text style={styles.sub}>{copy.importConfirmSub}</Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 16 }}>
              {candidates.map(c => {
                const already = tracked.has(slug(c.flightNumber));
                const on = !!selected[c.id] && !already;
                return (
                  <Pressable
                    key={c.id}
                    style={[styles.row, already && { opacity: 0.5 }]}
                    onPress={() => toggle(c.id, c.flightNumber)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on, disabled: already }}
                    accessibilityLabel={c.label}
                  >
                    <View style={[styles.check, on && styles.checkOn]}>
                      {on ? <Text style={styles.checkMark}>✓</Text> : null}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{c.flightNumber}</Text>
                      <Text style={styles.rowSub} numberOfLines={2}>
                        {already ? copy.importAlreadyTracked : c.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <TouchableOpacity
              style={[styles.primaryBtn, (!selectedList.length || busy) && { opacity: 0.45 }]}
              onPress={importSelected}
              disabled={!selectedList.length || busy}
              accessibilityRole="button"
              accessibilityLabel={copy.importSelectedCount(selectedList.length)}
            >
              {busy
                ? <ActivityIndicator color={Theme.background} />
                : <Text style={styles.primaryBtnTxt}>{copy.importSelectedCount(selectedList.length)}</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG, paddingTop: Platform.OS === 'web' ? 16 : 18 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    minHeight: 48,
  },
  title: { flex: 1, textAlign: 'center', color: '#f4f7fb', fontSize: 16, fontWeight: '800' },
  back: { color: ACCENT, fontSize: 14, fontWeight: '700', width: 56 },
  body: { flex: 1, paddingHorizontal: 16, paddingBottom: 24 },
  sub: { color: 'rgba(244,247,251,0.68)', fontSize: 13, fontWeight: '500', marginBottom: 16 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#161a22',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: { color: '#f4f7fb', fontSize: 15, fontWeight: '800' },
  optionSub: { color: 'rgba(244,247,251,0.58)', fontSize: 12, fontWeight: '500', marginTop: 2 },
  paste: {
    minHeight: 160,
    backgroundColor: '#161a22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.22)',
    color: '#f4f7fb',
    fontSize: 14,
    padding: 14,
    marginTop: 12,
  },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: ACCENT,
    borderRadius: 12,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryBtnTxt: { color: Theme.background, fontSize: 15, fontWeight: '800' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    minHeight: 44,
  },
  secondaryBtnTxt: { color: Theme.background, fontSize: 14, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(244,247,251,0.08)',
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(245,158,11,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  checkMark: { color: Theme.background, fontSize: 13, fontWeight: '900' },
  rowTitle: { color: '#f4f7fb', fontSize: 15, fontWeight: '800' },
  rowSub: { color: 'rgba(244,247,251,0.55)', fontSize: 12, marginTop: 2 },
  err: { color: '#fca5a5', fontSize: 13, fontWeight: '600', marginTop: 12 },
});
