import { useEffect, useState } from 'react';
import {
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  getMembership,
  saveMembership,
  type MilesMembership,
} from '../lib/milesStorage';

type Tier = MilesMembership['tier'];

const TIERS: { id: Tier; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'silver', label: 'Silver' },
  { id: 'gold', label: 'Gold' },
  { id: 'platinum', label: 'Platinum' },
];

const TIER_COLOR: Record<Tier, string> = {
  none: '#9CA3AF',
  silver: '#C0C0C0',
  gold: '#C9A84C',
  platinum: '#E5E4E2',
};

function maskNumber(raw: string): string {
  const s = String(raw || '').replace(/\s+/g, '');
  if (s.length <= 6) return `${s.slice(0, 2)}***${s.slice(-1)}`;
  return `${s.slice(0, 4)}***${s.slice(-2)}`;
}

export default function MilesWallet({
  airlineCode,
  program,
  milesUrl,
}: {
  airlineCode: string;
  program: string;
  milesUrl: string;
}) {
  const [membership, setMembership] = useState<MilesMembership | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [draftNumber, setDraftNumber] = useState('');
  const [draftTier, setDraftTier] = useState<Tier>('none');

  useEffect(() => {
    let cancelled = false;
    getMembership(airlineCode).then(row => {
      if (!cancelled) setMembership(row);
    });
    return () => { cancelled = true; };
  }, [airlineCode]);

  const openModal = () => {
    setDraftNumber(membership?.memberNumber || '');
    setDraftTier(membership?.tier || 'none');
    setModalOpen(true);
  };

  const onSave = async () => {
    const memberNumber = draftNumber.replace(/\s+/g, '');
    if (!memberNumber) return;
    const row: MilesMembership = {
      airlineCode,
      program,
      memberNumber,
      tier: draftTier,
    };
    await saveMembership(row);
    setMembership(row);
    setModalOpen(false);
  };

  return (
    <View style={st.wrap}>
      {membership ? (
        <View style={st.saved}>
          <View style={st.savedTop}>
            <Text style={st.number}>{maskNumber(membership.memberNumber)}</Text>
            <View style={[st.badge, { backgroundColor: TIER_COLOR[membership.tier] }]}>
              <Text style={[
                st.badgeTxt,
                membership.tier === 'none' ? st.badgeTxtMuted : st.badgeTxtDark,
              ]}>
                {membership.tier.toUpperCase()}
              </Text>
            </View>
          </View>
          <View style={st.savedActions}>
            <Pressable
              onPress={openModal}
              accessibilityRole="button"
              accessibilityLabel="Edit"
              style={st.editBtn}
            >
              <Text style={st.editTxt}>Edit</Text>
            </Pressable>
            <Pressable
              onPress={() => { void Linking.openURL(milesUrl); }}
              accessibilityRole="link"
              accessibilityLabel="Go to my account"
              style={st.accountBtn}
            >
              <Text style={st.accountTxt}>Go to my account →</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={openModal}
          accessibilityRole="button"
          accessibilityLabel={`Save my ${program} number`}
          style={st.saveBtn}
        >
          <Text style={st.saveTxt}>{`+ Save my ${program} number`}</Text>
        </Pressable>
      )}

      <Modal
        visible={modalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setModalOpen(false)}
      >
        <Pressable style={st.overlay} onPress={() => setModalOpen(false)}>
          <Pressable style={st.sheet} onPress={e => e.stopPropagation()}>
            <Text style={st.sheetTitle}>{program}</Text>
            <TextInput
              value={draftNumber}
              onChangeText={setDraftNumber}
              keyboardType="number-pad"
              autoCorrect={false}
              placeholder="Member number"
              placeholderTextColor="rgba(255,255,255,0.35)"
              style={st.input}
              accessibilityLabel="Member number"
            />
            <View style={st.pills}>
              {TIERS.map(tier => {
                const on = draftTier === tier.id;
                return (
                  <Pressable
                    key={tier.id}
                    onPress={() => setDraftTier(tier.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[st.pill, on && st.pillOn]}
                  >
                    <Text style={[st.pillTxt, on && st.pillTxtOn]}>{tier.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={st.modalActions}>
              <Pressable
                onPress={() => setModalOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={st.cancelBtn}
              >
                <Text style={st.cancelTxt}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => { void onSave(); }}
                accessibilityRole="button"
                accessibilityLabel="Save"
                style={st.confirmBtn}
              >
                <Text style={st.confirmTxt}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    marginTop: 10,
  },
  saveBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 8,
    padding: 10,
  },
  saveTxt: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  saved: {
    gap: 8,
  },
  savedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  number: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.6,
    flex: 1,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeTxt: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  badgeTxtDark: {
    color: '#0D1B2E',
  },
  badgeTxtMuted: {
    color: '#111827',
  },
  savedActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  editTxt: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  accountBtn: {
    flex: 1,
    backgroundColor: 'rgba(201,168,76,0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(201,168,76,0.4)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  accountTxt: {
    color: '#C9A84C',
    fontSize: 12,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    backgroundColor: '#112240',
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(201,168,76,0.35)',
    padding: 16,
    gap: 12,
  },
  sheetTitle: {
    color: '#C9A84C',
    fontSize: 14,
    fontWeight: '800',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pill: {
    borderRadius: 999,
    borderWidth: 0.5,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  pillOn: {
    backgroundColor: 'rgba(201,168,76,0.22)',
    borderColor: '#C9A84C',
  },
  pillTxt: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '700',
  },
  pillTxtOn: {
    color: '#C9A84C',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  cancelTxt: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#C9A84C',
  },
  confirmTxt: {
    color: '#0D1B2E',
    fontSize: 14,
    fontWeight: '800',
  },
});
