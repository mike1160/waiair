import { Platform, StyleSheet, View } from 'react-native';
import { MapView } from './nativeMaps';

/** Google Maps night style — used on Android standard tiles. */
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#0b1220' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b7c93' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0b1220' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1b2838' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#061018' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d4f63' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#101827' }] },
];

/** Decorative, non-interactive map behind the board. No markers — keeps the list scrolling smoothly. */
export default function LiveMapBackdrop({
  lat,
  lon,
}: {
  lat: number;
  lon: number;
}) {
  if (Platform.OS === 'web') return null;

  const region = {
    latitude: lat,
    longitude: lon,
    latitudeDelta: 20,
    longitudeDelta: 20,
  };

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <MapView
        style={styles.map}
        region={region}
        mapType={Platform.OS === 'ios' ? 'satellite' : 'standard'}
        customMapStyle={DARK_MAP_STYLE}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
        moveOnMarkerPress={false}
        showsUserLocation={false}
        showsCompass={false}
        showsScale={false}
        showsTraffic={false}
        showsIndoors={false}
        loadingEnabled={false}
      />
      <View style={styles.dim} />
    </View>
  );
}

const FILL = { position: 'absolute' as const, top: 0, left: 0, right: 0, bottom: 0 };

const styles = StyleSheet.create({
  map: {
    ...FILL,
    opacity: 0.4,
  },
  dim: {
    ...FILL,
    backgroundColor: 'rgba(10, 14, 26, 0.6)',
  },
});
