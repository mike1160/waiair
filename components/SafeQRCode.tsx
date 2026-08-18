import type { ComponentType } from 'react';
import { Text, View } from 'react-native';
import { tryRequire } from '../lib/safeNative';

type QRProps = {
  value: string;
  size?: number;
  backgroundColor?: string;
  color?: string;
};

type QRComponent = ComponentType<QRProps>;

let cached: QRComponent | null | undefined;

function loadQR(): QRComponent | null {
  const mod = tryRequire<{ default: QRComponent }>('react-native-qrcode-svg');
  return mod?.default ?? null;
}

export function qrCodeNativeAvailable(): boolean {
  if (cached === undefined) cached = loadQR();
  return cached != null;
}

export default function SafeQRCode({
  value,
  size = 160,
  backgroundColor = '#fff',
  color = '#0A0E1A',
}: QRProps) {
  if (cached === undefined) cached = loadQR();
  const QR = cached;
  if (!QR) {
    return (
      <View
        style={{
          width: size,
          minHeight: size * 0.45,
          padding: 12,
          backgroundColor,
          borderRadius: 8,
          justifyContent: 'center',
        }}
      >
        <Text style={{ color, fontSize: 11, fontWeight: '600', textAlign: 'center' }} numberOfLines={5}>
          {value}
        </Text>
      </View>
    );
  }
  return <QR value={value} size={size} backgroundColor={backgroundColor} color={color} />;
}
