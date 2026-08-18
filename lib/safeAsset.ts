import { Image, type ImageSourcePropType } from 'react-native';
import { tryRequire } from './safeNative';

type ExpoAssetModule = typeof import('expo-asset');

let expoAssetMod: ExpoAssetModule | null | undefined;

/** Lazy-load expo-asset — never throws if the native module is missing. */
export function getExpoAssetModule(): ExpoAssetModule | null {
  if (expoAssetMod !== undefined) return expoAssetMod;
  try {
    const mod = tryRequire<ExpoAssetModule>('expo-asset');
    expoAssetMod = mod?.Asset ? mod : null;
  } catch {
    expoAssetMod = null;
  }
  return expoAssetMod;
}

/** Safe startup probe; no-op when ExpoAsset is unavailable. */
export function initExpoAssetSafe(): void {
  try {
    getExpoAssetModule();
  } catch { /* skip silently */ }
}

/** Resolve a bundled image module without crashing when expo-asset is missing. */
export function resolveBundledImage(moduleId: number): ImageSourcePropType {
  const expo = getExpoAssetModule();
  if (expo?.Asset) {
    try {
      const asset = expo.Asset.fromModule(moduleId);
      const uri = asset.localUri || asset.uri;
      if (uri) {
        return {
          uri,
          width: asset.width ?? undefined,
          height: asset.height ?? undefined,
        };
      }
    } catch { /* fall through to RN resolver */ }
  }
  try {
    return Image.resolveAssetSource(moduleId);
  } catch {
    return moduleId;
  }
}

/** Optional async download — returns null when expo-asset is unavailable. */
export async function downloadBundledAsset(moduleId: number): Promise<string | null> {
  const expo = getExpoAssetModule();
  if (!expo?.Asset) return null;
  try {
    const asset = expo.Asset.fromModule(moduleId);
    await asset.downloadAsync();
    return asset.localUri || asset.uri || null;
  } catch {
    return null;
  }
}
