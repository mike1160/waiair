import Svg, { Circle, Rect, Text as SvgText } from 'react-native-svg';

export const PASS_CREAM = '#F5F0E4';
export const PASS_NAVY = '#1a2f4a';
export const PASS_GOLD = '#C9A84C';
export const PASS_BG = '#0D1B2E';

/** Frame 1 — whole cream/navy/gold boarding pass. Static, for header / tabs. */
export function BoardingPassMark({
  w = 40,
  h = 24,
  showText = true,
}: {
  w?: number;
  h?: number;
  showText?: boolean;
}) {
  const holes = [10, 18, 26, 34, 42, 50, 58, 66, 74];
  return (
    <Svg width={w} height={h} viewBox="0 0 80 48">
      <Rect x="1" y="1" width="78" height="46" rx="8" fill={PASS_CREAM} />
      <Rect x="1" y="1" width="78" height="17" rx="8" fill={PASS_NAVY} />
      <Rect x="1" y="10" width="78" height="8" fill={PASS_NAVY} />
      {holes.map(x => (
        <Circle key={x} cx={x} cy={19} r="1.6" fill={PASS_GOLD} />
      ))}
      {showText ? (
        <>
          <SvgText
            x="40"
            y="13"
            fill={PASS_GOLD}
            fontSize="8"
            fontWeight="800"
            textAnchor="middle"
          >
            BKK → AMS
          </SvgText>
          <SvgText
            x="40"
            y="32"
            fill={PASS_NAVY}
            fontSize="5.5"
            fontWeight="700"
            textAnchor="middle"
          >
            YOU
          </SvgText>
          <SvgText
            x="40"
            y="41"
            fill={PASS_NAVY}
            fontSize="5.5"
            fontWeight="700"
            textAnchor="middle"
          >
            GATE B4
          </SvgText>
        </>
      ) : null}
    </Svg>
  );
}

export const BOARDING_PASS_ICON = require('./assets/images/boarding-pass-icon.png');
