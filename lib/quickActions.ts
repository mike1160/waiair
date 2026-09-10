import { Platform } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import type { DeepLinkAction } from './deepLinks';
import { t } from './i18n';

function quickActionItems(): QuickActions.Action[] {
  const copy = t();
  return [
    { id: 'myflights', title: copy.qaMyFlights, subtitle: copy.qaMyFlightsSub, icon: 'favorite' },
    { id: 'scan', title: copy.scanBoardingPass, subtitle: copy.qaScanSub, icon: 'capturePhoto' },
    { id: 'departures', title: copy.qaDepartures, subtitle: copy.qaDeparturesSub, icon: 'time' },
    { id: 'search', title: copy.trackAFlight, subtitle: copy.qaSearchSub, icon: 'search' },
  ];
}

function toDeepLink(id?: string): DeepLinkAction | null {
  if (id === 'myflights') return { kind: 'myflights' };
  if (id === 'scan') return { kind: 'scan' };
  if (id === 'departures') return { kind: 'departures' };
  if (id === 'search') return { kind: 'search' };
  return null;
}

export async function refreshQuickActionItems(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    await QuickActions.setItems(quickActionItems());
  } catch {
    /* Quick Actions unavailable */
  }
}

export async function registerQuickActions(
  onAction: (action: DeepLinkAction) => void,
): Promise<() => void> {
  if (Platform.OS === 'web') return () => {};
  try {
    await refreshQuickActionItems();
    const initial = toDeepLink(QuickActions.initial?.id);
    if (initial) onAction(initial);
    const sub = QuickActions.addListener(action => {
      const parsed = toDeepLink(action?.id);
      if (parsed) onAction(parsed);
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
