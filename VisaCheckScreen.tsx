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
import { t } from './lib/i18n';
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

type VisaTheme = { bg: string; card: string; text: string; secondary: string; muted: string; border: string; isDark: boolean };

type Palette = { bg: string; card: string; text: string; body: string; muted: string; line: string; chipTxt: string };

/** The original navy screen — kept for dark mode and for any caller that passes no theme. */
const NAVY: Palette = {
  bg: BG,
  card: CARD,
  text: '#F8FAFC',
  body: '#CBD5E1',
  muted: MUTED,
  line: 'rgba(201,168,76,0.25)',
  chipTxt: '#CBD5E1',
};

/**
 * Light mode follows the app theme — cream/white cards and dark text, like the rest of the app — instead of a
 * navy block. Dark mode keeps the navy screen, so dark mode support is unchanged.
 */
function paletteFor(theme?: VisaTheme): Palette {
  if (!theme || theme.isDark) return NAVY;
  return {
    bg: theme.bg,
    card: theme.card,
    text: theme.text,
    body: theme.secondary,
    muted: theme.muted,
    line: theme.border,
    chipTxt: theme.secondary,
  };
}

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
  theme,
}: {
  visible: boolean;
  onClose: () => void;
  destCountry?: string;
  destName?: string;
  theme?: VisaTheme;
}) {
  const P = paletteFor(theme);
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
      <View style={[st.screen, { backgroundColor: P.bg }]}>
        <View style={[st.header, { borderBottomColor: P.line }]}>
          <Text style={[st.headerTitle, { color: P.text }]}>🛂 Visa Check</Text>
          <TouchableOpacity
            onPress={close}
            hitSlop={10}
            style={[st.closeBtn, { backgroundColor: P.card, borderColor: P.line }]}
            accessibilityRole="button"
            accessibilityLabel={t().close}
          >
            <X size={18} color={P.text} weight="bold" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={st.body} showsVerticalScrollIndicator={false}>
          <View style={[st.destCard, { backgroundColor: P.card, borderColor: P.line }]}>
            <Text style={st.destFlag}>{destFlag}</Text>
            <View style={st.destText}>
              <Text style={[st.destLabel, { color: P.muted }]}>{t().travelingTo}</Text>
              <Text style={[st.destName, { color: P.text }]}>{destLabel}</Text>
              {destCode ? <Text style={st.destCode}>{destCode}</Text> : null}
            </View>
          </View>

          <Text style={[st.sectionLabel, { color: P.muted }]}>{t().yourPassport}</Text>
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
                    { backgroundColor: P.card, borderColor: P.line },
                    active && st.passportChipActive,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={`${opt.code} passport`}
                >
                  <Text style={st.passportFlag}>{opt.flag}</Text>
                  <Text style={[st.passportCode, { color: P.chipTxt }, active && st.passportCodeActive]}>{opt.code}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[st.resultCard, { borderColor: tint.border, backgroundColor: tint.bg }]}>
            <Text style={[st.resultHeadline, { color: P.text }]}>{result.headline}</Text>
            <Text style={[st.resultFrom, { color: P.muted }]}>
              {passportFlag(passport)} {passport} → {destFlag} {destCode || destLabel}
            </Text>
            <Text style={[st.resultDetail, { color: P.body }]}>{result.detail}</Text>
          </View>

          <Text style={[st.disclaimer, { color: P.muted }]}>
            Rules change — always confirm on the official site before you fly.
          </Text>
        </ScrollView>

        <View style={[st.footer, { borderTopColor: P.line }]}>
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
