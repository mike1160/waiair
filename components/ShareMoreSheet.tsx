import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GlobeHemisphereWest } from 'phosphor-react-native';
import {
  ALL_MORE_PLATFORMS,
  PLATFORM_META,
  type QuickSharePlatform,
} from '../lib/flightQuickShare';
import { t } from '../lib/i18n';
import { InstagramGradientBg, SocialBrandIcon } from './SocialBrandIcons';

function MorePlatformButton({
  platform,
  onPress,
}: {
  platform: QuickSharePlatform;
  onPress: () => void;
}) {
  const meta = PLATFORM_META[platform];
  const isGradient = platform === 'instagram';
  const lightBg = platform === 'snapchat' || platform === 'kakaotalk';

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={onPress}
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
        style={[styles.label, lightBg && styles.labelDark]}
        numberOfLines={1}
      >
        {meta.label}
      </Text>
    </TouchableOpacity>
  );
}

export default function ShareMoreSheet({
  visible,
  onClose,
  onPlatform,
  onNativeShare,
  onLiveShare,
}: {
  visible: boolean;
  onClose: () => void;
  onPlatform: (platform: QuickSharePlatform) => void;
  onNativeShare: () => void;
  onLiveShare?: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Share via</Text>
          <ScrollView
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {onLiveShare ? (
              <TouchableOpacity
                style={styles.item}
                onPress={() => {
                  onClose();
                  onLiveShare();
                }}
                accessibilityRole="button"
                accessibilityLabel={t().shareLiveLink}
              >
                <View style={[styles.iconCircle, styles.liveCircle]}>
                  <GlobeHemisphereWest size={22} color="#0F1728" weight="fill" />
                </View>
                <Text style={[styles.label, styles.labelDark]} numberOfLines={1}>
                  {t().shareAsLiveLink}
                </Text>
              </TouchableOpacity>
            ) : null}
            {ALL_MORE_PLATFORMS.map(platform => (
              <MorePlatformButton
                key={platform}
                platform={platform}
                onPress={() => {
                  onClose();
                  onPlatform(platform);
                }}
              />
            ))}
            <TouchableOpacity
              style={styles.item}
              onPress={() => {
                onClose();
                onNativeShare();
              }}
              accessibilityRole="button"
              accessibilityLabel="Share sheet"
            >
              <View style={[styles.iconCircle, styles.nativeCircle]}>
                <Ionicons
                  name={Platform.OS === 'ios' ? 'share-outline' : 'share-social-outline'}
                  size={22}
                  color="#fff"
                />
              </View>
              <Text style={styles.label} numberOfLines={1}>
                {Platform.OS === 'ios' ? 'Share Sheet' : 'Share'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#121826',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 16,
    maxHeight: '72%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 4,
    paddingBottom: 8,
  },
  item: {
    alignItems: 'center',
    width: '25%',
    marginBottom: 14,
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
  nativeCircle: {
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  liveCircle: {
    backgroundColor: '#FFD700',
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.45)',
  },
  iconInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 72,
  },
  labelDark: {
    color: 'rgba(255,255,255,0.88)',
  },
});
