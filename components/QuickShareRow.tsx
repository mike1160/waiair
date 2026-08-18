import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlobeHemisphereWest } from 'phosphor-react-native';
import { haptics } from '../lib/haptics';
import {
  buildFlightShareMessage,
  getQuickSharePlatforms,
  PLATFORM_META,
  shareFlightMore,
  shareFlightToPlatform,
  shareTextMore,
  shareTextToPlatform,
  type QuickSharePlatform,
} from '../lib/flightQuickShare';
import { t } from '../lib/i18n';
import type { NextFlightShareData } from '../MyNextFlightShare';
import ShareMoreSheet from './ShareMoreSheet';
import { InstagramGradientBg, SocialBrandIcon } from './SocialBrandIcons';

type FlightProps = {
  mode?: 'flight';
  data: NextFlightShareData;
  status?: string;
  message?: never;
  captureImage: () => Promise<string | null>;
  ready: boolean;
};

type TextProps = {
  mode: 'text';
  message: string;
  data?: never;
  status?: never;
  captureImage?: never;
  ready?: boolean;
};

type CommonProps = {
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onLiveShare?: () => void;
  shareMessage?: string;
  compact?: boolean;
  showLabels?: boolean;
  showMore?: boolean;
};

type Props = (FlightProps | TextProps) & CommonProps;

function PlatformButton({
  platform,
  disabled,
  onPress,
  compact,
  showLabels,
}: {
  platform: QuickSharePlatform;
  disabled: boolean;
  onPress: () => void;
  compact?: boolean;
  showLabels?: boolean;
}) {
  const meta = PLATFORM_META[platform];
  const isGradient = platform === 'instagram';
  const darkLabel = platform === 'kakaotalk' || platform === 'snapchat';
  const circleSize = compact ? 34 : 44;
  const iconSize = compact ? (platform === 'x' ? 14 : 18) : (platform === 'x' ? 18 : 22);

  return (
    <TouchableOpacity
      style={[styles.item, compact && styles.itemCompact]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={meta.label}
    >
      <View
        style={[
          styles.iconCircle,
          compact && styles.iconCircleCompact,
          !isGradient && { backgroundColor: meta.bg },
          platform === 'kakaotalk' && styles.kakaoCircle,
          { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
        ]}
      >
        {isGradient ? <InstagramGradientBg size={circleSize} /> : null}
        <View style={styles.iconInner}>
          <SocialBrandIcon platform={platform} size={iconSize} />
        </View>
      </View>
      {showLabels !== false ? (
        <Text
          style={[styles.label, compact && styles.labelCompact, darkLabel && styles.labelDark]}
          numberOfLines={1}
        >
          {meta.label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

export default function QuickShareRow(props: Props) {
  const {
    busy,
    onBusy,
    onLiveShare,
    shareMessage: shareMessageOverride,
    compact = false,
    showLabels,
    showMore = true,
  } = props;

  const isTextMode = props.mode === 'text';
  const ready = isTextMode ? (props.ready ?? true) : props.ready;
  const [moreOpen, setMoreOpen] = useState(false);

  const platforms = useMemo(() => getQuickSharePlatforms(), []);
  const message = useMemo(() => {
    if (shareMessageOverride) return shareMessageOverride;
    if (isTextMode) return props.message;
    return buildFlightShareMessage(props.data, props.status);
  }, [isTextMode, props, shareMessageOverride]);

  const runImageShare = async (share: (uri: string, msg: string) => Promise<void>) => {
    if (!ready || busy || isTextMode || !props.captureImage) return;
    onBusy(true);
    haptics.light();
    try {
      const uri = await props.captureImage();
      if (!uri) {
        console.warn('[Share] capture returned null — text-only fallback');
        await shareTextMore(message);
        return;
      }
      await share(uri, message);
    } catch {
      haptics.error();
    } finally {
      onBusy(false);
    }
  };

  const runTextShare = async (share: (msg: string) => Promise<void>) => {
    if (!ready || busy) return;
    onBusy(true);
    haptics.light();
    try {
      await share(message);
    } catch {
      haptics.error();
    } finally {
      onBusy(false);
    }
  };

  const onPlatform = (platform: QuickSharePlatform) => {
    if (isTextMode) {
      return runTextShare(msg => shareTextToPlatform(platform, msg));
    }
    return runImageShare((uri, msg) => shareFlightToPlatform(platform, uri, msg));
  };

  const onMore = () => {
    if (!ready || busy) return;
    haptics.light();
    setMoreOpen(true);
  };

  const onMorePlatform = (platform: QuickSharePlatform) => onPlatform(platform);

  const onNativeShare = () => {
    if (isTextMode) {
      return runTextShare(shareTextMore);
    }
    return runImageShare(shareFlightMore);
  };

  const onLive = () => {
    if (!ready || busy || !onLiveShare) return;
    haptics.light();
    onLiveShare();
  };

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={styles.row}>
        {onLiveShare && !isTextMode ? (
          <TouchableOpacity
            style={[styles.item, compact && styles.itemCompact]}
            onPress={onLive}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel={t().shareLiveLink}
          >
            <View
              style={[
                styles.iconCircle,
                styles.liveCircle,
                compact && styles.iconCircleCompact,
                compact && { width: 34, height: 34, borderRadius: 17 },
              ]}
            >
              <GlobeHemisphereWest
                size={compact ? 18 : 22}
                color="#0A0E1A"
                weight="fill"
              />
            </View>
            {showLabels !== false ? (
              <Text style={[styles.label, compact && styles.labelCompact, styles.labelDark]} numberOfLines={1}>
                {t().shareAsLiveLink}
              </Text>
            ) : null}
          </TouchableOpacity>
        ) : null}
        {platforms.map(platform => (
          <PlatformButton
            key={platform}
            platform={platform}
            disabled={!ready || busy}
            onPress={() => onPlatform(platform)}
            compact={compact}
            showLabels={showLabels}
          />
        ))}
        {showMore ? (
          <TouchableOpacity
            style={[styles.item, compact && styles.itemCompact]}
            onPress={onMore}
            disabled={!ready || busy}
            accessibilityRole="button"
            accessibilityLabel="More"
          >
            <View
              style={[
                styles.iconCircle,
                styles.moreCircle,
                compact && styles.iconCircleCompact,
                compact && { width: 34, height: 34, borderRadius: 17 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons
                  name={Platform.OS === 'ios' ? 'ellipsis-horizontal-circle' : 'ellipsis-horizontal-circle-outline'}
                  size={compact ? 20 : 26}
                  color="#fff"
                />
              )}
            </View>
            {showLabels !== false ? (
              <Text style={[styles.label, compact && styles.labelCompact]}>More •••</Text>
            ) : null}
          </TouchableOpacity>
        ) : null}
      </View>

      <ShareMoreSheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        onPlatform={onMorePlatform}
        onNativeShare={onNativeShare}
        onLiveShare={onLiveShare && !isTextMode ? onLive : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingHorizontal: 12,
    marginTop: 14,
  },
  wrapCompact: {
    marginTop: 10,
    paddingHorizontal: 0,
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
  itemCompact: {
    width: 48,
    gap: 0,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  iconCircleCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  liveCircle: {
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.45)',
  },
  label: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 64,
  },
  labelCompact: {
    fontSize: 9,
    maxWidth: 48,
    color: 'rgba(255,255,255,0.65)',
  },
  labelDark: {
    color: 'rgba(255,255,255,0.88)',
  },
});
