import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  Bank,
  Car,
  CaretDown,
  ChatTeardropText,
  Clock,
  CreditCard,
  FirstAid,
  Handshake,
  IdentificationCard,
  Plug,
  Taxi,
  ThermometerSimple,
  Translate,
} from 'phosphor-react-native';
import countryInfoData from './data/countryInfo.json';
import { t } from './lib/i18n';
import {
  defaultPassportCode,
  passportFlag,
  PASSPORT_OPTIONS,
  visaTextForPassport,
} from './lib/visaByPassport';

const VISA_PASSPORT_CODES = ['NL', 'DE', 'GB', 'US', 'AU', 'CN', 'JP', 'KR'] as const;
const VISA_PASSPORT_OPTIONS = PASSPORT_OPTIONS.filter(p =>
  (VISA_PASSPORT_CODES as readonly string[]).includes(p.code),
);

export type CountryPhrase = { local: string; en: string };

export type CountryInfoEntry = {
  code: string;
  name: string;
  flag: string;
  languages: string[];
  currency: { code: string; name: string };
  timezone: { utc: string; name: string };
  emergency: { police: string; ambulance: string; fire: string };
  visa: string;
  power: { plugs: string; voltage: string; frequency: string };
  traffic: 'left' | 'right';
  climate: string;
  phrases: CountryPhrase[];
  atmTip: string;
  transportTip: string;
  cultureTip: string;
};

const COUNTRY_INFO = countryInfoData as Record<string, CountryInfoEntry>;

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
  list: string;
};

export function getCountryInfo(country?: string): CountryInfoEntry | null {
  const key = String(country || '').trim().toUpperCase();
  if (key.length !== 2) return null;
  return COUNTRY_INFO[key] || null;
}

function localizeLanguage(name: string): string {
  const c = t();
  const map: Record<string, string> = {
    Thai: c.ciLangThai,
    English: c.ciLangEnglish,
    Mandarin: c.ciLangMandarin,
    Malay: c.ciLangMalay,
    Tamil: c.ciLangTamil,
    Indonesian: c.ciLangIndonesian,
    Vietnamese: c.ciLangVietnamese,
    Khmer: c.ciLangKhmer,
    Lao: c.ciLangLao,
    Burmese: c.ciLangBurmese,
    Japanese: c.ciLangJapanese,
    Korean: c.ciLangKorean,
    Filipino: c.ciLangFilipino,
    Hindi: c.ciLangHindi,
    Arabic: c.ciLangArabic,
    German: c.ciLangGerman,
    French: c.ciLangFrench,
    Spanish: c.ciLangSpanish,
    Italian: c.ciLangItalian,
    Portuguese: c.ciLangPortuguese,
    Greek: c.ciLangGreek,
    Dutch: c.ciLangDutch,
    Turkish: c.ciLangTurkish,
    Chinese: c.ciLangChinese,
    Cantonese: c.ciLangCantonese,
    Māori: c.ciLangMaori,
    Maori: c.ciLangMaori,
    'English widely spoken': c.ciLangEnglishSpoken,
  };
  return map[name] || name;
}

function localizeCurrency(code: string, fallback: string): string {
  const c = t();
  const map: Record<string, string> = {
    THB: c.ciCurThb, SGD: c.ciCurSgd, MYR: c.ciCurMyr, IDR: c.ciCurIdr, VND: c.ciCurVnd,
    PHP: c.ciCurPhp, KHR: c.ciCurKhr, LAK: c.ciCurLak, MMK: c.ciCurMmk, BND: c.ciCurBnd,
    JPY: c.ciCurJpy, KRW: c.ciCurKrw, CNY: c.ciCurCny, HKD: c.ciCurHkd, TWD: c.ciCurTwd,
    INR: c.ciCurInr, AED: c.ciCurAed, QAR: c.ciCurQar, SAR: c.ciCurSar, AUD: c.ciCurAud,
    NZD: c.ciCurNzd, GBP: c.ciCurGbp, EUR: c.ciCurEur, CHF: c.ciCurChf, USD: c.ciCurUsd,
    CAD: c.ciCurCad, TRY: c.ciCurTry,
  };
  return map[code] || fallback;
}

function localizeTimezone(name: string): string {
  const c = t();
  const map: Record<string, string> = {
    'Indochina Time': c.ciTzIct,
    'Singapore Time': c.ciTzSgt,
    'Malaysia Time': c.ciTzMyt,
    'WIB Jakarta +7 · Bali WITA +8': c.ciTzWib,
    'Philippine Time': c.ciTzPht,
    'Myanmar Time': c.ciTzMmt,
    'Brunei Time': c.ciTzBnt,
    'Japan Standard Time': c.ciTzJst,
    'Korea Standard Time': c.ciTzKst,
    'China Standard Time': c.ciTzCst,
    'Hong Kong Time': c.ciTzHkt,
    'Taiwan Time': c.ciTzTwt,
    'India Standard Time': c.ciTzIst,
    'Gulf Standard Time': c.ciTzGst,
    'Arabia Standard Time': c.ciTzAst,
    'AEST +10 (zones vary)': c.ciTzAest,
    'NZST (NZDT +13 in summer)': c.ciTzNzst,
    'GMT (BST +1 in summer)': c.ciTzGmt,
    'CET (CEST +2 in summer)': c.ciTzCet,
    'WET (WEST +1 in summer)': c.ciTzWet,
    'EET (EEST +3 in summer)': c.ciTzEet,
    'Zones vary (ET / CT / MT / PT)': c.ciTzUs,
    'Zones vary (ET / PT most common)': c.ciTzCa,
    'Turkey Time': c.ciTzTrt,
  };
  return map[name] || name;
}

function localizePhraseEn(en: string): string {
  const c = t();
  if (en === 'Hello') return c.ciPhraseHello;
  if (en === 'Thank you') return c.ciPhraseThankYou;
  if (en === 'Where is…?' || en === 'Where is...?') return c.ciPhraseWhereIs;
  if (en === 'How much?') return c.ciPhraseHowMuch;
  if (en === 'Hello / welcome') return c.ciPhraseWelcome;
  return en;
}

function TopicLine({
  icon,
  title,
  value,
  theme,
  expanded,
  onToggle,
  children,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  theme: ThemeBits;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.section, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Pressable onPress={onToggle} style={styles.topicRow} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={styles.sectionHead}>
          {icon}
          <Text style={[styles.sectionTitle, { color: theme.secondary }]}>{title}</Text>
        </View>
        <Text style={[styles.topicValue, { color: theme.text }]} numberOfLines={expanded ? 6 : 1}>{value}</Text>
      </Pressable>
      {expanded && children ? <View style={{ marginTop: 8 }}>{children}</View> : null}
    </View>
  );
}
function KV({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ThemeBits;
}) {
  return (
    <View style={styles.kv}>
      <Text style={[styles.kvLabel, { color: theme.muted }]}>{label}</Text>
      <Text style={[styles.bodyTxt, { color: theme.text, flex: 1, textAlign: 'right' }]}>{value}</Text>
    </View>
  );
}

export default function CountryInfoCard({
  country,
  theme,
}: {
  country?: string;
  theme: ThemeBits;
}) {
  const info = getCountryInfo(country);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [passport, setPassport] = useState(defaultPassportCode);
  const chevron = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setOpen(false);
    chevron.setValue(0);
  }, [info?.code, chevron]);

  useEffect(() => {
    Animated.timing(chevron, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, chevron]);

  if (!info) return null;

  const toggle = () => setOpen(v => !v);

  const rotate = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const drive = info.traffic === 'left' ? t().ciDriveLeft : t().ciDriveRight;
  const icon = { size: 16, color: theme.accent } as const;
  const langs = info.languages.map(localizeLanguage).join(' · ');
  const currencyLine = `${info.currency.code} · ${localizeCurrency(info.currency.code, info.currency.name)}`;
  const tzLine = `${info.timezone.utc} · ${localizeTimezone(info.timezone.name)}`;
  const toggleTopic = (id: string) => setTopic(cur => (cur === id ? null : id));

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${info.flag} ${info.code} travel info`}
        accessibilityHint={t().countryInfoA11yHint}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.flag}>{info.flag}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.code, { color: theme.accent }]}>{info.code}</Text>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {info.name}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {open ? t().hideDetails : t().tapForInfo}
          </Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <CaretDown size={18} color={theme.muted} />
          </Animated.View>
        </View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <TopicLine theme={theme} title={t().language} value={langs} expanded={topic==='lang'} onToggle={() => toggleTopic('lang')} icon={<Translate {...icon} />} />
          <TopicLine theme={theme} title={t().currency} value={currencyLine} expanded={topic==='cur'} onToggle={() => toggleTopic('cur')} icon={<CreditCard {...icon} />} />
          <TopicLine theme={theme} title={t().timezone} value={tzLine} expanded={topic==='tz'} onToggle={() => toggleTopic('tz')} icon={<Clock {...icon} />} />
          <TopicLine
            theme={theme}
            title={t().emergency}
            value={`${t().police} ${info.emergency.police}`}
            expanded={topic==='em'}
            onToggle={() => toggleTopic('em')}
            icon={<FirstAid {...icon} />}
          >
            <KV theme={theme} label={t().police} value={info.emergency.police} />
            <KV theme={theme} label={t().ambulance} value={info.emergency.ambulance} />
            <KV theme={theme} label={t().fire} value={info.emergency.fire} />
          </TopicLine>
          <TopicLine
            theme={theme}
            title={t().visa}
            value={visaTextForPassport(info.code, passport, info.visa)}
            expanded={topic==='visa'}
            onToggle={() => toggleTopic('visa')}
            icon={<IdentificationCard {...icon} />}
          >
            <Text style={[styles.passportHint, { color: theme.secondary }]}>
              {t().travelWithPassport(passportFlag(passport), passport)}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.passportRow}>
              {VISA_PASSPORT_OPTIONS.map(opt => {
                const active = opt.code === passport;
                return (
                  <Pressable
                    key={opt.code}
                    onPress={() => setPassport(opt.code)}
                    style={[styles.passportChip, { borderColor: active ? theme.accent : theme.border, backgroundColor: active ? `${theme.accent}22` : theme.list }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={t().travelWithPassport(opt.flag, opt.code)}
                  >
                    <Text style={styles.passportFlag}>{opt.flag}</Text>
                    <Text style={[styles.passportCode, { color: active ? theme.accent : theme.text }]}>{opt.code}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </TopicLine>
          <TopicLine theme={theme} title={t().power} value={`Type ${info.power.plugs} · ${info.power.voltage} · ${info.power.frequency}`} expanded={topic==='power'} onToggle={() => toggleTopic('power')} icon={<Plug {...icon} />} />
          <TopicLine theme={theme} title={t().traffic} value={drive} expanded={topic==='drive'} onToggle={() => toggleTopic('drive')} icon={<Car {...icon} />} />
          <TopicLine theme={theme} title={t().climate} value={info.climate} expanded={topic==='climate'} onToggle={() => toggleTopic('climate')} icon={<ThermometerSimple {...icon} />} />
          <TopicLine
            theme={theme}
            title={t().usefulPhrases}
            value={info.phrases.map(p => p.local).join(' · ')}
            expanded={topic==='phrases'}
            onToggle={() => toggleTopic('phrases')}
            icon={<ChatTeardropText {...icon} />}
          >
            {info.phrases.map(p => (
              <View key={`${p.en}-${p.local}`} style={styles.phrase}>
                <Text style={[styles.phraseLocal, { color: theme.text }]}>{p.local}</Text>
                <Text style={[styles.phraseEn, { color: theme.muted }]}>{localizePhraseEn(p.en)}</Text>
              </View>
            ))}
          </TopicLine>
          <TopicLine theme={theme} title={t().atm} value={info.atmTip} expanded={topic==='atm'} onToggle={() => toggleTopic('atm')} icon={<Bank {...icon} />} />
          <TopicLine theme={theme} title={t().transport} value={info.transportTip} expanded={topic==='tr'} onToggle={() => toggleTopic('tr')} icon={<Taxi {...icon} />} />
          <TopicLine theme={theme} title={t().culture} value={info.cultureTip} expanded={topic==='culture'} onToggle={() => toggleTopic('culture')} icon={<Handshake {...icon} />} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  flag: { fontSize: 22 },
  code: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  name: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  hint: { fontSize: 11, fontWeight: '700' },
  body: {
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  section: {
    paddingVertical: 12,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 0,
  },
  topicRow: { gap: 4 },
  topicValue: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
    marginLeft: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  bodyTxt: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  kv: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
    marginTop: 4,
  },
  kvLabel: {
    fontSize: 12,
    fontWeight: '600',
    width: 88,
  },
  phrase: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
  },
  phraseLocal: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  phraseEn: {
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 0,
    maxWidth: '46%',
  },
  passportHint: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
  },
  passportRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  passportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  passportFlag: { fontSize: 16 },
  passportCode: { fontSize: 12, fontWeight: '800' },
});
