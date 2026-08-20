import { useEffect, useState } from 'react';
import { InteractionManager, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import {
  AE, AU, CH, CN, DE, ES, FR, GB, HK, ID, IN, IT, JP, KR, MY, NL, PH, QA, SG, TH, TR, US, VN,
} from 'country-flag-icons/string/3x2';
import { useAppForeground } from './lib/appActivity';
import { FLAG_ISO, type ThemeId } from './lib/themes';

const FLAG_XML: Record<string, string> = {
  NL, TH, JP, SG, DE, FR, GB, IT, CH, TR, AE, QA, CN, KR, IN, MY, ID, VN, PH, HK, AU, US, ES,
};

/** SVG country flag watermark — DOM flag components are not used (React Native needs SvgXml). */
export default function CountryFlagWatermark({ themeId }: { themeId: ThemeId }) {
  const code = FLAG_ISO[themeId];
  const xml = code ? FLAG_XML[code] : undefined;
  const [box, setBox] = useState({ w: 0, h: 0 });
  const appActive = useAppForeground();
  const [svgMounted, setSvgMounted] = useState(() => appActive);
  useEffect(() => {
    if (!appActive) {
      setSvgMounted(false);
      return;
    }
    const task = InteractionManager.runAfterInteractions(() => {
      setSvgMounted(true);
    });
    return () => {
      try { task.cancel?.(); } catch { /* ignore */ }
    };
  }, [appActive]);
  if (!xml) return null;

  const w = box.w * 1.2;
  const h = box.h;

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no"
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        setBox({ w: width, h: height });
      }}
      style={styles.wrap}
    >
      {svgMounted && w > 0 && h > 0 ? (
        <View
          style={[
            styles.flag,
            {
              width: w,
              height: h,
              left: -box.w * 0.1,
            },
          ]}
        >
          <SvgXml
            xml={xml}
            width={w}
            height={h}
            preserveAspectRatio="xMidYMid slice"
            opacity={0.12}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  flag: {
    position: 'absolute',
    top: 0,
    transform: [{ rotate: '-5deg' }],
  },
});
