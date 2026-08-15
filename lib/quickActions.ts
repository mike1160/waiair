import { Platform } from 'react-native';
import * as QuickActions from 'expo-quick-actions';
import type { DeepLinkAction } from './deepLinks';

const ITEMS: QuickActions.Action[] = [
  { id: 'myflights', title: 'My Flights', subtitle: 'Tracked flights', icon: 'favorite' },
  { id: 'scan', title: 'Scan Boarding Pass', subtitle: 'Open camera scanner', icon: 'capturePhoto' },
  { id: 'departures', title: 'Departures', subtitle: 'Saved airport board', icon: 'time' },
  { id: 'search', title: 'Track a Flight', subtitle: 'Search flight number', icon: 'search' },
];

function toDeepLink(id?: string): DeepLinkAction | null {
  if (id === 'myflights') return { kind: 'myflights' };
  if (id === 'scan') return { kind: 'scan' };
  if (id === 'departures') return { kind: 'departures' };
  if (id === 'search') return { kind: 'search' };
  return null;
}

export async function registerQuickActions(
  onAction: (action: DeepLinkAction) => void,
): Promise<() => void> {
  if (Platform.OS === 'web') return () => {};
  try {
    await QuickActions.setItems(ITEMS);
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
