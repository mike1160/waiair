import { useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { X } from 'phosphor-react-native';
import { getCountryInfo } from './CountryInfoCard';
import { haptics } from './lib/haptics';
import {
  defaultPassportCode,
  passportFlag,
  visaCheckResult,
  visaScreenPassports,
  type VisaCheckKind,
} from './lib/visaByPassport';

const BG = '#0D1B2E';
const GOLD = '#C9A84C';
const MUTED = '#8892A4';
const CARD = 'rgba(255,255,255,0.06)';

const RESULT_TINT: Record<VisaCheckKind, { border: string; bg: string }> = {
  free: { border: 'rgba(34,197,94,0.45)', bg: 'rgba(34,197,94,0.10)' },
  evisa: { border: 'rgba(245,158,11,0.45)', bg: 'rgba(245,158,11,0.10)' },
  eta: { border: 'rgba(245,158,11,0.45)', bg: 'rgba(245,158,11,0.10)' },
  required: { border: 'rgba(239,68,68,0.45)', bg: 'rgba(239,68,68,0.10)' },
};

export default function VisaCheckScreen({
  visible,
  onClose,
  destCountry,
  destName,
}: {
  visible: boolean;
  onClose: () => void;
  destCountry?: string;
  destName?: string;
}) {
  const info = getCountryInfo(destCountry);
  const destCode = String(info?.code || destCountry || '').toUpperCase();
  const destLabel = destName || info?.name || destCode || 'Destination';
  const destFlag = info?.flag || '🌍';
  const generic = info?.visa || 'Check visa requirements before you travel.';

  const [passport, setPassport] = useState(defaultPassportCode);
  const options = useMemo(() => visaScreenPassports(), []);

  useEffect(() => {
    if (!visible) return;
    setPassport(defaultPassportCode());
  }, [visible, destCode]);

  const result = useMemo(
    () => visaCheckResult(destCode, passport, generic),
    [destCode, passport, generic],
  );
  const tint = RESULT_TINT[result.kind];

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
          <Text style={st.headerTitle}>🛂 Visa Check</Text>
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

        <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
          <View style={st.destCard}>
            <Text style={st.destFlag}>{destFlag}</Text>
            <View style={st.destText}>
              <Text style={st.destLabel}>Traveling to</Text>
              <Text style={st.destName}>{destLabel}</Text>
              {destCode ? <Text style={st.destCode}>{destCode}</Text> : null}
            </View>
          </View>

          <Text style={st.sectionLabel}>Your passport</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={st.passportRow}
          >
            {options.map(opt => {
              const active = opt.code === passport;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => { haptics.light(); setPassport(opt.code); }}
                  style={[
                    st.passportChip,
                    active && st.passportChipActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.code} passport`}
                >
                  <Text style={st.passportFlag}>{opt.flag}</Text>
                  <Text style={[st.passportCode, active && st.passportCodeActive]}>{opt.code}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[st.resultCard, { borderColor: tint.border, backgroundColor: tint.bg }]}>
            <Text style={st.resultHeadline}>{result.headline}</Text>
            <Text style={st.resultFrom}>
              {passportFlag(passport)} {passport} → {destFlag} {destCode || destLabel}
            </Text>
            <Text style={st.resultDetail}>{result.detail}</Text>
          </View>

          <Text style={st.disclaimer}>
            Rules change — always confirm on the official site before you fly.
          </Text>
        </ScrollView>

        <View style={st.footer}>
          <Pressable
            style={st.officialBtn}
            onPress={() => {
              haptics.light();
              void Linking.openURL(result.officialUrl);
            }}
            accessibilityRole="link"
            accessibilityLabel={result.officialLabel}
          >
            <Text style={st.officialBtnTxt}>{result.officialLabel}</Text>
          </Pressable>
        </View>
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
  headerTitle: { color: '#F8FAFC', fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
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
  body: { padding: 20, paddingBottom: 28 },
  destCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.25)',
    marginBottom: 22,
  },
  destFlag: { fontSize: 36 },
  destText: { flex: 1, minWidth: 0 },
  destLabel: { color: MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  destName: { color: '#F8FAFC', fontSize: 20, fontWeight: '800', marginTop: 2 },
  destCode: { color: GOLD, fontSize: 12, fontWeight: '700', marginTop: 4 },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  passportRow: { gap: 8, paddingBottom: 20 },
  passportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.2)',
  },
  passportChipActive: {
    borderColor: GOLD,
    backgroundColor: 'rgba(201,168,76,0.14)',
  },
  passportFlag: { fontSize: 18 },
  passportCode: { color: '#CBD5E1', fontSize: 12, fontWeight: '800' },
  passportCodeActive: { color: GOLD },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  resultHeadline: { color: '#F8FAFC', fontSize: 17, fontWeight: '800', lineHeight: 22 },
  resultFrom: { color: MUTED, fontSize: 12, fontWeight: '600', marginTop: 8 },
  resultDetail: { color: '#CBD5E1', fontSize: 14, fontWeight: '500', lineHeight: 20, marginTop: 12 },
  disclaimer: { color: MUTED, fontSize: 11, fontWeight: '500', lineHeight: 16, textAlign: 'center' },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(201,168,76,0.2)',
  },
  officialBtn: {
    backgroundColor: 'rgba(201,168,76,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.45)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  officialBtnTxt: { color: GOLD, fontSize: 14, fontWeight: '800', textAlign: 'center' },
});
