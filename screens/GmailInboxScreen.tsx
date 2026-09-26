/**
 * The travel-mail inbox: everything Gmail found, and what became of it.
 *
 * The scan screen (GmailImportScreen) is still where mails are discovered — it is the moment of "look what
 * I found". This is where they live afterwards: three tabs, one per answer a booking can have, so nothing
 * disappears without the traveller deciding it should. Ignoring is not deleting, and a link can be undone.
 *
 * The reading, counting, filtering and the transitions all live in lib/gmailInbox.ts; this draws them.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { ArrowsClockwise, MagnifyingGlass, SortAscending, X } from 'phosphor-react-native';
import { t } from '../lib/i18n';
import { haptics } from '../lib/haptics';
import { KIND_ICON, kindLabel } from '../lib/gmailKinds';
import {
  INBOX_FILTERS,
  INBOX_TABS,
  inboxList,
  tabCounts,
  type InboxFilter,
  type InboxItem,
  type InboxSort,
  type InboxTab,
} from '../lib/gmailInbox';

/** A trip the sheet can offer, in the order they happen. */
export type InboxTrip = {
  key: string;
  /** "Bangkok", or the flight number when the destination is not known yet. */
  title: string;
  /** yyyy-MM-dd of the day it starts. */
  startYmd: string;
  flightNumber: string;
};

type Colors = { bg: string; card: string; text: string; muted: string; border: string; accent: string };

type Props = {
  visible: boolean;
  items: InboxItem[];
  trips: InboxTrip[];
  colors: Colors;
  /** Opens on this mail, from a "Via Gmail" badge on a trip. */
  focusMessageId?: string;
  onClose: () => void;
  onScanNow: () => void;
  onLink: (item: InboxItem, tripKey: string) => void;
  onIgnore: (item: InboxItem) => void;
  onUnlink: (item: InboxItem) => void;
  onDelete: (item: InboxItem) => void;
};

const FILTER_LABEL: Record<InboxFilter, keyof ReturnType<typeof t>> = {
  all: 'inboxFilterAll',
  flights: 'inboxFilterFlights',
  hotels: 'inboxFilterHotels',
  stay: 'inboxFilterStay',
  transport: 'inboxFilterTransport',
  activities: 'inboxFilterActivities',
  other: 'inboxFilterOther',
};

const TAB_LABEL: Record<InboxTab, 'inboxTabNew' | 'inboxTabLinked' | 'inboxTabIgnored'> = {
  new: 'inboxTabNew',
  linked: 'inboxTabLinked',
  ignored: 'inboxTabIgnored',
};

/** "10 Oct" — the day a booking is for, in the app's language. */
function dayLabel(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return '';
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' })
      .format(new Date(`${ymd}T12:00:00Z`));
  } catch {
    return ymd;
  }
}

export default function GmailInboxScreen({
  visible, items, trips, colors: C, focusMessageId,
  onClose, onScanNow, onLink, onIgnore, onUnlink, onDelete,
}: Props) {
  const copy = t();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<InboxTab>('new');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InboxFilter>('all');
  const [sort, setSort] = useState<InboxSort>('newest');
  const [linking, setLinking] = useState<InboxItem | null>(null);

  const counts = useMemo(() => tabCounts(items), [items]);
  const shown = useMemo(
    () => inboxList(items, { tab, query, filter, sort, kindLabel }),
    [items, tab, query, filter, sort],
  );
  const focused = focusMessageId || '';

  const tripByKey = useMemo(() => {
    const map = new Map<string, InboxTrip>();
    for (const trip of trips || []) map.set(trip.key, trip);
    return map;
  }, [trips]);

  const tripName = useCallback((key?: string) => {
    const trip = key ? tripByKey.get(key) : undefined;
    if (!trip) return key || '';
    const day = dayLabel(trip.startYmd);
    return day ? `${trip.title} · ${day}` : trip.title;
  }, [tripByKey]);

  const askDelete = useCallback((item: InboxItem) => {
    Alert.alert(copy.inboxDeleteConfirm, item.title || kindLabel(item.kind), [
      { text: copy.cancel, style: 'cancel' },
      { text: copy.inboxDelete, style: 'destructive', onPress: () => { haptics.medium(); onDelete(item); } },
    ]);
  }, [copy, onDelete]);

  const renderCard = (item: InboxItem) => {
    const day = dayLabel(item.startYmd);
    const details = [day, item.place].filter(Boolean).join(' · ');
    const isFocused = !!focused && item.messageId === focused;

    const card = (
      <View
        style={[
          st.card,
          { backgroundColor: C.card, borderColor: isFocused ? C.accent : C.border },
        ]}
      >
        <View style={st.cardTop}>
          <Text style={st.icon} allowFontScaling={false}>{KIND_ICON[item.kind]}</Text>
          <View style={st.cardBody}>
            <Text style={[st.kind, { color: C.muted }]}>{kindLabel(item.kind)}</Text>
            {item.title ? (
              <Text style={[st.title, { color: C.text }]} numberOfLines={1}>{item.title}</Text>
            ) : null}
            {details ? (
              <Text style={[st.detail, { color: C.muted }]} numberOfLines={1}>{details}</Text>
            ) : null}

            {tab === 'new' && item.suggestedFlightKey ? (
              <Text style={[st.suggest, { color: C.accent }]} numberOfLines={1}>
                {copy.inboxSuggestedFor(tripName(item.suggestedFlightKey))}
              </Text>
            ) : null}

            {tab === 'linked' ? (
              <Text style={[st.detail, { color: C.muted }]} numberOfLines={2}>
                {`${copy.inboxLinkedTo(tripName(item.linkedToTripKey))} · ${copy.inboxLinkedBy(
                  item.linkedBy === 'manual' ? copy.inboxLinkedByManual : copy.inboxLinkedByAuto,
                )}`}
              </Text>
            ) : null}

            {tab === 'ignored' && item.ignoredAt ? (
              <Text style={[st.detail, { color: C.muted }]}>{dayLabel(
                new Date(item.ignoredAt).toISOString().slice(0, 10),
              )}</Text>
            ) : null}
          </View>
          <Text style={[st.via, { color: C.muted }]} numberOfLines={1}>{copy.viaGmail}</Text>
        </View>

        <View style={st.actions}>
          {tab === 'new' ? (
            <>
              <Pressable
                onPress={() => { haptics.light(); setLinking(item); }}
                accessibilityRole="button"
                accessibilityLabel={copy.inboxLink}
                style={({ pressed }) => [st.primary, { backgroundColor: C.accent, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[st.primaryTxt, { color: C.bg }]}>{copy.inboxLink}</Text>
              </Pressable>
              <Pressable
                onPress={() => { haptics.light(); onIgnore(item); }}
                accessibilityRole="button"
                accessibilityLabel={copy.inboxIgnore}
                style={({ pressed }) => [st.secondary, { borderColor: C.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[st.secondaryTxt, { color: C.muted }]}>{copy.inboxIgnore}</Text>
              </Pressable>
            </>
          ) : tab === 'linked' ? (
            <>
              <Pressable
                onPress={() => { haptics.light(); onUnlink(item); }}
                accessibilityRole="button"
                style={({ pressed }) => [st.secondary, { borderColor: C.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[st.secondaryTxt, { color: C.muted }]}>{copy.inboxUnlink}</Text>
              </Pressable>
              <Pressable
                onPress={() => { haptics.light(); setLinking(item); }}
                accessibilityRole="button"
                style={({ pressed }) => [st.secondary, { borderColor: C.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[st.secondaryTxt, { color: C.muted }]}>{copy.inboxMove}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                onPress={() => { haptics.light(); setLinking(item); }}
                accessibilityRole="button"
                style={({ pressed }) => [st.secondary, { borderColor: C.border, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[st.secondaryTxt, { color: C.muted }]}>{copy.inboxAddAnyway}</Text>
              </Pressable>
              <Pressable
                onPress={() => askDelete(item)}
                accessibilityRole="button"
                style={({ pressed }) => [st.secondary, { borderColor: '#E5484D', opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[st.secondaryTxt, { color: '#E5484D' }]}>{copy.inboxDelete}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    );

    // Swiping is a shortcut for the two buttons above, and only where those buttons are.
    if (tab !== 'new') return <View key={item.messageId}>{card}</View>;
    return (
      <Swipeable
        key={item.messageId}
        friction={2}
        leftThreshold={72}
        rightThreshold={72}
        renderLeftActions={() => (
          <View style={[st.swipe, { backgroundColor: C.accent }]}>
            <Text style={[st.swipeTxt, { color: C.bg }]}>{copy.inboxLink}</Text>
          </View>
        )}
        renderRightActions={() => (
          <View style={[st.swipe, st.swipeRight, { backgroundColor: C.border }]}>
            <Text style={[st.swipeTxt, { color: C.text }]}>{copy.inboxIgnore}</Text>
          </View>
        )}
        onSwipeableOpen={(direction) => {
          haptics.light();
          if (direction === 'left') setLinking(item);
          else onIgnore(item);
        }}
      >
        {card}
      </Swipeable>
    );
  };

  const emptyTitle = tab === 'new'
    ? copy.inboxEmptyNew
    : tab === 'linked' ? copy.inboxEmptyLinked : copy.inboxEmptyIgnored;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[st.root, { backgroundColor: C.bg }]}>
        <View style={[st.head, { paddingTop: insets.top + 8, borderBottomColor: C.border }]}>
          <Text style={[st.screenTitle, { color: C.text }]}>{copy.inboxTitle}</Text>
          <Pressable
            onPress={() => { haptics.light(); setSort(sort === 'newest' ? 'tripDate' : 'newest'); }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={`${copy.date} · ${sort === 'tripDate' ? copy.inboxTabNew : copy.inboxTitle}`}
            style={st.headBtn}
          >
            <SortAscending size={20} color={sort === 'tripDate' ? C.accent : C.muted} />
          </Pressable>
          <Pressable
            onPress={() => { haptics.light(); onScanNow(); }}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={copy.inboxScanButton}
            style={st.headBtn}
          >
            <ArrowsClockwise size={20} color={C.muted} />
          </Pressable>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={copy.close}>
            <X size={22} color={C.text} />
          </Pressable>
        </View>

        <View style={[st.tabs, { borderBottomColor: C.border }]}>
          {INBOX_TABS.map(name => (
            <Pressable
              key={name}
              onPress={() => { haptics.light(); setTab(name); }}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === name }}
              style={[st.tab, tab === name && { borderBottomColor: C.accent }]}
            >
              <Text style={[st.tabTxt, { color: tab === name ? C.text : C.muted }]} numberOfLines={1}>
                {`${copy[TAB_LABEL[name]]}${counts[name] ? ` (${counts[name]})` : ''}`}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[st.searchRow, { backgroundColor: C.card, borderColor: C.border }]}>
          <MagnifyingGlass size={18} color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={copy.inboxSearchPlaceholder}
            placeholderTextColor={C.muted}
            style={[st.search, { color: C.text }]}
            autoCorrect={false}
            accessibilityLabel={copy.inboxSearchPlaceholder}
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={st.chips}
          style={st.chipsRow}
        >
          {INBOX_FILTERS.map(name => (
            <Pressable
              key={name}
              onPress={() => { haptics.light(); setFilter(name); }}
              accessibilityRole="button"
              accessibilityState={{ selected: filter === name }}
              style={[
                st.chip,
                { borderColor: C.border },
                filter === name && { backgroundColor: C.accent, borderColor: C.accent },
              ]}
            >
              <Text style={[st.chipTxt, { color: filter === name ? C.bg : C.muted }]}>
                {copy[FILTER_LABEL[name]] as string}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView contentContainerStyle={[st.list, { paddingBottom: 32 + insets.bottom }]}>
          {shown.length ? shown.map(renderCard) : (
            <View style={st.empty}>
              <Text style={st.emptyIcon} allowFontScaling={false}>📬</Text>
              <Text style={[st.emptyTitle, { color: C.text }]}>{emptyTitle}</Text>
              {tab === 'new' ? (
                <Text style={[st.emptyBody, { color: C.muted }]}>{copy.inboxEmptyScan}</Text>
              ) : null}
              {/*
                Scanning is offered on every empty tab, not only the first [N/1]: someone looking at an
                empty "linked" or "ignored" list is just as likely to want a fresh look at their mailbox,
                and Settings should not be the only way to ask for one.
              */}
              <Pressable
                onPress={() => { haptics.light(); onScanNow(); }}
                accessibilityRole="button"
                accessibilityLabel={copy.inboxScanButton}
                style={({ pressed }) => [st.primary, st.emptyBtn, { backgroundColor: C.accent, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[st.primaryTxt, { color: C.bg }]}>{copy.inboxScanButton}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Which trip does this belong to? */}
      <Modal
        visible={!!linking}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setLinking(null)}
      >
        <View style={[st.root, { backgroundColor: C.bg }]}>
          <View style={[st.head, { paddingTop: insets.top + 8, borderBottomColor: C.border }]}>
            <Text style={[st.screenTitle, { color: C.text }]}>{copy.inboxLink}</Text>
            <Pressable onPress={() => setLinking(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={copy.close}>
              <X size={22} color={C.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={[st.list, { paddingBottom: 32 + insets.bottom }]}>
            {/* No trips to offer: say so, rather than showing a lone "ignore" button and no explanation. */}
            {trips.length === 0 ? (
              <View style={st.empty}>
                <Text style={st.emptyIcon} allowFontScaling={false}>🧳</Text>
                <Text style={[st.emptyTitle, { color: C.text }]}>{copy.inboxNoTrips}</Text>
                <Text style={[st.emptyBody, { color: C.muted }]}>{copy.inboxNoTripsHint}</Text>
              </View>
            ) : null}
            {trips.map(trip => (
              <Pressable
                key={trip.key}
                onPress={() => {
                  const item = linking;
                  setLinking(null);
                  if (item) { haptics.medium(); onLink(item, trip.key); }
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  st.tripRow,
                  { backgroundColor: C.card, borderColor: C.border, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[st.title, { color: C.text }]} numberOfLines={1}>{trip.title}</Text>
                  <Text style={[st.detail, { color: C.muted }]} numberOfLines={1}>
                    {[dayLabel(trip.startYmd), trip.flightNumber].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                const item = linking;
                setLinking(null);
                if (item) { haptics.light(); onIgnore(item); }
              }}
              accessibilityRole="button"
              style={({ pressed }) => [st.secondary, st.noneBtn, { borderColor: C.border, opacity: pressed ? 0.6 : 1 }]}
            >
              <Text style={[st.secondaryTxt, { color: C.muted }]}>{copy.inboxIgnore}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  screenTitle: { flex: 1, fontSize: 20, fontWeight: '800' },
  headBtn: { padding: 2 },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabTxt: { fontSize: 14, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  search: { flex: 1, paddingVertical: 10, fontSize: 15 },
  /*
   * flexShrink defaults to 1 in React Native, so with a full list below it the chip row was squeezed to a
   * sliver and the chips were cut off — fine on an empty inbox, clipped the moment there was anything to
   * show [N/1]. No fixed height: the chips grow with the system font size and must stay whole.
   */
  chipsRow: { flexGrow: 0, flexShrink: 0, marginTop: 10 },
  chips: { paddingHorizontal: 20, gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  chipTxt: { fontSize: 13, fontWeight: '700' },
  list: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  card: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  cardTop: { flexDirection: 'row', gap: 12 },
  icon: { fontSize: 24 },
  cardBody: { flex: 1, gap: 2 },
  kind: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '700' },
  detail: { fontSize: 13, lineHeight: 18 },
  suggest: { fontSize: 13, fontWeight: '700', marginTop: 2 },
  via: { fontSize: 11, alignSelf: 'flex-end' },
  actions: { flexDirection: 'row', gap: 8 },
  primary: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  primaryTxt: { fontSize: 14, fontWeight: '800' },
  secondary: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  secondaryTxt: { fontSize: 14, fontWeight: '700' },
  swipe: { justifyContent: 'center', paddingHorizontal: 22, borderRadius: 14, marginVertical: 0 },
  swipeRight: { alignItems: 'flex-end' },
  swipeTxt: { fontSize: 14, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 48, gap: 8 },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyBody: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  emptyBtn: { flex: undefined, marginTop: 14, paddingHorizontal: 28 },
  tripRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  noneBtn: { flex: undefined, marginTop: 6 },
});
