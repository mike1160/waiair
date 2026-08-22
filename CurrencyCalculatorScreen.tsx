import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'phosphor-react-native';
import {
  currencyForAirport,
  fetchEurFxRates,
  fxConvert,
} from './lib/destinationServices';
import { haptics } from './lib/haptics';

const BG = '#0F1728';
const GOLD = '#C9A84C';
const MUTED = '#8892A4';
const CARD = 'rgba(255,255,255,0.06)';

const SOURCE_CODES = ['EUR', 'USD', 'GBP', 'SGD', 'THB', 'MYR', 'IDR'] as const;
const RESULT_CODES = ['THB', 'MYR', 'IDR', 'VND', 'PHP', 'SGD', 'USD', 'EUR'] as const;

const CURRENCY_FLAGS: Record<string, string> = {
  EUR: '🇪🇺',
  USD: '🇺🇸',
  GBP: '🇬🇧',
  SGD: '🇸🇬',
  THB: '🇹🇭',
  MYR: '🇲🇾',
  IDR: '🇮🇩',
  VND: '🇻🇳',
  PHP: '🇵🇭',
};

function formatConverted(amount: number): string {
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function defaultSource(originIata?: string, originCountry?: string): string {
  const local = currencyForAirport(originIata, originCountry);
  if (local && (SOURCE_CODES as readonly string[]).includes(local)) return local;
  return 'EUR';
}

export default function CurrencyCalculatorScreen({
  visible,
  onClose,
  originIata,
  originCountry,
}: {
  visible: boolean;
  onClose: () => void;
  originIata?: string;
  originCountry?: string;
}) {
  const [amount, setAmount] = useState('100');
  const [source, setSource] = useState('EUR');
  const [rates, setRates] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setAmount('100');
    setSource(defaultSource(originIata, originCountry));
    let cancelled = false;
    setBusy(true);
    fetchEurFxRates()
      .then((row) => { if (!cancelled) setRates(row); })
      .finally(() => { if (!cancelled) setBusy(false); });
    return () => { cancelled = true; };
  }, [visible, originIata, originCountry]);

  const amountNum = Number.parseFloat(amount.replace(',', '.'));
  const hasAmount = Number.isFinite(amountNum) && amountNum >= 0;

  const rows = useMemo(() => {
    if (!rates || !hasAmount) return [];
    return RESULT_CODES.map(code => ({
      code,
      flag: CURRENCY_FLAGS[code] || '💱',
      value: fxConvert(rates, amountNum, source, code),
    }));
  }, [rates, hasAmount, amountNum, source]);

  const close = () => { haptics.light(); onClose(); };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={close}
    >
      <View style={st.screen}>
        <View style={st.header}>
          <Text style={st.headerTitle}>💱 Currency</Text>
          <TouchableOpacity
            onPress={close}
            hitSlop={10}
            style={st.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={18} color="#F8FAFC" weight="bold" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
          <Text style={st.inputLabel}>Amount</Text>
          <TextInput
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            placeholder="100"
            placeholderTextColor={MUTED}
            style={st.amountInput}
            accessibilityLabel="Amount to convert"
          />

          <Text style={st.sectionLabel}>From</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.pillRow}
          >
            {SOURCE_CODES.map(code => {
              const active = code === source;
              return (
                <Pressable
                  key={code}
                  onPress={() => { haptics.light(); setSource(code); }}
                  style={[st.pill, active && st.pillActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[st.pillTxt, active && st.pillTxtActive]}>
                    {CURRENCY_FLAGS[code]} {code}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={st.sectionLabel}>Converted to</Text>
          {busy && !rates ? (
            <ActivityIndicator color={GOLD} style={{ marginTop: 24 }} />
          ) : null}
          {!busy && !rates ? (
            <Text style={st.error}>Could not load exchange rates.</Text>
          ) : null}
          {rows.map(row => (
            <View key={row.code} style={st.resultRow}>
              <View style={st.resultLeft}>
                <Text style={st.resultFlag}>{row.flag}</Text>
                <Text style={st.resultCode}>{row.code}</Text>
              </View>
              <Text style={st.resultAmount}>
                {row.value != null ? formatConverted(row.value) : '—'}
              </Text>
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(201,168,76,0.2)',
  },
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
  },
  body: { padding: 20, paddingBottom: 32 },
  inputLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  amountInput: {
    color: '#F8FAFC',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.35)',
    marginBottom: 22,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  pillRow: { gap: 8, paddingBottom: 20 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  pillActive: {
    borderColor: GOLD,
    backgroundColor: 'rgba(201,168,76,0.14)',
  },
  pillTxt: { color: '#CBD5E1', fontSize: 12, fontWeight: '700' },
  pillTxtActive: { color: GOLD },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.15)',
  },
  resultLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  resultFlag: { fontSize: 22 },
  resultCode: { color: MUTED, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  resultAmount: { color: '#F8FAFC', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  error: { color: MUTED, fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' },
});
