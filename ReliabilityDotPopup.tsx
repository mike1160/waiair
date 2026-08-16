import { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AirlineReliabilitySnapshot } from './lib/delayHistory';
import { haptics } from './lib/haptics';
import { t } from './lib/i18n';

export type ReliabilityPopupAnchor = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const POPUP_BG = 'rgba(18, 22, 35, 0.97)';
const POPUP_BORDER = 'rgba(255,255,255,0.15)';
const GAP = 8;
const MIN_WIDTH = 220;
const EST_HEIGHT = 118;

export default function ReliabilityDotPopup({
  visible,
  anchor,
  snapshot,
  accentColor,
  onClose,
  onOpenFlight,
}: {
  visible: boolean;
  anchor: ReliabilityPopupAnchor | null;
  snapshot: AirlineReliabilitySnapshot;
  accentColor: string;
  onClose: () => void;
  onOpenFlight: () => void;
}) {
  const name = snapshot.name;
  const [cardSize, setCardSize] = useState({ width: MIN_WIDTH, height: EST_HEIGHT });

  useEffect(() => {
    if (!visible) setCardSize({ width: MIN_WIDTH, height: EST_HEIGHT });
  }, [visible]);

  const placement = useMemo(() => {
    if (!anchor) return null;
    const { width: sw, height: sh } = Dimensions.get('window');
    const w = Math.max(MIN_WIDTH, cardSize.width);
    const h = cardSize.height;
    let top = anchor.y - h - GAP;
    if (top < 12) top = anchor.y + anchor.height + GAP;
    if (top + h > sh - 12) top = Math.max(12, sh - h - 12);
    let left = anchor.x + anchor.width / 2 - w / 2;
    left = Math.max(12, Math.min(left, sw - w - 12));
    return { top, left, width: w };
  }, [anchor, cardSize]);

  const openFlight = () => {
    haptics.light();
    onClose();
    onOpenFlight();
  };

  if (!visible || !anchor || !placement) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          onPress={e => e.stopPropagation()}
          style={[
            styles.card,
            {
              top: placement.top,
              left: placement.left,
              minWidth: MIN_WIDTH,
              width: placement.width,
            },
          ]}
          onLayout={e => {
            const { width, height } = e.nativeEvent.layout;
            if (width !== cardSize.width || height !== cardSize.height) {
              setCardSize({ width, height });
            }
          }}
        >
          <Text style={styles.name} numberOfLines={2}>
            {name}
          </Text>
          <Text style={styles.pct}>{t().pctOnTime(snapshot.onTimePercent)}</Text>
          <Text style={styles.avg}>{t().avgMinLateWhenDelayed(snapshot.avgDelayWhenLate)}</Text>
          <TouchableOpacity
            onPress={openFlight}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={t().openFlightCompensationInfo}
          >
            <Text style={[styles.link, { color: accentColor }]}>
              {t().openFlightCompensationInfo}
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  card: {
    position: 'absolute',
    borderRadius: 16,
    padding: 16,
    backgroundColor: POPUP_BG,
    borderWidth: 0.5,
    borderColor: POPUP_BORDER,
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 4 },
    elevation: 12,
    gap: 5,
  },
  name: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
    marginBottom: 2,
  },
  pct: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  avg: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 17,
  },
  link: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 6,
    lineHeight: 16,
  },
});
