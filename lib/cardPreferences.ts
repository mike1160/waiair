import AsyncStorage from '@react-native-async-storage/async-storage';

const VIEW_KEY = 'cardViewCounts';
const DISMISS_KEY = 'cardDismissCounts';

export type CardPreferenceStore = {
  viewCounts: Record<string, number>;
  dismissCounts: Record<string, number>;
};

const EMPTY: CardPreferenceStore = { viewCounts: {}, dismissCounts: {} };

function parseRecord(raw: string | null): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export async function loadCardPreferences(): Promise<CardPreferenceStore> {
  try {
    const [viewsRaw, dismissRaw] = await Promise.all([
      AsyncStorage.getItem(VIEW_KEY),
      AsyncStorage.getItem(DISMISS_KEY),
    ]);
    return {
      viewCounts: parseRecord(viewsRaw),
      dismissCounts: parseRecord(dismissRaw),
    };
  } catch {
    return EMPTY;
  }
}

export async function recordCardView(sectionId: string): Promise<void> {
  try {
    const prefs = await loadCardPreferences();
    const next = (prefs.viewCounts[sectionId] ?? 0) + 1;
    await AsyncStorage.setItem(
      VIEW_KEY,
      JSON.stringify({ ...prefs.viewCounts, [sectionId]: next }),
    );
  } catch { /* ignore */ }
}

export async function recordCardDismiss(sectionId: string): Promise<void> {
  try {
    const prefs = await loadCardPreferences();
    const next = (prefs.dismissCounts[sectionId] ?? 0) + 1;
    await AsyncStorage.setItem(
      DISMISS_KEY,
      JSON.stringify({ ...prefs.dismissCounts, [sectionId]: next }),
    );
  } catch { /* ignore */ }
}

/** Behavioral bonus applied on top of situational card score. */
export function behavioralScoreBonus(
  sectionId: string,
  viewCounts: Record<string, number>,
  dismissCounts: Record<string, number>,
): number {
  const views = viewCounts[sectionId] ?? 0;
  const dismisses = dismissCounts[sectionId] ?? 0;
  if (views > 5) return 15;
  if (dismisses >= 3 && views === 0) return -10;
  if (views === 0) return -5;
  return 0;
}

export function mergeCardPreferences(
  current: CardPreferenceStore,
  sectionId: string,
  kind: 'view' | 'dismiss',
): CardPreferenceStore {
  if (kind === 'view') {
    return {
      ...current,
      viewCounts: {
        ...current.viewCounts,
        [sectionId]: (current.viewCounts[sectionId] ?? 0) + 1,
      },
    };
  }
  return {
    ...current,
    dismissCounts: {
      ...current.dismissCounts,
      [sectionId]: (current.dismissCounts[sectionId] ?? 0) + 1,
    },
  };
}
