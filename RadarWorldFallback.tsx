import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import {
  FLIGHT_MAP_CONTINENTS,
  FLIGHT_MAP_GRATICULE,
  FLIGHT_MAP_GRATICULES,
  FLIGHT_MAP_LAND_FILL,
  FLIGHT_MAP_LAND_STROKE,
  FLIGHT_MAP_OCEAN,
  FLIGHT_MAP_VIEW_H,
  FLIGHT_MAP_VIEW_W,
} from './lib/flightMapWorld';

export default function RadarWorldFallback({ message = 'Live radar unavailable' }: { message?: string }) {
  return (
    <View style={st.root}>
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${FLIGHT_MAP_VIEW_W} ${FLIGHT_MAP_VIEW_H}`}
        preserveAspectRatio="xMidYMid slice"
      >
        <Rect width={FLIGHT_MAP_VIEW_W} height={FLIGHT_MAP_VIEW_H} fill={FLIGHT_MAP_OCEAN} />
        {FLIGHT_MAP_GRATICULES.map((d, i) => (
          <Path
            key={`g-${i}`}
            d={d}
            stroke={FLIGHT_MAP_GRATICULE}
            strokeWidth={0.5}
            fill="none"
          />
        ))}
        {FLIGHT_MAP_CONTINENTS.map((d, i) => (
          <Path
            key={`c-${i}`}
            d={d}
            fill={FLIGHT_MAP_LAND_FILL}
            stroke={FLIGHT_MAP_LAND_STROKE}
            strokeWidth={0.5}
          />
        ))}
      </Svg>
      <View style={st.labelWrap} pointerEvents="none">
        <Text style={st.label}>{message}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    backgroundColor: FLIGHT_MAP_OCEAN,
  },
  labelWrap: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 12,
    color: '#555555',
    fontWeight: '500',
    textAlign: 'center',
  },
});
