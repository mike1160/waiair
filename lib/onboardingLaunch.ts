import AsyncStorage from '@react-native-async-storage/async-storage';
import { ONBOARDING_PRESET_COMPLETE_KEY } from '../components/OnboardingPresetScreen';
import { getPrefs, markOnboardingSeen } from './prefs';

/** Skip preset, explainer slides and home-airport picker on first launch. Existing stored settings stay. */
export async function skipFirstLaunchGates(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_PRESET_COMPLETE_KEY, 'true');
  if (!getPrefs().hasSeenOnboarding) await markOnboardingSeen();
}
