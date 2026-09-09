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
