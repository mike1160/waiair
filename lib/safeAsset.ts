import { Image, type ImageSourcePropType } from 'react-native';

/** No-op — expo-asset is not bundled; bundled images use RN resolver only. */
export function initExpoAssetSafe(): void {}

/** Resolve a bundled image module without expo-asset. */
export function resolveBundledImage(moduleId: number): ImageSourcePropType {
  try {
    return Image.resolveAssetSource(moduleId);
  } catch {
    return moduleId;
  }
}

/** expo-asset unavailable — always returns null. */
export async function downloadBundledAsset(_moduleId: number): Promise<string | null> {
  return null;
}
