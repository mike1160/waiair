import { View } from 'react-native';
import { tryRequire } from './lib/safeNative';

type MapsModule = {
  default: typeof View;
  Marker: typeof View;
  Polyline: typeof View;
};

const maps = tryRequire<MapsModule>('react-native-maps');

export const mapsNativeAvailable = !!maps?.default;

export const MapView = maps?.default ?? View;
export const Marker = maps?.Marker ?? View;
export const Polyline = maps?.Polyline ?? View;
