/**
 * Kids mode on the home screen: a big friendly question with the little plane flying next to it, three emoji
 * destination buttons, and the "where are we going?" card with the airport, the waving pilot, the stewardess
 * and one big scan button. Searching, scanning and the results below are the home screen's own.
 */
import { Image, StyleSheet, Text, View } from 'react-native';
import ThemeLogo from '../ThemeLogo';
import { t } from '../../lib/i18n';
import { useMode } from '../../lib/modeContext';
import { KIDS_ART, KIDS_VIDEO } from '../../lib/kidsAssets';
import { KIDS_DESTINATION_EMOJI, kidsDestinations, type KidsDestinationKind } from '../../lib/kidsDestinations';
import { KIDS_FONT, KidsBounce, KidsFloat, KidsVideo, KidsWave } from './KidsParts';

export function KidsHomeHeader() {
  const { C } = useMode();
  return (
    <View style={st.header}>
      <Text style={[st.title, { color: C.text }]}>{t().kids_home_title}</Text>
      <View style={st.planeWrap}>
        <KidsVideo source={KIDS_VIDEO.airplane} style={st.plane} />
      </View>
    </View>
  );
}

const KINDS: KidsDestinationKind[] = ['beach', 'city', 'adventure'];

export function KidsDestinationButtons({
  homeCountry,
  onPick,
}: {
  homeCountry?: string | null;
  onPick: (iata: string) => void;
}) {
  const { C } = useMode();
  const copy = t();
  const picks = kidsDestinations(homeCountry);
  const label: Record<KidsDestinationKind, string> = {
    beach: copy.kids_beach,
    city: copy.kids_city,
    adventure: copy.kids_adventure,
  };
  return (
    <View style={st.destRow}>
      {KINDS.map((k, i) => (
        <KidsFloat key={k} style={{ flex: 1 }} delayMs={i * 400}>
          <KidsBounce
            onPress={() => onPick(picks[k])}
            style={[st.destBtn, { backgroundColor: C.card, borderColor: C.border }]}
            accessibilityRole="button"
            accessibilityLabel={label[k]}
          >
            <Text style={st.destEmoji}>{KIDS_DESTINATION_EMOJI[k]}</Text>
            <Text style={[st.destLabel, { color: C.text }]} numberOfLines={1} adjustsFontSizeToFit>{label[k]}</Text>
          </KidsBounce>
        </KidsFloat>
      ))}
    </View>
  );
}

/** Where are we going? The empty-state card with the one big scan button. */
export function KidsScanCard({ onScan }: { onScan: () => void }) {
  const { C } = useMode();
  const copy = t();
  return (
    <KidsFloat>
      <View style={[st.scanCard, { backgroundColor: C.card, borderColor: C.border }]}>
        <View style={st.scene}>
          <Image source={KIDS_ART.airportBuilding} style={st.building} />
          <KidsWave style={st.pilotWrap}>
            <Image source={KIDS_ART.pilot} style={st.pilot} />
          </KidsWave>
        </View>
        <Text style={[st.empty, { color: C.text }]}>{copy.kids_empty}</Text>
        <View style={st.scanRow}>
          <KidsBounce
            onPress={onScan}
            style={[st.scanBtn, { backgroundColor: C.accent }]}
            accessibilityRole="button"
            accessibilityLabel={copy.scanBoardingPass}
          >
            <Image source={KIDS_ART.boardingPass} style={st.passIcon} />
            <Text style={st.scanTxt} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
              {copy.scanBoardingPass}
            </Text>
          </KidsBounce>
          <KidsWave>
            <Image source={KIDS_ART.stewardess} style={st.stewardess} />
          </KidsWave>
        </View>
      </View>
    </KidsFloat>
  );
}

const st = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14, minHeight: 120 },
  title: { flex: 1, fontFamily: KIDS_FONT, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  planeWrap: { width: 120, height: 120, borderRadius: 60, overflow: 'hidden' },
  plane: { width: 120, height: 120 },
  destRow: { flexDirection: 'row', gap: 10, marginTop: 14, marginBottom: 6 },
  destBtn: {
    height: 100,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  destEmoji: { fontSize: 38 },
  destLabel: { fontFamily: KIDS_FONT, fontSize: 15, fontWeight: '700' },
  scanCard: { borderRadius: 30, borderWidth: 2, padding: 18, marginTop: 14, alignItems: 'center' },
  scene: { width: 260, height: 200, alignItems: 'center' },
  building: { width: 200, height: 200, borderRadius: 100 },
  pilotWrap: { position: 'absolute', left: 0, bottom: -6 },
  pilot: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  empty: { fontFamily: KIDS_FONT, fontSize: 24, fontWeight: '700', textAlign: 'center', marginTop: 14 },
  scanRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, alignSelf: 'stretch' },
  scanBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passIcon: { width: 40, height: 40, borderRadius: 20 },
  scanTxt: { flex: 1, color: '#FFFFFF', fontFamily: KIDS_FONT, fontSize: 17, lineHeight: 21, fontWeight: '700' },
  stewardess: { width: 80, height: 80, borderRadius: 40 },
});

/** The tracked home screen's top band in kids mode: the logo and the little plane where the photo sky was. */
export function KidsTrackedBand({ height, insetTop }: { height: number; insetTop: number }) {
  return (
    <View style={[band.wrap, { height, paddingTop: insetTop + 44 }]} pointerEvents="none">
      <ThemeLogo />
      <View style={st.planeWrap}>
        <KidsVideo source={KIDS_VIDEO.airplane} style={st.plane} />
      </View>
    </View>
  );
}

const band = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 },
});
