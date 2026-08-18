import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
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

function Section({
  icon,
  title,
  children,
  theme,
  isLast,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  theme: ThemeBits;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.section,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.border,
        },
      ]}
    >
      <View style={styles.sectionHead}>
        {icon}
        <Text style={[styles.sectionTitle, { color: theme.secondary }]}>{title}</Text>
      </View>
      {children}
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

  const drive = info.traffic === 'left' ? 'Drive on the left' : 'Drive on the right';
  const icon = { size: 16, color: theme.accent } as const;

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${info.flag} ${info.code} travel info`}
        accessibilityHint="Shows language, currency, emergency numbers and local tips"
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
            {open ? 'Hide' : 'tap for info'}
          </Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <CaretDown size={18} color={theme.muted} />
          </Animated.View>
        </View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <Section theme={theme} title="Language" icon={<Translate {...icon} />}>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>
              {info.languages.join(' · ')}
            </Text>
          </Section>

          <Section theme={theme} title="Currency" icon={<CreditCard {...icon} />}>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>
              {info.currency.code} · {info.currency.name}
            </Text>
          </Section>

          <Section theme={theme} title="Timezone" icon={<Clock {...icon} />}>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>
              {info.timezone.utc} · {info.timezone.name}
            </Text>
          </Section>

          <Section theme={theme} title="Emergency" icon={<FirstAid {...icon} />}>
            <KV theme={theme} label="Police" value={info.emergency.police} />
            <KV theme={theme} label="Ambulance" value={info.emergency.ambulance} />
            <KV theme={theme} label="Fire" value={info.emergency.fire} />
          </Section>

          <Section theme={theme} title="Visa" icon={<IdentificationCard {...icon} />}>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>{info.visa}</Text>
          </Section>

          <Section theme={theme} title="Power" icon={<Plug {...icon} />}>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>
              Type {info.power.plugs} · {info.power.voltage} · {info.power.frequency}
            </Text>
          </Section>

          <Section theme={theme} title="Traffic" icon={<Car {...icon} />}>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>{drive}</Text>
          </Section>

          <Section theme={theme} title="Climate" icon={<ThermometerSimple {...icon} />}>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>{info.climate}</Text>
          </Section>

          <Section theme={theme} title="Useful phrases" icon={<ChatTeardropText {...icon} />}>
            {info.phrases.map(p => (
              <View key={`${p.en}-${p.local}`} style={styles.phrase}>
                <Text style={[styles.phraseLocal, { color: theme.text }]}>{p.local}</Text>
                <Text style={[styles.phraseEn, { color: theme.muted }]}>{p.en}</Text>
              </View>
            ))}
          </Section>

          <Section theme={theme} title="ATM" icon={<Bank {...icon} />}>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>{info.atmTip}</Text>
          </Section>

          <Section theme={theme} title="Transport" icon={<Taxi {...icon} />}>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>{info.transportTip}</Text>
          </Section>

          <Section theme={theme} title="Culture" icon={<Handshake {...icon} />} isLast>
            <Text style={[styles.bodyTxt, { color: theme.text }]}>{info.cultureTip}</Text>
          </Section>
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
    marginBottom: 6,
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
});
