import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

async function safe(fn: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  try { await fn(); } catch { /* ignore */ }
}

export const haptics = {
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  lastCallBurst: async () => {
    if (Platform.OS === 'web') return;
    for (let i = 0; i < 3; i++) {
      await safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
      if (i < 2) await new Promise<void>(r => setTimeout(r, 200));
    }
  },
};
