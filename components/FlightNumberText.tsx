import { Text, type StyleProp, type TextProps, type TextStyle } from 'react-native';

/** One-line flight ident: shrink the glyphs, never wrap ("OZ7 / 47"). */
export const FLIGHT_NUMBER_TEXT_PROPS = {
  numberOfLines: 1 as const,
  ellipsizeMode: 'clip' as const,
  adjustsFontSizeToFit: true,
  minimumFontScale: 0.55,
  allowFontScaling: false,
};

export function FlightNumberText({
  children,
  style,
  ...rest
}: TextProps & { style?: StyleProp<TextStyle> }) {
  return (
    <Text {...FLIGHT_NUMBER_TEXT_PROPS} style={style} {...rest}>
      {children}
    </Text>
  );
}
