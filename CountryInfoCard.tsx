import { useSquareStyles } from './lib/modeContext';
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
  MapPin,
  Phone,
  Plug,
  Taxi,
  ThermometerSimple,
  Translate,
} from 'phosphor-react-native';
import CardPhoto from './components/CardPhoto';
import countryInfoData from './data/countryInfo.json';
import { countryPhotoQueries } from './lib/placePhoto';
import { usePlacePhoto } from './lib/placePhotoStore';
import { fetchCountryFacts, type CountryFacts } from './lib/countryFacts';
import { t } from './lib/i18n';
import {
  defaultPassportCode,
  passportFlag,
  PASSPORT_OPTIONS,
  visaTextForPassport,
} from './lib/visaByPassport';

/** Text on a photo: white, so it stays readable over the 50% dimmed background in both themes. */
const ON_PHOTO_TEXT = '#FFFFFF';
const ON_PHOTO_MUTED = 'rgba(255,255,255,0.82)';

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
  const styles = useSquareStyles(baseStyles);
  return (
    <View style={[styles.section, { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }]}>
      <Pressable onPress={onToggle} style={styles.topicRow} accessibilityRole="button" accessibilityState={{ expanded }}>
        <View style={styles.sectionHead}>
          {icon}
          <Text style={[styles.sectionTitle, { color: theme.secondary }]}>{title}</Text>
        </View>
        {/* Country info: full text, never truncated. */}
        <Text style={[styles.topicValue, { color: theme.text }]}>{value}</Text>
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
  const styles = useSquareStyles(baseStyles);
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
  const styles = useSquareStyles(baseStyles);
  const info = getCountryInfo(country);
  /*
   * Country info: live facts from REST Countries v5 (via the proxy) for every country.
   * Visa, climate, phrases, ATM and emergency numbers are not in v5 and stay from data/countryInfo.json.
   */
  const [facts, setFacts] = useState<CountryFacts | null>(null);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<string | null>(null);
  const [passport, setPassport] = useState(defaultPassportCode);
  const chevron = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setOpen(false);
    chevron.setValue(0);
  }, [country, chevron]);

  useEffect(() => {
    let cancelled = false;
    setFacts(null);
    fetchCountryFacts(country).then(f => { if (!cancelled) setFacts(f); });
    return () => { cancelled = true; };
  }, [country]);

  useEffect(() => {
    Animated.timing(chevron, {
      toValue: open ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, chevron]);

  // Country photo (Unsplash via the proxy, cached 7 days). No photo keeps the card exactly as it was.
  const countryName = info?.name || facts?.name || info?.code || facts?.code || '';
  const photo = usePlacePhoto('country', countryName, countryPhotoQueries(countryName));
  /** Closed with a photo: the header text sits on the photo, so it switches to white. */
  const onPhoto = !!photo && !open;

  if (!info && !facts) return null;
  const code = info?.code || facts?.code || '';
  const flag = info?.flag || facts?.flag || '';
  const name = info?.name || facts?.name || code;

  const toggle = () => setOpen(v => !v);

  const rotate = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  // Curated local data first (localized), REST Countries v5 for countries without it.
  const traffic = info?.traffic || facts?.drivingSide || '';
  const drive = traffic === 'left' ? t().ciDriveLeft : traffic === 'right' ? t().ciDriveRight : '';
  const icon = { size: 16, color: theme.accent } as const;
  const langs = (info?.languages || facts?.languages || []).map(localizeLanguage).join(' · ');
  const currencyLine = info
    ? `${info.currency.code} · ${localizeCurrency(info.currency.code, info.currency.name)}`
    : (facts?.currencies || []).map(c => `${c.code} · ${localizeCurrency(c.code, c.name)}${c.symbol ? ` (${c.symbol})` : ''}`).join(' / ');
  const tzLine = info
    ? `${info.timezone.utc} · ${localizeTimezone(info.timezone.name)}`
    : (facts?.timezones || []).join(' / ');
  const capitalLine = facts?.capital || '';
  const callingLine = (facts?.callingCodes || []).map(c => `+${c}`).join(' / ');
  const toggleTopic = (id: string) => setTopic(cur => (cur === id ? null : id));

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {photo && !open ? (
        // Closed: the photo is the card background, dimmed 50%, with a very slow Ken Burns zoom.
        <CardPhoto photo={photo} mode="background" overlayOpacity={0.5} kenBurns radius={16} />
      ) : null}
      {photo && open ? (
        // Open: the same photo stays as the header; every line of country info below is untouched.
        <CardPhoto photo={photo} mode="header" height={160} gradientHeight={80} radius={16}>
          <Text style={styles.photoTitle} numberOfLines={1}>{`${flag} ${name}`}</Text>
        </CardPhoto>
      ) : null}
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${flag} ${code} travel info`}
        accessibilityHint={t().countryInfoA11yHint}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.flag}>{flag}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.code, { color: onPhoto ? ON_PHOTO_TEXT : theme.accent }]}>{code}</Text>
            <Text style={[styles.name, { color: onPhoto ? ON_PHOTO_TEXT : theme.text }]}>
              {name}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.hint, { color: onPhoto ? ON_PHOTO_MUTED : theme.muted }]}>
            {open ? t().hideDetails : t().tapForInfo}
          </Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <CaretDown size={18} color={onPhoto ? ON_PHOTO_MUTED : theme.muted} />
          </Animated.View>
        </View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          {capitalLine ? <TopicLine theme={theme} title={t().ciCapital} value={capitalLine} expanded={topic==='capital'} onToggle={() => toggleTopic('capital')} icon={<MapPin {...icon} />} /> : null}
          {langs ? <TopicLine theme={theme} title={t().language} value={langs} expanded={topic==='lang'} onToggle={() => toggleTopic('lang')} icon={<Translate {...icon} />} /> : null}
          {currencyLine ? <TopicLine theme={theme} title={t().currency} value={currencyLine} expanded={topic==='cur'} onToggle={() => toggleTopic('cur')} icon={<CreditCard {...icon} />} /> : null}
          {tzLine ? <TopicLine theme={theme} title={t().timezone} value={tzLine} expanded={topic==='tz'} onToggle={() => toggleTopic('tz')} icon={<Clock {...icon} />} /> : null}
          {callingLine ? <TopicLine theme={theme} title={t().ciCallingCode} value={callingLine} expanded={topic==='calling'} onToggle={() => toggleTopic('calling')} icon={<Phone {...icon} />} /> : null}
          {info ? (
          <TopicLine
            theme={theme}
            title={t().emergency}
            value={`${t().police} ${info.emergency.police} · ${t().ambulance} ${info.emergency.ambulance} · ${t().fire} ${info.emergency.fire}`}
            expanded={topic==='em'}
            onToggle={() => toggleTopic('em')}
            icon={<FirstAid {...icon} />}
          >
            <KV theme={theme} label={t().police} value={info.emergency.police} />
            <KV theme={theme} label={t().ambulance} value={info.emergency.ambulance} />
            <KV theme={theme} label={t().fire} value={info.emergency.fire} />
          </TopicLine>
          ) : null}
          {info ? (
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
          ) : null}
          {info ? <TopicLine theme={theme} title={t().power} value={`Type ${info.power.plugs} · ${info.power.voltage} · ${info.power.frequency}`} expanded={topic==='power'} onToggle={() => toggleTopic('power')} icon={<Plug {...icon} />} /> : null}
          {drive ? <TopicLine theme={theme} title={t().traffic} value={drive} expanded={topic==='drive'} onToggle={() => toggleTopic('drive')} icon={<Car {...icon} />} /> : null}
          {info ? <TopicLine theme={theme} title={t().climate} value={info.climate} expanded={topic==='climate'} onToggle={() => toggleTopic('climate')} icon={<ThermometerSimple {...icon} />} /> : null}
          {info ? (
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
          ) : null}
          {info ? <TopicLine theme={theme} title={t().atm} value={info.atmTip} expanded={topic==='atm'} onToggle={() => toggleTopic('atm')} icon={<Bank {...icon} />} /> : null}
          {info ? <TopicLine theme={theme} title={t().transport} value={info.transportTip} expanded={topic==='tr'} onToggle={() => toggleTopic('tr')} icon={<Taxi {...icon} />} /> : null}
          {info ? <TopicLine theme={theme} title={t().culture} value={info.cultureTip} expanded={topic==='culture'} onToggle={() => toggleTopic('culture')} icon={<Handshake {...icon} />} /> : null}
        </View>
      ) : null}
    </View>
  );
}

const baseStyles = StyleSheet.create({
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
  photoTitle: { color: ON_PHOTO_TEXT, fontSize: 17, fontWeight: '700' },
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
