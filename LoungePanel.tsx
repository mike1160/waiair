import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated, Linking, Platform, Pressable, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { ArrowRight, CaretRight, Check, Lightning } from 'phosphor-react-native';
import {
  ALLIANCE_STATUS,
  LOUNGE_CARDS,
  TICKET_CLASSES,
  canAccessFastTrack,
  canAccessLounge,
  defaultLoungeAccess,
  fastTrackFor,
  loadLoungeAccess,
  loungesFor,
  saveLoungeAccess,
  type FastTrackLane,
  type Lounge,
  type LoungeAccessPrefs,
} from './data/lounges';
import { t } from './lib/i18n';
import { loungeBuddyUrl, openAffiliateUrl } from './lib/affiliateConfig';

type ThemeBits = {
  text: string;
  secondary: string;
  muted: string;
  accent: string;
  border: string;
  card: string;
  list: string;
};

type Props = {
  iata?: string;
  airlineIata?: string;
  theme: ThemeBits;
  embedded?: boolean;
};

function Chip({
  label, on, onPress, theme,
}: { label: string; on: boolean; onPress: () => void; theme: ThemeBits }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: on ? theme.accent : theme.border, backgroundColor: on ? `${theme.accent}22` : theme.list },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
    >
      <Text style={[styles.chipTxt, { color: on ? theme.accent : theme.secondary }]}>{label}</Text>
    </Pressable>
  );
}

function openMap(name: string, lat?: number, lng?: number) {
  if (lat == null || lng == null) return;
  const q = encodeURIComponent(name);
  const url = Platform.select({
    ios: `https://maps.apple.com/?ll=${lat},${lng}&q=${q}`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  });
  Linking.openURL(url).catch(() => {});
}

function LoungeRow({
  lounge, accessible, theme, expanded, onToggle,
}: {
  lounge: Lounge;
  accessible: boolean;
  theme: ThemeBits;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={[styles.item, { borderColor: theme.border, backgroundColor: theme.list }]}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: theme.text }]}>{lounge.name} · {lounge.terminal}</Text>
          {lounge.airline ? (
            <Text style={[styles.itemMeta, { color: theme.secondary }]}>{lounge.airline}</Text>
          ) : null}
          <Text style={[styles.itemMeta, { color: theme.muted }]}>{t().openHours(lounge.hours)}</Text>
        </View>
        {accessible ? (
          <View style={[styles.yes, { backgroundColor: `${theme.accent}22` }]}>
            <Check size={12} color={theme.accent} weight="bold" />
            <Text style={[styles.yesTxt, { color: theme.accent }]}>{t().youCanEnter}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.tags}>
        {lounge.access.map(tag => (
          <Text key={tag} style={[styles.tag, { color: theme.secondary }]}>✓ {tag}</Text>
        ))}
      </View>
      <Text style={[styles.amen, { color: theme.muted }]}>{lounge.amenities.join(' · ')}</Text>
      <TouchableOpacity
        onPress={() => {
          if (lounge.lat != null && lounge.lng != null) openMap(lounge.name, lounge.lat, lounge.lng);
          else onToggle();
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t().viewDetailsFor(lounge.name)}
      >
        <View style={styles.detailsRow}>
          <Text style={[styles.details, { color: theme.accent }]}>{t().viewDetails}</Text>
          <ArrowRight size={12} color={theme.accent} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => { void openAffiliateUrl(loungeBuddyUrl()); }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t().bookLoungeAccess}
      >
        <View style={styles.detailsRow}>
          <Text style={[styles.details, { color: theme.accent }]}>{t().bookLoungeAccess}</Text>
          <ArrowRight size={12} color={theme.accent} />
        </View>
      </TouchableOpacity>
      {expanded && (lounge.lat == null || lounge.lng == null) ? (
        <Text style={[styles.itemMeta, { color: theme.secondary, marginTop: 6 }]}>
          {lounge.airline ? `${lounge.airline} · ` : ''}{lounge.terminal} · {lounge.hours}
          {'\n'}{lounge.access.join(' · ')}
          {'\n'}{lounge.amenities.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

function FastRow({
  lane, accessible, theme,
}: { lane: FastTrackLane; accessible: boolean; theme: ThemeBits }) {
  return (
    <View style={[styles.item, { borderColor: theme.border, backgroundColor: theme.list }]}>
      <View style={styles.itemTop}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.itemName, { color: theme.text }]}>{lane.name} · {lane.terminal}</Text>
          <Text style={[styles.itemMeta, { color: theme.muted }]}>{lane.hours}</Text>
        </View>
        {accessible ? (
          <View style={[styles.yes, { backgroundColor: `${theme.accent}22` }]}>
            <Check size={12} color={theme.accent} weight="bold" />
            <Text style={[styles.yesTxt, { color: theme.accent }]}>{t().likely}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.amen, { color: theme.secondary }]}>{lane.access.join(' · ')}</Text>
      {lane.notes ? <Text style={[styles.itemMeta, { color: theme.muted }]}>{lane.notes}</Text> : null}
    </View>
  );
}

export default function LoungePanel({ iata, airlineIata, theme, embedded = false }: Props) {
  const code = String(iata || '').toUpperCase();
  const lounges = loungesFor(code);
  const lanes = fastTrackFor(code);
  const [prefs, setPrefs] = useState<LoungeAccessPrefs>(defaultLoungeAccess);
  const [listOpen, setListOpen] = useState(false);
  const [checker, setChecker] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const listH = useRef(new Animated.Value(0)).current;
  const listChevron = useRef(new Animated.Value(0)).current;
  const measuredList = useRef(0);

  useEffect(() => {
    loadLoungeAccess().then(p => {
      setPrefs(p);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    Animated.timing(listH, {
      toValue: listOpen ? measuredList.current : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
    Animated.timing(listChevron, {
      toValue: listOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [listOpen, listH, listChevron]);

  if (!code || (!lounges.length && !lanes.length)) return null;

  const patch = (next: Partial<LoungeAccessPrefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    saveLoungeAccess(merged).catch(() => {});
  };

  const yours = lounges.filter(l => canAccessLounge(l, prefs, airlineIata));
  const listRotate = listChevron.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });

  return (
    <View style={[
      styles.card,
      { backgroundColor: embedded ? 'transparent' : theme.card, borderColor: theme.border },
      embedded && styles.embedded,
    ]}>
      <View style={[styles.body, embedded && styles.bodyEmbedded]}>
          <Pressable
            onPress={() => setListOpen(v => !v)}
            style={styles.accHead}
            accessibilityRole="button"
            accessibilityState={{ expanded: listOpen }}
            accessibilityLabel={t().loungesTitle}
          >
            <Text style={[styles.checkerLink, styles.accHint, { color: theme.accent }]}>
              What can I access?
            </Text>
            <Animated.View style={{ transform: [{ rotate: listRotate }] }}>
              <CaretRight size={16} color={theme.muted} />
            </Animated.View>
          </Pressable>

          <Animated.View style={{ height: listH, overflow: 'hidden' }}>
            <View
              collapsable={false}
              style={styles.accBody}
              onLayout={e => {
                const h = e.nativeEvent.layout.height;
                if (h <= 0) return;
                measuredList.current = h;
                if (listOpen) listH.setValue(h);
              }}
            >
              <TouchableOpacity onPress={() => setChecker(v => !v)} hitSlop={6}>
                <Text style={[styles.checkerLink, { color: theme.accent }]}>
                  {checker ? 'Hide access checker' : 'What can I access?'}
                </Text>
              </TouchableOpacity>

              {checker ? (
                <View style={styles.checker}>
                  <Text style={[styles.lbl, { color: theme.muted }]}>{t().creditCard}</Text>
                  <View style={styles.chips}>
                    {LOUNGE_CARDS.map(c => (
                      <Chip key={c.id} label={c.label} on={prefs.card === c.id} onPress={() => patch({ card: c.id })} theme={theme} />
                    ))}
                  </View>
                  <Text style={[styles.lbl, { color: theme.muted }]}>{t().airlineStatus}</Text>
                  <View style={styles.chips}>
                    {ALLIANCE_STATUS.map(c => (
                      <Chip key={c.id} label={c.label} on={prefs.status === c.id} onPress={() => patch({ status: c.id })} theme={theme} />
                    ))}
                  </View>
                  <Text style={[styles.lbl, { color: theme.muted }]}>{t().ticketClass}</Text>
                  <View style={styles.chips}>
                    {TICKET_CLASSES.map(c => (
                      <Chip key={c.id} label={c.label} on={prefs.ticket === c.id} onPress={() => patch({ ticket: c.id })} theme={theme} />
                    ))}
                  </View>
                  {!ready ? <ActivityIndicator color={theme.accent} /> : (
                    <Text style={[styles.summary, { color: theme.text }]}>
                      {yours.length
                        ? `You can access these lounges: ${yours.map(l => l.name).join(', ')}`
                        : 'No matching lounges with this access — list below is still visible.'}
                    </Text>
                  )}
                </View>
              ) : null}

              {lounges.map(lounge => (
                <LoungeRow
                  key={lounge.name}
                  lounge={lounge}
                  accessible={canAccessLounge(lounge, prefs, airlineIata)}
                  theme={theme}
                  expanded={expanded === lounge.name}
                  onToggle={() => setExpanded(e => e === lounge.name ? null : lounge.name)}
                />
              ))}

              {lanes.length ? (
                <View style={styles.fastHead}>
                  <Lightning size={14} color={theme.accent} />
                  <Text style={[styles.fastTitle, { color: theme.text }]}>{t().fastTrack}</Text>
                </View>
              ) : null}
              {lanes.map(lane => (
                <FastRow
                  key={lane.name}
                  lane={lane}
                  accessible={canAccessFastTrack(lane, prefs, airlineIata)}
                  theme={theme}
                />
              ))}
            </View>
          </Animated.View>
        </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginTop: 10 },
  embedded: { borderWidth: 0, marginTop: 0, borderRadius: 0 },
  body: { paddingHorizontal: 14, paddingBottom: 14, gap: 10 },
  bodyEmbedded: { paddingHorizontal: 0, paddingBottom: 4 },
  accHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  loungesGold: {
    fontSize: 13,
    fontWeight: '600',
    color: '#C9A84C',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  accHint: { flex: 1, marginBottom: 0 },
  accBody: { position: 'absolute', left: 0, right: 0, gap: 10 },
  checkerLink: { fontSize: 13, fontWeight: '700', marginBottom: 4 },
  checker: { gap: 8, marginBottom: 4 },
  lbl: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipTxt: { fontSize: 11, fontWeight: '700' },
  summary: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: 4 },
  item: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemName: { fontSize: 14, fontWeight: '800' },
  itemMeta: { fontSize: 12, fontWeight: '500', marginTop: 2, lineHeight: 16 },
  tags: { gap: 2, marginTop: 4 },
  tag: { fontSize: 12, fontWeight: '600' },
  amen: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  detailsRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  details: { fontSize: 13, fontWeight: '800' },
  yes: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  yesTxt: { fontSize: 10, fontWeight: '800' },
  fastHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  fastTitle: { fontSize: 14, fontWeight: '800' },
});
