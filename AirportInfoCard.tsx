import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CaretDown, WifiHigh, Copy, Buildings, Armchair, Lightbulb, DeviceMobile } from 'phosphor-react-native';
import * as Clipboard from 'expo-clipboard';
import airportInfoData from './data/airportInfo.json';
import { t } from './lib/i18n';

export type AirportInfoEntry = {
  iata: string;
  name: string;
  flag: string;
  wifi: { ssid: string; password: string | null };
  terminals: string;
  lounges: string[];
  tips: string;
  sim?: string;
};

const AIRPORT_INFO = airportInfoData as Record<string, AirportInfoEntry>;

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
  list: string;
};

export function getAirportInfo(iata: string): AirportInfoEntry | null {
  const key = String(iata || '').toUpperCase();
  return AIRPORT_INFO[key] || null;
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

export default function AirportInfoCard({
  iata,
  theme,
  onToast,
}: {
  iata: string;
  theme: ThemeBits;
  onToast?: (msg: string) => void;
}) {
  const info = getAirportInfo(iata);
  const [open, setOpen] = useState(false);
  const chevron = useRef(new Animated.Value(0)).current;

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

  const copyWifi = async () => {
    const text = info.wifi.password
      ? `SSID: ${info.wifi.ssid}\nPassword: ${info.wifi.password}`
      : `SSID: ${info.wifi.ssid} (no password)`;
    try {
      await Clipboard.setStringAsync(text);
      onToast?.('WiFi details copied');
    } catch {
      onToast?.('Could not copy');
    }
  };

  const rotate = chevron.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Pressable
        onPress={toggle}
        style={styles.header}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`Airport info ${info.iata}`}
      >
        <View style={styles.headerLeft}>
          <Text style={styles.flag}>{info.flag}</Text>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.iata, { color: theme.accent }]}>{info.iata}</Text>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
              {info.name}
            </Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={[styles.hint, { color: theme.muted }]}>
            {open ? 'Hide' : 'Airport Info'}
          </Text>
          <Animated.View style={{ transform: [{ rotate }] }}>
            <CaretDown size={18} color={theme.muted} />
          </Animated.View>
        </View>
      </Pressable>

      {open ? (
        <View style={styles.body}>
          <Section
            theme={theme}
            title="WiFi"
            icon={<WifiHigh size={16} color={theme.accent} />}
          >
            <View style={styles.wifiRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.bodyTxt, { color: theme.text }]}>{info.wifi.ssid}</Text>
                <Text style={[styles.meta, { color: theme.muted }]}>
                  {info.wifi.password
                    ? `Password: ${info.wifi.password}`
                    : 'No password required'}
                </Text>
              </View>
              <Pressable
                onPress={copyWifi}
                hitSlop={10}
                style={[styles.copyBtn, { backgroundColor: theme.list, borderColor: theme.border }]}
                accessibilityLabel="Copy WiFi details"
              >
                <Copy size={16} color={theme.accent} />
              </Pressable>
            </View>
          </Section>

          <Section
            theme={theme}
            title="Terminals"
            icon={<Buildings size={16} color={theme.accent} />}
          >
            <Text style={[styles.bodyTxt, { color: theme.text }]}>{info.terminals}</Text>
          </Section>

          <Section
            theme={theme}
            title="Lounges"
            icon={<Armchair size={16} color={theme.accent} />}
          >
            <Text style={[styles.bodyTxt, { color: theme.text }]}>
              {info.lounges.join(' · ')}
            </Text>
          </Section>

          <Section
            theme={theme}
            title="Tips"
            icon={<Lightbulb size={16} color={theme.accent} />}
            isLast={!info.sim}
          >
            <Text style={[styles.bodyTxt, { color: theme.text }]}>{info.tips}</Text>
          </Section>

          {info.sim ? (
            <Section
              theme={theme}
              title={t().localSimTitle}
              icon={<DeviceMobile size={16} color={theme.accent} />}
              isLast
            >
              <Text style={[styles.bodyTxt, { color: theme.text }]}>{info.sim}</Text>
            </Section>
          ) : null}
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
  iata: { fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
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
  meta: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  wifiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
