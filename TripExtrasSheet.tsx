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
  enableGmailScanTrial,
  extrasFromSuggestion,
  getCachedGmailSuggestions,
  getGmailScanAccess,
  gmailScanConfigured,
  isGmailConnected,
  type GmailScanAccess,
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
import TripExtrasBubbleRow from './TripExtrasBubbleRow';

const NAVY = '#0D1B2E';
const GOLD = '#C9A84C';
const FIELD = '#12233C';
const CREAM = '#F5F0E8';
const MUTED = '#8896B0';

type Tab = 'hotel' | 'car' | 'transfer';

type Props = {
  visible: boolean;
  onClose: () => void;
  extras?: TripExtras | null;
  arrivalDate?: string;
  airportLabel?: string;
  flightKey: string;
  arrivalIso?: string;
  isPro: boolean;
  onRequirePro: (highlight?: string) => void;
  onSave: (extras: TripExtras | undefined) => void;
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
  return (
    <View style={st.field}>
      <Text style={st.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="rgba(245,240,232,0.35)"
        style={[st.input, multiline && st.inputMulti]}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCorrect={false}
      />
    </View>
  );
}

export default function TripExtrasSheet({
  visible,
  onClose,
  extras,
  arrivalDate,
  airportLabel,
  flightKey,
  arrivalIso,
  isPro,
  onRequirePro,
  onSave,
}: Props) {
  const copy = t();
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
  const [gmailAccess, setGmailAccess] = useState<GmailScanAccess | null>(null);
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
    setTab('hotel');
    setPaste('');
    setParsed(null);
    setGmailNote('');
    setScanOpen(false);
    setScanErr('');
    setScanLocked(false);
    scanLock.current = false;
    getGmailScanAccess(isPro).then(setGmailAccess).catch(() => {});
    if (flightKey) {
      getCachedGmailSuggestions(flightKey).then(setSuggestions).catch(() => {});
    }
  }, [visible, extras, arrivalDate, airportLabel, flightKey, isPro]);

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

  const save = () => {
    onSave(draft);
    haptics.success();
    onClose();
  };

  const scanGmail = async () => {
    let access = gmailAccess || await getGmailScanAccess(isPro);
    if (!access.allowed && !access.trialExpired) {
      access = await enableGmailScanTrial(isPro);
    }
    setGmailAccess(access);
    if (!access.allowed) {
      onRequirePro(copy.tripExtrasGmailPro);
      return;
    }
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
      const list = await backgroundScanGmailTripExtras({
        flightKey,
        arrivalIso,
        isPro: isPro || access.allowed,
      });
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
              <Text style={st.sub}>{copy.hotelAndTransfer}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={st.close} accessibilityLabel={copy.importClose}>
              <X size={16} color={GOLD} weight="bold" />
            </TouchableOpacity>
          </View>

          <ScrollView style={st.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <TripExtrasBubbleRow
              gmailBusy={gmailBusy}
              showGmailTrial={!isPro}
              trialLabel={copy.tripExtrasSevenDayFree}
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
                <Field label={copy.tripExtrasHotelName} value={hotel.name || ''} onChange={v => setHotel({ ...hotel, name: v, source: hotel.source || 'manual' })} />
                <Field label={copy.tripExtrasAddress} value={hotel.address || ''} onChange={v => setHotel({ ...hotel, address: v })} multiline />
                <Field label={copy.tripExtrasCheckIn} value={hotel.checkIn || ''} onChange={v => setHotel({ ...hotel, checkIn: v })} placeholder="YYYY-MM-DD" />
                {arrivalDate ? (
                  <TouchableOpacity onPress={() => setHotel({ ...hotel, checkIn: arrivalDate })}>
                    <Text style={st.chip}>{copy.tripExtrasUseArrival}</Text>
                  </TouchableOpacity>
                ) : null}
                <Field label={copy.tripExtrasCheckOut} value={hotel.checkOut || ''} onChange={v => setHotel({ ...hotel, checkOut: v })} placeholder="YYYY-MM-DD" />
                <Field label={copy.tripExtrasConfRef} value={hotel.confirmationRef || ''} onChange={v => setHotel({ ...hotel, confirmationRef: v })} />
              </>
            ) : null}

            {tab === 'car' ? (
              <>
                <Field label={copy.tripExtrasCompany} value={car.company || ''} onChange={v => setCar({ ...car, company: v, source: car.source || 'manual' })} />
                <Field label={copy.tripExtrasPickupLoc} value={car.pickupLocation || ''} onChange={v => setCar({ ...car, pickupLocation: v })} />
                <Field label={copy.tripExtrasPickupTime} value={car.pickupTime || ''} onChange={v => setCar({ ...car, pickupTime: v })} placeholder="YYYY-MM-DDTHH:mm" />
                <Field label={copy.tripExtrasDropoffLoc} value={car.dropoffLocation || ''} onChange={v => setCar({ ...car, dropoffLocation: v })} />
                <Field label={copy.tripExtrasDropoffTime} value={car.dropoffTime || ''} onChange={v => setCar({ ...car, dropoffTime: v })} placeholder="YYYY-MM-DDTHH:mm" />
                <Field label={copy.tripExtrasConfRef} value={car.confirmationRef || ''} onChange={v => setCar({ ...car, confirmationRef: v })} />
              </>
            ) : null}

            {tab === 'transfer' ? (
              <>
                <Field label={copy.tripExtrasProvider} value={transfer.provider || ''} onChange={v => setTransfer({ ...transfer, provider: v, source: transfer.source || 'manual' })} />
                <Field label={copy.tripExtrasPickupLoc} value={transfer.pickupLocation || ''} onChange={v => setTransfer({ ...transfer, pickupLocation: v })} />
                <Field label={copy.tripExtrasDropoffLoc} value={transfer.dropoffLocation || ''} onChange={v => setTransfer({ ...transfer, dropoffLocation: v })} />
                <Field label={copy.tripExtrasPickupTime} value={transfer.pickupTime || ''} onChange={v => setTransfer({ ...transfer, pickupTime: v })} placeholder="YYYY-MM-DDTHH:mm" />
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
            {(gmailAccess?.allowed || isPro) && !gmailScanConfigured() ? (
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
              placeholderTextColor="rgba(245,240,232,0.35)"
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
              <X size={16} color={GOLD} weight="bold" />
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

const st = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(5,8,16,0.72)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: NAVY,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
    maxHeight: '92%',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(201,168,76,0.45)', marginBottom: 12 },
  head: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  title: { color: CREAM, fontSize: 18, fontWeight: '800' },
  sub: { color: MUTED, fontSize: 12, marginTop: 4, fontWeight: '600' },
  close: { width: 32, height: 32, borderRadius: 16, backgroundColor: FIELD, alignItems: 'center', justifyContent: 'center' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(136,150,176,0.45)' },
  dividerTxt: { color: MUTED, fontSize: 11, fontWeight: '700' },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  tab: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center', backgroundColor: FIELD },
  tabOn: { backgroundColor: GOLD },
  tabTxt: { color: MUTED, fontSize: 12, fontWeight: '800' },
  tabTxtOn: { color: NAVY },
  scroll: { maxHeight: 520 },
  field: { marginBottom: 10 },
  label: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginBottom: 6 },
  input: {
    backgroundColor: FIELD,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    borderRadius: 12,
    color: CREAM,
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
  },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  chip: { color: GOLD, fontSize: 12, fontWeight: '700', marginBottom: 10 },
  phoneRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  call: { marginBottom: 10, backgroundColor: GOLD, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12 },
  callTxt: { color: NAVY, fontSize: 11, fontWeight: '800' },
  note: { color: MUTED, fontSize: 12, marginTop: 6, lineHeight: 17 },
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
    borderColor: GOLD,
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
  scanHint: { color: CREAM, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  scanErr: { color: '#E07A7A', fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  save: { backgroundColor: GOLD, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  saveTxt: { color: NAVY, fontSize: 15, fontWeight: '800' },
  suggest: { backgroundColor: FIELD, borderRadius: 12, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(201,168,76,0.35)' },
  suggestTxt: { color: CREAM, fontSize: 13, fontWeight: '700' },
  suggestSub: { color: MUTED, fontSize: 12, marginTop: 4 },
  suggestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
  suggestCta: { backgroundColor: GOLD, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  suggestCtaTxt: { color: NAVY, fontSize: 12, fontWeight: '800' },
  skip: { color: MUTED, fontSize: 12, fontWeight: '700' },
  pasteBackdrop: { flex: 1, backgroundColor: 'rgba(5,8,16,0.8)', justifyContent: 'flex-end' },
  pasteSheet: { backgroundColor: NAVY, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 18, paddingBottom: Platform.OS === 'ios' ? 28 : 16 },
  pasteBox: { backgroundColor: FIELD, borderRadius: 12, minHeight: 140, color: CREAM, padding: 12, marginTop: 12, marginBottom: 12 },
  preview: { backgroundColor: FIELD, borderRadius: 12, padding: 12, marginBottom: 10 },
  cancel: { color: MUTED, textAlign: 'center', fontWeight: '700', marginTop: 12 },
});
