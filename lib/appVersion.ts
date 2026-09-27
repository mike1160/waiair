/** Native binary version for Settings — not Constants.expoConfig (OTA / embedded JS). */

function firstNonEmpty(...values: Array<string | number | null | undefined>): string {
  for (const value of values) {
    if (value == null) continue;
    const s = String(value).trim();
    if (s) return s;
  }
  return '';
}

export function resolveAppVersion(input: {
  nativeVersion?: string | null;
  nativeBuild?: string | null;
  configVersion?: string | null;
  configBuild?: string | number | null;
}): { version: string; build: string } {
  return {
    version: firstNonEmpty(input.nativeVersion, input.configVersion) || '1.0.0',
    build: firstNonEmpty(input.nativeBuild, input.configBuild),
  };
}

export function formatAppVersionLabel(version: string, build: string): string {
  return build ? `${version} (${build})` : version;
}

/**
 * Which bundle is actually running [V/1b].
 *
 * The version and the build number are identical whether the app is running the code it shipped with or an
 * update fetched afterwards, so neither the traveller nor anyone debugging could tell the two apart — and a
 * fix that had been published for hours was indistinguishable from one that had never arrived. This is the
 * one line that settles it.
 *
 * `embedded` is what a fresh install runs on its very first launch, always: the update downloads in the
 * background and takes effect the next time the app starts.
 */
export function formatUpdateLabel(input: {
  updateId?: string | null;
  isEmbeddedLaunch?: boolean;
  isEnabled?: boolean;
}): string {
  if (!input.isEnabled) return 'dev';
  if (input.isEmbeddedLaunch) return 'embedded';
  const id = String(input.updateId || '').trim();
  return id ? id.slice(0, 8) : 'embedded';
}
