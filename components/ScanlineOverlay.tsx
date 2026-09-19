/**
 * Airport mode's CRT scanlines: a 1px dark line every 4px over the whole screen, very faint.
 * React Native has no repeating gradient, so it is an SVG pattern. It never takes a touch (pointerEvents none)
 * and renders nothing outside airport mode.
 */
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Pattern, Rect } from 'react-native-svg';
import { useIsAirport } from '../lib/modeContext';

export default function ScanlineOverlay() {
  const airport = useIsAirport();
  if (!airport) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.layer]}>
      <Svg width="100%" height="100%">
        <Defs>
          {/* transparent 0–3px, rgba(0,0,0,0.08) 3–4px, repeated */}
          <Pattern id="scan" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
            <Rect x="0" y="3" width="4" height="1" fill="#000000" fillOpacity={0.08} />
          </Pattern>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#scan)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { zIndex: 9000 },
});
