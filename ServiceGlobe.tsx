import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X } from 'phosphor-react-native';
import { TILE_GOLD } from './lib/affiliateBrands';
import { runWhileAppActive } from './lib/appActivity';
import {
  CATEGORIES,
  GLOBE_SERVICES,
  globeInkColor,
  openGlobeService,
  servicesByCategory,
  type GlobeCategory,
  type GlobeService,
  type GlobeServiceCtx,
} from './lib/globeServices';

const CANVAS = 280;
const RADIUS = 110;
const CENTER = CANVAS / 2;
const PERSPECTIVE = 380;
const ROTATE_STEP = 0.004;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const SIZE_MIN = 28;
const SIZE_MAX = 48;
const OPACITY_MIN = 0.3;
const OPACITY_MAX = 1;
const FRONT_SCALE = 0.8;
const SECTION_BG = '#0A1628';
const NAVY = '#0A1628';
const PAUSE_MS = 5000;
const PAUSE_GROW = 1.2;

type UnitPoint = { x: number; y: number; z: number };

type ProjectedDot = {
  service: GlobeService;
  left: number;
  top: number;
  size: number;
  opacity: number;
  z: number;
  scale: number;
  labelOpacity: number;
};

function fibonacciSphere(count: number): UnitPoint[] {
  if (count <= 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * i;
    return {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    };
  });
}

function projectDots(points: UnitPoint[], angle: number): ProjectedDot[] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dots: ProjectedDot[] = points.map((p, i) => {
    const x = p.x * cos + p.z * sin;
    const z = -p.x * sin + p.z * cos;
    const depth = (z + 1) / 2;
    const persp = PERSPECTIVE / (PERSPECTIVE - z * RADIUS);
    const size = SIZE_MIN + (SIZE_MAX - SIZE_MIN) * depth;
    const sx = CENTER + x * RADIUS * persp;
    const sy = CENTER + p.y * RADIUS * persp;
    const scale = depth;
    const labelOpacity = scale <= FRONT_SCALE ? 0 : (scale - FRONT_SCALE) / (1 - FRONT_SCALE);
    return {
      service: GLOBE_SERVICES[i],
      left: sx - size / 2,
      top: sy - size / 2,
      size,
      opacity: OPACITY_MIN + (OPACITY_MAX - OPACITY_MIN) * depth,
      z,
      scale,
      labelOpacity,
    };
  });
  dots.sort((a, b) => a.z - b.z);
  return dots;
}

function displayGeom(dot: ProjectedDot, expanded: boolean) {
  const grow = expanded ? PAUSE_GROW : 1;
  const displaySize = dot.size * grow;
  return {
    displaySize,
    displayLeft: dot.left - (displaySize - dot.size) / 2,
    displayTop: dot.top - (displaySize - dot.size) / 2,
  };
}

function GlobeDot({
  dot,
  expanded,
  onPress,
}: {
  dot: ProjectedDot;
  expanded: boolean;
  onPress: (service: GlobeService) => void;
}) {
  const { service, opacity, z } = dot;
  const ink = globeInkColor(service.color);
  const zIndex = Math.round((z + 1) * 100);
  const { displaySize, displayLeft, displayTop } = displayGeom(dot, expanded);
  const displayOpacity = expanded ? 1 : opacity;

  return (
    <Pressable
      onPress={() => onPress(service)}
      pointerEvents={expanded ? 'auto' : 'none'}
      accessibilityRole="button"
      accessibilityLabel={`${service.name}, ${CATEGORIES[service.category].label}, meer`}
      style={[
        styles.dot,
        {
          left: displayLeft,
          top: displayTop,
          width: displaySize,
          height: displaySize,
          borderRadius: displaySize / 2,
          backgroundColor: service.color,
          opacity: displayOpacity,
          zIndex,
        },
      ]}
    >
      <Text style={[styles.initials, { color: ink, fontSize: Math.max(9, displaySize * 0.28) }]}>
        {service.initials}
      </Text>
    </Pressable>
  );
}

function GlobeTips({ dots, expanded }: { dots: ProjectedDot[]; expanded: boolean }) {
  return dots.map(dot => {
    if (dot.labelOpacity <= 0.02) return null;
    const { displaySize, displayLeft, displayTop } = displayGeom(dot, expanded);
    return (
      <View
        key={`tip-${dot.service.key}`}
        pointerEvents="none"
        style={[
          styles.tip,
          {
            left: displayLeft + displaySize / 2 - 60,
            top: displayTop + displaySize + 4,
            opacity: expanded ? 1 : dot.labelOpacity,
          },
        ]}
      >
        <Text style={styles.tipName} numberOfLines={1}>{dot.service.name}</Text>
        <Text style={styles.tipCat} numberOfLines={1}>
          {CATEGORIES[dot.service.category].label}
        </Text>
        <Text style={styles.tipMore}>meer →</Text>
      </View>
    );
  });
}

function CategorySheet({
  category,
  ctx,
  onClose,
}: {
  category: GlobeCategory;
  ctx?: GlobeServiceCtx;
  onClose: () => void;
}) {
  const items = servicesByCategory(category, ctx);
  const title = CATEGORIES[category].label;

  return (
    <Modal visible animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>
          <View style={styles.handle} />
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Sluiten"
              style={styles.closeBtn}
            >
              <X size={18} color="#FFFFFF" weight="bold" />
            </Pressable>
          </View>
          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetList}
            showsVerticalScrollIndicator={false}
          >
            {items.map(service => (
              <Pressable
                key={`${category}-${service.key}`}
                onPress={() => {
                  onClose();
                  void openGlobeService(service, ctx);
                }}
                accessibilityRole="button"
                accessibilityLabel={service.name}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              >
                <View style={[styles.rowDot, { backgroundColor: service.color }]}>
                  <Text style={[styles.rowInitials, { color: globeInkColor(service.color) }]}>
                    {service.initials}
                  </Text>
                </View>
                <Text style={styles.rowName}>{service.name}</Text>
                <Text style={styles.rowChevron}>→</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default function ServiceGlobe({ ctx }: { ctx?: GlobeServiceCtx }) {
  const rest = useMemo(() => fibonacciSphere(GLOBE_SERVICES.length), []);
  const angleRef = useRef(0);
  const pausedRef = useRef(false);
  const ignoreBgRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [paused, setPaused] = useState(false);
  const [dots, setDots] = useState(() => projectDots(rest, 0));
  const [openCategory, setOpenCategory] = useState<GlobeCategory | null>(null);

  const clearIdleTimer = () => {
    if (idleTimer.current != null) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }
  };

  const resumeNow = () => {
    clearIdleTimer();
    pausedRef.current = false;
    setPaused(false);
  };

  const armIdleTimer = () => {
    clearIdleTimer();
    idleTimer.current = setTimeout(() => {
      idleTimer.current = null;
      pausedRef.current = false;
      setPaused(false);
    }, PAUSE_MS);
  };

  const enterPause = () => {
    pausedRef.current = true;
    setPaused(true);
    armIdleTimer();
  };

  useEffect(() => {
    return runWhileAppActive(() => {
      let raf = 0;
      const tick = () => {
        if (!pausedRef.current) {
          angleRef.current += ROTATE_STEP;
          setDots(projectDots(rest, angleRef.current));
        }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    });
  }, [rest]);

  useEffect(() => () => clearIdleTimer(), []);

  const onDot = (service: GlobeService) => {
    ignoreBgRef.current = true;
    if (!pausedRef.current) {
      enterPause();
      return;
    }
    armIdleTimer();
    setOpenCategory(service.category);
  };

  const closeSheet = () => {
    setOpenCategory(null);
    if (pausedRef.current) armIdleTimer();
  };

  const onGlobeBg = () => {
    if (ignoreBgRef.current) {
      ignoreBgRef.current = false;
      return;
    }
    if (openCategory) return;
    if (!pausedRef.current) enterPause();
    else resumeNow();
  };

  return (
    <View style={styles.wrap}>
      <View pointerEvents="none" style={styles.wrapFill} />
      <View style={styles.canvas}>
        <Pressable
          onPress={onGlobeBg}
          accessibilityRole="button"
          accessibilityLabel={paused ? 'Hervat globe' : 'Pauzeer globe'}
          style={StyleSheet.absoluteFill}
          android_ripple={{ color: 'transparent' }}
        />
        {dots.map(dot => (
          <GlobeDot
            key={dot.service.key}
            dot={dot}
            expanded={paused}
            onPress={onDot}
          />
        ))}
        <GlobeTips dots={dots} expanded={paused} />
      </View>
      {openCategory ? (
        <CategorySheet category={openCategory} ctx={ctx} onClose={closeSheet} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingBottom: 52,
    backgroundColor: SECTION_BG,
  },
  wrapFill: {
    ...StyleSheet.absoluteFill,
    backgroundColor: SECTION_BG,
  },
  canvas: {
    width: CANVAS,
    height: CANVAS,
    overflow: 'visible',
    alignSelf: 'center',
  },
  dot: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  tip: {
    position: 'absolute',
    width: 120,
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 9999,
  },
  tipName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  tipCat: {
    color: TILE_GOLD,
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 1,
  },
  tipMore: {
    color: TILE_GOLD,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: NAVY,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 10,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    paddingHorizontal: 16,
    maxHeight: '72%',
    borderWidth: 1,
    borderColor: 'rgba(201,168,76,0.28)',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 12,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sheetTitle: {
    color: TILE_GOLD,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    maxHeight: 420,
  },
  sheetList: {
    gap: 6,
    paddingBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  rowPressed: {
    opacity: 0.72,
  },
  rowDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInitials: {
    fontSize: 11,
    fontWeight: '800',
  },
  rowName: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  rowChevron: {
    color: TILE_GOLD,
    fontSize: 14,
    fontWeight: '700',
  },
});
