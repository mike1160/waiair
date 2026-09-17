/** Reload-once guard for the launch OTA check (App.tsx checkForUpdate). */

export const OTA_RELOADED_KEY = 'waiair.otaReloadedUpdate.v1';

type UpdateCheck = {
  isAvailable: boolean;
  isRollBackToEmbedded?: boolean;
  manifest?: { id?: string } | null;
};

/** The update a check offers as a stable key: its manifest id, or the runtime's roll-back-to-embedded directive; '' when none. */
export function otaUpdateKey(check: UpdateCheck, runtimeVersion?: string | null): string {
  if (!check.isAvailable) return '';
  if (check.isRollBackToEmbedded) return `rollback:${String(runtimeVersion || '')}`;
  return String(check.manifest?.id || '');
}

/**
 * Reload into an update at most once. An update that fails to launch falls back to the embedded bundle, and reloading
 * into it again on every start was a loading loop (OTA of 17 Sep 2026).
 */
export function shouldReloadForUpdate(key: string, lastReloadedKey?: string | null): boolean {
  return !!key && key !== String(lastReloadedKey || '');
}
