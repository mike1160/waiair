/**
 * Who is following this flight — the traveller's side of Family Safety Mode.
 *
 * Until now the traveller saw a number and nothing else: someone opened the link and was in, with no way to
 * see who or to remove them. This is that list, with a name, how long they have been following, and a way to
 * end it per person. Stopping the whole share is still a long-press on the badge, unchanged.
 *
 * The proxy never hands over push tokens (proxy/familyPush.js), so a follower is identified here only by an
 * opaque id — enough to remove them, useless for anything else.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserCircle, X } from 'phosphor-react-native';
import { t } from '../lib/i18n';
import { haptics } from '../lib/haptics';
import { fetchFollowers, followerAge, revokeFollower, type Follower } from '../lib/followerList';

type Colors = { bg: string; card: string; text: string; muted: string; border: string; accent: string };

type Props = {
  visible: boolean;
  /** The share token of this flight; the list belongs to it. */
  token: string;
  colors: Colors;
  onClose: () => void;
  /** So the badge behind the sheet follows along after a revoke. */
  onCountChange?: (count: number) => void;
};

function ageLabel(since: number, now: number): string {
  const copy = t();
  const age = followerAge(since, now);
  if (age.kind === 'days') return copy.followerSinceDays(age.n);
  if (age.kind === 'hours') return copy.followerSinceHours(age.n);
  return copy.followerSinceJustNow;
}

export default function FollowerListSheet({ visible, token, colors: C, onClose, onCountChange }: Props) {
  const copy = t();
  const insets = useSafeAreaInsets();
  const [followers, setFollowers] = useState<Follower[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!visible) {
      setFollowers(null);
      return undefined;
    }
    const controller = new AbortController();
    let alive = true;
    setBusy(true);
    setNow(Date.now());
    fetchFollowers(token, controller.signal)
      .then(list => {
        if (!alive) return;
        setFollowers(list || []);
        onCountChange?.((list || []).length);
      })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; controller.abort(); };
  }, [visible, token, onCountChange]);

  const remove = useCallback((follower: Follower) => {
    Alert.alert(follower.name || copy.followerNoName, copy.followerRevokeConfirm, [
      { text: copy.cancel, style: 'cancel' },
      {
        text: copy.followerRevoke,
        style: 'destructive',
        onPress: () => {
          haptics.medium();
          // Gone from the list at once; the proxy confirms, and puts it back if it could not.
          const before = followers || [];
          const after = before.filter(f => f.id !== follower.id);
          setFollowers(after);
          onCountChange?.(after.length);
          void revokeFollower(token, follower.id).then(ok => {
            if (ok) return;
            setFollowers(before);
            onCountChange?.(before.length);
          });
        },
      },
    ]);
  }, [followers, token, copy, onCountChange]);

  const list = followers || [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[st.root, { backgroundColor: C.bg }]}>
        <View style={[st.head, { paddingTop: insets.top + 8, borderBottomColor: C.border }]}>
          <Text style={[st.title, { color: C.text }]}>{copy.followerListTitle}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={copy.close}>
            <X size={22} color={C.text} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={[st.body, { paddingBottom: 24 + insets.bottom }]}>
          {busy && !followers ? (
            <ActivityIndicator style={{ marginTop: 24 }} color={C.accent} />
          ) : list.length === 0 ? (
            <Text style={[st.empty, { color: C.muted }]}>{copy.followerListEmpty}</Text>
          ) : (
            list.map(follower => (
              <View key={follower.id} style={[st.row, { borderBottomColor: C.border }]}>
                <UserCircle size={26} color={C.muted} />
                <View style={st.who}>
                  <Text style={[st.name, { color: C.text }]} numberOfLines={1}>
                    {follower.name || copy.followerNoName}
                  </Text>
                  <Text style={[st.since, { color: C.muted }]}>{ageLabel(follower.since, now)}</Text>
                </View>
                <Pressable
                  onPress={() => remove(follower)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`${copy.followerRevoke}: ${follower.name || copy.followerNoName}`}
                  style={({ pressed }) => [st.revoke, { borderColor: C.border, opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[st.revokeTxt, { color: '#E5484D' }]}>{copy.followerRevoke}</Text>
                </Pressable>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 20, fontWeight: '800' },
  body: { paddingHorizontal: 20 },
  empty: { fontSize: 15, lineHeight: 21, marginTop: 28, textAlign: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  who: { flex: 1, gap: 2 },
  name: { fontSize: 16, fontWeight: '700' },
  since: { fontSize: 13, fontWeight: '500' },
  revoke: { borderWidth: 1, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  revokeTxt: { fontSize: 13, fontWeight: '700' },
});
