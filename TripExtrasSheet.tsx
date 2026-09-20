import { useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
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
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { X } from 'phosphor-react-native';
import { parseTripExtras } from './lib/flightImport';
import {
  backgroundScanGmailTripExtras,
  clearGmailSuggestion,
  connectGmail,
  extrasFromSuggestion,
  getCachedGmailSuggestions,
  gmailScanConfigured,
  isGmailConnected,
  type GmailSuggestion,
} from './lib/gmailTripExtras';
import { t } from './lib/i18n';
import {
  callPhone,
  cleanTripExtras,
  mergeTripExtras,
  type TripCarRental,
  type TripExtras,
  type TripHotel,
  type TripTransfer,
} from './lib/tripExtras';
import { haptics } from './lib/haptics';
import { useMode } from './lib/modeContext';
import { tripExtrasPalette, type TripExtrasPalette } from './lib/tripExtrasPalette';
import TripExtrasBubbleRow from './TripExtrasBubbleRow';
import HotelNameAutocomplete from './HotelNameAutocomplete';
import CarRentalLogoRow from './CarRentalLogoRow';
import TripDateField, { parseTripDate, toTripDateValue } from './TripDateField';

/** The sheet follows the active theme (lib/tripExtrasPalette.ts): light, dark, Kids or Airport. */
function useSheetStyles() {
  const { C } = useMode();
  return useMemo(() => {
    const p = tripExtrasPalette(C);
    return { p, st: makeStyles(p) };
  }, [C]);
}

type Tab = 'hotel' | 'car' | 'transfer';

type Props = {
  visible: boolean;
  onClose: () => void;
  extras?: TripExtras | null;
  arrivalDate?: string;
  airportLabel?: string;
  flightKey: string;
  arrivalIso?: string;
  onSave: (extras: TripExtras | undefined) => void;
  /** Hotel/transfer overview: open on the tab of the item being edited. */
  initialTab?: Tab;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'phone-pad';
}) {
  const { p, st } = useSheetStyles();
  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={p.muted}
        style={[st.input, multiline && st.inputMulti]}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCorrect={false}
      />
    </View>
  );
}

/** Fix: date validation — empty check-out / drop-off pickers start a day after check-in / pickup, not on an invalid value. */
function dayAfter(value?: string, mode: 'date' | 'datetime' = 'date'): string | undefined {
  const d = parseTripDate(value);
  if (!d) return undefined;
  d.setDate(d.getDate() + 1);
  return toTripDateValue(d, mode);
}

export default function TripExtrasSheet({
  visible,
  onClose,
  extras,
  arrivalDate,
  airportLabel,
  flightKey,
  arrivalIso,
  onSave,
  initialTab,
}: Props) {
  const copy = t();
  const { p, st } = useSheetStyles();
  const [tab, setTab] = useState<Tab>('hotel');
  const [hotel, setHotel] = useState<TripHotel>({});
  const [car, setCar] = useState<TripCarRental>({});
  const [transfer, setTransfer] = useState<TripTransfer>({});
  const [pasteOpen, setPasteOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [parsed, setParsed] = useState<Partial<TripExtras> | null>(null);
  const [gmailBusy, setGmailBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<GmailSuggestion[]>([]);
  const [gmailNote, setGmailNote] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [scanErr, setScanErr] = useState('');
  const [scanLocked, setScanLocked] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLock = useRef(false);

  useEffect(() => {
    if (!visible) return;
    setHotel(extras?.hotel || { checkIn: arrivalDate });
    setCar(extras?.carRental || {});
    setTransfer(extras?.transfer || { pickupLocation: airportLabel });
    setTab(initialTab || 'hotel');
    setPaste('');
    setParsed(null);
    setGmailNote('');
    setScanOpen(false);
    setScanErr('');
    setScanLocked(false);
    scanLock.current = false;
    if (flightKey) {
      getCachedGmailSuggestions(flightKey).then(setSuggestions).catch(() => {});
    }
  }, [visible, extras, arrivalDate, airportLabel, flightKey, initialTab]);

  const draft = useMemo(
    () => cleanTripExtras({ hotel, carRental: car, transfer }),
    [hotel, car, transfer],
  );

  const applyParsed = (patch: Partial<TripExtras>, source: 'parsed' | 'gmail') => {
    const merged = mergeTripExtras({ hotel, carRental: car, transfer }, patch, source);
    setHotel(merged?.hotel || {});
    setCar(merged?.carRental || {});
    setTransfer(merged?.transfer || {});
    if (patch.hotel) setTab('hotel');
    else if (patch.carRental) setTab('car');
    else if (patch.transfer) setTab('transfer');
    haptics.success();
  };

  const runPaste = () => {
    const found = parseTripExtras(paste);
    if (!found.hotel && !found.carRental && !found.transfer) {
      setParsed(null);
      setGmailNote(copy.tripExtrasNoParse);
      haptics.error();
      return;
    }
    setGmailNote('');
    setParsed(found);
    haptics.light();
  };

  /*
   * Fix: date validation — check-out must be after check-in and the drop-off (inlever) time after the pickup time.
   * Values are "YYYY-MM-DD" / "YYYY-MM-DDTHH:mm", so string order is time order.
   */
  const checkOutError = hotel.checkIn && hotel.checkOut && hotel.checkOut <= hotel.checkIn
    ? copy.tripExtrasCheckOutAfterCheckIn : '';
  const dropoffError = car.pickupTime && car.dropoffTime && car.dropoffTime <= car.pickupTime
    ? copy.tripExtrasDropoffAfterPickup : '';

  const save = () => {
    // Fix: date validation — do not save invalid dates; jump to the tab that shows the red message.
    if (checkOutError || dropoffError) {
      setTab(checkOutError ? 'hotel' : 'car');
      haptics.error();
      return;
    }
    onSave(draft);
    haptics.success();
    onClose();
  };

  const scanGmail = async () => {
    setGmailBusy(true);
    setGmailNote('');
    try {
      const connected = await isGmailConnected();
      if (!connected) {
        const auth = await connectGmail();
        if (!auth.ok) {
          setGmailNote(
            auth.reason === 'not_configured'
              ? copy.tripExtrasGmailNotConfigured
              : copy.tripExtrasGmailNeedConnect,
          );
          return;
        }
      }
      const list = await backgroundScanGmailTripExtras({ flightKey, arrivalIso });
      setSuggestions(list);
      setGmailNote(list.length ? '' : copy.tripExtrasGmailNone);
    } finally {
      setGmailBusy(false);
    }
  };

  const openScan = async () => {
    setScanErr('');
    scanLock.current = false;
    setScanLocked(false);
    try {
      if (!permission?.granted) {
        const next = await requestPermission();
        if (!next?.granted) {
          setGmailNote(copy.cameraPermission);
          return;
        }
      }
      setScanOpen(true);
    } catch {
      setGmailNote(copy.cameraPermission);
    }
  };

  const onQrScanned = (result: BarcodeScanningResult) => {
    if (scanLock.current) return;
    const raw = String(result?.data || '').trim();
    if (!raw) return;
    scanLock.current = true;
    setScanLocked(true);
    let text = raw;
    try { text = decodeURIComponent(raw.replace(/\+/g, ' ')); } catch { /* keep raw */ }
    const found = parseTripExtras(`${raw}\n${text}`);
    if (!found.hotel && !found.carRental && !found.transfer) {
      scanLock.current = false;
      setScanLocked(false);
      setScanErr(copy.tripExtrasNoParse);
      haptics.error();
      return;
    }
    applyParsed(found, 'parsed');
    setScanOpen(false);
    setScanErr('');
    setGmailNote(foundSummary(found));
  };

  const addSuggestion = async (s: GmailSuggestion) => {
    const extrasNext = extrasFromSuggestion(s);
    if (!extrasNext) return;
    applyParsed(extrasNext, 'gmail');
    await clearGmailSuggestion(flightKey, s.id);
    setSuggestions(prev => prev.filter(x => x.id !== s.id));
    onSave(mergeTripExtras({ hotel, carRental: car, transfer }, extrasNext, 'gmail'));
    haptics.success();
  };

  const foundSummary = (p: Partial<TripExtras>) => {
    const bits: string[] = [];
    if (p.hotel?.name || p.hotel?.address) bits.push(p.hotel.name || p.hotel.address || '');
    if (p.carRental?.company || p.carRental?.pickupLocation) {
      bits.push(p.carRental.company || p.carRental.pickupLocation || '');
    }
    if (p.transfer?.provider || p.transfer?.driverName) {
      bits.push(p.transfer.provider || p.transfer.driverName || '');
    }
    return bits.filter(Boolean).join(' · ');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={st.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={st.sheet}>
          <View style={st.handle} />
          <View style={st.head}>
            <View style={{ flex: 1 }}>
              <Text style={st.title}>{copy.tripExtrasTitle}</Text>
              {/* Fix: double title — the subtitle repeated "Hotel & transfer"; it now says what the open tab adds. */}
              <Text style={st.sub}>
                {tab === 'hotel' ? copy.tripExtrasSubHotel : tab === 'car' ? copy.tripExtrasSubCar : copy.tripExtrasSubTransfer}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.close} accessibilityLabel={copy.importClose}>
              <X size={16} color={p.accent} weight="bold" />
            </TouchableOpacity>
          </View>

          <ScrollView style={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TripExtrasBubbleRow
              gmailBusy={gmailBusy}
              gmailLabel={copy.tripExtrasBubbleGmail}
              pasteLabel={copy.tripExtrasBubblePaste}
              scanLabel={copy.tripExtrasBubbleScan}
              onGmail={() => { void scanGmail(); }}
              onPaste={() => { setPasteOpen(true); setParsed(null); setGmailNote(''); }}
              onScan={() => { void openScan(); }}
            />
            <View style={st.divider}>
              <View style={st.dividerLine} />
              <Text style={st.dividerTxt}>{copy.tripExtrasFillManually}</Text>
              <View style={st.dividerLine} />
            </View>

            <View style={st.tabs}>
              {([
                { id: 'hotel' as const, label: copy.tripExtrasHotel },
                { id: 'car' as const, label: copy.tripExtrasCar },
                { id: 'transfer' as const, label: copy.tripExtrasTransfer },
              ]).map(item => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => { haptics.light(); setTab(item.id); }}
                  style={[st.tab, tab === item.id && st.tabOn]}
                >
                  <Text style={[st.tabTxt, tab === item.id && st.tabTxtOn]}>{item.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Gmail integration: "Geïmporteerd uit Gmail" when the open tab was filled from Gmail. */}
            {(tab === 'hotel' ? hotel.source : tab === 'car' ? car.source : transfer.source) === 'gmail' ? (
              <Text style={st.gmailLabel}>{copy.importedFromGmail}</Text>
            ) : null}

            {suggestions.map(s => (
              <View key={s.id} style={st.suggest}>
                <Text style={st.suggestTxt}>
                  {s.kind === 'hotel' ? copy.tripExtrasGmailFoundHotel
                    : s.kind === 'carRental' ? copy.tripExtrasGmailFoundCar
                      : copy.tripExtrasGmailFoundTransfer}
                </Text>
                {s.snippet ? <Text style={st.suggestSub} numberOfLines={2}>{s.snippet}</Text> : null}
                <View style={st.suggestRow}>
                  <TouchableOpacity style={st.suggestCta} onPress={() => { void addSuggestion(s); }}>
                    <Text style={st.suggestCtaTxt}>{copy.tripExtrasGmailAdd}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { void clearGmailSuggestion(flightKey, s.id); setSuggestions(prev => prev.filter(x => x.id !== s.id)); }}>
                    <Text style={st.skip}>{copy.tripExtrasGmailSkip}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {tab === 'hotel' ? (
              <>
                {/* Hotel autocomplete: Google Places suggestions; picking one fills name + address. */}
                <HotelNameAutocomplete
                  label={copy.tripExtrasHotelName}
                  value={hotel.name || ''}
                  onChange={v => setHotel(prev => ({ ...prev, name: v, source: prev.source || 'manual' }))}
                  onPick={place => setHotel(prev => ({ ...prev, name: place.name, address: place.address || prev.address }))}
                  iata={airportLabel}
                />
                <Field label={copy.tripExtrasAddress} value={hotel.address || ''} onChange={v => setHotel({ ...hotel, address: v })} multiline />
                {/* Fix: date picker — native picker, shown as DD/MM/YYYY. */}
                <TripDateField mode="date" label={copy.tripExtrasCheckIn} value={hotel.checkIn} fallback={arrivalDate} onChange={v => setHotel(prev => ({ ...prev, checkIn: v }))} />
                {arrivalDate ? (
                  <TouchableOpacity onPress={() => setHotel({ ...hotel, checkIn: arrivalDate })}>
                    <Text style={st.chip}>{copy.tripExtrasUseArrival}</Text>
                  </TouchableOpacity>
                ) : null}
                <TripDateField mode="date" label={copy.tripExtrasCheckOut} error={checkOutError} value={hotel.checkOut} fallback={dayAfter(hotel.checkIn || arrivalDate)} onChange={v => setHotel(prev => ({ ...prev, checkOut: v }))} />
                <Field label={copy.tripExtrasConfRef} value={hotel.confirmationRef || ''} onChange={v => setHotel({ ...hotel, confirmationRef: v })} />
              </>
            ) : null}

            {tab === 'car' ? (
              <>
                {/* Car rental logos: rental company cards, "Boek nu" opens the company site in the browser. */}
                <CarRentalLogoRow company={car.company} />
                <Field label={copy.tripExtrasCompany} value={car.company || ''} onChange={v => setCar({ ...car, company: v, source: car.source || 'manual' })} />
                <Field label={copy.tripExtrasPickupLoc} value={car.pickupLocation || ''} onChange={v => setCar({ ...car, pickupLocation: v })} />
                {/* Fix: date picker — native date + time picker, shown as DD/MM/YYYY · HH:mm. */}
                <TripDateField mode="datetime" label={copy.tripExtrasPickupTime} value={car.pickupTime} fallback={arrivalIso} onChange={v => setCar(prev => ({ ...prev, pickupTime: v }))} />
                <Field label={copy.tripExtrasDropoffLoc} value={car.dropoffLocation || ''} onChange={v => setCar({ ...car, dropoffLocation: v })} />
                <TripDateField mode="datetime" label={copy.tripExtrasDropoffTime} error={dropoffError} value={car.dropoffTime} fallback={dayAfter(car.pickupTime || arrivalIso, 'datetime')} onChange={v => setCar(prev => ({ ...prev, dropoffTime: v }))} />
                <Field label={copy.tripExtrasConfRef} value={car.confirmationRef || ''} onChange={v => setCar({ ...car, confirmationRef: v })} />
              </>
            ) : null}

            {tab === 'transfer' ? (
              <>
                <Field label={copy.tripExtrasProvider} value={transfer.provider || ''} onChange={v => setTransfer({ ...transfer, provider: v, source: transfer.source || 'manual' })} />
                <Field label={copy.tripExtrasPickupLoc} value={transfer.pickupLocation || ''} onChange={v => setTransfer({ ...transfer, pickupLocation: v })} />
                <Field label={copy.tripExtrasDropoffLoc} value={transfer.dropoffLocation || ''} onChange={v => setTransfer({ ...transfer, dropoffLocation: v })} />
                {/* Fix: date picker — native date + time picker, shown as DD/MM/YYYY · HH:mm. */}
                <TripDateField mode="datetime" label={copy.tripExtrasPickupTime} value={transfer.pickupTime} fallback={arrivalIso} onChange={v => setTransfer(prev => ({ ...prev, pickupTime: v }))} />
                <Field label={copy.tripExtrasDriver} value={transfer.driverName || ''} onChange={v => setTransfer({ ...transfer, driverName: v })} />
                <View style={st.phoneRow}>
                  <View style={{ flex: 1 }}>
                    <Field label={copy.tripExtrasDriverPhone} value={transfer.driverPhone || ''} onChange={v => setTransfer({ ...transfer, driverPhone: v })} keyboardType="phone-pad" />
                  </View>
                  {transfer.driverPhone ? (
                    <TouchableOpacity style={st.call} onPress={() => { void callPhone(transfer.driverPhone); }}>
                      <Text style={st.callTxt}>{copy.tripExtrasCallDriver}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
                <Field label={copy.tripExtrasVehicle} value={transfer.vehicleDescription || ''} onChange={v => setTransfer({ ...transfer, vehicleDescription: v })} />
                <Field label={copy.tripExtrasConfRef} value={transfer.confirmationRef || ''} onChange={v => setTransfer({ ...transfer, confirmationRef: v })} />
              </>
            ) : null}

            {gmailNote ? <Text style={st.note}>{gmailNote}</Text> : null}
            {!gmailScanConfigured() ? (
              <Text style={st.note}>{copy.tripExtrasGmailNotConfigured}</Text>
            ) : null}
          </ScrollView>

          <TouchableOpacity style={st.save} onPress={save} accessibilityRole="button">
            <Text style={st.saveTxt}>{copy.tripExtrasSave}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={pasteOpen} animationType="fade" transparent onRequestClose={() => setPasteOpen(false)}>
        <KeyboardAvoidingView style={st.pasteBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={st.pasteSheet}>
            <Text style={st.title}>{copy.tripExtrasPasteTitle}</Text>
            <Text style={st.sub}>{copy.tripExtrasPasteHint}</Text>
            <TextInput
              style={st.pasteBox}
              value={paste}
              onChangeText={setPaste}
              multiline
              textAlignVertical="top"
              placeholder={copy.tripExtrasPasteHint}
              placeholderTextColor={p.muted}
            />
            {parsed ? (
              <View style={st.preview}>
                <Text style={st.suggestTxt}>{copy.tripExtrasParsed}</Text>
                <Text style={st.suggestSub}>{foundSummary(parsed)}</Text>
                <TouchableOpacity
                  style={st.suggestCta}
                  onPress={() => {
                    applyParsed(parsed, 'parsed');
                    setPasteOpen(false);
                    setParsed(null);
                    setPaste('');
                  }}
                >
                  <Text style={st.suggestCtaTxt}>{copy.tripExtrasApplyParse}</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <TouchableOpacity style={st.save} onPress={runPaste}>
              <Text style={st.saveTxt}>{copy.tripExtrasParse}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setPasteOpen(false)}>
              <Text style={st.cancel}>{copy.cancel}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={scanOpen} animationType="slide" onRequestClose={() => setScanOpen(false)}>
        <View style={st.scanRoot}>
          <View style={st.scanHead}>
            <Text style={st.title}>{copy.tripExtrasScanTitle}</Text>
            <TouchableOpacity
              onPress={() => setScanOpen(false)}
              style={st.close}
              accessibilityLabel={copy.importClose}
            >
              <X size={16} color={p.accent} weight="bold" />
            </TouchableOpacity>
          </View>
          <View style={st.camArea}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['pdf417', 'qr', 'aztec', 'datamatrix', 'code128'],
              }}
              onBarcodeScanned={scanLocked ? undefined : onQrScanned}
            />
            <View style={st.scanFrame} pointerEvents="none" />
            <View style={st.scanBottom}>
              <Text style={st.scanHint}>{copy.tripExtrasScanHint}</Text>
              {scanErr ? <Text style={st.scanErr}>{scanErr}</Text> : null}
              <TouchableOpacity onPress={() => setScanOpen(false)}>
                <Text style={st.cancel}>{copy.cancel}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
}

function makeStyles(p: TripExtrasPalette) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: p.scrim, justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: p.surface,
      borderTopLeftRadius: 22,
      borderTopRightRadius: 22,
      paddingHorizontal: 18,
      paddingTop: 10,
      paddingBottom: Platform.OS === 'ios' ? 28 : 16,
      maxHeight: '92%',
      borderWidth: 1,
      borderColor: p.line,
    },
    handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: p.line, marginBottom: 12 },
    head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    title: { color: p.text, fontSize: 18, fontWeight: '800' },
    sub: { color: p.muted, fontSize: 12, marginTop: 4, fontWeight: '600' },
    close: { width: 32, height: 32, borderRadius: 16, backgroundColor: p.field, alignItems: 'center', justifyContent: 'center' },
    divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
    dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: p.line },
    dividerTxt: { color: p.muted, fontSize: 11, fontWeight: '700' },
    tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    tab: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: p.field },
    tabOn: { backgroundColor: p.accent },
    tabTxt: { color: p.muted, fontSize: 12, fontWeight: '800' },
    tabTxtOn: { color: p.onAccent },
    scroll: { maxHeight: 520 },
    field: { marginBottom: 10 },
    label: { color: p.muted, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
    input: {
      backgroundColor: p.field,
      borderWidth: 1,
      borderColor: p.line,
      borderRadius: 12,
      color: p.text,
      fontSize: 15,
      fontWeight: '600',
      paddingHorizontal: 12,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    },
    inputMulti: { minHeight: 72, textAlignVertical: 'top' },
    gmailLabel: {
      alignSelf: 'flex-start',
      color: p.accent,
      fontSize: 11,
      fontWeight: '800',
      borderWidth: 1,
      borderColor: p.line,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginBottom: 10,
      overflow: 'hidden',
    },
    chip: { color: p.accent, fontSize: 12, fontWeight: '700', marginBottom: 10 },
    phoneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    call: { marginBottom: 10, backgroundColor: p.accent, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12 },
    callTxt: { color: p.onAccent, fontSize: 11, fontWeight: '800' },
    note: { color: p.muted, fontSize: 12, marginTop: 6, lineHeight: 17 },
    scanRoot: { flex: 1, backgroundColor: '#05070C' },
    scanHead: {
      paddingTop: Platform.OS === 'ios' ? 56 : 24,
      paddingHorizontal: 16,
      paddingBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#05070C',
    },
    camArea: { flex: 1 },
    scanFrame: {
      position: 'absolute',
      left: '12%',
      right: '12%',
      top: '18%',
      height: '42%',
      borderRadius: 16,
      borderWidth: 2,
      borderColor: p.accent,
    },
    scanBottom: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal: 20,
      paddingBottom: Platform.OS === 'ios' ? 36 : 20,
      paddingTop: 16,
      backgroundColor: 'rgba(5,7,12,0.72)',
      alignItems: 'center',
    },
    scanHint: { color: '#FFFFFF', fontSize: 13, fontWeight: '600', textAlign: 'center' },
    scanErr: { color: '#E07A7A', fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
    save: { backgroundColor: p.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
    saveTxt: { color: p.onAccent, fontSize: 15, fontWeight: '800' },
    suggest: { backgroundColor: p.field, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: p.line },
    suggestTxt: { color: p.text, fontSize: 13, fontWeight: '700' },
    suggestSub: { color: p.muted, fontSize: 12, marginTop: 4 },
    suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
    suggestCta: { backgroundColor: p.accent, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
    suggestCtaTxt: { color: p.onAccent, fontSize: 12, fontWeight: '800' },
    skip: { color: p.muted, fontSize: 12, fontWeight: '700' },
    pasteBackdrop: { flex: 1, backgroundColor: p.scrim, justifyContent: 'flex-end' },
    pasteSheet: { backgroundColor: p.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: Platform.OS === 'ios' ? 28 : 16 },
    pasteBox: { backgroundColor: p.field, borderRadius: 12, minHeight: 140, color: p.text, padding: 12, marginTop: 12, marginBottom: 12 },
    preview: { backgroundColor: p.field, borderRadius: 12, padding: 12, marginBottom: 10 },
    cancel: { color: p.muted, textAlign: 'center', fontWeight: '700', marginTop: 12 },
  });
}
