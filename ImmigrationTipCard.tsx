import { useMemo, useState } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowRight } from 'phosphor-react-native';
import { detailCardBg, type DetailCardTheme } from './lib/detailCardStyles';
import { showLandingGrab, type LandingCardPhase } from './lib/landingCards';
import { t } from './lib/i18n';
import {
  getImmigrationApp,
  immigrationNeedsRegionWarning,
  immigrationOpenUrl,
  type ImmigrationApp,
} from './lib/immigrationApps';

const TILE_SHADOW = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  android: { elevation: 2 },
  default: {},
});

const APP_LOGOS: Partial<Record<string, ImageSourcePropType>> = {
  'SG Arrival Card': require('./assets/logos/sgarrival.png'),
};

function AppIcon({ app }: { app: ImmigrationApp }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const source = APP_LOGOS[app.appName];

  if (!source || logoFailed) {
    return <Text style={st.flagIcon}>{app.flagEmoji}</Text>;
  }

  return (
    <Image
      source={source}
      style={st.logo}
      resizeMode="contain"
      onError={() => setLogoFailed(true)}
    />
  );
}

export function shouldShowImmigrationTipCard(input: {
  type: 'arrival' | 'departure';
  status?: string;
  destIata?: string;
  landingPhase?: LandingCardPhase;
}): boolean {
  if (input.type !== 'arrival') return false;
  if (String(input.status || '').toLowerCase() === 'cancelled') return false;
  if (String(input.status || '').toLowerCase() !== 'landed') return false;
  if (!getImmigrationApp(String(input.destIata || ''))) return false;
  if (input.landingPhase !== undefined) {
    return showLandingGrab(input.landingPhase);
  }
  return true;
}

export default function ImmigrationTipCard({
  type,
  status,
  destIata,
  landingPhase,
  theme,
}: {
  type: 'arrival' | 'departure';
  status?: string;
  destIata?: string;
  landingPhase?: LandingCardPhase;
  theme: DetailCardTheme;
}) {
  const app = useMemo(
    () => getImmigrationApp(String(destIata || '')),
    [destIata],
  );

  const visible = useMemo(
    () => shouldShowImmigrationTipCard({ type, status, destIata, landingPhase }),
    [type, status, destIata, landingPhase],
  );

  if (!visible || !app) return null;

  const regionWarning = immigrationNeedsRegionWarning(app);
  const warning = t().immigrationAppRegionWarning;
  const label = regionWarning
    ? `${app.appName} — ${app.description}. ${warning}`
    : `${app.appName} — ${app.description}`;

  return (
    <View style={[st.card, { backgroundColor: detailCardBg(theme) }]}>
      <Pressable
        style={st.row}
        onPress={() => { Linking.openURL(immigrationOpenUrl(app)).catch(() => {}); }}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <AppIcon app={app} />
        <View style={st.textWrap}>
          <Text style={[st.title, { color: theme.text }]} numberOfLines={1}>
            {`${app.flagEmoji} ${app.appName}`}
          </Text>
          <Text style={[st.description, { color: theme.muted }]} numberOfLines={2}>
            {app.description}
          </Text>
          {regionWarning ? (
            <Text style={st.warning} numberOfLines={2}>
              {warning}
            </Text>
          ) : null}
        </View>
        <ArrowRight size={16} color={theme.secondary} weight="bold" />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 52,
    ...TILE_SHADOW,
  },
  logo: {
    width: 32,
    height: 32,
  },
  flagIcon: {
    fontSize: 28,
    lineHeight: 32,
    width: 32,
    textAlign: 'center',
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  description: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
  warning: {
    fontSize: 11,
    fontWeight: '600',
    lineHeight: 15,
    color: '#B45309',
    marginTop: 2,
  },
});
