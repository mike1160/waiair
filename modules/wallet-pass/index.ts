/** Apple Wallet native module (modules/wallet-pass/ios). null on Android and on builds made before the module existed. */
import type { ComponentType } from 'react';
import { Platform, type ViewProps } from 'react-native';
import { requireNativeView, requireOptionalNativeModule } from 'expo';

export type AddPassResult = 'added' | 'cancelled';

type WalletPassNative = {
  canAddPasses(): boolean;
  addPassFromUrl(url: string, headers: Record<string, string>): Promise<AddPassResult>;
};

export type AddPassButtonProps = ViewProps & {
  /** Not onPress: React Native reserves that name for its own bubbling press event. */
  onAddPassPress?: () => void;
  /** 'blackOutline' on dark backgrounds. */
  buttonStyle?: 'black' | 'blackOutline';
};

const native = Platform.OS === 'ios' ? requireOptionalNativeModule<WalletPassNative>('WalletPass') : null;

/** Apple's "Add to Apple Wallet" badge; null when the native module is missing. */
export const AddPassButton: ComponentType<AddPassButtonProps> | null = native
  ? requireNativeView<AddPassButtonProps>('WalletPass')
  : null;

export function canAddPasses(): boolean {
  try {
    return !!native && native.canAddPasses();
  } catch {
    return false;
  }
}

/** Downloads the .pkpass and shows Apple's add-pass sheet. Rejects on a failed download or an invalid pass. */
export function addPassFromUrl(url: string, headers: Record<string, string> = {}): Promise<AddPassResult> {
  if (!native) return Promise.reject(new Error('wallet_pass_module_unavailable'));
  return native.addPassFromUrl(url, headers);
}
