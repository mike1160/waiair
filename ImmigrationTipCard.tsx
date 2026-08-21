import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { ArrowRight } from 'phosphor-react-native';
import { type DetailCardTheme } from './lib/detailCardStyles';
import { showLandingGrab, type LandingCardPhase } from './lib/landingCards';
import {
  getImmigrationApp,
  immigrationOpenUrl,
} from './lib/immigrationApps';

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

  return (
    <Pressable
      onPress={() => { Linking.openURL(immigrationOpenUrl(app)).catch(() => {}); }}
      accessibilityRole="button"
      accessibilityLabel={app.description}
      style={({ pressed }) => [st.row, pressed && st.pressed]}
    >
      <Text style={st.flag}>{app.flagEmoji}</Text>
      <Text style={st.label} numberOfLines={1}>{app.description}</Text>
      <ArrowRight size={12} color="rgba(255,255,255,0.5)" weight="bold" />
    </Pressable>
  );
}

const st = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 36,
    maxHeight: 36,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
  },
  pressed: {
    opacity: 0.72,
  },
  flag: {
    fontSize: 16,
    lineHeight: 20,
  },
  label: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
  },
});
