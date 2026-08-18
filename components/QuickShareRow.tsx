import { useMemo } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { haptics } from '../lib/haptics';
import {
  buildFlightShareMessage,
  getQuickSharePlatforms,
  PLATFORM_META,
  shareFlightMore,
  shareFlightToPlatform,
  type QuickSharePlatform,
} from '../lib/flightQuickShare';
import type { NextFlightShareData } from '../MyNextFlightShare';
import { InstagramGradientBg, SocialBrandIcon } from './SocialBrandIcons';

type Props = {
  data: NextFlightShareData;
  ready: boolean;
  busy: boolean;
  onBusy: (busy: boolean) => void;
  captureImage: () => Promise<string | null>;
  status?: string;
};

function PlatformButton({
  platform,
  disabled,
  onPress,
}: {
  platform: QuickSharePlatform;
  disabled: boolean;
  onPress: () => void;
}) {
  const meta = PLATFORM_META[platform];
  const isGradient = platform === 'instagram';
  const darkLabel = platform === 'kakaotalk';

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={meta.label}
    >
      <View
        style={[
          styles.iconCircle,
          !isGradient && { backgroundColor: meta.bg },
          platform === 'kakaotalk' && styles.kakaoCircle,
        ]}
      >
        {isGradient ? <InstagramGradientBg size={44} /> : null}
        <View style={styles.iconInner}>
          <SocialBrandIcon platform={platform} size={platform === 'x' ? 18 : 22} />
        </View>
      </View>
      <Text
        style={[styles.label, darkLabel && styles.labelDark]}
        numberOfLines={1}
      >
        {meta.label}
      </Text>
    </TouchableOpacity>
  );
}

export default function QuickShareRow({
  data,
  ready,
  busy,
  onBusy,
  captureImage,
  status,
}: Props) {
  const platforms = useMemo(() => getQuickSharePlatforms(), []);
  const message = useMemo(
    () => buildFlightShareMessage(data, status),
    [data, status],
  );

  const runShare = async (share: (uri: string, msg: string) => Promise<void>) => {
    if (!ready || busy) return;
    onBusy(true);
    haptics.light();
    try {
      const uri = await captureImage();
      if (!uri) {
        haptics.error();
        return;
      }
      await share(uri, message);
    } catch {
      haptics.error();
    } finally {
      onBusy(false);
    }
  };

  const onPlatform = (platform: QuickSharePlatform) =>
    runShare((uri, msg) => shareFlightToPlatform(platform, uri, msg));

  const onMore = () => runShare(shareFlightMore);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {platforms.map(platform => (
          <PlatformButton
            key={platform}
            platform={platform}
            disabled={!ready || busy}
            onPress={() => onPlatform(platform)}
          />
        ))}
        <TouchableOpacity
          style={styles.item}
          onPress={onMore}
          disabled={!ready || busy}
          accessibilityRole="button"
          accessibilityLabel="More"
        >
          <View style={[styles.iconCircle, styles.moreCircle]}>
            {busy ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons
                name={Platform.OS === 'ios' ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
                size={26}
                color="#fff"
              />
            )}
          </View>
          <Text style={styles.label}>More •••</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: 12,
    marginTop: 14,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-evenly',
  },
  item: {
    alignItems: 'center',
    width: 64,
    gap: 6,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  kakaoCircle: {
    borderWidth: 1,
    borderColor: 'rgba(60,30,30,0.12)',
  },
  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreCircle: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  label: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 64,
  },
  labelDark: {
    color: 'rgba(255,255,255,0.88)',
  },
});
