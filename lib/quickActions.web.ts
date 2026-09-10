import type { DeepLinkAction } from './deepLinks';

export async function refreshQuickActionItems(): Promise<void> {}

export async function registerQuickActions(
  _onAction: (action: DeepLinkAction) => void,
): Promise<() => void> {
  return () => {};
}
