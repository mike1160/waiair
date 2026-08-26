import { useEffect, useState } from 'react';
import { Image } from 'react-native';

/** JS-only stand-in for expo-asset when the ExpoAsset native module is missing. */

export const ANDROID_EMBEDDED_URL_BASE_RESOURCE = 'file:///android_res/';

export class Asset {
  static byHash: Record<string, Asset> = {};
  static byUri: Record<string, Asset> = {};

  name = '';
  type = '';
  hash: string | null = null;
  uri = '';
  localUri: string | null = null;
  width: number | null = null;
  height: number | null = null;
  downloaded = false;

  static fromModule(moduleId: number): Asset {
    const asset = new Asset();
    try {
      const src = Image.resolveAssetSource(moduleId);
      asset.uri = src?.uri || '';
      asset.localUri = src?.uri || null;
      asset.width = src?.width ?? null;
      asset.height = src?.height ?? null;
      asset.downloaded = !!asset.uri;
    } catch {
      /* native ExpoAsset unavailable — leave empty */
    }
    return asset;
  }

  static fromURI(uri: string): Asset {
    const asset = new Asset();
    asset.uri = uri;
    asset.localUri = uri;
    return asset;
  }

  static fromMetadata(meta: { name?: string; type?: string; hash?: string; uri?: string; httpServerLocation?: string }): Asset {
    const asset = new Asset();
    asset.name = meta?.name || '';
    asset.type = meta?.type || '';
    asset.hash = meta?.hash ?? null;
    asset.uri = meta?.uri || '';
    return asset;
  }

  static async loadAsync(moduleIds: number | number[]): Promise<Asset[]> {
    const ids = Array.isArray(moduleIds) ? moduleIds : [moduleIds];
    return ids.map(id => Asset.fromModule(id));
  }

  async downloadAsync(): Promise<this> {
    this.downloaded = true;
    if (!this.localUri) this.localUri = this.uri;
    return this;
  }
}

export function useAssets(moduleIds: number[]): [Asset[] | undefined, Error | undefined] {
  const [assets, setAssets] = useState<Asset[] | undefined>();
  const [error, setError] = useState<Error | undefined>();
  useEffect(() => {
    Asset.loadAsync(moduleIds).then(setAssets).catch(setError);
  }, []);
  return [assets, error];
}
