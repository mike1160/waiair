import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { haptics } from '../lib/haptics';
import { t } from '../lib/i18n';
import {
  applyPreset,
  MODULES,
  modulesForPreset,
  setActiveModules,
  type ModuleId,
  type Preset,
} from '../lib/modules';

export const ONBOARDING_PRESET_COMPLETE_KEY = 'waiair.onboarding.complete';

const BG = '#0f1117';
const GOLD = '#FFD700';
const NAVY = '#0D1B2E';
const TEXT = '#F8FAFC';
const MUTED = '#94A3B8';
const CARD = 'rgba(148,163,184,0.08)';
const CARD_BORDER = 'rgba(148,163,184,0.18)';
const CARD_ACTIVE = 'rgba(255,215,0,0.12)';
const CARD_ACTIVE_BORDER = 'rgba(255,215,0,0.55)';

type PresetOption = {
  id: Preset;
  emoji: string;
  titleKey: string;
  bodyKey: string;
  titleFallback: string;
  bodyFallback: string;
  recommended?: boolean;
};

const PRESET_OPTIONS: PresetOption[] = [
  {
    id: 'quick',
    emoji: '⚡',
    titleKey: 'onboardingPresetQuickTitle',
    bodyKey: 'onboardingPresetQuickDesc',
    titleFallback: 'Quick',
    bodyFallback: 'Your flight or pickup only. No airport board.',
  },
  {
    id: 'traveller',
    emoji: '🛫',
    titleKey: 'onboardingPresetTravellerTitle',
    bodyKey: 'onboardingPresetTravellerDesc',
    titleFallback: 'Traveller',
    bodyFallback: 'Flight + transport + weather + immigration',
    recommended: true,
  },
  {
    id: 'pro',
    emoji: '🤓',
    titleKey: 'onboardingPresetProTitle',
    bodyKey: 'onboardingPresetProDesc',
    titleFallback: 'Pro',
    bodyFallback: 'Everything. For the aviation nerd.',
  },
  {
    id: 'custom',
    emoji: '⚙️',
    titleKey: 'onboardingPresetCustomTitle',
    bodyKey: 'onboardingPresetCustomDesc',
    titleFallback: 'Custom',
    bodyFallback: 'Choose your own modules',
  },
];

function ob(key: string, fallback: string): string {
  const value = (t() as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}

export async function isOnboardingPresetComplete(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ONBOARDING_PRESET_COMPLETE_KEY);
    return raw === 'true';
  } catch {
    return false;
  }
}

export default function OnboardingPresetScreen({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [selected, setSelected] = useState<Preset | null>(null);
  const [customModules, setCustomModules] = useState<ModuleId[]>(() => modulesForPreset('traveller'));
  const [busy, setBusy] = useState(false);

  const tagline = ob('onboardingPresetTagline', 'know before you go');
  const settingsHint = ob('onboardingPresetFooter', 'You can always change this in settings');
  const modulesTitle = ob('onboardingPresetModulesTitle', 'Your modules');
  const recommendedLabel = ob('onboardingPresetTravellerBadge', 'Recommended');
  const getStartedLabel = ob('onboardingPresetButton', 'Get started');

  const showCustomModules = selected === 'custom';

  const customSet = useMemo(() => new Set(customModules), [customModules]);

  const selectPreset = useCallback((preset: Preset) => {
    haptics.light();
    setSelected(preset);
    if (preset === 'custom' && customModules.length === 0) {
      setCustomModules(modulesForPreset('traveller'));
    }
  }, [customModules.length]);

  const toggleModule = useCallback((id: ModuleId, enabled: boolean) => {
    if (id === 'journey_phase') return;
    haptics.light();
    setCustomModules(prev => {
      const set = new Set(prev);
      if (enabled) set.add(id);
      else set.delete(id);
      set.add('journey_phase');
      return MODULES.map(m => m.id).filter(mid => set.has(mid));
    });
  }, []);

  const finish = useCallback(async () => {
    if (!selected || busy) return;
    setBusy(true);
    haptics.medium();
    try {
      if (selected === 'custom') {
        await setActiveModules(customModules);
      } else {
        await applyPreset(selected);
      }
      await AsyncStorage.setItem(ONBOARDING_PRESET_COMPLETE_KEY, 'true');
      onComplete();
    } catch {
      setBusy(false);
    }
  }, [busy, customModules, onComplete, selected]);

  return (
    <View style={st.root}>
      <View style={st.header}>
        <View style={st.logoRow}>
          <Text style={st.logoIcon}>✈</Text>
          <Text style={st.logoText}>WaiAir</Text>
        </View>
        <Text style={st.tagline}>{tagline}</Text>
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={st.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={st.cards}>
          {PRESET_OPTIONS.map(option => {
            const active = selected === option.id;
            return (
              <Pressable
                key={option.id}
                style={[st.card, active && st.cardActive]}
                onPress={() => selectPreset(option.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${option.emoji} ${ob(option.titleKey, option.titleFallback)}`}
              >
                <View style={st.cardTop}>
                  <Text style={st.cardEmoji}>{option.emoji}</Text>
                  <View style={st.cardTextWrap}>
                    <View style={st.cardTitleRow}>
                      <Text style={[st.cardTitle, active && st.cardTitleActive]}>
                        {ob(option.titleKey, option.titleFallback)}
                      </Text>
                      {option.recommended ? (
                        <View style={st.badge}>
                          <Text style={st.badgeTxt}>{recommendedLabel}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={st.cardBody}>{ob(option.bodyKey, option.bodyFallback)}</Text>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>

        {showCustomModules ? (
          <View style={st.modulePanel}>
            <Text style={st.modulePanelTitle}>{modulesTitle}</Text>
            {MODULES.map(mod => {
              const locked = mod.id === 'journey_phase';
              const on = locked || customSet.has(mod.id);
              return (
                <View key={mod.id} style={st.moduleRow}>
                  <View style={st.moduleCopy}>
                    <Text style={st.moduleLabel}>
                      {mod.icon} {mod.label}
                    </Text>
                    <Text style={st.moduleDesc} numberOfLines={2}>{mod.description}</Text>
                  </View>
                  <Switch
                    value={on}
                    onValueChange={v => toggleModule(mod.id, v)}
                    disabled={locked}
                    trackColor={{ false: 'rgba(148,163,184,0.25)', true: 'rgba(255,215,0,0.45)' }}
                    thumbColor={on ? GOLD : '#64748B'}
                    ios_backgroundColor="rgba(148,163,184,0.25)"
                    accessibilityLabel={mod.label}
                  />
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <View style={st.footer}>
        <Pressable
          style={[st.cta, (!selected || busy) && st.ctaDisabled]}
          onPress={() => { void finish(); }}
          disabled={!selected || busy}
          accessibilityRole="button"
          accessibilityLabel={getStartedLabel}
          accessibilityState={{ disabled: !selected || busy }}
        >
          {busy ? (
            <ActivityIndicator color={NAVY} />
          ) : (
            <Text style={st.ctaTxt}>{getStartedLabel}</Text>
          )}
        </Pressable>
        <Text style={st.hint}>{settingsHint}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 54 : Platform.OS === 'web' ? 20 : 28,
    paddingBottom: Platform.OS === 'ios' ? 28 : 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    fontSize: 22,
    color: GOLD,
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT,
    letterSpacing: 0.4,
  },
  tagline: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: '600',
    color: MUTED,
    letterSpacing: 0.3,
    textTransform: 'lowercase',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 12,
    gap: 14,
  },
  cards: {
    gap: 10,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  cardActive: {
    backgroundColor: CARD_ACTIVE,
    borderColor: CARD_ACTIVE_BORDER,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardEmoji: {
    fontSize: 24,
    lineHeight: 28,
    marginTop: 1,
  },
  cardTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: TEXT,
  },
  cardTitleActive: {
    color: GOLD,
  },
  cardBody: {
    fontSize: 13,
    lineHeight: 18,
    color: MUTED,
    fontWeight: '500',
  },
  badge: {
    backgroundColor: 'rgba(255,215,0,0.16)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
  },
  badgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: GOLD,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  modulePanel: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  modulePanelTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148,163,184,0.16)',
  },
  moduleCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 6,
  },
  moduleLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: TEXT,
    marginBottom: 2,
  },
  moduleDesc: {
    fontSize: 11,
    lineHeight: 15,
    color: MUTED,
    fontWeight: '500',
  },
  footer: {
    paddingTop: 12,
    gap: 10,
  },
  cta: {
    backgroundColor: GOLD,
    borderRadius: 14,
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  ctaDisabled: {
    opacity: 0.38,
  },
  ctaTxt: {
    color: NAVY,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 16,
    color: MUTED,
    fontWeight: '500',
    paddingBottom: Platform.OS === 'ios' ? 0 : 4,
  },
});
